require('dotenv').config();
const fs = require('fs');
const { App } = require('@slack/bolt');
const claudeRunner = require('./claudeRunner');
const sessionStore = require('./sessionStore');
const resultReporter = require('./resultReporter');
const alert = require('./alert');
const defectStore = require('./defectStore');
const defectFastPath = require('./defectFastPath');
const dailyReport = require('./dailyReport');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: process.env.USE_SOCKET_MODE !== 'false',
  appToken: process.env.SLACK_APP_TOKEN,
});

function parseParams(text) {
  // "프로젝트=ABC마트 모듈=장바구니 URL=https://..." -> { 프로젝트: 'ABC마트', 모듈: '장바구니', URL: 'https://...' }
  // "프로젝트 = ABC마트"처럼 "=" 앞뒤 공백 허용 + "프로젝트='데모 사이트'"처럼 공백 포함 값을
  // 작은따옴표/큰따옴표로 감싼 경우도 인식 (2026-08-18, 실사용 중 두 가지 파싱 실패 발견)
  const params = {};
  const re = /(\S+?)\s*=\s*(?:'([^']*)'|"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(text || ''))) {
    params[m[1]] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
  }
  return params;
}

const TC_AUTOMATION_ROOT = process.env.TC_AUTOMATION_ROOT || 'D:/tc-automation';
// 프로젝트 폴더는 저장소 루트가 아니라 project/ 하위에 있음 (2026-08-25 디렉토리 구조 개편)
const PROJECTS_ROOT = `${TC_AUTOMATION_ROOT}/project`;

// 스레드(channel+thread_ts)별로 현재 실행 중인 claude CLI 프로세스를 추적 - "중단" 요청 시 찾아서 종료
const activeRuns = new Map();
const runKey = (channel, threadTs) => `${channel}:${threadTs}`;

// 프로젝트+모듈 단위로 "지금 실제로 실행 중인(claude 프로세스가 떠 있는)" 스레드가 있는지 추적합니다.
// activeRuns는 스레드 단위 락이라 "다른 스레드에서 같은 프로젝트/모듈을 동시에 요청"하는 건 못 막았는데,
// 그 경우 같은 캐노니컬 TC 파일에 두 프로세스가 동시에 쓰기 시도해 내용이 꼬일 수 있어 추가함 (2026-08-19).
const activeProjectModules = new Map();
const pmKey = (project, module_) => `${project || ''}::${module_ || ''}`;
const CANCEL_WORDS = /^(중단|취소|그만|stop|cancel)$/i;
const STATUS_WORDS = /^(상태|진행상황|진행 상황|진행률|status|progress)$/i;
const DEFECT_QUERY_WORDS = /(결함|defect)/i;

function formatElapsed(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
}

/** tc-automation 아래 실제 프로젝트 폴더명이 텍스트에 포함돼 있는지 확인 (Claude 호출 없이, 토큰 미사용) */
function findProjectNameInText(text) {
  let entries;
  try {
    entries = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true });
  } catch {
    return null;
  }
  const projects = entries
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && d.name !== 'node_modules')
    // 실제 온보딩된 프로젝트인지(= _template 구조를 따르는지) TC 서브폴더 존재로 검증 - 빈 폴더/찌꺼기 제외
    .filter((d) => {
      try {
        return fs.statSync(`${PROJECTS_ROOT}/${d.name}/TC`).isDirectory();
      } catch {
        return false;
      }
    })
    .map((d) => d.name);
  return projects.find((p) => text.includes(p)) || null;
}

