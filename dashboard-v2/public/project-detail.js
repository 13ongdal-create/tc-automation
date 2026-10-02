// 프로젝트 상세 화면(v2 신규 디자인) — 렌더링 + 필터 + 상호작용.
// app.js(먼저 로드됨)의 전역 el/esc/donutChart/STATUS_ORDER/SEVERITY_*/openManageProjectModal 등을 그대로 사용합니다.
// 채팅·테스트 실행 큐·TC 업로드·재생 모달 로직은 4000과 동일한 app.js 코드를 재사용하고,
// 이 파일은 "화면에 어떻게 보여주느냐"만 담당합니다.
'use strict';

const PD_ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  playc: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
  bug: '<path d="M8 8a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0z"/><path d="M12 8v10M4 13h4M16 13h4M5 7l3 2M19 7l-3 2M5 20l3-2M19 20l-3-2"/>',
  report: '<path d="M5 3h14v18H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  clip: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z"/>',
  rocket: '<path d="M5 15c-1 1-2 4-2 6 2 0 5-1 6-2M14 4c4-1 6-1 6-1s0 2-1 6l-6 6-5-5z"/><circle cx="15" cy="9" r="1.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
};

function pdIco(name, size) {
  const s = size || 18;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PD_ICONS[name] || ''}</svg>`;
}

function pdHydrateIcons(root) {
  (root || document).querySelectorAll('[data-ico]').forEach((n) => {
    if (n.dataset.icoDone) return;
    n.innerHTML = pdIco(n.dataset.ico);
    n.dataset.icoDone = '1';
  });
}

// ── 상태 ─────────────────────────────────────────────────────────────────
const PD_PAGE_DEFECTS = 8;
const PD_PAGE_RUNS = 5;
const PD_EXAMPLES = [
  '로그인·회원가입 기능에 대한 TC를 생성해줘',
  '주문/결제 프로세스의 예외·부정 시나리오 TC를 만들어줘',
  '검색 기능의 경계값(빈 값, 특수문자, 긴 문자열) TC를 추가해줘',
  '지금까지 실패한 TC의 원인을 정리해줘',
];

const PD = {
  project: null,
  meta: null,
  kpi: null,
  defects: [],
  snaps: [],
  rows: [], // 모듈 병합 행(TC 정본 + 최신 실행 스냅샷)
  f: { module: '', priority: '', runStatus: '', result: '', q: '' },
  d: { module: '', severity: '', status: '', q: '' },
  defShown: PD_PAGE_DEFECTS,
  runShown: PD_PAGE_RUNS,
  seq: 0,
  exampleIdx: 0,
};

const pdEl = (id) => document.getElementById(id);
const pdPct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const pdSafeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : '');

// ── 데이터 로딩 ──────────────────────────────────────────────────────────
function pdResetState(project) {
  PD.project = project;
  PD.f = { module: '', priority: '', runStatus: '', result: '', q: '' };
  PD.d = { module: '', severity: '', status: '', q: '' };
  PD.defShown = PD_PAGE_DEFECTS;
  PD.runShown = PD_PAGE_RUNS;
  PD.kpi = null;
  PD.meta = null;
  PD.defects = [];
  PD.snaps = [];
  PD.rows = [];
  pdSyncControls();
  pdEl('pdKpis').innerHTML = '<div class="pd-skeleton"></div>'.repeat(5);
  ['pdOnboard', 'pdAttention'].forEach((id) => { pdEl(id).hidden = true; });
}

async function loadProjectDetail(project) {
  if (PD.project !== project) pdResetState(project);
  await refreshProjectDetail(project);
}

async function refreshProjectDetail(project) {
  const seq = ++PD.seq;
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const enc = encodeURIComponent(project);
  const [kpi, meta, defs, runs] = await Promise.all([
    get(`/api/${enc}/kpi`), get(`/api/${enc}/meta`), get(`/api/${enc}/defects`), get(`/api/${enc}/results`),
  ]);
  if (seq !== PD.seq || el.projectSelect.value !== project) return; // 그 사이 다른 프로젝트로 이동
  PD.kpi = kpi;
  PD.meta = meta;
  PD.defects = defs ? defs.defects || [] : [];
  PD.snaps = runs ? runs.snapshots || [] : [];
  pdRenderAll();
}

/** TC 정본(모듈별 JSON)과 최신 실행 스냅샷을 모듈 단위로 합칩니다 — 아직 한 번도 실행하지 않은 모듈도 행으로 보이게. */
function pdBuildRows() {
  const snaps = new Map(((PD.kpi.results && PD.kpi.results.byModule) || []).map((m) => [m.moduleCode, m]));
  const canon = PD.kpi.tcPriorityByModule || [];
  const seen = new Set();
  const rows = canon.map((c) => {
    seen.add(c.moduleCode);
    const s = snaps.get(c.moduleCode);
    const total = c.total;
    const executed = s ? Math.min(s.executed, total) : 0;
    return {
      code: c.moduleCode, name: c.moduleName, total, executed,
      pass: s ? s.pass : 0, fail: s ? s.fail : 0, na: s ? s.na : 0, nt: s ? s.nt : 0,
      none: Math.max(total - executed, 0), P1: c.P1, P2: c.P2, P3: c.P3,
    };
  });
  snaps.forEach((s, code) => {
    if (seen.has(code)) return; // 정본 없는 스냅샷 전용 모듈
    rows.push({
      code, name: s.moduleName, total: s.total, executed: s.executed, pass: s.pass, fail: s.fail, na: s.na, nt: s.nt,
      none: Math.max(s.total - s.executed, 0), P1: s.p1 || 0, P2: s.p2 || 0, P3: s.p3 || 0,
    });
  });
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

function pdTotals() {
  const t = { total: 0, executed: 0, pass: 0, fail: 0, none: 0, P1: 0, P2: 0, P3: 0 };
  PD.rows.forEach((r) => { Object.keys(t).forEach((k) => { t[k] += r[k] || 0; }); });
  const defectsTotal = PD.defects.length;
  const openCritical = PD.defects.filter((d) => normSeverity(d.severity) === 'Critical' && d.status !== '완료').length;
  return { ...t, defectsTotal, openCritical };
}

// 결함 1건에 관련 TC가 여러 개(tcIds)일 수 있음 — tcIds가 없는 기존 레코드는 [tcId]로 간주
const pdDefectTcIds = (d) => (Array.isArray(d.tcIds) && d.tcIds.length ? d.tcIds : [d.tcId]).filter(Boolean);
const pdDefectModuleCodes = (d) => [...new Set(pdDefectTcIds(d).map((id) => {
  const m = /^TC_([A-Za-z]+)_/.exec(id || '');
  return m ? m[1].toUpperCase() : '';
}).filter(Boolean))];

// ── 렌더링 ───────────────────────────────────────────────────────────────
function pdRenderAll() {
  if (!PD.kpi) {
    pdEl('pdKpis').innerHTML = '<div class="pd-card pd-error">프로젝트 데이터를 불러오지 못했습니다. 새로고침해 주세요.</div>';
    return;
  }
  el.projectDetailTitle.textContent = dispName(PD.project);
  PD.rows = pdBuildRows();
  const t = pdTotals();
  const isNew = t.total === 0;
  pdEl('pdRail').hidden = isNew;
  pdEl('pdTop').dataset.mode = isNew ? 'new' : 'existing';
  pdRenderHead(t, isNew);
  pdRenderKpis(t);
  pdRenderOnboard(isNew);
  pdRenderAttention(t, isNew);
  pdFillModuleOptions();
  pdRenderFiltered();
  pdRenderLinks();
  pdHydrateIcons();
}

/** 필터가 바뀔 때 다시 그리는 영역(KPI/헤더는 프로젝트 전체 기준이라 제외). */
function pdRenderFiltered() {
  if (!PD.kpi) return;
  pdRenderModules();
  pdRenderPriority();
  pdRenderDefects();
  pdRenderRuns();
  pdRefreshRunStatusCounts();
  const anyF = Object.values(PD.f).some(Boolean) || Object.values(PD.d).some(Boolean);
  pdEl('pdFReset').hidden = !anyF;
  pdHydrateIcons();
}

function pdLatestRunLabel() {
  const s = PD.snaps[0];
  if (!s) return '<span class="pd-unset">실행 이력이 없습니다.</span>';
  const ok = s.fail === 0;
  return `${esc(s.dateFmt)} <span class="${ok ? 'pd-good' : 'pd-bad'}">(${ok ? '성공' : `Fail ${s.fail}`})</span>`;
}

function pdUrlItem(label, ico, url) {
  const safe = pdSafeUrl(url);
  if (!safe) {
    return `<span class="pd-meta-item"><span class="pd-meta-ico">${pdIco(ico, 16)}</span><span class="pd-meta-k">${label}</span><span class="pd-unset">미설정</span><button type="button" class="pd-link-btn" data-pd-act="manage">설정</button></span>`;
  }
  return `<span class="pd-meta-item"><span class="pd-meta-ico">${pdIco(ico, 16)}</span><span class="pd-meta-k">${label}</span><a href="${esc(safe)}" target="_blank" rel="noopener">${esc(safe)}</a>
    <button type="button" class="pd-mini" data-pd-copy="${esc(safe)}" title="URL 복사" aria-label="${label} 복사">${pdIco('copy', 14)}</button></span>`;
}

function pdRenderHead(t, isNew) {
  pdEl('pdStatusBadge').textContent = isNew ? '프로젝트 생성됨' : '운영중';
  pdEl('pdStatusBadge').className = `pd-status ${isNew ? 'is-new' : 'is-live'}`;
  const m = PD.meta || {};
  pdEl('pdMeta').innerHTML =
    pdUrlItem('사용자 URL', 'link', m.url) +
    pdUrlItem('관리자 URL', 'lock', m.adminUrl) +
    `<span class="pd-meta-item"><span class="pd-meta-ico">${pdIco('clock', 16)}</span><span class="pd-meta-k">최근 실행</span>${pdLatestRunLabel()}</span>` +
    `<span class="pd-meta-item"><span class="pd-meta-ico">${pdIco('tag', 16)}</span><span class="pd-meta-k">테스트 유형</span>${m.testType ? esc(m.testType) : '<span class="pd-unset">미지정</span>'}</span>`;
}

function pdKpiCard({ ico, tone, label, value, sub, bar }) {
  const barHtml = bar == null ? '' : `<div class="pd-bar"><i class="tone-${tone}" style="width:${Math.min(bar, 100)}%"></i></div>`;
  return `<div class="pd-kpi">
    <span class="pd-kpi-ico tone-${tone}">${pdIco(ico, 22)}</span>
    <div class="pd-kpi-body"><div class="pd-kpi-label">${label}</div><div class="pd-kpi-value">${value}</div><div class="pd-kpi-sub">${sub}</div></div>
    ${barHtml}
  </div>`;
}

function pdRenderKpis(t) {
  const hasTc = t.total > 0;
  const hasRun = t.executed > 0;
  const hasDef = t.defectsTotal > 0;
  pdEl('pdKpis').innerHTML = [
    pdKpiCard({ ico: 'file', tone: 'blue', label: '전체 TC', value: t.total, sub: hasTc ? `모듈 ${PD.rows.length}개` : '생성된 TC가 없습니다.', bar: hasTc ? 100 : 0 }),
    pdKpiCard({ ico: 'pie', tone: 'blue', label: '수행률', value: hasTc ? `${pdPct(t.executed, t.total)}%` : '-', sub: hasTc ? `${t.executed} / ${t.total}` : '실행된 TC가 없습니다.', bar: hasTc ? pdPct(t.executed, t.total) : 0 }),
    pdKpiCard({ ico: 'check', tone: 'green', label: 'Pass율', value: hasRun ? `${pdPct(t.pass, t.executed)}%` : '-', sub: hasRun ? `${t.pass} / ${t.executed}` : '실행된 TC가 없습니다.', bar: hasRun ? pdPct(t.pass, t.executed) : 0 }),
    pdKpiCard({ ico: 'x', tone: 'red', label: 'Fail', value: t.fail, sub: hasTc ? `전체 TC의 ${pdPct(t.fail, t.total)}%` : '실행된 TC가 없습니다.', bar: hasTc ? pdPct(t.fail, t.total) : 0 }),
    pdKpiCard({ ico: 'alert', tone: 'red', label: 'Critical 결함', value: t.openCritical, sub: hasDef ? `미해결 · 전체 결함의 ${pdPct(t.openCritical, t.defectsTotal)}%` : '등록된 결함이 없습니다.', bar: hasDef ? pdPct(t.openCritical, t.defectsTotal) : 0 }),
  ].join('');
}

function pdRenderOnboard(isNew) {
  const box = pdEl('pdOnboard');
  box.hidden = !isNew;
  if (!isNew) return;
  const hasUrl = !!pdSafeUrl((PD.meta || {}).url);
  const step = (n, ico, title, desc, act, done) => `
    <button type="button" class="pd-step${done ? ' is-done' : ''}" data-pd-act="${act}">
      <span class="pd-step-ico">${pdIco(done ? 'check' : ico, 22)}</span>
      <span class="pd-step-text"><b>${n}. ${title}</b><span>${desc}</span></span>
      <span class="pd-step-go">${pdIco('chevron', 18)}</span>
    </button>`;
  box.innerHTML = `
    <div class="pd-onboard-head">
      <span class="pd-hero-ico">${pdIco('rocket', 36)}</span>
      <div class="pd-onboard-title"><h2>지금부터 테스트 자동화를 시작해보세요</h2><p>아래 단계에 따라 사이트를 분석하고, 테스트 케이스를 생성한 후 실행해보세요.</p></div>
      <div class="pd-onboard-actions">
        <button type="button" class="pd-btn pd-btn-primary pd-btn-lg" data-pd-act="analyze">사이트 분석 시작${pdIco('arrow', 16)}</button>
        <button type="button" class="pd-btn pd-btn-lg" disabled>테스트 실행${pdIco('arrow', 16)}</button>
      </div>
    </div>
    <div class="pd-steps">
      ${step(1, 'link', '사이트 정보 등록', '테스트할 사이트의 URL을<br>등록하고 분석을 시작하세요.', 'manage', hasUrl)}
      ${step(2, 'file', '테스트 케이스 생성', 'AI가 사이트를 분석하여<br>테스트 케이스를 자동으로 생성합니다.', 'chat', false)}
      ${step(3, 'playc', '테스트 실행', '생성된 테스트 케이스를 실행하여<br>품질을 검증하세요.', 'run', false)}
    </div>`;
}

function pdRenderAttention(t, isNew) {
  const box = pdEl('pdAttention');
  box.hidden = isNew;
  if (isNew) return;
  const failMods = PD.rows.filter((r) => r.fail > 0).sort((a, b) => b.fail - a.fail);
  const flagged = t.fail > 0 || t.openCritical > 0 || t.none > 0;
  if (!flagged) {
    box.className = 'pd-card pd-attention is-clear';
    box.innerHTML = `<div class="pd-attn-head"><span class="pd-hero-ico tone-green">${pdIco('check', 28)}</span>
      <div><h2>확인이 필요한 항목이 없습니다</h2><p>모든 TC가 수행되었고 실패·미해결 Critical 결함이 없습니다.</p></div></div>`;
    return;
  }
  box.className = 'pd-card pd-attention';
  const tile = (ico, tone, label, value, sub, act) => `
    <button type="button" class="pd-attn-tile" data-pd-act="${act}">
      <span class="pd-attn-ico tone-${tone}">${pdIco(ico, 22)}</span>
      <span class="pd-attn-body"><span class="pd-attn-label">${label}</span><b>${value}</b><span class="pd-attn-sub">${sub}</span></span>
      <span class="pd-step-go">${pdIco('chevron', 18)}</span>
    </button>`;
  const modNames = failMods.slice(0, 3).map((m) => esc(m.name)).join(', ') + (failMods.length > 3 ? ` 외 ${failMods.length - 3}` : '');
  box.innerHTML = `
    <div class="pd-attn-head">
      <span class="pd-hero-ico tone-red">${pdIco('alert', 28)}</span>
      <div class="pd-onboard-title"><h2>지금 확인이 필요한 항목</h2><p>테스트 결과에서 즉시 조치가 필요한 항목입니다.</p></div>
      <div class="pd-onboard-actions">
        <button type="button" class="pd-btn pd-btn-outline" data-pd-act="view-tcs-fail"${t.fail ? '' : ' disabled'}>실패 TC 보기${pdIco('arrow', 16)}</button>
        <button type="button" class="pd-btn pd-btn-primary" data-pd-act="defects-critical">결함 보기${pdIco('arrow', 16)}</button>
      </div>
    </div>
    <div class="pd-attn-grid">
      ${tile('x', 'red', '실패 TC', t.fail, `전체 TC의 ${pdPct(t.fail, t.total)}%`, 'view-tcs-fail')}
      ${tile('alert', 'red', 'Critical 결함', t.openCritical, t.defectsTotal ? `미해결 · 전체 결함의 ${pdPct(t.openCritical, t.defectsTotal)}%` : '등록된 결함 없음', 'defects-critical')}
      ${tile('clock', 'gray', '미수행 TC', t.none, `전체 TC의 ${pdPct(t.none, t.total)}%`, 'view-tcs-none')}
      ${tile('layers', 'gray', '최근 실패 모듈', failMods.length, failMods.length ? modNames : '실패한 모듈 없음', 'filter-fail')}
    </div>`;
}

function pdFillModuleOptions() {
  const opts = '<option value="">전체 모듈</option>' + PD.rows.map((r) => `<option value="${esc(r.code)}">${esc(r.name)}</option>`).join('');
  ['pdFModule', 'pdDModule'].forEach((id) => {
    const sel = pdEl(id);
    const cur = sel.value;
    sel.innerHTML = opts;
    sel.value = PD.rows.some((r) => r.code === cur) ? cur : '';
  });
  const st = pdEl('pdDStatus');
  if (st.options.length <= 1) {
    st.innerHTML = '<option value="">전체 상태</option><option value="__open">미해결 (완료 제외)</option>' + STATUS_ORDER.map((s) => `<option value="${s}">${s}</option>`).join('');
  }
  pdSyncControls();
}

/** 모듈의 수행 상태 — 수행 완료: 전부 수행 / 진행 중: 일부만 수행 / 미수행: 한 건도 수행 안 함 */
function pdRunStatusOf(r) {
  if (r.executed <= 0) return 'none';
  return r.executed >= r.total ? 'done' : 'progress';
}

function pdFilteredRows(skipRunStatus) {
  const f = PD.f;
  const q = f.q.trim().toLowerCase();
  return PD.rows.filter((r) => {
    if (f.module && r.code !== f.module) return false;
    if (!skipRunStatus && f.runStatus && pdRunStatusOf(r) !== f.runStatus) return false;
    if (f.result === 'pass' && !(r.pass > 0)) return false;
    if (f.result === 'fail' && !(r.fail > 0)) return false;
    if (f.result === 'none' && !(r.none > 0)) return false;
    if (q && !`${r.name} ${r.code}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** "수행 상태" 옵션마다 현재 다른 필터 기준 모듈 수를 붙이고, 0건이면 비활성화해 선택해도 빈 화면이 되는 일을 막습니다. */
