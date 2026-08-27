# Abyss Relic — プロジェクト一式

『カイブツダンジョン（イニシエダンジョン）』に着想を得た、**オリジナルの**モバイル向けローグライク。
移植でもリメイクでもなく、仕組みだけを継承した別作品として作っている。

## 設定書の在り処

命名の基準は **claude.ai のプロジェクト「abyss」** にある2冊。

- `abyss-世界観設定書.md` — アビス／街／六層／還り損ない／命名指針
- `abyss-敵とボス設定書.md` — 表記の三段ルール／雑魚32種／規格外12体／ボス10体

**リポジトリには複製を置かない。** 同じ物が2ヶ所にあると必ず片方が古くなる。
実装への落とし方（どの内部IDがどの名前に対応するか）は
`docs/GAME_DESIGN.md` 5.5.52 に記録してある。

## IP に関する取り決め（厳守）

- 仕組み・アイデアの継承は可。
- **キャラ名・アイテム名・敵名・地名・スキル名・スプライト・BGM/SE・マップ配置は一切流用しない。**
  現状の実装はすべて独自命名で通してある。
- ストア／ポータルの説明文・SNS での紹介で、**「移植」「リメイク」「公式」と読める表現を使わない。**

## 中身

| パス | 内容 |
|---|---|
| `proto/index.html` | **本体。** プレイ可能な単一HTMLプロトタイプ。外部依存なし（16px の絵は data URI で本文に埋めてある） |
| `proto/*.mjs` | 回帰テスト47スイート（Playwright + iPhone 13 相当のタッチ経路。`arttest` だけ PC 文脈も開く）。`_` 始まりは掃引に入れない単発の計測用 |
| `sweep.sh` | 全スイートを回して、false になった項目だけを並べる。`--since` で絞り込み |
| `pick.py` | 変更に関係するスイートだけ選ぶ。対応表は持たず、テストの語彙から毎回作る |
| `docs/GAME_DESIGN.md` | 設計書。各決定の「なぜ」を全部記録してある |
| `docs/CHARACTER_ART_LIST.md` | キャラアートの一覧と採用状況。**絵の正はここと `proto/assets/sprites/`** |
| `proto/assets/sprites/` | 16px のスプライト。本体には data URI で写しが入る（**直すのは PNG のほう**） |
| `docs/BULLET_STORM.md` | 後半を弾幕嵐にする設計案（実測つき） |
| `docs/abyss-引継書-収益設計監査.md` | 収益設計の監査・引継書（第3版／広告のみ前提） |
| `docs/handoff.html` | 同上のHTML版 |
| `unity/` | **凍結中。** C# は「引き撃ちの抑制」時点まで。再開時は差分を追わずプロトタイプから書き直す |
| `index.html` | root からの転送だけ。実体は置かない（同じ物が2つあると必ず片方が古くなる） |

## 動かす

`proto/index.html` をブラウザで開くだけ。ビルド不要。

```bash
git clone https://github.com/sleeeepme/abyss.git
open abyss/proto/index.html
```

## テストを回す

```bash
npm i -g playwright && npx playwright install chromium   # 初回のみ
node proto/verify.mjs        # 個別に実行
```

47スイートを順に回す（`./sweep.sh` で一括実行と要約もできる）：

```bash
./sweep.sh                   # 全部回して false になった項目だけ並べる（約5分）
./sweep.sh --since           # 未コミットの変更に関係するスイートだけ（実測 34秒）
./sweep.sh --since HEAD~1    # 指定した地点からの変更ぶん
./sweep.sh --list            # 選ばれるスイートを表示するだけ（回さない）

# あるいは個別に
for f in verify touchtest scrolltest bagtest gravetest hubtest gearttest \
         rangedtest elemtest afftest bosstest pacetest partytest fxtest \
         bossaoe zonetest kitetest adtest basetest looptest forgetest movetest \
         ulttest allytest cursetest scaletest intrtest mournrest boontest \
         allyuptest allyidtest arttest nametest npctest tunetest titletest towntest hudtest masttest relictest ubosstest loretest dbgtest bladetest \
         taverntest starttest mosstest; do
  echo "=== $f ==="; node proto/$f.mjs
done
```

各スイートは `{errs, R}` を出力する。`errs` が空で、`R` の中の `false` が下の既知一覧だけなら合格。
全数1周で **約5分**。

