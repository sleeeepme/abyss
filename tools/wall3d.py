#!/usr/bin/env python3
"""北側の岩壁（石の層）の試作。ドラクエのような斜め見下ろしにするため、床の北の縁に「岩肌の立ち上がり」を付ける。

2026-10-05 ユーザー要望：
  「ダンジョンマップを見下ろし型からドラクエのような角度のビューの想定にするために、北側に壁をつけたい。
   石の層に壁をつける想定で、添付のような岩肌の壁をまずは3Dで試作して」

作り（cave3d.py の岩・石筍と同じ視点・同じ書き出し）:
- 壁の面は z=0（南向き）。床は z>0。高さ H（単位。1マス＝4単位）。z は cave3d と同じく2倍で組む。
- 面は「層ごとに積んだ角ばった岩の塊」（cave3d.Boulder）。上の段ほど前へ張り出し、天辺は庇（ひさし）になる。
- 庇から垂れる根と滴り、足もとの崩れた岩屑。
- 横に繋がるように、塊の並びは周期 P（単位）で繰り返す。描くのは真ん中の1周期ぶん。
- 光は焼き込まない（ゲームがランタンの位置で当てる）。ここの見本の光は確かめ用。

  python3 tools/wall3d.py [出力ディレクトリ] [--views] [--apply]
    --views：3Dモデルを滑らかな陰影で3方向から（wall_views.png）
    --apply：proto/cave-look.js の WALL_SPR（/*WALL_SPR_BEGIN*/〜/*WALL_SPR_END*/）を書き換える
"""
import sys, os, math, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
OUTDIR = next((a for a in sys.argv[1:] if not a.startswith('--')), '/tmp/wall3d-out')
FLAGS = [a for a in sys.argv[1:] if a.startswith('--')]
sys.argv = [sys.argv[0], OUTDIR]           # cave3d は読み込み時に引数を読むので揃えておく
import cave3d
from cave3d import Boulder, NRM, ALPHA, THETA, PX, fbm
import ruin3d

TILE = 4.0                 # 1マス＝4単位＝16ドット
P = 8 * TILE               # 繰り返しの周期（8マス）
H = 4.8                    # 面の高さ（単位）→ 画面で約17ドット＝1マス強（2026-10-05 ユーザー「壁の高さは半分くらいにしたい」。前は 9.2）


class Slab:
    """壁の芯：面の奥にある大きな岩の板（塊の隙間から見える奥の闇）"""
    def __init__(self, x0, x1, h, seed=1):
        self.x0, self.x1, self.h, self.seed, self.moss, self.tone = x0, x1, h, seed, 0.0, 0.45
    def sdf(self, p):
        q = p.copy()
        d = np.maximum.reduce([q[..., 2] - (-3.2 * 2), -q[..., 2] - 9.0 * 2, q[..., 1] - self.h, self.x0 - q[..., 0], q[..., 0] - self.x1])   # 片の奥の闇（片の割れ目からだけ見える）
        return d
    def aabb(self): return np.array([self.x0, 0, -18.0]), np.array([self.x1, self.h + 0.3, -6.0])
    def albedo(self, p, n): return np.full(p.shape[:-1], self.tone)


class Strand:
    """庇から垂れる根（細い円柱を少しうねらせる）"""
    def __init__(self, x, z, y0, length, r, seed):
        self.x, self.z, self.y0, self.L, self.r, self.seed, self.moss, self.tone = x, z, y0, length, r, seed, 0.0, 0.55
    def sdf(self, p):
        y = p[..., 1]
        t = np.clip((self.y0 - y) / self.L, 0, 1)
        cx = self.x + 0.35 * np.sin(t * 5.0 + self.seed) * t
        cz = self.z + 0.25 * np.cos(t * 4.0 + self.seed) * t
        rr = self.r * (1 - 0.6 * t)
        d = np.sqrt((p[..., 0] - cx) ** 2 + ((p[..., 2] - cz) / 2) ** 2) - rr
        return np.maximum(d, np.maximum(y - self.y0, (self.y0 - self.L) - y))
    def aabb(self): return np.array([self.x - 1, self.y0 - self.L - 0.2, self.z - 2]), np.array([self.x + 1, self.y0 + 0.2, self.z + 2])
    def albedo(self, p, n): return np.full(p.shape[:-1], self.tone)


