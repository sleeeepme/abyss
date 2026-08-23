// まとめて入れた調整のぶん。
//   ・広告蘇生を「5階ごと・パーティ共通で4回」へ
//   ・「疾き」装備に回避率
//   ・盾をどこでも構えられる／近接を弾いたらよろめき
//   ・遺体の回収で経験値の一部も戻る
//   ・再探索の「疾風の加護」
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 広告蘇生（5階ごと・共通4回） ================= */

// 1-a. 潜り始めは満タン。誰に使ってもよい共通の持ち分
R.reviveStart = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  return {left:revivesLeft(), per:REVIVE_PER_BAND, band:S.run.revBand,
          ok: revivesLeft()===REVIVE_PER_BAND && REVIVE_PER_BAND===4};
});

// 1-b. 同じ帯のあいだは減ったまま。階を進んでも帯が同じなら戻らない
R.sameBandKeeps = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  S.run.revLeft=1;
  TH.floor(3);                        // 1〜5 は同じ帯
  const mid=revivesLeft();
  TH.floor(5);
  return {atFloor3:mid, atFloor5:revivesLeft(), band:S.run.revBand,
          ok: mid===1 && revivesLeft()===1};
});

// 1-c. 帯をまたぐと満タンに戻る
R.newBandRefills = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  S.run.revLeft=0;
  const before=revivesLeft();
  TH.floor(6);                        // ここから次の帯
  return {before, after:revivesLeft(), band:S.run.revBand,
          ok: before===0 && revivesLeft()===REVIVE_PER_BAND};
});

/* 1-d. 人ごとの権利ではない。同じ1人を続けて2回蘇生できる。
       ここが今回の変更の本体で、ボス戦でまとめて落ちても手が残る。 */
R.notPerAlly = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  const a=TH.ally(3,'warrior',5);
  a.revived=true; a.revivedAt=1;      // 既に1度蘇生している状態
  return {left:revivesLeft(), can:canRevive(a),
          ok: canRevive(a)===true};
});

// 1-e. 使い切ったら、その帯では蘇生できない
R.runsOut = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  const a=TH.ally(3,'warrior',5);
  S.run.revLeft=0;
  return {left:revivesLeft(), blocked: !canRevive(a), top:reviveBandTop(),
          ok: canRevive(a)===false && reviveBandTop()===5};
});

/* ================= 2. 「疾き」の回避率 ================= */

// 2-a. 移動速度と回避率の両方が付く
R.swiftEvade = await pg.evaluate(()=>{
  S.hero=newHero();
  const def=PREFIX.find(p=>p.id==='swift');
  let it=null;
  for(let i=0;i<600 && !it;i++){
    const g=genItem(20,300); g.ident=true;
    if(g.aff.some(a=>a.id==='swift')) it=g;
  }
  if(!it) return {skipped:true, ok:false};
  const af=it.aff.find(a=>a.id==='swift');
  const lines=affLines(it).join(' | ');
  return {stat:af.stat, stat2:af.stat2, v:af.v, v2:af.v2,
          hasBoth: af.stat==='msPct' && af.stat2==='evade' && af.v2>0,
          shownInLines: lines.includes('回避率'),
          defined: def.stat2==='evade',
          ok: af.stat2==='evade' && af.v2>0 && lines.includes('回避率')};
});

// 2-b. 実際にプレイヤーの回避率へ乗る（上限は 40%）
R.evadeApplies = await pg.evaluate(()=>{
  S.hero=newHero();
  const base=stats(S.hero).evade;
  const it=genBaseItem('sword',20,1);
  it.ident=true; it.aff=[{t:'p',id:'swift',nm:'疾き',stat:'msPct',v:8,stat2:'evade',v2:9}];
  S.hero.equip.weapon=it;
  const withGear=stats(S.hero).evade;
  it.aff[0].v2=999;
  const capped=stats(S.hero).evade;
  return {base, withGear, capped,
          ok: base===0 && withGear===9 && capped===40};
});

