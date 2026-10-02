#!/usr/bin/env python3
"""石柱を 3D（符号付き距離場＝SDF）で組み立て、ゲームの斜め上からの視点で描いてドット絵に落とす。

  python3 tools/pillar3d.py [出力ディレクトリ] [--apply]
    --apply を付けると proto/cave-look.js の RUIN_SPR（印の間）を書き換える

出力:
  pillars.js        … cave-look.js に貼る `RUIN_SPR`（色番号の文字列で書いたスプライト）
  preview.png       … 高解像度の陰影つき描画と、落としたドット絵（8倍）を並べた確認用
  pillar_<名>.obj   … 形そのもの（Blender などで開ける。マーチングキューブで面にしたもの）

なぜ 3D から作るか:
  手で規則を書いた柱は、講評のたびに「丸く見えない」「缶に見える」を規則で潰していた。
  形を 3D で持てば、丸み・上面の楕円・欠け・継ぎ目の陰は光の計算から自然に出る。
  変わり種（折れ方・太さ・高さ）も、形の数値を変えるだけで同じ光のまま増やせる。

座標: x 右、y 上、z 手前。半径 1 の柱が画面で 8 ドット（1 単位 = 4 ドット）。
カメラ: 正射影、仰角 THETA（上面の楕円の縦横比 = sin THETA ≒ 0.42）。光は左上手前から。
色: 拠点の砂色の 7 段（RP_T）＋オリーブの苔 3 段。輪郭は描き方の規則（左は暗、右と下は最暗、上は中間）。
"""
import sys, os, math, json
import numpy as np

OUT = [a for a in sys.argv[1:] if not a.startswith('--')][0] if [a for a in sys.argv[1:] if not a.startswith('--')] else os.path.join(__import__('tempfile').gettempdir(), 'pillar3d-out')   # .obj は大きいのでリポジトリの外へ
os.makedirs(OUT, exist_ok=True)

THETA = math.radians(30)
PX = 4.0          # 1 単位あたりのドット数
SS = 8            # 1 ドットあたりの標本（縦横）
# 光：カメラの軸から左へ60°、仰角45°（影の境が幅の7割あたりに来る＝右の暗い側を細く）。講評で決めた
_AZ, _EL = math.radians(60), math.radians(45)
LIGHT = np.array([-math.sin(_AZ) * math.cos(_EL), math.sin(_EL), math.cos(_AZ) * math.cos(_EL)])
AMB = 0.35

# ---------------- ノイズ ----------------
def _hash(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1442695041) & 0xffffffff
    h = (h ^ (h >> 13)) * 1274126177 & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0

def vnoise(p, seed=0):
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    ix, iy, iz = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64), np.floor(z).astype(np.int64)
    fx, fy, fz = x - ix, y - iy, z - iz
    ux, uy, uz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    acc = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (ux if dx else 1 - ux) * (uy if dy else 1 - uy) * (uz if dz else 1 - uz)
                acc = acc + w * _hash(ix + dx, iy + dy, iz + dz, seed)
    return acc

def fbm(p, seed=0, oct=3):
    a, f, s = 0.5, 1.0, 0
    for o in range(oct):
        s = s + a * vnoise(p * f, seed + o * 17)
        a *= 0.5; f *= 2.07
    return s / (1 - 0.5 ** oct)

