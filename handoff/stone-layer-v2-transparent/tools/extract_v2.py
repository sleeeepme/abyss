#!/usr/bin/env python3
"""Extract the approved v2 presentation sheet into separate transparent PNGs."""

import binascii, json, math, shutil, struct, zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"source/stone-layer-sprite-sheet-v2.png"
OUT=ROOT/"sprites"
PNG=b"\x89PNG\r\n\x1a\n"

# name, category, source crop (x0,y0,x1,y1)
CROPS=[
 ("wall_single","wall",(35,35,135,155)),
 ("wall_run_01","wall",(145,35,400,155)),
 ("wall_run_02","wall",(400,35,665,155)),
 ("wall_run_03","wall",(660,35,870,155)),
 ("wall_run_04","wall",(865,35,1145,155)),
 ("wall_run_05","wall",(1135,35,1510,155)),
 ("wall_corner_01","wall",(35,175,215,345)),
 ("wall_corner_02","wall",(225,175,400,345)),
 ("wall_corner_03","wall",(400,175,585,345)),
 ("wall_corner_04","wall",(575,175,755,345)),
 ("wall_corner_05","wall",(745,175,925,345)),
 ("wall_arch","wall",(920,165,1125,350)),
 ("wall_broken_tall","wall",(1105,175,1275,345)),
 ("wall_broken_wide","wall",(1265,175,1520,345)),
 ("wall_block_01","wall",(35,350,220,500)),
 ("wall_block_02","wall",(225,350,395,500)),
 ("wall_block_03","wall",(400,350,570,500)),
 ("wall_rubble_01","wall",(585,350,780,505)),
 ("wall_rubble_02","wall",(770,350,945,505)),
 ("wall_rubble_03","wall",(930,350,1110,505)),
 ("stone_loose_01","wall",(1110,365,1210,495)),
 ("stone_loose_02","wall",(1205,370,1325,495)),
 ("brazier_unlit","brazier",(45,500,190,660)),
 ("brazier_small_flame","brazier",(205,490,370,660)),
 ("brazier_large_flame","brazier",(385,475,525,660)),
 ("puddle_01","puddle",(555,550,630,650)),
 ("puddle_02","puddle",(635,535,775,650)),
 ("puddle_03","puddle",(790,520,940,655)),
 ("puddle_04","puddle",(955,505,1145,655)),
 ("puddle_05","puddle",(1170,500,1495,655)),
 ("bone_skull","bone",(40,660,150,805)),
 ("bone_ribs","bone",(145,650,275,805)),
 ("bone_long_01","bone",(270,660,385,805)),
 ("bone_long_02","bone",(385,660,470,805)),
 ("bone_chip","bone",(460,660,525,805)),
 ("bone_crossed_01","bone",(510,660,630,805)),
 ("bone_crossed_02","bone",(600,660,735,805)),
 ("bone_skeleton","bone",(710,650,885,805)),
 ("web_01","web",(885,650,1025,815)),
 ("web_02","web",(1010,650,1160,815)),
 ("web_03","web",(1140,650,1320,815)),
 ("web_04","web",(1300,650,1515,815)),
 ("grass_01","vegetation",(35,785,130,900)),
 ("grass_02","vegetation",(125,785,220,900)),
 ("grass_03","vegetation",(215,785,330,900)),
 ("grass_04","vegetation",(320,785,435,900)),
 ("grass_05","vegetation",(420,785,555,900)),
 ("grass_06","vegetation",(540,785,665,900)),
 ("grass_07","vegetation",(650,785,790,900)),
 ("grass_08","vegetation",(775,785,920,900)),
 ("moss_patch_01","vegetation",(1040,785,1200,900)),
 ("moss_patch_02","vegetation",(1180,785,1340,900)),
 ("moss_01","vegetation",(45,885,110,990)),
 ("moss_02","vegetation",(90,885,175,990)),
 ("moss_03","vegetation",(175,885,250,990)),
 ("moss_04","vegetation",(260,885,355,990)),
 ("moss_05","vegetation",(340,885,435,990)),
 ("moss_06","vegetation",(445,885,525,990)),
 ("moss_07","vegetation",(510,885,600,990)),
 ("moss_08","vegetation",(600,885,740,990)),
 ("moss_09","vegetation",(725,885,820,990)),
 ("moss_10","vegetation",(880,885,1035,990)),
 ("moss_11","vegetation",(1050,885,1170,990)),
 ("moss_12","vegetation",(1240,885,1345,990)),
 ("moss_13","vegetation",(1340,885,1460,990)),
]

