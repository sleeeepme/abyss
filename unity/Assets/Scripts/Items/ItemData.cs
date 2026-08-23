using System;
using System.Collections.Generic;
using System.Text;
using AbyssRelic.Core;

namespace AbyssRelic.Items
{
    public enum Slot { Weapon, Shield, Armor, Accessory }
    public enum Rarity { Common = 0, Magic = 1, Rare = 2, Unique = 3, Relic = 4 }

    public enum StatKind
    {
        DmgPct, AspdPct, Hp, MsPct, Leech, CritPct,
        AllStat, Fire, Shock, Frost, MagicFind, Thorns, LowHpDr, Def,
        ResFire, ResShock, ResFrost
    }

    public enum ProjectileKind { None, Arrow, Bolt }

    /// <summary>
    /// ベース定義。武器は「攻撃力の数字違い」ではなく、射程・攻撃速度・扇形の広さ・
    /// 手数で性格を分ける。ここを揃えてしまうと武器種を用意する意味がなくなる。
    /// </summary>
    public readonly struct BaseDef
    {
        public readonly string Id, Name;
        public readonly Slot Slot;
        public readonly int AtkMin, AtkMax, DefMin, DefMax, Ilvl;
        public readonly float Spd;
        /// <summary>射程（マス）</summary>
        public readonly float Reach;
        /// <summary>攻撃扇形の半角（度）</summary>
        public readonly float ArcDeg;
        /// <summary>1 = 片手（盾と併用できる） / 2 = 両手</summary>
        public readonly int Hands;
        public readonly ProjectileKind Projectile;
        /// <summary>耐久の最大値。0 なら壊れない</summary>
        public readonly int Durability;
        /// <summary>盾: ガード軽減率(%) の範囲</summary>
        public readonly int BlockMin, BlockMax;
        /// <summary>盾: パリイの受付秒数</summary>
        public readonly float ParryWindow;
        /// <summary>武器の属性。武器種ごとに固定で、これが弱点突きの軸になる。</summary>
        public readonly DamageType DmgType;

        public BaseDef(string id, string name, Slot slot, int atkMin, int atkMax,
                       int defMin, int defMax, float spd, int ilvl,
                       float reach = 0f, float arcDeg = 0f, int hands = 1,
                       ProjectileKind projectile = ProjectileKind.None, int durability = 0,
                       int blockMin = 0, int blockMax = 0, float parryWindow = 0f,
                       DamageType dmgType = DamageType.Blunt)
        { Id = id; Name = name; Slot = slot; AtkMin = atkMin; AtkMax = atkMax;
          DefMin = defMin; DefMax = defMax; Spd = spd; Ilvl = ilvl;
          Reach = reach; ArcDeg = arcDeg; Hands = hands; Projectile = projectile;
          Durability = durability; BlockMin = blockMin; BlockMax = blockMax;
          ParryWindow = parryWindow; DmgType = dmgType; }
    }

    public readonly struct AffixDef
    {
        public readonly string Id, Name;
        public readonly bool IsPrefix;
        public readonly StatKind Stat;
        public readonly int Min, Max;
        public AffixDef(string id, string name, bool prefix, StatKind stat, int min, int max)
        { Id = id; Name = name; IsPrefix = prefix; Stat = stat; Min = min; Max = max; }
    }

    [Serializable]
    public class Affix
    {
        public string id;
        public string name;
        public bool prefix;
        public StatKind stat;
        public int value;
    }

    [Serializable]
    public class Item
    {
        public int uid;
        public string baseId;
        public string baseName;
        public Slot slot;
        public Rarity rarity;
        public int ilvl;
        public int atk;
        public int def;
        public float spd = 1f;
        public bool identified;
        /// <summary>盾のガード軽減率(%)。ilvl では伸ばさない（上限が壊れるため）</summary>
        public int block;
        public int durability, durabilityMax;
        public List<Affix> affixes = new List<Affix>();

        /// <summary>耐久 0 = 破損。捨てられはせず、性能を一切失う。拠点で修理できる。</summary>
        public bool IsBroken => durabilityMax > 0 && durability <= 0;

        public int RepairCost()
        {
            if (durabilityMax <= 0 || durability >= durabilityMax) return 0;
            return Math.Max(1, (int)Math.Ceiling(Value * (1f - (float)durability / durabilityMax) * 0.6f));
        }

