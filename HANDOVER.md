# 인수인계 문서 — 오픈더쉐어 나눔 DIY 학교 프로그램 홈페이지

> 사용·설치 방법은 `README.md`를 보세요. 이 문서는 소스를 이어받는 개발자를 위한 기술 설명입니다.

## 1. 한눈에 보기
| 항목 | 내용 |
|---|---|
| 형태 | 정적 사이트 (HTML / CSS / 순수 JavaScript). 프레임워크와 빌드 과정 없음 |
| 외부 의존성 | Google Fonts (Jua, Noto Sans KR) 하나뿐. npm 패키지 없음 |
| 백엔드 | Google Apps Script 웹 앱 1개 (`apps-script/Code.gs`) → 구글 시트에 저장 |
| 호스팅 | 폴더째 아무 정적 호스팅에 올리면 됨 (GitHub Pages, Netlify, Cloudflare Pages 등) |
| 브라우저 | 최신 Chrome / Edge / Safari / 모바일. 반응형 기준 폭은 1020 / 860 / 560px (관리자 페이지는 720px) |
| 현재 상태 | **미리보기 모드**: `config.js`의 ENDPOINT가 비어 있음. 시트를 연결한 실제 운영 모드는 아직 테스트하지 않음 |

## 2. 폴더 구조
```
openthe-share-site/
├─ index.html          선생님용 메인 페이지 (단일 페이지)
├─ admin.html          관리자: 키트 단가 관리
├─ css/style.css       공통 디자인 (색은 :root 변수로 관리)
├─ css/admin.css       관리자 전용 스타일
├─ js/config.js        사이트 설정: ENDPOINT, 연락처, 결제 방식
├─ js/prices.js        키트 기본 단가 { "키트명": 원 }
├─ js/kits.js          키트 65종 원본 데이터 + 분류·나눔 대상·계절 규칙 + 단가 덮어쓰기 로직
├─ js/app.js           메인 페이지 동작
├─ js/admin.js         관리자 페이지 동작
├─ assets/kits/kNN.jpg 키트 사진 (NN = DIY 키트북 PDF 페이지 번호, 02~66)
├─ apps-script/Code.gs 구글 시트 백엔드
├─ docs/               화면 캡처 PDF (참고용)
├─ README.md           설치·운영 안내 (비개발자용)
└─ HANDOVER.md         이 문서
```
스크립트 로드 순서가 중요합니다: `config.js → prices.js → kits.js → app.js` (admin.html은 마지막이 `admin.js`). 모두 전역 변수(`SITE_CONFIG`, `PRICE`, `KITS`)로 이어져 있습니다.

## 3. 데이터 흐름
```
[선생님 브라우저] ──POST(JSON, text/plain, no-cors)──▶ [Apps Script doPost] ──▶ 구글 시트 탭에 한 줄 추가
        │                                                   └─ NOTIFY_EMAIL이 있으면 알림 메일 발송
        └──GET ?type=feedback / ?type=prices──────────────▶ [Apps Script doGet] ──▶ 공개 승인된 후기 / 단가
[관리자 브라우저] ──POST {type:auth|prices, key}──────────▶ 비밀번호 확인 → '단가' 탭 덮어쓰기
```
- **ENDPOINT가 비어 있으면(미리보기 모드)** 서버로 아무것도 보내지 않습니다. 제출 내용과 단가 수정은 그 브라우저의 localStorage에만 남습니다.
- 메인 페이지는 `no-cors`로 보내기 때문에 서버 응답을 읽을 수 없습니다. 보낸 뒤에는 무조건 성공으로 표시합니다. 관리자 페이지는 응답을 읽어야 하므로 일반 CORS 요청을 씁니다. Apps Script 웹 앱은 `text/plain` POST라서 preflight 없이 동작합니다.

## 4. API 규격 (Apps Script)
| 요청 | 본문 / 파라미터 | 응답 |
|---|---|---|
| POST `type:"order"` | submittedAt, school, name, phone, email, programType, grade, schedule, instructor, donationLink, payment, items, totalQty, estimate, memo | `{ok:true}` |
| POST `type:"voc"` | topic, interests, level, budget, message, school, contact | `{ok:true}` |
| POST `type:"feedback"` | kit, overall, difficulty, engagement, sharing, target, again, comment, school, publish | `{ok:true}` |
| POST `type:"auth"` | key | `{ok:boolean}` |
| POST `type:"prices"` | key, prices `{키트명: 원}` | `{ok, savedAt}` 또는 `{ok:false, error:"unauthorized"}` |
| GET `?type=feedback` | — | 최근 30개 `[{kit, overall, comment, school, target}]`. 조건: approved=Y이고 publish≠N |
| GET `?type=prices` | — | `{키트명: 원}` |

