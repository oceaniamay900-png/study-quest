'use strict';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('sq_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sq_' + k, JSON.stringify(v)); } catch { /* ignore */ } }
};
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.random() * a.length | 0];

let muted = store.get('muted', false);
let audioCtx = null;
function beep(freq, dur = 0.12, type = 'square', delay = 0) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime + delay;
    o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.stop(t + dur);
  } catch { /* ignore */ }
}
const sfx = {
  good: () => { beep(660, .1); beep(880, .15, 'square', .1); },
  bad: () => { beep(200, .25, 'sawtooth'); },
  catch: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, .15, 'triangle', i * .12)); },
  level: () => { [392, 523, 659, 784, 1047].forEach((f, i) => beep(f, .15, 'triangle', i * .1)); }
};

/* ---------- state ---------- */
let player = store.get('player', { starter: null, xp: 0, dex: {}, shiny: {}, best: 0 });
let decks = store.get('decks', []);
decks.forEach((d, i) => { if (!d.id) d.id = 'd' + Date.now().toString(36) + i; });
let wstate = Object.assign({ x: null, y: null, hearts: 5, deckId: null }, store.get('world', {}));
const saveWorld = () => store.set('world', wstate);
const worldMissed = new Map();
let worldQueue = [], worldKey = '';
const save = () => { store.set('player', player); store.set('decks', decks); };

/* the original text of each deck is kept (separately from the cards) so a card can point back to where it came from */
const MAX_SRC = 400000;
function saveSource(id, text) { try { localStorage.setItem('sq_src_' + id, text.slice(0, MAX_SRC)); return text.length > MAX_SRC ? 'partial' : 'full'; } catch { return 'none'; } }
function loadSource(id) { try { return localStorage.getItem('sq_src_' + id) || ''; } catch { return ''; } }
function removeSource(id) { try { localStorage.removeItem('sq_src_' + id); } catch { /* ignore */ } }

const levelOf = xp => 1 + Math.floor(xp / 50);
const stageOf = lv => lv >= 8 ? 2 : lv >= 4 ? 1 : 0;
/* the partner is any creature you own; the starter you picked first is the default */
const ownsSpecies = id => id === player.starter || !!player.dex[id];
const starterSp = () => {
  const id = player.partner && ownsSpecies(player.partner) ? player.partner : player.starter;
  return ALL_SPECIES.find(s => s.id === id) || STARTERS.find(s => s.id === player.starter);
};
function setPartner(id) {
  if (!ownsSpecies(id)) return;
  player.partner = id; save(); sfx.good();
  }

/* ---------- screens ---------- */
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  document.body.classList.toggle('inworld', name === 'world');
  window.scrollTo(0, 0);
}
function goHome() {
  if (!player.starter) return renderStarter();
  renderHome(); show('home');
}

/* ---------- starter ---------- */
function renderStarter() {
  const row = $('#starterRow'); row.innerHTML = '';
  STARTERS.forEach(sp => {
    const b = document.createElement('button');
    b.className = 'card starter';
    b.innerHTML = `<div class="sprite small">${monSVG(sp, 0)}</div><strong>${sp.names[0]}</strong><span class="pill">${sp.type}</span>`;
    b.onclick = () => { player.starter = sp.id; save(); sfx.good(); goHome(); if (typeof Tutorial !== 'undefined') Tutorial.offer(); };
    row.appendChild(b);
  });
  show('starter');
}

/* ---------- home ---------- */
function renderHome() {
  const sp = starterSp(), lv = levelOf(player.xp), st = stageOf(lv);
  $('#partnerSprite').innerHTML = monSVG(sp, st);
  $('#partnerName').textContent = speciesName(sp, st);
  $('#partnerLv').textContent = 'Lv ' + lv;
  $('#xpBar').style.width = ((player.xp % 50) / 50 * 100) + '%';
  const nextEvo = lv < 4 ? 4 : lv < 8 ? 8 : null;
  $('#partnerInfo').textContent = `${player.xp % 50}/50 XP` + (nextEvo ? ` · evolves at Lv ${nextEvo}` : ' · fully evolved!');
  $('#changePartner').onclick = () => renderDex();

  const list = $('#deckList'); list.innerHTML = '';
  if (!decks.length) list.innerHTML = '<p class="sub">No decks yet. Add a file above or try the sample deck.</p>';
  decks.forEach((d, i) => {
    const row = document.createElement('div'); row.className = 'deck';
    const info = document.createElement('div'); info.className = 'grow';
    const nm = document.createElement('strong'); nm.textContent = d.name;
    const ct = document.createElement('div'); ct.className = 'sub'; ct.textContent = d.cards.length + ' cards';
    info.append(nm, ct);
    const explore = document.createElement('button'); explore.textContent = '🌍 Explore'; explore.title = 'Walk the world and battle creatures with this deck';
    explore.onclick = () => { wstate.deckId = d.id; saveWorld(); enterWorld(); };
    const play = document.createElement('button'); play.className = 'ghost'; play.textContent = '⚔ Quick battle'; play.title = 'Classic run through the whole deck'; play.onclick = () => startSession(i);
    const del = document.createElement('button'); del.className = 'ghost'; del.textContent = '🗑'; del.title = 'Delete deck';
    del.onclick = () => { if (confirm('Delete "' + d.name + '"?')) { removeSource(d.id); decks.splice(i, 1); save(); renderHome(); } };
    const tidy = document.createElement('button'); tidy.className = 'ghost'; tidy.textContent = '✨ Tidy'; tidy.title = 'Use a small AI to fix or remove confusing questions';
    tidy.onclick = () => openTidy(d);
    row.append(info, explore, play, tidy);
    if (d.original) {
      const undo = document.createElement('button'); undo.className = 'ghost'; undo.textContent = '↩'; undo.title = 'Undo AI tidy (restore the original cards)';
      undo.onclick = () => { d.cards = d.original; delete d.original; worldKey = ''; save(); renderHome(); };
      row.appendChild(undo);
    }
    row.append(del); list.appendChild(row);
  });
  if (decks.length > 1) {
    const all = document.createElement('button'); all.className = 'ghost'; all.textContent = '🗑 Delete all decks';
    all.onclick = () => { if (confirm('Delete all ' + decks.length + ' decks?')) { decks.forEach(d => removeSource(d.id)); decks.length = 0; save(); renderHome(); } };
    list.appendChild(all);
  }
}

