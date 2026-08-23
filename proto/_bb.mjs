import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const pg=await (await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message)));
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
console.log(JSON.stringify(await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const a=makeAlly(10,S.hero);
  a.x=boss.x+1; a.y=boss.y; a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  P.x=boss.x+40; P.y=boss.y+40;
  const tgts=aoeTargets().map(t=>({ent:!!t.ent, x:+t.x.toFixed(1), y:+t.y.toFixed(1)}));
  const move=BOSS_MOVES['slam'];
  const dist=Math.hypot(a.x-boss.x, a.y-boss.y);
  const ah0=a.hpNow;
  boss.cast={id:'slam', t:0, max:0.8, dir:0};
  resolveBossMove(boss); boss.cast=null;
  return {job:a.job, lv:a.lv, evade:jobDef(a.job).evade+allySkillSum(a).evade,
          move, dist:+dist.toFixed(2), bossR:boss.r, tgts,
          hp0:Math.round(ah0), hp1:Math.round(a.hpNow), dead:a.dead,
          allyDR:allyStats(a).allyDR, atkV:Math.round(boss.atkV)};
})));
console.log('errs',errs.slice(0,2));
await b.close();
