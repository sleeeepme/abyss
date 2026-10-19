"""ヴェラ第二形態（119×76）待機：リグ（IK）で上下させる。
・胴は整数ドットで上下（沈む→戻る→少し浮く→戻る）
・脚：付け根は胴と一緒に動き、足先は地面に固定。関節は2本骨の IK で曲がる
   橙（骨1本）＝足先が地面を滑って開く／黄＝最初の骨は胴と一緒、残り2本で IK／青・紫＝2本で IK
・頭の枝：幹は胴と一緒。上の先端・外枝・とげは分かれ目から、胴の動きに遅れて反る（追従）
・描き方：出来上がりの各ドットについて、骨の逆変換で元絵のドットを1つだけ引く（太らない）。
  重なりの裏が無くて空いた1ドットは上下左右の隣で埋める。"""
from PIL import Image
from collections import Counter
import math
import numpy as np
src=Image.open('native.png').convert('RGBA'); S=src.load(); W,H=src.size
mp=Image.open('map.png').convert('RGB').load()
LAB={(90,159,130):'B',(222,197,96):'Y',(222,145,76):'O',(115,142,208):'U',(151,113,192):'P',(250,244,220):'*',(87,91,92):'.'}
lab=[[LAB[mp[30+6*x+3,150+6*y+3]] for x in range(W)] for y in range(H)]
CX=59
dots=[(x,y) for y in range(H) for x in range(W) if lab[y][x]=='*']
for x,y in dots:
    c=Counter(lab[y+j][x+i] for i in (-1,0,1) for j in (-1,0,1) if 0<=x+i<W and 0<=y+j<H and lab[y+j][x+i] not in '*.')
    lab[y][x]=c.most_common(1)[0][0]
def chain(ps):
    ps=list(ps); tip=max(ps,key=lambda p:p[1]); out=[tip]; ps.remove(tip)
    while ps:
        n=min(ps,key=lambda p:(p[0]-out[-1][0])**2+(p[1]-out[-1][1])**2); out.append(n); ps.remove(n)
    return [(x+.5,y+.5) for x,y in out[::-1]]
JOINTS={}
for side in 'LR':
    for part in 'OYUP':
        JOINTS[side+part]=chain([(x,y) for x,y in dots if lab[y][x]==part and ((x<CX)==(side=='L'))])
# 骨＝(始点, 終点, 親)。脚は鎖、枝は木
BONES={k:[(J[i],J[i+1],i-1) for i in range(len(J)-1)] for k,J in JOINTS.items()}
ANT_L=[((54.5,18.5),(51.5,11.5),-1),((51.5,11.5),(50.5,0.5),0),((51.5,11.5),(39.5,9.5),0),((53.0,9.0),(54.5,5.0),0)]
mir=lambda p:(W-p[0],p[1])
BONES['LA']=ANT_L; BONES['RA']=[(mir(a),mir(b),pi) for a,b,pi in ANT_L]
def isAntler(x,y): return lab[y][x]=='B' and 38<=x<=80 and not (56<=x<=62) and (y<=14 or (y<=18 and (47<=x<=55 or 63<=x<=71)))
def segd(p,a,b):
    ax,ay=a; bx,by=b; dx,dy=bx-ax,by-ay; L=dx*dx+dy*dy or 1
    t=max(0,min(1,((p[0]-ax)*dx+(p[1]-ay)*dy)/L)); return (p[0]-ax-t*dx)**2+(p[1]-ay-t*dy)**2
OWN={}   # (x,y) -> (key, bone)
for y in range(H):
    for x in range(W):
        if not S[x,y][3]: continue
        l=lab[y][x]
        if l in 'OYUP': k=('L' if x<CX else 'R')+l
        elif isAntler(x,y): k='LA' if x<CX else 'RA'
        else: continue
        bs=BONES[k]
        OWN[(x,y)]=(k,min(range(len(bs)),key=lambda i:segd((x+.5,y+.5),bs[i][0],bs[i][1])))
