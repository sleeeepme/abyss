// レリック（遺物）と、試練の石碑。
//
// 遺物は「能力を伸ばす物」ではなく「遊び方に寄り添う物」として置いてある。
// なので検証も、数字が動くことより **効果がその形で出ること** を見る。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* 石碑のある階を探す共通部品。確率で置かれるので、当たるまで振る。 */
await pg.evaluate(()=>{
  window.TH.findTrial = ()=>{
    S.relics=[]; S.relicEq=[]; S.upg={};      // 全部持っていると石碑は出ない
    for(let d=TRIAL_MIN_DEPTH; d<=40; d++) for(let k=0;k<8;k++){
      TH.run(1,{seed:d*13+k}); TH.floor(d);
      if(W.trial) return {depth:d, seed:d*13+k};
    }
    return null;
  };
});

/* ================= 1. 遺物そのもの ================= */

// 1-a. 枠は 0 から始まる。最初の1つを得たときに開く
R.slotsStartClosed = await pg.evaluate(()=>{
  S.relics=[]; S.relicEq=[]; S.upg={};
  const before=relicSlots();
  const p=rollNewRelic();
  grantRelic(p.id);
  return {before, after:relicSlots(), owned:S.relics.length,
          autoEquipped:S.relicEq.length, upgLv:upgLv('relic'),
          ok: before===0 && relicSlots()===1 && S.relicEq.length===1};
});

/* 1-b. 枠が開くまで永続強化の一覧に「遺物の枠」を出さない。
       持っていない物のための枠を先に見せても、何のことか分からない。 */
R.upgradeHidden = await pg.evaluate(()=>{
  S.relics=[]; S.relicEq=[]; S.upg={};
  S.run=null; setScreen('upg');
  const hiddenNow = !el('upgrades').innerHTML.includes('遺物の枠');
  const headHidden = el('relic-head').style.display==='none';
  grantRelic(rollNewRelic().id);
  renderUpg();
  const shownAfter = el('upgrades').innerHTML.includes('遺物の枠');
  const headShown = el('relic-head').style.display!=='none';
  return {hiddenNow, headHidden, shownAfter, headShown,
          ok: hiddenNow && headHidden && shownAfter && headShown};
});

// 1-c. 同じ遺物は落ちない
R.noDuplicates = await pg.evaluate(()=>{
  S.relics=[]; S.relicEq=[]; S.upg={};
  const got=[];
  for(let i=0;i<RELICS.length+5;i++){
    const p=rollNewRelic();
    if(!p) break;
    grantRelic(p.id); got.push(p.id);
  }
  const dupes=got.filter((v,i,a)=>a.indexOf(v)!==i);
  return {got:got.length, kinds:RELICS.length, dupes,
          exhausts: rollNewRelic()===null,
          ok: got.length===RELICS.length && dupes.length===0 && rollNewRelic()===null};
});

// 1-d. 枠の数までしか着けられない
R.slotLimit = await pg.evaluate(()=>{
  S.relics=RELICS.map(r=>r.id); S.relicEq=[]; S.upg={relic:2};
  RELICS.forEach(r=>relicToggle(r.id));
  const at2=relicsOn().length;
  S.upg.relic=RELIC_MAX_SLOTS;
  S.relicEq=[]; RELICS.forEach(r=>relicToggle(r.id));
  const at3=relicsOn().length;
  return {at2, at3, max:RELIC_MAX_SLOTS,
          ok: at2===2 && at3===RELIC_MAX_SLOTS && RELIC_MAX_SLOTS===3};
});

/* 1-e. 枠を減らしても壊れない。
       装備が枠より多い状態を作ってから読むと、上から枠数だけが効く。 */
R.survivesSlotShrink = await pg.evaluate(()=>{
  S.relics=RELICS.map(r=>r.id); S.upg={relic:3};
  S.relicEq=['greed','swift','ruin'];
  const at3=relicsOn().map(r=>r.id);
  S.upg.relic=1;
  const at1=relicsOn().map(r=>r.id);
  return {at3, at1, ok: at3.length===3 && at1.length===1 && at1[0]==='greed'};
});

