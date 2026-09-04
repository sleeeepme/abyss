// 武器種 / 耐久 / 盾・ガード・パリイ の検証
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(350);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

// --- 1. 武器種ごとに射程・攻撃速度・扇形・手数が違う
R.weapons = await pg.evaluate(()=>{
  const out={};
  const mk=(id)=>{ const b=BASES.find(x=>x.id===id);
    return {reach:b.reach, spd:b.spd, arc:b.arc, hands:b.hands, proj:b.proj||null, dur:b.dur}; };
  ['dagger','sword','axe','great','bow','staff'].forEach(id=>out[id]=mk(id));
  const reaches=Object.values(out).map(w=>w.reach);
  const spds=Object.values(out).map(w=>w.spd);
  return {table:out, allReachDistinct:new Set(reaches).size===6, allSpdDistinct:new Set(spds).size===6};
});

// --- 2. 装備した武器が実際に stats の射程・扇形・手数へ反映される
R.statsFromWeapon = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero();
  const eqp=(id)=>{ let g=null; for(let i=0;i<4000&&!g;i++){ const x=genItem(20,0); if(x.base===id) g=x; }
    g.ident=true; S.hero.equip.weapon=g; return stats(S.hero); };
  const d=eqp('dagger'), gr=eqp('great'), bw=eqp('bow');
  return {daggerRange:+d.range.toFixed(2), greatRange:+gr.range.toFixed(2), bowRange:+bw.range.toFixed(2),
          daggerFaster: d.aspd>gr.aspd, greatIsTwoHanded: gr.hands===2, bowIsProjectile: bw.proj==='arrow',
          daggerOneHanded: d.hands===1};
});

// --- 3. 耐久: 生成時に満タン、攻撃で減る、0で破損＝性能を失う
R.durability = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero(); startRun(1);
  let w=null; for(let i=0;i<4000&&!w;i++){ const x=genItem(10,0); if(x.base==='sword') w=x; }
  w.ident=true; S.hero.equip.weapon=w;
  const full = w.dur===w.durMax && w.durMax>0;
  const atkWithWeapon = stats(S.hero).atk;

  // 攻撃を大量に打って減るか
  const before=w.dur;
  for(let i=0;i<400;i++){ P.atkCd=0; playerAttack(); }
  const dropped = w.dur<before;

  // 0 にして破損の挙動
  w.dur=0;
  const brokenAtk = stats(S.hero).atk;
  const nameShows = itemName(w).includes('破損');
  const cost = repairCost(w);
  return {full, dropped, wearPerHit:+((before-w.dur)/400).toFixed(3),
          brokenLosesPower: brokenAtk<atkWithWeapon, brokenIsFist: Math.abs(brokenAtk-(FIST.atk+stats(S.hero).str*1.1))<0.5,
          nameShowsBroken:nameShows, repairCostPositive:cost>0};
});

// --- 4. 修理で元に戻り、金が減る
R.repair = await pg.evaluate(()=>{
  S.gold=100000; setScreen('town');
  const w=S.hero.equip.weapon; w.dur=0;
  const cost=repairCost(w), g0=S.gold;
  setScreen('shop');
  document.querySelector(`[data-fix="${w.uid}"]`).click();
  const ok = w.dur===w.durMax && S.gold===g0-cost;
  setScreen('town');
  return {repaired:ok, cost};
});

// --- 5. 盾がドロップ候補に入っている
R.shieldDrops = await pg.evaluate(()=>{
  RNG=mulberry32(2024);
  const c={weapon:0,shield:0,armor:0,accessory:0};
  for(let i=0;i<20000;i++) c[genItem(20,0).slot]++;
  const pct=k=>+(c[k]/20000*100).toFixed(1);
  return {weapon:pct('weapon'), shield:pct('shield'), armor:pct('armor'), accessory:pct('accessory')};
});