SP=np.zeros((H,W),np.float32)
_L=lambda a,b:math.hypot(b[0]-a[0],b[1]-a[1])
def _chainlen(J): return sum(_L(J[i],J[i+1]) for i in range(len(J)-1))
for (x,y),(k,i) in OWN.items():
    if k[1]=='A': continue
    J=JOINTS[k]; a_,b_=J[i],J[i+1]; dx,dy=b_[0]-a_[0],b_[1]-a_[1]; LL=dx*dx+dy*dy or 1
    t=max(0,min(1,((x+.5-a_[0])*dx+(y+.5-a_[1])*dy)/LL))
    SP[y,x]=(sum(_L(J[j],J[j+1]) for j in range(i))+t*_L(a_,b_))/_chainlen(J)
CUT={'O':0.45,'Y':0.58,'U':0.5,'P':0.5}          # 部位破壊でここから先が折れる
PARTS={'SW':('LY','LP'),'SE':('RY','RP'),'NW':('LO','LU'),'NE':('RO','RU')}   # 盤面の部位 → 絵の脚
CRACK=[(150,232,222,255),(104,180,173,255)]
BB={}
for (x,y),(k,i) in OWN.items():
    a=BB.setdefault((k,i),[x,y,x,y]); a[0]=min(a[0],x);a[1]=min(a[1],y);a[2]=max(a[2],x);a[3]=max(a[3],y)
def scale2x(a):
    h,w,_=a.shape; p=np.pad(a,((1,1),(1,1),(0,0)),mode='edge')
    B=p[0:h,1:w+1]; D=p[1:h+1,0:w]; F=p[1:h+1,2:w+2]; Hh=p[2:h+2,1:w+1]; E=a
    eq=lambda u,v:np.all(u==v,axis=2)
    c=~eq(B,Hh)&~eq(D,F)
    o=np.zeros((h*2,w*2,4),np.uint8)
    o[0::2,0::2]=np.where((c&eq(D,B))[...,None],D,E)
    o[0::2,1::2]=np.where((c&eq(B,F))[...,None],F,E)
    o[1::2,0::2]=np.where((c&eq(D,Hh))[...,None],D,E)
    o[1::2,1::2]=np.where((c&eq(Hh,F))[...,None],F,E)
    return o
UP=8
A8=np.array(src)
for _ in range(3): A8=scale2x(A8)
OWNID={}; own=np.full((H,W),-1,np.int32)
for (x,y),kb in OWN.items():
    own[y,x]=OWNID.setdefault(kb,len(OWNID))
OWN8=np.repeat(np.repeat(own,UP,0),UP,1)
EDGE0=set()
for y in range(H):
    for x in range(W):
        if S[x,y][3] and any(not(0<=x+dx<W and 0<=y+dy<H) or not S[x+dx,y+dy][3] for dx,dy in((1,0),(-1,0),(0,1),(0,-1))): EDGE0.add((x,y))
EYE={(x,y) for y in range(H) for x in range(W) if S[x,y][3] and (x,y) not in OWN and S[x,y][0]>S[x,y][1]+15}
ey0=min(y for _,y in EYE); ey1=max(y for _,y in EYE)
def isGlint(c): return c[1]>135 and c[2]>130 and c[1]-c[0]>35
def ang(v): return math.atan2(v[1],v[0])
def sub(a,b): return (a[0]-b[0],a[1]-b[1])
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def L(a,b): return math.hypot(b[0]-a[0],b[1]-a[1])
def ik2(A,C,l1,l2,A0,K0,C0):
    d=max(abs(l1-l2)+1e-3,min(l1+l2-1e-3,L(A,C)))
    a=math.acos(max(-1,min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))))
    base=ang(sub(C,A))
    cr=lambda u,v:u[0]*v[1]-u[1]*v[0]
    s=1 if cr(sub(C0,A0),sub(K0,A0))>0 else -1
    return (A[0]+l1*math.cos(base+s*a),A[1]+l1*math.sin(base+s*a))
