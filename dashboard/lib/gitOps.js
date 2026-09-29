// git add/commit/push를 대시보드에서 직접 실행하는 순수 로직 (Claude 미사용, 토큰 소모 없음).
// AGENTS.md 18항 규칙을 그대로 코드로 옮깁니다:
//   - git add는 반드시 해당 프로젝트 경로로만 스코핑 (절대 -A/. 사용 금지)
//   - 커밋 메시지는 "{프로젝트명}: {작업 요약}" 형식
//   - push는 커밋과 분리 — 절대 자동으로 실행하지 않고, 사용자가 버튼을 누른 시점에만 실행
// 사용자 요청(2026-09-29)으로 테스트 실행 큐 결과 반영·TC 엑셀 업로드처럼 AGENTS.md가 이미
// "완료 즉시 자동 커밋" 대상으로 정의한 작업(Phase 4/8 상당)에 한해 자동 커밋을 붙입니다 —
// 결함 상태/담당자 등 잦은 소소한 편집(20-4항)은 기존 정책 그대로 자동 커밋 대상이 아닙니다.
const { execFile } = require('child_process');
const { TC_AUTOMATION_ROOT } = require('./defectStore');

function run(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: TC_AUTOMATION_ROOT, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

/**
 * 지정한 경로(들)만 스코핑해 add+commit 합니다. 그 경로에 실제 변경사항이 없으면(예: 업로드했지만
 * 반영된 행이 0건) 조용히 건너뜁니다 — "커밋할 게 없음"은 에러가 아닙니다.
 * @param {string[]} paths - 예: ['project/ABC마트']
 * @returns {Promise<{committed:boolean, hash?:string, error?:string}>}
 */
async function commitPaths(paths, message) {
  try {
    await run(['add', '--', ...paths]);
    const status = await run(['status', '--porcelain', '--', ...paths]);
    if (!status.trim()) return { committed: false };
    await run(['commit', '-m', message]);
    const hash = (await run(['rev-parse', '--short', 'HEAD'])).trim();
    return { committed: true, hash };
  } catch (err) {
    // git commit 실패(예: user.name/email 미설정)가 TC 업로드·테스트 실행 자체를 실패시키지
    // 않도록, 호출부는 이 error 필드만 사용자에게 보여주고 나머지 결과는 그대로 반환합니다.
    return { committed: false, error: (err.stderr || err.message || '').trim().slice(0, 500) };
  }
}

/** 로컬 브랜치가 origin보다 몇 커밋 앞/뒤인지와 최근 커밋 로그를 반환합니다 (push 전 상태 표시용). */
async function status() {
  const branch = (await run(['branch', '--show-current'])).trim();
  let ahead = 0;
  let behind = 0;
  try {
    const counts = (await run(['rev-list', '--left-right', '--count', `origin/${branch}...${branch}`])).trim();
    const [b, a] = counts.split(/\s+/).map(Number);
    behind = b || 0;
    ahead = a || 0;
  } catch {
    // origin/{branch}가 없는 등 — ahead/behind 계산 불가 시 0으로 둠
  }
  let recentCommits = [];
  if (ahead > 0) {
    const log = await run(['log', `-n${Math.min(ahead, 20)}`, '--pretty=format:%h %s']);
    recentCommits = log.split('\n').filter(Boolean).map((line) => {
      const idx = line.indexOf(' ');
      return { hash: line.slice(0, idx), message: line.slice(idx + 1) };
    });
  }
  return { branch, ahead, behind, recentCommits };
}

/** origin의 현재 브랜치로 push합니다. 사용자가 명시적으로 버튼을 눌렀을 때만 호출되어야 합니다. */
async function push() {
  const branch = (await run(['branch', '--show-current'])).trim();
  await run(['push', 'origin', branch]);
  return { branch };
}

module.exports = { commitPaths, status, push };
