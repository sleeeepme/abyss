// 永続強化「仲間の練度」／僧侶を後衛にする／遊び方のジョブ一覧。
//
// 2つめが本題。僧侶は武器が戦槌＝近接なので、他の仲間と同じ規則で動かすと
// 回復役が最前線まで出て真っ先に落ちる。落ちると立て直せなくなるので、
// パーティ全体が崩れる起点になっていた。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 永続強化「仲間の練度」 ================= */

// 1-a. 一覧に載っていて、秘石で買える
R.upgListed = await pg.evaluate(()=>{
  const u=UPGRADES.find(x=>x.id==='ally');
  TH.run(1,{seed:3});
  S.upg={}; S.shards=99999;
  setScreen('upg');
  const shown=el('upgrades').textContent.includes(u.nm);
  document.querySelector('[data-upg="ally"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const lv1=upgLv('ally');
  const cost=upgCost(u,0);
  setScreen('town');
  return {nm:u.nm, max:u.max, step:u.step, shown, lv1, cost,
          buyable: lv1===1,
          ok: !!u && shown && lv1===1 && u.max>0};
});

// 1-b. 仲間の全能力が上がる。主人公は上がらない。
R.upgApplies = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(14);
  const a=makeAlly(14,S.hero); a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  const keys=['maxHp','atk','def','aspd','ms','range'];
  const snap=()=>{ const s=allyStats(a); const o={};
    keys.forEach(k=>o[k]=+(s[k]).toFixed(3)); return o; };
  S.upg={};
  const before=snap(), heroBefore=+stats(S.hero).atk.toFixed(3);
  S.upg={ally:6};
  const after=snap(), heroAfter=+stats(S.hero).atk.toFixed(3);
  S.upg={};
  const rose=keys.filter(k=>after[k]>before[k]);
  return {before, after, rose, keys,
          heroBefore, heroAfter,
          allSixRose: rose.length===keys.length,
          heroUnchanged: Math.abs(heroAfter-heroBefore)<1e-6,
          ok: rose.length===keys.length && Math.abs(heroAfter-heroBefore)<1e-6};
});

// 1-c. 口座側の強化なので、あとから拾った仲間にも効く
R.upgIsAccount = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(16);
  S.upg={};
  const plain=makeAlly(16,S.hero);
  const a0=+allyStats(plain).atk.toFixed(3);
  S.upg={ally:6};
  const fresh=makeAlly(16,S.hero);          // 強化したあとに拾った仲間
  fresh.lv=plain.lv; fresh.job=plain.job;
  fresh.str=plain.str; fresh.dex=plain.dex; fresh.vit=plain.vit;
  fresh.equip=plain.equip;
  const a1=+allyStats(fresh).atk.toFixed(3);
  S.upg={};
  return {before:a0, after:a1, newAllyBenefits: a1>a0, ok: a1>a0};
});

// 1-d. それでも主人公は超えない（仲間の上限は動かさない）
R.upgKeepsCap = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(20);
  S.upg={ally:6};
  const a=makeAlly(20,S.hero); a.lv=S.hero.lv;
  const as=allyStats(a), ps=stats(S.hero);
  S.upg={};
  return {allyAtk:+as.atk.toFixed(2), heroAtk:+ps.atk.toFixed(2),
          allyHp:as.maxHp, heroHp:ps.maxHp,
          underHero: as.atk<=ps.atk && as.maxHp<=ps.maxHp,
          ok: as.atk<=ps.atk && as.maxHp<=ps.maxHp};
});

/* ================= 2. 僧侶を後衛にする ================= */

// 2-a. 前衛がいれば後衛モードに入り、その後ろ（敵の反対側）に立つ
R.priestCovers = await pg.evaluate(()=>{
  TH.run(1,{seed:13}); TH.floor(16);
  TH.immortal();
  const pr=makeAlly(16,S.hero); pr.job='priest'; pr.slot=0;
  pr.hpNow=allyStats(pr).maxHp*99;
  const fr=makeAlly(16,S.hero); fr.job='knight'; fr.slot=1;
  fr.hpNow=allyStats(fr).maxHp*99;
  uniqueAllyName(pr,party()); S.hero.party.push(pr);
  uniqueAllyName(fr,party()); S.hero.party.push(fr);
  // 的を1体だけ、主人公の前に
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=P.x+3.5; e.y=P.y; e.maxHp=e.hp=999999; e.atkV=0; e.ms=0;
  pr.x=P.x; pr.y=P.y; fr.x=P.x; fr.y=P.y;
  stepSim(4);

  const dPriest=Math.hypot(pr.x-e.x, pr.y-e.y);
  const dFront =Math.hypot(fr.x-e.x, fr.y-e.y);
  // 前衛から見て、僧侶は敵の反対側にいるか（内積が負なら後ろ）
  const ax=e.x-fr.x, ay=e.y-fr.y;
  const bx=pr.x-fr.x, by=pr.y-fr.y;
  const dot=(ax*bx+ay*by)/((Math.hypot(ax,ay)||1)*(Math.hypot(bx,by)||1));
  return {mode:pr.mode, dPriest:+dPriest.toFixed(2), dFront:+dFront.toFixed(2),
          dot:+dot.toFixed(2),
          inCover: pr.mode==='cover',
          fartherThanFront: dPriest > dFront,
          behindFront: dot < 0,
          ok: pr.mode==='cover' && dPriest>dFront && dot<0};
});

