/* ヴェラ（10階の大ボス）：広間の柱と、第二形態の脚の部位破壊（2026-10-03 ユーザー要望）。
   ・柱は広間の中心から見て1・3・5・7・9・11時に1本ずつ。歩けない・矢は当たって消える・貫きと波動は柱の陰に届かない
   ・第二形態には脚が4本（手前左右・奥左右）。殴った側の脚に入り、壊すたびに数秒ダウン、4本とも壊すと防御が大きく落ちる */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.pillars = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); const f=W.fl, c=f.cover||[];
  const cx=(f.W-1)/2+.5, cy=(f.H-1)/2+.5;
  const hours=c.map(p=>{ let a=Math.atan2(p.x-cx, -(p.y-cy)); if(a<0) a+=Math.PI*2; return Math.round(a/(Math.PI/6)*2)/2; }).sort((a,b)=>a-b);
  const walls=c.every(p=>solid(p.x,p.y));
  // 入口から穴まで歩ける
  const H=f.H, Wd=f.W, seen=new Uint8Array(H*Wd), q=[[f.start.cx,f.start.cy]]; seen[f.start.cy*Wd+f.start.cx]=1;
  while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=Wd||ny>=H||seen[ny*Wd+nx]||!tileWalk(f,nx,ny)) continue; seen[ny*Wd+nx]=1; q.push([nx,ny]); } }
  const reach=!!seen[Math.floor(f.stair.y)*Wd+Math.floor(f.stair.x)];
  // 5階（中ボス）・11階には柱が無い
  TH.run(5,{seed:44}); const n5=(W.fl.cover||[]).length; TH.run(20,{seed:44}); const n20=(W.fl.cover||[]).length;
  return {n:c.length, hours, walls, reach, n5, n20, ok: c.length===4 && hours.join()==='1.5,4.5,7.5,10.5' && walls && reach && n5===0 && n20===0};   // 2026-10-20 斜め4本に（第二形態の体が掛からないように）
});
R.coverBlocksAttacks = await pg.evaluate(()=>{
  /* 毎回まっさらな広間で：ボス—（柱）—主人公 を一直線に置き、柱の陰と陰でない所で比べる */
  const fresh=(behind)=>{ TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); S.hero.party=[];
    const e=W.enemies.find(x=>x.uniqueBoss===10), p=W.fl.cover.find(c=>c.h===10.5), oy=behind?0:2.5;
    e.x=p.x+3; e.y=p.y+oy; e.moveCd=99; e.cd=99; P.x=p.x-2; P.y=p.y+oy; W.fx.length=0; S.hero.hpNow=99999; P.invuln=0; return e; };
  const beam=(behind)=>{ const e=fresh(behind), h=S.hero.hpNow; e.cast={id:'beam', dir:Math.PI, t:0}; resolveBossMove(e); e.cast=null; return S.hero.hpNow<h; };
  const bolt=(behind)=>{ fresh(behind); const h=S.hero.hpNow; W.fx.push({t:'bolt',x:P.x+3.2,y:P.y,vx:-5.6,vy:0,life:2,dmg:50,lv:10,dt:'pierce'}); for(let i=0;i<40;i++) stepSim(1/30); return S.hero.hpNow<h; };
  const wave=(behind)=>{ const e=fresh(behind), h=S.hero.hpNow; W.fx.push({t:'wave',x:e.x,y:e.y,r:0.5,max:9,speed:5.2,dmg:80,src:e,hit:[],col:'#fff',life:99}); for(let i=0;i<60;i++) stepSim(1/30); return S.hero.hpNow<h; };
  const r={beamBehind:beam(true), beamOpen:beam(false), boltBehind:bolt(true), boltOpen:bolt(false), waveBehind:wave(true), waveOpen:wave(false)};
  r.ok = !r.beamBehind && r.beamOpen && !r.boltBehind && r.boltOpen && !r.waveBehind && r.waveOpen;
  return r;
});
/* 第二形態の体（絵の四角）は、柱にも壁にも掛からない（2026-10-20 ユーザー指定）。
   主人公を4本の柱の陰へ順に歩かせ、そのあいだずっと見る。動ける広さも見る（柱の位置の見直しで、狭い所に閉じ込めない） */
