/* 打ち直しのブレヒト（第20階層）の三つの形（2026-11-06 ユーザー指定）。
   ・それぞれHPが半分で鎧をパージ（防御↓・速さ↑）・片方を倒すと合体（第3形態）・ワープしない
   ・鎧の中は蛸と宿借り：触手・墨・引き寄せ／鋏・泡・転がり
   見るもの：
     spawn       2体とも鎧の技（叩きつけ・薙ぎ払い）から。中身は蛸と宿借り。突進はどの形にも無い
     purge       HP半分で脱ぐ：防御0.5倍・速さ1.4倍・中身の技・名前
     tentacle    3本の帯に立てば当たり、帯のあいだは当たらない
     grab        当たると本体の前まで引かれる（少しずつ。1フレームで跳ばない）
     ink         墨溜まりが3つ残り、踏むと遅くなり視界が狭まる。時間で消える
     pinch       左半分→少し後に右半分。2発目までに右から出れば当たらない
     bubble      ゆっくりの泡が狙った向きに出る
     roll        本当に転がる（1フレームの移動が小さい）・通り道の主人公に1回だけ当たる・止まってから隙
     merge       片方を倒すと残りが合体：HP4割まで戻る・6つの技・名前・報酬はまだ出ない
     noWarp      第2・第3形態で40秒戦っても、1フレームに0.5マス以上動かない */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
