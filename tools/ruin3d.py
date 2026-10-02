#!/usr/bin/env python3
"""倒れた石柱と部屋の残骸を 3D で組み、石柱（pillar3d.py）と同じ視点・同じ光でドット絵に落とす。

  python3 tools/ruin3d.py [出力ディレクトリ] [--apply]
    --apply を付けると proto/cave-look.js の RUIN_BIG（/*RUIN_BIG_BEGIN*/〜/*RUIN_BIG_END*/）を書き換える

見本（ユーザー添付）：砂色の石の塊を積んだ壁、象形文字を彫った石板や柱、帯と開いた柱頭のある柱、
崩れて転がった塊、敷石と段。色は拠点の砂色（RP_T）とオリーブの苔で、pillar3d.py と同じ。

石柱より部品が多い（部屋は塊が数十個）ので、距離場を**格子に焼いてから**レイを飛ばす
（部品ごとの距離を、その部品の箱の中だけで計算して最小を取る）。

書き出す物（スプライト1枚ごと）:
  rows  … 色の文字（. 透明／0〜6 石の段／a b c 苔／o 輪郭／s 地面に落ちた影／G H 足もとの苔の地面）
  hts   … ドットごとの「地面からの高さ」（ドット、36進1文字）。ゲームはこれで、
          そのドットの真下の地面が水かどうかを見て、沈んだ所は水に透かし、水際は濡らす
  ax ay … 原点（地面の中心）がスプライトのどこに来るか
  obs   … 当たり判定の円 [dx, dy, r]（原点からのドット）
"""
import sys, os, math, json
import numpy as np
from scipy.ndimage import map_coordinates
sys.path.insert(0, os.path.dirname(__file__))
from pillar3d import fbm, vnoise, _hash, THETA, PX, LIGHT, AMB, TONES, MOSS, OL, TH
AMB_R = 0.42      # 横倒しの円柱は下半分が暗くなりすぎるので、柱より少し明るい環境光

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = ARGS[0] if ARGS else os.path.join(__import__('tempfile').gettempdir(), 'ruin3d-out')
os.makedirs(OUT, exist_ok=True)
SS = 6            # 1 ドットあたりの標本（縦横）
GS = 0.05         # 距離場の格子（単位）。1 ドット = 0.25 単位

def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

