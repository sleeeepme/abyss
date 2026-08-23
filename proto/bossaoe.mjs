// ボスの大型化と範囲攻撃
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ============ 1. 大きさ ============ */

// 1-a. ティアごとに明確に大きく、通常敵とは別格の見た目半径
R.size = await pg.evaluate(()=>{
  const out={};
  [[5,'mid'],[10,'great'],[50,'final']].forEach(([d,tier])=>{
    RNG=mulberry32(d*7919);
    const fl=genFloor(d);
    const boss=spawnEnemies(fl,d).find(e=>e.boss);
    out[tier]={r:boss.r, cr:boss.cr, tier:boss.tier};
  });
  RNG=mulberry32(999);
  const trash=spawnEnemies(genFloor(10),10).find(e=>!e.boss && !e.elite && !e.uniq);
  return {bosses:out, trashR:trash.r,
          midBigger:  out.mid.r   > trash.r*2,
          greatBigger:out.great.r > out.mid.r,
          finalBiggest:out.final.r> out.great.r,
          ratioFinal: +(out.final.r/trash.r).toFixed(1)};
});

// 1-b. 壁との判定は小さいまま（通路 2 マスを通れる）
R.collide = await pg.evaluate(()=>{
  RNG=mulberry32(50*7919);
  const fl=genFloor(50);
  const boss=spawnEnemies(fl,50).find(e=>e.boss);
  return {r:boss.r, cr:boss.cr, cap:BOSS_COLLIDE_MAX,
          cappedForCorridors: boss.cr<=BOSS_COLLIDE_MAX && boss.cr<boss.r,
          moveUsesCr: (()=>{
            // moveEnt が cr を見ているか: 見た目半径だと壁に埋まって動けない
            W.fl=fl;
            const before={x:boss.x,y:boss.y};
            let moved=0;
            for(let i=0;i<200;i++){
              const bx=boss.x, by=boss.y;
              moveEnt(boss, 0.05, 0.02);
              if(boss.x!==bx || boss.y!==by) moved++;
            }
            boss.x=before.x; boss.y=before.y;
            return moved>0;
          })()};
});

// 1-c. 大ボスが実プレイで実際に移動できる（部屋に閉じ込められない）
R.mobility = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(50); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.atkV=0;
  /* 溜め中は動かない（避ける時間を保証するため）。
     ここで見たいのは「技を撃っていないボスが歩くか」なので、
     技の間隔を空けてから測る。8つも技を持つ相手だと、
     待っているあいだにキャストが挟まって測定にならない。 */
  boss.moveCd=99; boss.cast=null;
  const p0={x:boss.x,y:boss.y};
  /* 索敵距離はアーキタイプごとに違う（据え置き型は 6 しかない）。
     7 マス決め打ちだと、そのアーキタイプを引いた回だけ
     「気づいていないので動かない」で落ちる。相手の索敵の内側に立つ。 */
  P.x=boss.x+Math.max(2.5, boss.arch.aggro-1.5); P.y=boss.y;
  stepSim(2.5);
  const moved=Math.hypot(boss.x-p0.x, boss.y-p0.y);
  return {moved:+moved.toFixed(2), ok: moved>0.5};
});

/* ============ 2. 技のセット ============ */

R.moveset = await pg.evaluate(()=>{
  const mk=(depth)=>{ RNG=mulberry32(depth*7919);
    return spawnEnemies(genFloor(depth),depth).find(e=>e.boss); };
  const mid=mk(5), great=mk(10), fin=mk(50);
  /* 技のセットは**ティアではなくボスごと**に決まるようになった。
     「大ボスなら散弾を持つ」といった横並びの前提はもう置けない
     （置いた瞬間に、名前だけ違う同じボスに戻る）。
     代わりに「どのボスも複数の技を持ち、主が一番多い」を見る。 */
  return {mid:mid.moves, great:great.moves, final:fin.moves,
          midHasAoe:   mid.moves.length>=2,
          greatHasMore: great.moves.length>=2,
          finalHasWave:  fin.moves.includes('wave'),
          finalIsRichest: fin.moves.length>=great.moves.length
                       && fin.moves.length>mid.moves.length,
          allDefined: [...mid.moves,...great.moves,...fin.moves].every(m=>!!BOSS_MOVES[m])};
});

// 2-b. 激昂で技が増える
R.rageMoves = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(5); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss); boss.atkV=0;
  const before=[...boss.moves];
  boss.hp=boss.maxHp*0.4;
  bossRage(boss);
  return {before, after:[...boss.moves], raged:boss.rage,
          gainedNew: boss.moves.length>before.length,
          faster: boss.teleMul<1,
          ok: boss.rage===true && boss.moves.length>before.length};
});

