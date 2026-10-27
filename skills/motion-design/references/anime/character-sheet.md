# Anime character sheet

The sheet is the main way to keep a character consistent across shots. If the user already has a character, ask for these views. If they have only one image, generate the missing views from it, and have the user approve the sheet before any video.

## Views and poses to request

Required (minimum set):

1. **Front view, full body**, neutral standing pose, arms slightly away from the body.
2. **Side view, full body** (profile).
3. **Three-quarter view, full body**, the pose most used in shots.
4. **Back view, full body**, so hair, cape or backpack design is fixed.
5. **Face close-up** from the front, plus one three-quarter face, neutral expression, clearly visible eyes.

Strongly recommended:

6. **Expressions**: neutral, determined, surprised, angry or intense, soft smile.
7. **Action pose**: the character doing the signature action (running, drawing a weapon, jumping).
8. **Signature prop** alone, from two angles, and held in the hand.
9. **Outfit details**: close-ups of accessories, emblems, boots and gloves, and any alternate outfit.

## Image requirements

- Plain light or neutral background, no scene, no text.
- Even lighting, no heavy shadows covering the face.
- One consistent art style across all views (the same linework and shading as the target film).
- Colour swatch strip: hair, skin, eyes, main outfit colours, accent.
- Highest resolution available; faces at least a few hundred pixels tall.

## Style frame

One additional frame with the intended environment, lighting and palette (a single key image). It fixes the look of backgrounds and colour for every shot.

## How the references are used

- Attach the sheet (front, three-quarter and face views at minimum) and the style frame to every shot generation, as identity and style references. Check the model's actual schema for how many references it accepts and prefer the three-quarter and face views if there is a limit.
- Repeat the written character block in every shot prompt as well as attaching the images.
- Record the uploaded reference identifiers in the production manifest.
