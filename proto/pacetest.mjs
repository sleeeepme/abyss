// 進行度連動のガチャ／深度による敵系統の解禁／ボスの被弾で正体が割れる、の検証
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(350);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ============ 1. ガチャ ============ */

// 1-a. 帯の選択が lastDepth だけで決まる（deepest には引きずられない）
R.band = await pg.evaluate(()=>{
  const pick=(last,deepest)=>{ S.lastDepth=last; S.deepest=deepest; return gachaBand().nm; };
  return {
    d1  : pick(1, 60),      // 通算60階まで行っていても、直近が1階なら浅層
    d4  : pick(4, 60),
    d5  : pick(5, 5),
    d9  : pick(9, 9),
    d10 : pick(10, 10),
    d19 : pick(19, 19),
    d20 : pick(20, 20),
    d30 : pick(30, 30),
    d99 : pick(99, 99),
    ignoresDeepest: pick(1,60)==='浅層'
  };
});

// 1-b. 排出レア度の分布。浅層では Rare 以上が稀、最深では主流になる
R.rates = await pg.evaluate(()=>{
  const sample=(last, n)=>{
    S.lastDepth=last;
    const c={charm:0, rar:[0,0,0,0,0]};
    for(let i=0;i<n;i++){
      S.gachaLeft=1;
      const g=rollGacha();
      if(g.kind==='charm') c.charm++; else c.rar[g.item.rar]++;
    }
    const weapons=n-c.charm;
    return {
      charmPct: +(c.charm/n*100).toFixed(1),
      rarePlusPct: +((c.rar[2]+c.rar[3]+c.rar[4])/Math.max(1,weapons)*100).toFixed(1),
      commonPct: +(c.rar[0]/Math.max(1,weapons)*100).toFixed(1),
      relic: c.rar[4]
    };
  };
  RNG=mulberry32(20240819);
  const a=sample(1,3000), c=sample(10,3000), e=sample(35,3000);
  return {
    shallow:a, deep:c, deepest:e,
    monotonic: a.rarePlusPct < c.rarePlusPct && c.rarePlusPct < e.rarePlusPct,
    shallowIsRarelyRare: a.rarePlusPct < 20,
    shallowHasCommons: a.commonPct > 30,
    // 最深帯にもコモンは出るようになった（鍛造がある以上、高ilvlのコモンは
    // そのまま育てる土台になる）。帯の差はレア率のほうで付ける。
    deepestIsRarest: e.rarePlusPct > a.rarePlusPct*4};
});

// 1-c. ガチャ産は必ず武器で、必ず鑑定済み。接辞の本数がレア度と整合している
R.shape = await pg.evaluate(()=>{
  RNG=mulberry32(4242); S.lastDepth=25;
  let allWeapon=true, allIdent=true, affixOk=true, n=0;
  for(let i=0;i<800;i++){
    S.gachaLeft=1;
    const g=rollGacha();
    if(g.kind==='charm') continue;
    n++;
    if(g.item.slot!=='weapon') allWeapon=false;
    if(!g.item.ident) allIdent=false;
    const r=RARITY[g.item.rar];
    if(g.item.aff.length>r.aff[1]) affixOk=false;              // 上限は必ず守る
    if(g.item.rar===0 && g.item.aff.length!==0) affixOk=false;  // Common は接辞なし
    const ids=g.item.aff.map(a=>a.id);
    if(new Set(ids).size!==ids.length) affixOk=false;           // 接辞の重複なし
  }
  return {weapons:n, allWeapon, allIdent, affixOk};
});

// 1-d. 引ける回数の上限は変わっていない
R.pulls = await pg.evaluate(()=>{
  S.gachaDay=today(); S.gachaLeft=GACHA_PER_DAY; S.lastDepth=1;
  const got=[]; for(let i=0;i<5;i++) got.push(!!rollGacha());
  return {max:GACHA_PER_DAY, sequence:got,
          stopsAfterMax: got.filter(Boolean).length===GACHA_PER_DAY};
});

