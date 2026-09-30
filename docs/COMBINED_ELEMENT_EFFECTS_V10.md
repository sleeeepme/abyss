# 属性攻撃＋属性ヒット同時表示 v10

> **注記（2026-09-12）**: この文書が参照している `output/` 配下の生成物は、
> 後続バージョンで更新済みのため削除しました。最新版は `output/combined-element-effects-v13/` /
> `output/element-hits-v13/` / `output/ally-effects-v3/` にあります。


2026-09-13。採用済み7武器の属性攻撃と、採用済み4属性のヒットエフェクトを同時表示するサンプル。

`WeaponEffectGallery.scene` に `elementHit` オプションを追加。`true` の場合、武器ごとの `contact` を基準に対象位置へ `AllyEffectStudy.renderElementHit` を重ねる。攻撃前にヒット演出は出さず、接触後だけ開始する。

- 攻撃側：属性色の軌跡、弾、武器固有の着弾粒子。
- 対象側：炎の火の粉、弱い雷、円形の薄い霜煙、舞う魔素。
- ヒット側は武器軌跡より少し小さい0.78倍で表示し、密集時の読みやすさを保つ。
- 実際のゲーム接続時はサンプル時刻ではなく、攻撃判定が成立したフレームで開始する。

GIF：`output/combined-element-effects-v10/all-weapons-attack-and-hit.gif`。同フォルダに `fire-attack-and-hit.gif`、`shock-attack-and-hit.gif`、`frost-attack-and-hit.gif`、`arcane-attack-and-hit.gif` を収録。

検証：全28組で接触前に属性ヒットが存在しないこと、接触60 ms後に追加形状が存在すること、Canvas状態、GIF全フレームと1秒のループを確認。

本体の `proto/game-feel.js` と戦闘処理には未接続。ダメージ・射程・攻撃頻度・状態異常・AIの変更なし。
