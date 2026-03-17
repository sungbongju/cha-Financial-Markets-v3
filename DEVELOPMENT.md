# cha-Financial-Markets 개발 문서

> 차의과학대학교 경영학전공 금융상품 AI 상담 플랫폼
> 배포: https://cha-financial-markets.vercel.app

---

## 1. 프로젝트 구조

```
cha-Financial-Markets/
├── api/                              # Vercel Serverless Functions
│   ├── openai-chat.js                # GPT-4o-mini 금융상담사 (TTT+FTF 공용, 272줄)
│   ├── heygen-token.js               # HeyGen 세션 토큰 발급 (44줄)
│   ├── heygen-proxy.js               # HeyGen API 프록시 (50줄)
│   └── realtime-token.js             # OpenAI Realtime WebRTC 토큰 (STS용, 79줄)
│
├── public/                           # 프론트엔드
│   ├── index.html                    # 메인 SPA (HTML+CSS+JS 통합, ~2300줄)
│   └── js/
│       └── auth.js                   # 카카오 로그인 + 세션 관리 (267줄)
│
├── server/
│   └── api.php                       # PHP 백엔드 (로그인, 사용자관리, 채팅로그, 226줄)
│
├── vercel.json                       # Vercel 라우팅 설정
└── package.json
```

---

## 2. 환경변수 (Vercel)

| 변수 | 용도 |
|------|------|
| `OPENAI_API_KEY` | GPT-4o-mini (TTT/FTF) + Realtime API (STS) |
| `HEYGEN_API_KEY` | Interactive Avatar 토큰 발급 (FTF) |

---

## 3. 배포 & 서버

| 구분 | 정보 |
|------|------|
| 프론트엔드 | Vercel (자동 배포, master 브랜치) |
| 백엔드 PHP | `https://aiforalab.com/finmarket-api/api.php` |
| DB | `finmarket_db` (user2 / user2!!) |
| GitHub | `sungbongju/cha-Financial-Markets` |

**vercel.json 라우팅:**
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

---

## 4. 3대 모드 아키텍처

### 4.1 TTT (Text-to-Text) — 텍스트 채팅

```
사용자 텍스트 입력
  → sendChat()
  → POST /api/openai-chat { message, history }
  → GPT-4o-mini (temperature:0, max_tokens:500)
  → JSON { reply, ttsReply, action, categoryId, productName }
  → 채팅 버블 표시
  → action="navigate" → selectCategory() + selectProduct()
```

### 4.2 STS (Speech-to-Speech) — OpenAI Realtime WebRTC

```
사용자 음성 (마이크)
  → POST /api/realtime-token → ephemeral 토큰
  → RTCPeerConnection 생성
  → 마이크 트랙 추가 → Offer/Answer SDP 교환
  → OpenAI Realtime 서버에 직접 연결
  → Whisper STT → GPT-4o-realtime → TTS → 스피커 출력
  → DataChannel 이벤트로 전사(transcript) 수신
  → detectProductFromText() → 자동 네비게이션
```

**STS VAD 설정:**
```javascript
turn_detection: {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 500
}
```

### 4.3 FTF (Face-to-Face) — HeyGen Interactive Avatar

```
[시작]
  → POST /api/heygen-token → 세션 토큰
  → callProxy('/v1/streaming.new') → session_id, url, access_token
  → LiveKit Room 연결 (TrackSubscribed → video 요소에 attach)
  → callProxy('/v1/streaming.start')
  → 인사 메시지 callProxy('/v1/streaming.task', { text, task_type:'repeat' })

[대화 루프]
  → Web Speech API (ko-KR, continuous, interimResults)
  → 최종 결과 또는 2초 무음 → ftfProcessInput(text)
  → POST /api/openai-chat → GPT 응답
  → action="navigate" → selectCategory() + selectProduct()
  → callProxy('/v1/streaming.task', { text: ttsReply, task_type:'repeat' })
  → 발화 시간 계산: max(3000, (글자수/5)*1000 + 1500) ms
  → 발화 중 500ms 후 마이크 재개 (interrupt 가능)

[Interrupt]
  → 아바타 발화 중 + 사용자 음성 감지
  → callProxy('/v1/streaming.interrupt')
  → 음성만 끊기, 비디오 유지 (TrackUnsubscribed에서 세션 중 detach 안 함)
```

**아바타 설정:**
```javascript
const AVATAR_CONFIG = {
  avatarId: 'e2eb35c947644f09820aa3a4f9c15488',
  voiceId: '15d128072e194dc399d2898967941897'
};
```

> ⚠️ HeyGen `/v1/streaming.*` API는 **2026년 3월 말 종료 예정** → LiveAvatar 마이그레이션 필요

---

## 5. API 엔드포인트

### 5.1 Vercel Serverless

