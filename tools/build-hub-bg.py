#!/usr/bin/env python3
"""街の背景ループを、起動時に全展開しない形に組み直して proto/index.html へ埋め込む。

元素材: proto/assets/backgrounds/hub-final-v2/loop-spritesheet.png（承認済み v14。544x306 x 72コマ、12列x6行、RGB）
  ※ 制作元 output/hub-loop-wide-v14/build.cjs はリポジトリに無い。承認済みシートが正本なので、これをそのまま素材にする。

なぜ組み直すのか（2026-11-10 perf）:
  旧: 6528x1836 のPNG(base64で6.19MB)を起動時に Image へ代入 -> RGBA で約48MB 展開、幅がモバイルの最大テクスチャ4096超。
  新: 「72コマで変わらない画素」を静止画1枚（base）にまとめ、各コマは base と違う画素だけを
      透明PNG相当(ロスレスWebP)で持つ。街に入ってから base と直近の数コマだけを復号する。
      base + delta を source-over で重ねた結果は元のコマと1画素も違わない（このスクリプトが全コマで検証する）。

使い方（リポジトリ直下で）:
  python3 tools/build-hub-bg.py            # proto/index.html の const HUB_BG_PACK を書き換える
  python3 tools/build-hub-bg.py --check    # 書き換えず、検証と寸法の表示だけ
Pillow と numpy が要る（scipy は無くても動く）。
"""
import argparse, base64, io, json, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, 'proto/assets/backgrounds/hub-final-v2')
HTML = os.path.join(ROOT, 'proto/index.html')

def mode_frame(fr):
    """画素ごとの最頻値（同数なら小さい値）。fr: (n,h,w,3) uint8"""
    n, h, w, _ = fr.shape
    key = (fr[..., 0].astype(np.uint32) << 16) | (fr[..., 1].astype(np.uint32) << 8) | fr[..., 2]
    s = np.sort(key, axis=0)
    # 並べ替えた列の中で最も長い連続を探す
    best = s[0].copy(); bestn = np.ones((h, w), np.int32); run = np.ones((h, w), np.int32)
    for i in range(1, n):
        same = s[i] == s[i - 1]
        run = np.where(same, run + 1, 1)
        up = run > bestn
        best = np.where(up, s[i], best); bestn = np.where(up, run, bestn)
    out = np.zeros((h, w, 3), np.uint8)
    out[..., 0] = best >> 16; out[..., 1] = (best >> 8) & 255; out[..., 2] = best & 255
    return out

def webp(img, **kw):
    b = io.BytesIO(); img.save(b, 'WEBP', lossless=True, quality=100, method=4, exact=True, **kw); return b.getvalue()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--check', action='store_true'); a = ap.parse_args()
    spec = json.load(open(os.path.join(BG, 'spritesheet.json')))
    print('spritesheet.json', spec)
    cols = spec.get('columns') or spec.get('cols') or 12
    fw = spec.get('frameWidth') or spec.get('fw') or 544
    fh = spec.get('frameHeight') or spec.get('fh') or 306
    n = spec.get('frameCount') or spec.get('frames') or 72
    fps = spec.get('fps') or 12
    sheet = np.array(Image.open(os.path.join(BG, 'loop-spritesheet.png')).convert('RGB'))
    fr = np.stack([sheet[(i // cols) * fh:(i // cols) * fh + fh, (i % cols) * fw:(i % cols) * fw + fw] for i in range(n)])
    base = mode_frame(fr)
    base_webp = webp(Image.fromarray(base))
    frames = []; total = len(base_webp)
    for i in range(n):
        d = (fr[i] != base).any(axis=2)
        rgba = np.zeros((fh, fw, 4), np.uint8); rgba[..., :3] = np.where(d[..., None], fr[i], 0); rgba[..., 3] = d * 255
        w = webp(Image.fromarray(rgba)); frames.append(w); total += len(w)
        # 検証: 復号して base に重ねたものが元のコマと完全一致
        dec = np.array(Image.open(io.BytesIO(w)).convert('RGBA')); bd = np.array(Image.open(io.BytesIO(base_webp)).convert('RGB'))
        rec = np.where((dec[..., 3:4] == 255), dec[..., :3], bd)
        assert (dec[..., 3] == (d * 255)).all() and (rec == fr[i]).all(), 'frame %d mismatch' % i
    print('frames', n, 'base %d bytes' % len(base_webp), 'delta avg %d' % (sum(map(len, frames)) / n), 'total %d bytes (b64 %d)' % (total, total * 4 // 3), 'verified lossless')
    pack = {'w': fw, 'h': fh, 'fps': fps, 'n': n,
            'base': base64.b64encode(base_webp).decode(),
            'f': [base64.b64encode(w).decode() for w in frames]}
    line = 'const HUB_BG_PACK = ' + json.dumps(pack, separators=(',', ':')) + ';'
    if a.check: return
    src = open(HTML, encoding='utf-8').read()
    m = re.search(r'^const HUB_BG_(?:SHEET|PACK) = .*$', src, re.M)
    if not m: sys.exit('const HUB_BG_SHEET / HUB_BG_PACK が proto/index.html に見つからない')
    open(HTML, 'w', encoding='utf-8').write(src[:m.start()] + line + src[m.end():])
    print('proto/index.html を更新: 1行 %d バイト' % len(line))

main()
