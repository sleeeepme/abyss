// タイトルの「？」からの説明遷移／属性ごとの攻撃エフェクト
import { chromium, devices } from 'playwright'; import path from 'path';
/* file:// のまま画像を読むと、canvas が「別オリジンの絵が乗った」と見なされて
   getImageData が SecurityError で落ちる（キャラアートを実ファイルから読み始めた
   時点でこうなった）。描かれた色を読む検証があるので、
   ファイル同士を同一オリジンとして扱う指定を付けて開く。 */
const LAUNCH = {args:['--allow-file-access-from-files']};
const b=await chromium.launch(LAUNCH);
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ============ 1. タイトルの「？」 ============ */

/* 1-a. 「遊び方」はタイトル画面にある。
       拠点の右上に常設していた「？」は畳んだ（拠点の情報を減らすため）。
       説明への入口が消えたわけではないことを、実際のタップで確かめる。 */
R.titleHelp = await (async ()=>{
  await pg.evaluate(()=>setScreen('title'));
  await pg.waitForTimeout(150);
  const btn = await pg.$('#t-help');
  const visible = btn ? await btn.isVisible() : false;
  const box = btn ? await btn.boundingBox() : null;
  const bigEnough = box ? (box.width>=36 && box.height>=36) : false;
  const onTitle = await pg.evaluate(()=>!!document.querySelector('#scr-title #t-help'));
  await pg.tap('#t-help'); await pg.waitForTimeout(250);
  const opened = await pg.evaluate(()=>S.screen==='help'
    && document.getElementById('m-help').classList.contains('on'));
  await pg.tap('#help-ok'); await pg.waitForTimeout(250);
  const back = await pg.evaluate(()=>S.screen==='title');
  await pg.evaluate(()=>setScreen('town'));
  await pg.waitForTimeout(150);
  return {visible, bigEnough, onTitle, opened, backToTitle:back,
          size: box? Math.round(box.width)+'x'+Math.round(box.height) : null};
})();

// 1-b. 潜っても説明が自動で割り込まない
await pg.waitForTimeout(800);      // 連打ガード（tapAccepted の 700ms）をまたぐ
R.noAutoHelp = await (async ()=>{
  await pg.evaluate(()=>{ S.hero=null; S.run=null; });
  await pg.tap('#btn-dive'); await pg.waitForTimeout(400);
  return await pg.evaluate(()=>({
    screen:S.screen,
    helpShown:document.getElementById('m-help').classList.contains('on'),
    startedRun:!!S.run,
    ok: S.screen==='game' && !!S.run
        && !document.getElementById('m-help').classList.contains('on')}));
})();

// 1-c. 探索中の「？」は今まで通り使えて、戻り先は探索
R.inRunHelp = await pg.evaluate(()=>{
  if(!S.run){ S.hero=newHero(); startRun(1); }
  openHelp();
  const opened=S.screen==='help';
  closeHelp();
  return {opened, back:S.screen, ok: opened && S.screen==='game'};
});

// 1-d. 旧ボタンは残っていない（導線が二重にならない）
R.oldButton = await pg.evaluate(()=>({
  removed: !document.getElementById('btn-help-town')
}));

/* ============ 2. 属性ごとの攻撃エフェクト ============ */

// 2-a. 攻撃すると swing に属性が乗る。武器種を替えると属性が変わる。
R.swingType = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(3); S.hero.party=[];
  const out={};
  const fire=(baseId)=>{
    S.hero.equip.weapon=genBaseItem(baseId,10,1);
    S.hero.equip.shield=null;
    W.fx=[]; P.atkCd=0;
    // 射程内に的を置いて必ず振らせる
    const st=stats(S.hero);
    W.enemies=[{x:P.x+0.6,y:P.y, arch:ARCH[0], fam:FAMILY[0], lv:3, elite:false, aff:[],
      maxHp:9e9, hp:9e9, atkV:0, def:0, res:{}, dt:'slash', st:{}, bu:{},
      state:'idle', t:0, cd:99, vx:0, vy:0, hit:0, tele:0, dead:false, r:0.34,
      ms:0, teleMul:1, col:'#b5563f', name:'的'}];
    P.dirx=1; P.diry=0;
    playerAttack();
    const sw=W.fx.find(f=>f.t==='swing');
    const sh=W.fx.find(f=>f.t==='pshot');
    return sw ? sw.dt : (sh ? 'proj:'+sh.kind : null);
  };
  ['spear','sword','mace','dagger','great','axe'].forEach(b=>{ out[b]=fire(b); });
  out.bow=fire('bow'); out.staff=fire('staff');
  return {types:out,
          spearIsPierce: out.spear==='pierce',
          swordIsSlash:  out.sword==='slash',
          maceIsBlunt:   out.mace==='blunt',
          daggerIsPierce:out.dagger==='pierce',
          bowIsProjectile: String(out.bow).startsWith('proj:'),
          staffIsProjectile: String(out.staff).startsWith('proj:')};
});