#### `POST /api/openai-chat` — GPT 금융상담

**모드 1: 일반 채팅**
```json
// Request
{ "message": "국고채가 뭐야?", "history": [...] }

// Response
{
  "reply": "국고채는 정부가 발행하는 장기채권으로...",
  "ttsReply": "국고채는 정부가 발행하는 장기 채권으로...",
  "action": "navigate",
  "categoryId": "debt",
  "productName": "국고채"
}
```

**모드 2: 상품 상세 조회**
```json
// Request
{ "productDetail": "국고채" }

// Response
{ "details": ["상품 정의...", "자격 여부...", ..., "주요 이슈..."] }
// 11개 항목 배열
```

**GPT 설정:** `gpt-4o-mini`, temperature: 0, JSON 강제

**키워드 폴백:**
- GPT가 `action: "navigate"` 반환 안 하면 → `CATEGORY_KEYWORDS`로 카테고리 감지
- `productName` 없으면 → `ALL_PRODUCTS` 매핑에서 상품명 감지

#### `POST /api/heygen-token` — HeyGen 토큰
```json
// Response
{ "token": "eyJ0eXAiOiJKV1...", "expires_in": 3600 }
```

#### `POST /api/heygen-proxy` — HeyGen API 프록시
```json
// Request
{
  "endpoint": "/v1/streaming.new",     // 허용: .new, .start, .task, .stop, .interrupt
  "token": "eyJ0eXAiOiJKV1...",
  "payload": { ... }
}
```

#### `POST /api/realtime-token` — OpenAI Realtime 토큰
```json
// Response
{ "client_secret": "ek_...", "session_id": "sess_..." }
```

### 5.2 PHP 서버 (`aiforalab.com/finmarket-api/api.php`)

| Action | Method | 용도 |
|--------|--------|------|
| `kakao_login` | POST | 카카오 로그인 → JWT 발급 |
| `verify` | GET | 토큰 검증 |
| `log_event` | POST | 단일 이벤트 로깅 |
| `log_batch` | POST | 배치 이벤트 로깅 |
| `save_chat` | POST | 채팅 히스토리 DB 저장 |
| `health` | GET | 헬스 체크 |

**DB 테이블:**
```
users         (id, kakao_id, name, email, visit_count, last_login, created_at)
user_logs     (id, user_id, session_id, event_type, section_id, duration_sec, detail, created_at)
chat_history  (id, user_id, session_id, role, content, created_at)
```

---

## 6. 데이터 구조

### 6.1 카테고리 (11개, 55개 상품)

| 카테고리 ID | 이름 | 아이콘 | 상품 수 | 대표상품 |
|------------|------|--------|--------|---------|
| `deposit` | 비금융투자(예금) | 💰 | 5 | 정기예금 |
| `equity` | 지분증권 | 📈 | 4 | 주식 |
| `debt` | 채무증권 | 📄 | 18 | 국고채 |
| `fund` | 수익증권 | 📈 | 7 | ETF |
| `derivative_s` | 파생결합증권 | 📉 | 4 | ELS |
| `derivative` | 파생상품 | 📊 | 2 | 주가지수선물 |
| `alternative` | 대체투자 | 🎯 | 2 | 금 |
| `trust` | 신탁 | 🔐 | 3 | 금전신탁 |
| `loan` | 여신 | 💰 | 4 | - |
| `asset_mgmt` | 자산관리 | 📋 | 4 | CMA |
| `insurance` | 보험 | 🛡️ | 2 | 생명보험 |

### 6.2 PRODUCT_DETAILS (하드코딩, 55개)

각 상품당 11개 분석 항목:
```
[0]  상품 정의
[1]  자격 여부
[2]  교육 여부
[3]  예금자 보호 여부
[4]  상품 제조사와 유통사
[5]  상품 매수 비용
[6]  수익구조와 수익률
[7]  매매 방식
[8]  세제 혜택 여부
[9]  회계상의 분류
[10] 주요 이슈
```

> 옵시디언 Vault 72개에서 실제 사용 55개만 선별 하드코딩.
> 제외: 전자단기사채, 외화채권, DLS, 파생상품 세부(43-57), 보험 세부(71-72)

### 6.3 카테고리 감지 키워드

```javascript
const CATEGORY_KEYWORDS = {
  deposit:      ['예금','적금','정기예금','보통예금','청약','당좌','비금융투자'],
  equity:       ['주식','지분증권','우선주','해외주식','공매도','배당'],
  debt:         ['채권','국고채','회사채','콜','CP','CD','RP','MMDA','ABS','MBS','CDO','전환사채','채무증권'],
  fund:         ['펀드','ETF','MMF','REITs','수익증권','리츠'],
  derivative_s: ['ELS','ETN','ELD','ELW','파생결합'],
  derivative:   ['선물','옵션','파생상품','주가지수선물','주가지수옵션'],
  alternative:  ['금투자','금값','달러','대체투자','원자재'],
  trust:        ['신탁','금전신탁','MMT','재산신탁'],
  loan:         ['대출','신용대출','담보대출','신용카드','팩토링','여신'],
  asset_mgmt:   ['CMA','연금','IRP','ISA','자산관리','연금저축'],
  insurance:    ['보험','생명보험','손해보험']
};
```

