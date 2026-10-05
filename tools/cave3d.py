#!/usr/bin/env python3
"""石の層の岩と鍾乳石（石筍の群れ）を 3D で組み、遺跡（ruin3d.py）と同じ視点でドット絵の素に落とす。

  python3 tools/cave3d.py [出力ディレクトリ] [--apply] [--only=名前,名前]
    --apply を付けると proto/cave-look.js の CAVE_SPR（/*CAVE_SPR_BEGIN*/〜/*CAVE_SPR_END*/）を書き換える

遺跡との違い：**光を焼き込まない。** 石の層の岩は、主人公のランタンがある側の面が明るくなる
（今までの手描きの岩もそうしていた）。だからドットごとに「面の向き（法線）」と「くぼみの暗さ（AO）」を
書き出し、ゲームが毎フレーム、ランタンの位置から明るさを出して石灰岩の5段（P_.lime）に落とす。
面の向きは64方向の表（フィボナッチ球）の番号で持つ。角ばった岩は面ごとに同じ番号になるので、
ゲームで光を当てても面がそのまま平らな色の面になる（ドット絵の面の切り方が崩れない）。

書き出す物（スプライト1枚ごと）:
  m   … 材質（. 透明／r 岩／m 苔（岩は黄土色の点2つまで）／t 石筍の濡れた先／g 石筍の成長の輪／k 奥の面との境（線を引く））
  n   … 面の向き（NRM の番号、64進1文字）
  a   … 明るさの倍率（くぼみ・帯・肌のむら。0〜9 → 0.40〜1.00）
  hts … ドットごとの地面からの高さ（ドット、36進1文字）
  ax ay … 原点（地面の中心）がスプライトのどこに来るか
  foot … 接地の楕円 [rx, ry]（ドット）。ゲームはここを岩として灯りの影を落とす
  obs  … 当たり判定の円 [dx, dy, r]
"""
import sys, os, math, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from pillar3d import fbm, vnoise, _hash, THETA, PX
from ruin3d import Scene, GS

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = ARGS[0] if ARGS else os.path.join(__import__('tempfile').gettempdir(), 'cave3d-out')
os.makedirs(OUT, exist_ok=True)
SS = 6
ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'
B36 = '0123456789abcdefghijklmnopqrstuvwxyz'

def nrm_table(n=64):
    """面の向きの表（ゲーム側 NRM と同じ作り方）。y が上、z が手前（画面の下）"""
    ga = math.pi * (3 - math.sqrt(5)); out = []
    for i in range(n):
        y = 1 - (i + 0.5) / n * 2; r = math.sqrt(max(0, 1 - y * y)); ph = i * ga
        out.append((math.cos(ph) * r, y, math.sin(ph) * r))
    return np.array(out)
NRM = nrm_table()

# ---------------- 形 ----------------
class Boulder:
    """角ばった石灰岩の塊：平面の交わり（凸多面体）。z は地面が縮まないぶん2倍で組む"""
    def __init__(self, c, rx, ry, rz, seed, nplanes=11, moss=0.3, tone=1.0, tilt=0.0):
        self.c, self.seed, self.moss, self.tone = np.array(c, float), seed, moss, tone
        rng = np.random.default_rng(seed)
        ns, hs = [], []
        for k in range(nplanes):
            while True:
                v = rng.normal(size=3); v /= np.linalg.norm(v)
                if v[1] > -0.25: break
            v[1] = v[1] + tilt * v[0]
            # 楕円体の支持関数で距離を決め、少し内へ（削れた面）
            s = math.sqrt((rx * v[0]) ** 2 + (ry * v[1]) ** 2 + (rz * v[2]) ** 2) / np.linalg.norm(v)
            v = v / np.linalg.norm(v)
            ns.append(v); hs.append(s * rng.uniform(0.86, 1.0))
        # 上の面を1枚は必ず（平らな頂＝いちばん明るい面）
        top = np.array([rng.normal(0, 0.18), 1, rng.normal(0, 0.12)]); top /= np.linalg.norm(top)
        ns.append(top); hs.append(ry * rng.uniform(0.62, 0.72))     # 頂の平らな面を広く（見える面の3割前後）
        self.N, self.Hh = np.array(ns), np.array(hs)
        self.ext = np.array([rx, ry, rz])
    def sdf(self, p):
        q = p - self.c
        d = (q @ self.N.T - self.Hh).max(-1)
        # 角を少し落とす（箱に見えないように）：楕円体との混ぜ
        e = np.sqrt(((q / (self.ext * 1.35)) ** 2).sum(-1)) - 1.0
        return np.maximum(d, e * self.ext.min() * 1.35)
    def aabb(self): return self.c - self.ext - 0.2, self.c + self.ext + 0.2
    def albedo(self, p, n):
        a = self.tone * (1.0 + 0.10 * (fbm(p * np.array([1.4, 2.6, 1.4]), self.seed + 3) - 0.5))
        # 石灰岩の層理：横に走る細い暗い筋（途切れながら）
        y = p[..., 1] - self.c[1]
        band = (np.abs(((y + 0.07 * fbm(p * 1.3, self.seed + 9)) / 0.42) % 1 - 0.5) < 0.07) & (fbm(p * 1.1, self.seed + 4) > 0.45)
        return a - 0.14 * band

