"""道中の商人と鉱床のドット絵（2026-10-09）。

仲間（proto/assets/sprites/characters/allies/*.png）と同じ描き方：
  16×16 ドットを 1ドット＝4px で 64×64 の PNG に。縁は #1f2843、ほぼ平塗り、頭が大きい。
絵の正はこのファイルの文字の格子。直したらこれを走らせて PNG を作り直し、
index.html の CharacterArt に貼り直す（--apply）。

  python3 tools/npc_px.py            PNG を書き出す
  python3 tools/npc_px.py --apply    PNG を書き出して index.html の CharacterArt に埋める
  python3 tools/npc_px.py --preview x.png   並べた確認用の絵
"""
from PIL import Image
import sys, os, base64, io, re
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------- 商人 ----------------
# 背中に大きな荷（上に巻いた毛布、脇に灯の入った角灯）、つばの広い帽子、白い髭、赤い外套、杖。
# 仲間と同じ右向き。ゲームでは主人公のいる側へ向きを変える。
MERCHANT_PAL={'A':'#1f2843','P':'#b99a67','p':'#806c50','S':'#6a3e31','Q':'#5485bb','q':'#315d78',
     'H':'#874122','h':'#a85f32','G':'#d6b34a','E':'#e8d6ba','F':'#d3a189','W':'#d7dde3','w':'#b8c1cc',
     'R':'#8d3b35','r':'#c65343','Y':'#f2c14e','y':'#fff1ad','K':'#a85f32','B':'#6a3e31','L':'#454a68'}
MERCHANT_M=[
"................",
".AAAAA..........",
"AQQQQQAAAAAA....",
"AqQqQAHHHHHHA...",
"AQQQQAHHGGGHA...",
"AAAAAhHHHHHHHHA.",
"APPPAEEEEEEEA...",
"ApPPAEAEEAEEA.A.",
"APPPAFWWWWWFAAKA",
"APYPARWWwWWRAEKA",
"AYyYARrRGRRrAAKA",
"AAYAARRRRRRRA.KA",
".A.A.ARRRRRA..KA",
".....ABBAABBA.KA",
".....AAA..AAA.AA",
"................",
]

# ---------------- 鉱床 ----------------
# 等級ごとに鉱石そのものの素材を変える。
#   粗鉱 … 母岩に食い込んだ鉄の塊（鈍い鋼色＋光る面）と錆の筋
#   精鉱 … 母岩から突き出た水色の柱状結晶
#   深鉱 … 暗い紫の母岩に、傾いて生えた紫水晶
#   掘った跡 … 低い瓦礫に、その等級の色のかけらが1つ
# 色は ORES の col（#9aa3b2 / #7fc8e0 / #c98adf）にそろえてある。
BASE={'A':'#1f2843','K':'#3a405c','k':'#66626d','L':'#8b8794'}
PALS={
 'raw': {'m':'#7d8698','M':'#aeb8c8','g':'#f0f4f8','o':'#874122','O':'#c06a34'},
 'fine':{'c':'#2f5f80','C':'#7fc8e0','w':'#d4f4ff'},
 'deep':{'K':'#2a2340','k':'#4a3a60','L':'#6c5a85','c':'#6a3e8a','C':'#c98adf','w':'#f4d8ff'},
}
SPR={
'raw':[
"................",
"................",
"................",
"................",
"................",
"...AAAAA..AAA...",
"..AggMMMA.AgMA..",
"..AgMMMMmAAMmA..",
".AgMMMmmmAkAAkA.",
".AMMmmmmAOkLLkA.",
".AmmmmAAOokLkkA.",
".AAmAAkOokkkKkA.",
".ALkAkOokAgMAKA.",
"..AkKkokKAMmAA..",
"...AAAAAAAAAA...",
"................",
],
'fine':[
"................",
"................",
".......A........",
"......AwA.......",
"......AwCA......",
"..A...AwCA......",
".AwA..AwCcA..A..",
".AwCA.AwCcA.AwA.",
".AwCcAAwCcAAwCA.",
".AwCcALkkkLAwcA.",
".AAAAkLkkkkkAAA.",
".ALkkkkkKkkKkkA.",
".AkkkKkkkKKkKkA.",
"..AKkKKkKKKKKA..",
"...AAAAAAAAAA...",
"................",
],
}
SPR['deep']=[
"................",
"....A......A....",
"...AwA....AwA...",
"...AwCA..AwCA...",
"...AwCcAAwCcA...",
"..AAwCcAwCCcA...",
".AwAwCcAwCcAA...",
".AwCAAAAwCcAwA..",
".AwCcALAAAAAwCA.",
".AAAAkLLkkLAwcA.",
".ALkkkLkkkkkAAA.",
".AkkkkkkKkkKkkA.",
".AkKkKkkkKKkKkA.",
"..AKkKKkKKKKKA..",
"...AAAAAAAAAA...",
"................",
]
# 掘った跡：低い瓦礫と、等級の色のかけら（g/C で置き換え）
SPR['mined']=[
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"......AAA.......",
"...AA.AkLA.AAA..",
"..AkLAAkkAAxkA..",
"..AKkkKAAkkKKA..",
"...AAAAAAAAAA...",
"................",
]

