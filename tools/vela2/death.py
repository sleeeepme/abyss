"""ヴェラ第二形態の撃破演出（確認用GIF）。
最後の一撃→スロー→内側から光のひびが広がる→光が漏れる→白く光って爆散（破片が飛び、輪と粒）。"""
import runpy, math, random
import numpy as np
from PIL import Image
ns=runpy.run_path('motions.py'); g=ns['g']; R=g['render']; FW,FH,FP=g['CW'],g['CH'],g['P']
random.seed(7); np.random.seed(7)
CW,CH=260,190; OX,OY=(CW-FW)//2,30           # 大きな画用紙の中に1コマを置く
import os
BG=np.array([float(v) for v in os.environ.get('BGC','22,28,31').split(',')],np.float32)
FLOOR=os.environ.get('FLOOR','1')=='1'
def canvas():
    a=np.zeros((CH,CW,3),np.float32)+BG
    yy,xx=np.mgrid[0:CH,0:CW]; d=np.hypot((xx-CW/2)/CW,(yy-CH*0.62)/CH)
    if FLOOR: a+=np.clip(18-40*d,0,18)[...,None]*np.array([0.6,0.8,0.8])   # 足元がほんのり明るい床
    return a
def place(fr):     # RGBA（1コマ）→ 画用紙サイズの RGBA 配列
    A=np.zeros((CH,CW,4),np.float32); f=np.array(fr,np.float32); A[OY:OY+FH,OX:OX+FW]=f; return A
def over(bg,A,k=1.0):
    m=(A[...,3:4]/255)*k; return bg*(1-m)+A[...,:3]*m
idleA=place(R({'by':0,'ant':0,'glow':1.0}))
mask=idleA[...,3]>0
ys,xs=np.nonzero(mask); cx,cy=xs.mean(),ys.mean()
EYE=(OX+FP+59,OY+FP+27)
# ---- 光のひび：目と胸から外へ、枝分かれしながら伸びる道。各ドットに「現れる順」を持たせる ----
order=np.full((CH,CW),1e9,np.float32)
def walk(x,y,ang,t,depth):
    for step in range(70 if depth else 110):
        ang+=random.uniform(-0.45,0.45)
        x+=math.cos(ang); y+=math.sin(ang); t+=1
        X,Y=int(round(x)),int(round(y))
        if not(0<=X<CW and 0<=Y<CH) or not mask[Y,X]: return
        order[Y,X]=min(order[Y,X],t)
        if depth<2 and random.random()<0.025: walk(x,y,ang+random.choice([-1,1])*random.uniform(0.6,1.1),t,depth+1)
starts=[EYE,(EYE[0],EYE[1]+12),(cx-14,cy+4),(cx+14,cy+4)]
for sx,sy in starts:
    for k in range(4 if (sx,sy)==EYE else 2): walk(sx,sy,random.uniform(0,2*math.pi),0 if (sx,sy)==EYE else 30,0)
TMAX=float(order[order<1e8].max())
CORE=np.array([235,255,250]); HALO=np.array([120,232,220])
def crack_layer(a,frac,inten):
    """frac：ひびがどこまで伸びたか(0〜1)、inten：光の強さ"""
    vis=order<=frac*TMAX
    halo=np.zeros_like(vis)
    for dx,dy in((1,0),(-1,0),(0,1),(0,-1)): halo|=np.roll(np.roll(vis,dy,0),dx,1)
    halo&=mask&~vis
    a=a.copy()
    a[halo]=a[halo]*(1-0.55*inten)+HALO*0.55*inten
    a[vis]=a[vis]*(1-inten)+CORE*inten
    return a
# 漏れる光の筋：ひびが出始めた時から1本ずつ増え、伸びていく。細い筋と太い筋（先へ細る楔形）を混ぜる
_rr=random.Random(11)
RAYS=[]
for i_ in range(16):
    RAYS.append({'ang':i_/16*2*math.pi+_rr.uniform(-.18,.18),
                 'w':[1,1,2,1,3,5,1,2,7,1,4,2,6,1,3,9][i_],   # 付け根の太さ（ドット）
                 'born':i_*1.45,
                 'len':_rr.uniform(.7,1.0)})
