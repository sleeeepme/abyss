/* =====================================================================
   洞窟の見た目（試作）— proto/cave.html 専用
   ---------------------------------------------------------------------
   本編（index.html）のゲームシステムはそのまま。描き方だけを差し替える。
   cave.html は tools/build-cave.py が index.html から作る。本編は読まない。

   差し替えるもの
     - 地形：マスの四角を塗る代わりに、1マス＝16ドットの連続した岩肌を描く。
       当たり判定は今までどおりマス。見た目の縁だけをノイズで崩している
       （マスの中心は必ず床／壁のまま＝見た目と判定が大きくずれない）。
     - 光：主人公のランタンから影を落とす。床はディザの段で暗くなり、
       光を受けた岩の縁だけが明るく光る。
     - 地形ハザード（水・溶岩・毒沼…）も同じドットの面として描く。
     - 敵：雑魚32種と中ボス5体をドットで描き直す（名前つきの大ボスは今の絵のまま）。
     - 漂う粒：1ドットの粒にする。
   層ごとの特徴は LOOK にまとめてある。
   ===================================================================== */
(()=>{
'use strict';
const CAVE = window.CAVE = { on:true, emit:[], nextEmit:[] };
const Q = 16;                         // 1マス = 16ドット

/* ---------- 色 ---------- */
function C(hex){const n=parseInt(hex.slice(1),16);return(0xff000000|((n&255)<<16)|(n&0xff00)|(n>>16))>>>0;}
function mixC(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);
  const r=Math.round((A>>16)*(1-t)+(B>>16)*t),g=Math.round((A>>8&255)*(1-t)+(B>>8&255)*t),bl=Math.round((A&255)*(1-t)+(B&255)*t);
  return(0xff000000|(bl<<16)|(g<<8)|r)>>>0;}
const cs=a=>a.map(C);
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);

/* ---------- 繰り返せるノイズ（256×256） ---------- */
function h2(x,y,s){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function tnoise(seed,cells){ // cells: [[格子の大きさ, 重み]]
  const out=new Float32Array(65536);
  for(const [cell,wt] of cells){const per=256/cell;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){const u=x/cell,v=y/cell,xi=Math.floor(u),yi=Math.floor(v),xf=u-xi,yf=v-yi;
      const sx=xf*xf*(3-2*xf),sy=yf*yf*(3-2*yf);
      const a=h2(xi%per,yi%per,seed),b=h2((xi+1)%per,yi%per,seed),c=h2(xi%per,(yi+1)%per,seed),d=h2((xi+1)%per,(yi+1)%per,seed);
      out[y*256+x]+=(a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy)*wt;}}
  return out;}
const NZ  = tnoise(11,[[32,.55],[16,.25],[8,.13],[4,.07]]);   // 岩の縁
const NZS = tnoise(12,[[64,.7],[32,.3]]);                     // 滑らかな縁（水の層）
const NZB = tnoise(23,[[64,.6],[16,.4]]);                     // 奥の岩影・床の模様
const NZR = tnoise(37,[[32,.6],[8,.4]]);                      // 筋（根の脈・炉のひび）
const ihash=(x,y)=>((Math.imul(x,73856093)^Math.imul(y,19349663))>>>0);

/* ---------- 層ごとの見た目 ----------
   amp     … 岩の縁の崩し量（大きいほど有機的。跡の層は小さく＝加工された石）
   lightT  … ランタンが届く距離（マス）
   shadow  … 影を落とすか（白の層は落とさない＝距離が測れない） */
const LOOK={
  /* 石の層：青い洞窟をランタンで照らしている。地面・壁・岩まで青を基調にし、灯りだけ暖色（スクリーンで重なる） */
  stone:{warp:1.0, amp:.55, nz:NZ, lightT:7.4, shadow:true, feature:'mist', sprAmb:.35,
    void:'#070a12', floor:['#0f192b','#121e34','#16243d'], speck:'#2a3c5a', crystal:'#4a6a90',
    deep:['#060a14','#0a111f'], edge:['#22324e','#16223a','#0e1628'], dotted:false,
    lit:['#2c2832','#3a3640','#4a4650','#5e5a5e','#78746e','#989284','#bab2a0'],
    rim:['#34405a','#56606e','#8a8a88','#c0b8a4','#ece4cc'],
    cool:['#1e2632','#2a3646','#3a4a60','#5a7090','#8aa8c8'],
    mist:['#18284a','#1e3256','#263e68'],
    mote:['#c8c090','#3a4a66'], air:'drift', sil:'#0a111f', pit:'#1e3256'},
  sump:{warp:1.1, amp:.62, nz:NZS, lightT:6.0, shadow:true, feature:'wet',
    void:'#030809', floor:['#061011','#0a191a','#0f2324'], speck:'#1d3a3c', crystal:'#3f8a86',
    deep:['#020506','#061012'], edge:['#15302f','#0b1d1e','#071213'], dotted:false,
    lit:['#0e2326','#143538','#1b4a4c','#276262','#3a7f7c','#5ea49c','#98cdc2'],
    rim:['#2a4a50','#4a7a80','#7fb8c0','#c0ecf0','#f0ffff'],
    cool:['#0c2a33','#12434f','#1c6a78','#38a8b8','#8ae6f0'],
    mote:['#9fe0ec','#1f4a50'], air:'bubble', sil:'#061012', pit:'#1f4a50'},
  root:{warp:1.25, amp:.78, nz:NZ, lightT:5.6, shadow:true, feature:'vein',
    void:'#070504', floor:['#0e0a07','#150f0a','#1c140d'], speck:'#3a2a18', crystal:'#5a7a2a',
    deep:['#050302','#0b0705'], edge:['#2e2214','#1a120b','#0f0a06'], dotted:false,
    lit:['#1c1410','#2e1f16','#46301c','#624424','#7e5e30','#9c7e44','#c0a868'],
    rim:['#40301c','#6a5028','#a08040','#d8c078','#f4e8b0'],
    cool:['#15220a','#243a0e','#3e6214','#78b02a','#c8f070'],
    vein:['#3a1216','#6a1e22','#a83a30'],
    mote:['#c8f070','#3e6214'], air:'spore', sil:'#0b0705', pit:'#3e2a18'},
  ruin:{warp:0.22, amp:.16, nz:NZ, lightT:6.6, shadow:true, feature:'masonry',
    void:'#060505', floor:['#0e0c0a','#14110e','#1a1612'], speck:'#2e2820', crystal:'#6a5a38',
    deep:['#050404','#0a0908'], edge:['#2a2620','#1a1714','#100e0c'], dotted:false,
    lit:['#1a1612','#2a231c','#3e3326','#584834','#766248','#9a8462','#c8b48a'],
    rim:['#3e362a','#6a5c44','#a08c66','#dccaa0','#fff4d4'],
    cool:['#2a1e08','#4a3410','#7a5a1c','#c09030','#ffd878'],
    mote:['#e0c98a','#4a3e28'], air:'dust', sil:'#0a0908', pit:'#3a3228'},
  furnace:{warp:1.0, amp:.55, nz:NZ, lightT:6.0, shadow:true, feature:'crack',
    void:'#050303', floor:['#0c0607','#130909','#1a0c0b'], speck:'#3a1a14', crystal:'#7a3a18',
    deep:['#040202','#080404'], edge:['#4a1c14','#1a0b09','#0c0505'], dotted:true,
    lit:['#1e0c0e','#35111a','#541a1a','#7e2818','#a8421c','#d06a28','#f0a454'],
    rim:['#4a2018','#7a3418','#c0621e','#f2a040','#ffe0a0'],
    cool:['#2a0e08','#4f1a0a','#8a3510','#d8701c','#ffc060'],
    crack:['#5a1408','#b8401a','#ff9a40','#ffe08a'],
    mote:['#ff9a40','#5a2410'], air:'ember', sil:'#0e0708', pit:'#4a1810'},
  pale:{warp:0.8, amp:.34, nz:NZS, lightT:44, shadow:false, feature:'seam',
    void:'#8f8c86', floor:['#7c7a75','#807e79','#84827d'], speck:'#9a9892', crystal:'#b8b4ac',
    deep:['#d4d1ca','#cfccc5'], edge:['#a19e97','#bab7b0','#c8c5be'], dotted:true,
    lit:['#83817c','#888681','#8d8b86','#92908b','#979590','#9c9a95','#a19f9a'],
    rim:['#c8c5be','#d6d3cc','#e2dfd8','#eeebe4','#f8f6f0'],
    cool:['#8a8098','#958aa6','#a494b8','#b8a4d0','#d4c0f0'],
    mote:['#f4f2ec','#a8a6a0'], air:'flake', sil:'#b0ada6', pit:'#5a5670', flat:true},
};
function prep(L){ if(L._p) return L._p;
  const p={}; for(const k of ['floor','deep','edge','lit','rim','cool','vein','crack','mote','mist']) if(L[k]) p[k]=cs(L[k]);
  for(const k of ['void','speck','crystal','pit']) p[k]=C(L[k]);
  if(!L.flat){ p.lit=L.lit.map(h=>mixC(L.floor[1],h,LIGHT_A)); p.litAdd=L.lit.map(h=>mixC('#000000',h,LIGHT_A*(1-PAT_A))); }   // スクリーンで重ねる灯りの色
  return (L._p=p); }
const lookOf=Z=>LOOK[Z&&Z.id]||LOOK.stone;
/* 主人公の明かりの濃さ。1で元の強さ。網（ディザ）の目立ち方は LIGHT_DITHER（1で元の振れ幅）。 */
/* 明かりの中で地面の模様をどれだけ透かすか（0で透かさない） */
const PAT_A=.15;
/* 画面上下のぼかし（本編は blur 5 / band .40 / fade .30） */
const CAVE_TILT={strength:6, band:.30, fade:.24, strips:10};   // strength＝端での縮小率（大きいほど強くぼける）
/* ---------- 画面の端へ向かって暗くなるビネット ----------
   ユーザー要望「主人公の灯りとは別に、画面端にかけて暗くなるビネットを入れたい。
   ぼかしの領域あたりが暗くなるようなイメージ」。

   **上下のぼかし帯の中で一緒に塗る。** ビネット用にもう一度画面を走査すると、
   全画面ぶんの重ね塗りが1枚増える（以前、放射グラデーションのビネットが
   それで 15fps ぶん食っていた）。ぼかしは既に帯を1本ずつ塗り直しているので、
   その直後に同じ矩形を黒で伏せれば、走査は増えない。

   そしてここが肝で、**暗くした所はぼかす必要が無くなる。**
   一番外の帯（帯の終わりから画面の端まで）はぼかし全体の3割を占めるのに、
   ビネットで6割以上伏せてしまえば、ぼけているかどうかは読めない。
   そこはぼかさずに伏せるだけにして、浮いた時間を発熱の削減に回す。 */
const CAVE_VIG={
  max: 1,          // 画面の**いちばん端**での暗さ（1 で真っ黒）
  pow: 1.9,        // 立ち上がり方。大きいほど端に寄る（途中はあまり暗くしない）
  skipBlur: .40,   // これより暗くなる帯はぼかさない（伏せるだけ）
  steps: 6,        // 一番外の帯の中を何段に分けて濃くするか
  side: .30,       // 左右の端の暗さ
  sideW: .14,      // 左右にかける幅（画面幅に対する割合）
  /* 上下の端の、完全に真っ黒になる帯（画面の高さに対する割合）。
     **ここは地形を1ドットも計算しない。** 伏せてしまうので計算しても見えない。
     地形は画面のドット1つずつを回す一番重い所なので、
     削った帯のぶんがそのまま発熱の削減になる。 */
  black: .055,
};
const TILT_C=document.createElement('canvas'), TILT_X=TILT_C.getContext('2d');
/* 左右の暗がりは1枚焼いて貼るだけ（横方向は毎フレーム変わらない）。 */
const SIDE_C=document.createElement('canvas');
function sideSprite(){
  if(SIDE_C.width) return SIDE_C;
  const N=64; SIDE_C.width=N; SIDE_C.height=1;
  const c=SIDE_C.getContext('2d');
  const g=c.createLinearGradient(0,0,N,0);
  for(let i=0;i<=8;i++){ const t=i/8; g.addColorStop(t, 'rgba(0,0,0,'+(CAVE_VIG.side*Math.pow(1-t,1.7)).toFixed(3)+')'); }
  c.fillStyle=g; c.fillRect(0,0,N,1);
  return SIDE_C;
}
function extraTilt(){
  if(!CAVE.on||S.screen!=='game') return;
  const W0=cv.width, H0=cv.height, T0_=CAVE_TILT, n=T0_.strips, V=CAVE_VIG;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled=true; TILT_X.imageSmoothingEnabled=true;
  for(const side of [-1,1]){
    const edge=(.5+side*T0_.band/2)*H0, span=T0_.fade*H0;
    for(let k=0;k<n;k++){
      const s0=k/n, s1=(k+1)/n;
      const y0=side<0? edge-span*s1 : edge+span*s0, y1=side<0? edge-span*s0 : edge+span*s1;
      let a=Math.max(0,Math.min(H0,y0)), b=Math.max(0,Math.min(H0,y1));
      const outer = (k===n-1);
      if(outer){ if(side<0) a=0; else b=H0; }
      const h=Math.round(b-a); if(h<=0) continue;
      const t=(k+.5)/n, dark=V.max*Math.pow(t,V.pow);
      // 伏せてしまう一番外の帯はぼかさない（ぼけているかどうか読めないので）
      if(!(outer && dark>=V.skipBlur)){
        const f=1+t*(T0_.strength-1), sw=Math.max(1,Math.round(W0/f)), pad=Math.ceil(f*2);
        const ya=Math.max(0,Math.round(a)-pad), hb=Math.min(H0,Math.round(a)+h+pad)-ya, shp=Math.max(1,Math.round(hb/f));
        if(TILT_C.width<sw) TILT_C.width=sw; if(TILT_C.height<shp) TILT_C.height=shp;
        TILT_X.clearRect(0,0,sw,shp);
        TILT_X.drawImage(cv,0,ya,W0,hb,0,0,sw,shp);
        const sy=(Math.round(a)-ya)/hb*shp, shh=h/hb*shp;
        ctx.drawImage(TILT_C,0,sy,sw,shh,0,Math.round(a),W0,h);
      }
      // 伏せる。一番外の帯は背が高いので、中を何段かに分けて濃くしていく
      ctx.fillStyle='#000';
      if(outer && h>8){
        const m=V.steps;
        for(let j=0;j<m;j++){
          const u0=j/m, u1=(j+1)/m;
          // side<0（上側）は a が画面の上端なので、外へ行くほど j が小さい側になる
          const p0=side<0? 1-u1 : u0, p1=side<0? 1-u0 : u1;
          const tt=t+(1-t)*((p0+p1)/2);
          const yy=Math.round(a+h*Math.min(p0,p1)), hh=Math.max(1,Math.round(h*(u1-u0)));
          ctx.globalAlpha=Math.min(1, V.max*Math.pow(tt,V.pow));
          ctx.fillRect(0,yy,W0,hh);
        }
        ctx.globalAlpha=1;
      }else if(dark>.004){
        ctx.globalAlpha=dark; ctx.fillRect(0,Math.round(a),W0,h);
      }
      ctx.globalAlpha=1;
    }
  }
  /* 上下のいちばん端は真っ黒で伏せる。地形側がこの帯を計算していないので、
     ここは**必ず**塗る（塗り残すと、消し色のままの帯が出る）。 */
  if(V.black>0){
    const hb2=Math.round(H0*V.black);
    ctx.globalAlpha=1; ctx.fillStyle='#000';
    ctx.fillRect(0,0,W0,hb2); ctx.fillRect(0,H0-hb2,W0,hb2);
  }
  // 左右の端。焼いたグラデーションを margin のぶんだけ貼る（中央は触らない）
  if(V.side>0 && V.sideW>0){
    const sp=sideSprite(), wpx=Math.round(W0*V.sideW);
    ctx.drawImage(sp,0,0,sp.width,1, 0,0, wpx,H0);
    ctx.save(); ctx.translate(W0,0); ctx.scale(-1,1);
    ctx.drawImage(sp,0,0,sp.width,1, 0,0, wpx,H0);
    ctx.restore();
  }
  ctx.restore();
}
function screenU(a,b){
  const ar=a&255, ag=(a>>8)&255, ab=(a>>16)&255, br=b&255, bg=(b>>8)&255, bb=(b>>16)&255;
  const r=255-(((255-ar)*(255-br))>>8), g=255-(((255-ag)*(255-bg))>>8), bl=255-(((255-ab)*(255-bb))>>8);
  return (0xff000000|(bl<<16)|(g<<8)|r)>>>0; }
function mulU(c,f){ return (0xff000000|(Math.min(255,((c>>16)&255)*f)<<16)|(Math.min(255,((c>>8)&255)*f)<<8)|Math.min(255,(c&255)*f))>>>0; }
function mixU(a,b,t){ const u=1-t; return (0xff000000|((((a>>16)&255)*u+((b>>16)&255)*t)<<16)|((((a>>8)&255)*u+((b>>8)&255)*t)<<8)|(((a&255)*u+(b&255)*t)|0))>>>0; }
const LIGHT_A=.64, LIGHT_CORE=.22;   // 明かりの濃さ（1で元）／中央の最も明るい所の広さ（半径に対する割合）

/* ---------- 地形ハザードの色（面として描く） ---------- */
const HZ={
  water:{ramp:cs(['#0a2230','#103650','#1a5070','#3a88b0']), hi:C('#c8f0ff'), glow:false},
  lava:{ramp:cs(['#6a1a08','#b0360e','#e8661a','#ffb040']), hi:C('#fff0b0'), glow:true},
  poison:{ramp:cs(['#15240f','#243c18','#3a5a24','#6a9a3a']), hi:C('#b8e070'), glow:false},
  spore:{ramp:cs(['#1a1428','#2a2040','#44345e','#7a5ea0']), hi:C('#e8c0ff'), glow:false},
  grit:{ramp:cs(['#1a1814','#2e2a22','#4a4436','#8a806a']), hi:C('#e0d6b4'), glow:false},
  slick:{ramp:cs(['#101c28','#1a3044','#2a4a68','#5a8ab0']), hi:C('#e8f6ff'), glow:false},
  void_:{ramp:cs(['#0a0614','#160c28','#2a1848','#5a3a90']), hi:C('#e0ccff'), glow:true},
};

