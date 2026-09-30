/* 灯り（蛍石）の仕様。
   ・明るさ 1〜10。10 が今までの明るさ。LIGHT_STEP 秒ごとに 1 段暗くなり、1 より下がらない
   ・味方1人・眷属1体につき +1（上限 10）
   ・蛍石を拾う／商人から買うと新しい灯り（10）に替わる
   ・巡回者は「明るさ1で過ごした時間」で来る（潜った時間ではない）
   ・灯りの外の敵は黒い影、明るさ3以下では見えない */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};

R.lightDecays = await pg.evaluate(()=>{
  TH.run(8,{seed:3}); S.hero.party=[];
  const start = lightLevel();
  S.run.elapsed += LIGHT_STEP*3 + 1; const after3 = lightLevel();
  S.run.elapsed += LIGHT_STEP*20;    const floor = lightLevel();
  return {start, after3, floor, ok: start===10 && after3===7 && floor===1};
});

R.alliesAndKinAdd = await pg.evaluate(()=>{
  TH.run(8,{seed:3}); S.hero.party=[];
  S.run.stoneAt = S.run.elapsed - LIGHT_STEP*5 - 1;          // 灯りそのものは 5
  const alone = lightLevel();
  const a1=TH.ally(8,'knight',10), a2=TH.ally(8,'mage',10); S.hero.party.push(a1,a2);
  const withTwo = lightLevel();
  S.hero.boons = (S.hero.boons||[]).concat([{id:'kin',rar:'common'}]);
  const withKin = lightLevel();
  S.run.stoneAt = S.run.elapsed;                              // 新しい灯り
  const capped = lightLevel();
  S.hero.boons = S.hero.boons.filter(x=>x.id!=='kin'); S.hero.party=[];   // 後の検査に持ち越さない
  return {alone, withTwo, withKin, capped, ok: alone===5 && withTwo===7 && withKin===8 && capped===10};
});

R.stonePickupResets = await pg.evaluate(()=>{
  TH.run(8,{seed:3}); S.hero.party=[];
  S.run.elapsed += LIGHT_STEP*8 + 1; const before = lightLevel();
  W.drops.push({x:P.x, y:P.y, stone:true});
  autoPickup();
  return {before, after: lightLevel(), ok: before===2 && lightLevel()===10 && !W.drops.some(d=>d.stone)};
});

R.merchantSellsStone = await pg.evaluate(()=>{
  TH.run(12,{seed:3}); S.hero.party=[];
  let m=null; for(let i=0;i<200 && !m;i++) m=spawnMerchant(W.fl, 12, []);
  W.shop=m;
  const st=m.stock.find(x=>x.stone);
  S.run.elapsed += LIGHT_STEP*6 + 1; const before=lightLevel();
  S.run.gold = st.price + 5;
  const r=buyFromMerchant(st.uid);
  return {price:st.price, before, after:lightLevel(), gold:S.run.gold,
          ok: !!st && r.ok && r.stone && before===4 && lightLevel()===10 && S.run.gold===5 && !m.stock.includes(st)};
});

R.glowingFoesDropStones = await pg.evaluate(()=>{
  TH.run(12,{seed:3}); S.hero.party=[];
  const fam=FAMILY.find(f=>f.id==='flame'), arch=ARCH.find(a=>a.id==='turret');
  const plain=FAMILY.find(f=>f.id==='beast'), parch=ARCH.find(a=>a.id==='rush');
  let glow=0, dull=0;
  for(let i=0;i<600;i++){
    W.drops=[];
    const e=W.enemies[0]; Object.assign(e,{fam, arch, elite:false, uniq:false, boss:false, dead:false, hp:1});
    killEnemy(e); if(W.drops.some(d=>d.stone)) glow++;
    W.drops=[];
    Object.assign(e,{fam:plain, arch:parch, dead:false, hp:1});
    killEnemy(e); if(W.drops.some(d=>d.stone)) dull++;
  }
  return {glow, dull, ok: glow>10 && glow<90 && dull===0};
});

R.intruderComesOnlyInTheDark = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); TH.floor(8); S.hero.party=[]; TH.immortal();
  // 長く潜っていても、灯りがあるうちは来ない
  S.run.stoneAt = S.run.elapsed = 5000; S.run.darkT=0;
  for(let i=0;i<30;i++) stepSim(1);
  const brightNoIntruder = !liveIntruder() && (S.run.darkT||0)===0;
  // 灯りが尽きる（明るさ1）と時計が進み、INTRUDER_AFTER 秒で来る
  S.run.stoneAt = S.run.elapsed - LIGHT_STEP*12;
  const lv = lightLevel();
  for(let i=0;i<INTRUDER_AFTER-5;i++) stepSim(1);
  const notYet = !liveIntruder();
  for(let i=0;i<8;i++) stepSim(1);
  return {lv, brightNoIntruder, notYet, came: !!liveIntruder(), darkT:+(S.run.darkT||0).toFixed(1),
          ok: lv===1 && brightNoIntruder && notYet && !!liveIntruder()};
});

R.foesOutsideLightAreShadowsThenHidden = await pg.evaluate(()=>{
  TH.run(8,{seed:12}); setScreen('game'); S.hero.party=[]; CAVE.lightSnap=true;
  const e=W.enemies.find(x=>!x.boss); W.enemies=[e]; Object.assign(e,{ms:0, atkV:0, lurk:0, dead:false});
  const at=(L,d)=>{ S.run.stoneAt=S.run.elapsed-(10-L)*LIGHT_STEP-1; e.x=P.x+d; e.y=P.y; draw(); return enemyLit(e); };
  const r={near10:at(10,2), far10:at(10,9), far6:at(6,6.2), near3:at(3,1.5), far3:at(3,4)};
  CAVE.lightSnap=false;
  return {...r, ok: r.near10==='lit' && r.far10==='shadow' && r.far6==='shadow' && r.near3==='lit' && r.far3==='hidden'};
});

R.lightShrinksTheLantern = await pg.evaluate(()=>{
  TH.run(8,{seed:12}); setScreen('game'); S.hero.party=[]; CAVE.lightSnap=true; CAVE.noFlicker=true;
  const at=(L)=>{ S.run.stoneAt=S.run.elapsed-(10-L)*LIGHT_STEP-1; draw(); return {lit:CAVE.litTiles, vis:CAVE.visTiles}; };
  const a=at(10), m=at(5), z=at(1);
  CAVE.lightSnap=false; CAVE.noFlicker=false;
  return {a, m, z, ok: a.lit>m.lit && m.lit>z.lit && z.lit<1.5 && a.vis>m.vis && m.vis>z.vis && z.vis<3.5};
});

await done(b, errs, R);
