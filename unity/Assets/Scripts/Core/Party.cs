using System;
using System.Collections.Generic;
using AbyssRelic.Items;

namespace AbyssRelic.Core
{
    public enum JobId { Warrior, Knight, Hunter, Mage, Rogue, Priest }

    /// <summary>
    /// 仲間の固有スキル。
    ///
    /// 全部「自動発動か常時効果」に限定してある。このゲームには攻撃ボタンも
    /// 回避ボタンも無く、操作は移動だけで完結している。仲間にスキルボタンを
    /// 1 つ足した瞬間にその設計が崩れるので、押して撃つスキルは作らない。
    /// </summary>
    public enum AllySkill
    {
        /// <summary>庇う: そばにいる間、プレイヤーの被ダメージの一部を肩代わりする</summary>
        Cover,
        /// <summary>打ち払い: 攻撃が一定確率でよろめきを与える</summary>
        Crush,
        /// <summary>狙撃: 3発に1回は必ず会心</summary>
        Snipe,
        /// <summary>連鎖: 魔弾が命中すると近くの敵へ1度だけ跳ねる</summary>
        Chain,
        /// <summary>物色: 発見力上昇＋撃破時にまれに追加ドロップ</summary>
        Scavenge,
        /// <summary>祈り: 一定間隔でパーティ全員を回復</summary>
        Prayer
    }

    /// <summary>
    /// ジョブ定義。
    ///
    /// <b>武器種はジョブごとに固定</b>。これが設計上いちばん大事な一行で、
    /// 「戦士は剣、狩人は弓」と決まっているから、加入前に名前だけで何ができるか分かる。
    /// 装備を自由に選べる仲間はプレイヤーの下位互換にしかならず、役割を持てない。
    ///
    /// キャラ名はジョブ名そのもの（戦士 / 魔法使い …）。固有名を与えないのは、
    /// 仲間が消耗品だという設計の宣言でもある。同じジョブが重なったときだけ番号を振る。
    /// </summary>
    public readonly struct JobDef
    {
        public readonly JobId Id;
        public readonly string Name;
        public readonly string ColorHex;
        public readonly string WeaponBase, ArmorBase, ShieldBase;   // ShieldBase == null なら盾なし
        public readonly float HpMul, AtkMul, MoveMul, Aggro;
        public readonly AllySkill Skill;
        public readonly string SkillName, SkillDesc;

        public JobDef(JobId id, string name, string col, string weapon, string armor, string shield,
                      float hp, float atk, float ms, float aggro,
                      AllySkill skill, string skName, string skDesc)
        {
            Id = id; Name = name; ColorHex = col;
            WeaponBase = weapon; ArmorBase = armor; ShieldBase = shield;
            HpMul = hp; AtkMul = atk; MoveMul = ms; Aggro = aggro;
            Skill = skill; SkillName = skName; SkillDesc = skDesc;
        }

        public static readonly JobDef[] All =
        {
            new JobDef(JobId.Warrior, "戦士",     "#d0a25a", "sword",  "chain",   "round",
                       1.18f, 1.00f, 0.96f, 7.5f, AllySkill.Cover,
                       "庇う",     "そばにいる間、あなたの被ダメージの25%を肩代わりする"),
            new JobDef(JobId.Knight,  "重騎士",   "#8e9bb0", "great",  "plate",   null,
                       1.30f, 1.15f, 0.86f, 7.0f, AllySkill.Crush,
                       "打ち払い", "攻撃の30%でよろめきを与える"),
            new JobDef(JobId.Hunter,  "狩人",     "#7fc08a", "bow",    "leather", null,
                       0.88f, 1.05f, 1.08f, 9.0f, AllySkill.Snipe,
                       "狙撃",     "3発に1回、必ず会心になる"),
            new JobDef(JobId.Mage,    "魔法使い", "#a97fe0", "staff",  "robe",    null,
                       0.78f, 1.22f, 0.94f, 8.5f, AllySkill.Chain,
                       "連鎖",     "魔弾が命中すると近くの敵へ1度だけ跳ねる"),
            new JobDef(JobId.Rogue,   "盗賊",     "#d6b34a", "dagger", "leather", null,
                       0.84f, 0.92f, 1.14f, 8.0f, AllySkill.Scavenge,
                       "物色",     "発見力 +40。撃破時にまれに追加のドロップが出る"),
            new JobDef(JobId.Priest,  "僧侶",     "#7fe0c0", "mace",   "robe",    null,
                       0.96f, 0.86f, 0.98f, 7.0f, AllySkill.Prayer,
                       "祈り",     "6秒ごとにパーティ全員のHPを少し回復する"),
        };

        public static JobDef Of(JobId id) => Array.Find(All, j => j.Id == id);
    }

