// 階段の詰み / 鍛冶場の分離 / 侵入者。
//
// 1. 階段の上に物を置かない。置いてしまうと「その階から降りられない」詰みになる。
//    実際に起きた事故なので、置き場所と interact() の順番を二重に検証する。
// 2. 鍛冶場は鉱脈から切り離す。掘った直後にその場で鍛えられてはいけない
//    （鉱石を抱えて運ぶ時間が、この仕掛けの本体なので）。
// 3. 侵入者。1回の潜りが15分を超えると現れ、仲間を無視して主人公だけを追う。
//    **階を降りても撒けない**（解除は帰還だけ）。5分ごとに強くなり、最後はこちらより速い。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ---------- 1. 置き場所が階段を避けているか ---------- */
R.place = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.shards=0;
  const bad=[]; let floors=0, ores=0, forges=0, evs=0, npcs=0;
  // 多数の階を実際に生成して、階段の近くに何か置かれた回があれば記録する。
  for(let seed=0; seed<40; seed++){
    S.runs=seed;
    for(const depth of [2,5,7,11,18,26,37]){
      TH.run(1, {seed}); TH.floor(depth);
      floors++;
      const st=W.fl.stair;
      const check=(nm,x,y)=>{
        const d=Math.hypot(st.x-x, st.y-y);
        if(d < STAIR_CLEAR) bad.push({nm, depth, seed, d:+d.toFixed(2)});
      };
      (W.ores||[]).forEach(o=>{ ores++; check('ore',o.x,o.y); });
      if(W.forge){ forges++; check('forge',W.forge.x,W.forge.y); }
      if(W.ev){ evs++; check('event',W.ev.x,W.ev.y); }
      if(W.npc){ npcs++; check('npc',W.npc.x,W.npc.y); }
    }
  }
  return {floors, ores, forges, evs, npcs, badCount:bad.length, bad:bad.slice(0,5),
          clearOfAll: bad.length===0,
          sawOres: ores>0, sawForges: forges>0, sawEvents: evs>0,
          ok: bad.length===0 && ores>0 && forges>0 && evs>0 && npcs>0};
});

/* ---------- 2. 階段の上に無理やり置いても降りられるか ----------
   置き場所の保険が破られた最悪の場合でも、interact() の順番だけで降りられること。 */
R.stairWins = await pg.evaluate(()=>{
  TH.run(1, {seed:3}); TH.floor(9);
  const st=W.fl.stair;
  // 階段のど真ん中に、干渉しうる物を全部置く
  W.ores=[{x:st.x, y:st.y, grade:ORES[0].id, n:3, mined:false, seed:0}];
  W.forge={x:st.x, y:st.y, seed:0};
  W.ev={id:EVENTS[0].id, x:st.x, y:st.y, used:false};
  W.npc=makeAlly(9, S.hero); W.npc.x=st.x; W.npc.y=st.y;
  P.x=st.x; P.y=st.y;
  S.run.bossAlive=false;
  const onst=onStair();
  interact();
  const stairsOpen = el('m-stairs').classList.contains('on');
  const mining = !!W.mine;
  const forgeOpen = el('m-forge').classList.contains('on');
  el('m-stairs').classList.remove('on');
  // 掃引は「false = 失敗」で読むので、返す真偽値は全部肯定形にする
  return {onStair:onst, stairsOpen, didNotMine:!mining, didNotForge:!forgeOpen,
          ok: onst && stairsOpen && !mining && !forgeOpen};
});

