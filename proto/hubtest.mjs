// 画面分割・ガチャ・死亡時の情報隠蔽の検証（タッチのみ）
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(350);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};
const tap=async(sel)=>{ const l=pg.locator(sel).first();
  await l.scrollIntoViewIfNeeded({timeout:3000}); await l.tap({timeout:3000}); await pg.waitForTimeout(220); };
const vis=sel=>pg.evaluate(s=>{const e=document.querySelector(s);
  return !!e && getComputedStyle(e).display!=='none';}, sel);

// --- 1. 拠点がハブになっていて、各サブ画面へ行き来できる
R.hub = await pg.evaluate(()=>{
  const t=document.getElementById('scr-town');
  return {townHasShopGrid: !!t.querySelector('#shop'),   // false であるべき（別画面に移動）
          screens:['scr-shop','scr-stash','scr-upg','scr-gacha'].map(id=>!!document.getElementById(id))};
});
for(const [btn,screen] of [['#btn-go-shop','shop'],['#btn-go-stash','stash'],
                           ['#btn-go-upg','upg'],['#btn-go-gacha','gacha']]){
  await tap(btn);
  R['open_'+screen] = await pg.evaluate(s=>S.screen===s, screen);
  await tap(`#scr-${screen} [data-back]`);
  R['back_'+screen] = await pg.evaluate(()=>S.screen==='town');
}
R.onlyOneScreenVisible = await pg.evaluate(()=>
  ['scr-town','scr-shop','scr-stash','scr-upg','scr-gacha']
    .filter(id=>document.getElementById(id).classList.contains('on')).length===1);

// --- 2. サブ画面でも購入・装備が動く
await pg.evaluate(()=>{ S.gold=9999; S.shards=999; S.deepest=20; rerollShop(); });
await tap('#btn-go-shop');
const uid=await pg.evaluate(()=>S.shop[0].uid);
await tap(`[data-buy="${uid}"]`);
R.buyInShopScreen = await pg.evaluate(u=>S.stash.some(i=>i.uid===u), uid);
await tap('#scr-shop [data-back]'); await tap('#btn-go-stash');
await tap(`#stash .item[data-uid="${uid}"]`);
R.equipInStashScreen = await pg.evaluate(u=>Object.values(S.hero.equip).some(i=>i&&i.uid===u), uid);
await tap('#scr-stash [data-back]'); await tap('#btn-go-upg');
await tap('[data-upg="hp"]');
R.upgradeInUpgScreen = await pg.evaluate(()=>upgLv('hp')===1);
await tap('#scr-upg [data-back]');

// --- 3. ガチャ: 1日1回は無料 / それ以降は広告 / その日の上限で打ち止め
await tap('#btn-go-gacha');
R.gachaStart = await pg.evaluate(()=>S.gachaLeft);
/* 3-a. その日の最初の1回は**広告を見ずに引ける**。
   街に来て何も起きない日を作らないための1回で、以降は今までどおり広告。 */
await tap('#btn-gacha');
R.freePull = await pg.evaluate(()=>({
  adStayedClosed: !document.getElementById('m-ad').classList.contains('on'),
  resultShown: document.getElementById('m-gres').classList.contains('on'),
  freeLeft: S.gachaFree||0}));
R.freePull.ok = R.freePull.adStayedClosed && R.freePull.resultShown
             && R.freePull.freeLeft===0;
await tap('#gres-ok');
// 3-b. 2回目からは広告
await tap('#btn-gacha');
R.adOpened = await vis('#m-ad');
R.okDisabledBeforeWatch = await pg.evaluate(()=>document.getElementById('ad-ok').disabled);
await pg.evaluate(()=>{ // 視聴完了を即座にシミュレート
  const ok=document.getElementById('ad-ok'); ok.disabled=false; ok.style.opacity='1';
});
await tap('#ad-ok');
R.resultShown = await vis('#m-gres');
await tap('#gres-ok');
R.afterFirst = await pg.evaluate(()=>({left:S.gachaLeft, carry:S.carry.length}));
// 2回目
await tap('#btn-gacha');
await pg.evaluate(()=>{ const ok=document.getElementById('ad-ok'); ok.disabled=false; });
await tap('#ad-ok'); await tap('#gres-ok');
R.afterSecond = await pg.evaluate(()=>({left:S.gachaLeft, carry:S.carry.length}));
// 残りを使い切ってから、次の1回がブロックされることを確認する
await pg.evaluate(()=>{ S.gachaLeft=0; renderGacha(); });
await tap('#btn-gacha');
R.blockedWhenSpent = await pg.evaluate(()=>({
  adStayedClosed: !document.getElementById('m-ad').classList.contains('on'),
  left:S.gachaLeft,
  label:document.getElementById('btn-gacha').textContent,
  saysTomorrow:document.getElementById('btn-gacha').textContent.includes('明日')}));
