"""アッシュトード（src-ash-toad.png 19x12）とストーンボア（src-stone-boar.png 20x11）のコマ送り。
ハウンド（tools/ash_hound_anim.py）と同じ作り：元絵を部位に分けて1pxずつ動かす。
出力：<name>_{idle,walk,attack,damage}_x8.gif / _sheet.png、<name>_frames.json"""
from PIL import Image
import json, sys, random
CW,CH,OX,OY=32,18,6,5
Y=(240,203,56,255); O=(255,137,49,255); WH=(255,255,255,255); K=(0,0,0,255)
def load(path):
    im=Image.open(path).convert('RGBA')
    px={}
    for y in range(im.height):
        for x in range(im.width):
            c=im.getpixel((x,y))
            if c[3]:
                if c==WH: c=(250,250,246,255)      # 元絵の白は「光の白」と分ける
                px[(x,y)]=c
    return px,im.width,im.height
class Mob:
    def __init__(s,path,part):
        s.px,s.w,s.h=load(path); s.P={}
        for (x,y),c in s.px.items(): s.P.setdefault(part(x,y),[]).append((x,y,c))
def frame(m,o,order,fill=None,fx=(),recol=None):
    im=Image.new('RGBA',(CW,CH),(0,0,0,0)); p=im.load()
    gx,gy=o.get('all',(0,0))
    def put(x,y,c):
        X,Y_=x+OX+gx,y+OY+gy
        if 0<=X<CW and 0<=Y_<CH: p[X,Y_]=c
    for name in order:
        if name not in m.P: continue
        dx,dy=o.get(name,(0,0))
        for par in PARENT.get(name,[]):
            a,b=o.get(par,(0,0)); dx+=a; dy+=b
        for x,y,c in m.P[name]: put(x+dx,y+dy,recol(c) if recol else c)
    if fill:
        for x,y,c in fill(o): put(x,y,c)
    for x,y,c in fx:
        if 0<=x<CW and 0<=y<CH: p[x,y]=c
    return im
