'use strict';
/* Turns text files into flashcards: [{q, a, kind}] */

function parseCSV(text, delim) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  row.push(cur); rows.push(row);
  return rows;
}

function cleanCell(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

function rowsToCards(rows) {
  rows = rows.map(r => r.map(cleanCell)).filter(r => r.length >= 2 && r[0] && r[1]);
  if (rows.length && /^(question|term|front|q|word|prompt)s?$/i.test(rows[0][0])) rows.shift();
  return rows.map(r => ({ q: r[0], a: r[1], kind: 'qa' }));
}

function parseJSONDeck(text) {
  const data = JSON.parse(text);
  const out = [];
  const pick = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return cleanCell(o[k]); return ''; };
  if (Array.isArray(data)) {
    for (const o of data) {
      if (Array.isArray(o)) { if (o[0] && o[1]) out.push({ q: cleanCell(o[0]), a: cleanCell(o[1]), kind: 'qa' }); }
      else if (o && typeof o === 'object') {
        const q = pick(o, ['q', 'question', 'front', 'term', 'prompt']);
        const a = pick(o, ['a', 'answer', 'back', 'definition', 'def']);
        if (q && a) out.push({ q, a, kind: 'qa' });
      }
    }
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) if (typeof v !== 'object') out.push({ q: cleanCell(k), a: cleanCell(v), kind: 'qa' });
  }
  return out;
}

const TABLE_HEADER = /^(?:key\s+)?(?:terms?|words?|names?|concepts?|items?|keywords?|vocabulary|abbreviations?|acronyms?|phrases?|topics?)$/i;
function parseText(text, info) {
  const lines = text.replace(/\r/g, '').split('\n')
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/^#+\s*/, '').replace(/\*\*|__/g, '').trim())
    .filter(Boolean);
  const cards = [];
  const loose = [];
  let pendingQ = null, m;
  let tableHeader = null;
  for (let l of lines) {
    if (l.includes('\t')) {
      const cells = l.split(/\t+/).map(x => x.trim()).filter(Boolean);
      if (cells.length >= 2) {
        if (TABLE_HEADER.test(cells[0]) && cells.every(c => c.split(/\s+/).length <= 4 && !/[.!?]$/.test(c))) { tableHeader = cells; continue; } // header row
        const term = cells[0], def = cells[1];
        if (/\p{L}{2,}/u.test(def) && /\p{L}/u.test(term) && term.split(/\s+/).length <= 10 && !/\.{3,}/.test(l)) {
          cards.push({ q: term, a: def, kind: 'def' });
          for (let k = 2; k < cells.length; k++) {
            const hd = tableHeader && tableHeader[k];
            if (hd && /\p{L}/u.test(cells[k])) cards.push({ q: `What is the ${hd.toLowerCase()} for “${term}”?`, a: cells[k], kind: 'qa' });
          }
          continue;
        }
      }
      l = cells.join(' ');
    }
    if ((m = l.match(/^(?:q|question)\s*[:.)\-]\s*(.+)$/i))) { pendingQ = m[1]; continue; }
    if (pendingQ && (m = l.match(/^(?:a|answer)\s*[:.)\-]\s*(.+)$/i))) { cards.push({ q: pendingQ, a: m[1], kind: 'qa' }); pendingQ = null; continue; }
    if ((m = l.match(/^(.{1,80}?)(?:\s*::\s*|\t+|\s+[-–—]\s+|\s*:\s+|\s+=\s+)(.+)$/)) && m[1].trim().split(/\s+/).length <= 7 && !/[.!?]$/.test(m[1].trim()) && !/^(?:chapter|section|note|notes|figure|fig|table|example|page|unit|lesson|topic|summary|objectives?|contents|week|part)\b/i.test(m[1].trim()) && !isHeadingLike(m[1] + m[2])) { cards.push({ q: m[1].trim(), a: m[2].trim(), kind: 'def' }); continue; }
    loose.push(l);
  }
  if (info) info.loose = loose.slice();
  // Plain sentences -> fill in the blank
  for (const chunk of loose) {
    for (const sent of chunk.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)) {
      const c = makeCloze(sent.trim());
      if (c) cards.push(c);
    }
  }
  return cards;
}