// 2-b. 追加属性が乗ると elem に載る（斬撃＋炎が見た目に出る）
R.swingElem = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(3); S.hero.party=[];
  /* 「素の状態」を見たいので、属性の付いていない剣に固定する。
     genBaseItem は Magic も引くので、業火や雷光の接尾辞が乗ると
     何も足していないのに属性が出て、この試験は引きしだいで落ちる。 */
  S.hero.equip.weapon=genBaseItem('sword',10,1);
  S.hero.equip.weapon.aff=[];
  S.hero.equip.accessory=null; S.hero.equip.armor=null; S.hero.equip.shield=null;
  const plain=elemOf(stats(S.hero));
  // 炎の接尾辞を無理やり足す
  S.hero.equip.weapon.aff.push({t:'s',id:'fire',nm:'炎',stat:'fire',v:12});
  const withFire=elemOf(stats(S.hero));
  // 雷のほうが大きければ雷が優先される
  S.hero.equip.weapon.aff.push({t:'s',id:'shock',nm:'雷',stat:'shock',v:30});
  const withShock=elemOf(stats(S.hero));
  return {plain, withFire, withShock,
          noneWhenPlain: plain===null,
          picksFire: withFire==='fire',
          picksBiggest: withShock==='shock'};
});

// 2-c. 全属性が例外なく描ける（drawSwing を7属性ぶん直接叩く）
R.drawAll = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(3);
  const errsLocal=[];
  DTYPE_IDS.forEach(t=>{
    for(const p of [0.0,0.25,0.5,0.75,0.99]){
      try{
        drawSwing({t:'swing',x:P.x,y:P.y,a:0.7,life:0.18*(1-p),max:0.18,
                   r:2.0,arc:1.3,dt:t,elem:'fire',ally:true}, 0, 0);
      }catch(e){ errsLocal.push(t+'@'+p+': '+e.message); }
    }
  });
  // 追加属性なし・味方フラグなしでも落ちない
  try{ drawSwing({t:'swing',x:0,y:0,a:0,life:0.1,max:0.18,r:1.4,arc:1.3}, 0, 0); }
  catch(e){ errsLocal.push('minimal: '+e.message); }
  return {types:DTYPE_IDS.length, failures:errsLocal, allDrew:errsLocal.length===0};
});

// 2-d. 飛び道具と敵の弾も属性色で描ける
R.drawShots = await pg.evaluate(()=>{
  const fails=[];
  [['arrow',false],['bolt',false],['arrow',true],['bolt',true]].forEach(([k,ally])=>{
    try{ drawShot({t:'pshot',kind:k,x:1,y:1,vx:5,vy:2}, 0, 0, ally); }
    catch(e){ fails.push(k+(ally?'/ally':'')+': '+e.message); }
  });
  return {failures:fails, ok:fails.length===0};
});

// 2-e. 敵の弾は敵の属性色になる
R.boltColor = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(20);
  const seen=new Set();
  W.enemies.forEach(e=>{
    W.fx.push({t:'bolt',x:e.x,y:e.y,vx:1,vy:0,life:1,dmg:1,lv:e.lv,dt:e.dt});
    seen.add(e.dt);
  });
  const bolts=W.fx.filter(f=>f.t==='bolt');
  return {kinds:[...seen], bolts:bolts.length,
          allTyped: bolts.every(f=>!!DTYPE[f.dt])};
});

