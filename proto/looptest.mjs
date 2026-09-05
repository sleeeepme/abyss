// 道中の飽き対策（イベント／踏破済み階層）・仲間の個体差・秘石の3点を検証する。
// 「帰還したあと 1-10 階が退屈」「同ジョブが同じ動きで重なる」
// 「死ぬと何も伸びない」— それぞれが実際に解けているかを見る。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ================= 1. 道中のイベント ================= */

// 1-a. 出現率がだいたい設計値で、ボス階には絶対に出ない
R.evRate = await pg.evaluate(()=>{
  let hit=0, n=0, bossFloors=0, bossHit=0;
  for(let d=1;d<=40;d++) for(let s=0;s<40;s++){
    RNG=mulberry32(d*7919+s);
    const fl=genFloor(d);
    const ev=spawnEvent(fl,d);
    if(bossTierAt(d)){ bossFloors++; if(ev) bossHit++; }
    else { n++; if(ev) hit++; }
  }
  return {rate:+((hit/n)*100).toFixed(1), want:EVENT_CHANCE*100,
          nearTarget: Math.abs(hit/n - EVENT_CHANCE) < 0.06,
          bossFloors, bossHit, neverOnBoss: bossHit===0};
});

// 1-b. 置かれる場所は開始部屋以外の床の上（壁に埋まらない）
R.evPlacement = await pg.evaluate(()=>{
  let placed=0, inWall=0, inStart=0;
  for(let d=1;d<=30;d++) for(let s=0;s<20;s++){
    RNG=mulberry32(d*104729+s);
    const fl=genFloor(d);
    const ev=spawnEvent(fl,d);
    if(!ev) continue;
    placed++;
    if(fl.g[Math.floor(ev.y)][Math.floor(ev.x)]===T.WALL) inWall++;
    if(Math.floor(ev.x)===fl.start.cx && Math.floor(ev.y)===fl.start.cy) inStart++;
  }
  return {placed, inWall, inStart, allOnFloor:inWall===0, avoidsStart:inStart===0,
          kinds:EVENTS.length, allKindsHaveText:
            EVENTS.every(e=>e.nm&&e.sub&&e.body&&e.yes&&e.no&&e.icon&&e.col)};
});

// 1-c. 忘れられた荷 — 装備が増え、代償として敵が湧く
R.evCache = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(7);
  W.enemies.length=0; W.drops.length=0;
  W.ev={id:'cache', x:P.x, y:P.y, used:false};
  resolveEvent();
  return {drops:W.drops.filter(d=>d.it).length, enemies:W.enemies.length,
          used:W.ev.used, closed:!document.getElementById('m-event').classList.contains('on'),
          ok: W.drops.filter(d=>d.it).length===3 && W.enemies.length===4 && W.ev.used};
});

// 1-d. 癒しの泉 — 全員全快・状態異常解除、代償に敵が速くなる
R.evSpring = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(9); S.hero.party=[];
  for(let i=0;i<2;i++){
    const a=makeAlly(9,S.hero); a.x=P.x; a.y=P.y;
    uniqueAllyName(a,party()); S.hero.party.push(a);
    a.hpNow=3; a.st={burn:{t:5,v:3}};
  }
  S.hero.hpNow=5; S.run.pst={burn:{t:9,v:4}};
  W.enemies.length=0;
  // 動かない種別（ms=0）が混じると 1.25 倍しても 0 のままなので、動く個体だけで測る
  W.enemies.push(...spawnEnemies(W.fl, 9).filter(e=>e.ms>0).slice(0,3));
  const msBefore=W.enemies.map(e=>+e.ms.toFixed(3));
  const before={hero:Math.round(S.hero.hpNow), allies:party().map(a=>Math.round(a.hpNow))};
  W.ev={id:'spring', x:P.x, y:P.y, used:false};
  resolveEvent();
  const msAfter=W.enemies.map(e=>+e.ms.toFixed(3));
  return {before, heroAfter:Math.round(S.hero.hpNow),
          heroFull: Math.round(S.hero.hpNow)===stats(S.hero).maxHp,
          alliesFull: party().every(a=>Math.round(a.hpNow)===allyStats(a).maxHp),
          statusCleared: Object.keys(S.run.pst).length===0
                      && party().every(a=>Object.keys(a.st).length===0),
          msBefore, msAfter,
          enemiesFaster: msAfter.every((v,i)=>v>msBefore[i]*1.2)};
});

