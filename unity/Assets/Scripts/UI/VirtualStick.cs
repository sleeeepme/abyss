using UnityEngine;
using UnityEngine.EventSystems;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// 画面左半分のどこを触っても、そこを中心にスティックが出る「フローティング方式」。
    /// 固定位置のスティックは親指の位置ズレで誤操作が増えるため採用しない。
    /// </summary>
    public class VirtualStick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public RectTransform Ring;
        public RectTransform Knob;
        public float MaxRadius = 52f;
        public float DeadZone = 0.15f;

        Vector2 _origin;
        Vector2 _value;
        int _pointerId = -1;

        /// <summary>-1..1 のアナログ入力。デッドゾーン適用済み。</summary>
        public Vector2 Value => _value.magnitude < DeadZone ? Vector2.zero : _value;

        /// <summary>この指がスティックのものか（ガード判定と取り合わないため）</summary>
        public bool OwnsPointer(int pointerId) => _pointerId == pointerId;

        void Awake() => SetVisible(false);

        public void OnPointerDown(PointerEventData e)
        {
            if (_pointerId != -1) return;
            _pointerId = e.pointerId;
            _origin = e.position;
            Ring.position = e.position;
            Knob.anchoredPosition = Vector2.zero;
            SetVisible(true);
        }

        public void OnDrag(PointerEventData e)
        {
            if (e.pointerId != _pointerId) return;
            Vector2 d = e.position - _origin;
            if (d.magnitude > MaxRadius) d = d.normalized * MaxRadius;
            Knob.anchoredPosition = d;
            _value = d / MaxRadius;
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (e.pointerId != _pointerId) return;
            _pointerId = -1;
            _value = Vector2.zero;
            SetVisible(false);
        }

        void SetVisible(bool v)
        {
            if (Ring != null) Ring.gameObject.SetActive(v);
        }
    }
}
