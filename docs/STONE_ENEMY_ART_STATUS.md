# 石の層の敵アート採用状況

2026-09-21更新。1–10Fの通常敵・変異種・条件出現・ボスを対象とする。出現対象は `proto/enemy-compendium.html`、巡回者は `proto/index.html` を参照。静止画の採用とゲームへの接続を区別する。

## 採用・据え置き

| キャラクター | 状態 | 採用稿・基準 |
|---|---|---|
| アッシュハウンド | このタスクの承認済み基準 | [TinyRPG版32px](../pixel-art/ash-hound-tinyrpg-v1/ash-hound-32.png)。別途登録済みの16px版も保持 |
| クロウリングデッド（這う死者） | このタスクの承認済み基準 | [benchmark v2](../pixel-art/stone-benchmark-v2/crawling-dead-32.png) |
| アッシュトード | **v10採用** | [登録PNG](../proto/assets/sprites/enemies/ash-toad/right-idle-tinyrpg-v10.png)。ユーザー「今回の稿で採用にして」。未反映 |
| ダストスパイダー | **v9暫定採用** | [登録PNG](../proto/assets/sprites/enemies/dust-spider/right-idle-tinyrpg-v9.png)。ユーザー「蜘蛛も一旦それで」。未反映 |
| 苔玉 | 据え置き | 既存の採用画像・ゲーム反映を維持 |
| ストーンボア | 旧16px版承認済み | `CHARACTER_ART_LIST.md` のv3を維持。後発のTinyRPG更新候補は承認未確認 |

## 品質不足・再制作待ち

6F以降のボグ系4体。[同倍率比較](../pixel-art/stone-bog-native-v1/comparison.png)／[制作記録](../pixel-art/stone-bog-native-v1/README.md)。全て新規32px原寸。ゲーム未反映。提示後にユーザーから品質不足の指摘があり、完成扱いにしない。現在は[品質判断の校正](art-quality-study/2026-09-21/README.md)を先に進める。

| キャラクター | 新規候補 |
|---|---|
| ボグクロウラー | [v1](../pixel-art/stone-bog-native-v1/bog-crawler-32.png) |
| リードサーペント | [v1](../pixel-art/stone-bog-native-v1/reed-serpent-32.png) |
| シルトジェリー | [v1](../pixel-art/stone-bog-native-v1/silt-jelly-32.png) |
| ブロートグラブ | [v1](../pixel-art/stone-bog-native-v1/bloat-grub-32.png) |

## 未承認・以降の制作対象

| キャラクター | 現状・次の制作で守る特徴 |
|---|---|
| フォールンカンパニー | 旧候補あり。装備の異なる三人組を小さい画面で読ませる |
| プレイングデッド | `praying-dead-benchmark-v5` の修正候補あり。最終承認は未確認。跪いて手を組む |
| デッドスプリンター | 旧候補あり。走り出す姿勢、這う死者との共通素材感 |
| 粉挽き（The Miller） | 旧候補あり。暫定採用蜘蛛v9を基準に脚の一本を石臼へ |
| 無音（The Hush） | 旧候補あり。ストーンボアの輪郭を保持し、黒い塊の不気味さを出す |
| アビスの巡回者 | 条件出現。旧候補あり、現在の基準に合う稿は未承認 |
| 灰の大蛙（5F） | 登録済み32px v4は要確認。通常トードとの差、膨らんだ喉・巨体 |
| 空引きのヴェラ（10F） | 人型・大型化した形態の過去候補あり。最終採用は未確認 |

旧候補の存在を採用扱いにしない。上表は18項目（ヴェラの形態は同一項目）。今回、未承認全件の制作が完了したわけではない。

新規通常敵はTinyRPG原寸分析とハウンド・這う死者・採用トード・暫定蜘蛛を基準に、32×32の中へ直接作画する。色数は材質ごとの役割で決め、8色を全キャラクターの固定規則にはしない。苔玉は変更しない。採用済み画像の上書きや自動的なゲーム接続は行わない。
