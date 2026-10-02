// 테스트 실행 큐의 결과를 TC 캐노니컬 JSON / defects.json / results 스냅샷에 반영하는 순수 로직
// (Claude 미사용, 토큰 소모 없음). defect-management 스킬(20-2/20-3항)의 레코드 스키마·중복판정
// 규칙을 코드로 그대로 옮긴 것입니다.
//
// ⚠️ 의도적으로 하지 않는 것: TC 모듈 HTML 뷰어(다크테마·모달·CSV/JSON 내보내기·결함현황 탭을 갖춘
// AGENTS.md 14항 스펙의 편집 가능한 뷰어)는 재생성하지 않습니다 — 매번 새로 충족해야 하는 생성형
// 산출물이라 고정 템플릿으로 흉내 내면 기존 뷰어와 품질이 어긋날 위험이 큽니다. 대신 이 파일은 JSON
// 데이터(소스 오브 트루스)와, 데이터만으로 충분히 만들 수 있는 단순 읽기 전용 표 2종
// (results/index.html, results/{...}_Result_{날짜}.html)까지 갱신합니다 — 후자가 없으면 대시보드
// "실행 이력" 목록의 "열기" 링크가 404가 되는 문제가 실사용 중 발견되어 추가(2026-09-29). 최신
// 데이터를 반영한 "편집 가능한" 뷰어 재생성은 여전히 채팅(큐돌이)에 요청해야 합니다.
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

/** "콘솔 에러:"/"실패 요청:" 같은 라벨 줄은 건너뛰고, 실제 내용이 담긴 첫 줄을 고릅니다
 * (라벨 줄만 뽑히면 "상품상세 > 콘솔 에러:"처럼 정보가 없는 요약이 되는 문제 방지 — 실측 발견). */
function firstMeaningfulLine(actualResult) {
  const lines = actualResult.split('\n').map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => !l.endsWith(':')) || lines[0] || '';
  return line.slice(0, 70);
}

function buildSummaryText(screenName, actualResult) {
  const oneLine = firstMeaningfulLine(actualResult);
  return screenName ? `${screenName} > ${oneLine}` : oneLine;
}

// [추가 2026-10-02] 같은 원인으로 여러 TC가 실패하면 결함은 1건으로 두고 관련 TC만 늘립니다(사용자 확정).
// `tcId`는 대표 TC(최초 발견)로 그대로 두고, `tcIds`(관련 TC 전체)를 신설했습니다 — `tcIds`가 없는 기존
// 레코드는 [tcId]로 간주하므로 하위 호환됩니다. 같은 원인 판정 = screenName + summary(원인 요약)가 같고
// 아직 '완료'되지 않은 결함.
function relatedTcIds(d) {
  const ids = Array.isArray(d.tcIds) && d.tcIds.length ? d.tcIds : [d.tcId];
  return ids.filter(Boolean);
}

// 심각도 비교용 순위(P1/Critical > P2/Major > P3/Minor). 관련 TC가 늘면 가장 높은 값을 따릅니다.
const SEVERITY_RANK = { P1: 3, Critical: 3, P2: 2, Major: 2, P3: 1, Minor: 1 };