        /// <summary>
        /// 未鑑定のあいだは種別しか出さない。武器の種類が分かると攻撃力レンジまで
        /// 推測できてしまうので、ベース名も伏せる。
        /// </summary>
        public string DisplayName()
        {
            if (!identified) return "未鑑定の" + ItemDb.SlotName(slot);
            var sb = new StringBuilder();
            var p = affixes.Find(a => a.prefix);
            var s = affixes.Find(a => !a.prefix);
            if (p != null) sb.Append(p.name);
            sb.Append(baseName);
            if (s != null) sb.Append("の").Append(s.name);
            if (IsBroken) sb.Append("（破損）");
            return sb.ToString();
        }

        public int Value => (int)(ItemDb.RarityValue[(int)rarity] * (1f + ilvl * 0.12f));

        /// <summary>一覧の 2 行目。未鑑定では ilvl も伏せる（強さのヒントになるため）。</summary>
        public string SubLine()
            => identified ? $"ilvl {ilvl} / {rarity}" : $"{rarity} / 未鑑定";

        /// <summary>未鑑定品は探索中に装備できない。中身が分からないものは着られない。</summary>
        public bool CanEquipInField => identified;
    }

    public static class ItemDb
    {
        public static readonly BaseDef[] Bases =
        {
            // --- 武器: reach / arcDeg / hands / projectile / durability ---
            new BaseDef("dagger", "短剣", Slot.Weapon,  4,  6, 0, 0, 1.45f, 1,
                        reach: 1.15f, arcDeg: 55f,  hands: 1, durability: 60,
                        dmgType: DamageType.Pierce),
            new BaseDef("sword",  "剣",   Slot.Weapon,  7, 10, 0, 0, 1.00f, 1,
                        reach: 1.45f, arcDeg: 75f,  hands: 1, durability: 80,
                        dmgType: DamageType.Slash),
            new BaseDef("axe",    "戦斧", Slot.Weapon, 10, 14, 0, 0, 0.78f, 6,
                        reach: 1.35f, arcDeg: 105f, hands: 1, durability: 70,
                        dmgType: DamageType.Blunt),
            new BaseDef("mace",   "戦槌", Slot.Weapon, 12, 16, 0, 0, 0.62f, 8,
                        reach: 1.30f, arcDeg: 95f,  hands: 1, durability: 105,
                        dmgType: DamageType.Blunt),
            new BaseDef("spear",  "槍",   Slot.Weapon,  8, 11, 0, 0, 0.88f, 5,
                        reach: 2.30f, arcDeg: 30f,  hands: 2, durability: 75,
                        dmgType: DamageType.Pierce),
            new BaseDef("great",  "大剣", Slot.Weapon, 13, 18, 0, 0, 0.58f, 4,
                        reach: 2.05f, arcDeg: 120f, hands: 2, durability: 95,
                        dmgType: DamageType.Slash),
            // 飛び道具にとっては射程そのものが安全＝火力なので、射程を詰めるのが
            // 一番素直な弱体化になる（弓 6.5→5.8 / 杖 4.5→4.2）。
            // 加えて Kiting の足補正がかかる（Combat.KiteMultiplier）。
            new BaseDef("bow",    "弓",   Slot.Weapon,  5,  7, 0, 0, 0.95f, 3,
                        reach: 5.8f,  arcDeg: 14f,  hands: 2,
                        projectile: ProjectileKind.Arrow, durability: 65,
                        dmgType: DamageType.Pierce),
            new BaseDef("staff",  "杖",   Slot.Weapon,  6,  8, 0, 0, 0.85f, 3,
                        reach: 4.2f,  arcDeg: 20f,  hands: 1,
                        projectile: ProjectileKind.Bolt, durability: 70,
                        dmgType: DamageType.Arcane),

            // --- 盾: 大きいほど軽減は高いが、パリイの受付は短い ---
            new BaseDef("buckler","小盾", Slot.Shield, 0, 0, 1, 2, 1f, 1,
                        durability: 80,  blockMin: 16, blockMax: 20, parryWindow: 0.28f),
            new BaseDef("round",  "円盾", Slot.Shield, 0, 0, 2, 4, 1f, 5,
                        durability: 110, blockMin: 27, blockMax: 33, parryWindow: 0.22f),
            new BaseDef("tower",  "大盾", Slot.Shield, 0, 0, 4, 7, 1f, 12,
                        durability: 150, blockMin: 41, blockMax: 49, parryWindow: 0.15f),

            // --- 防具 ---
            new BaseDef("leather","革鎧",         Slot.Armor, 0, 0, 3, 5,  1f, 1,  durability: 70),
            new BaseDef("chain",  "鎖帷子",       Slot.Armor, 0, 0, 6, 9,  1f, 5,  durability: 100),
            new BaseDef("plate",  "重装鎧",       Slot.Armor, 0, 0,10,14,  1f, 10, durability: 140),
            new BaseDef("robe",   "術士のローブ", Slot.Armor, 0, 0, 2, 4,  1f, 2,  durability: 55),

            // --- 装飾品: 戦闘では減らず、階層を降りるごとに擦り減る ---
            new BaseDef("ring",   "指輪", Slot.Accessory, 0, 0, 0, 0, 1f, 1, durability: 25),
            new BaseDef("amulet", "護符", Slot.Accessory, 0, 0, 0, 0, 1f, 3, durability: 25),
        };

