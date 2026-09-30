#!/usr/bin/env python3
"""Build Flame and original ABYSS Ground Wave sprite animations.

Flame retains pixels extracted from the supplied still. Ground Wave is drawn
from scratch after studying only the reference's rise/hold/crumble timing.
"""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source"
OUT = HERE / "generated"
RUNTIME = HERE.parents[1] / "proto" / "assets" / "effects" / "weapon-art-v15"

EARTH_INPUT = SOURCE / "earth-magic-pack-2-promo.gif"
FLAME_INPUT = SOURCE / "flame-gameplay-reference.jpg"


def ensure_dirs() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)


def trim(im: Image.Image, padding: int = 0) -> Image.Image:
    box = im.getchannel("A").getbbox()
    if not box:
        return Image.new("RGBA", (1, 1))
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0-padding), max(0, y0-padding), min(im.width, x1+padding), min(im.height, y1+padding)))


def extract_earth_frames() -> list[Image.Image]:
    src = Image.open(EARTH_INPUT)
    frames: list[Image.Image] = []
    # Right-hand Earth Wave in the supplied promo. This ROI excludes the spell
    # icon above and the neighbouring column at the left edge.
    roi = (341, 255, 630, 378)
    for i in range(src.n_frames):
        src.seek(i)
        rgb = src.convert("RGB").crop(roi)
        # GIF palette conversion shifts the promo background slightly between
        # encoders, so sample the dominant color from the current frame.
        bg = max(rgb.getcolors(rgb.width*rgb.height), key=lambda item: item[0])[1]
        px = rgb.load()
        rgba = Image.new("RGBA", rgb.size)
        dst = rgba.load()
        for y in range(rgb.height):
            for x in range(rgb.width):
                r, g, b = px[x, y]
                dist = max(abs(r-bg[0]), abs(g-bg[1]), abs(b-bg[2]))
                # Preserve every non-background pixel in the effect, including
                # its near-black outline and isolated debris particles.
                a = 0 if dist <= 7 else 255
                # The promo grid's neighbouring spell-card border touches the
                # ROI at the far left. It is presentation chrome, not Earth Wave.
                if x < 18:
                    a = 0
                dst[x, y] = (r, g, b, a)
        frames.append(rgba)

    # The source GIF begins in the middle of its loop. Rotate it to start from
    # the empty ground, then preserve every original frame in order.
    frames = frames[21:] + frames[:21]

    # One shared crop keeps the travelling wave spatially stable.
    union = Image.new("L", frames[0].size)
    for f in frames:
        union = ImageChops.lighter(union, f.getchannel("A"))
    box = union.getbbox()
    assert box, "Earth Wave extraction produced no pixels"
    x0, y0, x1, y1 = box
    box = (max(0, x0-2), max(0, y0-2), min(frames[0].width, x1+2), min(frames[0].height, y1+2))
    return [f.crop(box) for f in frames]


