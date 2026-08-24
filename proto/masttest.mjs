// 武器熟練度と、杖の弾の形。
//
// どちらも狙いは「再走の道中に目盛りを置く」こと。
// 永続強化も潜在も潜る前に選ぶ物なので、
// **歩いている最中に伸びる物**がひとつも無かった。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 熟練度が伸びる ================= */

// 1-a. 当てるたびに溜まり、10段階で止まる
R.levels = await pg.evaluate(()=>{
  S.mastery={};
  const steps=[];
  for(let lv=1; lv<=MASTERY_MAX+2; lv++){
    gainMastery('sword', masteryNeed(Math.min(MASTERY_MAX, masteryOf('sword')+1)));
    steps.push(masteryOf('sword'));
  }
  return {steps, max:MASTERY_MAX, need1:masteryNeed(1), need10:masteryNeed(10),
          capped: masteryOf('sword')===MASTERY_MAX,
          risesSteadily: masteryNeed(10)>masteryNeed(1),
          ok: masteryOf('sword')===MASTERY_MAX && masteryNeed(10)>masteryNeed(1)};
});

// 1-b. 攻撃力・攻撃速度・射程が実際に伸びる
R.buffsStats = await pg.evaluate(()=>{
  S.mastery={};
  TH.run(1,{seed:5}); TH.floor(3);
  const w=genBaseItem('sword',10,1); w.ident=true; w.aff=[]; S.hero.equip.weapon=w;
  const b={atk:stats(S.hero).atk, aspd:stats(S.hero).aspd, range:stats(S.hero).range};
  for(let i=0;i<MASTERY_MAX;i++) gainMastery('sword', masteryNeed(masteryOf('sword')+1));
  const a={atk:stats(S.hero).atk, aspd:stats(S.hero).aspd, range:stats(S.hero).range};
  return {lv:masteryOf('sword'),
          atk:[+b.atk.toFixed(2), +a.atk.toFixed(2)],
          aspd:[+b.aspd.toFixed(2), +a.aspd.toFixed(2)],
          range:[+b.range.toFixed(2), +a.range.toFixed(2)],
          allUp: a.atk>b.atk && a.aspd>b.aspd && a.range>b.range,
          ok: a.atk>b.atk && a.aspd>b.aspd && a.range>b.range};
});

/* 1-c. 武器種ごとに別。剣を極めても、斧は0から。
       ここが同じだと「拾った物に持ち替えるか、育てた種を使い続けるか」が消える。 */
R.perWeaponType = await pg.evaluate(()=>{
  const sword=masteryOf('sword'), axe=masteryOf('axe');
  const w=genBaseItem('axe',10,1); w.ident=true; w.aff=[]; S.hero.equip.weapon=w;
  const withAxe=stats(S.hero).atk;
  const w2=genBaseItem('sword',10,1); w2.ident=true; w2.aff=[]; S.hero.equip.weapon=w2;
  const withSword=stats(S.hero).atk;
  return {sword, axe, withAxe:+withAxe.toFixed(2), withSword:+withSword.toFixed(2),
          separate: axe===0 && sword===MASTERY_MAX,
          ok: axe===0 && sword===MASTERY_MAX};
});

/* 1-d. 死んでも消えない。ここが消えると、再走に目盛りを置いた意味が丸ごと無くなる。 */
R.survivesDeath = await pg.evaluate(()=>{
  const before=masteryOf('sword');
  TH.run(1,{seed:5}); TH.floor(4);
  S.hero.hpNow=1; die();
  el('m-death').classList.remove('on');
  S.hero=newHero();
  return {before, after:masteryOf('sword'), kept: masteryOf('sword')===before,
          ok: masteryOf('sword')===before && before>0};
});

/* 1-e. 素振りでは上がらない。相手がいないところで振って上がると、
       安全な場所で素振りするのが最適解になり、目盛りの意味が反対になる。 */
R.needsATarget = await pg.evaluate(()=>{
  S.mastery={};
  TH.run(1,{seed:5}); TH.floor(3); TH.immortal(); TH.clearEnemies();
  const w=genBaseItem('mace',10,1); w.ident=true; w.aff=[]; S.hero.equip.weapon=w;
  P.target=null;
  for(let i=0;i<200;i++){ P.atkCd=0; playerAttack(); }
  const idle=masteryXp('mace');
  // 相手がいれば積む
  TH.floor(3);
  P.target=W.enemies[0];
  for(let i=0;i<50;i++){ P.atkCd=0; playerAttack(); }
  const fighting=masteryXp('mace')+masteryOf('mace')*masteryNeed(1);
  return {idle, fighting, noGainIdle: idle===0, gainsInFight: fighting>0,
          ok: idle===0 && fighting>0};
});

