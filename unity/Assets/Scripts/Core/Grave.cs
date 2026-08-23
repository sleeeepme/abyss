using System;
using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 死んだ場所に残る遺体。同じ階層まで戻れば一部を取り返せる。
    /// 遺体は常に 1 つだけで、回収する前に死ぬと前の遺体は消える。
    /// これで「取り返しに行く」という次の目的が毎回生まれ、
    /// ロストが「ただの罰」から「賭け」に変わる。
    /// </summary>
    [Serializable]
    public class Grave
    {
        public int depth;
        public float x, y;
        public int gold;
        public string heroName;
        public int heroLevel;
        public List<Item> items = new List<Item>();

        public bool HasAnything => items.Count > 0 || gold > 0;
    }

    /// <summary>
    /// 死亡処理の結果。UI はこれを見て表示を組み立てる。
    ///
    /// 重要: <see cref="LostItems"/> を死亡画面に出してはいけない。
    /// 何を失ったかは、遺体を開けて初めて分かる — 回収できなければ最後まで分からない。
    /// この一覧はログやデバッグのために持っているだけ。
    /// </summary>
    public class DeathReport
    {
        public string HeroName;
        public int HeroLevel;
        public int Depth;
        public Grave NewGrave;                       // null なら遺体すら残らなかった
        public Grave AbandonedGrave;                 // 回収されないまま消えた前の遺体
        public readonly List<string> LostItems = new List<string>();
    }

    public static class GraveRules
    {
        /// <summary>遺体に残る道具の数（装備していなかった物から抽選）</summary>
        public const int ItemsMin = 4;
        public const int ItemsMax = 6;
        /// <summary>持っていた金の何割が残るか</summary>
        public const float GoldRate = 0.5f;

        public static DeathReport BuildOnDeath(GameRandom rng, float posX, float posY)
        {
            var hero = GameState.Hero;
            var run = GameState.Run;
            var rep = new DeathReport
            {
                HeroName = hero.name,
                HeroLevel = hero.level,
                Depth = run.Depth,
                AbandonedGrave = GameState.Persist.grave
            };

            // 装備していた物は問答無用でロスト
            foreach (var it in hero.Equipped()) rep.LostItems.Add(it.DisplayName());

            // 装備していなかった道具から抽選
            var pool = new List<Item>(run.Loot);
            int take = Math.Min(pool.Count, rng.Range(ItemsMin, ItemsMax));
            var kept = new List<Item>(take);
            for (int i = 0; i < take; i++)
            {
                int k = (int)(rng.Next01() * pool.Count);
                kept.Add(pool[k]);
                pool.RemoveAt(k);
            }
            foreach (var it in pool) rep.LostItems.Add(it.DisplayName());

            // 回収されなかった前の遺体も、ここで失われる
            if (rep.AbandonedGrave != null)
                foreach (var it in rep.AbandonedGrave.items) rep.LostItems.Add(it.DisplayName());

            var g = new Grave
            {
                depth = run.Depth,
                x = posX, y = posY,
                gold = (int)(run.Gold * GoldRate),
                heroName = hero.name,
                heroLevel = hero.level,
                items = kept
            };
            rep.NewGrave = g.HasAnything ? g : null;
            GameState.Persist.grave = rep.NewGrave;
            return rep;
        }

        /// <summary>遺体に触れたときの回収。今のランの戦利品と所持金に加算する。</summary>
        public static bool Collect()
        {
            var g = GameState.Persist.grave;
            if (g == null || GameState.Run == null) return false;
            GameState.Run.Loot.AddRange(g.items);
            GameState.Run.Gold += g.gold;
            GameState.Persist.grave = null;
            return true;
        }
    }
}
