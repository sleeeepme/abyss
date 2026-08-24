// 仲間の挙動（震え・追従）と、未踏階層で階段を隠す仕組み。
//
// 「震える」は感覚の話に見えるが、実体は毎フレームの移動方向の反転なので数えられる。
// ここでは 4 つの状況で反転率を測り、どれもほぼ 0 であることを保証する。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* パーティを組んで、指定の状況で「移動方向が何回反転するか」を数える */
const PARTY = `
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=22;
  S.hero.str=26;S.hero.dex=26;S.hero.vit=26;
  startRun(10); S.hero.party=[]; W.ores.length=0;
  for(let i=0;i<3;i++){ const a=makeAlly(10,S.hero); a.x=P.x+rf(-0.4,0.4); a.y=P.y+rf(-0.4,0.4);
    a.slot=i; uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
`;
const shake = (label, setup)=>pg.evaluate(async ({label,setup})=>{
  eval(setup);
  // 実時間で待たず、同じフレーム数だけループを回す（stepSim の説明は index.html 側）
  stepSim(1.5);                                      // 落ち着かせてから測る
  const prev=livingParty().map(a=>({x:a.x,y:a.y,vx:0,vy:0}));
  let flips=0, samples=0, dist=0;
  /* 立ち位置が安定しているか。交戦中は隊列の「揺らぎ」で常に少しずつ動くので、
     経路の長さで測ると揺らぎまで異常扱いになる。
     見たいのは「持ち場から離れていかないこと」なので、
     主人公からの距離が何マスの幅に収まっているかで測る。 */
  const dpLog=livingParty().map(()=>[]);
  const deLog=livingParty().map(()=>[]);
  const sp=logs=>Math.max(...logs.map(l=>l.length?Math.max(...l)-Math.min(...l):0));
  const spread=()=>sp(dpLog);
  /* 交戦中は隊列の「揺らぎ」で敵の周りを少しだけ移動する（意図した挙動）ので、
     主人公からの距離は当然ゆれる。落ち着きを測るなら
     「相手との間合いを保てているか」を見るほうが正しい。 */
  const keepSpread=()=>sp(deLog);
  const sample=()=>{
    livingParty().forEach((a,i)=>{
      if(!prev[i]) return;
      const vx=a.x-prev[i].x, vy=a.y-prev[i].y, sp=Math.hypot(vx,vy);
      const ps=Math.hypot(prev[i].vx,prev[i].vy);
      /* 目に見える速さで動いているときだけ「切り返し」を数える。
         しきい値が低すぎると、釣り合った位置での 1/100 マス未満のゆらぎまで
         震え扱いになり、実際には静止して見えるものを不合格にしてしまう。
         0.01マス/フレーム ＝ 約0.6マス/秒 が、動いていると分かる下限。 */
      if(sp>0.01 && ps>0.01){
        const dot=(vx*prev[i].vx+vy*prev[i].vy)/(sp*ps);
        if(dot<-0.3) flips++;
        samples++;
      }
      dist+=sp; prev[i]={x:a.x,y:a.y,vx,vy};
      if(dpLog[i]) dpLog[i].push(Math.hypot(a.x-P.x, a.y-P.y));
      // 「今相手にしている敵」との距離。いちばん近い敵で測ると、
      // 相手が入れ替わった瞬間に段差が出て、揺れと区別がつかなくなる。
      if(deLog[i] && a.tgt && !a.tgt.dead)
        deLog[i].push(Math.hypot(a.x-a.tgt.x, a.y-a.tgt.y));
    });
  };
  stepSim(4, {after:sample});                        // 4秒ぶん＝240フレームを毎フレーム観測
  stickDx=0; stickDy=0;
  return {label, flips, samples, flipRate:+(flips/Math.max(1,samples)).toFixed(3),
          moved:+dist.toFixed(1), dpSpread:+spread().toFixed(2),
          keepSpread:+keepSpread().toFixed(2),
          gaps:livingParty().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(2))};
}, {label,setup});