def pose(cf):
    """cf: by/bx=胴のずれ, tip={脚:(dx,dy)} 足先の目標のずれ, thigh={脚:度} 太ももの追加角, ant=枝の反り(-1〜1)"""
    T={}
    bx,by=cf.get('bx',0),cf.get('by',0); dv=(bx,by)
    for k,J in JOINTS.items():
        new=list(J); part=k[1]; out=-1 if k[0]=='L' else 1
        td=cf.get('tip',{}).get(k,(0,0))
        new[0]=add(J[0],dv)
        if part=='O':                    # 骨1本：足先が目標（無ければ地面）に向くよう付け根で回す
            v=sub(J[1],J[0]); Lb=math.hypot(*v)
            if td==(0,0):
                sy=max(-1,min(1,(J[1][1]-new[0][1])/Lb)); a0=ang(v)
                c=math.copysign(math.sqrt(1-sy*sy),math.cos(a0)); new[1]=(new[0][0]+Lb*c,new[0][1]+Lb*sy)
            else:
                tg=add(J[1],(td[0]*out,td[1])); d=sub(tg,new[0]); n=math.hypot(*d) or 1
                new[1]=(new[0][0]+d[0]/n*Lb,new[0][1]+d[1]/n*Lb)
        else:
            st=1 if part=='Y' else 0
            if st:                        # 黄の太もも：付け根を軸に回る（沈むと膝が上がる）
                tt=math.radians(13*by+cf.get('thigh',{}).get(k,0))*(1 if k[0]=='L' else -1)
                new[1]=add(new[0],rot(sub(J[1],J[0]),tt))
            A=new[st]; C=(J[-1][0]+out*(0.6*by+td[0]),J[-1][1]+td[1])
            new[st+1]=ik2(A,C,L(J[st],J[st+1]),L(J[st+1],J[st+2]),J[st],J[st+1],J[st+2])
            # 届かないときは足先を骨の長さぶんの所に置く
            l2=L(J[st+1],J[st+2]); d=sub(C,new[st+1]); n=math.hypot(*d) or 1
            new[st+2]=(new[st+1][0]+d[0]/n*l2,new[st+1][1]+d[1]/n*l2)
        T[k]=[(J[i],new[i],ang(sub(new[i+1],new[i]))-ang(sub(J[i+1],J[i]))) for i in range(len(J)-1)]
    vel=cf.get('ant',0)
    for k,bs in (('LA',BONES['LA']),('RA',BONES['RA'])):
        sg=-1 if k=='LA' else 1
        tr=math.radians(4.0)*vel*sg; br=math.radians(10.0)*vel*sg
        outl=[]; a0,e0,_=bs[0]; root=add(a0,dv); outl.append((a0,root,tr))
        for i,(a_,e,pi) in enumerate(bs[1:],1):
            outl.append((a_,add(root,rot(sub(a_,a0),tr)),tr+br*(0.7 if i==3 else 1.0)))
        T[k]=outl
    return T
def rot(v,t): c,s=math.cos(t),math.sin(t); return (v[0]*c-v[1]*s,v[0]*s+v[1]*c)
P=14; CW,CH=W+2*P,H+2*P
G0=set()
for y in range(1,H-1):
    for x in range(1,W-1):
        if S[x,y][3]: continue
        if (S[x,y-1][3] and S[x,y+1][3]) or (S[x-1,y][3] and S[x+1,y][3]):
            for d in (-1,0,1): G0.add((x+P,y+P+d))
def fill_holes(D):
    for _ in range(6):
        todo=[]
        for y in range(1,CH-1):
            for x in range(1,CW-1):
                if D[x,y][3] or (x,y) in G0: continue
                up,dn,lf,rt=D[x,y-1],D[x,y+1],D[x-1,y],D[x+1,y]
                if (up[3] and dn[3]) or (lf[3] and rt[3]): todo.append((x,y,up if up[3] else (dn if dn[3] else lf)))
        if not todo: break
        for x,y,c in todo: D[x,y]=c
