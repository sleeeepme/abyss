# アッシュハウンド native 32px 再設計

- Tiny RPG参照の犬型を、低い胴、大きな頭、短い脚、巻いた尾、少数の大きな色面として分析した。
- 32×32原寸へ直接作画。高解像度原画、縮小、論理グリッド復元を使用しない。
- 設定の「あばらが浮く」は、骨格を露出させず胴の上の3本の明線で表現する。
- 直線突進型は、右向きの楔形頭部と前寄りの重心で示す。
- 石灰色、青紫影、灰褐色、琥珀眼の13色。形状内側の1px暗紫輪郭。
- 旧案の細長い骨犬、高密度の骨線、外側へ膨張する輪郭は不採用。

## Quality gate

- SHIP: native-authored 32×32, no resized source.
- SHIP: 30×22px body with one-pixel cell margin.
- SHIP: 13 visible colors, binary alpha, no isolated pixels.