function buildInitialPrompt(params) {
  const project = params['프로젝트'] || '[확인필요: 프로젝트명 없음]';
  let module_ = params['모듈'] || '[확인필요: 모듈 미지정]';
  let feature = params['기능'];
  const url = params['URL'] || params['url'];
  // "모듈=회원>회원가입"처럼 ">"로 하위 기능을 함께 표기한 경우, 별도 기능= 파라미터가 없어도
  // 자동으로 모듈/기능을 분리해 좁은 범위 지시 문구가 빠지지 않도록 함
  // (2026-08-18, 이 분리가 없어 Phase 1 관찰이 상위 모듈 전체로 확장되며 느려지는 문제 발견)
  if (!feature && module_.includes('>')) {
    const [parent, child] = module_.split('>').map((s) => s.trim());
    if (parent && child) {
      module_ = parent;
      feature = child;
    }
  }
  return [
    `tc-automation 저장소 경로: "${TC_AUTOMATION_ROOT}"`,
    `해당 저장소 내 "${project}" 프로젝트(${PROJECTS_ROOT}/${project})의 "${module_}" 모듈${feature ? ` 중 "${feature}" 기능만` : ''}에 대한 TC 생성 요청입니다.`,
    feature ? `기능 단위 요청입니다 — AGENTS.md 19-1항에 따라 해당 모듈의 누적 TC 파일(10항)을 Read한 뒤 "${feature}" 기능(소분류)에 해당하는 TC만 추가/수정하고, 다른 기능의 기존 TC는 그대로 둡니다. **Phase 1 관찰도 "${feature}" 기능과 직접 관련된 화면/플로우로만 한정**하고, 같은 상위 모듈에 속한 다른 기능(예: 로그인, 마이페이지 등)까지 넓혀서 관찰하지 않습니다.` : null,
    `AGENTS.md, skills/qa-test-case-generator/SKILL.md 규칙을 그대로 따라주세요.`,
    `AGENTS.md 13항의 Phase 워크플로우(Phase 0~8)를 단계별로 따르세요 — 이 프로젝트의 project.json이 없으면 먼저 Phase 0(URL, 단위/통합 구분, 코드/정책기반 질의)부터 진행하고, 있으면 건너뜁니다.`,
    url ? `URL이 함께 제공되었습니다: ${url} — Phase 0 질의에 참고하고, AGENTS.md 19항(URL 기반 코드형 TC)에 따라 Playwright로 직접 접속해 관찰한 화면 구조를 근거로 사용하세요.` : null,
    `목표 건수는 미리 정하지 않습니다 — 근거에서 도출 가능한 시나리오를 최대한 뽑아내고, 실제 도출된 개수를 있는 그대로 보고해주세요 (AGENTS.md 13항).`,
    `이번 응답에서는 (Phase 0 질의가 필요하면 그것부터 처리한 뒤) **Phase 1(분석)~Phase 3(테스트 케이스 산출)까지 승인을 기다리지 않고 연속으로 진행**합니다. Phase 3까지 끝나면 그 결과를 **한눈에 확인 가능한 마크다운 표 형식 요약**(예: 소분류/기능별 시나리오 건수, 우선순위 분포, 총 건수)으로 제시하고, **그 시점에만 승인을 기다립니다**. 승인을 받은 뒤에만 Phase 4(TC 산출물 생성)를 진행하세요. Phase 5(테스트 실행) 이후는 기존 규칙대로 별도 요청 시에만 진행합니다.`,
    `Phase 1~4를 진행하는 동안 이슈나 에러(예: 페이지 접근 실패, 예상과 다른 화면 구조, 정책 불일치, 관찰 중 발견된 결함 등)를 발견하면 최종 요약까지 기다리지 말고 **발견 즉시** 별도 줄에 정확히 \`ISSUE_ALERT: {한 줄 설명}\` 형식으로 출력하세요 — 브릿지가 이 줄을 실시간으로 감지해 스레드에 즉시 알림으로 전달합니다.`,
    `결과는 Slack 메시지로 바로 붙여넣을 수 있도록 마크다운 표/목록 형태로 간결하게 정리해주세요.`,
  ].filter(Boolean).join('\n');
}

const TEST_RUN_WORDS = /^(테스트\s*실행|테스트\s*수행|테스트해줘|run test|test run)해?줘?\.?$/i;

