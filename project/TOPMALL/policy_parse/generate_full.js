/**
 * TOPMALL Full TC HTML 통합 생성기 v2
 * - JSON 주석 제거 후 파싱
 * - 배치 1~4 + POLICY TC 병합
 * - TC_MBR_007 중복 제거 (TC_PR_001과 동일)
 * - 정책 TC 모듈 재배치
 * - Bridge TC 10건 추가
 * - 완전한 standalone HTML 파일 출력
 */

'use strict';
const fs = require('fs');
const path = require('path');

const TC_DIR = path.join(__dirname, '..', 'TC');

// ── JSON 강화 파서 (BOM + 주석 + 제어문자 처리) ──────
function readTC(file) {
  const p = path.join(TC_DIR, file);
  if (!fs.existsSync(p)) { console.warn('[SKIP]', file); return []; }
  // BOM 제거 후 읽기
  let raw = fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '');

  // 문자열 토큰 보존 후 // 주석만 제거
  // 전략: 문자열은 그대로 두고, 문자열 밖의 // 주석만 삭제
  let result = '';
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '"') {
      // 문자열 시작 - 끝까지 그대로 복사
      let str = '"';
      i++;
      while (i < raw.length) {
        if (raw[i] === '\\') { str += raw[i] + (raw[i+1]||''); i += 2; }
        else if (raw[i] === '"') { str += '"'; i++; break; }
        else { str += raw[i]; i++; }
      }
      result += str;
    } else if (raw[i] === '/' && raw[i+1] === '/') {
      // // 주석 - 줄 끝까지 스킵
      while (i < raw.length && raw[i] !== '\n') i++;
    } else {
      result += raw[i]; i++;
    }
  }

  // trailing comma 정리
  result = result.replace(/,\s*([}\]])/g, '$1');

  try {
    const j = JSON.parse(result);
    return j.items || [];
  } catch (e) {
    console.error('[ERROR]', file, e.message.substring(0, 100));
    return [];
  }
}


// ── 배치 TC 읽기 ─────────────────────────────────────
const CRT = readTC('TOPMALL_TC_CRT.json');
const ORD = readTC('TOPMALL_TC_ORD.json');
const PD  = readTC('TOPMALL_TC_PD.json');
const MBR = readTC('TOPMALL_TC_MBR.json');
const MY  = readTC('TOPMALL_TC_MY.json');
const CLM = readTC('TOPMALL_TC_CLM.json');
const PR  = readTC('TOPMALL_TC_PR.json');
const POL = readTC('TOPMALL_TC_POLICY.json');

// ── TC_MBR_007 중복 제거 (PR_001과 동일 시나리오) ────
const MBR_CLEAN = MBR.filter(t => t.tcId !== 'TC_MBR_007');

// ── 정책 TC → 모듈 재배치 ────────────────────────────
const POL_MOD = {
  TC_POL_001:'MBR', TC_POL_002:'MBR', TC_POL_003:'MBR',
  TC_POL_004:'MBR', TC_POL_005:'MBR', TC_POL_006:'MBR',
  TC_POL_007:'ORD', TC_POL_008:'ORD', TC_POL_009:'ORD',
  TC_POL_010:'ORD', TC_POL_011:'ORD', TC_POL_012:'ORD', TC_POL_013:'ORD',
  TC_POL_014:'CLM', TC_POL_015:'CLM', TC_POL_016:'CLM',
  TC_POL_017:'CLM', TC_POL_018:'CLM', TC_POL_019:'CLM', TC_POL_020:'CLM',
  TC_POL_021:'MY',  TC_POL_022:'MY',  TC_POL_023:'MY',
  TC_POL_024:'PR',  TC_POL_025:'MY',  TC_POL_026:'MY',
  TC_POL_027:'CRT', TC_POL_028:'CRT', TC_POL_029:'CRT',
  TC_POL_030:'MY',  TC_POL_031:'MY',  TC_POL_032:'MY',
  TC_POL_033:'PD',  TC_POL_034:'PD',
  TC_POL_035:'DSP', TC_POL_036:'SYS',
  TC_POL_037:'REV', TC_POL_038:'REV', TC_POL_039:'REV', TC_POL_040:'REV',
};

function tag(arr, mod, src) {
  return arr.map(t => ({
    ...t,
    _module: mod,
    _source: src || 'batch',
    policySheet: t.policySheet || '',
    policyNo: t.policyNo || '',
  }));
}

const POL_TAGGED = POL.map(t => ({
  ...t,
  _module: POL_MOD[t.tcId] || 'ETC',
  _source: 'policy',
  policySheet: t.policySheet || '',
  policyNo: t.policyNo || '',
}));

