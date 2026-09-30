"""Faithful import, palette lock, then local pixel corrections. No shape replacement."""
from pathlib import Path
from collections import Counter
import sys, json
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
src=Image.open(ROOT/'reference.png').convert('RGBA')
# Lossless original of the same illustration reattached by the user as a JPEG.
# Its checkerboard is baked into RGB. Restrict removal to bright neutral colors:
# ivory highlights retain their warm chroma and are not erased.
masked=src.copy()
px=masked.load()
removed=0
for y in range(masked.height):
    for x in range(masked.width):
        rr,gg,bb,aa=px[x,y]
        if min(rr,gg,bb)>172 and max(rr,gg,bb)-min(rr,gg,bb)<=14:
            px[x,y]=(0,0,0,0)
            removed+=1
masked.save(ROOT/'source-cutout.png')

# Dominant-color block recovery retains source proportions and shading clusters.
# One source cell -> one native output pixel, never redraw with coarse polygons.
s=Sprite.from_png(str(ROOT/'source-cutout.png'),scale=src.width/128,strip_bg=False)
s.save_png(str(ROOT/'import-128.png'))
PALETTE=['#0b1017','#141b24','#202833','#30343b',
 '#29272b','#3a3535','#4b433e','#5d5045',
 '#74614c','#9c8060','#b99c74','#d5b789','#e8cba1','#f6dfba','#fff0d2',
 '#1c3340','#274552','#315764','#3b6b72','#478084','#619696',
 '#392c26','#58402b','#795430','#9b6a36','#b27e43','#c39352',
 '#dca14a','#f5c765','#77716a','#a1a09a','#86735f']
s.clean(palette=PALETTE,harden=True,despeckle_min=0,dedupe_tol=0,dither=False)
s.save_png(str(ROOT/'before-local-corrections.png'))

# Repair source thin details lost under modal sampling. Source-registered coords.
for x,y in [(86,13),(83,18),(80,23),(79,25),(77,28),(102,29),(97,50),(125,75)]:
    s.px(x,y,None)
s.line(86,12,64,52,'#f5c765')
s.line(64,52,100,116,'#dca14a')
# Inset amber eyes, tapered ivory cheeks and central dark nose.
s.px(61,40,'#dca14a'); s.px(65,40,'#dca14a')
s.px(62,42,'#b99c74'); s.px(63,43,'#392c26')
s.line(60,43,61,44,'#d5b789')
s.line(62,45,62,47,'#f6dfba')
s.line(65,44,65,46,'#b99c74')
# Index finger and thumb sit in FRONT of the string at the draw point.
s.line(60,50,64,52,'#f6dfba')
s.line(60,52,62,54,'#d5b789')
s.px(62,55,'#74614c')
s.px(61,54,'#29272b')
# Minor internal separations: wrist wraps and upper gripping finger.
s.line(115,50,118,51,'#f6dfba')
s.line(115,52,117,53,'#74614c')
s.line(49,46,49,48,'#9c8060')

s.save_png(str(ROOT/'front-128.png'))
s.save_png(str(ROOT/'front-512.png'),scale=4)
s.save_png(str(ROOT/'preview.png'),scale=4,bg='#6d747b')
s.save_png(str(ROOT/'preview-dark.png'),scale=4,bg='#242735')
s.save_silhouette(str(ROOT/'silhouette.png'),scale=4)
s.save_swatch(str(ROOT/'palette.png'))
stats=s.stats()
base=Image.open(ROOT/'front-128.png').convert('RGBA')
display=Image.open(ROOT/'front-512.png').convert('RGBA')
assert base.size==(128,128)
assert display.size==(512,512)
assert display.tobytes()==base.resize((512,512),Image.Resampling.NEAREST).tobytes()
assert set(base.getchannel('A').getdata())=={0,255}
assert len({p for p in base.getdata() if p[3]})<=32

def backdrop(im,bg):
    out=Image.new('RGBA',im.size,bg)
    out.alpha_composite(im)
    return out.convert('RGB')

comparison=Image.new('RGB',(1048,548),'#343b43')
draw=ImageDraw.Draw(comparison)
draw.text((12,8),'REFERENCE',fill='white')
draw.text((532,8),'128px / 32 COLORS',fill='white')
comparison.paste(backdrop(masked.resize((512,512),Image.Resampling.NEAREST),'#6d747b'),(8,28))
comparison.paste(backdrop(display,'#6d747b'),(528,28))
comparison.save(ROOT/'comparison.png')
# Five enlarged pairs. Native grid coordinates, reference on left of each pair.
regions={'FACE':(56,36,70,49),'DRAWING HAND':(46,42,68,59),
         'RIBS':(43,53,73,83),'FRONT FOOT':(3,94,42,123),
         'BOW GRIP':(107,39,126,74)}
sheet=Image.new('RGB',(800,1000),'#343b43')
sd=ImageDraw.Draw(sheet)
for i,(name,box) in enumerate(regions.items()):
    w,h=box[2]-box[0],box[3]-box[1]
    scale=min(6,170//h)
    reference_box=tuple(round(v*src.width/128) for v in box)
    a=masked.crop(reference_box).resize((w*scale,h*scale),Image.Resampling.NEAREST)
    b=base.crop(box).resize((w*scale,h*scale),Image.Resampling.NEAREST)
    sd.text((12,i*200+6),name+' / REFERENCE',fill='white')
    sd.text((412,i*200+6),'128px',fill='white')
    sheet.paste(backdrop(a,'#6d747b'),(12,i*200+25))
    sheet.paste(backdrop(b,'#6d747b'),(412,i*200+25))
sheet.save(ROOT/'detail-comparison.png')
(ROOT/'stats.json').write_text(json.dumps({'pixelstudio':stats,'removed_background_pixels':removed,
    'source_size':src.size,'native_size':base.size,'display_size':display.size},indent=2))
print('PASS: native 128px, 32 colors maximum, binary alpha, exact 4x output')
