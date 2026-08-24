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

// 3-b. 開放すると5階刻みで並ぶ。全階並べると横に50個出て選べない
R.allDepthsOpens = await pg.evaluate(()=>{
  S.debug.allDepths=true;
  const u=unlockedDepths();
  const gaps=u.slice(2).map((d,i)=>d-u[i+1]);
  return {count:u.length, first:u.slice(0,4), last:u[u.length-1],
          everyFive: gaps.every(g=>g===5),
          reachesFinal: u.includes(FINAL_DEPTH),
          ok: u.length>5 && gaps.every(g=>g===5) && u.includes(FINAL_DEPTH)};
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

await done(b, errs, R);
