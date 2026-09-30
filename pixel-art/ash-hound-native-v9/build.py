from pathlib import Path
import sys,json
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
ROOT=Path(__file__).resolve().parent
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
P={'ink':'#160f1d','deep':'#291d30','shadow':'#38293d','violet':'#4e3b54',
   'stone0':'#666270','stone1':'#85818c','stone2':'#aaa4a7',
   'ash0':'#65413e','ash1':'#89564d','ash2':'#b17a61',
   'ember0':'#9f3f3b','ember1':'#d36543','bone':'#e2d2ad'}
# Each span is final-grid authored; no high-resolution source or resizing exists.
rows={
5:[(2,3),(7,9),(23,24)],6:[(1,4),(6,10),(22,25)],7:[(1,5),(6,9),(14,18),(21,26)],
8:[(1,9),(11,28)],9:[(2,28)],10:[(3,29)],11:[(4,30)],12:[(5,30)],13:[(5,30)],
14:[(6,30)],15:[(6,30)],16:[(7,30)],17:[(7,30)],18:[(7,30)],19:[(8,12),(14,18),(20,24),(26,29)],20:[(8,12),(14,18),(20,24),(26,29)],
21:[(8,12),(14,17),(20,24),(26,29)],22:[(8,12),(14,17),(20,24),(26,29)],
23:[(8,11),(14,17),(20,24),(26,29)],24:[(8,11),(14,17),(20,24),(26,29)],
25:[(7,12),(13,18),(19,25),(25,30)],26:[(7,12),(13,18),(19,25),(25,30)]}
solid=set()
for y,spans in rows.items():
 for a,b in spans:
  for x in range(a,b+1):solid.add((x,y))
s=Sprite(32,32,palette=list(P.values()))
for x,y in solid:s.px(x,y,P['deep'])
s.save_png(str(ROOT/'quality'/'01-silhouette-1x.png'))
s.save_png(str(ROOT/'quality'/'01-silhouette-8x.png'),scale=8,bg='#6e6e6e')

def span(y,a,b,c):
 for x in range(a,b+1):
  if (x,y) in solid:s.px(x,y,P[c])
def pts(coords,c):
 for x,y in coords:
  if (x,y) in solid:s.px(x,y,P[c])
# Flat masses: ash tail/back, violet body, stone head, alternating near/far legs.
for y,a,b in [(7,2,4),(8,2,8),(9,3,9),(10,4,9),(11,5,8)]:span(y,a,b,'ash1')
for y,a,b in [(9,10,20),(10,8,22),(11,7,22),(12,7,22),(13,7,22),(14,7,22),(15,8,21),(16,8,21),(17,8,21),(18,8,20),(19,9,19),(20,10,18)]:span(y,a,b,'violet')
for y,a,b in [(8,22,26),(9,21,27),(10,21,28),(11,20,29),(12,21,30),(13,21,30),(14,22,30),(15,22,30),(16,22,30),(17,22,30),(18,22,29),(19,22,28)]:span(y,a,b,'stone0')
for y in range(20,25):
 span(y,9,11,'violet');span(y,14,16,'shadow');span(y,21,23,'stone0');span(y,27,28,'shadow')
