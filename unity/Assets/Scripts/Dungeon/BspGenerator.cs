using System;
using System.Collections.Generic;
using AbyssRelic.Core;

namespace AbyssRelic.Dungeon
{
    public enum TileType : byte { Wall = 0, Floor = 1, Stair = 2 }

    public struct Room
    {
        public int X, Y, W, H;
        public int Cx => X + W / 2;
        public int Cy => Y + H / 2;
    }

    public sealed class FloorMap
    {
        public int Width, Height;
        public TileType[,] Tiles;
        public List<Room> Rooms = new List<Room>();
        public Room StartRoom;
        public int StairX, StairY;
        /// <summary>この階層の層（見た目・装飾・粒・明かり）。</summary>
        public ZoneDef Zone;
        /// <summary>層が一周した回数。描画側はこの数だけ全体を暗くする。</summary>
        public int ZoneCycle;

        public bool IsWall(int x, int y)
            => x < 0 || y < 0 || x >= Width || y >= Height || Tiles[y, x] == TileType.Wall;
    }

    /// <summary>
    /// BSP による部屋＋通路生成。
    /// 兄弟ノード同士を必ず接続するので「到達不能な部屋」が構造的に発生しない
    /// （＝生成後の連結性チェックと再生成ループが不要）。
    /// </summary>
    public static class BspGenerator
    {
        const int MinLeaf = 11;
        const int MaxDepth = 5;

        class Node
        {
            public int X, Y, W, H;
            public Node A, B;
            public bool IsLeaf => A == null;
            public Room Room;
        }

        public static FloorMap Generate(int depth, uint seed)
        {
            var rng = new GameRandom(seed);
            int w = Math.Min(96, 44 + depth * 2);
            int h = Math.Min(96, 40 + depth * 2);

            var map = new FloorMap { Width = w, Height = h, Tiles = new TileType[h, w] };

            // 層（10階層ごと）で間取りの手触りを変える。
            // 色だけ変えると「同じ絵にフィルタを掛けた」ようにしか見えないので、
            // 部屋の大きさと通路の本数も一緒に動かす。
            var zone = Zones.At(depth);
            var zg = zone.Gen;
            map.Zone = zone;
            map.ZoneCycle = Zones.CycleAt(depth);

            var root = new Node { X = 1, Y = 1, W = w - 2, H = h - 2 };
            var leaves = new List<Node>();
            Split(rng, root, 0, leaves);

            foreach (var l in leaves)
            {
                float lo = Math.Clamp(0.55f * zg.RoomScale, 0.42f, 0.80f);
                float hi = Math.Clamp(0.85f * zg.RoomScale, 0.60f, 0.94f);
                int rw = Math.Max(4, (int)(l.W * rng.Range(lo, hi))) - 1;
                int rh = Math.Max(4, (int)(l.H * rng.Range(lo, hi))) - 1;
                rw = Math.Min(rw, l.W - 1);
                rh = Math.Min(rh, l.H - 1);
                int rx = l.X + rng.Range(0, Math.Max(0, l.W - rw - 1));
                int ry = l.Y + rng.Range(0, Math.Max(0, l.H - rh - 1));

                var room = new Room { X = rx, Y = ry, W = rw, H = rh };
                l.Room = room;
                map.Rooms.Add(room);
                for (int y = ry; y < ry + rh; y++)
                    for (int x = rx; x < rx + rw; x++)
                        map.Tiles[y, x] = TileType.Floor;
            }

            Link(rng, map, root);

            // ループ通路: 一本道を避け、リアルタイム戦闘での退路を作る。
            // 層によって本数が増える＝入り組んだ層ができる。
            int extra = Math.Clamp(1 + depth / 8 + zg.ExtraLoops, 1, 5);
            for (int i = 0; i < extra && map.Rooms.Count > 2; i++)
                Connect(rng, map, map.Rooms[rng.Range(0, map.Rooms.Count - 1)],
                                  map.Rooms[rng.Range(0, map.Rooms.Count - 1)]);

            map.StartRoom = map.Rooms[0];

            // 出口 = 開始部屋から BFS で最も遠い部屋（マンハッタン距離ではなく実歩数）
            var far = FarthestRoom(map, map.StartRoom);
            map.StairX = far.Cx;
            map.StairY = far.Cy;
            map.Tiles[map.StairY, map.StairX] = TileType.Stair;

            return map;
        }

