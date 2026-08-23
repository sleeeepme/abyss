using System.Collections.Generic;
using UnityEngine;
using AbyssRelic.Core;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// 操作は移動のみ（Vampire Survivors 型）。攻撃は射程内に敵がいるときだけ自動で出る。
    /// 回避ボタンは持たない — 敵の予兆は「歩いて避ける」ことで成立させる。
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Refs")]
        public VirtualStick Stick;
        public GuardController Guard;
        public LayerMask EnemyLayer;
        [Tooltip("弓・杖の弾。ProjectilePool を流用する")]
        public ProjectilePool PlayerShots;

        Rigidbody2D _rb;
        Vector2 _facing = Vector2.right;
        float _atkCd;
        readonly Collider2D[] _hits = new Collider2D[24];
        GameRandom _rng = new GameRandom(1234);

        public Vector2 Facing => _facing;
        public EnemyController CurrentTarget { get; private set; }
        /// <summary>UI で攻撃範囲リングを描くための値。自動攻撃では射程が見えないと立ち回れない。</summary>
        public float AttackRange => StatCalc.Compute(GameState.Hero).AttackRange;

        void Awake()
        {
            _rb = GetComponent<Rigidbody2D>();
            _rb.gravityScale = 0f;
            _rb.freezeRotation = true;
        }

        void Update()
        {
            if (GameState.Hero == null || GameState.Run == null)
            {
                _rb.linearVelocity = Vector2.zero;
                return;
            }

            float dt = Time.deltaTime;
            _atkCd = Mathf.Max(0f, _atkCd - dt);

            Vector2 input = Stick != null ? Stick.Value : Vector2.zero;
#if UNITY_EDITOR || UNITY_STANDALONE
            var kb = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            if (kb.sqrMagnitude > 0.01f) input = kb;
#endif
            var st = StatCalc.Compute(GameState.Hero);
            // ガード中は動きが鈍る。この game では移動＝回避なので、これがガードの代償になる。
            float moveMul = (Guard != null && Guard.IsGuarding && st.HasShield)
                          ? Guard.GuardMoveMultiplier : 1f;
            _rb.linearVelocity = Vector2.ClampMagnitude(input, 1f) * st.MoveSpeed * moveMul;

            // 引き撃ちの判定に使う（設計書 4.1.4）
            _moving = input.sqrMagnitude > 0.02f;
            _moveDir = _moving ? input.normalized : Vector2.zero;

            // --- オート攻撃 ---
            // 射程内に敵がいるときだけ振る。いなければ移動方向を向くだけで空振りしない。
            CurrentTarget = FindNearest(st.AttackRange);
            if (CurrentTarget != null)
            {
                _facing = ((Vector2)(CurrentTarget.transform.position - transform.position)).normalized;
                Attack(st);
            }
            else if (input.sqrMagnitude > 0.02f)
            {
                _facing = input.normalized;
            }
        }

        Vector2 _moveDir;
        bool _moving;
        /// <summary>
        /// 今の撃ち方（設計書 4.1.4）。HUD に「引き撃ち 威力62%」のように常時出すこと。
        /// 数字が減っているのが見えないと、なぜ削れないのか分からず理不尽になる。
        /// </summary>
        public Footing CurrentFooting { get; private set; } = Footing.Melee;

        static System.Numerics.Vector2 ToNumerics(Vector2 v)
            => new System.Numerics.Vector2(v.x, v.y);
        static System.Numerics.Vector2 ToNumerics(Vector3 v)
            => new System.Numerics.Vector2(v.x, v.y);

        /// <summary>両手武器はガード中に振れない。片手武器は盾を構えたまま戦える。</summary>
        bool CanAttackNow(in DerivedStats st)
            => !(Guard != null && Guard.IsGuarding && st.HasShield && st.Hands == 2);

        void Attack(DerivedStats st)
        {
            if (_atkCd > 0f || !CanAttackNow(st)) return;
            _atkCd = 1f / (1.9f * st.Aspd);

            // 攻撃するたびに武器が擦り減る
            Durability.WearWeaponOnAttack(_rng, GameState.Hero);

            if (st.Projectile != Items.ProjectileKind.None)
            {
                // 弓・杖は飛び道具。杖の弾は 2 体貫通、弓は 1 体で消える。
                bool isBow = st.Projectile == Items.ProjectileKind.Arrow;
                float speed = isBow ? 13f : 8.5f;
                // 撃った瞬間の足の状態を弾へ焼き付ける。
                // 着弾時に判定すると「撃ってから止まれば満額」という抜け道ができる。
                CurrentFooting = CurrentTarget != null
                    ? Kiting.For(st, ToNumerics(_moveDir), _moving,
                                 ToNumerics(transform.position),
                                 ToNumerics(CurrentTarget.transform.position))
                    : Footing.Still;
                PlayerShots?.SpawnPlayerShot(transform.position, _facing * speed,
                                             st, isBow ? 1 : 2, st.AttackRange / speed + 0.05f,
                                             CurrentFooting);
                CombatEvents.RaiseSwing(transform.position, _facing);
                return;
            }

            int n = Physics2D.OverlapCircleNonAlloc(transform.position, st.AttackRange + 0.4f, _hits, EnemyLayer);
            for (int i = 0; i < n; i++)
            {
                var e = _hits[i].GetComponentInParent<EnemyController>();
                if (e == null || e.IsDead) continue;

                Vector2 d = (Vector2)e.transform.position - (Vector2)transform.position;
                if (d.magnitude > st.AttackRange + e.Radius) continue;
                if (Vector2.Angle(_facing, d) > st.AttackArcDeg) continue;

                bool crit = _rng.Next01() * 100f < st.Crit;
                var res = ElementalCombat.Resolve(_rng, BuildParts(st, crit ? 1.5f : 1f),
                                                  e.Res, e.Defense, GameState.Hero.level,
                                                  e.Status, false, e.Level);
                e.TakeTypedDamage(res);
                if (st.Leech > 0f) Heal(res.Total * st.Leech / 100f);
            }
            CombatEvents.RaiseSwing(transform.position, _facing);
        }

        /// <summary>一撃を属性ごとに分解する。武器の物理 + 装備で付いた属性ダメージ。</summary>
        public static List<DamagePart> BuildParts(in DerivedStats st, float mult)
        {
            var parts = new List<DamagePart> { new DamagePart(st.DmgType, st.Atk * mult) };
            if (st.ElemFire  > 0f) parts.Add(new DamagePart(DamageType.Fire,  st.ElemFire  * mult));
            if (st.ElemShock > 0f) parts.Add(new DamagePart(DamageType.Shock, st.ElemShock * mult));
            if (st.ElemFrost > 0f) parts.Add(new DamagePart(DamageType.Frost, st.ElemFrost * mult));
            return parts;
        }

        public void TakeDamage(float raw, int attackerLevel, DamageType type, EnemyController source)
        {
            // 死亡した同フレームの後続ヒットを無視する（無視しないと null 参照でループが止まる）
            if (GameState.Hero == null || GameState.Run == null) return;
            var st = StatCalc.Compute(GameState.Hero);

            // プレイヤー側も同じ解決器を通す。耐性と状態異常蓄積を敵と共通化しておくと
            // 「炎の敵に焼かれる」が自動的に成立する。
            var res = ElementalCombat.Resolve(_rng, new List<DamagePart> { new DamagePart(type, raw) },
                                              st.Res, st.Def, attackerLevel,
                                              GameState.Run.PlayerStatus, true, GameState.Hero.level);
            int dmg = res.Total;

            if (st.LowHpDr > 0f && GameState.Hero.hpNow / st.MaxHp <= 0.3f)
                dmg = Mathf.RoundToInt(dmg * (1f - st.LowHpDr / 100f));

            if (st.CharmDr > 0f)                                       // 加護の護符
                dmg = Mathf.RoundToInt(dmg * (1f - st.CharmDr / 100f));

            // 盾: パリイなら攻撃そのものが消滅する（弾も消える）
            if (Guard != null)
            {
                int after = Guard.ApplyGuard(dmg, st, GameState.Hero);
                if (after < 0) { CombatEvents.RaiseParry(transform.position); Stagger(source); return; }
                dmg = after;
            }

            Durability.Wear(GameState.Hero, Items.Slot.Armor, Durability.ArmorPerHit);
            GameState.Hero.hpNow -= dmg;
            CombatEvents.RaisePlayerHurt(dmg);

            if (st.Thorns > 0f && source != null && !source.IsDead)
                source.TakeDamage(Mathf.RoundToInt(dmg * st.Thorns / 100f), false);

            TryAutoHeal(st);

            if (GameState.Hero.hpNow <= 0f) RunManager.Instance.OnPlayerDied();
        }

        /// <summary>パリイした相手をよろめかせる。ノーリスクの受け得にしない。</summary>
        static void Stagger(EnemyController e) { if (e != null && !e.IsDead) e.Stagger(1.4f); }

        /// <summary>治癒の護符: HPが30%を切ったら1度だけ全回復。</summary>
        void TryAutoHeal(DerivedStats st)
        {
            var run = GameState.Run;
            if (run == null || run.AutoHealUsed) return;
            if (GameState.Hero.hpNow <= 0f || GameState.Hero.hpNow / st.MaxHp > 0.3f) return;
            if (!run.Charms.Exists(c => c.autoHeal)) return;

            run.AutoHealUsed = true;
            GameState.Hero.hpNow = st.MaxHp;
            CombatEvents.RaiseAutoHeal();
        }

        public void Heal(float v)
        {
            var st = StatCalc.Compute(GameState.Hero);
            GameState.Hero.hpNow = Mathf.Min(st.MaxHp, GameState.Hero.hpNow + v);
        }

        EnemyController FindNearest(float radius)
        {
            int n = Physics2D.OverlapCircleNonAlloc(transform.position, radius + 0.4f, _hits, EnemyLayer);
            EnemyController best = null; float bd = float.MaxValue;
            for (int i = 0; i < n; i++)
            {
                var e = _hits[i].GetComponentInParent<EnemyController>();
                if (e == null || e.IsDead) continue;
                float d = ((Vector2)(e.transform.position - transform.position)).magnitude - e.Radius;
                if (d <= radius && d < bd) { bd = d; best = e; }
            }
            return best;
        }
    }

    public static class CombatEvents
    {
        public static System.Action<Vector3, Vector2> OnSwing;
        public static System.Action<int> OnPlayerHurt;
        public static System.Action<Vector3, int, bool> OnDamageDealt;
        public static System.Action OnAutoHeal;
        public static System.Action<Vector3> OnParry;
        public static System.Action<Vector3, DamageResult> OnTypedDamage;
        public static System.Action<Vector3, int, StatusId> OnStatusDamage;

        public static void RaiseSwing(Vector3 p, Vector2 dir) => OnSwing?.Invoke(p, dir);
        public static void RaisePlayerHurt(int d) => OnPlayerHurt?.Invoke(d);
        public static void RaiseDamage(Vector3 p, int d, bool crit) => OnDamageDealt?.Invoke(p, d, crit);
        public static void RaiseAutoHeal() => OnAutoHeal?.Invoke();
        public static void RaiseParry(Vector3 p) => OnParry?.Invoke(p);
        public static void RaiseTypedDamage(Vector3 p, in DamageResult r) => OnTypedDamage?.Invoke(p, r);
        public static void RaiseStatusDamage(Vector3 p, int d, StatusId id) => OnStatusDamage?.Invoke(p, d, id);
    }
}
