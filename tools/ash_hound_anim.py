from PIL import Image
src=Image.open('src.png').convert('RGBA'); sp=src.load()
W,H=19,13
C={'K':(0,0,0,255),'b':(147,103,82,255),'d':(108,74,64,255),'s':(58,45,45,255),'h':(191,150,118,255),
   'r':(218,56,19,255),'y':(240,203,56,255),'o':(255,137,49,255)}
def part(x,y):
    if y>=11: return 'legF' if x>=7 else 'legB'
    if x<=2 and y<=8: return 'tail'
    if x>=11 and y>=7: return 'jaw'
    if x>=10 or (x==9 and y<=2): return 'head'
    return 'body'
P={}
for y in range(H):
    for x in range(W):
        c=sp[x,y]
        if c[3]: P.setdefault(part(x,y),[]).append((x,y,c))
CW,CH,OX,OY=32,18,6,4
def frame(o, glow=0, blink=False, jaw_open=0, fx=()):
    # o: dict part->(dx,dy); 'all' global
    im=Image.new('RGBA',(CW,CH),(0,0,0,0)); px=im.load()
    gx,gy=o.get('all',(0,0))
    def put(x,y,c):
        X,Y=x+OX+gx,y+OY+gy
        if 0<=X<CW and 0<=Y<CH: px[X,Y]=c
    def col(c):
        if glow and c==C['r']: return C['o']
        if glow and c==C['o']: return C['y']
        if blink and c==C['y']: return C['d']
        return c
    order=['tail','legB','legF','body','head','jaw']
    for name in order:
        dx,dy=o.get(name,(0,0))
        if name=='jaw': dx,dy=o.get('head',(0,0)); dy+=jaw_open
        if name in('head','jaw'):
            bdx,bdy=o.get('body',(0,0)); dx+=bdx; dy+=bdy
        for x,y,c in P[name]:
            # eyes blink only on head
            put(x+dx,y+dy,col(c))
    if jaw_open:
        hdx,hdy=o.get('head',(0,0)); bdx,bdy=o.get('body',(0,0))
        for k in range(jaw_open):
            for x in range(11,18):
                c=C['r'] if (x<=12 or k==jaw_open-1 and x%2==0) else C['K']
                if glow and c==C['r']: c=C['o']
                put(x+hdx+bdx,7+k+hdy+bdy,c)
            put(18+hdx+bdx,7+k+hdy+bdy,C['K'])
    for (x,y,c) in fx:   # absolute canvas coords
        if 0<=x<CW and 0<=y<CH: px[x,y]=C[c]
    return im
def dust(x,y,s):
    pts={0:[(0,0),(1,0),(0,-1)],1:[(-1,0),(0,-1),(1,-1),(-2,-1),(0,-2)],2:[(-2,-2),(-3,-1),(1,-3),(-1,-3)]}[s]
    return [(x+a,y+b,'h' if i%2==0 else 'd') for i,(a,b) in enumerate(pts)]
# --- idle ---
idle=[
 (frame({}),180),
 (frame({'tail':(0,-1)}),140),
 (frame({'body':(0,1),'tail':(0,0)}),180),
 (frame({'body':(0,1),'tail':(0,-1)}),180),
 (frame({'tail':(0,-1)}),140),
 (frame({},blink=True),90),
 (frame({}),160),
]
# --- attack ---
mx=OX+19  # muzzle x
atk=[
 (frame({}),100),
 (frame({'all':(-1,0),'body':(0,1),'head':(0,1),'tail':(0,-1)}),110),
 (frame({'all':(-2,0),'body':(0,1),'head':(0,1),'tail':(0,-1),'legB':(-1,0)}),220),
 (frame({'all':(2,-1),'legF':(1,0),'legB':(-1,0),'head':(0,-1)},jaw_open=1,fx=dust(OX+1,OY+12,0)),60),
 (frame({'all':(4,-1),'legF':(1,0),'legB':(-2,0),'head':(0,0)},jaw_open=2,fx=dust(OX+0,OY+12,1)),70),
 (frame({'all':(4,0),'head':(0,1)},fx=dust(OX-1,OY+12,2)+[(mx+4,OY+5,'y'),(mx+5,OY+4,'y'),(mx+5,OY+8,'y'),(mx+6,OY+3,'o'),(mx+6,OY+9,'o'),(mx+5,OY+6,'o')]),110),
 (frame({'all':(3,0)}),110),
 (frame({'all':(1,0)}),110),
]
def save(name,fr):
    frames=[f for f,_ in fr]; durs=[d for _,d in fr]
    # transparent spritesheet
    sh=Image.new('RGBA',(CW*len(frames),CH),(0,0,0,0))
    for i,f in enumerate(frames): sh.paste(f,(i*CW,0))
    sh.save(name+'_sheet.png')
    S=8; bg=(34,30,40,255)
    big=[Image.alpha_composite(Image.new('RGBA',(CW,CH),bg),f).resize((CW*S,CH*S),Image.NEAREST).convert('RGB') for f in frames]
    big[0].save(name+'_x8.gif',save_all=True,append_images=big[1:],duration=durs,loop=0,disposal=2)
    Image.alpha_composite(Image.new('RGBA',sh.size,bg),sh).resize((sh.width*8,CH*8),Image.NEAREST).save(name+'_sheet_x8_preview.png')