# ---------------- 形 ----------------
class Pillar:
    """broken=(傾き, 高い側の高さ, 低い側への落ち, 平らな頂の幅[単位]) / groove=継ぎ目の高さ（1本だけ、無ければ None）"""
    def __init__(self, name, R=1.0, H=4.0, groove=None, broken=None, chips=(), seed=1, moss=0.5, flip=False):
        self.name, self.R, self.H, self.groove, self.broken, self.chips, self.seed, self.moss, self.flip = name, R, H, groove, broken, chips, seed, moss, flip

    def cut(self, p):
        """折れ口の面（正なら外）。高い側に平らな頂を残し、反対へ落ちる。面は 2px 周期で 1〜1.5px 揺らし、段を1つ"""
        if not self.broken: return None
        hi, fall, flat = self.broken
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        u = (-x if self.flip else x) + self.R            # 高い側（左）から測った位置 0..2R
        drop = np.clip((u - flat) / max(0.1, 2 * self.R - flat), 0, 1) * fall
        step = np.where(u > self.R * 1.1, 0.22, 0.0)      # 段（欠け）を1つ
        top = hi - drop - step + 0.30 * (fbm(p * np.array([2.0, 1.0, 2.0]), self.seed + 5) - 0.5) - 0.06 * z
        return y - top

    def sdf(self, p):
        R, H = self.R, self.H
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        rr = np.sqrt(x * x + z * z)
        r = R - 0.03 * fbm(p * np.array([3.0, 2.2, 3.0]), self.seed)
        if self.groove is not None:                      # 継ぎ目：幅1ドット・深さ0.5ドットの溝
            r = r - 0.06 * np.exp(-((y - self.groove) / 0.10) ** 2) * (fbm(p * 1.6, self.seed + 13) > 0.42)   # 1〜2か所で途切れる
        bev = 0.42 * self.R          # 角を大きく丸める（見本の柱は頭が丸い）
        qx = rr - (r - bev)
        qy = np.abs(y - H / 2) - (H / 2 - bev)
        d = np.minimum(np.maximum(qx, qy), 0) + np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) - bev
        c = self.cut(p)
        if c is not None: d = np.maximum(d, c * 0.8)
        for (cx, cy, cz, cr) in self.chips:
            d = np.maximum(d, cr - np.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2))
        d = np.maximum(d, -y)
        return d

    def albedo(self, p):
        """石の肌：2〜3ドットの大きさ、縦に2倍伸ばした明暗のむら（±1段）。継ぎ目は途切れながら暗く"""
        a = 1.0 + 0.24 * (fbm(p * np.array([1.7, 0.85, 1.7]), self.seed + 3) - 0.5)
        if self.groove is not None:
            g = np.exp(-((p[..., 1] - self.groove) / 0.13) ** 2)
            a = a - 0.16 * g * (fbm(p * 1.6, self.seed + 13) > 0.45)
        return a

    def moss_mask(self, p, n):
        y = p[..., 1]
        side = (y < self.H * 0.25) & (n[..., 0] < 0.25) & (n[..., 2] > -0.2)
        top = n[..., 1] > 0.7
        lf = fbm(p * 1.3 + 7.3, self.seed + 9)
        side = (y < self.H * 0.30) & (n[..., 0] < 0.3) & (n[..., 2] > -0.2)
        return (side & (lf > 0.56 - 0.20 * self.moss)) | (top & (lf > 0.72 - 0.10 * self.moss))   # 上を向いた面（折れ口）にもひとつまみ