// 2-c. 回避が出るとダメージが0で終わる
R.evadeBlocks = await pg.evaluate(()=>{
  TH.run(1,{seed:8}); TH.floor(3);
  const it=genBaseItem('sword',20,1);
  it.ident=true; it.aff=[{t:'p',id:'swift',nm:'疾き',stat:'msPct',v:8,stat2:'evade',v2:999}];
  S.hero.equip.weapon=it;                 // 回避 40%
  const e=W.enemies[0]; e.atkV=5;
  let dodged=0, hits=0;
  const hp0=S.hero.hpNow=stats(S.hero).maxHp;
  for(let i=0;i<200;i++){
    const before=S.hero.hpNow;
    hitPlayer(e);
    if(S.hero.hpNow===before) dodged++; else hits++;
    S.hero.hpNow=hp0;
  }
  return {dodged, hits, rate:+(dodged/200).toFixed(2),
          inRange: dodged>20 && dodged<120,
          ok: dodged>20 && hits>20};
});

/* ================= 3. 盾 ================= */

// 3-a. 指の役割は画面の左右ではなく順番で決まる（右側でも動かせる）
R.stickAnywhere = await pg.evaluate(()=>{
  TH.run(1,{seed:8}); TH.floor(3);
  setScreen('game');
  stickId=null; guardId=null; P.guard=false;
  const right={identifier:1, clientX:innerWidth*0.9, clientY:innerHeight*0.7, target:document.body};
  touchStart({changedTouches:[right]});
  const gotStick = stickId===1;
  const guardedByFirst = P.guard;
  // 2本目でガード（どこに触れても）
  const left={identifier:2, clientX:innerWidth*0.1, clientY:innerHeight*0.7, target:document.body};
  touchStart({changedTouches:[left]});
  const gotGuard = P.guard && guardId===2;
  touchEnd({changedTouches:[right,left], touches:[]});
  return {gotStick, firstIsNotGuard: !guardedByFirst, gotGuard,
          ok: gotStick && !guardedByFirst && gotGuard};
});

// 3-b. スティックの指だけ離したら、残った指が引き継ぐ（動けなくならない）
R.stickHandover = await pg.evaluate(()=>{
  stickId=null; guardId=null; P.guard=false;
  const a={identifier:1, clientX:100, clientY:400, target:document.body};
  const c={identifier:2, clientX:300, clientY:400, target:document.body};
  touchStart({changedTouches:[a]});
  touchStart({changedTouches:[c]});
  touchEnd({changedTouches:[a], touches:[c]});
  const r={stick:stickId, guardCleared: guardId===null, notGuarding: !P.guard};
  touchEnd({changedTouches:[c], touches:[]});
  return {...r, ok: r.stick===2 && r.guardCleared && r.notGuarding};
});

// 3-c. 近接をパリイすると、相手がよろめき状態になる
R.parryStaggers = await pg.evaluate(()=>{
  S.hero=newHero();                        // 前の検証で積んだ回避を持ち込まない
  TH.run(1,{seed:8}); TH.floor(3);
  const sh=genBaseItem('round',10,1); sh.ident=true; sh.aff=[];
  S.hero.equip.shield=sh;
  const e=W.enemies[0]; e.st={}; e.atkV=5;
  P.guard=true; P.guardStart=nowSec();     // 構えた瞬間＝パリイ受付中
  const consumed = hitPlayer(e);
  const staggered = hasStatus(e,'stagger');
  // 弾（飛び道具）ではよろめかない
  const e2=W.enemies[1]||W.enemies[0]; e2.st={};
  P.guardStart=nowSec();
  hitPlayer(e2, 5, 'blunt', 3);
  const boltNoStagger = !hasStatus(e2,'stagger');
  P.guard=false;
  /* パリイは回避より先に判定される。逆だと、狙って合わせた一撃が
     「たまたま避けた」に食われて、よろめきも光も出ない。 */
  const it=genBaseItem('sword',20,1);
  it.ident=true; it.aff=[{t:'p',id:'swift',nm:'疾き',stat:'msPct',v:8,stat2:'evade',v2:999}];
  S.hero.equip.weapon=it;
  const e3=W.enemies[2]||W.enemies[0];
  let parried=0;
  for(let i=0;i<40;i++){
    e3.st={}; P.guard=true; P.guardStart=nowSec();
    hitPlayer(e3);
    if(hasStatus(e3,'stagger')) parried++;
  }
  P.guard=false;
  return {consumed, staggered, boltNoStagger, parriedOver40:parried,
          parryBeatsEvade: parried===40,
          ok: consumed===true && staggered===true && boltNoStagger && parried===40};
});