// --- 6. ガード: 軽減される / 盾の耐久が減る
R.guard = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero(); startRun(1);
  let sh=null; for(let i=0;i<6000&&!sh;i++){ const x=genItem(14,0); if(x.base==='round') sh=x; }
  // 拾い物なのでレア度はまちまち。壊れにくさが混ざると耐久消費が読めないので、
  // 付帯効果を外すのと同じ理由で素の Common にそろえる。
  sh.ident=true; sh.aff=[]; sh.rar=0; sh.up=0; sh._wear=0;
  S.hero.equip.shield=sh;
  const st=stats(S.hero);
  S.upg={hp:8};                       // 1発で死なないようHPを盛る（死ぬと S.hero が null になる）
  const sample=(guard)=>{ P.guard=guard; P.guardStart=-99;   // 押しっぱなし扱い
    let tot=0; const mx=stats(S.hero).maxHp;
    for(let i=0;i<400;i++){ S.hero.hpNow=mx; sh.dur=sh.durMax; hitPlayer(null,40,0,5); tot+=mx-S.hero.hpNow; }
    return tot/400; };
  const open=sample(false), blocked=sample(true);
  // 耐久消費
  sh.dur=sh.durMax; P.guard=true; P.guardStart=-99;
  S.hero.hpNow=stats(S.hero).maxHp; hitPlayer(null,40,0,5);
  const durSpent = sh.durMax - sh.dur;
  P.guard=false;
  return {block:st.block, parryWin:+st.parryWin.toFixed(2),
          open:+open.toFixed(1), blocked:+blocked.toFixed(1),
          reduction:+(1-blocked/open).toFixed(2), shieldDurSpent:durSpent};
});

// --- 7. パリイ: 構えた直後だけ成立、押しっぱなしでは成立しない
R.parry = await pg.evaluate(()=>{
  const sh=S.hero.equip.shield;
  const mx=stats(S.hero).maxHp;
  const st=stats(S.hero);
  // 構えた瞬間 = パリイ
  S.hero.hpNow=mx; sh.dur=sh.durMax;
  P.guard=true; P.guardStart=nowSec();
  const parried = hitPlayer(null,40,0,5)===true && S.hero.hpNow===mx && sh.dur===sh.durMax;
  // 受付時間を過ぎたあと = ただのガード
  S.hero.hpNow=mx; sh.dur=sh.durMax;
  P.guardStart=nowSec()-(st.parryWin+0.2);
  const notParried = hitPlayer(null,40,0,5)===false && S.hero.hpNow<mx;
  // 盾なしでは押しても無効
  const bak=S.hero.equip.shield; S.hero.equip.shield=null;
  S.hero.hpNow=mx; P.guardStart=nowSec();
  const noShieldNoParry = hitPlayer(null,40,0,5)===false && S.hero.hpNow<mx;
  S.hero.equip.shield=bak; P.guard=false;
  return {parriedOnRaise:parried, notParriedWhenHeld:notParried, noShieldNoParry};
});

// --- 8. 敵の弾もパリイで消える
R.parryProjectile = await pg.evaluate(async ()=>{
  S.hero=newHero(); startRun(1);
  let sh=null; for(let i=0;i<6000&&!sh;i++){ const x=genItem(14,0); if(x.slot==='shield') sh=x; }
  sh.ident=true; S.hero.equip.shield=sh;
  const mx=stats(S.hero).maxHp; S.hero.hpNow=mx;
  S.upg={hp:8};
  const mx2=stats(S.hero).maxHp; S.hero.hpNow=mx2;
  keys['shift']=1;                      // 実際の入力経路で構える
  W.fx.push({t:'bolt',x:P.x+0.2,y:P.y,vx:0,vy:0,life:1,dmg:40,lv:5,fire:0});
  await new Promise(r=>setTimeout(r,120));
  const gone = !W.fx.some(f=>f.t==='bolt');
  keys['shift']=0;
  return {boltRemoved:gone, tookNoDamage:S.hero.hpNow===mx2};
});

// --- 9. 両手武器はガード中に攻撃できない / 片手はできる
R.twoHanded = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(1);
  let sh=null,gs=null,sw=null;
  for(let i=0;i<8000&&(!sh||!gs||!sw);i++){ const x=genItem(14,0);
    if(!sh&&x.slot==='shield') sh=x;
    if(!gs&&x.base==='great') gs=x;
    if(!sw&&x.base==='sword') sw=x; }
  [sh,gs,sw].forEach(i=>i.ident=true);
  S.hero.equip.shield=sh;
  const test=(w)=>{ S.hero.equip.weapon=w; const st=stats(S.hero);
    P.guard=true;  const guarded=canAttackNow(st);
    P.guard=false; const free=canAttackNow(st);
    return {guarded, free}; };
  const g=test(gs), s=test(sw);
  return {greatBlockedWhileGuarding: g.guarded===false && g.free===true,
          swordStillAttacks: s.guarded===true};
});

