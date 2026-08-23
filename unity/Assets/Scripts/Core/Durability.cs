using System;
using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 装備の耐久。0 になると「破損」＝性能を完全に失うが、アイテム自体は消えない。
    /// 消してしまうと、掘り当てた Relic を耐久で失うことになり理不尽なので、
    /// 拠点で修理させる形にしている（金の使い道としても機能する）。
    /// </summary>
    public static class Durability
    {
        /// <summary>攻撃 1 回につきこの確率で武器が -1</summary>
        public const float WeaponWearChance = 0.25f;
        public const int ArmorPerHit = 1;
        /// <summary>ガードで受けるごとに -1。パリイ成功では減らない。</summary>
        public const int ShieldPerBlock = 1;
        /// <summary>装飾品は戦闘では減らず、階層を降りるごとに -1</summary>
        public const int AccessoryPerFloor = 1;

        public static event Action<Item> OnBroken;
        public static event Action<Item> OnWorn;      // 残り20%を切った瞬間

        public static void Wear(Hero hero, Slot slot, int amount)
        {
            if (hero != null) WearItem(hero.GetSlot(slot), amount);
        }

        /// <summary>仲間（Ally）の装備も同じ規則で擦り減る。</summary>
        public static void Wear(Ally ally, Slot slot, int amount)
        {
            if (ally != null) WearItem(ally.GetSlot(slot), amount);
        }

        public static void WearItem(Item it, int amount)
        {
            if (amount <= 0) return;
            if (it == null || it.durabilityMax <= 0 || it.durability <= 0) return;

            int warnAt = (int)Math.Ceiling(it.durabilityMax * 0.2f);
            bool wasAbove = it.durability > warnAt;

            it.durability -= amount;
            if (it.durability <= 0)
            {
                it.durability = 0;
                OnBroken?.Invoke(it);
            }
            else if (wasAbove && it.durability <= warnAt)
            {
                OnWorn?.Invoke(it);
            }
        }

        public static void WearWeaponOnAttack(GameRandom rng, Hero hero)
        {
            if (rng.Chance(WeaponWearChance)) Wear(hero, Slot.Weapon, 1);
        }

        // ---- 修理（拠点の道具屋） ----

        public static List<Item> Repairables(PersistentState p, Hero hero)
        {
            var list = new List<Item>();
            if (hero != null)
                foreach (var it in hero.Equipped()) if (it.RepairCost() > 0) list.Add(it);
            foreach (var it in p.stash) if (it.RepairCost() > 0) list.Add(it);
            return list;
        }

        public static int RepairAllCost(PersistentState p, Hero hero)
        {
            int t = 0;
            foreach (var it in Repairables(p, hero)) t += it.RepairCost();
            return t;
        }

        public static bool TryRepair(PersistentState p, Item it)
        {
            int cost = it.RepairCost();
            if (cost <= 0 || p.gold < cost) return false;
            p.gold -= cost;
            it.durability = it.durabilityMax;
            return true;
        }

        public static bool TryRepairAll(PersistentState p, Hero hero)
        {
            int total = RepairAllCost(p, hero);
            if (total <= 0 || p.gold < total) return false;
            p.gold -= total;
            foreach (var it in Repairables(p, hero)) it.durability = it.durabilityMax;
            return true;
        }
    }
}
