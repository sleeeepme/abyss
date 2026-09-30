#!/usr/bin/env python3
"""Ten reference-comparison passes for ABYSS Flame and Ground Wave."""
from pathlib import Path
import json, shutil, sys

sys.path.insert(0,"/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite

HERE=Path(__file__).resolve().parent
OUT=HERE/"generated"; ITER=HERE/"iterations"
RUNTIME=HERE.parents[1]/"proto"/"assets"/"effects"/"weapon-art-v28"
EARTH=["#171b1a","#302c28","#4b4035","#725a42","#ad8252","#edc776"]
FIRE=["#541c2a","#8d2430","#c9342c","#ef5a25","#ff9c2e","#ffe18a"]

def spr(w,h,pal,durs):
 s=Sprite(w,h,palette=pal);s.frames[0].duration=durs[0]
 for d in durs[1:]:s.add_frame(copy=False,duration=d)
 return s
def poly(s,p,c):
 if len(p)>2:s.polygon(p,c)

SLABS=[(7,5,4,0),(13,6,5,1),(20,7,7,0),(28,8,9,2),(37,9,11,1),(47,11,14,3),(59,13,18,2),(68,10,15,3)]
def slab(s,x,w,h,lean,kind,level,base=20):
 t=base-h;l=x-w//2;r=x+(w+1)//2;tip=x+lean
 if level>=10 and kind%3==1 and h>=7: # split crown
  top=[(tip-3,t+4),(tip-2,t+1),(tip,t+3),(tip+2,t),(tip+3,t+3)]
 elif level>=10 and kind%3==2 and h>=7: # blunt fractured crown
  top=[(tip-3,t+3),(tip-2,t+1),(tip-1,t),(tip+1,t),(tip+3,t+2)]
 else: # sharp leaning plate
  top=[(tip-3,t+3),(tip-1,t+1),(tip,t),(tip+2,t+2)]
 crown=[(l+1,base),(l,t+max(3,h//2))]+top+[(r,t+max(3,h//2)),(r+1,base-1),(r-1,base)]
 poly(s,crown,EARTH[0])
 poly(s,[(l+1,base-1),(l+1,t+max(3,h//2)),(tip-2,t+3),(tip,t+1),(x,base-2)],EARTH[1])
 poly(s,[(tip,t+1),(tip+2,t+3),(r,t+max(3,h//2)),(r-1,base-2),(x,base-2)],EARTH[2])
 if level>=4:
  poly(s,[(tip+1,t+2),(r-1,t+max(4,h//2)),(r-2,base-3),(x+1,base-3),(x+1,t+4)],EARTH[3])
 if level>=5:
  poly(s,[(tip+2,t+3),(r-1,t+max(4,h//2)),(r-2,base-4),(x+2,base-4)],EARTH[4])
 if level>=6:
  s.line(tip,t,tip+2,t+2,EARTH[5])
  if h>10:s.line(x+3,t+6,min(r-1,x+4),t+8,EARTH[5])
 if level>=7 and h>7:
  sx=x-1+(kind%2);s.line(sx,t+4,sx-1,base-3,EARTH[1])
  s.px(r-2,base-2,EARTH[5 if kind%3==0 else 4])
 if level>=10 and h>10:
  # Broken strata follow the plane instead of decorating its outline.
  s.line(l+2,base-5,x-1,base-7,EARTH[3])
  s.line(x+2,t+5,min(r-2,x+4),t+6,EARTH[5])
  s.px(l+2,base-3,EARTH[4]);s.px(l+3,base-3,EARTH[4])

def earth_frame(s,f,level=10):
 s.use(frame=f);base=20
 # First four passes close the gaps and build a single rising mass.
 gap=max(0,4-level); count=[0,2,4,6,8,8,6,0][f-1]
 if f==7:
  for i,(x,w,h,lean) in enumerate(SLABS[:count]):
   ww=max(4,w-1);hh=max(2,h//3);slab(s,x-gap*i,ww,hh,lean//2,i,level,base)
 else:
  for i,(x,w,h,lean) in enumerate(SLABS[:count]):
   hh=h if f>=5 else max(3,h-(5-f)*2)
   ll=lean if level>=3 else 0
   if f==6:
    # The held impact frame flexes as a new drawing: alternating plates
    # settle by one pixel and their crowns shift, instead of repeating F5.
    hh=max(3,h+(-1,1,0,-1,1,-1,0,1)[i])
    ll+=(-1,0,1)[i%3]
   slab(s,x-gap*i,w,hh,ll,i+f if f==6 else i,level,base)
 # A continuous dark seam prevents the rocks from floating as separate props.
 reach=[10,22,40,58,74,74,67,72][f-1]
 if level>=2:
  s.line(2,20,reach,20,EARTH[0]);s.line(4,21,max(5,reach-2),21,EARTH[1])
 if level>=8:
  crack={1:[(2,20,10,19)],2:[(2,20,17,19)],3:[(2,20,29,19)],4:[(2,20,47,19)],
         5:[(2,20,72,19)],6:[(2,20,72,19)],7:[(3,20,66,20)],8:[(5,20,70,20)]}[f]
  for x0,y0,x1,y1 in crack:s.line(x0,y0,x1,y1,EARTH[2])
 if level>=7:
  chips={3:[(25,15,4)],4:[(42,10,4),(50,14,5)],5:[(48,4,5),(61,0,5),(70,6,4)],
         6:[(51,5,5),(64,2,4),(72,8,5)],7:[(38,15,4),(53,13,5)],8:[(18,18,4),(46,17,5)]}
  for x,y,c in chips.get(f,[]):s.px(x,y,EARTH[c])

def build_earth(level=10):
 s=spr(76,23,EARTH,[100,70,70,80,120,90,110,170])
 for f in range(1,9):earth_frame(s,f,level)
 return s

OUTLINES={
1:[(11,26),(12,22),(16,23),(19,18),(22,23),(27,21),(31,26)],
2:[(5,26),(6,20),(10,22),(13,14),(17,19),(21,9),(24,16),(29,12),(33,21),(39,17),(43,22),(46,26)],
3:[(3,26),(4,19),(8,21),(11,12),(15,17),(19,5),(22,13),(26,8),(30,17),(34,3),(37,12),(41,9),(44,19),(48,15),(49,26)],
4:[(2,26),(3,18),(7,20),(10,10),(14,16),(18,3),(21,12),(25,7),(29,16),(33,1),(36,11),(40,6),(43,17),(47,12),(49,20),(50,26)],
5:[(1,26),(2,17),(6,20),(9,9),(13,15),(17,2),(20,11),(24,6),(28,15),(32,0),(35,10),(39,5),(42,16),(46,10),(49,19),(50,26)],
6:[(2,26),(3,16),(7,20),(11,8),(14,16),(18,4),(22,12),(26,5),(29,16),(33,2),(36,11),(40,7),(44,17),(48,13),(50,26)],
7:[(4,26),(5,18),(9,21),(13,10),(17,17),(21,6),(25,14),(29,9),(33,18),(37,7),(41,15),(45,12),(48,21),(49,26)],
8:[(9,26),(10,20),(14,22),(18,13),(22,19),(26,8),(30,17),(34,12),(38,21),(43,16),(47,23),(48,26)]}

def tongue(s,x,base,w,h,lean,kind,level):
 l=x-w//2;r=x+(w+1)//2;t=base-h;tip=x+lean
 # Curved, asymmetric red body.
 cap=2 if level>=10 else 0
 hot=[(l,base),(l+1,base-h//3),(x-2,t+6),(tip-1,t+2+cap),(tip,t+cap),
      (tip+1,t+1+cap),(tip+2,t+4+cap),(r-1,base-h//3),(r,base)]
 poly(s,hot,FIRE[2])
 if level>=5:
  bend=(-1,1,0)[kind%3]
  poly(s,[(l+1,base),(x-2,base-h//3),(x-1+bend,t+7),(tip,t+5),(tip+1,t+7),
          (x+2,base-h//3),(r-1,base)],FIRE[3])
 if level>=6:
  shift=(-1,1,0)[kind%3]
  poly(s,[(x-2+shift,base),(x-1+shift,base-h//3),(x+shift,t+8),
          (x+1+shift,t+7),(x+2+shift,base-h//3),(x+3+shift,base)],FIRE[4])
 if level>=7 and h>=9:
  cx=x+(-1 if kind%3==0 else 1)
  poly(s,[(cx-2,base),(cx-1,base-max(3,h//4)),(cx,base-max(4,h//3)),(cx+1,base-max(3,h//4)),(cx+2,base)],FIRE[5])

TONGUES={
1:[(20,8,7,0,0)],
2:[(12,8,12,-1,0),(24,10,18,1,1),(39,8,10,-1,2)],
3:[(9,9,14,-1,2),(20,12,22,1,0),(33,10,18,-1,1),(44,8,13,1,2)],
4:[(8,10,16,-1,1),(20,13,25,1,0),(34,11,22,-1,2),(45,9,15,1,1)],
5:[(7,10,17,1,2),(18,13,26,-1,1),(31,12,24,1,0),(43,10,18,-1,2)],
6:[(8,10,16,-1,0),(20,13,24,1,2),(34,11,21,-1,1),(45,9,15,1,0)],
7:[(11,9,14,1,2),(23,12,20,-1,0),(37,10,17,1,1),(46,7,11,-1,2)],
8:[(18,9,12,-1,1),(30,11,16,1,2),(42,8,10,-1,0)]}

def fire_frame(s,f,level=10):
 s.use(frame=f);base=26;outer=OUTLINES[f]
 if level>=10:
  # Replace needle points with stepped hooks or compact caps. The reference
  # reads as changing flame masses, not a row of geometric triangles.
  shaped=[]
  for i,p in enumerate(outer):
   x,y=p
   if 0<i<len(outer)-1 and y<outer[i-1][1] and y<outer[i+1][1]:
    if (x+f)%2: shaped.extend([(x-1,y+2),(x,y),(x+1,y+1),(x+2,y+4)])
    else: shaped.extend([(x-1,y+3),(x,y+1),(x+1,y),(x+2,y+3)])
   else: shaped.append(p)
  outer=shaped
 poly(s,outer,FIRE[0])
 # Deep red follows the silhouette unevenly instead of forming a parallel band.
 if level>=3:
  inner=[(x,min(base,y+(3 if (x+f)%3 else 2))) for x,y in outer]
  poly(s,inner,FIRE[1])
 # One shared bed connects the area attack into a single fire mass.
 x0,x1={1:(11,31),2:(5,46),3:(3,49),4:(2,50),5:(1,50),6:(2,50),7:(4,49),8:(9,48)}[f]
 if level>=2:
  poly(s,[(x0,26),(x0+3,23),(x0+9,25),(x0+15,22),(x1-5,23),(x1,26),(x1-2,29),(x0+2,29)],FIRE[0])
  poly(s,[(x0+2,25),(x0+9,23),(x0+15,25),(x1-4,24),(x1-6,27),(x0+3,28)],FIRE[2])
 for a in TONGUES[f]:tongue(s,a[0],base,*a[1:],level)
 if level>=8:
  emb={2:[(24,7)],3:[(20,1),(36,6)],4:[(17,0),(31,3),(46,7)],5:[(29,0),(42,4),(11,6)],
       6:[(20,1),(35,4),(47,8)],7:[(25,4),(41,7)],8:[(31,7)]}
  for i,(x,y) in enumerate(emb.get(f,[])):s.px(x,y,FIRE[5 if i==0 else 4])
 if level>=10 and f in (4,5,6):
  # Dark bites split neighbouring lobes without cutting the shared fire bed.
  for x,y in ((14,14),(28,14),(41,15)):
   s.rect(x+(f-5),y,x+1+(f-5),y+1,FIRE[1])

def build_flame(level=10):
 s=spr(52,30,FIRE,[100,70,70,90,120,90,110,170])
 for f in range(1,9):fire_frame(s,f,level)
 return s

def save_runtime(name,s):
 d=RUNTIME/name
 if d.exists():shutil.rmtree(d)
 d.mkdir(parents=True)
 for i in range(1,s.n_frames+1):s.save_png(str(d/f"frame-{i-1:02d}.png"),frame=i,scale=1)
 s.save_gif(str(OUT/f"{name}-final.gif"),scale=6,bg="#22352c")
 s.save_spritesheet(str(OUT/f"{name}-spritesheet.png"),layout="horizontal",scale=1)

def cycle_sheet():
 from PIL import Image,ImageDraw
 scale=4;cw=76*scale;ch=(23+30)*scale+34
 sheet=Image.new("RGB",(cw*5,ch*2),(15,23,19));d=ImageDraw.Draw(sheet)
 for n in range(1,11):
  es=build_earth(n);fs=build_flame(n)
  es.save_gif(str(ITER/f"cycle-{n:02d}-earth.gif"),scale=3,bg="#22352c")
  fs.save_gif(str(ITER/f"cycle-{n:02d}-flame.gif"),scale=3,bg="#22352c")
  e=es.composite(5).resize((76*scale,23*scale),Image.Resampling.NEAREST)
  f=fs.composite(5).resize((52*scale,30*scale),Image.Resampling.NEAREST)
  cell=Image.new("RGBA",(cw,ch),(34,53,44,255));cell.alpha_composite(e,(0,0));cell.alpha_composite(f,(12*scale,23*scale))
  x=((n-1)%5)*cw;y=((n-1)//5)*ch;sheet.paste(cell.convert("RGB"),(x,y));d.text((x+8,y+ch-22),f"CYCLE {n:02d}",fill=(230,238,224))
 sheet.save(ITER/"ten-cycle-comparison.png")

def main():
 OUT.mkdir(parents=True,exist_ok=True);ITER.mkdir(parents=True,exist_ok=True);RUNTIME.mkdir(parents=True,exist_ok=True)
 earth=build_earth();flame=build_flame();save_runtime("earth-wave",earth);save_runtime("flame",flame);cycle_sheet()
 data={"earth":earth.stats(print_=False),"flame":flame.stats(print_=False)}
 (OUT/"stats.json").write_text(json.dumps(data,indent=2,default=str))
 print(ITER/"ten-cycle-comparison.png")
if __name__=="__main__":main()
