'use strict';
/* Study Quest: the overworld.
   A top-down world you walk around in. Everything is drawn with canvas code (no image files).
   It talks to app.js through a few globals: player, decks, wstate, saveWorld, startEncounter, monSVG, ALL_SPECIES. */

const World = (() => {
  const q = s => document.querySelector(s);
  const TS = 32, W = 128, H = 96, STEP = 0.16, MAPV = 2;
  const K = { FLOOR: 0, TALL: 1, TREE: 2, WATER: 3, PATH: 4, WALL: 5, DOOR: 6, SIGN: 7, FLOWER: 8, LOCKED: 9 };
  const SOLID = [0, 0, 1, 1, 0, 1, 0, 1, 0, 1];
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIRNAMES = Object.keys(DIRS);

  /* Ten regions. Index = biome number. `seeds` are where each region is centred on the map. */
  const ZONES = [
    { name: 'Sunny Meadows', css: 'meadow', blurb: 'Soft grass, flowers and friendly little creatures.', seeds: [[64, 48, 0.72], [40, 72, 1]],
      mons: { fluffet: 4, glimmer: 3, zapkit: 3, buzzle: 3, bunbloom: 4, chippa: 3, embit: 1, droplet: 1, sproutle: 1 } },
    { name: 'Whisperwood', css: 'forest', blurb: 'A dark, leafy forest. Ghosts, bugs and mushrooms love it.', seeds: [[16, 46, 1], [34, 24, 1]],
      mons: { buzzle: 3, shadowl: 3, glimmer: 2, mudgy: 2, sproutle: 2, fluffet: 1, owlet: 3, fernix: 3, fungloo: 3 } },
    { name: 'Frostfen Tundra', css: 'snow', blurb: 'Snow and ice as far as you can see. Brrr!', seeds: [[64, 10, 1]],
      mons: { frostail: 4, icicle: 3, polarbo: 3, droplet: 2, shadowl: 2, pebblu: 2, glimmer: 1, aurorix: 1 } },
    { name: 'Crag Heights', css: 'rock', blurb: 'Rocky ground. Tough creatures live here, and rumour says a rare dragon too.', seeds: [[112, 48, 1]],
      mons: { pebblu: 4, mudgy: 3, ironclad: 3, goaten: 3, zapkit: 2, embit: 2, shadowl: 1, dracky: 1 } },
    { name: 'Dusty Dunes', css: 'desert', blurb: 'A hot, dry desert with cacti and a hidden oasis.', seeds: [[108, 84, 1]],
      mons: { cactoo: 4, sandsnip: 4, scorchit: 3, mirageo: 2, pebblu: 1, zapkit: 1, sphinxel: 1 } },
    { name: 'Murkmire Swamp', css: 'swamp', blurb: 'Gloomy bogs full of slimy, glowing things.', seeds: [[14, 84, 1]],
      mons: { mossmuk: 4, bogbub: 4, fungloo: 3, glowmoth: 3, shadowl: 2, mudgy: 2, buzzle: 1, willowisp: 1 } },
    { name: 'Ember Peaks', css: 'volcano', blurb: 'A volcano! Lava rivers glow between the black rocks.', seeds: [[112, 12, 1]],
      mons: { magmole: 4, cinderpup: 4, obsidot: 3, ashbat: 2, scorchit: 1, embit: 1, zapkit: 1, pyrodrake: 1 } },
    { name: 'Sunset Shores', css: 'beach', blurb: 'Golden sand and a sparkling sea.', seeds: [[66, 88, 1]],
      mons: { shellby: 4, crabbit: 3, starfin: 3, breezo: 3, droplet: 2, glimmer: 1, fluffet: 1, leviathi: 1 } },
    { name: 'Blossom Grove', css: 'blossom', blurb: 'Cherry trees drop pink petals everywhere.', seeds: [[90, 28, 1]],
      mons: { petalune: 4, cherrub: 4, mochikin: 3, windlet: 3, glimmer: 2, buzzle: 1, sproutle: 1, blossomane: 1 } },
    { name: 'Crystal Caverns', css: 'crystal', blurb: 'Glittering crystals hum softly in the dark.', seeds: [[16, 12, 1]],
      mons: { gemling: 4, quartzy: 3, lumibat: 3, amethyl: 3, pebblu: 2, shadowl: 2, prismaw: 1 } },
    { name: 'Study Village', css: 'meadow', mons: {} }
  ];
  const VILLAGE = ZONES.length - 1, NB = VILLAGE;          // NB = number of real biomes
  const CX = 64, CY = 48, OX = CX - 32, OY = CY - 24;      // village centre and offset from the old layout
  const VIL = { x0: 25 + OX, y0: 18 + OY, x1: 39 + OX, y1: 30 + OY };
  const SPAWN = { x: 33 + OX, y: 26 + OY };

  /* Five more villages around the map. Each is a clearing with a street, two houses, a sign and two villagers.
     side = which end of the street the road leaves from, to = which main road it joins ('h' horizontal, 'v' vertical). */
  const VILLAGES = [
    { id: 'pinecrest', name: 'Pinecrest', cx: 30, cy: 36, side: 'e', to: 'h', roofs: ['green', 'teal'], blurb: 'A quiet little village at the edge of Whisperwood.' },
    { id: 'frostholm', name: 'Frostholm', cx: 76, cy: 18, side: 'w', to: 'v', roofs: ['blue', 'teal'], blurb: 'Smoke curls from every chimney in this snowy village.' },
    { id: 'petalburg', name: 'Petalburg', cx: 90, cy: 32, side: 'w', to: 'v', roofs: ['pink', 'purple'], blurb: 'Pink petals drift down the streets of this blossom village.' },
    { id: 'sandrock', name: 'Sandrock', cx: 102, cy: 72, side: 'w', to: 'h', roofs: ['sand', 'orange'], blurb: 'A sun-baked village where everyone owns a hat.' },
    { id: 'reedhaven', name: 'Reedhaven', cx: 22, cy: 78, side: 'e', to: 'h', roofs: ['teal', 'green'], blurb: 'Boardwalks and lanterns on the edge of the Murkmire Swamp.' }
  ];
  VILLAGES.forEach(v => { v.x0 = v.cx - 6; v.x1 = v.cx + 6; v.y0 = v.cy - 4; v.y1 = v.cy + 4; });
  const villageAt = (x, y) => VILLAGES.find(v => x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 - 1 && y <= v.y1 + 1) ||
    (() => { const v = villageNear(x, y); return v && x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 - 1 && y <= v.y1 + 1 ? v : null; })();
  const VILLAGE_NAMES = { study: 'Study Village' }; VILLAGES.forEach(v => VILLAGE_NAMES[v.id] = v.name);
  const REMATCH_MS = 90 * 1000;   // how long a beaten villager needs before another battle

  /* ---------- noise ---------- */
  const imul = Math.imul;
  function hash2(x, y, s) {
    let h = (imul(x | 0, 374761393) + imul(y | 0, 668265263) + imul(s | 0, 1442695041)) | 0;
    h = imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.35;

  /* ---------- map ---------- */
  const kind = new Uint8Array(W * H), biome = new Uint8Array(W * H), vari = new Uint8Array(W * H), bridge = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const inVillage = (x, y) => x >= VIL.x0 && x <= VIL.x1 && y >= VIL.y0 && y <= VIL.y1;
  function zoneAt(x, y) { return inVillage(x, y) ? VILLAGE : biomeAt(x, y); }
  const buildings = [];
  const signs = new Map();
  const npcs = [];

  // per-biome tuning: how many trees/rocks, lakes (or lava), tall grass
  const TREE_T  = [0.70, 0.54, 0.64, 0.66, 0.80, 0.58, 0.64, 0.76, 0.58, 0.60];
  const WATER_T = [0.72, 0.72, 0.72, 0.72, 0.86, 0.60, 0.72, 0.72, 0.72, 0.80];
  const TALL_T  = [0.56, 0.56, 0.56, 0.56, 0.50, 0.50, 0.60, 0.54, 0.55, 0.55];

  /* ---- terrain rules shared by the hand-made core and the endless world ---- */
  const wob = (t, c) => {
    const f = Math.min(1, Math.max(0, (Math.abs(t - c) - 9) / 8));
    return Math.round((Math.sin(t * .21) * 2.4 + Math.sin(t * .09 + 1) * 2.2) * f);
  };
  const CORE_SEEDS = [];
  for (let z = 0; z < NB; z++) for (const [sx, sy, m] of ZONES[z].seeds) CORE_SEEDS.push([sx, sy, m, z]);
  const SC = 44, gseeds = new Map();
  function gridSeed(i, j) {
    const k = i * 262144 + j; let s = gseeds.get(k);
    if (!s) { s = [i * SC + 4 + hash2(i, j, 801) * (SC - 8), j * SC + 4 + hash2(i, j, 802) * (SC - 8), 0.85 + hash2(i, j, 804) * 0.3, (hash2(i, j, 803) * NB) | 0]; gseeds.set(k, s); }
    return s;
  }
  const inCorePatch = s => s[0] > -8 && s[0] < W + 8 && s[1] > -8 && s[1] < H + 8;
  function biomeFor(x, y) {
    // warp the coordinates a little so region borders are wobbly instead of straight
    const wx = x + (fbm(x * .045, y * .045, 11) - .5) * 22, wy = y + (fbm(x * .045 + 40, y * .045 + 40, 12) - .5) * 22;
    let b = 0, best = 1e9;
    for (const [sx, sy, m, z] of CORE_SEEDS) { const d = Math.hypot(wx - sx, wy - sy) * m; if (d < best) { best = d; b = z; } }
    if (x < 0 || y < 0 || x >= W || y >= H) {            // outside the hand-made map: more regions, made up from a jittered grid
      const i0 = Math.floor(wx / SC), j0 = Math.floor(wy / SC);
      for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
        const sd = gridSeed(i, j);
        if (inCorePatch(sd)) continue;
        const d = Math.hypot(wx - sd[0], wy - sd[1]) * sd[2];
        if (d < best) { best = d; b = sd[3]; }
      }
    }
    return b;
  }
  function terrainKind(x, y, b) {
    const nT = fbm(x * .22, y * .22, 21), nG = fbm(x * .15 + 9, y * .15 + 3, 31), nW = fbm(x * .1, y * .1, 41);
    if (nW > WATER_T[b]) return K.WATER;
    if (b === 7 && y > H - 15 + fbm(x * .12, 5, 51) * 6 && y < H + 30) return K.WATER;      // the sea along the south edge
    if (nT > TREE_T[b]) return K.TREE;
    if (nG > TALL_T[b]) return K.TALL;
    if (b === 0 && hash2(x, y, 5) < 0.05) return K.FLOWER;
    if (b === 8 && hash2(x, y, 5) < 0.10) return K.FLOWER;
    return K.FLOOR;
  }

  (function generate() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const b = biomeFor(x, y);
      biome[i] = b; vari[i] = (hash2(x, y, 3) * 4) | 0;
      kind[i] = terrainKind(x, y, b);
    }
    // village clearing
    for (let y = VIL.y0; y <= VIL.y1; y++) for (let x = VIL.x0; x <= VIL.x1; x++) {
      const i = idx(x, y); biome[i] = 0; kind[i] = hash2(x, y, 6) < 0.06 ? K.FLOWER : K.FLOOR;
    }
    // roads (2 tiles wide, wobbling outside the village)
    const road = (x, y) => {
      if (!inB(x, y)) return;
      const i = idx(x, y);
      if (kind[i] === K.WATER) bridge[i] = 1;
      kind[i] = K.PATH;
    };
    for (let x = 0; x < W; x++) { const y = CY + wob(x, CX); road(x, y); road(x, y + 1); }
    for (let y = 0; y < H; y++) { const x = CX + wob(y, CY); road(x, y); road(x + 1, y); }
    // villages: clear the ground, lay a street, and join it to the nearest main road
    for (const v of VILLAGES) {
      for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) kind[idx(x, y)] = hash2(x, y, 6) < 0.06 ? K.FLOWER : K.FLOOR;
      for (let x = v.x0; x <= v.x1; x++) { road(x, v.cy); road(x, v.cy + 1); }
      const endX = v.side === 'w' ? v.x0 - 1 : v.x1 + 1;
      if (v.to === 'v') {
        const rx = CX + wob(v.cy, CY) + 1;
        for (let x = Math.min(endX, rx); x <= Math.max(endX, rx); x++) { road(x, v.cy); road(x, v.cy + 1); }
      } else {
        const ry = CY + wob(endX, CX) + 1, xs = v.side === 'w' ? [endX - 1, endX] : [endX, endX + 1];
        for (let y = Math.min(v.cy, ry); y <= Math.max(v.cy + 1, ry); y++) xs.forEach(x => road(x, y));
      }
    }
    // keep trees from crowding the roads
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (kind[idx(x, y)] !== K.PATH) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inB(nx, ny)) continue;
        if (kind[idx(nx, ny)] === K.TREE) kind[idx(nx, ny)] = K.FLOOR;
      }
    }
    // buildings (5x3): healer + 3 houses
    const build = (bx, by, type) => {
      buildings.push({ x: bx, y: by, w: 5, h: 3, type });
      for (let y = by; y < by + 3; y++) for (let x = bx; x < bx + 5; x++) kind[idx(x, y)] = K.WALL;
      kind[idx(bx + 2, by + 2)] = type === 'healer' ? K.DOOR : K.LOCKED;
    };
    build(26 + OX, 19 + OY, 'healer'); build(34 + OX, 19 + OY, 'blue'); build(26 + OX, 27 + OY, 'orange'); build(34 + OX, 27 + OY, 'purple');
    // signs
    const sign = (x, y, text) => { kind[idx(x, y)] = K.SIGN; signs.set(idx(x, y), text); };
    sign(31 + OX, 16 + OY, ['⬆ North: Frostfen Tundra', 'Icy creatures live out here. Far to the north-east is the fiery Ember Peaks, and to the north-west the glittering Crystal Caverns.']);
    sign(31 + OX, 32 + OY, ['⬇ South: Sunset Shores', 'Sandy beaches and sea creatures. South-west is the gloomy Murkmire Swamp, and south-east the Dusty Dunes desert.']);
    sign(41 + OX, 23 + OY, ['➡ East: Crag Heights', 'Rocky ground. Tough creatures live here, and rumour says a rare dragon too. The pink Blossom Grove is to the north-east.']);
    sign(23 + OX, 23 + OY, ['⬅ West: Whisperwood', 'A dark, leafy forest. Ghosts and bugs love it. Sunny Meadows stretch to the south-west.']);
    // a welcome sign near the middle of every faraway region
    for (let z = 0; z < NB; z++) {
      const [sx, sy] = ZONES[z].seeds[0];
      if (z === 0) continue;
      let done = false;
      for (let r = 0; r < 14 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = sx + dx, y = sy + dy;
        if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4 || !inB(x, y)) continue;
        const i = idx(x, y);
        if (biome[i] !== z || kind[i] !== K.FLOOR) continue;
        // keep it off the road and on open ground
        let ok = true;
        for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (kind[idx(x + ex, y + ey)] !== K.FLOOR) ok = false;
        if (!ok) continue;
        sign(x, y, ['Welcome to ' + ZONES[z].name, ZONES[z].blurb, 'New creatures hide here. Walk through the tall grass and watch the wanderers!']);
        done = true;
      }
    }
    // people
    npcs.push({ id: 'quill', village: 'study', greet: 'Ah, a fellow scholar! What can I do for you?', x: 30 + OX, y: 23 + OY, dir: 'right', name: 'Professor Quill', look: { shirt: '#f3f3f3', hair: '#b8b8b8', skin: '#f1c9a0', cap: null }, lines: [
      'Welcome to Study Quest! Walk with the arrow keys or WASD.',
      'Wild creatures roam the world, and more hide in the tall grass. Bump into one to start a battle.',
      'In a battle, answer questions from your study deck to attack. Wrong answers cost hearts!',
      'The world is huge: ten regions, from deserts and swamps to volcanoes and crystal caves. Every region has its own creatures.',
      'Defeat a creature and it joins your Studydex. Your partner levels up and evolves as you learn.'] });
    npcs.push({ id: 'nurse', village: 'study', greet: 'Hello, dear. Feeling tired?', x: 30 + OX, y: 22 + OY, dir: 'down', name: 'Nurse Joy-ish', look: { shirt: '#ff9fb5', hair: '#ff9fb5', skin: '#f6d2b0', cap: '#ffffff' }, lines: [
      'This is the Study Center. Walk through the red door and your partner is fully rested!',
      'You also recover a heart every so often as you walk.'] });
    npcs.push({ id: 'bookworm', village: 'study', greet: 'Shh! ...oh, hello. I was in the middle of a chapter.', battle: { sp: 'chippa', hp: 4, intro: 'A study battle? I have read EVERYTHING. Let us see about that!' },
      x: 36 + OX, y: 26 + OY, dir: 'left', name: 'Bookworm', look: { shirt: '#6bb26b', hair: '#5b3a1e', skin: '#e0ac7c', cap: null }, lines: [
      'Tip: the same cards come back if you get them wrong, so keep going!',
      'Open 📝 Review any time to see the cards you still need to learn.',
      'Spelling slips are fine, and you can leave out little words like “the”. Long answers can be shortened, and in a list any one item counts.'] });
    npcs.push({ id: 'maple', village: 'study', greet: 'Welcome to our village! I am the mayor.', battle: { sp: 'fluffet', hp: 5, intro: 'Mayor Maple has never lost a study battle in this village. Ready?' },
      x: 28 + OX, y: 26 + OY, dir: 'right', name: 'Mayor Maple', look: { shirt: '#d9a43a', hair: '#8a4b2a', skin: '#f1c9a0', cap: '#7a3b9a' }, lines: [
      'Study Village is the heart of the world. People come here from all over to learn.',
      'Press M any time to open the big map. You will find five more villages out there, and each has people who need help.',
      'Villagers with a yellow ! above their heads have a quest for you. A grey ? means you are on it, and a gold ? means hand it in.'] });
    npcs.push({ id: 'pip', village: 'study', greet: 'Hi hi hi! Did you see the big map? (Press M!)', battle: { sp: 'zapkit', hp: 3, intro: 'Ooh, a battle! I will go easy on you. Maybe.' },
      x: 36 + OX, y: 22 + OY, dir: 'down', name: 'Kid Pip', look: { shirt: '#4aa3e0', hair: '#2b2b2b', skin: '#e0ac7c', cap: '#ff7a3d' }, lines: [
      'I want to be a Studydex master when I grow up!',
      'My cousin Hazel lives in Pinecrest, far to the west. It is so far!'] });

    // villages: houses, sign and villagers
    VILLAGES.forEach(v => {
      build(v.cx - 5, v.cy - 3, v.roofs[0]); build(v.cx + 1, v.cy - 3, v.roofs[1]);
      sign(v.cx - 1, v.cy + 3, ['Welcome to ' + v.name + '!', v.blurb, 'Villagers here have quests for you and love a friendly study battle.']);
    });
    const person = (vid, id, dx, dy, name, look, greet, lines, battle) => {
      const v = VILLAGES.find(t => t.id === vid);
      npcs.push({ id, village: vid, greet, x: v.cx + dx, y: v.cy + dy, dir: 'down', name, look, lines, battle });
    };
    // Pinecrest
    person('pinecrest', 'hazel', -3, 2, 'Hazel the Forager', { shirt: '#6aa84f', hair: '#c0602a', skin: '#f1c9a0', cap: '#3d7a3a' }, 'Oh! A visitor. Mind the mushrooms.', [
      'Welcome to Pinecrest! We live between the trees so the forest creatures are our neighbours.',
      'If you hear rustling in the tall grass, a creature is probably hiding there.']);
    person('pinecrest', 'fennel', 3, 2, 'Old Fennel', { shirt: '#8a5a2b', hair: '#d8d8d8', skin: '#e0ac7c', cap: null }, 'Hm? Oh, a young scholar. Sit, sit.', [
      'Sixty years in these woods, and I still learn something new every day.',
      'Every wrong answer is just a lesson in disguise.'], { sp: 'owlet', hp: 4, intro: 'Come, test your wits against an old owl keeper.' });
    // Frostholm
    person('frostholm', 'nils', -3, 2, 'Nils the Ice Fisher', { shirt: '#3a74c4', hair: '#e8e8e8', skin: '#f1c9a0', cap: '#d9534f' }, 'Brr! Cold enough for you?', [
      'I fish through the ice every morning. The fish here are very, very patient.',
      'Frostholm is the northernmost village on the map. Beyond here it is just snow.'], { sp: 'frostail', hp: 4, intro: 'Heh. Let us warm up with a study battle.' });
    person('frostholm', 'ingrid', 3, 2, 'Ingrid the Baker', { shirt: '#f2f2f2', hair: '#e7c36a', skin: '#f6d2b0', cap: '#ffffff' }, 'Fresh bread! Well. Fresh-ish.', [
      'Nothing beats hot bread on a snowy day.',
      'My secret ingredient is focus. You should try some.'], { sp: 'polarbo', hp: 5, intro: 'I knead to win! Get it? Kneed? Let us battle!' });
    // Petalburg
    person('petalburg', 'sakura', -3, 2, 'Sakura', { shirt: '#ff8fb8', hair: '#3a2a3a', skin: '#f6d2b0', cap: null }, 'Welcome to Petalburg! Isn’t it pretty?', [
      'The petals never stop falling. I stopped sweeping years ago.',
      'My favourite creatures are the little pink ones. Obviously.'], { sp: 'cherrub', hp: 4, intro: 'A friendly study battle among the blossoms? Yes please!' });
    person('petalburg', 'momo', 3, 2, 'Old Momo', { shirt: '#9a6bd0', hair: '#f0f0f0', skin: '#e0ac7c', cap: null }, 'Hello dear. Speak up, I am a bit deaf.', [
      'I have never left Petalburg. Not once!',
      'But I love hearing about other places.'], { sp: 'mochikin', hp: 4, intro: 'Oh, a battle! My knees say no but my brain says yes.' });
    // Sandrock
    person('sandrock', 'cora', -3, 2, 'Cacti Cora', { shirt: '#e08a2e', hair: '#5a2a1a', skin: '#c68a5a', cap: '#e8c46a' }, 'Howdy, traveller. Drink some water.', [
      'The sun here is no joke. Always carry water and a hat.',
      'Cacti are friendly once you get to know them. Mostly.'], { sp: 'cactoo', hp: 5, intro: 'I am the sharpest scholar in the desert. Prove otherwise!' });
    person('sandrock', 'rasheed', 3, 2, 'Rasheed the Trader', { shirt: '#2a9a8a', hair: '#1f1f1f', skin: '#c68a5a', cap: '#f0e6d0' }, 'Ah, a customer! Or a friend. Either is good.', [
      'I trade between all the villages. Everyone has something to sell and nobody has the right change.',
      'A sandstorm took my map once. That is why I remember everything now.'], { sp: 'sandsnip', hp: 4, intro: 'A battle of wits! Winner buys lunch.' });
    // Reedhaven
    person('reedhaven', 'moss', -3, 2, 'Old Moss', { shirt: '#5a7a3a', hair: '#9a9a8a', skin: '#e0ac7c', cap: '#4a5a2a' }, 'Careful where you step, young one.', [
      'The swamp looks scary but it is just misunderstood.',
      'Glowing things? Those are friends. Probably.'], { sp: 'mossmuk', hp: 5, intro: 'Ha ha! Swamp rules: no slipping up!' });
    person('reedhaven', 'tilly', 3, 2, 'Tilly', { shirt: '#c45a8a', hair: '#2a1a4a', skin: '#f1c9a0', cap: null }, 'Hiya! Wanna see my pet frog?', [
      'I named my frog Professor Hops. He knows all the answers.',
      'He does not say them though.'], { sp: 'bogbub', hp: 3, intro: 'Okay okay, a battle! Do not tell Professor Hops.' });
  })();

  const npcMap = new Map(), npcIdMap = new Map();
  const nkey = (x, y) => (x + 500000) * 1000003 + (y + 500000);
  function addNpc(n) { npcs.push(n); npcMap.set(nkey(n.x, n.y), n); if (n.id) npcIdMap.set(n.id, n); }
  npcs.forEach(n => { npcMap.set(nkey(n.x, n.y), n); if (n.id) npcIdMap.set(n.id, n); });
  const npcAt = (x, y) => npcMap.get(nkey(x, y));

  /* ================= the endless world =================
     The hand-made map above is the "core". Everything outside it is made up on the spot, one 16x16 chunk at a time,
     from the same kind of noise, so you can walk in any direction for ever. Same seed = same world, so it never changes. */
  const VC = 64, BLK = 8;
  const ckey = (a, b) => a * 262144 + b;
  const chunks = new Map(), vcache = new Map();
  const GEN_V = [];                                       // villages made up while exploring (in the order they appeared)
  const hwY = x => CY + wob(x, CX), hwX = y => CX + wob(y, CY);
  const hp = (arr, a, b, sd) => arr[(hash2(a, b, sd) * arr.length) | 0];

  const V_A = ['Oak', 'Pine', 'Mist', 'Brook', 'Stone', 'Sun', 'Moon', 'Rose', 'Fern', 'Hazel', 'Ash', 'Elder', 'Wren', 'Tide', 'Frost', 'Amber', 'Willow', 'Maple', 'Cedar', 'Lark', 'Thistle', 'Marsh', 'Birch', 'Clover'];
  const V_B = ['ford', 'wick', 'ton', 'dale', 'haven', 'holm', 'ridge', 'stead', 'mere', 'vale', 'burg', 'field', 'brook', 'gate'];
  const ROOFS = ['green', 'teal', 'blue', 'pink', 'purple', 'sand', 'orange'];
  const JOBS = ['Baker', 'Fisher', 'Scholar', 'Gardener', 'Trader', 'Ranger', 'Potter', 'Beekeeper', 'Weaver', 'Lamplighter', 'Cartographer', 'Sailor', 'Shepherd', 'Clockmaker'];
  const FIRSTS = ['Ada', 'Bram', 'Cleo', 'Dov', 'Elio', 'Fay', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kit', 'Lena', 'Milo', 'Nora', 'Otto', 'Pia', 'Quin', 'Rosa', 'Sol', 'Tess', 'Uma', 'Vik', 'Wren', 'Yara', 'Zed'];
  const SHIRTS = ['#e8504a', '#4aa3e0', '#6bb26b', '#d9a43a', '#9a6bd0', '#e08a2e', '#2a9a8a', '#c45a8a', '#f2f2f2', '#3a74c4'];
  const HAIRS = ['#2b2b2b', '#5b3a1e', '#c0602a', '#e7c36a', '#d8d8d8', '#3a2a3a', '#8a4b2a'];
  const SKINS = ['#f1c9a0', '#e0ac7c', '#c68a5a', '#f6d2b0', '#a9744a'];
  const CAPS = [null, null, '#d9534f', '#3d7a3a', '#7a3b9a', '#e8c46a', '#2a5bd7'];
  const GREETS = ['Oh, hello there, traveller!', 'A visitor! Come in, come in.', 'Well met! Heading far?', 'Ah, you look like someone who studies.', 'Hello! Lovely day for learning.', 'Welcome to {v}!'];
  const LINES = [
    'The {z} is just around here. Mind the creatures!', 'I have lived in {v} all my life.', 'Travellers keep passing through. The world is bigger than anyone thinks.',
    'If you walk far enough, you will find new regions with new creatures.', 'Every wrong answer is just a lesson in disguise.', 'I never get tired of watching the clouds roll over {v}.',
    'They say there are villages out there nobody has found yet.', 'Press M to see where you have been. The map fills in as you explore.',
    'A study battle sharpens the mind. Care to try one?', 'The creatures around here love the tall grass. So do I, actually.', 'My grandmother said the world has no edge. I believe her.'];
  function seededSpecies(zi, r) {
    const t = ZONES[zi].mons, ids = Object.keys(t); let tot = 0; ids.forEach(i => tot += t[i]);
    let x = r * tot; for (const id of ids) { x -= t[id]; if (x <= 0) return id; } return ids[0];
  }
  function makeNpc(v, side) {
    const a = v.gx * 7 + side, b = v.gy * 13 + side * 3;
    const name = hp(FIRSTS, a, b, 911) + ' the ' + hp(JOBS, a, b, 912);
    const z = ZONES[v.biome].name, fill = t => t.replace('{z}', z).replace('{v}', v.name);
    const l1 = hp(LINES, a, b, 913); let l2 = hp(LINES, a, b, 914); if (l2 === l1) l2 = LINES[(LINES.indexOf(l1) + 3) % LINES.length];
    const n = { id: v.id + (side ? 'b' : 'a'), village: v.id, gen: true, x: v.cx + (side ? 3 : -3), y: v.cy + 2, dir: 'down', name,
      greet: fill(hp(GREETS, a, b, 915)), lines: [fill(l1), fill(l2)],
      look: { shirt: hp(SHIRTS, a, b, 916), hair: hp(HAIRS, a, b, 917), skin: hp(SKINS, a, b, 918), cap: hp(CAPS, a, b, 919) } };
    if (side || hash2(a, b, 920) < 0.6) n.battle = { sp: seededSpecies(v.biome, hash2(a, b, 921)), hp: 3 + ((hash2(a, b, 922) * 3) | 0), intro: hp(['Let us see how well you study!', 'A friendly battle? Yes please!', 'I have been practising. Ready?'], a, b, 923) };
    return n;
  }
  function villageSpec(gx, gy) {
    const k = ckey(gx, gy); if (vcache.has(k)) return vcache.get(k);
    let v = null;
    const ox = gx * VC, oy = gy * VC;
    const nearCore = ox < W + 14 && ox + VC > -14 && oy < H + 14 && oy + VC > -14;
    if (!nearCore && hash2(gx, gy, 901) < 0.38) {
      const cx = ox + 22 + Math.floor(hash2(gx, gy, 902) * (VC - 43)), cy = oy + 8 + Math.floor(hash2(gx, gy, 903) * (VC - 15));
      const biome = biomeFor(cx, cy), r0 = hp(ROOFS, gx, gy, 904); let r1 = hp(ROOFS, gx, gy, 905); if (r1 === r0) r1 = ROOFS[(ROOFS.indexOf(r0) + 2) % ROOFS.length];
      v = { id: 'w' + gx + '_' + gy, gx, gy, cx, cy, x0: cx - 6, x1: cx + 6, y0: cy - 4, y1: cy + 4, biome,
        name: hp(V_A, gx, gy, 906) + hp(V_B, gx, gy, 907), signX: cx - 1, signY: cy + 3,
        buildings: [{ x: cx - 5, y: cy - 3, w: 5, h: 3, type: r0 }, { x: cx + 1, y: cy - 3, w: 5, h: 3, type: r1 }] };
      v.blurb = 'A small village in the ' + ZONES[biome].name + '. ' + hp(['Smoke curls from the chimneys.', 'Everyone here knows everyone.', 'The roofs are very colourful.', 'It smells of fresh bread.'], gx, gy, 908);
      VILLAGE_NAMES[v.id] = v.name; GEN_V.push(v);
      addNpc(makeNpc(v, 0)); addNpc(makeNpc(v, 1));
    }
    vcache.set(k, v); return v;
  }
  function villageNear(x, y) {
    const v = villageSpec(Math.floor(x / VC), Math.floor(y / VC));
    return v && Math.abs(x - v.cx) <= 21 && y >= v.cy - 5 && y <= v.cy + 5 ? v : null;
  }
  function villageKind(v, x, y, base) {
    const dx = x - v.cx, dy = y - v.cy, onStreet = (dy === 0 || dy === 1) && Math.abs(dx) <= 20;
    if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) {
      for (const bl of v.buildings) if (x >= bl.x && x < bl.x + 5 && y >= bl.y && y < bl.y + 3) return (x === bl.x + 2 && y === bl.y + 2) ? K.LOCKED : K.WALL;
      if (onStreet) return K.PATH;
      if (x === v.signX && y === v.signY) return K.SIGN;
      return hash2(x, y, 6) < 0.06 ? K.FLOWER : K.FLOOR;
    }
    if (onStreet) return K.PATH;                                              // the street runs out of the village as a road
    if (dy >= -1 && dy <= 2 && Math.abs(dx) <= 20 && base === K.TREE) return K.FLOOR;
    return -1;
  }

  const GT = { k: 0, b: 0, v: 0, br: 0 };
  function genTile(x, y) {
    const b = biomeFor(x, y); GT.b = b; GT.v = (hash2(x, y, 3) * 4) | 0; GT.br = 0;
    const t0 = terrainKind(x, y, b); let k = t0;
    const hy = hwY(x), hx = hwX(y);                                           // the two main roads carry on for ever
    if (y === hy || y === hy + 1 || x === hx || x === hx + 1) { if (t0 === K.WATER) GT.br = 1; k = K.PATH; }
    else if (k === K.TREE && ((y >= hy - 1 && y <= hy + 2) || (x >= hx - 1 && x <= hx + 2))) k = K.FLOOR;
    const v = villageNear(x, y);
    if (v) { const r = villageKind(v, x, y, t0); if (r >= 0) { k = r; GT.br = (r === K.PATH && t0 === K.WATER) ? 1 : 0; } }
    else if (k === K.FLOOR && hash2(x, y, 77) < 0.0009) k = K.SIGN;
    GT.k = k;
  }
  let memoK = null, memoC = null;
  function chunkOf(x, y) {
    const cx = x >> 4, cy = y >> 4, k = ckey(cx, cy);
    if (k === memoK) return memoC;
    let c = chunks.get(k);
    if (!c) {
      c = { k: new Uint8Array(256), b: new Uint8Array(256), v: new Uint8Array(256), br: new Uint8Array(256) };
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
        const o = j * 16 + i; genTile(cx * 16 + i, cy * 16 + j);
        c.k[o] = GT.k; c.b[o] = GT.b; c.v[o] = GT.v; c.br[o] = GT.br;
      }
      chunks.set(k, c);
    }
    memoK = k; memoC = c; return c;
  }
  const oc = (x, y) => ((y & 15) << 4) | (x & 15);
  function kindAt(x, y) { return inB(x, y) ? kind[idx(x, y)] : chunkOf(x, y).k[oc(x, y)]; }
  function biomeAt(x, y) { return inB(x, y) ? biome[idx(x, y)] : chunkOf(x, y).b[oc(x, y)]; }
  function variAt(x, y) { return inB(x, y) ? vari[idx(x, y)] : chunkOf(x, y).v[oc(x, y)]; }
  function bridgeAt(x, y) { return inB(x, y) ? bridge[idx(x, y)] : chunkOf(x, y).br[oc(x, y)]; }
  const compass = (dx, dy) => (Math.abs(dy) > Math.abs(dx) * 0.4 ? (dy < 0 ? 'north' : 'south') : '') + (Math.abs(dx) > Math.abs(dy) * 0.4 ? (dx < 0 ? 'west' : 'east') : '');
  function signText(x, y) {
    if (inB(x, y) && signs.has(idx(x, y))) return signs.get(idx(x, y));
    const v = villageNear(x, y);
    if (v && x === v.signX && y === v.signY) return ['Welcome to ' + v.name + '!', v.blurb, 'Villagers here have quests for you and love a friendly study battle.'];
    const z = zoneAt(x, y), dx = x - SPAWN.x, dy = y - SPAWN.y;
    return ['You are in the ' + ZONES[z].name, ZONES[z].blurb, `Study Village is about ${Math.round(Math.hypot(dx, dy))} tiles ${compass(-dx, -dy)} of here. Press M to see your map.`];
  }
  /* the map only shows places you have been near (the hand-made core is always known) */
  const seenAt = (x, y) => inB(x, y) || !!(wstate.seen && wstate.seen[(x >> 3) + ',' + (y >> 3)]);
  let lastBlk = '';
  function markSeen() {
    const bx = p.x >> 3, by = p.y >> 3, k = bx + ',' + by; if (k === lastBlk) return; lastBlk = k;
    wstate.seen = wstate.seen || {};
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) wstate.seen[(bx + i) + ',' + (by + j)] = 1;
  }

  /* ---------- sprite caches ---------- */
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  // ground colours, water/lava colours, detail style and minimap colours per biome
  const PAL = [
    { g1: '#74c85f', g2: '#6abd56', det: '#59a84a', tall: '#46a83f', tall2: '#2c7a30', w: '#4aa3e0', w2: '#6dbdf0', wl: '#fff', style: 'blade', mini: '#74c85f', tree: '#2e6b35' },
    { g1: '#58a855', g2: '#4e9d4c', det: '#3d853f', tall: '#2f8541', tall2: '#1d5f2e', w: '#4aa3e0', w2: '#6dbdf0', wl: '#fff', style: 'blade', mini: '#4e9d4c', tree: '#1f5a2c' },
    { g1: '#f1f7fc', g2: '#e4eef7', det: '#c5dbec', tall: '#b9d6ee', tall2: '#86b0d4', w: '#a9d8f0', w2: '#cfeaf9', wl: '#fff', style: 'dash', mini: '#eef5fb', tree: '#2f6f4f' },
    { g1: '#cdbd9a', g2: '#c0af8b', det: '#a8987a', tall: '#cfae52', tall2: '#a07f34', w: '#4aa3e0', w2: '#6dbdf0', wl: '#fff', style: 'pebble', mini: '#c4b392', tree: '#8e8a84' },
    { g1: '#ecd08f', g2: '#e4c682', det: '#d0b06a', tall: '#c6a24a', tall2: '#9c7c2a', w: '#3fc6c0', w2: '#8fe8e0', wl: '#fff', style: 'dash', mini: '#e8cc8a', tree: '#3f9a4a' },
    { g1: '#6f8a4a', g2: '#65803f', det: '#55702f', tall: '#4a6b2a', tall2: '#2f4a1c', w: '#4f7a5a', w2: '#7aa886', wl: '#a8c8a0', style: 'blade', mini: '#6a853f', tree: '#3d5a2a' },
    { g1: '#4a3b3b', g2: '#3f3232', det: '#2d2323', tall: '#b5452a', tall2: '#7d2a18', w: '#ff6a1f', w2: '#ffc02e', wl: '#ffd37a', style: 'pebble', mini: '#43363a', tree: '#2a2228' },
    { g1: '#f3e2b3', g2: '#ecd9a3', det: '#d9c48a', tall: '#5fbf9a', tall2: '#2f8f73', w: '#35b6e8', w2: '#8fe0f8', wl: '#fff', style: 'dot', mini: '#f0dfae', tree: '#3fae5a' },
    { g1: '#a4d98a', g2: '#9ad07f', det: '#ff9fc0', tall: '#d46a9a', tall2: '#9c3f72', w: '#6fb8e8', w2: '#a8d8f5', wl: '#fff', style: 'petal', mini: '#a4d98a', tree: '#f08fb4' },
    { g1: '#5a4f82', g2: '#524878', det: '#7a6cb0', tall: '#8f7cff', tall2: '#5a46c8', w: '#6a4bd8', w2: '#a58bff', wl: '#d9ccff', style: 'pebble', mini: '#564c80', tree: '#8f7cff' }
  ];

  function drawGroundTile(g, x, y, X, Y) {
    const b = biomeAt(x, y), pal = PAL[b], k = kindAt(x, y);
    g.fillStyle = (variAt(x, y) & 1) ? pal.g1 : pal.g2; g.fillRect(X, Y, TS, TS);
    // little ground details
    g.fillStyle = pal.det;
    for (let n = 0; n < 3; n++) {
      const rx = hash2(x, y, 100 + n) * 26 + 3, ry = hash2(x, y, 200 + n) * 26 + 3;
      if (pal.style === 'blade') { g.fillRect(X + rx, Y + ry, 2, 4); g.fillRect(X + rx + 3, Y + ry + 1, 2, 3); }
      else if (pal.style === 'dash') { g.globalAlpha = .7; g.fillRect(X + rx, Y + ry, 4, 2); g.globalAlpha = 1; }
      else if (pal.style === 'dot') { g.fillRect(X + rx, Y + ry, 2, 2); g.fillRect(X + rx + 5, Y + ry + 3, 2, 2); }
      else if (pal.style === 'petal') { g.globalAlpha = .8; g.beginPath(); g.ellipse(X + rx, Y + ry, 2.2, 1.3, hash2(x, y, 300 + n) * 3, 0, 7); g.fill(); g.globalAlpha = 1; }
      else { g.beginPath(); g.ellipse(X + rx, Y + ry, 3, 2, 0, 0, 7); g.fill(); }
    }
    if (k === K.TALL) {
      for (let n = 0; n < 9; n++) {
        const bx = X + 2 + (n % 3) * 10 + hash2(x, y, 300 + n) * 4, by = Y + 8 + ((n / 3) | 0) * 9 + hash2(x, y, 400 + n) * 3;
        g.fillStyle = n % 2 ? pal.tall : pal.tall2;
        g.beginPath(); g.moveTo(bx - 3, by + 9); g.lineTo(bx, by - 8 - hash2(x, y, 500 + n) * 3); g.lineTo(bx + 3, by + 9); g.fill();
      }
    } else if (k === K.PATH) {
      if (bridgeAt(x, y)) {
        g.fillStyle = pal.w; g.fillRect(X, Y, TS, TS);
        g.fillStyle = '#a77845'; g.fillRect(X, Y, TS, TS);
        g.fillStyle = '#8a6030'; for (let yy = 0; yy < TS; yy += 8) g.fillRect(X, Y + yy + 7, TS, 1.5);
        g.fillStyle = '#6e4a22'; g.fillRect(X, Y, TS, 3); g.fillRect(X, Y + TS - 3, TS, 3);
      } else {
        g.fillStyle = '#dcbd84'; g.fillRect(X, Y, TS, TS);
        g.fillStyle = '#c9a56b';
        for (let n = 0; n < 5; n++) g.fillRect(X + hash2(x, y, 600 + n) * 28, Y + hash2(x, y, 700 + n) * 28, 3, 2);
        g.fillStyle = '#e8cf9c'; for (let n = 0; n < 3; n++) g.fillRect(X + hash2(x, y, 800 + n) * 28, Y + hash2(x, y, 900 + n) * 28, 2, 2);
        const isP = (a, c) => (kindAt(a, c) === K.PATH || kindAt(a, c) === K.DOOR) && !bridgeAt(a, c);
        g.fillStyle = '#b48f55';
        if (!isP(x, y - 1)) g.fillRect(X, Y, TS, 3); if (!isP(x, y + 1)) g.fillRect(X, Y + TS - 3, TS, 3);
        if (!isP(x - 1, y)) g.fillRect(X, Y, 3, TS); if (!isP(x + 1, y)) g.fillRect(X + TS - 3, Y, 3, TS);
      }
    } else if (k === K.WATER) {
      g.fillStyle = pal.w; g.fillRect(X, Y, TS, TS);
      g.fillStyle = pal.w2; g.fillRect(X + 4, Y + 6, 10, 2); g.fillRect(X + 16, Y + 20, 12, 2);
      const isW = (a, c) => kindAt(a, c) === K.WATER || !!bridgeAt(a, c);
      g.fillStyle = pal.wl; g.globalAlpha = .7;
      if (!isW(x, y - 1)) g.fillRect(X, Y, TS, 3); if (!isW(x, y + 1)) g.fillRect(X, Y + TS - 3, TS, 3);
      if (!isW(x - 1, y)) g.fillRect(X, Y, 3, TS); if (!isW(x + 1, y)) g.fillRect(X + TS - 3, Y, 3, TS);
      g.globalAlpha = 1;
    } else if (k === K.FLOWER) {
      const cols = b === 8 ? ['#ff8fb8', '#ffd1e1', '#ffffff', '#ff6b9a'] : ['#ff6b8b', '#ffe066', '#ffffff', '#b58cff'];
      for (let n = 0; n < 3; n++) {
        const fx = X + 5 + hash2(x, y, 1000 + n) * 22, fy = Y + 6 + hash2(x, y, 1100 + n) * 20;
        g.fillStyle = cols[(hash2(x, y, 1200 + n) * 4) | 0]; g.beginPath(); g.arc(fx, fy, 3, 0, 7); g.fill();
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(fx, fy, 1.2, 0, 7); g.fill();
      }
    } else if (k === K.DOOR) {
      g.fillStyle = '#cfc7b8'; g.fillRect(X, Y, TS, TS);
    }
  }

  const chunkCv = new Map();
  function chunkCanvas(cx, cy) {
    const k = ckey(cx, cy); let c = chunkCv.get(k);
    if (c) return c;
    c = mk(16 * TS, 16 * TS, g => { for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) drawGroundTile(g, cx * 16 + i, cy * 16 + j, i * TS, j * TS); });
    chunkCv.set(k, c);
    if (chunkCv.size > 90) chunkCv.delete(chunkCv.keys().next().value);      // forget the oldest ones, they can always be redrawn
    return c;
  }
  let preList = [], preKey = '';
  function prefetch() {                                                      // draw the chunks just off screen ahead of time so walking never stutters
    const pcx = p.x >> 4, pcy = p.y >> 4, key = pcx + ',' + pcy;
    if (key !== preKey) {
      preKey = key; preList = [];
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) preList.push([pcx + i, pcy + j, Math.abs(i) + Math.abs(j)]);
      preList.sort((a, b) => a[2] - b[2]);
    }
    while (preList.length) { const [a, b] = preList.shift(); if (!chunkCv.has(ckey(a, b))) { chunkCanvas(a, b); break; } }
  }
  function tileColor(x, y) {
    const k = kindAt(x, y), P = PAL[biomeAt(x, y)];
    return k === K.WATER ? P.w : k === K.TREE ? P.tree : k === K.PATH ? '#dcbd84' : (k === K.WALL || k === K.DOOR || k === K.LOCKED) ? '#c0504d' : k === K.TALL ? P.tall2 : P.mini;
  }
  let miniT = 0;
  function drawMini() {                                                      // the little corner map: 64 x 48 tiles around you
    const mm = q('#minimap'); if (!mm) return; const g = mm.getContext('2d');
    for (let j = -24; j < 24; j++) for (let i = -32; i < 32; i++) { g.fillStyle = tileColor(p.x + i, p.y + j); g.fillRect((i + 32) * 2, (j + 24) * 2, 2, 2); }
  }

  // objects (trees, boulders)
  const shadow = (g, rx = 12) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(16, 39, rx, 3.5, 0, 0, 7); g.fill(); };
  const TREE_DRAW = [
    // 0 meadow: round tree (some with apples)
    (g, j, v) => {
      shadow(g); g.fillStyle = '#7a4e2a'; g.fillRect(13, 28, 6, 12);
      g.fillStyle = '#2f8f3f'; g.beginPath(); g.arc(16, 22 + j, 14, 0, 7); g.fill();
      g.fillStyle = '#47b04c'; g.beginPath(); g.arc(14, 18 + j, 11, 0, 7); g.fill();
      g.fillStyle = '#6fd070'; g.beginPath(); g.arc(11, 14 + j, 5, 0, 7); g.fill();
      if (v) { g.fillStyle = '#ff6b6b'; [[10, 22], [20, 17], [22, 27]].forEach(([a, c]) => { g.beginPath(); g.arc(a, c, 2, 0, 7); g.fill(); }); }
    },
    // 1 forest: dark round tree
    (g, j) => {
      shadow(g); g.fillStyle = '#7a4e2a'; g.fillRect(13, 28, 6, 12);
      g.fillStyle = '#1f6a33'; g.beginPath(); g.arc(16, 22 + j, 14, 0, 7); g.fill();
      g.fillStyle = '#2a8240'; g.beginPath(); g.arc(14, 18 + j, 11, 0, 7); g.fill();
      g.fillStyle = '#3a9a50'; g.beginPath(); g.arc(11, 14 + j, 5, 0, 7); g.fill();
    },
    // 2 tundra: snowy pine
    (g, j) => {
      shadow(g); g.fillStyle = '#7a4e2a'; g.fillRect(13, 28, 6, 12);
      const tri = (y0, w, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(16, y0 - 14); g.lineTo(16 + w, y0); g.lineTo(16 - w, y0); g.fill(); };
      tri(18 + j, 8, '#2f6f4f'); tri(26 + j, 11, '#2a6347'); tri(34, 14, '#245a40');
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(16, 4 + j); g.lineTo(21, 12 + j); g.lineTo(11, 12 + j); g.fill();
      g.beginPath(); g.moveTo(16, 14); g.lineTo(23, 24); g.lineTo(9, 24); g.fill();
    },
    // 3 crag: boulder
    (g, j) => {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(16, 38, 14, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#8e8a84'; g.beginPath(); g.moveTo(3, 38); g.lineTo(5, 22 + j); g.lineTo(13, 14); g.lineTo(24, 16 + j); g.lineTo(30, 26); g.lineTo(29, 38); g.closePath(); g.fill();
      g.fillStyle = '#b0aba3'; g.beginPath(); g.moveTo(8, 24); g.lineTo(13, 16); g.lineTo(21, 17); g.lineTo(14, 26); g.closePath(); g.fill();
      g.fillStyle = '#6f6b66'; g.fillRect(17, 28, 12, 10); g.strokeStyle = '#5e5a55'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(12, 24); g.lineTo(16, 36); g.stroke();
    },
    // 4 dunes: cactus
    (g, j, v) => {
      shadow(g, 10);
      g.fillStyle = '#2f7f3a'; g.fillRect(12, 8 + j, 9, 32);
      g.fillStyle = '#3f9a4a'; g.fillRect(11, 8 + j, 8, 32);
      g.beginPath(); g.arc(15, 9 + j, 4, 0, 7); g.fill();
      g.fillStyle = '#3f9a4a'; g.fillRect(3, 20, 5, 8); g.fillRect(3, 24, 9, 4); g.beginPath(); g.arc(5.5, 20, 2.5, 0, 7); g.fill();
      g.fillRect(23, 14, 5, 9); g.fillRect(19, 19, 9, 4); g.beginPath(); g.arc(25.5, 14, 2.5, 0, 7); g.fill();
      g.strokeStyle = '#d9f0b8'; g.lineWidth = 1; for (let n = 0; n < 6; n++) { g.beginPath(); g.moveTo(13 + (n % 2) * 4, 14 + n * 4); g.lineTo(13 + (n % 2) * 4, 16 + n * 4); g.stroke(); }
      if (v) { g.fillStyle = '#ff7aa8'; g.beginPath(); g.arc(15, 5 + j, 3, 0, 7); g.fill(); }
    },
    // 5 swamp: droopy willow
    (g, j, v) => {
      shadow(g, 13); g.fillStyle = '#4e3b27'; g.fillRect(13, 22, 6, 18); g.fillRect(10, 36, 12, 4);
      g.fillStyle = '#3d5a2a'; g.beginPath(); g.arc(16, 17 + j, 14, 0, 7); g.fill();
      g.fillStyle = '#4f7236'; g.beginPath(); g.arc(13, 14 + j, 9, 0, 7); g.fill();
      g.strokeStyle = '#6f8f4a'; g.lineWidth = 2;
      for (let n = 0; n < 6; n++) { const x = 4 + n * 4.8; g.beginPath(); g.moveTo(x, 20); g.lineTo(x + (n % 2 ? 1 : -1), 30 + (n % 3) * 3); g.stroke(); }
      if (v) { g.fillStyle = '#e8e08a'; [[9, 28], [22, 33]].forEach(([a, c]) => { g.beginPath(); g.arc(a, c, 1.6, 0, 7); g.fill(); }); }
    },
    // 6 volcano: black rock spire with a lava crack
    (g, j) => {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(16, 38, 14, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#2f262c'; g.beginPath(); g.moveTo(3, 38); g.lineTo(8, 18 + j); g.lineTo(14, 4 + j); g.lineTo(21, 14); g.lineTo(28, 22 + j); g.lineTo(29, 38); g.closePath(); g.fill();
      g.fillStyle = '#4a3b44'; g.beginPath(); g.moveTo(8, 20); g.lineTo(14, 6 + j); g.lineTo(18, 16); g.lineTo(12, 30); g.closePath(); g.fill();
      g.strokeStyle = '#ff7a2e'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 18); g.lineTo(18, 26); g.lineTo(22, 31); g.lineTo(20, 37); g.stroke();
      g.strokeStyle = '#ffd36b'; g.lineWidth = 1; g.stroke();
    },
    // 7 shores: palm
    (g, j, v) => {
      shadow(g, 11);
      g.strokeStyle = '#a9783f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 40); g.quadraticCurveTo(12 + v * 6, 26, 17, 12 + j); g.stroke();
      g.strokeStyle = '#8a5f2f'; g.lineWidth = 1; for (let n = 0; n < 5; n++) { g.beginPath(); g.moveTo(11, 36 - n * 5); g.lineTo(16, 35 - n * 5); g.stroke(); }
      g.fillStyle = '#3fae5a';
      [[-70, 0], [-30, 1], [10, 0], [50, 1], [90, 0]].forEach(([a, h]) => { g.save(); g.translate(17, 12 + j); g.rotate(a * Math.PI / 180); g.beginPath(); g.ellipse(0, -10, 4, 11, 0, 0, 7); g.fillStyle = h ? '#2f8f4a' : '#4fc56b'; g.fill(); g.restore(); });
      g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(15, 15 + j, 2.5, 0, 7); g.arc(19, 16 + j, 2.5, 0, 7); g.fill();
    },
    // 8 blossom: cherry tree
    (g, j) => {
      shadow(g); g.fillStyle = '#6e4a3a'; g.fillRect(13, 28, 6, 12);
      g.fillStyle = '#f08fb4'; g.beginPath(); g.arc(16, 22 + j, 14, 0, 7); g.fill();
      g.fillStyle = '#f6a9c8'; g.beginPath(); g.arc(14, 18 + j, 11, 0, 7); g.fill();
      g.fillStyle = '#ffd1e1'; g.beginPath(); g.arc(11, 14 + j, 5, 0, 7); g.fill();
      g.fillStyle = '#fff'; [[22, 24], [8, 26], [19, 12]].forEach(([a, c]) => { g.beginPath(); g.arc(a, c + j, 1.6, 0, 7); g.fill(); });
    },
    // 9 crystal: cluster
    (g, j, v) => {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(16, 38, 14, 4, 0, 0, 7); g.fill();
      const cr = (x, h, w, c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x - w, 38); g.lineTo(x - w * .7, 38 - h * .7); g.lineTo(x, 38 - h); g.lineTo(x + w * .7, 38 - h * .75); g.lineTo(x + w, 38); g.closePath(); g.fill(); g.fillStyle = c2; g.beginPath(); g.moveTo(x, 38 - h); g.lineTo(x + w * .7, 38 - h * .75); g.lineTo(x + w, 38); g.lineTo(x, 38); g.closePath(); g.fill(); };
      cr(9, 20 + j, 6, '#b3a6ff', '#8f7cff'); cr(23, 17 + j, 6, '#9fe3ff', '#6bc8f0'); cr(16, 34 - j, 8, '#c9bfff', '#8a76f0');
      g.fillStyle = '#fff'; g.globalAlpha = .8; g.fillRect(14, 12 + j + v * 2, 2, 8); g.globalAlpha = 1;
    }
  ];
  const treeSprites = PAL.map((_, b) => [0, 1].map(v => mk(32, 42, g => { TREE_DRAW[b](g, v * 1.5, v); })));
  const signSprite = mk(32, 32, g => {
    g.fillStyle = '#6e4a22'; g.fillRect(14, 16, 4, 14);
    g.fillStyle = '#c99a5b'; g.fillRect(4, 5, 24, 14); g.strokeStyle = '#7a5528'; g.lineWidth = 2; g.strokeRect(4, 5, 24, 14);
    g.fillStyle = '#7a5528'; g.fillRect(8, 9, 16, 2); g.fillRect(8, 13, 11, 2);
  });
  const tallFront = PAL.map(pal => mk(32, 32, g => {
    for (let n = 0; n < 8; n++) {
      const bx = 3 + (n % 4) * 8 + (n > 3 ? 4 : 0), by = 22 + (n > 3 ? 3 : 0);
      g.fillStyle = n % 2 ? pal.tall : pal.tall2;
      g.beginPath(); g.moveTo(bx - 4, 32); g.lineTo(bx, by - 6); g.lineTo(bx + 4, 32); g.fill();
    }
  }));
  const buildingSprites = {};
  function buildingSprite(type) {
    if (buildingSprites[type]) return buildingSprites[type];
    const roof = { healer: ['#e0463f', '#b8332e'], blue: ['#4a7fd4', '#3562ab'], orange: ['#e08a2e', '#b86c1c'], purple: ['#8a5bd0', '#6a41a8'],
      green: ['#4fa05a', '#3a7a44'], teal: ['#2fa3a0', '#228079'], pink: ['#f08fb4', '#c96a90'], sand: ['#d9b35f', '#b08e3e'] }[type];
    return buildingSprites[type] = mk(160, 96, g => {
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(6, 90, 150, 6);
      g.fillStyle = '#f2e6cf'; g.fillRect(8, 52, 144, 40);
      g.fillStyle = '#d6c8a8'; g.fillRect(8, 86, 144, 6);
      g.fillStyle = roof[0]; g.beginPath(); g.moveTo(0, 56); g.lineTo(18, 4); g.lineTo(142, 4); g.lineTo(160, 56); g.closePath(); g.fill();
      g.strokeStyle = roof[1]; g.lineWidth = 2;
      for (let yy = 14; yy < 56; yy += 10) { g.beginPath(); g.moveTo(14 - (yy - 4) * 0.02 * 10, yy); g.lineTo(146 + (yy - 4) * 0.02 * 10, yy); g.stroke(); }
      g.fillStyle = roof[1]; g.fillRect(0, 52, 160, 6);
      // windows
      [[22, 62], [112, 62]].forEach(([wx, wy]) => {
        g.fillStyle = '#fff'; g.fillRect(wx - 3, wy - 3, 32, 28); g.fillStyle = '#9fd6f5'; g.fillRect(wx, wy, 26, 22);
        g.fillStyle = '#fff'; g.fillRect(wx + 12, wy, 2, 22); g.fillRect(wx, wy + 10, 26, 2);
      });
      // door (center tile = x 64..96)
      g.fillStyle = type === 'healer' ? '#e0463f' : '#7a4e2a';
      g.fillRect(68, 58, 24, 36); g.beginPath(); g.arc(80, 58, 12, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(79, 56, 2, 38);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(86, 78, 2, 0, 7); g.fill();
      if (type === 'healer') {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(80, 30, 15, 0, 7); g.fill();
        g.fillStyle = '#e0463f'; g.fillRect(74, 22, 12, 16); g.fillRect(72, 25, 16, 10);
        g.fillStyle = '#fff'; g.fillRect(77, 25, 6, 10); g.fillRect(75, 28, 10, 4);
      }
    });
  }

  /* ---------- creature sprites (from monSVG) ---------- */
  const imgCache = {};
  function spriteImg(sp, stage, shiny) {
    const key = sp.id + stage + (shiny ? 's' : '');
    if (imgCache[key]) return imgCache[key];
    let svg = monSVG(sp, stage);
    if (shiny) svg = svg.replace('class="mon">', 'class="mon"><g style="filter:hue-rotate(150deg) saturate(1.4)">').replace('</svg>', '</g></svg>');
    const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return imgCache[key] = im;
  }

  /* ---------- people drawing ---------- */
  function drawPerson(g, X, Y, look, dir, frame) {
    const leg = frame === 1 ? -2 : frame === 2 ? 2 : 0;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(X + 16, Y + 29, 9, 3.5, 0, 0, 7); g.fill();
    g.fillStyle = '#34406b'; g.fillRect(X + 10, Y + 21 + (leg > 0 ? 0 : -leg * .5), 5, 8 - (leg > 0 ? leg * .5 : 0)); g.fillRect(X + 17, Y + 21 + (leg < 0 ? 0 : leg * .5), 5, 8 - (leg < 0 ? -leg * .5 : 0));
    g.fillStyle = look.shirt; g.fillRect(X + 9, Y + 12, 14, 11);
    g.fillStyle = look.skin; g.fillRect(X + 6, Y + 13 + (leg > 0 ? 1 : 0), 3, 8); g.fillRect(X + 23, Y + 13 + (leg < 0 ? 1 : 0), 3, 8);
    g.fillStyle = look.skin; g.beginPath(); g.arc(X + 16, Y + 8, 7, 0, 7); g.fill();
    g.fillStyle = look.hair;
    if (dir === 'up') { g.beginPath(); g.arc(X + 16, Y + 8, 7.4, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(X + 16, Y + 7, 7.4, Math.PI, 0); g.fill(); g.fillRect(X + 8.6, Y + 6, 2.5, 4); g.fillRect(X + 20.9, Y + 6, 2.5, 4); }
    if (look.cap) {
      g.fillStyle = look.cap; g.beginPath(); g.arc(X + 16, Y + 6, 7.6, Math.PI, 0); g.fill();
      if (dir === 'down') g.fillRect(X + 9, Y + 5, 14, 3);
      else if (dir === 'left') g.fillRect(X + 6, Y + 5, 9, 3);
      else if (dir === 'right') g.fillRect(X + 17, Y + 5, 9, 3);
    }
    g.fillStyle = '#1d1d2b';
    if (dir === 'down') { g.fillRect(X + 12.5, Y + 9, 2, 3); g.fillRect(X + 17.5, Y + 9, 2, 3); }
    else if (dir === 'left') g.fillRect(X + 11, Y + 9, 2, 3);
    else if (dir === 'right') g.fillRect(X + 19, Y + 9, 2, 3);
  }
  const PLAYER_LOOK = { shirt: '#e8504a', hair: '#5b3a1e', skin: '#f1c9a0', cap: '#2a5bd7' };

  /* ---------- state ---------- */
  const cv = q('#world'), ctx = cv.getContext('2d');
  let dpr = 1, cssW = 0, cssH = 0, Z = 1;
  let paused = false, running = false, last = 0, anim = 0, dirty = 0, hudTimer = 0;
  let grace = 0, grassSteps = 0, steps = 0, zoneNow = -1, spawnTimer = 1, healCool = 0, regenSteps = 0;
  let pendingRoamer = null, nextId = 1, villageNow = null, mapOpen = false;
  const keys = [];            // held direction keys, most recent last
  const padHeld = { dir: null };
  const p = { x: SPAWN.x, y: SPAWN.y, fx: SPAWN.x, fy: SPAWN.y, px: 0, py: 0, dir: 'down', moving: false, t: 0, leg: 0, excl: 0 };
  const f = { x: SPAWN.x, y: SPAWN.y - 1, fx: SPAWN.x, fy: SPAWN.y - 1, px: 0, py: 0, dir: 'down' };
  const roamers = [];
  const MAXR = 7;
  let dialog = null;

  const blockedTile = (x, y) => SOLID[kindAt(x, y)] || !!npcAt(x, y);
  const roamerAt = (x, y, self) => roamers.find(r => r !== self && r.x === x && r.y === y);

  function placePlayer(x, y, dir) {
    p.x = p.fx = x; p.y = p.fy = y; p.moving = false; p.t = 0; if (dir) p.dir = dir;
    const [dx, dy] = DIRS[p.dir];
    let bx = x - dx, by = y - dy;
    if (blockedTile(bx, by)) { bx = x; by = y; }
    f.x = f.fx = bx; f.y = f.fy = by;
    syncPixels();
  }
  function syncPixels() {
    const e = p.moving ? p.t : 1;
    p.px = (p.fx + (p.x - p.fx) * e) * TS; p.py = (p.fy + (p.y - p.fy) * e) * TS;
    f.px = (f.fx + (f.x - f.fx) * e) * TS; f.py = (f.fy + (f.y - f.fy) * e) * TS;
  }

  /* ---------- UI bits ---------- */
  let toastT = 0;
  function toast(msg, ms = 2800) {
    const t = q('#wToast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), ms);
  }
  function banner(name) {
    const b = q('#wBanner'); b.textContent = name; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }
  /* A dialog is a few lines of text. If `menu` is given, its buttons appear on the last line, e.g. [{label, fn}]. */
  function openDialog(name, lines, menu) {
    dialog = { name, lines, i: 0, menu: menu || null }; renderDialog();
  }
  const menuShowing = () => !!(dialog && dialog.menu && dialog.i >= dialog.lines.length - 1);
  function chooseMenu(n) {
    if (!menuShowing()) return;
    const item = dialog.menu[n]; if (!item) return;
    dialog = null; renderDialog();
    if (item.fn) item.fn();
  }
  function renderDialog() {
    const d = q('#dialog');
    if (!dialog) { d.classList.add('hidden'); return; }
    d.classList.remove('hidden');
    d.innerHTML = '';
    const n = document.createElement('strong'); n.textContent = dialog.name;
    const t = document.createElement('p'); t.textContent = dialog.lines[dialog.i];
    d.append(n, t);
    if (menuShowing()) {
      const box = document.createElement('div'); box.className = 'dmenu';
      dialog.menu.forEach((it, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = (k + 1) + '. ' + it.label;
        if (it.ghost) b.className = 'ghost';
        b.addEventListener('click', e => { e.stopPropagation(); chooseMenu(k); });
        box.appendChild(b);
      });
      d.appendChild(box);
    } else {
      const m = document.createElement('span'); m.className = 'more'; m.textContent = dialog.i < dialog.lines.length - 1 ? '▼' : '✔';
      d.appendChild(m);
    }
  }
  function advanceDialog() {
    if (!dialog || menuShowing()) return;
    dialog.i++;
    if (dialog.i >= dialog.lines.length) dialog = null;
    renderDialog();
  }

  /* ---------- talking to villagers ---------- */
  const spById = id => ALL_SPECIES.find(s => s.id === id);
  const npcById = id => npcIdMap.get(id);
  function talkToNpc(n) {
    Quests.event('talk', { npc: n.id });
    const menu = [];
    const ready = Quests.readyFor(n.id), act = Quests.activeFor(n.id), avail = Quests.available(n.id);
    menu.push({ label: '💬 Chat', fn: () => openDialog(n.name, n.lines) });
    if (ready.length) menu.push({ label: '🎁 Hand in: ' + ready[0].title, fn: () => handIn(n, ready[0]) });
    else if (avail.length) menu.push({ label: '📜 Quest: ' + avail[0].title, fn: () => offerQuest(n, avail[0]) });
    else if (act.length) menu.push({ label: '📜 My quest: ' + act[0].title, fn: () => openDialog(n.name, [`“${act[0].title}”: ${Quests.describe(act[0])}. You are at ${Quests.progress(act[0].id)} of ${Quests.need(act[0])}. Keep going!`]) });
    if (n.battle) menu.push({ label: '⚔ Study battle', fn: () => offerBattle(n) });
    menu.push({ label: '👋 Bye', ghost: true });
    openDialog(n.name, [n.greet || 'Hello there!'], menu);
  }
  function offerQuest(n, x) {
    openDialog(n.name, [x.pitch, `Quest: ${Quests.describe(x)}. Reward: ${x.xp} XP.`], [
      { label: '✅ Accept', fn: () => { Quests.accept(x.id); toast('📜 New quest: ' + x.title); updateHud(); openDialog(n.name, ['Wonderful! Good luck. Check 📜 Quests any time to see how you are doing.']); } },
      { label: 'Not now', ghost: true }]);
  }
  function handIn(n, x) {
    Quests.turnIn(x.id);
    updateHud();
    toast(`🎉 Quest complete: ${x.title}! +${x.xp} XP`, 4200);
    openDialog(n.name, [x.done, `You received ${x.xp} XP.`]);
  }
  function offerBattle(n) {
    const b = n.battle, last = (wstate.beaten || {})[n.id];
    if (!decks.length) { toast('Add a study deck on the Home screen to battle!'); return; }
    if (last && Date.now() - last < REMATCH_MS) {
      openDialog(n.name, ['You beat me fair and square! Give me a minute to practise, then come back for a rematch.']); return;
    }
    const again = !!last;
    openDialog(n.name, [again ? 'A rematch? Ha! Ready when you are.' : b.intro,
      'Rules: you answer study questions. Right answers hurt my creature, wrong answers cost you a heart.'], [
      { label: '⚔ Let’s battle!', fn: () => triggerEncounter(spById(b.sp), false, null, zoneAt(n.x, n.y), { npc: n.id, name: n.name, hp: b.hp, first: !last }) },
      { label: 'Not yet', ghost: true }]);
  }
  function updateHud() {
    if (typeof wstate === 'undefined') return;
    q('#wZone').textContent = '📍 ' + ZONES[zoneAt(p.x, p.y)].name;
    q('#wHearts').textContent = '❤️'.repeat(wstate.hearts) + '🖤'.repeat(Math.max(0, 5 - wstate.hearts));
    q('#wCaught').textContent = '📖 ' + ALL_SPECIES.filter(sp => player.dex[sp.id] || sp.id === player.starter).length + '/' + ALL_SPECIES.length;
    q('#wReview').textContent = '📝 Review (' + worldMissed.size + ')';
    const act = Quests.activeList().length, rdy = Quests.readyCount();
    q('#wQuests').textContent = '📜 Quests (' + act + ')' + (rdy ? ' ✅' : '');
    const mm = q('#mmDot'); if (mm) { mm.style.left = '50%'; mm.style.top = '50%'; }
  }
  function updateDeckSelect() {
    const sel = q('#wDeck'); sel.innerHTML = '';
    decks.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name + ' (' + d.cards.length + ')'; sel.appendChild(o); });
    if (decks.length) { if (!decks.some(d => d.id === wstate.deckId)) { wstate.deckId = decks[0].id; saveWorld(); } sel.value = wstate.deckId; }
  }
  q('#wDeck').onchange = e => { wstate.deckId = e.target.value; saveWorld(); toast('Deck: ' + (decks.find(d => d.id === wstate.deckId) || {}).name); };
  q('#wReview').onclick = () => openReview();
  q('#reviewClose').onclick = () => q('#reviewModal').classList.add('hidden');
  q('#wQuests').onclick = () => openQuests();
  q('#questClose').onclick = () => q('#questModal').classList.add('hidden');
  q('#wMap').onclick = () => toggleMap();
  q('#bigMapClose').onclick = () => toggleMap(false);
  q('.mmwrap').addEventListener('click', () => toggleMap(true));
  function openQuests() { Quests.renderLog(); q('#questModal').classList.remove('hidden'); }
  function openReview() {
    const m = q('#reviewModal'), list = q('#reviewList'); list.innerHTML = '';
    if (!worldMissed.size) { const li = document.createElement('p'); li.textContent = 'Nothing to review. Cards you get wrong will show up here until you answer them correctly.'; list.appendChild(li); }
    else worldMissed.forEach(c => { const li = document.createElement('li'); li.textContent = c.q + '  →  ' + c.a; list.appendChild(li); });
    m.classList.remove('hidden');
  }
  const MODALS = ['#reviewModal', '#questModal', '#bigMap'];
  const modalOpen = () => MODALS.some(s => !q(s).classList.contains('hidden'));
  const closeModals = () => { MODALS.forEach(s => q(s).classList.add('hidden')); mapOpen = false; };

  /* ---------- input ---------- */
  const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  const worldActive = () => q('#screen-world').classList.contains('active');
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName);
  document.addEventListener('keydown', e => {
    if (!worldActive() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); if (!paused && !dialog) toggleMap(); return; }
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); if (!paused && !dialog && !modalOpen()) openQuests(); else if (!q('#questModal').classList.contains('hidden')) closeModals(); return; }
    if (modalOpen()) { if (e.key === 'Escape' || e.key === 'Enter') closeModals(); return; }
    if (dialog) {
      if (e.key === 'Escape') { dialog = null; renderDialog(); return; }
      if (menuShowing() && /^[1-9]$/.test(e.key)) { e.preventDefault(); chooseMenu(+e.key - 1); return; }
    }
    const d = KEYDIR[e.key];
    if (d) { e.preventDefault(); const i = keys.indexOf(d); if (i >= 0) keys.splice(i, 1); keys.push(d); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); if (!e.repeat) action(); }
  });
  document.addEventListener('keyup', e => { const d = KEYDIR[e.key]; if (d) { const i = keys.indexOf(d); if (i >= 0) keys.splice(i, 1); } });
  window.addEventListener('blur', () => { keys.length = 0; padHeld.dir = null; });
  document.querySelectorAll('#pad [data-dir]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); padHeld.dir = b.dataset.dir; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { if (padHeld.dir === b.dataset.dir) padHeld.dir = null; }));
  });
  q('#padA').addEventListener('pointerdown', e => { e.preventDefault(); if (modalOpen()) return; action(); });
  q('#dialog').addEventListener('pointerdown', e => { if (e.target.closest('.dmenu')) return; e.preventDefault(); advanceDialog(); });
  const heldDir = () => padHeld.dir || keys[keys.length - 1] || null;

  function action() {
    if (paused) return;
    if (dialog) { advanceDialog(); return; }
    if (p.moving) return;
    const [dx, dy] = DIRS[p.dir], tx = p.x + dx, ty = p.y + dy;
    const n = npcAt(tx, ty);
    if (n) { n.dir = p.dir === 'up' ? 'down' : p.dir === 'down' ? 'up' : p.dir === 'left' ? 'right' : 'left'; if (n.id) talkToNpc(n); else openDialog(n.name, n.lines); return; }
    if (kindAt(tx, ty) === K.SIGN) openDialog('Sign', signText(tx, ty));
  }

  /* ---------- movement + events ---------- */
  function tryMove(d) {
    p.dir = d;
    const [dx, dy] = DIRS[d], nx = p.x + dx, ny = p.y + dy;
    const r = roamerAt(nx, ny);
    if (r) { triggerEncounter(r.sp, r.shiny, r.id, zoneAt(r.x, r.y)); return; }
    if (blockedTile(nx, ny)) return;
    f.fx = f.x; f.fy = f.y; f.x = p.x; f.y = p.y;
    p.fx = p.x; p.fy = p.y; p.x = nx; p.y = ny; p.moving = true; p.t = 0; p.leg ^= 1;
  }

  function onStep() {
    wstate.x = p.x; wstate.y = p.y; dirty = 1.5;
    steps++;
    const z = zoneAt(p.x, p.y);
    if (z !== zoneNow) { zoneNow = z; banner(ZONES[z].name); updateHud(); Quests.event('zone', { zone: ZONES[z].name }); }
    checkVillage(true);
    markSeen(); Quests.event('step');
    const k = kindAt(p.x, p.y);
    if (k === K.DOOR && healCool <= 0) {
      healCool = 4; wstate.hearts = 5; saveWorld(); updateHud();
      toast('🏥 The Study Center healed your partner. Fully rested!');
    }
    regenSteps++;
    if (regenSteps >= 28 && wstate.hearts < 5) { regenSteps = 0; wstate.hearts++; saveWorld(); updateHud(); toast('❤️ You feel a bit more rested.', 1600); }
    if (k === K.TALL && grace <= 0) {
      grassSteps++;
      if (grassSteps >= 3 && Math.random() < 0.15) {
        const zi = zoneAt(p.x, p.y), sp = pickSpecies(zi === VILLAGE ? 0 : zi);
        triggerEncounter(sp, Math.random() < 0.06, null, zi);
      }
    }
  }

  /* which village (if any) the player is standing in; fires the welcome banner and quest events when it changes */
  function villageIdHere() { const v = villageAt(p.x, p.y); return v ? v.id : inVillage(p.x, p.y) ? 'study' : null; }
  function checkVillage(announce) {
    const id = villageIdHere();
    if (id === villageNow) return;
    villageNow = id;
    if (!id) return;
    if (announce) { banner('🏘 ' + VILLAGE_NAMES[id]); }
    Quests.event('village', { id });
  }

  function pickSpecies(zi) {
    const t = ZONES[zi].mons, ids = Object.keys(t);
    let tot = 0; ids.forEach(i => tot += t[i]);
    let r = Math.random() * tot;
    for (const id of ids) { r -= t[id]; if (r <= 0) return ALL_SPECIES.find(s => s.id === id); }
    return ALL_SPECIES.find(s => s.id === ids[0]);
  }

  function triggerEncounter(sp, shiny, roamerId, zoneIdx, trainer) {
    if (paused) return;
    if (!decks.length) { toast('Add a study deck on the Home screen to battle creatures!'); grace = 4; return; }
    paused = true; keys.length = 0; padHeld.dir = null; dialog = null; renderDialog();
    p.excl = 0.8; pendingRoamer = roamerId; grassSteps = 0;
    const fl = q('#flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
    setTimeout(() => {
      fl.classList.remove('on');
      startEncounter({ sp, shiny, zone: ZONES[zoneIdx === VILLAGE ? 0 : zoneIdx].css, zoneName: ZONES[zoneIdx].name, trainer: trainer || null });
    }, 850);
  }

  function afterEncounter(res, info) {
    paused = false; grace = 3; keys.length = 0; p.excl = 0;
    if (pendingRoamer != null) { const i = roamers.findIndex(r => r.id === pendingRoamer); if (i >= 0) roamers.splice(i, 1); pendingRoamer = null; }
    if (res === 'fainted') {
      placePlayer(SPAWN.x, SPAWN.y, 'down'); wstate.x = p.x; wstate.y = p.y; saveWorld();
      toast('💫 Your partner fainted… you were carried back to the village and rested.', 4200);
    } else if (res === 'caught' && info && info.caught.length) {
      const c = info.caught[0];
      toast(`🎉 Caught ${c.sp.name}${c.shiny ? ' ★' : ''}!${c.isNew ? ' New Studydex entry!' : ''}  +${info.xp} XP`, 4200);
    } else if (res === 'won' && info && info.trainer) {
      const t = info.trainer;
      wstate.beaten = wstate.beaten || {}; wstate.beaten[t.npc] = Date.now(); saveWorld();
      toast(`🏆 You beat ${t.name}!  +${info.xp} XP`, 4600);
      Quests.event('beat', { npc: t.npc });
    } else if (res === 'ran') toast(info && info.trainer ? 'You gave up the battle.' : 'You got away safely.');
    updateHud();
  }
  // leaving mid-battle (Home button): just drop the pending state
  function cancelEncounter() { paused = false; grace = 3; p.excl = 0; pendingRoamer = null; }

  /* ---------- roaming creatures ---------- */
  function freeForRoamer(x, y, self) {
    if (SOLID[kindAt(x, y)] || kindAt(x, y) === K.DOOR) return false;
    if (inVillage(x, y) || villageAt(x, y)) return false;
    if ((x === p.x && y === p.y) || npcAt(x, y) || roamerAt(x, y, self)) return false;
    return true;
  }
  function spawnRoamer() {
    for (let n = 0; n < 14; n++) {
      const dx = ((Math.random() * 21) | 0) - 10, dy = ((Math.random() * 15) | 0) - 7;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) continue;
      const x = p.x + dx, y = p.y + dy;
      if (!freeForRoamer(x, y, null)) continue;
      const zi = zoneAt(x, y); if (zi === VILLAGE) continue;
      const sp = pickSpecies(zi);
      roamers.push({ id: nextId++, sp, shiny: Math.random() < 0.08, x, y, fx: x, fy: y, px: x * TS, py: y * TS, moving: false, t: 0, wait: Math.random() * 1.5, life: 70 + Math.random() * 50, age: 0, dir: 'down' });
      return;
    }
  }
  function updateRoamers(dt) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = 1.5 + Math.random() * 2; if (roamers.length < MAXR) spawnRoamer(); }
    for (let i = roamers.length - 1; i >= 0; i--) {
      const r = roamers[i];
      r.life -= dt; r.age += dt;
      if (r.id !== pendingRoamer && (r.life <= 0 || Math.max(Math.abs(r.x - p.x), Math.abs(r.y - p.y)) > 18)) { roamers.splice(i, 1); continue; }
      if (r.moving) { r.t += dt / 0.42; if (r.t >= 1) { r.moving = false; r.t = 1; } }
      else if (!paused) {
        r.wait -= dt;
        if (r.wait <= 0) {
          r.wait = 0.6 + Math.random() * 2;
          const ds = DIRNAMES.slice().sort(() => Math.random() - .5);
          for (const d of ds) {
            const nx = r.x + DIRS[d][0], ny = r.y + DIRS[d][1];
            if (freeForRoamer(nx, ny, r)) { r.fx = r.x; r.fy = r.y; r.x = nx; r.y = ny; r.moving = true; r.t = 0; r.dir = d; break; }
          }
        }
      }
      const e = r.moving ? r.t : 1;
      r.px = (r.fx + (r.x - r.fx) * e) * TS; r.py = (r.fy + (r.y - r.fy) * e) * TS;
    }
    if (!paused && grace <= 0 && !p.moving && !dialog) {
      const r = roamers.find(r => !r.moving && Math.abs(r.x - p.x) + Math.abs(r.y - p.y) <= 1);
      if (r) { p.dir = r.x > p.x ? 'right' : r.x < p.x ? 'left' : r.y > p.y ? 'down' : 'up'; triggerEncounter(r.sp, r.shiny, r.id, zoneAt(r.x, r.y)); }
    }
  }

  /* ---------- update + render ---------- */
  function update(dt) {
    anim += dt; grace -= dt; healCool -= dt; if (p.excl > 0) p.excl -= dt;
    if (dirty > 0) { dirty -= dt; if (dirty <= 0) saveWorld(); }
    hudTimer -= dt; if (hudTimer <= 0) { hudTimer = .5; updateHud(); }
    if (!paused) {
      if (p.moving) {
        p.t += dt / STEP;
        if (p.t >= 1) {
          const over = p.t - 1; p.moving = false; p.t = 1; syncPixels(); onStep();
          const d = heldDir();
          if (!paused && !dialog && d) { tryMove(d); if (p.moving) p.t = Math.min(over, .5); }
        }
      } else if (!dialog) {
        const d = heldDir(); if (d) tryMove(d);
      }
    }
    syncPixels();
    updateRoamers(dt);
    miniT -= dt; if (miniT <= 0) { miniT = 0.35; drawMini(); }
    prefetch();
  }

  function buildingsIn(x0, x1, y0, y1) {
    const out = buildings.slice();
    for (let gy = Math.floor((y0 - 4) / VC); gy <= Math.floor((y1 + 4) / VC); gy++) for (let gx = Math.floor((x0 - 8) / VC); gx <= Math.floor((x1 + 8) / VC); gx++) { const v = villageSpec(gx, gy); if (v) out.push(...v.buildings); }
    return out;
  }
  function render() {
    const g = ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const s = dpr * Z, vw = cssW / Z, vh = cssH / Z;
    let cx = p.px + TS / 2 - vw / 2, cy = p.py + TS / 2 - vh / 2;
    cx = Math.round(cx * Z) / Z; cy = Math.round(cy * Z) / Z;       // the world has no edge, so the camera never stops
    g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    g.fillStyle = '#12142b'; g.fillRect(cx, cy, vw, vh);
    const x0 = Math.floor(cx / TS) - 1, x1 = Math.ceil((cx + vw) / TS) + 1;
    const y0 = Math.floor(cy / TS) - 2, y1 = Math.ceil((cy + vh) / TS) + 2;
    for (let gy = y0 >> 4; gy <= y1 >> 4; gy++) for (let gx = x0 >> 4; gx <= x1 >> 4; gx++) g.drawImage(chunkCanvas(gx, gy), gx * 16 * TS, gy * 16 * TS);
    const visB = buildingsIn(x0, x1, y0, y1);
    // water shimmer
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (kindAt(x, y) !== K.WATER) continue;
      const o = Math.sin(anim * 2 + x * 1.3 + y * .7) * 5;
      g.fillRect(x * TS + 10 + o, y * TS + 12, 8, 2); g.fillRect(x * TS + 6 - o, y * TS + 24, 6, 2);
    }
    // entities
    const ents = [];
    ents.push({ row: Math.round(p.py / TS), y: p.py, draw: () => drawPlayer(g) });
    if (f.px !== p.px || f.py !== p.py || true) ents.push({ row: Math.round(f.py / TS), y: f.py - 1, draw: () => drawFollower(g) });
    npcs.forEach(n => { if (n.x < x0 - 1 || n.x > x1 + 1 || n.y < y0 - 1 || n.y > y1 + 1) return; ents.push({ row: n.y, y: n.y * TS, draw: () => {
      drawPerson(g, n.x * TS, n.y * TS, n.look, n.dir, 0);
      const m = n.id ? Quests.markerFor(n.id) : null;
      if (m) drawMarker(g, n.x * TS, n.y * TS + Math.sin(anim * 4 + n.x) * 2, m);
    } }); });
    roamers.forEach(r => ents.push({ row: Math.round(r.py / TS), y: r.py, draw: () => drawRoamer(g, r) }));
    ents.sort((a, b) => a.y - b.y);
    let ei = 0;
    while (ei < ents.length && ents[ei].row < y0) { ents[ei].draw(); ei++; }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = kindAt(x, y);
        if (k === K.TREE) g.drawImage(treeSprites[biomeAt(x, y)][variAt(x, y) & 1], x * TS, y * TS - 8);
        else if (k === K.SIGN) g.drawImage(signSprite, x * TS, y * TS);
      }
      visB.forEach(b => { if (b.y + b.h - 1 === y) g.drawImage(buildingSprite(b.type), b.x * TS, b.y * TS); });
      while (ei < ents.length && ents[ei].row <= y) { ents[ei].draw(); ei++; }
    }
    while (ei < ents.length) { ents[ei].draw(); ei++; }
    // soft vignette
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = g.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * .45, cssW / 2, cssH / 2, Math.max(cssW, cssH) * .75);
    gr.addColorStop(0, 'rgba(10,12,30,0)'); gr.addColorStop(1, 'rgba(10,12,30,.35)');
    g.fillStyle = gr; g.fillRect(0, 0, cssW, cssH);
  }

  /* the little "!" and "?" above villagers: yellow ! = new quest, gold ? = hand it in, grey ? = in progress */
  function drawMarker(g, X, Y, m) {
    const cx = X + 16, cy = Y - 9;
    g.fillStyle = m === 'active' ? '#8c92b8' : '#ffcb3d'; g.strokeStyle = '#2a2100'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 8.5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#2a2100'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    g.fillText(m === 'new' ? '!' : '?', cx, cy + 4.5);
  }

  /* ---------- the big map (press M) ---------- */
  const MS = 6, MW = 128, MH = 96;      // pixels per tile on the big map, and how many tiles it shows
  let bigBase = null, bigOX = 0, bigOY = 0;
  const LABELS = [[44, 66], null, null, null, null, null, null, null, null, null];
  function buildBigBase() {
    bigOX = p.x - (MW >> 1); bigOY = p.y - (MH >> 1);
    bigBase = mk(MW * MS, MH * MS, g => {
      g.fillStyle = '#1b1e3a'; g.fillRect(0, 0, MW * MS, MH * MS);
      for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
        const x = bigOX + i, y = bigOY + j;
        if (!seenAt(x, y)) continue;
        const k = kindAt(x, y);
        g.fillStyle = tileColor(x, y); g.fillRect(i * MS, j * MS, MS, MS);
        if (k === K.TREE) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(i * MS + 1, j * MS + 1, MS - 2, MS - 2); }
        if (k === K.TALL) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(i * MS + 1, j * MS + 1, 2, 2); }
      }
    });
  }
  function outlined(g, text, x, y, size, color) {
    g.font = '700 ' + size + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 4;
    g.strokeStyle = 'rgba(10,12,30,.85)'; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
  }
  function villageHasQuest(vid) {
    let best = null;
    npcs.forEach(n => { if (n.village !== vid || !n.id) return; const m = Quests.markerFor(n.id); if (m === 'ready') best = 'ready'; else if (m === 'new' && best !== 'ready') best = 'new'; });
    return best;
  }
  function drawBigMap() {
    const c = q('#bigMapCv'), g = c.getContext('2d');
    if (!bigBase) buildBigBase();
    if (c.width !== MW * MS) { c.width = MW * MS; c.height = MH * MS; }
    g.imageSmoothingEnabled = false;
    g.drawImage(bigBase, 0, 0);
    const sx = x => (x - bigOX) * MS, sy = y => (y - bigOY) * MS, inWin = (x, y) => x >= bigOX && y >= bigOY && x < bigOX + MW && y < bigOY + MH;
    // region names (only for places you have been near)
    const labelled = [];
    const label = (name, x, y) => { if (inWin(x, y) && seenAt(Math.round(x), Math.round(y)) && !labelled.some(l => Math.abs(l[0] - x) < 14 && Math.abs(l[1] - y) < 5)) { labelled.push([x, y]); outlined(g, name.toUpperCase(), sx(x), sy(y), 15, '#fff'); } };
    ZONES.forEach((z, zi) => { if (zi !== VILLAGE) { const [lx, ly] = LABELS[zi] || z.seeds[0]; label(z.name, lx, ly); } });
    for (let j = Math.floor(bigOY / SC) - 1; j <= Math.floor((bigOY + MH) / SC) + 1; j++) for (let i = Math.floor(bigOX / SC) - 1; i <= Math.floor((bigOX + MW) / SC) + 1; i++) {
      const sd = gridSeed(i, j); if (!inCorePatch(sd)) label(ZONES[sd[3]].name, sd[0], sd[1]);
    }
    // villages
    const homeC = { id: 'study', name: 'Study Village', x: (VIL.x0 + VIL.x1) / 2 + .5, y: (VIL.y0 + VIL.y1) / 2 };
    const all = [homeC].concat(VILLAGES.map(v => ({ id: v.id, name: v.name, x: v.cx + .5, y: v.cy - 1 })), GEN_V.map(v => ({ id: v.id, name: v.name, x: v.cx + .5, y: v.cy - 1 })));
    all.forEach(v => {
      if (!inWin(v.x, v.y) || !seenAt(Math.floor(v.x), Math.floor(v.y))) return;
      const X = sx(v.x), Y = sy(v.y);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(X - 9, Y + 2); g.lineTo(X, Y - 8); g.lineTo(X + 9, Y + 2); g.lineTo(X + 7, Y + 2); g.lineTo(X + 7, Y + 9); g.lineTo(X - 7, Y + 9); g.lineTo(X - 7, Y + 2); g.closePath(); g.fill();
      g.fillStyle = v.id === 'study' ? '#e0463f' : '#d9a43a'; g.beginPath(); g.moveTo(X - 11, Y + 2); g.lineTo(X, Y - 11); g.lineTo(X + 11, Y + 2); g.closePath(); g.fill();
      g.strokeStyle = '#2a1a00'; g.lineWidth = 1.5; g.stroke();
      outlined(g, v.name, X, Y + 23, 12, '#ffe9a8');
      const qm = villageHasQuest(v.id);
      if (qm) {
        g.fillStyle = '#ffcb3d'; g.strokeStyle = '#2a2100'; g.lineWidth = 2; g.beginPath(); g.arc(X + 15, Y - 12, 8, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#2a2100'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(qm === 'new' ? '!' : '?', X + 15, Y - 8);
      }
    });
    // the way home, when home is off the edge of the map
    if (!inWin(homeC.x, homeC.y)) {
      const dx = homeC.x - p.x, dy = homeC.y - p.y, m = Math.max(Math.abs(dx) / (MW / 2 - 6), Math.abs(dy) / (MH / 2 - 4));
      const hx = sx(p.x + dx / m + .5), hy = sy(p.y + dy / m + .5);
      g.fillStyle = '#e0463f'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, 8, 0, 7); g.fill(); g.stroke();
      outlined(g, '🏠 Study Village: ' + Math.round(Math.hypot(dx, dy)) + ' tiles ' + compass(dx, dy), Math.max(110, Math.min(MW * MS - 110, hx)), hy + (hy < 60 ? 24 : -14), 12, '#ffe9a8');
    }
    // you
    const px = sx(p.x + .5), py = sy(p.y + .5), pulse = (Math.sin(performance.now() / 220) + 1) / 2;
    g.fillStyle = 'rgba(255,59,78,' + (0.35 - pulse * 0.25) + ')'; g.beginPath(); g.arc(px, py, 10 + pulse * 10, 0, 7); g.fill();
    g.fillStyle = '#ff3b4e'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.stroke();
    outlined(g, 'YOU', px, py - 13, 12, '#fff');
  }
  function toggleMap(force) {
    const el = q('#bigMap');
    const open = force === undefined ? el.classList.contains('hidden') : force;
    if (open) { closeModals(); keys.length = 0; padHeld.dir = null; markSeen(); bigBase = null; el.classList.remove('hidden'); mapOpen = true; drawBigMap(); }
    else { el.classList.add('hidden'); mapOpen = false; }
  }
  function npcName(id) { const n = npcById(id); return n ? n.name : ''; }
  function villageName(id) { return VILLAGE_NAMES[id] || ''; }

  function tallOverlay(g, x, y) {
    if (kindAt(x, y) === K.TALL) {
      g.save(); g.beginPath(); g.rect(x * TS, y * TS + 14, TS, TS - 14); g.clip();
      g.drawImage(tallFront[biomeAt(x, y)], x * TS, y * TS); g.restore();
    }
  }
  function drawPlayer(g) {
    const frame = p.moving ? (p.leg ? 1 : 2) : 0;
    drawPerson(g, p.px, p.py + (p.moving ? -Math.abs(Math.sin(p.t * Math.PI)) * 1.5 : 0), PLAYER_LOOK, p.dir, frame);
    tallOverlay(g, p.x, p.y); if (p.moving) tallOverlay(g, p.fx, p.fy);
    if (p.excl > 0) {
      g.fillStyle = '#ff3b4e'; g.beginPath(); g.arc(p.px + 16, p.py - 10, 9, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('!', p.px + 16, p.py - 5);
    }
  }
  function drawFollower(g) {
    if (typeof player === 'undefined' || !player.starter) return;
    const sp = starterSp(), st = stageOf(levelOf(player.xp)), im = spriteImg(sp, st, false);
    const bob = Math.sin(anim * 5) * 1.2, size = 26 + st * 2;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(f.px + 16, f.py + 29, 9, 3, 0, 0, 7); g.fill();
    if (im.complete) g.drawImage(im, f.px + 16 - size / 2, f.py + 30 - size + bob, size, size);
    tallOverlay(g, f.x, f.y);
  }
  function drawRoamer(g, r) {
    const im = spriteImg(r.sp, 0, r.shiny), bob = Math.sin(anim * 4 + r.id) * 1.5;
    const fade = Math.min(1, r.age * 2, Math.max(0, r.life));
    g.globalAlpha = fade;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(r.px + 16, r.py + 29, 9, 3, 0, 0, 7); g.fill();
    if (im.complete) g.drawImage(im, r.px + 3, r.py + 3 + bob - (r.moving ? Math.abs(Math.sin(r.t * Math.PI)) * 4 : 0), 26, 26);
    if (r.shiny) {
      g.fillStyle = '#ffe066'; const tw = (Math.sin(anim * 6 + r.id) + 1) / 2;
      g.globalAlpha = fade * tw; g.fillRect(r.px + 2, r.py + 2, 3, 3); g.fillRect(r.px + 26, r.py + 8, 2, 2); g.fillRect(r.px + 22, r.py - 2, 3, 3);
    }
    g.globalAlpha = 1;
    tallOverlay(g, r.x, r.y);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (!worldActive() || !cssW) return;
    if (mapOpen) { drawBigMap(); return; }       // the world holds still while you read the map
    update(dt); render();
  }

  function resize() {
    const wrap = q('#worldWrap'), cw = wrap.clientWidth; if (!cw) return;
    dpr = window.devicePixelRatio || 1;
    const ch = Math.round(Math.max(300, Math.min(window.innerHeight * 0.62, 580)));
    cssW = cw; cssH = ch; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    Z = Math.max(0.8, Math.min(1.5, cw / (15 * TS)));
  }
  window.addEventListener('resize', () => { if (worldActive()) resize(); });

  function enter() {
    paused = false; keys.length = 0; padHeld.dir = null; closeModals();
    if (wstate.hearts < 1) wstate.hearts = 5;
    // the world was made much bigger: positions saved on the old small map no longer mean anything
    if (wstate.mapV !== MAPV) { wstate.mapV = MAPV; wstate.x = null; wstate.y = null; saveWorld(); }
    let sx = wstate.x, sy = wstate.y;
    if (!(Number.isInteger(sx) && Number.isInteger(sy)) || blockedTile(sx, sy)) { sx = SPAWN.x; sy = SPAWN.y; }
    if (!p.moving && (p.x !== sx || p.y !== sy || steps === 0)) placePlayer(sx, sy, p.dir);
    resize(); updateDeckSelect(); zoneNow = -1; lastBlk = ''; markSeen(); drawMini();
    const z = zoneAt(p.x, p.y); zoneNow = z; banner(ZONES[z].name);
    villageNow = null; checkVillage(false);
    updateHud();
    if (!running) { running = true; requestAnimationFrame(loop); }
    // a short moment of peace right after entering
    grace = Math.max(grace, 1.5);
  }

  /* a few lookups the quest system needs */
  const npcInfo = id => npcById(id) || null;
  const villageNpcs = vid => npcs.filter(n => n.id && n.village === vid);
  const zoneNames = () => ZONES.filter((z, i) => i !== VILLAGE).map(z => z.name);
  function zonesFor(id) { return ZONES.filter(z => z.mons[id]).map(z => z.name); }

  return {
    enter, afterEncounter, cancelEncounter, toast, zonesFor, updateHud, resize, npcName, villageName, npcInfo, villageNpcs, zoneNames,
    _debug: { p, roamers, kind, biome, W, H, K, TS, ZONES, VILLAGES, GEN_V, chunks, kindAt, biomeAt, villageSpec, signText, toggleMap, talkToNpc, teleport: (x, y) => { placePlayer(x, y); wstate.x = x; wstate.y = y; }, trigger: (id, shiny) => triggerEncounter(ALL_SPECIES.find(s => s.id === id), !!shiny, null, zoneAt(p.x, p.y)), pickSpecies, zoneAt, spawnRoamer, npcs, signs, buildings, get steps() { return steps; } }
  };
})();
