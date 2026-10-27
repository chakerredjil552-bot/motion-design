# Anime cinematic

Preset ID: `anime-cinematic`. Aliases: anime, anime short, hand-drawn anime, cel animation, anime trailer.

Hand-drawn theatrical anime: inked linework, cel shading, painted backgrounds, drawn smears and impact frames, carried by one consistent character.

Best for: Anime shorts, trailers, openings, character reveals and story beats.

**Original authored preset.** Unlike the ten gallery presets, this has no Higgsfield source example, archived source prompt or preview. It is not in `assets/presets.json` or the gallery, and it must not be described as a source-based adaptation. Do not add a source claim to it.

## Intake

Essential: a one-sentence story or moment, and a character. Ask for the character sheet; if there is none, generate one first using [character-sheet.md](character-sheet.md) and stop for approval of it.

Optional: palette, setting, mood, music genre, duration, aspect ratio.

Reuse existing context. Do not ask the user for camera or timing terms.

## Departures from the skill defaults (deliberate)

1. **Shot-by-shot generation.** The skill default is one full-film request. Anime needs per-shot character locking and clear camera moves, so this preset generates one clip per shot (3–5 s each), every clip conditioned on the character sheet and style frame, then assembles them in order. This is a user-requested departure from production.md's single-request default; record it in `campaign.json` as `generation_strategy: "per_shot_with_character_reference"`. If the user asks for one film request, use the single-request path with the same prompt text.
2. **References are required**, not optional: the approved character sheet plus one style frame.
3. Default 20 s, 16:9, 24 fps feel (deliver at the model's native rate; do not claim 24 fps unless verified). Music plus synchronized effects, no narration.

## Style block (put at the top of every shot prompt, unchanged)

```text
Hand-drawn 2D anime in the spirit of high-budget theatrical anime. Clean ink
linework with varying line weight, cel shading with two to three tone steps,
painted backgrounds with soft atmospheric depth, volumetric light rays, rim
lighting, light film grain, restrained chromatic aberration at the frame edge.
Animated on twos with drawn smear frames on fast motion, impact frames,
speed lines, hair and cloth follow-through, drifting particles, multi-plane
parallax, slow push-ins, whip pans, occasional dutch angles.
```

Describe style by traits. Do not name a living artist or a specific studio as something to copy.

## Character block (every shot)

```text
{{CHARACTER}}: {{AGE_AND_BUILD}}, {{HAIR}}, {{EYES}}, {{OUTFIT}}, {{SIGNATURE_PROP}}.
Match the attached character sheet exactly in every shot: same face shape,
hair silhouette, eye colour, outfit details and proportions.
```

## Shot template

Each shot states subject, action, camera, lighting and sound. A shot with no concrete subject and action is not allowed; abstract shapes are what this preset exists to avoid.

```text
SHOT {{N}} ({{START}}-{{END}}s) — {{SHOT_TYPE}}
Subject/action: {{WHO_DOES_WHAT}}
Camera: {{MOVE}}
Light/colour: {{LIGHT}} against {{PALETTE}}
Anime devices: {{SMEAR / IMPACT_FRAME / SPEED_LINES / PARTICLES}}
Sound: {{SFX_AND_MUSIC_CUE}}
```

## Default 20-second structure (retime to the story)

[0.00–4.00s] Establishing — wide painted environment, slow parallax push-in, character small in frame, atmosphere and particles set the mood.
[4.00–8.00s] Intimate close-up — eyes or hands, wind in hair and cloth, a light glint that motivates the action.
[8.00–12.00s] Build — tracking or low-angle medium shot, the character commits to the action, speed lines begin.
[12.00–16.00s] Climax — the signature action with smear frames and one impact frame, whip pan, strongest colour contrast.
[16.00–20.00s] Resolution — pull back to a wide frame, particles settle, hold on a clean final composition.

## Audio

Orchestral or genre-appropriate score that builds to the climax, with synchronized effects (wind, footsteps, cloth, blade or impact hits). No narration unless asked.

## Negative list (append to every prompt)

```text
No 3D render look, no abstract geometric shapes, no cubes, no floating circles,
no chained or linked objects, no UI panels, no on-screen text, no photorealism,
no plastic skin, no extra fingers, no face or outfit drift between shots,
no flat vector look, no stock-footage feel, no watermark.
```

## Fidelity checks (inspect the rendered motion, not the prompt)

- The character matches the sheet in every shot: face, hair, eye colour, outfit.
- It reads as hand-drawn 2D: visible ink lines, cel shading, no CG gloss.
- Fast moves use drawn smears or impact frames, not generic motion blur.
- Every shot shows a real subject and action; no abstract filler shapes.
- Backgrounds are painted and layered, with parallax rather than a static plate.
- Shots join cleanly: palette, light direction and grain are continuous.

A shot that fails these is repaired or re-generated within the authorized budget, or reported as a departure. Do not relabel it as passing.
