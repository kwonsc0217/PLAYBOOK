/** Confluence 위키 파싱 — Vercel/serverless용. lib/vertex 호출로 Design 어셋 이름 정규화 */
import { callVertexForText } from './vertex.js';

// Design: 896904800, Video: 915189005, FAQ: 915192299. 추후 파트 추가 시 CONFLUENCE_PAGES에 id:pageId 추가
const CONFLUENCE_BASE = (process.env.CONFLUENCE_BASE_URL || 'https://krafton.atlassian.net/wiki').replace(/\/$/, '');
const CONFLUENCE_EMAIL = process.env.ATLASSIAN_EMAIL || process.env.CONFLUENCE_EMAIL || '';
const CONFLUENCE_TOKEN = process.env.ATLASSIAN_API_TOKEN || process.env.CONFLUENCE_API_TOKEN || '';
// 접속 최초 1회만 Confluence 조회. 기본 1시간(3600초). WIKI_CACHE_TTL로 조정 가능
const WIKI_CACHE_TTL_MS = Math.max(1, parseInt(process.env.WIKI_CACHE_TTL || '3600', 10)) * 1000;

// 파트별 페이지 ID (design:896904800,video:915189005 형식). FAQ는 별도 페이지
function parseConfluencePages() {
  const pagesStr = process.env.CONFLUENCE_PAGES || 'design:896904800,video:915189005';
  const faqId = process.env.CONFLUENCE_FAQ_PAGE_ID || '915192299';
  const parts = {};
  pagesStr.split(',').forEach((pair) => {
    const [id, pageId] = pair.trim().split(':').map((s) => s.trim());
    if (id && pageId) parts[id] = pageId;
  });
  return { parts, faqPageId: faqId };
}
const { parts: CONFLUENCE_PARTS, faqPageId: CONFLUENCE_FAQ_PAGE_ID } = parseConfluencePages();
const CONFLUENCE_PAGE_IDS = Object.values(CONFLUENCE_PARTS);
const CONFLUENCE_PAGE_ID = CONFLUENCE_PARTS.design || CONFLUENCE_PAGE_IDS[0] || '896904800';  // 하위 호환

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT || '';


/** AI가 위키 행 이름을 표준 9개로 매칭 (로고→Logo 등). 매핑 테이블 없이 AI 판단 */
const STANDARD_NAMES = 'KEYART, Logo, Brand Guide, Youtube Thumbnail, SNS Images, PR Images, OOH / Poster, Package, Goods';
async function normalizeAssetNamesWithAI(names) {
  if (!Array.isArray(names) || names.length === 0 || !VERTEX_PROJECT) return null;
  const list = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const prompt = `다음은 작업(어셋) 이름 목록입니다. 각각을 아래 9개 중 정확히 하나에 대응시켜 주세요. 같은 의미면 같은 키로 매칭합니다.
표준 목록: ${STANDARD_NAMES}

입력 목록:
${list}

응답은 반드시 JSON 배열 하나만 출력하세요. 입력 순서와 동일한 순서로, 매칭된 표준 이름만 넣습니다. 다른 설명 없이 배열만.
예: ["Logo", "KEYART", "SNS Images"]`;
  try {
    const raw = await callVertexForText(prompt, 300);
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;
    const arr = JSON.parse(jsonMatch[0]);
    return Array.isArray(arr) && arr.length === names.length ? arr : null;
  } catch (e) {
    console.error('[위키 어셋 이름 정규화 오류]', e.message || e);
    return null;
  }
}

// Confluence 위키 캐시. parts[partId] = { content, assets }, faq = 전용 FAQ 페이지에서 파싱
let wikiCache = { parts: {}, faq: [], ts: 0 };
function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// 노출 허용 작업 항목만 사용 (범위 확대 방지). 위키 테이블에서 이 목록에 해당하는 행만 노출
const ALLOWED_ASSET_NAMES = [
  'keyart', 'logo', 'brand guide', 'youtube thumbnail', 'sns images', 'pr images',
  'ooh / poster', 'package', 'goods'
];
function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ');
}
function isAllowedAssetName(name) {
  const n = normName(name);
  if (!n) return false;
  return ALLOWED_ASSET_NAMES.some((a) => {
    const na = normName(a);
    return n === na || n.includes(na) || na.includes(n);
  });
}

