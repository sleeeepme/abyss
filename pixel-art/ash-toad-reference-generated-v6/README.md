# Ash Toad v6 — review candidate

Built-in ImageGen was conditioned directly on the approved Ash Hound and Crawling Dead images. The prompt requested a tiny, right-facing crouched ash toad with a large folded rear thigh, short foreleg, amber eye and small pale throat; near-black outlines, 12 flat colors, coarse logical pixel clusters, no gradients or texture, with the Hound as the size benchmark.

The generated source did not obey the requested exact 32x32 grid. Its approximately 36x20 coarse grid was sampled at cell centers into `recovered-grid.png`. Eight selected columns and one row were removed to shorten thigh, torso and jaw. `build.py` records these discrete grid edits, palette mapping and eye correction. No smooth resizing was used for the final asset. Preview enlargement uses nearest neighbor only.

`ash-toad-32.png` is the transparent review candidate. `comparison.png` shows approved Hound, Crawling Dead, and new Toad at the same scale, with native size below. This candidate has not been approved or installed into game assets.