// 2-b. 後衛のあいだは攻撃しない（祈りは続く）
R.priestHoldsFire = await pg.evaluate(()=>{
  TH.run(1,{seed:17}); TH.floor(16);
  TH.immortal();
  const pr=makeAlly(16,S.hero); pr.job='priest'; pr.slot=0; pr.prayCd=0.2;
  pr.hpNow=allyStats(pr).maxHp*99;
  const fr=makeAlly(16,S.hero); fr.job='knight'; fr.slot=1;
  fr.hpNow=allyStats(fr).maxHp*99;
  uniqueAllyName(pr,party()); S.hero.party.push(pr);
  uniqueAllyName(fr,party()); S.hero.party.push(fr);
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=P.x+3.0; e.y=P.y; e.maxHp=e.hp=999999; e.atkV=0; e.ms=0;
  pr.x=P.x; pr.y=P.y; fr.x=P.x; fr.y=P.y;

  // 僧侶が振った回数を数える（swing が立った瞬間）
  let priestSwings=0, frontSwings=0, prevP=0, prevF=0;
  S.hero.hpNow=1;                        // 祈りが効いているかを見るため削っておく
  S.hero.equip.weapon=null;              // 主人公は手出ししない
  stepSim(8, {after:()=>{
    if(pr.swing>prevP) priestSwings++;
    if(fr.swing>prevF) frontSwings++;
    prevP=pr.swing; prevF=fr.swing;
  }});
  const healed=S.hero.hpNow>1;
  return {priestSwings, frontSwings, mode:pr.mode, heroHp:Math.round(S.hero.hpNow),
          silent: priestSwings===0,
          frontFights: frontSwings>0,
          stillPrays: healed,
          ok: priestSwings===0 && frontSwings>0 && healed};
});

// 2-c. 前衛がいなければ普通に戦う（誰も前にいないのに下がり続けない）
R.priestAloneFights = await pg.evaluate(()=>{
  TH.run(1,{seed:19}); TH.floor(16);
  TH.immortal();
  const pr=makeAlly(16,S.hero); pr.job='priest'; pr.slot=0;
  pr.hpNow=allyStats(pr).maxHp*99;
  uniqueAllyName(pr,party()); S.hero.party.push(pr);
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=P.x+2.5; e.y=P.y; e.maxHp=e.hp=999999; e.atkV=0; e.ms=0;
  pr.x=P.x; pr.y=P.y;
  S.hero.equip.weapon=null;
  const hp0=e.hp;
  let swings=0, prev=0;
  stepSim(8, {after:()=>{ if(pr.swing>prev) swings++; prev=pr.swing; }});
  return {mode:pr.mode, swings, dealt:hp0-e.hp,
          fights: swings>0 && pr.mode!=='cover',
          ok: swings>0 && pr.mode!=='cover'};
});

// 2-d. 前衛が倒れたら切り替わる
R.priestSwitchesBack = await pg.evaluate(()=>{
  TH.run(1,{seed:23}); TH.floor(16);
  TH.immortal();
  const pr=makeAlly(16,S.hero); pr.job='priest'; pr.slot=0;
  pr.hpNow=allyStats(pr).maxHp*99;
  const fr=makeAlly(16,S.hero); fr.job='warrior'; fr.slot=1;
  fr.hpNow=allyStats(fr).maxHp*99;
  uniqueAllyName(pr,party()); S.hero.party.push(pr);
  uniqueAllyName(fr,party()); S.hero.party.push(fr);
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=P.x+3.0; e.y=P.y; e.maxHp=e.hp=999999; e.atkV=0; e.ms=0;
  pr.x=P.x; pr.y=P.y; fr.x=P.x; fr.y=P.y;
  stepSim(3);
  const covering=pr.mode==='cover';
  fr.dead=true; fr.hpNow=0;              // 前衛が落ちた
  stepSim(3);
  const fightsNow=pr.mode!=='cover';
  return {covering, modeAfter:pr.mode, fightsNow,
          ok: covering && fightsNow};
});

