/**
 * GET /api/wiki?part=design — 해당 파트 위키 content + 공통 faq + parts + configured
 */
import { fetchWikiContent, getWikiContent, getFaq, getPartIds } from '../lib/wiki.js';

const CONFLUENCE_EMAIL = process.env.ATLASSIAN_EMAIL || process.env.CONFLUENCE_EMAIL || '';
const CONFLUENCE_TOKEN = process.env.ATLASSIAN_API_TOKEN || process.env.CONFLUENCE_API_TOKEN || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const partParam = req.query?.part || 'design';
    await fetchWikiContent();
    const partIds = getPartIds();
    const part = partIds.includes(partParam) ? partParam : 'design';
    const content = getWikiContent(part);
    const faq = getFaq();
    res.status(200).json({
      content,
      faq,
      parts: partIds,
      configured: !!(CONFLUENCE_EMAIL && CONFLUENCE_TOKEN),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}
