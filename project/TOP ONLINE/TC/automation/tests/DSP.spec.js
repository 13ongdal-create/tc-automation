const { test, expect } = require('../../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const PAGE_PATH = '/display/mds-pick';
const ACCOUNT = { id: 'jspark81', pw: 'q1w2e3r4!' };

// DEF_TOP ONLINE_002(Next.js Server Components 간헐적 500)로 인해 /login·/products/{id} 접속이
// 간헐적으로 실패한다(재현율 실측 근거: TC_DSP_034). 데모사이트 adminLogin() 패턴과 동일하게
// 재시도 로직을 둔다 — 재시도로도 매번 실패하면 결함일 가능성을 의심하고 그대로 실패시킨다.
async function gotoWithRetry(page, path, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 15000 });
      const bodyText = await page.locator('body').innerText();
      if (!bodyText.includes('시스템 오류가 발생했습니다')) return;
      lastError = new Error('Server Components 렌더링 500 에러 페이지 (DEF_TOP ONLINE_002)');
    } catch (e) {
      lastError = e;
    }
    await page.waitForTimeout(800);
  }
  throw lastError;
}

async function loginWithRetry(page, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await gotoWithRetry(page, '/login?callbackUrl=%2Fdisplay%2Fmds-pick');
    await page.locator('#loginId').fill(ACCOUNT.id);
    await page.locator('#pswd').fill(ACCOUNT.pw);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1500);
    if (!page.url().includes('/login')) return;
  }
  throw new Error('로그인 재시도(' + maxAttempts + '회) 후에도 /login 페이지에 머물러 있음');
}

function card(page, index) {
  // 카드 1개 = "자세히 보기" 링크와 "위시리스트 추가" 버튼을 함께 포함하는 section.grid 블록
  // (2026-08-25 실측 DOM 구조 확인: section.grid가 카드당 1개씩, 3개 존재).
  // 카드 index는 MD's PICK 편성 순서 기준 — 편성 자체가 바뀌면 카드 내용도 함께 바뀌므로 하드코딩이 아님.
  return page.locator('section.grid').nth(index);
}

async function detailLinkHref(page, index) {
  return page.locator('a[href^="/products/"]:has-text("자세히 보기")').nth(index).getAttribute('href');
}

async function priceOnDetail(page, href) {
  await gotoWithRetry(page, href);
  const text = await page.locator('body').innerText();
  const match = text.match(/([0-9][0-9,]*)원/);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
}