    /// <summary>
    /// 仲間。Hero と同じ形をしているので、装備・潜在・耐久・状態異常の計算器を
    /// そのまま共有できる（＝潜在を仲間に付与すると本当に効く）。
    /// </summary>
    [Serializable]
    public class Ally
    {
        public JobId job;
        public string name;
        public int level = 1;
        public float xp;
        public int str = 5, dex = 5, vit = 5, intel = 5;
        public float hpNow;
        public Item weapon, shield, armor, accessory;
        public List<BoonPick> boons = new List<BoonPick>();
        /// <summary>広告での蘇生は 1 人につき 1 回だけ。</summary>
        public bool revived;
        public bool dead;
        /// <summary>祈りのクールダウン（僧侶のみ使用）</summary>
        public float prayCooldown = Party.PrayerInterval;
        /// <summary>狙撃の判定用。撃った回数。</summary>
        public int shots;

        public JobDef Job => JobDef.Of(job);

        /// <summary>Hero と同じ形にして StatCalc へ渡すためのアダプタ。</summary>
        public Hero AsHero()
        {
            var h = new Hero
            {
                name = name, level = level, xp = (int)xp,
                str = str, dex = dex, vit = vit, intel = intel,
                hpNow = hpNow, weapon = weapon, shield = shield,
                armor = armor, accessory = accessory, boons = boons
            };
            return h;
        }

        public Item GetSlot(Slot s) => s switch
        {
            Slot.Weapon => weapon,
            Slot.Shield => shield,
            Slot.Armor  => armor,
            _           => accessory
        };

        public void SetSlot(Slot s, Item it)
        {
            switch (s)
            {
                case Slot.Weapon: weapon = it; break;
                case Slot.Shield: shield = it; break;
                case Slot.Armor:  armor  = it; break;
                default:          accessory = it; break;
            }
        }
    }

    public static class Party
    {
        public const int Max = 3;

        /// <summary>プレイヤー基準の弱体係数。仲間は頭数と役割であって主役ではない。</summary>
        public const float AllyAtkMul = 0.62f;
        public const float AllyHpMul  = 0.70f;
        public const int   LevelGapMin = 1, LevelGapMax = 3;
        /// <summary>仲間の装備は Magic 止まり。Rare 以上は落ちない。</summary>
        public const Rarity AllyRarityMax = Rarity.Magic;
        /// <summary>1 階層に仲間候補が現れる確率。</summary>
        public const float NpcChance = 0.42f;
        /// <summary>庇うの肩代わり率／有効距離</summary>
        public const float CoverShare = 0.25f, CoverRange = 3.0f;
        public const float CrushChance = 0.30f;
        public const int   SnipeEvery = 3;
        public const float ScavengeDropChance = 0.18f;
        public const float PrayerInterval = 6f;
        /// <summary>これ以上離れたら敵を捨ててプレイヤーに戻る。</summary>
        public const float FollowDistance = 3.2f;

        /// <summary>
        /// 経験値の分配。仲間が増えるほど 1 人あたりの取り分は減る（これが代償）。
        /// ただし完全な 1/N にすると仲間を入れるほど損になって誰も入れなくなるので、
        /// 人数に応じてプールそのものを膨らませ、
        /// 「1人あたりは減るが、パーティ全体では増える」に着地させている。
        /// </summary>
        public const float XpPartyBonus = 0.15f;

        public static float XpShare(float total, int allyCount)
            => total * (1f + XpPartyBonus * allyCount) / (1 + allyCount);

        /// <summary>
        /// 仲間の上限。プレイヤーのステータスに対する割合。
        /// knee を超えたぶんは圧縮されて ceil に漸近するので、
        ///  ・どんな装備を引いてもプレイヤーを超えない（ceil &lt; 1）
        ///  ・それでも潜在や装備は必ず数字を押し上げる（単調増加）
        /// を両立できる。単純なクリップだと後者が壊れ、
        /// 仲間に潜在を与える意味そのものが消えてしまう。
        /// </summary>
        public const float CapKnee = 0.85f, CapCeil = 0.97f;

        public static float SoftCap(float v, float reference)
        {
            float knee = reference * CapKnee, ceil = reference * CapCeil;
            if (v <= knee) return v;
            return ceil - (ceil - knee) * knee / (knee + (v - knee));
        }

