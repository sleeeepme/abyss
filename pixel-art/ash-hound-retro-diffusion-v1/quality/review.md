# Retro Diffusion trial — 2026-09-23

## Trial 1: reference_images, RD Pro Default

- Native 32×32, RGBA, no partial alpha; $0.18.
- Visible bounds 30×26 vs approved 28×19; 17 colors vs approved 12.
- Visual review: tail/body/jaw arrangement is recognizable, but the short low dog became tall-legged. Outer outline is too faint and incomplete, and body-to-background contrast is weak. Fails the intended style and scale.
- Keep raw output as diagnostic evidence. Not adopted and not integrated.

## Trial 2 rationale

- Use the approved source as input_image with strength 0.3 instead of reference_images. Retain native 32×32.
- Explicitly preserve occupied size, short legs, compact head and continuous near-black 1px outline.
- This is a separate paid trial, estimated $0.18; total estimate $0.36.
- No manual pixel repaint, resizing down, or palette modification is applied to either raw result.

## Trial 2 result and separate palette derivative

- Raw: native 32×32, bounds 30×19, 33 opaque colors, no partial alpha. Cost $0.18.
- Improved fit compared with trial 1: low body, short legs, square head, curled tail and dark outer silhouette are retained. Subject is 2px wider than the approved reference, with 1px canvas margins.
- Still differs from the approved reference: eye is a larger pale cluster; mouth is a broad dull patch with less clear tooth/jaw separation; ribs are less distinct. This is a trial candidate, not an established quality improvement or adopted sprite.
- A separate Retro Diffusion color_reducer derivative has exactly 12 opaque colors, no partial alpha, and alpha identical to raw. Dithering is disabled. The service counts transparency in its requested palette size, so color_count=13 produces 12 opaque colors; first color_count=12 attempt produced 11.
- Color reduction is free; total paid generation $0.36, returned remaining balance $4.37.
- Enlargement for comparison is nearest-neighbor 8× only. Asset production never used a high-resolution-to-small downscale. No game assets replaced.
