# 参考画像（拡大・JPEG）から元のドット絵を取り出す：画素の間隔を FFT で求め、各画素の中心の中央値を取る
import sys, numpy as np
from PIL import Image
im=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float); g=im.mean(2); H,W,_=im.shape
def period(axis):
    d=np.abs(np.diff(g,axis=axis)).sum(1-axis); d=d-d.mean()
    f=np.abs(np.fft.rfft(d,n=len(d)*8)); fr=np.fft.rfftfreq(len(d)*8); m=(fr>1/14)&(fr<1/4)
    return 1/fr[np.argmax(f*m)]
p=(period(1)+period(0))/2
best=None
for ox in np.arange(0,p,0.5):
  for oy in np.arange(0,p,0.5):
    xs=np.clip(np.round(np.arange(ox+p/2,W,p)).astype(int),0,W-1); ys=np.clip(np.round(np.arange(oy+p/2,H,p)).astype(int),0,H-1)
    e=sum(np.abs(g[ys][:,xs]-g[np.clip(ys+dy,0,H-1)][:,np.clip(xs+dx,0,W-1)]).mean() for dx,dy in ((2,0),(-2,0),(0,2),(0,-2)))
    if best is None or e<best[0]: best=(e,ox,oy)
_,ox,oy=best
xs=np.clip(np.round(np.arange(ox+p/2,W,p)).astype(int),0,W-1); ys=np.clip(np.round(np.arange(oy+p/2,H,p)).astype(int),0,H-1)
out=np.array([[np.median(im[max(0,y-2):y+3,max(0,x-2):x+3].reshape(-1,3),axis=0) for x in xs] for y in ys])
Image.fromarray(out.astype(np.uint8)).save('ref_native.png'); print('period',p,'size',out.shape)
