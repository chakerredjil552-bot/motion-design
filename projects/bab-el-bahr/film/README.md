# Bab El Bahr: the film

A 20-second, 1920×1080, **native 60 fps** 2D animated short, built from the [prompt](../prompt.md) and [character sheet](../character-sheet.md). Every one of the 1,200 frames is painted separately by code. None are interpolated, and no AI video model or stock media is used.

| File | What it does |
|---|---|
| `scene.html` | Paints any frame: `renderFrame(t)` draws time `t` (seconds). Six shots, layered parallax, ink lines, cel shading, rim light, god rays, petals, bloom. |
| `render.js` | Drives headless Chromium through all 1,200 frames and pipes them to ffmpeg, which adds film grain, chromatic aberration and vignette. |
| `audio.py` | Synthesizes the soundtrack: an original score in maqam Hijaz (oud, qanun, strings, darbuka) plus synced effects. |
| `preview.js` | Renders single stills for review: `node preview.js <dir> 1.5 8 11.2` |

## Build

```sh
node render.js ../../../outputs/bab-el-bahr-video.mp4
python3 audio.py ../../../outputs/bab-el-bahr-audio.wav
ffmpeg -i ../../../outputs/bab-el-bahr-video.mp4 -i ../../../outputs/bab-el-bahr-audio.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest bab-el-bahr.mp4
ffprobe -v error -select_streams v -show_entries stream=r_frame_rate,nb_frames -of csv=p=0 bab-el-bahr.mp4   # expect 60/1,1200
```

Rendering takes about 10 minutes on 4 CPU cores. It needs Node with Playwright's Chromium, Python 3 with numpy, and ffmpeg.

## Shots

1. **0–3 s:** dawn over Algiers, the white city above the bay; a yellow taxi winds down the hill; parallax push-in, gulls, sun glitter.
2. **3–6 s:** inside the cab. The amber prayer beads swing and catch a glint; Selma's eyes in the mirror.
3. **6–10 s:** her view through the side window: bakery with round loaves, café, a boy and his ball, laundry, sun shafts.
4. **10–13 s:** backlit profiles, dutch angle, the Martyrs' Memorial at sunrise. She leans in to speak; he can't. The music cuts out.
5. **13–17 s:** his hands lower the beads into hers and fold her fingers shut. An impact frame, a whip pan, the plane climbs.
6. **17–20 s:** the bare mirror holds his wet eyes; he wipes them. The yellow taxi waits alone by the sea.

## Deliberate departures from the prompt

- **Smooth 60 fps instead of "on twos":** The user asked for very smooth 60 fps with many frames, so motion is animated on ones at 60 fps. Smears, the impact frame and the whip-pan smear stay as accents.
- **Shot 5 ends on the plane, not her face:** The whip pan goes up to the plane instead of her tearful face. The hands carry the emotion, and the plane carries the departure.
- **Characters drawn mostly as silhouettes:** Characters appear mainly as rim-lit silhouettes, eyes in the mirror and hands. That suits code-drawn 2D art and keeps them consistent between shots.
