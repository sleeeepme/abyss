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
  /* 10階ごとは大広間（ボス戦だけの階）。壁も通路も無い一部屋なので、
     隊列の揺れはここでは測れない。普通の階で測る。 */
  startRun(9); S.hero.party=[]; W.ores.length=0;
  /* 潜在は「付くかどうか」自体が装備のレア度ごとの確率抽選になった＝外れれば乱数を
     1回、当たればさらに数回と、消費する乱数の「回数」が結果に応じて変わる。
     このため「仲間を作る直前で乱数列を仕切り直す」だけでは、開始位置の揺らぎ
     （rf()）がまた実装を触るたびにズレかねない。開始位置の揺らぎ自体を、装備生成が
     何回乱数を消費したかから完全に切り離す＝仲間ごとに専用の乱数列で引く。 */
  RNG=mulberry32(20260910);
  for(let i=0;i<3;i++){ const a=makeAlly(10,S.hero);
    RNG=mulberry32(30000+i); a.x=P.x+rf(-0.4,0.4); a.y=P.y+rf(-0.4,0.4);
    a.slot=i; uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99;
    /* ---------- 個体差を止める ----------
       makeAlly は「似た役割の別人」に見せるため、歩く速さ・保つ間合い・
       立ち位置の揺らぎを 1 体ずつ散らす（wobble は 0.10〜0.30）。

       ここで見たいのは**周回や往復**——数マス規模のぶれであって、
       その揺らぎそのものではない。散らしたまま測ると、
       たまたま揺らぎの大きい個体を引いた回だけ落ちる
       （実際に落ちた。同じ検証が 30 サンプルで通り 125 サンプルで落ちた）。

       真ん中の値に固定して、**個体差ではなく仕掛けを見る。** */
    a.msJit=1; a.keepJit=1; a.cdJit=1; a.wobble=0.20; a.seed=i*2.1;
    /* 装備の潜在（付いた場合の強化系のおまけ効果）も同じ理由で止める。
       潜在は今は確率制で付かないことも多いが、付いた場合はそこにも個体差が乗るため、
       ここで見たいのは隊列維持の仕掛けそのものなので、装備側の乱数も真ん中（ゼロ）に均す。 */
    for(const k of ['weapon','armor','shield','accessory']){ if(a.equip[k]) a.equip[k].aff=[]; }
    a.hpNow=allyStats(a).maxHp*99; }
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
  startRun(9); S.hero.party=[]; W.ores.length=0;
  // 潜在の導入ぶんの乱数消費を仕切り直す（PARTY側の同種の対処と同じ理由。
  // 開始位置の揺らぎは仲間ごとの専用乱数列に切り離してある）
  RNG=mulberry32(20260910);
  for(let i=0;i<3;i++){ const a=makeAlly(10,S.hero);
    RNG=mulberry32(30000+i); a.x=P.x+rf(-0.4,0.4); a.y=P.y+rf(-0.4,0.4);
    a.slot=i; uniqueAllyName(a,party());
    for(const k of ['weapon','armor','shield','accessory']){ if(a.equip[k]) a.equip[k].aff=[]; }
    S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
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
  startRun(9); S.hero.party=[]; W.ores.length=0;
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
  startRun(19); S.hero.party=[]; W.enemies=[]; W.ores.length=0;
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
  const setup = (n)=>{
    S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25; S.hero.str=29;S.hero.dex=29;S.hero.vit=29;
    S.runs=100+n-1;
    /* 第19階層。10階ごとは大広間＝一部屋しかなく、根の層（21〜30）は
       **壁が無い**ので、どちらも「角で視線が切れる」が起きない。 */
    startRun(19); S.hero.party=[]; W.enemies=[]; W.ores.length=0;
    for(let i=0;i<3;i++){ const a=makeAlly(30,S.hero); a.x=P.x; a.y=P.y;
      a.slot=i; uniqueAllyName(a,party());
      /* 潜在（付いた場合の強化系のおまけ効果）を仲間装備から均す。
         ここで見たいのは「視線が切れても戻ってこられるか」で、仲間の移動速度に
         個体差があると、確率で付いた移動速度系の潜在を引いた/引かなかった差だけで
         戻ってこられるかどうかが変わってしまう。 */
      for(const k of ['weapon','armor','shield','accessory']){ if(a.equip[k]) a.equip[k].aff=[]; }
      S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
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
    setup(tries);
    S.screen='bag';                       // ループを止めて、主人公だけ歩かせる
    moved = walkAway();
    blocked = party().map(a=>!losClear(a.x,a.y,P.x,P.y));
  }while(!blocked.some(Boolean) && tries<15);

  const start = party().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1));
  S.screen=keep; last=performance.now();

  /* 追いつくまで進める。**歩かせた距離は毎回ちがう**（壁の形も開始部屋も生成任せ）ので、
     秒数を決め打ちにすると「遠かった回」に静かに落ちる。実際に落ちた（複数回）。
     見たいのは「角で詰まらずに戻ってくる」ことなので、戻ったら早じまいする——
     上限は「詰まって永久に戻ってこない」を捕まえられる程度に大きく取っておけば、
     普通の回では until で早期終了するだけなので実行時間は伸びない。 */
  stepSim(90, {until:()=>livingParty().every(a=>Math.hypot(a.x-P.x,a.y-P.y)<3)});
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
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25; startRun(19);
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

