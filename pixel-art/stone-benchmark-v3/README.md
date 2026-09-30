# 石の層・追加4体

承認済みクロウリングデッドとユーザー提供リファレンスを基準に制作。

- 32×32セル、1px輪郭、各13色、透過PNG
- `comparison.png`: 参照・承認済み1体・新作4体を1ドット=4pxで比較
- `overview.png`: 新作4体の8倍一覧
- `native-32/`: 原寸と8倍表示
- `sources/`: ImageGen原画
- `prompts/`: 使用した生成プロンプト
- `build.py`: Pixel Art Studioによる実寸化・13色化・書き出し
- `sprites.zip`: 原寸4体

内蔵ImageGenで各1体を個別生成し、Pixel Art Studioで原寸へ整理。ゲームへの組み込みとアニメーションは未実施。

検証結果: 全4体が32×32、各13色、アルファは0/255のみ、孤立画素0。`quality/pixel-quality.json`に記録。
