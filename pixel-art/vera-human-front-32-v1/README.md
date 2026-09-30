# 人型ヴェラ・32px 初稿

第一形態の概念画を参照し、内蔵画像生成で人型の絵を生成。Pixel Art Studioへ取り込み、原寸32×32pxで弓・弦・顔・手指・矢筒・裾・接地を補正。正本は build.py と reference-generated.png。ゲーム未反映。

front-32.png は32px原寸、front-512.png は16倍ニアレストネイバー、両方RGBA透過。生成画像そのものは原寸32pxではないため、納品原寸は front-32.png を使用する。

確認：二本腕・二本脚、フード、空の矢筒、大弓、矢の無い構え。原寸32px・512px整数拡大・半透明0・使用15色・近似重複なしを検証。弓先と斜め弦に意図的な4近傍孤立判定2点。明るい骨・暗い布、左上の光。陰影は原画から保持し、目・指を原寸で補正。シルエット確認済み。32pxで細部は圧縮されるためデザイン初稿扱い。アニメーション対象外。

## 画像生成プロンプト

Create ONE low-resolution pixel-art sprite of the HUMAN FIRST FORM of the attached archer Vera, in a front-facing battle-ready pose. Attached concept is identity reference. This is the original human revenant, TWO arms TWO legs, not a monster, no extra limbs. Preserve petrol-blue pointed hood and torn short cloak, ivory gaunt human face, tiny amber eyes, charcoal fitted clothing, leather boots, ochre bandages, empty quiver protruding behind left shoulder. Tall wiry archer proportions, about 3.5 heads tall. Upright human chest facing camera, feet apart. Large ivory crescent bow on viewer's RIGHT, fully visible, left of bow the body. Draw arm across chest holding taut string near cheek, NO physical arrow and no projectile. Clean negative space between bow and body. The bow must be narrower than the torso. Cloth silhouette broken into only three broad tails. Source identity must remain recognizable.
The ENTIRE image is a 32x32 LOGICAL PIXEL GRID enlarged uniformly for viewing. Character INCLUDING bow uses about 28x29 logical pixels. Tiny native 32px RPG sprite, square chunky pixel clusters, no detail smaller than one cell, NOT a 128px sprite. Face occupies about 4x5 cells. Use 16 colors: blue-black, 3 charcoal shades, 4 muted petrol teal shades, 4 ivory shades, 3 brown ochre shades, 1 amber. Dimensional 16-bit fantasy RPG sprite, meaningful deliberate pixel clusters and faceted material shading, not flat stick figure. Preserve articulated hand, boots, cloak opening, bow's ivory edge. Outline dark navy one logical pixel with selective light-side contour. All pixels equal size, no soft strokes or gradients or antialiasing, no microtexture, no noisy dither.
Single centered full-body sprite on a completely FLAT solid magenta #ff00ff background for reliable color-key removal. No shadow, no checkerboard, no text, no palette swatches, no comparison figures, no diagrams, no ground. Generous margin on every edge. Entire bow upper and lower tip inside canvas.