// 1-e. lastDepth は潜るとリセットされ、潜った深さで更新され、死んでも残る
R.track = await pg.evaluate(()=>{
  S.hero=newHero(); S.startDepth=1;
  startRun(1);
  const atStart=S.lastDepth;
  enterFloor(6); const after6=S.lastDepth;
  enterFloor(3); const backTo3=S.lastDepth;     // 戻っても最深が残る
  S.hero.hpNow=1; die();
  const afterDeath=S.lastDepth;
  const bandAfterDeath=gachaBand().nm;
  // 次の潜行で直近がリセットされる
  S.hero=newHero(); startRun(1);
  const nextRun=S.lastDepth;
  document.getElementById('m-death').classList.remove('on');
  return {atStart, after6, backTo3, afterDeath, bandAfterDeath, nextRun,
          resetsOnDive: atStart===1,
          keepsMax: after6===6 && backTo3===6,
          survivesDeath: afterDeath===6,
          betterBandAfterDeepDeath: bandAfterDeath==='中層',
          resetsNextRun: nextRun===1};
});

// 1-f. UI に帯と次の目標が出ている
R.ui = await pg.evaluate(()=>{
  S.lastDepth=12; setScreen('gacha');
  const t=document.getElementById('gacha-status').textContent;
  return {hasBand:t.includes('深層'), hasLastDepth:t.includes('12'),
          hasRarePct:/Rare 以上/.test(t), hasNext:t.includes('古層')};
});

/* ============ 2. 敵の系統 ============ */

// 2-a. 1階層に出る系統の数が深度で増える
R.famSlots = await pg.evaluate(()=>{
  /* 数えるのは**系統の札**なので、札を持たない相手は外す。
     ・大広間（10階ごと）は雑魚が湧かないので、深い側は 39 階で見る
     ・第1階層の「朽ちぬもの」は系統の抽選から外れた1体（倒せない相手） */
  const cnt=(d)=>{ RNG=mulberry32(d*7919+11); const fl=genFloor(d);
    return new Set(spawnEnemies(fl,d).filter(e=>!e.boss && !e.undying)
                                     .map(e=>e.fam.id)).size; };
  const s={};
  [1,2,3,6,9,12,18,27,39].forEach(d=>{ s['d'+d]=cnt(d); });
  return {counts:s, slots:{d1:famSlotsAt(1),d9:famSlotsAt(9),d18:famSlotsAt(18),
                           d27:famSlotsAt(27),d50:famSlotsAt(50)},
          startsWithOne: s.d1===1 && s.d2===1 && s.d3===1,
          growsWithDepth: s.d39>=s.d1,
          capped: Object.values(s).every(v=>v<=4)};
});

// 2-b. 序盤に属性持ちの敵が出ない（浅い階層は「獣」だけ）
R.earlyFams = await pg.evaluate(()=>{
  const seen=new Set();
  for(let d=1;d<=3;d++) for(let s=0;s<60;s++){
    RNG=mulberry32(d*104729+s); const fl=genFloor(d);
    spawnEnemies(fl,d).filter(e=>!e.boss && !e.undying).forEach(e=>seen.add(e.fam.id));
  }
  const mid=new Set();
  for(let d=4;d<=6;d++) for(let s=0;s<60;s++){
    RNG=mulberry32(d*104729+s); const fl=genFloor(d);
    spawnEnemies(fl,d).filter(e=>!e.boss && !e.undying).forEach(e=>mid.add(e.fam.id));
  }
  const deep=new Set();
  for(let d=30;d<=34;d++) for(let s=0;s<40;s++){
    RNG=mulberry32(d*104729+s); const fl=genFloor(d);
    spawnEnemies(fl,d).filter(e=>!e.boss && !e.undying).forEach(e=>deep.add(e.fam.id));
  }
  return {shallow:[...seen], mid:[...mid], deep:[...deep],
          shallowOnlyBeast: seen.size===1 && seen.has('beast'),
          noElementalEarly: ![...seen,...mid].some(f=>['flame','frost','storm','arcane'].includes(f)),
          allUnlockedDeep: deep.size>=6};
});

