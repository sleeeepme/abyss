// 潜在の作り直し。
//
//  ・レア度4段階（コモン/アンコモン/レア/エピック）で効き目が変わる
//  ・大ボスはコモンを出さず、レア以上を1つ確定させる
//  ・「常に +x%」ではない潜在を10種追加（時間差・条件付き・別枠）
//  ・死んだときに引き継げる数（祭壇＋継承の潜在＋広告）
//  ・慰霊碑：秘石で失った仲間を呼び戻す（全滅していても）
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. レア度 ================= */

// 1-a. 4段階あり、レア度が上がるほど強い（全潜在で単調）
R.rarity = await pg.evaluate(()=>{
  const bad=[];
  BOONS.forEach(d=>{
    if(d.v.length!==BOON_RAR.length){ bad.push(d.id+':長さ'+d.v.length); return; }
    // 守護だけは「短いほど強い」ので単調減少が正しい
    const rising = d.id!=='aegis';
    // それ以外は全部「レア度が上がれば必ず強くなる」——
    // 同じ値が並ぶと、そのレア度が嘘になる（見て損した気持ちだけが残る）
    for(let i=1;i<d.v.length;i++){
      const okStep = rising ? d.v[i] > d.v[i-1] : d.v[i] < d.v[i-1];
      if(!okStep) bad.push(d.id+':'+d.v.join('/'));
    }
  });
  return {kinds:BOONS.length, rarities:BOON_RAR.map(r=>r.nm), bad,
          allFour: BOONS.every(d=>d.v.length===4),
          monotone: bad.length===0,
          ok: bad.length===0 && BOON_RAR.length===4};
});

// 1-b. 同じ潜在でもレア度で効き目が変わる（実際のステータスで見る）
R.rarityApplies = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  const rows=BOON_RAR.map(r=>{
    S.hero.boons=[{id:'atk', rar:r.id}];
    return {rar:r.id, atk:+stats(S.hero).atk.toFixed(2), v:boonValue('atk',r.id)};
  });
  S.hero.boons=[];
  const base=+stats(S.hero).atk.toFixed(2);
  const rises=rows.every((r,i)=>i===0||r.atk>rows[i-1].atk);
  return {base, rows, rises,
          epicBeatsCommon: rows[3].atk > rows[0].atk*1.2,
          ok: rises && rows[0].atk>base && rows[3].atk>rows[0].atk*1.2};
});

// 1-c. 大ボスはコモンを出さず、レア以上を1つ確定
R.bossFloor = await pg.evaluate(()=>{
  const tally={};
  const runs=400;
  for(const src of ['mid','great','final','unique']){
    let common=0, hasRare=0;
    for(let i=0;i<runs;i++){
      const bs=rollBoons(src, BOON_CHOICES);
      if(bs.some(b=>b.rar==='common')) common++;
      if(bs.some(b=>BOON_RAR_I[b.rar]>=2)) hasRare++;
    }
    tally[src]={commonRuns:common, rarePlusRuns:hasRare, runs};
  }
  return {tally,
          greatNoCommon: tally.great.commonRuns===0,
          finalNoCommon: tally.final.commonRuns===0,
          greatAlwaysRare: tally.great.rarePlusRuns===runs,
          finalAlwaysRare: tally.final.rarePlusRuns===runs,
          // 中ボス・ユニークではコモンも出る（差がないと大ボスの価値が出ない）
          midHasCommon: tally.mid.commonRuns>0,
          ok: tally.great.commonRuns===0 && tally.final.commonRuns===0
              && tally.great.rarePlusRuns===runs && tally.final.rarePlusRuns===runs
              && tally.mid.commonRuns>0};
});

// 1-d. 3択それぞれが個別にレア度を引く（全部同じにならない）
R.rarityVaries = await pg.evaluate(()=>{
  let mixed=0;
  for(let i=0;i<300;i++){
    const bs=rollBoons('mid', BOON_CHOICES);
    if(new Set(bs.map(b=>b.rar)).size>1) mixed++;
  }
  return {mixedRuns:mixed, of:300, varies: mixed>150, ok: mixed>150};
});