/* ================= 4. 遺体の経験値 ================= */

// 4-a. 死ぬと累計経験値の3割が遺体に残る
R.graveKeepsXp = await pg.evaluate(()=>{
  TH.run(1,{seed:8}); TH.floor(5);
  S.hero.lv=12; S.hero.xp=40;
  S.grave=null;
  const total=totalXpOf(S.hero);
  die();
  return {total, kept:S.grave?S.grave.xp:0, rate:GRAVE_XP_RATE,
          ok: !!S.grave && S.grave.xp===Math.floor(total*GRAVE_XP_RATE) && S.grave.xp>0};
});

// 4-b. 回収するとレベルが戻ってくる（風化ぶんは減る）
R.graveGivesXp = await pg.evaluate(()=>{
  const g=S.grave;
  TH.run(1,{seed:8}); TH.floor(g.depth);
  S.grave=g; W.grave={x:P.x, y:P.y};
  S.hero.lv=1; S.hero.xp=0;
  collectGrave();
  return {lv:S.hero.lv, xp:Math.round(S.hero.xp), gaveBack:S.hero.lv>1,
          cleared:S.grave===null,
          ok: S.hero.lv>1 && S.grave===null};
});

/* ================= 5. 疾風の加護 ================= */

/* 5-a. 潜り始めの最深より浅いあいだは効いている。
       **最深そのものの階には掛からない**——S.deepest は「到達した階」であって
       「抜けた階」ではない。そこで倒れた以上、まだ知らない道のまま。 */
R.graceActive = await pg.evaluate(()=>{
  S.deepest=20;
  TH.run(1,{seed:3});
  const at1=windGrace();
  TH.floor(19); const at19=windGrace();
  TH.floor(20); const offAt20=!windGrace();
  return {startDeepest:S.run.startDeepest, at1, at19, offAt20,
          ok: at1 && at19 && offAt20};
});

/* 5-a2. 初回の第1階層には掛からない。
        `<=` にしていたせいで、一度も歩いたことのない道が
        最初から「知っている道」になっていた（利用者からの報告）。 */
R.graceNotOnFirstRun = await pg.evaluate(()=>{
  S.deepest=1; S.deaths=0;
  TH.run(1,{seed:3});
  const off=!windGrace();
  TH.floor(1);
  const stillOff=!windGrace();
  return {startDeepest:S.run.startDeepest, off, stillOff, ok: off && stillOff};
});

// 5-b. 未踏の階に踏み込んだ瞬間に切れる
R.graceEnds = await pg.evaluate(()=>{
  S.deepest=20; TH.run(1,{seed:3});
  TH.floor(21);
  const offAt21=!windGrace();
  return {offAt21, deepestNow:S.deepest, startDeepest:S.run.startDeepest,
          stillOffAt22: (TH.floor(22), !windGrace()),
          ok: offAt21};
});

/* 5-c. 記録を更新しても境目は動かない。
       S.deepest を直接見ていると、更新のたびに境目が付いてきて永久に切れない。 */
R.graceBoundaryFixed = await pg.evaluate(()=>{
  S.deepest=10;
  TH.run(1,{seed:3});
  const border=S.run.startDeepest;
  TH.floor(11);                    // ここで S.deepest が 11 に伸びる
  const after=S.run.startDeepest;
  return {border, deepestNow:S.deepest, startDeepest:after, graceOff: !windGrace(),
          unmoved: border===after,
          ok: border===after && windGrace()===false};
});

