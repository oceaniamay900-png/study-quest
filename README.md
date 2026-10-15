# ⚡ Study Quest

A study game with collectible, evolving creatures. Load your own notes, answer questions to attack wild creatures, catch them, and level up your partner.

Everything runs in the browser. There is no server, no account and no build step. Your decks and progress are saved in your browser's local storage.

## Put it on GitHub and play it online

1. Create a new repository on GitHub (for example `study-quest`).
2. Upload all the files in this folder (`index.html`, `style.css`, `app.js`, `creatures.js`, `world.js`, `quests.js`, `tutorial.js`, `chat.js`, `parser.js`, `ai.js`, `pdfjs-lib.js`, `pdfjs-worker.js`, `pdfjs-LICENSE.txt`, the `samples` folder (the `vendor` folder is optional), this README).
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute your game is live at `https://YOUR-USERNAME.github.io/study-quest/`.

You can also just open `index.html` on your computer to play it locally.

## How to play

1. Choose a starter creature.
2. Add study files (drag and drop, or paste text).
3. Press **🌍 Explore** on a deck to walk around the world (below), or **⚔ Quick battle** for the classic run through a whole deck.
4. (Classic battle:) A wild creature appears with a question.
   - Correct answer: your creature attacks. Three-in-a-row streaks do double damage.
   - Wrong answer: you lose a heart and the card comes back soon.
4. Defeat a wild creature to catch it for your Studydex. Rare shiny ones appear too.
5. XP levels up your partner. It evolves at level 4 and level 8.
6. The run ends when you clear the whole deck (win) or run out of hearts. You get a list of cards to review.

## The world

- Walk with the arrow keys or WASD (on a phone, use the on-screen pad). Space or the **A** button talks to people and reads signs.
- Wild creatures wander around and also hide in tall grass. Walk into one, or through the grass, to start a battle.
- Each battle uses cards from the deck chosen above the map. Correct answers hurt the creature, wrong answers cost a heart. Wrong cards come back, and the **Review** button lists the ones you still need to learn.
- The world is 128 × 96 tiles with ten regions, each with its own scenery and creatures (51 in total): Sunny Meadows (centre), Whisperwood (west), Frostfen Tundra (north), Crag Heights (east), Dusty Dunes (south-east desert), Murkmire Swamp (south-west), Ember Peaks (north-east volcano with lava), Sunset Shores (south coast), Blossom Grove (cherry trees) and Crystal Caverns (north-west). Signs mark each region, and the Studydex gives a hint where to find each creature. Rare ones are hardier and take more hits to beat.
- Worlds saved on the older, smaller map start you back in the village.
- Hearts come back as you walk, when you level up, or at the red-doored Study Center in the village. If you faint you wake up in the village.

## Villages, villagers and quests

- Besides Study Village in the middle there are five more villages: **Pinecrest** (Whisperwood), **Frostholm** (Frostfen Tundra), **Petalburg** (Blossom Grove), **Sandrock** (Dusty Dunes) and **Reedhaven** (Murkmire Swamp). Each has houses, a sign, a road to the main roads and two villagers.
- Talk to a villager (Space / Enter / the **A** button) and pick from the menu (keys 1 to 4 also work): **Chat**, **Quest**, **Study battle**.
- A yellow **!** over a villager = new quest. Grey **?** = you are on it. Gold **?** = go back and hand it in. Press **J** or **📜 Quests** for the quest log.
- 18 quests: catch creatures (anywhere or in a region), answer questions, get streaks, visit a region or village, deliver a message to a villager in another village, beat a villager, reach a level. Some unlock after another is finished. Rewards are XP (and a level-up heals a heart).
- **Study battles:** the villager sends out a creature and you answer your study cards to beat it. Right answers hurt it, wrong answers cost you a heart. You can't catch it, but the first win gives 50 bonus XP and rematches (after 90 seconds) give 20. If you lose you wake up in the village.
- Quest data lives in `quests.js` (the `LIST`), villagers and villages in `world.js` (`VILLAGES` and the `person(...)` calls).

## The big map (press M)

Press **M** (or the **🗺 Map** button, or click the little map) to see the whole world: every region, every village, a pulsing red dot for you and a **!** on villages where a quest is waiting. Press **M** or Esc to close. The world pauses while it is open.

## Tutorial

After choosing a partner a new player is asked whether they want a short tutorial, and can **Skip** it at any time (Esc also skips). It is shown once per browser. **❓ Help** in the top bar replays it. The text is in `tutorial.js`.

## Chat

The **💬 chat** in the bottom-right corner is shared by everyone who has the game open, on every screen. There is no game server, so it relays through free public MQTT brokers (HiveMQ, then EMQX, then Mosquitto as fallbacks) over secure WebSockets, using a small client built into `chat.js` (no extra libraries). Tabs of the same browser are also linked directly.

