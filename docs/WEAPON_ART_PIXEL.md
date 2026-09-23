# 武器技のドット演出（weapon-art-pixel.js）

2026-09-23。武器技24種と大魔導士 Lv.50「崩落」の絵を、ベクター＋ぼかし（`weapon-art-effect-study.js`）から
**ドット絵の格子で描く演出**に差し替えた。ユーザー依頼（「こっちの方が良いのでこちらに差し替えて」「魔法関連技は足元に魔法陣」
「他の技も同じ文脈で再考」→ 武器技24種すべて）。

- 見本ページ：`proto/weapon-art-pixel-study.html`（新旧を並べて再生・½×/¼×・コマ送り・段取りの帯）
- 本体：`proto/weapon-art-pixel.js`（`window.PixelArtFx`）
- 旧：`proto/weapon-art-effect-study.js` は**残してある**。`PixelArtFx` が読めないとき（`feeltest.html` など単体で開いたとき）の予備。

## 作り方（参考：X の「Opus 5.5 でドット絵の魔法使いを純コードで」プロンプト）

1. **論理解像度で描いて補間なしで拡大。** 1マス＝16ドット（16px のキャラ絵と同じ格子）。1ドット＝`3 × TS/48` 画面px。
2. **固定パレットだけ。** 半透明・グラデーション・`filter:blur` を使わない。消えるときは 4×4 ベイヤーのディザで間引く。
3. **形とポーズは 12fps（斬撃は 24fps）、ループは 60fps。**
4. **粒子は番号から決まる。** ハッシュで位置が決まるので状態も割り当ても無い。`age` を渡せばどのコマでも描ける。
5. **段取り**（見本シーン）：IDLE → CHARGE → CAST → RECOVER。魔法系は宝石へ粒が渦を巻き、宝石から1ドットのリムライト。
6. **着弾で1〜2ドット揺らす**（見本のみ。実機の揺れは今まで通り `feelKick`）。床は照り返しの色へパレットスワップ。
7. **魔法系は足元に魔法陣**（杖3種・崩落・戦鎚の癒し打ち／ホーリーシールド）。つぶれた二重の輪が回り、縁から文字片が立ちのぼり、
   発動の瞬間だけ白く光る。色は属性ごと（炎・冷気・雷・魔法・癒し・聖）。

## 実機への組み込み（2026-09-23 に入れた箇所）

### `index.html`
| 場所 | 変更 |
|---|---|
| 末尾の `<script>` | `weapon-art-pixel.js?v=20260923a` を `game-feel.js` の前に追加。`game-feel.js` の版を `20260923-pixelarts` へ |
| `draw()` の「敵」の直前 | `drawFeelArtGround(camX,camY)`（足元の層） |
| `W.arts` の描画 | `kind==='collapse'` は描かない（絵は演出側） |
| `fireAllyArt` の `collapse` | 即時ダメージをやめ、`W.arts` に `kind:'collapse'` を `COLLAPSE_DELAY`(0.55秒) で予約。`feelPixelArt('collapse', …)` |
| `tickArts` | `kind==='collapse'` の着弾処理（唱えた本人が倒れていたら落ちない） |
| `tickArts` の `arrow` 着弾 | `feelPixelArt('bwrain_hit', …)` |
| `tickArts` の `artvolley` | 1発ごとに `feelPixelArt('bwshot', …)`（その相手の向きと距離） |
| `fireArt` の `single` / `dragoon` | `feelWeaponArtAim(ent, id, tgt.x, tgt.y)`（狙った相手の座標で描く） |

### `game-feel.js`（`feelWeaponArtStart` 〜 `drawFeelPersistentArt` を差し替え）
- `feelWeaponArtStart`：`PixelArtFx.span(id)` の長さで `FEEL.weaponArts` に積む。居合・ドラグーンは本人に付いて行かない（踏み込み前／跳んだ位置に残す）。
- `feelWeaponArtAim` / `feelPixelArt`：狙いの座標を後から渡す／本人に付かない単発の演出を積む。
- `drawFeelArtGround`（敵の前）と `drawFeelWeaponArts`（主人公の後）で `layer:'ground'` / `'air'` を描き分ける。
- 持続技（フレイム・ライトニング・ダンシングソード・アローレインの矢）は `W.arts` の時計で描く。
  **`age` は周期で割らず** 発動からの実時間（`f.max - f.t`）、`life` に `f.max`。旧版は `% 1.05` / `% 1.35` で巻き戻していた。
