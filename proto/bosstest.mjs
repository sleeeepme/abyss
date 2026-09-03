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

/* --- 2. ボス階にボスが湧き、穴のそばで待ち構えている
   第20階層だけは**2体**。近くに置くのは、穴へ向かえば必ず出会うようにするため
   （2体なので真上には置けない。左右に振ってある）。 */
R.spawn = await pg.evaluate(()=>{
  const check=(d)=>{ RNG=mulberry32(d*7919); const fl=genFloor(d);
    const es=spawnEnemies(fl,d); const bs=es.filter(e=>e.boss);
    const near = bs.length ? Math.max(...bs.map(x=>Math.hypot(x.x-fl.stair.x, x.y-fl.stair.y))) : 99;
    const want = (d===TWIN_BOSS_DEPTH) ? 2 : 1;
    return {count:bs.length, want, rar:bs[0]&&bs[0].rar,
            atStairs: near < 4.0,          // 穴の目の前（双子は左右に3.2ずつ）
            trash: es.length-bs.length,
            countOk: bs.length===want,
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
  const boss=es.find(e=>e.boss);
  /* 大広間になったボス階には雑魚が湧かない。比べる相手は同じ深さの
     **普通の階**から取る——見たいのは「第10階層の敵と比べて硬いか」であって、
     「ボス階に雑魚が居るか」ではない。 */
  RNG=mulberry32(556); const flT=genFloor(9);
  const trash=spawnEnemies(flT,10).find(e=>!e.boss);
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
  /* 初期装備の「疾き」で回避 6% が乗っている。1発で死ぬ前提だと、
     たまたま回避を引いた回にこの検証が静かに false になる。死ぬまで殴る。 */
  startRun(1);
  for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,'blunt',5); }
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

/* --- 11. 大広間のボスは、入口から穴までの距離ぶん常に見えている。
   通常の索敵距離（aggro）のままだと、広い部屋の半分以上をただ突っ立って
   過ごすことになり、それが「攻撃してこない」に見えていた（報告：第10階層）。
   遠くに立たせたまま様子を見て、動き出す（chase に入る）ことを確かめる。 */
R.arenaAware = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(10); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  // 広間の対角ぐらい離す。通常の索敵距離（10前後）よりずっと遠い。
  P.x = boss.x - 20; P.y = boss.y;
  const idleAtStart = boss.state;
  stepSim(0.3);
  const dist = Math.hypot(P.x-boss.x, P.y-boss.y);
  return {arena: !!W.fl.arena, idleAtStart, chasesAfter: boss.state==='chase', dist:+dist.toFixed(1),
          ok: !!W.fl.arena && boss.state==='chase'};
});

/* --- 12. 第20階層の双子は先に倒した方では終わらない。
   片方を倒しても：確定ドロップは出ない・恩寵は出ない・階段は解禁されない。
   代わりに残った方の攻撃が速くなる（teleMul低下・ms上昇）。
   両方倒して初めて、通常のボス撃破処理が1回だけ流れる。 */
R.twinSequential = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero(); startRun(20); S.hero.party=[];
  document.getElementById('m-boon').classList.remove('on'); S.screen='game'; _boonPending=null;
  const twins=W.enemies.filter(e=>e.boss&&e.twin);
  const bothTwins = twins.length===2;
  const [t1,t2]=twins;
  const teleBefore=t2.teleMul, msBefore=t2.ms;
  W.drops=[];
  t1.hp=1; killEnemy(t1);
  const afterFirst = {
    drops:W.drops.length, bossStillAlive: S.run.bossAlive===true,
    boonNotShownYet: !document.getElementById('m-boon').classList.contains('on'),
    t1Dead:t1.dead, t2Alive:!t2.dead,
    teleFaster: t2.teleMul<teleBefore, msFaster: t2.ms>msBefore};
  t2.hp=1; killEnemy(t2);
  const afterSecond = {
    drops:W.drops.length, bossCleared: S.run.bossAlive===false,
    boonShown: document.getElementById('m-boon').classList.contains('on')};
  document.getElementById('m-boon').classList.remove('on'); S.screen='game'; _boonPending=null;
  return {bothTwins, afterFirst, afterSecond,
          noRewardOnFirst: afterFirst.drops===0 && afterFirst.bossStillAlive && afterFirst.boonNotShownYet,
          buffedOnFirst: afterFirst.teleFaster && afterFirst.msFaster,
          rewardOnSecond: afterSecond.drops>0 && afterSecond.bossCleared && afterSecond.boonShown,
          ok: bothTwins && afterFirst.drops===0 && afterFirst.bossStillAlive && afterFirst.boonNotShownYet
              && afterFirst.teleFaster && afterFirst.msFaster
              && afterSecond.drops>0 && afterSecond.bossCleared && afterSecond.boonShown};
});

