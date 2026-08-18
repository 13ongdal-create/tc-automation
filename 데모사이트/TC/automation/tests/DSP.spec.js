const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';

test('TC_DSP_004 [확인필요] "99% 쿠폰 드로우" 배너 상세보기 CTA href 프로토콜 누락 결함 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const link = page.locator('a[href="www.naver.com!"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(/^https?:\/\//.test(href)).toBe(false);
});

test('TC_DSP_005 [확인필요] "지금 사야 입어요" 배너 상세보기 CTA href 프로토콜 누락 결함 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const link = page.locator('a[href="www.3top.co.kr"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(/^https?:\/\//.test(href)).toBe(false);
});

test('TC_DSP_006 [확인필요] "라이프 블프" 배너 상세보기 CTA href 프로토콜 누락 결함 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const link = page.locator('a[href="www.google.com"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(/^https?:\/\//.test(href)).toBe(false);
});

test('TC_DSP_007 카테고리 하이라이트 "남자" 배너 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/categories/110"]').first().click();
  await page.waitForURL('**/categories/110');
  expect(page.url()).toContain('/categories/110');
});

test('TC_DSP_008 카테고리 하이라이트 "여자" 배너 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/categories/111"]').first().click();
  await page.waitForURL('**/categories/111');
  expect(page.url()).toContain('/categories/111');
});

test('TC_DSP_009 카테고리 하이라이트 "악세사리" 배너 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/categories/112"]').first().click();
  await page.waitForURL('**/categories/112');
  expect(page.url()).toContain('/categories/112');
});

test('TC_DSP_017 입점 브랜드 - 내부 링크 브랜드(ZARA) 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/display/brand/zara"]').first().click();
  await page.waitForURL('**/display/brand/zara');
  expect(page.url()).toContain('/display/brand/zara');
});

test('TC_DSP_019 브랜드관 히어로 SALE CTA 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/display/hot-deal"]').first().click();
  await page.waitForURL('**/display/hot-deal');
  expect(page.url()).toContain('/display/hot-deal');
});

test('TC_DSP_020 브랜드관 히어로 MD\'s PICK CTA 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/display/mds-pick"]').first().click();
  await page.waitForURL('**/display/mds-pick');
  expect(page.url()).toContain('/display/mds-pick');
});

test('TC_DSP_021 SALE(hot-deal) 페이지 Empty State 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/display/hot-deal', { waitUntil: 'load' });
  await expect(page.getByText('등록된 컨텐츠가 없습니다')).toBeVisible();
});

test('TC_DSP_029 헤더 로고 클릭 시 메인 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL(BASE + '/');
  expect(page.url()).toBe(BASE + '/');
});

test('TC_DSP_035 푸터 카피라이트 플레이스홀더 문구 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await expect(page.getByText('© 2026 YOUR COMPANY. ALL RIGHTS RESERVED.')).toBeVisible();
});
