// 테스트 실행 큐 — 모듈/시스템/우선순위/수행상태 필터(또는 TC 뷰어에서 직접 고른 tcId 목록)를
// 실제 실행 대상(spec 파일 + tcId 목록)으로 해석하는 순수 로직 (Claude 미사용, 토큰 소모 없음).
// 실행 자체는 testRunner.js, 실행 결과의 TC/defects.json 반영은 resultsProcessor.js가 담당합니다.
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT, TC_AUTOMATION_ROOT } = require('./defectStore');
const tcStore = require('./tcStore');

// 'filter': 모듈/시스템/우선순위/수행상태 조합으로 대상을 좁히는 대시보드 패널의 기본 모드.
// 'custom': TC 뷰어(HTML)에서 체크박스로 직접 고른 tcId 목록.
const SCOPES = ['filter', 'custom'];
const PRIORITIES = ['P1', 'P2', 'P3'];
const SYSTEMS = ['FO', 'BO'];
// 'none' = 미수행(실행결과 미입력). Blocked는 2026-08-27부로 N/A에 통합되어 선택지에서 제외
// (AGENTS.md 10항 "실행결과 값 정의").
const STATUSES = ['none', 'Pass', 'Fail', 'N/A', 'N/T'];

function automationDir(project) {
  return path.join(PROJECTS_ROOT, project, 'TC', 'automation', 'tests');
}

/** spec 파일 안에서 실제로 자동화된 tcId 목록을 추출합니다 (테스트 제목 "[TC_XXX_001]..." 규칙 기준). */
function extractTcIdsFromSpec(absSpecPath) {
  let content;
  try {
    content = fs.readFileSync(absSpecPath, 'utf8');
  } catch {
    return new Set();
  }
  const set = new Set();
  const re = /\[(TC_[A-Z]+_\d{3})\]/g;
  let m;
  while ((m = re.exec(content))) set.add(m[1]);
  return set;
}

/**
 * {project}/TC/automation/tests/*.spec.js 가 있고, 같은 모듈코드의 캐노니컬 TC json도 있는
 * 모듈만 "실행 가능"으로 취급합니다 (둘 중 하나라도 없으면 큐로 실행할 방법이 없음).
 */
function listRunnableModules(project) {
  const dir = automationDir(project);
  let specFiles;
  try {
    specFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.spec.js'));
  } catch {
    return [];
  }
  const canonical = new Map(tcStore.readModuleFiles(project).map((m) => [m.moduleCode, m]));
  const out = [];
  for (const file of specFiles) {
    const code = file.replace(/\.spec\.js$/, '');
    const mod = canonical.get(code);
    if (!mod) continue; // 자동화 코드는 있는데 캐노니컬 TC json이 없는 비정상 케이스 — 대상에서 제외
    const specFile = `project/${project}/TC/automation/tests/${file}`;
    const automatedIds = extractTcIdsFromSpec(path.join(TC_AUTOMATION_ROOT, specFile));
    out.push({
      moduleCode: code,
      moduleName: mod.moduleName,
      specFile,
      total: (mod.data.items || []).length,
      automatedCount: automatedIds.size,
    });
  }
  return out.sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
}

/** 우선순위/시스템/수행상태 필터를 하나의 판정 함수로 합칩니다. 각 값이 falsy면 "전체"(필터 없음). */
function itemMatcher({ priority, system, status } = {}) {
  return (item) => {
    if (priority && item.priority !== priority) return false;
    if (system && (item.system || 'FO') !== system) return false;
    if (status === 'none') { if (item.result) return false; }
    else if (status && item.result !== status) return false;
    return true;
  };
}

/** opts.moduleCodes(배열, 비어있으면 전체)로 실행 가능 모듈 목록을 좁힙니다. */
function selectModules(project, moduleCodes) {
  const modules = listRunnableModules(project);
  if (!Array.isArray(moduleCodes) || !moduleCodes.length) return modules;
  const codes = new Set(moduleCodes);
  return modules.filter((m) => codes.has(m.moduleCode));
}

/**
 * scope에 따라 실행할 [{moduleCode, specFile, tcIds}] 목록을 만듭니다. tcIds가 null이면 spec 파일
 * 전체 실행(필터가 하나도 없을 때만) — 있으면 그 tcId들만 --grep으로 선별 실행합니다.
 */