// 1-e. 古びた祭壇 — 最大HPを恒久的に払って潜在を1つ
R.evAltar = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(6);
  const hpBefore=stats(S.hero).maxHp;
  S.hero.hpNow=hpBefore;
  W.ev={id:'altar', x:P.x, y:P.y, used:false};
  resolveEvent();
  const hpAfter=stats(S.hero).maxHp;
  return {hpBefore, hpAfter, debt:S.hero.hpDebt,
          shrunk: hpAfter < hpBefore,
          ratio:+(hpAfter/hpBefore).toFixed(2),
          hpNowClamped: S.hero.hpNow<=hpAfter,
          boonPickOpened: document.getElementById('m-boon').classList.contains('on'),
          used:W.ev.used};
});

// 1-f. HPの負債は積み上がるが下限がある（0にはならない）
R.altarFloor = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8};
  const full=stats(S.hero).maxHp;
  const seq=[];
  for(let i=0;i<8;i++){ S.hero.hpDebt=(S.hero.hpDebt||0)+0.2; seq.push(stats(S.hero).maxHp); }
  return {full, seq, alwaysPositive: seq.every(v=>v>0),
          monotone: seq.every((v,i)=>i===0||v<=seq[i-1]),
          floorReached: seq[seq.length-1] >= Math.round(full*0.4*0.98)};
});

// 1-g. 賭博の壺 — 未鑑定品を1つ食べ、55%でレア度が上がる
R.evUrn = await pg.evaluate(()=>{
  let up=0, lost=0, trials=200;
  for(let i=0;i<trials;i++){
    RNG=mulberry32(i*7919+13);
    S.hero=newHero(); S.upg={hp:8}; startRun(12);
    const it=genItem(12,20); it.ident=false; it.rar=1;
    S.run.loot=[it];
    W.ev={id:'urn', x:P.x, y:P.y, used:false};
    resolveEvent();
    if(S.run.loot.length===1 && S.run.loot[0].rar===2) up++;
    else if(S.run.loot.length===0) lost++;
  }
  // 未鑑定品が無ければ「今はできない」になる
  S.hero=newHero(); startRun(12); S.run.loot=[];
  W.ev={id:'urn', x:P.x, y:P.y, used:false};
  P.x=W.ev.x; P.y=W.ev.y;
  openEvent();
  const label=document.getElementById('ev-yes').textContent;
  const ghost=document.getElementById('ev-yes').className==='ghost';
  closeEvent();
  return {trials, up, lost, upPct:+((up/trials)*100).toFixed(1),
          consumedAlways: up+lost===trials,
          nearFiftyFive: Math.abs(up/trials-0.55)<0.10,
          emptyLabel:label, emptyBlocked:ghost};
});

// 1-h. 近づくと interact() でモーダルが開き、「やめる」なら未使用のまま残る
R.evInteract = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(4);
  W.ev={id:'spring', x:P.x+0.4, y:P.y, used:false};
  const near=!!nearEvent();
  interact();
  const opened=document.getElementById('m-event').classList.contains('on');
  const screen=S.screen;
  closeEvent();
  const stillThere=!!W.ev && !W.ev.used;
  // 遠ければ反応しない
  W.ev.x=P.x+9;
  const farIgnored=!nearEvent();
  return {near, opened, screen, closedScreen:S.screen, stillThere, farIgnored,
          ok: near && opened && screen==='event' && stillThere && farIgnored};
});

