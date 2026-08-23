// 侵入者の経路探索が重くないか。
// 幅優先はプレイヤーがマスをまたぐたびに走るので、走り回っている最中がいちばん重い。
// 深い階（敵130体・広い間取り）で、侵入者ありと無しの fps を比べる。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const pg=await (await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message)));
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });

const R = await pg.evaluate(async ()=>{
  const run = async (withIntruder)=>{
    S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=40;
    S.hero.str=40;S.hero.dex=40;S.hero.vit=40;
    startRun(44); S.hero.party=[];
    S.hero.equip.weapon=genBaseItem('sword',40,2);
    S.hero.hpNow=stats(S.hero).maxHp;
    P.invuln=1e9;                       // 死んだら比較にならない
    if(withIntruder){ S.run.elapsed=INTRUDER_AFTER+0.1; tickIntruder(); }
    const had=!!liveIntruder();
    // 走り回らせる＝毎フレーム別のマスに入る＝再計算が最も多く走る
    let t=0, frames=0;
    const t0=performance.now();
    const iv=setInterval(()=>{ t+=0.05; stickDx=Math.cos(t*1.7); stickDy=Math.sin(t*1.3); }, 50);
    const c0=_tickCount;
    await new Promise(r=>setTimeout(r,5000));
    clearInterval(iv); stickDx=0; stickDy=0;
    frames=_tickCount-c0;
    const secs=(performance.now()-t0)/1000;
    return {had, enemies:W.enemies.filter(e=>!e.dead).length,
            floor:W.fl.W+'x'+W.fl.H,
            fps:+(frames/secs).toFixed(1),
            kills:S.run?S.run.kills:0};
  };
  const off = await run(false);
  const on  = await run(true);
  return {off, on, drop:+(off.fps-on.fps).toFixed(1),
          ok: on.had && on.fps > 50 && (off.fps-on.fps) < 8};
});
await b.close();
console.log(JSON.stringify({errs,R},null,2));
