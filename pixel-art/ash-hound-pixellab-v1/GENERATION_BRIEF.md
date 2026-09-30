# アッシュハウンド — PixelLab 32×32制作仕様

## 用途

- 石の層に登場する突進型の通常敵。
- 右向き待機姿勢、透過背景、32×32原寸。
- ゲーム上では約46px表示されるため、原寸と8倍表示の両方で判定する。

## キャラクター要件

- 痩せた犬。低く横長の胴、大きい頭と顎、短い四脚、高く巻いた二股の尾。
- あばらが浮き、走ると灰の粉が舞う。群れない獣として単体でも強く見える。
- 首を前へ突き出し、前脚へ重心を寄せ、直線突進型と分かる姿勢。
- 灰黒色の毛、石灰色の露出部、青紫の影、鈍い琥珀色の眼、口内は暗い赤褐色。
- 焼けた犬、炎の犬にはしない。発光は眼と口の奥にごく少量だけ使う。

## ピクセル制約

- 32×32へ直接生成する。高解像度生成、縮小、アンチエイリアスは禁止。
- 外周は連続した1px。二重輪郭、黒い内部線の乱用、輪郭の欠けを禁止。
- 13色を目標とし、上限16色。透明色は数えない。
- 大きな同色クラスターを優先し、1pxのノイズ、ディザリング、散ったハイライトを避ける。
- 眼は1〜2px。口と顎を顔の主情報にし、歯は少数のまとまりで表す。
- 腹下の負の空間で四脚を区別する。脚を縦棒として等間隔に並べない。
- 接地線を揃え、耳、鼻、尾、足先をキャンバス端から1px以上離す。

## 生成プロンプト

> Native 32x32 pixel art sprite of an ash hound, a gaunt hostile dog-like dungeon monster facing right in a low forward-leaning idle pose. Oversized angular head and jaw, compact long torso, four short readable legs separated by negative space, high curled forked tail, exposed uneven ribs, ash-charred fur. Dark charcoal and muted blue-violet shadows, limestone bone accents, tiny dull amber eye, restrained dark rust-red mouth. Large deliberate pixel clusters, crisp single-pixel selective outline, no antialiasing, no dithering, transparent background, side view, fully contained silhouette, game-ready sprite.

## 除外要件

> no upscaled illustration, no smooth painting, no soft edges, no thick outline, no double outline, no isometric view, no three-quarter view, no cute puppy proportions, no wolf mane, no horns, no armor, no flame-covered body, no ground tile, no cast shadow, no loose particles outside the silhouette, no cropped ears tail or feet

## 候補選定

候補は一度に8案までとし、次の順で落とす。

1. 1倍表示で犬と読めない。
2. 突進方向が読めない。
3. 顎、巻き尾、四脚のいずれかが欠ける。
4. 外周が2px以上に太る、または切れる。
5. 色数が16色を超える。
6. 顔や胴に孤立ピクセルが多い。

残した案だけを1px単位で修正し、原寸PNG、8倍プレビュー、パレット、検査結果を同じフォルダへ保存する。
