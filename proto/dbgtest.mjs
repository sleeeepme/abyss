// デバッグモード。無敵と階層全開放。
//
// このスイートの本題は「動くか」ではなく、**普通に遊んでいる人に届かないか**。
// 検証用の抜け道は、残っていること自体より
// 「気づかないうちに有効になっている」ほうが害が大きい。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 入口 ================= */

/* 1-a. 既定では入口が無い。押せるボタンとして置くと必ず押されるので、
       普段は表示そのものを消してある。 */
R.hiddenByDefault = await pg.evaluate(()=>{
  const n=el('dbgbtn');
  const shown=n.classList.contains('on');
  const vis=getComputedStyle(n).display;
  return {hidden: !shown, display:vis, debugState:S.debug||null,
          ok: !shown && vis==='none' && !dbg('on')};
});

// 1-b. タイトルの版番号を5回叩くと出る。4回では出ない
R.needsFiveTaps = await pg.evaluate(()=>{
  S.debug=null;
  setScreen('title');
  const ver=document.querySelector('#scr-title .ver');
  const tap=()=>ver.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  for(let i=0;i<4;i++) tap();
  const afterFour = dbg('on');
  tap();
  const afterFive = dbg('on');
  return {stillOffAtFour: !afterFour, onAtFive: afterFive,
          ok: !afterFour && afterFive};
});

// 1-c. 有効にすると 🐞 が出て、モーダルが開ける
R.buttonOpensPanel = await pg.evaluate(()=>{
  const shown=el('dbgbtn').classList.contains('on');
  openDebug();
  const open=el('m-debug').classList.contains('on');
  el('m-debug').classList.remove('on');
  return {shown, open, ok: shown && open};
});

/* 1-d. 保存しない。S.debug は毎回まっさらから始まる——
       検証用の状態が残ったまま普通に遊んでしまう事故のほうが高くつく。 */
R.notPersisted = await pg.evaluate(()=>{
  const keys=Object.keys(S);
  // localStorage を使っていないので、そもそも保存経路が無い
  const usesStorage = typeof localStorage!=='undefined'
    && Object.keys(localStorage||{}).length>0;
  return {hasDebugKey: keys.includes('debug'), noStorage: !usesStorage,
          ok: !usesStorage};
});

/* ================= 2. 無敵 ================= */

/* 2-a. 被弾・地形・継続ダメージの3経路すべてで止まる。
       入口を数え上げて塞ぐやり方は「1つ増やしたときに忘れる」ので、
       ここでも3経路をまとめて通す。 */
R.godBlocksEverything = await pg.evaluate(()=>{
  S.debug={on:true, god:true};
  TH.run(1,{seed:7}); TH.floor(20);
  const mx=stats(S.hero).maxHp;
  S.hero.hpNow=mx;

  // (1) 敵の直接攻撃
  const e=W.enemies[0]; e.atkV=99999; e.dead=false;
  hitPlayer(e);
  const afterHit=S.hero.hpNow;

  // (2) 地形ハザード
  const f=W.fl;
  W.haz={kind:'lava', g:[]};
  for(let y=0;y<f.H;y++) W.haz.g[y]=new Array(f.W).fill(1);
  W.hazT=0; tickHazards(1.0);
  const afterHaz=S.hero.hpNow;

  // (3) 継続ダメージ
  S.run.pst={};
  addStatus({isPlayer:true, st:S.run.pst, maxHp:mx}, 'burn', 40);
  stepSim(4);
  const afterDot=S.hero.hpNow;

  return {maxHp:Math.round(mx), afterHit:Math.round(afterHit),
          afterHaz:Math.round(afterHaz), afterDot:Math.round(afterDot),
          ok: afterHit===mx && afterHaz===mx && afterDot>=mx*0.999};
});

// 2-b. 出口も塞いである。die() を直に呼んでも死なない
R.godSurvivesDie = await pg.evaluate(()=>{
  S.hero.hpNow=1;
  die();
  return {alive: !!S.hero && !!S.run, hp:Math.round(S.hero?S.hero.hpNow:0),
          ok: !!S.hero && !!S.run};
});

/* 2-c. 切ればちゃんと死ぬ。**戻せない抜け道は抜け道ではなく仕様**なので、
       OFF に戻ることまで見る。 */
R.godOffRestoresDeath = await pg.evaluate(()=>{
  S.debug.god=false;
  TH.run(1,{seed:7}); TH.floor(20);
  S.hero.hpNow=1;
  const e=W.enemies[0]; e.atkV=99999; e.dead=false;
  hitPlayer(e);
  return {heroGone: !S.hero, ok: !S.hero};
});

/* ================= 3. 階層全開放 ================= */

// 3-a. 既定では中継地点ぶんだけ
R.depthsGatedByDefault = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null; S.beacons=[]; S.debug={on:true, allDepths:false};
  const u=unlockedDepths();
  return {list:u, ok: u.length===1 && u[0]===1};
});

/* 3-b. 開放すると5階刻みで並ぶ。全階並べると横に50個出て選べない。
   ラストボス（51階）だけは5刻みに乗らない特別な1階なので、
   その前後の2ヶ所だけ5以外の間隔になる（50→51→55）。それ以外は全部5刻み。 */
