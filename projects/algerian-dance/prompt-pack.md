# Zerzaya — free-tool prompt pack

Paste-ready prompts for any image/video generator with a free tier. Nothing here has been generated. Free-tier limits, watermarks and commercial-use terms change; check each provider's current terms.

## Workflow

1. **Character sheets (image tool).** Generate Amel, Jeddi Mokhtar and Yacine, plus a style frame. Keep the best result of each. Free image tools usually give several tries a day.
2. **Per-shot video (image-to-video tool).** Start each clip from a still, not text-only. Generate the shot's first frame as an image (character sheet + shot description), then animate it with the shot's motion prompt. Clips of 3-5 s fit the 6 shots.
3. **Assemble** in a free editor (CapCut, DaVinci Resolve, or ffmpeg) in shot order, add music and effects.
4. **60 fps.** Interpolate the finished cut. With ffmpeg:
   `ffmpeg -i cut.mp4 -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1" -c:v libx264 -crf 16 out60.mp4`
   For better results on fast motion, use a frame-interpolation model (e.g. RIFE) instead. Check the result with `ffprobe` before calling it 60 fps, and inspect for ghosting on the dance shots.

## Style block (start of every prompt)

```text
Hand-drawn 2D anime in the spirit of high-budget theatrical anime. Clean ink
linework with varying line weight, cel shading with two to three tone steps,
painted backgrounds with soft atmospheric depth, volumetric light rays, rim
lighting, light film grain. Warm golden-hour palette: orange sunset key light,
deep indigo shadows, whitewashed walls, turquoise doors, red accent.
```

## Negative prompt (use the negative field if the tool has one, otherwise append)

```text
3D render, CGI, photorealistic, plastic skin, abstract geometric shapes, cubes,
floating circles, chained or linked objects, UI panels, text, watermark, extra
fingers, deformed hands, face drift, outfit change, flat vector, stock footage
```

## Character sheet prompts (image tool)

**Amel.** `[Style block] Character turnaround sheet on a plain light background: Amel, a 16-year-old Algerian girl, slim, long black braid tied with a red thread, dark brown eyes, indigo school smock over a cream blouse, worn white sneakers, a red scarf around her neck. Full-body front, side, three-quarter and back views, plus a front face close-up and a three-quarter face, a happy and a determined expression. Colour swatches along the bottom. Consistent style across all views.`

**Jeddi Mokhtar.** `[Style block] Character turnaround sheet on a plain light background: Jeddi Mokhtar, a 74-year-old Algerian man, silver moustache, white skullcap, faded blue jacket, kind tired eyes, holding a wooden mandole. Full-body front, side, three-quarter and back views, face close-ups neutral and smiling, colour swatches.`

**Yacine.** `[Style block] Character sheet on a plain light background: Yacine, a 21-year-old Algerian man, lean, short wavy black hair, warm brown eyes, cream shirt with rolled sleeves, dark trousers. Front, side and three-quarter full-body views and a face close-up, shown as a slightly translucent memory figure in soft sea light.`

**Style frame.** `[Style block] Wide shot of a whitewashed Casbah of Algiers at golden hour, stepped terraces down to the sea, a turquoise door, rooftop terrace with laundry lines, drifting petals, no people.`

## Shot prompts (image-to-video; first frame made from the sheet)

Each prompt: attach the character image, then `[Style block]` + the text below + negative prompt.

1. (3 s) `Wide establishing shot, slow parallax push-in from the Casbah rooftops down through a window into a small house; a table with three plates and one untouched chair; Amel sets a fourth plate. Soft sea wind, petals drifting.`
2. (3 s) `Close-up of Amel's dark eyes and hands lifting a red scarf from the chair and tying it around her neck; a glint of sunlight; the scarf lifts in a gentle wind; slow push-in.`
3. (4 s) `Terrace at golden hour. Jeddi Mokhtar sits with a mandole on his knees, hands still. Amel kneels and places his palm on the wooden body, tapping a rhythm on it with her fingers. Camera orbits slowly, rim light.`
4. (4 s) `Medium tracking shot. Jeddi Mokhtar's fingers begin to move on the strings. Amel rises and starts to dance, small steps that grow, smooth fluid motion, hands and hips in rhythm, scarf trailing, rooftops turning behind her, warm dust.`
5. (3 s) `Low-angle shot, dutch angle. Amel spins and leaps at the peak of the dance with the scarf streaming like a sail; for one beat a translucent young man's silhouette dances beside her in the sea light, then dissolves into petals; drawn smear and speed lines on the spin only.`
6. (3 s) `Slow pull-back to a wide frame: grandfather playing the mandole, Amel laughing out of breath, the fourth plate steaming on the table behind them; petals settle; hold on the final composition.`

## Music (do not reproduce an existing song)

Use a track you own or have licensed, a verified Creative Commons track with its licence checked, or an original instrumental generated in an Algerian chaabi/Andalusi style (mandole, oud, darbuka, claps): quiet mandole line at the start, building with the dance, resolving at the end.
