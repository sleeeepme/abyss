import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from canvas_command_rasterizer import render
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/element-hits-v13';frames=json.loads((OUT/'frames.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',14);small=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',10)
labels={'fire':'炎','shock':'雷','frost':'冷気','arcane':'魔法'};notes={'fire':'小さな火の粉だけ','shock':'余韻が残る4方向の電撃','frost':'円形に広がる薄い霜煙','arcane':'密度を増した舞う魔素'}
result=[]
for frame in frames:
 im=Image.new('RGB',(656,446),'#111917');d=ImageDraw.Draw(im)
 for j,e in enumerate(labels):
  x=(j%2)*328;y=(j//2)*223;d.text((x+9,y+4),labels[e],font=font,fill='#eaf0df');im.paste(render(frame[e],(320,170)),(x+4,y+27));d.text((x+9,y+205),notes[e],font=small,fill='#aebca8')
 result.append(im.resize((1312,892),Image.Resampling.NEAREST))
def save(seq,name,duration):
 sheet=Image.new('RGB',(seq[0].width,seq[0].height*len(seq)))
 for i,im in enumerate(seq):sheet.paste(im,(0,i*im.height))
 pal=sheet.quantize(colors=256);idx=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in seq]
 idx[0].save(OUT/name,save_all=True,append_images=idx[1:],duration=duration,loop=0,disposal=2,optimize=False)
 check=Image.open(OUT/name);total=0
 for i in range(check.n_frames):check.seek(i);check.load();total+=check.info['duration']
 assert check.n_frames>1 and total==len(seq)*duration and check.info.get('loop')==0
 print(name,check.size,check.n_frames,total,(OUT/name).stat().st_size)
save(result,'ally-enemy-element-hits.gif',20);save(result,'ally-enemy-element-hits-slow.gif',40)
frost=[im.crop((0,446,656,892)) for im in result]
save(frost,'frost-smoke-hit.gif',20);save(frost,'frost-smoke-hit-slow.gif',40)
shock=[im.crop((656,0,1312,446)) for im in result]
arcane=[im.crop((656,446,1312,892)) for im in result]
save(shock,'shock-hit.gif',20);save(arcane,'arcane-hit.gif',20)
strong=[Image.new('RGB',(656,892),'#111917') for _ in result]
for i in range(len(result)):
 strong[i].paste(shock[i],(0,0));strong[i].paste(arcane[i],(0,446))
save(strong,'shock-arcane-hits.gif',20)
result[4].save(OUT/'contact.png')
