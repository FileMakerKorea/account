# ACCOUNT

개인용 가계부. React + TypeScript + Vite, shadcn b0 / React Aria, Firebase Authentication·Firestore·Hosting 구성입니다.

## 실행

Node.js 24 이상과 pnpm 11을 사용합니다. 현재 검증 환경은 Node 26.4.0, pnpm 11.19.0입니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Firebase 설정이 없으면 **로컬 모드**로 실행합니다. 거래는 이 브라우저의 IndexedDB에 저장됩니다. 실제 금융 데이터는 자동 생성되지 않으며 빈 장부에서 시작합니다. ‘예시 데이터로 둘러보기’는 명시적으로 체험 데이터를 추가합니다. 브라우저 데이터를 삭제하면 로컬 내역도 삭제되므로 JSON 백업을 이용하세요.

## 구현된 첫 버전

- 월별 수입·지출·월 수지, 집계 제외 금액, 분류별 지출
- 거래 생성·수정·삭제, 검색·유형·분류·결제수단 필터, 목록 페이지 이동
- 카드 이름별 귀속월 사용액, 수입·이체 처리
- 최대 60회 할부 미리보기, 연월 이동, 마지막 회차 나머지 배분
- 로컬 원자적 저장·중복 ID 방지·다중 창 수정 충돌 검출
- JSON 내보내기, 로컬 백업 가져오기(검증·중복 시 전체 취소)
- 라이트·다크·시스템 테마, 모바일 메뉴, React Aria 모달
- Firebase Google 로그인·UID별 월 조회·트랜잭션 저장 코드와 보안 규칙

은행·카드 실조회는 **미연동**입니다. 현재 화면은 수동 기록을 집계하며 카드사 청구액이나 은행 잔고를 표시하지 않습니다. 금융 API 계약·실사용 가능 여부 검증을 대체하지 않습니다.

## Firebase 연결

`.env.example`을 `.env.local`로 복사하고 Firebase Console의 웹 앱 설정 4개 값을 입력합니다. 이 파일은 Git에 포함되지 않습니다. 클라이언트 설정만 넣고 서비스 계정 키·금융 API 비밀 키는 넣지 않습니다.

프로젝트에서 Google 인증 공급자를 활성화하고 개발·운영 도메인을 허용해야 합니다. Firestore에 저장하기 전에 이 저장소의 규칙과 인덱스를 적용해야 합니다. 프로젝트 연결·리소스 생성·규칙 배포·Hosting 배포는 아직 수행하지 않았습니다.

- 데이터 경로: `users/{uid}/entries/{entryId}` (개인 1인 장부)
- `startPeriod`, `endPeriod`: `year * 12 + month - 1` 정수
- 할부는 계약 한 문서에 원금·횟수를 저장하고 회차는 계산합니다. 전체 계약 저장이 원자적이며 파생 회차를 별도 저장하지 않습니다.
- 수정은 revision을 검증하는 Firestore 트랜잭션, 삭제도 최신 revision을 확인합니다.
- 월별 조건으로 조회합니다. 월 내 목록은 브라우저에서 8건씩 표시합니다. 서버 페이지 나누기·대량 집계는 후속 범위입니다.
- 로컬 모드와 클라우드 장부는 분리됩니다. 로그인으로 로컬 자료가 자동 전송되지 않습니다.

배포가 승인되고 대상 프로젝트가 정해진 후 사용하는 명령:

```sh
pnpm build
pnpm exec firebase deploy --project <PROJECT_ID> --only firestore:rules,firestore:indexes,hosting
```

## 검증

```sh
pnpm lint
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
# Java 21 이상 필요. demo-account 프로젝트만 사용하며 운영 데이터에 접근하지 않습니다.
pnpm test:rules
```

Firestore 에뮬레이터는 8185, Auth는 9195 포트를 사용합니다. 수동 로컬 Firebase 검증 시 `.env.local`에 `VITE_FIREBASE_PROJECT_ID=demo-account`, 나머지 웹 설정에 데모 값을 입력하고 `VITE_USE_EMULATORS=true`로 설정한 뒤 아래 명령을 실행합니다. 운영 빌드에서는 에뮬레이터 옵션이 적용되지 않습니다.

```sh
pnpm exec firebase emulators:start --project demo-account --only auth,firestore
```

## 현재 제한과 후속 범위

- Google 로그인은 초기 제안 수단이며 실제 프로젝트 연결 후 사용자 검수가 필요합니다.
- 할부 수정·삭제는 **전체 계약**에 적용됩니다. 한 회차·남은 회차만 변경하기, 변경 이력·삭제 복원은 미구현입니다.
- 분류와 카드 이름은 거래에서 직접 입력합니다. 독립적인 카드·분류 관리, 예적금, 사업 매출은 후속 구현입니다.
- 클라우드 백업 복원, 자동 백업, 실제 FileMaker 데이터 이관은 미구현입니다.
- 카드대금 납부는 ‘이체’로 기록해야 중복 지출을 피할 수 있습니다. 자동 분류하지 않습니다.
- 테스트가 통과해도 실제 Firebase 프로젝트의 인증·색인·Hosting 연결을 검증한 것은 아닙니다.

[기획서](docs/planning/ACCOUNT_서비스_기획서_v0.1.md) · [디자인 표준](docs/design/README.md)
