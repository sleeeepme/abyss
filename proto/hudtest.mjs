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

/* ================= 6. 探索中に仲間をタップしてステータスを見る ================= */

/* 6-a. パーティ帯の名前をタップすると、その仲間の装備・ステータス画面が開く。
   閉じれば探索へ戻り、HUD も出直す（他のモーダルと同じ作法）。 */
R.partybarOpensAllyStats = await pg.evaluate(()=>{
  TH.busyFloor();
  const a=livingParty()[0];
  document.querySelector(`#partybar [data-ally="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const opened = S.screen==='allyeq';
  const showsRightAlly = el('ae-name').textContent===a.name;
  closeAllyEquip();
  const back=S.screen;
  const hudOn = el('hud').classList.contains('on');
  return {opened, showsRightAlly, back, hudOn,
          ok: opened && showsRightAlly && back==='game' && hudOn};
});

/* 6-b. 閉じたあとに時間が飛ばない。モーダルを見ていた間ぶんの dt を
   まとめて食わせると、戻った瞬間だけ仲間や敵が大きく進んでしまう。 */
R.partybarCloseDoesNotJumpTime = await pg.evaluate(()=>{
  TH.busyFloor();
  const a=livingParty()[0];
  document.querySelector(`#partybar [data-ally="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const before=last;
  // モーダルを開いたまま少し待ってから閉じる想定（実時間が経っている状況を作る）
  last = performance.now() - 5000;
  closeAllyEquip();
  const jumpAvoided = (performance.now()-last) < 200;
  return {jumpAvoided, ok: jumpAvoided};
});

/* 6-c. パーティ帯の上から始めた指は、移動スティックとしては拾わない。
   拾ってしまうと、仲間をタップしたつもりが歩き出す事故になる。 */
R.partybarDoesNotStartStick = await pg.evaluate(()=>{
  TH.busyFloor();
  stickId=null; stickDx=0; stickDy=0;
  const a=livingParty()[0];
  const node=document.querySelector(`#partybar [data-ally="${a.uidA}"]`);
  const rect=node.getBoundingClientRect();
  touchStart({changedTouches:[{target:node, identifier:1,
    clientX:rect.left+rect.width/2, clientY:rect.top+rect.height/2}]});
  return {stickId, ok: stickId===null};
});

/* 6-d. 味方のHPゲージは、重なった相手（主人公を含む）のキャラ絵より必ず上に出る。
   ちょうど同じマスに立たせて描かせ、実際に描かれた色を読む——
   コードの並び順ではなく画面に出た結果で見ないと、あとで並びを変えたときに気付けない。
   漂う塵（drawAir）はエンティティの上に薄く重なる演出で、狙いどおりランダムに
   1ピクセルへ乗ることがあるので、この検証のあいだだけ止めておく。 */
R.allyBarAboveOverlappingHero = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(10); TH.immortal(); TH.clearEnemies();
  S.hero.party=[];
  const a=TH.ally(10,'knight',20); a.x=P.x; a.y=P.y;      // 主人公とぴったり重ねる
  const mx=allyStats(a).maxHp; a.hpNow=mx*0.5;              // 半分だけ塗られたバーにする
  uniqueAllyName(a,party()); S.hero.party.push(a);

  const origAir=window.drawAir;
  window.drawAir=()=>{};
  draw();
  window.drawAir=origAir;

  const col=jobDef(a.job).col;
  const hex=n=>parseInt(col.slice(n,n+2),16);
  const want=[hex(1),hex(3),hex(5)];

  const camX=P.x*TS-innerWidth/2, camY=P.y*TS-innerHeight/2;
  const sx=Math.round(a.x*TS-camX), sy=Math.round(a.y*TS-camY);
  const R=TS*0.30;
  // getImageData はCSS座標ではなく物理ピクセル（devicePixelRatio ぶん拡大された裏バッファ）を読むので、揃える
  const dpr=Math.min(2,devicePixelRatio||1);
  const close=(p,w)=>Math.abs(p[0]-w[0])<=12 && Math.abs(p[1]-w[1])<=12 && Math.abs(p[2]-w[2])<=12;
  // バーの塗られている側（左半分）を、複数点で読む。1点だけだと縁の丸めで外れうる
  const hits=[];
  for(let fx=0.15; fx<=0.85; fx+=0.1){
    const px=Math.round((sx-R+2*R*0.5*fx)*dpr), py=Math.round((sy-R-9+1.75)*dpr);
    const pix=ctx.getImageData(px,py,1,1).data;
    hits.push(close([pix[0],pix[1],pix[2]], want));
  }
  const hitCount=hits.filter(Boolean).length;
  return {want, hitCount, sampled:hits.length, ok: hitCount>=Math.ceil(hits.length*0.6)};
});

/* ================= 7. ラスボス戦：HPバーとデバフ帯の重なり ================= */

/* 7-a. ボスのHPバーと切り替わる枷の帯は、同時に出ていても重ならない。
   どちらも中央寄せ・同じ横幅で、以前は座標を決め打ちしていたために
   完全に同じ場所へ重なっていた。 */
R.bossBarClearOfBaneBar = await pg.evaluate(()=>{
  TH.run(51,{seed:9}); TH.immortal();
  const boss=W.enemies.find(e=>e.boss);
  boss.revealed=true;
  TH.step(0.2);
  const bossShown = el('bossbar').style.display!=='none';
  const baneShown = el('trialbar').style.display!=='none';
  const rb=el('bossbar').getBoundingClientRect();
  const rt=el('trialbar').getBoundingClientRect();
  const noOverlap = !(rb.bottom > rt.top && rt.bottom > rb.top);
  const baneBelow = rt.top >= rb.bottom;
  return {bossShown, baneShown, noOverlap, baneBelow,
          ok: bossShown && baneShown && noOverlap && baneBelow};
});

// 7-b. 白の層に居るだけ（ラスボス以外）では、効果は掛かっていてもゲージは出さない
R.zoneBaneHasNoGauge = await pg.evaluate(()=>{
  TH.run(55,{seed:9}); TH.immortal();   // 55階も白の層。ボスはいるが「アビスの口」ではない
  const boss=W.enemies.find(e=>e.boss);
  if(boss) boss.revealed=true;
  TH.step(0.2);
  const zoneBaneActive = !!zoneBaneNow();
  const noGauge = el('trialbar').style.display==='none';
  const effectStillApplies = !!trialBane();
  return {zoneBaneActive, noGauge, effectStillApplies,
          ok: zoneBaneActive && noGauge && effectStillApplies};
});

await done(b, errs, R);