- Choose your chat name by clicking it under the message box. Esc leaves the chat box so you can walk again. The little tab shows unread messages when the chat is minimised.
- Messages are shown as plain text only, are limited to 200 characters and one message per second, and anyone who floods the chat is ignored.
- **It is a public relay with no moderation and no accounts.** For a class, change `CHAT_ROOM` at the top of `chat.js` to a long secret phrase that only your group knows. Only people running the game with the same phrase will see each other.
- It needs internet. If the relay can't be reached, the status says "offline" and chat only works between tabs of the same browser.

## Typed answers are forgiving

Spelling mistakes, missing small words ("the", "of"…) and a missing word in a longer answer all still count as correct. A different word in place of the right one, or a wrong number, does not.

## How questions are worded

Each question has a small label so you know what is being asked:

- **Definition**: `term: meaning` lines become "What is “term”?" (flip the cards to see the meaning and name the term).
- **Fill in the missing word**: ordinary sentences have their key term blanked out (names, "X is …" subjects, numbers and technical words are chosen first). Headings, page fragments and web links are skipped. Typed answers show a hint (first letter and length).
- **Question**: `Q:`/`A:` pairs and CSV rows are asked as written.

Wrong choices are picked to look like the right one (similar length, capital letters and numbers) and never repeat words from the question.

## ✨ Tidy with AI (optional)

Press **✨ Tidy** on a deck to have a small AI check every card. It runs in your own browser (WebLLM + WebGPU), so nothing is uploaded and there is no API key. It rewrites confusing cards into clear questions, flags junk (headings, fragments), and shows you every change so you can untick any you disagree with. **↩** next to the deck restores the originals.

- Needs a recent Chrome or Edge on a computer (WebGPU). If not available, the button explains and the rest of the game works as before.
- First use downloads the model once (about 0.4–1 GB) and the browser caches it. It needs internet that first time.
- Rewrites are only accepted if the answer really comes from the original card, so the AI can't invent facts.
- Upload `ai.js` along with the other files.

## ✨ AI writes the questions when you add a file (optional)

Tick **"Let the AI write the questions when I add a file"** on the home screen. For ordinary paragraphs, the AI reads the text section by section and writes proper questions instead of blanking out random words. Lines like `term: meaning` and `Q:`/`A:` are still used exactly as written. You can press **Stop** at any time and the rest of the file uses the basic method.

## 🤔 "Doesn't make sense?" button

During any battle, press **🤔 Doesn't make sense?** next to the question. It opens the original file with the part the question came from highlighted, and lets you edit the question and answer (or delete the card). The edit is saved in the deck straight away. Use the search box to find other parts of the file.

The original text is kept in your browser's storage (up to about 400,000 characters per deck). Decks made before this update don't have it, so add the file again for this feature.

## Supported file formats

| Format | Example |
| --- | --- |
| Term and definition | `Mitochondria: the powerhouse of the cell`, `Term - meaning`, `Term :: meaning` |
| Question / answer pairs | `Q: Capital of France?` then `A: Paris` |
| CSV / TSV | two columns: question, answer (a header row is fine) |
| JSON | `[{"q": "...", "a": "..."}]` |
| PDF | notes with `term: definition` lines, `Q:`/`A:` pairs, or ordinary paragraphs |
| Plain sentences | turned into fill-in-the-blank questions automatically |

PDFs are read in the browser with the bundled pdf.js library (`pdfjs-lib.js` and `pdfjs-worker.js`, which must sit next to `index.html`; if missing the app tries `vendor/`, then CDN copies). Tables are read column by column, so a glossary table (term | definition | example) becomes clean term and definition cards, even when a cell wraps onto several lines. They need selectable text, so scanned images will not work. For Word documents, copy the text and use the paste box. See the `samples` folder for examples.

## Files

- `index.html`: page layout
- `style.css`: look and animations
- `creatures.js`: the original creatures, drawn as SVG (add your own in the `WILD` list, then give it a home in `ZONES` in `world.js`)
- `world.js`: the walkable world (map, villages, villagers, movement, roaming creatures, big map)
- `quests.js`: the quest list and progress tracking
- `tutorial.js`: the how-to-play tutorial
- `chat.js`: the shared chat
- `parser.js`: turns files into flashcards
- `ai.js`: the optional in-browser AI tidy-up
- `app.js`: game logic, saving, sound
- `vendor/`: pdf.js (Mozilla, Apache 2.0 licence) used to read PDFs


## Latest changes
- **Change partner**: any creature you have caught can be your partner (Home screen → 🔄 Change partner, or the Studydex).
- **Answers**: spelling slips are forgiven; only *a / an / the / of* can be left out of short answers; long answers can be shortened if they keep about half the key words; in a comma list any one item (or several) counts.
- **Hints**: 💡 Hint button in every battle. Each hint costs 3 XP off that answer (you still get at least 3).
- **Endless world**: the hand-made map is the middle; everything past it is generated as you walk, with new regions and villages. The map (M) only shows places you have explored.
- **Endless quests**: when a villager runs out of hand-written quests they start a chain of linked quests in four-part stories, for ever.