/* ================= 2. 踏破済み階層 ================= */

// 2-a. 判定は「最深から4階手前まで」
R.known = await pg.evaluate(()=>{
  S.deepest=30;
  const probe=[1,10,25,26,27,30,31];
  const known=probe.filter(knownFloor), unknown=probe.filter(d=>!knownFloor(d));
  S.deepest=1;
  const freshRunKnown=[1,2,3].filter(knownFloor);
  S.deepest=30;
  return {margin:KNOWN_MARGIN, speed:KNOWN_SPEED, deepest:30, known, unknown,
          shallowKnown: known.includes(1) && known.includes(10),
          edgeIsMinus4: known.includes(26) && unknown.includes(27),
          frontierStaysFresh: unknown.length===3,
          firstRunNothingKnown: freshRunKnown.length===0,
          speedsUp: KNOWN_SPEED>1};
});

// 2-b. 実測で速い（同じ入力・同じ時間でより長く進む）
R.knownSpeed = await pg.evaluate(async ()=>{
  const run=async(deepest)=>{
    S.hero=newHero(); S.upg={}; S.deepest=deepest;
    startRun(3);
    // 開けた場所をつくって壁の影響を消す
    for(let y=1;y<W.fl.H-1;y++) for(let x=1;x<W.fl.W-1;x++) W.fl.g[y][x]=T.FLOOR;
    W.enemies.length=0;
    const x0=P.x;
    stepSim(0.7, {each:()=>{ stickDx=1; stickDy=0; }});
    stickDx=0; stickDy=0;
    return +(P.x-x0).toFixed(2);
  };
  const fresh=await run(1);        // 未踏
  const known=await run(40);       // 踏破済み
  S.deepest=1;
  return {fresh, known, faster: known > fresh*1.2,
          ratio:+(known/Math.max(0.01,fresh)).toFixed(2)};
});

// 2-c. HUDに踏破済みの印が出る
R.knownHud = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=40; startRun(3); updateHUD();
  const badge=document.getElementById('dsub').textContent.includes('踏破済');
  S.deepest=3; enterFloor(3); updateHUD();
  const plainWhenFresh=!document.getElementById('dsub').textContent.includes('踏破済');
  S.deepest=1;
  return {badge, plainWhenFresh, onlyWhenKnown: badge && plainWhenFresh};
});

/* ================= 3. 仲間の個体差 ================= */

// 3-a. 同ジョブでも個体ごとの数値が違う
R.allyJitter = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const made=[];
  for(let i=0;i<40;i++) made.push(makeAlly(10,S.hero));
  const same=made.filter(a=>a.job===made[0].job);
  const uniq=k=>new Set(same.map(a=>a[k])).size;
  // 単体の値はごく稀に衝突しうる。問われているのは「同じ個体が2人いないこと」なので、
  // 5つの値の組で見る（組が一致する確率は事実上ゼロ）。
  const sig=a=>[a.seed,a.msJit,a.keepJit,a.cdJit,a.wobble].join('/');
  const sigs=new Set(made.map(sig));
  return {made:made.length, sameJobCount:same.length, job:made[0].job,
          seeds:uniq('seed'), msJit:uniq('msJit'), keepJit:uniq('keepJit'),
          cdJit:uniq('cdJit'), wobble:uniq('wobble'),
          distinctIndividuals:sigs.size,
          ranges:{ms:[Math.min(...same.map(a=>a.msJit)),Math.max(...same.map(a=>a.msJit))].map(v=>+v.toFixed(2))},
          allDiffer: sigs.size===made.length && uniq('seed')>=same.length-1};
});

