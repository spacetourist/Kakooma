# Kakooma v0.2.3

Maths trainer for Greg Tang's KAKOOMA puzzle. Pick a board (square, pentagon, hexagon or heptagon: 4–7 numbers). Exactly one number is the sum of two others; tap it. 60-second rounds, streaks (Blaze grows at x5, x10 and x20), a 3-second penalty for a wrong tap, and a leaderboard per board.

Play: https://spacetourist.github.io/Kakooma/

- Teaching solves (`src/teach.ts`, `src/plan.ts`): on the first 3 solves of a round, a new best, a x5/x10/x20 streak, the first right answer after a mistake, and on tapping a bond in the Solved tray, the parts burst into counters, make a ten in ten-frames ("7 + 3 = 10", "10 + 9 = 19"), then draw a part-whole bond (about 6 s: the ten-frames, counters and captions fade out in place, the answer rises, the bond builds in ~0.8 s, then the caption lands with one confetti burst and holds 2.5 s while each number pulses in turn). Ten-frames are always full size, up to 3 per row, and each part keeps its own colour. The timer is paused throughout; tap anywhere to skip. Other solves get a quick bounce. Respects `prefers-reduced-motion`.
- Bond Lab: an untimed mode from the menu. Pick a whole from 5 to 20, split its counters (in ten-frames) with the slider, find every pair for a star (`kk.lab.v1`), then try the missing-part quiz.
- `src/puzzle.ts`: generator (unique answer, unique pair, no duplicates; addends 1–20, +3 per extra number). No sum repeats within a round. `npm test` checks 5,000 puzzles per board size and long rounds for repeats.
- Art: GD clean v3 (`design/kakooma/STYLE.md`). Tokens are CSS variables at the top of `src/style.css`; Blaze is `public/assets/img/blaze.png`. Fonts: Fredoka and Nunito, self-hosted under OFL (`public/licenses`).
- Leaderboard: `localStorage` (`kk.board.v1`), top 10 per board, on this device only.
- Testing hooks: `?round=20` shortens a round; `?teach=quick|full` forces the solve style; `?reduced` simulates reduced motion. Sound hooks in `src/sfx.ts` are empty for now (for the audio pack); `scripts/sfx-hooks.mjs` checks when each fires. `node scripts/e2e.mjs [url]` `node scripts/e2e-v011.mjs [url]` and `node scripts/e2e-v021.mjs [url]` run (plus `scripts/solve-time.mjs [url]` for the teaching-solve length and `scripts/handover-v022.mjs [url]` for the frame-by-frame handover check) the headless play-throughs (need playwright-core in /tmp/pw).

`npm i && npm run dev`
