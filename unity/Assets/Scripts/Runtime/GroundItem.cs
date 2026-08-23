using UnityEngine;
using AbyssRelic.Items;

namespace AbyssRelic.Runtime
{
    /// <summary>床に落ちている装備。未鑑定でもレアリティ色だけは見える（撤退判断のヒント）。</summary>
    public class GroundItem : MonoBehaviour
    {
        public SpriteRenderer Glow;
        public float PickupRadius = 1.0f;

        static readonly Color[] RarityColors =
        {
            new Color(0.78f, 0.81f, 0.85f),   // Common
            new Color(0.36f, 0.55f, 0.84f),   // Magic
            new Color(0.84f, 0.70f, 0.29f),   // Rare
            new Color(0.85f, 0.48f, 0.17f),   // Unique
            new Color(0.77f, 0.26f, 0.25f),   // Relic
        };

        public Item Item { get; private set; }

        public void Bind(Item item)
        {
            Item = item;
            if (Glow != null) Glow.color = RarityColors[(int)item.rarity];
        }

        public bool InRange(Vector2 p)
            => ((Vector2)transform.position - p).sqrMagnitude <= PickupRadius * PickupRadius;

        public string Label => Item.identified ? Item.DisplayName() : "未鑑定の" + Item.baseName;
    }
}
