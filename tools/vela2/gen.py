"""ヴェラ第二形態：脚の壊れ方16通り × 全モーションを書き出す（ゲーム組み込み用）。
combo のビット：1=絵の左の前脚(黄紫) 2=絵の右の前脚 4=絵の左の奥脚(橙青) 8=絵の右の奥脚
出力：out/v2g_<combo>.png（横に並べたシート、パレットPNG）"""
import sys, runpy, math, json
from PIL import Image
combo=int(sys.argv[1])
ns=runpy.run_path('motions.py')
g=ns['g']; CW,CH=g['CW'],g['CH']; R0=g['render']
B=tuple(p for bit,p in ((1,'SW'),(2,'SE'),(4,'NW'),(8,'NE')) if combo&bit)
def R(cf,*a,**k): cf=dict(cf); cf['broken']=B; return R0(cf,*a,**k)
seq=ns['build'](R)
frames=[f for name,fr in seq for f,_ in fr]
sh=Image.new('RGBA',(CW*len(frames),CH),(0,0,0,0))
for i,f in enumerate(frames): sh.paste(f,(i*CW,0))
cols=sorted({c for c in sh.getdata() if c[3]})
if len(cols)<=255:
    pal=[(0,0,0)]+[c[:3] for c in cols]; idx={c:i+1 for i,c in enumerate(cols)}
    p=Image.new('P',sh.size,0); p.putdata([idx.get(c,0) if c[3] else 0 for c in sh.getdata()])
    flat=[v for c in pal for v in c]; p.putpalette(flat+[0]*(768-len(flat)))
    p.save(f'out/v2g_{combo}.png',optimize=True,transparency=0)
else:
    sh.save(f'out/v2g_{combo}.png',optimize=True)
meta={'combo':combo,'w':CW,'h':CH,'anims':{name:{'n':len(fr),'d':[d for _,d in fr]} for name,fr in seq},'colors':len(cols)}
json.dump(meta,open(f'out/v2g_{combo}.json','w'))
print(combo,len(frames),len(cols))