/* --- 13. 第30階層：毒沼の広間にも息継ぎ場所が要る。
   入口・穴の周りだけでなく、上・下・中央にも毒の無い場所を作った。
   床全体はほぼ毒（大半は覆われている）ことも確認する。 */
R.poisonSafeZones = await pg.evaluate(()=>{
  RNG=mulberry32(30*7919);
  const fl=genFloor(30);
  const h=spawnHazards(fl,30);
  const cx=(fl.W-1)/2, cy=(fl.H-1)/2, rx=fl.W/2-2.5, ry=fl.H/2-2.5;
  const spots={
    center:[cx,cy], top:[cx,cy-ry+2.0], bottom:[cx,cy+ry-2.0],
    stair:[fl.stair.x,fl.stair.y], start:[fl.start.cx+0.5,fl.start.cy+0.5]};
  let poisonedTiles=0, totalFloor=0;
  for(let y=1;y<fl.H-1;y++) for(let x=1;x<fl.W-1;x++){
    if(!tileWalk(fl,x,y)) continue;
    totalFloor++;
    if(h.g[y]&&h.g[y][x]) poisonedTiles++;
  }
  const free={};
  for(const k of Object.keys(spots)){
    const [sx,sy]=spots[k]; const gx=Math.floor(sx), gy=Math.floor(sy);
    free[k] = !(h.g[gy]&&h.g[gy][gx]);
  }
  return {kind:h.kind, free, poisonRatio:+(poisonedTiles/totalFloor).toFixed(2),
          mostlyPoisoned: poisonedTiles/totalFloor>0.6,
          ok: h.kind==='poison' && free.center && free.top && free.bottom
              && free.stair && free.start && poisonedTiles/totalFloor>0.6};
});

/* --- 14. 第30階層の主は、雑魚を呼ぶたび広間のどこかへ跳ぶ。
   他の「招来」持ちボス（第30階層以外）は跳ばないことも見ておく
   ——1体だけの専用挙動であって、技そのものの仕様変更ではない。 */
R.bossWarpsOnSummon = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(30); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const isMallet = boss.uniqueBoss===POISON_BOSS_DEPTH;
  const x0=boss.x, y0=boss.y;
  boss.cast={id:'summon', t:0, max:BOSS_MOVES.summon.tele, dir:0};
  resolveBossMove(boss); boss.cast=null;
  const moved = Math.hypot(boss.x-x0, boss.y-y0) > 3;
  const stillStandable = standable(boss.x, boss.y);
  return {isMallet, moved, stillStandable, dist:+Math.hypot(boss.x-x0,boss.y-y0).toFixed(1),
          ok: isMallet && moved && stillStandable};
});
R.otherSummonBossDoesNotWarp = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(15); S.hero.party=[];   // 15Fの主も summon を持つ
  const boss=W.enemies.find(e=>e.boss);
  const notMallet = boss.uniqueBoss!==POISON_BOSS_DEPTH;
  const hasSummon = boss.moves.includes('summon');
  const x0=boss.x, y0=boss.y;
  boss.cast={id:'summon', t:0, max:BOSS_MOVES.summon.tele, dir:0};
  resolveBossMove(boss); boss.cast=null;
  const stayed = Math.hypot(boss.x-x0, boss.y-y0) < 0.01;
  return {notMallet, hasSummon, stayed, ok: notMallet && hasSummon && stayed};
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

/* --- 15. ラストボスは51階。50階の主（初めの供物）はそのまま大ボスとして残る。
   50に落ちても踏破にならず、50の倍数（100など）ももう final を返さない。 */
R.finalDepthMoved = await pg.evaluate(()=>{
  return {t50: bossTierAt(50), t51: bossTierAt(51), t100: bossTierAt(100), t60: bossTierAt(60),
          ok: bossTierAt(50)==='great' && bossTierAt(51)==='final'
              && bossTierAt(100)!=='final' && bossTierAt(60)!=='final'};
});