        static void Split(GameRandom rng, Node n, int d, List<Node> leaves)
        {
            bool canH = n.H >= MinLeaf * 2;
            bool canW = n.W >= MinLeaf * 2;
            if (d >= MaxDepth || (!canH && !canW)) { leaves.Add(n); return; }

            bool horiz;
            if (!canW) horiz = true;
            else if (!canH) horiz = false;
            else if (n.W / (float)n.H > 1.25f) horiz = false;
            else if (n.H / (float)n.W > 1.25f) horiz = true;
            else horiz = rng.Next01() < 0.5f;

            if (horiz)
            {
                int cut = rng.Range(MinLeaf, n.H - MinLeaf);
                n.A = new Node { X = n.X, Y = n.Y, W = n.W, H = cut };
                n.B = new Node { X = n.X, Y = n.Y + cut, W = n.W, H = n.H - cut };
            }
            else
            {
                int cut = rng.Range(MinLeaf, n.W - MinLeaf);
                n.A = new Node { X = n.X, Y = n.Y, W = cut, H = n.H };
                n.B = new Node { X = n.X + cut, Y = n.Y, W = n.W - cut, H = n.H };
            }
            Split(rng, n.A, d + 1, leaves);
            Split(rng, n.B, d + 1, leaves);
        }

        static Room Link(GameRandom rng, FloorMap map, Node n)
        {
            if (n.IsLeaf) return n.Room;
            var ra = Link(rng, map, n.A);
            var rb = Link(rng, map, n.B);
            Connect(rng, map, ra, rb);
            return rng.Next01() < 0.5f ? ra : rb;
        }

        static void Connect(GameRandom rng, FloorMap map, Room a, Room b)
        {
            if (rng.Next01() < 0.5f) { CarveH(map, a.Cx, b.Cx, a.Cy); CarveV(map, a.Cy, b.Cy, b.Cx); }
            else                     { CarveV(map, a.Cy, b.Cy, a.Cx); CarveH(map, a.Cx, b.Cx, b.Cy); }
        }

        // 通路は幅2。幅1だと敵とすれ違えず、リアルタイム戦闘で詰みが起きる。
        static void CarveH(FloorMap m, int x1, int x2, int y)
        {
            for (int x = Math.Min(x1, x2); x <= Math.Max(x1, x2); x++)
            {
                Set(m, x, y);
                Set(m, x, y + 1);
            }
        }

        static void CarveV(FloorMap m, int y1, int y2, int x)
        {
            for (int y = Math.Min(y1, y2); y <= Math.Max(y1, y2); y++)
            {
                Set(m, x, y);
                Set(m, x + 1, y);
            }
        }

        static void Set(FloorMap m, int x, int y)
        {
            if (x < 1 || y < 1 || x >= m.Width - 1 || y >= m.Height - 1) return;
            if (m.Tiles[y, x] == TileType.Wall) m.Tiles[y, x] = TileType.Floor;
        }

        static Room FarthestRoom(FloorMap map, Room start)
        {
            int w = map.Width, h = map.Height;
            var dist = new int[h, w];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) dist[y, x] = -1;

            var q = new Queue<(int x, int y)>();
            q.Enqueue((start.Cx, start.Cy));
            dist[start.Cy, start.Cx] = 0;
            while (q.Count > 0)
            {
                var (cx, cy) = q.Dequeue();
                int nd = dist[cy, cx] + 1;
                TryPush(cx + 1, cy); TryPush(cx - 1, cy);
                TryPush(cx, cy + 1); TryPush(cx, cy - 1);

                void TryPush(int nx, int ny)
                {
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
                    if (dist[ny, nx] >= 0 || map.Tiles[ny, nx] == TileType.Wall) return;
                    dist[ny, nx] = nd;
                    q.Enqueue((nx, ny));
                }
            }

            var best = start; int bestD = -1;
            foreach (var r in map.Rooms)
            {
                int d = dist[r.Cy, r.Cx];
                if (d > bestD) { bestD = d; best = r; }
            }
            return best;
        }
    }
}
