from pathlib import Path
import sys,json,zipfile
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite

ROOT=Path(__file__).resolve().parent
FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
REF=Path('/tmp/codex-remote-attachments/01a09a02-dafe-7d62-a07b-e9a455892a82/E8AE3E77-FCD1-4CC0-8ED0-067D9AAEFD6C/1-写真1.jpg')
CRAWLER=ROOT.parent/'stone-benchmark-v2'/'crawling-dead-32.png'

def poly(s,pts,c):s.polygon(pts,c)
def rect(s,box,c):s.rect(*box,c)
def line(s,a,b,c):s.line(*a,*b,c)

def praying():
    p=['#140f14','#382a31','#594047','#78534e','#a26f5c',
       '#22383b','#36585b','#5f7f7d',
       '#756d68','#a79a86','#dfcfad','#f0e4c9','#b68558']
    s=Sprite(32,32,palette=p)
    # One-piece silhouette: peaked hood, bowed face, pooled robe.
    poly(s,[(7,7),(10,7),(10,4),(13,2),(17,3),(20,5),(22,8),(21,12),(23,15),(23,20),(25,23),(23,27),(20,29),(7,29),(4,27),(7,24),(8,19),(9,15),(6,12)],p[0])
    # Hood and robe masses.
    poly(s,[(9,8),(11,7),(11,5),(14,4),(17,5),(20,7),(20,11),(18,14),(14,14),(11,12),(8,11)],p[2])
    poly(s,[(11,6),(14,4),(17,5),(18,7),(14,7),(12,9),(9,9)],p[3])
    poly(s,[(13,5),(16,5),(18,7),(16,7),(14,6)],p[4])
    poly(s,[(10,14),(15,13),(19,15),(21,20),(23,24),(21,27),(17,28),(7,28),(8,24),(9,20)],p[2])
    poly(s,[(10,15),(13,14),(14,19),(12,24),(8,27),(8,22)],p[3])
    poly(s,[(10,16),(12,15),(12,19),(10,21),(9,20)],p[4])
    poly(s,[(16,17),(19,17),(20,22),(18,27),(14,27),(15,22)],p[1])
    # Teal sash: a broad readable stripe with three connected planes.
    poly(s,[(9,18),(12,18),(15,21),(16,27),(13,28),(12,23),(9,21)],p[5])
    poly(s,[(10,18),(12,19),(14,21),(14,25),(13,25),(12,22),(10,21)],p[6])
    poly(s,[(10,18),(12,19),(13,20),(11,20)],p[7])
    # Recessed hood opening and skull profile.
    poly(s,[(14,8),(19,8),(21,10),(19,15),(15,15),(13,12)],p[0])
    poly(s,[(17,9),(20,10),(19,13),(17,14),(15,12),(15,10)],p[9])
    rect(s,(17,9,19,10),p[10]);rect(s,(18,10,20,11),p[11])
    rect(s,(18,12,19,13),p[0]);rect(s,(16,13,17,14),p[8])
    # Both hands clasped in front of the face, separated by one dark seam.
    poly(s,[(20,14),(23,15),(25,17),(24,20),(22,20),(20,18)],p[0])
    poly(s,[(20,15),(22,15),(23,17),(22,19),(20,18)],p[9])
    poly(s,[(23,16),(24,17),(24,19),(22,19),(23,18)],p[10])
    rect(s,(21,15,22,16),p[11]);rect(s,(22,17,22,18),p[12])
    return s,p

