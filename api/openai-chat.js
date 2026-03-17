// GPT 금융상품 상담사 — TTT + FTF 공용
const CATEGORIES = {
  deposit:     { name: '비금융투자(예금)', products: ['당좌예금','보통예금','정기예금','정기적금','주택청약저축'] },
  equity:      { name: '지분증권', products: ['주식','우선주','해외주식','공매도'] },
  debt:        { name: '채무증권', products: ['콜','재정증권','국고채','통화안정증권','상업어음','기업어음','CD','MMDA','은행인수어음','RP','발행어음','회사채','전환사채','신주인수권부사채','교환사채','ABS','MBS','CDO'] },
  fund:        { name: '수익증권', products: ['증권펀드','부동산펀드','특별자산펀드','혼합자산펀드','MMF','ETF','REITs'] },
  derivative_s:{ name: '파생결합증권', products: ['ETN','ELD','ELS','ELW'] },
  derivative:  { name: '파생상품', products: ['주가지수선물','주가지수옵션'] },
  alternative: { name: '대체투자', products: ['금','달러'] },
  trust:       { name: '신탁', products: ['MMT','금전신탁','재산신탁'] },
  loan:        { name: '여신', products: ['신용대출','담보대출','신용카드','팩토링'] },
  asset_mgmt:  { name: '자산관리', products: ['CMA','연금저축','IRP','ISA'] },
  insurance:   { name: '보험', products: ['생명보험','손해보험'] }
};

// 카테고리 키워드 → navigate
const CATEGORY_KEYWORDS = {
  deposit:     ['예금','적금','정기예금','보통예금','청약','당좌','비금융투자'],
  equity:      ['주식','지분','우선주','해외주식','공매도','배당'],
  debt:        ['채권','국고채','회사채','콜','CP','CD','RP','MMDA','ABS','MBS','CDO','전환사채','BW','EB'],
  fund:        ['펀드','ETF','MMF','REITs','수익증권','리츠'],
  derivative_s:['ELS','ELN','ETN','ELD','ELW','파생결합'],
  derivative:  ['선물','옵션','파생상품','주가지수선물','주가지수옵션'],
  alternative: ['금투자','금값','금 시세','달러','대체투자','대체 투자','원자재','금 투자'],
  trust:       ['신탁','금전신탁','재산신탁','MMT'],
  loan:        ['대출','신용대출','담보대출','신용카드','팩토링','여신'],
  asset_mgmt:  ['CMA','연금','IRP','ISA','자산관리','연금저축'],
  insurance:   ['보험','생명보험','손해보험']
};

