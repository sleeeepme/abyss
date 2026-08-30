// 頭数・眷属・踏破・瞬歩・倉庫。
//
//   どれも「増えることそのもの」を触った変更なので、
//   上限と、上限に達したときの見え方まで一緒に見る。
//   上限に達しているのに選択肢として出てくるのが、いちばん静かな裏切りになる。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 隊の枠 ================= */

/* 1-a. 大ボスを2体（＝第20階層まで）倒すまで、一覧に出さない。
       開く条件を満たしていない枠を先に見せても、
       「いつか増える」という情報が増えるだけで、今日の判断は増えない。 */
R.slotHidden = await pg.evaluate(()=>{
  const u=UPGRADES.find(x=>x.id==='party');
  S.greatKills=0;      const atStart=!!u.hidden();
  S.greatKills=PARTY_SLOT_AT-1; const midway=!!u.hidden();
  S.greatKills=PARTY_SLOT_AT;   const opened=!u.hidden();
  S.greatKills=0;
  return {at:PARTY_SLOT_AT, cost:u.shard, max:u.max,
          hiddenAtStart: atStart,
          stillHiddenAtOne: midway,
          opensAfterTwoGreats: opened,
          // 頭数は一番効く強化なので、値段は他より重くしてある
          costsMore: u.shard > UPGRADES.find(x=>x.id==='hp').shard,
          ok: atStart && midway && opened};
});

/* 1-b. 段ごとに1人ずつ増え、上限で止まる。 */
R.slotGrows = await pg.evaluate(()=>{
  const at=(lv)=>{ S.upg={party:lv}; return partyMax(); };
  const base=at(0), one=at(1), full=at(PARTY_UP_MAX), over=at(PARTY_UP_MAX+3);
  S.upg={};
  return {base, one, full, over, step:PARTY_UP_MAX,
          startsAtThree: base===PARTY_BASE,
          growsOnePerLevel: one===base+1,
          capped: full===base+PARTY_UP_MAX && over===full,
          ok: base===PARTY_BASE && one===base+1 && over===full};
});

/* 1-c. 同じ職は3人まで、上位職は1人まで。
       枠が伸びたぶんを「一番強い職を並べる」に使えると、
       頭数の強化がそのまま最適解の一本道になる。 */
R.jobLimits = await pg.evaluate(()=>{
  S.upg={party:PARTY_UP_MAX}; S.hero=newHero(); S.hero.party=[];
  const base=JOBS[0].id;
  const rare=ALL_JOBS.find(j=>!JOBS.some(b=>b.id===j.id)).id;
  const mk=(job)=>{ const a=TH.ally(10, job, 10); a.hpNow=allyStats(a).maxHp; return a; };
  const tries=[];
  for(let i=0;i<JOB_LIMIT_BASE+1;i++){
    const a=mk(base); const r=canJoin(a);
    tries.push(r.ok?'入れた':'断られた');
    if(r.ok){ uniqueAllyName(a,party()); S.hero.party.push(a); }
  }
  const rareTries=[];
  for(let i=0;i<JOB_LIMIT_RARE+1;i++){
    const a=mk(rare); const r=canJoin(a);
    rareTries.push(r.ok?'入れた':'断られた');
    if(r.ok){ uniqueAllyName(a,party()); S.hero.party.push(a); }
  }
  // 断る理由は必ず言葉で返す（押せないボタンの理由が無いのが一番よくない）
  const why=canJoin(mk(base)).why||'';
  S.upg={}; S.hero.party=[];
  return {base, rare, tries, rareTries, why,
          baseLimit:JOB_LIMIT_BASE, rareLimit:JOB_LIMIT_RARE,
          baseStopsAtLimit: tries.filter(t=>t==='入れた').length===JOB_LIMIT_BASE,
          rareStopsAtOne:   rareTries.filter(t=>t==='入れた').length===JOB_LIMIT_RARE,
          saysWhy: why.length>0,
          ok: tries.filter(t=>t==='入れた').length===JOB_LIMIT_BASE
              && rareTries.filter(t=>t==='入れた').length===JOB_LIMIT_RARE
              && why.length>0};
});

