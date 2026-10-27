import json, os
import numpy as np
from lib import flip
from sheet import sheet, gif, strip
import side_anim, front_anim, back_anim
OUT='out/final'; os.makedirs(OUT,exist_ok=True)
A={}
for name,mod in (('left',side_anim),('front',front_anim),('back',back_anim)):
    for an in ('idle','walk','shoot','hurt'):
        fr,d=getattr(mod,an)(); A[(name,an)]=(fr,d)
for an in ('idle','walk','shoot','hurt'):
    fr,d=A[('left',an)]; A[('right',an)]=([flip(f) for f in fr],d)
meta={}
for (dn,an),(fr,d) in A.items():
    strip(fr,f'{OUT}/vera1_{dn}_{an}.png')
    gif(fr,d,f'{OUT}/vera1_{dn}_{an}_x6.gif',S=6,crop=(0,0,48,48))
    meta[f'{dn}_{an}']={'frames':len(fr),'ms':d}
json.dump({'frame':[48,48],'feet_y':41,'center_x':24,'anims':meta},open(f'{OUT}/vera1_anim.json','w'),ensure_ascii=False,indent=1)
for an,lab in (('idle','待機'),('walk','歩行'),('shoot','射撃'),('hurt','被弾')):
    rows=[(f'{lab}・{j}',A[(dn,an)][0]) for dn,j in (('left','左'),('right','右'),('front','正面'),('back','背面'))]
    sheet(rows,f'{OUT}/sheet_{an}.png',S=4,crop=(0,0,48,48))
print(sorted(os.listdir(OUT)))
