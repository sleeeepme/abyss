/* ヴェラ第二形態の体に主人公・仲間が入らないか（2026-10-29 ユーザー指摘「ヴェラの第2形態にコリジョンが設定されていない？」）。
   胴の下（楕円）と脚の先（小さな円）に入った主人公は外へ押し出される。押し出された所からでも、近接で体と脚に届く。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
await pg.evaluate(()=>{ window._v2 = ()=>{ TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); S.hero.party=[]; TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  e.moveCd=99; e.cd=99; e.cast=null; e.tele=0; e.ms=0; return e; };
  window._inBody=(e,x,y)=>{ const B=VERA2_SOLID; const dx=x-e.x, dy=y-(e.y+B.cy); return (dx/B.ax)**2+(dy/B.ay)**2<1; }; });
R.pushOut = await pg.evaluate(()=>{
  const e=_v2(); const out={};
  for(const [n,dx,dy] of [['center',0,0],['under',0,1.0],['side',1.2,0.4],['back',0,-0.4]]){
    P.x=e.x+dx; P.y=e.y+dy; TH.step(0.2);
    out[n]={x:+(P.x-e.x).toFixed(2), y:+(P.y-e.y).toFixed(2), inside:_inBody(e,P.x,P.y)};
  }
  out.ok = Object.values(out).every(v=>!v.inside);
  return out;
});
R.walkInto = await pg.evaluate(()=>{
  const e=_v2(); P.x=e.x; P.y=e.y+4; TH.move(2.5, 0, -1);           // 下から胴へ向かって歩き続ける
  const r={y:+(P.y-e.y).toFixed(2), inside:_inBody(e,P.x,P.y)};
  r.ok = !r.inside && r.y>1.3;
  return r;
});
R.legStop = await pg.evaluate(()=>{
  const e=_v2(); const leg=e.parts.find(p=>p.id==='SW'); P.x=e.x+leg.ox; P.y=e.y+leg.oy; TH.step(0.2);
  const d=Math.hypot(P.x-(e.x+leg.ox), P.y-(e.y+leg.oy));
  return {d:+d.toFixed(2), ok:d>=VERA2_SOLID.leg+VERA2_SOLID.me-0.02};
});
R.reach = await pg.evaluate(()=>{
  const e=_v2(); P.x=e.x; P.y=e.y+4; TH.move(2.5, 0, -1);
  const body=Math.hypot(P.x-e.x,P.y-e.y)-e.r;                       // 押し出された所から体の円の縁まで
  const st=stats(S.hero);
  return {body:+body.toFixed(2), range:st.range, ok: body < st.range};
});
R.brokenLegFree = await pg.evaluate(()=>{
  const e=_v2(); const leg=e.parts.find(p=>p.id==='NE'); leg.broken=true;
  P.x=e.x+leg.ox; P.y=e.y+leg.oy+0.1; const bx=P.x, by=P.y; TH.step(0.2);
  return {moved:+Math.hypot(P.x-bx,P.y-by).toFixed(2), ok: Math.hypot(P.x-bx,P.y-by)<0.05};
});
R.form1Untouched = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); e.moveCd=99; e.cd=99; P.x=e.x; P.y=e.y+0.2; TH.step(0.1);
  return {solid:vera2Solid(e), ok:!vera2Solid(e)};
});
await done(b, errs, R);
