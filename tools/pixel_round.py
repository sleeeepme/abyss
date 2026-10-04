#!/usr/bin/env python3
"""UI の角丸と円を、ドット絵の段に置き換える（2026-10-04 ユーザー要望
「UIなどの角丸や円を使用しているものは全てドット絵で整形しておいて」）。

proto/index.html の CSS を書き換える。何度流しても同じ結果になる（二度目は何もしない）。

- 1ドット＝2px（UI のドット。美咲ゴシック 16px の1ドットと同じ）。
- 四角い枠：border-radius をやめ、clip-path の段で角を切る。枠線は 2px（1ドット）にそろえる。
  段の内側の角の1ドットは、::before が親の border を inherit して描く（色の切り替えにもそのまま追従する）。
    r1：角を1ドット欠く（小さな札・入力欄）
    r2：2段（ふつうの枠）
    r3：3段（丸い札＝ピル）
- 円：大きさごとに作ったドットの円（SVG のマスク）。中身は ::before、縁は ::after。
  色は --pf（中身）/ --pb（縁）。光る縁（box-shadow）は filter:drop-shadow に置き換え、ドットの形のまま光らせる。
- 子が枠からはみ出す物（広場の正方形ボタンの赤い数字など）は、本体を切らずに ::before/::after で枠を描く。
"""
import os, re, sys

U = 2
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'proto', 'index.html')


def poly(cuts, left=True):
    """cuts[k]＝上から k 段目（U px）で左から切るドット数。4隅とも同じ形の polygon() を返す（left=False なら左の2隅は四角）"""
    pts_tl = []
    # 左上：左の辺の下から上へ、段をたどって上の辺へ
    n = len(cuts)
    pts_tl.append((0, n * U))
    for k in range(n - 1, -1, -1):
        x = cuts[k] * U
        y1 = (k + 1) * U
        y0 = k * U
        if pts_tl[-1][0] != x:
            pts_tl.append((x, y1))
        pts_tl.append((x, y0))
    # 重複を落とす
    tl = []
    for p in pts_tl:
        if not tl or tl[-1] != p: tl.append(p)
    def fmt(v, far):
        return ('calc(100%% - %dpx)' % v if v else '100%') if far else ('%dpx' % v if v else '0')
    out = []
    for (x, y) in (tl if left else [(0, 0)]):     # 左上（左の辺→上の辺）
        out.append('%s %s' % (fmt(x, 0), fmt(y, 0)))
    for (y, x) in tl:                      # 右上（上の辺→右の辺）：x と y を入れ替えて右へ映す
        out.append('%s %s' % (fmt(x, 1), fmt(y, 0)))
    for (x, y) in tl:                      # 右下（右の辺→下の辺）
        out.append('%s %s' % (fmt(x, 1), fmt(y, 1)))
    for (y, x) in (tl if left else [(0, 0)]):     # 左下（下の辺→左の辺）
        out.append('%s %s' % (fmt(x, 0), fmt(y, 1)))
    return 'polygon(' + ','.join(out) + ')'


def stair_mask(rects, sides=('left top', 'right top', 'left bottom', 'right bottom')):
    """::before（親の内側＝2px 内側に置いた枠）の、4隅のどこを見せるか。rects は左上の隅での (w,h)"""
    layers = []
    for (w, h) in rects:
        for pos in sides:
            layers.append('linear-gradient(#000 0 0) %s/%dpx %dpx no-repeat' % (pos, w, h))
    m = ','.join(layers)
    return '-webkit-mask:%s;mask:%s' % (m, m)


def disk_svg(D, ring=False):
    """直径 D px のドットの円（U px 格子）。ring＝縁の1ドットだけ"""
    N = max(2, round(D / U)); R = N / 2
    inside = [[((i + .5 - R) ** 2 + (j + .5 - R) ** 2) <= (R - .15) ** 2 for i in range(N)] for j in range(N)]
    def on(i, j): return 0 <= i < N and 0 <= j < N and inside[j][i]
    d = []
    for j in range(N):
        i = 0
        while i < N:
            keep = on(i, j) and (not ring or not (on(i - 1, j) and on(i + 1, j) and on(i, j - 1) and on(i, j + 1)))
            if not keep: i += 1; continue
            k = i
            while k < N and on(k, j) and (not ring or not (on(k - 1, j) and on(k + 1, j) and on(k, j - 1) and on(k, j + 1))): k += 1
            d.append('M%d %dh%dv1h-%dz' % (i, j, k - i, k - i)); i = k
    svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d' shape-rendering='crispEdges'><path d='%s'/></svg>" % (N, N, ''.join(d))
    return 'url("data:image/svg+xml,%s")' % svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace('"', "'")