/* ================= 2. 効果が実際に出る ================= */

// 2-a. 数値の効果（発見力・移動速度・回避・大技の威力）
R.numericEffects = await pg.evaluate(()=>{
  S.relics=RELICS.map(r=>r.id); S.upg={relic:3}; S.relicEq=[];
  TH.run(1,{seed:4}); TH.floor(6);
  const base={mf:stats(S.hero).mf, ms:stats(S.hero).ms,
              evade:stats(S.hero).evade, ult:ultPowerMul()};
  S.relicEq=['greed','swift','ruin'];
  const on={mf:stats(S.hero).mf, ms:stats(S.hero).ms,
            evade:stats(S.hero).evade, ult:ultPowerMul()};
  return {base:{mf:base.mf, ms:+base.ms.toFixed(2), evade:base.evade, ult:base.ult},
          on:{mf:on.mf, ms:+on.ms.toFixed(2), evade:on.evade, ult:on.ult},
          mfUp:on.mf-base.mf, msUp:on.ms>base.ms, evadeUp:on.evade>base.evade,
          ultUp:on.ult>base.ult,
          ok: on.mf===base.mf+45 && on.ms>base.ms && on.evade===6 && on.ult===1.35};
});

// 2-b. 仲間には乗らない（遺物は口座に残る物で、渡す概念が無い）
R.playerOnly = await pg.evaluate(()=>{
  const a=TH.ally(6,'warrior',10);
  S.relicEq=['swift'];
  const withR=allyStats(a).ms;
  S.relicEq=[];
  const without=allyStats(a).ms;
  return {withR:+withR.toFixed(3), without:+without.toFixed(3),
          same: Math.abs(withR-without)<1e-6, ok: Math.abs(withR-without)<1e-6};
});

// 2-c. 脈動：一定間隔でHPが戻る
R.pulseHeals = await pg.evaluate(()=>{
  S.relics=RELICS.map(r=>r.id); S.upg={relic:3}; S.relicEq=['pulse'];
  TH.run(1,{seed:4}); TH.floor(6); TH.immortal(); TH.clearEnemies();
  const st=stats(S.hero);
  S.hero.hpNow=Math.round(st.maxHp*0.3);
  const hp0=S.hero.hpNow;
  stepSim(relicSum('regenEvery')+1);
  const hp1=S.hero.hpNow;
  // 満タンなら何も起きない（無駄な数字を出さない）
  S.hero.hpNow=st.maxHp;
  stepSim(relicSum('regenEvery')+1);
  return {hp0, hp1, healed:hp1-hp0, full:S.hero.hpNow===st.maxHp,
          ok: hp1>hp0 && S.hero.hpNow===st.maxHp};
});

// 2-d. 伴影：影が付き従い、敵を撃つ
R.wispShoots = await pg.evaluate(()=>{
  S.relicEq=['wisp'];
  TH.run(1,{seed:4}); TH.floor(6); TH.immortal();
  const e=W.enemies[0]; W.enemies=[e]; e.x=P.x+2.2; e.y=P.y; e.maxHp=e.hp=1e7;
  S.hero.equip.weapon=null;                 // 本人は素手で、影の仕事だけを見る
  P.wisps=[];
  const hp0=e.hp;
  stepSim(6);
  const count=(P.wisps||[]).length;
  S.relicEq=[];
  stepSim(0.2);
  return {count, damage:hp0-e.hp, hasWisp:count===1, dealt:(hp0-e.hp)>0,
          clearsWhenOff:(P.wisps||[]).length===0,
          ok: count===1 && (hp0-e.hp)>0 && (P.wisps||[]).length===0};
});

