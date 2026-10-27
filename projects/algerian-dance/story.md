# "Zerzaya" — original story (draft, nothing generated)

Original characters and story, written for the anime-cinematic preset. Not based on any existing work or recording.

## Logline

In the Casbah of Algiers, a girl keeps her missing brother's place at the table and her deaf grandfather's songs alive, and on one golden evening she dances the memory back into the house.

## Characters

- **Amel** (16): lean, quick, a stubborn kid with a long black braid tied with a red thread, dark brown eyes, an indigo school smock over a cream blouse, worn white sneakers. Signature prop: **her brother's red scarf**.
- **Jeddi Mokhtar** (74): her grandfather, a retired oud and mandole player who lost most of his hearing. Silver moustache, white skullcap, faded blue jacket, kind tired eyes. He has not played since.
- **Yacine** (absent): Amel's older brother, who left on a small boat across the sea three years ago. Seen only in memory and as a silhouette in the sea light.

## Setting

A whitewashed Casbah house with a turquoise door, a narrow stairway street and a rooftop terrace over the sea, golden hour.

## Themes

Memory, absence, family, and music that can be felt without being heard. The tone is warm and quietly sad, ending in hope rather than answers: nobody comes back, but the house sounds alive again.

## Story (20-second wordless version, 6 shots)

1. **The empty chair (0-3s).** Wide parallax push-in on the Casbah at golden hour, down into the house: three plates on the table, one chair untouched. Amel sets a fourth plate anyway.
2. **The scarf (3-6s).** Close-up on her eyes and hands: she lifts Yacine's red scarf from the chair and ties it round her neck. A glint of sun; the scarf moves in a wind that has no window.
3. **The silent mandole (6-10s).** Jeddi Mokhtar sits on the terrace with the mandole on his knees, hands still. Amel kneels, puts his palm on the wooden body and taps the beat on the wood with her fingers so he can feel it.
4. **The dance begins (10-14s).** Feeling the vibration, his fingers move. Amel rises and starts to dance: small steps that grow, the scarf trailing, the Casbah rooftops turning behind her.
5. **Yacine in the light (14-17s).** At the peak of a spin and a leap, a drawn impact frame: for one beat the scarf streams like a boat sail and a young man's silhouette stands in the sea light beside her, dancing the same step, then dissolves into petals.
6. **The house sounds alive (17-20s).** Pull back to a wide frame: grandfather playing, Amel laughing out of breath, the fourth plate now steaming. Hold on the composition.

A longer cut (45-60 s) can expand shots 1 and 5 (the day of the departure, the letter that never arrived) without changing the ending.

## Music direction

Original instrumental in an Algerian chaabi/Andalusi-influenced style (mandole, oud, darbuka, claps), starting almost silent (a single mandole line) and building with the dance. Not a recording of any existing song. Source: an original or licensed track.

## Technical plan: 60 fps first

- Target delivery: **60 fps**. Video models generate at roughly 24-30 fps natively, so the plan is to generate at the model's native rate and then frame-interpolate to 60 fps. The delivered file's fps will be measured before it is called 60 fps.
- Dance shots (4, 5) are animated smoothly on ones. Smears and on-twos are limited to accents and cuts.
- Per-shot clips of 3-4 s, each conditioned on the character sheet and a style frame, assembled in order.
- First step in Higgsfield, read-only: list models, check the maximum fps, duration and reference inputs. No generation yet.

## Order of work (nothing has been run)

1. Connect Higgsfield (user authenticates).
2. Read-only model discovery: confirm fps and reference limits.
3. Character sheets: Amel, Jeddi Mokhtar, Yacine, plus the scarf and a style frame. Show them for approval.
4. Only after approval: per-shot video, interpolation to 60 fps, music and sound mix, and an inspection report.