        public static readonly AffixDef[] Prefixes =
        {
            new AffixDef("sharp","鋭利な", true, StatKind.DmgPct,   8, 15),
            new AffixDef("fury", "猛る",   true, StatKind.AspdPct,  5, 12),
            new AffixDef("stout","頑健な", true, StatKind.Hp,      10, 24),
            new AffixDef("swift","疾風の", true, StatKind.MsPct,    4,  9),
            new AffixDef("vamp", "貪る",   true, StatKind.Leech,    2,  5),
            new AffixDef("keen", "冴えた", true, StatKind.CritPct,  3,  8),
        };

        public static readonly AffixDef[] Suffixes =
        {
            new AffixDef("master","熟達", false, StatKind.AllStat,  1,  4),
            new AffixDef("flame", "業火", false, StatKind.Fire,     4, 11),
            new AffixDef("storm", "雷光", false, StatKind.Shock,    4, 11),
            new AffixDef("ice",   "氷結", false, StatKind.Frost,    4, 11),
            new AffixDef("seek",  "探求", false, StatKind.MagicFind,5, 15),
            new AffixDef("thorn", "反射", false, StatKind.Thorns,  10, 25),
            new AffixDef("endure","生還", false, StatKind.LowHpDr, 10, 20),
            new AffixDef("guard", "守護", false, StatKind.Def,      2,  6),
            new AffixDef("rFire", "耐火", false, StatKind.ResFire,  8, 20),
            new AffixDef("rShock","耐雷", false, StatKind.ResShock, 8, 20),
            new AffixDef("rFrost","耐氷", false, StatKind.ResFrost, 8, 20),
        };

        /// <summary>
        /// これ以下のレア度は鑑定済みで落ちる。Rare 以上だけが未鑑定。
        /// 全部未鑑定にすると探索中に付け替えられるのが白装備だけになり、
        /// インベントリ機能がほぼ死ぬ。
        /// </summary>
        public const Rarity IdentifiedUpTo = Rarity.Magic;

        public static string SlotName(Slot s) => s switch
        {
            Slot.Weapon => "武器",
            Slot.Shield => "盾",
            Slot.Armor => "防具",
            _ => "装飾品"
        };

        public static BaseDef Of(Item it) => Array.Find(Bases, b => b.Id == it.baseId);

        /// <summary>素手・盾なしのときの既定値</summary>
        public static readonly BaseDef Fist =
            new BaseDef("fist", "素手", Slot.Weapon, 2, 2, 0, 0, 1.05f, 1,
                        reach: 1.45f, arcDeg: 75f, hands: 1, dmgType: DamageType.Blunt);

        /// <summary>
        /// スロットごとの出現比。ベース種の数が増えても比率が崩れないよう、
        /// 先にスロットを抽選してからその中のベースを選ぶ。
        /// </summary>
        public static readonly (Slot slot, float weight)[] SlotWeights =
        {
            (Slot.Weapon, 28f), (Slot.Shield, 14f), (Slot.Armor, 34f), (Slot.Accessory, 24f)
        };