/* ---------- 3. 掘った鉱脈はもう鍛冶場ではない ---------- */
R.forgeSplit = await pg.evaluate(()=>{
  TH.run(1, {seed:4}); TH.floor(12);
  const st=W.fl.stair;
  // 階段から離れた場所に、掘り終えた鉱脈だけを置く
  const spot = pickSpot(W.fl) || {x:st.x+6, y:st.y+6};
  W.ores=[{x:spot.x, y:spot.y, grade:ORES[0].id, n:0, mined:true, seed:0}];
  W.forge=null; W.ev=null; W.npc=null;
  P.x=spot.x; P.y=spot.y;
  interact();
  const openedOnMined = el('m-forge').classList.contains('on');
  el('m-forge').classList.remove('on');
  const nearMined = !!nearOre();            // 掘り終えた鉱脈はもう「近くの鉱脈」ではない
  updateHUD();
  const promptOnMined = el('prompt').style.display!=='none' ? el('prompt').textContent : '';

  // 鍛冶場を別の場所に置けば、そちらでは開く
  const fs = pickSpot(W.fl) || {x:st.x+8, y:st.y+8};
  W.forge={x:fs.x, y:fs.y, seed:0};
  P.x=fs.x; P.y=fs.y;
  interact();
  const openedOnForge = el('m-forge').classList.contains('on');
  const title = el('fg-title').textContent;
  closeForge();
  return {minedVeinInert:!openedOnMined, minedVeinNotNear:!nearMined,
          promptOnMined, openedOnForge, title,
          ok: !openedOnMined && !nearMined && openedOnForge};
});

/* ---------- 4. 鍛冶場は鉱脈から離れて置かれる（運ぶ距離が残っているか） ---------- */
R.forgeDist = await pg.evaluate(()=>{
  S.hero=newHero();
  let n=0, tooClose=0, minD=999, atBoss=0, tooShallow=0;
  for(let seed=0; seed<60; seed++){
    S.runs=seed;
    for(const depth of [2,3,8,14,20,25,30]){
      TH.run(1, {seed}); TH.floor(depth);
      if(!W.forge) continue;
      n++;
      if(bossTierAt(depth)) atBoss++;
      if(depth < FORGE_MIN_DEPTH) tooShallow++;
      (W.ores||[]).forEach(o=>{
        const d=Math.hypot(o.x-W.forge.x, o.y-W.forge.y);
        minD=Math.min(minD,d);
        if(d < FORGE_ORE_CLEAR) tooClose++;
      });
    }
  }
  return {forges:n, tooClose, atBoss, tooShallow, minD:+minD.toFixed(2),
          ok: n>0 && tooClose===0 && atBoss===0 && tooShallow===0};
});

/* ---------- 5. 侵入者：出るまでの時間と、出たときの位置 ---------- */
R.intrSpawn = await pg.evaluate(()=>{
  TH.run(1, {seed:7}); TH.floor(14);
  const before = W.enemies.length;
  // 予兆が出るところまで時計を進める
  S.run.elapsed = INTRUDER_AFTER - INTRUDER_WARN_LEAD - 1;
  tickIntruder();
  const warnedEarly = !!S.run.intrWarned;
  S.run.elapsed = INTRUDER_AFTER - INTRUDER_WARN_LEAD + 0.5;
  tickIntruder();
  const warned = !!S.run.intrWarned;
  const spawnedAtWarn = !!liveIntruder();
  // 出現時刻へ
  S.run.elapsed = INTRUDER_AFTER + 0.1;
  tickIntruder();
  const e = liveIntruder();
  const dist = e ? Math.hypot(e.x-P.x, e.y-P.y) : -1;
  // 湧く距離は直線ではなく「歩く距離」で決めている。そちらを見る。
  const walk = (()=>{ if(!e) return -1; const f=intruderField(); if(!f) return -1;
    const gx=Math.floor(e.x), gy=Math.floor(e.y); return f[gy*W.fl.W+gx]; })();
  // 二重に湧かない
  tickIntruder(); tickIntruder();
  const count = W.enemies.filter(x=>x.intruder && !x.dead).length;
  return {before, quietBeforeLead:!warnedEarly, warned, notSpawnedAtWarn:!spawnedAtWarn,
          spawned: !!e, name: e&&e.name, dist:+dist.toFixed(1), walk, count,
          slowerThanPlayer: !!e && e.ms < stats(S.hero).ms,
          ok: !warnedEarly && warned && !spawnedAtWarn && !!e && count===1
              && walk >= INTRUDER_SPAWN_MIN && walk <= INTRUDER_SPAWN_MAX
              && e.ms < stats(S.hero).ms};
});

/* ---------- 6. 出る場所と出ない場所 ----------
   ボス戦のあいだは割り込ませない。ただし**ボス階そのものは安全地帯にしない**——
   階で止めると、ボスを倒さず居座るだけで5階ごとに無限の休憩所ができる。 */
