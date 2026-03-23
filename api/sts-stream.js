// api/sts-stream.js — SSE 스트리밍 엔드포인트
// 엑사원 스트리밍 + 한국어 문장 감지 + Humelo TTS 병렬 호출
import https from 'https';

// ── 카테고리/상품 데이터 (openai-chat.js에서 복사) ──
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

const ALL_PRODUCTS = {};
for (const [catId, cat] of Object.entries(CATEGORIES)) {
  for (const name of cat.products) ALL_PRODUCTS[name] = catId;
}

function detectCategory(text) {
  const greetings = ['안녕','반가','고마','감사','수고','잘가','바이'];
  if (greetings.some(g => text.includes(g))) return null;
  const t = text.replace(/\s/g, '').toLowerCase();
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw.replace(/\s/g, '').toLowerCase()))) return catId;
  }
  return null;
}

function detectProduct(text) {
  if (!text) return null;
  const t = text.replace(/\s/g, '').toUpperCase();
  let best = null, bestLen = 0;
  for (const name of Object.keys(ALL_PRODUCTS)) {
    const nameNorm = name.replace(/\s/g, '').toUpperCase();
    if (t.includes(nameNorm) && nameNorm.length > bestLen) { best = name; bestLen = nameNorm.length; }
  }
  return best;
}

// ── TTS 발음 후처리 ──
const TTS_REPLACEMENTS = {
  'ETF': '이티에프', 'ELS': '이엘에스', 'ETN': '이티엔',
  'ELD': '이엘디', 'ELW': '이엘더블유', 'CMA': '씨엠에이',
  'CD': '씨디', 'RP': '알피', 'ABS': '에이비에스',
  'MBS': '엠비에스', 'CDO': '씨디오', 'MMF': '엠엠에프',
  'MMT': '엠엠티', 'IRP': '아이알피', 'ISA': '아이에스에이',
  'REITs': '리츠', 'MMDA': '엠엠디에이'
};

function applyTtsPostProcessing(text) {
  let result = text;
  for (const [eng, kor] of Object.entries(TTS_REPLACEMENTS)) {
    result = result.replace(new RegExp(eng, 'gi'), kor);
  }
  return result;
}

// ── Humelo TTS 호출 (Standard) ──
function callHumeloTTS(text, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text, mode: 'preset', lang: 'ko', speed: 1.05,
      voiceName: '시아', emotion: 'neutral'
    });
    const url = new URL('https://agitvxptajouhvoatxio.supabase.co/functions/v1/dive-synthesize-v1');
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.audioUrl || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ── 스트리밍 STS 프롬프트 (JSON 없이 평문 출력) ──
function buildStreamingSTSPrompt() {
  const categoryList = Object.entries(CATEGORIES)
    .map(([k, v]) => `- ${v.name}: ${v.products.join(', ')}`)
    .join('\n');

  return `당신은 차의과학대학교 경영학전공의 금융상품 전문 상담사입니다.

## 역할
- 금융상품에 대해 전문적이고 친절하게 설명합니다.
- 한국어 해요체를 사용합니다.
- 음성 대화이므로 **2~3문장으로 간결하게** 답변합니다.
- **답변 텍스트만 직접 출력합니다. JSON, 코드 블록, 마크다운을 사용하지 마세요.**
- 영어 약어는 한글 발음으로 직접 표기하세요 (ETF→이티에프, ELS→이엘에스, CMA→씨엠에이 등)

## 금융상품 카테고리 (11개)
${categoryList}

## 10대 대표 상품 핵심 요약

### 1. 정기예금 — 비금융투자(예금) 대표
일정 기간 자금 예치 후 만기 시 원금+약정이자 지급. 예금자보호 5천만원. 이자소득세 15.4%.

### 2. 주식 — 지분증권 대표
기업 발행 유가증권, 시세차익+배당 수익. 예금자보호 미적용. 매매차익 비과세(대주주 제외).

### 3. 국고채 — 채무증권 대표
정부 발행 장기채권, 실질 무위험자산. 고정금리 이표채. 금리위험 존재.

### 4. ETF — 수익증권 대표
지수추종 상장형 펀드. 1주 단위 실시간 매매. 국내주식형 매매차익 비과세.

### 5. ELS — 파생결합증권 대표
기초자산 연계 조건부 수익 증권. 고난도 상품. 낙인 시 원금손실.

### 6. 주가지수선물 — 파생상품 대표
주가지수 방향성 약정 파생상품. 증거금 거래(레버리지). 마진콜 발생 가능.

### 7. 금 — 대체투자 대표
실물금/금ETF/금선물 등 다양한 형태. 인플레이션 헤지 수단.

### 8. 금전신탁 — 신탁 대표
금융기관 위탁 운용 자산관리 상품. 실적배당형/확정금리형.

### 9. CMA — 자산관리 대표
단기금융상품 자동투자 종합계좌. 수시입출금 가능.

### 10. 생명보험 — 보험 대표
생명 관련 위험 보장. 예금자보호 5천만원. 10년 유지 시 보험차익 비과세.

## 답변 규칙
1. 해요체 사용
2. 2~3문장으로 간결하게
3. 투자 권유 금지, 객관적 정보만 제공
4. 영어 약어 → 한글 발음으로 직접 표기`;
}

