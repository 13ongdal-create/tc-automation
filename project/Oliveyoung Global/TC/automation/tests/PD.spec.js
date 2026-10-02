const { test, expect } = require('../../../../../_shared/testFixtures');

const BASE = 'https://global.oliveyoung.com';

// 영문 로케일 고정: 관찰(2026-10-01)이 en-US 기준이며, 이 spec 안에서만 적용합니다.
test.use({ locale: 'en-US', viewport: { width: 1440, height: 900 } });

// 검색 결과/브랜드 페이지는 Cloudflare 봇 차단(Access restricted, 403)이 걸려 있어 실제 로딩이 불가합니다.
// 이 spec은 헤더 검색 UI와 "이동하는 URL"만 검증하므로 두 경로는 빈 응답으로 대체합니다
// (실서버 4xx가 testFixtures의 자동 실패 판정을 유발하는 것도 함께 방지).
test.beforeEach(async ({ page }) => {
  await page.route('**/kr/search/results**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub</body></html>' }));
  await page.route('**/kr/brands/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub</body></html>' }));
});

const INPUT = '#searchIptPcV2';
const SEARCH_BTN = '.header-search-v2__button';
const POPULAR = '[data-testid="header-search-box-layer-popular"]';
const RECENT_ITEM = '[data-testid="recent-search-list-item"]';
const POPULAR_ITEM = '[data-testid="popular-search-list-item"]';
const AUTO = '.header-search-auto-layer-v2';
const AUTO_ITEM = '.header-search-auto-layer-v2__item';
const RESULTS_URL = /\/kr\/search\/results\?query=/;

// 위치 안내 팝업(#systemPopup)이 헤더 클릭을 가로막으므로(관찰 확인) 노출 후 제거합니다.
async function gotoMain(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('#systemPopup').waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { const p = document.getElementById('systemPopup'); if (p) p.remove(); });
  await expect(page.locator(INPUT)).toBeVisible();
}

async function focusSearch(page) {
  await page.locator(INPUT).click();
}

async function submitByEnter(page, query) {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill(query);
  await page.locator(INPUT).press('Enter');
  await page.waitForURL(RESULTS_URL);
}

async function searchMany(page, queries) {
  for (const q of queries) await submitByEnter(page, q);
}

async function recentTexts(page) {
  return page.locator(RECENT_ITEM).evaluateAll((els) => els.map((e) => e.getAttribute('data-search-text')));
}

test('[TC_PD_001][검색창] 헤더 검색창 및 검색 버튼 노출 검증', async ({ page }) => {
  await gotoMain(page);
  await expect(page.locator(INPUT)).toHaveAttribute('placeholder', 'Search for a product or brand...');
  await expect(page.locator(SEARCH_BTN).first()).toBeVisible();
  await expect(page.locator(SEARCH_BTN).first()).toHaveText(/Search/);
});

test('[TC_PD_002][검색창] 검색창 포커스 시 인기 검색어 레이어 노출 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await expect(page.locator(POPULAR)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Popular Searches' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Searches' })).toBeHidden();
});

test('[TC_PD_003][인기검색어] 인기 검색어 순위 표기 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  const ranks = await page.locator(`${POPULAR} .header-search-tab-layer-v2__rank`).allInnerTexts();
  expect(ranks.map((r) => r.trim())).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
});

test('[TC_PD_004][인기검색어] 인기 검색어 클릭 시 해당 키워드 검색 이동 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  const first = page.locator(POPULAR_ITEM).first();
  const keyword = await first.getAttribute('data-search-text');
  expect(keyword).toBeTruthy();
  await first.click();
  await page.waitForURL(RESULTS_URL);
  expect(new URL(page.url()).searchParams.get('query')).toBe(keyword);
});

test('[TC_PD_005][검색어제출] Enter 키 검색어 제출 이동 검증', async ({ page }) => {
  await submitByEnter(page, 'mask');
  expect(page.url()).toBe(`${BASE}/kr/search/results?query=mask`);
});

test('[TC_PD_006][검색어제출] 검색 버튼 클릭 검색어 제출 이동 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('serum');
  await page.locator(SEARCH_BTN).first().click();
  await page.waitForURL(RESULTS_URL);
  expect(page.url()).toBe(`${BASE}/kr/search/results?query=serum`);
});