span(25,8,11,'stone0');span(25,14,17,'violet');span(25,20,24,'stone1');span(25,26,29,'stone0')
span(26,8,11,'stone0');span(26,14,17,'violet');span(26,20,24,'stone1');span(26,26,29,'stone0')
s.save_png(str(ROOT/'quality'/'02-flat-1x.png'))
s.save_png(str(ROOT/'quality'/'02-flat-8x.png'),scale=8,bg='#6e6e6e')
# Directional top-left light. Every band cuts across a form rather than hugging it.
for y,a,b in [(9,12,18),(10,10,19),(11,9,17),(12,8,15)]:span(y,a,b,'ash1')
for y,a,b in [(9,14,17),(10,13,18),(11,12,15)]:span(y,a,b,'ash2')
for y,a,b in [(13,8,20),(14,8,20),(15,9,19),(16,10,19)]:span(y,a,b,'stone0')
for y,a,b in [(13,10,18),(14,10,18),(15,11,17)]:span(y,a,b,'stone1')
# Underside is one joined shadow cluster.
for y,a,b in [(17,9,21),(18,9,21),(19,10,20),(20,11,19)]:span(y,a,b,'shadow')
# Head planes and muzzle.
for y,a,b in [(9,23,25),(10,22,26),(11,21,27),(12,22,28)]:span(y,a,b,'violet')
for y,a,b in [(10,23,25),(11,23,27),(12,24,28)]:span(y,a,b,'stone1')
for y,a,b in [(13,24,30),(14,23,30),(15,23,30),(16,23,30),(17,24,30),(18,25,29)]:span(y,a,b,'ash0')
for y,a,b in [(14,24,29),(15,23,29),(16,24,30),(17,25,29)]:span(y,a,b,'ember0')
for y,a,b in [(15,25,28),(16,25,29)]:span(y,a,b,'ember1')
# Short fork highlights and shoulder bridge.
pts([(3,7),(4,8),(7,7),(8,7),(5,10),(6,11)],'ash2')
pts([(20,11),(21,11),(21,12)],'stone1')
# Contour applied at the end, inside the silhouette only.
boundary=[]
for x,y in solid:
 if any((x+dx,y+dy) not in solid for dx,dy in ((-1,0),(1,0),(0,-1),(0,1))):boundary.append((x,y))
for x,y in boundary:s.px(x,y,P['ink'])
# Hand-corrected contour rhythm: top-side dark-purple runs break the uniform ring.
pts([(14,8),(15,8),(16,8),(17,8),(18,8),(22,8),(23,7),(24,6),(25,7)],'deep')
# Two uneven ribs nested in the flank; different lengths avoid fence rhythm.
pts([(12,14),(12,15),(12,16),(13,17),(16,13),(16,14),(16,15),(17,16)],'bone')
# Eye, brow, mouth corners, and sparse teeth are the only single-pixel symbols.
pts([(24,11),(25,11)],'ink');pts([(25,11)],'ember1')
pts([(23,14),(29,14),(24,17),(28,17)],'bone')
pts([(22,15),(22,16),(30,15),(30,16),(29,18)],'ink')
# Reassert connected highlight clusters where outline edits crossed the light plane.
pts([(13,10),(14,10),(15,10),(13,11),(14,11)],'ash2')
pts([(24,12),(25,12),(26,12)],'stone2')
# Save final.
s.save_png(str(ROOT/'ash-hound-32.png'))
s.save_png(str(ROOT/'ash-hound-32@8x.png'),scale=8,bg='#6e6e6e')
s.save_silhouette(str(ROOT/'quality'/'silhouette.png'),scale=8)
# Final stats.
im=Image.open(ROOT/'ash-hound-32.png').convert('RGBA');b=im.getbbox();colors={p[:3] for p in im.getdata() if p[3]}
stats={'canvas':im.size,'opaque_bounds':b,'body_size':[b[2]-b[0],b[3]-b[1]],'visible_colors':len(colors),'alpha_values':sorted(set(im.getchannel('A').getdata())),'native_authored':True,'resized_from_source':False}
assert stats['visible_colors']==13,stats
assert stats['alpha_values']==[0,255]
(ROOT/'quality'/'stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
# QA board: benchmark, silhouette, flat masses, final.
board=Image.new('RGB',(690,210),'#6e6e6e');d=ImageDraw.Draw(board);fp='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc';f=ImageFont.truetype(fp,13);sm=ImageFont.truetype(fp,11)
d.text((16,12),'32×32原寸：シルエット → 大色面 → 陰影・細部',font=f,fill='#eee4d3')
if REF.exists():
 r=Image.open(REF).convert('RGB').crop((24,197,147,279));board.paste(r,(18,70));d.text((27,163),'Tiny RPG参照',font=sm,fill='#eee4d3')
for x,file,label in [(171,'01-silhouette-1x.png','シルエット'),(326,'02-flat-1x.png','大色面'),(498,'../ash-hound-32.png','完成')]:
 p=(ROOT/'quality'/file).resolve();q=Image.open(p).convert('RGBA').resize((128,128),Image.Resampling.NEAREST);board.paste(q,(x,42),q);d.text((x+33,176),label,font=sm,fill='#eee4d3')
board.save(ROOT/'comparison.png')
print(json.dumps(stats,ensure_ascii=False))