### `--since` の絞り込み（pick.py）

**対応表は人が書かない。** 「この関数を触ったらこのスイート」という表を手で持つと
必ず更新を忘れる。忘れた瞬間、掃引は速いまま**黙って見逃す**ようになる。遅いより悪い。

代わりに **テスト自身の語彙**を毎回読む。各スイートが本文で触れている識別子
（`guardbtn` / `BLEED_MIN_DEPTH` / `masteryMul` …）を集め、`git diff` に現れた
識別子と突き合わせる。テストを1本書けば対応表はひとりでに増える。

**判断がつかないときは黙って全部回す。** 全数に戻る条件は5つ:

| 条件 | 理由 |
|---|---|
| `proto/_*.mjs` が変わった | 共通部品。全スイートが通る |
| 「共通語」に触れた（半数超のスイートが見る語。`stats` `maxHp` など） | 影響範囲が絞れない |
| 変更された識別子がどのスイートにも無い | 未知の領域 |
| 選ばれた数が全体の6割超 | 絞る意味がない |
| `git diff` が失敗した | 分からないなら回す |

どのスイートも見ていない語があれば `--list` が名前を挙げる。**黙って落とさない。**

実測: 盾ボタンまわりの1行を触ったとき **8/44本・34秒**（全数は約5分）。

### テストを書くときの2つの約束

**1. `S.run` を手で組まない。`TH.run(depth)` を通す。**

`proto/_h.mjs` に共通部品がある。テストが `S.run = {depth:1, loot:[], ...}` と
本編の内部構造を写経していると、本編にフィールドを1つ足すたびにテスト側を
何ヶ所も直す羽目になる（実際に何度もそうなった）。`TH.run()` は `startRun()` を
呼ぶだけなので、フィールドが増えても勝手に付いてくる。

```js
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
...
await pg.evaluate(()=>{ TH.run(1, {seed:7}); TH.floor(14); /* 検証 */ });
await done(b, errs, R);
```

**2. 実時間で待たない。`stepSim(秒)` でループを進める。**

`await new Promise(r=>setTimeout(r,3000))` は本当に3秒止まる。
中身は `requestAnimationFrame` が `update(dt)` を呼んでいるだけなので、
`stepSim(3)` と書けば同じ180フレームを **30ミリ秒** で回せる（実測100倍）。

```js
stepSim(4);                                     // 4秒ぶん進める
stepSim(8, {each:(t)=>{ stickDx=Math.cos(t); }}) // 疑似入力つき（フレームの頭）
stepSim(3, {after:()=>{ /* 観測 */ }})           // 観測はフレームの尻
stepSim(4, {until:()=>!!boss.cast})              // 条件が満たされたら早じまい
stepSim(7, {draw:true})                          // 描画も回す（例外が出ないことを見る）
```

**3. 乱数を触ったら、同じ掃引を2回回す。**

階層の生成には**起動ごとの塩**が入っている（`S.salt`。初回の第1階層が
毎回同じにならないように）。塩を引くのは名前を決める `confirmName()` だけで、
既定は 0——**テストは塩を持たない。**

ここを間違えると症状が出にくい。塩を宣言時や `startAdventure()` で引くと、
`_h.mjs` を通さず自前で起動しているスイート（46本中25本）が
**静かに毎回違う地形**を見るようになる。1回目の掃引はたまたま緑で通り、
2回目で落ちる。落ちたときに「壊したのか、たまたまか」が区別できない。

だから乱数まわりを触ったら掃引を2回。1回では固定と非固定の区別がつかない。

**4. 定数を書き写さない。本編と同じ場所を見る。**

乱数の流れが1つずれただけで落ちる検証が、一度に **7本**出たことがある。
どれも本編の値をテスト側に**書き写して**いた——重騎士の武器種 `'great'`、
庇うの持ち主 `'warrior'`、大技を持つジョブの数 `8`。
本編を直した瞬間、テストだけが古い世界を見ることになる。

```js
// 書き写す（本編を直すと嘘になる）
a.equip.weapon = genBaseItem('great', 6, 0);
// 同じ場所を見る（本編を直すと付いてくる）
a.equip.weapon = genBaseItem(jobDef('knight').weapon, 6, 0);
```

**落ちたから直す、より、落ちない書き方にしておくほうが安い。**

