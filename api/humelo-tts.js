// api/humelo-tts.js — Humelo DIVE TTS 프록시
// POST /api/tts/dive → { url, duration, format }

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
    const { text, speed = 1.0, pitch = 0.0, volume = 50, mode = 'preset', lang = 'ko', dictionaryId } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const body = { text, mode, lang, speed, pitch, volume };
    if (dictionaryId) body.dictionaryId = dictionaryId;

    console.log('[humelo-tts] request:', { text: text.substring(0, 50), lang, speed });

    const ttsRes = await fetch('https://api.prosody.dev/v1/tts/dive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HUMELO_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error('[humelo-tts] error:', ttsRes.status, err);
      return res.status(ttsRes.status).json({ error: 'Humelo TTS error', status: ttsRes.status, details: err });
    }

    const data = await ttsRes.json();
    console.log('[humelo-tts] success:', { audioUrl: !!data.audioUrl, duration: data.duration, format: data.format });

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
