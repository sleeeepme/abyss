// ボス階と潜在の検証
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

// --- 1. ボス階の判定: 5の倍数=中、10の倍数=大
R.schedule = await pg.evaluate(()=>{
  const out={};
  for(let d=1;d<=30;d++){ const t=bossTierAt(d); if(t) out[d]=t; }
  const bad = Object.entries(out).some(([d,t])=>
    (+d%10===0 && t!=='great') || (+d%10!==0 && t!=='mid'));
  const nonBoss = [1,2,3,4,6,7,8,9,11,12].every(d=>bossTierAt(d)===null);
  return {map:out, correctTiers:!bad, nonBossFloorsClean:nonBoss};
});

// --- 2. ボス階にボスが1体だけ湧き、階段の上にいる
R.spawn = await pg.evaluate(()=>{
  const check=(d)=>{ RNG=mulberry32(d*7919); const fl=genFloor(d);
    const es=spawnEnemies(fl,d); const bs=es.filter(e=>e.boss);
    return {count:bs.length, rar:bs[0]&&bs[0].rar,
            atStairs: bs[0] ? Math.hypot(bs[0].x-fl.stair.x, bs[0].y-fl.stair.y)<0.01 : false,
            trash: es.length-bs.length,
            name: bs[0]&&bs[0].name};
  };
  const d3=(()=>{ RNG=mulberry32(3*7919); const fl=genFloor(3);
    return spawnEnemies(fl,3).filter(e=>e.boss).length; })();
  return {d5:check(5), d10:check(10), d15:check(15), d20:check(20), noBossOnD3:d3===0};
});

// --- 3. ボスは通常敵より遥かに硬い
R.stats = await pg.evaluate(()=>{
  RNG=mulberry32(555); const fl=genFloor(10);
  const es=spawnEnemies(fl,10);
  const boss=es.find(e=>e.boss), trash=es.find(e=>!e.boss);
  RNG=mulberry32(555); const fl5=genFloor(5);
  const mid=spawnEnemies(fl5,5).find(e=>e.boss);
  return {greatHp:boss.maxHp, trashHp:trash.maxHp, ratio:+(boss.maxHp/trash.maxHp).toFixed(1),
          midHp:mid.maxHp, greaterThanMid: boss.maxHp>mid.maxHp,
          bossRadius:boss.r, trashRadius:trash.r};
});

// --- 4. ボスを倒すまで階段が使えない
R.stairLock = await pg.evaluate(async ()=>{
  S.upg={}; S.hero=newHero(); startRun(5);
  const lockedAtStart = S.run.bossAlive===true;
  P.x=W.fl.stair.x; P.y=W.fl.stair.y;
  interact();
  const modalBlocked = !document.getElementById('m-stairs').classList.contains('on');
  // ボスを倒す
  const boss=W.enemies.find(e=>e.boss);
  boss.hp=1; killEnemy(boss);
  const unlocked = S.run.bossAlive===false;
  return {lockedAtStart, modalBlocked, unlocked};
});

// --- 5. 撃破で潜在3択が出る / 選ぶと反映される
R.boonPick = await pg.evaluate(async ()=>{
  const shown = document.getElementById('m-boon').classList.contains('on');
  const cards = document.querySelectorAll('#boon-choices [data-boon]').length;
  const paused = S.screen==='boon';
  const ids = [...document.querySelectorAll('#boon-choices [data-boon]')]
    .map(n=>_boonPending[+n.dataset.boon].id);
  const distinct = new Set(ids).size===ids.length;
  return {shown, cards, paused, distinctChoices:distinct};
});

