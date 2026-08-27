// 仲間の専用技を Lv.50 までの5段階へ／大技のリキャスト短縮／大技ボタンが押せること。
//
// Lv.50 の技は全部「自動発動＋リキャスト」。
// このゲームは操作が移動だけで完結しているので、仲間にボタンを足した瞬間に設計が崩れる。
// 狙いは「Lv.50 まで連れ歩いた相手に、そのジョブでしか見られない絵をひとつ持たせる」こと。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 5段階になっているか ================= */

R.fiveTiers = await pg.evaluate(()=>{
  const bad=[];
  const want=[10,20,30,40,50];
  Object.keys(JOB_SKILLS).forEach(job=>{
    const lvs=JOB_SKILLS[job].map(sk=>sk.lv);
    if(JSON.stringify(lvs)!==JSON.stringify(want)) bad.push(job+':'+lvs.join('/'));
    // 効果が空の技は無いこと（名前だけの枠を作らない）
    JOB_SKILLS[job].forEach(sk=>{
      const keys=Object.keys(sk).filter(k=>!['lv','nm','desc'].includes(k));
      if(!keys.length) bad.push(job+' Lv.'+sk.lv+':効果なし');
    });
  });
  return {jobs:Object.keys(JOB_SKILLS).length, bad,
          allFive: bad.length===0,
          total: Object.values(JOB_SKILLS).reduce((n,v)=>n+v.length,0),
          ok: bad.length===0};
});

// 1-b. Lv.50 は全ジョブが大技（召喚士だけは常時効果でよい）
R.artsDefined = await pg.evaluate(()=>{
  const rows=Object.keys(JOB_SKILLS).map(job=>{
    const top=JOB_SKILLS[job].find(sk=>sk.lv===50);
    return {job, nm:top.nm, art:top.art||null, passive:!top.art};
  });
  const withArt=rows.filter(r=>r.art);
  const unknown=withArt.filter(r=>!ALLY_ARTS[r.art]);
  const dupes=withArt.map(r=>r.art).filter((v,i,arr)=>arr.indexOf(v)!==i);
  /* 大技を持たないジョブ＝召喚士（三重召喚）とドゥラントリー（芽吹き）。
     数を書き写すと、ジョブが1つ増えるたびにここだけ嘘になるので、
     **持っていないジョブの側**を名指しで数える。 */
  const PASSIVE_TOP=['summoner','durantree'];
  const want=Object.keys(JOB_SKILLS).length - PASSIVE_TOP.length;
  return {rows, unknown, dupes, want,
          passiveTop: rows.filter(r=>r.passive).map(r=>r.job),
          rightCount: withArt.length===want,
          allKnown: unknown.length===0,
          allDistinct: dupes.length===0,
          ok: withArt.length===want && unknown.length===0 && dupes.length===0};
});

// 1-c. 技は Lv でしか開かない（Lv.49 では出ない）
R.learnedByLevel = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  const a=TH.ally(20,'warrior',49);
  const at49=allySkills(a).length, art49=allySkillSum(a).art;
  a.lv=50;
  const at50=allySkills(a).length, art50=allySkillSum(a).art;
  return {at49, at50, art49, art50,
          fourAt49: at49===4 && !art49,
          fiveAt50: at50===5 && art50==='spin',
          ok: at49===4 && !art49 && at50===5 && art50==='spin'};
});

/* ================= 2. 各ジョブの大技が実際に効く ================= */

/* 共通の舞台。的を1体だけ置き、Lv.50 の仲間を1人立たせる。
   リキャストの初回は散らしてあるので、確実に撃たせるため artCd を 0 にする。 */
const stage = (job, fn)=>pg.evaluate(({job, fnSrc})=>{
  TH.run(1,{seed:11}); TH.floor(20);
  TH.immortal();
  S.hero.lv=40; S.hero.str=44; S.hero.dex=44; S.hero.vit=44;
  const a=TH.ally(20, job, 50);
  a.x=P.x+0.6; a.y=P.y;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=a.x+1.6; e.y=a.y; e.maxHp=e.hp=999999; e.atkV=0; e.ms=0;
  S.hero.equip.weapon=null;                 // 主人公は手出ししない
  a.artCd=0;
  return (new Function('a','e','def','return ('+fnSrc+')(a,e,def)'))(
    a, e, ALLY_ARTS[allySkillSum(a).art]||{});
}, {job, fnSrc:fn.toString()});