# ---------------- 描く ----------------
def render(obj, out_w, out_h, base_row):
    """正射影でレイを飛ばす。戻り値：被覆率・明るさ・苔の割合（ドットごと）、高解像度の陰影画像"""
    W, Hh = out_w * SS, out_h * SS
    right = np.array([1.0, 0, 0])
    up = np.array([0, math.cos(THETA), -math.sin(THETA)])
    fwd = np.array([0, -math.sin(THETA), -math.cos(THETA)])
    # 画面座標（ドット）→ 世界：根元の中心 (0,0,0) が (out_w/2, base_row+1) に来る
    xs = (np.arange(W) + 0.5) / SS - out_w / 2
    ys = (base_row + 1) - (np.arange(Hh) + 0.5) / SS
    gx, gy = np.meshgrid(xs, ys)
    org = (gx[..., None] * right + gy[..., None] * up) / PX - fwd * 8
    dirn = np.broadcast_to(fwd, org.shape)
    t = np.zeros(gx.shape); hit = np.zeros(gx.shape, bool); alive = np.ones(gx.shape, bool)
    for it in range(160):
        p = org + dirn * t[..., None]
        d = obj.sdf(p)
        hit |= alive & (d < 0.002)
        alive &= ~hit & (t < 20)
        t = np.where(alive, t + np.maximum(d * 0.8, 0.002), t)
        if not alive.any(): break
    p = org + dirn * t[..., None]
    e = 0.004
    nx = obj.sdf(p + [e, 0, 0]) - obj.sdf(p - [e, 0, 0])
    ny = obj.sdf(p + [0, e, 0]) - obj.sdf(p - [0, e, 0])
    nz = obj.sdf(p + [0, 0, e]) - obj.sdf(p - [0, 0, e])
    n = np.stack([nx, ny, nz], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-9
    # 遮蔽（近いほど暗い）：法線方向に少しずつ離れて距離を測る
    ao = np.ones(gx.shape)
    for k, s in enumerate((0.06, 0.14, 0.26)):
        ao -= (s - obj.sdf(p + n * s)) * (0.9 / (k + 1))
    ao = np.clip(ao, 0.35, 1)
    dif = np.clip((n * LIGHT).sum(-1), 0, 1)
    lum = (AMB + 0.75 * dif) * ao
    hy = p[..., 1] / obj.H
    lum = lum + 0.10 * np.clip((hy - 0.85) / 0.08, 0, 1) - 0.10 * np.clip((0.4 - hy) / 0.15, 0, 1)   # 上15%は一段明るく、下は一段暗く
    lum = lum - 0.10 * np.clip(1 - p[..., 1] / 0.5, 0, 1)                                          # 根元の接地の陰
    lum = lum + 0.06 * np.clip(n[..., 1], 0, 1) ** 2
    lum = lum * obj.albedo(p)                                                                       # 肌のむらは最後に（明るい所でも消えない）
    moss = obj.moss_mask(p, n) & hit
    c = obj.cut(p); brk = hit & (np.abs(c * 0.8 - obj.sdf(p)) < 0.01) if c is not None else np.zeros(gx.shape, bool)
    # ドットへ：中央を重く見た平均（縁の中間色を減らす）
    wy = np.exp(-(((np.arange(SS) + 0.5) / SS - 0.5) / 0.32) ** 2); wk = np.outer(wy, wy); wk /= wk.sum()
    def pool(a): return (a.reshape(out_h, SS, out_w, SS) * wk[None, :, None, :]).sum(axis=(1, 3))
    cov = pool(hit.astype(float))
    L = pool(np.where(hit, lum, 0)) / np.maximum(cov, 1e-6)
    M = pool(moss.astype(float)) / np.maximum(cov, 1e-6)
    B = pool(brk.astype(float)) / np.maximum(cov, 1e-6)
    hi = np.where(hit, np.clip(lum, 0, 1), np.nan)
    # ゲームでランタンの光を当て直すための、面の向き（ドットの真ん中。外れたら平均）と焼いた光の強さ
    c_ = SS // 2
    def mid(a): return a.reshape(out_h, SS, out_w, SS, *a.shape[2:])[:, c_, :, c_]
    hc = mid(hit); NC = mid(n)
    nav = np.stack([pool(np.where(hit, n[..., i], 0)) for i in range(3)], -1)
    NC = np.where(hc[..., None], NC, nav); NC = NC / (np.linalg.norm(NC, axis=-1, keepdims=True) + 1e-9)
    DC = np.where(hc, mid(dif), pool(np.where(hit, dif, 0)) / np.maximum(cov, 1e-6))
    render.last = (NC, DC)
    return cov, L, M, B, hi

TONES = ['#3e3a3c', '#5a534f', '#7a6f5e', '#9f906e', '#c3ad98', '#d6bca6', '#e8d6c0']   # 0..6
MOSS = ['#5a5236', '#7a6a44', '#948448']                                                  # a b c
OL = '#2b2420'                                                                            # o
TH = [0.30, 0.42, 0.55, 0.69, 0.83, 0.95]     # 明るさ → 段（0..6）の境

def quantize(cov, L, M, B, hiLeft=True):
    h, w = cov.shape
    solid = cov >= 0.45
    g = [['.'] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not solid[y, x]: continue
            v = L[y, x]; i = sum(v > t for t in TH)
            if M[y, x] >= 0.5: g[y][x] = 'abc'[0 if i <= 2 else 1 if i <= 4 else 2]
            elif B[y, x] >= 0.5: g[y][x] = str(min(max(i, 3), 4))           # 折れ口の面は明か中
            else: g[y][x] = str(i)
    # 折れ口の高い側の縁だけ照り（2つ）
    if B.max() > 0.5:
        cols = [x for x in range(w) if any(B[y, x] >= 0.5 and solid[y, x] for y in range(h))]
        for x in (cols[:2] if hiLeft else cols[-2:]):
            y = next(y for y in range(h) if solid[y, x]); g[y][x] = '6'
    # ぽつんと1つだけ違う点を消す（上下左右の4つが同じ値なら、それに合わせる）
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = g[y][x]
            if c == '.': continue
            nb = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]]
            if '.' in nb: continue
            for v in set(nb):
                if v != c and nb.count(v) >= 3 and c not in nb: g[y][x] = v; break
    # 周りの4つ全部より2段以上明るい点は、周りの中央値に（影の側に紛れた明るい点）
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = g[y][x]
            if c not in '0123456': continue
            nb = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]]
            if any(v not in '0123456' for v in nb): continue
            nv = sorted(int(v) for v in nb)
            if all(int(c) - v >= 2 for v in nv): g[y][x] = str(nv[1])
    # 苔は3ドット未満のかたまりを消す（ばらけた点は泥に見える）
    seen = set()
    for y in range(h):
        for x in range(w):
            if g[y][x] not in 'abc' or (y, x) in seen: continue
            st, comp = [(y, x)], []
            seen.add((y, x))
            while st:
                cy, cx = st.pop(); comp.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and (ny, nx) not in seen and g[ny][nx] in 'abc': seen.add((ny, nx)); st.append((ny, nx))
            if len(comp) < 3:
                for cy, cx in comp: g[cy][cx] = '2'
    # 影の側（右端の手前2列）は中間色より明るくしない（暗い帯に明るい点が紛れない）
    for y in range(h):
        xs = [x for x in range(w) if g[y][x] != '.']
        if len(xs) < 4: continue
        for x in xs[-3:-1]:
            if g[y][x] in '456': g[y][x] = '3'
    # 最も明るい色は上の面の左上に6つまで
    hh = sorted([(y + x * 0.7, y, x) for y in range(h) for x in range(w) if g[y][x] == '6'])
    for _, y, x in hh[6:]: g[y][x] = '5'
    # 輪郭：左は暗（1）、右と下は最暗（0／o）、上は中間〜明
    for y in range(h):
        for x in range(w):
            if g[y][x] == '.': continue
            L_ = x == 0 or g[y][x - 1] == '.' or (y > 0 and g[y - 1][x - 1] == '.' and g[y - 1][x] != '.') or (y < h - 1 and g[y + 1][x - 1] == '.' and g[y + 1][x] != '.')   # 左は8近傍で（段の付いた縁も途切れない）
            R_ = x == w - 1 or g[y][x + 1] == '.'
            U_ = y == 0 or g[y - 1][x] == '.'
            D_ = y == h - 1 or g[y + 1][x] == '.'
            if R_: g[y][x] = 'o' if D_ else '0'
            elif D_: g[y][x] = '0'
            elif L_ and g[y][x] not in 'abc': g[y][x] = '1' if not U_ else '2'
            elif U_ and g[y][x] in '0123456' and g[y][x] != '6': g[y][x] = str(min(max(int(g[y][x]), 3), 5))
    # 根元の弧：端の列は1行上で終わり、中央の2列は1行下まで（下の輪郭を平らな1行にしない）
    bot = [max([y for y in range(h) if g[y][x] != '.'], default=-1) for x in range(w)]
    xs = [x for x in range(w) if bot[x] >= 0]
    if xs:
        xl, xr = xs[0], xs[-1]; mid = (xl + xr) / 2
        for x in (xl, xr):
            if bot[x] > 0 and g[bot[x] - 1][x] != '.': g[bot[x]][x] = '.'; g[bot[x] - 1][x] = 'o' if x == xr else '0'
        for x in xs:
            if abs(x - mid) < 1 and bot[x] + 1 < h: g[bot[x] + 1][x] = '0'
    return [''.join(r) for r in g]