# ======================== 第2版：調べた作り方で組み直し（2026-10-05） ========================
# 要点（崖・洞窟の岩のアセットの作り方から）：
#  1. 大・中・小の形の階層。大きな塊を少数、その上に面の割れ、最後に小さな欠け。同じ大きさを並べない。
#  2. 平らな面と角（スタイライズドな岩）。塊は平面の交わり（凸多面体）で作り、角は面取りで1段落とす。
#  3. 地層：横の帯を3段に分け、帯ごとに前後の出入りと割れ目の位置を変える。帯の境は暗い溝。
#  4. 縁の欠け：上の角・横の角を斜めの面で削り、2つに1つの塊は角を大きく欠く（2次の割れ）。
#  5. 細かい凹凸は距離場で足す（球の格子を smin/smax で表面の近くだけに。iq の fBM-SDF）。
#  6. 足もとは斜めの崩れ（タルス）で床へ落とし、面と床の境を三角に繋ぐ。
SQ = np.array([1.0, 1.0, 0.5])            # 組んだ空間（z 2倍）→ 本当の空間


def _nz(v):
    v = np.asarray(v, float); return v / np.linalg.norm(v)


class Block:
    """平面の交わりで作る岩の塊（本当の空間で組む。p は組んだ空間で来る）"""
    def __init__(self, x0, x1, y0, y1, zf, seed, band, undercut=False):
        rng = np.random.default_rng(seed)
        self.seed, self.moss, self.band = seed, 0.1, band
        self.tone = rng.uniform(0.86, 1.04) * (1.0, 0.92, 1.06)[band]
        xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
        pl = []
        def add(n, pt): n = _nz(n); pl.append((n, float(n @ np.asarray(pt, float))))
        add((rng.uniform(-.16, .16), rng.uniform(-.06, .22), 1), (xc, yc, zf))                      # 前
        add((0, 0, -1), (xc, yc, -4.0))                                                               # 奥
        add((rng.uniform(-.07, .07), 1, rng.uniform(-.10, .06)), (xc, y1, zf))                       # 上
        add((0, -1, 0), (xc, y0, zf))                                                                 # 下
        add((-1, rng.uniform(-.1, .1), rng.uniform(-.2, .05)), (x0, yc, zf))                          # 左
        add((1, rng.uniform(-.1, .1), rng.uniform(-.2, .05)), (x1, yc, zf))                           # 右
        add((0, 1, 1.0), (xc, y1 - rng.uniform(.25, .75), zf))                                        # 上の角の面取り
        add((-1, 0, rng.uniform(.9, 1.4)), (x0 + rng.uniform(.2, .55), yc, zf))                       # 左の角
        add((1, 0, rng.uniform(.9, 1.4)), (x1 - rng.uniform(.2, .55), yc, zf))                        # 右の角
        add((0, -1, rng.uniform(.7, 1.1)), (xc, y0 + rng.uniform(.15, .4), zf))                       # 下の角
        if undercut:                                                                                  # 庇の下：奥へえぐれる
            add((0, -1, 0.55), (xc, y0 + rng.uniform(.6, 1.0), zf - .2))
        for _ in range(rng.integers(0, 3)):                                                           # 2次の割れ（角を大きく欠く）
            cx = rng.choice([x0, x1]) + rng.uniform(-.3, .3); cy = rng.choice([y0, y1]) + rng.uniform(-.3, .3)
            n = (np.sign(cx - xc) * rng.uniform(.5, 1.2), np.sign(cy - yc) * rng.uniform(.4, 1.0), rng.uniform(.5, 1.2))
            k = rng.uniform(.5, 1.3)
            add(n, (cx - np.sign(cx - xc) * k * .7, cy - np.sign(cy - yc) * k * .6, zf - .1))
        self.N = np.array([q[0] for q in pl]); self.D = np.array([q[1] for q in pl])
        self.lo = np.array([x0 - .2, y0 - .1, (zf - 4.2) * 2]); self.hi = np.array([x1 + .2, y1 + .2, (zf + 1.6) * 2])
    def sdf(self, p):
        q = p * SQ
        return (q @ self.N.T - self.D).max(-1)
    def aabb(self): return self.lo, self.hi
    def albedo(self, p, n):
        y = p[..., 1]
        a = self.tone * (0.60 + 0.40 * np.clip(y / H, 0, 1) ** 0.7)                                 # 下ほど暗い
        a = a * (1.0 + 0.10 * (fbm(p * np.array([.9, 2.4, .9]), self.seed + 5) - .5))
        lines = np.abs(((y + 0.15 * fbm(p * .8, self.seed + 9)) / 0.62) % 1 - .5) < .055               # 細い層理
        a = a - 0.10 * (lines & (fbm(p * 1.2, self.seed + 2) > .42))
        streak = fbm(np.stack([p[..., 0] * 2.2, y * .15, p[..., 2] * 0], -1), self.seed + 13)          # 縦に垂れた染み
        return a - 0.07 * (streak > .64)


