from lib import *
from fx import *
from bow import thick_line, string
BASE=load('front48.png')
def region(fn):
    m=np.zeros((48,48),bool)
    for y in range(48):
        for x in range(48):
            if BASE[y,x,3] and fn(x,y): m[y,x]=True
    return m
def take(m): o=blank(); o[m]=BASE[m]; return o
M_hood=region(lambda x,y:y<=25)
M_footL=region(lambda x,y:y>=39 and 19<=x<=23)
M_footR=region(lambda x,y:y>=39 and 27<=x<=31)
M_body=region(lambda x,y:y>25) & ~M_footL & ~M_footR
hood,footL,footR,body=map(take,[M_hood,M_footL,M_footR,M_body])
M_paulL=region(lambda x,y:28<=y<=33 and 12<=x<=18)
M_paulR=region(lambda x,y:28<=y<=33 and 30<=x<=36)
# body without the hanging forearms/hands (arms are drawn as parts)
body_noarm=body.copy()
for x0 in (14,32):
    for y in range(34,38):
        for x in range(x0,x0+3):
            if body_noarm[y,x,3]: put(body_noarm,x,y,'M' if y<37 else 'd')
paulL=blank(); paulL[M_paulL]=body_noarm[M_paulL]
paulR=blank(); paulR[M_paulR]=body_noarm[M_paulR]
body_core=body_noarm.copy()
for M in (M_paulL,M_paulR):
    ys,xs=np.nonzero(M)
    for y,x in zip(ys,xs): put(body_core,x,y,'M')
EYE=[(x,y) for x in range(22,29) for y in range(16,26) if tuple(BASE[y,x]) in (C['b'],C['o'],C['V'],C['v'],C['W'],C['k'],C['y'])]
def blink(h,stage):
    """lid in skin grey: b (lid) / U (shade above the lash line) / o (lash line) / y (lower lid)"""
    if stage==0: return h
    h=h.copy(); ys=[y for _,y in EYE]; y0,y1=min(ys),max(ys)
    cut=(y0+y1)//2+(0 if stage==2 else -2)
    for x,y in EYE:
        if y<cut-1: put(h,x,y,'b')
        elif y==cut-1: put(h,x,y,'U')
        elif y==cut: put(h,x,y,'o')
        elif stage==2: put(h,x,y,'y')
    return h
# ---------- arms ----------
def seg(l,a,b,stone=False):
    hx=abs(b[0]-a[0])>=abs(b[1]-a[1])
    for x,y in line_pts(*a,*b):
        if hx: cs=((0,-1,'u'),(0,0,'B'),(0,1,'d'))
        else:  cs=((-1,0,'B'),(0,0,'u'),(1,0,'d'))
        for ddx,ddy,c in cs:
            if stone: c={'u':'U','B':'g','d':'O'}[c]
            put(l,x+ddx,y+ddy,c)
def upper(img,sh,el,stone=0.0):
    l=blank(); seg(l,sh,el,stone=stone>=1); l=outline(l); comp(img,l)
def lower(img,el,hand,stone=0.0,dark=False):
    l=blank(); st=stone>=1
    seg(l,el,(hand[0],hand[1]-1) if hand[1]>el[1] else hand,stone=st)
    hx,hy=hand
    hc=(('G','O','G'),('O','p','O')) if dark else (('b','b','y'),('g','b','g'))
    if st: hc=(('U','U','g'),('g','O','O'))
    for i,ddx in enumerate((-1,0,1)):
        put(l,hx+ddx,hy,hc[0][i]); put(l,hx+ddx,hy+1,hc[1][i])
    l=outline(l); comp(img,l)
def arm2(img,sh,el,hand,stone=0.0,dark=False,seed=0):
    """shoulder -> elbow -> hand, 3px thick, hand 3x2, outlined as one piece"""
    l=blank()
    st=stone>=1
    seg(l,sh,el,stone=st); seg(l,el,(hand[0],hand[1]-1) if hand[1]>el[1] else hand,stone=st)
    if 0<stone<1:
        rng=np.random.default_rng(seed); ys,xs=np.nonzero(l[:,:,3])
        for y,x in zip(ys,xs):
            if rng.random()<stone: l[y,x]=C['g'] if rng.random()<.6 else C['O']
    hx,hy=hand
    hc=(('G','O','G'),('O','p','O')) if dark else (('b','b','y'),('g','b','g'))
    if st: hc=(('U','U','g'),('g','O','O'))
    for i,ddx in enumerate((-1,0,1)):
        put(l,hx+ddx,hy,hc[0][i]); put(l,hx+ddx,hy+1,hc[1][i])
    l=outline(l); comp(img,l)
