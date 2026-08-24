// 探索中の表示の整理。
//   ・ミニマップを右下へ
//   ・「攻撃は自動」と探索中の「？」を畳む
//   ・ステータスを持ち物から切り離して別画面に
//   ・ログが仲間の表示と重ならない
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* 仲間2人＋敵1体＋ログ3行の「一番混む状態」を作る。
   表示の検証は、空いている画面で見ても意味がない。 */
await pg.evaluate(()=>{
  window.TH.busyFloor = ()=>{
    TH.run(1,{seed:21}); TH.floor(14); TH.immortal();
    S.hero.lv=22;
    S.hero.party=[];
    ['knight','mage'].forEach((job,i)=>{
      const a=TH.ally(14,job,30); a.slot=i;
      a.x=P.x+Math.cos(i*2)*1.2; a.y=P.y+Math.sin(i*2)*1.2;
      uniqueAllyName(a,party()); S.hero.party.push(a);
    });
    const e=W.enemies[0]; W.enemies=[e];
    e.x=P.x+1.6; e.y=P.y; e.maxHp=e.hp=1e6; P.target=e;
    stepSim(0.6);
    logs.length=0;
    log('◈ テスト行 1'); log('◈ テスト行 2'); log('◈ テスト行 3');
    draw(); updateHUD();
  };
});

/* ================= 1. ミニマップ ================= */

/* 1-a. 右下に出る。上の帯には敵の情報・侵入者の警告・パーティ・ログが
       集まっていて、**一番よく見る地図が一番混んでいる場所**にあった。 */
R.miniBottomRight = await pg.evaluate(()=>{
  TH.busyFloor();
  const f=W.fl, s=Math.min(110/f.W, 110/f.H);
  const mw=f.W*s, mh=f.H*s;
  const ox=innerWidth-mw-14, oy=Math.max(60, innerHeight-mh-MM_BOTTOM);
  return {ox:Math.round(ox), oy:Math.round(oy), h:innerHeight,
          right: ox > innerWidth*0.5,
          bottomHalf: oy > innerHeight*0.5,
          aboveUltButton: oy+mh <= innerHeight-96,
          ok: ox>innerWidth*0.5 && oy>innerHeight*0.5 && oy+mh<=innerHeight-96};
});

// 1-b. パーティ表示や敵の情報パネルと重ならない（上の帯から離れた）
R.miniClear = await pg.evaluate(()=>{
  const f=W.fl, s=Math.min(110/f.W, 110/f.H);
  const mh=f.H*s, oy=Math.max(60, innerHeight-mh-MM_BOTTOM);
  const base=el('hud').getBoundingClientRect().top;
  const clash=['partybar','targetinfo','log'].filter(id=>{
    const n=el(id); if(!n || n.style.display==='none') return false;
    const r=n.getBoundingClientRect();
    return r.height>0 && r.bottom-base > oy;
  });
  return {clash, minimapTop:Math.round(oy), ok: clash.length===0};
});

/* ================= 2. 畳んだ物 ================= */

// 2-a. 「攻撃は自動」の常設タグは無い
R.noAutoTag = await pg.evaluate(()=>{
  const n=document.getElementById('autotag');
  const css=[...document.styleSheets[0].cssRules].some(r=>r.selectorText==='#autotag');
  return {gone: !n, cssGone: !css, ok: !n && !css};
});

// 2-b. 探索中の「？」も無い（遊び方はタイトルに集約した）
R.noHelpBtn = await pg.evaluate(()=>{
  const n=document.getElementById('helpbtn');
  const onTitle=!!el('scr-title').querySelector('#t-help');
  return {gone: !n, stillReachable:onTitle, ok: !n && onTitle};
});

/* ================= 3. ステータスを別画面に ================= */