class Talus:
    """足もとの崩れ：面から床へ斜めに落ちる土台（細かい凹凸は距離場で足す）"""
    def __init__(self, x0, x1, seed=3):
        self.x0, self.x1, self.seed, self.moss, self.tone = x0, x1, seed, 0.35, 0.72
        self.n = _nz((0, 1.0, 1.15))
    def sdf(self, p):
        q = p * SQ
        top = q @ self.n - float(self.n @ np.array([0, 1.25, 0.05]))
        h = 0.18 * np.sin(q[..., 0] * 0.9 + self.seed) + 0.12 * np.sin(q[..., 0] * 2.3 + 1.7)
        return np.maximum.reduce([top - h, -q[..., 1], -q[..., 2] - 0.8, self.x0 - q[..., 0], q[..., 0] - self.x1])
    def aabb(self): return np.array([self.x0, 0, -1.8]), np.array([self.x1, 1.6, 3.4])
    def albedo(self, p, n): return np.full(p.shape[:-1], self.tone) * (0.9 + 0.2 * (fbm(p * 1.5, self.seed) - .5))


class Cell:
    """ボロノイで割った岩の1片（本当の空間で組む凸多面体）。
    横の境は隣の種との二等分面（少し内へ寄せて割れ目にする）、前は1〜2枚の傾いた面（稜線ができる）、角は面取り。"""
    def __init__(self, planes, seed, row, lo, hi, tone):
        self.N = np.array([q[0] for q in planes]); self.D = np.array([q[1] for q in planes])
        self.seed, self.row, self.moss, self.tone = seed, row, 0.1, tone
        self.lo, self.hi = lo, hi
    def sdf(self, p):
        return ((p * SQ) @ self.N.T - self.D).max(-1)
    def aabb(self): return self.lo, self.hi
    def albedo(self, p, n):
        y = p[..., 1]
        a = self.tone * (0.58 + 0.42 * np.clip(y / H, 0, 1) ** 0.7)
        a = a * (1.0 + 0.08 * (fbm(p * np.array([.9, 2.4, .9]), self.seed + 5) - .5))
        lines = np.abs(((y + 0.2 * fbm(p * .7, self.seed + 9)) / 0.7) % 1 - .5) < .05
        a = a - 0.09 * (lines & (fbm(p * 1.1, self.seed + 2) > .45))
        streak = fbm(np.stack([p[..., 0] * 2.0, y * .12, p[..., 2] * 0], -1), self.seed + 13)
        return a - 0.07 * (streak > .64)


def layout2(seed=11):
    """ボロノイの種：4段（地層）に、横に長めの間隔で散らす。周期 P で繰り返す"""
    rng = np.random.default_rng(seed)
    rows = [(0.8, 0.3, 3.0), (2.5, 0.35, 3.9), (4.1, 0.25, 3.3)]   # (y の中心, y の揺れ, x の間隔)。高さを半分にしたので3段
    seeds = []
    for r, (yc, yj, sp) in enumerate(rows):
        x = rng.uniform(0, sp)
        while x < P:
            seeds.append((x, yc + rng.uniform(-yj, yj), r))
            x += sp * rng.uniform(0.45, 2.1)                 # 間隔を大きく揺らす（同じ大きさを並べない）
    strands = []
    for k in range(int(P / 4.5)):
        strands.append((rng.uniform(0, P), rng.uniform(.9, 1.5) * 2, H - 1.1, rng.uniform(.9, 2.2), rng.uniform(.14, .2), int(rng.integers(1e6))))
    rubble = []
    x = rng.uniform(0, 3)
    while x < P:
        r = rng.uniform(.35, 1.0)
        rubble.append((x, r * .5, rng.uniform(.3, .9) * 2, r, r * .6, r * 2, int(rng.integers(1e6)), rng.uniform(.75, .9)))   # 床へはみ出さないよう面の近くに
        x += rng.uniform(1.2, 3.6)
    return seeds, strands, rubble


