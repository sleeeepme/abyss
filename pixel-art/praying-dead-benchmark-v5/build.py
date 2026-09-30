from pathlib import Path
import sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'sources' / 'praying-dead-compact.png'
CRAWLER = ROOT.parent / 'stone-benchmark-v2' / 'crawling-dead-32.png'
REF = Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')

# Source was generated as a coarse pixel-block master. Threshold away the faint
# generative fringe, crop the authored body, and recover one logical pixel per block.
im = Image.open(SOURCE).convert('RGBA')
a = im.getchannel('A').point(lambda v: 255 if v >= 180 else 0)
im.putalpha(a)
bounds = a.getbbox()
im = im.crop(bounds).resize((27, 25), Image.Resampling.NEAREST)
canvas = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
canvas.paste(im, (2, 5), im)
canvas.save(ROOT / 'quality' / 'recovered-grid.png')

palette = [
    '#160f1d', # one-pixel outer contour / cavities
    '#281a2e', '#392a3a', '#4c3740', # hood and robe shadow planes
    '#60463f', '#775849', '#957159', '#b18e6d', # leather-brown cloth planes
    '#d2b991', '#eee0bd', '#fff1cf', # bone and cloth light
    '#35545d', '#5f8185', # restrained teal sash
]
s = Sprite.from_png(str(ROOT / 'quality' / 'recovered-grid.png'), scale=1)
s.clean(palette=palette, harden=True, despeckle_min=2, dedupe_tol=0)

# Restore two intentional, connected micro-clusters after cleanup: the hood crown
# light and the vertical highlight on the clasped hands. No single-pixel texture.
s.px(16, 7, '#d2b991'); s.px(17, 7, '#d2b991')
s.px(21, 19, '#fff1cf'); s.px(21, 20, '#fff1cf')
s.px(22, 15, '#eee0bd'); s.px(22, 16, '#eee0bd')

out_path = ROOT / 'praying-dead-32.png'
s.save_png(str(out_path))

# Keep the contour inside the authored 27x25 silhouette. Any exposed edge
# pixel becomes the existing dark-purple contour; the sprite never grows outward.
base = Image.open(out_path).convert('RGBA')
out = base.copy()
op = base.load(); dst = out.load(); contour = (22, 15, 29, 255)
for y in range(base.height):
    for x in range(base.width):
        if not op[x, y][3]:
            continue
        exposed = any(
            nx < 0 or nx >= base.width or ny < 0 or ny >= base.height or not op[nx, ny][3]
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
        )
        if exposed:
            dst[x, y] = contour
# Match Crawling Dead's eye language: a vertical, near-black socket with no glow.
out.putpixel((23, 13), contour)
out.putpixel((23, 14), contour)
out.save(out_path)
final_sprite = Sprite.from_png(str(out_path), scale=1)
final_sprite.save_png(str(ROOT / 'praying-dead-32@8x.png'), scale=8, bg='#6e6e6e')
final_sprite.save_silhouette(str(ROOT / 'quality' / 'silhouette.png'), scale=8)

out = Image.open(out_path).convert('RGBA')
visible = {px[:3] for px in out.getdata() if px[3]}
stats = {
    'canvas': out.size,
    'opaque_bounds': out.getbbox(),
    'body_size': [out.getbbox()[2]-out.getbbox()[0], out.getbbox()[3]-out.getbbox()[1]],
    'visible_colors': len(visible),
    'alpha_values': sorted(set(out.getchannel('A').getdata())),
    'logical_master': [27, 25],
    'source_alpha_threshold': 180,
}
assert stats['alpha_values'] == [0, 255]
assert stats['visible_colors'] == 13
(ROOT / 'quality' / 'stats.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2))

# Exact 4x nearest-neighbor comparison: benchmark, approved Crawling Dead, final.
board = Image.new('RGB', (560, 190), '#6e6e6e')
d = ImageDraw.Draw(board)
font_path = '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
font = ImageFont.truetype(font_path, 13)
small = ImageFont.truetype(font_path, 11)
if REF.exists():
    ref = Image.open(REF).convert('RGB')
    crop = ref.crop((48, 287, 138, 365))
    board.paste(crop, (22, 52))
    d.text((22, 142), 'Tiny RPG参照', font=small, fill='#eee4d3')
if CRAWLER.exists():
    c = Image.open(CRAWLER).convert('RGBA').resize((128, 128), Image.Resampling.NEAREST)
    board.paste(c, (170, 34), c)
    d.text((175, 164), 'クロウリングデッド', font=small, fill='#eee4d3')
p = out.resize((128, 128), Image.Resampling.NEAREST)
board.paste(p, (385, 34), p)
d.text((400, 164), 'プレイングデッド', font=small, fill='#eee4d3')
d.text((18, 14), '画素サイズ固定（32×32を正確に4倍） / 13色', font=font, fill='#eee4d3')
board.save(ROOT / 'comparison.png')
print(json.dumps(stats, ensure_ascii=False))
