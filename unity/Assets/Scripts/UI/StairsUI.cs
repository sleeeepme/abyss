using UnityEngine;
using AbyssRelic.Core;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// 「今降りるか、持ち帰るか」— このゲームの緊張の源泉が集約されるダイアログ。
    /// 帰還は 5 階層ごとの安全地帯でのみ選べる（通常階では下るか引き返すかしかない）。
    /// </summary>
    public class StairsUI : MonoBehaviour
    {
        public static StairsUI Instance { get; private set; }

        public GameObject Root;
        public TMPro.TMP_Text TitleLabel;
        public TMPro.TMP_Text BodyLabel;
        public GameObject ReturnButton;

        void Awake() { Instance = this; if (Root != null) Root.SetActive(false); }

        public void Open()
        {
            var run = GameState.Run;
            if (run == null) return;

            Time.timeScale = 0f;
            if (Root != null) Root.SetActive(true);
            if (TitleLabel != null) TitleLabel.text = run.IsSafeFloor ? "帰還ポータル" : "下り階段";
            if (BodyLabel != null)
                BodyLabel.text =
                    $"第{run.Depth}階層\n戦利品 {run.Loot.Count}点 / {run.Gold}G\n" +
                    (run.IsSafeFloor
                        ? "ここは安全地帯。帰還すれば戦利品は確定する。"
                        : "深いほど良い物が出る。だが死ねば全て失う。");
            if (ReturnButton != null) ReturnButton.SetActive(run.IsSafeFloor);
        }

        public void Close()
        {
            Time.timeScale = 1f;
            if (Root != null) Root.SetActive(false);
        }

        // ボタンから接続する
        public void OnDescend() { Close(); RunManager.Instance.DescendOrReturn(true); }
        public void OnReturn()  { Close(); RunManager.Instance.DescendOrReturn(false); }
        public void OnCancel()  { Close(); }
    }
}
