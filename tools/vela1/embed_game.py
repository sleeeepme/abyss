"""cave-look.js に第一形態の新しい絵（VERA1）と vera1Draw を書き込む。2回目以降は VERA1_BEGIN〜END を差し替える。"""
import json, base64, re, sys
JS=sys.argv[1]; PNG=sys.argv[2]; META=sys.argv[3]
meta=json.load(open(META)); meta['src']='data:image/png;base64,'+base64.b64encode(open(PNG,'rb').read()).decode()
def abgr(h):
    h=h.lstrip('#'); r,g,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)
    return (0xff<<24)|(b<<16)|(g<<8)|r
EMIS=[abgr(h) for h in ('#f7ad40','#f6ad40','#ba9252','#976f34','#fff8e8','#e8fff8')]
block='''/*VERA1_BEGIN*/
/* ===== ヴェラ第一形態：パーツ分解リグの新しい絵（2026-10-27 ユーザー指定「これで第一形態に適用して」） =====
   RD で作った横絵＋ユーザーの正面の絵＋RD の背面を部位に分け、tools/vela1/ のリグで動かしてコマに焼いた。
   シート：行 0=横（右向き。左向きは本編の左右反転）・1=正面・2=背面。列は 待機12・歩行8・射撃12・被弾5（1コマ48×48、足元 y=41、中心 x=24）。
   - 向き：技の向き（e.cast.dir）・溜め中と止まっている間は主人公、歩く間は進む向き（e.fx,fy）。縦が横の1.25倍を超えたら
     正面（下）／背面（上）、横が縦の1.25倍を超えたら横に戻す（行ったり来たりしないように）。
   - 射撃：溜め（e.cast／e.tele）の進みで 0〜6 コマ（地面の石が浮き、弓手の腕にまとわりついて弓になり、つがえて引き絞る）。
     溜めが切れた瞬間から 7〜11 コマ（放つ→残心→弓が割れて崩れ、石が落ちる）。
   - 被弾：e.hit が増えたら5コマ（溜め・放つ間は出さない）。色は焼いていない（白い点滅は本編の flash）。
   - 明るさ：体はランタンで暗くし、琥珀の目・白い光りは暗くしない。
   絵が読み込めるまでは古い絵（VERA_SPR.f1）で描く。 */
const VERA1=%s;
const V1_EMIS=new Set(%s);
const V1_ANCHOR_Y=-18;          // 錨点：足元から18ドット上（新しい絵の体の中ほど）
(function(){ const im=new Image(); im.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=im.width; c.height=im.height;
    const x=c.getContext('2d'); x.drawImage(im,0,0); VERA1.u=new Uint32Array(x.getImageData(0,0,im.width,im.height).data.buffer); VERA1.sw=im.width; }catch(err){ console.error(err); } };
  im.src=VERA1.src; VERA1.lit=new Map(); })();
function vera1Ready(){ return !!VERA1.u; }
function vera1Pick(name,el,loop){
  const [s,n,d]=VERA1.anims[name]; let tot=0; for(const v of d) tot+=v/1000;
  let x=loop?el%%tot:el;
  for(let i=0;i<n;i++){ x-=d[i]/1000; if(x<0) return s+i; }
  return s+n-1;
}
function vera1Draw(e,t){
  if(!vera1Ready()) return null;
  const casting=!!e.cast||e.tele>0;
  const moving=!casting && footSpeed(e,t)>.3;
  if(casting && !e._v1Cast){ e._v1C0=t; e._v1CDur=(e.cast&&e.cast.max)?e.cast.max:Math.max(.2,e.tele||.6); }
  if(!casting && e._v1Cast) e._v1Rel=t;                          // 溜めが切れた瞬間＝放つ
  e._v1Cast=casting;
  const hit=e.hit||0; if(hit>(e._v1Hit||0)+1e-4) e._v1Dmg=t; e._v1Hit=hit;
  const A=VERA1.anims, sum=a=>a.reduce((p,q)=>p+q,0)/1000;
  const sh=A.shoot, relLen=sum(sh[2].slice(7)), hurtLen=sum(A.hurt[2]);
  const releasing=e._v1Rel!=null && t-e._v1Rel<relLen;
  // ---- 向き ----
  let ax,ay;
  if(e.cast&&e.cast.dir!=null){ ax=Math.cos(e.cast.dir); ay=Math.sin(e.cast.dir); }
  else if(casting||releasing||!moving){ ax=P.x-e.x; ay=P.y-e.y; }
  else { ax=e.fx||0; ay=e.fy||0; }
  if(!releasing||e._v1D==null){
    const vx=Math.abs(ax), vy=Math.abs(ay), prev=e._v1D||'side'; let d=prev;
    if(vx+vy>1e-6){
      if(prev==='side'){ if(vy>vx*1.25) d=ay>0?'front':'back'; }
      else if(vx>vy*1.25) d='side'; else d=ay>0?'front':'back';
      if(d==='side'&&vx>1e-3) e._v1Face=ax>0?1:-1;
    }
    e._v1D=d;
  }
  // ---- どのコマか ----
  let f;
  if(casting){ const p=(e.cast&&e.cast.max)?1-e.cast.t/e.cast.max:Math.min(1,(t-e._v1C0)/e._v1CDur);
    f=sh[0]+Math.max(0,Math.min(6,Math.floor(p*7))); }
  else if(releasing){ let x=t-e._v1Rel, i=7; while(i<sh[1]-1 && x>=sh[2][i]/1000){ x-=sh[2][i]/1000; i++; } f=sh[0]+i; }
  else if(e._v1Dmg!=null && t-e._v1Dmg<hurtLen) f=vera1Pick('hurt',t-e._v1Dmg,false);
  else if(moving) f=vera1Pick('walk',t,true);
  else f=vera1Pick('idle',t,true);
  const row=VERA1.dirs.indexOf(e._v1D);
  // ---- 明るさ ----
  const q=Math.round(Math.min(1,Math.max(0,PT.lit))*15);
  let L=VERA1.lit.get(q); if(!L){ L=new Map(); VERA1.lit.set(q,L); }
  const lf=Math.min(1.05,.38+.72*(q/15));
  const lit=c=>{ let v=L.get(c); if(v!==undefined) return v;
    if(V1_EMIS.has(c)) v=c; else { const r=c&255,g=(c>>8)&255,b=(c>>16)&255; v=(0xff000000|(Math.min(255,b*lf|0)<<16)|(Math.min(255,g*lf|0)<<8)|Math.min(255,r*lf|0))>>>0; }
    L.set(c,v); return v; };
  // ---- 貼る ----
  const N=PT.N, u=SPR.u32, W=VERA1.w, H=VERA1.h, SW=VERA1.sw, src=VERA1.u;
  const X0=Math.round(PT.ox-VERA1.ax), Y0=Math.round(PT.oy-VERA1.feet), fx=f*W, fy=row*H;
  for(let y=0;y<H;y++){ const Y=Y0+y; if(Y<0||Y>=N) continue; const r0=(fy+y)*SW+fx, out=Y*N;
    for(let x=0;x<W;x++){ const X=X0+x; if(X<0||X>=N) continue; const c=src[r0+x]; if(c>>>24) u[out+X]=lit(c>>>0); } }
  return [0, V1_ANCHOR_Y];
}
CAVE.vera1={ready:()=>vera1Ready(), dir:e=>e&&e._v1D, frame:e=>e&&e._v1F};   // テスト用
/*VERA1_END*/
'''%(json.dumps(meta,separators=(',',':')),json.dumps(EMIS))
s=open(JS,encoding='utf8').read()
if '/*VERA1_BEGIN*/' in s:
    s=re.sub(r'/\*VERA1_BEGIN\*/.*?/\*VERA1_END\*/\n',lambda m:block,s,flags=re.S)
else:
    key='function veraDraw(e,t){'
    assert s.count(key)==1
    s=s.replace(key,block+key)
open(JS,'w',encoding='utf8').write(s)
print('ok',len(block))
