const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

const el = {
  projectSelect: document.getElementById('projectSelect'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnLogout: document.getElementById('btnLogout'),
  btnHome: document.getElementById('btnHome'),
  homeView: document.getElementById('homeView'),
  projectView: document.getElementById('projectView'),
  projectCards: document.getElementById('projectCards'),
  btnNewProject: document.getElementById('btnNewProject'),
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
  el.projectSelect.innerHTML = projects.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const saved = localStorage.getItem('qdori.project');
  if (saved && projects.includes(saved)) el.projectSelect.value = saved;
  return el.projectSelect.value;
}

async function loadAll() {
  const project = el.projectSelect.value;
  if (!project) return;
  localStorage.setItem('qdori.project', project);
  await Promise.all([loadKpi(project), loadDefects(project), loadResults(project), loadChatHistory(project)]);
}

// ── 🏠 홈 (프로젝트 카드) ↔ 📁 프로젝트 상세 화면 전환 ─────────────────────
function showHome() {
  el.projectView.style.display = 'none';
  el.homeView.style.display = 'block';
  renderProjectCards();
}

function showProject(project) {
  if (!project) return showHome();
  el.projectSelect.value = project;
  el.homeView.style.display = 'none';
  el.projectView.style.display = 'block';
  loadAll();
}

async function renderProjectCards() {
  if (!allProjects.length) {
    el.projectCards.innerHTML = '<div class="empty-row">등록된 프로젝트가 없습니다. "+ 새 프로젝트"로 시작하세요.</div>';
    return;
  }
  el.projectCards.innerHTML = allProjects.map((p) => `<div class="empty-row" data-loading="${esc(p)}">${esc(p)} 불러오는 중…</div>`).join('');
  const kpis = await Promise.all(
    allProjects.map((p) =>
      fetch(`/api/${encodeURIComponent(p)}/kpi`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );
  const cardsHtml = allProjects
    .map((p, i) => {
      const k = kpis[i];
      const stats = k
        ? `
        <div class="pc-stats">
          <div class="pc-stat warn"><span class="n">${k.defects.counts['신규'] || 0}</span><span class="l">신규 결함</span></div>
          <div class="pc-stat"><span class="n">${k.results.pass}</span><span class="l">Pass</span></div>
          <div class="pc-stat bad"><span class="n">${k.results.fail}</span><span class="l">Fail</span></div>
          <div class="pc-stat"><span class="n">${k.results.total ? Math.round((k.results.executed / k.results.total) * 100) + '%' : '–'}</span><span class="l">수행율</span></div>
        </div>`
        : '<div class="pc-stats"><span class="l">데이터 없음</span></div>';
      return `<button type="button" class="project-card" data-project="${esc(p)}"><div class="pc-name">${esc(p)}</div>${stats}</button>`;
    })
    .join('');
  el.projectCards.innerHTML = cardsHtml + '<button type="button" id="btnNewProjectCard" class="project-card-new">+ 새 프로젝트</button>';
}

el.projectCards.addEventListener('click', (e) => {
  const newBtn = e.target.closest('#btnNewProjectCard');
  if (newBtn) return openNewProjectModal();
  const card = e.target.closest('.project-card');
  if (card) showProject(card.dataset.project);
});

el.btnHome.addEventListener('click', showHome);

el.btnRefresh.addEventListener('click', () => {
  if (el.projectView.style.display === 'none') renderProjectCards();
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
