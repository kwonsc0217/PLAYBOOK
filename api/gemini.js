import { hasVertexConfig, getVertexAccessToken } from '../lib/vertex.js';

const VERTEX_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT || '';

const VERTEX_LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

const VERTEX_MODEL =
  process.env.VERTEX_MODEL || 'gemini-1.5-flash';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasVertexConfig()) {
    return res.status(500).json({
      error: 'Vertex AI 프로젝트가 없습니다. 환경변수 GOOGLE_CLOUD_PROJECT 또는 VERTEX_PROJECT를 설정하세요.',
    });
  }

  try {
    const { prompt, maxTokens = 500, wikiContext } = req.body || {};
    let finalPrompt = prompt || '';

    if (wikiContext && String(wikiContext).trim()) {
      finalPrompt =
        `[아래는 팀 위키(도메인 지식)입니다. 답변 시 이 내용을 우선 참고하세요.]\n\n` +
        `${String(wikiContext).trim()}\n\n---\n\n${finalPrompt}`;
    }

    const token = await getVertexAccessToken();

    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;

    const proxyRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });

    const raw = await proxyRes.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {}

    if (!proxyRes.ok) {
      const msg = data?.error?.message || raw || `Vertex error: ${proxyRes.status}`;
      return res.status(proxyRes.status).json({ error: msg });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ text: String(text).trim() });

  } catch (e) {
    console.error('[Vertex AI 오류]', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