/** 위키 테이블: 분류(선택) / 항목 / 예상 소요 기간 / 단계 / 세부 유의 사항 / 이미지 — 헤더로 열 인덱스 추측 */
function getColumnIndices(headerCells, nextRowCells) {
  const idx = { name: 0, duration: 1, steps: -1, details: 2, images: -1, category: -1 };
  const nameKeywords = /^항목$|item|이름|어셋|name|asset|작업/i;
  const durationKeywords = /기간|duration|소요|리드타임|estimated/i;
  const stepsKeywords = /단계|steps|stage/i;
  const detailsKeywords = /세부|유의\s*사항|precautions|remark|참고|notes/i;
  const imagesKeywords = /이미지\s*슬라이드|이미지|슬라이드|image|slide/i;
  const categoryKeywords = /^분류$|category|카테고리/i;
  for (let i = 0; i < headerCells.length; i++) {
    const t = (headerCells[i] || '').trim();
    if (categoryKeywords.test(t)) idx.category = i;
    else if (nameKeywords.test(t)) idx.name = i;
    else if (durationKeywords.test(t)) idx.duration = i;
    else if (stepsKeywords.test(t)) idx.steps = i;
    else if (detailsKeywords.test(t)) idx.details = i;
    else if (imagesKeywords.test(t)) idx.images = i;
  }
  if (idx.steps < 0 && Array.isArray(nextRowCells) && nextRowCells.length > 0) {
    for (let i = 0; i < nextRowCells.length; i++) {
      const t = String(nextRowCells[i] || '').trim();
      if (stepsKeywords.test(t)) { idx.steps = i; break; }
    }
  }
  if (idx.details < 0) idx.details = idx.steps >= 0 ? idx.steps + 1 : 2;
  return idx;
}

/** 셀 텍스트에서 이미지 URL만 추출 (공백·줄바꿈·쉼표 구분) */
function parseImageUrls(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(/[\n,\s]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
}

/** 셀 내용에서 텍스트만 추출. <br>/<p>는 줄바꿈으로 보존해 세부 유의사항 항목 구분에 사용 */
function stripCell(html) {
  let s = String(html || '').replace(/&nbsp;/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<p[^>]*>/gi, '');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/[ \t]+/g, ' ').replace(/\n[\s]*\n/g, '\n').replace(/^\s+|\s+$/g, '');
  return s.trim();
}

