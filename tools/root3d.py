#!/usr/bin/env python3
"""木の根を 3D で育て、符号付き距離場（SDF）にしてゲームの斜め見下ろしで描き、ドット絵に落とす。

  python3 tools/root3d.py [出力ディレクトリ]      … 研究用のシート（study.png）を出す
  ほかのスクリプトからは import して使う（根の層の静止画 mock など）

なぜ 3D から作るか（根の層の静止画・第2版の講評「木のクオリティが低い」への答え）:
  2D の管を手で引くと、太さが一定・分かれ目がただの重なり・垂れ方に重さが無い、の3つが直らない。
  根を「育てて」形を作り、光は形から計算する。

形の決まり（調べたこと）:
  1. 管の模型（pipe model）: 分かれ目で親の太さ r^n = Σ 子の r^n（n≈2.5）。先端から元へ向かって
     少しずつ太らせる（TAPER）。これで「元が太く、分かれるたびに細る」階層が自然に出る。
  2. 面をつかむ（thigmotropism）: 石の面から一定の距離に入った根は、面に沿って滑り、面へ吸い寄せられて
     半分めり込む。アンコールのタ・プローム（Tetrameles nudiflora・絞め殺しのイチジク）の根は、
     石の上を「溶けた蝋のように」流れ、壁の縁を越えて垂れ、柱や戸口を囲む網になる。
  3. 重さで垂れる（gravitropism）: 面から離れた根は真下へ向かう。気根はまっすぐ・細く・並ぶ。
  4. 触れた根は融ける（anastomosis）: 距離場の滑らかな和（smooth min）で、根どうしの継ぎ目と
     分かれ目の付け根に「水かき」が出る（板根の付け根の張り出し）。
  5. 樹皮は長さの方向に走る溝。溝は形として彫る（距離場を押し下げる）ので、光が当たると自然に陰が出る。
  6. 色は「明るい灰」の樹皮（タ・プロームの白っぽい幹）と、暗い茶の樹皮の2案を比べる。

座標（ゲームの静止画と同じ）: x 右、y 手前（南）、z 上。単位はドット。
画面: X = x、Y = y − z（高さのぶん上に）。前後の比べは y + z（大きいほど手前）。
"""
import math, os, sys, random
import numpy as np
from numba import njit

# ---------------------------------------------------------------------------
# 格子（距離場を入れる箱）
# ---------------------------------------------------------------------------
class Grid:
    def __init__(s, x0, y0, z0, nx, ny, nz, vs=1.0):
        s.o = np.array([x0, y0, z0], float); s.n = (nx, ny, nz); s.vs = vs
        s.root = np.full((nz, ny, nx), 1e3, np.float32)     # 根の距離場
        s.au = np.zeros((nz, ny, nx), np.float32)            # 根元からの長さ
        s.ath = np.zeros((nz, ny, nx), np.float32)           # 根の周りの角
        s.aid = np.full((nz, ny, nx), -1, np.int32)          # 根の番号
        s.ar = np.zeros((nz, ny, nx), np.float32)            # その場所の太さ
        s.ruin = np.full((nz, ny, nx), 1e3, np.float32)      # 石（遺跡）の距離場

    def set_ruin_from_occ(s, occ):
        """occ: (nz,ny,nx) bool。内側は負、外側は正の距離（ボクセル単位→ドット）"""
        from scipy.ndimage import distance_transform_edt as edt
        out = edt(~occ).astype(np.float32); inn = edt(occ).astype(np.float32)
        s.ruin = (np.where(occ, -inn + .5, out - .5) * s.vs).astype(np.float32)

# ---------------------------------------------------------------------------
# 根を育てる
# ---------------------------------------------------------------------------
def _hash3(i, j, k, seed):
    h = (i * 374761393 + j * 668265263 + k * 2147483647 + seed * 1442695041) & 0xffffffff
    h = (h ^ (h >> 13)) * 1274126177 & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0
def vnoise3(x, y, z, seed):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z); fx, fy, fz = x - ix, y - iy, z - iz
    ux, uy, uz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    a = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (ux if dx else 1 - ux) * (uy if dy else 1 - uy) * (uz if dz else 1 - uz)
                a += w * _hash3(ix + dx, iy + dy, iz + dz, seed)
    return a

class Node:
    __slots__ = ('p', 'parent', 'kids', 'r', 'u', 'rid', 'tip_r', 'kind', 'cn', 'cd')
    def __init__(s, p, parent, rid, kind=0):
        s.p = np.array(p, float); s.parent = parent; s.kids = []; s.r = 0.0; s.u = 0.0; s.rid = rid; s.tip_r = 0.8; s.kind = kind; s.cn = np.array([0, 0, 1.0]); s.cd = 1e3

