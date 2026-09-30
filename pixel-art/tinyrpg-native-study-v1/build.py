"""Native-grid transcription, role analysis and tightly bounded edits.

Official originals stay in local source/. This is a local editing study, not
model training or a redistributable asset pack. No spatial resampling at 1x.
"""
from pathlib import Path
from collections import Counter
import json
from PIL import Image, ImageDraw, ImageFont

P = Path(__file__).resolve().parent
Q = P / 'quality'
Q.mkdir(exist_ok=True)
FONT = '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def font(n): return ImageFont.truetype(FONT, n)
BG = '#565358'
SPECS = {
 'demon': {
  'source': 'Demon_A', 'label': 'Demon A / 正規原本',
  'colors': '000000 4a142c 5c2c26 6f1a29 7e222a 44534b 972f2f 754b38 4d5a53 972f34 655457 596c5d a6483a 7b6a6b 738a74 7e8881 8d8080 9a918f 929894 d79970 a6aba8',
  'ash': '100d15 29202c 45382e 302d3c 454152 384442 595361 75634c 4b5b56 686271 817865 617568 88828c b9ad91 8c9c84 83948d d0c4a8 e0d4b5 b0bab2 d99a3b d1d5c4',
  'roles': {'A':'outline', **{c:'body' for c in 'BCDEGHJM'}, **{c:'horn' for c in 'KNQR'}, **{c:'metal' for c in 'FILOPSU'}, 'T':'focus'},
  'flat': {'outline':'000000','body':'7e222a','horn':'7b6a6b','metal':'4d5a53','focus':'d79970'},
  'details': 'NQRSTU',
  'rows': '''....AA........A.....
....AKA......ARA....
....AKA......ARA....
....AKNAA....AQA....
.....ANQQAA.ANNA....
......AKNADADAA.....
......AAAEEJMDA.....
.....AQKEAAJMANA....
......ADEBTJJTA.....
.......AEEJJJEA.....
..A..AAFDAADADA.....
.AE.AFLOAAIAAA......
AJA.AAFAEDLA........
AEAAEGAEJDAEA....AAA
.ADAEACAAAAAAAAAAIPA
.AADAHCIIIIIIIIIPPUA
...AAAAAPPPIIIPSSUUA
....ADA.ASSPPPSUUUA.
........ASSSSUUSAA..
.........AAAAAAA....''',
  'note': '角・肌・刃に別の色群。明部は材質ごとに配置。',
  'edit_note': '左角だけを短く欠けさせる',
 },
 'blood': {
  'source': 'Blood Monster_A', 'label': 'Blood Monster A / 正規原本',
  'colors': '000000 1f1a1a 311339 6e1438 a22b4b cf4554 c0bfbf d9d8d8',
  'ash': '100d15 211723 302635 48414d 706775 978779 b9ad91 e0d4b5',
  'roles': {'A':'outline','B':'deep','C':'mouth','D':'body','E':'body','F':'body','G':'tooth','H':'tooth'},
  'flat': {'outline':'000000','deep':'1f1a1a','mouth':'311339','body':'a22b4b','tooth':'d9d8d8'},
  'details': 'FGH',
  'rows': '''........AAAA........
.......ADHHA..A.....
......AEEDCCAAHA....
......ADGHHCCCDA....
.....ADDDCCCCHGA....
.....AEBGHHCCCDA....
....ADEDCCCCCHGA....
...ADDEBGHCCCCA.....
..AADAEDBCCCHAA.....
.ADEEAEEEDDFAAEA....
.AFEADEEEEEEEAAEAA..
AEDEAEEEEEEEEEAEDEA.
AEDEAEEEEDDDEEAEEDEA
ADAEADEDAAAAEA.AEAEA
.A.A.ADA...ADA..A.A.''',
  'note': '赤い大面積＋紫の口腔。明赤は2px、牙は小さく。',
  'edit_note': '上顎の牙だけを縦の尖りへ',
 }
}

def rgba(h): return tuple(bytes.fromhex(h)) + (255,)
def grid_im(rows, pal):
 rows = rows.splitlines() if isinstance(rows,str) else rows
 assert len({len(r) for r in rows}) == 1
 im = Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,row in enumerate(rows):
  for x,c in enumerate(row):
   if c!='.': im.putpixel((x,y),pal[c])
 return im