/* ---------- 階ごとの岩の形（遅延で 32×32 ドットずつ作る） ---------- */
let G=null;
const OFF=[];for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.hypot(dx,dy);if(d>0&&d<=4.3)OFF.push([dx,dy,Math.max(1,Math.round(d))]);}
OFF.sort((a,b)=>a[2]-b[2]);
function wallAt(f,tx,ty){ if(tx<0||ty<0||tx>=f.W||ty>=f.H) return 1; return f.g[ty][tx]===T.WALL?1:0; }
function cache(f,Z){
  if(G && G.f===f) return G;
  const PW=f.W*Q, PH=f.H*Q, L=lookOf(Z);
  let hasPit=false; for(let y=0;y<f.H&&!hasPit;y++)for(let x=0;x<f.W;x++)if(f.g[y][x]===T.PIT){hasPit=true;break;}
  G={f,Z,L,P:prep(L),PW,PH,code:new Uint8Array(PW*PH),nx:new Int8Array(PW*PH),ny:new Int8Array(PW*PH),
     cw:Math.ceil(PW/32),ch:Math.ceil(PH/32),done:null,hasPit};
  G.done=new Uint8Array(G.cw*G.ch); G.obs=new Map();
  motes.length=0;
  return G;
}
function field(f,L,px,py){
  const wi=((py&255)<<8)|(px&255), wj=(((py+97)&255)<<8)|((px+151)&255);
  const u=(px+.5)/Q-.5+(NZB[wi]-.5)*L.warp, v=(py+.5)/Q-.5+(NZB[wj]-.5)*L.warp, x0=Math.floor(u), y0=Math.floor(v), fx=u-x0, fy=v-y0;
  const a=wallAt(f,x0,y0), b=wallAt(f,x0+1,y0), c=wallAt(f,x0,y0+1), d=wallAt(f,x0+1,y0+1);
  const bl=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
  // マスの中心あたりは、崩さずに元の床／壁のまま（立てる場所を岩が覆わない）
  const u0=(px+.5)/Q-.5, v0=(py+.5)/Q-.5, x1=Math.floor(u0), y1=Math.floor(v0), gx=u0-x1, gy=v0-y1;
  const b0=(wallAt(f,x1,y1)*(1-gx)+wallAt(f,x1+1,y1)*gx)*(1-gy)+(wallAt(f,x1,y1+1)*(1-gx)+wallAt(f,x1+1,y1+1)*gx)*gy;
  if(b0<=.16) return 0;
  if(b0>=.84) return 1;
  if(bl===0||bl===1) return bl;
  return bl+(L.nz[((py&255)<<8)|(px&255)]-.5)*L.amp;
}
function buildChunk(ci,cj){
  const {f,L,PW,PH,code,nx,ny}=G, M=6, S=32+M*2;
  const X0=ci*32-M, Y0=cj*32-M, F=new Float32Array(S*S), so=new Uint8Array(S*S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const v=field(f,L,X0+x,Y0+y);F[y*S+x]=v;so[y*S+x]=v>.5?1:0;}
  for(let y=M;y<M+32;y++)for(let x=M;x<M+32;x++){
    const wx=X0+x, wy=Y0+y; if(wx>=PW||wy>=PH) continue;
    const i=wy*PW+wx, l=y*S+x;
    if(!so[l]){code[i]=0;continue;}
    let dmin=5; for(const [dx,dy,d] of OFF){ if(!so[l+dy*S+dx]){dmin=d;break;} }
    code[i]=dmin;
    if(dmin<5){const gx=F[l+1]-F[l-1], gy=F[l+S]-F[l-S], gl=Math.hypot(gx,gy)||1;
      nx[i]=Math.round(-gx/gl*127); ny[i]=Math.round(-gy/gl*127);}
  }
  G.done[cj*G.cw+ci]=1;
}
function ensure(px0,py0,px1,py1){
  const i0=Math.max(0,px0>>5), i1=Math.min(G.cw-1,px1>>5), j0=Math.max(0,py0>>5), j1=Math.min(G.ch-1,py1>>5);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) if(!G.done[j*G.cw+i]) buildChunk(i,j);
}
function seenTile(tx,ty){ const r=W.seen[ty]; return r?(r[tx]?1:0):0; }
function seenV(px,py){ // 0..1。探索済みの縁ほど小さい
  const u=(px+.5)/Q-.5, v=(py+.5)/Q-.5, x0=Math.floor(u), y0=Math.floor(v);
  // ここも1ドットごと。行は2本しか要らないので、4回引き直さず1度だけ取る。
  const sn=W.seen, r0=sn[y0], r1=sn[y0+1], x1=x0+1;
  const a=(r0&&r0[x0])?1:0, b=(r0&&r0[x1])?1:0, c=(r1&&r1[x0])?1:0, d=(r1&&r1[x1])?1:0;
  const s=a+b+c+d; if(s===4) return 1; if(s===0) return 0;
  const fx=u-x0, fy=v-y0;
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy + (NZB[((py&255)<<8)|(px&255)]-.5)*.35;
}
function seenAt(f,L,px,py){ return seenV(px,py)>.5; }
/* 縁を1マスかけて網点で消していく（パキッと切らない） */
const SEEN_LO=.22, SEEN_HI=.78;
/* この2つは**画面のドット1つごとに**呼ばれる（1フレームで数十万回）。
   中で (x,y)=>... の小さな関数を毎回作っていたが、呼ぶ回数がこれだけ多いと
   その作り直しだけで効いてくる（プロファイルでも hazAt 5.7% / 無名の k 1.5%）。
   やっていることは4点の読み出しなので、その場に開いてある。 */
function tileKindAt(f,px,py,kind){ // マスの種類の滑らかな縁（穴）
  const u=(px+.5)/Q-.5, v=(py+.5)/Q-.5, x0=Math.floor(u), y0=Math.floor(v), fx=u-x0, fy=v-y0;
  const x1=x0+1, y1=y0+1, W=f.W, H=f.H, g=f.g;
  const r0 = (y0<0||y0>=H) ? null : g[y0];
  const r1 = (y1<0||y1>=H) ? null : g[y1];
  const a = (r0 && x0>=0 && x0<W && r0[x0]===kind)?1:0;
  const b = (r0 && x1>=0 && x1<W && r0[x1]===kind)?1:0;
  const c = (r1 && x0>=0 && x0<W && r1[x0]===kind)?1:0;
  const d = (r1 && x1>=0 && x1<W && r1[x1]===kind)?1:0;
  if(a+b+c+d===0) return 0;
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy + (NZ[((py&255)<<8)|(px&255)]-.5)*.45;
}
function hazAt(g,px,py){
  const u=(px+.5)/Q-.5, v=(py+.5)/Q-.5, x0=Math.floor(u), y0=Math.floor(v), fx=u-x0, fy=v-y0;
  const x1=x0+1, r0=g[y0], r1=g[y0+1];
  const a = (r0 && r0[x0])?1:0, b = (r0 && r0[x1])?1:0;
  const c = (r1 && r1[x0])?1:0, d = (r1 && r1[x1])?1:0;
  const s4=a+b+c+d;
  if(s4===0) return 0;
  if(s4===4) return 1;
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy + (NZS[((py&255)<<8)|(px&255)]-.5)*.5;
}

/* ---------- 光 ---------- */
const NA=720, ray=new Float32Array(NA);
let lampX=0, lampY=0, Rpx=100, shadowOn=true, flatL=.45;
function castRays(Rm){
  const {code,PW,PH}=G;
  for(let a=0;a<NA;a++){const ang=a/NA*6.2831853-Math.PI, cx=Math.cos(ang), cy=Math.sin(ang); let t=1;
    for(;t<Rm;t+=1){const x=(lampX+cx*t)|0, y=(lampY+cy*t)|0; if(x<0||y<0||x>=PW||y>=PH||code[y*PW+x])break;} ray[a]=t;}
}
/* 世界の位置（マス単位）の明るさ 0..1。敵の塗りに使う。 */
CAVE._G=()=>G;
CAVE._sprite=(e)=>{ const r=renderFoe(e,true); return r?SPR.cv.toDataURL():null; };
CAVE.lightAt=function(xT,yT){
  if(!G) return 1;
  if(!shadowOn) return flatL+.25;
  const dx=xT*Q-lampX, dy=yT*Q-lampY, d=Math.hypot(dx,dy); let L=0;
  if(d<Rpx){const a=((Math.atan2(dy,dx)+Math.PI)/6.2831853*NA|0)%NA; if(d<=ray[a]+6) L=Math.pow(1-d/Rpx,1.1);}
  for(const m of CAVE.emit){const e=Math.hypot(xT*Q-m.x,yT*Q-m.y); if(e<m.r) L=Math.max(L,(1-e/m.r)*m.it*.8);}
  return L;
};

/* ---------- 地形を描く（draw() のマス塗りの代わり） ---------- */
const bufC=document.createElement('canvas'), bufX=bufC.getContext('2d');
let bw=0,bh=0,img=null,buf=null,cool=null;
let T0=performance.now();
CAVE.terrain=function(f,Z,camX,camY,blinded){
  try{ return terrain(f,Z,camX,camY,blinded); }catch(err){ console.error(err); CAVE.on=false; return false; }
};
function terrain(f,Z,camX,camY,blinded){
  cache(f,Z);
  const L=G.L, Pp=G.P, t=(performance.now()-T0)/1000;
  const ps=TS/Q;
  const nbw=Math.ceil(innerWidth/ps)+3, nbh=Math.ceil(innerHeight/ps)+3;
  if(nbw!==bw||nbh!==bh){bw=nbw;bh=nbh;bufC.width=bw;bufC.height=bh;img=bufX.createImageData(bw,bh);buf=new Uint32Array(img.data.buffer);cool=new Float32Array(bw*bh);}
  const bx0=Math.floor(camX/ps)-1, by0=Math.floor(camY/ps)-1;
  // ランタン
  lampX=P.x*Q; lampY=P.y*Q-4;
  cache(f,Z); ensure((lampX|0)-16,(lampY|0)-16,(lampX|0)+16,(lampY|0)+16);
  if(G.code[(lampY|0)*G.PW+(lampX|0)]){ outer: for(let r=1;r<14;r++) for(let a=0;a<16;a++){ const x=(lampX+Math.cos(a*.3927)*r)|0, y=(lampY+Math.sin(a*.3927)*r)|0; if(x>=0&&y>=0&&x<G.PW&&y<G.PH&&!G.code[y*G.PW+x]){ lampX=x; lampY=y; break outer; } } }
  shadowOn=!!L.shadow;
  const flick=CAVE.noFlicker?1:1+.035*Math.sin(t*8.3)+.02*Math.sin(t*21.7);   // noFlicker：画面の明るさを測るテスト用
  Rpx=L.lightT*Q*flick;
  const blindR = blinded ? BLIND_DARK*Q : 1e9;
  if(blinded) Rpx=Math.min(Rpx,BLIND_DARK*Q);
  const Rm=Math.min(Rpx, blindR)+6;
  ensure(Math.min(bx0,(lampX-Rm)|0), Math.min(by0,(lampY-Rm)|0), Math.max(bx0+bw,(lampX+Rm)|0), Math.max(by0+bh,(lampY+Rm)|0));
  if(G.deco) stampRocks();
  if(shadowOn) castRays(Rm);
  // 光る物（前のフレームで集めた分）
  CAVE.emit=CAVE.nextEmit; CAVE.nextEmit=[];
  if(typeof stairRevealed==='function'&&stairRevealed()&&f.stair){ CAVE.emit.push({x:(f.stair.x)*Q,y:(f.stair.y)*Q,r:34,it:.55}); }
  if(G.deco) decoEmit(bx0,by0);
  cool.fill(0);
  for(const m of CAVE.emit){const sx=Math.round(m.x-bx0), sy=Math.round(m.y-by0), r=m.r|0;
    const x0=Math.max(0,sx-r),x1=Math.min(bw-1,sx+r),y0=Math.max(0,sy-r),y1=Math.min(bh-1,sy+r);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-sx,y-sy);if(d<r){const q=1-d/r;cool[y*bw+x]+=m.it*q*q;}}}
  const {code,nx,ny,PW,PH}=G;
  const lit=Pp.lit, rim=Pp.rim, cl=Pp.cool, fl=Pp.floor, dp=Pp.deep, ed=Pp.edge, VOID=Pp.void;
  const R=Rpx, R2=R*R, iFac=NA/6.2831853, flat=!!L.flat, feat=L.feature;
  const haz=W.haz, hz=haz?(HZ[haz.kind]||HZ.poison):null, hg=haz?haz.g:null;
  const fx0=Math.round(bx0*.45), fy0=Math.round(by0*.45);          // 奥の岩影は遅れて流れる
  const stx=f.stair?f.stair.x*Q:-1e9, sty=f.stair?f.stair.y*Q:-1e9;
  let k=0;
  /* 上下の端の「完全に伏せる」帯は1ドットも計算しない（extraTilt が黒で塗る）。
     ここは画面のドットを1つずつ回す一番重い所なので、削った帯がそのまま効く。 */
  const blackPx=Math.round(bh*CAVE_VIG.black), skipBot=bh-blackPx;

  /* ---------- マス単位でまとめて片付ける ----------
     seenV と hazAt は**画面のドット1つずつ**呼ばれていた（1フレームで数十万回）。
     中身は「周りのマスを4点読んで混ぜる」だけなのに、混ぜる必要があるのは
     マスの境目だけで、マスの内側は答えが決まっている。
     そこで可視範囲のマスを1回だけ分類しておき、
       ・周り3×3が全部見えている → seenV は必ず 1（呼ばない）
       ・周り3×3が全部見えていない → 必ず伏せる（呼ばない）
       ・周り3×3にハザードが1つも無い → hazAt は必ず 0（呼ばない）
       ・周り3×3に穴が1つも無い → tileKindAt は必ず 0（呼ばない）
     とする。**境目のマスだけ**今までどおり1ドットずつ混ぜる。
     マスの数は画面のドット数の 1/256 なので、分類そのものは誤差の範囲。 */
  const tx0=(bx0>>4)-1, ty0=(by0>>4)-1;
  const txn=((bx0+bw)>>4)-tx0+2, tyn=((by0+bh)>>4)-ty0+2;
  if(!G.cls||G.cls.length<txn*tyn) G.cls=new Uint8Array(txn*tyn+64);
  const cls=G.cls, sn=W.seen, pitOn=!!G.hasPit;
  for(let j=0;j<tyn;j++){ const ty=ty0+j;
    for(let i=0;i<txn;i++){ const tx=tx0+i;
      let all=1, none=1, haz0=1, pit0=1;
      for(let ddy=-1;ddy<=1;ddy++){
        const srow=sn[ty+ddy], hrow=hg?hg[ty+ddy]:null, grow=pitOn?f.g[ty+ddy]:null;
        for(let ddx=-1;ddx<=1;ddx++){
          if(srow&&srow[tx+ddx]) none=0; else all=0;
          if(hrow&&hrow[tx+ddx]) haz0=0;
          if(grow&&grow[tx+ddx]===T.PIT) pit0=0;
        }
      }
      cls[j*txn+i]=(all?2:(none?0:1)) | (haz0?4:0) | (pit0?8:0);
    } }

  for(let by=0;by<bh;by++){const wy=by0+by, dy=wy-lampY;
    if(by<blackPx||by>=skipBot){ buf.fill(VOID,k,k+bw); k+=bw; continue; }
    const clsRow=((wy>>4)-ty0)*txn - tx0;
    for(let bx=0;bx<bw;bx++,k++){const wx=bx0+bx;
      if(wx<0||wy<0||wx>=PW||wy>=PH){buf[k]=VOID;continue;}
      const cv2=cls[clsRow+(wx>>4)];
      if((cv2&3)===0){ buf[k]=VOID; continue; }                 // 周りが全部未踏
      if((cv2&3)===1){                                          // 境目のマスだけ混ぜる
        const sv=seenV(wx,wy); if(sv<SEEN_HI){ if(sv<=SEEN_LO||(sv-SEEN_LO)/(SEEN_HI-SEEN_LO)<BAYER[((wy&3)<<2)|(wx&3)]){buf[k]=VOID;continue;} } }
      const i=wy*PW+wx, c=code[i], b=BAYER[((wy&3)<<2)|(wx&3)], dx=wx-lampX, d2=dx*dx+dy*dy;
      if(d2>blindR*blindR){buf[k]=VOID;continue;}
      let Lv=0, fc=1;
      if(flat){ Lv=flatL+(d2<1600?.12:0); }
      else if(d2<R2&&(c===0||c<5)){const d=Math.sqrt(d2), a=((Math.atan2(dy,dx)+Math.PI)*iFac|0)%NA, rl=ray[a];
        if(c===0){ if(d<=rl){ const q=d/R; Lv=q<LIGHT_CORE?1:Math.pow((1-q)/(1-LIGHT_CORE),1.15); } }
        else if(d<=rl+c+.5){ Lv=Math.pow(1-d/R,1.1); fc=Math.max(0,-(nx[i]*dx+ny[i]*dy)/(127*(d||1))); }}
      if(blinded&&Lv>0){ const dt_=Math.sqrt(d2)/Q; if(dt_>BLIND_CLEAR) { const q_=Math.max(0,1-(dt_-BLIND_CLEAR)/(BLIND_DARK-BLIND_CLEAR)); Lv*=q_*q_; } }   // 盲目：3マスを越えると暗くなっていく（本編と同じ）
      const Cv=cool[k];
      if(c===0){
        /* ---- 穴（降りる穴・縁の向こう） ---- */
        const sd=(wx-stx)*(wx-stx)+(wy-sty)*(wy-sty);
        if(sd<64){ buf[k]= sd>42 ? (((wx+wy)&1)?Pp.pit:rim[Math.min(4,1+Math.floor(Lv*4+b))]) : (sd<20&&((wx*3+wy*5+((t*6)|0))%11===0)?Pp.pit:0xff020203); continue; }
        if(pitOn&&!(cv2&8)){const pv=tileKindAt(f,wx,wy,T.PIT); if(pv>.5){ buf[k]= pv<.58 ? (((wx+wy)&1)?rim[Math.min(4,1+Math.floor(Lv*4+b))]:Pp.pit) : ((ihash(wx,wy)%211===0)?Pp.pit:0xff020203); continue; }}
        /* ---- 地形ハザード ---- */
        if(hg&&!(cv2&4)){const hv=hazAt(hg,wx,wy); if(hv>.5){
          const tier=(hg[wy>>4]&&hg[wy>>4][wx>>4])|0;
          let lv = hz.glow ? 1+((Math.sin(t*1.6+(wx+wy)*.05)*.5+.5)*1.6+b)|0 : Math.floor(Math.max(Lv,Cv*.8)*4+b*.9);
          if(haz.kind==='water'){ lv-=(tier>=2?1:0); if(tier>=3) lv-=1; }
          lv=Math.max(0,Math.min(3,lv));
          let col=hz.ramp[lv];
          const n=NZB[((wy&255)<<8)|(wx&255)];
          if(hv<.56) col=hz.ramp[Math.min(3,lv+1)];               // 縁
          else if(haz.kind==='water'||haz.kind==='slick'){ if(Math.sin(wy*.28+t*1.4+n*7+Math.sin(wx*.08)*1.5)>.82&&((wx+wy)&1)) col=hz.ramp[Math.min(3,lv+1)]; if(Lv>.2&&ihash(wx,wy+((t*4)|0)*13)%53===0) col=hz.hi; }
          else if(haz.kind==='lava'){ if(Math.abs(NZR[((wy&255)<<8)|(wx&255)]-.5)<.02) col=hz.hi; }
          else if(haz.kind==='poison'||haz.kind==='spore'){ const h=ihash(wx,wy)%97; if(h===0&&Math.sin(t*3+wx)>0) col=hz.hi; }
          else if(haz.kind==='grit'){ if(((wx%5)===0&&(wy%4)===1)||((wx%5)===1&&(wy%4)===2)) col=Lv>.1?hz.hi:hz.ramp[2]; }
          else if(haz.kind==='void_'){ if(ihash(wx,wy)%53===0&&Math.sin(t*4+wx*1.3)>.2) col=hz.hi; }
          buf[k]=col; continue; }}
        /* ---- 床 ---- */
        if(Cv>Lv*.9&&Cv>.02){const lv=Math.floor(Math.min(1,Cv)*5+b); if(lv>0){buf[k]=cl[Math.min(4,lv-1)];continue;}}
        let lv=flat? Math.floor(Lv*7): Math.floor(Lv*7+b);
        // 層の特徴
        if(feat==='crack'&&NZS[(((wy+40)&255)<<8)|((wx+70)&255)]>.55){ const r=Math.abs(NZR[((wy&255)<<8)|(wx&255)]-.5); if(r<.009){ const p=Math.sin(t*1.8+(wx+wy)*.04)*.5+.5; buf[k]=Pp.crack[Math.min(3,(p*2.4+b+ (Lv>.3?1:0))|0)]; continue; } }
        if(feat==='vein'&&NZS[(((wy+40)&255)<<8)|((wx+70)&255)]>.56){ const r=Math.abs(NZR[((wy&255)<<8)|(wx&255)]-.5); if(r<.012){ buf[k]=Pp.vein[Math.min(2,Math.floor(Lv*3+b))]; continue; } }
        if(feat==='masonry'){ const bx2=(wx+((wy>>5)&1)*16)&31; if(((wy&31)===0||bx2===0)&&NZB[((wy&255)<<8)|(wx&255)]>.3){ lv=Math.max(0,lv-1); if(lv===0){buf[k]=fl[0];continue;} } }
        if(lv>0&&feat==='wet'&&lv>=3&&ihash(wx,wy+((t*3)|0)*17)%89===0){buf[k]=rim[3];continue;}
        /* まず灯りの無い地面（影模様・靄・粒）を作り、灯りはその上にスクリーンで重ねる。
           灯りの縁で色がぱきっと切り替わらず、外の青い靄へ溶けていく */
        let base;
        { let done=false;
          if(feat==='mist'){ const m=NZS[((((wy>>1)+50)&255)<<8)|(((wx>>1)+90)&255)]; if(m>.5){ const q=(m-.5)*7; if(q>BAYER[((wy&3)<<2)|(wx&3)]){ base=Pp.mist[Math.min(2,(q*1.4)|0)]; done=true; } } }
          if(!done){ const h=ihash(wx,wy)%997;
            if(h<7) base=Pp.speck;
            else if(h<10&&NZB[((wy&255)<<8)|(wx&255)]>.52) base=Pp.crystal;
            else { const nb=NZB[(((wy+128)&255)<<8)|((wx+64)&255)]; base=fl[nb<.42?0:nb<.58?1:2]; if(flat&&((wx+wy)&3)===0&&nb>.6) base=Pp.speck; } } }
        buf[k]= lv>0 ? (flat? lit[Math.min(6,lv-1)] : screenU(base, Pp.litAdd[Math.min(6,lv-1)])) : base;
        continue;
      }
      /* ---- 壁 ---- */
      if(c<5&&(Lv>0||Cv>.05)&&!flat){
        const fall=c===1?1:c===2?.55:c===3?.3:.15;
        const wl=Math.min(1,Lv*1.25)*(.15+.85*fc)*fall, wc=Math.min(1,Cv)*fall*.9;
        if(wl>=wc){const lv=Math.floor(wl*5.6+b); if(lv>0){
            let col=rim[Math.min(4,lv-1)];
            if(feat==='wet'&&c===1&&lv>=3&&((ihash(wx,wy)+((t*5)|0))%29===0)) col=0xffffffff;       // 濡れた縁のきらめき
            if(feat==='masonry'&&(((wy%6)===0)||(((wx+(((wy/6)|0)&1)*5)%10)===0))) col=rim[Math.max(0,lv-2)];
            buf[k]=col; continue; }}
        else{const lv=Math.floor(wc*5+b); if(lv>0){buf[k]=cl[Math.min(4,lv-1)];continue;}}
      }
      if(feat==='vein'&&c<5){ const r=Math.abs(NZR[((wy&255)<<8)|(wx&255)]-.5); if(r<.02){buf[k]=Pp.vein[0];continue;} }
      if(feat==='crack'&&c>=2){ const r=Math.abs(NZR[((wy&255)<<8)|(wx&255)]-.5); if(r<.006){ const p=Math.sin(t*1.5+wx*.03)*.5+.5; buf[k]=Pp.crack[p>.6?1:0]; continue; } }
      if(c===1){buf[k]=L.dotted?(((wx+wy)&1)?ed[0]:dp[0]):ed[0];continue;}
      if(c===2&&!L.dotted){buf[k]=ed[1];continue;}
      if(feat==='masonry'&&c<5&&(((wy%6)===0)||(((wx+(((wy/6)|0)&1)*5)%10)===0))){buf[k]=ed[2];continue;}
      buf[k]=dp[NZB[((wy&255)<<8)|(wx&255)]>.56?1:0];
    }}
  if(!G.deco){ G.deco=genDeco(f,Z); G.bats=genBats(f,Z); }
  drawDeco(bx0,by0,t,blindR);
  bufX.putImageData(img,0,0);
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(bufC,0,0,bw,bh,bx0*ps-camX,by0*ps-camY,bw*ps,bh*ps);
  ctx.restore();
  return true;
}

