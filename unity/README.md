# Unity 実装（Phase 1 スケルトン）

> ## ⚠ この C# は現在【凍結中】です
>
> コアループが固まるまで、検証は **`proto/index.html` だけ**で回す方針に切り替えました。
> 仕様が動くたびにプロトタイプと C# の両方を直すのは、
> **まだ変わるものを二重に書いている**だけで、時間の使い方として割に合わないためです。
>
> **凍結時点の内容**: 引き撃ちの抑制（4.1.4）まで反映済み。
> これ以降のプロトタイプの変更は、ここには反映されていません。
>
> **正はプロトタイプと `docs/GAME_DESIGN.md`。** 食い違ったら必ずそちらが正しい。
> このフォルダは「Unity でどう組むかの下書き」として読んでください
> （データ構造・係数・実装上の注意は今も有効です）。
>
> **再開のタイミング**: コアループが固まったら、この下書きを参照しつつ
> プロトタイプから**書き直す**（差分を追いかけるより速い）。

`Assets/Scripts/` をそのまま Unity プロジェクトにドロップして使う想定。
シーン・プレハブ・アートは含まない（Phase 1 は仮素材で進める方針）。

## 前提

- **Unity 6 LTS / 2D URP**
- Unity 2022 以前を使う場合、`Rigidbody2D.linearVelocity` を `velocity` に置換する
  （`PlayerController.cs` / `EnemyController.cs` の 3 箇所）
- TextMeshPro（`TMPro`）を Package Manager で導入
- `InteractionController` / `StairsUI` は UI 参照を Inspector から接続する

## ファイル構成