function buildFollowupPrompt(text) {
  const trimmed = (text || '').trim();
  if (TEST_RUN_WORDS.test(trimmed)) {
    return [
      '사용자가 테스트 실행(Phase 5)을 명시적으로 요청했습니다.',
      'Phase 4(TC 작성)가 아직 승인되지 않았다면 먼저 그 사실을 알리고 멈추세요. 승인되어 있다면 AGENTS.md 19항 규칙대로 Playwright 자동화 테스트를 실행하고,',
      'Phase 6(오류 공유: 콘솔 에러/실패 스크린샷)과 Phase 7(결함 관리: defects.json 등록/갱신)을 거쳐 Phase 8(Pass/Fail 결과 요약)까지 보고해주세요.',
      'Phase 8 보고 직후 AGENTS.md 18항 규칙대로 별도 승인 요청 없이 자동으로 git commit까지 진행하세요. 단, git push는 커밋 직후 "원격(origin)에 push할까요?"처럼 짧게 확인을 받은 뒤에만 실행하세요.',
    ].join('\n');
  }
  if (/^(승인|approve|yes|ok)$/i.test(trimmed)) {
    return [
      '사용자가 방금 "승인"했습니다. 직전에 당신이 무엇을 확인 요청했는지에 따라 다르게 진행하세요:',
      '- **Phase 진행 승인**이었다면: AGENTS.md 13항 Phase 워크플로우의 **바로 다음 Phase 하나만** 진행하고 다시 승인을 기다리세요 (여러 Phase를 한 번에 진행하지 마세요). Phase 4 승인이 Phase 5(테스트 실행) 자동 시작을 의미하지는 않습니다 — 테스트 실행은 별도 요청 시에만 시작합니다. Phase 4/8처럼 커밋이 자동으로 이뤄지는 시점이면 18항 규칙대로 커밋 후 push 여부를 확인하세요.',
      `- **git push 확인 질문**에 대한 답이었다면(18항): 그 즉시 "${TC_AUTOMATION_ROOT}" 저장소에 git push를 실행하고 결과를 알려주세요. (커밋 자체는 이미 자동으로 끝나 있어야 하며, 이 "승인"이 커밋을 새로 트리거하지 않습니다.)`,
      '- **결함 완료 처리 확인 질문**(20-3항, "TC_XXX 재검증 통과 — 관련 결함 DEF_XXX를 완료 처리할까요?")에 대한 답이었다면: 해당 결함 레코드의 상태만 `완료`로 변경하고 history에 기록하세요. Phase 진행이나 git push와는 무관한 별개의 확인입니다.',
    ].join('\n');
  }
  if (/^(반려|거절|no)\b/i.test(trimmed)) {
    const reason = trimmed.replace(/^(반려|거절|no)[:\s]*/i, '');
    return `사용자가 반려했습니다. 사유: ${reason || '(사유 미기재)'}\n이 사유를 반영해서 다시 제시해주세요. 아직 Git 커밋은 하지 마세요.`;
  }
  return `사용자 요청: ${trimmed}\n이 요청을 처리해주세요 (TC 수정 요청이면 다시 제시, 결함 관리 요청(AGENTS.md 20-4항)이면 defects.json 조회/수정). 명시적으로 "승인"하거나 테스트 실행을 요청하기 전까지는 Git 커밋이나 자동화 테스트 실행을 하지 마세요.`;
}

