from pathlib import Path
import sys,json
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
ROOT=Path(__file__).resolve().parent
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
im=Image.open(ROOT/'source.png').convert('RGBA')
a=im.getchannel('A').point(lambda v:255 if v>=180 else 0);im.putalpha(a)
b=a.getbbox();im=im.crop(b)
# Recover the source's deliberately coarse ~30 by 20 logical-pixel design.
# No extra outline: the authored outline is already one logical pixel wide.
im=im.resize((30,20),Image.Resampling.NEAREST)
canvas=Image.new('RGBA',(32,32));canvas.paste(im,(1,9))
canvas.save(ROOT/'quality'/'sample.png')
s=Sprite.from_png(str(ROOT/'quality'/'sample.png'),scale=1)
palette=['#140f14','#392b36','#684452','#914856','#ac5b65',
         '#363a49','#525968','#7c8797','#a3a7ae',
         '#857b73','#b7ac95','#e3d6b6','#f2e7cb']
s.clean(palette=palette,harden=True,despeckle_min=2,dedupe_tol=0)
# Match the reference pack's typical small-monster budget: 13 visible colors.
# The two added colors are compact top-left light clusters, not scattered texture.
s.px(12,16,'#ac5b65'); s.px(13,16,'#ac5b65')
s.px(22,10,'#f2e7cb'); s.px(23,10,'#f2e7cb'); s.px(22,11,'#f2e7cb')
s.save_png(str(ROOT/'crawling-dead-32.png'))
s.save_png(str(ROOT/'crawling-dead-32@8x.png'),scale=8,bg='#6e6e6e')
s.save_silhouette(str(ROOT/'quality'/'silhouette.png'),scale=8)
out=Image.open(ROOT/'crawling-dead-32.png').convert('RGBA')
stats={'canvas':out.size,'opaque_bounds':out.getbbox(),'colors':len({p[:3] for p in out.getdata() if p[3]}),'alpha':sorted(set(out.getchannel('A').getdata())),'reference_scale':4,'reference_small_monster_color_range':[10,17],'target_colors':13}
assert stats['alpha']==[0,255] and stats['colors']==13
(ROOT/'quality'/'stats.json').write_text(json.dumps(stats,indent=2))
if REF.exists():
    ref=Image.open(REF).convert('RGB')
    board=Image.new('RGB',(630,295),'#6e6e6e');d=ImageDraw.Draw(board)
    font='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
    f=ImageFont.truetype(font,15);small=ImageFont.truetype(font,12)
    d.text((20,14),'参照と同じ画素の大きさで比較（正確な4倍）',font=f,fill='#eee4d3')
    for x,box,label in [(24,(24,197,147,279),'参照：獣'),(218,(48,287,138,365),'参照：跪く敵')]:
        r=ref.crop(box);board.paste(r,(x,88));d.text((x,200),label,font=f,fill='#eee4d3')
    show=out.resize((128,128),Image.Resampling.NEAREST);board.paste(show,(411,54),show)
    d.text((401,200),'新作：這う死者',font=f,fill='#eee4d3')
    d.text((401,225),'32pxセル / 実体30×20px',font=small,fill='#eee4d3')
    board.save(ROOT/'comparison.png')
print(stats)
