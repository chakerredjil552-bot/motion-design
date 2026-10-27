# Algerian dance — anime-cinematic prompt draft

Status: **draft only. No images, uploads or video jobs have been submitted.** Higgsfield MCP is not connected in this session, so nothing could be generated.

## Open items (need the user)

1. **Character sheet.** The user's character was never attached. The CHARACTER block below is a placeholder proposal; replace it with the real character and supply the views listed in `skills/motion-design/references/anime/character-sheet.md`.
2. **Music.** A track is not chosen. Searching found no Algerian raï/chaabi track verified as free for video use. Do not use a commercial recording without a licence. Options: (a) the user supplies a track they own or licensed, (b) check a Free Music Archive or Wikimedia Commons track's licence page, (c) a licensed library track, (d) generate original music in an Algerian style. The model should not be asked to reproduce an existing song.
3. **60 fps.** Video models output roughly 24–30 fps natively. Plan: generate at native rate, then frame-interpolate to 60 fps and verify the delivered fps. Do not claim 60 fps until verified.
4. **Tension with "12 fps feel".** The request wants both a 12 fps on-twos feel and very smooth 60 fps dancing. Resolution used below: the dance (shots 3-5) is animated smoothly on ones; on-twos and smears are kept for accents and transitions only.

## Settings

20 s, 16:9, delivery target 60 fps (via interpolation). Per-shot generation (3-4 s clips) with the character sheet and a style frame as references. Music plus synchronized effects, no narration.

## Adapted prompt

```text
Hand-drawn 2D anime in the spirit of high-budget theatrical anime. Clean ink
linework with varying line weight, cel shading with two to three tone steps,
painted backgrounds with soft atmospheric depth, volumetric light rays, rim
lighting, light film grain, restrained chromatic aberration at the frame edge.
Dance motion is fluid and continuous with weight, rhythm and hip/shoulder/hand
articulation, hair and cloth follow-through. Smear frames and an impact frame
only on accents and cuts. Multi-plane parallax, slow push-ins, whip pans,
occasional dutch angles. Drifting petals, warm dust and embers.

CONCEPT: A young man dances alone on a rooftop terrace of a whitewashed
Algiers-style Casbah at golden hour, the sea behind him; his dance builds
from a calm sway to a joyful, energetic climax.

CHARACTER (placeholder, replace with the user's sheet): Younger man, lean
athletic build, short wavy black hair, warm brown eyes, cream linen shirt
with rolled sleeves, dark baggy trousers, red scarf around the neck.
Signature prop: the red scarf. Match the attached character sheet exactly
in every shot: face shape, hair silhouette, outfit and proportions.

PALETTE: warm orange sunset key light, deep indigo shadows, whitewashed walls
with turquoise doors, magenta sky accents, red scarf as the accent colour.

SHOTS (20 s):
1. (0-3s) Wide establishing: whitewashed Casbah terraces stepping down to the
   sea at golden hour, slow parallax push-in, tiny figure on a rooftop,
   petals drifting. Sound: soft sea wind, distant call of gulls, the music
   fades in with a lone oud or mandole phrase.
2. (3-6s) Close-up: eyes open, scarf lifts in the wind, a glint of sun on
   the face; he smiles and drops his shoulders into the beat. Sound: darbuka
   pulse enters, soft footstep tap.
3. (6-10s) Medium tracking shot: he begins the dance, a smooth sway with
   steps and hand gestures in time with the rhythm, scarf flowing. Camera
   orbits slowly at waist height, shallow parallax, rim light. Sound: full
   rhythm, clapping, cloth movement.
4. (10-14s) Low-angle wide: energy builds, bigger steps, a spin with the
   scarf trailing in a drawn smear arc, dust and embers kicking up, speed
   lines on the spin only. Sound: percussion intensifies, foot stomps.
5. (14-17s) Dutch-angle medium close shot, whip pan into an impact frame on
   the beat drop, then a joyful leap held at its peak against the sunset.
   Sound: drum hit, brief silence, scarf snap.
6. (17-20s) Slow pull-back to a wide frame, he settles with a bow and a
   laugh, petals and light settle, clean final composition held.
   Sound: music resolves, sea wind.

AUDIO: Algerian-style instrumental (oud/mandole, darbuka, claps) in a
licensed or original track, with synchronized effects. No narration.
Do not reproduce any existing song.

NEGATIVE: no 3D render look, no abstract geometric shapes, no cubes, no
floating circles, no chained or linked objects, no UI panels, no on-screen
text, no photorealism, no plastic skin, no extra fingers, no face or outfit
drift between shots, no flat vector look, no stock-footage feel, no
watermark, no stiff robotic dance, no foot sliding.
```

## Character sheet to produce first

Front, side, three-quarter and back full-body views; front and three-quarter face close-ups; five expressions; a dance pose; scarf close-up; colour swatch strip; plus one style frame of the rooftop at golden hour. Details in `skills/motion-design/references/anime/character-sheet.md`.
