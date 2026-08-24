// 鍛冶場での修理 / 護符の受け渡し / 仲間ロストの秘石 / 弔いの潜在。
//
// この4つは別々の機能に見えて、1本の線でつながっている:
//   「注いだ物が消えて終わり」にしない、という一点。
//   鉱石は修理にも回せる。護符は誰に持たせるか選べる。
//   仲間を失っても秘石は残るし、弔いを持っていればその損が牙になる。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 鍛冶場での修理（鉱石で払う） ================= */

// 1-a. 傷んだ武器が鉱石で満タンに戻る。等級は安いほうから減る。
R.repair = await pg.evaluate(()=>{
  TH.run(1, {seed:3}); TH.floor(12);
  const it=genBaseItem('sword', 20, 2); it.ident=true;
  S.hero.equip.weapon=it;
  it.dur = Math.floor(it.durMax*0.25);          // 4分の1まで削れている
  S.run.ore = {raw:20, fine:5, deep:2};
  const need = repairOreCost(it);
  const before = {dur:it.dur, ore:{...S.run.ore}};
  const r = doRepairWithOre(it, true);
  return {need, before, after:{dur:it.dur, ore:{...S.run.ore}},
          result:r,
          full: it.dur===it.durMax,
          paid: (before.ore.raw - S.run.ore.raw)===need,
          // 安い等級から減る＝深鉱は最後まで残る
          keptDeep: S.run.ore.deep===2 && S.run.ore.fine===5,
          ok: r.ok && it.dur===it.durMax && (before.ore.raw-S.run.ore.raw)===need};
});

// 1-b. 壊れた（耐久0）武器も直る。性能が戻ることまで見る。
R.repairBroken = await pg.evaluate(()=>{
  TH.run(1, {seed:5}); TH.floor(14);
  const it=genBaseItem('sword', 24, 2); it.ident=true;
  S.hero.equip.weapon=it;
  it.dur = 0;
  const wasBroken = isBroken(it);
  const atkBroken = Math.round(stats(S.hero).atk);
  S.run.ore = {raw:30};
  const r = doRepairWithOre(it, true);
  const atkFixed = Math.round(stats(S.hero).atk);
  return {wasBroken, atkBroken, atkFixed, cost:r.need,
          nowFine: !isBroken(it),
          powerBack: atkFixed > atkBroken,
          ok: wasBroken && r.ok && !isBroken(it) && atkFixed>atkBroken};
});

// 1-c. 等級を問わない（深部で粗鉱が出なくても直せる）／足りなければ1つも減らない
R.repairAnyGrade = await pg.evaluate(()=>{
  TH.run(1, {seed:7}); TH.floor(40);
  const it=genBaseItem('great', 40, 2); it.ident=true;
  S.hero.equip.weapon=it;
  it.dur = 1;
  // 深部の袋。粗鉱はもう出ない階層
  S.run.ore = {deep:30};
  const need=repairOreCost(it);
  const r1 = doRepairWithOre(it, true);
  const paidDeep = 30 - S.run.ore.deep;

  // 足りない場合は何も減らさない
  it.dur = 1;
  S.run.ore = {raw:1};
  const before = S.run.ore.raw;
  const r2 = doRepairWithOre(it, true);
  return {need, paidDeep, deepWorks:r1.ok,
          refused:!r2.ok, why:r2.why,
          nothingSpent: S.run.ore.raw===before,
          stillHurt: it.dur===1,
          ok: r1.ok && paidDeep===need && !r2.ok && S.run.ore.raw===before && it.dur===1};
});

// 1-d. 拠点の鍛造所は口座の鉱石、道中の鍛冶場はそのランの鉱石（金とまったく同じ扱い）
R.repairPurse = await pg.evaluate(()=>{
  TH.run(1, {seed:9}); TH.floor(16);
  const it=genBaseItem('sword', 20, 2); it.ident=true;
  S.hero.equip.weapon=it;
  S.ore = {raw:50}; S.run.ore = {raw:50};
  it.dur = 1; doRepairWithOre(it, true);        // 道中
  const midTook = 50 - S.run.ore.raw, acctUntouched = S.ore.raw===50;
  it.dur = 1; doRepairWithOre(it, false);       // 拠点
  const townTook = 50 - S.ore.raw, runUntouched = S.run.ore.raw===(50-midTook);
  return {midTook, townTook, acctUntouched, runUntouched,
          ok: midTook>0 && townTook>0 && acctUntouched && runUntouched};
});