R1 = poly([1]); R2 = poly([2, 1]); R3 = poly([3, 1, 1])
# 左に太い色の帯（border-left）を持つ札は、左の角を四角のまま（色の違う枠の継ぎ目が斜めに割れて見えるため）
R2R = poly([2, 1], left=False)
M2 = stair_mask([(U, U)])
M3 = stair_mask([(2 * U, U), (U, 2 * U)])
M2R = stair_mask([(U, U)], ('right top', 'right bottom'))

ROUND_BTNS = {'#ultbtn': 74, '#guardbtn': 66, '#wavebtn': 58, '#artbtn': 62, '#bagbtn': 44, '#statbtn': 44, '#mapbtn': 44,
              '#stick': 130, '#knob': 54, '.hub-ava .glyph': 38}
EXCL = ':not(.hub-ava,.hub-corner,.hub-mini,%s)' % ','.join(k for k in ROUND_BTNS if k.startswith('#'))
SEL_R2L = ['.item', '.boon']                     # 左に色の帯：左の角は四角
SEL_R2 = ['#dbgbtn', '.card', 'button' + EXCL, '#targetinfo', '.fgwho', '#potnote', '#durtag', '#prompt', '#toast', '.hub-id', '#adbox']
SEL_R3 = ['#gravehint', '#intruder', '#statusbar span', '#foottag']
SEL_R1 = ['#nm-input', '#an-input', '#bagcount', '.hub-badge']
SEL_BOX = ['.hub-corner', '.hub-mini']          # 子がはみ出すので本体は切らない


def css_block():
    w = lambda L: ':where(%s)' % ','.join(L)
    pse = lambda L, p: ','.join('%s%s' % (s, p) for s in L)
    out = ['/* ---------- 角丸と円をドット絵に（tools/pixel_round.py が書く。手で直さない）----------',
           '   1ドット＝2px。四角は clip-path の段で角を切り、段の内側の1ドットは ::before が親の border を inherit して描く。',
           '   円は大きさごとのドットの円（SVG マスク）：中身 ::before（--pf）、縁 ::after（--pb）。光は drop-shadow でドットの形のまま。 */',
           ':root{--pxr1:%s;--pxr2:%s;--pxr3:%s;--pxr2r:%s}' % (R1, R2, R3, R2R),
           '%s{clip-path:var(--pxr2r)}' % w(SEL_R2L),
           '%s{clip-path:var(--pxr2)}' % w(SEL_R2),
           '%s{clip-path:var(--pxr3)}' % w(SEL_R3),
           '%s{clip-path:var(--pxr1)}' % w(SEL_R1),
           # ::before を置くために、static のものだけ relative にする（:where で詳細度0＝既存の position には勝たない）
           '%s{position:relative}' % w(SEL_R2 + SEL_R3 + SEL_R2L),
           '%s{content:"";position:absolute;inset:0;border:inherit;border-radius:0;pointer-events:none;%s}' % (pse(SEL_R2L, '::before'), M2R),
           '%s{content:"";position:absolute;left:0;top:-2px;bottom:-2px;border-left:3px solid;border-left-color:inherit;pointer-events:none}' % pse(SEL_R2L, '::after'),
           '%s{content:"";position:absolute;inset:0;border:inherit;border-radius:0;pointer-events:none;%s}' % (pse(SEL_R2, '::before'), M2),
           '%s{content:"";position:absolute;inset:0;border:inherit;border-radius:0;pointer-events:none;%s}' % (pse(SEL_R3, '::before'), M3),
           # 子がはみ出す正方形ボタン：枠は ::before（面＋縁）と ::after（段の内側の1ドット）
           '%s{isolation:isolate}' % ','.join(SEL_BOX),
           '%s{content:"";position:absolute;inset:0;z-index:-1;background:var(--pf);border:2px solid var(--pb);clip-path:var(--pxr2);pointer-events:none}' % pse(SEL_BOX, '::before'),
           '%s{content:"";position:absolute;inset:2px;z-index:-1;border:2px solid var(--pb);pointer-events:none;%s}' % (pse(SEL_BOX, '::after'), M2),
           # 円
           '%s{isolation:isolate;border-radius:0}' % ','.join(ROUND_BTNS),
           '%s{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--pf,transparent);-webkit-mask:var(--pxdisk) 0 0/100%% 100%% no-repeat;mask:var(--pxdisk) 0 0/100%% 100%% no-repeat}' % pse(ROUND_BTNS, '::before'),
           '%s{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--pb,transparent);-webkit-mask:var(--pxring) 0 0/100%% 100%% no-repeat;mask:var(--pxring) 0 0/100%% 100%% no-repeat}' % pse(ROUND_BTNS, '::after'),
           '.hub-ava .glyph{position:relative}',
           ]
    for sel, D in ROUND_BTNS.items():
        out.append('%s{--pxdisk:%s;--pxring:%s}' % (sel, disk_svg(D), disk_svg(D, True)))
    return '\n'.join('  ' + l for l in out) + '\n'


def rule_span(s, sel_start):
    a = s.index('{', sel_start); b = s.index('}', a); return a, b