def original_earth_frames() -> list[Image.Image]:
    """Draw an ABYSS-original, low crawling earth wave.

    The promo is used only to study the broad rise/hold/crumble rhythm.  The
    silhouettes, clusters and palette below are authored from scratch: rounded
    broken plates replace the reference's long orange spear-shaped spikes.
    """
    width, height, ground_y = 152, 52, 44
    # x, width, maximum height, lean, emergence order
    plates = [
        (9, 10, 4, -1, 0), (24, 12, 6, 1, 1), (42, 14, 8, -1, 2),
        (62, 16, 10, 2, 3), (85, 19, 13, -1, 4),
        (111, 22, 17, 2, 5), (140, 26, 22, 1, 6),
    ]
    outline = "#263029"
    deep = "#49483c"
    mid = "#746c50"
    light = "#a89462"
    glint = "#d2bd79"
    crack = "#1a241f"
    frames: list[Image.Image] = []
    for fi in range(31):
        t = fi / 30
        im = Image.new("RGBA", (width, height))
        d = ImageDraw.Draw(im)

        # A thin, branching fissure runs ahead of the lifted plates.
        front = round(min(1, t/.48) * (width-5))
        if t < .77:
            crack_alpha = 255 if t < .60 else round(255*(.77-t)/.17)
            pts = [(3, ground_y), (22, ground_y-1), (40, ground_y+1),
                   (61, ground_y-1), (82, ground_y), (104, ground_y-2),
                   (126, ground_y), (front, ground_y-1)]
            pts = [p for p in pts if p[0] <= front]
            if len(pts) > 1:
                d.line(pts, fill=crack+f"{crack_alpha:02x}", width=2)
            for bx in (35, 76, 118):
                if bx < front:
                    d.line((bx, ground_y, bx+5, ground_y-4-(bx//10)%3), fill=crack+f"{crack_alpha:02x}")

        for x, w, max_h, lean, order in plates:
            start = .035 + order*.052
            local = max(0.0, min(1.0, (t-start)/.13))
            rise = 1-(1-local)**3
            collapse = max(0.0, min(1.0, (t-(.58+order*.018))/.24))
            h = max_h * rise * (1-.78*collapse)
            if h < .75:
                continue
            base_y = ground_y + round(collapse*2)
            top_y = base_y-round(h)
            squash = round(w*(.12*collapse))
            x0, x1 = x-w//2-squash, x+w//2+squash
            # The crown narrows toward the front: small rear chips grow into a
            # large final crag without copying the reference's long spear shape.
            crown = max(3, round(w*(.42-order*.035)))
            tip_x = x + lean + round(order*.32)
            poly = [(x0+3, base_y), (x0, base_y-2), (tip_x-crown, top_y+3),
                    (tip_x-2, top_y), (tip_x+crown, top_y+2),
                    (x1+lean, top_y+5), (x1, base_y-1), (x1-3, base_y+1)]
            d.polygon(poly, fill=outline)
            inner = [(x0+3, base_y-2), (tip_x-crown+2, top_y+4),
                     (tip_x-1, top_y+2), (x1-5+lean, top_y+3),
                     (x1-2, base_y-2), (x1-5, base_y)]
            d.polygon(inner, fill=deep)
            d.polygon([(tip_x-crown+2, top_y+3), (tip_x+crown-2, top_y+3),
                       (x1-9, base_y-3), (x0+7, base_y-3)], fill=mid)
            # Short broken top facets give readable stone volume without long spikes.
            d.line((tip_x-crown+2, top_y+3, tip_x+crown-2, top_y+3), fill=light, width=2)
            if max_h >= 11 and collapse < .45:
                d.point((x0+9+lean, top_y+2), fill=glint)
            d.line((x-2, top_y+3, x+1, base_y-2), fill=deep)

            # During collapse, detach a few square chips from the plate edges.
            if collapse > .08:
                q = (collapse-.08)/.92
                for j in range(2):
                    px = round(x + (j*2-1)*(w*.35+q*(4+j*3)))
                    py = round(top_y + 2 - math.sin(q*math.pi)*(5+j*2) + q*7)
                    size = 2 if j == 0 else 1
                    d.rectangle((px, py, px+size-1, py+size-1), fill=mid if j else light)

        # Low dust pixels trail behind; no soft glow or tall plume.
        if .34 < t < .91:
            fade = 1-abs((t-.63)/.29)
            for j, (px, py) in enumerate(((18,46),(43,47),(71,45),(98,47),(123,46),(145,47))):
                if px < front and (fi+j)%3:
                    a = round(150*max(0,fade))
                    d.rectangle((px,py,px+2,py+1), fill=(116,108,80,a))
        frames.append(im)
    return frames


def extract_flame() -> Image.Image:
    # Tight crop around the actual fire; weapon and character remain outside.
    rgb = Image.open(FLAME_INPUT).convert("RGB").crop((42, 104, 124, 222))
    rgba = Image.new("RGBA", rgb.size)
    src = rgb.load(); dst = rgba.load()
    cx, cy = 39, 76
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = src[x, y]
            luminance = .50*r + .42*g + .08*b
            warmth = r - b
            # Luminous yellow/orange fire and its bloom. A soft radial gate
            # removes similarly warm dungeon floor pixels at the crop edges.
            radial = max(0.0, 1.0 - math.sqrt(((x-cx)/48)**2 + ((y-cy)/72)**2))
            signal = max(0.0, min(1.0, (luminance-58)/100)) * max(0.0, min(1.0, (warmth-16)/54))
            a = round(255 * min(1.0, signal*1.8) * min(1.0, radial*3.0))
            if luminance > 185 and warmth > 35:
                a = max(a, 235)
            dst[x, y] = (r, g, b, a)
    # Keep the photographic pixel clusters, but suppress isolated floor noise.
    alpha = rgba.getchannel("A").filter(ImageFilter.MedianFilter(3))
    alpha = alpha.point(lambda p: 0 if p < 22 else min(255, round(p*1.15)))
    rgba.putalpha(alpha)
    return trim(rgba, 3)


def flame_frames(base: Image.Image) -> list[Image.Image]:
    # The reference is a still. Build flicker by moving its real horizontal
    # scanline clusters, so color texture and silhouette remain source-derived.
    shifts = [(-1, 0, 1.00), (0, -1, 1.04), (1, 0, .98), (0, 1, 1.02), (-1, 0, .96), (1, -1, 1.03)]
    out: list[Image.Image] = []
    for fi, (tip_shift, y_shift, height) in enumerate(shifts):
        nh = max(1, round(base.height*height))
        scaled = base.resize((base.width, nh), Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (base.width+8, base.height+8))
        top = 4 + base.height - nh + y_shift
        # Shift upper scanlines farther than the rooted base to mimic flame sway.
        for y in range(nh):
            u = 1-y/max(1, nh-1)
            dx = round(4 + tip_shift*u*u*3 + math.sin((y+fi*3)*.21)*u)
            row = scaled.crop((0, y, scaled.width, y+1))
            canvas.alpha_composite(row, (dx, top+y))
        out.append(canvas)
    return out


def save_sequence(name: str, frames: list[Image.Image], durations: list[int]) -> None:
    folder = OUT / name
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True)
    for i, frame in enumerate(frames):
        frame.save(folder / f"frame-{i:02d}.png")

    runtime_folder = RUNTIME / name
    if runtime_folder.exists():
        shutil.rmtree(runtime_folder)
    runtime_folder.mkdir(parents=True)
    for i, frame in enumerate(frames):
        frame.save(runtime_folder / f"frame-{i:02d}.png")

    w = max(f.width for f in frames); h = max(f.height for f in frames)
    sheet = Image.new("RGBA", (w*len(frames), h))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i*w, h-frame.height))
    sheet.save(OUT / f"{name}-spritesheet.png")
    meta = {"frameWidth": w, "frameHeight": h, "frames": len(frames), "durationsMs": durations}
    (OUT / f"{name}-spritesheet.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # GIF preview on the sample's dark green combat floor.
    previews=[]
    for frame in frames:
        stage=Image.new("RGBA",(w+24,h+24),(16,27,22,255))
        stage.alpha_composite(frame,(12+(w-frame.width)//2,12+h-frame.height))
        previews.append(stage.convert("RGB").resize(((w+24)*3,(h+24)*3),Image.Resampling.NEAREST))
    previews[0].save(OUT/f"{name}-preview.gif",save_all=True,append_images=previews[1:],duration=durations,loop=0,optimize=False,disposal=2)


def make_contact(earth: list[Image.Image], flame: list[Image.Image]) -> None:
    picks_e = [0, 4, 8, 12, 16, 20, 24, 28]
    cell_w, cell_h = 300, 150
    contact = Image.new("RGBA", (cell_w*4, cell_h*3), (16, 27, 22, 255))
    for i, idx in enumerate(picks_e):
        f=earth[min(idx,len(earth)-1)]
        contact.alpha_composite(f, ((i%4)*cell_w+(cell_w-f.width)//2, (i//4)*cell_h+cell_h-f.height-8))
    for i,f in enumerate(flame):
        x=(i%6)*200+(200-f.width)//2
        contact.alpha_composite(f,(x,2*cell_h+cell_h-f.height-8))
    contact.convert("RGB").resize((2400,900),Image.Resampling.NEAREST).save(OUT/"effect-contact.png")


def main() -> None:
    ensure_dirs()
    if not EARTH_INPUT.exists() or not FLAME_INPUT.exists():
        raise SystemExit("Place both reference source files in source/ before building")
    # Keep extract_earth_frames() above as the reproducible reference study.
    # Runtime output uses the original ABYSS redraw.
    earth = original_earth_frames()
    flame = flame_frames(extract_flame())
    save_sequence("earth-wave", earth, [100]*len(earth))
    save_sequence("flame", flame, [90,80,100,80,90,100])
    make_contact(earth, flame)
    print(f"earth-wave: {len(earth)} frames, {earth[0].size}")
    print(f"flame: {len(flame)} frames, {flame[0].size}")


if __name__ == "__main__":
    main()
