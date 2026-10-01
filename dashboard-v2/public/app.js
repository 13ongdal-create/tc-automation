const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

const el = {
  projectSelect: document.getElementById('projectSelect'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnLogout: document.getElementById('btnLogout'),
  btnHome: document.getElementById('btnHome'),
  homeView: document.getElementById('homeView'),
  projectView: document.getElementById('projectView'),
  projectDetailTitle: document.getElementById('projectDetailTitle'),
  homeEmpty: document.getElementById('homeEmpty'),
  homeDashboard: document.getElementById('homeDashboard'),
  homeKpiProjects: document.getElementById('homeKpiProjects'),
  homeKpiDefects: document.getElementById('homeKpiDefects'),
  homeKpiNew: document.getElementById('homeKpiNew'),
  homeKpiPass: document.getElementById('homeKpiPass'),
  homeKpiFail: document.getElementById('homeKpiFail'),
  homeKpiExecRate: document.getElementById('homeKpiExecRate'),
  projectBlocks: document.getElementById('projectBlocks'),
  btnNewProject: document.getElementById('btnNewProject'),
  btnNewProjectEmpty: document.getElementById('btnNewProjectEmpty'),
  newProjectModal: document.getElementById('newProjectModal'),
  newProjectForm: document.getElementById('newProjectForm'),
  newProjectName: document.getElementById('newProjectName'),
  newProjectError: document.getElementById('newProjectError'),
  btnCancelNewProject: document.getElementById('btnCancelNewProject'),
  manageProjectModal: document.getElementById('manageProjectModal'),
  manageProjectName: document.getElementById('manageProjectName'),
  manageProjectForm: document.getElementById('manageProjectForm'),
  btnManageProjectDetail: document.getElementById('btnManageProjectDetail'),
  manageProjectError: document.getElementById('manageProjectError'),
  btnCancelManageProject: document.getElementById('btnCancelManageProject'),
  mpUrl: document.getElementById('mpUrl'),
  mpAdminUrl: document.getElementById('mpAdminUrl'),
  mpTestType: document.getElementById('mpTestType'),
  mpAnalysisBasis: document.getElementById('mpAnalysisBasis'),
  mpHasTestAccounts: document.getElementById('mpHasTestAccounts'),
  mpDeleteConfirmName: document.getElementById('mpDeleteConfirmName'),
  mpDisplayName: document.getElementById('mpDisplayName'),
  mpRealName: document.getElementById('mpRealName'),
  mpDeleteConfirm: document.getElementById('mpDeleteConfirm'),
  mpDeleteError: document.getElementById('mpDeleteError'),
  btnDeleteProject: document.getElementById('btnDeleteProject'),
  btnTcUpload: document.getElementById('btnTcUpload'),
  tcUploadModal: document.getElementById('tcUploadModal'),
  tcUploadFile: document.getElementById('tcUploadFile'),
  tcUploadError: document.getElementById('tcUploadError'),
  tcUploadResult: document.getElementById('tcUploadResult'),
  btnCancelTcUpload: document.getElementById('btnCancelTcUpload'),
  btnTcUploadSubmit: document.getElementById('btnTcUploadSubmit'),
  btnGitStatus: document.getElementById('btnGitStatus'),
  gitStatusModal: document.getElementById('gitStatusModal'),
  gitStatusBody: document.getElementById('gitStatusBody'),
  gitStatusError: document.getElementById('gitStatusError'),
  btnCloseGitStatus: document.getElementById('btnCloseGitStatus'),
  btnGitPush: document.getElementById('btnGitPush'),
  tqStatus: document.getElementById('tqStatus'),
  tqModule: document.getElementById('tqModule'),
  tqSystem: document.getElementById('tqSystem'),
  tqPriority: document.getElementById('tqPriority'),
  tqStatusFilter: document.getElementById('tqStatusFilter'),
  tqHeaded: document.getElementById('tqHeaded'),
  btnTqReplay: document.getElementById('btnTqReplay'),
  replayModal: document.getElementById('replayModal'),
  replayList: document.getElementById('replayList'),
  btnCloseReplay: document.getElementById('btnCloseReplay'),
  replayStatusPills: document.getElementById('replayStatusPills'),
  replayTcSearch: document.getElementById('replayTcSearch'),
  tqPreview: document.getElementById('tqPreview'),
  btnTqStart: document.getElementById('btnTqStart'),
  btnTqCancel: document.getElementById('btnTqCancel'),
  tqModuleQueue: document.getElementById('tqModuleQueue'),
  tqLog: document.getElementById('tqLog'),
  chatStatus: document.getElementById('chatStatus'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  btnChatSend: document.getElementById('btnChatSend'),
  btnChatCancel: document.getElementById('btnChatCancel'),
  btnChatReset: document.getElementById('btnChatReset'),
  btnChatAttach: document.getElementById('btnChatAttach'),
  chatAttachInput: document.getElementById('chatAttachInput'),
  chatAttachList: document.getElementById('chatAttachList'),
};

let allProjects = [];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 프로젝트 표시 이름(4001 전용) — 실제 이름(폴더명)은 API/URL/삭제 확인 등 내부 식별자로만 쓰고,
// 화면에 보이는 이름은 dispName()으로 가져옵니다.
let projectNames = {};
const dispName = (p) => projectNames[p] || p;

async function loadProjects() {
  const res = await fetch('/api/projects');
  const { projects, displayNames } = await res.json();
  allProjects = projects;
  projectNames = displayNames || {};
  // 플레이스홀더를 항상 기본 선택값으로 둡니다 — 홈이 최초 진입 화면이므로 select도
  // 특정 프로젝트가 "선택된" 상태로 보이면 안 됩니다 (프로젝트를 고르기 전까지는 미선택 상태 유지).
  el.projectSelect.innerHTML =
    '<option value="" disabled selected>프로젝트 선택</option>' +
    projects.map((p) => `<option value="${esc(p)}">${esc(dispName(p))}</option>`).join('');
}

async function loadAll() {
  const project = el.projectSelect.value;
  if (!project) return;
  // 프로젝트 상세 화면 렌더링은 project-detail.js(v2 신규 디자인)가 담당합니다.
  await Promise.all([loadProjectDetail(project), loadChatHistory(project), loadTestQueueModules(project)]);
}

// ── 🏠 홈 (프로젝트 카드) ↔ 📁 프로젝트 상세 화면 전환 ─────────────────────
// 브라우저 History API로 실제 내비게이션 상태를 관리합니다. 이게 없으면 화면 전환이
// 전부 순수 JS 토글이라 브라우저 기록에 남는 건 로그인 리다이렉트뿐이라, 프로젝트 상세에서
// 뒤로가기를 누르면 로그인 화면으로 튀어버렸습니다(2026-08-26 사용자 리포트) — render*View는
// 화면만 그리고(기록 변경 없음), show*는 그리기 + pushState, popstate 핸들러는 그리기만 호출.
function renderHomeView() {
  el.projectSelect.value = '';
  el.projectView.style.display = 'none';
  el.homeView.style.display = 'block';
  renderHomeDashboard();
}

function renderProjectView(project) {
  if (!project) return renderHomeView();
  el.projectSelect.value = project;
  el.projectDetailTitle.textContent = dispName(project); // 데이터 로딩 전에 즉시 표시 — 우측 select만으로는 어느 프로젝트인지 헷갈리기 쉬움
  el.homeView.style.display = 'none';
  el.projectView.style.display = 'block';
  loadAll();
}

function showHome() {
  renderHomeView();
  history.pushState({ view: 'home' }, '', '/');
}

function showProject(project) {
  if (!project) return showHome();
  renderProjectView(project);
  history.pushState({ view: 'project', project }, '', '/');
}

window.addEventListener('popstate', (e) => {
  const state = e.state;
  if (state && state.view === 'project' && state.project) renderProjectView(state.project);
  else renderHomeView();
});

// 공통 코드 규칙(2026-10-01): TC 중요도와 결함 심각도는 서로 다른 코드를 씁니다 — 같은 P1/P2/P3 문자열을
// 두 개념이 공유하면 혼선이 생겨 분리. 색도 서로 다른 계열로 구분합니다(TC=남색 계열, 결함=상태색).
// TC 중요도: P1 핵심 / P2 주요 / P3 일반 — 서비스 핵심 플로우 여부, 테스트 우선순위
const TC_PRIORITY_ORDER = ['P1', 'P2', 'P3'];
const TC_PRIORITY_LABELS = { P1: 'P1 (핵심)', P2: 'P2 (주요)', P3: 'P3 (일반)' };
const TC_PRIORITY_COLORS = { P1: '#4338ca', P2: '#6366f1', P3: '#a5b4fc' };
// 결함 심각도: Critical 치명 / Major 주요 / Minor 경미 — 결함의 영향도. defects.json에도 이 값으로 저장됨
const SEVERITY_ORDER = ['Critical', 'Major', 'Minor'];
const SEVERITY_LABELS = { Critical: 'Critical (치명)', Major: 'Major (주요)', Minor: 'Minor (경미)' };
const SEVERITY_COLORS = { Critical: 'var(--bad)', Major: 'var(--warn)', Minor: 'var(--primary)' };
// 과거 P1/P2/P3로 저장된 결함 값을 새 코드로 정규화(읽기 시)
const LEGACY_SEVERITY = { P1: 'Critical', P2: 'Major', P3: 'Minor' };
const normSeverity = (v) => LEGACY_SEVERITY[v] || v;

// TC 실행결과(AGENTS.md 20-7항: Pass/Fail/N/A/N/T — Blocked는 2026-08-27부로 N/A에 통합) 색상.
// "수행율"은 (전체-미실행)/전체 기준이며(실행이력 표와 동일 정의), Pass+Fail만이 아니라
// N/A/N/T도 "수행됨"에 포함된다 (이전에는 Pass+Fail만 반영해 N/T가 많은 프로젝트에서 수행율이
// 왜곡 표시됨 — 2026-08-27 수정).
const RESULT_ORDER = ['pass', 'fail', 'na', 'nt', 'none'];
const RESULT_LABELS = { pass: 'Pass', fail: 'Fail', na: 'N/A', nt: 'N/T', none: '미실행' };
const RESULT_COLORS = {
  pass: 'var(--good)', fail: 'var(--bad)',
  na: 'var(--accent3)', nt: 'var(--accent2)', none: 'var(--divider)',
};
// 실행결과 값 정의 — 도넛 카드의 ⓘ 정보 아이콘에 그대로 노출 (AGENTS.md 10/20-7항과 동일 문구)
const RESULT_DEFINITIONS = [
  ['Pass', '절차대로 수행한 결과가 기대결과와 일치함'],
  ['Fail', '절차대로 수행한 결과가 기대결과와 다름(결함으로 이어짐). 단, 이미 등록된 결함 자체를 재현/확인하는 것이 목적인 TC는 결함이 해결되기 전까지 의도된 Fail을 유지'],
  ['N/A', '① 현재 조건에서 이 TC가 적용 대상이 아니거나 검증하려는 상태를 재현할 수 없어 판정이 무의미한 경우, ② 선행 조건·환경이 준비되지 않아 TC를 아예 수행할 수 없는 경우(과거 Blocked) — 2026-08-27부로 통합'],
  ['N/T', 'TC 자체는 수행 가능하지만 이미 등록된 다른 결함 때문에 깨끗한 Pass/Fail 판정이 불가능한 경우(AGENTS.md 20-7항) — 그 결함이 해결되면 재실행해 실제 Pass/Fail로 갱신'],
  ['미실행', '아직 한 번도 실행되지 않음(드롭다운에 값이 입력되지 않은 상태)'],
];
function resultDefinitionsTooltip() {
  return RESULT_DEFINITIONS.map(([k, v]) => `${k}: ${v}`).join('\n');
}

// 결함 상태(AGENTS.md 20-2항) 색상
const STATUS_COLORS = {
  '신규': 'var(--warn)',
  '처리중': 'var(--primary)',
  '재검증대기': 'var(--accent2)',
  '완료': 'var(--good)',
  '보류': 'var(--text-secondary)',
  '재발생': 'var(--bad)',
};

/** 도넛 아래에 붙는 요약 표 — 색상 범례 + 정확한 건수/비율을 함께 보여줌 */
function donutSummaryTable(order, labels, colors, counts) {
  const total = order.reduce((s, k) => s + (counts[k] || 0), 0);
  const rows = order
    .map((k) => {
      const n = counts[k] || 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      return `
      <tr>
        <td class="ds-label"><span class="legend-swatch" style="background:${colors[k]}"></span>${esc(labels[k])}</td>
        <td class="ds-count">${n}</td>
        <td class="ds-pct">${pct}%</td>
      </tr>`;
    })
    .join('');
  return `<table class="donut-summary-table"><tbody>${rows}</tbody></table>`;
}

/** mask 기반 누적 도넛 차트 — centerHtml을 가운데에 겹쳐 표시 */
function donutChart(segments, centerHtml, emptyLabel) {
  const total = segments.reduce((s, seg) => s + seg.n, 0);
  if (!total) {
    return `<div class="donut-wrap"><div class="donut donut-empty"></div><div class="donut-center"><span class="donut-empty-label">${esc(emptyLabel)}</span></div></div>`;
  }
  let cursor = 0;
  const stops = segments
    .filter((s) => s.n > 0)
    .map((s) => {
      const from = cursor;
      cursor += (s.n / total) * 100;
      return `${s.color} ${from}% ${cursor}%`;
    })
    .join(', ');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})"></div><div class="donut-center">${centerHtml}</div></div>`;
}