// 3-b. 隊列スロットは加入順に別々の位置が割り当てられる
R.slots = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const slots=[];
  for(let i=0;i<PARTY_MAX;i++){
    W.npc=makeAlly(10,S.hero); W.npc.x=P.x; W.npc.y=P.y;
    joinAlly();
    slots.push(party()[party().length-1].slot);
  }
  const offs=party().map(a=>slotOffset(a));
  let minGap=99;
  for(let i=0;i<offs.length;i++) for(let j=i+1;j<offs.length;j++)
    minGap=Math.min(minGap, Math.hypot(offs[i].x-offs[j].x, offs[i].y-offs[j].y));
  return {slots, unique:new Set(slots).size===slots.length,
          minOffsetGap:+minGap.toFixed(2), offsetsSpread:minGap>0.6};
});

// 3-c. 完全に同じ座標に重ねても押し離される（本題）
R.separation = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=18;
  S.hero.str=20;S.hero.dex=20;S.hero.vit=20;
  startRun(8); S.hero.party=[];
  W.enemies.length=0;
  // 同じ職・同じ座標の3人
  for(let i=0;i<3;i++){
    let a; let guard=0;
    do{ a=makeAlly(8,S.hero); guard++; }while(a.job!=='warrior'&&guard<200);
    a.x=P.x; a.y=P.y; a.slot=i;
    uniqueAllyName(a,party()); S.hero.party.push(a);
  }
  const startOverlap = party().every(a=>a.x===P.x&&a.y===P.y);
  const minGap=()=>{
    const p=livingParty(); let w=99;
    for(let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++)
      w=Math.min(w, Math.hypot(p[i].x-p[j].x, p[i].y-p[j].y));
    return w;
  };
  // 完全に重なった状態からどれだけで解けるか
  let settleMs=null;
  // 元は 50ms 刻みで最大20回。同じ刻み（3フレーム）で数える。
  stepSim(1.0, {after:(t,i)=>{
    if(i%3 || settleMs!==null) return;
    if(minGap()>0.3) settleMs=Math.round((i+1)/60*1000);
  }, until:()=>settleMs!==null});
  // 隊列に着くまで待ってから、定常状態で重ならないことを測る。
  // ほどけた直後は互いの位置を入れ替えながら散るので、そこはまだ過渡状態。
  stepSim(1.2);
  let worst=99;
  const samples=[];
  let k=0;
  stepSim(2.0, {after:(t,i)=>{
    if(i%3) return;
    worst=Math.min(worst, minGap());
    if(k%13===0) samples.push(livingParty().map(a=>[+a.x.toFixed(2),+a.y.toFixed(2)]));
    k++;
  }});
  const p=livingParty();
  const gaps=[];
  for(let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++)
    gaps.push(+Math.hypot(p[i].x-p[j].x, p[i].y-p[j].y).toFixed(2));
  return {startOverlap, personal:ALLY_PERSONAL, settleMs,
          worstGapWhenSettled:+worst.toFixed(2), finalGaps:gaps, samples,
          unstacksFast: settleMs!==null && settleMs<=400,
          // 落ち着いたあとは、体が重なる距離まで近づかない
          neverStacksAgain: worst>0.6,
          finalSeparated: gaps.every(g=>g>0.3)};
});

// 3-d. 完全重なりでも separation が向きを返す（0除算で固まらない）
R.sepDegenerate = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(8); S.hero.party=[];
  const a=makeAlly(8,S.hero), c=makeAlly(8,S.hero);
  a.x=c.x=P.x; a.y=c.y=P.y; a.seed=0.3; c.seed=3.9;
  S.hero.party.push(a,c);
  const va=separation(a), vc=separation(c);
  const fin=v=>v && isFinite(v.x) && isFinite(v.y) && Math.abs(Math.hypot(v.x,v.y)-1)<0.01;
  return {va, vc, bothFinite:fin(va)&&fin(vc),
          pointDifferently: !!va&&!!vc && Math.hypot(va.x-vc.x,va.y-vc.y)>0.2};
});

/* ================= 4. 秘石 ================= */