R.intrGate = await pg.evaluate(()=>{
  S.hero=newHero();
  const tryAt=(depth, killBoss)=>{
    TH.run(1, {seed:11}); TH.floor(depth);
    if(killBoss) S.run.bossAlive=false;      // ボスを倒した状態にする
    S.run.elapsed = INTRUDER_AFTER + 5;
    tickIntruder();
    return !!liveIntruder();
  };
  const shallow    = tryAt(2);               // INTRUDER_MIN_DEPTH 未満
  const bossAlive  = tryAt(10);              // 大ボス階・ボス生存中
  const bossDead   = tryAt(10, true);        // 同じ階・ボス撃破後
  const normal     = tryAt(13);              // 普通の階
  return {skipsShallow:!shallow, waitsForBoss:!bossAlive,
          comesAfterBoss:bossDead, spawnsOnNormal:normal,
          ok: !shallow && !bossAlive && bossDead && normal};
});

/* ---------- 7. 仲間を見ない ---------- */
R.intrIgnoresAllies = await pg.evaluate(()=>{
  TH.run(1, {seed:13}); TH.floor(16);
  S.hero.party=[];
  const a=makeAlly(16, S.hero); a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  S.run.elapsed = INTRUDER_AFTER + 0.1; tickIntruder();
  const e=liveIntruder();
  // 仲間を侵入者のすぐ隣に、主人公は遠くに置く
  a.x = e.x + 0.8; a.y = e.y;
  P.x = e.x + 25;  P.y = e.y + 25;
  const tg = enemyTarget(e);
  const targetsAlly = !!tg.ent;
  const targetsPlayer = Math.abs(tg.x-P.x)<1e-6 && Math.abs(tg.y-P.y)<1e-6;
  // 普通の敵は仲間を狙う（この違いが侵入者の中身）
  const mob = W.enemies.find(x=>!x.intruder && !x.boss && !x.dead);
  mob.x = e.x; mob.y = e.y;
  const mobTg = enemyTarget(mob);
  return {ignoresAlly:!targetsAlly, targetsPlayer, mobTargetsAlly: !!mobTg.ent,
          ok: !targetsAlly && targetsPlayer && !!mobTg.ent};
});

/* ---------- 8. 視界を無視して近づいてくるか ---------- */
R.intrChases = await pg.evaluate(()=>{
  TH.run(1, {seed:17}); TH.floor(18);
  S.hero.party=[];
  S.run.elapsed = INTRUDER_AFTER + 0.1; tickIntruder();
  const e=liveIntruder();
  const aggro = e.arch.aggro;
  const d0 = Math.hypot(e.x-P.x, e.y-P.y);
  const farOutsideAggro = d0 > aggro;
  // 主人公は動かさず、侵入者だけを回す。
  // 追いつかれると殴られて死ぬので、ここでは無敵にしておく（見たいのは到達だけ）。
  P.invuln = 1e9;
  for(let i=0;i<600;i++) enemyUpdate(e, 1/60);
  const d1 = Math.hypot(e.x-P.x, e.y-P.y);
  // 比較対象：同じ距離にいる普通の敵は、視界の外なら動かない
  const mob = W.enemies.find(x=>!x.intruder && !x.boss && !x.dead && x.arch.ms>0);
  mob.x = e.x + 0; mob.y = e.y + 0;
  const mx=mob.x, my=mob.y;
  mob.x = P.x + aggro + 12; mob.y = P.y;
  const md0 = Math.hypot(mob.x-P.x, mob.y-P.y);
  mob.state='idle';
  for(let i=0;i<600;i++) enemyUpdate(mob, 1/60);
  const md1 = Math.hypot(mob.x-P.x, mob.y-P.y);
  // 壁越しでも「到達する」ことまで見る。近づくだけなら壁に貼り付いても起きるので、
  // 経路探索が本当に効いているかは、10秒で目の前まで来るかどうかでしか分からない。
  return {aggro, d0:+d0.toFixed(1), d1:+d1.toFixed(1), farOutsideAggro,
          closed:+(d0-d1).toFixed(1),
          mobMoved:+Math.abs(md0-md1).toFixed(2),
          reached: d1 < 2.5, mobStayedPut: Math.abs(md0-md1) < 0.5,
          ok: farOutsideAggro && d1 < 2.5 && Math.abs(md0-md1) < 0.5};
});

