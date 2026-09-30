// Playwright 테스트를 직접 spawn해 실시간으로 스트리밍하는 순수 로직.
// claude CLI를 거치지 않는 "zero-token" 경로입니다 — dashboard/lib/defectStore.js의 zero-token
// 편집과 같은 설계 원칙(대시보드가 직접 파일시스템/프로세스를 다루고, 판단이 필요한 산출물(HTML
// 뷰어 재생성 등)만 채팅의 claude 세션에 맡김)을 테스트 실행에도 적용합니다.
// 큐가 여러 모듈을 순차 실행할 때는 이 모듈의 runSpec()을 모듈 수만큼 반복 호출합니다.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { TC_AUTOMATION_ROOT } = require('./defectStore');

// claudeRunner.js와 달리 .cmd 셈(npx.cmd)을 거치지 않고, Playwright의 실제 JS 진입점을
// node.exe로 직접 실행합니다 — Windows에서 shell:false로 .cmd를 spawn할 때의 불확실성을
// 원천적으로 피하기 위함(node.exe는 셈이 아닌 순수 실행파일이라 항상 안전하게 spawn됨).
const PLAYWRIGHT_CLI = path.join(TC_AUTOMATION_ROOT, 'node_modules', 'playwright', 'cli.js');
const CONFIG_PATH = path.join(TC_AUTOMATION_ROOT, 'playwright.config.js');
// 큐로 실행하는 대상은 보통 spec 파일 하나(또는 그 안의 일부 TC)라 채팅 경로(15분)보다 짧게 잡되,
// 대규모 "전체 TC 일괄 실행"의 한 모듈이 오래 걸릴 수 있어 넉넉히 20분으로 설정.
const TIMEOUT_MS = Number(process.env.TEST_QUEUE_TIMEOUT_MS || 20 * 60 * 1000);

function killTree(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      process.kill(pid, 'SIGKILL');
    }
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * spec 파일 하나(또는 --grep으로 좁힌 그 안의 일부 tcId들)를 실행합니다.
 * @param {{project:string, specFile:string, tcIds?:string[]|null, record?:boolean,
 *          onLog?:(line:string)=>void, onProcess?:(handle:object)=>void}} opts
 */
function runSpec(opts) {
  return new Promise((resolve, reject) => {
    const { project, specFile, tcIds, record, onLog, onProcess } = opts;
    const args = [PLAYWRIGHT_CLI, 'test', '--config', CONFIG_PATH, specFile];
    if (tcIds && tcIds.length) {
      args.push('--grep', `(${tcIds.map(escapeRegExp).join('|')})`);
    }

    const child = spawn(process.execPath, args, {
      cwd: TC_AUTOMATION_ROOT,
      env: { ...process.env, PW_RUN_ID: project, PW_RECORD: record ? '1' : '0' },
      shell: false,
      windowsHide: true,
    });

    let cancelled = false;
    const handle = {
      pid: child.pid,
      cancel: () => {
        cancelled = true;
        killTree(child.pid);
      },
    };
    if (onProcess) onProcess(handle);

    const timer = setTimeout(() => {
      cancelled = true;
      killTree(child.pid);
    }, TIMEOUT_MS);

    let buf = '';
    const emit = (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (onLog && line) onLog(line);
      }
    };
    child.stdout.on('data', emit);
    child.stderr.on('data', emit);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (buf.trim() && onLog) onLog(buf.trim());
      if (cancelled) {
        const err = new Error('테스트 실행이 중단되었습니다.');
        err.cancelled = true;
        reject(err);
        return;
      }
      // exitCode !== 0은 테스트 실패 시 정상적으로 발생 — 실제 성공/실패 판정은 호출 쪽이
      // results.json(JSON reporter)을 읽어서 합니다.
      resolve({ exitCode: code });
    });
  });
}

/** 방금 실행이 남긴 JSON 리포터 결과 파일을 읽습니다 (없으면 null). */
function readResultsJson(project) {
  const p = path.join(TC_AUTOMATION_ROOT, '_scratch', 'playwright-report', project, 'results.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** results.json의 중첩 suite 구조를 순회하며 [{tcId, title, status, error, attachments}] 로 평탄화합니다. */
function flattenResults(resultsJson) {
  const out = [];
  const TCID_RE = /(TC_[A-Z]+_\d{3})/;
  function walk(suite) {
    for (const spec of suite.specs || []) {
      const m = spec.title.match(TCID_RE);
      if (!m) continue;
      const tcId = m[1];
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const last = results[results.length - 1];
        if (!last) continue;
        out.push({
          tcId,
          title: spec.title,
          status: last.status, // 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
          error: last.error && last.error.message ? String(last.error.message).replace(/\x1B\[[0-9;]*m/g, '') : null,
          attachments: last.attachments || [],
        });
      }
    }
    for (const s of suite.suites || []) walk(s);
  }
  for (const s of resultsJson.suites || []) walk(s);
  return out;
}

const REPLAYS_ROOT = path.join(TC_AUTOMATION_ROOT, '_scratch', 'replays');

/**
 * 녹화 모드로 방금 끝난 모듈의 영상/트레이스/스크린샷을 모듈 실행마다 덮어쓰이는 outputDir 밖으로
 * 복사해 보존하고, 팝업에 뿌릴 [{tcId, title, status, video, trace, screenshots[]}] 를 만듭니다.
 * URL은 대시보드의 /replays/{project}/... 정적 라우트 기준입니다.
 */
function collectReplays(project, runId, moduleCode, flat) {
  const dir = path.join(REPLAYS_ROOT, project, runId, moduleCode);
  fs.mkdirSync(dir, { recursive: true });
  const base = `/replays/${encodeURIComponent(project)}/${encodeURIComponent(runId)}/${encodeURIComponent(moduleCode)}`;
  return flat.map((f) => {
    const item = { tcId: f.tcId, title: f.title, status: f.status, moduleCode, video: null, trace: null, screenshots: [] };
    let shot = 0;
    for (const att of f.attachments) {
      if (!att.path || !fs.existsSync(att.path)) continue;
      const ext = path.extname(att.path) || '';
      let name;
      if (att.name === 'video') name = `${f.tcId}.video${ext}`;
      else if (att.name === 'trace') name = `${f.tcId}.trace${ext}`;
      else if (att.contentType === 'image/png') name = `${f.tcId}.shot${++shot}${ext}`;
      else continue;
      fs.copyFileSync(att.path, path.join(dir, name));
      const url = `${base}/${encodeURIComponent(name)}`;
      if (att.name === 'video') item.video = url;
      else if (att.name === 'trace') item.trace = url;
      else item.screenshots.push(url);
    }
    return item;
  });
}

/** 프로젝트의 이전 녹화 실행본을 전부 지웁니다 — 항상 "가장 최근 1회 실행"만 디스크에 남겨 용량을 고정합니다. */
function pruneReplays(project) {
  fs.rmSync(path.join(REPLAYS_ROOT, project), { recursive: true, force: true });
}

module.exports = { runSpec, readResultsJson, flattenResults, collectReplays, pruneReplays, REPLAYS_ROOT };
