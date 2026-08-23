// 仲間（ジョブ）・ユニーク敵・潜在の付与先・第50階層のラスボス
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

/* ============ 1. ジョブと仲間の生成 ============ */

// 1-a. 武器種はジョブごとに固定。防具も固定。盾は戦士だけ
R.jobs = await pg.evaluate(()=>{
  RNG=mulberry32(1234);
  const hero={lv:20,str:24,dex:24,vit:24,int:5,equip:{},boons:[],party:[]};
  const seen={};
  for(let i=0;i<600;i++){
    const a=makeAlly(20, hero);
    const j=jobDef(a.job);
    seen[a.job]=seen[a.job]||{n:0, weapons:new Set(), armors:new Set(), shield:0};
    const s=seen[a.job];
    s.n++; s.weapons.add(a.equip.weapon.base); s.armors.add(a.equip.armor.base);
    if(a.equip.shield) s.shield++;
  }
  const out={};
  for(const k in seen){
    const s=seen[k], j=jobDef(k);
    out[k]={n:s.n, weapon:[...s.weapons].join(','), armor:[...s.armors].join(','),
            shieldAlways: s.shield===0 || s.shield===s.n,
            matchesDef: [...s.weapons].length===1 && [...s.weapons][0]===j.weapon};
  }
  return {jobs:out, allJobsSeen:Object.keys(out).length===JOBS.length,
          allFixed:Object.values(out).every(o=>o.matchesDef && o.shieldAlways)};
});

// 1-b. 仲間はプレイヤーより明確に弱い
R.weaker = await pg.evaluate(()=>{
  RNG=mulberry32(777);
  S.hero=newHero(); S.upg={}; startRun(12);
  // プレイヤーにそれなりの装備を持たせる
  S.hero.lv=18; S.hero.str=22; S.hero.dex=22; S.hero.vit=22;
  S.hero.equip.weapon=genBaseItem('sword',18,2);
  S.hero.equip.armor =genBaseItem('chain',18,2);
  const ps=stats(S.hero);
  const rows=[];
  for(let i=0;i<200;i++){
    const a=makeAlly(12,S.hero), as=allyStats(a);
    rows.push({hp:as.maxHp/ps.maxHp, atk:as.atk/ps.atk, lv:a.lv});
  }
  const avg=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
  return {hpRatio:+avg('hp').toFixed(3), atkRatio:+avg('atk').toFixed(3),
          maxHpRatio:+Math.max(...rows.map(r=>r.hp)).toFixed(3),
          maxAtkRatio:+Math.max(...rows.map(r=>r.atk)).toFixed(3),
          lvNeverAbove: rows.every(r=>r.lv<=S.hero.lv),
          alwaysWeakerHp: rows.every(r=>r.hp<1),
          alwaysWeakerAtk: rows.every(r=>r.atk<1)};
});

// 1-c. 同じジョブが重なると名前に番号が付く
R.names = await pg.evaluate(()=>{
  const mk=(job)=>({job, name:jobDef(job).nm});
  const list=[];
  for(let i=0;i<4;i++){ const a=mk('warrior'); uniqueAllyName(a,list); list.push(a); }
  return {names:list.map(a=>a.name), unique:new Set(list.map(a=>a.name)).size===4};
});

/* ============ 2. 加入フロー ============ */

// 2-a. NPC は階層に最大1体、ボス階には出ず、満員なら出ない
R.npcSpawn = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(1);
  let withNpc=0, boss=0;
  for(let d=1;d<=40;d++){
    RNG=mulberry32(d*31337);
    S.hero.party=[];
    enterFloor(d);
    if(W.npc) withNpc++;
    if(bossTierAt(d) && W.npc) boss++;
  }
  // 満員のとき
  S.hero.party=[makeAlly(5,S.hero),makeAlly(5,S.hero),makeAlly(5,S.hero)];
  let fullSpawn=0;
  for(let d=1;d<=20;d++){ RNG=mulberry32(d*99); enterFloor(d); if(W.npc) fullSpawn++; }
  return {floorsWithNpc:withNpc, onBossFloors:boss, whenFull:fullSpawn,
          neverOnBossFloor: boss===0, neverWhenFull: fullSpawn===0,
          appearsSometimes: withNpc>3};
});

