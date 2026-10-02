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
const CAVE_TILT={strength:6, band:.30, fade:.24, strips:10, blur:false};
/* blur:false … 上下のぼかしを掛けない（報告「本体が熱を持ちやすい、厳しかったら上下のブラーはなくして」）。
   ぼかしは帯ごとに画面を縮小して戻す drawImage で、端の処理の中で一番重い。暗くする帯（ビネット）は
   塗るだけなので残す。 */   // strength＝端での縮小率（大きいほど強くぼける）
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
  /* 端でも薄っすら見えるように（報告「上下のビネットが強過ぎる」2026-10-01）。
     1＝真っ黒だったのを .62 に。端でも地形が4割ほど透ける。 */
  max: .62,        // 画面の**いちばん端**での暗さ（1 で真っ黒）
  pow: 1.9,        // 立ち上がり方。大きいほど端に寄る（途中はあまり暗くしない）
  skipBlur: .40,   // これより暗くなる帯はぼかさない（伏せるだけ）
  steps: 6,        // 一番外の帯の中を何段に分けて濃くするか
  side: .30,       // 左右の端の暗さ
  sideW: .14,      // 左右にかける幅（画面幅に対する割合）
  /* 上下の端の、完全に真っ黒になる帯（画面の高さに対する割合）。
     **ここは地形を1ドットも計算しない。** 伏せてしまうので計算しても見えない。
     地形は画面のドット1つずつを回す一番重い所なので、
     削った帯のぶんがそのまま発熱の削減になる。 */
  /* → 2026-10-01：端を伏せ切らなくなったので 0（地形を端まで計算する）。
     伏せる帯を戻すなら max を 1 に戻すのと一緒に。 */
  black: 0,
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
/* ---------- 瘴気（根の層から先） ----------
   明るい層では、時間とともに暗くなる代わりに、画面の外から禍々しい気が迫ってくる（本編の miasmaLevel、1〜10）。
   2ドット角の粗い升目に、縁がうねる帯を描く：外側は濃い暗紫、迫ってくる縁は明るい紫の点で光る。
   3以下（継続ダメージ）では脈打つ。升目は2回に1回だけ塗り直す（地形と同じく発熱対策）。 */