R.blockedWhenSpent.ok = R.blockedWhenSpent.adStayedClosed && R.blockedWhenSpent.left===0
                     && R.blockedWhenSpent.saysTomorrow;

// --- 4. 排出物の中身
R.pool = await pg.evaluate(()=>{
  S.deepest=25; let charm=0,weapon=0,badRar=0,unident=0;
  for(let i=0;i<600;i++){
    S.gachaLeft=1;
    const c=rollGacha();
    if(c.kind==='charm'){ charm++; if(!CHARMS.some(x=>x.id===c.charm.id)) badRar++; }
    else { weapon++; if(c.item.rar<2) badRar++; if(!c.item.ident) unident++;
           if(c.item.slot!=='weapon') badRar++; }
  }
  S.gachaLeft=0;
  return {charm, weapon, invalid:badRar, unidentified:unident};
});

// --- 5. 持ち込みが探索開始時に渡され、護符がステータスに乗る
R.carryIntoRun = await pg.evaluate(()=>{
  S.carry=[{kind:'charm',charm:CHARMS.find(c=>c.id==='swift')},
           {kind:'item', item:(()=>{const g=genItem(10,200); g.ident=true; g.slot='weapon'; return g;})()}];
  S.hero=newHero(); S.upg={};
  const msBefore=stats(S.hero).ms;
  startRun(1);
  const msAfter=stats(S.hero).ms;
  return {carryEmptied:S.carry.length===0, charmActive:S.run.charms.length===1,
          weaponInLoot:S.run.loot.length===1,
          msBoost:+(msAfter/msBefore).toFixed(2),
          // ガチャは探索ではなく日付で戻る。潜っても増えないことを確認する。
          gachaNotResetByRun:S.gachaLeft===0};
});

// --- 6. 治癒の護符
R.healCharm = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(1);
  S.run.charms=[CHARMS.find(c=>c.id==='heal')]; S.run.healUsed=false;
  const mx=stats(S.hero).maxHp;
  S.hero.hpNow=mx*0.35;
  hitPlayer(null, 8, 0, 1);              // 30% を切らせる
  const healed = S.hero.hpNow===mx && S.run.healUsed;
  S.hero.hpNow=mx*0.35;
  hitPlayer(null, 8, 0, 1);              // 2回目は発動しない
  const onceOnly = S.hero.hpNow<mx;
  return {healed, onceOnly};
});

// --- 7. 加護の護符でダメージが減る
R.guardCharm = await pg.evaluate(()=>{
  const sample=(charms)=>{
    S.hero=newHero(); startRun(1); S.run.charms=charms;
    const mx=stats(S.hero).maxHp; let total=0;
    for(let i=0;i<400;i++){ S.hero.hpNow=mx; hitPlayer(null,60,0,5); total+=mx-S.hero.hpNow; }
    return total/400;
  };
  const plain=sample([]), guarded=sample([CHARMS.find(c=>c.id==='guard')]);
  return {plain:+plain.toFixed(1), guarded:+guarded.toFixed(1),
          reduced:+(1-guarded/plain).toFixed(2)};
});

/* --- 8. 死亡時にロスト内容が出ない
   ただし金だけは例外——死亡時ロストが全ロストから半分ロストに変わった後、
   「持ち帰った額」を前向きに見せるようになった（ロスト内容の開示ではなく、
   持ち帰りの確認）。道具側の規則（何を失ったか見せない）は変わっていない。 */
R.deathHidesLoss = await pg.evaluate(()=>{
  S.hero=newHero(); S.grave=null; startRun(5);
  RNG=mulberry32(31);
  const names=[];
  for(let i=0;i<10;i++){ const g=genItem(9,60); g.ident=true; S.run.loot.push(g); names.push(itemName(g)); }
  const eq=genItem(9,0); eq.ident=true; S.hero.equip.weapon=eq; names.push(itemName(eq));
  S.run.gold=200;
  // 回避 6% を引いた回に静かに落ちないよう、死ぬまで殴る
  for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,5); }
  const html=document.getElementById('d-lost').innerHTML;
  return {
    noItemNames: !names.some(n=>html.includes(n)),
    noItemCounts: !/道具\s*\d+\s*点/.test(html),
    goldShownPositively: html.includes('持ち帰った'),
    noLostLabel: !html.includes('ロスト：'),
    mentionsGrave: html.includes('遺体'),
    graveStillExists: !!S.grave
  };
});