// 2-a. 戦士 回転斬り: 周囲をまとめて薙ぐ
R.spin = await stage('warrior', (a,e,def)=>{
  // 的を数体、仲間の周りに置く
  W.enemies=[];
  const mk=(dx,dy)=>{ const c=Object.assign({}, e, {x:a.x+dx, y:a.y+dy, hp:999999, dead:false});
    W.enemies.push(c); return c; };
  const near1=mk(1.2,0), near2=mk(-1.0,0.6), far=mk(6,0);
  stepSim(0.2);
  return {cd:def.cd, near1:999999-near1.hp, near2:999999-near2.hp, far:999999-far.hp,
          hitsAround: near1.hp<999999 && near2.hp<999999,
          sparesFar: far.hp===999999,
          staggered: hasStatus(near1,'stagger'),
          ok: near1.hp<999999 && near2.hp<999999 && far.hp===999999};
});

// 2-b. 重騎士 守護陣: 全員に盾。数発で割れる。
R.bulwark = await stage('knight', (a,e,def)=>{
  stepSim(0.2);
  const heroShield=S.hero.barrier, allyShield=a.barrier;
  const hp0=S.hero.hpNow;
  P.invuln=0;
  hitPlayer(null, 40, 'blunt', 5);           // 1発目：盾が受ける
  const blocked=S.hero.hpNow===hp0 && S.hero.barrier===heroShield-1;
  for(let i=0;i<BULWARK_HITS;i++) hitPlayer(null, 40, 'blunt', 5);
  const through=S.hero.hpNow<hp0 && !(S.hero.barrier>0);
  return {heroShield, allyShield, blocked, through, hits:BULWARK_HITS,
          coversParty: heroShield===BULWARK_HITS && allyShield===BULWARK_HITS,
          breaks: through,
          ok: heroShield===BULWARK_HITS && allyShield===BULWARK_HITS && blocked && through};
});

/* 2-c. 狩人 矢の雨: 攻撃範囲内へ 25 本。
       五月雨（前方5方向の扇）から差し替えた——扇は前にしか届かず、
       囲まれたときに一番効いてほしい技が一番効かなかった。

       **弾（ashot）にはしない。** 25発を飛ばすと画面の弾数を食って
       後半の弾幕と競合するので、着弾だけを予約する形にしてある。 */
R.rain = await stage('hunter', (a,e,def)=>{
  W.arts=[]; W.fx=[];
  stepSim(0.05);
  const drops=W.arts.filter(f=>f.kind==='arrow');
  const shots=W.fx.filter(f=>f.t==='ashot'||f.t==='pshot').length;
  const st=allyStats(a);
  const far=Math.max(...drops.map(f=>Math.hypot(f.x-e.x, f.y-e.y)));
  const uniq=new Set(drops.map(f=>f.x.toFixed(2)+','+f.y.toFixed(2))).size;
  // 落ちる前は当たらない（予兆の時間がある）
  const hp0=e.hp;
  const beforeLanding = e.hp===hp0;
  stepSim(2.0);
  const dealt=hp0-e.hp;
  return {count:drops.length, want:RAIN_ARROWS, shots, uniq,
          far:+far.toFixed(2), reach:+Math.max(3.0, st.range).toFixed(2), dealt,
          rightCount: drops.length===RAIN_ARROWS,
          scattered: uniq===RAIN_ARROWS,
          insideRange: far <= Math.max(3.0, st.range)+0.01,
          spendsNoProjectiles: shots===0,
          landsAndHurts: dealt>0,
          ok: drops.length===RAIN_ARROWS && uniq===RAIN_ARROWS
              && far <= Math.max(3.0, st.range)+0.01 && shots===0 && dealt>0};
});