// 4-a. 落ちる数は強さと深さで増える
R.shardCurve = await pg.evaluate(()=>{
  const avg=(mk,depth)=>{
    let t=0; const n=600;
    for(let i=0;i<n;i++){ RNG=mulberry32(i*31337+depth); t+=shardDrop(mk(),depth); }
    return +(t/n).toFixed(2);
  };
  const mob=()=>({}), elite=()=>({elite:true}), uniq=()=>({uniq:true});
  const great=()=>({boss:true,tier:'great'}), fin=()=>({boss:true,tier:'final'});
  const d5={mob:avg(mob,5), elite:avg(elite,5), uniq:avg(uniq,5), great:avg(great,5), final:avg(fin,5)};
  const d40={mob:avg(mob,40), elite:avg(elite,40)};
  return {d5, d40,
          tierOrders: d5.mob<d5.elite && d5.elite<d5.uniq && d5.uniq<d5.great && d5.great<d5.final,
          deeperPaysMore: d40.mob>d5.mob*1.5 && d40.elite>d5.elite*1.5,
          mobsSometimesZero: (()=>{ let z=0; for(let i=0;i<200;i++){ RNG=mulberry32(i); if(shardDrop({},5)===0) z++; } return z>40 && z<180; })()};
});

// 4-b. 拾った瞬間に口座に入り、死んでも残る（今回の要望の本体）
R.shardSurvivesDeath = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.shards=0; startRun(9);
  S.run.gold=500;                       // 帰らないと消える金
  W.drops.length=0;
  W.drops.push({x:P.x, y:P.y, shard:12});
  autoPickup();
  const afterPickup={shards:S.shards, run:S.shardsRun, dropsLeft:W.drops.length};
  S.hero.hpNow=0;
  die();
  return {afterPickup, shardsAfterDeath:S.shards, goldAfterDeath:S.gold,
          screen:S.screen,
          banked: afterPickup.shards===12 && afterPickup.dropsLeft===0,
          keptOnDeath: S.shards===12,
          goldStillLost: S.gold===0};
});

// 4-c. 倒すと落とす（実際の killEnemy 経由）
R.shardFromKill = await pg.evaluate(()=>{
  // 10階ごとは大広間＝ボス戦だけの階（雑魚が湧かない）。群れが要るので手前の階で見る。
  S.hero=newHero(); S.upg={hp:8}; startRun(19); S.shards=0;
  W.drops.length=0;
  W.enemies.length=0;
  W.enemies.push(...spawnEnemies(W.fl, 19));
  const kills=W.enemies.length;
  W.enemies.slice().forEach(e=>{ e.elite=true; killEnemy(e); });
  const dropped=W.drops.filter(d=>d.shard);
  const total=dropped.reduce((a,d)=>a+d.shard,0);
  return {kills, shardDrops:dropped.length, total,
          someDropped: dropped.length>0,
          bankedOnlyOnPickup: S.shards===0};   // 落ちただけでは口座に入らない
});

// 4-d. 永続強化は秘石でだけ買える（金では買えない）
R.shardBuys = await pg.evaluate(()=>{
  S.hero=null; S.run=null; S.upg={}; S.gold=99999; S.shards=0;
  const u=UPGRADES.find(x=>x.id==='hp');
  const cost=upgCost(u,0);
  setScreen('town'); setScreen('upg');
  const row=()=>document.querySelector('[data-upg="hp"]');
  row().dispatchEvent(new MouseEvent('click',{bubbles:true}));  // 秘石ゼロ・金だけ潤沢
  const blocked=upgLv('hp')===0 && S.gold===99999;
  S.shards=cost; renderUpg();
  row().dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const bought=upgLv('hp')===1 && S.shards===0;
  // 段階ごとに高くなる
  const curve=[0,1,2,3,4].map(lv=>upgCost(u,lv));
  const allCosts=UPGRADES.map(x=>({id:x.id, shard:x.shard, hasGold:x.gold!==undefined}));
  return {cost, blocked, bought, curve,
          risesWithLevel: curve.every((v,i)=>i===0||v>curve[i-1]),
          noGoldPrices: allCosts.every(c=>!c.hasGold && typeof c.shard==='number'),
          goldUntouched: S.gold===99999};
});