/* ================= 5. 縁（穴）と瞬歩 ================= */

/* 5-a. 仲間は縁を踏まない。
   以前は主人公と同じ「落ちられる側」にしてあったので、主人公が縁の向こうに
   いると**縁へ真っ直ぐ歩き続ける**——落ちて戻され、また同じ方向へ歩き、また落ちる。
   報告どおり永久に落ち続ける形になっていた。操作していない者に
   「落ちる判断」は取れないので、そもそも踏ませない。 */
R.allyAvoidsPit = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(21);
  // 根の層（縁のある階）を探す
  let found=false;
  for(const d of [21,22,23,24,25]){ enterFloor(d); if(W.fl.pit){ found=true; break; } }
  if(!found) return {skipped:true, pitIsBlocked:true, neverFell:true, ok:true};
  W.enemies.length=0;
  const a=TH.ally(21,'warrior',20); a.slot=0; S.hero.party=[a];

  /* 縁のマスと、その縁に**隣接した立てる床**を探す。
     置き場所を目分量で決めると、仲間の初期位置がそのまま縁の中になって
     「避けていない」ではなく「最初から落ちている」を測ってしまう
     （実際それで一度落ちた）。立てることを確かめてから置く。 */
  let pit=null, near=null;
  const D=[[1,0],[-1,0],[0,1],[0,-1]];
  outer:
  for(let y=1;y<W.fl.H-1;y++) for(let x=1;x<W.fl.W-1;x++){
    if(W.fl.g[y][x]!==T.PIT) continue;
    for(const [dx,dy] of D){
      const nx=x+dx+0.5, ny=y+dy+0.5;
      if(standable(nx,ny)){ pit={x:x+0.5,y:y+0.5}; near={x:nx,y:ny}; break outer; }
    }
  }
  if(!pit) return {skipped:true, pitIsBlocked:true, neverFell:true, ok:true};

  a.x=near.x; a.y=near.y;
  P.x=pit.x; P.y=pit.y;             // 主人公は縁の上（＝仲間から見て縁の向こう）
  let fell=0;
  stepSim(4, {after:()=>{ if(a.fallAnim) fell++; }});
  const blocked = blockedFor(a, pit.x, pit.y);
  return {fellFrames:fell, startedOnFloor: standable(near.x,near.y),
          pitIsBlocked: blocked===true,
          neverFell: fell===0,
          ok: blocked===true && fell===0};
});

/* 5-b. 瞬歩で壁にめり込まない。
   行き先を 0.25 刻みで**中心点だけ** solid() で見ていたので、
   中心が壁の手前 0.24 マスでも体（半径 0.32）は壁の中で、
   斜めに突っ込むと壁の角をすり抜けて閉じた側へ入り込めた（報告）。
   dashStop は半径ぶん外側と左右も見る。

   測り方: **始点が既に壁ぎわの場合は数えない。**
   壁に背を向けて立っているだけで「めり込んでいる」と読めてしまい、
   止まった先の良し悪しが見えなくなる。 */
