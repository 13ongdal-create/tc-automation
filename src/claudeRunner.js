const { spawn } = require('child_process');

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLAUDE_WORKDIR = process.env.CLAUDE_WORKDIR;
// Phase 1~4 전체를 한 번에 돌 수도 있어 시간이 오래 걸릴 수 있음 (기본 15분)
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 15 * 60 * 1000);

/** Windows에서는 taskkill /T로 하위 프로세스(git, npx playwright 등)까지 트리 전체를 종료합니다. */
function killTree(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
  } else {
    try {
      process.kill(-pid, 'SIGKILL'); // 프로세스 그룹 전체
    } catch {
      process.kill(pid, 'SIGKILL');
    }
  }
}

/** tool_use 블록 하나를 사람이 읽을 수 있는 "지금 뭐 하는 중" 문구로 요약합니다. */
function describeToolUse(block) {
  const name = block.name;
  const input = block.input || {};
  if (input.description) return `${name}: ${input.description}`;
  if (name === 'Bash') return `Bash: ${(input.command || '').slice(0, 100)}`;
  if (name === 'Read') return `Read: ${input.file_path || ''}`;
  if (name === 'Write') return `Write: ${input.file_path || ''}`;
  if (name === 'Edit') return `Edit: ${input.file_path || ''}`;
  if (name === 'Grep') return `Grep: "${input.pattern || ''}"`;
  if (name === 'Glob') return `Glob: "${input.pattern || ''}"`;
  return name;
}

/**
 * claude CLI를 headless로, 실시간 스트리밍 출력(stream-json)으로 실행합니다.
 * 스트림에서 "지금 어떤 tool을 쓰고 있는지"를 그때그때 추출해두므로, 별도로 Claude를 다시 호출(=토큰 소모)
 * 하지 않고도 handle.status로 현재 진행 상황을 즉시 조회할 수 있습니다.
 * @param {string[]} args - 예: ['-p', prompt] 또는 ['--resume', sessionId, '-p', prompt]
 * @param {{ onProcess?: (handle: { pid: number, cancel: () => void, status: string|null, startedAt: number }) => void }} [opts]
 */
function runClaude(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const fullArgs = [...args, '--output-format', 'stream-json', '--verbose'];
    const child = spawn(CLAUDE_BIN, fullArgs, {
      cwd: CLAUDE_WORKDIR,
      // shell:false - args를 그대로 argv로 전달해 셸 인젝션 위험 없이 안전하게 실행 (Slack 사용자 입력이 그대로 들어오므로 중요)
      shell: false,
      windowsHide: true,
    });

    let cancelled = false;
    let lastStatus = null;
    let sessionIdSeen = null;
    let finalResult = null;
    let buffer = '';
    let stderr = '';

    const handle = {
      pid: child.pid,
      startedAt,
      cancel: () => {
        cancelled = true;
        killTree(child.pid);
      },
      get status() {
        return lastStatus;
      },
    };
    if (opts.onProcess) opts.onProcess(handle);

    const timer = setTimeout(() => {
      cancelled = true;
      killTree(child.pid);
    }, TIMEOUT_MS);

    function handleEvent(evt) {
      if (evt.session_id) sessionIdSeen = evt.session_id;
      if (evt.type === 'assistant' && evt.message && Array.isArray(evt.message.content)) {
        for (const block of evt.message.content) {
          if (block.type === 'tool_use') {
            lastStatus = describeToolUse(block);
          } else if (block.type === 'text' && block.text && block.text.trim()) {
            lastStatus = block.text.trim().slice(0, 200);
          }
        }
      } else if (evt.type === 'result') {
        finalResult = evt;
      }
    }

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          handleEvent(JSON.parse(line));
        } catch {
          // stream-json 한 줄 파싱 실패는 무시하고 계속 진행 (다음 줄에서 이어감)
        }
      }
    });
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (cancelled) {
        const err = new Error('claude CLI 실행이 중단되었습니다.');
        err.cancelled = true;
        reject(err);
        return;
      }
      if (finalResult) {
        resolve({
          sessionId: finalResult.session_id || sessionIdSeen || null,
          resultText: finalResult.result || finalResult.message || '',
          isError: Boolean(finalResult.is_error),
          raw: finalResult,
        });
        return;
      }
      if (code !== 0) {
        reject(new Error(`claude CLI 종료 코드 ${code}\n${stderr.slice(0, 2000)}`));
        return;
      }
      resolve({ sessionId: sessionIdSeen, resultText: '(빈 응답)', isError: true, raw: null });
    });
  });
}

/** 새 스레드의 첫 요청 - 새 Claude Code 세션 시작 */
function startSession(prompt, opts) {
  return runClaude(['-p', prompt], opts);
}

/** 같은 스레드의 후속 메시지(수정요청/승인/반려/결함관리) - 기존 세션 이어서 실행 */
function resumeSession(sessionId, prompt, opts) {
  return runClaude(['--resume', sessionId, '-p', prompt], opts);
}

module.exports = { startSession, resumeSession };
