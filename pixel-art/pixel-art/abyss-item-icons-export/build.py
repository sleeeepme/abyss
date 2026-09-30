#!/usr/bin/env python3
"""Inspect the user-edited 16 px item icons before runtime import."""

from pathlib import Path
import json
import sys

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "16px-runtime"
NAMES = [
    "sword", "great", "dagger", "spear", "mace",
    "axe", "bow", "staff", "potion", "vial",
    "leaf", "armor", "chain", "plate", "robe",
    "buckler", "tower", "ring", "amulet", "bag",
]

board = Sprite(80, 64, snap=False)
report = {}
for index, name in enumerate(NAMES):
    path = SOURCE / f"{name}.png"
    icon = Sprite.from_png(str(path), scale=1)
    stats = icon.stats(print_=False)
    report[name] = {
        "size": list(stats["size"]),
        "colors": stats["colors_used"],
        "semi_alpha_px": stats["semi_alpha_px"],
        "isolated_px": stats["isolated_px"],
    }
    board.paste_png(str(path), (index % 5) * 16, (index // 5) * 16)

board.preview(str(ROOT / "preview.png"), scale=9, bg="checker", grid=True, labels=False)
board.save_silhouette(str(ROOT / "silhouette.png"), scale=9)
(ROOT / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
