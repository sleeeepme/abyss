"""Compose the three in-game grounding-shadow proposals into one static comparison board."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
FRAMES = sorted((OUT / "grounding-proposal-frames").glob("*.png"))
LABELS = [
    ("A  CONTACT OVAL", "Lowest profile / firm contact"),
    ("B  CONTACT + SHORT CAST", "Grounded + light direction  /  RECOMMENDED"),
    ("C  CONTACT + WIDE CAST", "Softest depth / widest footprint"),
]


def main():
    if len(FRAMES) != 3:
        raise SystemExit("Run capture-grounding-proposals.mjs first.")
    images = [Image.open(path).convert("RGB") for path in FRAMES]
    width, height = images[0].size
    gap, margin, title_h, label_h, footer_h = 16, 18, 48, 34, 30
    card_h = label_h + height + footer_h
    board_w = width * 3 + gap * 2 + margin * 2
    board_h = title_h + card_h + margin * 2
    board = Image.new("RGB", (board_w, board_h), "#0f1722")
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    draw.text((margin, 17), "GROUNDING SHADOW PROPOSALS — SAME SCENE / SAME LIGHT", fill="#edf7ff", font=font)
    for index, image in enumerate(images):
        x = margin + index * (width + gap)
        card_y = title_h + margin
        image_y = card_y + label_h
        border = "#78d6ba" if index == 1 else "#8da6bb"
        draw.rectangle((x-1, card_y-1, x+width, image_y+height+footer_h), outline=border, width=2)
        draw.rectangle((x, card_y, x+width-1, image_y-1), fill="#1a2938")
        draw.rectangle((x, image_y+height, x+width-1, image_y+height+footer_h-1), fill="#1a2938")
        board.paste(image, (x, image_y))
        title, footer = LABELS[index]
        draw.text((x+10, card_y+11), title, fill="#eaf4fb", font=font)
        draw.text((x+10, image_y+height+9), footer, fill=border, font=font)
    target = OUT / "grounding-shadow-proposals.png"
    board.save(target)
    print(target)


if __name__ == "__main__":
    main()