/* 1-d. 枠そのものも上限になる。満員なら断る。 */
R.slotFull = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero(); S.hero.party=[];
  const jobs=JOBS.map(j=>j.id);
  let joined=0;
  for(let i=0;i<8;i++){
    const a=TH.ally(10, jobs[i%jobs.length], 10);
    if(!canJoin(a).ok) break;
    uniqueAllyName(a,party()); S.hero.party.push(a); joined++;
  }
  const why=canJoin(TH.ally(10, jobs[0], 10)).why||'';
  const n=party().length;
  S.hero.party=[];
  return {joined, partyMax:partyMax(), why,
          stopsAtMax: n===partyMax(),
          saysWhy: why.length>0,
          ok: n===partyMax() && why.length>0};
});

/* ================= 2. 眷属は3つまで ================= */

/* 2-a. 恩寵1つにつき1体。値を積み増す形だと、
       2つめを取っても**見た目も威力も1つのまま**で、取った意味が消える。 */
R.kinStacks = await pg.evaluate(()=>{
  S.hero=newHero();
  const put=(n)=>{ S.hero.boons=Array.from({length:n},()=>({id:'kin',rar:'rare'}));
                   return kinCount(S.hero); };
  const one=put(1), two=put(2), three=put(3), four=put(4);
  S.hero.boons=[];
  return {one, two, three, four, max:KIN_MAX,
          countsUp: two===2 && three===3,
          cappedAtThree: four===KIN_MAX,
          ok: two===2 && three===3 && four===KIN_MAX};
});

/* 2-b. 上限に達したら**潜在の選択肢に出さない。**
       取れない札が3択に混じると、選択肢が2つの回が黙って生まれる。 */
R.kinCapped = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null;
  const under=boonAtCap('kin')?'出さない':'出す';
  S.hero.boons=Array.from({length:KIN_MAX},()=>({id:'kin',rar:'rare'}));
  const atCap=boonAtCap('kin')?'出さない':'出す';
  // 実際に配ってみて、混ざらないことを見る
  RNG=mulberry32(4242);
  let offered=0;
  for(let i=0;i<200;i++) offered += rollBoons('mid',3).filter(x=>x.id==='kin').length;
  S.hero.boons=[];
  return {under, atCap, offered,
          offeredWhileRoom: under==='出す',
          hiddenWhenFull:   atCap==='出さない',
          neverRolled: offered===0,
          ok: under==='出す' && atCap==='出さない' && offered===0};
});

/* 2-c. 連れている数だけ、実際に盤面に出て撃つ。 */
R.kinFight = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(16); TH.immortal();
  S.hero.equip.weapon=null;                  // 素手にして殴りと分ける
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=P.x+2.0; e.y=P.y; e.maxHp=e.hp=1e9; e.atkV=0; e.ms=0;
  const dmgWith=(n)=>{
    S.hero.boons=Array.from({length:n},()=>({id:'kin',rar:'epic'}));
    S.hero.kins=[]; const hp0=e.hp;
    stepSim(KIN_CD*2.5);
    const out={dmg:hp0-e.hp, orbs:(S.hero.kins||[]).length};
    e.hp=hp0; return out;
  };
  const one=dmgWith(1), three=dmgWith(3);
  S.hero.boons=[];
  return {one, three,
          oneOrb: one.orbs===1,
          threeOrbs: three.orbs===KIN_MAX,
          hitsHarder: three.dmg > one.dmg,
          ok: one.orbs===1 && three.orbs===3 && three.dmg>one.dmg};
});

/* ================= 3. 潜り直した階の穴 ================= */

/* 3-a. 一度でも降り口を抜けた階は覚えておく。
       最深からの距離だけで決めていたので、**さっき抜けたばかりの階で
       出口が隠れる**ことがあった（潜り直すと穴が出ない、の正体）。 */