// 2-d. 魔法使い 焦土: 燃え続ける地面。時間で消える。
R.field = await stage('mage', (a,e,def)=>{
  W.arts=[];
  stepSim(0.2);
  const laid=W.arts.filter(f=>f.kind==='field').length;
  e.x=W.arts[0].x; e.y=W.arts[0].y;          // 的を炎の中へ
  const hp0=e.hp;
  stepSim(2.0);
  const burned=hp0-e.hp;
  stepSim(8.0);                              // 継続時間を超えて回す
  const gone=W.arts.filter(f=>f.kind==='field').length===0;
  return {laid, burned, gone,
          keepsBurning: burned>0,
          expires: gone,
          // 段階的に範囲が広がる（30→40 で nova が伸びる）
          novaAt30: (()=>{ const m=TH.ally(20,'mage',30); return allySkillSum(m).nova; })(),
          novaAt40: (()=>{ const m=TH.ally(20,'mage',40); return allySkillSum(m).nova; })(),
          ok: laid===1 && burned>0 && gone};
});

// 2-e. 盗賊 幻影: 一定時間、攻撃を受けない
R.vanish = await stage('rogue', (a,e,def)=>{
  stepSim(0.2);
  const on=a.iframe>0;
  const hp0=a.hpNow;
  hitAlly(a, {lv:40, atkV:9999, dt:'blunt', dead:false});
  const immune=a.hpNow===hp0;
  stepSim(VANISH_SEC+0.5);
  const off=!(a.iframe>0);
  a.hpNow=allyStats(a).maxHp;
  const hp1=a.hpNow;
  // 切れたあとは通る（回避を引かないよう十分な回数を叩く）
  let took=false;
  for(let i=0;i<40 && !took;i++){ hitAlly(a,{lv:40,atkV:50,dt:'blunt',dead:false}); took=a.hpNow<hp1; }
  return {on, immune, off, took, secs:VANISH_SEC,
          ok: on && immune && off && took};
});

// 2-f. 僧侶 恩寵: 一定時間、全員が回復し続ける
R.grace = await stage('priest', (a,e,def)=>{
  S.hero.hpNow=Math.round(stats(S.hero).maxHp*0.3);
  a.hpNow=Math.round(allyStats(a).maxHp*0.3);
  a.prayCd=999;                              // 通常の祈りと区別する
  const h0=S.hero.hpNow, a0=a.hpNow;
  stepSim(0.2);
  const on=a.graceT>0;
  stepSim(GRACE_SEC*0.6);
  const h1=S.hero.hpNow, a1=a.hpNow;
  stepSim(GRACE_SEC);
  const off=!(a.graceT>0);
  return {h0, h1, a0, a1, on, off,
          healsHero: h1>h0, healsSelf: a1>a0, expires: off,
          ok: on && h1>h0 && a1>a0 && off};
});

// 2-g. 聖騎士 聖域: 全員の全能力が上がる／Lv.40 の癒しの輪
R.sanctuary = await stage('paladin', (a,e,def)=>{
  const before={atk:+stats(S.hero).atk.toFixed(2), hp:stats(S.hero).maxHp};
  stepSim(0.2);
  const on=!!(S.run && S.run.sanct);
  const during={atk:+stats(S.hero).atk.toFixed(2), hp:stats(S.hero).maxHp};
  stepSim(SANCT_SEC+1);
  const after={atk:+stats(S.hero).atk.toFixed(2), hp:stats(S.hero).maxHp};

  // Lv.40 の癒しの輪：そばにいる味方が少しずつ回復する
  const p40=TH.ally(20,'paladin',40);
  p40.x=P.x; p40.y=P.y; uniqueAllyName(p40,party()); S.hero.party.push(p40);
  p40.artCd=999;
  S.hero.hpNow=Math.round(stats(S.hero).maxHp*0.4);
  const hh0=S.hero.hpNow;
  stepSim(2.0);
  const halo=S.hero.hpNow>hh0;
  return {before, during, after, on, halo, pct:SANCT_PCT,
          liftsAll: during.atk>before.atk && during.hp>before.hp,
          expires: Math.abs(after.atk-before.atk)<0.01,
          haloHeals: halo,
          ok: on && during.atk>before.atk && during.hp>before.hp
              && Math.abs(after.atk-before.atk)<0.01 && halo};
});