test.describe('MD\'s PICK 전시 페이지 (DSP)', () => {

  // ── 헤더/레이아웃 ──────────────────────────────────────────────
  test('[TC_DSP_001][헤더/레이아웃] MD\'s PICK 페이지 헤더(H1)·부제 노출 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    await expect(page.getByRole('heading', { name: /이번 주 MD's PICK/ })).toBeVisible();
    await expect(page.getByText('가볍고 시원한 여름 스타일')).toBeVisible();
  });

  test('[TC_DSP_002][헤더/레이아웃] 모바일 뷰포트(390px)에서 페이지 레이아웃 정상 렌더링 검증', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithRetry(page, PAGE_PATH);
    await expect(page.getByRole('heading', { name: /이번 주 MD's PICK/ })).toBeVisible();
    expect(await page.locator('a[href^="/products/"]:has-text("자세히 보기")').count()).toBeGreaterThanOrEqual(1);
  });

  // ── 상품카드표시 ───────────────────────────────────────────────
  test('[TC_DSP_003][상품카드표시] 카드1 공통 표시요소 노출 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    await expect(c.getByText('RECOMMENDATION')).toBeVisible();
    await expect(c.getByText(/원/)).toBeVisible();
    await expect(c.getByText('위시리스트 추가')).toBeVisible();
    await expect(c.getByText('자세히 보기')).toBeVisible();
  });

  test('[TC_DSP_004][상품카드표시] 카드2 공통 표시요소 노출 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 1);
    await expect(c.getByText('RECOMMENDATION')).toBeVisible();
    await expect(c.getByText(/원/)).toBeVisible();
    await expect(c.getByText('위시리스트 추가')).toBeVisible();
    await expect(c.getByText('자세히 보기')).toBeVisible();
  });

  test('[TC_DSP_005][상품카드표시] 카드3 공통 표시요소 노출 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 2);
    await expect(c.getByText('RECOMMENDATION')).toBeVisible();
    await expect(c.getByText(/원/)).toBeVisible();
    await expect(c.getByText('위시리스트 추가')).toBeVisible();
    await expect(c.getByText('자세히 보기')).toBeVisible();
  });

  // ── 가격표시·데이터정합성 ─────────────────────────────────────
  test('[TC_DSP_006][가격표시·데이터정합성] 카드1 표시 할인율과 정가·판매가 기준 계산값 일치 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    const text = await c.innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    const rateMatch = text.match(/\((\d+)%\)/) || text.match(/(\d+)%/);
    expect(prices.length).toBeGreaterThanOrEqual(2);
    const [sale, base] = prices[0] < prices[1] ? [prices[0], prices[1]] : [prices[1], prices[0]];
    const calcRate = Math.round(((base - sale) / base) * 100);
    const displayedRate = rateMatch ? parseInt(rateMatch[1], 10) : null;
    // 알려진 결함(DEF_TOP ONLINE_001)으로 실측 시 불일치가 재현됨 — 자동화는 사실 그대로 어서션한다.
    expect(displayedRate).toBe(calcRate);
  });

  test('[TC_DSP_007][가격표시·데이터정합성] 카드1 MD\'s PICK 판매가와 상품상세 판매가 정합성 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    const text = await c.innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    const listSalePrice = Math.min(...prices);
    const href = await detailLinkHref(page, 0);
    const detailPrice = await priceOnDetail(page, href);
    expect(detailPrice).toBe(listSalePrice);
  });

  test('[TC_DSP_008][가격표시·데이터정합성] 카드2 표시 할인율과 정가·판매가 기준 계산값 일치 검증(오차범위 포함)', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 1);
    const text = await c.innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    const rateMatch = text.match(/(\d+)%/);
    const [sale, base] = prices[0] < prices[1] ? [prices[0], prices[1]] : [prices[1], prices[0]];
    const calcRate = ((base - sale) / base) * 100;
    const displayedRate = rateMatch ? parseInt(rateMatch[1], 10) : null;
    expect(Math.abs(displayedRate - calcRate)).toBeLessThanOrEqual(1);
  });

  test('[TC_DSP_009][가격표시·데이터정합성] 카드2 MD\'s PICK 판매가와 상품상세 판매가 정합성 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 1);
    const text = await c.innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    const listSalePrice = Math.min(...prices);
    const href = await detailLinkHref(page, 1);
    const detailPrice = await priceOnDetail(page, href);
    expect(detailPrice).toBe(listSalePrice);
  });

  test('[TC_DSP_010][가격표시·데이터정합성] 카드3 비할인 상품의 할인율 배지 미노출 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 2);
    const text = await c.innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)];
    expect(prices.length).toBe(1);
    expect(text).not.toMatch(/%\)/);
  });

  test('[TC_DSP_011][가격표시·데이터정합성] 카드3 MD\'s PICK 판매가와 상품상세 판매가 정합성 검증(회귀)', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 2);
    const text = await c.innerText();
    const price = parseInt(text.match(/([0-9][0-9,]*)원/)[1].replace(/,/g, ''), 10);
    const href = await detailLinkHref(page, 2);
    const detailPrice = await priceOnDetail(page, href);
    expect(detailPrice).toBe(price);
  });

  test('[TC_DSP_012][가격표시·데이터정합성] 카드1 상품상세 페이지 자체의 표시 할인율 내부 정합성 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const href = await detailLinkHref(page, 0);
    await gotoWithRetry(page, href);
    const text = await page.locator('body').innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    const rateMatch = text.match(/\((\d+)%\)/);
    if (!rateMatch) test.skip(true, '이 상품에 할인율 배지가 없음(할인 없는 상품으로 편성 변경됨)');
    const [sale, base] = prices[0] < prices[1] ? [prices[0], prices[1]] : [prices[1], prices[0]];
    const calcRate = Math.round(((base - sale) / base) * 100);
    expect(parseInt(rateMatch[1], 10)).toBe(calcRate);
  });

  test('[TC_DSP_013][가격표시·데이터정합성] 카드2 상품상세 페이지 자체의 표시 할인율 내부 정합성 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const href = await detailLinkHref(page, 1);
    await gotoWithRetry(page, href);
    const text = await page.locator('body').innerText();
    const prices = [...text.matchAll(/([0-9][0-9,]*)원/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    const rateMatch = text.match(/\((\d+)%\)/);
    if (!rateMatch) test.skip(true, '이 상품에 할인율 배지가 없음(할인 없는 상품으로 편성 변경됨)');
    const [sale, base] = prices[0] < prices[1] ? [prices[0], prices[1]] : [prices[1], prices[0]];
    const calcRate = Math.round(((base - sale) / base) * 100);
    expect(Math.abs(parseInt(rateMatch[1], 10) - calcRate)).toBeLessThanOrEqual(1);
  });

  // ── 네비게이션 ─────────────────────────────────────────────────
  for (const [idx, tcId] of [[0, 'TC_DSP_014'], [1, 'TC_DSP_015'], [2, 'TC_DSP_016']]) {
    test(`[${tcId}][네비게이션] 카드${idx + 1} "자세히 보기" 클릭 시 일치하는 상품상세로 이동 검증`, async ({ page }) => {
      await gotoWithRetry(page, PAGE_PATH);
      const c = card(page, idx);
      const productName = (await c.getByRole('heading').first().innerText()).trim();
      const href = await detailLinkHref(page, idx);
      await gotoWithRetry(page, href);
      await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
    });
  }

  // ── 위시리스트(비로그인) ──────────────────────────────────────
  test('[TC_DSP_017][위시리스트] 비로그인 상태 "위시리스트 추가" 클릭 시 로그인 페이지 이동 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    await card(page, 0).getByText('위시리스트 추가').click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('callbackUrl');
  });

  // ── 위시리스트(로그인) ────────────────────────────────────────
  test('[TC_DSP_018][위시리스트] 로그인 상태 카드1 "위시리스트 추가" 클릭 시 버튼 라벨 토글 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    const urlBefore = page.url();
    await c.getByText('위시리스트 추가').click();
    await page.waitForTimeout(1000);
    expect(page.url()).toBe(urlBefore);
    await expect(c.getByText('위시리스트 제거')).toBeVisible();
  });

  test('[TC_DSP_019][위시리스트] 카드1 위시리스트 추가 후 마이페이지 반영 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    const productName = (await c.getByRole('heading').first().innerText()).trim();
    await c.getByText('위시리스트 추가').click();
    await page.waitForTimeout(1000);
    await gotoWithRetry(page, '/mypage/wishlist');
    await expect(page.getByText(productName)).toBeVisible();
  });

  test('[TC_DSP_020][위시리스트] 카드1 위시리스트 "제거" 재클릭 시 토글 복원 및 마이페이지 반영 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    const productName = (await c.getByRole('heading').first().innerText()).trim();
    if (await c.getByText('위시리스트 추가').isVisible()) {
      await c.getByText('위시리스트 추가').click();
      await page.waitForTimeout(1000);
    }
    await c.getByText('위시리스트 제거').click();
    await page.waitForTimeout(1000);
    await expect(c.getByText('위시리스트 추가')).toBeVisible();
    await gotoWithRetry(page, '/mypage/wishlist');
    await expect(page.getByText(productName)).toHaveCount(0);
  });

  test('[TC_DSP_021][위시리스트] 로그인 상태 카드2 "위시리스트 추가" 클릭 시 버튼 라벨 토글 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 1);
    await c.getByText('위시리스트 추가').click();
    await page.waitForTimeout(1000);
    await expect(c.getByText('위시리스트 제거')).toBeVisible();
  });

  test('[TC_DSP_022][위시리스트] 카드2 위시리스트 추가 후 마이페이지 반영 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 1);
    const productName = (await c.getByRole('heading').first().innerText()).trim();
    await c.getByText('위시리스트 추가').click();
    await page.waitForTimeout(1000);
    await gotoWithRetry(page, '/mypage/wishlist');
    await expect(page.getByText(productName)).toBeVisible();
  });

  test('[TC_DSP_023][위시리스트] 로그인 상태 카드3 "위시리스트 추가" 클릭 시 버튼 라벨 토글 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 2);
    await c.getByText('위시리스트 추가').click();
    await page.waitForTimeout(1000);
    await expect(c.getByText('위시리스트 제거')).toBeVisible();
  });

  test('[TC_DSP_024][위시리스트] 이미 위시리스트에 담긴 상품의 카드 재진입 시 초기 버튼 라벨 상태 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    if (await c.getByText('위시리스트 추가').isVisible()) {
      await c.getByText('위시리스트 추가').click();
      await page.waitForTimeout(1000);
    }
    await gotoWithRetry(page, PAGE_PATH);
    await expect(card(page, 0).getByText('위시리스트 제거')).toBeVisible();
  });

  test('[TC_DSP_025][위시리스트] 위시리스트 추가 후 새로고침 시 버튼 상태 유지 검증(회귀)', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    if (await c.getByText('위시리스트 추가').isVisible()) {
      await c.getByText('위시리스트 추가').click();
      await page.waitForTimeout(1000);
    }
    await page.reload({ waitUntil: 'load' });
    await expect(card(page, 0).getByText('위시리스트 제거')).toBeVisible();
  });

  // ── 품질·비기능 ────────────────────────────────────────────────
  test('[TC_DSP_026][품질·비기능] 데스크톱 뷰포트 진입 시 콘솔 에러·4xx/5xx 응답 없음 검증(회귀)', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    await expect(page.getByRole('heading', { name: /이번 주 MD's PICK/ })).toBeVisible();
    // 콘솔 에러/4xx·5xx 응답 감지는 _shared/testFixtures.js가 공통으로 처리 (AGENTS.md 19항)
  });

  test('[TC_DSP_027][품질·비기능] 모바일 뷰포트 진입 시 콘솔 에러·4xx/5xx 응답 없음 검증(회귀)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithRetry(page, PAGE_PATH);
    await expect(page.getByRole('heading', { name: /이번 주 MD's PICK/ })).toBeVisible();
  });

  // ── SEO·성능·접근성 ────────────────────────────────────────────
  test('[TC_DSP_028][SEO·성능·접근성] [확인필요] MD\'s PICK 페이지의 title/og:title이 페이지 고유값을 갖는지 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const title = await page.title();
    // 알려진 결함(관행 추정 근거, verifyNote 참조): 현재 사이트 전역 고정 타이틀 "Top online store" 사용 중
    expect(title).not.toBe('Top online store');
  });

  test('[TC_DSP_029][SEO·성능·접근성] 상품 카드 이미지의 지연 로딩(lazy loading) 속성 적용 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const loadingAttr = await page.locator('img[alt]').nth(1).getAttribute('loading');
    expect(loadingAttr).toBe('lazy');
  });

  test('[TC_DSP_030][SEO·성능·접근성] Tab 키만으로 카드의 "자세히 보기"/"위시리스트 추가" 컨트롤 포커스 도달 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const detailLink = page.locator('a[href^="/products/"]:has-text("자세히 보기")').first();
    await detailLink.focus();
    await expect(detailLink).toBeFocused();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.textContent);
    expect(focused).toContain('위시리스트');
  });

  test('[TC_DSP_031][SEO·성능·접근성] 포커스된 "위시리스트 추가" 버튼에서 Enter 키 입력 시 정상 동작 검증', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    const wishBtn = card(page, 0).getByText('위시리스트 추가');
    await wishBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
  });

  // ── 예외 ───────────────────────────────────────────────────────
  test('[TC_DSP_032][예외] [확인필요] 상품 카드 0건(편성 없음) 시 Empty State 노출 여부', async ({ page }) => {
    test.skip(true, '현재 3건 편성 중이라 0건 상태를 실측으로 재현할 수 없음 — 편성 데이터를 조작할 BO 접근권한 확보 후 재검토');
  });

  test('[TC_DSP_033][예외] [확인필요] MD\'s PICK 카드 영역에 "장바구니 담기" 버튼 부재의 의도된 설계 여부', async ({ page }) => {
    await gotoWithRetry(page, PAGE_PATH);
    // 알려진 관행 추정(verifyNote 참조): 실측 결과 카드 영역에는 버튼이 없음(페이지 전체에도 0개)
    await expect(page.getByText('장바구니 담기')).toHaveCount(0);
  });

  // ── 로그인 안정성 / 레이스컨디션 ──────────────────────────────
  test('[TC_DSP_034][품질·비기능] Front 로그인(/login) 접속 시 간헐적 500/무응답 실패 검증', async ({ page }) => {
    const attempts = 5;
    let failures = 0;
    for (let i = 0; i < attempts; i++) {
      await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 15000 }).catch(() => { failures++; return; });
      const text = await page.locator('body').innerText();
      if (text.includes('시스템 오류가 발생했습니다')) failures++;
      await page.waitForTimeout(300);
    }
    // 알려진 결함(DEF_TOP ONLINE_002) — 간헐적 실패가 실제로 존재함을 재확인하는 목적의 TC이므로
    // 0건이어야 통과하되, 결함이 해결되기 전까지는 Fail이 정상(20-7항 "결함 재현 목적 TC"에 해당).
    expect(failures).toBe(0);
  });

  test('[TC_DSP_035][위시리스트] 동일 위시리스트 버튼 연속 클릭 시 레이스 컨디션 없이 최종 상태 일관성 유지 검증', async ({ page }) => {
    await loginWithRetry(page);
    await gotoWithRetry(page, PAGE_PATH);
    const c = card(page, 0);
    const productName = (await c.getByRole('heading').first().innerText()).trim();
    if (await c.getByText('위시리스트 추가').isVisible()) {
      const btn = c.getByText('위시리스트 추가');
      await Promise.all([btn.click(), btn.click({ force: true }).catch(() => {})]);
    }
    await page.waitForTimeout(1500);
    await gotoWithRetry(page, '/mypage/wishlist');
    const count = await page.getByText(productName).count();
    expect(count).toBeLessThanOrEqual(1);
  });

});