/** 증거 파일을 덮어쓰기 전, 기존 파일과 내용이 다르면 defects/_prev/ 로 보관합니다(AGENTS.md 10-2항). */
function writeEvidence(defectsDir, defectId, ext, buf, overwrite, today) {
  const target = path.join(defectsDir, `${defectId}.${ext}`);
  if (fs.existsSync(target)) {
    if (!overwrite) return true; // 통합(관련 TC 추가) 경로는 기존 증거를 유지(파일은 있으므로 레코드 필드만 연결)
    const prev = fs.readFileSync(target);
    if (prev.equals(buf)) return true;
    const prevDir = path.join(defectsDir, '_prev');
    fs.mkdirSync(prevDir, { recursive: true });
    fs.copyFileSync(target, path.join(prevDir, `${defectId}.${today.replace(/-/g, '')}-${Date.now()}.${ext}`));
  }
  fs.writeFileSync(target, buf);
  return true;
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
 *            passedWithOpenDefect:string[], linkedToExisting:{defectId:string,tcId:string}[]}}
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
    linkedToExisting: [], // 같은 원인의 기존 결함에 관련 TC로 연결된 건 [{defectId, tcId}]
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
      const openDefect = defects.find((d) => relatedTcIds(d).includes(flat.tcId) && d.status !== '완료');
      if (openDefect && !summary.passedWithOpenDefect.includes(openDefect.defectId)) summary.passedWithOpenDefect.push(openDefect.defectId);
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

    const openRecord = defects.find((d) => relatedTcIds(d).includes(flat.tcId) && d.status !== '완료');
    const closedRecord = !openRecord && defects.find((d) => relatedTcIds(d).includes(flat.tcId) && d.status === '완료');
    // 이 TC로는 아직 결함이 없지만, 같은 원인(화면명 + 원인 요약)의 미완료 결함이 있으면 새로 만들지 않고 TC만 연결
    const sameCauseRecord = !openRecord && !closedRecord &&
      defects.find((d) => d.status !== '완료' && (d.screenName || '') === screenName && d.summary === summaryText);

    // 통합(관련 TC 추가) 경로는 기존 증거를 유지하고, 그 외(신규/재실패/재발생)는 최신 증거로 갱신(이전 증거는 _prev/ 보관)
    let record;
    let overwriteEvidence = true;
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
    } else if (sameCauseRecord) {
      record = sameCauseRecord;
      overwriteEvidence = false;
      record.tcIds = [...relatedTcIds(record), flat.tcId];
      if ((SEVERITY_RANK[item.priority] || 0) > (SEVERITY_RANK[record.severity] || 0)) record.severity = item.priority;
      record.history = record.history || [];
      record.history.push({ at: today, status: record.status, note: `동일 원인으로 관련 TC 추가: ${flat.tcId} (자동 통합)` });
      summary.linkedToExisting.push({ defectId: record.defectId, tcId: flat.tcId });
    } else {
      const defectId = nextDefectId(project, defects);
      record = {
        defectId,
        tcId: flat.tcId,
        tcIds: [flat.tcId],
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

    // 증거 파일 저장 + 레코드의 screenshot/consoleLog 필드 동기화(재실패/통합으로 처음 생긴 증거도 레코드에 연결)
    if (screenshotBuf && writeEvidence(defectsDir, record.defectId, 'png', screenshotBuf, overwriteEvidence, today)) {
      record.screenshot = `TC/defects/${record.defectId}.png`;
    }
    if (consoleBuf && writeEvidence(defectsDir, record.defectId, 'console.json', consoleBuf, overwriteEvidence, today)) {
      record.consoleLog = `TC/defects/${record.defectId}.console.json`;
    }

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
  // 대시보드 "실행 이력" 목록이 항상 같은 이름의 .html로 "열기" 링크를 거는데(resultsStore.js의
  // htmlFile 규칙), 이 zero-token 경로는 그 .html을 만들지 않아 링크가 404로 죽는 문제가 실사용
  // 중 발견됨(2026-09-29) — 다크테마·모달 등을 갖춘 완전한 TC 뷰어까지는 아니어도, 최소한 그 날짜
  // 스냅샷을 읽을 수 있는 단순 표 페이지는 함께 생성합니다.
  fs.writeFileSync(
    path.join(resultsDir, `${project}_TC_${moduleCode}_Result_${dateStr}.html`),
    renderSnapshotHtml(project, moduleCode, canonical, dateStr),
    'utf8'
  );

  return summary;
}

/** results/index.html의 "열기" 링크가 가리키는, 그 날짜 스냅샷의 단순 읽기 전용 표 페이지. */
function renderSnapshotHtml(project, moduleCode, canonical, dateStr) {
  const items = canonical.items || [];
  const dateFmt = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  const counts = { Pass: 0, Fail: 0, 'N/A': 0, 'N/T': 0, none: 0 };
  items.forEach((i) => { counts[i.result || 'none'] = (counts[i.result || 'none'] || 0) + 1; });

  const rows = items
    .map(
      (t) => `<tr>
<td>${t.displayNo}</td><td>${escHtml(t.tcId)}</td><td>${escHtml(t.majorCategory)}</td><td>${escHtml(t.midCategory)}</td>
<td>${escHtml(t.screenName || '')}</td><td><span class="badge ${escHtml(t.priority)}">${escHtml(t.priority)}</span></td>
<td>${escHtml(t.item)}</td><td class="res-${escHtml(t.result || 'none')}">${escHtml(t.result || '미실행')}</td>
<td>${escHtml(t.issueSummary || '')}</td><td>${escHtml(t.remark || '')}</td>
</tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtml(project)} ${escHtml(canonical.meta.moduleName || moduleCode)} 실행결과 스냅샷 (${dateFmt})</title>
<style>
  :root{ --bg:#f6f8fa; --panel:#fff; --text:#1f2328; --muted:#656d76; --border:#d0d7de; --accent:#0969da;
    --p1:#cf222e; --p2:#9a6700; --p3:#0969da; --pass:#1a7f37; --fail:#cf222e; }
  body{font-family:"Pretendard",sans-serif;background:var(--bg);color:var(--text);margin:0;padding:24px;}
  h1{font-size:17px;} .sub{font-size:12.5px;color:var(--muted);margin-bottom:16px;}
  .kpis{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap;}
  .kpi{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 14px;min-width:80px;}
  .kpi .num{font-size:18px;font-weight:700;} .kpi .label{font-size:11.5px;color:var(--muted);}
  table{width:100%;border-collapse:collapse;font-size:12.5px;background:var(--panel);}
  th,td{border:1px solid var(--border);padding:6px 8px;text-align:left;vertical-align:top;}
  th{background:var(--bg);text-align:center;}
  .badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;color:#fff;}
  .badge.P1{background:var(--p1);} .badge.P2{background:var(--p2);} .badge.P3{background:var(--p3);}
  .res-Pass{color:var(--pass);font-weight:700;} .res-Fail{color:var(--fail);font-weight:700;}
  a{color:var(--accent);}
  .links{margin:10px 0 18px;font-size:12.5px;}
</style>
</head>
<body>
<h1>${escHtml(project)} · ${escHtml(canonical.meta.moduleName || moduleCode)}(${escHtml(moduleCode)}) 실행결과 스냅샷</h1>
<div class="sub">실행일 ${dateFmt} · 이 페이지는 그 시점의 읽기 전용 스냅샷입니다(수정 불가) — 최신 편집 가능한 뷰어는 아래 링크를 이용하세요.</div>
<div class="links">
  <a href="index.html">← 실행 이력 목록</a> ·
  <a href="../${escHtml(project)}_TC_${escHtml(moduleCode)}.html">최신 TC 뷰어(${escHtml(moduleCode)})</a>
</div>
<div class="kpis">
  <div class="kpi"><div class="num">${items.length}</div><div class="label">전체</div></div>
  <div class="kpi"><div class="num">${counts.Pass}</div><div class="label">Pass</div></div>
  <div class="kpi"><div class="num">${counts.Fail}</div><div class="label">Fail</div></div>
  <div class="kpi"><div class="num">${counts['N/A']}</div><div class="label">N/A</div></div>
  <div class="kpi"><div class="num">${counts['N/T']}</div><div class="label">N/T</div></div>
  <div class="kpi"><div class="num">${counts.none}</div><div class="label">미실행</div></div>
</div>
<table>
<thead><tr><th>No.</th><th>TC ID</th><th>대분류</th><th>중분류</th><th>화면명</th><th>우선순위</th><th>테스트항목</th><th>실행결과</th><th>이슈내용</th><th>비고</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
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
<td><a href="${escHtml(project)}_TC_${escHtml(r.moduleCode)}_Result_${r.dateStr}.html">보기</a></td>
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

module.exports = { applyModuleResults, writeResultsIndex, renderSnapshotHtml };