R.form2BodyClear = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); W.enemies.filter(e=>!e.boss).forEach(e=>e.dead=true); S.hero.party=[]; TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); P.x=e.x-4; P.y=e.y;
  bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  const startClear=veraBodyFree(e.x,e.y);
  let bad=0, n=0, x0=1e9, x1=-1e9, y0=1e9, y1=-1e9;
  const goals=W.fl.cover.map(c=>({x:c.x+(c.x<W.fl.W/2?-1.2:1.2), y:c.y+(c.y<W.fl.H/2?-1.2:1.2)}));
  for(const g of goals) for(let i=0;i<240;i++){
    const dx=g.x-P.x, dy=g.y-P.y, d=Math.hypot(dx,dy);
    if(d>0.3){ P.x+=dx/d*0.08; P.y+=dy/d*0.08; if(solid(P.x,P.y)){ P.x-=dx/d*0.08; P.y-=dy/d*0.08; } }
    stepSim(1/30); n++;
    if(!veraBodyFree(e.x,e.y)) bad++;
    x0=Math.min(x0,e.x); x1=Math.max(x1,e.x); y0=Math.min(y0,e.y); y1=Math.max(y1,e.y);
  }
  // 柱を外しても、体の中心が動ける広さの何割が残っているか（0.5マス刻みで数える）
  const cnt=(cov)=>{ const keep=W.fl.cover; W.fl.cover=cov; let k=0; for(let y=0;y<W.fl.H;y+=.5) for(let x=0;x<W.fl.W;x+=.5) if(veraBodyFree(x,y)) k++; W.fl.cover=keep; return k; };
  const room=cnt(W.fl.cover)/cnt([]);
  return {startClear, bad, n, spanX:+(x1-x0).toFixed(1), spanY:+(y1-y0).toFixed(1), room:+room.toFixed(2),
    ok: startClear && bad===0 && room>0.6 && (x1-x0)>8};
});
/* ヴェラの広間の床：毒の溜りは「鉱毒の溜り」（ore）、水溜りは2つまで（2026-10-21 ユーザー指定）。他の10階台の層は今までどおり石の棘 */
R.floorOre = await pg.evaluate(async ()=>{
  TH.run(10,{seed:44}); await new Promise(r=>setTimeout(r,300));
  const kind=W.haz&&W.haz.kind, def=hazardDef(kind), pools=CAVE.poolCount;
  TH.run(12,{seed:44}); const k12=W.haz&&W.haz.kind;
  return {kind, nm:def.nm, pools, k12, ok: kind==='ore' && def.nm==='鉱毒の溜り' && pools<=2 && k12!=='ore'};
});
/* 2026-10-22 鉱毒の溜りは大きな池が数ヶ所（水の層と同じ作り）。形はなめらかな場で、削れる判定も同じ場。
   菱形の小池（半径1〜2の円をマスで拾った物）にしない。湯気の口があり、池の中でだけ削れる。 */