const MIA_C=document.createElement('canvas'), MIA_X=MIA_C.getContext('2d');
let miaImg=null, miaU=null, miaFrame=0, miaLv=10;
const MS_N=1024, MS=new Float32Array(MS_N); for(let i=0;i<MS_N;i++) MS[i]=Math.sin(i/MS_N*6.2831853);
const msin=(a)=>MS[((a*162.97466)|0)&1023];   // 速い sin（表引き。升目の模様にはこれで足りる）
function drawMiasma(){
  if(!CAVE.on||typeof S==='undefined'||S.screen!=='game'||!S.run) return;
  const target=(typeof miasmaLevel==='function')?miasmaLevel():10;
  const now=performance.now(), dtM=Math.min(.25,(now-(CAVE._miaAt||now))/1000); CAVE._miaAt=now;
  miaLv = CAVE.lightSnap ? target : miaLv+(target-miaLv)*Math.min(1,dtM*1.2);
  CAVE.miasma=miaLv;
  const m=(10-miaLv)/9; if(m<.02) return;
  const ps=TS/Q, cell=2*ps, cw=Math.ceil(innerWidth/cell), ch=Math.ceil(innerHeight/cell);
  if(!miaImg||miaImg.width!==cw||miaImg.height!==ch){ MIA_C.width=cw; MIA_C.height=ch; miaImg=MIA_X.createImageData(cw,ch); miaU=new Uint32Array(miaImg.data.buffer); miaFrame=0; }
  if((miaFrame++%3)===0||CAVE.lightSnap){                         // 3回に1回塗り直す（ゆっくり動くので足りる）
    /* 主人公（画面の中心）の周りの澄んだ輪が縮んでいく形。輪の外は瘴気、輪の縁はうねって明るく光る。 */
    const t=(now-T0)/1000, U=miaU, cx=cw/2, cy=ch/2, Rmax=Math.hypot(cx,cy*.8)+2, Rc=Rmax*(1-.86*m), band=4+3*m;
    const hurt=miaLv<=3.5, pulse=hurt?.5+.5*Math.sin(t*3.2):0;
    const aIn=Math.round(255*(.40+.30*m+.12*pulse));
    const cIn =(Math.min(255,aIn+40)<<24|(0x1c<<16)|(0x06<<8)|0x1a)>>>0;   // 外ほど濃い暗紫（ABGR）
    const cMid=(aIn<<24|(0x3a<<16)|(0x10<<8)|0x4a)>>>0;                     // 紫
    const cRim=(Math.round(255*(.7+.2*pulse))<<24|(0x7a<<16)|(0x3a<<8)|(hurt?0xd0:0xb0))>>>0;   // 縁の明るい紫
    for(let y=0;y<ch;y++){ const dy=(y+.5-cy)*.8;
      for(let x=0;x<cw;x++){ const k=y*cw+x, dx=x+.5-cx, r=Math.sqrt(dx*dx+dy*dy);
        if(r<Rc-band-6){ U[k]=0; continue; }
        const n=msin(x*.21+t*.9+msin(y*.13-t*.6)*2)*.55+msin(y*.17-t*.7+x*.05)*.45;   // 縁のうねり
        const q=(r-Rc+n*(2.5+3*m))/band, b=BAYER[((y&3)<<2)|(x&3)];
        if(q>=1){ const wisp=msin(x*.19+t*.8+msin(y*.07)*2)*msin(y*.23-t*.6+x*.07);   // 瘴気の中を漂うもや（まばら）
          U[k]= (wisp>.62&&b<.5) ? cMid : (q>2.2||b<.55) ? cIn : cMid; }
        else if(q>0){ U[k]= q>b ? (q<.45 ? cRim : cMid) : 0; }
        else U[k]=0;
      } }
    MIA_X.putImageData(miaImg,0,0);
  }
  const d=cv.width/innerWidth;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(MIA_C,0,0,cw,ch,0,0,cw*cell*d,ch*cell*d);
  ctx.restore();
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
      /* 帯の上下は整数の行で決め、隣の帯と同じ境目を共有する。a と b-a を別々に丸めていたので、
         境目に1行の塗り残し（明るい筋）や二重塗り（暗い筋）が出た（報告「画面の上下に1ドットの切れ目」）。 */
      a=Math.round(a); b=Math.round(b);
      const h=b-a; if(h<=0) continue;
      const t=(k+.5)/n, dark=V.max*Math.pow(t,V.pow);
      // 伏せてしまう一番外の帯はぼかさない（ぼけているかどうか読めないので）
      if(T0_.blur && !(outer && dark>=V.skipBlur)){
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
          const yy=Math.round(a+h*Math.min(p0,p1)), hh=Math.round(a+h*Math.max(p0,p1))-yy; if(hh<=0) continue;
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
const LIGHT_A=.64, LIGHT_CORE=.22;
const LUT_MAX=200; let lutR=0, lutD=null, lutA=null;
/* 明るさ（1〜10）→ 灯りの半径の倍率。10 で今まで通り、1 で 0.14（1マスほど）。 */
function lightMul(lv){ const s=Math.max(0,Math.min(1,(lv-1)/9)); return .14+.86*Math.pow(s,.85); }
CAVE.lightMul=lightMul;
const LV0=new Float32Array(1025), LV1=new Float32Array(1025);
for(let i=0;i<=1024;i++){ const q=Math.min(1,i/1023); LV0[i]=q<LIGHT_CORE?1:Math.pow(Math.max(0,1-q)/(1-LIGHT_CORE),1.15); LV1[i]=Math.pow(Math.max(0,1-q),1.1); }
function lightLut(r){
  if(r<=lutR) return; lutR=r; const w=r*2+1; lutD=new Float32Array(w*w); lutA=new Uint16Array(w*w);
  const iF=720/6.2831853;
  for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++){ const i=(y+r)*w+x+r; lutD[i]=Math.sqrt(x*x+y*y); lutA[i]=((Math.atan2(y,x)+Math.PI)*iF|0)%720; }
}   // 明かりの濃さ（1で元）／中央の最も明るい所の広さ（半径に対する割合）

/* ---------- 地形ハザードの色（面として描く） ---------- */
const HZ={
  water:{ramp:cs(['#0a2230','#103650','#1a5070','#3a88b0']), band:cs(['#0a2230','#103650','#1a5070','#3a88b0','#5fa6c8','#8ccbe2']), hi:C('#c8f0ff'), glow:false,
    /* 深さの3段。浅瀬は底の砂が透ける緑がかった明るい水、深みは濃い青、淵は底の見えない黒。
       段ごとに**色の系統ごと**変える（明るさだけの差だと、灯りの強弱と区別がつかない）。 */
    shallow:cs(['#12303a','#1a4a56','#256a74','#3a8c92','#62b0b0','#94d4cc']),
    deep:cs(['#081a2c','#0c2842','#12385e','#1c5080','#4a86b0','#7ab0d0']),
    abyss:cs(['#020509','#03080f','#050d17','#081522','#12304a','#1e4a68']),
    shelf:C('#8ad0d0'), drop:C('#3c78a4')},
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
  G.ver=(G.ver||0)+1;                                          // 壁が増えた＝灯りの影を引き直す
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

/* ---------- 水面（以前の本編の「生きた水面」を、洞窟のドットで描き直したもの） ----------
   本編の drawLivingLiquid は、1マスずつ半透明の横線を重ねて
     ・屈折の帯（2行おきの短い横線が、行ごとに揺れてずれる）
     ・流れの筋（4行おきに、明るい短い線がゆっくり横へ流れる）
     ・下にある物を横にずらす屈折
     ・歩いた所の波紋
   を出していた。洞窟版に替えたときに平らな色の面になっていたので、同じ4つを戻す。
   半透明は使えない（1ドット＝パレットの1色）ので、濃さは「段を1つ上げるかどうか」で出す。
   帯も筋も**世界の座標**で決めるので、マスの境目で途切れない。 */
function waterDepthAt(g,px,py){
  const u=(px+.5)/Q-.5, v=(py+.5)/Q-.5, x0=Math.floor(u), y0=Math.floor(v), fx=u-x0, fy=v-y0;
  const r0=g[y0], r1=g[y0+1];
  const a=r0?(r0[x0]|0):0, b=r0?(r0[x0+1]|0):0, c=r1?(r1[x0]|0):0, d=r1?(r1[x0+1]|0):0;
  if(a===b&&b===c&&c===d&&a<=1) return a;                     // 浅瀬の内側は混ぜる必要が無い
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy + (NZS[((py&255)<<8)|(px&255)]-.5)*.9;
}
function waterSurface(ramp,hi,lv,wx,wy,t,Lv,D,rowW1,rowW2,colW){
  /* ramp は6段（0..3 が水面の地の色、4..5 は帯と筋だけに使う明るい段）。
     帯を「段を1つ上げる」だけにすると、灯りの真下（地が既に最上段）で帯が消えていた。 */
  let up=0;
  const row=wy>>1, rh=ihash(row,77);
  // 屈折の帯：2行おきの短い横線。長さと間隔を行ごとに変え、行の揺れでずらす（煉瓦のように揃えない）
  if(!(wy&1)&&(rh%3)===0&&D<2.7){
    const per=9+(rh>>>4)%6, len=2+(rh>>>8)%3, u=(wx+rowW1+colW+(rh>>>12)%per)|0;
    if(((u%per)+per)%per<len) up=1;
  }
  // 流れの筋：4行おきに、明るい短い線が横へ流れる。深い所ほど見えにくい
  if((wy&3)===2&&D<2.4){ const u=wx+(wy>>2)*29+Math.floor(t*5+rowW2*2); if((((u%23)+23)%23)<2+((wy>>2)%3)) up=2; }
  let col=ramp[Math.min(ramp.length-1,lv+up+(up&&lv>=3?1:0))];
  if(Lv>.2&&ihash(wx,wy+((t*4)|0)*13)%61===0) col=hi;          // 灯りの照り返し
  return col;
}
/* 屈折（下にある水草・魚・帯を横にずらす）と波紋。水面の印（wmask）がある所だけ。 */
const RIP_LIFE=.85;
function waterPost(bx0,by0,t){
  if(!wmask) return;
  const reduced=typeof FEEL_REDUCED!=='undefined'&&FEEL_REDUCED.matches;
  if(!reduced) for(let by=0;by<bh;by++){
    const wy=by0+by, sh=Math.round(Math.sin(wy*.16+t*1.6+Math.sin(wy*.05)*2));
    if(!sh) continue;
    const o=by*bw; let any=false;
    for(let x=0;x<bw;x++){ const m=wmask[o+x]; wrow[x]=buf[o+x]; if(m) any=true; }
    if(!any) continue;
    for(let x=1;x<bw-1;x++){ const m=wmask[o+x]; if(m&&wmask[o+x+sh]===m) buf[o+x]=wrow[x+sh]; }
  }
  /* 波紋は**水面の高さの場**を解いて動かし（輪が広がり、岸で跳ね返り、重なって干渉する）、
     描くのは**ドットの線だけ**にする（報告「波紋がドット表現とかち合っている」）。
       ・盛り上がった所（h>T）の縁に1ドットの明るい線だけ。窪みの暗い線は、波が干渉した所に
         黒い多角形がぽつぽつ出て汚く見えたのでやめた
       ・色は水の段の色（中間色・網点・屈折は使わない）。強い所だけ一段明るい色
     セルは横4×縦3ドットなので、輪は地面に寝た楕円になる。 */
  if(reduced||!WV||WV.x1<0||WV.G!==G) return;
  wvTick();
  if(WV.x1<0) return;
  const g=WV, cw=g.cw, CX=WV_CX, CY=WV_CY, H=g.h, W_=HZ.water;
  const X0=Math.max(1,g.x0*CX-bx0-CX), X1=Math.min(bw-2,(g.x1+1)*CX-bx0+CX), Y0=Math.max(1,g.y0*CY-by0-CY), Y1=Math.min(bh-2,(g.y1+1)*CY-by0+CY);
  if(X1<X0||Y1<Y0) return;
  if(!wvRows||wvRows[0].length!==bw) wvRows=[new Float32Array(bw),new Float32Array(bw),new Float32Array(bw)];
  const rowH=(y,out)=>{                                          // y 行の高さ（ドットごと、なめらかに補間）
    const fy=(by0+y+.5)/CY-.5, j=Math.floor(fy), ty0=fy-j, ty=ty0*ty0*(3-2*ty0);
    if(j<1||j>=g.ch-2){ out.fill(0); return; }
    for(let x=X0-1;x<=X1+1;x++){
      const fx=(bx0+x+.5)/CX-.5, i=Math.floor(fx), tx0=fx-i, tx=tx0*tx0*(3-2*tx0);
      if(i<1||i>=cw-2){ out[x]=0; continue; }
      const a=j*cw+i;
      out[x]=(H[a]*(1-tx)+H[a+1]*tx)*(1-ty)+(H[a+cw]*(1-tx)+H[a+cw+1]*tx)*ty;
    }
  };
  let up=wvRows[0], cur=wvRows[1], dn=wvRows[2];
  rowH(Y0-1,up); rowH(Y0,cur);
  const hiW=W_.band[5], hi2W=W_.hi, hiP=DECO_PAL.poolGleam, hi2P=DECO_PAL.poolGleam;   // 水溜りの面は明るい横縞があるので、輪は一番明るい照り返しの色で
  const T=WV_T, T2=WV_T2;
  for(let y=Y0;y<=Y1;y++){
    rowH(y+1,dn);
    const o=y*bw;
    for(let x=X0;x<=X1;x++){
      const k=o+x, m=wmask[k]; if(!m) continue;
      /* 水の層は盛り上がり（h>T）の縁だけ。水溜りは狭くて盛り上がりの輪が育たないので、
         窪み（踏んだ所）の縁も同じ明るい線で描く——小さな楕円が広がって縁で消える。 */
      const h=m===2?Math.abs(cur[x]):cur[x];
      if(h>T){
        const inn=m===2?(Math.abs(cur[x-1])>T&&Math.abs(cur[x+1])>T&&Math.abs(up[x])>T&&Math.abs(dn[x])>T):(cur[x-1]>T&&cur[x+1]>T&&up[x]>T&&dn[x]>T);
        if(inn) continue;
        /* 線は半分の濃さで重ねる（報告「目立ち過ぎる」）。途切れと網かけは**輪に沿って長く**続くように、
           なめらかなノイズ（十数ドットの大きさ）で決める：線 → 網かけ → 切れ目 → 網かけ → 線。
           1ドットずつばらばらに間引くと、輪ではなく水しぶきの粒に見えた（報告）。
           弱い波は点を間引かず、線ごと薄くして消す。 */
        const wx=bx0+x, wy=by0+y, n=.5+.25*(Math.sin(wx*.23+wy*.41)+Math.sin(wx*.13-wy*.29+1.7));   // 20〜50ドット周期のなめらかな揺らぎ
        if(n<WV_GAP) continue;                                     // 途切れ
        if(n<WV_NET&&((wx+wy)&1)) continue;                        // 途切れの手前は網かけ
        const st=Math.min(1,(h-T)/(WV_FULL-T));
        buf[k]=mixU(buf[k], m===2 ? hi2P : hi2W, WV_ALPHA*(st<.3?.6:1)+(h>T2?.15:0));   // 弱い波ほど薄く
      }
    }
    const tmp=up; up=cur; cur=dn; dn=tmp;
  }
}
let wvRows=null;
/* ---------- 水面の高さの場 ----------
   1セル＝4ドット（1マス＝4×4セル）の格子で、高さと速さを持つ。毎秒60歩で
     速さ += K×（上下左右の高さ − 4×自分）、速さ ×= VD、高さ += 速さ、高さ ×= HD
   岸（水でないセル）は隣を自分と同じ高さとみなす＝波は岸で跳ね返る。
   動いているのは波がある範囲（x0..x1, y0..y1）だけで、静まったら止める（重さは波の広さぶんだけ）。 */
const WV_CX=4, WV_CY=3, WV_K=.19, WV_VD=.975, WV_HD=.995, WV_T=.06, WV_T2=.2;
const WV_ALPHA=.5, WV_GAP=.2, WV_NET=.3, WV_FULL=.16;   // 線の濃さ／途切れ・網かけになるノイズのしきい値／これ以上の強さで一番濃く
let WV=null;
function wvGrid(){
  if(!G) return null;
  const haz=(typeof W!=='undefined'&&W.haz)||null;
  if(WV&&WV.G===G&&WV.haz===haz) return WV;
  const cw=Math.ceil(G.PW/WV_CX)+2, ch=Math.ceil(G.PH/WV_CY)+2, n=cw*ch;
  WV={G,haz,cw,ch,h:new Float32Array(n),v:new Float32Array(n),wet:new Int8Array(n).fill(-1),
      x0:1e9,y0:1e9,x1:-1,y1:-1,acc:0,last:performance.now(),
      seen:new WeakSet(),pos:new WeakMap()};
  return WV;
}
function wvWet(k){
  const g=WV; let w=g.wet[k]; if(w>=0) return w;
  const cx=k%g.cw, cy=(k/g.cw)|0; w=0;
  if(cx>0&&cy>0&&cx<g.cw-1&&cy<g.ch-1){
    const px=cx*WV_CX+2, py=Math.round(cy*WV_CY+1.5), tx=Math.floor(px/Q), ty=Math.floor(py/Q), f=G.f, row=f.g[ty], tt=row&&row[tx];
    if(tt!==undefined&&tt!==T.WALL){
      if(g.haz&&g.haz.kind==='water'&&g.haz.g[ty]&&g.haz.g[ty][tx]) w=1;
      else if(G.pools&&G.pools.length&&poolU(G.pools,px,py)>0) w=1;
    }
  }
  g.wet[k]=w; return w;
}
/* 水面を押し下げる（x,y はマス単位の足元）。周りが盛り上がって輪になって広がる。 */
function wvPoke(x,y,amp,rad){
  const g=wvGrid(); if(!g||!Number.isFinite(x)||!Number.isFinite(y)) return false;
  const cx=x*Q/WV_CX-.5, cy=(y*Q+2)/WV_CY-.5, R=Math.ceil(rad);
  let any=false;
  for(let j=Math.floor(cy)-R;j<=Math.ceil(cy)+R;j++) for(let i=Math.floor(cx)-R;i<=Math.ceil(cx)+R;i++){
    if(i<2||j<2||i>=g.cw-2||j>=g.ch-2) continue;
    const k=j*g.cw+i; if(!wvWet(k)) continue;
    const d=Math.hypot(i-cx,j-cy)/rad; if(d>=1) continue;
    const q=1-d*d; g.h[k]-=amp*q*q; any=true;
    if(i<g.x0)g.x0=i; if(i>g.x1)g.x1=i; if(j<g.y0)g.y0=j; if(j>g.y1)g.y1=j;
  }
  return any;
}
function wvStep(){
  const g=WV; if(!g||g.x1<0) return;
  const cw=g.cw, H=g.h, V=g.v;
  const x0=Math.max(2,g.x0-1), x1=Math.min(cw-3,g.x1+1), y0=Math.max(2,g.y0-1), y1=Math.min(g.ch-3,g.y1+1);
  for(let j=y0;j<=y1;j++) for(let i=x0;i<=x1;i++){
    const k=j*cw+i; if(!wvWet(k)) continue;
    const c=H[k], l=wvWet(k-1)?H[k-1]:c, r=wvWet(k+1)?H[k+1]:c, u=wvWet(k-cw)?H[k-cw]:c, d=wvWet(k+cw)?H[k+cw]:c;
    V[k]=(V[k]+(l+r+u+d-4*c)*WV_K)*WV_VD;
  }
  let nx0=1e9,ny0=1e9,nx1=-1,ny1=-1;
  for(let j=y0;j<=y1;j++) for(let i=x0;i<=x1;i++){
    const k=j*cw+i; if(g.wet[k]<=0) continue;
    const h=(H[k]+V[k])*WV_HD; H[k]=h;
    if(Math.abs(h)+Math.abs(V[k])>.004){ if(i<nx0)nx0=i; if(i>nx1)nx1=i; if(j<ny0)ny0=j; if(j>ny1)ny1=j; }
  }
  if(nx1<0){ for(let j=y0;j<=y1;j++){ H.fill(0,j*cw+x0,j*cw+x1+1); V.fill(0,j*cw+x0,j*cw+x1+1); } g.x0=g.y0=1e9; g.x1=g.y1=-1; return; }
  g.x0=nx0; g.x1=nx1; g.y0=ny0; g.y1=ny1;
}
/* 1フレームぶん：足音・滴の波紋（FEEL.ripples に積まれた物）と、水の中を動く者の航跡を入れて、時間ぶん進める。 */
function wvFeed(){
  const g=wvGrid(); if(!g) return;
  const rs=(typeof FEEL!=='undefined'&&FEEL.ripples)||[];
  for(const r of rs){ if(g.seen.has(r)) continue; g.seen.add(r); if(r.age<.2) wvPoke(r.x,r.y,r.amp||WV_STEP,2.4); }
  const movers=[P].concat((S.hero&&S.hero.party)||[], W.enemies||[]);
  for(const e of movers){
    if(!e||e.dead||e.fallAnim||!Number.isFinite(e.x)||!Number.isFinite(e.y)) continue;
    const o=g.pos.get(e);
    if(o){ const d=Math.hypot(e.x-o.x,e.y-o.y); if(d>.004&&d<.6) wvPoke(e.x,e.y,Math.min(.5,d*WV_WAKE),1.7); o.x=e.x; o.y=e.y; }
    else g.pos.set(e,{x:e.x,y:e.y});
  }
}
const WV_STEP=1.1, WV_WAKE=1.7;
function wvTick(){
  const g=WV; if(CAVE.waveFixed){ wvStep(); return; }                 // テスト用：1フレーム＝1歩
  const now=performance.now();
  g.acc+=Math.min(.1,(now-g.last)/1000); g.last=now;
  let n=0; while(g.acc>=1/60&&n<4){ wvStep(); g.acc-=1/60; n++; }
  if(n===4) g.acc=0;
}
CAVE.waveStep=(n)=>{ wvGrid(); for(let i=0;i<(n||1);i++) wvStep(); };
CAVE.wave=()=>WV;
/* 足元が石の層の水溜りか（波紋を出すため）。水溜りは見た目だけの賑やかしなので、ここで引く。 */
function puddleAt(x,y){
  if(!G||!G.pools) return false;
  const px=x*Q, py=y*Q+2;
  const X=Math.round(px), Y=Math.round(py);
  if(X<0||Y<0||X>=G.PW||Y>=G.PH||G.code[Y*G.PW+X]||obsHit(X/Q,Y/Q)) return false;
  return poolU(G.pools,X,Y)>0;
}
CAVE.puddleAt=puddleAt;

/* ---------- 光 ---------- */
const NA=720, ray=new Float32Array(NA);
let lampX=0, lampY=0, Rpx=100, shadowOn=true, flatL=.45;
/* 影の光線は、ランタンのドット位置・届く長さ・壁が変わらない限り同じ。立ち止まっている間や
   30分の1秒ごとの描き直しでは引き直さない（720本×百数十歩を毎フレーム回していた）。 */
let rayKey='';
function castRays(Rm){
  const key=lampX+','+lampY+','+Rm+','+(G.ver||0)+','+G.PW;
  if(key===rayKey) return; rayKey=key;
  const {code,PW,PH}=G;
  for(let a=0;a<NA;a++){const ang=a/NA*6.2831853-Math.PI, cx=Math.cos(ang), cy=Math.sin(ang); let t=1;
    for(;t<Rm;t+=1){const x=(lampX+cx*t)|0, y=(lampY+cy*t)|0; if(x<0||y<0||x>=PW||y>=PH||code[y*PW+x])break;} ray[a]=t;}
}
/* 世界の位置（マス単位）の明るさ 0..1。敵の塗りに使う。 */
CAVE._G=()=>G;
CAVE._ruinBig=d=>ruinBigFor(d); CAVE._ruinSprAll=()=>({big:RUIN_BIG,spr:RUIN_SPR}); CAVE._ruinBand=f=>ruinBand(f); CAVE._standBox=o=>standBox(o); CAVE._rockAt=(px,py)=>!!G&&field(G.f,G.L,Math.round(px),Math.round(py))>.5;
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
let bw=0,bh=0,img=null,buf=null,cool=null,wmask=null,wrow=null,wcolX=null;
/* wmask … このフレームで「水面」として塗ったドット（1=水の層の水／2=石の層の水溜り）。
   屈折のずらしと波紋は、ここに印のあるドットの上にだけ描く。 */
let T0=performance.now();
/* 地形は**2フレームに1回**だけ描き直す（端末が熱くなる報告への対策）。
   間のフレームは前の絵をカメラのずれぶん動かして貼るだけ。絵は1ドットずつ余分に広く描いてあり、
   歩いても1フレームで動くのは1ドット未満なので、貼り直しで端が欠けることはない（欠けそうなら描き直す）。
   キャラ・敵・効果は毎フレーム描くので、動きの滑らかさは変わらない。水面と灯りが30分の1秒ごとになる。
   テストは CAVE.halfRate=false にして毎回描く。 */
CAVE.halfRate=true;
let lastT=null;
CAVE.terrain=function(f,Z,camX,camY,blinded){
  try{
    const ps=TS/Q;
    if(CAVE.halfRate&&lastT&&!lastT.reused&&lastT.f===f&&lastT.Z===Z&&lastT.ps===ps&&lastT.bl===!!blinded&&
       lastT.w===innerWidth&&lastT.h===innerHeight&&
       lastT.bx0*ps<=camX&&(lastT.bx0+bw)*ps>=camX+innerWidth&&lastT.by0*ps<=camY&&(lastT.by0+bh)*ps>=camY+innerHeight){
      lastT.reused=true; CAVE.nextEmit=[]; CAVE.skipped=(CAVE.skipped||0)+1;
      ctx.save(); ctx.imageSmoothingEnabled=false;
      ctx.drawImage(bufC,0,0,bw,bh,lastT.bx0*ps-camX,lastT.by0*ps-camY,bw*ps,bh*ps);
      ctx.restore();
      return true;
    }
    const r=terrain(f,Z,camX,camY,blinded);
    lastT={f,Z,ps,bl:!!blinded,w:innerWidth,h:innerHeight,bx0:Math.floor(camX/ps)-2,by0:Math.floor(camY/ps)-2,reused:false};
    return r;
  }catch(err){ console.error(err); CAVE.on=false; lastT=null; return false; }
};
function terrain(f,Z,camX,camY,blinded){
  cache(f,Z);
  const L=G.L, Pp=G.P, t=(performance.now()-T0)/1000;
  const ps=TS/Q;
  const nbw=Math.ceil(innerWidth/ps)+5, nbh=Math.ceil(innerHeight/ps)+5;   // 前後2ドットずつ余分に（間のフレームの貼り直し用）
  if(nbw!==bw||nbh!==bh){bw=nbw;bh=nbh;bufC.width=bw;bufC.height=bh;img=bufX.createImageData(bw,bh);buf=new Uint32Array(img.data.buffer);cool=new Float32Array(bw*bh);wmask=new Uint8Array(bw*bh);wrow=new Uint32Array(bw);wcolX=new Float32Array(bw);}
  wmask.fill(0);
  const bx0=Math.floor(camX/ps)-2, by0=Math.floor(camY/ps)-2;
  // ランタン
  /* → 2026-10-02 ユーザー指摘「灯りが主人公の中心から少し上にズレている」。主人公の絵は P を中心に描く（足元は P の 0.3 マス下）ので、
     灯りの中心も P に置く（以前は 4 ドット上にずらしていた）。 */
  lampX=Math.round(P.x*Q); lampY=Math.round(P.y*Q);           // ドット単位（影の光線と明るさの表を使い回せる）
  cache(f,Z); ensure((lampX|0)-16,(lampY|0)-16,(lampX|0)+16,(lampY|0)+16);
  if(G.code[(lampY|0)*G.PW+(lampX|0)]){ outer: for(let r=1;r<14;r++) for(let a=0;a<16;a++){ const x=(lampX+Math.cos(a*.3927)*r)|0, y=(lampY+Math.sin(a*.3927)*r)|0; if(x>=0&&y>=0&&x<G.PW&&y<G.PH&&!G.code[y*G.PW+x]){ lampX=x; lampY=y; break outer; } } }
  shadowOn=!!L.shadow;
  const flick=CAVE.noFlicker?1:1+.035*Math.sin(t*8.3)+.02*Math.sin(t*21.7);   // noFlicker：画面の明るさを測るテスト用
  /* 灯り（蛍石）の明るさ 1〜10（本編の lightLevel）。段が変わったときに灯りがぱっと縮まないよう、
     1.6/秒 の速さで追いかける。灯りの半径は明るさで縮み、灯りの外の闇（視界の輪）も迫ってくる。 */
  const lvT=(typeof lightDarkLevel==='function'&&typeof S!=='undefined'&&S.run)?lightDarkLevel():10;   // 暗い層だけ暗くなる（明るい層は瘴気）
  const nowL=performance.now(), dL=Math.min(.25,(nowL-(CAVE._lvAt||nowL))/1000); CAVE._lvAt=nowL;
  CAVE.lvS=(CAVE.lvS==null||CAVE.lvF!==f||CAVE.lightSnap)?lvT:CAVE.lvS+(lvT-CAVE.lvS)*Math.min(1,dL*1.6); CAVE.lvF=f;
  const lmul=lightMul(CAVE.lvS);
  Rpx=L.lightT*Q*flick*lmul;
  const Rsys=Math.min(L.lightT,8)*lmul;                       // 灯りの届く距離（マス）。白の層のような広い灯りでも 8 マスで数える
  const sL=Math.max(0,(CAVE.lvS-1)/9), vIn=Rsys*1.25+1.2, visT=vIn+(18-vIn)*Math.pow(sL,1.2);   // 視界の輪（マス）：10 で画面の外（18マス）、下がるほど迫り、1 で灯りのすぐ外
  const blindR = Math.min(blinded ? BLIND_DARK*Q : 1e9, visT*Q);
  CAVE.litTiles = blinded ? Math.min(Rsys, BLIND_DARK) : Rsys;
  CAVE.visTiles = blindR/Q;
  if(blinded) Rpx=Math.min(Rpx,BLIND_DARK*Q);
  const Rm=Math.min(Rpx, blindR)+6;
  ensure(Math.min(bx0,(lampX-Rm)|0), Math.min(by0,(lampY-Rm)|0), Math.max(bx0+bw,(lampX+Rm)|0), Math.max(by0+bh,(lampY+Rm)|0));
  if(G.deco) stampRocks();
  if(shadowOn) castRays(Math.ceil(Math.min(L.lightT*Q*1.06*lmul, blindR)+6));
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
  const R=Rpx, R2=R*R, iFac=NA/6.2831853, flat=!!L.flat, feat=L.feature, invR=1/R;
  /* 明るさは「ランタンからのずれ（整数ドット）」だけで決まる角度と距離を表から引く。
     1ドットごとの atan2・sqrt・pow が、この関数の中で一番重かった（全体の約4分の1）。 */
  const useLut=!flat&&R<=LUT_MAX; if(useLut) lightLut(Math.ceil(R)+1);
  const LR=lutR, LW=lutR*2+1, LD=lutD, LA=lutA;
  const haz=W.haz, hz=haz?(HZ[haz.kind]||HZ.poison):null, hg=haz?haz.g:null;
  const fx0=Math.round(bx0*.45), fy0=Math.round(by0*.45);          // 奥の岩影は遅れて流れる
  const stx=f.stair?f.stair.x*Q:-1e9, sty=f.stair?f.stair.y*Q:-1e9;
  let k=0;
  /* 上下の端の「完全に伏せる」帯は1ドットも計算しない（extraTilt が黒で塗る）。
     ここは画面のドットを1つずつ回す一番重い所なので、削った帯がそのまま効く。 */
  const blackPx=Math.round(bh*CAVE_VIG.black), skipBot=bh-blackPx;
  const blindR2=blindR*blindR, visInR=Math.max(0,blindR-24), visIn2=visInR*visInR, visInv=1/Math.max(1,blindR-visInR);
  /* 落ちている蛍石は周りを照らす（影は落とさない柔らかい灯り）。暗闇の中の目印になる。
     視界の輪の外でも、この灯りの中は見える。 */
  const LSx=[], LSy=[], LSr=[];
  if(typeof W!=='undefined'&&W.drops) for(const d of W.drops){ if(!d.stone) continue;
    const r=((typeof STONE_LIGHT_R!=='undefined')?STONE_LIGHT_R:2.8)*Q, x=d.x*Q, y=d.y*Q;
    if(x+r<bx0||x-r>bx0+bw||y+r<by0||y-r>by0+bh) continue; LSx.push(x); LSy.push(y); LSr.push(r); }
  const LSn=LSx.length;

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

  for(let bx=0;bx<bw;bx++) wcolX[bx]=Math.sin((bx0+bx)*.056+t)*1.5;
  for(let by=0;by<bh;by++){const wy=by0+by, dy=wy-lampY;
    if(by<blackPx||by>=skipBot){ buf.fill(VOID,k,k+bw); k+=bw; continue; }
    const rowW1=Math.sin(wy*.22+t*1.7)*2, rowW2=Math.sin(wy*.24+t*1.4);
    const clsRow=((wy>>4)-ty0)*txn - tx0;
    for(let bx=0;bx<bw;bx++,k++){const wx=bx0+bx;
      if(wx<0||wy<0||wx>=PW||wy>=PH){buf[k]=VOID;continue;}
      const cv2=cls[clsRow+(wx>>4)];
      if((cv2&3)===0){ buf[k]=VOID; continue; }                 // 周りが全部未踏
      if((cv2&3)===1){                                          // 境目のマスだけ混ぜる
        const sv=seenV(wx,wy); if(sv<SEEN_HI){ if(sv<=SEEN_LO||(sv-SEEN_LO)/(SEEN_HI-SEEN_LO)<BAYER[((wy&3)<<2)|(wx&3)]){buf[k]=VOID;continue;} } }
      const i=wy*PW+wx, c=code[i], b=BAYER[((wy&3)<<2)|(wx&3)], dx=wx-lampX, d2=dx*dx+dy*dy;
      let sl=0;                                                  // 蛍石の灯り
      if(LSn) for(let li=0;li<LSn;li++){ const ex=wx-LSx[li], ey=wy-LSy[li], e2=ex*ex+ey*ey, r=LSr[li];
        if(e2<r*r){ const q=1-Math.sqrt(e2)/r, v=q*q*(3-2*q)*.85; if(v>sl) sl=v; } }
      if(d2>visIn2 && sl<.04+b*.1){ if(d2>=blindR2||(Math.sqrt(d2)-visInR)*visInv>b){buf[k]=VOID;continue;} }   // 視界の輪の外は闇（蛍石の灯りの中は除く）。縁は網点で溶かす
      let Lv=0, fc=1;
      if(flat){ Lv=flatL+(d2<1600?.12:0); }
      else if(d2<R2&&(c===0||c<5)){
        let d, a;
        if(useLut&&dx>=-LR&&dx<=LR&&dy>=-LR&&dy<=LR){ const li=(dy+LR)*LW+dx+LR; d=LD[li]; a=LA[li]; }
        else { d=Math.sqrt(d2); a=((Math.atan2(dy,dx)+Math.PI)*iFac|0)%NA; }
        const rl=ray[a], qi=(d*invR*1023)|0;
        if(c===0){ if(d<=rl) Lv=LV0[qi]; }
        else if(d<=rl+c+.5){ Lv=LV1[qi]; fc=Math.max(0,-(nx[i]*dx+ny[i]*dy)/(127*(d||1))); }}
      if(sl>Lv){ Lv=sl; fc=1; }
      if(blinded&&Lv>0){ const dt_=Math.sqrt(d2)/Q; if(dt_>BLIND_CLEAR) { const q_=Math.max(0,1-(dt_-BLIND_CLEAR)/(BLIND_DARK-BLIND_CLEAR)); Lv*=q_*q_; } }   // 盲目：3マスを越えると暗くなっていく（本編と同じ）
      const Cv=cool[k];
      if(c===0){
        /* ---- 穴（降りる穴・縁の向こう） ---- */
        const sd=(wx-stx)*(wx-stx)+(wy-sty)*(wy-sty);
        /* 降りる穴。縁をノイズで崩し、網点の輪（点線の円に見えた）をやめる。
           手前（下）の縁は灯りを受けた岩、奥（上）の縁は影——穴の縁が段になって見える。 */
        const hn=NZ[((wy&255)<<8)|(wx&255)]-.5, HR=64*(1+hn*.6);
        if(sd<HR){ buf[k]= sd>HR*.66 ? (wy>sty ? rim[Math.min(4,Math.floor(Lv*4.5+b))] : ed[0]) : (sd<20&&((wx*3+wy*5+((t*6)|0))%11===0)?Pp.pit:0xff020203); continue; }
        if(pitOn&&!(cv2&8)){const pv=tileKindAt(f,wx,wy,T.PIT); if(pv>.5){ buf[k]= pv<.58 ? (((wx+wy)&1)?rim[Math.min(4,1+Math.floor(Lv*4+b))]:Pp.pit) : ((ihash(wx,wy)%211===0)?Pp.pit:0xff020203); continue; }}
        /* ---- 地形ハザード ---- */
        if(hg&&!(cv2&4)){const hv=hazAt(hg,wx,wy); if(hv>.5){
          let lv = hz.glow ? 1+((Math.sin(t*1.6+(wx+wy)*.05)*.5+.5)*1.6+b)|0 : Math.floor(Math.max(Lv,Cv*.8)*4+b*.9);
          if(haz.kind==='water'){
            /* 深さはマスごとの段（1浅瀬/2深み/3淵）を**マスの中心どうしで混ぜた値**で塗る。
               以前は wy>>4 のマスの段をそのまま使っていたので、深い所が四角の寄せ集めに見えた（報告）。
               混ぜた値が2.5を越える所＝淵のマスの縁なので、落ちる場所とは食い違わない。 */
            const D=waterDepthAt(hg,wx,wy);
            lv=Math.max(0,Math.min(3,lv));
            if(hv<.56){ buf[k]=hz.shallow[Math.min(5,lv+2)]; continue; }    // 岸
            /* 深さの段（報告「10階以降の水の深さの段階がわからなくなった」）。
               境目は 1.5（浅瀬→深み）と 2.5（深み→淵）。境には1ドットの線を引く：
               浅瀬の縁は明るい棚の線、淵の縁は青い落ち込みの線。線の内側は網点を使わず塗り分ける。 */
            /* 境は網点のグラデーションでなじませる（報告「はっきり分かれすぎて不自然、少しだけ網グラデを」）。
               深さの値に網点のしきい値（BAYER）をずらして足してから段を決めるので、境の前後
               WATER_BLEND ぶんだけ2つの色が市松に混ざる。棚・落ち込みの線も網点で間引いて細く見せる。 */
            /* 境のなめらかさ（報告「もう少しスムーズに」）。2色を市松に混ぜるだけだと粒が粗いので、
               境の前後 WATER_BLEND の中では、浅い側と深い側の色を**4段に混ぜた中間色**を網点でつなぐ。
               浅瀬の棚の線はやめ、落ちる淵の縁だけ網点の細い線を残す（落ちる場所は読めないと困る）。 */
            if(Math.abs(D-2.5)<.05&&b<.4){ buf[k]=hz.drop; wmask[k]=1; continue; }
            const sh=Math.min(3,lv+1), dpv=lv, ab=Math.max(0,lv-1), Lk=D<2.5?Lv:0;
            let col;
            const e1=(D-1.5)/WATER_BLEND+.5, e2=(D-2.5)/WATER_BLEND+.5;         // 0..1 で境の中
            // 境の中は網点で4段に混ぜる。0段・3段のドットは片方の水面だけ描けば足りる（計算を半分に）
            let ta, la, La=Lk, tb=null, lb=0, Lb=Lk, st=0;
            if(e1>0&&e1<1){ ta=hz.shallow; la=sh; tb=hz.deep; lb=dpv; st=Math.floor(e1*3+b); }
            else if(e2>0&&e2<1){ ta=hz.deep; la=dpv; tb=hz.abyss; lb=ab; Lb=0; st=Math.floor(e2*3+b); }
            else{ ta=D<1.5?hz.shallow:D<2.5?hz.deep:hz.abyss; la=D<1.5?sh:D<2.5?dpv:ab; }
            st=st<0?0:st>3?3:st;
            if(st===3) col=waterSurface(tb,hz.hi,lb,wx,wy,t,Lb,D,rowW1,rowW2,wcolX[bx]);
            else{ col=waterSurface(ta,hz.hi,la,wx,wy,t,La,D,rowW1,rowW2,wcolX[bx]);
              if(st) col=mixU(col, waterSurface(tb,hz.hi,lb,wx,wy,t,Lb,D,rowW1,rowW2,wcolX[bx]), st/3); }
            buf[k]=col; wmask[k]=1; continue;
          }
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
  if(!(typeof FEEL_REDUCED!=='undefined'&&FEEL_REDUCED.matches)) wvFeed();
  waterPost(bx0,by0,t);
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
  poolW:cs(['#0c1a2c','#16304a','#22486a','#335f86','#5a8ab0','#8ab4d4']), poolShade:C('#0a121e'),
};
/* 水の層の遺跡の名残（第16〜20階層）。石の色を水に浸かった冷たい色に寄せ、根元に藻を付ける。
   跡の層（第四層／築）の石材と同じ形を使い回す——**同じ造りの物が、ここではもう沈みかけている**。 */
/* → 2026-10-01：色は拠点（街の広場の石畳・柱）と同じ砂色の石に、オリーブ色の苔（ユーザー要望）。
   拠点の絵から取った値：明 #c3ad98／中 #9f906e／暗 #5a534f、照り #d6bca6。 */
const DECO_PAL_WET=Object.assign({}, DECO_PAL, {stone:dcR(['#5a534f','#9f906e','#c3ad98']), stoneDk:C('#2e2a28'), stoneHi:C('#d6bca6'),
  algae:dcR(['#3e3e18','#6e6c28','#a39a44']), mossBed:dcR(['#2e3014','#55561f','#86823a']), mossBedTip:C('#b0a650'), foam:C('#d8f4f4')});
// 層ごとの品目：[名前, 置き場所, 出やすさ]
const DECO_SET={
  /* 4つめは「この深さから出る」最小の階層（省略＝最初から出る）。
     石の層の後半（第6階層〜第10階層）だけ、床に苔の足場と水溜りを混ぜる
     ——次が水の層なので、**床が湿っていく**ことを絵で先に言う（ユーザー要望）。 */
  /* 水溜りは**角**に置く（床のまん中にぽつぽつ置くと不自然、という指摘）。
     低い所＝壁の付け根に水は溜まる。角の石筍より先に引くので、水溜りの角には石筍が立たない。
     壁沿いにも少しだけ。 */
  stone:[['pool','corner',.24,6],['stalagC','corner',.35],['pool','wall',.005,6],['rock','open',.006],['vine','north',.05],['skel','floor',.006],
         ['mossbed','floor',.020,6],
         ['moss','wall',.030],['reed','wall',.016],['pebble','floor',.008]],
  sump:[['weed','water',.030],['fish','water',.016],['plankton','water',.010],['shrimp','floor',.012],['shell','wall',.014],
        /* 第16〜20階層（層の6階目から）：遺跡の名残。立った柱は当たり判定を持つ（genDeco の末尾）。 */
        /* → 2026-10-01：壁際の柱・崩れ壁・倒れた石柱・部屋の残骸は、マスごとの抽選ではなく genRuinDressing が
           迷宮の部屋の形に沿って置く（通り道・入口・穴を塞がない、不自然な所に置かない）。ここに残すのは床の小物だけ。 */
        ['rubble','floor',.006,6],
        /* 水の中の遺跡（添付の見本）：水から立つ角柱・水面から出た崩れ壁・浅瀬の飛び石・深みに沈んだ建物の跡 */
        ['wpost','water',.015,6],['wfallen','water',.0025,6],['wwall','water',.006,6],['wsteps','water',.010,6],['sunken','water',.012,6],['mossbed','floor',.016,6]],
  root:[['shroom','wall',.024],['tendril','wall',.026],['bulb','floor',.010],['moss','wall',.014]],
  ruin:[['foundation','floor',.010],['colonnade','wall',.012],['pillar','wall',.022],['brokenwall','wall',.018],['arch','wall',.010],['steps','wall',.009],['lamppost','wall',.012],['plaque','floor',.008],['rubble','floor',.010]],
  furnace:[['boiler','wall',.014],['pipe','wall',.024],['slag','floor',.012],['vent','floor',.010],['gear','floor',.008]],
  pale:[['cairn','floor',.012],['bones','floor',.010],['frame','floor',.006],['palegrass','wall',.018]],
};
const DECO_MUL={stone:2.2,sump:1.1,root:1.0,ruin:1.0,furnace:.9,pale:.45};
function ruinEntities(){
  const out=[]; const add=o=>{ if(o&&Number.isFinite(o.x)) out.push(o); };
  (W.drops||[]).forEach(add); (W.ores||[]).forEach(add); add(W.forge); add(W.shop); add(W.npc); add(W.ev); add(W.trial);
  return out;
}
function roomOf(f,tx,ty){ return (f.rooms||[]).find(r=>tx>=r.x&&tx<r.x+r.w&&ty>=r.y&&ty<r.y+r.h)||null; }
function roomOpenings(f,r){
  if(r._open) return r._open; const out=[], fl=(x,y)=>f.g[y]&&f.g[y][x]!==undefined&&f.g[y][x]!==T.WALL;
  for(let x=r.x-1;x<=r.x+r.w;x++){ if(fl(x,r.y-1)) out.push([x,r.y-1]); if(fl(x,r.y+r.h)) out.push([x,r.y+r.h]); }
  for(let y=r.y;y<r.y+r.h;y++){ if(fl(r.x-1,y)) out.push([r.x-1,y]); if(fl(r.x+r.w,y)) out.push([r.x+r.w,y]); }
  return r._open=out;
}
/* 水の中の立ち物（柱・崩れ壁・倒れた柱）：部屋の中で、入口・穴・入口の部屋から離れた所だけ */
function ruinSpotOK(f,px,py,clear){
  const tx=Math.floor(px/Q), ty=Math.floor(py/Q), r=roomOf(f,tx,ty); if(!r) return false;
  if(f.stair&&Math.hypot(tx+.5-f.stair.x,ty+.5-f.stair.y)<3) return false;
  if(f.start&&Math.hypot(tx-f.start.cx,ty-f.start.cy)<4) return false;
  const RB=ruinBand(f); for(let dy=-1;dy<=1;dy++)for(let dx=-Math.ceil(clear);dx<=Math.ceil(clear);dx++) if(RB.at(tx+dx,ty+dy)) return false;   // 通り道の帯には立てない
  return !roomOpenings(f,r).some(([x,y])=>Math.max(Math.abs(x-tx),Math.abs(y-ty))<=clear);
}
/* 通り道の帯：部屋の入口（通路の口）ごとに部屋の中ほどまで、と入口→穴の道を、幅3マスにした物。
   迷宮の通路は部屋の中ほど同士を結んで掘られるので、人が歩く線はここに乗る。
   当たり判定のある遺跡はこの帯に置かない。背の高い物は帯の2マス南にも置かない（歩く人を隠す）。 */
const RBAND=new WeakMap();                            // 階の物（W.fl）には載せない：保存の対象になるので
function ruinBand(f){
  if(RBAND.has(f)) return RBAND.get(f);
  const Wd=f.W, H=f.H, band=new Uint8Array(Wd*H), path=new Uint8Array(Wd*H);
  const wg=(W.haz&&W.haz.kind==='water')?W.haz.g:null;
  const pass=(x,y)=>x>=0&&y>=0&&x<Wd&&y<H&&(f.g[y][x]===T.FLOOR||f.g[y][x]===T.STAIR)&&!(wg&&wg[y]&&wg[y][x]>=3);
  const walk=(sx,sy,gx,gy,lim)=>{                    // 幅優先で最短の道を引いて path に印
    if(!pass(sx,sy)||!pass(gx,gy)) return;
    const prev=new Int32Array(Wd*H).fill(-1), q=[sy*Wd+sx]; prev[sy*Wd+sx]=sy*Wd+sx;
    for(let qi=0;qi<q.length;qi++){ const i=q[qi], x=i%Wd, y=(i/Wd)|0; if(x===gx&&y===gy) break;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy, j=ny*Wd+nx;
        if(!pass(nx,ny)||prev[j]>=0||(lim&&!lim(nx,ny))) continue; prev[j]=i; q.push(j); } }
    let i=gy*Wd+gx; if(prev[i]<0) return;
    for(let n=0;n<Wd*H;n++){ path[i]=1; if(prev[i]===i) break; i=prev[i]; }
  };
  if(f.start&&f.stair) walk(f.start.cx,f.start.cy,Math.floor(f.stair.x),Math.floor(f.stair.y));
  for(const r of f.rooms||[]){
    const opens=roomOpenings(f,r), inR=(x,y)=>x>=r.x-1&&x<=r.x+r.w&&y>=r.y-1&&y<=r.y+r.h;
    // 隣り合う口は1つの口（2マス幅の通路）にまとめ、その真ん中から部屋の中ほどへ
    const grp=[], used=new Set();
    for(const o of opens){ const k=o[0]+','+o[1]; if(used.has(k)) continue; const g=[o]; used.add(k);
      for(let i=0;i<g.length;i++) for(const p of opens){ const pk=p[0]+','+p[1]; if(!used.has(pk)&&Math.abs(p[0]-g[i][0])+Math.abs(p[1]-g[i][1])===1){ used.add(pk); g.push(p); } }
      grp.push(g[g.length>>1]); }
    for(const [ox,oy] of grp) walk(ox,oy,r.cx,r.cy,inR);
  }
  for(let y=0;y<H;y++)for(let x=0;x<Wd;x++) if(path[y*Wd+x])
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const X=x+dx, Y=y+dy; if(X>=0&&Y>=0&&X<Wd&&Y<H) band[Y*Wd+X]=1; }
  const o={band,path,at:(x,y)=>x>=0&&y>=0&&x<Wd&&y<H&&band[y*Wd+x]===1}; RBAND.set(f,o);
  return o;
}
/* ---------- 遺跡の置き方（第16〜20階層）----------
   ユーザー指摘（2026-10-01）「マップの邪魔にならない所・不自然にならない所に」「部屋の残骸を塊で無理に置かず、パーツをばらけさせる」。
   見張り役の指摘：部屋の北の壁に全部が貼り付いて見える／均等に撒かれて同じ物が繰り返す／部屋と大きさが合わない。
   そこで「昔ここに建物があった」を先に決めて、その名残を拾う置き方にした:
     ・階ごとに遺跡の街区を1〜2か所。街区の中心の部屋に、部屋より小さい**建物の跡**（8〜14×6〜10マス）を
       部屋の北の縁から2マス以上内側に想定し、その北の壁・東西の壁・角・南の戸口の柱・戸口の段・床の敷石・石碑を、
       **一つずつ35〜60%で**残す（全部は残らない＝崩れて歯抜けの建物になる）。
       浅瀬に掛かる位置を好む（見本の「水に浸かった遺跡」）。
     ・崩れた壁の折れ口には転げた石塊、立っていない戸口の柱は脇に倒れた石柱（柱頭は折れ口の反対＝東）。
     ・街区の隣の部屋は、列柱の残り・壁の切れ端・石碑などの欠片を1〜2つ。
     ・細長い部屋には列柱（3〜4マスおき、所々折れて、1本は倒れる）。
     ・それ以外の部屋の2割に、ぽつんと1つ（石碑／切り株の柱と倒れた柱／石塊の山／壁の切れ端）。
   決まり（どれも置く前に見る。合わない部品は置かずに飛ばす＝そのまま歯抜けになる）:
     ・通り道の帯（ruinBand）に当たり判定を置かない。背の高い物は帯の2マス南にも置かない
     ・部屋の入口から2マス、穴から3マス、宝箱・鉱脈・鍛冶場・商人・仲間候補・出来事・試練から1.5マス離す
     ・足元が岩（洞窟の縁の崩れ）に掛からない。同じ部品（柱以外）を12マス以内に繰り返さない
     ・置いたら部屋の中を歩いて、入口どうしと部屋の中ほどがつながっているかを確かめる
     ・淵の上には置かない。柱は深みまで、敷石・段は水の上に置かない */
function genRuinDressing(f,depth,existing){
  const out=[], wg=(W.haz&&W.haz.kind==='water')?W.haz.g:null, ents=ruinEntities(), RB=ruinBand(f);
  const tier=(x,y)=> wg&&wg[y]? (wg[y][x]||0) : 0;
  let seed=hs(depth*7919+(f.stair?Math.floor(f.stair.x)*31+Math.floor(f.stair.y)*977:0)+(f.start?f.start.cx*7+f.start.cy*131:0),7)|0;
  const rnd=()=>{ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^seed>>>15,1|seed); t=(t+Math.imul(t^t>>>7,61|t))^t; return ((t^t>>>14)>>>0)/4294967296; };
  const pick=a=>a[Math.floor(rnd()*a.length)], chance=p=>rnd()<p;
  const taken=new Set();                               // 立ち物が占めるマス（水の中の柱などは、上に置いた物の下から抜く＝genDeco）
  const flatT=new Map();                               // 敷石・段が占めるマス→組（立ち物は上に乗れる。同じ建物の敷石どうしは継ぎ足せる）
  const blockedBy=new Map();                           // 部屋ごとの、当たり判定で塞がったマス
  const rock=(px,py)=>G&&G.L? field(f,G.L,Math.round(px),Math.round(py))>.5 : false;
  const SP=n=>RUIN_BIG[n];
  const FLAT=n=>/^(pave|steps)_/.test(n);
  const place=(name,ax,ay,opt={})=>{
    const sp=SP(name); if(!sp||!sp.fp) return null;
    ax=Math.round(ax); ay=Math.round(ay);
    const solid=!!(sp.obs&&sp.obs.length), flat=FLAT(name);
    const x0=Math.floor((ax+sp.fp[0])/Q), x1=Math.floor((ax+sp.fp[2]-1)/Q), y0=Math.floor((ay+sp.fp[1])/Q), y1=Math.floor((ay+sp.fp[3]-1)/Q);
    const home=roomOf(f,Math.floor(ax/Q),Math.floor(ay/Q)); if(!home||home===f.start) return null;
    const cells=[];
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      if(!f.g[ty]||f.g[ty][tx]!==T.FLOOR) return null;
      const r=roomOf(f,tx,ty); if(!r||r===f.start) return null;           // 部屋の中だけ（通路には出さない）
      const tr=tier(tx,ty); if(tr>=3) return null; if(!solid&&tr>=2) return null; if(opt.dry&&tr>=2) return null;   // 敷石は浅瀬まで（水に半分透ける）
      if(flat? (flatT.has(tx+','+ty)&&!(opt.grp&&flatT.get(tx+','+ty)===opt.grp)) : taken.has(tx+','+ty)) return null;
      if(f.stair&&Math.hypot(tx+.5-f.stair.x,ty+.5-f.stair.y)<3) return null;
      if(f.start&&Math.hypot(tx-f.start.cx,ty-f.start.cy)<4) return null;
      if(solid&&RB.at(tx,ty)) return null;
      if(solid&&roomOpenings(f,r).some(([ox,oy])=>Math.max(Math.abs(ox-tx),Math.abs(oy-ty))<=2)) return null;
      cells.push(tx+','+ty); }
    // 背の高い物は、帯の上（＝北）に絵が掛かると歩く人を隠す
    if(sp.tall){ const top=Math.floor((ay-sp.ay)/Q); for(let ty=Math.min(top,y0-2);ty<y0;ty++)for(let tx=x0;tx<=x1;tx++) if(RB.at(tx,ty)) return null; }
    if(!flat&&ents.some(e=>e.x>=(ax+sp.fp[0])/Q-1.5&&e.x<=(ax+sp.fp[2])/Q+1.5&&e.y>=(ay+sp.fp[1])/Q-1.5&&e.y<=(ay+sp.fp[3])/Q+1.5)) return null;
    // 足元が岩に掛からない（洞窟の縁は崩してあるので、マスが床でも縁の岩が出ている）。周り2ドットも空ける
    for(let py=ay+sp.fp[1]-2;py<=ay+sp.fp[3]+2;py+=3)for(let px=ax+sp.fp[0]-2;px<=ax+sp.fp[2]+2;px+=3) if(rock(px,py)) return null;
    // 角と壁は、根元が岩の縁から1マス以上離れていること。立ち物の上の方が岩（＝画面では黒）に3ドットより多く掛からないこと
    if(/^(corner|wall)_/.test(name)) for(let px=ax+sp.fp[0];px<=ax+sp.fp[2];px+=4) if(rock(px,ay+sp.fp[1]-Q)) return null;
    // 絵の全体が床の上に収まること（壁は真上から見た面なので、立ち物の上が壁に乗ると角度が合わない＝standClear と同じ考え）
    for(let r=0;r<sp.h;r+=2) for(let q=0;q<sp.w;q+=2){ const c=sp.rows[r][q]; if(c==='.'||c==='s') continue;
      const px=ax-sp.ax+q, py=ay-sp.ay+r; if(rock(px,py)||rock(px,py-2)) return null; }
    // 同じ部品を近くで繰り返さない（柱は列で並ぶ物なので除く）
    if(!/^(col|pave)_/.test(name)&&out.some(o=>o.name===name&&Math.hypot(o.x-ax,o.y-ay)<12*Q)) return null;
    // 塞ぐマス（当たり判定の円がマスの中心に掛かる）
    const nb=[];
    if(solid) for(const [dx,dy,rr] of sp.obs){ const cx=(ax+dx)/Q, cy=(ay+dy)/Q, R=(rr+4)/Q;
      for(let ty=Math.floor(cy-R);ty<=Math.floor(cy+R);ty++)for(let tx=Math.floor(cx-R);tx<=Math.floor(cx+R);tx++)
        if(Math.hypot(tx+.5-cx,ty+.5-cy)<R){ if(RB.at(tx,ty)) return null; nb.push(tx+','+ty); } }
    if(nb.length){
      const rooms=new Set(nb.map(k=>{ const [x,y]=k.split(',').map(Number); return roomOf(f,x,y); }).filter(Boolean));
      for(const r of rooms){ const bl=blockedBy.get(r)||new Set(), test=new Set([...bl,...nb]); if(!roomConnected(f,r,roomOpenings(f,r),test,tier)) return null; }
      for(const r of rooms){ const bl=blockedBy.get(r)||new Set(); nb.forEach(k=>bl.add(k)); blockedBy.set(r,bl); } }
    cells.forEach(k=>flat?flatT.set(k,opt.grp||-1):taken.add(k));
    const o={k:'rbig',name,x:ax,y:ay,s:(rnd()*1e9)|0,ext:Math.max(sp.w,sp.h)*.6+8,ok:1,cells,role:opt.role||'',grp:opt.grp||0};
    out.push(o); return o;
  };
  /* 試しに置いて、条件に合わなければ丸ごと取り消す */
  const trial=(fn,ok)=>{ const sT=new Set(taken), sF=new Map(flatT), sB=new Map([...blockedBy].map(([k,v])=>[k,new Set(v)])), n0=out.length;
    const r=fn(); if(ok(out.slice(n0),r)) return true;
    out.length=n0; taken.clear(); sT.forEach(k=>taken.add(k)); flatT.clear(); sF.forEach((v,k)=>flatT.set(k,v)); blockedBy.clear(); sB.forEach((v,k)=>blockedBy.set(k,v)); return false; };
  const brkPts=[];                                     // 折れ口（石屑を寄せる所）
  /* 転げた石塊：崩れた壁の折れ口の脇（外へ、少し南へ） */
  const rubbleAt=(o,p=.55)=>{ const sp=SP(o.name); if(!sp.brk) return; brkPts.push([o.x+sp.brk[0],o.y+sp.brk[1]]); if(!chance(p)) return;
    const s=Math.sign(sp.brk[0])||1, bx=o.x+sp.brk[0]+s*(8+rnd()*6), by=o.y+sp.brk[1]+8+rnd()*8;
    place(pick(['blocks_a','blocks_b']),bx,by,{grp:o.grp}); };
  /* 倒れた石柱：折れ口（西の端）を柱の跡に寄せ、柱頭は東へ */
  const toppled=(sx,sy,grp)=>{ const nm=pick(['fallen_a','fallen_b','fallen_c']), sp=SP(nm);
    for(const dy of [6,14,-2]){ const o=place(nm, sx+8-sp.brk[0], sy+dy-sp.brk[1],{grp}); if(o){ brkPts.push([sx+8,sy+dy]); return o; } } return null; };
  const colName=()=>{ const r=rnd(); return r<.34?'col_a':r<.62?'col_d':r<.82?'col_b':'col_c'; };
  /* 石屑（当たり判定なし）：建物の跡の周り2マスに4〜8つ。6割は折れ口の3マス以内、浅瀬に寄せる */
  const halo=(fx,fy,fw,fh,from)=>{ const n=4+Math.floor(rnd()*5), pts=brkPts.slice(from);
    for(let i=0;i<n;i++){ let best=null, bs=-1;
      for(let k=0;k<6;k++){ let x,y;
        if(pts.length&&chance(.6)){ const [bx,by]=pick(pts), a=rnd()*6.283, d=6+rnd()*40; x=bx+Math.cos(a)*d; y=by+Math.abs(Math.sin(a))*d*.8; }
        else { x=(fx-2+rnd()*(fw+4))*Q; y=(fy-1+rnd()*(fh+3))*Q; }
        const tx=Math.floor(x/Q), ty=Math.floor(y/Q); if(!f.g[ty]||f.g[ty][tx]!==T.FLOOR||!roomOf(f,tx,ty)||rock(x,y)||rock(x+6,y)||rock(x-6,y)) continue;
        const tr=tier(tx,ty); if(tr>=2) continue; const sc=(tr===1?2:1)+rnd();
        if(sc>bs){ bs=sc; best=[x,y]; } }
      if(best) out.push({k:'rubble',x:Math.round(best[0]),y:Math.round(best[1]),s:(rnd()*1e9)|0,ok:1}); } };
  /* ---- 建物の跡 ---- */
  let grpN=0; const cornerUsed=new Set();
  const building=(r)=>{
    const fw=Math.min(r.w-2, 8+Math.floor(rnd()*5)), fh=Math.min(r.h-3, 6+Math.floor(rnd()*3));
    if(fw<7||fh<5) return false;
    // 置き場所の候補を点数順に。浅瀬に掛かる所・帯を跨がない所が上
    const cand=[];
    for(let i=0;i<16;i++){
      const fx=r.x+1+Math.floor(rnd()*Math.max(1,r.w-1-fw)), fy=r.y+2+Math.floor(rnd()*Math.max(1,r.h-2-fh));
      let sc=rnd()*2;
      for(let y=fy;y<fy+fh;y++)for(let x=fx;x<fx+fw;x++){ const t=tier(x,y), edge=y===fy||x===fx||x===fx+fw-1;
        if(t===1) sc+=edge?1.2:.5; else if(t===2) sc-=edge?.6:.2; else if(t>=3) sc-=3;
        if(edge&&RB.at(x,y)) sc-=1.4; }
      cand.push([sc,fx,fy]); }
    cand.sort((a,b)=>b[0]-a[0]);
    for(const [,fx,fy] of cand.slice(0,4)){
      const g=++grpN, bp0=brkPts.length;
      const ok=trial(()=>{
        const N=fy*Q+8, Wx=fx*Q+8, Ex=(fx+fw-1)*Q+8, Sy=(fy+fh-1)*Q+8, dx=(fx+(fw>>1))*Q+8, o_={grp:g};
        // 床の敷石が「ここに一つの建物があった」をつなぐ。戸口から北の壁へ向けて、継ぎ足しながら2〜4枚
        { const pv=['pave_a','pave_b','pave_c'].sort(()=>rnd()-.5); let px=dx, py=Sy-Q*1.1, n=0;
          for(let i=0;i<6&&n<4&&py>N+Q*.6;i++){ const nm=pv[i%3], sp=SP(nm);
            let o=null; for(const ox of [0,-Q,Q]) if(!o) o=place(nm,px+ox,py-sp.fp[3]+4,o_);
            if(o){ n++; px=o.x+(rnd()-.5)*Q*1.6; py=o.y+sp.fp[1]+4; } else py-=Q; }
          if(n<3&&chance(.6)) place(pv[2],(fx+2+rnd()*(fw-4))*Q,(fy+2+rnd()*(fh-3))*Q,o_); }
        // 角は1つまで。半分は角の部品を使わず、壁の切れ端と東西の壁で角を作る。同じ角は1階に1度
        const useCorner=chance(.5), side=chance(.5)?'nw':'ne';
        const nw=useCorner&&side==='nw'&&!cornerUsed.has('nw')?place('corner_nw',Wx,N,o_):null;
        const ne=useCorner&&side==='ne'&&!cornerUsed.has('ne')?place('corner_ne',Ex,N,o_):null;
        // 北の壁：角の先から東へ、切れ切れに
        let x=nw?Wx+SP('corner_nw').fp[2]+Q*(1+Math.floor(rnd()*2)):fx*Q+Math.floor(rnd()*Q);
        const xEnd=ne?Ex+SP('corner_ne').fp[0]-Q:(fx+fw)*Q;
        for(let k=0;k<4&&x<xEnd-2*Q;k++){
          const fits=['wall_a','wall_b','wall_c','wall_d','wall_e','wall_f'].filter(n=>x+SP(n).fp[2]-SP(n).fp[0]<=xEnd);
          if(!fits.length) break;
          const nm=pick(fits), sp=SP(nm), w=sp.fp[2]-sp.fp[0];
          if(chance(.75)){ const o=place(nm,x-sp.fp[0],N,o_); if(o) rubbleAt(o); }
          x+=w+Q*(1+Math.floor(rnd()*2)); }
        // 東西の壁（角が無い側だけ）
        const sideFor=h=>h>=8&&chance(.5)?'side_b':pick(['side_a','side_c']);
        if(!nw&&chance(.55)){ const nm=sideFor(fh), sp=SP(nm); place(nm,Wx,N+Q-sp.fp[1],o_); }
        if(!ne&&chance(.55)){ const nm=sideFor(fh), sp=SP(nm); place(nm,Ex,N+Q-sp.fp[1],o_); }
        // 南の戸口：柱2本（立っていない方は切り株と、脇に倒れた柱）、前に段
        for(const s of [-1,1]){ const cx=dx+s*2*Q;
          if(chance(.55)) place(colName(),cx,Sy,{dry:true,role:'door',grp:g});
          else if(chance(.6)){ if(place('col_c',cx,Sy,{dry:true,role:'door',grp:g})) toppled(cx,Sy,g); } }
        if(chance(.5)) place('steps_a',dx,Sy+Q+4,o_);
        if(chance(.45)) place(pick(['stele_a','stele_b']),(fx+2+Math.floor(rnd()*(fw-4)))*Q+8,N+2*Q,o_);
        // 広い跡には、中に柱の列（見本の列柱の広間）。抜けた所は切り株
        if(fh>=7&&fw>=9&&chance(.5)){ const y=N+3*Q;
          for(let tx=fx+2;tx<fx+fw-1;tx+=3){ const q=rnd(); if(q<.5) place(colName(),tx*Q+8,y,{dry:true,role:'row',grp:g}); else if(q<.65) place('col_c',tx*Q+8,y,{dry:true,role:'row',grp:g}); } }
      }, ps=>{ const big=ps.filter(o=>o.k==='rbig');
        return big.length>=5 && big.some(o=>/^(wall|corner|side)_/.test(o.name)) && big.some(o=>/^pave_/.test(o.name)); });
      if(ok){ halo(fx,fy,fw,fh,bp0); out.forEach(o=>{ if(o.grp===g&&/^corner_/.test(o.name||'')) cornerUsed.add(o.name.slice(7)); }); return true; }
      brkPts.length=bp0; }
    return false;
  };
  /* ---- 列柱（細長い部屋）：3マスおき、所々折れて、1本は倒れる ---- */
  const colonnade=(r)=>{
    const horiz=r.w>=r.h, g=++grpN; let fell=false;
    if(horiz){ const y=(chance(.5)?r.y+2:r.y+r.h-2)*Q+8;
      for(let tx=r.x+2+Math.floor(rnd()*2);tx<r.x+r.w-1;tx+=3){ const cx=tx*Q+8, q=rnd();
        if(q<.12) continue; if(q<.26){ if(place('col_c',cx,y,{dry:true,role:'colonnade',grp:g})&&!fell&&toppled(cx,y,g)) fell=true; continue; }
        place(colName(),cx,y,{dry:true,role:'colonnade',grp:g}); }
      // 柱の並びの足もとに、途切れ途切れの敷石の帯（列柱の回廊だった所）
      for(let px=r.x*Q+Q*2.5+rnd()*Q;px<(r.x+r.w)*Q-Q*2;px+=Q*(3+rnd()*1.5)) if(chance(.6)) place(pick(['pave_a','pave_c']),px,y+Q*.4,{grp:g}); }
    else{ const x=(chance(.5)?r.x+2:r.x+r.w-3)*Q+8;
      for(let ty=r.y+3+Math.floor(rnd()*2);ty<r.y+r.h-1;ty+=3){ const cy=ty*Q+8, q=rnd();
        if(q<.15) continue; place(q<.3?'col_c':colName(),x,cy,{dry:true,role:'colonnade',grp:g}); } }
  };
  /* ---- 欠片：石碑／石塊の山／倒れた柱と切り株／壁の切れ端／（街区だけ）柱が2本 ---- */
  const spot=(r)=>{ for(let i=0;i<8;i++){ const x=(r.x+1+Math.floor(rnd()*Math.max(1,r.w-2)))*Q+8, y=(r.y+2+Math.floor(rnd()*Math.max(1,r.h-3)))*Q+8;
      if(!RB.at(Math.floor(x/Q),Math.floor(y/Q))) return [x,y]; } return null; };
  const fragment=(r,district)=>{ const p=spot(r); if(!p) return; const [x,y]=p, q=rnd(), g=++grpN;
    const W_=district?[.22,.44,.64,.82]:[.3,.6,.85,1.01];
    if(q<W_[0]) place(pick(['stele_a','stele_b']),x,y,{grp:g});
    else if(q<W_[1]){ place('blocks_a',x,y,{grp:g}); place('blocks_b',x+14+rnd()*6,y+6,{grp:g}); out.push({k:'rubble',x:x+4,y:y+14,s:(rnd()*1e9)|0,ok:1}); }
    else if(q<W_[2]){ if(place('col_c',x,y,{dry:true,role:'stray',grp:g})) toppled(x,y,g); else toppled(x-8,y,g); }
    else if(q<W_[3]){ const o=place(pick(['wall_f','wall_d','wall_b']),x,y,{grp:g}); if(o) rubbleAt(o,.8); }
    else { place(colName(),x,y,{dry:true,role:'frag',grp:g}); if(chance(.6)) place(colName(),x+3*Q,y,{dry:true,role:'frag',grp:g}); } };
  /* ---- 割り振り ---- */
  const rooms=(f.rooms||[]).filter(r=>r!==f.start&&r.w>=5&&r.h>=4);
  const used=new Set(), long=r=>(r.w>=14&&r.h<=10)||(r.h>=14&&r.w<=10);
  const big=rooms.filter(r=>r.w>=10&&r.h>=8).sort(()=>rnd()-.5);
  const nDist=rooms.length>=16?2:1;
  let made=0;
  for(const c of big){ if(made>=nDist) break; if(used.has(c)) continue;
    if(!building(c)) continue;
    made++; used.add(c);
    // 街区：中ほどが近い部屋を2〜3つ
    const near=rooms.filter(r=>r!==c&&!used.has(r)&&Math.hypot(r.cx-c.cx,r.cy-c.cy)<20).sort((a,b)=>Math.hypot(a.cx-c.cx,a.cy-c.cy)-Math.hypot(b.cx-c.cx,b.cy-c.cy)).slice(0,2+Math.floor(rnd()*2));
    for(const r of near){ used.add(r); if(long(r)) colonnade(r); else { fragment(r,true); if(chance(.4)) fragment(r,true); } }
  }
  for(const r of rooms){ if(used.has(r)) continue;
    if(long(r)&&chance(.4)){ used.add(r); colonnade(r); continue; }
    if(chance(.22)){ used.add(r); fragment(r,false); } }
  /* 柱は遺跡の4割まで（細い柱ばかりだと「柱が立っているだけ」に見える）。ぽつんと立つ物から抜く */
  const isCol=o=>o.k==='rbig'&&/^col_/.test(o.name);
  for(const role of ['frag','stray','row','door','colonnade']){
    for(const o of out.filter(o=>isCol(o)&&o.role===role).sort(()=>rnd()-.5)){
      const big=out.filter(o=>o.k==='rbig'), nc=big.filter(isCol).length; if(nc<=big.length*.4) break;
      if(o.name==='col_c'&&out.some(p=>p.grp===o.grp&&/^fallen_/.test(p.name||''))) continue;   // 倒れた柱の切り株は残す
      out.splice(out.indexOf(o),1); } }
  /* 描く順：平たい物（敷石・段・石屑）を先に、立ち物は北から */
  out.sort((a,b)=>{ const fa=a.k!=='rbig'||FLAT(a.name)?0:1, fb=b.k!=='rbig'||FLAT(b.name)?0:1; return fa-fb||a.y-b.y; });
  return out;
}
/* 部屋の中を歩いて、入口どうしがつながっているか（塞いだマス・淵・壁は通れない） */
function roomConnected(f,r,opens,blocked,tier){
  if(opens.length<1) return true;
  const ok=(x,y)=>x>=r.x-1&&x<=r.x+r.w&&y>=r.y-1&&y<=r.y+r.h&&f.g[y]&&f.g[y][x]===T.FLOOR&&!blocked.has(x+','+y)&&tier(x,y)<3;
  const seen=new Set(), q=[opens[0]]; seen.add(opens[0][0]+','+opens[0][1]);
  while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy, k=nx+','+ny; if(seen.has(k)||!ok(nx,ny)) continue; seen.add(k); q.push([nx,ny]); } }
  if(!opens.every(([x,y])=>seen.has(x+','+y))) return false;
  // 部屋の真ん中にも行けること（宝や敵に届かない場所を作らない）
  const cx=r.x+(r.w>>1), cy=r.y+(r.h>>1); return seen.has(cx+','+cy) || blocked.has(cx+','+cy)===false && !ok(cx,cy);
}
/* 置いた遺跡の当たりの中に入ってしまった敵・落とし物を外へ出す */
function ruinUnstick(){
  const free=(x,y)=>!obsHit(x,y)&&!(typeof solid==='function'&&solid(x,y));
  const out=e=>{ if(!e||!Number.isFinite(e.x)||!obsHit(e.x,e.y)) return;
    for(let rad=.5;rad<4;rad+=.5) for(let a=0;a<12;a++){ const x=e.x+Math.cos(a*.5236)*rad, y=e.y+Math.sin(a*.5236)*rad; if(free(x,y)){ e.x=x; e.y=y; return; } } };
  (W.enemies||[]).forEach(out); (W.drops||[]).forEach(out);
}
/* ---------- 立ち物と壁 ----------
   ユーザー指摘（2026-10-01）「壁際に置くと、壁は真上から見た形なのに、置いた物は斜めから見た形なので角度がおかしく見える」。
   壁（岩）は真上から見た面として描いていて、正面（立ち上がり）が無い。そこへ斜め上から見た柱や葦を壁際に立てると、
   上の方が壁の天面に乗り上げる（＝岩の上に描かれる）か、岩に削られて途中で切れる（dp は岩の上に描かない）。
   どちらも「角度が合っていない」に見える。だから**高さのある物は、絵の全体が床の上に収まる所にだけ立てる**:
   壁に掛かるなら壁から離れる向き（北の壁なら南へ、高さのぶん）へずらし、ずらしきれなければ置かない。
   壁に貼り付く物（苔・貝・蔓・垂れ下がる蔦・根）と、ほぼ平たい物は今まで通り壁際でよい。 */
function standBox(o){                 // 錨点からの絵の外枠 [左, 上, 右, 下]（ドット）。平たい物は null
  const cs=(o.k==='rock'||o.k==='stalagC')&&caveSprFor(o); if(cs) return [-cs.ax,-cs.ay,cs.w-cs.ax-1,cs.h-cs.ay-1];
  switch(o.k){
    case 'reed': return [-10,-23,9,1];
    case 'weed': return [-6,-17,7,1];
    case 'crystal': return [-3,-7,3,1];
    case 'shroom': return [-5,-8,9,1];
    case 'pillar': return G&&G.Z.id==='sump'?[-5,-18,5,1]:[-7,-30,6,2];
    case 'wpost': return [-5,-18,5,1];
    case 'wwall': { const w=wwallW(o); return [-(w>>1)-1,-12,(w>>1)+1,2]; }
    case 'brokenwall': { const w=24+o.s%14; return [-(w>>1)-1,-14,(w>>1)+1,1]; }
    case 'arch': return [-12,-26,12,1];
    case 'lamppost': return [-2,-15,2,1];
    case 'colonnade': return (o.wdy? [-26,-33,26,1] : [-6,-53,6,22]);
    case 'boiler': return [-8,-35,8,1];
    case 'cairn': return [-3,-9,3,1];
    case 'frame': return [-5,-13,5,1];
    case 'palegrass': return [-5,-9,5,1];
  }
  return null;
}
function standClear(f,list){
  const rock=(x,y)=>field(f,G.L,Math.round(x),Math.round(y))>.5;
  const wg=(W.haz&&W.haz.kind==='water')?W.haz.g:null, wet=(x,y)=>{ const tx=Math.floor(x/Q), ty=Math.floor(y/Q); return !!(wg&&wg[ty]&&wg[ty][tx]); };
  const floorAt=(x,y)=>{ const tx=Math.floor(x/Q), ty=Math.floor(y/Q); return f.g[ty]&&f.g[ty][tx]===T.FLOOR; };
  const hits=(o,bx,x,y)=>{ let n=0, sx=0, sy=0;
    for(let py=y+bx[1];py<=y+bx[3];py+=2) for(let px=x+bx[0];px<=x+bx[2];px+=2) if(rock(px,py)){ n++; sx+=px-x; sy+=py-y; }
    return n?[n,sx/n,sy/n]:null; };
  const out=[];
  for(const o of list){
    const bx=standBox(o); if(!bx){ out.push(o); continue; }
    const h0=hits(o,bx,o.x,o.y); if(!h0){ out.push(o); continue; }
    // 離れる向き：壁際に置いた物は壁と逆へ、それ以外は岩の重心と逆へ
    let ux=-(o.wdx||0), uy=-(o.wdy||0); if(!ux&&!uy){ const l=Math.hypot(h0[1],h0[2])||1; ux=-h0[1]/l; uy=-h0[2]/l; }
    const far=Math.abs(uy)>Math.abs(ux)? (bx[3]-bx[1])+6 : (bx[2]-bx[0])+6, w0=wet(o.x,o.y);
    let ok=false;
    for(let d=2;d<=far&&!ok;d+=2){ const x=Math.round(o.x+ux*d), y=Math.round(o.y+uy*d);
      if(!floorAt(x,y)||wet(x,y)!==w0) break;           // 床が尽きた・水に入った／出た所で諦める
      if(!hits(o,bx,x,y)){ o.x=x; o.y=y; o.ok=1; o.moved=d; ok=true; } }
    if(ok) out.push(o);                                  // ずらしきれない物は置かない
  }
  return out;
}
function genDeco(f,Z){
  const set=DECO_SET[Z.id]||DECO_SET.stone, depth=(S.run&&S.run.depth)||1;
  let out=[];
  const haz=W.haz, water=haz&&haz.kind==='water'?haz.g:null;
  for(let ty=1;ty<f.H-1;ty++)for(let tx=1;tx<f.W-1;tx++){
    if(f.g[ty][tx]!==T.FLOOR) continue;
    if(f.stair&&Math.hypot(tx+.5-f.stair.x,ty+.5-f.stair.y)<2) continue;
    const inW=water&&water[ty]&&water[ty][tx];
    const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>f.g[ty+dy][tx+dx]===T.WALL||f.g[ty+dy][tx+dx]===T.PIT);
    const hz=haz&&!water&&haz.g[ty]&&haz.g[ty][tx];
    for(let n=0;n<set.length;n++){const [kind,where,p,minDep]=set[n];
      if(minDep && zoneFloor(depth)<minDep) continue;   // その層の中でも、深い側にだけ出る品目（層の何階目かで見る＝二周目も同じ）
      const h=hs(tx*92821+ty*68917+depth*31,n+1), r=(h%100000)/100000;
      if(r>=p*(DECO_MUL[Z.id]||1)*(kind==='pool'?poolMore(depth):1)) continue;
      if(where==='water'&&!inW) continue;
      if(inW){ const tier=water[ty][tx];                          // 1浅瀬／2深み／3淵
        if(kind==='wfallen'&&tier>2) continue;
        if(kind==='sunken'&&tier<2) continue;                     // 沈んだ跡は深みにだけ見える
        if((kind==='wsteps'||kind==='wwall')&&tier!==1) continue; // 飛び石と崩れ壁は浅瀬に
        if(kind==='wpost'&&tier>2) continue; }
      if(where!=='water'&&(inW||hz)) continue;
      if(where==='wall'&&!nb.length) continue;
      const fl=(x,y)=>f.g[y]&&f.g[y][x]===T.FLOOR, wl=(x,y)=>!f.g[y]||f.g[y][x]===T.WALL;
      const nearStart=f.start&&Math.hypot(tx-f.start.cx,ty-f.start.cy)<3;
      if(where==='open'){ if(nearStart) continue; let ok=true; for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=1;dx++) if(!fl(tx+dx,ty+dy)){ok=false;break;} if(!ok) continue;
        if(kind==='ruinroom'){                                         // 部屋の残骸は 5×4 マスの床が要る。入口と穴からは離す
          for(let dy=-3;dy<=2&&ok;dy++)for(let dx=-3;dx<=3;dx++) if(!fl(tx+dx,ty+dy)){ok=false;break;}   // 3Dの部屋は 7×6 マス
          if(!ok||Math.hypot(tx-f.start.cx,ty-f.start.cy)<6||(f.stair&&Math.hypot(tx+.5-f.stair.x,ty+.5-f.stair.y)<4)) continue;
          if(out.some(o=>o.k==='ruinroom'&&Math.hypot(o.x-tx*Q,o.y-ty*Q)<Q*9)) continue; } }
      let cdx=0,cdy=0;
      if(where==='corner'){ if(nearStart) continue; let found=false;
        for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ if(wl(tx+dx,ty)&&wl(tx,ty+dy)&&fl(tx-dx,ty)&&fl(tx,ty-dy)&&fl(tx-dx,ty-dy)&&fl(tx-2*dx,ty)&&fl(tx,ty-2*dy)){cdx=dx;cdy=dy;found=true;break;} }
        if(!found) continue; }
      if(where==='north'&&!wl(tx,ty-1)) continue;
      let x=tx*Q+8+((h>>>8)%7)-3, y=ty*Q+8+((h>>>12)%7)-3, wdx=0, wdy=0;
      if(where==='wall'){ const [dx,dy]=nb[(h>>>16)%nb.length], o=f.g[ty+dy][tx+dx]===T.PIT?2:6; wdx=dx; wdy=dy; x=tx*Q+8+dx*o; y=ty*Q+8+dy*o; }
      if(where==='corner'){ x=tx*Q+8+cdx*3; y=ty*Q+8+cdy*3+2; wdx=cdx; wdy=cdy; }
      if(kind==='pool'&&where==='corner'){ x=tx*Q+8+cdx*5; y=ty*Q+8+cdy*5; }
      if(kind==='pool'&&where==='wall'){ x=tx*Q+8+wdx*4; y=ty*Q+8+wdy*4; }
      if(where==='north'){ x=tx*Q+2+(h>>>8)%12; y=ty*Q-2; wdx=0; wdy=-1; }
      const o={k:kind,x,y,s:h,wdx,wdy,ok:0};
      if(kind==='pool'){ poolShape(o,h,poolGrow(depth)); o.ok=1;
        /* 角・壁に寄せた中心から、大きさに応じて床の側へ少し戻す。
           中心を角に置いたままだと、形の大半が壁に埋もれて大きくしても見える量が増えない。 */
        const back=o.ext*(where==='corner'?.3:.25); o.x=Math.round(o.x-wdx*back); o.y=Math.round(o.y-wdy*back); }
      out.push(o); break; }
  }
  /* 岩と重ねない。岩・石筍に近い水溜りは置かない（岩が水に浸かって見える）。
     水溜りの中に来た骨・小石・苔の足場は、水溜りのほうを残して捨てる。 */
  out.forEach(o=>{ const cs=(o.k==='rock'||o.k==='stalagC')&&caveSprFor(o); if(cs) o.ext=Math.max(cs.w,cs.h)*.6; });   // 画面の端で切らない
  out=standClear(f,out);                                // 立ち物は絵ごと床の上に（壁に掛かる物は床の側へ出す）。水溜りとの距離はずらした後で見る
  const ROCKS={rock:22,stalagC:16}, SMALL={skel:1,pebble:1,mossbed:1};
  const rocks=out.filter(o=>ROCKS[o.k]);
  let res=out.filter(o=>o.k!=='pool'||!rocks.some(r=>Math.hypot(r.x-o.x,r.y-o.y)<o.ext*.8+ROCKS[r.k]));
  const pools=res.filter(o=>o.k==='pool');
  res=res.filter(o=>!SMALL[o.k]||!pools.some(p=>Math.hypot(p.x-o.x,p.y-o.y)<p.ext+4));
  G.pools=pools;
  G.drips=genDrips(f,pools,depth);
  /* 水の層の立った柱は、岩と同じく当たり判定を持つ（すり抜けると柱に見えない）。
     壁際にしか立たないので、通路を塞ぐことは無い。倒れた柱（fallen）は跨げる高さなので持たない。 */
  if(Z.id==='sump' && zoneFloor(depth)>=6 && RUIN_USE_3D && RUIN_BIG){
    res=res.filter(o=>!(o.k==='wpost'||o.k==='wwall'||o.k==='wfallen') || ruinSpotOK(f,o.x,o.y,o.k==='wfallen'?3:1.5));
    const rb=genRuinDressing(f,depth,res), under=new Set(); rb.forEach(o=>{ (o.cells||[]).forEach(k=>under.add(k)); delete o.cells; });
    // 置いた遺跡の足元（と周り1マス）に来た水の中の柱・崩れ壁・倒れた柱は抜く（重なって見えるので）
    const near=(o)=>{ const tx=Math.floor(o.x/Q), ty=Math.floor(o.y/Q); for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) if(under.has((tx+dx)+','+(ty+dy))) return true;
      // 水の中の角柱は、遺跡の6マス以内に置かない（細い柱が同じ形で重なって見える）
      return o.k==='wpost' && rb.some(p=>p.k==='rbig'&&Math.hypot(p.x-o.x,p.y-o.y)<6*Q); };
    res=res.filter(o=>!(o.k==='wpost'||o.k==='wwall'||o.k==='wfallen'||o.k==='wsteps'||o.k==='sunken') || !near(o));
    res.push(...rb);
  }
  if(Z.id==='sump') for(const o of res){
    // 壁に半分埋まると細い棒にしか見えなかったので、床の側へ寄せて丸ごと見せる
    if(o.k==='pillar'){ o.x=Math.round(o.x-(o.wdx||0)*6); o.y=Math.round(o.y-(o.wdy||0)*5); addObs(o.x, o.y-1, 5); }
    else if(o.k==='wpost') addObs(o.x, o.y-1, 4.5);
    else if(o.k==='wwall'){ const w=wwallW(o); for(let q=-w/2+3;q<=w/2-3;q+=5) addObs(o.x+q, o.y-1, 3.5); }
    if(o.k==='fallen'||o.k==='wfallen') o.ext=40; if(o.k==='ruinroom') o.ext=62;      // 大きいので画面の端で切らない
    const bigS=ruinBigFor(o);
    if(bigS){ for(const [dx,dy,r] of bigS.obs) addObs(o.x+dx, o.y+dy, r); }
    else if(o.k==='fallen'||o.k==='wfallen'){ const g=fallenGeo(o); for(const dr of g.drums) for(let x=dr.x+3;x<dr.x+dr.w;x+=5) addObs(x, dr.y+Math.round((x-dr.x)*dr.sl)+dr.D-4, 4.5);
      const cd=g.capL?g.drums[0]:g.drums[g.drums.length-1]; addObs(g.capL?cd.x-g.capW/2+3:cd.x+cd.w+g.capW/2-3, cd.y+cd.D-3, 6); }
    else if(o.k==='ruinroom'){ for(const e of ruinRoomLayout(o).els){ if(e.tilt) continue;
      if(e.t==='side') for(let yy=e.y-e.len+2;yy<=e.y;yy+=4) addObs(e.x+e.w/2, yy-1, 3.2);
      else for(let q=2;q<e.w;q+=4) addObs(e.x+q, e.y-1, 3); } }
    else if(o.k==='colonnade'){ const ax=-(o.wdy||0), ay=(o.wdx||0), bx=o.x-(o.wdx||0)*2, by=o.y-(o.wdy||0)*2;
      for(let i=0;i<3;i++){ if(i===1&&o.s%3===0) continue; addObs(bx+ax*(i-1)*20, by+ay*(i-1)*20-1, 4); } } }
  if(Z.id==='sump') ruinUnstick();                      // 遺跡の当たりに埋まった敵・落とし物を外へ
  return res;
}
/* 水溜りの形。楕円1つだと、並んだときに全部同じ判子に見える（報告「楕円ばかりで不自然」）。
   傾けた楕円（葉）を何枚か重ね、縁をノイズで崩す。形は5通りから引く:
     ・ふくらみ … 大きな葉に小さな葉が1〜2枚くっつく（いちばん多い）
     ・細長い   … 葉を一列に並べ、傾けた「溝に溜まった水」
     ・くびれ   … 同じくらいの葉2枚が浅くつながる（瓢箪・腎臓形）
     ・小さな丸 … 小さく丸い1枚
     ・飛び石   … 本体の横に、離れた小さな水溜りが1〜2個
   上から見下ろす絵なので、葉は横長（縦は横の0.45〜0.8倍）を基本にする。 */