function addDeck(name, cards, source) {
  if (cards.length < 1) { alert('Sorry, I couldn\'t find any study cards in "' + name + '". Check the "What formats work?" section.'); return; }
  if (cards.length > MAX_CARDS) { alert('"' + name + '" made ' + cards.length + ' cards, which is a lot to study at once (and too big to save in your browser). I kept ' + MAX_CARDS + ' of them at random.'); cards = shuffle(cards).slice(0, MAX_CARDS); }
  const deck = { id: 'd' + Date.now().toString(36) + (Math.random() * 1e4 | 0), name, cards };
  if (source) deck.srcSaved = saveSource(deck.id, source);
  decks.unshift(deck);
  save(); renderHome();
}
const STUDY_FILE = /\.(txt|md|csv|tsv|json|pdf)$/i;
const MAX_CARDS = 600;
async function handleFiles(files) {
  const status = $('#status');
  const skipped = [];
  for (const f of files) {
    if (!STUDY_FILE.test(f.name)) { skipped.push(f.name); continue; }
    const name = f.name.replace(/\.[^.]+$/, '');
    try {
      let text;
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        status.textContent = `Reading ${f.name}…`;
        text = await extractPdfText(f, (p, n) => { status.textContent = `Reading ${f.name}… page ${p}/${n}`; });
        if (text.replace(/\s/g, '').length < 20) {
          alert(`"${f.name}" doesn't seem to contain selectable text (it may be a scanned image). Try a PDF where you can highlight the words, or paste the text instead.`);
          continue;
        }
        await importText(name, text, 'file.pdf');
      } else {
        text = await f.text();
        await importText(name, text, f.name);
      }
    } catch (err) {
      console.error(err);
      alert(`Sorry, I couldn't read "${f.name}". ${err && err.message ? err.message : ''}`);
    }
  }
  status.textContent = '';
  if (skipped.length) alert('Skipped (not a study file): ' + skipped.join(', ') + '\n\nUse .pdf, .txt, .md, .csv, .tsv or .json files with your notes.');
}
$('#fileInput').onchange = e => { handleFiles(e.target.files); e.target.value = ''; };
const drop = $('#drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
$('#pasteBtn').onclick = async () => {
  const t = $('#pasteText').value.trim(); if (!t) return;
  const nm = $('#pasteName').value.trim() || 'My notes';
  $('#pasteText').value = ''; $('#pasteName').value = '';
  await importText(nm, t, 'notes.txt');
};
$('#sampleBtn').onclick = () => importText('Sample: Science', SAMPLE, 'sample.txt');

/* ---------- AI tidy ---------- */
let tidy = null;
function aiShow(part) { ['aiStart', 'aiBusy', 'aiResults'].forEach(id => $('#' + id).classList.toggle('hidden', id !== part)); }
function closeTidy() { if (tidy) tidy.stop = true; tidy = null; $('#aiModal').classList.add('hidden'); }
function openTidy(deck) {
  if (!AI.supported()) { alert('Your browser can\'t run the AI (it needs WebGPU). Try Chrome or Edge on a computer. The rest of the game works as normal.'); return; }
  tidy = { deck, stop: false };
  $('#aiDeckName').textContent = deck.name + ' · ' + deck.cards.length + ' cards';
  $('#aiModel').innerHTML = AI_MODELS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');
  aiShow('aiStart'); $('#aiModal').classList.remove('hidden');
}
async function runTidy() {
  const t = tidy, deck = t.deck;
  aiShow('aiBusy'); $('#aiStatus').textContent = 'Starting the AI…'; $('#aiBar').style.width = '0';
  let changes;
  try {
    changes = await AI.review(deck, +$('#aiModel').value, {
      cancelled: () => t.stop,
      onLoad: p => { $('#aiStatus').textContent = 'Loading the AI (first time is slow)… ' + (p.text || ''); $('#aiBar').style.width = Math.round((p.progress || 0) * 100) + '%'; },
      onCard: (i, n) => { $('#aiStatus').textContent = `Checking card ${i} of ${n}…`; $('#aiBar').style.width = Math.round(i / n * 100) + '%'; }
    });
  } catch (e) {
    console.error(e);
    if (tidy === t) { aiShow('aiStart'); alert('The AI could not start: ' + (e && e.message ? e.message : e) + '\n\nTry the "Faster" size, or check your internet connection for the first download.'); }
    return;
  }
  if (tidy !== t) return;
  if (!changes.length) { aiShow('aiResults'); $('#aiSummary').textContent = t.stop ? 'Stopped. No changes found so far.' : 'The AI found nothing to change. 🎉'; $('#aiList').innerHTML = ''; $('#aiApply').classList.add('hidden'); t.changes = []; return; }
  t.changes = changes;
  const fixes = changes.filter(c => c.verdict === 'fix').length, drops = changes.length - fixes;
  $('#aiSummary').textContent = `${fixes} rewritten, ${drops} removed${t.stop ? ' (stopped early)' : ''}. Untick any change you don't agree with.`;
  const list = $('#aiList'); list.innerHTML = '';
  changes.forEach((c, k) => {
    const d = document.createElement('div'); d.className = 'aiitem';
    const lab = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.dataset.k = k;
    const body = document.createElement('div');
    const old = document.createElement('div'); old.className = 'old'; old.textContent = c.card.q + '  →  ' + c.card.a;
    const nw = document.createElement('div');
    if (c.verdict === 'fix') { nw.className = 'new'; nw.textContent = c.fix.q + '  →  ' + c.fix.a; } else { nw.className = 'drop'; nw.textContent = 'Remove this card'; }
    body.append(old, nw); lab.append(cb, body); d.appendChild(lab); list.appendChild(d);
  });
  $('#aiApply').classList.remove('hidden');
  aiShow('aiResults');
}
function applyTidy() {
  const t = tidy; if (!t) return;
  const take = new Set([...document.querySelectorAll('#aiList input:checked')].map(i => +t.changes[+i.dataset.k].index));
  if (take.size) {
    const byIndex = new Map(t.changes.map(c => [c.index, c]));
    const next = [];
    t.deck.cards.forEach((c, i) => {
      if (!take.has(i)) return next.push(c);
      const ch = byIndex.get(i); if (ch.verdict === 'fix') next.push(ch.fix);
    });
    if (!t.deck.original) t.deck.original = t.deck.cards;
    t.deck.cards = next; worldKey = ''; save();
  }
  closeTidy(); renderHome();
}
$('#aiGo').onclick = runTidy;
$('#aiStop').onclick = () => { if (tidy) tidy.stop = true; if (gen) gen.stop = true; $('#aiStatus').textContent = 'Stopping…'; };
$('#aiCancel0').onclick = $('#aiCancel1').onclick = closeTidy;
$('#aiApply').onclick = applyTidy;

/* ---------- AI writes the questions when a file is added ---------- */
$('#genModel').innerHTML = AI_MODELS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');
$('#genModel').value = String(store.get('genModel', 0));
$('#aiGenOn').checked = !!store.get('aiGen', false);
const syncGenOpts = () => $('#aiGenOpts').classList.toggle('hidden', !$('#aiGenOn').checked);
syncGenOpts();
$('#aiGenOn').onchange = () => {
  store.set('aiGen', $('#aiGenOn').checked); syncGenOpts();
  if ($('#aiGenOn').checked && !AI.supported()) alert('Your browser can\'t run the AI (it needs WebGPU), so files will use the basic question maker. Try Chrome or Edge on a computer.');
};
$('#genModel').onchange = () => store.set('genModel', +$('#genModel').value);

let gen = null;
async function runGeneration(name, chunks) {
  const g = gen = { stop: false };
  $('#aiTitle').textContent = '✨ Making questions'; $('#aiDeckName').textContent = name + ' · ' + chunks.length + ' sections to read';
  aiShow('aiBusy'); $('#aiStatus').textContent = 'Starting the AI…'; $('#aiBar').style.width = '0';
  $('#aiModal').classList.remove('hidden');
  try {
    return await AI.generate(chunks, name, +$('#genModel').value, {
      cancelled: () => g.stop,
      onLoad: p => { $('#aiStatus').textContent = 'Loading the AI (first time is slow)… ' + (p.text || ''); $('#aiBar').style.width = Math.round((p.progress || 0) * 100) + '%'; },
      onChunk: (i, n, made) => { $('#aiStatus').textContent = `Reading section ${i} of ${n} · ${made} questions so far`; $('#aiBar').style.width = Math.round(i / n * 100) + '%'; }
    });
  } catch (e) {
    console.error(e);
    alert('The AI could not start: ' + (e && e.message ? e.message : e) + '\n\nThe basic question maker will be used instead.');
    return null;
  } finally { gen = null; $('#aiModal').classList.add('hidden'); $('#aiTitle').textContent = '✨ Tidy with AI'; }
}
async function importText(name, text, filename) {
  const { source, cards, loose } = parseWithSource(text, filename);
  let out = cards;
  if ($('#aiGenOn').checked && AI.supported() && loose.length) {
    const chunks = aiMakeChunks(loose);
    const results = chunks.length ? await runGeneration(name, chunks) : null;
    if (results) {
      out = cards.filter(c => c.kind !== 'cloze');
      chunks.forEach((ch, i) => {
        const r = results[i];
        if (r) {
          r.forEach(c => { const loc = locateSentence(source, ch.text, c.a, c.q); if (loc) c.src = loc; out.push(c); });
        } else { // not done (stopped or failed): use the basic fill-in-the-blank for this part
          for (const sent of ch.text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)) {
            const c = makeCloze(sent.trim()); if (!c) continue;
            const loc = locateCard(source, c); if (loc) c.src = loc; out.push(c);
          }
        }
      });
    }
  }
  const seen = new Set();
  out = out.filter(c => { const k = norm(c.q) + '|' + norm(c.a); if (seen.has(k)) return false; seen.add(k); return true; });
  addDeck(name, out, source);
}

