# 広告接続（2026-10-09 更新）

## 現状

CrazyGames HTML5 SDK v3 のリワード広告接続を実装済み。開発者ポータルへの登録・提出・本番配信は未実施。`proto/ads.js` が共通ライフサイクルを管理し、
`proto/index.html` がゲーム画面の退避・復帰と報酬を扱う。
ガチャ (`gacha`)、仲間の蘇生 (`revive`)、階段での回復 (`heal`)、
死亡時の引き継ぎ (`inherit`) を接続済み。報酬内容・確率・上限は変更していない。

file URL と localhost / 127.0.0.1 / ::1 では5秒のテスト広告を自動設定する。
ただし `?ads=crazygames` を付けた場合、または CrazyGames ドメイン／その参照元で開いた場合は公式SDKを優先する。
それ以外の公開URLは接続先なしで起動する。未接続では報酬も回数消費も発生せず、
元の画面へ戻して通知する。従来の街バナーのダミー枠もテスト広告時だけ表示する。
実バナーの配信・SDK固有の表示位置管理は未実装。

## 接続契約

ゲーム読み込み後、広告開始前に `window.ABYSS_ADS.setProvider(provider)` を呼ぶ。
null は未接続へ戻す。実行中の差し替えは禁止。

```js
ABYSS_ADS.setProvider({
  name: 'your-provider',
  requestRewarded({placement, signal}) {
    // Promise<{status}> を返す。SDKの「報酬条件達成」の通知のみ rewarded に変換。
    // 正常に閉じた通知と報酬条件達成の通知は区別する。
    // signal.abort で購読・タイマー・自前のUIを片付ける。
    // SDKが表示の途中キャンセルを許さない場合も、遅延通知で報酬を与えない。
    return sdkAdapter.request({placement, signal});
  }
});
syncAdBar();
```

provider の結果は `rewarded` / `cancelled` / `unavailable` / `error`。
例外・Promise拒否・不正な結果は `error`。共通処理は重複要求に `busy`、
120秒応答がなければ `timeout` を返す。全結果で AbortSignal を中止するため、
SDK adapter の後片付けは冪等にする。広告SDKが長い広告を扱う場合はタイムアウト値を再検討する。
広告の完了・失敗を確認できるまでPromiseを解決しない。

共通処理は報酬を直接付与しない。ゲーム側が有効な同一セッションの `rewarded` のみ
1回受け取る。中断、画面遷移、主人公や探索の置換後の完了通知は無効。
広告中は `gamePaused()` でゲーム進行を止める。元のポーズ状態は上書きしない。
CrazyGames 接続では音声の一時ミュートとSDKの muteAudio 設定、gameplayStart/Stop の状態遷移を実装済み。
同意UI・配信設定は配信サービスの正式な組み込み要件に従い、公開前にプレビューで確認する。

## 公開先決定後

1. 配信サービスの開発者登録・ゲーム登録・公開条件を確認する。
2. SDKの初期化と上記adapterを追加する（配信失敗をテスト広告へ代替しない）。
3. 公式のテスト広告で視聴完了、中断、広告なし、ブロッカー、通信障害を検証する。
4. 実バナーはサービスの対応形式と配置条件を確認して別途接続する。

現状はクライアント側の誤操作・非同期競合対策であり、不正改造対策やサーバー検証ではない。

## 検証

- `node proto/ads-provider-test.mjs`：結果正規化、例外、重複、中断、タイムアウト、遅延通知。
- `node proto/ads-integration-test.mjs`：ゲームとの接続、報酬1回、失敗時無消費、
  モーダル復帰、画面遷移後の無効化、公開URLでのダミー無効化。
- `node proto/adtest.mjs`：既存の広告・報酬のタップ操作回帰。

## CrazyGames 開発時の使い方

リポジトリのルートで次を実行する。

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory proto
```

`http://localhost:8767/index.html?ads=crazygames` を開く。
公式CDNから `https://sdk.crazygames.com/crazygames-sdk-v3.js` を読み込み、
`SDK.init()` 完了後に `environment` が local / crazygames の場合だけ利用する。
localhost の公式SDKは5秒の「A rewarded ad would appear here」表示であり、
実動画や収益は発生しない。無料ガチャ枠が残っている場合、最初の1回は広告を通らない。
URLに指定しなければ、従来のオフライン用ダミーを維持する。
スマホなど別IPのローカル確認は `?ads=crazygames&useLocalSdk=true` で公式SDKのlocal環境を明示できる。

- SDK完了通知 `adFinished` のみ報酬に変換。`requestAd()` 自体のPromise解決では付与しない。
- `unfilled` / `adblock` / `adCooldown` は広告利用不可として復帰。
- `adsDisabledBasicLaunch` を受信したら、そのページでは広告専用ボタンを隠す。無料ガチャは残す。
  初回要求前にBasic Launchを判定する仕組みは未実装。提出用では事前に広告UIを無効にする設定が別途必要。
- ロード・初期化は各15秒で失敗扱い。広告SDKの終端通知がない場合は要求から120秒で復帰。
- ゲーム側の受け取り中止・画面遷移ではSDKの広告自体を閉じられない。
  報酬権だけ失効させ、SDKの終了通知または120秒の監視期限までゲーム停止・消音を維持する。
- 広告中に音設定をONにしても消音を維持し、ユーザーの保存済み音量設定は上書きしない。
- SDKの広告表示中は独自広告窓と音設定UIを隠し、SDK表示に重ねない。
- `ABYSS_CRAZYGAMES.inspect()` で接続状態、環境、広告表示中、最後のエラーコードを確認できる。

### 検証と残作業

`node proto/ads-crazygames-test.mjs` はブラウザで公式CDNへアクセスし、公式local表示を検証する。
第1引数に公式CDNから取得したSDKファイルを渡すと、その内容をブラウザへ供給して同じ検証を行う。
2026-10-09は公式CDNから取得したv3を用い、local表示・完了後1回付与を確認。
エラー、重複通知、中断後完了、SDK無効／ロード失敗、音設定、Basic Launch通知はSDKを模した自動テスト。
実動画、開発者ポータルのPreview、スマホ実機でのSDK広告、実バナーは未検証・未接続。

提出前には英語化、Basic Launch用の広告UI切替、SDKのロード計測／保存要件などを別途確認する。
今回の実装は開発中のリワード広告接続であり、Full Implementation審査の全要件を満たしたという意味ではない。

公式資料（2026-10-09確認）：
- https://docs.crazygames.com/sdk/intro/
- https://docs.crazygames.com/sdk/video-ads/
- https://docs.crazygames.com/sdk/game/