function buildSystemPrompt() {
  const categoryList = Object.entries(CATEGORIES)
    .map(([k, v]) => `- ${v.name}: ${v.products.join(', ')}`)
    .join('\n');

  return `당신은 차의과학대학교 경영학전공의 금융상품 전문 상담사입니다.

## 역할
- 금융상품에 대해 전문적이고 친절하게 설명합니다.
- 한국어 해요체를 사용합니다.
- 모든 답변은 JSON으로 반환합니다.

## 금융상품 카테고리 (11개, 72개 상품)
${categoryList}

## 10대 대표 상품 핵심 요약

### 1. 정기예금 — 비금융투자(예금) 대표
일정 기간 자금 예치 후 만기 시 원금+약정이자 지급. 예금자보호 5천만원. 이자소득세 15.4%. 중도해지 시 낮은 이율 적용. 만기보유 금융자산 분류.

### 2. 주식 — 지분증권 대표
기업 발행 유가증권, 시세차익+배당 수익. 예금자보호 미적용. 거래소(코스피/코스닥) 실시간 매매. 매매차익 비과세(대주주 제외). 배당소득세 15.4%.

### 3. 국고채 — 채무증권 대표
정부 발행 장기채권, 실질 무위험자산. 고정금리 이표채. 유통시장에서 1천원부터 매수 가능. 이자 15.4% 과세, 매매차익 비과세. 금리위험 존재.

### 4. ETF — 수익증권 대표
지수추종 상장형 펀드. 1주 단위 실시간 매매. 국내주식형 매매차익 비과세. 레버리지/인버스형 장기보유 주의. 예금자보호 미적용.

### 5. ELS — 파생결합증권 대표
기초자산 연계 조건부 수익 증권. 고난도 상품(교육/숙려 필수). 낙인(Knock-In) 시 원금손실. 청약 방식, 중도해지 불가. 배당소득세 15.4%.

### 6. 주가지수선물 — 파생상품 대표
주가지수 방향성 약정 파생상품. 증거금 거래(레버리지). 고난도 상품. 마진콜 발생 가능. 파생소득 22% 과세.

### 7. 금 — 대체투자 대표
실물금/금ETF/금선물 등 다양한 형태. 이자·배당 없음, 매매차익만. 실물금 부가세 10%. 인플레이션 헤지 수단.

### 8. 금전신탁 — 신탁 대표
금융기관 위탁 운용 자산관리 상품. 실적배당형/확정금리형. 예금자보호 일반적 미적용. 이자/배당소득세 15.4%.

### 9. CMA — 자산관리 대표
단기금융상품 자동투자 종합계좌. 수시입출금 가능. 예금자보호 미적용(낮은 손실위험). 이자소득세 15.4%.

### 10. 생명보험 — 보험 대표
생명 관련 위험 보장. 예금자보호 5천만원. 10년 유지 시 보험차익 비과세. 중도해지 시 환급금 적음.

## 응답 형식 (반드시 JSON)
{
  "reply": "사용자에게 보여줄 답변 텍스트",
  "ttsReply": "TTS용 답변 (없으면 reply와 동일)",
  "action": "navigate" 또는 "none",
  "categoryId": "해당 카테고리 ID (action이 navigate일 때)",
  "productName": "특정 상품명 (상품에 대한 질문일 때, 없으면 생략)"
}

## 답변 규칙
1. 해요체 사용 (예: ~이에요, ~해요, ~있어요)
2. 간결하게 (3~5문장)
3. 특정 상품에 대한 질문이면 action: "navigate", categoryId + productName 모두 포함 (예: "국고채 알려줘" → categoryId: "debt", productName: "국고채")
4. 카테고리 전체에 대한 질문이면 action: "navigate", categoryId만 포함, productName 생략 (예: "채무증권이 뭐야?" → categoryId: "debt")
5. 인사/잡담이면 action: "none"
6. 투자 권유 금지, 객관적 정보만 제공
7. ttsReply: 영어 약어를 한글 발음으로 변환 (ETF→이티에프, ELS→이엘에스, CMA→씨엠에이 등)`;
}