def sprinter():
    p=['#140f14','#342c31','#574643','#7d624f','#a77a58',
       '#6f6a67','#9b9180','#c9b99d','#eadcbc',
       '#22383b','#3b5e5f','#64827d','#985843']
    s=Sprite(32,32,palette=p)
    # Low forward-driving silhouette with two clear leg gaps.
    poly(s,[(3,15),(6,12),(11,11),(14,8),(19,8),(20,5),(24,4),(28,6),(30,9),(29,13),(26,15),(23,16),(26,18),(28,21),(27,23),(22,23),(20,21),(18,23),(21,25),(20,28),(15,28),(13,26),(10,29),(4,29),(2,27),(5,24),(8,22),(7,19),(3,18)],p[0])
    # Back arm and ribcage.
    poly(s,[(4,15),(7,13),(12,12),(14,14),(12,17),(8,17),(5,18)],p[2])
    poly(s,[(6,14),(10,13),(12,14),(10,15),(7,15)],p[4])
    poly(s,[(13,10),(18,9),(22,12),(21,17),(17,20),(12,18),(10,15)],p[1])
    poly(s,[(14,11),(18,10),(20,12),(18,13),(15,13)],p[3])
    # Three blunt ribs, not fine anatomy.
    line(s,(14,14),(18,15),p[7]);line(s,(13,16),(17,17),p[6]);rect(s,(15,18,18,19),p[5])
    # Large skull, three bone planes.
    poly(s,[(21,6),(24,5),(27,6),(29,8),(28,12),(26,15),(22,14),(20,12),(20,8)],p[6])
    poly(s,[(22,6),(25,5),(27,7),(27,10),(25,9),(22,10)],p[7])
    poly(s,[(23,6),(26,6),(27,8),(24,8)],p[8])
    rect(s,(24,10,25,11),p[0]);rect(s,(27,10,28,12),p[0]);rect(s,(24,13,26,14),p[5]);rect(s,(27,13,27,14),p[8])
    # Teal waist cloth, broad three-shade cluster.
    poly(s,[(11,18),(16,18),(20,20),(18,23),(14,24),(10,22)],p[9])
    poly(s,[(12,18),(16,19),(17,21),(14,22),(11,21)],p[10])
    rect(s,(12,18,14,19),p[11])
    # Forearm and two bent running legs.
    poly(s,[(20,15),(22,15),(25,18),(27,18),(28,20),(26,22),(23,21),(21,19)],p[5])
    poly(s,[(21,16),(23,17),(25,19),(23,20),(21,18)],p[7]);rect(s,(24,18,26,19),p[8])
    poly(s,[(12,22),(15,22),(15,25),(13,27),(8,27),(10,24)],p[5]);rect(s,(9,26,12,27),p[7]);rect(s,(9,27,12,28),p[8])
    poly(s,[(17,22),(20,21),(22,24),(20,27),(16,27),(15,25)],p[3]);rect(s,(17,26,20,27),p[12]);rect(s,(16,27,20,28),p[4])
    return s,p