R.orePools = await pg.evaluate(()=>{
  const res=[];
  for(const seed of [44,7,123,9]){
    TH.run(10,{seed}); const h=W.haz;
    const n=(h.pools||[]).length, big=(h.pools||[]).every(c=>c.r>=2.0), tiles=h.n;
    const c=h.pools[0], inside=!!hazardAt(c.x,c.y), outside=!hazardAt(c.x+c.r+2.2,c.y) || oreSd(c.x+c.r+2.2,c.y)<0;
    // 縁の内と外で判定が分かれる（マス単位ではない）：縁の 0.1 マス内側は削れ、0.1 マス外側は削れない
    let edgeOk=true; for(let a=0;a<6.28;a+=.7){ let r=0; while(oreSd(c.x+Math.cos(a)*r,c.y+Math.sin(a)*r)<0&&r<8) r+=.02;
      const ix=c.x+Math.cos(a)*(r-.1), iy=c.y+Math.sin(a)*(r-.1), ex=c.x+Math.cos(a)*(r+.1), ey=c.y+Math.sin(a)*(r+.1);
      if(tileWalk(W.fl,Math.floor(ix),Math.floor(iy)) && (!hazardAt(ix,iy)||hazardAt(ex,ey))) edgeOk=false; }
    const stairDry=!hazardAt(W.fl.stair.x,W.fl.stair.y);
    res.push({seed,n,big,tiles,inside,outside,edgeOk,stairDry,vents:oreVents(h).length});
  }
  return {res, ok: res.every(r=>r.n>=2&&r.big&&r.inside&&r.outside&&r.edgeOk&&r.stairDry&&r.vents>5&&r.tiles>=30)};
});
R.legParts = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); W.enemies.filter(e=>!e.boss).forEach(e=>e.dead=true); S.hero.party=[];
  const e=W.enemies.find(x=>x.uniqueBoss===10);
  const none1=!e.parts;                               // 第一形態には無い
  bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  const n=e.parts?e.parts.length:0, def0=e.def;
  // 手前右の脚の所から殴ると、手前右の脚にだけ入る（体のHPは減らない。2026-10-20 部位ごとの当たり判定）
  const st=stats(S.hero);
  const sePart=e.parts.find(p=>p.id==='SE'), hp0=sePart.hp;
  P.x=e.x+sePart.ox+0.6; P.y=e.y+sePart.oy+0.5;
  const bodyHp0=e.hp;
  hitEnemy(e, st, 1);
  const routed = sePart.hp<hp0 && e.parts.filter(p=>p!==sePart).every(p=>p.hp===p.max);
  const bodyUntouched = e.hp===bodyHp0;
  // 真ん中（体）を殴れば体に入り、脚は減らない
  P.x=e.x; P.y=e.y-1.6; const bh=e.hp, seHp=sePart.hp; hitEnemy(e, st, 1);
  const bodyHit = e.hp<bh && sePart.hp===seHp;
  // 壊すとダウン（技も移動も止まる）。本体に最大HPの2割
  P.x=e.x+sePart.ox+0.6; P.y=e.y+sePart.oy+0.5;
  e.hp=e.maxHp*10; const hpB=e.hp; sePart.hp=1; hitEnemy(e, st, 1);
  const broke=sePart.broken, down0=e.down, breakDmg=+((hpB-e.hp)/e.maxHp).toFixed(2);
  const x0=e.x, y0=e.y; e.cast={id:'slam',t:0,dir:0}; for(let i=0;i<20;i++) enemyUpdate(e, 0.05);
  const still = Math.hypot(e.x-x0,e.y-y0)<1e-6 && !e.cast;
  for(let i=0;i<60;i++) enemyUpdate(e, 0.05);
  const recovered = !(e.down>0);
  // 残り3本を、それぞれの側から殴って壊す
  for(const id of ['SW','NE','NW']){ const p=e.parts.find(q=>q.id===id); p.hp=1; P.x=e.x+p.ox+Math.sign(p.ox)*0.6; P.y=e.y+p.oy+0.5; hitEnemy(e, st, 1); }
  const all=e.parts.every(p=>p.broken), defDrop=e.def/def0;
  return {none1, n, routed, bodyUntouched, bodyHit, broke, breakDmg, down0, still, recovered, all, defDrop:+defDrop.toFixed(2),
    ok: none1 && n===4 && routed && bodyUntouched && bodyHit && broke && breakDmg>=0.19 && breakDmg<=0.21 && down0>2 && still && recovered && all && defDrop<0.5};
});

