from pathlib import Path
import json,sys,zipfile
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite

ROOT=Path(__file__).resolve().parent
RUNTIME='/Users/daisukey.oshida/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
APPROVED=ROOT.parent/'stone-benchmark-v2'/'crawling-dead-32.png'
SPECS={
 'praying-dead':('プレイングデッド',(22,25)),
 'dead-sprinter':('デッドスプリンター',(28,22)),
 'bog-crawler':('ボグクロウラー',(29,20)),
 'silt-jelly':('シルトジェリー',(24,25)),
}
PALETTES={
 'praying-dead':['#140f14','#392d30','#6b4b45','#8d6254','#b27d68','#2b4144','#456566','#72908a','#81776e','#afa28e','#e4d6ba','#704638','#a66c50'],
 'dead-sprinter':['#140f14','#392d30','#6b594a','#92785d','#c0aa8e','#847b73','#b9ad97','#eadcc6','#263b3e','#3f6465','#6f8c87','#633b31','#9a5f42'],
 'bog-crawler':['#120f14','#30391f','#586738','#89955d','#3a2c2e','#62504a','#8a7362','#67705d','#9aa084','#c1c2a5','#6b3718','#c77a22','#f2c34a'],
 'silt-jelly':['#140f14','#263a3a','#3f5d58','#60877b','#91aa93','#aec4aa','#73593c','#a1814f','#c6a25e','#293638','#49655f','#21151d','#d1d3ac'],
}

def finish_palette(s,key):
    # Use every palette entry as a material plane, never as random speckle.
    if key=='praying-dead':
        for x,y in [(17,6),(18,6),(17,7)]:s.px(x,y,'#b27d68')
        for x,y in [(15,23),(15,24),(15,25)]:s.px(x,y,'#72908a')
        for x,y in [(24,18),(25,18),(24,19)]:s.px(x,y,'#81776e')
        for x,y in [(19,16),(20,16),(19,17)]:s.px(x,y,'#a66c50')
        for x,y in [(10,25),(11,25),(10,26)]:s.px(x,y,'#704638')
    elif key=='bog-crawler':
        for x,y in [(22,18),(22,19)]:s.px(x,y,'#6b3718')
    elif key=='silt-jelly':
        for x,y in [(14,5),(15,5),(16,5)]:s.px(x,y,'#d1d3ac')

def count_colors(im): return len({p[:3] for p in im.getdata() if p[3]})

reports=[]
for key,(jp,size) in SPECS.items():
    src=Image.open(ROOT/'sources'/f'{key}.png').convert('RGBA')
    alpha=src.getchannel('A').point(lambda a:255 if a>=180 else 0)
    src.putalpha(alpha);src=src.crop(alpha.getbbox())
    src=src.resize(size,Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(32,32))
    x=(32-size[0])//2;y=29-size[1]
    canvas.paste(src,(x,y),src)
    sample=ROOT/'quality'/f'{key}-sample.png';canvas.save(sample)
    s=Sprite.from_png(str(sample),scale=1)
    s.clean(palette=PALETTES[key],harden=True,despeckle_min=2,dedupe_tol=0)
    finish_palette(s,key)
    out=ROOT/'native-32'/f'{key}.png'
    s.save_png(str(out));s.save_png(str(ROOT/'native-32'/f'{key}@8x.png'),scale=8,bg='#6e6e6e')
    s.save_silhouette(str(ROOT/'quality'/f'{key}-silhouette.png'),scale=8)
    im=Image.open(out).convert('RGBA');box=im.getbbox();colors=count_colors(im)
    report={'id':key,'name':jp,'canvas':list(im.size),'opaque_bounds':list(box),'body_size':[box[2]-box[0],box[3]-box[1]],'colors':colors,'alpha':sorted(set(im.getchannel('A').getdata()))}
    assert report['alpha']==[0,255] and colors==13 and box[0]>0 and box[1]>0 and box[2]<32 and box[3]<32,report
    reports.append(report)

(ROOT/'quality'/'stats.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))

# Exact 4x comparison: the reference JPEG already displays native pixels at ~4x;
# our sprites are enlarged with nearest neighbor to exactly 4x.
board=Image.new('RGB',(860,290),'#6e6e6e');d=ImageDraw.Draw(board)
f=ImageFont.truetype(FONT,15);small=ImageFont.truetype(FONT,11)
d.text((18,14),'リファレンスと同じ1ドット=4px / 全作32pxセル・13色',font=f,fill='#eee4d3')
if REF.exists():
    ref=Image.open(REF).convert('RGB').crop((48,287,138,365));board.paste(ref,(20,78));d.text((20,180),'参照',font=f,fill='#eee4d3')
items=[('crawling-dead','クロウリングデッド',APPROVED)]+[(k,jp,ROOT/'native-32'/f'{k}.png') for k,(jp,_) in SPECS.items()]
for i,(key,jp,path) in enumerate(items):
    im=Image.open(path).convert('RGBA').resize((128,128),Image.Resampling.NEAREST)
    x=130+i*145;board.paste(im,(x,55),im);d.text((x,188),jp,font=small,fill='#eee4d3')
board.save(ROOT/'comparison.png')

sheet=Image.new('RGB',(840,365),'#25262d');d=ImageDraw.Draw(sheet);d.text((20,14),'石の層 追加4体 / 8倍表示',font=f,fill='#eee4d3')
for i,(key,(jp,_)) in enumerate(SPECS.items()):
    im=Image.open(ROOT/'native-32'/f'{key}.png').resize((256,256),Image.Resampling.NEAREST)
    x=5+i*207;sheet.paste(im,(x,52),im);d.text((x+10,316),jp,font=f,fill='#eee4d3')
sheet.save(ROOT/'overview.png')

with zipfile.ZipFile(ROOT/'sprites.zip','w',zipfile.ZIP_DEFLATED) as z:
    for key in SPECS:z.write(ROOT/'native-32'/f'{key}.png',f'{key}.png')
print(json.dumps(reports,ensure_ascii=False,indent=2))
