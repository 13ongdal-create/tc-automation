// 테스트 실행 큐의 결과를 TC 캐노니컬 JSON / defects.json / results 스냅샷에 반영하는 순수 로직
// (Claude 미사용, 토큰 소모 없음). defect-management 스킬(20-2/20-3항)의 레코드 스키마·중복판정
// 규칙을 코드로 그대로 옮긴 것입니다.
//
// ⚠️ 의도적으로 하지 않는 것: TC 모듈 HTML 뷰어(결함현황 탭 포함)와 results/{...}_Result_{날짜}.html
// 스냅샷 뷰어는 재생성하지 않습니다 — 둘 다 AGENTS.md 14항 스펙(다크테마·모달·CSV/JSON 내보내기 등)을
// 매번 새로 충족해야 하는 생성형 산출물이라, 여기서 고정 템플릿으로 흉내 내면 기존 뷰어와 품질이
// 어긋날 위험이 큽니다. 이 파일은 JSON 데이터(소스 오브 트루스)와, 데이터만으로 충분히 만들 수 있는
// results/index.html(단순 표)까지만 갱신합니다. 나머지 HTML 뷰어 재생성은 채팅(큐돌이)에 요청하세요.
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT } = require('./defectStore');
const defectStore = require('./defectStore');
const resultsStore = require('./resultsStore');
const tcStore = require('./tcStore');

function tcDir(project) {
  return path.join(PROJECTS_ROOT, project, 'TC');
}

function mapStatus(pwStatus) {
  if (pwStatus === 'passed') return 'Pass';
  if (pwStatus === 'skipped') return 'N/A';
  return 'Fail'; // failed / timedOut / interrupted
}

function readAttachment(att) {
  if (att.body) {
    try {
      return Buffer.from(att.body, 'base64');
    } catch {
      return null;
    }
  }
  if (att.path) {
    try {
      return fs.readFileSync(att.path);
    } catch {
      return null;
    }
  }
  return null;
}

/** testFixtures.js가 붙이는 콘솔/네트워크 에러 첨부(있으면) + 스크린샷(있으면)을 골라냅니다. */
function extractAttachments(attachments) {
  const find = (name) => attachments.find((a) => a.name === name);
  // console-error-screenshot(testFixtures 커스텀)이 있으면 그쪽을 우선, 없으면 Playwright 기본 실패 스크린샷
  const screenshotAtt = find('console-error-screenshot') || find('screenshot');
  const consoleAtt = find('console-network-errors');
  const screenshotBuf = screenshotAtt ? readAttachment(screenshotAtt) : null;
  const consoleBuf = consoleAtt ? readAttachment(consoleAtt) : null;
  let consoleData = null;
  if (consoleBuf) {
    try {
      consoleData = JSON.parse(consoleBuf.toString('utf8'));
    } catch {
      consoleData = null;
    }
  }
  return { screenshotBuf, consoleBuf, consoleData };
}

function buildActualResult(flat, consoleData) {
  const parts = [];
  if (flat.status === 'timedOut') parts.push('테스트 타임아웃 발생 (지정된 시간 내 완료되지 않음)');
  if (consoleData) {
    if (consoleData.consoleErrors && consoleData.consoleErrors.length) {
      parts.push(`콘솔 에러:\n  ${consoleData.consoleErrors.join('\n  ')}`);
    }
    if (consoleData.failedRequests && consoleData.failedRequests.length) {
      parts.push(`실패 요청:\n  ${consoleData.failedRequests.join('\n  ')}`);
    }
  }
  if (flat.error) parts.push(flat.error.slice(0, 1500));
  return parts.join('\n') || '(오류 메시지를 확인하지 못했습니다 — trace.zip 참조)';
}

function buildSummaryText(screenName, actualResult) {
  const oneLine = actualResult.split('\n')[0].slice(0, 70);
  return screenName ? `${screenName} > ${oneLine}` : oneLine;
}