ROW_FRONT = (0.20, -0.30, 0.80)       # 段ごとの前の位置（本当の z）：下は少し出て、2段目は引っ込み、天辺は庇
SX = 0.62                                    # ボロノイを測るときの x の縮め（横長の片にする）


def cells_from(seeds, margin, seed=11):
    rng = np.random.default_rng(seed + 1)
    # 大きな形：横 9〜16 単位ごとの「岩塊」。塊ごとに前後の出入りと傾きを変え、その中の片は小さく揺らす
    mass = []; x = 0.0
    while x < P:
        w = rng.uniform(9, 16); mass.append((x, min(P, x + w), rng.uniform(-.65, .65), rng.uniform(-.06, .06))); x += w
    def mass_dz(px, py):
        px = px % P
        for (a, b, dz, tl) in mass:
            if a <= px < b: return dz + tl * (py - H / 2)
        return 0.0
    S = []
    for sh in (-P, 0, P):
        for (x, y, r) in seeds: S.append((x + sh, y, r))
    S = np.array(S)
    M = np.array([SX, 1.0])
    parts = []
    for i, (x, y, r) in enumerate(S):
        if x < -margin - 4 or x > P + margin + 4: continue
        r = int(r); cs = int(rng.integers(1e6))
        d = np.linalg.norm((S[:, :2] - [x, y]) * M, axis=1); d[i] = 1e9
        nb = np.argsort(d)[:10]
        planes = []
        def add(n, pt): n = _nz(n); planes.append((n, float(n @ np.asarray(pt, float))))
        si = np.array([x, y])
        gap = rng.uniform(.07, .13)
        zf = ROW_FRONT[r] + mass_dz(x, y) + rng.uniform(-.25, .25)
        for j in nb:
            sj = S[j, :2]
            # 縮めた空間の二等分線を本当の空間へ戻す：n·(p - m) ≤ 0、n＝M²(sj - si)
            nn = (sj - si) * M * M; m = (si + sj) / 2
            n3 = np.array([nn[0], nn[1], 0.0]); L = np.linalg.norm(n3); n3 /= L
            add(n3, np.array([m[0], m[1], 0]) - n3 * gap)
            add(n3 + np.array([0, 0, rng.uniform(.8, 1.4)]), np.array([m[0], m[1], zf]) - n3 * (gap + rng.uniform(.18, .45)))   # 割れ目の縁の面取り
        add((rng.uniform(-.2, .2), rng.uniform(-.08, .28), 1), (x, y, zf))                       # 前の面
        if rng.uniform() < .6:                                                                    # 2枚目の前の面（稜線）
            add((rng.uniform(-.45, .45), rng.uniform(-.25, .35), 1), (x + rng.uniform(-.8, .8), y + rng.uniform(-.5, .5), zf - rng.uniform(.0, .25)))
        add((0, 0, -1), (x, y, -1.8))                                                            # 奥（浅く：天辺の面を小さく）
        add((0, -1, 0), (x, 0, 0))                                                                # 地面より下は無い
        top = H - rng.uniform(0, .15)                                                          # 天辺はほぼ揃える（段違いだと縁の線が城の胸壁のように見えた）
        add((rng.uniform(-.08, .08), 1, rng.uniform(-.08, .04)), (x, top, zf))                    # 壁の天辺
        add((rng.uniform(-.3, .3), 1, rng.uniform(.8, 1.3)), (x + rng.uniform(-1, 1), top - rng.uniform(.15, .45), zf))   # 天辺の角の面取り（小さく欠けた縁）
        if r == 2: add((0, -1, .6), (x, y - rng.uniform(.4, .7), zf - .1))                      # 庇の下のえぐれ
        lo = np.array([x - 7, -.1, (zf - 4.2) * 2]); hi = np.array([x + 7, H + .3, (zf + 1.8) * 2])
        tone = rng.uniform(.86, 1.04) * (1.0, .92, 1.08)[r]
        parts.append(Cell(planes, cs, r, lo, hi, tone))
    return parts