// 5-d. 効いているあいだは移動速度が上がり、切れると戻る
R.graceSpeed = await pg.evaluate(()=>{
  S.deepest=20;
  TH.run(1,{seed:3}); TH.floor(5); TH.immortal(); TH.clearEnemies();
  const measure = ()=>{
    const x0=P.x, y0=P.y;
    TH.move(0.7, 1, 0);
    const d=Math.hypot(P.x-x0, P.y-y0);
    return d;
  };
  const fast=measure();
  TH.floor(25); TH.immortal(); TH.clearEnemies();
  const slow=measure();
  return {fast:+fast.toFixed(2), slow:+slow.toFixed(2), mul:KNOWN_SPEED,
          faster: fast > slow*1.15,
          ok: fast > slow*1.15};
});

/* ================= 6. 生まれ直しの下駄 =================
   死ぬたびに Lv.1 からやり直すのは、深く潜るほど再走が長くなるということ。
   第40階層で死んだ人が、また第1階層を Lv.1 で歩くのは罰でしかない。 */

// 6-a. 大ボスを倒した数だけ、次のキャラの初期レベルが上がる
R.rebirthScales = await pg.evaluate(()=>{
  const at=n=>{ S.greatKills=n; const h=newHero();
                return {lv:h.lv, str:h.str, vit:h.vit}; };
  const a0=at(0), a1=at(1), a4=at(4);
  S.greatKills=0;
  return {a0, a1, a4, per:REBIRTH_PER_GREAT,
          startsAtOne: a0.lv===1 && a0.str===5,
          grows: a1.lv===1+REBIRTH_PER_GREAT && a4.lv===1+4*REBIRTH_PER_GREAT,
          ok: a0.lv===1 && a1.lv===1+REBIRTH_PER_GREAT && a4.lv===1+4*REBIRTH_PER_GREAT};
});

/* 6-b. 能力値もレベルアップと同じ式で乗る。
       別勘定にすると「Lv.9 なのに Lv.1 の体」という嘘の状態ができる。 */
R.rebirthStatsMatch = await pg.evaluate(()=>{
  S.greatKills=3;
  const born=newHero();
  // 同じレベルまで普通に上げたキャラと比べる
  S.greatKills=0;
  const grown=newHero();
  while(grown.lv<born.lv){ grown.lv++; grown.str++; grown.dex++; grown.vit++; grown.int++; }
  S.greatKills=0;
  return {lv:born.lv, born:{str:born.str, vit:born.vit}, grown:{str:grown.str, vit:grown.vit},
          same: born.str===grown.str && born.vit===grown.vit && born.int===grown.int,
          ok: born.str===grown.str && born.vit===grown.vit};
});

// 6-c. 上限がある（周回で初期レベルだけが伸び続けない）
R.rebirthCapped = await pg.evaluate(()=>{
  S.greatKills=999;
  const h=newHero();
  S.greatKills=0;
  return {lv:h.lv, cap:REBIRTH_MAX_LV, capped: h.lv===REBIRTH_MAX_LV,
          ok: h.lv===REBIRTH_MAX_LV};
});

/* 6-d. 実際に死んで作り直したときに乗る（newHero を通る道が1本であることの確認）。
       大ボスの記録は口座側なので、死んでも消えない。 */
R.rebirthAfterDeath = await pg.evaluate(()=>{
  S.greatKills=2; S.name='テスト'; S.deaths=0;
  S.hero=newHero();
  TH.run(1,{seed:8}); TH.floor(4);
  S.hero.hpNow=1; die();
  el('m-death').classList.remove('on');
  S.run=null;
  const next=newHero();
  const kept=S.greatKills;
  S.greatKills=0;
  return {greatKills:kept, lv:next.lv, want:1+2*REBIRTH_PER_GREAT,
          ok: kept===2 && next.lv===1+2*REBIRTH_PER_GREAT};
});