SHL=(15,33); SHR=(33,33)          # where the forearm leaves the pauldron
IDLE_HL=(15,35); IDLE_HR=(33,35)  # hand (centre column, top row)
def arm(img,sh,hand,stone=0.0,dark=False,seed=0):
    """front forearm: a 3px column from the pauldron to the hand, hand 3x2. stone>0 turns the sleeve to stone."""
    l=blank()
    pts=line_pts(sh[0],sh[1]+1,hand[0],hand[1]-1) if hand[1]-1>=sh[1]+1 else [(sh[0],sh[1]+1)]
    rng=np.random.default_rng(seed)
    for x,y in pts:
        for dx,c in ((-1,'B'),(0,'u'),(1,'B')):
            cc=c
            if stone>=1: cc={-1:'g',0:'U',1:'O'}[dx]
            elif stone and rng.random()<stone: cc='g' if dx<1 else 'O'
            put(l,x+dx,y,cc)
    hx,hy=hand
    hc=(('G','O','G'),('O','p','O')) if dark else (('b','b','y'),('g','b','g'))
    if stone>=1: hc=(('U','U','g'),('g','O','O'))
    for i,dx in enumerate((-1,0,1)):
        put(l,hx+dx,hy,hc[0][i]); put(l,hx+dx,hy+1,hc[1][i])
    l=outline(l); comp(img,l)
def swing_hand(side,s):
    """s: +1 forward (toward the viewer: lower, a little inward), -1 back (higher, outward, in shadow)"""
    hx,hy=IDLE_HL if side=='L' else IDLE_HR
    inward=1 if side=='L' else -1
    if s>0: return (hx+inward,hy+1),False
    if s<0: return (hx-inward,hy-1),True
    return (hx,hy),False
def frame(body_dy=0,hood_dy=None,dx=0,feet=(0,0),swing=(0,0),hem=0,eye=0,
          arms=None,paul=((0,0),(0,0)),shot=None,peb=(),glints=(),streak=None,chips=(),up=(0,0),head=(0,0)):
    """arms None -> walking swing. Otherwise dict side -> dict(el=elbow or None, hand=(x,y), stone, dark, behind)
    paul = pauldron offsets ((dxL,dyL),(dxR,dyR)): shoulders move with the arms
    up = (dx,dy) of everything from the waist up (torso, shoulders, arms, bow, head); head = extra for the hood"""
    dx+=up[0]; body_dy+=up[1]
    if hood_dy is None: hood_dy=body_dy
    hood_dy+=head[1]; hdx=dx+head[0]
    img=blank()
    comp(img,footL,0,-feet[0]); comp(img,footR,0,-feet[1])
    b=split_shift(body_core,33,body_dy,0,dx,0)      # upper body moves, hem stays on the feet
    if hem:
        m=b[:,:,3]>0; b=shear_rows(b,m,35,hem,41)
    comp(img,b)
    if arms is None:     # walking: the shoulder of the arm swinging forward dips a pixel
        paul=tuple((0,1 if sv>0 else 0) for sv in swing)
    (lx,ly),(rx,ry)=paul
    SH={'L':(15+lx,31+ly),'R':(33+rx,31+ry)}       # shoulder joints (inside the pauldrons)
    ROOT={'L':(15+lx,33+ly),'R':(33+rx,33+ry)}     # where a hanging arm leaves the pauldron
    def A(side,hand,el=None,stone=0,dark=False,behind=False,part='all'):
        o=lambda p:(p[0]+dx,p[1]+body_dy)
        if el is None:
            sh=ROOT[side]; arm2(img,o(sh),o(sh),o(hand),stone=stone,dark=dark,seed=hand[0]*3+hand[1])
        elif part=='upper': upper(img,o(SH[side]),o(el),stone=stone)
        elif part=='lower': lower(img,o(el),o(hand),stone=stone,dark=dark)
        else: arm2(img,o(SH[side]),o(el),o(hand),stone=stone,dark=dark,seed=hand[0]*3+hand[1])
    poses={}
    if arms is None:
        for side,sv in (('L',swing[0]),('R',swing[1])):
            h,dk=swing_hand(side,sv); poses[side]=dict(hand=h,dark=dk)
    else: poses=arms
    # a drawing arm: the upper arm runs in behind the head (drawn before the pauldron and hood),
    # the forearm comes forward from under the chin to the hand (drawn after)
    for side,pz in poses.items():
        if pz.get('behind'): A(side,**{**pz,'part':'upper'})
    comp(img,paulL,lx+dx,ly+body_dy); comp(img,paulR,rx+dx,ry+body_dy)
    for side,pz in poses.items():          # forearm + hand under the chin: the hood still covers the elbow
        if pz.get('behind'): A(side,**{**pz,'part':'lower'})
    comp(img,blink(hood,eye),hdx,hood_dy)
    if shot: draw_shot(img,body_dy,dx,**shot)
    for side,pz in poses.items():
        if not pz.get('behind'): A(side,**pz)
    if peb: pebbles(img,peb)
    for c in chips: chip(img,*c)
    for g in glints: glint(img,*g)
    if streak:
        x,y0,y1=streak
        for y in range(y0,y1): put(img,x,y,'w' if y<y0+3 else 'T')
    fill_holes(img,(8,18,40,40))
    return img
