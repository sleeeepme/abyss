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
/* 2026-10-02 立ち物の前後：根元より奥（北）に立つと立ち物が主人公の上に描き戻され、手前（南）では描き戻さない。
   当たり判定は根元だけなので、奥へ回り込める（柱の真上の高さの所は歩ける） */
R.occlusion = await pg.evaluate(async ()=>{
  const res=[];
  for(const [d,seed,pick] of [[4,44,o=>o.k==='stalagC'],[17,44,o=>o.k==='rbig'&&/^col_[abd]/.test(o.name)],[17,44,o=>o.k==='rbig'&&/^wall_/.test(o.name)]]){
    TH.run(d,{seed}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[]; S.hero.party=[]; draw();
    const o=CAVE._G().deco.find(pick); if(!o){ res.push({d,none:true}); continue; }
    const at=(dy)=>{ P.x=o.x/16+0.1; P.y=o.y/16+dy; draw(); draw(); return CAVE.occDrawn||0; };
    const behind=at(-0.75), front=at(0.8);
    // 柱の絵の高い所（根元から1マス奥）は歩ける＝回り込める
    const walk=!window.solid(o.x/16+0.1, o.y/16-1.0);
    res.push({d, n:o.name||o.k, behind, front, walk});
  }
  return {res, ok: res.every(r=>!r.none && r.behind>0 && r.front===0 && r.walk)};
});
await done(b, errs, R);