class Grower:
    """根の先（agent）を1歩ずつ進める。方向 = 惰性 + 目標 + 重さ + 揺らぎ + 面への吸着。"""
    def __init__(s, grid=None, seed=1, keep_out=None):
        s.g = grid; s.nodes = []; s.rng = random.Random(seed); s.seed = seed; s.rid = 0
        s.keep_out = keep_out or (lambda p: None)            # 通り道など、根を入れたくない所 → 押し出す向き

    def ruin_d(s, p):
        """石までの距離と、外向きの法線"""
        g = s.g
        if g is None: return 1e3, np.array([0, 0, 1.0])
        q = (p - g.o) / g.vs; i, j, k = int(round(q[0])), int(round(q[1])), int(round(q[2]))
        nx, ny, nz = g.n
        if not (1 <= i < nx - 1 and 1 <= j < ny - 1 and 1 <= k < nz - 1): return 1e3, np.array([0, 0, 1.0])
        R = g.ruin; d = float(R[k, j, i])
        n = np.array([R[k, j, i + 1] - R[k, j, i - 1], R[k, j + 1, i] - R[k, j - 1, i], R[k + 1, j, i] - R[k - 1, j, i]], float)
        L = np.linalg.norm(n); n = n / L if L > 1e-6 else np.array([0, 0, 1.0])
        return d, n

    def grow(s, start, d0, steps, *, way=None, grav=0.0, cling=0.0, wander=.35, inertia=3.0, step=1.5,
             branch=0.0, branch_kw=None, tip_r=0.8, parent=None, kind=0, sink=.55, guide=None, depth=0, max_depth=3):
        """way: 通る点の列（近づいたら次へ）／guide(t, p)→目標点（橋の撚り）／branch: 1歩あたりの枝分かれの率"""
        rid = s.rid; s.rid += 1
        p = np.array(start, float); d = np.array(d0, float); d /= np.linalg.norm(d)
        par = parent
        if par is None:
            par = Node(p, None, rid, kind); par.tip_r = tip_r; s.nodes.append(par)
        wi = 0; seed = s.rng.randrange(1 << 20); n_steps = 0
        for it in range(steps):
            f = d * inertia
            # 目標
            if guide is not None:
                tgt = guide(it / max(1, steps - 1), p)
                v = tgt - p; L = np.linalg.norm(v)
                if L > 1e-6: f += v / L * 2.2 * min(1.0, L / 4)
            elif way is not None and wi < len(way):
                v = np.array(way[wi], float) - p; L = np.linalg.norm(v)
                if L < 6 and wi < len(way) - 1: wi += 1
                elif L < 3 and wi == len(way) - 1: break
                if L > 1e-6: f += v / L * 1.6
            # 重さ
            f += np.array([0, 0, -grav])
            # 揺らぎ（長さに沿って滑らかに変わる）
            t = it * step * .045
            f += wander * np.array([vnoise3(t, 0, 0, seed) - .5, vnoise3(0, t, 0, seed + 1) - .5, (vnoise3(0, 0, t, seed + 2) - .5) * .6]) * 2
            # 通り道から押し出す
            ko = s.keep_out(p)
            if ko is not None: f += np.array(ko, float) * 2.5
            # 面への吸着：面の近くでは面に沿わせ、半分めり込む距離へ引く
            rd, rn = s.ruin_d(p)
            if cling > 0 and rd < 7:
                dn = float(f @ rn)
                if dn < 0: f -= rn * dn                                   # 面へ突っ込む成分を消す（滑る）
                f += -rn * cling * (rd - sink * 2.5)                       # 面からの距離を保つ
            elif rd < 1.5:
                dn = float(f @ rn)
                if dn < 0: f -= rn * dn * 1.2
            L = np.linalg.norm(f)
            if L < 1e-6: continue
            d = f / L
            p = p + d * step
            rd, rn = s.ruin_d(p)
            if rd < .3: p = p + rn * (.3 - rd)                             # 石に入ったら押し出す
            nd = Node(p, par, rid, kind); nd.tip_r = tip_r; nd.cd, nd.cn = s.ruin_d(p); par.kids.append(nd); s.nodes.append(nd); par = nd
            n_steps += 1
            if branch > 0 and depth < max_depth and s.rng.random() < branch and it > 4 and it < steps - 4:
                kw = dict(branch_kw or {})
                ang = math.radians(s.rng.uniform(25, 55)) * (1 if s.rng.random() < .5 else -1)
                # 枝の向き：今の向きを、上向き軸のまわりに回して少し下げる
                c, sn = math.cos(ang), math.sin(ang)
                bd = np.array([d[0] * c - d[1] * sn, d[0] * sn + d[1] * c, d[2] - .25])
                sub = dict(steps=int((steps - it) * kw.pop('frac', .55)), grav=kw.pop('grav', grav), cling=kw.pop('cling', cling),
                           wander=kw.pop('wander', wander * 1.1), branch=kw.pop('branch', branch * .7), tip_r=kw.pop('tip_r', tip_r * .8),
                           kind=kind, depth=depth + 1, max_depth=max_depth, sink=sink, branch_kw=branch_kw)
                if sub['steps'] > 6: s.grow(p, bd, parent=nd, **sub)
        return par

    def add_path(s, pts, tip_r=1.0, kind=0):
        """決めた道筋をそのまま根にする（橋の撚りなど、形を狙って置くもの）"""
        rid = s.rid; s.rid += 1
        par = None
        for p in pts:
            nd = Node(p, par, rid, kind); nd.tip_r = tip_r; nd.cd, nd.cn = s.ruin_d(nd.p)
            if par is not None: par.kids.append(nd)
            s.nodes.append(nd); par = nd
        return rid

    def finish(s, n=2.5, taper=.035, rmax=14.0):
        """管の模型で太さを決める。先端から元へ：r = (Σ子 r^n)^(1/n) + taper×歩幅"""
        order = []
        roots = [nd for nd in s.nodes if nd.parent is None]
        stack = list(roots)
        while stack:
            nd = stack.pop(); order.append(nd); stack.extend(nd.kids)
        for nd in reversed(order):
            if not nd.kids: nd.r = nd.tip_r
            else:
                acc = sum(k.r ** n for k in nd.kids) ** (1 / n)
                step = np.linalg.norm(nd.kids[0].p - nd.p)
                nd.r = min(rmax, acc + taper * step)
        for nd in order:                                                  # 根元からの長さ
            if nd.parent is not None: nd.u = nd.parent.u + np.linalg.norm(nd.p - nd.parent.p)

    def scale_root(s, rid_set, mul):
        for nd in s.nodes:
            if nd.rid in rid_set: nd.r *= mul

    def segments(s, k_mul=.35, amp_mul=1.0, furrow=3.2):
        """距離場に入れる線分の表。列: a(3) b(3) r0 r1 u0 u1 N(3) B(3) id k nf amp"""
        rows = []
        frames = {}
        for nd in s.nodes:
            if nd.parent is None: continue
            a, b = nd.parent.p, nd.p
            T = b - a; L = np.linalg.norm(T)
            if L < 1e-6: continue
            T /= L
            # 並行移動で枠を運ぶ（ねじれの飛びを防ぐ）
            if id(nd.parent) in frames:
                N0 = frames[id(nd.parent)]; N = N0 - T * (N0 @ T)
                if np.linalg.norm(N) < 1e-3: N = np.cross(T, [0, 0, 1.0])
            else:
                N = np.cross(T, [0, 0, 1.0])
                if np.linalg.norm(N) < 1e-3: N = np.cross(T, [1.0, 0, 0])
            N /= np.linalg.norm(N); frames[id(nd)] = N; B = np.cross(T, N)
            r0, r1 = nd.parent.r, nd.r
            if nd.parent.parent is None and len(nd.parent.kids) == 1: r0 = r1
            k = float(np.clip(min(r0, r1) * k_mul, .6, 4.0))
            nf = max(3, round(2 * math.pi * max(r0, r1) / furrow))
            amp = float(np.clip(.1 * max(r0, r1), .15, .9)) * amp_mul
            # 面をつかんでいる根は平たく（面の法線の向きに潰し、横に広げる）
            rr = max(r0, r1); cd = nd.cd
            fl = 1.0 if cd > rr + 2 else float(np.clip(.55 + .45 * (cd - rr * .5) / (rr * .5 + 2), .55, 1.0))
            rows.append([*a, *b, r0, r1, nd.parent.u, nd.u, *N, *B, nd.rid, k, nf, amp, *nd.cn, fl])
        return np.array(rows, np.float64) if rows else np.zeros((0, 24))