/**
 * 수행현황 ① — "전체 TC 수행률 현황" 카드. 실행이력 표(모듈별 TC 수행현황/results 스냅샷)와
 * 동일하게 수행율=(전체-미실행)/전체로 정의하고, Pass/Fail뿐 아니라 Blocked/N/A/N/T도 도넛에
 * 실제 비중대로 표시한다 (2026-08-27 수정 — 이전에는 Pass+Fail만 반영해 N/T 비중이 큰
 * 프로젝트에서 수행율이 100%인데도 완료율이 낮게 표시되는 오해를 유발했음).
 */
function renderExecCompletionCard(kpi) {
  const r = kpi ? kpi.results : null;
  if (!r || !r.total) {
    return `
      <div class="pb-chart-head"><span class="pb-chart-title">전체 TC 수행률 현황</span></div>
      <div class="pb-chart-body">${donutChart([], '', '실행 이력 없음')}</div>`;
  }
  const execRate = Math.round(((r.total - r.none) / r.total) * 100);
  const counts = { pass: r.pass, fail: r.fail, na: r.na, nt: r.nt, none: r.none };
  const segments = RESULT_ORDER.map((k) => ({ n: counts[k] || 0, color: RESULT_COLORS[k] }));
  const centerHtml = `<span class="donut-total">${execRate}%</span><span class="donut-total-label">수행율</span>`;
  return `
    <div class="pb-chart-head">
      <span class="pb-chart-title">전체 TC 수행률 현황</span>
      <span class="result-def-info" tabindex="0" title="${esc(resultDefinitionsTooltip())}">ⓘ</span>
    </div>
    <div class="pb-chart-body">${donutChart(segments, centerHtml, '실행 이력 없음')}</div>
    ${donutSummaryTable(RESULT_ORDER, RESULT_LABELS, RESULT_COLORS, counts)}`;
}

/** 수행현황 ② — 전체 TC를 중요도(P1/P2/P3)별로 집계한 도넛 */
function renderPriorityDonut(kpi) {
  const r = kpi ? kpi.results : null;
  if (!r || !r.total) return donutChart([], '', '실행 이력 없음');
  const segments = TC_PRIORITY_ORDER.map((k) => ({ n: r[k.toLowerCase()] || 0, color: TC_PRIORITY_COLORS[k] }));
  const centerHtml = `<span class="donut-total">${r.total}</span><span class="donut-total-label">전체 TC</span>`;
  return donutChart(segments, centerHtml, '실행 이력 없음');
}