/* ================= 2. 追加した10種 ================= */

R.newKinds = await pg.evaluate(()=>{
  const want=['renew','xp','gold','kin','aegis','pristine','banner','phoenix','thorns','legacy'];
  const missing=want.filter(id=>!boonDef(id));
  let seen=new Set();
  for(let i=0;i<600;i++) rollBoons('mid',3).forEach(b=>seen.add(b.id));
  const notRolled=want.filter(id=>!seen.has(id));
  return {want, missing, notRolled,
          allDefined: missing.length===0,
          allRollable: notRolled.length===0,
          ok: missing.length===0 && notRolled.length===0};
});

// 2-a. 再生：一定間隔でHPが戻る
R.renew = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(12);
  TH.clearEnemies(); TH.immortal();
  S.hero.boons=[{id:'renew', rar:'epic'}];
  const max=stats(S.hero).maxHp;
  S.hero.hpNow=Math.round(max*0.4);
  const start=S.hero.hpNow;
  stepSim(RENEW_EVERY-0.5);
  const beforePulse=S.hero.hpNow;
  stepSim(1.0);
  const afterPulse=S.hero.hpNow;
  stepSim(RENEW_EVERY*3);
  const later=S.hero.hpNow;
  return {max, start, beforePulse, afterPulse, later,
          quietBeforePulse: beforePulse===start,
          pulsed: afterPulse>start,
          keepsPulsing: later>afterPulse,
          neverOverfills: later<=max,
          ok: beforePulse===start && afterPulse>start && later>afterPulse && later<=max};
});

// 2-b. 経験値・お金
R.xpGold = await pg.evaluate(()=>{
  const mk=(boons)=>{
    TH.run(1,{seed:7}); TH.floor(14);
    S.hero.boons=boons; S.hero.lv=20; S.hero.xp=0;
    S.run.gold=0;
    const e=W.enemies.find(x=>!x.boss && !x.dead);
    e.hp=1; killEnemy(e);
    return {xp:+S.hero.xp.toFixed(2), gold:S.run.gold};
  };
  const plain=mk([]);
  const withXp=mk([{id:'xp', rar:'epic'}]);
  const withGold=mk([{id:'gold', rar:'epic'}]);
  return {plain, withXp, withGold,
          xpUp: withXp.xp > plain.xp,
          goldUp: withGold.gold > plain.gold,
          xpRatio:+(withXp.xp/plain.xp).toFixed(2),
          ok: withXp.xp>plain.xp && withGold.gold>plain.gold};
});

// 2-c. 眷属：勝手に敵を撃つ
R.kin = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(16);
  TH.immortal();
  S.hero.boons=[{id:'kin', rar:'epic'}];
  // 的を1体だけ、射程の内側に置く
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  W.enemies=[e]; e.x=P.x+2.0; e.y=P.y; e.maxHp=e.hp=999999; e.atkV=0; e.ms=0;
  S.hero.equip.weapon=null;             // 素手にして、殴りと区別する
  const hp0=e.hp;
  const noKin=(()=>{ S.hero.boons=[]; stepSim(KIN_CD*2.5); const d=hp0-e.hp; e.hp=hp0; return d; })();
  S.hero.boons=[{id:'kin', rar:'epic'}];
  stepSim(KIN_CD*2.5);
  const withKin=hp0-e.hp;
  const orb=!!(S.hero.kin && S.hero.kin.x!==undefined);
  return {noKin, withKin, orb,
          kinHits: withKin > noKin,
          orbExists: orb,
          ok: withKin>noKin && orb};
});

