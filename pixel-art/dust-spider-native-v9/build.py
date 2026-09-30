from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path(__file__).resolve().parent
Q=P/'quality';Q.mkdir(exist_ok=True)
INK='#100d15'
PAL={'A':INK,'B':'#392c3d','C':'#897667','D':'#b09a7c','E':'#ddceb1','O':'#dd9b43','L':'#5e5059','S':'#66544d'}
BG='#565358'
FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def f(n):return ImageFont.truetype(FONT,n)
def stamp(im,x,y,rows,flat=False):
 for j,r in enumerate(rows.splitlines()):
  for i,c in enumerate(r):
   if c!='.':im.putpixel((x+i,y+j),ImageColor(PAL[c] if not flat else INK))
def ImageColor(h):return (*bytes.fromhex(h[1:]),255)
def path(im,pts):ImageDraw.Draw(im).line(pts,fill=INK,width=1)

ABDOMENS={
 'A':(4,3,'''..AAAAAA..
.ACCCCCCA.
ACCDDDDCCA
ACCCCCCCBA
ABCCCCCBBA
.ABBBBBA..
..AAAAA...'''),
 'B':(4,1,'''...AAAA...
..ACDDCA..
.ACDDCCCA.
ACCCCCSSBA
ACCCSSSBBA
ABSSSSSBBA
.ABBBBCBA.
..ABBBBA..
...AAAA...'''),
 'C':(6,2,'''..AAAA..
.ACDDCA.
ACDDDCCA
ACCCCCBA
ABCCCCBA
.ABBCCA.
..ABBA..
...AA...''')}

def sprite(kind='B',stage='silhouette'):
 im=Image.new('RGBA',(24,16))
 # Four far legs, attached to the cephalothorax and occluded by the body.
 for pts in [((14,7),(9,7),(6,9),(6,12)),((15,7),(13,9),(12,13)),((16,7),(19,8),(20,12)),((17,7),(21,7),(22,10))]:path(im,pts)
 ax,ay,rows=ABDOMENS[kind];stamp(im,ax,ay,rows)
 # Narrow waist and small right-facing head.
 stamp(im,12,5,'''AAA
ACCA
ABBA
.AA''')
 # Four near legs: broad roots contract to single-pixel dark tips.
 for pts in [((14,8),(7,8),(4,9),(2,12),(1,15)),((15,9),(10,11),(8,14),(8,15)),((16,9),(18,11),(16,15)),((17,8),(21,9),(23,13),(23,15))]:path(im,pts)
 stamp(im,6,7,'''..AAAAA
AALLLLA
AAAAAA''')
 stamp(im,10,9,'''...AA
.AALA
ALA..
.A...''')
 stamp(im,16,9,'''AA.
ALA
.AA''')
 stamp(im,19,7,'''AA..
ALAA
.ALA
..AA''')
 # The face is in front of the proximal leg attachments. Do not let the legs
 # erase the focal eye pixels or turn the paired chelicerae into one fang.
 stamp(im,14,5,'''.AAAAA.
ACCCBBA
ACCOBOA
ABBBBBA
.AEAEA.
..A.A..''')
 # Explicit pixel corrections at the near hind-leg root: close a trapped
 # one-pixel hole and terminate its inside color before the transparent edge.
 for xy in [(12,9),(13,10)]:im.putpixel(xy,ImageColor(INK))
 if stage=='silhouette':
  for y in range(im.height):
   for x in range(im.width):
    if im.getpixel((x,y))[3]:im.putpixel((x,y),ImageColor(INK))
 elif stage=='flat':
  remap={ImageColor(PAL[c]):ImageColor(PAL['C']) for c in 'BDSEO'}
  for y in range(im.height):
   for x in range(im.width):
    p=im.getpixel((x,y));im.putpixel((x,y),remap.get(p,p))
 out=Image.new('RGBA',(32,32));out.alpha_composite(im,(4,5));return out