// 2-h. 召喚士 三重召喚: 使い魔が3体
R.summon3 = await stage('summoner', (a,e,def)=>{
  stepSim(0.5);
  const n=(a.fams||[]).length;
  const at20=(()=>{ const m=TH.ally(20,'summoner',20); return 1+allySkillSum(m).famCount; })();
  return {fams:n, want:1+allySkillSum(a).famCount, at20,
          three: n===3,
          growsWithLevel: at20<3,
          ok: n===3 && at20<3};
});

// 2-i. 大魔導士 崩落: 高ダメージの範囲技
R.collapse = await stage('archmage', (a,e,def)=>{
  W.enemies=[];
  const mk=(dx,dy)=>{ const c=Object.assign({}, e, {x:e.x+dx, y:e.y+dy, hp:999999, dead:false});
    W.enemies.push(c); return c; };
  const c1=mk(0,0), c2=mk(1.4,0.6), far=mk(9,0);
  stepSim(0.2);
  return {c1:999999-c1.hp, c2:999999-c2.hp, far:999999-far.hp,
          hitsCluster: c1.hp<999999 && c2.hp<999999,
          sparesFar: far.hp===999999,
          hitsHard: (999999-c1.hp) > 0,
          ok: c1.hp<999999 && c2.hp<999999 && far.hp===999999};
});

// 2-j. リキャストがあり、撃ちっぱなしにならない
R.recast = await pg.evaluate(()=>{
  TH.run(1,{seed:13}); TH.floor(20);
  TH.immortal();
  const a=TH.ally(20,'warrior',50);
  a.x=P.x; a.y=P.y; uniqueAllyName(a,party()); S.hero.party.push(a);
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=a.x+1.2; e.y=a.y; e.maxHp=e.hp=1e9; e.atkV=0; e.ms=0;
  S.hero.equip.weapon=null;
  const cd=ALLY_ARTS.spin.cd;
  /* 「撃った瞬間」は artCd が跳ね上がったフレームで数える。
     しきい値で見ると、1/60 ずつ減るあいだ何フレームも条件に当たって
     1回の発動が3〜4回に数えられる（実際そうなって 12 と出た）。 */
  let fires=0, prev=0;
  a.artCd=0;
  stepSim(cd*3+1, {after:()=>{ if(a.artCd>prev+0.5) fires++; prev=a.artCd; }});
  return {cd, fires,
          // 3周期ぶん回して 3〜4 回。毎フレーム出ていない。
          throttled: fires>=3 && fires<=5,
          ok: fires>=3 && fires<=5};
});

/* ================= 3. 大技のリキャスト短縮 ================= */

