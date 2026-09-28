// 프로젝트별 채팅(사이트분석·TC생성) 대화 상태를 메모리에 보관합니다.
// 서버 재시작 시 초기화됩니다 — 로컬 1인 대시보드 특성상 영속화는 하지 않습니다(§ zero-token 편집과
// 달리 이건 Claude 세션 자체가 상태를 들고 있으므로, 서버가 죽으면 어차피 --resume으로 이어갈 대상도
// 함께 사라진 것으로 취급).
//
// [수정 2026-08-27] 키를 project 단독에서 `${project}::${userKey}`로 변경 — 공유 비밀번호로 여러
// 사람이 동시에 같은 대시보드에 접속할 수 있게 된 뒤(외부망 접근 검토 과정에서 지적됨), project만으로
// 키를 잡으면 같은 프로젝트를 보는 서로 다른 로그인 세션이 동일한 Claude 대화(--resume 대상)와
// 메시지 이력을 공유해버리는 문제가 있었음. userKey는 로그인 세션 토큰(auth.js의 qa_session 쿠키
// 값)을 그대로 사용 — 이미 로그인마다 고유하게 발급되므로 별도 사용자 식별 체계를 새로 만들 필요가 없음.
const sessions = new Map(); // "project::userKey" -> { sessionId, messages: [{role, text, at}] }

function key(project, userKey) {
  return `${project}::${userKey || 'anonymous'}`;
}

function get(project, userKey) {
  return sessions.get(key(project, userKey)) || null;
}

function ensure(project, userKey) {
  const k = key(project, userKey);
  if (!sessions.has(k)) {
    sessions.set(k, { sessionId: null, messages: [] });
  }
  return sessions.get(k);
}

function reset(project, userKey) {
  sessions.delete(key(project, userKey));
}

function appendMessage(project, userKey, role, text) {
  const s = ensure(project, userKey);
  s.messages.push({ role, text, at: new Date().toISOString() });
  return s;
}

function setSessionId(project, userKey, sessionId) {
  const s = ensure(project, userKey);
  s.sessionId = sessionId;
}

/**
 * 이 대화의 첫 메시지에만 프로젝트 컨텍스트를 덧붙입니다. 이후 메시지는 --resume으로 이어지므로
 * Claude가 이미 대화 맥락(AGENTS.md 규칙, 이전 답변 등)을 들고 있어 그대로 전달합니다.
 * (Slack 버전과 달리 "승인/반려/테스트 실행" 같은 정형 문구를 따로 감지해 재작성하지 않습니다 —
 * 채팅 UI에서는 사용자가 자연어로 말해도 AGENTS.md 13항 Phase 워크플로우를 Claude가 대화 맥락으로
 * 직접 판단할 수 있기 때문입니다.)
 */
function buildPrompt(project, userText, isFirstMessage) {
  if (!isFirstMessage) return userText;
  return [
    `tc-automation 저장소(현재 작업 디렉터리)에서, "${project}" 프로젝트(project/${project})에 대한 요청입니다.`,
    `agents-config/AGENTS.md, agents-config/skills/qa-test-case-generator/SKILL.md 규칙을 그대로 따라주세요 — 특히 13항의 Phase 0~8 워크플로우(단계별 승인 필요)를 지켜주세요.`,
    `이 대화는 큐돌이 대시보드의 채팅 패널을 통해 진행됩니다 — 사용자에게 보여줄 응답은 마크다운으로 간결하게 정리해주세요.`,
    `이 세션은 헤드리스(터미널 승인 프롬프트 없음)라 사전 승인된 명령 패턴만 실행됩니다. Bash로`,
    `node 스크립트를 실행할 때는 반드시 "node _scratch/${project}/{파일명}" 형태로 저장소 루트 기준`,
    `상대경로 전체를 포함해 호출하세요 — cd로 이동한 뒤 파일명만 쓰거나 node -e 인라인 실행은 승인되지`,
    `않아 멈춥니다. git은 "git add project/${project}/..."와 "git commit -m ..." 형태만 승인됩니다.`,
    `⚠️ 매우 중요: 이 헤드리스 세션은 이 응답을 끝으로 프로세스가 완전히 종료됩니다 — 다음 사용자`,
    `메시지가 오면 매번 새 프로세스로 --resume되어 이어질 뿐, 백그라운드에서 스스로 깨어나 알림을`,
    `보내는 메커니즘 자체가 없습니다(터미널 세션과 다름). 따라서 Playwright 관찰 스크립트 등을`,
    `Bash로 실행할 때 run_in_background(백그라운드 실행)를 절대 사용하지 말고, 항상 포그라운드로`,
    `실행해 완료까지 이 응답 안에서 기다린 뒤 결과를 반영하세요. "완료되면 알려드리겠습니다" /`,
    `"백그라운드에서 계속 진행하겠습니다" 같은 응답은 이 환경에서 그대로 무한 대기로 이어지는`,
    `실제 버그이니 금지합니다(AGENTS.md 14항과 동일한 원칙이되, 이 헤드리스 환경에서는 예외 없이`,
    `더 엄격하게 적용됩니다). 스크립트가 오래 걸리면 그냥 그만큼 기다리세요 — 타임아웃은 15분입니다.`,
    ``,
    `사용자 요청: ${userText}`,
  ].join('\n');
}

module.exports = { get, ensure, reset, appendMessage, setSessionId, buildPrompt };