/* ---------- 8b. 壁で止まらない（経路探索の直接検証） ----------
   多数の階で、視界外から10秒歩かせて到達できた割合を見る。
   直線だけで寄せていた頃はここが 0/n だった。 */
R.intrPathing = await pg.evaluate(()=>{
  S.hero=newHero();
  let n=0, reached=0, worst=0;
  const dists=[];
  for(let seed=40; seed<70; seed++){
    TH.run(1, {seed}); TH.floor(17);
    S.hero.party=[];
    S.run.elapsed=INTRUDER_AFTER+0.1; tickIntruder();
    const e=liveIntruder(); if(!e) continue;
    n++;
    const d0=Math.hypot(e.x-P.x, e.y-P.y);
    P.invuln = 1e9;                                // 到達だけを見たいので殴られても死なない
    for(let i=0;i<720;i++) enemyUpdate(e, 1/60);   // 12秒
    const d1=Math.hypot(e.x-P.x, e.y-P.y);
    if(d1>=3.5) dists.push({seed, d0:+d0.toFixed(1), d1:+d1.toFixed(1),
      field:(()=>{ const f=intruderField(); if(!f) return 'nofield';
        const gx=Math.floor(e.x), gy=Math.floor(e.y);
        return (gx<0||gy<0||gx>=W.fl.W||gy>=W.fl.H) ? 'oob' : f[gy*W.fl.W+gx]; })(),
      wall: solid(e.x,e.y), rooms:W.fl.rooms.length, sz:W.fl.W+'x'+W.fl.H});
    worst=Math.max(worst,d1);
    if(d1 < 3.5) reached++;
  }
  // しきい値 3.5 マス。徘徊者型の間合いは 0.9 なので普通は 0.7 まで詰まるが、
  // 扉の角に体が当たる階が少しだけあり、そこは 2〜3 マスで止まる。
  // ここで見たいのは「壁で足が止まらない」ことなので、部屋1つぶんの中に
  // 入っていれば追跡は成立している（詰め切れるかは間合いの話で、別の問題）。
  return {floors:n, reached, worst:+worst.toFixed(1), stuck:dists.slice(0,6),
          ok: n>0 && reached===n};
});

/* ---------- 9. 走れば逃げ切れる ----------
   足が主人公より遅いこと自体は 5 で見ている。ここでは実際に走らせて、
   「まっすぐ逃げていれば距離が縮まらない」ことを見る。 */
R.intrOutrun = await pg.evaluate(()=>{
  TH.run(1, {seed:19}); S.upg={}; TH.floor(21);                       // ボス階（20）を避ける
  S.hero.party=[];
  W.enemies = [];                       // 逃走そのものだけを見たいので他の敵は退ける
  S.run.elapsed = INTRUDER_AFTER + 0.1; tickIntruder();
  const e=liveIntruder();
  // 広い床の上で、侵入者から見て真っ直ぐ遠ざかる向きに走る
  P.x = W.fl.start.cx+0.5; P.y = W.fl.start.cy+0.5;
  e.x = P.x - 6; e.y = P.y;
  const ms = stats(S.hero).ms;
  P.invuln = 1e9;
  const d0 = Math.hypot(e.x-P.x, e.y-P.y);
  for(let i=0;i<240;i++){
    moveEnt(P, ms*(1/60), 0);           // 壁に当たれば止まるので、壁際では縮む
    enemyUpdate(e, 1/60);
  }
  const d1 = Math.hypot(e.x-P.x, e.y-P.y);
  return {playerMs:+ms.toFixed(2), intrMs:e.ms, d0:+d0.toFixed(1), d1:+d1.toFixed(1),
          ok: e.ms < ms};
});

/* ---------- 10. 階を降りても撒けない。解除は帰還だけ ----------
   ここがこの仕掛けの中心。降りて撒けるなら「帰れ」ではなく「進め」になってしまう。
   降りて買えるのは INTRUDER_GRACE 秒だけで、時計そのものは止まらない。 */