/** 새 스레드를 열고 첫 프롬프트로 Claude Code 세션을 시작한 뒤 결과를 올리는 공통 로직 (/tc-generate, /tc-defects 공용) */
async function startNewThread(client, { channelId, ackText, prompt, meta }) {
  const posted = await client.chat.postMessage({ channel: channelId, text: ackText });
  const threadTs = posted.ts;
  const key = runKey(channelId, threadTs);
  const lockKey = meta && meta.project ? pmKey(meta.project, meta.module) : null;

  // 첫 요청이 아직 완료 전이라도(=sessionId 모름) 이 스레드를 "우리가 아는 스레드"로 즉시 기록해둡니다.
  // 이렇게 안 하면, 완료되기 전에 중단될 경우 sessionStore에는 끝내 아무것도 안 남아 이 스레드의 어떤
  // 후속 메시지도 인식되지 않는(조용히 무시되는) 문제가 생깁니다.
  sessionStore.set(channelId, threadTs, { sessionId: null, ...meta });

  try {
    const result = await claudeRunner.startSession(prompt, {
      onProcess: (handle) => {
        activeRuns.set(key, handle);
        if (lockKey) activeProjectModules.set(lockKey, key);
      },
      onIssue: (message) => {
        client.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `:rotating_light: 진행 중 이슈 발견: ${message}` });
      },
    });

    sessionStore.set(channelId, threadTs, { sessionId: result.sessionId, ...meta });

    await resultReporter.postResult(client, { channel: channelId, threadTs, text: result.resultText });

    if (!result.sessionId) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: ':warning: 세션 ID를 확인하지 못했습니다. 이 스레드에서의 후속 대화는 이어지지 않을 수 있습니다 (claude CLI 버전에 따라 --output-format json 스키마가 다를 수 있음).',
      });
    }
    if (result.isError) {
      alert.alertResultFlaggedError({ channel: channelId, threadTs, project: meta && meta.project, resultText: result.resultText });
    }
  } catch (err) {
    if (err.isTimeout) {
      // 타임아웃은 '중단' 명령과 달리 아무도 안내 메시지를 올리지 않으므로, 여기서 직접 알립니다.
      await client.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `:alarm_clock: ${err.message}` });
      alert.alertRequestError({ channel: channelId, threadTs, project: meta && meta.project, kind: meta && meta.kind, errorMessage: err.message });
    } else if (!err.cancelled) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `:x: 처리 중 오류가 발생했습니다: ${err.message}`,
      });
      alert.alertRequestError({ channel: channelId, threadTs, project: meta && meta.project, kind: meta && meta.kind, errorMessage: err.message });
    }
    // err.cancelled === true(타임아웃 제외)인 경우: '중단' 처리 핸들러가 이미 안내 메시지를 올렸으므로 여기서는 조용히 넘어갑니다.
  } finally {
    activeRuns.delete(key);
    if (lockKey && activeProjectModules.get(lockKey) === key) activeProjectModules.delete(lockKey);
  }
}

app.command('/tc-generate', async ({ command, ack, client }) => {
  await ack();
  const params = parseParams(command.text);

  const lockKey = pmKey(params['프로젝트'], params['모듈']);
  if (params['프로젝트'] && activeProjectModules.has(lockKey)) {
    await client.chat.postMessage({
      channel: command.channel_id,
      text: `:warning: <@${command.user_id}> "${params['프로젝트']}" 프로젝트의 "${params['모듈'] || '(모듈 미지정)'}" 는 다른 스레드에서 이미 처리 중입니다. 같은 캐노니컬 TC 파일에 동시에 쓰면 내용이 꼬일 수 있어, 그 요청이 끝난 뒤 다시 시도해주세요.`,
    });
    return;
  }

  await startNewThread(client, {
    channelId: command.channel_id,
    ackText: `:hourglass_flowing_sand: <@${command.user_id}> 님의 TC 생성 요청을 처리 중입니다...\n요청사항: \`${command.text}\`\n인식됨: (프로젝트=${params['프로젝트'] || '?'}, 모듈=${params['모듈'] || '?'}${params['기능'] ? `, 기능=${params['기능']}` : ''}${params['URL'] ? `, URL=${params['URL']}` : ''})`,
    prompt: buildInitialPrompt(params),
    meta: { kind: 'tc-generate', project: params['프로젝트'] || null, module: params['모듈'] || null, feature: params['기능'] || null },
  });
});

app.command('/tc-defects', async ({ command, ack, client }) => {
  await ack();
  const params = parseParams(command.text);
  const project = params['프로젝트'];

  if (!project) {
    await client.chat.postMessage({
      channel: command.channel_id,
      text: `:warning: <@${command.user_id}> 프로젝트명이 필요합니다. 예: \`/tc-defects 프로젝트=ABC마트\``,
    });
    return;
  }

  // 결함 현황 조회는 defects.json을 읽어 표로 정리하는 단순 작업이라 Claude 없이 코드로 바로 처리합니다
  // (토큰 미사용). 세션은 아직 시작하지 않고, 담당자 지정 등 실제로 필요할 때만 지연 시작합니다.
  const posted = await client.chat.postMessage({
    channel: command.channel_id,
    text: defectStore.summarize(project),
  });
  sessionStore.set(command.channel_id, posted.ts, {
    sessionId: null,
    mode: 'lazy',
    kind: 'tc-defects',
    project,
  });
});