/* ---------- PDF support (uses the bundled pdf.js in /vendor) ---------- */
let pdfLibPromise = null;
const PDF_SOURCES = [
  { lib: 'pdfjs-lib.js?v=6', worker: 'pdfjs-worker.js?v=6' },               // bundled, next to index.html (no folder needed)
  { lib: 'vendor/pdf.js?v=6', worker: 'vendor/pdf.worker.js?v=6' },          // bundled, in vendor/ folder
  { lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' },
  { lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js' }
];
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('failed: ' + src)); };
    document.head.appendChild(s);
  });
}
function loadPdfLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfLibPromise) {
    pdfLibPromise = (async () => {
      for (const src of PDF_SOURCES) {
        try {
          await loadScript(src.lib);
          if (!window.pdfjsLib) continue;
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = src.worker;
          return window.pdfjsLib;
        } catch (e) { /* try the next source */ }
      }
      pdfLibPromise = null;
      throw new Error('Could not load the PDF reader. Make sure pdfjs-lib.js and pdfjs-worker.js are uploaded next to index.html (same folder), or check your internet connection.');
    })();
  }
  return pdfLibPromise;
}

/* Turn one PDF page's text items into lines. Columns are found by x position, so a table row
   becomes "cell<TAB>cell<TAB>cell" and a cell that wraps onto several lines is put back together. */
