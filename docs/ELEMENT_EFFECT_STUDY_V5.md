# 魔弾と全武器の属性色 v5

> **注記（2026-09-12）**: この文書が参照している `output/` 配下の生成物は、
> 後続バージョンで更新済みのため削除しました。最新版は `output/combined-element-effects-v13/` /
> `output/element-hits-v13/` / `output/ally-effects-v3/` にあります。


2026-09-12。大剣・戦鎚・槍・弓・剣＆斧・短剣の6系統はユーザー採用済み。形状と表示速度を維持し、杖の魔弾と共通の属性パレットを追加。

## 魔弾

描画キー `magicbolt`。小さな八角形の光弾、離れた短い尾、細い旋回線で弓の矢と区別。着弾時は6方向の尖った光と割れた輪が開き、18個の粒子が散る。発射55 ms、サンプルの着弾200 ms。最大表示620 ms。

## 属性色

`proto/index.html` の `DTYPE` にある属性4種を採用。物理の斬撃・刺突・打撃は武器形状で区別し、無属性パレットを共通にする。

| element | 名称 | 形のベタ色 | 着弾アクセント | 粒子差し色 | グロー |
|---|---|---|---|---|---|
| `neutral` | 無属性 | #ffffff | #fff56b | #b9caff | 以前の各色を維持 |
| `fire` | 炎 | #ffad72 | #fff0bb | #ff653e | #ff783d |
| `shock` | 雷 | #fff171 | #ffffd5 | #ffcf3a | #ffe35e |
| `frost` | 冷気 | #a1edff | #ecfcff | #43baff | #53caff |
| `arcane` | 魔法 | #d6a1ff | #ffe4ff | #a871ff | #bb71ff |

形状内部の陰影は追加せず、軌跡・弾体・着弾光・破片・グローに同じ属性を適用。色は既存の属性色に沿った表示用の提案値。未知の属性は無属性へフォールバックする。

`AllyEffectStudy.render(ctx, {kind:'magicbolt', element:'fire', age, x, y, ...})`。
属性を省略すると採用済みの無属性表示。設定は `AllyEffectStudy.elements`。

## サンプル

- HTML：`proto/weapon-effect-gallery.html`。属性セレクターで全7武器を一括変更。
- GIF：`output/element-effects-v5/`。
- `magicbolt-five-elements.gif`：魔弾5色、通常速度。`magicbolt-five-elements-slow.gif`：半速。
- `all-weapons-all-elements.gif`：縦7武器・横5色の全35パターン。
- 各武器の `*-elements.gif`：その武器の5色を横並びに比較。
- 書き出し：`tools/export-element-effects.cjs` → PillowのあるPythonで `tools/export-element-effects.py`。

GIFは属性を指定して実行した描画コマンドから生成。完成画像の色だけを後加工したものではない。
検証：採用済みv4と無属性描画の一致、全属性で形状・時刻の一致、Canvas状態の復元、GIFの全フレーム再デコード・総再生時間・ループ設定。

本体への統合は今回も未実施。表示用の射程・発射／着弾時刻を戦闘数値へ転用しない。将来は本体の弾位置と着弾イベントから演出を呼び出す。ダメージ・成長・報酬・敵AIへの変更なし。