/* ============ 3. 予兆と当たり判定が一致する ============ */

// 3-a. 叩きつけ: 予兆円の内側だけが当たる
R.slam = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const m=BOSS_MOVES.slam, R2=m.rad+boss.r;
  const probe=(dist)=>{
    S.hero.hpNow=stats(S.hero).maxHp;
    P.x=boss.x+dist; P.y=boss.y; P.guard=false;
    boss.cast={id:'slam', t:0, max:m.tele, dir:0};
    const hp0=S.hero.hpNow;
    resolveBossMove(boss);
    boss.cast=null;
    return hp0-S.hero.hpNow;
  };
  return {radius:+R2.toFixed(2),
          inside: probe(R2*0.5)>0,
          edge:   probe(R2*0.9)>0,
          outside:probe(R2*1.6)===0,
          farSafe:probe(R2*3)===0};
});

// 3-b. 薙ぎ払い: 正面だけ当たる。真横・背後は当たらない。
R.cleave = await pg.evaluate(()=>{
  const boss=W.enemies.find(e=>e.boss);
  const m=BOSS_MOVES.cleave, R2=m.rad+boss.r, half=m.arc*Math.PI/180;
  const probe=(ang, dist)=>{
    S.hero.hpNow=stats(S.hero).maxHp;
    P.x=boss.x+Math.cos(ang)*dist; P.y=boss.y+Math.sin(ang)*dist;
    boss.cast={id:'cleave', t:0, max:m.tele, dir:0};   // 正面 = +X
    const hp0=S.hero.hpNow;
    resolveBossMove(boss);
    boss.cast=null;
    return hp0-S.hero.hpNow;
  };
  return {arcDeg:m.arc, radius:+R2.toFixed(2),
          front:  probe(0, R2*0.6)>0,
          edgeIn: probe(half*0.9, R2*0.6)>0,
          side:   probe(Math.PI/2, R2*0.6)===0,
          behind: probe(Math.PI, R2*0.6)===0,
          tooFar: probe(0, R2*1.8)===0};
});

// 3-c. 波動: 輪が通り過ぎる瞬間だけ、1回だけ当たる
R.wave = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(50); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.atkV=40;
  W.enemies=[boss];
  W.fx=[];
  P.x=boss.x+4.5; P.y=boss.y; P.guard=false;
  S.hero.hpNow=stats(S.hero).maxHp;
  const hp0=S.hero.hpNow;
  boss.cast={id:'wave', t:0, max:1, dir:0};
  resolveBossMove(boss); boss.cast=null;
  const spawned=W.fx.filter(f=>f.t==='wave').length;
  boss.atkV=0; boss.moves=[];        // 以後の技を止めて波動だけ見る
  let hitCount=0, prev=S.hero.hpNow;
  stepSim(3, {after:()=>{
    if(S.hero && S.hero.hpNow<prev){ hitCount++; prev=S.hero.hpNow; }
  }, until:()=>!W.fx.some(f=>f.t==='wave')});
  const gone=!W.fx.some(f=>f.t==='wave');
  return {spawned, hitCount, gone,
          tookDamage: !!S.hero && S.hero.hpNow<hp0,
          onlyOnce: hitCount<=1,
          expires: gone};
});

// 3-d. 範囲攻撃は仲間にも当たる
R.hitsAllies = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const a=makeAlly(10,S.hero);
  a.x=boss.x+1; a.y=boss.y;
  S.hero.party.push(a);
  P.x=boss.x+40; P.y=boss.y+40;      // プレイヤーは範囲外
  const ph0=S.hero.hpNow;
  /* 仲間は回避することがある（ジョブによっては 30% 超）ので、
     1回の着弾で判定すると「たまたま避けた」だけで落ちる。
     数回撃って、一度でも通ることを確かめる。 */
  let hits=0, evaded=0;
  for(let i=0;i<12 && !a.dead;i++){
    a.hpNow=allyStats(a).maxHp;
    const before=a.hpNow;
    boss.cast={id:'slam', t:0, max:0.8, dir:0};
    resolveBossMove(boss); boss.cast=null;
    if(a.hpNow<before || a.dead) hits++; else evaded++;
  }
  return {job:a.job, evadePct:jobDef(a.job).evade, hits, evaded,
          allyGetsHit: hits>0,
          playerSafe: S.hero && S.hero.hpNow===ph0};
});