R.intrNoEscapeByDescent = await pg.evaluate(()=>{
  TH.run(1, {seed:23}); TH.floor(22);
  S.hero.party=[];
  S.run.elapsed = INTRUDER_AFTER + 0.1; tickIntruder();
  const had = !!liveIntruder();

  enterFloor(23);                                   // 降りる
  const bodyGone   = !liveIntruder();               // 実体はこの階には持ち込まない
  const stillAwake = intruderAwake();               // だが状態は持ち越す
  const graceLeft  = intruderComingIn();            // 買えたのは猶予ぶんだけ

  // 猶予のあいだは出ない
  S.run.elapsed += INTRUDER_GRACE - 1; tickIntruder();
  const quietInGrace = !liveIntruder();
  // 猶予が切れれば追いついてくる
  S.run.elapsed += 2; tickIntruder();
  const caughtUp = !!liveIntruder();

  return {had, bodyGone, stillAwake, graceLeft:+(graceLeft||0).toFixed(1),
          quietInGrace, caughtUp,
          graceIsShort: (graceLeft||0) <= INTRUDER_GRACE + 0.2,
          ok: had && bodyGone && stillAwake && quietInGrace && caughtUp
              && (graceLeft||0) <= INTRUDER_GRACE + 0.2};
});

/* ---------- 10b. 帰還して潜り直すと消える（唯一の解除） ---------- */
R.intrClearedByReturn = await pg.evaluate(()=>{
  S.runs=24; S.hero=newHero(); S.gold=0; S.stash=[]; S.ore={}; S.carry=[];
  TH.run(1, {seed:24}); TH.floor(25);   // 帰還ポータル階
  S.hero.party=[];
  S.run.elapsed = INTRUDER_AFTER + INTRUDER_TIER_EVERY + 10; tickIntruder();
  const beforeAwake = intruderAwake();
  const beforeTier  = intruderTier();
  returnToTown();                                   // 帰る
  const runCleared = !S.run;
  startRun(1);                                      // 潜り直す
  const afterAwake = intruderAwake();
  const afterElapsed = S.run.elapsed;
  const afterNext = S.run.intrNext;
  S.run.elapsed = INTRUDER_AFTER - 1; tickIntruder();
  const stillQuiet = !liveIntruder();
  return {beforeAwake, beforeTier, runCleared,
          clearedAfterReturn: !afterAwake, afterElapsed, afterNext, stillQuiet,
          ok: beforeAwake && beforeTier>0 && runCleared && !afterAwake
              && afterElapsed===0 && afterNext===INTRUDER_AFTER && stillQuiet};
});

/* ---------- 10c. 5分ごとに段階が上がり、最後はこちらより速い ---------- */
R.intrTiers = await pg.evaluate(()=>{
  TH.run(1, {seed:25}); S.upg={}; TH.floor(28);
  S.hero.party=[];
  const pms = stats(S.hero).ms;
  const rows=[];
  for(let t=0;t<=INTRUDER_TIER_MAX+1;t++){
    S.run.elapsed = INTRUDER_AFTER + t*INTRUDER_TIER_EVERY + 1;
    S.run.intruder=null;
    const tier=intruderTier();
    const e=makeIntruder(W.fl, 28);
    rows.push({t, tier, ms:+e.ms.toFixed(2), hp:e.maxHp, atk:Math.round(e.atkV),
               faster: e.ms > pms});
  }
  const tiers=rows.map(r=>r.tier);
  const msRises=rows.every((r,i)=>i===0||r.ms>=rows[i-1].ms);
  const hpRises=rows.every((r,i)=>i===0||r.hp>=rows[i-1].hp);
  return {playerMs:+pms.toFixed(2), rows,
          // 段階は 0→1→2→3 で止まる（潜り続けても無限には上がらない）
          tiersStepUp: tiers[0]===0 && tiers[1]===1 && tiers[2]===2
                    && tiers[3]===INTRUDER_TIER_MAX && tiers[4]===INTRUDER_TIER_MAX,
          slowAtFirst: !rows[0].faster,
          fasterAtMax:  rows[INTRUDER_TIER_MAX].faster,
          msRises, hpRises,
          ok: tiers[0]===0 && tiers[3]===INTRUDER_TIER_MAX
              && !rows[0].faster && rows[INTRUDER_TIER_MAX].faster
              && msRises && hpRises};
});

