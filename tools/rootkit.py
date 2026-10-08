#!/usr/bin/env python3
"""根の層の部品集（キット）を、静止画（第3版・claude/root-mock/mock11.py）と同じ作り方で焼いて、本編へ渡す。

  python3 tools/rootkit.py [--preview 出力.png]
  → proto/root-kit.js（window.ROOT_KIT：部品の絵1枚＋目録）を書く

2026-10-07 ユーザー講評「まだコンセプトとディテール・焼きの形状が違う」→「全部そのまま（同じ3Dの焼きで）」。
本編の JS で根を育てて円筒を焼いていたのをやめ、静止画と同じ道具（tools/root3d.py：距離場の滑らかな和・
面をつかんで平たく・幾何の樹皮の溝・くぼみの暗さ）で部品を焼いておき、本編は部品を置くだけにする。

部品（どれも「型」の上で焼く。本編の部屋と同じ寸法なので、置けばそのまま噛み合う）：
  型：床の台 z∈[-18,0]、北の石積み 厚さ8・高さ24（天辺は6段で崩れる）、左右の低い石積み 厚さ8・高さ12、南の縁の崖18
  - wall_n*   北の石積みの帯（256ドット）。列ごとに独立なので好きな幅で切って使える
  - side_l/r  左右の低い石積みの帯（縦256ドット）、side_cap_l/r：南の端の前の面
  - cliff*    南の縁の崖の帯（256ドット）
  - pillar_*  角柱（高・中・折れ）
  - floor     石畳（256ドット四方・継ぎ目無し）、inlay：中央の菱形
  - drape_l/r 北の闇から石積みを越えて床へ広がる根
  - corner_l/r 角で石積みを越え、壁ぎわを下って横の石積みを越え、闇へ降りる根（部屋の深さ80ドット以上）
  - cradle    部屋の下から南の縁の下へ抜けて闇の底へ降りる根
  - grip      床から南の縁を越えて崖を降りる根
  - sidehang_l/r 横の石積みを越えて外へ垂れる根
  - hang      崖の下に垂れる細根
  - br_h/br_v 根を4本撚った橋（64ドットで継ぎ目無く繰り返す。撚りの位相は x+y で決まる）
  - knot      橋の曲がり角・交差の根の瘤
  - end_n/s/e/w 橋が部屋へ入る所（床の縁の下へ潜り、細い根が床へほどける）

1ドットの中身（RGBA）：R＝色の番号（石は KPAL、根は地の明るさ0〜63、輪郭は255）、G＝面の向き(0〜63)＋材質×64
（0石 1根 2根の苔 3床への陰）、B＝高さ z＋150、A＝くぼみの暗さ（1〜255、0は無し）。
"""
import sys, os, math, json, base64, io, random
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import root3d as R3

OUT_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'proto', 'root-kit.js')
def hx(s): s = s.lstrip('#'); return np.array([int(s[i:i+2], 16) for i in (0, 2, 4)], float)
STONE = ['#3b3536', '#5c524c', '#857664', '#a8977f', '#c2ae98', '#d3bfa8', '#e6d5c0']
MOSS = ['#26301a', '#3e4b22', '#5b6a2c', '#7c8a3a', '#9aa64a']
IVY = ['#1f3318', '#2f4a20', '#46662a', '#628436']
KPAL = STONE + MOSS + IVY                       # 0..6 石 / 7..11 苔 / 12..15 蔦
S_ = lambda k: k; M_ = lambda k: 7 + k; I_ = lambda k: 12 + k
WALL_D, WALL_H, SIDE_D, SIDE_H, CLIFF = 8, 24, 8, 12, 18
# JS と同じ NRM（黄金角の螺旋の64方向。[x, 上, 手前]）
_ga = math.pi * (3 - math.sqrt(5))
NRM = np.array([[math.cos(i * _ga) * math.sqrt(max(0, 1 - (1 - (i + .5) / 64 * 2) ** 2)), 1 - (i + .5) / 64 * 2,
                 math.sin(i * _ga) * math.sqrt(max(0, 1 - (1 - (i + .5) / 64 * 2) ** 2))] for i in range(64)])
def nidx(nx, ny, nz):          # 世界の法線（x, 手前y, 上z）→ 番号
    v = np.stack([nx, nz, ny], -1)
    return np.argmax(v @ NRM.T, -1)
N_UP = int(nidx(np.array(0.), np.array(0.), np.array(1.))); N_S = int(nidx(np.array(0.), np.array(1.), np.array(0.)))

# 継ぎ目の無い値ノイズ（256 周期）
def vnoiseP(cell, seed, P=256):
    r = np.random.default_rng(seed); n = P // cell; g = r.random((n, n))
    ys, xs = np.mgrid[0:P, 0:P] / cell; x0 = xs.astype(int); y0 = ys.astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = g[y0 % n, x0 % n]; b = g[y0 % n, (x0 + 1) % n]; c = g[(y0 + 1) % n, x0 % n]; d = g[(y0 + 1) % n, (x0 + 1) % n]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
