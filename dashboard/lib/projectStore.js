// tc-automation 루트를 스캔해 "프로젝트로 보이는" 폴더 목록을 만드는 순수 로직 (토큰 미사용)
// 프로젝트 판정 기준: {폴더명}\TC\ 서브폴더 존재 (AGENTS.md 16항 표준 구조)
const fs = require('fs');
const path = require('path');
const { TC_AUTOMATION_ROOT } = require('./defectStore');

const EXCLUDED = new Set(['_reference', '_template', '_scratch', '_shared', 'agents-config', 'slack-bridge', 'dashboard', 'node_modules', 'test-results', 'backup']);

function listProjects() {
  let entries;
  try {
    entries = fs.readdirSync(TC_AUTOMATION_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !EXCLUDED.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(TC_AUTOMATION_ROOT, name, 'TC')))
    .sort();
}

module.exports = { listProjects };