/* ---------- 賑やかし（層ごとの小物） ----------
   当たり判定は持たない。床の上に描くだけ。量は少なめ（床20マスに1つ前後）。
   地形と同じバッファに、ランタンの光で陰影を付けて描く。光る物は地形に光を落とす。 */
const hs=(s,i)=>((Math.imul(s^(i*2654435761),2246822519)^(s>>>13))>>>0);
const DC={}; const dcR=a=>cs(a);
const DECO_PAL={
  moss:dcR(['#2a2a14','#6a6428','#b0a044']), mossTip:C('#d8c860'), vine:dcR(['#3a3414','#8a7a2a','#d0bc50']), lime:dcR(['#0e1626','#1c2a42','#324664','#566e90','#8ea6c4']), mistC:C('#3a4a64'),
  reed:dcR(['#2a3020','#56643a','#9aa868']), reedHead:dcR(['#3a3020','#806848','#c8a870']),
  pebble:dcR(['#1a2030','#3a4660','#7a88a8']), boulder:dcR(['#161b2a','#3c465e','#7c86a2']), bone:dcR(['#4a4436','#a89c80','#ece2c8']), crys:dcR(['#1f5a58','#3fae95','#b8fff0']),
  weed:dcR(['#0c2620','#1d4a38','#3a8060']), fish:dcR(['#18282e','#5a7e88','#c8e4ec']), plank:C('#8af0e0'),
  shrimp:dcR(['#301a18','#8a4a3a','#e09a7a']), shell:dcR(['#2a2a30','#8a8078','#e0d4c0']),
  shroomStem:dcR(['#3a3028','#8a8068','#d8d0b0']), shroomCap:dcR(['#2a4a10','#78b02a','#d8ff90']), shroomCap2:dcR(['#3a1a4a','#9a5ac0','#f0c0ff']),
  tendril:dcR(['#2a0e10','#5a1e20','#8a3a30']), bulb:dcR(['#3a1014','#8a2a2a','#ff8a6a']),
  stone:dcR(['#1c1914','#5a5040','#b0a080']), stoneDk:C('#0e0c0a'), lamp:C('#ffd878'), lampDim:C('#8a6a30'),
  pipe:dcR(['#1a1010','#4a3028','#8a6048']), hot:dcR(['#6a1a08','#e0661a','#ffd070']), slag:dcR(['#140a08','#2e1a14','#4e3024']),
  pale:dcR(['#8e8c86','#c8c5be','#f4f2ec']), paleDk:C('#6e6c66'),
  /* 石の層の深い側（第6階層〜）。水の層が近づいてきた気配を床に置く。 */
  /* 床（石の層は #0f192b〜#16243d の青）に対して、**寒色の中に置く暖色の緑**に
     しないと沈んで見えない。最初に彩度を落として置いたら、床と見分けが付かなかった。 */
  mossBed:dcR(['#1b2714','#33491f','#587536']), mossBedTip:C('#87a850'),
  /* 水溜りは逆に、床より**暗く**してから縁と照り返しで拾わせる。
     床と同じ明るさの青を置くと、ただの模様になる。 */
  pool:dcR(['#050a13','#0a1422','#122238']), poolLip:C('#5a7ea2'), poolGleam:C('#d6ecf8'),
};
// 層ごとの品目：[名前, 置き場所, 出やすさ]
const DECO_SET={
  /* 4つめは「この深さから出る」最小の階層（省略＝最初から出る）。
     石の層の後半（第6階層〜第10階層）だけ、床に苔の足場と水溜りを混ぜる
     ——次が水の層なので、**床が湿っていく**ことを絵で先に言う（ユーザー要望）。 */
  stone:[['stalagC','corner',.35],['rock','open',.006],['vine','north',.05],['skel','floor',.006],
         ['pool','floor',.016,6],['mossbed','floor',.020,6],
         ['moss','wall',.030],['reed','wall',.016],['pebble','floor',.008]],
  sump:[['weed','water',.030],['fish','water',.016],['plankton','water',.010],['shrimp','floor',.012],['shell','wall',.014]],
  root:[['shroom','wall',.024],['tendril','wall',.026],['bulb','floor',.010],['moss','wall',.014]],
  ruin:[['foundation','floor',.010],['colonnade','wall',.012],['pillar','wall',.022],['brokenwall','wall',.018],['arch','wall',.010],['steps','wall',.009],['lamppost','wall',.012],['plaque','floor',.008],['rubble','floor',.010]],
  furnace:[['boiler','wall',.014],['pipe','wall',.024],['slag','floor',.012],['vent','floor',.010],['gear','floor',.008]],
  pale:[['cairn','floor',.012],['bones','floor',.010],['frame','floor',.006],['palegrass','wall',.018]],
};
const DECO_MUL={stone:2.2,sump:1.1,root:1.0,ruin:1.0,furnace:.9,pale:.45};
function genDeco(f,Z){
  const set=DECO_SET[Z.id]||DECO_SET.stone, out=[], depth=(S.run&&S.run.depth)||1;
  const haz=W.haz, water=haz&&haz.kind==='water'?haz.g:null;
  for(let ty=1;ty<f.H-1;ty++)for(let tx=1;tx<f.W-1;tx++){
    if(f.g[ty][tx]!==T.FLOOR) continue;
    if(f.stair&&Math.hypot(tx+.5-f.stair.x,ty+.5-f.stair.y)<2) continue;
    const inW=water&&water[ty]&&water[ty][tx];
    const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>f.g[ty+dy][tx+dx]===T.WALL||f.g[ty+dy][tx+dx]===T.PIT);
    const hz=haz&&!water&&haz.g[ty]&&haz.g[ty][tx];
    for(let n=0;n<set.length;n++){const [kind,where,p,minDep]=set[n];
      if(minDep && depth<minDep) continue;      // その層の中でも、深い側にだけ出る品目
      const h=hs(tx*92821+ty*68917+depth*31,n+1), r=(h%100000)/100000;
      if(r>=p*(DECO_MUL[Z.id]||1)) continue;
      if(where==='water'&&!inW) continue;
      if(where!=='water'&&(inW||hz)) continue;
      if(where==='wall'&&!nb.length) continue;
      const fl=(x,y)=>f.g[y]&&f.g[y][x]===T.FLOOR, wl=(x,y)=>!f.g[y]||f.g[y][x]===T.WALL;
      const nearStart=f.start&&Math.hypot(tx-f.start.cx,ty-f.start.cy)<3;
      if(where==='open'){ if(nearStart) continue; let ok=true; for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=1;dx++) if(!fl(tx+dx,ty+dy)){ok=false;break;} if(!ok) continue; }
      let cdx=0,cdy=0;
      if(where==='corner'){ if(nearStart) continue; let found=false;
        for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ if(wl(tx+dx,ty)&&wl(tx,ty+dy)&&fl(tx-dx,ty)&&fl(tx,ty-dy)&&fl(tx-dx,ty-dy)&&fl(tx-2*dx,ty)&&fl(tx,ty-2*dy)){cdx=dx;cdy=dy;found=true;break;} }
        if(!found) continue; }
      if(where==='north'&&!wl(tx,ty-1)) continue;
      let x=tx*Q+8+((h>>>8)%7)-3, y=ty*Q+8+((h>>>12)%7)-3, wdx=0, wdy=0;
      if(where==='wall'){ const [dx,dy]=nb[(h>>>16)%nb.length], o=f.g[ty+dy][tx+dx]===T.PIT?2:6; wdx=dx; wdy=dy; x=tx*Q+8+dx*o; y=ty*Q+8+dy*o; }
      if(where==='corner'){ x=tx*Q+8+cdx*3; y=ty*Q+8+cdy*3+2; wdx=cdx; wdy=cdy; }
      if(where==='north'){ x=tx*Q+2+(h>>>8)%12; y=ty*Q-2; wdx=0; wdy=-1; }
      out.push({k:kind,x,y,s:h,wdx,wdy,ok:0}); break; }
  }
  return out;
}
const DEMIT={boiler:[30,.6],crystal:[14,.35],plankton:[18,.4],shroom:[18,.45],bulb:[14,.3],lamppost:[34,.7],vent:[20,.45],slag:[14,.3],pipe:[10,.2]};
function decoEmit(bx0,by0){
  for(const d of G.deco){ const em=DEMIT[d.k]; if(!em||d.ok<0) continue;
    if(d.x<bx0-40||d.y<by0-40||d.x>bx0+bw+40||d.y>by0+bh+40) continue;
    if(!tileSeen(d.x/Q,d.y/Q)) continue;
    CAVE.emit.push({x:d.x,y:d.y-4,r:em[0],it:em[1]*(d.k==='lamppost'?(.9+.1*Math.sin(performance.now()/90+d.s)):1)}); }
}
let DB0x=0,DB0y=0;
function dpf(x,y,c){ x=Math.round(x)-DB0x; y=Math.round(y)-DB0y; if(x>=0&&y>=0&&x<bw&&y<bh) buf[y*bw+x]=c; }
function sh5(r,L,x,y){ const i=Math.floor(Math.min(1,L)*4.99+(BAYER[((y&3)<<2)|(x&3)]-.5)*.9); return r[i<0?0:i>4?4:i]; }
function dp(x,y,c){ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=G.PW||y>=G.PH||G.code[y*G.PW+x]) return; x-=DB0x; y-=DB0y; if(x>=0&&y>=0&&x<bw&&y<bh) buf[y*bw+x]=c; }
function sh3(r,L,x,y){ const i=Math.floor(Math.min(1,L*1.5)*2.99+(BAYER[((y&3)<<2)|(x&3)]-.5)*.9); return r[i<0?0:i>2?2:i]; }
function dl(x0,y0,x1,y1,r,L){ const n=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)))||1; for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*i/n),y=Math.round(y0+(y1-y0)*i/n); dp(x,y,typeof r==='number'?r:sh3(r,L,x,y));} }
function drect(x0,y0,x1,y1,r,L,top){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) dp(x,y,sh3(r,L*(y===y0&&top?1.4:1)*(x===x0?.7:1),x,y)); }
function pxLight(wx,wy){
  if(!shadowOn) return flatL+.2;
  const dx=wx-lampX, dy=wy-lampY, d=Math.hypot(dx,dy); let L=0;
  if(d<Rpx){const a=((Math.atan2(dy,dx)+Math.PI)/6.2831853*NA|0)%NA; if(d<=ray[a]+3) L=Math.pow(1-d/Rpx,1.1);}
  const X=Math.round(wx)-DB0x, Y=Math.round(wy)-DB0y; if(X>=0&&Y>=0&&X<bw&&Y<bh) L=Math.max(L,Math.min(1,cool[Y*bw+X])*.8);
  return L;
}
/* 当たり判定（マス単位の円）。本編の solid() に足す */
function addObs(px,py,rpx){ const o={x:px/Q,y:py/Q,r:Math.max(.12,rpx/Q)}; const t0x=Math.floor(o.x-o.r),t1x=Math.floor(o.x+o.r),t0y=Math.floor(o.y-o.r),t1y=Math.floor(o.y+o.r);
  for(let ty=t0y;ty<=t1y;ty++)for(let tx=t0x;tx<=t1x;tx++){ const k=ty*4096+tx; let a=G.obs.get(k); if(!a) G.obs.set(k,a=[]); a.push(o); } }