/** 상대 URL을 Confluence 기준 주소로 변환 */
function resolveImageUrl(url) {
  const u = (url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return 'https:' + u;
  const base = (CONFLUENCE_BASE || '').replace(/\/$/, '');
  if (base && u.startsWith('/')) return base + u;
  return u;
}

/** HTML에서 이미지·영상 URL 추출 (위키 이미지 열). img, video, source, Confluence ri:url 등 */
function extractImageUrlsFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  const urls = [];
  const imgSrc = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = imgSrc.exec(html)) !== null) {
    const u = resolveImageUrl(m[1]);
    if (u) urls.push(u);
  }
  const videoSrc = /<video[^>]+src\s*=\s*["']([^"']+)["']/gi;
  while ((m = videoSrc.exec(html)) !== null) {
    const u = resolveImageUrl(m[1]);
    if (u) urls.push(u);
  }
  const sourceSrc = /<source[^>]+src\s*=\s*["']([^"']+)["']/gi;
  while ((m = sourceSrc.exec(html)) !== null) {
    const u = resolveImageUrl(m[1]);
    if (u) urls.push(u);
  }
  const riUrl = /<ri:value[^>]*>([^<]+)<\/ri:value>|<ri:url[^>]*>([^<]*)<\/ri:url>/gi;
  while ((m = riUrl.exec(html)) !== null) {
    const u = resolveImageUrl((m[1] || m[2]) || '');
    if (u) urls.push(u);
  }
  const acImage = /<ac:image[^>]*>[\s\S]*?<ri:url[^>]*>([^<]*)<\/ri:url>/gi;
  while ((m = acImage.exec(html)) !== null) {
    const u = resolveImageUrl(m[1] || '');
    if (u) urls.push(u);
  }
  const acParam = /<ac:parameter[^>]+ac:name="url"[^>]*>([^<]+)<\/ac:parameter>/gi;
  while ((m = acParam.exec(html)) !== null) {
    const u = resolveImageUrl((m[1] || '').trim());
    if (u && !urls.includes(u)) urls.push(u);
  }
  const aHref = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = aHref.exec(html)) !== null) {
    const u = resolveImageUrl(m[1] || '');
    if (u && /\.(mp4|webm|mov|ogv|avi)(\?|$)/i.test(u) && !urls.includes(u)) urls.push(u);
  }
  if (urls.length) return urls;
  const plainUrls = parseImageUrls(stripCell(html)).map(resolveImageUrl).filter(Boolean);
  return plainUrls;
}

