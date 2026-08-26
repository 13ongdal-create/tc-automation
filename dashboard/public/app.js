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
  chartExecStatus: document.getElementById('chartExecStatus'),
  chartDefectStatus: document.getElementById('chartDefectStatus'),
  execLegend: document.getElementById('execLegend'),
  defectLegend: document.getElementById('defectLegend'),
  homeTableBody: document.getElementById('homeTableBody'),
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

const STATUS_COLORS = {
  '신규': 'var(--warn)',
  '처리중': 'var(--primary)',
  '재검증대기': 'var(--accent2)',
  '완료': 'var(--good)',
  '보류': 'var(--text-secondary)',
  '재발생': 'var(--bad)',
};

// 실행결과 값(AGENTS.md 20-7항) 색상 — 결함현황(STATUS_COLORS)과 구분되는 팔레트
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

function renderLegend(el, order, labels, colors) {
  el.innerHTML = order
    .map(
      (k) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${colors[k]}"></span>${esc(labels[k])}
    </span>`
    )
    .join('');
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

  renderLegend(el.execLegend, EXEC_ORDER, EXEC_LABELS, EXEC_COLORS);
  renderLegend(el.defectLegend, STATUS_ORDER, Object.fromEntries(STATUS_ORDER.map((s) => [s, s])), STATUS_COLORS);
  renderExecStatusChart(rows);
  renderDefectStatusChart(rows);
  renderHomeTable(rows);
}

/** 프로젝트별 수행현황 — 하나의 누적(stacked) 막대에 Pass/Fail/Blocked/N/A/N/T/미실행 비율을 표시 */
function renderExecStatusChart(rows) {
  el.chartExecStatus.innerHTML = rows
    .map(({ project, kpi }) => {
      const r = kpi ? kpi.results : null;
      const total = r ? r.total : 0;
      if (!total) {
        return `
        <div class="stack-row" data-project="${esc(project)}">
          <div class="stack-label"><span class="stack-name">${esc(project)}</span><span class="stack-sub">실행 이력 없음</span></div>
          <div class="stack-track stack-track-empty"></div>
        </div>`;
      }
      const segs = EXEC_ORDER.map((k) => {
        const n = r[k] || 0;
        if (!n) return '';
        return `<div class="stack-seg" style="width:${(n / total) * 100}%;background:${EXEC_COLORS[k]}" title="${EXEC_LABELS[k]} ${n}건"></div>`;
      }).join('');
      const execRate = Math.round((r.executed / total) * 100);
      return `
      <div class="stack-row home-table-row" data-project="${esc(project)}">
        <div class="stack-label"><span class="stack-name">${esc(project)}</span><span class="stack-sub">${total}건 · 수행율 ${execRate}%</span></div>
        <div class="stack-track">${segs}</div>
      </div>`;
    })
    .join('');
}

/** 프로젝트별 결함현황 — 하나의 누적(stacked) 막대에 신규/처리중/재검증대기/완료/보류/재발생 비율을 표시 */
function renderDefectStatusChart(rows) {
  el.chartDefectStatus.innerHTML = rows
    .map(({ project, kpi }) => {
      const total = kpi ? kpi.defects.total : 0;
      if (!total) {
        return `
        <div class="stack-row" data-project="${esc(project)}">
          <div class="stack-label"><span class="stack-name">${esc(project)}</span><span class="stack-sub">등록된 결함 없음</span></div>
          <div class="stack-track stack-track-empty"></div>
        </div>`;
      }
      const counts = kpi.defects.counts;
      const segs = STATUS_ORDER.map((s) => {
        const n = counts[s] || 0;
        if (!n) return '';
        return `<div class="stack-seg" style="width:${(n / total) * 100}%;background:${STATUS_COLORS[s]}" title="${s} ${n}건"></div>`;
      }).join('');
      return `
      <div class="stack-row home-table-row" data-project="${esc(project)}">
        <div class="stack-label"><span class="stack-name">${esc(project)}</span><span class="stack-sub">결함 ${total}건 · 신규 ${counts['신규'] || 0}건</span></div>
        <div class="stack-track">${segs}</div>
      </div>`;
    })
    .join('');
}

function renderHomeTable(rows) {
  el.homeTableBody.innerHTML = rows
    .map(({ project, kpi }) => {
      const d = kpi ? kpi.defects : { total: 0, counts: {} };
      const r = kpi ? kpi.results : { pass: 0, fail: 0, total: 0, executed: 0, latestDate: null };
      const execRate = r.total ? Math.round((r.executed / r.total) * 100) + '%' : '–';
      const lastRun =
        r.latestDate && r.latestDate !== '00000000'
          ? `${r.latestDate.slice(0, 4)}-${r.latestDate.slice(4, 6)}-${r.latestDate.slice(6, 8)}`
          : '–';
      return `
    <tr class="home-table-row" data-project="${esc(project)}">
      <td class="home-table-name">${esc(project)}</td>
      <td>${d.total}</td>
      <td>${d.counts['신규'] || 0}</td>
      <td>${r.pass}</td>
      <td>${r.fail}</td>
      <td>${execRate}</td>
      <td>${lastRun}</td>
    </tr>`;
    })
    .join('');
}

el.homeTableBody.addEventListener('click', (e) => {
  const row = e.target.closest('.home-table-row');
  if (row) showProject(row.dataset.project);
});

[el.chartExecStatus, el.chartDefectStatus].forEach((container) => {
  container.addEventListener('click', (e) => {
    const row = e.target.closest('[data-project]');
    if (row) showProject(row.dataset.project);
  });
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