// 2-f. 凡例に7属性ぶんの形が並ぶ
R.legend = await pg.evaluate(()=>{
  buildLegend();
  const html=el('fxlist').innerHTML;
  const svgs=(html.match(/<svg/g)||[]).length;
  return {svgs, expected:DTYPE_IDS.length,
          hasPierceWord: html.includes('まっすぐ突いて引く'),
          hasSpear: html.includes('槍'),
          ok: svgs===DTYPE_IDS.length};
});

// 2-g. 仲間の攻撃にも属性が乗る
R.allySwing = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(6); S.hero.party=[];
  const out={};
  ['knight','warrior','priest','rogue'].forEach(job=>{
    const a=makeAlly(6,S.hero); a.job=job;
    a.equip.weapon=genBaseItem(jobDef(job).weapon,6,1);
    a.x=P.x; a.y=P.y; a.hpNow=allyStats(a).maxHp;
    W.fx=[];
    allyAttack(a, allyStats(a), {x:P.x+0.5,y:P.y,r:0.34});
    const sw=W.fx.find(f=>f.t==='swing');
    out[job]= sw ? {dt:sw.dt, ally:!!sw.ally} : null;
  });
  return {jobs:out,
          /* 属性はジョブではなく**武器種**から出る。ここに 'slash' と書き写していたので、
             重騎士を大剣から戦斧に替えた回に落ちた。武器のほうを見る。 */
          knightSlash: out.knight
            && out.knight.dt===(BASES.find(b=>b.id===jobDef('knight').weapon)||{}).dt,
          priestBlunt: out.priest && out.priest.dt==='blunt',
          roguePierce: out.rogue && out.rogue.dt==='pierce',
          taggedAsAlly: Object.values(out).every(o=>o && o.ally)};
});

/* ============ 3. 実プレイで落ちない ============ */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:8,aspd:6}; S.hero.lv=20;
  S.hero.str=24; S.hero.dex=24; S.hero.vit=24;
  startRun(8); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('spear',20,2);
  S.hero.equip.weapon.aff.push({t:'s',id:'fire',nm:'炎',stat:'fire',v:20});
  S.hero.equip.armor=genBaseItem('plate',20,2);
  S.hero.hpNow=stats(S.hero).maxHp;
  for(let i=0;i<2;i++){ const a=makeAlly(8,S.hero); a.x=P.x; a.y=P.y;
    uniqueAllyName(a,party()); S.hero.party.push(a); }
  W.enemies.forEach((e,i)=>{ e.x=P.x+Math.cos(i)*2.0; e.y=P.y+Math.sin(i)*2.0; });
  const t0=performance.now();
  await new Promise(r=>setTimeout(r,6000));
  // 死亡・仲間の死亡・潜在の選択は、どれも正常な進行なので結果としては見ない。
  // ここで見たいのは「6秒回して描画ループが例外で止まらないこと」だけ。
  // 例外が出れば errs に入る（pageerror を拾っている）。
  return {ran:+((performance.now()-t0)/1000).toFixed(1),
          outcome:S.screen, kills:S.run?S.run.kills:'(死亡でランは終了)',
          loopAlive: _tickCount>60};
});

/* ================= ピンチの明滅 =================
   HPバーは画面の隅にあり、戦っている最中に視線が向いているのは自キャラの周り。
   一番大事な「あと何発で死ぬか」が一番見ない場所にあった。
   画面の外周を染めれば、読まなくても目に入る。 */