/* 脚を2本以上壊したら歩けない（技は撃てる）。1本だけ壊した時はまだ歩く（2026-10-19、2本に変えたのは 2026-10-20） */
R.legsAllImmobile = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); W.enemies.filter(e=>!e.boss).forEach(e=>e.dead=true); S.hero.party=[]; TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10);
  bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  const hx=e.x, hy=e.y;
  const walkFor=(sec)=>{ e.x=hx; e.y=hy; P.x=hx+(hx>W.fl.W/2?-6:6); P.y=hy; /* 広間の真ん中の側に立つ（壁の側だと体の枠で止まって歩けない） */ const x0=e.x,y0=e.y; for(let i=0;i<sec*20;i++){ e.cast=null; e.tele=0; e.cd=9; e.down=0; e.roar=0; e.recover=0; e.broken=0; enemyUpdate(e,0.05); } return Math.hypot(e.x-x0,e.y-y0); };
  const before=walkFor(1.0);
  const st=stats(S.hero), brk=id=>{ const p=e.parts.find(q=>q.id===id); p.hp=1; P.x=e.x+p.ox+Math.sign(p.ox)*0.6; P.y=e.y+p.oy+0.5; hitEnemy(e,st,1); e.hp=e.maxHp; };
  brk('SW');
  const oneBroken=walkFor(1.0);
  brk('NE');                                   // 2本目：ここで歩けなくなる（2026-10-20 ユーザー指定）
  const twoBroken=walkFor(1.5);
  brk('SE'); brk('NW');
  const allBroken=walkFor(1.5);
  return {before:+before.toFixed(2), oneBroken:+oneBroken.toFixed(2), twoBroken:+twoBroken.toFixed(3), allBroken:+allBroken.toFixed(3),
    ok: before>0.3 && oneBroken>0.3 && twoBroken<1e-6 && allBroken<1e-6};
});
/* 第二形態は新しい絵（vera2Draw）で描かれる。脚の壊れ方で絵の組み合わせが変わる */
R.form2Art = await pg.evaluate(async ()=>{
  for(let i=0;i<40 && !(CAVE.vera2 && CAVE.vera2.ready(0)); i++) await new Promise(r=>setTimeout(r,50));
  TH.run(10,{seed:44}); W.enemies.filter(e=>!e.boss).forEach(e=>e.dead=true);
  const e=W.enemies.find(x=>x.uniqueBoss===10);
  bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  e._cf=1;
  const V=CAVE.vera2; const c0=V.combo(e,1);
  e.parts.find(p=>p.id==='SW').broken=true; const c1=V.combo(e,1), c1l=V.combo(e,-1);
  for(const p of e.parts) p.broken=true; const c15=V.combo(e,1);
  const drawn = !!CAVE._sprite(e);
  return {ready:V.ready(0), c0, c1, c1l, c15, drawn, ok: V.ready(0) && c0===0 && c1===1 && c1l===2 && c15===15 && drawn};
});

/* 部位破壊で破片が飛び、4本目で胴が落ちて着地の演出（揺れ）が1度だけ出る */
R.breakFx = await pg.evaluate(async ()=>{
  for(let i=0;i<40 && !(CAVE.vera2 && CAVE.vera2.ready(0)); i++) await new Promise(r=>setTimeout(r,50));
  TH.run(10,{seed:44}); W.enemies.filter(e=>!e.boss).forEach(e=>e.dead=true); TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); bossChangeForm(e); if(S.run.formFx) S.run.formFx=null; e._cf=1;
  const shot=()=>CAVE._sprite(e);
  shot(); FEEL.particles=[];
  const p=e.parts.find(q=>q.id==='SW'); p.hp=1; partHit(e,5,e.x+p.ox,e.y+p.oy);
  for(let i=0;i<20 && !FEEL.particles.length; i++){ shot(); await new Promise(r=>setTimeout(r,50)); }
  const debris=FEEL.particles.length;
  for(const q of e.parts){ q.hp=1; } for(const id of ['SE','NW','NE']){ const q=e.parts.find(r=>r.id===id); partHit(e,5,e.x+q.ox,e.y+q.oy); }   // 脚の円の真ん中を叩く（2026-10-20 部位ごとの当たり）
  const t0=performance.now(); while(performance.now()-t0<600){ shot(); await new Promise(r=>setTimeout(r,30)); }
  return {debris, slam:!!e._v2Slam, ok: debris>40 && !!e._v2Slam};
});
await done(b, errs, R);
