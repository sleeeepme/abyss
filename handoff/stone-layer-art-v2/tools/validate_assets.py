#!/usr/bin/env python3
import json, struct, sys, zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"delivery"
ALLOWED={"#110a2e","#856a95","#7b5e8b","#5f4a77","#463562","#2d1f4c","#0e062a","#12324a","#173a53","#2f7d86","#fce19e","#f2ad3b","#d47713","#f4d9b7","#e6c9b6","#8a7579","#69612a","#5f5534"}

def png_info(path):
    data=path.read_bytes(); pos=8; ids=b""; w=h=ct=None
    while pos<len(data):
        n=struct.unpack(">I",data[pos:pos+4])[0]; k=data[pos+4:pos+8]; d=data[pos+8:pos+8+n]; pos+=12+n
        if k==b"IHDR": w,h,depth,ct,_,_,inter=struct.unpack(">IIBBBBB",d); assert depth==8 and ct==6 and inter==0
        elif k==b"IDAT": ids+=d
        elif k==b"IEND": break
    raw=zlib.decompress(ids); stride=w*4; rows=[]; p=0; prev=bytearray(stride)
    def paeth(a,b,c):
        q=a+b-c; ds=[abs(q-a),abs(q-b),abs(q-c)]; return (a,b,c)[ds.index(min(ds))]
    for _ in range(h):
        f=raw[p]; p+=1; scan=raw[p:p+stride]; p+=stride; row=bytearray(stride)
        for i,v in enumerate(scan):
            l=row[i-4] if i>=4 else 0; u=prev[i]; ul=prev[i-4] if i>=4 else 0
            pred=(0,l,u,(l+u)//2,paeth(l,u,ul))[f]; row[i]=(v+pred)&255
        rows.append(row); prev=row
    colors=set(); alphas=set()
    for row in rows:
        for i in range(0,len(row),4):
            r,g,b,a=row[i:i+4]; alphas.add(a)
            if a: colors.add(f"#{r:02x}{g:02x}{b:02x}")
    return w,h,colors,alphas

def main():
    meta=json.loads((OUT/"atlas.json").read_text()); errors=[]
    walls=list((OUT/"tiles/wall").glob("wall_[01][01][01][01]_[abc].png"))
    if len(walls)!=48: errors.append(f"wall count {len(walls)} != 48")
    for path in sorted(OUT.rglob("*.png")):
        w,h,colors,alphas=png_info(path)
        if not alphas <= {0,255}: errors.append(f"{path}: intermediate alpha {alphas}")
        if not colors <= ALLOWED: errors.append(f"{path}: illegal colors {sorted(colors-ALLOWED)}")
        if path.name!="atlas.png" and not ((w%16==0 and h%16==0) or (path.parent.name=="wall" and w==16 and h==20)):
            errors.append(f"{path}: illegal size {w}x{h}")
    aw,ah,_,_=png_info(OUT/"atlas.png")
    for name,s in meta["sprites"].items():
        if s["x"]<0 or s["y"]<0 or s["x"]+s["w"]>aw or s["y"]+s["h"]>ah: errors.append(f"{name}: outside atlas")
    if errors:
        print("FAIL\n"+"\n".join(errors)); return 1
    print(f"PASS: 48 wall tiles, {len(meta['sprites'])} sprites, RGBA binary alpha, palette valid, atlas {aw}x{ah}")
    return 0

if __name__=="__main__": sys.exit(main())