def bog():
    p=['#140f14','#27301d','#3e4b27','#5d6d38','#869253',
       '#34292b','#55413d','#795d4d',
       '#69705d','#929979','#c1c29c',
       '#9b541d','#f0b83f']
    s=Sprite(32,32,palette=p)
    # Wide low silhouette with a large back and two oversized front palms.
    poly(s,[(2,17),(4,14),(7,13),(9,10),(14,9),(18,10),(21,12),(25,13),(28,15),(30,18),(29,21),(26,22),(25,25),(29,26),(30,28),(22,28),(19,26),(16,27),(13,29),(8,29),(7,26),(3,26),(1,24),(3,21)],p[0])
    # Mossy back, four large planes.
    poly(s,[(4,17),(6,14),(10,13),(11,11),(15,10),(19,12),(23,13),(26,15),(25,18),(20,18),(17,17),(13,18),(9,17)],p[1])
    poly(s,[(6,15),(10,14),(12,12),(16,11),(20,13),(23,14),(24,16),(19,16),(16,15),(12,16),(8,16)],p[2])
    poly(s,[(9,13),(13,12),(16,11),(18,12),(17,14),(13,14),(11,15)],p[3])
    poly(s,[(12,12),(15,11),(17,12),(15,13)],p[4])
    # Muddy underbody and rear leg.
    poly(s,[(5,18),(10,17),(15,18),(17,21),(14,25),(10,26),(7,24),(3,24),(4,21)],p[5])
    poly(s,[(6,18),(10,18),(12,20),(10,23),(6,23),(4,22)],p[6]);rect(s,(5,19,8,20),p[7])
    poly(s,[(8,23),(12,23),(13,25),(11,28),(7,28),(6,26)],p[5]);rect(s,(8,25,11,27),p[7])
    # Flat head and jaw.
    poly(s,[(18,16),(24,14),(28,16),(29,19),(27,22),(21,22),(18,20)],p[5])
    poly(s,[(20,16),(25,15),(27,17),(26,19),(21,19)],p[6]);rect(s,(23,16,26,17),p[7])
    rect(s,(25,17,26,18),p[11]);rect(s,(26,17,27,18),p[12]);rect(s,(26,20,28,21),p[0])
    # Two pale webbed front palms: only broad notches, no long fingers.
    poly(s,[(16,20),(20,20),(22,23),(21,26),(18,25),(16,28),(13,28),(13,25),(15,24)],p[8])
    poly(s,[(17,21),(19,21),(20,23),(19,24),(17,24),(16,26),(14,26),(15,23)],p[9]);rect(s,(17,21,19,22),p[10])
    poly(s,[(22,21),(25,21),(27,24),(30,25),(30,28),(26,27),(23,28),(20,27),(22,25)],p[8])
    poly(s,[(23,22),(25,22),(26,24),(29,25),(28,26),(25,25),(23,26),(22,25)],p[9]);rect(s,(23,22,25,23),p[10])
    return s,p

def jelly():
    p=['#140f14','#223536','#334e4c','#4c7068','#719389','#9db4a2',
       '#684f38','#927045','#ba9554',
       '#273739','#3e5a55','#1e171d','#d2d0aa']
    s=Sprite(32,32,palette=p)
    # Bell silhouette and five thick tentacle paths.
    poly(s,[(7,15),(8,10),(11,6),(15,4),(21,4),(25,7),(28,11),(29,16),(27,20),(23,21),(11,21),(6,18)],p[0])
    for pts in [[(9,18),(12,18),(11,22),(8,27),(5,27),(6,24)],[(13,19),(16,19),(15,24),(13,29),(10,29),(11,25)],[(17,19),(20,19),(20,24),(19,29),(16,29),(17,25)],[(21,19),(24,19),(24,23),(27,27),(25,29),(22,25)],[(25,18),(28,18),(28,22),(30,24),(29,27),(26,24)]]:poly(s,pts,p[0])
    # Bell color planes.
    poly(s,[(9,15),(10,10),(13,7),(16,5),(21,6),(24,8),(27,12),(27,17),(24,19),(11,19),(8,17)],p[2])
    poly(s,[(10,13),(11,9),(14,6),(18,5),(22,7),(24,9),(23,12),(19,11),(15,12)],p[3])
    poly(s,[(12,9),(15,6),(19,6),(21,7),(20,9),(16,8),(14,11)],p[4])
    rect(s,(15,5,18,6),p[5]);rect(s,(16,5,18,5),p[12])
    poly(s,[(23,16),(27,16),(26,19),(23,20),(21,18)],p[1])
    # Two broad suspended silt clumps.
    poly(s,[(13,9),(17,8),(20,10),(19,14),(16,15),(13,13)],p[6])
    poly(s,[(14,9),(17,9),(18,11),(17,13),(14,12)],p[7]);rect(s,(15,9,17,10),p[8])
    poly(s,[(21,12),(24,12),(26,15),(25,18),(22,17),(20,15)],p[6]);rect(s,(22,13,24,15),p[7]);rect(s,(23,13,24,14),p[8])
    # Mouth/open underside.
    poly(s,[(15,16),(19,15),(23,17),(22,20),(18,21),(14,19)],p[11]);rect(s,(17,17,20,19),p[0])
    # Five tentacles, each with a connected midtone/light face.
    poly(s,[(9,20),(11,20),(10,24),(7,27),(6,26),(8,23)],p[9]);rect(s,(9,20,10,23),p[10])
    poly(s,[(13,20),(15,20),(14,25),(12,28),(11,27),(13,24)],p[9]);rect(s,(13,21,14,24),p[10])
    poly(s,[(18,20),(19,20),(19,25),(18,28),(17,27),(18,24)],p[9]);rect(s,(18,21,19,24),p[10])
    poly(s,[(22,20),(23,20),(23,24),(26,27),(25,28),(22,24)],p[9]);rect(s,(22,21,23,23),p[10])
    poly(s,[(26,19),(27,19),(27,22),(29,24),(29,26),(27,24),(26,22)],p[9]);rect(s,(26,20,27,22),p[10])
    return s,p