// 2-d. 守護：一定間隔で1発だけ完全に防ぐ
R.aegis = await pg.evaluate(()=>{
  TH.run(1,{seed:13}); TH.floor(14);
  TH.clearEnemies();
  S.hero.boons=[{id:'aegis', rar:'epic'}];
  P.invuln=0;
  const cd=boonSum(S.hero,'aegis');
  S.hero.hpNow=stats(S.hero).maxHp;
  const noShieldYet = !S.hero.aegisUp;
  stepSim(cd+0.5);
  const up = !!S.hero.aegisUp;
  const hp0=S.hero.hpNow;
  hitPlayer(null, 30, 'blunt', 5);        // 1発目は消える
  const blocked = S.hero.hpNow===hp0 && !S.hero.aegisUp;
  hitPlayer(null, 30, 'blunt', 5);        // 2発目は通る
  const through = S.hero.hpNow<hp0;
  // 重ねがけは足し算ではなく最小値（短いほど強いので）
  S.hero.boons=[{id:'aegis', rar:'common'},{id:'aegis', rar:'epic'}];
  const stacked=boonSum(S.hero,'aegis');
  return {cd, noShieldYet, up, blocked, through, stacked,
          minNotSum: stacked===Math.min(boonValue('aegis','common'), boonValue('aegis','epic')),
          ok: noShieldYet && up && blocked && through
              && stacked===boonValue('aegis','epic')};
});

// 2-e. 万全：HPが満タンのときだけ攻撃力が上がる
R.pristine = await pg.evaluate(()=>{
  TH.run(1,{seed:17}); TH.floor(14);
  S.hero.boons=[{id:'pristine', rar:'epic'}];
  const max=stats(S.hero).maxHp;
  S.hero.hpNow=max;
  const full=+stats(S.hero).atk.toFixed(2);
  S.hero.hpNow=max-1;
  const hurt=+stats(S.hero).atk.toFixed(2);
  S.hero.boons=[];
  S.hero.hpNow=max;
  const none=+stats(S.hero).atk.toFixed(2);
  return {full, hurt, none, v:boonValue('pristine','epic'),
          bonusAtFull: full>hurt,
          hurtEqualsNone: Math.abs(hurt-none)<0.01,
          ok: full>hurt && Math.abs(hurt-none)<0.01};
});

// 2-f. 旗印：味方全員に乗る（持ち主だけではない）
R.banner = await pg.evaluate(()=>{
  TH.run(1,{seed:19}); TH.floor(16);
  const a=makeAlly(16,S.hero); a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  S.hero.boons=[];
  const before={ally:+allyStats(a).atk.toFixed(2), hp:allyStats(a).maxHp};
  S.hero.boons=[{id:'banner', rar:'epic'}];
  const after={ally:+allyStats(a).atk.toFixed(2), hp:allyStats(a).maxHp};
  // 仲間が持っていても全員に配られる
  S.hero.boons=[]; a.boons=[{id:'banner', rar:'epic'}];
  const fromAlly=+allyStats(a).atk.toFixed(2);
  a.boons=[];
  return {before, after, fromAlly,
          liftsAllies: after.ally>before.ally && after.hp>before.hp,
          worksFromAlly: fromAlly>before.ally,
          ok: after.ally>before.ally && after.hp>before.hp && fromAlly>before.ally};
});

// 2-g. 不死鳥：1度だけ死なない。2度目は死ぬ。
R.phoenix = await pg.evaluate(()=>{
  TH.run(1,{seed:23}); TH.floor(18);
  TH.clearEnemies();
  S.hero.boons=[{id:'phoenix', rar:'epic'}];
  S.hero.phoenixUsed=false;
  P.invuln=0;
  S.hero.hpNow=1;
  hitPlayer(null, 99999, 'blunt', 9);
  const survived = !!S.hero && S.hero.hpNow>0;
  const hpAfter = S.hero ? S.hero.hpNow : 0;
  const used = S.hero ? S.hero.phoenixUsed : null;
  // 2度目
  P.invuln=0; S.hero.hpNow=1;
  hitPlayer(null, 99999, 'blunt', 9);
  const diedSecond = !S.hero;
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  return {survived, hpAfter, used, diedSecond,
          onceOnly: survived && diedSecond,
          ok: survived && used===true && diedSecond};
});

