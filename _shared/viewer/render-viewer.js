// 공용 뷰어 템플릿에 프로젝트 데이터(JSON)만 주입해 HTML을 만든다. (템플릿의 CSS/HTML/JS는 수정하지 않음)
// 사용:
//   모듈 뷰어  node render-viewer.js <프로젝트 폴더> <모듈코드> <출력 HTML> [--extra extra-modals.json] [--strict]
//   통합 뷰어  node render-viewer.js <프로젝트 폴더> 전체 <출력 HTML> [--extra extra-modals.json] [--strict] [--no-json]
// --strict   : 필수 산출물(PRD/테스트 계정 매트릭스/User Flow Map)이 하나라도 없으면 생성하지 않고 종료(코드 2)
// 통합 모드  : TC/{프로젝트}_TC_{모듈코드}.json 전부를 합쳐 TC/{프로젝트}_TC_전체.json(읽기 전용 스냅샷)과 HTML을 만든다(AGENTS.md 10항).
//              버전은 모듈 구성(모듈별 버전·건수)이 바뀌었을 때만 올린다. --no-json 이면 스냅샷 JSON은 쓰지 않는다.
const fs = require('fs');
const path = require('path');

const [, , projectDir, moduleCode, outFile, ...rest] = process.argv;
if (!projectDir || !moduleCode || !outFile) {
  console.error('usage: render-viewer.js <projectDir> <moduleCode|전체> <out.html> [--extra file.json] [--strict] [--no-json]');
  process.exit(1);
}

const BS = String.fromCharCode(92); // 백슬래시 (소스에 이스케이프 시퀀스를 직접 쓰면 편집 도구가 변형하는 문제를 피함)
const project = path.basename(projectDir);
const TC_DIR = path.join(projectDir, 'TC');
const isFull = moduleCode === '전체';
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const must = (c, m) => { if (!c) { console.error('중단: ' + m); process.exit(1); } };
const today = new Date().toISOString().slice(0, 10);

// ── TC 데이터: 모듈 뷰어는 모듈 파일 1개, 통합 뷰어는 모든 모듈 파일을 합침 ──
let tc, items, meta;
const proj = readJson(path.join(projectDir, 'project.json'), {});
const prdFile = fs.existsSync(path.join(projectDir, 'Analysis', `${project}_PRD.html`)) ? `${project}_PRD.html` : null;
const common = {
  siteUrl: proj.url || null,
  adminUrl: proj.adminUrl || null,
  prdFile,
  resultsIndex: fs.existsSync(path.join(TC_DIR, 'results', 'index.html')),
};
let fullSnapshot = null;