/** 수행현황 ③ — 날짜별 진척율(수행율) 추이를 선/영역 그래프로 표시 (순수 SVG, 라이브러리 없음) */
function renderTrendChart(timeline) {
  if (!timeline || !timeline.length) return '<div class="trend-empty">실행 이력이 없습니다</div>';
  const n = timeline.length;
  if (n === 1) {
    // 점 1개짜리 "추이"는 좌우 라벨(space-between)로 표시하면 가운데 찍힌 점과 위치가
    // 어긋나 보이므로, 점과 라벨을 함께 가운데 정렬한 전용 레이아웃으로 표시합니다.
    const t = timeline[0];
    return `<div class="trend-single"><span class="trend-single-dot"></span><span class="trend-single-label">${esc(t.dateFmt)} · ${t.execRate}%</span></div>`;
  }
  const W = 280, H = 100, PAD = 10;
  const points = timeline.map((t, i) => ({
    x: PAD + (i / (n - 1)) * (W - PAD * 2),
    y: PAD + (1 - t.execRate / 100) * (H - PAD * 2),
    ...t,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const areaD = `${pathD} L ${last.x.toFixed(1)} ${H - PAD} L ${points[0].x.toFixed(1)} ${H - PAD} Z`;
  const dots = points
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" class="trend-dot"><title>${esc(p.dateFmt)} · ${p.execRate}%</title></circle>`)
    .join('');
  return `
    <svg viewBox="0 0 ${W} ${H}" class="trend-svg" preserveAspectRatio="none">
      <line x1="${PAD}" y1="${PAD}" x2="${W - PAD}" y2="${PAD}" class="trend-grid"></line>
      <line x1="${PAD}" y1="${H / 2}" x2="${W - PAD}" y2="${H / 2}" class="trend-grid"></line>
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" class="trend-grid"></line>
      <path d="${areaD}" class="trend-area"></path>
      <path d="${pathD}" class="trend-line"></path>
      ${dots}
    </svg>
    <div class="trend-labels"><span>${esc(points[0].dateFmt)}</span><span>${esc(last.dateFmt)} · ${last.execRate}%</span></div>`;
}

/**
 * 날짜별 진척율 차트 아래에 붙는 실행 이력 표 — AGENTS.md 5-1항 results/index.html과 동일한
 * 컬럼 구성(실행일/모듈/전체/수행/Pass/Fail/N/A/N/T/미실행/수행율/Pass율/실패율/보기) —
 * Blocked는 2026-08-27부로 N/A에 통합되어 별도 컬럼 없음
 */
function renderSnapshotTable(project, snapshots) {
  if (!snapshots || !snapshots.length) return '<div class="empty-row">실행 이력이 없습니다</div>';
  const rowsHtml = snapshots
    .map(
      (s) => `
    <tr>
      <td>${esc(s.dateFmt)}</td>
      <td class="pb-module-name">${esc(s.moduleName)}</td>
      <td>${s.total}</td>
      <td>${s.executed}</td>
      <td>${s.pass}</td>
      <td>${s.fail}</td>
      <td>${s.na}</td>
      <td>${s.nt}</td>
      <td>${s.none}</td>
      <td class="pb-pct">${s.execRate}%</td>
      <td class="pb-pct">${s.passRate}%</td>
      <td class="pb-pct">${s.failRate}%</td>
      <td><a href="/project-files/${encodeURIComponent(project)}/TC/results/${encodeURIComponent(s.htmlFile)}" target="_blank" rel="noopener">열기 →</a></td>
    </tr>`
    )
    .join('');
  return `
    <table class="pb-module-table">
      <thead><tr><th>실행일</th><th>모듈</th><th>전체</th><th>수행</th><th>Pass</th><th>Fail</th><th>N/A</th><th>N/T</th><th>미실행</th><th>수행율</th><th>Pass율</th><th>실패율</th><th>보기</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

/** 수행현황 ④ — 모듈별 TC 실행결과 상세 표 */
function renderModuleExecTable(byModule) {
  if (!byModule || !byModule.length) return '<div class="empty-row">실행 이력이 없습니다</div>';
  const sorted = byModule.slice().sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
  const rowsHtml = sorted
    .map(
      (m) => `
    <tr>
      <td class="pb-module-name">${esc(m.moduleName)}</td>
      <td>${m.total}</td>
      <td>${m.executed}</td>
      <td class="pb-pct">${m.execRate}%</td>
      <td>${m.pass}</td>
      <td>${m.fail}</td>
      <td>${m.na}</td>
      <td>${m.nt}</td>
      <td class="pb-pct">${m.passRate}%</td>
      <td class="pb-pct">${m.failRate}%</td>
    </tr>`
    )
    .join('');
  return `
    <table class="pb-module-table">
      <thead><tr><th>모듈</th><th>전체</th><th>수행</th><th>수행율</th><th>Pass</th><th>Fail</th><th>N/A</th><th>N/T</th><th>Pass율</th><th>Fail율</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

/** 결함현황 ① — 전체 결함을 심각도(Critical/Major/Minor)별로 집계한 도넛 */
function renderSeverityDonut(kpi) {
  const d = kpi ? kpi.defects : null;
  if (!d || !d.total) return donutChart([], '', '등록된 결함 없음');
  const segments = SEVERITY_ORDER.map((s) => ({ n: (d.severityCounts && d.severityCounts[s]) || 0, color: SEVERITY_COLORS[s] }));
  const centerHtml = `<span class="donut-total">${d.total}</span><span class="donut-total-label">전체 결함</span>`;
  return donutChart(segments, centerHtml, '등록된 결함 없음');
}

/** 결함현황 ② — 전체 결함을 상태(신규/처리중/재검증대기/완료/보류/재발생)별로 집계한 도넛 */
function renderDefectStatusDonut(kpi) {
  const d = kpi ? kpi.defects : null;
  if (!d || !d.total) return donutChart([], '', '등록된 결함 없음');
  const segments = STATUS_ORDER.map((s) => ({ n: (d.counts && d.counts[s]) || 0, color: STATUS_COLORS[s] }));
  const centerHtml = `<span class="donut-total">${d.total}</span><span class="donut-total-label">전체 결함</span>`;
  return donutChart(segments, centerHtml, '등록된 결함 없음');
}

/** 결함현황 ③ — 모듈별 결함 상세 현황 표 */
function renderModuleDefectTable(byModule) {
  if (!byModule || !byModule.length) return '<div class="empty-row">등록된 결함이 없습니다</div>';
  const rowsHtml = byModule
    .map(
      (m) => `
    <tr>
      <td class="pb-module-name">${esc(m.module)}</td>
      <td>${m.total}</td>
      <td>${m.Critical ?? m.P1 ?? 0}</td>
      <td>${m.Major ?? m.P2 ?? 0}</td>
      <td>${m.Minor ?? m.P3 ?? 0}</td>
      <td>${m.신규 || 0}</td>
      <td>${m.처리중 || 0}</td>
      <td>${m.완료 || 0}</td>
    </tr>`
    )
    .join('');
  return `
    <table class="pb-module-table">
      <thead><tr><th>모듈</th><th>전체</th><th>Critical</th><th>Major</th><th>Minor</th><th>신규</th><th>처리중</th><th>완료</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

async function renderHomeDashboard() {
  if (!allProjects.length) {
    el.homeEmpty.hidden = false;
    el.homeDashboard.hidden = true;
    return;
  }
  el.homeEmpty.hidden = true;
  el.homeDashboard.hidden = false;

  const [kpis, snapshotLists] = await Promise.all([
    Promise.all(
      allProjects.map((p) =>
        fetch(`/api/${encodeURIComponent(p)}/kpi`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ),
    Promise.all(
      allProjects.map((p) =>
        fetch(`/api/${encodeURIComponent(p)}/results`)
          .then((r) => (r.ok ? r.json() : { snapshots: [] }))
          .then((d) => d.snapshots || [])
          .catch(() => [])
      )
    ),
  ]);
  const rows = allProjects.map((p, i) => ({ project: p, kpi: kpis[i], snapshots: snapshotLists[i] }));

  let totalDefects = 0, totalNew = 0, totalPass = 0, totalFail = 0, totalExecuted = 0, totalTcs = 0;
  rows.forEach(({ kpi }) => {
    if (!kpi) return;
    totalDefects += kpi.defects.total;
    totalNew += kpi.defects.counts['신규'] || 0;
    totalPass += kpi.results.pass;
    totalFail += kpi.results.fail;
    totalExecuted += kpi.results.executed;
    totalTcs += kpi.results.total;
  });

  el.homeKpiProjects.textContent = allProjects.length;
  el.homeKpiDefects.textContent = totalDefects;
  el.homeKpiNew.textContent = totalNew;
  el.homeKpiPass.textContent = totalPass;
  el.homeKpiFail.textContent = totalFail;
  el.homeKpiExecRate.textContent = totalTcs ? Math.round((totalExecuted / totalTcs) * 100) + '%' : '–';

  renderProjectBlocks(rows);
}

/** 프로젝트 하나당 블록 1개 — 수행현황(도넛 2개+추이+표), 결함현황(도넛 2개+표)을 섹션으로 나눠 표시.
 * 각 도넛 아래에는 정확한 건수/비율을 보여주는 요약 표를 함께 붙인다. */
function renderProjectBlocks(rows) {
  el.projectBlocks.innerHTML = rows
    .map(({ project, kpi, snapshots }) => {
      const r = kpi ? kpi.results : null;
      const d = kpi ? kpi.defects : null;
      const priorityCounts = r ? { P1: r.p1 || 0, P2: r.p2 || 0, P3: r.p3 || 0 } : {};
      const severityCounts = d ? d.severityCounts || {} : {};
      const statusLabels = Object.fromEntries(STATUS_ORDER.map((s) => [s, s]));
      const statusCounts = d ? d.counts || {} : {};

      return `
      <div class="panel project-block" data-project="${esc(project)}">
        <div class="panel-head">
          <h2>${esc(dispName(project))}</h2>
          <div class="panel-head-actions">
            <button type="button" class="btn btn-outline btn-manage-project" data-project="${esc(project)}">⚙ 관리</button>
            <span class="panel-sub project-block-link">상세보기 →</span>
          </div>
        </div>

        <div class="pb-section-title">수행현황</div>
        <div class="pb-grid-3">
          <div class="pb-chart-card">
            ${renderExecCompletionCard(kpi)}
          </div>
          <div class="pb-chart-card">
            <div class="pb-chart-head"><span class="pb-chart-title">TC 중요도별 분포</span></div>
            <div class="pb-chart-body">${renderPriorityDonut(kpi)}</div>
            ${donutSummaryTable(TC_PRIORITY_ORDER, TC_PRIORITY_LABELS, TC_PRIORITY_COLORS, priorityCounts)}
          </div>
          <div class="pb-chart-card">
            <div class="pb-chart-head"><span class="pb-chart-title">날짜별 진척율</span></div>
            <div class="pb-chart-body pb-chart-body-trend">${renderTrendChart(r ? r.timeline : [])}</div>
          </div>
        </div>
        <details class="pb-chart-card pb-chart-card-wide pb-table-row pb-collapsible" open>
          <summary class="pb-chart-head"><span class="pb-chart-title">실행 이력</span></summary>
          <div class="table-wrap">${renderSnapshotTable(project, snapshots)}</div>
        </details>
        <details class="pb-chart-card pb-chart-card-wide pb-table-row pb-collapsible" open>
          <summary class="pb-chart-head"><span class="pb-chart-title">모듈별 TC 현황</span></summary>
          <div class="table-wrap">${renderModuleExecTable(r ? r.byModule : [])}</div>
        </details>

        <div class="pb-section-title">결함현황</div>
        <div class="pb-grid-2">
          <div class="pb-chart-card">
            <div class="pb-chart-head"><span class="pb-chart-title">결함 심각도별 분포</span></div>
            <div class="pb-chart-body">${renderSeverityDonut(kpi)}</div>
            ${donutSummaryTable(SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_COLORS, severityCounts)}
          </div>
          <div class="pb-chart-card">
            <div class="pb-chart-head"><span class="pb-chart-title">상태별 결함</span></div>
            <div class="pb-chart-body">${renderDefectStatusDonut(kpi)}</div>
            ${donutSummaryTable(STATUS_ORDER, statusLabels, STATUS_COLORS, statusCounts)}
          </div>
        </div>
        <details class="pb-chart-card pb-chart-card-wide pb-table-row pb-collapsible" open>
          <summary class="pb-chart-head"><span class="pb-chart-title">모듈별 결함 상세</span></summary>
          <div class="table-wrap">${renderModuleDefectTable(d ? d.byModule : [])}</div>
        </details>
      </div>`;
    })
    .join('');
}

el.projectBlocks.addEventListener('click', (e) => {
  // 표 안의 링크(열기 →)나 접기/펼치기(<summary>) 클릭은 프로젝트 상세 이동으로 이어지지 않게 제외
  if (e.target.closest('a, summary, button, input, select')) return;
  const block = e.target.closest('.project-block');
  if (block) showProject(block.dataset.project);
});

el.btnHome.addEventListener('click', showHome);

el.btnRefresh.addEventListener('click', () => {
  if (el.projectView.style.display === 'none') renderHomeDashboard();
  else loadAll();
});

el.btnLogout.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login';
});

// ── + 새 프로젝트 ────────────────────────────────────────────────────────
function openNewProjectModal() {
  el.newProjectError.textContent = '';
  el.newProjectName.value = '';
  el.newProjectModal.hidden = false;
  el.newProjectName.focus();
}

function closeNewProjectModal() {
  el.newProjectModal.hidden = true;
}

el.btnNewProject.addEventListener('click', openNewProjectModal);
el.btnNewProjectEmpty.addEventListener('click', openNewProjectModal);
el.btnCancelNewProject.addEventListener('click', closeNewProjectModal);
el.newProjectModal.addEventListener('click', (e) => {
  if (e.target === el.newProjectModal) closeNewProjectModal();
});

el.newProjectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = el.newProjectName.value.trim();
  el.newProjectError.textContent = '';
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    el.newProjectError.textContent = data.error || '생성에 실패했습니다.';
    return;
  }
  closeNewProjectModal();
  await loadProjects();
  showProject(data.project);
});

// ── ⚙ 프로젝트 관리(수정/삭제) ──────────────────────────────────────────────
let manageProjectTarget = null;
// 모달을 열 때의 사이트 정보 값 — 저장 시 이 값과 비교해, 표시 이름만 바꾼 경우에는 공유 QA 데이터(project.json)를
// 다시 쓰지 않습니다(null이면 아직 불러오지 못한 상태 → 안전하게 항상 저장).
let manageMetaOriginal = null;
const manageMetaFormValues = () => ({
  url: el.mpUrl.value,
  adminUrl: el.mpAdminUrl.value,
  testType: el.mpTestType.value,
  analysisBasis: el.mpAnalysisBasis.value,
  hasTestAccounts: el.mpHasTestAccounts.checked,
});

async function openManageProjectModal(project) {
  manageProjectTarget = project;
  manageMetaOriginal = null;
  el.manageProjectName.textContent = dispName(project);
  el.mpRealName.textContent = project;
  el.mpDisplayName.value = projectNames[project] || '';
  el.manageProjectError.textContent = '';
  el.mpDeleteError.textContent = '';
  el.mpDeleteConfirmName.textContent = project;
  el.mpDeleteConfirm.value = '';
  el.btnDeleteProject.disabled = true;
  // 폼을 비운 채로 먼저 열고, project.json을 읽어와 채웁니다 (project.json이 아직 없는
  // 프로젝트는 loadMeta가 null 필드로 응답 — 그대로 빈 값으로 둡니다).
  el.mpUrl.value = '';
  el.mpAdminUrl.value = '';
  el.mpTestType.value = '';
  el.mpAnalysisBasis.value = '';
  el.mpHasTestAccounts.checked = false;
  el.manageProjectModal.hidden = false;
  try {
    const res = await fetch(`/api/${encodeURIComponent(project)}/meta`);
    if (res.ok) {
      const meta = await res.json();
      el.mpUrl.value = meta.url || '';
      el.mpAdminUrl.value = meta.adminUrl || '';
      el.mpTestType.value = meta.testType || '';
      el.mpAnalysisBasis.value = meta.analysisBasis || '';
      el.mpHasTestAccounts.checked = !!meta.hasTestAccounts;
      manageMetaOriginal = manageMetaFormValues();
    }
  } catch {
    // 조회 실패 시 빈 폼 그대로 유지 — 저장 시 다시 실패하면 그때 에러를 보여줌
  }
}

function closeManageProjectModal() {
  el.manageProjectModal.hidden = true;
  manageProjectTarget = null;
}

el.projectBlocks.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-manage-project');
  if (!btn) return;
  openManageProjectModal(btn.dataset.project);
});

// 프로젝트 상세 페이지 "🔎 사이트 분석" 패널의 ⚙ 관리 버튼 — 홈 화면의 프로젝트 블록과 달리
// 이쪽은 el.projectBlocks 델리게이션 밖에 있는 고정 버튼이라 별도로 연결 (2026-09-28 추가,
// "상세 페이지에서는 사이트 정보를 수정할 방법이 없다"는 사용자 피드백 반영).
el.btnManageProjectDetail.addEventListener('click', () => {
  const project = el.projectSelect.value;
  if (project) openManageProjectModal(project);
});

el.btnCancelManageProject.addEventListener('click', closeManageProjectModal);
el.manageProjectModal.addEventListener('click', (e) => {
  if (e.target === el.manageProjectModal) closeManageProjectModal();
});

el.manageProjectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!manageProjectTarget) return;
  el.manageProjectError.textContent = '';
  const wantedName = el.mpDisplayName.value;
  if (wantedName.trim() !== (projectNames[manageProjectTarget] || '')) {
    const nameRes = await fetch(`/api/projects/${encodeURIComponent(manageProjectTarget)}/display-name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: wantedName }),
    });
    const nameData = await nameRes.json().catch(() => ({}));
    if (!nameRes.ok) {
      el.manageProjectError.textContent = nameData.error || '표시 이름 저장에 실패했습니다.';
      return;
    }
  }
  // 사이트 정보(URL·테스트 유형 등)는 실제로 바뀐 경우에만 project.json에 저장 — 표시 이름만 바꾼 저장이
  // 4000과 공유하는 QA 데이터를 건드리지 않도록 합니다.
  const nowValues = manageMetaFormValues();
  const metaChanged = !manageMetaOriginal || JSON.stringify(nowValues) !== JSON.stringify(manageMetaOriginal);
  if (metaChanged) {
    const res = await fetch(`/api/projects/${encodeURIComponent(manageProjectTarget)}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nowValues),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el.manageProjectError.textContent = data.error || '저장에 실패했습니다.';
      return;
    }
  }
  // [수정 2026-09-28] closeManageProjectModal()이 manageProjectTarget을 null로 지우는데, 그 뒤에
  // 이 변수로 "지금 보고 있는 프로젝트인가"를 판단하고 있어 이 조건이 항상 false가 되고 있었습니다
  // (프로젝트 상세 화면에서 저장해도 사이트 분석 패널이 갱신되지 않던 버그의 원인, 사용자 리포트로 발견) —
  // 지우기 전에 값을 먼저 붙잡아둡니다.
  const savedProject = manageProjectTarget;
  const viewing = el.projectView.style.display !== 'none' ? el.projectSelect.value : '';
  closeManageProjectModal();
  await loadProjects(); // 표시 이름 반영 — select를 다시 그리므로 보던 프로젝트 선택을 복원
  if (viewing) {
    el.projectSelect.value = viewing;
    el.projectDetailTitle.textContent = dispName(viewing);
  }
  if (viewing && viewing === savedProject) {
    loadAll();
  } else {
    renderHomeDashboard();
  }
});

el.mpDeleteConfirm.addEventListener('input', () => {
  el.btnDeleteProject.disabled = el.mpDeleteConfirm.value !== manageProjectTarget;
});

el.btnDeleteProject.addEventListener('click', async () => {
  if (!manageProjectTarget) return;
  el.mpDeleteError.textContent = '';
  const res = await fetch(`/api/projects/${encodeURIComponent(manageProjectTarget)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmName: el.mpDeleteConfirm.value }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    el.mpDeleteError.textContent = data.error || '삭제에 실패했습니다.';
    return;
  }
  const wasCurrent = el.projectSelect.value === manageProjectTarget;
  closeManageProjectModal();
  await loadProjects();
  if (wasCurrent) showHome();
  else renderHomeDashboard();
});