/* ---------- 11. 倒しても解決しない。90秒を買うだけ ----------
   倒して段階が下がると「倒し続ければ永久に潜れる」になり、
   この仕掛けが言いたかったこと（そろそろ帰れ）が丸ごと消える。 */
R.intrKill = await pg.evaluate(()=>{
  TH.run(1, {seed:29}); TH.floor(26);
  S.hero.party=[];
  S.run.elapsed = INTRUDER_AFTER + INTRUDER_TIER_EVERY + 1;   // 段階Ⅰの状態で
  tickIntruder();
  const e=liveIntruder();
  const tierBefore=intruderTier();
  const hp=e.maxHp;
  const drops0=W.drops.length;
  killEnemy(e);
  const shard = W.drops.slice(drops0).find(d=>d.shard);
  const items = W.drops.slice(drops0).filter(d=>d.it).length;
  const boonOpen = el('m-boon').classList.contains('on');
  el('m-boon').classList.remove('on');
  const cleared = !liveIntruder();
  const stillAwake = intruderAwake();          // 倒しても状態は解けない
  const tierAfter = intruderTier();            // 段階も下がらない
  // 90秒しか買えていない
  const bought = S.run.intrNext - S.run.elapsed;
  S.run.elapsed = S.run.intrNext + 0.1; tickIntruder();
  const second = !!liveIntruder();
  const secondTier = second ? liveIntruder().tier : -1;
  return {maxHp:hp, shard: shard&&shard.shard, items, boonOpen, cleared,
          stillAwake, tierBefore, tierAfter, tierHeld: tierAfter>=tierBefore,
          bought:+bought.toFixed(1), boughtIsRespawn: Math.abs(bought-INTRUDER_RESPAWN)<0.2,
          second, secondTier, secondNotWeaker: secondTier>=tierBefore,
          ok: cleared && !!shard && shard.shard===INTRUDER_SHARDS && items===3
              && boonOpen && stillAwake && tierAfter>=tierBefore
              && Math.abs(bought-INTRUDER_RESPAWN)<0.2
              && second && secondTier>=tierBefore};
});

/* ---------- 12. HUD が実際に描かれる（例外なく1周まわる） ---------- */
R.hud = await pg.evaluate(()=>{
  const fails=[];
  try{
    TH.run(1, {seed:31}); TH.floor(28);
    S.run.elapsed = INTRUDER_AFTER - INTRUDER_WARN_LEAD + 1; tickIntruder();
    updateHUD();
    const warnTxt = el('intruder').textContent;
    const warnShown = el('intruder').style.display==='block';
    S.run.elapsed = INTRUDER_AFTER + 0.1; tickIntruder();
    const e=liveIntruder();
    W.seen.forEach(r=>r.fill(1));
    // 近いとき＝2行目は「走れ」だけ。時計を読ませても走る以外にやることが無い。
    e.x=P.x+3; e.y=P.y;
    updateHUD();
    const nearTxt = el('intruder').textContent;
    // 離れているとき＝強化までの時計を出す（帰る計画の材料）
    e.x=P.x+20; e.y=P.y;
    updateHUD();
    const farTxt = el('intruder').textContent;
    e.x=P.x+3;
    const liveTxt = nearTxt;
    for(let k=0;k<4;k++){ draw(); updateHUD(); }
    // 鍛冶場も1度描く
    W.forge={x:P.x+2, y:P.y+2, seed:0};
    for(let k=0;k<3;k++){ draw(); updateHUD(); }
    return {failures:fails, warnShown, warnTxt, nearTxt, farTxt,
            ok: warnShown && warnTxt.includes('引き上げ') && warnTxt.includes('巡回まで')
                && nearTxt.includes(INTRUDER_NAME) && nearTxt.includes('走れ')
                && farTxt.includes('強化まで') && !farTxt.includes('走れ')};
  }catch(err){ fails.push(err.message); return {failures:fails, ok:false}; }
});

await done(b, errs, R);
