// 未鑑定ルール / 探索中インベントリ / 移動速度 の検証（タッチのみ）
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

// --- 1. 鑑定ルール: Common/Magic は鑑定済み、Rare 以上は未鑑定
R.identRule = await pg.evaluate(()=>{
  RNG=mulberry32(4242);
  const c={}; let wrong=0;
  for(let i=0;i<20000;i++){
    const it=genItem(30,120);
    c[it.rar]=(c[it.rar]||0)+1;
    if((it.rar<=1) !== it.ident) wrong++;
  }
  return {wrong, counts:c};
});

// --- 2. 未鑑定品は名前・ilvl・能力が一切漏れない
R.hidden = await pg.evaluate(()=>{
  RNG=mulberry32(7);
  let it=null;
  for(let i=0;i<5000 && !it;i++){ const g=genItem(30,300); if(!g.ident) it=g; }
  if(!it) return {found:false};
  const html=itemHTML(it,false,{lockUnident:true,compare:true});
  const leaks=[];
  if(html.includes(it.nm)) leaks.push('base name: '+it.nm);          // 「両手剣」等
  if(it.atk && html.includes(String(it.atk))) leaks.push('atk');
  if(it.def && html.includes(String(it.def))) leaks.push('def');
  if(html.includes('ilvl')) leaks.push('ilvl');
  it.aff.forEach(a=>{ if(html.includes(a.nm)) leaks.push('affix '+a.nm); });
  return {found:true, rarity:it.rar, leaks, name:itemName(it), showsUnident:html.includes('未鑑定')};
});

// --- 3. 移動速度 1.25 倍
R.moveSpeed = await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero();
  const ms=stats(S.hero).ms;
  return {value:+ms.toFixed(3), ratioVsOld:+(ms/3.3).toFixed(3)};
});

// --- 4. 探索中インベントリ
await pg.evaluate(()=>{ S.gold=0; S.upg={}; S.stash=[]; S.hero=newHero(); });
await pg.locator('#btn-dive').tap();
await pg.waitForTimeout(300);
if(await pg.evaluate(()=>S.screen==='help')) { await pg.locator('#help-ok').tap(); await pg.waitForTimeout(250); }
R.inGame = await pg.evaluate(()=>S.screen==='game');

// 鑑定済みの武器と、未鑑定の装備を 1 つずつ持たせる
const seeded = await pg.evaluate(()=>{
  RNG=mulberry32(99);
  let good=null, unid=null;
  for(let i=0;i<9000 && (!good||!unid);i++){
    const g=genItem(14,300);
    if(!good && g.ident && g.slot==='weapon' && g.atk>0) good=g;
    if(!unid && !g.ident) unid=g;
  }
  S.run.loot.push(good, unid);
  return {goodUid:good.uid, unidUid:unid.uid, goodAtk:good.atk};
});

await pg.locator('#bagbtn').tap();
await pg.waitForTimeout(300);
R.bagOpened = await pg.evaluate(()=>S.screen==='bag' &&
  document.getElementById('m-bag').classList.contains('on'));
// 開いている間はゲームが止まる
const pos0 = await pg.evaluate(()=>P.x);
await pg.waitForTimeout(500);
R.pausedWhileOpen = await pg.evaluate(x=>P.x===x, pos0);

// 鑑定済みをタップ → 装備できる
await pg.locator(`#bag-loot .item[data-uid="${seeded.goodUid}"]`).scrollIntoViewIfNeeded();
await pg.locator(`#bag-loot .item[data-uid="${seeded.goodUid}"]`).tap();
await pg.waitForTimeout(300);
R.equippedIdentified = await pg.evaluate(u=>
  S.hero.equip.weapon && S.hero.equip.weapon.uid===u &&
  !S.run.loot.some(i=>i.uid===u), seeded.goodUid);

// 未鑑定をタップ → 装備できない
const hpBefore = await pg.evaluate(()=>S.hero.hpNow);
await pg.locator(`#bag-loot .item[data-uid="${seeded.unidUid}"]`).scrollIntoViewIfNeeded();
await pg.locator(`#bag-loot .item[data-uid="${seeded.unidUid}"]`).tap();
await pg.waitForTimeout(300);
R.unidentifiedBlocked = await pg.evaluate(u=>
  !Object.values(S.hero.equip).some(i=>i&&i.uid===u) &&
  S.run.loot.some(i=>i.uid===u), seeded.unidUid);

// 装備中をタップ → 外して持ち物に戻る
await pg.locator(`#bag-equip .item[data-uid="${seeded.goodUid}"]`).scrollIntoViewIfNeeded();
await pg.locator(`#bag-equip .item[data-uid="${seeded.goodUid}"]`).tap();
await pg.waitForTimeout(300);
R.unequipped = await pg.evaluate(u=>
  !S.hero.equip.weapon && S.run.loot.some(i=>i.uid===u), seeded.goodUid);

// 付け替えで回復しない
R.noHealExploit = await pg.evaluate(async ()=>{
  const st=stats(S.hero); S.hero.hpNow=st.maxHp*0.4;
  const before=S.hero.hpNow;
  const it=S.run.loot.find(i=>i.ident && i.slot==='weapon');
  if(it){ S.hero.equip.weapon=it; clampHp(); }
  return Math.abs(S.hero.hpNow-before)<0.001;
});

// 閉じるとゲーム再開
await pg.locator('#bag-ok').tap();
await pg.waitForTimeout(250);
R.closed = await pg.evaluate(()=>S.screen==='game');
const px=await pg.evaluate(()=>P.x);
await pg.evaluate(()=>{ keys['d']=1; });
await pg.waitForTimeout(500);
await pg.evaluate(()=>{ keys['d']=0; });
R.resumedAfterClose = await pg.evaluate(x=>Math.abs(P.x-x)>0.3, px);

// --- 5. 拠点に戻ると鑑定される
await pg.evaluate(()=>{ S.run.depth=5; returnToTown(); });
await pg.waitForTimeout(200);
R.identifiedOnReturn = await pg.evaluate(()=>S.stash.length>0 && S.stash.every(i=>i.ident));

await b.close();
console.log(JSON.stringify({errs,R},null,2));
