from pathlib import Path
import sys,json
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
from PIL import Image,ImageDraw,ImageOps
ROOT=Path(__file__).resolve().parent
C=['#140f12','#242329','#3b3739','#5a5050',
   '#203239','#355159','#547079','#7f9290',
   '#574032','#866144','#b8956c','#e2c79e','#f5e3bc',
   '#3c2927','#ac7744','#e8af45']
s=Sprite(32,32,palette=C)
def p(pts,c):s.polygon(pts,C[c])
def l(a,b,c):s.line(*a,*b,C[c])
def r(box,c):s.rect(*box,C[c])
def sh(pts,c):p(pts,c);s.polygon(pts,C[0],fill=False)
# Broad hooded humanoid silhouette: coherent body, cloak, two separate boots.
p([(11,3),(16,3),(19,6),(19,10),(22,13),(24,15),(24,19),(21,19),
   (20,23),(21,29),(16,29),(15,26),(14,26),(14,29),(9,29),(10,25),
   (9,23),(5,27),(5,22),(3,24),(4,19),(6,15),(7,11),(10,10)],0)
# Empty quiver behind hood, with a dark opening and one leather highlight.
sh([(7,9),(8,7),(10,7),(11,9),(10,13),(7,13)],8)
r((8,8,9,9),0);l((8,10),(8,12),10)
# Cape and shoulders; all material shadows meet an intentional dark seam.
p([(7,12),(10,11),(12,13),(11,18),(8,23),(6,25),(6,21),(4,22),(6,17)],4)
p([(7,14),(10,12),(10,15),(8,17),(6,20),(6,17)],5)
l((7,14),(9,13),6)
p([(8,19),(10,17),(9,21),(7,23)],5)
sh([(17,11),(20,12),(22,15),(21,18),(19,17),(18,15)],4)
p([(18,12),(20,13),(21,14),(19,14)],6)
# Short sturdy legs behind tunic, outward boots and dark split at center.
sh([(11,22),(14,22),(14,26),(13,28),(9,28),(10,26)],2)
l((11,24),(11,26),3)
sh([(16,22),(19,22),(20,27),(20,29),(16,29),(16,26)],1)
l((17,24),(18,26),3)
r((9,28,13,29),0);l((10,28),(12,28),2)
r((16,28,20,29),0);l((17,28),(19,28),2)
# Torso, two-piece tunic, diagonal strap, belt, registration tag.
sh([(10,13),(16,12),(19,15),(18,20),(20,23),(17,25),(14,23),(10,24),(9,22)],1)
p([(11,15),(13,14),(14,19),(12,21),(10,21)],2)
p([(16,15),(18,16),(17,20),(18,22),(16,23),(15,21)],2)
l((11,20),(11,22),3)
l((11,14),(15,19),8)
r((10,19,18,21),0);r((11,20,17,20),9)
r((14,19,16,21),10);s.px(15,20,C[0])
sh([(15,22),(17,22),(17,24),(15,24)],10)
s.px(16,23,C[8])
# Deep hood: outer dark line, muted plane, stepped lit fold and inset face.
sh([(11,3),(15,3),(18,5),(19,8),(18,12),(15,14),(11,12),(9,9),(10,5)],4)
p([(11,5),(12,4),(15,4),(17,6),(17,7),(14,6),(12,8),(10,9)],5)
l((12,4),(14,4),6);l((11,5),(11,7),6)
p([(13,8),(15,6),(17,7),(18,9),(17,12),(15,13),(12,11)],0)
p([(15,8),(16,7),(17,9),(16,11),(15,12),(14,10)],10)
s.px(15,9,C[0]);s.px(17,9,C[15]);s.px(16,11,C[12])
l((11,10),(12,12),6);l((13,12),(14,13),5)
# Bow outer silhouette is a continuous crescent, with no disconnected tips.
sh([(23,1),(26,3),(28,6),(29,10),(28,13),(28,17),(29,21),(27,25),(24,28),
    (25,25),(26,22),(26,19),(25,16),(26,12),(26,9),(25,6)],8)
