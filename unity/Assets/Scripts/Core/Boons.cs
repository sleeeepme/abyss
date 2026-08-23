using System;
using System.Collections.Generic;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 潜在の格。ユニーク敵の報酬は Mid と同格（＝中ボス相当）。
    /// Final は第50階層の主だけの別格。
    /// </summary>
    public enum BoonTier { Mid = 0, Great = 1, Final = 2 }

    public enum BoonId
    {
        Hp, Atk, Aspd, MoveSpeed, Crit, Range, Leech, DamageReduction,
        Defense, MagicFind, Fire, Shock, Frost, Ailment, Regen
    }

    public readonly struct BoonDef
    {
        public readonly BoonId Id;
        public readonly string Name, Format;
        readonly int _mid, _great, _final;

        public BoonDef(BoonId id, string name, int mid, int great, int final, string fmt)
        { Id = id; Name = name; _mid = mid; _great = great; _final = final; Format = fmt; }

        public int Value(BoonTier t) => t switch
        {
            BoonTier.Final => _final,
            BoonTier.Great => _great,
            _              => _mid
        };
        public string Describe(BoonTier t) => Format.Replace("%v", Value(t).ToString());
        public string Describe(int total) => Format.Replace("%v", total.ToString());
    }

    [Serializable]
    public struct BoonPick
    {
        public BoonId Id;
        public BoonTier Tier;
        public BoonPick(BoonId id, BoonTier t) { Id = id; Tier = t; }
    }

    /// <summary>
    /// 潜在 — 5階層ごとのボス撃破で 3 択から 1 つ選ぶ強化。
    ///
    /// 効果は「そのキャラが死ぬまで」続く。拠点に戻っても消えないので、
    /// 長生きしたキャラが確かに強くなる、を数字で成立させる部分。
    /// 永続強化（アカウント資産）とは別軸で、こちらは死ねば全部失われる。
    /// 同じ潜在を選び直すと重ねがけになる。
    /// </summary>
    public static class Boons
    {
        public const int ChoiceCount = 3;

        public static readonly BoonDef[] All =
        {
            new BoonDef(BoonId.Hp,              "生命の潜在",   12, 25, 42, "最大HP +%v%"),
            new BoonDef(BoonId.Atk,             "剛力の潜在",   10, 20, 34, "攻撃力 +%v%"),
            new BoonDef(BoonId.Aspd,            "迅速の潜在",    8, 16, 26, "攻撃速度 +%v%"),
            new BoonDef(BoonId.MoveSpeed,       "韋駄天の潜在",  8, 15, 24, "移動速度 +%v%"),
            new BoonDef(BoonId.Crit,            "鋭利の潜在",    6, 12, 20, "クリティカル率 +%v%"),
            new BoonDef(BoonId.Range,           "遠見の潜在",   10, 20, 32, "攻撃範囲 +%v%"),
            new BoonDef(BoonId.Leech,           "吸血の潜在",    3,  6, 10, "HP吸収 +%v%"),
            new BoonDef(BoonId.DamageReduction, "不屈の潜在",    6, 12, 20, "被ダメージ -%v%"),
            new BoonDef(BoonId.Defense,         "剛体の潜在",   15, 30, 50, "防御 +%v%"),
            new BoonDef(BoonId.MagicFind,       "探求の潜在",   20, 40, 70, "発見力 +%v"),
            new BoonDef(BoonId.Fire,            "業火の潜在",    8, 18, 32, "追加 炎ダメージ +%v"),
            new BoonDef(BoonId.Shock,           "雷光の潜在",    8, 18, 32, "追加 雷ダメージ +%v"),
            new BoonDef(BoonId.Frost,           "氷結の潜在",    8, 18, 32, "追加 冷気ダメージ +%v"),
            new BoonDef(BoonId.Ailment,         "侵蝕の潜在",   25, 50, 85, "状態異常の蓄積 +%v%"),
            new BoonDef(BoonId.Regen,           "治癒の潜在",   20, 35, 55, "階層を降りるとHP %v% 回復"),
        };

        public static BoonDef Def(BoonId id) => Array.Find(All, b => b.Id == id);

        /// <summary>所持している潜在の合計値。同じ潜在は重ねがけ。</summary>
        public static int Sum(Hero h, BoonId id)
        {
            if (h?.boons == null) return 0;
            int t = 0;
            foreach (var b in h.boons) if (b.Id == id) t += Def(b.Id).Value(b.Tier);
            return t;
        }

        /// <summary>3択を重複なしで引く。</summary>
        public static List<BoonPick> Roll(GameRandom rng, BoonTier tier, int count = ChoiceCount)
        {
            var pool = new List<BoonDef>(All);
            var picks = new List<BoonPick>(count);
            for (int i = 0; i < count && pool.Count > 0; i++)
            {
                int k = (int)(rng.Next01() * pool.Count);
                picks.Add(new BoonPick(pool[k].Id, tier));
                pool.RemoveAt(k);
            }
            return picks;
        }

        /// <summary>集計して一覧表示するための辞書。</summary>
        public static Dictionary<BoonId, int> Aggregate(Hero h)
        {
            var d = new Dictionary<BoonId, int>();
            if (h?.boons == null) return d;
            foreach (var b in h.boons)
                d[b.Id] = (d.TryGetValue(b.Id, out var v) ? v : 0) + Def(b.Id).Value(b.Tier);
            return d;
        }
    }

    /// <summary>
    /// ボス階の定義。5階層ごと、10の倍数が大ボス。
    /// ボス階は既存の「帰還ポータル階」と同じなので、
    /// 「ボスを倒すとポータルが開く」という一本の導線になる。
    /// </summary>
    public readonly struct BossConfig
    {
        public readonly string Title;
        public readonly float HpMul, AtkMul, DefMul, Radius;
        public readonly int XpMul, GoldMul, GuaranteedDrops, DropIlvlBonus;

        public BossConfig(string title, float hp, float atk, float def, float r,
                          int xp, int gold, int drops, int ilvl)
        { Title = title; HpMul = hp; AtkMul = atk; DefMul = def; Radius = r;
          XpMul = xp; GoldMul = gold; GuaranteedDrops = drops; DropIlvlBonus = ilvl; }

        // Radius = 見た目と被弾判定の半径（通常敵は 0.34）。
        // ボスは「明らかに大きい」ことが第一印象の全部なので、ここを大きく取る。
        public static readonly BossConfig Mid   = new BossConfig("長", 9f,  1.45f, 1.7f, 0.85f, 14,  9, 2, 3);
        public static readonly BossConfig Great = new BossConfig("王", 20f, 1.95f, 2.2f, 1.25f, 34, 22, 4, 6);
        /// <summary>第50階層の主。ここまでの全部（属性・盾・仲間・潜在）を使い切らせるための壁。</summary>
        public static readonly BossConfig Final = new BossConfig("主", 52f, 2.6f,  2.8f, 1.75f, 90, 80, 7, 12);

        /// <summary>
        /// 壁との判定に使う半径の上限。
        /// 通路は 2 マス幅なので、見た目どおりの半径で壁判定すると
        /// 大ボスが自分の部屋から一歩も出られなくなる。
        /// 「見た目・被弾は大きい / 壁との判定は小さい」で分けるのが、
        /// 2D で大きい敵を動かすときの定石。
        /// Unity では CircleCollider2D を 2 つ持たせる:
        ///   ・Wall レイヤーと衝突する物理コライダ = min(Radius, CollideMax)
        ///   ・被弾判定用のトリガーコライダ       = Radius
        /// </summary>
        public const float CollideMax = 0.45f;

        public static BossConfig Of(BoonTier t) => t switch
        {
            BoonTier.Final => Final,
            BoonTier.Great => Great,
            _              => Mid
        };

        public float CollideRadius => Math.Min(Radius, CollideMax);
    }

    public static class BossSchedule
    {
        public const int Interval = 5;
        /// <summary>ラスボスの階層。倒しても階層は続く（深さの上限は設けない）。</summary>
        public const int FinalDepth = 50;

        public static bool IsBossFloor(int depth) => depth > 0 && depth % Interval == 0;

        /// <summary>ボス階でなければ null。</summary>
        public static BoonTier? TierAt(int depth)
        {
            if (!IsBossFloor(depth)) return null;
            if (depth % FinalDepth == 0) return BoonTier.Final;
            return depth % 10 == 0 ? BoonTier.Great : BoonTier.Mid;
        }

        /// <summary>ボス階は雑魚を減らす。取り巻きが多すぎるとボスの攻撃が読めなくなる。</summary>
        public const float TrashMultiplierOnBossFloor = 0.4f;

        /// <summary>
        /// ボスの名前と HP ゲージは「最初のダメージを与えてから」表示する。
        /// 部屋に入った瞬間に正体と残量が分かると、遭遇の緊張が全部前借りされてしまう。
        /// 一撃入れて初めて名乗る＝プレイヤー側の行動が情報の対価になる。
        /// UI 側は <c>bossRevealed</c> が立つまで名前もゲージも出さないこと
        /// （金の輪と王冠だけは最初から見せる。逃げる判断のために必要）。
        /// </summary>
        public const bool RevealNameAndHpOnFirstDamage = true;

        /// <summary>HP がこの割合を切ると激昂（第2段階）。</summary>
        public const float RageThreshold = 0.5f;
        public const float RageTelegraphMul = 0.65f;
        public const float RageSpeedMul = 1.3f;
        /// <summary>激昂中は技のクールダウンもこの倍率で縮む。</summary>
        public const float RageCooldownMul = 0.65f;
        public const int BurstCountNormal = 9;
        public const int BurstCountRaged = 14;
    }

    public enum BossMoveId { Slam, Cleave, Burst, Wave }

    /// <summary>
    /// ボスの範囲攻撃。
    ///
    /// 単体攻撃だけだとボスは「大きいだけの雑魚」になる。
    /// ボスの仕事は<b>立ち位置を強制的に動かすこと</b>なので、技は全部
    /// 「今いる場所を奪う」形にしてある。
    ///
    /// すべて予兆（Telegraph）付き。<b>予兆で描く図形＝実際に当たる範囲</b>を厳守すること。
    /// ここがズレた瞬間に「避けたのに当たった」が生まれ、
    /// 回避ボタンの無いこのゲームでは即座に理不尽になる。
    /// 溜め中はボスを完全に停止させる（避ける時間を保証する）。
    /// </summary>
    public readonly struct BossMove
    {
        public readonly BossMoveId Id;
        public readonly string Name;
        /// <summary>予兆の秒数。激昂の TelegraphMul が掛かる。</summary>
        public readonly float Telegraph;
        /// <summary>効果半径（マス）。ボスの Radius が加算される。</summary>
        public readonly float Radius;
        /// <summary>扇形の半角（度）。Cleave のみ。</summary>
        public readonly float ArcDeg;
        /// <summary>攻撃力への倍率。</summary>
        public readonly float Mult;
        public readonly float CdMin, CdMax;
        /// <summary>この間合いでのみ選ばれる。</summary>
        public readonly float MinDist, MaxDist;

        public BossMove(BossMoveId id, string name, float tele, float radius, float arc,
                        float mult, float cdMin, float cdMax, float minD, float maxD)
        { Id = id; Name = name; Telegraph = tele; Radius = radius; ArcDeg = arc;
          Mult = mult; CdMin = cdMin; CdMax = cdMax; MinDist = minD; MaxDist = maxD; }

        public static readonly BossMove[] All =
        {
            // 足元を叩く。近接で張り付き続ける戦い方を否定する技。
            new BossMove(BossMoveId.Slam,   "叩きつけ", 0.85f, 2.7f,  0f, 1.30f, 3.6f, 5.0f, 0f, 3.4f),
            // 正面を薙ぐ。横に回れば避けられる＝「後ろを取る」を教える技。
            new BossMove(BossMoveId.Cleave, "薙ぎ払い", 0.62f, 3.6f, 75f, 1.10f, 3.0f, 4.2f, 0f, 4.2f),
            // 全方位の弾。逃げ場を作らせる＝退路を意識させる。
            new BossMove(BossMoveId.Burst,  "散弾",     0.50f, 0f,    0f, 0.70f, 4.0f, 5.4f, 0f, 99f),
            // 広がる輪。外へ逃げると必ず追いつかれるので、
            // 「ボスに近づいて内側に入る」が正解になる。逃げ一択を崩すための技。
            new BossMove(BossMoveId.Wave,   "波動",     0.95f, 9.0f,  0f, 1.15f, 6.5f, 8.5f, 0f, 99f),
        };

        public static BossMove Of(BossMoveId id) => All[(int)id];

        /// <summary>波動の輪の速度（マス/秒）と、当たり判定の帯の幅。</summary>
        public const float WaveSpeed = 5.2f, WaveBand = 0.55f;
    }

    public static class BossMoveSet
    {
        public static BossMoveId[] For(BoonTier tier) => tier switch
        {
            BoonTier.Final => new[]{BossMoveId.Slam, BossMoveId.Cleave, BossMoveId.Burst, BossMoveId.Wave},
            BoonTier.Great => new[]{BossMoveId.Slam, BossMoveId.Cleave, BossMoveId.Burst},
            _              => new[]{BossMoveId.Slam, BossMoveId.Cleave},
        };

        /// <summary>
        /// 激昂で解禁される技。第2段階が「速くなるだけ」にならないようにする。
        /// 必ず「そのティアがまだ持っていない技」を割り当てること
        /// （持っている技を書いても何も起きず、激昂の意味が薄れる）。
        /// </summary>
        public static BossMoveId[] OnRage(BoonTier tier) => tier switch
        {
            BoonTier.Mid => new[]{BossMoveId.Burst},
            _            => new[]{BossMoveId.Wave},
        };

        /// <summary>
        /// 今の間合いで撃てる技を選ぶ。直前と同じ技は避ける
        /// （同じ図形が続くと「壊れて固まった」ように見えるため）。
        /// 撃てる技が無ければ null。
        /// </summary>
        public static BossMoveId? Pick(GameRandom rng, List<BossMoveId> owned,
                                       float distance, float bossRadius, BossMoveId? last)
        {
            var usable = new List<BossMoveId>();
            foreach (var id in owned)
            {
                var m = BossMove.Of(id);
                if (distance >= m.MinDist && distance <= m.MaxDist + bossRadius) usable.Add(id);
            }
            if (usable.Count == 0) return null;
            if (usable.Count > 1 && last.HasValue)
            {
                var alt = usable.FindAll(x => x != last.Value);
                if (alt.Count > 0) usable = alt;
            }
            return usable[(int)(rng.Next01() * usable.Count)];
        }
    }
}
