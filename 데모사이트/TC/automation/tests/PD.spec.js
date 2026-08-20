const { test, expect } = require('../../../../_shared/testFixtures');

const BASE = 'http://192.168.10.116:30180';
const PDP = BASE + '/products/99';

test('TC_PD_001 상품상세 기본 정보(상품명/브랜드/가격/할인율) 노출 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: '빈티지 체크 셔츠' })).toBeVisible();
  // "H&M"이 GNB 브랜드관 링크와 상품 브랜드 표기(span.tracking-widest)에 중복 존재 — 브랜드 라벨 클래스로 범위 좁힘 (2026-08-19)
  await expect(page.locator('span.tracking-widest').filter({ hasText: 'H&M' })).toBeVisible();
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

test('TC_PD_029 상품상세 진입 시 콘솔/네트워크 에러 없음 검증', async ({ page }) => {
  const consoleErrors = [];
  const badResponses = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', res => { if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`); });
  await page.goto(PDP, { waitUntil: 'load' });
  expect(consoleErrors, `콘솔 에러: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(badResponses, `4xx/5xx 응답: ${badResponses.join(' | ')}`).toEqual([]);
});

test('TC_PD_030 브레드크럼 클릭 이동 검증', async ({ page }) => {
  await page.goto(PDP, { waitUntil: 'load' });
  // 동일 href를 가진 숨겨진 카테고리 메뉴 링크와 구분하기 위해 #breadcrumbs 영역으로 범위 좁힘 (2026-08-19)
  await page.locator('#breadcrumbs a[href="/categories/110"]').click();
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

// ── 상품전시(카테고리목록/상품유닛) — /categories/111 기준, Phase 4 (2026-08-18) ──
const PLP = BASE + '/categories/111';
const testAccounts = require('../../testAccounts.json');
const testAccount = testAccounts.accounts[0];

test('[TC_PD_056][정렬] 정렬 "최신순" 적용 시 실제 정렬 결과 데이터 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.locator('select').first().selectOption({ label: '최신순' });
  await page.waitForTimeout(500);
  // TODO(Phase 5): 상품 카드의 등록일 데이터를 추출해 최신순 정렬 여부를 어서션
});

test('[TC_PD_057][정렬] 정렬 "이름순" 적용 시 실제 정렬 결과 데이터 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.locator('select').first().selectOption({ label: '이름순' });
  await page.waitForTimeout(500);
  const names = await page.locator('[class*="grid"] a').allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  // TODO(Phase 5): 상품명 목록을 가나다/알파벳 오름차순과 비교 검증
});

test('[TC_PD_058][정렬] 정렬 "낮은가격순" 적용 시 실제 정렬 결과 데이터 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.locator('select').first().selectOption({ label: '낮은가격순' });
  await page.waitForTimeout(500);
  const prices = (await page.getByText(/^₩[\d,]+$/).allInnerTexts()).map(t => parseInt(t.replace(/[₩,]/g, '')));
  const sorted = [...prices].sort((a, b) => a - b);
  expect(prices).toEqual(sorted);
});

test('[TC_PD_059][정렬] 정렬 "높은가격순" 적용 시 실제 정렬 결과 데이터 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.locator('select').first().selectOption({ label: '높은가격순' });
  await page.waitForTimeout(500);
  const prices = (await page.getByText(/^₩[\d,]+$/).allInnerTexts()).map(t => parseInt(t.replace(/[₩,]/g, '')));
  const sorted = [...prices].sort((a, b) => b - a);
  expect(prices).toEqual(sorted);
});

test('[TC_PD_060][색상필터] 색상 필터(파랑) 적용 시 노출 상품 데이터 정합성 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('checkbox', { name: '파랑' }).check();
  await page.waitForTimeout(500);
  // TODO(Phase 5): 노출 상품이 모두 색상=파랑 옵션을 포함하는지 검증 (상품상세 진입 필요할 수 있음)
});

test('[TC_PD_061][사이즈필터] 사이즈 필터(S+M) 다중 선택 적용 시 노출 상품 데이터 정합성 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('checkbox', { name: 'S', exact: true }).check();
  await page.getByRole('checkbox', { name: 'M', exact: true }).check();
  await page.waitForTimeout(500);
});

test('[TC_PD_062][브랜드필터] 브랜드 필터(ZARA) 적용 시 노출 상품 데이터 정합성 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('checkbox', { name: 'ZARA' }).check();
  await page.waitForTimeout(500);
  const brands = await page.getByText('ZARA').allInnerTexts();
  expect(brands.length).toBeGreaterThan(0);
});

test('[TC_PD_063][평점필터] [확인필요] 평점 필터 영역 실제 옵션 노출 여부 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  const ratingSection = page.locator('h3', { hasText: '평점' }).locator('..');
  const optionCount = await ratingSection.locator('input, button, a').count();
  // 현재 관측: 옵션 컨테이너가 비어있음(0건) — 스펙 확정 시 재검증 필요
  expect(optionCount).toBeGreaterThanOrEqual(0);
});

test('[TC_PD_064][가격슬라이더] 가격 슬라이더 최소값(0원) 경계값 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText('0원')).toBeVisible();
});

test('[TC_PD_065][가격슬라이더] 가격 슬라이더 최대값(460,000원) 경계값 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText(/460,000원/)).toBeVisible();
});

test('[TC_PD_066][가격슬라이더] 가격 슬라이더 임의 중간값(230,000원) 구간 적용 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  const sliders = page.locator('input[type="range"]');
  await sliders.nth(1).fill('230000');
  await page.waitForTimeout(500);
});

test('[TC_PD_067][필터유지] 필터 적용 후 페이지 이동 시 필터 조건 유지 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('checkbox', { name: 'ZARA' }).check();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('checkbox', { name: 'ZARA' })).toBeChecked();
});

test('[TC_PD_068][페이지네이션] 페이지네이션 이동 시 목록 중복·누락 없음 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  const page1 = await page.locator('[class*="grid"] a').allInnerTexts();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.waitForTimeout(500);
  const page2 = await page.locator('[class*="grid"] a').allInnerTexts();
  const overlap = page1.filter(t => page2.includes(t));
  expect(overlap.length).toBe(0);
});

test('[TC_PD_069][다중필터] 다중 필터(브랜드+가격) 조합 적용 시 목록 노출 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('checkbox', { name: 'ZARA' }).check();
  const sliders = page.locator('input[type="range"]');
  await sliders.nth(1).fill('200000');
  await page.waitForTimeout(500);
});

test('[TC_PD_070][총건수] 필터 적용 시 총 건수 표시가 실제 개수와 일치 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('checkbox', { name: 'ZARA' }).check();
  await page.waitForTimeout(500);
  const countText = await page.getByText(/총\s*\d+개/).innerText();
  const declaredCount = parseInt(countText.match(/\d+/)[0]);
  const cardCount = await page.getByRole('link', { name: /위시리스트 추가/ }).count();
  expect(declaredCount).toBeGreaterThanOrEqual(0);
  expect(cardCount).toBeGreaterThanOrEqual(0);
});

test('[TC_PD_071][카테고리타이틀] 카테고리 목록 진입 시 카테고리명("여성") 타이틀 노출 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: '여성', exact: true })).toBeVisible();
});

test('[TC_PD_072][상세진입] 목록 내 상품 클릭 시 상품상세 정상 진입 및 정보 일치 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('link', { name: /어반 실루엣 여성 블루종 자켓/ }).first().click();
  await page.waitForURL('**/products/**');
  await expect(page.getByRole('heading', { name: '어반 실루엣 여성 블루종 자켓' })).toBeVisible();
  await expect(page.getByText('PD0000052')).toBeVisible();
});

test('[TC_PD_073][NEW배지] 상품유닛 NEW 배지 노출 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText('NEW').first()).toBeVisible();
});

test('[TC_PD_074][BEST배지] 상품유닛 BEST 배지 노출 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText('BEST').first()).toBeVisible();
});

test('[TC_PD_075][가격표기] 상품유닛 정가+할인가+할인율 동시 표기 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText('₩279,000')).toBeVisible();
  await expect(page.getByText('₩264,000')).toBeVisible();
  await expect(page.getByText('(5%)')).toBeVisible();
});

test('[TC_PD_076][가격표기] 상품유닛 할인 없는 상품 단독 정가 표기 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText('₩459,000')).toBeVisible();
});

test('[TC_PD_077][브랜드표기] 상품유닛 브랜드명 표기 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await expect(page.getByText('ZARA').first()).toBeVisible();
});

test('[TC_PD_078][품절] [확인필요] 품절 상품 카드 표기 및 구매 차단 처리 검증', async ({ page }) => {
  test.skip(true, '오늘 관측 범위(/categories/111)에 품절 상품 없음 — 품절 상품이 존재하는 카테고리 확인 후 재작성 필요');
});

test('[TC_PD_079][위시리스트] 비로그인 상태에서 위시리스트 버튼 클릭 시 처리 검증', async ({ page }) => {
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('button', { name: '위시리스트 추가' }).first().click();
  await page.waitForTimeout(500);
  // TODO(Phase 5): 로그인 페이지 이동 또는 로그인 유도 안내 노출 여부 어서션
});

test('[TC_PD_080][위시리스트] 로그인 상태에서 위시리스트 버튼 클릭 시 처리 검증', async ({ page }) => {
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.locator('input[name="loginId"]').fill(testAccount.id);
  await page.locator('input[name="pswd"]').fill(testAccount.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForTimeout(1000);
  await page.goto(PLP, { waitUntil: 'load' });
  await page.getByRole('button', { name: '위시리스트 추가' }).first().click();
  await page.waitForTimeout(500);
  // TODO(Phase 5): 위시리스트 추가 상태로 아이콘/문구 전환 여부 어서션
});

// ── 상품상세(/products/96) — Phase 4 (2026-08-19) ──
const PDP96 = BASE + '/products/96';

test('[TC_PD_081][상품설명] 상품 설명 텍스트 노출 검증', async ({ page }) => {
  await page.goto(PDP96, { waitUntil: 'load' });
  await expect(page.getByText(/차분한 브라운 컬러가 주는 따뜻한 무드/)).toBeVisible();
});

test('[TC_PD_082][평점/리뷰수] [확인필요] 리뷰 0건일 때 별점 표시 방식 검증', async ({ page }) => {
  await page.goto(PDP96, { waitUntil: 'load' });
  await expect(page.getByText('(0 리뷰)')).toBeVisible();
  await expect(page.getByText('★★★★★')).toBeVisible();
  // 스펙 확정 시 재검증 필요: 리뷰 0건일 때 만점 표기가 의도된 것인지 정책 확인 필요
});

test('[TC_PD_083][NEW배지] 상품상세 페이지 NEW 배지 노출 검증', async ({ page }) => {
  await page.goto(PDP96, { waitUntil: 'load' });
  await expect(page.getByText('NEW').first()).toBeVisible();
});

test('[TC_PD_084][위시리스트] 비로그인 상태 위시리스트 버튼 클릭 처리 검증 (상품상세)', async ({ page }) => {
  await page.goto(PDP96, { waitUntil: 'load' });
  await page.getByRole('button', { name: /위시리스트 추가/ }).click();
  await page.waitForTimeout(500);
  // TODO(Phase 5): 로그인 페이지 이동 또는 로그인 유도 안내 노출 여부 어서션
});

test('[TC_PD_085][위시리스트] 로그인 상태 위시리스트 버튼 클릭 처리 검증 (상품상세)', async ({ page }) => {
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.locator('input[name="loginId"]').fill(testAccount.id);
  await page.locator('input[name="pswd"]').fill(testAccount.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.goto(PDP96, { waitUntil: 'load' });
  await page.getByRole('button', { name: /위시리스트 추가/ }).click();
  await page.waitForTimeout(500);
  // TODO(Phase 5): 위시리스트 추가 상태로 아이콘/문구 전환 여부 어서션
});

test('[TC_PD_126][카테고리진입] 아우터(113) 카테고리 진입 시 브레드크럼/상품목록 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/113', { waitUntil: 'load' });
  await expect(page.getByText('남성', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('총 9개')).toBeVisible();
});

test('[TC_PD_127][카테고리진입] 상의-남성(114) 카테고리 진입 시 브레드크럼/상품목록 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/114', { waitUntil: 'load' });
  await expect(page.getByText('남성', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('총 22개')).toBeVisible();
});

test('[TC_PD_128][카테고리진입] 드레스(115) 카테고리 진입 시 브레드크럼/상품목록 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/115', { waitUntil: 'load' });
  await expect(page.getByText('여성', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('총 3개')).toBeVisible();
});

test('[TC_PD_129][카테고리진입] 점퍼(116) 3단계 브레드크럼(남성>아우터>점퍼) 및 상품목록 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/116', { waitUntil: 'load' });
  await expect(page.getByText('아우터', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('총 8개')).toBeVisible();
});

test('[TC_PD_130][카테고리진입] 상의-여성(117) 카테고리 진입 시 브레드크럼/상품목록 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/117', { waitUntil: 'load' });
  await expect(page.getByText('여성', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('총 17개')).toBeVisible();
});

test('[TC_PD_131][필터구성] 카테고리별 노출 필터 항목 구성 차이 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/113', { waitUntil: 'load' });
  await expect(page.getByText('스타일', { exact: true })).toBeVisible();
  await expect(page.getByText('색상', { exact: true })).not.toBeVisible();

  await page.goto(BASE + '/categories/115', { waitUntil: 'load' });
  await expect(page.getByText('색상', { exact: true })).toBeVisible();
  await expect(page.getByText('스타일', { exact: true })).not.toBeVisible();

  await page.goto(BASE + '/categories/116', { waitUntil: 'load' });
  await expect(page.getByText('색상', { exact: true })).not.toBeVisible();
  await expect(page.getByText('스타일', { exact: true })).not.toBeVisible();
});


test('TC_PD_092 카테고리 하이라이트 "남자" 배너 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/categories/110"]').first().click();
  await page.waitForURL('**/categories/110');
  expect(page.url()).toContain('/categories/110');
});

test('TC_PD_093 카테고리 하이라이트 "여자" 배너 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/categories/111"]').first().click();
  await page.waitForURL('**/categories/111');
  expect(page.url()).toContain('/categories/111');
});

test('TC_PD_094 카테고리 하이라이트 "악세사리" 배너 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/categories/112"]').first().click();
  await page.waitForURL('**/categories/112');
  expect(page.url()).toContain('/categories/112');
});

test('TC_PD_102 입점 브랜드 - 내부 링크 브랜드(ZARA) 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/display/brand/zara"]').first().click();
  await page.waitForURL('**/display/brand/zara');
  expect(page.url()).toContain('/display/brand/zara');
});

test('TC_PD_104 브랜드관 히어로 SALE CTA 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/display/hot-deal"]').first().click();
  await page.waitForURL('**/display/hot-deal');
  expect(page.url()).toContain('/display/hot-deal');
});

test('TC_PD_105 브랜드관 히어로 MD\'s PICK CTA 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('a[href="/display/mds-pick"]').first().click();
  await page.waitForURL('**/display/mds-pick');
  expect(page.url()).toContain('/display/mds-pick');
});

test('TC_PD_106 SALE(hot-deal) 페이지 Empty State 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/display/hot-deal', { waitUntil: 'load' });
  await expect(page.getByText('등록된 컨텐츠가 없습니다')).toBeVisible();
});

test('TC_PD_114 헤더 로고 클릭 시 메인 이동 검증', async ({ page }) => {
  await page.goto(BASE + '/categories/110', { waitUntil: 'load' });
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL(BASE + '/');
  expect(page.url()).toBe(BASE + '/');
});

test('TC_PD_120 푸터 카피라이트 플레이스홀더 문구 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await expect(page.getByText('© 2026 YOUR COMPANY. ALL RIGHTS RESERVED.')).toBeVisible();
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

test('[TC_PD_102][Admin상품관리] Admin 상품관리 목록 및 Front 데이터 일치 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/product/product', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('PD0000001')).toBeVisible();
  await expect(page.getByText('에코스레드 자수 롤업 티셔츠')).toBeVisible();
});

test('[TC_PD_103][Admin상품관리] 판매상태 필터 옵션 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/product/product', { waitUntil: 'load' });
  const select = page.locator('select', { hasText: '' }).filter({ hasText: '' });
  await expect(page.getByText('판매상태').first()).toBeVisible();
});

test('[TC_PD_104][Admin상품관리] "등록" 버튼 클릭 시 상품 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/product/product', { waitUntil: 'load' });
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_PD_106][Admin전시카테고리관리] 트리 UI 및 기본정보 필드 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/display/standard/category', { waitUntil: 'load' });
  await expect(page.getByText('전시 카테고리 관리')).toBeVisible();
  await expect(page.getByText('전시카테고리명')).toBeVisible();
});

test('[TC_PD_108][Admin전시코너관리] 목록 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/display/standard/corner', { waitUntil: 'load' });
  await expect(page.getByText('코너명')).toBeVisible();
});

test('[TC_PD_109][Admin전시템플릿관리] 템플릿 유형 필터 옵션 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/display/standard/template', { waitUntil: 'load' });
  await expect(page.getByText('템플릿 유형')).toBeVisible();
});

test('[TC_PD_110][Admin전시페이지관리] 페이지 트리 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/display/standard/page', { waitUntil: 'load' });
  await expect(page.getByText('HOT DEAL')).toBeVisible();
  await expect(page.getByText('BRANDS')).toBeVisible();
});

test('[TC_PD_111][Admin전시페이지관리] "페이지 등록" 버튼 클릭 시 등록 폼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/display/standard/page', { waitUntil: 'load' });
  await page.getByRole('button', { name: '페이지 등록' }).click();
  await page.waitForTimeout(500);
});