### 6.4 네비게이션 감지 로직

**공통:**
- 모든 감지 함수에서 **공백 제거 후 비교** (Whisper "대체 투자" → "대체투자" 매칭)
- `isCategoryLevelQuestion()`: 카테고리명 또는 "종류/뭐가 있/전체" 등 패턴 감지 → 상품 감지 생략
- `isProductMentioned()`: 짧은 상품명("금") 오탐 방지 — "금융/금리/세금" 등 복합어 제외

**TTT/FTF** (서버 `api/openai-chat.js`):
- GPT 응답의 `action:"navigate"` → categoryId + productName
- 키워드 폴백: GPT가 navigate 안 하면 키워드로 카테고리 감지
- 카테고리 수준 질문이면 productName 감지 생략

**STS** (프론트엔드):
- 사용자 발화 전사 → 상품 + 카테고리 감지
- AI 응답 전사 → 보완 네비게이션 (사용자 STT 실패 시)
  - 상품 1개 감지 → 해당 상품으로 이동
  - 상품 여러 개 → 최다 카테고리로만 이동
  - 5초 이내 중복 네비게이션 방지

---

## 7. 주요 함수 맵

### 프론트엔드 (index.html)

```
── 초기화 ──
DOMContentLoaded
  ├── renderContent()              카테고리/상품 목록 렌더링
  └── auth.js → 카카오 초기화     자동 로그인 시도

── 네비게이션 ──
selectCategory(catId)              카테고리 선택 → UI 업데이트
selectProduct(productName)         상품 선택 → 분석 표시 (하드코딩 or GPT 동적)
renderContent()                    메인 콘텐츠 렌더링
switchMode(mode)                   ttt/sts/ftf 모드 전환

── TTT ──
sendChat()                         텍스트 입력 → GPT → 응답 표시
appendMessage(role, html)          채팅 버블 추가

── STS ──
startSTS() / stopSTS()             Realtime WebRTC 세션 시작/종료
toggleSTS()                        STS 토글
handleSTSEvent(event)              DataChannel 이벤트 처리
stsNavigateByText(text, isAi)      전사 텍스트 → 네비게이션 (사용자/AI 구분)
detectProductFromText(text)        텍스트에서 상품명 감지
detectAllProductsFromText(text)    텍스트에서 모든 상품명 감지
detectCategoryFromText(text)       텍스트에서 카테고리 감지
isProductMentioned(text, name)     상품명 매칭 (짧은 이름 오탐 방지)
isCategoryLevelQuestion(text)      카테고리 수준 질문 판별
updateSTSVisual(state)             시각화 업데이트

── FTF ──
startFTF() / stopFTF()             아바타 세션 시작/종료
toggleFTF()                        FTF 토글
ftfCallProxy(endpoint, payload)    HeyGen API 프록시 호출
ftfInitSpeechRecognition()         Web Speech API 초기화
ftfStartListening() / ftfStopListening()  마이크 제어
ftfProcessInput(text)              음성 텍스트 → GPT → 아바타 발화
ftfInterrupt()                     아바타 발화 중단
setFTFState(state)                 상태 UI 업데이트

── 인증 (auth.js) ──
kakaoLogin()                       카카오 로그인 시작
proceedWithKakaoUser()             사용자 정보 가져오기
sendLoginToServer()                서버에 로그인 전송
onLoginSuccess()                   로그인 성공 처리
enableAIFeatures() / disableAIFeatures()  AI 기능 활성화/비활성화
```

---

## 8. 전역 상태 변수

```javascript
// 공통
let currentCategory = 'deposit';     // 현재 카테고리
let currentProduct = null;           // 현재 상품
let currentMode = 'ttt';             // 현재 모드
let chatHistory = [];                // 대화 히스토리
let isSending = false;               // 전송 중 플래그

// STS
let stsActive = false;               // STS 세션 활성 여부
let stsPeerConnection = null;        // WebRTC PeerConnection
let stsDataChannel = null;           // DataChannel

// FTF
let ftfSessionInfo = null;           // HeyGen 세션 { session_id, url, access_token }
let ftfRoom = null;                  // LiveKit Room
let ftfSessionToken = null;          // HeyGen 세션 토큰
let ftfRecognition = null;           // SpeechRecognition 인스턴스
let ftfIsListening = false;          // 마이크 활성 여부
let ftfIsProcessing = false;         // GPT 처리 중
let ftfIsSpeaking = false;           // 아바타 발화 중
let ftfAutoListen = true;            // 자동 듣기
let ftfSilenceTimer = null;          // 무음 타이머
let ftfSpeakTimer = null;            // 발화 완료 타이머
```

