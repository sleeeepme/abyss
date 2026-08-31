// 遺体回収システムの検証
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

// --- 1. 死亡すると遺体ができ、装備品は含まれず、金は半分（遺体に）／半分（即座に口座へ）
R.onDeath = await pg.evaluate(()=>{
  S.upg={}; S.stash=[]; S.gold=0; S.grave=null; S.hero=newHero();
  startRun(3);
  RNG=mulberry32(11);
  const bag=[]; for(let i=0;i<12;i++){ const g=genItem(6,50); bag.push(g); S.run.loot.push(g); }
  const eq=genItem(6,0); eq.ident=true; S.hero.equip.weapon=eq;
  S.run.gold=317;
  P.x=12.3; P.y=8.7;
  const depth=S.run.depth;
  /* 初期装備の「疾き」で回避 6% が乗っている。1発で死ぬ前提だと、
     たまたま回避を引いた回にこの検証が静かに false になる。死ぬまで殴る。 */
  for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,3); }
  const g=S.grave;
  return {
    created: !!g,
    depth: g && g.depth===depth,
    itemCount: g && g.items.length,
    inRange: g && g.items.length>=4 && g.items.length<=6,
    gold: g && g.gold,
    goldHalf: g && g.gold===Math.floor(317*0.5),
    equippedExcluded: g && !g.items.some(i=>i.uid===eq.uid),
    allFromBag: g && g.items.every(i=>bag.some(x=>x.uid===i.uid)),
    noDupes: g && new Set(g.items.map(i=>i.uid)).size===g.items.length,
    pos: g && [Math.round(g.x*10)/10, Math.round(g.y*10)/10],
    // 全ロストにしない。半分は遺体を待たず即座に口座へ入る
    bankedGold: S.gold,
    bankedHalf: S.gold===Math.floor(317*DEATH_GOLD_BANK_RATE),
    notFullLoss: S.gold>0,
  };
});

// --- 2. 別の階層には出ない / 同じ階層に来ると出る
R.spawn = await pg.evaluate(()=>{
  S.hero=newHero();
  const gd=S.grave.depth;
  startRun(gd+1);          // 違う階層
  const other = W.grave===null;
  enterFloor(gd);          // 遺体の階層
  const here = !!W.grave;
  const onFloor = W.grave && W.fl.g[Math.floor(W.grave.y)][Math.floor(W.grave.x)]!==T.WALL;
  return {notOnOtherFloor:other, appearsOnGraveFloor:here, snappedToWalkableTile:!!onFloor};
});

// --- 3. 触れると回収され、道具と金が戻る
R.collect = await pg.evaluate(async ()=>{
  const before={items:S.grave.items.length, gold:S.grave.gold,
                lootBefore:S.run.loot.length, runGold:S.run.gold};
  P.x=W.grave.x; P.y=W.grave.y;
  await new Promise(r=>setTimeout(r,250));   // update() が回るのを待つ
  return {
    graveCleared: S.grave===null && W.grave===null,
    lootRestored: S.run.loot.length===before.lootBefore+before.items,
    goldRestored: S.run.gold===before.runGold+before.gold,
    recovered: before.items
  };
});

// --- 4. 回収せずに死ぬと前の遺体は消える（新しい遺体で上書き）
R.overwrite = await pg.evaluate(()=>{
  // 遺体を作る
  S.hero=newHero(); S.grave=null; startRun(4);
  RNG=mulberry32(5);
  for(let i=0;i<10;i++) S.run.loot.push(genItem(6,50));
  S.run.gold=200; P.x=10.5; P.y=10.5;
  for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,4); }
  const first=S.grave, firstUids=first.items.map(i=>i.uid);

  // 回収せずに別の階層で死ぬ
  S.hero=newHero(); startRun(9);
  RNG=mulberry32(6);
  for(let i=0;i<10;i++) S.run.loot.push(genItem(6,50));
  S.run.gold=90; P.x=20.5; P.y=20.5;
  for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,9); }
  const second=S.grave;
  return {
    onlyOneGrave: second && second.depth===9,
    oldGraveGone: second && !second.items.some(i=>firstUids.includes(i.uid)),
    firstDepth:first.depth, secondDepth:second.depth
  };
});