test('[TC_PD_007][검색어제출] 공백만 입력 후 Enter 제출 차단 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('   ');
  await page.locator(INPUT).press('Enter');
  await page.waitForTimeout(1500);
  expect(page.url()).toBe(BASE + '/');
});

test('[TC_PD_008][검색어제출] 공백만 입력 후 검색 버튼 제출 차단 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('   ');
  await page.locator(SEARCH_BTN).first().click();
  await page.waitForTimeout(1500);
  expect(page.url()).toBe(BASE + '/');
});

test('[TC_PD_009][검색어제출] 검색어 앞뒤 공백 제거 후 제출 검증', async ({ page }) => {
  await submitByEnter(page, '  mask  ');
  expect(page.url()).toBe(`${BASE}/kr/search/results?query=mask`);
});

test('[TC_PD_010][검색어제출] SQL 구문 형태 검색어 URL 인코딩 제출 검증', async ({ page }) => {
  await submitByEnter(page, "' OR 1=1 --");
  expect(page.url()).toBe(`${BASE}/kr/search/results?query=%27%20OR%201%3D1%20--`);
});

test('[TC_PD_011][검색어제출] 스크립트 태그 검색어 최근 검색어 텍스트 표시 검증', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', async (d) => { dialogFired = true; await d.dismiss(); });
  const payload = '<script>alert(1)</script>';
  await submitByEnter(page, payload);
  await gotoMain(page);
  await focusSearch(page);
  await expect(page.locator(RECENT_ITEM).first()).toHaveText(payload);
  expect(await page.locator('.header-search-tab-layer-v2 script').count()).toBe(0);
  expect(dialogFired).toBe(false);
});

test('[TC_PD_012][검색어제출] [확인필요] 200자 장문 검색어 제출 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('a'.repeat(200));
  await page.locator(INPUT).press('Enter');
  await page.waitForTimeout(1500);
  expect(page.url()).toBe(BASE + '/');
});

test.describe('모바일 뷰포트', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('[TC_PD_013][검색어제출] 모바일 화면 검색 입력창 최대 입력 길이 검증', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('#systemPopup').waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
    await page.evaluate(() => { const p = document.getElementById('systemPopup'); if (p) p.remove(); });
    const mo = page.locator('#searchIptMo');
    await expect(mo).toBeVisible();
    await expect(mo).toHaveAttribute('maxlength', '165');
  });
});

test('[TC_PD_014][최근검색어] 검색 이력 최근 검색어 저장 및 노출 검증', async ({ page }) => {
  await submitByEnter(page, 'mask');
  await gotoMain(page);
  await focusSearch(page);
  await expect(page.getByRole('heading', { name: 'Recent Searches' })).toBeVisible();
  expect(await recentTexts(page)).toEqual(['mask']);
  await expect(page.locator('.header-search-tab-layer-v2__clear-all')).toBeVisible();
});

test('[TC_PD_015][최근검색어] 최근 검색어 최신순 정렬 검증', async ({ page }) => {
  await searchMany(page, ['mask', 'serum']);
  await gotoMain(page);
  await focusSearch(page);
  expect(await recentTexts(page)).toEqual(['serum', 'mask']);
});

test('[TC_PD_016][최근검색어] 동일 검색어 재검색 시 최근 검색어 중복 제거 검증', async ({ page }) => {
  await searchMany(page, ['mask', 'serum', 'mask']);
  await gotoMain(page);
  await focusSearch(page);
  expect(await recentTexts(page)).toEqual(['mask', 'serum']);
});

test('[TC_PD_017][최근검색어] 최근 검색어 클릭 시 해당 키워드 검색 이동 검증', async ({ page }) => {
  await submitByEnter(page, 'mask');
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(RECENT_ITEM, { hasText: 'mask' }).click();
  await page.waitForURL(RESULTS_URL);
  expect(page.url()).toBe(`${BASE}/kr/search/results?query=mask`);
});

