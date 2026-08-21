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

test('[TC_MB_036][GNB 상태표시] 비로그인 상태 GNB "회원가입/로그인" 노출 검증', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await expect(page.getByRole('link', { name: '회원가입' })).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
});

test('[TC_MB_037][GNB 상태표시] 로그인 상태 GNB "OOO님 안녕하세요/로그아웃" 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await expect(page.getByText(/님 안녕하세요/)).toBeVisible();
  await expect(page.getByText('로그아웃')).toBeVisible();
  await expect(page.getByRole('link', { name: '회원가입' })).not.toBeVisible();
});

test('[TC_MB_038][마이페이지 접근제어] 비로그인 상태 마이페이지 접근 시 로그인 페이지로 리다이렉트 검증', async ({ page }) => {
  await page.goto(BASE + '/mypage', { waitUntil: 'load' });
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fmypage/);
});

test('[TC_MB_039][마이페이지 서브메뉴] 로그인 상태 마이페이지 서브메뉴 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage', { waitUntil: 'load' });
  for (const label of ['주문내역', 'SNS 연결설정', '위시리스트', '배송주소록 관리', '쿠폰', '1:1 문의', '리뷰 목록']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('[TC_MB_040][마이페이지 기본정보] 로그인 상태 기본정보 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage', { waitUntil: 'load' });
  await expect(page.getByText('박지숙')).toBeVisible();
  await expect(page.getByText('jspark81', { exact: true })).toBeVisible();
  await expect(page.getByText('jspark81@3top.co.kr')).toBeVisible();
});

test('[TC_MB_041][체크아웃 연동] 로그인 상태 체크아웃 배송정보 자동 채움 검증', async ({ page }) => {
  await login(page);
  await addToCartAndGoToCheckout(page);
  await expect(page.locator('input[placeholder="이름을 입력해주세요"]')).toHaveValue('박지숙');
  await expect(page.locator('input[placeholder="이메일 주소를 입력해주세요"]')).toHaveValue('jspark81@3top.co.kr');
  await expect(page.locator('input[placeholder="010-0000-0000"]')).toHaveValue('01084131696');
});

test('[TC_MB_042][체크아웃 연동] 비로그인 상태 체크아웃 배송정보 공란 검증', async ({ page }) => {
  await addToCartAndGoToCheckout(page);
  await expect(page.locator('input[placeholder="이름을 입력해주세요"]')).toHaveValue('');
  await expect(page.locator('input[placeholder="이메일 주소를 입력해주세요"]')).toHaveValue('');
  await expect(page.locator('input[placeholder="010-0000-0000"]')).toHaveValue('');
});

test('[TC_MB_043][로그아웃] 로그아웃 클릭 시 GNB 비회원 상태 전환 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.getByText('로그아웃').click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('link', { name: '회원가입' })).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
});


const ADMIN_BASE = 'http://192.168.10.116:30280';
const ADMIN_ACCOUNT = { id: 'devel', pw: 'test' };

async function adminLogin(page) {
  // 라이브 환경에서 Admin 로그인 API가 간헐적으로 500을 반환하는 현상 확인(2026-08-21) — 최대 3회 재시도
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(ADMIN_BASE + '/login', { waitUntil: 'networkidle' });
    await page.locator('input[type="text"]').first().fill(ADMIN_ACCOUNT.id);
    await page.locator('input[type="password"]').first().fill(ADMIN_ACCOUNT.pw);
    await page.locator('button:has-text("LOG IN")').click();
    try {
      await page.waitForURL(ADMIN_BASE + '/', { timeout: 8000 });
      return;
    } catch (e) {
      if (attempt === 3) throw new Error('Admin 로그인 3회 시도 후에도 실패 (서버 응답 불안정 — 라이브 환경 간헐적 이슈로 추정)');
      await page.waitForTimeout(2000);
    }
  }
}

test('[TC_MB_044][Admin회원관리] Admin 회원관리 목록 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('회원번호')).toBeVisible();
  await expect(page.getByText('로그인아이디').first()).toBeVisible();
});

test('[TC_MB_045][Admin회원관리] 검색 필드(로그인아이디) 조회 동작 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member', { waitUntil: 'load' });
  await page.locator('input[name="loginId"]').fill('jspark81');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('jspark81')).toBeVisible();
});

test('[TC_MB_046][Admin회원관리] Front 회원(jspark81) Admin 목록 노출 여부 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member', { waitUntil: 'load' });
  // 2026-08-20 재검증: "회원이름" 필드에 로그인아이디를 넣던 오류를 수정 — "로그인아이디" 필드(input[name="loginId"])로 정확히 검색
  await page.locator('input[name="loginId"]').fill('jspark81');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('박지숙')).toBeVisible();
});

test('[TC_MB_047][Admin회원관리] 조회 전 목록 초기 상태 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member', { waitUntil: 'load' });
  await expect(page.getByText('데이터가 없습니다')).toBeVisible();
});

test('[TC_MB_050][Admin리뷰관리] 목록 및 필터 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member/review', { waitUntil: 'load' });
  await expect(page.getByText('리뷰 목록')).toBeVisible();
});

test('[TC_MB_051][Admin라벨관리] 대표 라벨 목록 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member/review/label', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await expect(page.getByText('사이즈가 맞아요')).toBeVisible();
});

test('[TC_MB_052][Admin라벨관리] 승인/철회/유사라벨찾기/통합/삭제 버튼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/member/review/label', { waitUntil: 'load' });
  for (const label of ['승인', '철회', '유사라벨찾기', '통합', '삭제']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});
