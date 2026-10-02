// TC 뷰어(Full) "결함현황" 탭에 모듈 / 심각도 / 상태 / 검색 필터를 덧붙입니다.
//
// 이 스크립트는 4001 서버가 뷰어 HTML을 내려줄 때만 끼워 넣습니다(server.js의 /project-files 라우트).
// 뷰어 파일(project/*/TC/*_TC_전체.html)은 4000과 공유하는 QA 산출물이고 "뷰어 갱신" 때마다 다시 생성되므로
// 파일 자체는 수정하지 않습니다 — 그래서 뷰어를 새로 만들어도 필터가 유지됩니다.
//
// 뷰어의 전역(renderDefects, DEFECT_DATA)을 사용합니다. 뷰어가 렌더링한 뒤 행을 숨기는 방식이라
// 뷰어의 기존 동작(상태 버튼, 행 클릭 모달, 상태/링크 편집, TC 이동)은 그대로 유지됩니다.
(function () {
  'use strict';
  if (window.__defectFiltersInstalled) return;
  var panel = document.getElementById('defectPanel');
  if (!panel || typeof window.renderDefects !== 'function' || typeof DEFECT_DATA === 'undefined') return;
  window.__defectFiltersInstalled = true;

  // 공통 코드 규칙: 결함 심각도 = Critical/Major/Minor (과거 P1/P2/P3 값도 같은 값으로 취급)
  var SEV = { P1: 'Critical', P2: 'Major', P3: 'Minor', Critical: 'Critical', Major: 'Major', Minor: 'Minor' };
  var SEV_KO = { Critical: '치명', Major: '주요', Minor: '경미' };
  var STATUSES = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

  var state = { module: '', severity: '', q: '' };
  var moduleNames = {};

  function sevOf(d) { return SEV[d.severity] || d.severity || ''; }
  // 결함의 모듈 값은 자유 텍스트(상품상세/상품전시/시스템/시스템(공통) …)라 TC ID(TC_{모듈코드}_번호)의 코드로 판정
  function codeOf(d) {
    var m = /^TC_([A-Za-z]+)_/.exec(d.tcId || '');
    return m ? m[1].toUpperCase() : '';
  }
  // 결함 1건에 관련 TC가 여러 개(tcIds)일 수 있음 — 관련 TC가 속한 모든 모듈 코드(tcIds 없으면 [tcId])
  function codesOf(d) {
    var ids = Array.isArray(d.tcIds) && d.tcIds.length ? d.tcIds : [d.tcId];
    var out = [];
    ids.forEach(function (id) {
      var m = /^TC_([A-Za-z]+)_/.exec(id || '');
      var c = m ? m[1].toUpperCase() : '';
      if (c && out.indexOf(c) < 0) out.push(c);
    });
    return out;
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── 스타일(뷰어의 색 변수를 써서 다크 모드도 따라감) ──
  var style = document.createElement('style');
  style.textContent = [
    '.def-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}',
    '.def-filters select{padding:7px 10px;font-size:13px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--text);min-width:120px;}',
    '.def-f-search{display:flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel);color:var(--muted);min-width:240px;}',
    '.def-f-search input{flex:1;min-width:0;border:0;outline:0;padding:7px 0;font-size:13px;background:transparent;color:var(--text);}',
    '.def-f-search:focus-within{border-color:var(--accent);}',
    '.def-f-reset{border:0;background:transparent;color:var(--accent);font-size:12.5px;font-weight:600;padding:4px 6px;}',
    '.badge.Critical{background:var(--p1);} .badge.Major{background:var(--p2);} .badge.Minor{background:var(--p3);}',
  ].join('\n');
  document.head.appendChild(style);

  // ── 컨트롤: "N건 표시 중" 줄(툴바)에 배치 ──
  // "N건 표시 중" 줄의 툴바에 붙입니다(기준 뷰어와 같은 위치). 결함 저장 버튼 줄이 따로 있는 뷰어에서도 필터가 그 줄로 가지 않게,
  // 건수 표시(#defectFilteredCount)가 있는 툴바를 먼저 찾고, 없으면 첫 툴바를 씁니다.
  var countEl = document.getElementById('defectFilteredCount');
  var toolbar = (countEl && countEl.closest('.toolbar')) || panel.querySelector('.toolbar');
  var box = document.createElement('div');
  box.className = 'def-filters';
  box.innerHTML =
    '<select id="defFModule" aria-label="결함 모듈"><option value="">전체 모듈</option></select>' +
    '<select id="defFSeverity" aria-label="결함 심각도"><option value="">전체 심각도</option>' +
    '<option value="Critical">Critical (치명)</option><option value="Major">Major (주요)</option><option value="Minor">Minor (경미)</option></select>' +
    '<select id="defFStatus" aria-label="결함 상태"><option value="">전체 상태</option></select>' +
    '<label class="def-f-search"><span aria-hidden="true">&#128269;</span>' +
    '<input id="defFSearch" type="search" placeholder="결함명 또는 내용을 검색하세요." autocomplete="off"></label>' +
    '<button type="button" class="def-f-reset" id="defFReset" hidden>필터 초기화</button>';
  (toolbar || panel).appendChild(box);

  var elModule = document.getElementById('defFModule');
  var elSeverity = document.getElementById('defFSeverity');
  var elStatus = document.getElementById('defFStatus');
  var elSearch = document.getElementById('defFSearch');
  var elReset = document.getElementById('defFReset');

  function fillModules() {
    var codes = [];
    DEFECT_DATA.forEach(function (d) { codesOf(d).forEach(function (c) { if (codes.indexOf(c) < 0) codes.push(c); }); });
    codes.sort();
    var cur = state.module;
    elModule.innerHTML = '<option value="">전체 모듈</option>' + codes.map(function (c) {
      var name = moduleNames[c];
      return '<option value="' + escHtml(c) + '">' + escHtml(name ? c + ' · ' + name : c) + '</option>';
    }).join('');
    elModule.value = cur;
  }

  // 모듈 이름(예: PD · 상품전시(+전시))은 4001 API에서 가져옵니다. 실패하면 코드만 표시.
  (function loadModuleNames() {
    var parts = location.pathname.split('/'); // /project-files/{project}/TC/{file}
    var project = parts[1] === 'project-files' && parts[2] ? parts[2] : '';
    if (!project || typeof fetch !== 'function') return;
    fetch('/api/' + project + '/kpi', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (kpi) {
        if (!kpi || !kpi.tcPriorityByModule) return;
        kpi.tcPriorityByModule.forEach(function (m) { moduleNames[m.moduleCode] = m.moduleName; });
        fillModules();
      })
      .catch(function () { /* 이름 조회 실패 시 코드만 표시 */ });
  })();

  function matches(d) {
    if (state.module && codesOf(d).indexOf(state.module) < 0) return false;
    if (state.severity && sevOf(d) !== state.severity) return false;
    var q = state.q.trim().toLowerCase();
    if (q) {
      var hay = [d.defectId, d.summary, d.module, d.tcId, (d.tcIds || []).join(' '), d.testEnv, d.testSteps, d.actualResult, d.expectedResult].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  // 뷰어가 렌더링한 직후 호출 — 행 숨김 + 심각도 표기 정규화 + 건수/컨트롤 동기화
  function apply() {
    var body = document.getElementById('defectBody');
    if (!body) return;
    var old = body.querySelector('tr.def-f-empty');
    if (old) old.remove();

    var rows = body.querySelectorAll('tr[data-defid]');
    var shown = 0;
    rows.forEach(function (tr) {
      var d = DEFECT_DATA.find(function (x) { return x.defectId === tr.dataset.defid; });
      var badge = tr.children[2] && tr.children[2].querySelector('.badge');
      if (badge && d) {
        var s = sevOf(d);
        if (badge.textContent !== s) badge.textContent = s;
        badge.title = s + (SEV_KO[s] ? ' (' + SEV_KO[s] + ')' : '');
      }
      var visible = !d || matches(d);
      tr.style.display = visible ? '' : 'none';
      if (visible) shown += 1;
    });

    if (rows.length) {
      var count = document.getElementById('defectFilteredCount');
      if (count) count.textContent = shown + '건 표시 중 (전체 ' + DEFECT_DATA.length + '건)';
      if (!shown) {
        var tr = document.createElement('tr');
        tr.className = 'def-f-empty';
        tr.innerHTML = '<td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">조건에 맞는 결함이 없습니다.</td>';
        body.appendChild(tr);
      }
    }

    // 상태 셀렉트는 뷰어의 상태 버튼과 같은 값을 가리키도록 동기화(건수 포함)
    var curStatus = typeof defectFilterStatus === 'string' && defectFilterStatus !== '전체' ? defectFilterStatus : '';
    elStatus.innerHTML = '<option value="">전체 상태 (' + DEFECT_DATA.length + ')</option>' + STATUSES.map(function (s) {
      var n = DEFECT_DATA.filter(function (d) { return d.status === s; }).length;
      return '<option value="' + s + '">' + s + ' (' + n + ')</option>';
    }).join('');
    elStatus.value = curStatus;
    elReset.hidden = !(state.module || state.severity || state.q.trim() || curStatus);
  }

  // 뷰어의 renderDefects를 감싸서, 어떤 경로(상태 버튼/상태 편집/탭 전환)로 다시 그려도 필터가 적용되게 함
  var original = window.renderDefects;
  window.renderDefects = function () {
    var result = original.apply(this, arguments);
    apply();
    return result;
  };

  elModule.addEventListener('change', function () { state.module = elModule.value; apply(); });
  elSeverity.addEventListener('change', function () { state.severity = elSeverity.value; apply(); });
  elSearch.addEventListener('input', function () { state.q = elSearch.value; apply(); });
  // 상태는 뷰어 자신의 상태 버튼을 눌러 변경 — 뷰어의 내부 변수 구조에 의존하지 않기 위함
  elStatus.addEventListener('change', function () {
    var want = elStatus.value || '전체';
    var btn = document.querySelector('#defectFilterPills [data-status="' + want + '"]');
    if (btn) btn.click();
  });
  elReset.addEventListener('click', function () {
    state.module = state.severity = state.q = '';
    elModule.value = elSeverity.value = elSearch.value = '';
    var all = document.querySelector('#defectFilterPills [data-status="전체"]');
    if (all) all.click(); else apply();
  });

  fillModules();
  apply();
})();
