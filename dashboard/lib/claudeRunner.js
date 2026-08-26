// claude CLI를 headless로 spawn해 stream-json 출력을 실시간 파싱하는 순수 로직.
// slack-bridge/src/claudeRunner.js를 기반으로 대시보드용으로 이식 (2026-08-26, 큐돌이 사이트분석·TC생성 채팅 패널)
const { spawn } = require('child_process');

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLAUDE_WORKDIR = process.env.CLAUDE_WORKDIR || process.env.TC_AUTOMATION_ROOT || 'D:/tc-automation';
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

// AGENTS.md에 정의된 마커: 에이전트가 Phase 진행 중 이슈/에러를 발견하면 최종 응답을 기다리지 않고
// 이 형식으로 즉시 한 줄을 출력하도록 지시합니다. 스트리밍 도중 이 줄을 감지해 onIssue로 즉시 전달합니다.
const ISSUE_ALERT_RE = /^ISSUE_ALERT:\s*(.+)$/;

/**
 * claude CLI를 headless로, 실시간 스트리밍 출력(stream-json)으로 실행합니다.
 * @param {string[]} args - 예: ['-p', prompt] 또는 ['--resume', sessionId, '-p', prompt]
 * @param {{ onProcess?: (handle: object) => void, onStatus?: (text: string) => void, onIssue?: (message: string) => void, allowedTools?: string[] }} [opts]
 */
function runClaude(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const fullArgs = [...args, '--output-format', 'stream-json', '--verbose'];
    if (opts.allowedTools && opts.allowedTools.length) {
      fullArgs.push('--allowedTools', ...opts.allowedTools);
    }
    const child = spawn(CLAUDE_BIN, fullArgs, {
      cwd: CLAUDE_WORKDIR,
      // shell:false - args를 그대로 argv로 전달해 셸 인젝션 위험 없이 안전하게 실행 (브라우저에서 온 사용자 입력이 그대로 들어오므로 중요)
      shell: false,
      windowsHide: true,
    });

    let cancelled = false;
    let lastStatus = null;
    let sessionIdSeen = null;
    let finalResult = null;
    let buffer = '';
    let stderr = '';
    const alertedIssues = new Set();

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

    let timedOut = false;
    const timer = setTimeout(() => {
      cancelled = true;
      timedOut = true;
      killTree(child.pid);
    }, TIMEOUT_MS);

    function handleEvent(evt) {
      if (evt.session_id) sessionIdSeen = evt.session_id;
      if (evt.type === 'assistant' && evt.message && Array.isArray(evt.message.content)) {
        for (const block of evt.message.content) {
          if (block.type === 'tool_use') {
            lastStatus = describeToolUse(block);
            if (opts.onStatus) opts.onStatus(lastStatus);
          } else if (block.type === 'text' && block.text && block.text.trim()) {
            lastStatus = block.text.trim().slice(0, 200);
            if (opts.onStatus) opts.onStatus(lastStatus);
            if (opts.onIssue) {
              for (const line of block.text.split('\n')) {
                const m = line.match(ISSUE_ALERT_RE);
                if (m && !alertedIssues.has(m[1])) {
                  alertedIssues.add(m[1]);
                  opts.onIssue(m[1].trim());
                }
              }
            }
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
        const err = new Error(
          timedOut
            ? `claude CLI 실행이 시간 초과(${Math.round(TIMEOUT_MS / 60000)}분)로 자동 종료되었습니다.`
            : 'claude CLI 실행이 중단되었습니다.'
        );
        err.cancelled = true;
        err.isTimeout = timedOut;
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

/** 새 대화의 첫 요청 - 새 Claude Code 세션 시작 */
function startSession(prompt, opts) {
  return runClaude(['-p', prompt], opts);
}

/** 같은 대화의 후속 메시지 - 기존 세션 이어서 실행 */
function resumeSession(sessionId, prompt, opts) {
  return runClaude(['--resume', sessionId, '-p', prompt], opts);
}

module.exports = { startSession, resumeSession };
