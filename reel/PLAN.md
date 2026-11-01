# Claude Code — self-ad Reel · plan (awaiting OK)

## Music analysis (uploaded track, 60.0 s, AAC 44.1 kHz)

- **Tempo: 98.00 BPM** (least-squares fit on 93 kick onsets: 97.998 BPM, 9 ms rms residual; beat 0 at 0.016 s).
  - Kicks land on every quarter at 98 and add syncopated 16ths (3-3-2 drift pattern).
  - 65.3 BPM (the 2/3 "triplet" reading) only catches 32 % of kicks → rejected.
  - 196 BPM is just the eighth grid: half its beats have no kick → rejected.
  - Bar accents (strongest low end) fall on song beats 1, 5, 9 … → 4/4 bars of 98.
- **Drop: 10.424 s (song beat 17, a downbeat).** Preceded by a 3-bar build from 3.077 s (beat 5) with a
  kick roll on beats 13–14 and a natural one-beat dropout at 9.81 s (−6 dB).
  A second drop at 49.6 s has too little song after it.
- **Excerpt:** song 3.077 → 25.118 s (beats 5 → 41) = build + drop, cut dead just before the beat-41 downbeat.

## Grid

1 beat = 73.469 frames @120 (36.73 @60, 18.37 @30). Every event = round(beat × 73.469).
Total: 14 bars = 56 beats = 34.29 s → **4116 frames** (rounded to a multiple of 4 so the 60/30 fps blends are exact).

Song-time ↔ video-time map (v = video beat, s = song beat):

| video beats | song beats | rate |
|---|---|---|
| v0 → v28 | s5 → s33 | 1× (v0–v5 low-pass sweep; v11–v12 hard-muted) |
| v28 → v32 | s33 → s35 | 0.5× tape varispeed (−12 st) |
| v32 → v38 | s35 → s41 | 1× (snap back) |
| v38 → v56 | — | music off (SFX only) |

## Shot list (frames @120 fps)

| frames | v | scene | action |
|---|---|---|---|
| 0–72 | 0–1 | 1 TERMINAL | teaser: inverted impact frame from 2351 + RGB split |
| 73–219 | 1–3 | | types `> make an ad for yourself` |
| 220 | 3 | | `say less.` slams (cowbell bounce) |
| 294 | 4 | | warning `this ad exceeds the legal amount of cool` |
| 367 | 5 | | `ignoring warning.` (filter fully open by here) |
| 441 | 6 | 2 SHATTER | first crack |
| 588–734 | 8–10 | | kick roll → Delaunay shards launch on each hit, fly at camera, reflecting worlds |
| 808 | 11 | | FREEZE mid-shatter, 1 beat true silence |
| **882** | 12 | | **BOOM = DROP** |
| 882–1028 | 12–14 | 3 ONE-TAKE | W1 MOTION DESIGN → circle |
| 1029–1175 | 14–16 | | W2 GRAPHIC DESIGN → hole in a letter |
| 1176–1321 | 16–18 | | W3 CHARACTER DESIGN → pupil |
| 1322–1468 | 18–20 | | W4 2D ANIMATION → page flip |
| 1469–1615 | 20–22 | | W5 ANIME DESIGN → lit window |
| 1616–1762 | 22–24 | | W6 KINETIC TYPOGRAPHY → letter counter |
| 1763–1909 | 24–26 | | W7 VFX & COMPOSITING + COLOR GRADING → wheel center |
| 1910–2056 | 26–28 | | W8 SOUND DESIGN + BEAT-SYNCED EDITING → speaker cone |
| **2057** | 28 | 4 BULLET-TIME | contact on s33 downbeat, freeze, audio tape-slows |
| 2057–2350 | 28–32 | | orbit through parallax, frozen sparks/debris |
| **2351** | 32 | | SNAP: impact + inverted frames, smears 2353–2360, shockwave |
| 2351–2423 | 32–33 | | shake decays |
| 2424 / 2498 | 33 / 34 | 5 SKILL GRID | panels 1–2 (1 beat each) |
| 2571 / 2608 / 2645 | 35 / 35.5 / 36 | | panels 3–5 (½ beat) |
| 2682 / 2700 / 2718 / 2737 | 36.5–37.25 | | panels 6–9 (¼ beat) |
| 2755–2791 | 37.5–38 | | white-out |
| **2792–2938** | 38–40 | 6 HARD CUT | music dead, black, silence, HUD off |
| 2939–3379 | 40–46 | 7 CLOSING | typing 2957→~3233: `the smarter u are the better results u get with ai` |
| 3380 | 46 | 8 PUNCHLINE | glitch-flash, logo pops in (squash & stretch) |
| 3453–3526 | 47–48 | | awkward hold |
| 3527–3599 | 48–49 | | glances sideways / tilt |
| 3600 | 49 | | bubble `he forced me to say that` |
| 3747 | 51 | | end tag `[@HANDLE]` |
| 4041–4115 | 55–56 | | glitch resolves into frame 0 → seamless loop |

Portal crossings land exactly on 1029, 1176, 1322, 1469, 1616, 1763, 1910, 2057 via one global log-zoom
camera u(t) = k + x + a·sin(2πx)/2π (speed-ramped, never linear, C∞ across boundaries), ±12-frame world overlap.

HUD (frames 0–2791), y ≈ 262–300: `FRAME 00847 / 04116 · 120 FPS · BUGS: 0`; digits step every 4 frames so the
60/30 fps blends never ghost two numbers.

## QA targets

master 1080×1920 / 120 fps / 4116 frames · Reels 60 fps H.264 2058 frames · 30 fps 1029 frames ·
drop at 882 · snap at 2351 · hard cut at 2792 · −14 LUFS, TP ≤ −1 dBTP · only intentional black (2792–2938) and freeze.