同じ理由で、**回数や秒数の決め打ちもしない。**
「鉱脈が出る階は 6/7/8」「追いつくのに 9 秒」は、生成が少し変わるだけで嘘になる。
出るまで探す・追いついたら早じまいする（`stepSim` の `until`）と書けば、
見たいこと（掘れるか／戻ってこられるか）だけが残る。

**5. 「1発で死ぬ」と書かない。死ぬまで殴る。**

初期装備の「疾き」には**回避 6%** が乗っている。`hpNow=1` にして 99999 で
殴る書き方は 6% の確率で外れ、乱数の流れが1つずれるたびに当たり外れが入れ替わる。
見たいのが *死んだあと* なら、死ぬまで殴ればいい。1発に賭ける理由はどこにも無い。

```js
for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,3); }
```

**使ってはいけない場面がひとつある。** `performance.now()` を直に読む処理
（パリィの受付、盾の構え、ダミー広告のタイマー、描画のアニメ位相）は進まない。
時計ではなくフレームを進めているだけなので。その手の検証は実時間待ちのまま残すこと
（`adtest` / `scaletest` / `touchtest` / `hubtest` / `fxtest.live` / `pacetest.live` がそれ）。

### 既知の期待される false（不具合ではない）

意図的に「そうならないこと」を確認している否定側の検証。

| スイート | キー |
|---|---|
| hubtest | `.hub.townHasShopGrid` |
| pacetest | `.bossHidden.revealed` / `.bossHidden.barShown` / `.bossDot.before` / `.bossPerFloor.secondRevealed` |
| partytest | `.fallen.deadAfter` / `.uniqKill.blockedBefore` |
| fxtest | `.noAutoHelp.helpShown` |
| zonetest | `.banner.sameZone` / `.banner.stillSame` |
| kitetest | `.hud.melee.shown` |
| adtest | `.reviveDone.dead` |
| basetest | `.durWarn.healthy.shown` / `.repairHint.clean.coloured` |

**この一覧と名前が一致しても、同じ理由で false とは限らない。**
実際に `verify.shop.upgraded` は「能力強化の対価を金→欠片に変えた」時点から
落ちていたのに、既知の false だと思って4コミットぶん見過ごした。
名前ではなく**中身**を読むこと。

## 同期の手順（クラウド ⇄ Mac ⇄ GitHub）

書き込みが**3ヶ所から来る**。クラウドのセッション、Mac のエディタ／Codex、
そして GitHub Desktop。ここを間違えると**片方の作業が黙って消える。**

**実際に消した。** クラウド側の複製を正だと思い込んで `proto/index.html` を
全文で書き戻したところ、その間に Mac 側で入っていたアートプレビュー機能
（`?artPreview` の 124 行）が丸ごと消え、そのまま commit された。
消えたことに数コミット気づかなかった。

### 守ること

1. **書き戻す前に `git fetch` して `origin/main` に合わせる。**
   クラウドの複製は放っておくと必ず古くなる。`git reset --mixed origin/main` で
   HEAD を合わせ、自分の変更だけが差分に残る形にしてから作業する。
2. **全文の上書きは、Mac 側が止まっているときだけ。**
   相手が作業中なら、触るファイルを名指しで確認してからにする。
3. **`git status` の `D`（削除）を必ず読む。**
   意図しない削除は、たいていここに最初に出る。

### Mac 側でファイルを消すとき

クラウドから Mac のファイルは**削除できない**（`rm` が拒否される）。
`_to_delete/` へ `mv` して、GitHub Desktop 側で削除としてコミットする。

## 進め方の取り決め

- **正はプロトタイプと設計書。** `unity/` は「Unity でどう組むかの下書き」でしかない。
- 機能を足すたびに、その機能を検証するスイートを1本足して全数を通す。
- 設計判断は数値で確かめてから決める。設計書に「なぜそうしたか」を必ず残す。

## 次にやること（収益設計の結論から）

前提は **課金なし・無料プレイ・広告収益のみ・年間100万円で御の字**。
詳細は `docs/abyss-引継書-収益設計監査.md` を参照。

1. **計測** — 現状のまま配布して D1・セッション長・離脱階層を取る
2. **英語化** — UIテキスト約8,450字（コード内コメントは対象外）
3. **手触りの最小実装** — アートと音。ここが最大のブロッカー
4. **web ゲームポータルへ提出** — CrazyGames / Poki / GameDistribution

Unity移植は 4 の結果を見てから判断する。
