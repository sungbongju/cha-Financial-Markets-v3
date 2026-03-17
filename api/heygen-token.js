// HeyGen Interactive Avatar — 토큰 발급 (FTF 모드용)
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

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    return res.status(500).json({ error: 'HEYGEN_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('HeyGen token error:', err);
      return res.status(response.status).json({ error: 'Failed to create HeyGen token', details: err });
    }

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (error) {
    console.error('HeyGen token error:', error);
    return res.status(500).json({ error: error.message });
  }
}
