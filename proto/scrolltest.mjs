// スクロール操作を誤タップとして拾わないかの回帰テスト
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(''+e.message));
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(300);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
await pg.evaluate(()=>{ S.gold=99999; S.deepest=20; rerollShop(); setScreen('upg'); });
await pg.locator('[data-upg="atk"]').scrollIntoViewIfNeeded();
const box=await pg.locator('[data-upg="atk"]').boundingBox();
const before=await pg.evaluate(()=>({lv:upgLv('atk'), gold:S.gold}));
// カードの上から指を置いて大きく上へスワイプ（＝スクロール）
await pg.touchscreen.tap(1,1).catch(()=>{});
const cx=box.x+box.width/2, cy=box.y+box.height/2;
await pg.evaluate(async ([cx,cy])=>{
  const el=document.elementFromPoint(cx,cy);
  const mk=(x,y)=>new Touch({identifier:7,target:el,clientX:x,clientY:y});
  const fire=(type,x,y)=>{ const t=mk(x,y);
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],
      bubbles:true,cancelable:true})); };
  fire('touchstart',cx,cy);
  for(let i=1;i<=8;i++){ fire('touchmove',cx,cy-i*12); await new Promise(r=>setTimeout(r,16)); }
  fire('touchend',cx,cy-96);
},[cx,cy]);
await pg.waitForTimeout(400);
const after=await pg.evaluate(()=>({lv:upgLv('atk'), gold:S.gold}));
// 続けて普通にタップすれば効くこと
await pg.locator('[data-upg="atk"]').scrollIntoViewIfNeeded();
await pg.locator('[data-upg="atk"]').tap();
await pg.waitForTimeout(300);
const tapped=await pg.evaluate(()=>upgLv('atk'));
// 連続タップ（300ms 間隔）が両方効くこと
await pg.locator('[data-upg="hp"]').scrollIntoViewIfNeeded();
await pg.locator('[data-upg="hp"]').tap(); await pg.waitForTimeout(300);
await pg.locator('[data-upg="hp"]').tap(); await pg.waitForTimeout(300);
const rapid=await pg.evaluate(()=>upgLv('hp'));
await b.close();
console.log(JSON.stringify({errs,
  scrollDidNotBuy: after.lv===before.lv && after.gold===before.gold,
  tapStillWorks: tapped===before.lv+1,
  rapidDoubleTap: rapid===2 }, null, 2));
