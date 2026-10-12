import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
const root=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('index.html',import.meta.url).href);
 const decoded=await page.evaluate(async()=>{
  const ctx=new AudioContext();
  try{return await Promise.all(sounds.map(async s=>{const bytes=Uint8Array.from(atob(s.url.split(',')[1]),c=>c.charCodeAt(0));const b=await ctx.decodeAudioData(bytes.buffer);return {id:s.id,seconds:b.duration,channels:b.numberOfChannels};}));}finally{await ctx.close();}
 });
 if(decoded.length!==9)throw Error('missing sounds');
 if(await page.locator('.card').count()!==9)throw Error('missing cards');
 await page.click('[data-play="magic-unrestricted"]');
 await page.waitForFunction(()=>current&&!current.paused&&current.currentTime>0);
 await page.locator('#volume').fill('35');
 if(await page.evaluate(()=>current.volume)!==.35)throw Error('volume control');
 await page.click('#stop');
 if(await page.locator('.active').count())throw Error('stop did not clear');
 await page.click('[data-sequence="ui"]');
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='3方式の比較が終わりました');
 await page.click('[data-sequence="magic"]');
 await page.click('[data-play="ui-gb"]');
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='再生が終わりました');
 await page.waitForTimeout(550);
 if(await page.locator('.active').count())throw Error('old sequence resumed');
 await page.screenshot({path:root+'preview-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('mobile overflow');
 await page.screenshot({path:root+'preview-mobile.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 const result={decoded,controls:'play, stop, volume, sequence, interrupt passed',mobile_overflow:false,page_errors:errors};
 fs.writeFileSync(root+'browser-quality.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
