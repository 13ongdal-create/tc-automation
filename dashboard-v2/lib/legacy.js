// 4000 포트 대시보드(D:\QA\tc-automation\dashboard)의 백엔드 lib를 그대로 불러옵니다.
// 4000 쪽 파일은 읽기만 하고 수정하지 않습니다 — 같은 QA 데이터(project/*, defects.json, results)를
// 두 대시보드가 공유하는 구조이므로, 데이터 해석 로직(KPI 집계, 결함 저장, TC 업로드 등)을 복사하지
// 않고 같은 코드를 쓰는 편이 두 화면 간 불일치를 막습니다.
//
// lib들은 자신의 위치(__dirname) 기준으로 TC_AUTOMATION_ROOT(=저장소 루트)와 공유 비밀번호 파일
// (dashboard/.dashboard-password)을 찾으므로, 이 경로만 맞으면 4000과 같은 데이터·같은 비밀번호를 씁니다.
const fs = require('fs');
const path = require('path');

// 찾는 순서: ① 환경변수 LEGACY_DASHBOARD_DIR ② 이 폴더(dashboard-v2)의 옆 폴더 ../dashboard
// (D:\QA\tc-automation\dashboard-v2 위치에서 그대로 동작) ③ 기본 경로 D:/QA/tc-automation/dashboard
const SIBLING_DIR = path.resolve(__dirname, '..', '..', 'dashboard');
const LEGACY_DIR = path.resolve(
  process.env.LEGACY_DASHBOARD_DIR ||
    (fs.existsSync(path.join(SIBLING_DIR, 'lib', 'defectStore.js')) ? SIBLING_DIR : 'D:/QA/tc-automation/dashboard')
);
const LIB_DIR = path.join(LEGACY_DIR, 'lib');

if (!fs.existsSync(path.join(LIB_DIR, 'defectStore.js'))) {
  console.error(`[오류] 4000 대시보드 lib를 찾을 수 없습니다: ${LIB_DIR}`);
  console.error('       LEGACY_DASHBOARD_DIR 환경변수로 기존 dashboard 폴더 경로를 지정하세요.');
  process.exit(1);
}

const load = (name) => require(path.join(LIB_DIR, name));

module.exports = {
  LEGACY_DIR,
  defectStore: load('defectStore'),
  resultsStore: load('resultsStore'),
  projectStore: load('projectStore'),
  tcStore: load('tcStore'),
  claudeRunner: load('claudeRunner'),
  chatSessions: load('chatSessions'),
  auth: load('auth'),
  testQueue: load('testQueue'),
  testRunner: load('testRunner'),
  resultsProcessor: load('resultsProcessor'),
  tcUpload: load('tcUpload'),
  gitOps: load('gitOps'),
};
