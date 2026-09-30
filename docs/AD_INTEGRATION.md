# 広告接続（2026-09-27）

## 現状

広告会社との接続は未実施。`proto/ads.js` が共通ライフサイクルを管理し、
`proto/index.html` がゲーム画面の退避・復帰と報酬を扱う。
ガチャ (`gacha`)、仲間の蘇生 (`revive`)、階段での回復 (`heal`)、
死亡時の引き継ぎ (`inherit`) を接続済み。報酬内容・確率・上限は変更していない。

file URL と localhost / 127.0.0.1 / ::1 では5秒のテスト広告を自動設定する。
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
SDK固有の音声ミュート／復帰・gameplayイベント・同意UIは各サービス接続時に実装する。

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