// ── DSP, SYS inline 데이터 ────────────────────────────
const DSP = [
  {tcId:'TC_DSP_001',category3:'배너',type:'UI',priority:'P2',title:'메인 히어로 배너 이미지 정상 노출',precondition:'메인 페이지 접속',steps:'1) http://192.168.10.198:3003/ 접속\n2) 히어로 배너 영역 확인',expectedResult:"2) 히어로 배너 정상 노출\n   'Summer Vacation 2026' 문구\n   이미지 깨짐 없음",testData:'URL=메인',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_002',category3:'배너',type:'기능',priority:'P2',title:"'컬렉션 보기' 버튼 → 컬렉션 상품목록 이동",precondition:'메인 페이지',steps:"1) '컬렉션 보기' 클릭\n2) 이동 확인",expectedResult:'2) 컬렉션 상품목록 이동',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_003',category3:'배너',type:'기능',priority:'P3',title:"'룩북 보기' 버튼 → 룩북 페이지 이동",precondition:'메인 페이지',steps:"1) '룩북 보기' 클릭\n2) 이동 확인",expectedResult:'2) 룩북 페이지 이동',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_004',category3:'배너',type:'데이터',priority:'P1',title:'상단 배너 문구 정합성 (FREE SHIPPING·첫구매15%·30일무료반품)',precondition:'메인 페이지',steps:'1) 최상단 배너 문구 확인\n2) 내용 기록',expectedResult:"2) FREE SHIPPING / 첫 구매 15% 쿠폰 / 30일 무료 반품 표시\n   오탈자 없음",testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_005',category3:'GNB',type:'UI',priority:'P2',title:'GNB 카테고리 Hover 시 2depth 메뉴 노출',precondition:'메인 페이지',steps:"1) 'WOMEN' 호버 → 2depth 확인\n2) MEN/UNISEX/ACCESSORY 각각 호버",expectedResult:'각 호버 시 2depth 정상 노출\n이탈 시 자동 닫힘',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_006',category3:'GNB',type:'기능',priority:'P2',title:'GNB 카테고리 클릭 → 해당 상품목록 이동',precondition:'메인 페이지',steps:"1) 'WOMEN' 클릭\n2) 'MEN' 클릭\n3) 'UNISEX' 클릭",expectedResult:'각 클릭 시 해당 카테고리 상품목록 이동',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_007',category3:'메인상품',type:'기능',priority:'P2',title:'메인 상품 카드 클릭 → PDP 이동',precondition:'메인 페이지',steps:'1) 상품 카드 클릭\n2) 이동 페이지 확인',expectedResult:'2) 해당 상품 PDP 이동\n   상품명/가격 정합성',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_008',category3:'GNB',type:'기능',priority:'P2',title:'TOPMALL 로고 클릭 → 메인 이동',precondition:'PDP or 목록 페이지',steps:'1) GNB 로고 클릭',expectedResult:'1) 메인 페이지 이동',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_009',category3:'GNB',type:'기능',priority:'P2',title:"SALE GNB 클릭 → SALE 상품목록",precondition:'메인 페이지',steps:"1) 'SALE' 클릭\n2) 이동 확인",expectedResult:'2) SALE 상품목록 노출',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_DSP_010',category3:'GNB',type:'기능',priority:'P2',title:"NEW GNB 클릭 → 신상품 목록",precondition:'메인 페이지',steps:"1) 'NEW' 클릭\n2) 이동 확인",expectedResult:'2) 신상품 목록 노출',testData:'-',result:'',assignee:'',issueSummary:''},
];

const SYS = [
  {tcId:'TC_SYS_001',category3:'콘솔에러',type:'기능',priority:'P1',title:'메인 페이지 로드 시 콘솔 에러 미발생',precondition:'비로그인 or 로그인',steps:'1) F12 Console 탭\n2) 메인 새로고침\n3) 에러 확인',expectedResult:'3) Error 레벨 0건',testData:'Chrome',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_002',category3:'콘솔에러',type:'기능',priority:'P1',title:'PDP 로드 시 콘솔 에러 미발생',precondition:'비로그인',steps:'1) F12 Console\n2) PDP 접속\n3) 에러 확인',expectedResult:'3) Error 0건',testData:'URL=/product/[id]',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_003',category3:'콘솔에러',type:'기능',priority:'P1',title:'장바구니 페이지 콘솔 에러 미발생',precondition:'Acc_Normal, 상품 담김',steps:'1) F12 Console\n2) 장바구니 접속\n3) 에러 확인',expectedResult:'3) Error 0건',testData:'URL=/cart',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_004',category3:'404처리',type:'기능',priority:'P2',title:'존재하지 않는 URL → 404 에러 페이지',precondition:'임의',steps:'1) /this-page-does-not-exist 접속\n2) 결과 확인',expectedResult:'2) 404 페이지 + 홈 이동 링크',testData:'/this-page-does-not-exist',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_005',category3:'접근제어',type:'보안',priority:'P1',title:'미인증 보호 페이지 직접 접근 → 로그인 리다이렉트',precondition:'비로그인',steps:'1) /mypage, /checkout 직접 접속',expectedResult:'1~2) 로그인 리다이렉트',testData:'/mypage, /checkout',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_006',category3:'보안',type:'보안',priority:'P1',title:'검색창 XSS 입력값 필터링',precondition:'임의',steps:"1) <script>alert('XSS')</script> 검색\n2) 결과 확인",expectedResult:'2) alert 미발생, 이스케이프 처리',testData:"<script>alert('XSS')</script>",result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_007',category3:'보안',type:'보안',priority:'P2',title:'주소 입력창 특수문자 필터링',precondition:'주문/결제 배송지 입력',steps:"1) 상세주소에 '<script>alert(1)</script>' 입력\n2) 주문하기",expectedResult:'2) 스크립트 실행 없음',testData:"<script>alert(1)</script>",result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_008',category3:'성능',type:'성능',priority:'P3',title:'Slow 3G 환경 로딩 인디케이터 표시',precondition:'임의',steps:'1) F12 Network Slow 3G 설정\n2) 메인 새로고침\n3) 로딩 중 화면',expectedResult:'3) 로딩 스피너 or 스켈레톤 표시\n   완료 후 정상 노출',testData:'Throttling=Slow 3G',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_009',category3:'뒤로가기',type:'기능',priority:'P2',title:'브라우저 뒤로가기 후 장바구니 상태 유지',precondition:'Acc_Normal, 장바구니 담김',steps:'1) 장바구니 확인\n2) 뒤로가기\n3) 장바구니 재접속',expectedResult:'3) 상품/수량 유지',testData:'-',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_SYS_010',category3:'중복방지',type:'기능',priority:'P1',title:'주문하기 버튼 이중 클릭 → 중복 주문 방지',precondition:'주문/결제 페이지, 정보 입력 완료',steps:"1) '주문하기' 연속 2회 클릭\n2) 주문내역 확인",expectedResult:'2) 주문 1건만 생성\n   버튼 즉시 비활성화',testData:'-',result:'',assignee:'',issueSummary:''},
];