def to_rgb(rows):
    pal = {str(i): TONES[i] for i in range(7)}; pal.update({'a': MOSS[0], 'b': MOSS[1], 'c': MOSS[2], 'o': OL})
    h, w = len(rows), len(rows[0])
    img = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.': continue
            c = pal[ch]; img[y, x] = [int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255]
    return img

def export_obj(obj, path, res=72):
    from skimage.measure import marching_cubes
    R, H = obj.R + 0.2, obj.H + 0.2
    xs = np.linspace(-R, R, res); ys = np.linspace(-0.05, H, int(res * H / (2 * R))); zs = np.linspace(-R, R, res)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    vol = obj.sdf(np.stack([X, Y, Z], -1))
    v, f, _, _ = marching_cubes(vol, 0.0, spacing=(xs[1] - xs[0], ys[1] - ys[0], zs[1] - zs[0]))
    v += [xs[0], ys[0], zs[0]]
    with open(path, 'w') as fh:
        fh.write('# %s (tools/pillar3d.py)\n' % obj.name)
        for a in v: fh.write('v %.4f %.4f %.4f\n' % tuple(a))
        for a in f: fh.write('f %d %d %d\n' % (a[0] + 1, a[2] + 1, a[1] + 1))

# ---------------- 変わり種 ----------------
VARIANTS = [
    # 陸に立つ柱（幅8）。継ぎ目は半分の柱にだけ1本
    Pillar('tall_a', R=1.0, H=4.2, groove=2.6, chips=((0.62, 3.0, 0.72, 0.26),), seed=3, moss=0.6),
    Pillar('tall_b', R=1.0, H=3.8, chips=((-0.55, 1.6, 0.8, 0.24),), seed=8, moss=0.8),
    Pillar('broken_a', R=1.0, H=4.6, groove=1.7, broken=(3.7, 0.9, 0.75), seed=11, moss=0.5),
    Pillar('broken_b', R=0.92, H=4.0, broken=(3.0, 1.1, 0.7), chips=((0.6, 1.3, 0.65, 0.24),), seed=21, moss=0.7, flip=True),
    # 水に立つ柱（細め・低め。根元は水面で、水の扱いはゲーム側）
    Pillar('water_a', R=0.78, H=3.0, groove=1.5, seed=31, moss=0.35),
    Pillar('water_b', R=0.75, H=3.3, broken=(2.6, 0.7, 0.55), seed=37, moss=0.3),
    Pillar('water_c', R=0.85, H=2.8, broken=(2.3, 0.8, 0.6), seed=41, moss=0.4, flip=True),
    # 倒れた柱の脇に立つ短い柱（平らな頂が残る折れ方）
    Pillar('stub', R=0.95, H=2.6, groove=1.0, broken=(2.2, 0.55, 0.8), seed=51, moss=0.5),
]