def preview(im,scale=8,bg=BG):
 out=Image.new('RGBA',im.size,bg);out.alpha_composite(im)
 return out.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
def main():
 board=Image.new('RGB',(864,384),'#25232a');d=ImageDraw.Draw(board)
 d.text((20,12),'DUST SPIDER / 原寸シルエット比較',font=f(22),fill='white')
 for i,k in enumerate('ABC'):
  im=sprite(k);im.save(Q/f'silhouette-{k}-32.png');board.paste(preview(im),(16+i*288,58))
  board.paste(preview(im,1),(20+i*288,331));d.text((64+i*288,338),{'A':'低い腹部','B':'高い腹部','C':'小さい腹部'}[k],font=f(15),fill='white')
 board.save(Q/'silhouette-options.png')
 im=sprite('B','final');im.save(P/'dust-spider-32.png');preview(im).save(P/'dust-spider-8x.png')
 im.resize((256,256),Image.Resampling.NEAREST).save(P/'dust-spider-8x-transparent.png')
 board=Image.new('RGB',(864,390),'#25232a');d=ImageDraw.Draw(board)
 d.text((20,12),'DUST SPIDER / 原寸からの制作工程',font=f(22),fill='white')
 for i,(stage,label) in enumerate([('silhouette','1. 外形と脚間の空白'),('flat','2. 腹部・頭・脚の色面'),('final','3. 陰影・目・牙')]):
  s=sprite('B',stage);board.paste(preview(s),(16+i*288,58));board.paste(preview(s,1),(20+i*288,332));d.text((64+i*288,339),label,font=f(14),fill='white')
 board.save(P/'stages.png')
 refs=P.parent/'tinyrpg-native-study-v1'
 demon=Image.open(refs/'demon-original-32.png').convert('RGBA');blood=Image.open(refs/'blood-original-32.png').convert('RGBA')
 def shift_up(s):
  n=Image.new('RGBA',(32,32));n.alpha_composite(s,(0,-6));return n
 hound=Image.open(P.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png').convert('RGBA')
 old=Image.open(P.parent/'stone-small-enemies-v8/dust-spider-32.png').convert('RGBA')
 items=[('TinyRPG / Demon',shift_up(demon)),('TinyRPG / Blood',shift_up(blood)),('Ash Hound / 基準',hound),('Dust Spider / 前回',old),('Dust Spider / 今回',im)]
 board=Image.new('RGB',(1100,360),'#25232a');d=ImageDraw.Draw(board)
 d.text((16,12),'TinyRPGの原寸表現を、新しい生物へ移す',font=f(22),fill='white')
 for i,(label,s) in enumerate(items):
  x=16+i*218;d.text((x,55),label,font=f(13),fill='#ebe4d5');board.paste(preview(s,6),(x,86))
  for j,bg in enumerate([BG,'#20202c','#b8b1a2']):board.paste(preview(s,1,bg),(x+12+j*61,292))
 d.text((16,338),'全て同じ1px密度 / 上：6倍、下：原寸3背景 / 今回は新規作画・空間的な縮小なし',font=f(12),fill='#c6beca')
 board.save(P/'comparison.png')
 gaps=[];opaque=[]
 for y in range(32):
  for x in range(32):
   p=im.getpixel((x,y))
   if p[3]:
    opaque.append(p)
    if p!=ImageColor(INK) and any(not(0<=a<32 and 0<=b<32) or not im.getpixel((a,b))[3] for a,b in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):gaps.append([x,y])
 bbox=im.getbbox();report={'canvas':[32,32],'bbox':bbox,'visible_size':[bbox[2]-bbox[0],bbox[3]-bbox[1]],'opaque_pixels':len(opaque),'colors':len(set(opaque)),'unoutlined_boundary_pixels':gaps,'selected_silhouette':'B','old_sprite_pixels_used_in_new_sprite':0,'spatial_downsampling':False}
 assert not gaps, gaps
 (Q/'report.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report))
if __name__=='__main__':main()
