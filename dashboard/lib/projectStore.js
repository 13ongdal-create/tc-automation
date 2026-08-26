// tc-automation 루트를 스캔해 "프로젝트로 보이는" 폴더 목록을 만드는 순수 로직 (토큰 미사용)
// 프로젝트 판정 기준: {폴더명}\TC\ 서브폴더 존재 (AGENTS.md 16항 표준 구조)
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT, TC_AUTOMATION_ROOT } = require('./defectStore');

const TEMPLATE_ROOT = path.join(TC_AUTOMATION_ROOT, '_template');
// Windows 예약 파일명(디렉터리로도 만들 수 없음) — 참고: https://learn.microsoft.com/windows/win32/fileio/naming-a-file
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

function listProjects() {
  let entries;
  try {
    entries = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(PROJECTS_ROOT, name, 'TC')))
    .sort();
}

/** 새 프로젝트명이 폴더명으로 안전하고 유효한지 검사합니다. 문제 없으면 null, 있으면 사유 문자열을 반환합니다. */
function validateProjectName(name) {
  if (!name || !name.trim()) return '프로젝트명을 입력해주세요.';
  const trimmed = name.trim();
  if (trimmed !== name) return '앞뒤 공백 없이 입력해주세요.';
  if (trimmed.length > 60) return '프로젝트명이 너무 깁니다 (60자 이하).';
  // 경로 조작 문자(/,\,..) 및 Windows 폴더명 금지 문자를 모두 차단 — _template 밖으로 벗어나거나
  // 다른 폴더를 가리키는 이름을 원천적으로 막습니다.
  if (/[\\/:*?"<>|]/.test(trimmed) || trimmed.includes('..') || trimmed.startsWith('.')) {
    return '프로젝트명에 \\ / : * ? " < > | 문자나 마침표로 시작하는 이름은 사용할 수 없습니다.';
  }
  if (WINDOWS_RESERVED.test(trimmed)) return '이 이름은 Windows 예약어라 폴더명으로 사용할 수 없습니다.';
  if (fs.existsSync(path.join(PROJECTS_ROOT, trimmed))) return `"${trimmed}" 프로젝트가 이미 존재합니다.`;
  return null;
}

/**
 * _template\ 을 project\{name}\ 으로 복사해 신규 프로젝트를 온보딩합니다 (AGENTS.md 17항 1번).
 * 다른 기존 프로젝트 폴더는 절대 참조/복사하지 않고 항상 _template에서만 시작합니다.
 * 여기서는 폴더 스캐폴딩까지만 하고, project.json(Phase 0 질의 결과)은 만들지 않습니다 —
 * URL/단위·통합/코드·정책기반 질문은 사람과의 대화가 필요해 채팅 패널에서 자연스럽게 이어집니다.
 */
function createProject(name) {
  const reason = validateProjectName(name);
  if (reason) throw new Error(reason);
  const trimmed = name.trim();
  if (!fs.existsSync(TEMPLATE_ROOT)) throw new Error('_template 폴더를 찾을 수 없습니다.');
  const dest = path.join(PROJECTS_ROOT, trimmed);
  fs.cpSync(TEMPLATE_ROOT, dest, { recursive: true });
  return trimmed;
}

/**
 * project.json(AGENTS.md 13항 Phase 0 산출물) + Analysis/PRD 존재 여부를 읽습니다.
 * Phase 0가 아직 안 끝난(방금 생성된) 프로젝트는 project.json이 없을 수 있으므로 null 필드로 채웁니다.
 */
function loadMeta(project) {
  const projectDir = path.join(PROJECTS_ROOT, project);
  let meta = { url: null, testType: null, analysisBasis: null, createdAt: null };
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8'));
    meta = { url: raw.url ?? null, testType: raw.testType ?? null, analysisBasis: raw.analysisBasis ?? null, createdAt: raw.createdAt ?? null };
  } catch {
    // project.json 없음 — Phase 0 진행 전인 신규 프로젝트
  }
  const prdFile = `${project}_PRD.html`;
  const hasPrd = fs.existsSync(path.join(projectDir, 'Analysis', prdFile));
  return { ...meta, hasPrd, prdFile };
}

module.exports = { listProjects, createProject, validateProjectName, loadMeta };