// --- 6. 選んだ潜在がステータスに乗る
R.boonApplied = await pg.evaluate(async ()=>{
  // HP潜在に差し替えて確実に検証する
  _boonPending=[{id:'hp',rar:'uncommon'},{id:'atk',rar:'uncommon'},{id:'ms',rar:'uncommon'}];
  document.getElementById('boon-choices').innerHTML =
    _boonPending.map((b,i)=>`<div class="boon" data-boon="${i}">${b.id}</div>`).join('');
  const before=stats(S.hero);
  document.querySelector('[data-boon="0"]').click();
  await new Promise(r=>setTimeout(r,250));
  const after=stats(S.hero);
  return {hpBefore:before.maxHp, hpAfter:after.maxHp,
          increased: after.maxHp>before.maxHp,
          // 調整値を直接書かない。定義から引いて比べる
          expected: Math.round(before.maxHp*(1+boonValue('hp','uncommon')/100))===after.maxHp,
          resumed: S.screen==='game', boonCount:S.hero.boons.length};
});

// --- 7. 重ねがけ / 大ボスは効果が大きい
R.stacking = await pg.evaluate(()=>{
  S.hero=newHero(); S.hero.boons=[];
  const base=stats(S.hero).maxHp;
  S.hero.boons.push({id:'hp',rar:'uncommon'});
  const one=stats(S.hero).maxHp;
  S.hero.boons.push({id:'hp',rar:'uncommon'});
  const two=stats(S.hero).maxHp;
  S.hero.boons=[{id:'hp',rar:'rare'}];
  const great=stats(S.hero).maxHp;
  return {base, one, two, great, stacks: two>one, greatBigger: great>one,
          midPct:+((one/base-1)*100).toFixed(0), greatPct:+((great/base-1)*100).toFixed(0)};
});

// --- 8. 潜在は拠点に戻っても残り、死ぬと消える
R.persistence = await pg.evaluate(()=>{
  S.hero=newHero(); S.hero.boons=[{id:'atk',rar:'rare'}];
  startRun(1);
  S.run.depth=5; returnToTown();
  const afterReturn = S.hero.boons.length;
  startRun(1); S.hero.hpNow=1; hitPlayer(null,99999,'blunt',5);
  const heroGone = S.hero===null;
  S.hero=newHero();
  return {survivesReturn: afterReturn===1, lostOnDeath: heroGone && S.hero.boons.length===0};
});

// --- 9. 激昂 / 大ボスの放射弾
// 放射弾は固定タイマーではなく「散弾（burst）」という技になったので、
// 技として撃たれることを見る（詳細は bossaoe.mjs）
R.phases = await pg.evaluate(async ()=>{
  S.upg={hp:8}; S.hero=newHero(); startRun(10);
  const boss=W.enemies.find(e=>e.boss);
  W.enemies=[boss];
  boss.x=P.x+2.5; boss.y=P.y;
  boss.atkV=0;                               // 検証中に殺されないようにする
  const teleBefore=boss.teleMul, msBefore=boss.ms;
  boss.hp=boss.maxHp*0.4;                    // 半分を切らせる
  const boltsBefore=W.fx.filter(f=>f.t==='bolt').length;
  // 散弾を直接撃たせて、放射状の弾が出ることを確かめる
  boss.cast={id:'burst', t:0, max:BOSS_MOVES.burst.tele, dir:0};
  resolveBossMove(boss); boss.cast=null;
  const boltsAfter=W.fx.filter(f=>f.t==='bolt').length;
  await new Promise(r=>setTimeout(r,1200));  // 激昂の判定が走るまで回す
  return {raged: boss.rage===true, teleShorter: boss.teleMul<teleBefore,
          faster: boss.ms>msBefore, alive: !!S.run,
          burstFired: boltsAfter>boltsBefore, anyBoltsSeen: boltsAfter>0,
          hasBurstMove: boss.moves.includes('burst')};
});

// --- 10. ボス撃破の確定ドロップ
R.drops = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10);
  const boss=W.enemies.find(e=>e.boss);
  W.drops=[];
  boss.hp=1; killEnemy(boss);
  const n=W.drops.length;
  document.getElementById('m-boon').classList.remove('on'); S.screen='game'; _boonPending=null;
  return {dropped:n, expected:BOSS_STATS.great.drops, ok:n>=BOSS_STATS.great.drops};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
