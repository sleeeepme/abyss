#!/usr/bin/env python3
"""Simulation-first pixel VFX: buoyant fire parcels and rigid rising rock plates."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math,random,shutil

HERE=Path(__file__).resolve().parent;OUT=HERE/"generated"
RUNTIME=HERE.parents[1]/"proto"/"assets"/"effects"/"weapon-art-v30"
FIRE=["#4d1929","#7e2130","#b92b2e","#eb4b25","#ff9129","#ffe08a"]
EARTH=["#171b1b","#312a27","#514036","#7b5c43","#b98552","#f0ca78"]
N=16

def img(w,h):return Image.new("RGBA",(w,h),(0,0,0,0))
def ellipse(d,box,c):d.ellipse(tuple(round(v) for v in box),fill=c)
def polygon(d,pts,c):d.polygon([(round(x),round(y)) for x,y in pts],fill=c)
def flame_blob(d,x,y,rx,ry,bend,color,old=False):
 # A buoyant parcel is translated into a pixel flame: broad fuel-facing base,
 # asymmetric shoulders, and a narrow advected tip. Old parcels become wisps.
 if old:
  pts=[(x-rx*.70,y+ry*.65),(x-rx*.55,y),(x+bend*.45,y-ry),
       (x+rx*.40,y-ry*.28),(x+rx*.62,y+ry*.55),(x,y+ry)]
 else:
  pts=[(x-rx,y+ry*.72),(x-rx*.92,y+ry*.05),(x-rx*.55,y-ry*.38),
       (x+bend,y-ry),(x+rx*.38,y-ry*.45),(x+rx*.88,y+.02*ry),(x+rx,y+ry*.68),(x,y+ry)]
 polygon(d,pts,color)

SOURCES=[(6,0,1),(13,1,7),(21,2,3),(30,3,11),(39,4,5),(48,5,13),(57,6,9)]
def fire_frame(frame):
 im=img(64,40);d=ImageDraw.Draw(im);ground=35
 active_end=12;head=min(61,6+frame*7)
 # The ignition front travels across the floor. It fragments during decay.
 if frame<13:
  polygon(d,[(3,ground),(7,33),(14,34),(22,32),(31,34),(40,32),(head,34),(head+1,ground),(head-1,38),(4,38)],FIRE[0])
  polygon(d,[(5,ground),(14,34),(23,35),(31,33),(42,35),(head,34),(head-2,37),(6,37)],FIRE[2])
 else:
  for x,w in [(8,8),(25,10),(44,7),(56,5)]:d.rectangle((x,35,x+w-(frame-13)*2,37),fill=FIRE[1])
 parcels=[]
 for sx,start,seed in SOURCES:
  for k in range(5):
   birth=start+k*2;age=frame-birth
   if 0<=age<=7 and birth<active_end:
    rnd=random.Random(seed*101+k*37)
    lift=(2.5+rnd.random()*1.0)*(age**1.17)
    drift=math.sin(age*.9+seed*.63+k)*(.8+age*.42)+(rnd.random()-.5)*1.5
    x=sx+drift;y=ground-1-lift
    rx=max(1.2,5.2-age*.40+rnd.random()*1.25);ry=max(1.8,6.8-age*.44+rnd.random()*1.5)
    parcels.append((age,x,y,rx,ry,seed+k))
 # Paint every temperature layer in a separate pass. Older rising parcels
 # lose their hot cores while retaining a red outer cap.
 for layer,color in enumerate(FIRE):
  for age,x,y,rx,ry,seed in parcels:
   shrink=layer*.72
   if rx-shrink<.8 or ry-shrink<.8:continue
   max_age=(8,7,6,5,3,1)[layer]
   if age>max_age:continue
   yy=y+layer*.45+age*.10;bend=math.sin(seed*1.7+age*.85)*(1.1+age*.18)
   flame_blob(d,x,yy,rx-shrink,ry-shrink,bend,color,old=age>=5)
 # White heat stays attached to the fuel line; sparks detach and rise.
 if frame<12:
  for sx,start,seed in SOURCES:
   if frame>=start and (frame-start)%4==0:
    d.rectangle((sx,34,sx+1,35),fill=FIRE[5])
 for sx,start,seed in SOURCES:
  birth=start+3;age=frame-birth
  if 2<=age<=8:
   x=round(sx+math.sin(seed+age)*3);y=round(29-age*2.7-(seed%3))
   d.point((x,y),fill=FIRE[5 if seed%2 else 4])
   if age<4:d.point((x+1,y),fill=FIRE[4])
 return im

SHAPES=[
 [(-.50,0),(-.50,-.35),(-.26,-.62),(-.08,-1),( .12,-.82),(.42,-.46),(.50,0)],
 [(-.50,0),(-.46,-.42),(-.22,-1),(-.02,-.66),(.20,-.94),(.48,-.38),(.50,0)],
 [(-.50,0),(-.44,-.50),(-.25,-.82),(-.05,-1),(.22,-.98),(.48,-.45),(.50,0)],
 [(-.50,0),(-.48,-.32),(-.30,-.70),(-.04,-.84),(.10,-1),(.28,-.76),(.50,-.38),(.50,0)]]
CHUNKS=[(8,1,5,4,0),(14,2,6,6,1),(21,3,7,8,2),(29,4,8,10,3),(39,5,10,13,1),(51,6,13,17,2),(67,7,20,27,3)]
def tx_points(shape,x,base,w,h,lean,yoff,settle):
 return [(x+px*w+(-py)*lean,base+py*h+yoff+settle) for px,py in shape]
def rock(draw,spec,frame):
 x,start,w,h,kind=spec;age=frame-start
 if age<0 or age>10:return
 if age<=3:
  u=age/3;rise=1-(1-u)**3;yoff=h*(1-rise);settle=0
 elif age<=7:
  yoff=0;settle=(age-3)*.32
 else:return
 lean=(.05+.035*kind)*w
 outer=tx_points(SHAPES[kind],x,31,w,h,lean,yoff,settle)
 polygon(draw,outer,EARTH[0])
 shadow=tx_points([(-.40,-.04),(-.38,-.40),(-.14,-.84),(.02,-.66),(.02,-.06)],x,31,w,h,lean,yoff,settle)
 polygon(draw,shadow,EARTH[1])
 mid=tx_points([(-.02,-.06),(-.02,-.66),(.10,-.90),(.35,-.42),(.40,-.08)],x,31,w,h,lean,yoff,settle)
 polygon(draw,mid,EARTH[2])
 face=tx_points([(.04,-.10),(.12,-.66),(.22,-.78),(.35,-.38),(.36,-.12)],x,31,w,h,lean,yoff,settle)
 polygon(draw,face,EARTH[3])
 light=tx_points([(.12,-.58),(.20,-.76),(.29,-.46),(.25,-.30)],x,31,w,h,lean,yoff,settle)
 polygon(draw,light,EARTH[4])
 ridge=tx_points([(.10,-.88),(.17,-.98),(.23,-.87),(.20,-.76)],x,31,w,h,lean,yoff,settle)
 polygon(draw,ridge,EARTH[5])
 # A stable crack belongs to the rigid chunk and moves with it.
 if h>=10:
  a=tx_points([(0,-.58),(-.06,-.43),(.02,-.31),(-.04,-.17)],x,31,w,h,lean,yoff,settle)
  draw.line([(round(xx),round(yy)) for xx,yy in a],fill=EARTH[1],width=1)

def earth_frame(frame):
 im=img(84,36);d=ImageDraw.Draw(im)
 head=min(80,5+frame*6)
 # The crack front travels first; it does not appear across the whole range at once.
 d.line((2,32,head,32),fill=EARTH[0],width=1)
 for x in range(5,head,7):
  y=31-((x*5+frame)%3==0);d.point((x,y),fill=EARTH[2])
 for spec in CHUNKS:rock(d,spec,frame)
 # After a chunk settles, it breaks into persistent pieces with ballistic motion.
 for i,(x,start,w,h,kind) in enumerate(CHUNKS):
  age=frame-(start+7)
  if age<0:continue
  for j in range(3):
   vx=(-1.2+j*1.3)+(i%2)*.35;vy=2.4+j*.8
   xx=x+vx*age;yy=30-h*.35-vy*age+.72*age*age
   if 0<=xx<84 and 0<=yy<32:
    c=EARTH[5-j if j<2 else 3];d.rectangle((round(xx),round(yy),round(xx)+(j==1),round(yy)+1),fill=c)
  # Low rubble replaces the original silhouette instead of shrinking it.
  if age<=5:
   rw=max(2,round(w*(1-age*.10)));rh=max(1,round(h*.18*(1-age*.12)))
   polygon(d,[(x-rw//2,31),(x-rw//3,31-rh),(x,30-rh//2),(x+rw//3,31-rh),(x+rw//2,31)],EARTH[0])
   polygon(d,[(x-rw//3,30),(x,30-rh),(x+rw//3,30)],EARTH[3])
 # Ground seam closes behind the wave.
 d.line((2,33,min(82,head+2),33),fill=EARTH[1],width=1)
 return im

def save(name,frames,durations):
 d=RUNTIME/name
 if d.exists():shutil.rmtree(d)
 d.mkdir(parents=True)
 for i,im in enumerate(frames):im.save(d/f"frame-{i:02d}.png")
 scaled=[im.resize((im.width*6,im.height*6),Image.Resampling.NEAREST) for im in frames]
 bg=[]
 for im in scaled:
  b=Image.new("RGBA",im.size,(34,53,44,255));b.alpha_composite(im);bg.append(b.convert("P",palette=Image.Palette.ADAPTIVE,colors=64))
 bg[0].save(OUT/f"{name}-preview.gif",save_all=True,append_images=bg[1:],duration=durations,loop=0,optimize=False,disposal=2)

def sheet(earth,fire):
 cellw=84*4;cellh=40*4+20;out=Image.new("RGB",(cellw*4,cellh*4),(18,27,23));d=ImageDraw.Draw(out)
 ids=[0,2,4,6,8,10,12,15]
 for row,(name,frames) in enumerate((("EARTH",earth),("FIRE",fire))):
  for j,f in enumerate(ids):
   x=j%4*cellw;y=(row*2+j//4)*cellh
   im=frames[f].resize((frames[f].width*4,frames[f].height*4),Image.Resampling.NEAREST)
   out.paste(Image.new("RGB",(cellw,160),(34,53,44)),(x,y));out.paste(im,(x,y),im)
   d.text((x+5,y+163),f"{name} F{f:02d}",fill=(232,238,226))
 out.save(OUT/"motion-keyframes.png")

def main():
 OUT.mkdir(parents=True,exist_ok=True);RUNTIME.mkdir(parents=True,exist_ok=True)
 fire=[fire_frame(i) for i in range(N)];earth=[earth_frame(i) for i in range(N)]
 durations=[55]*15+[160];save("flame",fire,durations);save("earth-wave",earth,durations);sheet(earth,fire)
 stats={"frames":N,"fire_size":fire[0].size,"earth_size":earth[0].size,"durations":durations,"semi_alpha":sum(1 for ims in (fire,earth) for im in ims for a in im.getchannel('A').getdata() if a not in (0,255))}
 (OUT/"stats.json").write_text(json.dumps(stats,indent=2))
if __name__=="__main__":main()
