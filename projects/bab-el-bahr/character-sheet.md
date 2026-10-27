# Bab El Bahr — character sheet

Design spec for the image generator. No images have been generated yet: this session has no image model (no GPU, and the network blocks Hugging Face). Generate each sheet with the prompt below, approve it, then use it as the reference for every shot.

## Selma Benali (19), the daughter

| | |
|---|---|
| Build | Slim, 1.65 m, slightly rounded shoulders when shy, upright when determined |
| Face | Oval face, olive skin, thick dark eyebrows, hazel-green eyes, a small mole under the left eye |
| Hair | Shoulder-length dark brown curly hair in a loose low ponytail, loose curls framing the face |
| Outfit | Mustard-yellow knit sweater, open dark-green parka with a fur-lined hood, dark blue jeans, white sneakers |
| Accessories | Small silver khamsa (hand) earrings; a battered sky-blue hard suitcase with a faded sticker |
| Personality | Observant, quiet, holds back tears, then lets them come |
| Colours | Skin #C8946A, hair #2B1B14, eyes #7A8B4E, sweater #D9A43A, parka #3E5440, suitcase #8EC3E6 |

## Hamid Benali (56), the father

| | |
|---|---|
| Build | Stocky, broad hands, slight stoop from years of driving |
| Face | Square face, weathered olive skin, deep-set brown eyes with crow's feet, thick greying moustache, two-day stubble |
| Hair | Short salt-and-pepper hair under a grey wool flat cap |
| Outfit | Brown leather jacket worn pale at the elbows, cream shirt, dark trousers |
| Prop | 33 amber prayer beads with a dark green tassel, from the taxi mirror |
| Personality | Few words, shows love through actions, eyes say what he won't |
| Colours | Skin #A9764F, hair #8C8C88, cap #6B6B6B, jacket #6A4228, beads #E0952F, tassel #2F5A3A |

## The taxi

Old boxy unbranded 1990s sedan, yellow (#F2C230) with a dented rear door, small roof sign without readable text, cracked brown dashboard, worn beige seats.

## Views to generate

Each character: full-body front, side, three-quarter and back; front and three-quarter face close-ups; expressions (neutral, holding back tears, crying softly, small smile; Hamid also jaw-clenched); hands close-up (Hamid holding the beads). Plus the beads alone from two angles, the taxi exterior and interior, and one style frame.

## Image prompts

**Selma:** `Hand-drawn 2D anime character turnaround sheet, high-budget theatrical anime style, clean ink linework, cel shading with two to three tones, plain light grey background. Selma, a 19-year-old Algerian girl, slim, olive skin, shoulder-length dark curly hair in a loose low ponytail with curls framing her face, hazel-green eyes, thick eyebrows, small mole under the left eye, mustard knit sweater, open dark-green parka with fur-lined hood, dark jeans, white sneakers, small silver hand-shaped earrings. Full-body front, side, three-quarter and back views, front and three-quarter face close-ups, four expressions: neutral, holding back tears, crying softly, small smile. Colour swatches at the bottom. Same design in every view. No text.`

**Hamid:** `Hand-drawn 2D anime character turnaround sheet, high-budget theatrical anime style, clean ink linework, cel shading with two to three tones, plain light grey background. Hamid, a 56-year-old Algerian taxi driver, stocky, weathered olive skin, deep-set brown eyes with crow's feet, thick greying moustache, stubble, short salt-and-pepper hair under a grey wool flat cap, brown leather jacket worn pale at the elbows, cream shirt, dark trousers. Full-body front, side, three-quarter and back views, front and three-quarter face close-ups, expressions: neutral, jaw clenched, eyes wet, small smile. Hands close-up holding amber prayer beads with a dark green tassel. Colour swatches. Same design in every view. No text.`

**Style frame:** `Hand-drawn 2D anime background painting, theatrical anime quality, Algiers at dawn, white stepped buildings with pale blue shutters above a misty Mediterranean bay, pink and peach sky, first sunlight on the rooftops, teal shadows below, a small yellow taxi on a winding hillside road, gulls, volumetric light, film grain. No text.`

Negative for all: `3D render, photorealistic, plastic skin, extra fingers, deformed hands, text, logos, watermark, abstract shapes`.
