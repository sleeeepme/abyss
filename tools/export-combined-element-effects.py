import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from canvas_command_rasterizer import render
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/combined-element-effects-v13';data=json.loads((OUT/'frames.json').read_text())
elements=data['elements'];weapons=data['weapons'];frames=data['frames'];N=len(frames);CW=218;CH=157
labels={'fire':'炎','shock':'雷','frost':'冷気','arcane':'魔法'}
colors={'fire':'#ffad72','shock':'#fff171','frost':'#a1edff','arcane':'#d6a1ff'}
font=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',11)
cards={}
for kind,cfg in weapons.items():
 for element in elements:
  seq=[]
  for frame in frames:
   card=Image.new('RGB',(CW,CH),'#111917');d=ImageDraw.Draw(card)
   d.text((7,3),cfg['label']+' / '+labels[element],font=font,fill=colors[element])
   card.paste(render(frame[kind+'-'+element],(320,170)).crop((65,22,283,156)),(0,23));seq.append(card)
  cards[(kind,element)]=seq
 print('Rasterized',kind,flush=True)
def save(seq,name,duration=25):
 sheet=Image.new('RGB',(seq[0].width,seq[0].height*N))
 for i,im in enumerate(seq):sheet.paste(im,(0,i*im.height))
 pal=sheet.quantize(colors=256);idx=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in seq]
 durations=[20 if i%2==0 else 30 for i in range(N)]
 idx[0].save(OUT/name,save_all=True,append_images=idx[1:],duration=durations,loop=0,disposal=2,optimize=False)
 check=Image.open(OUT/name);total=0
 for i in range(check.n_frames):check.seek(i);check.load();total+=check.info['duration']
 assert check.n_frames>1 and total==1000 and check.info.get('loop')==0
 print(name,check.size,check.n_frames,total,(OUT/name).stat().st_size,flush=True)
matrix=[]
for i in range(N):
 im=Image.new('RGB',(CW*4,CH*7),'#111917')
 for row,kind in enumerate(weapons):
  for col,element in enumerate(elements):im.paste(cards[(kind,element)][i],(col*CW,row*CH))
 matrix.append(im)
save(matrix,'all-weapons-attack-and-hit.gif')
for element in elements:
 seq=[]
 for i in range(N):
  im=Image.new('RGB',(CW*2,CH*4),'#111917')
  for j,kind in enumerate(weapons):im.paste(cards[(kind,element)][i],((j%2)*CW,(j//2)*CH))
  d=ImageDraw.Draw(im);d.text((CW+12,CH*3+55),labels[element]+'属性',font=font,fill=colors[element]);d.text((CW+12,CH*3+78),'攻撃軌跡 ＋ ヒット',font=font,fill='#bdc9b5');seq.append(im)
 save(seq,element+'-attack-and-hit.gif')
# Each row is sampled 60 ms after that weapon's own contact, so both layers are visible.
contact=Image.new('RGB',(CW*4,CH*7),'#111917')
for row,(kind,cfg) in enumerate(weapons.items()):
 idx=min(N-1,round((cfg['contact']+.06)/.025))
 for col,element in enumerate(elements):contact.paste(cards[(kind,element)][idx],(col*CW,row*CH))
contact.save(OUT/'contact-sheet.png')
