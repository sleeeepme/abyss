# ヴェラ第一形態のリグ（2026-10-27）

部位に分けた絵を Python で動かし、コマに焼く道具。本編の `proto/cave-look.js` の `VERA1` はここで作る。

- 入力（`input/`）
  - `cell_faceL.png`：横（左向き）。Retro Diffusion の rotate で出した絵。
  - `front48.png`：正面。ユーザーが描いた 33×32 の絵を 48×48 に置いたもの。
  - `cell_back.png`：背面。Retro Diffusion の rotate で出した絵。
- 部位と動き
  - `side.py`：横の部位分け（フード・襟・胴・手前の腕・マント）。脚は描き直す。
  - `side_anim.py` / `front_anim.py` / `back_anim.py`：待機12・歩行8・射撃12・被弾5 のコマ。
  - `bow.py` / `fx.py` / `shoot_side.py` / `lib.py`：弓・石・道具。
- 本編へ入れる手順（このフォルダで実行）
  1. `python3 game_sheet.py vera1_sheet.png` を実行する。シートは横＝右向き・正面・背面の3行×37列。あわせて `vera1_meta.json` ができる。
  2. `python3 embed_game.py ../../proto/cave-look.js vera1_sheet.png vera1_meta.json` を実行する。`/*VERA1_BEGIN*/〜/*VERA1_END*/` を差し替える。
  3. `proto/index.html` の `cave-look.js?v=` を上げる。
- 確認用の書き出し
  - `export.py`：`out/final/` に帯・GIF・一覧を書き出す。
  - `verify.py`：射撃の姿勢の検証図。
- 決まりごと
  - 待機・歩行は手ぶら。射撃のときだけ、石が弓手の腕にまとわりついて弓になる。
  - まぶたは肌のグレーにする。
  - 被弾のコマに色は焼かない。光らせるのは本編の点滅。