        // 設計書 3.1 のレアリティ表
        public static readonly float[] RarityWeight = { 60f, 28f, 10f, 1.8f, 0.2f };
        public static readonly int[]   RarityAffMin = { 0, 1, 3, 4, 5 };
        public static readonly int[]   RarityAffMax = { 0, 2, 4, 5, 6 };
        public static readonly float[] RarityValue  = { 6f, 26f, 90f, 320f, 1200f };

        public static string Describe(StatKind k, int v) => k switch
        {
            StatKind.DmgPct    => $"物理ダメージ +{v}%",
            StatKind.AspdPct   => $"攻撃速度 +{v}%",
            StatKind.Hp        => $"最大HP +{v}",
            StatKind.MsPct     => $"移動速度 +{v}%",
            StatKind.Leech     => $"HP吸収 {v}%",
            StatKind.CritPct   => $"クリティカル率 +{v}%",
            StatKind.AllStat   => $"全ステータス +{v}",
            StatKind.Fire      => $"追加 炎ダメージ {v}",
            StatKind.Shock     => $"追加 雷ダメージ {v}",
            StatKind.Frost     => $"追加 冷気ダメージ {v}",
            StatKind.ResFire   => $"炎耐性 +{v}%",
            StatKind.ResShock  => $"雷耐性 +{v}%",
            StatKind.ResFrost  => $"冷気耐性 +{v}%",
            StatKind.MagicFind => $"発見力 +{v}",
            StatKind.Thorns    => $"ダメージ反射 {v}%",
            StatKind.LowHpDr   => $"瀕死時 被ダメージ -{v}%",
            StatKind.Def       => $"防御 +{v}",
            _ => ""
        };
    }

    public static class ItemFactory
    {
        static int _uid;

        /// <summary>設計書 3.1: ilvl の平方根スケール。線形インフレを避ける。</summary>
        public static float ScaleOf(int ilvl) => 1f + (float)Math.Sqrt(Math.Max(0, ilvl - 1)) * 0.42f;

        public static Rarity RollRarity(GameRandom rng, int ilvl, float magicFind)
        {
            float boost = 1f + magicFind / 100f + ilvl * 0.004f;
            float total = 0f;
            Span<float> w = stackalloc float[5];
            for (int i = 0; i < 5; i++)
            {
                w[i] = i == 0 ? ItemDb.RarityWeight[i] : ItemDb.RarityWeight[i] * boost;
                total += w[i];
            }
            float x = rng.Next01() * total;
            for (int i = 0; i < 5; i++) { x -= w[i]; if (x <= 0f) return (Rarity)i; }
            return Rarity.Common;
        }

        /// <summary>
        /// 先にスロットを抽選し、その中からベースを選ぶ。
        /// ベース種を足しても出現比が崩れない。
        /// </summary>
        static BaseDef PickBase(GameRandom rng, int ilvl)
        {
            var avail = new List<BaseDef>();
            foreach (var b in ItemDb.Bases) if (b.Ilvl <= ilvl) avail.Add(b);
            if (avail.Count == 0) avail.Add(ItemDb.Bases[0]);

            float total = 0f;
            foreach (var (slot, w) in ItemDb.SlotWeights)
                if (avail.Exists(b => b.Slot == slot)) total += w;

            float x = rng.Next01() * total;
            Slot chosen = avail[0].Slot;
            foreach (var (slot, w) in ItemDb.SlotWeights)
            {
                if (!avail.Exists(b => b.Slot == slot)) continue;
                x -= w;
                if (x <= 0f) { chosen = slot; break; }
            }
            var pool = avail.FindAll(b => b.Slot == chosen);
            return rng.Pick(pool.Count > 0 ? pool : avail);
        }

