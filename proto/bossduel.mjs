// ボス戦の攻防：崩し・妨害・見切り・隙と連携・段階（仕様：abyss-ボス戦の攻防-仕様案.md）
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* 戦いの用意。ボスは倒れないようにHPを盛り、通常攻撃は止める（技だけ見たい） */
const setup = `
  S.hero=newHero(); S.upg={hp:8}; startRun(DEPTH); S.hero.party=[];
  W.enemies=W.enemies.filter(e=>e.boss);
  var boss=W.enemies.find(e=>e.boss);
  boss.maxHp=boss.hp=1e7; boss.revealed=true; boss.moveCd=99; boss.atkV=0; boss.cd=99;
  P.x=boss.x+boss.r+1.0; P.y=boss.y; P.guard=false;
  duelInit(boss);
  var st0=Object.assign({}, stats(S.hero), {crit:0, dmgType:'pierce'});
`;
const run = (depth, body) => pg.evaluate(new Function(setup.replace('DEPTH', depth) + body));

/* ============ 1. 崩し ============ */
R.fill = await run(5, `
  const max0=boss.brkMax;
  let n=0; while(!(boss.broken>0) && n<200){ hitEnemy(boss, st0, 1); n++; }
  return {max0, hits:n, broken:boss.broken, brkN:boss.brkN, max1:boss.brkMax,
    ok: max0===30 && n>=15 && n<=30 && boss.broken===3.0 && Math.abs(boss.brkMax-36)<1e-6};
`);
R.vuln = await run(5, `
  const dmg=()=>{ RNG=mulberry32(7); const h=boss.hp; hitEnemy(boss, st0, 1); return h-boss.hp; };
  const d0=dmg(); boss.recover=1; const dr=dmg(); boss.recover=0;
  boss.broken=2; const db=dmg(); boss.broken=0;
  return {d0, dr, db, rr:+(dr/d0).toFixed(2), rb:+(db/d0).toFixed(2),
    ok: Math.abs(dr/d0-1.2)<0.06 && Math.abs(db/d0-1.3)<0.06};
`);
R.hurt = await run(5, `
  boss.brk=10; S.hero.hpNow=stats(S.hero).maxHp; FEEL.just=0; P.invuln=0;
  hitPlayer(boss, 5);
  return {after:boss.brk, ok: Math.abs(boss.brk-8)<1e-6};
`);
R.decay = await run(5, `
  boss.brk=10; boss.brkIdle=0;
  for(let i=0;i<60;i++) duelTick(boss, 1/30);   // 2秒：まだ減らない
  const at2=boss.brk;
  for(let i=0;i<90;i++) duelTick(boss, 1/30);   // さらに3秒
  return {at2, at5:+boss.brk.toFixed(2), ok: at2===10 && boss.brk<10 && boss.brk>5};
`);
R.blunt = await run(5, `
  const b0=boss.brk; hitEnemy(boss, Object.assign({}, st0, {dmgType:'blunt'}), 1);
  const g=boss.brk-b0;
  boss.brk=0; addStatus(boss,'stagger',1);
  return {blunt:g, stagger:boss.brk, staggerImmune: !hasStatus(boss,'stagger'),
    ok: g>=1.5 && boss.brk===3 && !hasStatus(boss,'stagger')};
`);

/* ============ 2. 妨害 ============ */
R.interrupt = await run(5, `
  bossBeginCast(boss, 'slam', P, false);
  const intr0=boss.cast.intr;
  duelCtx={kind:'art', tier:1, hit:[]};
  hitEnemy(boss, st0, 1); hitEnemy(boss, st0, 1);    // 同じ技の2発目は数えない
  duelCtx=null;
  const r={intr0, cast:boss.cast, recover:boss.recover, noIntr:boss.noIntr, brk:boss.brk};
  bossBeginCast(boss, 'slam', P, false);
  r.againBlocked=!boss.cast.intr; boss.cast=null;
  bossBeginCast(boss, 'slam', P, false);
  r.thirdIntr=boss.cast.intr; boss.cast=null;
  bossBeginCast(boss, 'wave', P, false);
  r.waveBlocked=!boss.cast.intr;
  duelCtx={kind:'ult', hit:[]}; hitEnemy(boss, st0, 1); duelCtx=null;
  r.waveStill=!!boss.cast;
  r.ok = intr0 && r.cast===null && r.recover===1.2 && r.noIntr==='slam' && r.brk===17
      && r.againBlocked && r.thirdIntr && r.waveBlocked && r.waveStill;
  return r;
`);
R.rageNoIntr = await run(5, `
  boss.hp=boss.maxHp*0.45; bossRage(boss);
  const rm=boss.rageMoves.slice();
  bossBeginCast(boss, rm[0], P, false);
  return {rageMoves:rm, blocked:!boss.cast.intr, ok: rm.length>0 && boss.cast.intr===false};
`);

