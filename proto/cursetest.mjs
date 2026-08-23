// 呪い（週替わりの縛り・任意）と、遺体の風化、ガチャの排出率。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

R.weekly = await pg.evaluate(()=>{
  const wk=weekCurses().map(c=>c.id);
  const again=weekCurses().map(c=>c.id);
  return {count:wk.length, perWeek:CURSES_PER_WEEK, total:CURSES.length, ids:wk,
          deterministic: wk.join()===again.join(),
          noDupes: new Set(wk).size===wk.length,
          allDefined: CURSES.every(c=>c.nm&&c.what&&c.pay&&c.icon&&c.col)};
});
R.optional = await pg.evaluate(()=>{
  S.hero=newHero(); S.curses=[]; S.curseWeek=weekNo();
  const none=curseBonusPreview();
  const id=weekCurses()[0].id;
  S.curses=[id];
  const one=curseBonusPreview();
  S.curses=weekCurses().map(c=>c.id);
  const all=curseBonusPreview();
  S.curses=[];
  return {none, one, all,
          noneIsNeutral: none.shard===1&&none.ore===1&&none.gold===1&&none.xp===1&&none.mf===0,
          stacks: (all.shard+all.ore+all.gold+all.xp) > (one.shard+one.ore+one.gold+one.xp)};
});
R.locked = await pg.evaluate(()=>{
  S.hero=newHero(); S.curseWeek=weekNo(); S.curses=[weekCurses()[0].id];
  startRun(5);
  const atStart=activeCurses().slice();
  S.curses=[];                     // 潜ったあとで外しても
  const stillOn=activeCurses().slice();
  return {atStart, stillOn, lockedIn: stillOn.join()===atStart.join() && atStart.length===1};
});
R.effects = await pg.evaluate(()=>{
  const out={};
  const setup=(ids)=>{ S.hero=newHero(); S.upg={}; S.hero.lv=20;
    S.hero.str=20;S.hero.dex=20;S.hero.vit=20;
    S.curseWeek=weekNo(); S.curses=ids.slice(); startRun(12);
    S.run.curses=ids.slice(); return S.hero; };
  // 重圧: 最大HP -25%
  setup([]); const hp0=stats(S.hero).maxHp;
  setup(['weight']); const hp1=stats(S.hero).maxHp;
  out.weight={hp0, hp1, ratio:+(hp1/hp0).toFixed(2), works:hp1<hp0};
  // 静寂: 大技が使えない
  setup([]); S.greatKills=5; S.ult='quake'; S.ultLv={quake:1}; P.ultCd=0;
  const canNormally=ultReady();
  setup(['silence']); S.greatKills=5; S.ult='quake'; P.ultCd=0;
  out.silence={canNormally, blocked:!ultReady(), works:canNormally && !ultReady()};
  // 孤独: 仲間が出ない
  setup(['solitude']);
  let npcs=0; for(let i=0;i<200;i++){ RNG=mulberry32(i*7919); if(spawnNpc(W.fl,12)) npcs++; }
  setup([]); let npcs0=0;
  for(let i=0;i<200;i++){ RNG=mulberry32(i*7919); if(spawnNpc(W.fl,12)) npcs0++; }
  out.solitude={withCurse:npcs, without:npcs0, works:npcs===0 && npcs0>0};
  // 飢餓: 階段回復が効かない
  setup(['hunger']); S.hero.hpNow=1; S.run.healAds=2;
  stairHeal();
  out.hunger={hpAfter:S.hero.hpNow, adsLeft:S.run.healAds,
              works:S.hero.hpNow===1 && S.run.healAds===2};
  // 奔流: 敵が速い / 呼び声: 敵のレベル+4
  const msOf=(ids)=>{ setup(ids); RNG=mulberry32(999);
    const es=spawnEnemies(W.fl,12).filter(e=>!e.boss&&!e.uniq);
    return {ms:+(es.reduce((a,e)=>a+e.ms,0)/es.length).toFixed(2), lv:es[0].lv}; };
  const base=msOf([]), tor=msOf(['torrent']), call=msOf(['call']);
  out.torrent={base:base.ms, cursed:tor.ms, works:tor.ms>base.ms*1.25};
  out.call={baseLv:base.lv, cursedLv:call.lv, works:call.lv===base.lv+4};
  // 薄氷: 被ダメージ +40%
  const dmgOf=(ids)=>{ setup(ids); S.hero.hpNow=100000;
    hitPlayer(null, 100, 'blunt', 12); return 100000-S.hero.hpNow; };
  const d0=dmgOf([]), d1=dmgOf(['thin']);
  out.thin={normal:d0, cursed:d1, works:d1>d0};
  S.curses=[];
  return out;
});
R.rewards = await pg.evaluate(()=>{
  const gain=(ids)=>{ S.hero=newHero(); S.upg={}; S.shards=0; S.ore={};
    S.curseWeek=weekNo(); S.curses=ids.slice(); startRun(12); S.run.curses=ids.slice();
    gainShards(100); gainOre('raw',100);
    const g0=S.run.gold; S.run.gold=0;
    return {shard:S.shards, ore:oreRun('raw')}; };
  const base=gain([]), hun=gain(['hunger']), tor=gain(['torrent']);
  S.curses=[];
  return {base, hunger:hun, torrent:tor,
          hungerBoostsShards: hun.shard>base.shard,
          torrentBoostsOre: tor.ore>base.ore};
});
R.weekReset = await pg.evaluate(()=>{
  S.curseWeek = weekNo()-1;              // 先週の状態
  S.curses = ['hunger','torrent','weight','silence','solitude','thin','call'];
  refreshCurses();
  return {week:S.curseWeek===weekNo(), left:S.curses.length,
          onlyThisWeeks: S.curses.every(id=>weekCurses().some(c=>c.id===id)),
          droppedStale: S.curses.length <= CURSES_PER_WEEK};
});