/* ---------- "This doesn't make sense": see the source and fix the card ---------- */
let fix = null;
function openFix() {
  const p = S && (S.last || S.current); if (!p) return;
  const deck = S.deck, ref = p.ref;
  const text = loadSource(deck.id);
  fix = { p, ref, deck, text, range: ref.src || null, a: 0, b: 0, first: true };
  const v = cardView(p, false);
  $('#fixQ').value = v.text; $('#fixA').value = p.a;
  fix.origShown = v.text;
  const note = $('#srcNote');
  if (!text) note.textContent = 'The original file isn\'t saved for this deck (decks added before this update don\'t keep it). Add the file again to see where questions come from. You can still fix the question above.';
  else if (deck.srcSaved === 'partial') note.textContent = 'The file was very long, so only the first part is saved here.';
  else if (!fix.range) note.textContent = 'I couldn\'t work out exactly where this came from. Use the search box to look for it.';
  else note.textContent = 'The highlighted part is where this question was made from.';
  $('#srcForm').classList.toggle('hidden', !text); document.querySelector('.srcbtns').classList.toggle('hidden', !text);
  setWindow(fix.range); renderSource();
  $('#fixModal').classList.remove('hidden');
  setTimeout(() => $('#fixQ').focus(), 50);
}
function setWindow(range) {
  const len = fix.text.length;
  if (range) { fix.a = Math.max(0, range[0] - 1200); fix.b = Math.min(len, range[1] + 1200); }
  else { fix.a = 0; fix.b = Math.min(len, 2400); }
  fix.first = true;
}
function renderSource() {
  const v = $('#srcView'); v.textContent = '';
  const t = fix.text; if (!t) return;
  const r = fix.range, a = fix.a, b = fix.b;
  const vis = x => x.replace(/\t/g, '  │  '); // table columns show as  │
  if (a > 0) v.append('… ');
  let markEl = null;
  if (r && r[0] >= a && r[1] <= b) {
    markEl = document.createElement('mark'); markEl.textContent = vis(t.slice(r[0], r[1]));
    v.append(vis(t.slice(a, r[0])), markEl, vis(t.slice(r[1], b)));
  } else v.append(vis(t.slice(a, b)));
  if (b < t.length) v.append(' …');
  if (markEl && fix.first) { fix.first = false; const top = markEl.offsetTop - v.clientHeight / 3; v.scrollTop = Math.max(0, top); }
}
$('#srcUp').onclick = () => { fix.a = Math.max(0, fix.a - 3000); renderSource(); $('#srcView').scrollTop = 0; };
$('#srcDown').onclick = () => { fix.b = Math.min(fix.text.length, fix.b + 3000); renderSource(); $('#srcView').scrollTop = $('#srcView').scrollHeight; };
$('#srcForm').onsubmit = e => {
  e.preventDefault();
  const q = $('#srcFind').value; if (!q.trim() || !fix) return;
  const from = fix.range && fix.lastQ === q ? fix.range[1] : 0;
  const r = findLoose(fix.text, q, from) || findLoose(fix.text, q, 0);
  if (!r) { $('#srcNote').textContent = 'Not found in the file.'; return; }
  fix.lastQ = q; fix.range = r; setWindow(r); renderSource();
  $('#srcNote').textContent = 'Highlighted: your search (press Find again for the next match).';
};
function closeFix() { fix = null; $('#fixModal').classList.add('hidden'); }
function refreshPrepped(ref) {
  const lists = [S.cards, S.queue, worldQueue, [S.current, S.last]];
  lists.forEach(l => (l || []).forEach(x => { if (x && x.ref === ref) Object.assign(x, prepOne(ref, S.flip)); }));
}
$('#badBtn').onclick = openFix;
$('#fixCancel').onclick = closeFix;
$('#fixSave').onclick = () => {
  const { p, ref } = fix;
  const q = $('#fixQ').value.replace(/\s+/g, ' ').trim(), a = $('#fixA').value.replace(/\s+/g, ' ').trim();
  if (!q || !a) { alert('Both the question and the answer need some text.'); return; }
  const direct = !S.flip || p.kind === 'cloze';
  if (p.kind === 'def') {
    if (q !== fix.origShown) { ref.q = q; ref.kind = 'qa'; }
    ref.a = a;
  } else if (direct) {
    ref.q = q; ref.a = a;
    if (ref.kind === 'def' || (ref.kind === 'cloze' && !q.includes('_____'))) ref.kind = 'qa';
  } else { ref.a = q; ref.q = a; }
  if (fix.range) ref.src = fix.range;   // remember the part the person pointed at
  ref.edited = true;
  refreshPrepped(ref); save();
  const live = S.current && S.current.ref === ref && !S.locked;
  closeFix();
  if (live) renderQuestion(S.current);
};
$('#fixDel').onclick = () => {
  if (!confirm('Delete this card from the deck?')) return;
  const { ref, deck } = fix;
  const i = deck.cards.indexOf(ref); if (i >= 0) deck.cards.splice(i, 1);
  const drop = l => { for (let k = l.length - 1; k >= 0; k--) if (l[k] && l[k].ref === ref) l.splice(k, 1); };
  [S.cards, S.queue, worldQueue].forEach(l => l && drop(l));
  save();
  const live = S.current && S.current.ref === ref && !S.locked;
  closeFix();
  if (live) { S.current = null; askNext(); }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && fix) closeFix(); });

