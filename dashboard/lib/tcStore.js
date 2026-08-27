// project/{project}/TC/ 아래 생성된 TC HTML 뷰어 파일을 찾는 순수 로직 (토큰 미사용)
// AGENTS.md 10항: 모듈 2개 이상 프로젝트는 {project}_TC_전체.html(통합 뷰어)을 유지,
// 단일 모듈 프로젝트는 통합 뷰어 없이 그 모듈 뷰어 하나만 존재.
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT } = require('./defectStore');

function tcDir(project) {
  return path.join(PROJECTS_ROOT, project, 'TC');
}

/**
 * "Full TC" 링크로 열 파일명을 찾습니다.
 * - {project}_TC_전체.html이 있으면 그 파일
 * - 없고 모듈 뷰어가 정확히 1개면 그 파일 (단일 모듈 프로젝트)
 * - 그 외(뷰어가 아직 없거나, 여러 개인데 통합 뷰어가 없는 경우)는 null
 */
function findFullViewer(project) {
  const dir = tcDir(project);
  const fullFile = `${project}_TC_전체.html`;
  if (fs.existsSync(path.join(dir, fullFile))) return fullFile;

  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f.startsWith(`${project}_TC_`));
  } catch {
    return null;
  }
  return files.length === 1 ? files[0] : null;
}

/** 정규식에 넣을 프로젝트명 이스케이프 (프로젝트명에 특수문자가 있을 수 있음) */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 프로젝트의 모듈별 캐노니컬 TC 파일({project}_TC_{모듈코드}.json, _전체 제외) 목록을 읽어 반환 */
function readModuleFiles(project) {
  const dir = tcDir(project);
  const re = new RegExp(`^${escapeRegex(project)}_TC_([A-Z]+)\\.json$`);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => re.test(f));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    const moduleCode = file.match(re)[1];
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch {
      continue;
    }
    out.push({ moduleCode, moduleName: data.meta?.moduleName || moduleCode, data });
  }
  return out;
}

/**
 * 모든 모듈 캐노니컬 TC 파일의 meta.changeHistory를 모아 날짜(최신순) 기준으로 합친
 * 변경 이력을 반환합니다 (AGENTS.md 10항 "세 겹 이력 관리" 중 meta.changeHistory를 대시보드에 노출).
 */
function getChangeHistory(project) {
  const entries = [];
  for (const { moduleCode, moduleName, data } of readModuleFiles(project)) {
    for (const h of data.meta?.changeHistory || []) {
      entries.push({ moduleCode, moduleName, version: h.version, date: h.date, summary: h.summary });
    }
  }
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.version - a.version);
  return entries;
}

/** 모듈별 TC 우선순위(P1/P2/P3) 분포 — 결함이 아니라 TC 항목 자체의 priority 필드 기준 */
function getPriorityByModule(project) {
  const result = [];
  for (const { moduleCode, moduleName, data } of readModuleFiles(project)) {
    const items = data.items || [];
    const counts = { P1: 0, P2: 0, P3: 0 };
    for (const item of items) {
      if (counts[item.priority] !== undefined) counts[item.priority] += 1;
    }
    result.push({ moduleCode, moduleName, total: items.length, ...counts });
  }
  result.sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
  return result;
}

module.exports = { findFullViewer, getChangeHistory, getPriorityByModule };
