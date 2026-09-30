# 石の層の一室
room.tmjをTiledで開く。parts.tsjとpiecesフォルダを同じ場所に置く。16px論理セル、26×22セル。床・壁・草・その他オブジェクト・当たり判定を分離。
床はstone-floor-v5から再分割し、連続柄は元の位置関係を維持。裸地を中央に追加。既存のstone-rd-v3素材の壁、草、キノコ、岩を共通の色に調整。
草・キノコは装飾。岩の足元2セルと壁領域が通行不可。北出口と南入口は通行可能。ゲームのダメージ式・報酬・AIは未変更。
正本: output/stone-room-v6/build.cjs。data.jsonはプレビューと同じ素材配置。PNGはnearest-neighborで拡大してください。