const SAMPLE = `Mitochondria: the powerhouse of the cell
Photosynthesis - the process plants use to turn sunlight into chemical energy
Q: What gas do plants absorb from the air?
A: Carbon dioxide
Q: What is the chemical symbol for gold?
A: Au
DNA :: the molecule that carries genetic information
Osmosis: movement of water across a semi-permeable membrane
Q: What is the closest star to Earth?
A: The Sun
Q: Which planet is known as the Red Planet?
A: Mars
Velocity - speed in a given direction
Q: What is H2O commonly called?
A: Water
The nucleus contains most of the cell's genetic material.`;

/* ---------- study logic ---------- */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
/* edit distance where swapping two neighbouring letters ("recieve") only counts as one slip */
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  const d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
/* How answers are checked:
   1. Spelling slips are forgiven.
   2. SHORT answers (up to 3 words, not counting a / an / the / of): every word must be there. "carbon" is not "carbon dioxide",
      but "sun" is fine for "the sun".
   3. LONGER answers can be shortened: you need about half of the key words and not a pile of other words.
   4. A list ("red, blue, yellow"): each item is its own correct answer. Give one, or several. */
const SKIPPABLE = new Set(['a', 'an', 'the', 'of']);
const FILLER = new Set('a an the of to in on at for and or is are was were be been being it its this that these those with by as from which has have had can will so than then also'.split(' '));
const hasDigit = w => /\d/.test(w);
const wordTol = w => hasDigit(w) ? 0 : w.length >= 13 ? 3 : w.length >= 9 ? 2 : w.length >= 4 ? 1 : 0;
function sameWord(a, b) {
  if (a === b) return true;
  if (hasDigit(a) || hasDigit(b)) return false;
  return lev(a, b) <= wordTol(b);
}
const splitList = t => String(t).split(/;|,(?!\d)|(?<!\d),/).map(x => x.trim()).filter(Boolean);
function isCorrectOne(input, answer) {
  const x = norm(input), y = norm(answer);
  if (!x || !y) return false;
  if (x === y) return true;
  const yw = y.split(' '), xw = x.split(' ');
  const need = yw.filter(w => !SKIPPABLE.has(w));
  const given = xw.filter(w => !SKIPPABLE.has(w));
  if (!need.length || !given.length) return false;
  // whole answer with a few typos (spaces ignored, so "power house" = "powerhouse")
  const xs = given.join(''), ys = need.join('');
  const tol = hasDigit(ys) ? 0 : ys.length >= 14 ? 3 : ys.length >= 9 ? 2 : ys.length >= 4 ? 1 : 0;
  if (lev(xs, ys) <= tol) return true;
  const match = (list, pool) => {                      // how many of `list` can be found in `pool` (each word used once)
    const used = new Set(); const hit = [];
    for (const w of list) { const j = pool.findIndex((v, i) => !used.has(i) && sameWord(v, w)); if (j >= 0) { used.add(j); hit.push(w); } }
    return { hit, used };
  };
  if (need.length <= 3) {                               // short answer: every word counts
    if (given.length !== need.length) return false;
    return match(need, given).hit.length === need.length;
  }
  // longer answer: a shortened version is fine if it has enough of the key words and still says the important thing
  const key = need.filter(w => !FILLER.has(w));
  const keys = key.length >= 2 ? key : need;
  const { hit, used } = match(keys, given);
  const required = Math.max(2, Math.ceil(keys.length * 0.5));
  if (hit.length < required) return false;
  const extras = given.filter((v, i) => !used.has(i) && !FILLER.has(v)).length;
  return extras <= hit.length;                          // mostly the right words, not a pile of other ones
}
function isCorrect(input, answer) {
  if (isCorrectOne(input, answer)) return true;
  const items = splitList(answer);
  if (items.length < 2) return false;
  const typed = splitList(input);
  if (!typed.length) return false;
  // every thing typed must be one of the listed items (so one item, or several, are all fine)
  return typed.every(t => items.some(it => isCorrectOne(t, it)));
}

