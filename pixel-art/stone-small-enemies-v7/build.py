from pathlib import Path
from PIL import Image, ImageDraw
import json
P=Path(__file__).resolve().parent
BG='#535256'
TOAD_PALETTE=['#100d15','#262330','#393746','#52505f','#777180','#999187','#656556','#95917b','#b7ad94','#e4d8b8','#92512a','#dda139']
SPIDER_PALETTE=['#100d15','#26212b','#39323c','#51464b','#6d5c50','#887661','#a48e70','#c0ad8b','#dfcc9f','#b0a799','#e7d9b7','#e4a337']

def rgb(h):return tuple(bytes.fromhex(h[1:]))
def snap(p,palette):
 if p[3]<128:return (0,0,0,0)
 return (*min([rgb(h) for h in palette],key=lambda c:sum((c[i]-p[i])**2 for i in range(3))),255)
def compact(im,cols,rows,offset):
 out=Image.new('RGBA',(32,32))
 for yy,y in enumerate(rows):
  for xx,x in enumerate(cols):out.putpixel((xx+offset[0],yy+offset[1]),im.getpixel((x,y)))
 return out

def toad():
 src=Image.open(P.parent/'ash-toad-reference-generated-v6/ash-toad-32.png').convert('RGBA')
 # Discrete edits to redundant back/body/jaw runs; eye and foot rows untouched.
 cols=[x for x in range(2,30) if x not in {10,17,27}]
 rows=[y for y in range(5,24) if y not in {13,18}]
 # Hound paws end at y=20; rows 21..23 are its baked ground shadow.
 return compact(src,cols,rows,(3,4))

def spider():
 src=Image.open(P/'dust-spider-source.png').convert('RGBA')
 # Read the coarse logical squares, do not filter a high-resolution painting.
 grid=Image.new('RGBA',(32,19))
 for y in range(19):
  for x in range(32):
   p=src.getpixel((round(145+(x+.5)*966/32),round(372+(y+.5)*564/19)))
   grid.putpixel((x,y),snap(p,SPIDER_PALETTE))
 grid.save(P/'spider-recovered-grid.png')
 cols=[x for x in range(32) if x not in {5,10,15,28}]
 return compact(grid,cols,list(range(19)),(2,2))

def preview(im,scale=8,bg=BG):
 b=Image.new('RGBA',im.size,bg);b.alpha_composite(im)
 return b.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)

def save(name,im):
 im.save(P/f'{name}-32.png');im.resize((256,256),Image.Resampling.NEAREST).save(P/f'{name}-8x-transparent.png');preview(im).save(P/f'{name}-8x.png')

def main():
 t=toad();s=spider();save('ash-toad',t);save('dust-spider',s)
 h=Image.open(P.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png').convert('RGBA')
 old=Image.open(P.parent/'ash-toad-reference-generated-v6/ash-toad-32.png').convert('RGBA')
 items=[('ASH HOUND / REFERENCE',h),('ASH TOAD / SMALLER',t),('DUST SPIDER / NEW',s)]
 sheet=Image.new('RGB',(816,350),'#29282d');d=ImageDraw.Draw(sheet)
 for i,(name,im) in enumerate(items):
  sheet.paste(preview(im),(i*272+8,34));d.text((i*272+8,10),name,fill='white');sheet.paste(preview(im,1),(i*272+70,310));sheet.paste(preview(im,1,bg='#222634'),(i*272+125,310));sheet.paste(preview(im,1,bg='#b0a99b'),(i*272+180,310))
 sheet.save(P/'lineup.png')
 comp=Image.new('RGB',(816,300),'#29282d');d=ImageDraw.Draw(comp)
 for i,(name,im) in enumerate([('ASH HOUND',h),('TOAD / PREVIOUS',old),('TOAD / SMALLER',t)]):
  comp.paste(preview(im),(i*272+8,32));d.text((i*272+8,10),name,fill='white')
 comp.save(P/'toad-size-comparison.png')
 report={}
 for name,im in items:
  pix=list(im.get_flattened_data());b=im.getchannel('A').getbbox()
  report[name]={'canvas':im.size,'bounds':b,'visible_size':[b[2]-b[0],b[3]-b[1]],'opaque':sum(p[3]>0 for p in pix),'colors':len({p[:3] for p in pix if p[3]})}
 (P/'report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':main()
