# ピクセルアートHow-to調査 — ABYSS制作ルール

調査日: 2026-09-19

## 読んだ主要資料

1. [モシナラ：岩や氷をドット絵で描くコツと手順](https://moshi-nara.com/18037/)
2. [Derek Yu: Pixel Art Tutorial — Basics](https://www.derekyu.com/makegames/pixelart.html)
3. [Derek Yu: Pixel Art — Common Mistakes](https://www.derekyu.com/makegames/pixelart2.html)
4. [Cure / PixelJoint: The Pixel Art Tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299)
5. [Pedro Medeiros: My Thoughts on Very Low Resolution](https://saint11.art/blog/thoughts_on_low_resolution/)
6. [Pedro Medeiros: Consistency](https://saint11.art/blog/consistency/)
7. [Pedro Medeiros: Scaling Pixel Art](https://saint11.art/blog/scaling/)
8. [SLYNYRD: Castlevania Study](https://www.slynyrd.com/blog/2022/3/19/pixelblog-37-classic-castlevania-study)
9. [Clip Studio Tips: Creating Pixel Character Art](https://tips.clip-studio.com/en-us/articles/11408)
10. [Pinnguaq: Pixel Power — Sprite Creation](https://pinnguaq.com/wp-content/uploads/2020/05/Tutorial-PixelPowerSpriteCreation.pdf)

補助資料としてSpriteGenとPixnoteの16×16・32×32キャラクター講座も確認した。

## 共通していた原則

- 完成サイズを最初に固定し、原寸グリッドで描く。
- 単色シルエットで対象、向き、役割が読めるまで内部ディテールを入れない。
- 一個のピクセルより、同色ピクセルの連続した塊を造形単位として考える。
- 色数を増やす前に、既存色の明度差と役割を明確にする。
- 光源を一つに固定し、輪郭沿いではなく面の向きに従って影を置く。
- 輪郭の階段幅を整え、ジャギー、二重角、太さの揺れを修正する。
- 目、歯、肋骨などは縮小線画ではなく、小さな記号として設計する。
- ディテール、ノイズ、ディザは最後に必要性を判定する。
- 原寸、拡大、シルエット、グレースケール、実背景で別々に評価する。
- ピクセルアートの縮小は原則として行わず、表示拡大は整数倍・最近傍補間にする。

## ABYSSでの新しい制作順

1. ベンチマークから占有率、頭身、負の空間、輪郭規則、光源、色の役割、最小クラスターを記録する。
2. 接地点、背骨、頭、胴、四肢端だけを置く。
3. 原寸で単色シルエットを3〜6案作り、1倍表示で選ぶ。
4. 3〜5色の大色面だけで頭、胴、近側・遠側の脚、焦点部を分ける。
5. 大きな影と小さな明部で立体を作り、グレースケールで確認する。
6. 1px輪郭と曲線の階段幅を清書する。
7. 識別に必要な特徴を三つだけ、重要順に加える。
8. 明暗二種類のゲーム背景へ置き、原寸で読めない箇所だけを修正する。

シルエット、大色面、明暗、クラスター、ベンチマーク、実背景のいずれかが不合格なら、その段階へ戻る。後工程の描き込みで隠さない。

## アッシュハウンドへの適用

識別特徴は次の三つに絞る。

1. 低い胴と前へ突き出した大顎。
2. 高く巻いた二股の尾。
3. 不均等な露出肋骨と小さい琥珀眼。

毛束、灰の粒、歯列、全身のひび割れは、上の三特徴と四脚の負の空間が成立した後に必要性を判定する。生成候補も同じ工程で審査し、シルエットや脚構造が崩れた候補は修復せず破棄する。
