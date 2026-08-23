using System.Collections.Generic;
using UnityEngine;
using AbyssRelic.Core;
using AbyssRelic.Dungeon;
using AbyssRelic.Items;

namespace AbyssRelic.Runtime
{
    /// <summary>ラン全体の進行管理: 階層遷移 / 撃破報酬 / ロスト / 帰還。</summary>
    public class RunManager : MonoBehaviour
    {
        public static RunManager Instance { get; private set; }

        [Header("Refs")]
        public DungeonBuilder Builder;
        public PlayerController Player;
        public SimplePool EnemyPool;
        public SimplePool DropPool;
        [Tooltip("遺体マーカー。常に 1 つで足りるのでプールにしない")]
        public GameObject GraveMarker;
        public float GraveCollectRadius = 0.9f;

        [Header("Events")]
        public System.Action<int> OnFloorEntered;
        public System.Action<DeathReport> OnDeath;
        public System.Action<List<Item>> OnReturned;
        public System.Action<Grave> OnGraveCollected;

        GameRandom _rng;
        Vector2 _gravePos;
        bool _graveOnThisFloor;

        public bool GraveOnThisFloor => _graveOnThisFloor;
        public Vector2 GravePosition => _gravePos;

        void Awake() { Instance = this; }

        public void StartRun(int startDepth = 0)
        {
            int d = startDepth > 0 ? startDepth : Mathf.Max(1, GameState.Persist.startDepth);
            GameState.Persist.runs++;
            GameState.Run = new RunState { Depth = d };
            if (GameState.Hero == null) GameState.Hero = GameState.NewHero();
            // ガチャの持ち込み枠をここで渡す（武器は持ち物、護符は常時効果）
            Gacha.HandOverToRun(GameState.Persist, GameState.Run);
            GameState.Hero.hpNow = StatCalc.Compute(GameState.Hero).MaxHp;
            // 「直近の進行度」はこの探索のものに切り替わる。
            // 潜り始めた時点でリセットしないと前回の記録が積み残る。
            GameState.Persist.lastRunDepth = d;
            EnterFloor(d);
        }

        /// <summary>死亡後の再開。新しいキャラを作って拠点に戻す。</summary>
        public void RestartAfterDeath()
        {
            GameState.Run = null;
            GameState.Hero = GameState.NewHero();
            GameState.Persist.RefreshUnlocks();
            var unlocked = GameState.Persist.unlockedStartDepths;
            GameState.Persist.startDepth = Mathf.Min(GameState.Persist.startDepth,
                                                     unlocked[unlocked.Count - 1]);
        }

        public void EnterFloor(int depth)
        {
            // seed = hash(runId, depth)。同一ランで同じ階層に戻れば同じ構造になる（設計書 2.3）。
            uint seed = GameRandom.Hash(GameState.Persist.runs, depth);
            _rng = new GameRandom(seed);

            GameState.Run.Depth = depth;
            GameState.Persist.deepestDepth = Mathf.Max(GameState.Persist.deepestDepth, depth);
            // 死んでも残る＝次のガチャの排出帯になる値
            GameState.Persist.lastRunDepth = Mathf.Max(GameState.Persist.lastRunDepth, depth);

            var map = BspGenerator.Generate(depth, seed);
            Builder.Build(map);

            var start = map.StartRoom;
            Player.transform.position = new Vector3(start.Cx + 0.5f, start.Cy + 0.5f, 0f);

            SpawnEnemies(map, depth);
            SpawnChests(map, depth);
            PlaceGrave(map, depth);

            OnFloorEntered?.Invoke(depth);
        }

        /// <summary>
        /// 遺体はその階層に来たときだけ出現する。マップは毎回生成し直されるので、
        /// 死んだ座標に一番近い床タイルへスナップして「だいたい同じあたり」に置く。
        /// </summary>
        void PlaceGrave(FloorMap map, int depth)
        {
            var g = GameState.Persist.grave;
            _graveOnThisFloor = g != null && g.depth == depth;
            if (GraveMarker != null) GraveMarker.SetActive(_graveOnThisFloor);
            if (!_graveOnThisFloor) return;

            _gravePos = SnapToFloor(map, g.x, g.y);
            if (GraveMarker != null)
                GraveMarker.transform.position = new Vector3(_gravePos.x, _gravePos.y, 0f);
        }