// --- 9. 回収時に中身が判明する
R.revealOnCollect = await pg.evaluate(async ()=>{
  S.hero=newHero(); startRun(S.grave.depth);
  enterFloor(S.grave.depth);
  const expected=S.grave.items.map(itemName);
  P.x=W.grave.x; P.y=W.grave.y;
  await new Promise(r=>setTimeout(r,300));
  const logHtml=document.getElementById('log').innerHTML;
  return {collected:S.grave===null, logShowsNames: expected.slice(0,1).some(n=>logHtml.includes(n))};
});

/* ============ ガチャは1日5回（探索では戻らない） ============ */
R.gachaDaily = await pg.evaluate(()=>{
  S.hero=newHero(); S.gachaDay=''; refreshGacha();
  const start=S.gachaLeft;
  S.lastDepth=1; startRun(1);
  const afterRun=S.gachaLeft;          // 潜っても戻らない
  let pulled=0;
  for(let i=0;i<9;i++) if(rollGacha()) pulled++;
  const exhausted=S.gachaLeft;
  const blockedAgain = rollGacha()===null;
  S.gachaDay='2000-1-1';               // 日付が変わった体にする
  const nextDay=refreshGacha();
  return {perDay:GACHA_PER_DAY, start, afterRun, pulled, exhausted, nextDay,
          startsFull: start===GACHA_PER_DAY,
          notResetByRun: afterRun===start,
          cappedPerDay: pulled===GACHA_PER_DAY && exhausted===0 && blockedAgain,
          resetsNextDay: nextDay===GACHA_PER_DAY};
});

/* レア度は回数増加のぶんだけ、どの帯でも一律に下がっている */
R.gachaRare = await pg.evaluate(()=>{
  const share=w=>{ const t=w.reduce((a,b)=>a+b,0);
                   return +((w.slice(2).reduce((a,b)=>a+b,0)/t)*100).toFixed(1); };
  const rows=GACHA_BANDS.map(b=>({nm:b.nm, before:share(b.w), after:share(gachaWeights(b)),
                                  ratio:+(share(gachaWeights(b))/share(b.w)).toFixed(2)}));
  // 実際に引いても効いているか
  const before=[], after=[];
  for(let i=0;i<3000;i++){ RNG=mulberry32(i*7919);
    S.lastDepth=25;
    const band=gachaBand();
    const w=band.w, tot=w.reduce((a,b)=>a+b,0);
    let x=rnd()*tot, r=0;
    for(let k=0;k<w.length;k++){ x-=w[k]; if(x<=0){ r=k; break; } }
    before.push(r);
    after.push(rollGachaRarity(band));
  }
  const rare=a=>+((a.filter(v=>v>=2).length/a.length)*100).toFixed(1);
  return {mul:GACHA_RARE_MUL, rows, sampledBefore:rare(before), sampledAfter:rare(after),
          evenAcrossBands: rows.every(r=>Math.abs(r.ratio-GACHA_RARE_MUL)<0.03),
          sampleAgrees: Math.abs(rare(after)/rare(before)-GACHA_RARE_MUL)<0.08};
});

/* ============ 拠点下部のバナー枠 ============ */
R.adBanner = await pg.evaluate(()=>{
  S.hero=newHero(); setScreen('town');
  const bar=document.getElementById('adbar');
  const town={on:bar.classList.contains('on'),
              pad:document.getElementById('scr-town').classList.contains('banner')};
  const r=bar.getBoundingClientRect();
  const shop=(setScreen('shop'), bar.classList.contains('on'));
  const upg=(setScreen('upg'),  bar.classList.contains('on'));
  startRun(3); setScreen('game');
  const game=bar.classList.contains('on');
  const padInGame=document.getElementById('scr-town').classList.contains('banner');
  setScreen('town');
  return {town, shop, upg,
          height:Math.round(r.height), atBottom:Math.abs(r.bottom-innerHeight)<2,
          shownInMenus: town.on && shop && upg,
          // 探索中は絶対に出さない（画面が狭く、視界が塞がると被弾に直結する）
          hiddenInGame: game===false && padInGame===false,
          leavesRoom: town.pad};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