def cell(im):
 out=Image.new('RGBA',(32,32));out.alpha_composite(im,((32-im.width)//2,27-im.height));return out
def preview(im, scale=8, bg=BG):
 out=Image.new('RGBA',im.size,bg);out.alpha_composite(im)
 return out.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
def changed(a,b):
 assert a.size==b.size
 return [[x,y] for y in range(a.height) for x in range(a.width) if a.getpixel((x,y))!=b.getpixel((x,y))]
def stat(im):
 counts=Counter(p for p in im.get_flattened_data() if p[3]);edge=[]
 for y in range(im.height):
  for x in range(im.width):
   p=im.getpixel((x,y))
   if p[3] and p[:3]!=(0,0,0) and any(not(0<=a<im.width and 0<=b<im.height) or not im.getpixel((a,b))[3] for a,b in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):edge.append([x,y])
 return {'size':im.size,'opaque':sum(counts.values()),'colors':len(counts),'palette':{'#%02x%02x%02x'%p[:3]:n for p,n in counts.items()},'nonblack_boundary':edge}

def study(spec):
 pal={chr(65+i):rgba(c) for i,c in enumerate(spec['colors'].split())}
 ash={chr(65+i):rgba(c) for i,c in enumerate(spec['ash'].split())}
 ref_path=next(f for f in (P/'source').rglob(spec['source']+'_Idle.png') if 'with shadows' not in str(f))
 sheet=Image.open(ref_path).convert('RGBA');original=sheet.crop((0,0,100,100));bbox=original.getbbox();original=original.crop(bbox)
 replica=grid_im(spec['rows'],pal)
 assert not changed(original,replica), 'Transcription differs from official original'
 rows=spec['rows'].splitlines()
 silhouette=grid_im(rows,{c:rgba('17131f') for c in pal})
 flat=grid_im(rows,{c:rgba(spec['flat'][spec['roles'][c]]) for c in pal})
 detail=grid_im(rows,{c:(pal[c] if c in spec['details'] else (0,0,0,0)) for c in pal})
 recolor=grid_im(rows,ash);edited=[list(r) for r in rows]
 if spec['source']=='Demon_A':
  for x,y,c in [(4,0,'.'),(5,0,'.'),(4,1,'.'),(5,1,'.'),(6,1,'.'),(4,2,'.'),(5,2,'A'),(6,2,'A'),(4,3,'.'),(5,3,'A')]:edited[y][x]=c
  region=(4,0,7,4)
 else:
  for x,y,c in [(10,3,'C'),(9,4,'H'),(13,5,'H')]:edited[y][x]=c
  region=(9,3,14,6)
 edit=grid_im(edited,ash);delta=changed(recolor,edit)
 assert all(region[0]<=x<region[2] and region[1]<=y<region[3] for x,y in delta)
 diff=Image.new('RGBA',edit.size)
 for y in range(edit.height):
  for x in range(edit.width):
   if recolor.getpixel((x,y))[3]:diff.putpixel((x,y),rgba('3b3941'))
 for xy in delta:diff.putpixel(tuple(xy),rgba('ffc866'))
 return [original,silhouette,flat,detail], [original,recolor,edit,diff], {'source':str(ref_path.relative_to(P)),'cell_bbox':bbox,'native':stat(original),'reconstruction_mismatch_pixels':len(changed(original,replica)),'local_edit_pixels':len(delta),'local_edit_coordinates':delta,'unchanged_outside_region':True,'region':region}

def main():
 stages={};variants={};report={}
 for slug,spec in SPECS.items():
  stages[slug],variants[slug],report[slug]=study(spec)
  for name,im in zip(['original','silhouette','material-masses','highlights'],stages[slug]):cell(im).save(P/f'{slug}-{name}-32.png')
  for name,im in zip(['original','palette-only','local-edit','changes'],variants[slug]):
   cell(im).save(P/f'{slug}-{name}-32.png');preview(cell(im)).save(P/f'{slug}-{name}-8x.png')
 width=1160
 for filename,groups,labels,title in [
  ('anatomy.png',stages,['原寸原本','外形','材質・大きな色面','明部・焦点の画素'],'TinyRPG / 原寸2体の構造を分解'),
  ('exercises.png',variants,['原寸原本','配色だけ変更','一部分だけ変更','変更画素（配色後との差）'],'TinyRPG / 描き方を固定した局所変更の習作')]:
  board=Image.new('RGB',(width,872),'#232229');d=ImageDraw.Draw(board)
  d.text((24,18),title,font=font(24),fill='#f0ece3')
  d.text((24,56),'公式無料版・待機の第1フレーム / 32pxセル / 上：8倍表示、下：原寸 / 空間的な縮小なし',font=font(13),fill='#aba5b0')
  for j,label in enumerate(labels):d.text((24+j*282,89),label,font=font(16),fill='#d6cfbf')
  for i,(slug,spec) in enumerate(SPECS.items()):
   top=128+i*350
   for j,im in enumerate(groups[slug]):
    c=cell(im);board.paste(preview(c),(24+j*282,top));board.paste(preview(c,1),(28+j*282,top+269))
   d.text((24,top+310),spec['label'],font=font(13),fill='#f0ece3')
   d.text((380,top+310),spec['note'] if filename=='anatomy.png' else spec['edit_note'],font=font(13),fill='#c7bfcb')
  d.text((24,835),'再構成は2体とも原本との差分0。局所変更の範囲外は配色変更版と完全一致。新しい生物への応用は未検証。',font=font(13),fill='#d7c6a4')
  board.save(P/filename)
 (Q/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
 print(json.dumps({k:{'native':v['native']['size'],'colors':v['native']['colors'],'reconstruction_mismatch':v['reconstruction_mismatch_pixels'],'local_edit_pixels':v['local_edit_pixels']} for k,v in report.items()},ensure_ascii=False))

if __name__=='__main__':main()
