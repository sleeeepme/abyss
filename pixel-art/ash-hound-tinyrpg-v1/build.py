from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite


ROOT = Path(__file__).resolve().parent
QUALITY = ROOT / "quality"
QUALITY.mkdir(parents=True, exist_ok=True)
BASE = ROOT.parent / "tiny-rpg-dog-reconstruction-v1" / "tiny-rpg-dog-32.png"

OLD = [
    "#060102", "#2e1418", "#282124", "#3c3037", "#763339", "#514446",
    "#96403a", "#824642", "#b5695b", "#ae726a", "#c08e7c",
]

# Same eleven color roles as the benchmark, redirected to ABYSS's ash, bone,
# cold shadow, dull ember, and amber-eye materials.
ASH = [
    "#100d15",  # 0 exterior / cavity
    "#211723",  # 1 warm deep shadow
    "#252534",  # 2 cold shadow
    "#3a3945",  # 3 charcoal base
    "#55272a",  # 4 mouth shadow
    "#55545e",  # 5 ash light / ground shadow
    "#8f4930",  # 6 ember
    "#817865",  # 7 bone shadow
    "#b8673d",  # 8 mouth light
    "#b9ad91",  # 9 bone
    "#e0d4b5",  # A bone highlight
]

OUTLINE, DEEP, COLD, BODY, MOUTH_DARK, ASH_LIGHT, EMBER, BONE_DARK, MOUTH_LIGHT, BONE, BONE_LIGHT = ASH
AMBER = "#d99a3b"


def mapped_base() -> Sprite:
    sprite = Sprite.from_png(BASE, scale=1)
    for old, new in zip(OLD, ASH):
        sprite.replace(old, new)
    sprite.set_palette(ASH + [AMBER], snap=True)
    return sprite


def common_ash_details(sprite: Sprite) -> None:
    # Desaturate the old tail wounds into broken ash/bone clusters.
    tail_non_outline = {BONE_LIGHT, BONE, BONE_DARK, MOUTH_LIGHT, EMBER, MOUTH_DARK}
    for y in range(5, 9):
        for x in range(2, 11):
            current = sprite.get(x, y)
            if current and "#%02x%02x%02x" % current[:3] in tail_non_outline:
                sprite.px(x, y, BONE_DARK)
    for x, y in [(5, 6), (9, 6)]:
        sprite.px(x, y, BONE)

    # Uneven exposed ribs: three different clusters, never repeated as stripes.
    ribs = {
        BONE_DARK: [(12, 12), (13, 13), (13, 14),
                    (15, 12), (16, 13), (16, 14), (17, 14),
                    (18, 12), (19, 13)],
        BONE: [(13, 12), (14, 13),
               (16, 12), (17, 13),
               (19, 12)],
        BONE_LIGHT: [(13, 12), (16, 12)],
    }
    for color, points in ribs.items():
        for x, y in points:
            if sprite.get(x, y):
                sprite.px(x, y, color)

    # Sparse ash planes along the top; keep them as clusters rather than noise.
    for x, y in [(11, 10), (12, 10), (14, 10), (17, 10), (18, 10), (20, 11)]:
        if sprite.get(x, y):
            sprite.px(x, y, ASH_LIGHT)

    # A single hot eye is the focal pixel. The surrounding cavity stays dark.
    sprite.px(24, 10, AMBER)
    sprite.px(23, 10, OUTLINE)


def variant_a() -> Sprite:
    sprite = mapped_base()
    common_ash_details(sprite)
    return sprite


def variant_b() -> Sprite:
    sprite = mapped_base()
    # Gaunt abdomen: lift the belly between rear and fore legs.
    for x, y in [(13, 16), (14, 16), (15, 16), (16, 16), (17, 16),
                 (14, 17), (15, 17), (16, 17)]:
        sprite.px(x, y, None)
    for x, y in [(13, 15), (14, 15), (15, 15), (16, 15), (17, 15)]:
        sprite.px(x, y, OUTLINE)
    # Raised shoulder and two broken hackles communicate a forward rush.
    for x, y in [(17, 8), (19, 8), (20, 9)]:
        sprite.px(x, y, OUTLINE)
    for x, y in [(17, 9), (18, 9), (19, 9)]:
        sprite.px(x, y, BODY)
    common_ash_details(sprite)
    return sprite