def chip(img,x,y):
    put(img,x,y,'g'); put(img,x+1,y,'O')
# ---------- shooting: stone climbs the bow arm (viewer's right) and grows into a canted bow at the fist ----------
GRIP=(27,35)
def hbow(gx,gy,w=9,k=1,form=1.0,crack=0,seed=0,grow=None):
    lay=blank()
    W=w if grow is None else grow
    for xx in range(-W,W+1):
        t=abs(xx)/w; y=gy-round(k*t*t); x=gx+xx
        put(lay,x,y,'U')
        if t<0.75: put(lay,x,y+1,'g')
        if t<0.3: put(lay,x,y+2,'O')
    for xx in (-3,3):
        if abs(xx)<=W: put(lay,gx+xx,gy+1,'v')
    lay=outline(lay)
    tl=(gx-W,gy-round(k*(W/w)**2)); tr=(gx+W,gy-round(k*(W/w)**2))
    if grow is None or grow>=w:
        for (x,y),s in ((tl,-1),(tr,1)):
            put(lay,x,y,'t'); put(lay,x+s,y,'T'); put(lay,x+s,y-1,'K'); put(lay,x+s,y+1,'K'); put(lay,x+2*s,y,'K')
    if form<1 or crack:
        rng=np.random.default_rng(seed)
        ys,xs=np.nonzero(lay[:,:,3])
        for y,x in zip(ys,xs):
            if form<1 and rng.random()>form: lay[y,x]=0
            elif crack and rng.random()<0.12*crack: lay[y,x]=C['K'] if rng.random()<.5 else 0
    return lay,tl,tr
def arrow_d(lay,nock,tip):
    pts=line_pts(*nock,*tip)
    for x,y in pts[1:-2]: put(lay,x,y,'v')
    put(lay,*nock,'t')
    x,y=tip; put(lay,x,y,'T'); px,py=pts[-2]; put(lay,px,py,'t')
    for p in ((x,y+1),(x+1,y),(x-1,y),(x+1,y+1),(x-1,y+1)):
        if lay[p[1],p[0],3]==0: put(lay,*p,'K')
def draw_shot(img,dy,dx,bow=None,apex=None,arrow=None,vib=False,grow=None):
    if not bow: return
    k,form,crack=bow
    b,tl,tr=hbow(GRIP[0]+dx,GRIP[1]+dy,k=k,form=form,crack=crack,seed=k*13+int(form*10),grow=grow)
    if apex and form>=1 and not crack and grow is None:
        st=blank(); ax,ay=apex
        string(st,tl,(ax+dx,(ay+dy) if not vib else tl[1]+1),tr,col='y'); comp(img,st)
    comp(img,b)
    if arrow:
        ar=blank(); arrow_d(ar,(arrow[0][0]+dx,arrow[0][1]+dy),(arrow[1][0]+dx,arrow[1][1]+dy)); comp(img,ar)
# ---------- animations ----------
def idle():
    bd=[0,0,0,1,1,1]*2; hd=[1,0,0,1,1,1]*2
    eye=[0]*12; eye[7]=1; eye[8]=2; eye[9]=1
    return [frame(bd[i],hd[i],eye=eye[i]) for i in range(12)],[130]*12
def walk():
    fr=[]
    for i in range(8):
        bd=1 if i in (0,4) else 0
        fL=[0,1,2,1,0,0,0,0][i]; fR=[0,0,0,0,0,1,2,1][i]
        # arm opposite to the leg: left foot lifts (steps) -> right arm forward
        sR=[1,1,1,0,-1,-1,-1,0][i]; sL=-sR
        hem=[0,1,1,0,0,-1,-1,0][i]   # hem swings toward the stepping side a moment later
        fr.append(frame(bd,bd,feet=(fL,fR),swing=(sL,sR),hem=hem))
    return fr,[95]*8
