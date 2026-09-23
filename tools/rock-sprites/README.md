# 礫の岩のスプライトを作る道具（Image Analogies）

2026-09-24。ヴェラ第二形態（礫の狩人）の岩（弾丸・棘・塊）を、ユーザーが渡した参考画像の描き方に合わせて作るための道具。
結果は `proto/weapon-art-pixel.js` の `ROCK_SPR`（4色：黒＝輪郭と割れ目・暗・中・明）に入っている。

## 考え方
1. 参考画像（拡大・JPEG）から元のドット絵を取り出す（`recover_ref.py 参考.jpg` → `ref_native.png`）。
   参考の岩は **4色だけ**（明 #7b7c7c・中 #5a5a5b・暗 #3b3e43・黒 #181c23）で、面の間の深い割れ目は輪郭と同じ黒。
2. 参考の「ぼかした明暗」と「実際のドット」の組を覚える（`analogy.py`）。
3. 新しい岩の形と大まかな明暗（参考の岩を伸ばす・縮める・傾ける・先を細らせる／弾丸は光を左上に固定した合成の明暗）を渡し、
   近傍が一番近い参考のドットを1つずつ選んで置く。近くで選んだ場所の続きを優先して形のまとまりを保つ。

## 作り直す手順
```
python3 recover_ref.py <参考画像>        # ref_native.png
python3 gen_sprites.py                    # 弾丸 16方向 大・小 → spr_bullets.json
python3 gen_sprites2.py                   # 棘・塊 → spr_rocks.json
python3 preview.py spr_rocks.json prev.png  # 目で確認
python3 emit_js.py                        # ROCK_SPR の1行（weapon-art-pixel.js の該当行と差し替える）
```
参考画像そのものはリポジトリに入れていない（出どころの確認が要るため）。
