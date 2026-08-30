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
  S.hero.equip.weapon=genBaseItem('sword',10,1);
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
  const full=S.hero.hpNow===stats(S.hero).maxHp;
  let threw=null;
  try{ for(let i=0;i<8;i++){ draw(); updateHUD(); } }catch(e){ threw=e.message; }

  // 仲間のレベルアップでも輪は出る（誰が上がったか分かるように）
  W.fx=[];
  const a=makeAlly(10,S.hero); a.x=P.x+1; a.y=P.y;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  a.xp=xpNeed(a.lv);
  addXp(a, 1, false);
  const allyRing=W.fx.filter(f=>f.t==='levelup').length;
  return {lv0, lv1, ring, pop, bannerShown, bannerSub, glow, full, threw, allyRing,
          ringShown: ring===1,
          popShown: pop===1,
          bannerSaysHeal: bannerSub.includes('全快'),
          barGlows: !!glow,
          healedToFull: full,
          allyAlsoShows: allyRing===1,
          drawsFine: threw===null,
          ok: lv1===lv0+1 && ring===1 && pop===1 && bannerShown
              && bannerSub.includes('全快') && !!glow && full
              && allyRing===1 && threw===null};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
