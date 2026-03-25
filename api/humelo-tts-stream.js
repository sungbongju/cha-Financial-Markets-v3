// api/humelo-tts-stream.js — Humelo DIVE Streaming 프록시 (진짜 스트리밍)
// 오디오 청크를 받자마자 클라이언트로 바로 전달 → 0.3초 내 재생 시작

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const HUMELO_API_KEY = process.env.HUMELO_API_KEY;
  if (!HUMELO_API_KEY) return res.status(500).json({ error: 'HUMELO_API_KEY not configured' });

  // GET 또는 POST 지원
  let text, voiceName, speed, emotion;
  if (req.method === 'GET') {
    text = req.query.text;
    voiceName = req.query.voiceName || '시아';
    speed = parseFloat(req.query.speed) || 1.05;
    emotion = req.query.emotion || 'neutral';
  } else {
    ({ text, voiceName = '시아', speed = 1.05, emotion = 'neutral' } = req.body || {});
  }

  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const ttsRes = await fetch('https://prosody-api.humelo.works/api/v1/dive/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HUMELO_API_KEY
      },
      body: JSON.stringify({
        text,
        mode: 'preset',
        lang: 'ko',
        speed,
        voiceName,
        emotion,
        outputFormat: 'mp3_48000_128'
      })
    });

    if (!ttsRes.ok) {
      return res.status(ttsRes.status).json({ error: 'Humelo streaming failed', status: ttsRes.status });
    }

    // 오디오 스트림을 그대로 클라이언트에 전달
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const reader = ttsRes.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }

    res.end();
  } catch (error) {
    console.error('[humelo-tts-stream] error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
}