# ---------------------------------------------------------------------------
# 距離場へ（numba）
# ---------------------------------------------------------------------------
@njit(cache=True)
def _raster(F, AU, ATH, AID, AR, ox, oy, oz, vs, S):
    nz, ny, nx = F.shape
    for si in range(S.shape[0]):
        ax, ay, az, bx, by, bz = S[si, 0], S[si, 1], S[si, 2], S[si, 3], S[si, 4], S[si, 5]
        r0, r1, u0, u1 = S[si, 6], S[si, 7], S[si, 8], S[si, 9]
        Nx, Ny, Nz, Bx, By, Bz = S[si, 10], S[si, 11], S[si, 12], S[si, 13], S[si, 14], S[si, 15]
        rid, k, nf, amp = S[si, 16], S[si, 17], S[si, 18], S[si, 19]
        Cx, Cy, Cz, fl = S[si, 20], S[si, 21], S[si, 22], S[si, 23]
        wid = 1.0 + (1.0 - fl) * .4
        m = max(r0, r1) * wid + k + 1.5
        i0 = max(0, int((min(ax, bx) - m - ox) / vs)); i1 = min(nx - 1, int((max(ax, bx) + m - ox) / vs) + 1)
        j0 = max(0, int((min(ay, by) - m - oy) / vs)); j1 = min(ny - 1, int((max(ay, by) + m - oy) / vs) + 1)
        k0 = max(0, int((min(az, bz) - m - oz) / vs)); k1 = min(nz - 1, int((max(az, bz) + m - oz) / vs) + 1)
        abx, aby, abz = bx - ax, by - ay, bz - az
        ab2 = abx * abx + aby * aby + abz * abz + 1e-9
        for kk in range(k0, k1 + 1):
            pz = oz + kk * vs
            for jj in range(j0, j1 + 1):
                py = oy + jj * vs
                for ii in range(i0, i1 + 1):
                    px = ox + ii * vs
                    qx, qy, qz = px - ax, py - ay, pz - az
                    t = (qx * abx + qy * aby + qz * abz) / ab2
                    if t < 0: t = 0.0
                    elif t > 1: t = 1.0
                    cx, cy, cz = qx - abx * t, qy - aby * t, qz - abz * t
                    if fl < .999:
                        cn = cx * Cx + cy * Cy + cz * Cz
                        sc = 1.0 / fl - 1.0
                        ex, ey, ez = cx + Cx * cn * sc, cy + Cy * cn * sc, cz + Cz * cn * sc
                        dist = math.sqrt(ex * ex + ey * ey + ez * ez) / wid
                    else:
                        dist = math.sqrt(cx * cx + cy * cy + cz * cz)
                    r = r0 + (r1 - r0) * t
                    u = u0 + (u1 - u0) * t
                    th = math.atan2(cx * Bx + cy * By + cz * Bz, cx * Nx + cy * Ny + cz * Nz)
                    # 樹皮の溝：長さの方向に走る。少しねじれ、ゆっくり揺れる
                    g = .5 + .5 * math.cos(th * nf + u * .045 + 1.9 * math.sin(u * .09 + rid * 1.7))
                    g = g - .62
                    if g < 0: g = 0.0
                    g = g / .38
                    d = dist - r + amp * g * g
                    f = F[kk, jj, ii]
                    if d < f:
                        AU[kk, jj, ii] = u; ATH[kk, jj, ii] = th; AID[kk, jj, ii] = int(rid); AR[kk, jj, ii] = r
                    h = .5 + .5 * (d - f) / k
                    if h < 0: h = 0.0
                    elif h > 1: h = 1.0
                    F[kk, jj, ii] = d * (1 - h) + f * h - k * h * (1 - h) if f < 999 else d

