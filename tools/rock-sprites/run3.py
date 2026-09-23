# 形も参考から作る：参考の岩（の大まかな明暗と形）を伸ばす・縮める・傾ける・先を細らせて新しい岩の「下書き」にし、
# その下書きから参考のドットの置き方で描き直す（元の岩をそのまま写さない）
import numpy as np
from scipy import ndimage
exec(open('analogy.py').read())
from compose import compose
lbl,n=ndimage.label(S_mask>0)
rocks=[]
for k in range(1,n+1):
    ys,xs=np.nonzero(lbl==k)
    if len(ys)<100: continue
    y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max()
    rocks.append(((lbl==k)[y0:y1+1,x0:x1+1].astype(float), S_g[y0:y1+1,x0:x1+1], (x0,y0)))
print('rocks',[(r[2],r[0].shape) for r in rocks])
def warp(mask,g,sx=1.0,sy=1.0,shear=0.0,taper=0.0,pad=3):
    h,w=mask.shape
    H=int(h*sy)+2*pad; W=int(w*sx+abs(shear)*h*sy)+2*pad
    yy,xx=np.mgrid[0:H,0:W].astype(float)
    v=(yy-pad)/sy
    u=(xx-pad-shear*(h*sy-(yy-pad)))/sx
    if taper:                                  # 右ほど縦に細る（弾丸・棘の先）
        f=np.clip(u/w,0,1); c=h/2; v=c+(v-c)/np.maximum(0.15,1-taper*f)
    M=ndimage.map_coordinates(mask,[v,u],order=0,cval=0)
    G=ndimage.map_coordinates(g,[v,u],order=1,cval=0)
    M=ndimage.binary_opening(M>0.5,iterations=1).astype(float)
    return G*M,M
def cleanup(L,mask):
    L=L.copy(); H,W=L.shape
    for _ in range(2):
        for y in range(1,H-1):
            for x in range(1,W-1):
                if mask[y,x]==0 or L[y,x]==0: continue
                nb=[L[y-1,x],L[y+1,x],L[y,x-1],L[y,x+1]]
                if L[y,x] not in nb:
                    vals=[v for v in nb if v>0]
                    if vals: L[y,x]=max(set(vals),key=vals.count)
    return L
# 参考の岩：並び順で確認してから決める
V=[(1,dict(sx=1.35,sy=0.9)),(0,dict(sx=1.2,sy=0.72)),(3,dict(sx=0.8,sy=0.62)),(2,dict(sx=1.1,sy=0.85,shear=0.25)),
   (4,dict(sx=0.85,sy=1.25)),(0,dict(sx=0.72,sy=1.25)),(3,dict(sx=0.95,sy=0.42,taper=0.85))]
import sys
kappa=float(sys.argv[1]) if len(sys.argv)>1 else 1.0
outs=[]
for k,kw in V:
    m,g,_=rocks[k]; G,M=warp(m,g,**kw)
    outs.append(cleanup(synth(G,M,kappa=kappa,w_causal=1.6),M))
LAY=[(4,8),(66,6),(4,62),(64,66),(130,72),(132,2),(62,120)]
compose(outs,f'warp_{kappa}.png','ref',layout=LAY,size=(180,150))
compose(outs,f'warp_{kappa}_floor.png','floor',layout=LAY,size=(180,150))
np.save('warp_outs.npy',np.array(outs,dtype=object),allow_pickle=True)
