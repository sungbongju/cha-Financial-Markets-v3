// api/humelo-tts.js — Humelo DIVE TTS 프록시
// 1단계: text → signature, 2단계: signature → WAV audio

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

  const HUMELO_API_KEY = process.env.HUMELO_API_KEY;
  if (!HUMELO_API_KEY) {
    return res.status(500).json({ error: 'HUMELO_API_KEY not configured' });
  }

  try {
    const { text, actor = 'Ju-yeong', language = 'kor', speed = 1.0 } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    // 1단계: 음성 생성 요청 → signature
    const genRes = await fetch('https://api.prosody-tts.com/api/ttsapi/voice-generation/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${HUMELO_API_KEY}`
      },
      body: JSON.stringify({
        text,
        actor,
        language,
        overall_speed: speed
      })
    });

    if (!genRes.ok) {
      const err = await genRes.text();
      return res.status(genRes.status).json({ error: 'Humelo generation error', details: err });
    }

    const genData = await genRes.json();
    const signature = genData.signature;

    if (!signature) {
      return res.status(500).json({ error: 'No signature returned', data: genData });
    }

    // 2단계: 음성 추출 → WAV binary
    const audioRes = await fetch(`https://api.prosody-tts.com/api/ttsapi/voice-generation/${signature}/generate/`, {
      method: 'GET',
      headers: {
        'Authorization': `Api-Key ${HUMELO_API_KEY}`
      }
    });

    if (!audioRes.ok) {
      const err = await audioRes.text();
      return res.status(audioRes.status).json({ error: 'Humelo audio error', details: err });
    }

    // WAV 바이너리를 base64로 변환하여 전달
    const audioBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    const duration = audioRes.headers.get('Voice-Duration') || '0';

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      audio: base64Audio,
      duration: parseFloat(duration),
      signature
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