// 4-e. 死亡画面と結果画面に秘石が出る
R.shardUI = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.shards=0; startRun(5);
  gainShards(9, P.x, P.y);
  updateHUD();
  const hud=document.getElementById('dsub').textContent;
  S.hero.hpNow=0; die();
  const over=document.getElementById('d-lost').innerHTML;
  return {hud:hud.replace(/\s+/g,' '), hudShows:hud.includes('9'),
          overShows: over.includes('マナ') && over.includes('9'),
          shardsRun:S.shardsRun};
});

// 4-f. 新規プレイで秘石はリセットされる
R.shardReset = await pg.evaluate(()=>{
  S.shards=777; S.shardsRun=42;
  document.getElementById('btn-reset').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  return {after:S.shards, run:S.shardsRun, zeroed:S.shards===0&&S.shardsRun===0};
});

/* ================= 5. 実プレイ ================= */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=26;
  S.hero.str=30;S.hero.dex=30;S.hero.vit=30;
  S.shards=0; S.deepest=30;
  startRun(3); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('sword',26,2);
  S.hero.equip.armor=genBaseItem('plate',26,2);
  S.hero.hpNow=stats(S.hero).maxHp;
  // 同ジョブ3人を重ねて連れて歩く
  for(let i=0;i<3;i++){
    let a; let g=0;
    do{ a=makeAlly(3,S.hero); g++; }while(a.job!=='warrior'&&g<200);
    a.x=P.x; a.y=P.y; a.slot=i;
    uniqueAllyName(a,party()); S.hero.party.push(a);
  }
  let evSeen=0, worst=99, floors=0;
  for(const d of [3,4,6,7,8,9]){
    enterFloor(d);
    floors++;
    if(W.ev) evSeen++;
    // 敵を足元へ寄せて実際に戦わせる（秘石が拾われるところまで通す）
    W.enemies.slice(0,4).forEach((e,i)=>{ e.x=P.x+Math.cos(i)*1.2; e.y=P.y+Math.sin(i)*1.2; });
    const drive=()=>{ stickDx=0.95; stickDy=0.3; };
    stepSim(1.2, {each:drive});               // 重なりがほどけ、隊列に着くまで待つ
    stepSim(0.8, {each:drive, after:(t,i)=>{
      if(i%3) return;
      const p=livingParty();
      for(let a=0;a<p.length;a++) for(let bq=a+1;bq<p.length;bq++)
        worst=Math.min(worst, Math.hypot(p[a].x-p[bq].x, p[a].y-p[bq].y));
    }});
    stickDx=0; stickDy=0;
    if(!S.run) break;
  }
  const out={floors, eventsSeen:evSeen, worstAllyGap:+worst.toFixed(2),
             minGap:ALLY_MIN_GAP,
             // 位置の拘束は毎フレーム1回なので、次のフレームで少しだけ食い込む余地がある
             alliesNeverStack: worst >= ALLY_MIN_GAP*0.85,
             shards:S.shards, shardsBanked:S.shards>0, loopAlive:_tickCount>200,
             alive:!!S.run, screen:S.screen};
  S.deepest=1;
  return out;
});

// 5-b. 全イベントを実際に描画しても落ちない
R.drawAll = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(6);
  const fails=[];
  EVENTS.forEach(d=>{
    try{
      W.ev={id:d.id, x:P.x+2, y:P.y+2, used:false};
      W.drops.push({x:P.x+1, y:P.y+1, shard:5});
      W.seen.forEach(r=>r.fill(1));
      for(let k=0;k<3;k++) draw();
    }catch(e){ fails.push(d.id+': '+e.message); }
  });
  return {kinds:EVENTS.length, failures:fails, ok:fails.length===0};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
