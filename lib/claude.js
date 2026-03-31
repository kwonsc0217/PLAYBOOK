/** Anthropic Claude API 헬퍼 — Vercel/serverless 환경 호환 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

export function hasClaudeConfig() {
  return !!ANTHROPIC_API_KEY;
}

/**
 * Claude API를 호출해 텍스트 응답을 반환합니다.
 * @param {string} prompt - 사용자 프롬프트
 * @param {number} maxTokens - 최대 토큰 수 (기본 500)
 * @param {string} systemPrompt - 시스템 프롬프트 (선택)
 * @param {boolean} useThinking - Extended Thinking 활성화 여부 (기본 false)
 * @param {number} thinkingBudget - 추론에 사용할 토큰 예산 (기본 3000)
 */
export async function callClaudeForText(
  prompt,
  maxTokens = 500,
  systemPrompt = '',
  useThinking = false,
  thinkingBudget = 3000,
) {
  if (!ANTHROPIC_API_KEY) return '';

  // thinking 활성화 시 max_tokens는 budget + 응답 토큰을 충분히 확보
  const totalMaxTokens = useThinking
    ? Math.max(maxTokens + thinkingBudget, thinkingBudget + 1000)
    : maxTokens;

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: totalMaxTokens,
    messages: [{ role: 'user', content: prompt }],
  };

  if (systemPrompt) body.system = systemPrompt;

  if (useThinking) {
    body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude API 오류: ${res.status}`);
  }

  // thinking 블록은 무시하고 text 블록만 추출
  if (Array.isArray(data.content)) {
    return data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim();
  }

  return data.content?.[0]?.text?.trim() ?? '';
}
