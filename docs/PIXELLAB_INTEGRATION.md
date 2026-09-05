# PixelLab制作連携

PixelLabで生成した画像を、Abyssの制作規則に沿って検査・プレビューするための手順。
APIトークンはファイルへ書かず、実行するシェルの環境変数だけに設定する。

## 初期設定

PixelLabのアカウント画面でAPIトークンを発行し、次のように設定する。

```bash
export PIXELLAB_API_TOKEN='発行したトークン'
```

## 16×16キャラクター候補の生成

```bash
python3 tools/pixellab_abyss.py generate \
  'right-facing idle cave scout, readable silhouette, limited palette, no dithering' \
  --width 16 --height 16 --seed 42 \
  --output output/pixellab/scout-right-idle-v1.png
```

生成APIは非同期である。コマンドは完了までポーリングし、PNGを指定先へ保存する。
生成物は候補であり、検査と目視承認を経るまで `proto/assets/sprites/` へ入れない。

## 検査と4倍プレビュー

通常キャラクターは16×16、中ボスは32×32を指定する。

```bash
python3 tools/pixellab_abyss.py validate \
  output/pixellab/scout-right-idle-v1.png \
  --width 16 --height 16 --max-colors 24 --require-margin

python3 tools/pixellab_abyss.py preview \
  output/pixellab/scout-right-idle-v1.png \
  output/pixellab/scout-right-idle-v1-4x.png
```

検査対象は画像寸法、可視色数、中間アルファの不使用、任意の透明外周である。
輪郭、目の大きさ、標準12×12領域、クラスター品質などの造形規則は目視確認する。

## 高度なAPI機能

参照画像、固定パレット、方向展開、アニメーション、タイル生成などは、公式API仕様に
合わせたJSONを用意して `request` を使う。これによりCLIの更新を待たずに新しい
PixelLabエンドポイントを利用できる。

```bash
python3 tools/pixellab_abyss.py request generate-with-style-v2 payload.json \
  --wait --output output/pixellab/result.png
```

JSONには秘密情報を含めない。認証は常に `PIXELLAB_API_TOKEN` から行う。

## 採用フロー

1. `output/pixellab/` に版番号付きで生成する。
2. `validate` を通し、4倍プレビューを作る。
3. 原寸表示と4倍表示の両方で目視確認する。
4. 承認されたPNGだけを `proto/assets/sprites/` へコピーする。
5. `docs/CHARACTER_ART_LIST.md` に版と状態を記録する。
6. ゲーム本体へのdata URI反映と関連テストは、アート承認後に別途行う。

公式仕様: <https://api.pixellab.ai/v2/docs>
