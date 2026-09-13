# DK SECURITY — 패스키 전용 비공개 영역 (과제 8)

1번 과제(`index.html`)의 공개 소개 페이지는 그대로 두고, 패스키(WebAuthn)로만 열리는 비공개 영역을 추가했다. 비밀번호는 어디에도 없다.

## 제출물

- 결과물 URL: `TODO — Vercel 배포 후 채우기 (예: https://xxxx.vercel.app)`
- 소스 URL: `TODO — GitHub 저장소 주소`

## 1. 인증 구현 설명서 (6항목)

**① 무엇으로 붙였나**
서버는 [`@simplewebauthn/server`](https://simplewebauthn.dev/), 브라우저는 `@simplewebauthn/browser`(WebAuthn Level 2 래퍼)를 사용했다. 저장소는 Upstash Redis(Vercel Marketplace 통합)를 `@upstash/redis`로 붙였다.

**② 왜 그걸 골랐나**
WebAuthn 저수준 스펙(CBOR/COSE 파싱, attestation 검증, 서명 검증)을 직접 구현하면 실수로 보안 구멍이 생기기 쉽다. SimpleWebAuthn은 W3C WebAuthn 스펙 준수 여부가 검증된 오픈소스 라이브러리라서 challenge 생성·응답 검증 같은 암호 연산은 라이브러리에 맡기고, 그 값을 누구에게 언제 발급/보관/폐기할지 같은 **정책(내 비즈니스 로직)**에 집중했다.

**③ 직접 구현 vs 라이브러리**
- 라이브러리가 하는 일: challenge 생성(`generateRegistrationOptions`/`generateAuthenticationOptions`), attestation/assertion 서명 검증(`verifyRegistrationResponse`/`verifyAuthenticationResponse`), 브라우저 쪽 `navigator.credentials.create/get` 호출 래핑.
- 내가 직접 짠 부분: challenge를 누구 이름으로 몇 분간 보관하고 한 번 쓰면 지우는 로직([`lib/store.js`](lib/store.js)의 `setChallenge`/`takeChallenge`), 세션 쿠키 발급·검증([`lib/session.js`](lib/session.js), [`lib/auth.js`](lib/auth.js)), 계정별 데이터 격리(소유자 검증, [`api/private-data.js`](api/private-data.js)), 패스키 목록·삭제 API([`api/passkeys/`](api/passkeys)).
- 소스 흐름: 브라우저(`assets/passkey-client.js`) → `/api/webauthn/*` → `lib/store.js`(KV) 순으로 지나간다.

**④ 등록·로그인·로그아웃·비공개 자료 조회 흐름**
- 등록: `assets/passkey-client.js:registerPasskey` → `POST /api/webauthn/register-options`([코드](api/webauthn/register-options.js)) → 브라우저 `startRegistration` → `POST /api/webauthn/register-verify`([코드](api/webauthn/register-verify.js))
- 로그인: `loginPasskey` → `POST /api/webauthn/login-options`([코드](api/webauthn/login-options.js)) → 브라우저 `startAuthentication` → `POST /api/webauthn/login-verify`([코드](api/webauthn/login-verify.js)) → 세션 쿠키 발급
- 로그아웃: `POST /api/logout`([코드](api/logout.js)) → KV 세션 삭제 + 쿠키 만료
- 비공개 자료 조회: `GET /api/private-data`([코드](api/private-data.js)) → `lib/auth.js:requireSession`이 세션 검증 → 401 또는 본인 자료만 반환

**⑤ 확인 4가지 ↔ 성공/실패 요청·응답**
| 확인 항목 | 성공 응답 | 실패 응답 |
|---|---|---|
| 로그인 없이 비공개 요청 | — | `GET /api/private-data` → `401 unauthenticated` |
| 남의 패스키로 로그인 | `POST .../login-verify` → `200 {verified:true}` (본인 것) | 다른 계정 자격증명 id로는 애초에 `unknown_credential`(401) |
| 이미 쓴 패스키로 열기 | 최초 요청 → `200` | 지운 패스키로 재로그인 시도 → `401 unknown_credential` |
| 패스키 삭제 뒤 재로그인 | — | `TODO: 실제 캡처 붙이기` |

*(TODO — 배포 후 브라우저 개발자도구 Network 탭에서 실제 요청/응답 캡처를 여기에 붙여넣을 것. 세션 쿠키 값은 마스킹.)*

**⑥ 아직 못 막은 것 (최소 하나)**
현재 계정 생성에 아무 제약이 없어서(아이디만 있으면 등록 가능) 누구나 임의의 아이디로 새 계정을 만들 수 있다 — 즉 "내 계정"과 "다른 사람이 만든 계정"을 서버가 구분하지 못한다. 실제 서비스라면 계정 생성 자체를 막거나(예: 초대 코드) 소유자 1명만 등록 가능하도록 화이트리스트를 둬야 하는데, 이번 과제에서는 카드5의 "계정 2개로 상호 테스트"를 쉽게 하기 위해 일부러 열어뒀다.

## 2. 짧은 확인 방법 (3줄)

1. **어디로 가나:** 결과물 URL 접속 → 맨 아래 [PRIVATE 🔒] 섹션으로 이동.
2. **세 단계 안에 뭘 하나:** 아이디 입력 → "패스키 등록" 클릭 → 브라우저/OS 인증창에서 지문·PIN 등으로 승인.
3. **뭐가 보이면 통과 / 안 되면 뭐가 보이나:** 등록 후 같은 아이디로 "패스키로 로그인" 클릭 → 비공개 메모 3개와 등록된 패스키 목록이 보이면 통과. 로그인 없이 다른 탭에서 `/api/private-data`를 직접 열면 `401`만 보여야 한다.

## 3. AI와 내 판단 (3줄)

1. **AI에게 맡긴 일:** WebAuthn API 보일러플레이트(옵션 생성/검증 호출 형태), 기존 1번 과제 다크 테마에 맞춘 UI 마크업/CSS 초안.
2. **내가 직접 판단한 일:** challenge를 한 번 쓰면 즉시 폐기하는 정책, 세션 TTL(1시간), `owner` 파라미터로 계정 간 접근을 명시적으로 막는 설계, 어떤 데이터를 "개인정보 아닌 더미"로 채울지.
3. **AI 제안을 따르지 않은 일:** `TODO — 실제 구현/배포 중 AI 제안과 다르게 판단한 지점이 있으면 여기 기록`

---

## 로컬 개발 / 배포 방법

```bash
npm install
npx vercel link        # Vercel 프로젝트 연결 (최초 1회)
# Vercel 대시보드 > Storage(Marketplace) 탭에서 Upstash Redis 통합을 이 프로젝트에 연결
npx vercel env pull    # UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN을 .env.local로 받기
npx vercel dev         # 로컬에서 http://localhost:3000 실행 (WebAuthn은 localhost 예외 허용)
```

배포:

```bash
npx vercel --prod
```

배포 후 `RP_ID`는 별도 설정 없이 요청 Host 헤더에서 자동 계산된다(커스텀 도메인을 쓰면 `.env`에 `RP_ID` 고정 가능).

## 카드별 통과 기준 대응 코드

- 카드1(공개/비공개 구획, 401 거절): [`api/private-data.js`](api/private-data.js), [`lib/auth.js`](lib/auth.js)
- 카드2(패스키 등록): [`api/webauthn/register-options.js`](api/webauthn/register-options.js), [`api/webauthn/register-verify.js`](api/webauthn/register-verify.js)
- 카드3(패스키 로그인, challenge 재사용 방지): [`api/webauthn/login-options.js`](api/webauthn/login-options.js), [`api/webauthn/login-verify.js`](api/webauthn/login-verify.js), [`lib/store.js`](lib/store.js)의 `takeChallenge`
- 카드4(다중 패스키, 삭제): [`api/passkeys/index.js`](api/passkeys/index.js), [`api/passkeys/[id].js`](api/passkeys/[id].js)
- 카드5(계정 간 격리): [`api/private-data.js`](api/private-data.js)의 `owner` 검증