// 2-c. 解禁テーブルが単調で、最初の系統は必ず第1階層から
R.famTable = await pg.evaluate(()=>{
  const md=FAMILY.map(f=>f.minDepth);
  return {minDepths:md, firstIsDepth1:md[0]===1,
          ascending:md.every((v,i)=>i===0||v>=md[i-1]),
          spread:md[md.length-1]>=25};
});

/* ============ 3. ボスの正体開示 ============ */

// 3-a. 湧いた直後は伏せられていて、HUD にも出ない
R.bossHidden = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(5);
  const boss=W.enemies.find(e=>e.boss);
  boss.atkV=0;
  updateHUD();
  const bb=document.getElementById('bossbar');
  return {revealed:boss.revealed, barShown:bb.style.display==='block',
          nameText:document.getElementById('bossname').textContent,
          hiddenAtSpawn: boss.revealed===false && bb.style.display!=='block'};
});

// 3-b. 一撃入れると revealed が立ち、HUD に名前と HP が出る
R.bossReveal = await pg.evaluate(()=>{
  const boss=W.enemies.find(e=>e.boss && !e.dead);
  hitEnemy(boss, stats(S.hero), 1);
  updateHUD();
  const bb=document.getElementById('bossbar');
  const w=document.getElementById('bossfill').style.width;
  return {revealed:boss.revealed, barShown:bb.style.display==='block',
          name:document.getElementById('bossname').textContent,
          fill:w,
          nameMatches:document.getElementById('bossname').textContent.includes(boss.name),
          ok: boss.revealed===true && bb.style.display==='block'};
});

// 3-c. 状態異常のスリップダメージでも割れる
R.bossDot = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10);
  const boss=W.enemies.find(e=>e.boss); boss.atkV=0;
  const before=boss.revealed;
  boss.st={burn:{t:2, dps:40, acc:0}}; boss.bu={};
  enemyUpdate(boss, 0.5);
  return {before, after:boss.revealed, ok: before===false && boss.revealed===true};
});

// 3-d. 別のボスは伏せ直される（前の階の revealed が漏れない）
R.bossPerFloor = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(5);
  const b1=W.enemies.find(e=>e.boss); b1.atkV=0;
  hitEnemy(b1, stats(S.hero), 1);
  const firstRevealed=b1.revealed;
  enterFloor(10);
  const b2=W.enemies.find(e=>e.boss);
  updateHUD();
  const bb=document.getElementById('bossbar');
  return {firstRevealed, secondRevealed:b2.revealed,
          barHidden:bb.style.display!=='block',
          ok: firstRevealed===true && b2.revealed===false && bb.style.display!=='block'};
});

// 3-e. 倒した後はバーが消える
R.bossCleared = await pg.evaluate(()=>{
  const boss=W.enemies.find(e=>e.boss && !e.dead);
  hitEnemy(boss, stats(S.hero), 1);
  updateHUD();
  const shown=document.getElementById('bossbar').style.display==='block';
  boss.hp=1; killEnemy(boss);
  updateHUD();
  const after=document.getElementById('bossbar').style.display==='block';
  document.getElementById('m-boon').classList.remove('on'); S.screen='game'; _boonPending=null;
  return {shownWhileAlive:shown, hiddenAfterKill:!after, ok: shown && !after};
});

// 3-f. 実プレイ 6 秒: 例外なく回り続ける
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(5);
  const t0=performance.now();
  await new Promise(r=>setTimeout(r,6000));
  return {ran: performance.now()-t0>=5900, alive: !!S.run || !!document.getElementById('m-death').classList.contains('on')};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