R.cleared = await pg.evaluate(()=>{
  S.hero=newHero(); S.cleared2=null; S.deepest=1;
  startRun(1);
  const before=floorCleared(10)?'覚えている':'まだ';
  markFloorCleared(10);
  const after=floorCleared(10)?'覚えている':'まだ';
  // 死んで潜り直しても残る（口座側に置いてある）
  S.hero=newHero(); S.deepest=12; startRun(10);
  W.seen.forEach(r=>r.fill(0));
  P.x=W.fl.start.cx+0.5; P.y=W.fl.start.cy+0.5;
  const far=Math.hypot(W.fl.stair.x-P.x, W.fl.stair.y-P.y);
  const shown=stairRevealed()?'見える':'見えない';
  // 一度も抜けていない階は、今までどおり隠れたまま
  S.cleared2={}; S.deepest=1;
  const unseen=stairRevealed()?'見える':'見えない';
  return {before, after, shown, unseen, farFromStair:+far.toFixed(1),
          remembersAfterDeath: after==='覚えている',
          showsOnRedive: shown==='見える',
          stillHidesUnknown: unseen==='見えない',
          ok: after==='覚えている' && shown==='見える' && unseen==='見えない'};
});

/* 3-b. 降りるときに覚える（降りたのに覚えない、が起きない）。 */
R.marksOnDescend = await pg.evaluate(()=>{
  S.hero=newHero(); S.cleared2=null; S.deepest=1;
  startRun(3);
  const before=floorCleared(3)?'覚えている':'まだ';
  markFloorCleared(S.run.depth); enterFloor(4);
  const after=floorCleared(3)?'覚えている':'まだ';
  return {before, after,
          marksTheFloorYouLeft: after==='覚えている',
          ok: after==='覚えている'};
});

/* ================= 4. 瞬歩は「走る」 ================= */

/* 4-a. 一瞬で座標が飛ぶと、何が起きたか読めないまま向こう側にいる。
       時間をかけて走らせ、通った跡を残す。 */
R.blink = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(8); TH.immortal();
  TH.clearEnemies();
  /* 大技は口座側（S.ult）で、解放は大ボスの数で決まる。 */
  S.greatKills=10; S.ult='blink'; S.ultLv={blink:1};
  const from={x:P.x, y:P.y};
  P.ultCd=0;
  const fired=fireUlt();
  const started=!!P.dash;
  const mid=[];
  stepSim(BLINK_SEC*0.6, {after:()=>mid.push({x:P.x,y:P.y})});
  const moving = mid.length>2
              && Math.hypot(mid[1].x-from.x, mid[1].y-from.y) > 0.01
              && Math.hypot(mid[1].x-from.x, mid[1].y-from.y)
                 < Math.hypot(mid[mid.length-1].x-from.x, mid[mid.length-1].y-from.y);
  const ghosts=W.fx.filter(f=>f.t==='dashghost').length;
  stepSim(BLINK_SEC);
  const arrived=Math.hypot(P.x-from.x, P.y-from.y);
  return {fired, started, sec:BLINK_SEC, ghosts, arrived:+arrived.toFixed(2),
          samples:mid.length,
          takesTime: started,
          movesGradually: moving,
          leavesTrail: ghosts>0,
          ends: !P.dash,
          ok: !!fired && started && moving && ghosts>0 && !P.dash};
});

/* 4-b. 走っているあいだは操作を捨てる。途中で曲がれると、
       既に取ってある線分の判定と、当たった場所が食い違う。 */
R.blinkLocked = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(8); TH.immortal();
  TH.clearEnemies();
  S.greatKills=10; S.ult='blink'; S.ultLv={blink:1}; P.ultCd=0; fireUlt();
  const line={x0:P.dash.x0, y0:P.dash.y0, x1:P.dash.x1, y1:P.dash.y1};
  stepSim(BLINK_SEC*0.5, {each:()=>{ stickDx=0; stickDy=1; }});   // 横へ入力
  stickDx=0; stickDy=0;
  const target={x:P.dash?P.dash.x1:line.x1, y:P.dash?P.dash.y1:line.y1};
  return {line, target,
          keepsItsLine: Math.abs(target.x-line.x1)<0.01 && Math.abs(target.y-line.y1)<0.01,
          ok: Math.abs(target.x-line.x1)<0.01};
});