function obsHit(x,y){ if(!G||!G.obs||G.f!==W.fl) return false; const a=G.obs.get(Math.floor(y)*4096+Math.floor(x)); if(!a) return false;
  for(const o of a){ const dx=x-o.x, dy=y-o.y; if(dx*dx+dy*dy<o.r*o.r) return true; } return false; }
function stalagCluster(d){ const s=d.s, out=[{x:d.x|0,y:d.y|0,hw:5+s%2,H:22+s%10}];
  const n=1+(s>>>5)%2; for(let i=0;i<n;i++){ const h=hs(s,i+50); out.push({x:(d.x|0)-d.wdx*(6+h%4)+(i?d.wdx*2:0), y:(d.y|0)-d.wdy*(4+(h>>>4)%4)+(i?-d.wdy*6:0), hw:2+h%2, H:9+(h>>>6)%7}); }
  return out.sort((a,b)=>a.y-b.y); }
/* 岩の形（非対称の多角形）。調べた傾向に合わせる：
   ・輪郭は左右非対称。頂点は中心からずらし、左右の肩の高さを変える。曲線ではなく角のある面の折れで作る
   ・面は3つに分ける：上面（いちばん明るい）／光の側の側面（中間）／影の側の側面（暗い）。稜線で面が切り替わる
   ・底は平らに接地させ、影の側と底だけ濃い輪郭を置く（光の側は輪郭を明るくする＝セルアウト）
   ・ひびは面の折れに沿って短く。上面にときどき苔（拠点の岩と同じ） */
function rockPoly(cx,by,w,H,seed){
  const r=k=>(hs(seed,k)%1000)/1000;
  const side=r(1)<.5?-1:1;                                  // 頂点を寄せる側
  const xL=cx-w-(r(2)<.5?1:0), xR=cx+w+(r(3)<.5?1:0);
  const xp=Math.round(cx+side*w*(.25+r(4)*.3)), yp=by-H;
  const hL=Math.round(H*(side<0?.75+r(5)*.15:.35+r(6)*.2)), hR=Math.round(H*(side>0?.75+r(7)*.15:.35+r(8)*.2));
  const midL=[Math.round((xL+xp)/2-r(9)*1.5), Math.round(by-(hL+H)/2-1-r(10)*1.5)];
  const midR=[Math.round((xR+xp)/2+r(11)*1.5), Math.round(by-(hR+H)/2-r(12)*1.5)];
  const poly=[[xL,by],[xL+(r(13)<.5?0:1),by-hL],midL,[xp,yp],midR,[xR-(r(14)<.5?0:1),by-hR],[xR,by]];
  const inside=(x,y)=>{ let c=false; for(let a=0,b=poly.length-1;a<poly.length;b=a++){ const [xa,ya]=poly[a],[xb,yb]=poly[b]; if(((ya>y)!==(yb>y))&&(x<(xb-xa)*(y-ya)/(yb-ya)+xa)) c=!c; } return c; };
  const pix=[], top=new Map();
  for(let y=yp;y<=by;y++)for(let x=xL;x<=xR;x++){ if(y===by||inside(x+.5,y+.5)){ pix.push([x,y]); if(!top.has(x)||y<top.get(x)) top.set(x,y); } }
  const xf=Math.round(xp+side*-(w*.2)+ (r(15)-.5)*2);      // 稜線が地面に降りる所
  return {pix,top,xp,yp,xf,by,H,xL,xR,seed};
}
function rockShape(d){ const s=d.s; return {w:4+s%4, H:7+(s>>>3)%5, two:s%3===0, w2:2+(s>>>6)%2, H2:3+(s>>>7)%3}; }
function stampEll(cx,cy,rx,ry){
  const {code,nx,ny,PW,PH}=G;
  for(let yy=-ry;yy<=ry;yy++)for(let xx=-rx;xx<=rx;xx++){ const ex=xx/(rx+.5), ey=yy/(ry+.5), dd=Math.sqrt(ex*ex+ey*ey); if(dd>1) continue;
    const X=cx+xx, Y=cy+yy; if(X<0||Y<0||X>=PW||Y>=PH) continue; const i=Y*PW+X;
    const e=Math.min(5,1+Math.floor((1-dd)*Math.min(rx,ry)*1.2)); if(code[i]&&code[i]<=e) continue;
    code[i]=e; const l=Math.hypot(ex,ey)||1; nx[i]=Math.round(ex/l*127); ny[i]=Math.round(ey/l*127); }
}
function stampRocks(){
  for(const d of G.deco){ if(d.st||(d.k!=='rock'&&d.k!=='stalag'&&d.k!=='stalagC')) continue;
    const ci=(d.x|0)>>5, cj=(d.y|0)>>5; if(ci<0||cj<0||ci>=G.cw||cj>=G.ch) continue;
    let ok=true; for(let j=cj-1;j<=cj+1;j++)for(let i=ci-1;i<=ci+1;i++) if(i>=0&&j>=0&&i<G.cw&&j<G.ch&&!G.done[j*G.cw+i]) ok=false;
    if(!ok) continue;
    if(G.code[(d.y|0)*G.PW+(d.x|0)]){ d.st=1; d.ok=-1; continue; }   // 壁に掛かる所には置かない
    const x=d.x|0, y=d.y|0;
    if(d.k==='rock'){ const r=rockShape(d);
      const st=(m)=>{ for(const [px,py] of m){ if(px<0||py<0||px>=G.PW||py>=G.PH) continue; const i=py*G.PW+px; if(!G.code[i]){ G.code[i]=5; } } };
      st(rockPoly(x,y,r.w,r.H,d.s).pix); addObs(x,y-2,r.w*.9);
      if(r.two){ st(rockPoly(x+r.w+r.w2+2,y+1,r.w2,r.H2,d.s+7).pix); addObs(x+r.w+r.w2+2,y-1,r.w2); } }
    else if(d.k==='stalagC'){ for(const c of stalagCluster(d)){ stampEll(c.x,c.y,c.hw,Math.max(1,Math.round(c.hw*.55))); addObs(c.x,c.y,c.hw*.9); } }
    else { const w=2+(d.s>>>4)%2; stampEll(x,y-2,w+1,w); }
    d.st=1; d.ok=1; }
}
function rockPx(x,y,nx,ny,edge){ // nx,ny：外向きの法線、edge：縁からの距離（0=縁）
  const Pp=G.P, X=Math.round(x), Y=Math.round(y);
  if(edge<=2){ const dx=X-lampX, dy=Y-lampY, d=Math.hypot(dx,dy)||1;
    if(!G.L.flat&&d<Rpx){ const f=Math.max(0,-(nx*dx+ny*dy)/d), L=Math.pow(1-d/Rpx,1.1)*(.15+.85*f)*(edge===0?1:edge===1?.55:.3), lv=Math.floor(Math.min(1,L*1.25)*5.6+BAYER[((Y&3)<<2)|(X&3)]);
      if(lv>0){ dp(X,Y,Pp.rim[Math.min(4,lv-1)]); return; } }
    dp(X,Y,edge===0?Pp.edge[0]:edge===1?Pp.edge[1]:Pp.edge[2]); return; }
  dp(X,Y,Pp.deep[NZB[((Y&255)<<8)|(X&255)]>.56?1:0]);
}
function drawDeco(bx0,by0,t,blindR){
  DB0x=bx0; DB0y=by0; const P_=DECO_PAL, code=G.code, PW=G.PW;
  for(const d of G.deco){
    if(d.x<bx0-24||d.y<by0-8||d.x>bx0+bw+24||d.y>by0+bh+30) continue;
    if(d.ok===0){ // 岩に埋まっていたら床の側へずらす。ずらしきれなければ出さない
      let x=d.x,y=d.y,okk=-1; for(let i=0;i<10;i++){ const c=code[(y|0)*PW+(x|0)]; if(!c){okk=1;break;} x-=d.wdx||0; y-=d.wdy||0; if(!d.wdx&&!d.wdy) break; }
      d.ok=okk; d.x=x; d.y=y; }
    if(d.ok<0) continue;
    if(!seenAt(G.f,G.L,d.x|0,d.y|0)) continue;
    if(Math.hypot(d.x-lampX,d.y-lampY)>blindR) continue;
    const L=Math.max(.22,pxLight(d.x,d.y)), s=d.s, x=d.x, y=d.y;
    switch(d.k){
    case 'moss': for(let i=0;i<34;i++){const h=hs(s,i),px=x+(h%17)-8,py=y+((h>>>5)%7)-3; dp(px,py,sh3(P_.moss,L,px,py));}
      for(let i=0;i<5;i++){const h=hs(s,i+40); if(Math.sin(t*1.5+i*2+s)>.2) dp(x+(h%13)-6,y+((h>>>5)%5)-3,P_.mossTip);} break;
    case 'reed': { const n=4+s%4, sw=Math.sin(t*1.3+s%7)*1.6;
      for(let i=0;i<n;i++){const h=hs(s,i), bx=x+(i-n/2)*2+(h%2), H=11+h%9;
        for(let j=0;j<H;j++){const q=j/H, px=bx+sw*q*q+(h%3-1)*q*2, py=y-j; dp(px,py,sh3(P_.reed,L*(.6+q*.6),px|0,py|0));}
        const tx=bx+sw+(h%3-1)*2, ty=y-H; dp(tx,ty,sh3(P_.reedHead,L,tx|0,ty|0)); dp(tx,ty-1,sh3(P_.reedHead,L*1.3,tx|0,ty|0)); dp(tx,ty-2,sh3(P_.reedHead,L,tx|0,ty|0));}
      break; }
    case 'pebble': for(let i=0;i<3;i++){const h=hs(s,i),px=x+(h%9)-4,py=y+((h>>>4)%5)-2; rockPx(px,py,-.6,-.8,0); rockPx(px+1,py,.6,-.8,0); rockPx(px,py+1,0,1,1);} break;
    /* 苔の足場：床に貼り付いた低い苔。壁の苔（'moss'）と違って**平ら**に広がる。
       輪郭を崩すのに楕円ではなく1マスずつの判定を使う——平たい面なので、
       縁がきれいな楕円だと「置いた物」に見えてしまう。 */
    case 'mossbed': { const rx=5+s%4, ry=2+(s>>>3)%2;
      for(let dy=-ry;dy<=ry;dy++)for(let dx=-rx;dx<=rx;dx++){
        const nx=dx/rx, ny=dy/ry; const dd=nx*nx+ny*ny;
        if(dd>1) continue;
        const hh=hs(s,(dx+16)*32+(dy+16));
        if(dd>.42 && hh%5<2) continue;                          // 縁を虫食いにする
        const px=x+dx, py=y+dy;
        // 中は平らに塗らない。粒ごとに明るさを散らして、面ではなく「苔」に見せる
        dp(px,py,sh3(P_.mossBed, L*(1-dd*.30)*(.78+(hh>>>4)%4*.11), px,py));
      }
      for(let i=0;i<4;i++){const h=hs(s,i+70), px=x+(h%(rx*2))-rx, py=y+((h>>>5)%(ry*2+1))-ry;
        if(Math.sin(t*1.2+i*2+s)>.25) dp(px,py,P_.mossBedTip);} break; }
    /* 水溜り：浅い窪みに溜まった水。縁を1段明るくして「窪み」だと分からせ、
       面の上を光の筋がゆっくり横切る。波は立てない——流れていない水なので。 */
    case 'pool': { const rx=6+s%5, ry=3+(s>>>3)%2;
      for(let dy=-ry;dy<=ry;dy++)for(let dx=-rx;dx<=rx;dx++){
        const nx=dx/rx, ny=dy/ry, dd=nx*nx+ny*ny;
        if(dd>1) continue;
        const px=x+dx, py=y+dy;
        if(dd>.82){ dp(px,py,P_.poolLip); continue; }            // 縁
        dp(px,py,sh3(P_.pool,Math.min(1,L*1.1)*(.5+dd*.3),px,py));
      }
      // 面をゆっくり横切る光の筋（1本だけ。動かしすぎると「流れている水」になる）
      const gx=x-rx+((t*3.5+s%17)%(rx*2));
      for(let dy=-ry+1;dy<=ry-1;dy++){
        const dx=gx-x+dy*.6, nx=dx/rx, ny=dy/ry;
        if(nx*nx+ny*ny>.72) continue;
        dp(x+dx,y+dy,P_.poolGleam);
      } break; }
    case 'crystal': for(let i=0;i<3;i++){const h=hs(s,i), bx=x-2+i*2, H=3+h%4; for(let j=0;j<H;j++) dp(bx,y-j,P_.crys[j===H-1?2:(Math.sin(t*2+i+s)>.5?1:0)+((j+i)%2&&L>.3?1:0)]);} break;
    case 'weed': { for(let i=0;i<4;i++){const h=hs(s,i), bx=x-4+i*3, H=8+h%8; for(let j=0;j<H;j++){const px=bx+Math.sin(t*2+j*.6+i)*1.2*(j/H); dp(px,y-j,sh3(P_.weed,L+.1,px|0,y-j));}} break; }
    case 'fish': { const R=10+s%10, sp=.5+(s%5)*.12, a=t*sp+(s%628)/100, fx=x+Math.cos(a)*R, fy=y+Math.sin(a*2)*R*.35;
      if(hazAt(W.haz.g,fx|0,fy|0)<=.55) break;
      const vx=-Math.sin(a), dir=vx>0?1:-1, tail=Math.sin(t*14+s)>0?1:0;
      for(let i=-3;i<=3;i++){ dp(fx+i*dir,fy,sh3(P_.fish,L*(i>=0?1.4:1)+.1,(fx|0)+i,fy|0)); if(Math.abs(i)<2) dp(fx+i*dir,fy-1,sh3(P_.fish,L*1.6,(fx|0)+i,fy|0)); if(Math.abs(i)<3) dp(fx+i*dir,fy+1,P_.fish[0]); }
      dp(fx-4*dir,fy-1-tail,P_.fish[1]); dp(fx-4*dir,fy+1-tail,P_.fish[1]); dp(fx-5*dir,fy-2+tail*2,P_.fish[0]); dp(fx+2*dir,fy-1,0xff101418); break; }
    case 'plankton': for(let i=0;i<7;i++){const h=hs(s,i), a=t*.4+h%100, px=x+Math.cos(a+i)*((h%9)+2), py=y+Math.sin(a*1.3+i)*((h>>>4)%5+1); if(Math.sin(t*3+i*1.7)>-.2) dp(px,py,P_.plank);} break;
    case 'shrimp': { const hop=((t+s%10)%3.5)<.25?-2:0, px=x+Math.sin(t*.4+s)*5, py=y+hop;
      dp(px,py,sh3(P_.shrimp,L+.2,px|0,py|0)); dp(px+1,py,sh3(P_.shrimp,L,px|0,py|0)); dp(px+2,py-1,P_.shrimp[1]);
      if(((t*8)|0)%2) {dp(px,py+1,P_.shrimp[0]); dp(px+2,py+1,P_.shrimp[0]);} dp(px-1,py-1,P_.shrimp[2]); break; }
    case 'shell': { dp(x,y,sh3(P_.shell,L*1.4,x,y)); dp(x+1,y,sh3(P_.shell,L,x+1,y)); dp(x,y-1,sh3(P_.shell,L,x,y-1)); dp(x+1,y-1,sh3(P_.shell,L*1.2,x+1,y-1)); dp(x+2,y,P_.shell[0]); dp(x-1,y,P_.shell[0]); break; }
    case 'shroom': { const n=2+s%3, cap=(s>>>3)%2?P_.shroomCap2:P_.shroomCap;
      for(let i=0;i<n;i++){const h=hs(s,i), bx=x-3+i*3+(h%2), H=2+h%4, w=1+h%2, gl=Math.sin(t*1.2+i+s)*.5+.5;
        for(let j=0;j<H;j++) dp(bx,y-j,sh3(P_.shroomStem,L,bx,y-j));
        for(let q=-w;q<=w;q++){ dp(bx+q,y-H,cap[q===0?2:1]); if(Math.abs(q)<w) dp(bx+q,y-H-1,cap[gl>.5?2:1]); } } break; }
    case 'tendril': { const len=9+s%6, dx=-(d.wdx||0), dy=-(d.wdy||0), sw=Math.sin(t*.9+s)*1.4;
      let px=x+(d.wdx||0)*5, py=y+(d.wdy||0)*5;
      for(let j=0;j<len;j++){const q=j/len; px+=dx*1+(dy?sw*.25:0); py+=dy*1+(dx?sw*.25:0)+(dx?.25:0); dp(px,py,sh3(P_.tendril,L*(1.1-q*.5),px|0,py|0)); if(j%4===2) dp(px+1,py,P_.tendril[0]);}
      break; }
    case 'bulb': { const p=1+Math.sin(t*2+s)*.15; for(let yy=-3;yy<=0;yy++)for(let xx=-2;xx<=2;xx++){ if((xx*xx)/(4*p)+((yy+1.5)**2)/(2.8*p)>1) continue; dp(x+xx,y+yy,xx===0&&yy===-2?P_.bulb[2]:sh3(P_.bulb,L+.25,x+xx,y+yy)); } break; }
    case 'pillar': { const H=18+s%12, bx=x-4;
      drect(bx-2,y-2,bx+9,y+1,P_.stone,L*.9,true); drect(bx-1,y-4,bx+8,y-3,P_.stone,L,true);
      for(let j=5;j<H;j++){ const top=j>H-4; for(let q=0;q<8;q++){ if(top&&hs(s,q+j*7)%3===0) continue; const px=bx+q, py=y-j; dp(px,py,(q===2||q===5)?P_.stone[0]:sh3(P_.stone,L*(q<2?1.25:q>6?.6:1),px,py)); } }
      if(s%2){ const fx=x+(s%3?10:-15), fy=y+3; drect(fx,fy-4,fx+7,fy,P_.stone,L,true); dp(fx+2,fy-2,P_.stoneDk); dp(fx+5,fy-2,P_.stoneDk); }
      break; }
    case 'brokenwall': { const w=24+s%14, H=9+s%5;
      for(let yy=0;yy<H;yy++)for(let xx=0;xx<w;xx++){ const px=x-w/2+xx|0, py=y-yy; const edgeH=H-((hs(s,xx)%4)*(xx>w*.6?1:0)); if(yy>=edgeH) continue;
        const mortar=(yy%3===2)||(((xx+((yy/3|0)%2)*3)%6)===0); dp(px,py,mortar?P_.stoneDk:sh3(P_.stone,L*(yy===edgeH-1?1.3:1),px,py)); }
      break; }
    case 'arch': { const w=22, H=24, bx=x-11, broken=s%2;
      drect(bx,y-H,bx+3,y,P_.stone,L*1.1); if(!broken) drect(bx+w-3,y-H,bx+w,y,P_.stone,L*.8); else drect(bx+w-3,y-9,bx+w,y,P_.stone,L*.8);
      for(let xx=0;xx<=(broken?w-5:w);xx++){ dp(bx+xx,y-H-1,sh3(P_.stone,L*1.3,bx+xx,y-H-1)); dp(bx+xx,y-H,sh3(P_.stone,L,bx+xx,y-H)); dp(bx+xx,y-H+1,P_.stoneDk); }
      if(broken) for(let i=0;i<4;i++){const h=hs(s,i); dp(bx+w-3+(h%6),y-(h>>>4)%2,sh3(P_.stone,L,bx+w,y));}
      break; }
    case 'steps': for(let k2=0;k2<4;k2++){ const w=20-k2*4, sy=y-k2*3; for(let xx=0;xx<w;xx++){ dp(x-w/2+xx,sy,sh3(P_.stone,L*1.3,x+xx,sy)); dp(x-w/2+xx,sy+1,P_.stone[0]); } } break;
    case 'lamppost': { dl(x,y,x,y-11,P_.stone,L); dl(x+1,y,x+1,y-11,P_.stone[0],L); dl(x-1,y,x+1,y,P_.stone[0],L); const f=Math.sin(t*9+s)>-.6;
      dp(x-1,y-12,P_.stone[1]); dp(x+1,y-12,P_.stone[1]); dp(x,y-13,f?P_.lamp:P_.lampDim); dp(x,y-12,f?P_.lamp:P_.lampDim); dp(x,y-14,P_.stone[0]); break; }
    case 'plaque': { drect(x-4,y-3,x+3,y+1,P_.stone,L*1.2,true); const miss=s%4;
      for(let i=0;i<4;i++){ if(i===miss) continue; dp(x-3+i*2,y-2,P_.stoneDk); dp(x-3+i*2,y-1,P_.stoneDk); } break; }
    case 'foundation': { const w=36+s%26, h=24+s%18, x0=x-w/2|0, y0=y-h/2|0;
      // 床の敷石の名残
      for(let yy=2;yy<h-2;yy+=5)for(let xx=2;xx<w-2;xx+=5){ if(hs(s,xx*31+yy)%5<2) continue; const px=x0+xx, py=y0+yy; dp(px,py,sh3(P_.stone,L*.8,px,py)); dp(px+1,py,sh3(P_.stone,L*.6,px,py)); }
      // 低い壁の基礎（ところどころ崩れて途切れる）
      const seg=(ax,ay,bx,by)=>{ const n=Math.max(Math.abs(bx-ax),Math.abs(by-ay)); for(let i=0;i<=n;i++){ if(((hs(s,(ax+ay)*7+i>>3))%10)<3) continue; const px=ax+(bx-ax)*i/n|0, py=ay+(by-ay)*i/n|0;
          dp(px,py-2,sh3(P_.stone,L*1.35,px,py)); dp(px,py-1,sh3(P_.stone,L*1.1,px,py)); dp(px,py,sh3(P_.stone,L*.6,px,py)); dp(px,py+1,P_.stoneDk); } };
      seg(x0,y0,x0+w,y0); seg(x0,y0+h,x0+w,y0+h); seg(x0,y0,x0,y0+h); seg(x0+w,y0,x0+w,y0+h);
      if(s%3===0) seg(x0+(w/2|0),y0,x0+(w/2|0),y0+(h*.6|0));
      // 戸口
      const dx0=x0+6+(s>>>5)%(w-16); for(let i=0;i<6;i++) dp(dx0+i,y0+h+1,sh3(P_.stone,L*.5,dx0,y0));
      break; }
    case 'colonnade': { const n=3, ax=-(d.wdy||0), ay=(d.wdx||0), bx=x-(d.wdx||0)*2, by=y-(d.wdy||0)*2;
      for(let i=0;i<n;i++){ if(i===1&&s%3===0) continue; const cx=bx+ax*(i-1)*20|0, cy=by+ay*(i-1)*20|0, H=(i===1?22:12)+hs(s,i)%10;
        for(let yy=0;yy<3;yy++) for(let xx=-5;xx<=5;xx++) dp(cx+xx,cy-yy,sh3(P_.stone,L*(yy===2?1.3:.8),cx+xx,cy));
        for(let j=3;j<H;j++){ const top=j>H-3; for(let q=-3;q<=3;q++){ if(top&&hs(s,q*9+j+i*77)%3===0) continue; dp(cx+q,cy-j,(q===-1||q===2)?P_.stone[0]:sh3(P_.stone,L*(q<-1?1.25:q>2?.6:1),cx+q,cy-j)); } } }
      break; }
    case 'boiler': { const cy=y-11, gl=Math.sin(t*3+s)*.5+.5;
      for(let yy=-10;yy<=10;yy++)for(let xx=-7;xx<=7;xx++){ const nx=xx/7.5, ny=yy/10.5; if(nx*nx+ny*ny>1) continue; const band=(yy===-5||yy===5); dp(x+xx,cy+yy,band?P_.pipe[0]:sh3(P_.pipe,L*(1.1+(-nx)*.5),x+xx,cy+yy)); }
      for(const [rx,ry] of [[-5,-5],[5,-5],[-5,5],[5,5],[0,-9]]) dp(x+rx,cy+ry,P_.pipe[2]);
      for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++) if(xx*xx+yy*yy<=5) dp(x+xx,cy+yy,xx*xx+yy*yy<=1?P_.hot[gl>.5?2:1]:P_.hot[gl>.3?1:0]);
      for(let j=0;j<8;j++){ dp(x+3,cy-10-j,sh3(P_.pipe,L,x,cy)); dp(x+4,cy-10-j,P_.pipe[0]); }
      if(((t*2+s)%2)<.6) dp(x+3+Math.sin(t*5)*1,cy-19-((t*8)%4),P_.hot[1]);
      for(let xx=-8;xx<=8;xx++) dp(x+xx,y,P_.pipe[0]);
      break; }
    case 'rock': {
      const r=rockShape(d), Lr=Math.max(.3,pxLight(x,y+3)*1.15);
      const shade=(cx,by,w,H,seed)=>{
        for(let yy=0;yy<=1;yy++)for(let xx=-w-2;xx<=w+3;xx++){ if((yy>0||Math.abs(xx)>w)&&((cx+xx+by+yy)&1)) continue; dp(cx+xx,by+1+yy,0xff0a080c); }
        const R=rockPoly(cx,by,w,H,seed), litLeft=lampX<cx;       // ランタンのある側の側面が明るい
        const ridge=y2=>R.xp+(R.xf-R.xp)*((y2-R.yp)/Math.max(1,R.by-R.yp));
        const inR=new Set(R.pix.map(([a,b])=>a+','+b));
        for(const [px,py] of R.pix){
          const dTop=py-R.top.get(px), left=px<ridge(py), lit=left===litLeft;
          const onRidge=Math.abs(px-Math.round(ridge(py)))===0&&dTop>1;
          const edgeSide=!inR.has((px-1)+','+py)||!inR.has((px+1)+','+py);
          let I = dTop<=1 ? 1.05 : (lit?.66:.36);
          if(dTop===0) I+=.12;
          if(onRidge) I*=.8;
          let c=sh5(P_.lime,Lr*I,px,py);
          if(py===R.by) c=P_.lime[0];
          else if(edgeSide&&!lit&&dTop>0) c=P_.lime[0];
          else if(edgeSide&&lit&&dTop>0) c=sh5(P_.lime,Lr*.85,px,py);
          dpf(px,py,c); }
        // 面の折れに沿った短いひび
        for(let n=0;n<1+(seed%2);n++){ const h=hs(seed,n+70), sx0=R.xL+2+(h%Math.max(1,(R.xR-R.xL-3))); let yy=R.top.get(sx0)+2, xx=sx0;
          for(let k=0;k<2+(h>>>5)%3;k++){ if(!inR.has(xx+','+yy)||yy>=R.by) break; dpf(xx,yy,P_.lime[0]); yy++; if((h>>>(8+k))&1) xx+=((h>>>12)&1)?1:-1; } }
        // 上面にときどき苔
        if(seed%3===0) for(const [px,py] of R.pix){ if(py-R.top.get(px)===0&&(hs(seed,px)%3)) dpf(px,py,P_.moss[1+(hs(seed,px*5)%2)]); }
      };
      shade(x,y,r.w,r.H,s); if(r.two) shade(x+r.w+r.w2+2,y+1,r.w2,r.H2,s+7);
      break; }
    case 'skel': { // 頭骨と散らばった骨
      const hx=x-3, hy=y-3;
      for(let yy=0;yy<4;yy++)for(let xx=0;xx<5;xx++){ if((yy===0||yy===3)&&(xx===0||xx===4)) continue; dp(hx+xx,hy+yy,sh3(P_.bone,L*(yy<2?1.3:.9),hx+xx,hy+yy)); }
      dp(hx+1,hy+1,P_.bone[0]); dp(hx+3,hy+1,P_.bone[0]); dp(hx+2,hy+3,P_.bone[0]);
      for(let i=0;i<3;i++){ const h=hs(s,i), bx=x+1+(h%7), by=y-1+((h>>>4)%4)-1, ln=3+h%3, dx=((h>>>8)%3)-1, dy=dx?0:1;
        for(let j=0;j<ln;j++) dp(bx+dx*j+(dy?0:0),by+(dy?0:0)+(dx?0:j*0)+(dx?0:0),sh3(P_.bone,L,bx,by));
        dp(bx-dx,by-1+(dx?0:0),P_.bone[2]); dp(bx+dx*ln,by,P_.bone[2]); }
      break; }
    case 'stalag': { const w=2+(s>>>4)%2;
      for(let yy=0;yy<=1;yy++)for(let xx=-w-2;xx<=w+2;xx++){ if(Math.abs(xx)>w&&((x+xx+yy)&1)) continue; dp(x+xx,y+yy,0xff050608); }
      break; }
    case 'stalagC': {
      for(const c of stalagCluster(d)){ const {x:cx,y:cy,hw,H}=c, Lc=Math.max(.25,pxLight(cx,cy+3)*1.1);
        for(let j=0;j<H;j++){ const w=hw*Math.pow(1-j/H,.85); const wi=Math.round(w);
          for(let q=-wi;q<=wi;q++){ const u=wi?q/wi:0, band=(j%6===5)?.75:1;
            const I=Lc*band*(1.15-u*.55)+(j>H-3?.15:0), X=cx+q, Y=cy-j;
            dpf(X,Y,(Math.abs(q)===wi&&wi>0)?P_.lime[0]:sh5(P_.lime,I,X,Y)); } }
        for(let yy=0;yy<=1;yy++)for(let q=-hw-2;q<=hw+2;q++){ if((yy>0||Math.abs(q)>hw)&&((cx+q+cy+yy)&1)) continue; dp(cx+q,cy+1+yy,0xff0a080c); }
        for(let j=0;j<3;j++){ const ext=Math.round((3-j)*1.1); for(let q=hw+1;q<=hw+ext;q++) for(const sg of [-1,1]){ const X=cx+sg*q, Y=cy-j; if((X+Y)&1) continue; dpf(X,Y,sh5(P_.lime,Lc*.55,X,Y)); } }
        for(let i=0;i<3;i++){ const h=hs(d.s,i+c.x*3); dpf(cx+(h%(hw*2+6))-hw-3,cy+1+((h>>>4)%2),sh5(P_.lime,Lc*.7,cx,cy)); }
        for(let i=0;i<3;i++){ const h=hs(d.s,i+c.x); if(h%2) dpf(cx-hw+1+(h%(hw*2)),cy-((h>>>4)%3),P_.moss[1+(h>>>6)%2]); } }
      break; }
    case 'vine': { const len=10+s%14, sw=Math.sin(t*.8+s)*1.2;
      for(let j=0;j<len;j++){ const q=j/len, px=x+Math.sin(j*.9+s)*.8+sw*q*q, py=y+j; dpf(px,py,sh3(P_.vine,L*(1.2-q*.4),px|0,py|0)); if(j%3===1) dpf(px+((j>>1)&1?1:-1),py,P_.vine[2]); }
      break; }
    case 'rubble': for(let i=0;i<5;i++){const h=hs(s,i),px=x+(h%13)-6,py=y+((h>>>4)%7)-3,w=1+h%3; drect(px,py-1,px+w,py,P_.stone,L,true);} break;
    case 'pipe': { const horiz=!d.wdy, len=26+s%16, gl=Math.sin(t*2+s)*.5+.5;
      for(let i=0;i<len;i++){ for(let q=-2;q<=2;q++){ const px=horiz?x-len/2+i:x+q, py=horiz?y+q:y-len/2+i; dp(px,py,q===2?P_.pipe[0]:sh3(P_.pipe,L*(q===-2?1.5:q>=1?.6:1),px|0,py|0)); } }
      for(let i=4;i<len;i+=8){ const px=horiz?x-len/2+i:x, py=horiz?y:y-len/2+i; for(let q=-3;q<=3;q++) dp(horiz?px:px+q,horiz?py+q:py,q===0?P_.hot[gl>.5?2:1]:P_.pipe[1]); }
      break; }
    case 'slag': for(let yy=-5;yy<=0;yy++)for(let xx=-8;xx<=8;xx++){ if(xx*xx/64+(yy+2)*(yy+2)/10>1) continue; const core=Math.abs(xx)<2&&yy>=-1&&Math.sin(t*2+s+xx)>-.3; dp(x+xx,y+yy,core?P_.hot[1]:sh3(P_.slag,L*1.3,x+xx,y+yy)); } break;
    case 'vent': { for(let xx=-3;xx<=3;xx++){ dp(x+xx,y,P_.pipe[0]); dp(x+xx,y-1,xx%2?P_.hot[0]:P_.pipe[1]); dp(x+xx,y-2,P_.pipe[2]); }
      for(let i=0;i<3;i++){ const ph=((t*1.2+i/3+(s%10)/10)%1); dp(x-2+i*2+Math.sin(ph*9+i)*1, y-3-ph*14, ph<.5?P_.hot[2]:P_.hot[1]); } break; }
    case 'gear': { const r=6, rot=(s%10)/10; for(let a=0;a<6.28;a+=.25){ const tooth=((a/6.28*10+rot)%1)<.5, rr=tooth?r+1:r; if(a>4.6&&a<5.6) continue; dp(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.6,sh3(P_.pipe,L*1.2,x,y)); } dp(x,y,P_.pipe[0]); break; }
    case 'cairn': { let yy=y; for(let i=0;i<3+s%2;i++){ const w=3-i*.7|0; drect(x-w,yy-1,x+w,yy,P_.pale,.4,true); yy-=2; } break; }
    case 'bones': { dl(x-4,y,x+3,y-2,P_.pale[2],1); dl(x-3,y-3,x+2,y+1,P_.pale[1],1); dp(x-4,y-1,P_.pale[2]); dp(x+3,y-3,P_.pale[2]); break; }
    case 'frame': { const b=Math.sin(t*1.1+s)*1.5, yy=y-10+b; for(let i=0;i<8;i++){ dp(x-4+i,yy,P_.paleDk); dp(x-4+i,yy+7,P_.paleDk); dp(x-4,yy+i,P_.paleDk); dp(x+3,yy+i,P_.paleDk); } if(((t*2)|0)%3===0) dp(x,y,P_.paleDk); break; }
    case 'palegrass': for(let i=0;i<4;i++){ const h=hs(s,i), bx=x-3+i*2, H=4+h%5; for(let j=0;j<H;j++) dp(bx+Math.sin(t+j*.5+i)*.8*(j/H),y-j,P_.pale[j>H-2?2:1]); } break;
    }
  }
}