/** <tr> 한 행에서 셀들 추출 (rowspan/colspan 파싱). 이미지 열에서 URL 추출을 위해 raw HTML 보관 */
function parseRowCells(rowHtml) {
  const cells = [];
  const strip = stripCell;
  const cellRegex = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
  let m;
  while ((m = cellRegex.exec(rowHtml)) !== null) {
    const attrs = (m[1] || '').toLowerCase();
    const rowspan = Math.max(1, parseInt((attrs.match(/rowspan\s*=\s*["']?(\d+)/i) || [])[1], 10) || 1);
    const colspan = Math.max(1, parseInt((attrs.match(/colspan\s*=\s*["']?(\d+)/i) || [])[1], 10) || 1);
    cells.push({ text: strip(m[2]), raw: m[2], rowspan, colspan });
  }
  return cells;
}

/** rowspan/colspan 반영해 2D 그리드로 변환. 셀은 { t, raw } (이미지 열에서 raw로 URL 추출) */
function buildTableGrid(rowsHtml) {
  const rowCells = rowsHtml.map((html) => parseRowCells(html));
  const grid = [];
  const activeRowspans = []; // { col, remaining, value }
  for (let r = 0; r < rowCells.length; r++) {
    const row = rowCells[r];
    grid[r] = [];
    activeRowspans.forEach((s) => {
      grid[r][s.col] = s.value;
      s.remaining--;
    });
    const stillActive = activeRowspans.filter((s) => s.remaining > 0);
    activeRowspans.length = 0;
    activeRowspans.push(...stillActive);
    let col = 0;
    const nextFreeCol = () => {
      while (grid[r][col] !== undefined) col++;
      return col;
    };
    for (const cell of row) {
      col = nextFreeCol();
      grid[r][col] = { t: cell.text, raw: cell.raw };
      if (cell.rowspan > 1) activeRowspans.push({ col, remaining: cell.rowspan - 1, value: { t: cell.text, raw: cell.raw } });
      for (let cc = 1; cc < cell.colspan; cc++) grid[r][col + cc] = { t: cell.text, raw: cell.raw };
      col += cell.colspan;
    }
  }
  return grid;
}

/** 그리드 셀 텍스트 (객체면 .t) */
function cellText(c) {
  return c && typeof c === 'object' && 't' in c ? String(c.t || '').trim() : String(c || '').trim();
}

/** 단락/분류 형태: 본문에서 "N~N주"/"N주"와 항목명이 함께 있는 블록 추출 (테이블 없을 때 폴백) */
function parseAssetsFromParagraphsText(plainText) {
  if (!plainText || typeof plainText !== 'string') return [];
  const sectionMatch = plainText.match(/(?:예상\s*소요|항목|Estimated\s*Lead|분류|Design\s*Asset|단계|세부)[\s\S]*?(?=03\.\s*FAQ|02\.|01\.|FAQ\s|$)/i);
  const section = sectionMatch ? sectionMatch[0] : plainText;
  const seen = new Set();
  const out = [];
  const itemNames = ['OOH / Poster', 'Goods/Package', 'SNS / PR Images', 'KEYART', 'Keyart', '키아트', 'Logo', '로고', 'Brand Guide', '브랜드 가이드', 'YouTube Thumbnail', 'Youtube Thumbnail', 'SNS Images', 'PR Images', 'OOH', 'Poster', '포스터', 'Package', 'Goods', '굿즈', '패키지'];
  const durationRegex = /\b(\d+)\s*~\s*(\d+)\s*주\b|\b(\d+)\s*주\b/g;
  let m;
  while ((m = durationRegex.exec(section)) !== null) {
    const duration = m[0].replace(/\s+/g, '');
    const start = Math.max(0, m.index - 100);
    const block = section.slice(start, m.index + 60);
    let name = '';
    for (const n of itemNames) {
      if (block.indexOf(n) !== -1) {
        name = n;
        break;
      }
    }
    if (!name || seen.has(name + '|' + duration)) continue;
    seen.add(name + '|' + duration);
    const stepsMatch = block.match(/(\d+)\s*단계/);
    const stepsStr = stepsMatch ? stepsMatch[0] : '';
    const details = [];
    const after = section.slice(m.index, m.index + 150).replace(/^\s*[\d~주\s]+/, '').trim();
    if (after) details.push(after.split(/\n/)[0].trim().slice(0, 120));
    out.push({ name, duration, steps: stepsStr, details, images: [] });
  }
  return out;
}

function parseAssetsFromParagraphs(html) {
  if (!html || typeof html !== 'string') return [];
  return parseAssetsFromParagraphsText(htmlToPlainText(html));
}


/** 셀 전체에서 단계 수 추출. 행 구분(줄바꿈) 우선, "R1 - WIP\nR2 - Near Final\n완료 - Delivery" → 3단계 */
function extractStepCountFromCell(str) {
  if (!str || typeof str !== 'string') return '';
  const s = str.trim();
  if (!s) return '';
  const m = s.match(/(\d+)\s*(?:단계|steps?|stages?)/i);
  if (m) return m[0].trim();
  if (/^\d+$/.test(s)) return String(Math.min(parseInt(s, 10), 8));
  // 행 구분 우선: R1 - WIP\nR2 - Near Final\n완료 - Delivery 형식
  const labels = parseStepLabelsFromCell(s);
  if (labels.length >= 2) return s;
  // R1, R-1, R2 등 — 쉼표 구분 폴백
  const rMatch = s.match(/R-?\s*\d+/gi);
  if (rMatch && rMatch.length > 0) return s;
  const parts = s.split(/[\n,;，；]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) return s;
  const hasStepPattern = /R-?\s*\d+|R\d+|FIN|완료|\d+\s*단계/i.test(s);
  const listLines = s.split(/\n/).map((x) => x.trim()).filter((x) => /^[•\-]\s/.test(x) || /^\d+\.\s/.test(x));
  if (listLines.length >= 2 && hasStepPattern) return String(Math.min(listLines.length, 8));
  return '';
}

/** 행 구분(줄바꿈) 기반 단계 라벨 추출. "R1 - WIP\nR2 - Near Final\n완료 - Delivery" → ["R1 - WIP","R2 - Near Final","완료 - Delivery"] */
function parseStepLabelsFromCell(str) {
  if (!str || typeof str !== 'string') return [];
  const lines = str.split(/\n/).map((x) => x.trim()).filter((x) => x.length > 0 && x.length < 120);
  const stepLike = /R\d+|R-?\s*\d+|완료|WIP|Delivery|Near\s*Final|FIN/i;
  const out = lines.filter((line) => stepLike.test(line));
  return out.length >= 2 ? out : [];
}

/** 그리드에서 헤더 행 인덱스 찾기 (어느 셀에든 '예상 소요 기간' 등이 있으면 헤더) */
function findHeaderRowIndex(grid) {
  const headerHint = /예상\s*소요\s*기간|항목|단계|세부\s*유의\s*사항/i;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (headerHint.test(cellText(row[c]))) return r;
    }
  }
  return -1;
}

/** 헤더에서 단계 열을 못 찾았을 때, 데이터 행 내용으로 추정 (R-1, R-2, FIN, 3단계 등). 세부/이미지 열 제외 */
function detectStepsColumnFromContent(grid, headerRowIndex, col) {
  const stepLike = /R-?\s*\d+|FIN|^\d+\s*단계|steps?\s*\d+/i;
  const score = {};
  for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 15, grid.length); r++) {
    const row = grid[r];
    const cells = row.map((c) => cellText(c));
    const name = (cells[col.name] ?? cells[0] ?? '').trim();
    if (!name || /예상\s*소요\s*기간|^단계$|^세부\s*유의\s*사항$/i.test(name)) continue;
    for (let c = 0; c < cells.length; c++) {
      if (c === col.name || c === col.duration || c === col.details || c === col.images) continue;
      const t = (cells[c] || '').trim();
      if (stepLike.test(t) || (t && /R\d+|R-?\d+|FIN|완료|WIP|Delivery/i.test(t) && t.split(/\n/).filter((x) => x.trim()).length >= 2)) {
        score[c] = (score[c] || 0) + 1;
      }
    }
  }
  let best = -1;
  let bestScore = 0;
  for (const [c, n] of Object.entries(score)) {
    if (n > bestScore) { bestScore = n; best = parseInt(c, 10); }
  }
  return best >= 0 ? best : -1;
}

/** 위키 HTML에서 Design Asset 테이블 파싱. 여러 테이블 중 헤더(예상 소요 기간 등) 있는 테이블을 골라 이미지 열 보존 */
function parseRequiredAssetsFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  let best = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableBody = tableMatch[1];
    const rowMatches = tableBody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const rowsHtml = [...rowMatches].map((m) => m[1]);
    const grid = buildTableGrid(rowsHtml);
    const headerRowIndex = findHeaderRowIndex(grid);
    if (headerRowIndex < 0) continue;
    const headerCells = grid[headerRowIndex].map((c) => cellText(c));
    const nextRowCells = (headerRowIndex + 1 < grid.length)
      ? grid[headerRowIndex + 1].map((c) => cellText(c))
      : [];
    const col = getColumnIndices(headerCells, nextRowCells);
    let stepsCol = col.steps;
    if (stepsCol < 0) stepsCol = detectStepsColumnFromContent(grid, headerRowIndex, col);
    const out = [];
    let lastCategory = '';
    for (let i = headerRowIndex + 1; i < grid.length; i++) {
      const row = grid[i];
      const cells = row.map((c) => cellText(c));
      const name = (cells[col.name] ?? cells[0] ?? '').trim();
      if (!name) continue;
      if (/예상\s*소요\s*기간|^단계$|^세부\s*유의\s*사항$/i.test(name)) continue;
      const duration = (cells[col.duration] ?? '').trim();
      let rawSteps = stepsCol >= 0 ? (cells[stepsCol] ?? '').trim() : '';
      let stepsStr = extractStepCountFromCell(rawSteps) || rawSteps.split(/\n/)[0].trim();
      if (!stepsStr && cells.length > 0) {
        for (let c = 0; c < cells.length; c++) {
          if (c === col.name || c === col.duration || c === col.details || (col.images >= 0 && c === col.images) || (stepsCol >= 0 && c === stepsCol)) continue;
          const found = extractStepCountFromCell(cells[c] || '');
          if (found) { stepsStr = found; break; }
        }
      }
      const detailsStr = (cells[col.details] ?? '').trim();
      const details = detailsStr ? detailsStr.split(/[\n;]+/).map((s) => s.replace(/^[\s•\-]+/, '').trim()).filter(Boolean) : [];
      let images = [];
      if (col.images >= 0 && row[col.images] && row[col.images].raw) {
        images = extractImageUrlsFromHtml(row[col.images].raw);
      }
      if (!images.length && cells[col.images]) {
        images = parseImageUrls(cells[col.images]);
      }
      if (!images.length && row.length) {
        const rowHtml = row.map((c) => (c && c.raw) || '').join('');
        images = extractImageUrlsFromHtml(rowHtml);
      }
      let category = col.category >= 0 ? (cells[col.category] ?? '').trim() : '';
      if (col.category >= 0 && !category && lastCategory) category = lastCategory;
      if (category) lastCategory = category;
      const stepLabels = stepsStr ? parseStepLabelsFromCell(stepsStr) : [];
      const item = { name, duration, steps: stepsStr, details, images };
      if (stepLabels.length > 0) item.stepLabels = stepLabels;
      if (category) item.category = category;
      out.push(item);
    }
    const totalImages = out.reduce((s, a) => s + (a.images?.length || 0), 0);
    const bestImages = best.reduce((s, a) => s + (a.images?.length || 0), 0);
    if (out.length > best.length || (out.length >= best.length && totalImages > bestImages)) best = out;
  }
  return best;
}

const stripFaqText = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/** Confluence body.storage에서 expand 매크로로 된 FAQ 추출 (제목=질문, 본문=답변) */
function parseFaqFromStorage(storageHtml) {
  if (!storageHtml || typeof storageHtml !== 'string') return [];
  const out = [];
  const expandRegex = /<ac:structured-macro[^>]+ac:name="expand"[^>]*>([\s\S]*?)<\/ac:structured-macro>/gi;
  let m;
  while ((m = expandRegex.exec(storageHtml)) !== null) {
    const block = m[1];
    const titleMatch = block.match(/<ac:parameter[^>]+ac:name="title"[^>]*>([\s\S]*?)<\/ac:parameter>/i);
    const bodyMatch = block.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/i);
    const q = titleMatch ? stripFaqText(titleMatch[1]) : '';
    const a = bodyMatch ? stripFaqText(bodyMatch[1]) : '';
    if (q) out.push([q, a || '']);
  }
  return out;
}

/** body.view에서 접기/패널 형태로 렌더된 FAQ 추출 (제목=질문, 본문=답변) */
function parseFaqFromViewExpands(html) {
  if (!html || typeof html !== 'string') return [];
  const out = [];
  const strip = stripFaqText;
  const expandBlockRegex = /<div[^>]*class="[^"]*expand[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div|$)/gi;
  const panelRegex = /<div[^>]*class="[^"]*panel[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div|$)/gi;
  const tryBlock = (block) => {
    const titleMatch = block.match(/<span[^>]*class="[^"]*expand-control[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
      || block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
      || block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    const contentMatch = block.match(/<div[^>]*class="[^"]*expand-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || block.match(/<div[^>]*class="[^"]*panelContent[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const q = titleMatch ? strip(titleMatch[1]) : '';
    const a = contentMatch ? strip(contentMatch[1]) : '';
    if (q && q.indexOf('?') !== -1) out.push([q, a || '']);
  };
  let m;
  while ((m = expandBlockRegex.exec(html)) !== null) tryBlock(m[1]);
  if (out.length) return out;
  while ((m = panelRegex.exec(html)) !== null) tryBlock(m[1]);
  return out;
}

/** 03. FAQ 구간에서 단락/제목 기반 질문(?로 끝나는 블록) + 다음 내용을 답으로 추출 (테이블·expand 없을 때 폴백) */
function parseFaqFromParagraphs(html) {
  if (!html || typeof html !== 'string') return [];
  const strip = stripFaqText;
  const faqSection = html.match(/<h[1-3][^>]*>[\s\S]*?03\.\s*FAQ[\s\S]*?<\/h[1-3]>\s*([\s\S]*?)(?=<h[1-3]\s[^>]*>|$)/i)
    || html.match(/(?:03\.\s*FAQ|FAQ)\s*([\s\S]*?)(?=<h[1-3]\s[^>]*>|$)/i);
  if (!faqSection) return [];
  const block = faqSection[1] || '';
  const out = [];
  const questionTagRegex = /<(h[1-6]|p|strong)[^>]*>([\s\S]*?)<\/\1>/gi;
  let prevQ = null;
  let prevQEnd = 0;
  let m;
  while ((m = questionTagRegex.exec(block)) !== null) {
    const qText = strip(m[2]);
    if (qText && /\?\s*$/.test(qText)) {
      if (prevQ) {
        const answerHtml = block.slice(prevQEnd, m.index);
        out.push([prevQ, strip(answerHtml).slice(0, 3000)]);
      }
      prevQ = qText;
      prevQEnd = m.index + m[0].length;
    }
  }
  if (prevQ) {
    const answerHtml = block.slice(prevQEnd);
    out.push([prevQ, strip(answerHtml).slice(0, 3000)]);
  }
  return out;
}

/** 위키 HTML에서 FAQ 테이블 파싱. 헤더에 '질문'/'답변' 있거나, 두 번째 테이블이 2열이면 FAQ로 사용 */
function parseFaqFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = [];
  let m;
  while ((m = tableRegex.exec(html)) !== null) tables.push(m[1]);
  const strip = stripFaqText;
  for (let ti = 0; ti < tables.length; ti++) {
    const tableBody = tables[ti];
    const rowMatches = tableBody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const rows = [...rowMatches].map((r) => r[1]);
    if (rows.length < 1) continue;
    const headerCells = [...rows[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1]));
    if (headerCells.length < 2) continue;
    const headerText = headerCells.join(' ').toLowerCase();
    const hasFaqHeader = /질문|답변|faq|question|answer/i.test(headerText);
    const isSecondTableWithTwoCols = ti >= 1 && headerCells.length === 2 && rows.length >= 1;
    if (!hasFaqHeader && !isSecondTableWithTwoCols) continue;
    const dataStart = hasFaqHeader ? 1 : 0;
    const out = [];
    for (let i = dataStart; i < rows.length; i++) {
      const cells = [...rows[i].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1]));
      const q = (cells[0] || '').trim();
      const a = (cells[1] || '').trim();
      if (q) out.push([q, a || '']);
    }
    if (out.length) return out;
  }
  let faq = parseFaqFromParagraphs(html);
  if (faq.length) return faq;
  return parseFaqFromViewExpands(html);
}