const BRIDGE = [
  {tcId:'TC_FULL_001',category3:'E2E-회원가입→첫구매',type:'E2E',priority:'P1',policySheet:'MBR+PR+ORD',policyNo:'E2E-01',title:'신규 회원가입 → 15% 쿠폰 발급 → 첫 주문 쿠폰 적용 결제 완료',precondition:'미가입 이메일, 빈 브라우저',steps:'1) 신규 회원가입 완료\n2) 쿠폰함 → 15% 쿠폰 발급 확인\n3) 상품 PDP → 옵션 → 장바구니\n4) 주문/결제에서 쿠폰 적용\n5) 주문 완료',expectedResult:'2) 15% 쿠폰 자동 발급\n4) 쿠폰 할인금액 반영\n5) 주문 완료 → 쿠폰 소진\n   주문내역 확인',testData:'신규계정, 쿠폰=15%',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_002',category3:'E2E-결제실패재시도',type:'E2E',priority:'P1',policySheet:'CRT+ORD+POL',policyNo:'E2E-02',title:'결제 실패 → 장바구니 유지 확인 → 재결제 성공',precondition:'Acc_Normal, 장바구니 상품 담김',steps:'1) 주문/결제 진입\n2) 결제 실패 (한도 초과 등)\n3) 장바구니 확인\n4) 재결제 성공',expectedResult:'2) 결제실패 안내\n3) 장바구니 상품 그대로 유지\n4) 재결제 성공 → 해당 상품만 장바구니 삭제',testData:'결제실패→유지→재결제',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_003',category3:'E2E-재고임박',type:'E2E',priority:'P2',policySheet:'PD+CRT+POL',policyNo:'E2E-03',title:'재고 임박 상품 → 재고초과 담기 차단 → 가능 수량 결제',precondition:'Acc_Normal, 재고=2인 상품',steps:'1) PDP에서 3개 담기 시도\n2) 장바구니 수량 3 변경 시도\n3) 수량 2(재고)로 결제 진행',expectedResult:'1) 재고 2개 제한 안내\n2) 3으로 변경 차단\n3) 결제 성공',testData:'재고=2, 시도=3',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_004',category3:'E2E-취소→쿠폰복구',type:'E2E',priority:'P2',policySheet:'CLM+PR+POL',policyNo:'E2E-04',title:'쿠폰 사용 주문 취소 → 쿠폰 복구 → 재사용 주문 완료',precondition:'Acc_Normal, 쿠폰 사용 주문 완료',steps:'1) 쿠폰 사용 주문 취소 신청\n2) 취소완료 후 쿠폰함 확인\n3) 복구 쿠폰 신규 주문 적용\n4) 재결제 완료',expectedResult:'2) 쿠폰 복구 (유효기간 내)\n4) 복구 쿠폰 정상 사용 → 소진',testData:'쿠폰=15%, 취소→복구→재사용',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_005',category3:'E2E-구매확정→포인트',type:'E2E',priority:'P2',policySheet:'ORD+MY+POL',policyNo:'E2E-05',title:'주문 완료 → 구매확정 → 포인트 적립 → 적립 내역 확인',precondition:'Acc_Normal, 배송완료 주문',steps:"1) 주문내역 > '구매확정' 클릭\n2) 주문 상태 확인\n3) 포인트 내역 확인",expectedResult:'2) ORDER_STATUS=14(구매확정)\n3) 포인트 적립 내역 표시\n   잔액 합산',testData:'ORDER_STATUS=13→14',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_006',category3:'E2E-반품→환불계산',type:'E2E',priority:'P2',policySheet:'CLM+POL',policyNo:'E2E-06',title:'단순변심 반품 신청 → 반품접수(09) → 배송비 차감 환불금액 확인',precondition:'Acc_Normal, 배송완료 30일 이내',steps:"1) 반품 사유: '단순 변심'\n2) 반품 신청 완료\n3) 주문 상태 확인\n4) 반품완료 후 환불금액 확인",expectedResult:'3) ORDER_STATUS=09(반품접수)\n4) 환불=결제금액-반품배송비(왕복)\n   ⚠️ 09→10 전환 미구현 확인',testData:'결제=26,100원, 배송비=5,000원',result:'',assignee:'',issueSummary:'⚠️ 미결: 반품완료 전환 미구현'},
  {tcId:'TC_FULL_007',category3:'E2E-비로그인장바구니',type:'E2E',priority:'P2',policySheet:'CRT+MBR+POL',policyNo:'E2E-07',title:'비로그인 장바구니 담기 → 로그인 유도 → 복귀 후 주문',precondition:'비로그인, PDP 접속',steps:"1) PDP '장바구니' 클릭\n2) 로그인 페이지 이동 확인\n3) jspark81 로그인\n4) PDP 복귀 확인",expectedResult:'2) login?redirect=PDP URL\n4) 로그인 후 원래 화면 복귀\n   장바구니 재시도 가능',testData:'비로그인→login?redirect=',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_008',category3:'E2E-배송지스냅샷',type:'E2E',priority:'P2',policySheet:'MY+ORD+POL',policyNo:'E2E-08',title:'신규 주문 후 주소록 변경 → 기존주문 배송지 유지, 신규주문 변경 반영',precondition:'Acc_Normal, 주문완료, 배송지 1건',steps:'1) 주문A 완료 → 배송지 기록\n2) 마이페이지 배송지 서초구로 수정\n3) 주문A 주문상세 배송지 확인\n4) 신규 주문B → 결제 시 배송지 확인',expectedResult:'3) 주문A: 강남구 (변경 미소급)\n4) 주문B: 서초구 (변경 반영)',testData:'주문A=강남구, 변경후=서초구',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_009',category3:'E2E-리뷰삭제재작성',type:'E2E',priority:'P3',policySheet:'REV+POL',policyNo:'E2E-09',title:'리뷰 작성 → 삭제 → 재작성 시 도움돼요 수 초기화',precondition:'Acc_Normal, 결제완료 주문품목',steps:'1) 리뷰 작성 (별점5)\n2) 도움돼요 수 확인\n3) 리뷰 삭제\n4) 동일 품목 재작성\n5) 도움돼요 수 재확인',expectedResult:'4) 재작성 완료\n5) 도움돼요 수=0 (초기화)\n   작성일 초기화',testData:'리뷰작성→삭제→재작성',result:'',assignee:'',issueSummary:''},
  {tcId:'TC_FULL_010',category3:'E2E-SALE+쿠폰+무료배송',type:'E2E',priority:'P2',policySheet:'PD+PR+CRT+ORD',policyNo:'E2E-10',title:'SALE 상품 + 쿠폰 + 무료배송 기준 달성 → 최종금액 정합성',precondition:'Acc_Normal+쿠폰 보유, SALE 상품 장바구니',steps:'1) SALE 상품 26,900원 이상 담기\n2) 장바구니 배송비 확인\n3) 주문/결제 쿠폰 적용\n4) 최종 결제금액 확인',expectedResult:'2) 합계 ≥26,900원 → 배송비 0원\n3) 쿠폰 적용 (중복할인 정책 확인)\n4) 최종금액 계산 정합성',testData:'SALE+쿠폰+무료배송',result:'',assignee:'',issueSummary:'쿠폰 중복할인 정책 확인 필요'},
];