// STS 프롬프트 (음성 대화용 — 지식 동일, 답변만 간결하게)
function buildSTSPrompt() {
  const categoryList = Object.entries(CATEGORIES)
    .map(([k, v]) => `- ${v.name}: ${v.products.join(', ')}`)
    .join('\n');

  return `당신은 차의과학대학교 경영학전공의 금융상품 전문 상담사입니다.

## 역할
- 금융상품에 대해 전문적이고 친절하게 설명합니다.
- 한국어 해요체를 사용합니다.
- 음성 대화이므로 **2~3문장으로 간결하게** 답변합니다.
- 모든 답변은 JSON으로 반환합니다.

## 금융상품 카테고리 (11개, 72개 상품)
${categoryList}

## 10대 대표 상품 핵심 요약

### 1. 정기예금 — 비금융투자(예금) 대표
일정 기간 자금 예치 후 만기 시 원금+약정이자 지급. 예금자보호 5천만원. 이자소득세 15.4%. 중도해지 시 낮은 이율 적용. 만기보유 금융자산 분류.

### 2. 주식 — 지분증권 대표
기업 발행 유가증권, 시세차익+배당 수익. 예금자보호 미적용. 거래소(코스피/코스닥) 실시간 매매. 매매차익 비과세(대주주 제외). 배당소득세 15.4%.

### 3. 국고채 — 채무증권 대표
정부 발행 장기채권, 실질 무위험자산. 고정금리 이표채. 유통시장에서 1천원부터 매수 가능. 이자 15.4% 과세, 매매차익 비과세. 금리위험 존재.

### 4. ETF — 수익증권 대표
지수추종 상장형 펀드. 1주 단위 실시간 매매. 국내주식형 매매차익 비과세. 레버리지/인버스형 장기보유 주의. 예금자보호 미적용.

### 5. ELS — 파생결합증권 대표
기초자산 연계 조건부 수익 증권. 고난도 상품(교육/숙려 필수). 낙인(Knock-In) 시 원금손실. 청약 방식, 중도해지 불가. 배당소득세 15.4%.

### 6. 주가지수선물 — 파생상품 대표
주가지수 방향성 약정 파생상품. 증거금 거래(레버리지). 고난도 상품. 마진콜 발생 가능. 파생소득 22% 과세.

### 7. 금 — 대체투자 대표
실물금/금ETF/금선물 등 다양한 형태. 이자·배당 없음, 매매차익만. 실물금 부가세 10%. 인플레이션 헤지 수단.

### 8. 금전신탁 — 신탁 대표
금융기관 위탁 운용 자산관리 상품. 실적배당형/확정금리형. 예금자보호 일반적 미적용. 이자/배당소득세 15.4%.

### 9. CMA — 자산관리 대표
단기금융상품 자동투자 종합계좌. 수시입출금 가능. 예금자보호 미적용(낮은 손실위험). 이자소득세 15.4%.

### 10. 생명보험 — 보험 대표
생명 관련 위험 보장. 예금자보호 5천만원. 10년 유지 시 보험차익 비과세. 중도해지 시 환급금 적음.

## 응답 형식 (반드시 JSON)
{
  "reply": "사용자에게 보여줄 답변 텍스트",
  "ttsReply": "TTS용 답변 (없으면 reply와 동일)",
  "action": "navigate" 또는 "none",
  "categoryId": "해당 카테고리 ID (action이 navigate일 때)",
  "productName": "특정 상품명 (상품에 대한 질문일 때, 없으면 생략)"
}

## 답변 규칙
1. 해요체 사용
2. 음성 대화이므로 **2~3문장**으로 간결하게
3. 특정 상품 질문 → action: "navigate", categoryId + productName
4. 카테고리 질문 → action: "navigate", categoryId만
5. 인사/잡담 → action: "none"
6. 투자 권유 금지, 객관적 정보만 제공
7. ttsReply: 영어 약어를 한글 발음으로 변환 (ETF→이티에프, ELS→이엘에스, CMA→씨엠에이 등)`;
}

// 상품 상세 조회용 프롬프트
const ANALYSIS_LABELS = [
  '상품 정의', '자격 여부', '교육 여부', '예금자 보호 여부',
  '상품 제조사와 유통사', '상품 매수 비용', '수익구조와 수익률',
  '매매 방식', '세제 혜택 여부', '회계상의 분류', '주요 이슈'
];

function buildProductDetailPrompt(productName) {
  return `당신은 차의과학대학교 경영학전공의 금융상품 전문가입니다.
"${productName}" 금융상품에 대해 다음 11개 항목을 각각 2~3문장으로 설명하세요.
항목: ${ANALYSIS_LABELS.join(', ')}

반드시 JSON 배열(문자열 11개)로만 반환하세요. 다른 텍스트 없이 배열만 반환합니다.
예시: ["상품 정의 설명...", "자격 여부 설명...", ..., "주요 이슈 설명..."]`;
}

// 전체 상품명 → 카테고리 매핑 (자동 생성)
const ALL_PRODUCTS = {};
for (const [catId, cat] of Object.entries(CATEGORIES)) {
  for (const name of cat.products) {
    ALL_PRODUCTS[name] = catId;
  }
}

function detectProduct(text) {
  if (!text) return null;
  const t = text.replace(/\s/g, '').toUpperCase();
  let best = null, bestLen = 0;
  for (const name of Object.keys(ALL_PRODUCTS)) {
    const nameNorm = name.replace(/\s/g, '').toUpperCase();
    if (t.includes(nameNorm) && nameNorm.length > bestLen) {
      best = name;
      bestLen = nameNorm.length;
    }
  }
  return best;
}

// 카테고리 전체 질문인지 판별 (예: "채무증권이 뭐야?", "예금 종류 알려줘")
const CATEGORY_NAMES = Object.values(CATEGORIES).map(c => c.name);
const CATEGORY_LEVEL_PATTERNS = ['종류','뭐가 있','어떤 것','카테고리','분류','전체','목록','리스트'];

