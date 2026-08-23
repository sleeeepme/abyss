using System.Collections.Generic;
using UnityEngine;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// 敵・ドロップ・ダメージ数値のプール。
    /// 毎階層 40 体の Instantiate/Destroy は iOS では GC スパイクの直接の原因になるので必須。
    /// </summary>
    public class SimplePool : MonoBehaviour
    {
        public GameObject Prefab;
        public int Prewarm = 48;

        readonly Stack<GameObject> _free = new Stack<GameObject>();
        readonly List<GameObject> _active = new List<GameObject>();

        void Awake()
        {
            for (int i = 0; i < Prewarm; i++)
            {
                var go = Instantiate(Prefab, transform);
                go.SetActive(false);
                _free.Push(go);
            }
        }

        public GameObject Get()
        {
            var go = _free.Count > 0 ? _free.Pop() : Instantiate(Prefab, transform);
            go.SetActive(true);
            _active.Add(go);
            return go;
        }

        public void Return(GameObject go)
        {
            if (!_active.Remove(go)) return;
            go.SetActive(false);
            _free.Push(go);
        }

        public void ReturnAll()
        {
            for (int i = _active.Count - 1; i >= 0; i--)
            {
                _active[i].SetActive(false);
                _free.Push(_active[i]);
            }
            _active.Clear();
        }

        public IReadOnlyList<GameObject> Active => _active;
    }
}