// --- 16. 51階の主：アビスの門番、アズレイア。人型サイズで湧く。50階の主（引き連れ）はそのまま。
R.finalSpawn = await pg.evaluate(()=>{
  RNG=mulberry32(51*7919); const fl51=genFloor(51);
  const es51=spawnEnemies(fl51,51);
  const boss51=es51.find(e=>e.boss);
  RNG=mulberry32(50*7919); const fl50=genFloor(50);
  const es50=spawnEnemies(fl50,50);
  const boss50=es50.find(e=>e.boss);
  const escort50 = es50.some(e=>e.escort);
  const noEscort51 = !es51.some(e=>e.escort);
  return {name51:boss51&&boss51.name, tier51:boss51&&boss51.tier, r51:boss51&&boss51.r,
          name50:boss50&&boss50.name, tier50:boss50&&boss50.tier,
          humanSized: boss51 && boss51.r<0.6, escort50, noEscort51,
          ok: boss51&&boss51.name==='アビスの門番、アズレイア' && boss51.tier==='final' && boss51.r<0.6
              && boss50&&boss50.name==='初めの供物' && boss50.tier==='great'
              && escort50===true && noEscort51===true};
});

// --- 17. 51階の主を倒したときだけ「踏破」になる。50階の主を倒しても踏破にならない。
R.finalClearGate = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero(); startRun(50); S.hero.party=[];
  const boss50=W.enemies.find(e=>e.boss);
  boss50.hp=1; killEnemy(boss50);
  const notClearedAt50 = S.screen!=='clear';
  document.getElementById('m-boon').classList.remove('on'); S.screen='game'; _boonPending=null;
  const clearedBefore=S.cleared||0;

  S.upg={}; S.hero=newHero(); startRun(51); S.hero.party=[];
  const boss51=W.enemies.find(e=>e.boss);
  boss51.hp=1; killEnemy(boss51);
  const clearedAt51 = S.screen==='clear';
  const clearedAfter=S.cleared||0;
  document.getElementById('m-clear').classList.remove('on'); document.getElementById('m-boon').classList.remove('on');
  S.screen='game'; _boonPending=null;
  return {notClearedAt50, clearedAt51, clearedBefore, clearedAfter,
          ok: notClearedAt50 && clearedAt51===true && clearedAfter===clearedBefore+1};
});

// --- 18. 定期ワープ：溜め中でなければワープする
R.finalWarp = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const x0=boss.x, y0=boss.y;
  boss.cast=null; boss.warpCd=0;
  finalBossTick(boss, 0.016);
  const moved = Math.hypot(boss.x-x0, boss.y-y0) > 1.0;
  const stillStandable = standable(boss.x, boss.y);
  return {moved, stillStandable, warpCdReset: boss.warpCd>0, ok: moved && stillStandable};
});

// --- 19. HP半分で全体を巻き込む一撃（激昂の節目に相乗り）
R.finalHalfNova = await pg.evaluate(async ()=>{
  S.upg={hp:8}; S.hero=newHero(); S.hero.lv=30; S.hero.str=30;S.hero.dex=30;S.hero.vit=30;
  startRun(51); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=true;
  const hpBefore=S.hero.hpNow;
  boss.hp = boss.maxHp*0.49;   // 激昂の閾値をまたがせる
  bossRage(boss);
  const hurt = hpBefore - S.hero.hpNow;
  return {raged:boss.rage, hurt, hurtByNova: hurt>0, ok: boss.rage===true && hurt>0};
});

/* --- 20. HP25%未満：常に4人（本体+幻3体）になって攻撃してくる。
   幻はHPが無いに等しく（削っても本体の残量には影響しない）、
   fleePhase に入るまで自然には消えない。 */
R.finalQuadPhase = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const beforeCount=W.enemies.filter(e=>!e.dead).length;
  boss.hp = boss.maxHp*0.24;
  finalBossTick(boss, 0.016);
  const mirrors=W.enemies.filter(e=>e.mirror && e.master===boss && !e.dead);
  const bossHpUnaffected = boss.hp === boss.maxHp*0.24;
  return {quadPhase:boss.quadPhase, mirrorCount:mirrors.length, bossHpUnaffected,
          ok: boss.quadPhase===true && mirrors.length===3 && bossHpUnaffected};
});

