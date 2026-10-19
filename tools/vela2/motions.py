"""ヴェラ第二形態：待機・歩行・予兆（ループ）・攻撃・被弾・部位破壊後 をリグ（rig.py）から書き出す。"""
import runpy, math, json, base64
from PIL import Image
g=runpy.run_path('rig.py'); R=g['render']; CW,CH,P=g['CW'],g['CH'],g['P']
LEGS=['LO','LY','LU','LP','RO','RY','RU','RP']
DUST=[(122,128,124,255),(84,92,90,255),(58,64,63,255)]
CHIP=[(150,232,222,255),(102,122,121,255),(61,73,75,255)]
BOB=[0,0,1,1,1,1,1,1,0,0,-1,-1,-1,-1,0,0]
def idle_cf(i,broken=()):
    return {'by':BOB[i%16],'ant':-math.cos(2*math.pi*(i-2.5)/16),'glow':1+0.18*max(0,math.sin(2*math.pi*i/16)),'broken':broken}
def build(R):
    # ---------- 待機 ----------
    idle=[]
    for loop in range(2):
        for i in range(16):
            bl={12:.5,13:1,14:.5}.get(i,0) if loop==1 else 0
            idle.append((R(idle_cf(i),bl,(loop*16+i)*5),110 if not bl else 70))
    # ---------- 歩行（速く：95→70ms） ----------
    A={'LO','RY','LU','RP'}
    walk=[]
    for i in range(12):
        p=i/12; tip={}; th={}
        for k in LEGS:
            ph=p if k in A else (p+0.5)%1
            if ph<0.5:
                s=math.sin(math.pi*ph/0.5); tip[k]=(1.2*s,-(3.0 if k[1]!='O' else 3.5)*s)
                if k[1]=='Y': th[k]=14*s
            else: tip[k]=(0,0)
        cf={'by':1 if (i%6) in (0,1) else 0,'bx':[0,0,0,1,1,0,0,0,0,-1,-1,0][i],'tip':tip,'thigh':th,
            'ant':-math.cos(2*math.pi*(i*2-1.5)/12),'glow':1.05}
        walk.append((R(cf,0,i*6),70))
    # ---------- 攻撃 ----------
    def dust(k,s):
        J=g['JOINTS'][k][-1]; x,y=int(J[0]),int(J[1]); sg=-1 if k[0]=='L' else 1
        pts={0:[(0,0),(sg,0),(-sg,0),(0,-1)],1:[(2*sg,0),(-2*sg,-1),(sg,-2),(3*sg,-1),(-sg,-1)],2:[(4*sg,-2),(-3*sg,-2),(2*sg,-3),(5*sg,-1)]}[s]
        return [(x+a,y+b,DUST[min(2,j%3+s//2)]) for j,(a,b) in enumerate(pts)]
    def atk_cf(by,lift,out,th,ant,glow,bx=0):
        return {'by':by,'bx':bx,'tip':{'LY':(out,lift),'RY':(out,lift),'LP':(0,lift*0.35),'RP':(0,lift*0.35)},
                'thigh':{'LY':th,'RY':th},'ant':ant,'glow':glow}
    atk=[
     (R(atk_cf(0,0,0,0,0,1.0)),100),
     (R(atk_cf(1,-3,1,10,-0.4,1.15)),90),
     (R(atk_cf(1,-7,2,22,-0.8,1.3)),90),
     (R(atk_cf(1,-10,2,30,-1.0,1.45)),260),
     (R(atk_cf(-2,-4,3,8,0.6,1.5)),50),
     (R(atk_cf(1,0,3,-6,1.0,1.5),fx=dust('LY',0)+dust('RY',0)),70),
     (R(atk_cf(2,0,3,-4,0.8,1.35),fx=dust('LY',1)+dust('RY',1)),90),
     (R(atk_cf(1,0,2,-2,0.2,1.2),fx=dust('LY',2)+dust('RY',2)),110),
     (R(atk_cf(0,0,1,0,-0.2,1.1)),120),
     (R(atk_cf(0,0,0,0,0,1.0)),140),
    ]
    # ---------- 予兆（溜めのあいだ繰り返す）：振り上げたまま震え、目が脈打ち、足元から礫が浮く ----------
    def pebbles(i):
        """足元から礫が浮かんでいく（2×2、上の角だけ青緑に照る）"""
        out=[]
        for k,phase in (('LY',0),('RY',3),('LU',1.5),('RU',4.5),('LP',2.2),('RP',5.1)):
            J=g['JOINTS'][k][-1]; x,y=int(J[0]),int(J[1])
            q=((i+phase)%6)/6
            yy=y-3-int(q*13); xx=x+((i+int(phase))%2)*(1 if k[0]=='R' else -1)
            K=(0,1,1,255)
            if q<0.7:      # 4×3 の礫：上の面が照り、輪郭あり
                rock=[" KK ","KLMK","KMDK"," KK "]
            else:
                rock=["KK","KM","KK"][:2]
            for j,row in enumerate(rock):
                for i_,ch in enumerate(row):
                    if ch!=' ': out.append((xx+i_-1,yy+j-1,{'K':K,'L':CHIP[0],'M':CHIP[1],'D':CHIP[2]}[ch]))
        return out
    tele=[]
    for i in range(6):
        cf=atk_cf(1,-10,2,30,-1.0+0.25*(i%2),1.45+0.2*(1 if i%3==1 else 0),bx=(i%2))
        tele.append((R(cf,fx=pebbles(i)),80))
    # ---------- 被弾 ----------
    def tint(im,mode):
        im=im.copy(); p=im.load()
        for y in range(im.height):
            for x in range(im.width):
                r,g_,b,a=p[x,y]
                if not a: continue
                if r+g_+b<40: continue
                p[x,y]=(255,255,255,255) if mode=='white' else ((r+226*2)//3,(g_+70*2)//3,(b+52*2)//3,255)
        return im
    def chips(s):
        cx,cy=59,40
        pts={0:[(-6,-4),(7,-3),(-3,-8),(4,-9)],1:[(-11,-7),(12,-6),(-6,-13),(7,-14),(0,-12)],2:[(-15,-8),(16,-7),(-9,-16),(10,-17)]}[s]
        return [(cx+a,cy+b,CHIP[min(2,j%3+s//2)]) for j,(a,b) in enumerate(pts)]
    hurt=[
     (tint(R({'by':-1,'ant':1.0,'glow':1.0},0.5),'white'),50),
     (tint(R({'by':1,'bx':1,'ant':-1.0,'glow':0.8},1.0,fx=chips(0)),'red'),70),
     (R({'by':1,'bx':-1,'ant':0.8,'glow':0.85},0.5,fx=chips(1)),80),
     (R({'by':1,'ant':-0.4,'glow':0.95},0,fx=chips(2)),90),
     (R({'by':0,'ant':0.2,'glow':1.0}),120),
    ]
    # ---------- 部位破壊後（待機のループ。壊れた脚ごと） ----------
    broken={}
    pass
    
    return [('idle',idle),('walk',walk),('tele',tele),('atk',atk),('hurt',hurt)]
