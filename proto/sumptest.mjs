/* 水の層の追加ぶん：磯虫の群れ（10体ほどで一斉に来る・1体は弱い）、天井からの滴、
   第16〜20階層の遺跡の名残（立った柱は当たり判定を持つ）、空中のシャボン玉。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.spawn = await pg.evaluate(()=>{
  const packsAt = d => { TH.run(d,{seed:41}); const sw=W.enemies.filter(e=>e.swarmling);
    const by={}; sw.forEach(e=>{ (by[e.pack] ||= []).push(e); }); return Object.values(by).map(a=>a.length); };
  const d13=packsAt(13), d17=packsAt(17), d15=packsAt(15), d5=packsAt(5), d25=packsAt(25);
  // 1体の硬さ：同じ階の雑魚（溜め）と比べる
  TH.run(13,{seed:41});
  const sl=W.enemies.find(e=>e.swarmling), mob=W.enemies.find(e=>!e.swarmling && !e.moss && !e.boss && !e.uniq && !e.elite);
  const weak = sl.maxHp < mob.maxHp*0.45 && sl.atkV < mob.atkV*0.6;
  // 群れは寄り集まって湧く
  const pk=W.enemies.filter(e=>e.pack===sl.pack), cx=pk.reduce((a,e)=>a+e.x,0)/pk.length, cy=pk.reduce((a,e)=>a+e.y,0)/pk.length;
  const tight = pk.every(e=>Math.hypot(e.x-cx,e.y-cy)<2.6);
  return {d13, d17, d15, d5, d25, weak, tight,
    ok: d13.length===1 && d13[0]>=9 && d13[0]<=12 && d17.length===2 && !d15.length && !d5.length && !d25.length && weak && tight};
});
R.packRush = await pg.evaluate(()=>{
  TH.run(13,{seed:42}); setScreen('game');
  const pk0=W.enemies.find(e=>e.swarmling), pk=W.enemies.filter(e=>e.pack===pk0.pack);
  // 群れの端の1体だけが見える所に立つ（他は索敵距離の外）
  const far=pk.reduce((m,e)=>Math.hypot(e.x-pk0.x,e.y-pk0.y)>Math.hypot(m.x-pk0.x,m.y-pk0.y)?e:m, pk0);
  P.x=pk0.x+(pk0.x-far.x>0?1:-1)*8.0; P.y=pk0.y;
  const seesOne = pk.filter(e=>Math.hypot(e.x-P.x,e.y-P.y)<e.arch.aggro).length;
  W.enemies.filter(e=>!e.swarmling).forEach(e=>e.dead=true);
  S.hero.hpNow=99999;
  stepSim(0.15);
  const chasing = pk.filter(e=>e.state==='chase').length;
  const d0 = pk.reduce((a,e)=>a+Math.hypot(e.x-P.x,e.y-P.y),0)/pk.length;
  stepSim(1.0);
  const d1 = pk.filter(e=>!e.dead).reduce((a,e)=>a+Math.hypot(e.x-P.x,e.y-P.y),0)/Math.max(1,pk.filter(e=>!e.dead).length);
  return {n:pk.length, seesOne, chasing, d0:+d0.toFixed(2), d1:+d1.toFixed(2), ok: seesOne<pk.length && chasing===pk.length && d1<d0-1.5};
});
R.rewards = await pg.evaluate(()=>{
  TH.run(13,{seed:43}); setScreen('game');
  const pk0=W.enemies.find(e=>e.swarmling), pk=W.enemies.filter(e=>e.pack===pk0.pack);
  const sp0=S.shards||0, xp0=S.hero.xp, lv0=S.hero.lv;
  const spAfter=[];
  pk.forEach(e=>{ killEnemy(e); spAfter.push((S.shards||0)-sp0); });
  const spMid = spAfter[spAfter.length-2], spEnd = spAfter[spAfter.length-1];
  return {spMid, spEnd, ok: spMid===0 && spEnd>0};
});
R.draw = await pg.evaluate(()=>{
  TH.run(17,{seed:44}); setScreen('game'); W.seen.forEach(r=>r.fill(1));
  const e=W.enemies.find(x=>x.swarmling); P.x=e.x+1.2; P.y=e.y; draw(); draw();
  const spr = CAVE._sprite(e);
  return {spr: !!spr, ok: !!spr};
});
R.ruins = await pg.evaluate(()=>{
  const kinds=d=>{ TH.run(d,{seed:45}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); draw(); const G=CAVE._G(); return G.deco.map(o=>o.k); };
  const RUIN=['pillar','colonnade','brokenwall','fallen','rubble'];
  let early=0, late=0, solidN=0, pillars=0;
  for(const seed of [45,46]){
    for(const d of [12,14]){ TH.run(d,{seed}); setScreen('game'); draw(); early+=CAVE._G().deco.filter(o=>RUIN.includes(o.k)).length; }
    for(const d of [16,18]){ TH.run(d,{seed}); setScreen('game'); draw(); const G=CAVE._G();
      const rs=G.deco.filter(o=>RUIN.includes(o.k)); late+=rs.length;
      for(const o of rs.filter(o=>o.k==='pillar')){ pillars++; if(window.solid(o.x/16, (o.y-1)/16)) solidN++; } }
  }
  return {early, late, pillars, solidN, ok: early===0 && late>=6 && pillars>0 && solidN===pillars};
});
R.drips = await pg.evaluate(()=>{
  let all=0, wet=0, stone4=0;
  for(const d of [12,17]){ TH.run(d,{seed:47}); setScreen('game'); draw(); const G=CAVE._G(); all+=G.drips.length; wet+=G.drips.filter(x=>x.wet).length; }
  TH.run(4,{seed:47}); setScreen('game'); draw(); stone4=CAVE._G().drips.length;   // 石の層の浅い所は今まで通り無し
  return {all, wet, stone4, ok: all>8 && wet>0 && stone4===0};
});
R.soap = await pg.evaluate(()=>{
  TH.run(13,{seed:48}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[];
  for(let i=0;i<3;i++) draw();
  const G=CAVE._G(), n=(G.soap||[]).length;
  // 触れると弾ける
  const s=G.soap[0]; s.age=1; s.ox=0; s.oy=0;
  const x=s.hx+Math.sin(1.1+s.s%7)*5, y=s.hy-6-22*(1/s.life);
  P.x=x/16; P.y=(y+8)/16; draw();
  const popped = s.age>=s.life;
  TH.run(5,{seed:48}); setScreen('game'); draw(); const none=!CAVE._G().soap;
  return {n, popped, none, ok: n>=5 && n<=60 && popped && none};
});
await done(b, errs, R);
