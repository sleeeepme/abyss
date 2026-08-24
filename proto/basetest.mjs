// 仲間の追従と生存力／耐久の警告／帰還の恩恵（帰還報酬・拠点開発・修理導線）
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

/* ============ 1. 仲間の追従（壁に引っかからない） ============ */

// 1-a. 足跡が残り、階層ごとに引き直される
R.trail = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(8); S.hero.party=[];
  const start=W.trail.length;
  for(let i=0;i<40;i++){ P.x+=0.3; pushTrail(); }
  const grown=W.trail.length;
  // 上限を超えても伸び続けない
  for(let i=0;i<200;i++){ P.x+=0.3; pushTrail(); }
  const capped=W.trail.length;
  enterFloor(9);
  return {start, grown, capped, cap:TRAIL_MAX, afterFloor:W.trail.length,
          grows: grown>start, bounded: capped<=TRAIL_MAX,
          resetsPerFloor: W.trail.length===1};
});

// 1-b. 迷路のような階層を歩き回っても、仲間が置いていかれない
R.following = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25;
  S.hero.str=29; S.hero.dex=29; S.hero.vit=29;
  startRun(30); S.hero.party=[];            // 通路の多い層で試す
  for(let i=0;i<3;i++){ const a=makeAlly(30,S.hero); a.x=P.x; a.y=P.y;
    uniqueAllyName(a,party()); S.hero.party.push(a); a.hpNow=allyStats(a).maxHp*99; }
  W.enemies=[];                              // 戦闘を排して追従だけを見る
  let worst=0;
  stepSim(9, {
    each:(t)=>{ stickDx=Math.cos(t*0.55); stickDy=Math.sin(t*0.9); },
    after:()=>{ livingParty().forEach(a=>{ worst=Math.max(worst, Math.hypot(a.x-P.x, a.y-P.y)); }); }
  });
  stickDx=0; stickDy=0;
  const whileMoving=livingParty().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1));
  // 立ち止まったら手元に戻ってくるか。走り続けている最中の距離ではなく、これが仕様。
  stepSim(1.5);
  const finals=livingParty().map(a=>+Math.hypot(a.x-P.x,a.y-P.y).toFixed(1));
  return {worstGap:+worst.toFixed(1), whileMoving, finalGaps:finals,
          allPresent: livingParty().length===3,
          // 走り回っている最中でも視界内なら直線で寄るので、大きく離れない
          keepsUpWhileMoving: worst<6,
          // 止まれば全員が手元に戻っている
          allBackClose: finals.every(d=>d<3),
          neverLostForever: worst<25};
});

// 1-c. 壁の中に取り残されても復帰する（最終手段のワープ）
R.unstick = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(12); S.hero.party=[];
  const a=makeAlly(12,S.hero); a.hpNow=allyStats(a).maxHp*99;
  S.hero.party.push(a);
  // 壁だらけの座標に置いて、確実に詰まらせる
  let wx=1, wy=1;
  outer: for(let y=1;y<W.fl.H-1;y++) for(let x=1;x<W.fl.W-1;x++){
    if(W.fl.g[y][x]===T.WALL && Math.hypot(x-P.x,y-P.y)>10){ wx=x+0.5; wy=y+0.5; break outer; }
  }
  a.x=wx; a.y=wy; a.stuck=0; a.crumb=0;
  const startGap=Math.hypot(a.x-P.x, a.y-P.y);
  stepSim(3.5);
  const endGap=Math.hypot(a.x-P.x, a.y-P.y);
  return {startGap:+startGap.toFixed(1), endGap:+endGap.toFixed(1),
          recovered: endGap < startGap*0.5 || endGap < 6,
          onFloor: W.fl.g[Math.floor(a.y)][Math.floor(a.x)]!==T.WALL};
});

/* ============ 2. 仲間の生存力 ============ */

// 2-a. ジョブごとに回避率が違い、盗賊が突出している
R.evadeTable = await pg.evaluate(()=>{
  const t={}; JOBS.forEach(j=>{ t[j.id]={evade:j.evade, bail:j.bail}; });
  const ev=JOBS.map(j=>j.evade);
  return {table:t,
          rogueHighest: t.rogue.evade===Math.max(...ev),
          rogueMuchHigher: t.rogue.evade >= t.knight.evade*4,
          allHaveBail: JOBS.every(j=>j.bail>0 && j.bail<1),
          tanksHoldLonger: t.knight.bail < t.rogue.bail};
});