// --- 10. ガード中は移動が鈍る（実プレイ）
await pg.evaluate(()=>{ setScreen('game'); });
R.guardSlow = await pg.evaluate(async ()=>{
  S.hero=newHero(); startRun(1);
  let sh=null; for(let i=0;i<6000&&!sh;i++){ const x=genItem(14,0); if(x.slot==='shield') sh=x; }
  sh.ident=true; S.hero.equip.shield=sh;
  W.enemies=[];
  const run=async(guard)=>{ const r=W.fl.rooms[0]; P.x=r.cx+0.5; P.y=r.cy+0.5;
    if(guard) keys['shift']=1;
    const x0=P.x; keys['d']=1;
    await new Promise(r2=>setTimeout(r2,500)); keys['d']=0; keys['shift']=0;
    return P.x-x0; };
  const free=await run(false), guarded=await run(true);
  return {free:+free.toFixed(2), guarded:+guarded.toFixed(2), slower: guarded < free*0.85};
});

/* ============ 壊れにくさ：レア度と強化段 ============
   良い物を拾っても数階で砕けるなら、良い物を拾った意味が残らない。 */

// レア度が上がるほど、同じ回数使ったときに減る量が少ない
R.rarityToughens = await pg.evaluate(()=>{
  const wearOf=(rar)=>{
    const it=genBaseItem('sword',10,1);
    it.rar=rar; it.up=0; it._wear=0; it.durMax=100000; it.dur=100000;
    S.hero.equip.weapon=it;
    for(let i=0;i<2000;i++) damageGear('weapon',1);
    return {lost:it.durMax-it.dur, integer: Number.isInteger(it.dur)};
  };
  const w=[0,1,2,3,4].map(wearOf);
  const lost=w.map(x=>x.lost);
  return {lost, muls:[0,1,2,3,4].map(r=>gearDurMul({rar:r,up:0})),
          allIntegers: w.every(x=>x.integer),
          commonUnchanged: lost[0]===2000,          // 素の Common は今まで通り
          eachTierTougher: lost.every((v,i)=>i===0 || v < lost[i-1]),
          relicMuchTougher: lost[4] < lost[0]*0.4,
          ok: lost[0]===2000 && lost.every((v,i)=>i===0 || v<lost[i-1])
              && lost[4] < lost[0]*0.4 && w.every(x=>x.integer)};
});

// 鍛えるたびに耐久は満タンに戻り、上限の伸び幅そのものが段ごとに大きくなる
R.upgradeRepairsAndGrows = await pg.evaluate(()=>{
  S.gold=99999999; S.ore={raw:999,fine:999,deep:999};
  const it=genBaseItem('sword',10,1);
  it.rar=0; it.up=0; it._wear=0;
  S.hero.equip.weapon=it;
  const start=it.durMax;
  it.dur=Math.floor(it.durMax*0.2);                 // 傷んだ状態から鍛える
  const worn=it.dur;
  doUpgrade(it,false);
  const healedOnFirst = it.dur===it.durMax;
  const caps=[it.durMax];
  for(let k=2;k<=10;k++){ it.dur=1; doUpgrade(it,false); caps.push(it.durMax); }
  const steps=caps.map((c,i)=> i===0 ? c-start : c-caps[i-1]);
  return {start, worn, caps, steps, lv:it.up,
          healedOnFirst,
          healedEveryTime: it.dur===it.durMax,
          reachedMax: it.up===UP_MAX,
          grewOverall: it.durMax > start*2.5,
          stepsAccelerate: steps[steps.length-1] > steps[0]*2,
          maxIsTough: gearDurMul({rar:0,up:UP_MAX}) > 2,
          ok: healedOnFirst && it.dur===it.durMax && it.up===UP_MAX
              && it.durMax > start*2.5 && steps[steps.length-1] > steps[0]*2
              && gearDurMul({rar:0,up:UP_MAX}) > 2};
});

