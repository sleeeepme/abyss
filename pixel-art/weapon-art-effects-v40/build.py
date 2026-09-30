#!/usr/bin/env python3
"""Direct extraction of the Firewyrm breath frames F32-F46 modular four-direction flame without smoke."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import json, math, shutil

HERE = Path(__file__).resolve().parent
OUT = HERE / "generated"
REF = HERE / "reference"
SOURCE = REF / "firewyrm-source.gif"
RUNTIME = HERE.parents[1] / "proto" / "assets" / "effects" / "weapon-art-v40" / "flame-breath"
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


def split_units(frame):
    """Three exclusive modules whose recomposition is pixel-identical."""
    units = {name: Image.new("RGBA", frame.size) for name in ("throat", "body", "head")}
    for y in range(frame.height):
        for x in range(frame.width):
            pixel = frame.getpixel((x, y))
            if not pixel[3]:
                continue
            name = "throat" if x < 15 else "body" if x < 31 else "head"
            units[name].putpixel((x, y), pixel)
    return units


def compose_units(units):
    out = Image.new("RGBA", next(iter(units.values())).size)
    for name in ("throat", "body", "head"):
        out.alpha_composite(units[name])
    return out


def square_and_turn(frame, direction):
    square = Image.new("RGBA", (46, 46))
    square.alpha_composite(frame, (0, 2))
    # A horizontal mirror preserves gravity: the lower edge stays lower when
    # the cast changes from right to left.  Vertical casts use a deliberately
    # symmetric source, so their cross-section has equal mass on both sides.
    bbox = square.getbbox()
    centered = Image.new("RGBA", square.size)
    if bbox:
        source_mid = (bbox[1] + bbox[3] - 1) / 2
        centered.alpha_composite(square, (0, round(22.5 - source_mid)))
    symmetric = Image.new("RGBA", square.size)
    heat_rank = {
        FIRE_RED: 1, FIRE_RED_ORANGE: 2, FIRE_ORANGE: 3,
        FIRE_YELLOW: 4, FIRE_WHITE: 5,
    }
    for x in range(square.width):
        for y in range(square.height // 2):
            opposite = square.height - 1 - y
            # Vertical casts are area attacks. Compress each source column at
            # the throat and progressively release its full width toward the
            # head, producing a readable fan after the 90-degree turn.
            progress = x / (square.width - 1)
            fan = .22 + .78 * progress ** .72
            distance = 22.5 - y
            sample_distance = distance / fan
            sample_top = round(22.5 - sample_distance)
            sample_bottom = round(22.5 + sample_distance)
            pair = tuple(centered.getpixel((x, sy)) if 0 <= sy < square.height else (0, 0, 0, 0)
                         for sy in (sample_top, sample_bottom))
            pixel = max(pair, key=lambda p: (bool(p[3]), heat_rank.get(p[:3], 0)))
            if pixel[3]:
                symmetric.putpixel((x, y), pixel)
                symmetric.putpixel((x, opposite), pixel)
    return {
        "right": square,
        "up": symmetric.transpose(Image.Transpose.ROTATE_90),
        "left": ImageOps.mirror(square),
        "down": symmetric.transpose(Image.Transpose.ROTATE_270),
    }[direction]


def diagonal_turn(frame, direction):
    """Turn around the emission point so range stays constant on diagonals."""
    base = Image.new("RGBA", (66, 66))
    square = Image.new("RGBA", (46, 46))
    square.alpha_composite(frame, (0, 2))
    base.alpha_composite(square, (10, 10))
    if direction in ("up_right", "up_left"):
        turned = base.rotate(45, resample=Image.Resampling.NEAREST, center=(10, 33))
    else:
        turned = base.rotate(-45, resample=Image.Resampling.NEAREST, center=(10, 33))
    return ImageOps.mirror(turned) if direction.endswith("left") else turned


def spark_layer(frame_index, direction, size=92):
    layer = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(layer)
    age = frame_index * .07
    cx = cy = size / 2
    for i in range(30):
        lane, wave = i % 10, i // 10
        u = lane / 9
        seed = ((i * 43 + 7) % 89) / 89
        birth = .035 + u * .17 + wave * .255
        t = age - birth
        if t < 0 or t > .43:
            continue
        q = t / .43
        raw_x = 5 + u * 79 + math.sin(t * 18 + i) * 2.2
        raw_y = 17 + ((i * 29) % 43) - t * (27 + seed * 21)
        dx, dy = raw_x - 46, raw_y - 46
        tx, ty = {
            "right": (dx, dy), "left": (-dx, dy),
            "up": (dy, -dx), "down": (-dy, dx),
            "up_right": ((dx + dy) / math.sqrt(2), (dy - dx) / math.sqrt(2)),
            "down_right": ((dx - dy) / math.sqrt(2), (dx + dy) / math.sqrt(2)),
            "up_left": (-(dx + dy) / math.sqrt(2), (dy - dx) / math.sqrt(2)),
            "down_left": (-(dx - dy) / math.sqrt(2), (dx + dy) / math.sqrt(2)),
        }[direction]
        x, y = cx + tx, cy + ty
        r = max(.35, (1.45 + seed * .9) * ((1 - q) ** 1.25))
        color = (255, 245, 107, 255) if i % 3 else (255, 255, 255, 255)
        draw.polygon([(round(x-r), round(y)), (round(x), round(y-r*1.75)),
                      (round(x+r), round(y)), (round(x), round(y+r))], fill=color)
    return layer


def glow_composite(sprite, direction, frame_index, panel_size=(220, 180)):
    scale = 2
    sharp = sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST)
    panel = Image.new("RGBA", panel_size, (34, 53, 44, 255))
    x = (panel.width - sharp.width) // 2
    y = (panel.height - sharp.height) // 2
    heat = min(1, frame_index / 2) * (1 - max(0, frame_index - 11) / 4)
    # Broad orange bounce light makes the fire affect the room, instead of
    # reading as a bright sticker over an unchanged background.
    environment = Image.new("RGBA", panel_size)
    ed = ImageDraw.Draw(environment)
    ed.ellipse((x - 34, y - 28, x + 126, y + 120), fill=(255, 91, 20, round(106 * heat)))
    ed.ellipse((x - 22, y + 61, x + 118, y + 111), fill=(255, 152, 39, round(98 * heat)))
    environment = environment.filter(ImageFilter.GaussianBlur(24))
    panel.alpha_composite(environment)
    panel.alpha_composite(sharp, (x, y))
    # These passes intentionally sit in front of the opaque pixel sprite. The
    # hottest clusters therefore bloom as well as lighting the exterior.
    for radius, opacity, color in (
            (24, .72, (255, 74, 12)), (12, .78, (255, 124, 22)),
            (5, .72, (255, 194, 55)), (1.5, .48, (255, 246, 172))):
        a = sharp.getchannel("A").filter(ImageFilter.GaussianBlur(radius))
        a = a.point(lambda v: round(v * opacity))
        glow = Image.new("RGBA", sharp.size, (*color, 255)); glow.putalpha(a)
        panel.alpha_composite(glow, (x, y))
    sparks = spark_layer(frame_index, direction, sharp.width)
    spark_glow = sparks.filter(ImageFilter.GaussianBlur(4.5))
    spark_glow.putalpha(spark_glow.getchannel("A").point(lambda v: round(v * .52)))
    panel.alpha_composite(spark_glow, (x, y))
    panel.alpha_composite(sparks, (x, y))
    return panel


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if RUNTIME.exists():
        shutil.rmtree(RUNTIME)
    RUNTIME.mkdir(parents=True)
    source = Image.open(SOURCE)
    frames = [extract_frame(source, n) for n in SOURCE_FRAMES]
    units = [split_units(frame) for frame in frames]
    rebuilt = [compose_units(parts) for parts in units]
    cardinal = ("right", "up", "left", "down")
    diagonal = ("up_right", "down_right", "down_left", "up_left")
    directions = {name: [square_and_turn(frame, name) for frame in rebuilt]
                  for name in cardinal}
    directions.update({name: [diagonal_turn(frame, name) for frame in rebuilt]
                       for name in diagonal})
    durations = [70] * len(frames)
    for direction, direction_frames in directions.items():
        folder = RUNTIME / direction
        folder.mkdir(parents=True, exist_ok=True)
        for i, frame in enumerate(direction_frames):
            frame.save(folder / f"frame-{i:02d}.png")
    for name in ("throat", "body", "head"):
        folder = RUNTIME / "units" / name
        folder.mkdir(parents=True, exist_ok=True)
        for i, parts in enumerate(units):
            parts[name].save(folder / f"frame-{i:02d}.png")

    scale = 6
    preview = []
    for frame in frames:
        large = frame.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)
        bg = Image.new("RGBA", large.size, (*BG, 255))
        bg.alpha_composite(large)
        preview.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=32))
    preview[0].save(OUT / "firewyrm-breath-modular.gif", save_all=True,
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

    # All eight directions under the same front-composited glow used at runtime.
    direction_preview = []
    order = ("right", "up_right", "up", "up_left", "left", "down_left", "down", "down_right")
    for i in range(len(frames)):
        page = Image.new("RGBA", (880, 360), (16, 23, 19, 255))
        for j, direction in enumerate(order):
            panel = glow_composite(directions[direction][i], direction, i)
            ImageDraw.Draw(panel).text((7, 7), direction.upper(), fill=(235, 241, 232, 255))
            page.alpha_composite(panel, ((j % 4) * 220, (j // 4) * 180))
        direction_preview.append(page.convert("P", palette=Image.Palette.ADAPTIVE, colors=96))
    direction_preview[0].save(OUT / "four-directions-strong-glow.gif", save_all=True,
                              append_images=direction_preview[1:], duration=durations,
                              loop=0, optimize=False, disposal=2)
    direction_preview[0].save(OUT / "eight-directions-front-glow.gif", save_all=True,
                              append_images=direction_preview[1:], duration=durations,
                              loop=0, optimize=False, disposal=2)
    up_preview = [glow_composite(directions["up"][i], "up", i).convert(
        "P", palette=Image.Palette.ADAPTIVE, colors=96) for i in range(len(frames))]
    up_preview[0].save(OUT / "up-front-glow.gif", save_all=True,
                       append_images=up_preview[1:], duration=durations,
                       loop=0, optimize=False, disposal=2)
    peak = Image.new("RGBA", (880, 360), (16, 23, 19, 255))
    for j, direction in enumerate(order):
        panel = glow_composite(directions[direction][6], direction, 6)
        ImageDraw.Draw(panel).text((7, 7), direction.upper(), fill=(235, 241, 232, 255))
        peak.alpha_composite(panel,
                             ((j % 4) * 220, (j // 4) * 180))
    peak.save(OUT / "four-directions-peak.png")
    peak.save(OUT / "eight-directions-peak.png")

    # Source-position view of the three exclusive modules and their exact sum.
    unit_sheet = Image.new("RGB", (46 * 6 * 4, 46 * 6 + 22), BG)
    unit_draw = ImageDraw.Draw(unit_sheet)
    peak_units = units[6]
    for j, name in enumerate(("throat", "body", "head", "recombined")):
        frame = compose_units(peak_units) if name == "recombined" else peak_units[name]
        square = Image.new("RGBA", (46, 46)); square.alpha_composite(frame, (0, 2))
        large = square.resize((46 * 6, 46 * 6), Image.Resampling.NEAREST)
        x = j * 46 * 6
        unit_sheet.paste(large, (x, 0), large)
        unit_draw.text((x + 4, 46 * 6 + 3), name.upper(), fill="white")
    unit_sheet.save(OUT / "unit-breakdown.png")

    raw = [frame.tobytes() for frame in frames]
    used = sorted({p for frame in frames for p in frame.getdata() if p[3]})
    stats = {
        "source": "firewyrm-source.gif",
        "source_size": list(source.size),
        "source_total_frames": source.n_frames,
        "source_frames_used": SOURCE_FRAMES,
        "frames": len(frames),
        "logical_size": list(frames[0].size),
        "direction_cell_sizes": {d: list(directions[d][0].size) for d in directions},
        "directions": list(directions),
        "units": ["throat", "body", "head"],
        "recomposition_mismatched_pixels": sum(
            sum(a != b for a, b in zip(frame.tobytes(), rebuilt_frame.tobytes())) // 4
            for frame, rebuilt_frame in zip(frames, rebuilt)),
        "duration_ms_each": 70,
        "duration_ms_total": sum(durations),
        "colors_used": len(used),
        "semi_alpha": sum(a not in (0, 255) for frame in frames for a in frame.getchannel("A").getdata()),
        "duplicate_frames": len(frames) - len(set(raw)),
        "left_mirror_mismatched_pixels": sum(
            sum(a != b for a, b in zip(ImageOps.mirror(r).tobytes(), l.tobytes())) // 4
            for r, l in zip(directions["right"], directions["left"])),
        "vertical_symmetry_mismatched_pixels": {
            d: sum(sum(a != b for a, b in zip(f.tobytes(), ImageOps.mirror(f).tobytes())) // 4
                   for f in directions[d]) for d in ("up", "down")
        },
        "diagonal_mirror_mismatched_pixels": {
            "up": sum(sum(a != b for a, b in zip(ImageOps.mirror(r).tobytes(), l.tobytes())) // 4
                      for r, l in zip(directions["up_right"], directions["up_left"])),
            "down": sum(sum(a != b for a, b in zip(ImageOps.mirror(r).tobytes(), l.tobytes())) // 4
                        for r, l in zip(directions["down_right"], directions["down_left"])),
        },
        "change": "eight directions including pivot-correct diagonals; glow is baked into GIF over the flame; enemy body emits instead of showing a rectangle",
    }
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