N3, N4, N8, N16 = vnoiseP(4, 4), vnoiseP(4, 2), vnoiseP(8, 1), vnoiseP(16, 3)
def n_(N, x, y): return N[int(y) & 255, int(x) & 255]
def hsh(*a):
    h = 2166136261
    for v in a: h = ((h ^ (int(v) & 0xffffffff)) * 16777619) & 0xffffffff
    return h / 2**32
BAY = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + .5) / 16

# ---------------------------------------------------------------------------
# 部品の器：画面の座標で、色番号・面の向き・材質・高さ・暗さ・奥行き
# ---------------------------------------------------------------------------
class Part:
    def __init__(s, x0, y0, x1, y1):
        s.x0, s.y0 = x0, y0; s.W, s.H = x1 - x0, y1 - y0
        s.idx = np.zeros((s.H, s.W), int); s.nrm = np.zeros((s.H, s.W), int); s.mat = np.zeros((s.H, s.W), int)
        s.z = np.zeros((s.H, s.W)); s.ao = np.ones((s.H, s.W)); s.key = np.full((s.H, s.W), -1e9); s.has = np.zeros((s.H, s.W), bool)
    def put(s, X, Y, idx, wy, z, nrm, mat=0, ao=1.0):
        X, Y = int(round(X)) - s.x0, int(round(Y)) - s.y0
        if not (0 <= X < s.W and 0 <= Y < s.H): return
        k = wy + z
        if k < s.key[Y, X] - 1e-6: return
        s.key[Y, X] = k; s.idx[Y, X] = idx; s.nrm[Y, X] = nrm; s.mat[Y, X] = mat; s.z[Y, X] = z; s.ao[Y, X] = ao; s.has[Y, X] = True
    def outline(s, f=.4):
        """奥行きが跳ぶ所の奥側を暗く（静止画と同じ：dk>3 → ×0.4）"""
        K = np.where(s.has, s.key, -1e9); dk = np.zeros_like(K)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nb = np.full_like(K, -1e9)
            ys = slice(max(0, dy), s.H + min(0, dy)); yd = slice(max(0, -dy), s.H + min(0, -dy))
            xs = slice(max(0, dx), s.W + min(0, dx)); xd = slice(max(0, -dx), s.W + min(0, -dx))
            nb[yd, xd] = K[ys, xs]; dk = np.maximum(dk, nb - K)
        e = (dk > 3) & s.has
        s.ao = np.where(e & (s.mat == 0), s.ao * f, s.ao)
        s.idx = np.where(e & (s.mat >= 1) & (s.mat <= 2), 255, s.idx)
        return e

