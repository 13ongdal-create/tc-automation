// defects.json을 직접 읽고/쓰는 순수 로직 (Claude 호출 없음 - 토큰 미사용)
// slack-bridge/src/defectStore.js를 기반으로 대시보드용으로 이식 (2026-08-24)
const fs = require('fs');
const path = require('path');

const TC_AUTOMATION_ROOT = process.env.TC_AUTOMATION_ROOT || 'D:/tc-automation';
// 프로젝트 폴더는 저장소 루트가 아니라 project/ 하위에 있음 (2026-08-25 디렉토리 구조 개편)
const PROJECTS_ROOT = path.join(TC_AUTOMATION_ROOT, 'project');
const STATUS_ORDER = ['신규', '처리중', '재검증대기', '완료', '보류', '재발생'];
const SEVERITY_ORDER = ['P1', 'P2', 'P3'];

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
  // 실행 중인 Claude Code 세션의 Edit 도구)가 이 파일을 읽어도 반쯤 쓰인 내용을 보지 않습니다.
  // (단, 두 프로세스가 거의 동시에 각자 읽은 뒤 서로 다른 내용으로 저장하는 "마지막에 쓴 쪽이
  // 이긴다" 유실까지는 막지 못합니다 — 완전한 해결은 프로젝트 단위 락이 필요합니다.)
  const target = defectsPath(project);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(defects, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

/** 상태별/우선순위별/모듈별 집계. byModule은 "모듈별 결함 상세 현황" 표용 (대시보드 홈) */
function summary(project) {
  const defects = load(project);
  if (defects === null) return null;
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  const severityCounts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  const byModuleMap = {};
  for (const d of defects) {
    counts[d.status] = (counts[d.status] || 0) + 1;
    if (d.severity) severityCounts[d.severity] = (severityCounts[d.severity] || 0) + 1;

    const mod = d.module || '(미지정)';
    if (!byModuleMap[mod]) {
      byModuleMap[mod] = { module: mod, total: 0, P1: 0, P2: 0, P3: 0, 신규: 0, 처리중: 0, 완료: 0 };
    }
    byModuleMap[mod].total += 1;
    if (d.severity && byModuleMap[mod][d.severity] !== undefined) byModuleMap[mod][d.severity] += 1;
    if (d.status === '신규' || d.status === '처리중' || d.status === '완료') byModuleMap[mod][d.status] += 1;
  }
  const byModule = Object.values(byModuleMap).sort((a, b) => b.total - a.total);
  return { total: defects.length, counts, severityCounts, byModule };
}

/** DEF_xxx 담당자/상태/이슈링크 등 단일 필드를 직접 수정. 성공 시 갱신된 레코드, 실패 시 null 반환 */
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
    note:
      field === 'status'
        ? `상태 변경: ${prev || '(없음)'} → ${value} (대시보드에서 직접 수정)`
        : `${field} 변경: ${prev || '(없음)'} → ${value} (대시보드에서 직접 수정)`,
  });
  save(project, defects);
  return target;
}

module.exports = { load, save, summary, updateField, STATUS_ORDER, SEVERITY_ORDER, TC_AUTOMATION_ROOT, PROJECTS_ROOT };
