# spr_bullets.json と spr_rocks.json を、weapon-art-pixel.js に入れる形（src/75_rockspr.js）にする
import json, sys
a=json.load(open('spr_bullets.json')); b=json.load(open('spr_rocks.json'))
def trim(rows):
    ys=[i for i,r in enumerate(rows) if r.strip('.')]; rows=rows[ys[0]:ys[-1]+1]
    xs=[i for i in range(len(rows[0])) if any(r[i]!='.' for r in rows)]; return [r[xs[0]:xs[-1]+1] for r in rows]
data={k:[trim(s) for s in v] for k,v in {**a,**b}.items()}
print("  const ROCK_SPR = "+json.dumps(data,separators=(',',':'))+";")
