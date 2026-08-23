using System;
using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    /// <summary>ラン中のみ有効な状態。死亡すると丸ごと破棄される。</summary>
    public class RunState
    {
        public int Depth = 1;
        public int Gold;
        public int Kills;
        public float Elapsed;
        public readonly List<Item> Loot = new List<Item>();
        /// <summary>ガチャで持ち込んだ護符。この探索のあいだだけ有効。</summary>
        public readonly List<Charm> Charms = new List<Charm>();
        public bool AutoHealUsed;
        /// <summary>プレイヤーの状態異常。ラン単位で持ち、拠点に戻ると消える。</summary>
        public readonly StatusHolder PlayerStatus = new StatusHolder();

        /// <summary>5階層ごとの帰還ポータル（セーフルーム）</summary>
        public bool IsSafeFloor => Depth % 5 == 0;
    }

    /// <summary>
    /// アカウント単位で永続する状態。キャラロストしても消えない。
    /// この「遺産」があるので再スタートがゼロからにならない（設計書 1.）。
    /// </summary>
    [Serializable]
    public class PersistentState
    {
        public int gold;
        public int deepestDepth = 1;
        /// <summary>
        /// 直近の探索の到達最深度。ガチャの排出帯を決める唯一の入力。
        /// 通算記録（deepestDepth）ではなくこちらを見る理由は <see cref="Gacha"/> を参照。
        /// </summary>
        public int lastRunDepth = 1;
        /// <summary>第50階層の主を倒した回数。</summary>
        public int cleared;
        public int deaths;
        public int runs;
        public int stashSlots = 20;
        public List<Item> stash = new List<Item>();
        public List<int> unlockedStartDepths = new List<int> { 1 };
        public int startDepth = 1;

        /// <summary>永続強化のレベル。ロストしても消えないアカウント資産。</summary>
        public Dictionary<UpgradeId, int> upgradeLevels = new Dictionary<UpgradeId, int>();

        /// <summary>店の在庫。帰還のたびに引き直す。</summary>
        public List<Item> shopStock = new List<Item>();

        /// <summary>死んだ場所に残る遺体。常に 1 つだけ。</summary>
        public Grave grave;

        /// <summary>ガチャの持ち込み枠。探索開始時にランへ渡され、死ぬと失う。</summary>
        public List<CarryItem> carry = new List<CarryItem>();
        public int gachaPullsLeft = Gacha.PullsPerRun;

        public int StashCapacity => stashSlots + MetaProgression.Level(this, UpgradeId.Stash) * 6;
        public bool StashFull => stash.Count >= StashCapacity;

        /// <summary>到達最深度に応じた浅層スキップ解放。再走の苦行化を防ぐ最重要要素。</summary>
        public void RefreshUnlocks()
        {
            unlockedStartDepths.Clear();
            unlockedStartDepths.Add(1);
            foreach (var d in new[] { 10, 20, 30, 40, 50 })
                if (deepestDepth >= d + 4) unlockedStartDepths.Add(d);
        }
    }

    public static class GameState
    {
        public static PersistentState Persist = new PersistentState();
        public static Hero Hero;
        public static RunState Run;

        public static Hero NewHero()
        {
            var h = new Hero { name = $"冒険者 #{Persist.deaths + 1}" };
            h.hpNow = StatCalc.Compute(h).MaxHp;
            return h;
        }

        /// <summary>
        /// 経験値。仲間がいる場合は頭数で分配する（設計書 5.5）。
        /// 仲間を入れるほど 1 人あたりは減るが、プールは人数ぶん膨らむので
        /// パーティ全体の総取得量は増える。
        /// </summary>
        public static void GrantXp(int xp)
        {
            var mates = Hero.LivingParty();
            float share = Party.XpShare(xp, mates.Count);
            Hero.xp += (int)share;
            while (Hero.xp >= Progression.XpNeed(Hero.level))
            {
                Hero.xp -= Progression.XpNeed(Hero.level);
                Hero.level++;
                // ロスト前提なので振り直し不可。3ポイントは UI で割り振る想定（暫定は自動）。
                Hero.str++; Hero.dex++; Hero.vit++;
                Hero.hpNow = StatCalc.Compute(Hero).MaxHp;
            }
            foreach (var a in mates)
            {
                a.xp += share;
                while (a.xp >= Progression.XpNeed(a.level))
                {
                    a.xp -= Progression.XpNeed(a.level);
                    a.level++;
                    a.str++; a.dex++; a.vit++;
                    a.hpNow = Party.Compute(a, Hero).MaxHp;
                }
            }
        }

        /// <summary>
        /// 死亡。キャラ本体と装備はロスト、倉庫と所持金は残る。
        /// 装備していなかった道具の一部と所持金の半分は、死んだ場所の遺体に残る。
        /// </summary>
        public static DeathReport KillHero(GameRandom rng, float posX, float posY)
        {
            if (Hero == null || Run == null) return null;
            var report = GraveRules.BuildOnDeath(rng, posX, posY);
            Persist.deaths++;
            Persist.carry.Clear();     // ガチャの持ち込み品も失う
            Hero = null;
            Run = null;
            return report;
        }

        /// <summary>生還。戦利品を鑑定して倉庫へ収める。</summary>
        public static List<Item> ReturnToTown(GameRandom rng = null)
        {
            if (Run == null) return new List<Item>();
            var gained = new List<Item>(Run.Loot);
            Persist.gold += Run.Gold;
            foreach (var it in gained)
            {
                it.identified = true;
                if (!Persist.StashFull) Persist.stash.Add(it);
                else Persist.gold += it.Value;   // 倉庫が満杯なら自動売却
            }
            Run = null;
            Persist.RefreshUnlocks();
            // 帰還のたびに店の品揃えを引き直す
            Persist.shopStock = Shop.Roll(rng ?? new GameRandom(GameRandom.Hash(Persist.runs, Persist.gold)),
                                          Persist.deepestDepth);
            return gained;
        }
    }
}
