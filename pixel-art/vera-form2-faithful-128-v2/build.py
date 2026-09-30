from pathlib import Path
import sys,json,ast
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent
src=Image.open(ROOT/'reference.png').convert('RGBA')
px=src.load()
for y in range(src.height):
 for x in range(src.width):
  r,g,b,a=px[x,y]
  if min(r,g,b)>172 and max(r,g,b)-min(r,g,b)<=14: px[x,y]=(0,0,0,0)
# Center sampling proved more faithful than modal sampling for this source grid.
base=src.resize((128,128),Image.Resampling.NEAREST)
base.save(ROOT/'sampled-before-cleanup.png')
s=Sprite.from_png(str(ROOT/'sampled-before-cleanup.png'),scale=1)
p=base.load(); removed=[]
for y in range(1,127):
 for x in range(1,127):
  r,g,b,a=p[x,y]
  # Only pale neutral/cool remnants at transparency edges; warm ivory protected.
  if not a or min(r,g,b)<125 or max(r,g,b)-min(r,g,b)>28 or r-b>8:continue
  adjacent=[p[x+dx,y+dy] for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]]
  if not any(n[3]==0 for n in adjacent):continue
  ns=[p[x+dx,y+dy] for dx in [-1,0,1] for dy in [-1,0,1] if dx or dy]
  dark=sum(n[3]>0 and max(n[:3])<145 for n in ns)
  bright=sum(n[3]>0 and min(n[:3])>145 for n in ns)
  if dark>=2 and bright<=2:
   s.px(x,y,None);removed.append([x,y])
s.save_png(str(ROOT/'sampled-clean.png'))
# The approved material palette is embedded here for independent reproduction.
palette=['#0b1017','#141b24','#202833','#30343b','#29272b','#3a3535','#4b433e','#5d5045',
'#74614c','#9c8060','#b99c74','#d5b789','#e8cba1','#f6dfba','#fff0d2',
'#1c3340','#274552','#315764','#3b6b72','#478084','#619696',
'#392c26','#58402b','#795430','#9b6a36','#b27e43','#c39352',
'#dca14a','#f5c765','#77716a','#a1a09a','#86735f']
s.clean(palette=palette,harden=True,despeckle_min=0,dedupe_tol=0)
s.save_png(str(ROOT/'front-128.png'))
s.save_png(str(ROOT/'front-512.png'),scale=4)
s.save_png(str(ROOT/'preview-dark.png'),scale=4,bg='#202431')
s.save_png(str(ROOT/'preview-light.png'),scale=4,bg='#c5c8ca')
s.save_silhouette(str(ROOT/'silhouette.png'),scale=4)
s.save_swatch(str(ROOT/'palette.png'))
stats=s.stats()
final=Image.open(ROOT/'front-128.png').convert('RGBA')
big=Image.open(ROOT/'front-512.png').convert('RGBA')
assert final.size==(128,128) and big.size==(512,512)
assert big.tobytes()==final.resize((512,512),Image.Resampling.NEAREST).tobytes()
assert set(final.getchannel('A').getdata())=={0,255}
assert len(s.used_colors())<=32
# Verify pre-palette cleanup changed exactly the recorded fringe pixels only.
clean=Image.open(ROOT/'sampled-clean.png').convert('RGBA')
changed=[(x,y) for y in range(128) for x in range(128) if base.getpixel((x,y))!=clean.getpixel((x,y))]
assert set(changed)==set(map(tuple,removed))
for x,y in changed:assert clean.getpixel((x,y))==(0,0,0,0)
(ROOT/'verification.json').write_text(json.dumps({'removed_fringe_pixels':removed,'count':len(removed),
 'native':[128,128],'display':[512,512],'colors_used':len(s.used_colors()),'pixelstudio':stats},indent=2))
print('PASS: fringe-only removal',len(removed),'pixels; 128px transparent; 512px exact 4x')