// 2-b. 加入は最大3名で打ち止め
R.joinCap = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(6);
  const joined=[];
  for(let i=0;i<6;i++){
    W.npc=makeAlly(6,S.hero); W.npc.x=P.x; W.npc.y=P.y;
    joinAlly();
    joined.push(livingParty().length);
  }
  return {sequence:joined, cap:PARTY_MAX, stopsAt3: Math.max(...joined)===PARTY_MAX};
});

// 2-c. NPC のそばに立つとプロンプトが出て、interact で能力画面が開く
R.inspect = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(6); S.hero.party=[];
  W.npc=makeAlly(6,S.hero); W.npc.x=P.x+0.5; W.npc.y=P.y;
  updateHUD();
  const prompt=document.getElementById('prompt');
  const promptShown = prompt.style.display==='block' && prompt.textContent.includes('話しかける');
  interact();
  const modalOn=document.getElementById('m-ally').classList.contains('on');
  const txt=document.getElementById('ally-stats').textContent
          + document.getElementById('ally-skill').textContent;
  const skillShown = txt.includes(jobDef(W.npc.job).sk.nm);
  const cmpShown = /あなた比/.test(txt);
  passAlly();
  const closed=!document.getElementById('m-ally').classList.contains('on');
  return {promptShown, modalOn, skillShown, cmpShown, closedOnPass:closed,
          stillThere: !!W.npc};   // 見送っても消えない（気が変わったら戻れる）
});

/* ============ 3. 戦闘とスキル ============ */

// 3-a. 敵はプレイヤーではなく「最も近い味方」を狙う
R.targeting = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(6); S.hero.party=[];
  const a=makeAlly(6,S.hero); a.x=P.x+3; a.y=P.y; S.hero.party.push(a);
  const e={x:P.x+4, y:P.y};
  const t1=enemyTarget(e);
  const e2={x:P.x-4, y:P.y};
  const t2=enemyTarget(e2);
  return {nearAlly: t1.ent===a, nearPlayer: t2.ent===null,
          ok: t1.ent===a && t2.ent===null};
});

// 3-b. 仲間が実際に敵を削る（4秒回して敵HPが減る）
R.allyDamage = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(8); S.hero.party=[];
  const a=makeAlly(8,S.hero);
  a.job='knight'; a.equip.weapon=genBaseItem('great',8,1);   // 近接で確実に殴る
  a.hpNow=allyStats(a).maxHp;
  a.x=P.x+0.6; a.y=P.y; S.hero.party.push(a);
  // プレイヤーは武器を持たず、遠くの敵は消す。仲間だけが届く状況を作る
  S.hero.equip.weapon=null;
  W.enemies=W.enemies.filter(e=>e.boss);
  const dummy={x:P.x+1.4, y:P.y, arch:ARCH.find(x=>x.id==='turret')||ARCH[0],
    fam:FAMILY[0], lv:8, elite:false, aff:[], maxHp:99999, hp:99999, atkV:0, def:0,
    res:{}, dt:'slash', st:{}, bu:{}, state:'idle', t:0, cd:99, vx:0, vy:0,
    hit:0, tele:0, dead:false, r:0.34, ms:0, teleMul:1, col:'#b5563f', name:'的'};
  W.enemies=[dummy];
  const before=dummy.hp;
  stepSim(3.5);
  return {before, after:dummy.hp, dealt:before-dummy.hp, allyAlive:!a.dead,
          ok: dummy.hp<before};
});

