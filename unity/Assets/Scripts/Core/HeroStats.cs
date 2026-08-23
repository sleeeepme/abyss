using System;
using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    [Serializable]
    public class Hero
    {
        public string name = "冒険者";
        public int level = 1;
        public int xp;
        public int str = 5, dex = 5, vit = 5, intel = 5;
        public float hpNow;
        public Item weapon, shield, armor, accessory;
        /// <summary>ボス撃破で得た潜在。死ぬまで残り、拠点に戻っても消えない。</summary>
        public List<BoonPick> boons = new List<BoonPick>();
        /// <summary>
        /// 仲間（最大3名）。潜在と同じくプレイヤーキャラに属する。
        /// 拠点に戻っても解散せず、プレイヤーが死ねば一緒に失われる。
        /// 「長生きしたキャラが強い」を人数でも表すため。
        /// </summary>
        public List<Ally> party = new List<Ally>();

        public List<Ally> LivingParty()
        {
            var list = new List<Ally>();
            foreach (var a in party) if (!a.dead) list.Add(a);
            return list;
        }

        /// <summary>潜在の付与先の数。プレイヤー + 生存している仲間。</summary>
        public int BoonTargetCount => 1 + LivingParty().Count;

        public IEnumerable<Item> Equipped()
        {
            if (weapon != null) yield return weapon;
            if (shield != null) yield return shield;
            if (armor != null) yield return armor;
            if (accessory != null) yield return accessory;
        }

        public Item GetSlot(Slot s) => s switch
        {
            Slot.Weapon => weapon,
            Slot.Shield => shield,
            Slot.Armor => armor,
            _ => accessory
        };

        public void SetSlot(Slot s, Item it)
        {
            switch (s)
            {
                case Slot.Weapon: weapon = it; break;
                case Slot.Shield: shield = it; break;
                case Slot.Armor: armor = it; break;
                default: accessory = it; break;
            }
        }

    }

    public static class Progression
    {
        public static int XpNeed(int level) => (int)Math.Round(18 * Math.Pow(level, 1.55));
    }

    public struct DerivedStats
    {
        public int Str, Dex, Vit, Int;
        public int MaxHp;
        public float Atk, Aspd, Def, Crit, MoveSpeed, AttackRange;
        public float Leech, MagicFind, Thorns, LowHpDr, CharmDr;
        /// <summary>侵蝕の潜在: 状態異常の蓄積倍率(%)</summary>
        public float AilmentPct;
        /// <summary>治癒の潜在: 階層を降りるたびの回復量(%)</summary>
        public float FloorRegenPct;
        /// <summary>武器の扇形の半角（度）</summary>
        public float AttackArcDeg;
        /// <summary>1 = 片手（盾と併用可） / 2 = 両手（ガード中は攻撃できない）</summary>
        public int Hands;
        public ProjectileKind Projectile;
        public bool HasShield;
        /// <summary>ガード軽減率(%)</summary>
        public float Block;
        /// <summary>パリイの受付秒数</summary>
        public float ParryWindow;
        /// <summary>武器の属性</summary>
        public DamageType DmgType;
        /// <summary>装備で付いた追加属性ダメージ（武器の物理とは別枠、防御を受けない）</summary>
        public float ElemFire, ElemShock, ElemFrost;
        /// <summary>プレイヤーの属性耐性</summary>
        public Resistances Res;
    }

    public static class StatCalc
    {
        public const float BaseAttackRange = 1.45f;
        /// <summary>基礎移動速度（マス/秒）。旧 3.3 の 1.25 倍。</summary>
        public const float BaseMoveSpeed = 4.125f;

        public static DerivedStats Compute(Hero h) => Compute(h, GameState.Persist);

        public static DerivedStats Compute(Hero h, PersistentState meta)
        {
            var a = new Dictionary<StatKind, int>();
            var fist = ItemDb.Fist;
            float wAtk = fist.AtkMin, wSpd = fist.Spd, baseDef = 0f;
            float wReach = fist.Reach, wArc = fist.ArcDeg;
            int wHands = fist.Hands;
            var wProj = ProjectileKind.None;
            var wDt = fist.DmgType;
            bool hasShield = false; float block = 0f, parryWindow = 0f;

            // 破損した装備は「装備しているが何の性能も持たない」扱い。
            // 捨てずに修理させたいので、スロットからは外さない。
            foreach (var it in h.Equipped())
            {
                if (it.IsBroken) continue;
                var bd = ItemDb.Of(it);
                if (it.slot == Slot.Weapon)
                {
                    wAtk = it.atk; wSpd = it.spd;
                    wReach = bd.Reach > 0f ? bd.Reach : fist.Reach;
                    wArc = bd.ArcDeg > 0f ? bd.ArcDeg : fist.ArcDeg;
                    wHands = bd.Hands > 0 ? bd.Hands : 1;
                    wProj = bd.Projectile;
                    wDt = bd.DmgType;
                }
                if (it.slot == Slot.Shield)
                {
                    hasShield = true; block = it.block; parryWindow = bd.ParryWindow;
                }
                if (it.def > 0) baseDef += it.def;
                foreach (var f in it.affixes)
                    a[f.stat] = (a.TryGetValue(f.stat, out var v) ? v : 0) + f.value;
            }

            int G(StatKind k) => a.TryGetValue(k, out var v) ? v : 0;

            int all = G(StatKind.AllStat);
            int str = h.str + all, dex = h.dex + all, vit = h.vit + all, int_ = h.intel + all;

            // 永続強化は最後に乗算で薄く掛ける。装備で伸びる幅を食い潰さないため。
            int M(UpgradeId id) => meta == null ? 0 : MetaProgression.Level(meta, id);

            // 潜在（ボス撃破報酬）はそのキャラが死ぬまで乗る
            int B(BoonId id) => Boons.Sum(h, id);

            // 護符はその探索のあいだだけ乗る
            float C(System.Func<Charm, float> pick)
            {
                if (GameState.Run == null) return 0f;
                float s = 0f;
                foreach (var c in GameState.Run.Charms) s += pick(c);
                return s;
            }

            return new DerivedStats
            {
                Str = str, Dex = dex, Vit = vit, Int = int_,
                MaxHp = (int)Math.Round((40 + vit * 7f + h.level * 5f + G(StatKind.Hp))
                                        * (1f + M(UpgradeId.Hp) * 0.12f)
                                        * (1f + B(BoonId.Hp) / 100f)),
                Atk   = (wAtk + str * 1.1f) * (1f + G(StatKind.DmgPct) / 100f)
                                            * (1f + M(UpgradeId.Atk) * 0.09f)
                                            * (1f + B(BoonId.Atk) / 100f),
                Aspd  = wSpd * (1f + (dex * 0.9f + G(StatKind.AspdPct)) / 100f)
                             * (1f + M(UpgradeId.Aspd) * 0.07f)
                             * (1f + C(c => c.aspdPct) / 100f)
                             * (1f + B(BoonId.Aspd) / 100f),
                Def   = (baseDef + G(StatKind.Def) + vit * 0.6f) * (1f + B(BoonId.Defense) / 100f),
                Crit  = Math.Clamp(4f + dex * 0.5f + G(StatKind.CritPct) + M(UpgradeId.Crit) * 4f
                                     + B(BoonId.Crit), 0f, 75f),
                MoveSpeed = BaseMoveSpeed * (1f + G(StatKind.MsPct) / 100f)
                                          * (1f + M(UpgradeId.MoveSpeed) * 0.05f)
                                          * (1f + C(c => c.msPct) / 100f)
                                          * (1f + B(BoonId.MoveSpeed) / 100f),
                // 射程は武器の素の射程から。強化・護符・潜在はそこに乗る
                AttackRange = wReach * (1f + M(UpgradeId.Range) * 0.10f)
                                     * (1f + C(c => c.rangePct) / 100f)
                                     * (1f + B(BoonId.Range) / 100f),
                AttackArcDeg = wArc, Hands = wHands, Projectile = wProj,
                DmgType = wDt,
                ElemFire  = G(StatKind.Fire)  + B(BoonId.Fire),
                ElemShock = G(StatKind.Shock) + B(BoonId.Shock),
                ElemFrost = G(StatKind.Frost) + B(BoonId.Frost),
                Res = new Resistances()
                        .Set(DamageType.Fire,  G(StatKind.ResFire))
                        .Set(DamageType.Shock, G(StatKind.ResShock))
                        .Set(DamageType.Frost, G(StatKind.ResFrost)),
                HasShield = hasShield, Block = block, ParryWindow = parryWindow,
                Leech = G(StatKind.Leech) + B(BoonId.Leech),
                MagicFind = G(StatKind.MagicFind) + M(UpgradeId.MagicFind) * 12f
                            + C(c => c.magicFind) + B(BoonId.MagicFind),
                Thorns = G(StatKind.Thorns),
                LowHpDr = G(StatKind.LowHpDr),
                CharmDr = C(c => c.damageReductionPct) + B(BoonId.DamageReduction),
                AilmentPct = B(BoonId.Ailment),
                FloorRegenPct = B(BoonId.Regen)
            };
        }
    }

    /// <summary>設計書 4.2。DEF は減算ではなく逓減式（高レベル帯でダメージ 0 になるのを防ぐ）。</summary>
    public static class DamageFormula
    {
        public static int Compute(GameRandom rng, float atk, float skillMult,
                                  float def, int attackerLevel,
                                  float elementFlat = 0f, float resistPct = 0f)
        {
            float phys = atk * skillMult * (1f - def / (def + 50f + 10f * attackerLevel));
            float elem = elementFlat * (1f - Math.Clamp(resistPct, 0f, 75f) / 100f);
            return Math.Max(1, (int)((phys + elem) * rng.Range(0.92f, 1.08f)));
        }
    }
}