def chunk(k,d): return struct.pack(">I",len(d))+k+d+struct.pack(">I",binascii.crc32(k+d)&0xffffffff)
def paeth(a,b,c):
 p=a+b-c; ds=(abs(p-a),abs(p-b),abs(p-c)); return (a,b,c)[ds.index(min(ds))]

def read_png(path):
 data=path.read_bytes(); pos=8; ids=b""; w=h=ct=None
 while pos<len(data):
  n=struct.unpack(">I",data[pos:pos+4])[0]; k=data[pos+4:pos+8]; d=data[pos+8:pos+8+n]; pos+=12+n
  if k==b"IHDR": w,h,depth,ct,_,_,inter=struct.unpack(">IIBBBBB",d); assert depth==8 and ct in (2,6) and inter==0
  elif k==b"IDAT": ids+=d
  elif k==b"IEND": break
 bpp=3 if ct==2 else 4; stride=w*bpp; raw=zlib.decompress(ids); p=0; prev=bytearray(stride); rows=[]
 for _ in range(h):
  f=raw[p]; p+=1; scan=raw[p:p+stride]; p+=stride; row=bytearray(stride)
  for i,v in enumerate(scan):
   l=row[i-bpp] if i>=bpp else 0; u=prev[i]; ul=prev[i-bpp] if i>=bpp else 0
   pred=(0,l,u,(l+u)//2,paeth(l,u,ul))[f]; row[i]=(v+pred)&255
  rows.append(row); prev=row
 return w,h,bpp,rows

def write_png(path,w,h,pixels):
 raw=bytearray()
 for row in pixels: raw.append(0); [raw.extend(px) for px in row]
 ihdr=struct.pack(">IIBBBBB",w,h,8,6,0,0,0)
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_bytes(PNG+chunk(b"IHDR",ihdr)+chunk(b"IDAT",zlib.compress(bytes(raw),9))+chunk(b"IEND",b""))

def alpha_for(r,g,b):
 # v2背景は#110a2e付近の緩いグラデーション。色距離で透明度を作り、元絵の縁を保持する。
 bg=(17,10,46); d=math.sqrt(sum((v-bg[i])**2 for i,v in enumerate((r,g,b))))
 if d<=13:return 0
 if d>=32:return 255
 return int((d-13)/19*255)

def extract(rows,bpp,box):
 x0,y0,x1,y1=box; out=[]
 for y in range(y0,y1):
  line=[]
  for x in range(x0,x1):
   i=x*bpp; r,g,b=rows[y][i:i+3]; a=alpha_for(r,g,b); line.append((r,g,b,a))
  out.append(line)
 # Trim transparent margins while leaving 2px padding.
 xs=[]; ys=[]
 for y,row in enumerate(out):
  for x,px in enumerate(row):
   if px[3]>8: xs.append(x); ys.append(y)
 if not xs:return [[(0,0,0,0)]]
 xa=max(0,min(xs)-2); xb=min(len(out[0]),max(xs)+3); ya=max(0,min(ys)-2); yb=min(len(out),max(ys)+3)
 return [row[xa:xb] for row in out[ya:yb]]

def main():
 w,h,bpp,rows=read_png(SRC); assert (w,h)==(1536,1024)
 if OUT.exists():shutil.rmtree(OUT)
 manifest={"source":str(SRC.relative_to(ROOT)),"sourceSize":{"w":w,"h":h},"background":"removed from approved v2 RGB sheet","sprites":{}}
 for name,cat,box in CROPS:
  pix=extract(rows,bpp,box); oh=len(pix); ow=len(pix[0]); rel=Path(cat)/f"{name}.png"
  write_png(OUT/rel,ow,oh,pix)
  manifest["sprites"][name]={"file":str(Path("sprites")/rel),"category":cat,"w":ow,"h":oh,"sourceCrop":{"x":box[0],"y":box[1],"w":box[2]-box[0],"h":box[3]-box[1]}}
 (ROOT/"sprites.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
 print(f"extracted {len(CROPS)} transparent sprites from {w}x{h} v2 source")

if __name__=="__main__":main()
