/* 敵どうしが重ならない（2026-10-28 ユーザー指定「敵にもコリジョンを設定して重ならないようにして」）。
   ・囲まれても、敵の絵どうしが大きく重ならない（絵の幅・高さの6割より内側に入る組がほとんど無い）
   ・それでも近接の敵は主人公に届く（離しすぎて殴れなくならない）
   ・ボスは押されない */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.crowd = await pg.evaluate(async ()=>{
  const out={};
  for(const d of [3,12,22]){
    TH.run(d,{seed:7}); TH.immortal(); S.hero.party=[]; await new Promise(r=>setTimeout(r,300));
    const es=W.enemies.filter(e=>!e.boss).slice(0,10);
    es.forEach((e,i)=>{ e.x=P.x+2+Math.cos(i)*1.5; e.y=P.y+Math.sin(i)*1.5; e.state='chase'; e.aggro=99; e.hp=e.maxHp=1e9; });
    let ov=0, frames=0;
    for(let f=0;f<150;f++){ await new Promise(r=>setTimeout(r,16)); if(f<60) continue; frames++;
      const live=es.filter(e=>!e.dead&&e._vis);
      for(let i=0;i<live.length;i++) for(let j=i+1;j<live.length;j++){ const a=live[i],c=live[j];
        const w=(a._vis.w+c._vis.w)/2/TS, h=((a._vis.bot-a._vis.top)+(c._vis.bot-c._vis.top))/2/TS;
        if(Math.abs(a.x-c.x)<w*0.6 && Math.abs(a.y-c.y)<h*0.6) ov++; } }
    out[d]=+(ov/frames).toFixed(2);
  }
  return {...out, ok: out[3]<1 && out[12]<1 && out[22]<1};
});
R.meleeStillHits = await pg.evaluate(async ()=>{
  TH.run(3,{seed:7}); S.hero.party=[]; await new Promise(r=>setTimeout(r,300));
  const h0=S.hero.hpNow;
  const es=W.enemies.filter(e=>!e.boss&&(e.arch.id==='rush'||e.arch.id==='swarm')).slice(0,4);
  W.enemies.filter(e=>!es.includes(e)).forEach(e=>e.dead=true);
  es.forEach((e,i)=>{ e.x=P.x+1.2+i*.3; e.y=P.y+(i%2?.4:-.4); e.state='chase'; e.aggro=99; e.hp=e.maxHp=1e9; });
  await new Promise(r=>setTimeout(r,2500));
  const lost=h0-S.hero.hpNow;
  return {n:es.length, h0, lost:+lost.toFixed(1), ok: es.length>0 && lost>0};
});
R.bossNotPushed = await pg.evaluate(async ()=>{
  TH.run(5,{seed:44}); TH.immortal(); const bs=W.enemies.find(e=>e.boss); if(!bs) return {ok:false, why:'no boss'};
  bs.ms=0; bs.moveCd=999; bs.cd=999; const x0=bs.x, y0=bs.y;
  W.enemies.filter(e=>!e.boss).slice(0,4).forEach((e,i)=>{ e.x=bs.x+.2*(i-1.5); e.y=bs.y+.1; });
  await new Promise(r=>setTimeout(r,600));
  return {moved:+Math.hypot(bs.x-x0,bs.y-y0).toFixed(3), ok: Math.hypot(bs.x-x0,bs.y-y0)<0.05};
});
await done(b, errs, R);