OUTC=(0,1,1,255)
from scipy import ndimage as _nd
_o=np.array(src)[...,3]>0; _l,_n=_nd.label(_o)
ORIGFRAG={tuple(int(v)+P for v in np.argwhere(_l==j+1)[0][::-1]) for j,sz in enumerate(_nd.sum(_o,_l,range(1,_n+1))) if sz<=3}
_oh=_nd.binary_fill_holes(_o)&~_o
OHOLE=_nd.binary_dilation(np.pad(_oh,P),iterations=1)    # 元絵の閉じた隙間（少し広めに）
def fill_enclosed(D):
    """閉じた穴のうち、元絵の隙間に当たらないドットを、いちばん近いドットの色で埋める
    （脚の重なりの裏など、2ドット以上の穴もこれで埋まる）"""
    a=np.array([[D[x,y][3]>0 for x in range(CW)] for y in range(CH)])
    hole=_nd.binary_fill_holes(a)&~a&~OHOLE
    if not hole.any(): return
    _,(iy,ix)=_nd.distance_transform_edt(~a,return_indices=True)
    for y,x in np.argwhere(hole): D[int(x),int(y)]=D[int(ix[y,x]),int(iy[y,x])]
def bridge(D):
    """回したことで斜めにしか繋がらなくなった小さな切れ端を、角の1ドットで本体に繋ぐ"""
    a=np.array([[D[x,y][3]>0 for x in range(CW)] for y in range(CH)])
    l,n=_nd.label(a)
    for j in range(1,n+1):
        pts=np.argwhere(l==j)
        if len(pts)>3: continue
        if any(abs(int(x)-fx)<=1 and abs(int(y)-fy)<=2 for y,x in pts for fx,fy in ORIGFRAG): continue
        done=False
        for y,x in pts:
            for dx,dy in ((1,1),(1,-1),(-1,1),(-1,-1)):
                X,Y=x+dx,y+dy
                if 0<=X<CW and 0<=Y<CH and a[Y,X] and l[Y,X]!=j:
                    for bx,by in ((X,y),(x,Y)):
                        if not a[by,bx]: D[int(bx),int(by)]=OUTC; done=True; break
                if done: break
            if done: break
def fix_outline(D,FROM):
    """回した部位の縁で、元絵では縁でなかった明るいドットが外気に触れたら輪郭色にする
    （元絵でもともと縁にある明るいドット＝角の照りなどはそのまま）。"""
    todo=[]
    for (X,Y),srcp in FROM.items():
        c=D[X,Y]
        if not c[3] or sum(c[:3])<40 or srcp in EDGE0: continue
        if any(not D[X+dx,Y+dy][3] for dx,dy in((1,0),(-1,0),(0,1),(0,-1)) if 0<=X+dx<CW and 0<=Y+dy<CH): todo.append((X,Y))
    for X,Y in todo: D[X,Y]=OUTC