/* --- 5. 持ち物が空なら遺体は金だけ / 本当に何も無ければ遺体なし

   「何も無い」の条件が1つ増えた。**積んだ経験値も遺体に残る**ようになったので、
   Lv.1 で経験値ゼロのとき以外は、手ぶらで死んでも取りに戻る理由が残る。
   再走でいちばん痛いのは持ち物ではなくレベル差なので、これは意図した変更。 */
R.edge = await pg.evaluate(()=>{
  /* **死ぬまで殴る。** 一撃だけだと、初期装備に付いている「疾き」の
     回避 6% を引いた回に、この検証まるごとが静かに false になる。
     実際にそれで落ちた（乱数の塩を 0 に固定した瞬間に、たまたま当たりを引いた）。
     見たいのは「殴られたとき」ではなく「死んだとき何が残るか」なので、
     死ぬまで殴るのが正しい書き方。 */
  const kill=(depth)=>{ for(let i=0;i<40 && S.hero;i++){
    S.hero.hpNow=1; hitPlayer(null,99999,0,depth); } };

  S.hero=newHero(); S.grave=null; startRun(2);
  S.run.loot=[]; S.run.gold=80; kill(2);
  const goldOnly = S.grave && S.grave.items.length===0 && S.grave.gold===40;

  // 経験値だけでも遺体はできる（取りに戻る理由になる）
  S.hero=newHero(); S.grave=null; startRun(2);
  S.hero.lv=8; S.hero.xp=0;
  S.run.loot=[]; S.run.gold=0; kill(2);
  const xpOnly = !!S.grave && S.grave.items.length===0 && S.grave.gold===0 && S.grave.xp>0;

  // 本当に何も積んでいなければ、遺体も残らない
  S.hero=newHero(); S.grave=null; startRun(1);
  S.hero.lv=1; S.hero.xp=0;
  S.run.loot=[]; S.run.gold=0; kill(1);
  const none = S.grave===null;
  return {goldOnlyGrave:goldOnly, xpOnlyGrave:xpOnly, noGraveWhenEmpty:none};
});

// --- 6. 死亡モーダル・拠点表示に遺体情報が出る
R.ui = await pg.evaluate(()=>{
  S.hero=newHero(); S.grave=null; startRun(6);
  RNG=mulberry32(77);
  for(let i=0;i<8;i++) S.run.loot.push(genItem(6,50));
  S.run.gold=150;
  for(let _i=0;_i<40 && S.hero;_i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,6); }
  const modal=document.getElementById('d-lost').innerHTML;
  // 能力値カードは拠点からステータス画面へ移した（拠点は決める場所だけにした）
  S.hero=newHero(); setScreen('char');
  const card=document.getElementById('charcard').innerHTML;
  return {modalMentionsGrave: modal.includes('遺体') && modal.includes('第6階層'),
          charScreenShowsGrave: card.includes('遺体') && card.includes('第6階層')};
});

// --- 7. 実プレイ: 遺体の階層まで潜って歩いて回収できる（タッチ操作で確認）
await pg.evaluate(()=>{ setScreen('town'); });
await pg.waitForTimeout(150);
await pg.locator('#btn-dive').tap();
await pg.waitForTimeout(300);
if(await pg.evaluate(()=>S.screen==='help')) { await pg.locator('#help-ok').tap(); await pg.waitForTimeout(250); }
R.walkCollect = await pg.evaluate(async ()=>{
  enterFloor(S.grave.depth);
  if(!W.grave) return {ok:false, why:'no grave on floor'};
  const n=S.grave.items.length, g=S.grave.gold;
  // 遺体の 3 マス手前に立ってから歩いて到達させる
  P.x=W.grave.x-2.5; P.y=W.grave.y;
  keys['d']=1;
  for(let i=0;i<40 && S.grave;i++) await new Promise(r=>setTimeout(r,50));
  keys['d']=0;
  return {ok:S.grave===null, lootGained:S.run.loot.length>=n, goldGained:S.run.gold>=g};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
