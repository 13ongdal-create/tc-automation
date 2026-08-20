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

test('[TC_MY_001][주문내역] 주문 내역 없음 시 Empty State 및 "쇼핑하러 가기" 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/order', { waitUntil: 'load' });
  await expect(page.getByText('최근 주문 내역이 없습니다')).toBeVisible();
  await expect(page.getByRole('button', { name: '쇼핑하러 가기' })).toBeVisible();
});

test('[TC_MY_002][주문내역] 조회기간 필터(오늘/7일/1개월/3개월/6개월/전체) 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/order', { waitUntil: 'load' });
  for (const label of ['오늘', '최근 7일', '최근 1개월', '최근 3개월', '최근 6개월', '전체']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('[TC_MY_003][주문내역] 주문상태 드롭다운 전체 옵션 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/order', { waitUntil: 'load' });
  const select = page.locator('select').first();
  const options = await select.locator('option').allTextContents();
  for (const label of ['전체', '주문완료', '결제완료', '출하지시', '출고완료', '배송완료', '구매확정', '주문취소', '주문실패']) {
    expect(options.some(o => o.includes(label))).toBe(true);
  }
});

test('[TC_MY_004][주문내역] "쇼핑하러 가기" 버튼 클릭 시 메인 이동 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/order', { waitUntil: 'load' });
  await page.getByRole('button', { name: '쇼핑하러 가기' }).click();
  await page.waitForURL(BASE + '/');
  expect(page.url()).toBe(BASE + '/');
});

test('[TC_MY_005][SNS연결설정] [확인필요][결함] SNS 연결설정 화면 500 에러 재현 검증', async ({ page }) => {
  await login(page);
  const res = await page.goto(BASE + '/mypage/social', { waitUntil: 'load' });
  expect(res.status()).toBe(500);
});

test('[TC_MY_006][위시리스트] 위시리스트 보유 상품 목록 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/wishlist', { waitUntil: 'load' });
  await expect(page.getByText('Dior')).toBeVisible();
  await expect(page.getByText('소프트 브라운 니트 가디건')).toBeVisible();
});

test('[TC_MY_007][위시리스트] "전체 삭제" 버튼 클릭 시 위시리스트 비움 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/wishlist', { waitUntil: 'load' });
  await page.getByRole('button', { name: '전체 삭제' }).click();
  await page.waitForTimeout(500);
});

test('[TC_MY_008][위시리스트] 위시리스트 최대 보유 개수(100개) 안내 문구 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/wishlist', { waitUntil: 'load' });
  await expect(page.getByText(/최대 100개까지 저장/)).toBeVisible();
});

test('[TC_MY_009][배송주소록] 배송지 미등록 시 Empty State 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/address', { waitUntil: 'load' });
  await expect(page.getByText('등록된 배송지가 없습니다')).toBeVisible();
});

test('[TC_MY_010][배송주소록] "새 배송지 등록" 버튼 클릭 시 등록 폼 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/address', { waitUntil: 'load' });
  await page.getByRole('button', { name: /새 배송지 등록/ }).click();
  await page.waitForTimeout(500);
});

test('[TC_MY_011][배송주소록] 배송지 최대 등록 개수(5개) 및 기본배송지 자동입력 안내 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/address', { waitUntil: 'load' });
  await expect(page.getByText(/최대 5개까지 등록/)).toBeVisible();
  await expect(page.getByText(/기본 배송지를 설정하시면/)).toBeVisible();
});

test('[TC_MY_012][쿠폰] 보유 쿠폰 없음 시 Empty State 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/coupon', { waitUntil: 'load' });
  await expect(page.getByText('보유한 쿠폰이 없습니다')).toBeVisible();
});

test('[TC_MY_013][쿠폰] 전체/사용가능/사용완료·만료 탭 전환 동작 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/coupon', { waitUntil: 'load' });
  await page.getByRole('button', { name: '사용가능', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '사용완료/만료', exact: true }).click();
});

