import numpy as np, math, json
exec(open('gen_sprites.py').read().split("out={}")[0])
out={}
def mk(k,**kw):
    m,g,_=rocks[k]; G,M=warp(m,g,pad=2,**kw)
    L=cleanup(synth(G,M,kappa=1.0,w_causal=1.6),M)
    return enc(trim(L))
# 岩の棘（波動）：縦長の岩を細く高く。高さ 18・24・30 を 3種ずつ
sp=[]
for H in (18,24,30):
    for k,sx in ((0,0.55),(4,0.6),(0,0.7)):
        h0=rocks[k][0].shape[0]; sp.append(mk(k,sx=sx*H/30,sy=H/h0))
out['spike']=sp; print('spike',flush=True)
# 岩の塊（かけら・溜めで浮く岩・砕けた跡）：大 12・中 8・小 5 を 4種ずつ
ch={}
for name,S in (('l',13),('m',9),('s',6)):
    arr=[]
    for k in (1,2,3,4):
        m=rocks[k][0]; f=S/max(m.shape); arr.append(mk(k,sx=f,sy=f))
    ch[name]=arr
out['chunk_l']=ch['l']; out['chunk_m']=ch['m']; out['chunk_s']=ch['s']; print('chunk',flush=True)
json.dump(out,open('spr_rocks.json','w'))
