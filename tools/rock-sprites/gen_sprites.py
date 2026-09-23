# ゲーム用の岩のドット（静止のスプライト）を、参考の描き方（Image Analogies）で作る
import numpy as np, math, json
from scipy import ndimage
exec(open('analogy.py').read())
exec(open('run3.py').read().split("V=[")[0].split("exec(open('analogy.py').read())")[1])   # rocks, warp, cleanup
S_vals=np.sort(S_g[S_mask>0])
def match_hist(g,mask):
    v=g[mask>0]; r=np.argsort(np.argsort(v))/max(1,len(v)-1)
    out=g.copy(); out[mask>0]=np.interp(r,np.linspace(0,1,len(S_vals)),S_vals); return out
def synth_guide(mask):
    h=ndimage.distance_transform_edt(mask)
    h=ndimage.gaussian_filter(h,1.2)
    gy,gx=np.gradient(h)
    n=np.hypot(gx,gy)+1e-6
    nx,ny=-gx/n,-gy/n                      # 外向き
    flat=np.clip(h/ (h.max()+1e-6)*2.2,0,1) # 中ほどは平ら（上の面）
    lit=(nx*-0.6+ny*-0.8)
    lum=0.62+0.45*lit*(1-flat*0.6)+0.1*flat
    lum=np.clip(lum,0,1)*mask
    return match_hist(guide(lum,mask),mask)
def bullet_mask(L,wid,ang,pad=3):
    S=int(L)+2*pad+2
    yy,xx=np.mgrid[0:S,0:S].astype(float); cx=cy=(S-1)/2
    ux,uy=math.cos(ang),math.sin(ang)
    u=(xx-cx)*ux+(yy-cy)*uy; v=-(xx-cx)*uy+(yy-cy)*ux
    tail=L*0.38; tip=L-tail; u=u+ (L/2-tail)   # 中心をずらして長さの中央に
    w=np.where(u<0, wid*np.sqrt(np.clip(1-(u/tail)**2,0,1)), wid*np.clip(1-u/tip,0,1)**0.85)
    m=((u>=-tail)&(u<=tip)&(np.abs(v)<=w)).astype(float)
    return m
def enc(L):
    return [''.join('.' if v==0 else str(int(v)) for v in row) for row in L]
def trim(L):
    ys,xs=np.nonzero(L>0)
    return L[ys.min():ys.max()+1, xs.min():xs.max()+1]
out={}
# 弾丸：大（貫き・落石・溜め）と小（散弾・後を追う小岩）を16方向
for name,Ln,wid in (('big',26,7.5),('small',12,3.2)):
    arr=[]
    for k in range(16):
        a=k/16*math.tau
        m=bullet_mask(Ln,wid,a)
        g=synth_guide(m)
        Lb=cleanup(synth(g,m,kappa=1.0,w_causal=1.6),m)
        arr.append(enc(Lb))
    out['bullet_'+name]=arr
    print(name,flush=True)
json.dump(out,open('spr_bullets.json','w'))
