// TC 목록 창 — "실패 TC 보기" / "미수행 TC" 등 실행결과별 TC 단위 목록.
// 기준은 TC 정본(모듈별 JSON)의 현재 실행결과라서 KPI·TC 뷰어 통계와 같은 집합입니다.
// 모듈 단위 표(모듈별 수행현황)와 달리 실제 TC(ID·테스트 항목·중요도·연결 결함)를 한 줄씩 보여줍니다.
// project-detail.js(PD, pdEl, pdIco, pdShortId …)와 app.js(esc, TC_PRIORITY_LABELS …)가 먼저 로드되어 있어야 합니다.
'use strict';

const TL_RESULTS = {
  Fail: {
    title: '실패 TC',
    desc: '현재 실행결과가 Fail인 TC입니다(TC 정본 기준 — TC 뷰어의 Fail과 같은 집합). 연결된 결함이 없는 TC는 "결함 미등록"으로 표시됩니다.',
  },
  none: { title: '미수행 TC', desc: '아직 실행결과가 기록되지 않은 TC입니다.' },
  Pass: { title: 'Pass TC', desc: '절차대로 수행한 결과가 기대결과와 일치한 TC입니다.' },
  'N/T': { title: 'N/T TC', desc: '수행은 가능하지만 이미 등록된 다른 결함 때문에 Pass/Fail 판정이 불가한 TC입니다. 그 결함이 해결되면 재실행합니다.' },
  'N/A': { title: 'N/A TC', desc: '현재 조건에서 적용 대상이 아니거나, 선행 조건·환경 미비로 수행할 수 없는 TC입니다.' },
};
const TL_PAGE = 30;

const TL = { result: 'Fail', items: [], module: '', prio: '', q: '', shown: TL_PAGE, seq: 0, loaded: false };

function tlSyncControls() {
  pdEl('tcListResult').value = TL.result;
  pdEl('tcListModule').value = TL.module;
  pdEl('tcListPrio').value = TL.prio;
  pdEl('tcListSearch').value = TL.q;
}

function tlFillModules() {
  const sel = pdEl('tcListModule');
  sel.innerHTML = '<option value="">전체 모듈</option>' + PD.rows.map((r) => `<option value="${esc(r.code)}">${esc(r.name)}</option>`).join('');
  sel.value = PD.rows.some((r) => r.code === TL.module) ? TL.module : '';
  TL.module = sel.value;
}

async function pdOpenTcList(result) {
  TL.result = TL_RESULTS[result] ? result : 'Fail';
  TL.module = '';
  TL.prio = '';
  TL.q = '';
  TL.shown = TL_PAGE;
  tlFillModules();
  tlSyncControls();
  pdEl('tcListModal').hidden = false;
  pdHydrateIcons(pdEl('tcListModal'));
  await tlLoad();
}

