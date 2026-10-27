"""ヴェラ第一形態のコマを本編用の1枚のシートにする。
行：0=横（右向き。左向きは本編が左右反転）、1=正面、2=背面。列：待機12・歩行8・射撃12・被弾5＝37コマ（1コマ48×48）。
出力：vera1_sheet.png と vera1_meta.json（cave-look.js の VERA1 に入れる）。"""
import json, sys, base64, io
import numpy as np
from PIL import Image
from lib import flip
import side_anim, front_anim, back_anim
ORDER=['idle','walk','shoot','hurt']
rows=[]
meta={'w':48,'h':48,'ax':24,'feet':41,'dirs':['side','front','back'],'anims':{}}
for name,mod,fl in (('side',side_anim,True),('front',front_anim,False),('back',back_anim,False)):
    row=[]; s=0
    for an in ORDER:
        fr,d=getattr(mod,an)()
        if fl: fr=[flip(f) for f in fr]
        if name=='side': meta['anims'][an]=[s,len(fr),d]
        row+=fr; s+=len(fr)
    rows.append(row)
n=len(rows[0]); assert all(len(r)==n for r in rows)
sheet=np.zeros((48*3,48*n,4),np.uint8)
for r,row in enumerate(rows):
    for i,f in enumerate(row): sheet[r*48:(r+1)*48,i*48:(i+1)*48]=f
im=Image.fromarray(sheet,'RGBA')
# colour count check, then save as an optimised palette PNG (transparency kept)
cols=len(set(map(tuple,sheet.reshape(-1,4)[sheet.reshape(-1,4)[:,3]>0])))
flat=sheet.reshape(-1,4); op=flat[:,3]>0
uniq=sorted(set(map(tuple,flat[op][:,:3])))
assert len(uniq)<=255, len(uniq)
idx={c:i+1 for i,c in enumerate(uniq)}
ind=np.zeros(flat.shape[0],np.uint8)
for k in np.nonzero(op)[0]: ind[k]=idx[tuple(flat[k,:3])]
q=Image.fromarray(ind.reshape(sheet.shape[:2]),'P')
pal=[0,0,0]+[v for c in uniq for v in c]; q.putpalette(pal+[0]*(768-len(pal)))
q.info['transparency']=0
back=np.array(q.convert('RGBA'))
assert np.array_equal(back[:,:,3]>0, sheet[:,:,3]>0), 'alpha changed'
assert np.array_equal(back[sheet[:,:,3]>0],sheet[sheet[:,:,3]>0]), 'colours changed'
buf=io.BytesIO(); q.save(buf,'PNG',optimize=True,transparency=0)
open(sys.argv[1] if len(sys.argv)>1 else 'vera1_sheet.png','wb').write(buf.getvalue())
meta['n']=n
json.dump(meta,open('vera1_meta.json','w'))
print('frames per dir',n,'colours',cols,'png bytes',len(buf.getvalue()))