시트 탭과 열은 `Code.gs`의 `SHEETS` 상수에서 정합니다. 탭이 없으면 첫 요청 때 자동으로 만들어집니다. 열을 추가할 때는 `SHEETS.cols`와 프런트 `app.js`의 해당 폼 `wire(...)` 빌더를 함께 고치세요.

## 5. 브라우저 저장소 키
| 키 | 저장소 | 용도 |
|---|---|---|
| `ots_cart` | localStorage | 장바구니 `{kitId: 수량}`. 기본 수량 20 |
| `ots_submissions` | localStorage | 미리보기 모드에서 제출한 내용 |
| `ots_my_feedback` | localStorage | 내가 쓴 후기 최근 5개 (내 화면에만 표시) |
| `ots_price_override` | localStorage | 미리보기 모드에서 관리자가 고친 단가 |
| `ots_admin_key` | sessionStorage | 관리자 로그인 키 (탭을 닫으면 사라짐) |

## 6. 키트 데이터 (`js/kits.js`)
- `KITS_RAW`: `[페이지, 이름, 난이도, 소요분, 제작방식]` 65개. 키트북에서 옮겨 적은 원본입니다.
- `GROUPS`: 키트명 키워드로 8개 분류를 정합니다. `GIVE_BY_GROUP`과 `GIVE_OVERRIDE`는 나눔 대상 추천, `SEASON`은 계절 태그입니다.
- 최종 `KITS` 항목은 `{id:"kNN", name, level, minutes, method, group, give, season, basePrice, price, img}` 형태입니다.
- 단가 결정 순서: `prices.js`의 기본값을 쓰고, 덮어쓴 값이 있으면 그 값을 씁니다. 덮어쓴 값은 ENDPOINT가 있으면 시트 '단가' 탭, 없으면 localStorage에서 읽습니다(`loadPriceOverrides()`).
- **키트 추가 방법:** `KITS_RAW`에 한 줄, `prices.js`에 단가, `assets/kits/kNN.jpg`에 사진을 추가합니다. 단가는 키트명을 키로 쓰기 때문에 이름을 바꾸면 시트 단가와 연결이 끊깁니다.

## 7. 관리자 인증
- 비밀번호는 `Code.gs`의 `ADMIN_KEY`에 있고 서버에서만 비교합니다. 프런트 코드에는 들어 있지 않습니다.
- 기본값(`여기에-관리자-비밀번호`)을 그대로 두면 로그인이 막힙니다.
- 단순 공유 비밀번호 방식입니다. 계정, 권한 단계, 로그인 시도 제한은 없습니다. 운영 규모가 커지면 보강이 필요합니다.
- 미리보기 모드에서는 비밀번호 없이 들어가집니다. 저장 결과도 그 브라우저에만 남으니 데모 용도로만 쓰세요.

## 8. 남은 작업 / 확인 필요
- [ ] Apps Script 배포 → ENDPOINT 연결 → 실제 운영 모드 테스트 (시트 저장, 메일 알림, 후기 노출, 단가 저장)
- [ ] `ADMIN_KEY` 변경, `NOTIFY_EMAIL` 설정
- [ ] 초안 문구 확정: "1영업일 내 견적", "최소 10개", "100% 기부 연계", 프로그램별 학년·차시·인원, 나눔 대상 추천
- [ ] 단가 확정 (현재 15,000~35,000원 사이 임시 단가)
- [ ] 개인정보 수집·이용 동의 문구 검토와 개인정보처리방침 페이지 추가
- [ ] 도메인 연결과 호스팅
- [ ] (선택) 온라인 카드 결제: PG 계약과 결제 승인 서버 필요 (README 3장 참고)
- [ ] (선택) 스팸 방지: 현재는 폼에 봇 차단 장치가 없음 (honeypot이나 reCAPTCHA 검토)

## 9. 저작권·자료 출처
- 키트 사진과 키트 정보는 오픈더쉐어 DIY 키트북(PDF)에서 가져왔습니다.
- 글꼴은 Google Fonts(SIL Open Font License)를 씁니다.