- ダンシングソードの刃は当たり判定と同じ角度 `f.a`（旧版は判定1本に対して刃3本を描いていた）。

## 2026-09-23（2回目）大技・スキル技・通常攻撃もドットへ
ユーザー依頼「大技とスキル技、通常攻撃のエフェクトも同じように見直して」。見本ページに4つの組（通常攻撃・大技・仲間の大技・スキル技）を足した。
ソースは `weapon-art-pixel.js` の中の「通常攻撃」「大技」の節（Claude 側の作業場では `src/60_normal.js` と `src/70_ult.js`）。

| 種類 | id | 実機で積む場所 |
|---|---|---|
| 通常攻撃の振り | `n_swing`（`kind` = swordaxe / greatsword / dagger / hammer / spear、`elem` で色） | `game-feel.js` `drawFeelSwing`（`f.skill` のある振り＝衝撃波は描かない） |
| 弾 | `n_shot`（`kind` = arrow / bolt） | `drawFeelWeaponShot` |
| 当たり | `n_hit`（`elem` = neutral / fire / shock / frost / arcane、`target:'ally'` で小さく） | `drawFeelHits`（`FEEL.hits` はそのまま） |
| 大技8種 | `u_quake`（地脈断） `u_blink`（縮地） `u_blaze`（灼髄） `u_ward` `u_aegis` `u_rally`（回帰） `u_bloom`（命脈） `u_ruin`（裂天） | `index.html` `fireUlt` |
| 支える大技の仲間ごとの印 | `u_ward_on` `u_aegis_on` `u_rally_on` `u_bloom_on` `a_bulwark_on` `a_grace_on` | `ultPartyArt(id, r, src)`（`index.html`、`fireUlt` の直前） |
| 裂天の雷1本 | `u_ruin_hit`（敵ごと、`delay` で順に） | `fireUlt` の `ruin` |
| 仲間の大技 | `a_spin` `a_bulwark` `a_rain`（+`a_rain_hit`） `a_field`（置き型） `a_vanish` `a_grace` `a_sanct`（置き型） | `fireAllyArt`。焦土・聖域は `W.arts` の時計（`feelPersistentPixel`） |
| スキル技 | `s_wave` `s_dash` `s_revive` `s_regen` | `fireWave` / `tapDash`（game-feel） / 不屈の立ち上がり / 治癒の回復 |
| 効いている間の足元の輪 | `aura_on`（`aura` = sanct / aegis / ward / bloom / grace。強い順に1つ） | `feelDrawAuras`（`drawFeelArtGround` と `drawFeelWeaponArts` の中） |

- 旧い絵（`ultring` / `ultline` / `ultbeam` / `ultflash` / 瞬歩と瞬足の `dashghost`）は `artId` を付けて描かないようにした（記録は残る）。
- **当たり判定・ダメージ・時刻は一切変えていない。** 裂天の雷は 0.1秒＋最大0.18秒遅れて落ちる絵だが、ダメージは今まで通り押した瞬間。
- `feelPixelArt(id, x, y, o)` に足した引数：`o.ent`（その人に付いて動く）、`o.delay`（秒だけ遅らせる。`age` を負から始める）、
  `o.wide`（灼髄の幅・マス）、`o.arc`（衝撃波の角度・ラジアン）、`o.kind` `o.elem`。積める数は 40 → 64。
- 床の照り返し（`lightPool`）を上下につぶした楕円にした（実機で壁の上へ丸くはみ出していた）。
- 重さの目安（ヘッドレス Chromium・1回あたり）：当たり・弾・足元の輪 約0.04ms、振り 約0.2ms、支える大技 約0.6ms。