app.command('/tc-test', async ({ command, ack, client }) => {
  await ack();
  const params = parseParams(command.text);
  const project = params['프로젝트'];
  const module_ = params['모듈'];
  const feature = params['기능'];
  const tcId = params['TC'] || params['tc'];

  if (!project) {
    await client.chat.postMessage({
      channel: command.channel_id,
      text: `:warning: <@${command.user_id}> 프로젝트명이 필요합니다. 예: \`/tc-test 프로젝트=ABC마트 모듈=장바구니 [기능=쿠폰적용] [TC=TC_CRT_012]\` (모듈 생략 시 전체 실행)`,
    });
    return;
  }

  const scopeLabel = tcId ? `TC ${tcId} 1건` : feature ? `${module_ || '전체'} > ${feature} 기능` : module_ || '전체';
  const grepTarget = tcId || feature;

  // TC 생성 스레드와 별개로, 이미 만들어져 있는 자동화 테스트 코드를 재실행(회귀 테스트 등)할 때 쓰는
  // 독립 진입점입니다. Phase 5(테스트 수행)부터 바로 시작합니다.
  await startNewThread(client, {
    channelId: command.channel_id,
    ackText: `:hourglass_flowing_sand: <@${command.user_id}> 님의 테스트 실행 요청을 처리 중입니다...\n요청사항: \`${command.text}\`\n인식됨: (프로젝트=${project}, 범위=${scopeLabel})`,
    prompt: [
      `tc-automation 저장소 경로: "${TC_AUTOMATION_ROOT}"`,
      `"${project}" 프로젝트, 실행 범위: ${scopeLabel} 에 대한 테스트 실행(Phase 5) 요청입니다.`,
      `"${PROJECTS_ROOT}/${project}/TC/automation/tests/${module_ ? module_ + '.spec.js' : ''}" 경로에 이미 생성되어 있는 Playwright 자동화 테스트를 실행해주세요 (없다면 그렇게 보고하고 멈추세요 — 먼저 /tc-generate로 TC를 생성해야 합니다).`,
      grepTarget ? `AGENTS.md 19-1항에 따라 \`--grep "${grepTarget}"\` 옵션을 추가해 해당 ${tcId ? 'TC ID' : '기능'}만 실행하세요 (테스트 제목에 [TC_ID][기능명]이 포함되어 있어야 매칭됩니다).` : null,
      `AGENTS.md 19항(실행), 13항 Phase 5~8(테스트 수행 → 오류 공유 → 결함 관리 → 결과 도출) 규칙을 그대로 따라주세요.`,
      `결과 보고 시 실제 실행 범위(${scopeLabel})를 명시해주세요.`,
      `결과 도출(Phase 8) 직후 AGENTS.md 18항 규칙대로 별도 승인 요청 없이 자동으로 git commit하세요. git push는 커밋 직후 짧게 확인을 받은 뒤에만 실행하세요.`,
      `결과는 Slack 메시지로 바로 붙여넣을 수 있도록 마크다운 표/목록 형태로 간결하게 정리해주세요.`,
    ].filter(Boolean).join('\n'),
    meta: { kind: 'tc-test', project, module: module_ || null, feature: feature || null, tcId: tcId || null },
  });
});