        public static Item Create(GameRandom rng, int ilvl, float magicFind)
        {
            ilvl = Math.Max(1, ilvl);
            var bd = PickBase(rng, ilvl);

            var rar = RollRarity(rng, ilvl, magicFind);
            float s = ScaleOf(ilvl);

            var it = new Item
            {
                uid = ++_uid,
                baseId = bd.Id,
                baseName = bd.Name,
                slot = bd.Slot,
                rarity = rar,
                ilvl = ilvl,
                spd = bd.Spd,
                identified = rar <= ItemDb.IdentifiedUpTo
            };
            if (bd.AtkMax > 0) it.atk = (int)Math.Round(rng.Range(bd.AtkMin, bd.AtkMax) * s);
            if (bd.DefMax > 0) it.def = (int)Math.Round(rng.Range(bd.DefMin, bd.DefMax) * s);
            // 盾の軽減率は ilvl で伸ばさない（上限が壊れるので、盾種そのものの性能差にする）
            if (bd.BlockMax > 0) it.block = rng.Range(bd.BlockMin, bd.BlockMax);
            if (bd.Durability > 0)
            {
                it.durabilityMax = (int)Math.Round(bd.Durability * (1f + (s - 1f) * 0.25f));
                it.durability = it.durabilityMax;
            }

            int n  = rng.Range(ItemDb.RarityAffMin[(int)rar], ItemDb.RarityAffMax[(int)rar]);
            int pn = Math.Min(2, (n + 1) / 2);
            int sn = Math.Min(3, n - pn);

            AddAffixes(rng, it, ItemDb.Prefixes, pn, s);
            AddAffixes(rng, it, ItemDb.Suffixes, sn, s);
            return it;
        }

        /// <summary>
        /// ベースを指定して作る。ジョブごとに武器種が固定されている仲間の装備に使う。
        /// レア度は maxRarity で頭打ちにする。
        /// </summary>
        public static Item CreateOfBase(GameRandom rng, string baseId, int ilvl, Rarity maxRarity)
        {
            ilvl = Math.Max(1, ilvl);
            var bd = Array.Find(ItemDb.Bases, b => b.Id == baseId);
            var it = Create(rng, ilvl, 0f);

            var rar = RollRarity(rng, ilvl, 0f);
            if (rar > maxRarity) rar = maxRarity;

            float s = ScaleOf(ilvl);
            it.baseId = bd.Id; it.baseName = bd.Name; it.slot = bd.Slot;
            it.spd = bd.Spd; it.rarity = rar;
            it.atk = bd.AtkMax > 0 ? (int)Math.Round(rng.Range(bd.AtkMin, bd.AtkMax) * s) : 0;
            it.def = bd.DefMax > 0 ? (int)Math.Round(rng.Range(bd.DefMin, bd.DefMax) * s) : 0;
            it.block = bd.BlockMax > 0 ? rng.Range(bd.BlockMin, bd.BlockMax) : 0f;
            if (bd.Durability > 0)
            {
                it.durabilityMax = (int)Math.Round(bd.Durability * (1f + (s - 1f) * 0.25f));
                it.durability = it.durabilityMax;
            }
            else { it.durabilityMax = 0; it.durability = 0; }
            RefitAffixes(rng, it, ilvl);
            return it;
        }

        /// <summary>
        /// レア度を外から差し替えたあと、接辞の本数をそのレア度に合わせ直す。
        /// ガチャのように「ベースは普通に引き、レア度だけ別表で決める」場合に使う。
        /// </summary>
        public static void RefitAffixes(GameRandom rng, Item it, int ilvl)
        {
            int r = (int)it.rarity;
            int n  = rng.Range(ItemDb.RarityAffMin[r], ItemDb.RarityAffMax[r]);
            int pn = Math.Min(2, (n + 1) / 2);
            int sn = Math.Min(3, n - pn);
            it.affixes.Clear();
            float s = ScaleOf(Math.Max(1, ilvl));
            AddAffixes(rng, it, ItemDb.Prefixes, pn, s);
            AddAffixes(rng, it, ItemDb.Suffixes, sn, s);
        }

        static void AddAffixes(GameRandom rng, Item it, AffixDef[] src, int count, float scale)
        {
            if (count <= 0) return;
            var pool = new List<AffixDef>(src);
            for (int i = 0; i < count && pool.Count > 0; i++)
            {
                int k = (int)(rng.Next01() * pool.Count);
                var a = pool[k];
                pool.RemoveAt(k);
                it.affixes.Add(new Affix
                {
                    id = a.Id,
                    name = a.Name,
                    prefix = a.IsPrefix,
                    stat = a.Stat,
                    value = Math.Max(1, (int)Math.Round(rng.Range(a.Min, a.Max) * (1f + (scale - 1f) * 0.6f)))
                });
            }
        }
    }
}
