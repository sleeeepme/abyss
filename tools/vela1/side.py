from lib import *
BASE=load('cell_faceL.png')
def region(fn):
    m=np.zeros((48,48),bool)
    for y in range(48):
        for x in range(48):
            if BASE[y,x,3] and fn(x,y): m[y,x]=True
    return m
def arm_fn(x,y): return (22<=x<=25 and 29<=y<=34) or (21<=x<=25 and 35<=y<=36) or (x==21 and 31<=y<=34)
M_hood =region(lambda x,y: y<=24)
M_arm  =region(arm_fn)
M_cape =region(lambda x,y: x>=26 and y>=28 and not arm_fn(x,y))
M_leg  =region(lambda x,y: y>=38 and x<=27)
M_collar=region(lambda x,y: 25<=y<=28 and not M_cape[y,x])
M_torso=region(lambda x,y: 29<=y<=37 and not (M_arm[y,x] or M_cape[y,x]))
def take(mask):
    o=blank(); o[mask]=BASE[mask]; return o
hood,arm,cape,collar,torso=map(take,[M_hood,M_arm,M_cape,M_collar,M_torso])
# torso behind the near arm (rebuilt so the arm can leave)
torso_full=torso.copy()
for y in range(29,37):
    for x in range(21,26):
        c='d' if x<24 else 'D'
        if y==29 and x in (22,23): c='M'      # shoulder seam under the pauldron
        put(torso_full,x,y,c)
for x in range(19,28): put(torso_full,x,37,'K')
# ---------- legs (procedural, side, facing left) ----------
def leg(img,hx,ax,lift,near):
    """hip column hx, ankle column ax, lift px. leg 2px wide; foot always points forward (left).
    a foot well behind the hip pushes off: heel up, toe on the ground."""
    body='M' if near else 'd'; hi='L' if near else 'M'
    lay=blank()
    fy=40-lift
    push = False   # heel-up push-off read as a backward toe; feet stay flat, toe forward
    ys=list(range(38,fy))
    for i,y in enumerate(ys):
        t=(i+1)/len(ys)            # last leg row sits right on the ankle
        x=round(hx+(ax-hx)*t)
        put(lay,x,y,hi); put(lay,x+1,y,body)
    if push:
        put(lay,ax-2,fy,hi); put(lay,ax-1,fy,body)          # toe on the ground
        put(lay,ax,fy-1,body); put(lay,ax+1,fy-1,body)     # heel lifted
    else:
        for x in range(ax-2,ax+2): put(lay,x,fy,body)
        put(lay,ax-2,fy,hi); put(lay,ax-1,fy,hi)
    lay=outline(lay)
    comp(img,lay)
def legs(img,near=(0,0),far=(0,0),stance=0,which='both'):
    """near/far = (foot dx, lift); hip at x=21 near / 23 far. which: 'far','near','both'"""
    if which in ('far','both'): leg(img,23,23+far[0]+stance,far[1],False)
    if which in ('near','both'): leg(img,21,21+near[0]-stance,near[1],True)
if __name__=='__main__':
    # parts map
    cols={'hood':(230,120,60),'arm':(240,220,80),'cape':(90,150,240),'collar':(200,90,220),'torso':(90,210,120),'leg':(240,90,110)}
    vis=blank()
    for n,m in [('hood',M_hood),('arm',M_arm),('cape',M_cape),('collar',M_collar),('torso',M_torso),('leg',M_leg)]:
        vis[m]=cols[n]+(255,)
    save(vis,'out/side_partmap.png',12,(40,44,52,255))
    t=blank(); comp(t,torso_full); comp(t,cape); legs(t); comp(t,collar); comp(t,hood); comp(t,arm)
    save(t,'out/side_rebuilt.png',12,(40,44,52,255))
    t2=blank(); comp(t2,torso_full); comp(t2,cape); legs(t2); comp(t2,collar); comp(t2,hood)
    save(t2,'out/side_noarm.png',12,(40,44,52,255))