// --- 12. 装備の強さは名前そのもので分かる。レア度ごとに土台の名前が変わる
//         （冴えた、などの接頭辞・接尾辞は今まで通りその前後に付く）
R.tieredNaming = await pg.evaluate(()=>{
  const missing = BASES.filter(b=>!b.nmByRar || b.nmByRar.length!==5);
  const notAllUnique = BASES.filter(b=>b.nmByRar && new Set(b.nmByRar).size!==5);
  // sword を各レア度で強制生成し、土台名がラダー通りに変わることを見る
  const sword = BASES.find(b=>b.id==='sword');
  const names = [0,1,2,3,4].map(rid=>{
    const it = buildItem(sword, RARITY[rid], 10);
    return it.nm;
  });
  const matchesLadder = names.every((nm,i)=>nm===sword.nmByRar[i]);
  const commonUnchanged = names[0]==='剣';         // 白は今まで通りの表記
  const risesInGrandeur = names[2]==='ミスリルソード' && names[4]==='聖剣';
  // 接頭辞・接尾辞は相変わらず nm の前後に巻く（itemName 側の仕組みは触っていない）
  let prefixed=null;
  for(let i=0;i<4000 && !prefixed;i++){
    const it=buildItem(sword, RARITY[3], 30);
    it.ident=true;
    const p=it.aff.find(a=>a.t==='p');
    if(p) prefixed = itemName(it).includes(p.nm) && itemName(it).includes(it.nm);
  }
  // レジェンドは既存の固有名のまま、ラダーの影響を受けない
  const lg = makeLegend('levantine');
  const legendUnaffected = lg && lg.nm === legendDef(lg).nm && lg.nm === 'レヴァンテイン';
  return {names, missingCount:missing.length, notAllUniqueCount:notAllUnique.length,
          allBasesHaveLadder: missing.length===0,
          allLaddersDistinct: notAllUnique.length===0,
          matchesLadder, commonUnchanged, risesInGrandeur,
          affixStillWraps: !!prefixed,
          legendUnaffected: !!legendUnaffected,
          ok: missing.length===0 && notAllUnique.length===0 && matchesLadder
              && commonUnchanged && risesInGrandeur && !!prefixed && !!legendUnaffected};
});

// --- 13. 10層まではドロップの色が制限される（青は STONE_MAGIC_MUL 倍、黄以上は封印）
R.lowDepthRarityCap = await pg.evaluate(()=>{
  const N=6000;
  const sample=(ilvl,depth)=>{
    const counts={0:0,1:0,2:0,3:0,4:0};
    for(let i=0;i<N;i++){ const r=rollRarity(ilvl, 0, depth); counts[r.id]++; }
    return counts;
  };
  RNG=mulberry32(42);
  const gated = sample(10, 8);          // 8層（<=10）
  RNG=mulberry32(42);
  const ungated = sample(10, undefined); // depth省略＝今まで通り
  RNG=mulberry32(42);
  const beyond = sample(10, 25);         // 25層（>20）は制限なし
  const gatedRarePlus = gated[2]+gated[3]+gated[4];
  const ungatedRarePlus = ungated[2]+ungated[3]+ungated[4];
  const beyondRarePlus = beyond[2]+beyond[3]+beyond[4];
  const gatedMagicShare = gated[1]/N, ungatedMagicShare = ungated[1]/N;
  // 生の重みは「青は STONE_MAGIC_MUL 倍・黄以上ゼロ」だが、母数が縮む分だけ
  // 正規化後の割合は単純な掛け算にはならない——実装と同じ式で解析的に期待値を出して比べる。
  const boost = 1 + 0/100 + 10*0.004;
  const wCommon=60, wMagic=28*boost, wRare=10*boost, wUniq=1.8*boost, wRelic=0.2*boost;
  const ungatedTot = wCommon+wMagic+wRare+wUniq+wRelic;
  const gatedTot = wCommon + wMagic*STONE_MAGIC_MUL;
  const expectedGatedMagicShare = (wMagic*STONE_MAGIC_MUL)/gatedTot;
  const expectedUngatedMagicShare = wMagic/ungatedTot;
  const closeEnough=(got,expect)=>Math.abs(got-expect)<0.03;   // N=6000での統計誤差ぶんの余裕
  return {gated, ungated, beyond, mul:STONE_MAGIC_MUL,
          gatedRarePlus, ungatedRarePlus, beyondRarePlus,
          gatedMagicShare:+gatedMagicShare.toFixed(3), ungatedMagicShare:+ungatedMagicShare.toFixed(3),
          expectedGatedMagicShare:+expectedGatedMagicShare.toFixed(3),
          expectedUngatedMagicShare:+expectedUngatedMagicShare.toFixed(3),
          noRarePlusUnderCap: gatedRarePlus===0,
          rarePlusExistsNormally: ungatedRarePlus>0,
          rarePlusExistsBeyondCap: beyondRarePlus>0,
          gatedMagicMatchesFormula: closeEnough(gatedMagicShare, expectedGatedMagicShare),
          ungatedMagicMatchesFormula: closeEnough(ungatedMagicShare, expectedUngatedMagicShare),
          ok: gatedRarePlus===0 && ungatedRarePlus>0 && beyondRarePlus>0
              && closeEnough(gatedMagicShare, expectedGatedMagicShare)
              && closeEnough(ungatedMagicShare, expectedUngatedMagicShare)};
});

