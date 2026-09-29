import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const browser=await chromium.launch({args:['--allow-file-access-from-files']});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage(), errors=[], results=[];
page.on('pageerror',e=>errors.push(e.message));
const url='file://'+path.resolve('proto/index.html');
const timings=[];
async function check(name,fn){await fn();results.push(name);}
async function boot(){await page.goto(url);await page.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);}
async function reload(){await page.reload();await page.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);}
async function resume(){await page.click('#t-start');}
async function flush(){await page.evaluate(()=>{ABYSS_SAVE.request();ABYSS_SAVE.frame();});assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().failed),false,await page.locator('#save-message').textContent());}
try{
await boot();
await check('new game autosaves after name confirmation',async()=>{
  await page.click('#t-start');await page.fill('#nm-input','保存テスト');await page.click('#nm-ok');
  await page.waitForFunction(()=>ABYSS_SAVE.info().revision>0);
});
await check('town survives reload with inventory and growth',async()=>{
  await page.evaluate(()=>{S.gold=1234;S.shards=234;S.stash=[genItem(5,0)];S.mastery.sword={lv:3,xp:14};});await flush();
  const before=await page.evaluate(()=>JSON.stringify([S.name,S.gold,S.shards,S.stash,S.mastery]));
  await reload();assert.equal(await page.locator('#t-start').textContent(),'つづきから');await page.click('#t-help');await page.click('#help-ok');assert.equal(await page.locator('#t-start').textContent(),'つづきから');await page.screenshot({path:'/tmp/abyss-save-title.png'});await resume();
  assert.equal(await page.evaluate(()=>JSON.stringify([S.name,S.gold,S.shards,S.stash,S.mastery])),before);
});
/* タイトルで入れたデバッグの切り替え（S.debug は保存しない）が「つづきから」で消えていた。
   階層全開放を入れて続きから入ると、階層選択が出ずに第1階層へ直行した（報告）。 */
await check('debug switches set on the title survive resume',async()=>{
  await reload();
  for(let i=0;i<5;i++)await page.click('#scr-title .ver');
  await page.click('#dbgbtn');await page.click('#dbg-depth');
  await page.evaluate(()=>el('m-debug').classList.remove('on'));
  await resume();
  assert.deepEqual(await page.evaluate(()=>[S.screen,dbg('allDepths'),unlockedDepths().length>1,el('dbgbtn').classList.contains('on')]),['town',true,true,true]);
  await page.click('#btn-dive');
  assert.equal(await page.evaluate(()=>el('m-depthsel').classList.contains('on')),true);
  assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().debugSession),true);
  await reload();await resume();                         // 検証の汚れを持ち越さない
  assert.equal(await page.evaluate(()=>!!(S.debug&&S.debug.allDepths)),false);
});
await check('unclaimed gacha result resumes without reroll or lost reward',async()=>{
  await page.evaluate(()=>{setScreen('gacha');doGachaPull();});await flush();
  const before=await page.evaluate(()=>JSON.stringify([_pending,S.gachaLeft,S.carry]));await reload();await resume();
  assert.equal(await page.evaluate(()=>JSON.stringify([_pending,S.gachaLeft,S.carry])),before);
  const carry=await page.evaluate(()=>S.carry.length);await page.click('#gres-ok');await reload();await resume();
  assert.equal(await page.evaluate(()=>S.carry.length),carry+1);assert.equal(await page.evaluate(()=>_pending),null);
});
await check('world, references, RNG, typed arrays and item IDs survive reload',async()=>{
  await page.evaluate(()=>{
    startRun(1);S.hero.party=[makeAlly(1,S.hero)];
    const a=S.hero.party[0];W.testOwner={owner:a,player:P};W.testSet=new Set([a]);
    S.run.gold=77;P.atkCd=1.234;P.invuln=100;pauseGame(true);el('m-help').classList.add('on');
  });await flush();
  const before=await page.evaluate(()=>({rng:RNG.state(),expected:mulberry32(RNG.state())(),id:genItem._n,run:JSON.stringify(S.run),world:JSON.stringify([W.fl,W.enemies,W.drops,W.seen]),x:P.x,cd:P.atkCd}));
  await reload();await resume();
  const after=await page.evaluate(()=>({rng:RNG.state(),expected:mulberry32(RNG.state())(),id:genItem._n,run:JSON.stringify(S.run),world:JSON.stringify([W.fl,W.enemies,W.drops,W.seen]),x:P.x,cd:P.atkCd}));
  assert.deepEqual(after,before);
  assert.equal(await page.evaluate(()=>W.testOwner.owner===S.hero.party[0]&&W.testOwner.player===P&&W.testSet.has(S.hero.party[0])&&W.seen[0] instanceof Uint8Array),true);
  assert.equal(await page.evaluate(()=>gamePaused()),true);await page.screenshot({path:'/tmp/abyss-save-resume.png'});
});
await check('ordinary exploration autosaves on interval, not every frame',async()=>{
  await page.click('#save-action');
  await page.evaluate(()=>{W.enemies=[];W.drops=[];S.hero.party=[];delete W.testOwner;delete W.testSet;});await flush();
  const revision=await page.evaluate(()=>ABYSS_SAVE.info().revision);
  await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().revision),revision);
  await page.waitForFunction(revision=>ABYSS_SAVE.info().revision>revision,revision,{timeout:7000});
});
await check('boon choices resume without reroll',async()=>{
  await page.evaluate(()=>{openBoonPick('mid','テスト');});await flush();
  const choices=await page.evaluate(()=>JSON.stringify(_boonPending));await reload();await resume();
  assert.equal(await page.evaluate(()=>JSON.stringify(_boonPending)),choices);
  await page.click('#save-action');assert.equal(await page.locator('#m-boon').evaluate(e=>e.classList.contains('on')),true);
});
await check('consumable target picker survives reload without spending item',async()=>{
  await page.evaluate(()=>{setScreen('game');const it=makeConsum('salve');S.run.loot.push(it);openUseTarget(it);});await flush();
  const count=await page.evaluate(()=>S.run.loot.length);await reload();await resume();await page.click('#save-action');
  assert.equal(await page.evaluate(()=>_utItem?.consum),'salve');assert.equal(await page.evaluate(()=>S.run.loot.length),count);
  await page.locator('[data-ut="0"]').click();
});
await check('all zones and final boss reward survive autosave',async()=>{
  for(const depth of [5,10,17,26,40,50,51]){
    await page.evaluate(depth=>{enterFloor(depth);setScreen('game');pauseGame(true);el('m-help').classList.add('on');},depth);await flush();
    timings.push(await page.evaluate(()=>ABYSS_SAVE.info()));
  }
  await page.evaluate(()=>{setScreen('game');const boss=W.enemies.find(e=>e.boss);killEnemy(boss);});await flush();
  const clears=await page.evaluate(()=>S.cleared);await reload();await resume();await page.click('#save-action');
  assert.equal(await page.evaluate(()=>S.screen),'clear');assert.equal(await page.evaluate(()=>S.cleared),clears);
  await page.click('#clr-ok');assert.equal(await page.evaluate(()=>S.screen),'boon');
});
await check('death persists without resurrection or second penalty',async()=>{
  await page.evaluate(()=>{S.hero.boons=[];S.upg={};S.relicEq=[];S.hero.equip.accessory=null;S.gold=1000;die();});await flush();
  const state=await page.evaluate(()=>JSON.stringify([S.gold,S.deaths,S.grave,S.legacyBoons,S.fallen]));
  await reload();await resume();assert.equal(await page.evaluate(()=>S.hero),null);
  assert.equal(await page.evaluate(()=>JSON.stringify([S.gold,S.deaths,S.grave,S.legacyBoons,S.fallen])),state);
  assert.equal(await page.locator('#m-death').evaluate(e=>e.classList.contains('on')),true);
  await page.click('#d-ok');
});
await check('overflow return choice resumes and banks rewards once',async()=>{
  await page.evaluate(()=>{startRun(5);S.stash=Array.from({length:stashCap()},()=>genItem(1,0));S.run.loot=[genItem(3,0),genItem(4,0)];S.run.gold=100;returnToTown();});await flush();
  const gold=await page.evaluate(()=>S.gold);await reload();await resume();await page.click('#save-action');
  assert.equal(await page.evaluate(()=>S.gold),gold);assert.equal(await page.evaluate(()=>S.screen),'keep');
  await page.click('#keep-ok');const after=await page.evaluate(()=>S.gold);await reload();await resume();
  assert.equal(await page.evaluate(()=>S.gold),after);assert.equal(await page.evaluate(()=>S.run),null);
});
await check('second tab cannot overwrite progress',async()=>{
  const second=await context.newPage();await second.goto(url);await second.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);
  assert.equal(await second.evaluate(()=>ABYSS_SAVE.info().owned),false);assert.equal(await second.locator('#t-start').isDisabled(),true);await second.close();
});
await check('write failure pauses and retry preserves in-memory change',async()=>{
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('容量不足','QuotaExceededError');};S.gold=9999;ABYSS_SAVE.request();ABYSS_SAVE.frame();});
  assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().failed&&gamePaused()),true);
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSet;});await page.click('#save-action');
  await reload();await resume();assert.equal(await page.evaluate(()=>S.gold),9999);
});
await check('corrupt primary offers explicit backup recovery',async()=>{
  await page.evaluate(()=>{S.gold=8888;});await flush();await page.evaluate(()=>localStorage.setItem('abyss.autosave.v1','broken'));
  await reload();assert.equal(await page.locator('#save-heading').textContent(),'保存データを復旧');
  await page.click('#save-action');await resume();assert.equal(await page.evaluate(()=>S.gold),9999);
});
await check('debug changes never overwrite normal save',async()=>{
  const before=await page.evaluate(()=>localStorage.getItem('abyss.autosave.v1'));
  await page.evaluate(()=>{S.debug={god:true};S.gold=1;ABYSS_SAVE.request();ABYSS_SAVE.frame();});
  assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().debugSession),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('abyss.autosave.v1')),before);
  await reload();await resume();assert.equal(await page.evaluate(()=>S.gold),9999);
});
await check('new game cancellation keeps existing autosave',async()=>{
  await reload();const before=await page.evaluate(()=>localStorage.getItem('abyss.autosave.v1'));
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'はじめから',exact:true}).click();await page.click('#nm-back');
  assert.equal(await page.evaluate(()=>localStorage.getItem('abyss.autosave.v1')),before);await resume();assert.equal(await page.evaluate(()=>S.gold),9999);
});
await check('confirmed new game replaces old progress only after name entry',async()=>{
  await reload();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'はじめから',exact:true}).click();
  await page.fill('#nm-input','新しい冒険');await page.click('#nm-ok');await reload();await resume();
  assert.equal(await page.evaluate(()=>S.name),'新しい冒険');assert.equal(await page.evaluate(()=>S.gold),0);
});
await check('explicit reset removes primary progress and backup',async()=>{
  await page.evaluate(()=>ABYSS_SAVE.clear());await reload();
  assert.equal(await page.evaluate(()=>S.hero),null);assert.equal(await page.evaluate(()=>localStorage.getItem('abyss.autosave.v1.previous')),null);
  assert.equal(await page.locator('#t-start').textContent(),'冒険に出る');
});
await check('unsupported future version is preserved without fallback',async()=>{
  await page.evaluate(()=>localStorage.setItem('abyss.autosave.v1',JSON.stringify({version:99,revision:100,savedAt:Date.now()})));
  await reload();assert.equal(await page.locator('#save-heading').textContent(),'保存データを読み込めません');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('abyss.autosave.v1')).version),99);
});
await check('unreadable data can be explicitly deleted after confirmation',async()=>{
  page.once('dialog',d=>d.accept());await page.click('#save-reset');await reload();
  assert.equal(await page.locator('#t-start').textContent(),'冒険に出る');assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().failed),false);
});
await check('autosave survives full browser shutdown and restart',async()=>{
  const profile=await mkdtemp(path.join(tmpdir(),'abyss-save-profile-'));
  let persistent;
  try{
    persistent=await chromium.launchPersistentContext(profile,{args:['--allow-file-access-from-files']});
    let p=await persistent.newPage();await p.goto(url);await p.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);
    await p.click('#t-start');await p.fill('#nm-input','再起動テスト');await p.click('#nm-ok');
    await p.waitForFunction(()=>ABYSS_SAVE.info().revision>0);await persistent.close();
    persistent=await chromium.launchPersistentContext(profile,{args:['--allow-file-access-from-files']});
    p=await persistent.newPage();await p.goto(url);await p.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);
    assert.equal(await p.locator('#t-start').textContent(),'つづきから');await p.click('#t-start');
    assert.equal(await p.evaluate(()=>S.name),'再起動テスト');
  }finally{if(persistent)await persistent.close();await rm(profile,{recursive:true,force:true});}
});
assert.deepEqual(errors,[]);console.log(JSON.stringify({R:Object.fromEntries(results.map(n=>[n,true])),errs:errors,timings:timings.map(x=>({bytes:x.bytes,writeMs:x.writeMs})),metrics:await page.evaluate(()=>ABYSS_SAVE.info())},null,2));
}catch(e){console.error(e);console.error('SAVE STATE',await page.evaluate(()=>({save:window.ABYSS_SAVE?.info(),screen:typeof S==='object'?S.screen:null,message:document.getElementById('save-message')?.textContent})));process.exitCode=1;}
finally{await browser.close();}