R.allDepthsOpens = await pg.evaluate(()=>{
  S.debug.allDepths=true;
  const u=unlockedDepths();
  const gaps=u.slice(2).map((d,i)=>d-u[i+1]);
  const nonFive=gaps.filter(g=>g!==5);
  return {count:u.length, first:u.slice(0,4), last:u[u.length-1],
          mostlyFive: nonFive.length<=2,
          reachesFinal: u.includes(FINAL_DEPTH),
          ok: u.length>5 && nonFive.length<=2 && u.includes(FINAL_DEPTH)};
});

// 3-c. 開放した階から実際に潜れる
R.canDiveDeep = await pg.evaluate(()=>{
  S.startDepth=45;
  startRun(S.startDepth);
  return {depth:S.run?S.run.depth:0, ok: !!S.run && S.run.depth===45};
});

/* 3-d. 切ったとき、選んでいた階層が届かない場所に取り残されない。
       ここを忘れると「開放を戻したのに第45階層のまま潜れる」が残る。 */
R.closingResets = await pg.evaluate(()=>{
  S.run=null; S.startDepth=45;
  el('dbg-depth').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const u=unlockedDepths();
  return {closed: !dbg('allDepths'), startDepth:S.startDepth, unlocked:u,
          ok: !dbg('allDepths') && u.includes(S.startDepth)};
});

/* ================= 4. 出荷物に混ざらない ================= */

/* 4-a. デバッグの語が、普通に遊んでいる画面に出てこない。
       モーダルは DOM にあるが、開かないかぎり読めない。 */
R.notVisibleInPlay = await pg.evaluate(()=>{
  S.debug=null;
  setScreen('town');
  const shown=[...document.querySelectorAll('.modal.on')].map(n=>n.id);
  const btn=el('dbgbtn').classList.contains('on');
  return {openModals:shown, btnHidden: !btn,
          ok: !shown.includes('m-debug') && !btn};
});

/* ================= 5. 新規デバッグ機能（仲間追加・恩寵・大技） ================= */

// 5-a. 恩寵をランダムに1つ得るボタン。押すたび主人公の恩寵が1つ増える
R.dbgBoonGrants = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); S.hero.party=[];
  const before = S.hero.boons.length;
  el('dbg-boon').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const after = S.hero.boons.length;
  const added = S.hero.boons[after-1];
  const validId = !!added && !!boonDef(added.id);
  return {before, after, added, ok: after===before+1 && validId};
});

/* 5-b. 大技解放ボタン。押すたび大ボスを1体倒した扱いになり、
       ULTS.length 回で全部揃う。それ以上押しても増えない（打ち止め）。 */
R.dbgUltUnlocksAll = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); S.hero.party=[];
  S.greatKills=0; S.ult=null; S.ultLv={};
  for(let i=0;i<ULTS.length;i++){
    el('dbg-ult').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  }
  const allUnlocked = unlockedUlts().length===ULTS.length;
  const ultSet = !!S.ult;
  const greatKillsAtFive = S.greatKills===ULTS.length;
  el('dbg-ult').dispatchEvent(new MouseEvent('click',{bubbles:true}));  // 打ち止めの確認
  const staysAtFive = S.greatKills===ULTS.length;
  return {greatKills:S.greatKills, allUnlocked, ultSet, staysAtFive,
          ok: allUnlocked && ultSet && greatKillsAtFive && staysAtFive};
});

/* 5-c. 仲間を指定して追加。押すと即座にその職の仲間が1人加わり、
       隊の枠も上限まで開く（3人の壁ですぐ使えなくなるのを防ぐ）。 */
R.dbgAddAllyByJob = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); S.hero.party=[]; S.upg=S.upg||{}; S.upg.party=0;
  const before = party().length;
  el('dbg-addally').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const modalOpen = el('m-dbgally').classList.contains('on');
  const listCount = document.querySelectorAll('#dbgally-list [data-addjob]').length;
  document.querySelector('[data-addjob="mage"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const after = party().length;
  const added = party()[after-1];
  const partyCapMaxed = S.upg.party===PARTY_UP_MAX;
  return {before, after, addedJob: added && added.job, modalOpen, listCount,
          partyCapMaxed, allJobsListed: listCount===ALL_JOBS.length,
          ok: after===before+1 && added && added.job==='mage' && modalOpen
              && partyCapMaxed && listCount===ALL_JOBS.length};
});

/* 5-d. 通常の加入制限（同じ職は3人まで）を無視して追加できる。
       検証用の道具なので、通常プレイでは組めない編成もその場で試せることを優先する。 */
R.dbgAddAllyBypassesLimits = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); S.hero.party=[];
  for(let i=0;i<4;i++){
    document.querySelector('[data-addjob="mage"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  }
  const mageCount = party().filter(a=>a.job==='mage').length;
  const overNormalJobLimit = mageCount > JOB_LIMIT_BASE;
  return {mageCount, jobLimitBase:JOB_LIMIT_BASE, overNormalJobLimit,
          ok: mageCount===4 && overNormalJobLimit};
});

// 5-e. 閉じるボタンでモーダルが閉じる
R.dbgAddAllyCloses = await pg.evaluate(()=>{
  el('dbg-addally').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const openedFirst = el('m-dbgally').classList.contains('on');
  el('dbgally-close').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const closedAfter = !el('m-dbgally').classList.contains('on');
  return {openedFirst, closedAfter, ok: openedFirst && closedAfter};
});

await done(b, errs, R);