// 3-e. パリイは範囲攻撃にも効く（構えた瞬間だけ）
R.parry = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  S.hero.equip.shield=genBaseItem('round',10,1);
  const boss=W.enemies.find(e=>e.boss);
  P.x=boss.x+1; P.y=boss.y;
  const cast=()=>{ boss.cast={id:'slam',t:0,max:0.8,dir:0};
                   const hp0=S.hero.hpNow; resolveBossMove(boss); boss.cast=null;
                   return hp0-S.hero.hpNow; };
  S.hero.hpNow=stats(S.hero).maxHp;
  P.guard=true; P.guardStart=nowSec();          // 構えた瞬間
  const parried=cast();
  S.hero.hpNow=stats(S.hero).maxHp;
  P.guardStart=nowSec()-5;                      // 押しっぱなし
  const held=cast();
  P.guard=false;
  return {parriedDamage:parried, heldDamage:held,
          parryWorks: parried===0, holdStillHurts: held>0};
});

/* ============ 4. 溜め中は動かない（避ける時間の保証） ============ */
R.castFreeze = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.atkV=0;
  P.x=boss.x+2.0; P.y=boss.y;
  boss.moveCd=0;
  // 溜めが始まるまで回す
  stepSim(4, {until:()=>!!boss.cast});        // 溜めが始まるまで回す
  if(!boss.cast) return {startedCast:false};
  const p0={x:boss.x,y:boss.y};
  const move0=boss.ms;
  stepSim(0.12);
  const drift=Math.hypot(boss.x-p0.x, boss.y-p0.y);
  return {startedCast:true, drift:+drift.toFixed(3), telegraphed: boss.cast?boss.cast.max>0:false,
          frozen: drift<0.05, moveSpeed:move0};
});

/* ============ 5. 実プレイ ============ */

// 5-a. ボス階を長めに回して、全技が例外なく撃たれる
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=40;
  S.hero.str=44; S.hero.dex=44; S.hero.vit=44;
  startRun(50); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.atkV=0;                        // 検証中に殺されない
  boss.moveCd=0.2;
  // 索敵範囲の外にいるとボスは何もしない（これは正しい挙動）ので、隣に立たせる
  P.x=boss.x+2.2; P.y=boss.y;
  const seen={};
  const frames=stepSim(14, {after:()=>{
    if(boss.cast) seen[boss.cast.id]=(seen[boss.cast.id]||0)+1;
  }});
  return {ranSeconds:+(frames/60).toFixed(1),
          castsSeen:Object.keys(seen).sort(),
          castCount:Object.keys(seen).length,
          loopAlive:_tickCount>200,
          bossAlive:!boss.dead,
          usedMultiple: Object.keys(seen).length>=2};
});

// 5-b. 各ティアのボスが実際に技を撃つ
R.perTier = await pg.evaluate(async ()=>{
  const out={};
  for(const d of [5,10]){
    S.hero=newHero(); S.upg={hp:8}; startRun(d); S.hero.party=[];
    const boss=W.enemies.find(e=>e.boss);
    boss.atkV=0; boss.moveCd=0.2;
    P.x=boss.x+2; P.y=boss.y;
    const seen=new Set();
    stepSim(7, {after:()=>{ if(boss.cast) seen.add(boss.cast.id); }});
    out['d'+d]={tier:boss.tier, seen:[...seen]};
  }
  return {tiers:out,
          midCasts: out.d5.seen.length>0,
          greatCasts: out.d10.seen.length>0};
});

// 5-c. 全技を直接叩いても例外が出ない（描画込み）
R.drawAll = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(50); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.atkV=0;
  const fails=[];
  Object.keys(BOSS_MOVES).forEach(id=>{
    for(const p of [0,0.3,0.7,1]){
      try{
        boss.cast={id, t:BOSS_MOVES[id].tele*(1-p), max:BOSS_MOVES[id].tele, dir:0.6};
        drawBossCast(boss, 200, 300, TS*boss.r);
      }catch(e){ fails.push('cast '+id+'@'+p+': '+e.message); }
    }
    try{ boss.cast={id,t:0,max:0.5,dir:0}; resolveBossMove(boss); }
    catch(e){ fails.push('resolve '+id+': '+e.message); }
    boss.cast=null;
  });
  // 着弾エフェクトの描画
  try{ draw(); }catch(e){ fails.push('draw: '+e.message); }
  return {moves:Object.keys(BOSS_MOVES).length, failures:fails, ok:fails.length===0};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
