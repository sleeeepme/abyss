using System.Collections.Generic;
using UnityEngine;
using AbyssRelic.Core;

namespace AbyssRelic.Runtime
{
    public class Projectile : MonoBehaviour
    {
        public float Life = 1.6f;
        [HideInInspector] public Vector2 Velocity;
        [HideInInspector] public float Damage;
        [HideInInspector] public int SourceLevel;
        [HideInInspector] public DamageType DmgType;

        /// <summary>true ならプレイヤーの矢・魔弾（敵に当たる）</summary>
        [HideInInspector] public bool FromPlayer;
        [HideInInspector] public int Pierce;
        [HideInInspector] public DerivedStats ShooterStats;
        /// <summary>
        /// 撃った瞬間の足の状態（設計書 4.1.4）。着弾時ではなく<b>発射時</b>に焼き付けること。
        /// 着弾で判定すると「撃ってから止まれば満額」という抜け道ができる。
        /// </summary>
        [HideInInspector] public Footing ShotFooting = Footing.Melee;
        readonly List<EnemyController> _alreadyHit = new List<EnemyController>();

        float _t;

        public void Launch(Vector2 vel, float dmg, int level, DamageType type)
        {
            Velocity = vel; Damage = dmg; SourceLevel = level; DmgType = type;
            FromPlayer = false; Pierce = 0; _alreadyHit.Clear(); _t = Life;
        }

        public void LaunchPlayerShot(Vector2 vel, DerivedStats st, int pierce, float life,
                                     Footing footing = Footing.Melee)
        {
            Velocity = vel; ShooterStats = st; Pierce = pierce;
            ShotFooting = footing;
            FromPlayer = true; _alreadyHit.Clear(); _t = life;
        }

        void Update()
        {
            _t -= Time.deltaTime;
            if (_t <= 0f) { ProjectilePool.Instance.Despawn(this); return; }

            transform.position += (Vector3)(Velocity * Time.deltaTime);

            var builder = RunManager.Instance.Builder;
            if (builder.IsWallAt(transform.position)) { ProjectilePool.Instance.Despawn(this); return; }

            if (FromPlayer) { UpdatePlayerShot(); return; }

            var player = RunManager.Instance.Player;
            if (((Vector2)(player.transform.position - transform.position)).sqrMagnitude < 0.2f)
            {
                player.TakeDamage(Damage, SourceLevel, DmgType, null);
                ProjectilePool.Instance.Despawn(this);
            }
        }

        void UpdatePlayerShot()
        {
            var pool = ProjectilePool.Instance;
            foreach (var go in RunManager.Instance.EnemyPool.Active)
            {
                var e = go.GetComponent<EnemyController>();
                if (e == null || e.IsDead || _alreadyHit.Contains(e)) continue;
                float r = e.Radius + 0.25f;
                if (((Vector2)(e.transform.position - transform.position)).sqrMagnitude > r * r) continue;

                _alreadyHit.Add(e);
                var st = ShooterStats;
                var rng = new GameRandom((uint)(Time.frameCount * 2654435761u + 17u));
                bool crit = rng.Next01() * 100f < st.Crit;
                // 引き撃ちの威力補正（設計書 4.1.4）。撃った瞬間の足で決まる。
                float footMul = Kiting.MultiplierOf(ShotFooting);
                var res = ElementalCombat.Resolve(rng,
                                                  PlayerController.BuildParts(st, (crit ? 1.5f : 1f) * footMul),
                                                  e.Res, e.Defense,
                                                  GameState.Hero != null ? GameState.Hero.level : 1,
                                                  e.Status, false, e.Level);
                e.TakeTypedDamage(res);
                if (st.Leech > 0f) RunManager.Instance.Player.Heal(res.Total * st.Leech / 100f);
                if (--Pierce <= 0) { pool.Despawn(this); return; }   // 弓は1体、杖は2体貫通
            }
        }
    }

    public class ProjectilePool : MonoBehaviour
    {
        public static ProjectilePool Instance { get; private set; }
        public SimplePool Pool;

        void Awake() { Instance = this; }

        public void Spawn(Vector3 pos, Vector2 vel, float dmg, int level, DamageType type)
        {
            var go = Pool.Get();
            go.transform.position = pos;
            go.GetComponent<Projectile>().Launch(vel, dmg, level, type);
        }

        public void SpawnPlayerShot(Vector3 pos, Vector2 vel, DerivedStats st, int pierce, float life,
                                    Footing footing = Footing.Melee)
        {
            var go = Pool.Get();
            go.transform.position = pos;
            go.GetComponent<Projectile>().LaunchPlayerShot(vel, st, pierce, life, footing);
        }

        public void Despawn(Projectile p) => Pool.Return(p.gameObject);
    }
}
