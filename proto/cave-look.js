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

/* ---------- 波打ち際（水の層） ----------
   2026-10-07 ユーザー要望（見本の動画：砂浜に寄せては返す波）「水面と地面の境界線のところの波」。
   水の縁から陸へ、最大 SW_R（場の値で。だいたい3〜4ドット）まで、波が寄せては返す：
   - 寄せ（周期の 32%）：速く上がって止まる。返し：ゆっくり引く。周期 SW_PER（6）秒。届く高さは波ごとに 0.6〜1.0。
   - 波の先は1ドットの白い泡の線（寄せる時は濃く、返す時は網目で間引いて薄く）。
   - 波に覆われた砂は、浅瀬の色を半分重ねて透けて見せる。
   - 波が引いた後の砂は濡れて暗い。乾くまで 3.5 秒、網目で少しずつ消える。
   - 波の来る時刻は場所ごとにずらす（世界の x,y と大きなノイズ）。岸に沿って、波が斜めに順に打ち寄せる。
   地形を描いた後、置き物の前に、縁の近くの床のドットだけを塗り直す（その場で拾った SWK/SWV）。
   CAVE.swash=false で止まる（見比べ用）。 */
const SW_R=.24, SW_LO=.5-SW_R, SW_PER=6.0, SW_ADV=.32, SW_DRY=3.5;   // 2026-10-07「揺れが強いので動きの大きさと頻度を減らしたい」：届き .40→.24（6〜7→3〜4ドット）、周期 3.4→6.0秒、乾き 2.2→3.5秒
let SWK=new Int32Array(0), SWV=new Float32Array(0);
function swashPass(n,bx0,by0,t,hz){
  const wash=hz.shallow[3], foam=hz.hi, wetC=0xff0a0c10, PXR=SW_R*16;      // PXR：q の1単位がおよそ何ドットか
  for(let i=0;i<n;i++){
    const k=SWK[i], q=(.5-SWV[i])/SW_R, wx=bx0+k%bw, wy=by0+((k/bw)|0);
    const ph=wx*.011+wy*.017+NZS[(((wy>>2)+30)&255)<<8|(((wx>>2)+60)&255)]*.6;
    const T=t/SW_PER-ph, cyc=Math.floor(T), u=T-cyc;
    const amp=.6+.4*(Math.sin(cyc*2.3+wx*.013)*.5+.5);
    let s, adv=u<SW_ADV;
    if(adv){ const e=u/SW_ADV; s=1-(1-e)*(1-e); } else { const e=(u-SW_ADV)/(1-SW_ADV); s=Math.pow(1-e,1.5); }
    const reach=s*amp, b=BAYER[((wy&3)<<2)|(wx&3)], c=buf[k];
    if(q<reach){                                                               // 波の下
      const fp=(reach-q)*PXR;
      if(fp<1.25){ if(adv||b<.55) buf[k]=mixU(c,foam,adv?.85:.6); else buf[k]=mixU(c,wash,.5); }   // 先の泡
      else buf[k]=mixU(c,wash,fp<3?.42:.5);
      continue; }
    if(q>=amp) continue;                                                       // この波は届かなかった
    // 引いた後の濡れ：この波が q から引いた時刻（返しの式の逆）からの経過
    const eL=1-Math.pow(q/amp,1/1.5), uL=SW_ADV+eL*(1-SW_ADV);
    const since=((u>=uL?u-uL:u+1-uL))*SW_PER;
    const w=1-since/SW_DRY; if(w<=0) continue;
    if(w*.95>b) buf[k]=mixU(c,wetC,.3);
  }
}

/* ---------- 階ごとの岩の形（遅延で 32×32 ドットずつ作る） ---------- */
let G=null;
const OFF=[];for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.hypot(dx,dy);if(d>0&&d<=4.3)OFF.push([dx,dy,Math.max(1,Math.round(d))]);}
OFF.sort((a,b)=>a[2]-b[2]);
/* 大広間の柱（fl.cover）のマスは、ゲームでは壁だが**岩としては描かない**（床として描き、上に石灰岩の柱の絵を立てる） */
const COVER_SET=new WeakMap();
function coverSetOf(f){ let s=COVER_SET.get(f); if(!s){ s=new Set((f.cover||[]).map(c=>c.ty*f.W+c.tx)); COVER_SET.set(f,s); } return s; }
function wallAt(f,tx,ty){ if(tx<0||ty<0||tx>=f.W||ty>=f.H) return 1; if(f.g[ty][tx]!==T.WALL) return 0; return (f.cover&&f.cover.length&&coverSetOf(f).has(ty*f.W+tx))?0:1; }
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
/* 水面に立つ物の映り込み・水際のきらめき（2026-10-07 ユーザー要望「水面にあるものは水面の影響を受けたい」）。
   置き物を描いた後、列ごとに上から見て「置き物（前後の印 occD がある＝立ち物・北の壁）のすぐ下が水」の所を水際とし：
   - 水際から下 RF_K 行に、水際から上の絵を上下反対に映す（下ほど薄く、行ごとに左右へ±1揺らす。暗く沈めて水の色に溶かす）
   - 水際の1行目に、横へ流れる明るいきらめき（白い泡ほど強くしない）
   水の中に沈んだ所は、今まで通り水と一緒に屈折で揺れる（印 wmask を残してある）。CAVE.reflect=false で止まる。 */
const RF_K=7, RF_A=.5;
function waterReflect(t){
  const NONE=-32768, hi=HZ.water.hi;
  for(let x=1;x<bw-1;x++){
    for(let y=1;y<bh;y++){
      const k=y*bw+x; if(wmask[k]!==1) continue;
      const ka=k-bw; if(wmask[ka]||occD[ka]===NONE) continue;              // すぐ上が水ではない置き物
      for(let i=0;i<RF_K;i++){ const yy=y+i; if(yy>=bh) break; const kk=yy*bw+x; if(wmask[kk]!==1) break;
        const sy=y-1-i; if(sy<0) break; let ks=sy*bw+x; if(wmask[ks]||occD[ks]===NONE) break;
        const wob=Math.round(Math.sin(yy*.9+t*2.2+x*.05)*.9); if(wob){ const k2=ks+wob; if(!wmask[k2]&&occD[k2]!==NONE) ks=k2; }
        buf[kk]=mixU(buf[kk],mixU(buf[ks],0xff000000,.35),RF_A*(1-i/RF_K)); }
      if(Math.sin(x*.8-t*2.6+y*.3)>.72) buf[k]=mixU(buf[k],hi,.4);              // 水際のきらめき
      y+=RF_K-1; } }
}
function waterPost(bx0,by0,t){
  if(!wmask) return;
  const reduced=typeof FEEL_REDUCED!=='undefined'&&FEEL_REDUCED.matches;
  if(!reduced&&CAVE.reflect!==false&&occD) waterReflect(t);
  if(!reduced) for(let by=0;by<bh;by++){
    const wy=by0+by, sh=Math.round(Math.sin(wy*.16+t*1.6+Math.sin(wy*.05)*2));
    if(!sh) continue;
    const o=by*bw; let any=false;
    for(let x=0;x<bw;x++){ const m=wmask[o+x]; wrow[x]=buf[o+x]; if(m) any=true; }
    if(!any) continue;
    for(let x=1;x<bw-1;x++){ const m=wmask[o+x]; if(m&&wmask[o+x+sh]===m) buf[o+x]=wrow[x+sh]; }
  }
  if(!reduced) ripDraw(bx0,by0);
}
/* ---------- 波紋（2026-10-03 作り直し）----------
   ユーザー「水の層の水の波紋の表現が微妙なので、もっとシンプルな形に波紋が起こるようにして欲しい」。
   以前は水面の高さの場を解いていた（輪が岸で跳ね返り、重なって干渉する）。歩くと航跡と干渉で形が崩れ、
   何の形か分からない線の群れに見えていた。
   今は**1ドットの楕円の輪が1つ、足もとから広がって消える**だけにした:
     ・足音（FEEL.ripples。水の中を歩く者の一歩ごと）につき輪を1つ。強い物（amp>1.5：落ちて着水など）は2重
     ・輪は横長の楕円（縦は横の半分＝地面に寝た輪）。0.9秒で半径1.5→13ドットへ、はじめ速く後でゆっくり広がる
     ・濃さは広がるほど薄く、終わりの3割は1ドットおきの点線になって消える
     ・水の上（wmask）だけに描く。岸を越えた所は描かない（跳ね返りはしない）
     ・色は水面のいちばん明るい色、水溜りは照り返しの色。航跡（動くたびの波）はやめた */
const RP_LIFE=.9, RP_R0=1.5, RP_R=13, RP_MAX=40, RP_A=.85, RP_GAP2=.24;
let RIPS=[], ripLast=0;
const ripSeen=new WeakSet();
function ripWet(px,py){
  const tx=Math.floor(px/Q), ty=Math.floor(py/Q), f=G&&G.f; if(!f||!f.g[ty]) return false;
  const t=f.g[ty][tx]; if(t===undefined||t===T.WALL) return false;
  if(W.haz&&W.haz.kind==='water'&&W.haz.g[ty]&&W.haz.g[ty][tx]) return true;
  return !!(G.pools&&G.pools.length&&poolU(G.pools,px,py)>0);
}
function ripAdd(x,y,amp){                      // x,y はマス単位の足もと
  if(!G||!Number.isFinite(x)||!Number.isFinite(y)) return false;
  const px=x*Q, py=y*Q+5; if(!ripWet(px,py)) return false;   // 足もと（絵の中心の0.3マス下＝足もとの影と同じ）
  if(RIPS.some(r=>r.t<.38&&Math.hypot(r.x-px,r.y-py)<14)) return false;   // 歩いている間は、前の輪が育つまで次を出さない（輪が鎖のように連なった）
  RIPS.push({x:px,y:py,t:0,n:(amp||0)>1.5?2:1}); if(RIPS.length>RP_MAX) RIPS.shift();
  return true;
}
let ripG=null;
function ripFeed(){
  if(!G) return;
  if(ripG!==G){ RIPS=[]; ripG=G; }                     // 階が替わったら前の階の輪は捨てる
  const rs=(typeof FEEL!=='undefined'&&FEEL.ripples)||[];
  for(const r of rs){ if(ripSeen.has(r)) continue; ripSeen.add(r); if(r.age<.2) ripAdd(r.x,r.y,r.amp); }
  const now=performance.now(), dt=CAVE.ripFixed?1/30:Math.min(.1,ripLast?(now-ripLast)/1000:0); ripLast=now;
  ripStep(dt);
}
function ripStep(dt){ for(const r of RIPS) r.t+=dt; RIPS=RIPS.filter(r=>r.t<RP_LIFE+(r.n-1)*RP_GAP2); }
function ripDraw(bx0,by0){
  if(!RIPS.length||!wmask) return;
  const hiW=HZ.water.hi, hiP=DECO_PAL.poolGleam, done=new Set();
  for(const r of RIPS) for(let i=0;i<r.n;i++){
    const u=(r.t-i*RP_GAP2)/RP_LIFE; if(u<=0||u>=1) continue;
    const e=1-(1-u)*(1-u), rx=RP_R0+(RP_R-RP_R0)*e*(i?0.75:1), ry=rx*.5;
    const a=RP_A*Math.pow(1-u,.6)*(i?0.7:1), dotted=u>.7, N=Math.max(12,Math.ceil(rx*7));
    done.clear();
    for(let s=0;s<N;s++){
      const an=s/N*6.2831853, X=Math.round(r.x+Math.cos(an)*rx)-bx0, Y=Math.round(r.y+Math.sin(an)*ry)-by0;
      if(X<0||Y<0||X>=bw||Y>=bh) continue;
      const k=Y*bw+X; if(done.has(k)) continue; done.add(k);
      if(dotted&&((X+Y+bx0+by0)&1)) continue;
      const m=wmask[k]; if(!m) continue;
      buf[k]=mixU(buf[k], m===2?hiP:hiW, a);
    }
  }
}
CAVE.ripples=()=>RIPS;
CAVE.rippleStep=(dt)=>ripStep(dt);
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
  if(nbw!==bw||nbh!==bh){bw=nbw;bh=nbh;bufC.width=bw;bufC.height=bh;img=bufX.createImageData(bw,bh);buf=new Uint32Array(img.data.buffer);cool=new Float32Array(bw*bh);wmask=new Uint8Array(bw*bh);occD=new Int16Array(bw*bh);wrow=new Uint32Array(bw);wcolX=new Float32Array(bw);}
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
  const swOn=!!(haz&&haz.kind==='water'&&CAVE.swash!==false); let swN=0;
  if(swOn&&SWK.length<bw*bh){ SWK=new Int32Array(bw*bh); SWV=new Float32Array(bw*bh); }
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
        if(hg&&!(cv2&4)){const hv=hazAt(hg,wx,wy); if(swOn&&hv>SW_LO&&hv<=.5){ SWK[swN]=k; SWV[swN++]=hv; } if(hv>.5){
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
  if(swN) swashPass(swN,bx0,by0,t,hz);
  if(!G.deco){ G.deco=genDeco(f,Z); G.bats=genBats(f,Z); }
  drawDeco(bx0,by0,t,blindR);
  if(!(typeof FEEL_REDUCED!=='undefined'&&FEEL_REDUCED.matches)) ripFeed();
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
  algae:dcR(['#3e3e18','#6e6c28','#a39a44']), kelp:dcR(['#18241a','#34502a','#628a3e']), kelpTip:C('#9cc25a'), kelpBlad:C('#b8a248'),
  alg:dcR(['#173a22','#2b6034','#4c9046']), algTip:C('#88d070'), mossBed:dcR(['#2e3014','#55561f','#86823a']), mossBedTip:C('#b0a650'), foam:C('#d8f4f4')});
// 層ごとの品目：[名前, 置き場所, 出やすさ]
const DECO_SET={
  /* 4つめは「この深さから出る」最小の階層（省略＝最初から出る）。
     石の層の後半（第6階層〜第10階層）だけ、床に苔の足場と水溜りを混ぜる
     ——次が水の層なので、**床が湿っていく**ことを絵で先に言う（ユーザー要望）。 */
  /* 水溜りは**角**に置く（床のまん中にぽつぽつ置くと不自然、という指摘）。
     低い所＝壁の付け根に水は溜まる。角の石筍より先に引くので、水溜りの角には石筍が立たない。
     壁沿いにも少しだけ。 */
  stone:[['pool','corner',.24,6],['stalagC','corner',.35],['pool','wall',.005,6],['rock','open',.006],['vine','north',.08],['skel','floor',.006],
         ['mossbed','floor',.020,6],
         ['moss','wall',.030],['reed','wall',.016],['pebble','floor',.008]],
  sump:[['weed','water',.030],['fish','water',.016],['plankton','water',.010],['shrimp','floor',.012],['shell','wall',.014],
        /* 2026-10-05 ユーザー要望「床に海藻や藻のようなものを配置したい」：床に海藻の株（立ち物）と、平たい藻の広がり */
        ['kelp','floor',.012],['algae','floor',.036],
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
  /* 19階（水の層の9階目）は遺跡を多く（2026-10-07 ユーザー要望「19階ではもっと遺跡物を増やしたい」）：
     建物の跡を最大3つ（部屋が少なくても2つ）、街区の欠片を2つずつ、残りの部屋の欠片 22%→60%（4割は2つ目も）、列柱 40%→75% */
  const rich=zoneFloor(depth)===9;
  const nDist=rich?(rooms.length>=12?3:2):(rooms.length>=16?2:1);
  let made=0;
  for(const c of big){ if(made>=nDist) break; if(used.has(c)) continue;
    if(!building(c)) continue;
    made++; used.add(c);
    // 街区：中ほどが近い部屋を2〜3つ
    const near=rooms.filter(r=>r!==c&&!used.has(r)&&Math.hypot(r.cx-c.cx,r.cy-c.cy)<20).sort((a,b)=>Math.hypot(a.cx-c.cx,a.cy-c.cy)-Math.hypot(b.cx-c.cx,b.cy-c.cy)).slice(0,2+Math.floor(rnd()*2));
    for(const r of near){ used.add(r); if(long(r)) colonnade(r); else { fragment(r,true); if(chance(rich?1:.4)) fragment(r,true); } }
  }
  for(const r of rooms){ if(used.has(r)) continue;
    if(long(r)&&chance(rich?.75:.4)){ used.add(r); colonnade(r); continue; }
    if(chance(rich?.6:.22)){ used.add(r); fragment(r,false); if(rich&&chance(.4)) fragment(r,false); } }
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
  const cs=(o.k==='rock'||o.k==='stalagC'||o.k==='column')&&caveSprFor(o); if(cs) return [-cs.ax,-cs.ay,cs.w-cs.ax-1,cs.h-cs.ay-1];
  switch(o.k){
    case 'reed': return [-10,-23,9,1];
    case 'weed': return [-6,-17,7,1];
    case 'kelp': return [-7,-22,7,1];
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
  /* 大広間の柱（ヴェラの階）。柱のマスの周り1.6マスの置き物は外す（柱に重なる・柱を壁と見て貼り付くため） */
  if(f.cover&&f.cover.length){
    out=out.filter(o=>!f.cover.some(c=>Math.hypot(o.x/Q-c.x,o.y/Q-c.y)<1.6));
    for(const c of f.cover) out.push({k:'column', x:Math.round(c.x*Q), y:Math.round(c.y*Q+2), s:hs(c.tx*31+c.ty*977,5), ok:1, ext:40});
  }
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
/* ---------- 立ち物の前後（2026-10-02 ユーザー要望「鍾乳石や柱の根元より手前ではキャラが上、裏には回り込めるように」）----------
   地形と置き物は1枚の絵（buf）に描いてからキャラを上に描くので、今までキャラはいつも置き物より上だった。
   そこで立ち物を描くとき、ドットごとに「そのドットの真下の地面の y（ドット）」を occD に控えておき、
   キャラを描き終えたあと（drawOccluders）、キャラの足もとより手前（南）に地面がある立ち物のドットだけを、
   キャラの絵の範囲に描き戻す。手前に立てばキャラが上、奥に回れば柱に隠れる。当たり判定は根元だけなので裏へ回れる。 */
let occD=null, occGY=null;   // occGY：dp/dpf/dpw で描くドットの地面の y（null なら控えない＝平たい物）
let occCv=null, occX=null, occImg=null, occU=null;
const OCC_HERO_A=.8;          // 主人公に重ねる立ち物の濃さ（1で完全に隠れる）
/* キャラの足もと（ドット）。主人公・仲間は絵の真ん中から 0.3 マス下（足もとの影と同じ）、大きい敵は体の大きさで */
function occFoot(e){ const r=Number.isFinite(e.r)?e.r:.3; return (e._dwy+Math.max(.3,r*.85))*Q; }
function drawOccluders(camX,camY){
  if(!occD||!lastT||!G||!CAVE.on) return 0;
  const ps=TS/Q, ox=lastT.bx0, oy=lastT.by0, serial=(typeof _drawSerial!=='undefined')?_drawSerial:null;
  const ents=[P, ...(W.enemies||[]), ...((typeof livingParty==='function'&&livingParty())||[]), W.npc]
    .filter(e=>e && !e.dead && Number.isFinite(e._dwx) && (serial===null||e._drawn===serial));
  let n=0;
  for(const e of ents){
    const r=Number.isFinite(e.r)?e.r:.3, foot=occFoot(e), hw=Math.max(.6,r*1.8), up=Math.max(.95,r*2.4);
    let x0=Math.floor((e._dwx-hw)*Q)-ox, x1=Math.ceil((e._dwx+hw)*Q)-ox, y0=Math.floor((e._dwy-up)*Q)-oy, y1=Math.ceil(foot)-oy+2;
    if(x0<0) x0=0; if(y0<0) y0=0; if(x1>bw) x1=bw; if(y1>bh) y1=bh;
    const w=x1-x0, h=y1-y0; if(w<=0||h<=0) continue;
    // 手前（足もとより南に地面がある）立ち物のドットがあるかを先に見る
    let any=false; for(let y=y0;y<y1&&!any;y++){ const row=y*bw; for(let x=x0;x<x1;x++) if(occD[row+x]>foot){ any=true; break; } }
    if(!any) continue;
    if(!occCv||occCv.width<w||occCv.height<h){ occCv=document.createElement('canvas'); occCv.width=Math.max(w,64); occCv.height=Math.max(h,64); occX=occCv.getContext('2d'); occImg=occX.createImageData(occCv.width,occCv.height); occU=new Uint32Array(occImg.data.buffer); }
    occU.fill(0);
    const OW=occCv.width;
    for(let y=y0;y<y1;y++){ const row=y*bw, orow=(y-y0)*OW; for(let x=x0;x<x1;x++){ const k=row+x; if(occD[k]>foot) occU[orow+x-x0]=buf[k]; } }
    occX.putImageData(occImg,0,0,0,0,w,h);
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(e===P) ctx.globalAlpha*=OCC_HERO_A;               // 主人公だけは、柱の奥でもうっすら透けて見える（見失わないように）
    ctx.drawImage(occCv,0,0,w,h,(ox+x0)*ps-camX,(oy+y0)*ps-camY,w*ps,h*ps);
    ctx.restore(); n++;
  }
  CAVE.occDrawn=n; return n;
}
CAVE.drawOccluders=drawOccluders;
function dpf(x,y,c){ x=Math.round(x)-DB0x; y=Math.round(y)-DB0y; if(x>=0&&y>=0&&x<bw&&y<bh){ const k=y*bw+x; buf[k]=c; if(occGY!==null) occD[k]=occGY; } }
function sh5(r,L,x,y){ const i=Math.floor(Math.min(1,L)*4.99+(BAYER[((y&3)<<2)|(x&3)]-.5)*.9); return r[i<0?0:i>4?4:i]; }
function dpw(x,y,c,m){ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=G.PW||y>=G.PH||G.code[y*G.PW+x]) return; x-=DB0x; y-=DB0y; if(x>=0&&y>=0&&x<bw&&y<bh){ const k=y*bw+x; buf[k]=c; wmask[k]=m; if(occGY!==null) occD[k]=occGY; } }
function dp(x,y,c){ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=G.PW||y>=G.PH||G.code[y*G.PW+x]) return; x-=DB0x; y-=DB0y; if(x>=0&&y>=0&&x<bw&&y<bh){ const k=y*bw+x; buf[k]=c; if(occGY!==null) occD[k]=occGY; } }
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
  for(const d of G.deco){ if(d.st||(d.k!=='rock'&&d.k!=='stalag'&&d.k!=='stalagC'&&d.k!=='column'&&d.k!=='rbig'&&d.k!=='wpost')) continue;
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
/*CAVE_SPR_BEGIN*/const CAVE_SPR={"rock_a":{"w":20,"h":18,"ax":10,"ay":11,"m":["....................","...rrrrrrmrrrr......","..rrrrrrrrrrrrrr....",".rrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrmrrrrrrrrr.","...rrrrrrrrrrrrrrrr.","....rrrrrrrrrrrrrr..",".....rrrrrrrrrrrrr..","......rrrrrrrrrrr...",".......rrrrrr.......","...................."],"n":["....................","...22222200055......","..22222000000555....",".42220000000005555..",".mm9000000000005555.",".mmm100000000005555.",".mmmm10000000000855.",".mmmmm000000000gggg.",".mmmmmm6666300ggggg.",".mmmmmm666666bggggg.",".mmmmmme666666ggggg.",".Huummmm666666ggggg.","...uuumm6666joogggg.","....uummm6oooooggg..",".....uummooooooogg..","......umeoooooooB...",".......HjoowJ.......","...................."],"a":["....................","...88999999999......","..99999999999989....",".99999999999999999..",".898999999999999999.",".999889999999999898.",".999999999999999989.",".999999878999999899.",".999999999999998999.",".999999999999989999.",".989999999988899999.",".999999999999998998.","...9999999999889999.","....99999999999989..",".....8988898899999..","......99999999999...",".......998888.......","...................."],"hts":["00000000000000000000","00055556666665000000","00556666666665540000","05666666666666554300","05666666666666654430","04566666666666665440","04456666666666665540","03445666666666665440","02344566666666654430","02234556666655544330","01233455555555443320","00123344444444433220","00012233444444332210","00001123333333322100","00000012222222211100","00000001111111111000","00000000110000000000","00000000000000000000"],"obs":[[0.0,0.0,6.1]],"foot":[7,5],"kind":"rock"},"rock_b":{"w":22,"h":26,"ax":10,"ay":17,"m":["......................","........r.............",".......rrrr...........",".......rrrrrr.........","......rrrrrrrr........",".....rrrrrrrrrrr......","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrrrr..","...rrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrmrrrrrrrrmrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.","...rrrrrrrrrrrrrrrrr..",".....rrrrrrrrrrrrrr...","......rrrrrrrrrrrr....","........rrrrrrrrr.....","............rrrr......","......................"],"n":["......................","........0.............",".......4000...........",".......400000.........","......40000000........",".....44000000000......","....44400000000000....","....4400000000000000..","...44400000000000000..","..4444000000000000000.","..4440000000000000000.",".44499000000000000000.",".49999600000000000000.",".e9999960000000000000.",".zm999966000000000000.",".zzz99666660000000000.",".zzzz9666666000000008.",".zzzzz6666666608ggggg.",".zzzzzz6666666ggggggg.","..zzzzzzj66666ggggggg.","...zzzzzrrrj6bgggggg..",".....zzzrrrrroggggg...","......zzrrrrrrgggg....","........rrrrrrwgg.....","............EErt......","......................"],"a":["......................","........9.............",".......9999...........",".......999979.........","......99999899........",".....99999989999......","....99999998999899....","....8989999899989998..","...89979998999999998..","..9898799989999999999.","..9999899999998999999.",".98998999999998999989.",".98999999999998999989.",".99899999979998999999.",".99988999989997999999.",".99999999999998999899.",".98999999999999999899.",".89999889998989999999.",".89899999999999999989.","..9999999999999999999.","...99989988888999998..",".....99988898699998...","......989999989999....","........999999999.....","............9999......","......................"],"hts":["0000000000000000000000","0000000080000000000000","0000000787700000000000","0000000887776000000000","0000007887776600000000","0000078887776665000000","0000778887776665550000","0000778887776665554400","0006788887776665554400","0067788887776655544430","0067888877766655544430","0677888877766655544430","0677788877766655544430","0667777877766655544430","0566677777766655544430","0456666777766655544430","0345566666666655544430","0233455555555555444330","0122345555555554433220","0011233444444444332210","0000122334444433222100","0000011223333332211000","0000000112222222110000","0000000001111111100000","0000000000000000000000","0000000000000000000000"],"obs":[[0.0,0.0,7.5]],"foot":[8,7],"kind":"rock"},"rock_c":{"w":14,"h":16,"ax":8,"ay":10,"m":["..............",".....rrr......","...mrrrrrr....","...rrrrrrrr...","..rrrrrrrrrr..","..rrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.",".rrrrrrrrrrrr.","..rrrrrrrrrrr.","...rrrrrrrrr..","....rrrrrrr...","......rrrr....",".............."],"n":["..............",".....222......","...2222222....","...22222222...","..422222222d..","..4222222220d.",".44122222238d.",".499922133888.",".99999bbb388t.",".mm999bbbb8gt.",".mmmmmbbbb3tt.","..mmmmbbbbttG.","...mmmmbbbtt..","....zmmbbbt...","......////....",".............."],"a":["..............",".....799......","...8999999....","...99999998...","..8999998898..","..99999999999.",".999989999999.",".999899999999.",".999989999999.",".998998899999.",".999999999998.","..99998888899.","...999999999..","....9999999...","......8888....",".............."],"hts":["00000000000000","00000333000000","00033333440000","00033334444000","00233444445400","00334444455530","02344445555540","02344455555440","02334455444430","02233444444320","01123333333310","00112233333100","00001222222100","00000112211000","00000000000000","00000000000000"],"obs":[[0.0,0.0,4.4]],"foot":[5,4],"kind":"rock"},"rock_d":{"w":26,"h":19,"ax":10,"ay":12,"m":["..........................","...rrrrrrrr...............","..rrrrrrrrrrrrr...........","..rrrrrrrrrrrrrrrr........",".rrrrrrrrrrrrrrrrrr.......",".rrrmrrrrrrrrrrrrrr.......",".rrrmrrrrrrrrrrrrrr.......",".rrrrrrrrrrrrrrrrrr.......",".rrrrrrrrrrrrrrrrrr.......",".rrrrrrrrrrrrrrrrrrrrrr...",".rrrrrrrrrrrrrrrrrrrrrr...",".rrrrrrrrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrrrrrrr..","...rrrrrrrrrrrrrrrrrrrrrr.","....rrrrrrrrrrrrrrrrrrrrr.",".....rrrrrrrrrrrrrrrrrrrr.","......rrrrrrrrrrr..rrrr...",".......rrrrrrrr...........",".........................."],"n":["..........................","...40000000...............","..4400000000000...........","..4440000000000000........",".444400000000000000.......",".444400000000000000.......",".444440000000000000.......",".44444000000000008g.......",".h449eee6600000gggg.......",".uueeeeeee666gggggg144d...",".uuueeeeeeejjgggggg1440...",".uuueeeeeeejjgggggg4444d..","..uuueeeeejjjogggg444gol..","...uueeeejjjjjgggm99ooood.","....uzeerjjjjjgggwz6oooog.",".....zzrrjjjjjgggtzzooooo.","......zrrjjjjjjgt..zooB...",".......Urrjjjww...........",".........................."],"a":["..........................","...89999877...............","..9899999988777...........","..9899999999998789........",".899989999999999999.......",".899998888999999999.......",".999999999899999999.......",".999999999999877999.......",".999988999999998998.......",".9999999899999999998998...",".9998899999989989988988...",".99999999999998998789799..","..9999999999999997898889..","...8898899999999879999989.","....989999999999868998999.",".....99899999999867999998.","......89999999999..8889...",".......98888889...........",".........................."],"hts":["00000000000000000000000000","00056555555000000000000000","00556666555555500000000000","00456666666655555500000000","04556666666666655550000000","04556777666666666660000000","04556777777666666660000000","04556777777777766660000000","04556777777777776650000000","03456666677777665543333000","02345556666666655443334000","01234555556655544333334200","00123444555555443333343300","00012334444444332233333210","00001233333333322122222110","00000122222222211011211110","00000011111111110000100000","00000000011000000000000000","00000000000000000000000000"],"obs":[[0.0,0.0,6.1],[10.4,2.0,2.9]],"foot":[7,6],"kind":"rock"},"rock_e":{"w":31,"h":24,"ax":18,"ay":16,"m":["...............................","..............rrrr.............",".............rrrrrrr...........",".............rrrrrrrrr.........","............rrrrrrrrrrr........","............rrrrrrrrrrrr.......","...........rrrrrrrrrrrrrrr.....","..........rrrrrrrrrrrrrrrrr....","..........rrrrrrrrrrrrrrrrrrr..",".........rrrrrrrrrrrrrrrrrrrmr.",".........rrrrrrrrrrrrrrrrrrmrr.","........rkrrrrrrrrrrrrrrrrrrrr.",".....rrrrrrrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrrrrrrrrrrr...","..rrrrrrrrrrrrrrrrrrrrrrrrr....","...rrrrrrrrrrrrrrrrrrrrrrr.....",".....rrr..rrrrrrrrrrrrrrr......","...........rrrrrrrrrr..........","............rrrrr..............","..............................."],"n":["...............................","..............0000.............",".............0000000...........",".............000000000.........","............00000000000........","............000000000000.......","...........000000000000000.....","..........10000000000000000....","..........9000000000000000000..",".........99000000000000000000y.",".........m990000000000000000ty.","........1mm9000000000000000tty.",".....1111mm990000000000000ttty.","..4411111mmme100000000000tttty.","..h111111mmmeee000000000gtttty.","..h111113hmmeeeee0000goottttty.",".hh1111333mmeeeeejjjoooottttt..",".hm110ggggmmeeeeejjjooootttt...","..zzrgggggmmeeeeejjjoooottt....","...MMEggggmeeeeejjJJJJJJBt.....",".....ZZo..meeeeewJJJJJJJW......","...........eeeewJJJJW..........","............MMMWW..............","..............................."],"a":["...............................","..............9999.............",".............9999878...........",".............998789999.........","............98789999999........","............789999999999.......","...........789999999999997.....","..........89999999999998789....","..........9999999999978999999..",".........899999999977899999999.",".........989999998779999999988.","........8898999988999999999999.",".....9997999997799999999999989.","..9999998999999999999999999998.","..9999998898999999999999999989.","..9999998689989999999999999899.",".9999999869999988989999899899..",".987779875999999999998899999...","..8635798599999988888998999....","...75468769998999998899999.....",".....789..999999999999999......","...........9888988999..........","............89999..............","..............................."],"hts":["0000000000000000000000000000000","0000000000000099990000000000000","0000000000000999998800000000000","0000000000000999888888000000000","0000000000009988888888800000000","0000000000008888888888870000000","0000000000088888888887777700000","0000000000888888888777777770000","0000000000888888877777777776600","0000000007788887777777777766660","0000000006778777777777776666650","0000000036677777777777666666540","0000033335677777777766666665430","0012333334567777776666666654330","0023333334456667666666666543320","0023333333455566666666555432210","0123333322344555565555544322100","0122222222334444555544433221000","0012222111233344444443332110000","0001111110122333333332221100000","0000000000112222222211110000000","0000000000011112111000000000000","0000000000000000000000000000000","0000000000000000000000000000000"],"obs":[[0.0,0.0,8.2],[-11.6,1.2,3.2]],"foot":[9,6],"kind":"rock"},"rock_f":{"w":14,"h":15,"ax":7,"ay":11,"m":["..............","......rrr.....",".....rrrr.....","....rrrrrr....","....rrrrrrr...","...rrrrrrrr...","..rrrrrrrrrr..","..rrrrrrrrrrr.","..rrrrrrrrrr..",".rrrrrrrrrrr..",".rrrrrrrrrrr..","..rrrrrrrrr...","..rrrrrrrr....","...rrrrrrr....",".............."],"n":["..............","......115.....",".....1111.....","....c11110....","....111111d...","...h1111110...","..h1111110tt..","..h11111btttl.","..eeeebbbttt..",".heeeebbbttG..",".zzzeejbbttG..","..zzzwwwotG...","..zzzEwwwt....","...zzEwwwt....",".............."],"a":["..............","......999.....",".....9999.....","....999999....","....9999999...","...99999999...","..9999999999..","..99999999999.","..9999999999..",".99999899999..",".99999999998..","..999999999...","..99989899....","...9989999....",".............."],"hts":["00000000000000","00000066600000","00000566600000","00004666660000","00005666665000","00046666666000","00256666666500","00356666665430","00455555554300","03444555443200","02334444432100","00223333321000","00112222220000","00000111110000","00000000000000"],"obs":[[0.0,0.0,3.7]],"foot":[4,4],"kind":"rock"},"stal_a":{"w":20,"h":34,"ax":9,"ay":26,"m":["....................",".........ttt........",".........ttt........","........tttt........",".........ttt........","........rrrr........","........grrr........",".......rrgggr.......",".......rrrrrr.......",".......rrrrrr.......",".......rrrrrr.......","......rrrrrrr.......","......rrrrrrr.......",".....rrrrrrgrr......",".....rrrrrrrrr......",".....rrrrrrrrr......",".....rrrrrrrrrr.....","....rrrrrrrrrrrt....","....rgrrrrrrrrrtt...","....rrrrrrrrrrrtr...","...rrrrgrrrgrrrrr...","...trrrrrrrrrrrrr...","...trrrrrrrrrrrrr...","..rrrrrrrrrrrrrrr...","..rgggrrrrrrrggggr..","..rrrrgrrrrggrrgrr..","..rrrrrrrgrgrrrrrr..",".rrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrr...","...rrrrrrrrrr.......","....rrrrrrrr........","...................."],"n":["....................",".........40d........",".........108........","........u938........",".........ebO........","........hmgl........","........hebl........",".......hmebtl.......",".......hmeogl.......",".......hmjggl.......",".......umeggl.......","......uumeogl.......","......uumrbgt.......",".....puurjwBtl......",".....humrrotll......",".....hhmrjogtl......",".....hhmejoggll.....","....uhmmejoggll1....","....uummejbggtl6l...","....uumeejbgtthjl...","...huumeejoottujl...","...0humrrjwBBtmjt...","...b9umrrwwBttmjt...","..ub9umejjBottmjt...","..mb9mmrjjogggeotl..","..mj99eejjbgggebgl..","..mjh9eejjbgggebgl..",".hmjmeeejbbgggeogtl.",".umjmee66bbggtjbgt..",".ummmeerjjoogtjjtt..","..mhmejjjjoottjot...","...meejjrwwoB.......","....MejjjjoB........","...................."],"a":["....................",".........999........",".........999........","........9889........",".........889........","........8778........","........8778........",".......887788.......",".......887788.......",".......877788.......",".......877788.......","......8877788.......","......8876788.......",".....888766889......",".....887766888......",".....887777898......",".....8977778988.....","....888776789768....","....8877767797689...","....8877767787578...","...88777766777578...","...97777666776668...","...85777666776667...","..875777666776667...","..8767766778766678..","..8867766778766678..","..8877777788766778..",".878777777887667788.",".87877777788766677..",".87777777788776677..","..778777778887667...","...8877766888.......","....77776788........","...................."],"hts":["00000000000000000000","000000000ooo00000000","000000000ooo00000000","00000000nooo00000000","000000000nnn00000000","00000000lmml00000000","00000000klll00000000","0000000ikkkkj0000000","0000000ijkkji0000000","0000000iijjii0000000","0000000hiiiih0000000","000000fghhhhg0000000","000000egghhgf0000000","00000ceffggfed000000","00000cdefffeec000000","00000bddeeeedc000000","00000bcdddddcba00000","00009bbccccccb9a0000","00008abbcccbba9aa000","000079abbbbba9899000","0004789aaaaa98888000","00076789999987787000","00076788888876777000","00465677777766666000","00455566776665555400","00444556666554454300","00344455555544443300","01233444444443333210","01223333444332222100","00112233333322111100","00011222222211110000","00001111111110000000","00000000000000000000","00000000000000000000"],"obs":[[0.0,0.0,5.5],[6.0,2.0,2.2],[-5.2,2.6,1.6]],"foot":[6,6],"kind":"stal"},"stal_b":{"w":21,"h":32,"ax":11,"ay":23,"m":[".....................",".........t...........","........ttt..........","........tttt.........","........tttr.........","........rtrr.........",".......rrrrrr........",".......rrrrrr........",".......rrrrrr........",".......rrrrrrr.......","......rrrgggrr.......","......rrrrrrrrr......","...tt.rrrrrrrrr......","...ttrrrrrrrrrr......","...ttrrrrrrrrrrr.....","...rrrgrrrrrrrrr.....","..rrrrrrrrrrrrrr.....","..rrrrrrgrrggrrrr....","..rrrrrrrrrrrrrrgr...","..rrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrr..",".rgggrgrrrrrrrrgrrrr.",".rrrgrrgrrrrrrgrrrrr.",".rrrrrrrgggggrrrrrr..",".rrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrr...","..rrrrrrrrrrrrrrrr...","...rrrrrrrrrrrrrr....","......rrrrrrrrrr.....",".......rrrrrrr.......","....................."],"n":[".....................",".........2...........","........408..........","........918l.........","........96gd.........","........hEgl.........",".......hmbgld........",".......hm6bgl........",".......mm6ggl........",".......umebgll.......","......hmmrogll.......","......hmmjogtld......","...45.humrwgtll......","...98hhmmjjggll......","...zBuhmejjoglll.....","...eg8mmm6bgggll.....","..hegghme6bbggll.....","..uebgumejbggglll....","..uebtumejbgggtlld...","..urjtumejjogttlldd..","..urotuzzjwoottll8d..",".hurwgumzrwwotgll8ld.",".hmejgmmmrwbggglllll.",".hmebgmmejbooggglll..",".umebb99e6bbbgg8lll..",".mmeb6m9ebbbbgg8lll..",".umebm9m66bbbgggll...","..mebmm9e6bbbggggt...","...eoume66bbbgggt....","......m966bbbggB.....",".......e6bbboB.......","....................."],"a":[".....................",".........9...........","........999..........","........9899.........","........8899.........","........8798.........",".......887888........",".......987888........",".......877888........",".......8778788.......","......88778788.......","......887788788......","...99.877788788......","...897777788788......","...8857777887888.....","...7757777877888.....","..88757778877788.....","..887577788777888....","..8876677787777898...","..87766777877778898..","..87766776767778899..",".9877668766677888898.",".8877668766677888899.",".888767976667778888..",".888768977777778888..",".888779977777788888..",".89877987777778888...","..9877987777778788...","...87897777778887....","......9777777889.....",".......7777778.......","....................."],"hts":["000000000000000000000","000000000l00000000000","00000000kll0000000000","00000000klkk000000000","00000000kkkj000000000","00000000jjji000000000","0000000hiiiig00000000","0000000ghhhhg00000000","0000000ghhhgg00000000","0000000fggggfd0000000","000000ceffffed0000000","000000ceeffeedb000000","000cc0cddeeedcb000000","000ccabcddddccb000000","000bb9bbcccccba900000","000aa9abbbbbbaa800000","0089999aabbbaa9800000","00889899aaaaa98750000","007888899999988653000","006777788998887643200","005666678888776543200","035555566777665543210","024454456666655432100","023444445555544332100","022333344444443321000","012222334444333221000","001222233333332211000","000111222222222110000","000000122222211100000","000000011111110000000","000000001110000000000","000000000000000000000"],"obs":[[0.0,0.0,5.9],[-6.4,1.6,2.5]],"foot":[7,6],"kind":"stal"},"stal_c":{"w":21,"h":38,"ax":9,"ay":29,"m":[".....................","..........t..........",".........ttt.........",".........ttt.........",".........ttt.........",".........rrr.........","........rrrr.........","........rrrr.........","........rrrr.........","........rrrrr........",".......rrrrrr........",".......rrggrr........",".......rrrrrr........","......rrrrrrr........","......rrrrrrrg.......","......rrrrrrrg.......","......rgrrrrgr.......",".....rrrrgggrr.......",".....rrrrrrrrr.......",".....rrrrrrrrr.t.....","....rgrrrrrrrrtt.....","....rrrrrrrrgrtt.....","...trrgrrrrgrrrr.....","..ttrrrrrrrrrrrr.....","..rtrrrrrrrrrrrrrt...","..rrrrrrrrrrrrrrrt...","..rrrrrrrrrrrrrrrrr..","..rrrgrrrrrrrrgrrrr..","..rgrrgrrrrrgrrrrgr..",".rrrrrrrgggrrrrrrrr..",".rrrrrrrrrrrrrrrrrr..",".rrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrr.",".....rrrrrrrr....rr..","......rrrrrr.........","........rr...........","....................."],"n":[".....................","..........0..........",".........408.........",".........938.........",".........mbO.........",".........mol.........","........umjt.........","........umbt.........","........ueot.........","........meotl........",".......hmmotl........",".......ummotl........",".......umeotl........","......hmmeogl........","......hmmjogll.......","......umejogty.......","......umejogty.......",".....humejooty.......",".....huurjottl.......",".....ummzEwttl.5.....","....hhmmrjwttl98.....","....hhmmmjottlml.....","...0hhmeejogttmg.....","..Pbummmejbggleg.....","..ub8mmmebbgtlegy1...","..mblummebggttrolM...","..mblummrjoBttrolel..","..mjtumzrjottgrolel..","..mjtmzzrwBBtgjourt..",".umjtmmmrwottgjgurt..",".umjgmmmebgtgljgurt..",".umjbmeeebggggjgmrtl.",".umj699eebggggegmegl.","..m6emeeebggggEJmegt.",".....mme6bggg....rB..","......Ue6bgt.........","........EJ...........","....................."],"a":[".....................","..........9..........",".........999.........",".........989.........",".........879.........",".........779.........","........8779.........","........8778.........","........8777.........","........77778........",".......887778........",".......887778........",".......887878........","......8887778........","......87878788.......","......87888778.......","......87888778.......",".....887888778.......",".....887877778.......",".....887777778.8.....","....888787777778.....","....887788877768.....","...9777788877767.....","..88677788877767.....","..8757778887776779...","..8756778888766678...","..87667788877666678..","..97767788887666678..","..97767788887666677..",".887767788887666677..",".887767788888776777..",".9877777788887767678.",".9777777788997767678.","..777777788987777778.",".....77778998....77..","......778899.........","........88...........","....................."],"hts":["000000000000000000000","0000000000r0000000000","000000000rrr000000000","000000000qrq000000000","000000000qqq000000000","000000000opo000000000","00000000noon000000000","00000000mnnn000000000","00000000mmmm000000000","00000000llmlk00000000","0000000jkllkj00000000","0000000ijkkji00000000","0000000ijjjji00000000","000000ghiiiih00000000","000000fghhhhgf0000000","000000fgghhgge0000000","000000efggggfd0000000","00000bdeffffec0000000","00000acdeeeedb0000000","00000acdddddcb0a00000","00008abcccccbaaa00000","000089abbbbba99900000","000989aaabaaa98800000","00897899aaa9988800000","007878899999877768000","006767888888776657000","006666778887755556600","005555667776645446500","004444556665544445500","023433445554433334400","012333344443322223300","012222333333221122210","001112223322211112110","000011122221100001100","000000111111000000000","000000011110000000000","000000000000000000000","000000000000000000000"],"obs":[[0.0,0.0,5.1],[5.6,1.2,2.0],[8.8,3.4,1.4],[-5.2,2.4,1.8]],"foot":[6,6],"kind":"stal"},"stal_d":{"w":19,"h":28,"ax":8,"ay":20,"m":["...................",".......ttt.........",".......ttt.........",".......ttt.........",".......rrrr........","......rrrrr........","......rggrr........","......rrgrr........","......rrrrr...t....",".....rrrrrrr.ttt...",".....rrrrrrr.ttt...","....rrrrrrrrrrrr...","....rrrgrgrrrrrrr..","....rrrrrrrrrrrrr..","...grrrrrrrrrrrrr..","...rrrrrrrrrrrrrr..","...rrrrrrrrrrrrrr..","..rrrrrrrrrrrgrrrr.",".rrrrrrrrrrrrrrrrr.",".rrrrrggrgrrrrrrrr.",".rrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrr..","...rrrrrrrrrrrrr...","....rrrrrrrr.......",".....rrrrrrr.......",".........r.........","..................."],"n":["...................",".......h18.........",".......h18.........",".......h6g.........",".......m6gl........","......hmegl........","......hmjgl........","......hmjgl........","......umjgt...0....",".....ummjoty.93d...",".....ummjotl.mbl...","....hummjotlhebl...","....hhmejotl9egll..","....hhmejotl9ebll..","...hummejggl6ebgl..","...uummejbgl6ebgl..","...uumeejbgtejogt..","..huumeejottejottl.",".hhuummrjottmrotll.",".9hhmmrrjottejogll.",".Chhmmrrwottjjbgll.","..h9mmerjoglbjbg8T.","..u99eeejbgl86638..","...99eee6bg8gj6g...","....9e6e6bg8.......",".....Ue66b8t.......",".........R.........","..................."],"a":["...................",".......999.........",".......999.........",".......989.........",".......8788........","......98788........","......87788........","......87778........","......87779...9....",".....8776788.899...",".....8776787.889...","....987777875778...","....9877778857788..","....9877777867788..","...89777677867778..","...98777777967778..","...98777777867777..","..8987777778667778.",".89987767778677778.",".99987766777667778.",".99977766777677778.","..9977766677677788.","..988776677878878..","...8877777787887...","....87777778.......",".....7777787.......",".........8.........","..................."],"hts":["0000000000000000000","0000000ijj000000000","0000000iii000000000","0000000hii000000000","0000000ghgg00000000","000000fgggf00000000","000000efffe00000000","000000eefee00000000","000000deeed000a0000","00000bcdddcb0aaa000","00000abcccba0aa9000","00008abbbbb98998000","000089aaaaa98888700","0000799aa9987777600","0005788999887777600","0005678888876666500","0004677777765555400","0023566777665554420","0013456666554443310","0012345555543333210","0012334444432222110","0001233333321111100","0001122222221111000","0000111222210000000","0000011111110000000","0000000011000000000","0000000000000000000","0000000000000000000"],"obs":[[0.0,0.0,4.6],[5.6,-0.8,3.1]],"foot":[5,5],"kind":"stal"},"column_a":{"w":22,"h":55,"ax":11,"ay":44,"m":["......................","......r...r...r.......","......................","....r...r...r...r.....","......................","......r.r.r.r.r.r.....",".....r.r.r.r.r.r......",".....rr.rrr.rrr.r.....",".....r.r.r.r.r.r.r....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rgrrrrrrrrrr.....",".....rrgrrrrrrrrr.....",".....rrrrgrrrgrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrg.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrgrr.....",".....rrrggrrggrr......",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrgrrrrrrrrr.....",".....rrrrgrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rgrrrrrrrrrr.....","....rrrrggrrrrrrrr....","....rrrrrrggrrrrgrr...","...rrrrrrrrrrrrrgrr...","..rrrrgrrrrrrrrgrrrr..","..rrrrrgrrrrrrgrrrrr..","..rrrrrrrggggrrrrrrr..",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrgrrrrrrrrrrrrrrr.",".rrrrrgrrrrrrrrrrrrrr.",".rrrrrrrggrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrrr..","..rrrrrrrrrrrrrrrrrr..","...rrrrrrrrrrrrrrrr...","....rrrrrrrrrrrrr.....",".......rrrrrrrr.......","......................"],"n":["......................","......u...R...B.......","......................","....u...m...o...t.....","......................","......m.e.j.b.g.t.....",".....H.m.r.j.g.t......",".....uH.rrj.oBB.G.....",".....u.H.r.w.B.G.l....","....uuuHMMEJJOBtly....","....uuuzzMMJJBttll....","....uumzzEEJBBttly....",".....ummrrrwoottt.....",".....ummerjjoogtt.....",".....uumejjjoottG.....",".....uuzrrjwootty.....",".....uHzzErwooBGl.....",".....uuHMEEwwBOGl.....",".....uuHMMEEJOGtl.....",".....umzzMEJJBttl.....",".....ummzrEwBBttl.....",".....ummerjwoottt.....",".....ummerjjoottG.....",".....uumerjjogttG.....",".....uHzrrjjootG......",".....uHHzrwwoBGGl.....",".....uuHzMEEJOGGl.....",".....huzzMEEJBBtl.....",".....humzzEwBBttl.....",".....uumzrrwoottl.....",".....uummrjjogttl.....",".....ummeejjogttt.....",".....uumeejjogttG.....",".....uuzmrjjootty.....","....huuzzrrooBtGll....","....huuzzzEwBBttlli...","...4huuzzzEJJBttll5...","..4hhhmmzzEwBBttlldd..","..4uhhmmmrrwootglldd..","..4uhmmmmrjjogggllyd..",".chuummmeejjogggllldd.",".4huummeeejbbbggllldd.",".4huummeeejbboggtlldd.",".9hhummeeejbbgggtlldd.",".99huummeejboogttll88.",".999hmmmrrjjooBttll88.",".9999mmrrrwwooogg888l.",".h9999eeejjjooggg888l.","..9999eeeejbbggg8888..","..999966ee6bbg333888..","..h91666666633333388..","...9116666663333338...","....e66666663333b.....",".......ee6633bg.......","......................"],"a":["......................","......0...0...0.......","......................","....1...0...0...0.....","......................","......0.0.0.0.0.1.....",".....3.0.0.0.0.1......",".....52.000.111.4.....",".....6.2.1.1.2.3.6....","....86532112234457....","....86653323444567....","....87654334444567....",".....865444455567.....",".....866655555667.....",".....876755556677.....",".....877766666778.....",".....878866666778.....",".....879866677789.....",".....878876677789.....",".....878866667779.....",".....878866667779.....",".....888866667779.....",".....888776667779.....",".....888776677779.....",".....88877667779......",".....888776677798.....",".....888776677898.....",".....878777677898.....",".....878777677899.....",".....878777667999.....",".....877777677999.....",".....877776677899.....",".....877776667899.....",".....877776677798.....","....88777666778988....","....987777667789889...","...9987777677778889...","..998887776677789999..","..998877776677789899..","..988877776677789899..",".98888777776777799999.",".99888877777777789999.",".99898777777777779899.",".98998777777777778899.",".99898777767777778899.",".99999777666777778889.",".99999877666777778899.",".99999777666777778899.","..999977766677777899..","..999977776677778899..","..999977777777788899..","...9998887777888899...","....9988888888888.....",".......88888888.......","......................"],"hts":["0000000000000000000000","000000z000z000z0000000","0000000000000000000000","0000z000z000z000z00000","0000000000000000000000","000000z0z0z0z0z0z00000","00000z0z0z0z0z0z000000","00000zz0zzz0zzz0z00000","00000z0z0z0z0z0z0z0000","0000zzzzzzzzzzzzzz0000","0000yzzzzzzzzzzzzz0000","0000yzzzzzzzzzzzzy0000","00000zzzzzzzzzzzz00000","00000yzzzzzzzzzzy00000","00000xyzzzzzzzzyx00000","00000vxyzzzzzyyxv00000","00000tvxyyyyyyxws00000","00000suwwxxxxwwus00000","00000rtuvvwwwvutr00000","00000rstuuuuuutsr00000","00000qrssttttssrq00000","00000pqrssssssrqp00000","00000oqqrrrrrrqqo00000","00000npqqqqqqqppn00000","00000knpppqqpppn000000","00000jmnopppponmj00000","00000ikmnnnonnmli00000","00000ijllmmmmllki00000","00000hjkkllllkkjh00000","00000hijjkkkkjjih00000","00000ghiijjjjiihg00000","00000fghiiiiiihgf00000","00000dgghhhhhhgge00000","00000cfgggggggfec00000","00008bdfffggffedb90000","00008acdeeffeedca80000","00018abcddddddcba81000","001389abccccccba982000","001489aabbbbbba9973100","00147899aaaaaa99874100","0014788999999998864100","0124678889999888764210","0123567788888877653210","0123466777777776643210","0122456666776665542110","0112345556666555432110","0012234455555544332100","0011233344444433322100","0011222333333332221100","0001122222332222211000","0001111222222211111000","0000111111111111110000","0000000111111110000000","0000000000000000000000","0000000000000000000000"],"obs":[],"foot":[9,8],"kind":"stal"},"column_b":{"w":22,"h":57,"ax":11,"ay":46,"m":["......................",".....r...r...r...r....","......................",".....r.r.r.r.r.r.r....","......................",".....r.r.r.r.r.r.r....","....r.r.r.r.r.r.r.....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrkr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrkr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rgrrrrrrrrrrrr....",".....rgrrrrrrrrgrr....",".....rrgrrrrrggrr.....",".....rrrrrggggrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....","....rrrrrrrrrrrrrr....","....grrrrrrrrrrrrr....","....grrrrrrrrrrrrr....","....rrrrrrrrrrrrrr....","....rrrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....","....rrrrrrrrrrrrrr....","....rrrrggrrggrrrr....","...rrrrrrrrrrrrrrrr...","..rrrrrrrrrrrrrrrrr...",".rrrrrrrrrrrrrggrrrr..",".rrrrrrrggrrgggrrrrr..",".rrrrrrrrrrgrrrrrrrr..",".rrrrrrrrrrrrrrrrrgrr.",".rrrrrrrrrrrrrrrrrrrr.",".rrrrrrrrrrrrrrrrgrrr.",".rrrrrrrrrrrrrrrgrrrr.",".rrrrrrrrrrrrrgrrrrrr.",".rrrrrrrrrggggrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.","...rrrrrrrrrrrrrrrrr..","....rrrrrrrrrrrrrrr...","....rrrrrrrrrrrrrr....",".....rrrrrrrrrrr......","......rrrrrrrr........","......................"],"n":["......................",".....H...j...o...l....","......................",".....u.z.z.w.B.G.l....","......................",".....u.z.M.J.B.t.l....","....h.m.z.E.B.g.l.....","....uummmrjjoogttt....","....ummmerjjoogttG....","....HummeejjoogttG....","....uHzmmrjjoottGl....","....uHHzzrjjooBGGl....","....huHzzzEwJBOGtl....","....uuHzMMEJJBBttl....","....uuuzMMEJJBtttl....","....uummzrEwoBttll....","....ummmmrjjoottll....","....uummmejbogtttG....",".....ummmrjjoogtt.....",".....HuzmrjwoottGy....","....uuHzzrwwoBBGGl....","....uuHHzEEwJBBGtl....","....huHHMMEJJBBtll....","....uummzMEEJBttll....","....uummmrjwootttl....",".....ummmrjoootttt....",".....uummrjooottt.....",".....uumerjooottG.....",".....HHzrrwwooBty.....",".....uHHzEEwBBBGl.....","....uuHHMMEJJBBGll....","....uuuzzMRJJBBtly....","....uumzzEEEBBttly....","....uummrrrwoottly....","....uummerjjoggtt.....",".....ummeejbbogtt.....","....huummejboottGd....","....huHzzrjjoottGl....","...hhuHzzzrwBBBttll...","..chhuuzzzEJJBBtlld...",".chhhumzzMEJJBttlllq..",".hhhhummzrEwwottllld..",".hhhhhmmerjjooggllll..",".huhhhmmeejjbggggllll.",".hhhhhmee66bbggggllld.",".hhhum9ee66bbbgggglld.",".hhummmee66bbggggtlld.",".hhummmee66bbggggtlld.",".hhuummeejjjogggttgld.","..hmummejjjjooottgg8d.","..h9mmmejjjjoooggg888.","...99mmejjjjjoogg888..","....99eebjjbbbgg88g...","....99e6666bbb338g....",".....9666666333g......","......ejbjjbbb........","......................"],"a":["......................",".....0...0...0...0....","......................",".....0.0.0.0.0.0.1....","......................",".....1.0.0.0.0.0.2....","....2.1.0.0.0.0.2.....","....32211000011223....","....32221100112234....","....43322111222345....","....74433212223457....","....75543223334568....","....76654323344678....","....87665434556788....","....87666545667898....","....88766555678898....","....87776666788998....","....87777766788998....",".....777777778889.....",".....8777776788888....","....98777766788888....","....99777766788888....","....99777766788788....","....99777766777788....","....99777766777788....",".....8777766777788....",".....877776677778.....",".....877776667778.....",".....877776667778.....",".....877766667778.....","....98777766777789....","....98777776777789....","....98777666777789....","....98877666677888....","....9787766667778.....",".....798776677778.....","....88987767777789....","....88987767777789....","...8888877667777899...","..98888877777777899...",".9888888777677778898..",".9888887766667778899..",".9888887766677779889..",".88898888677777788899.",".88898898777777778889.",".88988898777777777889.",".98987798777777777889.",".98987788777777777889.",".99987788777777777889.","..9887788766777777889.","..9887788766777777889.","...88878876677777789..","....887887667777788...","....88888877777788....",".....88998777778......","......89987788........","......................"],"hts":["0000000000000000000000","00000z000z000z000z0000","0000000000000000000000","00000z0z0z0z0z0z0z0000","0000000000000000000000","00000z0z0z0z0z0z0z0000","0000z0z0z0z0z0z0z00000","0000zzzzzzzzzzzzzz0000","0000zzzzzzzzzzzzzz0000","0000zzzzzzzzzzzzzz0000","0000zzzzzzzzzzzzzz0000","0000zzzzzzzzzzzzzz0000","0000zzzzzzzzzzzzzz0000","0000zzzzzzzzzzzzzy0000","0000yzzzzzzzzzzzzy0000","0000xzzzzzzzzzzzyx0000","0000wyzzzzzzzzzyyx0000","0000vxyyzzzzzzyyxw0000","00000wxyyyyyyyyxw00000","00000uwxxxyyxxxwvr0000","0000qsvwwxxxxwwvtq0000","0000prtuvwwwvvutrp0000","0000prstuuuuuutsrp0000","0000oqrssttttssrqo0000","0000opqrrrsssrrqpo0000","00000opqqrrrrqqpon0000","00000noppqqqqqpoo00000","00000mooppppppoom00000","00000kmooooooonmk00000","00000jlmnnnnnnmlj00000","0000giklmmmmmlljig0000","0000fhijklllkkjihf0000","0000fhiijjjjjjihgf0000","0000eghhiiiiiihhge0000","0000dfghhhhhhhhgf00000","00000efggghhgggfe00000","00008deffggggffed80000","00008bdeffffffedc80000","00058acdeeeeeedca86000","001689bccddddccb986000","002679abbccccbaa976000","0136789aaabbaaa9876100","0135678999999998876200","0135678889999888765200","0134567788888877665210","0124566777777776654210","0123456667777666554210","0113445666666655443210","0012344555555554432210","0011234444554444322110","0001223344444333221100","0000122333333322211100","0000112222222221110000","0000011111111111000000","0000001111111100000000","0000000000000000000000","0000000000000000000000"],"obs":[],"foot":[9,9],"kind":"stal"},"column_c":{"w":22,"h":53,"ax":11,"ay":42,"m":["......................","......r...r...r.......","......................","....r.r.r.r.r.r.r.....",".....r.r.r.r.r.r......","......rrr.rrr.rrr.....",".....rrr.rrr.rrr......",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....","....rrrrrrrrrrrrr.....","....rrrrrrrrrrrrkr....","....rrrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrgrrrrrrrrr.....",".....rrrrgrrrrrrr.....","....rrrrrrrrrrrrgr....","....rrgrrrrrrrrrrr....","....rrrgrrrrrrrrr.....",".....rrrggrrrgrrr.....",".....rrrrrrgrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrrrrrrrrrr.....",".....rrrgrrrrgrrr.....","....rrrrrrrrrrrrr.....","....rrrrrrrrrrrrg.....","....rgrrrrrrrrrrr.....",".....rgrrrrrrrrrr.....",".....rrgrrrrrrrrr.....",".....rrrrgrrrrrrkr....","....rrrrrrrrrrrrrr....","...rrrrrrrrrrrrrrr....","...rrrrrrrrrrrrrrrr...","..rrrrrrgrrrrrrrrrg...",".rrrrrrrrrrrrrrrrrgr..",".rrrrrrrrrrrrrrrrgrr..",".rrrrrrrrrrrrrrrrgrr..",".rrrrgrrrrrrrrrrgrrrr.","..rrrrgrrrrrrrrgrrrrr.","..rrrrrrgrrrggrrrrrrr.","..rrrrrrrrrrrrrrrrrrr.","..rrrrrrrrrrrrrrrrrr..","...rrrrrrrrrrrrrrrrr..","....rrrrrrrrrrrrrrr...","....rrrrrrrrrrrrrr....","......rrrrrrrrrrr.....",".......rrrrrrrr.......","........rrr...........","......................"],"n":["......................","......u...E...t.......","......................","....u.m.m.E.o.t.l.....",".....u.m.r.o.g.t......","......mmm.joo.gtt.....",".....umm.rjo.gtt......",".....HHzrrjjootGG.....",".....uHzzrEwoBBGl.....",".....uHHzEEEJBtGl.....","....huuzzEEJJBttl.....","....uuuzzzwwBBttly....","....uuummzrooottl.....",".....ummmrrooggtt.....",".....ummerjjogttt.....",".....ummmrjjogttG.....",".....uHmmrjjootGG.....",".....uHzzrjwoBBGl.....",".....uHHzEEwJBOtl.....","....uuuzHMEJJBttll....","....uuuzzMEJJBttll....","....uummzzEwottll.....",".....ummerrjoggtl.....",".....ummerjjoggtt.....",".....ummmejjogttG.....",".....HuzrrrjooBty.....",".....uHzzrrwBBBGy.....",".....uHzMMEJBBBtl.....","....uuuzzMEEJBBtl.....","....uhmzzEEJwBttl.....","....uummzrwwoBttl.....",".....ummmrjjoottl.....",".....ummmejboogtt.....",".....ummerjboggttl....","....huHzzrrooogtGl....","...hhuHzzrEwooBGtl....","...hhuuzzEEwJBBttll...","..hhhuuzzrEwJBBtlld...",".hhhhhmmzEEwBBttllld..",".hhhhhmmmrwwoogtllll..",".hhhhmmmeejoogggllll..",".hhhhmmmeejbbggggllll.","..hhmmmeeebbbbgggllld.","..hhmmmee6bbbbgggllll.","..hummmee6bbbggggll8l.","..uhmmmee6bbbggggll8..","...hmmmee6bbbggggggt..","....mmmmebbbbbggggt...","....ummmebbbbbgggt....","......99ebbbbbggg.....",".......966bbbgo.......","........ebo...........","......................"],"a":["......................","......0...0...0.......","......................","....2.0.0.0.0.0.1.....",".....1.0.0.0.0.1......","......210.000.112.....",".....322.001.122......",".....532111112235.....",".....643221223346.....",".....654322234457.....","....9765433334668.....","....87655444456788....","....8876554555789.....",".....877665566899.....",".....877766667899.....",".....877776677899.....",".....877776677799.....",".....877776667788.....",".....887776677799.....","....98877767777998....","....88877777777998....","....8977777667798.....",".....977776667798.....",".....977777677798.....",".....977767767798.....",".....977767667798.....",".....977766677788.....",".....987776677788.....","....9987776677778.....","....9987787677778.....","....9987887677778.....",".....977888677778.....",".....977888777778.....",".....9778887777788....","....89778887777789....","...898878887677789....","...8988788876787889...","..99988788876787889...",".9899877878778778889..",".9898877778778778889..",".8898877777778778888..",".88888777777788788889.","..8888777878788788889.","..9887777777778777888.","..8887777777778778888.","..887777777777877888..","...87777777777777788..","....877877777777777...","....77797777777777....","......89777778777.....",".......98777888.......","........877...........","......................"],"hts":["0000000000000000000000","000000z000z000z0000000","0000000000000000000000","0000z0z0z0z0z0z0z00000","00000z0z0z0z0z0z000000","000000zzz0zzz0zzz00000","00000zzz0zzz0zzz000000","00000zzzzzzzzzzzz00000","00000zzzzzzzzzzzz00000","00000yzzzzzzzzzzy00000","0000wyzzzzzzzzzzy00000","0000vxyzzzzzzzzyxv0000","0000vwxyzzzzzzyxw00000","00000wxxyyyyyyxxw00000","00000vwxxxyyxxxwv00000","00000uvwwxxxxwwvu00000","00000suvvwwwwvvus00000","00000qtuvvvvvvutq00000","00000prttuuuuttrp00000","0000npqrsttttsrqpn0000","0000nopqrrssrrqpon0000","0000mnopqqqqqqpoo00000","00000nooppppppoon00000","00000mnoooooooonm00000","00000lmnnnooonnml00000","00000jlmmnnnnmmlj00000","00000hkllmmmmllkh00000","00000gijkllllkjig00000","0000eghijjkkjjihg00000","0000efghiiiiiihgf00000","0000dffghhhhhhgfe00000","00000effggggggffe00000","00000deffffffffed00000","00000bdeefffeeedc60000","00007acddeeeeddcb60000","000579bccdddddcb970000","0005689bbccccbba874000","00256789abbbba99765000","0134678899aa9988765100","0134567888988887654200","0124566778887776654300","0123456677777666544210","0023455666666665543210","0012345556665554432210","0012334455555544332100","0001233444444443321100","0001123334433332211000","0000112233333222110000","0000011222222211100000","0000001112111111000000","0000000111111000000000","0000000000000000000000","0000000000000000000000"],"obs":[],"foot":[8,8],"kind":"stal"}};/*CAVE_SPR_END*/
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
  if(d.k==='column') return CAVE_SPR[['column_a','column_b','column_c'][d.s%3]]||null;
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
    occGY=gy; dpf(X,Y,c); }
  occGY=null;
  // 床との境：底の輪郭の下に最暗を1列、ランタンと反対の側だけ2〜3ドットの網の影
  let edgeX=-1, edgeY=0;
  for(let x=0;x<W;x++){ let b=-1; for(let y=H-1;y>=0;y--) if(D.m[y*W+x]){ b=y; break; } if(b<0) continue;
    dpf(x0+x,y0+b+1,P_.lime[0]); if(edgeX<0||(away>0?x>edgeX:x<edgeX)){ edgeX=x; edgeY=b; } }
  if(edgeX>=0) for(let q=1;q<=3;q++) for(let r=-1;r<=1;r++){ const X=x0+edgeX+away*q, Y=y0+edgeY+r; if(((X+Y)&1)||q-Math.abs(r)>2) continue; dpf(X,Y,P_.lime[0]); }
}
/*RUIN_BIG_BEGIN*/const RUIN_BIG={"fallen_a":{"w":71,"h":46,"ax":30,"ay":33,"sink":3,"fp":[-27,-14,38,9],"rows":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................2650............",".......................................................16650...........",".......................................................1566550.........",".......................................................15566650........",".......................................................155566650.......",".......................................................1555556660......",".......................................................116665566660....",".......................................................266666556320....",".....................................................26666666655210....","....................................................266666666655210....","..................................................26666666666655220ssss","................................................2666666666666556220ssss","...............................................26666666665555546220ssss","............................................26666666666554444445120ssss",".........................................26666655665555544444444220ssss","......................................26666666545555444444333334220ssss","...................................26626666656333335333333333333220ssss","................................26666564566544442335222222222223220ssss",".............................26666666652646443323334211222122223220ssss",".........................26666265666553533533331232311111110000ba10ssss","......................2666666564466544343333222aa310000000ossss000o....","...................2226566666551345433333322122aa0osssssss.............",".................2666556666655343253332132121000osssss.................",".................166562666544424334222212000osssss.....................",".................16663536454333333222221ossssss........................",".................154435352433322b222100osssss..........................",".................14433334242222ab000ossss..............................","................2433332332322220osssss.................................","............0...143222aab22200osssss...................................","........255550..12221210a00osssss......................................","........166660..111100osossss..........................................",".....255333330ss000osssss..............................................","....c664bbbbb0ssssssss.................................................","....0aa100000os........................................................",".....00os..............................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"hts":["00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000eeee000000000000","0000000000000000000000000000000000000000000000000000000deeee00000000000","0000000000000000000000000000000000000000000000000000000cdeeeee000000000","0000000000000000000000000000000000000000000000000000000bcddeeee00000000","0000000000000000000000000000000000000000000000000000000abccdeeee0000000","00000000000000000000000000000000000000000000000000000009abbcdeeee000000","00000000000000000000000000000000000000000000000000000008abbbcdeeeee0000","0000000000000000000000000000000000000000000000000000000aabbbbcddedd0000","000000000000000000000000000000000000000000000000000009aaaabbbbccdcc0000","00000000000000000000000000000000000000000000000000009aaaaaaaaabbcbb0000","0000000000000000000000000000000000000000000000000099999aaaaaaaaabaa0000","0000000000000000000000000000000000000000000000008999999999999999a990000","00000000000000000000000000000000000000000000000789999999888888889880000","00000000000000000000000000000000000000000000788888888888888887778770000","00000000000000000000000000000000000000000888888877788777777777777660000","00000000000000000000000000000000000000888888887777777776666666666550000","00000000000000000000000000000000000888788887777766666666655555555440000","00000000000000000000000000000000888888777777776666555555544444444330000","00000000000000000000000000000788888888767666666555544444333333333220000","00000000000000000000000008888878887777766666555444443332222221112110000","00000000000000000000008888888877777776665555544333322111110000011000000","00000000000000000007778888888776766666654444433222000000000000000000000","00000000000000000888877888777776666555543333222100000000000000000000000","00000000000000000888876777776666555544432221000000000000000000000000000","00000000000000000877777676666655444433320000000000000000000000000000000","00000000000000000777766566655554333322100000000000000000000000000000000","00000000000000000766665455544443222100000000000000000000000000000000000","00000000000000006665554444433322000000000000000000000000000000000000000","00000000000030005555443333322100000000000000000000000000000000000000000","00000000333333004444332121100000000000000000000000000000000000000000000","00000000333333003333220000000000000000000000000000000000000000000000000","00000222333332002220000000000000000000000000000000000000000000000000000","00002222222222000000000000000000000000000000000000000000000000000000000","00001111111110000000000000000000000000000000000000000000000000000000000","00000110000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000"],"n":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................9000............",".......................................................z9000...........",".......................................................zzm0000.........",".......................................................uzum1000........",".......................................................zuzzz9000.......",".......................................................zmhuzm9000......",".......................................................z4411uum0003....",".......................................................41111ezzmoBB....",".....................................................44111166zumBBB....","....................................................4111166666zzBoo....","..................................................411116666666zzoBo....","................................................4011116666bbbbbzooB....","...............................................umm33336bbbbbbbbzBoB....","............................................409006e33bbbbbbbjjjzooB....",".........................................200016m33mbbbbbbjojjjozoBB....","......................................29100333ezd36jbbboooowwwwroBo....","...................................291ze633333d6zbgzooooowwwwwwwooB....","................................2000011z8e3bbbbjzgojoowwwwwwwwwrBoo....",".............................m99103333ezmbbgbbojzlojoBwJJJJJJJJzBoB....",".........................22091ze63333b8bzljoooooowoEJJJJJJJJRJJzBoB....","......................410000363z863bbbgjzojooooBBwJEWRRRRRR....mooB....","...................4uzm1133338ezmjbbboojzjroBBBEzJR....................",".................00095z6e333bbbgzljoooowzEEBJJJWz......................",".................0333ezzd6bbbbljztjoooowzJEJJ..........................",".................33333bzbjbgoogrzoroBBBEz..............................",".................3bbbgjzzjooooorzBEBJJOR...............................",".................bbggojzztwoooBEzOJJW..................................","................3boooowzztwBBBBEM......................................","............2...gjoooowzzGwJJJR........................................","........000005..owoBBBEzzEJW...........................................","........001368..BEBJJOR.M..............................................",".....000wwwwwt..OJJW...................................................","....m00gwwwwwB.........................................................","....uzwBwwwwwB.........................................................",".....wwB...............................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"k":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................9766............",".......................................................69666...........",".......................................................6686666.........",".......................................................66677667........",".......................................................666669666.......",".......................................................6786669666......",".......................................................688896686664....",".......................................................888888667000....",".....................................................78888888666000....","....................................................788887877766000....","..................................................77888777777766000....","................................................8777777777666666000....","...............................................78777767666666556000....","............................................86975986665665555556000....",".........................................66669876575554544444436000....","......................................59866665821576444443333335000....","...................................69869966555076427222222232222000....","................................66766876385444372246111111111111000....",".............................79986665582765333212034000000000006000....",".........................666986996555506205222200203000000000006000....","......................8766666866284443262251100000000000000....7000....","...................86699766653827643332521100000200....................",".................66693688555546320522211211000001......................",".................6664826074444062051000120000..........................",".................565545267433315211000001..............................",".................55441726132210120100000...............................",".................43332626031000120000..................................","................14322112202000001......................................","............6...052110122000000........................................","........667762..340000122000...........................................","........677770..0100000.1..............................................",".....646233330..0000...................................................","....8661333330.........................................................","....6200123330.........................................................",".....310...............................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"obs":[[22.4,-7.0,4.8],[17.5,-5.5,4.8],[12.6,-3.9,4.8],[7.6,-2.4,4.8],[2.7,-0.8,4.8],[-2.2,0.7,4.8],[-7.1,2.2,4.8],[-12.0,3.8,4.8],[-17.0,5.3,4.8]],"cap":[22,-7],"brk":[-17,5]},"fallen_b":{"w":71,"h":42,"ax":32,"ay":26,"sink":3,"fp":[-28,-9,35,12],"rows":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","....................260................................................","........260..20..26665630..............................................",".....263454355635166654244660..........................................","....25630056666226664622166666340..............................2550....","....1550ss1556221666452446666434546660........................25520....","....0b4oss12552b6666432556666534466666430....................255210....",".....0o...000ba0155542216666561666666452446660..............2542110....",".............0o.004432216566452466665622566666340..20.....265521110....","..................0000015456343366664524466665635566666662654211120....","......................s00045232366664325566665366666666662252222120....","..........................00002254554221666646366666666661522122120....",".............................s000344baa1666635466666666665522122220....",".................................000000a555633556666666665421122220....","......................................s004452b455566666665311112220ssss","........................................s0000a344455666665521112210ssss",".............................................00003445566655221122aossss",".................................................000445555521111aosssss","....................................................00455552111aossssss","......................................................00554211aosssssss","........................................................15411aosssssss.","........................................................0c520osssss....",".........................................................00osss........",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"hts":["00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000777000000000000000000000000000000000000000000000000","00000000222003300777777760000000000000000000000000000000000000000000000","00000222222233334667777667777000000000000000000000000000000000000000000","000022221123333356666665777777776000000000000000000000000000000dddc0000","00002222002333325555565566677776777777000000000000000000000000dddcc0000","0000111000122222444555455666666677777777600000000000000000000dddcbb0000","000000000001111133344434555556566667777667777700000000000000dddcbaa0000","0000000000000000222333244445554556666665777777777008800000cdddcba990000","000000000000000000111213333444445555565566777777778889999cdddcba9880000","00000000000000000000000112233334444555456666666777888899adddcba98770000","00000000000000000000000000112222334444355556666667778889acccba987660000","000000000000000000000000000000012223332444555556667777889bbba9876550000","000000000000000000000000000000000111221333444455566677789aaa98765440000","00000000000000000000000000000000000000022233334445556677899987654330000","00000000000000000000000000000000000000000112223334455566788876543220000","00000000000000000000000000000000000000000000011223344455677765432100000","00000000000000000000000000000000000000000000000000223345566654321000000","00000000000000000000000000000000000000000000000000002233455543210000000","00000000000000000000000000000000000000000000000000000012344432100000000","00000000000000000000000000000000000000000000000000000000233321000000000","00000000000000000000000000000000000000000000000000000000122210000000000","00000000000000000000000000000000000000000000000000000000011000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000"],"n":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","....................008................................................","........000..00..111134tt..............................................",".....00rrro10000h66661tt18102..........................................","....h00lrrm1000teeeebettb9111080t..............................000l....","....rjjy..zrrrttreeejote66661b1t300002........................000tt....","....rEwy..zrzrtzrrrrrttjheee69thb111130tl....................000ttt....",".....EE...zrrrttzrrrmttwmeeeb9tbh66663gt130002..............003tttt....",".............zB.MMMEzttwrrrrojtoeeeeb9ttb1111080t..22.....0003ttttt....","..................UMJttwzrrrwBtjeeeebbte66666b131011111441008tttttt....",".......................RHMMzwttwrrrrrttjhee669t6161111119e18ttttttt....","..........................MMJJtwzrrrmttweeeeb9b66eee99999rrtttttttt....","..............................OJMMEEzttwrrrrojjeheeeee99urrtttttttt....",".................................MMMJttwrrrrwtjemeeeeee9urrtttttttt....",".......................................JMMzrwtrrrrrmmmmmurrtttttttt....",".........................................UMMJBEEzzzzzmmmurrtttttttt....",".............................................RJMBMzzzzmmurrtttttttt....",".................................................BMMzzzzurrttttttt.....","....................................................MMzzurrtttttt......","......................................................Uzurrttttt.......","........................................................urrtttt........","........................................................urrttt.........",".........................................................rrt...........",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"k":[".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................",".......................................................................","....................652................................................","........666..66..88884800..............................................",".....665562766668888780083765..........................................","....86605598766088884900498876240..............................6661....","....6550..6567007788510978888480567654........................66600....","....5340..6565066676700588887909588875500....................765000....",".....13...666601455570048888490698887600847654..............6740000....",".............50.234350026677450488885900498876240..55.....766400000....","..................0100015556400478885409888884867688888887664000000....",".......................03344100467777005888879078988999998730000000....","..........................01000155657003888849688999999995500000000....","..............................0023445002777745587889999965600000000....",".................................0010001566640688888999965500000000....",".......................................0334420666777888865500000000....",".........................................01200444566778865500000000....",".............................................0020245667765500000000....",".................................................01245666550000000.....","....................................................1355655000000......","......................................................2465600000.......","........................................................6550000........","........................................................655000.........",".........................................................650...........",".......................................................................",".......................................................................",".......................................................................",".......................................................................","......................................................................."],"obs":[[21.5,5.7,4.4],[16.9,4.5,4.4],[12.2,3.2,4.4],[7.5,2.0,4.4],[2.8,0.8,4.4],[-1.9,-0.5,4.4],[-6.5,-1.7,4.4],[-11.2,-3.0,4.4],[-15.9,-4.2,4.4]],"cap":[21,6],"brk":[-16,-4]},"fallen_c":{"w":66,"h":35,"ax":29,"ay":25,"sink":3,"fp":[-25,-9,33,6],"rows":["..................................................................","..................................................................","..................................................................","..................................................................","..................................................................",".......................................................20.........","......................................................2660........","......................................................1660........","......................................................15660.......","......................................................156650......","......................................................165660......",".....................................................26665660.....","...................................................2666665640.....","................................................2666666666530.....","..............................................266666666666520..sss",".............................................2666666666666530sssss",".....................................266666556666665566666530sssss","..................................246666664635565555555555410sssss","..........................26666656456666664624564444444445520sssss","...................2650.2466666646365655544433454333443444420sssss","..................2446524566666545353544444333333233333333420sssss",".................24446363646555444342433333133220000022222420sssss","................2444452235254443323314222221000osssss00000520ssss.","..........250...1444443234143332210ba210000osssss.........00o.....",".........25660..144443220ba322100os000ossss.......................","........226630s044442220s00000osssss..............................","........155330ss0442000ossssss....................................","........14544oss.00ossss..........................................","....2662003a0ss...................................................","....0330ss00o.....................................................",".....00os.........................................................","..................................................................","..................................................................","..................................................................",".................................................................."],"hts":["000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000cc000000000","000000000000000000000000000000000000000000000000000000bccc00000000","000000000000000000000000000000000000000000000000000000abcc00000000","0000000000000000000000000000000000000000000000000000009bccc0000000","0000000000000000000000000000000000000000000000000000008abccc000000","00000000000000000000000000000000000000000000000000000089abcc000000","00000000000000000000000000000000000000000000000000000999abccc00000","000000000000000000000000000000000000000000000000000889999abbb00000","0000000000000000000000000000000000000000000000007888888999aaa00000","000000000000000000000000000000000000000000000077888888888899900000","000000000000000000000000000000000000000000000667777777777788800000","000000000000000000000000000000000000066777666667777777777777700000","000000000000000000000000000000000066666666665666666666666666600000","000000000000000000000000006666666656666666655555555555555555500000","000000000000000000066660666666666646565555554544444444444444400000","000000000000000000556665566666655545555554443443433333333333300000","000000000000000003445665455555555434444444333332222222222222200000","000000000000000023345555344444444333333333221210000001111111100000","000000000033300022344544234433333222222221100000000000000000000000","000000000333330022334433123322222001110000000000000000000000000000","000000003333330012333322011111000000000000000000000000000000000000","000000002333320011222110000000000000000000000000000000000000000000","000000001222200001100000000000000000000000000000000000000000000000","000022220111100000000000000000000000000000000000000000000000000000","000011110000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000"],"n":["..................................................................","..................................................................","..................................................................","..................................................................","..................................................................",".......................................................00.........","......................................................u000........","......................................................u900........","......................................................uu100.......","......................................................uuu000......","......................................................44u900......",".....................................................4111u100.....","...................................................411116umww.....","................................................211111666mzww.....","..............................................u01116666666zww.....",".............................................296666666666juww.....",".....................................200009d101mbbbbjjjjjjzww.....","..................................u010333386u63mbbjjjjjjjjuww.....","..........................20000018u8e33bbbgeugbejjjjjjjjjjzww.....","...................9959.u513333386u6ebbbbbbeugbjwwwwwwwwwwzww.....","..................hme36uu3e3bbbbgeuubjbbboojuoorwwwwEwEEEEzww.....",".................mmmm38bueebbbbboruugjooowwwtoJEJJRRREEEEEzww.....","................e9m9mbgjuubjoooooruutwwwwwJEuORM.....RRRRRzww.....","..........000...9999hbgruuowwwwwwEuuBEJJJJJU..............zwW.....",".........0000g..99hhoooruuBwJJJJJM.HURR...........................","........e100gt.hmh9wwwBE.uRJJWR...................................","........rrro0t..hmwJJJJR..........................................","........rzwwwt...MWR..............................................","....h000zrwww.....................................................","....uwww..Z//.....................................................",".....www..........................................................","..................................................................","..................................................................","..................................................................",".................................................................."],"k":["..................................................................","..................................................................","..................................................................","..................................................................","..................................................................",".......................................................66.........","......................................................6666........","......................................................6966........","......................................................66876.......","......................................................667665......","......................................................786976......",".....................................................88886766.....","...................................................7888886721.....","................................................6788888888611.....","..............................................777788888877611.....",".............................................5987777777777622.....",".....................................666769085776666776666621.....","..................................768766761827685566565656601.....","..........................66667684649666663823684444454555611.....","...................9919.6386676618288655544720463333333433611.....","..................9896912496566538264544433521141111222223611.....",".................88986262885555436260532322100030000000011611.....","................99998507264543333122031100002000.....00000611.....","..........676...9999841626042211112201000000..............610.....",".........66662..999832052202000000.1000...........................","........886600.299921001.200000...................................","........566120..98100000..........................................","........654330...300..............................................","....867556111.....................................................","....6332..000.....................................................",".....331..........................................................","..................................................................","..................................................................","..................................................................",".................................................................."],"obs":[[21.3,-3.5,4.0],[16.7,-2.7,4.0],[12.2,-2.0,4.0],[7.6,-1.2,4.0],[3.0,-0.5,4.0],[-1.5,0.2,4.0],[-6.1,1.0,4.0],[-10.7,1.7,4.0],[-15.2,2.5,4.0]],"cap":[21,-3],"brk":[-15,2]},"wall_a":{"w":54,"h":33,"ax":24,"ay":26,"sink":0,"fp":[-21,-3,27,3],"rows":["......................................................","......................................................","......................................................","......................................................","......................................................","....2655555555555566555555555550......................","....1655555555555565555555555550......................","....1655555555555565555555255550......................","....1655555555555565555555555250......................","....1666666666666666666666666260......................","....1222222222223344444444444450......................","....1222222211112121111111111111333334555550..........","....1333344333333343333333333331344444555550..........","....1333433333333343433333343331334444555550..........","....1333333333333343433333334331333444555550..........","....1333333333333343433443344332344566666650..........","....1222222222222222222222222221343344233330..........","....1322222222223343333443333332322222222220..........","....1322221122124343333333344442433444333330ssssss....","....1322333333233343343334444442433443333330ssssss....","....1321333332233333333333333332434444333330ssssssssss","....11212333333332111111111111324344433333310sssssssss","....1321233333334343334444444442322222222221230sssssss","....132123333333433333333444434243222222222233330sssss","....132133223333433333344444434243443333344344333ossss","....132233333333433333334444334243222222234345550sssss","....1223444444443aa211aaa11aa111baa2aaaaabbb4454osss..","....0000000000000000000000000000000000000000000osss...","......................................................","......................................................","......................................................","......................................................","......................................................"],"hts":["000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000jjjjjjjjjjjjjjjjjjjjjjjjjjjj0000000000000000000000","0000iiiiiiiiiiiiiiiiiiiiiiiiiiii0000000000000000000000","0000hhhhhhhhhhhhhhhhhhhhhhhhhhhhcccccccccccc0000000000","0000ggggggggggggggggggggggggggggcccccccccccc0000000000","0000ffffffffffffffffffffffffffgfcccccccccccc0000000000","0000eeeeeeeeeeeeeeeeeeeeeeeeeefecccccccccccc0000000000","0000ddddddddddddddddddddddddddedcccccccccccc0000000000","0000cccccccccccccccccccccccccccccccccccccccc0000000000","0000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000","0000aa9999999999aaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000","000099888888888899999999999999999999999999990000000000","000088777777777788888888888888888888888888880000000000","000077666666666677777777777777777777777777774000000000","000066555555555566666666666666666666666666664440000000","000055444444444455555555555555555555555555554433300000","000044333333333344444444444444444444444444443333300000","000033222222222233333333333333333322222223333333300000","000022222222222222222222222222222222222222222222000000","000011111111111111111111111111111111111111111110000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000"],"n":["......................................................","......................................................","......................................................","......................................................","......................................................","....1000000000000010000000000000......................","....1000000000000000000000000000......................","....1000000000000000000000000000......................","....1000000000000000000000000000......................","....1000000000000000000000000000......................","....Cwwwwwwwwwwwwwjwwjjjjjjjjjjo......................","....rwwwwwwwwwwwwwEwwwwwwwwwwwwy100000000000..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwB100000000000..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwo100000000000..........","....Ewwwwwwwwwwwwwwwwwwwwwwwwwwo100000000000..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwB100000000000..........","....wwwwwwwwwwwwwwjjjjjjjjjjjjjoh0000101010l..........","....EwwwwwwwwwwwwwwwwwwwwwwwwwwBrwwwwwwwwwww..........","....EwwwwwwwwwwwwwwwwwwwwwwwwwwBEwwwwwwwwwww..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwBrwwwwwwwwwww..........","....rwwwwwwwwwwwwwwwwwwwwwwwwwwBrwwwwwwwwwww..........","....rBwwwwwwwwwwEwEEEEEEEEEEEEwBrwwwwwwwwwww0.........","....rwwwwwwwwwwwwwjjjjjjjjjjjjjtrwwwwwwwwwww000.......","....Ewwwwwwwwwwwwwwwwwwwwwwwwwwtrwwwwwwwwwww00000.....","....Ewwwwwwwwwwwwwwwwwwwwwwwwwwtrwwwwwwwwwwwj0000t....","....rwwwwwwwwwwwwwwwwwwwwwwwwwwtrwwwwwwwwwwwrrj3l.....","....zt0000000000rBwwwwwwwwwwwwwyrwwwwwwwwwwwrrrrG.....","....rwwwwwwwwwwwwwwwwwwwwwwwwwwtEwwwwwwwwwwwrrrJ......","......................................................","......................................................","......................................................","......................................................","......................................................"],"k":["......................................................","......................................................","......................................................","......................................................","......................................................","....8676666666666676666766666665......................","....8676666666666676666666766665......................","....8666666666666676676666666664......................","....8666666666667666666666667663......................","....8667666666667676666666666663......................","....1111111111113344444545555551......................","....1111111111111011111111111110222222676765..........","....4333333333333334333333333430222222666765..........","....4333333333333333333333333330222222667675..........","....4333333333333343333333333330222222666665..........","....4333333333333333333333333330222666676665..........","....4111111111111011111111111110222222222220..........","....4311111111113233333333333330111111111110..........","....4311111111113233333333333330433333333332..........","....4311333333333233333333433330433333333332..........","....4311333333333233333333313330433333333332..........","....10113333333310000000000000304333333333321.........","....4311333333333254445544555550411111111111111.......","....431133333333323333333333333043111111111111111.....","....4311333333333233333343333330433333333332711110....","....431133333333323333333333333043111111113255750.....","....202666666666101111111111111011111111133255540.....","....11111111111332333333333333304333333333325550......","......................................................","......................................................","......................................................","......................................................","......................................................"],"obs":[[-16.7,0.0,3.2],[-11.1,0.0,3.2],[-2.7,0.0,3.2],[2.9,0.0,3.2],[11.3,0.0,3.2],[16.9,0.0,3.2]],"brk":[20,0],"tall":true},"wall_b":{"w":43,"h":29,"ax":17,"ay":20,"sink":0,"fp":[-14,-3,22,5],"rows":["...........................................","...........................................","...........................................","...........................................","...........................................","....2535535560........0....................","....15555555656555555550...................","....15555555546555555550...................","....15555555226255555550...................","....16666666646655666550...................","....13443334536666666550...................","....12222222212111121110...................","....13333434324333343331333430.............","....13334444324333443331344430.............","....14333433324333333331344440ssssss.......","....13333433324333343333333340s260ss.......","....12222222223222222222335664355660.......","....1322222222333223333322334345555660.....","....1444333342433333344333334565555640.....","....1332222232433333343333334555565220ss...","....aa111111aabaaa2aaaaa2a334555552210ssss.","....00000000000000000000000000c55522aosss..","..............................00cba0oss....","................................00oss......","...........................................","...........................................","...........................................","...........................................","..........................................."],"hts":["0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000cccccccccc00000000c00000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000cccccccccccccccccccc0000000000000000000","0000bbbbbbbbbbbbbbbbbbbb0000000000000000000","0000aaaaaaaaaaaaaaaaaaaa6666660000000000000","0000999999999999999999996666660000000000000","0000888888888888888888886666660000000000000","0000777777777777777777776666660555000000000","0000666666666666666666666666665555540000000","0000555555555555555555555555555554444400000","0000444444444444444444444444444454444400000","0000333333333333333333333333333444443300000","0000222222222222222222222222222334432200000","0000111111111111111111111111111223321000000","0000000000000000000000000000000111110000000","0000000000000000000000000000000001000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000"],"n":["...........................................","...........................................","...........................................","...........................................","...........................................","....0000000000........2....................","....00000000000000000000...................","....00000000080000000000...................","....00000000051000000000...................","....00000000081000000000...................","....410000003g1111111113...................","....wwwwwwwwwtzwwwwwwwwB...................","....wwwwwwwwwBwwwwwwwwww100000.............","....wwwwwwwwwowwwwwwwwww100000.............","....wwwwwwwwwBwwwwwwwwww100000.............","....wwwwwwwwwoEwwwwwwwww100000.000.........","....wwwwwwwwwo9bbbbbbjbjjjjjjb000000.......","....wwwwwwwwwozwwwwwwwwwwwwwww00000000.....","....wwwwwwwwwBzwwwwwwwwwwwwwwze10000gB.....","....wwwwwwwwwozwwwwwwwwwwwwwwzzzr13tBB.....","....wwwwwwwwwtCwwwwwwwwBrwwwwzzzzztttB.....","....wwwwwwwwwBuwwwwwwwwwwwwwwzzzzzBBtB.....","..............................zzzzBBB......","................................MzB........","...........................................","...........................................","...........................................","...........................................","..........................................."],"k":["...........................................","...........................................","...........................................","...........................................","...........................................","....7666666663........5....................","....76666666647666666663...................","....76666766637666666664...................","....76666666637666666664...................","....66666666637666666664...................","....22222222208777777775...................","....11111111101111111110...................","....33333333304333333332222221.............","....33343333304333333332222221.............","....43333433304333333332222221.............","....33333333304333333332222224.666.........","....41111111102222222221216664266666.......","....3311111110633333333311334266666666.....","....3333333330633333333343333688666620.....","....1111111130633333333333333666784000.....","....1111111110511111111011333666660000.....","....3333333330611111111143333666660000.....","..............................6666000......","................................360........","...........................................","...........................................","...........................................","...........................................","..........................................."],"obs":[[-9.7,0.0,3.2],[-4.1,0.0,3.2],[0.3,0.0,3.2],[5.9,0.0,3.2],[10.0,0.0,3.4]],"brk":[13,0],"tall":true},"wall_c":{"w":75,"h":32,"ax":30,"ay":20,"sink":0,"fp":[-27,-3,41,7],"rows":["...........................................................................","...........................................................................","...........................................................................","...........................................................................","...........................................................................",".....255555555665565555550.................................................","....2655555555655555555555665555555555556555555550.........................","....1655555555665555555555655555555555556655555550.........................","....1655555555655555555254655555555555556555555550.........................","....1666666666666666666265666555555555556555555550.........................","....1555555555444444555553666666666266656666666660.........................","....111111111123222222221121112111111111121111111134430....................","....1333333333243333334432433343333333322222223221333440...................","....1333333433244444334442433344433333424333333331344240...................","....1333334443244444334442433444333333324433333331344440sssss..............","....1333334433244443334432433444333333324333333332334560ssssss.............","....1222222222222222222222222332222222223332233322234440ssssss.............","....1322222222223333322222333332222222222222222222233330ssssss.............","....1334444332333333433333333443344333424433333332434430sssss2666660.......","....1333444332333333333333433343344333424433333432434430ssss2555555560.....","....122222222a3baaa11aaaaaaaaaaaaaaaaaaaaa11aaa1aa1111a0ssss1555555220.....","....000000000000000000000000000000000000000000000000000osss25555555620.....","...........................................................14444444220sssss","...........................................................14444444220ssss.","...........................................................0b54444421osss..","............................................................000044baosss...","................................................................000oss.....","...........................................................................","...........................................................................","...........................................................................","...........................................................................","..........................................................................."],"hts":["000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","00000dddddddddcddddddddddd0000000000000000000000000000000000000000000000000","0000cdddddddddddddddddddddcccccccccccccccccccccccc0000000000000000000000000","0000cdddddddddddddddddddddcccccccccccccccccccccccc0000000000000000000000000","0000cdddddddddddddddddddddcccccccccccccccccccccccc0000000000000000000000000","0000cddddddddddddddddddddccccccccccccccccccccccccc0000000000000000000000000","0000cccccccccccccccccccccccccccccccccccccccccccccc0000000000000000000000000","0000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb6666600000000000000000000","00009aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6666660000000000000000000","000099aaaaaaaa99999999999999999999999999aaaaaaaaa96666660000000000000000000","000088999888998888888888888888888888889899999999986666660000000000000000000","000077777888887777777777777777777777777788888888876666660000000000000000000","000066666666666666666666666666666666666666666666666666660000000000000000000","000055555555555555555555555555555555555555555555555555550000000000000000000","000044444444444444444444444444444444444444444444444444440000055555550000000","000033333333333333333333333333333333333333333333333333330000555555555500000","000022222222222222222222222222222222222222222222222222220000555555555400000","000011111111111111111111111111111111111111111111111111100004445555554300000","000000000000000000000000000000000000000000000000000000000003334444444200000","000000000000000000000000000000000000000000000000000000000002223333343100000","000000000000000000000000000000000000000000000000000000000001112222232000000","000000000000000000000000000000000000000000000000000000000000001111120000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000","000000000000000000000000000000000000000000000000000000000000000000000000000"],"n":["...........................................................................","...........................................................................","...........................................................................","...........................................................................","...........................................................................",".....000000000400000000000.................................................","....400000000010000000000000000000000000000000000l.........................","....400000000010000000000000000000000000000000000d.........................","....400000000000000000000000000000000000000000000d.........................","....400000000000000000000000000000000000000000000d.........................","....mjjjjjjjjjjjjjjjjjjjjg11111111111108000000000d.........................","....uwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwwyzwwwwwwwwy00000....................","....zwwwwwwwwwwwwwwwwwwwwowwwwwwwwwwwwwowwwwwwwwwB100000...................","....zwwwwwwwwwwwwwwwwwwwwowwwwwwwwwwwwwBwwwwwwwwwB000000...................","....zwwwwwwwwwwwwwwwwwwwwowwwwwwwwwwwwwowwwwwwwwwB000000...................","....zwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwowwwwwwwwwB000000...................","....wwwwwwwwwojjjjjjjjjjjjjjjjjjjjjjjjjgEEEEREERRowwwwww...................","....wwwwwwwwwoEwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwowwwwww...................","....wwwwwwwwworwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwowwwwww.....0000000.......","....wwwwwwwwwoEwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwowwwwww....1000000008.....","....zwwwwwwwwyrwwwwwwwwwwBzwwwwwwwwwwwwyzwwwwwwwwyuwwwwy....000000003t.....","....wwwwwwwwwtrwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwowwwwww...zrrre6100tt.....","...........................................................zrrrrrrrttt.....","...........................................................zrrrrrrrBtt.....","...........................................................zrrrrrrrotG.....","............................................................rrrrrrrot......","................................................................EEro.......","...........................................................................","...........................................................................","...........................................................................","...........................................................................","..........................................................................."],"k":["...........................................................................","...........................................................................","...........................................................................","...........................................................................","...........................................................................",".....666666676866666766666.................................................","....8666666676766666667666766666666666646666666660.........................","....8666766666767667666665767666766676646666667660.........................","....8666766666766666666664766666676666646666666660.........................","....9666666666766766667663766666666667636766666660.........................","....8666666666555555556662777777777777736666666661.........................","....611111111013333111111011111111111110211111111022222....................","....6333333333133343333330433333333333301113333330222224...................","....6333333333133444333330333333433333303333333330222224...................","....6333333333134333333430333333333333303333333330222224...................","....6333333333143333343330333333333333303333333330222664...................","....4111111110111111111111221222221222201000000000134441...................","....4311111110113333111111333311111111101111111110133331...................","....3333333330433333333332333333333333303333333330433331.....6777665.......","....3333333330433333333332333333333333303333333430333331....7667766662.....","....2111111110111111111110111111111111101111111110211110....7766677640.....","....1111111110433333333332111111111111103333333330433331...65568876600.....","...........................................................65555555000.....","...........................................................65555555000.....","...........................................................65555555000.....","............................................................555555500......","................................................................4450.......","...........................................................................","...........................................................................","...........................................................................","...........................................................................","..........................................................................."],"obs":[[-22.7,0.0,3.2],[-17.1,0.0,3.2],[-12.7,0.0,3.2],[-7.1,0.0,3.2],[-0.7,0.0,3.2],[4.9,0.0,3.2],[13.3,0.0,3.2],[18.9,0.0,3.2],[23.0,0.0,3.4]],"brk":[26,0],"tall":true},"side_a":{"w":16,"h":43,"ax":8,"ay":25,"sink":0,"fp":[-5,-14,5,14],"rows":["................","................","................","................","................",".....2555550....",".....1555550....",".....1555550....",".....1555550....",".....1555550ssss",".....1555550ssss","....26555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555520ssss","....15555520ssss","....15555550ssss","....16666660ssss","....15444440ssss","....16555550ssss","....16555550ssss","....11555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16666660ssss","....14444440ssss","....14443330ssss","....13443430ssss","....11111110ssss","....1aaa221ossss","....000000oss...","................","................","................","................"],"hts":["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000066666660000","0000066666660000","0000066666660000","0000066666660000","0000066666660000","0000066666660000","0000666666660000","0000666666660000","0000666666660000","0000666666650000","0000666666650000","0000666666650000","0000666666660000","0000666666650000","0000666666650000","0000666666640000","0000666666640000","0000666666650000","0000666666650000","0000566666650000","0000566666660000","0000566666660000","0000466666660000","0000566666660000","0000566666660000","0000666666660000","0000666666660000","0000666666650000","0000555555550000","0000444444440000","0000333333430000","0000222222220000","0000111111100000","0000101111000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"],"n":["................","................","................","................","................",".....0000000....",".....0000000....",".....0000000....",".....0000000....",".....0000008....",".....0000008....","....h0000008....","....h000000d....","....h000000d....","....4000000l....","....4000000l....","....4000000l....","....4000000y....","....4000000y....","....1000000y....","....1000000y....","....1000000y....","....1000000l....","....1111110l....","....r0000008....","....h000000d....","....4000000d....","....4000000d....","....4000000l....","....4000000l....","....4000000l....","....4000000y....","....4000000y....","....rwwwwwwy....","....rwwwwwwy....","....rwwwwwwy....","....Cwwwwwwy....","....zwwwwwwt....","....zEEEwEE.....","................","................","................","................"],"k":["................","................","................","................","................",".....6667665....",".....6666664....",".....6666764....",".....6666673....",".....6676662....",".....6666672....","....86766661....","....86666660....","....86667670....","....86667660....","....86676660....","....86666670....","....86676660....","....86666660....","....86666660....","....76666660....","....77666660....","....76666660....","....77777770....","....46666662....","....86676660....","....87666660....","....86666660....","....86666660....","....86666660....","....86666660....","....86666660....","....86667660....","....63344340....","....53333330....","....53343330....","....11111110....","....61111110....","....4222222.....","................","................","................","................"],"obs":[[0.0,-11.5,4.1],[0.0,-6.7,4.1],[0.0,-1.9,4.1],[0.0,2.9,4.1],[0.0,7.5,4.1],[0.0,12.3,4.1]],"tall":false},"side_b":{"w":16,"h":62,"ax":8,"ay":38,"sink":0,"fp":[-5,-20,4,20],"rows":["................","................","................","................","................","................",".....2535550....","....26555560....","....16555560....","....16555550....","....16555550....","....16555550....","....16556550....","....16555550....","....16555550....","....16555550.sss","....15555550ssss","....16555550ssss","....16555550ssss","....15555550ssss","....16666620ssss","....16666660ssss","....c6555520ssss","....c6555550ssss","....c6555550ssss","....16555550ssss","....16555550ssss","....1655555ossss","....16566520ssss","....16555520ssss","....16555520ssss","....16555520ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16666660ssss","....16666660ssss","....16555550ssss","....15555550ssss","....16555520ssss","....16666620ssss","....16666620ssss","....13344320ssss","....13333320ssss","....13333320ssss","....11111110ssss","....13332320ssss","....14433330ssss","....14343330ssss","....14443440ssss","....13333330ssss","....11111110ssss","....13bbb3bossss","....000000os....","................","................","................","................"],"hts":["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","00000ccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccb0000","0000cccccccb0000","0000cccccccb0000","0000cccccccb0000","0000cccccccb0000","0000cccccccc0000","0000cccccccc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cdddddd00000","0000cdddddda0000","0000cdddddda0000","0000cddddddb0000","0000cddddddb0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000cddddddc0000","0000bccccccc0000","0000cccccccc0000","0000cccccccb0000","0000cccccccb0000","0000ccccccca0000","0000ccccccc90000","0000bbbbbbb90000","0000aaaaaaa80000","0000999999970000","0000888888870000","0000777777760000","0000666666660000","0000555555550000","0000444444440000","0000333333330000","0000222222220000","0000111111100000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"],"n":["................","................","................","................","................","................",".....0000008....","....h0000008....","....h0000008....","....h0000008....","....h000000d....","....h000000d....","....h000000l....","....4000000l....","....4000000l....","....4000000l....","....4000000l....","....4000000y....","....4000000y....","....4000000y....","....40000008....","....e6bb6668....","....4000000d....","....40000008....","....40000008....","....40000008....","....40000008....","....40000008....","....40000008....","....4000000d....","....4000000d....","....4000000y....","....4000000y....","....40000008....","....4000000y....","....4000000y....","....4000000l....","....4000000l....","....4000000l....","....4000000l....","....mjjjjjjl....","....1000000t....","....1000000t....","....1000000t....","....0000000t....","....6666666t....","....wwwwwwwy....","....wwwwwwwy....","....wwwwwwwl....","....rwwwwwtl....","....wwwwwwwl....","....jjjjjwwl....","....rwwwwwwt....","....rwwwwwwt....","....rwwwwwwt....","....zwwwwwwy....","....rwwwwwwt....","....URRRRRR.....","................","................","................","................"],"k":["................","................","................","................","................","................",".....7766662....","....86676661....","....86666661....","....86666671....","....87666660....","....86666660....","....86666660....","....86666660....","....86766660....","....86666660....","....86666660....","....86666660....","....86666660....","....86676660....","....86666662....","....87777771....","....86666661....","....86666762....","....86666662....","....86676662....","....86666672....","....86666662....","....86667660....","....86666661....","....86666661....","....86666670....","....86666660....","....86667662....","....86676660....","....86676660....","....87666670....","....86666660....","....87666660....","....86666670....","....86666660....","....86666660....","....76666660....","....76666660....","....76666660....","....77777770....","....33343330....","....34433330....","....33343330....","....11111100....","....33333310....","....75555440....","....53333330....","....43333330....","....43333330....","....21111110....","....43433340....","....0000000.....","................","................","................","................"],"obs":[[0.0,-17.5,4.1],[0.0,-12.7,4.1],[0.0,-7.9,4.1],[0.0,-1.5,4.1],[0.0,3.3,4.1],[0.0,8.1,4.1],[0.0,12.9,4.1],[-0.4,17.5,3.2]],"tall":true},"corner_nw":{"w":49,"h":59,"ax":9,"ay":27,"sink":0,"fp":[-6,-3,37,28],"rows":[".................................................",".................................................",".................................................",".................................................",".................................................","....2555555550...................................","....1555555550...................................","....1555555550...................................","....1555666650...................................","....1666666660...................................","....1111111110...................................","....013322221o...................................",".....12221120....................................",".....14332220....................................",".....14544320....................................",".....16643320....................................",".....16533220....................................",".....15433210....................................",".....16654320....................................",".....15211110.2433333333444365355555555555550....",".....15432210.1444445555555362555555555555550....",".....15443220.1555555555555365552255555555550....",".....15543220.1666666666666366666666666666660....",".....15432220.1666666666666366666666656665550ssss",".....15422220s1333333334333243333333334433330ssss",".....15544420s1333443343443143344433333333330ssss","....02655535133333333333443243333333333333330ssss",".....165555210211111112aaaaaaaaa11a12aaaa2220ssss",".....26555550.000000000000000000000000000000osss.",".....16555550....................................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16666660sssss...............................",".....14444440sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16555550sssss...............................",".....16666660sssss...............................",".....14444440sssss...............................",".....13333330sssss...............................",".....14333330sssss...............................",".....b1111110sssss...............................",".....baaaaa1ossss................................",".....000000oss...................................",".................................................",".................................................",".................................................","................................................."],"hts":["0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000kkkkkkkkkk00000000000000000000000000000000000","0000jjjjjjjjjj00000000000000000000000000000000000","0000iiiiiiiii000000000000000000000000000000000000","00000fghhhhgf000000000000000000000000000000000000","00000effffffe000000000000000000000000000000000000","00000deeeeeed000000000000000000000000000000000000","00000cddddddc000000000000000000000000000000000000","00000bccccccb000000000000000000000000000000000000","00000abbbbbba000000000000000000000000000000000000","000009aaaaaa9000000000000000000000000000000000000","0000089999998066666666666666666666666666666660000","0000078888887066666666666666666666666666666660000","0000067777776066666666666666666666666666666660000","0000056666665066666666666666666666666666666660000","0000045555554066666666666666666666666666666660000","0000034444443055555555555555555555555555555550000","0000035555553044444444444444444444444444444440000","0000156666665233333333333333333333333333333330000","0000056666664122222222222222222222222222222220000","0000066666665011111111111111111111111111111100000","0000066666665000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666665000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000056666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000066666666000000000000000000000000000000000000","0000055555555000000000000000000000000000000000000","0000044444444000000000000000000000000000000000000","0000033333333000000000000000000000000000000000000","0000022222222000000000000000000000000000000000000","0000011111110000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000"],"n":[".................................................",".................................................",".................................................",".................................................",".................................................","....0000000000...................................","....0000000000...................................","....0000000000...................................","....0000000000...................................","....0000000000...................................","....zwwwwwwwwy...................................","....wEwwEwEEEw...................................",".....HMMEJJBG....................................",".....uzEEwJBG....................................",".....9MrjjoOl....................................",".....9eejbbBl....................................",".....heejwbgd....................................",".....merRRogt....................................",".....uzrjjoBt....................................",".....uzrEwoBt.0000000000000d00000000000000000....",".....uzrrwwBt.0000000000000800000000000000000....",".....uzrEwwBt.0000000000000800000000000000000....",".....uzrwwoBt.0000000000000800000000000000000....",".....uzrEwwBt.666666666666b8jjjjjjjjjjjjjjjjj....",".....uzrrwoBt.wwwwwwwwwwwwwBwwwwwwwwwwwwwwwww....",".....4000000t.wwwwwwwwwwwwwBwwwwwwwwwwwwwwwww....","....h4000000y3wwwwwwwwwwwwwBwwwwwwwwwwwwwwwww....",".....4000000ywwwwwwwwwwwwwwtuwwwwwwwwwwwwwwwy....",".....4000000y.wwwwwwwwwwwwwtrwwwwwwwwwwwwwwww....",".....4000000y....................................",".....40000008....................................",".....4000000y....................................",".....40000008....................................",".....40000008....................................",".....40000008....................................",".....40000008....................................",".....4000000d....................................",".....1000000d....................................",".....rwwwwwwt....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000l....................................",".....4000000y....................................",".....rwwwwwwy....................................",".....rwwwwwwy....................................",".....rwwwwwwy....................................",".....Cwwwwwoy....................................",".....uwwwwwwy....................................",".....MEEEEEE.....................................",".................................................",".................................................",".................................................","................................................."],"k":[".................................................",".................................................",".................................................",".................................................",".................................................","....6676666766...................................","....6666666666...................................","....6666666666...................................","....6666666666...................................","....7777776766...................................","....1111111110...................................","....2222222222...................................",".....51210000....................................",".....75421000....................................",".....92654100....................................",".....98875400....................................",".....99854100....................................",".....79500010....................................",".....66664100....................................",".....66110000.2222222222222067766666766666675....",".....66510100.2222666766666266666766666667776....",".....66542100.2676666666666276666666676666676....",".....66542100.6666666676666276667666667667666....",".....66542100.7777777777777276666666666666665....",".....66511100.3333333333333143333333333333332....",".....86666660.3333333333333033333333333333333....","....88666666023333333333333133333333333333333....",".....8666666031111111111110011111111111111110....",".....86667660.3111111111111011111111111111111....",".....86666660....................................",".....86667662....................................",".....87666660....................................",".....87666662....................................",".....86667762....................................",".....86666662....................................",".....86666662....................................",".....87666661....................................",".....86666671....................................",".....54334441....................................",".....86666660....................................",".....86666660....................................",".....86666660....................................",".....97666660....................................",".....87666660....................................",".....86666660....................................",".....86666660....................................",".....86676660....................................",".....86666660....................................",".....87676660....................................",".....63333330....................................",".....63333330....................................",".....63333330....................................",".....11111100....................................",".....61111110....................................",".....3111121.....................................",".................................................",".................................................",".................................................","................................................."],"obs":[[-0.0,0.0,4.2],[8.1,0.0,3.2],[13.7,0.0,3.2],[22.1,0.0,3.2],[27.7,0.0,3.2],[33.3,0.0,3.2],[0.0,6.9,4.1],[0.0,11.7,4.1],[0.0,16.5,4.1],[0.0,19.9,4.1],[0.0,24.7,4.1]],"tall":true},"corner_ne":{"w":50,"h":59,"ax":41,"ay":27,"sink":0,"fp":[-37,-3,5,28],"rows":["..................................................","..................................................","..................................................","..................................................","..................................................","..................................................","......................................266660......",".....................................26666660.....",".....................................16666650.....",".....................................15554220.....",".....................................15543220.....",".....................................15543220.....",".....................................15543220.....",".....................................15211120.....",".....................................15422220.....",".....................................15543220.....",".....................................15443210.....",".....................................15443210.....","............................25555550.15443220.....","....2655555550.255555555555655555550.15211120.....","....1655555550.155555555554665555550.15432220.....","....1655555550.155555555554665555550.15443220.....","....1666566660.166666666664666666660.15443220....s","....1666666660s155555666663444444450s15422220.ssss","....1333334330s133333444442433333340s13432220sssss","....1333334330s133333444442433333330s13443320sssss","....1333333430s133333443442433333333325555522ossss","....1333333330s122222222a2a22122222301555552oss...","....000000000os00000000000000000000os1555550......",".....................................1555550......",".....................................1555550ssssss",".....................................1655550ssssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................16555550sssss",".....................................1655ccc0sssss",".....................................11525550sssss",".....................................11555550sssss",".....................................26555550sssss",".....................................11555550sssss",".....................................01555550sssss","......................................1555550sssss","......................................1555550sssss","......................................1666660sssss","......................................1444340sssss","......................................1333330sssss","......................................1333330sssss","......................................1333330sssss","......................................11aaaa0sssss","......................................000000os....","..................................................","..................................................","..................................................",".................................................."],"hts":["00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000kkkkkk000000","0000000000000000000000000000000000000kkkkkkkk00000","0000000000000000000000000000000000000jkkkkkkj00000","0000000000000000000000000000000000000ijjjjjji00000","0000000000000000000000000000000000000hiiiiiih00000","0000000000000000000000000000000000000ghhhhhhg00000","0000000000000000000000000000000000000fggggggf00000","0000000000000000000000000000000000000effffffe00000","0000000000000000000000000000000000000deeeeeed00000","0000000000000000000000000000000000000cddddddc00000","0000000000000000000000000000000000000bccccccb00000","0000000000000000000000000000000000000abbbbbba00000","00000000000000000000000000006666666609aaaaaa900000","00006666666666066666666666666666666608999999800000","00006666666666066666666666666666666607888888700000","00006666666666066666666666666666666606777777600000","00006666666666066666666666666666666605666666500000","00006666666666066666666666666666666604555555400000","00005555555555055555555555555555555503444444300000","00004444444444044444444444444444444403444455200000","00003333333333033333333333333333333316666666200000","00002222222222022222222222222222222216666666000000","00001111111110011111111111111111111006666666000000","00000000000000000000000000000000000006666666000000","00000000000000000000000000000000000006666666000000","00000000000000000000000000000000000006666666000000","00000000000000000000000000000000000006666666600000","00000000000000000000000000000000000006666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000006666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000004666666600000","00000000000000000000000000000000000004666666600000","00000000000000000000000000000000000005666666600000","00000000000000000000000000000000000004666666600000","00000000000000000000000000000000000003666666600000","00000000000000000000000000000000000000666666600000","00000000000000000000000000000000000000666666600000","00000000000000000000000000000000000000666666600000","00000000000000000000000000000000000000555555500000","00000000000000000000000000000000000000444444400000","00000000000000000000000000000000000000333333300000","00000000000000000000000000000000000000222222200000","00000000000000000000000000000000000000111111100000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000"],"n":["..................................................","..................................................","..................................................","..................................................","..................................................","..................................................","......................................000000......",".....................................40000008.....",".....................................u100008t.....",".....................................uzrrwoBt.....",".....................................uzrEwoBt.....",".....................................uzrEwwBt.....",".....................................uzrEwoBt.....",".....................................uzrwwoBt.....",".....................................uzrwwwBt.....",".....................................uzrwwoBt.....",".....................................uzrEwoBt.....",".....................................uzrwwoBt.....","............................22220000.uzrEwoBt.....","....h000000000.000000000000100000000.uzrEwoBt.....","....h000000000.100000000000100000000.uzrEwoBt.....","....h000000000.000000000000100000000.uzrEwoBt.....","....h000000000.000000000008400000000.uzrEwwBt.....","....m6bb66666b.jjjjjjjjjjjgrwjwwwwww.uzrEwoBt.....","....zwwwwwwwww.wwwwwwwwwwwBrwwwwwwwB.uzrwwoBt.....","....zwwwwwwwww.wwwwwwwwwwwBrwwwwwwww.uzrw222t.....","....zwwwwwwwww.wwwwwwwwwwwBrwwwwwwwwh000000008....","....zwwwwwwwww.wwwwwwwwwwwyuwwwwwwwwE0000000t.....","....uwwwwwwwww.wwwwwwwwwwwtzwwwwwwww.1000000......",".....................................1000000......",".....................................1000000......",".....................................1000000......",".....................................1000000d.....",".....................................4000000d.....",".....................................40000008.....",".....................................40000005.....",".....................................4000000l.....",".....................................4000000d.....",".....................................h000000d.....",".....................................h0000008.....",".....................................u0000008.....",".....................................u0000008.....",".....................................u0000000.....",".....................................u0000000.....",".....................................u0000000.....",".....................................u0000000.....","......................................0000000.....","......................................0000000.....","......................................0001100.....","......................................wwwwwww.....","......................................wwwwwww.....","......................................wwwwwww.....","......................................wwwwwww.....","......................................rwwwwwo.....","......................................EEEEEww.....","..................................................","..................................................","..................................................",".................................................."],"k":["..................................................","..................................................","..................................................","..................................................","..................................................","..................................................","......................................666666......",".....................................86666661.....",".....................................69666630.....",".....................................66552000.....",".....................................66542100.....",".....................................66542000.....",".....................................66542000.....",".....................................66111000.....",".....................................66511100.....",".....................................66542100.....",".....................................66542000.....",".....................................66542100.....","............................56666666.66542100.....","....8676666667.766677667665866666666.66111000.....","....8666666666.766666766664876676666.66542100.....","....8667666666.766766666763866676666.66542000.....","....8666666666.666666666662876666666.66542100.....","....9777777777.555555655661644444344.26511000.....","....6333333333.333333333330533333330.22543000.....","....6333343333.334333333330533333333.21545660.....","....6333333333.3333333333405333333332766666620....","....6333333333.411111111110111111113176666660.....","....6111111111.333331111110611111113.7766666......",".....................................7676666......",".....................................7666666......",".....................................8666666......",".....................................86666661.....",".....................................86766662.....",".....................................86667672.....",".....................................86666672.....",".....................................86666660.....",".....................................86677660.....",".....................................87666660.....",".....................................87666661.....",".....................................66666672.....",".....................................67666663.....",".....................................67666663.....",".....................................66676664.....",".....................................66666665.....",".....................................66666665.....","......................................6667665.....","......................................7666666.....","......................................7777776.....","......................................3333333.....","......................................3333332.....","......................................3333333.....","......................................3333333.....","......................................1111110.....","......................................2222221.....","..................................................","..................................................","..................................................",".................................................."],"obs":[[0.0,0.0,4.2],[-32.7,0.0,3.2],[-27.1,0.0,3.2],[-22.7,0.0,3.2],[-17.1,0.0,3.2],[-10.7,0.0,3.2],[-5.1,0.0,3.2],[0.0,6.9,4.1],[0.0,11.7,4.1],[0.0,16.5,4.1],[0.0,21.3,4.1],[0.0,26.1,4.1]],"tall":true},"col_a":{"w":18,"h":39,"ax":9,"ay":32,"sink":0,"fp":[-6,-3,6,3],"rows":["..................","..................","..................","..................","..................","....2555555550....","....1555555550....","....1555255550....","....1555555550....","....1666666660....","....1333333330....","....033333333o....",".....12222220.....",".....12222220.....",".....15432220.....",".....15332220.....",".....15554320.....",".....16654320.....",".....16432220.....",".....15421220.....",".....15443220.....",".....15443210.....",".....15543210.....",".....15443210.....",".....15322110.....",".....15421210.....",".....15443210.....",".....15543220....s",".....15443220sssss",".....15433220sssss","....2552211220ssss","....1554222210ssss","....005433230os...","......00000o......","..................","..................","..................","..................",".................."],"hts":["000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000oooooooooo0000","0000nnnnnnnnn00000","00000lmmmmmml00000","00000jkllllkj00000","00000ijjjjjji00000","00000hiiiiiih00000","00000ghhhhhhg00000","00000fggggggf00000","00000effffffe00000","00000deeeeeed00000","00000cddddddc00000","00000bccccccb00000","00000abbbbbba00000","000009aaaaaa900000","000008999999800000","000007888888700000","000006777777600000","000005666666500000","000004555555400000","000003444444300000","000012333333210000","000011222222110000","000001111111100000","000000111110000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000"],"n":["..................","..................","..................","..................","..................","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....jjjjjjjjjj....","....wwwwwwwwww....",".....HMEEJJJO.....",".....HzEEJJBG.....",".....HmEEwJod.....",".....meMEJJgt.....",".....9Mrjjwtl.....",".....9zejbbO8.....",".....uee6bbgt.....",".....uzrEwoBt.....",".....zzrEwwBt.....",".....uzrEwwBt.....",".....uzrwwwBt.....",".....uzrwwwBt.....",".....uzrrwoBt.....",".....uzrEwoBt.....",".....uzrEwwBt.....",".....uzrEwwBt.....",".....uzrrwoBt.....",".....uzrEwwBt.....","....1uzrEwoBtd....","....1HzrEwoBtl....","....u90EEwB0gt....","......rrjwwB......","..................","..................","..................","..................",".................."],"k":["..................","..................","..................","..................","..................","....6666666666....","....7666666666....","....6676666667....","....6666666666....","....6666666666....","....1122112112....","....3333333333....",".....11110000.....",".....51310000.....",".....38331000.....",".....88010000.....",".....93665000.....",".....95875400.....",".....68876520.....",".....66511100.....",".....66542100.....",".....66542100.....",".....76533100.....",".....66543100.....",".....66111000.....",".....66511100.....",".....66542100.....",".....66542100.....",".....66542100.....",".....66542100.....","....7661100000....","....8565111000....","....6974220620....","......654320......","..................","..................","..................","..................",".................."],"obs":[[0.0,0.0,4.4]],"tall":true},"col_b":{"w":22,"h":49,"ax":9,"ay":33,"sink":0,"fp":[-5,-3,9,12],"rows":["......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......20..............",".....24440............",".....1444440..........",".....14444440.........",".....14444440.........",".....15544440.........",".....15443220.........",".....15443220.........",".....15443220.........",".....15322220.........",".....15321120.........",".....15443220.......ss",".....15543210....sssss",".....15443210sssssssss",".....15433210sssssssss","....2552211110ssssssss","....1554212110sssss...","....005bbb230os.......","......00000o..........","......................","......................","...........250........","..........255560......",".........26655560.....",".........05665540ss...","..........0c54220sss..","...........0cba0oss...","............00os......","......................","......................","......................","......................","......................"],"hts":["0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","000000ff00000000000000","00000ffeee000000000000","00000ffeeedd0000000000","00000eeeedddd000000000","00000deeedddd000000000","00000cddddddc000000000","00000bccccccb000000000","00000abbbbbba000000000","000009aaaaaa9000000000","0000089999998000000000","0000078888887000000000","0000067777776000000000","0000056666665000000000","0000045555554000000000","0000034444443000000000","0000123333332100000000","0000112222221100000000","0000111111111000000000","0000001111100000000000","0000000000000000000000","0000000000000000000000","0000000000044400000000","0000000000444433000000","0000000003333333300000","0000000002233333200000","0000000000122322100000","0000000000011211000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000","0000000000000000000000"],"n":["......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......88..............",".....83833............",".....3080003..........",".....z3053058.........",".....ur000838.........",".....zzrj383l.........",".....zzrwwoBt.........",".....zzrwwoBt.........",".....uzrwwwBt.........",".....uzrEwoBt.........",".....uzrEwoBt.........",".....uzrEwwBt.........",".....mzrwwoBt.........",".....uzrwwwBt.........",".....uzrwwoBt.........","....1uzrrwoBtd........","....1HzrwwoBtl........","....u90EEww0gt........","......rrrwwB..........","......................","......................","...........000........","..........100000......",".........zz600000.....",".........zzze03gB.....","..........zzzwBBB.....","...........zzwBBB.....","............zBB.......","......................","......................","......................","......................","......................"],"k":["......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......................","......23..............",".....34364............",".....5444564..........",".....74636622.........",".....77565342.........",".....66545250.........",".....66542100.........",".....66533000.........",".....66543100.........",".....66111000.........",".....66511000.........",".....66542100.........",".....76543000.........",".....66542100.........",".....66532100.........","....7661110000........","....8565111000........","....6963310620........","......555420..........","......................","......................","...........666........","..........866665......",".........66966666.....",".........66696620.....","..........6664000.....","...........661000.....","............500.......","......................","......................","......................","......................","......................"],"obs":[[0.0,0.0,4.4]],"tall":true},"col_c":{"w":18,"h":20,"ax":9,"ay":13,"sink":0,"fp":[-5,-3,5,3],"rows":["..................","..................","..................","..................","..................",".......2660.......",".....26666660.....",".....16666660.....",".....16666650.....",".....15544220sss..",".....15443220sssss","....2552211110ssss","....1554212120ssss","....005b3ba30os...","......00000o......","..................","..................","..................","..................",".................."],"hts":["000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000066660000000","000006666666600000","000006666666600000","000005666666500000","000004555555400000","000003444444300000","000012333333210000","000011222222110000","000011111111100000","000000111110000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000"],"n":["..................","..................","..................","..................","..................",".......0000.......",".....40000000.....",".....10000008.....",".....m600003t.....",".....uzrwwoBt.....",".....uzrwwoBt.....","....1uzrrwoBtd....","....4HzrEwwBtl....","....u90EEww0gt....","......rrjwwB......","..................","..................","..................","..................",".................."],"k":["..................","..................","..................","..................","..................",".......6666.......",".....76666664.....",".....86666663.....",".....79666640.....",".....66533000.....",".....66533100.....","....7661110000....","....9565111000....","....6974310620....","......655310......","..................","..................","..................","..................",".................."],"obs":[[0.0,0.0,4.4]],"tall":false},"col_d":{"w":18,"h":34,"ax":9,"ay":27,"sink":0,"fp":[-6,-3,6,3],"rows":["..................","..................","..................","..................","..................","....2555555550....","....1555555550....","....1555555550....","....1555555550....","....1666666660....","....1111111110....","....011111111o....",".....12221110.....",".....14332110.....",".....15543320.....",".....16543220.....",".....16433220.....",".....14443210.....",".....16654320.....",".....15322110.....",".....15421220.....",".....15543220.....",".....15443210....s",".....15443220sssss",".....15443220sssss","....2652211220ssss","....1254212210ssss","....005bbaa30os...","......00000o......","..................","..................","..................","..................",".................."],"hts":["000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000kkkkkkkkkk0000","0000jjjjjjjjjj0000","0000iiiiiiiii00000","00000gghhhhgg00000","00000effggffe00000","00000deeeeeed00000","00000cddddddc00000","00000bccccccb00000","00000abbbbbba00000","000009aaaaaa900000","000008999999800000","000007888888700000","000006777777600000","000005666666500000","000004555555400000","000003444444300000","000012333333210000","000011222222110000","000011111111100000","000000111110000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000","000000000000000000"],"n":["..................","..................","..................","..................","..................","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....0000000000....","....zwwwwwwwwy....","....RRRRRRRRRR....",".....HMEEJJBB.....",".....mzEEJJBt.....",".....9zrjjoB8.....",".....9eejbbg8.....",".....herEwbg8.....",".....meMEJJgt.....",".....uzrjjoBt.....",".....uzrEwoBt.....",".....uzrwwwBt.....",".....uzrwwwBt.....",".....uzrEwwBt.....",".....uzrwwwBt.....",".....zzrwwoBt.....","....1uzrrwoBtd....","....4HzrEwwBtl....","....u90EEwB0gt....","......zrjwwo......","..................","..................","..................","..................",".................."],"k":["..................","..................","..................","..................","..................","....6767666666....","....7666666666....","....6676666667....","....6666666666....","....7666666666....","....1111111110....","....0000000000....",".....41010000.....",".....85320000.....",".....95664200.....",".....98865100.....",".....89720110.....",".....99100010.....",".....66665200.....",".....66111000.....",".....66511100.....",".....76542100.....",".....66542100.....",".....66542100.....",".....66542100.....","....7661110000....","....9565110000....","....5974310610....","......555310......","..................","..................","..................","..................",".................."],"obs":[[0.0,0.0,4.4]],"tall":true},"stele_a":{"w":24,"h":27,"ax":12,"ay":20,"sink":0,"fp":[-9,-3,9,3],"rows":["........................","........................","........................","........................","........................","........................","......2555555555550.....","......1666666666660.....",".....24444444444550.....",".....13333333333330.....",".....11111111111110.....",".....13333333333330.....",".....13333444333330.....",".....13333444333330.....",".....13344443333330.....",".....1222222222222osssss","....2111111111111120ssss","....1533333333333320ssss","....1533333433333320ssss","....154b4444b4444440ssss","....144b4555cccb44b0ss..","....000000000000000os...","........................","........................","........................","........................","........................"],"hts":["000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000ddddddddddddd00000","000000ddddddddddddd00000","00000dddddddddddddc00000","00000cccccccccccccb00000","00000bbbbbbbbbbbbbb00000","00000aaaaaaaaaaaaaa00000","000009999999999999900000","000007888888888888800000","000006777777777777700000","000005666666666666000000","000024555555555555320000","000023444444444444320000","000022333333333333220000","000022222222222222220000","000012222222221111110000","000011111111111111000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000"],"n":["........................","........................","........................","........................","........................","........................","......000000000000d.....","......000000000000l.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwy.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....",".....Cwwwwwwwwwwwwt.....",".....uwwwwwwwwwwwwt.....","....0uwwwwwwwwwwww00....","....0uwwwwwwwwwwww00....","....0hwwwwwwwwwwww00....","....0066666666666600....","....136bbjjjjjjwwwww....","....wwwwwwwwwwwwwwww....","........................","........................","........................","........................","........................"],"k":["........................","........................","........................","........................","........................","........................","......6666767666661.....","......6666676667661.....",".....64443444434440.....",".....63333333333330.....",".....61111111111110.....",".....63333333333330.....",".....63333333333330.....",".....63333333333330.....",".....63333333333330.....",".....61111111111110.....","....6611111111111121....","....6633333333333311....","....7833333333333322....","....7677777777777766....","....2222265544444333....","....3333333333333322....","........................","........................","........................","........................","........................"],"obs":[[0.0,0.0,5.8]],"tall":true},"stele_b":{"w":26,"h":28,"ax":14,"ay":21,"sink":0,"fp":[-10,-3,9,3],"rows":["..........................","..........................","..........................","..........................","..........................","..........................",".............2550.........","........255555660.........",".....2555566666650........","....26666665444440........","....05433333333330........",".....1111111111110........",".....13332233333330.......",".....13333333333330.......",".....03334333333330.......","......1344333333330.......","......12222222222220ssssss","......1111111111111130ssss","......1333333333333130ssss","......1334333333333330ssss","......1444444444444450sss.","......144444544bb44440ss..","......000000000000000os...","..........................","..........................","..........................","..........................",".........................."],"hts":["00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","0000000000000deee000000000","00000000cdddddeee000000000","00000ccccdddddeeec00000000","0000cccccddddddddc00000000","0000bccccccccccccb00000000","00000bbbbbbbbbbbba00000000","00000aaaaaaaaaaaaa80000000","00000999999999999980000000","00000888888888888870000000","00000077777777777770000000","00000066666666666664000000","00000045555555555554220000","00000034444444444444220000","00000023333333333333220000","00000022222222222222220000","00000012222222222111110000","00000011111111111110000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000"],"n":["..........................","..........................","..........................","..........................","..........................","..........................",".............1110.........","........111111110.........",".....11111111116jl........","....h11116jjwwwwwl........","....h6wwwwwwwwwwwl........",".....wwwwwwwwwwwwl........",".....wwwwwwwwwwwwwl.......",".....Ewwwwwwwwwwwwl.......",".....zwwwwwwwwwwwwl.......","......wwwwwwwwwwwwo.......","......zwwwwwwwwwwwol......","......Hwwwwwwwwwwwwl00....","......zwwwwwwwwwwwwt00....","......0wwwwwwwwwwwwo00....","......0666666666666600....","......136bbjjjjjwwwwww....","......wwwwwwwwwwwwwwww....","..........................","..........................","..........................","..........................",".........................."],"k":["..........................","..........................","..........................","..........................","..........................","..........................",".............7776.........","........777777776.........",".....7777887778740........","....87778875333330........","....82111333333330........",".....1111111111110........",".....33333333333330.......",".....43333333333330.......",".....53333333333330.......","......3333333333331.......","......11111111111100......","......1111111111111021....","......5333333333333021....","......7333333333333122....","......7777777777777766....","......2222215544443333....","......4333333333332332....","..........................","..........................","..........................","..........................",".........................."],"obs":[[0.0,0.0,5.8]],"tall":true},"pave_a":{"w":44,"h":24,"ax":22,"ay":13,"sink":0,"fp":[-18,-7,19,7],"rows":["............................................","............................................","............................................","............................................","............................................","....233333333333333333333330................","....144444444444344444444440s...............","....144444445544454444444440................","....144444444444454444444440s...............","....144444444444444444544440s...............","....144444444444444444444440s...............","....144444444344444444444440s...............","....133333443333000000000000333334333330....","....144444444440s...........144444444440s...","....144443444440s...........144444444440s...","....144444344440s...........144444454440s...","....144444434440s...........155544545440....","....144444443440s...........144544444440....","....044444333340s...........14444444444o....",".....0000000000os...........0000000000os....","............................................","............................................","............................................","............................................"],"hts":["00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111111111111111110000000000000000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111110000","00001111111111110000000000001111111111100000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000"],"n":["............................................","............................................","............................................","............................................","............................................","....000000000000202000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000000000000000................","....000000000000wwwwwwwwwwww000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....000000000000............000000000000....","....100000000000............000000000000....",".....RRRRRRRRRRR............RRRRRRRRRRR.....","............................................","............................................","............................................","............................................"],"k":["............................................","............................................","............................................","............................................","............................................","....666667666676666666666666................","....666666666666676666666666................","....667667666766676666666666................","....766766666666666666666666................","....666676666666766666666666................","....766667667666666666666666................","....666766666666676666666666................","....666666666666444444444334666666666666....","....666776666666............676676666766....","....766667666666............666666666666....","....766766676666............667666666666....","....766667666676............666666666666....","....766666666666............666666666665....","....766667666666............666666766665....",".....33333333333............33333333333.....","............................................","............................................","............................................","............................................"],"obs":[]},"pave_b":{"w":56,"h":31,"ax":28,"ay":16,"sink":0,"fp":[-25,-11,25,11],"rows":["........................................................","........................................................","........................................................","........................................................","........................................................","................233344454443344333333333333333333340....","................144444444444444444444443344434444440s...","................144444444444444444444443444434444440s...","................144444444444544444444444344443444440s...","................144444444444444444454444444444345440s...","................144444444444444444444444444444434440s...","................144444434334444434444444444443333430....","....245443333444333333333333333333333444444444444330....","....144445444444444444444443344444444444444344444440s...","....144455444444444444444443444444444443444344444440s...","....144445544444344444444553444444555544444434444440s...","....144444444443444444444543444444555544445434444440s...","....144444444443444444444443444444444444444434444440s...","....144344444444000000000000000000000000444444334440s...","....134333444330s.......................00000000000o....","....144444554440s.......................................","....144445444440s.......................................","....144444444550s.......................................","....144544454450s.......................................","....144444444440s.......................................","....00000000000os.......................................","........................................................","........................................................","........................................................","........................................................","........................................................"],"hts":["00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00000000000000001111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111111111111111111111111111111111111111110000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111110000000000000000000000000000000000000000","00001111111111100000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000"],"n":["........................................................","........................................................","........................................................","........................................................","........................................................","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................000000000000000000000000000000000000....","................111111111100000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000000000000000000000000000000000000000....","....100000000000611111101000000000000000000000000000....","....000000000000........................EEEEEEEEEEEE....","....000000000000........................................","....000000000000........................................","....000000000000........................................","....000000000000........................................","....000000000000........................................","....000111001110........................................","........................................................","........................................................","........................................................","........................................................","........................................................"],"k":["........................................................","........................................................","........................................................","........................................................","........................................................","................666766666667676666666666666666666666....","................666676666666766667666667666667666676....","................666666666666666667666666666666776666....","................666666676666666666666666677666666666....","................667667666666666666676666766666666666....","................666676666666766676666666666667666666....","................777777777777666666666666667666666665....","....766666676666666666666666666667666666766666666666....","....766666666766666666666666666666766666666666666667....","....766676666666666666666666666666666677666676666666....","....766666666766666676666666667666666666667667666666....","....766666666666666666666666666666667666666666676667....","....766676676666666676676675667666666666766676666666....","....867766766776777777777675676676676777666666676666....","....666666666666........................212111211111....","....666666766666........................................","....666666666666........................................","....767666766666........................................","....676666676666........................................","....666666666666........................................","....777777677776........................................","........................................................","........................................................","........................................................","........................................................","........................................................"],"obs":[]},"pave_c":{"w":32,"h":24,"ax":16,"ay":13,"sink":0,"fp":[-13,-7,13,7],"rows":["................................","................................","................................","................................","................................","....233333344430..2330.2330.....","....144444444444344444444440....","....144444444544445455444440....","....144444444443445444444440....","....144444444444444444444440....","....144444444444344454444440....","....133444444443444444444440s...","....000000000000333344433330s...","................144444444440s...","................144444444440s...","................144444444440s...","................144444444440s...","................144444444540s...","................144444444440s...","................00000000000o....","................................","................................","................................","................................"],"hts":["00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00001111111111110011110111100000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00001111111111111111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000001111111111110000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000","00000000000000000000000000000000"],"n":["................................","................................","................................","................................","................................","....000000000000..2222.0000.....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....000000000000000000000000....","....wwwwwwwwwwww000000000000....","................000000000000....","................000000000000....","................000000000000....","................000000000000....","................000000000000....","................000000000000....","................+///////////....","................................","................................","................................","................................"],"k":["................................","................................","................................","................................","................................","....666666766666..5555.6666.....","....666666666666666666666665....","....666667766666666667666765....","....666666667667667676666666....","....666767666666666666666666....","....667667666676666666666676....","....666666766666766766666666....","....333333333332667666666666....","................667676676666....","................666666666666....","................667666666666....","................667666676666....","................666666666766....","................666766666666....","................111111111111....","................................","................................","................................","................................"],"obs":[]},"steps_a":{"w":26,"h":23,"ax":13,"ay":13,"sink":0,"fp":[-9,-5,9,5],"rows":["..........................","..........................","..........................","..........................","..........................","....255555555555555550....","....155555555555555550....","....166665555555655550sss.","....166666666666666660sss.","....144434444444444440sss.","....165555555555555550sss.","....06555555555555552os...",".....166666666c666660ss...",".....13333333bbbbb330ss...",".....1556555555555550s....",".....1555555555555550s....",".....1655555666666650s....",".....000000000000000o.....","..........................","..........................","..........................","..........................",".........................."],"hts":["00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00003333333333333333330000","00003333333333333333330000","00003333333333333333330000","00003333333333333333330000","00002222222222222222220000","00001222222222222222210000","00001222222222222222200000","00000222222222222222200000","00000211111111111111100000","00000111111111111111100000","00000111111111111111100000","00000111111111111111100000","00000111111111111111000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000","00000000000000000000000000"],"n":["..........................","..........................","..........................","..........................","..........................","....000000000000000000....","....000000000000000000....","....000000000000000000....","....001111111111111113....","....wjjjjjjjjjjjjjjjjw....","....r0000000000000000w....","....E0000000000000000W....",".....0000000000000000.....",".....wwwwwwwwwwwwwwww.....",".....100000000000000l.....",".....100000000000000l.....",".....100000000000000l.....",".....rwwwwwwwwwwwwwwt.....","..........................","..........................","..........................","..........................",".........................."],"k":["..........................","..........................","..........................","..........................","..........................","....666666666666666665....","....667666676667666665....","....676666666666666675....","....777777777777777776....","....355555555555666662....","....666666666766766661....","....366666666766666660....",".....6666666666666676.....",".....3333333333333433.....",".....8667676666666660.....",".....8666676666666660.....",".....8666666676667660.....",".....4333333433333330.....","..........................","..........................","..........................","..........................",".........................."],"obs":[]},"blocks_a":{"w":21,"h":24,"ax":12,"ay":13,"sink":0,"fp":[-8,-3,5,6],"rows":[".....................",".....................",".....................",".....................",".....................",".....................","..........250........",".........2555560.....","........255556640....",".......2552666520....","......25555565220sss.",".....25555565222ossss",".....1666665222ossss.","....2555555212ossss..","....1555555210ssss...","....155555521ossss...","....0cc55532ossss....",".....000005ossss.....","..........oss........",".....................",".....................",".....................",".....................","....................."],"hts":["000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000055500000000","000000000555555500000","000000005555555540000","000000055555555430000","000000555555554320000","000006555555543200000","000005556665532000000","000044455555420000000","000033444444310000000","000023333333200000000","000012222222000000000","000001111110000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000","000000000000000000000"],"n":[".....................",".....................",".....................",".....................",".....................",".....................","..........000........",".........1000010.....","........10000018t....",".......00010008tt....","......00000020ttt....",".....02222000tttt....",".....rre6100tttt.....","....urrrrrrtttt......","....mrrrrrrttt.......","....mrrrrrrttt.......","....rrrrrrrtt........",".....Mrrrrrt.........","..........E..........",".....................",".....................",".....................",".....................","....................."],"k":[".....................",".....................",".....................",".....................",".....................",".....................","..........776........",".........7777777.....","........877777720....",".......6677777300....","......56556554000....",".....555555540000....",".....66787540000.....","....76666660000......","....7666666000.......","....7666666000.......","....766666100........",".....1466660.........","..........3..........",".....................",".....................",".....................",".....................","....................."],"obs":[[-0.2,0.3,3.4],[-2.7,3.2,3.7]]},"blocks_b":{"w":24,"h":22,"ax":12,"ay":12,"sink":0,"fp":[-8,-1,9,5],"rows":["........................","........................","........................","........................","........................","........................","........................","........................",".......2555552560.......","....06555555523460......",".....15555566233550s....",".....166666544234420s...",".....15433444322111oss..",".....1333344422110oss...",".....13333443210osss....",".....033bbbbb0osss......","......000000os..........","........................","........................","........................","........................","........................"],"hts":["000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000055555564440000000","000045555555564433000000","000005555555564333300000","000005555555554333320000","000004444444444222200000","000003433334433111000000","000002322222322000000000","000001111112210000000000","000000000001000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000","000000000000000000000000"],"n":["........................","........................","........................","........................","........................","........................","........................","........................",".......1111110000.......","....u1011111110000......",".....40111111100000.....",".....611116jjwj10bBt....",".....jwwwwj6bwtzBBBB....",".....rwwwwrEwwoEBBB.....",".....zwwwwErwwwEB.......",".....zwwwwrrwww.........","......wwwwrrB...........","........................","........................","........................","........................","........................"],"k":["........................","........................","........................","........................","........................","........................","........................","........................",".......7777775666.......","....77677777772266......",".....87777777722666.....",".....877777643126400....",".....743326763010000....",".....53333443101000.....",".....522234431210.......",".....6333344112.........","......3332440...........","........................","........................","........................","........................","........................"],"obs":[[-2.5,3.1,3.3],[3.8,1.0,2.5],[-2.2,2.9,3.8]]},"wall_d":{"w":47,"h":32,"ax":29,"ay":20,"sink":0,"fp":[-25,-3,15,8],"rows":["...............................................","...............................................","...............................................","...............................................","...............................................",".............................25555555555550....",".............................15555555555550....",".............................16555555555650....",".............................16555555555550....",".............................16666666666660....",".............................15555556666660....",".............................11111112222220....","...............2555555555555413333333333330....","...............1555555555555313334333333330....","...............1255555555555313333333333330ssss","...............1666666666666453334333333330ssss","...............1555555555555342222222222220ssss","...............1333334443444243333333333330ssss","..........2660.1333334333444244444444333440ssss",".......266556214333333333344243444344334430ssss","......255556321223aaaaaaaaaaa111aaaa11aaaa0ssss",".....2555655222100000000000000000000000000osss.",".....16544443220ssss...........................",".....1444444422osss............................",".....0b4444444ossss............................","......0bbbb40ossss.............................",".......0000osssss..............................","...............................................","...............................................","...............................................","...............................................","..............................................."],"hts":["00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000cccccccccccccc0000","00000000000000000000000000000bbbbbbbbbbbbbb0000","00000000000000066666666666666aaaaaaaaaaaaaa0000","00000000000000066666666666666999999999999990000","00000000000000066666666666666888888888888880000","00000000000000066666666666666777777777777770000","00000000000000066666666666666666666666666660000","00000000000000055555555555555555555555555550000","00000000005566044444444444444444444444444440000","00000004455666533333333333333333333333333330000","00000034456665422222222222222222222222222220000","00000344555655431111111111111111111111111100000","00000344444554320000000000000000000000000000000","00000333333444300000000000000000000000000000000","00000222222333000000000000000000000000000000000","00000011111220000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000"],"n":["...............................................","...............................................","...............................................","...............................................","...............................................",".............................10000000000000....",".............................10000000000000....",".............................10000000000000....",".............................10000000000000....",".............................40000000000000....",".............................eb6bbbbbbbjjjj....",".............................uwwwwwwwwwwwww....","...............0000000000000drwwwwwwwwwwwww....","...............00000000000008rwwwwwwwwwwwww....","...............00000000000008rwwwwwwwwwwwww....","...............00000000000008rwwwwwwwwwwwww....","...............jjjjjjjjjjjjjorwwwwwwwwwwwww....","...............wwwwwwwwwwwwwBEwwwwwwwwwwwww....","..........4448.wwwwwwwwwwwwwBwwwwwwwwwwwwww....",".......444440llwwwwwwwwwwwwwBEwwwwwwwwwwwww....","......444444lllwwwwwwwwwwwwwyuwwwwwwwwwwwwy....",".....4444errglllwwwwwwwwwwwwtrwwwwwwwwwwwwo....",".....4errrrrwlll...............................",".....rrrrrrrrgll...............................",".....rrrrrrrrwl................................","......rrrrrrrE.................................",".......EMEEE...................................","...............................................","...............................................","...............................................","...............................................","..............................................."],"k":["...............................................","...............................................","...............................................","...............................................","...............................................",".............................76666666766665....",".............................86667666667666....",".............................86666666676666....",".............................86666666766666....",".............................86666666666666....",".............................97776667666666....",".............................21111111111111....","...............6666766666666153333333333333....","...............6676666666676153333333333333....","...............6766666666676153333333333333....","...............6676666667766153333333333333....","...............5555555555555041111111111110....","...............4333333333333043333333333331....","..........8880.3333333333333043333333333331....",".......888885003333333333333043333333333331....","......8878880001111111111111021111111111110....",".....88889640000111111111111011111111111110....",".....88555454000...............................",".....45455555000...............................",".....5555554540................................","......54455544.................................",".......32422...................................","...............................................","...............................................","...............................................","...............................................","..............................................."],"obs":[[-10.7,0.0,3.2],[-5.1,0.0,3.2],[3.3,0.0,3.2],[8.9,0.0,3.2]],"brk":[-14,0],"tall":true},"wall_e":{"w":61,"h":40,"ax":36,"ay":26,"sink":0,"fp":[-33,-3,22,10],"rows":[".............................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................2555555555550.25555555555550....",".............................1555555555555365555555555550....",".............................1555555555555365556555555550....",".............................1555555555555465555555555550....",".............................1666666666666366666666666660....",".............................1444444444445354444444555550....","...............255555553555551221221112111121111111111110....","...............155555555555541344433333333243333333233230....","...............155555555555541344443333333243333333333330....","...............165525555555541344333333333243333333333340....","...............166666666666654333333333333143333333333330....","...............144344344444433222222222223122222222222220....","...............132222222222334444334334433133323322232220....","...............132222122112434444333334333133343333443330ssss","...............132233233333434444343334344233433333333330ssss","...............112133233233334444443333344233111111111110ssss","...............122123223223323332222222222133222222222220ssss","...............132123223333424444444444333254444444444440ssss","...............132233333333334333334444333243333333344440ssss","...............132233333333334333334444333243333333333430ssss","...............122233333333434333334334333243333333343330ssss","......2555660..132444444444323222222222222122222222222220ssss","....2555555660.00000000000000000000000000000000000000000osss.","....15666533330..............................................","....15553333330ss............................................","....05554333330ssss..........................................",".....0554333330sssss.........................................","......05533330osss...........................................",".......00000osss.............................................",".........ssss................................................",".............................................................",".............................................................",".............................................................",".............................................................","............................................................."],"hts":["0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000ijjiiiiiiiiii0jjjjjjjjjjjjjj0000","00000000000000000000000000000iiiiiiijiiiiiijjjjjjjjjjjjjj0000","00000000000000000000000000000iiiiijiiiiijiijjjjjjjjjjjjjj0000","00000000000000000000000000000ijjiiiiiiijiiijjjjjjjjjjjjjj0000","00000000000000000000000000000iiijiiiiiiiiiijjjjjjjjjjjjjj0000","00000000000000000000000000000iiiiiiiiiiiiiiiiiiiiiiiiiiii0000","000000000000000cccccccccccccdhhhhhhhhhhhhhhhhhhhhhhhhhhhh0000","000000000000000cccccccccccccdgggggggggggggfgggggggggggggg0000","000000000000000cccccccccccccdffffffffffffffffffgggggggggg0000","000000000000000cccccccccccccdeeeeeeeeeeeeeeeeeeffffffffff0000","000000000000000cccccccccccccdddddddddddddddddddeddeeeeeee0000","000000000000000cccccccccccccccccccccccccccbcccccccccccccc0000","000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000","000000000000000aa9999999999aaaaaaaaaaaaaaa9aaaaaaaaaaaaaa0000","0000000000000009988888888889999999999999998999999999999990000","0000000000000008877777777778888888888888888888888888888880000","0000000000000007766666666667777777777777777777777777777770000","0000000000000006655555555556666666666666666666666666666660000","0000000000000005544444444445555555555555555555555555555550000","0000000000000004433333333334444444444444444444444444444440000","0000000000000003322222222223333333333333333333333333333330000","0000004445555002222222222222222222222222222222222222222220000","0000455555666601111111111111111111111111111111111111111100000","0000345666655550000000000000000000000000000000000000000000000","0000234555554440000000000000000000000000000000000000000000000","0000123444444330000000000000000000000000000000000000000000000","0000012343333320000000000000000000000000000000000000000000000","0000001233222200000000000000000000000000000000000000000000000","0000000122210000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000"],"n":[".............................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................0000000000000.10000000000000....",".............................0000000000000d10000000000000....",".............................0000000000000l10000000000000....",".............................0000000000000d10000000000000....",".............................0000000000000l10000000000000....",".............................111111111111jtrwwwwwwjjjjjww....","...............10000000000000wwwwwwwwwwwwwtuwwwwwwwwwwwwy....","...............10000000000000wwwwwwwwwwwwwtrwwwwwwwwwwwww....","...............10000000000000wwwwwwwwwwwwwtEwwwwwwwwwwwww....","...............10000000000000wwwwwwwwwwwwwtEwwwwwwwwwwwww....","...............00000000000000wwwwwwwwwwwwwtrwwwwwwwwwwwww....","...............Ewwwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwwo....","...............Ewwwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwww....","...............wwwwwwwwwwwwwwwwwwwwwwwwwwwywwwwwwwwwwwwwo....","...............wwwwwwwwwwwwwwwwwwwwwwwwwwwywwwwwwwwwwwwwo....","...............uywwwwwwwwwwwwwwwwwwwwwwwwwtwwwwwwwwwwwwwy....","...............rowwwwwwwwwwwBEEEERRRZZZ///yEwEwwwwwwwwwwB....","...............wwwwwwwwwwwwww6bb66666666668jwjwwwwwwwwwwo....","...............EwwwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwo....","...............rwwwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwB....","...............wowwwwwwwwwwwwwwwwwwwwwwwwwBwwwwwwwwwwwwwB....","......2222222..ww0000000000mtEwwwwwwwwwwwwyrwwwwwwwwwwwwt....","....m42222223b.rwwwwwwwwwwwwowwwwwwwwwwwwwtwwwwwwwwwwwwwB....","....uuu93boooog..............................................","....uuuuoooooot..............................................","....uuuuoooooog..............................................",".....uuujoooooo..............................................","......uujoooooo..............................................",".......urooJJ................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................................................","............................................................."],"k":[".............................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................6666666666666.76766666666666....",".............................7666767666666076666766676665....",".............................6666666666676076676666666665....",".............................6766666667667076666666666665....",".............................6666666667666076666666667665....",".............................2222222222226054444444444443....","...............766666666766651111111111111021111111111110....","...............766666676666653333333333333043333333333332....","...............766666667667653333333333333043333333333332....","...............777676666666653333333333333043333333333332....","...............766667667666653333333333333043333333333332....","...............433333333333314111111111114011111111111110....","...............331111111111313433334433333033313311111110....","...............431131111111313433334334333043343333333331....","...............431333333333313333334333333043333333333330....","...............101333333333313333343334334033111111111110....","...............101333333333100000000000000011111111311210....","...............431333333333317777777777222144444444444440....","...............431333333333313333333333333033333333333330....","...............131333333333313333333333333043333333333330....","...............401333333333313333333333333043333333333330....","......6666666..432666666666201111111111111011111111111110....","....8866666763.131111111111101111111111111011111111111110....","....66796422221..............................................","....76662222220..............................................","....66663222221..............................................",".....6664222222..............................................","......665222222..............................................",".......662200................................................",".............................................................",".............................................................",".............................................................",".............................................................",".............................................................","............................................................."],"obs":[[-17.7,0.0,3.2],[-12.1,0.0,3.2],[-3.7,0.0,3.2],[1.9,0.0,3.2],[10.3,0.0,3.2],[15.9,0.0,3.2]],"brk":[-21,0],"tall":true},"wall_f":{"w":38,"h":27,"ax":14,"ay":14,"sink":0,"fp":[-11,-3,21,9],"rows":["......................................","......................................","......................................","......................................","......................................","......................................","....25555555555466555550..............","....15555555555466555550..............","....15255555555466555550..............","....16666666666566666660..............","....15556565555466666660ssssss........","....13343333344243334330ssssss........","....13443343344243333330ss0sss........","....1343334444424333343355666660......","....aa1aaaa111aaaaab344cccc555640.....","....0000000000000000026c555564220.....",".....................055556622220s....","......................155565222220sss.","......................155555212210ssss","......................00c555312a0oss..","........................00c5420oss....","..........................000oss......",".............................s........","......................................","......................................","......................................","......................................"],"hts":["00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00006666666666666666666600000000000000","00005555555555555555555500000000000000","00004444444444444444444400400000000000","00003333333333333333333345555566000000","00002222222222222222224555556666600000","00001111111111111111134555666665500000","00000000000000000000033445566554400000","00000000000000000000002334455443330000","00000000000000000000001223344433220000","00000000000000000000000112233322100000","00000000000000000000000001122210000000","00000000000000000000000000011000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000","00000000000000000000000000000000000000"],"n":["......................................","......................................","......................................","......................................","......................................","......................................","....00000000000510000000..............","....00000000000010000000..............","....00000000000510000000..............","....00000000000510000000..............","....jjjjjjjjjjjojjjjjjjb..............","....wwwwwwwwwwwoEwwwwwww..............","....wwwwwwwwwwwoEwwwwwww..2...........","....wwwwwwwwwwwoEwwwwwww22412222......","....uwwwwwwwwwwyuwwwww222222220gg.....","....EwwwwwwwwwwBrwwwwzm912122gogo.....",".....................zzzzzzegoggg.....","......................zzzzzzggtgot....","......................zzzzzzogtggt....","......................zzzzzzooggoB....","........................zzzzwgoB......","..........................MzrB........","......................................","......................................","......................................","......................................","......................................"],"k":["......................................","......................................","......................................","......................................","......................................","......................................","....66666666666286666666..............","....76666766667377666666..............","....76667666676376666665..............","....76666666666376666665..............","....66556655555276666665..............","....33333333333043333332..............","....33333333333043333332..6...........","....4333333333314333343277777777......","....11111111111011133367676767620.....","....11111111111043133789877773000.....",".....................666666800000.....","......................666666000000....","......................666666000000....","......................666666200000....","........................66664000......","..........................0550........","......................................","......................................","......................................","......................................","......................................"],"obs":[[-6.7,0.0,3.2],[-1.1,0.0,3.2],[5.3,0.0,3.2]],"brk":[10,0],"tall":false},"side_c":{"w":16,"h":41,"ax":8,"ay":27,"sink":0,"fp":[-5,-10,4,10],"rows":["................","................","................","................","................","....2555530.....","....1655550.....","....1655550.....","....1555520.....","....1555550.....","....15cc550.....","....155c5520....","....16555520....","....16555520....","....16555520.sss","....16555520ssss","....16525520ssss","....16255520ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16555550ssss","....16666260ssss","....11666620ssss","....13334440ssss","....11344440ssss","....12222220ssss","....11111110ssss","....13333330ssss","....13333330ssss","....14444440ssss","....13334440ssss","....11112210ssss","....11111220ssss","....0bb3333ossss",".....00000o.s...","................","................","................","................"],"hts":["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccc00000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000ccccccca0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000cccccccc0000","0000bccccccc0000","0000bccccccc0000","0000abbbbbbb0000","00009aaaaaaa0000","0000899999990000","0000788888880000","0000777777770000","0000666666660000","0000555555550000","0000444444440000","0000333333330000","0000222222220000","0000111111100000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"],"n":["................","................","................","................","................","....0000000.....","....0000000.....","....1000000.....","....1000000.....","....1000000.....","....1000000.....","....1000000d....","....1000000d....","....4000000d....","....4000000d....","....4000000d....","....4000000d....","....4000000d....","....4000000l....","....4000000l....","....9000000d....","....h000000d....","....h000000d....","....h0000008....","....ujjjjjjg....","....uwwwwwwB....","....uwwwwwwB....","....Czwwwwwy....","....uwwwwwwt....","....uwwwwwwB....","....4001011l....","....zwwwwwwt....","....zwwwwwwt....","....Cwwwwwwy....","....uwwwwwwy....","....zwwwwwwy....",".....EEEEEE.....","................","................","................","................"],"k":["................","................","................","................","................","....7666666.....","....7666666.....","....7666666.....","....7666766.....","....7666666.....","....7666666.....","....76666760....","....86666660....","....86666660....","....86666670....","....86666660....","....86666660....","....86666760....","....86666660....","....86666660....","....86666660....","....87666660....","....86666661....","....86766661....","....76666661....","....63333330....","....63333330....","....52111110....","....61111110....","....63333330....","....82222220....","....63433330....","....63333330....","....11111100....","....61111110....","....63333330....",".....111111.....","................","................","................","................"],"obs":[[0.0,-7.5,4.1],[0.0,-2.7,4.1],[0.0,2.1,4.1],[0.0,6.9,4.1]],"tall":true}};/*RUIN_BIG_END*/
/* 倒れた石柱・部屋の残骸（tools/ruin3d.py が書き出す）。rows＝色、hts＝ドットごとの地面からの高さ、ax/ay＝原点、obs＝当たり判定。
   描くときは、そのドットの真下の地面（高さぶん下）が水かを見て、沈んだ所は水に透かし、水際は濡らす。 */
/* ---------- 遺跡の経年（水の層の深い側） ----------
   2026-10-07 ユーザー要望「15階以降の遺跡パーツはもっと苔などをいっぱいつけて時間の経過を表現したい」。
   水の層の何階目かで強さ RUIN_AGE を決める（5階目＝15階 0.17 → 10階目＝20階 1.0）。遺跡の絵の各ドットを、描く直前に：
   - 上を向いた面（3Dの面の向きの上成分 > .5）：塊のノイズで苔が積もる（16階で4割・20階で7割ほど。敷石はその半分強）
   - 根元（地面からの高さ h）：2〜14ドットまで、まだらに這い上がる
   - 垂れる筋：13列に1〜5列、縦長のまだらで、上から垂れた苔・蔦の筋
   塊の縁は網目で揺らす。苔の中は粒で1段上下させ、ところどころ明るい芽。下の石を15%残す。
   - 苔の無い所：所々の縦の筋をわずかに暗く（水の染み）
   苔の色は元の石の明るさから4段を選ぶので、ランタンの当たり（明るい面・暗い面）はそのまま残る。
   CAVE.ruinAge に数を入れると強さを上書き（見比べ用。0で無し）。 */
let RUIN_AGE=0;
const RUIN_MOSS=[C('#252b19'),C('#384326'),C('#525d36'),C('#6f7a48')], RUIN_MOSS_HI=C('#93a05a');
const RUIN_IVY=[C('#14281a'),C('#21442a'),C('#34683a'),C('#5a9a4c')];                                    // 蔦（苔より青い緑）
const RUIN_SHROOM=[C('#6e6250'),C('#b8a888'),C('#ddd0b4'),C('#f4ead6'),C('#9a8e78')];                  // キノコ：傘の影・傘・傘の明・照り・柄
const RUIN_SHROOM_G=[C('#2e6a6a'),C('#5ec0b4'),C('#a8f0e0'),C('#e8fff8'),C('#7aa8a0')];                // 青白く光るキノコ   // くすんだ緑（黄色に寄ると石が全部黄色く見えた）
/* 遺跡の明るさ（2026-10-07 ユーザー報告「ライトの影響を正しく受けていない遺跡物がある」）。
   前は .5+.5×明るさ で、しかも明るさに .22 の下限があったので、灯りの外でも遺跡が 6〜7割の明るさで浮いていた
   （実測：灯りの無い所で床の輝度 16〜25 に対し、柱 70・倒れた柱 69・石碑 59）。
   今は RUIN_FMIN（灯りの無い所）→ 1（灯りの真ん中）。岩・石筍と同じく、暗がりでは輪郭がやっと分かる程度に沈む。 */
const RUIN_FMIN=.16;
function ruinF(L){ return RUIN_FMIN+(1-RUIN_FMIN)*Math.min(1,Math.max(0,L)*1.4); }
function ruinAgeOf(){
  if(typeof CAVE.ruinAge==='number') return CAVE.ruinAge;
  if(!G||!G.Z||G.Z.id!=='sump') return 0;
  const z=zoneFloor((typeof S!=='undefined'&&S.run&&S.run.depth)||1); return z<5?0:Math.min(1,(z-4)/6);
}
/* flat：敷石など平たい物（上面の苔を半分に） */
function ruinAge(c,X,Y,h,up,sid,flat){
  const A=RUIN_AGE; if(A<=0) return c;
  const sp=v=>(v-.5)*3.2+.5;                                                  // ノイズは .5 の周りに寄っているので広げる
  const n=sp(NZB[(((Y*3)+sid*5)&255)<<8|(((X*3)+sid*3)&255)])   // ×3：塊を物の大きさより細かく（×2だと物ごと全部か無しかになった）
   , n2=NZS[((Y+sid*7)&255)<<8|((X*3)&255)], bj=(BAYER[((Y&3)<<2)|(X&3)]-.5)*.22;
  const lum=((c&255)+((c>>8)&255)+((c>>16)&255))/765, kL=lum<.16?0:lum<.28?1:lum<.42?2:3;
  /* 蔦（2026-10-07「蔦やキノコも追加して」）：根元から面を登る茎。9列に1本ほど（強さで増える）、高さは列ごとに 5〜24 ドット×強さ。
     茎の両隣の列に、3行おきに左右交互の葉。茎は暗い緑、葉は明るい緑（石の明るさで段を選ぶ） */
  if(!flat&&up<=.5){
    const ivyCol=x=>ihash(x,sid*7+3)%9<1+A*1.2, ivyH=x=>(5+ihash(x,sid+11)%20)*A;
    if(ivyCol(X)&&h<ivyH(X)) return RUIN_IVY[Math.max(0,kL-1)];
    for(const dx of [-1,1]) if(ivyCol(X-dx)&&h<ivyH(X-dx)-1&&((h+(dx>0?0:1)+(X-dx))%3===0)) return RUIN_IVY[Math.min(3,kL+1)];
  }
  /* キノコ：根元（h<5）と上面に、4×4 ドットの区画ごとの抽選で小さな傘（幅3・高さ3）。白っぽい傘と、まれに青白く光る傘 */
  if(h<5||up>.5){ const cx=X>>2, cy=Y>>2, hh=ihash(cx*31+sid,cy*17+5);
    if(hh%100<(flat?6:22)*A){ const u=X&3, v=Y&3, glow=(hh>>>8)%5===0, P=glow?RUIN_SHROOM_G:RUIN_SHROOM;
      if(v===1&&u<3) return P[u===1?2:u===0?0:1];                             // 傘（左が影、中が明るい）
      if(v===0&&u===1) return P[3];                                            // 傘の天辺の照り
      if(v===2&&u===1) return P[4];                                            // 柄
    } }
  let m=0;
  if(up>.5){ if(n+bj<(flat?.12+.35*A:.25+.5*A)) m=1; }                       // 上面：16階で4割・20階で7割ほど（敷石はその半分強）
  else if(h<(2+12*A)*(.4+n2)&&n+bj<.25+.5*A) m=1;                            // 根元から這い上がる
  else if(ihash(X,sid)%13<1+4*A&&sp(NZS[((((Y>>1)+sid)&255)<<8)|((X*4)&255)])+bj>1.05-.3*A) m=2;   // 垂れる筋
  if(!m){ if(ihash(X+sid,77)%9===0&&n2>.5) return mixU(c,RP_DARK,.16*A); return c; }   // 水の染み
  let k=kL; if(m===2&&k>0) k--;
  const v=ihash(X*3+sid,Y*5)%9; if(v===0&&k<3) k++; else if(v<=2&&k>0) k--;    // 苔の粒（平らな色の板に見えないように）
  if(v===8&&k>=2) return RUIN_MOSS_HI;                                         // ところどころ明るい芽
  return mixU(RUIN_MOSS[k],c,.15);                                            // 下の石の肌を少し残す
}
/* 遺跡の根元のキノコ（2026-10-07「蔦やキノコも追加して」）。絵の外にはみ出して生える、小さな群れ。
   物ごとに 強さ×85% の確率で1〜2群れ、1群れに2〜4本。傘は幅3か5、柄は2〜4ドット。水の上には生やさない。
   5本に1本は青白く光る傘（暗がりでも見える・周りを少し照らす）。前後は根元の y。 */
function ruinShrooms(d,left,right,L){
  const s=d.s>>>0, A=RUIN_AGE; if(hs(s,4100)%100>=85*A) return;
  const ng=1+(hs(s,4101)%100<50*A?1:0), wg=W.haz&&W.haz.kind==='water'?W.haz.g:null, f=ruinF(L);
  for(let g=0;g<ng;g++){
    const hg=hs(s,4110+g), gx=Math.round(d.x-left*.7+(hg%1000)/1000*(left+right)*.7), gy=Math.round(d.y+1+((hg>>>10)%3));
    if(wg&&hazAt(wg,gx,gy)>.4) continue;
    const n=2+(hg>>>14)%3;
    for(let i=0;i<n;i++){ const h=hs(s,4200+g*10+i), x=gx+(i-((n-1)/2))*3+((h>>>3)%3)-1, y=gy+((h>>>6)%2), sh=2+(h>>>8)%3, wide=(h>>>11)%3===0, glow=(h>>>13)%5===0;
      const P=glow?RUIN_SHROOM_G:RUIN_SHROOM, lit=c=>glow?c:mixU(RP_DARK,c,f);
      occGY=y;
      for(let j=0;j<sh;j++) dpf(x,y-j,lit(P[4]));                                   // 柄
      const cy=y-sh, hw=wide?2:1;
      for(let dx=-hw;dx<=hw;dx++) dpf(x+dx,cy,lit(P[dx<0?(dx===-hw?0:1):dx===0?2:1]));   // 傘
      if(wide){ dpf(x-1,cy-1,lit(P[2])); dpf(x,cy-1,lit(P[3])); dpf(x+1,cy-1,lit(P[1])); } else dpf(x,cy-1,lit(P[3]));
      dpf(x-hw,cy+1,lit(P[0])); dpf(x+hw,cy+1,lit(P[0]));                           // 傘の縁の影
      if(glow) CAVE.nextEmit.push({x,y:cy,r:12,it:.18});
      occGY=null; } }
}
function upOf(sp,r,q){ if(!sp.n) return 0; const i=NRM_IX[(sp.n[r][q]||'.').charCodeAt(0)]; return i<0?0:NRM[i][1]; }
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
  const Lc=[]; for(let cy=0;cy<=H;cy+=8) for(let cx=0;cx<=W;cx+=8) Lc.push(pxLight(x0+cx,y0+cy));
  const cw=(W>>3)+1;
  /* 立ち物の明るさは、絵のドットの所ではなく**根元の、ランタンの側の床**で取る（8ドットの列ごと）。
     絵の上の方は床の上では自分の影の中（ランタンは手前にあるので、柱の影は奥＝絵の上の方に落ちる）。そこで取ると柱の上が真っ暗になった。
     根元のすぐ手前3・7ドットと斜め前の3点の大きい方（根元は当たりの岩になっていて、そこで取ると0になる） */
  const sg=lampY>=d.y?1:-1, Ls=[];
  for(let cx=0;cx<=W;cx+=8){ const X=x0+cx, side=lampX>X?4:-4; Ls.push(Math.max(pxLight(X,d.y+sg*3),pxLight(X,d.y+sg*7),pxLight(X+side,d.y+sg*4))); }
  /* 敷石は「地面に残った石の床」に見せる（ユーザー評価：上に置いた厚紙に見える）:
     立ち石より1段暗く、外の縁に輪郭を引かず半分だけ地面に溶かし、所々欠かす。縁に1〜2か所マス大の欠け。 */
  const pave=/^pave_/.test(d.name||''), pm=pave?paveMask(d,sp):null;
  const cap=sp.n?relightCap(sp,Math.round(d.x),Math.round(d.y)):6, shK=bakedShadowK(d.x,d.y);
  const stand=!/^(pave|steps)_/.test(d.name||'');                               // 立ち物だけ前後を控える（敷石・段は床）
  for(let r=0;r<H;r++){ const row=sp.rows[r], hr=sp.hts[r], Y=y0+r-DB0y; if(Y<0||Y>=bh) continue;
    for(let q=0;q<W;q++){ const ch=row[q]; if(ch==='.') continue; const X=x0+q-DB0x; if(X<0||X>=bw) continue;
      if(pave){ const m=pm[r*W+q]; if(!m) continue;
        const k=Y*bw+X, hp=parseInt(hr[q],36), wet=_bigW[(r+hp)*W+q]===1, L=Lc[(r>>3)*cw+(q>>3)], f=ruinF(L);
        const n=ch>='0'&&ch<='6'?ch.charCodeAt(0)-48:2; let c=mixU(RP_DARK,RP_T[Math.max(1,Math.min(4,n-1))],f);
        if(RUIN_AGE>0) c=ruinAge(c,x0+q,y0+r,0,1,d.s&255,true);                             // 敷石の目地にも苔（上面の半分）
        buf[k]=mixU(buf[k],c,(m===2?.5:1)*(wet?.5:1)); if(!wet) wmask[k]=0; continue; }
      const k=Y*bw+X, hp=parseInt(hr[q],36), gr=r+hp, wet= gr<H+ext && _bigW[gr*W+q]===1;
      const L=Ls[q>>3], f=ruinF(L);
      if(ch==='s'){ if(shK>0) buf[k]=mixU(buf[k], wet?RP_WSH:RP_DARK, (wet?.5:.38)*shK); continue; }
      if(ch==='G'||ch==='H'||ch==='S'){ if(wet) continue; buf[k]=mixU(RP_DARK, ch==='S'?RP_T[3]:RP_GND[ch==='G'?0:1], f); wmask[k]=0; continue; }
      let c= sp.n ? relightPx(ch,sp.n[r][q],sp.k[r][q],x0+q,y0+r,hp,cap) : ch>='0'&&ch<='6' ? RP_T[ch.charCodeAt(0)-48] : RUIN_SPR_PAL[ch];
      c=mixU(RP_DARK,c,f);
      if(RUIN_AGE>0) c=ruinAge(c,x0+q,y0+r,wet?Math.max(0,hp-(sp.sink||0)):hp,upOf(sp,r,q),d.s&255);   // 水の中の物は水面からの高さ（水際に藻が付く）
      if(wet){ const sk=sp.sink||0;                                            // 水の中では sk ドットぶん沈んだ扱い
        if(hp<sk-2) continue;                                                   // 水面よりずっと下：見えない（水のまま）
        if(hp<sk){ buf[k]=mixU(buf[k],c,.32); continue; }                       // 水面のすぐ下：水に透ける（印は残す＝一緒に揺れる）
        if(hp<sk+1){ buf[k]=mixU(buf[k],c,.5); continue; }                      // 水面の行：半々
        if(hp<sk+3) c=mixU(mixU(RP_DARK,c,.8),RP_WET,.15);                      // 水際は濡れて暗い
      }
      buf[k]=c; wmask[k]=0; if(stand) occD[k]=y0+r+hp; } }
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
  const f=ruinF(L), lit=c=>mixU(RP_DARK,c,f);
  const idx=(px,py)=>{ px-=DB0x; py-=DB0y; return (px<0||py<0||px>=bw||py>=bh)?-1:py*bw+px; };
  const put=(px,py,c)=>{ const k=idx(px,py); if(k<0) return; buf[k]=lit(c); wmask[k]=0; occD[k]=y; };     // 柱の前後は根元の y で
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
      if(RUIN_AGE>0){ const lc=lit(c), ac=ruinAge(lc,x0+q,py,Math.max(0,bot[q]-r),upOf(sp,r,q),s&255); if(ac!==lc){ const k=idx(x0+q,py); if(k>=0){ buf[k]=ac; wmask[k]=0; occD[k]=y; } continue; } }
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
  const f=ruinF(L), lit=c=>mixU(RP_DARK,c,f);
  const idx=(px,py)=>{ px-=DB0x; py-=DB0y; return (px<0||py<0||px>=bw||py>=bh)?-1:py*bw+px; };
  const put=(px,py,c)=>{ const k=idx(px,py); if(k<0) return; let v=lit(c); if(RUIN_AGE>0) v=ruinAge(v,px,py,y-py,py<=topY(px-x0)+1?1:0,s&255); buf[k]=v; wmask[k]=0; occD[k]=y; };   // 経年の苔（手続きの柱も）。前後の印は根元の y（水面の映り込みにも使う）
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
  const f=ruinF(L), lit=c=>mixU(RP_DARK,c,f);
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
  { const P_=lay.px, f=ruinF(L);
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
/* ---------- 北の岩壁（石の層）----------
   2026-10-05 ユーザー要望「ドラクエのような角度のビューの想定にするために、北側に壁をつけたい」→「ライトの影響も受けるようにして」。
   床の北の縁（岩の真下が床になるドット列）ごとに、tools/wall3d.py が 3D から作った岩肌の面（WALL_SPR）を立てる。
   - 面は 8 マス周期で横に繋がる。列ごとに貼るので、縁が波打っても面はその縁に沿う。
   - 光は岩・石筍（drawCaveSprite）と同じ式で、毎フレーム、ランタンの位置から当てる（面の向き・くぼみ・高さを持たせてある）。
     明るさの強さは、面の足もとの床の明るさ（pxLight：灯りの届く距離・岩の影・光る物）で決める。
   - 面は岩のマスの上にだけ描く（薄い岩の向こうの部屋の床には描かない）。足もとの岩屑だけ床に出る。
   - 東西の壁との角の近く（縁が横に続いていない所）には立てない。角の部品はまだ無い。
   - キャラより奥：前後の y（occGY）は面の足もと。
   CAVE.northWall=false で消える（見比べ用）。 */
const WALL_AMB=.20, WALL_KD=.95, WALL_TOP=.22;
/* 網掛け（2026-10-05 ユーザー要望「左右の壁の網掛け表現を北側にも同じようにかけてほしい」）
   左右の壁の縁（rockPx・地形の縁）と同じく、明るさを段に落とすときに BAYER の網目でしきい値を揺らす。
   段の真ん中を整数にした連続の段（WALL_MID の間を線形に）に網目を足して切り捨てるので、段と段の間は市松に混ざる。
   網目は世界のドットに固定（歩いても網が流れない）。CAVE.wallDither=0 で前の段だけの塗りに戻る（見比べ用）。 */
const WALL_TAPER=12, WALL_DITHER=1, WALL_MID=[.0,.275,.55,.79,.97];
function wallTone(I,X,Y){
  const M=WALL_MID; let u;
  if(I<=M[0]) u=0; else if(I>=M[4]) u=4;
  else { let j=0; while(j<3&&I>M[j+1]) j++; u=j+(I-M[j])/(M[j+1]-M[j]); }
  const wd=CAVE.wallDither===undefined?WALL_DITHER:CAVE.wallDither; if(!wd) return caveTone(I,0);
  const k=Math.floor(u+.5+(BAYER[((Y&3)<<2)|(X&3)]-.5)*wd); return k<0?0:k>4?4:k; }
/*WALL_SPR_BEGIN*/const WALL_SPR={"w":128,"h":28,"ax":0,"ay":20,"m":["................................................................................rrrrr..............rrrrrrrrr....................",".........................................................................rrrrrrrrrrrrrrrrrrrr...rrrrrrrrrrrrrr.rrr.rr...........","........................................rrrrrrrrrr....kkr...rrrrr......rrrrrrrrrrrrkrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..rrrr.",".......................................rrrrrrrrrrrrr.rkkrrrrrrrrkr...rrrrrrrrrrrrrrkrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.","......................................rrrrrrrrrrrrrrrrkkrrrrrrrrkrrrrrrrrrrrrrrrrrkrrrkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.",".........rrrrrrrrrrrrrrr.............rrrrrrrrrrrrrrrrrkkrrrrrrrrkrrrrrrrrrrrrrrrrrkrrrrrkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.","......rrrrrrrrrrrrrrrrrrrrrrr.......rrrrrrrrrrrrrrrrrrrrrrrrrrrrkrkrrrrrrrrrrrrrrkrrrrrrrrrkkrrrrkkkrrrrrrrrrrrrrrrrkrrrrrrrrrrr","r...rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrkrkrrrrrrrrrrrrrkrrrrrrrrrrrrkkkkrrrrrrrrrrkkkrkkkkkrkkkkkrrrkrr","rrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrkkkkkkkkkrrkkkkkkkkkkkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkrkkkrrr","rrrrrrrrrrrrrrkkrkkrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrkrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkr","rrrrrrrrrrrkkkrrrrrrkkrrrrrrrrrrrrkrrrrrrrrrrrrrkkkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkr","rrrrrrkkkkkrrkrrrrrrrrrkrrrrrrrrrkrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkrrrrrrrkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkk","kkkrkkrrrrrrrkrrrrrrrrrrkrkrkkkkkrrrrkrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkrrrrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrrkrrrrrrrrrrrrrrrrrrrrkrrkrrrrrrrrrkrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrrkrrrrrrkrrrrrrrrrrrrrrkrrrrrrrrrrrkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrkrrrrrrrrrrrrrrrrmrrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrrrrrrrrrrrrrrrrrmmrrrrrrrrrrrrrrrrrkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr","rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.rrrrrr.rrrrrrrrrrrrrrrrrrrrrrrrrrrrr.rrrrrrrrrrrrrrrrrrrrrrrrr.rrrrrrrrrrrrr","rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.rrrrrr......rrrr..rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..rrrrrr.rrrrrrrrrrrrr","rrrrrrrrrrrrrrrrrrrrrrrrr.r..rrrrrrrrrrrrrrrrrrrrr..rrrrr.......rrrr....rrrrrrrrrrrrrr..rrrrrrrrrrrrrrrrrr....rrrr..rrrrrrrrrrr.","rrrrrrrrrr....r...rrrrrr......rrrrrrr..rrrrrrr.rr....rr.........rrrr..............rrrr...rrrrrrrrrrrrrrrrr....rrrr........rrrrr.","rrrrrrrr..........rrrrr........rrrrr...rrrrrr.....................................rrr....rrrr.rrrrrrrrrrr......rr..........rrr..",".................................rr.....rrrrr..............................................rr..rmrrrrrrrr.......................",".........................................rrr....................................................................................","................................................................................................................................"],"n":["000000000000000810000000000000000000000h000000000000005h0000000084000000000000000000900000000000000000000400000000l000000000000h","000000000000000810000000000000000000000h000000000000008h000000008400000000000000000090000000000000000000t400000000l100000000000h","000000000000000810000000000000000000000h000000000000008800000000d4000000000000000000r00000000000000003BBh400000000l000000000000h","000000000000000810000000000000000000000mee6000000000008800000000d911110000000013bbbbw00000000000000BBBBBhzze100000l000000000000h","0000000000000008100000000000000000000038eeeeeee10000008866610000dh1111116bbbbbbbbbbwwwErrrjjj666bBBBBBBBhzzzzz6bowlEe1100116666h","00000000000000081000000000000000003333388eeeeeeeee6333tte666jjjjth11111bbbbbbbbbbbowwwwwMrrrrrrwBBBBBBOwzzzzzzzwwwwlMMMMj66bbjBh","00000000000000081000000000000333333333gwg8eeeeeeeeee3btuzjjjjjjjtB616bjjjjjjjjjjjBwwwwwwwwwErrrBBBBBOwwwwMzzzzzwwwwwHMMMMMwwwwhh","11110000000000089000000003333333333333wwwj8eeeeeeeejoBtuujjjjjjjtBzjjjjjjjjjjjjjBwwwwwwwwwwwwMwBJbwwwwwwwwozzzzwwwJWjMMMMMEwwBhh","111111133bbooootzEEEEwjb3333333333333twwwww88eeeeeejottuujjjjjjwtBBUwjjjjjjjjjjBEEEwwwwwwwwwE41mmwwwwwwwwwGhm66bjjjjJJJJJ1MEw4hh","611116booooooootzEEEEEEEEEwjb3333333owwwwwwwb8reeejoottrjjjjjwBBBB44444440000088u00000000000h4100000RwwwwwGhmjjjjjwJJJW111lh44hm","m116booooooowwhzzzzzEEEEEEEEEEEEjbbwwwwwwwwwwj88rrwww00000MjjBBBB444444440000088u00000000000hjjjj30000000ZdzzEwR1111111111lh44hm","mmbooowwJJWrwGzzzzzzzjjErwE6jEEEEJwwwww0wwwwwwwg88Grre000000000004444444ejjj6388ujjjjjju3jjjljjjjjjjj60000d111111111111111lh44um","mrJJJRrrrrrrBG00zzzzzzjjrjEztEEEO4Eww0wMwwwwwwwwBrrrrrr300000000144444jjjjjjjjgtujjjjjjjgjjjljjjjjjjjjjjj3t111111111111111lh4400","000orrrrrrrrG10000zzzzrjzlpE440884000o9wwwwwwwwJrrrrrrrrr00000001444jjjjjjjjjjttejjjjjjjj8jjbmjjjjjjjjjjjo8111111166666666th4ee0","00hJ00MErrrE41000000zMW44gm416b884000oo00EwwwwOerrrrrrrrrr33300014jjjjjjjjjjjjtt000000000b61000000000000000ejjjjjjjj66666ttheeee","33r000000094410000000d4444186www84000Ml00000EO333rrrrrrrrrrb33381jjjjjjjjjjjjjt00000333336666661100000000l06jjjjjjjjjjjjjt0eeeee","ebt3330000h4166333000d411m6wwwwwh6ggggBgggggg83333rrrrrrrrrrjb3t1jjjjjjjjjjjjjg333333333g6666666666611000366110000000166j33eeeee","jjo3333330u666663333g8611jwwwww49ooooRooo33333333336rrrrrrrrrrwt6rjjjjjjjjjjjt3333333333t6666666666666663066666663u03333333eeeee","jjjjb33333um6jwwwwwwwgHewwwwwwO4mooooooo10003200053330000rrrrrwb66663r66666jjg3333333333w666666666660000005666666tu33333333eeeee","jjjjjj3333umwwwwwwwjwo3HwwwwwO91130005840000000000dg.00000rrrrB66166gr666666633333333333B6600560000h1000000666666tu63333333meeee","jjjjjjjb3tmmwwwwwe333333HwwwB999100030h100000d00003.h00008.EEEj62006yE612266633333022d38.20000000004400000G666666t.u3333331116jJ","jjjjjjjjBt8mwwwwwh333333tMwBo9999bggggu1100000000gt.h033tB......0003..um13l666333h138lbg910004000001410000..re9000.u3333b11111dJ","jjjjjjjjt3gEEE333u333338t.w..mmmmgggggm9111008M6gt..u13BB.......633b....moEjj6bbjubbgl..u991019003314eebjg....h008..6bbbom11118.","jjjjjjjjBw....b...r6333l......mmmgggg..u1113gG.zB....UB.........jwwB..............bbbl...m163mrr3336eejjjo....h0gt........111gt.","EwrEEEwO..........rrrjB........zmbgg...u911gg.....................................jbb....zzrb.rrroojeejjj....../B..........rBB..",".................................zo.....u1ggt..............................................EO..rrooRrejjo.......................",".........................................egt....................................................................................","................................................................................................................................"],"a":["78899999999999968888778999999998988999768888888888888875999999999478888887888878888859999999999999999999857887788859999999999997","78889999999999968999999999999998888999768888888888888875999999999588888887888878888859999999999999999999757887788859999999999997","78899999999999968999999999999998888999768888888888888877999999999578888887888878888859999999999999999887467887788859999999999997","78899999998898868999999999989998988999756778888888888877999999999478888887888878777649999999999999987777366787788849999999999997","88899999999999868999999999999998988999746666667788888877999999999467788886676656666545777778899987777676466665676658999999999996","88899999999999968999999999999998988888744666666666777766999999889477777765566656666344446677777787777663456565666664888899999874","88899999999999968999999999999987878887654466666666667654888888888367776665666656664344443357777777776333355465666665678888787866","88899999999999967999999998888887767888545556666666666654888888888356666665566655633333332223467765433333333455555555477788777748","88789888887777755777777788887787877887444444556666666654887777778235555565566545323233332233331343332222222133443333333444677659","77678877777777755677666677777887877874444444445555555652455555322221355554445554122221111110122111122233331133222333322112235678","87777777767776433444666666666666767644444444444455555532122233322123355554455555144432322232132221122111121233222211112334345688","77667666665544233333345655645666664443323434444444322443231211121244455553445555033332222332032222233332222212222223333444335677","66556654333344122332233313522665533332313323333343222333342332230445454443344444033332222332122222233332232233333333444444235533","44213333333343332222233321213334333331223323333331222332243443340444333333333344032222222222111111122232220333333344333333135544","55322123333321344322232121134435435441123322223321112332233343340433333332233343111111111122111000111211110322222233333333134444","45244322121222344443211233224333435553233222232111111222233333230333333332233342112211110022222000222222211222122222222332123344","44244433321333344444313342333223235444234233311110011221122322230222222222233321111111111012222111122212311111111111111221134434","33244444441343334434313432233222244443323221101210000111122221120222222221122211111101111011222111122212221111111101112111123434","33334444441242233333312333322222444333323665245553000777611221110000020010122211111101110011112111126554453011111001121111122333","2333334443122222222222322222213443445434777755666530.777760111000210010000010111111101110014542677546666665001111000111111122333","233332233322211222666654122222455565546777777644445.677776.11000367001045511011111245400.2544367777466566640000110.0111111454432","222222233351211214777765212204466565545777777755665.676567......6663..067640000005555600455555677776665566..002777.0011004444432","2222222234611000035677765.1..555555555567777774565..66777.......5566....65100000045666..545555677776665565....7677..00000566665.","0111111227....1...777776......5565655..7777777.45....67.........7666..............5666...55654777775565555....7777........56666.","01111112..........67776........55545...776567.....................................565....5555.67777655555......67..........665..",".................................55.....77777..............................................55..6676555455.......................",".........................................666....................................................................................","................................................................................................................................"],"hts":["gggggggggggggggefggggggggggggggggggggggghhhhggggggggggfchggggggggcggggggggggggggggghfhhhhhhhhhhhhhhhhhhhggggggggggfggggggggghhhg","gggggggggggggggefggggggggggggggggggggggghhhhggggggggggfbhggggggggdggggggggggggggggggfhhhhhhhhhhhhhhhhgggggggggggggfgggggggghhhhg","gggggggggggggggffggggggggggggggggggggggghhhhggggggggggffhggggggggeggggggggggggggggggehhhhhhhhhhhhhggggggegggggggggfggggggghhhhhg","gggggggggggggggffggggggggggggggggggggggfgghhhgggggggggffhhgggggggeggggggggggggggggggdhhhhhhhhhhggggggffedfggggggggfggggghhhhhhhg","gggggggggggggggfgggggggggggggggggggggggfgggggggggggggggggggggggggdfggggggggggggggffdbdgggggggggggggffeeddefffgggggfgggghhhhhhhhg","gggggggggggggggfgggggggggggggggggggggggeefffffggggggggffggggggggfdfffffgffffffffffeaaaabeffffgggffeeddcbcddeefffffeeffgggggggggf","gggggggggggggggfggggggggggggggggggggggfdddeeffffffffffecfffffffffbfffffffffeeeeeee99999999ceffffeeddcaaaabcdddeeeedddeefffffffef","gggggggggggggggfggggggggggggggggggffffdcccdeeeeeeeffffdbeeeeeeeee9eeeeeeeeeeddddd988888888889dedcbaa999999abccddddcbacddeeeeeecf","gggggggggggggffefgggggggggggfffffffffecccccbcddeeeeeeecaddddddddd88bddddddddddcc877777777777776889998888888689a99988888889cddbcf","fffffggffffffffdceffffffffffffffffffebbbbbbbbacdddddddb89aaaaa9877656888999888775666666666665666666777777766788888877666566678ce","ffffffffeeeeeeb899acdeeeeeeeeeeeeeecaaaaaaaaaa9accccba7666777776655566778888887756666666b6665666666655555555676666555555566678ce","eeeeeeeeedcbaa678899aabcdddddddddda9999c999999998876777666655555355566778888887745555559d5554555555555555544445555555555565578bd","deeddcba9999985567789999cbbcccccb7788d8c988888888655666666655554355566777777777745555556c555444444444455544444555555555556557888","898d88888888865555677888aa8b888776557da87777777754445556666555543555666666666666444444446a44434444444444443444555555555555457787","779b667777776555555567766a98888776555c945666666433344445555555543555555555566664333333333433333333333333333444444444445554456777","77a76665554555555555545667897777765558944333453222233334445555443444444445555544333333333333333333333333333333333344444444356666","67966665553555555555545667776666555555944333222221122233334444442333334444444433333333333222223333333333333333333333333333345555","66865555553445555555545566655554455446433322222111111122223333322222333333333333333222222222222222233333322222233323333332244445","55555555442444444444434555554443444333322222222221100222222222222222222222222222222222221111222222222223322222222223222222233344","44444444442333333333332344443333333332223322222222100222221111111111112222222222222211110111111222223333333111122112222222123333","33333344331222222222222223332233333332333332222222201222220000001111101111111111111122110122222222223333332111111101221111222222","23333333321111111222222212221223333322233333322211101222110000002221000111111111112222002222223322223333330000111101111111222211","22222222211000000122221110100122222221122333321111001111000000001111000011000000012221001222222332223333330000111100110001111110","11111111100000000011111100000011221110012233220000000110000000001100000000000000001111000122222222222222220000111000000000111110","00000000000000000011111000000000111100012222200000000000000000000000000000000000001100000011101111111121100000000000000000011000","00000000000000000000000000000000000000001221100000000000000000000000000000000000000000000000000011001111100000000000000000000000","00000000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"]};/*WALL_SPR_END*/
/*WALL_SPR_WET_BEGIN*/const WALL_SPR_WET={"w":128,"h":28,"ax":0,"ay":20,"m":["................................................................................mmmmm..............mmmmrrrrm....................",".........................................................................mmmmmmmmmmmmmmmmmmmm...rrmmmmmmrrrmmm.mmr.rr...........","........................................rrrmmmmmmm....mmm...mmmmm......mmmmmmmmmmmmmmmmmmmmmmmrrrmmmmmmmrrmmmmmmmrrrrrmmm..mmmm.",".......................................rrrrmmmmmmmmm.mmmmmmmmmmmmm...mmmmmmmmmmmmmmmmmrrmmmmmmmmmmmrmrmrrrrmmmmmrrrrrrmmmmmmmmm.","......................................mmmmrmmrrrrrrmmmmmmmmmrmmmmmrmmmmmmmrmrmmmrrmrrmmmmmmmrmmmmmmrmrmrrrrrrmmmrrrrrrmmmmmmmmm.",".........mmmmmmmmmrrrrrm.............mmmmmrmrrrrrrrmmmkkmmmrrrrmmrrrmmmrrrrrrrmmrrmrrmmmmkkrrmmmmrrrrrrrrrrrrrmmrrrrrrmmmmmrmrm.","......rmmmmmmmmmmmrrrrrmmmmmr.......mmmmrmrrrrrrrrrrmrrrrrrrrrrmmrkrmrmrrrrrrrmmrmrrrmrrmrrkkmmrrkmmrrrrrrrrrrrmrrrrmrmmrmmrmrmm","m...mmmmmmmmmmmmmmmrrrrmmmmmmrrrrrmmmmrmrmrrrrrrrrrrrrrrrrrrrrrmmrkrmrmrrrrrrrmmmmrrrrrrmrrrrkmkkrmrrrrrrrrmmmrmkkkkmmmmmmmrrmrm","mmmmmmmmmmrrrmmmmrrrrrrrmmmmmmrrrrrrrmrmrrrrrrrrrrrrrrrrmmkkkkmmmrrkmmmkkkkkkkkkmmrrrrrrmrrrrrmrrrmrrrrrrrrmrrrrrrrrrmmmmmkkkmrm","mmmmmmmmrrrrrrkmmmmrrrrrrmrmmmmmmrrrmmrmrrrrrrrrrrrrrrmrmmrrrrmmmrrrmmmrrrrmmmrrmmrrrrrrmmmmrrmrrrmrrrrrrrrmrrrrrrrrrmmmmmrrrmmr","mmrmrrmrrrrkkkrmmmmrkkrrrrrmrmmrmrmrmmrmrrrrrrrrmmmmmrmrmmrrrrmrrmrrmrmrrrmmmmrrmmrrrrrrmmmmrrrrrrmrrrrmmrrmrrrrrrmmmmmmmmrrrmmr","mrrmrrmmmmmrrkrmrmmrrrrmrrrmrrrrmkmrmrrmrrrrrrrrmmrmrrmrmrrrrrrrrrrrmrmrrrrmmmrkmmrrrrrkmrmrrrrrrrrrrrrmmmrmrrrrrrmmmmmmmmrrrrmm","mkmmmmmmmmrrrkmmrmmrrrrrmrkmkmmmkrrrmkrmrrrrrrrrrmrrrrmrmrrrrrrrrrrrrrmrrrrmrrrkmmrrrrrrmrmrrrrrrrrrrrrmrmrmrrrrrrmmmmrrmrrrrrmm","mmmmrmrmmmrrrmmmmmmrrrrrmrrkmmmrrrrrmkrmrrrrrrrrrrrrrrrrmrrrrrrrrrrrrrmrrrrrrrrrmmrrrrrrrkmrrrrrrrrrrrrmrrrmrrrrrrmrmmrrrrrrrrmm","mmmkmmrmmmkrmmmmmmrrrrrrmkrmmrrrrrrrrkkmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmrrmrrmmmmmrrrrrmmmmmrrrrrrmrmmrrrrrrrrmm","mmmmmmmmmmrmmmmmmmrrrrrrmmmmmrrrrrrrrmkmrrrrrrrmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmrrrrrrmmmmrrrrrmmmmrrrrrrrmrrmrrrrrrrrmm","mmmmmmmmmmrmmmmmmmrmrrrrmmmmrrrrrrrrrrkrrrrrrrrrmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmrrrrrrmmmrrrrrrrmmmrrrrrrrmrrrrrrrrrrrmr","rmrmmmmmmrrmmrrmmrmmrrrrrmmmrrrmrrrrrmrrrmrrrrrrmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmrrrrrrmrrrrrrrrrmmrrrrrrrrmrrrrrrrrrrrrr","mmmmmmmmrrrmrrrmmrrrrrrrrmmrrrrrrrrrrmrmmmrrrrrrmmmrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmrmrrrrrrmmmmmrmrrrmmrrrrrrrrmrrrrrrrrmmmmm","mmmmmmmmrrrmrrrmrrrrrrrrrmrrrrrrrrrrrrrmmmmrrrrrmrmr.rrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmrmrmrrrrrmmmmmmmmmmrrmrrmmmmmrrrrrrrrrmmmmmm","mmmmmmmmrrrrrrrrrrrrrrrrrrrrrmmrrrrrrrmmmmmrrrrrrrr.rrrrrr.rrrrrrrrrrrrrmmmmmmmmmmmmrrrr.rrrrmmmmmmmmmmrrrrrmmmmmm.rrrrmmmmmmmmm","mmmmmmmmrrmrrrmmmrrrrrrmrrrrmmmmmmrrrrmmmmmrrrrmmrr.rmmmrr......rrrm..rrmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm..mmmmmm.rmmmmmmmmmmmm","mmmmmmmmmmrrmmmmmmrrrrrmr.r..rmrrrrrrrmmmmmrrrrmrr..rmmrr.......rrrm....mmmmmmmmmmmmmm..mmmmmmmmmmmmmmmmrr....mmmm..mmmmmmmmmmm.","mmmmmmmmmm....m...rrmmmr......rrrrrrr..mmmmmrr.rr....mm.........rrrr..............mmmm...mmmmmmmmmmmmmmmmr....mmmm........mmmmm.","mmmmmmmm..........rrrrr........rrmrr...rmmmrr.....................................mmm....mmmm.mmmmmmmmmmm......mm..........mmm..",".................................rr.....rmrrr..............................................mm..mmmmmmmmmm.......................",".........................................mmm....................................................................................","................................................................................................................................"],"n":["000000000000000810000000000000000000000h000000000000005h0000000084000000000000000000900000000000000000000400000000l000000000000h","000000000000000810000000000000000000000h000000000000008h000000008400000000000000000090000000000000000000t400000000l100000000000h","000000000000000810000000000000000000000h000000000000008800000000d4000000000000000000r00000000000000003BBh400000000l000000000000h","000000000000000810000000000000000000000mee6000000000008800000000d911110000000013bbbbw00000000000000BBBBBhzze100000l000000000000h","0000000000000008100000000000000000000038eeeeeee10000008866610000dh1111116bbbbbbbbbbwwwErrrjjj666bBBBBBBBhzzzzz6bowlEe1100116666h","00000000000000081000000000000000003333388eeeeeeeee6333tte666jjjjth11111bbbbbbbbbbbowwwwwMrrrrrrwBBBBBBOwzzzzzzzwwwwlMMMMj66bbjBh","00000000000000081000000000000333333333gwg8eeeeeeeeee3btuzjjjjjjjtB616bjjjjjjjjjjjBwwwwwwwwwErrrBBBBBOwwwwMzzzzzwwwwwHMMMMMwwwwhh","11110000000000089000000003333333333333wwwj8eeeeeeeejoBtuujjjjjjjtBzjjjjjjjjjjjjjBwwwwwwwwwwwwMwBJbwwwwwwwwozzzzwwwJWjMMMMMEwwBhh","111111133bbooootzEEEEwjb3333333333333twwwww88eeeeeejottuujjjjjjwtBBUwjjjjjjjjjjBEEEwwwwwwwwwE41mmwwwwwwwwwGhm66bjjjjJJJJJ1MEw4hh","611116booooooootzEEEEEEEEEwjb3333333owwwwwwwb8reeejoottrjjjjjwBBBB44444440000088u00000000000h4100000RwwwwwGhmjjjjjwJJJW111lh44hm","m116booooooowwhzzzzzEEEEEEEEEEEEjbbwwwwwwwwwwj88rrwww00000MjjBBBB444444440000088u00000000000hjjjj30000000ZdzzEwR1111111111lh44hm","mmbooowwJJWrwGzzzzzzzjjErwE6jEEEEJwwwww0wwwwwwwg88Grre000000000004444444ejjj6388ujjjjjju3jjjljjjjjjjj60000d111111111111111lh44um","mrJJJRrrrrrrBG00zzzzzzjjrjEztEEEO4Eww0wMwwwwwwwwBrrrrrr300000000144444jjjjjjjjgtujjjjjjjgjjjljjjjjjjjjjjj3t111111111111111lh4400","000orrrrrrrrG10000zzzzrjzlpE440884000o9wwwwwwwwJrrrrrrrrr00000001444jjjjjjjjjjttejjjjjjjj8jjbmjjjjjjjjjjjo8111111166666666th4ee0","00hJ00MErrrE41000000zMW44gm416b884000oo00EwwwwOerrrrrrrrrr33300014jjjjjjjjjjjjtt000000000b61000000000000000ejjjjjjjj66666ttheeee","33r000000094410000000d4444186www84000Ml00000EO333rrrrrrrrrrb33381jjjjjjjjjjjjjt00000333336666661100000000l06jjjjjjjjjjjjjt0eeeee","ebt3330000h4166333000d411m6wwwwwh6ggggBgggggg83333rrrrrrrrrrjb3t1jjjjjjjjjjjjjg333333333g6666666666611000366110000000166j33eeeee","jjo3333330u666663333g8611jwwwww49ooooRooo33333333336rrrrrrrrrrwt6rjjjjjjjjjjjt3333333333t6666666666666663066666663u03333333eeeee","jjjjb33333um6jwwwwwwwgHewwwwwwO4mooooooo10003200053330000rrrrrwb66663r66666jjg3333333333w666666666660000005666666tu33333333eeeee","jjjjjj3333umwwwwwwwjwo3HwwwwwO91130005840000000000dg.00000rrrrB66166gr666666633333333333B6600560000h1000000666666tu63333333meeee","jjjjjjjb3tmmwwwwwe333333HwwwB999100030h100000d00003.h00008.EEEj62006yE612266633333022d38.20000000004400000G666666t.u3333331116jJ","jjjjjjjjBt8mwwwwwh333333tMwBo9999bggggu1100000000gt.h033tB......0003..um13l666333h138lbg910004000001410000..re9000.u3333b11111dJ","jjjjjjjjt3gEEE333u333338t.w..mmmmgggggm9111008M6gt..u13BB.......633b....moEjj6bbjubbgl..u991019003314eebjg....h008..6bbbom11118.","jjjjjjjjBw....b...r6333l......mmmgggg..u1113gG.zB....UB.........jwwB..............bbbl...m163mrr3336eejjjo....h0gt........111gt.","EwrEEEwO..........rrrjB........zmbgg...u911gg.....................................jbb....zzrb.rrroojeejjj....../B..........rBB..",".................................zo.....u1ggt..............................................EO..rrooRrejjo.......................",".........................................egt....................................................................................","................................................................................................................................"],"a":["78899999999999968888778999999998988999768888888888888875999999999478888887888878888859999999999999999999857887788859999999999997","78889999999999968999999999999998888999768888888888888875999999999588888887888878888859999999999999999999757887788859999999999997","78899999999999968999999999999998888999768888888888888877999999999578888887888878888859999999999999999887467887788859999999999997","78899999998898868999999999989998988999756778888888888877999999999478888887888878777649999999999999987777366787788849999999999997","88899999999999868999999999999998988999746666667788888877999999999467788886676656666545777778899987777676466665676658999999999996","88899999999999968999999999999998988888744666666666777766999999889477777765566656666344446677777787777663456565666664888899999874","88899999999999968999999999999987878887654466666666667654888888888367776665666656664344443357777777776333355465666665678888787866","88899999999999967999999998888887767888545556666666666654888888888356666665566655633333332223467765433333333455555555477788777748","88789888887777755777777788887787877887444444556666666654887777778235555565566545323233332233331343332222222133443333333444677659","77678877777777755677666677777887877874444444445555555652455555322221355554445554122221111110122111122233331133222333322112235678","87777777767776433444666666666666767644444444444455555532122233322123355554455555144432322232132221122111121233222211112334345688","77667666665544233333345655645666664443323434444444322443231211121244455553445555033332222332032222233332222212222223333444335677","66556654333344122332233313522665533332313323333343222333342332230445454443344444033332222332122222233332232233333333444444235533","44213333333343332222233321213334333331223323333331222332243443340444333333333344032222222222111111122232220333333344333333135544","55322123333321344322232121134435435441123322223321112332233343340433333332233343111111111122111000111211110322222233333333134444","45244322121222344443211233224333435553233222232111111222233333230333333332233342112211110022222000222222211222122222222332123344","44244433321333344444313342333223235444234233311110011221122322230222222222233321111111111012222111122212311111111111111221134434","33244444441343334434313432233222244443323221101210000111122221120222222221122211111101111011222111122212221111111101112111123434","33334444441242233333312333322222444333323665245553000777611221110000020010122211111101110011112111126554453011111001121111122333","2333334443122222222222322222213443445434777755666530.777760111000210010000010111111101110014542677546666665001111000111111122333","233332233322211222666654122222455565546777777644445.677776.11000367001045511011111245400.2544367777466566640000110.0111111454432","222222233351211214777765212204466565545777777755665.676567......6663..067640000005555600455555677776665566..002777.0011004444432","2222222234611000035677765.1..555555555567777774565..66777.......5566....65100000045666..545555677776665565....7677..00000566665.","0111111227....1...777776......5565655..7777777.45....67.........7666..............5666...55654777775565555....7777........56666.","01111112..........67776........55545...776567.....................................565....5555.67777655555......67..........665..",".................................55.....77777..............................................55..6676555455.......................",".........................................666....................................................................................","................................................................................................................................"],"hts":["gggggggggggggggefggggggggggggggggggggggghhhhggggggggggfchggggggggcggggggggggggggggghfhhhhhhhhhhhhhhhhhhhggggggggggfggggggggghhhg","gggggggggggggggefggggggggggggggggggggggghhhhggggggggggfbhggggggggdggggggggggggggggggfhhhhhhhhhhhhhhhhgggggggggggggfgggggggghhhhg","gggggggggggggggffggggggggggggggggggggggghhhhggggggggggffhggggggggeggggggggggggggggggehhhhhhhhhhhhhggggggegggggggggfggggggghhhhhg","gggggggggggggggffggggggggggggggggggggggfgghhhgggggggggffhhgggggggeggggggggggggggggggdhhhhhhhhhhggggggffedfggggggggfggggghhhhhhhg","gggggggggggggggfgggggggggggggggggggggggfgggggggggggggggggggggggggdfggggggggggggggffdbdgggggggggggggffeeddefffgggggfgggghhhhhhhhg","gggggggggggggggfgggggggggggggggggggggggeefffffggggggggffggggggggfdfffffgffffffffffeaaaabeffffgggffeeddcbcddeefffffeeffgggggggggf","gggggggggggggggfggggggggggggggggggggggfdddeeffffffffffecfffffffffbfffffffffeeeeeee99999999ceffffeeddcaaaabcdddeeeedddeefffffffef","gggggggggggggggfggggggggggggggggggffffdcccdeeeeeeeffffdbeeeeeeeee9eeeeeeeeeeddddd988888888889dedcbaa999999abccddddcbacddeeeeeecf","gggggggggggggffefgggggggggggfffffffffecccccbcddeeeeeeecaddddddddd88bddddddddddcc877777777777776889998888888689a99988888889cddbcf","fffffggffffffffdceffffffffffffffffffebbbbbbbbacdddddddb89aaaaa9877656888999888775666666666665666666777777766788888877666566678ce","ffffffffeeeeeeb899acdeeeeeeeeeeeeeecaaaaaaaaaa9accccba7666777776655566778888887756666666b6665666666655555555676666555555566678ce","eeeeeeeeedcbaa678899aabcdddddddddda9999c999999998876777666655555355566778888887745555559d5554555555555555544445555555555565578bd","deeddcba9999985567789999cbbcccccb7788d8c988888888655666666655554355566777777777745555556c555444444444455544444555555555556557888","898d88888888865555677888aa8b888776557da87777777754445556666555543555666666666666444444446a44434444444444443444555555555555457787","779b667777776555555567766a98888776555c945666666433344445555555543555555555566664333333333433333333333333333444444444445554456777","77a76665554555555555545667897777765558944333453222233334445555443444444445555544333333333333333333333333333333333344444444356666","67966665553555555555545667776666555555944333222221122233334444442333334444444433333333333222223333333333333333333333333333345555","66865555553445555555545566655554455446433322222111111122223333322222333333333333333222222222222222233333322222233323333332244445","55555555442444444444434555554443444333322222222221100222222222222222222222222222222222221111222222222223322222222223222222233344","44444444442333333333332344443333333332223322222222100222221111111111112222222222222211110111111222223333333111122112222222123333","33333344331222222222222223332233333332333332222222201222220000001111101111111111111122110122222222223333332111111101221111222222","23333333321111111222222212221223333322233333322211101222110000002221000111111111112222002222223322223333330000111101111111222211","22222222211000000122221110100122222221122333321111001111000000001111000011000000012221001222222332223333330000111100110001111110","11111111100000000011111100000011221110012233220000000110000000001100000000000000001111000122222222222222220000111000000000111110","00000000000000000011111000000000111100012222200000000000000000000000000000000000001100000011101111111121100000000000000000011000","00000000000000000000000000000000000000001221100000000000000000000000000000000000000000000000000011001111100000000000000000000000","00000000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000","00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"]};/*WALL_SPR_WET_END*/
/* 水の層（2026-10-05 ユーザー要望「水の層にも同じように壁を追加しておいて。石の層より苔とかを多めに」）
   形は石の層と同じ。苔の印を増やした版（WALL_SPR_WET：tools/wall3d.py の mossify。天辺の縁・棚・垂れる房・足もとの藻）を使う。
   岩は水の層の床・縁に合わせた青緑の灰、苔は水の層の遺跡と同じオリーブ（DECO_PAL_WET.algae に暗い段を足した4段）。
   足もとが水のドットには岩屑を出さず、水に浸かる下の2行は1段暗く（濡れ）。 */
const WALL_ROCK_WET=dcR(['#081214','#13262a','#22403f','#3a5e59','#6c9188']);
function wallWaterG(){ return W&&W.haz&&W.haz.kind==='water'?W.haz.g:null; }   // drawNorthWalls の中では W が絵の幅なので外で取る
const WALL_MOSS=dcR(['#26240e','#4a4a1a','#6e6c28','#a39a44']), WALL_MOSS_WET=dcR(['#18220f','#2c3e1a','#4a6326','#7a983c']);
function drawNorthWalls(bx0,by0,t,blindR,P_){
  if(!WALL_SPR||CAVE.northWall===false||!G||!G.Z) return;
  const wet=G.Z.id==='sump'; if(!wet&&G.Z.id!=='stone') return;
  const sp=wet&&typeof WALL_SPR_WET!=='undefined'?WALL_SPR_WET:WALL_SPR, D=caveDecode(sp), ROCK=wet?WALL_ROCK_WET:P_.lime, MOSS=wet?WALL_MOSS_WET:WALL_MOSS;
  const hz=wet?wallWaterG():null, inWater=(x,y)=>hz?hazAt(hz,x,y)>.5:false;
  const W=sp.w, H=sp.h, AY=sp.ay, code=G.code, PW=G.PW, PH=G.PH, Pp=G.P;
  const WT=G._wtops||(G._wtops=new Map()); WT.clear();                       // このフレームの壁の列：wx→{top,gy,L}（蔦を天井から垂らすのに使う）
  const TAPER=WALL_TAPER, x0=Math.max(4,bx0-TAPER-6), x1=Math.min(PW-4,bx0+bw+TAPER+6), y0=Math.max(16,by0), y1=Math.min(PH-4,by0+bh+H);   // 横は端の細りが画面の外から始まっても分かるように広めに見る
  const rock=(x,y)=>code[y*PW+x]!==0;
  ensure(bx0-8, Math.max(0,by0-H-20), bx0+bw+8, by0+bh+8);                 // 画面の上の外にある岩も、面の厚みを見るのに要る
  /* 1) 列ごとに「床の北の縁」を拾う：真上が岩・自分が床・上に8ドット以上の岩・3ドット下も床（側壁の小さな凹みを除く）。
        上の岩の厚み A（最大 AY+6）も覚えておく：薄い岩（向こうがすぐ別の部屋・通路）では壁を低くする */
  /* 縁は列ごとに覚えておく（岩の地図が変わる＝G.ver が進むまで）。毎フレーム全部の行を見直すと重かった */
  const WC=G._wallCache&&G._wallCache.ver===G.ver ? G._wallCache : (G._wallCache={ver:G.ver, cols:new Map()});
  const scan=(wx,a,b)=>{ const L=[];
    for(let ey=a; ey<b; ey++){
      if(!rock(wx,ey-1)||rock(wx,ey)||rock(wx,ey+3)) continue;
      let A=1; while(A<AY+6&&ey-1-A>=0&&rock(wx,ey-1-A)) A++; if(A<8) continue;
      L.push([ey,A]); }
    return L; };
  const edges=new Map();
  for(let wx=x0; wx<x1; wx++){
    let c=WC.cols.get(wx);
    if(!c||c.a>y0||c.b<y1){ const a=c?Math.min(c.a,y0):y0, b=c?Math.max(c.b,y1):y1; c={a,b,L:scan(wx,a,b)}; WC.cols.set(wx,c); }
    const L=c.L.filter(e=>e[0]>=y0&&e[0]<y1); if(L.length) edges.set(wx,L); }
  /* 2) 隣の列と縁の高さが3ドット以内なら同じ壁の続き（ひと続き＝run）。6列に満たない run は捨てる（側壁の凸凹に面を立てない） */
  const runs=[], open=new Map();
  for(let wx=x0; wx<x1; wx++){ const L=edges.get(wx)||[], next=new Map();
    for(const [ey,A] of L){ let run=null;
      for(const [py,r] of open) if(Math.abs(py-ey)<=3){ run=r; open.delete(py); break; }
      if(!run){ run=[]; runs.push(run); }
      run.push([wx,ey,A]); next.set(ey,run); }
    open.clear(); for(const [k,v] of next) open.set(k,v); }
  /* 縁の色：左右の壁の縁（地形の c=1〜4 の帯）と同じ式。fall＝縁からの距離ごとの弱まり、fc＝縁がランタンに向いている度合い */
  const wdOn=()=>(CAVE.wallDither===undefined?WALL_DITHER:CAVE.wallDither);
  const rimLv=(L,fall,fc,X,Y)=>Math.floor(Math.min(1,L*1.25)*(.15+.85*fc)*fall*5.6+(wdOn()?BAYER[((Y&3)<<2)|(X&3)]:.5));
  const rimC=(L,X,Y,fc=1)=>{ const lv=rimLv(L,1,fc,X,Y); return lv>0?Pp.rim[Math.min(4,lv-1)]:Pp.edge[0]; };
  const RIM_FALL=[.55,.3,.15];                                               // 線の上（天井の側）の3ドット：側壁の縁の c=2,3,4 と同じ
  for(const run of runs){
    if(run.length<6) continue;
    /* 2026-10-05 報告「水の層で天井部分がバッツリ見切れていたり、壁が変な位置で切れていたり、側面に変に縦ラインが入っていたり」
       a) 高さ：上の岩が薄い所は、面を縦に縮める（列の厚みから決めた縮みの、run の下から4分の1の値）。縮みが 0.4 に届かない run は立てない。
          前は面の高さのまま描いて、岩の外（向こうの床）で天辺が真っ直ぐ切れていた。
       b) 端：run の端の隣が床（縁の段が4ドット以上ずれて別の run になった・岩が薄くて縁にならなかった）なら、
          面を TAPER 列かけて低くしていき、床の縁へなだらかに降ろす。縦の線は引かない。
          隣が岩（側壁）の時だけ、今まで通り縦の線で側壁の縁へ繋ぐ。
       c) 見えない列・灯りの外の列（描かない列）は、もう「端」にしない（その両隣に縦の線が出ていた）。 */
    const sCol=run.map(([,,A])=>Math.min(1,Math.max(0,(A-4)/AY)));
    const sRun=sCol.slice().sort((a,b)=>a-b)[Math.floor(sCol.length*.25)];
    if(sRun<.4) continue;
    const [lx,ly]=run[0], [rx,ry]=run[run.length-1];
    const leftOpen=lx>x0&&!rock(lx-1,ly+2), rightOpen=rx<x1-1&&!rock(rx+1,ry+2);       // 端の隣が床＝細らせる（見ている範囲の端は続きとみなす）
    const leftWall=lx>x0&&!leftOpen, rightWall=rx<x1-1&&!rightOpen;                      // 端の隣が岩＝側壁へ縦の線
    const tops=[];
    for(let ri=0; ri<run.length; ri++){ const [wx,ey]=run[ri];
      let sc=Math.min(sRun,sCol[ri]);
      const dl=leftOpen?ri:1e9, dr=rightOpen?run.length-1-ri:1e9, dm=Math.min(dl,dr);
      if(dm<TAPER){ const u=(dm+1)/(TAPER+1); sc*=u*u*(3-2*u); }
      const col=((wx%W)+W)%W, gy=ey;                                         // 面の足もと（床の最初の行）
      if(!seenAt(G.f,G.L,wx,ey+2)||Math.hypot(wx-lampX,ey-lampY)>blindR+H){ tops.push(null); continue; }
      /* 明るさの強さ：足もとの床の明るさ（左右9ドットの平均：石筍の細い影で面が縦に切れないように）と、
         ランタンからの距離だけで見た明るさの6割の、大きい方 */
      const Lf=(pxLight(wx-4,ey+2)+pxLight(wx,ey+2)+pxLight(wx+4,ey+2))/3;
      const dd=Math.hypot(wx-lampX,ey-lampY), fall=dd<Rpx?Math.pow(1-dd/Rpx,1.1):0;
      const Lr=Math.min(1.1,Math.max(.10,Math.max(Lf,fall*.6)*1.15));
      let top=null, bot=gy-1;
      const lx0=(lampX-wx)/4, lz0=(lampY-gy)/2, l2=lx0*lx0+lz0*lz0;          // 光の向きの横・奥は列で同じ。高さだけ画素ごと
      const wetFoot=inWater(wx,gy+1);                                        // 水の層：足もとが水
      const Hs=Math.round(AY*sc);                                            // 面（足もとより上）の行数
      for(let o=-Hs;o<H-AY;o++){                                             // o<0：面（縮めて取る）、o>=0：足もとの岩屑（そのまま）
        const v=o<0?AY-Math.max(1,Math.round(-o/sc)):AY+o; if(v<0) continue;
        const i=v*W+col, mt=D.m[i]; if(!mt) continue;
        const Y=gy+o; if(Y<1) continue;
        if(Y<gy&&!rock(wx,Y)) continue;                                    // 岩の外（向こうの部屋の床）には描かない
        const ly0=(CAVE_LAMP_H-D.hp[i]*(o<0?sc:1))/3.46, inv=1/(Math.sqrt(l2+ly0*ly0)||1);
        const n=NRM[D.ni[i]], dot=Math.max(0,(n[0]*lx0+n[1]*ly0+n[2]*lz0)*inv);
        const I=Lr*(WALL_AMB+WALL_KD*dot+WALL_TOP*Math.max(0,n[1]))*D.a[i];   // ランタンに向いた面がはっきり明るい。庇の上は岩の天辺ほど明るくしない
        if(Y>=gy&&wetFoot) continue;                                         // 水の中には岩屑を出さない
        let k=wallTone(I,wx,Y);
        if(wetFoot&&Y>=gy-2) k--;                                            // 水に浸かる下の端は濡れて暗い
        if(mt===4) k=Math.min(k,2)-1;                                       // 奥の面との境（割れ目）
        occGY=gy;
        if(mt===2){ const km=Math.min(3,k); dpf(wx,Y,MOSS[km<0?0:km]); }     // 苔：同じ明るさの段を苔の4段に（いちばん明るい段は苔の3段目止まり）
        else dpf(wx,Y,ROCK[k<0?0:k>4?4:k]);
        if(top===null) top=Y; bot=Y;
      }
      tops.push(top===null?null:{wx,gy,top,L:Lr});
      if(top!==null) WT.set(wx,{top,gy,L:Lr});
      if(!wet&&top!==null&&CAVE.wallFoot!==false) wallFoot(wx,gy,bot,Lr,t,P_);
    }
    /* 3) 天井と壁の境に、今までの岩の縁と同じ線を通す（面の天辺の外側1ドット）。
          run の両端は、面の横の縁を縦の線で床まで下ろし、側壁の縁の線へ繋ぐ */
    occGY=null;
    /* 天井の側の網の帯（2026-10-05 ユーザー要望「北側の天井のキワも側面の網掛けと合わせて」）：
       線の上3ドットを、側壁の縁の帯と同じく、灯りの強さ×弱まり（.55/.3/.15）＋網目で塗る。暗ければ1ドット目だけ縁の暗い色、残りは岩のまま。
       線より先に塗る（段差の縦線が上に乗る） */
    for(const q of tops){ if(!q) continue;
      const dx=q.wx-lampX, dy=(q.top-1)-lampY, d=Math.hypot(dx,dy)||1; q.fc=Math.max(0,-dy/d);   // 縁の外向き＝南（床の側）
      for(let k=0;k<3;k++){ const Y=q.top-2-k; if(Y<1||!rock(q.wx,Y)) break;
        const lv=rimLv(q.L,RIM_FALL[k],q.fc,q.wx,Y);
        if(lv>0) dpf(q.wx,Y,Pp.rim[Math.min(4,lv-1)]); else if(k===0) dpf(q.wx,Y,Pp.edge[1]); } }
    for(let j=0;j<tops.length;j++){ const q=tops[j]; if(!q) continue;
      if(q.top-1>=1&&rock(q.wx,q.top-1)) dpf(q.wx,q.top-1,rimC(q.L,q.wx,q.top-1,q.fc));
      const prev=tops[j-1], nxt=tops[j+1];                                   // 隣と天辺の高さが違えば、段差を縦の線で繋ぐ
      for(const nb of [prev,nxt]) if(nb&&nb.top<q.top-1) for(let y=nb.top;y<q.top-1;y++) dpf(q.wx,y,rimC(q.L,q.wx,y,q.fc));
      const isEnd=(j===0&&leftWall)||(j===tops.length-1&&rightWall);             // 側壁に当たる本当の端だけ
      if(isEnd) for(let y=q.top;y<q.gy;y++) dpf(q.wx,y,rimC(q.L,q.wx,y));
    }
    if(wet&&CAVE.wallDrips!==false) wallDrips(tops,t);
  }
  occGY=null;
}
/* 水の層：天井のキワから落ちる水滴（2026-10-05 ユーザー要望「天井のキワから多めに水滴が落ちるようにして」）
   - 落ちる所は壁の列のおよそ4列に1つ（世界の x で決める＝歩いても場所は変わらない。隣り合う列は選ばない）。
   - 1滴ごとに：縁の下で膨らむ（0.55秒）→ 面の前を落ちる（重さで加速）→ 足もとの1〜3ドット先で水しぶき。間隔は 1.0〜2.4 秒。
   - 床の雨漏り（drawDrips）と同じ色。灯りの弱い所は暗い色。前後は着く所の y（キャラの奥）。
   - 波紋は立てない（滴のたびに水面が動き続けて見えた、という床の滴りの時の報告に合わせる）。
   CAVE.wallDrips=false で止まる（見比べ用）。 */
/* 石の層：壁の足もとの苔と草（2026-10-05 ユーザー要望「壁の足元に苔や草が生えたりしているようにしたい」）
   - 生える所は塊になる（世界の x で引いたノイズが .40 より上の所。6〜7割）。塊の中は：
       苔：面のいちばん下から上へ 1〜5 ドット這い上がり、床にも1ドット。縁は網目で間引く。
       草：3列に1本くらいの房（2本）、床から2〜7ドット。先だけゆっくり揺れる。
   - 色は緑寄りの苔と草（黄色い苔の色だと縁の線のように帯に見えた）。明るさは面と同じ足もとの明るさ。前後は足もと（キャラより奥）。
   CAVE.wallFoot=false で消える（見比べ用）。 */
const FOOT_GRASS=dcR(['#24341a','#4c6e2c','#8cb450']), FOOT_MOSS=dcR(['#1c2814','#3a5222','#64803a']);
function wallFoot(wx,gy,bot,L,t,P_){
  const pn=NZB[(((gy>>3)*7+40)&255)<<8|((wx*3+17)&255)];
  if(pn<.40) return;
  const a=Math.min(1,(pn-.40)*4.5), h=ihash(wx,gy*3+5), n2=NZB[((gy*5+90)&255)<<8|((wx*7+3)&255)];
  occGY=gy+2;
  /* 苔：面のいちばん下（列の最後に描いたドット bot）から上へ 1〜5 ドット這い上がり、床にも1ドットはみ出す。縁は網目で間引く */
  const up=Math.round(1+a*2.5+(n2-.5)*4);
  for(let k=-1;k<up;k++){ const Y=bot-k;
    const edge=k===up-1||k<0; if(edge&&BAYER[((Y&3)<<2)|(wx&3)]>a*.9) continue;
    dpf(wx,Y,sh3(FOOT_MOSS,L*(.95-k*.06),wx,Y)); }
  /* 草：3列に1本くらい、床から2〜7ドット。房にして2本目を隣に。先だけゆっくり揺れる */
  if(h%3===0&&a>.25){ const hgt=2+(h>>>8)%6, sw=Math.sin(t*1.2+wx*.7)*.7, lean=((h>>>12)&1)?1:-1;
    for(const [ox,hh] of [[0,hgt],[lean,Math.max(2,hgt-2)]]){
      for(let j=0;j<hh;j++){ const q=j/hh, X=wx+ox+(j>=hh-2?Math.round(sw*q+lean*q):0), Y=bot+1-j;
        dpf(X,Y,sh3(FOOT_GRASS,L*(.85+q*.55),X,Y)); } } }
  occGY=null;
}
/* 石の層：蔦は天井（北の壁の天辺の縁）から垂れる（2026-10-05 ユーザー要望「石の層の長い蔦は天井から垂れるようにして」）。
   蔦の置き場所（北の壁の下のマス）の近く±3列に壁の列があれば、その列の天辺の縁の下から、面の前を垂らす。
   1〜3本。1本目は面の高さの 0.8〜1.25 倍（床まで届いた先は少し溜まる）、横の2本は短め。先ほど大きく揺れ、ところどころ葉が付く。
   壁の無い所（岩が薄い・灯りの外）では、前の通り縁から床へ短く垂らす。 */
function vineFromCeiling(d,t,L,P_){
  const WT=G._wtops; if(!WT||!WT.size) return false;
  const x=Math.round(d.x); let c=null, cx=x;
  for(const dx of [0,-1,1,-2,2,-3,3]){ const q=WT.get(x+dx); if(q&&Math.abs(q.gy-d.y)<10){ c=q; cx=x+dx; break; } }
  if(!c) return false;
  const s=d.s, Lv=Math.max(L,c.L);
  occGY=c.gy;
  /* 1〜3本を少しずつずらして垂らす（1本目がいちばん長い） */
  const n=1+(s%3===0?2:s%2);
  for(let k=0;k<n;k++){ const sx=cx+(k===0?0:k===1?2:-2), q0=WT.get(sx)||c, Hf=q0.gy-q0.top;
    const len=Math.max(6,Math.round(Hf*((k===0?.8:.45)+((s>>>(k*5))%45)/100))), sw=Math.sin(t*.8+s+k*1.7)*1.4, y0=q0.top-1, ss=s+k*97;
    for(let j=0;j<len;j++){ const q=j/len, Y=y0+j, X=sx+Math.sin(j*.7+ss)*.8+sw*q*q;
      if(Y>q0.gy+1) break;
      dpf(X,Y,sh3(P_.vine,Lv*(1.25-q*.45),X|0,Y));
      if(j%3===1) dpf(X+((j>>1)&1?1:-1),Y,P_.vine[(j+ss)%4===1?2:1]);         // 葉
      if(j%5===3&&(ss>>>j)%2) dpf(X+((j>>2)&1?-1:1),Y+1,P_.vine[1]); }
    if(len>=Hf){ const Xe=sx+sw; dpf(Xe-1,q0.gy+1,P_.vine[1]); dpf(Xe+1,q0.gy+1,P_.vine[0]); } }   // 床に届いた先は少し溜まる
  occGY=null;
  return true;
}
const WD_FORM=.55, WD_SPL=.28;
function wallDrips(tops,t){
  const drop=C('#cfeaff'), trail=C('#6f9cc0'), spl=C('#9cc8e8'), dimD=C('#6a92ae'), dimT=C('#34566e');
  const pick=x=>ihash(x*31+7,913)%3===0;
  for(const q of tops){ if(!q||!pick(q.wx)||pick(q.wx-1)) continue;
    const hp=ihash(q.wx*7+3,914), per=1.0+(hp%1000)/1000*1.4, u=(t+(ihash(q.wx,9157)%1000)/1000*per)%per;   // 間隔・ずれ・着く所は別々のハッシュで（同じ値から取ると隣どうしが揃った）
    const y0=q.top-1, land=q.gy+1+ihash(q.wx,733)%3, lit=q.L>.3, cD=lit?drop:dimD, cT=lit?trail:dimT;
    const FALL=.20+(land-y0)*.005;
    occGY=land;
    if(u<WD_FORM){ const k=u/WD_FORM;                                       // 縁の下で膨らむ
      dpf(q.wx,y0+1,cT); if(k>.45) dpf(q.wx,y0+2,cD); if(k>.8) dpf(q.wx,y0+3,cD); }
    else if(u<WD_FORM+FALL){ const k=(u-WD_FORM)/FALL, y=y0+3+(land-y0-3)*k*k;   // 落ちる
      dpf(q.wx,y,cD); dpf(q.wx,y-1,cD); dpf(q.wx,y-2,cT); if(k>.3) dpf(q.wx,y-3,cT); if(k>.6) dpf(q.wx,y-4,cT); }
    else if(u<WD_FORM+FALL+WD_SPL){ const k=(u-WD_FORM-FALL)/WD_SPL, r=1+k*4;  // 水しぶき
      if(k<.7) for(const [ax,ay] of [[-1,0],[1,0],[-.7,-.5],[.7,-.5]]) dpf(q.wx+ax*r,land+ay*r,lit?spl:dimD);
      if(k<.3) dpf(q.wx,land,cD); }
  }
  occGY=null;
}
function drawDeco(bx0,by0,t,blindR){
  DB0x=bx0; DB0y=by0; const P_=G.Z.id==='sump'?DECO_PAL_WET:DECO_PAL, code=G.code, PW=G.PW;
  RUIN_AGE=ruinAgeOf();
  occD.fill(-32768); occGY=null;
  drawPools(bx0,by0,t,blindR);
  drawDrips(bx0,by0,t,blindR);
  drawNorthWalls(bx0,by0,t,blindR,P_);
  if(CAVE.deco!==false) for(const d of G.deco){                    // CAVE.deco=false：床の置き物を描かない（測定用）
    const mg=d.ext||0;                                  // 大きな水溜りは端で切らない
    if(d.x<bx0-24-mg||d.y<by0-8-mg||d.x>bx0+bw+24+mg||d.y>by0+bh+30+mg) continue;
    if(d.ok===0){ // 岩に埋まっていたら床の側へずらす。ずらしきれなければ出さない
      let x=d.x,y=d.y,okk=-1; for(let i=0;i<10;i++){ const c=code[(y|0)*PW+(x|0)]; if(!c){okk=1;break;} x-=d.wdx||0; y-=d.wdy||0; if(!d.wdx&&!d.wdy) break; }
      d.ok=okk; d.x=x; d.y=y; }
    if(d.ok<0) continue;
    if(!seenAt(G.f,G.L,d.x|0,d.y|0) && !(mg && [[-mg,0],[mg,0],[0,-mg],[0,mg]].some(([ox,oy])=>seenAt(G.f,G.L,(d.x+ox)|0,(d.y+oy)|0)))) continue;
    if(Math.hypot(d.x-lampX,d.y-lampY)>blindR+mg) continue;
    const L0=pxLight(d.x,d.y), L=Math.max(.22,L0), s=d.s, x=d.x, y=d.y;   // L0：生の明るさ（遺跡はこれで塗る。.22 の下限があると暗がりで遺跡だけ浮いた）
    occGY = standBox(d) ? Math.round(d.y) : null;        // 高さのある手描きの品目は、錨点（根元）の y で前後を決める
    if(mg && ruinBigFor(d)){ occGY=null; const sp_=ruinBigFor(d); drawBigSprite(d,t,sp_); if(RUIN_AGE>0&&!/^(pave|steps)_/.test(d.name||'')) ruinShrooms(d,sp_.ax,sp_.w-sp_.ax,L0); continue; }   // 3Dから作った大きな遺跡（経年のキノコを根元に）
    { const cs=(d.k==='rock'||d.k==='stalagC'||d.k==='column')&&caveSprFor(d); if(cs){ occGY=null; drawCaveSprite(d,cs,P_); occGY=null; continue; } }   // 3Dから作った石の層の岩・石筍
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
    /* 海藻の株（水の層の床）：3〜5本の葉が根元から立ち、波打ちながらゆっくり揺れる。ところどころ気泡の袋（黄土の点） */
    case 'kelp': { const n=3+s%3;
      for(let i=0;i<n;i++){ const h=hs(s,i+3), bx=x-(n-1)*1.5+i*3+((h>>>3)&1), Hh=11+h%11, ph=(h%628)/100;
        for(let j=0;j<Hh;j++){ const q=j/Hh, px=bx+Math.sin(t*.9+j*.35+ph)*1.6*q+Math.sin(j*.5+ph)*.7, py=y-j;
          const c=j>=Hh-2?P_.kelpTip:sh3(P_.kelp,L*(.75+q*.6),px|0,py);
          dp(px,py,c); if(j>2&&j<Hh-2&&(j+i)%4===0) dp(px+((i+j)&1?1:-1),py,sh3(P_.kelp,L*(.6+q*.5),(px|0)+1,py));
          if(j>3&&(h>>>j)%9===0) dp(px,py,P_.kelpBlad); } }
      break; }
    /* 藻の広がり（水の層の床）：平たいまだらの塊。濃淡の筋を混ぜて、ところどころ明るい粒 */
    case 'algae': { const rx=6+s%5, ry=2+(s>>>3)%2;
      for(let dy=-ry;dy<=ry;dy++)for(let dx=-rx;dx<=rx;dx++){
        const nx=dx/rx, ny=dy/ry, dd=nx*nx+ny*ny; if(dd>1) continue;
        const hh=hs(s,(dx+20)*40+(dy+20)); if(dd>.35&&hh%5<2) continue;
        const px=x+dx+((dy&1)?((s>>>5)&1):0), py=y+dy, st=Math.sin((dx+s%7)*.9+dy*2.1);
        dp(px,py,sh3(P_.alg, L*(1-dd*.3)*(st>.4?1.15:.85)*(.8+(hh>>>4)%3*.12), px,py)); }
      for(let i=0;i<3;i++){ const h=hs(s,i+90); if(Math.sin(t*1.1+i*2.3+s)>.3) dp(x+(h%(rx*2))-rx,y+((h>>>5)%(ry*2+1))-ry,P_.algTip); }
      break; }
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
    case 'pillar': if(G.Z.id==='sump'){ drawRuinPost(d,t,L0,false); if(RUIN_AGE>0) ruinShrooms(d,4,4,L0); break; } { const H=18+s%12, bx=x-4;
      drect(bx-2,y-2,bx+9,y+1,P_.stone,L*.9,true); drect(bx-1,y-4,bx+8,y-3,P_.stone,L,true);
      for(let j=5;j<H;j++){ const top=j>H-4; for(let q=0;q<8;q++){ if(top&&hs(s,q+j*7)%3===0) continue; const px=bx+q, py=y-j; dp(px,py,(q===2||q===5)?P_.stone[0]:sh3(P_.stone,L*(q<2?1.25:q>6?.6:1),px,py)); } }
      if(s%2){ const fx=x+(s%3?10:-15), fy=y+3; drect(fx,fy-4,fx+7,fy,P_.stone,L,true); dp(fx+2,fy-2,P_.stoneDk); dp(fx+5,fy-2,P_.stoneDk); }
      if(P_.algae) for(let i=0;i<14;i++){ const h=hs(s,i+200), px=bx-2+(h%12), py=y+1-((h>>>5)%(3+(h>>>9)%6)); dp(px,py,sh3(P_.algae,L*1.1,px,py)); }   // 根元の藻
      break; }
    /* ---- 水の中の遺跡（水の層・第16〜20階層）----
       立っている物は wmask を消して描く（dpw の 0）——水面の揺らぎ（屈折）と波の線が乗らない。
       沈んだ跡だけは水の色に混ぜて、印を残す＝水と一緒に揺れて「水の下にある」に見える。 */
    case 'wpost': drawRuinPost(d,t,L0,true); break;   // 水の中の柱にはキノコを生やさない
    case 'wwall': { const w=wwallW(d), H=7+s%5, x0=x-(w>>1), sb=P_.stone, fR=ruinF(L0), lr=c=>mixU(RP_DARK,c,fR); occGY=y;   // lr：遺跡と同じ明るさ   // 前後の印（水面に映る）
      for(let xx=0;xx<w;xx++){ const eH=H-((hs(s,xx)%3)*(xx>w*.55?1:0))-(xx<2||xx>w-3?1:0);
        for(let yy=0;yy<eH;yy++){ const px=x0+xx, py=y-yy, mortar=(yy%3===2)||(((xx+((yy/3|0)%2)*3)%6)===0);
          dpw(px,py, lr(yy===eH-1?P_.stoneHi:mortar?P_.stoneDk:sh3(sb,.5*(xx<w/3?1.15:.85),px,py)), 0); }
        if(((xx+((t*4)|0))%5)!==0) dpw(x0+xx,y+1,lr(P_.foam),0); }
      if(P_.algae) for(let i=0;i<8+Math.round(28*RUIN_AGE);i++){ const h=hs(s,i+60); dpw(x0+(h%w), y-((h>>>5)%(2+Math.round(3*RUIN_AGE))), lr(sh3(P_.algae,1,x0,y)),0); }
      if(RUIN_AGE>0) for(let xx=0;xx<w;xx++){ if(hs(s,xx+700)%100>=70*RUIN_AGE) continue; const eH=H-((hs(s,xx)%3)*(xx>w*.55?1:0))-(xx<2||xx>w-3?1:0);   // 天辺に積もった苔
        dpw(x0+xx,y-eH+1,lr(RUIN_MOSS[2+(hs(s,xx+800)&1)]),0); if(hs(s,xx+900)%3===0) dpw(x0+xx,y-eH+2,lr(RUIN_MOSS[1]),0); }
      break; }
    case 'wsteps': { const fR=ruinF(L0), lr=c=>mixU(RP_DARK,c,fR); for(let i=0;i<3;i++){ const h=hs(s,i), px=x-9+i*8+(h%3)-1, py=y+((h>>>3)%5)-2;
        for(let yy=-2;yy<=1;yy++)for(let xx=-3;xx<=3;xx++){ if(xx*xx/10+yy*yy/2.6>1) continue;
          const mo=RUIN_AGE>0&&yy<0&&hs(s,i*50+xx*7+yy)%100<75*RUIN_AGE;                              // 上面の苔（経年）
          dpw(px+xx,py+yy, lr(mo?RUIN_MOSS[yy===-2?3:2]:yy<0?P_.stoneHi:sh3(P_.stone,.45,px+xx,py+yy)),0); }
        if(Math.sin(t*2+i+s)>.3) dpw(px+4,py+1,lr(P_.foam),0); }
      break; }
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
    case 'wfallen': drawFallenColumn(d,t,L0); break;
    case 'ruinroom': drawRuinRoom(d,t,L0); break;
    case 'fallen': if(G.Z.id==='sump'){ drawFallenColumn(d,t,L0); break; } { const len=26+s%10, R=3, x0=x-(len>>1), dir=s%2?1:-1;
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
    case 'vine': { if(vineFromCeiling(d,t,L,P_)) break;
      const len=10+s%14, sw=Math.sin(t*.8+s)*1.2;
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
  occGY=null;
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
const SOAP_IRI=['#a8e4ff','#e8b8ff','#fff0a8','#b8ffd8'], SOAP_RIM={}, SOAP_DOT=[[0,-1,4.71],[1,0,0],[0,1,1.57],[-1,0,3.14]];   // 半径1は十字の4点（四角い輪だと泡に見えない）
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
  /* 小さい泡（2026-10-05 ユーザー要望「小さいものもふよふよさせたい」）：半径1〜2ドット、床のおよそ12マスに1つ。
     大きい泡よりゆっくり昇り、左右と上下に2つの揺れを重ねて、ふよふよ漂う */
  let ns=0;
  for(let ty=1;ty<f.H-1&&ns<240;ty++)for(let tx=1;tx<f.W-1;tx++){
    if(f.g[ty][tx]!==T.FLOOR) continue; const h=hs(tx*31337+ty*7919+depth*11,917);
    if(h%1000>=85) continue;
    out.push({hx:tx*Q+2+(h>>>20)%12, hy:ty*Q+2+(h>>>24)%12, s:h, r:1+((h>>>4)&1), small:true, life:6+((h>>>8)%500)/100, age:((h>>>12)%1000)/1000*6, ox:0, oy:0});
    if(++ns>=240) break; }
  return out;
}
function soapStep(dt){
  if(CAVE.soap===false) return;                                             // 測定用（画面の1点の色を読むテストで、泡が横切って値が揺れないように）
  if(!G.soap) G.soap=genSoap(G.f);
  const ps=TS/Q, t=(performance.now()-T0)/1000, camX=P.x*TS-innerWidth/2, camY=P.y*TS-innerHeight/2;
  const px=P.x*Q, py=P.y*Q-8, hw=innerWidth/ps/2+16, hh=innerHeight/ps/2+16, q=Math.ceil(ps);
  ctx.save();
  for(const b of G.soap){
    b.age+=dt;
    if(b.age>b.life+.3){ b.age=0; const h=hs(b.s,(t*10)|0); b.ox=(h%17)-8; b.oy=((h>>>5)%11)-5; }
    const u=Math.min(b.age,b.life), k=u/b.life;
    const x=b.small? b.hx+b.ox+Math.sin(u*1.7+b.s%7)*3+Math.sin(u*.55+b.s%5)*4 : b.hx+b.ox+Math.sin(u*1.1+b.s%7)*5;
    const y=b.small? b.hy+b.oy-4-12*k+Math.sin(u*2.4+b.s%11)*1.6 : b.hy+b.oy-6-22*k;
    if(Math.abs(x-px)>hw||Math.abs(y-py)>hh) continue;
    if(b.age<b.life && Math.hypot(x-px,y-py)<b.r+5) b.age=b.life;          // 触れると弾ける
    if(!tileSeen(x/Q,(y+6)/Q)) continue;
    if(Number.isFinite(CAVE.visTiles)&&Math.hypot(x-px,y-py+4)>CAVE.visTiles*Q) continue;
    const lit=CAVE.lightAt(x/Q,(y+6)/Q), sx=Math.round(x*ps-camX), sy=Math.round(y*ps-camY);
    if(b.age>=b.life){                                                        // 弾けた：4つの飛沫が外へ
      const e=(b.age-b.life)/.3; ctx.globalAlpha=(1-e)*(.4+.5*lit); ctx.fillStyle=SOAP_IRI[0];
      for(const [ax,ay] of [[-1,-1],[1,-1],[-1,1],[1,1]]) ctx.fillRect(sx+Math.round(ax*(b.r+1+e*3)*ps),sy+Math.round(ay*(b.r+1+e*3)*ps),q,q);
      continue; }
    const fade=Math.min(1,b.age/.6)*(k>.92?1-(k-.92)/.08*.5:1), A=((b.small?.4:.22)+.5*lit)*fade;   // 小さい泡は暗がりでも少し見える
    for(const [rx,ry,a] of (b.r===1?SOAP_DOT:soapRim(b.r))){
      ctx.globalAlpha=A*(ry<0?1:.7); ctx.fillStyle=SOAP_IRI[((a/6.2831853+t*.12+(b.s%100)/100)*4|0)&3];
      ctx.fillRect(sx+rx*ps|0, sy+ry*ps|0, q, q); }
    if(b.r>1){ ctx.globalAlpha=Math.min(1,A*1.8); ctx.fillStyle='#ffffff';
      ctx.fillRect(sx+Math.round(-b.r*.5)*ps|0, sy+Math.round(-b.r*.5)*ps|0, q, q); }   // 照り（いちばん小さい泡には付けない）
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
  PT.alpha=1; PT.outA=1;
  if(SPR.N!==N){SPR.N=N;SPR.cv.width=SPR.cv.height=N;SPR.id=SPR.cx.createImageData(N,N);SPR.u32=new Uint32Array(SPR.id.data.buffer);}
  else SPR.u32.fill(0);
  PT.N=N;PT.k=k;PT.ox=N/2;PT.oy=N-Math.max(3,Math.round(3*k));const l=Math.hypot(lx,ly)||1;PT.lx=lx/l;PT.ly=ly/l;PT.lit=lit;PT.glows.length=0;
}
function put(X,Y,c){ if(X>=0&&Y>=0&&X<PT.N&&Y<PT.N) SPR.u32[Y*PT.N+X]=PT.alpha<1?(((c&0xffffff)|((PT.alpha*255|0)<<24))>>>0):c; }   // PT.alpha：半透明の体（シルトジェリー）
const sx_=x=>Math.round(PT.ox+x*PT.k), sy_=y=>Math.round(PT.oy+y*PT.k);
function dot(x,y,c){ const s=Math.max(1,Math.round(PT.k)),X=sx_(x),Y=sy_(y); for(let j=0;j<s;j++)for(let i=0;i<s;i++)put(X+i,Y+j,c); }
function glow(x,y,c,sz=1,a=1){ PT.glows.push([x,y,c,sz,a]); }
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
  else if(!p.soft){ const o=PT.outA<1?(((p.o&0xffffff)|((PT.outA*255|0)<<24))>>>0):p.o, src=u.slice();
    for(let Y=0;Y<N;Y++)for(let X=0;X<N;X++){const i=Y*N+X; if(src[i]) continue;
      if((X>0&&src[i-1])||(X<N-1&&src[i+1])||(Y>0&&src[i-N])||(Y<N-1&&src[i+N])) u[i]=o;} }
  else { for(let i=0;i<u.length;i++){ if(u[i]&&((i*7+(i/N|0))%5===0)&&!( (u[i-1]&&u[i+1]&&u[i-N]&&u[i+N]) )) u[i]=0; } }  // 輪郭が滲む
  for(const [x,y,c,sz,a] of PT.glows){ PT.alpha=a==null?1:a; const s=Math.max(1,Math.round(PT.k*sz)),X=sx_(x),Y=sy_(y); for(let j=0;j<s;j++)for(let i=0;i<s;i++)put(X+i,Y+j,c); }
  PT.alpha=1;
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
/* シルトジェリー：体は半分以上透ける（2026-10-05 ユーザー要望「シルトジェリーはもっと透けさせたい」）。
   傘は 42%、輪郭は 65%、触手は根元 70%→先 40%。照り（白い点）だけは不透明で、水の中の物と読める */
const JELLY_A=.42, JELLY_OUT=.65;
function jelly(p,t){
  const b=Math.sin(t*2.6)*1.2, y=-9+b;
  PT.alpha=JELLY_A; PT.outA=JELLY_OUT;
  ell(0,y,3.8,2.9,p.G,true); PT.alpha=1; hole(0,y+2.2,4.2,1.1,0);
  for(let i=-1.5;i<=1.5;i+=1){const bx=i*2; for(let j=1;j<=8;j++) glow(bx+Math.sin(t*3+j*.6+i*2)*j/8*1.8,y+1.2+j*.9,j<4?p.G[1]:((j+((t*6)|0))%2?p.G[1]:p.G[0]),1,.7-j*.04);}
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
/* ---------- 空引きのヴェラ（10階の大ボス）----------
   2026-10-03 ユーザー要望「ヴェラのそれぞれの形態のグラフィックを作って」→ 同日「見本（暗い体に強く光る差し色の
   ドット絵2枚）をクオリティの基準に、こういうテイストで」。手打ちのドット絵に描き直した。
   - 絵は tools/vera_px.py が部品ごとに作り、VERA_SPR に書く（1ドット＝ゲームの1ドット。倍率は掛けない）。
   - 第一形態：大弓を引く狩人（f1.parts の idle0〜3 / draw0〜1）。
   - 第二形態：上半身（body の idle0〜3 / draw0〜1 / down0）＋岩の蟹の脚6本（legs）。脚は奥の3本→体→手前の3本の順に重ねる。
     部位破壊の4本（Nb/Nf/Sb/Sf＝奥・手前×後ろ・前）は、壊れ具合で ok / hurt / crit / broken の絵を出し分ける。
   - 琥珀（VERA_SPR.amb）は自分で光る色：ランタンの明るさで暗くしない。溜め中は一段・引き絞りで二段明るくする。
   - 置く位置は絵の外枠でなく固定の錨点（anchor＝待機の絵の中心）。脚が壊れても体が跳ねない。 */
/*VERA_SPR_BEGIN*/const VERA_SPR={"pal":["#0a0b0f","#16171b","#22252a","#31363a","#434b4b","#5b6661","#7f8b82","#121318","#1c1e25","#282b34","#393d48","#11211f","#193536","#244c4a","#376a64","#558e82","#463e33","#776d59","#aa9f87","#d6cdb4","#f3edda","#2b1f15","#4d3723","#755532","#a27b49","#5e2610","#a8471a","#e7832a","#ffc25a","#fff1bd"],"emis":[26,27,28,29,30],"amb":[26,27,28,29,30],"f1":{"parts":{"idle0":{"w":37,"h":48,"x":-17,"y":-46,"d":"30.2A34.ATRA33.ATRA33.ATRA33.ATRA33.ATRA20.A11.ASTRA19.AOA10.ASTSRA18.ANOA8.ASATSRA18.ANMOA7.AS2ATRA18.AN2MO2A4.ASA.ATSRA16.AO4M2OA3.ASA.ATSRA11.4A.AN6MOA.ASA2.ATSRA10.A3XY2AN4M3HA.ASA2.ATSRA10.AXAXWYO4M2HS2TASA4.ATSRA9.AVY3WL4MH2RScASA4.ASRWA10.AX3WYN3M3H3SA5.ASRWA10.AV4WL2M6TSA5.ASRWA11.AX6T6RSA5.ASRWA11.AV6R3PN3ASA4.ASRWA11.2A2O2R2T4NP2ASA4.AY2XWA9.A2OMO2N2RT4N2ASA4.AY2XWA8.AOML2M4NR4NMASA4.AY2XWA7.AO2ML2MO7NM3ASA3.AY2XWA7.ANOMLMLON4MN4TXS4A2U2XWA6.AOMOL2MLOM4IM4RW2TXTR2SRXWA6.ANOMLMPLM7I4A2RW5RWA6.AOLOML2MK8IKA2.AS4ASRWA6.ANLOML2MJ9IA2.ASA2.ASRWA5.AOMLOML2MJ9IA2.ASA2.ASRWA5.ANLOML2MLJ9IA2.ASA2.ASRWA4.AOMLOML2ML10XA3.ASA.ASRWA4.ANPLOML2ML10WA3.AS2ATSRA4.AO2MLOML3MJ6IT2IA3.AS2ATSRA4.ANMLO2ML3MH6IR2IA3.AS2ATSRA3.AO2MLOML3MYXJIH3IXJIA4.ASATSRA3.AN2ML2ML3MYXJIAJIHXHIA4.ASATRA3.AL2ML3ML2MY2XJHAHIW2XHYA3.ASTSRA4.ANLAN2MLMY2WXHA.AHAWX2WYA2.ASTSRA4.AL2ALMLAN4YA3.A.A3YXA3.ATRA6.A2.AN2AY3VWA5.AY3VA3.ATRA9.AL2AY3XA6.AW3XYA.A2TRA10.2AYX3VA7.AY3VA2.ATRA11.A5KA7.A5KA.ATRA11.AJ4IA7.AJ4IA.ATRA11.AJ4IKA6.AJ4IK2ATRA11.A6HA6.A6HA.2A13.6A8.6A9."},"idle1":{"w":38,"h":48,"x":-18,"y":-46,"d":"31.2A35.ATRA34.ATRA34.ATRA34.ATRA34.ATRA21.A11.ASTRA20.AOA10.ASTSRA19.ANOA8.ASATSRA19.ANMOA7.AS2ATRA19.AN2MO2A4.ASA.ATSRA17.AO4M2OA3.ASA.ATSRA12.4A.AN6MOA.ASA2.ATSRA11.A3XY2AN4M3HA.ASA2.ATSRA11.AXAXWYO4M2HS2TASA4.ATSRA10.AVY3WL4MH2RScASA4.ASRWA11.AX3WYN3M3H3SA5.ASRWA11.AV4WL2M6TSA5.ASRWA12.AX6T6RSA5.ASRWA12.AV6R3PN3ASA4.ASRWA12.2A2O2R2T4NP2ASA4.AY2XWA10.A2OMO2N2RT4N2ASA4.AY2XWA9.AOML2M4NR4NMASA4.AY2XWA8.AO2ML2MO7NM3ASA3.AY2XWA8.ANOMLMLON4MN4TXS4A2U2XWA7.AOMOL2MLOM4IM4RW2TXTR2SRXWA7.ANOMLMPLM7I4A2RW5RWA7.AOLOML2MK8IKA2.AS4ASRWA7.ANLOML2MJ9IA2.ASA2.ASRWA6.AOMLOML2MJ9IA2.ASA2.ASRWA6.ANLOML2MLJ9IA2.ASA2.ASRWA5.AOMLOML2ML10XA3.ASA.ASRWA4.AOMPLOML2ML10WA3.AS2ATSRA5.AN2MLOML3MJ6IT2IA3.AS2ATSRA4.AO2MLO2ML3MH6IR2IA3.AS2ATSRA3.AO3MLOML3MYXJIH3IXJIA4.ASATSRA3.AN3ML2ML3MYXJIAJIHXHIA4.ASATRA3.AL2ML4ML2MY2XJHAHIW2XHYA3.ASTSRA4.ANLAL2M2LMY2WXHA.AHAWX2WYA2.ASTSRA4.ALA.ANM2AN4YA3.A.A3YXA3.ATRA6.A2.ANL2AY3VWA5.AY3VA3.ATRA9.ALA.AY3XA6.AW3XYA.A2TRA10.A.AYX3VA7.AY3VA2.ATRA12.A5KA7.A5KA.ATRA12.AJ4IA7.AJ4IA.ATRA12.AJ4IKA6.AJ4IK2ATRA12.A6HA6.A6HA.2A14.6A8.6A9."},"idle2":{"w":38,"h":49,"x":-18,"y":-47,"d":"31.2A35.ATRA34.ATRA34.ATRA34.ATRA34.ATRA21.A11.ASTRA20.AOA10.ASTSRA19.ANOA8.ASATSRA19.ANMOA7.AS2ATRA19.AN2MO2A4.ASA.ATRA18.AO4M2OA3.ASA.ATSRA12.4A.AN6MOA.ASA2.ATSRA11.A3XY2AN4M3HA.ASA2.ATSRA11.AXAXWYO4M2HS2TASA4.ATSRA10.AVY3WL4MH2RScASA4.ASRWA11.AX3WYN3M3H3SA5.ASRWA11.AV4WL2M6TSA5.ASRWA12.AX6T6RSA5.ASRWA12.AV6R3PN3ASA4.ASRWA12.2A2O2R2T4NP2ASA4.ASRWA11.A2OMO2N2RT4N2ASA4.AY2XWA9.AOML2M4NR4NMASA4.AY2XWA8.AO2ML2MO7NM3ASA3.AY2XWA8.ANOMLMLON4MN4TXS4A2U2XWA7.AOMOL2MLOM4IM4RW2TXTR2SRXWA7.ANOMLMPLM7I4A2RW5RWA7.AOLOML2MK8IKA2.AS4ASRWA7.ANLOML2MJ9IA2.ASA2.ASRWA6.AOMLOML2MJ9IA2.ASA2.ASRWA6.ANLOML2MLJ9IA2.ASA2.ASRWA5.AOMLOML2ML10XA3.ASA.ASRWA4.AOMPLOML2ML10WA3.ASA.ASRWA4.AN2MLOML3MJ6IT2IA3.AS2ATSRA4.AO2MLO2ML3MH6IR2IA3.AS2ATSRA3.AO3MLOML3MYXJIH3IXJIA4.ASATSRA3.AN3ML2ML3MYXJIAJIHXHIA4.ASATRA3.AL2ML4ML2MY2XJHAHIW2XHYA3.ASATRA4.ANLAL2M2LMY2WXHA.AHAWX2WYA2.ASTSRA4.ALA.ANM2AN4YA3.A.A3YXA3.ATSRA5.A2.ANL2AYX2VWA5.AYX2VA3.ATRA9.ALA.AYV2XA6.AWV2XA3.ATRA10.A2.AYX2VA7.AYX2VA.A2TRA12.AYXVXWA7.AYV2XA2.ATRA12.A5KA7.A5KA.ATRA12.AJ4IA7.AJ4IA.ATRA12.AJ4IKA6.AJ4IK2ATRA12.A6HA6.A6HA.2A14.6A8.6A9."},"idle3":{"w":37,"h":48,"x":-17,"y":-46,"d":"30.2A34.ATRA33.ATRA33.ATRA33.ATRA33.ATRA20.A11.ASTRA19.AOA10.ASTSRA18.ANOA8.ASATSRA18.ANMOA7.AS2ATRA18.AN2MO2A4.ASA.ATSRA16.AO4M2OA3.ASA.ATSRA11.4A.AN6MOA.ASA2.ATSRA10.A3XY2AN4M3HA.ASA2.ATSRA10.AXAXWYO4M2HS2TASA4.ATSRA9.AVY3WL4MH2RScASA4.ASRWA10.AX3WYN3M3H3SA5.ASRWA10.AV4WL2M6TSA5.ASRWA11.AX6T6RSA5.ASRWA11.AV6R3PN3ASA4.ASRWA11.2A2O2R2T4NP2ASA4.AY2XWA9.A2OMO2N2RT4N2ASA4.AY2XWA8.AOML2M4NR4NMASA4.AY2XWA7.AO2ML2MO7NM3ASA3.AY2XWA7.ANOMLMLON4MN4TXS4A2U2XWA6.AOMOL2MLOM4IM4RW2TXTR2SRXWA6.ANOMLMPLM7I4A2RW5RWA6.AOLOML2MK8IKA2.AS4ASRWA6.ANLOML2MJ9IA2.ASA2.ASRWA5.AOMLOML2MJ9IA2.ASA2.ASRWA5.ANLOML2MLJ9IA2.ASA2.ASRWA4.AOMLOML2ML10XA3.ASA.ASRWA4.ANPLOML2ML10WA3.AS2ATSRA4.AO2MLOML3MJ6IT2IA3.AS2ATSRA4.ANMLO2ML3MH6IR2IA3.AS2ATSRA3.AO2MLOML3MYXJIH3IXJIA4.ASATSRA3.AN2ML2ML3MYXJIAJIHXHIA4.ASATRA3.AL2ML3ML2MY2XJHAHIW2XHYA3.ASTSRA4.ANLAN2MLMY2WXHA.AHAWX2WYA2.ASTSRA4.AL2ALMLAN4YA3.A.A3YXA3.ATRA6.A2.AN2AY3VWA5.AY3VA3.ATRA9.AL2AY3XA6.AW3XYA.A2TRA10.2AYX3VA7.AY3VA2.ATRA11.A5KA7.A5KA.ATRA11.AJ4IA7.AJ4IA.ATRA11.AJ4IKA6.AJ4IK2ATRA11.A6HA6.A6HA.2A13.6A8.6A9."},"draw0":{"w":38,"h":48,"x":-18,"y":-46,"d":"31.2A35.ATRA34.ATRA34.ATRA34.ATRA34.ATRA21.A11.AbTRA20.AOA10.AbTSRA19.ANOA8.AbATSRA19.ANMOA7.Ab2ATRA19.AN2MO2A4.AbA.ATSRA17.AO4M2OA3.AbA.ATSRA12.4A.AN6MOA.AbA2.ATSRA11.A3XY2AN4M3HA.AbA2.ATSRA11.AXAXWYO4M2HS2TAbA4.ATSRA10.AVY3WL4MH2RScAbA4.ASRWA11.AX3WYN3M3H2Sb2GA3.ASRWA11.AV4WL2M6TbDbA3.ASRWA12.AX6T6Rb2A4.ASRWA12.AV6R3PN3AbA4.ASRWA12.2A2O2R2T4NP2AbA4.AY2XWA10.A2OMO2N2RT4N2AbA4.AY2XWA9.AOML2M4NR4NMAbA4.AY2XWA8.AO2ML2MO7NM3AbA3.AY2XWA8.ANOMLMLON4MN4TXb4A2U2XWA7.AOMOL2MLOM4IM4RW2TXTR2SRXWA7.ANOMLMPLM7I4A2RW5RWA7.AOLOML2MK8IKA2.Ab4ASRWA7.ANLOML2MJ9IA2.AbA2.ASRWA6.AOMLOML2MJ9IA2.AbA2.ASRWA6.ANLOML2MLJ9IA2.AbA2.ASRWA5.AOMLOML2ML10XA3.AbA.ASRWA4.AOMPLOML2ML10WA3.Ab2ATSRA5.AN2MLOML3MJ6IT2IA3.Ab2ATSRA4.AO2MLO2ML3MH6IR2IA3.Ab2ATSRA3.AO3MLOML3MYXJIH3IXJIA4.AbATSRA3.AN3ML2ML3MYXJIAJIHXHIA4.AbATRA3.AL2ML4ML2MY2XJHAHIW2XHYA3.AbTSRA4.ANLAL2M2LMY2WXHA.AHAWX2WYA2.AbTSRA4.ALA.ANM2AN4YA3.A.A3YXA3.ATRA6.A2.ANL2AY3VWA5.AY3VA3.ATRA9.ALA.AY3XA6.AW3XYA.A2TRA10.A.AYX3VA7.AY3VA2.ATRA12.A5KA7.A5KA.ATRA12.AJ4IA7.AJ4IA.ATRA12.AJ4IKA6.AJ4IK2ATRA12.A6HA6.A6HA.2A14.6A8.6A9."},"draw1":{"w":38,"h":48,"x":-18,"y":-46,"d":"31.2A35.AbRA34.ATRA34.ATRA34.ATRA33.AcTRA21.A11.AcbRA20.AOA9.AcATSRA19.ANOA7.Ac2ATSRA19.ANMOA6.AcA.ATRA19.AN2MO2A3.AcA2.ATSRA17.AO4M2OA2.AcA2.ATSRA12.4A.AN6MO2AcA3.ATbRA11.A3XY2AN4M3HAcA4.ATSRA11.AXAXWYO4M2HS2TcA5.ATSRA10.AVY3WL4MH2RScA6.ASRWA11.AX3WYN3M3HS2GA5.ASRWA11.AV4WL6TcDcA5.ASRWA11.A6T6Rc2A6.ASbWA11.A6R5PNAcA6.ASRWA12.2A3R2T5NPcA6.AY2XWA10.A2OMON2R2T4NcA6.AY2XWA9.AOML2M3N2R4NMcA5.AY2XWA8.AO2ML2MO7NMAcA5.AYbXWA8.ANOMLMLON4MN4TX5A2U2XWA7.AOMOL2MLOM4IM4RW2TXTR2SRXWA7.ANOMLMPLM7I3Ac2RW5RWA7.AOLOML2MK8IK2Ac6ASRWA7.ANLOML2MJ9IA.AcA3.ASbWA6.AOMLOML2MJ9IA.AcA3.ASRWA6.ANLOML2MLJ9IA.AcA3.ASRWA5.AOMLOML2ML10XA2.AcA2.ASRWA4.AOMPLOML2ML10WA2.AcA.ATSRA5.AN2MLOML3MJ6IT2IA2.AcA.ATSRA4.AO2MLO2ML3MH6IR2IA3.Ac2ATbRA3.AO3MLOML3MYXJIH3IXJIA3.Ac2ATSRA3.AN3ML2ML3MYXJIAJIHXHIA3.Ac2ATRA3.AL2ML4ML2MY2XJHAHIW2XHYA3.AcTSRA4.ANLAL2M2LMY2WXHA.AHAWX2WYA2.AcTSRA4.ALA.ANM2AN4YA3.A.A3YXA2.AcTRA6.A2.ANL2AY3VWA5.AY3VA3.AbRA9.ALA.AY3XA6.AW3XYA.A2TRA10.A.AYX3VA7.AY3VA2.ATRA12.A5KA7.A5KA.ATRA12.AJ4IA7.AJ4IA.ATRA12.AJ4IKA6.AJ4IK2AbRA12.A6HA6.A6HA.2A14.6A8.6A9."}},"anchor":[1.5,-22.0]},"f2":{"body":{"idle0":{"w":66,"h":65,"x":-29,"y":-64,"d":"57.ATRA60..ATRSA60..ATRA39.A22.ATRA38.AOA20.ATSRA38.ANOA18.ASTSRA22.2A14.ANMO2A15.ASATSRA21.A2X2A11.AO3M2O2A12.ASA.ATSRA19.A4XYA10.AN5M2OA10.ASA2.ATSRA19.A2X2AWYA9.AN7MOA8.ASA3.ATSRA19.AV2X3WA9.AN8MOA6.ASA5.ATRA20.AX4WYA7.AO7M2HMOA4.ASA6.ATSRA19.AV2W3YA7.AN5M2HR3HA3.ASA7.ATSRA20.A2Y3WYA6.AN5M2HR3TA2.ASA9.ATRA20.AV5WYA5.AN5M2HRScbA.ASA10.ATSRA20.AV2W3VA.5AN5M2HR3S2ASA11.ATSRA21.A2VWUWYA5OL5MHR4SASA12.ATSRA21.AVWRX18RURSA13.AT2SRA19.2A2O2NXSULMO3M2L4MR2HRSA15.ATSRA18.A2ONL2MX2R2UO3MLM4LRL2ASA15.ATSRA16.2AONOML4ML2R2U2ML7MA.ASA14.AS2RWA13.2A2ONMOL5MLMORSUML5MUM3ASA14.AS2RWA12.A2O2NMOML2MP2MLMOM2RUR5MT3U2ASA13.AS2RWA11.AO2N3MOML4ML2MO3MR5MU4S2US2A13.ASRWA10.AONML2MOML5MLMO4ML5M3R4SUXU2A11.ASRWA9.AONOML2MOML5MLMO4ML2M3LI2K2R3SXS2U3A8.ASRWA9.ANMOL3MPML5MLMO3M4L6I2K3RSX2S2UX3A5.AS2RWA7.AOMOML2MOML5ML3M3L12IK2ARXR3SX3U2A3.AS2RWA6.AOLMOML2MOML5ML2ML16IK2AXA2R2SX2SUX4AY2XWA5.AONLOML3MOML8M18IKAS3A2RX3SX5U2XWA4.AONLMOAL2MOML8ML11I3S5I2ASA.3A2R2SXT3S2XWA3.AONMLO2A3MOML8M9I3S3HR4I2ASA4.2A2RXT3S2XWA3.ANMLMOMP2MO2ML7ML10I2H4IR3I2ASA6.3A4R2XWA2.AO2MLO2ML2MOML8M14I3S4IA.ASA8.3AY2XWA.AON2MLOML5ML7ML11I3S3HR3IA.ASA10.AY2XWA.AN2ML3ML8M2L3M13I2H4IR2IA2.ASA9.AY2XW2AL3M3L4ML5M2WLML14X2I3S3IA2.ASA9.AS2RWA.AL3M2AN3MAN3ML3ILI14W8XA2.ASA9.ASRWA3.ALML2AN2MLAL3MJ19IWT6WA3.ASA8.ASRWA4.ALA.AN2MA.ANMLIJ19IR6IA3.ASA8.ASRWA5.A2.ALMLA.ALMJ3IJ23IHA4.ASA6.AS2RWA9.ANA3.ALH3IHIJ15IH4IHA5.ASA6.AS2RWA9.ALA4.2AJIH5IJ11IH4IHA6.ASA6.AS2RWA10.A6.AJIH5IH5IH5IH4IA8.ASA5.ASRWA18.AJIAJ4IH5IH5IH3IHA8.ASA5.ASRWA18.AJHAJ3I2H5IH5IH3IA9.ASA4.AT2SRA18.AJ2AJ2IHAH4I2H4I2H3IA10.ASA3.ATSRA19.AH2AH2I2AH3IHAJ4IAH3IA10.ASA3.ATSRA20.A2.AJHA.AJ2I2AH3IH2AJIHA11.ASA2.ATSRA23.AJA2.AHIHA.AJ2IA.AHIA12.ASA2.ATRA24.AHA3.AJA2.AHIHA2.AHA12.ASA.ATSRA25.A4.AHA3.AJA4.A14.AS2ATSRA31.A4.AHA19.AS2ATRA38.A21.ASTSRA60.ASTSRA60.ASTSRA60.ATSRA60..ATSRA60..ATSRA60..A2TRA60.2.ATRA60.2.ATRSA60..ATRSA60..ATSRA60.2.3A6."},"idle1":{"w":67,"h":65,"x":-30,"y":-64,"d":"57.ATRSA60.2.ATRA40.A22.ATRA39.AOA20.ATSRA39.ANOA18.ASTSRA23.2A14.ANMO2A15.ASATSRA22.A2X2A11.AO3M2O2A12.ASA.ATRA21.A4XYA10.AN5M2OA10.ASA2.ATSRA20.A2X2AWYA9.AN7MOA8.ASA3.ATSRA20.AV2X3WA9.AN8MOA6.ASA5.ATRA21.AX4WYA7.AO7M2HMOA4.ASA6.ATSRA20.AV2W3YA7.AN5M2HR3HA3.ASA7.ATSRA21.A2Y3WYA6.AN5M2HR3TA2.ASA9.ATRA21.AV5WYA5.AN5M2HRScbA.ASA10.ATSRA21.AV2W3VA.5AN5M2HR3S2ASA11.ATSRA22.A2VWUWYA5OL5MHR4SASA12.ATSRA22.AVWRX18RURSA13.AT2SRA20.2A2O2NXSULMO3M2L4MR2HRSA15.ATSRA19.A2ONL2MX2R2UO3MLM4LRL2ASA15.ATSRA17.2AONOML4ML2R2U2ML7MA.ASA14.AS2RWA14.2A2ONMOL5MLMORSUML5MUM3ASA14.AS2RWA13.A2O2NMOML2MP2MLMOM2RUR5MT3U2ASA13.AS2RWA12.AO2N3MOML4ML2MO3MR5MU4S2US2A13.ASRWA11.AONML2MOML5MLMO4ML5M3R4SUXU2A11.ASRWA10.AONOML2MOML5MLMO4ML2M3LI2K2R3SXS2U3A8.ASRWA10.ANMOL3MPML5MLMO3M4L6I2K3RSX2S2UX3A5.ASRWA9.AOMOML2MOML5ML3M3L12IK2ARXR3SX3U2A3.AS2RWA7.AOLMOML2MOML5ML2ML16IK2AXA2R2SX2SUX4AY2XWA6.AONLOML3MOML8M18IKAS3A2RX3SX5U2XWA5.AONLMOAL2MOML8ML11I3S5I2ASA.3A2R2SXT3S2XWA4.AONMLO2A3MOML8M9I3S3HR4I2ASA4.2A2RXT3S2XWA3.AONMLMOMP2MO2ML7ML10I2H4IR3I2ASA6.3A4R2XWA3.AN2MLO2ML2MOML8M14I3S4IA.ASA8.3AY2XWA2.AO3MLOML5ML7ML11I3S3HR3IA.ASA10.AY2XWA.AON2ML3ML8M2L3M13I2H4IR2IA.ASA10.AY2XW2ALN3M2L5ML5M2WLML14X2I3S3IA2.ASA9.AS2RWA.AL3MLAN4MAN3ML3ILI14W8XA2.ASA9.ASRWA3.ALML2AL3MLAL3MJ19IWT6WA3.ASA8.ASRWA4.ALA2.ANMLA.ANMLIJ19IR6IA3.ASA8.ASRWA5.A3.ANMA2.ALMJ3IJ23IHA3.ASA8.ASRWA9.ANLA3.ALH3IHIJ15IH4IHA5.ASA6.AS2RWA9.ALA5.2AJIH5IJ11IH4IHA6.ASA6.AS2RWA10.A7.AJIH5IH5IH5IH4IA7.ASA6.AS2RWA18.AJIAJ4IH5IH5IH3IHA8.ASA5.ASRWA19.AJHAJ3I2H5IH5IH3IA9.ASA5.ASRWA19.AJ2AJ2IHAH4I2H4I2H3IA10.ASA3.AT2SRA19.AH2AH2I2AH3IHAJ4IAH3IA10.ASA3.ATSRA21.A2.AJHA.AJ2I2AH3IH2AJIHA10.ASA3.ATSRA24.AJA2.AHIHA.AJ2IA.AHIA12.ASA2.ATSRA24.AHA3.AJA2.AHIHA2.AHA12.ASA2.ATRA26.A4.AHA3.AJA4.A13.ASA.ATSRA32.A4.AHA19.AS2ATSRA38.A20.AS2ATRA60..ASTSRA60..ASTSRA60..ASTSRA60..ATSRA60.2.ATSRA60.2.ATSRA60.2.A2TRA60.3.ATRA60.3.ATRSA60.2.ATRSA60.2.ATSRA60.3.3A6."},"idle2":{"w":68,"h":65,"x":-31,"y":-64,"d":"58.ATRSA60.3.ATRA41.A22.ATRA40.AOA20.ATSRA40.ANOA18.ASTSRA24.2A14.ANMO2A15.ASATSRA23.A2X2A11.AO3M2O2A12.ASA.ATRA22.A4XYA10.AN5M2OA10.ASA2.ATSRA21.A2X2AWYA9.AN7MOA8.ASA3.ATSRA21.AV2X3WA9.AN8MOA6.ASA5.ATRA22.AX4WYA7.AO7M2HMOA4.ASA6.ATSRA21.AV2W3YA7.AN5M2HR3HA3.ASA7.ATSRA22.A2Y3WYA6.AN5M2HR3TA2.ASA9.ATRA22.AV5WYA5.AN5M2HRScbA.ASA10.ATSRA22.AV2W3VA.5AN5M2HR3S2ASA11.ATSRA23.A2VWUWYA5OL5MHR4SASA12.ATSRA23.AVWRX18RURSA13.AT2SRA21.2A2O2NXSULMO3M2L4MR2HRSA15.ATSRA20.A2ONL2MX2R2UO3MLM4LRL2ASA15.ATSRA18.2AONOML4ML2R2U2ML7MA.ASA14.AS2RWA15.2A2ONMOL5MLMORSUML5MUM3ASA14.AS2RWA14.A2O2NMOML2MP2MLMOM2RUR5MT3U2ASA13.AS2RWA13.AO2N3MOML4ML2MO3MR5MU4S2US2A13.ASRWA12.AONML2MOML5MLMO4ML5M3R4SUXU2A11.ASRWA11.AONOML2MOML5MLMO4ML2M3LI2K2R3SXS2U3A8.ASRWA11.ANMOL3MPML5MLMO3M4L6I2K3RSX2S2UX3A5.ASRWA10.AOMOML2MOML5ML3M3L12IK2ARXR3SX3U2A3.AS2RWA8.AOLMOML2MOML5ML2ML16IK2AXA2R2SX2SUX4AY2XWA7.AONLOML3MOML8M18IKAS3A2RX3SX5U2XWA6.AONLMOAL2MOML8ML11I3S5I2ASA.3A2R2SXT3S2XWA5.AONMLO2A3MOML8M9I3S3HR4I2ASA4.2A2RXT3S2XWA4.AONMLMOMP2MO2ML7ML10I2H4IR3I2ASA6.3A4R2XWA3.AON2MLO2ML2MOML8M14I3S4IA.ASA8.3AY2XWA2.AON3MLOML5ML7ML11I3S3HR3IA.ASA10.AY2XWA.AON3ML3ML8M2L3M13I2H4IR2IA.ASA10.AY2XW2ALN4M2L5ML5M2WLML14X2I3S3IA2.ASA9.AS2RWA.AL3ML2AN3MLAN3ML3ILI14W8XA2.ASA9.ASRWA3.ALMLA.AN2ML2AL3MJ19IWT6WA3.ASA8.ASRWA4.ALA2.AN2MA2.ANMLIJ19IR6IA3.ASA8.ASRWA5.A3.ANMLA2.ALMJ3IJ23IHA3.ASA8.ASRWA9.ANLA4.ALH3IHIJ15IH4IHA5.ASA6.AS2RWA9.ALA6.2AJIH5IJ11IH4IHA6.ASA6.AS2RWA10.A8.AJIH5IH5IH5IH4IA7.ASA6.AS2RWA19.AJIAJ4IH5IH5IH3IHA8.ASA5.ASRWA20.AJHAJ3I2H5IH5IH3IA9.ASA5.ASRWA20.AJ2AJ2IHAH4I2H4I2H3IA10.ASA3.AT2SRA20.AH2AH2I2AH3IHAJ4IAH3IA10.ASA3.ATSRA22.A2.AJHA.AJ2I2AH3IH2AJIHA10.ASA3.ATSRA25.AJA2.AHIHA.AJ2IA.AHIA12.ASA2.ATSRA25.AHA3.AJA2.AHIHA2.AHA12.ASA2.ATRA27.A4.AHA3.AJA4.A13.ASA.ATSRA33.A4.AHA19.AS2ATSRA39.A20.AS2ATRA60.2.ASTSRA60.2.ASTSRA60.2.ASTSRA60.2.ATSRA60.3.ATSRA60.3.ATSRA60.3.A2TRA60.4.ATRA60.4.ATRSA60.3.ATRSA60.3.ATSRA60.4.3A6."},"idle3":{"w":67,"h":65,"x":-30,"y":-64,"d":"58.ATRA60.2.ATRSA60.2.ATRA40.A22.ATRA39.AOA20.ATSRA39.ANOA18.ASTSRA23.2A14.ANMO2A15.ASATSRA22.A2X2A11.AO3M2O2A12.ASA.ATSRA20.A4XYA10.AN5M2OA10.ASA2.ATSRA20.A2X2AWYA9.AN7MOA8.ASA3.ATSRA20.AV2X3WA9.AN8MOA6.ASA5.ATRA21.AX4WYA7.AO7M2HMOA4.ASA6.ATSRA20.AV2W3YA7.AN5M2HR3HA3.ASA7.ATSRA21.A2Y3WYA6.AN5M2HR3TA2.ASA9.ATRA21.AV5WYA5.AN5M2HRScbA.ASA10.ATSRA21.AV2W3VA.5AN5M2HR3S2ASA11.ATSRA22.A2VWUWYA5OL5MHR4SASA12.ATSRA22.AVWRX18RURSA13.AT2SRA20.2A2O2NXSULMO3M2L4MR2HRSA15.ATSRA19.A2ONL2MX2R2UO3MLM4LRL2ASA15.ATSRA17.2AONOML4ML2R2U2ML7MA.ASA14.AS2RWA14.2A2ONMOL5MLMORSUML5MUM3ASA14.AS2RWA13.A2O2NMOML2MP2MLMOM2RUR5MT3U2ASA13.AS2RWA12.AO2N3MOML4ML2MO3MR5MU4S2US2A13.ASRWA11.AONML2MOML5MLMO4ML5M3R4SUXU2A11.ASRWA10.AONOML2MOML5MLMO4ML2M3LI2K2R3SXS2U3A8.ASRWA10.ANMOL3MPML5MLMO3M4L6I2K3RSX2S2UX3A5.AS2RWA8.AOMOML2MOML5ML3M3L12IK2ARXR3SX3U2A3.AS2RWA7.AOLMOML2MOML5ML2ML16IK2AXA2R2SX2SUX4AY2XWA6.AONLOML3MOML8M18IKAS3A2RX3SX5U2XWA5.AONLMOAL2MOML8ML11I3S5I2ASA.3A2R2SXT3S2XWA4.AONMLO2A3MOML8M9I3S3HR4I2ASA4.2A2RXT3S2XWA3.AONMLMOMP2MO2ML7ML10I2H4IR3I2ASA6.3A4R2XWA3.AN2MLO2ML2MOML8M14I3S4IA.ASA8.3AY2XWA2.AO3MLOML5ML7ML11I3S3HR3IA.ASA10.AY2XWA.AON2ML3ML8M2L3M13I2H4IR2IA2.ASA9.AY2XW2ALN3M2L5ML5M2WLML14X2I3S3IA2.ASA9.AS2RWA.AL3MLAN4MAN3ML3ILI14W8XA2.ASA9.ASRWA3.ALML2AL3MLAL3MJ19IWT6WA3.ASA8.ASRWA4.ALA2.ANMLA.ANMLIJ19IR6IA3.ASA8.ASRWA5.A3.ANMA2.ALMJ3IJ23IHA4.ASA6.AS2RWA9.ANLA3.ALH3IHIJ15IH4IHA5.ASA6.AS2RWA9.ALA5.2AJIH5IJ11IH4IHA6.ASA6.AS2RWA10.A7.AJIH5IH5IH5IH4IA8.ASA5.ASRWA19.AJIAJ4IH5IH5IH3IHA8.ASA5.ASRWA19.AJHAJ3I2H5IH5IH3IA9.ASA4.AT2SRA19.AJ2AJ2IHAH4I2H4I2H3IA10.ASA3.ATSRA20.AH2AH2I2AH3IHAJ4IAH3IA10.ASA3.ATSRA21.A2.AJHA.AJ2I2AH3IH2AJIHA11.ASA2.ATSRA24.AJA2.AHIHA.AJ2IA.AHIA12.ASA2.ATRA25.AHA3.AJA2.AHIHA2.AHA12.ASA.ATSRA26.A4.AHA3.AJA4.A14.AS2ATSRA32.A4.AHA19.AS2ATRA39.A21.ASTSRA60..ASTSRA60..ASTSRA60..ATSRA60.2.ATSRA60.2.ATSRA60.2.A2TRA60.3.ATRA60.3.ATRSA60.2.ATRSA60.2.ATSRA60.3.3A6."},"draw0":{"w":67,"h":65,"x":-30,"y":-64,"d":"58.ATRA60.2.ATRbA60.2.ATRA40.A22.ATRA39.AOA20.ATSRA39.ANOA18.AbTSRA23.2A14.ANMO2A15.AbATSRA22.A2X2A11.AO3M2O2A12.AbA.ATSRA20.A4XYA10.AN5M2OA10.AbA2.ATSRA20.A2X2AWYA9.AN7MOA8.AbA3.ATSRA20.AV2X3WA9.AN8MOA6.AbA5.ATRA21.AX4WYA7.AO7M2HMOA4.AbA6.ATSRA20.AV2W3YA7.AN5M2HR3HA3.AbA7.ATSRA21.A2Y3WYA6.AN5M2HR3TA2.AbA9.ATRA21.AV5WYA5.AN5M2HRScbA.AbA10.ATSRA21.AV2W3VA.5AN5M2HR3S2AbA11.ATSRA22.A2VWUWYA5OL5MHR4SA2GA11.ATSRA22.AVWRX18RURG2EGA10.AT2SRA20.2A2O2NXSULMO3M2L4MR2HRbD2EbA11.ATSRA19.A2ONL2MX2R2UO3MLM4LRL2AbA2DA12.ATSRA17.2AONOML4ML2R2U2ML7MA.Ab2A13.AS2RWA14.2A2ONMOL5MLMORSUML5MUM3AbA14.AS2RWA13.A2O2NMOML2MP2MLMOM2RUR5MT3U2AbA13.AS2RWA12.AO2N3MOML4ML2MO3MR5MU4S2Ub2A13.ASRWA11.AONML2MOML5MLMO4ML5M3R4SUXU2A11.ASRWA10.AONOML2MOML5MLMO4ML2M3LI2K2R3SXS2U3A8.ASRWA10.ANMOL3MPML5MLMO3M4L6I2K3RSX2S2UX3A5.AS2RWA8.AOMOML2MOML5ML3M3L12IK2ARXR3SX3U2A3.AS2RWA7.AOLMOML2MOML5ML2ML16IK2AbA2R2SX2SUX4AY2XWA6.AONLOML3MOML8M18IKAb3A2RX3SX5U2XWA5.AONLMOAL2MOML8ML11I3S5I2AbA.3A2R2SXT3S2XWA4.AONMLO2A3MOML8M9I3S3HR4I2AbA4.2A2RXT3S2XWA3.AONMLMOMP2MO2ML7ML10I2H4IR3I2AbA6.3A4R2XWA3.AN2MLO2ML2MOML8M14I3S4IA.AbA8.3AY2XWA2.AO3MLOML5ML7ML11I3S3HR3IA.AbA10.AY2XWA.AON2ML3ML8M2L3M13I2H4IR2IA2.AbA9.AY2XW2ALN3M2L5ML5M2WLML14X2I3S3IA2.AbA9.AS2RWA.AL3MLAN4MAN3ML3ILI14W8XA2.AbA9.ASRWA3.ALML2AL3MLAL3MJ19IWT6WA3.AbA8.ASRWA4.ALA2.ANMLA.ANMLIJ19IR6IA3.AbA8.ASRWA5.A3.ANMA2.ALMJ3IJ23IHA4.AbA6.AS2RWA9.ANLA3.ALH3IHIJ15IH4IHA5.AbA6.AS2RWA9.ALA5.2AJIH5IJ11IH4IHA6.AbA6.AS2RWA10.A7.AJIH5IH5IH5IH4IA8.AbA5.ASRWA19.AJIAJ4IH5IH5IH3IHA8.AbA5.ASRWA19.AJHAJ3I2H5IH5IH3IA9.AbA4.AT2SRA19.AJ2AJ2IHAH4I2H4I2H3IA10.AbA3.ATSRA20.AH2AH2I2AH3IHAJ4IAH3IA10.AbA3.ATSRA21.A2.AJHA.AJ2I2AH3IH2AJIHA11.AbA2.ATSRA24.AJA2.AHIHA.AJ2IA.AHIA12.AbA2.ATRA25.AHA3.AJA2.AHIHA2.AHA12.AbA.ATSRA26.A4.AHA3.AJA4.A14.Ab2ATSRA32.A4.AHA19.Ab2ATRA39.A21.AbTSRA60..AbTSRA60..AbTSRA60..ATSRA60.2.ATSRA60.2.ATSRA60.2.A2TRA60.3.ATRA60.3.ATRbA60.2.ATRbA60.2.ATSRA60.3.3A6."},"draw1":{"w":67,"h":65,"x":-30,"y":-64,"d":"58.AbRA60.2.ATRcA60.2.ATRA40.A21.2ATRA39.AOA19.AcTSRA39.ANOA17.AcATSRA23.2A14.ANMO2A14.Ac2ATSRA22.A2X2A11.AO3M2O2A11.AcA2.ATSRA20.A4XYA10.AN5M2OA9.AcA3.AbSRA20.A2X2AWYA9.AN7MOA6.2AcA4.ATSRA20.AV2X3WA9.AN8MOA4.A2cA6.ATRA21.AX4WYA7.AO7M2HMOA2.Ac2A7.ATSRA20.AV2W3YA7.AN5M2HR3HA.AcA9.ATSRA21.A2Y3WYA6.AN5M2HR3T2AcA11.ATRA21.AV5WYA5.AN5M2HRScbAcA12.ATSRA21.AV2W3VA.5AN5M2HR2S2cA13.ATSRA22.AUV3WYA5OL5MHR2S2GA14.ATbRA21.ARX18RURG2EGA13.AT2SRA20.2AOXR2U2NLMO3M2L4MRcD2EcA14.ATSRA19.A2ONXM3RULMO3MLM4LRcA2DA15.ATSRA17.2AONOML4M2R2UP2ML7Mc2A16.AS2RWA14.2A2ONMOL5MLM2R2UML5MUMcA17.AS2RWA13.A2O2NMOML2MP2MLMOM2RUR5MT3U2A15.AS2RWA12.AO2N3MOML4ML2MO3MR5MU4S2U3A13.ASRWA11.AONML2MOML5MLMO4ML5M3R4SUXU2A11.AbRWA10.AONOML2MOML5MLMO4ML2M3LI2K2R3SXS2U3A8.ASRWA10.ANMOL3MPML5MLMO3M4L6I2K3RSX2S2UX3A5.AS2RWA8.AOMOML2MOML5ML3M3L12IKcARXR3SX3U2A3.AS2RWA7.AOLMOML2MOML5ML2ML16IKc3A2R2SX2SUX4AY2XWA6.AONLOML3MOML8M18IcA2.2A2RX3SX5U2XWA5.AONLMOAL2MOML8ML11I3S4IcA4.3A2R2SXT3S2XWA4.AONMLO2A3MOML8M9I3S3HR4IcA6.2A2RXT3S2XWA3.AONMLMOMP2MO2ML7ML10I2H4IR3IcA8.3A4RbXWA3.AN2MLO2ML2MOML8M14I3S4IAcA10.3AY2XWA2.AO3MLOML5ML7ML11I3S3HR3IAcA12.AY2XWA.AON2ML3ML8M2L3M13I2H4IR2I2AcA11.AY2XW2ALN3M2L5ML5M2WLML14X2I3S3I2AcA11.AS2RWA.AL3MLAN4MAN3ML3ILI14W8XA.AcA10.ASRWA3.ALML2AL3MLAL3MJ19IWT6WA.AcA10.ASRWA4.ALA2.ANMLA.ANMLIJ19IR6IA2.AcA9.AbRWA5.A3.ANMA2.ALMJ3IJ23IHA2.AcA8.AS2RWA9.ANLA3.ALH3IHIJ15IH4IHA3.AcA8.AS2RWA9.ALA5.2AJIH5IJ11IH4IHA5.AcA7.AS2RWA10.A7.AJIH5IH5IH5IH4IA6.AcA7.ASRWA19.AJIAJ4IH5IH5IH3IHA7.AcA6.ASRWA19.AJHAJ3I2H5IH5IH3IA8.AcA5.AT2SRA19.AJ2AJ2IHAH4I2H4I2H3IA9.AcA4.ATSRA20.AH2AH2I2AH3IHAJ4IAH3IA9.AcA4.ATbRA21.A2.AJHA.AJ2I2AH3IH2AJIHA10.AcA3.ATSRA24.AJA2.AHIHA.AJ2IA.AHIA11.AcA3.ATRA25.AHA3.AJA2.AHIHA2.AHA12.AcA.ATSRA26.A4.AHA3.AJA4.A13.AcA.ATSRA32.A4.AHA18.AcA.ATRA39.A20.AcATSRA60.AcATSRA60..AcbSRA60..ATSRA60.2.ATSRA60.2.ATSRA60.2.A2TRA60.3.ATRA60.3.ATRcA60.2.ATRcA60.2.ATbRA60.3.3A6."},"down0":{"w":73,"h":56,"x":-29,"y":-55,"d":"33.A60.11.AOA60.10.ANOA53.2A14.ANMO2A50.A2X2A11.AO3M2O2A47.A4XYA10.AN5M2OA46.A2X2AWYA9.AN7MOA45.AV2X3WA9.AN8MOA45.AX4WYA7.AO7M2HMOA44.AV2W3YA7.AN5M2HR3HA45.A2Y3WYA6.AN5M2HR3TA45.AV5WYA5.AN5M2HRScbA46.AV2W3VA.5AN5M2HR3SA47.A2VWUWYA5OL5MHR4SA47.AVWRX2UO5NML4MH2R2SA47.2A2ONRX2ULMO3M2L4MR2HSA46.A2ONL2MXR3UO3MLM4LRL2A45.2AONOML4MRS3U2ML7MA44.2A2ONMOL5MLRSUSUML7MA43.A2O2NMOML2MP2MLMRSURUR5MUMOA41.AO2N3MOML4ML2MO2R2U5MRSUNA10.3A27.AONML2MOML5MLMO3MRSU4MLRSUA9.ATSRA25.AONOML2MOML5MLMO4MRSU3LIKRSUA8.ATSRA25.ANMOL3MPML5MLMO3M2LRSU5IRSUA7.AST2RA23.AOMOML2MOML5ML3M3L3I2R2U4IRSUA5.ASATSRA22.AOLMOML2MOML5ML2ML8IRSU4IRSUA3.ASA.A2TRA20.AONLOML3MOML8M10IRSU4IRSX3ASA3.ATSRA18.AONLMOAL2MOML8ML11IRSU4IRSX2SA5.ATSRA16.AONMLO2A3MOML8M9I3SH2R2U3IRXUA7.ATSRA15.ANMLMOMP2MO2ML7ML10I2H3IRSU2ISXSUA6.AT2SRA13.AO2MLO2ML2MOML8M14I3SRSRS2ARSUA6.A2TSRA11.AON2MLOML5ML7ML11I3S3H2RSIA.ARSXA6.AS2RWA10.AN2ML3ML8M2L3M13I2H4IRIS2A.ARSXA6.AS2RWA8.AL3M3L4ML5M2WLML14X2I3S3I2SA.ARXUA6.ASRWA9.AL3M2AN3MAN3ML3ILI14W8X2ASA.AXSUA5.AS2RWA9.ALML2AN2MLAL3MJ19IWT6WA.ASA.ARSUA5.AY2XWA9.ALA.AN2MA.ANMLIJ19IR6IA2.AS3ARSXA5.AYXWA10.A2.ALMLA.ALMJ3IJ23IHA3.A2S2ARSX4A.AY2XWA13.ANA3.ALH3IHIJ15IH4IHA5.2AS2ARX4UA.AYXWA13.ALA4.2AJIH5IJ11IH4IHA8.AS2AXT3SA.AS2RWA13.A6.AJIH5IH5IH5IH4IA10.A2SAT3SA2.ASRWA20.AJIAJ4IH5IH5IH3IHA11.2AS4RA2.AS2RWA19.AJHAJ3I2H5IH5IH3IA14.AS3A3.AS2RWA19.AJ2AJ2IHAH4I2H4I2H3IA15.AS2A4.ASRWA19.AH2AH2I2AH3IHAJ4IAH3IA16.A2SA3.AT2SRA19.A2.AJHA.AJ2I2AH3IH2AJIHA17.2ASA2.AT2SRA22.AJA2.AHIHA.AJ2IA.AHIA20.ASA2.ATSRA22.AHA3.AJA2.AHIHA2.AHA21.AS3ATSRA23.A4.AHA3.AJA4.A23.A2SATSRA29.A4.AHA29.2ASTSRA35.A32.ASTRA60.9.ATSRA60.9.ATRA60.9.ATSRA60.9.ATRA60.10.2A."}},"legs":{"Nb:ok":{"w":28,"h":45,"x":-31,"y":-48,"d":"9.2A24.2A2E2A21.A2E2D2BA20.AB3DCBA20.AB4CBEA19.A2B2C2BDEA17.AE2D2BCB2DEA16.AE3D3CE2DEA15.AE3D4CE2DEA14.AE3D5CE2DE2A12.AE3DC2B3CEDEBEA11.AE3DC2AB3CEB2DEA9.AE3D2CA.ABC2B4DEA8.AE3D2CA2.AB2CE4DEA7.AE3DCBA2.AB3CE4DEA6.AE4BA4.AB3CE4DEA5.A2ED2CA5.AB3CED2BDEA3.AE3D2CA6.AB2C2B2D2BA3.AE3DCBA7.A2CB3DCBA3.AE3BCA8.ABCB4CBA3.AEBDBCA9.A3B2C2BA3.AE3BCA10.ABA2B2A4.AE2DCBA11.A.2A5.AE3DCA21.AE3DCA21.AE3DCA21.AE4BA21.AEDECA21.AE3DCA21.AE3DCA21.AE2DCBA21.AE2DCA22.AE2DCA22.AE2DCA21.AE3DBA21.AE2DCA22.AE2DCA22.AD3EA22.ADCEBA22.ABCEA24.AECA24.AEBA24.AEA25.ABA26.A25."},"Nb:hurt":{"w":28,"h":45,"x":-31,"y":-48,"d":"9.2A24.2A2E2A21.A2E2D2BA20.AB3DCBA20.AB4CBEA19.A2B2C2BDEA17.AEDZabZB2DEA16.AE3D3CE2DEA15.AE3D4CE2DEA14.AE3D5CEbDE2A12.AE3DC2B3CEbEBEA11.AE3DC2AB3CEb2DEA9.AE3D2CA.ABC2BDc2DEA8.AE3D2CA2.AB2CEb3DEA7.AE3DCBA2.AB2CbE4DEA6.AE4BA4.ABCbCE4DEA5.A2ED2CA5.AB3CED2BDEA3.AE3D2CA6.AB2C2B2D2BA3.AE3DCBA7.A2CB3DCBA3.AE3BCA8.ABCB4CBA3.AEBDBCA9.A3B2C2BA3.AE3BCA10.ABA2B2A4.AE2DCBA11.A.2A5.AE3DCA21.AE3DCA21.AE3DCA21.AE4BA21.AEDECA21.AE3DCA21.AE3DCA21.AE2DCBA21.AE2DCA22.AE2DCA22.AE2DCA21.AE3DBA21.AE2DCA22.AE2DCA22.AD3EA22.ADCEBA22.ABCEA24.AECA24.AEBA24.AEA25.ABA26.A25."},"Nb:crit":{"w":28,"h":45,"x":-31,"y":-48,"d":"9.2A24.2A2E2A21.A2E2D2BA20.Ab3DCBA20.ABbdcCBEA19.A2BC2bBDEA17.AEDZabZb2DEA16.AE3D3CE2DEA15.AE3D4CE2DEA14.AE3D5CEbDE2A12.AE3DC2B3CEbEBEA11.AE3DC2AB3CEb2DEA9.AE3D2CA.ABC2BDc2DEA8.AE3D2CA2.AB2CEb3DEA7.AE3DCBA2.AB2CbE4DEA6.AE4BA4.ABCbCE4DEA5.A2ED2CA5.AB3CED2BDEA3.AE3D2CA6.AB2C2B2D2BA3.AEDbDCBA7.A2CB3DCBA3.AE2BbCA8.ABCB4CBA3.AEBDbCA9.A3B2C2BA3.AE3BbA10.ABA2B2A4.AE2DCBA11.A.2A5.AE3DCA21.AE3DCA21.AE3DCA21.AE4BA21.AEDECA21.AE3DCA21.AE3DCA21.AE2DCBA21.AE2DCA22.AE2DCA22.AE2DCA21.AE3DBA21.AE2DCA22.AE2DCA22.AD3EA22.ADCEBA22.ABCEA24.AECA24.AEBA24.AEA25.ABA26.A25."},"Nb:broken":{"w":36,"h":36,"x":-37,"y":-40,"d":"21.A2.A31.Aa2AE2A29.AEaEDCBA28.ADb3DCBA26.AE2DaD2CBA26.AB2Ca3CBA27.AB4CB5A25.A4B2A4E2A24.4A2E4DCBA26.A6DCBA25.AE6D2CBA24.AB2CD5CBA25.A7CBA26.A2B4C2BA27.2A4B2A30.4A60.60.60.60.60.60.60.60.60.7.4A2.A27.2A3EB2AE4A22.AEB2DCBAEDB2EBA21.A6BA6BA22.6A.6A22."},"Nm:ok":{"w":18,"h":42,"x":-14,"y":-47,"d":"7.2A14.2A2E2A11.A2E2DCBA10.AB3DCBA10.AB4CBEA9.A2B2C2BDA9.AED2BCBDEA7.AE3D2C3DA7.AE3D2CE2DEA6.AE3D2CEDEDA6.AE3D3CE2BEA5.AE3DC3B3DA5.AE2D2CB2CE2DEA4.AE2D5CE3DA4.A6B3C2BDEA2.AEDED2CAC2B2D2BA2.AE3DCBA2B3DCBA2.AEDB2CA.AB4CBA2.AEBDBCA.A2B2C2BA2.AEBCBCA2.2A2B2A3.AEDB2CA4.2A5.AE2DCBA10.AE2D2CA11.AE2D2CA11.AE4BA11.AEDE2CA11.AE2DCBA11.AED2CA12.AED2CA12.AED2CA11.AE2D2CA11.AE2DCBA11.AED2CA12.AED2CA12.AD3EA12.ADCEBA12.ABCEA14.AECA14.AEBA14.AEA15.ABA16.A15."},"Nf:ok":{"w":27,"h":46,"x":4,"y":-49,"d":"18.2A23.2A2E2A20.AEB2DCBA19.AB3DCBA18.AEB4CBA17.AED2B2C2BA16.AE2DBC2B2DA15.AE4D2CE2DA14.AE4D4CEDEA11.2AE4D5CE2DA10.AEBDE2D2CB3CE2DA9.AE2DB2D2CBA3CE2DA8.AE4DB2CB2AB2CE2DA7.AE6DBCA2.A2CE2DA6.AE6D2CBA2.A2CE2DA5.AE6D2CBA3.A3CEBA4.AE6D2CBA4.AC3B2EA2.AED2B3D2CBA5.A3CE2DA2.AEB2D2B2CBA6.AB2CE2DA2.A4DCB2CA8.A2CB2DA2.A5CBCBA8.ACBDBDA2.A2B2C3BA9.ACBCBDA3.2A2BABA10.A2C2BDA5.2A.A11.AB2CEDA21.A2CEDA21.A2CEDEA20.A2CE2BA20.AC2B2DA20.A3CEDA20.AB2CEDA21.A2CEDA21.A2CEDA21.A2CEDA21.A2CEDEA20.A2CE2DA20.AB2CEDA21.A2CEDA21.A2C2EA21.AB2ECA22.ADECA22.ABECA23.ADEA23.ABEA24.AEA24.ABA25.A."},"Nf:hurt":{"w":27,"h":46,"x":4,"y":-49,"d":"18.2A23.2A2E2A20.AEB2DCBA19.AB3DCBA18.AEB4CBA17.AED2B2C2BA16.AE2DBZabZDA15.AE4D2CE2DA14.AE4D4CEDEA11.2AE4D5CE2DA10.AEbDE2D2CB3CE2DA9.AE2Db2D2CBA3CE2DA8.AE4Db2CB2AB2CE2DA7.AE6DcCA2.A2CE2DA6.AE6DCbBA2.A2CE2DA5.AE6DCbBA3.A3CEBA4.AE6D2CbA4.AC3B2EA2.AED2B3D2CBA5.A3CE2DA2.AEB2D2B2CBA6.AB2CE2DA2.A4DCB2CA8.A2CB2DA2.A5CBCBA8.ACBDBDA2.A2B2C3BA9.ACBCBDA3.2A2BABA10.A2C2BDA5.2A.A11.AB2CEDA21.A2CEDA21.A2CEDEA20.A2CE2BA20.AC2B2DA20.A3CEDA20.AB2CEDA21.A2CEDA21.A2CEDA21.A2CEDA21.A2CEDEA20.A2CE2DA20.AB2CEDA21.A2CEDA21.A2C2EA21.AB2ECA22.ADECA22.ABECA23.ADEA23.ABEA24.AEA24.ABA25.A."},"Nf:crit":{"w":27,"h":46,"x":4,"y":-49,"d":"18.2A23.2A2E2A20.AEB2DCBA19.Ab3DCBA18.AEBbdcCBA17.AED2BC2bBA16.AE2DBZabZbA15.AE4D2CE2DA14.AE4D4CEDEA11.2AE4D5CE2DA10.AEbDE2D2CB3CE2DA9.AE2Db2D2CBA3CE2DA8.AE4Db2CB2AB2CE2DA7.AE6DcCA2.A2CE2DA6.AE6DCbBA2.A2CE2DA5.AE6DCbBA3.A3CEBA4.AE6D2CbA4.AC3B2EA2.AED2B3D2CBA5.A3CE2DA2.AEB2D2B2CBA6.ABCbE2DA2.A4DCB2CA8.A2Cb2DA2.A5CBCBA8.ACBbBDA2.A2B2C3BA9.ACBCbDA3.2A2BABA10.A2C2BDA5.2A.A11.AB2CEDA21.A2CEDA21.A2CEDEA20.A2CE2BA20.AC2B2DA20.A3CEDA20.AB2CEDA21.A2CEDA21.A2CEDA21.A2CEDA21.A2CEDEA20.A2CE2DA20.AB2CEDA21.A2CEDA21.A2C2EA21.AB2ECA22.ADECA22.ABECA23.ADEA23.ABEA24.AEA24.ABA25.A."},"Nf:broken":{"w":34,"h":37,"x":2,"y":-41,"d":"13.A30.3AaA28.A4EaA26.AE4DbA26.A5DCaA25.AC2D3CaA25.AB5CBA21.4A.A2BC2BA20.2A4E4AB2A20.A2E4DCBA.A22.A6DCBA23.AE6D2CBA22.AB2CD5CBA23.A7CBA24.A2B4C2BA25.2A4B2A28.4A60.60.60.60.60.60.60.60.60.18.4A2.A25.2A3EB2AE4A20.AEB2DCBAEDB2EBA19.A6BA6BA20.6A.6A."},"Sb:ok":{"w":33,"h":41,"x":-38,"y":-39,"d":"8.4A28.A3FBA26.AF4EB2A23.AF4E2DBGA22.AC6DBEG2A21.AB4DB3E2GA19.AGEZa2ZDF4EG2A17.AF3E4DF4E2GA16.AF3E6DF3EFB2A14.AF3ED2C4DF2EBE2GA13.AF3ED2A2C3DFB4EG2A10.AG3E2DA.2AC3DBF4E2GA9.AF3E2DA3.ACDB2DF5EG2A7.A3BEDCA4.AB4DF5E2GA6.A2FE2BA6.A2C4DFE4BGA5.AF2E2DA7.2AC4DB4ECA4.AG3EDCA9.AC2DB4E2DCA3.AF4BA11.A2CB6DCA3.AB2EDBA12.2ACB4DCA4.AFBD2BA14.A5CA4.AG2EBDCA15.5A5.AF3EDA26.AF3EDA26.AF2BDCA26.A2FEBA26.AG3EDA26.AF3EDA26.AF2EDCA26.AF2EDA27.AF2EDA26.AG3EDA26.AF2EDCA26.AF2EDA27.AE3FCA26.AEDFDA27.ACDFCA28.AFDA29.AFCA29.AFA30.ACA31.A30."},"Sb:hurt":{"w":33,"h":41,"x":-38,"y":-39,"d":"8.4A28.A3FBA26.AF4EB2A23.AF4E2DBGA22.AC6DBEG2A21.AB4DB3E2GA19.AGEZabZDF4EG2A17.AF3E4DF4E2GA16.AF3E6DFEbEFB2A14.AF3ED2C4DFEbBE2GA13.AF3ED2A2C3DFBb3EG2A10.AG3E2DA.2AC3DBFc3E2GA9.AF3E2DA3.ACDB2Db5EG2A7.A3BEDCA4.AB2DbDF5E2GA6.A2FE2BA6.A2Cb3DFE4BGA5.AF2E2DA7.2AC4DB4ECA4.AG3EDCA9.AC2DB4E2DCA3.AF4BA11.A2CB6DCA3.AB2EDBA12.2ACB4DCA4.AFBD2BA14.A5CA4.AG2EBDCA15.5A5.AF3EDA26.AF3EDA26.AF2BDCA26.A2FEBA26.AG3EDA26.AF3EDA26.AF2EDCA26.AF2EDA27.AF2EDA26.AG3EDA26.AF2EDCA26.AF2EDA27.AE3FCA26.AEDFDA27.ACDFCA28.AFDA29.AFCA29.AFA30.ACA31.A30."},"Sb:crit":{"w":33,"h":41,"x":-38,"y":-39,"d":"8.4A28.A3FBA26.AF4EB2A23.AFb3E2DBGA22.ACDbdc2DBEG2A21.AB2D2bB3E2GA19.AGEZabZbF4EG2A17.AF3E4DF4E2GA16.AF3E6DFEbEFB2A14.AF3ED2C4DFEbBE2GA13.AF3ED2A2C3DFBb3EG2A10.AG3E2DA.2AC3DBFc3E2GA9.AF3E2DA3.ACDB2Db5EG2A7.A3BEDCA4.AB2DbDF5E2GA6.A2FE2BA6.A2Cb3DFE4BGA5.AF2E2DA7.2AC4DB4ECA4.AGEbEDCA9.AC2DB4E2DCA3.AF2BbBA11.A2CB6DCA3.AB2EbBA12.2ACB4DCA4.AFBDBbA14.A5CA4.AG2EBDCA15.5A5.AF3EDA26.AF3EDA26.AF2BDCA26.A2FEBA26.AG3EDA26.AF3EDA26.AF2EDCA26.AF2EDA27.AF2EDA26.AG3EDA26.AF2EDCA26.AF2EDA27.AE3FCA26.AEDFDA27.ACDFCA28.AFDA29.AFCA29.AFA30.ACA31.A30."},"Sb:broken":{"w":36,"h":33,"x":-40,"y":-32,"d":"19.A.3A30.AaA3FA29.AFa3ECA28.AEb3EDCA27.ADEaE2DCA27.A2Da3DCA.4A22.A2C3DC3A4F2A21.2A3C2A2F4EDCA22.3A.A6EDCA25.AF6E2DCA24.AC2DE5DCA25.A7DCA26.A2C4D2CA27.2A4C2A30.4A60.60.60.60.60.60.60.52.3A2.A30.2FC2AF4A26.EDCAFEC2FCA25.3CA6CA25.3A.6A26."},"Sm:ok":{"w":21,"h":36,"x":-3,"y":-33,"d":"11.5A15.AG3FCA13.AGB4ECA11.AGB4E2DCA9.AGEB6DCA8.AG3EB4DBA8.AGBEFECZa2ZEA7.AG2EB3E2DF2EA6.AG4EBE4DFEA5.AG6EB4DFEA4.AG4B2E2DB3DFEGA3.AF4EB3DC3DF2EA2.AF4E2DBDCAC5BA2.AC6DBCA.A2DFEFA3.AC4DBCA2.AD3BEA4.A5CA3.AB3EBA5.5A4.AB3DBA14.AD3BEA14.AC2DFEA15.A2DFEA15.A4BA15.A2D2FA15.A2DFEGA14.A2DF2EA14.AC2DFEA15.A2DFEA15.A2DFEA15.A2DFEFA14.AC3FDA15.AEF2DA15.ACFDCA16.AEFA17.ACFA18.AFA18.ACA19.A2."},"Sf:ok":{"w":32,"h":43,"x":7,"y":-41,"d":"21.4A27.AB2FCA24.2AB4ECA22.AGB4E2DCA20.AGEB6DCA19.AG3EB4DBA18.2AG4ECZa2ZEA17.A2G5E3DF2EGA15.AG6E5DF2EA14.AGBF4E2DC3DF2EA12.2AG2EB3E2DCAC2DF2EA11.A2G4EBE2DCA.A2DF2EA10.AG6EB2DCA2.A2DF2EA9.AG6E2DBCA3.A2DF2EGA6.2AG6E3DCA4.A3DF2BA5.A2G6E3DCA5.AC3BEFA4.AG4B3E3DCA7.A2DF2EA4.AF4EB3D2CA8.A2DF2EA3.AF4E2DBDC2A9.AD4BA3.AC6DBCA11.ACBEDBGA3.AC4DBCA13.ABD2BEA4.A5CA14.ADBF2EA5.5A15.A2DF2EA25.ACDF2EA26.ADFEBA26.A3BEGA25.A2D2FEA25.A2DF2EA25.ACDF2EA26.ADF2EA26.ADF2EA26.ADF2EGA25.ACDF2EA26.ADF2EA26.ADFEFA26.AC2FDA27.AEFDA27.ACFDA28.AEFA28.ACFA29.AFA29.ACA30.A."},"Sf:hurt":{"w":32,"h":43,"x":7,"y":-41,"d":"21.4A27.AB2FCA24.2AB4ECA22.AGB4E2DCA20.AGEB6DCA19.AG3EB4DBA18.2AG4ECZabZEA17.A2G5E3DF2EGA15.AG6E5DF2EA14.AbBF4E2DC3DF2EA12.2AGEbB3E2DCAC2DF2EA11.A2G3EbBE2DCA.A2DF2EA10.AG6Ec2DCA2.A2DF2EA9.AG6EDbBCA3.A2DF2EGA6.2AG6EDbDCA4.A3DF2BA5.A2G6E2DbCA5.AC3BEFA4.AG4B3E3DCA7.A2DF2EA4.AF4EB3D2CA8.A2DF2EA3.AF4E2DBDC2A9.AD4BA3.AC6DBCA11.ACBEDBGA3.AC4DBCA13.ABD2BEA4.A5CA14.ADBF2EA5.5A15.A2DF2EA25.ACDF2EA26.ADFEBA26.A3BEGA25.A2D2FEA25.A2DF2EA25.ACDF2EA26.ADF2EA26.ADF2EA26.ADF2EGA25.ACDF2EA26.ADF2EA26.ADFEFA26.AC2FDA27.AEFDA27.ACFDA28.AEFA28.ACFA29.AFA29.ACA30.A."},"Sf:crit":{"w":32,"h":43,"x":7,"y":-41,"d":"21.4A27.AB2FCA24.2AB4ECA22.AGBb3E2DCA20.AGEBDbdc2DCA19.AG3EB2D2bBA18.2AG4ECZabZbA17.A2G5E3DF2EGA15.AG6E5DF2EA14.AbBF4E2DC3DF2EA12.2AGEbB3E2DCAC2DF2EA11.A2G3EbBE2DCA.A2DF2EA10.AG6Ec2DCA2.A2DF2EA9.AG6EDbBCA3.A2DF2EGA6.2AG6EDbDCA4.A3DF2BA5.A2G6E2DbCA5.AC3BEFA4.AG4B3E3DCA7.A2DF2EA4.AF4EB3D2CA8.A2Db2EA3.AF4E2DBDC2A9.AD2BbBA3.AC6DBCA11.ACBEbBGA3.AC4DBCA13.ABDBbEA4.A5CA14.ADBF2EA5.5A15.A2DF2EA25.ACDF2EA26.ADFEBA26.A3BEGA25.A2D2FEA25.A2DF2EA25.ACDF2EA26.ADF2EA26.ADF2EA26.ADF2EGA25.ACDF2EA26.ADF2EA26.ADFEFA26.AC2FDA27.AEFDA27.ACFDA28.AEFA28.ACFA29.AFA29.ACA30.A."},"Sf:broken":{"w":38,"h":34,"x":6,"y":-33,"d":"13.A.A33.2AFAaA31.A2FEFCaA29.AF4EDbA29.A5EDCaA28.A6DCaA23.4A.A2C3D2CA22.2A4F4A3C2A22.A2F4EDCA.3A24.A6EDCA27.AF6E2DCA26.AC2DE5DCA27.A7DCA28.A2C4D2CA29.2A4C2A32.4A60.60.60.60.60.60.60.60.60.10.4A2.A29.2A3FC2AF4A24.AFC2EDCAFEC2FCA23.A6CA6CA24.6A.6A."}},"anchor":[0.5,-30.5]},"ch":".ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"};/*VERA_SPR_END*/
const VERA={dec:new Map(), pal:new Map(), ambPos:null};
function veraPiece(pc){
  let d=VERA.dec.get(pc); if(d) return d;
  const ch=VERA_SPR.ch, a=new Uint8Array(pc.w*pc.h); let i=0, n='';
  for(const c of pc.d){ if(c>='0'&&c<='9'){ n+=c; continue; } const k=n?+n:1, v=ch.indexOf(c); a.fill(v,i,i+k); i+=k; n=''; }
  d={w:pc.w,h:pc.h,x:pc.x,y:pc.y,a}; VERA.dec.set(pc,d); return d;
}
/* ランタンの明るさ b（0〜1、12段に丸める）での色。琥珀はそのまま */
function veraPal(b){
  const q=Math.round(Math.max(0,Math.min(1,b))*12); let pal=VERA.pal.get(q); if(pal) return pal;
  const m=.30+.70*q/12, em=new Set(VERA_SPR.emis); pal=[0];
  VERA_SPR.pal.forEach((h,i)=>{ const n=parseInt(h.slice(1),16); let r=n>>16, g=(n>>8)&255, bl=n&255;
    if(!em.has(i+1)){ r=Math.round(r*m); g=Math.round(g*m); bl=Math.round(bl*m); }
    pal.push((0xff000000|(bl<<16)|(g<<8)|r)>>>0); });
  VERA.pal.set(q,pal); return pal;
}
function veraDraw(e,t){
  if(!VERA.ambPos){ VERA.ambPos=[]; VERA_SPR.amb.forEach((v,i)=>VERA.ambPos[v]=i); }
  const pal=veraPal(PT.lit), u=SPR.u32, N=PT.N, white=0xffffffff;
  const form2=!e.form2, down=form2&&e.down>0;
  const charge=e.cast&&e.cast.max ? 1-e.cast.t/e.cast.max : (e.tele>0?.5:0), casting=!down&&(!!e.cast||e.tele>0);
  const moving=Math.hypot(e.vx||0,e.vy||0)>.05, fr=Math.floor(t*(moving?8:4))%4;
  const glow=casting?(charge>.55?2:1):(Math.sin(t*2.4)>.7?1:0);
  const blit=(pc,dx,dy,flash)=>{ const d=veraPiece(pc), X0=Math.round(PT.ox+d.x+dx), Y0=Math.round(PT.oy+d.y+dy);
    for(let y=0;y<d.h;y++){ const Y=Y0+y; if(Y<0||Y>=N) continue; const row=y*d.w, base=Y*N;
      for(let x=0;x<d.w;x++){ const v=d.a[row+x]; if(!v) continue; const X=X0+x; if(X<0||X>=N) continue;
        const ap=VERA.ambPos[v];
        u[base+X]= flash&&v!==1 ? white : (ap!=null&&glow ? pal[VERA_SPR.amb[Math.min(4,ap+glow)]] : pal[v]); } } };
  const ember=(x,y,c)=>{ const X=Math.round(PT.ox+x), Y=Math.round(PT.oy+y); if(X>=0&&Y>=0&&X<N&&Y<N) u[Y*N+X]=pal[VERA_SPR.amb[c]]; };
  if(!form2){
    const P1=VERA_SPR.f1.parts;
    blit(casting?P1[charge>.55?'draw1':'draw0']:P1['idle'+fr],0,0,false);
    if(casting) for(let i=0;i<3;i++){ const ph=(t*1.6+i*.33)%1; ember(9+Math.cos(i*2.1+t*3)*3*(1-ph), -29-ph*5, ph<.5?3:2); }
    return VERA_SPR.f1.anchor;
  }
  const F=VERA_SPR.f2, face=e._cf||1, parts=e.parts||[];
  // 絵の脚 → 盤面の部位（前＝+x は、右向きなら東）
  const partOf=id=>{ if(id[1]==='m') return null; const near=id[0]==='S', front=id[1]==='f';
    return parts.find(q=>q.id===(near?'S':'N')+((front===(face>0))?'E':'W'))||null; };
  const legKey=id=>{ const q=partOf(id); if(!q) return id+':ok'; if(q.broken) return id+':broken';
    const r=q.hp/q.max; return id+(r<.34?':crit':r<.67?':hurt':':ok'); };
  const lift=id=>{ if(!moving||down) return 0; const A=(id==='Nb'||id==='Sm'||id==='Nf'); return ((fr>>1)&1)===(A?0:1)?-2:0; };
  const leg=id=>{ const q=partOf(id); blit(F.legs[legKey(id)],0,lift(id), !!(q&&!q.broken&&q.hit>0&&((t*30)|0)%2===0)); };
  ['Nb','Nm','Nf'].forEach(leg);
  blit(F.body[down?'down0':casting?(charge>.55?'draw1':'draw0'):'idle'+fr],0,0,false);
  ['Sb','Sm','Sf'].forEach(leg);
  // 燻る火の粉：膝の継ぎ目から立ちのぼる。溜め中は番えた礫のまわりにも
  for(let i=0;i<4;i++){ const ph=(t*.45+i*.25)%1, x=[-26,-18,22,29][i]+Math.sin(t*2+i)*1.5, y=-34-ph*16;
    if(ph<.75) ember(x,y,ph<.3?2:1); }
  if(casting) for(let i=0;i<4;i++){ const ph=(t*1.4+i*.25)%1; ember(15+Math.cos(i*1.7+t*2.5)*4*(1-ph), -46-ph*6+Math.sin(i*2.3)*2, ph<.5?3:2); }
  return F.anchor;
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
const MID={5:'toad',10:'vera',15:'leech',25:'spider',35:'serpent',45:'eye'};
const BODY_SIZE={ beast:{range:.70}, slater:{swarm:.40} };   // 磯虫は半分くらいに（ユーザー要望）   // 系統×形式 → 絵の倍率（当たり判定は変えない）

CAVE.enemy=function(e,sx,sy,R){
  try{ return enemy(e,sx,sy,R); }catch(err){ console.error(err); return false; }
};
function enemy(e,sx,sy,R){
  const r=renderFoe(e); if(!r) return false;
  const {N,face,mid,k,fam,arch}=r, ps=TS/Q*(r.px||1);   // r.px：ヴェラは主人公と同じ細かさ（半分のドット）
  // 見えている形の中心を (sx,sy) に合わせる。本編の絵は中心で置くので、当たりの絵もそこに出る
  const u=SPR.u32; let x0=N,x1=-1,y0=N,y1=-1;
  for(let Y=0;Y<N;Y++){ const row=Y*N; for(let X=0;X<N;X++) if(u[row+X]){ if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y; } }
  const cxA = r.anchor ? r.anchor[0] : x1>=0 ? (x0+x1+1)/2 : N/2, cyA = r.anchor ? r.anchor[1] : y1>=0 ? (y0+y1+1)/2 : PT.oy;   // ヴェラは固定の錨点（脚が壊れても体が跳ねない）
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
  if(mid==='vera') k = 1;                            // ヴェラは手打ちのドット絵（倍率なし）
  const N = mid==='vera' ? (e.form2?60:96) : Math.ceil((mid==='eye'||mid==='spider'?44:38)*k/2)*2;
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
  else if(mid==='vera'){
    PT.ox=N/2; PT.oy=N-8; const an=veraDraw(e,t);
    if(!noFlash && e.hit>0 && ((t*20)|0)%2===0){ const u=SPR.u32; for(let i=0;i<u.length;i++) if(u[i]) u[i]=0xffffffff; }
    SPR.cx.putImageData(SPR.id,0,0);
    return {N,face,mid,k,fam,arch,anchor:[PT.ox+an[0],PT.oy+an[1]],px:.5};
  }
  else BODY[fam][arch](p,e,g,t);
  sEnd(p, !noFlash && e.hit>0 && ((t*20)|0)%2===0);
  return {N,face,mid,k,fam,arch};
}
/* 倒したときの崩れる粒も、いま描いている絵から出す（元の絵の粒が混ざらないように） */
function caveBurst(e){
  const r=renderFoe(e,true); if(!r) return false;
  const {N,face,mid}=r, u=SPR.u32, sc=r.px||1, ax=r.anchor?r.anchor[0]:N/2, oy=r.anchor?r.anchor[1]:PT.oy, feet=r.anchor?0:(mid||e.boss)?e.r*.8:.42, step=N>60?2:1;
  for(let Y=0;Y<N;Y+=step)for(let X=0;X<N;X+=step){ const c=u[Y*N+X]; if(!c) continue;
    const dx=(X-ax)/Q*sc*face, dy=(Y-oy)/Q*sc, noise=((X*73+Y*151)%97)/97;
    FEEL.particles.push({x:e.x+dx, y:e.y+feet+dy, vx:dx*(2+noise*3)*1.6, vy:dy*2-1, life:.5+noise*.35, max:.5+noise*.35, size:step/Q*sc,
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
    if(typeof floatsOverWater==='function'&&floatsOverWater(ent)) return 0;   // 浮いている敵（クラゲ・コウモリ・亡霊など）は浸からない
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
  const oldPL=window.drawPlayerLight;                   // キャラを全員描き終えた所＝立ち物の手前側を描き戻す所
  if(typeof oldPL==='function') window.drawPlayerLight=function(camX,camY){ try{ drawOccluders(camX,camY); }catch(err){ console.error(err); } return oldPL(camX,camY); };
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