def raster(grid, segs):
    if len(segs): _raster(grid.root, grid.au, grid.ath, grid.aid, grid.ar, grid.o[0], grid.o[1], grid.o[2], grid.vs, segs)

# ---------------------------------------------------------------------------
# 描く（numba）：斜め見下ろしの光線を z の上から下へ
# ---------------------------------------------------------------------------
@njit(cache=True)
def _tri(F, x, y, z):
    nz, ny, nx = F.shape
    if x < 0 or y < 0 or z < 0 or x >= nx - 1 or y >= ny - 1 or z >= nz - 1: return 1e3
    i, j, k = int(x), int(y), int(z); fx, fy, fz = x - i, y - j, z - k
    c00 = F[k, j, i] * (1 - fx) + F[k, j, i + 1] * fx
    c01 = F[k, j + 1, i] * (1 - fx) + F[k, j + 1, i + 1] * fx
    c10 = F[k + 1, j, i] * (1 - fx) + F[k + 1, j, i + 1] * fx
    c11 = F[k + 1, j + 1, i] * (1 - fx) + F[k + 1, j + 1, i + 1] * fx
    return (c00 * (1 - fy) + c01 * fy) * (1 - fz) + (c10 * (1 - fy) + c11 * fy) * fz

@njit(cache=True)
def _cast(F, R, ox, oy, oz, vs, sx0, sy0, ps, W, H, ztop, zbot, POS, NRM, MAT, HIT):
    for py in range(H):
        for px in range(W):
            X = sx0 + px * ps; Ys = sy0 + py * ps
            z = ztop; prev = 1e3; prevz = z; hit = 0
            stp = vs * .5
            while z > zbot:
                y = Ys + z
                gx, gy, gz = (X - ox) / vs, (y - oy) / vs, (z - oz) / vs
                a = _tri(F, gx, gy, gz); b = _tri(R, gx, gy, gz)
                d = a if a < b else b
                if d < 0:
                    # 前の標本との間を割って面の位置を出す
                    zz = z
                    if prev < 999:
                        zz = prevz - (prevz - z) * prev / (prev - d)
                    yy = Ys + zz
                    gx, gy, gz = (X - ox) / vs, (yy - oy) / vs, (zz - oz) / vs
                    a = _tri(F, gx, gy, gz); b = _tri(R, gx, gy, gz)
                    m = 1 if a <= b else 2
                    G = F if m == 1 else R
                    e = .7
                    nx_ = _tri(G, gx + e, gy, gz) - _tri(G, gx - e, gy, gz)
                    ny_ = _tri(G, gx, gy + e, gz) - _tri(G, gx, gy - e, gz)
                    nz_ = _tri(G, gx, gy, gz + e) - _tri(G, gx, gy, gz - e)
                    L = math.sqrt(nx_ * nx_ + ny_ * ny_ + nz_ * nz_) + 1e-9
                    POS[py, px, 0] = X; POS[py, px, 1] = yy; POS[py, px, 2] = zz
                    NRM[py, px, 0] = nx_ / L; NRM[py, px, 1] = ny_ / L; NRM[py, px, 2] = nz_ / L
                    MAT[py, px] = m; HIT[py, px] = 1
                    break
                prev = d; prevz = z
                st = d * .7
                if st < stp: st = stp
                if st > 3 * vs: st = 3 * vs
                z -= st