// ── 전체 병합 ─────────────────────────────────────────
const MOD_ORDER = ['DSP','MBR','PD','CRT','ORD','CLM','PR','MY','REV','SYS','E2E'];

function tagged(arr, mod) {
  return arr.map(t=>({...t, _module:mod, _source:'batch', policySheet:t.policySheet||'', policyNo:t.policyNo||''}));
}

const ALL = [
  ...tagged(DSP,'DSP'),
  ...tagged(MBR_CLEAN,'MBR'),
  ...tagged(PD,'PD'),
  ...tagged(CRT,'CRT'),
  ...tagged(ORD,'ORD'),
  ...tagged(CLM,'CLM'),
  ...tagged(PR,'PR'),
  ...tagged(MY,'MY'),
  ...tagged(SYS,'SYS'),
  ...POL_TAGGED,
  ...BRIDGE.map(t=>({...t, _module:'E2E', _source:'bridge'})),
];

const SORTED = [...ALL].sort((a,b)=>{
  const ai=MOD_ORDER.indexOf(a._module), bi=MOD_ORDER.indexOf(b._module);
  if(ai!==bi) return ai-bi;
  return a.tcId.localeCompare(b.tcId);
});

const byMod = {};
SORTED.forEach(t=>{ byMod[t._module]=(byMod[t._module]||0)+1; });
console.log('Total:', SORTED.length);
console.log('By module:', byMod);

// ── HTML 생성 ─────────────────────────────────────────
const MOD_LABEL = {
  DSP:'🖥️ 메인/전시(DSP)', MBR:'👤 회원(MBR)', PD:'🏷️ 상품(PD)',
  CRT:'🛒 장바구니(CRT)', ORD:'💳 주문/결제(ORD)', CLM:'📦 취소/반품(CLM)',
  PR:'🎁 프로모션(PR)', MY:'🏠 마이페이지(MY)', REV:'⭐ 리뷰(REV)',
  SYS:'⚙️ 공통/비기능(SYS)', E2E:'🔗 E2E 통합(Bridge)',
};

// HTML-safe JSON: < > & 를 유니코드 이스케이프 → <script> 조기 종료 원천 차단
const DATA_JS = JSON.stringify(SORTED)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');