def tint(im,mode):
    im=im.copy(); p=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=p[x,y]
            if not a: continue
            if mode=='white': p[x,y]=(255,255,255,255) if (r,g,b)!=(0,0,0) else (0,0,0,255)
            else: p[x,y]=((r+218*2)//3,(g+56*2)//3,(b+19*2)//3,255) if (r,g,b)!=(0,0,0) else (60,8,4,255)
    return im
def addfx(im,pts):
    im=im.copy(); p=im.load()
    for x,y,c in pts:
        if 0<=x<CW and 0<=y<CH: p[x,y]=C[c] if isinstance(c,str) else c
    return im
hx,hy=OX+19,OY+5  # hit point (chest/face)
def burst(k):
    if k==0: return [(hx+1,hy,'y'),(hx+2,hy-1,'y'),(hx+2,hy+1,'y'),(hx+3,hy,'o')]
    if k==1: return [(hx+3,hy-2,'h'),(hx+4,hy+2,'h'),(hx-3,hy-3,'h'),(hx+1,hy-4,'d'),(hx-1,hy-4,'h')]
    if k==2: return [(hx+5,hy-3,'d'),(hx+6,hy+2,'d'),(hx-5,hy-5,'d'),(hx+1,hy-6,'s')]
    return []
dmg=[
 (addfx(tint(frame({'all':(-1,0)}),'white'),burst(0)),50),
 (addfx(tint(frame({'all':(-2,0),'tail':(0,-1)}),'red'),burst(1)),70),
 (addfx(frame({'all':(-2,0)}),burst(2)),90),
 (frame({'all':(-1,0),'body':(0,1)}),90),
 (frame({}),140),
]
save('ashhound_idle',idle); save('ashhound_attack',atk); save('ashhound_damage',dmg)
print('ok')

walk=[
 (frame({'legF':(1,0),'legB':(-1,0)}),110),
 (frame({'tail':(0,-1)}),110),
 (frame({'legF':(-1,0),'legB':(1,0)}),110),
 (frame({}),110),
]
save('ashhound_walk',walk)
import json
pal=[]; out={}
for name,fr in [('idle',idle),('walk',walk),('atk',atk),('dmg',dmg)]:
    fs=[]
    for im,d in fr:
        s=''
        for y in range(CH):
            for x in range(CW):
                c=im.getpixel((x,y))
                if c[3]==0: s+='.'; continue
                c=c[:3]
                if c not in pal: pal.append(c)
                s+=chr(65+pal.index(c)) if pal.index(c)<26 else chr(97+pal.index(c)-26)
        fs.append(s)
    out[name]={'d':[d for _,d in fr],'f':fs}
EMIS=[(218,56,19),(240,203,56),(255,137,49),(255,255,255)]
out['pal']=['#%02x%02x%02x'%c for c in pal]
out['emis']=[i for i,c in enumerate(pal) if c in EMIS]
out['w']=CW; out['h']=CH; out['feet']=OY+13; out['cx']=OX+9.5; out['cy']=OY+6.5
json.dump(out,open('hound_frames.json','w'),separators=(',',':'))
print(len(pal),out['emis'],len(json.dumps(out)))
