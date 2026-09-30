import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from canvas_command_rasterizer import render
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/element-effects-v5'
meta=json.loads((OUT/'palette.json').read_text());elements=meta['elements'];weapons=meta['weapons']
font=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',12)
small=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',10)
cards={};N=40;CW=218;CH=157
for kind,weapon in weapons.items():
 for element,palette in elements.items():
  frames=json.loads((OUT/(kind+'-'+element+'.json')).read_text());seq=[]
  for commands in frames:
   card=Image.new('RGB',(CW,CH),'#111917');d=ImageDraw.Draw(card)
   d.text((7,3),weapon['label']+' / '+palette['label'],font=font,fill=palette['core'])
   card.paste(render(commands,(320,170)).crop((65,22,283,156)),(0,23));seq.append(card)
  cards[(kind,element)]=seq
 print('Rasterized',kind,flush=True)
def save(images,name,scale=1,slow=False):
 sheet=Image.new('RGB',(images[0].width,images[0].height*N))
 for i,im in enumerate(images):sheet.paste(im,(0,im.height*i))
 palette=sheet.quantize(colors=256);indexed=[im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST).quantize(palette=palette,dither=Image.Dither.NONE) for im in images]
 durations=[50 if slow else (20 if i%2==0 else 30) for i in range(N)]
 indexed[0].save(OUT/name,save_all=True,append_images=indexed[1:],duration=durations,loop=0,disposal=2,optimize=False)
 check=Image.open(OUT/name);total=0
 for i in range(check.n_frames):check.seek(i);check.load();total+=check.info['duration']
 assert check.n_frames>1 and total==(2000 if slow else 1000) and check.info.get('loop')==0
 print(name,check.size,check.n_frames,(OUT/name).stat().st_size,flush=True)
for kind in weapons:
 seq=[]
 for i in range(N):
  im=Image.new('RGB',(CW*5,CH),'#111917')
  for j,element in enumerate(elements):im.paste(cards[kind,element][i],(j*CW,0))
  seq.append(im)
 save(seq,kind+'-elements.gif',2)
# Magic projectile focus: three columns, with a quiet sixth cell for the caption.
magic=[]
for i in range(N):
 im=Image.new('RGB',(CW*3,CH*2),'#111917')
 for j,element in enumerate(elements):im.paste(cards['magicbolt',element][i],((j%3)*CW,(j//3)*CH))
 d=ImageDraw.Draw(im);d.text((CW*2+12,CH+45),'杖攻撃：魔弾',font=font,fill='#edf0df');d.text((CW*2+12,CH+72),'光の塊 → 尾 → 着弾',font=small,fill='#b5c4a8');magic.append(im)
save(magic,'magicbolt-five-elements.gif',2)
save(magic,'magicbolt-five-elements-slow.gif',2,True)
matrix=[]
for i in range(N):
 im=Image.new('RGB',(CW*5,CH*7),'#111917')
 for row,kind in enumerate(weapons):
  for col,element in enumerate(elements):im.paste(cards[kind,element][i],(col*CW,row*CH))
 matrix.append(im)
save(matrix,'all-weapons-all-elements.gif')
matrix[4].save(OUT/'all-elements-preview.png')
magic[5].resize((CW*6,CH*4),Image.Resampling.NEAREST).save(OUT/'magicbolt-flight.png')