// 2-e. 不滅：1回の探索につき一度だけ全快で立ち上がる
R.emberRevives = await pg.evaluate(()=>{
  S.relicEq=['ember'];
  TH.run(1,{seed:4}); TH.floor(6);
  S.hero.boons=[];
  const st=stats(S.hero);
  S.hero.hpNow=1;
  const first=tryPhoenix(S.hero, true);
  const full=S.hero.hpNow===st.maxHp;
  S.hero.hpNow=1;
  const second=tryPhoenix(S.hero, true);
  return {first, full, secondBlocked: !second, used:S.run.emberUsed,
          ok: first===true && full && second===false};
});

// 2-f. 震撼：近接が当たると周りにも入る
R.quakeShock = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(6); TH.immortal();
  const w=genBaseItem('sword',20,1); w.ident=true; S.hero.equip.weapon=w;
  const proto=W.enemies[0];
  const mk=(dx,dy)=>Object.assign({}, proto,
      {x:P.x+dx, y:P.y+dy, hp:1e7, maxHp:1e7, dead:false, st:{}, atkV:0});
  /* 横の的は、剣の間合いにも扇の角度にも入らない場所に置く。
     直接当たる位置に置くと、衝撃波が出たのか本体が当たったのか区別できない。 */
  const measure=()=>{
    const hit=mk(1.0,0), side=mk(1.0,1.6);
    W.enemies=[hit, side];
    /* 敵の索引（EGrid）は「フレームが進んだか、頭数が変わったか」でしか
       組み直さない。テストが同じ頭数のまま中身を差し替えると、
       索引が古い相手を指したまま「1体も居ない」ことになる。ここで明示的に組み直す。 */
    gridBuild();
    P.dirx=1; P.diry=0; P.atkCd=0; P.target=hit;
    playerAttack();
    return {hit:1e7-hit.hp, side:1e7-side.hp};
  };
  S.relicEq=[];
  const off=measure();
  S.relicEq=['quake'];
  const on=measure();
  return {off, on, sideOnlyWithRelic: off.side===0 && on.side>0,
          ok: off.side===0 && on.side>0 && on.hit>0};
});

/* 2-g. 求道：**指した武器種**が出やすくなる。
       以前は「いま握っている種」に自動で追随していたので、
       付けるか付けないかしか選べなかった。武器種ごとに別の遺物に割ってある。 */
R.hoardBias = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20);
  S.upg=S.upg||{}; S.upg.relic=RELIC_MAX_SLOTS;
  const w=genBaseItem('mace',20,1); w.ident=true; S.hero.equip.weapon=w;
  const count=(id)=>{ let n=0; for(let i=0;i<600;i++) if(pickBase(20).id===id) n++; return n; };
  S.relicEq=[];
  const off=count('mace');
  /* **握っている武器（戦槌）ではなく、遺物が指す種（弓）が増える。**
     ここが「自動で追随しない」ことの検証そのもの。 */
  S.relicEq=['hoard_bow'];
  const onMace=count('mace'), onBow=count('bow');
  S.relicEq=[];
  const offBow=count('bow');
  return {off, onMace, onBow, offBow,
          ratio:+(onBow/Math.max(1,offBow)).toFixed(2),
          biasesTheNamedOne: onBow > offBow*1.5,
          leavesHeldAlone: onMace <= off*1.35,
          ok: onBow > offBow*1.5 && onMace <= off*1.35};
});

/* 2-h. 指した種は**レア度も上がる。**
       出やすくなるだけだと「同じ白い剣が増える」で終わってしまう。 */
R.hoardRarity = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(30);
  S.upg=S.upg||{}; S.upg.relic=RELIC_MAX_SLOTS;
  const avgRar=()=>{
    let sum=0, n=0;
    for(let i=0;i<1500;i++){
      const it=genItem(30,0);
      if(it.base!=='bow') continue;
      sum+=it.rar; n++;
    }
    return n ? sum/n : 0;
  };
  S.relicEq=[];             RNG=mulberry32(77); const off=avgRar();
  S.relicEq=['hoard_bow'];  RNG=mulberry32(77); const on =avgRar();
  S.relicEq=[];
  return {off:+off.toFixed(3), on:+on.toFixed(3), mf:HOARD_MF,
          richer: on > off,
          ok: on > off};
});