if (!isFull) {
  tc = readJson(path.join(TC_DIR, `${project}_TC_${moduleCode}.json`), null);
  must(tc && tc.meta && Array.isArray(tc.items), `모듈 TC 파일을 읽지 못함: TC/${project}_TC_${moduleCode}.json`);
  items = tc.items;
  meta = {
    project, module: moduleCode,
    moduleName: tc.meta.moduleName || tc.meta.module || moduleCode,
    version: tc.meta.version, changeHistory: tc.meta.changeHistory || [],
    ...common,
  };
} else {
  // 모듈 파일 판정은 4000 대시보드(tcStore.readModuleFiles)와 같은 규칙: {프로젝트}_TC_{대문자 모듈코드}.json
  const prefix = `${project}_TC_`;
  const found = fs.readdirSync(TC_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .map((f) => f.slice(prefix.length, -5))
    .filter((c) => /^[A-Z]+$/.test(c));
  must(found.length >= 1, '모듈 TC 파일이 없음');
  const prev = readJson(path.join(TC_DIR, `${prefix}전체.json`), null);
  // 모듈 순서는 기존 통합 파일의 순서를 유지하고, 새 모듈은 코드순으로 뒤에 붙인다
  const prevOrder = prev && prev.meta && Array.isArray(prev.meta.sourceModules)
    ? prev.meta.sourceModules.map((s) => (/^([A-Z]+) /.exec(s) || [])[1]).filter(Boolean) : [];
  const order = [...prevOrder.filter((c) => found.includes(c)), ...found.filter((c) => !prevOrder.includes(c)).sort()];
  const modData = order.map((code) => ({ code, data: readJson(path.join(TC_DIR, `${prefix}${code}.json`), null) }));
  modData.forEach((m) => must(m.data && m.data.meta && Array.isArray(m.data.items), `모듈 TC 파일을 읽지 못함: ${prefix}${m.code}.json`));
  const modules = modData.map(({ code, data }) => ({ code, name: data.meta.moduleName || code, version: data.meta.version, total: data.items.length }));
  let n = 0;
  items = [];
  modData.forEach(({ code, data }) => data.items.forEach((it) => items.push({ ...it, module: code, moduleName: data.meta.moduleName || code, displayNo: ++n })));
  const sourceModules = modules.map((m) => `${m.code} v${m.version}(${m.total}건)`);
  const sameSources = prev && prev.meta && JSON.stringify(prev.meta.sourceModules) === JSON.stringify(sourceModules);
  const version = prev && prev.meta ? (sameSources ? prev.meta.version : (prev.meta.version || 0) + 1) : 1;
  meta = {
    project, module: '전체', moduleName: '통합(Full) 뷰어', version, mode: 'full', modules, sourceModules,
    generatedAt: today,
    note: '이 파일은 읽기 전용 스냅샷입니다. 실제 편집은 각 모듈별 개별 파일에서 이루어집니다.',
    ...common,
  };
  fullSnapshot = { meta: { project, module: '전체', moduleName: meta.moduleName, version, generatedAt: today, sourceModules, note: meta.note }, items };
}

const defects = readJson(path.join(TC_DIR, 'defects.json'), []);
// 결함 콘솔/네트워크 로그(TC/defects/{결함ID}.console.json) — 표시 전용으로 주입(과대 데이터 방지를 위해 항목 수/길이 제한)
const clip = (arr) => (Array.isArray(arr) ? arr.slice(0, 200).map((s) => String(s).slice(0, 1500)) : []);
const defectConsole = {};
for (const d of defects) {
  const c = readJson(path.join(TC_DIR, 'defects', `${d.defectId}.console.json`), null);
  if (c) defectConsole[d.defectId] = { consoleErrors: clip(c.consoleErrors), failedRequests: clip(c.failedRequests) };
}
const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 테스트 계정 매트릭스: TC/testAccounts.json(git 미추적)에서 자동 생성 — 비밀번호는 절대 포함하지 않는다(AGENTS.md 12항)
const accounts = (readJson(path.join(TC_DIR, 'testAccounts.json'), {}).accounts) || [];
// 필수 산출물: 테스트 계정 매트릭스 버튼은 항상 노출한다 — 계정이 없으면 "없음"을 명시(project.json hasTestAccounts:false + 사유)
const noAccHtml = '<div class="modal-note">※ 등록된 테스트 계정이 없습니다.' + (proj.scope ? ' 범위: ' + escHtml(proj.scope) : '') +
  ' 로그인이 필요한 기능은 [확인필요]이거나 TC 범위에서 제외됩니다.</div>';
const autoExtra = [{
  id: 'accMatrixModal', label: '👤 테스트 계정 매트릭스', title: '테스트 계정 매트릭스',
  html: !accounts.length ? noAccHtml :
    '<table><thead><tr><th>대상</th><th>유형</th><th>계정</th><th>비고</th></tr></thead><tbody>' +
    accounts.map((a) => `<tr><td>${escHtml(String(a.site || '').split(' (')[0])}</td><td>${escHtml(a.role)}</td><td>${escHtml(a.id)}</td><td>${escHtml(a.note)}</td></tr>`).join('') +
    '</tbody></table><div class="modal-note">※ 비밀번호는 보안상 이 화면에 표기하지 않습니다 — <code>TC' + BS + 'testAccounts.json</code>에서 확인 (git 미추적).</div>',
}];
// 프로젝트별 참고표(User Flow Map 등): --extra 로 지정하거나, 없으면 TC/viewer-extra-modals.json 을 기본으로 사용
const extraIdx = rest.indexOf('--extra');
const extraFile = extraIdx >= 0 ? rest[extraIdx + 1] : path.join(TC_DIR, 'viewer-extra-modals.json');
const extra = [...autoExtra, ...readJson(extraFile, [])];

// ── 필수 산출물 점검(AGENTS.md 13항 "필수 산출물"): PRD / 테스트 계정 매트릭스 / User Flow Map ──
const requiredChecks = [
  ['PRD', !!meta.prdFile, `project/${project}/Analysis/${project}_PRD.html`],
  ['테스트 계정 매트릭스', accounts.length > 0 || proj.hasTestAccounts === false, 'TC/testAccounts.json 작성 또는 project.json에 hasTestAccounts:false(+사유) 기록'],
  ['User Flow Map', extra.some((m) => m.id === 'flowMapModal'), `project/${project}/TC/viewer-extra-modals.json 에 id "flowMapModal" 항목`],
];
meta.missingRequired = requiredChecks.filter((c) => !c[1]).map((c) => c[0]);
requiredChecks.forEach(([n, okc, how]) => console.log(`[필수 산출물] ${okc ? '✔' : '✖ 누락'} ${n}${okc ? '' : ' — ' + how}`));
if (rest.includes('--strict') && meta.missingRequired.length) {
  console.error(`중단(--strict): 필수 산출물 누락 ${meta.missingRequired.length}건 — ${meta.missingRequired.join(', ')}. 만든 뒤 다시 생성하세요(Phase 4는 완료로 보고하지 않음).`);
  process.exit(2);
}

// 통합 뷰어의 User Flow Map 버튼은 모듈별 흐름이 아니라 PRD 안내 — 기존 통합 뷰어와 같은 동작(상세는 PRD, 모듈별은 각 모듈 뷰어)
const extraFinal = !isFull ? extra : extra.map((m) => (m.id !== 'flowMapModal' ? m : {
  ...m, title: 'User Flow Map',
  html: '<div class="modal-note">전체 모듈을 아우르는 상세 User Flow Map은 PRD 페이지에서 관리합니다. 모듈별 개별 흐름은 각 모듈 뷰어의 User Flow Map 버튼을 참고해 주세요.</div>' +
    (meta.prdFile ? `<a href="../Analysis/${encodeURIComponent(meta.prdFile)}" style="text-decoration:none;"><button type="button" class="primary" style="margin-top:10px;">📄 PRD에서 보기</button></a>` : ''),
}));

// AGENTS.md 10항: '<'는 반드시 (백슬래시)u003c 로 이스케이프(스크립트 블록 조기 종료/실행 방지)
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');
const inject = (v) => JSON.stringify(v).replace(/</g, BS + 'u003c').replace(LS, BS + 'u2028').replace(PS, BS + 'u2029');

let html = fs.readFileSync(path.join(__dirname, 'viewer.template.html'), 'utf8');
const markers = { META: meta, TC_DATA: items, DEFECT_DATA: defects, DEFECT_CONSOLE: defectConsole, EXTRA_MODALS: extraFinal };
for (const [k, v] of Object.entries(markers)) {
  // 주입 지점은 항상 "/*__NAME__*/기본값;" 한 줄 — 마커 위치부터 그 줄의 마지막 ';'까지를 교체한다.
  const tag = `/*__${k}__*/`;
  const start = html.indexOf(tag);
  if (start < 0) throw new Error(`주입 지점 누락: ${k}`);
  const lineEnd = html.indexOf('\n', start);
  const end = html.lastIndexOf(';', lineEnd);
  if (end < start) throw new Error(`주입 지점 형식 오류: ${k}`);
  html = html.slice(0, start) + tag + inject(v) + html.slice(end);
}
fs.writeFileSync(outFile, html, 'utf8');
if (fullSnapshot && !rest.includes('--no-json')) {
  const jsonPath = path.join(TC_DIR, `${project}_TC_전체.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(fullSnapshot, null, 2) + '\n', 'utf8');
  console.log(`통합 스냅샷: ${path.relative('.', jsonPath)} (v${meta.version}, ${meta.modules.length}개 모듈)`);
}
console.log(`OK ${outFile} (${html.length} bytes) ${isFull ? '통합 뷰어 ' : ''}TC ${items.length}건, 결함 ${defects.length}건, v${meta.version}`);
