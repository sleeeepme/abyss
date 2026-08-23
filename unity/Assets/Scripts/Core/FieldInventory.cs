using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 探索中の装備付け替え。UI（バッグ画面）はここを呼ぶだけにする。
    ///
    /// ルール:
    ///  - 未鑑定品は装備できない（中身が分からないものは着られない）
    ///  - 付け替えても現在HPは回復しない。最大HPが下がったときだけ切り詰める。
    ///    回復目的の付け替えループを防ぐため。
    /// </summary>
    public static class FieldInventory
    {
        public enum Result { Ok, NotFound, Unidentified, NoRun }

        public static Result Equip(Item it)
        {
            if (GameState.Run == null || GameState.Hero == null) return Result.NoRun;
            if (it == null || !GameState.Run.Loot.Contains(it)) return Result.NotFound;
            if (!it.CanEquipInField) return Result.Unidentified;

            var hero = GameState.Hero;
            var current = hero.GetSlot(it.slot);
            hero.SetSlot(it.slot, it);
            GameState.Run.Loot.Remove(it);
            if (current != null) GameState.Run.Loot.Add(current);

            ClampHp();
            return Result.Ok;
        }

        public static Result Unequip(Slot slot)
        {
            if (GameState.Run == null || GameState.Hero == null) return Result.NoRun;
            var hero = GameState.Hero;
            var current = hero.GetSlot(slot);
            if (current == null) return Result.NotFound;

            hero.SetSlot(slot, null);
            GameState.Run.Loot.Add(current);
            ClampHp();
            return Result.Ok;
        }

        /// <summary>装備候補が今の装備と比べてどう変わるか。UI の差分表示用。</summary>
        public static Dictionary<string, float> Compare(Item candidate)
        {
            var d = new Dictionary<string, float>();
            if (GameState.Hero == null || candidate == null || !candidate.identified) return d;

            var hero = GameState.Hero;
            var before = StatCalc.Compute(hero);
            var backup = hero.GetSlot(candidate.slot);
            hero.SetSlot(candidate.slot, candidate);
            var after = StatCalc.Compute(hero);
            hero.SetSlot(candidate.slot, backup);

            void Put(string k, float v) { if (System.Math.Abs(v) > 0.001f) d[k] = v; }
            Put("攻撃", (int)after.Atk - (int)before.Atk);
            Put("防御", (int)after.Def - (int)before.Def);
            Put("HP", after.MaxHp - before.MaxHp);
            Put("攻速", after.Aspd - before.Aspd);
            return d;
        }

        static void ClampHp()
        {
            var max = StatCalc.Compute(GameState.Hero).MaxHp;
            if (GameState.Hero.hpNow > max) GameState.Hero.hpNow = max;
        }
    }
}