/* ================= 7. 報告から直した4件 ================= */

/* 7-a. 盾のボタン。構えは「2本目の指」で出す仕掛けだったが、
       **止まっているときは1本目の指がまだ画面に無い**ので、
       まず動き出さないと構えられなかった。
       「立ち止まって受ける」が一番したい場面なのに、そこだけできなかった。 */
R.guardButton = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(3);
  setScreen('game'); el('hud').classList.add('on');
  const gb=el('guardbtn');
  S.hero.equip.shield=null; updateHUD();
  const hiddenNoShield = !gb.classList.contains('on');
  S.hero.equip.shield=genBaseItem('round',5,1); updateHUD();
  const shown = gb.classList.contains('on');
  // #hud は pointer-events:none なので、押せるものは自分で auto に戻す必要がある
  const pe = getComputedStyle(gb).pointerEvents;
  // 立ち止まったまま（指は1本も置いていない）押して構えられる
  stickId=null; guardId=null; P.guard=false;
  gb.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  const guardsWhileStill = P.guard===true;
  const parryWindowOpen = (nowSec()-P.guardStart) < stats(S.hero).parryWin+0.2;
  dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true}));
  const released = P.guard===false;
  return {hiddenNoShield, shown, pe, guardsWhileStill, parryWindowOpen, released,
          ok: hiddenNoShield && shown && pe==='auto' && guardsWhileStill && released};
});

// 7-b. 2本指の操作も残っている（動きながら構えるのはそちらが速い）
R.guardTwoFingerStillWorks = await pg.evaluate(()=>{
  stickId=null; guardId=null; P.guard=false;
  const a={identifier:1, clientX:120, clientY:400, target:document.body};
  const c={identifier:2, clientX:300, clientY:400, target:document.body};
  touchStart({changedTouches:[a]});
  touchStart({changedTouches:[c]});
  const r={stick:stickId===1, guard:P.guard===true};
  touchEnd({changedTouches:[a,c], touches:[]});
  return {...r, ok: r.stick && r.guard};
});

/* 7-c. 「疾風の加護が切れた」は、掛かっていたときにだけ言う。
       階の番号だけで判定していたので、一度も掛かっていない初回の潜りでも
       第2階層に入った瞬間に「切れた」と出ていた。 */
R.graceExpiryMessage = await pg.evaluate(()=>{
  S.deepest=1; S.deaths=0;
  TH.run(1,{seed:3});
  logs.length=0;
  TH.floor(1); TH.floor(2);
  const falseAlarm = logs.some(l=>l.includes('切れた'));
  // 掛かっていた潜りでは、ちゃんと言う
  S.deepest=20;
  TH.run(1,{seed:3}); TH.floor(5);
  const wasOn = windGrace();
  logs.length=0;
  TH.floor(21);
  const saidOnce = logs.some(l=>l.includes('切れた'));
  // 二度は言わない
  logs.length=0;
  TH.floor(22);
  const saidTwice = logs.some(l=>l.includes('切れた'));
  return {noFalseAlarm: !falseAlarm, wasOn, saidOnce, notRepeated: !saidTwice,
          ok: !falseAlarm && wasOn && saidOnce && !saidTwice};
});

/* 7-d. 掘ったあとのログが、実装と食い違わないこと。
       炉を鉱脈から切り離したあともログだけ「ここで鍛えられる」と残っていて、
       その場で叩けると言いながら近づいても何も起きなかった（利用者からの報告）。
       **鉱脈で鍛えられないのは正しい**（運ぶ距離がこの仕掛けの本体）ので、
       直すのは文章のほう。 */
