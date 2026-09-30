from pathlib import Path
import sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite

ROOT=Path(__file__).resolve().parent
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
CRAWLER=ROOT.parent/'stone-benchmark-v2'/'crawling-dead-32.png'

# Native 32x32 construction. Every coordinate below is a final logical pixel;
# there is no source artwork and no reduction step.
C={
 'ink':'#160f1d','deep':'#2b2039','shadow':'#403252','violet':'#554869',
 'stone0':'#6d687a','stone1':'#898493','stone2':'#aaa4aa',
 'ash0':'#725041','ash1':'#98705a','ash2':'#b18b70',
 'bone':'#d8d0bf','light':'#eee5d1','eye':'#e59b16'
}
im=Image.new('RGBA',(32,32),(0,0,0,0)); d=ImageDraw.Draw(im)
# One joined silhouette: curled tail, hunched torso, large head, four short legs.
d.polygon([(1,12),(2,9),(4,8),(6,10),(5,12),(8,13),(10,11),(13,9),(19,9),(22,11),(24,13),(25,18),(23,22),(19,23),(13,22),(9,20),(6,19),(3,17),(2,15)],fill=C['deep'])
d.polygon([(19,12),(21,9),(23,9),(24,6),(26,7),(26,10),(28,9),(30,11),(29,13),(30,15),(30,19),(29,21),(25,21),(22,19),(20,16)],fill=C['deep'])
# Legs are deliberately short and broad like the Tiny RPG benchmark dog.
d.polygon([(8,18),(13,19),(13,22),(12,27),(8,27),(8,24),(7,22)],fill=C['deep'])
d.polygon([(14,20),(18,20),(19,27),(15,27),(14,24)],fill=C['deep'])
d.polygon([(21,19),(25,19),(27,27),(23,27),(22,24)],fill=C['deep'])
d.polygon([(25,19),(29,19),(30,26),(27,26),(26,23)],fill=C['deep'])
# Tail ash and body masses.
d.polygon([(2,11),(3,9),(5,10),(4,12),(7,14),(6,16),(3,15)],fill=C['violet'])
d.polygon([(7,14),(10,12),(13,10),(18,10),(21,12),(23,15),(22,19),(19,21),(13,20),(10,18)],fill=C['stone0'])
d.polygon([(10,12),(14,10),(18,11),(20,13),(17,14),(12,14)],fill=C['ash1'])
d.polygon([(12,11),(16,10),(18,11),(16,12),(13,12)],fill=C['ash2'])
d.polygon([(8,15),(11,13),(12,15),(10,18),(7,17)],fill=C['ash0'])
# Belly void and compact rib marks: three short connected strokes, not a skeleton.
d.polygon([(12,15),(19,14),(21,16),(19,20),(13,20),(11,18)],fill=C['shadow'])
d.line([(13,15),(13,18),(14,19)],fill=C['bone'],width=1)
d.line([(16,15),(16,18),(17,19)],fill=C['bone'],width=1)
d.line([(19,15),(19,18)],fill=C['stone2'],width=1)
d.point([(14,15),(17,15),(18,15)],fill=C['light'])
# Neck and oversized wedge head.
d.polygon([(20,12),(22,10),(25,10),(27,12),(28,15),(26,19),(23,19),(21,16)],fill=C['stone0'])
d.polygon([(23,10),(24,7),(25,8),(25,11)],fill=C['ash0'])
d.polygon([(27,10),(29,11),(28,13),(26,12)],fill=C['violet'])
d.polygon([(24,12),(28,12),(30,15),(30,18),(27,19),(23,17)],fill=C['stone1'])
d.polygon([(27,15),(30,16),(30,19),(28,20),(26,18)],fill=C['stone2'])
d.line([(27,19),(30,19)],fill=C['ink'],width=1)
d.point((29,19),fill=C['light'])
# Shoulder and legs use broad 2-3 pixel planes.
d.polygon([(20,17),(23,17),(24,21),(22,23),(20,21)],fill=C['ash0'])
d.polygon([(9,20),(12,20),(11,25),(9,25)],fill=C['stone0'])
d.polygon([(15,21),(17,21),(18,25),(16,25)],fill=C['violet'])
d.polygon([(22,20),(24,20),(26,25),(23,25)],fill=C['stone1'])
d.polygon([(26,20),(28,20),(29,24),(27,24)],fill=C['stone0'])
# Paw caps stay blocky and share a baseline.
d.rectangle((8,25,12,27),fill=C['stone1']); d.rectangle((15,25,19,27),fill=C['stone0'])
d.rectangle((23,25,27,27),fill=C['stone2']); d.rectangle((27,24,30,26),fill=C['stone1'])
# Convert only exposed pixels to the one-pixel inner contour; silhouette never grows.
base=im.copy(); src=base.load(); dst=im.load(); ink=(22,15,29,255)
for y in range(32):
 for x in range(32):
  if not src[x,y][3]: continue
  if any(nx<0 or ny<0 or nx>=32 or ny>=32 or not src[nx,ny][3] for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1))):
   dst[x,y]=ink
# Reassert focal facial pixels after contour construction.
d=ImageDraw.Draw(im)
d.rectangle((26,13,27,14),fill=C['ink'])
d.point((27,14),fill=C['eye'])
d.point((29,17),fill=C['light'])
# Connected highlights preserve the full 13-color role budget.
d.point([(15,11),(16,11)],fill=C['ash2'])
d.point([(24,16),(25,16)],fill=C['stone2'])
im.save(ROOT/'ash-hound-32.png')

s=Sprite.from_png(str(ROOT/'ash-hound-32.png'),scale=1)
s.save_png(str(ROOT/'ash-hound-32@8x.png'),scale=8,bg='#6e6e6e')
s.save_silhouette(str(ROOT/'quality'/'silhouette.png'),scale=8)

colors={p[:3] for p in im.getdata() if p[3]}; bbox=im.getbbox()
stats={'canvas':im.size,'opaque_bounds':bbox,'body_size':[bbox[2]-bbox[0],bbox[3]-bbox[1]],'visible_colors':len(colors),'alpha_values':sorted(set(im.getchannel('A').getdata())),'native_authored':True,'resized_from_source':False}
assert stats['visible_colors']==13,stats
assert stats['alpha_values']==[0,255],stats
(ROOT/'quality'/'stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))

board=Image.new('RGB',(470,195),'#6e6e6e'); q=ImageDraw.Draw(board)
fontp='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'; f=ImageFont.truetype(fontp,13); sm=ImageFont.truetype(fontp,11)
q.text((18,12),'32×32原寸で直接作画 / 正確な4倍表示 / 13色',font=f,fill='#eee4d3')
if REF.exists():
 r=Image.open(REF).convert('RGB').crop((24,197,147,279)); board.paste(r,(25,60)); q.text((33,153),'Tiny RPG参照',font=sm,fill='#eee4d3')
if CRAWLER.exists():
 c=Image.open(CRAWLER).convert('RGBA').resize((128,128),Image.Resampling.NEAREST); board.paste(c,(174,43),c); q.text((190,174),'密度基準',font=sm,fill='#eee4d3')
n=im.resize((128,128),Image.Resampling.NEAREST); board.paste(n,(326,43),n); q.text((335,174),'アッシュハウンド',font=sm,fill='#eee4d3')
board.save(ROOT/'comparison.png')
print(json.dumps(stats,ensure_ascii=False))
