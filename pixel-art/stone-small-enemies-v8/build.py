from pathlib import Path
from collections import deque
import json
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent
PREV=P.parent/'stone-small-enemies-v7'
OUT=(16,13,21,255)

def compact(im,drop_x,drop_y,offset):
 b=im.getchannel('A').getbbox(); xs=[x for x in range(b[0],b[2]) if x not in drop_x];ys=[y for y in range(b[1],b[3]) if y not in drop_y]
 out=Image.new('RGBA',(32,32))
 for j,y in enumerate(ys):
  for i,x in enumerate(xs):out.putpixel((i+offset[0],j+offset[1]),im.getpixel((x,y)))
 return out

def seal_outline(im):
 # Darken the EXISTING inside edge only. Never dilate the mask: preserves the
 # one-pixel line and limb gaps, avoiding the previously rejected thick outline.
 src=im.copy(); fixed=[]
 for y in range(32):
  for x in range(32):
   p=src.getpixel((x,y))
   if not p[3]:continue
   if any(not(0<=xx<32 and 0<=yy<32) or not src.getpixel((xx,yy))[3] for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):
    if p!=OUT:fixed.append((x,y))
    im.putpixel((x,y),OUT)
 return fixed

def toad():
 src=Image.open(PREV/'ash-toad-32.png').convert('RGBA')
 im=compact(src,{10,14,22},{11,17},(5,6))
 # Keep the eye readable at 1x after the face loses a column. Its two-pixel
 # vertical amber cluster stays inside the existing dark eyelid.
 for xy in [(21,10),(21,11)]:im.putpixel(xy,(239,181,75,255))
 fixed=seal_outline(im)
 return im,fixed

def spider():
 src=Image.open(PREV/'dust-spider-32.png').convert('RGBA')
 im=compact(src,{8,12,17,21},{5,9,18},(4,5))
 # Dust still identifies the creature, but dark plum structure dominates as in
 # Tiny RPG. Four beige gradient steps collapse into larger shadow/base masses.
 remap={'#100d15':'#100d15','#26212b':'#221b29','#39323c':'#39323f',
 '#51464b':'#50424b','#6d5c50':'#60535c','#887661':'#70665d',
 '#a48e70':'#8f8270','#c0ad8b':'#b1a087','#dfcc9f':'#cabb9a',
 '#b0a799':'#8f8270','#e7d9b7':'#ded0ad','#e4a337':'#d99a3b'}
 for y in range(32):
  for x in range(32):
   p=im.getpixel((x,y))
   if p[3]:
    h='#%02x%02x%02x'%p[:3];im.putpixel((x,y),(*bytes.fromhex(remap[h][1:]),255))
 fixed=seal_outline(im)
 return im,fixed

def show(im,n=8,bg='#535256'):
 out=Image.new('RGBA',im.size,bg);out.alpha_composite(im)
 return out.convert('RGB').resize((im.width*n,im.height*n),Image.Resampling.NEAREST)

def stats(im):
 b=im.getchannel('A').getbbox();pix=list(im.get_flattened_data());gaps=[]
 for y in range(32):
  for x in range(32):
   p=im.getpixel((x,y))
   if p[3] and any(not(0<=xx<32 and 0<=yy<32) or not im.getpixel((xx,yy))[3] for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):
    if p!=OUT:gaps.append((x,y))
 return {'bounds':b,'visible_size':(b[2]-b[0],b[3]-b[1]),'opaque':sum(p[3]>0 for p in pix),'colors':len({p[:3] for p in pix if p[3]}),'alpha':sorted({p[3] for p in pix}),'unoutlined_boundary_pixels':gaps}

def main():
 report={};out={}
 for name,fn in [('ash-toad',toad),('dust-spider',spider)]:
  im,fixes=fn();out[name]=im;im.save(P/(name+'-32.png'));show(im).save(P/(name+'-8x.png'))
  im.resize((256,256),Image.Resampling.NEAREST).save(P/(name+'-8x-transparent.png'))
  report[name]={'previous':stats(Image.open(PREV/(name+'-32.png')).convert('RGBA')),'new':stats(im),'edge_repairs':fixes}
 h=Image.open(P.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png').convert('RGBA')
 items=[('ASH HOUND / REFERENCE',h),('ASH TOAD / SMALLER',out['ash-toad']),('DUST SPIDER / REVISED',out['dust-spider'])]
 board=Image.new('RGB',(816,352),'#29282d');d=ImageDraw.Draw(board)
 for i,(name,im) in enumerate(items):
  board.paste(show(im),(i*272+8,32));d.text((i*272+8,10),name,fill='white')
  for j,bg in enumerate(['#535256','#222634','#b0a99b']):board.paste(show(im,1,bg),(i*272+64+j*58,306))
 board.save(P/'lineup.png')
 board=Image.new('RGB',(1088,302),'#29282d');d=ImageDraw.Draw(board)
 for i,(name,im) in enumerate([('TOAD / PREVIOUS',Image.open(PREV/'ash-toad-32.png')),('TOAD / NEW',out['ash-toad']),('SPIDER / PREVIOUS',Image.open(PREV/'dust-spider-32.png')),('SPIDER / NEW',out['dust-spider'])]):
  board.paste(show(im),(i*272+8,32));d.text((i*272+8,10),name,fill='white')
 board.save(P/'before-after.png')
 (P/'quality/report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':main()