R.minedVeinCopy = await pg.evaluate(()=>{
  TH.run(1,{seed:11});
  let ore=null;
  for(let d=3; d<=20 && !ore; d++){ TH.floor(d); if((W.ores||[]).length) ore=W.ores[0]; }
  if(!ore) return {skipped:true, ok:false};
  P.x=ore.x; P.y=ore.y;
  TH.immortal(); TH.clearEnemies();     // 殴られると採掘は中断する
  logs.length=0;
  startMine(ore);
  stepSim(MINE_TIME+2);
  const line=logs.find(l=>l.includes('掘り終えた'))||'';
  // 掘ったあとも、そこは炉ではない
  const notForge = !nearForge();
  W.ev=null; W.npc=null; W.trial=null; W.shop=null;
  interact();
  const openedAtVein = el('m-forge').classList.contains('on');
  el('m-forge').classList.remove('on');
  return {line, mined:ore.mined, notForge, stayedShut: !openedAtVein,
          noLieInCopy: !line.includes('ここで鍛えられる'),
          tellsWhereToGo: line.includes('炉'),
          ok: ore.mined===true && notForge && !openedAtVein
              && !line.includes('ここで鍛えられる') && line.includes('炉')};
});

/* 7-e. 浅い階では出血を配らない。
       斬撃が出血を蓄積し、第1階層から出る「獣」の攻撃属性が斬撃なので、
       **最初の3階が一番きつい**という逆さまな形になっていた。 */
R.noEarlyBleed = await pg.evaluate(()=>{
  const beat=(depth)=>{
    TH.run(1,{seed:8}); TH.floor(depth);
    S.run.pst={}; S.run.pbu={};
    const e={lv:5, atkV:60, dt:'slash', dead:false, st:{}};
    for(let i=0;i<40;i++){ P.invuln=0; hitPlayer(e); S.hero.hpNow=stats(S.hero).maxHp; }
    return !!S.run.pst.bleed;
  };
  const shallow=beat(2), edge=beat(BLEED_MIN_DEPTH-1), deep=beat(BLEED_MIN_DEPTH+1);
  return {min:BLEED_MIN_DEPTH, noneAt2: !shallow, noneAtEdge: !edge, bleedsDeeper: deep,
          ok: !shallow && !edge && deep};
});

/* 7-f. 仲間も同じ扱い。プレイヤーだけ守っても、
       序盤に連れている仲間が溶けるなら意味が半分になる。 */
R.alliesShareTheRule = await pg.evaluate(()=>{
  TH.run(1,{seed:8}); TH.floor(2);
  const a=TH.ally(2,'warrior',3); a.slot=0; S.hero.party=[a];
  a.st={}; a.bu={}; a.hpNow=allyStats(a).maxHp;
  const e={lv:5, atkV:60, dt:'slash', dead:false, st:{}};
  for(let i=0;i<40;i++){ hitAlly(a, e); a.hpNow=allyStats(a).maxHp; a.dead=false; }
  const shallow=!!a.st.bleed;
  el('m-fallen').classList.remove('on'); _fallen=null; _fallenQueue=[];
  TH.floor(BLEED_MIN_DEPTH+1);
  a.st={}; a.bu={}; a.hpNow=allyStats(a).maxHp;
  for(let i=0;i<40;i++){ hitAlly(a, e); a.hpNow=allyStats(a).maxHp; a.dead=false; }
  const deep=!!a.st.bleed;
  el('m-fallen').classList.remove('on'); _fallen=null; _fallenQueue=[];
  return {noneShallow: !shallow, bleedsDeeper: deep, ok: !shallow && deep};
});

/* 7-g. こちらから敵に与える出血は最初から通る。
       序盤に効く手を減らす理由は無い（狭めたいのは受けるほうだけ）。 */
R.playerCanStillBleedEnemies = await pg.evaluate(()=>{
  TH.run(1,{seed:8}); TH.floor(2); TH.immortal();
  const w=genBaseItem('sword',6,1); w.ident=true; w.aff=[];
  S.hero.equip.weapon=w;
  const e=W.enemies[0]; e.maxHp=e.hp=1e7; e.st={}; e.bu={}; e.dead=false;
  const st=stats(S.hero);
  for(let i=0;i<60;i++) hitEnemy(e, st, 1);
  return {bleeding: !!e.st.bleed, ok: !!e.st.bleed};
});

await done(b, errs, R);
