// 跳ねて動くボス（第5階層の灰の大蛙）。
//
// ユーザー要望：「5Fボスは移動時にジャンプしながら動くようにしたい」。
//
// 見るのは4つ。そのうち一番大事なのは1つめ:
//   1) **速さが変わっていない。** 見た目の話として受けた要望なので、
//      強さが動いてはいけない。1回の跳びで進む距離と、次の跳びまでの待ちを
//      e.ms から逆算しているので、平均の速さは歩いていたときと同じになる。
//      「どこまで寄れたか」ではなく「どれだけ進んだか」で測る——
//      寄り切ったあとは止まるので、終点の距離で比べると跳びが有利に見える。
//   2) 実際に跳んでいて、跳ねているあいだは浮いて見える（当たり判定は動かない）
//   3) 跳ねるのは第5階層の大蛙だけ。他のボスは今までどおり歩く
//   4) 溜めている最中は跳ばない（避ける時間を削らない）
//
// 注意: 中ボスの「型」（寄り／回り／飛ばし／溜め）は階ごとに抽選される。
// 飛ばし型は ms=0 でそもそも動かないので、移動の検証では寄り型に固定する。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);

/* ボスから D マス離れた、間に壁の無い立てる場所へ主人公を置く。
   ボスの湧き位置は階によって違うので、座標を決め打ちにしない。 */
await pg.evaluate(()=>{
  window.__place = (boss,D)=>{
    for(let i=0;i<64;i++){
      const a=i/64*Math.PI*2, x=boss.x+Math.cos(a)*D, y=boss.y+Math.sin(a)*D;
      if(!standable(x,y)) continue;
      let ok=true;
      for(let s=0.2;s<1;s+=0.1) if(!standable(boss.x+(x-boss.x)*s, boss.y+(y-boss.y)*s)){ ok=false; break; }
      if(ok){ P.x=x; P.y=y; return true; }
    }
    return false;
  };
});
const R={};

/* ============ 1. 速さは変わらない ============ */
R.speed = await pg.evaluate(()=>{
  const run=(hop)=>{
    TH.run(5,{seed:71}); S.hero.party=[]; setScreen('game');
    const boss=W.enemies.find(e=>e.boss); if(!boss) return null;
    boss.arch=ARCH.find(x=>x.id==='rush');      // 動く型に固定して比べる
    if(!hop) boss.uniqueBoss=0;                 // 跳ねを切った側
    boss.moves=[];                              // 技で止まらないようにして移動だけを見る
    W.enemies.forEach(e=>{ if(e!==boss) e.dead=true; });
    TH.immortal(); P.invuln=1e9; __place(boss,7.5);
    stickDx=0; stickDy=0;
    let path=0, moved=0;
    const T=6, N=Math.round(T*60);
    for(let i=0;i<N;i++){
      const bx=boss.x, by=boss.y;
      // 逃げ続けさせて、ずっと「移動したい」状態に保つ
      const dx=P.x-boss.x, dy=P.y-boss.y, d=Math.hypot(dx,dy)||1;
      if(d<7){ const nx=P.x+dx/d*0.037, ny=P.y+dy/d*0.037; if(standable(nx,ny)){ P.x=nx; P.y=ny; } }
      stepSim(1/60);
      const step=Math.hypot(boss.x-bx, boss.y-by);
      path+=step; if(step>0.004) moved++;
    }
    return {path:+path.toFixed(2), perSec:+(path/T).toFixed(2), movedFrames:moved, ms:+boss.ms.toFixed(2)};
  };
  const withHop=run(true), noHop=run(false);
  const ratio = (noHop && noHop.path>1) ? +(withHop.path/noHop.path).toFixed(2) : null;
  return {withHop, noHop, ratio, ok: ratio!=null && ratio>0.88 && ratio<1.12};
});

/* ============ 2. 実際に跳ぶ。跳ねているあいだは浮く ============
   間合いまで詰めたら止まるので、見るのは「寄ってくる途中」の跳び。
   跳ばずに歩いているフレームが混ざっていないことも見る——
   歩きと跳びの両方で進むと、平均の速さが上がってしまう（実際それで 1.06 倍になった）。 */