ORG=(EYE[0],EYE[1]+12)
def rays(a,phase,maxlen,inten):
    """phase：ひびの何コマ目か（これより前に生まれた筋だけ）、maxlen：いちばん長い筋の長さ"""
    a=a.copy(); hit=np.zeros((CH,CW),np.float32)
    for r in RAYS:
        age=phase-r['born']
        if age<0: continue
        L=maxlen*r['len']*min(1,0.35+age*0.18); ca,sa=math.cos(r['ang']),math.sin(r['ang'])
        for s_ in np.arange(0,L,0.5):
            hw=r['w']*0.5*(1-0.7*s_/L)+0.3
            fall=(1-s_/L)
            for o in np.arange(-hw,hw+0.01,0.5):
                x=int(ORG[0]+ca*(14+s_)-sa*o); y=int(ORG[1]+(sa*(12+s_)+ca*o)*0.85)
                if 0<=x<CW and 0<=y<CH and not mask[y,x]:
                    edge=1-abs(o)/(hw+0.3)
                    hit[y,x]=max(hit[y,x],fall*(0.55+0.45*edge))
    k=np.clip(hit*inten,0,1)[...,None]
    core=(hit>0.75)[...,None]
    col=np.where(core,CORE,HALO)
    return a*(1-k)+col*k
def tint_white(A,k):
    B=A.copy(); m=B[...,3]>0; dark=B[...,:3].sum(2)<40
    B[m&~dark,:3]=B[m&~dark,:3]*(1-k)+255*k; return B
def darken(A,k):
    B=A.copy(); B[...,:3]*=k; return B
def shake(A,dx,dy): return np.roll(np.roll(A,dy,0),dx,1)
frames=[]
def add(a,ms): frames.append((Image.fromarray(np.clip(a,0,255).astype(np.uint8)),ms))
def spark(a,x,y,r,col,k=1.0):
    a=a.copy()
    for i in range(12):
        ang=i/12*2*math.pi; 
        for s in range(r):
            X=int(x+math.cos(ang)*s); Y=int(y+math.sin(ang)*s)
            if 0<=X<CW and 0<=Y<CH: a[Y,X]=a[Y,X]*(1-k)+np.array(col)*k
    return a
HIT=(OX+FP+20,OY+FP+46)
# 1) 待機 → 最後の一撃
for i in range(3): add(over(canvas(),place(R({'by':[0,1,1][i],'ant':0,'glow':1.0}))),110)
hw=place(R({'by':-1,'ant':1.0,'glow':1.0},0.5)); add(spark(over(canvas(),tint_white(hw,1.0)),*HIT,9,[255,250,220]),70)
# 2) スロー：赤く沈んでゆっくり揺れる（1コマを長く）
for i,(by,bx,ant) in enumerate([(1,1,-1.0),(1,-1,0.8),(1,1,-0.5),(1,0,0.2)]):
    A=place(R({'by':by,'bx':bx,'ant':ant,'glow':0.7},0.8 if i<2 else 0.4))
    a=over(canvas(),A); 
    if i==0:
        m=A[...,3]>0; a[m]=a[m]*0.55+np.array([226,70,52])*0.45
    add(a,240)
# 3) 内側から光のひび（揺れが少しずつ強く、体は少し暗く）
base=place(R({'by':1,'ant':0.0,'glow':1.6},0))
N=26
for i in range(N):
    p=((i+1)/N)**1.7; jit=[(0,0),(1,0),(0,0),(-1,0)][i%4] if i>9 else (0,0)
    if i>18: jit=[(1,0),(-1,1),(1,-1),(-1,0)][i%4]
    A=shake(darken(base,1-0.25*p),*jit)
    a=over(canvas(),A)
    a=crack_layer(shake(a,0,0),p,0.55+0.45*p) if not jit[0] and not jit[1] else crack_layer_shifted if False else a
    # ひびは揺れに合わせて同じだけずらす
    cl=crack_layer(over(canvas(),darken(base,1-0.25*p)),p,0.55+0.45*p)
    a=np.roll(np.roll(cl,jit[1],0),jit[0],1)
    a=rays(a,i,10+i*2.1,0.30+0.028*i)
    add(a,170 if i<12 else (130 if i<20 else 100))
# 溜めの頂点：光が一瞬内へ吸い込まれて暗くなり、震え、次の瞬間に弾ける
for j,(dk,jx,ints) in enumerate([(0.62,1,0.55),(0.55,-1,0.45),(0.5,1,0.35),(0.5,0,0.25)]):
    cl=crack_layer(over(canvas(),darken(base,dk)),1.0,ints+0.4)
    a=np.roll(cl,jx,1); a=rays(a,99,30+j*3,0.25+0.1*j)
    add(a,[160,140,130,240][j])