function pdfPageToLines(items, rules) {
  const hr = (rules && rules.h) || [], vr = (rules && rules.v) || [];
  const its = [];
  for (const it of items) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    const t = it.transform, h = Math.abs(t[3]) || it.height || 10;
    its.push({ s: it.str, x: t[4], y: t[5], w: it.width || it.str.length * h * 0.5, h });
  }
  its.sort((p, q) => q.y - p.y || p.x - q.x);
  const lines = [];
  for (const it of its) {
    const L = lines[lines.length - 1];
    if (L && Math.abs(L.y - it.y) <= Math.max(2, Math.min(L.h, it.h) * 0.45)) { L.items.push(it); L.h = Math.max(L.h, it.h); }
    else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  // split each line into cells wherever there is a wide horizontal gap (or a table border)
  const cellsOf = (L, forced) => {
    L.items.sort((p, q) => p.x - q.x);
    const cells = []; let cur = null, end = null;
    const colGap = Math.max(L.h * 0.9, 8);
    for (const it of L.items) {
      const gap = end === null ? 0 : it.x - end;
      // a table border between two pieces of text always separates cells, however small the gap
      const border = cur && end !== null && vr.some(v => v.x >= end - 1.5 && v.x <= it.x + 1.5 && v.y1 - 1.5 <= L.y && L.y <= v.y2 + 1.5);
      // text that starts exactly where a column starts on this page is a new cell, even if the gap is small (a cell filled right up to its edge)
      const colStart = cur && gap > 0.6 && forced.some(x => Math.abs(x - it.x) <= 1.5);
      if (cur && gap <= colGap && !border && !colStart) cur.t += (gap > L.h * 0.12 && !/\s$/.test(cur.t) && !/^\s/.test(it.s) ? ' ' : '') + it.s;
      else { cur = { t: it.s, x: it.x }; cells.push(cur); }
      end = Math.max(end === null ? -1e9 : end, it.x + it.w);
    }
    cells.forEach(c => { c.t = c.t.replace(/\s+/g, ' ').trim(); });
    const res = cells.filter(c => c.t);
    // a bullet or number sitting alone in its own column belongs to the text next to it
    if (res.length >= 2 && /^(?:[•▪●◦·\-–—*]|\d{1,2}[.)])$/.test(res[0].t)) { res[1].t = res[0].t + ' ' + res[1].t; res[1].x = res[0].x; res.shift(); }
    return res;
  };
  lines.forEach(L => { L.cells = cellsOf(L, []); });
  {
    // columns: x positions where a cell starts after a clear gap on at least 3 lines of the page
    const starts = [];
    lines.forEach(L => L.cells.slice(1).forEach(c => starts.push(c.x)));
    starts.sort((p, q) => p - q);
    const groups = []; starts.forEach(x => { const g = groups[groups.length - 1]; if (g && x - g.sum / g.n <= 1.5) { g.sum += x; g.n++; } else groups.push({ sum: x, n: 1 }); });
    const forced = groups.filter(g => g.n >= 3).map(g => g.sum / g.n);
    if (forced.length) lines.forEach(L => { L.cells = cellsOf(L, forced); });
  }
  const out = [];
  let table = null, prev = null, lastPlainY = null;
  const tol = L => Math.max(L.h * 0.8, 7);
  /* the vertical borders (if the table has them) that cross this line, left to right */
  const edgesFor = L => {
    const xs = vr.filter(v => v.y1 - 1.5 <= L.y && L.y <= v.y2 + 1.5).map(v => v.x).sort((a, b) => a - b);
    const e = []; xs.forEach(x => { if (!e.length || x - e[e.length - 1] > 2) e.push(x); });
    return e;
  };
  /* is there a horizontal border between the previous line and this one? */
  const ruleBetween = (p, L) => !!p && hr.some(r => r.y < p.y - 0.1 * L.h && r.y > L.y + 0.45 * L.h && r.x1 <= L.cells[L.cells.length - 1].x + 5 && r.x2 >= L.cells[0].x - 5);
  const colOf = (tb, x, L) => {
    if (tb.edges) { for (let i = 0; i < tb.edges.length - 1; i++) if (x >= tb.edges[i] - 1.5 && x < tb.edges[i + 1] - 0.5) return i; return -1; }
    let bi = -1, bd = 1e9; tb.cols.forEach((cx, i) => { const d = Math.abs(cx - x); if (d < bd) { bd = d; bi = i; } }); return bd <= tol(L) ? bi : -1;
  };
  const join = (a, b) => !a ? b : /[a-z]-$/.test(a) && /^[a-z]/.test(b) ? a.slice(0, -1) + b : a + ' ' + b;
  const words = t => (t || '').split(/\s+/).filter(Boolean).length;
  /* add a line of text to a cell. In the last column of a 3+ column table, short capitalised lines are a list of examples */
  const joinCell = (tb, a, b, k) => {
    if (k >= 2 && k === tb.cols.length - 1 && a && /^\p{Lu}/u.test(b) && words(a) <= 5 && words(b) <= 5 && !/[.!?,;:]$/.test(a) && !/\b(?:of|and|or|the|a|an|to|in|for|with|by|as|on|at)$/i.test(a)) return a + ', ' + b;
    return join(a, b);
  };
  const flush = () => {
    if (!table) return;
    const rows = table.rows.filter(r => r.some(Boolean));
    const wordsIn = c => (c || '').split(/\s+/).filter(Boolean).length;
    if (rows.length >= 4 && rows.filter(r => wordsIn(r[0]) > 9).length / rows.length > 0.7) {
      // long text in every column = newspaper-style columns of prose, not a table: read down each column in turn
      out.push(''); table.cols.forEach((_, k) => { rows.forEach(r => { if (r[k]) out.push(r[k]); }); out.push(''); });
    } else if (rows.length >= 2) { out.push(''); rows.forEach(r => out.push(r.map(c => c.replace(/\s+/g, ' ').trim()).join('\t'))); out.push(''); }
    else rows.forEach(r => out.push(r.filter(Boolean).join(' ')));
    table = null; lastPlainY = null;
  };
  const newRow = (tb, cells, L) => { const row = tb.cols.map(() => ''); for (const c of cells) { const k = colOf(tb, c.x, L); if (k < 0) return null; row[k] = c.t; } return row; };
  for (const L of lines) {
    const cells = L.cells; if (!cells.length) continue;
    if (cells.length >= 2) {
      if (table) {
        const idx = cells.map(c => colOf(table, c.x, L));
        if (idx.every(i => i >= 0) && new Set(idx).size === idx.length) {
          // Is this line the next row, or just the next line of cells that wrapped in the row above?
          const last = table.rows[table.rows.length - 1];
          const k0 = idx.indexOf(0);
          let cont;
          if (table.ruled) cont = !ruleBetween(prev, L);       // the table has borders: a border line starts a new row
          else {
            cont = k0 < 0;                                      // nothing in the first column: rest of the row above
            if (!cont && prev && (prev.y - L.y) <= L.h * 1.6 && /(?:\b(?:of|and|the|for|in|to|a|an|on|vs\.?)|[,&\/-])$/i.test(last[0] || '')) cont = true; // "Internet of" + "Things (IoT)"
            else if (!cont && /^\p{Ll}/u.test(cells[k0].t) && prev && (prev.y - L.y) <= L.h * 1.7) {
              cont = last.slice(1).some(t => t && !/[.!?:;)"”]$/.test(t)) || last.slice(1).some(t => /[,;]$|\b(?:the|a|an|of|to|and|or|that|is|in|for|with|by|as|on|at|from|which|are)$/i.test(t || ''));
            }
          }
          if (cont) { cells.forEach((c, k) => { last[idx[k]] = joinCell(table, last[idx[k]], c.t, idx[k]); }); prev = L; continue; }
          const row = table.cols.map(() => ''); cells.forEach((c, k) => { row[idx[k]] = c.t; });
          table.rows.push(row); prev = L; continue;
        }
        flush();
      }
      // start a new table; if it has borders around it, use them for the columns and rows
      const spans = r => r.x1 <= cells[0].x + 5 && r.x2 >= cells[cells.length - 1].x - 5;
      const top = hr.some(r => spans(r) && ((r.y > L.y + 0.45 * L.h && r.y < L.y + L.h * 3) || (r.y < L.y + 0.3 * L.h && r.y > L.y - L.h * 1.6)));
      const edges = top ? edgesFor(L) : [];
      table = { cols: cells.map(c => c.x), rows: null, ruled: top, edges: top && edges.length >= 3 ? edges : null };
      if (table.edges) table.cols = table.edges.slice(0, -1);
      const first = table.edges ? newRow(table, cells, L) : cells.map(c => c.t);
      if (!first) { table.edges = null; table.cols = cells.map(c => c.x); table.rows = [cells.map(c => c.t)]; } else table.rows = [first];
      prev = L; continue;
    }
    const c = cells[0];
    if (table) {
      let handled = false;
      if (table.edges) {
        if (edgesFor(L).length >= 3) {                          // still inside the bordered table
          const k = colOf(table, c.x, L);
          if (k >= 0) {
            if (ruleBetween(prev, L)) { const row = table.cols.map(() => ''); row[k] = c.t; table.rows.push(row); }
            else { const row = table.rows[table.rows.length - 1]; row[k] = joinCell(table, row[k], c.t, k); }
            prev = L; handled = true;
          }
        }
      } else {
        const k = colOf(table, c.x, L), tight = prev && (prev.y - L.y) <= L.h * 1.6;
        if (k >= 0 && !(table.ruled && ruleBetween(prev, L)) && (k > 0 || tight)) { const row = table.rows[table.rows.length - 1]; row[k] = joinCell(table, row[k], c.t, k); prev = L; handled = true; }
      }
      if (handled) continue;
      flush();
    }
    if (lastPlainY !== null && lastPlainY - L.y > L.h * 1.8) out.push('');
    out.push(c.t); lastPlainY = L.y; prev = L;
  }
  flush();
  return out;
}