// 2-h. 棘：受けたダメージを反射
R.thorns = await pg.evaluate(()=>{
  TH.run(1,{seed:29}); TH.floor(16);
  const mk=(boons)=>{
    TH.run(1,{seed:29}); TH.floor(16);
    S.hero.boons=boons; P.invuln=0;
    const e=W.enemies.find(x=>!x.boss && !x.dead);
    W.enemies=[e]; e.x=P.x+0.5; e.y=P.y; e.maxHp=e.hp=999999;
    e.atkV=40; e.lv=10;
    S.hero.hpNow=stats(S.hero).maxHp*50;
    const hp0=e.hp;
    hitPlayer(e);
    return hp0-e.hp;
  };
  const plain=mk([]);
  const spiky=mk([{id:'thorns', rar:'epic'}]);
  return {plain, spiky:+spiky.toFixed(1),
          reflects: spiky>plain,
          ok: spiky>plain};
});

/* ================= 3. 引き継ぎ ================= */

R.legacy = await pg.evaluate(()=>{
  const pad=n=>Array.from({length:n},(_,i)=>({id:BOONS[i%BOONS.length].id, rar:'common'}));
  const setup=(altar, boons)=>{
    TH.run(1,{seed:31}); TH.floor(10);
    S.bld={altar};
    S.hero.boons=boons;
    return boonsInherited();
  };
  // 潜在を十分に積んだ状態（上限に当たらない）で、素直に足し算になるか
  const many=12;
  const none     = setup(0, pad(many));
  const altar2   = setup(2, pad(many));
  const withBoon = setup(0, pad(many).concat([{id:'legacy', rar:'epic'}]));
  const both     = setup(2, pad(many).concat([{id:'legacy', rar:'epic'}]));
  const v=boonValue('legacy','epic');

  /* 上限: 積んだ潜在の半分まで。
     ここが無いと、継承を重ねた時点で「死んでも何も失わない」が作れてしまう。 */
  const capped = setup(9, pad(4));           // 祭壇9 でも 4つのうち2つまで
  const capped2 = setup(9, pad(1));          // 1つしか無ければ最低1つ
  const empty  = setup(9, []);               // 何も持っていなければ 0
  S.bld={};
  return {none, altar2, withBoon, both, v, capped, capped2, empty,
          altarCounts: altar2===2,
          boonAdds: withBoon===v,
          adds: both===2+v,
          halfCap: capped===2,
          keepsOne: capped2===1,
          nothingToKeep: empty===0,
          ok: none===0 && altar2===2 && withBoon===v && both===2+v
              && capped===2 && capped2===1 && empty===0};
});

// 3-b. 死亡画面：レア度の高い順に残り、広告で1つ増える
R.deathLegacy = await pg.evaluate(()=>{
  TH.run(1,{seed:37}); TH.floor(12);
  S.bld={altar:1};
  // 上限は「積んだ潜在の半分」なので、4つ持たせて 2つまで残せる状態にする
  S.hero.boons=[
    {id:'hp',   rar:'common'},
    {id:'atk',  rar:'epic'},
    {id:'ms',   rar:'rare'},
    {id:'def',  rar:'common'},
  ];
  S.hero.hpNow=0;
  die();
  const kept1=(S.legacyBoons||[]).map(b=>b.id);
  const adShown=el('d-ad').style.display!=='none';
  const adLabel=el('d-ad').textContent;
  // 広告を見たことにする
  S.deathAdBonus=1; renderDeathLegacy();
  const kept2=(S.legacyBoons||[]).map(b=>b.id);
  const txt=el('d-lost').textContent;
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  S.bld={};
  return {kept1, kept2, adShown, adLabel,
          bestFirst: kept1.length===1 && kept1[0]==='atk',
          adAddsOne: kept2.length===2 && kept2[1]==='ms',
          saysCount: txt.includes('引き継ぐ'),
          ok: kept1.length===1 && kept1[0]==='atk'
              && kept2.length===2 && kept2[1]==='ms' && adShown};
});

