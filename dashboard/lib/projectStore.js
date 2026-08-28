// tc-automation 루트를 스캔해 "프로젝트로 보이는" 폴더 목록을 만드는 순수 로직 (토큰 미사용)
// 프로젝트 판정 기준: {폴더명}\TC\ 서브폴더 존재 (AGENTS.md 16항 표준 구조)
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT, TC_AUTOMATION_ROOT } = require('./defectStore');

const TEMPLATE_ROOT = path.join(TC_AUTOMATION_ROOT, '_template');
// 삭제된 프로젝트의 전체 사본을 보관하는 곳 — backup\ 는 이미 .gitignore 대상(로컬 전용, CLAUDE.md 참조)이라
// 여기 담아도 원격에는 올라가지 않지만, 실수로 지운 프로젝트를 로컬에서 복구할 안전망은 됩니다.
const DELETED_PROJECTS_BACKUP_ROOT = path.join(TC_AUTOMATION_ROOT, 'backup', 'deleted-projects');
// Windows 예약 파일명(디렉터리로도 만들 수 없음) — 참고: https://learn.microsoft.com/windows/win32/fileio/naming-a-file
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;
const EDITABLE_META_FIELDS = ['url', 'adminUrl', 'testType', 'analysisBasis', 'hasTestAccounts', 'phase5Scope'];
const TEST_TYPE_VALUES = ['단위', '통합'];
const ANALYSIS_BASIS_VALUES = ['코드기반', '정책기반', '둘다'];

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
  let meta = {
    url: null, adminUrl: null, testType: null, analysisBasis: null,
    hasTestAccounts: null, phase5Scope: null, createdAt: null,
  };
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8'));
    meta = {
      url: raw.url ?? null,
      adminUrl: raw.adminUrl ?? null,
      testType: raw.testType ?? null,
      analysisBasis: raw.analysisBasis ?? null,
      hasTestAccounts: raw.hasTestAccounts ?? null,
      phase5Scope: raw.phase5Scope ?? null,
      createdAt: raw.createdAt ?? null,
    };
  } catch {
    // project.json 없음 — Phase 0 진행 전인 신규 프로젝트
  }
  const prdFile = `${project}_PRD.html`;
  const hasPrd = fs.existsSync(path.join(projectDir, 'Analysis', prdFile));
  return { ...meta, hasPrd, prdFile };
}

/** listProjects와 동일한 기준(TC\ 서브폴더 존재)으로 프로젝트 실존 여부를 확인합니다. */
function projectExists(name) {
  return !!name && fs.existsSync(path.join(PROJECTS_ROOT, name, 'TC'));
}

/**
 * project.json의 일부 필드만 갱신합니다 (AGENTS.md Phase 0 산출물 — url/testType/analysisBasis 등).
 * project.json이 아직 없으면(Phase 0 진행 전 신규 프로젝트) 이 호출로 최초 생성됩니다.
 * 프로젝트명(project 필드)·생성일(createdAt)은 이 함수로 바꾸지 않습니다 — project.json의 project
 * 값은 TC ID/파일명 등 저장소 전반에 이미 박혀있는 실제 폴더명과 반드시 일치해야 하므로, 폴더/파일명
 * 리네이밍 없이 이 값만 따로 바꾸면 불일치가 생깁니다(폴더 리네이밍은 이 기능의 범위 밖 — 필요 시
 * 프로젝트를 새로 만들고 내용을 옮기는 방식으로 처리).
 */
function updateProjectMeta(name, fields) {
  if (!projectExists(name)) throw new Error(`"${name}" 프로젝트를 찾을 수 없습니다.`);
  if (fields.testType != null && fields.testType !== '' && !TEST_TYPE_VALUES.includes(fields.testType)) {
    throw new Error(`testType은 ${TEST_TYPE_VALUES.join('/')} 중 하나여야 합니다.`);
  }
  if (fields.analysisBasis != null && fields.analysisBasis !== '' && !ANALYSIS_BASIS_VALUES.includes(fields.analysisBasis)) {
    throw new Error(`analysisBasis는 ${ANALYSIS_BASIS_VALUES.join('/')} 중 하나여야 합니다.`);
  }
  const metaPath = path.join(PROJECTS_ROOT, name, 'project.json');
  let current;
  try {
    current = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    current = { project: name, createdAt: new Date().toISOString().slice(0, 10) };
  }
  const next = { ...current };
  for (const key of EDITABLE_META_FIELDS) {
    if (fields[key] === undefined) continue;
    const v = fields[key];
    if (typeof v === 'string' && v.trim() === '') {
      delete next[key];
    } else {
      next[key] = typeof v === 'string' ? v.trim() : v;
    }
  }
  fs.writeFileSync(metaPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/**
 * 프로젝트 폴더를 삭제합니다 (테스트용/오등록 프로젝트 정리 용도). 되돌릴 수 없는 작업이므로:
 * 1) confirmName이 실제 프로젝트명과 정확히(대소문자 포함) 일치할 때만 진행하고,
 * 2) 삭제 전 backup\deleted-projects\{프로젝트명}_{타임스탬프}\ 에 전체 사본을 먼저 남깁니다.
 * git 커밋/원격 반영(push)은 이 함수가 하지 않습니다 — 이후 별도 git 작업(AGENTS.md 18항: add는
 * 해당 경로만 스코핑, push는 매번 재확인)으로 이어져야 합니다.
 */
function deleteProject(name, confirmName) {
  if (!projectExists(name)) throw new Error(`"${name}" 프로젝트를 찾을 수 없습니다.`);
  if (!confirmName || confirmName !== name) {
    throw new Error('확인 문구가 프로젝트명과 정확히 일치하지 않습니다.');
  }
  const src = path.join(PROJECTS_ROOT, name);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDest = path.join(DELETED_PROJECTS_BACKUP_ROOT, `${name}_${stamp}`);
  fs.mkdirSync(DELETED_PROJECTS_BACKUP_ROOT, { recursive: true });
  fs.cpSync(src, backupDest, { recursive: true });
  fs.rmSync(src, { recursive: true, force: true });
  return { backupPath: path.relative(TC_AUTOMATION_ROOT, backupDest) };
}

module.exports = {
  listProjects, createProject, validateProjectName, loadMeta,
  projectExists, updateProjectMeta, deleteProject,
};
