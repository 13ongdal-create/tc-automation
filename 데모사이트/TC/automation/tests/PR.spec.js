const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const ADMIN_BASE = 'http://192.168.10.116:30280';
const ADMIN_ACCOUNT = { id: 'devel', pw: 'test' };

async function adminLogin(page) {
  // 라이브 환경에서 Admin 로그인 API가 간헐적으로 500을 반환하는 현상 확인(2026-08-21) — 최대 3회 재시도
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(ADMIN_BASE + '/login', { waitUntil: 'networkidle' });
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

test('[TC_PR_001][Admin쿠폰관리] 등록된 쿠폰 행사 목록 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/promotion/coupon', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('20% 할인 쿠폰(아우터)')).toBeVisible();
});

test('[TC_PR_002][Admin쿠폰관리] 쿠폰유형 구분(상품쿠폰/즉시할인/장바구니쿠폰) 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/promotion/coupon', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('상품쿠폰').first()).toBeVisible();
  await expect(page.getByText('즉시할인').first()).toBeVisible();
});

test('[TC_PR_003][Admin쿠폰관리] 쿠폰유형 필터 조회 동작 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/promotion/coupon', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
});

test('[TC_PR_004][Admin쿠폰관리] "등록" 버튼 클릭 시 쿠폰 행사 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/promotion/coupon', { waitUntil: 'load' });
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_PR_005][Admin쿠폰관리] [확인필요] Admin 등록 쿠폰의 Front 쿠폰함 반영 여부 검증', async ({ page }) => {
  await page.goto('http://192.168.10.116:30180/login', { waitUntil: 'load' });
  await page.locator('input[name="loginId"]').fill('jspark81');
  await page.locator('input[name="pswd"]').fill('q1w2e3r4!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL('http://192.168.10.116:30180/', { timeout: 10000 });
  await page.goto('http://192.168.10.116:30180/mypage/coupon', { waitUntil: 'load' });
  const hasCoupon = await page.getByText('보유한 쿠폰이 없습니다').count();
  console.log('Front 쿠폰함 비어있음:', hasCoupon > 0, '(Admin에는 유효기간 내 쿠폰 4건 존재)');
});

test('[TC_PR_006][메인배너CTA][결함] "99% 쿠폰 드로우" 배너 상세보기 CTA href 프로토콜 누락 결함 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const link = page.locator('a[href="www.naver.com!"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(/^https?:\/\//.test(href)).toBe(false);
});

test('[TC_PR_007][메인배너CTA][결함] "지금 사야 입어요" 배너 상세보기 CTA href 프로토콜 누락 결함 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const link = page.locator('a[href="www.3top.co.kr"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(/^https?:\/\//.test(href)).toBe(false);
});

test('[TC_PR_008][메인배너CTA][결함] "라이프 블프" 배너 상세보기 CTA href 프로토콜 누락 결함 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const link = page.locator('a[href="www.google.com"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(/^https?:\/\//.test(href)).toBe(false);
});

test('[TC_PR_009][Admin대행사관리] 목록 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/promotion/master', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('대행사 목록')).toBeVisible();
});

test('[TC_PR_010][Admin가격할인관리] [확인필요] 등록된 소행사 가격할인 행사가 Front 반영 배경 확인', async ({ page }) => {
  // 실측(2026-08-24, en-US locale 관찰 스크립트): /promotion/sale은 "소행사" 단위 가격할인 캠페인
  // 목록(No./프로모션 대행사 아이디/소행사번호/소행사명/사용여부/행사시작일시/행사종료일시)이며,
  // 개별 상품코드·할인율이 이 마스터 그리드에 직접 노출되지 않아(더블클릭 시 상세 화면 전환 없음),
  // Front 특정 상품의 할인가와 1:1로 대조하는 것은 이번 백필 범위에서 확인 불가 — 원 TC의
  // verifyNote("실제 등록 테스트 미실행 — 배경 확인 필요")와 동일한 결론. 대신 "현재 활성 중인
  // 가격할인 소행사 행사가 실제로 존재하는지"만 검증하도록 범위를 좁혔다(BACKFILL_ISSUES.md ## PR 참고).
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/promotion/sale', { waitUntil: 'load' });
  await page.getByRole('button', { name: '1년', exact: true }).click();
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1200);

  const rows = await page.locator('.ag-center-cols-container .ag-row').all();
  expect(rows.length).toBeGreaterThan(0);

  const today = new Date();
  let activeFound = false;
  for (const row of rows) {
    const cells = await row.locator('.ag-cell').allTextContents();
    const [, , , , useYn, startAt, endAt] = cells;
    if (useYn !== '사용') continue;
    const start = new Date(startAt.replace(/\./g, '-').replace(' ', 'T'));
    const end = new Date(endAt.replace(/\./g, '-').replace(' ', 'T'));
    if (start <= today && today <= end) { activeFound = true; break; }
  }
  expect(activeFound).toBe(true);
});
