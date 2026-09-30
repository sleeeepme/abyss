import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const browser=await chromium.launch();
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('proto/index.html'));
  await page.evaluate(()=>{S.name='広告検証';startAdventure();setScreen('gacha');S.gachaFree=0;});
  for(const outcome of ['cancelled','unavailable','error','rewarded']){
    const result=await page.evaluate(async outcome=>{
      closeAd(false);setScreen('gacha');refreshGacha();S.gachaFree=0;
      const before=S.gachaLeft;
      window.calls=0;
      ABYSS_ADS.setProvider({name:'sdk-test',requestRewarded:()=>{calls++;return new Promise(r=>window.adFinish=r);}});
      openAd();openAd();
      const paused=gamePaused(),buttonHidden=el('ad-ok').hidden;
      adFinish({status:outcome});
      await new Promise(r=>setTimeout(r,0));
      // Any late UI event must not award a second time.
      el('ad-ok').click();
      return {consumed:before-S.gachaLeft,calls,paused,buttonHidden,closed:!el('m-ad').classList.contains('on'),busy:ABYSS_ADS.busy,notice:!el('ad-notice').hidden};
    },outcome);
    assert.equal(result.consumed,outcome==='rewarded'?1:0);
    assert.equal(result.calls,1);assert.equal(result.paused,true);
    assert.equal(result.buttonHidden,true);assert.equal(result.closed,true);assert.equal(result.busy,false);
    assert.equal(result.notice,['error','unavailable'].includes(outcome));
  }
  const cancelled=await page.evaluate(async()=>{
    setScreen('gacha');let rewards=0;
    ABYSS_ADS.setProvider({name:'sdk-test',requestRewarded:()=>new Promise(r=>window.adFinish=r)});
    el('m-stairs').classList.add('on');
    openAd(()=>rewards++,'heal');
    closeAd(true);
    const restored=el('m-stairs').classList.contains('on');
    adFinish({status:'rewarded'});
    await new Promise(r=>setTimeout(r,0));
    openAd(()=>rewards++,'heal');
    setScreen('town');
    adFinish({status:'rewarded'});
    await new Promise(r=>setTimeout(r,0));
    return {rewards,restored,busy:ABYSS_ADS.busy};
  });
  assert.deepEqual(cancelled,{rewards:0,restored:true,busy:false});
  // Serve local files through a simulated public origin: demo must never auto-enable.
  await page.route('https://abyss-test.example/**',async route=>{
    const fs=await import('node:fs/promises');
    const rel=new URL(route.request().url()).pathname;
    try{await route.fulfill({body:await fs.readFile(path.resolve('proto','.'+rel)),contentType:rel.endsWith('.html')?'text/html':rel.endsWith('.js')?'application/javascript':'application/octet-stream'});}
    catch{await route.fulfill({status:404,body:''});}
  });
  await page.goto('https://abyss-test.example/index.html');
  assert.equal(await page.evaluate(()=>ABYSS_ADS.providerName),'none');
  assert.equal(await page.evaluate(()=>{S.name='公開検証';startAdventure();return el('adbar').classList.contains('on');}),false);
  assert.deepEqual(errors,[]);
  console.log('Ad browser integration checks passed');
} finally {await browser.close();}