/* 2-e. 本題の検証: **僧侶が実際に死ににくくなったか**
   立ち位置や振る回数は手段でしかない。守りたいのは「回復役が落ちない」ことなので、
   同じ戦況を前後で走らせて生存を比べる。 */
R.priestSurvives = await pg.evaluate(()=>{
  const trial=(backline)=>{
    let died=0;
    const runs=8;
    for(let i=0;i<runs;i++){
      TH.run(1,{seed:31+i}); TH.floor(22);
      TH.immortal();                       // 主人公は死なせない（比較にならないので）
      const pr=makeAlly(22,S.hero); pr.job='priest'; pr.slot=0;
      pr.hpNow=allyStats(pr).maxHp;
      const fr=makeAlly(22,S.hero); fr.job='knight'; fr.slot=1;
      fr.hpNow=allyStats(fr).maxHp*99;     // 前衛は落ちない（僧侶だけを見たい）
      uniqueAllyName(pr,party()); S.hero.party.push(pr);
      uniqueAllyName(fr,party()); S.hero.party.push(fr);
      // 後衛の仕組みを切ってみる比較用
      jobDef('priest').backline = backline;
      // 敵を数体、主人公の前に固める
      W.enemies.slice(0,5).forEach((e,k)=>{
        e.x=P.x+3.0+Math.cos(k)*0.8; e.y=P.y+Math.sin(k)*0.8; });
      W.enemies=W.enemies.slice(0,5);
      pr.x=P.x; pr.y=P.y; fr.x=P.x; fr.y=P.y;
      stepSim(14);
      if(pr.dead) died++;
      document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
    }
    return {died, runs};
  };
  const before=trial(false);      // 以前の挙動（前衛と同じように前へ出る）
  const after =trial(true);       // 後衛
  jobDef('priest').backline = true;
  return {before, after,
          safer: after.died < before.died,
          ok: after.died < before.died};
});

/* ================= 3. 遊び方のジョブ一覧 ================= */

R.helpJobs = await pg.evaluate(()=>{
  buildLegend();
  const txt=el('joblist').textContent.replace(/\s+/g,' ');
  const missingJobs=ALL_JOBS.filter(j=>!txt.includes(j.nm)).map(j=>j.nm);
  const missingUniq=ALL_JOBS.filter(j=>!txt.includes(j.sk.nm)).map(j=>j.sk.nm);
  const allSkills=[].concat(...Object.values(JOB_SKILLS));
  const missingSkills=allSkills.filter(sk=>!txt.includes(sk.nm)).map(sk=>sk.nm);
  return {jobs:ALL_JOBS.length, skills:allSkills.length,
          missingJobs, missingUniq, missingSkills,
          len:txt.length,
          saysBackline: txt.includes('後衛') && txt.includes('攻撃には参加しません'),
          saysElite: txt.includes('大ボス撃破で解放'),
          // 定義から組み立てているので、抜けはゼロでなければならない
          ok: missingJobs.length===0 && missingUniq.length===0
              && missingSkills.length===0 && txt.includes('後衛')};
});

/* ================= 4. 実プレイで例外なく回る ================= */
R.live = await pg.evaluate(()=>{
  const fails=[];
  try{
    TH.run(1,{seed:41}); TH.floor(18);
    TH.immortal();
    S.upg={ally:6};
    ['priest','knight','hunter'].forEach((job,i)=>{
      const a=makeAlly(18,S.hero); a.job=job; a.slot=i; a.x=P.x; a.y=P.y;
      uniqueAllyName(a,party()); S.hero.party.push(a);
      a.hpNow=allyStats(a).maxHp;
    });
    W.enemies.slice(0,6).forEach((e,i)=>{ e.x=P.x+Math.cos(i)*2.6; e.y=P.y+Math.sin(i)*2.6; });
    stepSim(8, {draw:true, each:(t)=>{ stickDx=Math.cos(t*0.7); stickDy=Math.sin(t*1.1); }});
    stickDx=0; stickDy=0;
    updateHUD();
    const modes=livingParty().map(a=>a.job+':'+a.mode);
    S.upg={};
    return {failures:fails, modes, alive:!!S.hero, party:livingParty().length,
            loopAlive:_tickCount>300,
            ok: !!S.hero && _tickCount>300};
  }catch(e){ fails.push(e.message); return {failures:fails, ok:false}; }
});

