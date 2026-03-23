// api/humelo-tts.js — Humelo DIVE TTS 프록시
// Docs: https://console.humelo.com/docs

import https from 'https';

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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

  const HUMELO_API_KEY = process.env.HUMELO_API_KEY;
  if (!HUMELO_API_KEY) {
    return res.status(500).json({ error: 'HUMELO_API_KEY not configured' });
  }

  try {
    const { text, speed = 1.0, pitch = 0.0, volume = 50, voiceName = '시아', emotion = 'neutral', lang = 'ko', dictionaryId } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const body = { text, mode: 'preset', lang, speed, pitch, volume, voiceName, emotion };
    if (dictionaryId) body.dictionaryId = dictionaryId;

    console.log('[humelo-tts] request:', { text: text.substring(0, 50), voiceName, emotion, lang, speed });

    const payload = JSON.stringify(body);
    const ttsRes = await httpsPost('https://api.humelo.com/api/dive', {
      'Content-Type': 'application/json',
      'X-API-Key': HUMELO_API_KEY
    }, payload);

    console.log('[humelo-tts] response status:', ttsRes.status, 'body:', ttsRes.body.substring(0, 200));

    if (ttsRes.status !== 200) {
      return res.status(ttsRes.status).json({ error: 'Humelo TTS error', status: ttsRes.status, details: ttsRes.body });
    }

    const data = JSON.parse(ttsRes.body);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      audioUrl: data.audioUrl,
      duration: data.duration,
      format: data.format || 'wav'
    });
  } catch (error) {
    console.error('[humelo-tts] exception:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