## 2026-09-23（3回目）土煙を網掛けに・大技3つを派手に・大技の改名
- **土煙**（`dust()`、全技共通）：塗りつぶしの丸が縮む形をやめ、ふくらみながら 4×4 ディザで薄れる煙にした（影・本体・こぶ・上の明るい所）。
- **縮地**（`u_blink`）：踏み切りの閃光、太い光の帯（白い芯＋水色の縁）、通り道に遅れて弾ける X の斬り跡4つ、
  抜けた先の破裂（輪・放射線・床のひび）、走った床に残る霜の筋。
- **灼髄**（`u_blaze`）：陣を大きく、前へ順に噴き上がる火柱6本（最後が一番高い）、根元の溶けたひびと焦げ、帯の縁の熾火、高く舞う火の粉。span 1.2→1.6。
- **裂天**（`u_ruin` / `u_ruin_hit`）：本人から天へ太い柱、空が横にぎざぎざに裂ける、敵ごとに太い雷（白い芯＋紫2段＋枝）と
  小さな魔法陣・網掛けで薄れる残光の柱・跳ね上がる石くず。
- **改名**（表示名だけ。`id` は据え置き）：震撼→地脈断、瞬歩→縮地、業火→灼髄、崩落→裂天、号令→回帰、生気→命脈。
  仲間の大技（大魔導士 Lv.50）の「崩落」はそのまま。`wartest` の「震撼！」を「地脈断！」に。

## 2026-09-24 ボスの攻撃（5F 灰の大蛙・10F ヴェラ）
ユーザー依頼「5Fと10Fのボスの攻撃エフェクトも作って」。見本ページに「ボスの攻撃」の組（10場面）を足した。
ソースは Claude 側の作業場の `src/80_boss.js`（結合後は `weapon-art-pixel.js` の「ボスの攻撃」節）。

**予兆（赤い円・扇・帯）は本編の `drawBossCast` がそのまま描く。** 当たり判定と同じ形なので触っていない。
足したのは「溜めている間の本体まわり」と「放った後」だけで、円は床の遠近でつぶさず**円のまま**描く（予兆と重なる）。
主人公が隠れないよう、煙は網掛けを薄め（`dust()` の `alpha`）にしてある。

| ボス | 技 | id | 積む場所 |
|---|---|---|---|
| 灰の大蛙 | 溜め（全技） | `bt_charge`（灰が喉へ吸い込まれ、床が震える） | `game-feel.js` `feelDrawBossCasts`（`e.cast` の間） |
| | 叩きつけ | `bt_slam`（灰の輪・ひび・灰の柱・燃えさし） | `resolveBossMove` の `slam` |
| | 薙ぎ払い | `bt_cleave`（舌で薙ぐ＋灰の三日月） | 〃 `cleave` |
| | 落石（激昂） | 溜め中 `bt_spit`（吐き出した灰の塊が弧を描いて飛ぶ）→ 着弾 `bt_pillar` | `feelDrawBossCasts` ／ `resolveBossMove` の `pillars` |
| | 通常攻撃 | `bt_jab`（舌を突き出す） | 敵の通常攻撃（`e.tele` が尽きた所） |
| ヴェラ | 溜め（全技） | `bv_charge`（弓を引き、光で矢が組み上がる／礫が集まって石の槍） | `feelDrawBossCasts` |
| | 貫き | `bv_beam`（光の帯／石の槍と砂利） | `resolveBossMove` の `beam` |
| | 散弾 | `bv_release` ＋ 弾1本ずつ `bv_arrow`（光の矢／礫） | 〃 `burst`（`bolt` に `artId:'bv_arrow'`） |
| | 波動（第二形態） | `bv_wave`（跳ねながら転がる礫の輪。半径は `f.r` そのまま） | 〃 `wave`（`wave` に `artId:'bv_wave'`）→ `feelDrawBossFx` |
| | 落石（第二形態の激昂） | 溜め中 `bv_rock`（空から石）→ 着弾 `bv_rockhit` | `feelDrawBossCasts` ／ `pillars` |
| | 通常攻撃（第一形態の矢） | `bv_arrow` | 敵の通常攻撃の `bolt` |