// 1-e. 画面が実際に描かれ、ボタンが押せる
R.repairUI = await pg.evaluate(()=>{
  TH.run(1, {seed:11}); TH.floor(18);
  const it=genBaseItem('sword', 20, 2); it.ident=true;
  S.hero.equip.weapon=it; it.dur=Math.floor(it.durMax*0.3);
  S.run.ore={raw:40};
  W.forge={x:P.x, y:P.y, seed:0};
  interact();                                   // 鍛冶場が開く
  const opened=TH.open('m-forge');
  const label=el('fg-fix').textContent;
  const enabled=el('fg-fix').className!=='ghost';
  el('fg-fix').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const durAfter=it.dur;
  const labelAfter=el('fg-fix').textContent;
  closeForge();
  return {opened, label, enabled, durAfter, durMax:it.durMax, labelAfter,
          fixedByTap: durAfter===it.durMax,
          // 直し終えたら「もう傷んでいない」と言う（押せるままだと空振りする）
          tellsWhenFine: labelAfter.includes('傷んでいる装備は無い'),
          ok: opened && enabled && durAfter===it.durMax
              && labelAfter.includes('傷んでいる装備は無い')};

  /* 修理は装備をまとめて直す形になった（武器だけでは足りなかった）。
     防具ぶんの検証は下の R.repairAllSlots が受け持つ。 */
});

/* 1-f. 防具・盾・装飾品もまとめて直る。値段は合計。
   最初は武器だけだった。武器が使えなくなるのが一番痛いと思っていたが、
   実際は防具のほうが先に切れる（被弾ごとに減るので消耗が速い）。 */
R.repairAllSlots = await pg.evaluate(()=>{
  TH.run(1, {seed:21}); TH.floor(20);
  const mk=(base)=>{ const it=genBaseItem(base, 20, 2); it.ident=true; return it; };
  const w=mk('sword'), ar=mk('plate'), sh=mk('round');
  S.hero.equip.weapon=w; S.hero.equip.armor=ar; S.hero.equip.shield=sh;
  w.dur=1; ar.dur=0; sh.dur=Math.floor(sh.durMax*0.5);   // 鎧は破損している
  S.run.ore={raw:200};

  const list=repairablesOf(S.hero).map(x=>x.slot);
  const need=repairAllOreCost(S.hero);
  const parts=[w,ar,sh].map(repairOreCost).reduce((a,b)=>a+b,0);
  const before=S.run.ore.raw;
  const r=doRepairAll(S.hero, true);
  const allFull=[w,ar,sh].every(x=>x.dur===x.durMax);
  const paid=before-S.run.ore.raw;

  // 足りなければ1つも直さない（半端に直ると、何に払ったのか分からない）
  w.dur=1; ar.dur=1;
  S.run.ore={raw:1};
  const r2=doRepairAll(S.hero, true);
  return {list, need, parts, paid, allFull, fixed:r.fixed, names:r.names,
          armourIncluded: list.includes('armor'),
          shieldIncluded: list.includes('shield'),
          costIsSum: need===parts,
          refusedWhenShort: !r2.ok,
          nothingSpent: S.run.ore.raw===1 && w.dur===1 && ar.dur===1,
          ok: r.ok && allFull && list.includes('armor') && list.includes('shield')
              && need===parts && paid===need && !r2.ok
              && S.run.ore.raw===1 && w.dur===1};
});

// 1-g. 装飾品も対象。仲間のぶんも直せる。
R.repairAccessoryAndAlly = await pg.evaluate(()=>{
  TH.run(1, {seed:25}); TH.floor(20);
  let ring=null;
  for(let i=0;i<300 && !ring;i++){
    const it=genItem(20,0);
    if(it.slot===SLOT.C && !isConsum(it) && it.durMax) ring=it;
  }
  if(!ring) return {skipped:true, ok:false};
  ring.ident=true; ring.dur=1;
  S.hero.equip.accessory=ring;

  const a=makeAlly(20,S.hero); a.boons=[];
  a.equip.armor=genBaseItem('plate',20,2); a.equip.armor.ident=true;
  a.equip.armor.dur=1;
  a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  S.run.ore={raw:200};

  const heroList=repairablesOf(S.hero).map(x=>x.slot);
  doRepairAll(S.hero, true);
  const ringFull=ring.dur===ring.durMax;

  const allyList=repairablesOf(a).map(x=>x.slot);
  const ra=doRepairAll(a, true);
  const allyFull=a.equip.armor.dur===a.equip.armor.durMax;
  return {heroList, allyList, ringFull, allyFull, allyFixed:ra.fixed,
          accessoryIncluded: heroList.includes('accessory'),
          worksForAlly: ra.ok && allyFull,
          ok: heroList.includes('accessory') && ringFull && ra.ok && allyFull};
});

