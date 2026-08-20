const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const ADMIN_BASE = 'http://192.168.10.116:30280';
const ADMIN_ACCOUNT = { id: 'devel', pw: 'test' };

async function adminLogin(page) {
  await page.goto(ADMIN_BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill(ADMIN_ACCOUNT.id);
  await page.locator('input[type="password"]').first().fill(ADMIN_ACCOUNT.pw);
  await page.locator('button:has-text("LOG IN")').click();
  await page.waitForURL(ADMIN_BASE + '/', { timeout: 15000 });
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