app.event('app_mention', async ({ event, client }) => {
  // 이미 열려있는 스레드 안에서의 멘션은 아래 'message' 핸들러(후속 답장)가 처리하므로 여기서는 건너뜁니다.
  if (event.thread_ts && event.thread_ts !== event.ts) return;

  const text = event.text.replace(/<@[^>]+>\s*/g, '').trim();
  if (!text) return;

  // 자연어로 와도 "{프로젝트명} ... 결함 ..." 형태로 명확히 읽히면 Claude 없이 바로 응답합니다
  // (토큰 미사용 — /tc-defects와 동일한 경로. AGENTS.md/PIPELINE.md 참조).
  if (DEFECT_QUERY_WORDS.test(text)) {
    const project = findProjectNameInText(text);
    if (project) {
      const posted = await client.chat.postMessage({ channel: event.channel, text: defectStore.summarize(project) });
      sessionStore.set(event.channel, posted.ts, { sessionId: null, mode: 'lazy', kind: 'tc-defects', project });
      return;
    }
    // 프로젝트명을 못 찾으면(예: 오타, 신규 프로젝트) 아래 Claude 경로로 폴백해 되묻게 합니다.
  }

  await startNewThread(client, {
    channelId: event.channel,
    ackText: `:hourglass_flowing_sand: <@${event.user}> 님의 요청을 처리 중입니다...\n> ${text}`,
    prompt: [
      `tc-automation 저장소 경로: "${TC_AUTOMATION_ROOT}"`,
      `Slack에서 자연어로 들어온 요청입니다: "${text}"`,
      `이 요청이 TC 생성 요청인지, 결함 현황 조회/관리 요청인지 스스로 판단해서 그에 맞는 워크플로우를 시작해주세요.`,
      `- TC 생성 요청이면: AGENTS.md 13항 Phase 워크플로우(Phase 0~8)를 단계별로 따르세요. 이번 응답에서는 (Phase 0 질의가 필요하면 그것만, 아니면) Phase 1(분석) 한 단계만 진행하고 승인을 기다리세요. URL이 언급되어 있으면 19항(URL 기반 코드형 TC)을 따르세요.`,
      `- 결함 현황 조회/관리 요청이면: AGENTS.md 20항 규칙대로 해당 프로젝트의 defects.json을 조회/응답하세요.`,
      `요청에 프로젝트명이 없거나 모호하면 추측하지 말고 먼저 "어떤 프로젝트인가요?"라고 되물어주세요.`,
      `결과는 Slack 메시지로 바로 붙여넣을 수 있도록 마크다운 표/목록 형태로 간결하게 정리해주세요.`,
    ].join('\n'),
    meta: { kind: 'natural-language', rawText: text },
  });
});

