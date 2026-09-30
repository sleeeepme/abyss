"""Pixel Art Studio source for the hero-scout idle and walk experiment.

The game asset is already a 4x export of a 16x16 sprite. This file recovers that
grid, preserves its palette, and rebuilds every animated cell through Studio layers.
"""

from pathlib import Path
import sys

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite, rgba2hex


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "proto/assets/sprites/characters/hero/scout-right-idle.png"
OUT = Path(__file__).resolve().parent
GRID = 16
DISPLAY_SCALE = 12
HIP_Y = 9
LEG_Y = 11


def stamp_rows(canvas, source, layer, x0, y0, x1, y1, dx=0, dy=0):
    """Copy a source rectangle onto one Studio layer using hard 1px cells."""
    canvas.use(layer=layer)
    for y in range(y0, y1):
        for x in range(x0, x1):
            color = source.get(x, y)
            if color:
                canvas.px(x + dx, y + dy, color)


def draw_pose(canvas, source, upper_y=0, left_leg_y=0, right_leg_y=0):
    """Puppet parts around the fixed belt; no pixels are interpolated."""
    # Outer 4px strips carry the weapon and arms as one continuous, torso-attached layer.
    stamp_rows(canvas, source, "outer", 0, 0, 4, GRID, 0, upper_y)
    stamp_rows(canvas, source, "outer", 12, 0, GRID, GRID, 0, upper_y)
    # Dragon Quest-style step: only the central leg blocks move vertically.
    stamp_rows(canvas, source, "legs", 4, LEG_Y, 8, GRID, 0, left_leg_y)
    stamp_rows(canvas, source, "legs", 8, LEG_Y, 12, GRID, 0, right_leg_y)
    # The torso carries head and body. Its lower row overlaps the stable belt.
    stamp_rows(canvas, source, "torso", 4, 0, 12, HIP_Y + 1, 0, upper_y)
    # A stable belt prevents a transparent seam during the upward body bob.
    stamp_rows(canvas, source, "belt", 4, HIP_Y, 12, LEG_Y)


def make_animation():
    # This is an existing asset, not a palette replacement: retain every source color.
    source = Sprite.from_png(SOURCE, scale=4)
    if (source.w, source.h) != (GRID, GRID):
        raise ValueError(f"Expected a {GRID}x{GRID} source grid, got {source.w}x{source.h}")
    palette = [rgba2hex(color + (255,)) for color in source.used_colors().keys()]

    animation = Sprite(GRID, GRID, palette=palette)
    animation.layer("outer")
    animation.layer("legs")
    animation.layer("torso")
    animation.layer("belt")

    # Idle: +1px low -> -1px high -> high -> low.
    # Walk: stable width; the left and right legs trade vertical positions.
    poses = [
        {"upper_y": 1},
        {"upper_y": -1},
        {"upper_y": -1},
        {"upper_y": 1},
        {"upper_y": 1, "left_leg_y": 0, "right_leg_y": 0},
        {"upper_y": 0, "left_leg_y": -1, "right_leg_y": 1},
        {"upper_y": 1, "left_leg_y": 0, "right_leg_y": 0},
        {"upper_y": 0, "left_leg_y": 1, "right_leg_y": -1},
    ]
    for frame_number, pose in enumerate(poses, start=1):
        if frame_number > 1:
            animation.add_frame(copy=False)
        draw_pose(animation, source, **pose)

    animation.set_duration(320, frames=[1, 2, 3, 4])
    animation.set_duration(120, frames=[5, 6, 7, 8])
    animation.tag("idle", 1, 4)
    animation.tag("walk", 5, 8)
    return animation


def main():
    animation = make_animation()
    animation.save_png(OUT / "hero-scout-idle-1x.png", frame=1)
    animation.save_png(OUT / "hero-scout-walk-contact-1x.png", frame=5)
    # Preserve the first experiment's review-file names, but regenerate them through Studio.
    animation.save_png(OUT / "idle-preview.png", frame=1, scale=DISPLAY_SCALE)
    animation.save_png(OUT / "walk-contact-preview.png", frame=5, scale=DISPLAY_SCALE)
    animation.save_gif(OUT / "hero-scout-idle.gif", scale=DISPLAY_SCALE, tag="idle")
    animation.save_gif(OUT / "hero-scout-walk.gif", scale=DISPLAY_SCALE, tag="walk")
    # Opaque display copies make human review reliable in viewers that show transparent GIFs as magenta.
    animation.save_gif(OUT / "hero-scout-idle-preview.gif", scale=DISPLAY_SCALE,
                       tag="idle", bg="#263041")
    animation.save_gif(OUT / "hero-scout-walk-preview.gif", scale=DISPLAY_SCALE,
                       tag="walk", bg="#263041")
    animation.save_gif(OUT / "hero-scout-motion-test.gif", scale=DISPLAY_SCALE,
                       tag="walk", bg="#263041")
    animation.save_spritesheet(
        OUT / "hero-scout-motion-sheet.png", layout="horizontal", scale=1, padding=1
    )
    animation.save_spritesheet(
        OUT / "motion-strip.png", layout="horizontal", scale=DISPLAY_SCALE, padding=0,
        json_path=None
    )
    animation.preview(OUT / "motion-preview.png", scale=DISPLAY_SCALE, bg="#263041", grid=True)
    animation.save_silhouette(OUT / "walk-silhouette.png", frame=5, scale=DISPLAY_SCALE)
    animation.zoom(OUT / "walk-zoom.png", 0, 0, GRID - 1, GRID - 1, frame=5,
                   scale=DISPLAY_SCALE, bg="#263041")
    animation.stats()


if __name__ == "__main__":
    main()
