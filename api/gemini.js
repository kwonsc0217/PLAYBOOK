import { hasClaudeConfig, callClaudeForText } from '../lib/claude.js';

const SYSTEM_PROMPT = `당신은 게임회사 크리에이티브팀의 도우미입니다.
질문을 받으면 상황을 먼저 머릿속으로 파악한 뒤, 동료에게 말하듯 자연스럽게 답변하세요.
- 존댓말을 쓰되, 딱딱한 보고서 느낌보다는 편하게 대화하는 느낌으로 해주세요.
- 불필요한 인사말이나 "말씀드리겠습니다" 같은 형식적인 표현은 생략하세요.
- 핵심 내용을 먼저 말하고, 필요한 경우에만 보충 설명을 추가하세요.
- 감탄사("오!", "정말요?" 등)나 과도한 칭찬은 쓰지 마세요.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasClaudeConfig()) {
    return res.status(500).json({
      error: 'Anthropic API 키가 없습니다. 환경변수 ANTHROPIC_API_KEY를 설정하세요.',
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

    // Extended Thinking 활성화: 내부 추론 후 더 자연스러운 답변 생성
    const text = await callClaudeForText(finalPrompt, maxTokens, SYSTEM_PROMPT, true, 3000);
    return res.status(200).json({ text });

  } catch (e) {
    console.error('[Claude API 오류]', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
