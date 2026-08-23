using UnityEngine;
using AbyssRelic.Core;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// 盾のガードとパリイ。
    ///
    /// 指の役割分担:
    ///   画面左半分に最初に触れた指 → 移動スティック（VirtualStick が拾う）
    ///   それ以外の指（右半分 or 2本目）→ ガード
    /// これで「移動しながら盾を構える」が片手ずつで成立する。
    ///
    /// パリイは「構えた瞬間」からの受付時間内に着弾したときだけ成立する。
    /// 押しっぱなしでは絶対に発生しない — ここを緩めると盾を握りっぱなしが最適解になる。
    /// </summary>
    public class GuardController : MonoBehaviour
    {
        public static GuardController Instance { get; private set; }

        public VirtualStick Stick;
        [Tooltip("ガード中の移動速度倍率。移動＝回避なので、これがガードの代償になる")]
        public float GuardMoveMultiplier = 0.62f;

        int _guardFingerId = -1;
        float _guardStartTime = -99f;

        public bool IsGuarding { get; private set; }
        /// <summary>今この瞬間に着弾したらパリイになるか（UI の光り分けに使う）</summary>
        public bool InParryWindow(float parryWindow)
            => IsGuarding && Time.time - _guardStartTime <= parryWindow;

        void Awake() { Instance = this; }

        void Update()
        {
            if (GameState.Run == null) { Release(); return; }

#if UNITY_EDITOR || UNITY_STANDALONE
            bool key = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.Space);
            if (key) Press(); else if (_guardFingerId < 0) Release();
#endif
            PollTouches();
        }

        void PollTouches()
        {
            if (Input.touchCount == 0) { if (_guardFingerId >= 0) { _guardFingerId = -1; Release(); } return; }

            bool stillDown = false;
            for (int i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                // スティックが掴んでいる指はガードにしない
                if (Stick != null && Stick.OwnsPointer(t.fingerId)) continue;

                if (t.phase == TouchPhase.Began && _guardFingerId < 0)
                {
                    _guardFingerId = t.fingerId;
                    Press();
                }
                if (t.fingerId == _guardFingerId &&
                    t.phase != TouchPhase.Ended && t.phase != TouchPhase.Canceled)
                    stillDown = true;
            }
            if (_guardFingerId >= 0 && !stillDown) { _guardFingerId = -1; Release(); }
        }

        public void Press()
        {
            if (IsGuarding) return;
            IsGuarding = true;
            _guardStartTime = Time.time;   // この瞬間からパリイ受付が始まる
        }

        public void Release() => IsGuarding = false;

        /// <summary>階層移動や死亡でリセットする</summary>
        public void ForceClear() { IsGuarding = false; _guardFingerId = -1; _guardStartTime = -99f; }

        /// <summary>
        /// 被弾処理から呼ぶ。戻り値は適用後のダメージ。パリイなら -1（＝攻撃そのものが消滅）。
        /// </summary>
        public int ApplyGuard(int damage, in DerivedStats st, Hero hero)
        {
            if (!IsGuarding || !st.HasShield) return damage;

            if (Time.time - _guardStartTime <= st.ParryWindow)
                return -1;                                   // パリイ: 盾の耐久も減らない

            if (st.Block <= 0f) return damage;
            Durability.Wear(hero, Items.Slot.Shield, Durability.ShieldPerBlock);
            return Mathf.Max(1, Mathf.RoundToInt(damage * (1f - st.Block / 100f)));
        }
    }
}
