# 敵味方共通・属性ヒットエフェクト v7

> **注記（2026-09-12）**: この文書が参照している `output/` 配下の生成物は、
> 後続バージョンで更新済みのため削除しました。最新版は `output/combined-element-effects-v13/` /
> `output/element-hits-v13/` / `output/ally-effects-v3/` にあります。


2026-09-13。v6へのフィードバックを反映した軽量版。

| 属性 | v7の表示 |
|---|---|
| 炎 | 火柱を撤去。14個の小さな火の粉だけが上へ舞い、最大360 msで消える |
| 雷 | 4方向の太い電撃を2方向へ削減。長さ約17 px、太さ0.65 px、主表示140 ms |
| 冷気 | 氷片と霜の輪を撤去。5本の細い冷気の流れと小さな霧粒が横・上へ漂う |
| 魔法 | 菱形の魔法印と大きな光片を撤去。13個の紫の魔素が緩く旋回しながら上昇 |

炎・冷気・魔法には共通の鋭いヒット破片を重ねず、属性固有の火の粉・霧・魔素だけを表示する。雷は小さな共通チップを2〜3個だけ残す。全体のグロー、属性パレット、敵味方で共通の形を使う方針は維持。

描画APIは `AllyEffectStudy.renderElementHit(ctx, options)`。サンプルは `proto/element-hit-gallery.html`。
GIFは `output/element-hits-v7/ally-enemy-element-hits.gif` と半速版 `ally-enemy-element-hits-slow.gif`。

検証：味方・敵で属性記号の主要形状が一致すること、Canvas状態の復元、GIF全フレームの再デコード・総再生時間・ループ設定、各属性の接触後80 msの見た目を確認。

本体の `proto/game-feel.js` と戦闘処理には未接続。ダメージ・耐性・状態異常・敵AIの変更なし。