/* Read the lines drawn on a PDF page (table borders). Returns { h: [{y,x1,x2}], v: [{x,y1,y2}] } */
async function pdfPageRules(page, lib) {
  const OPS = lib.OPS, list = await page.getOperatorList();
  const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3], A[4] * B[0] + A[5] * B[2] + B[4], A[4] * B[1] + A[5] * B[3] + B[5]];
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [], H = [], V = [];
  let pend = [];
  const pt = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const addH = (y, a, b) => { if (Math.abs(b - a) >= 6) H.push({ y, x1: Math.min(a, b), x2: Math.max(a, b) }); };
  const addV = (x, a, b) => { if (Math.abs(b - a) >= 6) V.push({ x, y1: Math.min(a, b), y2: Math.max(a, b) }); };
  const commit = (stroke) => {
    for (const s of pend) {
      if (s.rect) {
        const [p, q] = s.rect, x1 = Math.min(p[0], q[0]), x2 = Math.max(p[0], q[0]), y1 = Math.min(p[1], q[1]), y2 = Math.max(p[1], q[1]);
        const w = x2 - x1, h = y2 - y1;
        if (stroke) { addH(y1, x1, x2); addH(y2, x1, x2); addV(x1, y1, y2); addV(x2, y1, y2); }
        else if (h <= 2.5 && w >= 6) addH((y1 + y2) / 2, x1, x2);
        else if (w <= 2.5 && h >= 6) addV((x1 + x2) / 2, y1, y2);
      } else if (stroke) {
        const [a, b] = [s.a, s.b];
        if (Math.abs(a[1] - b[1]) < 0.6) addH((a[1] + b[1]) / 2, a[0], b[0]);
        else if (Math.abs(a[0] - b[0]) < 0.6) addV((a[0] + b[0]) / 2, a[1], b[1]);
      }
    }
    pend = [];
  };
  const STROKE = new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const FILL = new Set([OPS.fill, OPS.eoFill]);
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i], args = list.argsArray[i];
    if (fn === OPS.save || fn === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (fn === OPS.paintFormXObjectBegin && args && args[0]) ctm = mul(args[0], ctm); }
    else if (fn === OPS.restore || fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
    else if (fn === OPS.transform) ctm = mul(args, ctm);
    else if (fn === OPS.constructPath) {
      const ops = args[0], co = args[1]; let ci = 0, cx = 0, cy = 0;
      for (const op of ops) {
        if (op === OPS.moveTo) { cx = co[ci++]; cy = co[ci++]; }
        else if (op === OPS.lineTo) { const x = co[ci++], y = co[ci++]; pend.push({ a: pt(cx, cy), b: pt(x, y) }); cx = x; cy = y; }
        else if (op === OPS.curveTo) ci += 6;
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) ci += 4;
        else if (op === OPS.rectangle) { const x = co[ci++], y = co[ci++], w = co[ci++], h = co[ci++]; pend.push({ rect: [pt(x, y), pt(x + w, y + h)] }); }
      }
    }
    else if (STROKE.has(fn)) commit(true);
    else if (FILL.has(fn)) commit(false);
    else if (fn === OPS.endPath) pend = [];
  }
  return { h: H, v: V };
}

