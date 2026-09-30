"""Native-grid bog family; never resize source illustrations into sprites."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path(__file__).resolve().parent;Q=P/'quality';Q.mkdir(exist_ok=True)
INK='#100d15';BG='#565358';FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def f(n):return ImageFont.truetype(FONT,n)
def rgba(h):return (*bytes.fromhex(h.lstrip('#')),255)
def stamp(im,x,y,rows,pal):
 for j,r in enumerate(rows.splitlines()):
  for i,c in enumerate(r):
   if c!='.':im.putpixel((x+i,y+j),rgba(pal[c]))
def line(im,pts):ImageDraw.Draw(im).line(pts,fill=INK,width=1)
def canvas():return Image.new('RGBA',(32,32))
def locate(im,bottom=24):
 b=im.getbbox();crop=im.crop(b);out=canvas();out.alpha_composite(crop,((32-crop.width)//2,bottom+1-crop.height));return out

def bog():
 p=dict(A=INK,B='#2c3437',C='#4b6254',D='#77846a',E='#a1a789',F='#645e50',G='#9b927b',H='#d0c4a0',O='#d99a3b')
 im=canvas()
 # Far limbs: one partly under the hip and one extending beyond the head.
 stamp(im,5,14,'''AAA
ACBA
.ABA
.ABAA
.AAAA''',p)
 stamp(im,21,13,'''AAA
ACBA
.ABBA
.AAAA''',p)
 # Uneven sloping back; the small head remains behind the forward palm.
 stamp(im,4,6,'''....AAAAA.....
..AACDDDCAA...
.ACDDDDDCCAA..
ACCDDDCCCCCCA.
ACCCCCCCCCCBAA
ABCCCCCBBBCCBA
.ABBBBBBBBBBA.
..AABBBBBAAA..
....AAAAA.....''',p)
 stamp(im,15,9,'''..AAAAA.
.ACDDCCA
ACCCOCCA
ABCCBBBA
.ABAAAA.
..AAA...''',p)
 # Rear folded limb, with a broad but darker palm.
 stamp(im,3,12,'''..AAAA...
.ACDDCA..
ACCCCCBA.
ABBBCCBA.
.AACCBA..
.AFGGGAA.
AFGAGGGA.
.AA.AAAA.''',p)
 # Forward reaching arm, pale palm in front of the snout.
 stamp(im,14,13,'''AAA.....
ACC A....
ABCCA...
.ABCCA..
..AFGGAA
..AGHHGA
.AFGHGGGA
..AGAGAGA
..AA.A.A.'''.replace(' ',''),p)
 return locate(im),p,{'D':'C','E':'C','B':'C','G':'F','H':'F','O':'B'}

def serpent():
 p=dict(A=INK,B='#303632',C='#647453',D='#93a078',E='#44483e',F='#8c7858',G='#c5b18a',O='#dda042')
 im=canvas()
 # Head and narrow S neck are one native grid, not a stroked vector curve.
 stamp(im,11,3,'''.....AAAAA..
...AACDDCCA.
..ACDDCCOCCA
.ACCCCBBBBBA
.ACCFGGAAAA.
ACCFGA......
ACFGGA......
.ACFGA......
..ACFGAA....
...ACFGGAA..
....ACCF GGA.
.....ACCFGGA
.....ACCBGGA'''.replace(' ',''),p)
 # Lower coil: open center and a tapering left-hand tail.
 stamp(im,1,14,'''......AAAAAA....AAAA...
...AAACCCCBAAAAACCCA..
.AACCCBBBAAAFFFFCCBA..
ACCBBAAA....AFFFFCBA..
AABA.........ABBBBA...
.AAAAAA...AAAACCCA....
....AACCCCCCCBBA......
......AAAAAAAA........''',p)
 # A short torn reed caught at the tail, no decorative particles.
 stamp(im,6,13,'''A.A
AAA
.AA''',p)
 # Close the exposed belly/coil ends in their original cells; no expansion.
 for xy in [(17,7),(21,15),(9,16),(5,17),(17,19),(8,20),(9,20),(10,20),(15,20)]:
  im.putpixel(xy,rgba(INK))
 return locate(im),p,{'B':'C','D':'C','E':'C','G':'F','O':'B'}

def jelly():
 p=dict(A=INK,B='#26383e',C='#416263',D='#6f8d82',E='#a9b8a0',F='#776b4c',G='#ada078',H='#445249')
 im=canvas()
 # Five lengths and bends, attached under a single rim. One-pixel tips stay dark.
 for pts in [((9,14),(8,17),(9,19)),((12,14),(11,19),(12,22)),((15,14),(15,19),(14,24)),((18,14),(20,17),(19,20)),((21,14),(22,19),(20,23))]:line(im,pts)
 stamp(im,11,14,'''AAA
ACA
ABA
.A''',p)
 stamp(im,14,15,'''AAA
ACA
ABA
.A''',p)
 stamp(im,19,14,'''AA.
ACA
.AA''',p)
 stamp(im,7,5,'''.....AAAAAA.....
...AACDDDDCAA...
..ACDDEEEDDCCA..
.ACDDEDDDCCCCA..
.ACDDCCCCCCCCBA.
ACDDCCCCFCCCCBA.
ACCCCCCFGFCCCBBA
ABCCCCCFFCCBBBBA
.ABBBBBAAABBBBA.
..AAAAA..AAAAA..''',p)
 return locate(im),p,{'B':'C','D':'C','E':'C','G':'F','H':'C'}

def grub():
 p=dict(A=INK,B='#332e38',C='#7c7756',D='#aaa17b',E='#d1c4a0',F='#554933',G='#785541',O='#db9d49')
 im=canvas()
 # Unequal feet sit behind the inflated body.
 for pts in [((8,15),(7,17)),((12,15),(11,17)),((17,15),(16,17)),((20,14),(22,16))]:line(im,pts)
 stamp(im,2,10,'''..AAAA..
.ACDDCA.
ACDDCCBA
ACCCCBA.
ABBBBA..
.AAAA...''',p)
 stamp(im,6,5,'''...AAAA..
..ACDDCA.
.ACDEDDCA
ACDDDCCCA
ACDDCCCCA
ACCCCCBBA
ABCCCCBBA
ABCCCBBA.
.ABBBBA..
..AAAA...''',p)
 stamp(im,12,6,'''..AAAA...
.ACDDCAA.
ACDEDDCCA
ACDDDCCCA
ACDDCCCCA
ACCCCCBBA
ABCCCBBA.
.ABB BBA..
..AAAA...'''.replace(' ',''),p)
 stamp(im,18,8,'''..AAAA..
.AFGGFA.
AFGGOFBA
AFGFFBBA
ABFBAAEA
.ABA.AAA
..AAA.A.''',p)
 # Three distinct near feet, without a continuous black ground bar.
 stamp(im,6,14,'''AAA
ABA
.AA''',p)
 stamp(im,12,14,'''AAA
ABA
.AA''',p)
 stamp(im,17,14,'''AAA
ABA
.AAA''',p)
 return locate(im),p,{'B':'C','D':'C','E':'C','G':'F','O':'B'}

ENTRIES=[('bog-crawler','ボグクロウラー',bog),('reed-serpent','リードサーペント',serpent),('silt-jelly','シルトジェリー',jelly),('bloat-grub','ブロートグラブ',grub)]
def preview(im,n=8,bg=BG):
 out=Image.new('RGBA',im.size,bg);out.alpha_composite(im)
 return out.convert('RGB').resize((32*n,32*n),Image.Resampling.NEAREST)
def stage(im,pal,remap,kind):
 out=im.copy();lookup={rgba(pal[a]):rgba(pal[b]) for a,b in remap.items()}
 for y in range(32):
  for x in range(32):
   p=im.getpixel((x,y))
   if p[3]:out.putpixel((x,y),rgba(INK) if kind=='silhouette' else lookup.get(p,p))
 return out
def stats(im):
 pts=[];gaps=[]
 for y in range(32):
  for x in range(32):
   p=im.getpixel((x,y))
   if p[3]:
    pts.append(p)
    if p!=rgba(INK) and any(not(0<=a<32 and 0<=b<32) or not im.getpixel((a,b))[3] for a,b in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):gaps.append([x,y])
 b=im.getbbox()
 return {'canvas':[32,32],'bbox':b,'visible_size':[b[2]-b[0],b[3]-b[1]],'colors':len(set(pts)),'opaque_pixels':len(pts),'unoutlined_boundary':gaps}
def main():
 imgs={};report={}
 board=Image.new('RGB',(1120,396),'#25232a');d=ImageDraw.Draw(board)
 d.text((18,12),'石の層 / 6F以降に出るボグ系4体',font=f(23),fill='white')
 stages=Image.new('RGB',(880,1340),'#25232a');sd=ImageDraw.Draw(stages)
 sd.text((18,12),'原寸の外形 → 材質の色面 → 陰影・識別点',font=f(22),fill='white')
 for i,(slug,name,fn) in enumerate(ENTRIES):
  im,pal,remap=fn();imgs[slug]=im;report[slug]=stats(im)
  assert not report[slug]['unoutlined_boundary'], (slug,report[slug]['unoutlined_boundary'])
  im.save(P/f'{slug}-32.png');preview(im).save(P/f'{slug}-8x.png')
  x=16+i*280;d.text((x,55),name,font=f(17),fill='#f0e9dc');board.paste(preview(im),(x,86))
  for j,bg in enumerate([BG,'#20202c','#b8b1a2']):board.paste(preview(im,1,bg),(x+35+j*75,352))
  for j,k in enumerate(['silhouette','flat','final']):
   s=im if k=='final' else stage(im,pal,remap,k);s.save(Q/f'{slug}-{k}-32.png');stages.paste(preview(s),(16+j*292,70+i*316))
  sd.text((18,47+i*316),name,font=f(15),fill='white')
 board.save(P/'lineup.png');stages.save(P/'stages.png')
 (Q/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
 # Same-density view: approved sprites remain read-only.
 refs=[('基準 / ハウンド',Image.open(P.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png').convert('RGBA')),('採用 / トード',Image.open(P.parent/'ash-toad-form-restore-v10/ash-toad-32.png').convert('RGBA')),('暫定採用 / 蜘蛛',Image.open(P.parent/'dust-spider-native-v9/dust-spider-32.png').convert('RGBA'))]
 compare=Image.new('RGB',(1120,644),'#25232a');cd=ImageDraw.Draw(compare)
 cd.text((18,12),'採用稿と新規候補 / 全て6倍表示',font=f(23),fill='white')
 for i,(label,ref) in enumerate(refs):
  # Existing floor level is y=20; retain the hound's original shadow below it.
  ref2=canvas();ref2.alpha_composite(ref,(0,4));x=16+i*280
  cd.text((x,55),label,font=f(15),fill='#eee7d5');compare.paste(preview(ref2,6),(x,82))
 for i,(slug,name,_) in enumerate(ENTRIES):
  x=16+i*280;cd.text((x,315),name,font=f(16),fill='#eee7d5');compare.paste(preview(imgs[slug],6),(x,345));compare.paste(preview(imgs[slug],1),(x+80,554))
 cd.text((18,612),'新規4体は確認待ち / 32px原寸で作画 / ぼかし・縮小・旧64px稿の流用なし',font=f(14),fill='#c2bac6')
 compare.save(P/'comparison.png')
if __name__=='__main__':main()