// 3-c. 引き継いだ潜在が次のキャラに乗っている
R.legacyCarries = await pg.evaluate(()=>{
  S.legacyBoons=[{id:'atk', rar:'epic'}];
  const h=newHero();
  const has=(h.boons||[]).some(b=>b.id==='atk' && b.rar==='epic');
  S.hero=h;
  const withIt=stats(h).atk;
  h.boons=[];
  const without=stats(h).atk;
  S.legacyBoons=[];
  return {boons:h.boons, has, withIt:+withIt.toFixed(2), without:+without.toFixed(2),
          carried: has,
          ok: has && withIt>without};
});

/* ================= 4. 慰霊碑 ================= */

R.memorial = await pg.evaluate(()=>{
  TH.run(1,{seed:41}); TH.floor(20);
  S.fallen=[]; S.shards=0;
  const a=makeAlly(20,S.hero); a.lv=22; a.dead=true; a.hpNow=0;
  a.boons=[{id:'atk', rar:'rare'}];
  uniqueAllyName(a,party()); S.hero.party.push(a);
  const name=a.name, lv=a.lv;
  openFallen(a); letFallenGo();
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));

  const carved = (S.fallen||[]).length===1;
  const wiped  = party().length===0;               // 全滅している状態
  const f=S.fallen[0];
  const cost=memCost(f);

  const poor = memRevive(f.uidA);                  // 秘石が足りない
  S.shards = cost;
  const r = memRevive(f.uidA);
  const back = party()[0];
  return {carved, wiped, cost, name, lv,
          refusedWhenPoor: !poor.ok, why:poor.why,
          revived: r.ok, shardsLeft:S.shards,
          keepsName: !!back && back.name===name,
          keepsLevel: !!back && back.lv===lv,
          keepsBoons: !!back && back.boons.length===1 && back.boons[0].rar==='rare',
          noGear: !!back && Object.values(back.equip).every(x=>!x),
          removedFromList: (S.fallen||[]).length===0,
          alive: !!back && !back.dead && back.hpNow>0,
          ok: carved && !poor.ok && r.ok && back && back.name===name && back.lv===lv
              && back.boons.length===1 && Object.values(back.equip).every(x=>!x)
              && S.fallen.length===0};
});

// 4-b. パーティが満員なら断る／画面が描ける
R.memorialUI = await pg.evaluate(()=>{
  TH.run(1,{seed:43}); TH.floor(20);
  S.fallen=[{uidA:9001, job:'warrior', name:'亡き戦士', lv:12,
             str:16,dex:16,vit:16,int:5, boons:[], revived:false, depth:20, t:Date.now()}];
  S.shards=999;
  setScreen('mem');
  const listed = el('memlist').textContent.includes('亡き戦士');
  const sub = (renderTown(), el('m-mem-sub').textContent);
  // 満員にする
  while(party().length<PARTY_MAX){
    const x=makeAlly(20,S.hero); x.hpNow=allyStats(x).maxHp;
    uniqueAllyName(x,party()); S.hero.party.push(x);
  }
  const full=memCheck(S.fallen[0]);
  setScreen('mem');
  const saysFull = el('memlist').textContent.includes('満員');
  // 空ければ呼び戻せる
  S.hero.party.pop();
  const r=memRevive(9001);
  setScreen('town');
  return {listed, sub, fullWhy:full.why, saysFull, revivedAfterRoom:r.ok,
          refusesWhenFull: !full.ok,
          ok: listed && !full.ok && saysFull && r.ok};
});