def talus_pieces(margin, seed):
    """足もとの崩れ：角ばった斜めの片を並べる（面から床へ三角に落とす）"""
    rng = np.random.default_rng(seed + 7); out = []
    for sh in (-P, 0, P):
        x = 0.0
        r2 = np.random.default_rng(seed + 7)
        while x < P:
            w = r2.uniform(2.0, 5.0); x0, x1 = x + sh + .08, x + w + sh - .08; x += w
            if x1 < -margin or x0 > P + margin: continue
            planes = []
            def add(n, pt): n = _nz(n); planes.append((n, float(n @ np.asarray(pt, float))))
            xc = (x0 + x1) / 2; hgt = r2.uniform(.4, .8); reach = r2.uniform(.4, .8)   # 床へは 1/4 マスほどまで（前は 3/4 マスはみ出した）
            add((r2.uniform(-.25, .25), 1, hgt / reach * r2.uniform(.8, 1.2)), (xc, 0, reach))        # 斜面
            if r2.uniform() < .6: add((r2.uniform(-.6, .6), 1, r2.uniform(.3, 1.6)), (xc + r2.uniform(-1, 1), hgt * r2.uniform(.5, .9), reach * .4))
            add((-1, 0, r2.uniform(.2, .6)), (x0, 0, 0)); add((1, 0, r2.uniform(.2, .6)), (x1, 0, 0))
            add((0, -1, 0), (xc, 0, 0)); add((0, 0, -1), (xc, 0, -1.5)); add((0, 1, 0), (xc, hgt + .2, 0))
            out.append(Cell(planes, int(r2.integers(1e6)), 0, np.array([x0 - .3, -.1, -3.2]), np.array([x1 + .3, hgt + .5, (reach + .4) * 2]), r2.uniform(.66, .8)))
    return out


def scene2(margin=6.0, seed=11):
    seeds, strands, rubble = layout2(seed)
    parts = [Slab(-margin, P + margin, H * 0.55)]          # 芯は低く：天辺の平らな面が暗い帯に見えないよう、片の天辺だけを見せる
    parts += cells_from(seeds, margin, seed)
    parts += talus_pieces(margin, seed)
    for sh in (-P, 0, P):
        for (x, z, y0, L, r, sd) in strands:
            if -margin <= x + sh <= P + margin: parts.append(Strand(x + sh, z, y0, L, r, sd))
        for (x, y, z, rx, ry, rz, sd, tone) in rubble:
            if -margin <= x + sh <= P + margin: parts.append(Boulder((x + sh, y, z), rx, ry, rz, sd, nplanes=8, moss=0.3, tone=tone))
    return parts


def detail(sc):
    """iq の fBM-SDF：表面の近くだけに、球の格子の凹凸を smin/smax で足す（距離場のまま）。
    足もと（y<1.8）は大きめの粒も、全体に小さな粒。"""
    F = sc.F; n = sc.n; lo = sc.lo; GSv = ruin3d.GS
    near = np.abs(F) < 0.9
    idx = np.nonzero(near)
    P_ = np.stack([lo[0] + idx[0] * GSv, lo[1] + idx[1] * GSv, (lo[2] + idx[2] * GSv) * 0.5], -1)   # 本当の空間
    f = F[idx].astype(np.float64)
    def smin(a, b, k): h = np.clip(.5 + .5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h)
    def smax(a, b, k): return -smin(-a, -b, k)
    def sbase(q, cell, seed):
        c = np.floor(q / cell); fr = q / cell - c; d = np.full(len(q), 1e9)
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    o = np.array([dx, dy, dz]); cc = c + o
                    h = np.sin(cc @ np.array([127.1, 311.7, 74.7]) + seed) * 43758.5453; h = h - np.floor(h)
                    r = 0.5 * h * h
                    d = np.minimum(d, np.linalg.norm(fr - o, axis=-1) - r)
        return d * cell
    for (cell, k, amp, ymax) in ((0.9, .25, .12, 1.4),):                # 足もとの崩れだけ（面に付けると泡のように見えた）
        m = P_[:, 1] < ymax
        q = P_[m]; dn = sbase(q, cell, cell * 17.0)
        fm = f[m]
        dn = smax(dn, fm - amp, k)
        f[m] = smin(dn, fm, k)
    F[idx] = f.astype(F.dtype)


