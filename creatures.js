'use strict';
/* Original creatures, drawn as SVG so no image files are needed. */

const STARTERS = [
  { id: 'embit',    names: ['Embit', 'Blazeon', 'Infernox'],      type: 'Fire',  c: '#ff8a4c', d: '#ffd36b', ear: 'flame', tail: 'flame', emoji: '🔥' },
  { id: 'droplet',  names: ['Droplet', 'Tidalor', 'Maelstrom'],   type: 'Water', c: '#5aa9ff', d: '#c5e7ff', ear: 'fin',   tail: 'fin',   emoji: '💧' },
  { id: 'sproutle', names: ['Sproutle', 'Bloomtail', 'Verdantus'], type: 'Grass', c: '#6fcf6f', d: '#e0f7a8', ear: 'leaf',  tail: 'leaf',  emoji: '🍃' }
];

const WILD = [
  { id: 'zapkit',   name: 'Zapkit',   type: 'Electric', c: '#ffd93b', d: '#fff3a8', ear: 'point', tail: 'bolt',  emoji: '⚡' },
  { id: 'pebblu',   name: 'Pebblu',   type: 'Rock',     c: '#a8a095', d: '#d9d4cb', ear: 'round', tail: 'none',  emoji: '🪨' },
  { id: 'frostail', name: 'Frostail', type: 'Ice',      c: '#9fe3ff', d: '#ffffff', ear: 'point', tail: 'fluff', emoji: '❄️' },
  { id: 'shadowl',  name: 'Shadowl',  type: 'Ghost',    c: '#8e6bd6', d: '#d9c8ff', ear: 'horn',  tail: 'curl',  emoji: '👻' },
  { id: 'fluffet',  name: 'Fluffet',  type: 'Normal',   c: '#f4b6c8', d: '#fff0f4', ear: 'round', tail: 'fluff', emoji: '✨' },
  { id: 'dracky',   name: 'Dracky',   type: 'Dragon',   c: '#2fb7a0', d: '#b8f2e6', ear: 'horn',  tail: 'curl',  emoji: '🐉' },
  { id: 'buzzle',   name: 'Buzzle',   type: 'Bug',      c: '#b5d334', d: '#f2fab0', ear: 'leaf',  tail: 'bolt',  emoji: '🐛' },
  { id: 'mudgy',    name: 'Mudgy',    type: 'Ground',   c: '#b98a5a', d: '#ecd2b0', ear: 'round', tail: 'curl',  emoji: '🌍' },
  { id: 'glimmer',  name: 'Glimmer',  type: 'Fairy',    c: '#ff9be0', d: '#ffe3f7', ear: 'fin',   tail: 'fluff', emoji: '🌟' },

  /* ---- Sunny Meadows ---- */
  { id: 'bunbloom', name: 'Bunbloom', type: 'Grass',    c: '#c9e8a0', d: '#fff6c9', ear: 'petal', tail: 'fluff', mark: 'spots',   emoji: '🌼' },
  { id: 'chippa',   name: 'Chippa',   type: 'Normal',   c: '#c89b6d', d: '#f6e2c4', ear: 'round', tail: 'curl',  mark: 'stripes', emoji: '🌰' },
  /* ---- Whisperwood ---- */
  { id: 'owlet',    name: 'Owlet',    type: 'Flying',   c: '#a98467', d: '#f0ead2', ear: 'horn',  tail: 'fluff', mark: 'spots',   emoji: '🦉' },
  { id: 'fernix',   name: 'Fernix',   type: 'Grass',    c: '#3fa56a', d: '#c8f2d4', ear: 'leaf',  tail: 'leaf',  mark: 'stripes', emoji: '🌿' },
  { id: 'fungloo',  name: 'Fungloo',  type: 'Grass',    c: '#c4503f', d: '#fff4e6', ear: 'cap',   tail: 'curl',  mark: 'spots',   emoji: '🍄' },
  /* ---- Frostfen Tundra ---- */
  { id: 'icicle',   name: 'Icicle',   type: 'Ice',      c: '#bfe9ff', d: '#ffffff', ear: 'spike', tail: 'crystal', mark: 'gem',   emoji: '🧊' },
  { id: 'polarbo',  name: 'Polarbo',  type: 'Ice',      c: '#f0f6ff', d: '#cfe4f7', ear: 'round', tail: 'fluff', emoji: '🐻‍❄️' },
  { id: 'aurorix',  name: 'Aurorix',  type: 'Psychic',  c: '#7be8d0', d: '#d8b8ff', ear: 'petal', tail: 'wave',  mark: 'gem', hp: 4, emoji: '🌌' },
  /* ---- Crag Heights ---- */
  { id: 'ironclad', name: 'Ironclad', type: 'Steel',    c: '#8fa0b4', d: '#dfe6ee', ear: 'round', tail: 'club',  mark: 'belt',    emoji: '🛡️' },
  { id: 'goaten',   name: 'Goaten',   type: 'Rock',     c: '#b9a98f', d: '#f1e8d6', ear: 'horn',  tail: 'none',  mark: 'stripes', emoji: '🐐' },
  /* ---- Dusty Dunes ---- */
  { id: 'cactoo',   name: 'Cactoo',   type: 'Grass',    c: '#5fb86a', d: '#e9f7b0', ear: 'cactus', tail: 'spike', mark: 'spots',  emoji: '🌵' },
  { id: 'sandsnip', name: 'Sandsnip', type: 'Ground',   c: '#e2b86b', d: '#fff0c8', ear: 'spike', tail: 'curl',  mark: 'stripes', emoji: '🦂' },
  { id: 'scorchit', name: 'Scorchit', type: 'Fire',     c: '#e8743b', d: '#ffd9a0', ear: 'point', tail: 'spike', mark: 'stripes', emoji: '🔆' },
  { id: 'mirageo',  name: 'Mirageo',  type: 'Psychic',  c: '#c58cff', d: '#ffe9b0', ear: 'crystal', tail: 'wave', mark: 'gem',   emoji: '🔮' },
  { id: 'sphinxel', name: 'Sphinxel', type: 'Rock',     c: '#d7b45a', d: '#fff2c0', ear: 'horn',  tail: 'club',  mark: 'gem', hp: 4, emoji: '🏜️' },
  /* ---- Murkmire Swamp ---- */
  { id: 'mossmuk',  name: 'Mossmuk',  type: 'Poison',   c: '#7a8f3a', d: '#d8e6a0', ear: 'leaf',  tail: 'curl',  mark: 'spots',   emoji: '🐊' },
  { id: 'bogbub',   name: 'Bogbub',   type: 'Water',    c: '#4f9a8a', d: '#c5f0e0', ear: 'round', tail: 'wave',  mark: 'spots',   emoji: '🐸' },
  { id: 'glowmoth', name: 'Glowmoth', type: 'Bug',      c: '#e8e08a', d: '#fffbd0', ear: 'antenna', tail: 'fluff', mark: 'gem',   emoji: '🦋' },
  { id: 'willowisp', name: 'Willowisp', type: 'Ghost',  c: '#6fe0c0', d: '#ffffff', ear: 'antenna', tail: 'wave', hp: 4,          emoji: '🕯️' },
  /* ---- Ember Peaks ---- */
  { id: 'magmole',  name: 'Magmole',  type: 'Fire',     c: '#b5452a', d: '#ffb36b', ear: 'spike', tail: 'club',  mark: 'spots',   emoji: '🌋' },
  { id: 'cinderpup', name: 'Cinderpup', type: 'Fire',   c: '#ff6a3d', d: '#ffd36b', ear: 'flame', tail: 'flame',                   emoji: '🐕' },
  { id: 'obsidot',  name: 'Obsidot',  type: 'Dark',     c: '#4a4150', d: '#ff7a2e', ear: 'crystal', tail: 'spike', mark: 'gem',   emoji: '⬛' },
  { id: 'ashbat',   name: 'Ashbat',   type: 'Flying',   c: '#6b5a6b', d: '#ffb08a', ear: 'point', tail: 'spike',                   emoji: '🦇' },
  { id: 'pyrodrake', name: 'Pyrodrake', type: 'Dragon', c: '#d83a2e', d: '#ffb347', ear: 'horn',  tail: 'flame', mark: 'gem', hp: 4, emoji: '🔥' },
  /* ---- Sunset Shores ---- */
  { id: 'shellby',  name: 'Shellby',  type: 'Water',    c: '#ffb48a', d: '#fff0e0', ear: 'cap',   tail: 'none',  mark: 'stripes', emoji: '🐚' },
  { id: 'crabbit',  name: 'Crabbit',  type: 'Water',    c: '#ff6b5e', d: '#ffd9c8', ear: 'claw',  tail: 'none',                    emoji: '🦀' },
  { id: 'starfin',  name: 'Starfin',  type: 'Water',    c: '#ffd35e', d: '#fff3b0', ear: 'petal', tail: 'fin',   mark: 'gem',     emoji: '⭐' },
  { id: 'breezo',   name: 'Breezo',   type: 'Flying',   c: '#8fd3ff', d: '#ffffff', ear: 'fin',   tail: 'fin',                     emoji: '🕊️' },
  { id: 'leviathi', name: 'Leviathi', type: 'Water',    c: '#2f6fd8', d: '#a8e0ff', ear: 'fin',   tail: 'fin',   mark: 'stripes', hp: 4, emoji: '🐋' },
  /* ---- Blossom Grove ---- */
  { id: 'petalune', name: 'Petalune', type: 'Fairy',    c: '#ffb3d1', d: '#fff0f6', ear: 'petal', tail: 'fluff', mark: 'gem',     emoji: '🌸' },
  { id: 'cherrub',  name: 'Cherrub',  type: 'Grass',    c: '#f48fb1', d: '#ffe0ec', ear: 'round', tail: 'leaf',  mark: 'spots',   emoji: '🍒' },
  { id: 'mochikin', name: 'Mochikin', type: 'Normal',   c: '#fff0f5', d: '#ffd1e1', ear: 'round', tail: 'fluff',                   emoji: '🍡' },
  { id: 'windlet',  name: 'Windlet',  type: 'Flying',   c: '#c9f0e8', d: '#ffffff', ear: 'fin',   tail: 'wave',                    emoji: '🍃' },
  { id: 'blossomane', name: 'Blossomane', type: 'Fairy', c: '#e58cd8', d: '#fff3b0', ear: 'petal', tail: 'leaf',  mark: 'gem', hp: 4, emoji: '💮' },
  /* ---- Crystal Caverns ---- */
  { id: 'gemling',  name: 'Gemling',  type: 'Crystal',  c: '#8f7cff', d: '#d9d2ff', ear: 'crystal', tail: 'crystal', mark: 'gem', emoji: '💎' },
  { id: 'quartzy',  name: 'Quartzy',  type: 'Rock',     c: '#e8e0f0', d: '#b8f0ff', ear: 'crystal', tail: 'club',  mark: 'spots', emoji: '🔷' },
  { id: 'lumibat',  name: 'Lumibat',  type: 'Ghost',    c: '#4a3f7a', d: '#9bf0ff', ear: 'point', tail: 'wave',  mark: 'gem',     emoji: '🦇' },
  { id: 'amethyl',  name: 'Amethyl',  type: 'Psychic',  c: '#b36bff', d: '#ffd6ff', ear: 'horn',  tail: 'curl',                    emoji: '🟣' },
  { id: 'prismaw',  name: 'Prismaw',  type: 'Dragon',   c: '#4fd8ff', d: '#ffd1ff', ear: 'crystal', tail: 'crystal', mark: 'gem', hp: 4, emoji: '🌈' }
];

