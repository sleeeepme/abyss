from lib import *
from fx import *
from front_anim import hbow
BASE=load('cell_back.png')
def region(fn):
    m=np.zeros((48,48),bool)
    for y in range(48):
        for x in range(48):
            if BASE[y,x,3] and fn(x,y): m[y,x]=True
    return m
def take(m): o=blank(); o[m]=BASE[m]; return o
M_hood=region(lambda x,y:y<=21)
M_footL=region(lambda x,y:y>=40 and x<=23)
M_footR=region(lambda x,y:y>=40 and x>=24)
M_cape=region(lambda x,y:22<=y<=39)
hood,footL,footR,cape=map(take,[M_hood,M_footL,M_footR,M_cape])
def bulge(layer,side,amt,y0=22,y1=31,peak=25):
    """push the outer edge of the cloak out around the shoulder (an arm raised under the cloth).
    only the last 4 px of each row move; the gap is filled with the cloth colour next to it."""
    out=layer.copy(); w=layer.shape[1]
    for y in range(y0,y1+1):
        t=1-abs(y-peak)/max(peak-y0,y1-peak)
        d=int(round(amt*max(0,t)))
        if d<=0: continue
        xs=np.nonzero(layer[y,:,3])[0]
        if not len(xs): continue
        if side=='R':
            xr=xs.max(); seg=layer[y,xr-3:xr+1].copy()
            fillc=layer[y,xr-4].copy()
            for X in range(xr-3,xr-3+d): out[y,X]=fillc
            out[y,xr-3+d:xr+1+d]=seg
        else:
            xl=xs.min(); seg=layer[y,xl:xl+4].copy()
            fillc=layer[y,xl+4].copy()
            for X in range(xl+4-d,xl+4): out[y,X]=fillc
            out[y,xl-d:xl+4-d]=seg
    return out
def frame(body_dy=0,hood_dy=None,dx=0,feet=(0,0),hem=0,bulgeL=0,bulgeR=0,bow=None,farpeb=(),peb=(),glints=(),streak=None,chips=(),
          up=(0,0),head=(0,0)):
    dx+=up[0]; body_dy+=up[1]
    if hood_dy is None: hood_dy=body_dy
    hood_dy+=head[1]; hdx=dx+head[0]
    img=blank()
    # things beyond her (up-screen) are drawn first so the body hides them
    if farpeb: pebbles(img,farpeb)
    if bow:
        k,form,crack=bow
        b,tl,tr=hbow(24+dx,17+body_dy,w=13,k=-k-1,form=form,crack=crack,seed=k*5+int(form*10))
        comp(img,b)
    for f,l in ((footL,feet[0]),(footR,feet[1])):
        if l<1: comp(img,f)
    cp=split_shift(cape,32,body_dy,0,dx,0)
    if hem:
        m=cp[:,:,3]>0; cp=shear_rows(cp,m,30,hem,39)
    if bulgeR: cp=bulge(cp,'R',bulgeR)
    if bulgeL: cp=bulge(cp,'L',bulgeL,peak=26)
    comp(img,cp)
    comp(img,hood,hdx,hood_dy)
    if peb: pebbles(img,peb)
    for c in chips: put(img,c[0],c[1],'g'); put(img,c[0]+1,c[1],'O')
    for g in glints: glint(img,*g)
    if streak:
        x,y0,y1=streak
        for y in range(y0,y1): put(img,x+dx,y,'w' if y>y1-4 else 'T')
    return img
def outline_fix(lay):
    """re-outline after the cloth was pushed out: transparent px next to the new edge -> K"""
    a=lay[:,:,3]>0; out=lay.copy()
    for y in range(1,47):
        for x in range(1,47):
            if a[y,x] and tuple(lay[y,x])==C['m']:
                for dx in (-1,1):
                    if not a[y,x+dx]: out[y,x+dx]=C['K']
    return out
def idle():
    bd=[0,0,0,1,1,1]*2; hd=[1,0,0,1,1,1]*2; hem=[0,0,1,1,1,0]*2
    return [frame(bd[i],hd[i],hem=hem[i]) for i in range(12)],[130]*12
def walk():
    fr=[]
    for i in range(8):
        bd=1 if i in (0,4) else 0
        fL=1 if i in (1,2,3) else 0; fR=1 if i in (5,6,7) else 0
        hem=[1,1,0,-1,-1,-1,0,1][i]
        fr.append(frame(bd,bd,feet=(fL,fR),hem=hem))
    return fr,[95]*8
from side_anim import head_lag
# waist-up motion for the shot, seen from behind: bow side = screen left, drawing side = screen right
BACK_UP=[(0,0),(-1,0),(-1,0),(-1,0),(0,-1),(1,-1),(1,-1),(1,0),(1,0),(0,0),(0,1),(0,0)]
def shoot():
    # The bow forms in front of her (beyond the hood). Stones rise from the ground on the far side,
    # mostly hidden by her body, and show only where they pass the edges of the cloak.
    # Arms stay under the cloak: the bow arm lifts the left shoulder a little, the drawing elbow pushes the right side out.
    S=[]; H=head_lag(BACK_UP,{})
    def f(**kw):
        i=len(S); S.append(frame(up=BACK_UP[i],head=H[i],**kw))
    f(farpeb=[(10,34,2),(37,33,1),(15,31,1),(33,30,1)])
    f(bulgeL=1,farpeb=[(7,26,2),(38,24,1),(12,22,1),(36,20,1)])
    f(bulgeL=1,bow=(1,0.45,0),farpeb=[(10,17,1),(38,16,1)],glints=[(24,5)])
    f(bulgeL=1,bulgeR=1,bow=(1,1,0),glints=[(11,17),(37,17)])
    f(bulgeL=1,bulgeR=2,bow=(2,1,0))
    f(bulgeL=1,bulgeR=3,bow=(2,1,0))
    f(bulgeL=1,bulgeR=3,bow=(2,1,0))
    f(bulgeL=1,bulgeR=3,bow=(1,1,0),streak=(24,0,6))
    f(bulgeL=1,bulgeR=2,bow=(1,1,0))
    f(bulgeL=1,bulgeR=1,bow=(1,1,1))
    f(bulgeL=1,farpeb=[(11,22,2),(37,23,1),(9,28,1),(38,30,2),(24,4,1)])
    f(farpeb=[(10,35,2),(37,34,1),(13,36,1)])
    return S,[100,90,90,100,90,100,240,50,110,90,90,120]
def hurt():
    F=[frame(1,2,dx=1,chips=[(36,12),(11,15)]),
       frame(1,2,dx=-1,chips=[(38,9),(9,12)]),
       frame(1,1,chips=[(40,7),(7,10)]),
       frame(0,1),
       frame(0,0)]
    return F,[70,70,100,100,110]