/* --- 21. HP10%未満：幻を消して1体に戻り、逃走＋遠距離主体に切り替わる。
   一度この段階に入ったら、離れる方向にしか動かない（fleeing）。 */
R.finalFleePhase = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  boss.hp = boss.maxHp*0.24;
  finalBossTick(boss, 0.016);                 // まず4人化させる
  const mirrorsBefore=W.enemies.filter(e=>e.mirror && e.master===boss && !e.dead).length;
  boss.hp = boss.maxHp*0.09;
  finalBossTick(boss, 0.016);
  const mirrorsAfter=W.enemies.filter(e=>e.mirror && e.master===boss && !e.dead).length;
  const onlyRanged = boss.moves.every(m=>['beam','burst','pillars','clone'].includes(m));
  return {mirrorsBefore, mirrorsAfter, fleeing:boss.fleeing, onlyRanged, moves:boss.moves,
          ok: mirrorsBefore===3 && mirrorsAfter===0 && boss.fleeing===true && onlyRanged};
});

// --- 22. 分身技：一時的な幻を出す。時間が経つと自然に消える（寿命つき）
R.finalCloneMove = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const before=W.enemies.filter(e=>!e.dead).length;
  boss.cast={id:'clone', t:0, max:BOSS_MOVES.clone.tele, dir:0};
  resolveBossMove(boss); boss.cast=null;
  const mirrors=W.enemies.filter(e=>e.mirror && e.master===boss && !e.dead);
  const hasTtl = mirrors.every(m=>m.ttl>0);
  // 寿命を使い切らせて消えることを確かめる
  mirrors.forEach(m=>{ enemyUpdate(m, m.ttl+0.1); });
  const goneAfterTtl = W.enemies.filter(e=>e.mirror && e.master===boss && !e.dead).length===0;
  return {spawned:mirrors.length, hasTtl, goneAfterTtl,
          ok: mirrors.length===BOSS_MOVES.clone.n && hasTtl && goneAfterTtl};
});

/* --- 23. 第50階層の主が呼ぶ雑魚（眷属・招来）は経験値3倍。
   「戦いながらレベルを上げる」ための倍率なので、対象は escort / summoned だけ
   ——同じ階の自然湧きの雑魚は変わらない。 */
R.offeringTrashXp3x = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(50); S.hero.party=[];
  const mk=(extra)=>Object.assign({x:P.x,y:P.y,arch:ARCH[0],fam:FAMILY[0],lv:20,elite:false,aff:[],
    maxHp:999,hp:999,atkV:0,def:0,res:{},dt:'blunt',st:{},bu:{},state:'chase',t:0,cd:99,
    vx:0,vy:0,hit:0,tele:0,dead:false,r:0.34,ms:0,teleMul:1,col:'#fff',name:'的'}, extra);
  const gain=(extra)=>{
    S.hero.xp=0; S.hero.lv=20;
    const before=totalXpOf(S.hero);
    killEnemy(mk(extra));
    return totalXpOf(S.hero)-before;
  };
  const plainXp = gain({});
  const escortXp = gain({escort:true});
  const summonedXp = gain({summoned:true});
  const ratioEscort=+(escortXp/plainXp).toFixed(2), ratioSummoned=+(summonedXp/plainXp).toFixed(2);
  return {plainXp, escortXp, summonedXp, ratioEscort, ratioSummoned,
          escortIsTriple: Math.abs(ratioEscort-3)<0.05,
          summonedIsTriple: Math.abs(ratioSummoned-3)<0.05,
          ok: Math.abs(ratioEscort-3)<0.05 && Math.abs(ratioSummoned-3)<0.05};
});

/* --- 24. 主を倒すと：残っていた眷属は消え、パーティは全回復する */
R.offeringDefeatCleanup = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(50); S.hero.party=[];
  const ally=makeAlly(50, S.hero);
  ally.x=P.x+0.5; ally.y=P.y;
  S.hero.party.push(ally);
  const boss=W.enemies.find(e=>e.boss);
  const escortsBefore=W.enemies.filter(e=>e.escort && !e.dead).length;
  S.hero.hpNow=1; ally.hpNow=1;
  boss.hp=1; killEnemy(boss);
  const escortsAfter=W.enemies.filter(e=>e.escort && !e.dead).length;
  const heroFull = S.hero.hpNow===stats(S.hero).maxHp;
  const allyFull = ally.hpNow===allyStats(ally).maxHp;
  document.getElementById('m-boon').classList.remove('on'); S.screen='game'; _boonPending=null;
  return {escortsBefore, escortsAfter, heroFull, allyFull,
          ok: escortsBefore===KIN_MAX && escortsAfter===0 && heroFull && allyFull};
});