def cast(grid, sx0, sy0, ps, W, H, ztop, zbot):
    POS = np.zeros((H, W, 3)); NRM = np.zeros((H, W, 3)); MAT = np.zeros((H, W), np.int32); HIT = np.zeros((H, W), np.int32)
    _cast(grid.root, grid.ruin, grid.o[0], grid.o[1], grid.o[2], grid.vs, sx0, sy0, ps, W, H, ztop, zbot, POS, NRM, MAT, HIT)
    return POS, NRM, MAT, HIT.astype(bool)

@njit(cache=True)
def _sample_attr(AU, ATH, AID, AR, F, ox, oy, oz, vs, POS, HIT, OU, OTH, OID, OR):
    H, W = HIT.shape; nz, ny, nx = F.shape
    for py in range(H):
        for px in range(W):
            if not HIT[py, px]: continue
            best = 1e9; bi = -1; bj = -1; bk = -1
            ci = int(round((POS[py, px, 0] - ox) / vs)); cj = int(round((POS[py, px, 1] - oy) / vs)); ck = int(round((POS[py, px, 2] - oz) / vs))
            for dk in range(-1, 2):
                for dj in range(-1, 2):
                    for di in range(-1, 2):
                        i, j, k = ci + di, cj + dj, ck + dk
                        if 0 <= i < nx and 0 <= j < ny and 0 <= k < nz and AID[k, j, i] >= 0:
                            v = abs(F[k, j, i])
                            if v < best: best = v; bi, bj, bk = i, j, k
            if bi >= 0:
                OU[py, px] = AU[bk, bj, bi]; OTH[py, px] = ATH[bk, bj, bi]; OID[py, px] = AID[bk, bj, bi]; OR[py, px] = AR[bk, bj, bi]

def attrs(grid, POS, HIT):
    H, W = HIT.shape
    OU = np.zeros((H, W)); OTH = np.zeros((H, W)); OID = np.full((H, W), -1, np.int64); OR = np.zeros((H, W))
    _sample_attr(grid.au, grid.ath, grid.aid, grid.ar, grid.root, grid.o[0], grid.o[1], grid.o[2], grid.vs, POS, HIT, OU, OTH, OID, OR)
    return OU, OTH, OID, OR

@njit(cache=True)
def _ao(F, R, ox, oy, oz, vs, POS, NRM, HIT, OUT):
    H, W = HIT.shape
    for py in range(H):
        for px in range(W):
            if not HIT[py, px]: continue
            occ = 0.0; wsum = 0.0
            for i in range(1, 6):
                h = i * 1.4 * vs
                x = POS[py, px, 0] + NRM[py, px, 0] * h; y = POS[py, px, 1] + NRM[py, px, 1] * h; z = POS[py, px, 2] + NRM[py, px, 2] * h
                gx, gy, gz = (x - ox) / vs, (y - oy) / vs, (z - oz) / vs
                a = _tri(F, gx, gy, gz); b = _tri(R, gx, gy, gz)
                d = a if a < b else b
                if d > h: d = h
                w = 1.0 / (1 << i)
                occ += w * (h - d) / h; wsum += w
            v = 1 - 1.6 * occ / wsum
            OUT[py, px] = v if v > 0 else 0.0

def ao(grid, POS, NRM, HIT):
    OUT = np.ones(HIT.shape)
    _ao(grid.root, grid.ruin, grid.o[0], grid.o[1], grid.o[2], grid.vs, POS, NRM, HIT, OUT)
    return OUT

