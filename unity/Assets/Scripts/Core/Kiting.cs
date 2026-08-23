using System;
using System.Numerics;

namespace AbyssRelic.Core
{
    public enum Footing { Still, Advance, Strafe, Retreat, Melee }

    /// <summary>
    /// 引き撃ちの抑制 — 飛び道具は足を止めるほど強い。
    ///
    /// <b>症状</b>: 弓が強すぎる。<b>最初に疑うべきこと</b>: 本当に威力が高いのか。
    /// 実測すると飛び道具の理論火力はむしろ最下位だった（弓110 / 短剣139 / 剣128）。
    /// つまり火力ではなく<b>構造</b>の問題:
    ///
    ///   プレイヤーの移動速度 4.125 は、全アーキタイプ（最速の蟲でも 3.2）より速い。
    ///   射程 5.8 の弓で後ろに歩き続けるだけで、敵は永久に届かない。
    ///   同じ火力でも、剣は「殴られながら」出す数字で、弓は「無傷で」出す数字だった。
    ///
    /// だから威力を一律に下げるのではなく、<b>足を止めない射撃だけ</b>を弱くする。
    /// 「弓は下がりながら撃つ武器」ではなく「間合いを保って足を止める武器」にする。
    ///
    /// <b>近接には一切かからない</b>（かけるとゲームが別物になる）。
    /// </summary>
    public static class Kiting
    {
        public const float Still   = 1.00f;
        public const float Advance = 0.95f;   // 前に出るのは罰しない
        public const float Strafe  = 0.85f;   // 避けながら撃つ。実戦の主軸
        /// <summary>
        /// 引き撃ち。0.55 まで下げたら火力でも安全性でも横移動に負けて
        /// 選択肢自体が死んだので 0.62 に戻した。潰すのではなく順位を下げるのが狙い。
        /// </summary>
        public const float Retreat = 0.62f;

        /// <summary>前進／後退を分ける内積のしきい値。この間は横移動扱い。</summary>
        public const float Threshold = 0.35f;

        public static float MultiplierOf(Footing f) => f switch
        {
            Footing.Still   => Still,
            Footing.Advance => Advance,
            Footing.Strafe  => Strafe,
            Footing.Retreat => Retreat,
            _               => 1f,          // Melee
        };

        public static string Label(Footing f) => f switch
        {
            Footing.Still   => "足を止めて撃つ",
            Footing.Advance => "踏み込みながら",
            Footing.Strafe  => "横に動きながら",
            Footing.Retreat => "引き撃ち",
            _               => "",
        };

        /// <summary>移動方向と「敵の方向」の内積から、今の撃ち方を判定する。</summary>
        public static Footing Of(Vector2 moveDir, bool moving, Vector2 self, Vector2 target)
        {
            if (!moving) return Footing.Still;
            var to = target - self;
            float len = to.Length();
            if (len <= 1e-6f) return Footing.Still;
            float dot = Vector2.Dot(moveDir, to / len);
            if (dot >  Threshold) return Footing.Advance;
            if (dot < -Threshold) return Footing.Retreat;
            return Footing.Strafe;
        }

        /// <summary>飛び道具のときだけ効く。近接は常に満額。</summary>
        public static Footing For(in DerivedStats st, Vector2 moveDir, bool moving,
                                  Vector2 self, Vector2 target)
        {
            if (st.Projectile == ProjectileKind.None) return Footing.Melee;
            return Of(moveDir, moving, self, target);
        }

        /// <summary>
        /// 減衰した一撃かどうか（UI 用）。
        /// 数字が減っていることが見えないと、なぜ削れないのか分からず理不尽になる。
        /// 該当する一撃はダメージ数値をくすませて「↓」を添える。
        /// </summary>
        public static bool IsWeakened(Footing f)
            => f == Footing.Strafe || f == Footing.Retreat;
    }
}