function poolShape(o,h,g){
  const r=i=>(hs(h,i+300)%10000)/10000;
  const kinds=['blob','blob','blob','long','neck','round','spots'], kind=kinds[hs(h,299)%kinds.length];
  const R=5.5+r(0)*4.5+g, lobes=[];
  const lobe=(ox,oy,rx,ry,a)=>lobes.push({ox,oy,rx,ry,c:Math.cos(a),s:Math.sin(a)});
  const tilt=(r(1)-.5)*.9;
  if(kind==='round'){ const rr=3.5+r(2)*2.5+g*.7; lobe(0,0,rr,rr*(.65+r(3)*.2),tilt*.5); }
  else if(kind==='long'){ const n=3+(hs(h,298)%2), step=R*.75, ca=Math.cos(tilt*1.3), sa=Math.sin(tilt*1.3);
    for(let i=0;i<n;i++){ const k=i-(n-1)/2, w=R*(.55+r(10+i)*.3); lobe(ca*k*step, sa*k*step*.6+(r(20+i)-.5)*2, w, w*(.45+r(30+i)*.15), tilt*1.3); } }
  else if(kind==='neck'){ const a=tilt, d=R*(.8+r(4)*.3);
    lobe(-Math.cos(a)*d*.5,-Math.sin(a)*d*.3,R*.7,R*.7*(.55+r(5)*.2),a);
    lobe( Math.cos(a)*d*.5, Math.sin(a)*d*.3,R*(.55+r(6)*.2),R*.55*(.55+r(7)*.25),-a*.5); }
  else { lobe(0,0,R,R*(.5+r(8)*.25),tilt);
    const n=kind==='spots'?1:1+(hs(h,297)%2);
    for(let i=0;i<n;i++){ const a=r(40+i)*6.2831853, d=R*(.55+r(50+i)*.35), rr=R*(.35+r(60+i)*.3);
      lobe(Math.cos(a)*d, Math.sin(a)*d*.55, rr, rr*(.55+r(70+i)*.25), (r(80+i)-.5)*1.2); }
    if(kind==='spots'){ const m=1+(hs(h,296)%2);
      for(let i=0;i<m;i++){ const a=r(90+i)*6.2831853, d=R*(1.45+r(95+i)*.5), rr=1.8+r(99+i)*1.8;
        lobe(Math.cos(a)*d, Math.sin(a)*d*.55, rr, rr*.7, 0); } } }
  let ext=0; for(const l of lobes) ext=Math.max(ext, Math.hypot(l.ox,l.oy)+Math.max(l.rx,l.ry)+2);
  o.lobes=lobes; o.ext=Math.ceil(ext);
}
/* その点が水溜りの中か。1以上＝内側の深さの目安（0で縁）。ノイズで縁を崩す。 */
function poolRaw(o,dx,dy){
  let v=-1;
  for(const l of o.lobes){ const x=dx-l.ox, y=dy-l.oy, u=(x*l.c+y*l.s)/l.rx, w=(-x*l.s+y*l.c)/l.ry; const q=1-(u*u+w*w); v=smax(v,q,.3); }
  return v;
}
/* 滑らかな最大（2つの形の間を、近ければ橋を架けるようにつなぐ）。k が大きいほど太くつながる。 */
function smax(a,b,k){ const h=Math.max(k-Math.abs(a-b),0)/k; return Math.max(a,b)+h*h*k*.25; }
const poolNoise=(px,py)=>(NZ[((py&255)<<8)|(px&255)]-.5)*.7+(NZS[(((py+60)&255)<<8)|((px+30)&255)]-.5)*.35;
/* 重なった水溜りは**1つの形**として扱う（報告「重なる場合は結合した形に」）。
   それぞれの形を滑らかな最大で足し合わせ、縁はその合わさった形の外周にだけ引く——
   2つの縁が水の中を横切ることがなくなる。list は近くの水溜り。best に一番効いている水溜りを返す。 */
let poolBest=null;
function poolU(list,px,py){
  let v=-1; poolBest=null; let bv=-9;
  for(const o of list){ const dx=px-o.x, dy=py-o.y; if(dx<-o.ext||dx>o.ext||dy<-o.ext||dy>o.ext) continue;
    const q=poolRaw(o,dx,dy); if(q>bv){bv=q;poolBest=o;} v=smax(v,q,.45); }
  return v<=-1 ? -1 : v+poolNoise(px,py);
}
function poolV(o,dx,dy,px,py){ return poolRaw(o,dx,dy)+poolNoise(px,py); }
function zoneFloor(depth){ return ((Math.max(1,depth)-1)%10)+1; }
/* 石の層の後半（第6〜第10階層）の水溜り。**水の層へ近づくほど広がる。**
   数は増やさず、一つずつを大きくする——数で増やしたら第9階層が水溜りだらけで
   気持ち悪い、という指摘があった。第10階層で半径が第6階層の約1.7倍（面積で約3倍）。
   層は一周するので、階の数ではなく「層の中の何階目か」で決める。 */
