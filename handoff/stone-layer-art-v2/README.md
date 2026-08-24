# 石の層アート v3 — 実装用Claude引き継ぎパック

Claude Code にこのフォルダとリポジトリを渡し、`CLAUDE.md` の末尾にある依頼文を実行してください。

## 内容

- `CLAUDE.md`: 実装指示、禁止事項、完了条件
- `manifest.json`: 画像ファイルの役割とアート仕様
- `delivery/atlas.png`: 実装用透過RGBAアトラス
- `delivery/atlas.json`: 全スプライトの切り出し情報
- `delivery/tiles/`: 個別透過PNG 78枚
- `reference/concept-art.png`: 元コンセプトアート
- `reference/stone-layer-sprite-sheet-v2.png`: 採用した部品構成
- `reference/stone-layer-map-sample-v2.png`: 配置イメージ

## 注意

`delivery/` は16pxネイティブ解像度、二値アルファ、指定パレットで機械検証済みです。`reference/` 内の画像は背景を含むため実装には使用しません。

再生成は `python3 tools/generate_assets.py`、検証は `python3 tools/validate_assets.py` です。