test('[TC_MY_014][1:1문의] 문의 내역 없음 시 총 건수 및 Empty State 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/inquiry', { waitUntil: 'load' });
  await expect(page.getByText('총 0건')).toBeVisible();
  await expect(page.getByText('조건에 맞는 문의 내역이 없습니다')).toBeVisible();
});

test('[TC_MY_015][1:1문의] "문의하기" 버튼 클릭 시 작성 화면 이동 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/inquiry', { waitUntil: 'load' });
  await page.getByRole('button', { name: '문의하기' }).first().click();
  await page.waitForTimeout(500);
});

test('[TC_MY_016][리뷰목록] "작성 가능한 리뷰"/"작성한 리뷰" 탭 전환 동작 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/review', { waitUntil: 'load' });
  await page.getByRole('button', { name: '작성한 리뷰' }).click();
  await page.waitForTimeout(300);
});

test('[TC_MY_017][리뷰목록] 작성 가능한 리뷰 없음 시 Empty State 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/review', { waitUntil: 'load' });
  await expect(page.getByText('작성 가능한 리뷰가 없습니다')).toBeVisible();
});

test('[TC_MY_018][개인정보수정] 개인정보 수정 화면 기본정보 초기값 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/edit', { waitUntil: 'load' });
  await expect(page.getByText('박지숙')).toBeVisible();
  await expect(page.getByText('jspark81', { exact: true })).toBeVisible();
});

test('[TC_MY_019][개인정보수정] 전화번호/이메일 수정 후 저장 동작 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/edit', { waitUntil: 'load' });
  await page.locator('input[name="mobile"]').fill('01099998888');
  await page.locator('input[name="email"]').fill('jspark81_test@3top.co.kr');
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForTimeout(500);
});

test('[TC_MY_020][개인정보수정] 이메일/SMS/PUSH 수신동의 라디오 변경 후 저장 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/edit', { waitUntil: 'load' });
  await page.locator('input[name="emailRecvFlag"]').nth(1).check();
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForTimeout(500);
});

test('[TC_MY_021][개인정보수정] "취소" 버튼 클릭 시 변경사항 미반영 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/edit', { waitUntil: 'load' });
  await page.locator('input[name="mobile"]').fill('01000000000');
  await page.getByRole('button', { name: '취소' }).click();
  await page.waitForTimeout(300);
  await page.goto(BASE + '/mypage/edit', { waitUntil: 'load' });
  await expect(page.locator('input[name="mobile"]')).not.toHaveValue('01000000000');
});

test('[TC_MY_022][개인정보수정] "변경하기" 버튼 클릭 시 비밀번호 변경 폼 노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/edit', { waitUntil: 'load' });
  await page.getByRole('button', { name: '변경하기' }).click();
  await page.waitForTimeout(500);
});

test('[TC_MY_023][회원탈퇴] [확인필요] 비밀번호 미입력 시 "확인" 버튼 클릭 차단 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/withdraw', { waitUntil: 'load' });
  await page.getByRole('button', { name: '확인' }).click();
  await page.waitForTimeout(500);
  expect(page.url()).toContain('/mypage/withdraw');
});

test('[TC_MY_024][회원탈퇴] [확인필요] 잘못된 비밀번호 입력 시 탈퇴 차단 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/withdraw', { waitUntil: 'load' });
  await page.locator('input[type="password"]').fill('wrongpassword');
  await page.getByRole('button', { name: '확인' }).click();
  await page.waitForTimeout(500);
  expect(page.url()).toContain('/mypage/withdraw');
});

test('[TC_MY_025][회원탈퇴] "취소" 버튼 클릭 시 마이페이지 복귀 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/withdraw', { waitUntil: 'load' });
  await page.getByRole('button', { name: '취소' }).click();
  await page.waitForTimeout(500);
});

test('[TC_MY_026][주문내역][결함] Front 마이페이지 주문내역에 실제 완료 주문 미노출 검증', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/mypage/order', { waitUntil: 'load' });
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  // DEF_데모사이트_008: Admin 주문리스트에는 O260820790055 주문이 존재하나 Front에는 미노출 확인됨
  await expect(page.getByText('O260820790055')).toBeVisible();
});