async function extractPdfText(file, onProgress) {
  const lib = await loadPdfLib();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({ data }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (onProgress) onProgress(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let rules = null;
    try { rules = await pdfPageRules(page, lib); } catch (e) { rules = null; }
    out.push(...pdfPageToLines(content.items, rules));
    out.push('');
  }
  return out.join('\n');
}

/* PDF text comes out one visual line at a time; glue wrapped lines back into paragraphs */
function reflowPdfText(text) {
  const lines = text.replace(/\r/g, '').replace(/-\n(?=[a-z])/g, '').split('\n').map(l => l.includes('\t') ? l.split('\t').map(c => c.replace(/\s+/g, ' ').trim()).join('\t') : l.replace(/\s+/g, ' ').trim());
  const out = []; let buf = '';
  const flush = () => { if (buf) out.push(buf); buf = ''; };
  const startsNew = l => /^(?:[-*•]|\d+[.)])\s/.test(l) || /^(?:q|a|question|answer)\s*[:.)\-]/i.test(l) || /^(.{1,80}?)(?:\s*::\s*|\s+[-–—]\s+|\s*:\s+)/.test(l);
  for (const l of lines) {
    if (!l || /^\d{1,4}$/.test(l)) { flush(); continue; } // blank lines / page numbers
    if (l.includes('\t')) { flush(); out.push(l); continue; } // table rows stay as they are
    if (buf && !/[.!?:]$/.test(buf) && !/^(?:a|answer)\s*[:.)\-]/i.test(buf) && !startsNew(l)) buf += ' ' + l;
    else { flush(); buf = l; }
  }
  flush();
  return out.join('\n');
}