// 3-a. HUD にボタンがあり、押せる（#hud は pointer-events:none なので明示が要る）
R.statButton = await pg.evaluate(()=>{
  setScreen('game'); el('hud').classList.add('on');
  const n=el('statbtn');
  const box=n.getBoundingClientRect();
  return {exists: !!n, pe:getComputedStyle(n).pointerEvents,
          size:Math.round(box.width)+'x'+Math.round(box.height),
          bigEnough: box.width>=40 && box.height>=40,
          ok: !!n && getComputedStyle(n).pointerEvents==='auto' && box.width>=40};
});

// 3-b. 押すと止まり、能力値・潜在・仲間が出る
R.statOpens = await pg.evaluate(()=>{
  TH.busyFloor();
  const t0=_tickCount;
  openStat();
  stepSim(1);                       // 開いているあいだは update が回らない
  return {screen:S.screen, on:el('m-stat').classList.contains('on'),
          hasStats: el('bag-stats').innerHTML.length>80,
          hasParty: el('bag-party').innerHTML.includes('重騎士'),
          paused: S.screen!=='game',
          ok: S.screen==='stat' && el('m-stat').classList.contains('on')
              && el('bag-stats').innerHTML.length>80};
});

/* 3-c. 持ち物からは能力値が抜けている。
       装備を替えたいときに、毎回能力値の壁をスクロールさせない。 */
R.bagIsItemsOnly = await pg.evaluate(()=>{
  closeStat();
  const bag=el('m-bag');
  const has = sel => !!bag.querySelector(sel);
  return {statsMoved: !has('#bag-stats'), boonsMoved: !has('#bag-boons'),
          partyMoved: !has('#bag-party'),
          equip:has('#bag-equip'), loot:has('#bag-loot'),
          ok: !has('#bag-stats') && !has('#bag-boons') && !has('#bag-party')
              && has('#bag-equip') && has('#bag-loot')};
});

// 3-d. 閉じると探索へ戻る
R.statCloses = await pg.evaluate(()=>{
  openStat();
  closeStat();
  return {screen:S.screen, off: !el('m-stat').classList.contains('on'),
          ok: S.screen==='game' && !el('m-stat').classList.contains('on')};
});

/* 3-e. ステータス画面から仲間を叩いたら、戻り先はステータス画面。
       持ち物と共通の描画を使っているので、ここを取り違えると
       「別の画面に飛ばされた」になる。 */
