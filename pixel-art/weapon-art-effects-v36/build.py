#!/usr/bin/env python3
"""Direct extraction of the Firewyrm breath frames F32-F46 without smoke; sparks rendered in game layer."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, shutil

HERE = Path(__file__).resolve().parent
OUT = HERE / "generated"
REF = HERE / "reference"
SOURCE = REF / "firewyrm-source.gif"
RUNTIME = HERE.parents[1] / "proto" / "assets" / "effects" / "weapon-art-v36" / "flame-breath"
BG = (4, 50, 71)
BOX = (64, 62, 110, 104)
SOURCE_FRAMES = list(range(32, 47))
FIRE_RED = (191, 0, 0)
FIRE_RED_ORANGE = (233, 49, 0)
FIRE_ORANGE = (255, 144, 0)
FIRE_YELLOW = (255, 252, 46)
FIRE_WHITE = (252, 252, 252)


def belongs_to_flame(x, y, rgb):
    if rgb == BG:
        return False
    r, g, b = rgb
    # Exclude the dragon's purple and magenta clusters. The flame's reds have
    # almost no blue.
    if b >= 35 and r > g * 1.7 and b > g * 1.45:
        return False
    # User-directed V35 change: remove every black/grey smoke cluster while
    # preserving the source fire colors at their original coordinates.
    is_hot = (rgb in (FIRE_RED, FIRE_RED_ORANGE, FIRE_ORANGE, FIRE_YELLOW, FIRE_WHITE)
              or (r >= 150 and r > g * 2.2 and b < 70))
    if not is_hot:
        return False
    # Restore the original four-pixel tapered throat that V35 cropped away.
    # The dragon's bright eye sits above it, so the lower-half gate separates
    # the two without cutting the flame again.
    if x < 68 and y < 84:
        return False
    return x >= 64


def fill_enclosed_smoke_holes(frame):
    """Fill only transparent islands enclosed by fire; exterior smoke stays gone."""
    w, h = frame.size
    px = frame.load()
    exterior = set()
    stack = []
    for x in range(w):
        if px[x, 0][3] == 0: stack.append((x, 0))
        if px[x, h-1][3] == 0: stack.append((x, h-1))
    for y in range(h):
        if px[0, y][3] == 0: stack.append((0, y))
        if px[w-1, y][3] == 0: stack.append((w-1, y))
    while stack:
        x, y = stack.pop()
        if (x, y) in exterior or px[x, y][3] != 0:
            continue
        exterior.add((x, y))
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h:
                stack.append((nx, ny))
    holes = [(x, y) for y in range(h) for x in range(w)
             if px[x, y][3] == 0 and (x, y) not in exterior]
    for x, y in holes:
        neighbours = [px[nx, ny][:3] for nx, ny in
                      ((x-1,y),(x+1,y),(x,y-1),(x,y+1))
                      if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3]]
        # Inner voids sit in the white/yellow heat core. Prefer the hottest
        # neighbouring value so smoke removal cannot leave a dark cavity.
        if neighbours:
            color = max(neighbours, key=lambda c: c[0] + c[1] + c[2])
            px[x, y] = (*color, 255)


def extract_frame(source, frame_no):
    source.seek(frame_no)
    logical = source.convert("RGB").resize((110, 110), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (BOX[2] - BOX[0], BOX[3] - BOX[1]))
    for y in range(BOX[1], BOX[3]):
        for x in range(BOX[0], BOX[2]):
            rgb = logical.getpixel((x, y))
            if belongs_to_flame(x, y, rgb):
                out.putpixel((x - BOX[0], y - BOX[1]), (*rgb, 255))
    fill_enclosed_smoke_holes(out)
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
    preview[0].save(OUT / "firewyrm-breath-clean.gif", save_all=True,
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
        "change": "source fire geometry retained; all black/grey smoke removed; original tapered throat restored",
    }
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
