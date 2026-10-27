/* ヴェラ第一形態の新しい絵（2026-10-27 ユーザー指定「これで第一形態に適用して」）。
   4方向（横・正面・背面）×待機・歩行・射撃・被弾のコマを、状態と向きで出し分けているかを見る。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
await pg.evaluate(()=>{ window._v1 = ()=>{ TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); S.hero.party=[]; TH.immortal();
  const e=W.enemies.find(x=>x.uniqueBoss===10); e.moveCd=99; e.cd=99; e.cast=null; e.tele=0; e.hit=0; return e; };
  window._wait=ms=>new Promise(r=>setTimeout(r,ms));
  window._draw=e=>{ CAVE._sprite(e); return {d:CAVE.vera1.dir(e), f:CAVE.vera1.frame(e), face:e._v1Face}; }; });
R.ready = await pg.evaluate(async ()=>{ for(let i=0;i<60&&!(CAVE.vera1&&CAVE.vera1.ready());i++) await _wait(50); return !!(CAVE.vera1&&CAVE.vera1.ready()); });
R.facing = await pg.evaluate(async ()=>{
  const e=_v1(); const at=(dx,dy)=>{ P.x=e.x+dx; P.y=e.y+dy; return _draw(e); };
  const right=at(4,0), left=at(-4,0), down=at(0,4), up=at(0,-4);
  const r={form1:!!e.form2, right, left, down, up};
  r.ok = r.form1 && right.d==='side' && right.face===1 && left.d==='side' && left.face===-1 && down.d==='front' && up.d==='back';
  return r;
});
R.noFlicker = await pg.evaluate(async ()=>{
  const e=_v1(); P.x=e.x+4; P.y=e.y; _draw(e);
  P.x=e.x+3; P.y=e.y+3.3; const a=_draw(e).d;          // 斜め：縦が少し勝つくらいでは横のまま
  P.x=e.x+1; P.y=e.y+4;   const b=_draw(e).d;          // はっきり縦なら正面
  P.x=e.x+3.3; P.y=e.y+3; const c=_draw(e).d;          // 斜めに戻っても正面のまま
  return {a,b,c, ok:a==='side'&&b==='front'&&c==='front'};
});
R.shoot = await pg.evaluate(async ()=>{
  const e=_v1(); P.x=e.x-4; P.y=e.y; _draw(e);
  e.tele=0.62; const f0=_draw(e).f; await _wait(350); const f1=_draw(e).f;
  e.tele=0; const rel=_draw(e).f; await _wait(700); const after=_draw(e).f;
  const r={f0,f1,rel,after};
  r.ok = f0>=20&&f0<=23 && f1>f0 && f1<=26 && rel>=27&&rel<=31 && after<12;
  return r;
});
R.beamAim = await pg.evaluate(async ()=>{
  const e=_v1(); P.x=e.x+4; P.y=e.y;                     // 主人公は右。技は下へ向けて溜める
  e.cast={id:'beam', dir:Math.PI/2, t:0.36, max:0.72}; const r=_draw(e); e.cast=null;
  return {...r, ok:r.d==='front' && r.f>=23 && r.f<=24};
});
R.hurt = await pg.evaluate(async ()=>{
  const e=_v1(); P.x=e.x+4; P.y=e.y; _draw(e); await _wait(50);
  e.hit=0.4; const f=_draw(e).f; await _wait(600); e.hit=0; const g=_draw(e).f;
  return {f,g, ok:f>=32&&f<=36 && g<12};
});
R.walk = await pg.evaluate(async ()=>{
  const e=_v1(); P.x=e.x+6; P.y=e.y; e.fx=0; e.fy=1; let fs=[];
  for(let i=0;i<8;i++){ e.y+=0.12; P.y=e.y; e.fx=0; e.fy=1; fs.push(_draw(e)); await _wait(40); }   // 本編のループが e.fx を書くので毎回入れ直す
  const last=fs[fs.length-1];
  return {last, ok: last.f>=12&&last.f<=19 && last.d==='front'};
});
R.form2Untouched = await pg.evaluate(async ()=>{
  const e=_v1(); _draw(e); const before=CAVE.vera1.frame(e); bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  e._v1F=-1; CAVE._sprite(e);
  return {form2:!e.form2, f:e._v1F, ok:!e.form2 && e._v1F===-1};
});
/* 本編の画面で4方向を撮る（目で確かめる用） */
for(const [name,dx,dy,st] of [['side',-3,0,''],['front',0,3,''],['back',0,-3,''],['shoot_side',-3,0,'tele'],['shoot_front',0,3,'tele']]){
  await pg.evaluate(async ([dx,dy,st])=>{ const e=_v1(); P.x=e.x+dx; P.y=e.y+dy; for(let i=0;i<5;i++){ _draw(e); await _wait(30); }
    if(st==='tele'){ e.tele=0.62; _draw(e); await _wait(450); } }, [dx,dy,st]);
  await pg.waitForTimeout(60);
  await pg.screenshot({path:`output/vera1_${name}.png`});
  await pg.evaluate(()=>{ const e=W.enemies.find(x=>x.uniqueBoss===10); if(e){ e.tele=0; } });
}
await done(b, errs, R);