PARENT={}
def tint(im,mode):
    im=im.copy(); p=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=p[x,y]
            if not a: continue
            if (r,g,b)==(0,0,0): p[x,y]=(0,0,0,255) if mode=='white' else (60,8,4,255)
            elif mode=='white': p[x,y]=WH
            else: p[x,y]=((r+218*2)//3,(g+56*2)//3,(b+19*2)//3,255)
    return im
def addfx(im,pts):
    im=im.copy(); p=im.load()
    for x,y,c in pts:
        if 0<=x<CW and 0<=y<CH: p[x,y]=c
    return im
def save(name,fr):
    frames=[f for f,_ in fr]; durs=[d for _,d in fr]
    sh=Image.new('RGBA',(CW*len(frames),CH),(0,0,0,0))
    for i,f in enumerate(frames): sh.paste(f,(i*CW,0))
    sh.save(name+'_sheet.png'); S=8; bg=(34,30,40,255)
    big=[Image.alpha_composite(Image.new('RGBA',(CW,CH),bg),f).resize((CW*S,CH*S),Image.NEAREST).convert('RGB') for f in frames]
    big[0].save(name+'_x8.gif',save_all=True,append_images=big[1:],duration=durs,loop=0,disposal=2)
    Image.alpha_composite(Image.new('RGBA',sh.size,bg),sh).resize((sh.width*6,CH*6),Image.NEAREST).save(name+'_prev.png')
def export(name,anims,emis,w,h,strike=3,lunge=(3,4)):
    pal=[]; out={}
    for k,fr in anims.items():
        fs=[]
        for im,d in fr:
            st=''
            for y in range(CH):
                for x in range(CW):
                    c=im.getpixel((x,y))
                    if c[3]==0: st+='.'; continue
                    c=c[:3]
                    if c not in pal: pal.append(c)
                    i=pal.index(c); st+=chr(65+i) if i<26 else chr(97+i-26)
            fs.append(st)
        out[k]={'d':[d for _,d in fr],'f':fs}
    em=[c[:3] for c in emis]+[Y[:3],O[:3],WH[:3]]
    out['pal']=['#%02x%02x%02x'%c for c in pal]; out['emis']=[i for i,c in enumerate(pal) if c in em]
    out['w']=CW; out['h']=CH; out['feet']=OY+h; out['cx']=OX+w/2; out['cy']=OY+h/2
    out['strike']=strike; out['lunge']=list(lunge)
    json.dump(out,open(name+'_frames.json','w'),separators=(',',':'))
def dmg_anims(m,order,hx,hy):
    def burst(k):
        if k==0: return [(hx+1,hy,Y),(hx+2,hy-1,Y),(hx+2,hy+1,Y),(hx+3,hy,O)]
        if k==1: return [(hx+3,hy-2,L1),(hx+4,hy+2,L1),(hx-3,hy-3,L1),(hx+1,hy-4,L2),(hx-1,hy-4,L1)]
        if k==2: return [(hx+5,hy-3,L2),(hx+6,hy+2,L2),(hx-5,hy-5,L2),(hx+1,hy-6,L3)]
    return [(addfx(tint(frame(m,{'all':(-1,0)},order),'white'),burst(0)),50),
            (addfx(tint(frame(m,{'all':(-2,0)},order),'red'),burst(1)),70),
            (addfx(frame(m,{'all':(-2,0)},order),burst(2)),90),
            (frame(m,{'all':(-1,0),'body':(0,1)},order),90),
            (frame(m,{},order),140)]
def dust(x,y,s):
    pts={0:[(0,0),(1,0),(0,-1)],1:[(-1,0),(0,-1),(1,-1),(-2,-1),(0,-2)],2:[(-2,-2),(-3,-1),(1,-3),(-1,-3)]}[s]
    return [(x+a,y+b,L1 if i%2==0 else L2) for i,(a,b) in enumerate(pts)]

# ================= アッシュトード =================
def tpart(x,y):
    if y>=9: return 'legs'
    if x>=10 and y<=6: return 'head'
    if x>=10 and y<=8: return 'jaw'
    return 'body'
T=Mob('src-ash-toad.png',tpart)
L1,L2,L3=(192,187,176,255),(148,138,130,255),(93,87,85,255)
PARENT={'head':['body'],'jaw':['body']}
TO=['legs','body','jaw','head']
def tblink(c): return (192,187,176,255) if c in ((242,214,35,255),(170,134,0,255)) else c
def mouth(n):     # 頭を n 上げた隙間を口の中で埋める
    def f(o):
        bx,by=o.get('body',(0,0)); ax,ay=o.get('all',(0,0)); hy=o.get('head',(0,0))[1]
        out=[]
        for k in range(n):
            yy=6-k+by+hy+n-1   # 隙間の行
            for x in range(11,18):
                out.append((x+bx,6+by-k,K if x in (11,17) else ((120,30,24,255) if k==n-1 else (60,14,12,255))))
        return out
    return f
mx=OX+19
t_idle=[(frame(T,{},TO),220),(frame(T,{'body':(0,1)},TO),200),(frame(T,{'body':(0,1),'jaw':(0,1)},TO),240),
        (frame(T,{'body':(0,1)},TO),160),(frame(T,{},TO),200),(frame(T,{},TO,recol=tblink),90),(frame(T,{},TO),160)]
t_walk=[(frame(T,{'body':(0,1)},TO),110),(frame(T,{'all':(1,-1),'legs':(0,0)},TO),90),(frame(T,{'all':(1,0),'body':(0,1)},TO),110),(frame(T,{},TO),90)]
puff=lambda s:[(mx+a,OY+5+b,c) for a,b,c in {0:[(0,0,L1),(1,0,L1),(0,1,L2),(1,1,L1),(2,0,L2),(1,-1,L2)],
                                                 1:[(2,0,L1),(3,0,L1),(2,1,L2),(3,-1,L2),(4,1,L2),(5,0,L3)],
                                                 2:[(5,-1,L2),(6,1,L3),(7,0,L3)]}[s]]
t_atk=[(frame(T,{},TO),90),
       (frame(T,{'body':(0,1)},TO),120),
       (frame(T,{'body':(0,1),'jaw':(0,1)},TO),240),                                    # 喉をふくらませて溜める
       (frame(T,{'head':(0,-1)},TO,fill=mouth(1),fx=puff(0)),70),                       # 口を開けて吐く
       (frame(T,{'head':(0,-2)},TO,fill=mouth(2),fx=puff(1)),80),
       (frame(T,{'head':(0,-1)},TO,fill=mouth(1),fx=puff(2)),90),
       (frame(T,{},TO),110)]
t_dmg=dmg_anims(T,TO,OX+18,OY+4)
for k,v in [('idle',t_idle),('walk',t_walk),('attack',t_atk),('damage',t_dmg)]: save('ashtoad_'+k,v)
export('ashtoad',{'idle':t_idle,'walk':t_walk,'atk':t_atk,'dmg':t_dmg},[(242,214,35,255),(170,134,0,255)],T.w,T.h,lunge=(3,4))

# ================= ストーンボア =================
def bpart(x,y):
    if y>=8 and x>=3: return 'legF' if x>=9 else 'legB'
    if x<=1 and y>=8: return 'tail'
    if x>=11 and y<=7: return 'head'
    return 'body'
B=Mob('src-stone-boar.png',bpart)
L1,L2,L3=(149,135,115,255),(111,101,92,255),(60,52,46,255)
PARENT={'head':['body'],'tail':['body']}
BO=['tail','legB','legF','body','head']
bx=OX+20
spark=[(bx+1,OY+4,Y),(bx+2,OY+3,Y),(bx+2,OY+5,Y),(bx+3,OY+2,O),(bx+3,OY+6,O),(bx+3,OY+4,Y)]
b_idle=[(frame(B,{},BO),220),(frame(B,{'tail':(0,-1)},BO),150),(frame(B,{'body':(0,1)},BO),200),
        (frame(B,{'body':(0,1),'head':(0,0)},BO),200),(frame(B,{'head':(0,1)},BO),160),(frame(B,{},BO),160)]
b_walk=[(frame(B,{'legF':(1,0),'legB':(-1,0)},BO),110),(frame(B,{'tail':(0,-1)},BO),110),
        (frame(B,{'legF':(-1,0),'legB':(1,0)},BO),110),(frame(B,{},BO),110)]
b_atk=[(frame(B,{},BO),100),
       (frame(B,{'all':(-1,0),'body':(0,1),'head':(0,1)},BO),120),                     # 頭を下げる
       (frame(B,{'all':(-2,0),'body':(0,1),'head':(0,1),'legB':(-1,0)},BO,fx=dust(OX+1,OY+10,0)),240),  # 後ろ足で地を掻く
       (frame(B,{'all':(1,0),'body':(0,1),'head':(0,1),'legF':(1,0),'legB':(-1,0)},BO,fx=dust(OX+1,OY+10,1)),60),
       (frame(B,{'all':(3,0),'head':(0,-1),'legF':(1,0),'legB':(-2,0)},BO,fx=dust(OX,OY+10,2)+[(x+3,y-1,c) for x,y,c in spark]),80),  # 突き上げ
       (frame(B,{'all':(3,0)},BO),110),
       (frame(B,{'all':(2,0)},BO),110),
       (frame(B,{'all':(1,0)},BO),100)]
b_dmg=dmg_anims(B,BO,OX+19,OY+4)
for k,v in [('idle',b_idle),('walk',b_walk),('attack',b_atk),('damage',b_dmg)]: save('stoneboar_'+k,v)
export('stoneboar',{'idle':b_idle,'walk':b_walk,'atk':b_atk,'dmg':b_dmg},[(250,250,246,255),(106,62,16,255)],B.w,B.h,lunge=(3,4))
print('ok')
