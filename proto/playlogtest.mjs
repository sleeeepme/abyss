// 階ごとの外部テスト用ログ（PLAYLOG）の検証。
// 入場・死亡・滞在秒・入場HP%が階ごとに積まれ、localStorage に残り、
// ?log=1 のときだけ取り出しボタンが出ること。**乱数を消費しない**ことも見る。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
const URL0='file://'+path.resolve('proto/index.html');
await pg.goto(URL0); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ================= 1. 入場・滞在秒・死亡が階ごとに積まれる ================= */
R.record = await pg.evaluate(()=>{
  PLAYLOG.reset();
  S.hero=newHero(); S.upg={}; S.deaths=0; S.grave=null; S.salt=5; S.runs=0;
  startRun(1);                                   // 1階に入る
  S.run.elapsed = 12;
  S.hero.hpNow = Math.round(stats(S.hero).maxHp*0.5);
  enterFloor(2);                                 // 1階に 12 秒、2階へはHP50%で入る
  S.run.elapsed = 12 + 7;
  enterFloor(3);                                 // 2階に 7 秒
  S.run.elapsed = 12 + 7 + 3;
  S.hero.hpNow = 0; die();                       // 3階で 3 秒居て死ぬ
  const j = JSON.parse(PLAYLOG.json());
  const f = d => j.floors.find(x=>x.depth===d) || {};
  return {
    enter1: f(1).enter===1, enter2: f(2).enter===1, enter3: f(3).enter===1,
    secs1: f(1).secs===12, secs2: f(2).secs===7, secs3: f(3).secs===3,
    hp1Full: f(1).hpInAvg===100, hp2Half: Math.abs(f(2).hpInAvg-50)<=2,
    died3: f(3).deaths===1, noDeath1: f(1).deaths===0 && f(2).deaths===0,
    totalDeaths: j.deaths===1
  };
});

/* ================= 2. 保存され、読み直しても残る ================= */
R.persist = await pg.evaluate(()=>{
  const raw = localStorage.getItem(PLAYLOG.KEY);
  let ok=false; try{ ok = JSON.parse(raw).floors['3'].deaths===1; }catch(e){}
  return {stored: !!raw, parsed: ok};
});
await pg.reload(); await pg.waitForTimeout(400);
R.afterReload = await pg.evaluate(()=>{
  const j = JSON.parse(PLAYLOG.json());
  return {kept: j.deaths===1 && j.floors.length===3};
});

/* ================= 3. 乱数を消費しない ================= */
R.noRng = await pg.evaluate(()=>{
  const seq = ()=>{ RNG=mulberry32(4242); const a=[rnd(),rnd(),rnd()]; return a.join(','); };
  const want = seq();
  RNG=mulberry32(4242);
  PLAYLOG.json(); PLAYLOG.load();                // 読むだけ。書き出しも乱数に触れない
  const got = [rnd(),rnd(),rnd()].join(',');
  // 記録の更新側（enterFloor の包み）が乱数を使っていないこと:
  // 階の生成は enterFloor の中で完結するので、同じ種から同じ敵配置になる。
  const snap = ()=>{
    S.hero=newHero(); S.upg={}; S.deaths=0; S.salt=9; S.runs=0; startRun(1);
    enterFloor(4);
    return W.enemies.map(e=>e.x.toFixed(2)+','+e.y.toFixed(2)).join(';');
  };
  const a = snap(), b2 = snap();
  return {readsDontConsume: want===got, sameFloorTwice: a===b2 && a.length>0};
});

/* ================= 4. ?log=1 のときだけボタンが出る ================= */
R.button = {};
R.button.hiddenByDefault = await pg.evaluate(()=>!document.getElementById('playlogbtn'));
await pg.goto(URL0+'?log=1'); await pg.waitForTimeout(400);
R.button.shownWithLog1 = await pg.evaluate(()=>!!document.getElementById('playlogbtn'));
R.button.exportsJson = await pg.evaluate(()=>{
  const t = PLAYLOG.exportNow();
  try{ const j=JSON.parse(t); return Array.isArray(j.floors) && j.v===1; }catch(e){ return false; }
});

await pg.evaluate(()=>PLAYLOG.reset());
await b.close();
console.log(JSON.stringify({errs,R},null,2));