@njit(cache=True)
def _shadow(F, R, ox, oy, oz, vs, POS, NRM, HIT, lx, ly, lz, OUT):
    H, W = HIT.shape
    for py in range(H):
        for px in range(W):
            if not HIT[py, px]: continue
            x0 = POS[py, px, 0] + NRM[py, px, 0] * 1.2 * vs; y0 = POS[py, px, 1] + NRM[py, px, 1] * 1.2 * vs; z0 = POS[py, px, 2] + NRM[py, px, 2] * 1.2 * vs
            dx, dy, dz = lx - x0, ly - y0, lz - z0; L = math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9
            dx /= L; dy /= L; dz /= L
            t = vs; res = 1.0
            while t < L - vs:
                x, y, z = x0 + dx * t, y0 + dy * t, z0 + dz * t
                gx, gy, gz = (x - ox) / vs, (y - oy) / vs, (z - oz) / vs
                a = _tri(F, gx, gy, gz); b = _tri(R, gx, gy, gz)
                d = a if a < b else b
                if d < 0:
                    res = 0.0; break
                s = 6.0 * d / t
                if s < res: res = s
                st = d
                if st < .5 * vs: st = .5 * vs
                if st > 4 * vs: st = 4 * vs
                t += st
            OUT[py, px] = res

def shadow(grid, POS, NRM, HIT, L):
    OUT = np.ones(HIT.shape)
    _shadow(grid.root, grid.ruin, grid.o[0], grid.o[1], grid.o[2], grid.vs, POS, NRM, HIT, L[0], L[1], L[2], OUT)
    return OUT

# ---------------------------------------------------------------------------
# 色：樹皮の2案と苔
# ---------------------------------------------------------------------------
def hx(s): s = s.lstrip('#'); return np.array([int(s[i:i+2], 16) for i in (0, 2, 4)], float)
def pal(*a): return np.array([hx(c) for c in a])
BARK_PALE = pal('#141210', '#24201b', '#383129', '#4f463a', '#695e4e', '#857865', '#a3967f', '#c4b89f')   # 明るい灰（タ・プローム）
BARK_BROWN = pal('#120b07', '#24170e', '#3a2717', '#553a22', '#71512f', '#8f6a3e', '#ab8452', '#c49e68')
MOSS = pal('#1c2612', '#2c3a18', '#3e5220', '#55692a', '#6f8436', '#8ea044')
BAY = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + .5) / 16

def bark_albedo(POS, NRM, OU, OTH, OID, OR, HIT, pal_=BARK_PALE, moss=.5, seed=0):
    """反射の強さ（0〜1）と苔の度合いを返す。色はあとで段に落とす"""
    H, W = HIT.shape
    base = np.full((H, W), .62)
    # 根ごとに少し明るさを変える／先端ほど若く明るい
    rid = np.maximum(OID, 0)
    base += (((rid * 2654435761) % 1000) / 1000 - .5) * .12
    base += np.clip(1.5 - OR, 0, 1.5) * .06
    # 地衣類の白い斑（明るい灰の樹皮だけ）
    if pal_ is BARK_PALE:
        sp = np.vectorize(lambda x, y, z: vnoise3(x * .2, y * .2, z * .2, 77 + seed))(POS[..., 0], POS[..., 1], POS[..., 2]) if HIT.any() else 0
        base += np.where(sp > .76, .12, 0)
    # 苔：上を向いた面に、まだらに
    up = NRM[..., 2]
    mn = np.vectorize(lambda x, y, z: vnoise3(x * .12, y * .12, z * .12, 31 + seed))(POS[..., 0], POS[..., 1], POS[..., 2]) if HIT.any() else 0
    mz = np.clip((up - .35) / .4, 0, 1) * np.clip((mn - (1 - moss * .8)) / .12, 0, 1)
    return np.clip(base, 0, 1), mz * HIT

def quantize(lum, x_idx, y_idx, levels, dither=.5):
    """明るさ→段の番号。段の境だけ網目で混ぜる"""
    b = BAY[y_idx & 3, x_idx & 3]
    v = lum * (levels - 1) + (b - .5) * dither
    return np.clip(np.round(v), 0, levels - 1).astype(int)

