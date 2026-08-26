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

module.exports = { findFullViewer };