await pg.evaluate(()=>{
  window._b20 = (purge)=>{
    S.greatDown={}; S.hero=newHero(); TH.run(20,{seed:44}); W.seen.forEach(r=>r.fill(1));
    const bs=W.enemies.filter(e=>e.boss); bs.forEach(e=>{ e.revealed=true; });
    if(purge){ bs.forEach(e=>{ e.hp=Math.round(e.maxHp*0.49); bossRage(e); }); }
    bs.forEach(e=>{ e.moveCd=99; e.cd=99; e.cast=null; e.recover=0; });
    return bs;
  };
  // 開けた所（主人公の出る所）にボスを置き、主人公をその右へ。向きは右（0）
  window._place = (e, dx, dy)=>{ e.x=P.x; e.y=P.y; P.x=e.x+dx; P.y=e.y+(dy||0); };
  window._hpLoss = (fn)=>{ P.invuln=0; const h=S.hero.hpNow=stats(S.hero).maxHp; fn(); return h-S.hero.hpNow; };
  window._cast = (e, id, dir)=>{ e.cast={id, dir:dir||0, t:0, max:1}; if(id==='ink'||id==='pillars'){ bossBeginCast(e, id, {x:P.x, y:P.y}, false); e.cast.dir=dir||0; } resolveBossMove(e); e.cast=null; };
  window._noEvade = ()=>{ S.hero.equip.armor=null; };
});
R.spawn = await pg.evaluate(()=>{
  const bs=_b20(false);
  const inner=bs.map(e=>e.brecht&&e.brecht.inner).sort().join(',');
  const noCharge=[BRECHT.armor, BRECHT.octo, BRECHT.crab, BRECHT.merge].every(F=>!F.moves.includes('charge'));
  return {n:bs.length, inner, moves:bs.map(e=>e.moves.join('/')), noCharge,
          ok: bs.length===2 && inner==='crab,octo' && bs.every(e=>e.moves.join('/')==='slam/cleave') && noCharge};
});
R.purge = await pg.evaluate(()=>{
  const bs=_b20(false); const o=bs.find(e=>e.brecht.inner==='octo');
  o.hp=Math.round(o.maxHp*0.51); bossRage(o); const before=o.brecht.purged;
  o.hp=Math.round(o.maxHp*0.49); bossRage(o);
  const r={notYet:!before, after:o.brecht.purged, def:+(o.def/o.brecht.def0).toFixed(2), ms:+(o.ms/o.brecht.ms0).toFixed(2), moves:o.moves.join('/'), name:o.name,
           otherStill: !bs.find(e=>e!==o).brecht.purged};
  r.ok = r.notYet && r.after && r.def===0.5 && r.ms===1.4 && r.moves==='tentacle/ink/grab' && r.name==='ブレヒトの蛸' && r.otherStill;
  return r;
});
R.tentacle = await pg.evaluate(()=>{
  const bs=_b20(true); const o=bs.find(e=>e.brecht.inner==='octo'); bs.find(e=>e!==o).x=-99;
  const m=BOSS_MOVES.tentacle;
  _place(o, 3.5, 0); const onBand=_hpLoss(()=>_cast(o,'tentacle',0));
  const a=m.fan*Math.PI/180/2; _place(o, Math.cos(a)*4.5, Math.sin(a)*4.5); const between=_hpLoss(()=>_cast(o,'tentacle',0));
  return {onBand:Math.round(onBand), between:Math.round(between), ok: onBand>0 && between===0};
});
R.grab = await pg.evaluate(()=>{
  const bs=_b20(true); const o=bs.find(e=>e.brecht.inner==='octo'); bs.find(e=>e!==o).x=-99;
  TH.immortal(); _place(o, 5.5, 0); o.ms=0;          // 本体は動かさない（間合いを取る型なので、測る間に下がってしまう）
  const d0=Math.hypot(P.x-o.x, P.y-o.y);
  _cast(o,'grab',0);
  let maxStep=0, px=P.x, py=P.y;
  stepSim(0.4,{after:()=>{ maxStep=Math.max(maxStep, Math.hypot(P.x-px,P.y-py)); px=P.x; py=P.y; }});
  const d1=Math.hypot(P.x-o.x, P.y-o.y);
  return {d0:+d0.toFixed(2), d1:+d1.toFixed(2), maxStep:+maxStep.toFixed(2), ok: d1 < o.r+1.6 && maxStep < 1.6};
});
R.ink = await pg.evaluate(()=>{
  const bs=_b20(true); const o=bs.find(e=>e.brecht.inner==='octo'); bs.find(e=>e!==o).x=-99;
  TH.immortal(); _place(o, 4, 0);
  W.fx=W.fx.filter(f=>f.t!=='ink');
  const slowBefore=hazardSlowAt(P.x,P.y);
  _cast(o,'ink',0);
  const pools=W.fx.filter(f=>f.t==='ink').length;
  const slowIn=hazardSlowAt(P.x,P.y);
  stepSim(0.1); const blind=P.inkT>0;
  stepSim(INK.life+0.5); const gone=W.fx.filter(f=>f.t==='ink').length;
  return {pools, slowBefore, slowIn:+slowIn.toFixed(2), blind, gone, ok: pools>=2 && slowIn<slowBefore && blind && gone===0};
});
R.pinch = await pg.evaluate(()=>{
  const bs=_b20(true); const c=bs.find(e=>e.brecht.inner==='crab'); bs.find(e=>e!==c).x=-99;
  const m=BOSS_MOVES.pinch, a=m.arc*Math.PI/180*0.5;
  // 左半分（角度が負の側）に立つ：1発目で当たる
  _place(c, Math.cos(-a)*2.2, Math.sin(-a)*2.2);
  const left=_hpLoss(()=>{ _cast(c,'pinch',0); });
  c.pending=null;
  // 右半分に立つ：1発目では当たらず、2発目で当たる
  _place(c, Math.cos(a)*2.2, Math.sin(a)*2.2);
  let first=0, second=0;
  first=_hpLoss(()=>{ _cast(c,'pinch',0); });
  const h0=S.hero.hpNow; stepSim(m.gap+0.05); second=h0-S.hero.hpNow;
  // 右半分に立ち、2発目の前に出る：当たらない
  c.pending=null; _place(c, Math.cos(a)*2.2, Math.sin(a)*2.2);
  _hpLoss(()=>{ _cast(c,'pinch',0); });
  P.x=c.x-6; const h1=S.hero.hpNow; stepSim(m.gap+0.05); const dodged=h1-S.hero.hpNow;
  return {left:Math.round(left), first:Math.round(first), second:Math.round(second), dodged:Math.round(dodged),
          ok: left>0 && first===0 && second>0 && dodged===0};
});
R.bubble = await pg.evaluate(()=>{
  const bs=_b20(true); const c=bs.find(e=>e.brecht.inner==='crab'); bs.find(e=>e!==c).x=-99;
  _place(c, 4, 0); W.fx=W.fx.filter(f=>f.t!=='bolt');
  _cast(c,'bubble',0);
  const bb=W.fx.filter(f=>f.t==='bolt' && f.bubble);
  const sp=Math.max(...bb.map(f=>Math.hypot(f.vx,f.vy)));
  const ahead=bb.every(f=>f.vx>0);
  return {n:bb.length, maxSpeed:+sp.toFixed(2), ahead, ok: bb.length===BOSS_MOVES.bubble.n && sp<3.5 && ahead};
});
R.roll = await pg.evaluate(()=>{
  const bs=_b20(true); const c=bs.find(e=>e.brecht.inner==='crab'); bs.find(e=>e!==c).x=-99;
  _place(c, 3, 0); P.invuln=0; S.hero.hpNow=stats(S.hero).maxHp; const h0=S.hero.hpNow;
  const x0=c.x; c.moveCd=99;
  _cast(c,'roll',0);
  let maxStep=0, px=c.x, py=c.y, frames=0, hits=0, last=S.hero.hpNow;
  stepSim(2.0,{after:()=>{ if(c.roll) frames++; maxStep=Math.max(maxStep, Math.hypot(c.x-px,c.y-py)); px=c.x; py=c.y;
    if(S.hero.hpNow<last-0.5) hits++; last=S.hero.hpNow; }});
  const moved=c.x-x0;
  return {moved:+moved.toFixed(2), maxStep:+maxStep.toFixed(2), frames, hits, stopped:!c.roll,
          ok: moved>1.5 && maxStep<0.3 && frames>3 && hits===1 && !c.roll};
});
R.merge = await pg.evaluate(()=>{
  const bs=_b20(true); const o=bs.find(e=>e.brecht.inner==='octo'), c=bs.find(e=>e!==o);
  c.hp=Math.round(c.maxHp*0.2); W.drops=[];
  o.hp=1; killEnemy(o);
  const r={merged:c.brecht.merged, hpPct:+(c.hp/c.maxHp).toFixed(2), moves:c.moves.slice().sort().join('/'), name:c.name,
           def:+(c.def/c.brecht.def0).toFixed(2), drops:W.drops.length, alive:S.run.bossAlive};
  r.ok = r.merged && r.hpPct>=0.4 && r.moves==='bubble/grab/ink/pinch/roll/tentacle' && r.name===BRECHT.merge.nm && r.def===0.75 && r.drops===0 && r.alive;
  return r;
});
R.noWarp = await pg.evaluate(()=>{
  const bs=_b20(true); TH.immortal(); bs.forEach(e=>{ e.moveCd=1; e.cd=1; });
  P.x=(bs[0].x+bs[1].x)/2; P.y=bs[0].y+3;
  let maxStep=0; const prev=new Map();
  const watch=()=>{ for(const e of bs){ const p=prev.get(e); if(p&&!e.dead) maxStep=Math.max(maxStep, Math.hypot(e.x-p.x,e.y-p.y)); prev.set(e,{x:e.x,y:e.y}); } };
  stepSim(20,{after:watch});
  bs[0].hp=1; killEnemy(bs[0]); prev.clear();
  stepSim(20,{after:watch});
  return {maxStep:+maxStep.toFixed(2), ok: maxStep<0.5};
});
await done(b, errs, R);
