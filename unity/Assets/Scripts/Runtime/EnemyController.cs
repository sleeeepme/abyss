using UnityEngine;
using AbyssRelic.Core;

namespace AbyssRelic.Runtime
{
    public enum Archetype { Rusher, Ranger, Swarm, Turret }

    [System.Serializable]
    public class ArchetypeDef
    {
        public Archetype Kind;
        public string Name;
        public float HpMul = 1f, AtkMul = 1f, MoveSpeed = 2.6f;
        public float Range = 0.9f, Telegraph = 0.42f, AggroRadius = 8f, KeepDistance = 0f;

        public static readonly ArchetypeDef[] All =
        {
            new ArchetypeDef{Kind=Archetype.Rusher,Name="徘徊者",HpMul=1.0f,AtkMul=1.0f,MoveSpeed=2.6f,Range=0.9f,Telegraph=0.42f,AggroRadius=8f},
            new ArchetypeDef{Kind=Archetype.Ranger,Name="射手",  HpMul=0.7f,AtkMul=0.9f,MoveSpeed=1.9f,Range=6.5f,Telegraph=0.62f,AggroRadius=10f,KeepDistance=5.5f},
            new ArchetypeDef{Kind=Archetype.Swarm, Name="蟲",    HpMul=0.42f,AtkMul=0.55f,MoveSpeed=3.2f,Range=0.8f,Telegraph=0.28f,AggroRadius=9f},
            new ArchetypeDef{Kind=Archetype.Turret,Name="守り手",HpMul=1.6f,AtkMul=1.2f,MoveSpeed=0f,  Range=5.0f,Telegraph=0.75f,AggroRadius=6f},
        };
    }

    /// <summary>エリート接頭辞。敵の種類を増やさずに多様性を稼ぐ（設計書 4.3）。</summary>
    public struct EliteAffix
    {
        public string Name; public float HpMul, SpeedMul, ThornsPct, AtkMul, TeleMul;
        // 属性は系統の担当なので、エリート接頭辞は挙動を歪ませる役に絞る
        public static readonly EliteAffix[] All =
        {
            new EliteAffix{Name="俊敏な", HpMul=1f, SpeedMul=1.35f, AtkMul=1f, TeleMul=1f},
            new EliteAffix{Name="頑健な", HpMul=2f, SpeedMul=1f,    AtkMul=1f, TeleMul=1f},
            new EliteAffix{Name="反射する",HpMul=1f,SpeedMul=1f,    AtkMul=1f, TeleMul=1f, ThornsPct=0.25f},
            new EliteAffix{Name="狂った", HpMul=1f, SpeedMul=1f,    AtkMul=1.35f, TeleMul=0.7f},
        };
    }

    /// <summary>Idle → Alert → Chase → Attack → Recover のステートマシン。</summary>
    public class EnemyController : MonoBehaviour
    {
        public float Radius = 0.34f;

        ArchetypeDef _arch;
        EliteAffix _affix;
        bool _isElite, _hasAffix;
        int _level;
        float _hp, _maxHp, _atk, _def, _moveSpeed;
        float _attackCd, _telegraph;
        bool _dead;
        Transform _player;
        Rigidbody2D _rb;
        GameRandom _rng;

        // 視界外は AI を粗い間隔に落とす（設計書 6. パフォーマンス方針）
        const float FarUpdateInterval = 0.5f;
        float _farTimer;

        public bool IsDead => _dead;
        public float Defense => _def;
        public int Level => _level;
        public string DisplayName =>
            (_hasAffix ? _affix.Name : "") + (_family != null ? _family.Name + "の" : "") + _arch.Name;

        EnemyFamily _family;
        public readonly StatusHolder Status = new StatusHolder();
        /// <summary>系統が持つ耐性。形＝行動、色＝属性で読ませる。</summary>
        public Resistances Res => _family != null ? _family.Res : null;
        public DamageType AttackType => _family != null ? _family.AttackType : DamageType.Blunt;
        public UnityEngine.Color FamilyColor => _family != null ? _family.Color : UnityEngine.Color.white;

        public void Init(ArchetypeDef arch, EnemyFamily family, int level, bool elite,
                         GameRandom rng, Transform player)
        {
            _arch = arch; _family = family; _level = level; _isElite = elite; _rng = rng; _player = player;
            Status.Clear();
            _rb = GetComponent<Rigidbody2D>();
            if (_rb != null) { _rb.gravityScale = 0f; _rb.freezeRotation = true; }

            _maxHp = (26f + level * 11f) * arch.HpMul * (elite ? 2.4f : 1f);
            _atk   = (5f + level * 2.6f) * arch.AtkMul * (elite ? 1.35f : 1f);
            _def   = level * 1.6f * (elite ? 1.4f : 1f);
            _moveSpeed = arch.MoveSpeed;

            if (elite)
            {
                _affix = EliteAffix.All[(int)(rng.Next01() * EliteAffix.All.Length)];
                _hasAffix = true;
                _maxHp *= _affix.HpMul;
                _moveSpeed *= _affix.SpeedMul;
                if (_affix.AtkMul > 0f) _atk *= _affix.AtkMul;
            }
            _hp = _maxHp;
            _dead = false;
            _attackCd = rng.Range(0f, 1f);
            _telegraph = 0f;
            gameObject.SetActive(true);
        }