// 3-c. 僧侶の「祈り」がパーティ全員を回復する
R.prayer = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(6); S.hero.party=[];
  const p=makeAlly(6,S.hero); p.job='priest'; p.prayCd=0.2;
  p.hpNow=allyStats(p).maxHp; p.x=P.x; p.y=P.y;
  const m=makeAlly(6,S.hero); m.job='rogue';
  m.hpNow=10; m.x=P.x; m.y=P.y;
  S.hero.party.push(p,m);
  W.enemies=[];                     // 邪魔されないように
  S.hero.hpNow=20;
  const hp0=S.hero.hpNow, ally0=m.hpNow;
  stepSim(1.2);
  return {playerBefore:hp0, playerAfter:Math.round(S.hero.hpNow),
          allyBefore:ally0, allyAfter:Math.round(m.hpNow),
          ok: S.hero.hpNow>hp0 && m.hpNow>ally0};
});

// 3-d. 戦士の「庇う」がプレイヤーの被ダメを肩代わりする
R.cover = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(6); S.hero.party=[];
  const w=makeAlly(6,S.hero); w.job='warrior';
  w.hpNow=allyStats(w).maxHp; w.x=P.x+0.4; w.y=P.y;
  S.hero.party.push(w);
  const e={x:P.x+1, y:P.y, lv:20, atkV:60, dt:'slash', dead:false, tele:0, cd:0};
  S.hero.hpNow=stats(S.hero).maxHp;
  const ph0=S.hero.hpNow, ah0=w.hpNow;
  hitPlayer(e);
  const covered = w.hpNow < ah0;
  // 離れると肩代わりしない
  w.x=P.x+9; w.hpNow=ah0;
  const ph1=S.hero.hpNow;
  hitPlayer(e);
  return {allyTook:Math.round(ah0-w.hpNow===0?0:ah0-w.hpNow),
          coveredWhenClose:covered, notCoveredWhenFar: w.hpNow===ah0,
          playerLostLess:(ph0-ph1)>0,
          ok: covered && w.hpNow===ah0};
});

/* ============ 4. 経験値の分配 ============ */
R.xp = await pg.evaluate(()=>{
  const measure=(n)=>{
    S.hero=newHero(); startRun(6); S.hero.party=[];
    for(let i=0;i<n;i++){ const a=makeAlly(6,S.hero); a.lv=1; a.xp=0; S.hero.party.push(a); }
    S.hero.lv=99; S.hero.xp=0;            // レベルアップで xp がリセットされないよう高レベルに
    livingParty().forEach(a=>{ a.lv=99; a.xp=0; });
    const share=grantXp(1000);
    return {playerXp:Math.round(S.hero.xp), share:Math.round(share),
            allyXp:livingParty().map(a=>Math.round(a.xp)),
            total:Math.round(S.hero.xp + livingParty().reduce((s,a)=>s+a.xp,0))};
  };
  const solo=measure(0), two=measure(1), four=measure(3);
  return {solo, two, four,
          soloGetsAll: solo.playerXp===1000,
          playerShareShrinks: four.playerXp < two.playerXp && two.playerXp < solo.playerXp,
          poolGrows: four.total > solo.total,
          evenSplit: four.allyXp.every(v=>Math.abs(v-four.playerXp)<=1),
          bonusPerMate: XP_PARTY_BONUS};
});

/* ============ 5. 仲間のロストと広告蘇生 ============ */
R.fallen = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10); S.hero.party=[];
  const a=makeAlly(10,S.hero);
  a.x=P.x; a.y=P.y; a.hpNow=5; S.hero.party.push(a);
  const gearBefore=['weapon','shield','armor','accessory'].filter(s=>a.equip[s]).length;
  const lvBefore=a.lv>1 ? a.lv : (a.lv=6);
  a.boons=[{id:'atk',rar:'uncommon'}];
  hitAlly(a, {lv:30, atkV:9999, dt:'blunt', dead:false});
  const modalOn=document.getElementById('m-fallen').classList.contains('on');
  const isDead=a.dead;
  const inPartyStill=party().includes(a);
  const notLiving=!livingParty().includes(a);
  // 蘇生（広告の完了コールバックを直接呼ぶ）
  reviveFallen();
  const adOn=document.getElementById('m-ad').classList.contains('on');
  const doneFn=_adDone;
  if(doneFn) doneFn();
  const gearAfter=['weapon','shield','armor','accessory'].filter(s=>a.equip[s]).length;
  return {lvBefore, gearBefore, modalOn, isDead, inPartyStill, notLiving, adOn,
          revivedFlag:a.revived, deadAfter:a.dead, lvAfter:a.lv, gearAfter,
          keptBoons:a.boons.length,
          hpFull: Math.round(a.hpNow)===allyStats(a).maxHp,
          resetToLv1: a.lv===1,
          lostSomeGear: gearAfter<gearBefore,
          backAlive: !a.dead && livingParty().includes(a)};
});