BOB=[0,0,1,1,1,1,1,1,0,0,-1,-1,-1,-1,0,0]
N=len(BOB)
def render(cf,blink=0,wave=0,fx=()):
    T=pose(cf); bx,b=cf.get('bx',0),cf.get('by',0)
    im=Image.new('RGBA',(CW,CH),(0,0,0,0)); D=im.load(); FROM={}
    BROKEN=set(k for pid in cf.get('broken',()) for k in PARTS[pid])
    def draw_fragment(k):
        # 折れた先：足先を軸に外へ倒れて地面に横たわる
        J=JOINTS[k]; tip=J[-1]; fall=math.radians(78)*(-1 if k[0]=='L' else 1)
        ids={OWNID[(k,i)] for i in range(len(J)-1) if (k,i) in OWNID}
        xs=[x for (x,y),(kk,i) in OWN.items() if kk==k]; ys=[y for (x,y),(kk,i) in OWN.items() if kk==k]
        R_=max(max(xs)-min(xs),max(ys)-min(ys))+4
        for Y in range(int(tip[1])-R_,int(tip[1])+3):
            for X in range(int(tip[0])-R_,int(tip[0])+R_):
                p=add(tip,rot(sub((X+.5,Y+.5),tip),-fall))
                u,v=int(math.floor(p[0]*UP)),int(math.floor(p[1]*UP))
                if not(0<=u<W*UP and 0<=v<H*UP) or OWN8[v,u] not in ids or SP[v//UP,u//UP]<CUT[k[1]]: continue
                c=A8[v,u]
                if c[3] and 0<=X+P<CW and 0<=Y+P<CH and Y<=tip[1]+1:
                    D[X+P,Y+P]=tuple(int(t) for t in c); FROM[(X+P,Y+P)]=(u//UP,v//UP)
    def draw_bones(k):
        for bi,(s0,s1,th) in enumerate(T[k]):
            oid=OWNID.get((k,bi),-9)
            x0,y0,x1,y1=BB.get((k,bi),(0,0,-1,-1))
            if x1<0: continue
            # 変換後の範囲
            cs=[add(s1,rot(sub((x,y),s0),th)) for x in (x0,x1+1) for y in (y0,y1+1)]
            X0=int(min(c[0] for c in cs))-2; X1=int(max(c[0] for c in cs))+2
            Y0=int(min(c[1] for c in cs))-2; Y1=int(max(c[1] for c in cs))+2
            for Y in range(Y0,Y1+1):
                for X in range(X0,X1+1):
                    p=add(s0,rot(sub((X+.5,Y+.5),s1),-th))
                    u,v=int(math.floor(p[0]*UP)),int(math.floor(p[1]*UP))
                    if not(0<=u<W*UP and 0<=v<H*UP) or OWN8[v,u]!=oid: continue
                    if k in BROKEN and SP[v//UP,u//UP]>=CUT[k[1]]: continue
                    c=A8[v,u]
                    if c[3] and 0<=X+P<CW and 0<=Y+P<CH:
                        D[X+P,Y+P]=tuple(int(t) for t in c); FROM[(X+P,Y+P)]=(u//UP,v//UP)
    for k in sorted(BROKEN): draw_fragment(k)
    for part in 'OYUP':
        for side in 'LR': draw_bones(side+part)
    glow=cf.get('glow',1.0)
    for y in range(H):
        for x in range(W):
            c=S[x,y]
            if not c[3] or (x,y) in OWN: continue
            if (x,y) in EYE:
                cut=ey0+(ey1-ey0+1)*blink
                if blink and y<cut: c=(49,65,65,255) if y<int(cut)-1 else (0,2,2,255)
                else: c=tuple(min(255,int(v*glow)) for v in c[:3])+(255,)
            elif isGlint(c):
                q=((x+y*0.6)-wave)%70
                if q<10: k=1.22-abs(q-5)*0.03; c=tuple(min(255,int(v*k)) for v in c[:3])+(255,)
            D[x+bx+P,y+b+P]=c; FROM.pop((x+bx+P,y+b+P),None)
    draw_bones('LA'); draw_bones('RA')
    fill_holes(D)
    fill_enclosed(D)
    fix_outline(D,FROM)
    bridge(D)
    if BROKEN:
        for (X,Y),(sx,sy) in list(FROM.items()):
            kk=OWN.get((sx,sy),(None,))[0]
            if kk in BROKEN and CUT[kk[1]]-0.09<=SP[sy,sx]<CUT[kk[1]] and D[X,Y][3] and sum(D[X,Y][:3])>=40:
                D[X,Y]=CRACK[(X+Y)%2]
    for x,y,c in fx:
        if 0<=x+P<CW and 0<=y+P<CH: D[x+P,y+P]=c
    return im

# ---- 書き出しは vela2_anims.py ----
