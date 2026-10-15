'use strict';
/* "Tidy with AI": a small language model that runs INSIDE the browser (WebLLM + WebGPU).
   It looks at each card once, and says: ok / fix (rewrite so it makes sense) / drop (junk).
   Nothing is sent to a server. The model files are downloaded once and cached by the browser. */

const AI_WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm';
const AI_MODELS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Better (about 1 GB download)', match: /Qwen2\.5-1\.5B-Instruct/ },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Faster (about 0.4 GB download)', match: /Qwen2\.5-0\.5B-Instruct/ }
];

const AI_SYSTEM = `You check flashcards for a school study game. Some cards were made automatically from notes and do not make sense.
For each card reply with ONE JSON object: {"verdict":"ok"|"fix"|"drop","question":"...","answer":"..."}
- "ok": the card is already clear and makes sense on its own. Leave question and answer empty.
- "fix": the card is vague, cut off or awkward, but the notes contain a real fact. Write ONE clear question that makes sense without seeing the notes, and a short answer. Use ONLY words and facts that are in the card. Never invent facts.
- "drop": the card is a heading, a page fragment, a list of numbers, a name or label with no fact, or meaningless.
The question must not contain the answer.`;

const AI_SHOTS = [
  ['Sentence with a blank: The _____ contains most of the cell\'s genetic material.\nMissing word: nucleus',
   '{"verdict":"ok","question":"","answer":""}'],
  ['Sentence with a blank: It was _____ that first described the process in 1859.\nMissing word: Darwin',
   '{"verdict":"fix","question":"Who first described the process in 1859?","answer":"Darwin"}'],
  ['Sentence with a blank: Figure 3 shows the _____ of the results\nMissing word: summary',
   '{"verdict":"drop","question":"","answer":""}']
];

/* Describe a card to the model in plain words */
function aiDescribe(c) {
  if (c.kind === 'def') return `Term: ${c.q}\nMeaning: ${c.a}`;
  if (c.kind === 'cloze') return `Sentence with a blank: ${c.q}\nMissing word: ${c.a}`;
  return `Question: ${c.q}\nAnswer: ${c.a}`;
}

const aiNorm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/* Pull the first {...} out of whatever the model said */
function aiParseReply(txt) {
  const m = String(txt || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const v = String(o.verdict || '').toLowerCase();
    if (!['ok', 'fix', 'drop'].includes(v)) return null;
    return { verdict: v, question: String(o.question || '').replace(/\s+/g, ' ').trim(), answer: String(o.answer || '').replace(/\s+/g, ' ').trim() };
  } catch { return null; }
}

/* Safety net for a small model: only accept a rewrite that is grounded in the original card.
   Returns a new card, or null to keep the original. */
function aiAcceptFix(card, r) {
  if (!r.question || !r.answer) return null;
  if (r.question.length < 10 || r.question.length > 220 || r.answer.length > 140) return null;
  const src = aiNorm(card.q + ' ' + card.a);
  const ans = aiNorm(r.answer), q = aiNorm(r.question);
  if (!ans || !src.includes(ans)) return null;               // answer must come from the card
  if (ans.length >= 3 && q.includes(ans)) return null;       // question must not give the answer away
  const known = new Set(src.split(' '));
  const qw = q.split(' ').filter(w => w.length > 4);
  const fresh = qw.filter(w => !known.has(w) && !known.has(w.replace(/s$/, '')));
  if (qw.length && fresh.length / qw.length > 0.7 && fresh.length > 4) return null; // mostly invented words
  if (!/[?]$/.test(r.question)) r.question += '?';
  return { q: r.question, a: r.answer, kind: 'qa' };
}