# ---------------------------------------------------------------------------
# 石の質感（静止画 mock11 と同じ規則）
# ---------------------------------------------------------------------------
def wall_front(x, wy, z, top, kind):
    row = int(z) // 6; jx = (x + row * 9 + (row * row * 5) % 11) % 15; zz = int(z) % 6
    if kind == 3: jx = 99; row = int(z) // 9; zz = int(z) % 9
    joint = zz == 5 or (zz != 5 and jx == 0)
    k = 2 if joint else (4 if zz == 4 else 3)
    if kind == 3 and not joint: k = 4 if zz >= 7 else 3
    c = S_(k)
    if n_(N4, x, wy - z) > .6 + z / top * .3 and z < top * .45: c = M_(1 + (n_(N3, x, wy - z) > .5))
    L = int(hsh(x // 2, 7) * top * 1.1) if hsh(x // 3, 11) > .72 else 0
    if top - z < L and n_(N3, x, wy - z * 2) > .35: c = I_(1 + int(hsh(x, int(z)) * 3)) if (x + int(z)) % 3 else I_(0)
    return c
def wall_top(x, wy, kind):
    c = S_(5) if (x + wy) % 13 else S_(3)
    if kind == 2 and (wy % 10 == 0 or x % 14 == 0): c = S_(3)
    if kind == 3: c = S_(5)
    if n_(N8, x, wy) > .68: c = M_(2 + (n_(N3, x, wy) > .55))
    elif n_(N4, x, wy) > .76: c = I_(2)
    return c
def cliff_tex(x, wy, d, D):
    row = d // 6; joint = d % 6 == 0 or (x + row * 7) % 14 == 0
    c = S_(1) if joint else S_(3 if d % 6 == 1 else 2)
    a = 1 - d / D * .55
    if n_(N4, x, wy + d) > .62 and d > 2: c = M_(1); a = 1 - d / D * .4
    return c, a

def part_wall_n(seed):
    """北の石積みの帯：x∈[0,256)、前の面が y=0。天辺は所々6段で崩れる"""
    P = Part(0, -(WALL_D + WALL_H + 2), 256, 1)
    r = random.Random(seed); prof = np.zeros(256, int)
    for x in range(256):
        v = n_(N16, x, seed * 37)
        prof[x] = WALL_H - (int((v - .58) * 50) // 6 * 6 if v > .58 else 0)
    for x in range(256):
        h = max(10, int(prof[x]))
        for y in range(-WALL_D, 0):
            P.put(x, y - h, wall_top(x, y + seed * 13, 2), y, h, N_UP)
        P.put(x, -WALL_D - h - 1, S_(0), -WALL_D, h + .5, N_UP)
        for z in range(h - 1, -1, -1):
            c = wall_front(x, seed * 13, z, h, 2)
            P.put(x, -z, c, 0, z, N_S, ao=.82 if c < 7 else 1.0)       # 前の面は ×0.82（静止画）
    P.outline(); return P
def part_side(side, seed):
    """左右の低い石積み：厚さ8、y∈[0,256)。所々低く崩れる（途切れない＝歩けない所はどこも壁）"""
    xb = -SIDE_D if side < 0 else 0
    P = Part(xb - 1, -SIDE_H - 2, xb + SIDE_D + 1, 256)
    for y in range(256):
        h = SIDE_H - (4 if n_(N4, 3 + seed * 7, y) > .62 else 0)
        for x in range(xb, xb + SIDE_D):
            fx = (x - xb) if side < 0 else (xb + SIDE_D - 1 - x)
            k = 5 if fx in (1, 2) else 4 if fx < 6 else 2
            if (y % 14) == 0: k = 2
            if fx == 0: k = 1
            c = S_(k)
            if n_(N4, x + seed * 11, y) > .62: c = M_(2 + (n_(N3, x, y) > .6))
            P.put(x, y - h, c, y, h, N_UP)
    P.outline(); return P
def part_side_cap(side):
    """左右の石積みの南の端の前の面（高さ12〜崖の底まで）"""
    xb = -SIDE_D if side < 0 else 0
    P = Part(xb, -SIDE_H - 1, xb + SIDE_D, CLIFF + 1)
    for x in range(xb, xb + SIDE_D):
        for z in range(SIDE_H - 1, -CLIFF - 1, -1):
            if z >= 0: c = wall_front(x, 0, z, SIDE_H, 2); a = .82
            else: c, a = cliff_tex(x, 0, -z, CLIFF)
            P.put(x, -z, c, 0, z, N_S, ao=a)
    P.outline(); return P
def part_cliff(seed):
    """南の縁の崖：x∈[0,256)、床の縁が y=0。崖は z∈[-18,0)"""
    P = Part(0, 0, 256, CLIFF + 1)
    for x in range(256):
        for d in range(1, CLIFF + 1):
            c, a = cliff_tex(x + seed * 31, 0, d, CLIFF)
            P.put(x, d, c, 0, -d, N_S, ao=a)
    return P
def part_pillar(h, broken=False, w=12, d=8):
    """角柱：原点は前の面の下の真ん中"""
    P = Part(-w // 2 - 1, -h - d - 6, w // 2 + 5, 4)
    top = -h
    for x in range(-w // 2, w // 2):
        fx = x + w // 2
        for z in range(h - 1, -1, -1):
            yy = h - 1 - z
            row = z // 9; zz = z % 9; joint = zz == 8
            k = 4 if fx < 3 else 3 if fx < w - 3 else 2
            if joint: k = max(1, k - 1)
            c = S_(k)
            if n_(N4, x * 3, z * 3) > .63: c = M_(2)
            a = .62 if fx >= w - 3 else 1.0
            if fx < 2 and c < 7: c = min(6, c + 1)                      # 左の2列は1段明るく（静止画の ×1.18）
            if fx == 0: c = S_(6)
            P.put(x, -z, c, 0, z, N_S, ao=a)
        for y in range(-d, 0):
            k = 6 if fx < w - 3 else 5
            if broken and n_(N3, x * 5, y * 5) > .55: k = 3
            P.put(x, y - h, S_(k), y, h, N_UP)
        P.put(x, -d - h - 1, S_(0), -d, h + .5, N_UP)
    P.outline(); return P
def part_floor():
    """石畳：256ドット四方・継ぎ目無し（8ドットの升を2〜3升の板に。苔の塊・目地の苔・割れ）"""
    P = Part(0, 0, 256, 256); r = random.Random(3); C = 8; n = 32
    own = -np.ones((n, n), int); info = []
    for gy in range(n):
        for gx in range(n):
            if own[gy, gx] >= 0: continue
            sw, sh = r.choice([(2, 2), (3, 2), (2, 2), (3, 2), (2, 1), (1, 2), (3, 3), (2, 3)])
            sw = min(sw, n - gx); sh = min(sh, n - gy)
            while sw > 1 and (own[gy, gx:gx + sw] >= 0).any(): sw -= 1
            while sh > 1 and (own[gy:gy + sh, gx:gx + sw] >= 0).any(): sh -= 1
            own[gy:gy + sh, gx:gx + sw] = len(info); info.append((gx * C, gy * C, sw * C, sh * C, r.random(), r.random()))
    for y in range(256):
        for x in range(256):
            sx, sy, sw, sh, v, v2 = info[own[y // C, x // C]]
            fx, fy = x - sx, y - sy; base = 4 if v > .35 else 3; k = base
            if fx == 0 or fy == 0: k = base - 2 if base == 4 else 2
            elif fx == 1 or fy == 1: k = base + 1
            elif fx == sw - 1 or fy == sh - 1: k = base - 1
            elif n_(N8, x, y) * .6 + n_(N3, x, y) * .4 > .68: k = base - 1
            c = S_(k)
            if v2 < .08 and abs((fx - fy * .9) - sw * .45) < .6 and 1 < fx < sw - 1 and 1 < fy < sh - 1: c = S_(1)
            if (fx == 0 or fy == 0) and n_(N8, x, y) > .62: c = M_(2 if n_(N3, x, y) > .5 else 1)
            mm = n_(N16, x, y) * .6 + n_(N3, x, y) * .4
            if mm > .7: c = M_(3 if n_(N3, x, y - 1) > .6 else 2)
            elif mm > .665 and BAY[y & 3, x & 3] < .5: c = M_(1)
            P.put(x, y, c, y, 0, N_UP)
    return P
def part_inlay():
    """中央の菱形の象嵌（静止画と同じ）。原点が中心。線の所だけ"""
    P = Part(-36, -28, 37, 29)
    for y in range(-28, 29):
        for x in range(-36, 37):
            d = abs(x) + abs(y) * 1.3
            if 30 <= d < 34: c = S_(6) if 31 <= d < 33 else S_(2)
            elif d < 30 and abs(d - 16) < .6: c = S_(2)
            elif d < 4: c = S_(6) if d < 2.5 else S_(2)
            else: continue
            P.put(x, y, c, y, 0, N_UP)
    return P

# ---------------------------------------------------------------------------
# 根：型の部屋の上で root3d で育てて焼く
# ---------------------------------------------------------------------------
class Template:
    """型：床の台 x∈[0,RW) y∈[0,RD)。北の石積み・左右の低い石積み・南の縁の崖"""
    def __init__(s, RW=160, RD=128, room=True, bridge=None, bounds=None):
        s.RW, s.RD = RW, RD
        s.gx0, s.gy0, s.gz0 = -90, -100, -200
        s.nx, s.ny, s.nz = RW + 180, RD + 300, 290
        if bounds: s.gx0, s.gy0, s.gz0, s.nx, s.ny, s.nz = bounds
        s.g = R3.Grid(s.gx0, s.gy0, s.gz0, s.nx, s.ny, s.nz, 1.0)
        occ = np.zeros((s.nz, s.ny, s.nx), bool)
        def box(x0, y0, z0, x1, y1, z1):
            occ[max(0, z0 - s.gz0):max(0, z1 - s.gz0), max(0, y0 - s.gy0):max(0, y1 - s.gy0), max(0, x0 - s.gx0):max(0, x1 - s.gx0)] = True
        s.box = box
        if room:
            box(0, 0, -CLIFF, RW, RD, 0)
            box(-SIDE_D - 8, -WALL_D, -CLIFF, RW + SIDE_D + 8, 0, WALL_H)
            box(-SIDE_D, 0, -CLIFF, 0, RD, SIDE_H); box(RW, 0, -CLIFF, RW + SIDE_D, RD, SIDE_H)
        if bridge is not None: bridge(box)
        s.occ = occ
        s.g.set_ruin_from_occ(occ)
    def reset(s):
        g = s.g; g.root.fill(1e3); g.au.fill(0); g.ath.fill(0); g.aid.fill(-1); g.ar.fill(0)

def keep_floor_center(T):
    def k(p):
        x, y, z = p
        if z < -3: return None
        cx, cy, rx, ry = T.RW / 2, T.RD * .58, T.RW / 2 - 22, T.RD * .42 - 14
        dx, dy = (x - cx) / rx, (y - cy) / ry; d2 = dx * dx + dy * dy
        if d2 < 1:
            L = math.sqrt(d2) + 1e-6; return np.array([dx / L, dy / L, 0]) * (1 - L) * 1.2
        return None
    return k

def bake_roots(T, grow_fn, win, seed, moss=.4, fixed=None, k_mul=.45, taper=.03, rmax=7.0, outline=True):
    """grow_fn(G) で根を育て、win=(x0,y0,x1,y1)（画面の座標）の中を焼いて Part にする。
       石は焼かない（本編が置く）が、根が石に落とすくぼみの暗さだけ「陰」として残す。"""
    T.reset()
    G = R3.Grower(T.g, seed=seed, keep_out=keep_floor_center(T))
    grow_fn(G)
    G.finish(n=2.5, taper=taper, rmax=rmax)
    if fixed:
        for nd in G.nodes:
            if nd.rid in fixed: nd.r = fixed[nd.rid] * (1 + .12 * math.sin(nd.u * .05 + nd.rid))
    segs = G.segments(k_mul=k_mul)
    if fixed is not None and len(fixed):
        br = np.isin(segs[:, 16], list(fixed.keys())); segs[br, 17] = np.minimum(segs[br, 17], 1.0)
    R3.raster(T.g, segs)
    x0, y0, x1, y1 = win; Wd, Hd = x1 - x0, y1 - y0
    POS, NRMv, MAT, HIT = R3.cast(T.g, x0, y0, 1.0, Wd, Hd, 80, -200)
    AO = R3.ao(T.g, POS, NRMv, HIT)
    # 根の無い時のくぼみ（石への陰を出すため）
    saved = T.g.root.copy(); T.g.root.fill(1e3)
    POS0, NRM0, MAT0, HIT0 = R3.cast(T.g, x0, y0, 1.0, Wd, Hd, 80, -200)
    AO0 = R3.ao(T.g, POS0, NRM0, HIT0)
    T.g.root[:] = saved
    OU, OTH, OID, OR = R3.attrs(T.g, POS, HIT)
    rootm = HIT & (MAT == 1)
    alb, mz = R3.bark_albedo(POS, NRMv, OU, OTH, OID, OR, rootm, R3.BARK_PALE, moss=moss, seed=seed)
    P = Part(x0, y0, x1, y1)
    key = POS[..., 1] + POS[..., 2]
    ni = nidx(NRMv[..., 0], NRMv[..., 1], NRMv[..., 2])
    for Y in range(Hd):
        for X in range(Wd):
            if rootm[Y, X]:
                P.has[Y, X] = True; P.key[Y, X] = key[Y, X]; P.z[Y, X] = POS[Y, X, 2]; P.nrm[Y, X] = ni[Y, X]
                P.mat[Y, X] = 2 if mz[Y, X] > .5 else 1
                P.idx[Y, X] = int(np.clip(alb[Y, X] * (.62 + .38 * AO[Y, X]) * 63, 1, 63))
                P.ao[Y, X] = 1.0
            elif HIT[Y, X] and HIT0[Y, X] and MAT[Y, X] == 2:
                # 石の上の陰：根が近くて暗くなった分（と、根の縁の輪郭）
                r = (.62 + .38 * AO[Y, X]) / max(.05, (.62 + .38 * AO0[Y, X]))
                P.key[Y, X] = key[Y, X]
                if r < .96:
                    P.has[Y, X] = True; P.mat[Y, X] = 3; P.ao[Y, X] = r; P.z[Y, X] = POS[Y, X, 2]; P.nrm[Y, X] = ni[Y, X]
    if outline:
        # 輪郭：根の外形（根の画素の奥側で、根に接している所）
        K = np.where(P.has | HIT, np.where(HIT, key, -1e9), -1e9)
        dk = np.zeros_like(K)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nb = np.roll(np.roll(K, dy, 0), dx, 1); dk = np.maximum(dk, nb - K)
        e = (dk > 3) & HIT
        on_root = e & rootm
        P.idx = np.where(on_root, 255, P.idx)
        on_stone = e & ~rootm & HIT
        P.has = P.has | on_stone
        P.mat = np.where(on_stone, 3, P.mat); P.ao = np.where(on_stone, np.minimum(P.ao, .4), P.ao)
        P.z = np.where(on_stone, POS[..., 2], P.z); P.nrm = np.where(on_stone, ni, P.nrm)
    # 浮いた点を消す（根の地の明るさを3×3の中央値で）
    idx = P.idx.copy()
    for Y in range(1, Hd - 1):
        for X in range(1, Wd - 1):
            if P.mat[Y, X] in (1, 2) and P.idx[Y, X] != 255:
                v = [P.idx[Y + a, X + b] for a in (-1, 0, 1) for b in (-1, 0, 1) if P.mat[Y + a, X + b] in (1, 2) and P.idx[Y + a, X + b] != 255]
                if len(v) >= 5: idx[Y, X] = int(np.median(v))
    P.idx = idx
    return P

BKW = dict(frac=.45, grav=.5, cling=1.0, tip_r=.6)
def drape(side, seed):
    def g(G):
        x = 40 if side < 0 else 120
        way = [(x, -26, 36), (x, -4, 31), (x + side * 3, 3, 12), (x + side * 8, 14, 1), (x + side * 26, 46, 1), (x + side * 30, 70, 1)]
        G.grow((x, -56, 40), (0, 1, -.3), 120, way=way, cling=1.0, grav=.25, branch=.045, branch_kw=BKW, tip_r=1.1)
        G.grow((x + side * -10, -50, 38), (0, 1, -.3), 70, way=[(x - side * 10, -20, 34), (x - side * 10, -4, 30), (x - side * 8, 4, 10), (x - side * 2, 22, 1)], cling=1.0, grav=.25, branch=.04, branch_kw=BKW, tip_r=.8)
    return g
def corner(side, seed):
    def g(G):
        if side < 0:
            pts = [(26, -26, 36), (26, -4, 31), (22, 3, 12), (12, 16, 1), (6, 54, 1), (-2, 58, SIDE_H + 3), (-12, 60, SIDE_H - 2), (-22, 64, -8), (-26, 72, -60), (-28, 78, -170)]
            st = (26, -56, 40)
        else:
            pts = [(134, -26, 36), (134, -4, 31), (138, 3, 12), (148, 16, 1), (154, 54, 1), (162, 58, SIDE_H + 3), (172, 60, SIDE_H - 2), (182, 64, -8), (186, 72, -60), (188, 78, -170)]
            st = (134, -56, 40)
        G.grow(st, (0, 1, -.3), 320, way=pts, cling=1.0, grav=.25, branch=.03, branch_kw=BKW, tip_r=1.1)
        x2 = 46 if side < 0 else 114
        G.grow((x2, -52, 38), (0, 1, -.3), 80, way=[(x2, -20, 34), (x2, -4, 30), (x2 - side * 4, 4, 10), (x2 - side * 12, 24, 1)], cling=1.0, grav=.25, branch=.04, branch_kw=BKW, tip_r=.8)
    return g
def cradle(seed):
    rr = random.Random(seed)
    def g(G):
        G.grow((80 + rr.uniform(-20, 20), 70, -26), (0, 1, -.1), 150, way=[(80, 132, -28), (78 + rr.uniform(-4, 4), 142, -70), (80 + rr.uniform(-8, 8), 148, -180)],
               cling=.8, grav=.4, branch=.02, branch_kw=dict(frac=.35, grav=1.3, cling=0, tip_r=.6), tip_r=1.0, max_depth=1)
    return g
def grip(seed):
    def g(G):
        G.grow((74, 110, .5), (0, 1, 0), 80, step=1.8, way=[(80, 126, .5), (82, 130, -6), (83, 132, -18), (84, 138, -60)], cling=1.2, grav=.5, tip_r=.8,
               branch=.04, branch_kw=dict(frac=.5, grav=1.5, cling=0, tip_r=.5), max_depth=1)
    return g
def sidehang(side, seed):
    def g(G):
        if side < 0: way = [(8, 62, .5), (-4, 64, SIDE_H + 3), (-14, 65, 4), (-22, 67, -8), (-26, 72, -90)]; st = (26, 56, .5)
        else: way = [(152, 62, .5), (164, 64, SIDE_H + 3), (174, 65, 4), (182, 67, -8), (186, 72, -90)]; st = (134, 56, .5)
        G.grow(st, (-side * -1.0, 0, 0), 110, way=way, cling=1.0, grav=.4, tip_r=.6, branch=.04, branch_kw=dict(frac=.5, grav=1.5, cling=0, tip_r=.5), max_depth=1)
    return g
def hang(seed):
    rr = random.Random(seed)
    def g(G):
        for k in range(3):
            G.grow((80 + rr.uniform(-10, 10), 129.5, -CLIFF + 2), (0, 0, -1), rr.randint(10, 34), grav=2.4, wander=.15, tip_r=.5)
    return g

# ---------------------------------------------------------------------------
# 橋：4本を螺旋に撚る。位相は x+y（どこで切っても、どの向きでも同じ所は同じ絵）
# ---------------------------------------------------------------------------
BR_A, BR_R, BR_P = 9.0, (4.6, 5.2, 4.3, 4.9), 64
def braid_pts(axis, c0, s0, s1, k, step=2.0):
    ph = 2 * math.pi * k / 4; out = []
    for s in np.arange(s0, s1 + .01, step):
        a = 2 * math.pi * s / BR_P + ph; w = 1 + .1 * math.sin(s * .07 + k * 2.1)
        lat = BR_A * w * math.sin(a); zc = -BR_R[k] + BR_A * .42 * math.cos(a)
        out.append((s, c0 + lat, zc) if axis == 'h' else (c0 + lat, s, zc))
    return out
def bridge_strip(axis, seed):
    T = Template(room=False, bounds=(-100, -70, -60, 270, 150, 90) if axis == 'h' else (-70, -100, -60, 140, 270, 90))
    fixed = {}
    def g(G):
        for k in range(4):
            rid = G.rid; G.add_path(braid_pts(axis, 0, -96, 160, k), tip_r=BR_R[k]); fixed[rid] = BR_R[k]
        rr = random.Random(seed)
        if axis == 'h':
            for s in (12, 30, 46):
                if rr.random() < .8: G.grow((s + rr.uniform(-3, 3), rr.uniform(-5, 5), -9), (0, 0, -1), rr.randint(8, 26), grav=2.2, wander=.12, tip_r=.5)
    win = (-4, -60, 68, 90) if axis == 'h' else (-30, -40, 30, 110)
    P = bake_roots(T, g, win, seed, fixed=fixed, moss=.45)
    # 周期の1回分だけ残す（h は世界の x、v は世界の y が [0,64)）
    keep = np.zeros_like(P.has)
    for Y in range(P.H):
        for X in range(P.W):
            if not P.has[Y, X]: continue
            wx = X + P.x0; wy = Y + P.y0 + P.z[Y, X]
            u = wx if axis == 'h' else wy
            keep[Y, X] = 0 <= u < BR_P
    P.has &= keep
    return P
def knot(seed):
    T = Template(room=False, bounds=(-60, -70, -60, 120, 150, 90))
    rr = random.Random(seed)
    def g(G):
        for k in range(5):
            a = rr.uniform(0, 6.28); st = (math.cos(a) * 30, math.sin(a) * 30, -6)
            way = [(math.cos(a + 2.2) * 10, math.sin(a + 2.2) * 10, 1), (math.cos(a + 3.6) * 22, math.sin(a + 3.6) * 22, -4), (math.cos(a + 4.6) * 32, math.sin(a + 4.6) * 32, -10)]
            G.grow(st, (-math.cos(a), -math.sin(a), .1), 40, way=way, wander=.25, tip_r=3.2)
        for k in range(3):
            G.grow((rr.uniform(-10, 10), rr.uniform(-6, 10), -12), (0, 0, -1), rr.randint(14, 34), grav=2.2, wander=.12, tip_r=.5)
    return bake_roots(T, g, (-46, -56, 46, 70), seed, moss=.5, taper=.02, rmax=5)
def bridge_end(d, seed):
    """d：橋から見た部屋の向き（'n'＝部屋が北）。部屋の床は境の線の向こう"""
    def floor(box):
        if d == 'n': box(-60, -120, -CLIFF, 60, 0, 0)
        if d == 's': box(-60, 0, -CLIFF, 60, 120, 0)
        if d == 'w': box(-120, -60, -CLIFF, 0, 60, 0)
        if d == 'e': box(0, -60, -CLIFF, 120, 60, 0)
    T = Template(room=False, bridge=floor, bounds=(-130, -130, -60, 260, 260, 90))
    fixed = {}
    v = {'n': (0, -1), 's': (0, 1), 'w': (-1, 0), 'e': (1, 0)}[d]
    def g(G):
        for k in range(4):
            ph = 2 * math.pi * k / 4; pts = []
            for s in np.arange(-48, 14, 2):            # s>0 で部屋の中（床の下へ潜る）
                a = 2 * math.pi * s / BR_P + ph; lat = BR_A * math.sin(a) * (1 + max(0, s) * .03)
                zc = -BR_R[k] + BR_A * .42 * math.cos(a) - max(0, s + 4) * .9
                if v[0] == 0: pts.append((lat, v[1] * s, zc))
                else: pts.append((v[0] * s, lat, zc))
            rid = G.rid; G.add_path(pts, tip_r=BR_R[k]); fixed[rid] = BR_R[k]
        rr = random.Random(seed)
        for sp in (-1, 1):
            for j in range(2):
                ang = sp * rr.uniform(.5, 1.2)
                dx, dy = v[0] * math.cos(ang) - v[1] * math.sin(ang), v[0] * math.sin(ang) + v[1] * math.cos(ang)
                G.grow((v[0] * 2, v[1] * 2, .5), (dx, dy, 0), rr.randint(8, 16), cling=1.2, grav=.1, tip_r=.7, wander=.3)
    return bake_roots(T, g, (-56, -70, 56, 70), seed, fixed=fixed, moss=.45)

# ---------------------------------------------------------------------------
# 書き出し
# ---------------------------------------------------------------------------
def encode(P):
    """Part → RGBA の絵（has の所だけ）"""
    im = np.zeros((P.H, P.W, 4), np.uint8)
    m = P.has
    im[..., 0] = np.where(m, np.clip(P.idx, 0, 255), 0)
    im[..., 1] = np.where(m, (P.nrm & 63) | (np.clip(P.mat, 0, 3) << 6), 0)
    im[..., 2] = np.where(m, np.clip(np.round(P.z) + 150, 0, 255), 0)
    im[..., 3] = np.where(m, np.clip(np.round(P.ao * 254) + 1, 1, 255), 0)
    return im

def build(preview=None):
    parts = {}
    def add(name, P): parts[name] = P; print(name, P.W, P.H, int(P.has.sum()), flush=True)
    for s in range(3): add(f'wall_n{s}', part_wall_n(s + 1))
    add('side_l', part_side(-1, 1)); add('side_r', part_side(1, 2))
    add('side_cap_l', part_side_cap(-1)); add('side_cap_r', part_side_cap(1))
    for s in range(2): add(f'cliff{s}', part_cliff(s + 1))
    add('pillar_t', part_pillar(38)); add('pillar_m', part_pillar(26)); add('pillar_b', part_pillar(12, broken=True))
    add('floor', part_floor()); add('inlay', part_inlay())
    T = Template()
    W0 = (-70, -120, 230, 330)
    for s in range(3): add(f'drape_l{s}', bake_roots(T, drape(-1, s), (-10, -110, 110, 100), 11 + s, taper=.022, rmax=5.2))
    for s in range(3): add(f'drape_r{s}', bake_roots(T, drape(1, s), (50, -110, 170, 100), 21 + s, taper=.022, rmax=5.2))
    for s in range(2): add(f'corner_l{s}', bake_roots(T, corner(-1, s), (-60, -110, 80, 270), 31 + s, taper=.022, rmax=5.6))
    for s in range(2): add(f'corner_r{s}', bake_roots(T, corner(1, s), (80, -110, 220, 270), 41 + s, taper=.022, rmax=5.6))
    for s in range(3): add(f'cradle{s}', bake_roots(T, cradle(s), (40, 100, 120, 330), 51 + s))
    for s in range(3): add(f'grip{s}', bake_roots(T, grip(s), (55, 90, 105, 210), 61 + s, taper=.02, rmax=4))
    for s in range(2): add(f'sidehang_l{s}', bake_roots(T, sidehang(-1, s), (-40, 40, 40, 170), 71 + s, taper=.02, rmax=4))
    for s in range(2): add(f'sidehang_r{s}', bake_roots(T, sidehang(1, s), (120, 40, 200, 170), 81 + s, taper=.02, rmax=4))
    for s in range(3): add(f'hang{s}', bake_roots(T, hang(s), (60, 120, 100, 175), 91 + s, outline=False))
    del T; import gc; gc.collect()
    for s in range(2): add(f'br_h{s}', bridge_strip('h', 101 + s))
    for s in range(2): add(f'br_v{s}', bridge_strip('v', 111 + s))
    for s in range(3): add(f'knot{s}', knot(121 + s))
    for d in 'nsew': add(f'end_{d}', bridge_end(d, 131 + 'nsew'.index(d)))
    # 1枚の絵に詰める（棚詰め）
    order = sorted(parts.items(), key=lambda kv: -kv[1].H)
    AW = 1024; x = y = rowh = 0; place = {}
    for name, P in order:
        if x + P.W > AW: x = 0; y += rowh + 1; rowh = 0
        place[name] = (x, y); x += P.W + 1; rowh = max(rowh, P.H)
    AH = y + rowh + 1
    atlas = np.zeros((AH, AW, 4), np.uint8); meta = {}
    for name, P in parts.items():
        px, py = place[name]; atlas[py:py + P.H, px:px + P.W] = encode(P)
        meta[name] = [px, py, P.W, P.H, -P.x0, -P.y0]           # 最後の2つ＝絵の中の原点（型の座標の 0,0）
    buf = io.BytesIO(); Image.fromarray(atlas, 'RGBA').save(buf, 'PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    js = ('/* 根の層の部品集（tools/rootkit.py が書き出す。手で直さない） */\n'
          'window.ROOT_KIT=' + json.dumps({'v': 1, 'pal': KPAL, 'consts': {'WALL_D': WALL_D, 'WALL_H': WALL_H, 'SIDE_D': SIDE_D, 'SIDE_H': SIDE_H, 'CLIFF': CLIFF, 'BR_P': BR_P},
                                            'parts': meta, 'png': 'data:image/png;base64,' + b64}, ensure_ascii=False) + ';\n')
    open(OUT_JS, 'w').write(js)
    print('atlas', AW, AH, 'png', len(buf.getvalue()), 'js', len(js))
    if preview: preview_sheet(parts, preview)
    return parts

def preview_sheet(parts, path):
    """部品を石は色、根は灰で並べた確認用（光は固定）"""
    pal = np.array([hx(c) for c in KPAL])
    tiles = []
    for name, P in parts.items():
        im = np.zeros((P.H, P.W, 3)); im[:] = (12, 14, 18)
        for Y in range(P.H):
            for X in range(P.W):
                if not P.has[Y, X]: continue
                m = P.mat[Y, X]
                if m == 0: im[Y, X] = pal[P.idx[Y, X]] * P.ao[Y, X]
                elif m == 3: im[Y, X] = (60, 50, 40) if P.ao[Y, X] < .5 else (30, 24, 20)
                else:
                    if P.idx[Y, X] == 255: im[Y, X] = (20, 18, 16); continue
                    n = NRM[P.nrm[Y, X]]; l = max(0, n @ np.array([-.45, .74, .5]) / 1.0)
                    v = P.idx[Y, X] / 63 * (.35 + .75 * l)
                    b = R3.BARK_PALE if m == 1 else R3.MOSS
                    im[Y, X] = b[min(len(b) - 1, int(v * len(b)))]
        tiles.append((name, Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).resize((P.W * 2, P.H * 2), Image.NEAREST)))
    W = 1800; x = y = rowh = 0; pos = []
    for name, t in tiles:
        if x + t.width > W: x = 0; y += rowh + 24; rowh = 0
        pos.append((name, t, x, y)); x += t.width + 10; rowh = max(rowh, t.height)
    sheet = Image.new('RGB', (W, y + rowh + 30), (24, 26, 30))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for name, t, x, y in pos: sheet.paste(t, (x, y + 18)); d.text((x, y + 2), name, fill=(220, 210, 190))
    sheet.save(path); print('preview', path)

if __name__ == '__main__':
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    build(pv)
