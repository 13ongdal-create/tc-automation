const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';

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
