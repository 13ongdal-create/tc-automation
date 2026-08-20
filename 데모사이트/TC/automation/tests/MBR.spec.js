const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const ACCOUNT = { id: 'jspark81', pw: 'q1w2e3r4!' };

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.locator('input[name="loginId"]').fill(ACCOUNT.id);
  await page.locator('input[name="pswd"]').fill(ACCOUNT.pw);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL(BASE + '/', { timeout: 10000 });
}

async function addToCartAndGoToCheckout(page) {
  await page.goto(BASE + '/products/99', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: /장바구니 담기/ }).click();
  await page.waitForTimeout(2500);
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: '주문하기', exact: true }).click();
  await page.waitForURL('**/checkout', { timeout: 10000 });
}

test('[TC_MBR_036][GNB 상태표시] 비로그인 상태 GNB "회원가입/로그인" 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await expect(page.getByRole('link', { name: '회원가입' })).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
});

test('[TC_MBR_037][GNB 상태표시] 로그인 상태 GNB "OOO님 안녕하세요/로그아웃" 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await expect(page.getByText(/님 안녕하세요/)).toBeVisible();
  await expect(page.getByText('로그아웃')).toBeVisible();
  await expect(page.getByRole('link', { name: '회원가입' })).not.toBeVisible();
});

test('[TC_MBR_038][마이페이지 접근제어] 비로그인 상태 마이페이지 접근 시 로그인 페이지로 리다이렉트 검증', async ({ page }) => {
  await page.goto(BASE + '/mypage', { waitUntil: 'load' });
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fmypage/);
});

test('[TC_MBR_039][마이페이지 서브메뉴] 로그인 상태 마이페이지 서브메뉴 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage', { waitUntil: 'load' });
  for (const label of ['주문내역', 'SNS 연결설정', '위시리스트', '배송주소록 관리', '쿠폰', '1:1 문의', '리뷰 목록']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('[TC_MBR_040][마이페이지 기본정보] 로그인 상태 기본정보 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage', { waitUntil: 'load' });
  await expect(page.getByText('박지숙')).toBeVisible();
  await expect(page.getByText('jspark81', { exact: true })).toBeVisible();
  await expect(page.getByText('jspark81@3top.co.kr')).toBeVisible();
});

test('[TC_MBR_041][체크아웃 연동] 로그인 상태 체크아웃 배송정보 자동 채움 검증', async ({ page }) => {
  await login(page);
  await addToCartAndGoToCheckout(page);
  await expect(page.locator('input[placeholder="이름을 입력해주세요"]')).toHaveValue('박지숙');
  await expect(page.locator('input[placeholder="이메일 주소를 입력해주세요"]')).toHaveValue('jspark81@3top.co.kr');
  await expect(page.locator('input[placeholder="010-0000-0000"]')).toHaveValue('01084131696');
});

test('[TC_MBR_042][체크아웃 연동] 비로그인 상태 체크아웃 배송정보 공란 검증', async ({ page }) => {
  await addToCartAndGoToCheckout(page);
  await expect(page.locator('input[placeholder="이름을 입력해주세요"]')).toHaveValue('');
  await expect(page.locator('input[placeholder="이메일 주소를 입력해주세요"]')).toHaveValue('');
  await expect(page.locator('input[placeholder="010-0000-0000"]')).toHaveValue('');
});

test('[TC_MBR_043][로그아웃] 로그아웃 클릭 시 GNB 비회원 상태 전환 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.getByText('로그아웃').click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('link', { name: '회원가입' })).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
});
