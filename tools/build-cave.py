#!/usr/bin/env python3
"""proto/index.html から proto/cave.html（洞窟の見た目の試作）を作る。

本編 index.html は書き換えない。読んで、差し込み口を4か所足した写しを書き出すだけ。
本編が更新されたら、これを走らせ直せば同じ差し込みで作り直せる。

    python3 tools/build-cave.py

差し込み口が見つからなかったら（本編の該当箇所が書き換わったら）止まる。
"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root/'proto/index.html').read_text(encoding='utf-8')

def rep(s, old, new, label):
    n = s.count(old)
    if n != 1 or not old:
        sys.exit(f'差し込み口が {n} 件（1件のはず）: {label}')
    return s.replace(old, new)

# 1) 地形：マスを塗るループの代わりに CAVE.terrain を呼ぶ
s = rep(src,
  "  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){\n    if(!W.seen[y][x]) continue;\n    const t=f.g[y][x];",
  "  if(!(window.CAVE && CAVE.on && CAVE.terrain(f,Z,camX,camY,blinded)))\n  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){\n    if(!W.seen[y][x]) continue;\n    const t=f.g[y][x];",
  'terrain')
# 2) 地形ハザード：地形の側で面として描いたので、四角い塗りは飛ばす
s = rep(s,
  "  // 地形ハザード。床の上、キャラの下に描く。\n  if(W.haz){",
  "  // 地形ハザード。床の上、キャラの下に描く。\n  if(W.haz && !(window.CAVE && CAVE.on)){",
  'hazard')
# 3) 敵：ドット絵が描けたら今の絵は出さない
s = rep(s,
  "    let spriteDrawn=false;\n    ctx.save(); ctx.globalAlpha*=feelBlink(e);\n    if(spr && sprite(spr)){",
  "    let spriteDrawn=false;\n    ctx.save(); ctx.globalAlpha*=feelBlink(e);\n    if(window.CAVE && CAVE.on && CAVE.enemy(e,sx,sy,R)){ spriteDrawn=true; }\n    else if(spr && sprite(spr)){",
  'enemy')
# 4) 読み込み：game-feel.js の直後に cave-look.js
m = re.findall(r'<script src="game-feel\.js[^"]*"></script>', s)
if len(m) != 1: sys.exit('game-feel.js の読み込みが見つからない')
s = s.replace(m[0], m[0] + '\n<script src="cave-look.js"></script>')
s = re.sub(r'<title>(.*?)</title>', r'<title>\1（洞窟の見た目・試作）</title>', s, count=1)
s = s.replace('<html', '<!-- 自動生成：tools/build-cave.py が proto/index.html から作る。直接編集しない。 -->\n<html', 1)
(root/'proto/cave.html').write_text(s, encoding='utf-8')
print('proto/cave.html を書き出した', len(s), 'bytes')
