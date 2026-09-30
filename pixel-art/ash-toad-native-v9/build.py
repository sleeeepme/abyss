from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path(__file__).resolve().parent
Q=P/'quality';Q.mkdir(exist_ok=True)
PAL={'A':'#100d15','B':'#33313f','C':'#666273','D':'#97909a','E':'#777764','F':'#91816a','G':'#c4b79a','O':'#dd9b43'}
BG='#565358';FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def f(n):return ImageFont.truetype(FONT,n)
def rgba(h):return (*bytes.fromhex(h[1:]),255)
# Native rows, authored for this frog. Each tuple is (start column, symbols).
ROWS=[
 (11,'AAA'),
 (10,'ACDCA..AAA'),
 (10,'ACOB A.ACOBA'.replace(' ','')),
 (7,'AAACCBBCACBBCA'),
 (5,'AACEEECCCCCCCCCCA'),
 (3,'AACEECCCCCCCCCCCCBA'),
 (2,'ACCCCCBBBCCBAAAAAAAA'),
 (1,'ACDDCCBAABCBFFGGGFFA'),
 (1,'ACDCCBAC CABFGGGGFFA'.replace(' ','')),
 (0,'ACCCCBACCCABFGGGFFA'),
 (0,'ACBBBACCCCABBFFFFA'),
 (0,'ABCCCCCBBABAACCBBA'),
 (1,'ABCCCBBBAA..ACCBA'),
 (2,'ABBBBAAA...ACDCBA'),
 (1,'AAAAAAA....AAAAAAAA'),
]
def sprite(stage='final',kind='B'):
 im=Image.new('RGBA',(22,15))
 for y,(start,row) in enumerate(ROWS):
  assert start+len(row)<=22,(y,start,row)
  for x,c in enumerate(row,start):
   if c!='.':im.putpixel((x,y),rgba(PAL[c]))
 if kind=='A':
  # Side-facing alternative: one eye mound, a lower rear head.
  for y in range(3):
   for x in range(10,15):im.putpixel((x,y),(0,0,0,0))
 elif kind=='C':
  # Throat-heavy alternative: broader front profile.
  for y,xs in [(7,range(19,22)),(8,range(18,22)),(9,range(17,21)),(10,range(17,20))]:
   for x in xs:im.putpixel((x,y),rgba(PAL['A']))
 if stage=='silhouette':
  for y in range(15):
   for x in range(22):
    if im.getpixel((x,y))[3]:im.putpixel((x,y),rgba(PAL['A']))
 elif stage=='flat':
  remap={rgba(PAL[c]):rgba(PAL['C']) for c in 'BD E'.replace(' ','')}
  remap[rgba(PAL['G'])]=rgba(PAL['F']);remap[rgba(PAL['O'])]=rgba(PAL['B'])
  for y in range(15):
   for x in range(22):
    p=im.getpixel((x,y));im.putpixel((x,y),remap.get(p,p))
 out=Image.new('RGBA',(32,32));out.alpha_composite(im,(5,6));return out
def preview(im,n=8,bg=BG):
 out=Image.new('RGBA',im.size,bg);out.alpha_composite(im)
 return out.convert('RGB').resize((im.width*n,im.height*n),Image.Resampling.NEAREST)
def main():
 board=Image.new('RGB',(864,390),'#25232a');d=ImageDraw.Draw(board)
 d.text((20,12),'ASH TOAD / 原寸シルエット比較',font=f(22),fill='white')
 for i,k in enumerate('ABC'):
  s=sprite('silhouette',k);s.save(Q/f'silhouette-{k}-32.png');board.paste(preview(s),(16+i*288,58));board.paste(preview(s,1),(20+i*288,332))
  d.text((64+i*288,339),{'A':'低い横向き','B':'二つの眼丘','C':'喉袋を強調'}[k],font=f(15),fill='white')
 board.save(Q/'silhouette-options.png')
 im=sprite();preview(im).save(Q/'draft.png')
 gaps=[]
 for y in range(32):
  for x in range(32):
   p=im.getpixel((x,y))
   if p[3] and p!=rgba(PAL['A']) and any(not(0<=a<32 and 0<=b<32) or not im.getpixel((a,b))[3] for a,b in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):gaps.append([x-5,y-6])
 print('unoutlined boundary:',gaps)
 assert not gaps,gaps
 im.save(P/'ash-toad-32.png');preview(im).save(P/'ash-toad-8x.png')
 im.resize((256,256),Image.Resampling.NEAREST).save(P/'ash-toad-8x-transparent.png')
 b=im.getbbox();pixels=[p for p in im.get_flattened_data() if p[3]]
 report={'canvas':[32,32],'bbox':b,'visible_size':[b[2]-b[0],b[3]-b[1]],'colors':len(set(pixels)),'opaque_pixels':len(pixels),'unoutlined_boundary_pixels':gaps,'selected_silhouette':'B','spatial_downsampling':False,'old_sprite_pixels_used_in_new_sprite':0}
 (Q/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
 board=Image.new('RGB',(864,390),'#25232a');d=ImageDraw.Draw(board)
 d.text((20,12),'ASH TOAD / 原寸からの制作工程',font=f(22),fill='white')
 for i,(stage,label) in enumerate([('silhouette','1. 眼丘・後腿・前脚'),('flat','2. 皮膚と喉の色面'),('final','3. 陰影と琥珀の目')]):
  s=sprite(stage);board.paste(preview(s),(16+i*288,58));board.paste(preview(s,1),(20+i*288,332));d.text((64+i*288,339),label,font=f(14),fill='white')
 board.save(P/'stages.png')
 refs=P.parent/'tinyrpg-native-study-v1'
 blood=Image.open(refs/'blood-original-32.png').convert('RGBA')
 shifted=Image.new('RGBA',(32,32));shifted.alpha_composite(blood,(0,-6))
 hound=Image.open(P.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png').convert('RGBA')
 spider=Image.open(P.parent/'dust-spider-native-v9/dust-spider-32.png').convert('RGBA')
 old=Image.open(P.parent/'stone-small-enemies-v8/ash-toad-32.png').convert('RGBA')
 items=[('TinyRPG / Blood',shifted),('Ash Hound / 基準',hound),('Dust Spider / v9',spider),('Ash Toad / 前回',old),('Ash Toad / 今回',im)]
 board=Image.new('RGB',(1100,360),'#25232a');d=ImageDraw.Draw(board)
 d.text((16,12),'ASH TOAD / 同じ画素密度で比較',font=f(22),fill='white')
 for i,(label,s) in enumerate(items):
  x=16+i*218;d.text((x,55),label,font=f(13),fill='#ebe4d5');board.paste(preview(s,6),(x,86))
  for j,bg in enumerate([BG,'#20202c','#b8b1a2']):board.paste(preview(s,1,bg),(x+12+j*61,292))
 d.text((16,338),'上：6倍、下：原寸3背景 / 今回は22×15px・8色 / 輪郭・口・後腿の折り目を暗色で整理',font=f(12),fill='#c6beca')
 board.save(P/'comparison.png')
if __name__=='__main__':main()
