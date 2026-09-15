# ABYSS アイテムアイコン透過PNG

- `16px-runtime/`：ゲーム内表示と今後の修正に使う16×16px正本。RGBA透過PNG。
- `rarity-outlines/`：正本の外周セルから生成した、6レアリティ×20種の輪郭専用透過PNG。
- `24px-master/`：以前の24×24px版。比較用に残しているが、現在の正本ではない。

両フォルダのファイル名は共通です。

`sword`, `great`, `dagger`, `spear`, `mace`, `axe`, `bow`, `staff`,
`potion`, `vial`, `leaf`, `armor`, `chain`, `plate`, `robe`, `buckler`,
`tower`, `ring`, `amulet`, `bag`

修正は `16px-runtime/` に行い、次のコマンドで輪郭を再生成します。

```sh
python3 build-rarity-outlines.py
```

輪郭色は Common=黒、Uncommon=緑、Rare=青、Unique=紫、Relic=赤、Legend=金です。