class Stalagmite:
    """石筍：根元が広がる（流れ石）円錐。成長の輪（帯）と、滴りのこぶ。先は丸く濡れている。
       断面は z を2倍（画面で丸く見える）"""
    def __init__(self, c, R, H, seed, lean=(0.0, 0.0), skirt=0.6, lumps=0.035, moss=0.25):
        self.c, self.R, self.H, self.seed = np.array(c, float), R, H, seed
        self.lean, self.skirt, self.lumps, self.moss, self.tone = lean, skirt, lumps, moss, 1.0
    def radius(self, y, ang, p):
        t = np.clip(y / self.H, 0, 1)
        r = self.R * (1 - t) ** 0.7 + 0.2 * self.R * (1 - t ** 3)
        r = r * (1 + 0.05 * np.sin(y * math.cos(THETA) * PX / 7.5 * 2 * math.pi + self.seed))   # ふくらみ（±5%・7.5ドット周期＝輪の5ドットと揃えない）
        lobes = 0.55 + 0.45 * np.maximum(0, np.cos(3 * ang + self.seed)) ** 2               # 流れ石の舌（3つ）
        r = r + self.skirt * self.R * lobes * np.exp(-np.maximum(y, 0) / (0.16 * self.H))   # 根元の流れ石
        r = r + self.lumps * self.R * (fbm(np.stack([np.cos(ang) * 2, y * 2.2, np.sin(ang) * 2], -1), self.seed) - 0.5) * 2

        return r
    def sdf(self, p):
        q = p - self.c
        y = q[..., 1]
        x = q[..., 0] - self.lean[0] * y; z = (q[..., 2] - self.lean[1] * y) / 2.0
        ang = np.arctan2(z, x); rr = np.sqrt(x * x + z * z)
        r = self.radius(y, ang, p)
        d_side = (rr - r) * 0.7
        d_top = y - self.H
        tipr = 0.32 * self.R + 0.06
        d = np.maximum(d_side, d_top)
        # 先を丸める
        tip = np.sqrt(x * x + z * z + (y - (self.H - tipr)) ** 2) - tipr
        d = np.where(y > self.H - tipr, np.minimum(np.maximum(d_side, d_top), tip), d)
        return d
    def aabb(self):
        e = self.R * (1 + self.skirt) + 0.3
        lx, lz = abs(self.lean[0]) * self.H, abs(self.lean[1]) * self.H
        return self.c - np.array([e + lx, 0.1, 2 * e + lz]), self.c + np.array([e + lx, self.H + 0.2, 2 * e + lz])
    def albedo(self, p, n):
        y = p[..., 1] - self.c[1]
        a = 1.0 + 0.06 * (fbm(p * np.array([2.0, 0.6, 2.0]), self.seed + 3) - 0.5)
        drip = fbm(np.stack([np.arctan2(p[..., 2] - self.c[2], p[..., 0] - self.c[0]) * 3.0, y * 0.25, y * 0.0], -1), self.seed + 11)
        a = a + 0.10 * (drip > 0.62)                                                       # 縦に流れた白い筋
        return a

