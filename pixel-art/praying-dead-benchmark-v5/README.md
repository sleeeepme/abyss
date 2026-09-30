# Praying Dead — 32×32 benchmark pass

石の層の「プレイングデッド」1体のみを、Tiny RPG Character Asset Pack 02 と承認済みクロウリングデッドの見かけの画素サイズに合わせて制作した。

- `praying-dead-32.png`: ゲーム用原寸。32×32、透過PNG、実体27×25px、13色。
- `praying-dead-32@8x.png`: 最近傍8倍の確認用。
- `comparison.png`: 参照・クロウリングデッドとの正確な4倍比較。
- `sources/praying-dead-compact.png`: ImageGenで作った粗い論理ピクセルのマスター。
- `build.py`: Pixel Art Studioで論理グリッドを復元し、輪郭・色・透過を固定する再生成手順。
- `quality/`: 参照分析、シルエット、統計、品質ゲート。

制作では高解像度イラストを単純縮小せず、マスターに描かれた大きなピクセルブロックから27×25の論理グリッドを復元し、シルエットの内側に1pxの暗紫輪郭を通した。頭巾、横顔の頭蓋、合掌した両手、床に溜まる裾を大きな形として残し、単独のノイズピクセルを使わずに13色へ整理している。