/* ================= 1. 震えない ================= */

// 1-a. 立ち止まっているとき。隊列に着いたら止まって動かない
R.idle = await shake('停止中', PARTY + 'W.enemies.length=0; stickDx=0; stickDy=0;');
R.idle.calm = R.idle.flipRate < 0.05 && R.idle.dpSpread < 0.6;

// 1-b. 歩いているとき（壁のある実際の階層）
R.walking = await shake('歩行中', PARTY + 'W.enemies.length=0; stickDx=0.55; stickDy=0.2;');
R.walking.smooth = R.walking.flipRate < 0.08;

// 1-c. 交戦中。囲む位置が決まっていて、そこから動かない
R.fighting = await shake('交戦中', PARTY + `
  W.enemies.forEach(e=>{e.dead=true});
  W.enemies=W.enemies.slice(0,3).map(e=>{e.dead=false;e.hp=e.maxHp=99999;e.atkV=0;e.ms=0;return e;});
  W.enemies.forEach((e,i)=>{ e.x=P.x+Math.cos(i*2)*4.2; e.y=P.y+Math.sin(i*2)*4.2; });
  stickDx=0; stickDy=0;`);
/* 揺らぎで敵の周りを少し動くのは意図した挙動なので、間合いは完全には一定にならない。
   立ち位置の目標が揺れるぶん、追いかける側に 0.7 マス前後の遅れが出る。
   ここで捕まえたいのは周回・往復（数マス規模でぶれる）なので、1マスを境にする。 */
R.fighting.calm = R.fighting.flipRate < 0.05 && R.fighting.keepSpread < 1.0;

// 1-d. 追従と交戦の境目（ここが往復の温床だった）
R.leashBand = await shake('往復帯', PARTY + `
  W.enemies.forEach(e=>{e.dead=true});
  const e=W.enemies[0]; e.dead=false; e.hp=e.maxHp=99999; e.atkV=0; e.ms=0;
  e.x=P.x+4.3; e.y=P.y; W.enemies=[e];
  stickDx=0; stickDy=0;`);
R.leashBand.settled = R.leashBand.flipRate < 0.05 && R.leashBand.keepSpread < 1.0;

/* ================= 2. 立ち位置が決まる（周回しない） ================= */

// 2-a. 囲む角度は主人公基準。自分基準だと毎フレーム測り直して永久に周回する
R.orbit = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=22;
  S.hero.str=26;S.hero.dex=26;S.hero.vit=26;
  startRun(10); S.hero.party=[]; W.ores.length=0;
  for(let i=0;i<3;i++){ const a=makeAlly(10,S.hero); a.x=P.x+rf(-0.4,0.4); a.y=P.y+rf(-0.4,0.4);
    a.slot=i; uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
  W.enemies.forEach(e=>{e.dead=true});
  const e=W.enemies[0]; e.dead=false; e.hp=e.maxHp=99999; e.atkV=0; e.ms=0;
  e.x=P.x+4.3; e.y=P.y; W.enemies=[e];
  stickDx=0; stickDy=0;
  stepSim(2.5);
  const ang=a=>Math.atan2(a.y-e.y, a.x-e.x);
  const a0=livingParty().map(ang);
  const dp0=livingParty().map(a=>Math.hypot(a.x-P.x,a.y-P.y));
  stepSim(2.5);
  const a1=livingParty().map(ang);
  const dp1=livingParty().map(a=>Math.hypot(a.x-P.x,a.y-P.y));
  const swept=a0.map((v,i)=>+Math.abs(((a1[i]-v+Math.PI*3)%(Math.PI*2))-Math.PI).toFixed(2));
  return {swept, dpFirst:dp0.map(v=>+v.toFixed(2)), dpLater:dp1.map(v=>+v.toFixed(2)),
          leash:+ALLY_LEASH.toFixed(2),
          // 2.5 秒経っても敵の周りをほとんど回っていない＝立ち位置が決まっている
          holdsPosition: swept.every(v=>v<0.35),
          // 立ち位置はリードの内側に収まっている
          insideLeash: dp1.every(v=>v<=ALLY_LEASH+0.6),
          modes:livingParty().map(a=>a.mode)};
});

