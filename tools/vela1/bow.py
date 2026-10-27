from lib import *
def thick_line(lay,a,b,cols,w=2,axis='y'):
    """cols: list of colour keys across thickness (len w), drawn along line a->b.
    axis='y' stacks thickness downward (for mostly-horizontal limbs), 'x' rightward."""
    for (x,y) in line_pts(*a,*b):
        for i,c in enumerate(cols[:w]):
            if axis=='y': put(lay,x,y+i,c)
            else: put(lay,x+i,y,c)
def side_bow(gx,gy,h=8,k=3,form=1.0,crack=0,seed=0):
    """vertical stone bow seen from the side, facing left. grip at (gx,gy).
    limbs curve back to the right (toward the archer) by k at the tips.
    returns (layer, top_tip, bottom_tip)"""
    lay=blank()
    pts=[]
    for yy in range(-h,h+1):
        t=abs(yy)/h
        x=gx+round(k*t*t)
        pts.append((x,gy+yy,t))
    for x,y,t in pts:
        put(lay,x,y,'g')                 # outer (target side) light stone
        if t<0.75: put(lay,x+1,y,'O')    # inner darker stone, limbs thin out to 1px
        if t<0.3: put(lay,x+2,y,'p')     # thick grip
    # amber veins above/below the grip
    for yy in (-3,3): put(lay,gx,gy+yy,'v')
    put(lay,gx+1,gy-2,'W'); put(lay,gx+1,gy+2,'W')
    lay=outline(lay)
    # crystal tips (drawn after outline so they glow at the end)
    tt=(gx+k,gy-h); bt=(gx+k,gy+h)
    for (x,y),s in ((tt,-1),(bt,1)):
        put(lay,x,y,'t'); put(lay,x,y+s,'T'); put(lay,x+1,y+s,'K'); put(lay,x-1,y+s,'K'); put(lay,x,y+2*s,'K')
    if form<1.0 or crack:
        rng=np.random.default_rng(seed)
        ys,xs=np.nonzero(lay[:,:,3])
        for y,x in zip(ys,xs):
            if form<1.0 and rng.random()>form: lay[y,x]=0
            elif crack and rng.random()<0.12*crack: lay[y,x]=C['K'] if rng.random()<0.5 else 0
    return lay,(gx+k,gy-h),(gx+k,gy+h)
def string(lay,a,mid,b,col='y'):
    for p,q in ((a,mid),(mid,b)):
        for x,y in line_pts(*p,*q): put(lay,x,y,col)
def arrow_h(lay,nx,tx,y):
    """horizontal arrow facing left: nock at nx, tip at tx (tx<nx)"""
    for x in range(tx+2,nx+1): put(lay,x,y,'U')
    put(lay,nx,y,'t'); put(lay,nx-1,y,'t'); put(lay,nx,y-1,'t')       # fletching
    put(lay,tx+1,y,'g'); put(lay,tx,y,'g'); put(lay,tx+1,y-1,'g'); put(lay,tx+1,y+1,'g')  # stone head
    # head outline
    for x,y2 in ((tx-1,y),(tx,y-1),(tx,y+1),(tx+1,y-2),(tx+1,y+2),(tx+2,y-1),(tx+2,y+1)):
        if lay[y2,x,3]==0: put(lay,x,y2,'K')