// 1-f. 仲間には乗らない（熟練は主人公の手癖で、渡した装備の性能ではない）
R.alliesUnaffected = await pg.evaluate(()=>{
  S.mastery={sword:{lv:MASTERY_MAX, xp:0}};
  TH.run(1,{seed:5}); TH.floor(3);
  const a=TH.ally(10,'warrior',10);
  const w=genBaseItem('sword',10,1); w.ident=true; w.aff=[];
  a.equip.weapon=w;
  const withMastery=allyStats(a).atk;
  S.mastery={};
  const without=allyStats(a).atk;
  return {withMastery:+withMastery.toFixed(2), without:+without.toFixed(2),
          same: Math.abs(withMastery-without)<0.001,
          ok: Math.abs(withMastery-without)<0.001};
});

// 1-g. ステータス画面に熟練の行が出る（見えない成長は成長ではない）
R.shownInUi = await pg.evaluate(()=>{
  S.mastery={sword:{lv:4, xp:10}};
  TH.run(1,{seed:5}); TH.floor(3);
  const w=genBaseItem('sword',10,1); w.ident=true; S.hero.equip.weapon=w;
  openStat();
  const html=el('bag-stats').innerHTML;
  closeStat();
  S.run=null; setScreen('char');
  const town=el('charcard').innerHTML;
  return {inRun: html.includes('武器熟練') && html.includes('剣 4'),
          inTown: town.includes('武器熟練'),
          ok: html.includes('武器熟練') && html.includes('剣 4') && town.includes('武器熟練')};
});

/* ================= 2. 杖の弾の形 ================= */

// 2-a. 4種あり、どれも出る
R.shapesRoll = await pg.evaluate(()=>{
  const c={};
  for(let i=0;i<800;i++){ const sh=rollStaffShape(); c[sh.id]=(c[sh.id]||0)+1; }
  const ids=STAFF_SHAPES.map(s=>s.id);
  const missing=ids.filter(id=>!c[id]);
  return {counts:c, ids, missing, kinds:ids.length,
          ok: ids.length===4 && missing.length===0};
});

// 2-b. 実際に撃つと、弾の本数が形ごとに変わる
R.staffFires = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(3); TH.immortal();
  const st=genBaseItem('staff',10,1); st.ident=true; st.aff=[];
  S.hero.equip.weapon=st;
  P.target=W.enemies[0];
  const seen=new Set(), shapes=new Set();
  for(let i=0;i<120;i++){
    W.fx=[]; P.atkCd=0; playerAttack();
    seen.add(W.fx.filter(f=>f.t==='pshot').length);
    shapes.add(P.staffShape);
  }
  const counts=[...seen].sort((a,c)=>a-c);
  return {counts, shapes:[...shapes],
          varies: counts.length>=3, hasSingle: counts.includes(1), hasFive: counts.includes(5),
          ok: counts.length>=3 && counts.includes(1)};
});

/* 2-c. 弾数と1発の威力は交換になっている。
       総火力が形で大きく変わると、良い形が出るまで撃たない待ちの遊びになる。 */
R.shapesBalanced = await pg.evaluate(()=>{
  const tot=STAFF_SHAPES.map(s=>({id:s.id, total:+(s.offs.length*s.mult).toFixed(2)}));
  const vals=tot.map(x=>x.total);
  const lo=Math.min(...vals), hi=Math.max(...vals);
  return {tot, lo, hi, spread:+(hi/lo).toFixed(2),
          within40pct: hi/lo <= 1.4,
          ok: hi/lo <= 1.4};
});

// 2-d. 弓は形が変わらない（変えると弓と杖の差が消える）
R.bowIsSingle = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(3); TH.immortal();
  const bw=genBaseItem('bow',10,1); bw.ident=true; bw.aff=[];
  S.hero.equip.weapon=bw;
  P.target=W.enemies[0];
  const seen=new Set();
  for(let i=0;i<60;i++){ W.fx=[]; P.atkCd=0; playerAttack();
    seen.add(W.fx.filter(f=>f.t==='pshot').length); }
  return {counts:[...seen], alwaysOne: [...seen].every(n=>n===1),
          ok: [...seen].every(n=>n===1)};
});

// 2-e. 形が変わっても例外なく回る（描画まで通す）
R.staffLive = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); TH.floor(12); TH.immortal();
  const st=genBaseItem('staff',12,1); st.ident=true; S.hero.equip.weapon=st;
  let threw=null;
  try{ stepSim(12, {draw:true, each:(t)=>{ stickDx=Math.cos(t*1.7); stickDy=Math.sin(t*1.3); }}); }
  catch(e){ threw=String(e.message); }
  stickDx=stickDy=0;
  return {threw, ok: threw===null};
});

await done(b, errs, R);
