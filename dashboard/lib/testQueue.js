// 테스트 실행 큐 — 실행 범위(전체/모듈/결함재검증/미수행/P1)를 실제 실행 대상(spec 파일 + tcId 목록)
// 으로 해석하는 순수 로직 (Claude 미사용, 토큰 소모 없음). 실행 자체는 testRunner.js,
// 실행 결과의 TC/defects.json 반영은 resultsProcessor.js가 담당합니다.
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT, TC_AUTOMATION_ROOT } = require('./defectStore');
const tcStore = require('./tcStore');

const SCOPES = ['all', 'module', 'defect-retest', 'pending', 'p1', 'custom'];

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

function matcherFor(scope) {
  if (scope === 'all') return () => true;
  if (scope === 'defect-retest') return (i) => i.result === 'Fail' || i.result === 'Blocked';
  if (scope === 'pending') return (i) => !i.result;
  if (scope === 'p1') return (i) => i.priority === 'P1';
  return () => false;
}

/** scope에 따라 실행할 [{moduleCode, specFile, tcIds}] 목록을 만듭니다. tcIds가 null이면 spec 파일 전체 실행. */
function resolvePlan(project, scope, opts = {}) {
  if (!SCOPES.includes(scope)) throw new Error(`scope는 ${SCOPES.join('/')} 중 하나여야 합니다.`);
  const modules = listRunnableModules(project);

  if (scope === 'module') {
    const codes = new Set(Array.isArray(opts.moduleCodes) ? opts.moduleCodes : [opts.moduleCode].filter(Boolean));
    if (!codes.size) throw new Error('실행할 모듈을 선택해주세요.');
    return modules
      .filter((m) => codes.has(m.moduleCode))
      .map((m) => ({ moduleCode: m.moduleCode, specFile: m.specFile, tcIds: null }));
  }
  if (scope === 'all') {
    return modules.map((m) => ({ moduleCode: m.moduleCode, specFile: m.specFile, tcIds: null }));
  }
  if (scope === 'custom') {
    // TC 뷰어(HTML)에서 체크박스로 직접 고른 tcId 목록 — 여러 모듈에 걸쳐 있을 수 있어 각 tcId가
    // 실제로 속한 모듈을 찾아 그 모듈의 --grep 대상으로 묶습니다. 존재하지 않거나(오타 등) 자동화가
    // 안 된 tcId는 조용히 제외합니다 (preview()의 excludedNoAutomation으로 건수만 알림).
    const requested = [...new Set(Array.isArray(opts.tcIds) ? opts.tcIds : [])];
    if (!requested.length) throw new Error('실행할 TC를 선택해주세요.');
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

  // defect-retest / pending / p1 — 모듈 전체가 아니라 조건에 맞고 실제로 자동화된 TC만 --grep으로 선별
  const matches = matcherFor(scope);
  const canonical = new Map(tcStore.readModuleFiles(project).map((m) => [m.moduleCode, m]));
  const plan = [];
  for (const m of modules) {
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

/** 실행 전 미리보기 — 몇 건이 실제 실행 대상인지, 자동화 코드가 없어 제외되는 건 몇 건인지. */
function preview(project, scope, opts = {}) {
  const plan = resolvePlan(project, scope, opts);
  const countOf = (p) => (p.tcIds ? p.tcIds.length : extractTcIdsFromSpec(path.join(TC_AUTOMATION_ROOT, p.specFile)).size);
  const targetCount = plan.reduce((sum, p) => sum + countOf(p), 0);

  let excludedNoAutomation = 0;
  if (scope === 'custom') {
    const requestedUnique = new Set(Array.isArray(opts.tcIds) ? opts.tcIds : []).size;
    excludedNoAutomation = Math.max(0, requestedUnique - targetCount);
  } else if (scope !== 'module') {
    const matches = matcherFor(scope);
    let totalMatching = 0;
    for (const m of tcStore.readModuleFiles(project)) {
      totalMatching += (m.data.items || []).filter(matches).length;
    }
    excludedNoAutomation = Math.max(0, totalMatching - targetCount);
  }

  return {
    scope,
    modules: plan.map((p) => ({ moduleCode: p.moduleCode, count: countOf(p) })),
    targetCount,
    excludedNoAutomation,
  };
}

module.exports = { SCOPES, listRunnableModules, resolvePlan, preview };