LIME = ['#0e1626', '#1c2a42', '#324664', '#566e90', '#8ea6c4']
WARM = ['#1a0f0d', '#3a2219', '#5e3a26', '#8a5a36', '#b8864e']   # 添付の岩肌に寄せた暖色（見比べ用）


def shade(e, lamp, pal, amb=0.12):
    """確かめ用の光。lamp＝(x, y, z) の向き（平行光）"""
    from PIL import Image
    l = np.array(lamp, float); l /= np.linalg.norm(l)
    hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    im = Image.new('RGBA', (e['w'], e['h']), (0, 0, 0, 0))
    for y in range(e['h']):
        for x in range(e['w']):
            c = e['m'][y][x]
            if c == '.': continue
            nv = NRM[ALPHA.index(e['n'][y][x])]; a = 0.4 + int(e['a'][y][x]) / 9 * 0.6
            I = (amb + 0.80 * max(0, float(nv @ l))) * a
            i = int(min(0.999, I) * 5)
            if c == 'k': i = max(0, min(i, 2) - 1)
            if c == 'm': i = min(4, i)
            im.putpixel((x, y), hexc(pal[i]) + (255,))
    return im


def views(parts, path, W=640):
    """3Dモデルそのものを見るための絵：ドットに落とす前の形を、滑らかな陰影で3方向から。
    z は2倍で組んであるので、ここでは半分に戻して（本当の奥行きで）見せる。"""
    from PIL import Image
    ruin3d.GS = 0.08
    sc = ruin3d.Scene('w', parts); sc.bake()
    def cam(yaw, pitch, w, h, span_x, span_y, center):
        cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
        fwd = np.array([-sy * cp, -sp, -cy * cp]); right = np.array([cy, 0, -sy]); up = np.cross(right, fwd)
        xs = (np.arange(w) + .5) / w - .5; ys = (np.arange(h) + .5) / h - .5
        gx, gy = np.meshgrid(xs * span_x, -ys * span_y)
        org = center + gx[..., None] * right + gy[..., None] * up - fwd * 40
        return org, fwd
    def march(org, fwd):
        S = np.array([1, 1, 2.0])                         # 見る空間（z 実寸）→ 組んだ空間（z 2倍）
        t = np.zeros(org.shape[:2]); hit = np.zeros(org.shape[:2], bool); alive = np.ones(org.shape[:2], bool)
        for it in range(300):
            if not alive.any(): break
            p = (org + fwd * t[..., None]) * S
            d = np.ones(t.shape); d[alive] = sc.sample(p[alive])
            nh = alive & (d < 0.01); hit |= nh; alive &= ~nh & (t < 90)
            t = np.where(alive, t + np.maximum(d * 0.5, 0.01), t)
        p = (org + fwd * t[..., None]) * S
        e = 0.08; n = np.zeros(p.shape)
        q = p[hit]
        g = np.stack([sc.sample(q + [e, 0, 0]) - sc.sample(q - [e, 0, 0]), sc.sample(q + [0, e, 0]) - sc.sample(q - [0, e, 0]), (sc.sample(q + [0, 0, e]) - sc.sample(q - [0, 0, e])) / 2], -1)
        n[hit] = g / (np.linalg.norm(g, axis=-1, keepdims=True) + 1e-9)
        return hit, n, p
    L = np.array([-0.45, 0.7, 0.55]); L /= np.linalg.norm(L)
    shots = []
    for (yaw, pitch, label) in ((0.0, math.radians(30), 'game'), (math.radians(-38), math.radians(22), 'three-quarter'), (math.radians(-88), math.radians(8), 'side')):
        h = int(W * 0.42)
        org, fwd = cam(yaw, pitch, W, h, 30, 30 * 0.42, np.array([P / 2, H * 0.45, -0.5]))
        hit, n, p = march(org, fwd)
        I = np.clip(0.18 + 0.82 * (n @ L), 0, 1)
        img = np.zeros(hit.shape + (3,), np.uint8); img[:] = (24, 28, 38)
        col = np.array([200, 192, 178]) * I[..., None]
        img[hit] = col[hit].astype(np.uint8)
        shots.append(Image.fromarray(img))
    out = Image.new('RGB', (W, sum(s.size[1] for s in shots) + 8 * len(shots)), (12, 12, 16)); y = 0
    for s_ in shots: out.paste(s_, (0, y)); y += s_.size[1] + 8
    out.save(path)


