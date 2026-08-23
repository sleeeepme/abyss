using UnityEngine;
using AbyssRelic.Core;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// アイテムの自動拾得と、階段の文脈ボタン。
    /// 攻撃が自動な以上、拾得だけ手動なのは一貫性がない。触れたら拾う。
    /// 階段だけは「降りるか帰るか」の選択なので確認を挟む。
    /// </summary>
    public class InteractionController : MonoBehaviour
    {
        public PlayerController Player;
        public SimplePool DropPool;
        public GameObject PromptRoot;
        public TMPro.TMP_Text PromptLabel;

        [Tooltip("この距離まで近づくと自動で拾う")]
        public float PickupRadius = 0.7f;

        bool _onStair;

        void Update()
        {
            if (GameState.Run == null) { SetPrompt(false, null); return; }

            Vector2 p = Player.transform.position;

            // 自動拾得。Return でプールに戻すので逆順に回す。
            var active = DropPool.Active;
            for (int i = active.Count - 1; i >= 0; i--)
            {
                var gi = active[i].GetComponent<GroundItem>();
                if (gi == null) continue;
                if (((Vector2)gi.transform.position - p).sqrMagnitude <= PickupRadius * PickupRadius)
                    RunManager.Instance.Pickup(gi);
            }

            var stair = RunManager.Instance.Builder.StairWorld;
            _onStair = (stair - p).sqrMagnitude < 1.0f;

            if (_onStair) SetPrompt(true, GameState.Run.IsSafeFloor ? "▼ 帰還ポータル" : "▼ 階段を降りる");
            else SetPrompt(false, null);

#if UNITY_EDITOR || UNITY_STANDALONE
            if (Input.GetKeyDown(KeyCode.E)) Interact();
#endif
        }

        public void Interact()
        {
            if (_onStair) StairsUI.Instance.Open();
        }

        void SetPrompt(bool on, string label)
        {
            if (PromptRoot != null) PromptRoot.SetActive(on);
            if (on && PromptLabel != null) PromptLabel.text = label;
        }
    }
}
