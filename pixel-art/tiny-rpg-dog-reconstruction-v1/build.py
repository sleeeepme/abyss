from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite


ROOT = Path(__file__).resolve().parent
QUALITY = ROOT / "quality"
QUALITY.mkdir(exist_ok=True)

# Reconstructed from the user-provided 4x JPEG preview. Similar JPEG shades were
# merged into functional clusters so that compression noise does not become art.
PALETTE = [
    "#060102",  # exterior outline / deepest cavity
    "#2e1418",  # deep warm shadow
    "#282124",  # body shadow
    "#3c3037",  # body base
    "#763339",  # mouth red shadow
    "#514446",  # body light / cast shadow
    "#96403a",  # mouth red
    "#824642",  # muted red-brown
    "#b5695b",  # lit mouth
    "#ae726a",  # warm transition
    "#c08e7c",  # tooth / hot highlight
]

CHARS = "0123456789A"
SOURCE_ROWS_32X24 = [
    "................................",
    "................................",
    "......00..000...................",
    ".....0A0.08A0.......000..00.....",
    "....090.0940........0550.050....",
    "....040.040....0..0.02350200000.",
    "....0140020..0.20.50003535555530",
    "....02222000..022255331135515.32",
    ".....000255500233333331431541512",
    "........000002333333333307164040",
    "............03233333333308686440",
    "...........02233333332330A817142",
    "...........023333323202331131513",
    "...........023002203200233555550",
    "..........0230.2000230.00000000.",
    "..........0230.20.030..0220.....",
    "...........03052050305550205....",
    ".........550305205030555020555..",
    "........55555555555555555555555.",
    ".........555555555555555555555..",
    "...........55555555555555555....",
    "................................",
    "................................",
    "................................",
]


def draw_indexed_sprite() -> Sprite:
    sprite = Sprite(32, 32, palette=PALETTE)
    # Center the 28px-wide recovered body inside the 32px game cell.
    for source_y, row in enumerate(SOURCE_ROWS_32X24):
        for source_x, symbol in enumerate(row):
            if symbol == ".":
                continue
            x = source_x - 2
            y = source_y + 3
            if 0 <= x < 32 and 0 <= y < 32:
                sprite.px(x, y, PALETTE[CHARS.index(symbol)])
    return sprite


def rgba_frame(sprite: Sprite) -> Image.Image:
    return sprite.composite().convert("RGBA")


def composite_neutral(image: Image.Image, size=8) -> Image.Image:
    bg = Image.new("RGBA", image.size, (110, 110, 110, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB").resize(
        (image.width * size, image.height * size), Image.Resampling.NEAREST
    )


def silhouette(image: Image.Image) -> Image.Image:
    a = image.getchannel("A")
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.paste((30, 23, 31, 255), mask=a)
    return out


def flat_masses(image: Image.Image) -> Image.Image:
    src = image.load()
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    dst = out.load()
    mouth = {PALETTE[i].lower() for i in (4, 6, 7, 8, 9, 10)}
    for y in range(image.height):
        for x in range(image.width):
            if src[x, y][3] == 0:
                continue
            hx = "#%02x%02x%02x" % src[x, y][:3]
            if y >= 21 and hx == PALETTE[5]:
                dst[x, y] = (81, 68, 70, 255)  # cast shadow
            elif hx in mouth:
                dst[x, y] = (130, 54, 55, 255)  # mouth / tail scars
            else:
                dst[x, y] = (60, 48, 55, 255)  # body
    return out


def main() -> None:
    sprite = draw_indexed_sprite()
    sprite.save_png(ROOT / "tiny-rpg-dog-32.png")
    image = rgba_frame(sprite)
    image.resize((256, 256), Image.Resampling.NEAREST).save(
        ROOT / "tiny-rpg-dog-32@8x.png"
    )
    composite_neutral(image).save(ROOT / "tiny-rpg-dog-32-neutral@8x.png")

    sil = silhouette(image)
    flat = flat_masses(image)
    sil.save(QUALITY / "01-silhouette-1x.png")
    flat.save(QUALITY / "02-flat-masses-1x.png")
    composite_neutral(sil).save(QUALITY / "01-silhouette-8x.png")
    composite_neutral(flat).save(QUALITY / "02-flat-masses-8x.png")

    # Reference grid was recovered from a JPEG, then quantized to this same fixed
    # palette. Structural match is exact to that recoverable logical grid.
    ref24 = Image.open(QUALITY / "quant-11.png").convert("RGBA")
    ref32 = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    ref32.alpha_composite(ref24, (-2, 3))
    ref_preview = composite_neutral(ref32)
    out_preview = composite_neutral(image)
    comparison = Image.new("RGB", (540, 290), (46, 46, 49))
    comparison.paste(ref_preview, (8, 26))
    comparison.paste(out_preview, (276, 26))
    d = ImageDraw.Draw(comparison)
    d.text((8, 6), "recovered reference grid", fill=(240, 240, 240))
    d.text((276, 6), "code-authored reconstruction", fill=(240, 240, 240))
    comparison.save(ROOT / "comparison.png")

    # Independent visual comparison against the actual JPEG pixels, before
    # logical-grid recovery and palette consolidation.
    source_path = Path(
        "/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/"
        "E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg"
    )
    source_jpeg = Image.open(source_path).convert("RGB").crop((13, 196, 141, 292))
    source_jpeg = source_jpeg.resize((256, 192), Image.Resampling.NEAREST)
    rendered_24 = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    rendered_24.alpha_composite(image, (2, -3))
    rendered_24 = composite_neutral(rendered_24)
    jpeg_comparison = Image.new("RGB", (540, 226), (46, 46, 49))
    jpeg_comparison.paste(source_jpeg, (8, 26))
    jpeg_comparison.paste(rendered_24, (276, 26))
    jd = ImageDraw.Draw(jpeg_comparison)
    jd.text((8, 6), "original JPEG display", fill=(240, 240, 240))
    jd.text((276, 6), "11-color logical reconstruction", fill=(240, 240, 240))
    jpeg_comparison.save(ROOT / "comparison-to-source-jpeg.png")

    ref_pixels = list(ref32.get_flattened_data())
    out_pixels = list(image.get_flattened_data())
    structural_mismatch = sum(
        (a[3] > 0) != (b[3] > 0) for a, b in zip(ref_pixels, out_pixels)
    )
    exact_rgba_mismatch = sum(a != b for a, b in zip(ref_pixels, out_pixels))
    report = {
        "canvas": [32, 32],
        "visible_bounds": list(image.getbbox()),
        "visible_colors": len({p[:3] for p in out_pixels if p[3]}),
        "alpha_values": sorted({p[3] for p in out_pixels}),
        "reference_display_scale": 4,
        "reference_source": "user-provided JPEG preview",
        "structural_pixel_mismatch_vs_recovered_grid": structural_mismatch,
        "rgba_pixel_mismatch_vs_quantized_recovered_grid": exact_rgba_mismatch,
        "note": "Original paid PNG/Aseprite data was not available; JPEG colors were consolidated into 11 functional colors.",
    }
    (QUALITY / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