def variant_c() -> Sprite:
    sprite = variant_b()
    # Stronger skull-like muzzle, retaining the benchmark's large mouth block.
    for x, y in [(25, 9), (26, 9), (27, 9), (26, 10), (27, 10)]:
        if sprite.get(x, y):
            sprite.px(x, y, BONE_DARK)
    for x, y in [(26, 9), (27, 9)]:
        sprite.px(x, y, BONE)
    # Break the tail tip once; the negative space reads as a charred split.
    sprite.px(7, 6, None)
    return sprite


def neutral_preview(sprite: Sprite, scale=8) -> Image.Image:
    im = sprite.composite().convert("RGBA")
    bg = Image.new("RGBA", im.size, (83, 82, 86, 255))
    bg.alpha_composite(im)
    return bg.convert("RGB").resize((32 * scale, 32 * scale), Image.Resampling.NEAREST)


def save_stages(sprite: Sprite) -> None:
    im = sprite.composite().convert("RGBA")
    alpha = im.getchannel("A")
    sil = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sil.paste((24, 20, 29, 255), mask=alpha)
    sil.save(QUALITY / "01-silhouette-1x.png")
    flat = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            p = im.getpixel((x, y))
            if not p[3]:
                continue
            if y >= 21 and p[:3] == (85, 84, 94):
                flat.putpixel((x, y), (67, 61, 68, 255))
            elif p[:3] in {(85, 39, 42), (143, 73, 48), (184, 103, 61)}:
                flat.putpixel((x, y), (111, 54, 43, 255))
            elif p[:3] in {(129, 120, 101), (185, 173, 145), (224, 212, 181)}:
                flat.putpixel((x, y), (173, 162, 136, 255))
            else:
                flat.putpixel((x, y), (58, 57, 69, 255))
    flat.save(QUALITY / "02-flat-masses-1x.png")
    for name, stage in [("01-silhouette-8x.png", sil), ("02-flat-masses-8x.png", flat)]:
        bg = Image.new("RGBA", stage.size, (83, 82, 86, 255))
        bg.alpha_composite(stage)
        bg.convert("RGB").resize((256, 256), Image.Resampling.NEAREST).save(QUALITY / name)


def main() -> None:
    variants = [variant_a(), variant_b(), variant_c()]
    sheet = Image.new("RGB", (800, 286), (42, 42, 46))
    draw = ImageDraw.Draw(sheet)
    labels = ["A: faithful ash", "B: gaunt rush", "C: skull/broken tail"]
    for i, (sprite, label) in enumerate(zip(variants, labels)):
        x = 8 + i * 264
        sheet.paste(neutral_preview(sprite), (x, 26))
        draw.text((x, 6), label, fill=(240, 240, 240))
        sprite.save_png(ROOT / f"candidate-{chr(65+i)}-32.png")
    sheet.save(QUALITY / "candidate-sheet.png")

    # B best preserves Tiny RPG's dog grammar while adding ABYSS identity.
    final = variants[1]
    final.save_png(ROOT / "ash-hound-32.png")
    final.save_png(ROOT / "ash-hound-32@8x.png", scale=8)
    neutral_preview(final).save(ROOT / "ash-hound-32-neutral@8x.png")
    save_stages(final)

    pixels = list(final.composite().get_flattened_data())
    report = {
        "canvas": [32, 32],
        "visible_bounds": list(final.composite().getbbox()),
        "visible_colors": len({p[:3] for p in pixels if p[3]}),
        "alpha_values": sorted({p[3] for p in pixels}),
        "native_authored": True,
        "resized_from_source": False,
        "selected_candidate": "B",
        "identity_markers": ["gaunt lifted belly", "exposed uneven ribs", "single amber eye"],
    }
    (QUALITY / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
