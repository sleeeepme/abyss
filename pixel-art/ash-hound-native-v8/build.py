from pathlib import Path
import sys,json
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
ROOT=Path(__file__).resolve().parent
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
C={'ink':'#160f1d','deep':'#281a2e','shadow':'#392a3a','violet':'#51405a',
   'stone0':'#696473','stone1':'#85808e','stone2':'#a5a0a6',
   'ash0':'#69443f','ash1':'#8b5c50','ash2':'#b58b70',
   'mouth0':'#9f403e','mouth1':'#d26a48','ivory':'#e4d5ac'}
im=Image.new('RGBA',(32,32),(0,0,0,0));d=ImageDraw.Draw(im)
# Native 32px silhouette, proportioned after the benchmark: high forked tail,
# one squat barrel body, four very short legs, oversized rectangular muzzle.
d.polygon([(1,9),(2,6),(4,6),(5,8),(4,10),(6,9),(7,6),(10,6),(10,8),(8,10),(10,12),(9,15),(6,16),(3,14),(2,12)],fill=C['deep'])
d.polygon([(7,13),(9,10),(13,9),(18,9),(22,11),(24,14),(23,19),(20,22),(11,22),(7,19)],fill=C['deep'])
d.polygon([(20,11),(21,8),(23,8),(24,6),(26,7),(26,9),(29,10),(30,13),(30,18),(29,20),(23,20),(20,17)],fill=C['deep'])
for poly in [[(8,18),(12,18),(12,27),(8,27)],[(13,19),(17,19),(17,27),(13,27)],[(20,18),(24,18),(24,27),(20,27)],[(25,18),(29,18),(29,26),(25,26)]]:
 d.polygon(poly,fill=C['deep'])
# Tail and back use compact clusters instead of thin bone lines.
d.polygon([(2,9),(3,7),(4,8),(3,10),(5,12),(7,11),(8,8),(9,8),(7,13),(5,14),(3,12)],fill=C['ash1'])
d.point([(3,8),(8,7),(9,7)],fill=C['ash2'])
d.polygon([(8,14),(10,11),(14,10),(19,10),(22,12),(23,15),(21,19),(18,20),(11,20),(8,18)],fill=C['shadow'])
d.polygon([(10,12),(13,10),(18,10),(21,12),(20,14),(12,14)],fill=C['violet'])
d.polygon([(12,11),(17,10),(20,12),(18,13),(13,13)],fill=C['stone0'])
d.polygon([(10,15),(20,15),(21,18),(18,20),(11,19)],fill=C['deep'])
# Three stubby rib marks embedded in the flank, matching the benchmark's terse lines.
d.line([(12,15),(12,18)],fill=C['stone2'],width=1)
d.line([(15,15),(15,18)],fill=C['stone2'],width=1)
d.line([(18,15),(18,18)],fill=C['stone1'],width=1)
d.point([(12,15),(15,15)],fill=C['ivory'])
# Block head with a large readable maw, the strongest feature in the reference dog.
d.polygon([(21,11),(23,9),(27,10),(30,12),(30,18),(28,19),(23,19),(21,16)],fill=C['stone0'])
d.polygon([(23,10),(27,10),(29,12),(28,13),(23,13)],fill=C['violet'])
d.polygon([(23,13),(30,13),(30,18),(23,18)],fill=C['ash0'])
d.rectangle((24,14,29,17),fill=C['mouth0'])
d.rectangle((25,15,28,17),fill=C['mouth1'])
# Teeth are sparse one-pixel notches inside the mouth.
d.point([(24,14),(27,14),(29,15),(26,17)],fill=C['ivory'])
# Short solid legs and flat paws, like the benchmark sprite.
d.rectangle((9,19,11,25),fill=C['violet']);d.rectangle((8,25,12,27),fill=C['stone0'])
d.rectangle((14,20,16,25),fill=C['shadow']);d.rectangle((13,25,17,27),fill=C['violet'])
d.rectangle((21,19,23,25),fill=C['stone0']);d.rectangle((20,25,24,27),fill=C['stone1'])
d.rectangle((26,19,28,24),fill=C['shadow']);d.rectangle((25,24,29,26),fill=C['stone0'])
# Inner one-pixel outline. No dilation and no resizing.
base=im.copy();src=base.load();dst=im.load();ink=(22,15,29,255)
for y in range(32):
 for x in range(32):
  if not src[x,y][3]:continue
  if any(nx<0 or ny<0 or nx>=32 or ny>=32 or not src[nx,ny][3] for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1))):dst[x,y]=ink
# Reassert interior focal pixels after contouring.
d=ImageDraw.Draw(im)
d.point((24,11),fill=C['ivory'])
d.point((25,11),fill=C['ink'])
d.point([(25,15),(28,15),(26,17)],fill=C['mouth1'])
d.point([(24,14),(27,14),(29,15)],fill=C['ivory'])
d.point([(13,11),(14,11)],fill=C['ash2'])
d.point([(19,12),(20,12)],fill=C['stone1'])
im.save(ROOT/'ash-hound-32.png')
s=Sprite.from_png(str(ROOT/'ash-hound-32.png'),scale=1)
s.save_png(str(ROOT/'ash-hound-32@8x.png'),scale=8,bg='#6e6e6e')
s.save_silhouette(str(ROOT/'quality'/'silhouette.png'),scale=8)
colors={p[:3] for p in im.getdata() if p[3]};b=im.getbbox();stats={'canvas':im.size,'opaque_bounds':b,'body_size':[b[2]-b[0],b[3]-b[1]],'visible_colors':len(colors),'alpha_values':sorted(set(im.getchannel('A').getdata())),'native_authored':True,'resized_from_source':False}
assert stats['visible_colors']==13,stats
assert stats['alpha_values']==[0,255],stats
(ROOT/'quality'/'stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
board=Image.new('RGB',(350,190),'#6e6e6e');q=ImageDraw.Draw(board);fp='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc';f=ImageFont.truetype(fp,13);sm=ImageFont.truetype(fp,11)
q.text((16,12),'Tiny RPG犬の造形比率で32px直接作画',font=f,fill='#eee4d3')
if REF.exists():
 r=Image.open(REF).convert('RGB').crop((24,197,147,279));board.paste(r,(23,58));q.text((32,151),'Tiny RPG参照',font=sm,fill='#eee4d3')
n=im.resize((128,128),Image.Resampling.NEAREST);board.paste(n,(197,40),n);q.text((205,170),'アッシュハウンド',font=sm,fill='#eee4d3')
board.save(ROOT/'comparison.png')
print(json.dumps(stats,ensure_ascii=False))