R.hops = await pg.evaluate(()=>{
  TH.run(5,{seed:72}); S.hero.party=[]; setScreen('game'); TH.immortal(); P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.moves=[]; boss.arch=ARCH.find(x=>x.id==='rush');
  W.enemies.forEach(e=>{ if(e!==boss) e.dead=true; });
  __place(boss,7.5);
  const d0=Math.hypot(boss.x-P.x, boss.y-P.y);
  let hops=0, maxLift=0, wasHop=false, walkFrames=0, moveWhileLifted=0;
  for(let i=0;i<420;i++){
    const bx=boss.x, by=boss.y;
    stepSim(1/60);
    const now=!!boss.hop;
    if(now && !wasHop) hops++;
    if(now) maxLift=Math.max(maxLift, hopLift(boss));
    // 着地の瞬間は hop が外れた同じフレームで動くので、そこは数えない
    if(!now && !wasHop && Math.hypot(boss.x-bx, boss.y-by) > 0.004) walkFrames++;
    wasHop=now;
  }
  const d1=Math.hypot(boss.x-P.x, boss.y-P.y);
  return {hops, maxLift:+maxLift.toFixed(1), walkFrames, closed:+(d0-d1).toFixed(2),
          ok: hops>=3 && maxLift>TS*0.3 && walkFrames===0};
});

/* ============ 3. 浮いて見えるだけで、当たり判定は動かない ============ */
R.liftIsVisualOnly = await pg.evaluate(()=>{
  TH.run(5,{seed:75}); S.hero.party=[]; setScreen('game'); TH.immortal(); P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.moves=[]; boss.arch=ARCH.find(x=>x.id==='rush');
  W.enemies.forEach(e=>{ if(e!==boss) e.dead=true; });
  __place(boss,7.5);
  let sawLift=false, hitWhileLifted=null;
  for(let i=0;i<420 && !hitWhileLifted;i++){
    stepSim(1/60);
    if(boss.hop && hopLift(boss)>2){
      sawLift=true;
      // 浮いている最中でも、盤面の座標から見た間合いは今までどおり
      const d=Math.hypot(boss.x-P.x, boss.y-P.y);
      const near=nearEnemies(boss.x, boss.y, 0.5).includes(boss);
      hitWhileLifted={d:+d.toFixed(2), near};
    }
  }
  return {sawLift, hitWhileLifted,
          ok: sawLift && !!hitWhileLifted && hitWhileLifted.near===true};
});

/* ============ 4. 跳ねるのは第5階層の大蛙だけ ============ */
R.onlyFifth = await pg.evaluate(()=>{
  /* 掃引は結果の中の生の false を落ちとして拾うので、
     「跳ばないのが正しい」階は false ではなく言葉で返す。 */
  const how={};
  for(const dep of [5,10,15,25,35,45]){
    TH.run(dep,{seed:73});
    const boss=W.enemies.find(e=>e.boss);
    how[dep]= boss ? (bossHopSpec(boss) ? '跳ぶ' : '歩く') : '（ボス無し）';
  }
  return {how,
          fifthHops: how[5]==='跳ぶ',
          othersWalk: [10,15,25,35,45].every(k=>how[k]==='歩く'),
          ok: how[5]==='跳ぶ' && [10,15,25,35,45].every(k=>how[k]==='歩く')};
});

/* ============ 5. 溜めている最中は跳ばない ============
   跳びと溜めが重なると、空中で止まったまま技が出る。 */
R.notWhileCasting = await pg.evaluate(()=>{
  TH.run(5,{seed:74}); S.hero.party=[]; setScreen('game'); TH.immortal(); P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.arch=ARCH.find(x=>x.id==='rush');
  W.enemies.forEach(e=>{ if(e!==boss) e.dead=true; });
  __place(boss,6);
  let hopWhileCast=0, casts=0, wasCast=false;
  for(let i=0;i<900;i++){
    stepSim(1/60);
    const casting = !!boss.cast || boss.tele>0;
    if(casting && !wasCast) casts++;
    if(casting && boss.hop) hopWhileCast++;
    wasCast=casting;
  }
  return {casts, hopWhileCast, ok: hopWhileCast===0};
});

await done(b, errs, R);