async function saveDefectField(defectId, field, value, inputEl) {
  const project = el.projectSelect.value;
  const res = await fetch(`/api/${encodeURIComponent(project)}/defects/${encodeURIComponent(defectId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '저장 실패' }));
    alert(error || '저장에 실패했습니다.');
    return;
  }
  if (inputEl) {
    inputEl.classList.add('save-flash');
    setTimeout(() => inputEl.classList.remove('save-flash'), 1200);
  }
  refreshProjectDetail(project);
}

// ── 💬 사이트분석 · TC 생성 채팅 ────────────────────────────────────────
let ws = null;
let wsBusy = false; // 현재 프로젝트에서 응답 대기 중인지 (연타 방지)
let statusMsgEl = null; // "지금 하는 중..." 한 줄은 새로 올 때마다 이전 것을 갱신(누적 X)
let chatPollTimer = null; // 새로고침 직후 이전 요청이 아직 진행 중일 때 완료를 감지하는 타이머

function setChatStatus(text, cls) {
  el.chatStatus.textContent = text;
  el.chatStatus.className = 'panel-sub' + (cls ? ' ' + cls : '');
}

function appendChatBubble(role, text, extraClass) {
  const div = document.createElement('div');
  div.className = `chat-msg ${role}${extraClass ? ' ' + extraClass : ''}`;
  const roleLabel = { user: '나', assistant: '큐돌이', status: '', issue: '⚠️ 발견된 이슈' }[role] || role;
  div.innerHTML = (roleLabel ? `<span class="chat-role">${esc(roleLabel)}</span>` : '') + esc(text);
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return div;
}

function clearChatHint() {
  const hint = el.chatMessages.querySelector('.chat-hint');
  if (hint) hint.remove();
}

function setChatBusy(busy) {
  wsBusy = busy;
  el.chatInput.disabled = busy;
  el.btnChatSend.disabled = busy;
  el.btnChatSend.textContent = busy ? '진행 중…' : 'TC 자동 생성';
  el.btnChatCancel.hidden = !busy;
  setChatStatus(busy ? '큐돌이가 작업 중입니다…' : '연결됨', busy ? 'ws-busy' : 'ws-connected');
}

async function fetchChatHistory(project) {
  const res = await fetch(`/api/${encodeURIComponent(project)}/chat/history`);
  return res.json();
}

function renderChatMessages(messages) {
  el.chatMessages.innerHTML = '';
  if (!messages || !messages.length) {
    el.chatMessages.innerHTML = '<div class="chat-hint">프로젝트를 선택하고 메시지를 입력해 시작하세요. (예: "메인 페이지 URL은 http://... 입니다. TC 생성해줘")</div>';
    return;
  }
  messages.forEach((m) => appendChatBubble(m.role, m.text));
}

// 화면 새로고침으로 WebSocket이 끊겼다 재연결됐을 때, 새로고침 전에 보낸 요청이 서버에서
// 아직 진행 중일 수 있습니다(activeRuns는 완료 전까지 유지) — 이 경우 완료될 때까지 주기적으로
// 다시 조회해 결과가 도착하면 자동으로 반영합니다 (2026-09-28 추가, "새로고침하면 멈춘 것처럼
// 보이고 다시 보내도 반응이 없다"는 사용자 리포트 대응).
function scheduleChatPoll(project) {
  if (chatPollTimer) clearTimeout(chatPollTimer);
  chatPollTimer = setTimeout(async () => {
    chatPollTimer = null;
    if (el.projectSelect.value !== project) return; // 그 사이 다른 프로젝트로 전환됨 — 중단
    const { messages, busy } = await fetchChatHistory(project);
    if (busy) {
      scheduleChatPoll(project);
      return;
    }
    statusMsgEl = null;
    renderChatMessages(messages);
    setChatBusy(false);
  }, 4000);
}

async function loadChatHistory(project) {
  if (chatPollTimer) { clearTimeout(chatPollTimer); chatPollTimer = null; }
  statusMsgEl = null;
  const { messages, busy } = await fetchChatHistory(project);
  renderChatMessages(messages);
  if (busy) {
    statusMsgEl = appendChatBubble('status', '새로고침 전 보낸 요청이 아직 진행 중입니다 — 완료되면 자동으로 표시됩니다…');
    setChatBusy(true);
    scheduleChatPoll(project);
  } else {
    setChatBusy(false);
  }
}

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/chat`);
  ws.onopen = () => setChatStatus('연결됨', 'ws-connected');
  ws.onclose = () => {
    setChatStatus('연결 끊김 — 재연결 중…', 'ws-error');
    setTimeout(connectWs, 2000);
  };
  ws.onerror = () => setChatStatus('연결 오류', 'ws-error');
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.project && msg.project !== el.projectSelect.value) return; // 다른 프로젝트로 전환된 뒤 도착한 응답은 무시

    if (msg.type === 'status') {
      if (!statusMsgEl || !statusMsgEl.isConnected) statusMsgEl = appendChatBubble('status', msg.text);
      else { statusMsgEl.innerHTML = esc(msg.text); el.chatMessages.scrollTop = el.chatMessages.scrollHeight; }
    } else if (msg.type === 'issue') {
      appendChatBubble('issue', msg.text);
    } else if (msg.type === 'result') {
      if (statusMsgEl) { statusMsgEl.remove(); statusMsgEl = null; }
      appendChatBubble('assistant', msg.text || '(빈 응답)', msg.isError ? 'is-error' : '');
      setChatBusy(false);
    } else if (msg.type === 'error') {
      if (statusMsgEl) { statusMsgEl.remove(); statusMsgEl = null; }
      appendChatBubble('assistant', msg.error, 'is-error');
      setChatBusy(false);
    } else if (msg.type === 'queueAck') {
      tqRenderQueue(msg.plan);
    } else if (msg.type === 'queueModuleStart') {
      tqSetModuleState(msg.moduleCode, 'running', '실행 중');
    } else if (msg.type === 'queueLog') {
      tqAppendLog(msg.line);
    } else if (msg.type === 'queueModuleDone') {
      tqHandleModuleDone(msg.moduleCode, msg.summary, msg.error);
    } else if (msg.type === 'queueReplay') {
      tqReplayItems.push(...msg.items);
    } else if (msg.type === 'queueDone') {
      tqHandleDone(msg.totals, msg.cancelled);
    } else if (msg.type === 'queueError') {
      tqSetRunning(false);
      el.tqPreview.textContent = msg.error;
      el.tqPreview.classList.add('tq-preview-error');
    }
  };
}

