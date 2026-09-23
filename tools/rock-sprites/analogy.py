# 別のアプローチ：参考画像そのものから「描き方」を学ぶ（Image Analogies / 例示ベースの合成）
#  1) 参考の JPEG から元のドット絵（121×139）を復元し、4色（明・中・暗・黒）に分ける
#  2) 参考の「大まかな明暗」（ぼかした明るさ）と「実際のドット」の組を覚える
#  3) こちらで決めた岩の形と大まかな明暗から、同じ近傍を持つ参考のドットを1つずつ選んで置く
import numpy as np, math
from PIL import Image, ImageDraw
from scipy import ndimage
PAL=np.array([[0x3e,0x5c,0x71],[0x18,0x1c,0x23],[0x3b,0x3e,0x43],[0x5a,0x5a,0x5b],[0x7b,0x7c,0x7c]],float)  # 0背景 1黒 2暗 3中 4明
LUM={0:0.0,1:0.05,2:0.35,3:0.62,4:1.0}
src=np.asarray(Image.open('ref_native.png').convert('RGB')).astype(float)
d=((src[:,:,None,:]-PAL[None,None])**2).sum(3); lab=d.argmin(2)
# 背景の青（影を含む）は 0 に寄せる：灰色以外は背景
gray=np.abs(src[:,:,0]-src[:,:,2])<14
lab[~gray & (lab!=1)]=0
lab[(lab==1)&~gray&(src.sum(2)>150)]=0
S_mask=(lab>0).astype(float)
S_mask=ndimage.binary_fill_holes(S_mask).astype(float)
S_lum=np.vectorize(LUM.get)(lab).astype(float)
SIG=1.6
def guide(lum,mask):
    num=ndimage.gaussian_filter(lum*mask,SIG); den=ndimage.gaussian_filter(mask,SIG)+1e-6
    return np.where(mask>0,num/den,0)
S_g=guide(S_lum,S_mask)
Image.fromarray((PAL[lab]).astype(np.uint8)).resize((121*6,139*6),Image.NEAREST).save('ref_labels.png')
R=2
def feats_guide(g,mask,y,x):
    H,W=g.shape; out=[]
    for dy in range(-R,R+1):
        for dx in range(-R,R+1):
            yy,xx=y+dy,x+dx
            if 0<=yy<H and 0<=xx<W: out+= [g[yy,xx], mask[yy,xx]]
            else: out+=[0,0]
    return out
CAUSAL=[(-2,-2),(-2,-1),(-2,0),(-2,1),(-2,2),(-1,-2),(-1,-1),(-1,0),(-1,1),(-1,2),(0,-2),(0,-1)]
def feats_causal(L,y,x):
    H,W=L.shape; out=[]
    for dy,dx in CAUSAL:
        yy,xx=y+dy,x+dx
        v=L[yy,xx] if (0<=yy<H and 0<=xx<W) else 0
        out.append(LUM[int(v)])
    return out
# 参考側の候補（岩と、その周り1ドット）
cand=np.argwhere(ndimage.binary_dilation(S_mask>0,iterations=1))
SF_g=np.array([feats_guide(S_g,S_mask,y,x) for y,x in cand])
SF_c=np.array([feats_causal(lab,y,x) for y,x in cand])
S_lab=np.array([lab[y,x] for y,x in cand])
def synth(T_g,T_mask,w_guide=1.0,w_mask=2.0,w_causal=1.3,kappa=0.35,seed=0):
    H,W=T_g.shape; L=np.zeros((H,W),int); src_of=-np.ones((H,W),int)
    wg=np.array([w_guide,w_mask]*((2*R+1)**2))
    pos={tuple(p):i for i,p in enumerate(cand)}
    todo=np.argwhere(ndimage.binary_dilation(T_mask>0,iterations=1))
    for y,x in todo:
        fg=np.array(feats_guide(T_g,T_mask,y,x)); fc=np.array(feats_causal(L,y,x))
        dist=(((SF_g-fg)*wg)**2).sum(1)+w_causal*((SF_c-fc)**2).sum(1)
        best=int(dist.argmin())
        # 近くで選んだ参考の場所の「続き」を優先（形のまとまりを保つ）
        for dy,dx in ((-1,0),(0,-1),(-1,-1),(-1,1)):
            yy,xx=y+dy,x+dx
            if 0<=yy<H and 0<=xx<W and src_of[yy,xx]>=0:
                sy,sx=cand[src_of[yy,xx]]; key=(sy-dy,sx-dx)
                if key in pos:
                    j=pos[key]
                    if dist[j]<=dist[best]*(1+kappa)+1e-3: best=j
        L[y,x]=S_lab[best]; src_of[y,x]=best
    L[T_mask==0]=np.where(L[T_mask==0]==1,1,0)   # 外側は黒（輪郭）以外置かない
    return L
