from side import *
from bow import *
def arm(lay,sh,hand,near=True,bracer=True):
    a=blank()
    top,bot=('m','M') if near else ('d','D')
    thick_line(a,sh,hand,[top,bot])
    if near and bracer:
        pts=line_pts(*sh,*hand); n=len(pts)
        for x,y in pts[n*2//3:n*2//3+3]: put(a,x,y,'t'); put(a,x,y+1,'m')
    a=outline(a)
    hx,hy=hand
    hc=('b','g') if near else ('G','O')
    for dx in (0,1):
        put(a,hx+dx,hy,hc[0]); put(a,hx+dx,hy+1,hc[1])
    comp(lay,a)
def far_elbow(lay,ex,ey):
    a=blank()
    for x in range(ex-3,ex+1): put(a,x,ey,'d'); put(a,x,ey+1,'D')
    a=outline(a); comp(lay,a)
def frame_fulldraw():
    img=blank()
    gx,gy=10,26
    bow,tt,bt=side_bow(gx,gy,h=8,k=3)
    anchor=(20,25)
    st=blank(); string(st,tt,anchor,bt)
    ar=blank(); arrow_h(ar,anchor[0],5,25)
    # back to front
    far_elbow(img,31,24)
    comp(img,cape)
    comp(img,torso_full)
    legs(img,near=(-1,0),far=(2,0))
    comp(img,st); comp(img,ar)
    comp(img,collar); comp(img,hood)
    comp(img,bow)
    arm(img,(22,28),(10,26))
    return img
if __name__=='__main__':
    f=frame_fulldraw()
    save(f,'out/side_fulldraw_try.png',12,(40,44,52,255))