// ── + TC 업로드 (zero-token — claude 미사용, 엑셀/JSON을 직접 파싱해 캐노니컬 TC json에 반영) ──
function openTcUploadModal() {
  el.tcUploadFile.value = '';
  el.tcUploadError.textContent = '';
  el.tcUploadResult.hidden = true;
  el.tcUploadResult.innerHTML = '';
  el.btnTcUploadSubmit.disabled = true;
  el.tcUploadModal.hidden = false;
}
function closeTcUploadModal() {
  el.tcUploadModal.hidden = true;
}
el.btnTcUpload.addEventListener('click', openTcUploadModal);
el.btnCancelTcUpload.addEventListener('click', closeTcUploadModal);
el.tcUploadModal.addEventListener('click', (e) => { if (e.target === el.tcUploadModal) closeTcUploadModal(); });
el.tcUploadFile.addEventListener('change', () => {
  el.btnTcUploadSubmit.disabled = !el.tcUploadFile.files.length;
});

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function renderTcUploadResult(data) {
  const parts = [];
  parts.push(`<div class="tur-summary">수정 ${data.updatedTcIds.length}건 · 신규 ${data.createdTcIds.length}건 반영됨</div>`);
  if (data.modules.length) {
    parts.push('<ul>' + data.modules.map((m) => `<li>${esc(m.moduleName)}(${esc(m.moduleCode)}) — 수정 ${m.updated}건, 신규 ${m.created}건 (v${m.version})</li>`).join('') + '</ul>');
  }
  if (data.warnings.length) {
    parts.push('<div class="tur-warn">⚠ 참고</div><ul class="tur-warn">' + data.warnings.map((w) => `<li>${esc(w)}</li>`).join('') + '</ul>');
  }
  if (data.skipped.length) {
    parts.push(`<div class="tur-skip">건너뜀 ${data.skipped.length}건</div><ul class="tur-skip">` + data.skipped.map((s) => `<li>${esc(s.row)} ${esc(s.tcId)} — ${esc(s.reason)}</li>`).join('') + '</ul>');
  }
  if (data.updatedTcIds.length || data.createdTcIds.length) {
    if (data.viewerRefresh && data.viewerRefresh.started) {
      parts.push('<div class="placeholder-text">※ TC JSON은 즉시 반영됐고, 편집 가능한 TC 뷰어(HTML) 재생성을 채팅(큐돌이)에게 자동으로 요청했습니다 — 하단 채팅 패널에서 진행상황을 확인하세요.</div>');
    } else if (data.viewerRefresh) {
      parts.push(`<div class="placeholder-text tur-warn">※ TC JSON은 즉시 반영됐지만, 뷰어 자동 갱신 요청은 보내지 못했습니다(${esc(data.viewerRefresh.reason)}) — 채팅에서 직접 "뷰어 갱신해줘"라고 요청해주세요.</div>`);
    }
  }
  el.tcUploadResult.innerHTML = parts.join('');
  el.tcUploadResult.hidden = false;
}