let S = null; // session

/* Cards are stored as {q, a, kind}. This turns them into clear, labelled questions. */
function prepOne(raw, flip) {
  const c = normaliseCard(raw);
  let r;
  if (!flip) r = { ...c };
  else if (c.kind === 'def') r = { q: c.a, a: c.q, kind: 'term' };
  else if (c.kind === 'qa') r = { q: c.a, a: c.q, kind: 'qa' };
  else r = { ...c };
  r.ref = raw; // the real card in the deck (so it can be edited)
  return r;
}
function prepCards(deck, flip) { return deck.cards.map(c => prepOne(c, flip)); }
function cardView(c, typing) {
  switch (c.kind) {
    case 'def': return { label: 'Definition', text: `What is “${c.q}”?` };
    case 'term': return { label: 'Which term matches this description?', text: c.q };
    case 'cloze': {
      let hint = '';
      if (typing) { const w = c.a.split(' ')[0]; hint = ` · starts with “${w[0]}”, ${c.a.length} letters`; }
      return { label: 'Fill in the missing word' + hint, text: c.q };
    }
    default: return { label: 'Question', text: c.q };
  }
}

/* ---------- world ---------- */
function battleActive() { return $('#screen-battle').classList.contains('active'); }
function enterWorld() {
  if (!player.starter) return renderStarter();
  if (!decks.length) { renderHome(); show('home'); $('#status').textContent = 'Add a study deck (or try the sample deck) to explore the world!'; return; }
  show('world'); World.enter();
}
function startEncounter(enc) {
  const deck = decks.find(d => d.id === wstate.deckId) || decks[0];
  if (!deck) return endEncounter('ran');
  const flip = $('#flip').value === '1';
  const cards = prepCards(deck, flip);
  const key = deck.id + '|' + flip + '|' + cards.length;
  if (key !== worldKey) { worldKey = key; worldQueue = shuffle(cards); }
  S = {
    world: true, flip, enc, deckIndex: decks.indexOf(deck), deck, cards, mode: $('#mode').value,
    queue: worldQueue, missed: new Map(),
    hearts: wstate.hearts, maxHearts: 5, streak: 0, bestStreak: 0, right: 0, wrong: 0,
    caught: [], total: cards.length, cleared: 0,
    wild: null, wildHp: 0, wildMax: 3, current: null, locked: false, startXp: player.xp
  };
  $('#field').className = 'field ' + (enc.zone || 'meadow');
  show('battle');
  spawnWild();
}
function endEncounter(res) {
  const info = { caught: S.caught.slice(), xp: player.xp - S.startXp, trainer: S.enc ? S.enc.trainer : null };
  wstate.hearts = res === 'fainted' ? 5 : Math.max(1, S.hearts);
  saveWorld(); save();
  S.current = null;
  show('world'); World.enter(); World.afterEncounter(res, info);
}
function leaveWorldBattle() {
  if (S && S.world && battleActive()) { wstate.hearts = Math.max(1, S.hearts); saveWorld(); S.current = null; World.cancelEncounter(); }
}

function startSession(deckIndex) {
  const deck = decks[deckIndex];
  const flip = $('#flip').value === '1';
  const cards = prepCards(deck, flip);
  S = {
    deckIndex, flip, deck, cards, mode: $('#mode').value,
    queue: shuffle(cards), missed: new Map(),
    hearts: 5, maxHearts: 5, streak: 0, bestStreak: 0, right: 0, wrong: 0,
    caught: [], total: cards.length, cleared: 0,
    wild: null, wildHp: 0, wildMax: 3, current: null, locked: false, startXp: player.xp
  };
  show('battle');
  spawnWild(true);
}

