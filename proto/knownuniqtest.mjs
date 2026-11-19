// 踏破済みの階層の規格外（2026-11-19 ユーザー指定）
//  ・踏破済みの階層（knownFloor）では出やすい
//  ・踏破済みの階層では、規格外の落とし物のレア度・付帯が良くなる
//  ・規格外は名前と同じ紫の縁取りで描く（描画で落ちない）
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};
R.chance = await pg.evaluate(()=>{
  S.deepest=30;
  const known=uniqueChanceAt(10), fresh=uniqueChanceAt(28);
  S.deepest=10;
  const before=uniqueChanceAt(10);
  return {known, fresh, before, higherWhenKnown: known>before+0.2, capped: known<=KNOWN_UNIQ.cap};
});
R.drops = await pg.evaluate(()=>{
  S.hero=newHero(); TH.run(10,{seed:5});
  const avg=(known)=>{ S.deepest = known ? 40 : 10; RNG=mulberry32(77);
    let r=0, a=0, n=600;
    for(let i=0;i<n;i++){ const it=uniqueDrop(14, 25, 10); r+=it.rar; a+=it.aff.filter(x=>x.t==='p'||x.t==='s').length; }
    return {rar:r/n, aff:a/n}; };
  const base=avg(false), known=avg(true);
  return {base, known, betterRarity: known.rar>base.rar*1.3, moreAffixes: known.aff>base.aff*1.3};
});
R.outline = await pg.evaluate(()=>{
  S.hero=newHero(); TH.run(8,{seed:12}); setScreen('game');
  const u=makeUnique(W.fl, 8, [FAMILY[0]]); W.enemies=[u]; u.x=P.x+1.2; u.y=P.y;
  let threw=null; try{ for(let i=0;i<4;i++) draw(); }catch(e){ threw=e.message; }
  return {drawsFine: threw===null, color: UNIQ_OUTLINE==='#c07fe0'};
});
await done(b, errs, R);