el.btnTcUploadSubmit.addEventListener('click', async () => {
  const project = el.projectSelect.value;
  const file = el.tcUploadFile.files[0];
  if (!project || !file) return;
  el.tcUploadError.textContent = '';
  el.btnTcUploadSubmit.disabled = true;
  el.btnTcUploadSubmit.textContent = '반영 중…';
  try {
    const buf = await file.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(buf);
    const res = await fetch(`/api/${encodeURIComponent(project)}/tc-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, dataBase64 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '업로드 처리에 실패했습니다.');
    renderTcUploadResult(data);
    if (data.updatedTcIds.length || data.createdTcIds.length) loadAll(); // TC 관리/KPI 패널에 즉시 반영
  } catch (err) {
    el.tcUploadError.textContent = err.message;
  } finally {
    el.btnTcUploadSubmit.disabled = !el.tcUploadFile.files.length;
    el.btnTcUploadSubmit.textContent = '업로드 및 반영';
  }
});

// ── ▶ 테스트 실행 큐 (zero-token — claude 미사용, Playwright 직접 실행) ──────────────────
let tqModules = []; // 현재 프로젝트에서 실행 가능한(자동화 코드가 있는) 모듈 목록
let tqRunning = false;
const tqRows = {}; // moduleCode -> 큐 목록의 행 엘리먼트

/**
 * 현재 선택 조합 기준으로 "이 값을 고르면 몇 건인지"(facets)를 반영해, 골라도 0건인 선택지는
 * 비활성화합니다 — 선택 후에야 "대상 없음"을 알게 하지 않고, 고를 수 있는 값만 활성화된 상태로
 * 보여달라는 사용자 요청 (2026-09-29). "전체"(빈 값)는 필터를 넓히는 선택지라 항상 활성화 유지.
 */
function applyTqFacets(facets) {
  if (!facets) return;
  const applySelect = (selectEl, list) => {
    Array.from(selectEl.options).forEach((opt) => {
      if (!opt.value) return;
      const f = list.find((x) => x.value === opt.value);
      opt.disabled = !!f && f.count === 0;
    });
  };
  applySelect(el.tqModule, facets.modules);
  applySelect(el.tqSystem, facets.systems);
  applySelect(el.tqPriority, facets.priorities);
  applySelect(el.tqStatusFilter, facets.statuses);
}
[el.tqPriority, el.tqStatusFilter].forEach((sel) => {
  sel.addEventListener('change', () => { if (!tqRunning) refreshTqPreview(); });
});

async function loadTestQueueModules(project) {
  tqModules = [];
  el.tqModule.innerHTML = '<option value="">불러오는 중…</option>';
  try {
    const res = await fetch(`/api/${encodeURIComponent(project)}/test-queue/modules`);
    const data = await res.json();
    tqModules = data.modules || [];
  } catch {
    tqModules = [];
  }
  el.tqModule.innerHTML =
    '<option value="">전체 모듈</option>' +
    tqModules.map((m) => `<option value="${esc(m.moduleCode)}">${esc(m.moduleName)} (${esc(m.moduleCode)}, ${m.automatedCount}건)</option>`).join('');
  if (!tqModules.length) {
    el.tqModule.innerHTML = '<option value="">자동화된 모듈 없음 (TC/automation/tests/*.spec.js 필요)</option>';
  }
  el.tqModule.value = '';
  el.tqSystem.value = '';
  el.tqPriority.value = '';
  el.tqStatusFilter.value = '';
  el.tqModuleQueue.innerHTML = '';
  el.tqLog.hidden = true;
  el.tqLog.textContent = '';
  tqSetRunning(false);
  refreshTqPreview();
}

function tqCurrentFilters() {
  return {
    moduleCodes: el.tqModule.value ? [el.tqModule.value] : [],
    system: el.tqSystem.value,
    priority: el.tqPriority.value,
    status: el.tqStatusFilter.value,
  };
}

async function refreshTqPreview() {
  const project = el.projectSelect.value;
  if (!project) {
    el.tqPreview.textContent = '프로젝트를 선택하면 실행 대상 현황이 표시됩니다.';
    el.tqPreview.classList.remove('tq-preview-error');
    el.btnTqStart.disabled = true;
    return;
  }
  const { moduleCodes, system, priority, status } = tqCurrentFilters();
  try {
    const qs = new URLSearchParams({ scope: 'filter', moduleCodes: moduleCodes.join(','), system, priority, status });
    const res = await fetch(`/api/${encodeURIComponent(project)}/test-queue/preview?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '실행 대상을 조회하지 못했습니다.');
    el.tqPreview.classList.remove('tq-preview-error');
    applyTqFacets(data.facets);
    if (!data.targetCount) {
      el.tqPreview.textContent = '이 조건에 실행 대상 TC가 없습니다.';
      el.btnTqStart.disabled = true;
      return;
    }
    const byModule = data.modules.map((m) => `${esc(m.moduleCode)} ${m.count}건`).join(', ');
    let html = `실행 대상 <b>${data.targetCount}건</b> (${byModule})`;
    if (data.excludedNoAutomation) html += ` — 자동화 코드가 없어 제외된 TC ${data.excludedNoAutomation}건`;
    el.tqPreview.innerHTML = html;
    el.btnTqStart.disabled = tqRunning;
  } catch (err) {
    el.tqPreview.textContent = err.message;
    el.tqPreview.classList.add('tq-preview-error');
    el.btnTqStart.disabled = true;
  }
}

el.tqModule.addEventListener('change', refreshTqPreview);
el.tqSystem.addEventListener('change', refreshTqPreview);

// ── 단계 재생(녹화) 모드: 실행 후 팝업으로 TC별 영상/스크린샷 재생 (상태/TC ID 필터 지원) ──────
let tqReplayItems = [];
let replayStatusFilter = '';

const REPLAY_STATUS_LABEL = { passed: 'Pass', failed: 'Fail', timedOut: 'Timeout', skipped: 'Skipped', interrupted: 'Interrupted' };

function replayFilteredItems() {
  const query = el.replayTcSearch.value.trim().toLowerCase();
  return tqReplayItems.filter((it) => {
    if (replayStatusFilter && it.status !== replayStatusFilter) return false;
    if (query && !it.tcId.toLowerCase().includes(query)) return false;
    return true;
  });
}

function renderReplayStatusPills() {
  const counts = {};
  tqReplayItems.forEach((it) => { counts[it.status] = (counts[it.status] || 0) + 1; });
  const statuses = Object.keys(counts);
  const pills = [`<button type="button" class="tq-pill-btn${replayStatusFilter === '' ? ' active' : ''}" data-value="">전체 (${tqReplayItems.length})</button>`]
    .concat(statuses.map((s) => `<button type="button" class="tq-pill-btn${replayStatusFilter === s ? ' active' : ''}" data-value="${esc(s)}">${esc(REPLAY_STATUS_LABEL[s] || s)} (${counts[s]})</button>`));
  el.replayStatusPills.innerHTML = pills.join('');
}

function renderReplayList() {
  const items = replayFilteredItems();
  if (!items.length) {
    el.replayList.innerHTML = '<div class="placeholder-text">조건에 맞는 실행 결과가 없습니다.</div>';
    return;
  }
  el.replayList.innerHTML = items
    .map((it) => {
      const shots = it.screenshots.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="스크린샷" loading="lazy"></a>`).join('');
      return `<div class="replay-item" id="replay-${esc(it.tcId)}">
        <div class="replay-item-head">
          <span>${esc(it.moduleCode)} · ${esc(it.tcId)}</span>
          <span class="replay-status-${esc(it.status)}">${esc(REPLAY_STATUS_LABEL[it.status] || it.status)}</span>
          <span>${esc(it.title)}</span>
        </div>
        ${it.video ? `<video controls preload="metadata" src="${esc(it.video)}"></video>` : '<div class="placeholder-text">녹화된 영상이 없습니다.</div>'}
        ${shots ? `<div class="replay-shots">${shots}</div>` : ''}
        ${it.trace ? `<div class="replay-links"><a href="${esc(it.trace)}" download>트레이스(.zip) 다운로드</a> — <code>npx playwright show-trace</code> 로 단계별 DOM 스냅샷 확인</div>` : ''}
      </div>`;
    })
    .join('');
}

function openReplayModal() {
  if (!tqReplayItems.length) return;
  replayStatusFilter = '';
  el.replayTcSearch.value = '';
  renderReplayStatusPills();
  renderReplayList();
  el.replayModal.hidden = false;
}

function closeReplayModal() {
  el.replayModal.hidden = true;
  el.replayList.querySelectorAll('video').forEach((v) => v.pause());
  el.replayList.innerHTML = '';
}

el.btnTqReplay.addEventListener('click', openReplayModal);
el.btnCloseReplay.addEventListener('click', closeReplayModal);
el.replayModal.addEventListener('click', (e) => { if (e.target === el.replayModal) closeReplayModal(); });
el.replayStatusPills.addEventListener('click', (e) => {
  const btn = e.target.closest('.tq-pill-btn');
  if (!btn) return;
  replayStatusFilter = btn.dataset.value;
  renderReplayStatusPills();
  renderReplayList();
});
el.replayTcSearch.addEventListener('input', renderReplayList);

function tqSetRunning(running) {
  tqRunning = running;
  el.btnTqStart.hidden = running;
  el.btnTqCancel.hidden = !running;
  el.tqModule.disabled = running;
  el.tqSystem.disabled = running;
  el.tqPriority.disabled = running;
  el.tqStatusFilter.disabled = running;
  el.tqHeaded.disabled = running;
  el.tqStatus.textContent = running ? '실행 중…' : '대기 중';
  pdOnRunState(running); // 상세 화면 헤더의 "테스트 실행" 버튼에 진행 중 표시
  if (!running) refreshTqPreview();
}

function tqRenderQueue(plan) {
  Object.keys(tqRows).forEach((k) => delete tqRows[k]);
  el.tqModuleQueue.innerHTML = plan
    .map((p) => {
      const label = p.count != null ? `${esc(p.moduleCode)} (${p.count}건)` : esc(p.moduleCode);
      return `<div class="tq-module-row" data-module="${esc(p.moduleCode)}">
        <span class="tq-mod-name">${label}</span>
        <span class="tq-mod-result" data-role="result"></span>
        <span class="tq-pill" data-role="pill">대기</span>
      </div>`;
    })
    .join('');
  el.tqModuleQueue.querySelectorAll('.tq-module-row').forEach((row) => { tqRows[row.dataset.module] = row; });
}

function tqSetModuleState(moduleCode, cls, label) {
  const row = tqRows[moduleCode];
  if (!row) return;
  const pill = row.querySelector('[data-role="pill"]');
  pill.className = `tq-pill tq-pill-${cls}`;
  pill.textContent = label;
}

function tqHandleModuleDone(moduleCode, summary, error) {
  const row = tqRows[moduleCode];
  if (!row) return;
  if (error || !summary) {
    tqSetModuleState(moduleCode, 'fail', '오류');
    row.querySelector('[data-role="result"]').textContent = error || '결과를 읽지 못함';
    return;
  }
  const hasFail = summary.fail > 0;
  tqSetModuleState(moduleCode, hasFail ? 'fail' : 'done', hasFail ? '실패 포함 완료' : '완료');
  const parts = [`Pass ${summary.pass}`, `Fail ${summary.fail}`];
  if (summary.na) parts.push(`N/A ${summary.na}`);
  if (summary.newDefects.length) parts.push(`신규 결함 ${summary.newDefects.length}건`);
  if (summary.reopenedDefects.length) parts.push(`재발생 ${summary.reopenedDefects.length}건`);
  row.querySelector('[data-role="result"]').textContent = parts.join(' · ');
  if (summary.passedWithOpenDefect.length) {
    tqAppendLog(`[안내] ${moduleCode}: ${summary.passedWithOpenDefect.join(', ')} 재검증 통과 — 열려있는 결함을 완료 처리하려면 결함 관리 표에서 직접 상태를 변경해주세요 (자동으로 닫지 않습니다).`);
  }
}

function tqAppendLog(line) {
  el.tqLog.hidden = false;
  el.tqLog.textContent += (el.tqLog.textContent ? '\n' : '') + line;
  el.tqLog.scrollTop = el.tqLog.scrollHeight;
}

function tqHandleDone(totals, cancelled) {
  tqSetRunning(false);
  const project = el.projectSelect.value;
  if (cancelled) {
    tqAppendLog('[중단됨] 사용자 요청으로 큐 실행을 중단했습니다.');
  } else {
    tqAppendLog(
      `[완료] 총 ${totals.executed}건 실행 — Pass ${totals.pass} / Fail ${totals.fail} / N/A ${totals.na}` +
        (totals.newDefects.length ? ` · 신규 결함 ${totals.newDefects.length}건` : '') +
        (totals.reopenedDefects.length ? ` · 재발생 결함 ${totals.reopenedDefects.length}건` : '')
    );
    tqAppendLog('[참고] TC/defects.json/results 스냅샷 JSON은 갱신됐습니다. HTML 뷰어(TC 뷰어·결함현황 탭·실행이력 상세 페이지)는 채팅에서 "뷰어 갱신해줘"라고 요청해야 최신 데이터로 다시 생성됩니다.');
  }
  if (project) loadAll(); // KPI·결함 표·실행 이력 목록에 방금 결과 반영
  el.btnTqReplay.hidden = !tqReplayItems.length;
  if (tqReplayItems.length) openReplayModal(); // 녹화 모드였다면 실행 직후 재생 팝업 자동 오픈
}

el.btnTqStart.addEventListener('click', () => {
  const project = el.projectSelect.value;
  if (!project || tqRunning || !ws || ws.readyState !== WebSocket.OPEN) return;
  const { moduleCodes, system, priority, status } = tqCurrentFilters();
  const record = el.tqHeaded.value === '1';
  tqReplayItems = [];
  el.btnTqReplay.hidden = true;
  el.tqLog.textContent = '';
  el.tqLog.hidden = true;
  el.tqModuleQueue.innerHTML = '';
  tqSetRunning(true);
  ws.send(JSON.stringify({ type: 'runTests', project, scope: 'filter', moduleCodes, system, priority, status, record }));
});

el.btnTqCancel.addEventListener('click', () => {
  const project = el.projectSelect.value;
  if (!project || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'cancelTests', project }));
  el.tqStatus.textContent = '중단 요청을 보냈습니다…';
});

// ── 채팅 첨부(정책서/SB 문서) — Claude/Slack처럼 "+" 버튼으로 올리면 project/Policy/에 저장되고,
// 보내기 시 메시지에 그 경로가 함께 실려 큐돌이가 자기 Read 도구로 직접 열어봅니다 ──────────
let pendingAttachments = []; // [{ fileName, path }]

function renderChatAttachList() {
  if (!pendingAttachments.length) {
    el.chatAttachList.hidden = true;
    el.chatAttachList.innerHTML = '';
    return;
  }
  el.chatAttachList.hidden = false;
  el.chatAttachList.innerHTML = pendingAttachments
    .map((a, i) => `<span class="chat-attach-chip">📎 ${esc(a.fileName)}<button type="button" class="chat-attach-remove" data-idx="${i}" title="첨부 취소">×</button></span>`)
    .join('');
}

el.chatAttachList.addEventListener('click', (e) => {
  const btn = e.target.closest('.chat-attach-remove');
  if (!btn) return;
  pendingAttachments.splice(Number(btn.dataset.idx), 1);
  renderChatAttachList();
});

el.btnChatAttach.addEventListener('click', () => {
  if (!el.projectSelect.value) {
    setChatStatus('먼저 프로젝트를 선택해주세요.', 'ws-error');
    return;
  }
  el.chatAttachInput.click();
});

el.chatAttachInput.addEventListener('change', async () => {
  const file = el.chatAttachInput.files[0];
  el.chatAttachInput.value = '';
  const project = el.projectSelect.value;
  if (!file || !project) return;
  const originalLabel = el.btnChatAttach.textContent;
  el.btnChatAttach.disabled = true;
  el.btnChatAttach.textContent = '…';
  try {
    const buf = await file.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(buf);
    const res = await fetch(`/api/${encodeURIComponent(project)}/chat-attachment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, dataBase64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '첨부 업로드 실패');
    pendingAttachments.push({ fileName: data.fileName, path: data.path });
    renderChatAttachList();
  } catch (err) {
    setChatStatus(`첨부 실패: ${err.message}`, 'ws-error');
  } finally {
    el.btnChatAttach.disabled = false;
    el.btnChatAttach.textContent = originalLabel;
  }
});