        /// <summary>仲間のステータス。プレイヤーと同じ StatCalc を通してから係数と上限を掛ける。</summary>
        public static DerivedStats Compute(Ally a, Hero player)
        {
            var j = a.Job;
            var s = StatCalc.Compute(a.AsHero());
            s.MaxHp = Math.Max(1, (int)Math.Round(s.MaxHp * j.HpMul * AllyHpMul));
            s.Atk  *= j.AtkMul * AllyAtkMul;
            s.MoveSpeed *= j.MoveMul;
            if (j.Skill == AllySkill.Scavenge) s.MagicFind += 40f;

            if (player != null)
            {
                var ps = StatCalc.Compute(player);
                s.MaxHp = Math.Max(1, (int)Math.Round(SoftCap(s.MaxHp, ps.MaxHp)));
                s.Atk   = SoftCap(s.Atk, ps.Atk);
            }
            return s;
        }

        /// <summary>プレイヤーを基準に一段弱い仲間を作る。武器種はジョブで固定。</summary>
        public static Ally Create(GameRandom rng, int depth, Hero player)
        {
            var j = JobDef.All[(int)(rng.Next01() * JobDef.All.Length)];
            int lv = Math.Clamp(player.level - rng.Range(LevelGapMin, LevelGapMax),
                                1, Math.Max(1, player.level));
            int ilvl = Math.Clamp((int)Math.Round(depth * 0.8f), 1, 60);

            var a = new Ally
            {
                job = j.Id, name = j.Name, level = lv,
                str = 5 + (lv - 1), dex = 5 + (lv - 1), vit = 5 + (lv - 1), intel = 5
            };
            a.weapon = MakeFixed(rng, j.WeaponBase, ilvl);
            a.armor  = MakeFixed(rng, j.ArmorBase,  ilvl);
            if (j.ShieldBase != null) a.shield = MakeFixed(rng, j.ShieldBase, ilvl);
            a.hpNow = Compute(a, player).MaxHp;
            return a;
        }

        static Item MakeFixed(GameRandom rng, string baseId, int ilvl)
        {
            var it = ItemFactory.CreateOfBase(rng, baseId, ilvl, AllyRarityMax);
            it.identified = true;   // 加入判断の材料なので最初から見えている
            return it;
        }

        /// <summary>同じジョブが重なったときだけ番号を振る。名前はジョブそのもの、が原則。</summary>
        public static void EnsureUniqueName(Ally a, IReadOnlyList<Ally> existing)
        {
            int same = 0;
            foreach (var x in existing) if (x.job == a.job) same++;
            if (same == 0) return;
            string[] suffix = { "", " II", " III", " IV" };
            a.name = a.Job.Name + suffix[Math.Min(same, 3)];
        }

        /// <summary>
        /// 広告での蘇生。Lv.1 に戻り、装備をランダムに 1〜2 枠失う。1 人につき 1 回だけ。
        /// 潜在は残す — 全部消すと蘇生させる理由が無くなるため。
        ///
        /// 実装メモ: このメソッドは<b>広告の視聴完了コールバックの中からのみ</b>呼ぶこと。
        /// </summary>
        public static List<string> Revive(GameRandom rng, Ally a, Hero player)
        {
            if (a.revived) return null;
            a.revived = true; a.dead = false;
            a.level = 1; a.xp = 0;
            a.str = a.dex = a.vit = a.intel = 5;

            var slots = new List<Slot>();
            foreach (Slot s in Enum.GetValues(typeof(Slot)))
                if (a.GetSlot(s) != null) slots.Add(s);

            int lose = Math.Min(slots.Count, rng.Range(1, 2));
            var lost = new List<string>();
            for (int i = 0; i < lose; i++)
            {
                int k = (int)(rng.Next01() * slots.Count);
                var s = slots[k]; slots.RemoveAt(k);
                lost.Add(a.GetSlot(s).baseName);
                a.SetSlot(s, null);
            }
            a.hpNow = Compute(a, player).MaxHp;
            return lost;
        }
    }

    /// <summary>
    /// ユニーク敵 — 道中に紛れる固有名の一体。
    /// 撃破で潜在が確定で手に入る唯一の非ボス。
    /// ボスと違って階段を塞がないので「無視して降りる」も常に選べる。
    ///
    /// 名前はすべて造語。既存作品からの引用は一切していない（設計書 0.）。
    /// </summary>
    public static class UniqueEnemy
    {
        public static readonly string[] Names =
        {
            "錆喰い", "灯守り", "影拾い", "千裂き", "石の見張り", "骨拾い",
            "霜吐き", "燼の使い", "裂け目の番", "無音の顎", "灰かぶり", "終い呼び"
        };

        public const int MinDepth = 3;
        public const float HpMul = 4.2f, AtkMul = 1.5f, DefMul = 1.5f, Radius = 0.44f;
        public const int GuaranteedDrops = 2;

        public static float ChanceAt(int depth) => Math.Clamp(0.22f + depth * 0.006f, 0.22f, 0.42f);

        public static string RollName(GameRandom rng) => Names[(int)(rng.Next01() * Names.Length)];
    }
}
