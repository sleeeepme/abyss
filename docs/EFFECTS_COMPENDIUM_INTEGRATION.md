# エフェクト図鑑への新規エフェクト組み込み手順（Codex向け）

2026-09-15 作成。`proto/effects-compendium.html`（＋`proto/effects-compendium-app.js`）にエフェクトを
新規追加・更新するときの手順。見た目の実装は引き続きCodex側の担当（`AGENTS.md`の分業どおり）。

## 全体構成

```
proto/
  ally-effect-study.js        ← 最初に読み込む。通常攻撃の描画本体・属性ヒット・武器別パラメータ(fx.weapons)を提供
  weapon-effect-gallery.js    ← 通常攻撃プレビュー。scene(ctx, kind, age, opts) を公開
  weapon-art-effect-study.js  ← 武器技プレビュー。scene(ctx, key, age) を公開（AllyEffectStudyより後で読み込む）
  effects-compendium-app.js   ← 一覧ページ本体（カテゴリ・検索・ステータス管理・プレビュー描画ループ）
  effects-compendium.html     ← 上記4本をこの順で<script src>する薄いシェル。シムなし・本物をそのまま読む
```

スクリプトの読み込み順は固定（`weapon-art-effect-study.js`は先頭で
`if(!window.AllyEffectStudy) throw Error('AllyEffectStudy must load first')`しているため、
順番を崩すとページ全体が起動しない）。

## `effects-compendium-app.js` の `ITEMS` 配列

先頭付近にカテゴリ横断で1エフェクト=1オブジェクトのフラット配列がある。

```js
{id:"a-sword-1", cat:"arts", group:"剣", name:"居合", meta:"lv1 ／ dash",
 desc:"踏み込み斬り", status:"done", preview:{type:"art", key:"iai"}}
```

- `id` … 一意なslug。ステータス上書き（localStorage）のキーにもなるので**後から変えない**。
- `cat` … `normal` / `arts` / `ult` / `skill` / `enemy`（`CATS`配列で定義。増やすときはそちらも編集）。
- `status` … `"done"` か `"todo"`。閲覧者側のトグルで上書きできるが、ソース側の初期値もここで管理する。
- `preview` … 省略可。実機コードで再生できるものだけ付ける（下記）。

## プレビューを付ける（＝実機コードで再現させる）

`preview.type` は現状2種類。**新しい`type`を増やすときは`effects-compendium-app.js`の`makePreview()`側の
対応も必要**（後述）。

### `type: "normal"`（通常攻撃）
`window.WeaponEffectGallery.scene(ctx, key, age, {hit, element, elementHit})` を呼ぶ。
`key`は`window.AllyEffectStudy.weapons`のキーと一致していないと描画されない
（現状: `swordaxe` `greatsword` `dagger` `spear` `bow` `hammer` `magicbolt`）。
新しい武器種を`ally-effect-study.js`の`weapons`に追加したら、`key`をそのまま使えばプレビューに出る。
1サイクル＝1.0秒固定で無限ループ。属性チップ（無/炎/雷/冷気/魔法）は一覧側が自動で出す。

### `type: "art"`（武器技・崩落）
2026-09-23 から `window.PixelArtFx.scene(ctx, key, age)`（`weapon-art-pixel.js`）を呼ぶ。1サイクルは
`PixelArtFx.timeline(key).loop`。技そのものを足す手順は `docs/WEAPON_ART_PIXEL.md` の「技を足すとき」。
以下は PixelArtFx が無いときの旧経路：`window.WeaponArtEffectStudy.scene(ctx, key, age)` を呼ぶ。`key`は`weapon-art-effect-study.js`内の
`renderers`（＝`defs`のキー）と一致させる。1サイクルの長さは`window.WeaponArtEffectStudy.duration`
（現状全技共通1.4秒）をそのまま使っているので、技ごとに尺が違う場合はここを可変にする変更が要る。

### 大技・スキル・敵の攻撃（`ult` / `skill` / `enemy`）
現時点でプレビュー未対応（`preview`を付けずに`status:"todo"`のまま一覧にだけ出ている）。
実装する際は：

1. 描画本体をどのファイルに置くか決める（既存の2ファイルに関数を足すか、新しいstudyファイルを作るか）。
2. 新しい`window.XxxStudy.scene(ctx, key, age)`のような公開APIを用意する
   （キャンバスは320×170、`age`はそのプレビューの経過秒、というのが既存2種の暗黙の契約）。
3. `effects-compendium-app.js`の`makePreview()`に`else if (item.preview.type === "ult" && ...)`のような
   分岐を追加し、`<script src>`を`effects-compendium.html`に足す。
4. `ITEMS`の該当行に`status:"done"`と`preview:{type:"...", key:"..."}`を付ける。

## 反映後にやること

- `docs/EFFECTS_COMPENDIUM.md`（Markdown一覧表）の該当行を`[未]`→`[済]`に直す。
- claude.ai側の「エフェクト図鑑」アーティファクト（Claude管理）は`proto/`とは別ファイルなので、
  自動では同期されない。反映してほしい場合はClaudeに一言頼めば、変更後の`proto/`側の内容を
  見て作り直してくれる。