/* ---------- smarter fill-in-the-blank ---------- */
const STOPWORDS = new Set(('about above after again against also although always another because been before being below between both cannot could does doing down during each either else even every from further have having here however into itself just keep like made make many might more most much must never other over same should since some such than that their theirs them then there these they this those through under until upon very want were what when where which while whose will with within without would your yours often usually generally called known using used uses use includes include including example examples figure table chapter section page').split(' '));
const CUE_BEFORE = /^(?:called|known|termed|named|define[sd]?|means?|is|are|was|were|as)$/i;
function isHeadingLike(s) {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length > 6 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) return true; // ALL CAPS
  return false;
}
function makeCloze(sent) {
  sent = sent.replace(/\s+/g, ' ').trim();
  const words = sent.split(' ');
  if (words.length < 6 || words.length > 34) return null;
  if (!/^[A-Z0-9“"(]/.test(sent)) return null;                  // starts mid-sentence (PDF fragment)
  if (!/[.!?)"”]$/.test(sent) && words.length < 9) return null; // heading-like
  if (isHeadingLike(sent) || /^(?:note|figure|fig|table|example)s?\b\s*[:.\d]/i.test(sent) || /https?:|www\.|@/.test(sent)) return null;
  if ((sent.match(/\d/g) || []).length > words.length * 1.5) return null; // number tables
  let best = null;
  words.forEach((w, i) => {
    const clean = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const acr = i > 0 && /^[A-Z][A-Z0-9]{1,6}$/.test(clean);   // acronyms: LAN, CPU, DNA
    if (!acr && (clean.length < 4 || STOPWORDS.has(clean.toLowerCase()))) return;
    const lower = clean.toLowerCase();
    let score = Math.min(clean.length, 12) * 0.3 + (acr ? 6 : 0);
    if (/^[A-Z]/.test(clean) && i > 0) score += 6;                                    // names, proper terms
    if (/\d/.test(clean)) score += 5;                                                  // years, quantities
    if (i > 0 && CUE_BEFORE.test(words[i - 1].replace(/[^A-Za-z]/g, ''))) score += 3; // "is called X"
    if (/(?:tion|sion|sis|ism|ity|ology|ase|ide|ment|ance|ence|ure)s?$/.test(lower)) score += 3; // typical terms
    if (/(?:ing|ly|ed)$/.test(lower)) score -= 2;                                      // verbs and adverbs make poor answers
    if (i <= 2 && /^(?:is|are|refers|means)$/i.test((words[i + 1] || '').replace(/[^A-Za-z]/g, ''))) score += 5; // the thing being defined
    if (!best || score > best.score) best = { i, score };
  });
  if (!best || best.score < 2.5) return null;
  // keep capitalised phrases together ("Eldorian Empire")
  let a = best.i, b = best.i;
  const cap = k => k > 0 && k < words.length && /^[A-Z]/.test(words[k]) && !STOPWORDS.has(words[k].toLowerCase().replace(/[^a-z]/g, ''));
  if (cap(best.i)) { while (cap(a - 1) && !/[.,;:]$/.test(words[a - 1])) a--; while (cap(b + 1) && !/[.,;:]$/.test(words[b])) b++; }
  const strip = w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const answer = words.slice(a, b + 1).map(strip).join(' ');
  const lead = words[a].match(/^[^\p{L}\p{N}]*/u)[0], trail = words[b].match(/[^\p{L}\p{N}]*$/u)[0];
  const q = [...words.slice(0, a), lead + '_____' + trail, ...words.slice(b + 1)].join(' ');
  return { q, a: answer, kind: 'cloze' };
}

/* Short label-like text ("Mitochondria", "Capital of France") */
function termLike(s) { return !/[?]/.test(s) && s.trim().split(/\s+/).length <= 4 && s.length <= 40; }
/* Make sure every card has a kind that tells the game how to word the question */
function normaliseCard(c) {
  if (c.kind === 'qa' && termLike(c.q) && c.a.trim().split(/\s+/).length >= 4 && !/^(?:what|which|who|when|where|why|how)\b/i.test(c.q)) return { ...c, kind: 'def' };
  return c;
}

function parseDeck(text, filename, info) {
  const ext = ((filename || '').split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') text = reflowPdfText(text);
  let cards = [];
  try {
    if (ext === 'json') cards = parseJSONDeck(text);
    else if (ext === 'csv') cards = rowsToCards(parseCSV(text, ','));
    else if (ext === 'tsv') cards = rowsToCards(parseCSV(text, '\t'));
  } catch (e) { cards = []; }
  if (!cards.length) cards = parseText(text, info);
  cards = cards.map(normaliseCard);
  const seen = new Set();
  return cards.filter(c => {
    const k = c.q.toLowerCase() + '|' + c.a.toLowerCase();
    if (!c.q || !c.a || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/* ---------- where did a card come from? ---------- */
/* Find `needle` in `src`, ignoring differences in spaces/line breaks and capitals. Returns [start, end] or null. */
function findLoose(src, needle, from) {
  needle = String(needle || '').trim();
  if (needle.length < 3) return null;
  const pat = needle.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  let re;
  try { re = new RegExp(pat, 'gi'); } catch (e) { return null; }
  re.lastIndex = from || 0;
  const m = re.exec(src);
  return m ? [m.index, m.index + m[0].length] : null;
}
function expandLine(src, s, e) {
  const ls = s > 0 ? src.lastIndexOf('\n', s - 1) + 1 : 0;
  let le = src.indexOf('\n', e); if (le < 0) le = src.length;
  return [ls, le];
}
/* Best guess at the part of the original text a card was made from: [start, end] or null */
function locateCard(src, card) {
  if (!src || !card) return null;
  let r;
  if (card.kind === 'cloze') {
    r = findLoose(src, card.q.replace('_____', card.a));
    if (r) return r;
    const [l, rt] = card.q.split('_____');
    r = findLoose(src, (l || '').slice(-50)) || findLoose(src, (rt || '').slice(0, 50));
    return r ? expandLine(src, r[0], r[1]) : null;
  }
  if (card.kind === 'def') {
    r = findLoose(src, card.a.slice(0, 80)) || findLoose(src, card.q);
    return r ? expandLine(src, r[0], r[1]) : null;
  }
  r = findLoose(src, card.q);
  if (r) {
    const a = findLoose(src, card.a.slice(0, 80), r[0]);
    const end = a && a[0] - r[1] < 500 ? Math.max(r[1], a[1]) : r[1];
    return expandLine(src, r[0], end);
  }
  r = findLoose(src, card.a.slice(0, 80));
  return r ? expandLine(src, r[0], r[1]) : null;
}
/* For AI-made questions: the sentence (inside `chunkText`) that holds the answer, found in the source */
function locateSentence(src, chunkText, answer, question) {
  const ans = String(answer).replace(/\s+/g, ' ').trim().toLowerCase();
  const qw = new Set(String(question).toLowerCase().split(/\W+/).filter(w => w.length > 3));
  let best = null, bs = -1;
  for (const sent of chunkText.split(/(?<=[.!?])\s+/)) {
    if (!sent.toLowerCase().replace(/\s+/g, ' ').includes(ans)) continue;
    const sc = sent.toLowerCase().split(/\W+/).filter(w => qw.has(w)).length;
    if (sc > bs) { bs = sc; best = sent; }
  }
  if (!best) return null;
  return findLoose(src, best) || findLoose(src, best.slice(0, 60)) || findLoose(src, best.slice(-60));
}

/* Parse a file's text AND keep the original text so cards can point back to where they came from */
function parseWithSource(text, filename) {
  const ext = ((filename || '').split('.').pop() || '').toLowerCase();
  const source = ext === 'pdf' ? reflowPdfText(text) : text;
  const info = {};
  const cards = parseDeck(source, ext === 'pdf' ? 'file.txt' : filename, info);
  cards.forEach(c => { const r = locateCard(source, c); if (r) c.src = r; });
  return { source, cards, loose: info.loose || [] };
}
if (typeof module !== 'undefined') module.exports = { parseWithSource, locateCard, locateSentence, findLoose, makeCloze, parseDeck };