const ALL_SPECIES = [...STARTERS.map(s => ({ ...s, name: s.names[0] })), ...WILD];

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function monSVG(sp, stage = 0) {
  const c = sp.c, d = sp.d, dk = shade(c, -35);
  let s = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="mon">';
  s += '<ellipse cx="60" cy="108" rx="30" ry="6" fill="rgba(0,0,0,.18)"/>';

  // wings (final stage)
  if (stage >= 2) {
    s += `<path d="M30 66 Q4 40 12 28 Q30 38 40 56Z" fill="${d}" stroke="${dk}" stroke-width="2"/>`;
    s += `<path d="M90 66 Q116 40 108 28 Q90 38 80 56Z" fill="${d}" stroke="${dk}" stroke-width="2"/>`;
  }

  // tail
  switch (sp.tail) {
    case 'flame': s += `<path d="M88 90 Q116 84 108 52 Q98 70 84 74Z" fill="#ff7a2e"/><path d="M92 86 Q108 80 104 62 Q98 74 88 78Z" fill="#ffe066"/>`; break;
    case 'fin':   s += `<path d="M88 90 L112 76 L110 104Z" fill="${dk}"/>`; break;
    case 'leaf':  s += `<path d="M88 92 Q116 90 112 60 Q92 66 88 92Z" fill="${dk}"/><path d="M92 88 Q106 80 108 66" stroke="${d}" stroke-width="2" fill="none"/>`; break;
    case 'bolt':  s += `<path d="M86 84 L108 74 L98 86 L114 82 L90 100Z" fill="${dk}" stroke="${c}" stroke-width="1"/>`; break;
    case 'curl':  s += `<path d="M86 94 Q116 100 112 72 Q108 62 100 70" stroke="${dk}" stroke-width="7" fill="none" stroke-linecap="round"/>`; break;
    case 'fluff': s += `<circle cx="98" cy="88" r="12" fill="${d}" stroke="${dk}" stroke-width="2"/>`; break;
    case 'spike': s += `<path d="M86 96 L116 92 L92 84Z M88 86 L112 70 L94 76Z M90 80 L104 58 L92 72Z" fill="${dk}" stroke="${c}" stroke-width="1"/>`; break;
    case 'club':  s += `<path d="M86 94 Q96 96 102 88" stroke="${dk}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="106" cy="84" r="11" fill="${dk}" stroke="${c}" stroke-width="1.5"/><circle cx="103" cy="81" r="3" fill="${d}" opacity=".7"/>`; break;
    case 'wave':  s += `<path d="M86 94 Q98 106 104 92 T118 84" stroke="${d}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M86 94 Q98 106 104 92 T118 84" stroke="${dk}" stroke-width="2" fill="none" stroke-linecap="round"/>`; break;
    case 'crystal': s += `<path d="M88 94 L102 62 L110 96Z" fill="${d}" stroke="${dk}" stroke-width="2"/><path d="M102 62 L106 96" stroke="${dk}" stroke-width="1.5"/>`; break;
  }

  // ears / head decorations (drawn behind body)
  switch (sp.ear) {
    case 'point': s += `<path d="M34 42 L40 8 L58 34Z" fill="${c}" stroke="${dk}" stroke-width="2"/><path d="M86 42 L80 8 L62 34Z" fill="${c}" stroke="${dk}" stroke-width="2"/><path d="M38 34 L41 16 L50 32Z" fill="${dk}"/><path d="M82 34 L79 16 L70 32Z" fill="${dk}"/>`; break;
    case 'round': s += `<circle cx="36" cy="38" r="13" fill="${c}" stroke="${dk}" stroke-width="2"/><circle cx="84" cy="38" r="13" fill="${c}" stroke="${dk}" stroke-width="2"/><circle cx="36" cy="38" r="6" fill="${d}"/><circle cx="84" cy="38" r="6" fill="${d}"/>`; break;
    case 'horn':  s += `<path d="M38 40 Q28 18 40 8 Q46 24 52 36Z" fill="${d}" stroke="${dk}" stroke-width="2"/><path d="M82 40 Q92 18 80 8 Q74 24 68 36Z" fill="${d}" stroke="${dk}" stroke-width="2"/>`; break;
    case 'leaf':  s += `<ellipse cx="38" cy="30" rx="8" ry="18" transform="rotate(-30 38 30)" fill="${dk}"/><ellipse cx="82" cy="30" rx="8" ry="18" transform="rotate(30 82 30)" fill="${dk}"/>`; break;
    case 'fin':   s += `<path d="M30 52 Q18 30 34 22 Q40 38 46 46Z" fill="${dk}"/><path d="M90 52 Q102 30 86 22 Q80 38 74 46Z" fill="${dk}"/>`; break;
    case 'flame': s += `<path d="M44 40 Q34 18 48 6 Q50 24 58 34Z" fill="#ff7a2e"/><path d="M76 40 Q86 18 72 6 Q70 24 62 34Z" fill="#ff7a2e"/><path d="M48 36 Q44 24 49 16 Q52 26 55 33Z" fill="#ffe066"/>`; break;
    case 'antenna': s += `<path d="M46 40 Q38 22 30 14" stroke="${dk}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M74 40 Q82 22 90 14" stroke="${dk}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="29" cy="13" r="5" fill="${d}" stroke="${dk}" stroke-width="2"/><circle cx="91" cy="13" r="5" fill="${d}" stroke="${dk}" stroke-width="2"/>`; break;
    case 'cap':   s += `<ellipse cx="60" cy="32" rx="38" ry="22" fill="${d}" stroke="${dk}" stroke-width="2.5"/><circle cx="42" cy="26" r="5" fill="${c}"/><circle cx="62" cy="18" r="6" fill="${c}"/><circle cx="80" cy="28" r="4.5" fill="${c}"/>`; break;
    case 'spike': s += `<path d="M42 44 L44 14 L56 38Z M54 38 L60 6 L66 38Z M64 38 L76 14 L78 44Z" fill="${dk}" stroke="${c}" stroke-width="1.5"/>`; break;
    case 'crystal': s += `<path d="M38 44 L34 16 L52 34Z" fill="${d}" stroke="${dk}" stroke-width="2"/><path d="M52 38 L60 2 L68 38Z" fill="${d}" stroke="${dk}" stroke-width="2"/><path d="M68 34 L86 16 L82 44Z" fill="${d}" stroke="${dk}" stroke-width="2"/><path d="M60 2 L60 38" stroke="${dk}" stroke-width="1.2"/>`; break;
    case 'petal': for (const a of [-52, -26, 0, 26, 52]) s += `<ellipse cx="60" cy="22" rx="7" ry="16" transform="rotate(${a} 60 44)" fill="${d}" stroke="${dk}" stroke-width="1.8"/>`; break;
    case 'cactus': s += `<rect x="34" y="14" width="13" height="36" rx="6.5" fill="${dk}"/><rect x="73" y="20" width="13" height="30" rx="6.5" fill="${dk}"/><circle cx="40" cy="12" r="4" fill="#ff7aa8"/><circle cx="80" cy="18" r="4" fill="#ffd23f"/>`; break;
    case 'claw':  s += `<path d="M30 60 Q4 56 8 30 Q14 38 20 36 Q22 28 28 26 Q34 44 40 52Z" fill="${dk}" stroke="${c}" stroke-width="1.5"/><path d="M90 60 Q116 56 112 30 Q106 38 100 36 Q98 28 92 26 Q86 44 80 52Z" fill="${dk}" stroke="${c}" stroke-width="1.5"/>`; break;
  }

  // crest (stage 1+)
  if (stage >= 1) {
    s += `<path d="M48 36 L54 18 L60 32 L66 18 L72 36Z" fill="${d}" stroke="${dk}" stroke-width="2"/>`;
  }

  // body
  s += `<ellipse cx="60" cy="72" rx="36" ry="34" fill="${c}" stroke="${dk}" stroke-width="3"/>`;
  s += `<ellipse cx="60" cy="84" rx="22" ry="20" fill="${d}" opacity=".9"/>`;
  // feet
  s += `<ellipse cx="42" cy="104" rx="11" ry="6" fill="${dk}"/><ellipse cx="78" cy="104" rx="11" ry="6" fill="${dk}"/>`;
  // markings
  switch (sp.mark) {
    case 'stripes': s += `<path d="M28 58 Q38 54 46 50 M92 58 Q82 54 74 50 M25 72 Q36 68 40 64 M95 72 Q84 68 80 64" stroke="${dk}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>`; break;
    case 'spots':   s += `<g fill="${dk}" opacity=".45"><circle cx="34" cy="92" r="5"/><circle cx="88" cy="94" r="6"/><circle cx="60" cy="48" r="4"/><circle cx="82" cy="52" r="3.5"/><circle cx="38" cy="52" r="3.5"/></g>`; break;
    case 'gem':     s += `<path d="M60 42 L67 50 L60 58 L53 50Z" fill="${d}" stroke="${dk}" stroke-width="2"/><path d="M53 50 L67 50" stroke="${dk}" stroke-width="1"/>`; break;
    case 'belt':    s += `<rect x="26" y="88" width="68" height="8" rx="3" fill="${dk}" opacity=".6"/><circle cx="60" cy="92" r="4" fill="${d}"/>`; break;
  }
  // eyes
  s += '<circle cx="46" cy="64" r="8" fill="#fff"/><circle cx="74" cy="64" r="8" fill="#fff"/>';
  s += '<circle cx="48" cy="65" r="4.5" fill="#1d1d2b"/><circle cx="72" cy="65" r="4.5" fill="#1d1d2b"/>';
  s += '<circle cx="50" cy="63" r="1.8" fill="#fff"/><circle cx="74" cy="63" r="1.8" fill="#fff"/>';
  // cheeks + mouth
  s += '<circle cx="34" cy="78" r="5" fill="#ff7a8a" opacity=".55"/><circle cx="86" cy="78" r="5" fill="#ff7a8a" opacity=".55"/>';
  s += '<path d="M53 78 Q60 86 67 78" stroke="#1d1d2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  s += '</svg>';
  return s;
}

function speciesName(sp, stage) { return sp.names ? sp.names[stage] : sp.name; }
