"""ヴェラ第二形態の「描いた絵の形」の当たり表（index.html の VERA2_FOOT）を作り直す。

2026-11-05 ユーザー指摘「ヴェラの第二形態にまだコリジョンが反映されていなさそう」。
cave-look.js の VERA2（第二形態のコマ、待機32＋歩き12）を重ねた形を2ドット幅の列に切り、
列ごとに上端・下端の行（錨点 ay の行が e.y、1ドット＝1/16マス）を持つ。
脚の壊れ方16通り（VERA2.diff の 1..15、0 は無傷）ごとに作る。
  ・体につながっていない塊（壊れて落ちた脚の石）は外す
  ・脚の切れ込みは左右2列の最大・最小で均して埋める
  ・壊れた形は無傷の形より外へは出さない

使い方：python3 tools/vela2/foot.py        （index.html の const VERA2_FOOT = …; の行を置き換える）
"""
import base64, io, json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CAVE = os.path.join(ROOT, 'proto', 'cave-look.js')
HTML = os.path.join(ROOT, 'proto', 'index.html')
STEP = 2

s = open(CAVE, encoding='utf-8').read()
V = json.loads(re.search(r'const VERA2=(\{.*?\});\n', s).group(1))
dec = lambda d: np.array(Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA'))
base = dec(V['base']); W, H = V['w'], V['h']
FRAMES = range(0, V['anims']['walk'][0] + V['anims']['walk'][1])     # 待機＋歩き

def mask(combo):
    a = base[:, :, 3] > 0
    if combo:
        d = dec(V['diff'][str(combo)])
        mag = (d[:, :, 0] == 255) & (d[:, :, 1] == 0) & (d[:, :, 2] == 255) & (d[:, :, 3] == 255)
        a = np.where(d[:, :, 3] > 0, ~mag, a)
    u = np.zeros((H, W), bool)
    for f in FRAMES: u |= a[:, f * W:(f + 1) * W]
    lab, n = ndimage.label(u, structure=np.ones((3, 3)))
    if n > 1:
        sz = ndimage.sum(u, lab, range(1, n + 1)); u = lab == (1 + int(np.argmax(sz)))
    return u

def cols(u):
    top, bot = [], []
    for x0 in range(0, W, STEP):
        ys = np.nonzero(u[:, x0:x0 + STEP].any(1))[0]
        top.append(int(ys.min()) if len(ys) else -1); bot.append(int(ys.max()) + 1 if len(ys) else -1)
    n = len(top); T, B = [], []
    for i in range(n):
        win = [j for j in range(max(0, i - 2), min(n, i + 3)) if top[j] >= 0]
        inside = any(top[j] >= 0 for j in range(max(0, i - 2), i)) and any(top[j] >= 0 for j in range(i + 1, min(n, i + 3)))
        if top[i] < 0 and not inside: T.append(-1); B.append(-1); continue
        T.append(min(top[j] for j in win)); B.append(max(bot[j] for j in win))
    return T, B

C = [cols(mask(c)) for c in range(16)]
T0, B0 = C[0]
out = []
for T, B in C:
    T2, B2 = [], []
    for t, b, t0, b0 in zip(T, B, T0, B0):
        if t < 0 or t0 < 0: T2.append(-1); B2.append(-1)
        else: T2.append(max(t, t0)); B2.append(min(b, b0))
    out.append([T2, B2])
data = json.dumps({'step': STEP, 'ax': V['ax'], 'ay': V['ay'], 'c': out}, separators=(',', ':'))
h = open(HTML, encoding='utf-8').read()
h, n = re.subn(r'const VERA2_FOOT = \{.*?\};\n', lambda m: 'const VERA2_FOOT = ' + data + ';\n', h, count=1)
assert n == 1, 'VERA2_FOOT not found'
open(HTML, 'w', encoding='utf-8').write(h)
print('VERA2_FOOT', len(data), 'bytes')
