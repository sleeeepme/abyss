#!/usr/bin/env python3
import json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from extract_v2 import ROOT, read_png

def main():
    manifest=json.loads((ROOT/"sprites.json").read_text())
    errors=[]
    for name,s in manifest["sprites"].items():
        path=ROOT/s["file"]
        if not path.exists(): errors.append(f"missing: {name}"); continue
        w,h,bpp,rows=read_png(path)
        if bpp!=4: errors.append(f"not RGBA: {name}")
        alphas=[a for row in rows for a in row[3::4]]
        if not any(a==0 for a in alphas): errors.append(f"no transparent pixels: {name}")
        if not any(a>200 for a in alphas): errors.append(f"no opaque artwork: {name}")
        if (w,h)!=(s["w"],s["h"]): errors.append(f"size mismatch: {name}")
    if len(manifest["sprites"])!=65: errors.append("sprite count mismatch")
    if errors:
        print("FAIL\n"+"\n".join(errors)); return 1
    cats={}
    for s in manifest["sprites"].values(): cats[s["category"]]=cats.get(s["category"],0)+1
    print(f"PASS: 65 individual RGBA PNGs; transparent background; categories={cats}")
    return 0

if __name__=="__main__": raise SystemExit(main())