/* ================= 2. 護符を仲間に渡す ================= */

// 2-a. 護符は持ち主にだけ効く（全員には乗らない）
R.charmOwner = await pg.evaluate(()=>{
  TH.run(1, {seed:13}); TH.floor(10);
  const a=makeAlly(10, S.hero); a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  const swift=Object.assign({}, CHARMS.find(c=>c.id==='swift'), {owner:null});
  S.run.charms=[swift];

  const heroWith = stats(S.hero).ms, allyWithout = allyStats(a).ms;
  giveCharm(swift, a);                          // 仲間へ渡す
  const heroAfter = stats(S.hero).ms, allyAfter = allyStats(a).ms;
  giveCharm(swift, null);                       // 自分に戻す
  const heroBack = stats(S.hero).ms;
  return {heroWith:+heroWith.toFixed(3), heroAfter:+heroAfter.toFixed(3),
          heroBack:+heroBack.toFixed(3),
          allyWithout:+allyWithout.toFixed(3), allyAfter:+allyAfter.toFixed(3),
          heroLosesIt: heroAfter < heroWith,     // 渡すと自分からは消える
          allyGainsIt: allyAfter > allyWithout,
          reversible: Math.abs(heroBack-heroWith) < 1e-6,
          ok: heroAfter<heroWith && allyAfter>allyWithout
              && Math.abs(heroBack-heroWith)<1e-6};
});

// 2-b. 治癒の護符は持ち主だけを助ける
R.charmHeal = await pg.evaluate(()=>{
  TH.run(1, {seed:15}); TH.floor(10);
  const a=makeAlly(10, S.hero); a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  const heal=Object.assign({}, CHARMS.find(c=>c.id==='heal'), {owner:null});
  S.run.charms=[heal];
  W.enemies.length=0;

  // 自分が持っている → 瀕死で全回復する
  S.hero.hpNow = Math.round(stats(S.hero).maxHp*0.2);
  hitPlayer(null, 1, 'blunt', 3);
  const healedWhenMine = S.hero.hpNow === stats(S.hero).maxHp;

  // 仲間に渡す → 自分は助からない
  S.run.healUsed=false;
  giveCharm(heal, a);
  S.hero.hpNow = Math.round(stats(S.hero).maxHp*0.2);
  const before=S.hero.hpNow;
  hitPlayer(null, 1, 'blunt', 3);
  const notHealedWhenGiven = S.hero.hpNow < before + 5;   // 減りこそすれ全回復しない
  return {healedWhenMine, notHealedWhenGiven,
          hp:S.hero.hpNow, max:stats(S.hero).maxHp,
          ok: healedWhenMine && notHealedWhenGiven};
});

// 2-c. 仲間を失うと、持たせていた護符も一緒に消える
R.charmLost = await pg.evaluate(()=>{
  TH.run(1, {seed:17}); TH.floor(12);
  const a=makeAlly(12, S.hero); a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  S.run.charms=[Object.assign({}, CHARMS.find(c=>c.id==='guard'), {owner:a.uidA}),
                Object.assign({}, CHARMS.find(c=>c.id==='luck'),  {owner:null})];
  a.dead=true;
  const lost=dropCharmsOf(a);
  return {lostNames:lost.map(c=>c.nm), left:S.run.charms.map(c=>c.nm),
          tookAllyCharm: lost.length===1 && lost[0].id==='guard',
          keptMine: S.run.charms.length===1 && S.run.charms[0].id==='luck',
          ok: lost.length===1 && lost[0].id==='guard' && S.run.charms.length===1};
});

// 2-d. 仲間の画面から実際にタップで渡せる
R.charmUI = await pg.evaluate(()=>{
  TH.run(1, {seed:19}); TH.floor(10);
  const a=makeAlly(10, S.hero); a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a, party()); S.hero.party.push(a);
  S.run.charms=[Object.assign({}, CHARMS.find(c=>c.id==='fury'), {owner:null})];
  openAllyEquip(a, 'game');
  const shown = el('ae-charms').innerHTML.includes('猛りの護符');
  const row = el('ae-charms').querySelector('[data-aecharm]');
  row.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const nowAlly = S.run.charms[0].owner===a.uidA;
  const label = el('ae-charms').textContent;
  el('ae-charms').querySelector('[data-aecharm]')
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const backToHero = S.run.charms[0].owner==null;
  closeAllyEquip();
  return {shown, nowAlly, backToHero,
          saysHolder: label.includes('このプレイヤーが持っている'),
          ok: shown && nowAlly && backToHero && label.includes('このプレイヤーが持っている')};
});

