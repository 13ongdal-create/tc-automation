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

/**
 * 모든 모듈 캐노니컬 TC 파일(*_TC_전체.json 제외)의 meta.changeHistory를 모아
 * 날짜(최신순) 기준으로 합친 변경 이력을 반환합니다 (AGENTS.md 10항 "세 겹 이력 관리" 중
 * meta.changeHistory를 대시보드에 노출).
 */
function getChangeHistory(project) {
  const dir = tcDir(project);
  const re = new RegExp(`^${escapeRegex(project)}_TC_([A-Z]+)\\.json$`);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => re.test(f));
  } catch {
    return [];
  }

  const entries = [];
  for (const file of files) {
    const m = file.match(re);
    const moduleCode = m[1];
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch {
      continue;
    }
    const moduleName = data.meta?.moduleName || moduleCode;
    for (const h of data.meta?.changeHistory || []) {
      entries.push({ moduleCode, moduleName, version: h.version, date: h.date, summary: h.summary });
    }
  }

  entries.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.version - a.version);
  return entries;
}

module.exports = { findFullViewer, getChangeHistory };
