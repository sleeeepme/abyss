from PIL import Image, ImageDraw, ImageFont
import numpy as np
from lib import *
import side, side_anim
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
f18=ImageFont.truetype(FONT,18); f22=ImageFont.truetype(FONT,22)
S=12; CROP=(2,4,36,44)
def panel(arr,title):
    x0,y0,x1,y1=CROP
    im=Image.fromarray(arr[y0:y1,x0:x1],'RGBA'); b=Image.new('RGBA',im.size,(40,44,52,255)); b.alpha_composite(im)
    big=b.convert('RGB').resize(((x1-x0)*S,(y1-y0)*S),Image.NEAREST)
    out=Image.new('RGB',(big.width,big.height+40+200),(24,26,30)); out.paste(big,(0,40))
    ImageDraw.Draw(out).text((8,6),title,fill=(235,235,235),font=f22)
    return out
def P(x,y): return ((x-CROP[0])*S+S//2,(y-CROP[1])*S+S//2+40)
def mark(d,pts,col,w=4): d.line([P(*p) for p in pts],fill=col,width=w)
def dot(d,p,col,r=7): x,y=P(*p); d.ellipse([x-r,y-r,x+r,y+r],outline=col,width=3)
LEG={}
def label(d,p,t,col,dx=10,dy=-12):
    x,y=P(*p); n=t.split(' ')[0]
    d.rectangle([x+9,y-30,x+33,y-8],fill=(0,0,0)); d.text((x+14,y-33),n,fill=col,font=f18)
    LEG.setdefault(id(d),[]).append((t,col))
RED=(255,90,90); YEL=(255,220,80); CY=(90,230,255); GRN=(120,255,140)
# 1 parts map
pm=Image.open('out/side_partmap.png')
# rebuild partmap at crop
vis=blank()
cols={'フード・目・角':(230,120,60),'襟・肩当て':(200,90,220),'胴':(90,210,120),'手前の腕':(240,220,80),'マント':(90,150,240),'脚':(240,90,110)}
for (n,c),m in zip(cols.items(),[side.M_hood,side.M_collar,side.M_torso,side.M_arm,side.M_cape,side.M_leg]):
    vis[m]=c+(255,)
p1=panel(vis,'① パーツ分解（左向き）'); d=ImageDraw.Draw(p1)
y=60
for n,c in cols.items():
    d.rectangle([12,y,30,y+18],fill=c); d.text((38,y-3),n,fill=(235,235,235),font=f18); y+=26
# 2 RD frame with problems
rd=np.array(Image.open('/tmp/claude-0/s/rig1/atk4.png').convert('RGBA'))
p2=panel(rd,'② RD版の問題点'); d=d2=ImageDraw.Draw(p2)
dot(d,(13,18),RED,12); label(d,(13,18),'A 弓が目の高さに浮いている（握る手が無い）',RED,-150,-48)
dot(d,(23,32),RED,14); label(d,(23,32),'B 手前の腕は待機のまま下がっている',RED,-60,22)
dot(d,(10,17),RED,8); label(d,(10,17),'C 弦が見えず、矢は弓の前の白い点だけ',RED,-110,26)
dot(d,(30,24),RED,8); label(d,(30,24),'D 弦を引く手・肘がどこにも無い',RED,-150,-40)
# 3 fixed full draw with skeleton
fr,_=side_anim.shoot(); fd=fr[5]
p3=panel(fd,'③ 直した満月（引き絞り）'); d=d3=ImageDraw.Draw(p3)
mark(d,[(22,28),(11,26)],YEL); dot(d,(22,28),YEL); dot(d,(10,26),YEL)
label(d,(16,27),'1 弓手：手前の腕を肩の高さで伸ばす',YEL,-120,18)
mark(d,[(5,25),(20,25)],CY,3); label(d,(5,25),'2 矢：握り手のすぐ上を水平に、的へ',CY,-20,-40)
dot(d,(20,25),GRN); label(d,(20,25),'3 引き手：奥の手で顎まで（頭の陰）',GRN,6,-44)
mark(d,[(13,34),(20,25)],GRN,2); mark(d,[(13,18),(20,25)],GRN,2)
label(d,(13,34),'4 弦：両端→顎のV。目を横切らない',GRN,-40,14)
dot(d,(30,24),GRN); label(d,(30,24),'5 引き手の肘：頭の後ろ・矢の高さ',GRN,-70,-48)
mark(d,[(19,40),(25,40)],(255,160,220),3); label(d,(22,40),'6 足を前後に開いて構える',(255,160,220),-80,10)
for p in (p2,p3):
    d=ImageDraw.Draw(p); key=None
for p,dd in ((p2,d2),(p3,d3)):
    y=p.height-190
    for t,col in LEG.get(id(dd),[]):
        ImageDraw.Draw(p).text((12,y),t,fill=col,font=f18); y+=28
W=p1.width+p2.width+p3.width+40
out=Image.new('RGB',(W,p1.height+10),(24,26,30))
x=0
for p in (p1,p2,p3): out.paste(p,(x,0)); x+=p.width+20
out.save('out/verify_side.png')
