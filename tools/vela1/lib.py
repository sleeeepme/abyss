import numpy as np
from PIL import Image
import os
RD=os.path.join(os.path.dirname(os.path.abspath(__file__)),'input')+'/'
def hx(h): h=h.lstrip('#'); return (int(h[0:2],16),int(h[2:4],16),int(h[4:6],16),255)
P={ # palette (all colours already used by the sprites)
 'K':'#000000','k':'#010805','D':'#0b1d1b','d':'#16312f','M':'#1a413e','B':'#204945','u':'#2b534f',
 'm':'#356360','L':'#4e766f','t':'#74baaa','Y':'#7faba4','T':'#90bfba',
 'X':'#272a34','p':'#393d46','O':'#586155','l':'#727468','G':'#757c6e','g':'#7d8a7e','U':'#8a8170',
 'y':'#b5a6a2','b':'#c0b0a8','o':'#4a443b','W':'#976f34','v':'#ba9252','V':'#f7ad40','A':'#f6ad40',
 'w':'#fff8e8','Z':'#e8fff8'}
C={k:hx(v) for k,v in P.items()}
def load(name):
    return np.array(Image.open(RD+name).convert('RGBA'))
def blank(w=48,h=48): return np.zeros((h,w,4),np.uint8)
def put(img,x,y,c):
    h,w=img.shape[:2]
    if 0<=x<w and 0<=y<h: img[y,x]=C[c] if isinstance(c,str) else c
def comp(dst,src,dx=0,dy=0):
    """alpha-over (binary alpha) src onto dst with integer offset"""
    h,w=dst.shape[:2]
    ys,xs=np.nonzero(src[:,:,3])
    for y,x in zip(ys,xs):
        X,Y=x+dx,y+dy
        if 0<=X<w and 0<=Y<h: dst[Y,X]=src[y,x]
    return dst
def outline(img,col='K',diag=False):
    """add 1px outline around opaque pixels"""
    a=img[:,:,3]>0; h,w=a.shape; out=img.copy()
    nb=[(1,0),(-1,0),(0,1),(0,-1)]+([(1,1),(1,-1),(-1,1),(-1,-1)] if diag else [])
    for y in range(h):
        for x in range(w):
            if a[y,x]: continue
            for dx,dy in nb:
                X,Y=x+dx,y+dy
                if 0<=X<w and 0<=Y<h and a[Y,X]: out[y,x]=C[col]; break
    return out
def line_pts(x0,y0,x1,y1):
    pts=[]; dx=abs(x1-x0); dy=-abs(y1-y0); sx=1 if x0<x1 else -1; sy=1 if y0<y1 else -1; e=dx+dy
    while True:
        pts.append((x0,y0))
        if x0==x1 and y0==y1: break
        e2=2*e
        if e2>=dy: e+=dy; x0+=sx
        if e2<=dx: e+=dx; y0+=sy
    return pts
def save(img,path,scale=1,bg=None):
    im=Image.fromarray(img,'RGBA')
    if bg is not None:
        b=Image.new('RGBA',im.size,bg); b.alpha_composite(im); im=b
    if scale>1: im=im.resize((im.width*scale,im.height*scale),Image.NEAREST)
    im.save(path)
def flip(img): return img[:,::-1].copy()
