#!/usr/bin/env python3
"""ABYSS weapon-art V17, authored on the same logical pixel grid as characters."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, "/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite  # noqa: E402

HERE=Path(__file__).resolve().parent
OUT=HERE/"generated"
RUNTIME=HERE.parents[1]/"proto"/"assets"/"effects"/"weapon-art-v17"
BG="#22352c"
SCALE=3  # one logical effect pixel equals one displayed character pixel

EARTH=["#17231d","#343d35","#51483a","#786146","#ae8955","#e0bf73"]
FIRE=["#651d29","#a52a2e","#dc412b","#f36b29","#ffad38","#fff09a"]
SLASH=["#425a6a","#7397aa","#b8d8df","#f7fff2","#d9bd4f","#fff19a"]


def sprite(w,h,palette,durations):
    s=Sprite(w,h,palette=palette);s.frames[0].duration=durations[0]
    for d in durations[1:]:s.add_frame(copy=False,duration=d)
    return s


def poly(s,pts,color):
    if len(pts)>=3:s.polygon(pts,color)


def rock(s,x,base,w,h,lean,kind):
    """A coarse-grid crag with a unique crown, shadow plane and lit plane."""
    l=x-w//2;r=x+(w+1)//2;t=base-h;tip=x+lean
    crowns=[(-2,0,2),( -3,1,2),(-2,0,3)]
    cl,notch,cr=crowns[kind%3]
    outer=[(l+1,base),(l,base-1),(l+1,t+max(2,h//2)),
           (tip+cl,t+1+notch),(tip,t),(tip+cr,t+1),(r,t+max(2,h//2)),(r+1,base-1),(r-1,base)]
    poly(s,outer,EARTH[0])
    shadow=[(l+1,base-1),(l+1,t+max(2,h//2)),(tip+cl+1,t+2+notch),(tip,t+1),(x,base-2)]
    poly(s,shadow,EARTH[2])
    face=[(tip,t+1),(tip+max(1,cr-1),t+2),(r-1,t+max(2,h//2)),(r-1,base-2),(x,base-2)]
    poly(s,face,EARTH[3])
    if h>=5:
        s.line(tip,t,tip+max(1,cr-1),t+1,EARTH[4])
    if h>=9:s.px(tip,t,EARTH[5])
    if h>=7:
        split=x-1 if kind%2 else x+1
        s.line(split,t+3,split-1,base-2,EARTH[1])


def earth_frame(s,f):
    s.use(frame=f);base=17
    # These are separate key poses. The peak and collapse do not scale the same rocks.
    poses={
      1:[],
      2:[(5,4,2,0,0),(11,5,3,0,1)],
      3:[(5,4,3,0,0),(11,5,4,0,1),(18,6,5,-1,2)],
      4:[(5,4,3,0,0),(11,5,4,0,1),(18,6,6,-1,2),(27,7,8,1,0),(37,8,10,-1,1)],
      5:[(5,4,3,0,1),(11,5,4,0,2),(18,6,6,-1,0),(27,7,8,1,1),(37,8,10,-1,2),(48,9,12,1,0),(59,10,15,2,1)],
      6:[(5,4,3,0,2),(11,5,4,0,0),(18,6,6,-1,1),(27,7,8,1,2),(37,8,10,-1,0),(48,9,12,1,1),(59,10,14,2,2)],
      7:[(6,7,2,0,1),(16,8,3,-1,2),(27,9,4,1,0),(39,10,5,-1,1),(52,11,6,1,2),(60,7,4,1,0)],
      8:[]}
    base_shapes={
      1:[(1,17),(4,16),(8,17)],2:[(1,17),(6,15),(13,16),(18,17)],
      3:[(1,17),(7,15),(15,16),(21,14),(27,17)],
      4:[(1,17),(8,15),(17,16),(27,13),(38,15),(48,17)],
      5:[(1,17),(10,14),(20,16),(31,12),(43,14),(53,10),(61,15)],
      6:[(1,17),(11,14),(22,16),(33,12),(45,14),(55,11),(61,15)],
      7:[(2,17),(12,15),(25,16),(38,14),(51,15),(61,16)],
      8:[(3,17),(14,16),(27,17),(41,15),(54,17),(61,16)]}
    b=base_shapes[f]
    poly(s,b+[(b[-1][0],19),(b[0][0],19)],EARTH[0])
    if f>1:
        inner=[(x,min(18,y+1)) for x,y in b]
        poly(s,inner+[(inner[-1][0],18),(inner[0][0],18)],EARTH[2])
    for p in poses[f]:rock(s,p[0],base,*p[1:])
    chips={3:[(22,11)],4:[(41,7),(50,13)],5:[(45,3),(57,0),(61,6)],
           6:[(48,4),(55,1),(61,7)],7:[(39,9),(51,8),(59,11)],8:[(17,14),(34,13),(51,14)]}
    for i,(x,y) in enumerate(chips.get(f,[])):
        s.px(x,y,EARTH[5 if i==0 else 4])
        if f in (5,6) and i==0:s.px(x+1,y,EARTH[4])


def build_earth():
    s=sprite(64,20,EARTH,[90,70,70,80,110,90,100,150])
    for f in range(1,9):earth_frame(s,f)
    return s


FIRE_OUTER={
  1:[(12,24),(13,20),(15,21),(17,17),(19,21),(22,19),(24,22),(27,24)],
  2:[(6,24),(7,20),(10,21),(12,14),(15,19),(18,10),(20,16),(23,13),(26,20),(30,15),(33,20),(36,18),(38,24)],
  3:[(3,24),(4,18),(7,20),(10,11),(13,17),(16,7),(19,14),(21,4),(24,11),(27,8),(29,17),(32,10),(35,17),(38,13),(41,19),(42,24)],
  4:[(2,24),(3,17),(6,19),(9,9),(12,16),(15,5),(18,12),(21,1),(24,8),(27,13),(30,6),(33,15),(36,9),(39,18),(42,13),(43,24)],
  5:[(1,24),(2,17),(5,20),(8,11),(11,16),(14,6),(17,13),(20,8),(23,15),(26,2),(29,10),(32,6),(35,15),(38,10),(41,18),(43,15),(44,24)],
  6:[(2,24),(3,16),(6,19),(9,8),(12,15),(15,4),(18,12),(21,7),(24,16),(27,5),(30,12),(33,8),(36,16),(39,11),(42,18),(43,24)],
  7:[(4,24),(5,18),(8,20),(11,12),(14,17),(17,7),(20,14),(23,10),(26,18),(30,9),(33,16),(36,12),(39,19),(41,24)],
  8:[(9,24),(10,19),(13,21),(16,14),(19,19),(22,10),(25,17),(28,13),(31,20),(35,16),(38,22),(39,24)]}


def flame_core(s,x,base,w,h,lean,kind):
    l=x-w//2;r=x+(w+1)//2;t=base-h;tip=x+lean
    # Three different internal flows keep the range fire from reading as
    # one repeated triangle stamp. Each still shares the same outer flame.
    if kind % 3 == 0:  # tall, hooked tongue
        hot=[(l,base),(l+1,base-h//3),(tip-1,t+3),(tip,t),(tip+1,t+3),(x+1,base-h//2),(r,base)]
        core=[(l+2,base),(x-1,base-h//3),(tip,t+4),(x+1,base-h//4),(r-1,base)]
    elif kind % 3 == 1:  # broad tongue with an off-centre channel
        hot=[(l,base),(l+1,base-h//3),(x-2,t+4),(tip,t),(tip+2,t+4),(r-1,base-h//3),(r,base)]
        core=[(l+2,base),(x-2,base-h//3),(x-1,t+5),(x+1,t+3),(x+2,base-h//3),(r-1,base)]
    else:  # low fork: two lobes share one base
        hot=[(l,base),(l+1,base-h//3),(x-2,t+3),(x-1,t+1),(x,t+5),(tip+2,t),(r-1,base-h//3),(r,base)]
        core=[(l+2,base),(x-2,base-h//4),(x-1,t+6),(x+1,base-h//3),(tip+1,t+4),(r-1,base)]
    poly(s,hot,FIRE[2])
    poly(s,core,FIRE[3])
    if h>=7:
        shift=(-1,0,1)[kind%3]
        poly(s,[(x-2+shift,base),(x-1+shift,base-h//3),(x+shift,base-h//2),(x+1+shift,base)],FIRE[4])
    if h>=11:s.px(x+(-1 if kind%3==1 else 1),base-2,FIRE[5])


def fire_frame(s,f):
    s.use(frame=f);base=24
    outer=FIRE_OUTER[f]
    poly(s,outer,FIRE[0])
    inner=[(x,min(base,y+2 if y<18 else y+1)) for x,y in outer]
    poly(s,inner,FIRE[1])
    beds={1:(12,27),2:(6,38),3:(3,42),4:(2,43),5:(1,44),6:(2,43),7:(4,41),8:(9,39)}
    x0,x1=beds[f]
    poly(s,[(x0,24),(x0+3,22),(x0+8,23),(x0+13,21),(x1-3,22),(x1,24),(x1-2,27),(x0+2,27)],FIRE[0])
    poly(s,[(x0+2,23),(x0+8,22),(x0+13,23),(x1-3,23),(x1-5,25),(x0+3,25)],FIRE[2])
    tongues={
      1:[(18,5,5,0,0)],
      2:[(12,6,9,-1,0),(20,7,13,1,1),(31,6,8,-1,2)],
      3:[(9,7,11,-1,2),(17,8,16,1,0),(26,7,13,-1,1),(35,6,10,1,2)],
      4:[(8,7,13,-1,1),(16,9,18,1,0),(25,8,15,-1,2),(34,7,13,1,1),(40,5,8,0,0)],
      5:[(7,7,11,1,2),(15,8,16,-1,1),(24,9,20,1,0),(33,8,14,-1,2),(40,6,10,0,1)],
      6:[(8,7,13,-1,0),(16,9,18,1,2),(25,8,16,-1,1),(34,7,13,1,0),(40,5,9,0,2)],
      7:[(11,6,10,1,2),(19,8,14,-1,0),(28,7,12,1,1),(36,6,9,-1,2)],
      8:[(17,6,8,-1,1),(24,7,11,1,2),(32,6,7,-1,0)]}
    for args in tongues[f]:flame_core(s,args[0],base,*args[1:])
    embers={2:[(21,8)],3:[(17,2),(30,6)],4:[(14,1),(28,3),(39,8)],5:[(24,0),(34,4),(10,7)],
            6:[(17,1),(29,4),(40,8)],7:[(21,5),(34,7)],8:[(25,8)]}
    for i,(x,y) in enumerate(embers.get(f,[])):s.px(x,y,FIRE[5 if i==0 else 4])


def build_flame():
    s=sprite(45,28,FIRE,[100,70,70,90,110,90,100,150])
    for f in range(1,9):fire_frame(s,f)
    return s


def upper_frame(s,f):
    s.use(frame=f)
    if f==1:
        s.line(5,39,11,37,SLASH[4]);s.px(4,40,SLASH[5])
    elif f==2:
        poly(s,[(5,40),(7,34),(12,29),(15,23),(17,24),(14,30),(9,37)],SLASH[0])
        poly(s,[(7,39),(8,35),(13,29),(16,24),(16,26),(13,31),(9,38)],SLASH[2]);s.line(8,38,16,25,SLASH[3])
    elif f==3:
        poly(s,[(4,41),(6,34),(11,28),(15,21),(20,14),(24,9),(27,7),(26,11),(22,16),(19,23),(14,30),(9,38)],SLASH[0])
        poly(s,[(6,39),(8,34),(13,28),(17,21),(22,14),(25,9),(26,9),(24,14),(20,20),(18,26),(13,32),(9,39)],SLASH[1])
        poly(s,[(8,38),(10,34),(15,27),(19,20),(23,14),(25,10),(23,15),(20,20),(17,27),(12,34)],SLASH[3])
        s.px(16,34,SLASH[5])
    elif f==4:
        # Peak pose is a widening crescent: the lower edge leaves the sword,
        # bows outward through the impact zone, then narrows at the tip.
        poly(s,[(3,41),(5,34),(10,30),(15,26),(19,20),(24,14),(29,8),(35,2),
                (33,8),(30,13),(27,18),(23,24),(18,29),(12,34),(8,40)],SLASH[0])
        poly(s,[(5,40),(7,35),(12,30),(17,26),(21,20),(26,14),(31,8),(34,3),
                (31,10),(28,15),(24,21),(20,26),(15,31),(10,38)],SLASH[1])
        poly(s,[(8,38),(11,34),(16,29),(21,24),(25,18),(29,13),(32,8),
                (29,15),(26,20),(22,25),(17,30),(12,36)],SLASH[3])
        s.line(3,41,10,39,SLASH[4]);s.rect(16,31,17,32,SLASH[5]);s.px(36,2,SLASH[5])
    elif f==5:
        poly(s,[(6,39),(8,34),(10,32),(9,37)],SLASH[2]);poly(s,[(13,29),(16,22),(18,19),(17,25),(15,30)],SLASH[3])
        poly(s,[(20,16),(23,10),(26,7),(24,12),(22,17)],SLASH[2]);poly(s,[(28,5),(31,1),(32,1),(30,5)],SLASH[3])
        s.px(4,41,SLASH[4]);s.px(15,34,SLASH[5]);s.px(33,4,SLASH[2])
    elif f==6:
        s.px(9,35,SLASH[1]);s.rect(14,27,15,28,SLASH[2]);s.px(21,18,SLASH[3]);s.px(27,9,SLASH[2]);s.px(33,2,SLASH[5])


def build_upper():
    s=sprite(38,42,SLASH,[100,50,50,100,80,140])
    for f in range(1,7):upper_frame(s,f)
    return s


def export(name,s):
    target=RUNTIME/name
    if target.exists():shutil.rmtree(target)
    target.mkdir(parents=True)
    for i in range(1,s.n_frames+1):s.save_png(str(target/f"frame-{i-1:02d}.png"),frame=i,scale=1)
    peak=5 if name!="raging-upper" else 4
    s.save_png(str(OUT/f"{name}-master-1x.png"),frame=peak,scale=1)
    s.save_png(str(OUT/f"{name}-master-12x.png"),frame=peak,scale=12)
    s.save_gif(str(OUT/f"{name}-preview.gif"),scale=6,bg=BG)
    s.save_spritesheet(str(OUT/f"{name}-spritesheet.png"),layout="horizontal",scale=1)
    s.save_silhouette(str(OUT/f"{name}-silhouette.png"),frame=peak,scale=12)
    return s.stats(print_=False)


def contact(items):
    from PIL import Image,ImageDraw
    rows=[]
    for name,s in items.items():
        row=Image.new("RGB",(s.w*s.n_frames*6,s.h*6+20),(16,23,19));d=ImageDraw.Draw(row)
        for i in range(s.n_frames):
            cell=Image.new("RGBA",(s.w,s.h),(34,53,44,255));cell.alpha_composite(s.composite(i+1))
            row.paste(cell.convert("RGB").resize((s.w*6,s.h*6),Image.Resampling.NEAREST),(i*s.w*6,0))
            d.text((i*s.w*6+3,s.h*6+4),f"F{i+1}",fill=(225,234,218))
        rows.append(row)
    canvas=Image.new("RGB",(max(x.width for x in rows),sum(x.height for x in rows)),(16,23,19));y=0
    for row in rows:canvas.paste(row,(0,y));y+=row.height
    canvas.save(OUT/"keyframes-contact.png")


def main():
    OUT.mkdir(parents=True,exist_ok=True);RUNTIME.mkdir(parents=True,exist_ok=True)
    items={"earth-wave":build_earth(),"flame":build_flame(),"raging-upper":build_upper()}
    stats={k:export(k,v) for k,v in items.items()};contact(items)
    (OUT/"stats.json").write_text(json.dumps(stats,ensure_ascii=False,indent=2,default=str))
    print(OUT/"stats.json")


if __name__=="__main__":main()