/* ============ 3. 見切り ============ */
const mikiri = (leaveAt) => run(5, `
  bossBeginCast(boss, 'slam', P, false);
  const R2=BOSS_MOVES.slam.rad+boss.r;
  P.x=boss.x+R2*0.5; P.y=boss.y;
  const b0=boss.brk; let left=false, n=0;
  while(boss.cast && n<200){
    if(!left && boss.cast.t<=${leaveAt}){ P.x=boss.x+R2+1.2; left=true; }
    enemyUpdate(boss, 1/60); n++;
  }
  const r={mikiri:P.mikiri, gain:boss.brk-b0, recover:boss.recover};
  const h=boss.hp; RNG=mulberry32(3); hitEnemy(boss, st0, 1); r.d1=h-boss.hp; r.after=P.mikiri;
  const h2=boss.hp; RNG=mulberry32(3); hitEnemy(boss, st0, 1); r.d2=h2-boss.hp;
  return r;
`);
{
  const late=await mikiri(0.15), early=await mikiri(0.6);
  R.mikiri={late, early,
    ok: late.mikiri>0 && late.gain===8 && late.after===0 && late.d1>late.d2*1.5
     && !(early.mikiri>0) && early.gain===0};
}
R.mikiriDash = await run(5, `
  FEEL.just=0.2; FEEL.justUsed=false;
  const hp=S.hero.hpNow; hitPlayer(boss, 50);
  return {mikiri:P.mikiri, brk:boss.brk, hpSame:S.hero.hpNow===hp, ok: P.mikiri>0 && boss.brk===8 && S.hero.hpNow===hp};
`);

/* ============ 4. 隙・連携・段階 ============ */
R.recover = await run(5, `
  boss.state='chase';
  bossBeginCast(boss, 'slam', P, false); boss.cast.t=0.001;
  P.x=boss.x+BOSS_MOVES.slam.rad+boss.r+1.5;
  enemyUpdate(boss, 1/60);
  const rec=boss.recover, x0=boss.x, y0=boss.y;
  boss.moveCd=0;
  for(let i=0;i<30;i++) enemyUpdate(boss, 1/60);     // 0.5秒：まだ固まっている
  return {rec, still: boss.x===x0 && boss.y===y0 && !boss.cast, ok: Math.abs(rec-0.9)<1e-6 && boss.x===x0 && !boss.cast};
`);
R.combo = await run(5, `
  const save=DUEL.comboCh.slice(); DUEL.comboCh=[1,1,1];
  boss.moves=['cleave','slam']; boss.rage=true; boss.teleMul=0.65; boss.phase=2;
  P.x=boss.x+boss.r+1.0; P.y=boss.y;
  bossBeginCast(boss, 'cleave', P, false); boss.cast.t=0.001;
  enemyUpdate(boss, 1/60);
  const r={combo:boss.combo && boss.combo.id, rec1:boss.recover};
  for(let i=0;i<40 && !boss.cast;i++) enemyUpdate(boss, 1/60);
  r.second=boss.cast && boss.cast.id; r.secondIsCombo=!!(boss.cast && boss.cast.combo);
  if(boss.cast){ boss.cast.t=0.001; enemyUpdate(boss, 1/60); }
  r.rec2=+boss.recover.toFixed(3); r.noChain=!boss.combo;
  boss.moves=['cleave','burst']; boss.recover=0;
  bossBeginCast(boss, 'cleave', P, false); boss.cast.t=0.001; enemyUpdate(boss, 1/60);
  r.withoutPartner=boss.combo;
  DUEL.comboCh=save;
  r.ok = r.combo==='slam' && r.rec1===0 && r.second==='slam' && r.secondIsCombo
      && Math.abs(r.rec2-0.9*0.7*1.5)<0.01 && r.noChain && r.withoutPartner===null;
  return r;
`);
R.phase = await run(5, `
  const r={p0:boss.phase};
  boss.hp=boss.maxHp*0.45; enemyUpdate(boss, 1/60);
  r.p1=boss.phase; r.rage=boss.rage; r.roar1=boss.roar>0;
  boss.roar=0; const m0=boss.brkMax;
  bossBeginCast(boss, 'slam', P, false);
  boss.hp=boss.maxHp*0.15; enemyUpdate(boss, 1/60);
  r.p2=boss.phase; r.castCancelled=!boss.cast; r.maxMul=+(boss.brkMax/m0).toFixed(2);
  r.ok = r.p0===1 && r.p1===2 && r.rage && r.roar1 && r.p2===3 && r.castCancelled && r.maxMul===0.8;
  return r;
`);