/* ================= 25. ラスボス戦だけ、枷が周期的に切り替わる =================
   白の層の固定の枷（zoneBane）とは別に、アビスの口と実際に殴り合っている
   間だけ、一定時間ごとに別の枷へランダムに切り替わるゲージを持つ。 */

// 25-a. 気づかれる前は掛からない。一撃入れて revealed になった瞬間に1つ目が立つ
R.finalBossBaneStarts = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=false;
  stepSim(0.5);
  const noneBefore = !S.run.bossBane;
  boss.revealed=true;
  stepSim(0.05);
  const started = !!S.run.bossBane;
  const validId = started && !!trialBaneDef(S.run.bossBane.id);
  const fullGauge = started && S.run.bossBane.t > BOSS_BANE_SEC-1;
  return {noneBefore, started, validId, fullGauge,
          ok: noneBefore && started && validId && fullGauge};
});

// 25-b. ゲージは実際に減っていき、尽きると別の枷へ切り替わる。切れたらまた次へ、を繰り返す
R.finalBossBaneCycles = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=true;
  stepSim(0.05);
  const first=S.run.bossBane.id, tAtStart=S.run.bossBane.t;
  stepSim(BOSS_BANE_SEC*0.5);
  const tMid=S.run.bossBane.t;
  const draining = tMid < tAtStart - BOSS_BANE_SEC*0.3;
  stepSim(BOSS_BANE_SEC*0.5+0.1);       // 残り半分を使い切って、切り替わった直後まで進める
  const second=S.run.bossBane.id;
  const secondFresh = S.run.bossBane.t > BOSS_BANE_SEC-0.5;
  stepSim(BOSS_BANE_SEC+0.1);           // もう1周（今度は満タンから丸ごと）
  const third=S.run.bossBane.id;
  const allValid = [first,second,third].every(id=>!!trialBaneDef(id));
  return {first, second, third, tAtStart:+tAtStart.toFixed(1), tMid:+tMid.toFixed(1),
          draining, secondFresh, allValid,
          ok: draining && secondFresh && allValid};
});

// 25-c. 白の層の枷・試練の枷より、ラスボス戦中の枷が優先して効く
R.finalBossBaneTakesPriority = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  // 優先順位だけを見たいので、本来は同時に起きない状態をあえて重ねる
  S.run.zoneBane='heavy';
  S.run.trial={t:10, max:45, bane:'dull', wave:1};
  boss.revealed=true;
  stepSim(0.05);
  const activeId=S.run.bossBane.id;
  const wins = trialBane().id===activeId;
  S.run.trial=null; S.run.zoneBane=null;
  return {activeId, wins, ok: wins};
});

// 25-d. ボスを倒すと、切り替わる枷はその場で消える（もう戦っていないので）
R.finalBossBaneClearsOnVictory = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=true;
  stepSim(0.05);
  const hadBane = !!S.run.bossBane;
  boss.hp=1; killEnemy(boss);
  const clearedBane = !S.run.bossBane;
  document.getElementById('m-boon').classList.remove('on');
  document.getElementById('m-clear').classList.remove('on');
  S.screen='game'; _boonPending=null;
  return {hadBane, clearedBane, ok: hadBane && clearedBane};
});

/* 25-e. 「主」なら誰でもではなく、本物のアビスの口（51階・uniqueBoss===FINAL_DEPTH）
   だけが対象。50階の主（初めの供物）は見つかった状態でも切り替わらない。 */
R.onlyRealFinalBossCycles = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(50); S.hero.party=[]; P.invuln=1e9;
  const boss50=W.enemies.find(e=>e.boss);
  boss50.revealed=true;
  stepSim(0.5);
  const noBaneAt50 = !S.run.bossBane;
  const notFinalUnique = boss50.uniqueBoss!==FINAL_DEPTH;
  return {noBaneAt50, notFinalUnique, ok: noBaneAt50 && notFinalUnique};
});

/* 25-f. 1つの枷と付き合う時間を長く取る。
   15秒で回していたころは、読んで立ち回りを変える前に次へ移っていた。 */