// 2-b. 交戦と追従を往復しない
R.modeStable = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=22;
  S.hero.str=26;S.hero.dex=26;S.hero.vit=26;
  startRun(10); S.hero.party=[]; W.ores.length=0;
  for(let i=0;i<3;i++){ const a=makeAlly(10,S.hero); a.x=P.x+rf(-0.4,0.4); a.y=P.y+rf(-0.4,0.4);
    a.slot=i; uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
  W.enemies.forEach(e=>{e.dead=true});
  const e=W.enemies[0]; e.dead=false; e.hp=e.maxHp=99999; e.atkV=0; e.ms=0;
  e.x=P.x+4.3; e.y=P.y; W.enemies=[e];
  stickDx=0; stickDy=0;
  stepSim(1.8);
  let changes=0, n=0;
  const prev=livingParty().map(a=>a.mode);
  // 元は 50ms ごとの標本。同じ密度になるよう 3 フレームに 1 回だけ数える。
  stepSim(4, {after:(t,i)=>{
    if(i%3) return;
    livingParty().forEach((a,k)=>{ n++; if(a.mode!==prev[k]){ changes++; prev[k]=a.mode; } });
  }});
  return {changes, samples:n, hysteresis:ALLY_FOLLOW_DIST+' → '+(ALLY_FOLLOW_DIST*1.6).toFixed(2),
          noPingPong: changes<=2};
});

/* ================= 3. ついてくる ================= */

// 3-a. 走り回っても離れず、止まれば手元に戻る
R.follow = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25;
  S.hero.str=29;S.hero.dex=29;S.hero.vit=29;
  startRun(30); S.hero.party=[]; W.enemies=[]; W.ores.length=0;
  for(let i=0;i<3;i++){ const a=makeAlly(30,S.hero); a.x=P.x; a.y=P.y;
    a.slot=i; uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
  let worst=0;
  // 元は 50ms ごとの疑似入力。同じ軌道になるよう、経過時間から同じ式で入力を作る。
  stepSim(9, {
    each:(t)=>{ stickDx=Math.cos(t*0.55); stickDy=Math.sin(t*0.9); },
    after:()=>{ livingParty().forEach(a=>{ worst=Math.max(worst, Math.hypot(a.x-P.x,a.y-P.y)); }); }
  });
  stickDx=0; stickDy=0;
  const moving=livingParty().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1));
  stepSim(1.5);
  const finals=livingParty().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1));
  return {worstGap:+worst.toFixed(1), whileMoving:moving, finalGaps:finals,
          allPresent:livingParty().length===3,
          keepsUp: worst<6, regroups: finals.every(d=>d<3)};
});

