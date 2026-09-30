#!/usr/bin/env python3
"""Direct extraction of the Firewyrm breath frames F32-F46."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, shutil

HERE = Path(__file__).resolve().parent
OUT = HERE / "generated"
REF = HERE / "reference"
SOURCE = REF / "firewyrm-source.gif"
RUNTIME = HERE.parents[1] / "proto" / "assets" / "effects" / "weapon-art-v34" / "flame-breath"
BG = (4, 50, 71)
BOX = (68, 62, 110, 104)
SOURCE_FRAMES = list(range(32, 47))


def belongs_to_flame(x, y, rgb):
    if rgb == BG:
        return False
    r, g, b = rgb
    # Exclude the dragon's purple and magenta clusters. The flame's reds have
    # almost no blue; its neutral greys belong to the hot smoke/floor plume.
    if b >= 35 and r > g * 1.7 and b > g * 1.45:
        return False
    # At the contact edge, a small spatial cut separates the dragon's jaw,
    # foreleg and belly from the connected breath without altering fire pixels.
    if y < 68 and x < 75:
        return False
    if y >= 92 and x < 76:
        return False
    return x >= 68


def extract_frame(source, frame_no):
    source.seek(frame_no)
    logical = source.convert("RGB").resize((110, 110), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (BOX[2] - BOX[0], BOX[3] - BOX[1]))
    for y in range(BOX[1], BOX[3]):
        for x in range(BOX[0], BOX[2]):
            rgb = logical.getpixel((x, y))
            if belongs_to_flame(x, y, rgb):
                out.putpixel((x - BOX[0], y - BOX[1]), (*rgb, 255))
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if RUNTIME.exists():
        shutil.rmtree(RUNTIME)
    RUNTIME.mkdir(parents=True)
    source = Image.open(SOURCE)
    frames = [extract_frame(source, n) for n in SOURCE_FRAMES]
    durations = [70] * len(frames)
    for i, frame in enumerate(frames):
        frame.save(RUNTIME / f"frame-{i:02d}.png")

    scale = 6
    preview = []
    for frame in frames:
        large = frame.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)
        bg = Image.new("RGBA", large.size, (*BG, 255))
        bg.alpha_composite(large)
        preview.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=32))
    preview[0].save(OUT / "firewyrm-breath-exact.gif", save_all=True,
                    append_images=preview[1:], duration=durations, loop=0,
                    optimize=False, disposal=2)

    cols = 5
    cw, ch = frames[0].width * scale, frames[0].height * scale + 20
    sheet = Image.new("RGB", (cols * cw, 3 * ch), BG)
    draw = ImageDraw.Draw(sheet)
    for i, frame in enumerate(frames):
        x, y = i % cols * cw, i // cols * ch
        large = frame.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)
        sheet.paste(large, (x, y), large)
        draw.text((x + 3, y + frame.height * scale + 2), f"SOURCE F{SOURCE_FRAMES[i]:02d} 70ms", fill="white")
    sheet.save(OUT / "all-frames.png")

    raw = [frame.tobytes() for frame in frames]
    used = sorted({p for frame in frames for p in frame.getdata() if p[3]})
    stats = {
        "source": "firewyrm-source.gif",
        "source_size": list(source.size),
        "source_total_frames": source.n_frames,
        "source_frames_used": SOURCE_FRAMES,
        "frames": len(frames),
        "logical_size": list(frames[0].size),
        "duration_ms_each": 70,
        "duration_ms_total": sum(durations),
        "colors_used": len(used),
        "semi_alpha": sum(a not in (0, 255) for frame in frames for a in frame.getchannel("A").getdata()),
        "duplicate_frames": len(frames) - len(set(raw)),
    }
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
