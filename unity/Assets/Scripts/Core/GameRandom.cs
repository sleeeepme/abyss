using System;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 決定論的 RNG（mulberry32）。UnityEngine.Random と違いシード再現が保証されるので、
    /// ダンジョン生成・ドロップ抽選はすべてこれを使う。
    /// </summary>
    public sealed class GameRandom
    {
        uint _s;

        public GameRandom(uint seed) { _s = seed == 0 ? 1u : seed; }

        public static uint Hash(params int[] parts)
        {
            unchecked
            {
                uint h = 2166136261u;
                foreach (var p in parts) { h ^= (uint)p; h *= 16777619u; }
                return h == 0 ? 1u : h;
            }
        }

        public float Next01()
        {
            unchecked
            {
                _s += 0x6D2B79F5u;
                uint t = _s;
                t = (t ^ (t >> 15)) * (1u | t);
                t ^= t + (t ^ (t >> 7)) * (61u | t);
                return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296f;
            }
        }

        /// <summary>min..max（max を含む）</summary>
        public int Range(int min, int max) => min + (int)(Next01() * (max - min + 1));

        public float Range(float min, float max) => min + Next01() * (max - min);

        public T Pick<T>(System.Collections.Generic.IList<T> list)
            => list[(int)(Next01() * list.Count)];

        public bool Chance(float p) => Next01() < p;
    }
}
