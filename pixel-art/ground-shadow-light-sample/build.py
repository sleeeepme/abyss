"""Export the in-game directional-ground-shadow review capture as a stable-palette GIF."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
FRAMES = sorted((OUT / "frames").glob("*.png"))
if not FRAMES:
    raise SystemExit("Run capture.mjs while the local proto server is running first.")


def main():
    images = [Image.open(path).convert("RGB") for path in FRAMES]
    labels = [("LIGHT: RIGHT", "SHADOW: LEFT"), ("LIGHT: DOWN", "SHADOW: UP"),
              ("LIGHT: LEFT", "SHADOW: RIGHT"), ("LIGHT: UP", "SHADOW: DOWN")]
    # One palette across every frame prevents GIF palette shimmer while the light rotates.
    palette = images[0].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    gif_frames = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in images]
    images[0].save(OUT / "ground-shadow-light-direction-1x.png")
    gif_frames[0].save(
        OUT / "ground-shadow-light-direction.gif",
        save_all=True,
        append_images=gif_frames[1:],
        duration=[420, 420, 420, 420],
        loop=0,
        disposal=2,
        optimize=False,
    )
    width, height = images[0].size
    # The board is a comparison tool: normalize the cave's peripheral darkness without
    # moving or repainting any game pixels, so all four projected shadows can be read.
    board_images = [image.point(lambda value: round(255 * (value / 255) ** .62)) for image in images]
    title_h, card_h, card_f, gap = 42, 32, 28, 14
    card_height = card_h + height + card_f
    board = Image.new("RGB", (width * 2 + gap * 3, title_h + card_height * 2 + gap * 3), "#101722")
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    for index, image in enumerate(board_images):
        col, row = index % 2, index // 2
        x = gap + col * (width + gap)
        card_y = title_h + gap + row * (card_height + gap)
        y = card_y + card_h
        draw.rectangle((x, card_y, x + width - 1, y - 1), fill="#1b2938")
        draw.rectangle((x, y + height, x + width - 1, y + height + card_f - 1), fill="#1b2938")
        draw.rectangle((x - 1, card_y - 1, x + width, y + height + card_f), outline="#b9d6e8", width=1)
        board.paste(image, (x, y))
        light, shadow = labels[index]
        draw.text((x + 10, card_y + 10), light, fill="#e8f5ff", font=font)
        draw.text((x + 10, y + height + 9), shadow, fill="#9fc4de", font=font)
    draw.text((gap, 14), "DIRECTIONAL GROUND SHADOW — SAME SCENE, FOUR LIGHT DIRECTIONS", fill="#e8f5ff", font=font)
    board.save(OUT / "ground-shadow-light-direction-board.png")
    print(f"frames: {len(gif_frames)} | size: {images[0].size[0]}x{images[0].size[1]}")


if __name__ == "__main__":
    main()
