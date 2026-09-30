from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
FRAME_DIR = ROOT / "silhouette-motion-frames"
GIF_PATH = ROOT / "silhouette-shadow-motion.gif"
SHEET_PATH = ROOT / "silhouette-shadow-motion-contact-sheet.png"

INK = (232, 238, 246)
MUTED = (154, 169, 187)
PANEL = (16, 22, 31)
ACCENT = (174, 214, 110)
FONT = ImageFont.load_default()


def labeled_frame(source: Image.Image, index: int, total: int) -> Image.Image:
    source = source.convert("RGB")
    canvas = Image.new("RGB", (source.width, source.height + 54), PANEL)
    canvas.paste(source, (0, 28))
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 9), "E  CONTACT + SILHOUETTE", font=FONT, fill=INK)
    draw.text((canvas.width - 82, 9), f"{index + 1:02d}/{total:02d}", font=FONT, fill=ACCENT)
    draw.text(
        (12, source.height + 36),
        "ENEMY ORBITS HERO  /  SHADOW EXTENDS AWAY FROM LIGHT",
        font=FONT,
        fill=MUTED,
    )
    return canvas


paths = sorted(FRAME_DIR.glob("*.png"))
if len(paths) < 8:
    raise SystemExit(f"Expected motion frames in {FRAME_DIR}; found {len(paths)}")

frames = [labeled_frame(Image.open(path), index, len(paths)) for index, path in enumerate(paths)]

# One shared palette prevents per-frame quantization shimmer in the soft shadow.
palette_source = Image.new("RGB", (frames[0].width, frames[0].height * len(frames)))
for index, frame in enumerate(frames):
    palette_source.paste(frame, (0, index * frame.height))
palette = palette_source.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
indexed = [
    frame.quantize(palette=palette, dither=Image.Dither.NONE)
    for frame in frames
]
indexed[0].save(
    GIF_PATH,
    save_all=True,
    append_images=indexed[1:],
    duration=95,
    loop=0,
    disposal=2,
    optimize=False,
)

# Eight evenly spaced poses make direction changes inspectable without animation.
key_indices = [round(index * len(frames) / 8) % len(frames) for index in range(8)]
thumb_w, thumb_h = frames[0].size
sheet = Image.new("RGB", (thumb_w * 4, thumb_h * 2), (9, 13, 20))
for slot, frame_index in enumerate(key_indices):
    sheet.paste(frames[frame_index], ((slot % 4) * thumb_w, (slot // 4) * thumb_h))
sheet.save(SHEET_PATH)

print(f"gif={GIF_PATH} frames={len(frames)} size={frames[0].size} duration_ms=95")
print(f"contact_sheet={SHEET_PATH} key_frames={key_indices}")