// 3-b. 視線が切れても足跡から辿り直せる（角を曲がったとき）
//     ループを止めたまま主人公だけを歩かせて、確実に視線が切れる状況を作る。
R.corner = await pg.evaluate(async ()=>{
  /* 見たいのは「角を曲がって視線が切れても、足跡を辿って戻ってこられるか」。
     **特定の地図に頼らない。** 層の間取りを触るたびに落ちるのでは検証にならない。
     視線が切れるところまで歩けた階が見つかるまで、階を引き直す。 */
  const setup = ()=>{
    S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25; S.hero.str=29;S.hero.dex=29;S.hero.vit=29;
    startRun(30); S.hero.party=[]; W.enemies=[]; W.ores.length=0;
    for(let i=0;i<3;i++){ const a=makeAlly(30,S.hero); a.x=P.x; a.y=P.y;
      a.slot=i; uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
    stepSim(0.8);
  };
  const walkAway = ()=>{
    const target = W.fl.rooms
      .map(r=>({x:r.cx+0.5, y:r.cy+0.5}))
      .filter(t=>Math.hypot(t.x-P.x,t.y-P.y)>10 && !losClear(P.x,P.y,t.x,t.y))
      .sort((a,b)=>Math.hypot(b.x-P.x,b.y-P.y)-Math.hypot(a.x-P.x,a.y-P.y))[0];
    if(!target) return 0;
    let moved=0, detour=0;
    for(let i=0;i<4000;i++){
      const dx=target.x-P.x, dy=target.y-P.y, d=Math.hypot(dx,dy);
      if(d<0.6) break;
      const base=Math.atan2(dy,dx);
      let stepped=false;
      for(const rot of [0, detour, -detour, detour*2, -detour*2, Math.PI/2, -Math.PI/2]){
        const bx=P.x, by=P.y;
        moveEnt(P, Math.cos(base+rot)*0.07, Math.sin(base+rot)*0.07);
        if(Math.hypot(P.x-bx,P.y-by) > 0.02){ moved+=0.07; stepped=true; detour=0.5; break; }
      }
      if(!stepped) detour += 0.4;
      pushTrail();
    }
    return moved;
  };

  let tries=0, moved=0, blocked=[false];
  const keep=S.screen;
  do{
    tries++;
    setup();
    S.screen='bag';                       // ループを止めて、主人公だけ歩かせる
    moved = walkAway();
    blocked = party().map(a=>!losClear(a.x,a.y,P.x,P.y));
  }while(!blocked.some(Boolean) && tries<15);

  const start = party().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1));
  S.screen=keep; last=performance.now();

  stepSim(9);
  return {tries, walked:+moved.toFixed(1), losBlocked:blocked, startGaps:start,
          trail:W.trail.length,
          losGotBlocked: blocked.some(Boolean),
          finalGaps:livingParty().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1)),
          crumbs:livingParty().map(a=>a.crumb),
          onFloor:livingParty().every(a=>W.fl.g[Math.floor(a.y)][Math.floor(a.x)]!==T.WALL),
          allBack: livingParty().every(a=>Math.hypot(a.x-P.x,a.y-P.y)<3)};
});

// 3-c. 足跡が壊れていても立ち尽くさない（最後の保険）
R.strandedRecovers = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25; startRun(20);
  S.hero.party=[]; W.enemies=[]; W.ores.length=0;
  const a=makeAlly(20,S.hero); a.hpNow=allyStats(a).maxHp*99;
  S.hero.party.push(a);
  // 遠くの床へ主人公だけ飛ばし、足跡も潰す（最悪の状況）
  let far=null;
  for(let y=1;y<W.fl.H-1 && !far;y++) for(let x=1;x<W.fl.W-1;x++){
    if(W.fl.g[y][x]!==T.WALL && Math.hypot(x-P.x,y-P.y)>10){ far={x:x+0.5,y:y+0.5}; break; }
  }
  if(!far) return {skipped:true, recovered:true};
  P.x=far.x; P.y=far.y; W.trail=[{x:P.x,y:P.y}];
  const start=Math.hypot(a.x-P.x, a.y-P.y);
  stepSim(6);
  const end=Math.hypot(a.x-P.x, a.y-P.y);
  return {startGap:+start.toFixed(1), endGap:+end.toFixed(1),
          onFloor: W.fl.g[Math.floor(a.y)][Math.floor(a.x)]!==T.WALL,
          recovered: end < 4};
});

/* ================= 4. 未踏の階層では階段が見えない ================= */

// 4-a. 未踏では隠れ、踏破済みでは最初から見える
R.stairHidden = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1;
  startRun(1);
  P.x=W.fl.start.cx+0.5; P.y=W.fl.start.cy+0.5;
  W.seen.forEach(r=>r.fill(0));
  const fresh = stairRevealed();
  const hint0 = stairHint();
  S.deepest=40; enterFloor(3); W.seen.forEach(r=>r.fill(0));
  const known = stairRevealed();
  S.deepest=1;
  return {hiddenAtFrontier:!fresh, revealedWhenKnown:known, hint0, margin:KNOWN_MARGIN,
          hiddenOnFrontier: fresh===false,
          shownWhenKnown:  known===true,
          noHintAtStart:   hint0===0};
});

