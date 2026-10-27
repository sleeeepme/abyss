from lib import *
def pebbles(img,pts):
    """pts: list of (x,y,size) size 1 or 2 ; stone chips with dark outline"""
    lay=blank()
    for x,y,s in pts:
        x,y=int(round(x)),int(round(y))
        put(lay,x,y,'g')
        if s>=2: put(lay,x+1,y,'O')
        if s>=3: put(lay,x,y+1,'O'); put(lay,x+1,y+1,'p')
    lay=outline(lay)
    comp(img,lay)
def glint(img,x,y,big=False):
    put(img,x,y,'w')
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)): put(img,x+dx,y+dy,'T')
    if big:
        for dx,dy in ((2,0),(-2,0),(0,2),(0,-2)): put(img,x+dx,y+dy,'t')
def shear_rows(src,mask,top,dx_bottom,bottom):
    """shift rows of masked pixels horizontally, linearly from 0 at `top` to dx_bottom at `bottom`"""
    out=blank()
    ys,xs=np.nonzero(mask)
    for y,x in zip(ys,xs):
        t=0 if bottom==top else max(0,min(1,(y-top)/(bottom-top)))
        X=x+int(round(dx_bottom*t))
        if 0<=X<48: out[y,X]=src[y,x]
    return out
def split_shift(layer,cut,dy_top,dy_bot=0,dx_top=0,dx_bot=0):
    """move rows <=cut by (dx_top,dy_top) and rows >cut by (dx_bot,dy_bot); top drawn last (overlaps)"""
    out=blank()
    lo=layer.copy(); lo[:cut+1]=0
    hi=layer.copy(); hi[cut+1:]=0
    comp(out,lo,dx_bot,dy_bot); comp(out,hi,dx_top,dy_top)
    if dy_top<0:   # body rises: stretch by repeating the waist row so nothing tears
        row=blank(); row[cut]=layer[cut]
        for k in range(1,-dy_top+1):
            comp(out,row,dx_top,dy_top+k)
    return out
def fill_holes(img,box,col='K'):
    x0,y0,x1,y1=box; a=img[:,:,3]>0
    for y in range(max(1,y0),min(47,y1)):
        for x in range(max(1,x0),min(47,x1)):
            if not a[y,x] and a[y-1,x] and a[y+1,x] and a[y,x-1] and a[y,x+1]:
                put(img,x,y,col)
    return img
