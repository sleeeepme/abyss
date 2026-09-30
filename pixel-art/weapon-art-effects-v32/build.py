#!/usr/bin/env python3
"""Direct pixel extraction of the user-supplied reference flame."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math,shutil

HERE=Path(__file__).resolve().parent;OUT=HERE/"generated";REF=HERE/"reference"
RUNTIME=HERE.parents[1]/"proto"/"assets"/"effects"/"weapon-art-v32"/"flame"
SOURCE=REF/"source.jpg"
PALETTE=[(190,0,0,255),(233,48,0,255),(255,145,0,255),(255,244,42,255),(255,255,250,255)]
BG=(4,51,71)

def is_fire(rgb):
 r,g,b=rgb
 return (r>100 and r>g*1.45 and r>b*1.5) or (r>180 and g>100 and b<190) or (r>220 and g>220 and b>200)
def nearest(rgb):
 r,g,b=rgb
 return min(PALETTE,key=lambda p:(r-p[0])**2+(g-p[1])**2+(b-p[2])**2)
def extract(logical,box,name):
 crop=logical.crop(box);out=Image.new("RGBA",crop.size,(0,0,0,0))
 for y in range(crop.height):
  for x in range(crop.width):
   rgb=crop.getpixel((x,y))
   if is_fire(rgb):out.putpixel((x,y),nearest(rgb))
 # Trim only empty columns/rows. Every retained coloured pixel is copied.
 alpha=out.getchannel("A").getbbox();out=out.crop(alpha);out.save(REF/f"{name}.png")
 return out
def place(canvas,sprite,cx,base,dx=0):
 canvas.alpha_composite(sprite,(round(cx-sprite.width/2+dx),base-sprite.height))

def main():
 OUT.mkdir(parents=True,exist_ok=True);REF.mkdir(parents=True,exist_ok=True)
 logical=Image.open(SOURCE).convert("RGB").resize((110,110),Image.Resampling.NEAREST)
 # These boxes contain only the three fire forms visible in the supplied image.
 small=extract(logical,(36,67,40,77),"small")
 medium=extract(logical,(58,50,67,63),"medium")
 large=extract(logical,(44,44,55,64),"large")
 shapes=[small,small,medium,medium,large,large,medium,large,medium,large,large,medium,medium,small,small]
 shifts=[0,0,0,0,0,-1,1,0,-1,0,1,0,0,0,0]
 frames=[]
 for i,(shape,dx) in enumerate(zip(shapes,shifts)):
  im=Image.new("RGBA",(32,28),(0,0,0,0));place(im,shape,16,25,dx);frames.append(im)
 # Final frame keeps only the exact detached sparks from the large source.
 spark=Image.new("RGBA",(32,28),(0,0,0,0))
 for x,y in [(14,5),(15,8),(18,4),(19,3),(21,5)]:spark.putpixel((x,y),PALETTE[0])
 frames.append(spark)
 if RUNTIME.exists():shutil.rmtree(RUNTIME)
 RUNTIME.mkdir(parents=True)
 for i,im in enumerate(frames):im.save(RUNTIME/f"frame-{i:02d}.png")
 durations=[70,70,70,70,70,70,70,70,70,70,70,80,80,90,100,150]
 scaled=[im.resize((192,168),Image.Resampling.NEAREST) for im in frames];gif=[]
 for im in scaled:
  bg=Image.new("RGBA",im.size,(4,51,71,255));bg.alpha_composite(im);gif.append(bg.convert("P",palette=Image.Palette.ADAPTIVE,colors=32))
 gif[0].save(OUT/"flame-reference-copy.gif",save_all=True,append_images=gif[1:],duration=durations,loop=0,optimize=False,disposal=2)
 sheet=Image.new("RGB",(32*8*6,28*2*6+32*2),(4,51,71));d=ImageDraw.Draw(sheet)
 for i,im in enumerate(frames):
  x=i%8*32*6;y=i//8*(28*6+32);big=im.resize((192,168),Image.Resampling.NEAREST);sheet.paste(big,(x,y),big);d.text((x+4,y+173),f"F{i:02d}",fill=(255,255,255))
 sheet.save(OUT/"all-frames.png")
 used=sorted({px for im in frames for px in im.getdata() if px[3]})
 (OUT/"stats.json").write_text(json.dumps({"frames":len(frames),"size":[32,28],"colors_used":len(used),"source_logical_size":[110,110],"durations":durations},indent=2))
if __name__=="__main__":main()
