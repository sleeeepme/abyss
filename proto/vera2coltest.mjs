/* ヴェラ第二形態の体に主人公・仲間が入らないか。
   2026-10-29 ユーザー指摘「ヴェラの第2形態にコリジョンが設定されていない？」→ 胴の下の楕円と脚の先の円。
   2026-11-05 ユーザー指摘「ヴェラの第二形態にまだコリジョンが反映されていなさそう」→ 描いた絵の形（VERA2_FOOT）に。
   見るもの：どの向きから歩いても絵の中に立たない・中に置いても外へ出る・入ってきた側へ戻る（反対側へ抜けない）・
   突進でも抜けない・押し出された所から近接が届く・壊れた脚の所は通れる・第一形態は対象外。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
await pg.evaluate(()=>{ window._v2 = ()=>{ TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); S.hero.party=[]; TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  e.moveCd=99; e.cd=99; e.cast=null; e.tele=0; e.ms=0; e._cf=1; return e; }; });
R.walkFrom8 = await pg.evaluate(()=>{
  const out={}; let ok=true;
  for(let k=0;k<8;k++){
    const e=_v2(), a=k/8*Math.PI*2, dx=Math.cos(a), dy=Math.sin(a);
    P.x=e.x+dx*6; P.y=e.y+dy*5; P._v2ok=null;
    let inside=0;
    for(let i=0;i<60;i++){ TH.move(0.05, -dx, -dy); if(vera2Hits(e,P.x,P.y)) inside++; }
    out[k]={rel:[+(P.x-e.x).toFixed(2), +(P.y-e.y).toFixed(2)], inside};
    if(inside) ok=false;
  }
  out.ok=ok; return out;
});
R.pushOut = await pg.evaluate(()=>{
  const e=_v2(); const out={};
  for(const [n,dx,dy] of [['center',0,0],['under',0,1.6],['leg',-2.8,1.0],['head',0,-1.5]]){
    P.x=e.x+dx; P.y=e.y+dy; P._v2ok=null; TH.step(0.1);
    out[n]={rel:[+(P.x-e.x).toFixed(2), +(P.y-e.y).toFixed(2)], inside:vera2Hits(e,P.x,P.y)};
  }
  out.ok = Object.values(out).every(v=>!v.inside);
  return out;
});
/* 技などで一気に深く入っても、入ってきた側（左）へ戻る。真ん中を越えていても右へは抜けない */
R.noTunnel = await pg.evaluate(()=>{
  const e=_v2(); P.x=e.x-5; P.y=e.y+0.5; TH.step(0.05);
  P.x=e.x+0.6; TH.step(0.05);
  return {x:+(P.x-e.x).toFixed(2), y:+(P.y-e.y).toFixed(2), ok:P.x<e.x-2 && !vera2Hits(e,P.x,P.y)};
});
R.dashStops = await pg.evaluate(()=>{
  const e=_v2(); P.x=e.x-5.2; P.y=e.y+0.6; TH.step(0.05);
  S.upg.dash=3; stickDx=1; stickDy=0; FEEL.dashCd=0;
  const went=tapDash(innerWidth/2+50, innerHeight/2);
  for(let i=0;i<10;i++) TH.step(0.05);
  stickDx=0; stickDy=0;
  return {went, x:+(P.x-e.x).toFixed(2), ok: !vera2Hits(e,P.x,P.y) && P.x<e.x-2};
});
/* 押し出された所から近接が届く：まわり16方向から歩いて止まった所で、いちばん近い当たりの円（体か脚）が間合いの内 */
R.reach = await pg.evaluate(()=>{
  const st=stats(S.hero), out={}; let ok=true, body=0;
  for(let k=0;k<16;k++){
    const e=_v2(), a=k/16*Math.PI*2, dx=Math.cos(a), dy=Math.sin(a);
    P.x=e.x+dx*6; P.y=e.y+dy*5; P._v2ok=null; const sx=P.x, sy=P.y; TH.move(2.5, -dx, -dy);
    if(!vera2Blocked(P.x-dx*0.2, P.y-dy*0.2)){ out[k]='壁で止まった'; continue; }   // 広間の壁に当たって絵まで来られなかった向きは見ない
    const n=eNear(e,P.x,P.y); if(!n.part) body++;
    if(!(n.d<st.range)) ok=false;
    out[k]=[+n.d.toFixed(2), n.part?n.part.id:'body'];
  }
  out.range=st.range; out.bodyFrom=body; out.ok=ok && body>=3; return out;
});
R.brokenLegFree = await pg.evaluate(()=>{
  const e=_v2(); const cnt=()=>{ let n=0; for(let x=-4;x<=-1.5;x+=0.25) for(let y=-0.5;y<=2.6;y+=0.25) if(vera2Hits(e,e.x+x,e.y+y)) n++; return n; };
  const before=cnt();
  e.parts.find(p=>p.id==='NW').broken=true; e.parts.find(p=>p.id==='SW').broken=true;
  const after=cnt();
  return {before, after, ok: after < before*0.85};
});
R.form1Untouched = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); e.moveCd=99; e.cd=99; P.x=e.x; P.y=e.y+0.2; TH.step(0.1);
  return {solid:vera2Solid(e), ok:!vera2Solid(e)};
});
await done(b, errs, R);
