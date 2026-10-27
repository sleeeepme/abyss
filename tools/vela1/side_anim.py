from side import *
from bow import *
from fx import *
from shoot_side import arm as draw_arm, far_elbow
from side import arm
EYE=[(x,y) for y in range(13,24) for x in range(14,21) if hood[y,x,3] and tuple(hood[y,x]) in (C['A'],C['o'],C['b'],C['g'],C['G'])]
def blink(h,stage):
    """stage 0 open, 1 half, 2 closed. lid in skin grey (b / U shade / o lash line / y lower lid)"""
    if stage==0: return h
    h=h.copy()
    ys=[y for _,y in EYE]; y0,y1=min(ys),max(ys)
    cut=y0+(y1-y0)//2 if stage==1 else y1-1
    for x,y in EYE:
        if y<cut-1: put(h,x,y,'b')
        elif y==cut-1: put(h,x,y,'U')
        elif y==cut: put(h,x,y,'o')
        elif stage==2: put(h,x,y,'y')
    return h
def frame(body_dy=0,hood_dy=None,body_dx=0,hood_dx=None,chips=(),cape_hem=(0,0),near_arm=None,arm_swing=0,legs_p=((0,0),(0,0)),
          eye=0,bow=None,str_apex=None,arrow=None,elbow=None,farhand=None,peb=(),glints=(),streak=None,vib=False,catch=False,
          up=(0,0),head=(0,0)):
    """up: waist-up offset (torso, collar, cape top, arms, bow, arrow, head). head: extra for the hood"""
    body_dx+=up[0]; body_dy+=up[1]
    if hood_dy is None: hood_dy=body_dy
    if hood_dx is None: hood_dx=body_dx
    hood_dx+=head[0]; hood_dy+=head[1]
    X=body_dx
    img=blank()
    if elbow: e=blank(); far_elbow(e,*elbow); comp(img,e,X,body_dy)
    if farhand:
        fh=blank(); draw_arm(fh,farhand[0],farhand[1],near=False); comp(img,fh,X,body_dy)
    # cape: top follows the body, hem lags (compresses / sways)
    cp=split_shift(cape,33,body_dy,0,body_dx,0)
    if cape_hem!=(0,0):
        m=cp[:,:,3]>0
        cp=shear_rows(cp,m,32,cape_hem[0],41)
    lg=blank(); legs(lg,near=legs_p[0],far=legs_p[1],which='far'); comp(img,lg)   # far leg behind the cape
    comp(img,cp)
    lg=blank(); legs(lg,near=legs_p[0],far=legs_p[1],which='near'); comp(img,lg)
    if body_dy<0: comp(img,split_shift(torso_full,35,body_dy,0,body_dx,0))   # rising: hips stay on the legs
    else: comp(img,torso_full,body_dx,body_dy)
    # near leg over the torso bottom edge? (no: torso covers hips)
    if bow:
        gx,gy,k,form,crack=bow
        b,tt,bt=side_bow(gx+X,gy+body_dy,h=8,k=k,form=form,crack=crack,seed=gx*7+k)
        if str_apex and form>=1 and not crack:
            st=blank()
            ax,ay=str_apex
            if vib: ax=tt[0]-1
            string(st,tt,(ax+(0 if vib else X),ay+body_dy),bt); comp(img,st)
    if arrow:
        ar=blank(); arrow_h(ar,arrow[0]+X,arrow[1]+X,arrow[2]+body_dy); comp(img,ar)
    comp(img,collar,body_dx,body_dy)
    comp(img,blink(hood,eye),hood_dx,hood_dy)
    if bow: comp(img,b)
    if near_arm is None:
        m=arm[:,:,3]>0
        a=shear_rows(arm,m,29,arm_swing,36) if arm_swing else arm
        comp(img,a,body_dx,body_dy)
    else:
        na=blank(); draw_arm(na,(near_arm[0][0]+X,near_arm[0][1]+body_dy),(near_arm[1][0]+X,near_arm[1][1]+body_dy)); comp(img,na)
    if peb: pebbles(img,peb)
    for c in chips: put(img,c[0],c[1],'g'); put(img,c[0]+1,c[1],'O')
    for g in glints: glint(img,*g)
    if catch: put(img,15+hood_dx,16+hood_dy,'w')
    if streak:
        x0,x1,y=streak
        for x in range(x0,x1+X): put(img,x,y+body_dy,'w' if x>x1-4 else 'T')
    fill_holes(img,(20,33,40,44))
    return img
# ---------------- animations ----------------
def idle():
    body=[0,0,0,1,1,1]*2; hood=[1,0,0,1,1,1]*2
    eye=[0]*12; eye[7]=1; eye[8]=2; eye[9]=1
    hem=[0,0,0,1,1,1]*2
    fr=[frame(body[i],hood[i],eye=eye[i],cape_hem=(hem[i],0)) for i in range(12)]
    return fr,[130]*12