def main():
    from PIL import Image
    sprites, previews = {}, []
    for v in VARIANTS:
        top = v.R * math.sin(THETA) * PX * 2
        out_w = int(math.ceil(v.R * 2 * PX)) + 2
        out_h = int(math.ceil(v.H * math.cos(THETA) * PX + top)) + 3
        base = out_h - 2
        cov, L, M, B, hi = render(v, out_w, out_h, base)
        rows = quantize(cov, L, M, B, not v.flip)
        NC, DC = render.last
        # 空の行・列を詰める（根元の行＝ base は残す）
        keep_c = [x for x in range(out_w) if any(r[x] != '.' for r in rows)]
        first = next(i for i, r in enumerate(rows) if r.strip('.'))
        last = max(i for i, r in enumerate(rows) if r.strip('.'))
        x0_, x1_ = keep_c[0], keep_c[-1] + 1
        rows = [r[x0_:x1_] for r in rows[first:last + 1]]
        NC, DC = NC[first:last + 1, x0_:x1_], DC[first:last + 1, x0_:x1_]
        from ruin3d import relight_rows
        nrows, krows = relight_rows(rows, NC, DC)
        sprites[v.name] = {'w': len(rows[0]), 'h': len(rows), 'rows': rows, 'n': nrows, 'k': krows}
        # 確認用：高解像度の陰影（灰）と、ドット絵の8倍
        g = np.nan_to_num(hi, nan=0.12)
        hi_img = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).convert('RGB')
        px = Image.fromarray(to_rgb(rows), 'RGBA').resize((len(rows[0]) * 12, len(rows) * 12), Image.NEAREST)
        previews.append((v.name, hi_img, px))
        export_obj(v, os.path.join(OUT, 'pillar_%s.obj' % v.name))
    # 確認用の一枚
    from PIL import ImageDraw
    Hm = max(max(a.height for _, a, b in previews), max(b.height for _, a, b in previews)) + 20
    Wt = sum(a.width + b.width + 30 for _, a, b in previews)
    sheet = Image.new('RGB', (Wt, Hm), (34, 52, 56)); x = 0; dr = ImageDraw.Draw(sheet)
    for name, a, b in previews:
        sheet.paste(a, (x, 18)); x += a.width + 6
        sheet.paste(b, (x, 18 + Hm - 20 - b.height), b); dr.text((x, 2), name, fill=(230, 220, 200)); x += b.width + 24
    sheet.save(os.path.join(OUT, 'preview.png'))
    with open(os.path.join(OUT, 'pillars.js'), 'w') as fh:
        fh.write('/* tools/pillar3d.py が書き出した石柱のスプライト。手で直さず、スクリプトを直して出し直す。\n')
        fh.write('   文字: . 透明／0〜6 石の段（RP_T）／a b c 苔／o 輪郭 */\n')
        fh.write('const RUIN_SPR=' + json.dumps(sprites, ensure_ascii=False) + ';\n')
    # cave-look.js の印の間を書き換える（--apply を付けたときだけ）
    if '--apply' in sys.argv:
        cl = os.path.join(os.path.dirname(__file__), '..', 'proto', 'cave-look.js')
        src = open(cl, encoding='utf-8').read()
        a0, a1 = src.index('/*RUIN_SPR_BEGIN*/'), src.index('/*RUIN_SPR_END*/')
        src = src[:a0] + '/*RUIN_SPR_BEGIN*/const RUIN_SPR=' + json.dumps(sprites, ensure_ascii=False, separators=(',', ':')) + ';' + src[a1:]
        open(cl, 'w', encoding='utf-8').write(src)
        print('applied to', cl)
    print(json.dumps({k: (s['w'], s['h']) for k, s in sprites.items()}))

if __name__ == '__main__':
    main()