// ── 한국어 문장 경계 감지 ──
function detectSentenceBoundary(buffer) {
  if (buffer.length < 10) return -1;
  // 한국어 종결어미 + 마침표/느낌표/물음표
  const patterns = [
    /[.!?]\s*$/, /요[.!?]?\s*$/, /다[.!?]?\s*$/, /죠[.!?]?\s*$/,
    /니다[.!?]?\s*$/, /에요[.!?]?\s*$/, /해요[.!?]?\s*$/,
    /세요[.!?]?\s*$/, /어요[.!?]?\s*$/, /아요[.!?]?\s*$/,
    /네요[.!?]?\s*$/, /군요[.!?]?\s*$/, /거예요[.!?]?\s*$/,
    /이에요[.!?]?\s*$/, /래요[.!?]?\s*$/
  ];
  for (const p of patterns) {
    const m = buffer.match(p);
    if (m) return m.index + m[0].length;
  }
  return -1;
}

// ── SSE 헬퍼 ──
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── 메인 핸들러 ──
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
  const HUMELO_API_KEY = process.env.HUMELO_API_KEY;

  const { message, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    // 엑사원 스트리밍 호출
    const messages = [
      { role: 'system', content: buildStreamingSTSPrompt() },
      ...history.slice(-4),
      { role: 'user', content: message }
    ];

    const exaResponse = await fetch(`${EXAONE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXAONE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: EXAONE_MODEL,
        messages,
        max_tokens: 250,
        temperature: 0,
        stream: true
      })
    });

    if (!exaResponse.ok) {
      sendSSE(res, 'error', { message: 'Exaone API error', status: exaResponse.status });
      return res.end();
    }

    const reader = exaResponse.body.getReader();
    const decoder = new TextDecoder();

    let contentBuffer = '';     // 현재 문장 버퍼
    let fullReply = '';         // 전체 응답
    let sentenceIndex = 0;     // 문장 인덱스
    let inThought = false;     // <thought> 태그 내부 여부
    let thoughtBuffer = '';    // thought 버퍼
    let sseBuffer = '';        // SSE 라인 파싱 버퍼
    const ttsPromises = [];    // TTS 프로미스 추적

    // 연결 끊김 감지
    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    while (true) {
      if (clientDisconnected) break;

      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        let parsed;
        try { parsed = JSON.parse(dataStr); } catch { continue; }
        const token = parsed.choices?.[0]?.delta?.content;
        if (!token) continue;

        // <thought> 태그 필터링
        if (!inThought && (thoughtBuffer + token).includes('<thought>')) {
          inThought = true;
          thoughtBuffer += token;
          continue;
        }
        if (inThought) {
          thoughtBuffer += token;
          if (thoughtBuffer.includes('</thought>')) {
            // thought 끝 — </thought> 이후 텍스트 추출
            const afterThought = thoughtBuffer.split('</thought>').pop().trim();
            inThought = false;
            thoughtBuffer = '';
            if (afterThought) contentBuffer += afterThought;
          }
          continue;
        }

        contentBuffer += token;
        fullReply += token;

        // 문장 경계 감지
        const boundary = detectSentenceBoundary(contentBuffer);
        if (boundary > 0) {
          const sentence = contentBuffer.substring(0, boundary).trim();
          contentBuffer = contentBuffer.substring(boundary).trim();

          if (sentence.length > 0) {
            // text 이벤트 즉시 전송
            sendSSE(res, 'text', { sentence, index: sentenceIndex });

            // Humelo TTS 비동기 호출
            if (HUMELO_API_KEY) {
              const idx = sentenceIndex;
              const ttsText = applyTtsPostProcessing(sentence);
              const p = callHumeloTTS(ttsText, HUMELO_API_KEY).then(audioUrl => {
                if (!clientDisconnected) {
                  sendSSE(res, 'audio', { audioUrl, index: idx });
                }
              });
              ttsPromises.push(p);
            }

            sentenceIndex++;
          }
        }
      }
    }

    // 버퍼에 남은 텍스트 처리 (마지막 문장)
    if (contentBuffer.trim().length > 0) {
      const sentence = contentBuffer.trim();
      fullReply += (fullReply.endsWith(sentence) ? '' : '');

      sendSSE(res, 'text', { sentence, index: sentenceIndex });

      if (HUMELO_API_KEY) {
        const idx = sentenceIndex;
        const ttsText = applyTtsPostProcessing(sentence);
        const p = callHumeloTTS(ttsText, HUMELO_API_KEY).then(audioUrl => {
          if (!clientDisconnected) {
            sendSSE(res, 'audio', { audioUrl, index: idx });
          }
        });
        ttsPromises.push(p);
      }
      sentenceIndex++;
    }

    // 모든 TTS 완료 대기
    await Promise.allSettled(ttsPromises);

    // 네비게이션 감지 (전체 응답 + 사용자 메시지 기반)
    const detectedCategory = detectCategory(message) || detectCategory(fullReply);
    const detectedProduct = detectProduct(message) || detectProduct(fullReply);

    sendSSE(res, 'done', {
      fullReply: fullReply.trim(),
      action: detectedCategory ? 'navigate' : 'none',
      categoryId: detectedCategory || null,
      productName: detectedProduct || null
    });

  } catch (error) {
    console.error('[sts-stream] error:', error);
    sendSSE(res, 'error', { message: error.message });
  }

  res.end();
}
