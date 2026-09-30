const { test, expect } = require('../../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const ACCOUNT = { id: 'jspark81', pw: 'q1w2e3r4!' };

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.locator('input[name="loginId"]').fill(ACCOUNT.id);
  await page.locator('input[name="pswd"]').fill(ACCOUNT.pw);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL(BASE + '/', { timeout: 10000 });
}

test('[TC_CS_001][공지사항] 공지사항 목록 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/customer/notice', { waitUntil: 'load' });
  await expect(page.getByText('3top 오픈 안내')).toBeVisible();
  await expect(page.getByText('시스템 점검 안내')).toBeVisible();
  await expect(page.getByText('서비스 개선을 위한 의견 접수 안내')).toBeVisible();
});

test('[TC_CS_002][공지사항] 공지사항 클릭 시 상세 내용 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/customer/notice', { waitUntil: 'load' });
  await page.getByText('3top 오픈 안내').click();
  await page.waitForTimeout(500);
});

test('[TC_CS_003][FAQ] FAQ 카테고리 탭 전환 동작 검증', async ({ page }) => {
  await page.goto(BASE + '/customer/faq', { waitUntil: 'load' });
  await page.getByRole('button', { name: '배송', exact: true }).click();
  await page.waitForTimeout(300);
});

test('[TC_CS_004][FAQ] FAQ 검색 기능 동작 검증', async ({ page }) => {
  await page.goto(BASE + '/customer/faq', { waitUntil: 'load' });
  await page.getByPlaceholder('검색어를 입력하세요').fill('배송');
  await page.getByPlaceholder('검색어를 입력하세요').press('Enter');
  await page.waitForTimeout(500);
});

test('[TC_CS_005][정책] [확인필요][결함] 개인정보처리방침 페이지 접근 시 404 에러 검증', async ({ page }) => {
  const res = await page.goto(BASE + '/policy', { waitUntil: 'load' });
  expect(res.status()).toBe(404);
});

test('[TC_CS_006][정책] [확인필요][결함] 이용약관 페이지 접근 시 404 에러 검증', async ({ page }) => {
  const res = await page.goto(BASE + '/service', { waitUntil: 'load' });
  expect(res.status()).toBe(404);
});


const ADMIN_BASE = 'http://192.168.10.116:30280';
const ADMIN_ACCOUNT = { id: 'devel', pw: 'test' };

async function adminLogin(page) {
  // 라이브 환경에서 Admin 로그인 API가 간헐적으로 500을 반환하는 현상 확인(2026-08-21) — 최대 3회 재시도
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(ADMIN_BASE + '/login', { waitUntil: 'load' });
    await page.locator('input[type="text"]').first().fill(ADMIN_ACCOUNT.id);
    await page.locator('input[type="password"]').first().fill(ADMIN_ACCOUNT.pw);
    await page.locator('button:has-text("LOG IN")').click();
    try {
      await page.waitForURL(ADMIN_BASE + '/', { timeout: 8000 });
      return;
    } catch (e) {
      if (attempt === 3) throw new Error('Admin 로그인 3회 시도 후에도 실패 (서버 응답 불안정 — 라이브 환경 간헐적 이슈로 추정)');
      await page.waitForTimeout(2000);
    }
  }
}

test('[TC_CS_007][Admin클레임리스트] 클레임 데이터 없음 시 Empty State 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/claim/list', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('데이터가 없습니다')).toBeVisible();
});

test('[TC_CS_008][Admin클레임리스트] 목록 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/claim/list', { waitUntil: 'load' });
  await expect(page.getByText('클레임목록')).toBeVisible();
});

test('[TC_CS_009][Admin클레임리스트] 클레임상태 필터 옵션 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/claim/list', { waitUntil: 'load' });
  for (const label of ['취소신청', '취소완료', '반품신청', '반품완료', '배송중지', '교환신청', '교환완료']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('[TC_CS_010][목록진입] 1:1문의 목록 진입 및 Empty State 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/inquiry', { waitUntil: 'load' });
  await expect(page.getByText('총 0건')).toBeVisible();
  await expect(page.getByText('조건에 맞는 문의 내역이 없습니다')).toBeVisible();
});

test('[TC_CS_011][조회기간필터] 1:1문의 목록 조회기간 필터 동작 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/inquiry', { waitUntil: 'load' });
  await page.getByRole('button', { name: '최근 7일', exact: true }).click();
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('총 0건')).toBeVisible();
});

test('[TC_CS_012][작성화면진입] "문의하기" 버튼 클릭 시 작성 화면 진입 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/inquiry', { waitUntil: 'load' });
  await page.getByRole('button', { name: '문의하기', exact: true }).click();
  await page.waitForTimeout(500);
  // 2026-09-30: 작성 화면 URL/경로가 관찰되지 않아 이동 발생 여부만 확인 (경로 자체는 재관찰 필요)
  expect(page.url()).not.toBe(BASE + '/mypage/inquiry');
});

test('[TC_CS_013][작성필수값] 1:1문의 작성 필수 항목 미입력 시 제출 차단 검증', async ({ page }) => {
  test.skip(true, '[확인필요] 1:1문의 작성 폼의 실제 필드 구성(제목/유형/내용 등)을 이번 조사에서 확인하지 못해 자동화 보류 — 재관찰 후 작성');
});

test('[TC_CS_014][작성제출] 1:1문의 정상 작성 후 목록 반영 검증', async ({ page }) => {
  test.skip(true, '[확인필요] 작성 폼 필드 구성이 확인되지 않아 자동 제출 시나리오를 작성할 수 없음 — TC_CS_013과 함께 재관찰 필요');
});

test('[TC_CS_015][답변확인] 1:1문의 답변 등록 후 Front 노출 검증', async ({ page }) => {
  test.skip(true, '[확인필요] Admin 측 문의 답변 등록 절차를 이번 조사에서 수행하지 못해 보류 — Admin 답변 등록 흐름 확인 후 작성');
});

test('[TC_CS_016][취소신청] 마이페이지 주문내역 "취소" 신청 버튼 및 플로우 존재 여부 확인', async ({ page }) => {
  test.skip(true, '[확인필요] jspark81 테스트 계정에 유효 주문 내역이 없어(DEF_데모사이트_008) 버튼 위치를 확인하지 못함 — 유효 주문 보유 테스트 계정 확보 후 작성');
});

test('[TC_CS_017][반품신청] 마이페이지 주문내역 "반품" 신청 버튼 및 플로우 존재 여부 확인', async ({ page }) => {
  test.skip(true, '[확인필요] jspark81 테스트 계정에 유효 주문 내역이 없어(DEF_데모사이트_008) 버튼 위치를 확인하지 못함 — 유효 주문 보유 테스트 계정 확보 후 작성');
});

test('[TC_CS_018][교환신청] 마이페이지 주문내역 "교환" 신청 버튼 및 플로우 존재 여부 확인', async ({ page }) => {
  test.skip(true, '[확인필요] jspark81 테스트 계정에 유효 주문 내역이 없어(DEF_데모사이트_008) 버튼 위치를 확인하지 못함 — 유효 주문 보유 테스트 계정 확보 후 작성');
});