// 2-i. 抽選では8種まとめて1枠。他の遺物が埋もれない
R.hoardIsOneSlot = await pg.evaluate(()=>{
  S.relics=[]; S.relicEq=[];
  const seen={};
  for(let i=0;i<1200;i++){
    S.relics=[];
    const r=rollNewRelic();
    if(r) seen[r.fam==='hoard'?'hoard':r.id]=(seen[r.fam==='hoard'?'hoard':r.id]||0)+1;
  }
  const hoardShare=(seen.hoard||0)/1200;
  const families=RELICS.filter(r=>r.fam!=='hoard').length + 1;
  return {seen, hoardShare:+hoardShare.toFixed(3), families,
          hoardKinds:RELICS.filter(r=>r.fam==='hoard').length,
          // 1枠ぶんの取り分（1/families）に収まっている
          notFlooded: hoardShare < 1.8/families,
          ok: hoardShare < 1.8/families && RELICS.filter(r=>r.fam==='hoard').length>=6};
});

/* ================= 3. 試練の石碑 ================= */

// 3-a. 序盤には出ない／ボス階には出ない
R.trialPlacement = await pg.evaluate(()=>{
  S.relics=[]; S.relicEq=[];
  let early=0, boss=0, normal=0;
  for(let k=0;k<40;k++){
    TH.run(1,{seed:100+k}); TH.floor(2);
    if(W.trial) early++;
  }
  for(let d=10; d<=40; d+=10) for(let k=0;k<10;k++){
    TH.run(1,{seed:200+d+k}); TH.floor(d);
    if(W.trial) boss++;
  }
  for(let k=0;k<60;k++){
    TH.run(1,{seed:300+k}); TH.floor(TRIAL_MIN_DEPTH+2);
    if(W.trial) normal++;
  }
  return {early, boss, normal, min:TRIAL_MIN_DEPTH,
          notEarly: early===0, notOnBoss: boss===0, appears: normal>0,
          ok: early===0 && boss===0 && normal>0};
});

// 3-b. 全部持っていたら石碑も出さない（押しても何も出ない石碑を置かない）
R.noTrialWhenFull = await pg.evaluate(()=>{
  S.relics=RELICS.map(r=>r.id);
  let n=0;
  for(let k=0;k<60;k++){ TH.run(1,{seed:400+k}); TH.floor(9); if(W.trial) n++; }
  S.relics=[];
  return {found:n, none:n===0, ok: n===0};
});

// 3-c. 触れると、枷と報酬を先に見せる
R.trialModal = await pg.evaluate(()=>{
  const f=TH.findTrial();
  if(!f) return {skipped:true, ok:false};
  P.x=W.trial.x; P.y=W.trial.y;
  openTrial();
  const txt=el('tr-body').textContent;
  const bane=trialBaneDef(W.trial.bane);
  return {depth:f.depth, open:el('m-trial').classList.contains('on'),
          showsSec: txt.includes(String(TRIAL_SEC)),
          showsBane: txt.includes(bane.nm),
          showsPrize: txt.includes('遺物'),
          ok: el('m-trial').classList.contains('on')
              && txt.includes(String(TRIAL_SEC)) && txt.includes(bane.nm)};
});

// 3-d. 始めると敵が湧き続ける
R.trialSpawns = await pg.evaluate(()=>{
  startTrial();
  const active=trialActive();
  TH.immortal(); TH.clearEnemies();
  let spawned=0;
  stepSim(TRIAL_WAVE*3+1, {after:()=>{ spawned=Math.max(spawned, W.enemies.length); }});
  return {active, bane:S.run.trial.bane, spawned,
          keepsComing: spawned >= TRIAL_PER_WAVE*2,
          ok: active && spawned >= TRIAL_PER_WAVE*2};
});

/* 3-e. 湧く位置は主人公から離す。
       足元に出すと避けようが無く、それは難度ではなく事故になる。 */
