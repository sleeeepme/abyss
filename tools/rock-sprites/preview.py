import json, numpy as np, sys
from PIL import Image
PAL={'.':(34,53,44),'1':(0x18,0x1c,0x23),'2':(0x3b,0x3e,0x43),'3':(0x5a,0x5a,0x5b),'4':(0x7b,0x7c,0x7c)}
def sheet(sprs, fname, cols=8, cell=36, scale=6):
    rows=(len(sprs)+cols-1)//cols
    img=Image.new('RGB',(cols*cell,rows*cell),(34,53,44)); p=img.load()
    for i,s in enumerate(sprs):
        ox=(i%cols)*cell+(cell-len(s[0]))//2; oy=(i//cols)*cell+(cell-len(s))//2
        for y,row in enumerate(s):
            for x,c in enumerate(row):
                if c!='.': p[ox+x,oy+y]=PAL[c]
    img.resize((img.width*scale,img.height*scale),Image.NEAREST).save(fname)
if __name__=='__main__':
    d=json.load(open(sys.argv[1]))
    allspr=[s for k in d for s in d[k]]
    sheet(allspr,sys.argv[2])
