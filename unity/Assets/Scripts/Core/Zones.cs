using System;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 層 — 10階層ごとに変わるダンジョンの雰囲気。
    ///
    /// 同じ絵が50階続くと、深く潜っている実感が数字（階層カウンタ）だけになる。
    /// 10階層ごとに見た目を変えると、「第23階層」ではなく
    /// <b>「灼熱の窯の途中」</b>として記憶されるようになり、到達点が語れるようになる。
    ///
    /// 変えるのは 5 つ。<b>色だけ変えても「フィルタを掛けただけ」に見えてしまう。</b>
    ///   Colors    … 床・壁・目地・装飾の色
    ///   Deco      … 床の装飾の形と密度（■ / 苔 / 亀裂 / 氷片 / 骨 / 紋様）
    ///   Air       … 漂う粒（塵・火の粉・雪・胞子）。動きが変わると空気が変わる
    ///   Gen       … 部屋の大きさと通路の多さ。間取りそのものの手触り
    ///   FamilyBias… 出やすい敵の系統。見た目と中身を一致させる
    /// </summary>
    public enum DecoKind { Block, Moss, Crack, Shard, Bone, Rune }

    public readonly struct AirDef
    {
        /// <summary>粒の数。端末に優しい上限として 40 を超えさせない。</summary>
        public readonly int Count;
        public readonly string ColorHex;
        public readonly float Size, DriftX, DriftY, Alpha;

        public AirDef(int count, string col, float size, float vx, float vy, float a)
        { Count = count; ColorHex = col; Size = size; DriftX = vx; DriftY = vy; Alpha = a; }
    }

    public readonly struct ZoneGen
    {
        /// <summary>部屋の大きさの倍率（1.0 が基準）。</summary>
        public readonly float RoomScale;
        /// <summary>追加のループ通路の本数。多いほど入り組む。</summary>
        public readonly int ExtraLoops;
        public ZoneGen(float room, int loops) { RoomScale = room; ExtraLoops = loops; }
    }

    public readonly struct ZoneDef
    {
        public readonly string Id, Name, Subtitle;
        public readonly string Floor, Wall, Edge, Dot, Accent;
        public readonly DecoKind Deco;
        /// <summary>装飾を置く間隔（タイルのハッシュ % これ == 0 で置く）。小さいほど密。</summary>
        public readonly int DecoEvery;
        /// <summary>明かりの届く距離（マス）。深淵は狭く、氷の回廊は反射するので広い。</summary>
        public readonly float LightRadius;
        public readonly AirDef Air;
        public readonly ZoneGen Gen;
        /// <summary>系統ごとの出現重みの倍率。1.0 が等倍、未指定は 1.0。</summary>
        public readonly (string family, float weight)[] FamilyBias;

        public ZoneDef(string id, string name, string sub,
                       string floor, string wall, string edge, string dot, string accent,
                       DecoKind deco, int decoEvery, float lightR,
                       AirDef air, ZoneGen gen, (string, float)[] bias)
        {
            Id = id; Name = name; Subtitle = sub;
            Floor = floor; Wall = wall; Edge = edge; Dot = dot; Accent = accent;
            Deco = deco; DecoEvery = decoEvery; LightRadius = lightR;
            Air = air; Gen = gen; FamilyBias = bias;
        }

        public float BiasFor(string familyId)
        {
            if (FamilyBias == null) return 1f;
            foreach (var (f, w) in FamilyBias) if (f == familyId) return w;
            return 1f;
        }
    }

    public static class Zones
    {
        /// <summary>1つの層が続く階層数。</summary>
        public const int FloorsPerZone = 10;

        public static readonly ZoneDef[] All =
        {
            new ZoneDef("mine", "石の坑道", "掘り抜かれた縦坑。まだ人の手の跡がある。",
                "#333c50", "#0f1218", "#232a38", "#3d4761", "#7fc3e0",
                DecoKind.Block, 11, 14f,
                new AirDef(26, "#7a8496", 1.5f,  0.10f,  0.22f, 0.30f),
                new ZoneGen(1.00f, 0), null),

            new ZoneDef("moss", "苔むす水路", "水の音。壁を覆う苔が足音を吸う。",
                "#2c4038", "#0c130f", "#1d2e26", "#3f6350", "#7fe0a8",
                DecoKind.Moss, 7, 13f,
                new AirDef(22, "#8fd8a8", 1.8f, -0.06f, -0.30f, 0.26f),
                new ZoneGen(1.10f, 1),
                new[]{("slime", 2.4f), ("undead", 1.4f), ("beast", 0.7f)}),

            new ZoneDef("kiln", "灼熱の窯", "熱で空気が歪む。床がまだ赤い。",
                "#4a2f28", "#170d0b", "#33201b", "#7a4028", "#ff8a4a",
                DecoKind.Crack, 9, 12f,
                new AirDef(30, "#ff9a5a", 1.7f,  0.05f, -0.55f, 0.42f),
                new ZoneGen(0.92f, 1),
                new[]{("flame", 3.0f), ("armor", 1.3f), ("frost", 0.25f)}),

            new ZoneDef("frost", "凍える回廊", "息が白い。壁の氷が松明を跳ね返す。",
                "#2f3f52", "#0d141b", "#22323f", "#5b8098", "#8fd8ff",
                DecoKind.Shard, 8, 16f,
                new AirDef(34, "#cfe8ff", 1.6f,  0.14f,  0.34f, 0.34f),
                new ZoneGen(1.14f, 0),
                new[]{("frost", 3.0f), ("undead", 1.5f), ("flame", 0.25f)}),

            new ZoneDef("bone", "骨の墓所", "足の下で何かが砕ける。壁一面が骨。",
                "#3c3a33", "#141310", "#2a2822", "#6a6455", "#e0d8b0",
                DecoKind.Bone, 6, 11f,
                new AirDef(20, "#c9c0a2", 1.4f, -0.10f,  0.14f, 0.24f),
                new ZoneGen(0.86f, 2),
                new[]{("undead", 3.0f), ("storm", 1.2f), ("slime", 0.6f)}),

            new ZoneDef("abyss", "深淵", "光が届かない。壁の在り処が分からない。",
                "#2b2740", "#0b0a12", "#1e1b30", "#4a4270", "#c98adf",
                DecoKind.Rune, 10, 9f,
                new AirDef(28, "#b48ce0", 2.0f,  0.03f, -0.16f, 0.36f),
                new ZoneGen(1.20f, 2),
                new[]{("arcane", 3.0f), ("storm", 1.6f), ("beast", 0.5f)}),
        };

        public static int IndexAt(int depth) => (Math.Max(1, depth) - 1) / FloorsPerZone % All.Length;
        public static ZoneDef At(int depth) => All[IndexAt(depth)];

        /// <summary>
        /// 一周した先はもう一段暗くする。第61階層以降で
        /// 「戻った」ではなく「もっと深い」に見せるため。
        /// </summary>
        public static int CycleAt(int depth)
            => (Math.Max(1, depth) - 1) / (FloorsPerZone * All.Length);

        public const float CycleDimPerLap = 0.88f;
        public static float DimAt(int depth) => (float)Math.Pow(CycleDimPerLap, CycleAt(depth));

        /// <summary>層が切り替わる階層か（バナーを出すタイミング）。</summary>
        public static bool IsZoneStart(int depth) => depth >= 1 && (depth - 1) % FloorsPerZone == 0;

        /// <summary>次の階で層が変わるか（階段ダイアログの予告用）。</summary>
        public static bool ChangesNext(int depth) => At(depth).Id != At(depth + 1).Id;
    }
}