app.event('message', async ({ event, client }) => {
  // 봇 자신의 메시지, 서브타입 있는 메시지(수정/삭제/입장 등), 스레드 답장이 아닌 메시지는 무시
  if (event.bot_id || event.subtype || !event.thread_ts || event.thread_ts === event.ts) return;

  const key = runKey(event.channel, event.thread_ts);
  const session = sessionStore.get(event.channel, event.thread_ts);
  const trimmed = (event.text || '').trim();

  // 우리가 만든 스레드가 아니면 무시합니다. startNewThread가 첫 응답 완료 전에도(=sessionId 모르는 상태로)
  // 즉시 sessionStore에 기록해두므로, "우리 스레드인지"는 이 존재 여부만으로 판단하면 됩니다.
  if (!session) return;

  if (CANCEL_WORDS.test(trimmed)) {
    const run = activeRuns.get(key);
    if (run) {
      run.cancel();
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: ':octagonal_sign: 진행 중이던 요청을 중단했습니다. 이어서 다른 요청을 입력해주세요.',
      });
    } else {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: '현재 이 스레드에서 진행 중인 작업이 없습니다.',
      });
    }
    return;
  }

  if (STATUS_WORDS.test(trimmed)) {
    // 진행 상태는 여기서 즉시 답합니다 - Claude를 다시 호출하지 않고, 이미 스트리밍되고 있는
    // claude CLI 출력에서 뽑아둔 "마지막 작업 내용"을 그대로 보여주는 것이라 토큰 소모가 없습니다.
    const run = activeRuns.get(key);
    const text = run
      ? `:mag: 진행 중 (경과 ${formatElapsed(Date.now() - run.startedAt)})\n현재 작업: ${run.status || '(아직 첫 작업 시작 전)'}`
      : '현재 이 스레드에서 진행 중인 작업이 없습니다.';
    await client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts, text });
    return;
  }

  if (activeRuns.has(key)) {
    // 이미 처리 중인 요청이 있는데 또 새 메시지가 오면, 같은 세션에 동시에 두 프로세스를 붙이지 않습니다.
    // (첫 요청이 아직 진행 중이라 session이 없는 경우도 포함됩니다.)
    const run = activeRuns.get(key);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `:hourglass_flowing_sand: 아직 이전 요청을 처리 중입니다 (현재 작업: ${run.status || '확인 중'}). 완료된 뒤에 다시 보내주시거나, \`상태\`로 진행 상황을, \`중단\`으로 취소할 수 있습니다.`,
    });
    return;
  }

  const lockKey = session.kind === 'tc-generate' && session.project ? pmKey(session.project, session.module) : null;
  if (lockKey && activeProjectModules.has(lockKey) && activeProjectModules.get(lockKey) !== key) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `:warning: "${session.project}" 프로젝트의 "${session.module || '(모듈 미지정)'}" 는 다른 스레드에서 이미 처리 중입니다. 그 요청이 끝난 뒤 다시 시도해주세요.`,
    });
    return;
  }

  if (session.kind === 'tc-defects') {
    // 담당자 지정/상태 변경처럼 정형화된 결함 관리 요청은 Claude 없이 코드로 바로 처리합니다 (토큰 미사용).
    const fast = defectFastPath.tryHandle(session.project, trimmed);
    if (fast) {
      await client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts, text: fast.text });
      return;
    }
  }

  const isLazyStart = !session.sessionId && session.mode === 'lazy';
  if (!session.sessionId && !isLazyStart) {
    // 첫 요청이 중단되었거나 세션 ID를 받기 전에 실패해, 이어갈 대상 자체가 없는 경우입니다.
    // (조용히 무시하면 "왜 반응이 없지"로 보이므로 명시적으로 안내합니다.)
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: ':warning: 이 스레드는 이어갈 수 있는 세션이 없습니다 (중단되었거나 첫 요청이 완료되지 못했습니다). 새로 `/tc-generate` 또는 봇 멘션으로 요청을 다시 시작해주세요.',
    });
    return;
  }

  try {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: ':hourglass_flowing_sand: 요청을 처리 중입니다...',
    });
    await client.reactions.add({
      channel: event.channel,
      timestamp: event.ts,
      name: 'hourglass_flowing_sand',
    });

    // 결함 관리 스레드는 자연어 판단이 필요해질 때(=fast-path에 안 걸릴 때)만 그제서야 Claude 세션을
    // 새로 시작합니다 (lazy). 그 외에는 기존 세션을 이어갑니다(resume).
    const result = isLazyStart
      ? await claudeRunner.startSession(
          [
            `tc-automation 저장소 경로: "${TC_AUTOMATION_ROOT}"`,
            `"${session.project}" 프로젝트의 결함 관리 요청입니다: "${trimmed}"`,
            `AGENTS.md 20항(결함 관리) 규칙에 따라 "project/${session.project}/TC/defects.json"을 조회/수정해주세요. 파일 수정은 즉시 반영하되, Git 커밋은 사용자가 "승인"하기 전까지 하지 마세요.`,
          ].join('\n'),
          {
            onProcess: (handle) => { activeRuns.set(key, handle); if (lockKey) activeProjectModules.set(lockKey, key); },
            onIssue: (message) => {
              client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts, text: `:rotating_light: 진행 중 이슈 발견: ${message}` });
            },
          }
        )
      : await claudeRunner.resumeSession(session.sessionId, buildFollowupPrompt(event.text), {
          onProcess: (handle) => { activeRuns.set(key, handle); if (lockKey) activeProjectModules.set(lockKey, key); },
          onIssue: (message) => {
            client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts, text: `:rotating_light: 진행 중 이슈 발견: ${message}` });
          },
        });

    await resultReporter.postResult(client, {
      channel: event.channel,
      threadTs: event.thread_ts,
      text: result.resultText,
    });

    if (result.sessionId) {
      sessionStore.set(event.channel, event.thread_ts, { ...session, sessionId: result.sessionId });
    }
    if (result.isError) {
      alert.alertResultFlaggedError({ channel: event.channel, threadTs: event.thread_ts, project: session.project, resultText: result.resultText });
    }
  } catch (err) {
    if (err.isTimeout) {
      await client.chat.postMessage({ channel: event.channel, thread_ts: event.thread_ts, text: `:alarm_clock: ${err.message}` });
      alert.alertRequestError({ channel: event.channel, threadTs: event.thread_ts, project: session.project, kind: session.kind, errorMessage: err.message });
    } else if (!err.cancelled) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: `:x: 처리 중 오류가 발생했습니다: ${err.message}`,
      });
      alert.alertRequestError({ channel: event.channel, threadTs: event.thread_ts, project: session.project, kind: session.kind, errorMessage: err.message });
    }
  } finally {
    activeRuns.delete(key);
    if (lockKey && activeProjectModules.get(lockKey) === key) activeProjectModules.delete(lockKey);
    await client.reactions.remove({
      channel: event.channel,
      timestamp: event.ts,
      name: 'hourglass_flowing_sand',
    }).catch(() => {});
  }
});