// 2-b. 回避が実際にダメージを消す
R.evadeWorks = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  let lastWant=0;
  const measure=(job)=>{
    const a=makeAlly(10,S.hero); a.job=job;
    // 期待値は**この個体**から作る。作り直すとレベルがずれて比較にならない
    lastWant = jobDef(job).evade + allySkillSum(a).evade;
    a.equip.weapon=genBaseItem(jobDef(job).weapon,10,1);
    a.x=P.x; a.y=P.y;
    S.hero.party=[a];
    let dodged=0;
    const N=1200;
    for(let i=0;i<N;i++){
      a.hpNow=allyStats(a).maxHp; a.dead=false;
      const hp0=a.hpNow;
      hitAlly(a, {lv:10, atkV:20, dt:'blunt', dead:false});
      if(a.hpNow===hp0) dodged++;
    }
    document.getElementById('m-fallen').classList.remove('on');
    _fallen=null; _fallenQueue=[];
    return +(dodged/N*100).toFixed(1);
  };
  /* 期待値は「ジョブの素の回避 + そのレベルで習得済みの技」から作る。
     32 と決め打ちしていたが、Lv.10 で盗賊は「影足」(+8) を覚えるので、
     仲間のレベルが10を跨ぐだけで落ちるテストになっていた。 */
  const rogue=measure('rogue'), wr=lastWant;
  const knight=measure('knight'), wk=lastWant;
  return {roguePct:rogue, knightPct:knight, wantRogue:wr, wantKnight:wk,
          rogueNearJob: Math.abs(rogue-wr)<6,
          knightNearJob: Math.abs(knight-wk)<5,
          rogueDodgesMore: rogue>knight*3};
});

// 2-c. 単騎で群れに突っ込まない（交戦範囲のリーシュ）
R.leash = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(16); S.hero.party=[];
  const a=makeAlly(16,S.hero); a.job='knight';
  a.equip.weapon=genBaseItem('great',16,1);
  // 仲間が少し前に出ている状態。ここから先の敵に釣られるのが問題だった。
  a.x=P.x+4; a.y=P.y; a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  const st=allyStats(a);
  const mk=(x,y)=>({x, y, arch:ARCH[0], fam:FAMILY[0], lv:16, elite:false, aff:[],
    maxHp:999, hp:999, atkV:0, def:0, res:{}, dt:'slash', st:{}, bu:{},
    state:'idle', t:0, cd:9e9, vx:0, vy:0, hit:0, tele:0, dead:false, r:0.34,
    ms:0, teleMul:1, col:'#b5563f', name:'的'});
  // 近い敵（主人公のそば）と、遠い敵（仲間から見えるが主人公から遠い）
  // far は「仲間からは見えるが、主人公からは遠い」位置に置く
  const near=mk(P.x+2, P.y), far=mk(P.x+9, P.y);
  W.enemies=[near, far];
  const pickedNear = nearestEnemyNearPlayer(a.x,a.y,st.aggro,ALLY_ENGAGE)===near;
  // 近い敵を消すと、遠い敵は「見えていても」選ばれない
  near.dead=true;
  const picksNothing = nearestEnemyNearPlayer(a.x,a.y,st.aggro,ALLY_ENGAGE)===null;
  // リーシュ無しなら遠い敵を選んでしまう（これが今までの挙動）
  const wouldChase = nearestEnemyTo(a.x,a.y,st.aggro)===far;
  return {leash:ALLY_ENGAGE, pickedNear, picksNothing, wouldChaseWithoutLeash:wouldChase,
          ok: pickedNear && picksNothing};
});

// 2-d. 1対1なら近接の仲間はきちんと勝つ（弱すぎない）
R.duel = await pg.evaluate(async ()=>{
  const fight=async (job)=>{
    S.hero=newHero(); S.upg={hp:8}; S.hero.lv=22;
    S.hero.str=26; S.hero.dex=26; S.hero.vit=26;
    startRun(16); S.hero.party=[];
    const a=makeAlly(16,S.hero); a.job=job;
    a.equip.weapon=genBaseItem(jobDef(job).weapon,16,1);
    a.x=P.x+0.5; a.y=P.y; a.hpNow=allyStats(a).maxHp;
    S.hero.party.push(a);
    const as=allyStats(a);
    const e=W.enemies.find(x=>!x.boss);
    W.enemies=[e]; e.x=P.x+2; e.y=P.y;
    S.hero.equip.weapon=null;                 // 主人公は手出ししない
    stepSim(8, {after:()=>{ if(_fallen) letFallenGo(); }});
    document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
    _fallen=null; _fallenQueue=[];
    return {won:e.dead, allyAlive:!a.dead,
            hpLeft: a.dead?0:Math.round(a.hpNow/as.maxHp*100)};
  };
  const knight=await fight('knight'), rogue=await fight('rogue');
  return {knight, rogue,
          knightSurvives: knight.allyAlive,
          rogueSurvives: rogue.allyAlive};
});

/* ============ 3. 耐久の警告 ============ */

