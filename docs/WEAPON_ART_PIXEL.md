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
| 大技8種 | `u_quake` `u_blink` `u_blaze` `u_ward` `u_aegis` `u_rally` `u_bloom` `u_ruin` | `index.html` `fireUlt` |
| 支える大技の仲間ごとの印 | `u_ward_on` `u_aegis_on` `u_rally_on` `u_bloom_on` `a_bulwark_on` `a_grace_on` | `ultPartyArt(id, r, src)`（`index.html`、`fireUlt` の直前） |
| 崩落（大技）の雷1本 | `u_ruin_hit`（敵ごと、`delay` で順に） | `fireUlt` の `ruin` |
| 仲間の大技 | `a_spin` `a_bulwark` `a_rain`（+`a_rain_hit`） `a_field`（置き型） `a_vanish` `a_grace` `a_sanct`（置き型） | `fireAllyArt`。焦土・聖域は `W.arts` の時計（`feelPersistentPixel`） |
| スキル技 | `s_wave` `s_dash` `s_revive` `s_regen` | `fireWave` / `tapDash`（game-feel） / 不屈の立ち上がり / 治癒の回復 |
| 効いている間の足元の輪 | `aura_on`（`aura` = sanct / aegis / ward / bloom / grace。強い順に1つ） | `feelDrawAuras`（`drawFeelArtGround` と `drawFeelWeaponArts` の中） |

- 旧い絵（`ultring` / `ultline` / `ultbeam` / `ultflash` / 瞬歩と瞬足の `dashghost`）は `artId` を付けて描かないようにした（記録は残る）。
- **当たり判定・ダメージ・時刻は一切変えていない。** 崩落（大技）の雷は 0.1秒＋最大0.18秒遅れて落ちる絵だが、ダメージは今まで通り押した瞬間。
- `feelPixelArt(id, x, y, o)` に足した引数：`o.ent`（その人に付いて動く）、`o.delay`（秒だけ遅らせる。`age` を負から始める）、
  `o.wide`（業火の幅・マス）、`o.arc`（衝撃波の角度・ラジアン）、`o.kind` `o.elem`。積める数は 40 → 64。
- 床の照り返し（`lightPool`）を上下につぶした楕円にした（実機で壁の上へ丸くはみ出していた）。
- 重さの目安（ヘッドレス Chromium・1回あたり）：当たり・弾・足元の輪 約0.04ms、振り 約0.2ms、支える大技 約0.6ms。

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
| `wide` | 業火の幅（マス） |
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