function poolMore(depth){ return 1; }
function poolGrow(depth){ return Math.max(0,zoneFloor(depth)-6)*1.4; }
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
function dpw(x,y,c,m){ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=G.PW||y>=G.PH||G.code[y*G.PW+x]) return; x-=DB0x; y-=DB0y; if(x>=0&&y>=0&&x<bw&&y<bh){ buf[y*bw+x]=c; wmask[y*bw+x]=m; } }
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
function wwallW(d){ return 20+d.s%14; }
function rockShape(d){ const s=d.s; return {w:4+s%4, H:7+(s>>>3)%5, two:s%3===0, w2:2+(s>>>6)%2, H2:3+(s>>>7)%3}; }
function stampEll(cx,cy,rx,ry){
  const {code,nx,ny,PW,PH}=G;
  for(let yy=-ry;yy<=ry;yy++)for(let xx=-rx;xx<=rx;xx++){ const ex=xx/(rx+.5), ey=yy/(ry+.5), dd=Math.sqrt(ex*ex+ey*ey); if(dd>1) continue;
    const X=cx+xx, Y=cy+yy; if(X<0||Y<0||X>=PW||Y>=PH) continue; const i=Y*PW+X;
    const e=Math.min(5,1+Math.floor((1-dd)*Math.min(rx,ry)*1.2)); if(code[i]&&code[i]<=e) continue;
    code[i]=e; const l=Math.hypot(ex,ey)||1; nx[i]=Math.round(ex/l*127); ny[i]=Math.round(ey/l*127); }
}
function stampRocks(){
  for(const d of G.deco){ if(d.st||(d.k!=='rock'&&d.k!=='stalag'&&d.k!=='stalagC'&&d.k!=='rbig'&&d.k!=='wpost')) continue;
    const ci=(d.x|0)>>5, cj=(d.y|0)>>5; if(ci<0||cj<0||ci>=G.cw||cj>=G.ch) continue;
    let ok=true; for(let j=cj-1;j<=cj+1;j++)for(let i=ci-1;i<=ci+1;i++) if(i>=0&&j>=0&&i<G.cw&&j<G.ch&&!G.done[j*G.cw+i]) ok=false;
    if(!ok) continue;
    if(d.k==='rbig'||d.k==='wpost'){ const x=d.x|0, y=d.y|0;                       // 遺跡：乾いた床の上の当たりの所だけ小さく岩に（ランタンの影がその場で落ちる）。水の上は焼かない
      const wg=(W.haz&&W.haz.kind==='water')?W.haz.g:null, dry=(px,py)=>{ const tx=Math.floor(px/Q), ty=Math.floor(py/Q); return !(wg&&wg[ty]&&wg[ty][tx]); };
      const ob=d.k==='rbig'?((ruinBigFor(d)||{}).obs||[]):[[0,-1,4.5]];
      for(const [dx,dy,r] of ob){ if(r<2.5||!dry(x+dx,y+dy)) continue; stampEll(Math.round(x+dx),Math.round(y+dy),Math.max(1,Math.round(r*1.0)),Math.max(1,Math.round(r*.35))); }   // 横は当たりの円と同じ幅（隣とつなげて、影が櫛の歯にならないように）
      d.st=1; if(d.ok===0) d.ok=1; G.ver=(G.ver||0)+1; continue; }
    if(G.code[(d.y|0)*G.PW+(d.x|0)]){ d.st=1; d.ok=-1; continue; }   // 壁に掛かる所には置かない
    const x=d.x|0, y=d.y|0; G.ver=(G.ver||0)+1;
    const cs=caveSprFor(d);
    if(cs){ stampEll(x,y-1,Math.max(1,Math.round(cs.foot[0]*.7)),Math.max(1,Math.round(cs.foot[1]*.6))); for(const [dx,dy,r] of cs.obs) addObs(x+dx,y+dy,r*.9); }      // 3D：接地の楕円だけを岩に（灯りの影はここから落ちる）
    else if(d.k==='rock'){ const r=rockShape(d);
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
/* 水溜りをまとめて描く。重なった物は1つの形に合わさる（poolU）。
   浅い窪みに溜まった水：上の縁は窪みの影（暗い）、下の縁は光を受けて明るい——これで
   「穴」ではなく「窪みに溜まった水」と読める。面は水の層と同じ流れる水面で、
   波紋は waterPost が印（wmask=2）の上に描く。岩（壁の続き・当たり判定の円）の上には塗らない。 */
/* ---------- 雨漏り（石の層の第6〜第9階層） ----------
   天井から水滴が落ちて、水溜りに波紋を立てる（ユーザー要望「6-9階は雨漏りみたいなものを少し垂らしたい」）。
   水は漏れる所の下に溜まるので、**滴る場所は水溜りの中**を基本にし、床に落ちる物を少しだけ混ぜる。
   量は控えめ：水溜り2つに1つ前後と、床のおよそ60マスに1つ（床には濡れた染みを残す）。間隔は1滴ごとに1.6〜3.8秒。
   （「水溜り以外のところにも落ちてほしい」で床の分を4倍に増やした） */
/* 水の層（第11〜20階層）にも滴る（ユーザー要望）。天井から水面へ落ちるのを主に、床にも少し。
   水面に落ちる滴は染みを残さない（wet）。量：水面のおよそ45マスに1つ、床のおよそ110マスに1つ。 */
function genSumpDrips(f,depth){
  const out=[], wg=(W.haz&&W.haz.kind==='water')?W.haz.g:null;
  for(let ty=1;ty<f.H-1;ty++)for(let tx=1;tx<f.W-1;tx++){
    if(f.g[ty][tx]!==T.FLOOR) continue; const h=hs(tx*7919+ty*104729+depth*13,781);
    const inW=wg&&wg[ty]&&wg[ty][tx];
    if(h%1000>=(inW?22:9)) continue;
    out.push({x:tx*Q+4+(h>>>10)%9, y:ty*Q+4+(h>>>14)%9, s:h, pool:null, wet:!!inW, per:1.7+(h%997)/997*2.4, last:-1});
  }
  return out;
}
function genDrips(f,pools,depth){
  if(G&&G.Z.id==='sump') return genSumpDrips(f,depth);
  const z=zoneFloor(depth); if(!G||G.Z.id!=='stone'||z<6||z>9) return [];
  const out=[];
  for(const p of pools){ const h=hs(p.s,777); if(h%2) continue;
    const l=p.lobes[0]; out.push({x:p.x+Math.round(l.ox*.5), y:p.y+Math.round(l.oy*.5), s:h, pool:p, per:1.6+(h%1000)/1000*2.2, last:-1}); }
  for(let ty=1;ty<f.H-1;ty++)for(let tx=1;tx<f.W-1;tx++){
    if(f.g[ty][tx]!==T.FLOOR) continue; const h=hs(tx*7919+ty*104729+depth*13,778);
    if(h%1000>=16) continue;                                   // 床にも落ちる（床のおよそ60マスに1つ）
    out.push({x:tx*Q+4+(h>>>10)%9, y:ty*Q+4+(h>>>14)%9, s:h, pool:null, per:1.8+(h%997)/997*2.0, last:-1});
  }
  return out;
}
const WATER_BLEND=.7;   // 深さの境の網グラデの幅（深さの値で。1段＝1.0）
const DRIP_FALL=.34, DRIP_SPLASH=.30, DRIP_H=30;
function drawDrips(bx0,by0,t,blindR){
  if(!G.drips||!G.drips.length) return;
  const drop=C('#cfeaff'), trail=C('#6f9cc0'), spl=C('#9cc8e8');
  for(const d of G.drips){
    if(d.x<bx0-4||d.y<by0-DRIP_H-4||d.x>bx0+bw+4||d.y>by0+bh+8) continue;
    if(!seenAt(G.f,G.L,d.x|0,d.y|0)) continue;
    if(Math.hypot(d.x-lampX,d.y-lampY)>blindR) continue;
    if(!d.pool&&!d.wet){                                         // 床の滴り跡：濡れて少し暗い小さな染み
      const L=Math.max(.15,pxLight(d.x,d.y)); for(let dy=-1;dy<=1;dy++)for(let dx=-2;dx<=2;dx++){ if(Math.abs(dx)===2&&dy) continue;
        if(ihash(d.x+dx,d.y+dy)%3===0) continue; dp(d.x+dx,d.y+dy,sh3(DECO_PAL.pool,L*.9,d.x+dx,d.y+dy)); } }
    const ph=(d.s%1000)/1000*d.per, u=(t+ph)%d.per;
    if(u<DRIP_FALL){                                             // 落ちている
      const k=u/DRIP_FALL, y=d.y-DRIP_H*(1-k*k);
      dpf(d.x,y,drop); dpf(d.x,y-1,drop); dpf(d.x,y-2,trail); if(k>.4) dpf(d.x,y-3,trail);
    }else if(u<DRIP_FALL+DRIP_SPLASH){                           // 着いた
      const k=(u-DRIP_FALL)/DRIP_SPLASH;
      /* 着水は水しぶきだけ（水溜りでも床でも同じ）。水溜りに波紋を立てると、滴が落ちるたびに
         水面がずっと動いて見えた（報告）——波紋はキャラや敵が通った時だけにする。 */
      const r=1+k*4; if(k<.7) for(const [ax,ay] of [[-1,0],[1,0],[-.7,-.5],[.7,-.5]]) dpf(d.x+ax*r,d.y+ay*r,spl);
      if(k<.3) dpf(d.x,d.y,drop);
    }
  }
}
let pdone=null;
function drawPools(bx0,by0,t,blindR){
  if(!G.pools||!G.pools.length) return;
  const P_=DECO_PAL, vis=[];
  for(const d of G.pools){ const E=d.ext;
    if(d.x+E<bx0||d.y+E<by0||d.x-E>bx0+bw||d.y-E>by0+bh) continue;
    if(!seenAt(G.f,G.L,d.x|0,d.y|0)) continue;
    if(Math.hypot(d.x-lampX,d.y-lampY)>blindR+E) continue;
    d.L=Math.max(.22,pxLight(d.x,d.y)); vis.push(d); }
  if(!vis.length) return;
  if(!pdone||pdone.length!==bw*bh) pdone=new Uint8Array(bw*bh); else pdone.fill(0);
  const code=G.code, PW=G.PW;
  for(const d of vis){ const E=d.ext;
    for(let py=d.y-E;py<=d.y+E;py++)for(let px=d.x-E;px<=d.x+E;px++){
      const X=px-bx0, Y=py-by0; if(X<0||Y<0||X>=bw||Y>=bh) continue;
      const k=Y*bw+X; if(pdone[k]) continue; pdone[k]=1;
      if(px<0||py<0||px>=G.PW||py>=G.PH||code[py*PW+px]) continue;
      const v=poolU(vis,px,py); if(v<=0) continue;
      const o=poolBest||d, L=o.L;
      if(obsHit(px/Q,py/Q)) continue;
      if(v<.2){                                                   // 縁：上が外なら影、下が外なら光
        const up=poolU(vis,px,py-1)<=0, dn=poolU(vis,px,py+1)<=0;
        buf[k]= up&&!dn ? P_.poolShade : P_.poolLip; continue; }
      const lv=Math.max(0,Math.min(3,Math.floor(Math.min(1,L*1.25)*(.75+Math.min(1,v)*.25)*3.6+(BAYER[((py&3)<<2)|(px&3)]-.5)*.9)));
      buf[k]=waterSurface(P_.poolW,P_.poolGleam,lv,px,py,t,L,1,Math.sin(py*.22+t*1.7)*2,Math.sin(px*.056+t)*1.5); wmask[k]=2;
    } }
}
/* ---------- 遺跡の柱（水の層・第16〜20階層）----------
   見本（ユーザー添付の水没した遺跡の絵）に合わせた角の丸い石柱。色は拠点の広場の石。
     ・上面は角を落とした明るい面（キャップ）。その下に1ドットの縁の影
     ・光は左上から：左寄りが明るく、右へ行くほど暗く、右と下にだけ濃い輪郭
     ・数段の石積みの継ぎ目、欠け、オリーブ色の苔。三本に一本は上が折れてギザギザ
     ・水に立つ物は、水面の下も描く：水の色に混ぜて沈め、下ほど水に溶かす（屈折で一緒に揺れる）。
       水際に白い縁、右下へ水の影、根元から時々ゆっくり輪が広がる
     ・陸に立つ物は、右下へ落ちる影と、根元の小石・苔
   立っている部分は wmask を消して描く（水面の揺らぎ・波の線を乗せない）。 */
/* → 2026-10-01 第2版：上位モデルの講評（添付の見本との比較）を受けて作り直した。
     ・縦の明暗：上から2〜5行目が一番明るく、下へ行くほど暗い（根元は輪郭に近い暗さ）。帯の境は列ごとに±1ずらす
     ・横は4つの帯（左の輪郭／光の側／中間／右の輪郭）。ハイライトは中央より左。継ぎ目の縞はやめ、
       2ドット縦の塊で隣の色と入れ替えて石の肌にする（単独のドットや市松は使わない）
     ・上：0行目は中間色（暗い輪郭を上に引かない）、1行目が一番明るい面。角を落とすだけで丸く見せる
     ・水：白い泡の線はやめた。水際の2行は濡れて暗く青みがかり、水面の行は水の色と半々、
       その下は2行だけ細くなって水に溶ける。影は光と反対の右下に水の色の濃い楕円、左には細い接地の縁
     ・陸：台座の段はやめ、胴がそのまま地面に刺さる。影は地面を暗くした色で右へ。苔が根元を巻く */
const RP_T=['#3e3a3c','#5a534f','#7a6f5e','#9f906e','#c3ad98','#d6bca6','#e8d6c0'].map(C);   // 0輪郭(右) 1暗 2中暗 3中 4明 5照 6最照
const RP_OL=C('#2b2420'), RP_DARK=C('#0b0d10'), RP_WET=C('#3f4a4c'), RP_WSH=C('#174f5a'), RP_WRIM=C('#235067'), RP_WHI=C('#ffffff');
const RP_MOSS=[C('#5a5236'),C('#7a6a44'),C('#948448')];
/* 第3版（講評2回目）：上下を楕円にして円柱に見せる（上面は3行の楕円・根元は端の列が1行上・中央2列が1行下）、
   ハイライトは左から2列目だけ、右は3段で落とす、水際の濡れは列ごとに高さが揺れる、水の中は細め（5〜7）。 */
const RP_COLS={5:[1,5,3,2,0], 6:[1,5,5,3,2,0], 7:[1,5,5,4,3,2,0], 8:[1,5,5,4,4,3,2,0]};
/* ---------- 3D から作った石柱のスプライト ----------
   tools/pillar3d.py が SDF で組んだ柱を、この視点・この光で描いてドット絵に落としたもの。
   下の RUIN_SPR は**スクリプトが書き換える**（手で直さない）。RUIN_USE_3D=false で手続きの柱に戻る。 */
const RUIN_USE_3D=true;
/* ---------- 石の層の岩と石筍（3Dから。tools/cave3d.py が下の CAVE_SPR を書き換える）----------
   遺跡と違って光を焼き込まず、ドットごとの面の向き（NRM の番号）とくぼみの暗さだけを持つ。
   明るさは毎フレーム、ランタンの位置から出す（ランタンの側の面が明るい＝手描きの岩と同じ約束）。
   CAVE_USE_3D=false か CAVE.caveProc=true で手描きの岩に戻る。 */
const CAVE_USE_3D=true;
/*CAVE_SPR_BEGIN*/const CAVE_SPR={"rock_a":{"w":20,"h":18,"ax":10,"ay":11,"m":["....................","...rrrrrrmrrrr......","..rrrrrrrrrrrrrr....",".rrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrmrrrrrrrrr.","...rrrrrrrrrrrrrrrr.","....rrrrrrrrrrrrrr..",".....rrrrrrrrrrrrr..","......rrrrrrrrrrr...",".......rrrrrr.......","...................."],"n":["....................","...22222200055......","..22222000000555....",".42220000000005555..",".mm9000000000005555.",".mmm100000000005555.",".mmmm10000000000855.",".mmmmm000000000gggg.",".mmmmmm6666300ggggg.",".mmmmmm666666bggggg.",".mmmmmme666666ggggg.",".Huummmm666666ggggg.","...uuumm6666joogggg.","....uummm6oooooggg..",".....uummooooooogg..","......umeoooooooB...",".......HjoowJ.......","...................."],"a":["....................","...88999999999......","..99999999999989....",".99999999999999999..",".898999999999999999.",".999889999999999898.",".999999999999999989.",".999999878999999899.",".999999999999998999.",".999999999999989999.",".989999999988899999.",".999999999999998998.","...9999999999889999.","....99999999999989..",".....8988898899999..","......99999999999...",".......998888.......","...................."],"hts":["00000000000000000000","00055556666665000000","00556666666665540000","05666666666666554300","05666666666666654430","04566666666666665440","04456666666666665540","03445666666666665440","02344566666666654430","02234556666655544330","01233455555555443320","00123344444444433220","00012233444444332210","00001123333333322100","00000012222222211100","00000001111111111000","00000000110000000000","00000000000000000000"],"obs":[[0.0,0.0,6.1]],"foot":[7,5],"kind":"rock"},"rock_b":{"w":22,"h":26,"ax":10,"ay":17,"m":["......................","........r.............",".......rrrr...........",".......rrrrrr.........","......rrrrrrrr........",".....rrrrrrrrrrr......","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrrrr..","...rrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrmrrrrrrrrmrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.","...rrrrrrrrrrrrrrrrr..",".....rrrrrrrrrrrrrr...","......rrrrrrrrrrrr....","........rrrrrrrrr.....","............rrrr......","......................"],"n":["......................","........0.............",".......4000...........",".......400000.........","......40000000........",".....44000000000......","....44400000000000....","....4400000000000000..","...44400000000000000..","..4444000000000000000.","..4440000000000000000.",".44499000000000000000.",".49999600000000000000.",".e9999960000000000000.",".zm999966000000000000.",".zzz99666660000000000.",".zzzz9666666000000008.",".zzzzz6666666608ggggg.",".zzzzzz6666666ggggggg.","..zzzzzzj66666ggggggg.","...zzzzzrrrj6bgggggg..",".....zzzrrrrroggggg...","......zzrrrrrrgggg....","........rrrrrrwgg.....","............EErt......","......................"],"a":["......................","........9.............",".......9999...........",".......999979.........","......99999899........",".....99999989999......","....99999998999899....","....8989999899989998..","...89979998999999998..","..9898799989999999999.","..9999899999998999999.",".98998999999998999989.",".98999999999998999989.",".99899999979998999999.",".99988999989997999999.",".99999999999998999899.",".98999999999999999899.",".89999889998989999999.",".89899999999999999989.","..9999999999999999999.","...99989988888999998..",".....99988898699998...","......989999989999....","........999999999.....","............9999......","......................"],"hts":["0000000000000000000000","0000000080000000000000","0000000787700000000000","0000000887776000000000","0000007887776600000000","0000078887776665000000","0000778887776665550000","0000778887776665554400","0006788887776665554400","0067788887776655544430","0067888877766655544430","0677888877766655544430","0677788877766655544430","0667777877766655544430","0566677777766655544430","0456666777766655544430","0345566666666655544430","0233455555555555444330","0122345555555554433220","0011233444444444332210","0000122334444433222100","0000011223333332211000","0000000112222222110000","0000000001111111100000","0000000000000000000000","0000000000000000000000"],"obs":[[0.0,0.0,7.5]],"foot":[8,7],"kind":"rock"},"rock_c":{"w":14,"h":16,"ax":8,"ay":10,"m":["..............",".....rrr......","...mrrrrrr....","...rrrrrrrr...","..rrrrrrrrrr..","..rrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.","..rrrrrrrrrrr.","...rrrrrrrrr..","....rrrrrrr...","......rrrr....",".............."],"n":["..............",".....222......","...2222222....","...22222222...","..422222222d..","..4222222220d.",".44122222238d.",".499922133888.",".99999bbb388t.",".mm999bbbb8gt.",".mmmmmbbbb3tt.","..mmmmbbbbttG.","...mmmmbbbtt..","....zmmbbbt...","......////....",".............."],"a":["..............",".....799......","...8999999....","...99999998...","..8999998898..","..99999999999.",".999989999999.",".999899999999.",".999989999999.",".998998899999.",".999999999998.","..99998888899.","...999999999..","....9999999...","......8888....",".............."],"hts":["00000000000000","00000333000000","00033333440000","00033334444000","00233444445400","00334444455530","02344445555540","02344455555440","02334455444430","02233444444320","01123333333310","00112233333100","00001222222100","00000112211000","00000000000000","00000000000000"],"obs":[[0.0,0.0,4.4]],"foot":[5,4],"kind":"rock"},"rock_d":{"w":26,"h":19,"ax":10,"ay":12,"m":["..........................","...rrrrrrrr...............","..rrrrrrrrrrrrr...........","..rrrrrrrrrrrrrrrr........",".rrrrrrrrrrrrrrrrrr.......",".rrrmrrrrrrrrrrrrrr.......",".rrrmrrrrrrrrrrrrrr.......",".rrrrrrrrrrrrrrrrrr.......",".rrrrrrrrrrrrrrrrrr.......",".rrrrrrrrrrrrrrrrrrrrrr...",".rrrrrrrrrrrrrrrrrrrrrr...",".rrrrrrrrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrrrrrrr..","...rrrrrrrrrrrrrrrrrrrrrr.","....rrrrrrrrrrrrrrrrrrrrr.",".....rrrrrrrrrrrrrrrrrrrr.","......rrrrrrrrrrr..rrrr...",".......rrrrrrrr...........",".........................."],"n":["..........................","...40000000...............","..4400000000000...........","..4440000000000000........",".444400000000000000.......",".444400000000000000.......",".444440000000000000.......",".44444000000000008g.......",".h449eee6600000gggg.......",".uueeeeeee666gggggg144d...",".uuueeeeeeejjgggggg1440...",".uuueeeeeeejjgggggg4444d..","..uuueeeeejjjogggg444gol..","...uueeeejjjjjgggm99ooood.","....uzeerjjjjjgggwz6oooog.",".....zzrrjjjjjgggtzzooooo.","......zrrjjjjjjgt..zooB...",".......Urrjjjww...........",".........................."],"a":["..........................","...89999877...............","..9899999988777...........","..9899999999998789........",".899989999999999999.......",".899998888999999999.......",".999999999899999999.......",".999999999999877999.......",".999988999999998998.......",".9999999899999999998998...",".9998899999989989988988...",".99999999999998998789799..","..9999999999999997898889..","...8898899999999879999989.","....989999999999868998999.",".....99899999999867999998.","......89999999999..8889...",".......98888889...........",".........................."],"hts":["00000000000000000000000000","00056555555000000000000000","00556666555555500000000000","00456666666655555500000000","04556666666666655550000000","04556777666666666660000000","04556777777666666660000000","04556777777777766660000000","04556777777777776650000000","03456666677777665543333000","02345556666666655443334000","01234555556655544333334200","00123444555555443333343300","00012334444444332233333210","00001233333333322122222110","00000122222222211011211110","00000011111111110000100000","00000000011000000000000000","00000000000000000000000000"],"obs":[[0.0,0.0,6.1],[10.4,2.0,2.9]],"foot":[7,6],"kind":"rock"},"rock_e":{"w":31,"h":24,"ax":18,"ay":16,"m":["...............................","..............rrrr.............",".............rrrrrrr...........",".............rrrrrrrrr.........","............rrrrrrrrrrr........","............rrrrrrrrrrrr.......","...........rrrrrrrrrrrrrrr.....","..........rrrrrrrrrrrrrrrrr....","..........rrrrrrrrrrrrrrrrrrr..",".........rrrrrrrrrrrrrrrrrrrmr.",".........rrrrrrrrrrrrrrrrrrmrr.","........rkrrrrrrrrrrrrrrrrrrrr.",".....rrrrrrrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrrrrrrrrrrr...","..rrrrrrrrrrrrrrrrrrrrrrrrr....","...rrrrrrrrrrrrrrrrrrrrrrr.....",".....rrr..rrrrrrrrrrrrrrr......","...........rrrrrrrrrr..........","............rrrrr..............","..............................."],"n":["...............................","..............0000.............",".............0000000...........",".............000000000.........","............00000000000........","............000000000000.......","...........000000000000000.....","..........10000000000000000....","..........9000000000000000000..",".........99000000000000000000y.",".........m990000000000000000ty.","........1mm9000000000000000tty.",".....1111mm990000000000000ttty.","..4411111mmme100000000000tttty.","..h111111mmmeee000000000gtttty.","..h111113hmmeeeee0000goottttty.",".hh1111333mmeeeeejjjoooottttt..",".hm110ggggmmeeeeejjjooootttt...","..zzrgggggmmeeeeejjjoooottt....","...MMEggggmeeeeejjJJJJJJBt.....",".....ZZo..meeeeewJJJJJJJW......","...........eeeewJJJJW..........","............MMMWW..............","..............................."],"a":["...............................","..............9999.............",".............9999878...........",".............998789999.........","............98789999999........","............789999999999.......","...........789999999999997.....","..........89999999999998789....","..........9999999999978999999..",".........899999999977899999999.",".........989999998779999999988.","........8898999988999999999999.",".....9997999997799999999999989.","..9999998999999999999999999998.","..9999998898999999999999999989.","..9999998689989999999999999899.",".9999999869999988989999899899..",".987779875999999999998899999...","..8635798599999988888998999....","...75468769998999998899999.....",".....789..999999999999999......","...........9888988999..........","............89999..............","..............................."],"hts":["0000000000000000000000000000000","0000000000000099990000000000000","0000000000000999998800000000000","0000000000000999888888000000000","0000000000009988888888800000000","0000000000008888888888870000000","0000000000088888888887777700000","0000000000888888888777777770000","0000000000888888877777777776600","0000000007788887777777777766660","0000000006778777777777776666650","0000000036677777777777666666540","0000033335677777777766666665430","0012333334567777776666666654330","0023333334456667666666666543320","0023333333455566666666555432210","0123333322344555565555544322100","0122222222334444555544433221000","0012222111233344444443332110000","0001111110122333333332221100000","0000000000112222222211110000000","0000000000011112111000000000000","0000000000000000000000000000000","0000000000000000000000000000000"],"obs":[[0.0,0.0,8.2],[-11.6,1.2,3.2]],"foot":[9,6],"kind":"rock"},"rock_f":{"w":14,"h":15,"ax":7,"ay":11,"m":["..............","......rrr.....",".....rrrr.....","....rrrrrr....","....rrrrrrr...","...rrrrrrrr...","..rrrrrrrrrr..","..rrrrrrrrrrr.","..rrrrrrrrrr..",".rrrrrrrrrrr..",".rrrrrrrrrrr..","..rrrrrrrrr...","..rrrrrrrr....","...rrrrrrr....",".............."],"n":["..............","......115.....",".....1111.....","....c11110....","....111111d...","...h1111110...","..h1111110tt..","..h11111btttl.","..eeeebbbttt..",".heeeebbbttG..",".zzzeejbbttG..","..zzzwwwotG...","..zzzEwwwt....","...zzEwwwt....",".............."],"a":["..............","......999.....",".....9999.....","....999999....","....9999999...","...99999999...","..9999999999..","..99999999999.","..9999999999..",".99999899999..",".99999999998..","..999999999...","..99989899....","...9989999....",".............."],"hts":["00000000000000","00000066600000","00000566600000","00004666660000","00005666665000","00046666666000","00256666666500","00356666665430","00455555554300","03444555443200","02334444432100","00223333321000","00112222220000","00000111110000","00000000000000"],"obs":[[0.0,0.0,3.7]],"foot":[4,4],"kind":"rock"},"stal_a":{"w":20,"h":34,"ax":9,"ay":26,"m":["....................",".........ttt........",".........ttt........","........tttt........",".........ttt........","........rrrr........","........grrr........",".......rrgggr.......",".......rrrrrr.......",".......rrrrrr.......",".......rrrrrr.......","......rrrrrrr.......","......rrrrrrr.......",".....rrrrrrgrr......",".....rrrrrrrrr......",".....rrrrrrrrr......",".....rrrrrrrrrr.....","....rrrrrrrrrrrt....","....rgrrrrrrrrrtt...","....rrrrrrrrrrrtr...","...rrrrgrrrgrrrrr...","...trrrrrrrrrrrrr...","...trrrrrrrrrrrrr...","..rrrrrrrrrrrrrrr...","..rgggrrrrrrrggggr..","..rrrrgrrrrggrrgrr..","..rrrrrrrgrgrrrrrr..",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrr...","...rrrrrrrrrr.......","....rrrrrrrr........","...................."],"n":["....................",".........40d........",".........108........","........u938........",".........ebO........","........hmgl........","........hebl........",".......hmebtl.......",".......hmeogl.......",".......hmjggl.......",".......umeggl.......","......uumeogl.......","......uumrbgt.......",".....puurjwBtl......",".....humrrotll......",".....hhmrjogtl......",".....hhmejoggll.....","....uhmmejoggll1....","....uummejbggtl6l...","....uumeejbgtthjl...","...huumeejoottujl...","...0humrrjwBBtmjt...","...b9umrrwwBttmjt...","..ub9umejjBottmjt...","..mb9mmrjjogggeotl..","..mj99eejjbgggebgl..","..mjh9eejjbgggebgl..",".hmjmeeejbbgggeogtl.",".umjmee66bbggtjbgt..",".ummmeerjjoogtjjtt..","..mhmejjjjoottjot...","...meejjrwwoB.......","....MejjjjoB........","...................."],"a":["....................",".........999........",".........999........","........9889........",".........889........","........8778........","........8778........",".......887788.......",".......887788.......",".......877788.......",".......877788.......","......8877788.......","......8876788.......",".....888766889......",".....887766888......",".....887777898......",".....8977778988.....","....888776789768....","....8877767797689...","....8877767787578...","...88777766777578...","...97777666776668...","...85777666776667...","..875777666776667...","..8767766778766678..","..8867766778766678..","..8877777788766778..",".878777777887667788.",".87877777788766677..",".87777777788776677..","..778777778887667...","...8877766888.......","....77776788........","...................."],"hts":["00000000000000000000","000000000ooo00000000","000000000ooo00000000","00000000nooo00000000","000000000nnn00000000","00000000lmml00000000","00000000klll00000000","0000000ikkkkj0000000","0000000ijkkji0000000","0000000iijjii0000000","0000000hiiiih0000000","000000fghhhhg0000000","000000egghhgf0000000","00000ceffggfed000000","00000cdefffeec000000","00000bddeeeedc000000","00000bcdddddcba00000","00009bbccccccb9a0000","00008abbcccbba9aa000","000079abbbbba9899000","0004789aaaaa98888000","00076789999987787000","00076788888876777000","00465677777766666000","00455566776665555400","00444556666554454300","00344455555544443300","01233444444443333210","01223333444332222100","00112233333322111100","00011222222211110000","00001111111110000000","00000000000000000000","00000000000000000000"],"obs":[[0.0,0.0,5.5],[6.0,2.0,2.2],[-5.2,2.6,1.6]],"foot":[6,6],"kind":"stal"},"stal_b":{"w":21,"h":32,"ax":11,"ay":23,"m":[".....................",".........t...........","........ttt..........","........tttt.........","........tttr.........","........rtrr.........",".......rrrrrr........",".......rrrrrr........",".......rrrrrr........",".......rrrrrrr.......","......rrrgggrr.......","......rrrrrrrrr......","...tt.rrrrrrrrr......","...ttrrrrrrrrrr......","...ttrrrrrrrrrrr.....","...rrrgrrrrrrrrr.....","..rrrrrrrrrrrrrr.....","..rrrrrrgrrggrrrr....","..rrrrrrrrrrrrrrgr...","..rrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrr..",".rgggrgrrrrrrrrgrrrr.",".rrrgrrgrrrrrrgrrrrr.",".rrrrrrrgggggrrrrrr..",".rrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrr...","..rrrrrrrrrrrrrrrr...","...rrrrrrrrrrrrrr....","......rrrrrrrrrr.....",".......rrrrrrr.......","....................."],"n":[".....................",".........2...........","........408..........","........918l.........","........96gd.........","........hEgl.........",".......hmbgld........",".......hm6bgl........",".......mm6ggl........",".......umebgll.......","......hmmrogll.......","......hmmjogtld......","...45.humrwgtll......","...98hhmmjjggll......","...zBuhmejjoglll.....","...eg8mmm6bgggll.....","..hegghme6bbggll.....","..uebgumejbggglll....","..uebtumejbgggtlld...","..urjtumejjogttlldd..","..urotuzzjwoottll8d..",".hurwgumzrwwotgll8ld.",".hmejgmmmrwbggglllll.",".hmebgmmejbooggglll..",".umebb99e6bbbgg8lll..",".mmeb6m9ebbbbgg8lll..",".umebm9m66bbbgggll...","..mebmm9e6bbbggggt...","...eoume66bbbgggt....","......m966bbbggB.....",".......e6bbboB.......","....................."],"a":[".....................",".........9...........","........999..........","........9899.........","........8899.........","........8798.........",".......887888........",".......987888........",".......877888........",".......8778788.......","......88778788.......","......887788788......","...99.877788788......","...897777788788......","...8857777887888.....","...7757777877888.....","..88757778877788.....","..887577788777888....","..8876677787777898...","..87766777877778898..","..87766776767778899..",".9877668766677888898.",".8877668766677888899.",".888767976667778888..",".888768977777778888..",".888779977777788888..",".89877987777778888...","..9877987777778788...","...87897777778887....","......9777777889.....",".......7777778.......","....................."],"hts":["000000000000000000000","000000000l00000000000","00000000kll0000000000","00000000klkk000000000","00000000kkkj000000000","00000000jjji000000000","0000000hiiiig00000000","0000000ghhhhg00000000","0000000ghhhgg00000000","0000000fggggfd0000000","000000ceffffed0000000","000000ceeffeedb000000","000cc0cddeeedcb000000","000ccabcddddccb000000","000bb9bbcccccba900000","000aa9abbbbbbaa800000","0089999aabbbaa9800000","00889899aaaaa98750000","007888899999988653000","006777788998887643200","005666678888776543200","035555566777665543210","024454456666655432100","023444445555544332100","022333344444443321000","012222334444333221000","001222233333332211000","000111222222222110000","000000122222211100000","000000011111110000000","000000001110000000000","000000000000000000000"],"obs":[[0.0,0.0,5.9],[-6.4,1.6,2.5]],"foot":[7,6],"kind":"stal"},"stal_c":{"w":21,"h":38,"ax":9,"ay":29,"m":[".....................","..........t..........",".........ttt.........",".........ttt.........",".........ttt.........",".........rrr.........","........rrrr.........","........rrrr.........","........rrrr.........","........rrrrr........",".......rrrrrr........",".......rrggrr........",".......rrrrrr........","......rrrrrrr........","......rrrrrrrg.......","......rrrrrrrg.......","......rgrrrrgr.......",".....rrrrgggrr.......",".....rrrrrrrrr.......",".....rrrrrrrrr.t.....","....rgrrrrrrrrtt.....","....rrrrrrrrgrtt.....","...trrgrrrrgrrrr.....","..ttrrrrrrrrrrrr.....","..rtrrrrrrrrrrrrrt...","..rrrrrrrrrrrrrrrt...","..rrrrrrrrrrrrrrrrr..","..rrrgrrrrrrrrgrrrr..","..rgrrgrrrrrgrrrrgr..",".rrrrrrrgggrrrrrrrr..",".rrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrr.",".....rrrrrrrr....rr..","......rrrrrr.........","........rr...........","....................."],"n":[".....................","..........0..........",".........408.........",".........938.........",".........mbO.........",".........mol.........","........umjt.........","........umbt.........","........ueot.........","........meotl........",".......hmmotl........",".......ummotl........",".......umeotl........","......hmmeogl........","......hmmjogll.......","......umejogty.......","......umejogty.......",".....humejooty.......",".....huurjottl.......",".....ummzEwttl.5.....","....hhmmrjwttl98.....","....hhmmmjottlml.....","...0hhmeejogttmg.....","..Pbummmejbggleg.....","..ub8mmmebbgtlegy1...","..mblummebggttrolM...","..mblummrjoBttrolel..","..mjtumzrjottgrolel..","..mjtmzzrwBBtgjourt..",".umjtmmmrwottgjgurt..",".umjgmmmebgtgljgurt..",".umjbmeeebggggjgmrtl.",".umj699eebggggegmegl.","..m6emeeebggggEJmegt.",".....mme6bggg....rB..","......Ue6bgt.........","........EJ...........","....................."],"a":[".....................","..........9..........",".........999.........",".........989.........",".........879.........",".........779.........","........8779.........","........8778.........","........8777.........","........77778........",".......887778........",".......887778........",".......887878........","......8887778........","......87878788.......","......87888778.......","......87888778.......",".....887888778.......",".....887877778.......",".....887777778.8.....","....888787777778.....","....887788877768.....","...9777788877767.....","..88677788877767.....","..8757778887776779...","..8756778888766678...","..87667788877666678..","..97767788887666678..","..97767788887666677..",".887767788887666677..",".887767788888776777..",".9877777788887767678.",".9777777788997767678.","..777777788987777778.",".....77778998....77..","......778899.........","........88...........","....................."],"hts":["000000000000000000000","0000000000r0000000000","000000000rrr000000000","000000000qrq000000000","000000000qqq000000000","000000000opo000000000","00000000noon000000000","00000000mnnn000000000","00000000mmmm000000000","00000000llmlk00000000","0000000jkllkj00000000","0000000ijkkji00000000","0000000ijjjji00000000","000000ghiiiih00000000","000000fghhhhgf0000000","000000fgghhgge0000000","000000efggggfd0000000","00000bdeffffec0000000","00000acdeeeedb0000000","00000acdddddcb0a00000","00008abcccccbaaa00000","000089abbbbba99900000","000989aaabaaa98800000","00897899aaa9988800000","007878899999877768000","006767888888776657000","006666778887755556600","005555667776645446500","004444556665544445500","023433445554433334400","012333344443322223300","012222333333221122210","001112223322211112110","000011122221100001100","000000111111000000000","000000011110000000000","000000000000000000000","000000000000000000000"],"obs":[[0.0,0.0,5.1],[5.6,1.2,2.0],[8.8,3.4,1.4],[-5.2,2.4,1.8]],"foot":[6,6],"kind":"stal"},"stal_d":{"w":19,"h":28,"ax":8,"ay":20,"m":["...................",".......ttt.........",".......ttt.........",".......ttt.........",".......rrrr........","......rrrrr........","......rggrr........","......rrgrr........","......rrrrr...t....",".....rrrrrrr.ttt...",".....rrrrrrr.ttt...","....rrrrrrrrrrrr...","....rrrgrgrrrrrrr..","....rrrrrrrrrrrrr..","...grrrrrrrrrrrrr..","...rrrrrrrrrrrrrr..","...rrrrrrrrrrrrrr..","..rrrrrrrrrrrgrrrr.",".rrrrrrrrrrrrrrrrr.",".rrrrrggrgrrrrrrrr.",".rrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrr..","...rrrrrrrrrrrrr...","....rrrrrrrr.......",".....rrrrrrr.......",".........r.........","..................."],"n":["...................",".......h18.........",".......h18.........",".......h6g.........",".......m6gl........","......hmegl........","......hmjgl........","......hmjgl........","......umjgt...0....",".....ummjoty.93d...",".....ummjotl.mbl...","....hummjotlhebl...","....hhmejotl9egll..","....hhmejotl9ebll..","...hummejggl6ebgl..","...uummejbgl6ebgl..","...uumeejbgtejogt..","..huumeejottejottl.",".hhuummrjottmrotll.",".9hhmmrrjottejogll.",".Chhmmrrwottjjbgll.","..h9mmerjoglbjbg8T.","..u99eeejbgl86638..","...99eee6bg8gj6g...","....9e6e6bg8.......",".....Ue66b8t.......",".........R.........","..................."],"a":["...................",".......999.........",".......999.........",".......989.........",".......8788........","......98788........","......87788........","......87778........","......87779...9....",".....8776788.899...",".....8776787.889...","....987777875778...","....9877778857788..","....9877777867788..","...89777677867778..","...98777777967778..","...98777777867777..","..8987777778667778.",".89987767778677778.",".99987766777667778.",".99977766777677778.","..9977766677677788.","..988776677878878..","...8877777787887...","....87777778.......",".....7777787.......",".........8.........","..................."],"hts":["0000000000000000000","0000000ijj000000000","0000000iii000000000","0000000hii000000000","0000000ghgg00000000","000000fgggf00000000","000000efffe00000000","000000eefee00000000","000000deeed000a0000","00000bcdddcb0aaa000","00000abcccba0aa9000","00008abbbbb98998000","000089aaaaa98888700","0000799aa9987777600","0005788999887777600","0005678888876666500","0004677777765555400","0023566777665554420","0013456666554443310","0012345555543333210","0012334444432222110","0001233333321111100","0001122222221111000","0000111222210000000","0000011111110000000","0000000011000000000","0000000000000000000","0000000000000000000"],"obs":[[0.0,0.0,4.6],[5.6,-0.8,3.1]],"foot":[5,5],"kind":"stal"}};/*CAVE_SPR_END*/
const NRM=(()=>{ const n=64, ga=Math.PI*(3-Math.sqrt(5)), o=[]; for(let i=0;i<n;i++){ const y=1-(i+.5)/n*2, r=Math.sqrt(Math.max(0,1-y*y)), ph=i*ga; o.push([Math.cos(ph)*r,y,Math.sin(ph)*r]); } return o; })();
const NRM_A='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/';
const NRM_IX=(()=>{ const t=new Int8Array(128).fill(-1); for(let i=0;i<64;i++) t[NRM_A.charCodeAt(i)]=i; return t; })();
/* 遺跡（RUIN_BIG・RUIN_SPR）の光をランタンに当て直す（2026-10-02 ユーザー要望「遺跡も岩と同じようにライトの影響を受けるように」）。
   遺跡の絵は左手前上からの光で焼いてあり、象形・溝・継ぎ目・苔の描き分けは講評で詰めた物なので、作り直さずに残す。
   3D から書き出した面の向き（n）と焼いた光の強さ（k）を持たせ、
   **段の上げ下げ＝(今のランタンでの当たり − 焼いた当たり)×RELIGHT_GAIN**（±RELIGHT_MAX 段）だけ動かす。
   ランタンが左手前にいれば焼いた絵のまま、右にいれば左の面が沈んで右の面が起きる。 */
/* 講評で決めた決まり（2026-10-02）：
     ・側面は ±2 段、上を向いた面（n.y≥0.5）は ±1 段まで。光で変わるのは「どちら側が明るいか」で、「どの面が一番明るいか」ではない
     ・側面は、その絵の上面の段−1 より明るくしない（上面と側面が1枚の面に溶けないように）
     ・苔は石と同じだけ動かす（半分だと、正面が沈んだとき苔だけ浮いて斑に見えた） */
const RELIGHT_GAIN=4.2;
function relightDyn(nx,ny,nz,X,Y,hpx){
  const lx=(lampX-X)/4, ly=(CAVE_LAMP_H-hpx)/3.46, lz=(lampY-(Y+hpx))/2, l=Math.hypot(lx,ly,lz)||1;
  return Math.max(0,(nx*lx+ny*ly+nz*lz)/l); }
function relightPx(ch,nch,kch,X,Y,hpx,cap){
  const i=NRM_IX[nch.charCodeAt(0)];
  if(i<0) return ch>='0'&&ch<='6' ? RP_T[ch.charCodeAt(0)-48] : RUIN_SPR_PAL[ch];
  const n=NRM[i], top=n[1]>=.5, lim=top?1:2;
  let sh=Math.round((relightDyn(n[0],n[1],n[2],X,Y,hpx)-(kch.charCodeAt(0)-48)/9)*RELIGHT_GAIN); sh=sh<-lim?-lim:sh>lim?lim:sh;
  if(ch>='1'&&ch<='6'){ const d=ch.charCodeAt(0)-48; let k=d+sh; if(!top&&sh>0&&k>cap) k=Math.max(d,cap); return RP_T[k<1?1:k>6?6:k]; }
  if(ch==='a'||ch==='b'||ch==='c'){ const k=ch.charCodeAt(0)-97+sh; return RUIN_SPR_PAL['abc'[k<0?0:k>2?2:k]]; }
  return ch>='0'&&ch<='6' ? RP_T[ch.charCodeAt(0)-48] : RUIN_SPR_PAL[ch]; }
/* その絵の上面の段（焼いた絵の、上を向いた面の段の中央値）と、今のランタンでの上面の動き → 側面の上限 */
function relightCap(sp,X,Y){
  if(sp._top==null){ const v=[]; for(let r=0;r<sp.h;r++) for(let q=0;q<sp.w;q++){ const ch=sp.rows[r][q], i=NRM_IX[(sp.n[r][q]||'.').charCodeAt(0)]; if(i>=0&&NRM[i][1]>=.5&&ch>='1'&&ch<='6') v.push(ch.charCodeAt(0)-48); }
    v.sort((a,b)=>a-b); sp._top=v.length?v[v.length>>1]:5; }
  let sh=Math.round((relightDyn(0,1,0,X,Y,0)-0.71)*RELIGHT_GAIN); sh=sh<-1?-1:sh>1?1:sh;          // 0.71＝焼いた光の上面への当たり（仰角45°）
  return Math.max(1,Math.min(6,sp._top+sh)-1); }
/* 焼いた落ち影（左手前上の光で右奥へ落ちる）の濃さ：ランタンがその向きにいるほど残し、反対へ回ると消す。
   代わりに遺跡の足もとを岩として焼いてあるので、ランタンの影がその場で落ちる（stampRocks） */
function bakedShadowK(x,y){ const dx=lampX-x, dy=lampY-y, l=Math.hypot(dx,dy)||1; const k=(dx*-.866+dy*.5)/l; return k<0?0:k>1?1:k; }
function caveSprFor(d){
  if(!CAVE_USE_3D||CAVE.caveProc||!CAVE_SPR) return null;
  if(d.k==='rock'){ const r=rockShape(d);
    const nm= r.two ? (d.s%2?'rock_d':'rock_e') : r.w>=7 ? 'rock_b' : r.w>=6 ? 'rock_a' : (d.s>>>9)%2 ? 'rock_c':'rock_f';
    return CAVE_SPR[nm]||null; }
  if(d.k==='stalagC') return CAVE_SPR[['stal_a','stal_b','stal_c','stal_d'][d.s%4]]||null;
  return null;
}
function caveDecode(sp){
  if(sp._d) return sp._d; const W=sp.w, H=sp.h, m=new Uint8Array(W*H), ni=new Uint8Array(W*H), a=new Float32Array(W*H), hp=new Uint8Array(W*H), ed=new Int8Array(W*H*2);
  const MC={'.':0,r:1,m:2,t:3,k:4,g:5};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; m[i]=MC[sp.m[y][x]]||0; if(!m[i]) continue;
    ni[i]=NRM_A.indexOf(sp.n[y][x]); a[i]=.4+(sp.a[y].charCodeAt(x)-48)/9*.6; hp[i]=parseInt(sp.hts[y][x],36); }
  // 輪郭：外に面したドットと、外の向き
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; if(!m[i]) continue; let ex=0, ey=0;
    if(x===0||!m[i-1]) ex--; if(x===W-1||!m[i+1]) ex++; if(y===0||!m[i-W]) ey--; if(y===H-1||!m[i+W]) ey++;
    ed[i*2]=ex; ed[i*2+1]=ey; }
  return sp._d={m,ni,a,hp,ed};
}
const CAVE_LAMP_H=18, CAVE_AMB=.25, CAVE_KD=.35, CAVE_TOP=.55;   // 上を向いた面はランタンの向きに関わらず明るい（手描きの岩の「上面が一番明るい」）
const CAVE_TH=[.15,.40,.70,.88];   // 明るさ→石灰岩の5段の境。奥の面＝1、光の側＝2、上面＝3（近いと4）、輪郭＝0（講評で決めた）
function caveTone(I,h){ let k=0; for(const t of CAVE_TH) if(I+h>=t) k++; return k; }
function drawCaveSprite(d,sp,P_){
  const D=caveDecode(sp), W=sp.w, H=sp.h, ax=Math.round(d.x), ay=Math.round(d.y), x0=ax-sp.ax, y0=ay-sp.ay, stal=sp.kind==='stal';
  const [frx,fry]=sp.foot;
  // 明るさは、接地の楕円のランタン側の縁で1度だけ取る（絵の上の方は自分の影の中に入るので、そこで取ると真っ暗になる）
  const ga=Math.atan2(lampY-ay,lampX-ax), Lr=Math.min(1.1,Math.max(.28,pxLight(Math.round(ax+Math.cos(ga)*(frx+2)),Math.round(ay+Math.sin(ga)*(fry+2)))*1.15));
  const away=lampX<ax?1:-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x, mt=D.m[i]; if(!mt) continue;
    const X=x0+x, Y=y0+y, hpx=D.hp[i], gy=Y+hpx;                               // そのドットの真下の地面
    let lx=(lampX-X)/4, ly=(CAVE_LAMP_H-hpx)/3.46, lz=(lampY-gy)/2; const ll=Math.hypot(lx,ly,lz)||1; lx/=ll; ly/=ll; lz/=ll;
    const n=NRM[D.ni[i]], dot=Math.max(0,n[0]*lx+n[1]*ly+n[2]*lz);
    const I=Lr*(CAVE_AMB+CAVE_KD*dot+CAVE_TOP*Math.max(0,n[1]))*D.a[i]*(stal?1.1:1);   // 濡れた方解石は岩より白い
    const hq=stal?(BAYER[((y&3)<<2)|(x&3)]-.5)*.1:0;                            // 揺らしは石筍だけ・絵の中で固定（歩いてもちらつかない）
    let c;
    if(mt===2){ const k=Math.min(2,Math.max(0,caveTone(I,0)-1)); c=P_.moss[k]; }
    else { let k=caveTone(I,hq);
      if(mt===3) k=dot>.2?4:k+1;                                                // 濡れた先
      if(mt===5&&dot>.3) k--;                                                   // 成長の輪は光の側だけ
      if(mt===4) k=Math.min(k,2)-1;                                             // 奥の面との境
      const ex=D.ed[i*2], ey=D.ed[i*2+1];
      if(ex||ey){ const aw=ex*(lampX-X)+ey*(lampY-Y)<0; if(ey>0||aw) k=0; else k=Math.max(0,k-1); }
      c=P_.lime[k<0?0:k>4?4:k]; }
    dpf(X,Y,c); }
  // 床との境：底の輪郭の下に最暗を1列、ランタンと反対の側だけ2〜3ドットの網の影
  let edgeX=-1, edgeY=0;
  for(let x=0;x<W;x++){ let b=-1; for(let y=H-1;y>=0;y--) if(D.m[y*W+x]){ b=y; break; } if(b<0) continue;
    dpf(x0+x,y0+b+1,P_.lime[0]); if(edgeX<0||(away>0?x>edgeX:x<edgeX)){ edgeX=x; edgeY=b; } }
  if(edgeX>=0) for(let q=1;q<=3;q++) for(let r=-1;r<=1;r++){ const X=x0+edgeX+away*q, Y=y0+edgeY+r; if(((X+Y)&1)||q-Math.abs(r)>2) continue; dpf(X,Y,P_.lime[0]); }
}
/*RUIN_BIG_BEGIN*/const RUIN_BIG={"fallen_a":{"w":71,"h":46,"ax":30,"ay":33,"sink":3,"fp":[-27,-14,38,9],"rows":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................2650............",".......................................................16650...........",".......................................................1566550.........",".......................................................15566650........",".......................................................155566650.......",".......................................................1555556660......",".......................................................116665566660....",".......................................................266666556320....",".....................................................26666666655210....","....................................................266666666655210....","..................................................26666666666655220ssss","................................................2666666666666556220ssss","...............................................26666666665555546220ssss","............................................26666666666554444445120ssss",".........................................26666655665555544444444220ssss","......................................26666666545555444444333334220ssss","...................................26626666656333335333333333333220ssss","................................26666564566544442335222222222223220ssss",".............................26666666652646443323334211222122223220ssss",".........................26666265666553533533331232311111110000ba10ssss","......................2666666564466544343333222aa310000000ossss000o....","...................2226566666551345433333322122aa0osssssss.............",".................2666556666655343253332132121000osssss.................",".................166562666544424334222212000osssss.....................",".................16663536454333333222221ossssss........................",".................154435352433322b222100osssss..........................",".................14433334242222ab000ossss..............................","................2433332332322220osssss.................................","............0...143222aab22200osssss...................................","........255550..12221210a00osssss......................................","........166660..111100osossss..........................................",".....255333330ss000osssss..............................................","....c664bbbbb0ssssssss.................................................","....0aa100000os........................................................",".....00os..............................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"hts":["00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000eeee000000000000","0000000000000000000000000000000000000000000000000000000deeee00000000000","0000000000000000000000000000000000000000000000000000000cdeeeee000000000","0000000000000000000000000000000000000000000000000000000bcddeeee00000000","0000000000000000000000000000000000000000000000000000000abccdeeee0000000","00000000000000000000000000000000000000000000000000000009abbcdeeee000000","00000000000000000000000000000000000000000000000000000008abbbcdeeeee0000","0000000000000000000000000000000000000000000000000000000aabbbbcddedd0000","000000000000000000000000000000000000000000000000000009aaaabbbbccdcc0000","00000000000000000000000000000000000000000000000000009aaaaaaaaabbcbb0000","0000000000000000000000000000000000000000000000000099999aaaaaaaaabaa0000","0000000000000000000000000000000000000000000000008999999999999999a990000","00000000000000000000000000000000000000000000000789999999888888889880000","00000000000000000000000000000000000000000000788888888888888887778770000","00000000000000000000000000000000000000000888888877788777777777777660000","00000000000000000000000000000000000000888888887777777776666666666550000","00000000000000000000000000000000000888788887777766666666655555555440000","00000000000000000000000000000000888888777777776666555555544444444330000","00000000000000000000000000000788888888767666666555544444333333333220000","00000000000000000000000008888878887777766666555444443332222221112110000","00000000000000000000008888888877777776665555544333322111110000011000000","00000000000000000007778888888776766666654444433222000000000000000000000","00000000000000000888877888777776666555543333222100000000000000000000000","00000000000000000888876777776666555544432221000000000000000000000000000","00000000000000000877777676666655444433320000000000000000000000000000000","00000000000000000777766566655554333322100000000000000000000000000000000","00000000000000000766665455544443222100000000000000000000000000000000000","00000000000000006665554444433322000000000000000000000000000000000000000","00000000000030005555443333322100000000000000000000000000000000000000000","00000000333333004444332121100000000000000000000000000000000000000000000","00000000333333003333220000000000000000000000000000000000000000000000000","00000222333332002220000000000000000000000000000000000000000000000000000","00002222222222000000000000000000000000000000000000000000000000000000000","00001111111110000000000000000000000000000000000000000000000000000000000","00000110000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000"],"n":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................9000............",".......................................................z9000...........",".......................................................zzm0000.........",".......................................................uzum1000........",".......................................................zuzzz9000.......",".......................................................zmhuzm9000......",".......................................................z4411uum0003....",".......................................................41111ezzmoBB....",".....................................................44111166zumBBB....","....................................................4111166666zzBoo....","..................................................411116666666zzoBo....","................................................4011116666bbbbbzooB....","...............................................umm33336bbbbbbbbzBoB....","............................................409006e33bbbbbbbjjjzooB....",".........................................200016m33mbbbbbbjojjjozoBB....","......................................29100333ezd36jbbboooowwwwroBo....","...................................291ze633333d6zbgzooooowwwwwwwooB....","................................2000011z8e3bbbbjzgojoowwwwwwwwwrBoo....",".............................m99103333ezmbbgbbojzlojoBwJJJJJJJJzBoB....",".........................22091ze63333b8bzljoooooowoEJJJJJJJJRJJzBoB....","......................410000363z863bbbgjzojooooBBwJEWRRRRRR....mooB....","...................4uzm1133338ezmjbbboojzjroBBBEzJR....................",".................00095z6e333bbbgzljoooowzEEBJJJWz......................",".................0333ezzd6bbbbljztjoooowzJEJJ..........................",".................33333bzbjbgoogrzoroBBBEz..............................",".................3bbbgjzzjooooorzBEBJJOR...............................",".................bbggojzztwoooBEzOJJW..................................","................3boooowzztwBBBBEM......................................","............2...gjoooowzzGwJJJR........................................","........000005..owoBBBEzzEJW...........................................","........001368..BEBJJOR.M..............................................",".....000wwwwwt..OJJW...................................................","....m00gwwwwwB.........................................................","....uzwBwwwwwB.........................................................",".....wwB...............................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"k":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................9766............",".......................................................69666...........",".......................................................6686666.........",".......................................................66677667........",".......................................................666669666.......",".......................................................6786669666......",".......................................................688896686664....",".......................................................888888667000....",".....................................................78888888666000....","....................................................788887877766000....","..................................................77888777777766000....","................................................8777777777666666000....","...............................................78777767666666556000....","............................................86975986665665555556000....",".........................................66669876575554544444436000....","......................................59866665821576444443333335000....","...................................69869966555076427222222232222000....","................................66766876385444372246111111111111000....",".............................79986665582765333212034000000000006000....",".........................666986996555506205222200203000000000006000....","......................8766666866284443262251100000000000000....7000....","...................86699766653827643332521100000200....................",".................66693688555546320522211211000001......................",".................6664826074444062051000120000..........................",".................565545267433315211000001..............................",".................55441726132210120100000...............................",".................43332626031000120000..................................","................14322112202000001......................................","............6...052110122000000........................................","........667762..340000122000...........................................","........677770..0100000.1..............................................",".....646233330..0000...................................................","....8661333330.........................................................","....6200123330.........................................................",".....310...............................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"obs":[[22.4,-7.0,4.8],[17.5,-5.5,4.8],[12.6,-3.9,4.8],[7.6,-2.4,4.8],[2.7,-0.8,4.8],[-2.2,0.7,4.8],[-7.1,2.2,4.8],[-12.0,3.8,4.8],[-17.0,5.3,4.8]],"cap":[22,-7],"brk":[-17,5]},"fallen_b":{"w":71,"h":42,"ax":32,"ay":26,"sink":3,"fp":[-28,-9,35,12],"rows":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","....................260................................................","........260..20..26665630..............................................",".....263454355635166654244660..........................................","....25630056666226664622166666340..............................2550....","....1550ss1556221666452446666434546660........................25520....","....0b4oss12552b6666432556666534466666430....................255210....",".....0o...000ba0155542216666561666666452446660..............2542110....",".............0o.004432216566452466665622566666340..20.....265521110....","..................0000015456343366664524466665635566666662654211120....","......................s00045232366664325566665366666666662252222120....","..........................00002254554221666646366666666661522122120....",".............................s000344baa1666635466666666665522122220....",".................................000000a555633556666666665421122220....","......................................s004452b455566666665311112220ssss","........................................s0000a344455666665521112210ssss",".............................................00003445566655221122aossss",".................................................000445555521111aosssss","....................................................00455552111aossssss","......................................................00554211aosssssss","........................................................15411aosssssss.","........................................................0c520osssss....",".........................................................00osss........",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"hts":["00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000777000000000000000000000000000000000000000000000000","00000000222003300777777760000000000000000000000000000000000000000000000","00000222222233334667777667777000000000000000000000000000000000000000000","000022221123333356666665777777776000000000000000000000000000000dddc0000","00002222002333325555565566677776777777000000000000000000000000dddcc0000","0000111000122222444555455666666677777777600000000000000000000dddcbb0000","000000000001111133344434555556566667777667777700000000000000dddcbaa0000","0000000000000000222333244445554556666665777777777008800000cdddcba990000","000000000000000000111213333444445555565566777777778889999cdddcba9880000","00000000000000000000000112233334444555456666666777888899adddcba98770000","00000000000000000000000000112222334444355556666667778889acccba987660000","000000000000000000000000000000012223332444555556667777889bbba9876550000","000000000000000000000000000000000111221333444455566677789aaa98765440000","00000000000000000000000000000000000000022233334445556677899987654330000","00000000000000000000000000000000000000000112223334455566788876543220000","00000000000000000000000000000000000000000000011223344455677765432100000","00000000000000000000000000000000000000000000000000223345566654321000000","00000000000000000000000000000000000000000000000000002233455543210000000","00000000000000000000000000000000000000000000000000000012344432100000000","00000000000000000000000000000000000000000000000000000000233321000000000","00000000000000000000000000000000000000000000000000000000122210000000000","00000000000000000000000000000000000000000000000000000000011000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000"],"n":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","....................008................................................","........000..00..111134tt..............................................",".....00rrro10000h66661tt18102..........................................","....h00lrrm1000teeeebettb9111080t..............................000l....","....rjjy..zrrrttreeejote66661b1t300002........................000tt....","....rEwy..zrzrtzrrrrrttjheee69thb111130tl....................000ttt....",".....EE...zrrrttzrrrmttwmeeeb9tbh66663gt130002..............003tttt....",".............zB.MMMEzttwrrrrojtoeeeeb9ttb1111080t..22.....0003ttttt....","..................UMJttwzrrrwBtjeeeebbte66666b131011111441008tttttt....",".......................RHMMzwttwrrrrrttjhee669t6161111119e18ttttttt....","..........................MMJJtwzrrrmttweeeeb9b66eee99999rrtttttttt....","..............................OJMMEEzttwrrrrojjeheeeee99urrtttttttt....",".................................MMMJttwrrrrwtjemeeeeee9urrtttttttt....",".......................................JMMzrwtrrrrrmmmmmurrtttttttt....",".........................................UMMJBEEzzzzzmmmurrtttttttt....",".............................................RJMBMzzzzmmurrtttttttt....",".................................................BMMzzzzurrttttttt.....","....................................................MMzzurrtttttt......","......................................................Uzurrttttt.......","........................................................urrtttt........","........................................................urrttt.........",".........................................................rrt...........",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"k":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","....................652................................................","........666..66..88884800..............................................",".....665562766668888780083765..........................................","....86605598766088884900498876240..............................6661....","....6550..6567007788510978888480567654........................66600....","....5340..6565066676700588887909588875500....................765000....",".....13...666601455570048888490698887600847654..............6740000....",".............50.234350026677450488885900498876240..55.....766400000....","..................0100015556400478885409888884867688888887664000000....",".......................03344100467777005888879078988999998730000000....","..........................01000155657003888849688999999995500000000....","..............................0023445002777745587889999965600000000....",".................................0010001566640688888999965500000000....",".......................................0334420666777888865500000000....",".........................................01200444566778865500000000....",".............................................0020245667765500000000....",".................................................01245666550000000.....","....................................................1355655000000......","......................................................2465600000.......","........................................................6550000........","........................................................655000.........",".........................................................650...........",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"obs":[[21.5,5.7,4.4],[16.9,4.5,4.4],[12.2,3.2,4.4],[7.5,2.0,4.4],[2.8,0.8,4.4],[-1.9,-0.5,4.4],[-6.5,-1.7,4.4],[-11.2,-3.0,4.4],[-15.9,-4.2,4.4]],"cap":[21,6],"brk":[-16,-4]},"fallen_c":{"w":66,"h":35,"ax":29,"ay":25,"sink":3,"fp":[-25,-9,33,6],"rows":["..................................................................","..................................................................","..................................................................","..................................................................","..................................................................",".......................................................20.........","......................................................2660........","......................................................1660........","......................................................15660.......","......................................................156650......","......................................................165660......",".....................................................26665660.....","...................................................2666665640.....","................................................2666666666530.....","..............................................266666666666520..sss",".............................................2666666666666530sssss",".....................................266666556666665566666530sssss","..................................246666664635565555555555410sssss","..........................26666656456666664624564444444445520sssss","...................2650.2466666646365655544433454333443444420sssss","..................2446524566666545353544444333333233333333420sssss",".................24446363646555444342433333133220000022222420sssss","................2444452235254443323314222221000osssss00000520ssss.","..........250...1444443234143332210ba210000osssss.........00o.....",".........25660..144443220ba322100os000ossss.......................","........226630s044442220s00000osssss..............................","........155330ss0442000ossssss....................................","........14544oss.00ossss..........................................","....2662003a0ss...................................................","....0330ss00o.....................................................",".....00os.........................................................","..................................................................","..................................................................","..................................................................",".................................................................."],"hts":["000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000cc000000000","000000000000000000000000000000000000000000000000000000bccc00000000","000000000000000000000000000000000000000000000000000000abcc00000000","0000000000000000000000000000000000000000000000000000009bccc0000000","0000000000000000000000000000000000000000000000000000008abccc000000","00000000000000000000000000000000000000000000000000000089abcc000000","00000000000000000000000000000000000000000000000000000999abccc00000","000000000000000000000000000000000000000000000000000889999abbb00000","0000000000000000000000000000000000000000000000007888888999aaa00000","000000000000000000000000000000000000000000000077888888888899900000","000000000000000000000000000000000000000000000667777777777788800000","000000000000000000000000000000000000066777666667777777777777700000","000000000000000000000000000000000066666666665666666666666666600000","000000000000000000000000006666666656666666655555555555555555500000","000000000000000000066660666666666646565555554544444444444444400000","000000000000000000556665566666655545555554443443433333333333300000","000000000000000003445665455555555434444444333332222222222222200000","000000000000000023345555344444444333333333221210000001111111100000","000000000033300022344544234433333222222221100000000000000000000000","000000000333330022334433123322222001110000000000000000000000000000","000000003333330012333322011111000000000000000000000000000000000000","000000002333320011222110000000000000000000000000000000000000000000","000000001222200001100000000000000000000000000000000000000000000000","000022220111100000000000000000000000000000000000000000000000000000","000011110000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000"],"n":["..................................................................","..................................................................","..................................................................","..................................................................","..................................................................",".......................................................00.........","......................................................u000........","......................................................u900........","......................................................uu100.......","......................................................uuu000......","......................................................44u900......",".....................................................4111u100.....","...................................................411116umww.....","................................................211111666mzww.....","..............................................u01116666666zww.....",".............................................296666666666juww.....",".....................................200009d101mbbbbjjjjjjzww.....","..................................u010333386u63mbbjjjjjjjjuww.....","..........................20000018u8e33bbbgeugbejjjjjjjjjjzww.....","...................9959.u513333386u6ebbbbbbeugbjwwwwwwwwwwzww.....","..................hme36uu3e3bbbbgeuubjbbboojuoorwwwwEwEEEEzww.....",".................mmmm38bueebbbbboruugjooowwwtoJEJJRRREEEEEzww.....","................e9m9mbgjuubjoooooruutwwwwwJEuORM.....RRRRRzww.....","..........000...9999hbgruuowwwwwwEuuBEJJJJJU..............zwW.....",".........0000g..99hhoooruuBwJJJJJM.HURR...........................","........e100gt.hmh9wwwBE.uRJJWR...................................","........rrro0t..hmwJJJJR..........................................","........rzwwwt...MWR..............................................","....h000zrwww.....................................................","....uwww..Z//.....................................................",".....www..........................................................","..................................................................","..................................................................","..................................................................",".................................................................."],"k":["..................................................................","..................................................................","..................................................................","..................................................................","..................................................................",".......................................................66.........","......................................................6666........","......................................................6966........","......................................................66876.......","......................................................667665......","......................................................786976......",".....................................................88886766.....","...................................................7888886721.....","................................................6788888888611.....","..............................................777788888877611.....",".............................................5987777777777622.....",".....................................666769085776666776666621.....","..................................768766761827685566565656601.....","..........................66667684649666663823684444454555611.....","...................9919.6386676618288655544720463333333433611.....","..................9896912496566538264544433521141111222223611.....",".................88986262885555436260532322100030000000011611.....","................99998507264543333122031100002000.....00000611.....","..........676...9999841626042211112201000000..............610.....",".........66662..999832052202000000.1000...........................","........886600.299921001.200000...................................","........566120..98100000..........................................","........654330...300..............................................","....867556111.....................................................","....6332..000.....................................................",".....331..........................................................","..................................................................","..................................................................","..................................................................",".................................................................."],"obs":[[21.3,-3.5,4.0],[16.7,-2.7,4.0],[12.2,-2.0,4.0],[7.6,-1.2,4.0],[3.0,-0.5,4.0],[-1.5,0.2,4.0],[-6.1,1.0,4.0],[-10.7,1.7,4.0],[-15.2,2.5,4.0]],"cap":[21,-3],"brk":[-15,2]},"wall_a":{"w":54,"h":33,"ax":24,"ay":26,"sink":0,"fp":[-21,-3,27,3],"rows":["......................................................","......................................................","......................................................","......................................................","......................................................","....2655555555555566555555555550......................","....1655555555555565555555555550......................","....1655555555555565555555255550......................","....1655555555555565555555555250......................","....1666666666666666666666666260......................","....1222222222223344444444444450......................","....1222222211112121111111111111333334555550..........","....1333344333333343333333333331344444555550..........","....1333433333333343433333343331334444555550..........","....1333333333333343433333334331333444555550..........","....1333333333333343433443344332344566666650..........","....1222222222222222222222222221343344233330..........","....1322222222223343333443333332322222222220..........","....1322221122124343333333344442433444333330ssssss....","....1322333333233343343334444442433443333330ssssss....","....1321333332233333333333333332434444333330ssssssssss","....11212333333332111111111111324344433333310sssssssss","....1321233333334343334444444442322222222221230sssssss","....132123333333433333333444434243222222222233330sssss","....132133223333433333344444434243443333344344333ossss","....132233333333433333334444334243222222234345550sssss","....1223444444443aa211aaa11aa111baa2aaaaabbb4454osss..","....0000000000000000000000000000000000000000000osss...","......................................................","......................................................","......................................................","......................................................","......................................................"],"hts":["000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000iiiiiiiiiiiiiiiiiiiiiiiiiiii0000000000000000000000","0000hhhhhhhhhhhhhhhhhhhhhhhhhhhhcccccccccccc0000000000","0000ggggggggggggggggggggggggggggcccccccccccc0000000000","0000ffffffffffffffffffffffffffgfcccccccccccc0000000000","0000eeeeeeeeeeeeeeeeeeeeeeeeeefecccccccccccc0000000000","0000ddddddddddddddddddddddddddedcccccccccccc0000000000","0000cccccccccccccccccccccccccccccccccccccccc0000000000","0000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000","0000aa9999999999aaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000","000099888888888899999999999999999999999999990000000000","000088777777777788888888888888888888888888880000000000","000077666666666677777777777777777777777777774000000000","000066555555555566666666666666666666666666664440000000","000055444444444455555555555555555555555555554433300000","000044333333333344444444444444444444444444443333300000","000033222222222233333333333333333322222223333333300000","000022222222222222222222222222222222222222222222000000","000011111111111111111111111111111111111111111110000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000"],"n":["......................................................","......................................................","......................................................","......................................................","......................................................","....1000000000000010000000000000......................","....1000000000000000000000000000......................","....1000000000000000000000000000......................","....1000000000000000000000000000......................","....1000000000000000000000000000......................","....Cwwwwwwwwwwwwwjwwjjjjjjjjjjo......................","....rwwwwwwwwwwwwwEwwwwwwwwwwwwy100000000000..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwB100000000000..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwo100000000000..........","....Ewwwwwwwwwwwwwwwwwwwwwwwwwwo100000000000..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwB100000000000..........","....wwwwwwwwwwwwwwjjjjjjjjjjjjjoh0000101010l..........","....EwwwwwwwwwwwwwwwwwwwwwwwwwwBrwwwwwwwwwww..........","....EwwwwwwwwwwwwwwwwwwwwwwwwwwBEwwwwwwwwwww..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwBrwwwwwwwwwww..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwBrwwwwwwwwwww..........","....rBwwwwwwwwwwEwEEEEEEEEEEEEwBrwwwwwwwwwww0.........","....rwwwwwwwwwwwwwjjjjjjjjjjjjjtrwwwwwwwwwww000.......","....Ewwwwwwwwwwwwwwwwwwwwwwwwwwtrwwwwwwwwwww00000.....","....Ewwwwwwwwwwwwwwwwwwwwwwwwwwtrwwwwwwwwwwwj0000t....","....rwwwwwwwwwwwwwwwwwwwwwwwwwwtrwwwwwwwwwwwrrj3l.....","....zt0000000000rBwwwwwwwwwwwwwyrwwwwwwwwwwwrrrrG.....","....rwwwwwwwwwwwwwwwwwwwwwwwwwwtEwwwwwwwwwwwrrrJ......","......................................................","......................................................","......................................................","......................................................","......................................................"],"k":["......................................................","......................................................","......................................................","......................................................","......................................................","....8676666666666676666766666665......................","....8676666666666676666666766665......................","....8666666666666676676666666664......................","....8666666666667666666666667663......................","....8667666666667676666666666663......................","....1111111111113344444545555551......................","....1111111111111011111111111110222222676765..........","....4333333333333334333333333430222222666765..........","....4333333333333333333333333330222222667675..........","....4333333333333343333333333330222222666665..........","....4333333333333333333333333330222666676665..........","....4111111111111011111111111110222222222220..........","....4311111111113233333333333330111111111110..........","....4311111111113233333333333330433333333332..........","....4311333333333233333333433330433333333332..........","....4311333333333233333333313330433333333332..........","....10113333333310000000000000304333333333321.........","....4311333333333254445544555550411111111111111.......","....431133333333323333333333333043111111111111111.....","....4311333333333233333343333330433333333332711110....","....431133333333323333333333333043111111113255750.....","....202666666666101111111111111011111111133255540.....","....11111111111332333333333333304333333333325550......","......................................................","......................................................","......................................................","......................................................","......................................................"],"obs":[[-16.7,0.0,3.2],[-11.1,0.0,3.2],[-2.7,0.0,3.2],[2.9,0.0,3.2],[11.3,0.0,3.2],[16.9,0.0,3.2]],"brk":[20,0],"tall":true},"wall_b":{"w":43,"h":29,"ax":17,"ay":20,"sink":0,"fp":[-14,-3,22,5],"rows":["...........................................","...........................................","...........................................","...........................................","...........................................","....2535535560........0....................","....15555555656555555550...................","....15555555546555555550...................","....15555555226255555550...................","....16666666646655666550...................","....13443334536666666550...................","....12222222212111121110...................","....13333434324333343331333430.............","....13334444324333443331344430.............","....14333433324333333331344440ssssss.......","....13333433324333343333333340s260ss.......","....12222222223222222222335664355660.......","....1322222222333223333322334345555660.....","....1444333342433333344333334565555640.....","....1332222232433333343333334555565220ss...","....aa111111aabaaa2aaaaa2a334555552210ssss.","....00000000000000000000000000c55522aosss..","..............................00cba0oss....","................................00oss......","...........................................","...........................................","...........................................","...........................................","..........................................."],"hts":["0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000cccccccccc00000000c00000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000bbbbbbbbbbbbbbbbbbbb0000000000000000000","0000aaaaaaaaaaaaaaaaaaaa6666660000000000000","0000999999999999999999996666660000000000000","0000888888888888888888886666660000000000000","0000777777777777777777776666660555000000000","0000666666666666666666666666665555540000000","0000555555555555555555555555555554444400000","0000444444444444444444444444444454444400000","0000333333333333333333333333333444443300000","0000222222222222222222222222222334432200000","0000111111111111111111111111111223321000000","0000000000000000000000000000000111110000000","0000000000000000000000000000000001000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000"],"n":["...........................................","...........................................","...........................................","...........................................","...........................................","....0000000000........2....................","....00000000000000000000...................","....00000000080000000000...................","....00000000051000000000...................","....00000000081000000000...................","....410000003g1111111113...................","....wwwwwwwwwtzwwwwwwwwB...................","....wwwwwwwwwBwwwwwwwwww100000.............","....wwwwwwwwwowwwwwwwwww100000.............","....wwwwwwwwwBwwwwwwwwww100000.............","....wwwwwwwwwoEwwwwwwwww100000.000.........","....wwwwwwwwwo9bbbbbbjbjjjjjjb000000.......","....wwwwwwwwwozwwwwwwwwwwwwwww00000000.....","....wwwwwwwwwBzwwwwwwwwwwwwwwze10000gB.....","....wwwwwwwwwozwwwwwwwwwwwwwwzzzr13tBB.....","....wwwwwwwwwtCwwwwwwwwBrwwwwzzzzztttB.....","....wwwwwwwwwBuwwwwwwwwwwwwwwzzzzzBBtB.....","..............................zzzzBBB......","................................MzB........","...........................................","...........................................","...........................................","...........................................","..........................................."],"k":["...........................................","...........................................","...........................................","...........................................","...........................................","....7666666663........5....................","....76666666647666666663...................","....76666766637666666664...................","....76666666637666666664...................","....66666666637666666664...................","....22222222208777777775...................","....11111111101111111110...................","....33333333304333333332222221.............","....33343333304333333332222221.............","....43333433304333333332222221.............","....33333333304333333332222224.666.........","....41111111102222222221216664266666.......","....3311111110633333333311334266666666.....","....3333333330633333333343333688666620.....","....1111111130633333333333333666784000.....","....1111111110511111111011333666660000.....","....3333333330611111111143333666660000.....","..............................6666000......","................................360........","...........................................","...........................................","...........................................","...........................................","..........................................."],"obs":[[-9.7,0.0,3.2],[-4.1,0.0,3.2],[0.3,0.0,3.2],[5.9,0.0,3.2],[10.0,0.0,3.4]],"brk":[13,0],"tall":true},"wall_c":{"w":75,"h":32,"ax":30,"ay":20,"sink":0,"fp":[-27,-3,41,7],"rows":["...........................................................................","...........................................................................","...........................................................................","...........................................................................","...........................................................................",".....255555555665565555550.................................................","....2655555555655555555555665555555555556555555550.........................","....1655555555665555555555655555555555556655555550.........................","....1655555555655555555254655555555555556555555550.........................","....1666666666666666666265666555555555556555555550.........................","....1555555555444444555553666666666266656666666660.........................","....111111111123222222221121112111111111121111111134430....................","....1333333333243333334432433343333333322222223221333440...................","....1333333433244444334442433344433333424333333331344240...................","....1333334443244444334442433444333333324433333331344440sssss..............","....1333334433244443334432433444333333324333333332334560ssssss.............","....1222222222222222222222222332222222223332233322234440ssssss.............","....1322222222223333322222333332222222222222222222233330ssssss.............","....1334444332333333433333333443344333424433333332434430sssss2666660.......","....1333444332333333333333433343344333424433333432434430ssss2555555560.....","....122222222a3baaa11aaaaaaaaaaaaaaaaaaaaa11aaa1aa1111a0ssss1555555220.....","....000000000000000000000000000000000000000000000000000osss25555555620.....","...........................................................14444444220sssss","...........................................................14444444220ssss.","...........................................................0b54444421osss..","............................................................000044baosss...","................................................................000oss.....","...........................................................................","...........................................................................","...........................................................................","...........................................................................","..........................................................................."],"hts":["000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","00000dddddddddcddddddddddd0000000000000000000000000000000000000000000000000","0000cdddddddddddddddddddddcccccccccccccccccccccccc0000000000000000000000000","0000cdddddddddddddddddddddcccccccccccccccccccccccc0000000000000000000000000","0000cdddddddddddddddddddddcccccccccccccccccccccccc0000000000000000000000000","0000cddddddddddddddddddddccccccccccccccccccccccccc0000000000000000000000000","0000cccccccccccccccccccccccccccccccccccccccccccccc0000000000000000000000000","0000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb6666600000000000000000000","00009aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6666660000000000000000000","000099aaaaaaaa99999999999999999999999999aaaaaaaaa96666660000000000000000000","000088999888998888888888888888888888889899999999986666660000000000000000000","000077777888887777777777777777777777777788888888876666660000000000000000000","000066666666666666666666666666666666666666666666666666660000000000000000000","000055555555555555555555555555555555555555555555555555550000000000000000000","000044444444444444444444444444444444444444444444444444440000055555550000000","000033333333333333333333333333333333333333333333333333330000555555555500000","000022222222222222222222222222222222222222222222222222220000555555555400000","000011111111111111111111111111111111111111111111111111100004445555554300000","000000000000000000000000000000000000000000000000000000000003334444444200000","000000000000000000000000000000000000000000000000000000000002223333343100000","000000000000000000000000000000000000000000000000000000000001112222232000000","000000000000000000000000000000000000000000000000000000000000001111120000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000"],"n":["...........................................................................","...........................................................................","...........................................................................","...........................................................................","...........................................................................",".....000000000400000000000.................................................","....400000000010000000000000000000000000000000000l.........................","....400000000010000000000000000000000000000000000d.........................","....400000000000000000000000000000000000000000000d.........................","....400000000000000000000000000000000000000000000d.........................","....mjjjjjjjjjjjjjjjjjjjjg11111111111108000000000d.........................","....uwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwwyzwwwwwwwwy00000....................","....zwwwwwwwwwwwwwwwwwwwwowwwwwwwwwwwwwowwwwwwwwwB100000...................","....zwwwwwwwwwwwwwwwwwwwwowwwwwwwwwwwwwBwwwwwwwwwB000000...................","....zwwwwwwwwwwwwwwwwwwwwowwwwwwwwwwwwwowwwwwwwwwB000000...................","....zwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwowwwwwwwwwB000000...................","....wwwwwwwwwojjjjjjjjjjjjjjjjjjjjjjjjjgEEEEREERRowwwwww...................","....wwwwwwwwwoEwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwowwwwww...................","....wwwwwwwwworwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwowwwwww.....0000000.......","....wwwwwwwwwoEwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwowwwwww....1000000008.....","....zwwwwwwwwyrwwwwwwwwwwBzwwwwwwwwwwwwyzwwwwwwwwyuwwwwy....000000003t.....","....wwwwwwwwwtrwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwowwwwww...zrrre6100tt.....","...........................................................zrrrrrrrttt.....","...........................................................zrrrrrrrBtt.....","...........................................................zrrrrrrrotG.....","............................................................rrrrrrrot......","................................................................EEro.......","...........................................................................","...........................................................................","...........................................................................","...........................................................................","..........................................................................."],"k":["...........................................................................","...........................................................................","...........................................................................","...........................................................................","...........................................................................",".....666666676866666766666.................................................","....8666666676766666667666766666666666646666666660.........................","....8666766666767667666665767666766676646666667660.........................","....8666766666766666666664766666676666646666666660.........................","....9666666666766766667663766666666667636766666660.........................","....8666666666555555556662777777777777736666666661.........................","....611111111013333111111011111111111110211111111022222....................","....6333333333133343333330433333333333301113333330222224...................","....6333333333133444333330333333433333303333333330222224...................","....6333333333134333333430333333333333303333333330222224...................","....6333333333143333343330333333333333303333333330222664...................","....4111111110111111111111221222221222201000000000134441...................","....4311111110113333111111333311111111101111111110133331...................","....3333333330433333333332333333333333303333333330433331.....6777665.......","....3333333330433333333332333333333333303333333430333331....7667766662.....","....2111111110111111111110111111111111101111111110211110....7766677640.....","....1111111110433333333332111111111111103333333330433331...65568876600.....","...........................................................65555555000.....","...........................................................65555555000.....","...........................................................65555555000.....","............................................................555555500......","................................................................4450.......","...........................................................................","...........................................................................","...........................................................................","...........................................................................","..........................................................................."],"obs":[[-22.7,0.0,3.2],[-17.1,0.0,3.2],[-12.7,0.0,3.2],[-7.1,0.0,3.2],[-0.7,0.0,3.2],[4.9,0.0,3.2],[13.3,0.0,3.2],[18.9,0.0,3.2],[23.0,0.0,3.4]],"brk":[26,0],"tall":true},"side_a":{"w":16,"h":43,"ax":8,"ay":25,"sink":0,"fp":[-5,-14,5,14],"rows":["................","................","................","................","................",".....2555550....",".....1555550....",".....1555550....",".....1555550....",".....1555550ssss",".....1555550ssss","....26555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555520ssss","....15555520ssss","....15555550ssss","....16666660ssss","....15444440ssss","....16555550ssss","....16555550ssss","....11555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16666660ssss","....14444440ssss","....14443330ssss","....13443430ssss","....11111110ssss","....1aaa221ossss","....000000oss...","................","................","................","................"],"hts":["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000066666660000","0000066666660000","0000066666660000","0000066666660000","0000066666660000","0000066666660000","0000666666660000","0000666666660000","0000666666660000","0000666666650000","0000666666650000","0000666666650000","0000666666660000","0000666666650000","0000666666650000","0000666666640000","0000666666640000","0000666666650000","0000666666650000","0000566666650000","0000566666660000","0000566666660000","0000466666660000","0000566666660000","0000566666660000","0000666666660000","0000666666660000","0000666666650000","0000555555550000","0000444444440000","0000333333430000","0000222222220000","0000111111100000","0000101111000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"],"n":["................","................","................","................","................",".....0000000....",".....0000000....",".....0000000....",".....0000000....",".....0000008....",".....0000008....","....h0000008....","....h000000d....","....h000000d....","....4000000l....","....4000000l....","....4000000l....","....4000000y....","....4000000y....","....1000000y....","....1000000y....","....1000000y....","....1000000l....","....1111110l....","....r0000008....","....h000000d....","....4000000d....","....4000000d....","....4000000l....","....4000000l....","....4000000l....","....4000000y....","....4000000y....","....rwwwwwwy....","....rwwwwwwy....","....rwwwwwwy....","....Cwwwwwwy....","....zwwwwwwt....","....zEEEwEE.....","................","................","................","................"],"k":["................","................","................","................","................",".....6667665....",".....6666664....",".....6666764....",".....6666673....",".....6676662....",".....6666672....","....86766661....","....86666660....","....86667670....","....86667660....","....86676660....","....86666670....","....86676660....","....86666660....","....86666660....","....76666660....","....77666660....","....76666660....","....77777770....","....46666662....","....86676660....","....87666660....","....86666660....","....86666660....","....86666660....","....86666660....","....86666660....","....86667660....","....63344340....","....53333330....","....53343330....","....11111110....","....61111110....","....4222222.....","................","................","................","................"],"obs":[[0.0,-11.5,4.1],[0.0,-6.7,4.1],[0.0,-1.9,4.1],[0.0,2.9,4.1],[0.0,7.5,4.1],[0.0,12.3,4.1]],"tall":false},"side_b":{"w":16,"h":62,"ax":8,"ay":38,"sink":0,"fp":[-5,-20,4,20],"rows":["................","................","................","................","................","................",".....2535550....","....26555560....","....16555560....","....16555550....","....16555550....","....16555550....","....16556550....","....16555550....","....16555550....","....16555550.sss","....15555550ssss","....16555550ssss","....16555550ssss","....15555550ssss","....16666620ssss","....16666660ssss","....c6555520ssss","....c6555550ssss","....c6555550ssss","....16555550ssss","....16555550ssss","....1655555ossss","....16566520ssss","....16555520ssss","....16555520ssss","....16555520ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16666660ssss","....16666660ssss","....16555550ssss","....15555550ssss","....16555520ssss","....16666620ssss","....16666620ssss","....13344320ssss","....13333320ssss","....13333320ssss","....11111110ssss","....13332320ssss","....14433330ssss","....14343330ssss","....14443440ssss","....13333330ssss","....11111110ssss","....13bbb3bossss","....000000os....","................","................","................","................"],"hts":["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","00000ccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccb0000","0000cccccccb0000","0000cccccccb0000","0000cccccccb0000","0000cccccccb0000","0000cccccccc0000","0000cccccccc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cdddddd00000","0000cdddddda0000","0000cdddddda0000","0000cddddddb0000","0000cddddddb0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000bccccccc0000","0000cccccccc0000","0000cccccccb0000","0000cccccccb0000","0000ccccccca0000","0000ccccccc90000","0000bbbbbbb90000","0000aaaaaaa80000","0000999999970000","0000888888870000","0000777777760000","0000666666660000","0000555555550000","0000444444440000","0000333333330000","0000222222220000","0000111111100000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"],"n":["................","................","................","................","................","................",".....0000008....","....h0000008....","....h0000008....","....h0000008....","....h000000d....","....h000000d....","....h000000l....","....4000000l....","....4000000l....","....4000000l....","....4000000l....","....4000000y....","....4000000y....","....4000000y....","....40000008....","....e6bb6668....","....4000000d....","....40000008....","....40000008....","....40000008....","....40000008....","....40000008....","....40000008....","....4000000d....","....4000000d....","....4000000y....","....4000000y....","....40000008....","....4000000y....","....4000000y....","....4000000l....","....4000000l....","....4000000l....","....4000000l....","....mjjjjjjl....","....1000000t....","....1000000t....","....1000000t....","....0000000t....","....6666666t....","....wwwwwwwy....","....wwwwwwwy....","....wwwwwwwl....","....rwwwwwtl....","....wwwwwwwl....","....jjjjjwwl....","....rwwwwwwt....","....rwwwwwwt....","....rwwwwwwt....","....zwwwwwwy....","....rwwwwwwt....","....URRRRRR.....","................","................","................","................"],"k":["................","................","................","................","................","................",".....7766662....","....86676661....","....86666661....","....86666671....","....87666660....","....86666660....","....86666660....","....86666660....","....86766660....","....86666660....","....86666660....","....86666660....","....86666660....","....86676660....","....86666662....","....87777771....","....86666661....","....86666762....","....86666662....","....86676662....","....86666672....","....86666662....","....86667660....","....86666661....","....86666661....","....86666670....","....86666660....","....86667662....","....86676660....","....86676660....","....87666670....","....86666660....","....87666660....","....86666670....","....86666660....","....86666660....","....76666660....","....76666660....","....76666660....","....77777770....","....33343330....","....34433330....","....33343330....","....11111100....","....33333310....","....75555440....","....53333330....","....43333330....","....43333330....","....21111110....","....43433340....","....0000000.....","................","................","................","................"],"obs":[[0.0,-17.5,4.1],[0.0,-12.7,4.1],[0.0,-7.9,4.1],[0.0,-1.5,4.1],[0.0,3.3,4.1],[0.0,8.1,4.1],[0.0,12.9,4.1],[-0.4,17.5,3.2]],"tall":true},"corner_nw":{"w":49,"h":59,"ax":9,"ay":27,"sink":0,"fp":[-6,-3,37,28],"rows":[".................................................",".................................................",".................................................",".................................................",".................................................","....2555555550...................................","....1555555550...................................","....1555555550...................................","....1555666650...................................","....1666666660...................................","....1111111110...................................","....013322221o...................................",".....12221120....................................",".....14332220....................................",".....14544320....................................",".....16643320....................................",".....16533220....................................",".....15433210....................................",".....16654320....................................",".....15211110.2433333333444365355555555555550....",".....15432210.1444445555555362555555555555550....",".....15443220.1555555555555365552255555555550....",".....15543220.1666666666666366666666666666660....",".....15432220.1666666666666366666666656665550ssss",".....15422220s1333333334333243333333334433330ssss",".....15544420s1333443343443143344433333333330ssss","....02655535133333333333443243333333333333330ssss",".....165555210211111112aaaaaaaaa11a12aaaa2220ssss",".....26555550.000000000000000000000000000000osss.",".....16555550....................................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16666660sssss...............................",".....14444440sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16666660sssss...............................",".....14444440sssss...............................",".....13333330sssss...............................",".....14333330sssss...............................",".....b1111110sssss...............................",".....baaaaa1ossss................................",".....000000oss...................................",".................................................",".................................................",".................................................","................................................."],"hts":["0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000jjjjjjjjjj00000000000000000000000000000000000","0000iiiiiiiii000000000000000000000000000000000000","00000fghhhhgf000000000000000000000000000000000000","00000effffffe000000000000000000000000000000000000","00000deeeeeed000000000000000000000000000000000000","00000cddddddc000000000000000000000000000000000000","00000bccccccb000000000000000000000000000000000000","00000abbbbbba000000000000000000000000000000000000","000009aaaaaa9000000000000000000000000000000000000","0000089999998066666666666666666666666666666660000","0000078888887066666666666666666666666666666660000","0000067777776066666666666666666666666666666660000","0000056666665066666666666666666666666666666660000","0000045555554066666666666666666666666666666660000","0000034444443055555555555555555555555555555550000","0000035555553044444444444444444444444444444440000","0000156666665233333333333333333333333333333330000","0000056666664122222222222222222222222222222220000","0000066666665011111111111111111111111111111100000","0000066666665000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666665000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000055555555000000000000000000000000000000000000","0000044444444000000000000000000000000000000000000","0000033333333000000000000000000000000000000000000","0000022222222000000000000000000000000000000000000","0000011111110000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000"],"n":[".................................................",".................................................",".................................................",".................................................",".................................................","....0000000000...................................","....0000000000...................................","....0000000000...................................","....0000000000...................................","....0000000000...................................","....zwwwwwwwwy...................................","....wEwwEwEEEw...................................",".....HMMEJJBG....................................",".....uzEEwJBG....................................",".....9MrjjoOl....................................",".....9eejbbBl....................................",".....heejwbgd....................................",".....merRRogt....................................",".....uzrjjoBt....................................",".....uzrEwoBt.0000000000000d00000000000000000....",".....uzrrwwBt.0000000000000800000000000000000....",".....uzrEwwBt.0000000000000800000000000000000....",".....uzrwwoBt.0000000000000800000000000000000....",".....uzrEwwBt.666666666666b8jjjjjjjjjjjjjjjjj....",".....uzrrwoBt.wwwwwwwwwwwwwBwwwwwwwwwwwwwwwww....",".....4000000t.wwwwwwwwwwwwwBwwwwwwwwwwwwwwwww....","....h4000000y3wwwwwwwwwwwwwBwwwwwwwwwwwwwwwww....",".....4000000ywwwwwwwwwwwwwwtuwwwwwwwwwwwwwwwy....",".....4000000y.wwwwwwwwwwwwwtrwwwwwwwwwwwwwwww....",".....4000000y....................................",".....40000008....................................",".....4000000y....................................",".....40000008....................................",".....40000008....................................",".....40000008....................................",".....40000008....................................",".....4000000d....................................",".....1000000d....................................",".....rwwwwwwt....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000y....................................",".....rwwwwwwy....................................",".....rwwwwwwy....................................",".....rwwwwwwy....................................",".....Cwwwwwoy....................................",".....uwwwwwwy....................................",".....MEEEEEE.....................................",".................................................",".................................................",".................................................","................................................."],"k":[".................................................",".................................................",".................................................",".................................................",".................................................","....6676666766...................................","....6666666666...................................","....6666666666...................................","....6666666666...................................","....7777776766...................................","....1111111110...................................","....2222222222...................................",".....51210000....................................",".....75421000....................................",".....92654100....................................",".....98875400....................................",".....99854100....................................",".....79500010....................................",".....66664100....................................",".....66110000.2222222222222067766666766666675....",".....66510100.2222666766666266666766666667776....",".....66542100.2676666666666276666666676666676....",".....66542100.6666666676666276667666667667666....",".....66542100.7777777777777276666666666666665....",".....66511100.3333333333333143333333333333332....",".....86666660.3333333333333033333333333333333....","....88666666023333333333333133333333333333333....",".....8666666031111111111110011111111111111110....",".....86667660.3111111111111011111111111111111....",".....86666660....................................",".....86667662....................................",".....87666660....................................",".....87666662....................................",".....86667762....................................",".....86666662....................................",".....86666662....................................",".....87666661....................................",".....86666671....................................",".....54334441....................................",".....86666660....................................",".....86666660....................................",".....86666660....................................",".....97666660....................................",".....87666660....................................",".....86666660....................................",".....86666660....................................",".....86676660....................................",".....86666660....................................",".....87676660....................................",".....63333330....................................",".....63333330....................................",".....63333330....................................",".....11111100....................................",".....61111110....................................",".....3111121.....................................",".................................................",".................................................",".................................................","................................................."],"obs":[[-0.0,0.0,4.2],[8.1,0.0,3.2],[13.7,0.0,3.2],[22.1,0.0,3.2],[27.7,0.0,3.2],[33.3,0.0,3.2],[0.0,6.9,4.1],[0.0,11.7,4.1],[0.0,16.5,4.1],[0.0,19.9,4.1],[0.0,24.7,4.1]],"tall":true},"corner_ne":{"w":50,"h":59,"ax":41,"ay":27,"sink":0,"fp":[-37,-3,5,28],"rows":["..................................................","..................................................","..................................................","..................................................","..................................................","..................................................","......................................266660......",".....................................26666660.....",".....................................16666650.....",".....................................15554220.....",".....................................15543220.....",".....................................15543220.....",".....................................15543220.....",".....................................15211120.....",".....................................15422220.....",".....................................15543220.....",".....................................15443210.....",".....................................15443210.....","............................25555550.15443220.....","....2655555550.255555555555655555550.15211120.....","....1655555550.155555555554665555550.15432220.....","....1655555550.155555555554665555550.15443220.....","....1666566660.166666666664666666660.15443220....s","....1666666660s155555666663444444450s15422220.ssss","....1333334330s133333444442433333340s13432220sssss","....1333334330s133333444442433333330s13443320sssss","....1333333430s133333443442433333333325555522ossss","....1333333330s122222222a2a22122222301555552oss...","....000000000os00000000000000000000os1555550......",".....................................1555550......",".....................................1555550ssssss",".....................................1655550ssssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................1655ccc0sssss",".....................................11525550sssss",".....................................11555550sssss",".....................................26555550sssss",".....................................11555550sssss",".....................................01555550sssss","......................................1555550sssss","......................................1555550sssss","......................................1666660sssss","......................................1444340sssss","......................................1333330sssss","......................................1333330sssss","......................................1333330sssss","......................................11aaaa0sssss","......................................000000os....","..................................................","..................................................","..................................................",".................................................."],"hts":["00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000kkkkkk000000","0000000000000000000000000000000000000kkkkkkkk00000","0000000000000000000000000000000000000jkkkkkkj00000","0000000000000000000000000000000000000ijjjjjji00000","0000000000000000000000000000000000000hiiiiiih00000","0000000000000000000000000000000000000ghhhhhhg00000","0000000000000000000000000000000000000fggggggf00000","0000000000000000000000000000000000000effffffe00000","0000000000000000000000000000000000000deeeeeed00000","0000000000000000000000000000000000000cddddddc00000","0000000000000000000000000000000000000bccccccb00000","0000000000000000000000000000000000000abbbbbba00000","00000000000000000000000000006666666609aaaaaa900000","00006666666666066666666666666666666608999999800000","00006666666666066666666666666666666607888888700000","00006666666666066666666666666666666606777777600000","00006666666666066666666666666666666605666666500000","00006666666666066666666666666666666604555555400000","00005555555555055555555555555555555503444444300000","00004444444444044444444444444444444403444455200000","00003333333333033333333333333333333316666666200000","00002222222222022222222222222222222216666666000000","00001111111110011111111111111111111006666666000000","00000000000000000000000000000000000006666666000000","00000000000000000000000000000000000006666666000000","00000000000000000000000000000000000006666666000000","00000000000000000000000000000000000006666666600000","00000000000000000000000000000000000006666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000006666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000004666666600000","00000000000000000000000000000000000004666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000004666666600000","00000000000000000000000000000000000003666666600000","00000000000000000000000000000000000000666666600000","00000000000000000000000000000000000000666666600000","00000000000000000000000000000000000000666666600000","00000000000000000000000000000000000000555555500000","00000000000000000000000000000000000000444444400000","00000000000000000000000000000000000000333333300000","00000000000000000000000000000000000000222222200000","00000000000000000000000000000000000000111111100000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000"],"n":["..................................................","..................................................","..................................................","..................................................","..................................................","..................................................","......................................000000......",".....................................40000008.....",".....................................u100008t.....",".....................................uzrrwoBt.....",".....................................uzrEwoBt.....",".....................................uzrEwwBt.....",".....................................uzrEwoBt.....",".....................................uzrwwoBt.....",".....................................uzrwwwBt.....",".....................................uzrwwoBt.....",".....................................uzrEwoBt.....",".....................................uzrwwoBt.....","............................22220000.uzrEwoBt.....","....h000000000.000000000000100000000.uzrEwoBt.....","....h000000000.100000000000100000000.uzrEwoBt.....","....h000000000.000000000000100000000.uzrEwoBt.....","....h000000000.000000000008400000000.uzrEwwBt.....","....m6bb66666b.jjjjjjjjjjjgrwjwwwwww.uzrEwoBt.....","....zwwwwwwwww.wwwwwwwwwwwBrwwwwwwwB.uzrwwoBt.....","....zwwwwwwwww.wwwwwwwwwwwBrwwwwwwww.uzrw222t.....","....zwwwwwwwww.wwwwwwwwwwwBrwwwwwwwwh000000008....","....zwwwwwwwww.wwwwwwwwwwwyuwwwwwwwwE0000000t.....","....uwwwwwwwww.wwwwwwwwwwwtzwwwwwwww.1000000......",".....................................1000000......",".....................................1000000......",".....................................1000000......",".....................................1000000d.....",".....................................4000000d.....",".....................................40000008.....",".....................................40000005.....",".....................................4000000l.....",".....................................4000000d.....",".....................................h000000d.....",".....................................h0000008.....",".....................................u0000008.....",".....................................u0000008.....",".....................................u0000000.....",".....................................u0000000.....",".....................................u0000000.....",".....................................u0000000.....","......................................0000000.....","......................................0000000.....","......................................0001100.....","......................................wwwwwww.....","......................................wwwwwww.....","......................................wwwwwww.....","......................................wwwwwww.....","......................................rwwwwwo.....","......................................EEEEEww.....","..................................................","..................................................","..................................................",".................................................."],"k":["..................................................","..................................................","..................................................","..................................................","..................................................","..................................................","......................................666666......",".....................................86666661.....",".....................................69666630.....",".....................................66552000.....",".....................................66542100.....",".....................................66542000.....",".....................................66542000.....",".....................................66111000.....",".....................................66511100.....",".....................................66542100.....",".....................................66542000.....",".....................................66542100.....","............................56666666.66542100.....","....8676666667.766677667665866666666.66111000.....","....8666666666.766666766664876676666.66542100.....","....8667666666.766766666763866676666.66542000.....","....8666666666.666666666662876666666.66542100.....","....9777777777.555555655661644444344.26511000.....","....6333333333.333333333330533333330.22543000.....","....6333343333.334333333330533333333.21545660.....","....6333333333.3333333333405333333332766666620....","....6333333333.411111111110111111113176666660.....","....6111111111.333331111110611111113.7766666......",".....................................7676666......",".....................................7666666......",".....................................8666666......",".....................................86666661.....",".....................................86766662.....",".....................................86667672.....",".....................................86666672.....",".....................................86666660.....",".....................................86677660.....",".....................................87666660.....",".....................................87666661.....",".....................................66666672.....",".....................................67666663.....",".....................................67666663.....",".....................................66676664.....",".....................................66666665.....",".....................................66666665.....","......................................6667665.....","......................................7666666.....","......................................7777776.....","......................................3333333.....","......................................3333332.....","......................................3333333.....","......................................3333333.....","......................................1111110.....","......................................2222221.....","..................................................","..................................................","..................................................",".................................................."],"obs":[[0.0,0.0,4.2],[-32.7,0.0,3.2],[-27.1,0.0,3.2],[-22.7,0.0,3.2],[-17.1,0.0,3.2],[-10.7,0.0,3.2],[-5.1,0.0,3.2],[0.0,6.9,4.1],[0.0,11.7,4.1],[0.0,16.5,4.1],[0.0,21.3,4.1],[0.0,26.1,4.1]],"tall":true},"col_a":{"w":18,"h":39,"ax":9,"ay":32,"sink":0,"fp":[-6,-3,6,3],"rows":["..................","..................","..................","..................","..................","....2555555550....","....1555555550....","....1555255550....","....1555555550....","....1666666660....","....1333333330....","....033333333o....",".....12222220.....",".....12222220.....",".....15432220.....",".....15332220.....",".....15554320.....",".....16654320.....",".....16432220.....",".....15421220.....",".....15443220.....",".....15443210.....",".....15543210.....",".....15443210.....",".....15322110.....",".....15421210.....",".....15443210.....",".....15543220....s",".....15443220sssss",".....15433220sssss","....2552211220ssss","....1554222210ssss","....005433230os...","......00000o......","..................","..................","..................","..................",".................."],"hts":["000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000nnnnnnnnn00000","00000lmmmmmml00000","00000jkllllkj00000","00000ijjjjjji00000","00000hiiiiiih00000","00000ghhhhhhg00000","00000fggggggf00000","00000effffffe00000","00000deeeeeed00000","00000cddddddc00000","00000bccccccb00000","00000abbbbbba00000","000009aaaaaa900000","000008999999800000","000007888888700000","000006777777600000","000005666666500000","000004555555400000","000003444444300000","000012333333210000","000011222222110000","000001111111100000","000000111110000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000"],"n":["..................","..................","..................","..................","..................","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....jjjjjjjjjj....","....wwwwwwwwww....",".....HMEEJJJO.....",".....HzEEJJBG.....",".....HmEEwJod.....",".....meMEJJgt.....",".....9Mrjjwtl.....",".....9zejbbO8.....",".....uee6bbgt.....",".....uzrEwoBt.....",".....zzrEwwBt.....",".....uzrEwwBt.....",".....uzrwwwBt.....",".....uzrwwwBt.....",".....uzrrwoBt.....",".....uzrEwoBt.....",".....uzrEwwBt.....",".....uzrEwwBt.....",".....uzrrwoBt.....",".....uzrEwwBt.....","....1uzrEwoBtd....","....1HzrEwoBtl....","....u90EEwB0gt....","......rrjwwB......","..................","..................","..................","..................",".................."],"k":["..................","..................","..................","..................","..................","....6666666666....","....7666666666....","....6676666667....","....6666666666....","....6666666666....","....1122112112....","....3333333333....",".....11110000.....",".....51310000.....",".....38331000.....",".....88010000.....",".....93665000.....",".....95875400.....",".....68876520.....",".....66511100.....",".....66542100.....",".....66542100.....",".....76533100.....",".....66543100.....",".....66111000.....",".....66511100.....",".....66542100.....",".....66542100.....",".....66542100.....",".....66542100.....","....7661100000....","....8565111000....","....6974220620....","......654320......","..................","..................","..................","..................",".................."],"obs":[[0.0,0.0,4.4]],"tall":true},"col_b":{"w":22,"h":49,"ax":9,"ay":33,"sink":0,"fp":[-5,-3,9,12],"rows":["......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......20..............",".....24440............",".....1444440..........",".....14444440.........",".....14444440.........",".....15544440.........",".....15443220.........",".....15443220.........",".....15443220.........",".....15322220.........",".....15321120.........",".....15443220.......ss",".....15543210....sssss",".....15443210sssssssss",".....15433210sssssssss","....2552211110ssssssss","....1554212110sssss...","....005bbb230os.......","......00000o..........","......................","......................","...........250........","..........255560......",".........26655560.....",".........05665540ss...","..........0c54220sss..","...........0cba0oss...","............00os......","......................","......................","......................","......................","......................"],"hts":["0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","000000ff00000000000000","00000ffeee000000000000","00000ffeeedd0000000000","00000eeeedddd000000000","00000deeedddd000000000","00000cddddddc000000000","00000bccccccb000000000","00000abbbbbba000000000","000009aaaaaa9000000000","0000089999998000000000","0000078888887000000000","0000067777776000000000","0000056666665000000000","0000045555554000000000","0000034444443000000000","0000123333332100000000","0000112222221100000000","0000111111111000000000","0000001111100000000000","0000000000000000000000","0000000000000000000000","0000000000044400000000","0000000000444433000000","0000000003333333300000","0000000002233333200000","0000000000122322100000","0000000000011211000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000"],"n":["......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......88..............",".....83833............",".....3080003..........",".....z3053058.........",".....ur000838.........",".....zzrj383l.........",".....zzrwwoBt.........",".....zzrwwoBt.........",".....uzrwwwBt.........",".....uzrEwoBt.........",".....uzrEwoBt.........",".....uzrEwwBt.........",".....mzrwwoBt.........",".....uzrwwwBt.........",".....uzrwwoBt.........","....1uzrrwoBtd........","....1HzrwwoBtl........","....u90EEww0gt........","......rrrwwB..........","......................","......................","...........000........","..........100000......",".........zz600000.....",".........zzze03gB.....","..........zzzwBBB.....","...........zzwBBB.....","............zBB.......","......................","......................","......................","......................","......................"],"k":["......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......23..............",".....34364............",".....5444564..........",".....74636622.........",".....77565342.........",".....66545250.........",".....66542100.........",".....66533000.........",".....66543100.........",".....66111000.........",".....66511000.........",".....66542100.........",".....76543000.........",".....66542100.........",".....66532100.........","....7661110000........","....8565111000........","....6963310620........","......555420..........","......................","......................","...........666........","..........866665......",".........66966666.....",".........66696620.....","..........6664000.....","...........661000.....","............500.......","......................","......................","......................","......................","......................"],"obs":[[0.0,0.0,4.4]],"tall":true},"col_c":{"w":18,"h":20,"ax":9,"ay":13,"sink":0,"fp":[-5,-3,5,3],"rows":["..................","..................","..................","..................","..................",".......2660.......",".....26666660.....",".....16666660.....",".....16666650.....",".....15544220sss..",".....15443220sssss","....2552211110ssss","....1554212120ssss","....005b3ba30os...","......00000o......","..................","..................","..................","..................",".................."],"hts":["000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000066660000000","000006666666600000","000006666666600000","000005666666500000","000004555555400000","000003444444300000","000012333333210000","000011222222110000","000011111111100000","000000111110000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000"],"n":["..................","..................","..................","..................","..................",".......0000.......",".....40000000.....",".....10000008.....",".....m600003t.....",".....uzrwwoBt.....",".....uzrwwoBt.....","....1uzrrwoBtd....","....4HzrEwwBtl....","....u90EEww0gt....","......rrjwwB......","..................","..................","..................","..................",".................."],"k":["..................","..................","..................","..................","..................",".......6666.......",".....76666664.....",".....86666663.....",".....79666640.....",".....66533000.....",".....66533100.....","....7661110000....","....9565111000....","....6974310620....","......655310......","..................","..................","..................","..................",".................."],"obs":[[0.0,0.0,4.4]],"tall":false},"col_d":{"w":18,"h":34,"ax":9,"ay":27,"sink":0,"fp":[-6,-3,6,3],"rows":["..................","..................","..................","..................","..................","....2555555550....","....1555555550....","....1555555550....","....1555555550....","....1666666660....","....1111111110....","....011111111o....",".....12221110.....",".....14332110.....",".....15543320.....",".....16543220.....",".....16433220.....",".....14443210.....",".....16654320.....",".....15322110.....",".....15421220.....",".....15543220.....",".....15443210....s",".....15443220sssss",".....15443220sssss","....2652211220ssss","....1254212210ssss","....005bbaa30os...","......00000o......","..................","..................","..................","..................",".................."],"hts":["000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000jjjjjjjjjj0000","0000iiiiiiiii00000","00000gghhhhgg00000","00000effggffe00000","00000deeeeeed00000","00000cddddddc00000","00000bccccccb00000","00000abbbbbba00000","000009aaaaaa900000","000008999999800000","000007888888700000","000006777777600000","000005666666500000","000004555555400000","000003444444300000","000012333333210000","000011222222110000","000011111111100000","000000111110000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000"],"n":["..................","..................","..................","..................","..................","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....zwwwwwwwwy....","....RRRRRRRRRR....",".....HMEEJJBB.....",".....mzEEJJBt.....",".....9zrjjoB8.....",".....9eejbbg8.....",".....herEwbg8.....",".....meMEJJgt.....",".....uzrjjoBt.....",".....uzrEwoBt.....",".....uzrwwwBt.....",".....uzrwwwBt.....",".....uzrEwwBt.....",".....uzrwwwBt.....",".....zzrwwoBt.....","....1uzrrwoBtd....","....4HzrEwwBtl....","....u90EEwB0gt....","......zrjwwo......","..................","..................","..................","..................",".................."],"k":["..................","..................","..................","..................","..................","....6767666666....","....7666666666....","....6676666667....","....6666666666....","....7666666666....","....1111111110....","....0000000000....",".....41010000.....",".....85320000.....",".....95664200.....",".....98865100.....",".....89720110.....",".....99100010.....",".....66665200.....",".....66111000.....",".....66511100.....",".....76542100.....",".....66542100.....",".....66542100.....",".....66542100.....","....7661110000....","....9565110000....","....5974310610....","......555310......","..................","..................","..................","..................",".................."],"obs":[[0.0,0.0,4.4]],"tall":true},"stele_a":{"w":24,"h":27,"ax":12,"ay":20,"sink":0,"fp":[-9,-3,9,3],"rows":["........................","........................","........................","........................","........................","........................","......2555555555550.....","......1666666666660.....",".....24444444444550.....",".....13333333333330.....",".....11111111111110.....",".....13333333333330.....",".....13333444333330.....",".....13333444333330.....",".....13344443333330.....",".....1222222222222osssss","....2111111111111120ssss","....1533333333333320ssss","....1533333433333320ssss","....154b4444b4444440ssss","....144b4555cccb44b0ss..","....000000000000000os...","........................","........................","........................","........................","........................"],"hts":["000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000ddddddddddddd00000","000000ddddddddddddd00000","00000dddddddddddddc00000","00000cccccccccccccb00000","00000bbbbbbbbbbbbbb00000","00000aaaaaaaaaaaaaa00000","000009999999999999900000","000007888888888888800000","000006777777777777700000","000005666666666666000000","000024555555555555320000","000023444444444444320000","000022333333333333220000","000022222222222222220000","000012222222221111110000","000011111111111111000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000"],"n":["........................","........................","........................","........................","........................","........................","......000000000000d.....","......000000000000l.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwy.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....",".....Cwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....","....0uwwwwwwwwwwww00....","....0uwwwwwwwwwwww00....","....0hwwwwwwwwwwww00....","....0066666666666600....","....136bbjjjjjjwwwww....","....wwwwwwwwwwwwwwww....","........................","........................","........................","........................","........................"],"k":["........................","........................","........................","........................","........................","........................","......6666767666661.....","......6666676667661.....",".....64443444434440.....",".....63333333333330.....",".....61111111111110.....",".....63333333333330.....",".....63333333333330.....",".....63333333333330.....",".....63333333333330.....",".....61111111111110.....","....6611111111111121....","....6633333333333311....","....7833333333333322....","....7677777777777766....","....2222265544444333....","....3333333333333322....","........................","........................","........................","........................","........................"],"obs":[[0.0,0.0,5.8]],"tall":true},"stele_b":{"w":26,"h":28,"ax":14,"ay":21,"sink":0,"fp":[-10,-3,9,3],"rows":["..........................","..........................","..........................","..........................","..........................","..........................",".............2550.........","........255555660.........",".....2555566666650........","....26666665444440........","....05433333333330........",".....1111111111110........",".....13332233333330.......",".....13333333333330.......",".....03334333333330.......","......1344333333330.......","......12222222222220ssssss","......1111111111111130ssss","......1333333333333130ssss","......1334333333333330ssss","......1444444444444450sss.","......144444544bb44440ss..","......000000000000000os...","..........................","..........................","..........................","..........................",".........................."],"hts":["00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","0000000000000deee000000000","00000000cdddddeee000000000","00000ccccdddddeeec00000000","0000cccccddddddddc00000000","0000bccccccccccccb00000000","00000bbbbbbbbbbbba00000000","00000aaaaaaaaaaaaa80000000","00000999999999999980000000","00000888888888888870000000","00000077777777777770000000","00000066666666666664000000","00000045555555555554220000","00000034444444444444220000","00000023333333333333220000","00000022222222222222220000","00000012222222222111110000","00000011111111111110000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000"],"n":["..........................","..........................","..........................","..........................","..........................","..........................",".............1110.........","........111111110.........",".....11111111116jl........","....h11116jjwwwwwl........","....h6wwwwwwwwwwwl........",".....wwwwwwwwwwwwl........",".....wwwwwwwwwwwwwl.......",".....Ewwwwwwwwwwwwl.......",".....zwwwwwwwwwwwwl.......","......wwwwwwwwwwwwo.......","......zwwwwwwwwwwwol......","......Hwwwwwwwwwwwwl00....","......zwwwwwwwwwwwwt00....","......0wwwwwwwwwwwwo00....","......0666666666666600....","......136bbjjjjjwwwwww....","......wwwwwwwwwwwwwwww....","..........................","..........................","..........................","..........................",".........................."],"k":["..........................","..........................","..........................","..........................","..........................","..........................",".............7776.........","........777777776.........",".....7777887778740........","....87778875333330........","....82111333333330........",".....1111111111110........",".....33333333333330.......",".....43333333333330.......",".....53333333333330.......","......3333333333331.......","......11111111111100......","......1111111111111021....","......5333333333333021....","......7333333333333122....","......7777777777777766....","......2222215544443333....","......4333333333332332....","..........................","..........................","..........................","..........................",".........................."],"obs":[[0.0,0.0,5.8]],"tall":true},"pave_a":{"w":44,"h":24,"ax":22,"ay":13,"sink":0,"fp":[-18,-7,19,7],"rows":["............................................","............................................","............................................","............................................","............................................","....233333333333333333333330................","....144444444444344444444440s...............","....144444445544454444444440................","....144444444444454444444440s...............","....144444444444444444544440s...............","....144444444444444444444440s...............","....144444444344444444444440s...............","....133333443333000000000000333334333330....","....144444444440s...........144444444440s...","....144443444440s...........144444444440s...","....144444344440s...........144444454440s...","....144444434440s...........155544545440....","....144444443440s...........144544444440....","....044444333340s...........14444444444o....",".....0000000000os...........0000000000os....","............................................","............................................","............................................","............................................"],"hts":["00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111100000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000"],"n":["............................................","............................................","............................................","............................................","............................................","....000000000000202000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000wwwwwwwwwwww000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....100000000000............000000000000....",".....RRRRRRRRRRR............RRRRRRRRRRR.....","............................................","............................................","............................................","............................................"],"k":["............................................","............................................","............................................","............................................","............................................","....666667666676666666666666................","....666666666666676666666666................","....667667666766676666666666................","....766766666666666666666666................","....666676666666766666666666................","....766667667666666666666666................","....666766666666676666666666................","....666666666666444444444334666666666666....","....666776666666............676676666766....","....766667666666............666666666666....","....766766676666............667666666666....","....766667666676............666666666666....","....766666666666............666666666665....","....766667666666............666666766665....",".....33333333333............33333333333.....","............................................","............................................","............................................","............................................"],"obs":[]},"pave_b":{"w":56,"h":31,"ax":28,"ay":16,"sink":0,"fp":[-25,-11,25,11],"rows":["........................................................","........................................................","........................................................","........................................................","........................................................","................233344454443344333333333333333333340....","................144444444444444444444443344434444440s...","................144444444444444444444443444434444440s...","................144444444444544444444444344443444440s...","................144444444444444444454444444444345440s...","................144444444444444444444444444444434440s...","................144444434334444434444444444443333430....","....245443333444333333333333333333333444444444444330....","....144445444444444444444443344444444444444344444440s...","....144455444444444444444443444444444443444344444440s...","....144445544444344444444553444444555544444434444440s...","....144444444443444444444543444444555544445434444440s...","....144444444443444444444443444444444444444434444440s...","....144344444444000000000000000000000000444444334440s...","....134333444330s.......................00000000000o....","....144444554440s.......................................","....144445444440s.......................................","....144444444550s.......................................","....144544454450s.......................................","....144444444440s.......................................","....00000000000os.......................................","........................................................","........................................................","........................................................","........................................................","........................................................"],"hts":["00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111100000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000"],"n":["........................................................","........................................................","........................................................","........................................................","........................................................","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................111111111100000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000611111101000000000000000000000000000....","....000000000000........................EEEEEEEEEEEE....","....000000000000........................................","....000000000000........................................","....000000000000........................................","....000000000000........................................","....000000000000........................................","....000111001110........................................","........................................................","........................................................","........................................................","........................................................","........................................................"],"k":["........................................................","........................................................","........................................................","........................................................","........................................................","................666766666667676666666666666666666666....","................666676666666766667666667666667666676....","................666666666666666667666666666666776666....","................666666676666666666666666677666666666....","................667667666666666666676666766666666666....","................666676666666766676666666666667666666....","................777777777777666666666666667666666665....","....766666676666666666666666666667666666766666666666....","....766666666766666666666666666666766666666666666667....","....766676666666666666666666666666666677666676666666....","....766666666766666676666666667666666666667667666666....","....766666666666666666666666666666667666666666676667....","....766676676666666676676675667666666666766676666666....","....867766766776777777777675676676676777666666676666....","....666666666666........................212111211111....","....666666766666........................................","....666666666666........................................","....767666766666........................................","....676666676666........................................","....666666666666........................................","....777777677776........................................","........................................................","........................................................","........................................................","........................................................","........................................................"],"obs":[]},"pave_c":{"w":32,"h":24,"ax":16,"ay":13,"sink":0,"fp":[-13,-7,13,7],"rows":["................................","................................","................................","................................","................................","....233333344430..2330.2330.....","....144444444444344444444440....","....144444444544445455444440....","....144444444443445444444440....","....144444444444444444444440....","....144444444444344454444440....","....133444444443444444444440s...","....000000000000333344433330s...","................144444444440s...","................144444444440s...","................144444444440s...","................144444444440s...","................144444444540s...","................144444444440s...","................00000000000o....","................................","................................","................................","................................"],"hts":["00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00001111111111110011110111100000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000"],"n":["................................","................................","................................","................................","................................","....000000000000..2222.0000.....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....wwwwwwwwwwww000000000000....","................000000000000....","................000000000000....","................000000000000....","................000000000000....","................000000000000....","................000000000000....","................+///////////....","................................","................................","................................","................................"],"k":["................................","................................","................................","................................","................................","....666666766666..5555.6666.....","....666666666666666666666665....","....666667766666666667666765....","....666666667667667676666666....","....666767666666666666666666....","....667667666676666666666676....","....666666766666766766666666....","....333333333332667666666666....","................667676676666....","................666666666666....","................667666666666....","................667666676666....","................666666666766....","................666766666666....","................111111111111....","................................","................................","................................","................................"],"obs":[]},"steps_a":{"w":26,"h":23,"ax":13,"ay":13,"sink":0,"fp":[-9,-5,9,5],"rows":["..........................","..........................","..........................","..........................","..........................","....255555555555555550....","....155555555555555550....","....166665555555655550sss.","....166666666666666660sss.","....144434444444444440sss.","....165555555555555550sss.","....06555555555555552os...",".....166666666c666660ss...",".....13333333bbbbb330ss...",".....1556555555555550s....",".....1555555555555550s....",".....1655555666666650s....",".....000000000000000o.....","..........................","..........................","..........................","..........................",".........................."],"hts":["00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00003333333333333333330000","00003333333333333333330000","00003333333333333333330000","00003333333333333333330000","00002222222222222222220000","00001222222222222222210000","00001222222222222222200000","00000222222222222222200000","00000211111111111111100000","00000111111111111111100000","00000111111111111111100000","00000111111111111111100000","00000111111111111111000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000"],"n":["..........................","..........................","..........................","..........................","..........................","....000000000000000000....","....000000000000000000....","....000000000000000000....","....001111111111111113....","....wjjjjjjjjjjjjjjjjw....","....r0000000000000000w....","....E0000000000000000W....",".....0000000000000000.....",".....wwwwwwwwwwwwwwww.....",".....100000000000000l.....",".....100000000000000l.....",".....100000000000000l.....",".....rwwwwwwwwwwwwwwt.....","..........................","..........................","..........................","..........................",".........................."],"k":["..........................","..........................","..........................","..........................","..........................","....666666666666666665....","....667666676667666665....","....676666666666666675....","....777777777777777776....","....355555555555666662....","....666666666766766661....","....366666666766666660....",".....6666666666666676.....",".....3333333333333433.....",".....8667676666666660.....",".....8666676666666660.....",".....8666666676667660.....",".....4333333433333330.....","..........................","..........................","..........................","..........................",".........................."],"obs":[]},"blocks_a":{"w":21,"h":24,"ax":12,"ay":13,"sink":0,"fp":[-8,-3,5,6],"rows":[".....................",".....................",".....................",".....................",".....................",".....................","..........250........",".........2555560.....","........255556640....",".......2552666520....","......25555565220sss.",".....25555565222ossss",".....1666665222ossss.","....2555555212ossss..","....1555555210ssss...","....155555521ossss...","....0cc55532ossss....",".....000005ossss.....","..........oss........",".....................",".....................",".....................",".....................","....................."],"hts":["000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000055500000000","000000000555555500000","000000005555555540000","000000055555555430000","000000555555554320000","000006555555543200000","000005556665532000000","000044455555420000000","000033444444310000000","000023333333200000000","000012222222000000000","000001111110000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000"],"n":[".....................",".....................",".....................",".....................",".....................",".....................","..........000........",".........1000010.....","........10000018t....",".......00010008tt....","......00000020ttt....",".....02222000tttt....",".....rre6100tttt.....","....urrrrrrtttt......","....mrrrrrrttt.......","....mrrrrrrttt.......","....rrrrrrrtt........",".....Mrrrrrt.........","..........E..........",".....................",".....................",".....................",".....................","....................."],"k":[".....................",".....................",".....................",".....................",".....................",".....................","..........776........",".........7777777.....","........877777720....",".......6677777300....","......56556554000....",".....555555540000....",".....66787540000.....","....76666660000......","....7666666000.......","....7666666000.......","....766666100........",".....1466660.........","..........3..........",".....................",".....................",".....................",".....................","....................."],"obs":[[-0.2,0.3,3.4],[-2.7,3.2,3.7]]},"blocks_b":{"w":24,"h":22,"ax":12,"ay":12,"sink":0,"fp":[-8,-1,9,5],"rows":["........................","........................","........................","........................","........................","........................","........................","........................",".......2555552560.......","....06555555523460......",".....15555566233550s....",".....166666544234420s...",".....15433444322111oss..",".....1333344422110oss...",".....13333443210osss....",".....033bbbbb0osss......","......000000os..........","........................","........................","........................","........................","........................"],"hts":["000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000055555564440000000","000045555555564433000000","000005555555564333300000","000005555555554333320000","000004444444444222200000","000003433334433111000000","000002322222322000000000","000001111112210000000000","000000000001000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000"],"n":["........................","........................","........................","........................","........................","........................","........................","........................",".......1111110000.......","....u1011111110000......",".....40111111100000.....",".....611116jjwj10bBt....",".....jwwwwj6bwtzBBBB....",".....rwwwwrEwwoEBBB.....",".....zwwwwErwwwEB.......",".....zwwwwrrwww.........","......wwwwrrB...........","........................","........................","........................","........................","........................"],"k":["........................","........................","........................","........................","........................","........................","........................","........................",".......7777775666.......","....77677777772266......",".....87777777722666.....",".....877777643126400....",".....743326763010000....",".....53333443101000.....",".....522234431210.......",".....6333344112.........","......3332440...........","........................","........................","........................","........................","........................"],"obs":[[-2.5,3.1,3.3],[3.8,1.0,2.5],[-2.2,2.9,3.8]]},"wall_d":{"w":47,"h":32,"ax":29,"ay":20,"sink":0,"fp":[-25,-3,15,8],"rows":["...............................................","...............................................","...............................................","...............................................","...............................................",".............................25555555555550....",".............................15555555555550....",".............................16555555555650....",".............................16555555555550....",".............................16666666666660....",".............................15555556666660....",".............................11111112222220....","...............2555555555555413333333333330....","...............1555555555555313334333333330....","...............1255555555555313333333333330ssss","...............1666666666666453334333333330ssss","...............1555555555555342222222222220ssss","...............1333334443444243333333333330ssss","..........2660.1333334333444244444444333440ssss",".......266556214333333333344243444344334430ssss","......255556321223aaaaaaaaaaa111aaaa11aaaa0ssss",".....2555655222100000000000000000000000000osss.",".....16544443220ssss...........................",".....1444444422osss............................",".....0b4444444ossss............................","......0bbbb40ossss.............................",".......0000osssss..............................","...............................................","...............................................","...............................................","...............................................","..............................................."],"hts":["00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000bbbbbbbbbbbbbb0000","00000000000000066666666666666aaaaaaaaaaaaaa0000","00000000000000066666666666666999999999999990000","00000000000000066666666666666888888888888880000","00000000000000066666666666666777777777777770000","00000000000000066666666666666666666666666660000","00000000000000055555555555555555555555555550000","00000000005566044444444444444444444444444440000","00000004455666533333333333333333333333333330000","00000034456665422222222222222222222222222220000","00000344555655431111111111111111111111111100000","00000344444554320000000000000000000000000000000","00000333333444300000000000000000000000000000000","00000222222333000000000000000000000000000000000","00000011111220000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000"],"n":["...............................................","...............................................","...............................................","...............................................","...............................................",".............................10000000000000....",".............................10000000000000....",".............................10000000000000....",".............................10000000000000....",".............................40000000000000....",".............................eb6bbbbbbbjjjj....",".............................uwwwwwwwwwwwww....","...............0000000000000drwwwwwwwwwwwww....","...............00000000000008rwwwwwwwwwwwww....","...............00000000000008rwwwwwwwwwwwww....","...............00000000000008rwwwwwwwwwwwww....","...............jjjjjjjjjjjjjorwwwwwwwwwwwww....","...............wwwwwwwwwwwwwBEwwwwwwwwwwwww....","..........4448.wwwwwwwwwwwwwBwwwwwwwwwwwwww....",".......444440llwwwwwwwwwwwwwBEwwwwwwwwwwwww....","......444444lllwwwwwwwwwwwwwyuwwwwwwwwwwwwy....",".....4444errglllwwwwwwwwwwwwtrwwwwwwwwwwwwo....",".....4errrrrwlll...............................",".....rrrrrrrrgll...............................",".....rrrrrrrrwl................................","......rrrrrrrE.................................",".......EMEEE...................................","...............................................","...............................................","...............................................","...............................................","..............................................."],"k":["...............................................","...............................................","...............................................","...............................................","...............................................",".............................76666666766665....",".............................86667666667666....",".............................86666666676666....",".............................86666666766666....",".............................86666666666666....",".............................97776667666666....",".............................21111111111111....","...............6666766666666153333333333333....","...............6676666666676153333333333333....","...............6766666666676153333333333333....","...............6676666667766153333333333333....","...............5555555555555041111111111110....","...............4333333333333043333333333331....","..........8880.3333333333333043333333333331....",".......888885003333333333333043333333333331....","......8878880001111111111111021111111111110....",".....88889640000111111111111011111111111110....",".....88555454000...............................",".....45455555000...............................",".....5555554540................................","......54455544.................................",".......32422...................................","...............................................","...............................................","...............................................","...............................................","..............................................."],"obs":[[-10.7,0.0,3.2],[-5.1,0.0,3.2],[3.3,0.0,3.2],[8.9,0.0,3.2]],"brk":[-14,0],"tall":true},"wall_e":{"w":61,"h":40,"ax":36,"ay":26,"sink":0,"fp":[-33,-3,22,10],"rows":[".............................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................2555555555550.25555555555550....",".............................1555555555555365555555555550....",".............................1555555555555365556555555550....",".............................1555555555555465555555555550....",".............................1666666666666366666666666660....",".............................1444444444445354444444555550....","...............255555553555551221221112111121111111111110....","...............155555555555541344433333333243333333233230....","...............155555555555541344443333333243333333333330....","...............165525555555541344333333333243333333333340....","...............166666666666654333333333333143333333333330....","...............144344344444433222222222223122222222222220....","...............132222222222334444334334433133323322232220....","...............132222122112434444333334333133343333443330ssss","...............132233233333434444343334344233433333333330ssss","...............112133233233334444443333344233111111111110ssss","...............122123223223323332222222222133222222222220ssss","...............132123223333424444444444333254444444444440ssss","...............132233333333334333334444333243333333344440ssss","...............132233333333334333334444333243333333333430ssss","...............122233333333434333334334333243333333343330ssss","......2555660..132444444444323222222222222122222222222220ssss","....2555555660.00000000000000000000000000000000000000000osss.","....15666533330..............................................","....15553333330ss............................................","....05554333330ssss..........................................",".....0554333330sssss.........................................","......05533330osss...........................................",".......00000osss.............................................",".........ssss................................................",".............................................................",".............................................................",".............................................................",".............................................................","............................................................."],"hts":["0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000ijjiiiiiiiiii0jjjjjjjjjjjjjj0000","00000000000000000000000000000iiiiiiijiiiiiijjjjjjjjjjjjjj0000","00000000000000000000000000000iiiiijiiiiijiijjjjjjjjjjjjjj0000","00000000000000000000000000000ijjiiiiiiijiiijjjjjjjjjjjjjj0000","00000000000000000000000000000iiijiiiiiiiiiijjjjjjjjjjjjjj0000","00000000000000000000000000000iiiiiiiiiiiiiiiiiiiiiiiiiiii0000","000000000000000cccccccccccccdhhhhhhhhhhhhhhhhhhhhhhhhhhhh0000","000000000000000cccccccccccccdgggggggggggggfgggggggggggggg0000","000000000000000cccccccccccccdffffffffffffffffffgggggggggg0000","000000000000000cccccccccccccdeeeeeeeeeeeeeeeeeeffffffffff0000","000000000000000cccccccccccccdddddddddddddddddddeddeeeeeee0000","000000000000000cccccccccccccccccccccccccccbcccccccccccccc0000","000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000","000000000000000aa9999999999aaaaaaaaaaaaaaa9aaaaaaaaaaaaaa0000","0000000000000009988888888889999999999999998999999999999990000","0000000000000008877777777778888888888888888888888888888880000","0000000000000007766666666667777777777777777777777777777770000","0000000000000006655555555556666666666666666666666666666660000","0000000000000005544444444445555555555555555555555555555550000","0000000000000004433333333334444444444444444444444444444440000","0000000000000003322222222223333333333333333333333333333330000","0000004445555002222222222222222222222222222222222222222220000","0000455555666601111111111111111111111111111111111111111100000","0000345666655550000000000000000000000000000000000000000000000","0000234555554440000000000000000000000000000000000000000000000","0000123444444330000000000000000000000000000000000000000000000","0000012343333320000000000000000000000000000000000000000000000","0000001233222200000000000000000000000000000000000000000000000","0000000122210000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000"],"n":[".............................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................0000000000000.10000000000000....",".............................0000000000000d10000000000000....",".............................0000000000000l10000000000000....",".............................0000000000000d10000000000000....",".............................0000000000000l10000000000000....",".............................111111111111jtrwwwwwwjjjjjww....","...............10000000000000wwwwwwwwwwwwwtuwwwwwwwwwwwwy....","...............10000000000000wwwwwwwwwwwwwtrwwwwwwwwwwwww....","...............10000000000000wwwwwwwwwwwwwtEwwwwwwwwwwwww....","...............10000000000000wwwwwwwwwwwwwtEwwwwwwwwwwwww....","...............00000000000000wwwwwwwwwwwwwtrwwwwwwwwwwwww....","...............Ewwwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwwo....","...............Ewwwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwww....","...............wwwwwwwwwwwwwwwwwwwwwwwwwwwywwwwwwwwwwwwwo....","...............wwwwwwwwwwwwwwwwwwwwwwwwwwwywwwwwwwwwwwwwo....","...............uywwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwwy....","...............rowwwwwwwwwwwBEEEERRRZZZ///yEwEwwwwwwwwwwB....","...............wwwwwwwwwwwwww6bb66666666668jwjwwwwwwwwwwo....","...............EwwwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwo....","...............rwwwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwB....","...............wowwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwB....","......2222222..ww0000000000mtEwwwwwwwwwwwwyrwwwwwwwwwwwwt....","....m42222223b.rwwwwwwwwwwwwowwwwwwwwwwwwwtwwwwwwwwwwwwwB....","....uuu93boooog..............................................","....uuuuoooooot..............................................","....uuuuoooooog..............................................",".....uuujoooooo..............................................","......uujoooooo..............................................",".......urooJJ................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................................................","............................................................."],"k":[".............................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................6666666666666.76766666666666....",".............................7666767666666076666766676665....",".............................6666666666676076676666666665....",".............................6766666667667076666666666665....",".............................6666666667666076666666667665....",".............................2222222222226054444444444443....","...............766666666766651111111111111021111111111110....","...............766666676666653333333333333043333333333332....","...............766666667667653333333333333043333333333332....","...............777676666666653333333333333043333333333332....","...............766667667666653333333333333043333333333332....","...............433333333333314111111111114011111111111110....","...............331111111111313433334433333033313311111110....","...............431131111111313433334334333043343333333331....","...............431333333333313333334333333043333333333330....","...............101333333333313333343334334033111111111110....","...............101333333333100000000000000011111111311210....","...............431333333333317777777777222144444444444440....","...............431333333333313333333333333033333333333330....","...............131333333333313333333333333043333333333330....","...............401333333333313333333333333043333333333330....","......6666666..432666666666201111111111111011111111111110....","....8866666763.131111111111101111111111111011111111111110....","....66796422221..............................................","....76662222220..............................................","....66663222221..............................................",".....6664222222..............................................","......665222222..............................................",".......662200................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................................................","............................................................."],"obs":[[-17.7,0.0,3.2],[-12.1,0.0,3.2],[-3.7,0.0,3.2],[1.9,0.0,3.2],[10.3,0.0,3.2],[15.9,0.0,3.2]],"brk":[-21,0],"tall":true},"wall_f":{"w":38,"h":27,"ax":14,"ay":14,"sink":0,"fp":[-11,-3,21,9],"rows":["......................................","......................................","......................................","......................................","......................................","......................................","....25555555555466555550..............","....15555555555466555550..............","....15255555555466555550..............","....16666666666566666660..............","....15556565555466666660ssssss........","....13343333344243334330ssssss........","....13443343344243333330ss0sss........","....1343334444424333343355666660......","....aa1aaaa111aaaaab344cccc555640.....","....0000000000000000026c555564220.....",".....................055556622220s....","......................155565222220sss.","......................155555212210ssss","......................00c555312a0oss..","........................00c5420oss....","..........................000oss......",".............................s........","......................................","......................................","......................................","......................................"],"hts":["00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00005555555555555555555500000000000000","00004444444444444444444400400000000000","00003333333333333333333345555566000000","00002222222222222222224555556666600000","00001111111111111111134555666665500000","00000000000000000000033445566554400000","00000000000000000000002334455443330000","00000000000000000000001223344433220000","00000000000000000000000112233322100000","00000000000000000000000001122210000000","00000000000000000000000000011000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000"],"n":["......................................","......................................","......................................","......................................","......................................","......................................","....00000000000510000000..............","....00000000000010000000..............","....00000000000510000000..............","....00000000000510000000..............","....jjjjjjjjjjjojjjjjjjb..............","....wwwwwwwwwwwoEwwwwwww..............","....wwwwwwwwwwwoEwwwwwww..2...........","....wwwwwwwwwwwoEwwwwwww22412222......","....uwwwwwwwwwwyuwwwww222222220gg.....","....EwwwwwwwwwwBrwwwwzm912122gogo.....",".....................zzzzzzegoggg.....","......................zzzzzzggtgot....","......................zzzzzzogtggt....","......................zzzzzzooggoB....","........................zzzzwgoB......","..........................MzrB........","......................................","......................................","......................................","......................................","......................................"],"k":["......................................","......................................","......................................","......................................","......................................","......................................","....66666666666286666666..............","....76666766667377666666..............","....76667666676376666665..............","....76666666666376666665..............","....66556655555276666665..............","....33333333333043333332..............","....33333333333043333332..6...........","....4333333333314333343277777777......","....11111111111011133367676767620.....","....11111111111043133789877773000.....",".....................666666800000.....","......................666666000000....","......................666666000000....","......................666666200000....","........................66664000......","..........................0550........","......................................","......................................","......................................","......................................","......................................"],"obs":[[-6.7,0.0,3.2],[-1.1,0.0,3.2],[5.3,0.0,3.2]],"brk":[10,0],"tall":false},"side_c":{"w":16,"h":41,"ax":8,"ay":27,"sink":0,"fp":[-5,-10,4,10],"rows":["................","................","................","................","................","....2555530.....","....1655550.....","....1655550.....","....1555520.....","....1555550.....","....15cc550.....","....155c5520....","....16555520....","....16555520....","....16555520.sss","....16555520ssss","....16525520ssss","....16255520ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16666260ssss","....11666620ssss","....13334440ssss","....11344440ssss","....12222220ssss","....11111110ssss","....13333330ssss","....13333330ssss","....14444440ssss","....13334440ssss","....11112210ssss","....11111220ssss","....0bb3333ossss",".....00000o.s...","................","................","................","................"],"hts":["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000bccccccc0000","0000bccccccc0000","0000abbbbbbb0000","00009aaaaaaa0000","0000899999990000","0000788888880000","0000777777770000","0000666666660000","0000555555550000","0000444444440000","0000333333330000","0000222222220000","0000111111100000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"],"n":["................","................","................","................","................","....0000000.....","....0000000.....","....1000000.....","....1000000.....","....1000000.....","....1000000.....","....1000000d....","....1000000d....","....4000000d....","....4000000d....","....4000000d....","....4000000d....","....4000000d....","....4000000l....","....4000000l....","....9000000d....","....h000000d....","....h000000d....","....h0000008....","....ujjjjjjg....","....uwwwwwwB....","....uwwwwwwB....","....Czwwwwwy....","....uwwwwwwt....","....uwwwwwwB....","....4001011l....","....zwwwwwwt....","....zwwwwwwt....","....Cwwwwwwy....","....uwwwwwwy....","....zwwwwwwy....",".....EEEEEE.....","................","................","................","................"],"k":["................","................","................","................","................","....7666666.....","....7666666.....","....7666666.....","....7666766.....","....7666666.....","....7666666.....","....76666760....","....86666660....","....86666660....","....86666670....","....86666660....","....86666660....","....86666760....","....86666660....","....86666660....","....86666660....","....87666660....","....86666661....","....86766661....","....76666661....","....63333330....","....63333330....","....52111110....","....61111110....","....63333330....","....82222220....","....63433330....","....63333330....","....11111100....","....61111110....","....63333330....",".....111111.....","................","................","................","................"],"obs":[[0.0,-7.5,4.1],[0.0,-2.7,4.1],[0.0,2.1,4.1],[0.0,6.9,4.1]],"tall":true}};/*RUIN_BIG_END*/
/* 倒れた石柱・部屋の残骸（tools/ruin3d.py が書き出す）。rows＝色、hts＝ドットごとの地面からの高さ、ax/ay＝原点、obs＝当たり判定。
   描くときは、そのドットの真下の地面（高さぶん下）が水かを見て、沈んだ所は水に透かし、水際は濡らす。 */
function ruinBigFor(d){
  if(!RUIN_USE_3D||!RUIN_BIG||CAVE.ruinProc) return null;
  if(d.k==='fallen'||d.k==='wfallen') return RUIN_BIG[['fallen_a','fallen_b','fallen_c'][d.s%3]]||null;
  if(d.k==='ruinroom') return RUIN_BIG[['room_a','room_b','room_c'][(d.s>>>3)%3]]||null;
  if(d.k==='rbig') return RUIN_BIG[d.name]||null;
  return null;
}
let _bigW=null;
/* 敷石の形：0=描かない／1=描く／2=縁（半分）。影 's' と外の輪郭は捨て、縁は所々欠かす */
function paveMask(d,sp){
  if(d._pm) return d._pm; const W=sp.w, H=sp.h, m=new Uint8Array(W*H), on=(q,r)=>q>=0&&r>=0&&q<W&&r<H&&sp.rows[r][q]!=='.'&&sp.rows[r][q]!=='s';
  for(let r=0;r<H;r++)for(let q=0;q<W;q++) if(on(q,r)) m[r*W+q]=1;
  // 外の輪郭（暗い0と左の1の列）を剥ぐ：外に面したドットを1重だけ消す
  const peel=new Uint8Array(m); for(let r=0;r<H;r++)for(let q=0;q<W;q++) if(m[r*W+q]&&(!on(q-1,r)||!on(q+1,r)||!on(q,r-1)||!on(q,r+1))) peel[r*W+q]=0;
  // 縁に1〜2か所、マス大の欠け
  const nb=1+d.s%2; for(let i=0;i<nb;i++){ const h=hs(d.s,i+900); let tries=0, cq, cr;
    do{ cq=h%W+tries*7; cr=(h>>>8)%H; cq%=W; tries++; } while(tries<40&&!(peel[cr*W+cq]&&(!peel[cr*W+Math.max(0,cq-3)]||!peel[cr*W+Math.min(W-1,cq+3)]||!peel[Math.max(0,cr-3)*W+cq]||!peel[Math.min(H-1,cr+3)*W+cq])));
    const rx=5+h%4, ry=3+(h>>>4)%3; for(let r=cr-ry;r<=cr+ry;r++)for(let q=cq-rx;q<=cq+rx;q++) if(q>=0&&r>=0&&q<W&&r<H&&((q-cq)/rx)**2+((r-cr)/ry)**2<=1) peel[r*W+q]=0; }
  // 縁：外に面したドットは半分、その4割は欠かす
  const pk=new Uint8Array(peel);
  for(let r=0;r<H;r++)for(let q=0;q<W;q++){ const i=r*W+q; if(!pk[i]) continue;
    const e=!(q>0&&pk[i-1])||!(q<W-1&&pk[i+1])||!(r>0&&pk[i-W])||!(r<H-1&&pk[i+W]); if(e) peel[i]=hs(d.s,i)%5<2?0:2; }
  return d._pm=peel;
}
function drawBigSprite(d,t,sp){
  const x0=Math.round(d.x)-sp.ax, y0=Math.round(d.y)-sp.ay, W=sp.w, H=sp.h;
  // 水の印は描く前に控える（描いたドットは印が消えるので、後の行の「真下は水か」が狂う）
  const ext=40, n=(W)*(H+ext); if(!_bigW||_bigW.length<n) _bigW=new Uint8Array(n);
  for(let r=0;r<H+ext;r++) for(let q=0;q<W;q++){ const X=x0+q-DB0x, Y=y0+r-DB0y; _bigW[r*W+q]=(X>=0&&Y>=0&&X<bw&&Y<bh)?wmask[Y*bw+X]:0; }
  const Lc=[]; for(let cy=0;cy<=H;cy+=8) for(let cx=0;cx<=W;cx+=8) Lc.push(Math.max(.22,pxLight(x0+cx,y0+cy)));
  const cw=(W>>3)+1;
  /* 敷石は「地面に残った石の床」に見せる（ユーザー評価：上に置いた厚紙に見える）:
     立ち石より1段暗く、外の縁に輪郭を引かず半分だけ地面に溶かし、所々欠かす。縁に1〜2か所マス大の欠け。 */
  const pave=/^pave_/.test(d.name||''), pm=pave?paveMask(d,sp):null;
  const cap=sp.n?relightCap(sp,Math.round(d.x),Math.round(d.y)):6, shK=bakedShadowK(d.x,d.y);
  for(let r=0;r<H;r++){ const row=sp.rows[r], hr=sp.hts[r], Y=y0+r-DB0y; if(Y<0||Y>=bh) continue;
    for(let q=0;q<W;q++){ const ch=row[q]; if(ch==='.') continue; const X=x0+q-DB0x; if(X<0||X>=bw) continue;
      if(pave){ const m=pm[r*W+q]; if(!m) continue;
        const k=Y*bw+X, hp=parseInt(hr[q],36), wet=_bigW[(r+hp)*W+q]===1, L=Lc[(r>>3)*cw+(q>>3)], f=.5+.5*Math.min(1,L*1.4);
        const n=ch>='0'&&ch<='6'?ch.charCodeAt(0)-48:2, c=mixU(RP_DARK,RP_T[Math.max(1,Math.min(4,n-1))],f);
        buf[k]=mixU(buf[k],c,(m===2?.5:1)*(wet?.5:1)); if(!wet) wmask[k]=0; continue; }
      const k=Y*bw+X, hp=parseInt(hr[q],36), gr=r+hp, wet= gr<H+ext && _bigW[gr*W+q]===1;
      const L=Lc[(r>>3)*cw+(q>>3)], f=.5+.5*Math.min(1,L*1.4);
      if(ch==='s'){ if(shK>0) buf[k]=mixU(buf[k], wet?RP_WSH:RP_DARK, (wet?.5:.38)*shK); continue; }
      if(ch==='G'||ch==='H'||ch==='S'){ if(wet) continue; buf[k]=mixU(RP_DARK, ch==='S'?RP_T[3]:RP_GND[ch==='G'?0:1], f); wmask[k]=0; continue; }
      let c= sp.n ? relightPx(ch,sp.n[r][q],sp.k[r][q],x0+q,y0+r,hp,cap) : ch>='0'&&ch<='6' ? RP_T[ch.charCodeAt(0)-48] : RUIN_SPR_PAL[ch];
      c=mixU(RP_DARK,c,f);
      if(wet){ const sk=sp.sink||0;                                            // 水の中では sk ドットぶん沈んだ扱い
        if(hp<sk-2) continue;                                                   // 水面よりずっと下：見えない（水のまま）
        if(hp<sk){ buf[k]=mixU(buf[k],c,.32); continue; }                       // 水面のすぐ下：水に透ける（印は残す＝一緒に揺れる）
        if(hp<sk+1){ buf[k]=mixU(buf[k],c,.5); continue; }                      // 水面の行：半々
        if(hp<sk+3) c=mixU(mixU(RP_DARK,c,.8),RP_WET,.15);                      // 水際は濡れて暗い
      }
      buf[k]=c; wmask[k]=0; } }
}
/*RUIN_SPR_BEGIN*/const RUIN_SPR={"tall_a":{"w":8,"h":17,"rows":["..2330..",".215330.","21555330","15555330","15554310","15443210","14433230","14433210","14422110","14443110","14443110","14443110","14433100","14232100","0423210o",".133210.",".00000o."],"n":["..0000..",".100000.","91100038","me66bbgt","uzrjwoBt","uzrwwwBt","uzrEwowt","zzrwww6t","uzMEJwBt","uzrrwwBt","uzrEwoBt","uzrEwoBt","uzrwwwot","mzrwwwBt","zzrEwwBt",".zrEwwB.",".MrEwwO."],"k":["..6666..",".766665.","99766640","78876420","66654200","66542100","76542040","66543080","66310100","66653000","66542100","66542000","66542100","76543100","66542100",".654210.",".344200."]},"tall_b":{"w":8,"h":16,"rows":["...20...",".261330.","21555330","15555330","15555320","15443210","15432210","15432110","15433210","15433210","12432210","14432210","b4432100","0bbba10o",".bbba10.",".00000o."],"n":["...22...",".100000.","91000038","me6633gl","urrjjoot","uzrrwwBt","uzrEwwBt","uzrEwwBt","zzrwwwBt","mzrwwwBt","uwrEwoBt","u3uEwwBt","uzrwwwBt","uzrwwwBt",".zrwwoB.",".MEEwJO."],"k":["...65...",".766665.","98666650","89886530","67764300","66542100","66542100","66542100","66533100","66543100","61542100","66842100","65542100","66542100",".654310.",".344200."]},"broken_a":{"w":8,"h":16,"rows":["..20....","2310....","144330..","144330..","1543330.","15433330","15433330","15432110","14432110","14432210","14332110","14432200","bbbba100","0bbaa10o",".bbaa10.",".00000o."],"n":["..05....","0200....","113888..","m023d8..","uzr85d8.","uzrw8830","uzrwww08","zzrrwwBt","uzrEwwBt","uzrrwwBG","mzwEwJot","uzrrwoBt","uzrwwwBt","uzrEwoBt",".zrwwwB.",".MrEwJB."],"k":["..63....","6564....","887111..","776502..","6651113.","66543164","66532141","66542100","76542000","76542100","76442010","66553100","66642100","66542100",".654200.",".343200."]},"broken_b":{"w":8,"h":13,"rows":["....240.","...21330","...14330","..214310",".2143110",".1443110","21443110","15432210","b4432130","0bb3212o",".bbba10.",".b33a00.",".00000o."],"n":["....h40.","...94114","...h933y","..hh9oBy",".49hwoBy",".999woBy","99rwwoBy","uzrEwwBy","uzrEwojy","uzrwwo1y",".zrwwoB.",".zrwwBB.",".MEEwJB."],"k":["....886.","...98787","...89740","..899000",".7982000",".9993000","99542000","66542100","66542060","66543170",".654200.",".654200.",".243200."]},"water_a":{"w":7,"h":12,"rows":[".26330.","2165330","1655320","1543210","1543210","1443210","1333210","1444310","044321o",".13a10.",".1ba10.",".0000o."],"n":[".10000.","h91033l","umjjboy","uzrwwBy","uzrwwBt","uzrwwBt","hzrwwOl","uzjjoBy","uzrwwBt",".zrwwB.",".zrwwB.",".UEwJB."],"k":[".76665.","8977640","6776410","6653100","6653100","6653100","8443100","6776300","6653100",".65310.",".65310.",".13200."]},"water_b":{"w":6,"h":12,"rows":["..0...","260...","1330..","15330.","154330","154230","153210","153210","143210","0bba0o",".bba0.",".000o."],"n":["..0...","013...","4058..","zr888.","zrE8d0","zrrwol","zrEwot","urEwBt","zrrwot","zrrwot",".rEwo.",".MEJJ."],"k":["..3...","775...","7722..","65231.","654206","664200","654200","654200","654200","664200",".5420.",".3300."]},"water_c":{"w":7,"h":11,"rows":["....0..","...2130","..21330",".214320","2144210","1443210","1543210","1543210","0b3310o",".b3210.",".0000o."],"n":["....1..","...9001","..44113",".499oBt","994wwBt","444wwBt","uzrwwBt","uzrwwBt","uzrwwBt",".zrwwB.",".MEwwJ."],"k":["....7..","...9567","..88787",".899300","9993100","9883100","6653100","6653100","7653100",".65310.",".34200."]},"stub":{"w":8,"h":11,"rows":["..20....",".2130...","214330..","1444330.","15434330","15434330","15432110","14432110","0443221o",".133210.",".00000o."],"n":["..05....",".1053...","001800..","u108003.","uzr88058","uzrE008l","uzrwwwBG","mMrwwwOl","uzejjoBt",".zrwwwB.",".MEEwJO."],"k":["..63....",".7636...","558354..","6773444.","66534623","66545420","66542100","83542000","66765300",".654310.",".243200."]}};/*RUIN_SPR_END*/
const RUIN_SPR_PAL={o:RP_OL, a:RP_MOSS[0], b:RP_MOSS[1], c:RP_MOSS[2]};
const RP_GND=[C('#57523a'),C('#736a4d')];   // 部屋の足もとの苔の地面（苔より彩度を15%落とす：敷物に見えないように）
function ruinSprKey(d,inW){
  if(d.flat) return 'stub';
  const s=d.s;
  if(inW) return ['water_a','water_b','water_c'][s%3];
  return (d.broken!=null ? d.broken : s%3===0) ? ['broken_a','broken_b'][(s>>>4)%2] : ['tall_a','tall_b'][(s>>>4)%2];
}
function drawRuinSprite(d,t,L,inW,sp){
  const s=d.s, x=Math.round(d.x), y=Math.round(d.y), Wd=sp.w, Hs=sp.h, x0=x-(Wd>>1), top=y-Hs;
  const f=.5+.5*Math.min(1,L*1.4), lit=c=>mixU(RP_DARK,c,f);
  const idx=(px,py)=>{ px-=DB0x; py-=DB0y; return (px<0||py<0||px>=bw||py>=bh)?-1:py*bw+px; };
  const put=(px,py,c)=>{ const k=idx(px,py); if(k<0) return; buf[k]=lit(c); wmask[k]=0; };
  const mix=(px,py,c,a,keep)=>{ const k=idx(px,py); if(k<0) return; if(keep&&!wmask[k]) return; buf[k]=mixU(buf[k],c,a); };
  const col=ch=> ch>='0'&&ch<='6' ? RP_T[ch.charCodeAt(0)-48] : RUIN_SPR_PAL[ch];
  // 列ごとの根元（スプライトの一番下の不透明な行）
  const bot=[]; for(let q=0;q<Wd;q++){ let b=-1; for(let r=Hs-1;r>=0;r--) if(sp.rows[r][q]!=='.'){ b=r; break; } bot.push(b); }
  const cap=sp.n?relightCap(sp,x,y):6;
  const wetH=[]; { let w=2; for(let q=0;q<Wd;q++){ const hh=hs(s,q+333)%3; w=Math.max(1,Math.min(2,w+(hh===0?-1:hh===1?1:0))); wetH.push(w); } }
  // 影
  if(inW){ for(let yy=0;yy<3;yy++) for(let xx=0;xx<Wd+2;xx++){ const ex=(xx-(Wd+1)/2)/((Wd+2)/2), ey=(yy-1)/1.6; if(ex*ex+ey*ey>1) continue; mix(x0+1+xx,y+1+yy,RP_WSH,.6,true); } }
  else { const shK=sp.n?bakedShadowK(x,y):1; for(let yy=0;yy<2;yy++) for(let xx=0;xx<Wd+2;xx++){ if(xx===Wd+1&&yy===1) continue; mix(x0+2+xx,y+yy,RP_DARK,.4*Math.max(.35,shK)); } mix(x0-1,y-1,RP_DARK,.3); mix(x0-1,y-2,RP_DARK,.2); }
  // 水面の下：2行だけ細く溶ける
  if(inW) for(let yy=1;yy<=2;yy++){ const a=yy===1?.3:.15; for(let q=1;q<Wd-1;q++){ const k=idx(x0+q,y+yy); if(k<0||!wmask[k]) continue; const ch=sp.rows[Math.max(0,bot[q])][q]; if(ch==='.') continue; buf[k]=mixU(buf[k],lit(col(ch)),a); } }
  // 本体
  for(let r=0;r<Hs;r++){ const row=sp.rows[r], py=top+r;
    for(let q=0;q<Wd;q++){ const ch=row[q]; if(ch==='.') continue;
      let c= sp.n ? relightPx(ch,sp.n[r][q],sp.k[r][q],x0+q,py,Math.max(0,bot[q]-r),cap) : col(ch);
      if(inW && r>bot[q]-wetH[q]) c=mixU(mixU(RP_DARK,c,.8),RP_WET,.15);
      put(x0+q,py,c); } }
  if(!inW){
    for(let yy=0;yy<2;yy++) for(let xx=-3;xx<0;xx++){ const w=yy===0?2:3; if(xx<-w) continue; if(yy===0&&xx===-w) continue; put(x0+xx,y-2+yy,RP_MOSS[yy?0:1]); }
    if(s%2){ const px=x0+Wd+1, py=y+1; put(px,py,RP_T[3]); put(px+1,py,RP_T[3]); put(px,py+1,RP_T[1]); put(px+1,py+1,RP_T[1]); }
    return;
  }
  for(let q=0;q<Wd;q++){ if(bot[q]<0) continue; const k=idx(x0+q,y); if(k<0) continue; buf[k]=mixU(buf[k],lit(mixU(col(sp.rows[bot[q]][q]),RP_WET,.3)),.5); }
  if(((t*1.8+s%5)|0)%3){ mix(x0+1,y,RP_WHI,.12,false); mix(x0+2,y,RP_WHI,.12,false); }
  mix(x0-1,y-1,RP_DARK,.25,true); mix(x0-1,y,RP_DARK,.25,true);
  const per=3.4, u=((t+(s%97)/30)%per)/1.6;
  if(u<1){ const rx=Wd/2+1.5+u*7, ry=(1.8+u*4)*.55, a=.3*(1-u), cx=x0+(Wd-1)/2;
    for(let i2=0;i2<44;i2++){ const an=i2/44*6.2831853, px=Math.round(cx+Math.cos(an)*rx), py=Math.round(y+.5+Math.sin(an)*ry);
      if(py<=y+1 && px>=x0-1 && px<=x0+Wd) continue; mix(px,py,RP_WHI,a,true); } }
}
function drawRuinPost(d,t,L,inW){
  if(RUIN_USE_3D && RUIN_SPR && !d.proc && !CAVE.ruinProc){ const sp=RUIN_SPR[ruinSprKey(d,inW)]; if(sp) return drawRuinSprite(d,t,L,inW,sp); }
  const s=d.s, x=Math.round(d.x), y=Math.round(d.y);
  const Wd= d.W || (inW ? [5,6,7,6][s%4] : [8,8,7][s%3]), x0=x-(Wd>>1), cols=RP_COLS[Wd];
  const broken=d.broken!=null ? d.broken : s%3===0, H= d.H || (inW ? 10+(s>>>3)%5 : 14+(s>>>3)%5);
  const f=.5+.5*Math.min(1,L*1.4), lit=c=>mixU(RP_DARK,c,f);
  const idx=(px,py)=>{ px-=DB0x; py-=DB0y; return (px<0||py<0||px>=bw||py>=bh)?-1:py*bw+px; };
  const put=(px,py,c)=>{ const k=idx(px,py); if(k<0) return; buf[k]=lit(c); wmask[k]=0; };
  const mix=(px,py,c,a,keep)=>{ const k=idx(px,py); if(k<0) return; if(keep&&!wmask[k]) return; buf[k]=mixU(buf[k],c,a); };
  const T=i=>RP_T[i<0?0:i>6?6:i];
  const mid=(Wd-1)/2;
  // 根元の楕円：端の列は1行上、中央の2列は1行下
  const narrow=Wd<=6;
  const yb=q=> (q===0||(q===Wd-1&&!narrow)) ? y-1 : y;             // 端の輪郭の列だけ1行早く終わる（細い柱の右は真っ直ぐ水面まで）
  // 上端：折れていなければ3行の楕円（0行目は内側だけ、1行目は端を除く、2行目から全幅）
  const c0=Math.max(1,Math.round(Wd*.25));
  const hiR=s%2===0, notch=1+(s>>>5)%Math.max(1,Wd-2);
  const topY=q=>{
    if(broken&&d.flat){ const dq=hiR?(Wd-1-q):q, sl=dq<3?0:Math.round((dq-2)*(2+(s>>>16)%2)/Math.max(1,Wd-3)); return y-H+sl; }   // 高い側に3ドットの平らな頂、そこから2〜3ドット落ちる
    if(broken){ const fall=3+(s>>>16)%3, sl=Math.round((hiR?(Wd-1-q):q)*fall/(Wd-1)); return y-H+sl+((s>>>18)%2&&q===notch&&q>0&&q<Wd-1?1:0); }   // 片側が高く、反対へ3〜5ドット落ちる一つの折れ口
    if(narrow) return (q>=1&&q<=Wd-2) ? y-H : y-H+1;                // 細い柱は2行の楕円
    if(q>=c0 && q<=Wd-1-c0) return y-H; if(q>=1 && q<=Wd-2) return y-H+1; return y-H+2; };
  const band=(q,r,h)=>{ const jit=(hs(s,q+77)%3)-1, rr=r+jit; if(rr<h*.55) return 0; if(rr<h-3) return -1; return -2; };
  // 濡れた帯の高さ（列ごとに1〜3行、隣と±1）
  const wetH=[], wetMax=narrow?2:3, wetK=narrow?.8:.72; { let w=2; for(let q=0;q<Wd;q++){ const hh=hs(s,q+333)%3; w=Math.max(1,Math.min(wetMax,w+(hh===0?-1:hh===1?1:0))); wetH.push(w); } }
  // ---- 影 ----
  if(inW){
    for(let yy=0;yy<3;yy++) for(let xx=0;xx<Wd+2;xx++){ const ex=(xx-(Wd+1)/2)/((Wd+2)/2), ey=(yy-1)/1.6; if(ex*ex+ey*ey>1) continue; mix(x0+1+xx,y+1+yy,RP_WSH,.6,true); }
  } else {
    for(let yy=0;yy<2;yy++) for(let xx=0;xx<Wd+2;xx++){ if(xx===Wd+1&&yy===1) continue; mix(x0+2+xx,y+yy,RP_DARK,.4); }
    mix(x0-1,y-1,RP_DARK,.3); mix(x0-1,y-2,RP_DARK,.2);                                            // 左の接地の陰り
  }
  // ---- 水面の下：2行だけ細く溶ける（根元の楕円に沿う）----
  if(inW) for(let yy=1;yy<=2;yy++){ const a=yy===1?.3:.15; for(let q=1;q<Wd-1;q++){ const k=idx(x0+q,y+yy); if(k<0||!wmask[k]) continue; buf[k]=mixU(buf[k],lit(T(cols[q]-2)),a); } }
  // ---- 胴 ----
  const hiEnd=Math.round(H*.35);
  const pits=[[1+s%3, 4+(s>>>4)%Math.max(1,H-7)],[1+(s>>>2)%3, 4+(s>>>8)%Math.max(1,H-7)]].slice(0,1+(s>>>12)%2);
  const blot=Math.round(H*.45)+((s>>>14)%3)-1;
  for(let q=0;q<Wd;q++){ const ty=topY(q), yend=inW?yb(q):yb(q), h=yend-ty;
    for(let py=ty;py<yend;py++){ const r=py-(y-H); let i;
      const edgeL=q===0, edgeR=q===Wd-1;
      if(!broken && narrow && r===0){ i=(q===1||q===Wd-2)?3:4; }                                    // 細い柱：奥の縁
      else if(!broken && narrow && r===1){ i= edgeL?1 : edgeR?0 : q===1?6 : 5; }                   // 細い柱：上面（全幅）
      else if(!broken && !narrow && r===0){ i=(q===c0||q===Wd-1-c0)?3:4; }                        // 上面の奥の縁
      else if(!broken && !narrow && r===1){ i= q===1?3 : q===Wd-2?2 : q<=2+(Wd>6?1:0)?6 : q<Wd-3?5:4; }   // 上面
      else if(!broken && !narrow && r===2){ i= edgeL?1 : edgeR?0 : q<=Wd-4?5 : cols[q]; }        // 上面の手前（右2列は胴の色＝首輪に見せない）
      else if(broken && py===ty){ const hiQ= hiR? Wd-2 : 1; i= edgeL?1 : edgeR?0 : (Math.abs(q-hiQ)<=0||Math.abs(q-hiQ)===1&&q!==0&&q!==Wd-1&&(s%2))?6 : 3; }   // 折れ口：中間色に、高い側だけ照り2つ
      else {
        i=cols[q]+band(q,py-ty,h);
        if(q===1 && r>=4 && r<=hiEnd && (r%4)!==3) i=6;                                            // ハイライトは左から2列目だけ
        if(!edgeL&&!edgeR){ const hh=hs(s,q*977+(r>>1)*131); if(hh%100<22 && !(q===1&&i===6)) i+= (hh>>>8)%2?1:-1; }
        if(q>=1&&q<=3&&pits.some(p=>p[0]===q&&p[1]===r)) i-=1;                                     // 小さな窪み（2つまで、1段だけ暗く）
        if(q>=1&&q<=2&&r>=blot&&r<blot+3) i=Math.min(i,3);                                         // 擦れた斑（2×3）
        if(edgeL) i=Math.min(i,1); if(edgeR) i= py>=yend-2?-1:0;
      }
      let c=i<0?RP_OL:T(i);
      if(inW && py>=yend-wetH[q]) c=mixU(mixU(RP_DARK,c,wetK),RP_WET,.15);                        // 濡れた帯
      put(x0+q,py,c); }
  }
  if(!inW) for(let q=0;q<Wd;q++) put(x0+q,yb(q)-1,q===Wd-1?RP_OL:RP_T[0]);                         // 陸：根元の輪郭（楕円）
  // 割れ目と短い継ぎ目
  if(s%2){ const cq=1+(s>>>4)%Math.max(1,Wd-3), cy=y-H+5+(s>>>6)%Math.max(1,H-9), n=3+(s>>>9)%2;
    for(let k=0;k<n;k++) put(x0+cq+(k>>1),cy+k,RP_T[2]); put(x0+cq-1,cy-1,RP_T[6]); }
  if(s%3===1 && Wd>5){ const sy=y-Math.round(H*.45), n=2+(s>>>11)%2; for(let k=0;k<n;k++) put(x0+Wd-2-k,sy,RP_T[2]); }
  // 苔：左下を這い上がる縦の房（1〜2列×1〜4行、下ほど暗い）。上面は1ドットだけ
  { const n=inW?2:3; for(let i2=0;i2<n;i2++){ const hh=hs(s,i2+500), q=Math.min(Wd-3,(hh%3)+(i2>0?1:0)), len=1+(hh>>>4)%(inW?2:4), base=yb(q)-1-(inW?wetH[q]:0);
      for(let k=0;k<len;k++){ put(x0+q,base-k,RP_MOSS[k===0?0:1]); if((hh>>>8)%2&&k<len-1) put(x0+q+1,base-k,RP_MOSS[k===0?0:1]); } } }
  if(!broken && !narrow && s%2===0) put(x0+Wd-3,y-H+2,RP_MOSS[1]);
  if(!inW){
    // 地面の苔が左の根元に取り付く（2行のかたまり）、小石は影の側に1つ
    for(let yy=0;yy<2;yy++) for(let xx=-3;xx<0;xx++){ const w=yy===0?2:3; if(xx<-w) continue; if(yy===0&&xx===-w) continue; put(x0+xx,y-2+yy,RP_MOSS[yy?0:1]); }
    if(s%2){ const px=x0+Wd+1, py=y+1; put(px,py,RP_T[3]); put(px+1,py,RP_T[3]); put(px,py+1,RP_T[1]); put(px+1,py+1,RP_T[1]); }
    return;
  }
  // ---- 水面の行（根元の楕円に沿う）：石と水を半々 ----
  for(let q=0;q<Wd;q++){ const k=idx(x0+q,y); if(k<0) continue; buf[k]=mixU(buf[k],lit(mixU(q===Wd-1?RP_OL:T(cols[q]-1),RP_WET,.3)),.5); }
  // 照り（左の2列の水際）と、左の接地の縁（水×0.75）
  if(((t*1.8+s%5)|0)%3) { mix(x0+1,yb(1),RP_WHI,.12,false); mix(x0+2,yb(2),RP_WHI,.12,false); }
  mix(x0-1,y-1,RP_DARK,.25,true); mix(x0-1,y,RP_DARK,.25,true);
  // 根元から広がる輪（3.4秒に1回）
  const per=3.4, u=((t+(s%97)/30)%per)/1.6;
  if(u<1){ const rx=Wd/2+1.5+u*7, ry=(1.8+u*4)*.55, a=.3*(1-u), cx=x0+mid;
    for(let i2=0;i2<44;i2++){ const an=i2/44*6.2831853, px=Math.round(cx+Math.cos(an)*rx), py=Math.round(y+.5+Math.sin(an)*ry);
      if(py<=y+1 && px>=x0-1 && px<=x0+Wd) continue; mix(px,py,RP_WHI,a,true); } }
}
/* ---------- 倒れた石柱・部屋の残骸（水の層・第16〜20階層）----------
   見本（添付の水没した遺跡）の、横倒しの大きな円柱と、石の塊を積んだ部屋の跡。drawRuinPost と同じ色・同じ描き方の規則
   （左上から光、上の面が一番明るい、右と下にだけ濃い輪郭、2ドットの塊の肌理、オリーブの苔、水に浸かった所は濡れて沈む）。 */
function rpTools(L){
  const f=.5+.5*Math.min(1,L*1.4), lit=c=>mixU(RP_DARK,c,f);
  const idx=(px,py)=>{ px=Math.round(px)-DB0x; py=Math.round(py)-DB0y; return (px<0||py<0||px>=bw||py>=bh)?-1:py*bw+px; };
  const put=(px,py,c)=>{ const k=idx(px,py); if(k<0) return; buf[k]=lit(c); wmask[k]=0; };
  const mix=(px,py,c,a,keep)=>{ const k=idx(px,py); if(k<0) return; if(keep&&!wmask[k]) return; buf[k]=mixU(buf[k],c,a); };
  const wet=(px,py)=>{ const k=idx(px,py); return k>=0&&wmask[k]===1; };
  return {lit,idx,put,mix,wet};
}
/* ---- 倒れた石柱（第2版：講評を受けて）----
   太さ12（小さいものは10）。**太鼓（ドラム）を積み重ねた形**にして、太鼓1つ1つはほぼ水平、
   斜めの向きは継ぎ目ごとの段差（1〜2ドット）で出す——1本の滑らかな円柱を回すとギザギザの丸太に見えた。
   継ぎ目は全高の暗い隙間、次の太鼓の頭に明るい縁。片端は幅広の柱頭、もう片端は段々に欠けた折れ口と欠片。
   1か所だけ継ぎ目に立った小さな塊（形の単調さを崩す）。 */
function fallenGeo(d){
  if(d._fg) return d._fg;
  const s=d.s, D0=(s>>>10)%3===0?10:12, len=34+s%14, dir=((s%2)?1:-1), slope=dir*(.30+((s>>>4)%3)*.07);
  const capL=(s>>>6)%2===0, capW=13;
  const x0=Math.round(d.x-len/2), drums=[]; let x=x0+(capL?capW-3:0), y=Math.round(d.y)-D0-Math.round(slope*len/2), i=0;
  const xe=x0+len-(capL?0:capW-3);
  while(x<xe){ const w=Math.min(8+hs(s,i+20)%4, xe-x); const D=D0+((hs(s,i+90)%3)-1)*(i>0?1:0);
    drums.push({x,w,y,D,sl:slope*.7}); y=y+Math.round(w*slope*.7)+(i%2?Math.sign(slope):0); x+=w; i++; }
  const wide=new Set([1+(s>>>12)%Math.max(1,drums.length-1)]);
  return d._fg={D:D0,len,x0,drums,capL,capW,wide,slope,stub:(s>>>13)%Math.max(1,drums.length-1)+1};
}
function drawFallenColumn(d,t,L){
  const tl=rpTools(L), {put,mix,idx}=tl, g=fallenGeo(d), s=d.s, T=i=>RP_T[i<0?0:i>6?6:i];
  const rowTone=(r,x,D)=>{ const R=Math.round(r*12/D);
    if(R<=0) return 2; if(R<=5){ if(R<=2&&((x+R*3+s)%11)<2) return 6; if((R===2||R===4)&&((x+R*7+s)%11)<7) return 4; return 5; }   // 縦溝の筋（4〜8ドット）
    if(R===6) return 4; if(R<=8) return 3; if(R<=10) return 2; return 0; };
  const ytop=(dr,x)=>dr.y+Math.round((x-dr.x)*dr.sl);
  const wAt=(x,y)=>{ const k=idx(x,y); return k>=0&&wmask[k]===1; };
  const capDr=g.capL?g.drums[0]:g.drums[g.drums.length-1];
  // 1) 継ぎ目の脇に立つ短い柱（柱の奥＝上の地面に立つ。柱より先に描く）
  { const dr=g.drums[Math.min(g.stub,g.drums.length-1)], sx=dr.x+(g.slope>0?-2:2), sy=ytop(dr,dr.x)-1;
    drawRuinPost({x:sx,y:sy,s:(s*7)|1,W:8,H:9+(s>>>14)%3,broken:true,flat:true},t,L,wAt(sx,sy+1)); }
  // 2) 影・水際（地面：右へ2ずらして2〜3行／水：1〜2ドットの暗い接地帯）
  for(const dr of g.drums) for(let x=dr.x;x<dr.x+dr.w;x++){ const yb=ytop(dr,x)+dr.D;
    if(wAt(x,yb+1)){ mix(x,yb+1,RP_WSH,.55,true); mix(x,yb+2,RP_WSH,.3,true); }
    else for(let yy=0;yy<2;yy++) mix(x+2,yb+yy,RP_DARK,.4); }
  // 3) 太鼓
  const brkJag=r=>[0,0,2,2,4,4,3,3,1,1,2,2,1][r%13];
  for(let di=0;di<g.drums.length;di++){ const dr=g.drums[di], D=dr.D, first=di===0, last=di===g.drums.length-1;
    const brkSide = g.capL ? last : first;
    const notch = di>0 && di%3===1 && hs(s,di+150)%2===0;
    for(let x=dr.x;x<dr.x+dr.w;x++){ const yt=ytop(dr,x), seamX=x===dr.x&&!first, wide2=g.wide.has(di)&&x===dr.x+1;
      const edgeX = g.capL ? dr.x+dr.w-1-x : x-dr.x;
      const wetHere=wAt(x,yt+D+1);
      for(let r=0;r<D;r++){ const py=yt+r;
        if(brkSide && edgeX<brkJag(r+s)) continue;
        if(notch && r===0 && x<=dr.x+1) continue;                                    // 上の輪郭の欠け
        const R12=Math.round(r*12/D);
        let i=rowTone(r,x,D);
        if(seamX||wide2){ i= R12<=5 ? (hs(s,x+r*3)%3?3:4) : R12<=10 ? 2 : 0; if(wide2&&R12>5) i=Math.max(0,i-1); }
        else if(g.wide.has(di)&&x===dr.x+2&&r>=1&&r<=4) i=6;                          // 2ドットの隙間の向こうだけ明るい縁
        else if(brkSide && edgeX<brkJag(r+s)+2){ i= (r<5&&edgeX===brkJag(r+s))?6 : 3; if(hs(s,x*7+r)%9===0) i=2; }
        else { const hh=hs(s,((x-dr.x)/3|0)*131+r*17+di*7); if(hh%100<(R12<=5?8:16)) i+=(hh>>>8)%2?1:-1; }
        let c=i<0?RP_OL:T(i);
        if(wetHere && r>=D-2) c=mixU(mixU(RP_DARK,c,.8),RP_WET,.15);                  // 水に触れる下の2行だけ濡れる
        put(x,py,c); }
      if(wetHere){ const k=idx(x,yt+D); if(k>=0) buf[k]=mixU(buf[k],T(2),.5); }
    }
    // 段差：高い側の太鼓の端面を2ドット見せる（中間色、最下は暗）
    if(di>0){ const pv=g.drums[di-1], step=ytop(dr,dr.x)-ytop(pv,pv.x+pv.w-1);
      if(step>0){ for(let q=1;q<=1;q++){ const x=pv.x+pv.w-q, yt=ytop(pv,x); for(let r=Math.max(1,(pv.D>>1));r<pv.D;r++) put(x,yt+r,r===pv.D-1?T(1):T(3)); } }
      else if(step<0){ for(let q=0;q<1;q++){ const x=dr.x+q, yt=ytop(dr,x); for(let r=Math.max(1,(D>>1));r<D;r++) put(x,yt+r,r===D-1?T(1):T(3)); } } }
  }
  // 4) 柱頭：軸より左右1〜2広い四角い塊（上の面5行・手前9行）。地面に据わるので根元は胴より下
  { const dr=capDr, cw=12, x= g.capL ? dr.x-cw+3 : dr.x+dr.w-3, axis=ytop(dr,g.capL?dr.x:dr.x+dr.w-1)+dr.D/2, yb=Math.round(axis+5.5);
    rpBlock2(tl,x,yb,cw,7,4,s+91,{pits:4,chipSize:2,shadowRows:3});
    for(let q=0;q<3;q++) for(let r=0;r<2;r++) put(x+3+q+(s%3),yb-7-3+r,RP_MOSS[r?0:1]);              // 上の面の苔
    for(let q=0;q<2+(s>>>3)%2;q++) put(x+1+q,yb,RP_MOSS[0]);
    if(!wAt(x+cw,yb+1)) for(let q=0;q<4;q++) for(let r=0;r<2;r++) put(x+(g.capL?cw:-4)+q,yb-r,RP_MOSS[r]); }   // 胴が地面に触れる所の苔
  // 5) 苔：継ぎ目をまたぐ縦のかたまり（横の面）、下の縁の不揃いな帯
  for(let di=1;di<g.drums.length;di++){ if(hs(s,di+300)%2) continue; const dr=g.drums[di], yt=ytop(dr,dr.x), D=dr.D;
    const w=2+hs(s,di+310)%2, h=3+hs(s,di+320)%3, top=yt+Math.round(D*.45);
    for(let q=0;q<w;q++) for(let r=0;r<h;r++){ if((q===0||q===w-1)&&(r===0||r===h-1)&&hs(s,q+r*5+di)%2) continue; put(dr.x-1+q,top+r,RP_MOSS[r<h/2?1:0]); } }
  { const dr=g.drums[(s>>>3)%g.drums.length]; const n=Math.max(3,Math.round(dr.w*.8));
    for(let k=0;k<n;k++){ const x=dr.x+k, yb=ytop(dr,x)+dr.D; put(x,yb-1,RP_MOSS[0]); if(hs(s,x)%3===0) put(x,yb-2,RP_MOSS[1]); } }
  // 6) 折れ口の脇の欠片
  { const dr=g.capL?g.drums[g.drums.length-1]:g.drums[0], ex=g.capL?dr.x+dr.w+2:dr.x-6, ey=ytop(dr,g.capL?dr.x+dr.w-1:dr.x)+dr.D;
    rpChip(tl,ex,ey,3,2); rpChip(tl,ex+(g.capL?4:-3),ey-3,2,2); if(s%2) rpChip(tl,ex+(g.capL?1:-1),ey+3,2,2); }
  // 7) 水：左上の照り
  { const dr=g.drums[0], x=dr.x, yb=ytop(dr,x)+dr.D; if(wAt(x-2,yb)&&((t*1.8+s%5)|0)%3) for(let q=2;q<6;q++) mix(x-q,yb-1,RP_WHI,.14,true); }
}
function rpChip(tl,x,y,w,h){ for(let q=0;q<w;q++){ for(let r=0;r<h;r++) tl.put(x+q,y-h+1+r, r===0?RP_T[4]:r===h-1?RP_T[1]:RP_T[3]); } tl.put(x+w,y,RP_T[0]); }
/* 石の塊（第2版）：四角く、角に1〜2ドットの欠け。上の面 dd 行（左2列の上2行だけ最も明るく）、手前の面 h 行（左→右に明→中→中暗、最下行は中暗）。
   輪郭は左が暗、右と下が最暗、上の縁は中間色。o.noTop で上の面を描かない（下の段）、o.noShadow で影を落とさない。 */
function rpBlock2(tl,x,y,w,h,dd,s,o){
  o=o||{}; const {put,mix,idx}=tl, T=i=>RP_T[i<0?0:i>6?6:i];
  const k0=idx(x+1,y+1), inW=k0>=0&&wmask[k0]===1;
  if(!o.noShadow){ if(inW){ for(let q=0;q<w;q++) mix(x+q+1,y+1,RP_WSH,.5,true); mix(x+w,y,RP_WSH,.5,true); }
    else { for(let yy=0;yy<(o.shadowRows||2);yy++) for(let q=0;q<w+1;q++) mix(x+q+2,y+1+yy,RP_DARK,.4); mix(x+w,y,RP_DARK,.4); } }
  const chip1=o.noChip?9:hs(s,1)%4, chip2=o.noChip?9:hs(s,2)%4, cs=o.chipSize||1;
  const pits=[]; for(let i=0;i<(o.pits||1);i++) pits.push([1+hs(s,3+i*2)%Math.max(1,w-3), 1+hs(s,4+i*2)%Math.max(1,h-1)]);
  if(!o.noTop) for(let r=0;r<dd;r++){ const py=y-h-dd+1+r;
    for(let q=0;q<w;q++){ if(r<cs&&((q<cs&&chip1===0)||(q>=w-cs&&chip1===1))) continue;
      let i= r===0?3 : q===w-1?2 : (q<=1&&r<=2)?6 : 5; if(q===0&&r>0) i=Math.min(i,4);
      put(x+q,py,T(i)); } }
  for(let r=0;r<h;r++){ const py=y-h+1+r;
    for(let q=0;q<w;q++){ if(r>=h-cs&&((q<cs&&chip2===0)||(q>=w-cs&&chip2===1))) continue;
      let i= q===0?1 : q===w-1?0 : q<=Math.max(1,w*.35)?4 : q<=w*.7?3 : 2;
      if(r===h-1&&q>0&&q<w-1) i=Math.min(i,2);
      if(q>0&&q<w-1){ const hh=hs(s,q*977+(r>>1)*131); if(hh%100<16) i+=(hh>>>8)%2?1:-1; if(pits.some(p=>p[0]===q&&p[1]===r)) i-=1; }
      if(o.seamTop&&r===0&&q>0&&q<w-1) i=2;
      let c=T(i); if(inW&&r>=h-2) c=mixU(mixU(RP_DARK,c,.8),RP_WET,.15);
      put(x+q,py,c); } }
  if(inW){ for(let q=0;q<w;q++){ const k=idx(x+q,y+1); if(k>=0&&wmask[k]) buf[k]=mixU(buf[k],T(2),.45); } }
  else if(!o.noBase){ for(let q=0;q<w;q++) put(x+q,y+1,RP_T[0]); }
}
/* ---- 部屋の残骸（第2版）----
   壁は大きさの違う塊（幅 5/7/9/12）を1〜3段に積む。下の段は手前の面だけ、上の段だけ上の面。段の境は1ドットの継ぎ目、段ごとに横に±1〜2ずれる。
   角と入口の両脇は高い柱（3段）。2〜3割の塊を抜き、抜けた所へ向かって段が下がる。壁の外と内に転げた塊と欠片。
   左右の壁は塊の長さがまちまちで、2〜3個ごとに±1〜2ドット揺れる。一番手前の塊は1段高く、手前の面を見せる。
   床は不透明の敷石（6〜10ドット）、継ぎ目、欠け、ひび。2割ほど抜けて地面と苔が出る。水の上では敷石が抜けて水が覗く。
   壁は床へ短い影を落とす。外の根元と内側の角に苔。 */
function ruinRoomLayout(d){
  if(d._lay) return d._lay;
  const s=d.s, W=52+(s%3)*6, Dp=36+((s>>>3)%3)*4, x0=Math.round(d.x)-(W>>1), y0=Math.round(d.y)-(Dp>>1)-4;
  const R=i=>hs(s,i), els=[], slabs=[], chips=[];
  const yb=y0+9, yf=y0+Dp, sideW=7;
  const noCorner=(s>>>8)%2===0, cornerR=(s>>>9)%2===0;         // 奥の角の柱は1本だけ（もう片方の角は崩れている）
  // 壁の並びを作る：塊の幅 6〜12 が隙間なく続き、隙間は1〜2か所（幅4〜10）
  /* 壁の並び：塊は1ドット重ねて置く（間は1ドットの継ぎ目だけ）。隙間は0か、4ドット以上の抜けを ng か所 */
  const run=(a,b,salt,ng)=>{ const out=[]; let x=a, i=0, gapsLeft=ng, gaps=[], cnt=0;
    while(x<b-3){ let w=Math.min(6+R(salt+i*3+5)%7, b-x); if(b-x-w>0&&b-x-w<6) w=b-x;
      if(gapsLeft>0 && cnt>=2 && b-x>14 && R(salt+i*3+6)%3===0){ const gw=Math.min(4+R(salt+i*3+7)%7, b-x-6); gaps.push([x,x+gw]); x+=gw; gapsLeft--; cnt=0; i++; continue; }
      out.push({x,w,first:cnt===0}); x+=w-1; cnt++; i++; }
    if(out.length) out[out.length-1].last=true; for(let k=0;k<out.length-1;k++) if(out[k+1].first) out[k].last=true;
    return {blocks:out,gaps}; };
  // 奥の壁（1〜2段、隙間の隣は1段）
  { const a=x0+sideW+(noCorner&&!cornerR?4:0), b=x0+W-sideW-(noCorner&&cornerR?4:0), r=run(a,b,10,1+R(9)%2);
    r.blocks.forEach((bk,k)=>{ const nextToPost= cornerR ? bk.x+bk.w>=b-1 : bk.x<=a;
      els.push({t:'stack',x:bk.x,y:yb,w:bk.w,c:nextToPost?2:1,s:R(k+70),wall:'back',edge:bk.first||bk.last}); }); }
  // 角の柱（1本）
  els.push({t:'stack',x:cornerR?x0+W-sideW-1:x0,y:yb,w:8,c:3,s:R(200),post:true,wall:'back'});
  if(!noCorner) els.push({t:'stack',x:cornerR?x0:x0+W-sideW,y:yb,w:sideW,c:1,s:R(201),wall:'back'});
  // 左右の壁：上の面が見える塊が隙間なく続き、隙間は1か所。一番手前は1段高い
  for(const side of [0,1]){ const xs= side? x0+W-sideW : x0, ys=yb+2, ye=yf-3; let y=ys, i=0, drift=0;
    const gy=ys+6+R(side*31+300)%Math.max(1,ye-ys-16), gh=4+R(side*31+301)%5;
    while(y<ye){ const len=Math.min(5+R(i*3+side*97+310)%5, ye-y); if(len<3) break; if(i%3===2) drift=(R(i+side*50+330)%3)-1;
      const front=y+len>=ye-1, inGap=y<gy+gh&&y+len>gy; if(i%3===2&&!inGap) drift=0;
      if(!inGap) els.push({t:'side',x:xs+drift,y:y+len,w:sideW,len,h:front?5:3,s:R(i+side*13+390)});
      y+=len; i++; } }
  // 手前：入口の両脇に柱、外側は低い壁の並び（1段）
  const dl=x0+Math.round(W*.38), dr=x0+Math.round(W*.62);
  els.push({t:'stack',x:dl-7,y:yf,w:7,c:2,s:R(400),post:true});
  els.push({t:'stack',x:dr,y:yf,w:7,c:2,s:R(401),post:true});
  for(const [a,b,o] of [[x0+sideW,dl-7,0],[dr+7,x0+W-sideW,40]]){ if(b-a<6) continue; const r=run(a,b+1,420+o,0); r.blocks.forEach((bk,k)=>els.push({t:'stack',x:bk.x,y:yf,w:bk.w,c:1,s:R(k+430+o),edge:bk.first||bk.last})); }
  // 仕切りの名残（壁から内へ1つ）
  { const left=(s>>>11)%2===0, py=yb+Math.round((yf-yb)*.55); els.push({t:'stack',x:left?x0+sideW:x0+W-sideW-8,y:py,w:8,c:1,s:R(470)}); }
  // 転げた塊は壁の線の外へ（2〜6ドット離す）
  for(let i=0;i<2+R(480)%2;i++){ const k=R(i+505)%3;
    const px= k===0? x0-5-R(i+500)%4 : k===1? x0+W+2+R(i+500)%4 : x0+8+R(i+500)%(W-16);
    const py= k===2? yf+4+R(i+510)%3 : yb+4+R(i+510)%Math.max(1,yf-yb-8);
    els.push({t:'stack',x:px,y:py,w:4+R(i+530)%3,c:1,s:R(i+540),tilt:true}); }
  // 敷石：縁から欠ける（内側の穴は水の上だけ）
  { let y=yb+1, row=0; const nRow=Math.ceil((yf-yb)/7);
    while(y<yf-1){ const h=Math.min(6+R(row+600)%3, yf-1-y); let x=x0+sideW+(row%2?2:0), i=0;
      while(x<x0+W-sideW){ const w=Math.min(6+R(row*31+i+620)%5, x0+W-sideW-x);
        const edgeDist=Math.min(x-(x0+sideW), x0+W-sideW-(x+w), yf-1-(y+h));
        const miss= edgeDist<6 && R(row*31+i+640)%100<40;
        slabs.push({x,y,w,h,shift:R(row*31+i+660)%100<20?((R(row*31+i+661)%2)?1:-1):0,blot:(row+i)%3===0,s:R(row*31+i+680),miss});
        x+=w; i++; } y+=h; row++; } }
  // 欠片（壁の外の根元に3〜5）
  for(let i=0;i<3+R(700)%3;i++){ const e=els.filter(e=>!e.tilt)[R(i+710)%els.length%Math.max(1,els.filter(e=>!e.tilt).length)];
    const outL=e.x<=x0+1, outR=e.x>=x0+W-sideW-1;
    chips.push({x: outL? e.x-3-R(i+720)%3 : outR? e.x+e.w+1+R(i+720)%3 : e.x+R(i+720)%Math.max(1,e.w), y: (outL||outR)? e.y-R(i+740)%6 : e.y+3+R(i+740)%2, w:2+R(i+750)%2, h:2}); }
  els.sort((a,b)=>a.y-b.y);
  return d._lay={x0,y0,W,D:Dp,yb,yf,els,slabs,chips,sideW};
}
function drawRuinRoom(d,t,L){
  const tl=rpTools(L), {put,mix,idx}=tl, lay=ruinRoomLayout(d), s=d.s, T=i=>RP_T[i<0?0:i>6?6:i];
  const {x0,W,yb,yf,sideW}=lay;
  // 0) 足もとのオリーブの土台＋1) 床の敷石。どちらも形は変わらないので、色の並びは初回に作って覚えておく
  //    （毎フレーム数千ドットぶん hs() を回していた。描くたびに要るのは灯りと水の判定だけ）
  if(!lay.px){ const out=[];
    const ext=(k)=>2+(hs(s,k)%3); const top=yb-4, bot=yf+2;
    for(let yy=top-4;yy<=bot+4;yy++){ const eL=ext(((yy>>1)*7)+11), eR=ext(((yy>>1)*7)+13);
      for(let xx=x0-eL;xx<=x0+W-1+eR;xx++){ const eT=ext(((xx>>1)*5)+17), eB=ext(((xx>>1)*5)+19);
        if(yy<top-eT||yy>bot+eB) continue;
        const outer= xx===x0-eL||xx===x0+W-1+eR||yy===top-eT||yy===bot+eB;
        out.push(xx,yy,RP_MOSS[outer?0:(hs(s,xx*3+yy*7)%10===0?0:1)],0); } }
    for(const sl of lay.slabs){ if(sl.miss) continue;
      for(let yy=sl.y;yy<sl.y+sl.h;yy++) for(let xx=sl.x;xx<sl.x+sl.w;xx++){
        const onL=xx===sl.x, onT=yy===sl.y, drawL=hs(sl.s,1)%3!==0, drawT=hs(sl.s,2)%3!==0;
        const seam=(onL&&drawL&&((yy+sl.s)%8)<5)||(onT&&drawT&&((xx+(sl.s>>>3))%8)<6);
        let i2= seam?3 : 4+sl.shift;
        if(!seam&&sl.blot&&(xx-sl.x)>=2&&(xx-sl.x)<=3&&(yy-sl.y)>=2&&(yy-sl.y)<=3) i2=5;
        out.push(xx,yy,T(i2),1); }
      if(sl.s%5===0&&sl.w>6){ const cx=sl.x+2+sl.s%Math.max(1,sl.w-4), cy=sl.y+1; for(let r=0;r<3;r++) out.push(cx+(r>>1),cy+r,T(2),2); } }
    lay.px=out; }
  { const P_=lay.px, f=.5+.5*Math.min(1,L*1.4);
    for(let n=0;n<P_.length;n+=4){ const k=idx(P_[n],P_[n+1]); if(k<0) continue; const m=P_[n+3], c=mixU(RP_DARK,P_[n+2],f);
      if(wmask[k]){ if(m===1) buf[k]=mixU(buf[k],c,.4); continue; }   // 水の上：土台とひびは敷かず、敷石は水に透ける
      buf[k]=c; } }
  // 苔：壁際の床の継ぎ目と内側の角に2〜4ドットのかたまり
  for(const [cx,cy] of [[x0+sideW,yb+1],[x0+W-sideW-3,yb+1],[x0+sideW,yf-4],[x0+W-sideW-3,yf-4]]) for(let q=0;q<3;q++) for(let r=0;r<3;r++){ if(q+r>3||hs(s,cx+q*3+r)%5===0) continue; const k=idx(cx+q,cy+r); if(k>=0&&!wmask[k]) put(cx+q,cy+r,RP_MOSS[(q+r)%2]); }
  // 2) 壁の影（床へ2行）
  for(const e of lay.els){
    if(e.t==='stack'&&!e.tilt) for(let yy=2;yy<=3;yy++) for(let q=0;q<e.w;q++) mix(e.x+q+1,e.y+yy-1,RP_DARK,yy===2?.4:.28);
    if(e.t==='side'){ const right=e.x<x0+W/2; for(let yy=-e.len;yy<=0;yy++){ mix(right?e.x+e.w:e.x-1,e.y+yy,RP_DARK,.35); mix(right?e.x+e.w+1:e.x-2,e.y+yy,RP_DARK,.2); } } }
  // 3) 壁・柱・塊を奥から手前へ
  for(const e of lay.els){
    if(e.t==='side'){ rpBlock2(tl,e.x,e.y,e.w,e.h,e.len,e.s,{noShadow:true}); continue; }
    const ch=e.post?6:5; let ox=0;
    for(let k=0;k<e.c;k++){ const top=k===e.c-1; if(k>0) ox=((hs(e.s,k)%3)-1);
      const bx=e.x+(e.tilt&&top?1:0)+ox, by=e.y-k*ch;
      rpBlock2(tl,bx,by,e.w,ch,top?3:0,e.s+k*7,{noTop:!top,noShadow:k>0||!e.tilt&&!e.post,noBase:k>0,seamTop:!top,noChip:!e.post&&!e.tilt&&!e.edge}); }
    if(e.s%10<3&&!e.tilt){ const q=e.s%Math.max(1,e.w-2), n=2+(e.s>>>4)%3; for(let r=0;r<n;r++){ put(e.x+q,e.y-r,RP_MOSS[r?1:0]); if(r<2) put(e.x+q+1,e.y-r,RP_MOSS[0]); } }
  }
  // 4) 欠片
  for(const c of lay.chips) rpChip(tl,c.x,c.y,c.w,c.h);
}
function drawDeco(bx0,by0,t,blindR){
  DB0x=bx0; DB0y=by0; const P_=G.Z.id==='sump'?DECO_PAL_WET:DECO_PAL, code=G.code, PW=G.PW;
  drawPools(bx0,by0,t,blindR);
  drawDrips(bx0,by0,t,blindR);
  for(const d of G.deco){
    const mg=d.ext||0;                                  // 大きな水溜りは端で切らない
    if(d.x<bx0-24-mg||d.y<by0-8-mg||d.x>bx0+bw+24+mg||d.y>by0+bh+30+mg) continue;
    if(d.ok===0){ // 岩に埋まっていたら床の側へずらす。ずらしきれなければ出さない
      let x=d.x,y=d.y,okk=-1; for(let i=0;i<10;i++){ const c=code[(y|0)*PW+(x|0)]; if(!c){okk=1;break;} x-=d.wdx||0; y-=d.wdy||0; if(!d.wdx&&!d.wdy) break; }
      d.ok=okk; d.x=x; d.y=y; }
    if(d.ok<0) continue;
    if(!seenAt(G.f,G.L,d.x|0,d.y|0) && !(mg && [[-mg,0],[mg,0],[0,-mg],[0,mg]].some(([ox,oy])=>seenAt(G.f,G.L,(d.x+ox)|0,(d.y+oy)|0)))) continue;
    if(Math.hypot(d.x-lampX,d.y-lampY)>blindR+mg) continue;
    const L=Math.max(.22,pxLight(d.x,d.y)), s=d.s, x=d.x, y=d.y;
    if(mg && ruinBigFor(d)){ drawBigSprite(d,t,ruinBigFor(d)); continue; }   // 3Dから作った大きな遺跡
    { const cs=(d.k==='rock'||d.k==='stalagC')&&caveSprFor(d); if(cs){ drawCaveSprite(d,cs,P_); continue; } }   // 3Dから作った石の層の岩・石筍
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
    case 'pool': break;                                        // drawPools がまとめて描く
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
    case 'pillar': if(G.Z.id==='sump'){ drawRuinPost(d,t,L,false); break; } { const H=18+s%12, bx=x-4;
      drect(bx-2,y-2,bx+9,y+1,P_.stone,L*.9,true); drect(bx-1,y-4,bx+8,y-3,P_.stone,L,true);
      for(let j=5;j<H;j++){ const top=j>H-4; for(let q=0;q<8;q++){ if(top&&hs(s,q+j*7)%3===0) continue; const px=bx+q, py=y-j; dp(px,py,(q===2||q===5)?P_.stone[0]:sh3(P_.stone,L*(q<2?1.25:q>6?.6:1),px,py)); } }
      if(s%2){ const fx=x+(s%3?10:-15), fy=y+3; drect(fx,fy-4,fx+7,fy,P_.stone,L,true); dp(fx+2,fy-2,P_.stoneDk); dp(fx+5,fy-2,P_.stoneDk); }
      if(P_.algae) for(let i=0;i<14;i++){ const h=hs(s,i+200), px=bx-2+(h%12), py=y+1-((h>>>5)%(3+(h>>>9)%6)); dp(px,py,sh3(P_.algae,L*1.1,px,py)); }   // 根元の藻
      break; }
    /* ---- 水の中の遺跡（水の層・第16〜20階層）----
       立っている物は wmask を消して描く（dpw の 0）——水面の揺らぎ（屈折）と波の線が乗らない。
       沈んだ跡だけは水の色に混ぜて、印を残す＝水と一緒に揺れて「水の下にある」に見える。 */
    case 'wpost': drawRuinPost(d,t,L,true); break;
    case 'wwall': { const w=wwallW(d), H=7+s%5, x0=x-(w>>1), sb=P_.stone;
      for(let xx=0;xx<w;xx++){ const eH=H-((hs(s,xx)%3)*(xx>w*.55?1:0))-(xx<2||xx>w-3?1:0);
        for(let yy=0;yy<eH;yy++){ const px=x0+xx, py=y-yy, mortar=(yy%3===2)||(((xx+((yy/3|0)%2)*3)%6)===0);
          dpw(px,py, yy===eH-1?P_.stoneHi:mortar?P_.stoneDk:sh3(sb,L*(xx<w/3?1.15:.85),px,py), 0); }
        if(((xx+((t*4)|0))%5)!==0) dpw(x0+xx,y+1,P_.foam,0); }
      if(P_.algae) for(let i=0;i<8;i++){ const h=hs(s,i+60); dpw(x0+(h%w), y-((h>>>5)%2), sh3(P_.algae,L,x0,y),0); }
      break; }
    case 'wsteps': for(let i=0;i<3;i++){ const h=hs(s,i), px=x-9+i*8+(h%3)-1, py=y+((h>>>3)%5)-2;
        for(let yy=-2;yy<=1;yy++)for(let xx=-3;xx<=3;xx++){ if(xx*xx/10+yy*yy/2.6>1) continue; dpw(px+xx,py+yy, yy<0?P_.stoneHi:sh3(P_.stone,L*.9,px+xx,py+yy),0); }
        if(Math.sin(t*2+i+s)>.3) dpw(px+4,py+1,P_.foam,0); }
      break;
    case 'sunken': { const w=26+s%20, h=16+(s>>>5)%14, x0=x-(w>>1), y0=y-(h>>1), stc=P_.stone[2], dk=P_.stoneDk;
      const mixAt=(px,py,c,a)=>{ px=Math.round(px)-DB0x; py=Math.round(py)-DB0y; if(px<0||py<0||px>=bw||py>=bh) return; const k=py*bw+px; if(!wmask[k]) return; buf[k]=mixU(buf[k],c,a); };
      const A=.24+.18*Math.min(1,L*1.4);
      const seg=(ax,ay,bx2,by2)=>{ const n=Math.max(Math.abs(bx2-ax),Math.abs(by2-ay)); for(let i=0;i<=n;i++){ if(hs(s,(ax*3+ay)*7+i>>2)%9<2) continue;
          const px=ax+(bx2-ax)*i/n, py=ay+(by2-ay)*i/n; mixAt(px,py,stc,A); mixAt(px,py+1,stc,A*.8); mixAt(px,py+2,dk,A*.9); } };
      seg(x0,y0,x0+w,y0); seg(x0,y0+h,x0+w,y0+h); seg(x0,y0,x0,y0+h); seg(x0+w,y0,x0+w,y0+h);
      if(s%2) seg(x0+(w>>1),y0,x0+(w>>1),y0+h);
      for(let yy=y0+4;yy<y0+h-2;yy+=5)for(let xx=x0+4;xx<x0+w-2;xx+=6) if(hs(s,xx*13+yy)%3) mixAt(xx,yy,stc,A*.55);   // 床の敷石
      break; }
    /* 倒れた柱：横倒しの円柱。太鼓（継ぎ目）ごとに少しずれて、片端は折れて欠けている。跨げる高さなので当たり判定は持たない。 */
    case 'wfallen': drawFallenColumn(d,t,L); break;
    case 'ruinroom': drawRuinRoom(d,t,L); break;
    case 'fallen': if(G.Z.id==='sump'){ drawFallenColumn(d,t,L); break; } { const len=26+s%10, R=3, x0=x-(len>>1), dir=s%2?1:-1;
      for(let xx=0;xx<len;xx++){ const drum=(xx/8|0), off=(hs(s,drum)%3)-1, seam=xx%8===0;
        const brk=(dir>0?len-1-xx:xx); const top=brk<3?(hs(s,xx+40)%3):0;
        for(let yy=-R+top;yy<=R;yy++){ const px=x0+xx, py=y-R-1+yy+off*(yy<0?0:0);
          const sh=yy<-1?1.35:yy<1?1:.6; dp(px,py,seam?P_.stoneDk:sh3(P_.stone,L*sh,px,py)); }
        dp(x0+xx,y+1,P_.stoneDk); }
      if(P_.algae) for(let i=0;i<10;i++){ const h=hs(s,i+300), px=x0+(h%len), py=y-((h>>>6)%3); dp(px,py,sh3(P_.algae,L,px,py)); }
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
/* ---------- シャボン玉（水の層）----------
   空中に少しだけ浮かぶ、虹色の縁の泡（ユーザー要望「新しい層に到着した感じを出したい」）。
   床のおよそ70マスに1つ。生まれた所からゆっくり昇りながら左右に揺れ、8〜14秒で弾けて、また同じあたりに生まれる。
   主人公が触れても弾ける。地形のバッファではなく、粒と同じく**キャラの上**に描く（宙に浮いて見えるように）。 */
const SOAP_IRI=['#a8e4ff','#e8b8ff','#fff0a8','#b8ffd8'], SOAP_RIM={};
function soapRim(r){ if(SOAP_RIM[r]) return SOAP_RIM[r]; const pts=[], seen=new Set();
  for(let i=0;i<64;i++){ const a=i/64*6.2831853, x=Math.round(Math.cos(a)*r), y=Math.round(Math.sin(a)*r), k=x+','+y; if(seen.has(k)) continue; seen.add(k); pts.push([x,y,a]); }
  return SOAP_RIM[r]=pts; }
function genSoap(f){
  const out=[], depth=(S.run&&S.run.depth)||1;
  for(let ty=1;ty<f.H-1;ty++)for(let tx=1;tx<f.W-1;tx++){
    if(f.g[ty][tx]!==T.FLOOR) continue; const h=hs(tx*92821+ty*68917+depth*7,911);
    if(h%1000>=14) continue;
    out.push({hx:tx*Q+8, hy:ty*Q+8, s:h, r:[2,3,3,4][(h>>>4)&3], life:8+((h>>>8)%600)/100, age:((h>>>12)%1000)/1000*8, ox:0, oy:0});
    if(out.length>=60) break; }
  return out;
}
function soapStep(dt){
  if(!G.soap) G.soap=genSoap(G.f);
  const ps=TS/Q, t=(performance.now()-T0)/1000, camX=P.x*TS-innerWidth/2, camY=P.y*TS-innerHeight/2;
  const px=P.x*Q, py=P.y*Q-8, hw=innerWidth/ps/2+16, hh=innerHeight/ps/2+16, q=Math.ceil(ps);
  ctx.save();
  for(const b of G.soap){
    b.age+=dt;
    if(b.age>b.life+.3){ b.age=0; const h=hs(b.s,(t*10)|0); b.ox=(h%17)-8; b.oy=((h>>>5)%11)-5; }
    const u=Math.min(b.age,b.life), k=u/b.life;
    const x=b.hx+b.ox+Math.sin(u*1.1+b.s%7)*5, y=b.hy+b.oy-6-22*k;
    if(Math.abs(x-px)>hw||Math.abs(y-py)>hh) continue;
    if(b.age<b.life && Math.hypot(x-px,y-py)<b.r+5) b.age=b.life;          // 触れると弾ける
    if(!tileSeen(x/Q,(y+6)/Q)) continue;
    if(Number.isFinite(CAVE.visTiles)&&Math.hypot(x-px,y-py+4)>CAVE.visTiles*Q) continue;
    const lit=CAVE.lightAt(x/Q,(y+6)/Q), sx=Math.round(x*ps-camX), sy=Math.round(y*ps-camY);
    if(b.age>=b.life){                                                        // 弾けた：4つの飛沫が外へ
      const e=(b.age-b.life)/.3; ctx.globalAlpha=(1-e)*(.4+.5*lit); ctx.fillStyle=SOAP_IRI[0];
      for(const [ax,ay] of [[-1,-1],[1,-1],[-1,1],[1,1]]) ctx.fillRect(sx+Math.round(ax*(b.r+1+e*3)*ps),sy+Math.round(ay*(b.r+1+e*3)*ps),q,q);
      continue; }
    const fade=Math.min(1,b.age/.6)*(k>.92?1-(k-.92)/.08*.5:1), A=(.22+.5*lit)*fade;
    for(const [rx,ry,a] of soapRim(b.r)){
      ctx.globalAlpha=A*(ry<0?1:.7); ctx.fillStyle=SOAP_IRI[((a/6.2831853+t*.12+(b.s%100)/100)*4|0)&3];
      ctx.fillRect(sx+rx*ps|0, sy+ry*ps|0, q, q); }
    ctx.globalAlpha=Math.min(1,A*1.8); ctx.fillStyle='#ffffff';
    ctx.fillRect(sx+Math.round(-b.r*.5)*ps|0, sy+Math.round(-b.r*.5)*ps|0, q, q);   // 照り
  }
  ctx.restore();
}
function airStep(Z,dt){
  batStep(dt||0.016);
  if(!G) return;
  if(Z&&Z.id==='sump') soapStep(dt||0.016);
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
    if(Number.isFinite(CAVE.visTiles)&&Math.hypot(m.x-cx,m.y-cy+4)>CAVE.visTiles*Q) continue;   // 灯りが迫った闇の外には漂わせない
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
  /* 水の層の磯虫（タイドスレイター）。濡れた灰褐色に、甲の縁だけ青緑の照り */
  slater:{o:'#08090b',d:'#262a2c',b:'#5c6460',h:'#a8b4aa',ld:'#181c1e',l:'#363e3c',lh:'#5e6a64',e:'#d8fff0',g:'#8fe0c8',w:'#c4d2c8'},
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
/* 磯虫（フナムシのような群れの虫）。低く平たい甲を節で区切り、前に長い触角、後ろに二股の尾。
   脚は7対を細かく回す——**速く走って見えること**がこの虫の全部なので、脚の位相は歩きの倍で回す。 */
function slater(p,g,t,e){
  const run=Math.sin(t*9+(e._sl||(e._sl=Math.random()*6)));
  for(let i=0;i<7;i++){ const x=-4.6+i*1.5, ph=g*2.2+i*1.3, f=Math.sin(ph)*.9; line(x,-1.4,x+f,0,i%2?p.L[0]:p.L[1]); }
  ell(-.4,-2.7,5.8,2.1,p.B);
  for(let x=-3.8;x<=3.6;x+=1.5) line(x,-4.5,x+.25,-1.6,p.B[0]);              // 甲の節
  for(let x=-4.4;x<=3.8;x+=1.5) dot(x,-4.3,p.W[1]);                          // 節の照り
  ell(5.1,-2.3,1.5,1.3,p.B);                                                  // 頭
  line(5.9,-3.1,9.0,-5.4+run*.5,p.L[1]); line(5.7,-3.3,8.2,-6.6-run*.4,p.L[0]);   // 触角
  line(-6.0,-2.6,-8.4,-3.6,p.L[1]); line(-6.0,-2.1,-8.2,-1.0,p.L[0]);         // 二股の尾
  glow(5.8,-2.8,p.e);
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
  slater:{swarm:(p,e,g,t)=>slater(p,g,t,e)},
  undead:{rush:(p,e,g,t)=>humanoid(p,g,'prone'), range:(p,e,g,t)=>company(p,g,t), turret:(p,e,g,t)=>humanoid(p,g,'kneel'), swarm:(p,e,g,t)=>humanoid(p,g,'run',{skull:true})},
};
/* 自分で光るもの（地形に光を落とす） */
const EMIT={slime:{turret:[30,.75]}, arcane:{swarm:[18,.35],range:[14,.25]}, armor:{range:[30,.8]}, flame:{turret:[26,.8],swarm:[22,.5],rush:[14,.3]}, storm:{range:[20,.45]}};
const FOE_CV=new WeakMap();   // 敵ごとのキャンバス（分裂で複製された敵とも共有しない）
const MID={5:'toad',15:'leech',25:'spider',35:'serpent',45:'eye'};
const BODY_SIZE={ beast:{range:.70}, slater:{swarm:.40} };   // 磯虫は半分くらいに（ユーザー要望）   // 系統×形式 → 絵の倍率（当たり判定は変えない）

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
  /* 波紋は地形のバッファに描く（waterPost）。本編の点の輪は重ねない。 */
  const oldRip=window.drawFeelRipples;
  if(typeof oldRip==='function') window.drawFeelRipples=function(camX,camY){ if(!CAVE.on) return oldRip(camX,camY); };
  /* 石の層の水溜りを踏んでも、水の層と同じく波紋としぶきを出す。 */
  const oldStep=window.feelFootstep;
  if(typeof oldStep==='function') window.feelFootstep=function(e){
    oldStep(e);
    if(!CAVE.on||!e||!Number.isFinite(e.x)||!Number.isFinite(e.y)) return;
    if(W.haz&&W.haz.g[Math.floor(e.y)]?.[Math.floor(e.x)]) return;          // 水の層の水は本編が出している
    if(!puddleAt(e.x,e.y)) return;
    FEEL.ripples.push({x:e.x,y:e.y,age:0,col:'#5a7ea2'}); if(FEEL.ripples.length>28) FEEL.ripples.shift();
    if(typeof feelSpray==='function') feelSpray(e.x,e.y+.16,'#8ab0d0',4,.6,'water');
  };
  /* 深み（2段目）に入ったら、足元が水に浸かって見える（報告「深みに入ったときは足元が水に浸かるように」）。
     水面の線より下は薄く（水越しに透ける）、上はそのまま描き、水面の線に揺れる輪を引く。
     当たり判定・座標は変えない。落ちている最中・倒れた相手には掛けない。 */
  const wadeLine=(ent)=>{
    if(!CAVE.on||!ent||ent.dead||ent.fallAnim||!W.haz||W.haz.kind!=='water'||typeof hazTier!=='function') return 0;
    return hazTier(ent.x,ent.y)>=2 ? .25 : 0;               // 絵の中心から、大きさの何割下が水面か（.25＝すね）
  };
  const wadeDraw=(draw,x,y,n,frac,ent)=>{  // 水面より下は .40 で透かす
    const wl=Math.round(y+n*frac), big=n*3;
    ctx.save(); ctx.beginPath(); ctx.rect(x-big,y-big,big*2,wl-(y-big)); ctx.clip(); const r=draw(); ctx.restore();
    if(!r) return r;
    ctx.save(); ctx.beginPath(); ctx.rect(x-big,wl,big*2,big); ctx.clip(); ctx.globalAlpha*=.40; draw(); ctx.restore();
    // 水面の輪：体の周りに2ドット幅の楕円。手前の弧を明るく、ゆっくり揺らす
    const px=Math.max(1,Math.round(n/16)), rw=n*.36, rh=n*.10, ph=performance.now()/260+(ent&&ent.uidA||0);
    ctx.save(); ctx.fillStyle='#bfe6f2';
    for(let i=0;i<24;i++){ const ang=i/24*6.2831853, wob=Math.sin(ph+i*.9)*.6;
      const fx=x+Math.cos(ang)*(rw+wob*px), fy=wl+Math.sin(ang)*(rh+wob*px*.5);
      ctx.globalAlpha=Math.sin(ang)>0?.85:.35; ctx.fillRect(Math.round(fx),Math.round(fy),px*(i%3?1:2),px); }
    ctx.restore();
    return r;
  };
  const oldChar=window.drawFeelCharacterSprite;
  if(typeof oldChar==='function') window.drawFeelCharacterSprite=function(id,x,y,size,ent,...rest){
    const f=wadeLine(ent); if(!f) return oldChar(id,x,y,size,ent,...rest);
    return wadeDraw(()=>oldChar(id,x,y,size,ent,...rest),x,y,Math.round(size),f,ent);
  };
  const oldEnemy=CAVE.enemy;
  CAVE.enemy=function(e,sx,sy,R){
    const f=wadeLine(e); if(!f) return oldEnemy(e,sx,sy,R);
    return wadeDraw(()=>oldEnemy(e,sx,sy,R),sx,sy,Math.round(R*2.6),f*.9,e);
  };
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
    try{ extraTilt(); drawMiasma(); }catch(err){ console.error(err); CAVE.on=false; return oldTilt && oldTilt(); }
  };
  if(typeof window.drawFeelMist==='function') window.drawFeelMist=noop;
  if(typeof window.drawFeelDarkness==='function') window.drawFeelDarkness=noop;
  // 漂う粒は1ドットに
  const oldAir=window.drawAir;
  window.drawAir=function(Z,dt){ if(!CAVE.on||!G) return oldAir&&oldAir(Z,dt); if(Z&&Z.id==='stone'&&oldAir) oldAir(Z,dt); airStep(Z,dt||0.016); };   // 石の層は元の羽虫・蛾も舞う
  // 足元の影もドットで
  window.drawFeelGroundShadow=function(x,y,size,scale=1,alpha=1){
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)) return;
    // 深みに浸かっている足元には影を落とさない（水の中に黒い楕円が沈んで見えた）
    if(W.haz&&W.haz.kind==='water'&&typeof hazTier==='function'){
      const wx=(x+P.x*TS-innerWidth/2)/TS, wy=(y+P.y*TS-innerHeight/2)/TS;
      if(hazTier(wx,wy)>=2) return;
    }
    const ps=TS/Q, s=Math.max(2,size*scale), w=Math.max(3,Math.round(s*.34/ps)), h=Math.max(1,Math.round(w*.3));
    const fx=Math.round(x), fy=Math.round(y+s*.36);
    ctx.save(); ctx.globalAlpha*=.55*Math.max(0,Math.min(1,alpha)); ctx.fillStyle='#000';
    for(let j=-h;j<=h;j++){ const hw=Math.round(w*Math.sqrt(1-(j/(h+.5))**2)); ctx.fillRect(fx-hw*ps, fy+j*ps, hw*2*ps, ps); }
    ctx.restore();
  };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