R.ultCdr = await pg.evaluate(()=>{
  TH.run(1,{seed:17}); TH.floor(20);
  S.greatKills=4;                            // 大技はここまで解放されている
  S.ultLv={quake:1}; S.ult='quake';
  const u=ultEquipped();
  if(!u) return {skipped:true, ok:false};
  const base=ultCooldown(u);

  // 潜在
  S.hero.boons=[{id:'ultcdr', rar:'epic'}];
  const withBoon=ultCooldown(u);
  S.hero.boons=[];

  // 装備（接尾辞「早鐘」）
  const it=genBaseItem('sword',20,0); it.ident=true;
  it.aff=[{t:'s', id:'haste', nm:'早鐘', stat:'ultCdr', v:12}];
  S.hero.equip.weapon=it;
  const withGear=ultCooldown(u);
  S.hero.equip.weapon=null;

  // そばにいる盗賊 Lv.40
  const r=TH.ally(20,'rogue',40);
  r.x=P.x; r.y=P.y; uniqueAllyName(r,party()); S.hero.party.push(r);
  const withRogue=ultCooldown(u);
  r.x=P.x+30; r.y=P.y;                       // 離れると効かない
  const awayRogue=ultCooldown(u);

  // 全部盛りでも下限を割らない
  r.x=P.x; r.y=P.y;
  S.hero.boons=[{id:'ultcdr',rar:'epic'},{id:'ultcdr',rar:'epic'},{id:'ultcdr',rar:'epic'}];
  S.hero.equip.weapon=it;
  S.ultLv={quake:5};
  const stacked=ultCooldown(u);
  S.hero.boons=[]; S.hero.equip.weapon=null; S.ultLv={quake:1};
  return {base:+base.toFixed(2), withBoon:+withBoon.toFixed(2),
          withGear:+withGear.toFixed(2), withRogue:+withRogue.toFixed(2),
          awayRogue:+awayRogue.toFixed(2), stacked:+stacked.toFixed(2),
          floor:+(u.cd*ULT_CDR_FLOOR).toFixed(2),
          boonShortens: withBoon<base,
          gearShortens: withGear<base,
          rogueShortens: withRogue<base,
          rogueNeedsToBeNear: awayRogue>withRogue,
          neverBelowFloor: stacked >= u.cd*ULT_CDR_FLOOR-0.01,
          ok: withBoon<base && withGear<base && withRogue<base
              && awayRogue>withRogue && stacked>=u.cd*ULT_CDR_FLOOR-0.01};
});

// 3-b. 接尾辞と潜在が一覧に載っている
R.cdrListed = await pg.evaluate(()=>{
  const suf=SUFFIX.find(x=>x.stat==='ultCdr');
  const bn=boonDef('ultcdr');
  let rolled=0;
  for(let i=0;i<400;i++) if(rollBoons('mid',3).some(b=>b.id==='ultcdr')) rolled++;
  return {suffix:suf&&suf.nm, boon:bn&&bn.nm, statName:STATNM.ultCdr, rolled,
          suffixExists: !!suf, boonExists: !!bn,
          boonRollable: rolled>0,
          readable: !!STATNM.ultCdr,
          ok: !!suf && !!bn && rolled>0 && !!STATNM.ultCdr};
});

/* ================= 4. 大技ボタンが本当に押せる =================
   これまでの検証は fireUlt() を直接呼んでいたので、
   **ボタンが押せるかどうかは一度も試していなかった**。
   実際 #hud が pointer-events:none で、#ultbtn だけ auto に戻し忘れており、
   PC ではクリックが下のキャンバスへ抜けて何も起きなかった。
   同じ穴を二度開けないよう、ここでは必ず「実際に押す」。 */
const clickUlt = async (page)=>{
  await page.evaluate(()=>{
    S.hero=newHero(); S.upg={hp:8}; S.hero.lv=30;
    S.greatKills=4; S.ultLv={quake:1}; S.ult='quake';
    startRun(12); S.hero.party=[];
    P.ultCd=0; W.fx=[]; updateHUD();
  });
  await page.waitForTimeout(150);
  const before=await page.evaluate(()=>({
    ready:ultReady(), cd:P.ultCd,
    hittable:(()=>{ const n=document.getElementById('ultbtn');
      const r=n.getBoundingClientRect();
      const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      return !!top && (top===n || n.contains(top)); })()
  }));
  let err=null;
  try{ await page.click('#ultbtn', {timeout:2500}); }
  catch(e){ err=e.message.split('\n')[0]; }
  await page.waitForTimeout(120);
  const after=await page.evaluate(()=>({cd:+P.ultCd.toFixed(1),
    ring:W.fx.filter(f=>f.t==='ultring').length}));
  return {before, err, after, fired: after.cd>0 && after.ring>0};
};

// 4-a. スマホ（このスイートの既定のブラウザ）
R.ultTapPhone = await (async ()=>{
  const r=await clickUlt(pg);
  return {...r, ok: r.before.hittable && !r.err && r.fired};
})();