def shoot():
    S=[]
    IL=dict(hand=IDLE_HL); IR=dict(hand=IDLE_HR)
    UP=[((0, 0), (0, 0)), ((1, 0), (0, 0)), ((1, 0), (1, 0)), ((1, 0), (1, 0)), ((0, -1), (1, 0)), ((-1, -1), (1, 0)), ((-1, -1), (1, 0)), ((-1, 0), (1, 1)), ((-1, 0), (0, 0)), ((0, 0), (0, 0)), ((0, 1), (0, 0)), ((0, 0), (0, 0))]
    def f(**kw):
        u,h=UP[len(S)]
        S.append(frame(up=u,head=h,**kw))
    G=GRIP
    # 0 stones stir in front of the bow arm
    f(arms={'L':IL,'R':IR},peb=[(31,42,2),(36,43,1),(26,43,1)])
    # 1 right shoulder rolls forward (in + down), the whole arm swings forward, stones jump on
    f(arms={'L':IL,'R':dict(el=(32,35),hand=(30,37),stone=0.4)},paul=((0,0),(-1,1)),peb=[(32,40,1),(35,38,1),(27,41,1)])
    # 2 arm straight at the target, forearm all stone, limbs grow from the fist; left arm starts to come in
    f(arms={'L':dict(el=(16,34),hand=(19,35)),'R':dict(el=(30,35),hand=G,stone=1)},paul=((0,0),(-1,1)),
      shot=dict(bow=(1,1,0),grow=4),glints=[(G[0],G[1]-1)])
    # 3 bow complete; left shoulder comes forward too and the hand nocks at the grip
    f(arms={'L':dict(el=(19,35),hand=(23,33)),'R':dict(el=(30,35),hand=G,stone=1)},paul=((1,1),(-1,1)),
      shot=dict(bow=(1,1,0),apex=(24,34),arrow=((24,33),(28,39))),glints=[(G[0]-9,G[1]-1),(G[0]+9,G[1]-1)])
    # 4 drawing: left shoulder pulls back (up), elbow rises out to the side
    f(arms={'L':dict(el=(20,27),hand=(22,31),behind=True),'R':dict(el=(30,35),hand=G,stone=1)},paul=((1,-1),(-1,1)),
      shot=dict(bow=(2,1,0),apex=(23,32),arrow=((23,31),(28,39))))
    # 5 full draw: elbow high and back, hand at the chin
    f(arms={'L':dict(el=(21,25),hand=(22,28),behind=True),'R':dict(el=(30,35),hand=G,stone=1)},paul=((1,-1),(-1,1)),
      shot=dict(bow=(2,1,0),apex=(23,29),arrow=((23,28),(28,39))))
    # 6 hold
    f(arms={'L':dict(el=(21,25),hand=(22,28),behind=True),'R':dict(el=(30,35),hand=G,stone=1)},paul=((1,-1),(-1,1)),
      shot=dict(bow=(2,1,0),apex=(23,29),arrow=((23,28),(28,39))))
    # 7 release: the draw hand flies back past the chin, shoulder kicks back
    f(arms={'L':dict(el=(20,24),hand=(19,27),behind=True),'R':dict(el=(30,35),hand=G,stone=1)},paul=((1,-2),(-1,1)),
      shot=dict(bow=(1,1,0),apex=(27,34)),streak=(28,40,48))
    # 8 follow-through
    f(arms={'L':dict(el=(20,25),hand=(19,27),behind=True),'R':dict(el=(30,35),hand=G,stone=1)},paul=((1,-1),(-1,1)),
      shot=dict(bow=(1,1,0),apex=(27,34),vib=True))
    # 9 bow cracks, left arm comes down
    f(arms={'L':dict(el=(15,33),hand=(17,35)),'R':dict(el=(30,35),hand=G,stone=1)},paul=((0,0),(-1,1)),shot=dict(bow=(1,1,1)))
    # 10 stone falls off the arm, right shoulder rolls back
    f(arms={'L':IL,'R':dict(el=(32,35),hand=(31,36),stone=0.4)},paul=((0,0),(0,1)),
      peb=[(20,38,2),(26,39,1),(33,38,2),(23,41,1),(30,42,1)])
    # 11 stones on the ground
    f(arms={'L':IL,'R':IR},peb=[(21,43,2),(29,43,1),(34,43,1)])
    return S,[100,90,90,100,90,100,240,50,110,90,90,120]
def hurt():
    # flinch: head ducks, body squashes, a quick shake, eye shut; chips fly off the hood
    up={'L':dict(hand=(15,34),dark=True),'R':dict(hand=(33,34),dark=True)}
    F=[frame(1,2,dx=1,eye=2,arms=up,paul=((0,-1),(0,-1)),chips=[(34,17),(14,19)]),
       frame(1,2,dx=-1,eye=2,arms=up,paul=((0,-1),(0,-1)),chips=[(36,14),(12,16)]),
       frame(1,1,dx=0,eye=1,chips=[(38,12),(10,14)]),
       frame(0,1,eye=1),
       frame(0,0,eye=0)]
    return F,[70,70,100,100,110]