function nextDefectId(project, defects) {
  let max = 0;
  for (const d of defects) {
    const m = /_(\d{3})$/.exec(d.defectId || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DEF_${project}_${String(max + 1).padStart(3, '0')}`;
}

/**
 * 한 모듈의 flatResults([{tcId,status,error,attachments}, ...], testRunner.flattenResults 결과)를
 * 캐노니컬 TC json / defects.json / results 스냅샷에 반영합니다.
 * @returns {{moduleCode:string, executed:number, pass:number, fail:number, na:number,
 *            newDefects:string[], reopenedDefects:string[], stillFailingDefects:string[],
 *            passedWithOpenDefect:string[]}}
 */
function applyModuleResults(project, moduleCode, flatResults, opts = {}) {
  const dir = tcDir(project);
  const canonicalPath = path.join(dir, `${project}_TC_${moduleCode}.json`);
  const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
  const itemsById = new Map((canonical.items || []).map((i) => [i.tcId, i]));

  const defects = defectStore.load(project) || [];
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    moduleCode,
    executed: 0,
    pass: 0,
    fail: 0,
    na: 0,
    newDefects: [],
    reopenedDefects: [],
    stillFailingDefects: [],
    passedWithOpenDefect: [],
  };

  const defectsDir = path.join(dir, 'defects');
  fs.mkdirSync(defectsDir, { recursive: true });

  for (const flat of flatResults) {
    const item = itemsById.get(flat.tcId);
    if (!item) continue; // 캐노니컬 파일에 없는 tcId — 건너뜀 (정상적으로는 발생하지 않음)
    summary.executed += 1;

    const status = mapStatus(flat.status);
    item.result = status;

    if (status === 'Pass') {
      summary.pass += 1;
      // 20-3-2: 과거 실패로 열린 결함이 있는데 이번엔 통과했다고 자동으로 완료 처리하지 않습니다 —
      // 우연한 1회성 통과로 결함을 놓치지 않기 위해, 사용자 확인 대상으로만 표시합니다.
      const openDefect = defects.find((d) => d.tcId === flat.tcId && d.status !== '완료');
      if (openDefect) summary.passedWithOpenDefect.push(openDefect.defectId);
      continue;
    }
    if (status === 'N/A') {
      summary.na += 1;
      continue;
    }

    // Fail (failed/timedOut/interrupted)
    summary.fail += 1;
    const { screenshotBuf, consoleBuf, consoleData } = extractAttachments(flat.attachments);
    const actualResult = buildActualResult(flat, consoleData);
    const screenName = item.screenName || '';
    const summaryText = buildSummaryText(screenName || item.majorCategory || '', actualResult);

    const openRecord = defects.find((d) => d.tcId === flat.tcId && d.status !== '완료');
    const closedRecord = !openRecord && defects.find((d) => d.tcId === flat.tcId && d.status === '완료');

    let record;
    if (openRecord) {
      record = openRecord;
      record.history = record.history || [];
      record.history.push({ at: today, status: record.status, note: '테스트 실행 큐 재실행에서도 동일하게 실패' });
      summary.stillFailingDefects.push(record.defectId);
    } else if (closedRecord) {
      record = closedRecord;
      record.status = '재발생';
      record.actualResult = actualResult;
      record.history = record.history || [];
      record.history.push({
        at: today,
        status: '재발생',
        note: '완료 처리된 결함이 테스트 실행 큐 재실행에서 다시 실패해 재발생으로 전환',
      });
      summary.reopenedDefects.push(record.defectId);
    } else {
      const defectId = nextDefectId(project, defects);
      record = {
        defectId,
        tcId: flat.tcId,
        module: item.majorCategory || '',
        screenName,
        severity: item.priority || 'P3',
        status: '신규',
        summary: summaryText,
        testEnv: opts.testEnv || '',
        testSteps: item.steps || '',
        actualResult,
        expectedResult: item.expected || '',
        detectedAt: today,
        source: 'automation',
        screenshot: screenshotBuf ? `TC/defects/${defectId}.png` : '',
        consoleLog: consoleBuf ? `TC/defects/${defectId}.console.json` : '',
        assignee: '',
        issueLink: '',
        history: [{ at: today, status: '신규', note: '테스트 실행 큐(Playwright) 자동 실행 중 최초 발견' }],
      };
      defects.push(record);
      summary.newDefects.push(defectId);
    }

    if (screenshotBuf) fs.writeFileSync(path.join(defectsDir, `${record.defectId}.png`), screenshotBuf);
    if (consoleBuf) fs.writeFileSync(path.join(defectsDir, `${record.defectId}.console.json`), consoleBuf);

    item.issueSummary = record.summary;
    if (!(item.remark || '').includes(record.defectId)) {
      item.remark = item.remark ? `${item.remark}; 관련 결함: ${record.defectId}` : `관련 결함: ${record.defectId}`;
    }
  }

  defectStore.save(project, defects);
  // 실행결과(result/issueSummary/remark) 필드 갱신입니다 — AGENTS.md 5-1항이 구분하는 대로
  // "TC 정의 변경"이 아니라 "TC 실행결과 갱신"이라 legacy 아카이브/meta.version 증가 대상이
  // 아닙니다(정의 자체는 그대로, 실행결과만 매 실행마다 갱신).
  fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + '\n', 'utf8');

  // 5-1항: 실행결과 갱신 직후 그 시점 스냅샷을 TC/results/에 보관 (같은 날 재실행 시 덮어씀)
  const resultsDir = path.join(dir, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const dateStr = today.replace(/-/g, '');
  fs.writeFileSync(
    path.join(resultsDir, `${project}_TC_${moduleCode}_Result_${dateStr}.json`),
    JSON.stringify(canonical, null, 2) + '\n',
    'utf8'
  );

  return summary;
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * TC/results/index.html(전체 실행 이력 목록)을 갱신합니다 — AGENTS.md 5-1항 스펙(표 컬럼,
 * 모듈별 최신 스냅샷 기준 합계 카드, 전체 TC 뷰어 링크)을 그대로 따르는 단순 표라 결정론적으로
 * 생성 가능합니다 (다크테마 토글·모달 등이 있는 TC 뷰어 본체와 달리 재생성 위험이 적음).
 */
function writeResultsIndex(project) {
  const dir = tcDir(project);
  const snapshots = resultsStore.listSnapshots(project);
  const s = resultsStore.latestSummary(project);
  const fullViewer = tcStore.findFullViewer(project);

  const rows = snapshots
    .map(
      (r) => `<tr>
<td>${r.dateFmt}</td><td>${escHtml(r.moduleCode)}</td><td>${r.total}</td><td>${r.executed}</td>
<td>${r.pass}</td><td>${r.fail}</td><td>${r.na}</td><td>${r.nt}</td><td>${r.none}</td>
<td>${r.execRate}%</td><td>${r.passRate}%</td><td>${r.failRate}%</td>
<td><a href="${escHtml(project)}_TC_${escHtml(r.moduleCode)}_Result_${r.dateStr}.json">JSON</a></td>
</tr>`
    )
    .join('\n');

  const fullLinkHtml = fullViewer
    ? `<div class="full-link"><a href="../${escHtml(fullViewer)}">전체 TC 뷰어${fullViewer.includes('_전체') ? '' : ` (${escHtml(project)})`}</a></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ko" data-theme="light">
<head>
<meta charset="UTF-8">
<title>${escHtml(project)} 테스트 실행 이력</title>
<style>
  :root{ --bg:#f6f8fa; --panel:#fff; --text:#1f2328; --muted:#656d76; --border:#d0d7de; --accent:#0969da; }
  html[data-theme="dark"]{ --bg:#0d1117; --panel:#161b22; --text:#e6edf3; --muted:#8b949e; --border:#30363d; --accent:#58a6ff; }
  body{font-family:"Pretendard",sans-serif;background:var(--bg);color:var(--text);margin:0;padding:24px;}
  h1{font-size:18px;}
  .kpis{display:flex;gap:12px;margin:16px 0;flex-wrap:wrap;}
  .kpi{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 16px;min-width:100px;}
  .kpi .num{font-size:20px;font-weight:700;} .kpi .label{font-size:12px;color:var(--muted);}
  table{width:100%;border-collapse:collapse;font-size:13px;background:var(--panel);}
  th,td{border:1px solid var(--border);padding:8px 10px;text-align:center;}
  th{background:var(--bg);}
  a{color:var(--accent);}
  .full-link{margin:16px 0;}
</style>
</head>
<body>
<h1>${escHtml(project)} 테스트 실행 이력</h1>
${fullLinkHtml}
<div class="kpis">
  <div class="kpi"><div class="num">${s.total}</div><div class="label">전체</div></div>
  <div class="kpi"><div class="num">${s.executed}</div><div class="label">수행</div></div>
  <div class="kpi"><div class="num">${s.pass}</div><div class="label">Pass</div></div>
  <div class="kpi"><div class="num">${s.fail}</div><div class="label">Fail</div></div>
  <div class="kpi"><div class="num">${s.nt}</div><div class="label">N/T</div></div>
  <div class="kpi"><div class="num">${s.na}</div><div class="label">N/A</div></div>
</div>
<table>
<thead><tr><th>실행일</th><th>모듈</th><th>전체</th><th>수행</th><th>Pass</th><th>Fail</th><th>N/A</th><th>N/T</th><th>미실행</th><th>수행율</th><th>Pass율</th><th>실패율</th><th>보기</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;

  fs.writeFileSync(path.join(dir, 'results', 'index.html'), html, 'utf8');
}

module.exports = { applyModuleResults, writeResultsIndex };
