import numpy as np
from PIL import Image, ImageDraw
PAL=np.array([[0x3e,0x5c,0x71],[0x18,0x1c,0x23],[0x3b,0x3e,0x43],[0x5a,0x5a,0x5b],[0x7b,0x7c,0x7c]],np.uint8)
def compose(outs, fname, bg='ref', scale=6, layout=None, size=(170,130)):
    W,H=size
    if bg=='ref':
        img=Image.new('RGB',(W,H),tuple(PAL[0])); shc=((0x31,0x49,0x58),(0x36,0x50,0x61))
    else:
        img=Image.new('RGB',(W,H),(34,53,44)); fp=img.load(); shc=((18,29,24),(24,38,31))
        for y in range(H):
            for x in range(W):
                if y%6==0 or (x+(y//6%2)*8)%16==0: fp[x,y]=(26,42,34)
    layout=layout or [(6,4),(128,2),(4,46),(122,64),(8,92),(70,18),(58,92)]
    p=img.load(); d=ImageDraw.Draw(img)
    for L,(ox,oy) in zip(outs,layout):
        H2,W2=L.shape
        ys,xs=np.nonzero(L>0)
        if len(xs)==0: continue
        by=ys.max(); x0,x1=xs.min(),xs.max()
        d.ellipse([ox+x0+2,oy+by-3,ox+x1+5,oy+by+5],fill=shc[0]); d.ellipse([ox+x0+6,oy+by+2,ox+x1+2,oy+by+7],fill=shc[1])
        for y in range(H2):
            for x in range(W2):
                if L[y,x]>0 and 0<=ox+x<W and 0<=oy+y<H: p[ox+x,oy+y]=tuple(PAL[L[y,x]])
    img.resize((W*scale,H*scale),Image.NEAREST).save(fname)
if __name__=='__main__':
    outs=list(np.load('outs.npy',allow_pickle=True))
    compose(outs,'analogy_ref.png','ref')
