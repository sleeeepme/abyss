"""Pixel Art Studio exports for every base 16x16 humanoid character.

The runtime cut lines are mirrored exactly: belt y=9..10 stays fixed while the
two central lower-body blocks trade one logical pixel vertically.  The outer
strips stay attached to the torso so long staffs, swords, and bows never split.
Colour-variant files (``_2`` / ``_3``) are intentionally excluded from exports.
"""

from pathlib import Path
import sys

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCES = sorted(
    path for path in (ROOT / "proto/assets/sprites/characters").glob("**/*-right-idle*.png")
    if not path.stem.endswith(("_2", "_3"))
)
GIFS = OUT / "gifs"
GRID = 16
COLS = 7
HIP_Y = 9
LEG_Y = 11
DISPLAY_SCALE = 12


def stamp(canvas, source, x0, y0, x1, y1, dst_x, dst_y):
    for y in range(y0, y1):
        for x in range(x0, x1):
            color = source.get(x, y)
            if color:
                canvas.px(dst_x + x, dst_y + y, color)


def draw_pose(canvas, source, upper_y=0, left_leg_y=0, right_leg_y=0):
    """Puppet a source sprite using the same layers as the in-game renderer."""
    # Continuous outer strips: weapons and arms always travel with the upper body.
    stamp(canvas, source, 0, 0, 4, GRID, 0, upper_y)
    stamp(canvas, source, 12, 0, GRID, GRID, 0, upper_y)
    # Dragon Quest-style walk: only the central two leg blocks trade vertical positions.
    stamp(canvas, source, 4, LEG_Y, 8, GRID, 0, left_leg_y)
    stamp(canvas, source, 8, LEG_Y, 12, GRID, 0, right_leg_y)
    stamp(canvas, source, 4, 0, 12, HIP_Y + 1, 0, upper_y)
    # A fixed belt closes the bobbing seam in every frame.
    stamp(canvas, source, 4, HIP_Y, 12, LEG_Y, 0, 0)


def animation_for(source):
    """Build the four-frame idle and four-frame walk used in the game."""
    animation = Sprite(GRID, GRID)
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
    for index, pose in enumerate(poses):
        if index:
            animation.add_frame(copy=False)
        draw_pose(animation, source, **pose)
    animation.set_duration(320, frames=[1, 2, 3, 4])
    animation.set_duration(120, frames=[5, 6, 7, 8])
    animation.tag("idle", 1, 4)
    animation.tag("walk", 5, 8)
    return animation


def main():
    GIFS.mkdir(exist_ok=True)
    rows = (len(SOURCES) + COLS - 1) // COLS
    sheet = Sprite(COLS * GRID, rows * GRID)
    for index, path in enumerate(SOURCES):
        source = Sprite.from_png(path, scale=4)
        if (source.w, source.h) != (GRID, GRID):
            raise ValueError(f"{path.name} is not a {GRID}x{GRID} logical sprite")
        ox, oy = (index % COLS) * GRID, (index // COLS) * GRID
        # Write one idle and one walk preview GIF for each base character.
        animation = animation_for(source)
        slug = path.stem.removesuffix("-right-idle")
        animation.save_gif(GIFS / f"{slug}-idle.gif", scale=DISPLAY_SCALE,
                           tag="idle", bg="#263041")
        animation.save_gif(GIFS / f"{slug}-walk.gif", scale=DISPLAY_SCALE,
                           tag="walk", bg="#263041")

        # The sheet remains a one-frame QA contact-pose overview.
        stamp(sheet, source, 0, 0, 4, GRID, ox, oy)
        stamp(sheet, source, 12, 0, GRID, GRID, ox, oy)
        stamp(sheet, source, 4, LEG_Y, 8, GRID, ox, oy - 1)
        stamp(sheet, source, 8, LEG_Y, 12, GRID, ox, oy + 1)
        stamp(sheet, source, 4, 0, 12, HIP_Y + 1, ox, oy)
        stamp(sheet, source, 4, HIP_Y, 12, LEG_Y, ox, oy)

    sheet.save_png(OUT / "all-characters-walk-up-down-1x.png")
    sheet.save_png(OUT / "all-characters-walk-up-down-preview.png", scale=8, bg="#263041")
    sheet.save_silhouette(OUT / "all-characters-walk-up-down-silhouette.png", scale=8)
    sheet.stats()


if __name__ == "__main__":
    main()
