using UnityEngine;
using UnityEngine.Tilemaps;
using AbyssRelic.Dungeon;

namespace AbyssRelic.Runtime
{
    /// <summary>
    /// FloorMap を Tilemap に焼き込む。
    /// 2D では部屋単位のカリングは不要（Tilemap 1枚で 1 ドローコール）。
    /// </summary>
    public class DungeonBuilder : MonoBehaviour
    {
        [Header("Tilemaps")]
        public Tilemap FloorMapLayer;
        public Tilemap WallMapLayer;

        [Header("Tiles")]
        public TileBase FloorTile;
        public TileBase WallTile;
        public TileBase StairTile;

        [Header("Refs")]
        public Transform StairMarker;

        FloorMap _map;
        public FloorMap Current => _map;

        public void Build(FloorMap map)
        {
            _map = map;
            FloorMapLayer.ClearAllTiles();
            WallMapLayer.ClearAllTiles();

            int w = map.Width, h = map.Height;
            var positions = new Vector3Int[w * h];
            var floorTiles = new TileBase[w * h];
            var wallTiles = new TileBase[w * h];

            int i = 0;
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++, i++)
                {
                    positions[i] = new Vector3Int(x, y, 0);
                    var t = map.Tiles[y, x];
                    floorTiles[i] = t == TileType.Wall ? null : (t == TileType.Stair ? StairTile : FloorTile);
                    wallTiles[i]  = t == TileType.Wall ? WallTile : null;
                }
            }

            // SetTiles の一括呼び出し。1枚ずつ SetTile すると 96x96 で数フレーム落ちる。
            FloorMapLayer.SetTiles(positions, floorTiles);
            WallMapLayer.SetTiles(positions, wallTiles);

            if (StairMarker != null)
                StairMarker.position = new Vector3(map.StairX + 0.5f, map.StairY + 0.5f, 0f);
        }

        public bool IsWallAt(Vector2 world)
            => _map == null || _map.IsWall(Mathf.FloorToInt(world.x), Mathf.FloorToInt(world.y));

        public Vector2 StairWorld => new Vector2(_map.StairX + 0.5f, _map.StairY + 0.5f);
    }
}
