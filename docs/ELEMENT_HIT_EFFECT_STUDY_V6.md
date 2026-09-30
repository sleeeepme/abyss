# 敵味方共通・属性ヒットエフェクト v6

> **注記（2026-09-12）**: この文書が参照している `output/` 配下の生成物は、
> 後続バージョンで更新済みのため削除しました。最新版は `output/combined-element-effects-v13/` /
> `output/element-hits-v13/` / `output/ally-effects-v3/` にあります。


2026-09-13。攻撃側の武器エフェクトとは別に、実際にダメージを受けた対象の中心へ出す属性記号を試作。
対象が味方か敵かで属性の形を変えず、どちらへのヒットも同じ色・同じ動きで表示する。

| 属性 | 識別する形 | 主な余韻 |
|---|---|---|
| 炎 `fire` | 接触点から立ち上がる二層の火柱 | 上へ散る11個の火の粉。火柱は約240 ms |
| 雷 `shock` | 4方向へ枝分かれする折れた電撃 | 38 msごとに2配置を切り替え、約220 msで消える |
| 冷気 `frost` | 放射状の7枚の氷片と割れた霜の輪 | 外へ広がる小さな氷晶。主形状は約270 ms |
| 魔法 `arcane` | 回転する菱形の魔法印と4つの光片 | 印が広がりながら約340 msでほどける |

全属性に小さな共通チップを7〜9個追加。色は採用済みの `AllyEffectStudy.elements` と同じで、8 px / 2.2 pxのグローの上にベタ塗りの形を描く。内部の陰影は使わない。

描画API：`AllyEffectStudy.renderElementHit(ctx, {element, age, x, y, scale, target})`。
`target` は `ally` / `enemy`。属性記号の形状は共通で、共通チップの数だけ対象サイズに合わせて変える。

サンプル：

- `proto/element-hit-gallery.html`：4属性、味方被弾と敵被弾を左右比較。
- `output/element-hits-v6/ally-enemy-element-hits.gif`：通常速度。
- `output/element-hits-v6/ally-enemy-element-hits-slow.gif`：半速。
- `tools/export-element-hits.cjs` / `tools/export-element-hits.py`：GIF再生成。

現段階は描画サンプルで、`proto/game-feel.js` と戦闘本体には未接続。
本体へ接続する際は `feelImpact(e, src, crit)` に実ダメージ属性を追加し、`hitEnemy`、`hitAlly`、`hitPlayer` の確定した `dt` を渡す。武器の見た目ではなく、実際に解決されたダメージ属性を使う。属性追加ダメージが主属性と別に発生する場合は、主属性を大きく、追加属性を小さく表示して読みやすさを保つ。

ダメージ式、耐性、状態異常の蓄積、AI、当たり判定は変更していない。

確認：JS構文、Canvas状態の復元、味方・敵で属性記号が共通であること、GIF全フレームの再デコード、ループ設定、640 ms / 1280 msの総再生時間、4属性のピークフレームを目視。