const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TOPMALL QA — Full TC 통합 뷰어 v1.0</title>
<style>
:root{
  --bg:#f4f6fb;--panel:#fff;--text:#1f2328;--muted:#656d76;--border:#d0d7de;
  --accent:#1a7f37;--accent2:#116329;--p1:#cf222e;--p2:#9a6700;--p3:#0969da;
  --policy:#6e40c9;--bridge:#e65100;--headbg:#f0f6f0;
  --row-hover:#f0f6ff;--tag-bg:#eafaea;--warn:#ff6b35;
}
[data-theme=dark]{
  --bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#848d97;--border:#30363d;
  --accent:#3fb950;--accent2:#2ea043;--p1:#f85149;--p2:#d29922;--p3:#58a6ff;
  --policy:#a371f7;--bridge:#ff9500;--headbg:#161b22;
  --row-hover:#1c2128;--tag-bg:#1a2f1a;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Pretendard','Noto Sans KR',system-ui,sans-serif;background:var(--bg);color:var(--text);font-size:13px;line-height:1.5}
/* ── 상단바 ── */
.top-bar{background:var(--headbg);border-bottom:3px solid var(--accent);padding:12px 20px;position:sticky;top:0;z-index:200}
.top-bar-inner{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.logo{font-size:20px;font-weight:800;color:var(--accent)}
.logo span{color:var(--p3);font-size:13px;font-weight:600;margin-left:6px}
.sub{font-size:11px;color:var(--muted)}
.spacer{flex:1}
.btn{padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--text);cursor:pointer;font-size:12px;font-weight:500;transition:.15s}
.btn:hover{background:var(--headbg)} 
.btn-g{background:var(--accent);color:#fff;border-color:var(--accent)}
.btn-g:hover{background:var(--accent2)}
/* ── 요약 배너 ── */
.summary-bar{background:linear-gradient(135deg,#1a7f37 0%,#0969da 100%);color:#fff;padding:12px 20px;display:flex;gap:20px;flex-wrap:wrap;align-items:center}
.s-item{text-align:center}
.s-num{font-size:28px;font-weight:800}
.s-lbl{font-size:11px;opacity:.85}
.s-div{width:1px;background:rgba(255,255,255,.3);height:40px}
.warn-box{background:#fff3;border-radius:6px;padding:6px 12px;font-size:11px;line-height:1.7}
.warn-box b{color:#ffcc44}
/* ── KPI ── */
.kpi-bar{display:flex;gap:8px;padding:12px 20px;flex-wrap:wrap}
.kpi{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:8px 16px;min-width:88px;text-align:center}
.kpi-num{font-size:20px;font-weight:700}
.kpi-lbl{font-size:10px;color:var(--muted);margin-top:1px}
/* ── 통계 테이블 ── */
.stats-wrap{padding:0 20px 10px}
.stats-table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:11px}
.stats-table th{background:var(--headbg);padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
.stats-table td{padding:5px 10px;text-align:center;border-bottom:1px solid var(--border);font-size:11px}
.stats-table tr:last-child td{border-bottom:none}
.stats-table td:first-child{text-align:left;font-weight:500}
/* ── 검색 / 필터 ── */
.filter-bar{padding:8px 20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:var(--panel);border-bottom:1px solid var(--border)}
.filter-bar input{padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:12px;min-width:200px}
.filter-bar select{padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:12px}
/* ── 탭 ── */
.tab-bar{padding:8px 20px;display:flex;gap:6px;flex-wrap:wrap;background:var(--bg);border-bottom:1px solid var(--border)}
.tab{padding:5px 13px;border-radius:20px;border:1px solid var(--border);background:var(--panel);cursor:pointer;font-size:11px;font-weight:500;color:var(--muted);transition:.15s;white-space:nowrap}
.tab:hover{background:var(--headbg)}
.tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.tab[data-tab=E2E].active{background:var(--bridge);border-color:var(--bridge)}
.tab[data-tab=POLICY].active{background:var(--policy);border-color:var(--policy)}
/* ── TC 테이블 ── */
.tc-wrap{padding:0 20px 30px;overflow-x:auto}
.tc-count{padding:8px 0 5px;font-size:12px;color:var(--muted)}
table.tc{width:100%;border-collapse:collapse;table-layout:fixed;background:var(--panel);border:1px solid var(--border);border-radius:8px;overflow:hidden;min-width:1200px}
table.tc th{background:var(--headbg);padding:7px 6px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;font-size:10px;white-space:nowrap}
table.tc td{padding:6px 6px;border-bottom:1px solid var(--border);vertical-align:top;font-size:11px;word-break:break-word}
table.tc tr:last-child td{border-bottom:none}
table.tc tr:hover td{background:var(--row-hover)}
.col-id{width:82px}.col-mod{width:52px}.col-src{width:42px}.col-cat{width:65px}.col-type{width:52px}.col-pri{width:38px}.col-title{width:175px}.col-pre{width:120px}.col-steps{width:155px}.col-expect{width:155px}.col-data{width:100px}.col-result{width:74px}.col-who{width:56px}.col-issue{width:90px}
/* ── 뱃지/태그 ── */
.badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700;color:#fff}
.badge.P1{background:var(--p1)}.badge.P2{background:var(--p2)}.badge.P3{background:var(--p3)}
.tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;background:var(--tag-bg);color:var(--accent2);border:1px solid var(--border)}
.tag-pol{background:#f0e8ff;color:#6e40c9;border-color:#d0b8ff}
.tag-bridge{background:#fff3e0;color:#e65100;border-color:#ffcc80}
.src-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:middle}
.src-batch{background:var(--accent)}
.src-policy{background:var(--policy)}
.src-bridge{background:var(--bridge)}
/* ── 인풋 ── */
select.rs{width:100%;padding:2px 3px;border:1px solid var(--border);border-radius:4px;background:var(--panel);color:var(--text);font-size:10px}
input.ii{width:100%;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--panel);color:var(--text);font-size:10px}
pre.pre{white-space:pre-wrap;font-family:inherit;font-size:11px}
.issue-warn{color:var(--warn);font-size:10px}
.no-result{padding:30px;text-align:center;color:var(--muted);font-size:14px}
</style>
</head>
<body>
<div class="top-bar">
  <div class="top-bar-inner">
    <div>
      <div class="logo">TOPMALL QA <span>Full TC 통합 뷰어 v1.0</span></div>
      <div class="sub">배치 1~4 + 정책서 보완 + E2E Bridge TC · 생성일: 2026-08-21</div>
    </div>
    <div class="spacer"></div>
    <button class="btn btn-g" id="btnCSV">⬇ CSV 전체</button>
    <button class="btn btn-g" id="btnSave">💾 JSON 저장</button>
    <button class="btn" id="btnLoad">📂 불러오기</button>
    <input type="file" id="fileInput" accept=".json" style="display:none">
    <button class="btn" id="btnTheme">🌙 다크</button>
  </div>
</div>

<div class="summary-bar" id="summaryBar">
  <div class="s-item"><div class="s-num" id="sTotal">0</div><div class="s-lbl">전체 TC</div></div>
  <div class="s-div"></div>
  <div class="s-item"><div class="s-num" id="sP1" style="color:#f85149">0</div><div class="s-lbl">P1 Critical</div></div>
  <div class="s-item"><div class="s-num" id="sP2" style="color:#d29922">0</div><div class="s-lbl">P2 Major</div></div>
  <div class="s-item"><div class="s-num" id="sP3" style="color:#58a6ff">0</div><div class="s-lbl">P3 Minor</div></div>
  <div class="s-div"></div>
  <div class="s-item"><div class="s-num" id="sPass" style="color:#3fb950">0</div><div class="s-lbl">Pass</div></div>
  <div class="s-item"><div class="s-num" id="sFail" style="color:#f85149">0</div><div class="s-lbl">Fail</div></div>
  <div class="s-item"><div class="s-num" id="sBlocked" style="color:#d29922">0</div><div class="s-lbl">Blocked</div></div>
  <div class="s-item"><div class="s-num" id="sNA">0</div><div class="s-lbl">N/A</div></div>
  <div class="s-div"></div>
  <div class="warn-box"><b>⚠️ 미결 정책</b><br>[미결#1] 다중기기 세션 정책 확정 필요 (TC_POL_001)<br>[미결#2] 반품 09→10 자동전환 미구현 (TC_POL_017, TC_FULL_006)</div>
</div>

<div class="kpi-bar" id="kpiBar">
  <div class="kpi" id="kDSP"><div class="kpi-num">0</div><div class="kpi-lbl">DSP</div></div>
  <div class="kpi" id="kMBR"><div class="kpi-num">0</div><div class="kpi-lbl">MBR</div></div>
  <div class="kpi" id="kPD"><div class="kpi-num">0</div><div class="kpi-lbl">PD</div></div>
  <div class="kpi" id="kCRT"><div class="kpi-num">0</div><div class="kpi-lbl">CRT</div></div>
  <div class="kpi" id="kORD"><div class="kpi-num">0</div><div class="kpi-lbl">ORD</div></div>
  <div class="kpi" id="kCLM"><div class="kpi-num">0</div><div class="kpi-lbl">CLM</div></div>
  <div class="kpi" id="kPR"><div class="kpi-num">0</div><div class="kpi-lbl">PR</div></div>
  <div class="kpi" id="kMY"><div class="kpi-num">0</div><div class="kpi-lbl">MY</div></div>
  <div class="kpi" id="kREV"><div class="kpi-num">0</div><div class="kpi-lbl">REV</div></div>
  <div class="kpi" id="kSYS"><div class="kpi-num">0</div><div class="kpi-lbl">SYS</div></div>
  <div class="kpi" id="kE2E"><div class="kpi-num">0</div><div class="kpi-lbl">E2E</div></div>
</div>

<div class="stats-wrap">
  <table class="stats-table">
    <thead><tr><th>모듈</th><th>전체</th><th>Batch</th><th>Policy</th><th>Bridge</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>N/A</th><th>미실행</th><th>수행율</th><th>Pass율</th><th>Fail율</th></tr></thead>
    <tbody id="statsTbody"></tbody>
  </table>
</div>

<div class="filter-bar">
  <input type="text" id="searchInput" placeholder="🔍 TC ID, 제목, 절차로 검색...">
  <select id="priFilter"><option value="">우선순위 전체</option><option>P1</option><option>P2</option><option>P3</option></select>
  <select id="typeFilter"><option value="">유형 전체</option><option>기능</option><option>UI</option><option>데이터</option><option>보안</option><option>성능</option><option>E2E</option><option>Boundary</option></select>
  <select id="resultFilter"><option value="">결과 전체</option><option value="">미실행</option><option value="Pass">Pass</option><option value="Fail">Fail</option><option value="Blocked">Blocked</option><option value="N/A">N/A</option></select>
  <select id="srcFilter"><option value="">소스 전체</option><option value="batch">배치(Batch)</option><option value="policy">정책(Policy)</option><option value="bridge">Bridge E2E</option></select>
  <span id="filterCount" style="color:var(--muted);font-size:11px;margin-left:8px"></span>
</div>

<div class="tab-bar" id="tabBar">
  <div class="tab active" data-tab="ALL">📋 전체</div>
  <div class="tab" data-tab="DSP">🖥️ DSP</div>
  <div class="tab" data-tab="MBR">👤 MBR</div>
  <div class="tab" data-tab="PD">🏷️ PD</div>
  <div class="tab" data-tab="CRT">🛒 CRT</div>
  <div class="tab" data-tab="ORD">💳 ORD</div>
  <div class="tab" data-tab="CLM">📦 CLM</div>
  <div class="tab" data-tab="PR">🎁 PR</div>
  <div class="tab" data-tab="MY">🏠 MY</div>
  <div class="tab" data-tab="REV">⭐ REV</div>
  <div class="tab" data-tab="SYS">⚙️ SYS</div>
  <div class="tab" data-tab="E2E">🔗 E2E</div>
  <div class="tab" data-tab="POLICY">📋 Policy만</div>
</div>

<div class="tc-wrap">
  <div class="tc-count" id="tcCount"></div>
  <table class="tc">
    <thead>
      <tr>
        <th class="col-id">TC ID</th>
        <th class="col-mod">모듈</th>
        <th class="col-src">소스</th>
        <th class="col-cat">소분류</th>
        <th class="col-type">유형</th>
        <th class="col-pri">우선순위</th>
        <th class="col-title">테스트 항목</th>
        <th class="col-pre">사전조건</th>
        <th class="col-steps">수행절차</th>
        <th class="col-expect">기대결과</th>
        <th class="col-data">테스트 데이터</th>
        <th class="col-result">실행결과</th>
        <th class="col-who">담당자</th>
        <th class="col-issue">이슈/비고</th>
      </tr>
    </thead>
    <tbody id="tcTbody"></tbody>
  </table>
</div>

<script>
const ALL_DATA = ${DATA_JS};
const MOD_LABEL = ${JSON.stringify(MOD_LABEL)};
const MOD_ORDER = ${JSON.stringify(MOD_ORDER)};

let currentTab = 'ALL';
let searchQ = '', priF = '', typeF = '', resultF = '', srcF = '';

function getFiltered() {
  let d = currentTab === 'ALL' ? ALL_DATA
    : currentTab === 'POLICY' ? ALL_DATA.filter(t => t._source === 'policy')
    : ALL_DATA.filter(t => t._module === currentTab);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    d = d.filter(t =>
      (t.tcId||'').toLowerCase().includes(q) ||
      (t.title||'').toLowerCase().includes(q) ||
      (t.steps||'').toLowerCase().includes(q) ||
      (t.expectedResult||'').toLowerCase().includes(q) ||
      (t.category3||'').toLowerCase().includes(q)
    );
  }
  if (priF) d = d.filter(t => t.priority === priF);
  if (typeF) d = d.filter(t => t.type === typeF);
  if (resultF !== '') {
    if (resultF === '') d = d.filter(t => !t.result);
    else d = d.filter(t => t.result === resultF);
  }
  if (srcF) d = d.filter(t => t._source === srcF);
  return d;
}

function srcBadge(s) {
  if (s === 'policy') return '<span class="tag tag-pol">Policy</span>';
  if (s === 'bridge') return '<span class="tag tag-bridge">Bridge</span>';
  return '<span class="tag">Batch</span>';
}
function srcDot(s) {
  return '<span class="src-dot src-'+s+'"></span>';
}

function renderTable() {
  const items = getFiltered();
  document.getElementById('tcCount').textContent = '표시 중: ' + items.length + '건';
  document.getElementById('filterCount').textContent = items.length + '건 표시';
  if (!items.length) {
    document.getElementById('tcTbody').innerHTML = '<tr><td colspan="14"><div class="no-result">검색 결과가 없습니다</div></td></tr>';
    return;
  }
  document.getElementById('tcTbody').innerHTML = items.map(t => {
    const issue = (t.issueSummary||'').startsWith('⚠️')
      ? '<span class="issue-warn">'+escH(t.issueSummary)+'</span>'
      : escH(t.issueSummary||'');
    return '<tr>'
      + '<td><b>'+escH(t.tcId)+'</b>'+(t.policyNo?'<br><small style="color:var(--policy);font-size:9px">'+escH(t.policyNo)+'</small>':'')+'</td>'
      + '<td><span class="tag" style="'+(t._module==='E2E'?'background:#fff3e0;color:#e65100':'')+'">'+t._module+'</span></td>'
      + '<td>'+srcBadge(t._source)+'</td>'
      + '<td><span class="tag">'+escH(t.category3||'-')+'</span></td>'
      + '<td><span class="tag">'+escH(t.type||'-')+'</span></td>'
      + '<td><span class="badge '+t.priority+'">'+t.priority+'</span></td>'
      + '<td><pre class="pre">'+escH(t.title)+'</pre></td>'
      + '<td><pre class="pre" style="font-size:10px">'+escH(t.precondition||'-')+'</pre></td>'
      + '<td><pre class="pre" style="font-size:10px">'+escH(t.steps||'-')+'</pre></td>'
      + '<td><pre class="pre" style="font-size:10px">'+escH(t.expectedResult||'-')+'</pre></td>'
      + '<td><pre class="pre" style="font-size:10px">'+escH(t.testData||'-')+'</pre></td>'
      + '<td><select class="rs" data-id="'+t.tcId+'">'
        + '<option value="">미실행</option>'
        + ['Pass','Fail','Blocked','N/A'].map(v=>'<option value="'+v+'"'+(t.result===v?' selected':'')+'>'+v+'</option>').join('')
        + '</select></td>'
      + '<td><input class="ii" type="text" placeholder="담당자" data-id="'+t.tcId+'" data-f="assignee" value="'+escH(t.assignee||'')+'"></td>'
      + '<td>'+issue+'<input class="ii" type="text" placeholder="이슈추가" data-id="'+t.tcId+'" data-f="issueSummary" style="margin-top:2px"></td>'
      + '</tr>';
  }).join('');
  renderKPI();
  renderStats();
}

function escH(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getItem(id) { return ALL_DATA.find(t => t.tcId === id); }

function renderKPI() {
  const items = getFiltered();
  const tot = items.length;
  document.getElementById('sTotal').textContent = tot;
  document.getElementById('sP1').textContent = items.filter(t=>t.priority==='P1').length;
  document.getElementById('sP2').textContent = items.filter(t=>t.priority==='P2').length;
  document.getElementById('sP3').textContent = items.filter(t=>t.priority==='P3').length;
  document.getElementById('sPass').textContent = items.filter(t=>t.result==='Pass').length;
  document.getElementById('sFail').textContent = items.filter(t=>t.result==='Fail').length;
  document.getElementById('sBlocked').textContent = items.filter(t=>t.result==='Blocked').length;
  document.getElementById('sNA').textContent = items.filter(t=>t.result==='N/A').length;
  MOD_ORDER.forEach(m => {
    const el = document.getElementById('k'+m);
    if (el) el.querySelector('.kpi-num').textContent = ALL_DATA.filter(t=>t._module===m).length;
  });
}

function renderStats() {
  const mods = [...MOD_ORDER, 'POLICY'];
  document.getElementById('statsTbody').innerHTML = mods.map(m => {
    const items = m === 'POLICY'
      ? ALL_DATA.filter(t => t._source === 'policy')
      : ALL_DATA.filter(t => t._module === m);
    const total = items.length;
    if (!total) return '';
    const batch = items.filter(t=>t._source==='batch').length;
    const pol = items.filter(t=>t._source==='policy').length;
    const br = items.filter(t=>t._source==='bridge').length;
    const pass = items.filter(t=>t.result==='Pass').length;
    const fail = items.filter(t=>t.result==='Fail').length;
    const blocked = items.filter(t=>t.result==='Blocked').length;
    const na = items.filter(t=>t.result==='N/A').length;
    const notRun = total-pass-fail-blocked-na;
    const ex = pass+fail+blocked+na;
    const lbl = m==='POLICY'?'📋 정책 TC 소계':MOD_LABEL[m]||m;
    return '<tr'+(m==='POLICY'?' style="background:var(--headbg);font-weight:600"':'')+'>'
      + '<td>'+lbl+'</td><td>'+total+'</td><td>'+batch+'</td><td style="color:var(--policy)">'+pol+'</td><td style="color:var(--bridge)">'+br+'</td>'
      + '<td style="color:var(--accent)">'+pass+'</td><td style="color:var(--p1)">'+fail+'</td><td style="color:var(--p2)">'+blocked+'</td><td>'+na+'</td>'
      + '<td style="color:var(--muted)">'+notRun+'</td>'
      + '<td>'+(total?Math.round(ex/total*100):0)+'%</td>'
      + '<td>'+(ex?Math.round(pass/ex*100):0)+'%</td>'
      + '<td>'+(ex?Math.round(fail/ex*100):0)+'%</td>'
      + '</tr>';
  }).join('');
}

// ── 이벤트 ──────────────────────────────────────────────
document.getElementById('tabBar').addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (!t) return;
  currentTab = t.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  renderTable();
});
document.getElementById('searchInput').addEventListener('input', e => { searchQ = e.target.value; renderTable(); });
document.getElementById('priFilter').addEventListener('change', e => { priF = e.target.value; renderTable(); });
document.getElementById('typeFilter').addEventListener('change', e => { typeF = e.target.value; renderTable(); });
document.getElementById('resultFilter').addEventListener('change', e => { resultF = e.target.value; renderTable(); });
document.getElementById('srcFilter').addEventListener('change', e => { srcF = e.target.value; renderTable(); });

document.getElementById('tcTbody').addEventListener('change', e => {
  const sel = e.target.closest('select.rs');
  if (!sel) return;
  const item = getItem(sel.dataset.id);
  if (item) { item.result = sel.value; renderKPI(); renderStats(); }
});
document.getElementById('tcTbody').addEventListener('input', e => {
  const inp = e.target.closest('input.ii');
  if (!inp) return;
  const item = getItem(inp.dataset.id);
  if (item) item[inp.dataset.f] = inp.value;
});
document.getElementById('btnTheme').addEventListener('click', () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? '' : 'dark');
  document.getElementById('btnTheme').textContent = dark ? '🌙 다크' : '☀️ 라이트';
});

// ── CSV 다운로드 ──────────────────────────────────────
document.getElementById('btnCSV').addEventListener('click', () => {
  const items = getFiltered();
  const cols = ['TC ID','모듈','소스','정책시트','정책No','소분류','유형','우선순위','테스트항목','사전조건','수행절차','기대결과','테스트데이터','실행결과','담당자','이슈비고'];
  const rows = items.map(t => [
    t.tcId, t._module, t._source, t.policySheet||'', t.policyNo||'',
    t.category3, t.type, t.priority, t.title, t.precondition,
    t.steps, t.expectedResult, t.testData, t.result, t.assignee, t.issueSummary||''
  ].map(v => '"'+(String(v||'').replace(/"/g,'""').replace(/\\n/g,' '))+'"').join(','));
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\\uFEFF' + encodeURIComponent(cols.join(',')+'\\n'+rows.join('\\n'));
  a.download = 'TOPMALL_TC_FULL.csv';
  a.click();
});

// ── JSON 저장/불러오기 ────────────────────────────────
document.getElementById('btnSave').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(
    JSON.stringify({ meta:{ savedAt: new Date().toISOString(), total: ALL_DATA.length }, items: ALL_DATA }, null, 2)
  );
  a.download = 'TOPMALL_TC_FULL_saved.json';
  a.click();
});
document.getElementById('btnLoad').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      (d.items||[]).forEach(loaded => {
        const ex = ALL_DATA.find(t => t.tcId === loaded.tcId);
        if (ex) { ex.result = loaded.result||''; ex.assignee = loaded.assignee||''; ex.issueSummary = loaded.issueSummary||''; }
      });
      renderTable(); alert('불러오기 완료!');
    } catch(err) { alert('파일 오류: '+err.message); }
    e.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
});

// ── 초기 렌더 ────────────────────────────────────────
renderTable();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(TC_DIR, 'TOPMALL_TC_FULL.html'), HTML, 'utf-8');
console.log('→ TOPMALL_TC_FULL.html 생성 완료! (' + HTML.length + ' bytes)');