        static Vector2 SnapToFloor(FloorMap map, float x, float y)
        {
            int gx = Mathf.Clamp(Mathf.RoundToInt(x), 0, map.Width - 1);
            int gy = Mathf.Clamp(Mathf.RoundToInt(y), 0, map.Height - 1);
            int limit = Mathf.Max(map.Width, map.Height);
            for (int r = 0; r < limit; r++)
            {
                for (int dy = -r; dy <= r; dy++)
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) != r) continue;  // 外周のみ
                        int nx = gx + dx, ny = gy + dy;
                        if (nx < 0 || ny < 0 || nx >= map.Width || ny >= map.Height) continue;
                        if (!map.IsWall(nx, ny)) return new Vector2(nx + 0.5f, ny + 0.5f);
                    }
            }
            return new Vector2(map.StartRoom.Cx + 0.5f, map.StartRoom.Cy + 0.5f);
        }

        void Update()
        {
            if (!_graveOnThisFloor || GameState.Run == null) return;
            Vector2 p = Player.transform.position;
            if ((p - _gravePos).sqrMagnitude > GraveCollectRadius * GraveCollectRadius) return;

            var g = GameState.Persist.grave;
            if (GraveRules.Collect())
            {
                _graveOnThisFloor = false;
                if (GraveMarker != null) GraveMarker.SetActive(false);
                OnGraveCollected?.Invoke(g);
            }
        }

        void SpawnEnemies(FloorMap map, int depth)
        {
            EnemyPool.ReturnAll();
            int count = Mathf.Clamp(7 + Mathf.FloorToInt(depth * 1.5f), 8, 40);
            int level = depth + depth / 8;
            // 深度で系統が解禁され、さらに 1 階層あたりの系統数を絞る（序盤は 1 種類）
            var families = EnemyFamily.ForFloor(_rng, depth);

            for (int i = 0; i < count; i++)
            {
                var room = map.Rooms[_rng.Range(0, map.Rooms.Count - 1)];
                if (room.Cx == map.StartRoom.Cx && room.Cy == map.StartRoom.Cy && map.Rooms.Count > 1) { i--; continue; }

                var go = EnemyPool.Get();
                go.transform.position = new Vector3(
                    room.X + _rng.Range(1f, Mathf.Max(1.2f, room.W - 1f)),
                    room.Y + _rng.Range(1f, Mathf.Max(1.2f, room.H - 1f)), 0f);

                bool elite = depth >= 16 && _rng.Chance(0.14f);
                var arch = ArchetypeDef.All[(int)(_rng.Next01() * ArchetypeDef.All.Length)];
                var fam  = families[(int)(_rng.Next01() * families.Count)];
                go.GetComponent<EnemyController>().Init(arch, fam, level, elite, _rng, Player.transform);
            }
        }

        void SpawnChests(FloorMap map, int depth)
        {
            DropPool.ReturnAll();
            float mf = StatCalc.Compute(GameState.Hero).MagicFind;
            int chests = Mathf.Clamp(1 + depth / 6, 1, 6);
            for (int i = 0; i < chests; i++)
            {
                var room = map.Rooms[_rng.Range(0, map.Rooms.Count - 1)];
                SpawnDrop(new Vector3(room.Cx + _rng.Range(-1f, 1f), room.Cy + _rng.Range(-1f, 1f), 0f),
                          ItemFactory.Create(_rng, depth + 2, mf));
            }
        }

        public void OnEnemyKilled(EnemyController e, Vector3 pos, int level, bool elite)
        {
            GameState.Run.Kills++;
            GameState.GrantXp(Mathf.RoundToInt((6 + level * 4.2f) * (elite ? 2.5f : 1f)));
            GameState.Run.Gold += Mathf.RoundToInt((3 + level * 2) * _rng.Range(0.7f, 1.4f));

            // 設計書 3.3
            float rate = 0.22f + (elite ? 0.35f : 0f);
            if (_rng.Chance(rate))
            {
                float mf = StatCalc.Compute(GameState.Hero).MagicFind;
                int ilvl = GameState.Run.Depth + _rng.Range(-2, 3);
                SpawnDrop(pos, ItemFactory.Create(_rng, ilvl, mf));
            }
        }

        /// <summary>
        /// 盗賊の「物色」。仲間がとどめを刺したときの追加ドロップ。
        /// EnemyController.Die から killer を渡して呼ぶ。
        /// </summary>
        public void OnAllyFinishedKill(Ally killer, Vector3 pos)
        {
            if (killer == null || killer.Job.Skill != AllySkill.Scavenge) return;
            if (!_rng.Chance(Party.ScavengeDropChance)) return;
            float mf = StatCalc.Compute(GameState.Hero).MagicFind + 40f;
            SpawnDrop(pos, ItemFactory.Create(_rng, GameState.Run.Depth + _rng.Range(-1, 4), mf));
        }

        // ---- 仲間 ----

        /// <summary>
        /// 階層に 1 体だけ現れる仲間候補。ボス階には出さない
        /// （ボス部屋の直前で加入判断をさせない）。パーティが満員なら出さない。
        /// UI 側はこれを受けて「？」付きの人影を置き、
        /// タップまたは足元のプロンプトで能力確認モーダルを開くこと。
        /// </summary>
        public Ally RollNpcCandidate(int depth)
        {
            if (GameState.Hero == null) return null;
            if (BossSchedule.IsBossFloor(depth)) return null;
            if (GameState.Hero.LivingParty().Count >= Party.Max) return null;
            if (!_rng.Chance(Party.NpcChance)) return null;
            return Party.Create(_rng, depth, GameState.Hero);
        }

        /// <summary>加入。最大3名。名前はジョブ名（重複時のみ番号）。</summary>
        public bool TryRecruit(Ally a)
        {
            if (a == null || GameState.Hero == null) return false;
            if (GameState.Hero.LivingParty().Count >= Party.Max) return false;
            Party.EnsureUniqueName(a, GameState.Hero.party);
            GameState.Hero.party.Add(a);
            return true;
        }

        /// <summary>
        /// 仲間が倒れた。ここでロストが確定する。
        /// UI は「見送る（ロスト）」と「広告を見て蘇生」の 2 択を出し、
        /// 蘇生を選んだ場合は<b>視聴完了コールバックの中でのみ</b> <see cref="Party.Revive"/> を呼ぶ。
        /// </summary>
        public System.Action<Ally> AllyDown;
        public void OnAllyDown(Ally a) => AllyDown?.Invoke(a);

        /// <summary>ロスト確定（見送る）。</summary>
        public void ReleaseAlly(Ally a) => GameState.Hero?.party.Remove(a);

        /// <summary>第50階層の主を倒したとき。階層はこの先も続く（深さの上限は設けない）。</summary>
        public System.Action FinalBossCleared;
        public void OnFinalBossDown()
        {
            GameState.Persist.cleared++;
            FinalBossCleared?.Invoke();
        }

        void SpawnDrop(Vector3 pos, Item item)
        {
            var go = DropPool.Get();
            go.transform.position = pos;
            go.GetComponent<GroundItem>().Bind(item);
        }

        public void Pickup(GroundItem gi)
        {
            GameState.Run.Loot.Add(gi.Item);
            DropPool.Return(gi.gameObject);
        }

        public void OnPlayerDied()
        {
            Vector2 p = Player.transform.position;
            var report = GameState.KillHero(_rng, p.x, p.y);
            _graveOnThisFloor = false;
            if (GraveMarker != null) GraveMarker.SetActive(false);
            OnDeath?.Invoke(report);
        }

        public void ReturnToTown()
        {
            var gained = GameState.ReturnToTown();
            OnReturned?.Invoke(gained);
        }

        public void DescendOrReturn(bool descend)
        {
            if (descend) EnterFloor(GameState.Run.Depth + 1);
            else ReturnToTown();
        }
    }
}
