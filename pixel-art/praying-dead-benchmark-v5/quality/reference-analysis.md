# プレイングデッド再作画

主基準は承認済み `stone-benchmark-v2/crawling-dead-32.png`。添付リファレンスは頭身と小型敵の情報密度を補助する。

- 32×32セル。本体は横27×縦25px。クロウリングデッドの30×20pxと同程度の面積・同じ足元。
- 頭部を最大形、合掌を第二の焦点、裾を低い台形として読む。合掌の負の空間と中央の暗線を必須とする。
- 黒紫1px輪郭。フード、骨、帯は各2〜3段の連続した面。1pxは眼のみ。
- 13色。色相は独自、階調数と役割はクロウリングデッドに合わせる。
- 不採用: 多角形だけの粗い面、背が高い立像、長い指、細かな布目、高解像度イラストの単純縮小。
- 静止待機1枚。アニメーションは今回対象外。


## Final quality gate

- SHIP: 32×32 canvas / 27×25 body including contour / 13 visible colors / binary alpha.
- SHIP: the hood dominates the silhouette; skull profile and clasped hands remain separate at 1×.
- SHIP: exact 4× nearest-neighbor comparison aligns the apparent pixel size with Crawling Dead and the Tiny RPG benchmark.
- SHIP: no isolated opaque pixels and no edge-touching pixels.

- SHIP: exposed edge pixels are converted to a one-pixel inner dark-purple contour; the eye is a two-pixel vertical dark socket matching Crawling Dead.