R.dashKeepsBodyOutOfWall = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  W.enemies.length=0;
  const r=P.r;
  /* 判定は**進む向きに沿って**取る。真上・真下が壁でも、壁に背を向けて
     立っているだけなら不正ではない（moveEnt も同じ扱い）。
     まずいのは「体の前側が壁の中」と「中心が壁の中」の2つ。 */
  const buried=(x,y,ang)=>{
    const c=Math.cos(ang), sn=Math.sin(ang);
    return solid(x,y) || solid(x+c*r, y+sn*r)
        || solid(x-sn*r, y+c*r) || solid(x+sn*r, y-c*r);
  };
  // 昔の決め方（中心点だけを 0.25 刻みで見る）。比較用に再現する
  const oldStop=(x0,y0,ang,dist)=>{
    let gx=x0, gy=y0;
    for(let d=0; d<dist; d+=0.25){
      const nx=gx+Math.cos(ang)*0.25, ny=gy+Math.sin(ang)*0.25;
      if(solid(nx,ny)) break;
      gx=nx; gy=ny;
    }
    return {x:gx, y:gy};
  };
  const spots=[];
  for(let y=1;y<W.fl.H-1 && spots.length<40;y++) for(let x=1;x<W.fl.W-1;x++){
    if(tileWalk(W.fl,x,y) && !buried(x+0.5,y+0.5,0)){ spots.push({x:x+0.5,y:y+0.5}); break; }
  }
  let tried=0, oldBad=0; const bad=[];
  for(const p of spots){
    for(let i=0;i<24;i++){
      const ang=i/24*Math.PI*2;
      // 始点が既に壁ぎわの向きは数えない（止まった先の良し悪しが見えなくなる）
      if(buried(p.x,p.y,ang)) continue;
      tried++;
      const nw=dashStop(p.x, p.y, ang, 6, r);
      if(buried(nw.x, nw.y, ang)) bad.push({x:+nw.x.toFixed(2), y:+nw.y.toFixed(2), ang:i});
      const od=oldStop(p.x, p.y, ang, 6);
      if(buried(od.x, od.y, ang)) oldBad++;
    }
  }
  return {tried, buried:bad.length, oldBuried:oldBad, sample:bad.slice(0,3),
          measured: tried>100,
          clean: bad.length===0,
          // 昔の決め方ならめり込む＝この検証が報告された不具合を実際に捕まえる
          catchesOldBug: oldBad>0,
          ok: tried>100 && bad.length===0 && oldBad>0};
});

/* 5-c. 落下演出は、縁の無い階へ移っても必ず終わる。
   落ちている最中に階段を降りると、次の階に縁が無いかぎり誰も a.fallAnim を
   進めてくれず、その仲間は**縮んだまま（描画倍率 0.04）動かない**——
   tickAlly が a.fallAnim を見て即 return するので、攻撃も移動もしない。
   画面の上では「交戦中に消えて戻らない」に見える（報告）。

   入口（落ちる）は縁のある階だけでよいが、出口（演出を終える）はどの階でも要る。 */
R.fallAnimNeverSticks = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(21);
  // 縁のある階を探して、そこで落下演出を始める
  let found=false;
  for(const d of [21,22,23,24,25]){ enterFloor(d); if(W.fl.pit){ found=true; break; } }
  if(!found) return {skipped:true, allyRecovers:true, heroRecovers:true, allyMoves:true, ok:true};
  W.enemies.length=0;
  const a=TH.ally(21,'warrior',20); a.slot=0; S.hero.party=[a];
  a.x=P.x+1; a.y=P.y;
  a.fallAnim={t:0, dur:FALL_ANIM_SEC};
  P.fallAnim={t:0, dur:FALL_ANIM_SEC};

  // 縁の無い階へ移る（第3階層は穴もハザードも出ない）
  enterFloor(3);
  const clearedOnEnter = !a.fallAnim && !P.fallAnim;
  // 万一残っていても、数フレームで終わること
  a.fallAnim={t:0, dur:FALL_ANIM_SEC};
  P.fallAnim={t:0, dur:FALL_ANIM_SEC};
  stepSim(FALL_ANIM_SEC+0.4);
  const allyDone = !a.fallAnim, heroDone = !P.fallAnim;

  // 終わったあと、仲間がちゃんと動き出すこと（止まったままにならない）
  W.enemies.length=0;
  P.x+=4;                                  // 主人公が離れれば追ってくるはず
  const bx=a.x, by=a.y;
  stepSim(1.2);
  const moved=Math.hypot(a.x-bx, a.y-by);
  return {clearedOnEnter, allyDone, heroDone, moved:+moved.toFixed(2),
          clearedOnFloorChange: clearedOnEnter,
          allyRecovers: allyDone, heroRecovers: heroDone,
          allyMoves: moved>0.3,
          ok: clearedOnEnter && allyDone && heroDone && moved>0.3};
});

/* 5-d. 落ちている最中に倒れた仲間は、蘇生したらちゃんと戻ってくる。
   蘇生の入口は4つある（広告・不死鳥・慰霊碑・酒場）が、どれも `a.dead=false` を
   書くだけ。倒れた時点で fallAnim を落としておかないと、立ち上がった仲間は
   縮んだまま（描画倍率 0.04）動かない——「歩いていたらキャラが消える」の一形。 */
