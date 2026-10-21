# Kakooma sound pack v02 / v02b: sources and licences

Every sound in `dist/kk_sfx.ogg` / `dist/kk_sfx.m4a` is built only from the recordings below, and **all of them are CC0 1.0**
(public domain dedication). No attribution is needed, but credits are listed anyway. Nothing used needs a sign-up or payment
(Freesound HQ previews download without an account; GitHub, BigSoundBank and Kenney are open downloads).
Synthesis is **not** used for any audible layer; the only generated signal is the 2 ms sync marker, which is never played.
Processing (resampling to pitch, filters, envelopes, transient shave, mixing, baked limiting) is in `tools/build.py` and `tools/sprite.py`.
Licence texts and page evidence are in `src/licences/`. The Freesound pages were checked from this box on 2026-10-20 (each shows
the CC0 1.0 licence link); the full download log, including descriptions, is `tools/fs_sources.tsv`.

| # | file (in `src/`) | origin (URL) | author | licence / evidence | used in |
|---|---|---|---|---|---|
| 1 | `fs/317848_Bubbles_Pop_Mouth_Lips_Smack.ogg` | https://freesound.org/people/benniknop/sounds/317848/ | benniknop | CC0 1.0, `src/licences/freesound_317848.txt` | the main tuned "bloop": correct, roundStart, streak_*, newBest, hop, makeTen, cheer, labPair_*, star, quizStart |
| 2 | `fs/842794_Pops_Bubbles_.ogg` | https://freesound.org/people/justamudkip/sounds/842794/ | justamudkip | CC0 1.0, `freesound_842794.txt` | bloops (same sprites as #1) |
| 3 | `fs/181907_Mouth_Plops.ogg` | https://freesound.org/people/CapsLok/sounds/181907/ | CapsLok | CC0 1.0, `freesound_181907.txt` | tap, count_0-4, partPop_*, pulse_1/2, lowTime, timeUp, slide_2-4, labPair_2-4, quizStart, bond |
| 4 | `fs/188797_Mouth_Pop.ogg` | https://freesound.org/people/qubodup/sounds/188797/ | qubodup | CC0 1.0, `freesound_188797.txt` | wrong, pulse_0, roundStart, timeUp, hop, count_0/1, slide_0/1, labPair_0/1, newBest, bond |
| 5 | `fs/242113_Pop_or_bloop.ogg` | https://freesound.org/people/ScratchnSniff/sounds/242113/ | ScratchnSniff | CC0 1.0, `freesound_242113.txt` | low bloops in roundStart, timeUp, newBest |
| 6 | `fs/387952_Water_straw_bubbling_2.ogg` | https://freesound.org/people/giddster/sounds/387952/ | giddster | CC0 1.0, `freesound_387952.txt` | high water blips: ticks, penalty, count_5-9, fizz trails (streak_*, newBest, cheer, star, makeTen, timeUp, clear), replay, partPop_*, slide_6/8, bond |
| 7 | `fs/515919_Mouth_plops.ogg` | https://freesound.org/people/C-V/sounds/515919/ | C-V | CC0 1.0, `freesound_515919.txt` | uiTap, high blips (tick_2, count_7-9, slide_7/9, penalty), fizz trails, replay |
| 8 | `fs/59978_Bubble_Pop.ogg` | https://freesound.org/people/OGMeek/sounds/59978/ | OGMeek | CC0 1.0, `freesound_59978.txt` | high blips: count_5, slide_5, labPair_1-4, fizz trails, penalty, replay |
| 9 | `fs/96125_Bubbles_Single2.ogg` | https://freesound.org/people/BMacZero/sounds/96125/ | BMacZero | CC0 1.0, `freesound_96125.txt` | the real rising bubble stream under bond and newBest |
| 10 | `vsco/LLVln_Pizz_{G4,C5,E5,A5,E6,A6}_f_RR1.wav`, `LLVln_Pizz_C7_f.wav` | VSCO-2-CE `Strings/Solo Violin/Pizz/`, https://github.com/sgossner/VSCO-2-CE | Versilian Studios (Sam Gossner) | CC0 1.0, repo `LICENSE` → `src/licences/VSCO-2-CE_LICENSE.txt` | soft pizzicato "body" under the pops: correct, wrong, roundStart, lowTime, timeUp, streak_*, newBest, hop, makeTen, partPop_*, pulse_*, labPair_*, star, quizStart |
| 11 | `vsco/Marimba_hit_Outrigger_{F3,C4,G4,B4,F5,C6}_loud_01.wav` | VSCO-2-CE `Percussion/Marimba/` (same repo) | Versilian Studios | CC0 1.0 (same) | light wood body only: wrong, roundStart, timeUp, newBest, count_*, makeTen, pulse_* |
| 12 | `bsb/bsb_0648.mp3` "Champagne cork #2" | BigSoundBank https://bigsoundbank.com/champagne-cork-2-s0648.html | Joseph Sardin | CC0 (page: "CC0 (public domain)"), `src/licences/bigsoundbank_s0648_page.txt` | the cork / mouth "pop!": cheer, star, roundStart, timeUp, streak_10/20, newBest, makeTen |
| 13 | `kenney/casino-audio__card-fan-1.ogg` | Kenney "Casino Audio" https://kenney.nl/assets/casino-audio | Kenney | CC0, `src/licences/kenney_casino-audio_License.txt` | cheer only (a faint confetti rustle, −14 dB under the cork) |

**v02b:** the new `countTen` accent uses no new files. It is built from #4 (qubodup "Mouth Pop", Freesound 188797, a plop
tuned to C5) and #10 (VSCO-2-CE pizzicato C5 and A5 → C6). All are CC0 and already listed above.

**v02c:** `total` uses no new files either: pops from #1 (benniknop 317848, bloops), #2 (justamudkip 842794), #3/#4 (mouth plops)
and #6-#8 (water blips for the fizz), plus #10 (VSCO-2-CE pizzicato). All are CC0 and listed above.

Freesound files are the site's HQ previews (OGG ~192 kb/s, or MP3 for a few), not the original uploads. That's plenty for
pops this short, which are then encoded at 36 kb/s Opus anyway.

**Removed since v01** (no longer in the mix): VSCO xylophone, glockenspiel, tubular bell, triangle, bell tree, wind chimes, slit drum
and wood clicks; Kenney interface drop / RPG page-flip / cloth; OGA plop and paper; Freesound #683101 woosh.

**Downloaded but not used** (kept in `src/` for later tuning, all CC0 and checked on their pages, see `tools/fs_sources.tsv`):
Freesound 258269, 47498, 168861, 683100, 683102, 174718, 273870, 156907, 166986, 611642, 389626, 392624, 335358, 676000,
664872, 447910, 32264, 56036, 868713; VSCO-2-CE KSHarp A4/C5/A6/D6 and the `p` pizz layers; Kenney interface drops; OGA plops.

Fonts in the preview MP4 only: DejaVu Sans (Bitstream Vera / DejaVu licence, system font). They aren't shipped.
