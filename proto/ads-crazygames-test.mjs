import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch();
const sdkURL='https://sdk.crazygames.com/crazygames-sdk-v3.js';
const errors=[];
async function pageWith(mode){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost:8767/**',async route=>{
    const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
    const file=path.resolve('proto','.'+pathname);
    if(!file.startsWith(path.resolve('proto')+path.sep)){await route.abort();return;}
    try{await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}
  });
  if(mode==='real' && process.argv[2])await page.route(sdkURL,async r=>r.fulfill({body:await fs.readFile(process.argv[2]),contentType:'application/javascript'}));
  else if(mode==='blocked')await page.route(sdkURL,r=>r.abort());
  else if(mode!=='real')await page.route(sdkURL,r=>r.fulfill({contentType:'application/javascript',body:`
    window.sdkEvents=[];
    window.CrazyGames={SDK:{environment:${JSON.stringify(mode==='disabled'?'disabled':'local')},init:async()=>{},game:{settings:{muteAudio:false},addSettingsChangeListener(fn){window.settingsListener=fn;},gameplayStart(){sdkEvents.push('start');},gameplayStop(){sdkEvents.push('stop');}},ad:{requestAd(type,callbacks){window.adCallbacks=callbacks;window.adType=type;return Promise.resolve();}}}};
  `}));
  await page.goto('http://localhost:8767/index.html?ads=crazygames');
  await page.evaluate(()=>ABYSS_CRAZYGAMES.ready);
  return page;
}
try{
  const page=await pageWith('mock');
  assert.equal(await page.evaluate(()=>ABYSS_ADS.providerName),'crazygames');
  await page.evaluate(()=>{S.name='SDK検証';startAdventure();setScreen('gacha');refreshGacha();S.gachaFree=0;window.before=S.gachaLeft;});
  await page.click('#btn-gacha');
  await page.waitForFunction(()=>window.adCallbacks);
  assert.equal(await page.evaluate(()=>S.gachaLeft),await page.evaluate(()=>before));
  assert.equal(await page.evaluate(()=>adType),'rewarded');
  await page.evaluate(()=>adCallbacks.adStarted());
  assert.equal(await page.evaluate(()=>gamePaused()&&ABYSS_AUDIO.inspect().externallyMuted),true);
  assert.equal(await page.locator('#m-ad').evaluate(n=>getComputedStyle(n).visibility),'hidden');
  await page.evaluate(()=>{ABYSS_AUDIO.configure({...ABYSS_AUDIO.settings(),enabled:true});});
  assert.equal(await page.evaluate(()=>ABYSS_AUDIO.inspect().externallyMuted),true);
  await page.evaluate(()=>{adCallbacks.adFinished();adCallbacks.adFinished();});
  await page.waitForFunction(()=>!ABYSS_ADS.busy);
  assert.equal(await page.evaluate(()=>before-S.gachaLeft),1);
  assert.equal(await page.evaluate(()=>ABYSS_AUDIO.inspect().externallyMuted),false);
  // Abort reward session while SDK overlay remains. Pause/mute must persist.
  await page.evaluate(()=>{setScreen('gacha');window.rewards=0;openAd(()=>rewards++);});
  await page.waitForFunction(()=>ABYSS_CRAZYGAMES.blocked);
  await page.evaluate(()=>{adCallbacks.adStarted();closeAd(true);});
  assert.equal(await page.evaluate(()=>gamePaused()&&ABYSS_AUDIO.inspect().externallyMuted),true);
  await page.evaluate(()=>{settingsListener({muteAudio:true});adCallbacks.adFinished();});
  assert.equal(await page.evaluate(()=>rewards),0);
  assert.equal(await page.evaluate(()=>ABYSS_CRAZYGAMES.blocked),false);
  assert.equal(await page.evaluate(()=>ABYSS_AUDIO.inspect().externallyMuted),true);
  await page.evaluate(()=>settingsListener({muteAudio:false}));
  assert.equal(await page.evaluate(()=>ABYSS_AUDIO.inspect().externallyMuted),false);
  // Failed fill: no consumption, recover original modal.
  await page.evaluate(()=>{el('m-stairs').classList.add('on');openAd(()=>rewards++,'heal');});
  await page.waitForFunction(()=>ABYSS_CRAZYGAMES.blocked);
  await page.evaluate(()=>adCallbacks.adError({code:'unfilled'}));
  await page.waitForFunction(()=>!ABYSS_ADS.busy);
  assert.equal(await page.evaluate(()=>el('m-stairs').classList.contains('on')&&rewards===0),true);
  // Lost SDK callbacks must not leave the game paused forever.
  await page.clock.install();
  await page.evaluate(()=>openAd(()=>rewards++));
  await page.waitForFunction(()=>ABYSS_CRAZYGAMES.blocked);
  await page.clock.fastForward(120001);
  assert.equal(await page.evaluate(()=>ABYSS_CRAZYGAMES.blocked||ABYSS_AUDIO.inspect().externallyMuted),false);
  await page.evaluate(()=>adCallbacks.adFinished());
  assert.equal(await page.evaluate(()=>rewards),0);
  await page.clock.resume();
  // Gameplay events change once per transition.
  assert.deepEqual(await page.evaluate(()=>{sdkEvents.length=0;ABYSS_CRAZYGAMES.syncGameplay(true);ABYSS_CRAZYGAMES.syncGameplay(true);ABYSS_CRAZYGAMES.syncGameplay(false);return sdkEvents;}),['start','stop']);
  // Basic Launch explicitly suppresses ad-only controls, keeps free gacha.
  await page.evaluate(()=>openAd(()=>rewards++));
  await page.waitForFunction(()=>ABYSS_CRAZYGAMES.blocked);
  await page.evaluate(()=>adCallbacks.adError({code:'adsDisabledBasicLaunch'}));
  await page.waitForFunction(()=>!ABYSS_ADS.busy);
  assert.equal(await page.locator('#st-heal').evaluate(n=>getComputedStyle(n).display),'none');
  await page.evaluate(()=>{S.gachaFree=1;renderGacha();});
  assert.equal(await page.locator('#btn-gacha').evaluate(n=>getComputedStyle(n).display!=='none'),true);
  await page.close();
  for(const mode of ['disabled','blocked']){
    const p=await pageWith(mode);
    assert.equal(await p.evaluate(()=>ABYSS_CRAZYGAMES.unavailable),true);
    assert.equal(await p.evaluate(async()=> (await ABYSS_ADS.requestRewarded('gacha')).status),'unavailable');
    await p.close();
  }
  const real=await pageWith('real');
  assert.equal(await real.evaluate(()=>ABYSS_CRAZYGAMES.inspect().environment),'local');
  await real.evaluate(()=>{S.name='公式SDK';startAdventure();setScreen('gacha');refreshGacha();S.gachaFree=0;window.before=S.gachaLeft;});
  await real.click('#btn-gacha');
  await real.locator('#local-overlay').waitFor({state:'visible'});
  assert.match(await real.locator('#local-overlay').innerText(),/rewarded/);
  assert.equal(await real.evaluate(()=>gamePaused()&&ABYSS_AUDIO.inspect().externallyMuted),true);
  await real.screenshot({path:'/tmp/abyss-crazygames-local-ad.png'});
  await real.locator('#m-gres').waitFor({state:'visible',timeout:15000});
  assert.equal(await real.evaluate(()=>before-S.gachaLeft),1);
  assert.equal(await real.evaluate(()=>ABYSS_AUDIO.inspect().externallyMuted||ABYSS_CRAZYGAMES.blocked),false);
  await real.close();
  assert.deepEqual(errors,[]);
  console.log('CrazyGames: adapter cases and official SDK local overlay passed');
}finally{await browser.close();}
