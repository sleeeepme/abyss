/* 立ち物と壁（2026-10-01 ユーザー指摘）：壁は真上から見た面、置き物は斜めから見た絵なので、
   高さのある物（葦・藻・柱・崩れ壁・門・灯柱・列柱・ボイラー・石積み・枠・白い草・3Dの遺跡）は
   **絵の全体が床の上**に収まっていること（岩に掛かると、壁の天面に乗り上げるか、途中で切れて見える）。
   ずらしきれずに捨てた分で品目が消えていないことも見る。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.standClear = await pg.evaluate(()=>{
  const per={}; let over=0, all=0;
  for(const d of [4,8,13,17,24,34,44,54]) for(const seed of [44,45]){
    TH.run(d,{seed}); setScreen('game'); draw(); const G=CAVE._G(), z=G.Z.id;
    for(const o of G.deco){ if(o.ok<0) continue; let hit=false;
      if(o.k==='rbig'){ const sp=CAVE._ruinBig(o); for(let r=0;r<sp.h&&!hit;r+=2) for(let q=0;q<sp.w;q+=2){ const c=sp.rows[r][q]; if(c==='.'||c==='s') continue; if(CAVE._rockAt(o.x-sp.ax+q,o.y-sp.ay+r)){ hit=true; break; } } }
      else { const bx=CAVE._standBox(o); if(!bx) continue; for(let py=o.y+bx[1];py<=o.y+bx[3]&&!hit;py+=2) for(let px=o.x+bx[0];px<=o.x+bx[2];px+=2) if(CAVE._rockAt(px,py)){ hit=true; break; } }
      all++; if(hit) over++; const k=z+':'+(o.k==='rbig'?'rbig':o.k); per[k]=(per[k]||0)+1; }
  }
  // 壁際に出ていた品目が、ずらした結果ひとつも残らない、ということが無いこと
  const need=['stone:reed','stone:rock','stone:stalagC','sump:weed','ruin:pillar','ruin:colonnade','ruin:brokenwall','ruin:arch','furnace:boiler','sump:rbig'];
  const missing=need.filter(k=>!per[k]);
  return {all, over, missing, per, ok: over===0 && missing.length===0 && all>300};
});
await done(b, errs, R);
