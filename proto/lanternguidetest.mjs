// 穴の気配：矢印の代わりにランタンが穴の方へ飛び出しては戻る（2026-11-20 ユーザー指定）
//  ・気配が出る前は飛び出さない
//  ・気配が出たら、ランタンが主人公から穴の方へ離れる（向きが合っている）
//  ・描画で落ちない
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};
R.guide = await pg.evaluate(()=>{
  S.hero=newHero(); S.deepest=1; TH.run(2,{seed:31}); S.hero.party=[]; TH.clearEnemies(); TH.immortal(); setScreen('game');
  P.x=W.fl.start.cx+0.5; P.y=W.fl.start.cy+0.5; W.seen.forEach(r=>r.fill(0));
  const ang=Math.atan2(W.fl.stair.y-P.y, W.fl.stair.x-P.x);
  const along=()=>((LAN.x-P.x)*Math.cos(ang)+(LAN.y-(P.y-0.52))*Math.sin(ang));
  const run=(sec)=>{ let best=-9; for(let i=0;i<sec*20;i++){ drawLantern(0,0,0.05); LAN.alert=null; best=Math.max(best, along()); } return best; };
  S.run.ft=0; LAN.x=null; const before=run(1.2);
  S.run.ft=STAIR_HINT_FULL+1; LAN.x=null; LAN.gT=0; const after=run(1.2);
  let threw=null; try{ for(let i=0;i<3;i++) draw(); }catch(e){ threw=e.message; }
  return {before:+before.toFixed(2), after:+after.toFixed(2),
          quietBefore: before<0.5, goesTowardHole: after>1.0, drawsFine: threw===null};
});
await done(b, errs, R);
