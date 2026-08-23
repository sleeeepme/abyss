using System;
using System.Collections.Generic;

namespace AbyssRelic.Core
{
    public enum UpgradeId { Hp, Atk, Aspd, Range, MoveSpeed, MagicFind, Crit, Stash }

    public readonly struct UpgradeDef
    {
        public readonly UpgradeId Id;
        public readonly string Name, StepText, Desc;
        public readonly int MaxLevel, BaseCost;
        public readonly float PerLevel;

        public UpgradeDef(UpgradeId id, string name, int max, int baseCost,
                          float perLevel, string step, string desc)
        { Id = id; Name = name; MaxLevel = max; BaseCost = baseCost;
          PerLevel = perLevel; StepText = step; Desc = desc; }
    }

    /// <summary>
    /// 拠点で買う永続強化。キャラがロストしても消えないアカウント資産で、
    /// 「死んでも前より強くなっている」を担保する唯一の仕組み。
    /// 装備の伸びを食わないよう、効果は最後に乗算で薄く掛ける。
    /// </summary>
    public static class MetaProgression
    {
        public static readonly UpgradeDef[] All =
        {
            new UpgradeDef(UpgradeId.Hp,        "生命力",   8, 40, 0.12f, "最大HP +12%",       "倒れにくくなる"),
            new UpgradeDef(UpgradeId.Atk,       "攻撃力",   8, 55, 0.09f, "物理ダメージ +9%",  "雑魚を早く溶かす"),
            new UpgradeDef(UpgradeId.Aspd,      "攻撃速度", 6, 70, 0.07f, "攻撃速度 +7%",      "手数が増える"),
            new UpgradeDef(UpgradeId.Range,     "攻撃範囲", 5, 90, 0.10f, "攻撃範囲 +10%",     "離れた敵にも当たる"),
            new UpgradeDef(UpgradeId.MoveSpeed, "移動速度", 5, 65, 0.05f, "移動速度 +5%",      "避けやすくなる"),
            new UpgradeDef(UpgradeId.MagicFind, "発見力",   6, 80, 12f,   "発見力 +12",        "良い装備が出やすい"),
            new UpgradeDef(UpgradeId.Crit,      "会心",     5, 75, 4f,    "クリティカル率 +4%","たまに大ダメージ"),
            new UpgradeDef(UpgradeId.Stash,     "倉庫拡張", 6, 50, 6f,    "倉庫スロット +6",   "持ち帰れる量が増える"),
        };

        public static UpgradeDef Def(UpgradeId id) => Array.Find(All, u => u.Id == id);

        public static int Cost(UpgradeDef u, int currentLevel)
            => (int)Math.Round(u.BaseCost * Math.Pow(currentLevel + 1, 1.55));

        public static int Level(PersistentState p, UpgradeId id)
            => p.upgradeLevels.TryGetValue(id, out var v) ? v : 0;

        public static bool TryBuy(PersistentState p, UpgradeId id)
        {
            var def = Def(id);
            int lv = Level(p, id);
            if (lv >= def.MaxLevel) return false;
            int cost = Cost(def, lv);
            if (p.gold < cost) return false;
            p.gold -= cost;
            p.upgradeLevels[id] = lv + 1;
            return true;
        }
    }

    /// <summary>店の品揃え。到達最深度に応じて質が上がる＝潜るほど買える物が良くなる。</summary>
    public static class Shop
    {
        public const float PriceMultiplier = 2.0f;
        public const int StockSize = 4;

        public static List<Items.Item> Roll(GameRandom rng, int deepestDepth)
        {
            var list = new List<Items.Item>();
            int b = Math.Max(1, Math.Min(deepestDepth, 60));
            float mf = 20f + deepestDepth * 0.5f;
            for (int i = 0; i < StockSize; i++)
            {
                var it = Items.ItemFactory.Create(rng, Math.Max(1, b + rng.Range(-2, 4)), mf);
                it.identified = true;    // 買う判断ができないと店の意味がない
                list.Add(it);
            }
            return list;
        }

        public static int PriceOf(Items.Item it) => (int)Math.Round(it.Value * PriceMultiplier);

        public static bool TryBuy(PersistentState p, Items.Item it)
        {
            int price = PriceOf(it);
            if (p.gold < price || p.StashFull) return false;
            p.gold -= price;
            p.stash.Add(it);
            p.shopStock.Remove(it);
            return true;
        }

        public static int RerollCost(int deepestDepth) => Math.Max(20, deepestDepth * 6);
    }
}