/** Confluence 단일 페이지 조회 (body.view, body.storage) */
async function fetchConfluencePage(pageId) {
  const url = `${CONFLUENCE_BASE}/rest/api/content/${encodeURIComponent(pageId)}?expand=body.view,body.storage`;
  const auth = Buffer.from(`${CONFLUENCE_EMAIL}:${CONFLUENCE_TOKEN}`).toString('base64');
  const res = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Basic ${auth}` } });
  if (!res.ok) {
    const errText = await res.text();
    let errMsg = errText.slice(0, 200);
    try { const j = JSON.parse(errText); errMsg = j.message || j.error || errMsg; } catch (_) {}
    console.error('[Confluence 위키]', pageId, res.status, errMsg);
    return { html: '', storageHtml: '' };
  }
  let data;
  try { data = await res.json(); } catch (e) { return { html: '', storageHtml: '' }; }
  let html = data?.body?.view?.value || '';
  let storageHtml = data?.body?.storage?.value || '';
  if (!storageHtml) {
    try {
      const r2 = await fetch(`${CONFLUENCE_BASE}/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage`, { headers: { Accept: 'application/json', Authorization: `Basic ${auth}` } });
      if (r2.ok) { const d2 = await r2.json(); storageHtml = d2?.body?.storage?.value || ''; }
    } catch (_) {}
  }
  return { html, storageHtml };
}

/** 한 페이지 HTML에서 content + assets 파싱. partId === 'design'이면 Design 표준 이름으로 정규화 */
async function parsePartPage(html, storageHtml, partId) {
  const text = htmlToPlainText(html);
  let rawAssets = parseRequiredAssetsFromHtml(html);
  if (rawAssets.length === 0) rawAssets = parseAssetsFromParagraphs(html);
  let assets = [];
  if (rawAssets.length > 0) {
    if (partId === 'design') {
      const normalized = await normalizeAssetNamesWithAI(rawAssets.map((a) => a.name));
      if (normalized && normalized.length === rawAssets.length) {
        for (let i = 0; i < rawAssets.length; i++) {
          if (isAllowedAssetName(normalized[i]))
            assets.push({ name: normalized[i], duration: rawAssets[i].duration, steps: rawAssets[i].steps || '', details: rawAssets[i].details, images: rawAssets[i].images || [] });
        }
      } else {
        assets = rawAssets.filter((a) => isAllowedAssetName(a.name)).map((a) => ({ ...a, steps: a.steps || '', images: a.images || [] }));
      }
    } else {
      assets = rawAssets.map((a) => ({ ...a, steps: a.steps || '', images: a.images || [] }));
    }
  }
  return { content: text, assets };
}

async function fetchWikiContent() {
  if (!CONFLUENCE_EMAIL || !CONFLUENCE_TOKEN) return '';
  const now = Date.now();
  if (wikiCache.ts && now - wikiCache.ts < WIKI_CACHE_TTL_MS && Object.keys(wikiCache.parts || {}).length > 0) {
    return (wikiCache.parts.design && wikiCache.parts.design.content) || '';
  }
  const next = { parts: {}, faq: [], ts: now };
  try {
    for (const [partId, pageId] of Object.entries(CONFLUENCE_PARTS)) {
      const { html, storageHtml } = await fetchConfluencePage(pageId);
      if (!html && !storageHtml) continue;
      next.parts[partId] = await parsePartPage(html, storageHtml, partId);
      if (next.parts[partId].assets.length > 0) {
        console.log('[Confluence 위키]', partId, '어셋', next.parts[partId].assets.length, '건');
      }
    }
    const { html: faqHtml, storageHtml: faqStorage } = await fetchConfluencePage(CONFLUENCE_FAQ_PAGE_ID);
    let faq = parseFaqFromStorage(faqStorage);
    if (!faq.length) faq = parseFaqFromHtml(faqHtml);
    if (!faq.length) faq = parseFaqFromParagraphs(faqHtml);
    next.faq = Array.isArray(faq) ? faq : [];
    if (next.faq.length > 0) console.log('[Confluence 위키] FAQ', next.faq.length, '건');
    wikiCache = next;
    return (wikiCache.parts.design && wikiCache.parts.design.content) || '';
  } catch (e) {
    console.error('[Confluence 위키 조회 오류]', e.message || e);
    return (wikiCache.parts && wikiCache.parts.design && wikiCache.parts.design.content) || '';
  }
}

function getWikiAssets(partId = 'design') {
  const part = wikiCache.parts && wikiCache.parts[partId];
  return Array.isArray(part && part.assets) ? part.assets : [];
}

function getWikiContent(partId = 'design') {
  const part = wikiCache.parts && wikiCache.parts[partId];
  return (part && part.content) || '';
}

function getFaq() {
  return Array.isArray(wikiCache.faq) ? wikiCache.faq : [];
}

function getPartIds() {
  return Object.keys(CONFLUENCE_PARTS);
}

export { getPartIds, fetchWikiContent, getWikiContent, getFaq, getWikiAssets };
