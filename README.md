# Abyss Relic — プロジェクト一式

『カイブツダンジョン（イニシエダンジョン）』に着想を得た、**オリジナルの**モバイル向けローグライク。
移植でもリメイクでもなく、仕組みだけを継承した別作品として作っている。

## IP に関する取り決め（厳守）

- 仕組み・アイデアの継承は可。
- **キャラ名・アイテム名・敵名・地名・スキル名・スプライト・BGM/SE・マップ配置は一切流用しない。**
  現状の実装はすべて独自命名で通してある。
- ストア／ポータルの説明文・SNS での紹介で、**「移植」「リメイク」「公式」と読める表現を使わない。**

## 中身

| パス | 内容 |
|---|---|
| `proto/index.html` | **本体。** プレイ可能な単一HTMLプロトタイプ（約568KB / 10,858行）。外部依存なし |
| `proto/*.mjs` | 回帰テスト42スイート（Playwright + iPhone 13 相当のタッチ経路。`arttest` だけ PC 文脈も開く）。`_` 始まりは掃引に入れない単発の計測用 |
| `sweep.sh` | 全スイートを回して、false になった項目だけを並べる。`--since` で絞り込み |
| `pick.py` | 変更に関係するスイートだけ選ぶ。対応表は持たず、テストの語彙から毎回作る |
| `docs/GAME_DESIGN.md` | 設計書。各決定の「なぜ」を全部記録してある（約184KB） |
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

42スイートを順に回す（`./sweep.sh` で一括実行と要約もできる）：

```bash
./sweep.sh                   # 全部回して false になった項目だけ並べる（約4分30秒）
./sweep.sh --since           # 未コミットの変更に関係するスイートだけ（実測 34秒）
./sweep.sh --since HEAD~1    # 指定した地点からの変更ぶん
./sweep.sh --list            # 選ばれるスイートを表示するだけ（回さない）

# あるいは個別に
for f in verify touchtest scrolltest bagtest gravetest hubtest gearttest \
         rangedtest elemtest afftest bosstest pacetest partytest fxtest \
         bossaoe zonetest kitetest adtest basetest looptest forgetest movetest \
         ulttest allytest cursetest scaletest intrtest mournrest boontest \
         allyuptest allyidtest arttest artpreviewtest nametest npctest tunetest titletest towntest hudtest masttest relictest ubosstest; do
  echo "=== $f ==="; node proto/$f.mjs
done
```

各スイートは `{errs, R}` を出力する。`errs` が空で、`R` の中の `false` が下の既知一覧だけなら合格。
全数1周で **約4分30秒**。

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

実測: 盾ボタンまわりの1行を触ったとき **8/41本・34秒**（全数は4分30秒）。

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
