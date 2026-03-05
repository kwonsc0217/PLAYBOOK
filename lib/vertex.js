/**
 * Vertex AI (Gemini) — Vercel/serverless용. 환경변수: VERTEX_PROJECT, VERTEX_LOCATION, VERTEX_MODEL
 */
import { GoogleAuth } from 'google-auth-library';

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT || '';
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
const VERTEX_MODEL = process.env.VERTEX_MODEL || 'gemini-2.0-flash';

export function hasVertexConfig() {
  return !!VERTEX_PROJECT;
}

export async function getVertexAccessToken() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res?.token) throw new Error('Vertex AI 인증 실패. 서비스 계정 또는 ADC 설정을 확인하세요.');
  return res.token;
}

/**
 * 프롬프트 → 생성 텍스트 (wikiContext는 호출 측에서 프롬프트에 붙여서 사용)
 */
export async function callVertexForText(prompt, maxTokens = 500) {
  if (!VERTEX_PROJECT) return '';
  const token = await getVertexAccessToken();
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}