function spawnWild() {
  const sp = S.world ? S.enc.sp : pick(ALL_SPECIES);
  const T = S.world && S.enc.trainer ? S.enc.trainer : null;     // a villager's creature, not a wild one
  const lv = T ? levelOf(player.xp) + 1 : Math.max(1, levelOf(player.xp) + (Math.random() * 3 | 0) - 1);
  S.wild = { sp, lv, shiny: T ? false : S.world ? !!S.enc.shiny : Math.random() < 0.06, trainer: T };
  S.wildMax = T ? T.hp : sp.hp || (sp.id === 'dracky' ? 4 : 3); S.wildHp = S.wildMax;
  const lvMe = levelOf(player.xp), me = starterSp(), st = stageOf(lvMe);
  $('#meSprite').innerHTML = monSVG(me, st);
  $('#meSprite').style.setProperty('--scale', 1 + st * 0.12);
  $('#meName').textContent = speciesName(me, st); $('#meLv').textContent = 'Lv ' + lvMe;
  const foe = $('#foeSprite');
  foe.className = 'sprite foe' + (S.wild.shiny ? ' shiny' : '');
  foe.innerHTML = monSVG(sp, 0);
  foe.animate([{ transform: 'translateX(120%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'ease-out' });
  $('#foeName').textContent = T ? `${T.name}'s ${sp.name}` : sp.name + (S.wild.shiny ? ' ★' : ''); $('#foeLv').textContent = 'Lv ' + lv;
  renderBars();
  say(T ? `${T.name} wants to battle! ${T.name} sent out ${sp.name}!` : `A wild ${sp.name}${S.wild.shiny ? ' (shiny!)' : ''} appeared!`);
  askNext();
}

function renderBars() {
  $('#foeHp').style.width = (S.wildHp / S.wildMax * 100) + '%';
  if (S.world) wstate.hearts = Math.max(0, S.hearts);
  $('#meHearts').textContent = '❤️'.repeat(S.hearts) + '🖤'.repeat(S.maxHearts - S.hearts);
  $('#hudCards').textContent = S.world ? (S.enc.trainer ? `⚔ vs ${S.enc.trainer.name}` : `🌍 ${S.enc.zoneName}`) : `📚 ${S.queue.length + (S.current ? 1 : 0)} left`;
  $('#hudStreak').textContent = `🔥 ${S.streak}`;
  $('#hudScore').textContent = `✅ ${S.right}  ❌ ${S.wrong}`;
}
const say = t => { $('#msg').textContent = t; };

function makeChoices(card) {
  const pool = [...new Set(S.cards.filter(c => c.kind === card.kind && norm(c.a) !== norm(card.a)).map(c => c.a))];
  const pool2 = [...new Set(S.cards.filter(c => norm(c.a) !== norm(card.a)).map(c => c.a))];
  let src = pool.length >= 3 ? pool : pool2;
  if (src.length < 3) return null;
  const L = card.a.length;
  const isCap = t => /^[A-Z]/.test(t), qn = norm(card.q);
  const clean = src.filter(t => !qn.includes(norm(t))); if (clean.length >= 3) src = clean;
  const cost = t => Math.abs(t.length - L) + (isCap(t) !== isCap(card.a) ? 6 : 0) + (/\d/.test(t) !== /\d/.test(card.a) ? 6 : 0) + (Math.random() - .5) * 8;
  src = shuffle(src).map(t => [t, cost(t)]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
  return shuffle([card.a, ...src.slice(0, 3)]);
}

function askNext() {
  if (!S.queue.length) { if (S.world) S.queue.push(...shuffle(S.cards)); else return finish(true); }
  S.current = S.queue.shift(); S.locked = false; S.last = S.current;
  $('#feedback').textContent = ''; $('#feedback').className = 'feedback';
  $('#nextBtn').classList.add('hidden');
  renderQuestion(S.current);
}
/* ---------- hints ---------- */
function maskAnswer(ans, level) {
  // level 1: first letter of every word; level 2: about half the letters
  return ans.split(' ').map(w => [...w].map((ch, i) => {
    if (!/[\p{L}\p{N}]/u.test(ch)) return ch;
    return (i === 0 || (level >= 2 && i % 2 === 0)) ? ch : '_';
  }).join(' ')).join('   ');
}
const HINT_COST = 3, XP_PER_ANSWER = 10;           // each hint used takes 3 XP off that answer (you always still get at least 3)
const hintBtnLabel = () => `💡 Hint (−${HINT_COST} XP)`;
function showHint() {
  if (!S || S.locked || !S.current) return;
  const c = S.current, out = $('#hintText');
  S.hintLevel = (S.hintLevel || 0) + 1;
  const mc = !$('#choices').classList.contains('hidden');
  if (mc) {
    const wrong = [...document.querySelectorAll('.choice')].filter(b => !b.disabled && b.dataset.val !== c.a);
    const live = document.querySelectorAll('.choice:not(:disabled)').length;
    if (wrong.length && live > 2) { const b = pick(wrong); b.disabled = true; b.classList.add('struck'); }
    out.textContent = '💡 Crossed out one wrong answer.';
    if (document.querySelectorAll('.choice:not(:disabled)').length <= 2) $('#hintBtn').disabled = true;
  } else {
    const words = c.a.split(' ').length;
    const lvl = Math.min(S.hintLevel, 2);
    const items = splitList(c.a).length;
    out.textContent = `💡 ${words} word${words > 1 ? 's' : ''}, ${c.a.replace(/ /g, '').length} letters:  ${maskAnswer(c.a, lvl)}` + (items > 1 ? `\n(It is a list of ${items}: any one of them counts.)` : '') + (lvl >= 2 ? '' : '\n(Press Hint again for more, but it costs more XP.)');
    if (S.hintLevel >= 2) $('#hintBtn').disabled = true;
    $('#typeInput').focus();
  }
  out.classList.remove('hidden');
  $('#hintBtn').textContent = $('#hintBtn').disabled ? '💡 No more hints' : hintBtnLabel();
  $('#hintCost').textContent = `Hints used: ${S.hintLevel} · this answer is now worth ${Math.max(3, XP_PER_ANSWER - HINT_COST * S.hintLevel)} XP`;
  $('#hintCost').classList.remove('hidden');
}
$('#hintBtn').onclick = showHint;

function renderQuestion(c) {
  S.hintLevel = 0; $('#hintText').classList.add('hidden'); $('#hintText').textContent = ''; $('#hintBtn').disabled = false; $('#hintBtn').classList.remove('hidden'); $('#hintBtn').textContent = hintBtnLabel(); $('#hintCost').classList.add('hidden');
  const choices = makeChoices(c);
  let useMC = S.mode === 'mc' || (S.mode === 'mixed' && Math.random() < 0.5);
  if (S.mode === 'type' && c.a.length > 40) useMC = true; // long definitions are painful to type
  if (c.a.length > 40 && S.mode === 'mixed') useMC = true;
  if (!choices) useMC = false;
  const box = $('#choices'), form = $('#typeForm');
  box.innerHTML = '';
  const v = cardView(c, !useMC); $('#qlabel').textContent = v.label; $('#qtext').textContent = v.text;
  if (useMC) {
    form.classList.add('hidden'); box.classList.remove('hidden');
    choices.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'choice';
      b.textContent = `${i + 1}. ${t}`; b.dataset.val = t;
      b.onclick = () => submit(t === c.a, b);
      box.appendChild(b);
    });
  } else {
    box.classList.add('hidden'); form.classList.remove('hidden');
    $('#typeInput').value = ''; $('#typeInput').disabled = false;
    setTimeout(() => $('#typeInput').focus(), 50);
  }
  renderBars();
}

$('#typeForm').onsubmit = e => {
  e.preventDefault(); if (!S || S.locked) return;
  submit(isCorrect($('#typeInput').value, S.current.a));
};
document.addEventListener('keydown', e => {
  if (!S || !$('#screen-battle').classList.contains('active')) return;
  if (e.target && e.target.id === 'chatInput') return;      // typing in the chat box must not answer questions
  if (!$('#fixModal').classList.contains('hidden') || !$('#aiModal').classList.contains('hidden')) return;
  if (e.key === 'Enter' && !$('#nextBtn').classList.contains('hidden')) { e.preventDefault(); $('#nextBtn').click(); return; }
  const n = parseInt(e.key, 10);
  if (!S.locked && n >= 1 && n <= 4) { const b = document.querySelectorAll('.choice')[n - 1]; if (b) b.click(); }
});

async function submit(ok, btn) {
  if (S.locked) return; S.locked = true;
  $('#hintBtn').classList.add('hidden'); $('#hintText').classList.add('hidden'); $('#hintCost').classList.add('hidden');
  const c = S.current;
  $('#typeInput').disabled = true;
  document.querySelectorAll('.choice').forEach(b => {
    b.disabled = true;
    if (b.dataset.val === c.a) b.classList.add('right');
  });
  if (btn && !ok) btn.classList.add('wrong');
  const me = starterSp();
  if (ok) {
    if (S.world) worldMissed.delete(c.q);
    S.right++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); S.cleared++;
    Quests.event('answer', { streak: S.streak });
    const crit = S.streak >= 3 && S.streak % 3 === 0;
    const dmg = crit ? 2 : 1;
    sfx.good();
    $('#feedback').className = 'feedback good';
    $('#feedback').textContent = (crit ? `Correct! 🔥 Streak bonus – critical hit!` : 'Correct!') + (S.hintLevel ? `  (hint used: +${Math.max(3, XP_PER_ANSWER - HINT_COST * S.hintLevel)} XP)` : '');
    say(`${$('#meName').textContent} used ${me.type} Strike!${crit ? ' Critical hit!' : ''}`);
    await projectile(me.emoji, '#meSprite', '#foeSprite');
    hitAnim('#foeSprite');
    S.wildHp = Math.max(0, S.wildHp - dmg);
    gainXp(Math.max(3, XP_PER_ANSWER - HINT_COST * (S.hintLevel || 0)));
    renderBars();
    await sleep(500);
    if (S.wildHp <= 0) { if (S.wild.trainer) await winTrainer(); else await doCatch(); }
    S.current = null; renderBars();
    if (S.world) { if (S.wildHp <= 0) return endEncounter(S.wild.trainer ? 'won' : 'caught'); return askNext(); }
    if (!S.queue.length) return finish(true);
    if (S.wildHp <= 0) return spawnWild();
    askNext();
  } else {
    S.wrong++; S.streak = 0; S.hearts--;
    if (!S.missed.has(c.q)) S.missed.set(c.q, c);
    if (S.world) worldMissed.set(c.q, c);
    S.queue.splice(Math.min(3, S.queue.length), 0, c); // see it again soon
    sfx.bad();
    $('#feedback').className = 'feedback bad';
    $('#feedback').textContent = 'Not quite. Answer: ' + c.a;
    say(S.wild.trainer ? `${S.wild.trainer.name}'s ${S.wild.sp.name} attacked!` : `The wild ${S.wild.sp.name} attacked!`);
    await projectile(S.wild.sp.emoji, '#foeSprite', '#meSprite');
    hitAnim('#meSprite');
    S.current = null; renderBars();
    if (S.hearts <= 0) {
      $('#meSprite').classList.add('faint');
      say(`${$('#meName').textContent} fainted…`);
      await sleep(1300);
      $('#meSprite').classList.remove('faint');
      if (S.world) return endEncounter('fainted');
      return finish(false);
    }
    const nb = $('#nextBtn'); nb.classList.remove('hidden'); nb.focus();
    nb.onclick = () => { nb.classList.add('hidden'); askNext(); };
  }
}

function hitAnim(sel) { $(sel).animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'none' }], { duration: 350 }); }