el.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const project = el.projectSelect.value;
  const text = el.chatInput.value.trim();
  if (!project || (!text && !pendingAttachments.length) || wsBusy) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setChatStatus('아직 연결되지 않았습니다 — 잠시 후 다시 시도해주세요.', 'ws-error');
    return;
  }
  const attachNote = pendingAttachments.length
    ? `[첨부파일: ${pendingAttachments.map((a) => a.path).join(', ')}]\n`
    : '';
  const fullText = attachNote + text;
  clearChatHint();
  appendChatBubble('user', fullText);
  el.chatInput.value = '';
  pendingAttachments = [];
  renderChatAttachList();
  setChatBusy(true);
  ws.send(JSON.stringify({ type: 'message', project, text: fullText }));
});

el.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    el.chatForm.requestSubmit();
  }
});

el.btnChatCancel.addEventListener('click', () => {
  const project = el.projectSelect.value;
  if (!project || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'cancel', project }));
  setChatStatus('중단 요청을 보냈습니다…', 'ws-busy');
});

el.btnChatReset.addEventListener('click', async () => {
  const project = el.projectSelect.value;
  if (!project) return;
  if (!confirm('이 프로젝트의 대화를 새로 시작할까요? (지금까지 나눈 대화 맥락이 초기화됩니다)')) return;
  await fetch(`/api/${encodeURIComponent(project)}/chat/reset`, { method: 'POST' });
  await loadChatHistory(project);
});