def majority(idx, mask, it=2):
    """3×3 の中で自分と同じ値が自分を含め2つ以下なら、周りで一番多い値にする（樹皮のちらつきを消す）"""
    out = idx.copy(); H, W = idx.shape
    for _ in range(it):
        cur = out.copy()
        P = np.pad(cur, 1, mode='edge'); M = np.pad(mask, 1)
        stack = np.stack([P[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
        mstack = np.stack([M[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
        same = ((stack == cur[None]) & mstack).sum(0)
        lone = (same <= 2) & mask
        if not lone.any(): break
        mx = int(cur.max()) + 1
        cnt = np.stack([((stack == v) & mstack).sum(0) for v in range(mx)])
        best = cnt.argmax(0)
        out = np.where(lone, best, cur)
    return out

def cleanup(idx, mask):
    """ひとつだけ浮いたドットを消す（4方向の隣が全部同じ値なら、それに合わせる）"""
    out = idx.copy(); H, W = idx.shape
    up = np.roll(idx, 1, 0); dn = np.roll(idx, -1, 0); lf = np.roll(idx, 1, 1); rt = np.roll(idx, -1, 1)
    same = (up == dn) & (dn == lf) & (lf == rt) & (idx != up)
    m = same & mask & np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1)
    out[m] = up[m]
    return out

# ---------------------------------------------------------------------------
# 研究シート
# ---------------------------------------------------------------------------
def study(outdir):
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs(outdir, exist_ok=True)
    # 舞台：石の台（厚さ12）＋その上に石の塊。台の外は落ちる所
    gx0, gy0, gz0 = 0, -40, -110
    NX, NY, NZ = 128, 200, 190
    gr = Grid(gx0, gy0, gz0, NX, NY, NZ, 1.0)
    occ = np.zeros((NZ, NY, NX), bool)
    def box(x0, y0, z0, x1, y1, z1):
        occ[max(0, z0 - gz0):max(0, z1 - gz0), max(0, y0 - gy0):max(0, y1 - gy0), max(0, x0 - gx0):max(0, x1 - gx0)] = True
    box(14, 30, -12, 114, 110, 0)            # 床の台
    box(30, 22, 0, 98, 30, 26)               # 北の壁（厚さ8・高さ26）
    box(72, 60, 0, 84, 68, 30)               # 角柱
    box(40, 74, 0, 58, 86, 9)                # 崩れた石
    gr.set_ruin_from_occ(occ)
    keep = lambda p: ([0, 0, 0] if False else None)
    G = Grower(gr, seed=5)
    # 1) 壁を越えて床を這い、縁から垂れる太い根（つかむ・垂れる）
    G.grow((44, -38, 36), (0, 1, -.2), 160, way=[(46, 10, 32), (48, 26, 28), (50, 32, 14), (48, 40, 2), (40, 70, 1), (24, 96, 0), (12, 112, -14), (10, 116, -80)],
           cling=1.0, grav=.25, branch=.06, branch_kw=dict(frac=.6, grav=.9, cling=.8, tip_r=.7), tip_r=1.0, max_depth=3)
    G.grow((84, -38, 38), (0, 1, -.2), 150, way=[(82, 10, 32), (80, 26, 28), (80, 32, 12), (82, 46, 1), (78, 58, 1), (78, 60, 20), (80, 70, 1), (100, 104, 0), (106, 114, -20), (104, 118, -90)],
           cling=1.0, grav=.25, branch=.06, branch_kw=dict(frac=.6, grav=.9, cling=.8, tip_r=.7), tip_r=1.0, max_depth=3)
    # 2) 台の下から抜けて闇へ降りる根（支える）
    for (sx, sy, ex, ey) in [(40, 80, 34, 140), (90, 84, 96, 146), (64, 100, 60, 150)]:
        G.grow((sx, sy, -16), (0, .5, -.6), 120, way=[(sx, sy + 24, -18), (ex, ey - 26, -40), (ex, ey, -105)], cling=.6, grav=.6,
               branch=.05, branch_kw=dict(frac=.5, grav=1.2, cling=0, tip_r=.6), tip_r=1.0, max_depth=2)
    # 3) 細い気根：まっすぐ下へ
    for x in (22, 30, 100, 108):
        G.grow((x, 112, -4), (0, 0, -1), 50, grav=2.0, wander=.15, tip_r=.6)
    G.finish(n=2.5, taper=.025, rmax=7)
    segs = G.segments()
    raster(gr, segs)
    # 描く：3D（3倍の細かさ）とゲーム（1倍）
    out = []
    for ps, tag in [(1 / 3, 'hi'), (1.0, 'px')]:
        W = int(128 / ps); H = int(230 / ps)
        POS, NRM, MAT, HIT = cast(gr, 0, -60, ps, W, H, 80, -110)
        A = ao(gr, POS, NRM, HIT)
        LP = (64, 60, 40)
        SH = shadow(gr, POS, NRM, HIT, LP)
        v = np.array(LP)[None, None, :] - POS; d = np.linalg.norm(v, axis=2) + 1e-6
        lam = np.clip((v * NRM).sum(2) / d, 0, 1)
        att = np.clip(1 - d / 150, 0, 1) ** 1.2
        lum = .16 + .95 * lam * att * (.25 + .75 * SH)
        lum *= .55 + .45 * A
        OU, OTH, OID, OR = attrs(gr, POS, HIT)
        out.append((tag, ps, POS, NRM, MAT, HIT, lum, OU, OTH, OID, OR))
    panels = []
    for pal_name, PAL in [('明るい灰', BARK_PALE), ('暗い茶', BARK_BROWN)]:
        for (tag, ps, POS, NRM, MAT, HIT, lum, OU, OTH, OID, OR) in out:
            H, W = HIT.shape
            alb, mz = bark_albedo(POS, NRM, OU, OTH, OID, OR, HIT & (MAT == 1), PAL)
            img = np.zeros((H, W, 3)); img[:] = hx('#06080b')
            ys, xs = np.mgrid[0:H, 0:W]
            stone = pal('#2e2a2b', '#433c3a', '#5c524c', '#7d6f60', '#a08f7a', '#bba792', '#d2bea8', '#e6d5c0')
            L = np.clip(lum * 1.35, 0, 1)
            if tag == 'hi':
                rootc = np.clip(PAL[3] / 255 * 0 + (PAL[2] + (PAL[7] - PAL[2]) * (L * alb)[..., None]), 0, 255)
                mossc = MOSS[1] + (MOSS[5] - MOSS[1]) * (L[..., None])
                rootc = rootc * (1 - mz[..., None]) + mossc * mz[..., None]
                stc = stone[1] + (stone[7] - stone[1]) * L[..., None]
                img = np.where((HIT & (MAT == 1))[..., None], rootc, img)
                img = np.where((HIT & (MAT == 2))[..., None], stc, img)
            else:
                qi = quantize(np.clip(L * alb * 1.25, 0, 1), xs, ys, 8, .35)
                qi = majority(qi, HIT & (MAT == 1))
                qm = quantize(L, xs, ys, 6, .7)
                rootc = PAL[qi]
                rootc = np.where((mz > .5)[..., None], MOSS[np.clip(qm, 0, 5)], rootc)
                qs = quantize(L, xs, ys, 8, .7)
                img = np.where((HIT & (MAT == 1))[..., None], rootc, img)
                img = np.where((HIT & (MAT == 2))[..., None], stone[qs], img)
                # 輪郭：奥行きが跳ぶ所の奥側を暗く
                key = POS[..., 1] + POS[..., 2]
                key = np.where(HIT, key, -1e9)
                dk = np.zeros((H, W))
                for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    dk = np.maximum(dk, np.roll(np.roll(key, dy, 0), dx, 1) - key)
                edge = (dk > 3) & HIT
                img = np.where(edge[..., None], img * .45, img)
                img = np.where((HIT & (MAT == 1) & ~np.roll(HIT & (MAT == 1), 1, 0) & (MAT != 2))[..., None], img, img)
            panels.append((pal_name, tag, img))
    # 骨組み（育てた節を線で。太さ＝管の模型の半径、色＝高さ）
    sk = Image.new('RGB', (384, 690), (8, 10, 13)); dk = ImageDraw.Draw(sk)
    for (x0, y0, z0, x1, y1, z1) in [(14, 30, -12, 114, 110, 0), (30, 22, 0, 98, 30, 26), (72, 60, 0, 84, 68, 30), (40, 74, 0, 58, 86, 9)]:
        dk.rectangle([x0 * 3, (y0 - z1 + 60) * 3, x1 * 3, (y1 - z1 + 60) * 3], outline=(90, 84, 78))
        dk.rectangle([x0 * 3, (y1 - z1 + 60) * 3, x1 * 3, (y1 - z0 + 60) * 3], outline=(60, 56, 52))
    for nd in sorted(G.nodes, key=lambda n: n.p[1] + n.p[2]):
        if nd.parent is None: continue
        a_, b_ = nd.parent.p, nd.p
        hcol = np.clip((nd.p[2] + 110) / 150, 0, 1)
        col = tuple(int(c) for c in (np.array([60, 110, 200]) * (1 - hcol) + np.array([240, 200, 120]) * hcol))
        dk.line([a_[0] * 3, (a_[1] - a_[2] + 60) * 3, b_[0] * 3, (b_[1] - b_[2] + 60) * 3], fill=col, width=max(1, int(nd.r * 3 * .9)))
    sc = 3
    tiles = [('骨組み', 'sk', sk)]
    for (pal_name, tag, img) in panels:
        if pal_name == '暗い茶' and tag == 'hi': continue
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
        if tag == 'px': im = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
        tiles.append((pal_name, tag, im))
    TW, TH = tiles[1][2].width, tiles[1][2].height
    sheet = Image.new('RGB', (TW * len(tiles) + 10 * (len(tiles) + 1), TH + 60), (18, 20, 24))
    d = ImageDraw.Draw(sheet)
    try: f = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 20)
    except Exception: f = None
    for i, (pal_name, tag, im) in enumerate(tiles):
        x = 10 + i * (TW + 10); sheet.paste(im.resize((TW, TH)) if im.size != (TW, TH) else im, (x, 50))
        lab = '① 育てた骨組み（太さ＝管の模型）' if tag == 'sk' else (f'② {pal_name}・3D' if tag == 'hi' else f'{"③" if pal_name == "明るい灰" else "④"} {pal_name}・ドット')
        d.text((x, 14), lab, font=f, fill=(230, 220, 200))
    sheet.save(os.path.join(outdir, 'study.png'))
    print('study ->', os.path.join(outdir, 'study.png'), len(G.nodes), 'nodes', len(segs), 'segs')

if __name__ == '__main__':
    study(sys.argv[1] if len(sys.argv) > 1 else os.path.join(__import__('tempfile').gettempdir(), 'root3d-out'))