        void Update()
        {
            if (_dead || _player == null) return;

            // 状態異常: 出血・火傷は継続ダメージ、よろめきは行動停止、凍傷は減速
            Status.Tick(Time.deltaTime, (d, id) =>
            {
                _hp -= d;
                CombatEvents.RaiseStatusDamage(transform.position, d, id);
                if (_hp <= 0f && !_dead) Die();
            });
            if (_dead) return;
            if (Status.Has(StatusId.Stagger))          // 打撃で止まる
            {
                if (_rb != null) _rb.linearVelocity = Vector2.zero;
                return;
            }
            float slow = Status.Has(StatusId.Chill) ? (1f - Elements.ChillSlow) : 1f;

            Vector2 toP = (Vector2)_player.position - (Vector2)transform.position;
            float dist = toP.magnitude;

            if (dist > _arch.AggroRadius * 2f)
            {
                // 遠い敵は 0.5 秒ごとの粗い判定に落とす
                _farTimer -= Time.deltaTime;
                if (_farTimer > 0f) return;
                _farTimer = FarUpdateInterval;
                if (_rb != null) _rb.linearVelocity = Vector2.zero;
                return;
            }

            float dt = Time.deltaTime * slow;
            _attackCd -= dt;

            // 予兆中は移動を止める。必ず 0.28〜0.75 秒の予兆を入れるのがモバイルでの可読性の要。
            if (_telegraph > 0f)
            {
                _telegraph -= dt;
                if (_rb != null) _rb.linearVelocity = Vector2.zero;
                if (_telegraph <= 0f) FireAttack(toP, dist);
                return;
            }

            if (dist > _arch.AggroRadius)
            {
                if (_rb != null) _rb.linearVelocity = Vector2.zero;
                return;
            }

            Vector2 move = Vector2.zero;
            if (_moveSpeed > 0f)
            {
                Vector2 dir = toP / Mathf.Max(0.0001f, dist);
                if (_arch.KeepDistance > 0f && dist < _arch.KeepDistance - 0.8f) move = -dir;
                else if (dist > _arch.Range * 0.85f) move = dir;
            }
            if (_rb != null) _rb.linearVelocity = move * _moveSpeed * slow;

            if (_attackCd <= 0f && dist < _arch.Range)
            {
                _telegraph = _arch.Telegraph * (_hasAffix && _affix.TeleMul > 0f ? _affix.TeleMul : 1f);
                _attackCd = _arch.Range > 3f ? 2.2f : 1.5f;
                CombatEvents.RaiseSwing(transform.position, toP.normalized);
            }
        }

        void FireAttack(Vector2 toP, float dist)
        {
            var pc = _player.GetComponent<PlayerController>();
            if (pc == null) return;

            // 攻撃の属性はその敵の系統が決める
            if (_arch.Range > 3f)
            {
                ProjectilePool.Instance?.Spawn(transform.position, toP.normalized * 7.5f,
                                               _atk, _level, AttackType);
            }
            else if (dist < _arch.Range + 0.6f)
            {
                pc.TakeDamage(_atk, _level, AttackType, this);
            }
        }

        /// <summary>パリイされたときによろめく。受け得にしないための見返り。</summary>
        public void Stagger(float seconds)
        {
            _telegraph = 0f;
            _attackCd = Mathf.Max(_attackCd, seconds);
            if (_rb != null) _rb.linearVelocity = Vector2.zero;
        }

        public void TakeDamage(int dmg, bool crit)
        {
            if (_dead) return;
            _hp -= dmg;
            CombatEvents.RaiseDamage(transform.position, dmg, crit);
            if (_hp <= 0f) Die();
        }

        /// <summary>属性つきの被弾。弱点／耐性は UI に渡してそのまま見せる。</summary>
        public void TakeTypedDamage(in DamageResult r)
        {
            if (_dead) return;
            _hp -= r.Total;
            CombatEvents.RaiseTypedDamage(transform.position, r);
            if (_hp <= 0f) Die();
        }

        void Die()
        {
            _dead = true;
            if (_rb != null) _rb.linearVelocity = Vector2.zero;
            RunManager.Instance.OnEnemyKilled(this, transform.position, _level, _isElite);
            gameObject.SetActive(false);   // プールへ返却
        }
    }
}
