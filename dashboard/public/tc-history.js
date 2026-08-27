function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const params = new URLSearchParams(location.search);
const project = params.get('project') || '';
const el = {
  pageTitle: document.getElementById('pageTitle'),
  historyBody: document.getElementById('historyBody'),
};

const PAGE_SIZE = 10;
let shown = PAGE_SIZE;
let allHistory = [];

function renderRows() {
  if (!allHistory.length) {
    el.historyBody.innerHTML = '<div class="empty-row">변경 이력이 없습니다</div>';
    return;
  }
  const visible = allHistory.slice(0, shown);
  const remaining = allHistory.length - visible.length;
  const rowsHtml = visible
    .map(
      (h) => `
    <tr>
      <td>${esc(h.date || '')}</td>
      <td class="pb-module-name">${esc(h.moduleName)}</td>
      <td>v${h.version}</td>
      <td>${esc(h.summary || '')}</td>
    </tr>`
    )
    .join('');
  const moreHtml =
    remaining > 0
      ? `<div class="list-more-row"><button type="button" class="btn btn-outline btn-sm" id="btnMore">더보기 (${remaining}건 더)</button></div>`
      : '';
  el.historyBody.innerHTML = `
    <table class="pb-module-table">
      <thead><tr><th style="width:11%">날짜</th><th style="width:14%">모듈</th><th style="width:7%">버전</th><th>변경 요약</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>${moreHtml}`;
  const btn = document.getElementById('btnMore');
  if (btn) btn.addEventListener('click', () => { shown += PAGE_SIZE; renderRows(); });
}

(async function init() {
  if (!project) {
    el.historyBody.innerHTML = '<span class="placeholder-text">프로젝트 정보가 없습니다.</span>';
    return;
  }
  el.pageTitle.textContent = `${project} — TC 변경 이력`;
  try {
    const res = await fetch(`/api/${encodeURIComponent(project)}/kpi`);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    allHistory = data.tcChangeHistory || [];
  } catch {
    el.historyBody.innerHTML = '<span class="placeholder-text">변경 이력을 불러오지 못했습니다.</span>';
    return;
  }
  renderRows();
})();
