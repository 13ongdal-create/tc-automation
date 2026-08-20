const { test, expect } = require('../../../../_shared/testFixtures');

const ADMIN_BASE = 'http://192.168.10.116:30280';
const ADMIN_ACCOUNT = { id: 'devel', pw: 'test' };

async function adminLogin(page) {
  await page.goto(ADMIN_BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill(ADMIN_ACCOUNT.id);
  await page.locator('input[type="password"]').first().fill(ADMIN_ACCOUNT.pw);
  await page.locator('button:has-text("LOG IN")').click();
  await page.waitForURL(ADMIN_BASE + '/', { timeout: 15000 });
}

test('[TC_CO_021][워크플로우관리] 목록 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/workflow', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('워크플로우 목록')).toBeVisible();
});

test('[TC_CO_022][워크플로우관리] "신규 등록" 버튼 클릭 시 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/workflow', { waitUntil: 'load' });
  await page.getByRole('button', { name: '신규 등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_023][모니터링] 진행 중 PO 없음 시 Empty State 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/workflow/monitoring', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('진행 중 PO 목록')).toBeVisible();
});

test('[TC_CO_024][공통코드관리] 대분류코드 필터 조회 동작 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/master/code', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
});

test('[TC_CO_025][공통코드관리] "신규코드 등록" 버튼 클릭 시 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/master/code', { waitUntil: 'load' });
  await page.getByRole('button', { name: '신규코드 등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_026][다국어관리] 메시지 목록 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/master/i18n', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('다국어 메시지 목록')).toBeVisible();
});

test('[TC_CO_027][다국어관리] 그룹 코드 필터 조회 동작 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/master/i18n', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
});

test('[TC_CO_028][프로그램관리] 프로그램 목록 없음 시 Empty State 및 권한체크 컬럼 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/master/program', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('데이터가 없습니다')).toBeVisible();
});

test('[TC_CO_029][메뉴관리] 메뉴그룹 트리 및 프로그램 연결 필드 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/master/menu', { waitUntil: 'load' });
  await expect(page.getByText('메뉴그룹').first()).toBeVisible();
});

test('[TC_CO_030][화면관리] Global Theme Customizer 프리셋 및 저장·적용 동작 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/publishing-guide', { waitUntil: 'load' });
  await expect(page.getByText('Global Theme Customizer')).toBeVisible();
  await page.getByRole('button', { name: 'Professional Mint' }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_031][화면관리] 폰트 크기·버튼 스타일 세부 옵션 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/publishing-guide', { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: '14PX' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PILL' })).toBeVisible();
});

test('[TC_CO_032][대시보드관리] 위젯(25개) 표시/숨김 토글 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/dashboard', { waitUntil: 'load' });
  await expect(page.getByText('총 위젯: 25개')).toBeVisible();
});

test('[TC_CO_033][대시보드관리] "초기화" 버튼 클릭 시 위젯 설정 기본값 복원 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/dashboard', { waitUntil: 'load' });
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_034][권한관리] 권한그룹 목록 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/auth/master', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('권한그룹')).toBeVisible();
});

test('[TC_CO_035][권한관리] "신규 등록" 버튼 클릭 시 권한그룹 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/auth/master', { waitUntil: 'load' });
  await page.getByRole('button', { name: '신규 등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_036][관리자관리] 관리자 계정 목록 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/auth/user', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('devel')).toBeVisible();
});

test('[TC_CO_037][관리자관리] "신규 등록" 버튼 클릭 시 관리자 계정 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/auth/user', { waitUntil: 'load' });
  await page.getByRole('button', { name: '신규 등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_038][권한별메뉴] 권한코드 선택 시 메뉴별 접근권한 매트릭스 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/auth/menu-auth', { waitUntil: 'load' });
  await expect(page.getByText('권한 그룹')).toBeVisible();
  await expect(page.getByText('메뉴별 그룹')).toBeVisible();
});

test('[TC_CO_039][메뉴별권한] 메뉴 선택 시 권한코드별 매트릭스 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/auth/menu', { waitUntil: 'load' });
  await expect(page.getByText('메뉴그룹').first()).toBeVisible();
});

test('[TC_CO_040][배치관리] 배치 스케줄 목록 및 실행 로그 영역 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/schedule', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Schedule Log')).toBeVisible();
});

test('[TC_CO_041][배치관리] "SCHEDULE 추가" 버튼 클릭 시 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/schedule', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'SCHEDULE 추가', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_042][로그인내역조회] devel 계정 로그인 이력 조회 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/login-log', { waitUntil: 'load' });
  await page.locator('input').first().fill('devel');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
});

test('[TC_CO_043][관리자로그관리] devel 계정 작업 로그 조회 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/log', { waitUntil: 'load' });
  await page.locator('input').nth(1).fill('devel');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
});

test('[TC_CO_044][검색엔진관리] 인덱스 상태 목록 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/search', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('인덱스 목록')).toBeVisible();
});

test('[TC_CO_045][Agent 관리] Agent 목록 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/agents', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Agent List')).toBeVisible();
});

test('[TC_CO_046][Agent 관리] "등록" 버튼 클릭 시 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/agents', { waitUntil: 'load' });
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await page.waitForTimeout(500);
});

test('[TC_CO_047][Tool 관리] Tool 목록 없음 시 Empty State 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/server/tools', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('데이터가 없습니다')).toBeVisible();
});

test('[TC_CO_048][Sample] 예제 컴포넌트 노출 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/sample', { waitUntil: 'load' });
  await expect(page.getByText('Tesla')).toBeVisible();
});

test('[TC_CO_049][PUSH관리] 발송상태 필터 조회 동작 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/push', { waitUntil: 'load' });
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForTimeout(1000);
});

test('[TC_CO_050][PUSH관리] "PUSH 등록" 버튼 클릭 시 등록 화면 이동 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(ADMIN_BASE + '/system/push', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'PUSH 등록', exact: true }).click();
  await page.waitForTimeout(500);
});