const AI = {
  engine: null, modelId: null, loading: null,
  supported() { return typeof navigator !== 'undefined' && !!navigator.gpu; },

  async load(choice, onProgress) {
    const spec = AI_MODELS[choice] || AI_MODELS[0];
    if (this.engine && this.modelId === spec.id) return this.engine;
    const webllm = await import(AI_WEBLLM_URL);
    // use the exact id if this WebLLM version knows it, otherwise the closest match
    const list = (webllm.prebuiltAppConfig && webllm.prebuiltAppConfig.model_list) || [];
    const found = list.find(m => m.model_id === spec.id) || list.find(m => spec.match.test(m.model_id) && /q4f16_1/.test(m.model_id)) || list.find(m => spec.match.test(m.model_id));
    if (!found) throw new Error('This AI model is not available in the loaded WebLLM version.');
    this.engine = await webllm.CreateMLCEngine(found.model_id, { initProgressCallback: p => onProgress && onProgress(p) });
    this.modelId = spec.id;
    return this.engine;
  },

  async judge(engine, deckName, card) {
    const messages = [{ role: 'system', content: AI_SYSTEM + `\nThe notes are from a deck called "${deckName}".` }];
    for (const [u, a] of AI_SHOTS) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    messages.push({ role: 'user', content: aiDescribe(card) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await engine.chat.completions.create({ messages, temperature: attempt ? 0.3 : 0, max_tokens: 140 });
      const r = aiParseReply(res.choices[0].message.content);
      if (r) return r;
    }
    return { verdict: 'ok', question: '', answer: '' }; // unreadable reply: leave the card alone
  },

  /* Returns [{ index, card, verdict, fix }] for cards the AI wants to change. */
  async review(deck, choice, hooks) {
    const engine = await this.load(choice, hooks.onLoad);
    const changes = [];
    for (let i = 0; i < deck.cards.length; i++) {
      if (hooks.cancelled && hooks.cancelled()) break;
      const card = deck.cards[i];
      hooks.onCard && hooks.onCard(i + 1, deck.cards.length);
      let r;
      try { r = await this.judge(engine, deck.name, card); } catch (e) { console.error(e); continue; }
      if (r.verdict === 'drop') changes.push({ index: i, card, verdict: 'drop' });
      else if (r.verdict === 'fix') {
        const fix = aiAcceptFix(card, r);
        if (fix) { if (card.src) fix.src = card.src; changes.push({ index: i, card, verdict: 'fix', fix }); }
      }
    }
    return changes;
  }
};


/* ---------- make questions straight from the notes ---------- */
const AI_GEN_SYSTEM = `You write flashcards for a student from the notes you are given.
Write 1 to 3 questions about the most important facts. Rules:
- Each question must make sense on its own, without seeing the notes, and have ONE clear short answer.
- The answer (1 to 8 words) must be copied from the notes. The question must not contain the answer.
- Use only facts stated in the notes. Never invent anything.
- If the notes are only headings, references, page text or have no clear fact, return an empty list.
Reply with JSON only: {"cards":[{"question":"...","answer":"..."}]}`;
const AI_GEN_SHOTS = [
  ['Notes:\nThe nucleus contains most of the cell\'s genetic material. It is surrounded by a double membrane called the nuclear envelope.',
   '{"cards":[{"question":"Which part of the cell contains most of its genetic material?","answer":"The nucleus"},{"question":"What is the double membrane around the nucleus called?","answer":"The nuclear envelope"}]}'],
  ['Notes:\nChapter 4 Contents Page 12 See Figure 3.2 for details',
   '{"cards":[]}']
];

function aiJunkLine(l) {
  const letters = (l.match(/\p{L}/gu) || []).length;
  if (letters < 12 || l.split(/\s+/).length < 4) return true;
  if (/https?:|www\./.test(l)) return true;
  const caps = l.replace(/[^A-Za-z]/g, '');
  if (caps.length > 8 && caps.replace(/[^A-Z]/g, '').length / caps.length > 0.6) return true; // ALL CAPS heading
  return false;
}
/* Group the loose lines of a file into chunks of ~700 characters, skipping headings and junk */
function aiMakeChunks(lines, size) {
  size = size || 700;
  const chunks = []; let cur = '';
  const push = () => { if (cur.trim().split(/\s+/).length >= 8) chunks.push({ text: cur.trim() }); cur = ''; };
  for (const raw of lines) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (aiJunkLine(l)) { continue; }
    if (cur && (cur + ' ' + l).length > size) push();
    cur = cur ? cur + ' ' + l : l;
  }
  push();
  return chunks;
}
/* Read the model's reply as a list of {question, answer}; null if unreadable */
function aiParseCards(txt) {
  const t = String(txt || '');
  let o = null;
  const m = t.match(/\{[\s\S]*\}/) || t.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { o = JSON.parse(m[0]); } catch { return null; }
  const arr = Array.isArray(o) ? o : Array.isArray(o.cards) ? o.cards : null;
  if (!arr) return null;
  return arr.filter(x => x && typeof x === 'object').map(x => ({ question: String(x.question || x.q || '').replace(/\s+/g, ' ').trim(), answer: String(x.answer || x.a || '').replace(/\s+/g, ' ').trim() }));
}
/* Keep only the grounded, non-duplicate questions from one chunk */
function aiAcceptCards(chunkText, list) {
  const out = [], seen = new Set();
  for (const r of list.slice(0, 3)) {
    const ok = aiAcceptFix({ q: chunkText, a: '' }, { ...r });
    if (!ok) continue;
    const k = aiNorm(ok.q);
    if (seen.has(k)) continue;
    seen.add(k); out.push(ok);
  }
  return out;
}
AI.genChunk = async function (engine, deckName, text) {
  const messages = [{ role: 'system', content: AI_GEN_SYSTEM + `\nThe notes are from a deck called "${deckName}".` }];
  for (const [u, a] of AI_GEN_SHOTS) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
  messages.push({ role: 'user', content: 'Notes:\n' + text });
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await engine.chat.completions.create({ messages, temperature: attempt ? 0.3 : 0.1, max_tokens: 260 });
    const list = aiParseCards(res.choices[0].message.content);
    if (list) return aiAcceptCards(text, list);
  }
  return null; // unreadable twice: caller falls back to the basic questions
};
/* results[i] = array of cards (maybe empty) for chunk i, or null if that chunk was not (or could not be) done */
AI.generate = async function (chunks, deckName, choice, hooks) {
  const engine = await AI.load(choice, hooks.onLoad);
  const results = chunks.map(() => null); let made = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (hooks.cancelled && hooks.cancelled()) break;
    hooks.onChunk && hooks.onChunk(i + 1, chunks.length, made);
    try { results[i] = await AI.genChunk(engine, deckName, chunks[i].text); } catch (e) { console.error(e); results[i] = null; }
    if (results[i]) made += results[i].length;
  }
  return results;
};

if (typeof module !== 'undefined') module.exports = { aiDescribe, aiParseReply, aiAcceptFix, AI_SYSTEM, aiMakeChunks, aiParseCards, aiAcceptCards, AI };