async function projectile(emoji, fromSel, toSel) {
  const field = $('#field').getBoundingClientRect();
  const a = $(fromSel).getBoundingClientRect(), b = $(toSel).getBoundingClientRect();
  const p = document.createElement('div'); p.className = 'proj'; p.textContent = emoji;
  $('#field').appendChild(p);
  const x1 = a.left - field.left + a.width / 2, y1 = a.top - field.top + a.height / 2;
  const x2 = b.left - field.left + b.width / 2, y2 = b.top - field.top + b.height / 2;
  const an = p.animate([{ left: x1 + 'px', top: y1 + 'px', transform: 'translate(-50%,-50%) scale(1)' }, { left: x2 + 'px', top: y2 + 'px', transform: 'translate(-50%,-50%) scale(1.6)' }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
  await an.finished; p.remove();
}

/* beating a villager: no catching, but bonus XP (a lot the first time, a little for rematches) */
async function winTrainer() {
  const T = S.wild.trainer;
  say(`${T.name}'s ${S.wild.sp.name} can't battle any more! You beat ${T.name}!`);
  $('#foeSprite').animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(30px)', opacity: 0 }], { duration: 700, fill: 'forwards' });
  sfx.catch();
  await sleep(1500);
  gainXp(T.first ? 50 : 20); save();
  await sleep(500);
  $('#foeSprite').getAnimations().forEach(a => a.cancel());
}

async function doCatch() {
  const w = S.wild;
  say(`The wild ${w.sp.name} is weak! Throwing a Study Ball…`);
  const foe = $('#foeSprite');
  foe.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.1)', opacity: .2 }], { duration: 500, fill: 'forwards' });
  await sleep(600);
  foe.innerHTML = '<div class="ball">⚪</div>';
  foe.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-25deg)' }, { transform: 'rotate(25deg)' }, { transform: 'rotate(0)' }], { duration: 900, iterations: 2 });
  await sleep(1500);
  sfx.catch();
  const isNew = !player.dex[w.sp.id] && w.sp.id !== player.starter;
  player.dex[w.sp.id] = (player.dex[w.sp.id] || 0) + 1;
  if (w.shiny) player.shiny[w.sp.id] = true;
  S.caught.push({ sp: w.sp, shiny: w.shiny, isNew });
  Quests.event('catch', { zone: S.world && S.enc ? S.enc.zoneName : null, sp: w.sp.id });
  say(`Gotcha! ${w.sp.name} was added to your Studydex!`);
  gainXp(30); save();
  await sleep(1200);
  foe.getAnimations().forEach(a => a.cancel());
}