/* ================= 4. 中継地点 ================= */

// 4-a. 大ボスを倒すと開く（到達度ではなく撃破が条件）
R.beacon = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  S.beacons=[]; S.deepest=49;                 // 深く潜っていても、倒していなければ開かない
  const deepOnly=unlockedDepths().slice();
  TH.floor(10);
  const boss=W.enemies.find(e=>e.boss);
  boss.hp=1; killEnemy(boss);
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const after=unlockedDepths().slice();
  // 同じ階をもう一度倒しても増えない
  TH.floor(10);
  const b2=W.enemies.find(e=>e.boss); b2.hp=1; killEnemy(b2);
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const twice=unlockedDepths().slice();
  const saved=(S.beacons||[]).slice();
  S.beacons=[];
  return {deepOnly, after, twice, saved,
          closedUntilKilled: deepOnly.length===1 && deepOnly[0]===1,
          opensAt11: after.includes(11),
          everyTen: after.length===2,
          noDuplicate: twice.length===after.length,
          ok: deepOnly.length===1 && after.includes(11) && twice.length===after.length};
});

// 4-b. 中継地点は10階ごと（11/21/31/41）
R.beaconSteps = await pg.evaluate(()=>{
  TH.run(1,{seed:5});
  S.beacons=[10,20,30,40];
  const list=unlockedDepths();
  S.beacons=[];
  return {list, expected:[1,11,21,31,41],
          matches: JSON.stringify(list)===JSON.stringify([1,11,21,31,41]),
          ok: JSON.stringify(list)===JSON.stringify([1,11,21,31,41])};
});

/* 4-c. 救済措置: 中継地点から始めると、歩かずに来たぶんの能力強化が渡る。
   Lv.1・素手で第11階層に放り込まれても、できるのは死ぬことだけ。 */
R.beaconOutfit = await pg.evaluate(()=>{
  S.hero=null; S.beacons=[10]; S.upg={}; S.carry=[]; S.legacyBoons=[];
  S.startDepth=11;
  startRun(11);
  const h=S.hero;
  const want=beaconLevel(11);
  const gearGiven=['weapon','armor'].filter(sl=>!!h.equip[sl]);
  const survives=(()=>{
    // 第11階層の雑魚に何発耐えられるか（1発で溶けないこと）
    const st=stats(h);
    const e=W.enemies.find(x=>!x.boss && !x.dead);
    return e ? Math.floor(st.maxHp / Math.max(1, e.atkV*0.5)) : 0;
  })();
  const lvOK=h.lv===want;

  // 自前で育てたキャラは下げられない・装備も奪われない
  S.hero=null; startRun(1);
  const strong=S.hero;
  strong.lv=40; strong.str=44; strong.dex=44; strong.vit=44;
  strong.equip.weapon=genBaseItem('great',40,3); strong.equip.weapon.ident=true;
  const keptWeapon=strong.equip.weapon;
  startRun(11);
  const keptLv=S.hero.lv===40, keptGear=S.hero.equip.weapon===keptWeapon;
  S.beacons=[]; S.startDepth=1;
  return {want, heroLv:h.lv, gearGiven, survives, lvOK, keptLv, keptGear,
          liftsLevel: lvOK && want>1,
          givesGear: gearGiven.length===2,
          tanksSeveralHits: survives>=3,
          neverDowngrades: keptLv && keptGear,
          ok: lvOK && gearGiven.length===2 && survives>=3 && keptLv && keptGear};
});

// 4-d. 拠点の表示が「大ボスを倒すと開く」と言っている
R.beaconHelpText = await pg.evaluate(()=>{
  S.beacons=[]; S.startDepth=1;
  if(!S.hero) S.hero=newHero();
  setScreen('town');
  const locked=el('startdepth').textContent.replace(/\s+/g,' ');
  S.beacons=[10]; S.startDepth=11;
  setScreen('town');
  const open=el('startdepth').textContent.replace(/\s+/g,' ');
  S.beacons=[]; S.startDepth=1; setScreen('town');
  return {locked, open,
          saysBoss: locked.includes('大ボス') && locked.includes('第11階層'),
          saysOutfit: open.includes('引き上げ') && open.includes('支給'),
          ok: locked.includes('大ボス') && open.includes('支給')};
});

await done(b, errs, R);