// ── 🔗 Git 상태 · push (전역 — 저장소가 하나라 프로젝트 단위가 아님) ──────────────────────
async function openGitStatusModal() {
  el.gitStatusModal.hidden = false;
  el.gitStatusError.textContent = '';
  el.gitStatusBody.textContent = '불러오는 중…';
  el.btnGitPush.disabled = true;
  try {
    const res = await fetch('/api/git/status');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '조회에 실패했습니다.');
    if (!data.ahead) {
      el.gitStatusBody.innerHTML = `<div class="gs-branch">${esc(data.branch)}</div><div class="gs-clean">origin과 동기화됨 — push할 커밋이 없습니다.</div>`;
      el.btnGitPush.disabled = true;
    } else {
      el.gitStatusBody.innerHTML =
        `<div class="gs-branch">${esc(data.branch)}</div>` +
        `<div class="gs-ahead">origin보다 ${data.ahead}개 커밋 앞서 있습니다 (push 대기 중):</div>` +
        `<ul>${data.recentCommits.map((c) => `<li>${esc(c.hash)} ${esc(c.message)}</li>`).join('')}</ul>`;
      el.btnGitPush.disabled = false;
    }
  } catch (err) {
    el.gitStatusBody.textContent = '';
    el.gitStatusError.textContent = err.message;
  }
}
el.btnGitStatus.addEventListener('click', openGitStatusModal);
el.btnCloseGitStatus.addEventListener('click', () => { el.gitStatusModal.hidden = true; });
el.gitStatusModal.addEventListener('click', (e) => { if (e.target === el.gitStatusModal) el.gitStatusModal.hidden = true; });
el.btnGitPush.addEventListener('click', async () => {
  el.gitStatusError.textContent = '';
  el.btnGitPush.disabled = true;
  el.btnGitPush.textContent = 'push 중…';
  try {
    const res = await fetch('/api/git/push', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'push에 실패했습니다.');
    await openGitStatusModal(); // 최신 상태(ahead 0)로 갱신
  } catch (err) {
    el.gitStatusError.textContent = err.message;
    el.btnGitPush.disabled = false;
  } finally {
    el.btnGitPush.textContent = 'origin으로 push';
  }
});

el.projectSelect.addEventListener('change', () => showProject(el.projectSelect.value));

(async function init() {
  await loadProjects();
  connectWs();
  // [수정 2026-09-28] 항상 홈으로 그리던 버전 — 프로젝트 상세(채팅 포함)에서 화면을 새로고침하면
  // 매번 홈으로 튕겨나가 진행 중이던 대화 흐름이 끊긴 것처럼 보였습니다(사용자 리포트). F5로
  // 실제 페이지가 새로 로드돼도 같은 히스토리 항목의 history.state는 브라우저가 보존하므로, 그
  // state를 읽어 새로고침 직전 보던 프로젝트 화면을 그대로 복원합니다.
  const state = history.state;
  if (state && state.view === 'project' && state.project && allProjects.includes(state.project)) {
    renderProjectView(state.project);
    history.replaceState({ view: 'project', project: state.project }, '', '/');
  } else {
    renderHomeView(); // 최초 진입 화면(또는 복원할 상태가 없으면)은 홈(프로젝트 카드)
    history.replaceState({ view: 'home' }, '', '/'); // pushState가 아닌 replaceState — 새 기록을 쌓지 않고 현재 항목에 상태만 붙임
  }
})();