async function tlLoad() {
  const seq = ++TL.seq;
  const meta = TL_RESULTS[TL.result];
  pdEl('tcListTitle').textContent = meta.title;
  pdEl('tcListDesc').textContent = meta.desc;
  pdEl('tcListCount').textContent = '';
  pdEl('tcListBody').innerHTML = '<div class="pd-empty-sm">불러오는 중…</div>';
  TL.loaded = false;
  try {
    const res = await fetch(`/api/${encodeURIComponent(PD.project)}/tcs?result=${encodeURIComponent(TL.result)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'TC 목록을 불러오지 못했습니다.');
    if (seq !== TL.seq) return; // 그 사이 다른 조건으로 다시 요청됨
    TL.items = data.items || [];
    TL.loaded = true;
    tlRender();
  } catch (err) {
    if (seq !== TL.seq) return;
    pdEl('tcListBody').innerHTML = `<div class="pd-empty-sm pd-bad">${esc(err.message)}</div>`;
  }
}

function tlFiltered() {
  const q = TL.q.trim().toLowerCase();
  return TL.items.filter((t) => {
    if (TL.module && t.moduleCode !== TL.module) return false;
    if (TL.prio && t.priority !== TL.prio) return false;
    if (q && !`${t.tcId} ${t.item} ${t.majorCategory} ${t.midCategory} ${t.minorCategory} ${t.moduleName}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function tlDefectChips(t) {
  if (!t.defects.length) {
    // 실패했는데 연결된 결함이 없으면 아직 분류(결함 등록)되지 않은 건 — 눈에 띄게 표시
    return TL.result === 'Fail' ? '<span class="pd-untriaged">결함 미등록</span>' : '<span class="pd-muted">-</span>';
  }
  return t.defects.map((d) => `<span class="pd-chip" title="${esc(d.defectId)}">${esc(pdShortId(d.defectId))}
    <span class="pd-sev pd-sev-sm pd-sev-${esc(d.severity)}">${esc(d.severity)}</span><small>${esc(d.status)}</small></span>`).join('');
}

function tlRow(t, withRun) {
  const enc = encodeURIComponent(PD.project);
  const id = t.viewerFile
    ? `<a href="/project-files/${enc}/TC/${encodeURIComponent(t.viewerFile)}" target="_blank" rel="noopener" title="${esc(t.moduleName)} TC 뷰어 열기">${esc(t.tcId)}</a>`
    : esc(t.tcId);
  const cat = [t.majorCategory, t.midCategory].filter(Boolean).join(' › ');
  const prio = t.priority ? `<span class="pd-tcp pd-tcp-${esc(t.priority)}">${esc(TC_PRIORITY_LABELS[t.priority] || t.priority)}</span>` : '<span class="pd-muted">-</span>';
  return `<tr>
    <td class="pd-mono pd-tl-id">${id}</td>
    <td class="pd-tl-mod">${esc(t.moduleName)}</td>
    <td class="pd-tl-cat" title="${esc([t.majorCategory, t.midCategory, t.minorCategory].filter(Boolean).join(' › '))}">${esc(cat)}</td>
    <td class="pd-tl-item" title="${esc(t.item)}">${esc(t.item)}</td>
    <td>${prio}</td>
    ${withRun ? `<td class="pd-mono pd-muted">${esc(t.lastRun || '-')}</td><td>${tlDefectChips(t)}</td>` : ''}
  </tr>`;
}

function tlRender() {
  const body = pdEl('tcListBody');
  const all = TL.items.length;
  const list = tlFiltered();
  pdEl('tcListCount').textContent = list.length === all ? `${all}건` : `${list.length}건 / 전체 ${all}건`;
  if (!all) {
    body.innerHTML = `<div class="pd-empty-sm">${TL.result === 'Fail' ? '실패한 TC가 없습니다.' : '해당하는 TC가 없습니다.'}</div>`;
    return;
  }
  if (!list.length) {
    body.innerHTML = '<div class="pd-empty-sm">조건에 맞는 TC가 없습니다.</div>';
    return;
  }
  const withRun = TL.result !== 'none'; // 미수행 TC는 실행일·연결 결함이 의미 없음
  const shown = list.slice(0, TL.shown);
  const rest = list.length - shown.length;
  body.innerHTML = `<div class="table-wrap pd-tl-wrap"><table class="pd-table pd-tl-table">
    <thead><tr><th>TC ID</th><th>모듈</th><th>분류</th><th>테스트 항목</th><th>TC 중요도</th>${withRun ? '<th>최근 실행</th><th>연결 결함</th>' : ''}</tr></thead>
    <tbody>${shown.map((t) => tlRow(t, withRun)).join('')}</tbody></table></div>
    ${rest > 0 ? `<div class="pd-more"><button type="button" class="pd-btn pd-btn-outline pd-btn-sm" id="tcListMore">더보기 (${rest}건 더)</button></div>` : ''}`;
}

function tlSetFilter(partial) {
  Object.assign(TL, partial, { shown: TL_PAGE });
  if (TL.loaded) tlRender();
}

function tlClose() { pdEl('tcListModal').hidden = true; }

pdEl('tcListResult').addEventListener('change', (e) => { TL.result = e.target.value; TL.shown = TL_PAGE; tlLoad(); });
pdEl('tcListModule').addEventListener('change', (e) => tlSetFilter({ module: e.target.value }));
pdEl('tcListPrio').addEventListener('change', (e) => tlSetFilter({ prio: e.target.value }));
pdEl('tcListSearch').addEventListener('input', (e) => tlSetFilter({ q: e.target.value }));
pdEl('tcListBody').addEventListener('click', (e) => {
  if (e.target.closest('#tcListMore')) { TL.shown += TL_PAGE; tlRender(); }
});
pdEl('btnCloseTcList').addEventListener('click', tlClose);
pdEl('tcListModal').addEventListener('click', (e) => { if (e.target === pdEl('tcListModal')) tlClose(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pdEl('tcListModal').hidden) tlClose(); });
