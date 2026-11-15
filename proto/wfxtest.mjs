// 窓が開くときの光と波紋（windowFx）。資質の通知・閃きの窓・恩寵の3択。
//  ・開くと光の要素（.wfx）が出て、終われば消える
//  ・輪の角は窓と同じ作り（clip-path を写している）
//  ・閃きの窓は閃いた時だけ光る（名前を付け直すときは光らない）
//  ・恩寵の3択は左の札から1枚ずつ出る（まだの札は隠れていて押せない）
//  ・動きを減らす設定では何もしない
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await pg.evaluate(()=>{ S.hero=newHero(); TH.run(6,{seed:12}); S.hero.party=[]; setScreen('game'); });

R.potnote = await pg.evaluate(()=>{
  document.querySelectorAll('.wfx').forEach(n=>n.remove());
  _charPotPend=[{t:'pt',stat:'dmgPct',v:4,tier:2}]; flushCharPotNow();
  const fx=[...document.querySelectorAll('.wfx')], nd=el('potnote');
  const rings=fx.filter(n=>n.classList.contains('wfx-r'));
  return {appears: fx.length>=6, ringsLikeWindow: rings.length>0 && rings.every(r=>r.style.clipPath===getComputedStyle(nd).clipPath)};
});
await wait(1300);
R.cleansUp = await pg.evaluate(()=>({gone: document.querySelectorAll('.wfx').length===0}));

R.art = await pg.evaluate(()=>{
  const id=Object.values(WEAPON_ARTS).flat().find(a=>a&&a.id).id;
  document.querySelectorAll('.wfx').forEach(n=>n.remove());
  openArtRename(id, false); const quiet=document.querySelectorAll('.wfx').length===0; closeArtRename();
  openArtRename(id, true); const lit=document.querySelectorAll('.wfx').length>0; closeArtRename();
  return {quietOnRename: quiet, litOnFlash: lit};
});

R.boon = await pg.evaluate(()=>{
  openBoonPick('mid','灰の大蛙');
  const cards=[...document.querySelectorAll('#boon-choices .boon')];
  return {three: cards.length===3, 
          laterHidden: cards.slice(1).every(c=>c.classList.contains('wfx-wait') && getComputedStyle(c).visibility==='hidden')};
});
await wait(150);
R.boonOrder = await pg.evaluate(()=>{
  const c=[...document.querySelectorAll('#boon-choices .boon')].map(n=>!n.classList.contains('wfx-wait'));
  return {firstOnly: c[0] && !c[1] && !c[2]};
});
await wait(600);
R.boonAll = await pg.evaluate(()=>{
  const c=[...document.querySelectorAll('#boon-choices .boon')];
  const ok=c.every(n=>!n.classList.contains('wfx-wait'));
  el('m-boon').classList.remove('on'); _boonPending=null; setScreen('game');
  return {allShown: ok};
});

await pg.emulateMedia({reducedMotion:'reduce'});
R.reduced = await pg.evaluate(()=>{
  document.querySelectorAll('.wfx').forEach(n=>n.remove());
  _charPotPend=[{t:'pt',stat:'hp',v:9,tier:1}]; flushCharPotNow();
  const none=document.querySelectorAll('.wfx').length===0;
  openBoonPick('mid','灰の大蛙');
  const noWait=[...document.querySelectorAll('#boon-choices .boon')].every(n=>!n.classList.contains('wfx-wait'));
  el('m-boon').classList.remove('on'); _boonPending=null;
  return {noFx: none, cardsAtOnce: noWait};
});
await done(b, errs, R);
