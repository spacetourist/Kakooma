# Kakooma v0.1

Maths trainer for Greg Tang's KAKOOMA puzzle. Pick a board (square, pentagon, hexagon or heptagon: 4–7 numbers). Exactly one number is the sum of two others; tap it. 60-second rounds, streaks (Blaze grows at x5, x10 and x20), a 3-second penalty for a wrong tap, and a leaderboard per board.

Play: https://spacetourist.github.io/Kakooma/

- `src/puzzle.ts`: generator (unique answer, unique pair, no duplicates; addends 1–20, +3 per extra number). `npm test` checks 5,000 puzzles per board size.
- Art: GD clean v3 (`design/kakooma/STYLE.md`). Tokens are CSS variables at the top of `src/style.css`; Blaze is `public/assets/img/blaze.png`. Fonts: Fredoka and Nunito, self-hosted under OFL (`public/licenses`).
- Leaderboard: `localStorage` (`kk.board.v1`), top 10 per board, on this device only.
- `?round=20` shortens a round, for testing. `node scripts/e2e.mjs [url]` runs the headless play-through (needs playwright-core in /tmp/pw).

`npm i && npm run dev`