// 서버 자체가 죽는 경우(처리되지 않은 예외 등) - 스레드 안 에러 보고와 달리, 이건 채널 어디에도 보고될 곳이
// 없으므로 별도 웹훅으로 알립니다. 이런 경우가 실제로 응답 없는 요청(고아 프로세스)의 원인이 됩니다.
process.on('uncaughtException', async (err) => {
  console.error('[uncaughtException]', err);
  await alert.sendAlert(`:rotating_light: tc-automation 브릿지 서버에 처리되지 않은 오류가 발생해 곧 종료됩니다:\n\`\`\`${err.stack || err.message}\`\`\``);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('[unhandledRejection]', reason);
  await alert.sendAlert(`:rotating_light: tc-automation 브릿지 서버에서 처리되지 않은 Promise 거부가 발생했습니다:\n\`\`\`${reason && reason.stack ? reason.stack : reason}\`\`\``);
});

// 프로세스는 살아있는데 네트워크만 끊긴 경우(예: PC 슬립/네트워크 장애) 대비 - 이런 경우는 크래시가 아니라서
// uncaughtException/unhandledRejection으로는 안 잡히고, Socket Mode는 끊긴 동안 온 이벤트를 재전달해주지도
// 않아 "며칠째 응답 없음"으로 조용히 방치될 수 있습니다. 주기적으로 Slack API 연결을 확인해 연속 실패 시 알립니다.
const HEALTH_CHECK_MS = 5 * 60 * 1000; // 5분마다
const HEALTH_FAILURE_THRESHOLD = 3; // 연속 3회(약 15분) 실패 시 알림
let consecutiveHealthFailures = 0;
let disconnectAlertSent = false;

setInterval(async () => {
  try {
    await app.client.auth.test();
    if (disconnectAlertSent) {
      await alert.sendAlert(':white_check_mark: tc-automation 브릿지 서버의 Slack 연결이 복구되었습니다.');
      disconnectAlertSent = false;
    }
    consecutiveHealthFailures = 0;
  } catch (err) {
    consecutiveHealthFailures += 1;
    console.error(`[health-check] Slack API 호출 실패 (연속 ${consecutiveHealthFailures}회):`, err.message);
    if (consecutiveHealthFailures >= HEALTH_FAILURE_THRESHOLD && !disconnectAlertSent) {
      disconnectAlertSent = true;
      await alert.sendAlert(
        `:rotating_light: tc-automation 브릿지 서버가 Slack에 ${Math.round((HEALTH_CHECK_MS * consecutiveHealthFailures) / 60000)}분 이상 연결하지 못하고 있습니다 (네트워크 장애 가능성). 마지막 오류: ${err.message}`
      );
    }
  }
}, HEALTH_CHECK_MS);

(async () => {
  await app.start();
  console.log('tc-automation slack-bridge 가 실행 중입니다 (Socket Mode).');
  dailyReport.start();
  // 시작 성공 알림은 보내지 않습니다 (개발 중 재시작마다 알림이 쌓이는 걸 피하기 위함) -
  // 실제로 문제가 되는 경우(크래시/연결 끊김)만 위 핸들러들이 알립니다.
})();