def edit_rule(s, selector, fn, start=0):
    """CSS の中の `selector{...}` を1つ探して、本文を fn で書き換える"""
    m = re.compile(r'(?:^|\})[ \t]*' + re.escape(selector) + r'\{', re.M).search(s, start)
    if not m: raise SystemExit('not found: ' + selector)
    a, b = rule_span(s, m.end() - 1)
    body = s[a + 1:b]
    nb = fn(body)
    return s[:a + 1] + nb + s[b:]


def main():
    s = open(P, encoding='utf-8').read()
    if '/* ---------- 角丸と円をドット絵に' in s:
        print('already applied'); return
    end = s.index('</style>')
    css, rest = s[:end], s[end:]
    # 1) border-radius を消す（円は下で個別に）
    n0 = css.count('border-radius')
    css = re.sub(r'border-radius:(?!50%)[^;}]*;?', '', css)
    # 2) 四角い枠の線を 1ドット（2px）に
    def thick(body):
        return re.sub(r'border:(1px|1\.5px) (solid|dashed)', r'border:2px \2', body)
    for sel in ['#dbgbtn', '.card', 'button', '.item', '.boon', '#gravehint', '#intruder', '#statusbar span', '#targetinfo', '.fgwho',
                '#potnote', '#foottag', '#durtag', '#prompt', '#toast', '#adbox', '#nm-input,#an-input', '.hub-badge']:
        css = edit_rule(css, sel, thick)
    css = edit_rule(css, '#potnote', lambda b: b.replace('border:1px solid var(--pn-col', 'border:2px solid var(--pn-col'))
    # 左の色の帯は枠線をやめ、::after の縦の帯にする（枠線どうしの継ぎ目が斜めに割れるため）。色は border-left-color を inherit
    css = edit_rule(css, '.item', lambda b: b.replace('border-left-width:3px;', 'border-left-width:0;').replace('padding:9px 10px;', 'padding:9px 10px 9px 13px;'))
    css = edit_rule(css, '.boon', lambda b: b.replace('border-left:3px solid #d6b34a;', 'border-left:0 solid #d6b34a;').replace('padding:12px 14px;', 'padding:12px 14px 12px 17px;'))
    # 3) 円：面と縁を変数へ
    def circ(body):
        body = body.replace('border-radius:50%;', '').replace('border-radius:50%', '')
        m = re.search(r'background:([^;]+);', body)
        if m: body = body.replace(m.group(0), '--pf:%s;background:none;' % m.group(1).strip())
        m = re.search(r'border:([\d.]+px) solid ([^;}]+);?', body)
        if m: body = body.replace(m.group(0), '--pb:%s;border:none;' % m.group(2).strip())
        return body
    for sel in ['#ultbtn', '#guardbtn', '#wavebtn', '#artbtn', '#bagbtn', '#statbtn', '#mapbtn', '#stick', '#knob', '.hub-ava .glyph']:
        css = edit_rule(css, sel, circ)
    # 円の状態：縁の色・面の色・光
    def states(body):
        body = re.sub(r'border-color:([^;}]+)', r'--pb:\1', body)
        body = re.sub(r'background:([^;}]+)', r'--pf:\1', body)
        body = re.sub(r'box-shadow:0 0 (\d+)px -2px ([^;}]+)', lambda m: 'filter:drop-shadow(0 0 %dpx %s)' % (max(2, int(m.group(1)) // 3), m.group(2)), body)
        return body
    for sel in ['#guardbtn.held', '#ultbtn.ready', '#wavebtn.ready', '#artbtn.ready', '#mapbtn.on', '#mapbtn:active', '#statbtn:active', '#bagbtn:active']:
        css = edit_rule(css, sel, states)
    # 4) 子がはみ出す正方形ボタン
    def box(body):
        m = re.search(r'background:([^;]+);', body); body = body.replace(m.group(0), '--pf:%s;background:none;' % m.group(1).strip())
        m = re.search(r'border:([\d.]+px) solid ([^;}]+);?', body); body = body.replace(m.group(0), '--pb:%s;border:none;' % m.group(2).strip())
        return body
    css = edit_rule(css, '.hub-corner,.hub-mini', box)
    css = css + css_block()
    # 5) JS の中の小さな棒（border-radius:3px）
    rest = rest.replace('background:#1b2029;border-radius:3px;', 'background:#1b2029;')
    # 6) 盤面の円（キャンバスの arc/ellipse）をドットの段にする差し替え
    tag = '<script src="pixel-round.js?v=20261004a"></script>'
    if tag not in rest:
        rest = re.sub(r'(<script src="save-load\.js[^"]*"></script>)', tag.replace('\\', '') + '\n' + r'\1', rest, count=1)
    open(P, 'w', encoding='utf-8').write(css + rest)
    print('border-radius in css: %d -> %d' % (n0, css.count('border-radius')))


if __name__ == '__main__':
    main()
