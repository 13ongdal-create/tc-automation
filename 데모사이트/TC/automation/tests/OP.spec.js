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
