# アッシュトード referenced v4

対象固有の資料収集からやり直した32×32スプライト。
以前のアッシュトード案、コンセプトイラスト、縮小下敷きは使用していない。

## 参照した対象

- [Frogs | Pixel Monsters 17](https://elesrech.itch.io/frogs-pixel-monsters-17) — 約32pxの大小カエル、黒アウトライン、待機・歩行・攻撃
- [Pixel Art Field Enemies](https://dribbble.com/shots/9874600-Pixel-Art-Field-Enemies-Game-Sprite) — 横向きカエルの待機・歩行・舌攻撃
- [Lil Froggy](https://patchworkpx.itch.io/lil-froggy) — 16pxでの眼・胴・脚の省略
- Ragnarok OnlineのPoisonous Toad — ヒキガエル型の低い姿勢と後脚
- 実物のカエル／ヒキガエルの横向きシルエット — 後腿、脛、足先、前脚の接続

参照素材は観察にだけ使用し、画像生成モデルへ入力していない。

## 抽出した特徴

1. 二つの眼丘が頭頂から独立して見える
2. 首がなく、頭と胴が連続する
3. 丸い後腿が身体で最大の塊になる
4. 脛と長い足先が腹下へ折り畳まれる
5. 前脚は細く、後脚から明確に分離する
6. 待機中の喉袋は顎下の色面に留める

3種類の解剖シルエットからBの3/4伏せ姿勢を採用し、4色面を経て12色へ展開した。

- `ash-toad-32.png`: 原寸32×32
- `ash-toad-32-neutral@8x.png`: 中間灰色背景8倍
- `quality/anatomy-silhouettes.png`: 解剖に基づく3案
- `stage-comparison.png`: シルエット、4色面、完成稿
- `benchmark-comparison.png`: 成功作3体との同倍率比較
