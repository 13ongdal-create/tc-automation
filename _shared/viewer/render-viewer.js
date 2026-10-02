// 공용 뷰어 템플릿에 프로젝트 데이터(JSON)만 주입해 HTML을 만든다. (초안 — 템플릿의 CSS/HTML/JS는 수정하지 않음)
// 사용: node render-viewer.js <프로젝트 폴더> <모듈코드> <출력 HTML> [--extra extra-modals.json] [--strict]
// --strict: 필수 산출물(PRD/테스트 계정 매트릭스/User Flow Map)이 하나라도 없으면 생성하지 않고 종료(코드 2)
const fs = require('fs');
const path = require('path');

const [, , projectDir, moduleCode, outFile, ...rest] = process.argv;
if (!projectDir || !moduleCode || !outFile) { console.error('usage: render-viewer.js <projectDir> <moduleCode> <out.html> [--extra file.json]'); process.exit(1); }

const project = path.basename(projectDir);
const tcFile = path.join(projectDir, 'TC', `${project}_TC_${moduleCode}.json`);
const tc = JSON.parse(fs.readFileSync(tcFile, 'utf8'));
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const defects = readJson(path.join(projectDir, 'TC', 'defects.json'), []);
const proj = readJson(path.join(projectDir, 'project.json'), {});
// 결함 콘솔/네트워크 로그(TC/defects/{결함ID}.console.json) — 표시 전용으로 주입(과대 데이터 방지를 위해 항목 수/길이 제한)
const clip = (arr) => (Array.isArray(arr) ? arr.slice(0, 200).map((s) => String(s).slice(0, 1500)) : []);
const defectConsole = {};
for (const d of defects) {
  const cp = path.join(projectDir, 'TC', 'defects', `${d.defectId}.console.json`);
  const c = readJson(cp, null);
  if (c) defectConsole[d.defectId] = { consoleErrors: clip(c.consoleErrors), failedRequests: clip(c.failedRequests) };
}
const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 테스트 계정 매트릭스: TC/testAccounts.json(git 미추적)에서 자동 생성 — 비밀번호는 절대 포함하지 않는다(AGENTS.md 12항)
const accounts = (readJson(path.join(projectDir, 'TC', 'testAccounts.json'), {}).accounts) || [];
// 필수 산출물: 테스트 계정 매트릭스 버튼은 항상 노출한다 — 계정이 없으면 "없음"을 명시(project.json hasTestAccounts:false + 사유)
const noAccHtml = '<div class="modal-note">※ 등록된 테스트 계정이 없습니다.' + (proj.scope ? ' 범위: ' + escHtml(proj.scope) : '') +
  ' 로그인이 필요한 기능은 [확인필요]이거나 TC 범위에서 제외됩니다.</div>';
const autoExtra = [{
  id: 'accMatrixModal', label: '👤 테스트 계정 매트릭스', title: '테스트 계정 매트릭스',
  html: !accounts.length ? noAccHtml :
    '<table><thead><tr><th>대상</th><th>유형</th><th>계정</th><th>비고</th></tr></thead><tbody>' +
    accounts.map((a) => `<tr><td>${escHtml(String(a.site || '').split(' (')[0])}</td><td>${escHtml(a.role)}</td><td>${escHtml(a.id)}</td><td>${escHtml(a.note)}</td></tr>`).join('') +
    '</tbody></table><div class="modal-note">※ 비밀번호는 보안상 이 화면에 표기하지 않습니다 — <code>TC\\testAccounts.json</code>에서 확인 (git 미추적).</div>',
}];
// 프로젝트별 참고표(User Flow Map 등): --extra 로 지정하거나, 없으면 TC/viewer-extra-modals.json 을 기본으로 사용
const extraIdx = rest.indexOf('--extra');
const extraFile = extraIdx >= 0 ? rest[extraIdx + 1] : path.join(projectDir, 'TC', 'viewer-extra-modals.json');
const extra = [...autoExtra, ...readJson(extraFile, [])];


const meta = {
  project, module: moduleCode,
  moduleName: tc.meta.moduleName || tc.meta.module || moduleCode,
  version: tc.meta.version, changeHistory: tc.meta.changeHistory || [],
  siteUrl: proj.url || null,
  adminUrl: proj.adminUrl || null,
  prdFile: fs.existsSync(path.join(projectDir, 'Analysis', `${project}_PRD.html`)) ? `${project}_PRD.html` : null,
  resultsIndex: fs.existsSync(path.join(projectDir, 'TC', 'results', 'index.html')),
};

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

// AGENTS.md 10항: '<'는 반드시 \u003c 로 이스케이프(스크립트 블록 조기 종료/실행 방지)
const inject = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

let html = fs.readFileSync(path.join(__dirname, 'viewer.template.html'), 'utf8');
const markers = { META: meta, TC_DATA: tc.items, DEFECT_DATA: defects, DEFECT_CONSOLE: defectConsole, EXTRA_MODALS: extra };
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
console.log(`OK ${outFile} (${html.length} bytes) TC ${tc.items.length}건, 결함 ${defects.length}건, v${meta.version}`);
