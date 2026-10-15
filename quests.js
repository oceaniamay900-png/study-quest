'use strict';
/* Study Quest: quests.
   Villagers hand out quests. Progress is counted from game events:
     Quests.event('catch', { zone, sp })   a creature was caught
     Quests.event('answer', { streak })    a study question was answered correctly
     Quests.event('zone', { zone })        the player walked into a region
     Quests.event('village', { id })       the player walked into a village
     Quests.event('talk', { npc })         the player talked to a villager
     Quests.event('beat', { npc })         the player won a battle against a villager
     Quests.event('level', { level })      the partner's level changed
     Quests.event('step')                  the player walked one tile
   Everything is saved in wstate.quests (part of the saved world). */

const Quests = (() => {
  const q = s => document.querySelector(s);

  /* type: catch | answer | streak | visit | village | tour | talk | beat | level | explore
     n = how many are needed (default 1). zone = only count in that region. after = another quest that must be finished first. */
  const LIST = [
    // ----- Study Village (home) -----
    { id: 'first', giver: 'quill', title: 'First Friend', type: 'catch', n: 1, xp: 40,
      pitch: 'Every great Studydex starts with a single page. Catch your first wild creature!', done: 'Splendid! Look at that, your Studydex has a page already.' },
    { id: 'dex5', giver: 'quill', after: 'first', title: 'A Growing Collection', type: 'catch', n: 5, xp: 80,
      pitch: 'Now let us fill a few more pages. Catch five creatures in total, wherever you like.', done: 'Marvellous! Five new friends. You are a natural.' },
    { id: 'tour', giver: 'quill', after: 'dex5', title: 'Village Tour', type: 'tour', n: 4, xp: 120,
      pitch: 'Scholars should travel! Visit four different villages (this one counts). Look for the little houses on the map (press M).', done: 'You have seen the world! Take this, you have earned it.' },
    { id: 'warm', giver: 'bookworm', title: 'Brain Warm-up', type: 'answer', n: 10, xp: 30,
      pitch: 'Reading is my life. Prove you are a reader too: answer 10 study questions correctly.', done: 'Ten right answers! My kind of person.' },
    { id: 'streak3', giver: 'maple', title: 'On a Roll', type: 'streak', n: 3, xp: 40,
      pitch: 'In battle, answer three questions in a row without a slip. A streak does double damage!', done: 'A streak! That is the Study Quest spirit.' },
    { id: 'champ', giver: 'maple', after: 'streak3', title: 'The Mayor’s Challenge', type: 'beat', npc: 'bookworm', xp: 60,
      pitch: 'Bookworm has never lost a study battle. Challenge them and talk to them, then choose Battle!', done: 'Ha! You beat the Bookworm. The village is proud.' },
    { id: 'pip', giver: 'pip', title: 'Where Is Pinecrest?', type: 'village', village: 'pinecrest', xp: 30,
      pitch: 'My cousin lives in Pinecrest, in Whisperwood to the west. Can you go and say hi? Press M to see the map!', done: 'You went all that way for me? Thank you!' },

    // ----- Pinecrest -----
    { id: 'pine_catch', giver: 'hazel', title: 'Mushroom Menace', type: 'catch', zone: 'Whisperwood', n: 2, xp: 50,
      pitch: 'Little creatures keep nibbling my mushrooms. Catch two creatures in Whisperwood, the forest around here.', done: 'My mushrooms are safe! Well, safer.' },
    { id: 'pine_msg', giver: 'hazel', after: 'pine_catch', title: 'An Acorn for Nils', type: 'talk', npc: 'nils', xp: 60,
      pitch: 'Please take this acorn to Nils the ice fisher in Frostholm, up in the Frostfen Tundra (north-east of the middle of the map).', done: 'He says thank you? Wonderful! Here is your reward.' },
    { id: 'pine_ans', giver: 'fennel', title: 'Woodsman’s Riddles', type: 'answer', n: 20, xp: 60,
      pitch: 'The forest teaches patience. Answer 20 study questions correctly and I will teach you my best trick.', done: 'Twenty! The trees would be proud.' },

    // ----- Frostholm -----
    { id: 'frost_catch', giver: 'nils', title: 'Ice Fishing Trouble', type: 'catch', zone: 'Frostfen Tundra', n: 2, xp: 60,
      pitch: 'Wild things keep stealing my fish. Catch two creatures in the Frostfen Tundra, the snowy lands around here.', done: 'No more fish thieves. Brr-illiant work!' },
    { id: 'frost_streak', giver: 'ingrid', title: 'Five Alive', type: 'streak', n: 5, xp: 80,
      pitch: 'My bread rises best when I am focused. Get a streak of five correct answers in a single battle.', done: 'Five in a row! Fresh bread for the champion.' },

    // ----- Petalburg -----
    { id: 'petal_catch', giver: 'sakura', title: 'Petal Collector', type: 'catch', zone: 'Blossom Grove', n: 2, xp: 60,
      pitch: 'The Blossom Grove creatures are the prettiest. Catch two of them for me!', done: 'They are even prettier up close. Thank you!' },
    { id: 'petal_visit', giver: 'momo', title: 'Hot Stuff', type: 'visit', zone: 'Ember Peaks', xp: 70,
      pitch: 'I have always wondered what the volcano looks like. Walk into the Ember Peaks (north-east) and tell me.', done: 'Lava rivers? Ooh. Maybe I will stay here. Thank you!' },

    // ----- Sandrock -----
    { id: 'sand_catch', giver: 'cora', title: 'Cactus Crew', type: 'catch', zone: 'Dusty Dunes', n: 2, xp: 60,
      pitch: 'Out in the Dusty Dunes live the spikiest, funniest creatures. Catch two of them!', done: 'Spiky and sweet. Perfect.' },
    { id: 'sand_beat', giver: 'rasheed', title: 'Desert Duel', type: 'beat', npc: 'cora', xp: 70,
      pitch: 'Cora thinks she is the best around. Challenge her to a study battle and show her otherwise!', done: 'Ha! Cora’s face! Worth every coin.' },

    // ----- Reedhaven -----
    { id: 'reed_catch', giver: 'moss', title: 'Swamp Patrol', type: 'catch', zone: 'Murkmire Swamp', n: 2, xp: 60,
      pitch: 'Gloomy things glow in the Murkmire Swamp at night. Catch two for science.', done: 'Marvellous. They glow even in jars.' },
    { id: 'reed_level', giver: 'tilly', title: 'Grow Up Strong', type: 'level', n: 5, xp: 50,
      pitch: 'A strong partner is a studied partner. Get your partner up to level 5.', done: 'Level 5! Look at them shine.' }
  ];
  const BY_ID = {}; LIST.forEach(x => BY_ID[x.id] = x);

  /* ---------- endless quest chains ----------
     Once a villager has run out of hand-written quests they keep giving new ones, in story chapters of four linked quests.
     Quest number n for villager X is always the same (it is made from X and n), so nothing needs saving except how far along each villager is. */
  const ARC = 4, ROMAN = ['I', 'II', 'III', 'IV'];
  const THEMES = [
    { name: 'The Lost Recipe', steps: [
      { t: 'explore', pitch: 'I have lost my grandmother’s recipe book! It must have fallen out of my bag somewhere out on the road. Could you walk around and keep an eye out for it?', done: 'You found a page! It is only the first one, but it is a start.' },
      { t: 'catch', pitch: 'The page mentions a rare berry, but hungry creatures keep eating mine. Could you deal with them?', done: 'The berries are safe now. Next I need the rest of the pages.' },
      { t: 'answer', pitch: 'The next page is written in a tricky code that only a sharp mind can read. Warm up your brain and come back to me.', done: 'You cracked the code! The recipe is almost complete.' },
      { t: 'streak', pitch: 'One last test before I trust you with the secret ingredient: show me a flawless streak.', done: 'The recipe is complete, thanks to you! Everybody will eat well tonight.' }] },
    { name: 'The Garden Mystery', steps: [
      { t: 'catch', pitch: 'Something keeps trampling my garden at night. I think it is a creature. Catch one and we will see if it is the culprit.', done: 'Not the culprit, but a nice find. The footprints are still a mystery.' },
      { t: 'explore', pitch: 'Those footprints lead away from the village. Follow the road and see where they go.', done: 'So that is where it went! Interesting. I want to know more.' },
      { t: 'talk', pitch: 'Please ask {other}. They live nearby and might have seen something.', done: 'They saw a shadow near the fence. We are getting closer!' },
      { t: 'answer', pitch: 'To catch the shadow I need a clear head. Answer some study questions to sharpen both our minds.', done: 'It was a lost little creature all along. It lives in my garden now. Thank you!' }] },
    { name: 'The Travelling Festival', steps: [
      { t: 'visit', pitch: 'We are planning a festival and it needs decorations from far away. Walk into the {zone} and see what is there.', done: 'Wonderful ideas! We will make lanterns just like that.' },
      { t: 'catch', pitch: 'Festival visitors love seeing creatures. Catch a few for the parade.', done: 'The parade is going to be fantastic.' },
      { t: 'answer', pitch: 'We need a quiz night for the festival! Practise your study questions so you can host it.', done: 'You will make a fine quiz host.' },
      { t: 'beat', pitch: 'The festival finale is a friendly study battle against {other}. Will you take part?', done: 'What a finale! The whole village is cheering for you.' }] },
    { name: 'The Old Map', steps: [
      { t: 'explore', pitch: 'I found an old map in the attic, but half of it is blank. Go and explore, then come back and tell me what you saw.', done: 'That fills in a corner of the map. Thank you!' },
      { t: 'talk', pitch: 'The map has a symbol I do not understand. {other} might. Could you ask?', done: 'Aha, it means a hidden place. Now we are getting somewhere.' },
      { t: 'visit', pitch: 'The hidden place is somewhere in the {zone}. Walk in and see if it feels right.', done: 'Yes, that matches the map. The secret is out there somewhere!' },
      { t: 'answer', pitch: 'The last clue is a riddle. Sharpen your mind with study questions and I will tell you the riddle.', done: 'You solved it. The map is complete, and it is all thanks to you.' }] },
    { name: 'The Apprentice', steps: [
      { t: 'answer', pitch: 'I want to train an apprentice, and I think it should be you. First, show me you can answer study questions.', done: 'Good! You have the head for it.' },
      { t: 'streak', pitch: 'A real scholar stays calm under pressure. Get me a streak of correct answers in one battle.', done: 'Calm and quick. I am impressed.' },
      { t: 'beat', pitch: 'Now for a real test. Beat {other} in a study battle.', done: 'You beat them! You are ready for the last lesson.' },
      { t: 'catch', pitch: 'The final lesson is about creatures. Catch some, and learn from each of them.', done: 'You have finished your apprenticeship. I could not be prouder!' }] },
    { name: 'The Storm Is Coming', steps: [
      { t: 'explore', pitch: 'The sky looks strange. Please walk around and check that all the paths nearby are safe.', done: 'The paths are fine for now. Thank you for looking.' },
      { t: 'catch', pitch: 'Creatures get restless before a storm. Catch a few so they stay safe with us.', done: 'They will be warm and dry. Good work.' },
      { t: 'streak', pitch: 'The storm cloud is following me, and only a streak of clever answers can chase it away!', done: 'It worked! The cloud is leaving.' },
      { t: 'answer', pitch: 'Just to be sure the storm does not come back, keep your mind busy with study questions.', done: 'The sky is clear. You saved the day!' }] }
  ];
  const strHash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => { let h = strHash(seed); return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const GEN = {};
  function genQuest(npcId, n) {
    const id = 'g:' + npcId + ':' + n;
    if (GEN[id]) return GEN[id];
    const info = typeof World !== 'undefined' ? World.npcInfo(npcId) : null;
    if (!info) return null;
    const r = rng(id), arc = Math.floor(n / ARC), step = n % ARC;
    const theme = THEMES[(strHash(npcId) + arc) % THEMES.length], sd = theme.steps[step];
    const mates = World.villageNpcs(info.village).filter(m => m.id !== npcId);
    const zones = World.zoneNames();
    let type = sd.t, other = null;
    if (type === 'talk') other = mates[0] || null;
    if (type === 'beat') other = mates.find(m => m.battle) || null;
    if ((type === 'talk' || type === 'beat') && !other) type = 'answer';
    const x = { id, gen: true, idx: n, giver: npcId, type, title: theme.name + ' ' + ROMAN[step], done: sd.done };
    x.xp = 5 * Math.round((40 + Math.min(n, 24) * 6 + 5 * Math.floor(r() * 3)) / 5);
    const pick = a => a[Math.floor(r() * a.length)];
    switch (type) {
      case 'explore': x.n = Math.min(240, 40 + step * 20 + arc * 10 + 10 * Math.floor(r() * 4)); break;
      case 'catch': x.n = 1 + (r() < .5 ? 0 : 1) + (arc >= 2 ? 1 : 0); if (r() < .5) x.zone = pick(zones); break;
      case 'answer': x.n = Math.min(40, 8 + 3 * step + 2 * arc + Math.floor(r() * 5)); break;
      case 'streak': x.n = Math.min(7, 3 + (step >= 2 ? 1 : 0) + (arc >= 2 ? 1 : 0) + Math.floor(r() * 2)); break;
      case 'visit': x.zone = pick(zones); break;
      case 'talk': case 'beat': x.npc = other.id; break;
    }
    x.pitch = sd.pitch.replace('{other}', other ? other.name : 'a neighbour').replace('{zone}', x.zone || pick(zones));
    return GEN[id] = x;
  }
  const byId = id => BY_ID[id] || (id.startsWith('g:') ? (() => { const m = /^g:(.+):(\d+)$/.exec(id); return m ? genQuest(m[1], +m[2]) : null; })() : null);

  const need = x => x.n || 1;
  const st = () => { const w = wstate; if (!w.quests) w.quests = {}; const s = w.quests; s.a = s.a || {}; s.d = s.d || {}; s.vis = s.vis || {}; s.c = s.c || {}; return s; };
  const toast = (m, ms) => { if (typeof World !== 'undefined') World.toast(m, ms); };

  const isDone = id => !!st().d[id];
  const isActive = id => st().a[id] !== undefined;
  const progress = id => st().a[id] || 0;
  const isReady = id => { const x = byId(id); return !!x && isActive(id) && progress(id) >= need(x); };

  /* the hand-written quests for a villager, then (once those are all done) the next quest in their endless chain */
  const forNpc = npcId => {
    const base = LIST.filter(x => x.giver === npcId);
    if (!base.every(x => isDone(x.id))) return base;
    const g = genQuest(npcId, st().c[npcId] || 0);
    return g ? base.concat(g) : base;
  };
  const available = npcId => forNpc(npcId).filter(x => !isDone(x.id) && !isActive(x.id) && (!x.after || isDone(x.after)));
  const activeFor = npcId => forNpc(npcId).filter(x => isActive(x.id) && !isReady(x.id));
  const readyFor = npcId => forNpc(npcId).filter(x => isReady(x.id));
  const activeList = () => Object.keys(st().a).map(byId).filter(Boolean);
  const readyCount = () => activeList().filter(x => isReady(x.id)).length;

  /* '!' = new quest, '?' (gold) = hand it in, '?' (grey) = in progress */
  function markerFor(npcId) {
    if (readyFor(npcId).length) return 'ready';
    if (available(npcId).length) return 'new';
    if (activeFor(npcId).length) return 'active';
    return null;
  }

  function describe(x) {
    const n = need(x), zone = x.zone ? ' in ' + x.zone : '';
    switch (x.type) {
      case 'catch': return `Catch ${n} creature${n > 1 ? 's' : ''}${zone}`;
      case 'answer': return `Answer ${n} study question${n > 1 ? 's' : ''} correctly`;
      case 'streak': return `Get a streak of ${n} correct answers in one battle`;
      case 'visit': return `Walk into ${x.zone}`;
      case 'village': return `Visit the village of ${(typeof World !== 'undefined' && World.villageName(x.village)) || x.village}`;
      case 'tour': return `Visit ${n} different villages`;
      case 'talk': return `Talk to ${(typeof World !== 'undefined' && World.npcName(x.npc)) || x.npc}`;
      case 'beat': return `Beat ${(typeof World !== 'undefined' && World.npcName(x.npc)) || x.npc} in a study battle`;
      case 'level': return `Reach level ${n}`;
      case 'explore': return `Explore: walk ${n} steps`;
      default: return x.title;
    }
  }

  function accept(id) {
    const x = byId(id); if (!x || isActive(id) || isDone(id)) return;
    const s = st();
    s.a[id] = 0;
    if (x.type === 'tour') s.a[id] = Math.min(need(x), Object.keys(s.vis).length);
    if (x.type === 'level' && typeof levelOf === 'function') s.a[id] = Math.min(need(x), levelOf(player.xp));
    saveWorld(); refreshHud();
  }

  function turnIn(id) {
    const x = byId(id); if (!x || !isReady(id)) return null;
    const s = st(); delete s.a[id]; s.d[id] = 1;
    if (x.gen) s.c[x.giver] = Math.max(s.c[x.giver] || 0, x.idx + 1);
    saveWorld();
    if (typeof addXp === 'function') addXp(x.xp);
    refreshHud();
    return x;
  }

  function bump(x, value) {
    const s = st(), before = s.a[x.id] || 0, nv = Math.min(need(x), value);
    if (nv <= before) return;
    s.a[x.id] = nv;
    saveWorld();
    if (nv >= need(x)) toast(`✅ Quest ready: “${x.title}”. Go back to ${(typeof World !== 'undefined' && World.npcName(x.giver)) || 'the quest giver'}!`, 4600);
    else if (x.type !== 'answer' && x.type !== 'explore') toast(`📜 ${x.title}: ${nv}/${need(x)}`, 2200);
    refreshHud();
  }

  function event(type, d) {
    d = d || {};
    const s = st();
    if (type === 'village') { s.vis[d.id] = 1; saveWorld(); }
    for (const id of Object.keys(s.a)) {
      const x = byId(id); if (!x || s.a[id] >= need(x)) continue;
      const cur = s.a[id] || 0;
      if (x.type === 'explore') {                       // walking is counted quietly: saving and redrawing on every single step would be wasteful
        if (type !== 'step') continue;
        s.a[id] = cur + 1;
        if (cur + 1 >= need(x)) { saveWorld(); toast(`✅ Quest ready: “${x.title}”. Go back to ${(typeof World !== 'undefined' && World.npcName(x.giver)) || 'the quest giver'}!`, 4600); refreshHud(); }
        else if ((cur + 1) % 20 === 0) { saveWorld(); toast(`📜 ${x.title}: ${cur + 1}/${need(x)} steps`, 1800); refreshHud(); }
        continue;
      }
      switch (x.type) {
        case 'catch': if (type === 'catch' && (!x.zone || d.zone === x.zone)) bump(x, cur + 1); break;
        case 'answer': if (type === 'answer') bump(x, cur + 1); break;
        case 'streak': if (type === 'answer') bump(x, d.streak || 0); break;
        case 'visit': if (type === 'zone' && d.zone === x.zone) bump(x, 1); break;
        case 'village': if (type === 'village' && d.id === x.village) bump(x, 1); break;
        case 'tour': if (type === 'village') bump(x, Object.keys(s.vis).length); break;
        case 'talk': if (type === 'talk' && d.npc === x.npc) bump(x, 1); break;
        case 'beat': if (type === 'beat' && d.npc === x.npc) bump(x, 1); break;
        case 'level': if (type === 'level') bump(x, d.level || 0); break;
      }
    }
  }

  /* ---------- quest log window ---------- */
  function refreshHud() { if (typeof World !== 'undefined') World.updateHud(); renderLog(); }
  function renderLog() {
    const box = q('#questList'); if (!box) return;
    box.innerHTML = '';
    const act = activeList();
    if (!act.length) {
      const p = document.createElement('p'); p.className = 'sub';
      p.textContent = 'No active quests. Villagers with a yellow ! above their head have a quest for you.'; box.appendChild(p);
    }
    act.forEach(x => {
      const row = document.createElement('div'); row.className = 'quest' + (isReady(x.id) ? ' ready' : '');
      const h = document.createElement('strong'); h.textContent = (isReady(x.id) ? '✅ ' : '📜 ') + x.title;
      const d = document.createElement('div'); d.className = 'small'; d.textContent = describe(x);
      const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('div'); fill.style.width = Math.min(100, progress(x.id) / need(x) * 100) + '%'; bar.appendChild(fill);
      const meta = document.createElement('div'); meta.className = 'small';
      const giver = (typeof World !== 'undefined' && World.npcName(x.giver)) || '';
      meta.textContent = `${progress(x.id)}/${need(x)} · from ${giver} · reward ${x.xp} XP` + (isReady(x.id) ? ' · hand it in!' : '');
      row.append(h, d, bar, meta); box.appendChild(row);
    });
    const foot = q('#questDone'); if (foot) foot.textContent = `Completed: ${Object.keys(st().d).length} quests · villagers keep giving new ones, so there is always another quest`;
  }

  return { LIST, BY_ID, need, describe, isDone, isActive, isReady, progress, available, activeFor, readyFor, activeList, readyCount, markerFor, accept, turnIn, event, renderLog };
})();
