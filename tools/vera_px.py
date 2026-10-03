#!/usr/bin/env python3
"""ヴェラ（10階の大ボス）の手打ちドット絵。

ユーザーが見本に出した2枚（暗い低明度の体＋強く光る差し色＋粒子）の画風に寄せて、
1ドット＝ゲームの1ドットの格子に、部品ごとに描く。網目（ディザ）は使わない。

- 体は各素材3〜5段の暗い色だけ。読ませるのは形（シルエット）と、光る琥珀の差し色。
- 岩の脚は「丸い岩の塊の連なり」：塊ごとに上が明るく、塊と塊の間は暗い溝。
- 琥珀（a*）は自分で光る色。ゲームはランタンの明るさで暗くしない（cave-look.js の veraBlit）。

出力：proto/cave-look.js の /*VERA_SPR_BEGIN*/〜/*VERA_SPR_END*/ を書き換える（--apply）。
  python3 tools/vera_px.py [--apply] [--preview 出力dir]
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

# ---- パレット（0＝透明） ----
PAL = [None]
NAME = {}
def col(name, hexc):
    NAME[name] = len(PAL); PAL.append(hexc)
for n, h in [
    ('k0', '#0a0b0f'),
    ('r0', '#16171b'), ('r1', '#22252a'), ('r2', '#31363a'), ('r3', '#434b4b'), ('r4', '#5b6661'), ('r5', '#7f8b82'),
    ('n0', '#121318'), ('n1', '#1c1e25'), ('n2', '#282b34'), ('n3', '#393d48'),
    ('c0', '#11211f'), ('c1', '#193536'), ('c2', '#244c4a'), ('c3', '#376a64'), ('c4', '#558e82'),
    ('i0', '#463e33'), ('i1', '#776d59'), ('i2', '#aa9f87'), ('i3', '#d6cdb4'), ('i4', '#f3edda'),
    ('o0', '#2b1f15'), ('o1', '#4d3723'), ('o2', '#755532'), ('o3', '#a27b49'),
    ('a0', '#5e2610'), ('a1', '#a8471a'), ('a2', '#e7832a'), ('a3', '#ffc25a'), ('a4', '#fff1bd'),
]:
    col(n, h)
EMIS = [NAME[k] for k in ('a0', 'a1', 'a2', 'a3', 'a4')]
R = lambda *ks: [NAME[k] for k in ks]
ROCK = R('r0', 'r1', 'r2', 'r3', 'r4', 'r5')
INK = R('n0', 'n1', 'n2', 'n3')
CAPE = R('c0', 'c1', 'c2', 'c3', 'c4')
IVO = R('i0', 'i1', 'i2', 'i3', 'i4')
OCH = R('o0', 'o1', 'o2', 'o3')
AMB = R('a0', 'a1', 'a2', 'a3', 'a4')
K0 = NAME['k0']


class Piece:
    """1枚の部品。a[y,x]＝パレット番号。原点 (ox,oy) は合成の基準点（足もとの中心）"""
    def __init__(s, W, H, ox, oy):
        s.W, s.H, s.ox, s.oy = W, H, ox, oy
        s.a = np.zeros((H, W), np.int16)

    def P(s, x, y):  # 基準点からの座標 → 配列の添字
        return int(round(s.ox + x)), int(round(s.oy + y))

    def mask_poly(s, pts):
        im = Image.new('L', (s.W, s.H), 0)
        ImageDraw.Draw(im).polygon([(s.ox + x, s.oy + y) for x, y in pts], fill=1, outline=1)
        return np.array(im, bool)

    def mask_ell(s, cx, cy, rx, ry):
        yy, xx = np.mgrid[0:s.H, 0:s.W]
        return ((xx + .5 - (s.ox + cx)) / rx) ** 2 + ((yy + .5 - (s.oy + cy)) / ry) ** 2 <= 1.0

    def put(s, x, y, c):
        X, Y = s.P(x, y)
        if 0 <= X < s.W and 0 <= Y < s.H: s.a[Y, X] = c

    def line(s, x0, y0, x1, y1, c, only=None):
        X0, Y0 = s.P(x0, y0); X1, Y1 = s.P(x1, y1)
        dx, dy = abs(X1 - X0), -abs(Y1 - Y0); sx = 1 if X0 < X1 else -1; sy = 1 if Y0 < Y1 else -1; e = dx + dy
        while True:
            if 0 <= X0 < s.W and 0 <= Y0 < s.H and (only is None or s.a[Y0, X0] in only): s.a[Y0, X0] = c
            if X0 == X1 and Y0 == Y1: break
            e2 = 2 * e
            if e2 >= dy: e += dy; X0 += sx
            if e2 <= dx: e += dx; Y0 += sy

    # 面：上の縁が明るく、下の縁が暗い。lit＝上の縁の明るい帯の太さ
    def shade(s, m, ramp, base=1, lit=1, dark=1, rim=True, left=True):
        if not m.any(): return
        up = np.zeros_like(m); up[1:] = m[:-1]
        dn = np.zeros_like(m); dn[:-1] = m[1:]
        lf = np.zeros_like(m); lf[:, 1:] = m[:, :-1]
        a = s.a
        a[m] = ramp[base]
        top = m.copy()
        for _ in range(lit):
            sh = np.zeros_like(top); sh[1:] = top[:-1]; top = top & sh
        band = m & ~top
        a[band] = ramp[min(len(ramp) - 1, base + 1)]
        if left:
            ledge = m & ~lf
            a[ledge & ~band] = ramp[min(len(ramp) - 1, base + 1)]
        if rim:
            edge = m & ~up
            a[edge] = ramp[min(len(ramp) - 1, base + 2)]
        if dark:
            bot = m & ~dn
            a[bot] = ramp[max(0, base - 1)]

    # 岩の塊：中は ramp[2]、上の左寄りに明るい塊、上の縁に一番明るい点、下と既にある物との境に溝
    def boulder(s, cx, cy, rx, ry, ramp=ROCK, lift=0, groove=True):
        m = s.mask_ell(cx, cy, rx, ry)
        if not m.any(): return m
        er = m.copy(); er[1:] &= m[:-1]; er[:-1] &= m[1:]; er[:, 1:] &= m[:, :-1]; er[:, :-1] &= m[:, 1:]
        edge = m & ~er
        had = s.a != 0
        s.a[m] = ramp[2 + lift]
        yy, xx = np.mgrid[0:s.H, 0:s.W]
        hx, hy = s.ox + cx - rx * .28, s.oy + cy - ry * .42
        hl = m & (((xx + .5 - hx) / (rx * .72)) ** 2 + ((yy + .5 - hy) / (ry * .55)) ** 2 <= 1)
        s.a[hl] = ramp[3 + lift]
        up = np.zeros_like(m); up[1:] = m[:-1]
        topedge = m & ~up & (xx + .5 < s.ox + cx + rx * .35)
        s.a[topedge] = ramp[min(5, 4 + lift)]
        dn = np.zeros_like(m); dn[:-1] = m[1:]
        s.a[m & ~dn] = ramp[1]
        rt = np.zeros_like(m); rt[:, :-1] = m[:, 1:]
        s.a[m & ~rt & ~topedge] = ramp[1]
        if groove: s.a[edge & had] = ramp[0]
        return m

    def outline(s, c=K0):
        m = s.a != 0
        n = np.zeros_like(m)
        n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        s.a[n & ~m] = c

    def crop(s):
        ys, xs = np.nonzero(s.a)
        if not len(ys): return dict(w=0, h=0, x=0, y=0, d='')
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sub = s.a[y0:y1, x0:x1]
        return dict(w=int(x1 - x0), h=int(y1 - y0), x=int(x0 - s.ox), y=int(y0 - s.oy), d=rle(sub))


CH = '.' + ''.join(chr(c) for c in range(ord('A'), ord('Z') + 1)) + ''.join(chr(c) for c in range(ord('a'), ord('z') + 1))
def rle(sub):
    out = []
    flat = sub.flatten().tolist(); i = 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i] and j - i < 60: j += 1
        n = j - i
        out.append((str(n) if n > 1 else '') + CH[flat[i]]); i = j
    return ''.join(out)


# ===================== 第二形態：岩の蟹の脚 =====================
W2, H2, OX2, OY2 = 84, 72, 40, 64   # 部品の画用紙と基準点（足もとの中心）

def rock_leg(hip, knee, tip, far=False, state='ok', seed=0):
    """脚1本。hip→knee（腿：大きな塊2つ）→ tip（脛：小さくなる塊＋尖った爪）。
    state: ok / hurt（割れ目が琥珀に光る）/ crit（割れ目が増える）/ broken（根元だけ、先は石屑）"""
    p = Piece(W2, H2, OX2, OY2)
    ramp = ROCK if not far else [ROCK[0], ROCK[0], ROCK[1], ROCK[2], ROCK[3], ROCK[3]]
    (hx, hy), (kx, ky), (tx, ty) = hip, knee, tip
    lerp = lambda a, b, u: a + (b - a) * u
    if state == 'broken':
        for u, r in ((0.0, 4.6), (0.42, 3.8)):
            p.boulder(lerp(hx, kx, u), lerp(hy, ky, u), r, r * .85, ramp)
        mx, my = lerp(hx, kx, .55), lerp(hy, ky, .55)
        p.line(mx - 1, my - 2, mx + 1, my + 2, AMB[1])   # 折れ口が燻る
        p.put(mx, my, AMB[2])
        # 先は石屑になって床に
        for dx, dy, r in ((-3, -1.6, 2.4), (1.5, -1.2, 1.9), (4.5, -.9, 1.5), (-6, -1.0, 1.4)):
            p.boulder(tx + dx, ty + dy, r, r * .75, ramp)
        p.outline(); return p
    sc = .85 if far else 1.0
    def seg(x0, y0, x1, y1, w0, w1, plates):
        """太さ w0→w1 の岩の節。上側（光を受ける面）と下側（陰の面）の2面＋横切る継ぎ目"""
        dx, dy = x1 - x0, y1 - y0; l = math.hypot(dx, dy) or 1; nx, ny = -dy / l, dx / l
        if ny > 0: nx, ny = -nx, -ny                                  # n＝上を向く側
        up = p.mask_poly([(x0, y0), (x1, y1), (x1 + nx * w1, y1 + ny * w1), (x0 + nx * w0, y0 + ny * w0)])
        lo = p.mask_poly([(x0, y0), (x1, y1), (x1 - nx * w1, y1 - ny * w1), (x0 - nx * w0, y0 - ny * w0)])
        p.shade(lo & ~up, ramp, base=2, lit=0, dark=1, rim=False, left=False)
        p.shade(up, ramp, base=3, lit=1, dark=0, rim=True)
        for k in range(1, plates):
            u = k / plates; cx, cy = x0 + dx * u, y0 + dy * u; w = w0 + (w1 - w0) * u
            p.line(cx + nx * w, cy + ny * w, cx - nx * w * .9, cy - ny * w * .9, ramp[0], only=set(ramp[1:]))
            p.put(cx + nx * (w - 1) + dx / l, cy + ny * (w - 1) + dy / l, ramp[4])
        return up | lo
    seg(hx, hy, kx, ky, 3.6 * sc, 3.0 * sc, 2)                         # 腿
    p.boulder(hx, hy, 3.8 * sc, 3.2 * sc, ramp)                        # 付け根の塊
    dx, dy = tx - kx, ty - ky; l = math.hypot(dx, dy); ux, uy = dx / l, dy / l
    sx, sy = tx - ux * 6, ty - uy * 6
    seg(kx, ky, sx, sy, 2.8 * sc, 1.7 * sc, 3)                         # 脛
    p.boulder(kx, ky, 3.7 * sc, 3.2 * sc, ramp)                        # 膝の塊（一番高い所）
    p.boulder(kx + (sx - kx) * .5, ky + (sy - ky) * .5, 2.2 * sc, 2.0 * sc, ramp)   # 脛の瘤
    # 尖った爪（先が明るい石の棘で接地）
    nx, ny = -uy, ux
    m = p.mask_poly([(sx + nx * 1.9 * sc, sy + ny * 1.9 * sc), (tx, ty), (sx - nx * 1.9 * sc, sy - ny * 1.9 * sc)])
    p.shade(m, ramp, base=2, lit=1, dark=1)
    p.line(sx, sy, tx - ux, ty - uy, ramp[4], only=set(ramp))
    # 塊の間の溝に、琥珀の血管（いつも少しだけ光っている）
    if not far or state != 'ok':
        p.line(kx - 2, ky + 2, kx + 1, ky + 2, AMB[0], only=set(ramp)); p.put(kx - 1, ky + 2, AMB[1])   # 膝の継ぎ目が燻る
    if state != 'ok': p.put(kx, ky + 2, AMB[2])
    if state in ('hurt', 'crit'):
        # 割れ目：腿を斜めに横切る光る線
        cx, cy = lerp(hx, kx, .45), lerp(hy, ky, .45)
        p.line(cx - 2, cy - 3, cx + 1, cy, AMB[2]); p.line(cx + 1, cy, cx, cy + 3, AMB[2])
        p.put(cx + 1, cy, AMB[3])
    if state == 'crit':
        p.line(kx - 3, ky - 1, kx + 2, ky + 2, AMB[2]); p.put(kx, ky, AMB[3]); p.put(kx - 1, ky, AMB[4])
        cx, cy = lerp(kx, tx, .4), lerp(ky, ty, .4)
        p.line(cx - 1, cy - 2, cx + 1, cy + 1, AMB[2])
    p.outline()
    return p


# 脚の配置（右向き。手前＝S、奥＝N。前＝+x）。値は基準点（足もとの中心）からのドット
LEGS2 = {
    # id: (hip, knee, tip, far)
    'Nb': ((-7, -29), (-21, -44), (-29, -5), True),    # 奥・後ろ
    'Nm': ((0, -30), (-6, -43), (-12, -7), True),      # 奥・中（部位でない）
    'Nf': ((8, -29), (23, -45), (29, -5), True),       # 奥・前
    'Sb': ((-10, -22), (-28, -35), (-36, 0), False),   # 手前・後ろ
    'Sm': ((2, -20), (11, -29), (15, 1), False),       # 手前・中（部位でない）
    'Sf': ((12, -22), (30, -37), (37, 0), False),      # 手前・前
}


def body2(pose='idle', f=0):
    """第二形態の上半身（外套・墨の体・肋の骨板・フードの顔・矢筒・腕・大弓）。
    pose: idle（f=0..3 で上下に1ドット息づく）/ draw（f=0 引き始め, 1 引き絞り）/ down（崩れ落ち）"""
    p = Piece(W2, H2, OX2, OY2)
    bob = (0, -1, -1, 0)[f % 4] if pose == 'idle' else 0
    dy = bob + (6 if pose == 'down' else 0)
    sway = (0, 1, 2, 1)[f % 4] if pose == 'idle' else (1 if pose == 'draw' else 0)
    Y = lambda y: y + dy
    # --- 空の矢筒（背中から後ろ上へ） ---
    m = p.mask_poly([(-8, Y(-44)), (-14, Y(-54)), (-10, Y(-56)), (-4, Y(-46))])
    p.shade(m, OCH, base=1, lit=1)
    p.line(-12, Y(-51), -8, Y(-52), OCH[3]); p.line(-10, Y(-48), -6, Y(-49), OCH[0])
    m = p.mask_ell(-12, Y(-55), 2.6, 1.6); p.a[m] = OCH[2]; p.put(-12, Y(-55), K0); p.put(-11, Y(-55), K0)
    # --- 墨の体（低く重い塊）と、腹の下に垂れる破れた布 ---
    rag = [(-13, Y(-27)), (-12, Y(-17)), (-10, Y(-22)), (-8, Y(-14)), (-5, Y(-20)), (-2, Y(-13)), (1, Y(-19)),
           (4, Y(-12)), (7, Y(-18)), (10, Y(-14)), (12, Y(-21)), (15, Y(-24))]
    m = p.mask_poly([(-14, Y(-30))] + rag + [(15, Y(-30))]); p.shade(m, INK, base=1, lit=0, dark=1, rim=False)
    for x0 in (-9, -3, 3, 9): p.line(x0, Y(-27), x0 - 1, Y(-18), INK[0], only=set(INK))
    m = p.mask_ell(1, Y(-31), 15.5, 10); p.shade(m, INK, base=1, lit=1, dark=0)
    # 胴の帯（黄土）
    p.line(-13, Y(-29), 15, Y(-27), OCH[2], only=set(INK)); p.line(-13, Y(-28), 15, Y(-26), OCH[1], only=set(INK))
    p.put(9, Y(-26), IVO[3]); p.put(9, Y(-25), IVO[1])                                  # 協会の札
    # --- 外套（肩から背へ、後ろへ垂れて裾はぎざぎざ） ---
    hem = [(-25 - sway, Y(-25)), (-22, Y(-29)), (-20 - sway, Y(-22)), (-17, Y(-28)), (-14, Y(-23)), (-11, Y(-30)), (-8, Y(-27))]
    cape = [(10, Y(-46)), (2, Y(-49)), (-8, Y(-47)), (-17, Y(-42)), (-24, Y(-34)), (-28 - sway, Y(-28))] + hem + [(-3, Y(-36)), (4, Y(-38)), (11, Y(-40))]
    m = p.mask_poly(cape); p.shade(m, CAPE, base=1, lit=2, dark=1)
    for x0, y0, x1, y1 in ((-9, -45, -14, -30), (-16, -40, -20, -29), (-3, -46, -6, -36), (-21, -36, -24, -28), (3, -46, 2, -39)):
        p.line(x0, Y(y0), x1, Y(y1), CAPE[0], only=set(CAPE))
        p.line(x0 + 1, Y(y0), x1 + 1, Y(y1), CAPE[1], only=set(CAPE[2:]))
    for x0, y0, x1, y1 in ((-11, -44, -16, -31), (-18, -39, -22, -30), (-1, -46, -3, -38)):
        p.line(x0, Y(y0), x1, Y(y1), CAPE[3], only=set(CAPE[1:3]))
    for (x, y) in ((-13, -38), (-7, -42), (-19, -32), (0, -44)):
        p.put(x, Y(y), CAPE[4])
    p.put(-19, Y(-34), K0); p.put(-19, Y(-33), K0); p.put(-20, Y(-33), K0)                # 破れ穴
    # --- 肋の骨板（腹の前に、細い弧が3本。腕より一段暗い象牙） ---
    for i, y in enumerate((-33, -30, -27)):
        x0 = 5 + i
        p.line(x0, Y(y), x0 + 5, Y(y - 1), IVO[2], only=set(INK) | set(CAPE))
        p.line(x0 + 5, Y(y - 1), x0 + 7, Y(y + 1), IVO[1], only=set(INK) | set(CAPE) | {0})
        p.line(x0 + 1, Y(y + 1), x0 + 5, Y(y), INK[0], only=set(INK))
    # --- フードと顔 ---
    hx, hy = 8, Y(-50)
    m = p.mask_ell(hx, hy, 6.5, 6) | p.mask_poly([(hx - 6, hy - 1), (hx - 4, hy - 10), (hx + 2, hy - 5)])
    p.shade(m, CAPE, base=1, lit=1, dark=1)
    m = p.mask_ell(hx + 3, hy + 1, 3.4, 3.8) & m; p.a[m] = INK[0]                     # フードの中の闇
    m = p.mask_poly([(hx + 2, hy - 1), (hx + 5.5, hy - 1), (hx + 5.5, hy + 2.5), (hx + 4, hy + 4.5), (hx + 2, hy + 3.5)])
    p.a[m] = IVO[2]; p.line(hx + 2, hy - 1, hx + 5, hy - 1, IVO[3]); p.put(hx + 2, hy + 3, IVO[1])
    p.line(hx + 2, hy - 2, hx + 1, hy + 5, IVO[1])                                       # 白い髪の筋
    p.put(hx + 4, hy, AMB[3]); p.put(hx + 5, hy, AMB[2])                                  # 琥珀の瞳
    # --- 腕と大弓 ---
    pull = pose == 'draw'
    full = pull and f == 1
    gx, gy = 31, Y(-33)                                    # 弓の握り
    hdx, hdy = (hx + 5 - (3 if full else 0)), hy + 4         # 引き手（頬の横）
    if pose == 'down':
        # 崩れ落ち：弓は前へ倒れて先を地面に突く。腕は垂れる
        bow_top, bow_bot, bulge = (22, Y(-40)), (40, -1), 5
        hdx, hdy = 14, Y(-30)
        gx, gy = 30, Y(-21)
    else:
        bow_top, bow_bot, bulge = (26, Y(-64)), (26, -1), 8
    # 引き手の腕（肘を後ろへ張る）
    sh = (3, Y(-41))
    el = (-7 + (-3 if full else 0), Y(-47))
    arm(p, sh, el, 2.2, IVO); arm(p, el, (hdx, hdy), 2.0, IVO)
    p.line(el[0], el[1], el[0] + 1, el[1] + 2, OCH[2]); p.put(hdx, hdy, IVO[4])
    bow(p, bow_top, bow_bot, bulge, (hdx, hdy), glow=(2 if full else 1 if pull else 0))
    # 弓手（前の腕）：肩から握りへ。黄土の巻き布
    arm(p, (9, Y(-41)), (gx - 1, gy), 2.6, IVO)
    for t in (.35, .6, .85):
        x, y = 9 + (gx - 1 - 9) * t, Y(-41) + (gy - Y(-41)) * t
        p.line(x, y - 2, x + 1, y + 2, OCH[2], only=set(IVO))
    m = p.mask_ell(gx, gy, 2.3, 2.3); p.shade(m, IVO, base=2, lit=1)                       # 拳
    if pull:
        # 弦に番えた礫（光る）
        rx, ry = hdx + 3, hdy
        m = p.mask_ell(rx, ry, 2.2, 1.8); p.shade(m, ROCK, base=3, lit=1)
        p.put(rx + 1, ry, AMB[2] if not full else AMB[3])
    p.outline()
    return p


def arm(p, a, b, w, ramp):
    (x0, y0), (x1, y1) = a, b
    l = math.hypot(x1 - x0, y1 - y0) or 1; nx, ny = -(y1 - y0) / l * w * .5, (x1 - x0) / l * w * .5
    m = p.mask_poly([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)])
    p.shade(m, ramp, base=2, lit=1, dark=1)


def bow(p, top, bot, bulge, hand, glow=0, th=1.0):
    """象牙の大弓。真ん中が握り（黄土）、両端は外へ反る刃。弦は引き手へ"""
    (tx, ty), (bx, by) = top, bot
    n = 40; pts = []
    for i in range(n + 1):
        s = i / n
        x = tx + (bx - tx) * s + math.sin(math.pi * s) * bulge + bulge * .45 * (max(0, 1 - s / .14) ** 2 + max(0, 1 - (1 - s) / .14) ** 2)
        y = ty + (by - ty) * s
        pts.append((x, y, s))
    # 弦（先に描いて、弓の本体が上に乗る）
    sc = AMB[3] if glow >= 2 else AMB[2] if glow == 1 else IVO[2]
    p.line(tx + bulge * .45, ty + 1, hand[0], hand[1], sc); p.line(hand[0], hand[1], bx + bulge * .45, by - 1, sc)
    for i in range(n):
        x0, y0, s = pts[i]; x1, y1, _ = pts[i + 1]
        w = (1.2 + 1.6 * math.sin(math.pi * s)) * th
        m = p.mask_poly([(x0 - w * .5, y0), (x0 + w * .5, y0), (x1 + w * .5, y1), (x1 - w * .5, y1)])
        if abs(s - .5) < .07: ramp, base = OCH, 2
        elif abs(s - .5) < .2: ramp, base = R('o0', 'o1', 'i1', 'i2', 'i3'), 2
        else: ramp, base = IVO, 2
        p.a[m] = ramp[base]
        # 外側（右）の縁は暗く、内側（左）の縁は明るい
        rows = np.nonzero(m.any(1))[0]
        for Y_ in rows:
            xs = np.nonzero(m[Y_])[0]
            p.a[Y_, xs.min()] = ramp[min(len(ramp) - 1, base + 1)]
            p.a[Y_, xs.max()] = ramp[base - 1]
    # 欠けた刃の先（暗い切れ込み）
    for (x, y, s) in (pts[3], pts[-4]):
        p.put(x + .5, y, IVO[1])
    if glow:
        for (x, y, s) in pts[::5]:
            if glow >= 2: p.put(x - 1, y, AMB[2])


# ===================== 第一形態：大弓の狩人 =====================
W1, H1, OX1, OY1 = 48, 54, 22, 50

def thin_arm(p, a, b, hi=IVO[3], lo=IVO[1]):
    """細い腕：明るい上の線と暗い下の線の2ドット（細い物を面で塗ると点々に崩れる）"""
    (x0, y0), (x1, y1) = a, b
    if abs(x1 - x0) >= abs(y1 - y0):
        p.line(x0, y0 + 1, x1, y1 + 1, lo); p.line(x0, y0, x1, y1, hi)
    else:
        p.line(x0 + 1, y0, x1 + 1, y1, lo); p.line(x0, y0, x1, y1, hi)


def body1(pose='idle', f=0):
    """人の姿。右向き、足を前後に開いて大弓を構える。pose: idle(f=0..3) / draw(0,1)"""
    p = Piece(W1, H1, OX1, OY1)
    bob = (0, 0, -1, 0)[f % 4] if pose == 'idle' else 0
    sway = (0, 1, 1, 0)[f % 4] if pose == 'idle' else 1
    Y = lambda y: y + bob
    pull = pose == 'draw'; full = pull and f == 1
    # 空の矢筒（背中、後ろ上へ）
    m = p.mask_poly([(-3, Y(-22)), (-8, Y(-31)), (-5, Y(-33)), (0, Y(-24))]); p.shade(m, OCH, base=1, lit=1)
    m = p.mask_ell(-6.5, Y(-32), 1.8, 1.2); p.a[m] = OCH[2]; p.put(-7, Y(-32), K0)
    # 外套（肩から後ろへ流れ、裾はぎざぎざ）
    hem = [(-15 - sway, Y(-7)), (-13, Y(-10)), (-11 - sway, Y(-5)), (-9, Y(-9)), (-7, Y(-4)), (-5, Y(-9))]
    m = p.mask_poly([(3, Y(-27)), (-3, Y(-28)), (-9, Y(-23)), (-13, Y(-15)), (-16 - sway, Y(-9))] + hem + [(-2, Y(-15)), (1, Y(-20))])
    p.shade(m, CAPE, base=1, lit=1, dark=1)
    for x0, y0, x1, y1 in ((-6, -24, -9, -9), (-10, -19, -12, -10), (-3, -25, -5, -14)):
        p.line(x0, Y(y0), x1, Y(y1), CAPE[0], only=set(CAPE))
    p.line(-8, Y(-22), -11, Y(-11), CAPE[3], only=set(CAPE[1:3]))
    p.put(-12, Y(-14), CAPE[4]); p.put(-5, Y(-20), CAPE[4])
    # 脚（後ろ脚 → 前脚）：黄土の巻き布、墨の靴
    def leg(hx, hy, kx, ky, fx):
        arm(p, (hx, hy), (kx, ky), 3.0, OCH); arm(p, (kx, ky), (fx, -2), 2.6, OCH)
        for u in (.3, .7):
            x, y = kx + (fx - kx) * u, ky + (-2 - ky) * u
            p.line(x - 1, y, x + 1, y - 1, OCH[0], only=set(OCH))
        m = p.mask_poly([(fx - 2, -3), (fx + 2, -3), (fx + 3, 0), (fx - 2, 0)]); p.shade(m, INK, base=1, lit=1, rim=True)
    leg(-1, Y(-12), -5, Y(-7), -7)
    leg(2, Y(-12), 6, Y(-7), 7)
    # 胴（墨）と、裾の破れた布
    m = p.mask_poly([(-3, Y(-25)), (4, Y(-25)), (5, Y(-14)), (5, Y(-9)), (3, Y(-12)), (1, Y(-8)), (-1, Y(-11)), (-3, Y(-8)), (-4, Y(-14))])
    p.shade(m, INK, base=1, lit=1, dark=1)
    p.line(-4, Y(-15), 5, Y(-15), OCH[2], only=set(INK)); p.line(-4, Y(-14), 5, Y(-14), OCH[1], only=set(INK))
    p.put(3, Y(-13), IVO[3]); p.put(3, Y(-12), IVO[1])                                     # 協会の札
    # 肩掛け（青緑）
    m = p.mask_poly([(-4, Y(-27)), (4, Y(-28)), (6, Y(-24)), (3, Y(-21)), (0, Y(-22)), (-3, Y(-20))]); p.shade(m, CAPE, base=2, lit=1)
    # フードと顔
    hx, hy = 2, Y(-31)
    m = p.mask_ell(hx, hy, 4.6, 4.3) | p.mask_poly([(hx - 4, hy - 1), (hx - 3, hy - 8), (hx + 1, hy - 4)])
    p.shade(m, CAPE, base=1, lit=1, dark=1)
    m = p.mask_ell(hx + 2.5, hy + .8, 2.6, 3.0) & m; p.a[m] = INK[0]
    for (x, y, c) in ((2, 0, IVO[1]), (3, -1, IVO[3]), (4, -1, IVO[3]), (3, 0, IVO[2]), (4, 0, AMB[3]), (3, 1, IVO[2]), (4, 1, IVO[2]), (3, 2, IVO[1])):
        p.put(hx + x, hy + y, c)
    p.put(hx + 2, hy - 1, IVO[2]); p.put(hx + 1, hy, IVO[1])                                 # 白い髪
    # 腕と大弓
    gx, gy = 15, Y(-21)
    hdx, hdy = hx + 5 - (2 if full else 0), hy + 2
    el = (-5 - (2 if full else 0), Y(-28))
    thin_arm(p, (1, Y(-25)), el); thin_arm(p, el, (hdx, hdy)); p.put(hdx, hdy, IVO[4]); p.put(hdx, hdy + 1, IVO[2])
    bow(p, (12, Y(-45)), (12, -1), 5, (hdx, hdy), glow=(2 if full else 1 if pull else 0), th=.8)
    thin_arm(p, (4, Y(-22)), (gx - 1, gy))
    p.put(8, Y(-22), OCH[2]); p.put(8, Y(-21), OCH[1]); p.put(11, Y(-21), OCH[2]); p.put(11, Y(-20), OCH[1])
    m = p.mask_ell(gx, gy + .5, 1.5, 1.5); p.shade(m, IVO, base=2, lit=1)
    if pull:
        m = p.mask_ell(hdx + 2, hdy, 1.5, 1.2); p.shade(m, ROCK, base=3, lit=1); p.put(hdx + 2, hdy, AMB[2] if not full else AMB[3])
    p.outline()
    return p


def compose(pieces, W, H, ox, oy):
    out = np.zeros((H, W), np.int16)
    for pc in pieces:
        m = pc.a != 0
        out[m] = pc.a[m]
    return out


def to_img(a, bg=(28, 36, 51), scale=6):
    rgb = np.zeros(a.shape + (3,), np.uint8); rgb[:] = bg
    for i, h in enumerate(PAL):
        if h is None: continue
        rgb[a == i] = [int(h[k:k + 2], 16) for k in (1, 3, 5)]
    return Image.fromarray(rgb).resize((a.shape[1] * scale, a.shape[0] * scale), Image.NEAREST)


def form2_states():
    legs = {}
    for k, (h, kn, t, far) in LEGS2.items():
        for st in ('ok', 'hurt', 'crit', 'broken'):
            if k in ('Nm', 'Sm') and st != 'ok': continue
            legs[k + ':' + st] = rock_leg(h, kn, t, far, st)
    bodies = {('idle', f): body2('idle', f) for f in range(4)}
    bodies[('draw', 0)] = body2('draw', 0); bodies[('draw', 1)] = body2('draw', 1)
    bodies[('down', 0)] = body2('down', 0)
    return legs, bodies


def preview(outdir):
    os.makedirs(outdir, exist_ok=True)
    legs, bodies = form2_states()
    def frame(body, states, down=False):
        order = []
        for k in ('Nb', 'Nm', 'Nf'):
            pc = legs[k + ':' + states.get(k, 'ok')]
            order.append(pc)
        order.append(body)
        for k in ('Sb', 'Sm', 'Sf'):
            pc = legs[k + ':' + states.get(k, 'ok')]
            order.append(pc)
        return compose(order, W2, H2, OX2, OY2)
    shots = [
        frame(bodies[('idle', 0)], {}),
        frame(bodies[('idle', 2)], {}),
        frame(bodies[('draw', 1)], {}),
        frame(bodies[('idle', 0)], {'Sf': 'hurt', 'Nf': 'crit', 'Sb': 'broken'}),
        frame(bodies[('down', 0)], {'Sf': 'broken', 'Nf': 'broken', 'Sb': 'broken', 'Nb': 'broken'}, down=True),
    ]
    ims = [to_img(s) for s in shots]
    W = sum(i.size[0] for i in ims); H = ims[0].size[1]
    sheet = Image.new('RGB', (W, H)); x = 0
    for i in ims: sheet.paste(i, (x, 0)); x += i.size[0]
    sheet.save(os.path.join(outdir, 'form2.png'))
    ims = [to_img(body1('idle', f).a) for f in range(4)] + [to_img(body1('draw', 0).a), to_img(body1('draw', 1).a)]
    W = sum(i.size[0] for i in ims); H = ims[0].size[1]
    sheet = Image.new('RGB', (W, H)); x = 0
    for i in ims: sheet.paste(i, (x, 0)); x += i.size[0]
    sheet.save(os.path.join(outdir, 'form1.png'))


def shifted(pc, dx, dy):
    if not dx and not dy: return pc
    q = Piece(pc.W, pc.H, pc.ox, pc.oy); q.a = np.roll(np.roll(pc.a, dy, 0), dx, 1); return q


def export():
    """ゲーム用：パレット・光る色・部品（切り抜き＋RLE）・錨点（待機の絵の外枠の中心＝当たりの円の中心に合わせる点）"""
    legs, bodies = form2_states()
    f1 = {'idle%d' % f: body1('idle', f) for f in range(4)}
    f1['draw0'] = body1('draw', 0); f1['draw1'] = body1('draw', 1)
    def anchor(a, ox, oy):
        ys, xs = np.nonzero(a); return [round((xs.min() + xs.max() + 1) / 2 - ox, 1), round((ys.min() + ys.max() + 1) / 2 - oy, 1)]
    full2 = compose([legs[k + ':ok'] for k in ('Nb', 'Nm', 'Nf')] + [bodies[('idle', 0)]] + [legs[k + ':ok'] for k in ('Sb', 'Sm', 'Sf')], W2, H2, OX2, OY2)
    return dict(
        pal=[h for h in PAL[1:]], emis=[i for i in EMIS], amb=AMB,
        f1=dict(parts={k: v.crop() for k, v in f1.items()}, anchor=anchor(f1['idle0'].a, OX1, OY1)),
        f2=dict(body={'%s%d' % k: v.crop() for k, v in bodies.items()}, legs={k: v.crop() for k, v in legs.items()},
                anchor=anchor(full2, OX2, OY2)),
        ch=CH)


def apply():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'proto', 'cave-look.js')
    s = open(p, encoding='utf-8').read()
    a, b = s.index('/*VERA_SPR_BEGIN*/'), s.index('/*VERA_SPR_END*/')
    s = s[:a] + '/*VERA_SPR_BEGIN*/const VERA_SPR=' + json.dumps(export(), separators=(',', ':'), ensure_ascii=False) + ';' + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
    print('applied', len(json.dumps(export(), separators=(',', ':'))), 'bytes')


if __name__ == '__main__':
    out = '/tmp/vera-px'
    if '--preview' in sys.argv: out = sys.argv[sys.argv.index('--preview') + 1]
    preview(out)
    print('ok', out)
    if '--apply' in sys.argv: apply()