test('[TC_PD_018][최근검색어] 최근 검색어 개별 삭제 검증', async ({ page }) => {
  await searchMany(page, ['mask', 'serum', 'toner']);
  await gotoMain(page);
  await focusSearch(page);
  expect(await recentTexts(page)).toEqual(['toner', 'serum', 'mask']);
  await page.locator('.header-search-tab-layer-v2__remove').nth(1).click();
  expect(await recentTexts(page)).toEqual(['toner', 'mask']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { const p = document.getElementById('systemPopup'); if (p) p.remove(); });
  await focusSearch(page);
  expect(await recentTexts(page)).toEqual(['toner', 'mask']);
});

test('[TC_PD_019][최근검색어] 최근 검색어 전체 삭제(Clear All) 검증', async ({ page }) => {
  await searchMany(page, ['mask', 'serum']);
  await gotoMain(page);
  await focusSearch(page);
  await page.locator('.header-search-tab-layer-v2__clear-all').click();
  await expect(page.locator(RECENT_ITEM)).toHaveCount(0);
  await expect(page.locator(POPULAR)).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { const p = document.getElementById('systemPopup'); if (p) p.remove(); });
  await focusSearch(page);
  await expect(page.locator(RECENT_ITEM)).toHaveCount(0);
});

test('[TC_PD_020][자동완성] 검색어 입력 시 자동완성 레이어 노출 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('mask');
  await expect(page.locator(AUTO).first()).toBeVisible();
  // "Brand" 구분 항목과 그 외(상품명) 항목이 함께 존재 — 특정 브랜드/상품명은 변동되므로 구조만 검증
  await expect(page.locator(AUTO_ITEM).filter({ hasText: 'Brand' }).first()).toBeVisible();
  expect(await page.locator(`${AUTO} a`).count()).toBeGreaterThan(
    await page.locator(AUTO_ITEM).filter({ hasText: 'Brand' }).count());
});

test('[TC_PD_021][자동완성] 자동완성 일치 문자열 강조 표시 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('mask');
  const hl = page.locator('.header-search-auto-layer-v2__highlight');
  await expect(hl.first()).toBeVisible();
  const texts = await hl.allInnerTexts();
  expect(texts.length).toBeGreaterThan(0);
  for (const t of texts) expect(t.trim().toLowerCase()).toBe('mask');
});

test('[TC_PD_022][자동완성] 자동완성 대소문자 비구분 동일 결과 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  const input = page.locator(INPUT);
  const listOf = async () => page.locator(AUTO_ITEM).evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim().toLowerCase()));
  await input.fill('mask');
  await expect(page.locator(AUTO_ITEM).first()).toBeVisible();
  await page.waitForTimeout(1000);
  const lower = await listOf();
  await input.fill('');
  await input.fill('MASK');
  await expect(page.locator(AUTO_ITEM).first()).toBeVisible();
  await page.waitForTimeout(1000);
  const upper = await listOf();
  expect(upper.length).toBeGreaterThan(0);
  expect(upper).toEqual(lower);
});

test('[TC_PD_023][자동완성] 자동완성 브랜드 항목 클릭 시 브랜드 페이지 이동 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('mask');
  await page.locator(AUTO_ITEM).filter({ hasText: 'Brand' }).first().click();
  await page.waitForURL('**/kr/brands/**');
  expect(new URL(page.url()).pathname).toMatch(/^\/kr\/brands\/.+/);
});

test('[TC_PD_024][자동완성] 검색 결과가 없는 검색어 입력 시 자동완성 미노출 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('zzxxqqnoresult123');
  await page.waitForTimeout(1500);
  await expect(page.locator(AUTO_ITEM)).toHaveCount(0);
  await expect(page.locator(POPULAR)).toBeVisible();
});

test('[TC_PD_025][자동완성] 입력값 삭제 시 인기 검색어 레이어 복귀 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await page.locator(INPUT).fill('mask');
  await expect(page.locator(AUTO_ITEM).first()).toBeVisible();
  await page.locator(INPUT).fill('');
  await expect(page.locator(AUTO_ITEM)).toHaveCount(0);
  await expect(page.locator(POPULAR)).toBeVisible();
});

test('[TC_PD_027][자동완성] Esc 키 입력 시 검색 레이어 닫힘 검증', async ({ page }) => {
  await gotoMain(page);
  await focusSearch(page);
  await expect(page.locator(POPULAR)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(POPULAR)).toBeHidden();
});