class Column:
    """鍾乳洞の石柱（石筍と鍾乳石がつながった物）。ヴェラの大広間の柱（2026-10-03）。
       根元は流れ石で広がり、上は天井へ向けて広がって闇に溶ける（上の方ほど暗くする）。くびれ・ふくらみ・成長の輪。
       断面は z を2倍（画面で丸く見える）"""
    def __init__(self, c, R, H, seed, moss=0.15):
        self.c, self.R, self.H, self.seed, self.moss, self.tone = np.array(c, float), R, H, seed, moss, 1.0
    def radius(self, y, ang):
        t = np.clip(y / self.H, 0, 1)
        r = self.R * (0.80 + 0.50 * np.exp(-np.maximum(y, 0) / (0.10 * self.H)) + 0.12 * t)
        r = r * (1 + 0.06 * np.sin(y * math.cos(THETA) * PX / 9.0 * 2 * math.pi + self.seed) + 0.05 * np.sin(t * 5.0 + self.seed * 1.3))
        lobes = 0.6 + 0.4 * np.maximum(0, np.cos(4 * ang + self.seed)) ** 2
        r = r + 0.35 * self.R * lobes * np.exp(-np.maximum(y, 0) / (0.06 * self.H))       # 流れ石の舌
        r = r + 0.035 * self.R * (fbm(np.stack([np.cos(ang) * 2, y * 1.2, np.sin(ang) * 2], -1), self.seed) - 0.5) * 2
        return r
    def sdf(self, p):
        q = p - self.c
        y = q[..., 1]; x = q[..., 0]; z = q[..., 2] / 2.0
        ang = np.arctan2(z, x); rr = np.sqrt(x * x + z * z)
        return np.maximum((rr - self.radius(y, ang)) * 0.7, y - self.H)
    def aabb(self):
        e = self.R * 1.8 + 0.3
        return self.c - np.array([e, 0.1, 2 * e]), self.c + np.array([e, self.H + 0.2, 2 * e])
    def albedo(self, p, n):
        y = p[..., 1] - self.c[1]
        a = 1.0 + 0.06 * (fbm(p * np.array([2.0, 0.6, 2.0]), self.seed + 3) - 0.5)
        drip = fbm(np.stack([np.arctan2(p[..., 2] - self.c[2], p[..., 0] - self.c[0]) * 3.0, y * 0.25, y * 0.0], -1), self.seed + 11)
        a = a + 0.10 * (drip > 0.62)
        return a * np.clip((self.H - y) / (0.35 * self.H), 0.10, 1.0)               # 上は天井の闇へ溶ける

