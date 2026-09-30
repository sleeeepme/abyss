# 武器別エフェクト v4

2026-09-12。ユーザーが採用したv3の斬撃を大剣、打撃を戦鎚として登録し、追加4系統を試作。

| 描画キー | 対象 | 命中基準（表示用） | 形と動き |
|---|---|---|---|
| `greatsword` | 両手剣・大剣 | 60 ms | v3の大きな白い弧、黄色の着弾線、22個の粒子 |
| `hammer` | 戦鎚 | 60 ms | v3の非対称な白い衝撃、前方の尖り、28個の粒子 |
| `spear` | 槍・刺突 | 65 ms | 長く細い直線と奥へ抜ける穂先。14個の粒子を狭い前方に集中 |
| `bow` | 弓 | 180 ms | 発射から着弾まで飛翔する矢。短い後方軌跡と11個の小さな着弾粒子 |
| `swordaxe` | 剣＆斧（共通） | 55 ms | 大剣より小さい片手斬撃の弧。16個の控えめな粒子 |
| `dagger` | 短剣 | 45 ms | 短い間合いの素早い斬撃。9個の粒子と短い余韻 |

全てベタ塗りの白・黄、少量の青白い粒子とv3の2層グローを継承。大剣と戦鎚の形、粒子設定、表示速度は維持。
既存の `slash` / `blunt` は `greatsword` / `hammer` の別名として動作。

## 表示・成果物

- 描画：`proto/ally-effect-study.js`。公開設定は `AllyEffectStudy.weapons`。`kind` に上記キーを渡す。
- 全6種類の比較HTML：`proto/weapon-effect-gallery.html`。共有の場面描画は `proto/weapon-effect-gallery.js`。
- 追加4種類のGIF：`output/weapon-effects-v4/new-weapons.gif`。半速版は `new-weapons-slow.gif`。
- 個別GIF：同フォルダの `greatsword.gif` / `hammer.gif` / `spear.gif` / `bow.gif` / `swordaxe.gif` / `dagger.gif`。
- 再書き出し：`node tools/export-weapon-effects.cjs` → PillowのあるPythonで `tools/export-weapon-effects.py`。

比較キャラは既存の待機スプライト。武器別の新規キャラ作画や攻撃ポーズは含まない。
GIFとHTMLのグローは同じ設定を用いるが、PillowとCanvasのぼかしには微小な差があり得る。

## 本体接続時の扱い

今回の登録は描画試作内の武器対応であり、戦闘本体の差し替えは未実施。
表示用の距離・命中時刻はサンプルの配置に合わせたもの。実際の射程、当たり判定、攻撃頻度、ダメージへ流用しない。
特に弓は本体の矢の実位置で軌跡を描き、実際の着弾イベントで粒子を出す。
将来の統合先は `proto/game-feel.js`。ダメージ式・成長・報酬・敵AIの変更なし。

確認：JS構文、旧キーと新キーの描画一致、Canvas状態の復元、GIF全フレームの再デコードとループ時間、各武器のピーク／矢の飛翔を目視。
