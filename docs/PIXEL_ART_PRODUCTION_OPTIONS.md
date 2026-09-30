# ピクセルアート品質改善の制作方式調査

更新: 2026-09-18

## 結論

アッシュハウンドのように既存商用パックと同水準・同テイストが必要な32pxスプライトでは、座標コードだけで完成絵を描く方式を停止する。Pixel Art Studioは原寸検査、パレット固定、透過、書き出し、アニメーション梱包に限定し、絵の正本は次の優先順位で作る。

1. 正規購入したTiny RPGの編集可能なHellhound/Asepriteデータを基に、ライセンス範囲内でアッシュハウンドへ改変する。
2. 独自造形が必要なら、ネイティブ32px対応の専用モデルで複数案を生成し、Asepriteで人が1px単位の最終レタッチを行う。
3. 重要敵やボスはピクセルアーティストへ依頼し、Pixel Art Studioでゲーム仕様へ整える。

## 比較

| 方法 | 期待品質 | Tiny RPGとの整合 | 導入条件 | 判断 |
|---|---:|---:|---|---|
| Tiny RPG Pack 02のHellhoundを正規改変 | 最も高い | そのもの | $2.50、購入済みファイル | 第一候補 |
| PixelLab API Bitforge / Pro | 高い候補を多数探索 | スタイル参照・強制パレット対応 | PixelLabアカウント/API token | 第二候補 |
| Sprite AI MCP | 中〜高、試行が速い | 32px、参照sprite、palette ID対応 | 無料アカウント/API key | 無料パイロット候補 |
| Retro Diffusion + Aseprite | 中〜高 | 専用モデル＋手修正 | Aseprite、拡張$65、ローカル環境確認 | 重い |
| 汎用ImageGen→縮小 | 低い | ピクセル密度が崩れる | 既存機能 | 不採用 |
| 座標コードだけで作画 | 低い | 解剖・クラスターの画力不足 | 導入不要 | 完成絵には不採用 |
| 公開Stable Diffusion拡張 | 不確実 | 後処理依存 | Windows/NVIDIA前提が多い | M4 Macでは不採用 |

## 具体的な導入

### Sprite AI MCP

- 公式MCP URL: `https://www.sprite-ai.art/api/mcp`
- CodexはHTTP MCPを追加可能。
- 認証情報は `SPRITE_AI_API_KEY` 環境変数から読む。
- 接続コマンド:

```sh
codex mcp add sprite-ai \
  --url https://www.sprite-ai.art/api/mcp \
  --bearer-token-env-var SPRITE_AI_API_KEY
```

- 32×32の`creature`を直接生成し、参照sprite IDと固定13色paletteを使用する。
- 生成案を8〜16案比較し、1案だけをPixel Art Studioへ渡す。

### PixelLab API

- 32×32を直接生成できる。Bitforgeはスタイル参照、初期画像、強制パレットに対応。
- 2026-09-18時点の公式見積りは32×32透明Bitforgeが約$0.00734/生成。
- API tokenを環境変数に設定し、公式APIだけを使う。

### 正規アセット改変

- Tiny RPG Character Asset Pack 02は商用ゲーム利用と改変を許可している。
- 再配布・再販売は禁止。成果物はゲーム内アセットとして管理する。
- HellhoundのAsepriteファイルまたは原寸PNGを受け取り、色、肋骨、灰の欠け、眼をアッシュハウンド仕様へ変更する。
- 元の輪郭リズム、脚、顎、アニメーションタイミングを保持できるため、テイスト一致は最も確実。

## 品質ゲート

- 参照と同じ表示倍率で、頭身、胴高、脚長、負の空間、輪郭ランを比較する。
- 完成判定は人の目を必須とする。色数、透過、孤立ピクセル検査だけでSHIPにしない。
- 32px原寸と8倍表示の両方で確認する。
- 生成モデルの出力を無加工で採用しない。目、口、接地、輪郭、左右脚を原寸で修正する。
