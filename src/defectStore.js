// defects.json을 직접 읽고/쓰는 순수 로직 (Claude 호출 없음 - 토큰 미사용)
const fs = require('fs');
const path = require('path');

const TC_AUTOMATION_ROOT = process.env.TC_AUTOMATION_ROOT || 'D:/E-Commerce Service Planning Academy/tc-automation';
const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];

function defectsPath(project) {
  return path.join(TC_AUTOMATION_ROOT, project, 'TC', 'defects.json');
}

function load(project) {
  try {
    return JSON.parse(fs.readFileSync(defectsPath(project), 'utf8'));
  } catch {
    return null; // 파일이 없으면 프로젝트 자체가 없거나 아직 결함 이력이 없는 것
  }
}

function save(project, defects) {
  fs.writeFileSync(defectsPath(project), JSON.stringify(defects, null, 2), 'utf8');
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

module.exports = { load, save, summarize, updateField, STATUS_ORDER };