/* ================= 5. 倉庫は街の建物 ================= */

/* 5-a. 倉庫は欠片（能力強化）ではなく金（街開発）で伸ばす。
       持ち帰れる量は「街が育った結果」で、
       潜って稼いだ欠片を注ぐ物ではない。 */
R.stash = await pg.evaluate(()=>{
  const inUpg=UPGRADES.some(u=>u.id==='stash') ? '能力強化にある' : '無い';
  const b=BUILDINGS.find(x=>x.id==='stash');
  S.bld={}; const at0=stashCap();
  S.bld={stash:1}; const at1=stashCap();
  S.bld={stash:b.max}; const atMax=stashCap();
  S.bld={};
  return {inUpg, building:!!b, cost:b&&b.base, max:b&&b.max,
          at0, at1, atMax,
          movedOutOfUpgrades: inUpg==='無い',
          isABuilding: !!b,
          growsWithLevel: at1>at0 && atMax>at1,
          ok: inUpg==='無い' && !!b && at1>at0};
});

/* 5-b. 持ち帰る物は**倉庫に入れる前に**レア度順へ並べる。
       入れたあとに並べ直すと、持ち帰る物を選ぶ画面と順番が食い違う。 */
R.lootSorted = await pg.evaluate(()=>{
  S.hero=newHero(); S.stash=[]; S.bld={stash:5}; S.gold=0;
  startRun(10); S.hero.party=[];
  S.run.gold=0;
  /* レア度は**直接立てる。** genBaseItem の第3引数は「上限の目安」で、
     必ずそのレア度になるわけではない（実際 0,1,1,0 が返ってきて、
     並べ替えを見ているつもりが同じ値を並べているだけになっていた）。 */
  S.run.loot=[0,3,1,2].map(r=>{ const it=genBaseItem('sword',10,0); it.rar=r; return it; });
  const before=S.run.loot.map(i=>i.rar).join(',');
  returnToTown();
  TH.close('m-ret');
  const after=S.stash.map(i=>i.rar).join(',');
  const rars=S.stash.map(i=>i.rar);
  return {before, after,
          descending: rars.every((v,i)=>i===0 || rars[i-1]>=v),
          keptAll: S.stash.length===4,
          ok: rars.every((v,i)=>i===0 || rars[i-1]>=v) && S.stash.length===4};
});

/* ================= 6. 落ちる量 ================= */

/* 6-a. 拾う手が止まらないほど落ちていた。1/3 に絞って、
       1つ拾うことに意味を戻す。精鋭は今までどおり多めに落とす。 */
R.dropRate = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(19); S.hero.party=[];
  const src=W.enemies.find(x=>!x.dead && !x.boss);
  /* 実際に倒して数える。落とす判定は killEnemy の中にあるので、
     割合そのものを写経すると**本編を直してもテストが気づかない。** */
  const roll=(elite)=>{
    RNG=mulberry32(777);
    let items=0;
    for(let i=0;i<1500;i++){
      W.drops=[];
      const c=Object.assign({}, src, {dead:false, hp:1, elite, aff:[], uniq:false,
                                      st:{}, bu:{}, boss:false});
      killEnemy(c);
      items += W.drops.filter(d=>d.it && !isConsum(d.it)).length;
    }
    W.drops=[];
    return +(items/1500).toFixed(3);
  };
  const plain=roll(false), elite=roll(true);
  return {plain, elite,
          rare: plain < 0.15,
          eliteStillBetter: elite > plain,
          notZero: plain > 0,
          ok: plain>0 && plain<0.15 && elite>plain};
});

await done(b, errs, R);
