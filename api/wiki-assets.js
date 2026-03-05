/**
 * GET /api/wiki-assets?part=design — 해당 파트 위키 어셋 목록
 */
import { fetchWikiContent, getWikiAssets, getPartIds } from '../lib/wiki.js';

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
    const assets = getWikiAssets(part);
    res.status(200).json({ assets });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}
