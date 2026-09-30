import {chromium,devices} from 'playwright';
import path from 'node:path';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:['--allow-file-access-from-files']});
const errs=[],R={};
try{
 for(const mobile of [false,true]){
  const context=await b.newContext(mobile?{...devices['iPhone 13']}:{viewport:{width:1280,height:800}});
  const pg=await context.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await pg.goto('file://'+path.resolve('index.html'));await pg.waitForURL('**/proto/index.html?alpha');
  const click=sel=>mobile?pg.locator(sel).tap():pg.locator(sel).click();
  await click('#t-start');
  R[mobile?'mobile':'desktop']=await pg.evaluate(()=>({started:S.screen==='game',party:party().length,weapon:S.hero.equip.weapon.base||S.hero.equip.weapon.name,stage:alphaTrial.stage,enemies:W.enemies.length}));
  assert.equal(await pg.evaluate(()=>S.screen),'game');assert.equal(await pg.evaluate(()=>party().length),2);
  await click('#alpha-pause');
  assert.equal(await pg.evaluate(()=>{const t=S.run.elapsed;stepSim(2);return S.run.elapsed===t}),true);
  await click('#alpha-resume');
  const moved=await pg.evaluate(()=>{const x=P.x;stepSim(.5,{each:()=>{keys.d=1;}});keys.d=0;return P.x>x;});assert(moved);
  await pg.evaluate(()=>{S.hero.hpNow=stats(S.hero).maxHp*.4;});await click('#alpha-heal');
  assert.equal(await pg.evaluate(()=>alphaTrial.potions),1);
  assert(await pg.evaluate(()=>S.hero.hpNow>stats(S.hero).maxHp*.7));
  if(!mobile){await pg.screenshot({path:'output/alpha-play.png'});}
  assert(await pg.evaluate(()=>{openStairs();return S.screen==='game';}));
  // Exercise combat using real damage, death and loot processing; no handcrafted run state.
  const combat=await pg.evaluate(()=>{
   P.invuln=1e9;let elapsed=0;
   for(const e of [...W.enemies]){
    if(S.run.kills>=6)break;
    P.x=e.x-.8;P.y=e.y;
    elapsed+=stepSim(35,{until:()=>e.dead||alphaTrial.result!=null})/60;
   }
   return {kills:S.run.kills,elapsed,errors:alphaTrial.result,screen:S.screen,hp:S.hero.hpNow,enemy:W.enemies.map(e=>({hp:e.hp,dead:e.dead,x:e.x,y:e.y})),pos:[P.x,P.y]};
  });R.combat=combat;console.error(JSON.stringify(combat));assert(combat.kills>=6);
  await pg.evaluate(()=>openStairs());await click('#alpha-next');
  assert.equal(await pg.evaluate(()=>S.run.depth),3);
  await pg.evaluate(()=>{
   P.invuln=1e9;for(const e of [...W.enemies]){if(S.run.kills-alphaTrial.killsAtEntry>=6)break;P.x=e.x-.8;P.y=e.y;stepSim(35,{until:()=>e.dead||alphaTrial.result!=null});}
  });
  await pg.evaluate(()=>openStairs());await click('#alpha-next');
  assert.equal(await pg.evaluate(()=>S.run.depth),5);
  const clear=await pg.evaluate(()=>{
   P.invuln=1e9;const boss=W.enemies.find(e=>e.boss);P.x=boss.x-.8;P.y=boss.y;
   stepSim(100,{until:()=>boss.dead||!!alphaTrial.result});
   document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));setScreen('game');
   if(boss.dead)openStairs();return {dead:boss.dead,result:alphaTrial.result};
  });R.clear=clear;assert(clear.dead);assert.equal(clear.result.reason,'clear');
  await click('#alpha-retry');assert.equal(await pg.evaluate(()=>alphaTrial.potions),2);
  await pg.evaluate(()=>{S.run.elapsed=299.99;stepSim(.1);});assert.equal(await pg.evaluate(()=>alphaTrial.result.reason),'time');
  await click('#alpha-retry');await pg.evaluate(()=>{S.hero.hpNow=0;stepSim(.1);});assert.equal(await pg.evaluate(()=>alphaTrial.result.reason),'death');
  await click('#alpha-title');assert.equal(await pg.evaluate(()=>S.hero),null);assert.equal(await pg.evaluate(()=>S.screen),'title');
  await context.close();
 }
 assert.deepEqual(errs,[]);
 console.log(JSON.stringify({errs,R},null,2));
}finally{await b.close();}
