const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

const el = {
  projectSelect: document.getElementById('projectSelect'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnLogout: document.getElementById('btnLogout'),
  btnHome: document.getElementById('btnHome'),
  homeView: document.getElementById('homeView'),
  projectView: document.getElementById('projectView'),
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
  kpiTotalDefects: document.getElementById('kpiTotalDefects'),
  kpiNewDefects: document.getElementById('kpiNewDefects'),
  kpiPass: document.getElementById('kpiPass'),
  kpiFail: document.getElementById('kpiFail'),
  kpiExecRate: document.getElementById('kpiExecRate'),
  defectTableBody: document.getElementById('defectTableBody'),
  resultsList: document.getElementById('resultsList'),
  chatStatus: document.getElementById('chatStatus'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  btnChatSend: document.getElementById('btnChatSend'),
  btnChatReset: document.getElementById('btnChatReset'),
};

let allProjects = [];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadProjects() {
  const res = await fetch('/api/projects');
  const { projects } = await res.json();
  allProjects = projects;
  // 플레이스홀더를 항상 기본 선택값으로 둡니다 — 홈이 최초 진입 화면이므로 select도
  // 특정 프로젝트가 "선택된" 상태로 보이면 안 됩니다 (프로젝트를 고르기 전까지는 미선택 상태 유지).
  el.projectSelect.innerHTML =
    '<option value="" disabled selected>프로젝트 선택</option>' +
    projects.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
}

async function loadAll() {
  const project = el.projectSelect.value;
  if (!project) return;
  await Promise.all([loadKpi(project), loadDefects(project), loadResults(project), loadChatHistory(project)]);
}

// ── 🏠 홈 (프로젝트 카드) ↔ 📁 프로젝트 상세 화면 전환 ─────────────────────
function showHome() {
  el.projectSelect.value = '';
  el.projectView.style.display = 'none';
  el.homeView.style.display = 'block';
  renderHomeDashboard();
}

function showProject(project) {
  if (!project) return showHome();
  el.projectSelect.value = project;
  el.homeView.style.display = 'none';
  el.projectView.style.display = 'block';
  loadAll();
}

// 실행결과 값(AGENTS.md 20-7항) 색상
const EXEC_ORDER = ['pass', 'fail', 'blocked', 'na', 'nt', 'none'];
const EXEC_LABELS = { pass: 'Pass', fail: 'Fail', blocked: 'Blocked', na: 'N/A', nt: 'N/T', none: '미실행' };
const EXEC_COLORS = {
  pass: 'var(--good)',
  fail: 'var(--bad)',
  blocked: 'var(--warn)',
  na: 'var(--text-secondary)',
  nt: 'var(--accent2)',
  none: 'var(--divider)',
};

// 결함 우선순위(AGENTS.md 4항: P1=Critical, P2=Major, P3=Minor) 색상 — 기존 결함테이블 sev-badge와 동일 팔레트
const SEVERITY_ORDER = ['P1', 'P2', 'P3'];
const SEVERITY_LABELS = { P1: 'Critical (P1)', P2: 'Major (P2)', P3: 'Minor (P3)' };
const SEVERITY_COLORS = { P1: 'var(--bad)', P2: 'var(--warn)', P3: 'var(--primary)' };

function renderLegend(order, labels, colors) {
  return order
    .map((k) => `<span class="legend-item"><span class="legend-swatch" style="background:${colors[k]}"></span>${esc(labels[k])}</span>`)
    .join('');
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

/** 수행현황 ① — Full TC(모듈 전체 합산) 기준 실행결과 도넛, 가운데엔 수행율이 가장 높은 모듈명+수행율 */
function renderExecDonut(kpi) {
  const r = kpi ? kpi.results : null;
  if (!r || !r.total) return donutChart([], '', '실행 이력 없음');
  const segments = EXEC_ORDER.map((k) => ({ n: r[k] || 0, color: EXEC_COLORS[k] }));
  const byModule = r.byModule || [];
  const top = byModule.reduce((best, m) => (!best || m.execRate > best.execRate ? m : best), null);
  const centerHtml = top
    ? `<span class="donut-total">${top.execRate}%</span><span class="donut-total-label" title="${esc(top.moduleName)}">${esc(top.moduleName)}</span>`
    : `<span class="donut-total">${Math.round((r.executed / r.total) * 100)}%</span><span class="donut-total-label">전체</span>`;
  return donutChart(segments, centerHtml, '실행 이력 없음');
}

/** 수행현황 ② — 날짜별 진척율(수행율) 추이를 선/영역 그래프로 표시 (순수 SVG, 라이브러리 없음) */
function renderTrendChart(timeline) {
  if (!timeline || !timeline.length) return '<div class="trend-empty">실행 이력이 없습니다</div>';
  const W = 280, H = 100, PAD = 10;
  const n = timeline.length;
  const points = timeline.map((t, i) => ({
    x: n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2),
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

/** 수행현황 ③ — 모듈별 TC 실행결과 상세 표 */
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
      <td>${m.execRate}%</td>
      <td>${m.pass}</td>
      <td>${m.fail}</td>
      <td>${m.na}</td>
      <td>${m.nt}</td>
      <td>${m.passRate}%</td>
      <td>${m.failRate}%</td>
    </tr>`
    )
    .join('');
  return `
    <table class="pb-module-table">
      <thead><tr><th>모듈</th><th>전체</th><th>수행</th><th>수행율</th><th>Pass</th><th>Fail</th><th>N/A</th><th>N/T</th><th>Pass율</th><th>Fail율</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

/** 결함현황 ① — 전체 결함을 우선순위(P1/P2/P3)별로 집계한 도넛 */
function renderSeverityDonut(kpi) {
  const d = kpi ? kpi.defects : null;
  if (!d || !d.total) return donutChart([], '', '등록된 결함 없음');
  const segments = SEVERITY_ORDER.map((s) => ({ n: (d.severityCounts && d.severityCounts[s]) || 0, color: SEVERITY_COLORS[s] }));
  const centerHtml = `<span class="donut-total">${d.total}</span><span class="donut-total-label">전체 결함</span>`;
  return donutChart(segments, centerHtml, '등록된 결함 없음');
}

/** 결함현황 ② — 모듈별 결함 상세 현황 표 */
function renderModuleDefectTable(byModule) {
  if (!byModule || !byModule.length) return '<div class="empty-row">등록된 결함이 없습니다</div>';
  const rowsHtml = byModule
    .map(
      (m) => `
    <tr>
      <td class="pb-module-name">${esc(m.module)}</td>
      <td>${m.total}</td>
      <td>${m.P1}</td>
      <td>${m.P2}</td>
      <td>${m.P3}</td>
      <td>${m.신규}</td>
      <td>${m.처리중}</td>
      <td>${m.완료}</td>
    </tr>`
    )
    .join('');
  return `
    <table class="pb-module-table">
      <thead><tr><th>모듈</th><th>전체</th><th>P1</th><th>P2</th><th>P3</th><th>신규</th><th>처리중</th><th>완료</th></tr></thead>
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

  const kpis = await Promise.all(
    allProjects.map((p) =>
      fetch(`/api/${encodeURIComponent(p)}/kpi`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );
  const rows = allProjects.map((p, i) => ({ project: p, kpi: kpis[i] }));

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

/** 프로젝트 하나당 블록 1개 — 수행현황(도넛+추이) 2개, 결함현황(도넛+표) 2개를 섹션으로 나눠 표시 */
function renderProjectBlocks(rows) {
  el.projectBlocks.innerHTML = rows
    .map(
      ({ project, kpi }) => `
      <div class="panel project-block" data-project="${esc(project)}">
        <div class="panel-head">
          <h2>${esc(project)}</h2>
          <span class="panel-sub project-block-link">상세보기 →</span>
        </div>

        <div class="pb-section-title">수행현황</div>
        <div class="pb-grid-2">
          <div class="pb-chart-card">
            <div class="pb-chart-head">
              <span class="pb-chart-title">Full TC 수행현황</span>
              <span class="chart-legend-inline">${renderLegend(EXEC_ORDER, EXEC_LABELS, EXEC_COLORS)}</span>
            </div>
            <div class="pb-chart-body">${renderExecDonut(kpi)}</div>
          </div>
          <div class="pb-chart-card">
            <div class="pb-chart-head"><span class="pb-chart-title">날짜별 진척율</span></div>
            <div class="pb-chart-body pb-chart-body-trend">${renderTrendChart(kpi ? kpi.results.timeline : [])}</div>
          </div>
        </div>
        <div class="pb-chart-card pb-chart-card-wide pb-table-row">
          <div class="pb-chart-head"><span class="pb-chart-title">모듈별 TC 현황</span></div>
          <div class="table-wrap">${renderModuleExecTable(kpi ? kpi.results.byModule : [])}</div>
        </div>

        <div class="pb-section-title">결함현황</div>
        <div class="pb-grid-2">
          <div class="pb-chart-card">
            <div class="pb-chart-head">
              <span class="pb-chart-title">우선순위별 결함</span>
              <span class="chart-legend-inline">${renderLegend(SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_COLORS)}</span>
            </div>
            <div class="pb-chart-body">${renderSeverityDonut(kpi)}</div>
          </div>
          <div class="pb-chart-card pb-chart-card-wide">
            <div class="pb-chart-head"><span class="pb-chart-title">모듈별 결함 상세</span></div>
            <div class="table-wrap">${renderModuleDefectTable(kpi ? kpi.defects.byModule : [])}</div>
          </div>
        </div>
      </div>`
    )
    .join('');
}

el.projectBlocks.addEventListener('click', (e) => {
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

async function loadKpi(project) {
  const res = await fetch(`/api/${encodeURIComponent(project)}/kpi`);
  if (!res.ok) return;
  const { defects, results } = await res.json();
  el.kpiTotalDefects.textContent = defects.total;
  el.kpiNewDefects.textContent = defects.counts['신규'] || 0;
  el.kpiPass.textContent = results.pass;
  el.kpiFail.textContent = results.fail;
  el.kpiExecRate.textContent = results.total ? Math.round((results.executed / results.total) * 100) + '%' : '–';
}

async function loadDefects(project) {
  const res = await fetch(`/api/${encodeURIComponent(project)}/defects`);
  if (!res.ok) {
    el.defectTableBody.innerHTML = '<tr><td colspan="7" class="empty-row">결함 데이터가 없습니다</td></tr>';
    return;
  }
  const { defects } = await res.json();
  if (!defects.length) {
    el.defectTableBody.innerHTML = '<tr><td colspan="7" class="empty-row">등록된 결함이 없습니다</td></tr>';
    return;
  }
  el.defectTableBody.innerHTML = defects
    .map(
      (d) => `
    <tr data-id="${esc(d.defectId)}">
      <td>${esc(d.defectId)}</td>
      <td>${esc(d.module)}</td>
      <td><span class="sev-badge sev-${esc(d.severity)}">${esc(d.severity)}</span></td>
      <td>
        <select class="status-select" data-field="status">
          ${STATUS_ORDER.map((s) => `<option value="${s}" ${s === d.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="assignee-input" data-field="assignee" value="${esc(d.assignee || '')}" placeholder="미지정"></td>
      <td>${esc(d.summary)}</td>
      <td>${esc(d.detectedAt || '')}</td>
    </tr>`
    )
    .join('');
}

async function loadResults(project) {
  const res = await fetch(`/api/${encodeURIComponent(project)}/results`);
  const { snapshots } = await res.json();
  if (!snapshots.length) {
    el.resultsList.innerHTML = '<div class="empty-row">저장된 실행 이력이 없습니다</div>';
    return;
  }
  el.resultsList.innerHTML = snapshots
    .map(
      (s) => `
    <div class="result-item">
      <div class="r-main">
        <span class="r-mod">${esc(s.moduleName)} (${esc(s.moduleCode)})</span>
        <span class="r-date">${esc(s.dateFmt)}</span>
        <span class="r-stats">전체 ${s.total} · 수행 ${s.executed} · Pass ${s.pass} · Fail ${s.fail} · 수행율 ${s.execRate}%</span>
      </div>
      <a href="/files/${encodeURIComponent(s.project)}/results/${encodeURIComponent(s.htmlFile)}" target="_blank" rel="noopener">열기 →</a>
    </div>`
    )
    .join('');
}

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
  loadKpi(project);
}

el.defectTableBody.addEventListener('change', (e) => {
  const target = e.target;
  if (!target.matches('[data-field]')) return;
  const row = target.closest('tr');
  const defectId = row?.dataset.id;
  const field = target.dataset.field;
  if (!defectId || !field) return;
  saveDefectField(defectId, field, target.value, target);
});

// ── 💬 사이트분석 · TC 생성 채팅 ────────────────────────────────────────
let ws = null;
let wsBusy = false; // 현재 프로젝트에서 응답 대기 중인지 (연타 방지)
let statusMsgEl = null; // "지금 하는 중..." 한 줄은 새로 올 때마다 이전 것을 갱신(누적 X)

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
  el.btnChatSend.textContent = busy ? '진행 중…' : '보내기';
  setChatStatus(busy ? '큐돌이가 작업 중입니다…' : '연결됨', busy ? 'ws-busy' : 'ws-connected');
}

async function loadChatHistory(project) {
  el.chatMessages.innerHTML = '';
  statusMsgEl = null;
  const res = await fetch(`/api/${encodeURIComponent(project)}/chat/history`);
  const { messages } = await res.json();
  if (!messages || !messages.length) {
    el.chatMessages.innerHTML = '<div class="chat-hint">프로젝트를 선택하고 메시지를 입력해 시작하세요. (예: "메인 페이지 URL은 http://... 입니다. TC 생성해줘")</div>';
    return;
  }
  messages.forEach((m) => appendChatBubble(m.role, m.text));
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
    }
  };
}

el.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const project = el.projectSelect.value;
  const text = el.chatInput.value.trim();
  if (!project || !text || wsBusy) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setChatStatus('아직 연결되지 않았습니다 — 잠시 후 다시 시도해주세요.', 'ws-error');
    return;
  }
  clearChatHint();
  appendChatBubble('user', text);
  el.chatInput.value = '';
  setChatBusy(true);
  ws.send(JSON.stringify({ type: 'message', project, text }));
});

el.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    el.chatForm.requestSubmit();
  }
});

el.btnChatReset.addEventListener('click', async () => {
  const project = el.projectSelect.value;
  if (!project) return;
  if (!confirm('이 프로젝트의 대화를 새로 시작할까요? (지금까지 나눈 대화 맥락이 초기화됩니다)')) return;
  await fetch(`/api/${encodeURIComponent(project)}/chat/reset`, { method: 'POST' });
  await loadChatHistory(project);
});

el.projectSelect.addEventListener('change', () => showProject(el.projectSelect.value));

(async function init() {
  await loadProjects();
  connectWs();
  showHome(); // 최초 진입 화면은 항상 홈(프로젝트 카드)
})();
