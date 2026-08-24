# 石の層 v2 — 個別透過PNG

採用済みの `irregular-stone-environment-sprites-v2.png` を変更せず、濃紫背景を透過して描画物ごとに切り出したパックです。

- `sprites/`: カテゴリ別の個別透過PNG（65枚）
- `sprites.json`: ファイル名、寸法、元シート上の切り出し座標
- `source/`: 切り出し元のv2画像
- `reference/`: マップ適用サンプル
- `tools/extract_v2.py`: 同じ成果物を再生成するスクリプト

## 実装時の注意

これはv2画像の忠実な切り出しです。元シートがネイティブ16pxグリッドではないため、オートタイルではありません。壁は `wall_run_*`、`wall_corner_*`、`wall_rubble_*` などのまとまり単位で配置してください。

Canvasでは画像補間を無効にし、元サイズまたは整数倍率で描画してください。

検証は `python3 tools/validate_v2.py` で行えます。