/* ================= 3. 仲間を失うと秘石が残る ================= */

R.lossShards = await pg.evaluate(()=>{
  TH.run(1, {seed:23}); TH.floor(20);
  S.shards=0; S.shardsRun=0;
  const a=makeAlly(20, S.hero); a.lv=18; a.hpNow=0; a.dead=true;
  uniqueAllyName(a, party()); S.hero.party.push(a);
  const expect=allyLossShards(a);
  openFallen(a);
  const shownInModal = el('fal-body').textContent.includes(String(expect));
  letFallenGo();
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  return {expect, shards:S.shards, shardsRun:S.shardsRun, shownInModal,
          gone: party().length===0,
          banked: S.shards===expect,
          // レベルに比例＝わざと失って稼げない（Lv.1 は最低値）
          lv1: allyLossShards({lv:1}), lv40: allyLossShards({lv:40}),
          scalesWithLevel: allyLossShards({lv:1}) < allyLossShards({lv:20}),
          capped: allyLossShards({lv:400}) <= 30,
          ok: S.shards===expect && expect>0 && party().length===0 && shownInModal
              && allyLossShards({lv:1})<allyLossShards({lv:20})
              && allyLossShards({lv:400})<=30};
});

/* ================= 4. 弔いの潜在 ================= */

// 4-a. 仲間を失うと発火し、攻撃力と攻撃速度が跳ね、時間で切れる
R.avenge = await pg.evaluate(()=>{
  TH.run(1, {seed:29}); TH.floor(22);
  /* 敵を退けてから測る。残しておくと 20 秒のあいだに経験値が入って
     素の攻撃力そのものが上がり、「切れたのに戻らない」ように見える
     （実際そう見えて、一度この検証で引っかかった）。 */
  TH.clearEnemies(); TH.immortal();
  S.hero.boons=[{id:'avenge', rar:'rare'}];        // レア = +130%
  const a=makeAlly(22, S.hero); a.dead=true; a.hpNow=0;
  uniqueAllyName(a, party()); S.hero.party.push(a);

  const before={atk:stats(S.hero).atk, aspd:stats(S.hero).aspd};
  const quietFirst = (S.hero.avengeT||0)===0;
  openFallen(a); letFallenGo();
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const lit = S.hero.avengeT;
  const during={atk:stats(S.hero).atk, aspd:stats(S.hero).aspd};

  setScreen('game');
  stepSim(AVENGE_SECONDS/2);                       // 半分だけ進める
  const mid = S.hero.avengeT;
  const stillOn = stats(S.hero).atk > before.atk*1.5;
  stepSim(AVENGE_SECONDS/2 + 1);                   // 切れるまで
  const after={atk:stats(S.hero).atk, aspd:stats(S.hero).aspd};

  const mul = boonValue('avenge','rare');
  return {quietFirst, lit, mid:+mid.toFixed(1), mul,
          atk:[Math.round(before.atk), Math.round(during.atk), Math.round(after.atk)],
          aspd:[+before.aspd.toFixed(2), +during.aspd.toFixed(2), +after.aspd.toFixed(2)],
          ignited: lit===AVENGE_SECONDS,
          doublesAtk: Math.abs(during.atk/before.atk - (1+mul/100)) < 0.02,
          doublesAspd: Math.abs(during.aspd/before.aspd - (1+mul/100)) < 0.02,
          stillOnHalfway: stillOn,
          expires: Math.abs(after.atk-before.atk) < 0.01,
          ok: quietFirst && lit===AVENGE_SECONDS
              && Math.abs(during.atk/before.atk-(1+mul/100))<0.02
              && Math.abs(during.aspd/before.aspd-(1+mul/100))<0.02
              && stillOn && Math.abs(after.atk-before.atk)<0.01};
});