function pdRefreshRunStatusCounts() {
  const base = pdFilteredRows(true);
  const counts = { done: 0, progress: 0, none: 0 };
  base.forEach((r) => { counts[pdRunStatusOf(r)] += 1; });
  const labels = { '': '전체 수행 상태', done: '수행 완료', progress: '진행 중', none: '미수행' };
  Array.from(pdEl('pdFRunStatus').options).forEach((o) => {
    if (!o.value) { o.textContent = `${labels[''] } (${base.length})`; return; }
    o.textContent = `${labels[o.value]} (${counts[o.value]})`;
    o.disabled = counts[o.value] === 0 && PD.f.runStatus !== o.value;
  });
}

function pdEmptyBlock(ico, title, desc, btn) {
  return `<div class="pd-empty"><span class="pd-empty-ico">${pdIco(ico, 44)}</span><b>${title}</b><span>${desc}</span>${btn || ''}</div>`;
}

function pdRenderModules() {
  const body = pdEl('pdModuleBody');
  const viewer = PD.kpi.viewerFile;
  const v = viewer ? `/project-files/${encodeURIComponent(PD.project)}/TC/${encodeURIComponent(viewer)}` : '';
  const detail = pdEl('tcDetailLink');
  detail.hidden = !viewer;
  if (viewer) detail.href = v;
  const foot = pdEl('pdModuleFoot');
  foot.innerHTML = viewer && (PD.kpi.tcChangeHistory || []).length
    ? `<a href="/tc-history.html?project=${encodeURIComponent(PD.project)}" target="_blank" rel="noopener">TC 변경 이력 보기 ${pdIco('arrow', 14)}</a>`
    : '';

  if (!PD.rows.length) {
    body.innerHTML = pdEmptyBlock('file', '아직 생성된 테스트 케이스가 없습니다.', '사이트를 분석하여 모듈별로 테스트 케이스를 생성해보세요.',
      '<button type="button" class="pd-btn pd-btn-primary" data-pd-act="chat">TC 생성하기' + pdIco('arrow', 16) + '</button>');
    return;
  }
  const rows = pdFilteredRows();
  if (!rows.length) {
    body.innerHTML = '<div class="pd-empty-sm">조건에 맞는 모듈이 없습니다.</div>';
    return;
  }
  const tr = rows.map((r) => {
    const pPass = pdPct(r.pass, r.total);
    const pFail = pdPct(r.fail, r.total);
    const pOther = Math.max(r.executed - r.pass - r.fail, 0); // N/A, N/T 등 Pass/Fail이 아닌 수행분
    const pNa = pdPct(pOther, r.total);
    const execRate = pdPct(r.executed, r.total);
    return `<tr>
      <td class="pd-mod-name">${esc(r.name)}</td>
      <td class="num">${r.total}</td>
      <td class="num">${execRate}%</td>
      <td class="pd-bar-cell"><div class="pd-stack" title="Pass ${r.pass} · Fail ${r.fail} · 기타 수행 ${pOther} · 미수행 ${r.none}">
        <i class="s-pass" style="width:${pPass}%"></i><i class="s-fail" style="width:${pFail}%"></i><i class="s-na" style="width:${pNa}%"></i></div></td>
      <td class="num pd-good">${r.pass}</td>
      <td class="num ${r.fail ? 'pd-bad' : ''}">${r.fail}</td>
      <td class="num pd-muted">${r.none}</td>
      <td class="pd-chev">${v ? `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${esc(r.name)} TC 보기">${pdIco('chevron', 16)}</a>` : ''}</td>
    </tr>`;
  }).join('');
  body.innerHTML = `<div class="table-wrap"><table class="pd-table">
    <thead><tr><th>모듈명</th><th class="num">전체 TC</th><th class="num">수행률</th>
      <th class="pd-legend-th"><span class="pd-lg"><i class="s-pass"></i>Pass</span><span class="pd-lg"><i class="s-fail"></i>Fail</span><span class="pd-lg"><i class="s-na"></i>기타</span><span class="pd-lg"><i class="s-none"></i>미수행</span></th>
      <th class="num">Pass</th><th class="num">Fail</th><th class="num">미수행</th><th></th></tr></thead>
    <tbody>${tr}</tbody></table></div>`;
}

function pdRenderPriority() {
  const f = PD.f;
  const scope = PD.rows.filter((r) => !f.module || r.code === f.module);
  const tot = { P1: 0, P2: 0, P3: 0 };
  let executed = 0;
  let total = 0;
  scope.forEach((r) => { tot.P1 += r.P1; tot.P2 += r.P2; tot.P3 += r.P3; executed += r.executed; total += r.total; });
  const sum = tot.P1 + tot.P2 + tot.P3;
  const segments = TC_PRIORITY_ORDER.map((k) => ({
    n: tot[k], color: f.priority && f.priority !== k ? 'var(--divider)' : TC_PRIORITY_COLORS[k],
  }));
  const center = `<span class="donut-total">${sum}</span><span class="donut-total-label">전체 TC</span>`;
  const legend = TC_PRIORITY_ORDER.map((k) => `
    <div class="pd-lg-row${f.priority && f.priority !== k ? ' is-dim' : ''}">
      <span class="pd-sw" style="background:${TC_PRIORITY_COLORS[k]}"></span><span>${esc(TC_PRIORITY_LABELS[k])}</span><b>${tot[k]}</b><span class="pd-muted">${pdPct(tot[k], sum)}%</span>
    </div>`).join('');
  const none = Math.max(total - executed, 0);
  pdEl('pdPriorityBody').innerHTML = `
    <div class="pd-donut-row"><div class="pd-donut">${donutChart(segments, center, '등록된 TC 없음')}</div><div class="pd-legend">${legend}</div></div>
    <div class="pd-mini-tiles">
      <div class="pd-mini-tile"><span class="pd-kpi-ico tone-blue">${pdIco('file', 20)}</span><div><b>${executed}</b><span>수행된 TC</span><small>전체의 ${total ? pdPct(executed, total) + '%' : '-'}</small></div></div>
      <div class="pd-mini-tile"><span class="pd-kpi-ico tone-gray">${pdIco('clock', 20)}</span><div><b>${none}</b><span>미수행 TC</span><small>전체의 ${total ? pdPct(none, total) + '%' : '-'}</small></div></div>
    </div>`;
}

function pdDefectMatches(d) {
  const f = PD.f;
  const x = PD.d;
  const codes = pdDefectModuleCodes(d);
  const modName = (PD.rows.find((r) => r.code === codes[0]) || {}).name;
  const mod = (sel) => !sel || codes.includes(sel) || (!codes.length && modName === sel);
  if (!mod(f.module) || !mod(x.module)) return false;
  if (x.severity && normSeverity(d.severity) !== x.severity) return false;
  if (x.status === '__open' ? d.status === '완료' : x.status && d.status !== x.status) return false;
  const hay = `${d.defectId} ${d.summary} ${d.module} ${pdDefectTcIds(d).join(' ')}`.toLowerCase();
  const q1 = f.q.trim().toLowerCase();
  const q2 = x.q.trim().toLowerCase();
  if (q1 && !hay.includes(q1)) return false;
  if (q2 && !hay.includes(q2)) return false;
  return true;
}

/** DEF_프로젝트명_033 → DEF_033 (전체 ID는 마우스 오버 툴팁) */
const pdShortId = (id) => String(id || '').replace(/^(DEF)_.*_(\d+)$/, '$1_$2');

function pdDefectRow(d) {
  const sev = normSeverity(d.severity) || '-';
  return `<tr data-id="${esc(d.defectId)}">
    <td class="pd-mono pd-id" title="${esc(d.defectId)}">${esc(pdShortId(d.defectId))}</td>
    <td class="pd-summary" title="${esc(d.summary)}">${esc(d.summary)}${pdDefectTcIds(d).length > 1 ? ` <span class="pd-tcn" title="관련 TC: ${esc(pdDefectTcIds(d).join(', '))}">TC ${pdDefectTcIds(d).length}건</span>` : ''}</td>
    <td>${esc(d.module)}</td>
    <td><span class="pd-sev pd-sev-${esc(sev)}" title="${esc(SEVERITY_LABELS[sev] || '')}">${esc(sev)}</span></td>
    <td><select class="pd-st-select" data-field="status" data-status="${esc(d.status)}" aria-label="상태">${STATUS_ORDER.map((s) => `<option value="${s}"${s === d.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
    <td><input class="pd-assignee" data-field="assignee" value="${esc(d.assignee || '')}" placeholder="미지정" aria-label="담당자"></td>
    <td class="pd-mono pd-muted">${esc(d.detectedAt || '')}</td>
  </tr>`;
}

function pdRenderDefects() {
  const viewer = PD.kpi.viewerFile;
  const link = pdEl('defectDetailLink');
  link.hidden = !viewer;
  if (viewer) link.href = `/project-files/${encodeURIComponent(PD.project)}/TC/${encodeURIComponent(viewer)}#결함현황`;
  pdEl('pdDefectCount').textContent = `총 ${PD.defects.length}건`;

  const body = pdEl('pdDefectBody');
  if (!PD.defects.length) {
    body.innerHTML = pdEmptyBlock('bug', '아직 등록된 결함이 없습니다.', '테스트 실행 중 발견된 결함이 여기에 표시됩니다.',
      '<button type="button" class="pd-btn pd-btn-primary" data-pd-act="run">테스트 실행하기' + pdIco('arrow', 16) + '</button>');
    return;
  }
  const list = PD.defects.filter(pdDefectMatches).sort((a, b) => (b.detectedAt || '').localeCompare(a.detectedAt || ''));
  if (!list.length) {
    body.innerHTML = '<div class="pd-empty-sm">조건에 맞는 결함이 없습니다.</div>';
    return;
  }
  const shown = list.slice(0, PD.defShown);
  const rest = list.length - shown.length;
  body.innerHTML = `<div class="table-wrap"><table class="pd-table pd-defect-table">
    <thead><tr><th>ID</th><th>결함명</th><th>모듈</th><th>심각도</th><th>상태</th><th>담당자</th><th>등록일</th></tr></thead>
    <tbody>${shown.map(pdDefectRow).join('')}</tbody></table></div>
    ${rest > 0 ? `<div class="pd-more"><button type="button" class="pd-btn pd-btn-outline pd-btn-sm" data-pd-act="more-def">더보기 (${rest}건 더)</button></div>` : ''}`;
}

function pdRenderRuns() {
  const all = pdEl('pdAllRuns');
  const body = pdEl('pdRunsBody');
  all.hidden = !PD.snaps.length;
  all.href = `/project-files/${encodeURIComponent(PD.project)}/TC/results/index.html`;
  if (!PD.snaps.length) {
    body.innerHTML = pdEmptyBlock('report', '아직 실행 이력이 없습니다.', '테스트 케이스를 실행하면 결과 이력이 여기에 표시됩니다.',
      '<button type="button" class="pd-btn pd-btn-primary" data-pd-act="run">테스트 실행하기' + pdIco('arrow', 16) + '</button>');
    return;
  }
  const f = PD.f;
  const q = f.q.trim().toLowerCase();
  const list = PD.snaps.filter((s) => {
    if (f.module && s.moduleCode !== f.module) return false;
    if (f.result === 'pass' && !(s.pass > 0)) return false;
    if (f.result === 'fail' && !(s.fail > 0)) return false;
    if (f.result === 'none' && !(s.none > 0)) return false;
    if (q && !`${s.moduleName} ${s.moduleCode}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (!list.length) {
    body.innerHTML = '<div class="pd-empty-sm">조건에 맞는 실행 이력이 없습니다.</div>';
    return;
  }
  const shown = list.slice(0, PD.runShown);
  const rest = list.length - shown.length;
  body.innerHTML = `<ul class="pd-runs">${shown.map((s) => {
    const ok = s.fail === 0;
    return `<li><a href="/project-files/${encodeURIComponent(PD.project)}/TC/results/${encodeURIComponent(s.htmlFile)}" target="_blank" rel="noopener">
      <span class="pd-run-ico ${ok ? 'ok' : 'ng'}">${pdIco(ok ? 'check' : 'x', 16)}</span>
      <span class="pd-run-main"><b>${esc(s.moduleName)} 모듈 테스트</b><small>${esc(s.dateFmt)}</small></span>
      <span class="pd-run-stat"><span class="pd-good">Pass ${s.pass}</span><span class="${s.fail ? 'pd-bad' : 'pd-muted'}">Fail ${s.fail}</span><span class="pd-muted">수행률 ${s.execRate}%</span></span>
      <span class="pd-chev">${pdIco('chevron', 16)}</span></a></li>`;
  }).join('')}</ul>
  ${rest > 0 ? `<div class="pd-more"><button type="button" class="pd-btn pd-btn-outline pd-btn-sm" data-pd-act="more-run">더보기 (${rest}건 더)</button></div>` : ''}`;
}

function pdLinkTile(href, ico, tone, title, sub, offMsg) {
  const inner = `<span class="pd-link-ico tone-${tone}">${pdIco(ico, 22)}</span><span class="pd-link-text"><b>${title}</b><small>${href ? sub : offMsg}</small></span>${href ? `<span class="pd-link-ext">${pdIco('ext', 16)}</span>` : ''}`;
  return href
    ? `<a class="pd-link-tile" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="pd-link-tile is-off">${inner}</div>`;
}

function pdRenderLinks() {
  const m = PD.meta || {};
  const enc = encodeURIComponent(PD.project);
  const prd = m.hasPrd && m.prdFile ? `/project-files/${enc}/Analysis/${encodeURIComponent(m.prdFile)}` : '';
  const flow = PD.kpi.viewerFile ? `/project-files/${enc}/TC/${encodeURIComponent(PD.kpi.viewerFile)}` : '';
  pdEl('pdLinksBody').innerHTML =
    pdLinkTile(pdSafeUrl(m.url), 'globe', 'blue', '사용자 사이트', 'Front 사이트 열기', '미설정') +
    pdLinkTile(pdSafeUrl(m.adminUrl), 'gear', 'amber', '관리자 사이트', 'Admin 사이트 열기', '미설정') +
    pdLinkTile(prd, 'file', 'green', 'PRD', '사이트 분석 &amp; TC 계획', '생성 전') +
    pdLinkTile(flow, 'book', 'violet', 'User Flow', '테스트 계정 · 플로우 맵', '생성 전');
}

// ── 필터 컨트롤 ↔ 상태 동기화 ────────────────────────────────────────────
function pdSyncControls() {
  pdEl('pdFModule').value = PD.f.module;
  pdEl('pdFRunStatus').value = PD.f.runStatus;
  pdEl('pdFSearch').value = PD.f.q;
  pdEl('pdDModule').value = PD.d.module;
  pdEl('pdDSeverity').value = PD.d.severity;
  pdEl('pdDStatus').value = PD.d.status;
  pdEl('pdDSearch').value = PD.d.q;
  [['pdFPrio', PD.f.priority], ['pdFResult', PD.f.result]].forEach(([id, v]) => {
    pdEl(id).querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  });
}

function pdSetFilters(partial, defectPartial) {
  Object.assign(PD.f, partial || {});
  Object.assign(PD.d, defectPartial || {});
  PD.defShown = PD_PAGE_DEFECTS;
  PD.runShown = PD_PAGE_RUNS;
  pdSyncControls();
  pdRenderFiltered();
}

function pdScrollTo(id) {
  const n = pdEl(id);
  if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 채팅 / 실행 모달 연동 ────────────────────────────────────────────────
function pdFocusChat(prefill) {
  if (prefill && !el.chatInput.value.trim()) el.chatInput.value = prefill;
  pdScrollTo('chatPanel');
  setTimeout(() => el.chatInput.focus({ preventScroll: true }), 350);
}

function pdStartAnalysis() {
  const url = pdSafeUrl((PD.meta || {}).url);
  if (!url) {
    openManageProjectModal(PD.project); // URL부터 등록해야 분석을 시작할 수 있음
    return;
  }
  pdFocusChat(`메인 페이지 URL은 ${url} 입니다. 사이트를 분석하고 TC 생성해줘`);
}

function pdOpenRun() {
  pdEl('runModal').hidden = false;
  if (!tqRunning) refreshTqPreview();
}
function pdCloseRun() { pdEl('runModal').hidden = true; }

function pdOnRunState(running) {
  const btn = pdEl('pdBtnRun');
  if (!btn) return;
  btn.classList.toggle('is-running', running);
  pdEl('pdBtnRunLabel').textContent = running ? '실행 중…' : '테스트 실행';
}

function pdToggleExamples(force) {
  const box = pdEl('pdExamples');
  const open = force == null ? box.hidden : force;
  box.hidden = !open;
  pdEl('pdBtnExamples').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && !box.innerHTML) {
    box.innerHTML = PD_EXAMPLES.map((t) => `<button type="button" class="pd-example" data-pd-example="${esc(t)}">${esc(t)}</button>`).join('');
  }
}

// ── 이벤트 ───────────────────────────────────────────────────────────────
const PD_ACTIONS = {
  manage: () => openManageProjectModal(PD.project),
  analyze: pdStartAnalysis,
  chat: () => pdFocusChat(),
  run: pdOpenRun,
  // "최근 실패 모듈" 타일: 실패 TC가 있는 모듈만 모듈별 수행현황에 표시
  'filter-fail': () => { pdSetFilters({ result: 'fail' }); pdScrollTo('pdModules'); },
  // "실패 TC 보기" / "미수행 TC": TC 목록 창(실제 TC 단위 목록)
  'view-tcs-fail': () => pdOpenTcList('Fail'),
  'view-tcs-none': () => pdOpenTcList('none'),
  'defects-critical': () => { pdSetFilters({}, { severity: 'Critical', status: '__open' }); pdScrollTo('pdDefects'); },
  'more-def': () => { PD.defShown += PD_PAGE_DEFECTS; pdRenderDefects(); pdHydrateIcons(); },
  'more-run': () => { PD.runShown += PD_PAGE_RUNS; pdRenderRuns(); pdHydrateIcons(); },
};

const pdView = pdEl('projectView');

pdView.addEventListener('click', (e) => {
  const copy = e.target.closest('[data-pd-copy]');
  if (copy) {
    const text = copy.dataset.pdCopy;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      () => { copy.classList.add('copied'); setTimeout(() => copy.classList.remove('copied'), 1200); },
      () => window.prompt('복사해서 사용하세요', text)
    );
    return;
  }
  const ex = e.target.closest('[data-pd-example]');
  if (ex) { el.chatInput.value = ex.dataset.pdExample; pdToggleExamples(false); el.chatInput.focus(); return; }

  const rail = e.target.closest('[data-pd-go]');
  if (rail) {
    const go = rail.dataset.pdGo;
    if (PD_ACTIONS[go]) PD_ACTIONS[go]();
    else {
      pdScrollTo(go);
      pdEl('pdRail').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === rail));
    }
    return;
  }
  const act = e.target.closest('[data-pd-act]');
  if (act && PD_ACTIONS[act.dataset.pdAct]) PD_ACTIONS[act.dataset.pdAct]();
});

pdEl('pdBtnTcCreate').addEventListener('click', () => pdFocusChat());
pdEl('pdBtnRun').addEventListener('click', pdOpenRun);
pdEl('pdBtnExamples').addEventListener('click', () => pdToggleExamples());
pdEl('pdBtnExampleInsert').addEventListener('click', () => {
  el.chatInput.value = PD_EXAMPLES[PD.exampleIdx % PD_EXAMPLES.length];
  PD.exampleIdx += 1;
  el.chatInput.focus();
});
pdEl('btnCloseRun').addEventListener('click', pdCloseRun);
pdEl('runModal').addEventListener('click', (e) => { if (e.target === pdEl('runModal')) pdCloseRun(); });

pdEl('pdFModule').addEventListener('change', (e) => pdSetFilters({ module: e.target.value }));
pdEl('pdFRunStatus').addEventListener('change', (e) => pdSetFilters({ runStatus: e.target.value }));
pdEl('pdFSearch').addEventListener('input', (e) => pdSetFilters({ q: e.target.value }));
// 상단 필터와 결함 카드 자체 필터를 함께 초기화 (둘 다 결과에 영향을 주므로 일부만 남아있으면 혼동됨)
pdEl('pdFReset').addEventListener('click', () => pdSetFilters({ module: '', priority: '', runStatus: '', result: '', q: '' }, { module: '', severity: '', status: '', q: '' }));
[['pdFPrio', 'priority'], ['pdFResult', 'result']].forEach(([id, key]) => {
  pdEl(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (b) pdSetFilters({ [key]: b.dataset.v });
  });
});
pdEl('pdDModule').addEventListener('change', (e) => pdSetFilters({}, { module: e.target.value }));
pdEl('pdDSeverity').addEventListener('change', (e) => pdSetFilters({}, { severity: e.target.value }));
pdEl('pdDStatus').addEventListener('change', (e) => pdSetFilters({}, { status: e.target.value }));
pdEl('pdDSearch').addEventListener('input', (e) => pdSetFilters({}, { q: e.target.value }));

// 결함 상태/담당자 인라인 편집 — 4000과 동일하게 즉시 defects.json에 저장(zero-token).
pdEl('pdDefectBody').addEventListener('change', (e) => {
  const target = e.target;
  if (!target.matches('[data-field]')) return;
  const defectId = target.closest('tr')?.dataset.id;
  if (!defectId) return;
  if (target.dataset.field === 'status') target.dataset.status = target.value;
  saveDefectField(defectId, target.dataset.field, target.value, target);
});

pdHydrateIcons();

pdEl('pdFHelpBtn').addEventListener('click', () => {
  const panel = pdEl('pdFHelp');
  panel.hidden = !panel.hidden;
  pdEl('pdFHelpBtn').setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
});