// 4-b. PC（タッチ無し・マウス）。バグが出ていたのはこちら。
R.ultClickPC = await (async ()=>{
  const { chromium } = await import('playwright');
  const path = await import('path');
  const b2=await chromium.launch();
  const pg2=await (await b2.newContext({viewport:{width:1280,height:800},
                                        hasTouch:false, isMobile:false})).newPage();
  const errs2=[];
  pg2.on('pageerror',e=>errs2.push(String(e.message)));
  await pg2.goto('file://'+path.resolve('proto/index.html'));
  await pg2.waitForTimeout(400);
  const r=await clickUlt(pg2);
  await b2.close();
  return {...r, errs:errs2, ok: r.before.hittable && !r.err && r.fired && !errs2.length};
})();

// 4-c. HUD の押せる要素が全部 pointer-events:auto を持っている
R.hudHittable = await pg.evaluate(()=>{
  setScreen('game');
  el('hud').classList.add('on');
  el('prompt').style.display='block';
  el('ultbtn').classList.add('on');
  // 探索中の「？」は畳み、ステータスの 🧍 を足した
  const ids=['ultbtn','prompt','bagbtn','statbtn'];
  const bad=ids.filter(id=>{
    const n=el(id); if(!n) return true;
    return getComputedStyle(n).pointerEvents==='none';
  });
  return {ids, bad, allAuto: bad.length===0, ok: bad.length===0};
});

/* ================= 5. 左上の表示が重ならない =================
   技が一斉に出るとログが3行出るので、仲間3人ぶんのHPバーと敵の情報パネルに
   必ずぶつかる。実際にぶつかっていて、3つの文字が同じ場所に重なって
   どれも読めない状態になっていた。目でしか分からない類なので、
   DOM の矩形が交差していないかで見る。 */
R.logNoOverlap = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); TH.floor(12); TH.immortal();
  S.hero.lv=44;
  ['knight','mage','paladin'].forEach((job,i)=>{
    const a=TH.ally(12,job,50); a.slot=i;
    a.x=P.x+Math.cos(i*2); a.y=P.y+Math.sin(i*2);
    uniqueAllyName(a,party()); S.hero.party.push(a); a.artCd=0;
  });
  const e=W.enemies[0]; if(e){ e.x=P.x+1.4; e.y=P.y; P.target=e; }   // 情報パネルも出す
  stepSim(1.2);
  logs.length=0;
  log('◈ テスト行 1'); log('◈ テスト行 2'); log('◈ テスト行 3');
  updateHUD();
  const rect = id => { const n=el(id);
    return (n && n.style.display!=='none') ? n.getBoundingClientRect() : null; };
  const hit = (a,c) => !!a && !!c && a.width>0 && c.width>0 &&
    a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
  const lg = rect('log');
  const clash = ['partybar','targetinfo','intruder'].filter(id=>hit(lg, rect(id)));
  return {top: Math.round(lg.top), lines: logs.length,
          partyShown: el('partybar').style.display==='flex',
          clash, ok: clash.length===0 && logs.length===3};
});

/* 5-b. 何も出ていないときは元の高さに戻る（下がりっぱなしにならない）。
       測り直しは1フレームに1回なので、**フレームを進めてから**測る。
       敵は片付ける——自動で狙い直すので、P.target を消すだけでは
       次のフレームで情報パネルが戻ってくる。 */
R.logResets = await pg.evaluate(()=>{
  S.hero.party=[]; TH.clearEnemies(); P.target=null;
  stepSim(0.1);
  const t=Math.round(el('log').getBoundingClientRect().top);
  return {top:t, ok: t<=170};
});

// 5-c. 雑魚の名前は狙っている1体だけ（乱戦で足元が文字の山にならない）
R.enemyLabels = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(9); TH.immortal();
  const near=W.enemies.slice(0,4);
  near.forEach((e,i)=>{ e.x=P.x+1+i*0.4; e.y=P.y+0.3; e.elite=false; e.uniq=false; });
  W.enemies=near;
  const seen=[]; const orig=window.label;
  window.label=(t,...r)=>{ seen.push(t); return orig(t,...r); };
  P.target=near[0]; draw();
  window.label=orig;
  const shown=near.map(e=>e.name).filter(n=>seen.includes(n));
  return {near:near.length, shown:shown.length, ok: shown.length<=1};
});

await done(b, errs, R);