R.danger = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(12); S.hero.party=[];
  setScreen('game');
  W.seen.forEach(r=>r.fill(1));
  const max=stats(S.hero).maxHp;

  /* 実際に描かれた色を読む。関数の戻り値ではなく画面に出た結果を見たいので、
     画面中央（素通しのはず）と外周の1点を拾って比べる。 */
  const probe=(frac)=>{
    S.hero.hpNow=Math.round(max*frac);
    draw();
    const w=Math.floor(innerWidth), h=Math.floor(innerHeight);
    const edge=ctx.getImageData(2, Math.floor(h/2), 1, 1).data;
    const mid =ctx.getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data;
    return {frac, edge:[edge[0],edge[1],edge[2]], mid:[mid[0],mid[1],mid[2]]};
  };
  // 明滅しているので、同じHPで何度か測って一番濃いところを採る
  const sample=(frac)=>{
    let best=null;
    for(let i=0;i<40;i++){
      const r=probe(frac);
      const warm=r.edge[0]-r.edge[2];        // 赤〜黄はいずれも B より R が高い
      if(!best || warm>best.warm) best={...r, warm};
    }
    return best;
  };
  const healthy=sample(0.90);
  const warn   =sample(0.35);
  const crit   =sample(0.10);

  /* 色は「健康なときの画面からどれだけ動いたか」で見る。
     背景そのものが青寄りなので、絶対値で R>B を求めると、
     色が乗っていても判定に落ちる（実際そうなった）。 */
  const d=(x)=>[x.edge[0]-healthy.edge[0], x.edge[1]-healthy.edge[1], x.edge[2]-healthy.edge[2]];
  const dw=d(warn), dc=d(crit);
  // 黄色は G が B より大きく上がる。赤は R が突出する。
  const warnYellow = dw[1] > dw[2] && dw[1] >= 2;
  const critRedder = (dc[0]-dc[1]) > (dw[0]-dw[1]);
  const visible = dw[0] >= 4 && dc[0] >= 8;     // 見えない濃さでは意味が無い
  S.hero.hpNow=max;
  return {healthy, warn, crit, dw, dc,
          thresholds:[DANGER_WARN, DANGER_CRIT],
          quietWhenHealthy: healthy.warm <= 2,
          warnsAt50: warn.warm > healthy.warm,
          harderAt20: crit.warm > warn.warm,
          warnIsYellow: warnYellow,
          critIsRed: critRedder,
          strongEnough: visible,
          // 中央は染めない（プレイが見えなくなる）
          centreClear: crit.mid[0]-crit.mid[2] <= 6,
          ok: healthy.warm<=2 && warn.warm>healthy.warm && crit.warm>warn.warm
              && warnYellow && critRedder && visible
              && (crit.mid[0]-crit.mid[2])<=6};
});

/* ================= レベルアップの見せ方 =================
   ログの1行だけだった。ログは他の行にすぐ押し流されるので、
   この game で一番はっきりした前進が一番地味な出来事になっていた。 */
R.levelUp = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(10); S.hero.party=[];
  setScreen('game');
  W.fx=[]; W.pops=[];
  S.hero.hpNow=Math.round(stats(S.hero).maxHp*0.3);
  const lv0=S.hero.lv;
  S.hero.xp=xpNeed(S.hero.lv);
  addXp(S.hero, 1, true);
  const lv1=S.hero.lv;
  const ring=W.fx.filter(f=>f.t==='levelup').length;
  const pop =W.pops.filter(p=>p.txt==='LEVEL UP').length;
  draw(); updateHUD();
  const bannerShown=!!_banner && _banner.title==='Lv.'+lv1;
  const bannerSub=_banner?_banner.sub:'';
  const glow=document.getElementById('hpfill').style.boxShadow;
  /* ---------- 上がっても全快はしない ----------
     以前はここで全回復していた。そのせいで**序盤に消耗という概念が無かった**——
     第1〜4階層はちょうど1階に1回上がるので、どれだけ削られても
     階を移る前に満タンに戻っていた（測定で、第4階層で 71% まで落ちた体が
     第5階層に 89% で入っていた）。

     いまは最大HPの LEVEL_HEAL_PCT ぶんだけ戻る。
     見るのは2つ。**戻ること**と、**戻りきらないこと。** */
  const mx=stats(S.hero).maxHp;
  const healed=S.hero.hpNow > Math.round(mx*0.3);
  const notFull=S.hero.hpNow < mx;
  const gained=Math.round((S.hero.hpNow - Math.round(mx*0.3)) / mx * 100);
  let threw=null;
  try{ for(let i=0;i<8;i++){ draw(); updateHUD(); } }catch(e){ threw=e.message; }

  // 仲間のレベルアップでも輪は出る（誰が上がったか分かるように）
  W.fx=[];
  const a=makeAlly(10,S.hero); a.x=P.x+1; a.y=P.y;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  a.xp=xpNeed(a.lv);
  addXp(a, 1, false);
  const allyRing=W.fx.filter(f=>f.t==='levelup').length;
  return {lv0, lv1, ring, pop, bannerShown, bannerSub, glow, threw, allyRing,
          gainedPct:gained, healPct:LEVEL_HEAL_PCT,
          ringShown: ring===1,
          popShown: pop===1,
          /* 回復量は文章で言わない。HPバーが伸びて光るので見れば分かる。
             分かることを重ねて書くと、Lv がいくつになったかが読み飛ばされる。 */
          bannerHasNoHealText: bannerSub==='',
          barGlows: !!glow,
          healsSome: healed,
          // **ここが本題。** 全快すると序盤の消耗が毎階リセットされる
          doesNotHealToFull: notFull,
          // 定数どおりの量か（±2% は丸めのぶん）
          matchesConstant: Math.abs(gained - LEVEL_HEAL_PCT) <= 2,
          allyAlsoShows: allyRing===1,
          drawsFine: threw===null,
          ok: lv1===lv0+1 && ring===1 && pop===1 && bannerShown
              && bannerSub==='' && !!glow && healed && notFull
              && allyRing===1 && threw===null};
});