// 4-b. 自分の目で見つけたら出る（霧が開く／近づく）
R.stairFound = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(1);
  W.seen.forEach(r=>r.fill(0));
  P.x=W.fl.start.cx+0.5; P.y=W.fl.start.cy+0.5;
  const before=stairRevealed();
  // 霧が開いた場合
  W.seen[Math.floor(W.fl.stair.y)][Math.floor(W.fl.stair.x)]=1;
  const bySight=stairRevealed();
  // 近づいた場合
  W.seen.forEach(r=>r.fill(0));
  const hidden2=stairRevealed();
  P.x=W.fl.stair.x+1.2; P.y=W.fl.stair.y;
  const byProximity=stairRevealed();
  return {hiddenAtStart:!before, bySight, hiddenAgain:!hidden2, byProximity,
          revealsOnSight: before===false && bySight===true,
          revealsUpClose: hidden2===false && byProximity===true};
});

// 4-c. 気配は時間で出て、時間で濃くなる（迷い続けない）
R.stairHint = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(1);
  W.seen.forEach(r=>r.fill(0));
  P.x=W.fl.start.cx+0.5; P.y=W.fl.start.cy+0.5;
  if(Math.hypot(W.fl.stair.x-P.x, W.fl.stair.y-P.y)<4){ P.x=W.fl.start.cx+0.5; }
  const at=t=>{ S.run.ft=t; return +stairHint().toFixed(2); };
  const seq={t0:at(0), t20:at(20), t39:at(39), t41:at(41), t50:at(50), t60:at(60), t120:at(120)};
  S.run.ft=0;
  return {after:STAIR_HINT_AFTER, full:STAIR_HINT_FULL, seq,
          silentEarly: seq.t0===0 && seq.t20===0 && seq.t39===0,
          appears:     seq.t41>0,
          strengthens: seq.t50>seq.t41 && seq.t60>seq.t50,
          capped:      seq.t120===1 && seq.t60===1};
});

// 4-d. 実プレイで、気配が出るまで隠れ続け、着いたら開く
R.stairLive = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=24;
  S.hero.str=28;S.hero.dex=28;S.hero.vit=28;
  S.deepest=1; startRun(1); S.hero.party=[];
  W.enemies.length=0; W.ores.length=0;
  W.seen.forEach(r=>r.fill(0));
  const t0=S.run.ft;
  const shown0=stairRevealed();
  S.run.ft=STAIR_HINT_AFTER+5;                 // 気配が出る時刻まで進める
  const hinted=stairHint()>0, stillHidden=!stairRevealed();
  let drawFails=[];
  try{ for(let k=0;k<3;k++){ draw(); } }catch(e){ drawFails.push('hint:'+e.message); }
  // 階段まで歩いて行けば開く
  P.x=W.fl.stair.x; P.y=W.fl.stair.y;
  stepSim(0.2);
  const opened=stairRevealed();
  try{ for(let k=0;k<3;k++){ draw(); } }catch(e){ drawFails.push('found:'+e.message); }
  const promptShown=document.getElementById('prompt').style.display==='block';
  S.deepest=1;
  return {t0, hiddenAtStart:!shown0, hinted, stillHidden, opened, promptShown, drawFails,
          ok: shown0===false && hinted && stillHidden && opened && drawFails.length===0};
});

// 4-e. ボス階でも壊れない（封鎖表示は見つけたあとに出る）
R.stairBoss = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(5);
  W.seen.forEach(r=>r.fill(0));
  const fails=[];
  try{ draw(); drawMinimap(); }catch(e){ fails.push('hidden:'+e.message); }
  W.seen.forEach(r=>r.fill(1));
  try{ draw(); drawMinimap(); }catch(e){ fails.push('seen:'+e.message); }
  return {bossAlive:S.run.bossAlive, failures:fails, ok:fails.length===0};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
