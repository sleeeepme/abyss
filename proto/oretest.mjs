/* 鉱毒の溜り（2026-10-28 ユーザー指定）：
   ・水の層の池のように、歩くと波紋が出る
   ・足が遅くなる（0.20→0.40）
   ・8〜9階にも少し置く（ヴェラの広間より小さく少なく、入口・穴から離す） */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
const inPool = ()=>{ const c=W.haz.pools[0]; return {x:c.x, y:c.y-0.3}; };   // 足もと（中心の0.3マス下）が池の中心
R.slow = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); const c=W.haz.pools[0];
  const inside=hazardSlowAt(c.x,c.y), outside=hazardSlowAt(W.fl.start.cx+.5,W.fl.start.cy+.5);
  return {kind:W.haz.kind, inside:+inside.toFixed(2), outside, ok: W.haz.kind==='ore' && Math.abs(inside-0.6)<1e-6 && outside===1};
});
R.ripple = await pg.evaluate(async ()=>{
  TH.run(10,{seed:44}); W.enemies.forEach(e=>{ e.dead=true; }); S.hero.party=[]; TH.immortal();
  const c=W.haz.pools[0]; P.x=c.x; P.y=c.y-0.3;
  await new Promise(r=>setTimeout(r,200));
  const n0=CAVE.ripples().length;
  feelFootstep(P); await new Promise(r=>setTimeout(r,120));
  const inside=CAVE.ripples().length;
  // 池の外の乾いた床では出ない
  P.x=W.fl.start.cx+.5; P.y=W.fl.start.cy+.5; await new Promise(r=>setTimeout(r,1100));
  const before=CAVE.ripples().length; feelFootstep(P); await new Promise(r=>setTimeout(r,120));
  const dry=CAVE.ripples().length-before;
  return {n0, inside, dry, ok: inside>n0 && dry<=0};
});
R.floors89 = await pg.evaluate(()=>{
  const out={};
  for(const d of [7,8,9,11]){
    let pools=0, tiles=0, kinds=new Set(), nearStart=0, nearStair=0;
    for(let s=0;s<6;s++){ TH.run(d,{seed:100+s}); const h=W.haz; if(!h) continue; kinds.add(h.kind);
      if(h.kind!=='ore') continue; pools+=h.pools.length; tiles+=h.n;
      const sx=W.fl.start.cx+.5, sy=W.fl.start.cy+.5;
      for(const c of h.pools){ if(Math.hypot(c.x-sx,c.y-sy)<8) nearStart++; if(Math.hypot(c.x-W.fl.stair.x,c.y-W.fl.stair.y)<5) nearStair++; } }
    out[d]={kinds:[...kinds], pools, tiles, nearStart, nearStair};
  }
  const ok = out[7].kinds.length===0 && out[8].kinds.join()==='ore' && out[9].kinds.join()==='ore'
     && out[8].pools>=6 && out[8].pools<=12 && out[9].pools>=6 && out[9].pools<=12
     && out[8].nearStart+out[9].nearStart===0 && out[8].nearStair+out[9].nearStair===0
     && !out[11].kinds.includes('ore');
  return {...out, ok};
});
R.preDraws = await pg.evaluate(async ()=>{
  // 8階でも池の上で泡・湯気・波紋の仕組みが動く（W.haz.circ がある）
  TH.run(8,{seed:101}); const c=W.haz.pools[0]; P.x=c.x; P.y=c.y-0.3; await new Promise(r=>setTimeout(r,300));
  const n0=CAVE.ripples().length; feelFootstep(P); await new Promise(r=>setTimeout(r,120));
  return {circ:!!W.haz.circ, ripples:CAVE.ripples().length-n0, ok: !!W.haz.circ && CAVE.ripples().length>n0};
});
await done(b, errs, R);