// --- 13b. 11〜20層（水の層）は紫以上は野放しのまま、黄(Rare)だけ SUMP_RARE_MUL で絞る。
//          狙いは「水の層の黄ドロップ率 ≒ 石の層の青ドロップ率」で、階層帯を跨いでも
//          体感の希少さが揃うこと。
R.sumpRarityGate = await pg.evaluate(()=>{
  const N=6000;
  const sample=(ilvl,depth)=>{
    const counts={0:0,1:0,2:0,3:0,4:0};
    for(let i=0;i<N;i++){ const r=rollRarity(ilvl, 0, depth); counts[r.id]++; }
    return counts;
  };
  RNG=mulberry32(7);
  const stone = sample(8, 8);    // 石の層・8層
  RNG=mulberry32(7);
  const sump  = sample(18, 18);  // 水の層・18層
  RNG=mulberry32(7);
  const beyond= sample(18, 25);  // 21層以降は Rare も野放し

  const stoneMagicShare = stone[1]/N;
  const sumpRareShare   = sump[2]/N;
  const sumpUniqPlus    = sump[3]+sump[4];
  const beyondUniqPlus  = beyond[3]+beyond[4];

  // 解析式で期待値を出す（Common:60, Magic:自然重み, Rare: *SUMP_RARE_MUL）
  const boostStone = 1+8*0.004, boostSump = 1+18*0.004;
  const stoneTot = 60 + 28*boostStone*STONE_MAGIC_MUL;
  const expectedStoneMagicShare = (28*boostStone*STONE_MAGIC_MUL)/stoneTot;
  const sumpTot = 60 + 28*boostSump + 10*boostSump*SUMP_RARE_MUL + 1.8*boostSump + 0.2*boostSump;
  const expectedSumpRareShare = (10*boostSump*SUMP_RARE_MUL)/sumpTot;
  const closeEnough=(got,expect,tol)=>Math.abs(got-expect)<tol;

  return {stoneMagicShare:+stoneMagicShare.toFixed(3), sumpRareShare:+sumpRareShare.toFixed(3),
          expectedStoneMagicShare:+expectedStoneMagicShare.toFixed(3),
          expectedSumpRareShare:+expectedSumpRareShare.toFixed(3),
          sumpUniqPlus, beyondUniqPlus,
          matchesFormula: closeEnough(sumpRareShare, expectedSumpRareShare, 0.03),
          // 「水の黄 ≒ 石の青」——ぴったり一致ではなく、体感が揃う程度の近さでよい
          balancedAcrossZones: closeEnough(sumpRareShare, stoneMagicShare, 0.035),
          uniqPlusNotBlockedInSump: sumpUniqPlus>0,
          uniqPlusExistsBeyond: beyondUniqPlus>0,
          ok: closeEnough(sumpRareShare, expectedSumpRareShare, 0.03)
              && closeEnough(sumpRareShare, stoneMagicShare, 0.035)
              && sumpUniqPlus>0 && beyondUniqPlus>0};
});

// --- 14. 重装鎧は移動速度・攻撃速度の両方が下がる
R.plateSpeedPenalty = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero();
  const bare = stats(S.hero);
  // Common(rar 0, aff:[0,0]) で強制生成——接頭辞・接尾辞の速度系affixが
  // 紛れ込むと、防具種そのものの効果を測れなくなる
  const plate = buildItem(BASES.find(b=>b.id==='plate'), RARITY[0], 10); plate.ident=true;
  S.hero.equip.armor = plate;
  const withPlate = stats(S.hero);
  const leather = buildItem(BASES.find(b=>b.id==='leather'), RARITY[0], 10); leather.ident=true;
  S.hero.equip.armor = leather;
  const withLeather = stats(S.hero);
  return {bareMs:+bare.ms.toFixed(3), plateMs:+withPlate.ms.toFixed(3), leatherMs:+withLeather.ms.toFixed(3),
          bareAspd:+bare.aspd.toFixed(3), plateAspd:+withPlate.aspd.toFixed(3), leatherAspd:+withLeather.aspd.toFixed(3),
          msLowerThanBare: withPlate.ms < bare.ms,
          aspdLowerThanBare: withPlate.aspd < bare.aspd,
          msLowerThanOtherArmor: withPlate.ms < withLeather.ms,
          aspdLowerThanOtherArmor: withPlate.aspd < withLeather.aspd,
          otherArmorUnaffected: Math.abs(withLeather.ms - bare.ms) < 0.001,
          ok: withPlate.ms < bare.ms && withPlate.aspd < bare.aspd
              && withPlate.ms < withLeather.ms && withPlate.aspd < withLeather.aspd
              && Math.abs(withLeather.ms - bare.ms) < 0.001};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
