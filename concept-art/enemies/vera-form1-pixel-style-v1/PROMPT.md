# ヴェラ第1形態・添付ドット絵テイスト

2026-10-10。内蔵 image_gen 使用。添付の暗いフード人物のドット絵をテイスト参照、既存vera-v1をキャラクター参照として制作。

成果物：vera-form1-pixel-style-01.png。ゲーム用のネイティブ48px素材ではなく、ドット絵調のコンセプト画像。元画像は保持、ゲーム未反映。

## 最終プロンプト

Use case: style-transfer. Image 1 is the PRIMARY visual style and pixel-density reference. Image 2 is Vera's identity reference only. Make one new rendition of Vera first form as a VERY LOW RESOLUTION chunky pixel character matching image 1 closely. Prioritize image 1's squat 3-head proportions, huge hood, short legs, bulky simple readable clusters and VERY LARGE square pixels. Target a 48x48 conceptual grid, enlarged crisply: whole character including bow no more than 42 pixels high. Every visible pixel should be about 1/48 of the square image width. No fine pixel detailing. Black 1-pixel outlines. Only 2 or 3 flat tones per material. About 16 muted colors. No smooth texture, no gradients, no decorative micro-detail.
Vera is a human-sized hooded undead archer with a muted blue-green hood/cape, pale shadowed face with one amber eye, ochre wraps, dark clothes, boots, and an empty brown open quiver on the back. Full body facing right in 3/4 view, one hand extends to hold a large ivory recurve bow, the other pulls the empty string toward cheek. Absolutely no arrow; single amber pixel at pulling fingers. Bow silhouette needs just a few stepped ivory shapes, no intricate chips. Cape just three broad jagged hanging shapes, not many shreds. Arms simple chunky bands, not individual bandage detail. Feet short broad blocks. Preserve empty quiver, hood and bow identity but dramatically simplify the original anatomy and details to match the first reference. Single centered sprite-like illustration on flat #303030 dark gray background, ample margins, bow and feet fully visible. No lantern, sword, armor, lettering, logos, palette, extra views, scene or shadow gradient. This must look like the same game pixel-art style as image 1.

## 確認

初稿は細部が多く、再生成で頭を大きく、脚を短く、布と弓の面を整理。フード、空の矢筒、大弓、空引きの構えを維持。全身と弓先の見切れなし。添付より横幅と明るい象牙色の占有が大きいのは大弓の造形による。生成画像の画素グリッド・16色制限は厳密保証していない。ユーザー確認用のコンセプト案として提示し、採用・実ゲーム用スプライト化・アニメーションは未確定。
