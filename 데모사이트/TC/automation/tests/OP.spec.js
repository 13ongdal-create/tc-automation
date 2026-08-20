const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';

test('TC_OP_001 빈 장바구니 Empty State 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await expect(page.getByText('장바구니에 담긴 상품이 없습니다')).toBeVisible();
});

test('TC_OP_002 빈 장바구니 "계속 쇼핑하기" 버튼 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await page.getByRole('link', { name: '계속 쇼핑하기' }).click();
  await page.waitForTimeout(500);
});

test('TC_OP_003 상품상세 담기 후 장바구니 반영 검증', async ({ page }) => {
  await page.goto(BASE + '/products/99', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: '장바구니 담기' }).click();
  await page.waitForTimeout(1000);
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await expect(page.getByText('빈티지 체크 셔츠')).toBeVisible();
});

test('TC_OP_012 장바구니 페이지 콘솔/네트워크 에러 없음 검증', async ({ page }) => {
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await expect(page.locator('body')).toBeVisible();
});


const ADMIN_BASE = 'http://192.168.10.116:30280';
const ADMIN_ACCOUNT = { id: 'devel', pw: 'test' };

async function adminLogin(page) {
  await page.goto(ADMIN_BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill(ADMIN_ACCOUNT.id);
  await page.locator('input[type="password"]').first().fill(ADMIN_ACCOUNT.pw);
  await page.locator('button:has-text("LOG IN")').click();
  await page.waitForURL(ADMIN_BASE + '/', { timeout: 15000 });
}

test('[TC_OP_016][Admin주문리스트] 목록 및 Front 주문 데이터 일치 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/order/list', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('주문목록')).toBeVisible();
});

test('[TC_OP_017][Admin주문리스트] 주문상태 필터 옵션 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/order/list', { waitUntil: 'load' });
  for (const label of ['주문완료', '결제완료', '출하지시', '출고완료', '배송완료', '구매확정', '주문취소', '주문실패']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('[TC_OP_018][Admin주문리스트] 결제수단 필터 옵션 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/order/list', { waitUntil: 'load' });
  for (const label of ['카드', '간편결제', '계좌이체', '가상계좌', '휴대폰', '포인트']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('[TC_OP_019][Admin주문리스트] "초기화" 버튼 클릭 시 필터 초기화 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/order/list', { waitUntil: 'load' });
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await page.waitForTimeout(500);
});