/* ================= 実入りは1つずつ出す =================
   経験値と金を1行に詰めると「まとめて1つの数字」に見えて、
   どちらがどれだけ入ったのか読み分けられない。順番にずらして出す。 */
R.rewardPopsInOrder = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(8); S.hero.party=[];
  setScreen('game');
  const e=W.enemies[0]; e.x=P.x+1; e.y=P.y; e.hp=1;
  W.pops=[];
  killEnemy(e);
  const rewards=W.pops.filter(p=>p.reward);
  const xpPop=rewards.find(p=>p.txt.includes('EXP'));
  const gPop =rewards.find(p=>/ G$/.test(p.txt));
  /* SPも経験値・金と同じ「倒した瞬間に入る報酬」になった。
     床に落として拾わせるのをやめたので、ここに3つ目として並ぶ。 */
  const spPop=rewards.find(p=>p.txt.includes('SP'));
  // 1行に同居していない
  const separated = !!xpPop && !!gPop && !!spPop
                 && !xpPop.txt.includes(' G') && !gPop.txt.includes('EXP');
  // 直後に見えているのは経験値だけ（金とSPは順番待ち）
  const xpFirst = !(xpPop.delay>0) && gPop.delay>0 && spPop.delay>0;
  // SPは金より後ろ（読み分けられるように1つずつ出す）
  const spLast = spPop.delay > gPop.delay;
  const spBlue = spPop.c==='#8fd8ff';
  stepSim(0.1);
  const goldStillWaiting = gPop.delay>0 && gPop.life===gPop.max;
  // 待ち時間が過ぎれば金も浮き始める
  stepSim(1.0);
  const goldRanLater = !(gPop.delay>0) && gPop.life<gPop.max;
  return {count:rewards.length, xpTxt:xpPop&&xpPop.txt, gTxt:gPop&&gPop.txt,
          spTxt:spPop&&spPop.txt, spCol:spPop&&spPop.c,
          separated, xpFirst, spLast, spBlue, goldStillWaiting, goldRanLater,
          ok: rewards.length===3 && separated && xpFirst && spLast && spBlue
              && goldStillWaiting && goldRanLater};
});

/* ================= 消えたまま戻らないキャラ =================
   報告「敵と交戦中にキャラが見えなくなって戻らなくなる（高頻度）」。

   正体は演出側の足踏み位相。updateFeel は m.phase に毎フレーム移動距離を
   **足し込む**ので、座標に1フレームでも NaN が混ざると phase は NaN のまま固まる
   （NaN + 何か = NaN）。そのまま動き出すとコマ番号 ((floor(x)%4)+4)%4 も NaN になり、
   配列添字が NaN → pose が undefined → pose.upperY で例外。
   例外は draw() ごと中断させるので、そのフレームの絵が丸ごと落ちる。
   毎フレーム同じ所で投げるから、**戻ってこない。**

   直したのは2ヶ所で、検証も2ヶ所ぶんある:
     1) 演出側（game-feel.js）: 有限でないフレームは捨て、phase は自力で回復する
     2) 本編側（index.html）: 演出が投げても素の図形へ落として盤面は描き切る */