| ファイル | 役割 | UnityEngine 依存 |
|---|---|---|
| `Core/GameRandom.cs` | 決定論 RNG（mulberry32）。シード再現用 | なし |
| `Core/HeroStats.cs` | 装備＋永続強化からの派生ステータス、ダメージ式 | なし |
| `Core/GameState.cs` | 永続状態 / ラン状態 / ロスト・帰還処理 | なし |
| `Core/MetaProgression.cs` | 永続強化 8 種と店（購入・リロール） | なし |
| `Core/FieldInventory.cs` | 探索中の装備付け替え・差分比較 | なし |
| `Core/Grave.cs` | 遺体（死亡時の残留物）と回収ルール | なし |
| `Core/Charms.cs` | 護符6種・リワード広告ガチャ・**進行度連動の排出帯5段** | なし |
| `Core/Durability.cs` | 耐久の消耗・破損・修理 | なし |
| `Core/Elements.cs` | 属性7種・状態異常5種・敵系統8種（**深度解禁＋階層ごとの系統数制限**）・ダメージ解決 | ほぼなし※ |
| `Core/Boons.cs` | 潜在15種（中/大/**極**）・3択抽選・ボス階と**第50階層の主** | なし |
| `Core/Party.cs` | 6ジョブ・仲間・漸近上限・経験値分配・広告蘇生・ユニーク敵 | なし |
| `Core/Kiting.cs` | **引き撃ちの威力補正（飛び道具は足を止めるほど強い）** | なし |
| `Runtime/GuardController.cs` | 盾のガードとパリイ判定 | あり |
| `Items/ItemData.cs` | 武器種8/盾3/防具/装飾品・属性・接頭辞・生成 | なし |
| `Core/Zones.cs` | **層6種（10階層ごとの色・装飾・粒・明かり・間取り・敵の偏り）** | なし |
| `Dungeon/BspGenerator.cs` | BSP ダンジョン生成（連結性が構造的に保証・層で間取りが変わる） | なし |
| `Runtime/DungeonBuilder.cs` | FloorMap → Tilemap 焼き込み | あり |
| `Runtime/PlayerController.cs` | 移動・**オート攻撃**・被弾（回避なし） | あり |
| `Runtime/EnemyController.cs` | アーキタイプ4種 × 系統8種の FSM、状態異常 | あり |
| `Runtime/AllyController.cs` | 仲間の追従・オート攻撃・固有スキル・被弾 | あり |
| `Runtime/RunManager.cs` | 階層遷移・撃破報酬・ドロップ・死亡・帰還 | あり |
| `Runtime/SimplePool.cs` | 敵/ドロップ/弾のプール | あり |
| `Runtime/ProjectilePool.cs` | 敵の弾＋プレイヤーの矢・魔弾（貫通対応） | あり |
| `Runtime/GroundItem.cs` | 床の装備 | あり |
| `Runtime/InteractionController.cs` | アイテム自動拾得＋階段ボタン | あり |
| `UI/VirtualStick.cs` | フローティング仮想スティック | あり |
| `UI/StairsUI.cs` | 「潜るか帰るか」ダイアログ | あり |

※ `Elements.cs` は `EnemyFamily.Color` のためだけに UnityEngine.Color を使っている。
ダメージ解決部分（`ElementalCombat` / `StatusHolder` / `Resistances`）は依存なしで単体テストできる。

**設計上のポイント**: ゲームロジック（生成・アイテム・ダメージ式）は
UnityEngine に一切依存していない。だから Unity を起動せずに単体テストでき、
バランス調整のシミュレーションも高速に回せる。MonoBehaviour 側は薄いガワに留めている。

## 最小シーンの組み立て手順

1. 空 GameObject `Game` に `RunManager` `ProjectilePool` を付ける
2. `Grid` の下に Tilemap を 2 枚（Floor / Wall）。Wall には `TilemapCollider2D` +
   `CompositeCollider2D`（Geometry Type: Polygons）
3. `DungeonBuilder` に Tilemap と TileBase 3 種を割り当て
4. Player: `Rigidbody2D`(Dynamic, Gravity 0, Freeze Rotation) + `CircleCollider2D`(r=0.32)
   + `PlayerController`。攻撃/回避ボタンは不要（攻撃は自動）。
   `PlayerController.AttackRange` を読んで攻撃範囲リング（点線の円）を必ず描くこと —
   自動攻撃では射程が見えないと立ち回れない
5. Enemy プレハブ: 同構成 + `EnemyController`。Layer を `Enemy` に。
   `SimplePool.Prefab` に割り当て、`PlayerController.EnemyLayer` で `Enemy` を選択
6. Canvas: `VirtualStick`（左半分に透明 Image + Raycast Target）、
   `PromptRoot`、`StairsUI`、バッグボタン。
   攻撃・回避ボタンは無い（攻撃は自動 / 回避は移動そのもの）
7. 遺体マーカー用の GameObject を 1 つ作り `RunManager.GraveMarker` に割り当てる
   （常に 1 つで足りるのでプール不要。回収判定は `RunManager.Update` が行う）
8. `GuardController` を Player と同じ階層に置き、`Stick` と
   `PlayerController.Guard` を相互に割り当てる。
   ガードは指の取り合いを避けるため `VirtualStick.OwnsPointer` を見ている
9. `PlayerController.PlayerShots` に `ProjectilePool` を割り当てる（弓・杖の弾に流用）
10. `RunManager.StartRun(1)` を拠点 UI の「潜る」ボタンから呼ぶ

## 未実装（Phase 2 以降）

- 探索中のバッグ UI（🎒）。ロジックは `FieldInventory.Equip / Unequip / Compare` に
  揃っているので、UI から呼んで `Time.timeScale = 0` にするだけ
- リワード広告の実装。`Gacha.Roll` は**広告の視聴完了コールバックの中からのみ**
  呼ぶこと（Unity Ads の `ShowAd` 完了 / AdMob の `OnUserEarnedReward`）。
  視聴前に抽選できる導線を作らない。
  ガチャ UI には `GachaBand.Of(persist.lastRunDepth)` の `Name` /
  `RareOrBetterPct` と `GachaBand.Next(...)` を必ず出す
  — 「奥に行くほど次が良くなる」が見えないと、この仕組みは機能しない
- 拠点 UI（ハブ + 道具屋 / 倉庫 / 永続強化 / ガチャ の4サブ画面）
  — ロジックは `MetaProgression` / `Shop` に揃っているので、UI から
  `MetaProgression.TryBuy` / `Shop.TryBuy` / `Shop.Roll` を呼ぶだけ
- セーブ/ロード。`PersistentState.upgradeLevels` は `Dictionary` なので
  **JsonUtility では保存されない**。`List<UpgradeEntry>` に平坦化するか、
  Newtonsoft.Json（`com.unity.nuget.newtonsoft-json`）を使うこと
- A* 経路探索（現状は敵が壁に引っかかる。障害物回避は Phase 2 で追加）
- クラス 3 種・スキルツリー
- ボスの MonoBehaviour 化。データは `BossConfig` / `BossSchedule` /
  `BossMove` / `BossMoveSet` に揃っているので、`EnemyController` に足すのは
  ボスフラグ・第2段階（激昂）・技の状態機械だけ。実装時の必須事項:
  - **描画半径を `BossConfig.Radius` から引くこと**。固定値のままだと
    「当たり判定は大きいのに見た目は雑魚」という一番まずい状態になる
  - コライダは**2つ**。物理（Wall と衝突）= `CollideRadius`、
    被弾判定のトリガー = `Radius`。通路は2マス幅なので、
    見た目どおりの半径で壁判定すると大ボスが部屋から出られない
  - **予兆で描く図形＝実際に当たる範囲**を厳守。ズレると
    「避けたのに当たった」になり、回避ボタンの無いこのゲームでは即座に理不尽になる
  - **溜め中はボスを完全に停止**させる（`linearVelocity = 0`）。避ける時間の保証
  - 技の選択は `BossMoveSet.Pick(rng, owned, distance, radius, lastMove)`。
    直前と同じ技を避けるロジックが入っている
  - 激昂時は `BossMoveSet.OnRage(tier)` の技を `owned` に足す
  - **名前とHPゲージは最初の被弾まで出さない**
    （`BossSchedule.RevealNameAndHpOnFirstDamage`）。金の輪と王冠は最初から見せる
  - 波動（Wave）は輪そのものを 1 つの GameObject にして
    `BossMove.WaveSpeed` で半径を伸ばし、`WaveBand` の帯に入った対象を
    **1体につき1回だけ**殴る（ヒット済みリストを持たせる）
- 潜在の選択 UI。`Boons.Roll(rng, tier)` で3択を引き、選んだ `BoonPick` を
  `Hero.boons` に足す（`StatCalc` は既に読んでいる）。
  **仲間がいる場合は付与先も選ばせる**こと（`Hero.LivingParty()`）。
  `Ally.boons` は `Party.Compute` 経由で本当に効くので、選択に意味がある
- 仲間まわりの UI 3 つ。ロジックは `Party` / `RunManager` に揃っている
  - 加入: `RunManager.RollNpcCandidate(depth)` で候補を作り、「？」付きの人影として置く。
    タップ or 足元プロンプトで能力比較モーダル → `TryRecruit`
  - 倒れたとき: `RunManager.AllyDown` を購読し、「見送る（`ReleaseAlly`）」と
    「広告を見て蘇生」の2択を出す。蘇生は**視聴完了コールバックの中でのみ**
    `Party.Revive` を呼ぶこと（Lv.1 + 装備ランダムロスト、1人1回）
  - パーティ HUD: 画面左に仲間の名前・Lv・HP バーを縦に並べる（右はミニマップ）
- 仲間の描画は**六角形＋ジョブ色**にすること。敵は三角/四角/ひし形/円なので
  形が被らず、混戦でも一目で味方だと分かる
- 敵のターゲット選択を「プレイヤーと仲間のうち最も近い者」に変えること。
  これをやらないと仲間が無敵になり、壁役という役割が成立しない
- ユニーク敵。`UniqueEnemy` に係数と名前が揃っているので、`EnemyController` に
  `uniq` フラグと紫の二重リング＋常時ネームプレートを足し、
  撃破時に潜在3択を開くだけ。**階段は塞がない**（ボスとの違いはここ）
- 第50階層の踏破画面。`RunManager.FinalBossCleared` を購読する
- 引き撃ちの表示。ロジックは `Kiting` に入っていて
  `PlayerController.CurrentFooting` が今の撃ち方を持っている。UI 側でやることは 2 つ:
  - 飛び道具を持っている間だけ、HUD に「引き撃ち 威力62%」を常時出す
    （`Kiting.Label` / `Kiting.MultiplierOf`）。色は 満額=緑 / 85%=黄 / 62%=赤
  - `Kiting.IsWeakened` が true の一撃は、ダメージ数値をくすませて「↓」を添える。
    **数字が減っているのが見えないと、なぜ削れないのか分からず理不尽になる**
- 層の見た目。`FloorMap.Zone` に色・装飾・粒・明かりが全部入っている。
  `DungeonBuilder` は Tilemap に色を焼き込むだけでよく、実装すべきは 4 つ:
  - **TileBase を層ごとに差し替える**か、`Tilemap.color` に `Zone.Floor` / `Zone.Wall` を掛ける。
    `FloorMap.ZoneCycle` の回数だけ `Zones.CycleDimPerLap`(0.88) を掛けて暗くする
  - **床の装飾**（`Zone.Deco`）。タイル座標のハッシュ `% Zone.DecoEvery == 0` で置く。
    形が変わることが本体なので、色違いで済ませないこと
  - **漂う粒**。ParticleSystem 1 つを画面座標で回し、`Zone.Air` の
    数・色・大きさ・流れる向きを差し替える。数は 40 が上限（端末に優しく）
  - **明かり**。`Zone.LightRadius` を 2D Light の Outer Radius か
    シェーダのフォグ距離に入れる。層ごとに見える範囲が変わるのが効く
  - 層が変わる階層（`Zones.IsZoneStart`）でだけ層名バナーを 3.4 秒出す。
    階段 UI は `Zones.ChangesNext(depth)` で次の層を予告する
- トラップ、回復泉、属性ダメージのビジュアル（弱点▲/耐性▼の表示）