---

## 9. CSS 디자인 시스템

```css
:root {
  --bg: #fafafa;                 /* 메인 배경 */
  --bg-sidebar: #141414;        /* 사이드바 (다크) */
  --bg-card: #ffffff;            /* 카드 */
  --bg-chat: #f5f5f5;           /* 채팅 배경 */
  --text: #1a1a1a;              /* 기본 텍스트 */
  --text-secondary: #666;       /* 보조 텍스트 */
  --text-sidebar: #a0a0a0;      /* 사이드바 텍스트 */
  --text-sidebar-active: #fff;  /* 활성 사이드바 */
  --accent: #1a1a1a;            /* 강조색 */
  --accent-light: #f0f0f0;      /* 약한 강조 */
  --radius: 8px;                /* 보더 반경 */
}
```

**레이아웃 (3-column):**
```
┌─────────────┬────────────────────┬──────────────┐
│  Sidebar    │   Main Content     │  Chat Panel  │
│  (260px)    │   (flex: 1)        │  (380px)     │
│             │                    │              │
│ 카테고리    │  상품 목록         │  TTT 채팅    │
│ 모드 탭     │  상품 분석 (11항목)│  STS 음성    │
│             │                    │  FTF 아바타  │
└─────────────┴────────────────────┴──────────────┘
```

---

## 10. 카카오 로그인 흐름

```
[1] 동의항목 체크 (필수 2개 + 선택 1개)
[2] 카카오 로그인 버튼 클릭
[3] Kakao.Auth.login() → 카카오 인증 팝업
[4] 성공 → Kakao.API.request('/v2/user/me') → kakao_id, nickname, email
[5] POST /finmarket-api/api.php { action:'kakao_login', kakao_id, nickname, email }
[6] 서버: JWT 발급 (7일 유효) + 방문 횟수 증가
[7] localStorage에 토큰+사용자 정보 저장
[8] enableAIFeatures() → AI 상담 기능 활성화
```

**설정:**
```javascript
var KAKAO_JS_KEY = 'fc0a1313d895b1956f3830e5bf14307b';
var API_BASE = 'https://aiforalab.com/finmarket-api/api.php';
```

---

## 11. 외부 의존성

| 서비스 | 용도 | CDN/API |
|--------|------|---------|
| Kakao SDK v1 | 로그인 | `developers.kakao.com/sdk/js/kakao.min.js` |
| LiveKit Client | FTF 비디오 스트리밍 | `unpkg.com/livekit-client/dist/livekit-client.umd.min.js` |
| OpenAI API | GPT-4o-mini (채팅), Realtime (STS) | api.openai.com |
| HeyGen API | Interactive Avatar (FTF) | api.heygen.com |
| Google Fonts | Pretendard | fonts.googleapis.com |

---

## 12. 알려진 이슈 & TODO

### ⚠️ HeyGen Interactive Avatar API 종료 (2026-03 말)
- 현재 사용 중: `api.heygen.com/v1/streaming.*` (Interactive Avatar, 구 API)
- 2026년 3월 말 지원 종료 예정
- LiveAvatar LITE 모드로 마이그레이션 필요 (v10 코드 참조)
- 마이그레이션 시 변경: streaming.new → LiveAvatar 세션, streaming.task → speak_text

### 크레딧
- HeyGen Pay-As-You-Go로 $100 충전 (2026-03-12)
- 크레딧 부족 시 `quota not enough` 에러 (400)

### STS Whisper 한국어 인식 한계
- 금융 전문용어 인식률 낮음 (수익증권→주윅증권, 파생결합증권→힌타 개정료 등)
- 시스템 프롬프트에 55개 상품명 나열로 일부 개선
- AI 응답 전사로 보완 네비게이션 적용

### FTF Interrupt
- interrupt 시 화면 까매짐 수정 완료 (TrackUnsubscribed에서 세션 중 detach 방지)

### 미구현
- 채팅 히스토리 DB 저장 (save_chat API는 존재, 프론트 연동 미완)
- 사용자 로그 수집 (log_event API 존재, 프론트 연동 미완)
- favicon.ico 누락 (404)

### DB 현황 (2026-03-12)
- users: 26명 (학생 24 + 교수님 + 개발자)
- chat_history: 비어있음 (프론트 연동 미완)
- user_logs: 비어있음 (프론트 연동 미완)
- 한글 정상 저장 (utf8mb4)
