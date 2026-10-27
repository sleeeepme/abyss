from lib import *
from PIL import Image, ImageDraw, ImageFont
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def sheet(rows,path,S=6,crop=(0,0,48,48),bg=(40,44,52,255)):
    """rows: list of (label, frames)"""
    x0,y0,x1,y1=crop; cw,ch=(x1-x0)*S,(y1-y0)*S
    n=max(len(f) for _,f in rows)
    try: font=ImageFont.truetype(FONT,22)
    except: font=None
    W=n*(cw+6)+170; H=len(rows)*(ch+10)+10
    out=Image.new('RGB',(W,H),(24,26,30)); d=ImageDraw.Draw(out)
    for r,(lab,fr) in enumerate(rows):
        y=10+r*(ch+10)
        d.text((8,y+ch//2-12),lab,fill=(220,220,220),font=font)
        for i,f in enumerate(fr):
            im=Image.fromarray(f[y0:y1,x0:x1],'RGBA'); b=Image.new('RGBA',im.size,bg); b.alpha_composite(im)
            out.paste(b.convert('RGB').resize((cw,ch),Image.NEAREST),(170+i*(cw+6),y))
    out.save(path)
def gif(frames,durs,path,S=6,crop=(0,0,48,48),bg=(40,44,52,255)):
    x0,y0,x1,y1=crop; fs=[]
    for f in frames:
        im=Image.fromarray(f[y0:y1,x0:x1],'RGBA'); b=Image.new('RGBA',im.size,bg); b.alpha_composite(im)
        fs.append(b.convert('RGB').resize(((x1-x0)*S,(y1-y0)*S),Image.NEAREST))
    fs[0].save(path,save_all=True,append_images=fs[1:],duration=durs,loop=0)
def strip(frames,path):
    s=Image.new('RGBA',(48*len(frames),48),(0,0,0,0))
    for i,f in enumerate(frames): s.alpha_composite(Image.fromarray(f,'RGBA'),(i*48,0))
    s.save(path)