R.allyReturnsToStat = await pg.evaluate(()=>{
  TH.busyFloor();
  openStat();
  const a=livingParty()[0];
  document.querySelector(`#bag-party [data-ally="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const opened=S.screen==='allyeq';
  closeAllyEquip();
  const back=S.screen;
  closeStat();
  return {opened, back, ok: opened && back==='stat'};
});

/* ================= 4. ログの位置 ================= */

// 4-a. 仲間2人と敵の情報パネルが出ていても、ログはどれとも重ならない
R.logClear = await pg.evaluate(()=>{
  TH.busyFloor();
  const rect = id => { const n=el(id);
    return (n && n.style.display!=='none') ? n.getBoundingClientRect() : null; };
  const hit = (a,c) => !!a && !!c && a.width>0 && c.width>0 &&
    a.left<c.right && c.left<a.right && a.top<c.bottom && c.top<a.bottom;
  const lg=rect('log');
  const clash=['partybar','targetinfo','intruder'].filter(id=>hit(lg,rect(id)));
  return {top:Math.round(lg.top), lines:logs.length, clash,
          belowParty: lg.top > rect('partybar').bottom,
          ok: clash.length===0 && logs.length===3};
});

/* 4-b. 仲間が増えるほど下がる（人数ぶん伸びる表示に追従する）。
       測り直しは1フレームに1回なので、**フレームを進めてから**測る。
       updateHUD() を直に呼ぶだけだと同じフレーム扱いになり、前回の位置を読む。
       比べるのは仲間の数だけの差にしたいので、敵の情報パネルは出さないでおく。 */
R.logFollowsParty = await pg.evaluate(()=>{
  TH.busyFloor();
  /* 敵ごと片付けて、敵の情報パネルが出ない状態にそろえる。
     自動で狙い直すので、P.target を消すだけでは次のフレームで戻ってくる。 */
  TH.clearEnemies(); P.target=null;
  S.hero.party=[];
  stepSim(0.1);
  const alone=el('log').getBoundingClientRect().top;
  ['knight','mage'].forEach((job,i)=>{
    const a=TH.ally(14,job,30); a.slot=i;
    a.x=P.x+Math.cos(i*2)*1.2; a.y=P.y+Math.sin(i*2)*1.2;
    uniqueAllyName(a,party()); S.hero.party.push(a);
  });
  TH.clearEnemies(); P.target=null;
  stepSim(0.1);
  const withTwo=el('log').getBoundingClientRect().top;
  const pb=el('partybar').getBoundingClientRect();
  return {alone:Math.round(alone), withTwo:Math.round(withTwo),
          partyBottom:Math.round(pb.bottom),
          moved: withTwo>alone, belowParty: withTwo>=pb.bottom,
          ok: withTwo>alone && withTwo>=pb.bottom};
});

/* ================= 5. 左肩の縦積み =================
   状態異常の帯（#statusbar。疾風の加護や弔いもここに出る）と
   遺体の場所（#gravehint）は、CSS では**同じ座標**に置いてある。
   どちらも「その時だけ出る」ので普段は成立するが、
   両方出た瞬間に重なって両方とも読めなくなっていた。 */

// 5-a. 疾風の加護と遺体の行が同時に出ても重ならない
R.leftColumnClear = await pg.evaluate(()=>{
  TH.busyFloor();
  TH.clearEnemies(); P.target=null;
  // 疾風の加護（未踏より浅いところ）と、遺体の行を同時に出す
  S.deepest=40; S.run.startDeepest=40;
  S.grave={depth:99, x:P.x, y:P.y, items:[], gold:10, ore:{}, xp:0,
           heroName:'テスト', lv:9, t:nowMs()};
  W.grave=null;
  stepSim(0.1);
  const sb=el('statusbar').getBoundingClientRect();
  const gh=el('gravehint').getBoundingClientRect();
  const overlap = sb.width>0 && gh.width>0 &&
                  sb.left<gh.right && gh.left<sb.right &&
                  sb.top<gh.bottom && gh.top<sb.bottom;
  return {grace: windGrace(), statusShown: sb.height>0, graveShown: gh.height>0,
          sbBottom:Math.round(sb.bottom), ghTop:Math.round(gh.top),
          clear: !overlap, below: gh.top >= sb.bottom,
          ok: windGrace() && sb.height>0 && gh.height>0 && !overlap && gh.top>=sb.bottom};
});

/* 5-b. 上が空なら、下は元の位置まで戻る。
       一度押し下げたまま固定すると、状態異常が切れたあとに
       意味のない余白だけが残る。 */
R.leftColumnRestores = await pg.evaluate(()=>{
  const pushed=el('gravehint').getBoundingClientRect().top;
  S.deepest=1; S.run.startDeepest=1; S.hero.avengeT=0; S.run.pst={};
  stepSim(0.1);
  const sb=el('statusbar').getBoundingClientRect();
  const back=el('gravehint').getBoundingClientRect().top;
  return {pushed:Math.round(pushed), back:Math.round(back), sbH:Math.round(sb.height),
          statusEmpty: sb.height===0, restored: back < pushed,
          ok: sb.height===0 && back < pushed};
});

// 5-c. ログはこの2つより下（左肩が2段になっても潜り込まない）
R.logBelowLeftColumn = await pg.evaluate(()=>{
  TH.busyFloor();
  TH.clearEnemies(); P.target=null;
  S.deepest=40; S.run.startDeepest=40;
  S.grave={depth:99, x:P.x, y:P.y, items:[], gold:10, ore:{}, xp:0,
           heroName:'テスト', lv:9, t:nowMs()};
  W.grave=null;
  stepSim(0.1);
  const lg=el('log').getBoundingClientRect();
  const gh=el('gravehint').getBoundingClientRect();
  return {logTop:Math.round(lg.top), ghBottom:Math.round(gh.bottom),
          ok: lg.top >= gh.bottom};
});

await done(b, errs, R);