# ---------------- 描く ----------------
def render(parts, ground_moss=None, gs=None):
    import ruin3d
    big = any(isinstance(pt, Column) for pt in parts)
    ruin3d.GS = gs or (0.09 if big else 0.05)  # 柱は大きいので距離場の格子を粗く（細かいとメモリが足りない）。壁（wall3d.py）は gs で渡す
    globals()['GS'] = ruin3d.GS
    sc = Scene('c', parts); sc.bake()
    right = np.array([1.0, 0, 0]); up = np.array([0, math.cos(THETA), -math.sin(THETA)]); fwd = np.array([0, -math.sin(THETA), -math.cos(THETA)])
    corners = np.array([[x, y, z] for x in (sc.lo[0], sc.hi[0]) for y in (0, sc.hi[1]) for z in (sc.lo[2], sc.hi[2])])
    sx = corners @ right * PX; sy = -(corners @ up) * PX
    x0, x1 = math.floor(sx.min()) - 2, math.ceil(sx.max()) + 2
    y0, y1 = math.floor(sy.min()) - 2, math.ceil(sy.max()) + 3
    W, H = x1 - x0, y1 - y0
    xs = x0 + (np.arange(W * SS) + 0.5) / SS; ys = y0 + (np.arange(H * SS) + 0.5) / SS
    gx, gy = np.meshgrid(xs, ys)
    org = (gx[..., None] * right - gy[..., None] * up) / PX - fwd * 30
    t = np.zeros(gx.shape); hit = np.zeros(gx.shape, bool); alive = np.ones(gx.shape, bool)
    for it in range(260):
        if not alive.any(): break
        p = org + fwd * t[..., None]
        d = np.ones(gx.shape); d[alive] = sc.sample(p[alive])
        nh = alive & (d < 0.004); hit |= nh
        alive &= ~nh & (t < 60)
        t = np.where(alive, t + np.maximum(d * 0.8, 0.004), t)
    p = org + fwd * t[..., None]
    e = GS
    def grad(pp):
        g = np.stack([sc.sample(pp + [e, 0, 0]) - sc.sample(pp - [e, 0, 0]), sc.sample(pp + [0, e, 0]) - sc.sample(pp - [0, e, 0]), sc.sample(pp + [0, 0, e]) - sc.sample(pp - [0, 0, e])], -1)
        return g / (np.linalg.norm(g, axis=-1, keepdims=True) + 1e-9)
    n = np.zeros(p.shape); n[hit] = grad(p[hit])
    pid = np.full(gx.shape, -1); pid[hit] = sc.sample(p[hit] - n[hit] * 0.02, order=0).astype(int)
    ao = np.ones(gx.shape)
    for k, s in enumerate((0.08, 0.2, 0.4)):
        ao[hit] -= (s - sc.sample(p[hit] + n[hit] * s)) * (0.9 / (k + 1))
    ao = np.clip(ao, 0.4, 1)
    alb = np.ones(gx.shape); moss = np.zeros(gx.shape, bool)
    for k, pt in enumerate(parts):
        m = hit & (pid == k)
        if not m.any(): continue
        alb[m] = pt.albedo(p[m], n[m])
        y = p[m][:, 1]; nn = n[m]
        lf = fbm(p[m] * 1.6 + 3.1, pt.seed + 9)
        top = nn[:, 1] > 0.72; low = (y < 0.35) & (nn[:, 1] < 0.5)
        moss[m] = (top & (lf > 0.80 - 0.25 * pt.moss)) | (low & (lf > 0.74 - 0.2 * pt.moss))
    # 濡れた先（先の1〜2ドット）と成長の輪（5ドットおきの細い線。ゲームが光の側だけ1段落とす）
    wet = np.zeros(gx.shape, bool); ring = np.zeros(gx.shape, bool)
    RING = 5.0 / (math.cos(THETA) * PX)
    for k, pt in enumerate(parts):
        if isinstance(pt, Stalagmite):
            m = hit & (pid == k); yy = p[m][:, 1] - pt.c[1]
            wet[m] = yy > pt.H - 0.42
            ang = np.arctan2((p[m][:, 2] - pt.c[2]) / 2.0, p[m][:, 0] - pt.c[0]); kk = np.floor(yy / RING)
            arc = np.cos(ang - kk * 2.1 - pt.seed) > 0.0                                  # 輪は半周だけ、輪ごとにずらす
            ring[m] = (np.abs((yy / RING) % 1 - 0.5) > 0.40) & (yy > 0.5) & (yy < pt.H - 0.6) & arc
        elif isinstance(pt, Column):
            m = hit & (pid == k); yy = p[m][:, 1] - pt.c[1]
            ang = np.arctan2((p[m][:, 2] - pt.c[2]) / 2.0, p[m][:, 0] - pt.c[0]); kk = np.floor(yy / RING)
            arc = np.cos(ang - kk * 2.1 - pt.seed) > 0.0
            ring[m] = (np.abs((yy / RING) % 1 - 0.5) > 0.40) & (yy > 0.8) & (yy < pt.H * 0.6) & arc
    # ドットへ：覆いは重みで、面の向き・部品は真ん中の標本で（面の境をにじませない）
    wy = np.exp(-(((np.arange(SS) + 0.5) / SS - 0.5) / 0.34) ** 2); wk = np.outer(wy, wy); wk /= wk.sum()
    def pool(a): return (a.reshape(H, SS, W, SS) * wk[None, :, None, :]).sum(axis=(1, 3))
    cov = pool(hit.astype(float))
    c = SS // 2
    def mid(a): return a.reshape(H, SS, W, SS, *a.shape[2:])[:, c, :, c]
    hitc = mid(hit); nc = mid(n); pc = mid(pid)
    # 真ん中が外れたドットは、当たった標本の平均の向き
    nav = np.stack([pool(np.where(hit, n[..., i], 0)) for i in range(3)], -1)
    nc = np.where(hitc[..., None], nc, nav); nc /= (np.linalg.norm(nc, axis=-1, keepdims=True) + 1e-9)
    A = pool(np.where(hit, ao * alb, 0)) / np.maximum(cov, 1e-6)
    M = pool(moss.astype(float)) / np.maximum(cov, 1e-6)
    WT = pool(wet.astype(float)) / np.maximum(cov, 1e-6)
    DEP = pool(np.where(hit, t, 0)) / np.maximum(cov, 1e-6)
    HT = pool(np.where(hit, p[..., 1], 0)) / np.maximum(cov, 1e-6)
    RG = pool(ring.astype(float)) / np.maximum(cov, 1e-6)
    # 柱の天辺（切り口）は見せない：上を向いた面で、高さが柱の上端近く
    cap = np.zeros(gx.shape, bool)
    for k, pt in enumerate(parts):
        if isinstance(pt, Column):
            m = hit & (pid == k); cap[m] = (p[m][:, 1] - pt.c[1] > pt.H - 0.6) & (n[m][:, 1] > 0.5)
    CAP = pool(cap.astype(float)) / np.maximum(cov, 1e-6)
    COLH = max([pt.H for pt in parts if isinstance(pt, Column)] or [0])
    ROCK = np.array([isinstance(pt, Boulder) for pt in parts] + [False])
    return dict(W=W, H=H, cov=cov, N=nc, A=A, M=M, WT=WT, RG=RG, DEP=DEP, HT=HT, ax=-x0, ay=-y0, PID=pc, ROCK=ROCK, CAP=CAP, COLH=COLH)

