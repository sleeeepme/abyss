import assert from 'node:assert/strict';
import {boot,install,done} from './_h.mjs';
const {b,pg,errs}=await boot();await install(pg);const R={};
try{
await pg.evaluate(()=>{
  TH.growthSetup=(open=true)=>{
    S.hero=newHero();S.hero.party=[];S.hero.boons=[];S.artUses={};S.relicEq=[];S.upg={};
    S.cleared2=open?{30:1}:{};S.arts={sword:3};S.artPick={sword:'swspin'};
    S.hero.equip.weapon=buildItem(BASES.find(b=>b.id==='sword'),RARITY[0],5);
    TH.run(1,{seed:77});TH.floor(6);TH.immortal();
    const e=W.enemies[0];e.dead=false;e.boss=false;e.parts=null;e.hp=e.maxHp=1e8;
    e.x=P.x+1;e.y=P.y;e.ms=0;e.atkV=0;e.st={};W.enemies=[e];
    P.atkCd=999;P.artCd=0;P.dirx=1;P.diry=0;stepSim(1/60);P.atkCd=999;
    W.arts=[];W.fx=[];setScreen('none');
    return e;
  };
});
R.unlockBoundary=await pg.evaluate(()=>{
  TH.growthSetup(false);const d=artDef('swspin');
  S.deepest=31;S.bossClear=30;fireArt(d,S.hero);
  const before=!artGrowthOpen() && artUseCount(d)===0 && artGrowthLevel(d)===1;
  markFloorCleared(29);const at29=!artGrowthOpen();markFloorCleared(30);
  const after=artGrowthOpen() && artUseCount(d)===0;
  fireArt(d,S.hero);
  return {before,at29,after,count:artUseCount(d),ok:before&&at29&&after&&artUseCount(d)===1};
});
R.thresholds=await pg.evaluate(()=>{
  TH.growthSetup();const d=artDef('swspin'),rows=[];
  for(let i=0;i<=205;i++){
    if([0,19,20,59,60,119,120,199,200,205].includes(i))rows.push([i,artUseCount(d),artGrowthLevel(d)]);
    if(i<205)fireArt(d,S.hero);
  }
  return {rows,ok:JSON.stringify(rows)===JSON.stringify([[0,0,1],[19,19,1],[20,20,2],[59,59,2],[60,60,3],[119,119,3],[120,120,4],[199,199,4],[200,200,5],[205,200,5]])};
});
R.castOnceAndFailedInput=await pg.evaluate(()=>{
  TH.growthSetup();const d=artDef('swmulti');fireArt(d,S.hero);
  for(let i=0;i<80;i++)tickArts(1/60);
  const once=artUseCount(d)===1;
  S.artPick.sword='swmulti';setScreen('game');P.artCd=99;
  const rejected=firePlayerArt()===false && artUseCount(d)===1;
  const run=S.run;S.run=null;const noRun=fireArt(d,S.hero)===false;S.run=run;
  const actor=S.hero;actor.dead=true;const dead=fireArt(d,actor)===false;actor.dead=false;
  setScreen('none');
  return {once,rejected,noRun,dead,count:artUseCount(d),ok:once&&rejected&&noRun&&dead&&artUseCount(d)===1};
});
R.snapshotAndTier=await pg.evaluate(()=>{
  TH.growthSetup();const d=artDef('swmulti');S.artUses.swmulti=19;
  fireArt(d,S.hero);const pending=W.arts.find(f=>f.def?.id===d.id);
  const snapshot=pending.def.mult===d.mult && artGrowthLevel(d)===2;
  const grown=artGrowthDef(d,S.hero);
  const tier=artTier(grown)===3;
  const power=Math.abs(grown.mult/d.mult-1.1)<1e-9;
  const unchanged=d.mult===0.78;
  return {snapshot,tier,power,unchanged,ok:snapshot&&tier&&power&&unchanged};
});
R.actualDamageAndSupport=await pg.evaluate(()=>{
  const e=TH.growthSetup(),d=artDef('swspin');
  const damage=()=>{RNG=mulberry32(123);const hp=e.hp;fireArt(d,S.hero);return hp-e.hp;};
  const normal=damage();S.artUses.swspin=200;const grown=damage();
  const ratio=grown/normal;
  const heal=artDef('mcheal');S.artUses.mcheal=200;
  const healing=artGrowthDef(heal,S.hero).healPct;
  const mirage=artDef('dgmirage'),shield=artDef('mcshield');
  S.artUses.dgmirage=200;S.artUses.mcshield=200;
  const stableDuration=artGrowthDef(mirage,S.hero).t===mirage.t;
  const cooldown=artCooldown(shield,false)/(ART_CD[2]);
  const all=ART_BASES.flatMap(base=>artsOf(base)).every(def=>{
    S.artUses[def.id]=200;const effective=artGrowthDef(def,S.hero);
    return artTier(effective)===artTier(def) && Math.abs(artCooldown(def,false)/ART_CD[artTier(def)-1]-.88)<1e-9
      && (!def.mult||Math.abs(effective.mult/def.mult-1.4)<1e-9);
  });
  return {normal,grown,ratio,healing,stableDuration,cooldown,all,
    ok:normal>0&&Math.abs(ratio-1.4)<.08&&Math.abs(healing-12.6)<1e-9&&stableDuration&&Math.abs(cooldown-.88)<1e-9&&all};
});
R.allySeparateAndAutomatic=await pg.evaluate(()=>{
  TH.growthSetup();const a=makeAlly(6,S.hero,'warrior'),other=makeAlly(6,S.hero,'warrior');
  a.x=P.x;a.y=P.y;a.arts={sword:3};a.artUses={swmulti:19};a.wartCd=0;
  S.hero.party=[a];S.artUses={swmulti:60};
  tickAllyWeaponArt(a,allyStats(a),1/60);
  const def=artDef('swmulti'),count=artUseCount(def,a),owner=artUseCount(def),separate=artUseCount(def,other)===0;
  const allyCD=artCooldown(def,true,a),expected=ART_CD[2]*ART_ALLY_CD_MUL*.97;
  return {count,owner,separate,allyCD,ok:count===20&&owner===60&&separate&&Math.abs(allyCD-expected)<1e-9};
});
R.deathAndStone=await pg.evaluate(()=>{
  TH.growthSetup();S.artUses={swspin:60};S.hero.equip.accessory=null;
  const a=makeAlly(6,S.hero,'warrior');a.stone=true;a.artUses={swmulti:120};a.arts={sword:3};
  S.hero.party=[a];S.stoneWait=[];S.fallen=[];
  die();const heroKept=S.artUses.swspin===60;
  S.hero=newHero();S.hero.party=[];S.run=null;stoneReturn();
  const returned=[...party(),...tavernStock()].find(m=>m.uidA===a.uidA);
  return {heroKept,allyKept:returned?.artUses?.swmulti===120,
    ok:heroKept&&returned?.artUses?.swmulti===120};
});
R.menuProgress=await pg.evaluate(()=>{
  TH.growthSetup();S.artUses={swspin:60};setScreen('bag');
  const hero=el('bag-arts').textContent;
  const a=makeAlly(6,S.hero,'warrior');a.arts={sword:3};a.artUses={swmulti:120};S.hero.party=[a];
  openAllyEquip(a,'bag');const ally=el('ae-skills').textContent;
  return {hero:hero.includes('Lv.3/5')&&hero.includes('60/120回'),ally:ally.includes('Lv.4/5')&&ally.includes('120/200回'),
    ok:hero.includes('Lv.3/5')&&hero.includes('60/120回')&&ally.includes('Lv.4/5')&&ally.includes('120/200回')};
});
await pg.screenshot({path:'/tmp/abyss-art-growth-ally.png'});
await pg.evaluate(()=>{closeAllyEquip();setScreen('bag');});
await pg.screenshot({path:'/tmp/abyss-art-growth-hero.png'});
assert.deepEqual(errs,[]);for(const [name,r]of Object.entries(R))assert.equal(r.ok,true,name+': '+JSON.stringify(r));
}finally{await done(b,errs,R);}