/* ================= 遺体の風化とガチャの排出 ================= */

R.gachaRates = await pg.evaluate(()=>{
  const pct=(w,i0,i1)=>{ const t=w.reduce((a,b)=>a+b,0);
    return +((w.slice(i0,i1).reduce((a,b)=>a+b,0)/t)*100).toFixed(1); };
  const rows=GACHA_BANDS.map(bd=>{ const w=gachaWeights(bd);
    return {nm:bd.nm,
      commonBefore:pct(bd.w,0,1), common:pct(w,0,1),
      magicBefore:pct(bd.w,1,2),  magic:pct(w,1,2),
      rareBefore:pct(bd.w,2,5),   rare:pct(w,2,5)}; });
  // 実際に引いて確かめる
  S.hero=newHero(); S.lastDepth=1; S.gachaDay=today();
  const c={};
  for(let i=0;i<4000;i++){ RNG=mulberry32(i*7919);
    const r=rollGachaRarity(gachaBand()); c[r]=(c[r]||0)+1; }
  const n=4000;
  return {rows, sampled:{common:+((c[0]/n)*100).toFixed(1), magic:+((c[1]/n)*100).toFixed(1),
                         rare:+(((n-c[0]-c[1])/n)*100).toFixed(1)},
          mul:{rare:GACHA_RARE_MUL, magic:GACHA_MAGIC_MUL, charm:GACHA_CHARM_MUL},
          commonRoseEverywhere: rows.every(r=>r.common>r.commonBefore),
          magicFellEverywhere:  rows.every(r=>r.magic<r.magicBefore),
          rareFellEverywhere:   rows.every(r=>r.rare<r.rareBefore),
          shallowIsMostlyCommon: rows[0].common>65,
          depthStillMatters: rows[4].rare > rows[0].rare*4};
});
R.graveDecay = await pg.evaluate(()=>{
  const H=3600000;
  S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.ore={}; S.grave=null;
  startRun(9); S.run.gold=800;
  gainOre('raw',10);
  S.run.loot=[genItem(9,0),genItem(9,0),genItem(9,0),genItem(9,0),genItem(9,0),genItem(9,0)];
  S.hero.hpNow=0; die();
  const g=S.grave;
  const at=h=>{ g.t = Date.now()-h*H; return +graveDecay(g).toFixed(2); };
  const curve={h0:at(0), h12:at(12), h24:at(24), h36:at(36), h48:at(48), h72:at(72), h99:at(99)};
  // 48時間後に回収すると、半分だけ戻る
  g.t = Date.now()-48*H;
  const before={items:g.items.length, gold:g.gold, ore:{...g.ore}};
  S.hero=newHero(); startRun(g.depth);
  W.grave={x:P.x,y:P.y};
  collectGrave();
  const got={items:S.run.loot.length, gold:S.run.gold, ore:oreRun('raw')};
  // 72時間経つと消える
  S.hero=newHero(); S.grave={depth:5,x:0,y:0,items:[genItem(5,0)],gold:100,ore:{},t:Date.now()-80*H};
  const gone=pruneGrave();
  return {fresh:GRAVE_FRESH_H, gone:GRAVE_GONE_H, curve, before, got,
          fullForFirstDay: curve.h0===1 && curve.h12===1 && curve.h24===1,
          decaysAfter: curve.h36<1 && curve.h48<curve.h36,
          zeroAtEnd: curve.h72===0 && curve.h99===0,
          halfRecovered: got.items < before.items && got.gold < before.gold && got.gold>0,
          prunedWhenGone: gone && S.grave===null};
});
R.graveUI = await pg.evaluate(()=>{
  const H=3600000;
  S.hero=newHero(); S.gold=0; S.run=null;
  S.grave={depth:12,x:0,y:0,items:[genItem(9,0)],gold:200,ore:{raw:4},t:Date.now()-40*H};
  setScreen('char');           // 能力値カードはステータス画面に移った
  const t=document.getElementById('charcard').textContent.replace(/\s+/g,' ');
  return {text:t.slice(t.indexOf('遺体'), t.indexOf('遺体')+60),
          showsRemaining: t.includes('残存'), showsDeadline: t.includes('消滅まで')};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