BAY4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
FADE = 9.0

def encode(r):
    W, H = r['W'], r['H']
    on = r['cov'] >= 0.45
    # 小さな苔の点は捨てる（3ドット未満）
    m = [['.'] * W for _ in range(H)]
    ycut = -1
    if r['COLH']:
        cy_, cx_ = np.nonzero((r['CAP'] >= 0.3) & on)
        ycut = int(cy_.max()) + 1 if len(cy_) else -1
    for y in range(H):
        for x in range(W):
            if not on[y, x]: continue
            if r['COLH']:
                # 柱の上は、画面の横一直線で切って、下へ向かって網目で闇から現れる（切り口の楕円を抜くと、
                # 縁だけ残って城の胸壁のような凹みになった）。ycut＝切り口が見える一番下の行
                if y <= ycut: continue
                u = (y - ycut) / FADE
                if u < 1 and BAY4[y & 3][x & 3] >= u * u * 16: continue
            m[y][x] = 't' if r['WT'][y, x] >= 0.5 else ('m' if r['M'][y, x] >= 0.5 else ('g' if r['RG'][y, x] >= 0.5 else 'r'))
    # 岩の苔は黄土色の点を2つまで（大きな苔は「シール」に見える）
    pts = sorted([(r['M'][y, x], y, x) for y in range(H) for x in range(W) if m[y][x] == 'm' and r['ROCK'][r['PID'][y, x]]], reverse=True)
    for k, (_, y, x) in enumerate(pts):
        if k >= 2: m[y][x] = 'r'
    seen = set()
    for y in range(H):
        for x in range(W):
            if m[y][x] != 'm' or (y, x) in seen: continue
            st, comp = [(y, x)], []; seen.add((y, x))
            while st:
                cy, cx = st.pop(); comp.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and (ny, nx) not in seen and m[ny][nx] == 'm': seen.add((ny, nx)); st.append((ny, nx))
            if len(comp) < 3 and not r['ROCK'][r['PID'][comp[0]]]:
                for cy, cx in comp: m[cy][cx] = 'r'
    # 奥の面との境（手前の岩が後ろの岩に重なる所）：右か下が、ずっと奥の面
    D = r['DEP']; P = r['PID']
    for y in range(H):
        for x in range(W):
            if m[y][x] == '.': continue
            for ny, nx in ((y, x + 1), (y + 1, x), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and m[ny][nx] != '.' and D[ny, nx] - D[y, x] > 1.2 and P[ny, nx] != P[y, x]:
                    m[y][x] = 'k'; break
    idx = np.argmax(r['N'] @ NRM.T, axis=-1)
    rows = [''.join(m[y]) for y in range(H)]
    nrows = [''.join(ALPHA[idx[y, x]] if m[y][x] != '.' else '.' for x in range(W)) for y in range(H)]
    arows = [''.join(str(int(np.clip(round((r['A'][y, x] - 0.4) / 0.6 * 9), 0, 9))) if m[y][x] != '.' else '.' for x in range(W)) for y in range(H)]
    hts = [''.join(B36[int(min(35, max(0, round(r['HT'][y, x] * math.cos(THETA) * PX))))] if m[y][x] != '.' else '0' for x in range(W)) for y in range(H)]
    # 余白を詰める
    ys = [y for y in range(H) if any(c != '.' for c in rows[y])]; xs = [x for x in range(W) if any(rows[y][x] != '.' for y in range(H))]
    ya, yb, xa, xb = max(0, ys[0] - 1), min(H, ys[-1] + 2), max(0, xs[0] - 1), min(W, xs[-1] + 2)
    cut = lambda a: [row[xa:xb] for row in a[ya:yb]]
    return dict(w=xb - xa, h=yb - ya, ax=r['ax'] - xa, ay=r['ay'] - ya, m=cut(rows), n=cut(nrows), a=cut(arows), hts=cut(hts))

def preview(e, path, lamp=(-1.0, 0.8, 0.6), scale=6):
    """確かめ用：石灰岩の5段で、左上手前にランタンがあるときの見え方"""
    from PIL import Image
    LIME = ['#0e1626', '#1c2a42', '#324664', '#566e90', '#8ea6c4']; MS = ['#2a2a14', '#6a6428', '#b0a044']
    hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    l = np.array(lamp, float); l /= np.linalg.norm(l)
    im = Image.new('RGB', (e['w'], e['h']), (60, 66, 80))
    for y in range(e['h']):
        for x in range(e['w']):
            c = e['m'][y][x]
            if c == '.': continue
            nv = NRM[ALPHA.index(e['n'][y][x])]; a = 0.4 + int(e['a'][y][x]) / 9 * 0.6
            I = (0.30 + 0.85 * max(0, float(nv @ l))) * a
            if c == 'm': col = MS[min(2, int(I * 2.99))]
            else:
                i = int(min(0.999, I) * 5);
                if c == 't': i = min(4, i + 1)
                if c == 'k': i = max(0, min(i, 2) - 1)
                col = LIME[i]
            im.putpixel((x, y), hexc(col))
    im.resize((e['w'] * scale, e['h'] * scale), Image.NEAREST).save(path)

# ---------------- 部品 ----------------
def obs_circle(x, z, r): return [round(x * PX, 1), round(z * math.sin(THETA) * PX, 1), round(r, 1)]

def rock(name, seed, rx, ry, rz, pair=None, moss=0.3):
    parts = [Boulder((0, ry * 0.62, 0), rx, ry, rz, seed, moss=moss)]
    obs = [obs_circle(0, 0, rx * PX * 0.85)]
    foot = [round(rx * PX * 0.95), round(rz * math.sin(THETA) * PX * 0.9)]
    if pair:
        px_, pz_, s = pair
        parts.append(Boulder((px_, ry * s * 0.6, pz_), rx * s, ry * s, rz * s, seed + 7, nplanes=10, moss=moss))
        obs.append(obs_circle(px_, pz_, rx * s * PX * 0.8))
    return name, parts, dict(obs=obs, foot=foot, kind='rock')

def stal(name, seed, main, others=(), moss=0.25):
    """main/others: (x, z, R, H, lean)"""
    parts = []; obs = []
    for k, (x, z, R, H, lean) in enumerate((main,) + tuple(others)):
        parts.append(Stalagmite((x, 0, z), R, H, seed + k * 13, lean=lean, skirt=0.42 if k == 0 else 0.3, moss=moss))
        obs.append(obs_circle(x, z, R * PX * (1.1 if k == 0 else 0.9)))
    R0 = main[2]
    foot = [round(R0 * PX * 1.3), round(R0 * 2 * math.sin(THETA) * PX * 1.2)]
    return name, parts, dict(obs=obs, foot=foot, kind='stal')

def column(name, seed, R, H):
    parts = [Column((0, 0, 0), R, H, seed)]
    foot = [round(R * PX * 1.25), round(R * 2 * math.sin(THETA) * PX * 1.15)]
    return name, parts, dict(obs=[], foot=foot, kind='stal')

SCENES = [
    lambda: column('column_a', 41, 1.75, 15.0),
    lambda: column('column_b', 42, 1.85, 15.5),
    lambda: column('column_c', 43, 1.7, 14.5),
    lambda: rock('rock_a', 11, 1.8, 1.3, 3.0, moss=0.5),
    lambda: rock('rock_b', 12, 2.2, 1.5, 3.8, moss=0.6),
    lambda: rock('rock_c', 13, 1.3, 1.0, 2.4),
    lambda: rock('rock_d', 14, 1.8, 1.4, 3.2, pair=(2.6, 1.0, 0.5)),
    lambda: rock('rock_e', 15, 2.4, 1.6, 3.4, pair=(-2.9, 0.6, 0.42), moss=0.5),
    lambda: rock('rock_f', 16, 1.1, 1.3, 2.0),
    lambda: stal('stal_a', 31, (0, 0, 1.25, 7.0, (0.05, 0.0)), [(1.5, 1.0, 0.6, 3.0, (0.06, 0)), (-1.3, 1.3, 0.45, 2.1, (-0.05, 0))]),
    lambda: stal('stal_b', 32, (0, 0, 1.35, 6.0, (-0.06, 0.0)), [(-1.6, 0.8, 0.7, 3.4, (-0.04, 0))]),
    lambda: stal('stal_c', 33, (0, 0, 1.15, 7.8, (0.05, 0.0)), [(1.4, 0.6, 0.55, 3.0, (0.04, 0)), (2.2, 1.7, 0.38, 2.3, (0, 0)), (-1.3, 1.2, 0.5, 2.6, (-0.05, 0))], moss=0.4),
    lambda: stal('stal_d', 34, (0, 0, 1.05, 5.4, (0.04, 0)), [(1.4, -0.4, 0.85, 3.0, (0.06, 0))]),
]

def main():
    only = None
    for a in sys.argv[1:]:
        if a.startswith('--only='): only = set(a[7:].split(','))
    res = {}
    for mk in SCENES:
        name, parts, meta = mk()
        if only and name not in only: continue
        r = render(parts); e = encode(r)
        e.update(meta)
        res[name] = e
        preview(e, os.path.join(OUT, name + '.png'))
        print(name, e['w'], e['h'], 'ax', e['ax'], e['ay'])
    json.dump(res, open(os.path.join(OUT, 'cave_spr.json'), 'w'))
    if '--apply' in sys.argv:
        p = os.path.join(os.path.dirname(__file__), '..', 'proto', 'cave-look.js')
        s = open(p, encoding='utf-8').read()
        a, b = s.index('/*CAVE_SPR_BEGIN*/'), s.index('/*CAVE_SPR_END*/')
        cur = json.loads(s[a + len('/*CAVE_SPR_BEGIN*/'):b].split('=', 1)[1].strip().rstrip(';'))
        cur.update(res)
        s = s[:a] + '/*CAVE_SPR_BEGIN*/const CAVE_SPR=' + json.dumps(cur, separators=(',', ':')) + ';' + s[b:]
        open(p, 'w', encoding='utf-8').write(s)
        print('applied', len(res))

if __name__ == '__main__':
    main()
