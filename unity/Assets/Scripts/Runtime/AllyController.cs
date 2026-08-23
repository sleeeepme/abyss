using System.Collections.Generic;
using UnityEngine;
using AbyssRelic.Core;
using AbyssRelic.Items;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// 仲間の挙動。
    ///
    /// 仲間は「追う・戦う・倒れる」しかしない。<b>指示は一切出せない。</b>
    /// 操作は移動だけ、という原則をパーティにも通すためで、
    /// 面倒を見る対象ではなく、勝手に戦う頭数として扱う。
    ///
    /// 描画は<b>六角形＋ジョブ色</b>にすること。敵は三角/四角/ひし形/円なので形が被らず、
    /// 混戦でも一目で味方だと分かる（プロトタイプで検証済み）。
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    public class AllyController : MonoBehaviour
    {
        public Ally Data;
        public float Radius = 0.30f;
        public ProjectilePool Shots;
        public LayerMask EnemyLayer;

        Rigidbody2D _rb;
        Transform _player;
        GameRandom _rng;
        float _attackCd, _swing, _hitFlash;
        Vector2 _lastMove;
        static readonly Collider2D[] _hits = new Collider2D[32];

        public bool Dead => Data == null || Data.dead;
        /// <summary>状態異常は敵・プレイヤーと同じエンジンを通す。</summary>
        public readonly StatusHolder Status = new StatusHolder();

        public void Bind(Ally data, Transform player, GameRandom rng)
        {
            Data = data; _player = player; _rng = rng;
            _rb = GetComponent<Rigidbody2D>();
            _attackCd = 0f;
        }

        void Update()
        {
            if (Dead || GameState.Hero == null || GameState.Run == null) return;
            float dt = Time.deltaTime;
            var st = Party.Compute(Data, GameState.Hero);

            Status.Tick(dt, (dmg, _) => Data.hpNow -= dmg);
            if (Data.hpNow <= 0f) { Down(); return; }
            if (Status.Has(StatusId.Stagger)) return;
            float slow = Status.Has(StatusId.Chill) ? 1f - Elements.ChillSlow : 1f;

            _attackCd = Mathf.Max(0f, _attackCd - dt);
            _swing    = Mathf.Max(0f, _swing - dt);
            _hitFlash = Mathf.Max(0f, _hitFlash - dt);

            TickPrayer(dt);

            Vector2 me = transform.position, pp = _player.position;
            float dp = Vector2.Distance(me, pp);

            // プレイヤーから離れすぎたら敵を捨てて戻る
            var target = dp > Party.FollowDistance * 1.6f ? null : FindEnemy(me, Data.Job.Aggro);

            Vector2 mv = Vector2.zero;
            bool ranged = st.Projectile != ProjectileKind.None;
            if (target == null || dp > Party.FollowDistance)
            {
                if (dp > 1.1f) mv = (pp - me).normalized;
            }
            else
            {
                Vector2 tp = target.transform.position;
                float d = Vector2.Distance(me, tp);
                float keep = st.AttackRange * (ranged ? 0.7f : 0.75f);
                if (d > keep) mv = (tp - me).normalized;
                else if (ranged && d < keep * 0.55f) mv = (me - tp).normalized;   // 射手は下がる
            }
            _rb.linearVelocity = mv * st.MoveSpeed * slow;
            _lastMove = mv;                      // 引き撃ち判定に使う

            if (target != null && _attackCd <= 0f)
            {
                float d = Vector2.Distance(me, (Vector2)target.transform.position);
                if (d <= st.AttackRange + target.Radius) Attack(st, target);
            }
        }

        /// <summary>僧侶の「祈り」。回復役がいると探索の長さそのものが変わる。</summary>
        void TickPrayer(float dt)
        {
            if (Data.Job.Skill != AllySkill.Prayer) return;
            Data.prayCooldown -= dt;
            if (Data.prayCooldown > 0f) return;
            Data.prayCooldown = Party.PrayerInterval;

            float amt = 4f + Data.level * 1.6f;
            var h = GameState.Hero;
            h.hpNow = Mathf.Min(StatCalc.Compute(h).MaxHp, h.hpNow + amt);
            foreach (var m in h.LivingParty())
                m.hpNow = Mathf.Min(Party.Compute(m, h).MaxHp, m.hpNow + amt);
        }

        void Attack(DerivedStats st, EnemyController target)
        {
            var j = Data.Job;
            float chill = Status.Has(StatusId.Chill) ? 1f - Elements.ChillSlow : 1f;
            _attackCd = 1f / (1.9f * st.Aspd * chill);
            _swing = 0.18f;
            Data.shots++;

            Vector2 me = transform.position;
            Vector2 dir = ((Vector2)target.transform.position - me).normalized;
            if (_rng.Chance(Durability.WeaponWearChance)) Durability.Wear(Data, Slot.Weapon, 1);

            // 狩人の「狙撃」: 3発に1回は必ず会心
            bool forceCrit = j.Skill == AllySkill.Snipe && Data.shots % Party.SnipeEvery == 0;

            if (st.Projectile != ProjectileKind.None)
            {
                // 魔法使いの「連鎖」は Projectile 側の ChainLeft を見て跳ねさせる
                float speed = st.Projectile == ProjectileKind.Arrow ? 13f : 8.5f;
                int pierce  = st.Projectile == ProjectileKind.Arrow ? 1 : 2;
                // 仲間の射手にも同じ引き撃ち規則を通す（下がりながら撃てば弱くなる）
                var foot = Kiting.For(st,
                    new System.Numerics.Vector2(_lastMove.x, _lastMove.y), _lastMove != Vector2.zero,
                    new System.Numerics.Vector2(me.x, me.y),
                    new System.Numerics.Vector2(target.transform.position.x, target.transform.position.y));
                Shots?.SpawnPlayerShot(transform.position, dir * speed, st, pierce,
                                       st.AttackRange / speed + 0.05f, foot);
                return;
            }

            float half = st.AttackArcDeg;
            int n = Physics2D.OverlapCircleNonAlloc(me, st.AttackRange + 0.4f, _hits, EnemyLayer);
            for (int i = 0; i < n; i++)
            {
                var e = _hits[i].GetComponent<EnemyController>();
                if (e == null || e.IsDead) continue;
                Vector2 to = (Vector2)e.transform.position - me;
                if (to.magnitude > st.AttackRange + e.Radius) continue;
                if (Vector2.Angle(dir, to) > half) continue;

                bool crit = forceCrit || _rng.Next01() * 100f < st.Crit;
                var res = ElementalCombat.Resolve(_rng, PlayerController.BuildParts(st, crit ? 1.5f : 1f),
                                                  e.Res, e.Defense, Data.level,
                                                  e.Status, false, e.Level);
                e.TakeTypedDamage(res);
                if (st.Leech > 0f)
                    Data.hpNow = Mathf.Min(Party.Compute(Data, GameState.Hero).MaxHp,
                                           Data.hpNow + res.Total * st.Leech / 100f);
                // 重騎士の「打ち払い」
                if (j.Skill == AllySkill.Crush && !e.IsDead && _rng.Chance(Party.CrushChance))
                    e.Stagger(Elements.Def(StatusId.Stagger).Duration);
            }
        }

        EnemyController FindEnemy(Vector2 from, float radius)
        {
            int n = Physics2D.OverlapCircleNonAlloc(from, radius, _hits, EnemyLayer);
            EnemyController best = null; float bd = float.MaxValue;
            for (int i = 0; i < n; i++)
            {
                var e = _hits[i].GetComponent<EnemyController>();
                if (e == null || e.IsDead) continue;
                float d = Vector2.SqrMagnitude((Vector2)e.transform.position - from);
                if (d < bd) { bd = d; best = e; }
            }
            return best;
        }

        /// <summary>仲間の被弾。プレイヤーと違って盾のパリイは無い（構える操作を持たないので）。</summary>
        public void TakeDamage(float raw, int attackerLevel, DamageType type)
        {
            if (Dead) return;
            var st = Party.Compute(Data, GameState.Hero);
            var res = ElementalCombat.Resolve(_rng, new List<DamagePart> { new DamagePart(type, raw) },
                                              st.Res, st.Def, attackerLevel,
                                              Status, false, Data.level);
            float dm = res.Total;
            // 盾持ちのジョブは常時軽減。構える操作が無いぶん、効果は半分にしてある。
            if (st.HasShield && st.Block > 0f)
            {
                dm = Mathf.Max(1f, dm * (1f - st.Block / 200f));
                Durability.Wear(Data, Slot.Shield, 1);
            }
            Data.hpNow -= dm;
            _hitFlash = 0.12f;
            Durability.Wear(Data, Slot.Armor, 1);
            if (Data.hpNow <= 0f) Down();
        }

        /// <summary>
        /// 戦士の「庇う」で肩代わりする分。PlayerController の被弾処理から呼ぶ。
        /// 前に出て殴るだけでなく、立ち位置そのものが仕事になる役割を1つ作りたかった。
        /// </summary>
        public void AbsorbForPlayer(float amount)
        {
            if (Dead) return;
            Data.hpNow -= amount;
            _hitFlash = 0.12f;
            if (Data.hpNow <= 0f) Down();
        }

        void Down()
        {
            if (Data.dead) return;
            Data.dead = true; Data.hpNow = 0f;
            if (_rb != null) _rb.linearVelocity = Vector2.zero;
            // UI 側でロスト確定と広告蘇生を提案する（Party.Revive は視聴完了後にのみ呼ぶ）
            RunManager.Instance?.OnAllyDown(Data);
            gameObject.SetActive(false);
        }
    }
}
