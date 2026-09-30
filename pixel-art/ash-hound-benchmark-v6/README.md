# Ash Hound — 32×32 redesign

石の層のアッシュハウンドを、Tiny RPG参照と承認済みクロウリングデッドの画素密度に合わせて再設計した。

- `ash-hound-32.png`: 32×32原寸、実体30×18px、透過PNG、13色。
- `ash-hound-32@8x.png`: 最近傍8倍の確認用。
- `comparison.png`: Tiny RPG参照、旧16px版、密度基準、新作の比較。
- `sources/ash-hound-compact-master.png`: ImageGenによる粗い論理ピクセルのマスター。
- `build.py`: Pixel Art Studioで論理グリッド復元、色整理、内側1px輪郭、眼と肋骨を固定する再生成手順。
- `quality/`: 参照分析、統計、シルエット、品質ゲート。

高解像度イラストの単純縮小ではなく、粗いブロックマスターを30×18の論理グリッドへ復元した。輪郭はシルエットを外へ膨らませず、既存形状の内側だけに1pxで通している。