// 3-a. 残りわずかで警告が出っぱなしになる
R.durWarn = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const w=genBaseItem('sword',10,1);
  S.hero.equip.weapon=w;
  const tag=document.getElementById('durtag');
  w.dur=w.durMax; updateHUD();
  const healthy={shown:tag.style.display==='block'};
  w.dur=Math.ceil(w.durMax*0.2); updateHUD();
  const worn={shown:tag.style.display==='block', text:tag.textContent, cls:tag.className};
  w.dur=0; updateHUD();
  const broken={shown:tag.style.display==='block', text:tag.textContent, cls:tag.className};
  return {healthy, worn, broken, threshold:DUR_WARN,
          quietWhenFine: !healthy.shown,
          warnsWhenWorn: worn.shown && /耐久/.test(worn.text),
          shoutsWhenBroken: broken.shown && broken.cls==='crit'
                         && /壊れている/.test(broken.text)};
});

// 3-b. 壊れた瞬間にバナーとフラッシュが出る
R.breakAlert = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const w=genBaseItem('sword',10,1);
  S.hero.equip.weapon=w; w.dur=1;
  _banner=null; W.fx=[];
  damageGear('weapon', 1);
  const flash=W.fx.filter(f=>f.t==='break').length;
  const hurt =W.fx.filter(f=>f.t==='hurt').length;
  return {banner: _banner? {title:_banner.title, sub:_banner.sub, secs:_banner.max} : null,
          breakFlash:flash, hurtFlash:hurt, broken:isBroken(w),
          hasBanner: !!_banner && /壊れた/.test(_banner.title),
          hasFlash: flash>0 && hurt>0};
});

// 3-c. 壊れそうになった瞬間にログが出る（1回だけ）
R.warnOnce = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10); S.hero.party=[];
  const w=genBaseItem('mace',10,1);
  S.hero.equip.weapon=w;
  const warnAt=Math.ceil(w.durMax*DUR_WARN);
  logs=[];
  w.dur=warnAt+1; damageGear('weapon',1);       // 境界をまたぐ
  const first=logs.filter(l=>/壊れそう/.test(l)).length;
  damageGear('weapon',1); damageGear('weapon',1);
  const after=logs.filter(l=>/壊れそう/.test(l)).length;
  return {first, after, firesOnce: first===1 && after===1};
});

/* ============ 4. 帰還の恩恵 ============ */

// 4-a. 帰還報酬が出て、深いほど大きい
R.returnBonus = await pg.evaluate(()=>{
  const take=(depth)=>{
    S.hero=newHero(); S.gold=0; S.stash=[]; S.bld={};
    startRun(depth); S.hero.party=[];
    S.run.gold=0; S.run.loot=[];
    returnToTown();
    document.getElementById('m-ret').classList.remove('on');
    return S.gold;
  };
  const d5=take(5), d20=take(20), d45=take(45);
  return {d5, d20, d45,
          scalesWithDepth: d5<d20 && d20<d45,
          meaningfulAtDepth: d20>=300};
});

// 4-b. 帰還画面に報酬と修理の案内が出る
R.returnUI = await pg.evaluate(()=>{
  S.hero=newHero(); S.gold=0; S.stash=[]; S.bld={};
  startRun(18); S.hero.party=[];
  const w=genBaseItem('sword',18,1); w.dur=3;
  S.hero.equip.weapon=w;
  S.run.gold=120; S.run.loot=[];
  returnToTown();
  const t=document.getElementById('r-reward').textContent;
  document.getElementById('m-ret').classList.remove('on');
  return {text:t.replace(/\s+/g,' '),
          showsBonus:/帰還報酬/.test(t),
          showsRepair:/要修理/.test(t),
          showsZone:/階層/.test(t)};
});

// 4-c. 拠点メニューにも修理の必要が出る
R.repairHint = await pg.evaluate(()=>{
  setScreen('town');
  const sub=document.getElementById('m-shop-sub');
  const warned={text:sub.textContent, coloured:sub.style.color!==''};
  // 直すと消える
  S.gold=99999; repairables().forEach(it=>{ it.dur=it.durMax; });
  renderTown();
  const clean={text:sub.textContent, coloured:sub.style.color!==''};
  return {warned, clean,
          warnsWhenNeeded: /要修理/.test(warned.text) && warned.coloured,
          quietWhenClean: !/要修理/.test(clean.text)};
});

/* ============ 5. 拠点開発 ============ */