/* ============ 5. 予兆＝当たり判定 ============ */
R.hitbox = await run(10, `
  boss.atkV=10; const bad=[];
  RNG=mulberry32(11);
  ['slam','cleave','charge','beam','pillars'].forEach(id=>{
    for(let k=0;k<40;k++){
      const x0=boss.x, y0=boss.y;
      bossBeginCast(boss, id, {x:boss.x+rf(-4,4), y:boss.y+rf(-4,4)}, false);
      const px=boss.x+rf(-9,9), py=boss.y+rf(-9,9);
      P.x=px; P.y=py; S.hero.hpNow=stats(S.hero).maxHp; FEEL.just=0; P.invuln=0;
      const want=bossMoveHits(boss, boss.cast, px, py, P.r);
      const hp=S.hero.hpNow; resolveBossMove(boss); boss.cast=null;
      const got=S.hero.hpNow<hp;
      boss.x=x0; boss.y=y0;
      if(want!==got) bad.push(id+':'+want+'/'+got);
    }
  });
  return {bad:bad.slice(0,8), ok: bad.length===0};
`);

/* ============ 6. 表示 ============ */
R.hud = await run(5, `
  boss.revealed=false; updateHUD();
  const hidden=getComputedStyle(el('bossbar')).display==='none';
  boss.revealed=true; boss.brk=boss.brkMax*0.9; updateHUD();
  const w1=el('bossbrk').style.width, hot=el('bossbk').className;
  boss.brk=0; boss.broken=1.5; boss.brkT=3; updateHUD();
  const w2=el('bossbrk').style.width, down=el('bossbk').className, nm=el('bossname').textContent;
  return {hidden, w1, hot, w2, down, nm,
    ok: hidden && parseFloat(w1)===90 && hot.includes('hot') && parseFloat(w2)===50 && down.includes('down') && nm.includes('崩れ')};
`);

/* ============ 7. 仲間もボスの予兆を見て避ける ============ */
const allyDodge = (moveId, noDodge) => run(5, `
  const a=makeAlly(5, S.hero, JOBS[0]); a.hpNow=allyStats(a).maxHp; S.hero.party=[a];
  ${noDodge ? 'window.__ads=allyDodgeSpot; allyDodgeSpot=()=>null;' : ''}
  boss.atkV=40;
  // 主人公は範囲の外（左）に、仲間はボスのすぐ右に置く
  P.x=boss.x-(BOSS_MOVES.slam.rad+boss.r+2.0); P.y=boss.y;
  a.x=boss.x+boss.r+0.6; a.y=boss.y+0.2;
  bossBeginCast(boss, '${moveId}', ${moveId==='cleave'||moveId==='beam'||moveId==='charge' ? 'a' : 'a'}, false);
  boss.cast.t=boss.cast.max=0.9;
  const inAtStart=bossMoveHits(boss, boss.cast, a.x, a.y, a.r);
  const hp0=a.hpNow; let outBefore=false, reentered=false, wasOut=false;
  for(let i=0;i<70 && boss.cast;i++){
    const c=boss.cast;
    stepSim(1/60);
    if(boss.cast===c){ const inside=bossMoveHits(boss, c, a.x, a.y, a.r); if(!inside) wasOut=true; else if(wasOut) reentered=true; outBefore=!inside; }
  }
  ${noDodge ? 'allyDodgeSpot=window.__ads;' : ''}
  return ${noDodge ? '{inAtStart, gotHit: a.hpNow<hp0}' : '{inAtStart, outBefore, stayedOut: !reentered, unhurt: a.hpNow>=hp0, mode:a.mode}'};
`);
{
  const slam=await allyDodge('slam'), cleave=await allyDodge('cleave'), beam=await allyDodge('beam'), ctrl=await allyDodge('slam', true);
  R.allyDodge={slam, cleave, beam, ctrl,
    ok: slam.inAtStart && slam.outBefore && slam.unhurt && slam.stayedOut
     && cleave.inAtStart && cleave.unhurt && beam.inAtStart && beam.unhurt
     && ctrl.inAtStart && ctrl.gotHit};
}

const allOk = Object.values(R).every(r=>r.ok) && !errs.length;
console.log(JSON.stringify({allOk, errs, R}, null, 2));
await b.close();
process.exit(allOk?0:1);
