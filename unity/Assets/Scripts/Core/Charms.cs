using System;
using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 護符 = ガチャの「スキル」枠。
    ///
    /// このゲームには攻撃ボタンも回避ボタンも無いので、押して撃つアクティブスキルは
    /// 設計と噛み合わない（ボタンを 1 つ足した時点で「操作は移動だけ」が崩れる）。
    /// そのため常時効果か自動発動のどちらかに限定している。
    /// </summary>
    [Serializable]
    public class Charm
    {
        public string id;
        public string name;
        public string description;
        public float aspdPct, msPct, rangePct, magicFind, damageReductionPct;
        public bool autoHeal;      // HPが30%を切ると1度だけ全回復

        public static readonly Charm[] All =
        {
            new Charm{id="heal",  name="治癒の護符", description="HPが30%を切ると1度だけ全回復", autoHeal=true},
            new Charm{id="guard", name="加護の護符", description="被ダメージ -20%",   damageReductionPct=20f},
            new Charm{id="swift", name="疾風の護符", description="移動速度 +20%",     msPct=20f},
            new Charm{id="fury",  name="猛りの護符", description="攻撃速度 +25%",     aspdPct=25f},
            new Charm{id="reach", name="貫きの護符", description="攻撃範囲 +30%",     rangePct=30f},
            new Charm{id="luck",  name="幸運の護符", description="発見力 +50",        magicFind=50f},
        };
    }

    /// <summary>ガチャで出た持ち込み品。武器か護符のどちらか。</summary>
    [Serializable]
    public class CarryItem
    {
        public Charm charm;    // どちらか一方だけが入る
        public Item item;
        public bool IsCharm => charm != null;
        public string DisplayName => IsCharm ? charm.name : item.DisplayName();
    }

    /// <summary>
    /// リワード広告ガチャ。1回の探索につき既定 2 回まで。
    ///
    /// 実装メモ: <see cref="Roll"/> は広告の視聴が完了してから呼ぶこと。
    /// Unity なら Unity Ads の <c>ShowAd</c> 完了コールバック、AdMob なら
    /// <c>OnUserEarnedReward</c> の中から呼ぶ。視聴前に呼べる導線を作らない。
    /// </summary>
    /// <summary>
    /// ガチャの排出帯。「直近の探索でどこまで潜れたか」だけで決まる。
    ///
    /// 通算の最深記録（<c>deepestDepth</c>）ではなく直近（<c>lastRunDepth</c>）を見るのが肝。
    /// 昔一度だけ深く潜った記録が永久に効くと上振れが固定化して、引くたびに強武器が出る。
    /// 直近を見れば「深く潜って死んだ次は楽になる／浅く死んだ次は浅いまま」になり、
    /// 再挑戦のハードルだけが下がる。
    /// </summary>
    public readonly struct GachaBand
    {
        public readonly int MinDepth;
        public readonly string Name;
        public readonly float CharmChance;
        /// <summary>Rarity の並びと同じ [Common, Magic, Rare, Unique, Relic] の重み。</summary>
        public readonly float[] Weights;

        public GachaBand(int min, string name, float charm, float[] w)
        { MinDepth = min; Name = name; CharmChance = charm; Weights = w; }

        public float RareOrBetterPct
        {
            get
            {
                float tot = 0f, hi = 0f;
                for (int i = 0; i < Weights.Length; i++) { tot += Weights[i]; if (i >= 2) hi += Weights[i]; }
                return tot <= 0f ? 0f : hi / tot * 100f;
            }
        }

        public static readonly GachaBand[] All =
        {
            new GachaBand(1,  "浅層", 0.55f, new[]{52f, 36f, 11f,  0.9f, 0.1f}),
            new GachaBand(5,  "中層", 0.50f, new[]{34f, 42f, 22f,  1.8f, 0.2f}),
            new GachaBand(10, "深層", 0.46f, new[]{18f, 42f, 35f,  4.2f, 0.8f}),
            new GachaBand(20, "古層", 0.42f, new[]{ 7f, 33f, 47f, 10.5f, 2.5f}),
            new GachaBand(30, "最深", 0.38f, new[]{ 0f, 21f, 55f, 18f,   6f}),
        };

        public static GachaBand Of(int lastRunDepth)
        {
            var b = All[0];
            foreach (var g in All) if (lastRunDepth >= g.MinDepth) b = g;
            return b;
        }

        /// <summary>次に上がる帯。最高帯なら null。UI で「あと何階層で良くなるか」を出すため。</summary>
        public static GachaBand? Next(int lastRunDepth)
        {
            foreach (var g in All) if (g.MinDepth > lastRunDepth) return g;
            return null;
        }
    }

    public static class Gacha
    {
        public const int PullsPerRun = 2;

        public static bool CanPull(PersistentState p) => p.gachaPullsLeft > 0;

        public static CarryItem Roll(GameRandom rng, PersistentState p)
        {
            if (!CanPull(p)) return null;
            p.gachaPullsLeft--;

            var band = GachaBand.Of(Math.Max(1, p.lastRunDepth));

            // 浅い帯ほど護符寄り。武器を配るより探索補助のほうが腐らない。
            if (rng.Next01() < band.CharmChance)
                return new CarryItem { charm = Charm.All[(int)(rng.Next01() * Charm.All.Length)] };

            // 武器のレア度は帯の重みだけで決まる。
            // 旧実装は Rare 以上を引くまで回し直していたので、初回から強武器が出ていた。
            var target = RollRarity(rng, band);
            int ilvl = Math.Max(4, Math.Min(60, Math.Max(1, p.lastRunDepth) + 4));
            Item it = null;
            for (int i = 0; i < 200; i++)
            {
                var g = ItemFactory.Create(rng, ilvl, 60f);
                if (g.slot == Slot.Weapon) { it = g; break; }   // 武器種であることだけは保証
            }
            if (it == null) it = ItemFactory.Create(rng, ilvl, 60f);

            it.rarity = target;
            ItemFactory.RefitAffixes(rng, it, ilvl);   // 接辞の本数をレア度に合わせ直す
            it.identified = true;                       // ガチャ産は中身が見えないと引く意味がない
            return new CarryItem { item = it };
        }

        static Rarity RollRarity(GameRandom rng, GachaBand band)
        {
            float tot = 0f;
            foreach (var w in band.Weights) tot += w;
            float x = rng.Next01() * tot;
            for (int i = 0; i < band.Weights.Length; i++)
            {
                x -= band.Weights[i];
                if (x <= 0f) return (Rarity)i;
            }
            return Rarity.Common;
        }

        /// <summary>探索開始時に持ち込み枠をランへ移す。武器は持ち物、護符は常時効果。</summary>
        public static void HandOverToRun(PersistentState p, RunState run)
        {
            foreach (var c in p.carry)
            {
                if (c.IsCharm) run.Charms.Add(c.charm);
                else run.Loot.Add(c.item);
            }
            p.carry.Clear();
            p.gachaPullsLeft = PullsPerRun;   // 探索ごとに引ける回数が戻る
        }
    }
}
