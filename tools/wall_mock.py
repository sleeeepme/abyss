"""北の岩壁の見え方の試作（tools/wall3d.py の面を、proto/_wallmock.mjs で撮った画面に重ねる）。
  python3 tools/wall3d.py DIR && node proto/_wallmock.mjs DIR && python3 tools/wall_mock.py DIR
：ゲームの画面に、床の北の縁ごとに wall3d の面を貼る（ランタンの光もここで当てる）。"""
import json, base64, io, math, sys
import numpy as np
from PIL import Image
sys.path.insert(0, '/root/abyss/tools')
OUT = next((a for a in sys.argv[1:] if not a.endswith('.json')), '/tmp/wall3d-out')
sys.argv = [sys.argv[0], OUT]
from cave3d import NRM, ALPHA, B36

D = json.load(open(OUT + '/mock_in.json'))
E = json.load(open(OUT + '/wall_a.json'))
LIME = [(14, 22, 38), (28, 42, 66), (50, 70, 100), (86, 110, 144), (142, 166, 196)]
DARK = (8, 10, 16)
W_, H_ = E['w'], E['h']; AY = E['ay']
m = E['m']; n = E['n']; a = E['a']; hts = E['hts']


def lit(px, py, h, nv, aa, hero):
    """px,py：地面のドット座標（世界）。h：高さ（ドット）。ランタンは主人公の頭の上（高さ 14 ドット）"""
    lx, ly = hero[0] - px, hero[1] - py
    L = np.array([lx, 14 - h, ly], float); d = np.linalg.norm(L) + 1e-6; L /= d
    dist = math.hypot(lx, ly)
    f = max(0.0, 1 - dist / 150.0) ** 0.8
    I = (0.16 + 0.95 * max(0.0, float(nv @ L))) * aa * (0.2 + 0.8 * f)
    return I


def compose(o):
    im = Image.open(io.BytesIO(base64.b64decode(o['img'].split(',')[1]))).convert('RGB')
    px = np.array(im)
    TS, sc = o['TS'], o['sc']; ps = TS / 16.0; k = ps * sc            # キャンバスの画素 / ドット
    camX, camY = o['camX'], o['camY']
    hero = (o['P']['x'] * 16, o['P']['y'] * 16)
    code = np.frombuffer(base64.b64decode(o['code']), np.uint8).reshape(o['PH'], o['PW'])
    vx0, vy0 = int(camX / ps) - 2, int(camY / ps) - 2
    vx1, vy1 = vx0 + int(px.shape[1] / k) + 4, vy0 + int(px.shape[0] / k) + 4 + H_
    def put(wx, sy_dot, rgb):
        X0 = int(round((wx * ps - camX) * sc)); X1 = int(round(((wx + 1) * ps - camX) * sc))
        Y0 = int(round((sy_dot * ps - camY) * sc)); Y1 = int(round(((sy_dot + 1) * ps - camY) * sc))
        if X1 <= 0 or Y1 <= 0 or X0 >= px.shape[1] or Y0 >= px.shape[0]: return
        px[max(0, Y0):max(0, Y1), max(0, X0):max(0, X1)] = rgb
    for wx in range(max(1, vx0), min(o['PW'] - 1, vx1)):
        col = wx % W_
        for ey in range(max(16, vy0), min(o['PH'] - 1, vy1)):
            if not (code[ey - 1, wx] and not code[ey, wx]): continue
            if not code[ey - 14:ey, wx].all(): continue          # 上に厚い岩がある所だけ（床の中の小さな岩は除く）
            gy = ey + 1                                             # 面の足もとの行
            for v in range(H_):
                c = m[v][col]
                if c == '.': continue
                h = int(B36.index(hts[v][col]))
                sy_dot = gy + (v - AY)
                nv = NRM[ALPHA.index(n[v][col])]; aa = 0.4 + int(a[v][col]) / 9 * 0.6
                I = lit(wx + 0.5, gy - 0.5, h, nv, aa, hero)
                if c == 'k': I *= 0.6
                put(wx, sy_dot, LIME[int(min(0.999, max(0, I)) * 5)])
    return Image.fromarray(px), im


outs = []
for o in D:
    after, before = compose(o)
    w, h = after.size
    box = (0, int(h * 0.12), w, int(h * 0.72))
    outs.append((before.crop(box), after.crop(box)))
W = outs[0][0].size[0]; Hh = outs[0][0].size[1]
sheet = Image.new('RGB', (W * 2 + 10, (Hh + 10) * len(outs)), (40, 0, 40))
for r, (b, a_) in enumerate(outs):
    sheet.paste(b, (0, r * (Hh + 10))); sheet.paste(a_, (W + 10, r * (Hh + 10)))
sheet.save(OUT + '/mock.png'); print(sheet.size)