R.spawnsAtDistance = await pg.evaluate(()=>{
  TH.clearEnemies();
  for(let i=0;i<30;i++) spawnTrialEnemy();
  const ds=W.enemies.map(e=>Math.hypot(e.x-P.x, e.y-P.y));
  const min=Math.min(...ds);
  return {n:ds.length, min:+min.toFixed(2), floor:TRIAL_SPAWN_MIN,
          keepsDistance: min >= TRIAL_SPAWN_MIN-0.5,
          ok: ds.length>0 && min >= TRIAL_SPAWN_MIN-0.5};
});

// 3-f. 枷が実際に効く
R.baneApplies = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(9);
  S.relicEq=[];
  const base={ms:stats(S.hero).ms, aspd:stats(S.hero).aspd};
  S.run.trial={t:30, max:30, bane:'heavy', wave:9, kills:0};
  const heavy=stats(S.hero).ms;
  S.run.trial.bane='dull';
  const dull=stats(S.hero).aspd;
  S.run.trial.bane='silent';
  P.ultCd=0; S.ult='quake'; S.ultLv={quake:1};
  const fired=fireUlt();
  S.run.trial=null;
  return {baseMs:+base.ms.toFixed(2), heavy:+heavy.toFixed(2),
          baseAspd:+base.aspd.toFixed(2), dull:+dull.toFixed(2),
          ultBlocked: fired===false,
          slower: heavy<base.ms, duller: dull<base.aspd,
          ok: heavy<base.ms && dull<base.aspd && fired===false};
});

// 3-g. 耐え切ると遺物が1つ手に入り、試練は終わる
R.trialRewards = await pg.evaluate(()=>{
  const f=TH.findTrial();
  if(!f) return {skipped:true, ok:false};
  P.x=W.trial.x; P.y=W.trial.y;
  openTrial(); startTrial();
  TH.immortal();
  const before=(S.relics||[]).length;
  stepSim(TRIAL_SEC+2);
  return {before, after:(S.relics||[]).length, ended: !trialActive(),
          slots:relicSlots(),
          gotOne:(S.relics||[]).length===before+1,
          ok: (S.relics||[]).length===before+1 && !trialActive() && relicSlots()>=1};
});

/* 3-h. 階を降りると中断される。
       持ち越せると「湧いた敵から逃げて階段へ」が正解になり、籠城戦の形が崩れる。 */
R.trialEndsOnDescend = await pg.evaluate(()=>{
  const f=TH.findTrial();
  if(!f) return {skipped:true, ok:false};
  P.x=W.trial.x; P.y=W.trial.y;
  openTrial(); startTrial();
  const during=trialActive();
  TH.floor(S.run.depth+1);
  return {during, endedAfter: !trialActive(), cancelled: during && !trialActive(),
          ok: during && !trialActive()};
});

// 3-i. 同じ石碑は一度きり
R.trialOncePerStone = await pg.evaluate(()=>{
  const f=TH.findTrial();
  if(!f) return {skipped:true, ok:false};
  P.x=W.trial.x; P.y=W.trial.y;
  openTrial(); startTrial();
  S.run.trial=null;
  const again=nearTrial();
  return {used:W.trial.used, blocked: !again, ok: W.trial.used===true && !again};
});

// 3-j. 試練が回っているあいだ、描画まで含めて例外が出ない
R.trialLive = await pg.evaluate(()=>{
  const f=TH.findTrial();
  if(!f) return {skipped:true, ok:false};
  P.x=W.trial.x; P.y=W.trial.y;
  openTrial(); startTrial(); TH.immortal();
  let threw=null;
  try{ stepSim(20, {draw:true, each:(t)=>{ stickDx=Math.cos(t); stickDy=Math.sin(t*1.3); }}); }
  catch(e){ threw=String(e.message); }
  stickDx=stickDy=0;
  return {threw, enemies:W.enemies.length, ok: threw===null};
});

await done(b, errs, R);
