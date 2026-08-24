#!/usr/bin/env python3
"""Generate the native-resolution Stone Layer delivery pack (stdlib only)."""

from __future__ import annotations

import binascii
import json
import os
import shutil
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "delivery"
TILES = OUT / "tiles"

P = {
    "floor": "#110a2e", "stone_top": "#856a95", "stone": "#7b5e8b",
    "shadow1": "#5f4a77", "shadow2": "#463562", "shadow3": "#2d1f4c",
    "outline": "#0e062a", "water": "#12324a", "water_edge": "#173a53",
    "water_glint": "#2f7d86", "fire_core": "#fce19e", "fire_mid": "#f2ad3b",
    "fire_outer": "#d47713", "bone_hi": "#f4d9b7", "bone": "#e6c9b6",
    "bone_shadow": "#8a7579", "grass": "#69612a", "moss": "#5f5534",
}


def rgba(hex_color, a=255):
    s = hex_color.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


class Img:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.p = [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = rgba(P[c]) if isinstance(c, str) else c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): self.set(xx, yy, c)

    def line(self, x0, y0, x1, y1, c):
        dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy

    def save(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = bytearray()
        for row in self.p:
            raw.append(0)
            for px in row: raw.extend(px)
        ihdr = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        data = PNG + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
        path.write_bytes(data)

    def paste(self, src, ox, oy):
        for y, row in enumerate(src.p):
            for x, px in enumerate(row):
                if px[3]: self.set(ox + x, oy + y, px)


PNG = b"\x89PNG\r\n\x1a\n"


def chunk(kind, data):
    crc = binascii.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", crc)


def wall(mask, variant):
    # Bit order in the filename is N/E/S/W.
    n, e, s, w = (bit == "1" for bit in mask)
    im = Img(16, 20)
    solid = [[False] * 16 for _ in range(20)]
    top = 5 + ((int(mask, 2) * 5 + variant * 3) % 3) - 1
    left = 2 + ((variant + int(mask, 2)) % 2)
    right = 13 - ((variant * 2 + int(mask, 2)) % 2)

    def fill(x0, y0, x1, y1):
        for yy in range(max(0, y0), min(20, y1 + 1)):
            for xx in range(max(0, x0), min(16, x1 + 1)): solid[yy][xx] = True

    fill(left, top, right, 18)
    if n: fill(5 - variant % 2, 0, 10 + (variant + 1) % 2, 10)
    if e: fill(8, 7 + variant % 2, 15, 17)
    if s: fill(5, 10, 10 + variant % 2, 19)
    if w: fill(0, 7 + (variant + 1) % 2, 8, 17)

    # Small silhouette chips make variants visibly different without crossing L/R/bottom.
    chips = [((3, top),), ((12, top), (3, top + 1)), ((4, top), (11, top + 1))][variant]
    if not n:
        for x, y in chips:
            if 0 <= y < 20: solid[y][x] = False

    for y in range(20):
        for x in range(16):
            if not solid[y][x]: continue
            boundary = any(nx < 0 or ny < 0 or nx >= 16 or ny >= 20 or not solid[ny][nx]
                           for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
            color = "outline" if boundary else ("shadow2" if y >= 17 else "stone")
            im.set(x, y, color)

    # Flat stone faces and restrained joints.
    for x in range(left + 1, right):
        if top + 1 < 19 and solid[top + 1][x]: im.set(x, top + 1, "stone_top")
    joint_y = 11 + variant
    for x in range(1, 15):
        if solid[joint_y][x] and solid[joint_y + 1][x]: im.set(x, joint_y, "shadow3")
    joint_x = [6, 9, 7][variant]
    for y in range(max(top + 2, 7), 18):
        if solid[y][joint_x] and solid[y][joint_x + 1]: im.set(joint_x, y, "shadow3")
    return im


def puddle(i):
    im = Img(16, 16)
    shapes = [
        [(6, 8, 4, 2)],
        [(4, 7, 8, 3), (6, 6, 4, 1)],
        [(3, 6, 10, 5), (5, 5, 5, 1)],
        [(2, 5, 12, 7), (4, 4, 7, 1), (5, 12, 5, 1)],
        [(1, 5, 14, 7), (3, 4, 5, 1), (9, 12, 4, 1)],
    ][i - 1]
    for x, y, w, h in shapes: im.rect(x, y, w, h, "water_edge")
    for y in range(16):
        for x in range(16):
            if im.p[y][x][3] and 1 < x < 14 and 4 < y < 13: im.set(x, y, "water")
    glints = [(7, 8), (5, 8), (9, 7), (5, 7), (11, 9)][:max(1, min(3, i))]
    for x, y in glints: im.set(x, y, "water_glint")
    return im


def bone(name):
    im = Img(32 if name == "bone_skeleton" else 16, 16)
    c, hi, sh = "bone", "bone_hi", "bone_shadow"
    if name == "bone_skull":
        im.rect(5, 4, 6, 6, c); im.rect(6, 3, 4, 1, hi); im.rect(6, 10, 4, 2, c)
        im.set(6, 7, sh); im.set(9, 7, sh); im.set(8, 9, sh)
    elif name == "bone_ribs":
        im.line(8, 3, 8, 12, c)
        for y, span in ((5, 4), (7, 5), (9, 4)):
            im.line(8 - span, y, 7, y + 2, c); im.line(9, y + 2, 8 + span, y, c)
    elif name.startswith("bone_long"):
        if name.endswith("a"): im.line(4, 11, 12, 5, c); ends=((3,11),(12,4))
        else: im.line(4, 5, 12, 11, c); ends=((3,4),(12,11))
        for x,y in ends: im.rect(x,y,2,2,hi)
    elif name == "bone_chip":
        im.rect(6, 8, 4, 2, c); im.set(5, 7, hi); im.set(10, 9, sh)
    elif name == "bone_crossed":
        im.line(4, 5, 11, 11, c); im.line(11, 5, 4, 11, c)
    else:
        skull = bone("bone_skull"); im.paste(skull, 1, 0)
        im.line(12, 8, 23, 8, c)
        for x in (15,18,21): im.line(x, 8, x + 2, 12, c)
        im.line(23, 8, 29, 5, c); im.line(23, 9, 29, 12, c)
    return im


def web(variant):
    im = Img(16, 16); c="bone"
    im.line(1, 1, 14, 1, c); im.line(1, 1, 1, 14, c)
    for end in ((14, 14), (14, 6), (6, 14)): im.line(1, 1, *end, c)
    for k in range(4, 13, 4):
        im.line(1, k, k, 1, c)
        if variant: im.set(k, k, c)
    return im


def plant(kind, i):
    im=Img(16,16); c="grass" if kind=="grass" else "moss"
    if kind=="grass":
        base=8 + (i%2)
        im.line(base, 13, base, 7-(i%3), c)
        im.line(base-1, 12, 4+(i%2), 8, c); im.line(base+1, 12, 12-(i%2), 7+(i%2), c)
    else:
        spans=[(5,11,6),(3,10,10),(2,9,12),(4,8,9)][i-1]
        x,y,w=spans; im.rect(x,y,w,3,c); im.set(x-1,y+1,c); im.set(x+w,y+2,c)
    return im


def brazier_base():
    im=Img(16,16); im.rect(4,9,8,4,"shadow1"); im.rect(3,8,10,3,"outline")
    im.rect(4,8,8,2,"stone"); im.rect(5,11,6,3,"shadow2"); return im


def brazier_flame():
    im=Img(48,16)
    for f in range(3):
        ox=f*16; heights=[5,7,6]; h=heights[f]
        im.rect(ox+6, 12-h, 4, h, "fire_outer")
        im.set(ox+5, 10, "fire_outer"); im.set(ox+10, 9+(f%2), "fire_outer")
        im.rect(ox+7, 13-h, 3, h-1, "fire_mid"); im.rect(ox+7, 10, 2, 3, "fire_core")
    return im


def arch():
    im=Img(48,32)
    # Three-tile arch, flat and irregular.
    im.rect(2,13,10,19,"stone"); im.rect(36,13,10,19,"stone")
    im.rect(10,5,28,8,"stone"); im.rect(14,2,20,4,"stone_top")
    im.rect(13,10,22,22,"outline"); im.rect(16,10,16,22,(0,0,0,0))
    im.line(2,29,11,29,"shadow2"); im.line(36,29,45,29,"shadow2")
    return im


def rubble(i):
    im=Img(16,16); coords=[[(3,11,4,3),(9,9,3,4)],[(2,10,5,4),(9,12,4,2)],[(4,8,4,5),(10,11,3,3)],[(2,12,3,2),(7,9,5,5)]][i]
    for x,y,w,h in coords: im.rect(x,y,w,h,"shadow1"); im.line(x,y,x+w-1,y,"stone")
    return im


def main():
    if OUT.exists(): shutil.rmtree(OUT)
    sprites={}; images={}
    def add(name, img, group, anchor=0, frames=None, step=None):
        folder=TILES/group; path=folder/f"{name}.png"; img.save(path); images[name]=img
        sprites[name]={"file":str(path.relative_to(OUT)),"w":img.w,"h":img.h,"anchorY":anchor}
        if frames: sprites[name].update(frames=frames,step=step)

    for value in range(16):
        mask=f"{value:04b}"
        for vi,v in enumerate("abc"): add(f"wall_{mask}_{v}",wall(mask,vi),"wall",-4)
    add("wall_arch",arch(),"wall",0)
    for i in range(4): add(f"rubble_{chr(97+i)}",rubble(i),"wall")
    for i in range(1,6): add(f"puddle_{i}",puddle(i),"props")
    for n in ("bone_skull","bone_ribs","bone_long_a","bone_long_b","bone_chip","bone_crossed","bone_skeleton"): add(n,bone(n),"props")
    add("web_a",web(0),"props"); add("web_b",web(1),"props")
    for i in range(1,6): add(f"grass_{i}",plant("grass",i),"props")
    for i in range(1,5): add(f"moss_{i}",plant("moss",i),"props")
    add("brazier_base",brazier_base(),"brazier")
    add("brazier_flame",brazier_flame(),"brazier",frames=3,step=16)

    # Deterministic row pack with 1px padding.
    pad=1; maxw=256; x=y=pad; rowh=0; placements={}
    for name,img in images.items():
        if x+img.w+pad>maxw: x=pad; y+=rowh+pad; rowh=0
        placements[name]=(x,y); x+=img.w+pad; rowh=max(rowh,img.h)
    ah=y+rowh+pad; atlas=Img(maxw,ah)
    for name,img in images.items():
        x,y=placements[name]; atlas.paste(img,x,y)
        entry=sprites[name]; entry.update(x=x,y=y); entry.pop("file",None)
    atlas.save(OUT/"atlas.png")
    meta={"tile":16,"image":"atlas.png","palette":list(P.values()),"sprites":sprites,
          "groups":{"wall":{"autotile":"blob16","bitOrder":"NESW","variants":["a","b","c"]},
                    "puddle":[f"puddle_{i}" for i in range(1,6)],
                    "bone":["bone_skull","bone_ribs","bone_long_a","bone_long_b","bone_chip","bone_crossed","bone_skeleton"],
                    "web":["web_a","web_b"],"grass":[f"grass_{i}" for i in range(1,6)],
                    "moss":[f"moss_{i}" for i in range(1,5)],
                    "brazier":{"base":"brazier_base","flame":"brazier_flame"}}}
    (OUT/"atlas.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
    print(f"generated {len(images)} sprite files; atlas {atlas.w}x{atlas.h}")


if __name__ == "__main__": main()