/* ================= 5. 実プレイで例外なく回る ================= */
R.live = await pg.evaluate(()=>{
  const fails=[];
  try{
    TH.run(1,{seed:47}); TH.floor(24);
    TH.immortal();
    S.hero.boons=[{id:'kin',rar:'epic'},{id:'aegis',rar:'rare'},{id:'renew',rar:'rare'},
                  {id:'banner',rar:'rare'},{id:'thorns',rar:'rare'},{id:'pristine',rar:'rare'},
                  {id:'phoenix',rar:'rare'},{id:'xp',rar:'rare'},{id:'gold',rar:'rare'}];
    for(let i=0;i<2;i++){
      const a=makeAlly(24,S.hero); a.x=P.x; a.y=P.y;
      a.boons=[{id:'kin',rar:'rare'},{id:'aegis',rar:'epic'}];
      uniqueAllyName(a,party()); S.hero.party.push(a);
      a.hpNow=allyStats(a).maxHp;
    }
    W.enemies.slice(0,6).forEach((e,i)=>{ e.x=P.x+Math.cos(i)*2.4; e.y=P.y+Math.sin(i)*2.4; });
    stepSim(8, {draw:true, each:(t)=>{ stickDx=Math.cos(t*0.9); stickDy=Math.sin(t*1.2); }});
    stickDx=0; stickDy=0;
    updateHUD();
    return {failures:fails, alive:!!S.hero, kills:S.run?S.run.kills:0,
            heroKin:!!(S.hero&&S.hero.kin), loopAlive:_tickCount>300,
            ok: !!S.hero && _tickCount>300};
  }catch(e){ fails.push(e.message+' @ '+(e.stack||'').split('\n')[1]); return {failures:fails, ok:false}; }
});

/* ================= 5b. 祭壇 =================
   仕掛けはもともと3択だったのに、**書いてある文章が全部「潜在を1つ授かる」**で、
   読むと「ランダムに1つもらえる」としか取れなかった。
   さらに選択画面が「祭壇を倒した」と出していた（倒していない）。
   文章が仕掛けと違うと、実装が正しくても仕様は伝わらない——
   なのでここでは**文言も検証対象にする**。 */
R.altarPick = await pg.evaluate(()=>{
  TH.run(1,{seed:59}); TH.floor(12);
  // 潜在はキャラに付くので、前の検証ぶんが残っている。ここでは空から見たい。
  S.hero.boons=[];
  W.ev={id:'altar', x:P.x, y:P.y, used:false};
  const hp0=stats(S.hero).maxHp;
  openEvent();
  const evText=el('ev-body').textContent.replace(/\s+/g,' ');
  el('ev-yes').dispatchEvent(new MouseEvent('click',{bubbles:true}));

  const boonOpen=TH.open('m-boon');
  const title=el('boon-title').textContent;
  const sub=el('boon-sub').textContent;
  const rows=el('boon-choices').querySelectorAll('[data-boon]').length;
  const offered=(_boonPending||[]).slice();
  // 実際に1つ選べる
  el('boon-choices').querySelector('[data-boon="1"]')
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const picked=S.hero.boons.length;
  const last=S.hero.boons[S.hero.boons.length-1];
  const gotRight=picked===1 && last && last.id===offered[1].id && last.rar===offered[1].rar;
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  return {evText, title, sub, rows, offered:offered.map(b=>b.id+'/'+b.rar), picked,
          hpPaid: (S.hero.hpDebt||0)>0, hpBefore:hp0, hpAfter:stats(S.hero).maxHp,
          threeChoices: rows===3,
          picksTheOneTapped: gotRight,
          // 文言: 「1つ授かる」ではなく「3つから1つ選べる」と書いてある
          bodySaysChoice: evText.includes('3つの馴れ') && evText.includes('1つを選べる'),
          // 「祭壇を倒した」になっていない
          notKilled: !sub.includes('倒した'),
          subSaysChoice: sub.includes('3つから1つ選ぶ'),
          ok: boonOpen && rows===3 && gotRight && (S.hero.hpDebt||0)>0
              && evText.includes('3つの馴れ') && evText.includes('1つを選べる')
              && !sub.includes('倒した') && sub.includes('3つから1つ選ぶ')};
});

