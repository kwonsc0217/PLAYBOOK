/**
 * GET /api/parts — 파트 ID 목록 (design, video, …)
 */
import { getPartIds } from '../lib/wiki.js';

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
    const parts = await getPartIds();
    res.status(200).json({ parts });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}