def render(M,pal,scale=4):
    im=Image.new('RGBA',(16*scale,16*scale),(0,0,0,0)); px=im.load()
    for y,row in enumerate(M):
        assert len(row)==16,(y,len(row),row)
        for x,c in enumerate(row):
            if c=='.': continue
            h=pal[c]; col=tuple(int(h[i:i+2],16) for i in (1,3,5))+(255,)
            for dy in range(scale):
                for dx in range(scale): px[x*scale+dx,y*scale+dy]=col
    return im

def build():
    out={'merchant':render(MERCHANT_M, MERCHANT_PAL)}
    for g in ('raw','fine','deep'):
        pal=dict(BASE); pal.update(PALS[g]); out['ore-'+g]=render(SPR[g],pal)
        mp=dict(BASE)
        if g=='deep': mp.update({k:PALS['deep'][k] for k in 'KkL'})
        mp['x']={'raw':'#9aa3b2','fine':'#7fc8e0','deep':'#c98adf'}[g]
        out['ore-'+g+'-mined']=render(SPR['mined'],mp)
    return out

PATHS={'merchant':'proto/assets/sprites/characters/npc/merchant-right-idle.png'}
for g in ('raw','fine','deep'):
    PATHS['ore-'+g]='proto/assets/sprites/props/ore/ore-'+g+'.png'
    PATHS['ore-'+g+'-mined']='proto/assets/sprites/props/ore/ore-'+g+'-mined.png'

def b64(im):
    bio=io.BytesIO(); im.save(bio,'PNG',optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(bio.getvalue()).decode()

def main():
    out=build()
    for k,im in out.items():
        p=os.path.join(ROOT,PATHS[k]); os.makedirs(os.path.dirname(p),exist_ok=True); im.save(p)
    if '--preview' in sys.argv:
        names=list(out); W=192
        o=Image.new('RGBA',(len(names)*(W+8),W),(34,36,46,255))
        for i,n in enumerate(names):
            r=out[n].resize((W,W),Image.NEAREST); o.paste(r,(i*(W+8),0),r)
        o.save(sys.argv[sys.argv.index('--preview')+1])
    if '--apply' in sys.argv:
        p=os.path.join(ROOT,'proto/index.html'); s=open(p,encoding='utf-8').read()
        a=s.index('const CharacterArt = (function(){'); b=s.index('  };', a)
        head=s[a:b]
        for k,im in out.items():
            line="    '%s': '%s',\n" % (k, b64(im))
            pat=re.compile(r"    '%s': 'data:image/png;base64,[^']*',\n" % re.escape(k))
            if pat.search(head): head=pat.sub(lambda _:line, head)
            else: head=head+line
        s=s[:a]+head+s[b:]
        open(p,'w',encoding='utf-8').write(s)
        print('applied', len(out))

if __name__=='__main__': main()
