from pathlib import Path
from PIL import Image, ImageDraw
import json
P=Path(__file__).resolve().parent
palette=['#100d15','#262330','#393746','#52505f','#777180','#999187','#656556','#95917b','#b7ad94','#e4d8b8','#92512a','#dda139']
colors=[tuple(bytes.fromhex(c[1:])) for c in palette]
g=Image.open(P/'recovered-grid.png').convert('RGBA')
# Remove selected redundant columns from long thigh/body/jaw runs on the
# recovered logical grid. This is a discrete compacting edit, not image scaling.
removed={3,7,12,15,18,21,29,33}
cols=[x for x in range(36) if x not in removed]
rows=[y for y in range(20) if y!=12]
out=Image.new('RGBA',(32,32))
for yy,y in enumerate(rows):
 for xx,x in enumerate(cols):
  v=g.getpixel((x,y))
  if v[3]:
   rgb=min(colors,key=lambda c:sum((c[i]-v[i])**2 for i in range(3)))
   out.putpixel((xx+2,yy+5),(*rgb,255))
# Selected pixel corrections: preserve the eye symbol after grid extraction.
d=ImageDraw.Draw(out)
d.point((23,9),fill=palette[11]);d.point((23,10),fill=palette[10])
out.save(P/'ash-toad-32.png')
bg=Image.new('RGBA',(32,32),'#535256');bg.alpha_composite(out)
bg.resize((256,256),Image.Resampling.NEAREST).save(P/'ash-toad-8x.png')
items=[('ASH HOUND',P.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png'),('CRAWLING DEAD',P.parent/'stone-benchmark-v2/crawling-dead-32.png'),('ASH TOAD / NEW',P/'ash-toad-32.png')]
sheet=Image.new('RGB',(816,320),'#29282d');sd=ImageDraw.Draw(sheet)
for i,(name,path) in enumerate(items):
 im=Image.open(path).convert('RGBA'); b=Image.new('RGBA',(32,32),'#535256');b.alpha_composite(im)
 sheet.paste(b.convert('RGB').resize((256,256),Image.Resampling.NEAREST),(i*272+8,32));sd.text((i*272+8,10),name,fill='white')
 sheet.paste(b.convert('RGB'),(i*272+120,288))
sheet.save(P/'comparison.png')
a=out.getchannel('A');pix=list(out.get_flattened_data())
(P/'report.json').write_text(json.dumps({'size':out.size,'bounds':a.getbbox(),'opaque':sum(p[3]>0 for p in pix),'colors':len({p[:3] for p in pix if p[3]}),'method':'reference-conditioned ImageGen coarse sprite; recovered 36x20 logical grid; removed eight selected columns and one row; palette cleanup and eye edit'},indent=2))