p([(24,3),(26,4),(27,6),(28,10),(27,11),(26,7)],11)
l((24,3),(25,4),12)
p([(27,19),(28,21),(26,25),(25,26),(27,22)],11)
s.px(27,21,C[12])
r((26,13,28,17),0);l((27,13),(27,17),9)
s.px(27,14,C[14]);s.px(27,16,C[10])
# Empty bowstring kept in subdued ochre, behind hands, never an arrow.
l((25,5),(17,14),9);l((17,14),(25,25),9)
# Near drawing arm: broad sleeve, wrap, hand; black seam under entire forearm.
sh([(8,13),(10,12),(12,13),(12,15),(16,14),(18,14),(18,16),(12,17),(9,16)],8)
p([(9,13),(10,13),(11,14),(11,15),(9,15)],10)
l((12,15),(15,15),11);s.px(13,15,C[9])
s.px(16,14,C[12]);s.px(17,15,C[11])
# Extended far arm and bow-holding fist: heavy closed outlines like reference.
sh([(19,14),(21,14),(22,15),(25,15),(26,14),(28,15),(28,17),(26,18),(23,18),(20,17)],8)
r((20,15,21,16),10);r((23,16,24,16),11)
r((26,15,27,16),10);s.px(27,15,C[12])
# Small flaps below elbow, kept attached to the cloak.
p([(19,18),(20,18),(21,22),(19,21)],4)
# Small bevel clusters and overlap seams, matching the reference's dense linework.
s.px(12,5,C[7]);s.px(13,5,C[6]);s.px(16,5,C[5])
l((10,7),(10,8),5);s.px(11,9,C[4])
s.px(17,11,C[8]);s.px(15,11,C[8])
l((7,12),(8,11),6);s.px(8,12,C[5])
s.px(9,13,C[11]);s.px(10,14,C[9]);s.px(9,15,C[8])
s.px(12,14,C[10]);s.px(14,15,C[9])
s.px(20,15,C[11]);s.px(21,16,C[8]);s.px(23,16,C[10])
s.px(26,16,C[8])
l((11,17),(12,18),3);s.px(13,18,C[2])
l((16,17),(17,18),2)
s.px(11,20,C[14]);s.px(16,23,C[11])
s.px(11,25,C[8]);s.px(12,25,C[9]);s.px(17,25,C[8])
s.px(18,26,C[9]);s.px(11,28,C[3]);s.px(18,28,C[3])
s.save_png(str(ROOT/'front-32.png'))
s.save_png(str(ROOT/'front-512.png'),scale=16)
s.save_png(str(ROOT/'preview.png'),scale=16,bg='#303030')
s.save_png(str(ROOT/'preview-light.png'),scale=16,bg='#a4a3a0')
s.save_silhouette(str(ROOT/'silhouette.png'),scale=16)
stats=s.stats();(ROOT/'stats.json').write_text(json.dumps(stats,indent=2))
base=Image.open(ROOT/'front-32.png').convert('RGBA')
big=Image.open(ROOT/'front-512.png').convert('RGBA')
assert base.size==(32,32) and big.size==(512,512)
assert big.tobytes()==base.resize((512,512),Image.Resampling.NEAREST).tobytes()
assert set(base.getchannel('A').getdata())=={0,255}
assert len(s.used_colors())<=16
# Same apparent character height and neutral background as the supplied example.
reference=Image.open(ROOT/'quality/reference.jpg').convert('RGB').crop((48,96,648,671))
reference=ImageOps.mirror(reference)
reference=reference.resize((480,460),Image.Resampling.NEAREST)
compare=Image.new('RGB',(1040,540),'#303030');d=ImageDraw.Draw(compare)
d.text((20,10),'REFERENCE / mirrored for direction',fill='#c9c5bb')
d.text((540,10),'VERA / 32px',fill='#c9c5bb')
compare.paste(reference,(12,44))
compare.paste(Image.open(ROOT/'preview.png'),(520,24))
compare.save(ROOT/'quality/comparison.png')
print('PASS 32px native / <=16 colors / exact 16x / binary alpha')