R.nanFrameDoesNotFreezeArt = await pg.evaluate(()=>{
  /* このスイートは _h.mjs の install() を使っていないので TH は無い。
     器は本編の関数から直に組む（S.run は startRun 経由、が全体の約束）。 */
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  P.invuln=1e9; W.enemies.length=0;
  S.hero.party=[];
  const a=makeAlly(3,S.hero); a.boons=[]; a.lv=5; a.slot=0;
  a.hpNow=allyStats(a).maxHp; a.x=P.x+1; a.y=P.y; S.hero.party.push(a);
  stickDx=1; stickDy=0; stepSim(0.3); stickDx=0; stickDy=0;
  // 1フレームだけ座標を壊す（加入直後でまだ座標を持たない仲間などで実際に起きる形）
  const sx=a.x, sy=a.y;
  a.x=NaN; stepSim(1/60);
  a.x=sx; a.y=sy; stepSim(1/60);
  const phaseOk = Number.isFinite(feelMotion(a).phase);
  // そのあと動かして描く。ここで投げていたのが報告された症状
  let threw=null;
  try{ stickDx=1; stickDy=0; stepSim(0.5,{draw:true}); stickDx=0; stickDy=0; }
  catch(e){ threw=String(e.message); stickDx=0; stickDy=0; }
  return {phase:feelMotion(a).phase, threw,
          phaseRecovers: phaseOk,
          drawSurvives: threw===null,
          ok: phaseOk && threw===null};
});

/* 演出側が何かの拍子に投げても、盤面は素の図形で描き切る。
   絵は演出、盤面は本編——この境目が無いと、演出の不具合が1つ増えるたびに
   「画面が丸ごと消える」が1つ増える。 */
R.feelThrowFallsBackToShapes = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  P.invuln=1e9;
  S.hero.party=[];
  const a=makeAlly(3,S.hero); a.boons=[]; a.lv=5; a.slot=0;
  a.hpNow=allyStats(a).maxHp; a.x=P.x+1; a.y=P.y; S.hero.party.push(a);
  const orig=window.drawFeelCharacterSprite;
  /* 変換は素の単位行列ではない（端末の画素密度ぶん ctx.scale が掛かっている）。
     比べる相手は「投げる前の変換」であって 1 ではない。 */
  draw();
  const t0=ctx.getTransform();
  const cerr=console.error;
  console.error=()=>{};                 // わざと投げるので、その報告は伏せる
  let calls=0;
  window.drawFeelCharacterSprite=()=>{ calls++; throw new Error('わざと投げる'); };
  let threw=null;
  try{ for(let i=0;i<12;i++) draw(); }catch(e){ threw=String(e.message); }
  // 積み残した ctx.save() を引きずっていないか（変換が元に戻っているか）
  const t=ctx.getTransform();
  const cleanTransform = Math.abs(t.a-t0.a)<0.01 && Math.abs(t.d-t0.d)<0.01
                      && Math.abs(t.e-t0.e)<1.5 && Math.abs(t.f-t0.f)<1.5;
  window.drawFeelCharacterSprite=orig;
  console.error=cerr;
  _feelDrawFails=0;                     // 打ち切りの記録を戻す（後続の検証に持ち越さない）
  draw();
  return {calls, threw,
          called: calls>0,
          drawSurvives: threw===null,
          transformNotLeaked: cleanTransform,
          givesUpEventually: calls<=FEEL_DRAW_GIVEUP,
          ok: calls>0 && threw===null && cleanTransform};
});

/* ============ 5. 「キャラだけ消えて戻らない」 ============
   報告: 歩いている／戦っている最中に、突然キャラの表示が消えて戻らなくなる。

   この形の事故は例外もログも残さないので、原因側を1つずつ塞ぐのではなく
   **消えている状態が続いたら必ず戻す**という受け口を用意した。
   ここでは消え方を3種類とも人工的に作り、どれも戻ることを確かめる。 */

/* 5-a. 点滅の位相で固まった場合（fallBlink が減らなくなる）。
       正常な点滅は 1 コマ 0.06 秒なので見張りに掛からず、
       止まって消えたままになったときだけ戻る。 */
