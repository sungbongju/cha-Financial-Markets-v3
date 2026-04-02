// api/humelo-tts.js — Humelo DIVE TTS 프록시
// Streaming 우선 시도 → Standard 폴백
// Streaming: POST https://prosody-api.humelo.works/api/v1/dive/stream
// Standard:  POST https://agitvxptajouhvoatxio.supabase.co/functions/v1/dive-synthesize-v1

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
    const { text, speed = 1.0, pitch = 0.0, volume = 50, voiceName = '나나', emotion = 'neutral', lang = 'ko', dictionaryId, streaming = true } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const body = { text, mode: 'preset', lang, speed, pitch, volume, voiceName, emotion };
    if (dictionaryId) body.dictionaryId = dictionaryId;

    console.log('[humelo-tts] request:', { text: text.substring(0, 50), voiceName, streaming });

    // ── 1차: Streaming 시도 (바이너리 오디오 청크 → base64 data URL) ──
    if (streaming) {
      try {
        const streamBody = { ...body, outputFormat: 'mp3_48000_128' };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const streamRes = await fetch('https://prosody-api.humelo.works/api/v1/dive/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': HUMELO_API_KEY },
          body: JSON.stringify(streamBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (streamRes.ok) {
          const buffer = Buffer.from(await streamRes.arrayBuffer());
          if (buffer.length > 100) {
            const base64 = buffer.toString('base64');
            console.log('[humelo-tts] streaming OK, size:', buffer.length);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json({
              audioUrl: `data:audio/mpeg;base64,${base64}`,
              mode: 'streaming',
              size: buffer.length
            });
          }
        } else {
          console.log('[humelo-tts] streaming failed:', streamRes.status);
        }
      } catch (e) {
        console.log('[humelo-tts] streaming error:', e.message);
      }
    }

    // ── 2차: Standard 폴백 (audioUrl 반환) ──
    console.log('[humelo-tts] falling back to standard');
    const standardRes = await fetch('https://agitvxptajouhvoatxio.supabase.co/functions/v1/dive-synthesize-v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': HUMELO_API_KEY },
      body: JSON.stringify(body)
    });

    if (!standardRes.ok) {
      const errText = await standardRes.text();
      console.log('[humelo-tts] standard failed:', standardRes.status, errText);
      return res.status(standardRes.status).json({ error: 'Humelo TTS error', details: errText });
    }

    const data = await standardRes.json();
    console.log('[humelo-tts] standard OK:', data.audioUrl?.substring(0, 60));

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      audioUrl: data.audioUrl,
      jobId: data.jobId,
      mode: 'standard',
      format: data.outputFormat || 'wav_48000'
    });
  } catch (error) {
    console.error('[humelo-tts] exception:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
