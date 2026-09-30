# Claudeへの引き継ぎ：拠点背景 決定稿

2026-09-09、ユーザーが `output/hub-loop-v3` を決定稿として承認。
正本は `proto/assets/backgrounds/hub-final-v1/`。以後の実装にはこの素材を使う。過去の画像生成稿（21〜28）やhub-loop-v1/v2へ戻さない。

## 依頼する実装

既存拠点画面の背景へ決定稿のループアニメを配置する。背景素材の保存まで完了しており、ゲーム本体への接続は未実施。UIや操作判定は背景とは独立した上位レイヤーに配置する。現在の配色・構図・動きは承認済みなので、再生成や自動中央補正は行わない。

## 正本ファイル

- `hub-loop-4x.webp`：684×1200、ロスレスWebP、6秒無限ループ。簡単な表示確認用にも使える。
- `loop-spritesheet.png`：2052×1800、12列×6行、各フレーム171×300。ゲームで再生制御する場合はこちらを推奨。
- `background.png`：171×300、静止画とモーション軽減用。
- `preview.html`：単独で開ける再生・一時停止プレビュー。画像を埋め込み済み。
- `approved-source.jpg`：ユーザーが戻すよう指定した原稿。
- `manifest.json`：寸法・時間・正本ファイルのSHA-256。
- `verification.json`：書き出し検証結果。
- `build.cjs`：再生成用。Node.jsとsharpが必要。`node build.cjs` は正本を上書きせず `rebuild/` へ出力する。

## 再生仕様

72フレームを12fpsで再生。フレーム番号は `Math.floor(elapsedSeconds * 12) % 72`。シートから切り出す位置は `sx=(frame%12)*171`、`sy=Math.floor(frame/12)*300`、幅171・高さ300。Canvasの `imageSmoothingEnabled=false` とCSSの `image-rendering:pixelated` を使用する。整数倍率を優先し、画面比率が違う場合は中央寄せのcontain表示を基準とする。coverによる切り取りを使う場合は、広場・洞窟・下部UI領域が切れないことを確認する。

拠点を離れたらアニメ更新を停止し、画面復帰時に重複したrequestAnimationFrameを作らない。OSのprefers-reduced-motionではbackground.pngを表示する。背景にpointer-eventsを持たせず、UIのクリック・タップを妨げない。

## 承認済みの動きと範囲

煙突の煙、下部の雲、風に舞う草葉、木の葉の小さな揺れ、奥の洞窟の霧、付け根から先端へ強くなる蔦の揺れ、川の反射、洞窟の粒子。建物と広場は固定。水車そのものの回転は含まない。蔦・樹木などの動きは元画像の画素から作っており、背景全体を再生成していない。

## 確認済み／組み込み後の確認

書き出しは72フレーム・6000ms、0秒と6秒の描画データ一致。4倍拡大はニアレストネイバー。プレビューの再生による画素変化と一時停止をブラウザで確認済み。

組み込み後は、拠点メニューの押下・サブ画面往復・UIの読みやすさ・各画面比率・バックグラウンド停止を確認する。関連する既存テストは `proto/hubtest.mjs` と `proto/basetest.mjs`。ゲームバランスはこの背景配置のために変更しない。

## 作業中ファイルへの注意

引き継ぎ作成時にproto/index.html、proto/game-feel.js、proto/layertest.mjsに既存変更があった。本作業ではそれらを編集していない。未追跡のproto/feel.jsやproto/alpha.jsを接続元の正本と誤認しない。担当範囲はdocs/VISUAL_DEVELOPMENT.md参照。