function resolvePlan(project, scope, opts = {}) {
  if (!SCOPES.includes(scope)) throw new Error(`scope는 ${SCOPES.join('/')} 중 하나여야 합니다.`);

  if (scope === 'custom') {
    // TC 뷰어(HTML)에서 체크박스로 직접 고른 tcId 목록 — 여러 모듈에 걸쳐 있을 수 있어 각 tcId가
    // 실제로 속한 모듈을 찾아 그 모듈의 --grep 대상으로 묶습니다. 존재하지 않거나(오타 등) 자동화가
    // 안 된 tcId는 조용히 제외합니다 (preview()의 excludedNoAutomation으로 건수만 알림).
    const requested = [...new Set(Array.isArray(opts.tcIds) ? opts.tcIds : [])];
    if (!requested.length) throw new Error('실행할 TC를 선택해주세요.');
    const modules = listRunnableModules(project);
    const canonical = new Map(tcStore.readModuleFiles(project).map((m) => [m.moduleCode, m]));
    const plan = [];
    for (const m of modules) {
      const mod = canonical.get(m.moduleCode);
      const moduleTcIds = new Set((mod.data.items || []).map((i) => i.tcId));
      const automatedIds = extractTcIdsFromSpec(path.join(TC_AUTOMATION_ROOT, m.specFile));
      const tcIds = requested.filter((id) => moduleTcIds.has(id) && automatedIds.has(id));
      if (tcIds.length) plan.push({ moduleCode: m.moduleCode, specFile: m.specFile, tcIds });
    }
    return plan;
  }

  // scope === 'filter' — 모듈/시스템/우선순위/수행상태를 자유롭게 조합
  const selected = selectModules(project, opts.moduleCodes);
  if (!selected.length) throw new Error('실행할 모듈이 없습니다.');

  const hasItemFilter = !!(opts.priority || opts.system || opts.status);
  if (!hasItemFilter) {
    return selected.map((m) => ({ moduleCode: m.moduleCode, specFile: m.specFile, tcIds: null }));
  }

  const matches = itemMatcher(opts);
  const canonical = new Map(tcStore.readModuleFiles(project).map((m) => [m.moduleCode, m]));
  const plan = [];
  for (const m of selected) {
    const mod = canonical.get(m.moduleCode);
    const automatedIds = extractTcIdsFromSpec(path.join(TC_AUTOMATION_ROOT, m.specFile));
    const tcIds = (mod.data.items || [])
      .filter(matches)
      .map((i) => i.tcId)
      .filter((id) => automatedIds.has(id));
    if (tcIds.length) plan.push({ moduleCode: m.moduleCode, specFile: m.specFile, tcIds });
  }
  return plan;
}

/** 프로젝트 전체에서 "실제로 자동화된"(spec 파일에 테스트가 있는) TC 항목만 모듈코드와 함께 평탄화합니다. */
function automatedItems(project) {
  const modules = listRunnableModules(project);
  const canonical = new Map(tcStore.readModuleFiles(project).map((m) => [m.moduleCode, m]));
  const out = [];
  for (const m of modules) {
    const mod = canonical.get(m.moduleCode);
    const automatedIds = extractTcIdsFromSpec(path.join(TC_AUTOMATION_ROOT, m.specFile));
    for (const item of mod.data.items || []) {
      if (automatedIds.has(item.tcId)) out.push({ ...item, moduleCode: m.moduleCode });
    }
  }
  return out;
}

/**
 * 현재 선택된 필터(opts) 기준으로, 모듈/시스템/우선순위/수행상태 각 축에서 "다른 값을 골랐을 때"
 * (나머지 축은 그대로 유지) 실행 대상이 몇 건이 되는지 계산합니다. 프런트가 0건인 선택지를
 * 비활성화해, 선택해도 결과가 없는 조합을 애초에 고를 수 없게 하는 데 사용합니다(사용자 요청,
 * 2026-09-29 — "케이스 유무에 따라 선택 가능한 값만 활성화되어야"). 자동화 안 된 TC는 애초에
 * 실행 불가능하므로 집계에서 제외합니다.
 */
function facets(project, opts = {}) {
  const items = automatedItems(project);
  const count = (filters) => {
    const moduleCodes = Array.isArray(filters.moduleCodes) && filters.moduleCodes.length ? new Set(filters.moduleCodes) : null;
    const matches = itemMatcher(filters);
    return items.filter((i) => (!moduleCodes || moduleCodes.has(i.moduleCode)) && matches(i)).length;
  };
  const base = { moduleCodes: opts.moduleCodes, priority: opts.priority, system: opts.system, status: opts.status };
  const modules = listRunnableModules(project);

  return {
    modules: modules.map((m) => ({ value: m.moduleCode, label: m.moduleName, count: count({ ...base, moduleCodes: [m.moduleCode] }) })),
    systems: SYSTEMS.map((s) => ({ value: s, count: count({ ...base, system: s }) })),
    priorities: PRIORITIES.map((p) => ({ value: p, count: count({ ...base, priority: p }) })),
    statuses: STATUSES.map((s) => ({ value: s, count: count({ ...base, status: s }) })),
  };
}

/** 실행 전 미리보기 — 몇 건이 실제 실행 대상인지, 자동화 코드가 없어 제외되는 건 몇 건인지. */
function preview(project, scope, opts = {}) {
  const plan = resolvePlan(project, scope, opts);
  const countOf = (p) => (p.tcIds ? p.tcIds.length : extractTcIdsFromSpec(path.join(TC_AUTOMATION_ROOT, p.specFile)).size);
  const targetCount = plan.reduce((sum, p) => sum + countOf(p), 0);

  let excludedNoAutomation = 0;
  if (scope === 'custom') {
    const requestedUnique = new Set(Array.isArray(opts.tcIds) ? opts.tcIds : []).size;
    excludedNoAutomation = Math.max(0, requestedUnique - targetCount);
  } else {
    const moduleCodes = Array.isArray(opts.moduleCodes) && opts.moduleCodes.length ? new Set(opts.moduleCodes) : null;
    const matches = itemMatcher(opts);
    let totalMatching = 0;
    for (const m of tcStore.readModuleFiles(project)) {
      if (moduleCodes && !moduleCodes.has(m.moduleCode)) continue;
      totalMatching += (m.data.items || []).filter(matches).length;
    }
    excludedNoAutomation = Math.max(0, totalMatching - targetCount);
  }

  return {
    scope,
    modules: plan.map((p) => ({ moduleCode: p.moduleCode, count: countOf(p) })),
    targetCount,
    excludedNoAutomation,
    facets: scope === 'filter' ? facets(project, opts) : undefined,
  };
}

module.exports = { SCOPES, PRIORITIES, SYSTEMS, STATUSES, listRunnableModules, resolvePlan, preview, facets };