ART={'praying-dead':('プレイングデッド',praying),'dead-sprinter':('デッドスプリンター',sprinter),'bog-crawler':('ボグクロウラー',bog),'silt-jelly':('シルトジェリー',jelly)}
reports=[]
for key,(jp,fn) in ART.items():
    s,p=fn(); out=ROOT/'native-32'/f'{key}.png'
    s.save_png(str(out));s.save_png(str(ROOT/'native-32'/f'{key}@8x.png'),scale=8,bg='#6e6e6e');s.save_silhouette(str(ROOT/'quality'/f'{key}-silhouette.png'),scale=8)
    im=Image.open(out).convert('RGBA');box=im.getbbox();colors=len({x[:3] for x in im.getdata() if x[3]});alpha=sorted(set(im.getchannel('A').getdata()))
    reports.append({'id':key,'name':jp,'bounds':list(box),'body_size':[box[2]-box[0],box[3]-box[1]],'colors':colors,'alpha':alpha})
    assert colors==13 and alpha==[0,255],reports[-1]
(ROOT/'quality'/'stats.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))

# Comparison at the benchmark's native display scale: one source pixel = 4 screen pixels.
board=Image.new('RGB',(860,290),'#6e6e6e');d=ImageDraw.Draw(board);f=ImageFont.truetype(FONT,15);small=ImageFont.truetype(FONT,11)
d.text((18,14),'原寸32pxで直接作画 / 1ドット=4px / 各13色',font=f,fill='#eee4d3')
if REF.exists():board.paste(Image.open(REF).convert('RGB').crop((48,287,138,365)),(20,78))
d.text((20,180),'参照',font=f,fill='#eee4d3')
items=[('クロウリングデッド',CRAWLER)]+[(jp,ROOT/'native-32'/f'{k}.png') for k,(jp,_) in ART.items()]
for i,(jp,path) in enumerate(items):
    im=Image.open(path).convert('RGBA').resize((128,128),Image.Resampling.NEAREST);x=130+i*145;board.paste(im,(x,55),im);d.text((x,188),jp,font=small,fill='#eee4d3')
board.save(ROOT/'comparison.png')

sheet=Image.new('RGB',(840,365),'#25262d');d=ImageDraw.Draw(sheet);d.text((20,14),'石の層・原寸手描き4体 / 8倍表示',font=f,fill='#eee4d3')
for i,(key,(jp,_)) in enumerate(ART.items()):
    im=Image.open(ROOT/'native-32'/f'{key}.png').resize((256,256),Image.Resampling.NEAREST);x=5+i*207;sheet.paste(im,(x,52),im);d.text((x+10,316),jp,font=f,fill='#eee4d3')
sheet.save(ROOT/'overview.png')
with zipfile.ZipFile(ROOT/'sprites.zip','w',zipfile.ZIP_DEFLATED) as z:
    for key in ART:z.write(ROOT/'native-32'/f'{key}.png',f'{key}.png')
print(json.dumps(reports,ensure_ascii=False,indent=2))