function isCategoryLevelQuestion(text) {
  const t = text.replace(/\s/g, '');
  if (CATEGORY_NAMES.some(name => t.includes(name.replace(/\s/g, '')))) return true;
  if (CATEGORY_LEVEL_PATTERNS.some(p => t.includes(p))) return true;
  return false;
}

function detectCategory(text) {
  const greetings = ['안녕','반가','고마','감사','수고','잘가','바이'];
  if (greetings.some(g => text.includes(g))) return null;

  const t = text.replace(/\s/g, '').toLowerCase();
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw.replace(/\s/g, '').toLowerCase()))) {
      return catId;
    }
  }
  return null;
}



export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const EXAONE_API_KEY = process.env.EXAONE_API_KEY || 'router-key';
  const EXAONE_BASE_URL = process.env.EXAONE_BASE_URL || 'https://middleton.p-e.kr/v1';
  const EXAONE_MODEL = process.env.EXAONE_MODEL || 'exaone-deep-32b';

  try {
    const { message, history = [], productDetail, mode } = req.body || {};

    // ── 상품 상세 조회 모드 ──
    if (productDetail) {
      const response = await fetch(`${EXAONE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EXAONE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: EXAONE_MODEL,
          messages: [
            { role: 'system', content: buildProductDetailPrompt(productDetail) }
          ],
          max_tokens: 1500,
          temperature: 0
        })
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: 'Exaone API error', details: err });
      }

      const data = await response.json();
      let pdContent = data.choices?.[0]?.message?.content || '[]';
      pdContent = pdContent.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
      pdContent = pdContent.replace(/^<\/thought>\s*/g, '').trim();
      const pdJsonMatch = pdContent.match(/```json\s*([\s\S]*?)```/) || pdContent.match(/(\[[\s\S]*\])/) || pdContent.match(/(\{[\s\S]*\})/);
      if (pdJsonMatch) pdContent = pdJsonMatch[1].trim();

      let details;
      try {
        details = JSON.parse(pdContent);
      } catch {
        details = null;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ productDetail: productDetail, details });
    }

    // ── 일반 채팅 모드 ──
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // STS 경량 모드: 짧은 prompt + 적은 토큰 + 적은 history
    const isSTS = mode === 'sts';
    const systemPrompt = isSTS ? buildSTSPrompt() : buildSystemPrompt();
    const historySlice = isSTS ? history.slice(-4) : history.slice(-10);
    const maxTokens = isSTS ? 250 : 500;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historySlice,
      { role: 'user', content: message }
    ];

    const response = await fetch(`${EXAONE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXAONE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: EXAONE_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Exaone error:', err);
      return res.status(response.status).json({ error: 'Exaone API error', details: err });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';

    // 엑사원 <thought>...</thought> 태그 제거
    content = content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    // </thought>만 남은 경우도 제거
    content = content.replace(/^<\/thought>\s*/g, '').trim();
    // JSON 블록 추출 (```json ... ``` 또는 첫 번째 { ... })
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
    if (jsonMatch) content = jsonMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { reply: content, action: 'none' };
    }

    // 키워드 폴백: GPT가 navigate 안 했으면 키워드로 감지
    if (parsed.action !== 'navigate') {
      const detected = detectCategory(message);
      if (detected) {
        parsed.action = 'navigate';
        parsed.categoryId = detected;
      }
    }

    // 상품명 폴백: GPT가 productName 안 넣었으면 키워드로 감지
    // 단, 카테고리 전체 질문이면 상품 감지 생략 (카테고리로만 이동)
    if (parsed.action === 'navigate' && !parsed.productName) {
      const isCategoryQuestion = isCategoryLevelQuestion(message);
      if (!isCategoryQuestion) {
        const detectedProduct = detectProduct(message);
        if (detectedProduct) {
          parsed.productName = detectedProduct;
          parsed.categoryId = ALL_PRODUCTS[detectedProduct];
        }
      }
    }

    if (!parsed.ttsReply) parsed.ttsReply = parsed.reply;

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error.message });
  }
}
