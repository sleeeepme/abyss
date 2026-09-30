#!/usr/bin/env python3
"""Hand-authored ABYSS weapon-art sprites: Flame, Ground Wave, Raging Upper."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

SKILL = Path("/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
sys.path.insert(0, str(SKILL))
from pixelstudio import Sprite  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "generated"
RUNTIME = HERE.parents[1] / "proto" / "assets" / "effects" / "weapon-art-v16"
BG = "#22352c"

EARTH = ["#17231d", "#343d35", "#514b3c", "#756246", "#a98554", "#d7bd78"]
FIRE = ["#5d1f2b", "#9a2930", "#d8422e", "#f4742d", "#ffb23f", "#fff0a0"]
SLASH = ["#50677a", "#83aabc", "#c6e3e8", "#f8fff4", "#e6c85e", "#fff0a0"]


def new_sprite(w, h, palette, durations):
    s = Sprite(w, h, palette=palette)
    s.frames[0].duration = durations[0]
    for duration in durations[1:]:
        s.add_frame(copy=False, duration=duration)
    return s


def poly(s, pts, color):
    if len(pts) >= 3:
        s.polygon(pts, color)


def draw_crag(s, x, base, w, h, lean, crown, notch=0, split=0):
    """One solid crag with four authored material planes."""
    left, right, top = x-w//2, x+(w+1)//2, base-h
    tip = x + lean
    outer = [(left+2,base),(left,base-2),(left+2,base-h//3),
             (tip-crown,top+4),(tip-2,top+notch),(tip+2,top),
             (tip+crown,top+4+notch),(right-1,base-h//3),(right+1,base-2),(right-2,base+1)]
    poly(s, outer, EARTH[0])
    shadow = [(left+3,base-2),(left+3,base-h//3),(tip-crown+2,top+5),
              (tip-1,top+2+notch),(x-1,base-3)]
    poly(s, shadow, EARTH[2])
    mid = [(tip-1,top+2+notch),(tip+1,top+1),(tip+crown-2,top+5+notch),
           (right-2,base-h//3),(right-3,base-3),(x-1,base-3)]
    poly(s, mid, EARTH[3])
    light = [(tip,top+1+notch),(tip+2,top+1),(tip+crown-2,top+5+notch),
             (tip+crown-4,top+7+notch),(tip-2,top+4+notch)]
    poly(s, light, EARTH[4])
    if h >= 16:
        s.line(tip, top+1+notch, tip+max(1,crown-3), top+3+notch, EARTH[5])
    if split:
        s.line(x+split, top+6, x+split-2, base-3, EARTH[1])
        if h >= 14:
            s.px(x+split-1, top+7, EARTH[0])


def draw_earth_frame(s, frame):
    s.use(frame=frame)
    base = 48
    poses = {
        1: [],
        2: [(17,10,5,-1,3,0,0),(37,13,7,1,4,1,1)],
        3: [(15,12,7,-1,3,1,0),(35,15,10,1,4,0,1),(58,18,13,-2,5,1,-2)],
        4: [(14,13,8,-1,3,0,1),(34,16,11,1,4,1,-2),(57,19,15,-2,5,0,2),
            (83,23,20,2,6,1,-3),(113,26,26,-1,7,0,3)],
        5: [(13,13,8,-1,3,1,1),(33,17,12,1,4,0,-2),(56,20,16,-2,5,1,2),
            (82,24,21,2,6,0,-3),(112,29,29,-1,8,1,3),(151,34,37,4,8,0,-4)],
        6: [(14,14,7,0,3,1,0),(35,18,11,1,4,1,-2),(59,21,15,-1,5,0,2),
            (85,25,20,2,6,1,-3),(116,30,27,0,7,0,3),(153,35,34,5,8,1,-4)],
        7: [(16,18,5,0,5,1,0),(42,22,7,1,6,0,1),(72,27,9,-1,7,1,-2),
            (107,32,12,1,8,0,2),(148,38,15,3,9,1,-3)],
        8: []
    }
    # One connected base prevents the effect reading as separate pebbles.
    bases = {
        1:[(5,48),(14,46),(27,48)],
        2:[(5,48),(15,45),(31,47),(45,44),(57,48)],
        3:[(5,48),(18,44),(38,46),(58,42),(75,47),(88,48)],
        4:[(5,48),(22,44),(43,45),(66,40),(91,43),(118,38),(139,46),(165,48)],
        5:[(4,48),(24,43),(47,45),(69,39),(97,42),(126,35),(159,39),(180,47)],
        6:[(5,48),(24,44),(50,45),(73,40),(100,42),(129,36),(160,39),(181,47)],
        7:[(7,48),(31,45),(61,47),(90,43),(123,45),(160,42),(181,48)],
        8:[(12,48),(35,47),(58,49),(85,46),(112,48),(143,46),(174,49)]
    }
    poly(s, bases[frame] + [(bases[frame][-1][0],51),(bases[frame][0][0],51)], EARTH[0])
    if frame >= 2:
        inner=[(x,y+1) for x,y in bases[frame]]
        poly(s, inner+[(inner[-1][0],49),(inner[0][0],49)], EARTH[2])
        for a,b in ((9,29),(52,76),(94,121),(133,166)):
            if a < bases[frame][-1][0]:
                s.line(a,47,b,48 if frame%2 else 46,EARTH[3])
    for spec in poses[frame]:
        draw_crag(s, spec[0], base, *spec[1:])
    # Hand-placed chips change shape and direction instead of fading alpha.
    chips={3:[(68,36,1)],4:[(96,28,2),(126,40,1)],5:[(126,15,2),(164,9,2),(174,22,1)],
           6:[(132,18,2),(169,13,2),(177,28,1)],7:[(103,31,2),(142,29,2),(171,37,1)],
           8:[(39,44,1),(78,43,2),(121,42,1),(162,44,2)]}
    for x,y,z in chips.get(frame,[]):
        s.rect(x,y,x+z,y+z,EARTH[4])
        if z>1:s.px(x+z,y,EARTH[5])


def build_earth():
    s=new_sprite(184,56,EARTH,[90,70,70,80,110,90,100,150])
    for f in range(1,9): draw_earth_frame(s,f)
    return s


def flame_shape(s, x, base, w, h, lean, variant):
    """Layered emissive tongue; variant changes forks and negative spaces."""
    left,right,top=x-w//2,x+(w+1)//2,base-h
    bend=lean
    if variant%3==0:
        outer=[(left+2,base),(left,base-5),(left+3,base-11),(x-5,base-h//2),
               (x-8+bend,top+9),(x-2+bend,top),(x+2+bend,top+8),
               (right-4,base-h//2),(right,base-9),(right-2,base)]
    elif variant%3==1:
        outer=[(left+1,base),(left,base-7),(left+5,base-13),(x-7,base-h//2),
               (x-3+bend,top+8),(x+2+bend,top),(x+4+bend,top+11),
               (right-2,base-h//3),(right,base-5),(right-3,base)]
    else:
        outer=[(left+2,base),(left,base-6),(left+4,base-14),(x-3,base-h//3),
               (x+2+bend,top),(x+6+bend,top+10),(right-2,base-h//2),
               (right,base-7),(right-3,base)]
    # The shared outer contour is drawn once by draw_fire_frame.  Individual
    # tongues only add emissive interior planes, so dark seams cannot split the
    # burning area into a row of cloned campfires.
    mid=[(left+3,base-1),(left+2,base-6),(x-3,base-h//3),(x-1+bend,top+9),
         (x+3+bend,top+5),(x+5,base-h//3),(right-3,base-5),(right-4,base-1)]
    poly(s,mid,FIRE[2])
    hot=[(left+5,base-2),(left+5,base-7),(x-1,base-h//3),(x+1+bend,top+12),
         (x+4,base-h//3),(right-5,base-4),(right-6,base-1)]
    poly(s,hot,FIRE[3])
    yellow=[(x-w//5,base-2),(x-w//6,base-8),(x+1,base-h//3),(x+3,base-7),(x+w//5,base-2)]
    poly(s,yellow,FIRE[4])
    if h>=24:
        poly(s,[(x-2,base-2),(x-1,base-8),(x+1,base-12),(x+3,base-6),(x+2,base-2)],FIRE[5])


def draw_fire_frame(s, frame):
    s.use(frame=frame); base=70
    # Irregular connected ignition bed: a range, not cloned campfires.
    beds={1:(40,78),2:(23,103),3:(13,116),4:(9,120),5:(7,121),6:(8,120),7:(15,114),8:(31,99)}
    x0,x1=beds[frame]
    contours={
      1:[(40,70),(42,61),(48,64),(52,55),(57,61),(61,53),(66,60),(73,63),(78,70)],
      2:[(23,70),(25,60),(31,63),(35,49),(40,56),(46,43),(51,56),(58,35),(65,48),(70,39),(76,55),(84,50),(90,58),(96,48),(101,58),(103,70)],
      3:[(13,70),(16,58),(23,62),(28,43),(34,54),(42,34),(48,45),(53,20),(59,34),(64,26),(70,48),(78,35),(84,47),(91,30),(98,46),(105,40),(111,53),(116,48),(118,70)],
      4:[(9,70),(12,55),(19,60),(23,35),(30,50),(37,29),(43,40),(49,12),(55,27),(61,38),(68,24),(75,39),(81,29),(87,48),(95,34),(102,45),(108,31),(114,50),(120,42),(122,70)],
      5:[(7,70),(10,56),(18,61),(22,40),(29,51),(35,27),(42,42),(48,19),(55,34),(63,8),(70,25),(76,39),(82,23),(89,41),(96,28),(102,46),(109,35),(115,52),(121,44),(123,70)],
      6:[(8,70),(12,52),(19,59),(24,31),(31,48),(38,20),(44,38),(50,29),(56,43),(62,17),(69,32),(75,24),(82,43),(89,30),(96,46),(103,27),(109,44),(116,38),(122,55),(120,70)],
      7:[(15,70),(18,57),(25,61),(31,42),(37,52),(44,29),(51,45),(57,24),(63,41),(70,34),(77,48),(84,29),(91,45),(98,37),(105,51),(112,47),(116,70)],
      8:[(31,70),(34,59),(41,63),(47,46),(53,56),(59,37),(66,51),(73,29),(79,43),(86,52),(92,39),(98,53),(104,60),(99,70)]}
    poly(s,contours[frame],FIRE[0])
    shade=[(x,min(70,y+max(3,(70-y)//5))) for x,y in contours[frame]]
    poly(s,shade,FIRE[1])
    poly(s,[(x0,70),(x0+7,66),(x0+20,68),(x0+31,64),(x0+45,67),(x1-8,65),(x1,70),(x1-7,75),(x0+5,75)],FIRE[0])
    poly(s,[(x0+5,69),(x0+18,66),(x0+31,68),(x0+45,65),(x1-5,69),(x1-10,73),(x0+9,73)],FIRE[2])
    poly(s,[(x0+13,69),(x0+28,67),(x0+40,69),(x1-14,68),(x1-19,71),(x0+18,71)],FIRE[4])
    tongues={
      1:[(58,14,14,-1,0)],
      2:[(39,18,24,-2,1),(66,22,31,2,0),(91,16,20,-1,2)],
      3:[(28,20,29,-2,2),(53,25,43,2,0),(82,22,34,-2,1),(105,18,25,1,2)],
      4:[(22,21,35,-2,1),(48,27,50,3,0),(77,24,39,-2,2),(102,22,34,2,1),(116,14,22,-1,0)],
      5:[(20,22,30,2,2),(45,25,42,-3,1),(73,28,55,3,0),(101,23,37,-2,2),(116,17,28,1,1)],
      6:[(22,20,36,-2,0),(48,27,48,2,2),(78,25,44,-3,1),(103,21,33,2,0),(117,14,23,-1,2)],
      7:[(31,18,29,1,2),(55,24,38,-2,0),(82,22,34,2,1),(106,17,25,-1,2)],
      8:[(48,17,22,-1,1),(72,21,29,2,2),(95,16,19,-1,0)]}
    for x,w,h,lean,variant in tongues[frame]: flame_shape(s,x,base,w,h,lean,variant)
    embers={2:[(68,31),(91,44)],3:[(49,18),(76,24),(108,37)],4:[(45,10),(79,19),(110,29)],
            5:[(72,7),(96,22),(35,29)],6:[(48,14),(81,17),(113,31)],7:[(57,25),(89,29)],8:[(73,37)]}
    for i,(x,y) in enumerate(embers.get(frame,[])):
        s.rect(x,y,x+(i%2),y+(i%2),FIRE[4 if i%2 else 3])


def build_flame():
    s=new_sprite(128,80,FIRE,[100,70,70,90,110,90,100,150])
    for f in range(1,9): draw_fire_frame(s,f)
    return s


def draw_upper_frame(s, frame):
    s.use(frame=frame)
    # Every main silhouette is a separately authored key pose.
    if frame==1:
        s.line(20,103,33,96,SLASH[4]);s.rect(17,104,19,105,SLASH[5]);s.px(35,94,SLASH[3])
    elif frame==2:
        poly(s,[(20,106),(25,92),(36,81),(42,69),(47,71),(42,84),(31,96)],SLASH[0])
        poly(s,[(24,103),(28,93),(39,80),(43,72),(45,73),(40,84),(30,99)],SLASH[2])
        s.line(27,100,43,74,SLASH[3]);s.rect(17,107,22,109,SLASH[4])
    elif frame==3:
        poly(s,[(18,109),(23,91),(35,78),(45,61),(57,43),(67,30),(74,25),(72,35),
                (62,49),(54,67),(42,84),(31,99)],SLASH[0])
        poly(s,[(21,107),(25,91),(37,77),(47,60),(59,42),(69,29),(72,28),(68,39),
                (59,53),(51,69),(39,86),(29,102)],SLASH[1])
        poly(s,[(23,105),(27,92),(39,78),(49,60),(61,43),(69,31),(72,29),(67,42),
                (57,57),(50,72),(38,88),(29,103)],SLASH[2])
        poly(s,[(28,101),(32,91),(43,76),(53,58),(64,42),(69,34),(67,43),(58,57),
                (51,71),(40,86)],SLASH[3])
        s.line(20,111,40,104,SLASH[4]);s.rect(44,93,47,95,SLASH[5])
    elif frame==4:
        poly(s,[(17,110),(20,91),(31,79),(40,60),(51,43),(62,25),(75,10),(82,6),(79,17),
                (69,31),(61,49),(51,66),(42,85),(31,101)],SLASH[0])
        poly(s,[(20,108),(23,91),(34,78),(43,59),(54,42),(65,24),(77,9),(80,8),(75,21),
                (66,35),(58,52),(49,69),(40,88),(29,104)],SLASH[1])
        poly(s,[(22,106),(24,93),(35,78),(44,59),(55,42),(66,24),(77,11),(79,10),(73,24),
                (63,40),(56,57),(47,73),(38,91),(29,104)],SLASH[2])
        poly(s,[(27,101),(30,92),(39,76),(48,58),(58,42),(68,25),(75,16),(70,28),
                (61,43),(54,58),(45,75),(36,93)],SLASH[3])
        s.line(15,112,38,105,SLASH[4]);s.rect(41,96,45,98,SLASH[5]);s.rect(78,20,81,22,SLASH[3])
        s.px(86,9,SLASH[5]);s.rect(74,2,75,4,SLASH[4])
    elif frame==5:
        # The crescent breaks into directional clusters instead of opacity fading.
        for pts,col in [([(22,105),(27,91),(32,88),(29,101)],SLASH[2]),
                        ([(35,82),(42,66),(48,58),(45,72),(40,83)],SLASH[3]),
                        ([(53,51),(61,34),(67,28),(63,41),(58,52)],SLASH[2]),
                        ([(70,20),(78,9),(81,7),(77,17),(74,22)],SLASH[3])]: poly(s,pts,col)
        s.rect(16,109,21,111,SLASH[4]);s.rect(43,91,46,93,SLASH[5]);s.rect(83,14,86,16,SLASH[2])
    elif frame==6:
        s.rect(27,94,31,96,SLASH[1]);s.rect(43,72,46,75,SLASH[2]);s.rect(59,47,62,50,SLASH[3])
        s.rect(75,24,78,27,SLASH[2]);s.rect(84,10,86,12,SLASH[4]);s.px(91,5,SLASH[5])


def build_upper():
    s=new_sprite(112,116,SLASH,[100,50,50,100,80,140])
    for f in range(1,7): draw_upper_frame(s,f)
    return s


def export(name, sprite):
    target=RUNTIME/name
    if target.exists(): shutil.rmtree(target)
    target.mkdir(parents=True)
    for i in range(1,sprite.n_frames+1):
        sprite.save_png(str(target/f"frame-{i-1:02d}.png"),frame=i,scale=1)
    sprite.save_png(str(OUT/f"{name}-master-1x.png"),frame=max(1,(sprite.n_frames+1)//2),scale=1)
    sprite.save_png(str(OUT/f"{name}-master-8x.png"),frame=max(1,(sprite.n_frames+1)//2),scale=8)
    sprite.save_gif(str(OUT/f"{name}-preview.gif"),scale=4,bg=BG)
    sprite.save_spritesheet(str(OUT/f"{name}-spritesheet.png"),layout="horizontal",scale=1)
    sprite.save_silhouette(str(OUT/f"{name}-silhouette.png"),frame=max(1,(sprite.n_frames+1)//2),scale=8)
    return sprite.stats(print_=False)


def contact(sprites):
    from PIL import Image, ImageDraw
    rows=[]
    for name,s in sprites.items():
        row=Image.new("RGB",(s.w*s.n_frames*3,s.h*3+24),(16,23,19));d=ImageDraw.Draw(row)
        for i in range(s.n_frames):
            cell=Image.new("RGBA",(s.w,s.h),(34,53,44,255));cell.alpha_composite(s.composite(i+1))
            row.paste(cell.convert("RGB").resize((s.w*3,s.h*3),Image.Resampling.NEAREST),(i*s.w*3,0))
            d.text((i*s.w*3+4,s.h*3+5),f"{name} F{i+1}",fill=(220,232,216))
        rows.append(row)
    canvas=Image.new("RGB",(max(r.width for r in rows),sum(r.height for r in rows)),(16,23,19))
    y=0
    for row in rows: canvas.paste(row,(0,y));y+=row.height
    canvas.save(OUT/"keyframes-contact.png")


def main():
    OUT.mkdir(parents=True,exist_ok=True);RUNTIME.mkdir(parents=True,exist_ok=True)
    sprites={"earth-wave":build_earth(),"flame":build_flame(),"raging-upper":build_upper()}
    report={name:export(name,s) for name,s in sprites.items()}
    contact(sprites)
    (OUT/"stats.json").write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str))
    print(OUT/"stats.json")


if __name__=="__main__": main()
