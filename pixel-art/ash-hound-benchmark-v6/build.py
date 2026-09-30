from pathlib import Path
import sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'sources'/'ash-hound-compact-master.png'
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
CRAWLER=ROOT.parent/'stone-benchmark-v2'/'crawling-dead-32.png'
LEGACY=ROOT/'sources'/'ash-hound-v5-legacy-16.png'

# Recover the intentionally coarse block master as a native 30x18 logical design.
im=Image.open(SOURCE).convert('RGBA')
a=im.getchannel('A').point(lambda v:255 if v>=180 else 0)
im.putalpha(a); bbox=a.getbbox(); im=im.crop(bbox).resize((30,18),Image.Resampling.NEAREST)
canvas=Image.new('RGBA',(32,32),(0,0,0,0)); canvas.paste(im,(1,10),im)
canvas.save(ROOT/'quality'/'recovered-grid.png')

palette=[
 '#160f1d', '#2b2039', '#403252', '#554869',
 '#6d687a', '#898493', '#aaa4aa',
 '#725041', '#98705a',
 '#c5bfb3', '#ded7c7', '#f2ead4',
 '#f2a900'
]
s=Sprite.from_png(str(ROOT/'quality'/'recovered-grid.png'),scale=1)
s.clean(palette=palette,harden=True,despeckle_min=2,dedupe_tol=0)
stage=ROOT/'quality'/'clean-stage.png'; s.save_png(str(stage))

# Use an inner 1px contour without growing the silhouette. Only recolor an
# exposed pixel when the inward side remains opaque, preserving thin legs/tail.
base=Image.open(stage).convert('RGBA'); out=base.copy(); src=base.load(); dst=out.load()
contour=(22,15,29,255)
for y in range(1,31):
  for x in range(1,31):
    if not src[x,y][3]: continue
    exposed=[]
    for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)):
      if not src[x+dx,y+dy][3]: exposed.append((dx,dy))
    if not exposed: continue
    # A 1px limb has no inward support and stays as authored; broader masses
    # receive the contour on their own edge pixel.
    supported=any(src[x-dx,y-dy][3] for dx,dy in exposed)
    if supported: dst[x,y]=contour

# Eye: dark socket at (25,17) with one amber point, inherited from legacy spec.
# Ribs: three coherent pale strokes already come from the logical master.
dst[25,17]=contour; dst[26,17]=(242,169,0,255)
# Ensure all 13 palette roles occur as connected, purposeful clusters.
dst[13,15]=(114,80,65,255); dst[14,15]=(114,80,65,255)
dst[12,14]=(152,112,90,255); dst[13,14]=(152,112,90,255)
dst[17,16]=(197,191,179,255); dst[18,16]=(197,191,179,255)
dst[18,17]=(222,215,199,255); dst[19,17]=(222,215,199,255)
dst[19,18]=(64,50,82,255); dst[19,19]=(64,50,82,255)
# Close the two remaining exposed edge pixels without expanding the silhouette.
dst[25,12]=contour; dst[12,14]=contour
out.save(ROOT/'ash-hound-32.png')
final=Sprite.from_png(str(ROOT/'ash-hound-32.png'),scale=1)
final.save_png(str(ROOT/'ash-hound-32@8x.png'),scale=8,bg='#6e6e6e')
final.save_silhouette(str(ROOT/'quality'/'silhouette.png'),scale=8)

im=Image.open(ROOT/'ash-hound-32.png').convert('RGBA')
colors={p[:3] for p in im.getdata() if p[3]}
stats={'canvas':im.size,'opaque_bounds':im.getbbox(),'body_size':[im.getbbox()[2]-im.getbbox()[0],im.getbbox()[3]-im.getbbox()[1]],'visible_colors':len(colors),'alpha_values':sorted(set(im.getchannel('A').getdata())),'logical_master':[30,18]}
assert stats['visible_colors']==13,stats
assert stats['alpha_values']==[0,255],stats
(ROOT/'quality'/'stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))

# Exact 4x nearest-neighbor scale comparison.
board=Image.new('RGB',(625,205),'#6e6e6e'); d=ImageDraw.Draw(board)
fontp='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'; f=ImageFont.truetype(fontp,13); sm=ImageFont.truetype(fontp,11)
d.text((18,12),'画素サイズ固定（32×32を正確に4倍） / 13色',font=f,fill='#eee4d3')
if REF.exists():
 r=Image.open(REF).convert('RGB').crop((24,197,147,279)); board.paste(r,(18,66)); d.text((28,157),'Tiny RPG参照',font=sm,fill='#eee4d3')
if LEGACY.exists():
 old=Image.open(LEGACY).convert('RGBA').resize((64,64),Image.Resampling.NEAREST); board.paste(old,(198,78),old); d.text((185,157),'旧16px版',font=sm,fill='#eee4d3')
if CRAWLER.exists():
 c=Image.open(CRAWLER).convert('RGBA').resize((128,128),Image.Resampling.NEAREST); board.paste(c,(287,45),c); d.text((302,177),'密度基準',font=sm,fill='#eee4d3')
n=im.resize((128,128),Image.Resampling.NEAREST); board.paste(n,(475,45),n); d.text((486,177),'アッシュハウンド',font=sm,fill='#eee4d3')
board.save(ROOT/'comparison.png')
print(json.dumps(stats,ensure_ascii=False))
