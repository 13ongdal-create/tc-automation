const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

const el = {
  projectSelect: document.getElementById('projectSelect'),
  btnRefresh: document.getElementById('btnRefresh'),
  kpiTotalDefects: document.getElementById('kpiTotalDefects'),
  kpiNewDefects: document.getElementById('kpiNewDefects'),
  kpiPass: document.getElementById('kpiPass'),
  kpiFail: document.getElementById('kpiFail'),
  kpiExecRate: document.getElementById('kpiExecRate'),
  defectTableBody: document.getElementById('defectTableBody'),
  resultsList: document.getElementById('resultsList'),
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadProjects() {
  const res = await fetch('/api/projects');
  const { projects } = await res.json();
  el.projectSelect.innerHTML = projects.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const saved = localStorage.getItem('qdori.project');
  if (saved && projects.includes(saved)) el.projectSelect.value = saved;
  return el.projectSelect.value;
}

async function loadAll() {
  const project = el.projectSelect.value;
  if (!project) return;
  localStorage.setItem('qdori.project', project);
  await Promise.all([loadKpi(project), loadDefects(project), loadResults(project)]);
}

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

el.projectSelect.addEventListener('change', loadAll);
el.btnRefresh.addEventListener('click', loadAll);

(async function init() {
  await loadProjects();
  await loadAll();
})();