def walk():
    import math
    fr=[]
    for i in range(8):
        c=math.cos(2*math.pi*i/8)
        nf=[-3,-2,0,1,2,1,0,-2][i]; ff=[2,1,0,-2,-3,-2,0,1][i]
        nl=1 if i in (5,6,7) and i==6 else 0
        fl=1 if i==2 else 0
        nl=1 if i==6 else 0
        bd=1 if i in (0,4) else 0
        swing=[1,1,0,-1,-1,-1,0,1][i]   # near arm back when near foot forward
        hem=[1,2,2,1,1,2,2,1][i]
        fr.append(frame(bd,bd,legs_p=((nf,nl),(ff,fl)),arm_swing=swing,cape_hem=(hem,0)))
    return fr,[95]*8
GX,GY=10,26
SH=(22,28)
def shoot():
    F=[]
    _f=globals()['frame']; H=head_lag(SHOOT_UP,NOD)
    def frame(**kw):
        i=len(F); return _f(up=SHOOT_UP[i],head=H[i],**kw)
    # 0 idle, pebbles stir on the ground in front
    F.append(frame(peb=[(9,40,2),(13,41,1),(6,41,1)]))
    # 1 bow arm rises forward, pebbles lift toward the grip
    F.append(frame(near_arm=(SH,(15,31)),peb=[(9,35,2),(13,38,1),(5,32,1),(15,33,1)],legs_p=((-1,0),(1,0))))
    # 2 arm extended, stones gather into a bow (half formed)
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,2,0.45,0),peb=[(7,22,1),(9,30,1),(13,19,1)],glints=[(GX+1,GY-1,False)],legs_p=((-1,0),(2,0))))
    # 3 bow complete (crystal tips flash), draw hand nocks the arrow at the grip
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,2,1.0,0),str_apex=(13,25),arrow=(13,4,25),farhand=((19,27),(13,25)),
                   glints=[(GX+2,GY-9),(GX+2,GY+9)],legs_p=((-1,0),(2,0))))
    # 4 drawing (string half back, elbow starts to show behind the head)
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,2,1.0,0),str_apex=(17,25),arrow=(17,5,25),elbow=(28,24),legs_p=((-1,0),(2,0))))
    # 5 full draw: anchor under the eye, elbow high behind
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,3,1.0,0),str_apex=(20,25),arrow=(20,5,25),elbow=(31,24),legs_p=((-1,0),(2,0))))
    # 6 hold
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,3,1.0,0),str_apex=(20,25),arrow=(20,5,25),elbow=(31,24),legs_p=((-1,0),(2,0)),catch=True))
    # 7 release: string snaps straight, arrow gone (streak), draw hand follows through
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,2,1.0,0),str_apex=(GX+2,25),elbow=(32,23),streak=(0,8,25),legs_p=((-1,0),(2,0))))
    # 8 follow-through, string vibrates
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,2,1.0,0),str_apex=(GX+1,25),vib=True,elbow=(32,23),legs_p=((-1,0),(2,0))))
    # 9 bow cracks
    F.append(frame(near_arm=(SH,(GX,GY)),bow=(GX,GY,2,1.0,1),legs_p=((-1,0),(2,0))))
    # 10 crumbles: chips fall, arm lowers
    F.append(frame(near_arm=(SH,(15,31)),peb=[(11,23,2),(13,29,1),(12,35,2),(8,30,1),(15,39,1)],legs_p=((-1,0),(1,0))))
    # 11 chips on the ground, back to idle
    F.append(frame(peb=[(11,41,2),(14,41,1),(8,41,1)]))
    D=[100,90,90,100,90,100,240,50,110,90,90,120]
    return F,D
# waist-up motion for the shot (facing left: -x = toward the target)
SHOOT_UP=[(0,0),(-1,0),(-1,0),(-1,0),(0,-1),(1,-1),(1,-1),(1,0),(1,0),(0,0),(0,1),(0,0)]
NOD={7:1}
def head_lag(UP,nod):
    """the hood follows the torso one frame late (sideways always; vertically only when the body rises)"""
    H=[]
    for i,(ux,uy) in enumerate(UP):
        px,py=UP[i-1] if i else UP[0]
        H.append((px-ux, max(0,py-uy)+nod.get(i,0)))
    return H

def hurt():
    # hit from the front (left): head snaps back, body rocks back over planted feet,
    # the hanging arm and the cloak hem lag forward; eye shuts; stone chips fly off the hood
    F=[frame(1,1,body_dx=1,hood_dx=2,eye=2,arm_swing=-1,cape_hem=(-1,0),chips=[(14,15),(17,11)]),
       frame(1,1,body_dx=1,hood_dx=2,eye=2,arm_swing=-1,cape_hem=(-1,0),chips=[(11,13),(16,8)]),
       frame(0,0,body_dx=1,hood_dx=1,eye=1,arm_swing=0,chips=[(9,12),(15,5)]),
       frame(0,0,body_dx=0,hood_dx=1,eye=1,cape_hem=(1,0)),
       frame(0,0,eye=0)]
    return F,[70,70,100,100,110]