R.stuckBlinkRecovers = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  S.hero.party=[]; P.invuln=1e9;
  stepSim(0.3,{draw:true});
  const hiddenNow=()=>(P.fallBlink>0)&&(Math.floor(P.fallBlink*16)%2===0);
  // 「消えている側」の位相で止める
  P.fallBlink=0.875;                       // floor(0.875*16)=14 → 偶数＝消えている
  const hiddenAtStart=hiddenNow();
  const cerr=console.error; console.error=()=>{};
  let stillHidden=0;
  for(let i=0;i<120;i++){                  // 2秒ぶん、fallBlink を止めたまま描く
    P.fallBlink=0.875;                     // 減らさない＝固まった状態を再現
    draw();
    if(i>70 && P._gone===0 && P.fallBlink===0.875) stillHidden++;
  }
  console.error=cerr;
  // 見張りが働けば fallBlink は 0 に落とされる（毎フレーム戻しているので直後に再現される）
  P.fallBlink=0.875;
  const before=P._gone;
  for(let i=0;i<70;i++) draw();            // 1.2秒ぶん
  const cleared = P.fallBlink===0;
  P.fallBlink=0; P._gone=0;
  return {hiddenAtStart, cleared, recovers: hiddenAtStart && cleared};
});

/* 5-b. 演出の揺れが NaN になった場合。
       canvas は translate(NaN) を例外なしで捨てるので、
       丸めていないと「主人公だけ消える」になる。 */
R.nanOffsetStillDraws = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  S.hero.party=[]; P.invuln=1e9;
  stepSim(0.3,{draw:true});
  const m=feelMotion(P);
  m.recoilX=NaN; m.recoilY=NaN; m.phase=NaN;   // 一度壊れると反動が 0 でも NaN のまま
  const raw=feelHeroOffset();
  const rawBroken = !Number.isFinite(raw.x) || !Number.isFinite(raw.y);
  const safe=finiteXY(raw);
  const safeFinite = Number.isFinite(safe.x) && Number.isFinite(safe.y);
  // 実際に描いて、変換行列に NaN が残らないこと
  let threw=null;
  try{ draw(); }catch(e){ threw=String(e.message); }
  const t=ctx.getTransform();
  const transformFinite = [t.a,t.b,t.c,t.d,t.e,t.f].every(Number.isFinite);
  return {rawBroken, safeFinite, transformFinite, drawSurvives:threw===null,
          ok: safeFinite && transformFinite && threw===null};
});

/* 5-c. 被弾元が座標を持たない場合（罠・地形・消えた撃ち手）。
       ここで NaN を入れてしまうと、反動が切れたあとも
       NaN*0=NaN でオフセットが戻らない。 */
R.impactFromPlacelessSourceStaysFinite = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  S.hero.party=[]; P.invuln=1e9;
  stepSim(0.3,{draw:true});
  const m=feelMotion(P);
  m.recoilX=0; m.recoilY=0;
  feelImpact(P, {name:'座標を持たない何か'}, false, 'slash', null);   // x,y が無い
  const finiteAfterHit = Number.isFinite(m.recoilX) && Number.isFinite(m.recoilY);
  m.recoil=0;                                   // 反動が切れたあとも有限か
  const off=feelHeroOffset();
  const finiteAfterDecay = Number.isFinite(off.x) && Number.isFinite(off.y);
  return {finiteAfterHit, finiteAfterDecay, ok: finiteAfterHit && finiteAfterDecay};
});

/* 5-d. 演出の途中で落ちても、裏キャンバスに ctx が残らない。
       残ると以後ずっと画面に何も描かれなくなる（例外もログも出ない）。 */
R.pixelFxNeverStealsContext = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  S.hero.party=[]; P.invuln=1e9;
  stepSim(0.3,{draw:true});
  const main=ctx;
  beginPixelFx();
  const swapped = ctx!==main;
  // endPixelFx を呼ばずに落ちた状況を作る
  const leaked = ctx;
  beginPixelFx();                 // 次のフレームの入口
  const recovered = feelMainCtx===main;
  endPixelFx();
  const backToMain = ctx===main;
  draw();
  return {swapped, recovered, backToMain,
          ok: swapped && recovered && backToMain};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