- ヴェラの形態は `feelBossArt(e)` が見る：`e.form2` がまだある＝第一形態（空引き・`kind:'ghost'`）、無い＝第二形態（礫・`kind:'stone'`）。
- 他のボスは今まで通り（`feelBossArt` が null を返す）。ボスを足すときは `feelBossArt` に1行と、`resolveBossMove` の各技の `BA.pre` の分岐を足す。
- 当たり判定・ダメージ・溜めの秒数は変えていない。旧い輪・扇・帯・丸い弾は `artId` で描かないだけ。
- 見本の本体：灰の大蛙は本編の 32px 絵（`great-ash-frog` v4）をそのまま。ヴェラは絵がまだ無いので狩人の型を青白く／石色に塗り替えた仮。

## `PixelArtFx.renderEffect(ctx, p)` の引数

| 名前 | 中身 |
|---|---|
| `id` | 技の id（`WEAPON_ARTS` と同じ）＋ `collapse` / `bwshot` / `bwrain_hit` / `bwrain_arrow` |
| `age` | 発動からの秒（実時間） |
| `x, y` | 画面座標。術者の足元（崩落は着弾点） |
| `angle` | 向き（ラジアン） |
| `scale` | `TS/48`（今まで通り） |
| `range` | マス（`def.r` / `def.len` / `def.dist`） |
| `life` | 持続秒（フレイム 2.5・ライトニング 3・ダンシングソード 6・ミラージュ 2.6） |
| `layer` | `'ground'` / `'air'` / `'all'` |
| `tx, ty` | 狙いの画面座標（アッパー・ドラグーン） |
| `casterX, casterY` | 崩落の術者の画面座標（足元の魔法陣と空へ抜ける光） |
| `orbitA` | ダンシングソードの今の角度 |
| `fall` | アローレインの矢1本の落ち具合 0..1（-1 は落ち始める前＝輪だけ） |
| `kind` | 通常攻撃の武器（`n_swing`）／弾の種類（`n_shot`） |
| `elem` | 属性（`n_swing` `n_shot` `n_hit`） |
| `target` | `n_hit` で `'ally'` なら小さめ |
| `wide` | 灼髄の幅（マス） |
| `arc` | 衝撃波の扇の角度（ラジアン・全幅） |
| `aura` | 足元の輪の種類（`aura_on`） |

## 技を足すとき
`weapon-art-pixel.js` の `DEFS` に1項目足す：`ground(t,o)` と `air(t,o)`（`o.x,o.y` が足元、`o.R` が届く距離（ドット）、
`o.ang` が向き）、実機で描く長さ `span`、見本シーンの配置（`cx,cy,enemies`）、段取り（`castAt,charge,recover,loop`）、
見本の当たりの時刻 `hits`。id が `WEAPON_ARTS` と同じなら `feelWeaponArtStart` が自動で拾う。
魔法系なら `ground` の最初で `magicCircle(o.x, o.y + 1, t, 出している秒, 属性, 大きさ, o.charge||0)` を呼ぶ。

## 既知のずれ（気になったら直す）
- 居合は `def.dist`（3.4マス）の長さで線を引く。壁で止まったときは実際の踏み込みより長く見える。
- 地走りは当たりが発動と同時（`artStrikeCone`）で、絵の波は0.44秒かけて届く（旧 V30 スプライトも同じ作り）。
- 連射・アローレインの発動の絵（弓を引く／空へ放つ）は向きだけで描く。1本ずつの矢と着弾は実際の相手・着弾点で描く。
- 属性（`element`）は武器技の絵に使っていない（技ごとに色が決まっているため）。通常攻撃（振り・弾・当たり）は属性で色と形が変わる。
- 大技の見本シーンの主人公は戦士の絵で代用している（実機は装備した主人公の絵のまま）。聖騎士（聖域）の見本は騎士の絵。
