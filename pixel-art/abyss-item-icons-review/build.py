#!/usr/bin/env python3
"""Pixel Art Studio audit board for ABYSS's code-authored item icons.

`proto/item-icons.js` remains the runtime source of truth. This workbench imports
its deterministic 1x PNG exports, measures them, and produces a common 24 px grid
for the required see -> critique -> fix loop.
"""

from pathlib import Path
import json
import sys

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "proto" / "assets" / "item-icons"
OUT = Path(__file__).resolve().parent
RUNTIME = OUT / "runtime-16"
NAMES = [
    "sword", "great", "dagger", "spear", "mace",
    "axe", "bow", "staff", "potion", "vial",
    "leaf", "armor", "chain", "plate", "robe",
    "buckler", "tower", "ring", "amulet", "bag",
]


def main():
    # Five columns keep related silhouettes aligned at true 24 px density.
    board = Sprite(120, 96, snap=False)
    report = {}
    for index, name in enumerate(NAMES):
        path = ASSETS / f"{name}.png"
        icon = Sprite.from_png(str(path), scale=1)
        stats = icon.stats(print_=False)
        report[name] = {
            "colors": stats["colors_used"],
            "semi_alpha_px": stats["semi_alpha_px"],
            "isolated_px": stats["isolated_px"],
            "near_duplicate_colors": stats["near_duplicate_colors"],
        }
        board.paste_png(str(path), (index % 5) * 24, (index // 5) * 24)

    board.save_png(str(OUT / "master-1x.png"), scale=1)
    board.preview(str(OUT / "preview.png"), scale=6, bg="checker", grid=True, labels=False)
    board.save_silhouette(str(OUT / "silhouette.png"), scale=6)
    board.stats()
    (OUT / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    runtime_board = Sprite(80, 64, snap=False)
    runtime_report = {}
    for index, name in enumerate(NAMES):
        path = RUNTIME / f"{name}.png"
        icon = Sprite.from_png(str(path), scale=1)
        stats = icon.stats(print_=False)
        runtime_report[name] = {
            "colors": stats["colors_used"],
            "semi_alpha_px": stats["semi_alpha_px"],
            "isolated_px": stats["isolated_px"],
            "near_duplicate_colors": stats["near_duplicate_colors"],
        }
        runtime_board.paste_png(str(path), (index % 5) * 16, (index // 5) * 16)
    runtime_board.save_png(str(OUT / "runtime-master-1x.png"), scale=1)
    runtime_board.preview(str(OUT / "runtime-preview.png"), scale=9, bg="checker", grid=True, labels=False)
    runtime_board.save_silhouette(str(OUT / "runtime-silhouette.png"), scale=9)
    (OUT / "runtime-report.json").write_text(
        json.dumps(runtime_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