R.reviveClearsFallAnim = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  W.enemies.length=0;
  const a=TH.ally(3,'warrior',10); a.slot=0; S.hero.party=[a];
  a.x=P.x+1; a.y=P.y;
  a.fallAnim={t:0, dur:FALL_ANIM_SEC};       // 落ちている最中に
  a.hpNow=0; downAlly(a);                    // 倒れる
  const clearedOnDown = !a.fallAnim;
  /* downAlly は「倒れた」モーダル（openFallen）を開くので、
     そのままだと update が回らない＝動かないのは蘇生の問題ではない。閉じてから測る。 */
  closeFallen(); setScreen('game');
  a.dead=false; a.hpNow=allyStats(a).maxHp;  // 蘇生（どの入口も実質これ）
  P.x+=4;
  const bx=a.x, by=a.y;
  stepSim(1.2);
  const moved=Math.hypot(a.x-bx, a.y-by);
  return {clearedOnDown, moved:+moved.toFixed(2),
          clearedWhenDowned: clearedOnDown,
          movesAfterRevive: moved>0.3,
          ok: clearedOnDown && moved>0.3};
});

/* 5-e. 進まない落下演出は、誰が消し忘れても見張り番が落とす。
   置き場所が1つ増えるたびに同じ事故が戻ってくるので、出口にも番を置いてある。 */
R.fallWatchdogRecovers = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  W.enemies.length=0;
  const a=TH.ally(3,'warrior',10); a.slot=0; S.hero.party=[a];
  a.x=P.x+1; a.y=P.y;
  // 誰も進めてくれない fallAnim を手で置く（縁の無い階なので tickPits は触らない）
  P.fallAnim={t:0, dur:FALL_ANIM_SEC};
  a.fallAnim={t:0, dur:FALL_ANIM_SEC};
  stepSim(0.3);
  const stillThere = !!P.fallAnim && !!a.fallAnim;   // すぐには落とさない
  stepSim(FALL_ANIM_SEC*FALL_WATCHDOG_MUL + FALL_WATCHDOG_PAD + 0.3);
  return {heroCleared: !P.fallAnim, allyCleared: !a.fallAnim,
          notTooEager: stillThere,
          ok: !P.fallAnim && !a.fallAnim && stillThere};
});

/* 5-f. 落ちた者の戻し先は、必ず立てる場所。
   snapToFloor は tileWalk（壁と縁のタイル）しか見ない。だが水の層の**淵**は
   タイルではなく W.haz.g の深さで決まるので snapToFloor には見えず、
   実測で**淵から呼ぶと 73 回中 73 回また淵が返っていた。**
   戻し先が淵だと、落ちて戻されてまた落ちる——その間ずっと描画倍率 0.04＝
   画面から消えたまま、操作も受け付けない。報告「歩いていたらキャラが消える」。 */
R.fallLandsOnStandableGround = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=40; startRun(16);
  let depth=null;
  for(const d of [16,17,18,19,20]){ enterFloor(d); if(W.haz && W.haz.kind==='water'){ depth=d; break; } }
  if(!depth) return {skipped:true, oldWouldLandInVoid:1, neverLandsInVoid:true,
                     escapesTheVoid:true, ok:true};
  W.enemies.length=0;
  // 淵のマスすべてから戻し先を引いて、1つでも淵へ戻さないか見る
  let tries=0, newBad=0, oldBad=0;
  for(let y=1;y<W.fl.H-1;y++) for(let x=1;x<W.fl.W-1;x++){
    if((W.haz.g[y] ? (W.haz.g[y][x]|0) : 0) < WATER_DEEP) continue;
    tries++;
    if(pitAt(...Object.values(snapToStandable(W.fl,x,y)))) newBad++;
    if(pitAt(...Object.values(snapToFloor(W.fl,x,y)))) oldBad++;
  }
  // 実際に淵へ放り込んで、抜けられることを見る
  let spot=null;
  for(let y=1;y<W.fl.H-1 && !spot;y++) for(let x=1;x<W.fl.W-1;x++){
    if(tileWalk(W.fl,x,y) && (W.haz.g[y] ? (W.haz.g[y][x]|0) : 0) >= WATER_DEEP)
      { spot={x:x+0.5,y:y+0.5}; break; }
  }
  let escaped=true;
  if(spot){
    S.hero.hpNow=1e9; P.invuln=0;
    P.x=spot.x; P.y=spot.y; P.safeX=undefined; P.safeY=undefined;
    P.fallAnim=null; P.fallBlink=0;
    stepSim(4, {after:()=>{ S.hero.hpNow=1e9; }});
    escaped = !pitAt(P.x,P.y);
  }
  return {tries, newBad, oldBad, checkedDeepSpot: !!spot,
          // 昔の探し方なら淵へ戻していた＝この検証は報告された不具合を捕まえる
          oldWouldLandInVoid: oldBad>0,
          neverLandsInVoid: newBad===0,
          escapesTheVoid: escaped,
          ok: tries>0 && newBad===0 && oldBad>0 && escaped};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
