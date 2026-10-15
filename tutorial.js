'use strict';
/* Study Quest: the "how to play" tutorial.
   New players are asked once whether they want it (they can skip). The ❓ Help button in the top bar replays it any time. */

const Tutorial = (() => {
  const q = s => document.querySelector(s);
  const KEY = 'tutorialDone';

  const STEPS = [
    { pic: '👋', title: 'Welcome to Study Quest!', html: `
      <p>You and your partner creature explore a big world. You <b>learn by battling</b>: every question from your own study notes is an attack.</p>
      <p>This takes about a minute. You can skip it now and open it again later with <b>❓ Help</b>.</p>` },
    { pic: '📚', title: '1. Add your study notes', html: `
      <p>On the <b>Home</b> screen, drop in a file (<b>.pdf .txt .csv .md .json</b>) or paste your notes. Each file becomes a <b>deck</b> of cards.</p>
      <ul><li><code>term: meaning</code> becomes a definition question</li><li><code>Q:</code> and <code>A:</code> lines are asked as written</li></ul>
      <p>No notes handy? Press <b>Try a sample deck</b>.</p>` },
    { pic: '🌍', title: '2. Explore the world', html: `
      <p>Press <b>🌍 Explore</b> on a deck. Then:</p>
      <ul><li><b>Arrow keys</b> or <b>W A S D</b> to walk (on a phone use the pad)</li><li><b>Space</b> or <b>Enter</b> to talk to people and read signs</li><li>Walk through <b>tall grass</b> or bump into <b>wandering creatures</b> to start a battle</li><li>The red-doored <b>Study Center</b> in the village heals your partner</li></ul>` },
    { pic: '⚔️', title: '3. Battles', html: `
      <p>A question appears. <b>Answer right</b> and your partner attacks. <b>Answer wrong</b> and you lose a heart ❤️, and the card comes back soon.</p>
      <ul><li>Three right in a row = <b>critical hit</b> 🔥</li><li>Knock a wild creature out and you <b>catch</b> it for your Studydex</li><li>Typos are forgiven when you type answers</li><li>In a battle, keys <b>1 to 4</b> pick the multiple choice answers</li></ul>` },
    { pic: '🏘️', title: '4. Villages and quests', html: `
      <p>There are <b>six villages</b>. Villagers with a yellow <b>!</b> over their head have a <b>quest</b> for you: catch creatures, answer questions, visit places, or deliver a message.</p>
      <ul><li>Talk to them and choose <b>📜 Quest</b> to accept it</li><li>A grey <b>?</b> means you are working on it, a gold <b>?</b> means go back and hand it in</li><li>Press <b>J</b> or <b>📜 Quests</b> to see your quest log</li><li>Rewards are XP, and your partner heals when it levels up</li></ul>` },
    { pic: '🥊', title: '5. Battle the villagers', html: `
      <p>Most villagers will happily <b>battle you</b>. Talk to them and choose <b>⚔ Study battle</b>.</p>
      <ul><li>It works like a normal battle, but you can't catch their creature</li><li>Win for <b>bonus XP</b> (a big prize the first time)</li><li>You can rematch a villager after a short wait</li></ul>` },
    { pic: '🗺️', title: '6. Map and chat', html: `
      <p>Press <b>M</b> to open the <b>big map</b>: you will see every region, every village, a red dot for you and a <b>!</b> where quests are waiting. Press <b>M</b> again to close it.</p>
      <p>The <b>💬 chat</b> in the bottom-right corner is shared with everyone who is playing right now. Be kind! Press <b>Esc</b> to leave the chat box and walk again.</p>
      <p><b>📝 Review</b> shows the cards you still need to learn. Have fun!</p>` }
  ];

  let i = 0, mode = 'help';
  const done = () => { try { return !!JSON.parse(localStorage.getItem('sq_' + KEY)); } catch { return false; } };
  const markDone = () => { try { localStorage.setItem('sq_' + KEY, 'true'); } catch { /* ignore */ } };

  function render() {
    const s = STEPS[i];
    q('#tutPic').textContent = s.pic;
    q('#tutTitle').textContent = s.title;
    q('#tutBody').innerHTML = s.html;      // fixed text above, never user input
    const dots = q('#tutDots'); dots.innerHTML = '';
    STEPS.forEach((_, k) => { const d = document.createElement('i'); if (k === i) d.className = 'on'; dots.appendChild(d); });
    q('#tutBack').style.visibility = i === 0 ? 'hidden' : 'visible';
    const last = i === STEPS.length - 1;
    q('#tutNext').textContent = i === 0 && mode === 'offer' ? 'Show me how to play ▶' : last ? 'Got it! ✔' : 'Next ▶';
    q('#tutSkip').textContent = last ? 'Close' : mode === 'offer' && i === 0 ? 'Skip tutorial' : 'Skip';
    q('#tutSkip').style.display = last ? 'none' : '';
  }
  function open(m) { mode = m; i = 0; render(); q('#tutorial').classList.remove('hidden'); q('#tutNext').focus(); }
  function close() { q('#tutorial').classList.add('hidden'); markDone(); }
  function next() { if (i >= STEPS.length - 1) return close(); i++; render(); }
  function back() { if (i > 0) { i--; render(); } }

  q('#tutNext').onclick = next;
  q('#tutBack').onclick = back;
  q('#tutSkip').onclick = close;
  document.addEventListener('keydown', e => {
    if (q('#tutorial').classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    e.stopPropagation();
  }, true);
  q('#btnHelp').onclick = () => open('help');

  /* asked once per browser: first thing a new player sees after choosing a partner */
  function offer() { if (!done()) open('offer'); }

  // someone who already has a partner (an existing player) is offered it once too
  if (typeof player !== 'undefined' && player.starter) setTimeout(offer, 300);

  return { open, offer, done };
})();
