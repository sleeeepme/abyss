// スマホ実機に近い条件（タッチのみ・マウス無し）で全ボタンを tap して回る
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

R.nojsRemoved = await pg.evaluate(()=>!document.getElementById('nojs'));

async function tap(sel){
  try{
    const l=pg.locator(sel).first();
    await l.scrollIntoViewIfNeeded({timeout:3000});
    await l.tap({timeout:3000});
    await pg.waitForTimeout(250);
    return true;
  }catch(err){ errs.push('TAP FAIL '+sel+': '+String(err.message).split('\n')[0]); return false; }
}

// タイトル: 説明を開く→閉じる（拠点の「？」はタイトルの「遊び方」に移した）
await pg.evaluate(()=>setScreen('title'));
await pg.waitForTimeout(150);
await tap('#t-help');
R.helpOpened = await pg.evaluate(()=>S.screen==='help');
await tap('#help-ok');
R.helpClosed = await pg.evaluate(()=>S.screen==='title');
await pg.evaluate(()=>setScreen('town'));
await pg.waitForTimeout(150);

// 拠点: 永続強化を買う（サブ画面へ移動してから）
// 永続強化の対価は金ではなく秘石になったので、秘石を持たせる
await pg.evaluate(()=>{ S.gold=9999; S.shards=999; S.deepest=20; rerollShop(); renderTown(); });
await tap('#btn-go-upg');
const g0=await pg.evaluate(()=>({gold:S.gold, shards:S.shards}));
await tap('[data-upg="hp"]');
R.upgradeByTap = await pg.evaluate(g=>upgLv('hp')===1 && S.shards<g.shards && S.gold===g.gold, g0);

// 拠点: 店で買う
await tap('#scr-upg [data-back]');
await tap('#btn-go-shop');
const uid=await pg.evaluate(()=>S.shop[0].uid);
await tap(`[data-buy="${uid}"]`);
R.buyByTap = await pg.evaluate(u=>S.stash.some(i=>i.uid===u), uid);

// 拠点: 倉庫の装備をタップして装備
await tap('#scr-shop [data-back]');
await tap('#btn-go-stash');
await tap(`#stash .item[data-uid="${uid}"]`);
R.equipByTap = await pg.evaluate(u=>Object.values(S.hero.equip).some(i=>i&&i.uid===u), uid);

// スクロールを誤タップ扱いしないか（強化カードの上を大きくスワイプ）
await tap('#scr-stash [data-back]');
await tap('#btn-go-upg');
const before = await pg.evaluate(()=>({g:S.shards, lv:upgLv('atk')}));
await pg.locator('[data-upg="atk"]').scrollIntoViewIfNeeded();
const box = await pg.locator('[data-upg="atk"]').boundingBox();
await pg.touchscreen.tap(box.x+box.width/2, box.y+box.height/2).catch(()=>{});
await pg.waitForTimeout(300);
const afterTap = await pg.evaluate(()=>upgLv('atk'));
R.tapWorksOnAtk = afterTap === before.lv + 1;

// 潜行
await tap('#scr-upg [data-back]');
await tap('#btn-dive');
R.dived = await pg.evaluate(()=>S.screen==='help'||S.screen==='game');
if(await pg.evaluate(()=>S.screen==='help')) await tap('#help-ok');
R.inGame = await pg.evaluate(()=>S.screen==='game' && !!W.fl);

// ゲーム中: 仮想スティックで動く
const x0=await pg.evaluate(()=>P.x);
await pg.touchscreen.tap(1,1).catch(()=>{});
await pg.evaluate(()=>{ /* noop */ });
const vp=pg.viewportSize();
await pg.touchscreen.tap(vp.width*0.2, vp.height*0.6).catch(()=>{});
// ドラッグで移動
await pg.evaluate(async (vp)=>{
  const mk=(x,y,id)=>new Touch({identifier:id,target:document.body,clientX:x,clientY:y});
  const s=vp.width*0.25, t=vp.height*0.6;
  const send=(type,x,y)=>{ const tch=mk(x,y,1);
    document.body.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[tch],
      changedTouches:[tch],bubbles:true,cancelable:true})); };
  send('touchstart',s,t);
  for(let i=1;i<=10;i++){ send('touchmove',s+i*6,t); await new Promise(r=>setTimeout(r,30)); }
  await new Promise(r=>setTimeout(r,500));
  send('touchend',s+60,t);
}, vp);
R.movedByStick = await pg.evaluate(x=>Math.abs(P.x-x)>0.3, x0);

// ゲーム中: 死亡 → 再開ボタンをタップ
await pg.evaluate(()=>{ S.hero.hpNow=1; hitPlayer(null,99999,0,5); });
await pg.waitForTimeout(300);
R.deathModal = await pg.evaluate(()=>document.getElementById('m-death').classList.contains('on'));
await tap('#d-ok');
R.backToTownByTap = await pg.evaluate(()=>S.screen==='town');
await tap('#btn-dive');
await pg.waitForTimeout(300);
R.canDiveAgain = await pg.evaluate(()=>S.screen==='game'||S.screen==='help');

await b.close();
console.log(JSON.stringify({errs,R},null,2));
