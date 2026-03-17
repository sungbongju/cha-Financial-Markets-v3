// HeyGen API 프록시 — 교수님 cha-ai-graduate 코드 그대로
const ALLOWED_ENDPOINTS = [
  "/v1/streaming.new",
  "/v1/streaming.start",
  "/v1/streaming.task",
  "/v1/streaming.stop",
  "/v1/streaming.interrupt",
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, token, payload } = req.body;

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return res.status(400).json({ error: 'Invalid or disallowed endpoint' });
    }

    if (!token) {
      return res.status(401).json({ error: 'Session token required' });
    }

    const response = await fetch(`https://api.heygen.com${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('HeyGen proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