R.finalBossBaneRunsLong = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=true;
  stepSim(0.05);
  const id0=S.run.bossBane.id;
  stepSim(14);                                  // 旧設定なら、ここで既に1周している
  const sameAfter14 = S.run.bossBane.id===id0 && S.run.bossBane.t>0;
  return {secs:BOSS_BANE_SEC, id0, tLeft:+S.run.bossBane.t.toFixed(1),
          longEnough: BOSS_BANE_SEC>=30, sameAfter14,
          ok: BOSS_BANE_SEC>=30 && sameAfter14};
});

/* ============ 26. 最深部：名前・地名・分身の偽装・行き止まり ============ */

// 26-a. 主は「アビスの門番、アズレイア」。51階そのものの地名は「アビスの口」。
R.finalNames = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  return {boss:boss.name, place:floorPlaceName(51), zone:zoneAt(51).nm,
          place12:floorPlaceName(12),
          bossIsGuardian: boss.name==='アビスの門番、アズレイア',
          floorIsMouth:   floorPlaceName(51)==='アビスの口',
          placeDiffersFromZone: floorPlaceName(51)!==zoneAt(51).nm,
          otherFloorsUseZone:   floorPlaceName(12)===zoneAt(12).nm,
          ok: boss.name==='アビスの門番、アズレイア' && floorPlaceName(51)==='アビスの口'
              && floorPlaceName(12)===zoneAt(12).nm};
});

// 26-b. 分身は名前も大きさも本体と同じ。輪・王冠・HP帯は本体からも消える。
R.mirrorsIndistinguishable = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=true;
  boss.hp=Math.round(boss.maxHp*0.6);      // 本体は既に削れている＝帯が出る条件
  const bareBoss = finalDisguised(boss);   // まだ幻はいない
  spawnFinalMirrors(boss, 3, null);
  const ms=W.enemies.filter(e=>e.mirror && !e.dead);
  const named = ms.length>0 && ms.every(m=>m.name===boss.name);
  const noPhantomTag = ms.every(m=>!/幻/.test(m.name));
  const sameSize = ms.every(m=>m.r===boss.r && m.looksBoss===true);
  const hidesBoss = finalDisguised(boss) && ms.every(m=>finalDisguised(m));
  // 幻を片付ければ、本体の印は戻る
  despawnFinalMirrors(boss);
  const marksReturn = !finalDisguised(boss);
  return {count:ms.length, bossName:boss.name, mirrorNames:ms.map(m=>m.name),
          quietBeforeClones: !bareBoss,
          named, noPhantomTag, sameSize, hidesBoss, marksReturn,
          ok: named && noPhantomTag && sameSize && hidesBoss && marksReturn && !bareBoss};
});

// 26-c. 51階から先へは降りられない。帰る道だけが残る。
R.bottomStopsDescent = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  openStairs();
  const atBottom={title:el('st-title').textContent,
                  downHidden: el('st-down').style.display==='none',
                  retShown:   el('st-ret').style.display!=='none'};
  // 押しても降りない（結線側にも歯止めがある）
  const d0=S.run.depth;
  el('st-down').click();
  const stayed = S.run.depth===d0;
  el('m-stairs').classList.remove('on'); setScreen('game');
  // 50階では今まで通り降りられる
  startRun(50); P.invuln=1e9;
  openStairs();
  const at50={downShown: el('st-down').style.display!=='none'};
  el('m-stairs').classList.remove('on'); setScreen('game');
  return {atBottom, at50, stayed, depth:d0,
          canDescend50: canDescendFrom(50), stopsAt51: !canDescendFrom(51),
          portalAt51: returnPortalAt(51),
          ok: atBottom.downHidden && atBottom.retShown && stayed
              && at50.downShown && returnPortalAt(51) && !canDescendFrom(51)};
});

// 26-d. 帰還しても「52階から再開」にはならない。中継地点も51階で止まる。
R.bottomCapsResume = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(51); S.hero.party=[]; P.invuln=1e9;
  returnToTown();
  const start=S.startDepth;
  const u=unlockedDepths();
  document.getElementById('m-ret').classList.remove('on');
  return {startDepth:start, unlocked:u, deepestUnlocked:Math.max(...u),
          resumeCapped: start<=FINAL_DEPTH,
          noFloorsBeyond: u.every(d=>d<=FINAL_DEPTH),
          ok: start<=FINAL_DEPTH && u.every(d=>d<=FINAL_DEPTH)};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