/* 5-b. 蘇生は「人ごとの権利」ではなく **5階ごとにパーティ共通で4回**。
       人ごとにすると、ボス戦で2人まとめて落ちた瞬間に打つ手が無くなり、
       逆に仲間が1人だけの人は権利も1つしか持てず常に不利だった。 */
R.reviveShared = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10); S.hero.party=[];
  const a=makeAlly(10,S.hero); a.x=P.x; a.y=P.y;
  const c=makeAlly(10,S.hero); c.x=P.x; c.y=P.y;
  S.hero.party.push(a,c);
  a.revived=true; a.revivedAt=10;          // 既に一度蘇生している体にする
  a.hpNow=1;
  hitAlly(a, {lv:30, atkV:9999, dt:'blunt', dead:false});
  const btn=document.getElementById('fal-revive');
  const canAgain = btn.className==='primary';      // 同じ相手でも、持ち分があれば押せる
  const body=document.getElementById('fal-body').textContent;
  const showsLeft = body.includes(String(REVIVE_PER_BAND));
  // 持ち分を使い切ると押せなくなる
  S.run.revLeft=0;
  openFallen(a);
  const blocked = document.getElementById('fal-revive').className==='ghost';
  const noAd = (reviveFallen(), !document.getElementById('m-ad').classList.contains('on'));
  const tellsWhen = document.getElementById('fal-body').textContent.includes('階層まで進めば');
  // 帯をまたぐと戻る
  S.run.depth=11;
  const backNextBand = revivesLeft()===REVIVE_PER_BAND && canRevive(a);
  S.run.depth=10;
  letFallenGo();
  return {per:REVIVE_PER_BAND, band:REVIVE_BAND,
          canAgainSamePerson:canAgain, showsLeft,
          blockedWhenSpent:blocked && noAd, tellsWhen, backNextBand,
          removedOnLetGo: !party().includes(a),
          ok: canAgain && blocked && noAd && backNextBand};
});

// 5-c. プレイヤーが死ぬと仲間ごと失われる
R.heroDeath = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(6); S.hero.party=[];
  S.hero.party.push(makeAlly(6,S.hero), makeAlly(6,S.hero));
  const had=party().length;
  S.hero.hpNow=1; die();
  const after=party().length;
  document.getElementById('m-death').classList.remove('on');
  return {had, after, heroGone:S.hero===null, ok: had===2 && after===0};
});

/* ============ 6. ユニーク敵 ============ */
R.unique = await pg.evaluate(()=>{
  let floors=0, withUniq=0, onBoss=0, names=new Set();
  for(let d=1;d<=60;d++) for(let s=0;s<6;s++){
    RNG=mulberry32(d*7919+s*13);
    const fl=genFloor(d);
    const es=spawnEnemies(fl,d);
    const u=es.filter(e=>e.uniq);
    floors++;
    if(u.length){ withUniq++; u.forEach(e=>names.add(e.name)); }
    if(bossTierAt(d) && u.length) onBoss++;
    if(u.length>1) onBoss+=100;                 // 1階層に2体出たら明確な失敗
  }
  const early=(()=>{ let n=0; for(let s=0;s<80;s++){ RNG=mulberry32(s*3);
    const fl=genFloor(2); if(spawnEnemies(fl,2).some(e=>e.uniq)) n++; } return n; })();
  return {floors, withUniq, rate:+(withUniq/floors*100).toFixed(1),
          distinctNames:names.size, onBossFloors:onBoss, atDepth2:early,
          neverOnBossFloor:onBoss===0, noneBeforeDepth3:early===0,
          appears: withUniq>20};
});

