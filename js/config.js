/* =========================================================
   사이트 설정
   ENDPOINT: Google Apps Script 웹 앱 URL을 넣으면
   견적·구매신청 / 선생님 의견(VOC) / 수업 후기가
   구글 시트로 바로 쌓입니다. (설정 방법: README.md)
   비워두면 '미리보기 모드'로 동작하며, 제출 내용은
   그 브라우저에만 임시 저장됩니다.
   ========================================================= */
const SITE_CONFIG = {
  ENDPOINT: "",

  ORG: {
    name: "오픈더쉐어",
    nameEn: "Open The Share",
    tel: "031-8039-7034",
    mobile: "010-7512-7032",
    email: "opentheshare@naver.com",
    address: "경기 성남시 황새울로 200번길 28, 306호",
  },

  // 결제·구매 방식 (학교 회계 절차에 맞춰 수정)
  PAYMENT_METHODS: [
    { value: "s2b", label: "학교장터(S2B) 구매", desc: "학교장터 등록 상품으로 발주" },
    { value: "invoice", label: "계좌이체 + 세금계산서", desc: "견적서 → 품의 → 납품 후 이체" },
    { value: "card", label: "학교 카드 결제", desc: "결제 링크 또는 방문/전화 결제" },
    { value: "voucher", label: "기타 (바우처·지원사업 등)", desc: "늘봄·교육청 지원사업 예산 등" },
  ],
};