class Part:
    """kind: box(half=(hx,hy,hz)) / cyl(r,h) / frus(r0,r1,h)。M は局所→世界の回転（列が局所軸）、c は中心。
       grooves: 局所 y の位置の輪の溝（幅1ドット・深さ半ドット）。ridges=True で溝の脇を明るく
       panel: 'glyph' でカメラを向いた面に彫り込みの石板（縁の影と照り＋2〜3列の象形文字）
       cut: (法線, 点, 荒れ) で折れ口。tone: 地の明るさの倍率。moss: 苔の付きやすさ"""
    def __init__(self, kind, c, M=None, half=None, r=None, r1=None, h=None, bev=0.1, grooves=(), panel=None, cut=None,
                 seed=1, moss=0.5, tone=1.0, joint=False, jit=0.0, slab=False, crack=False, sunk=False, taper=0.0):
        self.kind, self.c, self.M = kind, np.array(c, float), (np.eye(3) if M is None else M)
        self.half, self.r, self.r1, self.h, self.bev = half, r, r1, h, bev
        self.grooves, self.panel, self.cut, self.seed, self.moss, self.tone, self.joint = grooves, panel, cut, seed, moss, tone, joint
        self.jit, self.slab, self.crack, self.sunk, self.taper = jit, slab, crack, sunk, taper

    def local(self, p):
        return (p - self.c) @ self.M

    def panel_rect(self):
        """カメラ側（局所 +z）の面の真ん中の石板の大きさ（半分）。10×8 ドット未満なら作らない"""
        if self.panel != 'glyph' or self.kind != 'box': return None
        hx, hy, hz = self.half
        pu, pv = min(hx - 0.45, 1.75), min(hy - 0.45, 1.35)
        if pu * 2 < 2.5 or pv * 2 < 2.3: return None
        return pu, pv

    def cutd(self, p):
        n, p0, rough = self.cut
        return ((p - p0) * n).sum(-1) + rough * (fbm(p * 1.5, self.seed + 5) - 0.5)

    def sdf(self, p):
        q = self.local(p)
        x, y, z = q[..., 0], q[..., 1], q[..., 2]
        b = self.bev
        if self.kind == 'box':
            hx, hy, hz = self.half
            dx, dy, dz = np.abs(x) - (hx - b), np.abs(y) - (hy - b), np.abs(z) - (hz - b)
            d = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2 + np.maximum(dz, 0) ** 2) + np.minimum(np.maximum(np.maximum(dx, dy), dz), 0) - b
            d = d + 0.025 * (fbm(p * 2.4, self.seed) - 0.5)
            pr = self.panel_rect()
            if pr is not None:                            # 石板は1ドットぶん彫り込む
                pu, pv = pr
                rx, ry, rz = np.abs(x) - pu, np.abs(y) - pv, np.abs(z - hz) - 0.28
                rec = np.sqrt(np.maximum(rx, 0) ** 2 + np.maximum(ry, 0) ** 2 + np.maximum(rz, 0) ** 2) + np.minimum(np.maximum(np.maximum(rx, ry), rz), 0)
                d = np.maximum(d, -rec)
        else:
            rr = np.sqrt(x * x + z * z)
            if self.kind == 'cyl': rad = self.r + self.jit + self.taper * (y / max(self.h, 0.1))
            else: rad = self.r + (self.r1 - self.r) * np.clip((y + self.h / 2) / self.h, 0, 1) ** 1.6   # 釣鐘のように開く
            rad = rad - 0.03 * fbm(p * np.array([3.0, 2.2, 3.0]), self.seed)
            for gy in self.grooves: rad = rad - 0.13 * np.exp(-((y - gy) / 0.11) ** 2)
            qx, qy = rr - (rad - b), np.abs(y) - (self.h / 2 - b)
            d = np.minimum(np.maximum(qx, qy), 0) + np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) - b
        if self.cut is not None: d = np.maximum(d, self.cutd(p) * 0.8)
        return d

    def aabb(self):
        if self.kind == 'box': e = np.abs(self.M) @ np.array(self.half)
        else:
            rm = max(self.r + self.jit, self.r1 or 0); e = np.abs(self.M) @ np.array([rm, self.h / 2, rm])
        return self.c - e - 0.15, self.c + e + 0.15

    def albedo(self, p, n):
        a = self.tone * (1.0 + 0.22 * (fbm(p * np.array([1.7, 0.85, 1.7]), self.seed + 3) - 0.5))
        q = self.local(p); nl = n @ self.M
        x, y, z = q[..., 0], q[..., 1], q[..., 2]
        if self.grooves and self.kind != 'box':      # 溝の脇の細い出っ張りは明るい
            for gy in self.grooves:
                rid = np.abs(np.abs(y - gy) - 0.24) < 0.08
                a = a + 0.10 * rid
        if self.grooves and self.kind != 'box':      # 溝そのものも中暗に（形だけだと落としたときに消える）
            for gy in self.grooves:
                a = a - 0.16 * (np.abs(y - gy) < 0.12)
        if self.kind == 'box' and self.slab:         # 敷石の継ぎ目：縁の1ドットを途切れながら中暗に
            hx, hy, hz = self.half
            ex = (np.abs(x) > hx - 0.25); ez = (np.abs(z) > hz - 0.5)
            run = fbm(p * np.array([1.2, 1, 0.6]), self.seed + 21) > 0.38
            back = (z < -hz + 0.5)
            a = a - 0.10 * ((ex | ez) & run & ~back) - 0.17 * (back & run)      # 継ぎ目は中、奥の縁だけ中暗（床を静かに）
            if self.sunk: a = a - 0.15 * (z < -hz + 0.5)          # 沈んだ敷石：奥の縁に影
            if self.crack:                                       # ひび：細い斜めの線
                k = self.seed % 7 / 7.0 - 0.5
                a = a - 0.18 * (np.abs(x - (z * (0.5 + k) + k * hx)) < 0.13) * (np.abs(z) < hz * 0.7)
        pr = self.panel_rect()
        if pr is not None:
            pu, pv = pr
            hx, hy, hz = self.half
            inside = (np.abs(x) < pu) & (np.abs(y) < pv) & (z > hz - 0.6) & (nl[..., 2] > 0.3)
            a = np.where(inside, self.tone * 0.96, a)                         # 石板の中は肌のむらを消す（象形が読めるように）
            cx_, cy_ = 0.25, 0.289
            iu = np.floor((x + pu) / cx_).astype(np.int64); iv = np.floor((pv - y) / cy_).astype(np.int64)
            nu = int((2 * pu) // cx_)
            core = inside & (iu >= 1) & (iu < nu - 1) & (iv >= 1)
            cu, cv = iu - 1, iv - 1
            col = cu // 3; within = cu % 3; slot_v = cv // 2
            hsh = np.vectorize(lambda a_, b_: _hash(int(a_), int(b_), 19, self.seed))(col, slot_v)
            pat = (hsh * 6).astype(np.int64); lu, lv = within, cv % 2
            on = ((pat == 0) & (lu == 0)) | (pat == 1) | ((pat == 2) & (lv == 0)) | ((pat == 3) & ((lu == 0) | (lv == 1))) | ((pat == 4) & (lu == 1))
            glyph = core & (within < 2) & on & (hsh < 0.7) & (iv < int((2 * pv) // cy_) - 1)
            a = a - 0.30 * glyph
        return a

class Scene:
    def __init__(self, name, parts, ground=None, obs=None):
        self.name, self.parts, self.ground, self.obs = name, parts, ground, obs or []

    def bake(self):
        lo = np.min([p.aabb()[0] for p in self.parts], axis=0) - 0.3
        hi = np.max([p.aabb()[1] for p in self.parts], axis=0) + 0.3
        lo[1] = min(lo[1], -0.3)
        self.lo, self.hi = lo, hi
        n = np.ceil((hi - lo) / GS).astype(int) + 1
        self.n = n
        F = np.full(n, 1.0, np.float32); ID = np.full(n, -1, np.int16)
        for k, pt in enumerate(self.parts):
            a, b = pt.aabb(); a = np.maximum(a - 0.3, lo); b = np.minimum(b + 0.3, hi)
            i0 = np.floor((a - lo) / GS).astype(int); i1 = np.ceil((b - lo) / GS).astype(int) + 1
            xs = lo[0] + np.arange(i0[0], i1[0]) * GS; ys = lo[1] + np.arange(i0[1], i1[1]) * GS; zs = lo[2] + np.arange(i0[2], i1[2]) * GS
            X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
            d = pt.sdf(np.stack([X, Y, Z], -1)).astype(np.float32)
            sub = F[i0[0]:i1[0], i0[1]:i1[1], i0[2]:i1[2]]; sid = ID[i0[0]:i1[0], i0[1]:i1[1], i0[2]:i1[2]]
            better = d < sub; sub[better] = d[better]; sid[better] = k
        F = np.maximum(F, -(lo[1] + np.arange(n[1]) * GS)[None, :, None])   # 地面より下は無い
        self.F, self.ID = F, ID

    def sample(self, p, order=1):
        c = ((p - self.lo) / GS).reshape(-1, 3).T
        inside = np.all((c >= 0) & (c <= (self.n - 1)[:, None]), axis=0)
        v = map_coordinates(self.F if order == 1 else self.ID, c, order=order, mode='nearest')
        if order == 1: v = np.where(inside, v, 1.0)
        return v.reshape(p.shape[:-1])

def render_scene(sc):
    sc.bake()
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
        d = np.ones(gx.shape)
        d[alive] = sc.sample(p[alive])
        nh = alive & (d < 0.004)
        hit |= nh
        alive &= ~nh & (t < 60)
        t = np.where(alive, t + np.maximum(d * 0.85, 0.004), t)
    p = org + fwd * t[..., None]
    e = GS
    def grad(pp):
        g = np.stack([sc.sample(pp + [e, 0, 0]) - sc.sample(pp - [e, 0, 0]), sc.sample(pp + [0, e, 0]) - sc.sample(pp - [0, e, 0]), sc.sample(pp + [0, 0, e]) - sc.sample(pp - [0, 0, e])], -1)
        return g / (np.linalg.norm(g, axis=-1, keepdims=True) + 1e-9)
    n = np.zeros(p.shape); n[hit] = grad(p[hit])
    pid = np.full(gx.shape, -1); pid[hit] = sc.sample(p[hit] - n[hit] * 0.02, order=0).astype(int)
    # 光・遮蔽・落ち影
    ao = np.ones(gx.shape)
    for k, s in enumerate((0.08, 0.18, 0.34)):
        ao[hit] -= (s - sc.sample(p[hit] + n[hit] * s)) * (0.8 / (k + 1))
    ao = np.clip(ao, 0.35, 1)
    def shadowed(pp, start):
        res = np.zeros(pp.shape[:-1], bool); tt = np.full(pp.shape[:-1], start)
        for it in range(48):
            q = pp + LIGHT * tt[..., None]; d = sc.sample(q)
            res |= d < 0.01; tt = tt + np.maximum(d, 0.03)
        return res
    sh = np.zeros(gx.shape, bool); sh[hit] = shadowed(p[hit] + n[hit] * 0.03, 0.05)
    dif = np.clip((n * LIGHT).sum(-1), 0, 1) * np.where(sh, 0.25, 1.0)
    lum = (AMB_R + 0.72 * dif) * ao
    lum = lum - 0.10 * np.clip(1 - p[..., 1] / 0.5, 0, 1) + 0.06 * np.clip(n[..., 1], 0, 1) ** 2
    lum = lum + 0.10 * np.clip((p[..., 1] - 0.4) / 1.6, 0, 1) * (n[..., 1] > 0.7)   # 高い上面ほど明るい（壁の上が床より浮く）
    alb = np.ones(gx.shape); moss = np.zeros(gx.shape, bool); brk = np.zeros(gx.shape, bool)
    for k, pt in enumerate(sc.parts):
        m = hit & (pid == k)
        if not m.any(): continue
        alb[m] = pt.albedo(p[m], n[m])
        y = p[m][:, 1]; nn = n[m]
        low = (y < 0.55) & (nn[:, 1] < 0.6)
        top = nn[:, 1] > 0.75
        lf = fbm(p[m] * 1.3 + 7.3, pt.seed + 9)
        mm = (low & (lf > 0.58 - 0.22 * pt.moss)) | (top & (lf > 0.80 - 0.12 * pt.moss))
        if pt.joint:                                   # 太鼓：継ぎ目の近くの下半分と、下の帯だけ（上の明るい面には付けない）
            ly = pt.local(p[m])[:, 1]; below = y < pt.c[1]
            mm = ((np.abs(np.abs(ly) - pt.h / 2) < 0.35) & below & (lf > 0.55)) | ((y < pt.c[1] - pt.r * 0.55) & (lf > 0.6))
        # 箱の上面：最も明るい色は手前左の縁の1ドットだけ（上面が白い箱に見えないように）
        if pt.kind == 'box' and not pt.slab:
            q = pt.local(p[m]); hx, hy, hz = pt.half
            topf = n[m][:, 1] > 0.7
            edge = (q[:, 2] > hz - 0.5) | (q[:, 0] < -hx + 0.3)
            cap = topf & ~edge
            lm = lum[m]; lm[cap] = np.minimum(lm[cap], 0.90); lum[m] = lm
        moss[m] = mm
        if pt.cut is not None:
            brk[m] = np.abs(pt.cutd(p[m]) * 0.8 - pt.sdf(p[m])) < 0.03
    lum = lum * alb
    lum[hit & (pid >= 0)] = lum[hit & (pid >= 0)]   # （上面の上限は albedo の前に掛けてある）
    # 地面：レイが当たらなかった所は y=0 の面に落とし、影と足もとの苔を見る
    tg = -org[..., 1] / fwd[1]; pg = org + fwd * tg[..., None]
    gm = ~hit
    gsh = np.zeros(gx.shape, bool); gsh[gm] = shadowed(pg[gm] + [0, 0.01, 0], 0.05)
    foot = np.zeros(gx.shape, bool)
    if sc.ground is not None: foot[gm] = sc.ground(pg[gm])
    glum = np.where(gsh, 0.45, 0.85) * (1 + 0.2 * (fbm(pg * 1.4, 77) - 0.5))
    sand = foot & (fbm(pg * np.array([0.5, 1, 1.0]), 55) > 0.74)       # 足もとの砂だまり（大きめのかたまりで少しだけ）
    # ドットへ
    wy = np.exp(-(((np.arange(SS) + 0.5) / SS - 0.5) / 0.34) ** 2); wk = np.outer(wy, wy); wk /= wk.sum()
    def pool(a): return (a.reshape(H, SS, W, SS) * wk[None, :, None, :]).sum(axis=(1, 3))
    cov = pool(hit.astype(float))
    L = pool(np.where(hit, lum, 0)) / np.maximum(cov, 1e-6)
    M = pool(moss.astype(float)) / np.maximum(cov, 1e-6)
    DEP = pool(np.where(hit, t, 0)) / np.maximum(cov, 1e-6)
    PIDc = pid.reshape(H, SS, W, SS)[:, SS // 2, :, SS // 2]          # ドットの真ん中の標本の部品
    JNT = np.array([pt.joint for pt in sc.parts] + [False])
    HT = pool(np.where(hit, p[..., 1], 0)) / np.maximum(cov, 1e-6)
    FO = pool(foot.astype(float)); SH = pool((gm & gsh).astype(float)); GL = pool(np.where(foot, glum, 0)) / np.maximum(pool(foot.astype(float)), 1e-6)
    SA = pool(sand.astype(float)); BR = pool(brk.astype(float)) / np.maximum(cov, 1e-6)
    ax, ay = -x0, -y0
    hi_img = np.where(hit, np.clip(lum, 0, 1), np.where(foot, 0.35, np.where(gsh, 0.08, 0.15)))
    # ゲームでランタンの光を当て直すための、面の向き（ドットの真ん中の標本。外れたら当たった標本の平均）と、焼いた光の強さ
    c_ = SS // 2
    def mid(a): return a.reshape(H, SS, W, SS, *a.shape[2:])[:, c_, :, c_]
    hc = mid(hit); NC = mid(n)
    nav = np.stack([pool(np.where(hit, n[..., i], 0)) for i in range(3)], -1)
    NC = np.where(hc[..., None], NC, nav); NC = NC / (np.linalg.norm(NC, axis=-1, keepdims=True) + 1e-9)
    DC = np.where(hc, mid(dif), pool(np.where(hit, dif, 0)) / np.maximum(cov, 1e-6))
    return dict(NC=NC, DC=DC, PIDc=PIDc, JNT=JNT, W=W, H=H, cov=cov, L=L, M=M, DEP=DEP, HT=HT, FO=FO, SH=SH, GL=GL, SA=SA, BR=BR, ax=ax, ay=ay, hi=hi_img)

def quantize_scene(r):
    W, H = r['W'], r['H']
    cov, L, M, DEP, HT = r['cov'], r['L'], r['M'], r['DEP'], r['HT']
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if cov[y, x] >= 0.45:
                i = sum(L[y, x] > t for t in TH)
                if r['BR'][y, x] >= 0.5: i = min(max(i, 3), 4)              # 折れ口の面は明か中
                g[y][x] = 'abc'[0 if i <= 2 else 1 if i <= 4 else 2] if M[y, x] >= 0.5 else str(i)
            elif r['FO'][y, x] >= 0.5:
                if r['SA'][y, x] >= 0.5 and r['SH'][y, x] < 0.5: g[y][x] = 'S'
                else: g[y][x] = 'G' if (r['SH'][y, x] >= 0.5 or r['GL'][y, x] < 0.62) else 'H'
            elif r['SH'][y, x] >= 0.5: g[y][x] = 's'
    bpx = sorted([(y, x) for y in range(H) for x in range(W) if r['BR'][y, x] >= 0.5 and g[y][x] in '0123456'])
    for (y, x) in bpx[:2]: g[y][x] = '6'                                     # 折れ口の高い縁に照り2つ
    stone = lambda c: c in '0123456abc'
    # ぽつんと明るい点・小さな苔
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            c = g[y][x]
            if c not in '0123456': continue
            nb = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]]
            if not all(v in '0123456' for v in nb): continue
            nv = sorted(int(v) for v in nb)
            if all(int(c) - v >= 2 for v in nv) or all(v - int(c) >= 2 for v in nv): g[y][x] = str(nv[1])
    seen = set()
    for y in range(H):
        for x in range(W):
            if g[y][x] not in 'abc' or (y, x) in seen: continue
            st, comp = [(y, x)], []; seen.add((y, x))
            while st:
                cy, cx = st.pop(); comp.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and (ny, nx) not in seen and g[ny][nx] in 'abc': seen.add((ny, nx)); st.append((ny, nx))
            if len(comp) < 3:
                for cy, cx in comp: g[cy][cx] = '2'
    # 輪郭：外（透明・地面）か、ずっと奥の面と接する所。右と下は最暗、左は暗、上は中間〜明
    out = [row[:] for row in g]
    def behind(y, x, ny, nx):
        if not (0 <= ny < H and 0 <= nx < W): return True
        if not stone(g[ny][nx]): return True
        return DEP[ny, nx] - DEP[y, x] > 0.9
    def sil(y, x, ny, nx):          # 外（透明・地面）と接する＝本当の輪郭
        return not (0 <= ny < H and 0 <= nx < W) or not stone(g[ny][nx])
    for y in range(H):
        for x in range(W):
            if not stone(g[y][x]): continue
            R_, D_, L_, U_ = behind(y, x, y, x + 1), behind(y, x, y + 1, x), behind(y, x, y, x - 1), behind(y, x, y - 1, x)
            pc = r['PIDc']; jn = r['JNT']
            joint_edge = any(0 <= ny < H and 0 <= nx < W and stone(g[ny][nx]) and pc[ny, nx] != pc[y, x] and pc[y, x] >= 0 and pc[ny, nx] >= 0
                             and jn[pc[y, x]] and jn[pc[ny, nx]] and pc[ny, nx] > pc[y, x] for ny, nx in ((y, x + 1), (y + 1, x)))
            if joint_edge and g[y][x] in '0123456':
                out[y][x] = '2' if L[y, x] > 0.6 else '1'                 # 太鼓の継ぎ目（部品が替わる所）は角度に関係なく線を引く
            elif (R_ or D_) and not (sil(y, x, y, x + 1) or sil(y, x, y + 1, x)):
                out[y][x] = '2' if L[y, x] > 0.6 else '1'                 # 奥の面との境（継ぎ目など）は中暗、暗い側だけ暗
            elif R_: out[y][x] = 'o' if D_ else '0'
            elif D_: out[y][x] = '0'
            elif L_ and g[y][x] not in 'abc': out[y][x] = '1' if not U_ else '2'
            elif U_ and g[y][x] in '0123456' and g[y][x] != '6': out[y][x] = str(min(max(int(g[y][x]), 3), 5))
    rows = [''.join(r_) for r_ in out]
    hts = [''.join(('0123456789abcdefghijklmnopqrstuvwxyz'[int(min(35, max(0, round(HT[y, x] * math.cos(THETA) * PX))))] if stone(out[y][x]) else '0') for x in range(W)) for y in range(H)]
    return rows, hts

# ---------------- 部品の作り方 ----------------
def egypt_column(c, R, L, seed, broken=None, capital=True):
    """立った柱：台座の円盤＋胴（柱頭の下に3本の帯）＋釣鐘に開く柱頭＋四角い板。c は根元の中心"""
    parts = []
    cx, cz = c[0], c[2]
    base_h = 0.3
    parts.append(Part('cyl', (cx, base_h / 2, cz), r=R * 1.2, h=base_h, bev=0.08, seed=seed, moss=0.7))   # 台座
    shaftL = L * (0.72 if capital else 1.0)
    top = base_h + shaftL
    g = [shaftL / 2 - 0.35, shaftL / 2 - 0.7, shaftL / 2 - 1.05] if capital else []
    parts.append(Part('cyl', (cx, base_h + shaftL / 2, cz), r=R, h=shaftL, bev=0.12, grooves=g, cut=broken, seed=seed + 1, moss=0.6))
    if capital:
        fl = 0.9
        parts.append(Part('frus', (cx, top + fl / 2, cz), r=R * 1.0, r1=R + 0.3, h=fl, bev=0.08, seed=seed + 2, moss=0.5))   # 開きは片側1ドット
        ab = 0.6                                                                                                  # 板は2ドットの厚み
        parts.append(Part('box', (cx, top + fl + ab / 2, cz), half=(R * 1.3, ab / 2, R * 1.3), bev=0.06, seed=seed + 3, moss=0.5))
    return parts

def fallen_scene(name, seed, yaw, length=10.0, R=1.25):
    rng = np.random.default_rng(seed)
    parts = []
    M = rot_y(yaw) @ rot_z(math.pi / 2)        # 局所 y（柱の軸）を水平に
    axis = M[:, 1]
    sink = 0.18
    n = max(3, int(round(length / 2.4)))
    seg = length / n
    start = -axis * length / 2
    for i in range(n):
        cen = start + axis * (seg * (i + 0.5)) + np.array([0, R - sink, 0])
        jitter = np.array([rng.normal(0, 0.04), 0, rng.normal(0, 0.05)])
        last = i == n - 1
        cut = None
        if last:   # 折れ口：軸に35°傾けた面。直径は保ったまま（尖らせない）
            up = np.array([0, 1.0, 0]); side = np.cross(axis, up); side /= np.linalg.norm(side)
            nrm = axis * math.cos(math.radians(35)) + (up if rng.random() < 0.5 else side) * math.sin(math.radians(35))
            cut = (nrm, cen + axis * seg * 0.05, 0.38)
        g = [seg / 2 - 0.45, -seg / 2 + 0.45]           # 太鼓の両端に1本ずつ（胴は真っ直ぐ。数珠に見せない）
        parts.append(Part('cyl', cen + jitter, M, r=R * (0.95 + 0.05 * i / max(1, n - 1)), h=seg - 0.38, bev=0.05, grooves=g, cut=cut, seed=seed + i * 13,
                          moss=0.6, joint=True, jit=rng.uniform(-0.07, 0.07)))
    # 柱頭（根元側）：3本の帯で縛った首、釣鐘に開く形、四角い板（カメラ側の面に石板）
    D = 2 * R
    capM = M @ rot_z(math.pi)                  # 開く向きを外へ
    parts.append(Part('cyl', start - axis * 0.35 + np.array([0, R - sink, 0]), M, r=R * 1.02, h=0.7, bev=0.06, grooves=[-0.2, 0.0, 0.2], seed=seed + 90, moss=0.4))
    fl = 1.2 * D
    parts.append(Part('frus', start - axis * (0.7 + fl / 2) + np.array([0, R - sink + 0.25, 0]), capM, r=R * 1.0, r1=R * 1.6, h=fl, bev=0.08, seed=seed + 91, moss=0.5))
    ab_t = 0.35 * D
    capc = start - axis * (0.7 + fl + ab_t / 2) + np.array([0, R * 1.7 - sink - 0.05, 0])
    parts.append(Part('box', capc, rot_y(yaw), half=(ab_t / 2, R * 1.7, R * 1.7), bev=0.1, panel='glyph', seed=seed + 92, moss=0.6))
    # 折れ口の脇の欠片
    endp = start + axis * length
    for k in range(3):
        o = endp + axis * ((0.7 if k == 0 else 1.2 + rng.uniform(0, 1.2))) + (np.zeros(3) if k == 0 else np.array([rng.uniform(-1, 1), 0, rng.uniform(-1.0, 1.0)]))
        hs_ = 0.55 if k == 0 else rng.uniform(0.3, 0.42)
        parts.append(Part('box', o + np.array([0, hs_ * 0.8, 0]), rot_y(rng.uniform(0, 3)), half=(hs_ * 1.3, hs_, hs_), bev=0.1, seed=seed + 100 + k, moss=0.3))
    obs = []
    for u in np.linspace(-length / 2 - 1.6, length / 2, 9):
        pt = axis * u
        obs.append([round(pt[0] * PX, 1), round(pt[2] * math.sin(THETA) * PX, 1), round(R * PX * 0.95, 1)])
    sc = Scene(name, parts, None, obs)
    sc.sink = int(round(0.35 * D * math.cos(THETA) * PX))     # 水の中では直径の35%が沈む（ドット）
    cap = start - axis * 1.5; brk = start + axis * length
    sc.meta = {'cap': upx(cap[0], cap[2]), 'brk': upx(brk[0], brk[2])}   # 柱頭の側と折れ口の側（ドット）
    return sc

def room_scene(name, seed, W=16.0, D=22.0):
    """奥行き（z）は画面で半分に縮む（仰角30°）。ゲームの床は縮まないので、z の寸法は2倍で作る"""
    rng = np.random.default_rng(seed)
    parts, obs = [], []
    x0, x1, zb, zf = -W / 2, W / 2, -D / 2, D / 2
    CH = 1.8                                             # 1段の高さ（約6ドット）
    sinT = math.sin(THETA)
    def ob(x, z, r): obs.append([round(x * PX, 1), round(z * sinT * PX, 1), round(r, 1)])
    def stack(x, z, w, dz, c, panel=False, cornice=True):
        """塊を c 段積む。一番上は少し張り出す（コーニス）。panel=True なら2段ぶんの石板の塊を1つ"""
        sd = int(rng.integers(1, 1 << 30))
        if panel and c >= 2:
            h = CH * 2
            parts.append(Part('box', (x, h / 2, z), rot_y(rng.normal(0, 0.02)), half=(w / 2, h / 2, dz / 2), bev=0.12, panel='glyph', seed=sd, moss=0.6))
            k0 = 2
        else: k0 = 0
        for k in range(k0, c):
            h = CH * (0.94 + rng.uniform(0, 0.08)); top = k == c - 1
            ez = 0.25 if (top and cornice and c >= 2) else 0.0                 # 上の段だけ手前へ1ドット張り出す（横には出さない）
            off = np.array([rng.normal(0, 0.04), 0, rng.normal(0, 0.04)])
            parts.append(Part('box', np.array([x, CH * k + h / 2, z + ez / 2]) + off, rot_y(rng.normal(0, 0.015)), half=(w / 2, h / 2, dz / 2 + ez / 2), bev=0.12, seed=sd + k, moss=0.6))
        for q in np.arange(-w / 2 + 0.6, w / 2, 1.0): ob(x + q, z, min(w, dz * sinT) * PX * 0.45 + 1)
    # 奥の壁：長さ 2.5〜4 の塊が続く並び（段は2〜3を±1ずつ揺らす）。抜けは1か所、石板の塊は1〜2つ
    gx = rng.uniform(x0 + 5, x1 - 7); gw = rng.uniform(2.0, 2.8)
    x = x0 + 2.0; c = 2; slabs_left = int(rng.integers(1, 3))
    while x < x1 - 2.2:
        w = min(rng.choice([2.5, 3.0, 3.5, 4.0]), x1 - 2.0 - x)
        if x1 - 2.0 - x - w < 1.5: w = x1 - 2.0 - x
        mid = x + w / 2
        near = abs(x - (gx + gw)) < 0.6 or abs(x + w - gx) < 0.6
        if not (gx <= mid <= gx + gw):
            c = int(np.clip(c + rng.integers(-1, 2), 2, 3)); cc = max(1, c - 1) if near else c
            pan = cc >= 2 and slabs_left > 0 and w >= 3.0 and rng.random() < 0.5
            if pan: slabs_left -= 1
            stack(mid, zb, w - 0.04, 2.4, cc, panel=pan)
        x += w
    # 左右の壁：厚さ 1.8、長さ（z）5〜8、1〜2段。抜けは1か所
    for sx in (x0 + 0.9, x1 - 0.9):
        side_c = int(rng.integers(1, 3))                  # 1つの壁の中は段を揃える
        z = zb + 2.0; gz = rng.uniform(zb + 6, zf - 9)
        while z < zf - 2.5:
            dl = min(rng.choice([6.5, 8.0, 9.5]), zf - 2.5 - z); midz = z + dl / 2
            if dl < 2: break
            if not (gz <= midz <= gz + 4.5):
                stack(sx, midz, 1.8, dl - 0.1, 2 if midz > zf - 6 else side_c, cornice=False)
            z += dl
    # 柱：奥の角に1本、入口の両脇に2本（片方は中ほどで折れている）
    corner = x0 + 1.0 if rng.random() < 0.5 else x1 - 1.0
    parts += egypt_column((corner, 0, zb + 0.2), 1.0, 4 * CH, seed + 7); ob(corner, zb + 0.2, 5)
    dl_, dr_ = -2.4, 2.4
    for k, xx in enumerate((dl_, dr_)):
        brk = None
        if k == 1:
            nrm = np.array([0.45, 1, 0.15]); nrm /= np.linalg.norm(nrm); brk = (nrm, np.array([xx, 2.6, zf]), 0.3)
        parts += egypt_column((xx, 0, zf), 1.0, 3.4 * CH, seed + 20 + k, broken=brk, capital=(k == 0)); ob(xx, zf, 5)
    # 手前の低い壁（1段）
    for a_, b_ in ((x0 + 2.0, dl_ - 1.4), (dr_ + 1.4, x1 - 2.0)):
        x = a_
        while x < b_ - 1.0:
            w = min(rng.choice([2.5, 3.0, 3.5]), b_ - x)
            if rng.random() > 0.25: stack(x + w / 2, zf, w - 0.04, 2.4, 1)
            x += w
    # 入口の段（3段、入口の幅いっぱい。蹴上げ2ドット・踏み面2ドット）
    for k in range(3):
        parts.append(Part('box', (0, 0.29 * (3 - k) / 2 + 0.0, zf + 1.0 + k * 1.0), rot_y(rng.normal(0, 0.015)),
                          half=(1.9 - k * 0.1, 0.29 * (3 - k) / 2, 0.55), bev=0.05, seed=seed + 60 + k, moss=0.35))
    # 床の敷石：横 2.5〜3.5・奥 3〜4（画面で 10〜14×6〜8 ドット）。すき間は詰め、継ぎ目は色で。
    # 抜けは縁の1枚だけ（隣り合って抜けない）、1枚だけ沈む、2〜3枚にひび
    zz = zb + 1.6; sunk_done = False; cracks = 0; prev_miss = False
    while zz < zf - 1.0:
        dz = min(rng.choice([3.0, 3.5, 4.0]), zf - 1.0 - zz); xx = x0 + 1.8
        while xx < x1 - 1.8:
            w = min(rng.choice([2.5, 3.0, 3.5]), x1 - 1.8 - xx)
            edge = (xx < x0 + 3.0) or (xx + w > x1 - 3.0) or (zz + dz > zf - 2.5)
            miss = edge and not prev_miss and rng.random() < 0.35
            prev_miss = miss
            if not miss:
                sunk = (not sunk_done) and (not edge) and rng.random() < 0.15
                if sunk: sunk_done = True
                crk = (not sunk) and cracks < 3 and rng.random() < 0.18
                if crk: cracks += 1
                parts.append(Part('box', (xx + w / 2, 0.09 - (0.06 if sunk else 0), zz + dz / 2), rot_y(rng.normal(0, .01)),
                                  half=(w / 2 - 0.02, 0.1, dz / 2 - 0.03), bev=0.03, seed=int(rng.integers(1, 1 << 30)), moss=0.15,
                                  tone=0.74 if sunk else 0.86, slab=True, crack=crk, sunk=sunk))
            xx += w
        zz += dz
    # 仕切りの名残
    stack(x0 + 3.2 if rng.random() < 0.5 else x1 - 3.2, (zb + zf) / 2, 2.6, 3.0, 1)
    # 転げた塊（壁の線の外、4〜10ドット）
    for k in range(3):
        side = int(rng.integers(0, 3))
        px_ = (x0 - 1.6 - rng.uniform(0, 1.2)) if side == 0 else (x1 + 1.6 + rng.uniform(0, 1.2)) if side == 1 else rng.uniform(x0 + 2, x1 - 2)
        pz = rng.uniform(zb + 2, zf - 2) if side < 2 else zf + 5 + rng.uniform(0, 3)
        s_ = rng.uniform(0.55, 0.8)
        parts.append(Part('box', (px_, s_ * 0.9, pz), rot_y(rng.uniform(0, 3)) @ rot_z(rng.normal(0, 0.22)), half=(s_ * 1.5, s_, s_ * 1.2), bev=0.12, seed=int(rng.integers(1, 1 << 30)), moss=0.5))
    # 外の壁の根元の砂だまり（明るく、低い）
    for k in range(5):
        side = int(rng.integers(0, 2))
        px_ = x0 - 0.2 if side == 0 else x1 + 0.2
        pz = rng.uniform(zb + 2, zf - 3)
        parts.append(Part('box', (px_, 0.06, pz), rot_y(rng.normal(0, 0.3)), half=(0.6, 0.12, rng.uniform(1.0, 2.0)), bev=0.1, seed=int(rng.integers(1, 1 << 30)), moss=0.0, tone=1.12))
    def ground(pg):
        x, z = pg[..., 0], pg[..., 2]
        e = vnoise(np.stack([x * 0.9, z * 0.45, np.zeros_like(x)], -1), seed + 5)
        ex = 0.5 + 0.8 * e; ez = 1.0 + 1.6 * e
        return (x > x0 - ex) & (x < x1 + ex) & (z > zb - 1.6 - ez * 0.5) & (z < zf + 1.5 + ez)
    sc = Scene(name, parts, ground, obs)
    sc.sink = 0
    return sc

# ---------------- 部品の詰め合わせ（部屋に散らして置く用）----------------
# 部屋の残骸を1つの塊で置くと、迷宮の部屋の形と食い違って不自然だった（ユーザー指摘）。
# 壁の切れ端・角・柱・石碑・敷石・段・転げた塊を別々のスプライトにして、ゲーム側で
# 迷宮の部屋の壁際や角に沿って散らす。1マス＝x 4単位・z 8単位（z は画面で半分に縮むので2倍）。
CH = 1.8
class Kit:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed); self.parts = []; self.obs = []
    def ob(self, x, z, r):
        self.obs.append([round(x * PX, 1), round(z * math.sin(THETA) * PX, 1), round(r, 1)])
    def stack(self, x, z, w, dz, c, panel=False, cornice=True, solid=True):
        rng = self.rng; sd = int(rng.integers(1, 1 << 30)); k0 = 0
        if panel and c >= 2:
            h = CH * 2
            self.parts.append(Part('box', (x, h / 2, z), rot_y(rng.normal(0, 0.02)), half=(w / 2, h / 2, dz / 2), bev=0.12, panel='glyph', seed=sd, moss=0.6)); k0 = 2
        for k in range(k0, c):
            h = CH * (0.94 + rng.uniform(0, 0.08)); top = k == c - 1
            ez = 0.25 if (top and cornice and c >= 2) else 0.0
            off = np.array([rng.normal(0, 0.04), 0, rng.normal(0, 0.04)])
            self.parts.append(Part('box', np.array([x, CH * k + h / 2, z + ez / 2]) + off, rot_y(rng.normal(0, 0.015)), half=(w / 2, h / 2, dz / 2 + ez / 2), bev=0.12, seed=sd + k, moss=0.6))
        if solid:
            if dz > w * 1.5:
                for q in np.arange(-dz / 2 + 1.2, dz / 2, 2.4): self.ob(x, z + q, w * PX * 0.5 + 0.5)
            else:
                for q in np.arange(-w / 2 + 0.8, w / 2, 1.4): self.ob(x + q, z, min(w, dz * math.sin(THETA)) * PX * 0.45 + 1)
    def run_x(self, x0, x1, z, cmin, cmax, dz=2.4, panels=1, broken_end=True, broken_left=False):
        """x 方向の壁の切れ端（北の壁沿い）。段は cmin〜cmax を±1で揺らし、端は崩れて低い"""
        rng = self.rng; x = x0; c = cmax; pl = panels; xs = []
        while x < x1 - 1.0:
            w = min(rng.choice([2.5, 3.0, 3.5]), x1 - x)
            if x1 - x - w < 1.2: w = x1 - x
            xs.append((x, w)); x += w
        for i, (x, w) in enumerate(xs):
            c = int(np.clip(c + rng.integers(-1, 2), cmin, cmax))
            if broken_end and i == (0 if broken_left else len(xs) - 1): c = max(1, c - 1)
            pan = pl > 0 and c >= 2 and w >= 3.0 and rng.random() < 0.6
            if pan: pl -= 1
            self.stack(x + w / 2, z, w - 0.04, dz, c, panel=pan)
    def run_z(self, x, z0, z1, c, w=1.8):
        """z 方向の壁の切れ端（東西の壁沿い）"""
        rng = self.rng; z = z0
        while z < z1 - 2.0:
            dl = min(rng.choice([6.5, 8.0, 9.5]), z1 - z)
            if z1 - z - dl < 2.5: dl = z1 - z
            self.stack(x, z + dl / 2, w, dl - 0.1, c, cornice=False); z += dl
    def column(self, x, z, R, L, broken=None, capital=True):
        self.parts += egypt_column((x, 0, z), R, L, int(self.rng.integers(1, 1 << 30)), broken=broken, capital=capital)
        self.ob(x, z, R * PX * 1.1)
    def tumbled(self, x, z, n=2, solid=True):
        rng = self.rng
        for k in range(n):
            s_ = rng.uniform(0.5, 0.8); px_ = x + rng.uniform(-1.2, 1.2); pz = z + rng.uniform(-2, 2)
            self.parts.append(Part('box', (px_, s_ * 0.9, pz), rot_y(rng.uniform(0, 3)) @ rot_z(rng.normal(0, 0.22)), half=(s_ * 1.5, s_, s_ * 1.2), bev=0.12, seed=int(rng.integers(1, 1 << 30)), moss=0.5))
            if solid: self.ob(px_, pz, s_ * PX * 1.2)
    def paving(self, cols, rows, miss=0.25):
        rng = self.rng; x0 = -cols * 3.0 / 2; z0 = -rows * 3.5 / 2
        for j in range(rows):
            for i in range(cols):
                edge = i in (0, cols - 1) or j in (0, rows - 1)
                if edge and rng.random() < miss: continue
                w, dz = 3.0, 3.5
                self.parts.append(Part('box', (x0 + i * w + w / 2 + rng.normal(0, .04), 0.09, z0 + j * dz + dz / 2 + rng.normal(0, .04)), rot_y(rng.normal(0, .015)),
                                       half=(w / 2 - 0.02, 0.1, dz / 2 - 0.03), bev=0.03, seed=int(rng.integers(1, 1 << 30)), moss=0.15, tone=0.86, slab=True, crack=rng.random() < 0.2))
    def scene(self, name, sink=0, ground=None, meta=None):
        sc = Scene(name, self.parts, ground, self.obs); sc.sink = sink; sc.meta = meta or {}; return sc
def upx(x, z): return [round(x * PX), round(z * math.sin(THETA) * PX)]

def kit_wallrun(name, seed, length, cmin, cmax, panels, left=False):
    """left=True なら左端が崩れている。meta.brk に崩れた端の位置（ドット）"""
    k = Kit(seed); k.run_x(-length / 2, length / 2, 0, cmin, cmax, panels=panels, broken_left=left)
    ex = (-length / 2 - 1.2) if left else (length / 2 + 1.2)
    k.tumbled(ex, 2.2, 1, solid=False)
    return k.scene(name, meta={'brk': upx(-length / 2 if left else length / 2, 0), 'tall': cmax >= 2})
def kit_siderun(name, seed, length, c):
    k = Kit(seed); k.run_z(0, -length / 2, length / 2, c); return k.scene(name, meta={'tall': c >= 2})
def kit_corner(name, seed, east):
    """北の壁と東西の壁の角。east=True なら北東の角（北の壁は左へ、横の壁は角から下へ）"""
    k = Kit(seed); sx = 1 if east else -1
    k.column(sx * 0.0, 0.0, 0.95, 3 * CH, capital=bool(seed % 2))
    xa, xb = (-9.0, -1.2) if east else (1.2, 9.0)
    k.run_x(xa, xb, 0.0, 1, 2, panels=1 if seed % 3 == 0 else 0)
    k.run_z(0.0, 2.2, 14.0, 1)
    return k.scene(name, meta={'tall': True})
def kit_column(name, seed, L, broken=False, capital=True, R=1.0):
    k = Kit(seed)
    brk = None
    if broken:
        nrm = np.array([0.45, 1, 0.15]); nrm /= np.linalg.norm(nrm); brk = (nrm, np.array([0, L * 0.55, 0]), 0.3)
    k.column(0, 0, R, L, broken=brk, capital=capital and not broken)
    if broken: k.tumbled(2.2, 3.0, 1, solid=False)
    return k.scene(name, meta={'tall': L > 3})
def kit_stele(name, seed, lean=0.0):
    k = Kit(seed); rng = k.rng
    w, h, dz = 3.2, 3.8, 1.3
    M = rot_z(lean)
    k.parts.append(Part('box', (math.sin(-lean) * h / 2, h / 2 * math.cos(lean), 0), M, half=(w / 2, h / 2, dz / 2), bev=0.12, panel='glyph', seed=int(rng.integers(1, 1 << 30)), moss=0.6))
    k.parts.append(Part('box', (0, 0.25, 0), rot_y(0.05), half=(w / 2 + 0.4, 0.25, dz / 2 + 0.4), bev=0.08, seed=int(rng.integers(1, 1 << 30)), moss=0.7))   # 台
    k.ob(0, 0, w * PX * 0.45)
    return k.scene(name, meta={'tall': True})
def kit_paving(name, seed, cols, rows):
    k = Kit(seed); k.paving(cols, rows); return k.scene(name)
def kit_steps(name, seed):
    k = Kit(seed); rng = k.rng
    for j in range(3):
        k.parts.append(Part('box', (0, 0.29 * (3 - j) / 2, -1.5 + j * 1.6), rot_y(rng.normal(0, 0.015)), half=(2.2 - j * 0.15, 0.29 * (3 - j) / 2, 0.85), bev=0.05, seed=int(rng.integers(1, 1 << 30)), moss=0.35))
    return k.scene(name)
def kit_blocks(name, seed, n):
    k = Kit(seed); k.tumbled(0, 0, n); return k.scene(name)

# ---------------- ランタンの光を当て直すための書き出し ----------------
NRM_ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'
def nrm_table(n=64):
    """面の向きの表（ゲーム側 NRM・cave3d.py と同じ作り方）"""
    ga = math.pi * (3 - math.sqrt(5)); out = []
    for i in range(n):
        y = 1 - (i + 0.5) / n * 2; r = math.sqrt(max(0, 1 - y * y)); ph = i * ga
        out.append((math.cos(ph) * r, y, math.sin(ph) * r))
    return np.array(out)
NRM = nrm_table()
def relight_rows(rows, NC, DC):
    """石・苔・輪郭のドットごとに、面の向き（NRM の番号）と焼いた光の強さ（0〜9）。ゲームは
       「今のランタンで当てた強さ − 焼いた強さ」だけ段を上げ下げする（象形・溝・継ぎ目の描き分けは残る）"""
    H, W = len(rows), len(rows[0])
    idx = np.argmax(NC @ NRM.T, axis=-1)
    nr = [''.join(NRM_ALPHA[idx[y, x]] if rows[y][x] in '0123456abco' else '.' for x in range(W)) for y in range(H)]
    kr = [''.join(str(int(np.clip(round(DC[y, x] * 9), 0, 9))) if rows[y][x] in '0123456abco' else '.' for x in range(W)) for y in range(H)]
    return nr, kr

SCENES = [
    lambda: fallen_scene('fallen_a', 101, math.radians(32), 10.0),
    lambda: fallen_scene('fallen_b', 202, math.radians(-28), 9.0, 1.15),
    lambda: fallen_scene('fallen_c', 303, math.radians(18), 8.0, 1.05),
    lambda: kit_wallrun('wall_a', 501, 10.0, 2, 3, 1),
    lambda: kit_wallrun('wall_b', 502, 6.5, 1, 2, 1),
    lambda: kit_wallrun('wall_c', 503, 13.0, 1, 2, 0),
    lambda: kit_wallrun('wall_d', 504, 7.0, 1, 2, 0, left=True),
    lambda: kit_wallrun('wall_e', 505, 10.5, 2, 3, 1, left=True),
    lambda: kit_wallrun('wall_f', 506, 5.0, 1, 1, 0),
    lambda: kit_siderun('side_a', 511, 14.0, 1),
    lambda: kit_siderun('side_b', 512, 20.0, 2),
    lambda: kit_siderun('side_c', 513, 10.0, 2),
    lambda: kit_corner('corner_nw', 521, False),
    lambda: kit_corner('corner_ne', 522, True),
    lambda: kit_column('col_a', 531, 4 * CH),
    lambda: kit_column('col_b', 532, 4 * CH, broken=True),
    lambda: kit_column('col_c', 533, 1.4, capital=False),
    lambda: kit_column('col_d', 534, 3 * CH),
    lambda: kit_stele('stele_a', 541),
    lambda: kit_stele('stele_b', 542, lean=0.22),
    lambda: kit_paving('pave_a', 551, 3, 2),
    lambda: kit_paving('pave_b', 552, 4, 3),
    lambda: kit_paving('pave_c', 553, 2, 2),
    lambda: kit_steps('steps_a', 561),
    lambda: kit_blocks('blocks_a', 571, 2),
    lambda: kit_blocks('blocks_b', 572, 3),
]

def main():
    from PIL import Image, ImageDraw
    sys.path.insert(0, os.path.dirname(__file__))
    from pillar3d import to_rgb
    big, prev = {}, []
    only = [a[7:] for a in sys.argv if a.startswith('--only=')]
    for mk in SCENES:
        sc = mk()
        if only and sc.name not in only[0].split(','): continue
        r = render_scene(sc)
        rows, hts = quantize_scene(r)
        lo = np.min([p_.aabb()[0] for p_ in sc.parts], axis=0); hi_ = np.max([p_.aabb()[1] for p_ in sc.parts], axis=0)
        fp = [round(lo[0] * PX), round(lo[2] * math.sin(THETA) * PX), round(hi_[0] * PX), round(hi_[2] * math.sin(THETA) * PX)]   # 床の上の広がり（ドット）
        nrows, krows = relight_rows(rows, r['NC'], r['DC'])
        big[sc.name] = {'w': r['W'], 'h': r['H'], 'ax': int(r['ax']), 'ay': int(r['ay']), 'sink': getattr(sc, 'sink', 0), 'fp': fp, 'rows': rows, 'hts': hts, 'n': nrows, 'k': krows, 'obs': sc.obs, **getattr(sc, 'meta', {})}
        pal_rows = [row.replace('s', '.').replace('G', '.').replace('H', '.').replace('S', '.') for row in rows]
        img = to_rgb(pal_rows)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == 's': img[y, x] = [30, 40, 44, 255]
                elif ch == 'G': img[y, x] = [70, 66, 34, 255]
                elif ch == 'H': img[y, x] = [104, 96, 52, 255]
                elif ch == 'S': img[y, x] = [159, 144, 110, 255]
        hi = Image.fromarray((np.clip(r['hi'], 0, 1) * 255).astype(np.uint8)).convert('RGB')
        px = Image.fromarray(img, 'RGBA').resize((r['W'] * 6, r['H'] * 6), Image.NEAREST)
        prev.append((sc.name, hi, px))
        print(sc.name, r['W'], r['H'], len(sc.parts), 'parts', flush=True)
    for name, hi, px in prev:
        sheet = Image.new('RGB', (hi.width + px.width + 30, max(hi.height, px.height) + 20), (34, 52, 56))
        sheet.paste(hi, (0, 18)); sheet.paste(px, (hi.width + 20, 18), px)
        ImageDraw.Draw(sheet).text((4, 2), name, fill=(230, 220, 200)); sheet.save(os.path.join(OUT, 'preview_%s.png' % name))
    with open(os.path.join(OUT, 'ruins.json'), 'w') as fh: json.dump(big, fh)
    if '--apply' in sys.argv:
        cl = os.path.join(os.path.dirname(__file__), '..', 'proto', 'cave-look.js')
        src = open(cl, encoding='utf-8').read()
        a0, a1 = src.index('/*RUIN_BIG_BEGIN*/'), src.index('/*RUIN_BIG_END*/')
        cur = {}
        m = src[a0:a1]
        if 'RUIN_BIG={' in m: cur = json.loads(m[m.index('{'):m.rindex('}') + 1])
        cur.update(big)
        src = src[:a0] + '/*RUIN_BIG_BEGIN*/const RUIN_BIG=' + json.dumps(cur, ensure_ascii=False, separators=(',', ':')) + ';' + src[a1:]
        open(cl, 'w', encoding='utf-8').write(src)
        print('applied to', cl)

if __name__ == '__main__':
    main()