// 5c. 祭壇のレア度は自前の重み（中ボスより出が良い＝恒久HPを払うぶん）
R.altarOdds = await pg.evaluate(()=>{
  const roll=(src)=>{
    let score=0; const runs=600;
    for(let i=0;i<runs;i++)
      rollBoons(src, BOON_CHOICES).forEach(b=>{ score+=BOON_RAR_I[b.rar]; });
    return +(score/(runs*BOON_CHOICES)).toFixed(3);
  };
  const mid=roll('mid'), altar=roll('altar'), great=roll('great');
  return {mid, altar, great,
          wired: !!BOON_SRC.altar,
          betterThanMid: altar>mid,
          // ただし大ボスは超えない（確定枠もボスだけの見返り）
          underGreat: altar<great,
          noFloor: BOON_SRC.altar.floor===0,
          ok: altar>mid && altar<great && BOON_SRC.altar.floor===0};
});

/* ================= 6. 壊れた座標でループが止まらない ================= */
/* 掃引中に一度だけ、仲間の座標が NaN になって solid() が例外を投げ、
   ループごと止まったことがある（再現はしなかったが、落ちたのは事実）。
   毎フレーム回る関数なので、1つの NaN が「フリーズ」と同じ結果になる。
   原因を追い切れていない以上、せめて **落ちないこと**は保証しておく。 */
R.nanSafe = await pg.evaluate(()=>{
  TH.run(1,{seed:53}); TH.floor(14);
  TH.immortal();
  const a=makeAlly(14,S.hero); a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  const before=_tickCount;
  a.x=NaN; a.y=NaN;                       // 壊す
  let threw=null;
  try{ stepSim(1.0, {draw:true}); }catch(e){ threw=e.message; }
  const ranWhileBroken=_tickCount-before;
  const solidNaN = solid(NaN, NaN);
  // 元に戻せば普通に動く
  a.x=P.x+1; a.y=P.y;
  try{ stepSim(1.0, {draw:true}); }catch(e){ threw=threw||e.message; }
  return {threw, ranWhileBroken, solidNaN, ticks:_tickCount-before,
          survived: threw===null,
          nanIsSolid: solidNaN===true,
          keptRunning: _tickCount-before > 100,
          ok: threw===null && solidNaN===true && _tickCount-before>100};
});

/* 祭壇でHPを捧げたとき、潜在の選択画面が**押せる状態で**出ること。
   「開いているか」だけを見るテストでは落ちなかったバグがここにあった——
   .modal は全部同じ z-index なので、DOM の後ろにある m-event が
   m-boon の上に完全に乗っていて、選択画面は on なのに一切触れなかった。
   なので elementFromPoint で「その座標に実際に何が居るか」まで見る。 */
R.altarPick = await pg.evaluate(()=>{
  TH.run(1,{seed:3}); TH.floor(6);
  const hp0 = stats(S.hero).maxHp;
  W.ev={id:'altar', x:P.x, y:P.y, used:false};
  openEvent(W.ev);
  const evOpened = el('m-event').classList.contains('on');
  resolveEvent();
  const boonOpen = el('m-boon').classList.contains('on');
  const evClosed = !el('m-event').classList.contains('on');
  const nodes    = document.querySelectorAll('#boon-choices [data-boon]');
  // 3つとも、その座標をタップしたら自分に当たること
  const covered=[];
  nodes.forEach(n=>{
    const r=n.getBoundingClientRect();
    const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    if(!top || !n.contains(top)) covered.push(top ? (top.id||top.className) : 'null');
  });
  return {evOpened, boonOpen, evClosed, choices:nodes.length, covered,
          hpPaid: stats(S.hero).maxHp < hp0,
          ok: evOpened && boonOpen && evClosed && nodes.length===3 && covered.length===0};
});

// 選んだ潜在が実際に付き、祭壇が使用済みになる
R.altarTakes = await pg.evaluate(()=>{
  const before=(S.hero.boons||[]).length;
  const n=document.querySelector('#boon-choices [data-boon]');
  n.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  return {before, after:(S.hero.boons||[]).length, used:!!W.ev.used,
          closed: !el('m-boon').classList.contains('on'),
          ok: (S.hero.boons||[]).length===before+1 && !!W.ev.used};
});

await done(b, errs, R);