/* ---------- 漂う粒（1ドット） ---------- */
const motes=[];
/* ---------- コウモリ（石の層）----------
   部屋の3割ほどに、上の壁際で数匹がぶら下がっている。
   その部屋に初めて入ると（近づくと）驚いて、主人公から離れる向きへ羽ばたいて飛び去る。 */
function genBats(f,Z){
  if(!Z||Z.id!=='stone'||!f.rooms) return [];
  const out=[], depth=(S.run&&S.run.depth)||1;
  f.rooms.forEach((r,i)=>{
    if(f.start&&f.start.cx>=r.x&&f.start.cx<=r.x+r.w&&f.start.cy>=r.y&&f.start.cy<=r.y+r.h) return;   // 最初の部屋は除く
    const h=hs(depth*977+i*131,5); if((h%100)>=30) return;
    const n=3+h%4, bx=r.x+r.w*(.25+((h>>>8)%50)/100), by=r.y+.55;
    const bats=[]; for(let k=0;k<n;k++){ const q=hs(h,k); bats.push({x:(bx+((q%20)-10)/10*.9)*Q, y:(by+((q>>>6)%4)/10)*Q, vx:0, vy:0, ph:(q%628)/100, a:1, dl:((q>>>10)%30)/100}); }
    out.push({r, state:0, t:0, bats});
  });
  return out;
}
const BAT_UP=[[-3,-2],[3,-2],[-2,-1],[2,-1],[-1,0],[0,0],[1,0],[0,1]], BAT_MID=[[-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[3,0],[0,1]], BAT_DN=[[-1,0],[0,0],[1,0],[0,1],[-2,1],[2,1],[-3,2],[3,2]], BAT_HANG=[[-1,-1],[1,-1],[0,0],[-1,1],[0,1],[1,1],[0,2]];
function batStep(dt){
  if(!G||!G.bats||!G.bats.length) return;
  const ps=TS/Q, camX=P.x*TS-innerWidth/2, camY=P.y*TS-innerHeight/2;
  ctx.save();
  for(const c of G.bats){
    if(c.state===2) continue;
    const r=c.r, inside=P.x>=r.x-.5&&P.x<=r.x+r.w+.5&&P.y>=r.y-.5&&P.y<=r.y+r.h+.5;
    if(c.state===0&&(inside||Math.hypot(P.x*Q-c.bats[0].x,P.y*Q-c.bats[0].y)<4*Q)){ c.state=1; c.t=0; }
    if(c.state===1){ c.t+=dt; if(c.t>3.4){ c.state=2; continue; } }
    for(const b of c.bats){
      if(!tileSeen(b.x/Q,b.y/Q+.6)&&c.state===0) continue;
      let shape=BAT_HANG, alpha=1;
      if(c.state===1){ const tt=c.t-b.dl; if(tt>0){
          if(!b.go){ b.go=1; let dx=b.x-P.x*Q, dy=b.y-P.y*Q; const l=Math.hypot(dx,dy)||1; b.vx=dx/l*50+(Math.random()-.5)*40; b.vy=Math.min(-20,dy/l*50)-25; }
          b.ph+=dt*22; b.vx+=Math.sin(b.ph*.37)*120*dt; b.vy+=Math.cos(b.ph*.29)*90*dt-20*dt;
          const sp=Math.hypot(b.vx,b.vy), mx=95; if(sp>mx){ b.vx*=mx/sp; b.vy*=mx/sp; }
          b.x+=b.vx*dt; b.y+=b.vy*dt;
          const f=((b.ph/3.14)|0)%3; shape=f===0?BAT_UP:f===1?BAT_MID:BAT_DN;
          alpha=Math.max(0,Math.min(1,(3.1-tt)/.8)); } }
      if(alpha<=0) continue;
      const lit=CAVE.lightAt(b.x/Q,b.y/Q);
      ctx.globalAlpha=alpha; ctx.fillStyle=lit>.35?'#9a8e94':lit>.12?'#6a5e66':'#4a4048';   // 暗がりでも影絵として読める明るさ
      const sx=Math.round(b.x*ps-camX), sy=Math.round(b.y*ps-camY), q=Math.ceil(ps);
      for(const [x,y] of shape) ctx.fillRect(sx+Math.round(x*ps),sy+Math.round(y*ps),q,q);
    }
  }
  ctx.restore();
}
function airStep(Z,dt){
  batStep(dt||0.016);
  if(!G) return;
  const L=lookOf(Z), Pp=G.P, ps=TS/Q, t=(performance.now()-T0)/1000;
  const cx=P.x*Q, cy=P.y*Q, hw=innerWidth/ps/2+12, hh=innerHeight/ps/2+12;
  while(motes.length<90) motes.push({x:cx+(Math.random()*2-1)*hw, y:cy+(Math.random()*2-1)*hh, ph:Math.random()*9, sp:.5+Math.random()});
  const kind=L.air;
  ctx.save();
  for(const m of motes){
    m.ph+=dt*m.sp;
    if(kind==='ember'){ m.y-=dt*14*m.sp; m.x+=Math.sin(m.ph*1.3)*dt*6; }
    else if(kind==='bubble'){ m.y-=dt*5*m.sp; m.x+=Math.sin(m.ph*2)*dt*3; }
    else if(kind==='dust'){ m.y+=dt*2.5*m.sp; m.x+=Math.sin(m.ph*.5)*dt*2; }
    else if(kind==='spore'){ m.x+=Math.sin(m.ph*.7)*dt*5; m.y+=Math.cos(m.ph*.5)*dt*4; }
    else if(kind==='flake'){ m.y+=dt*4*m.sp; m.x+=Math.sin(m.ph)*dt*4; }
    else { m.x+=Math.sin(m.ph*.7)*dt*4; m.y+=Math.cos(m.ph*.5)*dt*3; }
    if(m.x<cx-hw)m.x+=hw*2; if(m.x>cx+hw)m.x-=hw*2; if(m.y<cy-hh)m.y+=hh*2; if(m.y>cy+hh)m.y-=hh*2;
    if(!tileSeen(m.x/Q,m.y/Q)) continue;
    const tw=Math.sin(m.ph*3); if(tw<.1 && kind!=='ember') continue;
    const lit=CAVE.lightAt(m.x/Q,m.y/Q);
    const col=(lit>.2||tw>.85||kind==='ember'||kind==='spore')?L.mote[0]:L.mote[1];
    ctx.fillStyle=col;
    const camX=P.x*TS-innerWidth/2, camY=P.y*TS-innerHeight/2;
    ctx.fillRect(Math.round(m.x*ps-camX),Math.round(m.y*ps-camY),Math.ceil(ps),Math.ceil(ps));
  }
  ctx.restore();
}

/* =====================================================================
   敵のドット絵（手続きで描く）
   ---------------------------------------------------------------------
   右向き・足元を (0,0)・上がマイナスの座標で描く。k は拡大（中ボスは3倍前後）。
   体の塗りはランタンの向きで陰影を付け、目や発光部だけは暗がりでも光る。
   ===================================================================== */
const FAM_PAL={
  beast: {o:'#141018',d:'#3a3440',b:'#8a7a68',h:'#c9b48e',ld:'#2e2830',l:'#5a4e48',lh:'#8a7a68',e:'#ffcf6a',g:'#e6cf94',w:'#d8d0c0'},
  slime: {o:'#081414',d:'#1d3a3a',b:'#3f7a6e',h:'#8fd8c0',ld:'#16302c',l:'#2c5a52',lh:'#4a8a7c',e:'#e8fff4',g:'#6ff0d0',w:'#c8e8e0'},
  arcane:{o:'#120c08',d:'#2a1e1a',b:'#5a4a2a',h:'#9ab050',ld:'#241810',l:'#3e2c20',lh:'#6a5030',e:'#e0ff7a',g:'#b8f060',w:'#e0d8b0'},
  armor: {o:'#121014',d:'#2e2c30',b:'#6e6a64',h:'#b8b0a0',ld:'#262428',l:'#4a4640',lh:'#7a7468',e:'#ffd27a',g:'#f0c060',w:'#d8d0c0'},
  flame: {o:'#100606',d:'#2a1010',b:'#5a2418',h:'#a84020',ld:'#200a08',l:'#3a1a14',lh:'#6a2a18',e:'#ffe08a',g:'#ff8a30',w:'#ffd0a0'},
  frost: {o:'#6a6a76',d:'#9a9aa2',b:'#cfcfd4',h:'#f4f4f6',ld:'#8a8a94',l:'#a8a8b0',lh:'#c8c8d0',e:'#2a2a38',g:'#ffffff',w:'#ffffff',soft:true},
  storm: {o:'#0e0e14',d:'#2a2a34',b:'#6a6e80',h:'#c0c8dc',ld:'#22222c',l:'#44485a',lh:'#6a7088',e:'#ffe860',g:'#fff080',w:'#e0e4f0'},
  undead:{o:'#100e0e',d:'#2e2a28',b:'#8a8070',h:'#c8bca4',ld:'#26221e',l:'#5a5048',lh:'#8a8070',e:'#9fe0ff',g:'#7fd0e0',w:'#e0d8c8'},
};
const palCache=new Map();
function palOf(fam,uniq){
  const key=fam+(uniq?'!':''); let p=palCache.get(key); if(p) return p;
  const s=FAM_PAL[fam]||FAM_PAL.beast;
  p={o:C(s.o),B:cs([s.d,s.b,s.h]),L:cs([s.ld,s.l,s.lh]),W:cs([s.b,s.h,s.w]),e:C(uniq?'#ff3a8a':s.e),g:C(uniq?'#ff6ab0':s.g),
     G:cs(uniq?['#5a1030','#b02a6a','#ff6ab0']:[s.d,s.g,s.w]),w:C(s.w),soft:!!s.soft,raw:s};
  palCache.set(key,p); return p;
}
/* 描き手 */
const SPR={N:0,cv:document.createElement('canvas'),id:null,u32:null};
SPR.cx=SPR.cv.getContext('2d');
const PT={k:1,ox:0,oy:0,N:0,lx:.6,ly:-.5,lz:.6,lit:1,glows:[]};
function sBegin(N,k,lx,ly,lit){
  if(SPR.N!==N){SPR.N=N;SPR.cv.width=SPR.cv.height=N;SPR.id=SPR.cx.createImageData(N,N);SPR.u32=new Uint32Array(SPR.id.data.buffer);}
  else SPR.u32.fill(0);
  PT.N=N;PT.k=k;PT.ox=N/2;PT.oy=N-Math.max(3,Math.round(3*k));const l=Math.hypot(lx,ly)||1;PT.lx=lx/l;PT.ly=ly/l;PT.lit=lit;PT.glows.length=0;
}
function put(X,Y,c){ if(X>=0&&Y>=0&&X<PT.N&&Y<PT.N) SPR.u32[Y*PT.N+X]=c; }
const sx_=x=>Math.round(PT.ox+x*PT.k), sy_=y=>Math.round(PT.oy+y*PT.k);
function dot(x,y,c){ const s=Math.max(1,Math.round(PT.k)),X=sx_(x),Y=sy_(y); for(let j=0;j<s;j++)for(let i=0;i<s;i++)put(X+i,Y+j,c); }
function glow(x,y,c,sz=1){ PT.glows.push([x,y,c,sz]); }
function shadeIdx(I,X,Y){ return Math.max(0,Math.min(2,Math.floor(I*3+(BAYER[((Y&3)<<2)|(X&3)]-.5)*.7))); }
function ell(cx,cy,rx,ry,ramp,emis){
  const k=PT.k, X0=Math.floor(PT.ox+(cx-rx)*k), X1=Math.ceil(PT.ox+(cx+rx)*k), Y0=Math.floor(PT.oy+(cy-ry)*k), Y1=Math.ceil(PT.oy+(cy+ry)*k);
  const ccx=PT.ox+cx*k, ccy=PT.oy+cy*k, amb=emis?.45:.16+.22*PT.lit, dif=emis?.55:.22+.78*PT.lit;
  for(let Y=Y0;Y<=Y1;Y++)for(let X=X0;X<=X1;X++){const nx=(X+.5-ccx)/(rx*k), ny=(Y+.5-ccy)/(ry*k), d=nx*nx+ny*ny; if(d>1) continue;
    const nz=Math.sqrt(1-d), I=amb+dif*Math.max(0,nx*PT.lx*.8+ny*PT.ly*.8+nz*.5);
    put(X,Y,ramp[shadeIdx(I,X,Y)]);}
}
function hole(cx,cy,rx,ry,c){ const k=PT.k,ccx=PT.ox+cx*k,ccy=PT.oy+cy*k;
  for(let Y=Math.floor(ccy-ry*k);Y<=Math.ceil(ccy+ry*k);Y++)for(let X=Math.floor(ccx-rx*k);X<=Math.ceil(ccx+rx*k);X++){const nx=(X+.5-ccx)/(rx*k),ny=(Y+.5-ccy)/(ry*k);if(nx*nx+ny*ny<=1)put(X,Y,c);} }
function rect(x0,y0,x1,y1,ramp){ const X0=sx_(x0),X1=sx_(x1),Y0=sy_(y0),Y1=sy_(y1);
  const amb=.16+.22*PT.lit, dif=.22+.78*PT.lit;
  for(let Y=Y0;Y<=Y1;Y++)for(let X=X0;X<=X1;X++){const u=(X-X0)/Math.max(1,X1-X0)*2-1, I=amb+dif*Math.max(0,.45+u*PT.lx*.45-(Y-Y0)/Math.max(1,Y1-Y0)*PT.ly*.2); put(X,Y,ramp[shadeIdx(I,X,Y)]);} }
function line(x0,y0,x1,y1,c,w=1){ const X0=PT.ox+x0*PT.k,Y0=PT.oy+y0*PT.k,X1=PT.ox+x1*PT.k,Y1=PT.oy+y1*PT.k;
  const n=Math.ceil(Math.max(Math.abs(X1-X0),Math.abs(Y1-Y0)))||1, s=Math.max(1,Math.round(w*PT.k*.9));
  for(let i=0;i<=n;i++){const X=Math.round(X0+(X1-X0)*i/n-(s-1)/2),Y=Math.round(Y0+(Y1-Y0)*i/n-(s-1)/2);for(let j=0;j<s;j++)for(let q=0;q<s;q++)put(X+q,Y+j,c);} }
function tri(ax,ay,bx,by,cx,cy,ramp){ const k=PT.k; const A=[PT.ox+ax*k,PT.oy+ay*k],B=[PT.ox+bx*k,PT.oy+by*k],Cc=[PT.ox+cx*k,PT.oy+cy*k];
  const X0=Math.floor(Math.min(A[0],B[0],Cc[0])),X1=Math.ceil(Math.max(A[0],B[0],Cc[0])),Y0=Math.floor(Math.min(A[1],B[1],Cc[1])),Y1=Math.ceil(Math.max(A[1],B[1],Cc[1]));
  const ar=(B[0]-A[0])*(Cc[1]-A[1])-(B[1]-A[1])*(Cc[0]-A[0]); if(!ar) return;
  for(let Y=Y0;Y<=Y1;Y++)for(let X=X0;X<=X1;X++){const px=X+.5,py=Y+.5;
    const w0=((B[0]-px)*(Cc[1]-py)-(B[1]-py)*(Cc[0]-px))/ar, w1=((Cc[0]-px)*(A[1]-py)-(Cc[1]-py)*(A[0]-px))/ar, w2=1-w0-w1;
    if(w0<0||w1<0||w2<0) continue; const I=.2+.25*PT.lit+.5*PT.lit*(w0*.3+w1*.6+w2*.2); put(X,Y,ramp[shadeIdx(I,X,Y)]);} }
function sEnd(p,flash){
  const N=PT.N,u=SPR.u32;
  if(flash){ const wc=0xffffffff; for(let i=0;i<u.length;i++) if(u[i]) u[i]=wc; }
  else if(!p.soft){ const o=p.o, src=u.slice();
    for(let Y=0;Y<N;Y++)for(let X=0;X<N;X++){const i=Y*N+X; if(src[i]) continue;
      if((X>0&&src[i-1])||(X<N-1&&src[i+1])||(Y>0&&src[i-N])||(Y<N-1&&src[i+N])) u[i]=o;} }
  else { for(let i=0;i<u.length;i++){ if(u[i]&&((i*7+(i/N|0))%5===0)&&!( (u[i-1]&&u[i+1]&&u[i-N]&&u[i+N]) )) u[i]=0; } }  // 輪郭が滲む
  for(const [x,y,c,sz] of PT.glows){ const s=Math.max(1,Math.round(PT.k*sz)),X=sx_(x),Y=sy_(y); for(let j=0;j<s;j++)for(let i=0;i<s;i++)put(X+i,Y+j,c); }
  SPR.cx.putImageData(SPR.id,0,0);
}

/* ---- 生き物 ---- */
function quad(p,g,opt={}){ // 四つ足（ハウンド・ストーカー・ラム）
  const s=Math.sin(g), c=Math.cos(g);
  line(-4,-4,-4+s*1.6,0,p.L[0]); line(3,-4,3-s*1.6,0,p.L[0]);
  ell(-1,-5.5,5,2.4,p.B); ell(3,-6,2.9,2.7,p.B);
  if(opt.ram){ ell(5.5,-7,2.4,2.1,p.B); }
  else {
    /* 犬の口。以前は頭から1本の細い線を伸ばすだけで、**嘴のように尖って**いた
       （ユーザー報告）。短く四角い鼻づらの塊＋鼻＋口の合わせ目に置き換える。
       尖らせないことが要点なので、先端は線ではなく面で終わらせる。 */
    ell(6,-8,2.4,1.9,p.B);                       // 頭
    ell(8.2,-7.0,1.5,1.1,p.B);                   // 鼻づら（短い箱。頭より一段下げて「段」を作る）
    dot(9.2,-7.2,p.o);                           // 鼻（点。先端は面のまま＝尖らせない）
    line(7.2,-6.2,9.0,-6.4,p.o,1);               // 口の合わせ目
    /* 耳は**明るい側の色**で描く。ここを一番暗い色で置くと、背景と同じ明るさに
       なって輪郭に出ない（最初それで耳が消えた）。暗い色は輪郭の内側の線にだけ使う。 */
    line(5.0,-9.2,4.4,-11.0,p.B[1],1.3);         // 立った耳（2枚）
    line(6.6,-9.2,7.2,-10.8,p.B[1],1.3);
  }
  line(-5,-4,-5-s*1.6,0,p.L[1]); line(2,-4,2+s*1.6,0,p.L[1]);
  line(-6,-6,-8.5,-8+c,p.L[1]);
  if(opt.ribs) for(const x of [-3,-1,1]) dot(x,-5,p.w);
  glow(opt.ram?6.5:7,opt.ram?-7.5:-8.6,p.e);
}
function spider(p,g,n,opt={}){
  const legs=[], half=Math.ceil(n/2);
  for(let i=0;i<n;i++){ const side=i<half?-1:1, j=i<half?i:i-half;
    const hipx=-1+j*.7, fx=side*(3.2+j*2.3)+Math.sin(g+j*1.7+(side>0?1.6:0))*1.1, lift=Math.max(0,Math.sin(g+j*1.7+(side>0?1.6:0)))*1.4;
    const kx=hipx+(fx-hipx)*.55, ky=-11.5+j*.7; legs.push([hipx,-7,kx,ky,fx,-lift,j%2]); }
  for(const l of legs) if(l[6]){ line(l[0],l[1],l[2],l[3],p.L[0]); line(l[2],l[3],l[4],l[5],p.L[0]); }
  ell(-2.2,-7.4,3.2,2.5,p.B); ell(1.4,-6.8,2,1.6,p.B);
  for(const l of legs) if(!l[6]){ line(l[0],l[1],l[2],l[3],p.L[1]); line(l[2],l[3],l[4],l[5],p.L[1]); if(opt.vine) glow(l[2],l[3]-1,p.g); }
  if(opt.mill){ ell(legs[0][4],-1.5,2.2,1.5,p.W); }
  glow(2.6,-7.2,p.e); glow(2.6,-6.2,p.e);
}
/* 灰の大蛙（ashトード）。
   以前は「大きい楕円＋上に目2つ」で、隣のストーンボアと同じ“塊”にしか見えず、
   どちらがどちらか分からなかった（ユーザー報告）。カエルだと分かる要素は
   3つあって、そのどれも無かった:
     1) 畳んだ後脚——腿が斜め上へ、**膝が背より高く**、脛が前へ下りる
     2) 顔を横切る大きな口
     3) 頭の上に飛び出した目
   胴も低く横広にして、猪の「高く盛り上がった背」と シルエットで分ける。 */
function toad(p,t,e){
  const sw=1+(e.tele>0?.55:0)+Math.sin(t*3)*.12;   // 喉がふくらむ（飛ばす前に大きく）
  const br=Math.sin(t*2)*.22;                       // 息づかい
  /* **この絵は18×12ドットしかない。** カエルらしさは細部ではなく輪郭で出す。
     輪郭を「後ろのこぶ（畳んだ後脚の膝）→ 低い背 → 前の2つのこぶ（目）」に
     すると、猪の“丸く盛り上がった背”とひと目で分かれる。
     腿は脚の色ではなく**体と同じ色**で置く——脚の暗い色だと背景に溶けて、
     こぶが輪郭に出ない（最初にそれで失敗した）。 */
  ell(-3.2,-5.6,2.6,2.9,p.B);                      // 腿＝背の後ろのこぶ
  line(-4.4,-7.2,-6.6,-2.2,p.L[1],1.6);            // 脛
  line(-6.6,-2.2,-3.8,-0.5,p.L[1],1.3);            // 水かきの足
  // 胴：低く、横に広い
  ell(0.2,-3.6+br*.1,4.4,2.9,p.B);
  ell(0.8,-2.3,3.4,1.7,p.W);                       // 腹
  // 頭：胴の前へ低く突き出す
  ell(4.4,-4.2,2.7,2.3,p.B);
  line(2.0,-3.2,7.0,-3.5,p.o,1.1);                 // 口（顔を横切る）
  ell(4.4,-1.9,2.0*sw,1.4*sw,p.W);                 // 喉袋
  // 目：頭の上に飛び出す2つのドーム
  ell(5.0,-6.8,1.5,1.5,p.B); ell(2.4,-6.9,1.4,1.4,p.B);
  dot(5.4,-7.1,p.o); dot(2.7,-7.2,p.o);            // 瞳
  // 前脚：短く、指を開く
  line(3.8,-2.0,4.6,-0.2,p.L[1],1.2); line(4.6,-0.2,5.9,-0.2,p.L[1],1);
  line(1.9,-2.0,1.5,-0.2,p.L[1],1.2); line(1.5,-0.2,0.3,-0.2,p.L[1],1);
  glow(5.4,-7.2,p.e);
}
function boar(p,g){  // ずんぐりした岩の猪：首が無く、頭が低く重い。背に岩の棘、短い脚、白い牙
  const s=Math.sin(g);
  for(const [x,o] of [[-5,s],[2,-s]]) line(x,-3,x+o*.7,0,p.L[0],1.3);
  ell(-1.5,-6,7,4.8,p.B);
  ell(5,-4.4,3.4,3.1,p.B); ell(8.4,-3.4,1.7,1.5,p.W);
  dot(9.4,-3.8,p.o);
  /* 牙。白いまま岩肌に乗せると、明るい体色に溶けて見えなかった
     （ユーザー要望「ボアは牙にアウトラインを入れても良いかも」）。
     先に暗い線で太く引いてから、その上に白を細く重ねる＝縁取り。 */
  line(7.3,-2.1,8.9,-5.5,p.o,2.2); line(6.3,-2.5,7.2,-5.1,p.o,2.0);
  line(7.2,-2.2,8.6,-5.2,p.w,1.2); line(6.4,-2.4,7.2,-4.8,p.w,1.0);
  for(let x=-6;x<=3;x+=1.5) line(x,-10.2+Math.abs(x+1.5)*.18,x-.6,-12+Math.abs(x+1.5)*.2,p.B[0]);
  for(const [x,o] of [[-6,-s],[1,s]]) line(x,-2.6,x+o*.7,0,p.L[1],1.3);
  for(const [x,y] of [[-4,-7],[-2,-5.5],[0,-8],[-5,-5],[1.5,-6]]) dot(x,y,p.B[0]);
  glow(5.8,-5.6,p.e);
}
function crawler(p,g){
  const s=Math.sin(g);
  line(-5,-2,-8,0,p.L[0]); line(-4,-2,-6.5,0,p.L[1]);
  ell(-2,-3,5,2.2,p.B); ell(3,-3.6,2.1,1.9,p.B);
  line(2,-3,6+s,-.6,p.L[1]); ell(6.6+s,-.8,1.7,1,p.W);
  line(1,-2.5,5-s,-.3,p.L[0]); ell(5.4-s,-.5,1.4,.9,p.W);
  glow(4,-4.2,p.e);
}
function serpent(p,t,opt={}){
  const n=opt.n||9;
  const pos=[]; for(let i=0;i<n;i++){ pos.push([6-i*1.8, -3.2+Math.sin(t*4-i*.8)*1.6, Math.max(.9,1.9-i*.09)]); }
  for(let i=n-1;i>=0;i--){ const [x,y,r]=pos[i]; ell(x,y,r,r*.9,p.B);
    if(opt.reed&&i%2) line(x,y-r,x-.6,y-r-2.2,p.L[1]);
    if(opt.dots&&((i+((t*6)|0))%3===0)) glow(x,y,p.g); }
  const [hx,hy]=pos[0];
  ell(hx+1.6,hy,2.3,1.8,p.B);
  if(opt.split){ const o=.6+Math.sin(t*5)*.5; line(hx+2.5,hy-.5,hx+4.4,hy-1.4-o,p.B[2]); line(hx+2.5,hy+.5,hx+4.4,hy+1.4+o,p.B[2]); }
  glow(hx+2.2,hy-.8,p.e);
}
function jelly(p,t){
  const b=Math.sin(t*2.6)*1.2, y=-9+b;
  ell(0,y,3.8,2.9,p.G,true); hole(0,y+2.2,4.2,1.1,0);
  for(let i=-1.5;i<=1.5;i+=1){const bx=i*2; for(let j=1;j<=8;j++) glow(bx+Math.sin(t*3+j*.6+i*2)*j/8*1.8,y+1.2+j*.9,j<4?p.G[1]:((j+((t*6)|0))%2?p.G[1]:p.G[0]));}
  glow(-1.2,y-1,p.w);
}
function grub(p,t,e){
  const sw=1+(e.tele>0?.35:0)+Math.sin(t*2)*.05;
  for(let i=3;i>=0;i--) ell(-4.5+i*2.6,-3.4-(i===1||i===2?.3:0),2.1*sw,2.5*sw,p.B);
  ell(4.6,-3,1.8,1.7,p.B); line(5.8,-2,6.8,-1,p.L[1]); line(5.8,-3.6,6.8,-4.2,p.L[1]);
  for(const x of [-4.5,-1.9,.7,3.3]) dot(x,-.8,p.L[0]);
  glow(5.2,-3.6,p.e);
}
function seedpod(p,t,e){
  const s=Math.sin(t*6)*.5;
  line(-1,-4,-3.5+s,0,p.L[1]); line(1,-4,3.5-s,0,p.L[1]); line(0,-4,0,0,p.L[0]);
  ell(0,-8,2.8,4.4,p.B);
  line(-1,-12,-2.5,-14.5,p.L[1]); line(1,-12,2.6,-14.4,p.L[1]); dot(0,-13,p.L[2]);
  if(e.tele>0){ line(0,-11,0,-5,p.g); glow(0,-9,p.w); } else glow(.8,-9,p.e);
}
function bloat(p,t,e){
  const w=1+Math.sin(t*4)*.06+(e.tele>0?.12:0);
  line(-3,-2,-4,0,p.L[1]); line(3,-2,4,0,p.L[1]);
  ell(0,-6,5*w,4.8/w,p.B);
  const k=((t*3)|0)%3; glow(-2,-7,k===0?p.g:p.G[1]); glow(1,-5,k===1?p.g:p.G[1]); glow(2,-8,k===2?p.g:p.G[1]); glow(-1,-4,p.G[1]);
  glow(3.2,-7.5,p.e);
}
function rubble(p,g){
  const s=Math.sin(g);
  line(-1,-6,-2+s*1.5,0,p.L[0],1.4); line(1,-6,2-s*1.5,0,p.L[1],1.4);
  rect(-3,-11.5,2.2,-5.5,p.B);
  rect(1.4,-14,4.6,-10.6,p.B);
  line(1,-10.5,5+s,-3,p.L[1],1.3); line(-2,-10.5,-3-s,-4,p.L[0],1.3);
  for(const [x,y] of [[-2,-9],[0,-7],[1,-10],[-1,-6]]) dot(x,y,p.B[0]);
  glow(3.6,-12.6,p.e);
}
function lanternWraith(p,t){
  const b=Math.sin(t*2)*1.2, y=-6+b;
  tri(-3,y-9,3,y-9,0,y+2,p.B);
  for(let i=-2;i<=2;i++) dot(i*1.2,y-1+Math.sin(t*5+i)*.8,p.B[0]);
  ell(0,y-10.5,2.6,2.6,p.B); hole(.5,y-10.3,1.4,1.5,p.o);
  line(2,y-7,5,y-5,p.L[1]); line(5,y-5,5,y-3,p.L[0]);
  ell(5,y-1.6,1.3,1.6,p.W); glow(5,y-1.8,p.g); glow(4.6,y-1.4,p.w);
  glow(1,y-10.6,p.e);
}
function bell(p,t,e){
  const sh=e.tele>0?Math.sin(t*40)*.6:0;
  line(-5,-6,-8,0,p.L[1],1.2); line(5,-6,8,0,p.L[1],1.2);
  ell(sh,-11,4.6,4.4,p.W); rect(-5+sh,-11,5+sh,-4.5,p.W);
  line(-6+sh,-4,6+sh,-4,p.W[2],1.2);
  for(let y=-10;y<=-6;y+=2)for(let x=-3;x<=3;x+=2) dot(x+sh+((y/2)&1?1:0)*0,y,p.B[0]);
  dot(sh,-16,p.L[1]); line(sh,-16,sh,-18,p.L[0]);
  hole(sh,-3.2,4.4,.8,p.o);
  glow(-1.5+sh,-3.2,p.e); glow(1.5+sh,-3.2,p.e);
}
function pillar(p,t,e){
  const lean=e.tele>0?1.5:0;
  rect(-3.6,-2,3.6,0,p.B);
  for(let y=-16;y<-2;y++){ const o=(y+16)/14*0; rect(-2.8+lean*(-y/16),y,2.8+lean*(-y/16),y,p.B); }
  for(const x of [-1.4,.2,1.8]) line(x+lean*.5,-15,x,-3,p.B[0]);
  rect(-4+lean,-18,4+lean,-16.2,p.B);
  line(-1+lean,-9,1+lean,-7,p.o);
  glow(-1+lean*.7,-12.5,p.e); glow(1.2+lean*.7,-12.5,p.e);
}
function bat(p,t){
  const f=Math.sin(t*13), y=-9+Math.sin(t*3)*1.2;
  tri(-1,y-.5,-8,y-4-f*3.5,-5,y+2,p.L); tri(1,y-.5,8,y-4-f*3.5,5,y+2,p.L);
  ell(0,y,1.8,2.2,p.B); dot(-1,y-2.6,p.B[0]); dot(1,y-2.6,p.B[0]);
  glow(-.6,y-.8,p.e); glow(.8,y-.8,p.e);
}
function moth(p,t){
  const f=Math.abs(Math.sin(t*14)), y=-9+Math.sin(t*2.4)*1.5;
  ell(-3*f-.5,y-1.5,3*f+.6,2.3,p.G,true); ell(3*f+.5,y-1.5,3*f+.6,2.3,p.G,true);
  ell(-2*f-.4,y+1.4,2*f+.5,1.6,p.G,true); ell(2*f+.4,y+1.4,2*f+.5,1.6,p.G,true);
  ell(0,y,1.1,3,p.B); line(-.5,y-3,-1.5,y-4.5,p.L[1]); line(.5,y-3,1.5,y-4.5,p.L[1]);
  glow(0,y+4+((t*5)|0)%3,p.g);
}
function ram(p,g,t){  // 溶けた鉄の牡羊：丸く重い胴、短い脚、流れる渦巻きの角
  const s=Math.sin(g);
  for(const [x,o] of [[-5,s],[2,-s]]) line(x,-3,x+o*.7,0,p.L[0],1.3);
  ell(-1.5,-6.4,6.6,4.8,p.B);
  for(let a=0;a<6.28;a+=.9) dot(-1.5+Math.cos(a)*4.6,-6.4+Math.sin(a)*3.2,p.B[0]);
  ell(5.4,-6,2.7,2.5,p.B); ell(7.6,-5,1.3,1.2,p.B);
  for(const [x,o] of [[-6,-s],[1,s]]) line(x,-2.6,x+o*.7,0,p.L[1],1.3);
  const cx=4.4, cy=-8.6;
  for(let a=0;a<5.8;a+=.3){ const r=2.8-a*.34; glow(cx+Math.cos(a+1.1)*r,cy+Math.sin(a+1.1)*r,(Math.sin(t*4+a)>0)?p.g:p.G[1]); }
  for(const [x,y] of [[-4,-7],[-1,-5],[1,-7.5],[-2.5,-8.5]]) glow(x,y,Math.sin(t*3+x)>0?p.g:p.G[0]);
  glow(6.4,-6.6,p.e);
}
function humanoid(p,g,pose,opt={}){
  const s=Math.sin(g);
  if(pose==='stand'){
    line(-1,-6,-1.5+s,0,p.L[0]); line(1,-6,1.5-s,0,p.L[1]);
    rect(-1.6,-12,1.6,-6,p.B); ell(0,-14,1.7,1.9,opt.skull?p.W:p.B);
    line(-1.8,-11.5,-2.8,-4.5,p.L[0]); line(1.8,-11.5,2.8-s*.5,-4.5,p.L[1]);
  } else if(pose==='run'){
    line(0,-6,3.5,-3,p.L[1],1.2); line(3.5,-3,3,0,p.L[1],1.2); line(0,-6,-3,-3.5,p.L[0],1.2); line(-3,-3.5,-5,-1,p.L[0],1.2);
    line(-.5,-6,1.6,-11.4,p.B[1],2); ell(2.6,-12.8,1.5,1.6,p.W);
    line(1,-10,4,-8,p.L[1]); line(1,-10,-2,-8.5,p.L[0]);
  } else if(pose==='kneel'){
    ell(0,-1.6,3.2,1.5,p.B); rect(-1.4,-7.4,1.4,-2.6,p.B); ell(.8,-9.2,1.4,1.5,p.W);
    line(1,-6,2.4,-6.8,p.L[1]); line(-1,-6,2.4,-6.8,p.L[0]);
  } else if(pose==='prone'){
    line(-3,-1.4,-7.5,-.2,p.L[0]); line(-3,-1,-7,.2,p.L[1]);
    ell(-1,-1.8,4,1.6,p.B); ell(4,-2.3,1.5,1.4,p.W);
    line(2,-2,6+s,0,p.L[1]); line(1,-1.6,5-s,-.4,p.L[0]);
  }
  if(opt.eyes!==false){ if(pose==='run') glow(3.1,-13,p.e); else if(pose==='kneel') glow(1.4,-9.4,p.e); else if(pose==='prone') glow(4.6,-2.6,p.e); else glow(.6,-14.2,p.e); }
}
function paleWraith(p,t){
  const y=-4+Math.sin(t*1.6)*1.2;
  for(let r=0;r<13;r++){ const w=1.2+r*.34, yy=y-13+r; line(-w+Math.sin(t*2+r*.5)*.4,yy,w+Math.sin(t*2+r*.5)*.4,yy,r<3?p.B[2]:p.B[1]); }
  for(let i=-3;i<=3;i++) if((i+((t*4)|0))&1) dot(i*1.1+Math.sin(t*3+i),y,p.B[0]);
  dot(-1,y-10,p.e); dot(1,y-10,p.e);
}
function hueEater(p,t,e){
  const open=e.tele>0?1:(Math.sin(t*1.3)*.5+.5)*.35;
  ell(0,-7,5,5,p.B);
  hole(2.4,-6,1.3+open*1.6,.5+open*1.6,p.o);
  if(open>.3) for(let i=-1;i<=1;i++){ dot(2.4+i*1.1,-6-(.5+open*1.6)+.4,p.w); }
}
function armour(p,g,opt={}){
  const s=Math.sin(g);
  line(-1.2,-6,-1.5+s,0,p.L[0],1.3); line(1.2,-6,1.6-s,0,p.L[1],1.3);
  rect(-2.6,-11.6,2.6,-7,p.W); rect(-2,-6.4,2,-5.4,p.W);
  rect(-1.6,-15.4,2,-12.4,p.W); line(-.8,-14,1.8,-14,0);
  line(-3.2,-11,-3.8,-6,p.L[0],1.2); line(3.2,-11,3.8+s*.4,-6,p.L[1],1.2);
  if(opt.stake){ line(-4,-4,6,-22,p.L[1],1.6); line(5,-20,7,-23.5,p.w,1.4); }
  glow(0,-13.8,p.e);
}
function blades(p,t){
  for(let i=0;i<3;i++){ const a=t*2.2+i*2.094, cx=0, cy=-8, dx=Math.cos(a), dy=Math.sin(a)*.6;
    line(cx+dx*1.5,cy+dy*1.5,cx+dx*7,cy+dy*7,p.W[2]); line(cx+dx*1.5,cy+dy*1.5+.6,cx+dx*6.5,cy+dy*6.5+.6,p.W[0]);
    dot(cx+dx*1.2,cy+dy*1.2,p.L[1]); }
  glow(0,-8,p.g);
}
function spear(p,t){
  const y=Math.sin(t*2)*1.2;
  line(-8,-4+y,7,-11+y,p.L[1],1.1); line(-8,-3+y,7,-10+y,p.L[0]);
  tri(6,-12.4+y,10.5,-12.6+y,7.6,-9.4+y,p.W);
  glow(9.4,-12.2+y,p.g);
}
function company(p,g,t){
  for(const [x,ph,acc] of [[-4.5,0,'#6a7a9a'],[0,2,'#9a6a5a'],[4.5,4,'#6a8a5a']]){
    const s=Math.sin(g+ph);
    line(x-.6,-4,x-.8+s*.8,0,p.L[0]); line(x+.6,-4,x+.8-s*.8,0,p.L[1]);
    rect(x-1.2,-8,x+1.2,-4,p.B); ell(x,-9.6,1.2,1.3,p.W);
    dot(x,-6,C(acc)); line(x+1.4,-7,x+2.6,-10,p.L[2]);
    glow(x+.4,-9.8,p.e);
  }
}
function leech(p,t){  // 沼の大蛭（輪）
  ell(0,-10,8,8,p.B); hole(0,-10,3.6,3.6,p.o); hole(0,-10,2.6,2.6,0xff020203);
  for(let a=0;a<6.28;a+=.52){ dot(Math.cos(a+t*.4)*3.1,-10+Math.sin(a+t*.4)*3.1,p.w); }
  for(let a=0;a<6.28;a+=.7){ glow(Math.cos(a)*6.4,-10+Math.sin(a)*6.4,Math.sin(t*3+a*3)>.3?p.g:p.G[0]); }
  for(let i=-2;i<=2;i++) line(i*3-1,-1.4,i*3+1,-1.4,p.W[2]);
}
function eye(p,t,e){  // 白の大眼。開いている時は、ステンドグラスの虹彩
  const open=e.tele>0||e.cast?1:(Math.sin(t*.6)>.6?.35:.08);
  ell(0,-10,9,6.5,p.B);
  const oh=6*open;
  if(oh>.5){ hole(0,-10,8,oh,p.o);
    const glass=['#2fb3a0','#e0782a','#8a4fb0','#c23a3a','#3a6ad0','#d8c050'].map(C);
    const k=PT.k, ccx=PT.ox, ccy=PT.oy-10*k, R=Math.min(5.5,oh)*k;
    for(let Y=Math.floor(ccy-R);Y<=ccy+R;Y++)for(let X=Math.floor(ccx-R);X<=ccx+R;X++){const dx=X+.5-ccx,dy=Y+.5-ccy,d=Math.hypot(dx,dy);if(d>R)continue;
      const ring=Math.floor(d/(1.6*k)); if(ring===0){put(X,Y,0xff05050a);continue;}
      let a=(Math.atan2(dy,dx)+Math.PI)/6.283+t*.05*(ring%2?1:-1); a-=Math.floor(a); const segs=4+ring*3, sa=a*segs;
      if(sa-Math.floor(sa)<.16||d/(1.6*k)-ring<.2){put(X,Y,0xff140f1c);continue;}
      put(X,Y,glass[(ring*7+Math.floor(sa)*3)%glass.length]);}
  } else line(-8,-10,8,-10,p.o,.8);
  for(let i=-3;i<=3;i++) line(i*2.4,-16.2+Math.abs(i)*.5,i*2.8,-17.8+Math.abs(i)*.6,p.B[0]);
}
/* 系統×形式 → 生き物 */
const BODY={
  beast:{rush:(p,e,g,t)=>quad(p,g,{ribs:true}), range:(p,e,g,t)=>spider(p,g,8), turret:(p,e,g,t)=>toad(p,t,e), swarm:(p,e,g,t)=>boar(p,g)},
  slime:{rush:(p,e,g,t)=>crawler(p,g), range:(p,e,g,t)=>serpent(p,t,{reed:true}), turret:(p,e,g,t)=>jelly(p,t), swarm:(p,e,g,t)=>grub(p,t,e)},
  arcane:{rush:(p,e,g,t)=>serpent(p,t,{split:true,dots:true,n:8}), range:(p,e,g,t)=>spider(p,g,8,{vine:true}), turret:(p,e,g,t)=>seedpod(p,t,e), swarm:(p,e,g,t)=>bloat(p,t,e)},
  armor:{rush:(p,e,g,t)=>rubble(p,g), range:(p,e,g,t)=>lanternWraith(p,t), turret:(p,e,g,t)=>bell(p,t,e), swarm:(p,e,g,t)=>pillar(p,t,e)},
  flame:{rush:(p,e,g,t)=>{quad(p,g); for(const [x,y] of [[-3,-6],[-1,-5],[1,-7],[3,-6]]) glow(x,y,Math.sin(t*5+x)>0?p.g:p.G[0]);}, range:(p,e,g,t)=>bat(p,t), turret:(p,e,g,t)=>moth(p,t), swarm:(p,e,g,t)=>ram(p,g,t)},
  frost:{rush:(p,e,g,t)=>humanoid(p,g,'stand'), range:(p,e,g,t)=>quad(p,g), turret:(p,e,g,t)=>paleWraith(p,t), swarm:(p,e,g,t)=>hueEater(p,t,e)},
  storm:{rush:(p,e,g,t)=>armour(p,g), range:(p,e,g,t)=>blades(p,t), turret:(p,e,g,t)=>spear(p,t), swarm:(p,e,g,t)=>armour(p,g,{stake:true})},
  undead:{rush:(p,e,g,t)=>humanoid(p,g,'prone'), range:(p,e,g,t)=>company(p,g,t), turret:(p,e,g,t)=>humanoid(p,g,'kneel'), swarm:(p,e,g,t)=>humanoid(p,g,'run',{skull:true})},
};
/* 自分で光るもの（地形に光を落とす） */
const EMIT={slime:{turret:[30,.75]}, arcane:{swarm:[18,.35],range:[14,.25]}, armor:{range:[30,.8]}, flame:{turret:[26,.8],swarm:[22,.5],rush:[14,.3]}, storm:{range:[20,.45]}};
const FOE_CV=new WeakMap();   // 敵ごとのキャンバス（分裂で複製された敵とも共有しない）
const MID={5:'toad',15:'leech',25:'spider',35:'serpent',45:'eye'};
const BODY_SIZE={ beast:{range:.70} };   // 系統×形式 → 絵の倍率（当たり判定は変えない）

CAVE.enemy=function(e,sx,sy,R){
  try{ return enemy(e,sx,sy,R); }catch(err){ console.error(err); return false; }
};
function enemy(e,sx,sy,R){
  const r=renderFoe(e); if(!r) return false;
  const {N,face,mid,k,fam,arch}=r, ps=TS/Q;
  // 見えている形の中心を (sx,sy) に合わせる。本編の絵は中心で置くので、当たりの絵もそこに出る
  const u=SPR.u32; let x0=N,x1=-1,y0=N,y1=-1;
  for(let Y=0;Y<N;Y++){ const row=Y*N; for(let X=0;X<N;X++) if(u[row+X]){ if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y; } }
  const cxA = x1>=0 ? (x0+x1+1)/2 : N/2, cyA = y1>=0 ? (y0+y1+1)/2 : PT.oy;
  const W2=N*ps;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.translate(Math.round(sx), Math.round(sy));
  if(face<0) ctx.scale(-1,1);
  /* 敵ごとに自分のキャンバスへ書いてから貼る。1枚を使い回して書き換えると、
     Safari では同じフレームで先に貼った敵まで最後の絵に化ける（ボア→ハウンド等）。 */
  let cv=FOE_CV.get(e); if(!cv||cv.width!==N){ cv=document.createElement('canvas'); cv.width=cv.height=N; FOE_CV.set(e,cv); }
  cv.getContext('2d').putImageData(SPR.id,0,0);
  ctx.drawImage(cv, -cxA*ps, -cyA*ps, W2, W2);
  ctx.restore();
  // 自分で光るものは次のフレームの地形に光を落とす
  const em=(EMIT[fam]&&EMIT[fam][arch]) || (mid==='serpent'?[60,.6]:mid==='eye'?[70,.35]:null);
  if(em&&!e.dead) CAVE.nextEmit.push({x:e.x*Q,y:e.y*Q-6*k,r:em[0]*Math.min(2.5,k),it:em[1]});
  return true;
}
/* この敵をドット絵で描けるか。苔玉（ダストモスなど）・乱入者（人）・名前つきの大ボス・
   絵を用意していない系統は、元の絵のまま（名前と絵が食い違わないように）。 */
function caveMid(e){ return (e.boss||e.looksBoss)&&e.uniqueBoss ? (MID[e.uniqueBoss]||'none') : null; }
function canDraw(e){
  if(!CAVE.on||!e||!e.fam||!e.arch||e.moss||e.intruder) return false;
  const mid=caveMid(e); if(mid==='none') return false; if(mid) return true;
  return !!(BODY[e.fam.id]&&BODY[e.fam.id][e.arch.id]);
}
function renderFoe(e,noFlash){
  if(!canDraw(e)) return null;
  const mid0=caveMid(e);
  let mid=mid0;
  if(mid==='none') mid=null;
  const t=(performance.now()-T0)/1000;
  const fam=e.fam.id, arch=e.arch.id;
  const p=palOf(fam, !!e.uniq);
  // 歩きの位相
  const sp=Math.hypot(e.vx||0,e.vy||0);
  e._cg=(e._cg||Math.random()*6)+(sp>.05?Math.min(1,sp)*.28:.02);
  if(Math.abs(e.vx||0)>.05) e._cf=e.vx>0?1:-1; else if(e._cf==null) e._cf=(P.x>=e.x)?1:-1;
  if(e.tele>0) e._cf=(P.x>=e.x)?1:-1;
  const face=e._cf;
  let k = mid ? Math.max(2.2, e.r/0.34*.85) : e.boss ? Math.max(2, e.r/0.34*.8) : e.intruder?1.35 : e.uniq?1.25 : e.elite?1.12 : 1;
  /* 見た目だけの大きさ補正。当たり判定（e.r）は触らない——ここを変えると
     間合いとバランスが動くが、直したいのは「大きく見える」ことだけ。
     蜘蛛は脚を大きく広げるので、同じ e.r でも他の雑魚よりずっと大きく見えていた
     （ユーザー要望「ダストスパイダーがでかいので30%くらい小さくしたい」）。 */
  if(!mid && !e.boss && BODY_SIZE[fam] && BODY_SIZE[fam][arch]) k *= BODY_SIZE[fam][arch];
  const N = Math.ceil((mid==='eye'||mid==='spider'?44:38)*k/2)*2;
  const lit = CAVE.lightAt(e.x, e.y);
  // ランタンの向き（スプライトの座標で。左向きなら反転）
  const ldx=(P.x-e.x)*face, ldy=(P.y-.3-e.y);
  sBegin(N,k,ldx,ldy,Math.max(G&&G.L.sprAmb||.12,Math.min(1,lit*1.3)));
  const g=e._cg;
  if(mid==='toad') toad(p,t,e);
  else if(mid==='leech') leech(p,t);
  else if(mid==='spider') spider(p,g,7,{vine:true});
  else if(mid==='serpent') serpent(p,t,{n:13,dots:true});
  else if(mid==='eye') eye(p,t,e);
  else BODY[fam][arch](p,e,g,t);
  sEnd(p, !noFlash && e.hit>0 && ((t*20)|0)%2===0);
  return {N,face,mid,k,fam,arch};
}
/* 倒したときの崩れる粒も、いま描いている絵から出す（元の絵の粒が混ざらないように） */
function caveBurst(e){
  const r=renderFoe(e,true); if(!r) return false;
  const {N,face,mid}=r, u=SPR.u32, oy=PT.oy, feet=(mid||e.boss)?e.r*.8:.42, step=N>60?2:1;
  for(let Y=0;Y<N;Y+=step)for(let X=0;X<N;X+=step){ const c=u[Y*N+X]; if(!c) continue;
    const dx=(X-N/2)/Q*face, dy=(Y-oy)/Q, noise=((X*73+Y*151)%97)/97;
    FEEL.particles.push({x:e.x+dx, y:e.y+feet+dy, vx:dx*(2+noise*3)*1.6, vy:dy*2-1, life:.5+noise*.35, max:.5+noise*.35, size:step/Q,
      c:'rgb('+(c&255)+','+((c>>8)&255)+','+((c>>16)&255)+')', rgb:[c&255,(c>>8)&255,(c>>16)&255]}); }
  if(FEEL.particles.length>1400) FEEL.particles.splice(0,FEEL.particles.length-1400);
  e.pixelBurst=true; return true;
}

/* ---------- 既存の描画の差し替え ---------- */
function install(){
  const noop=function(){};
  /* キャンバスの画素の縦横比と、画面に出ている大きさの縦横比がずれたら作り直す。
     Artifact の枠などで表示の大きさだけ後から変わり resize が来ないと、
     絵が縦横に引き伸ばされて円が楕円になる。 */
  const cvEl=document.getElementById('cv');
  const fit=()=>{ if(!cvEl||typeof resize!=='function') return; const w=cvEl.clientWidth,h=cvEl.clientHeight; if(!w||!h||!cvEl.width||!cvEl.height) return;
    if(Math.abs(cvEl.width/cvEl.height - w/h)>0.004 || Math.abs(innerWidth-w)>1 || Math.abs(innerHeight-h)>1) resize(); };
  if(cvEl&&window.ResizeObserver) new ResizeObserver(fit).observe(cvEl);
  setInterval(fit,500);
  const oldSolid=window.solid;
  if(typeof oldSolid==='function') window.solid=function(x,y){ return oldSolid(x,y) || (CAVE.on && obsHit(x,y)); };
  const oldFlash=window.drawFeelFlash;
  if(typeof oldFlash==='function') window.drawFeelFlash=function(e,x,y,size){ if(e&&e!==P&&e.arch&&canDraw(e)) return; return oldFlash(e,x,y,size); };
  /* 当たりの絵：壁の向こう・未探索の場所にいる相手への当たりは出さない。
     主人公の自動攻撃は視線を見ずに一番近い敵を狙う（本編の仕様）ので、
     壁の向こうの見えない敵に当たると、暗がりの何も無い所に火花だけが出て「ずれた」ように見える。 */
  const oldHits=window.drawFeelHits;
  if(typeof oldHits==='function') window.drawFeelHits=function(camX,camY){
    if(!CAVE.on||!FEEL||!FEEL.hits) return oldHits(camX,camY);
    const all=FEEL.hits;
    FEEL.hits=all.filter(f=>{ const e=f.ent; if(!e||e===P) return true; const x=Number.isFinite(e.x)?e.x:f.x, y=Number.isFinite(e.y)?e.y:f.y;
      if(!tileSeen(x,y)) return false; return typeof losClear!=='function' || losClear(P.x,P.y,x,y); });
    try{ return oldHits(camX,camY); } finally{ FEEL.hits=all; }
  };
  const oldPix=window.drawEnemyPixels;
  window.drawEnemyPixels=function(camX,camY){
    ctx.save();
    for(const p of FEEL.particles){
      if(!tileSeen(p.x,p.y)) continue;
      const k=Math.max(0,Math.min(1,p.life/p.max));       // 1→0
      let col=p.c;
      if(p.rgb){ const r=Math.min(1,(1-k)*1.8), [R,G2,B]=p.rgb;
        col='rgb('+Math.round(R+(210-R)*r)+','+Math.round(G2+(28-G2)*r)+','+Math.round(B+(24-B)*r)+')'; }
      ctx.globalAlpha=p.rgb?Math.min(1,k*1.4):Math.min(1,p.life/.25); ctx.fillStyle=col;
      const size=Math.max(1,Math.round(p.size*TS));
      ctx.fillRect(Math.round(p.x*TS-camX),Math.round(p.y*TS-camY),size,size);
    }
    ctx.restore();
  };
  const oldBurst=window.burstEnemyPixels;
  if(typeof oldBurst==='function') window.burstEnemyPixels=function(e){ try{ if(caveBurst(e)) return; }catch(err){ console.error(err); } return oldBurst(e); };
  // 光と暗がりは地形の側で描く
  window.drawPlayerLight=noop;
  window.drawFeelVignette=noop;
  // チルトシフト：本編のぼかしのあとに、上下へもう一段ぼかしを重ねる（探索画面だけ。本編の設定は凍結されていて変えられない）
  const oldTilt=window.drawFeelTiltShift;
  /* ---------- 端のぼかしは、どちらか片方だけ掛ける ----------
     ここは長いあいだ **本編のぼかし（applyFeelTilt）と洞窟版のぼかし（extraTilt）を
     両方とも毎フレーム掛けていた。** 実測（第13階層・iPhone 13 相当）:

       両方          40.6 fps
       洞窟版だけ     59.7 fps
       本編だけ       48.1 fps
       どちらも無し    60.1 fps

     CPUプロファイルでも drawImage が全体の 7 割を占め、内訳は
     applyFeelTilt 52% / extraTilt 17%。**盤面の絵より、端のぼかしのほうが重かった。**
     報告「スマホが熱くなりやすくなった」の主因はこれ。

     2つは同じ帯に同じことをしているので、重ねても見た目はほとんど変わらない
     （並べて比べても、ディザの粒がわずかに滑らかになる程度）。洞窟版のほうは
     この絵に合わせた縮小・拡大だけの安い作りなので、そちらを残す。
     失われるわずかな柔らかさは strength を 5→6 に上げて取り返す（これは只）。
     CAVE.on が落ちた（描画が例外で止まった）ときだけ本編側へ戻す。 */
  window.drawFeelTiltShift=function(){
    if(!CAVE.on) return oldTilt && oldTilt();
    try{ extraTilt(); }catch(err){ console.error(err); CAVE.on=false; return oldTilt && oldTilt(); }
  };
  if(typeof window.drawFeelMist==='function') window.drawFeelMist=noop;
  if(typeof window.drawFeelDarkness==='function') window.drawFeelDarkness=noop;
  // 漂う粒は1ドットに
  const oldAir=window.drawAir;
  window.drawAir=function(Z,dt){ if(!CAVE.on||!G) return oldAir&&oldAir(Z,dt); if(Z&&Z.id==='stone'&&oldAir) oldAir(Z,dt); airStep(Z,dt||0.016); };   // 石の層は元の羽虫・蛾も舞う
  // 足元の影もドットで
  window.drawFeelGroundShadow=function(x,y,size,scale=1,alpha=1){
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)) return;
    const ps=TS/Q, s=Math.max(2,size*scale), w=Math.max(3,Math.round(s*.34/ps)), h=Math.max(1,Math.round(w*.3));
    const fx=Math.round(x), fy=Math.round(y+s*.36);
    ctx.save(); ctx.globalAlpha*=.55*Math.max(0,Math.min(1,alpha)); ctx.fillStyle='#000';
    for(let j=-h;j<=h;j++){ const hw=Math.round(w*Math.sqrt(1-(j/(h+.5))**2)); ctx.fillRect(fx-hw*ps, fy+j*ps, hw*2*ps, ps); }
    ctx.restore();
  };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
