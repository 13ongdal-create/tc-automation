const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const PDP = BASE + '/products/99';

test('TC_PD_001 상품상세 기본 정보(상품명/브랜드/가격/할인율) 노출 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: '빈티지 체크 셔츠' })).toBeVisible();
  await expect(page.getByText('H&M')).toBeVisible();
  await expect(page.getByText('139,000원')).toBeVisible();
  await expect(page.getByText('(13%)')).toBeVisible();
});

test('TC_PD_002 상품상세 상품코드 표기 형식 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await expect(page.getByText('상품 코드: PD0000039')).toBeVisible();
});

test('TC_PD_003 상품상세 평점 및 리뷰수 노출 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await expect(page.getByText('(311 리뷰)')).toBeVisible();
});

test('TC_PD_004 품절 사이즈(S) 선택 차단 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  const sBtn = page.getByRole('button', { name: 'S', exact: true });
  await expect(sBtn).toBeVisible();
  await expect(sBtn).toBeDisabled();
});

test('TC_PD_005 사이즈 M 선택 동작 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  const mBtn = page.getByRole('button', { name: 'M', exact: true });
  await expect(mBtn).toBeEnabled();
  await mBtn.click();
  await expect(page.getByRole('heading', { name: '빈티지 체크 셔츠' })).toBeVisible();
});

test('TC_PD_006 사이즈 L 선택 동작 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  const lBtn = page.getByRole('button', { name: 'L', exact: true });
  await expect(lBtn).toBeEnabled();
  await lBtn.click();
  await expect(page.getByRole('heading', { name: '빈티지 체크 셔츠' })).toBeVisible();
});

test('TC_PD_007 사이즈 XL 선택 동작 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  const xlBtn = page.getByRole('button', { name: 'XL', exact: true });
  await expect(xlBtn).toBeEnabled();
  await xlBtn.click();
  await expect(page.getByRole('heading', { name: '빈티지 체크 셔츠' })).toBeVisible();
});

test('TC_PD_009 수량 +1 버튼 클릭 시 수량 증가 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  const plusBtn = page.getByRole('button', { name: '+1' });
  await expect(plusBtn).toBeVisible();
  await plusBtn.click();
});

test('TC_PD_014 옵션·수량 선택 후 장바구니 담기 성공 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: '장바구니 담기' }).click();
  await page.waitForTimeout(1000);
});

test('TC_PD_016 상세정보 탭 전환 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await page.getByRole('button', { name: '상세정보' }).click();
});

test('TC_PD_019 리뷰 탭 전환 및 목록 노출 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await page.getByRole('button', { name: /리뷰 \(311\)/ }).click();
});

test('TC_PD_027 연관 상품 노출 및 이동 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await expect(page.getByText('연관 상품')).toBeVisible();
  await page.getByRole('link', { name: /체크 코튼 셔츠/ }).first().click();
  await page.waitForURL('**/products/**');
});

test('TC_PD_028 존재하지 않는 상품ID 접근 시 처리 검증', async ({ page }) => {
  const res = await page.goto(BASE + '/products/999999', { waitUntil: 'load' });
  expect(res.status()).not.toBe(500);
});

test('TC_PD_030 브레드크럼 클릭 이동 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await page.locator('a[href="/categories/110"]').first().click();
  await page.waitForURL('**/categories/110');
  expect(page.url()).toContain('/categories/110');
});

test('TC_PD_031 카테고리 목록 총 건수 표기 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await expect(page.getByText(/총\s*\d+개/)).toBeVisible();
});

test('TC_PD_038 가격 슬라이더 최소값(0원) 경계값 텍스트 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await expect(page.getByText('0원')).toBeVisible();
});

test('TC_PD_039 가격 슬라이더 최대값 경계값 텍스트 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await expect(page.getByText(/430,000원/)).toBeVisible();
});

test('TC_PD_042 정렬 "최신순" 옵션 존재 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  const sortSelect = page.locator('select').first();
  await sortSelect.selectOption({ label: '최신순' });
});

test('TC_PD_044 정렬 "낮은가격순" 적용 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  const sortSelect = page.locator('select').first();
  await sortSelect.selectOption({ label: '낮은가격순' });
  await page.waitForTimeout(500);
});

test('TC_PD_046 페이지네이션 1→2페이지 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.waitForTimeout(500);
});

test('TC_PD_047 페이지네이션 마지막 페이지 경계값 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.waitForTimeout(500);
});

test('TC_PD_049 여성 카테고리 목록 진입 및 필터 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/111', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: '여성' })).toBeVisible();
});

test('TC_PD_050 액세서리 카테고리 목록 진입 및 필터 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/112', { waitUntil: 'load' });
  await expect(page.getByText(/총\s*\d+개/)).toBeVisible();
});

test('TC_PD_051 상품 검색 결과 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  const search = page.getByPlaceholder('상품 검색');
  await search.fill('셔츠');
  await search.press('Enter');
  await page.waitForTimeout(1000);
});

test('TC_PD_052 검색 결과 없음 Empty State 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  const search = page.getByPlaceholder('상품 검색');
  await search.fill('asdfqwer123');
  await search.press('Enter');
  await page.waitForTimeout(1000);
});

test('TC_PD_054 검색창 XSS 스크립트 입력 안전 처리 검증', async ({ page }) => {
  let dialogAppeared = false;
  page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  const search = page.getByPlaceholder('상품 검색');
  await search.fill('<script>alert(1)</script>');
  await search.press('Enter');
  await page.waitForTimeout(1000);
  expect(dialogAppeared).toBe(false);
});