def apply(e):
    """proto/cave-look.js の WALL_SPR を書き換える"""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'proto', 'cave-look.js')
    s = open(p, encoding='utf-8').read()
    a, b = s.index('/*WALL_SPR_BEGIN*/'), s.index('/*WALL_SPR_END*/')
    keep = {k: e[k] for k in ('w', 'h', 'ax', 'ay', 'm', 'n', 'a', 'hts')}
    s = s[:a] + '/*WALL_SPR_BEGIN*/const WALL_SPR=' + json.dumps(keep, separators=(',', ':')) + ';' + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
    print('applied WALL_SPR', e['w'], e['h'])


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    parts = scene2()
    r = cave3d.render(parts, gs=0.08)
    e = cave3d.encode(r)
    # 真ん中の1周期（x=0..P）だけ残す
    x0 = e['ax']; x1 = x0 + int(round(P * PX))
    for k in ('m', 'n', 'a', 'hts'):
        e[k] = [row[x0:x1] for row in e[k]]
    e['w'] = x1 - x0; e['ax'] = 0
    # 天辺（上を向いた面）は、列ごとに面のすぐ上の LIP ドットだけ残す。
    # 奥の天辺はゲームでは「上から見た岩（天井）」が描くので要らない。行でまとめて切ると、片の天辺の平らな面が
    # 暗い帯として残った（前の版）。
    LIP = 3
    def up(y, x):                       # 面（カメラの方を向いた立ち上がり）でない＝天辺・横の割れ目の面
        v = NRM[ALPHA.index(e['n'][y][x])]; return not (v[2] > 0.45 and v[1] < 0.75)
    rows = [list(r) for r in e['m']]
    for x in range(e['w']):
        face = next((y for y in range(e['h']) if rows[y][x] != '.' and not up(y, x)), None)
        if face is None: continue
        for y in range(0, max(0, face - LIP)): rows[y][x] = '.'
    # 列ごとの天辺の高さを、周り41列の中央値から3ドット以上は飛び出させない（引っ込んだ片の面が細い柱や箱に見えた）
    tops = [next((y for y in range(e['h']) if rows[y][x] != '.'), e['h']) for x in range(e['w'])]
    for x in range(e['w']):
        win = sorted(tops[(x + k) % e["w"]] for k in range(-20, 21))
        lim = win[len(win) // 2] - 1
        for y in range(0, max(0, lim)): rows[y][x] = '.'
    e['m'] = [''.join(r) for r in rows]
    first = next(y for y in range(e['h']) if any(c != '.' for c in e['m'][y]))
    for k in ('m', 'n', 'a', 'hts'): e[k] = e[k][first:]
    e['h'] -= first; e['ay'] -= first
    json.dump(e, open(os.path.join(OUTDIR, 'wall_a.json'), 'w'))
    from PIL import Image
    shots = [shade(e, (-0.4, 0.5, 0.75), LIME), shade(e, (0.6, 0.3, 0.75), LIME), shade(e, (-0.4, 0.5, 0.75), WARM)]
    W, Hh = e['w'], e['h']
    sheet = Image.new('RGBA', (W, Hh * 3 + 8), (20, 24, 34, 255))
    for i, s in enumerate(shots): sheet.alpha_composite(s, (0, i * (Hh + 4)))
    sheet.resize((W * 5, sheet.size[1] * 5), Image.NEAREST).save(os.path.join(OUTDIR, 'wall_a.png'))
    print('wall', e['w'], e['h'], 'ay', e['ay'])
    if '--views' in FLAGS: views(parts, os.path.join(OUTDIR, 'wall_views.png'))
    if '--apply' in FLAGS: apply(e)


if __name__ == '__main__':
    main()