R.buildings = await pg.evaluate(()=>{
  S.bld={}; S.gold=999999;
  /* 引き継ぎ数は「積んだ潜在の半分まで」で頭打ちになるので、
     施設の効果だけを見たいここでは、上限に当たらないだけ持たせておく。 */
  if(!S.hero) S.hero=newHero();
  S.hero.boons=Array.from({length:12},(_,i)=>({id:BOONS[i%BOONS.length].id, rar:'common'}));
  const before={
    repair: repairDiscount(), dur: durBonus(), npc: npcChanceBonus(),
    gap: allyLevelGapCut(), boons: boonsInherited(),
    sell: sellBonus(), slots: shopSlotBonus()};
  BUILDINGS.forEach(b=>{ S.bld[b.id]=b.max; });
  const after={
    repair: repairDiscount(), dur: durBonus(), npc: npcChanceBonus(),
    gap: allyLevelGapCut(), boons: boonsInherited(),
    sell: sellBonus(), slots: shopSlotBonus()};
  return {count:BUILDINGS.length, before, after,
          repairCheaper: after.repair<before.repair,
          gearTougher:  after.dur>before.dur,
          moreAllies:   after.npc>before.npc,
          betterAllies: after.gap>before.gap,
          inheritsBoons:after.boons>0,
          sellsHigher:  after.sell>before.sell,
          moreStock:    after.slots>before.slots};
});

// 5-b. 実際に買える（タップの導線込み）
R.buyBuilding = await pg.evaluate(()=>{
  S.bld={}; S.gold=999999;
  setScreen('bld');
  const cards=document.querySelectorAll('#buildings [data-bld]').length;
  const forge=document.querySelector('[data-bld="forge"]');
  const g0=S.gold;
  forge.click();
  const lv=bldLv('forge');
  const cost=bldCost(BUILDINGS.find(b=>b.id==='forge'),0);
  setScreen('town');
  return {cards, expected:BUILDINGS.length, lv, spent:g0-S.gold, cost,
          renders: cards===BUILDINGS.length,
          bought: lv===1 && (g0-S.gold)===cost};
});

// 5-c. 金が足りなければ買えない／最大なら買えない
R.buildingLimits = await pg.evaluate(()=>{
  S.bld={}; S.gold=0;
  setScreen('bld');
  document.querySelector('[data-bld="altar"]').click();
  const poor=bldLv('altar');
  S.gold=999999;
  const b=BUILDINGS.find(x=>x.id==='altar');
  for(let i=0;i<8;i++){ setScreen('bld'); document.querySelector('[data-bld="altar"]').click(); }
  const capped=bldLv('altar');
  setScreen('town');
  return {poor, capped, max:b.max,
          blockedWhenPoor: poor===0, cappedAtMax: capped===b.max};
});

// 5-d. 祭壇があると、死んでも潜在が次のキャラへ渡る
R.altar = await pg.evaluate(()=>{
  const trial=(lv)=>{
    S.bld={altar:lv}; S.legacyBoons=[];
    S.hero=newHero(); startRun(10); S.hero.party=[];
    /* レア度の高い順に残る。引き継ぎ数の上限は「持っている数の半分」なので、
       3つ残す検証をするには最低6つ要る。 */
    S.hero.boons=[{id:'hp',rar:'epic'},{id:'atk',rar:'rare'},
                  {id:'aspd',rar:'uncommon'},{id:'crit',rar:'uncommon'},
                  {id:'ms',rar:'common'},{id:'def',rar:'common'}];
    S.hero.hpNow=1; die();
    document.getElementById('m-death').classList.remove('on');
    const kept=S.legacyBoons.map(b=>b.id);
    const next=newHero();
    return {kept, nextHas:next.boons.length};
  };
  const none=trial(0), one=trial(1), three=trial(3);
  return {none, one, three,
          noneWithoutAltar: none.nextHas===0,
          inheritsOne: one.nextHas===1,
          inheritsThree: three.nextHas===3,
          // 価値の高い潜在から残る
          keepsBest: one.kept[0]==='hp'};
});

/* ============ 6. 実プレイ ============ */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:6}; S.hero.lv=25; S.bld={forge:2,tavern:2,altar:1,market:2};
  S.hero.str=29; S.hero.dex=29; S.hero.vit=29;
  startRun(20); S.hero.party=[];
  for(let i=0;i<3;i++){ const a=makeAlly(20,S.hero); a.x=P.x; a.y=P.y;
    uniqueAllyName(a,party()); S.hero.party.push(a); }
  S.hero.equip.weapon=genBaseItem('sword',25,2);
  S.hero.equip.armor=genBaseItem('plate',25,2);
  S.hero.hpNow=stats(S.hero).maxHp;
  // 敵をパーティの周りに寄せて、実際に戦闘が起きる状況にする
  W.enemies.forEach((e,i)=>{ e.x=P.x+Math.cos(i)*3.2; e.y=P.y+Math.sin(i)*3.2; });
  stepSim(8, {
    each:(t)=>{ stickDx=Math.cos(t*0.6)*0.4; stickDy=Math.sin(t*0.85)*0.4; },
    after:()=>{ if(_fallen) letFallenGo(); }
  });
  stickDx=0; stickDy=0;
  return {kills:S.run?S.run.kills:'(死亡)', alive:!!S.hero,
          partyLeft:S.hero?livingParty().length:0,
          loopAlive:_tickCount>300};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
