import { GoogleAuth, JWT } from 'google-auth-library';

const VERTEX_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT || '';
const VERTEX_LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
const VERTEX_MODEL = process.env.VERTEX_MODEL || 'gemini-2.0-flash';

export function hasVertexConfig() {
  return !!VERTEX_PROJECT;
}

export async function getVertexAccessToken() {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  // Vercel 배포에서는 ADC 불가 → 환경변수 필수
  if ((!credsJson || !credsJson.trim()) && process.env.VERCEL) {
    throw new Error(
      'Vercel 배포에서는 GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수가 필수입니다. ' +
      'Settings → Environment Variables에서 서비스 계정 JSON 전체를 설정하고, Production에 체크한 뒤 Redeploy 하세요.'
    );
  }

  if (credsJson && credsJson.trim()) {
    // 서비스 계정 JSON 사용: JWT 직접 사용 → ADC 경로 완전 우회 (Vercel 안정 동작)
    let credentials;
    try {
      credentials = JSON.parse(credsJson);
    } catch (e) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON');
    }
    const { client_email, private_key } = credentials;
    if (!client_email || !private_key) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON에 client_email, private_key가 필요합니다.');
    }
    const jwt = new JWT({
      email: client_email,
      key: private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const res = await jwt.getAccessToken();
    const token = res?.token ?? res?.access_token;
    if (!token) {
      throw new Error('Vertex AI 인증 실패. 서비스 계정 권한을 확인하세요.');
    }
    return token;
  }

  // 로컬 개발: gcloud auth application-default login 사용
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  const token = typeof res === 'string' ? res : res?.token;
  if (!token) {
    throw new Error(
      'Vertex AI 인증 실패. 로컬: `gcloud auth application-default login` 실행 후 재시도.'
    );
  }
  return token;
}

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

  // 여기는 디버깅 편하게 에러 메시지까지 뱉게 바꾸는 걸 추천
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Vertex generateContent failed: ${res.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}