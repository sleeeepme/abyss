#!/usr/bin/env python3
"""Finalize an approved water-map concept as a 200x400/16-color pixel asset."""

import argparse
import json
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=200)
    parser.add_argument("--height", type=int, default=400)
    parser.add_argument("--colors", type=int, default=16)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    source_ratio = source.width / source.height
    target_ratio = args.width / args.height
    if source_ratio > target_ratio:
        crop_width = round(source.height * target_ratio)
        left = (source.width - crop_width) // 2
        crop_box = (left, 0, left + crop_width, source.height)
    else:
        crop_height = round(source.width / target_ratio)
        top = (source.height - crop_height) // 2
        crop_box = (0, top, source.width, top + crop_height)

    cropped = source.crop(crop_box)
    logical = cropped.resize((args.width, args.height), Image.Resampling.NEAREST)
    logical = logical.quantize(
        colors=args.colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGBA")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    logical.save(args.output, optimize=True)

    if args.report:
        palette = sorted({pixel[:3] for pixel in logical.get_flattened_data()})
        report = {
            "source": str(args.source.resolve()),
            "source_size": list(source.size),
            "crop_box": list(crop_box),
            "logical_size": [args.width, args.height],
            "resampling": "nearest-neighbor",
            "dithering": "none",
            "visible_color_count": len(palette),
            "palette_rgb": [list(color) for color in palette],
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
