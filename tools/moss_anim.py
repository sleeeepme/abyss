from PIL import Image
import sys
T=(0,0,0,0)
def load(path):
    global G,EYE,BODY_MID,OUT,L,M,D
    src=Image.open(path).convert('RGBA')
    G=[[src.getpixel((x,y)) for x in range(16)] for y in range(16)]
    EYE=G[6][6]; BODY_MID=G[6][7]; OUT=G[2][6]
    body=sorted({c for r in G for c in r if c[3] and c not in (EYE,OUT)},key=lambda c:c[0]*.3+c[1]*.59+c[2]*.11)
    L,M,D=body[-1],body[len(body)//2],body[0]
def rows_of(g): return [r[:] for r in g]
def squash(g,n):
    g=rows_of(g)
    for _ in range(n):
        del g[8]; g.insert(0,[T]*len(g[0]))           # 1行縮める（下端は固定）
        for r in g: r.insert(7,r[7])                    # 1列太らせる
    return g
def stretch(g,n):
    g=rows_of(g)
    for _ in range(n):
        g.insert(9,g[9][:]); del g[0]                    # 1行のばす（下端は固定）
    return g
def recolor(g,f): return [[f(c) for c in r] for r in g]
def blink(g): return recolor(g,lambda c: BODY_MID if c==EYE else c)
def white(g): return recolor(g,lambda c: c if c[3]==0 or c==OUT else (255,255,255,255))
def red(g): return recolor(g,lambda c: c if c[3]==0 else ((60,8,4,255) if c==OUT else ((c[0]+218*2)//3,(c[1]+56*2)//3,(c[2]+19*2)//3,255)))
CW,CH,OX,OY=26,24,5,6
def frame(g,dx=0,dy=0,fx=()):
    im=Image.new('RGBA',(CW,CH),T); w=len(g[0]); ox=OX-(w-16)//2
    for y,r in enumerate(g):
        for x,c in enumerate(r):
            if c[3]:
                X,Y=x+ox+dx,y+OY+dy
                if 0<=X<CW and 0<=Y<CH: im.putpixel((X,Y),c)
    for x,y,c in fx:
        if 0<=x<CW and 0<=y<CH: im.putpixel((x,y),c)
    return im
Y=(240,203,56,255); O=(255,137,49,255); H=(233,225,182,255)
FEET=OY+14   # 足の下の行
CX=OX+8
def dust(s):
    p={0:[(-6,0),(-7,-1),(6,0),(7,-1)],1:[(-8,-1),(-9,-2),(-7,-2),(8,-1),(9,-2),(7,-2)],2:[(-10,-3),(-9,-4),(10,-3),(9,-4)]}[s]
    return [(CX+a,FEET+b,L if i%2 else M) for i,(a,b) in enumerate(p)]
def spores(s):
    p={0:[(-1,-12,Y),(0,-13,Y),(1,-12,Y),(0,-11,O)],
       1:[(-5,-12,L),(5,-11,L),(-3,-15,M),(3,-15,L),(6,-14,M)],
       2:[(-7,-14,M),(7,-13,D),(-4,-18,D),(4,-18,M)]}[s]
    return [(CX+a,FEET+b,c) for a,b,c in p]
def build():
    idle=[(frame(G),220),(frame(squash(G,1)),200),(frame(G),160),(frame(stretch(G,1)),160),(frame(G),200),(frame(blink(G)),90),(frame(G),150)]
    atk=[(frame(G),80),(frame(squash(G,1)),90),(frame(squash(G,2)),260),
         (frame(stretch(G,2),0,-2),70),(frame(stretch(G,1),0,-5),90),(frame(G,0,-4),70),
         (frame(squash(G,2),fx=dust(0)),110),(frame(squash(G,1),fx=dust(1)),100),(frame(G,fx=dust(2)),100)]
    dmg=[(frame(white(G),fx=spores(0)),50),(frame(red(squash(G,1)),-1,0,fx=spores(1)),80),
         (frame(G,1,0,fx=spores(2)),80),(frame(squash(G,1)),90),(frame(G),140)]
    return idle,atk,dmg
def save(name,fr):
    frames=[f for f,_ in fr]; durs=[d for _,d in fr]
    sh=Image.new('RGBA',(CW*len(frames),CH),T)
    for i,f in enumerate(frames): sh.paste(f,(i*CW,0))
    sh.save(name+'_sheet.png'); S=8; bg=(34,30,40,255)
    big=[Image.alpha_composite(Image.new('RGBA',(CW,CH),bg),f).resize((CW*S,CH*S),Image.NEAREST).convert('RGB') for f in frames]
    big[0].save(name+'_x8.gif',save_all=True,append_images=big[1:],duration=durs,loop=0,disposal=2)
    Image.alpha_composite(Image.new('RGBA',sh.size,bg),sh).resize((sh.width*6,CH*6),Image.NEAREST).save(name+'_prev.png')

import json
def walkf(): return [(frame(squash(G,1)),110),(frame(G),100),(frame(stretch(G,1)),110),(frame(G),100)]
LAYERS=['stone','sump','root','ruin','furnace','pale']
ALL={}
for z in LAYERS:
    load(f'src-{z}.png'); idle,atk,dmg=build(); walk=walkf()
    tag='' if z=='stone' else '-'+z
    save('moss'+tag+'_idle',idle); save('moss'+tag+'_attack',atk); save('moss'+tag+'_damage',dmg); save('moss'+tag+'_walk',walk)
    pal=[]; out={}
    for name,fr in [('idle',idle),('walk',walk),('atk',atk),('dmg',dmg)]:
        fs=[]
        for im,d in fr:
            st=''
            for y in range(CH):
                for x in range(CW):
                    c=im.getpixel((x,y))
                    if c[3]==0: st+='.'; continue
                    c=c[:3]
                    if c not in pal: pal.append(c)
                    i=pal.index(c); st+=chr(65+i) if i<26 else chr(97+i-26)
            fs.append(st)
        out[name]={'d':[d for _,d in fr],'f':fs}
    em=[EYE[:3],Y[:3],O[:3],(255,255,255)]
    out['pal']=['#%02x%02x%02x'%c for c in pal]; out['emis']=[i for i,c in enumerate(pal) if c in em]
    out['w']=CW; out['h']=CH; out['feet']=OY+14; out['cx']=OX+8; out['cy']=OY+8
    out['strike']=3; out['lunge']=[4,5]
    ALL[z]=out
json.dump(ALL,open('moss_frames.json','w'),separators=(',',':'))
print('ok',len(json.dumps(ALL)))
