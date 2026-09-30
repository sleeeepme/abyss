# 味方エフェクト試作 v2

> **注記（2026-09-12）**: この文書が参照している `output/` 配下の生成物は、
> 後続バージョンで更新済みのため削除しました。最新版は `output/combined-element-effects-v13/` /
> `output/element-hits-v13/` / `output/ally-effects-v3/` にあります。


2026-09-12。ユーザー添付のSephiria画像を基準にv1を修正。

- エフェクトは白 `#ffffff` と黄 `#fff56b` の不透明なベタ塗り。青緑・橙の縁取りや重ねた陰影は撤去。
- 斬撃は進む側の太い刃、細い尾、独立した細い内側の線で方向を示す。切り抜ける角度を時間とともに進め、後半に幅・長さを減らし、尾から断片を欠落させる。
- 命中に長い黄色の斜線。打撃は左右対称の星形をやめ、前方に長く尖った白い衝撃と黄色の直線に変更。
- 破片は前方へ移動しながら細く短くなる。不透明度のフェードは使わない。
- 既存のキャラと背景はそのまま。戦闘本体への反映・数値変更はなし。

プレビューは `proto/ally-effect-study.html`。描画処理は `proto/ally-effect-study.js`。
GIFは `output/ally-effects-v2/ally-slash-strike.gif`（通常）と `ally-slash-strike-slow.gif`（半速）。
同じ描画ソースを `tools/export-ally-effects.cjs` で20 ms刻みに記録し、`tools/export-ally-effects.py` でGIFに書き出す。旧GIFは `output/ally-effects-gif/` に保存。

確認：構文チェック、GIFの再デコードと総再生時間、140・240・340 msのコマで形状の減衰を目視。
