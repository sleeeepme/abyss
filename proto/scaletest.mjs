// インフレの土台。敵の密度スケーリングと、当たり判定の空間グリッド。
// 「奥へ行くほど派手にする」には、まず数を増やせる状態にしておく必要がある。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(600);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ---------- 密度のインフレと、当たり判定のグリッド ---------- */
R.density = await pg.evaluate(()=>{
  const at=d=>{ let t=0; for(let s=0;s<20;s++){ RNG=mulberry32(d*7919+s);
    t+=spawnEnemies(genFloor(d),d).length; } return Math.round(t/20); };
  // 5の倍数はボス階で取り巻きが絞られるので、通常階だけを並べる
  const normal={}; [1,9,11,21,31,41,49].forEach(d=>normal[d]=at(d));
  const ns=Object.values(normal);
  const boss={}; [10,30,50].forEach(d=>boss[d]=at(d));
  return {normal, boss,
          monotone: ns.every((v,i)=>i===0||v>=ns[i-1]),
          // 以前は第22階層で40体に頭打ちだった
          growsPastOldCap: normal[49]>normal[21]*2,
          bossKeepsFewer: boss[50]<normal[49]*0.5,
          withinBudget: normal[49]<=130};
});
R.grid = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(20);
  W.enemies.length=0;
  for(let i=0;i<60;i++){ const p=snapToFloor(W.fl, P.x+rf(-14,14), P.y+rf(-14,14));
    W.enemies.push({x:p.x, y:p.y, dead:false, r:0.34,
    arch:ARCH[0], fam:FAMILY[0], lv:20, elite:false, aff:[], maxHp:99, hp:99, atkV:0, def:0,
    res:{}, dt:'blunt', st:{}, bu:{}, state:'idle', t:0, cd:9, vx:0,vy:0,hit:0,tele:0,
    ms:0, teleMul:1, col:'#fff', name:'的'}); }
  gridBuild();
  // グリッド経由で拾える集合が、総当たりの結果と一致すること
  let mismatch=0, sumBrute=0, sumGrid=0;
  for(let k=0;k<40;k++){
    const x=P.x+rf(-14,14), y=P.y+rf(-14,14), r=rf(0.5,4);
    const brute=W.enemies.filter(e=>!e.dead && Math.hypot(e.x-x,e.y-y)<=r);
    const grid=nearEnemies(x,y,r).filter(e=>!e.dead && Math.hypot(e.x-x,e.y-y)<=r);
    sumBrute+=brute.length; sumGrid+=grid.length;
    if(brute.length!==grid.length) mismatch++;
  }
  // 絞り込めていること（全件返しているなら意味がない）
  const candidates=nearEnemies(P.x,P.y,1.5).length;
  return {cell:GRID_CELL, enemies:W.enemies.length, mismatch, sumBrute, sumGrid,
          matchesBruteForce: mismatch===0 && sumBrute===sumGrid,
          actuallyNarrows: candidates < W.enemies.length};
});


/* ---------- 実プレイでの負荷 ----------
   ヘッドレスなので実機の数字ではないが、崩れ方の傾向は出る。
   深い階層をそのまま生成して、実際に歩きながら測る。 */
R.live = await pg.evaluate(async ()=>{
  const run=async d=>{
    S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=45;
    S.hero.str=45;S.hero.dex=45;S.hero.vit=45;
    startRun(d); S.hero.party=[];
    S.hero.equip.weapon=genBaseItem('bow',45,2);
    S.hero.hpNow=1e9;
    W.seen.forEach(r=>r.fill(1));
    stickDx=0.6; stickDy=0.3;
    const t0=performance.now(), c0=_tickCount;
    await new Promise(r=>setTimeout(r,2200));
    const fps=+(((_tickCount-c0)/((performance.now()-t0)/1000))).toFixed(1);
    stickDx=0; stickDy=0;
    return {d, enemies:W.enemies.filter(e=>!e.dead).length, fps};
  };
  const out=[];
  for(const d of [11,26,41,49]) out.push(await run(d));
  return {runs:out, holdsUp: out.every(o=>o.fps>45),
          deepestIsCrowded: out[out.length-1].enemies>100};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
