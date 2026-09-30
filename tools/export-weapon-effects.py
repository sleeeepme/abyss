import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from canvas_command_rasterizer import render
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/weapon-effects-v4'
frames=json.loads((OUT/'frames.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',14)
small=ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',10)
labels={'greatsword':'大剣（採用済み）','hammer':'戦鎚（採用済み）','spear':'槍・刺突','bow':'弓','swordaxe':'剣＆斧','dagger':'短剣'}
notes={'greatsword':'大きな弧と重い一撃','hammer':'放射状に弾ける衝撃','spear':'細く、長く、前へ突き抜ける','bow':'矢の飛翔 → 小さな着弾','swordaxe':'コンパクトな弧と鋭い切先','dagger':'短い間合い、素早い切り抜け'}
cards={k:[] for k in labels}
for f in frames:
    for key in labels:
        card=Image.new('RGB',(328,223),'#111917');d=ImageDraw.Draw(card)
        d.text((10,5),labels[key],font=font,fill='#eef3dd')
        card.paste(render(f[key],(320,170)),(4,29))
        d.text((10,205),notes[key],font=small,fill='#adbaa6')
        cards[key].append(card)
def save_gif(images,path,duration=20):
    # One palette keeps the glow stable between frames; sharp silhouettes remain undithered.
    sheet=Image.new('RGB',(images[0].width,images[0].height*len(images)))
    for i,im in enumerate(images):sheet.paste(im,(0,i*im.height))
    palette=sheet.quantize(colors=256)
    indexed=[im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST).quantize(palette=palette,dither=Image.Dither.NONE) for im in images]
    indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=duration,loop=0,disposal=2,optimize=False)
    check=Image.open(path);total=0
    for i in range(check.n_frames):check.seek(i);check.load();total+=check.info['duration']
    assert check.n_frames>1 and total==len(images)*duration and check.info.get('loop')==0
    print(path.name,check.size,check.n_frames,total)
def grid(keys,columns):
    result=[];rows=(len(keys)+columns-1)//columns
    for i in range(len(frames)):
        im=Image.new('RGB',(328*columns,223*rows+24),'#111917');d=ImageDraw.Draw(im)
        for j,k in enumerate(keys):im.paste(cards[k][i],((j%columns)*328,(j//columns)*223))
        d.text((10,223*rows+5),'ABYSS  /  武器エフェクト  /  通常速度',font=small,fill='#c8d2b3');result.append(im)
    return result
new=grid(['spear','bow','swordaxe','dagger'],2)
save_gif(new,OUT/'new-weapons.gif')
slow=[]
for im in new:
    im=im.copy();d=ImageDraw.Draw(im);d.rectangle((0,446,655,469),fill='#111917');d.text((10,451),'ABYSS  /  武器エフェクト  /  半速で確認',font=small,fill='#c8d2b3');slow.append(im)
save_gif(slow,OUT/'new-weapons-slow.gif',40)
for k in labels:save_gif(cards[k],OUT/(k+'.gif'))
# Inspect flight before impact, and each new weapon near its peak.
sheet=Image.new('RGB',(656,446),'#111917')
for j,(k,i) in enumerate([('spear',3),('bow',6),('swordaxe',3),('dagger',2)]):sheet.paste(cards[k][i],((j%2)*328,(j//2)*223))
sheet.resize((1312,892),Image.Resampling.NEAREST).save(OUT/'new-weapons-contact-sheet.png')