// 4-b. 持っていない者には何も起きない（喪失そのものが強化なのではない）
R.avengeNeedsBoon = await pg.evaluate(()=>{
  TH.run(1, {seed:31}); TH.floor(22);
  S.hero.boons=[];
  const a=makeAlly(22, S.hero); a.dead=true; a.hpNow=0;
  uniqueAllyName(a, party()); S.hero.party.push(a);
  const before=stats(S.hero).atk;
  openFallen(a); letFallenGo();
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const after=stats(S.hero).atk;
  return {timer:S.hero.avengeT||0, before:Math.round(before), after:Math.round(after),
          noTimer: !(S.hero.avengeT>0),
          noBuff: Math.abs(after-before)<0.01,
          ok: !(S.hero.avengeT>0) && Math.abs(after-before)<0.01};
});

// 4-c. 仲間側が持っていても効く
R.avengeOnAlly = await pg.evaluate(()=>{
  TH.run(1, {seed:37}); TH.floor(24);
  S.hero.boons=[];
  const keeper=makeAlly(24, S.hero); keeper.hpNow=allyStats(keeper).maxHp;
  keeper.boons=[{id:'avenge', rar:'uncommon'}];
  uniqueAllyName(keeper, party()); S.hero.party.push(keeper);
  const doomed=makeAlly(24, S.hero); doomed.dead=true; doomed.hpNow=0;
  uniqueAllyName(doomed, party()); S.hero.party.push(doomed);

  const before=allyStats(keeper).atk;
  openFallen(doomed); letFallenGo();
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const during=allyStats(keeper).atk;
  return {timer:keeper.avengeT, before:Math.round(before), during:Math.round(during),
          heroUnaffected: !(S.hero.avengeT>0),
          allyLit: keeper.avengeT===AVENGE_SECONDS,
          allyStronger: during>before,
          ok: keeper.avengeT===AVENGE_SECONDS && during>before && !(S.hero.avengeT>0)};
});

// 4-d. 潜在の抽選に入っていて、文言が読める
R.avengeListed = await pg.evaluate(()=>{
  const d=boonDef('avenge');
  const texts=BOON_RAR.map(r=>boonText('avenge', r.id));
  let seen=0;
  for(let i=0;i<400;i++) if(rollBoons('mid',3).some(b=>b.id==='avenge')) seen++;
  return {nm:d.nm, texts, seen,
          inPool: seen>0,
          saysSeconds: texts[0].includes(String(AVENGE_SECONDS)),
          ok: !!d && seen>0 && texts[0].includes(String(AVENGE_SECONDS))};
});

/* ================= 5. 実プレイで例外なく回る ================= */
R.live = await pg.evaluate(()=>{
  const fails=[];
  try{
    TH.run(1, {seed:41}); TH.floor(15);
    S.hero.boons=[{id:'avenge', rar:'uncommon'}];
    for(let i=0;i<2;i++){
      const a=makeAlly(15,S.hero); a.x=P.x; a.y=P.y;
      uniqueAllyName(a,party()); S.hero.party.push(a);
      a.hpNow=allyStats(a).maxHp;
    }
    S.run.charms=[Object.assign({}, CHARMS.find(c=>c.id==='guard'), {owner:party()[0].uidA}),
                  Object.assign({}, CHARMS.find(c=>c.id==='swift'), {owner:null})];
    TH.immortal();          // ここで見たいのは「例外なく1周する」ことだけ。死ぬと話が変わる
    S.hero.equip.weapon.dur=Math.max(1, Math.floor(S.hero.equip.weapon.durMax*0.2));
    S.run.ore={raw:30};
    W.forge={x:P.x+1, y:P.y+1, seed:0};
    W.enemies.slice(0,5).forEach((e,i)=>{ e.x=P.x+Math.cos(i)*2.2; e.y=P.y+Math.sin(i)*2.2; });
    stepSim(5, {draw:true, each:(t)=>{ stickDx=Math.cos(t*0.8); stickDy=Math.sin(t*1.1); }});
    stickDx=0; stickDy=0;
    // 鍛冶場で直す
    P.x=W.forge.x; P.y=W.forge.y;
    interact();
    const forgeOpen=TH.open('m-forge');
    el('fg-fix').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const repaired=S.hero.equip.weapon.dur===S.hero.equip.weapon.durMax;
    closeForge();
    setScreen('game');
    stepSim(2, {draw:true});
    return {failures:fails, forgeOpen, repaired,
            alive:!!S.hero, screen:S.screen, loopAlive:_tickCount>200,
            ok: forgeOpen && repaired && !!S.hero};
  }catch(e){ fails.push(e.message); return {failures:fails, ok:false}; }
});

await done(b, errs, R);