function gainXp(n) {
  const before = levelOf(player.xp), stBefore = stageOf(before);
  player.xp += n; save();
  const after = levelOf(player.xp);
  if (after > before) {
    sfx.level();
    const st = stageOf(after), me = starterSp();
    $('#meLv').textContent = 'Lv ' + after;
    $('#meSprite').innerHTML = monSVG(me, st);
    $('#meSprite').style.setProperty('--scale', 1 + st * 0.12);
    $('#meName').textContent = speciesName(me, st);
    say(st > stBefore ? `✨ ${speciesName(me, stBefore)} evolved into ${speciesName(me, st)}! ✨` : `${speciesName(me, st)} grew to level ${after}!`);
    $('#meSprite').animate([{ filter: 'brightness(3)' }, { filter: 'none' }], { duration: 900 });
    if (S && battleActive()) S.hearts = Math.min(S.maxHearts, S.hearts + 1); // level up heals a heart
    else {                                                                    // e.g. XP from a quest: heal in the world instead
      wstate.hearts = Math.min(5, wstate.hearts + 1); saveWorld();
      World.toast(st > stBefore ? `✨ Your partner evolved into ${speciesName(me, st)}!` : `⬆ Your partner grew to level ${after}!`, 3600);
    }
    Quests.event('level', { level: after });
  }
}
/* XP from outside a battle (quest rewards) */
const addXp = n => gainXp(n);

/* ---------- results ---------- */
function finish(won) {
  const me = starterSp(), st = stageOf(levelOf(player.xp));
  $('#resTitle').textContent = won ? '🏆 Deck cleared!' : '💫 Your partner needs a rest';
  $('#resSprite').innerHTML = monSVG(me, st);
  const acc = S.right + S.wrong ? Math.round(S.right / (S.right + S.wrong) * 100) : 0;
  $('#resStats').textContent = `Accuracy ${acc}% · Best streak ${S.bestStreak} · Caught ${S.caught.length} · +${player.xp - S.startXp} XP`;
  const cg = $('#resCaught'); cg.innerHTML = '';
  S.caught.forEach(c => { const d = document.createElement('div'); d.className = 'sprite tiny' + (c.shiny ? ' shiny' : ''); d.innerHTML = monSVG(c.sp, 0); cg.appendChild(d); });
  const ms = $('#resMissed'); ms.innerHTML = '';
  if (S.missed.size) {
    const h = document.createElement('h3'); h.textContent = 'Review these:'; ms.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'missed';
    S.missed.forEach(c => { const li = document.createElement('li'); li.textContent = c.q + '  →  ' + c.a; ul.appendChild(li); });
    ms.appendChild(ul);
  }
  const idx = S.deckIndex;
  $('#againBtn').onclick = () => startSession(idx);
  S.current = null;
  show('result');
}

$('#runBtn').onclick = () => { if (S && confirm('Run away from the battle?')) { if (S.world) endEncounter('ran'); else finish(false); } };
$('#resHome').onclick = goHome;

/* ---------- dex ---------- */
function renderDex() {
  const g = $('#dexGrid'); g.innerHTML = '';
  let n = 0;
  ALL_SPECIES.forEach(sp => {
    const got = player.dex[sp.id] || (sp.id === player.starter ? 1 : 0);
    if (got) n++;
    const d = document.createElement('div'); d.className = 'card dexcell' + (got ? '' : ' locked');
    d.innerHTML = `<div class="sprite small${player.shiny[sp.id] ? ' shiny' : ''}">${monSVG(sp, 0)}</div>`;
    const nm = document.createElement('strong'); nm.textContent = got ? sp.name : '???';
    const info = document.createElement('div'); info.className = 'sub';
    info.textContent = got ? `${sp.type} · caught ×${player.dex[sp.id] || 1}${player.shiny[sp.id] ? ' ★' : ''}` : 'Not found yet · try ' + (World.zonesFor(sp.id)[0] || 'the wild');
    d.append(nm, info);
    if (got) {
      const isMe = starterSp().id === sp.id;
      if (isMe) d.classList.add('ispartner');
      const b = document.createElement('button');
      b.className = isMe ? 'ghost' : ''; b.disabled = isMe;
      b.textContent = isMe ? '⭐ Your partner' : '🤝 Make partner';
      b.onclick = () => { setPartner(sp.id); renderDex(); };
      d.appendChild(b);
    }
    g.appendChild(d);
  });
  $('#dexCount').textContent = `${n} / ${ALL_SPECIES.length} discovered`;
  show('dex');
}

/* ---------- nav ---------- */
$('#btnHome').onclick = () => { if (S && battleActive() && !confirm('Leave this battle?')) return; leaveWorldBattle(); goHome(); };
$('#btnWorld').onclick = () => { if (S && battleActive() && !confirm('Leave this battle?')) return; leaveWorldBattle(); enterWorld(); };
$('#btnDex').onclick = () => { if (S && battleActive() && !confirm('Leave this battle?')) return; leaveWorldBattle(); renderDex(); };
$('#btnMute').onclick = () => { muted = !muted; store.set('muted', muted); $('#btnMute').textContent = muted ? '🔇' : '🔊'; };
$('#btnMute').textContent = muted ? '🔇' : '🔊';

goHome();