// 6-b. ユニークは通常敵より強く、ボスより弱い
R.uniqPower = await pg.evaluate(()=>{
  RNG=mulberry32(4242);
  const fl=genFloor(12);
  const es=spawnEnemies(fl,12);
  let u=es.find(e=>e.uniq);
  for(let i=0;!u && i<200;i++){ RNG=mulberry32(1000+i); const f2=genFloor(12);
    u=spawnEnemies(f2,12).find(e=>e.uniq); }
  const trash=es.find(e=>!e.uniq && !e.boss && !e.elite);
  RNG=mulberry32(99); const bf=genFloor(10);
  const boss=spawnEnemies(bf,10).find(e=>e.boss);
  return {uniqHp:u&&u.maxHp, trashHp:trash&&trash.maxHp, bossHp:boss&&boss.maxHp,
          strongerThanTrash: !!u && !!trash && u.maxHp>trash.maxHp*2,
          weakerThanBoss: !!u && !!boss && u.maxHp<boss.maxHp};
});

// 6-c. ユニークを倒すと潜在が出る／階段は塞がない
R.uniqKill = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(12); S.hero.party=[];
  let u=W.enemies.find(e=>e.uniq);
  if(!u){ u=makeUnique(W.fl,12,[FAMILY[0]]); W.enemies.push(u); }
  const blockedBefore = !!S.run.bossAlive;
  u.hp=1; killEnemy(u);
  const boonOpen=document.getElementById('m-boon').classList.contains('on');
  const choices=document.querySelectorAll('#boon-choices [data-boon]').length;
  const label=document.getElementById('boon-title').textContent;
  document.getElementById('m-boon').classList.remove('on'); _boonPending=null; S.screen='game';
  return {blockedBefore, boonOpen, choices, label,
          stairsFree: !S.run.bossAlive, ok: boonOpen && choices===3 && !S.run.bossAlive};
});

/* ============ 7. 潜在の付与先 ============ */
R.boonTarget = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10); S.hero.party=[];
  // 仲間がいなければ即プレイヤーへ
  openBoonPick('mid','試験体');
  const b0=_boonPending[0];
  document.querySelector('#boon-choices [data-boon="0"]').click();
  const soloWentToPlayer = S.hero.boons.some(x=>x.id===b0.id);
  const noTargetModal = !document.getElementById('m-btarget').classList.contains('on');

  // 仲間がいると付与先を選べる
  const a=makeAlly(10,S.hero); a.x=P.x; a.y=P.y; S.hero.party.push(a);
  openBoonPick('great','試験体');
  const b1=_boonPending[0];
  document.querySelector('#boon-choices [data-boon="0"]').click();
  const targetModal=document.getElementById('m-btarget').classList.contains('on');
  const rows=document.querySelectorAll('#bt-list [data-bt]').length;
  const namesShown=document.getElementById('bt-list').textContent;
  // 2番目（仲間）を選ぶ
  document.querySelector('#bt-list [data-bt="1"]').click();
  const allyGotIt = a.boons.some(x=>x.id===b1.id && x.rar===b1.rar);
  const playerDidnt = !S.hero.boons.some(x=>x===b1);
  // 仲間に効いているか（潜在が仲間のステータスに乗る）
  const before=allyStats(a);
  a.boons.push({id:'atk',rar:'rare'});
  const after=allyStats(a);
  return {soloWentToPlayer, noTargetModal, targetModal, rows,
          listsAlly: namesShown.includes(a.name),
          allyGotIt, playerDidnt,
          boonAffectsAlly: after.atk>before.atk,
          ok: soloWentToPlayer && targetModal && rows===2 && allyGotIt && after.atk>before.atk};
});

