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
H = 9.2                    # 面の高さ（単位）→ 画面で約32ドット＝2マス


class Slab:
    """壁の芯：面の奥にある大きな岩の板（塊の隙間から見える奥の闇）"""
    def __init__(self, x0, x1, h, seed=1):
        self.x0, self.x1, self.h, self.seed, self.moss, self.tone = x0, x1, h, seed, 0.0, 0.62
    def sdf(self, p):
        q = p.copy()
        d = np.maximum.reduce([q[..., 2] - (-1.2 + 0.5 * (fbm(q * 0.6, self.seed) - 0.5)), -q[..., 2] - 5.0, q[..., 1] - self.h, self.x0 - q[..., 0], q[..., 0] - self.x1])
        return d
    def aabb(self): return np.array([self.x0, 0, -5.0]), np.array([self.x1, self.h + 0.3, 0.0])
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


class FaceRock(Boulder):
    """面の岩：下へ行くほど暗い（洞窟の底は光が回らない）。庇の下の影は形が作る"""
    def albedo(self, p, n):
        a = super().albedo(p, n)
        y = np.clip(p[..., 1] / H, 0, 1)
        return a * (0.55 + 0.45 * y ** 0.8)


def layout(seed=7):
    """1周期ぶんの並び。x は 0..P。
    - 柱状の岩：縦に長い角ばった塊を横に並べる（節理で割れた岩肌）。隣どうしで張り出しと傾きを変え、隙間を暗い割れ目にする。
    - 中ほどで一度、横の割れ（層理）を入れる：上下2段に分ける列がある。
    - 庇：天辺に横長の大きな塊を前へ張り出す。下に影の帯ができる。
    - 根：庇から垂れる。足もと：崩れた岩屑。"""
    rng = np.random.default_rng(seed)
    blocks = []
    x = rng.uniform(0, 1.0)
    while x < P:
        rx = rng.uniform(2.2, 3.8); out = rng.uniform(0.1, 1.3)
        tone = rng.uniform(0.82, 1.02)
        if rng.uniform() < 0.35:                                   # 上下2段に割れた列
            ys = rng.uniform(3.2, 4.6)
            blocks.append((x + rx * .5, ys * .5, -2.6 + out, rx, ys * .52, 2.6, int(rng.integers(1e6)), tone))
            h2 = (H - 1.2) - ys
            blocks.append((x + rx * .5 + rng.uniform(-.4, .4), ys + h2 * .5, -2.6 + out + rng.uniform(-.4, .6), rx * rng.uniform(.85, 1.1), h2 * .52, 2.6, int(rng.integers(1e6)), tone * rng.uniform(.92, 1.05)))
        else:
            hh = H - 1.2
            blocks.append((x + rx * .5, hh * .5, -2.6 + out, rx, hh * .52, 2.6, int(rng.integers(1e6)), tone))
        x += rx * rng.uniform(0.95, 1.15)
    cornice = []
    x = rng.uniform(0, 2.0)
    while x < P:
        rx = rng.uniform(2.6, 4.4)
        cornice.append((x + rx * .5, H - 0.9 + rng.uniform(-.2, .3), -1.4 + rng.uniform(0.6, 1.6), rx, rng.uniform(0.9, 1.3), 2.8, int(rng.integers(1e6)), rng.uniform(0.95, 1.1)))
        x += rx * rng.uniform(0.9, 1.1)
    strands = []
    for k in range(int(P / 2.2)):
        sx = rng.uniform(0, P); L = rng.uniform(2.0, 6.5)
        strands.append((sx, rng.uniform(1.4, 2.6), H - 1.3, L, rng.uniform(0.32, 0.46), int(rng.integers(1e6))))
    rubble = []
    x = rng.uniform(0, 1.5)
    while x < P:
        r = rng.uniform(0.5, 1.0)
        rubble.append((x, r * 0.5, rng.uniform(0.3, 1.0) * 2, r, r * 0.6, r * 2, int(rng.integers(1e6)), rng.uniform(0.75, 0.95)))
        x += rng.uniform(2.6, 5.5)
    return blocks + cornice, strands, rubble


def scene(margin=6.0, seed=7):
    blocks, strands, rubble = layout(seed)
    parts = [Slab(-margin, P + margin, H - 0.3)]
    for shift in (-P, 0, P):
        for (x, y, z, rx, ry, rz, s, tone) in blocks:
            if -margin <= x + shift <= P + margin:
                b = FaceRock((x + shift, y, z), rx, ry, rz, s, nplanes=10, moss=0.15, tone=tone); parts.append(b)
        for (x, z, y0, L, r, s) in strands:
            if -margin <= x + shift <= P + margin: parts.append(Strand(x + shift, z, y0, L, r, s))
        for (x, y, z, rx, ry, rz, s, tone) in rubble:
            if -margin <= x + shift <= P + margin:
                parts.append(FaceRock((x + shift, y, z), rx, ry, rz, s, nplanes=9, moss=0.3, tone=tone))
    return parts


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
    parts = scene()
    r = cave3d.render(parts, gs=0.08)
    e = cave3d.encode(r)
    # 真ん中の1周期（x=0..P）だけ残す
    x0 = e['ax']; x1 = x0 + int(round(P * PX))
    for k in ('m', 'n', 'a', 'hts'):
        e[k] = [row[x0:x1] for row in e[k]]
    e['w'] = x1 - x0; e['ax'] = 0
    # 庇より奥の天辺（壁の上の面）は、ゲームでは今の上から見た岩が描くので、庇の縁から上 LIP ドットだけ残す
    LIP = 4
    B36 = cave3d.B36
    def row_top(y):   # この行に「面」（上向きでない）ドットがあるか
        return any(c != '.' and NRM[ALPHA.index(nn)][1] < 0.6 for c, nn in zip(e['m'][y], e['n'][y]))
    first = next(y for y in range(e['h']) if row_top(y))
    cut = max(0, first - LIP)
    for k in ('m', 'n', 'a', 'hts'): e[k] = e[k][cut:]
    e['h'] -= cut; e['ay'] -= cut
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
