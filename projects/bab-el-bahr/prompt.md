# Bab El Bahr (Gate of the Sea) — full adapted prompt

Preset: `anime-cinematic` (skills/motion-design/references/anime/anime-cinematic.md). Original story and characters. No dancing.
Status: **draft. Nothing generated.**

## Settings

- 20 s, 16:9, 6 shots, **60 fps delivery** (60 distinct frames per second in the file, verified with ffprobe).
- Generate each shot at the highest native fps the chosen model offers, then interpolate to 60 fps. Inspect fast motion (shot 5 whip pan) for ghosting.
- Departure from the user template: "on twos (12 fps feel)" is dropped for character and camera motion, because the user asked for very smooth 60 fps with many frames, and interpolating on-twos animation would erase the held-drawing look anyway. Drawn smears and one impact frame stay as accents.
- References for every shot: the character sheets for Selma and Hamid plus the style frame.
- Audio: original score plus synchronized effects, no narration.

## Prompt

```text
STYLE: Hand-drawn 2D anime in the spirit of high-budget theatrical anime.
Clean ink linework with varying line weight, cel shading with two to three
tone steps, painted backgrounds with soft atmospheric depth, volumetric light
rays, rim lighting, light film grain, subtle chromatic aberration at the
frame edges.

ANIMATION: Fluid, full animation with natural weight and timing, smooth
continuous camera moves, hair and cloth follow-through, drifting particles
(jasmine petals, sea mist, dust in light shafts), multi-plane parallax,
slow push-ins, one whip pan, a slight dutch angle in shot 4. Drawn smear
frames only on the whip pan and one impact frame on the hand clasp.

CONCEPT: At dawn in Algiers, a quiet taxi driver drives his daughter to the
airport on the morning she leaves to study abroad. He cannot say goodbye, so
he gives her the prayer beads that have hung from his mirror for twenty years.

CHARACTERS (match the attached sheets exactly in every shot):
- Selma Benali, 19: olive skin, shoulder-length dark curly hair in a loose
  low ponytail with loose strands, hazel-green eyes, thick eyebrows, mustard
  knit sweater under an open dark-green parka, small silver khamsa earrings,
  a battered sky-blue suitcase.
- Hamid Benali, 56: her father, weathered olive skin, salt-and-pepper short
  hair, thick greying moustache, stubble, deep-set brown eyes with crow's
  feet, grey wool flat cap, brown leather jacket worn pale at the elbows.
- Signature prop: a string of 33 amber prayer beads with a dark green tassel,
  hanging from the rear-view mirror of his yellow taxi (an old boxy
  unbranded 1990s sedan, yellow body, dented, a small "TAXI" roof sign with
  no readable lettering).

PALETTE: dawn pink and peach sky, white buildings with pale blue shutters,
deep teal shadows, Mediterranean blue sea, taxi yellow as the main accent,
warm amber glow on the beads.

SHOTS:
1. (0-3s) Wide establishing shot at dawn: Algiers, the white city, stepped
   facades with blue shutters above the bay, sea mist, gulls. A small yellow
   taxi winds down a hillside road. Slow multi-plane parallax push-in toward
   the taxi. Light: first sun on the rooftops, the lower streets still in
   teal shadow. Sound: gulls, sea wind, a distant engine; the score begins
   with a single oud note.

2. (3-6s) Inside the taxi, close-up: Hamid's weathered hands on a cracked
   steering wheel; the amber prayer beads swing from the mirror and catch a
   glint of sunlight. In the mirror, Selma's eyes in the back seat, looking
   out of the window. Slow push-in on the mirror. Sound: engine hum, the
   soft click of the beads.

3. (6-10s) Selma's view through the side window, smooth tracking shot: the
   city waking. A baker stacks round loaves of bread, old men drink mint tea
   at a café, a boy kicks a ball against a wall, laundry on balconies. Her
   reflection overlaps the glass. Light: low sun shafts between buildings,
   dust in the light. Sound: muffled street life, a qanun line joins the oud.

4. (10-13s) Two-shot through the windscreen, slight dutch angle: Selma leans
   forward and opens her mouth to speak; Hamid keeps his eyes on the road,
   jaw tight, moustache trembling once. Behind them the Martyrs' Memorial
   rises against the sunrise. Light: backlit rim light on both faces.
   Sound: the music drops out, only the engine and her breath.

5. (13-17s) Airport kerb, wind blowing. Hamid lifts the prayer beads off the
   mirror and presses them into Selma's palm, folding her fingers closed with
   both his hands. Whip pan to her face as tears well; curls and the parka
   whip in the wind, jasmine petals cross the frame. One impact frame on the
   hand clasp. Sound: a wind gust, a plane roaring overhead, strings swell.

6. (17-20s) Inside the empty taxi: Hamid alone; the mirror is bare, only the
   faint shadow of the beads still swaying. In the mirror's reflection a
   plane climbs over the bay. He smiles slightly and wipes his eye with his
   thumb. Slow pull-back out through the windscreen to a wide frame of the
   small yellow taxi by the sea. Hold on the final composition.
   Sound: the score resolves on oud and strings; gulls; the plane fades.

AUDIO: Original emotional instrumental score in a North African style
(oud, qanun, soft strings, a quiet darbuka heartbeat), building to shot 5
and resolving in shot 6, plus synchronized sound effects: gulls, sea wind,
engine, bead clicks, street ambience, a plane. No narration. Do not
reproduce any existing song.

NEGATIVE: no 3D render look, no abstract geometric shapes, no cubes, no
floating circles, no chained or linked objects, no UI panels, no text
overlays, no readable signs or logos, no photorealism, no plastic skin, no
extra fingers, no deformed hands, no face or outfit drift between shots, no
flat vector look, no stock-footage feel, no watermark, no dancing.
```