# 4) 白く光る
full=over(canvas(),tint_white(base,1.0)); full=rays(full,99,70,1.0); add(full,70)
yy,xx=np.mgrid[0:CH,0:CW]
def glowcircle(a,r,k):
    d=np.hypot(xx-EYE[0],(yy-EYE[1]-12)*1.2); m=np.clip(1-d/r,0,1)*k
    return a*(1-m[...,None])+np.array([235,255,250])*m[...,None]
add(glowcircle(full,70,0.9),60)
# 5) 爆散：体をいくつかの塊に割って外へ飛ばす
final=crack_layer(over(np.zeros((CH,CW,3),np.float32),darken(base,0.8)),1.0,1.0)
seeds=np.array([(xs[j],ys[j]) for j in np.random.choice(len(xs),46,replace=False)],np.float32)
lab=np.argmin(((xs[:,None]-seeds[None,:,0])**2+(ys[:,None]-seeds[None,:,1])**2),axis=1)
cols=final[ys,xs]
vel=[]
for s in seeds:
    d=s-np.array([cx,cy+6]); n=np.linalg.norm(d)+1e-3; sp=random.uniform(2.2,4.4)
    vel.append((d/n*sp+np.array([random.uniform(-.6,.6),-random.uniform(0.6,1.8)])))
vel=np.array(vel)
sparks=[(cx,cy,random.uniform(0,2*math.pi),random.uniform(2,6)) for _ in range(70)]
for i in range(16):
    a=canvas(); t=i+1
    # 衝撃の輪
    r=12+t*7; k=max(0,1-t/10)
    d=np.hypot(xx-cx,(yy-cy-8)*1.6); ring=(abs(d-r)<1.6)*k
    a=a*(1-ring[...,None]*0.8)+HALO*ring[...,None]*0.8
    # 中心の光の残り
    if t<6: a=glowcircle(a,60-t*8,0.7*(1-t/6))
    fade=max(0,1-t/16)
    for j in range(len(seeds)):
        sel=lab==j
        dx=vel[j,0]*t; dy=vel[j,1]*t+0.18*t*t
        X=(xs[sel]+dx).astype(int); Y=(ys[sel]+dy).astype(int)
        ok=(X>=0)&(X<CW)&(Y>=0)&(Y<CH)
        c=cols[sel]
        hot=max(0,1-t/5)                         # 飛び始めは白熱、すぐ石の色へ
        c=c*(1-hot)+CORE*hot
        a[Y[ok],X[ok]]=a[Y[ok],X[ok]]*(1-fade)+c[ok]*fade
    for (sx,sy,ang,sp) in sparks:
        X=int(sx+math.cos(ang)*sp*t*1.6); Y=int(sy+math.sin(ang)*sp*t*1.2+0.15*t*t)
        if 0<=X<CW and 0<=Y<CH and t<12: a[Y,X]=a[Y,X]*0.2+(CORE if t<5 else HALO)*0.8
    add(a,70 if t<6 else 90)
# 6) 静けさ（土煙がうすく残る）→ 繰り返し
for i in range(4):
    a=canvas(); k=0.35*(1-i/4)
    d=np.hypot((xx-cx)/70,(yy-(OY+FP+80))/10); m=np.clip(1-d,0,1)*k
    a=a*(1-m[...,None])+np.array([90,100,98])*m[...,None]; add(a,160)
add(canvas(),600)
np.savez_compressed(os.environ.get('OUT','death_frames.npz'),f=np.stack([np.array(f) for f,_ in frames]),d=np.array([d for _,d in frames]))
if os.environ.get('NOGIF')=='1': raise SystemExit
S=3
big=[f.resize((CW*S,CH*S),Image.NEAREST) for f,_ in frames]
big[0].save('vela2_death_x3.gif',save_all=True,append_images=big[1:],duration=[d for _,d in frames],loop=0,disposal=2)
print(len(frames), sum(d for _,d in frames))
# 見本の静止（要所）
pick=[3,5,11,15,19,22,24,30]
sheet=Image.new('RGB',(CW*4,CH*2))
for n,i in enumerate(pick): sheet.paste(frames[i][0],((n%4)*CW,(n//4)*CH))
sheet.resize((sheet.width*2,sheet.height*2),Image.NEAREST).save('vela2_death_keys.png')