/* ============ 8. 第50階層のラスボス ============ */
R.finalBoss = await pg.evaluate(()=>{
  const tiers={};
  [5,10,15,20,25,30,35,40,45,50,55,60,100].forEach(d=>{ tiers[d]=bossTierAt(d); });
  RNG=mulberry32(50*7919);
  const fl=genFloor(50);
  const es=spawnEnemies(fl,50);
  const boss=es.find(e=>e.boss);
  RNG=mulberry32(40*7919);
  const g=spawnEnemies(genFloor(40),40).find(e=>e.boss);
  return {tiers, tierAt50:tiers[50], tierAt40:tiers[40],
          onlyAt50: tiers[50]==='final' && tiers[40]==='great' && tiers[45]==='mid',
          bossName:boss&&boss.name, bossHp:boss&&boss.maxHp, greatHp:g&&g.maxHp,
          hidden: boss && boss.revealed===false,
          atStairs: boss && Math.hypot(boss.x-fl.stair.x,boss.y-fl.stair.y)<0.01,
          muchTougher: !!boss && !!g && boss.maxHp > g.maxHp*1.8};
});

// 8-b. 撃破すると踏破画面 → final ティアの潜在（値が great より大きい）
R.finalKill = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(50);
  const boss=W.enemies.find(e=>e.boss);
  const clearedBefore=S.cleared;
  W.drops=[];
  boss.hp=1; killEnemy(boss);
  const clearOpen=document.getElementById('m-clear').classList.contains('on');
  const drops=W.drops.length;
  document.getElementById('clr-ok').click();
  const boonOpen=document.getElementById('m-boon').classList.contains('on');
  const tierText=document.getElementById('boon-title').textContent;
  /* 大ボスの3択は **コモンを出さず、レア以上を1つ確定**させる。
     ここは1回ぶんの観測なので、抽選そのものは boontest 側で数を回して確かめている。 */
  const offered=(_boonPending||[]).map(b=>b.rar);
  const noCommon = offered.length>0 && !offered.includes('common');
  const hasRare  = offered.some(r=>BOON_RAR_I[r]>=2);
  document.getElementById('m-boon').classList.remove('on'); _boonPending=null; S.screen='game';
  return {clearedBefore, clearedAfter:S.cleared, clearOpen, drops, boonOpen, tierText,
          offered, noCommon, hasRare,
          stairsOpen: !S.run.bossAlive,
          ok: clearOpen && S.cleared===clearedBefore+1 && boonOpen && noCommon && hasRare};
});

/* ============ 9. 実プレイ ============ */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:8,aspd:6}; S.hero.lv=20;
  S.hero.str=24; S.hero.dex=24; S.hero.vit=24;
  startRun(12); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('sword',20,2);
  S.hero.equip.armor =genBaseItem('plate',20,2);
  S.hero.hpNow=stats(S.hero).maxHp;
  for(let i=0;i<3;i++){
    const a=makeAlly(12,S.hero);
    a.x=P.x+rf(-1,1); a.y=P.y+rf(-1,1);
    uniqueAllyName(a, party()); S.hero.party.push(a);
  }
  /* 敵をパーティの周りに引き寄せて、実際に殴り合いが起きる状況にする。
     階層に湧いた 25 体を全部足元に積むと 5 回に 1 回は押し潰されて死ぬ。
     ここで見たいのは「パーティが機能するか」であって運試しではないので、
     一度に相手にする数は 8 体に抑え、残りは元の位置に置いておく。 */
  W.enemies.slice(0,8).forEach((e,i)=>{
    e.x=P.x+Math.cos(i/8*Math.PI*2)*2.4; e.y=P.y+Math.sin(i/8*Math.PI*2)*2.4; });
  const frames=stepSim(7, {draw:true});      // HUD も回す（描画で落ちないことも見る）
  return {ranSeconds:+(frames/60).toFixed(1),
          screen:S.screen, partyLeft:party().length,
          kills:S.run?S.run.kills:-1,
          heroAlive:!!S.hero,
          killedSomething: !!S.run && S.run.kills>0,
          hudRendered: document.getElementById('partybar').style.display==='flex'
                       || party().every(a=>a.dead)};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
