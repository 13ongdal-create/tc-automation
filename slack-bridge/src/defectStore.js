// defects.json을 직접 읽고/쓰는 순수 로직 (Claude 호출 없음 - 토큰 미사용)
const fs = require('fs');
const path = require('path');

const TC_AUTOMATION_ROOT = process.env.TC_AUTOMATION_ROOT || 'D:/tc-automation';
// 프로젝트 폴더는 저장소 루트가 아니라 project/ 하위에 있음 (2026-08-25 디렉토리 구조 개편)
const PROJECTS_ROOT = path.join(TC_AUTOMATION_ROOT, 'project');
const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

function defectsPath(project) {
  return path.join(PROJECTS_ROOT, project, 'TC', 'defects.json');
}

function load(project) {
  try {
    return JSON.parse(fs.readFileSync(defectsPath(project), 'utf8'));
  } catch {
    return null; // 파일이 없으면 프로젝트 자체가 없거나 아직 결함 이력이 없는 것
  }
}

function save(project, defects) {
  // 원자적 쓰기: 임시 파일에 먼저 쓴 뒤 rename — 쓰기 도중 다른 프로세스(예: 같은 프로젝트를
  // 실행 중인 Claude CLI 세션의 Edit 도구)가 이 파일을 읽어도 반쯤 쓰인 내용을 보지 않습니다.
  // (단, 두 프로세스가 거의 동시에 각자 읽은 뒤 서로 다른 내용으로 저장하는 "마지막에 쓴 쪽이
  // 이긴다" 유실까지는 막지 못합니다 — 완전한 해결은 프로젝트 단위 락이 필요합니다.)
  const target = defectsPath(project);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(defects, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

/** /tc-defects 최초 조회 - 상태별 건수 + 신규/재발생 목록을 표로 요약 (AGENTS.md 20항 형식) */
function summarize(project) {
  const defects = load(project);
  if (defects === null) {
    return `:warning: "${project}" 프로젝트를 찾을 수 없거나 아직 결함 대장(defects.json)이 없습니다. 프로젝트명을 확인해주세요.`;
  }
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const d of defects) counts[d.status] = (counts[d.status] || 0) + 1;

  const table = STATUS_ORDER.map((s) => `| ${s} | ${counts[s] || 0} |`).join('\n');
  const notable = defects.filter((d) => d.status === '신규' || d.status === '재발생');
  const notableList = notable.length
    ? notable.map((d) => `- \`${d.defectId}\` (${d.status}) ${d.tcId} — ${d.summary}`).join('\n')
    : '- 없음';

  return [
    `**"${project}" 결함 현황** (전체 ${defects.length}건)`,
    '| 상태 | 건수 |',
    '|------|------|',
    table,
    '',
    '**신규/재발생 목록**',
    notableList,
    '',
    '담당자 지정("DEF_xxx 담당자를 홍길동으로 지정해줘"), 상태 변경("DEF_xxx 완료 처리해줘") 등을 이어서 답장하시면 됩니다.',
  ].join('\n');
}

/** DEF_xxx 담당자/상태 등 단일 필드를 직접 수정. 성공 시 확인 메시지, 실패 시 null 반환 */
function updateField(project, defectId, field, value) {
  const defects = load(project);
  if (defects === null) return null;
  const target = defects.find((d) => d.defectId === defectId);
  if (!target) return null;

  const prev = target[field];
  target[field] = value;
  target.history = target.history || [];
  target.history.push({
    at: new Date().toISOString().slice(0, 10),
    status: field === 'status' ? value : target.status,
    note: field === 'status' ? `상태 변경: ${prev || '(없음)'} → ${value} (Slack 채팅 처리)` : `${field} 변경: ${prev || '(없음)'} → ${value} (Slack 채팅 처리)`,
  });
  save(project, defects);
  return target;
}

module.exports = { load, save, summarize, updateField, STATUS_ORDER, PROJECTS_ROOT };
