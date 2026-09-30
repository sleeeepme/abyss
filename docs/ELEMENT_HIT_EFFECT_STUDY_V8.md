# 冷気ヒット・霜煙 v8

> **注記（2026-09-12）**: この文書が参照している `output/` 配下の生成物は、
> 後続バージョンで更新済みのため削除しました。最新版は `output/combined-element-effects-v13/` /
> `output/element-hits-v13/` / `output/ally-effects-v3/` にあります。


2026-09-13。v7の炎・雷・魔法を維持し、冷気だけを再設計。

冷気は細い風の線をやめ、乾いた霜を踏んだときの粉煙を基準にする。接触点の低い位置で7個の丸い煙塊が重なって横へ弾け、13個の細かな煙粒が少し浮いてほどける。結晶、氷片、霜の輪、尖った水しぶき状の線は使用しない。

- 主色：既存の冷気パレット `#a1edff`。
- 明部：`#ecfcff`。
- 大きな霜煙：最大約280 ms。
- 煙粒：発生を16 msずつずらし、最大約360 ms。
- 形は不透明なベタ塗り。8 px / 2.2 pxのグローは維持。

描画API、敵味方共通の仕様、本体未接続、戦闘数値を変更しない方針はv7と同じ。
GIFは `output/element-hits-v8/ally-enemy-element-hits.gif`、半速版は `ally-enemy-element-hits-slow.gif`。
冷気だけの確認用は `frost-smoke-hit.gif`、半速版は `frost-smoke-hit-slow.gif`。

検証ではv7の炎・雷・魔法の全32サンプルフレームと描画コマンドが一致すること、敵味方で冷気の主要形状が共通であること、Canvas状態とGIF再生時間を確認する。
