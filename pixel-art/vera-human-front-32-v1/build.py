from pathlib import Path
import sys,json
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
from PIL import Image
ROOT=Path(__file__).resolve().parent
src=Image.open(ROOT/'reference-generated.png').convert('RGBA')
p=src.load()
for y in range(src.height):
 for x in range(src.width):
  r,g,b,a=p[x,y]
  if r>g+55 and b>g+55 and r>135 and b>135:p[x,y]=(0,0,0,0)
src=src.crop(src.getbbox())
height=28;width=round(src.width/src.height*height)
canvas=Image.new('RGBA',(32,32))
canvas.paste(src.resize((width,height),Image.Resampling.NEAREST),((32-width)//2,2))
canvas.save(ROOT/'import.png')
s=Sprite.from_png(str(ROOT/'import.png'),scale=1)
palette=['#10151e','#252a30','#3f3d3c','#5b5247','#243e49','#3b6068','#587b80','#8da09c',
 '#77654f','#a28764','#c5ac84','#e5cea6','#f9e5c3','#5b402b','#a17540','#e6b65d']
s.clean(palette=palette,harden=True,despeckle_min=0,dedupe_tol=0)
# Native pixel repairs are kept here so all deliverables are reproducible.
ink='#10151e';bone='#c5ac84';light='#f9e5c3';teal='#3b6068'
# Restore the long bow as one connected thin crescent, maintaining open space.
s.line(20,2,23,4,bone)
s.line(22,3,25,7,light)
s.line(25,7,27,11,bone)
s.line(26,10,25,14,'#77654f')
s.line(25,14,26,18,'#77654f')
s.line(26,18,24,22,light)
s.line(24,22,22,24,bone)
s.px(27,12,None)
# Keep the empty draw readable; no physical arrow.
s.line(20,4,16,11,'#77654f')
s.line(16,11,22,23,'#77654f')
# Hood rim and tiny skeletal face; depth is carried by the dark face opening.
s.polygon([(13,6),(14,4),(16,5),(17,7),(17,10),(15,11),(13,9)],'#243e49')
s.line(14,5,16,7,'#587b80')
s.polygon([(14,8),(15,6),(16,7),(17,9),(15,10)],ink)
s.px(15,8,bone);s.px(16,8,'#e6b65d')
s.px(15,9,'#e5cea6');s.px(14,9,'#77654f')
# Empty quiver: dark two-pixel opening above the shoulder.
s.line(10,6,11,6,'#a28764')
s.line(10,7,11,7,ink)
s.px(10,8,'#77654f')
# Draw forearm, fingertip and extended bow arm occupy separate rows.
s.line(10,10,15,11,bone)
s.px(11,10,'#e5cea6');s.px(13,10,light)
s.line(15,11,16,11,light)
s.px(16,12,bone)
s.line(18,12,22,13,bone)
s.px(20,12,'#e5cea6');s.px(22,13,'#77654f')
s.line(23,13,25,13,ink);s.px(24,13,bone)
# Source cape tips should remain attached at this reduced resolution.
s.px(9,18,None);s.px(21,18,None)
s.px(19,15,ink);s.px(18,15,'#243e49')
# One-pixel boot toes establish stable ground contact.
s.line(6,29,8,29,'#77654f')
s.line(23,29,24,29,'#77654f')
s.save_png(str(ROOT/'front-32.png'))
s.save_png(str(ROOT/'front-512.png'),scale=16)
s.save_png(str(ROOT/'preview.png'),scale=16,bg='#727980')
s.save_png(str(ROOT/'preview-dark.png'),scale=16,bg='#242735')
s.save_silhouette(str(ROOT/'silhouette.png'),scale=16)
s.save_swatch(str(ROOT/'palette.png'))
stats=s.stats()
(ROOT/'stats.json').write_text(json.dumps(stats,indent=2))
im=Image.open(ROOT/'front-32.png').convert('RGBA')
display=Image.open(ROOT/'front-512.png').convert('RGBA')
assert im.size==(32,32) and display.size==(512,512)
assert display.tobytes()==im.resize((512,512),Image.Resampling.NEAREST).tobytes()
assert set(im.getchannel('A').getdata())=={0,255}
assert len(s.used_colors())<=16
print('PASS 32px native / 16 colors / transparent / exact 16x output')
