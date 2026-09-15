#!/usr/bin/env python3
"""Build one-pixel rarity-outline overlays from the authoritative 16px icons."""

from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "16px-runtime"
OUTPUT = ROOT / "rarity-outlines"
TIERS = (
    ("common", "#171323"),
    ("uncommon", "#6cc24a"),
    ("rare", "#5b8dd6"),
    ("unique", "#a97fe0"),
    ("relic", "#c4433f"),
    ("legend", "#e8c95a"),
)


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    return (*bytes.fromhex(hex_color[1:]), 255)


def boundary_mask(source: Image.Image) -> list[bool]:
    alpha = source.getchannel("A")
    width, height = source.size
    return [
        bool(alpha.getpixel((x, y)))
        and any(
            xx < 0
            or yy < 0
            or xx >= width
            or yy >= height
            or not alpha.getpixel((xx, yy))
            for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
        )
        for y in range(height)
        for x in range(width)
    ]


def main() -> None:
    icons = sorted(SOURCE.glob("*.png"))
    if len(icons) != 20:
        raise SystemExit(f"expected 20 source icons, found {len(icons)}")

    preview = Image.new("RGBA", (len(icons) * 16, len(TIERS) * 16))
    manifest = {"size": [16, 16], "icons": [p.stem for p in icons], "tiers": {}}

    for row, (tier, color) in enumerate(TIERS):
        tier_dir = OUTPUT / tier
        tier_dir.mkdir(parents=True, exist_ok=True)
        manifest["tiers"][tier] = color
        edge_color = rgba(color)

        for column, path in enumerate(icons):
            source = Image.open(path).convert("RGBA")
            if source.size != (16, 16):
                raise SystemExit(f"{path.name}: expected 16x16, got {source.size}")
            mask = boundary_mask(source)
            outline = Image.new("RGBA", source.size)
            outline.putdata([edge_color if edge else (0, 0, 0, 0) for edge in mask])
            outline.save(tier_dir / path.name, optimize=False)

            composite = source.copy()
            composite.alpha_composite(outline)
            preview.alpha_composite(composite, (column * 16, row * 16))

    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    preview.save(OUTPUT / "preview-1x.png", optimize=False)
    preview.resize((preview.width * 4, preview.height * 4), Image.Resampling.NEAREST).save(
        OUTPUT / "preview-4x.png", optimize=False
    )


if __name__ == "__main__":
    main()
