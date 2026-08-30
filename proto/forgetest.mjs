// 鉱石と武器の鍛造。
// 「鉱脈を掘る → 鉱石＋金で +10 まで鍛える → 3/6/9 でランダムに技が付く」を検証する。
// 素材（鉱石）は死んでも残り、投資（強化した武器）は死ぬと失われる — この線引きが本題。
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

/* ================= 1. 鉱脈の配置 ================= */

// 1-a. 毎階層 1〜3 ヶ所、必ず床の上、開始部屋は避ける
R.veins = await pg.evaluate(()=>{
  let floors=0, total=0, inWall=0, empty=0, over=0, inStart=0;
  const counts={};
  for(let d=1;d<=50;d++) for(let s=0;s<20;s++){
    RNG=mulberry32(d*7919+s);
    const fl=genFloor(d);
    const os=spawnOres(fl,d);
    floors++; total+=os.length;
    counts[os.length]=(counts[os.length]||0)+1;
    if(!os.length) empty++;
    if(os.length>ORE_VEINS_MAX) over++;
    os.forEach(o=>{
      if(fl.g[Math.floor(o.y)][Math.floor(o.x)]===T.WALL) inWall++;
      if(Math.floor(o.x)===fl.start.cx && Math.floor(o.y)===fl.start.cy) inStart++;
    });
  }
  return {floors, total, avg:+(total/floors).toFixed(2), counts, inWall, over, inStart,
          max:ORE_VEINS_MAX,
          allOnFloor:inWall===0, neverOverMax:over===0, avoidsStart:inStart===0,
          emptyRate:+((empty/floors)*100).toFixed(1),
          // 鉱脈は「たまに見つかる寄り道」。無い階層があってよい（設計上 約28%）
          someFloorsEmpty: empty/floors > 0.15 && empty/floors < 0.40,
          mostFloorsHaveOne: (counts[1]||0)/floors > 0.4};
});

// 1-b. 深さで等級が上がり、境目の階層では2種類とも出る
R.grades = await pg.evaluate(()=>{
  const at=d=>oreGradesAt(d).map(o=>o.id);
  const seen=d=>{
    const set=new Set();
    for(let s=0;s<60;s++){ RNG=mulberry32(d*104729+s);
      const fl=genFloor(d); spawnOres(fl,d).forEach(o=>set.add(o.grade)); }
    return [...set].sort();
  };
  return {table:ORES.map(o=>({id:o.id,nm:o.nm,min:o.min,max:o.max})),
          d5:at(5), d14:at(14), d22:at(22), d30:at(30), d45:at(45),
          seen5:seen(5), seen14:seen(14), seen45:seen(45),
          shallowRawOnly: at(5).join()==='raw',
          overlapAt14: at(14).length===2,
          deepOnly: at(45).join()==='deep',
          noRawDeep: !at(45).includes('raw'),
          uniqueNames:new Set(ORES.map(o=>o.nm)).size===ORES.length};
});

// 1-c. 産出量は深いほど多い
R.yield = await pg.evaluate(()=>{
  const avg=d=>{
    let t=0,n=0;
    for(let s=0;s<200;s++){ RNG=mulberry32(d*31337+s);
      const fl=genFloor(d); spawnOres(fl,d).forEach(o=>{ t+=o.n; n++; }); }
    return +(t/n).toFixed(2);
  };
  const d3=avg(3), d20=avg(20), d45=avg(45);
  return {d3, d20, d45, deeperYieldsMore: d45>d20 && d20>d3};
});

/* ================= 2. 採掘 — 立ち止まりが代償 ================= */

const setupVein = (grade='raw', n=5, depth=6)=>pg.evaluate(({grade,n,depth})=>{
  S.hero=newHero(); S.upg={hp:8}; S.ore={};
  startRun(depth);
  W.enemies.length=0; W.ores.length=0; W.forge=null; W.ev=null; W.npc=null;
  const o={x:P.x, y:P.y, grade, n, mined:false, seed:1};
  W.ores.push(o);
  stickDx=0; stickDy=0;
  return true;
}, {grade,n,depth});

// 2-a. 掘りきると鉱石はその探索の袋に入り、鉱脈は掘り尽くされる
await setupVein('fine', 7, 20);
R.mineDone = await pg.evaluate(async ()=>{
  interact();                       // 近くにいるので採掘が始まる
  const started=!!W.mine;
  const need=W.mine&&W.mine.need;
  const frames=stepSim(1.8);
  return {started, need, elapsed:+(frames/60).toFixed(2),
          mined:W.ores[0].mined, cleared:!W.mine,
          runOre:JSON.parse(JSON.stringify(S.run.ore)), acct:{...S.ore}, total:oreRunTotal(),
          // 口座ではなく「今回の袋」に入る。持ち帰るまでは自分の物にならない。
          intoRunBag: oreRun('fine')===7 && Object.keys(S.ore).length===0,
          veinSpent: W.ores[0].mined===true};
});

// 2-b. 動くと中断する（＝掘るあいだは避けられない）
await setupVein('raw', 5, 6);
R.mineCancelMove = await pg.evaluate(async ()=>{
  interact();
  const started=!!W.mine;
  stepSim(0.3);
  const midway=!!W.mine && W.mine.t>0;
  stepSim(0.25, {each:()=>{ stickDx=1; stickDy=0; }});   // 逃げる
  const cancelled=!W.mine;
  stickDx=0; stickDy=0;
  stepSim(0.9);                            // 動かなくても、再度掘り直さない限り進まない
  return {started, midway, cancelled,
          veinUntouched: W.ores[0].mined===false,
          ore:JSON.parse(JSON.stringify(S.run.ore)),
          nothingGained: oreRunTotal()===0,
          ok: started && midway && cancelled && !W.ores[0].mined};
});

// 2-c. 殴られても中断する
await setupVein('raw', 5, 6);
R.mineCancelHit = await pg.evaluate(async ()=>{
  interact();
  stepSim(0.25);
  const before=!!W.mine;
  hitPlayer(null, 5, 'blunt', 3);          // 掘っている最中に被弾
  const after=!!W.mine;
  stepSim(0.6);
  return {wasMining:before, stoppedByHit:!after,
          veinUntouched:W.ores[0].mined===false,
          ok: before && !after && !W.ores[0].mined};
});

/* 2-d. 掘ったあとの鉱脈では鍛えられない。鍛冶場は別の場所にある。

   以前はここが「掘り尽くした鉱脈がそのまま鍛冶場になる」だった。
   その場で叩けると、鉱石は財布から出してすぐ使う小銭でしかなくなり、
   「死ねば失う物を抱えて歩いている」時間が一秒も生まれない。
   運ぶ距離のほうが本体なので、鍛冶場を切り離した。 */
await setupVein('raw', 5, 6);
R.forgeNotAtVein = await pg.evaluate(async ()=>{
  S.hero.equip.weapon=genBaseItem('sword',6,1);
  interact();
  stepSim(1.7);
  const mined=W.ores[0].mined;
  interact();                               // 2回目。以前はここで鍛冶場が開いた
  const openedAtVein=document.getElementById('m-forge').classList.contains('on');
  document.getElementById('m-forge').classList.remove('on');

  // 別の場所に置かれた鍛冶場でなら開く
  W.forge={x:P.x, y:P.y, seed:0};
  interact();
  const openedAtForge=document.getElementById('m-forge').classList.contains('on');
  const title=document.getElementById('fg-title').textContent;
  const screen=S.screen;
  closeForge();
  W.forge=null;
  // 掃引は「false = 失敗」で読むので、期待どおり開かないことは肯定形で返す
  return {mined, veinDoesNotForge:!openedAtVein, openedAtForge, title, screen,
          backToGame:S.screen==='game',
          ok: mined && !openedAtVein && openedAtForge
              && title.includes('鍛冶場') && screen==='forge'};
});

/* ================= 3. 鍛造のコスト ================= */

// 3-a. 等級は段が上がるほど深くなる／金は段ごとに重くなる
R.costCurve = await pg.evaluate(()=>{
  S.hero=newHero(); S.bld={};
  const it=genBaseItem('sword',20,2); it.up=0;
  const rows=[];
  for(let lv=0;lv<UP_MAX;lv++)
    rows.push({lv, grade:upGrade(lv), ore:upOreCost(lv), gold:upGoldCost(it,lv,false)});
  const golds=rows.map(r=>r.gold), ores=rows.map(r=>r.ore);
  return {max:UP_MAX, skillAt:UP_SKILL_AT, rows,
          gradeSteps:[...new Set(rows.map(r=>r.grade))],
          gradeEscalates: rows[0].grade==='raw' && rows[4].grade==='fine' && rows[9].grade==='deep',
          goldRises: golds.every((v,i)=>i===0||v>golds[i-1]),
          oreRises:  ores.every((v,i)=>i===0||v>=ores[i-1]),
          lastCostsMost: golds[9]>golds[0]*8};
});

// 3-b. 道中は1.5倍。鍛冶屋（拠点開発）のレベルで安くなる
R.pricing = await pg.evaluate(()=>{
  S.hero=newHero(); S.bld={};
  const it=genBaseItem('sword',20,2);
  const town=upGoldCost(it,3,false), mid=upGoldCost(it,3,true);
  S.bld={forge:3};
  const townFor=upGoldCost(it,3,false);
  S.bld={};
  // 良い武器ほど育てるのが重い（自動で釣り合う）
  const cheap=genBaseItem('dagger',5,0), rich=genBaseItem('greatsword',40,3);
  return {town, mid, markup:FORGE_MID_MARKUP, ratio:+(mid/town).toFixed(2),
          midIsPricier: mid>town,
          matchesMarkup: Math.abs(mid/town-FORGE_MID_MARKUP)<0.06,
          townForge3:townFor, buildingDiscounts: townFor<town,
          cheapItem:upGoldCost(cheap,0,false), richItem:upGoldCost(rich,0,false),
          scalesWithValue: upGoldCost(rich,0,false)>upGoldCost(cheap,0,false)};
});

// 3-c. 鉱石と金の両方が要る（片方だけでは鍛えられない）
R.needsBoth = await pg.evaluate(()=>{
  S.hero=newHero(); S.bld={}; S.run=null;
  const it=genBaseItem('sword',20,2); S.hero.equip.weapon=it;
  const cost=upGoldCost(it,0,false), need=upOreCost(0), g=upGrade(0);
  S.gold=cost; S.ore={};  S.run=null;          // 金だけ
  const oreless=doUpgrade(it,false);
  S.gold=0; S.ore={[g]:need};                  // 鉱石だけ
  const broke=doUpgrade(it,false);
  const brokeWhy=upCheck(it,false).why;
  S.gold=cost; S.ore={[g]:need};               // 両方
  const done=doUpgrade(it,false);
  return {cost, need, grade:g,
          oreless, broke, brokeWhy, done,
          bothRequired: oreless===null && broke===null && !!done,
          spent: S.gold===0 && (S.ore[g]||0)===0,
          lv:it.up};
});

// 3-d. 壊れた武器・未鑑定品・武器以外は鍛えられない
R.blocked = await pg.evaluate(()=>{
  S.hero=newHero(); S.gold=999999; S.ore={raw:999,fine:999,deep:999};
  const broken=genBaseItem('sword',20,1); broken.dur=0;
  const unid=genBaseItem('sword',20,1); unid.ident=false;
  const armor=genBaseItem('plate',20,1);
  const cases={none:null, broken, unid, armor};
  const reasons={};
  Object.entries(cases).forEach(([k,v])=>{ reasons[k]=upCheck(v,false).why; });
  return {reasons,
          allRefused: Object.values(cases).every(x=>!upCheck(x,false).ok)
                   && [broken,unid,armor].every(x=>doUpgrade(x,false)===null),
          everyReasonExplained: Object.values(reasons).every(r=>!!r),
          brokenUntouched: (broken.up||0)===0};
});

/* ================= 4. 上限と、節目の技 ================= */

// 4-a. +10 で止まり、技はちょうど 3・6・9 の3回だけ
R.cap = await pg.evaluate(()=>{
  S.hero=newHero(); S.gold=99999999; S.ore={raw:9999,fine:9999,deep:9999};
  const it=genBaseItem('sword',30,2); S.hero.equip.weapon=it;
  const gotAt=[];
  let calls=0;
  for(let i=0;i<20;i++){
    const r=doUpgrade(it,false);
    if(r){ calls++; if(r.skill) gotAt.push(r.lv); }
  }
  return {up:it.up, calls, gotAt, skills:it.ups, max:UP_MAX,
          stopsAtMax: it.up===UP_MAX && calls===UP_MAX,
          skillsAtMilestones: gotAt.join()===UP_SKILL_AT.join(),
          exactlyThree: (it.ups||[]).length===3,
          capMessage: upCheck(it,false).why};
});

// 4-b. 同じ技は二度付かない
R.noDupes = await pg.evaluate(()=>{
  let dupes=0, runs=300;
  const counts={};
  for(let i=0;i<runs;i++){
    RNG=mulberry32(i*7919+7);
    S.hero=newHero(); S.gold=99999999; S.ore={raw:9999,fine:9999,deep:9999};
    const it=genBaseItem('sword',30,2);
    for(let k=0;k<UP_MAX;k++) doUpgrade(it,false);
    const u=it.ups||[];
    if(new Set(u).size!==u.length) dupes++;
    u.forEach(id=>counts[id]=(counts[id]||0)+1);
  }
  return {runs, dupes, counts, neverDuplicates:dupes===0,
          variety:Object.keys(counts).length};
});

// 4-c. 武器種に合わない技は最初から出ない
R.typeFilter = await pg.evaluate(()=>{
  const sample=(baseId, n)=>{
    const c={};
    for(let i=0;i<n;i++){
      RNG=mulberry32(i*104729+3);
      S.hero=newHero(); S.gold=99999999; S.ore={raw:9999,fine:9999,deep:9999};
      const it=genBaseItem(baseId,30,2);
      for(let k=0;k<UP_MAX;k++) doUpgrade(it,false);
      (it.ups||[]).forEach(id=>c[id]=(c[id]||0)+1);
    }
    return c;
  };
  const sword=sample('sword',200), bow=sample('bow',200), staff=sample('staff',200);
  return {sword, bow, staff,
          meleeNoPierce: !sword.bore,
          meleeGetsSweep: !!sword.sweep,
          rangedNoSweep: !bow.sweep && !staff.sweep,
          rangedGetsPierce: !!bow.bore && !!staff.bore,
          sharedBoth: !!sword.swift && !!bow.swift};
});

/* ================= 5. 技はちゃんと効く ================= */

// 5-a. 1段ごとに攻撃力が伸びる（単調・上限で止まる）
R.atkCurve = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.gold=99999999; S.ore={raw:9999,fine:9999,deep:9999};
  const it=genBaseItem('sword',30,1); it.aff=[]; S.hero.equip.weapon=it;
  const seq=[Math.round(stats(S.hero).atk)];
  for(let k=0;k<UP_MAX;k++){ it.ups=[]; doUpgrade(it,false); it.ups=[];   // 技を外して素の伸びだけ見る
                             seq.push(Math.round(stats(S.hero).atk)); }
  return {seq, perLevel:UP_ATK_PER,
          monotone: seq.every((v,i)=>i===0||v>=seq[i-1]),
          grows: seq[UP_MAX]>seq[0],
          gain:+((seq[UP_MAX]/seq[0]-1)*100).toFixed(1)};
});

// 5-b. 技ごとに、狙ったステータスだけが動く
R.skillEffects = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={};
  // 同じ1本に技を差し替えて測る。武器を作り直すと素の攻撃力の乱数が混ざる。
  const sword=genBaseItem('sword',30,1); sword.aff=[];
  const bow=genBaseItem('bow',30,1);     bow.aff=[];
  const mk=(baseId,ups)=>{ const it = baseId==='bow'?bow:sword;
                           it.ups=ups; S.hero.equip.weapon=it; return stats(S.hero); };
  const base=mk('sword',[]), bbase=mk('bow',[]);
  const out={};
  out.swift  = {before:+base.aspd.toFixed(3),  after:+mk('sword',['swift']).aspd.toFixed(3)};
  out.reach  = {before:+base.range.toFixed(3), after:+mk('sword',['reach']).range.toFixed(3)};
  out.keen   = {before:Math.round(base.crit),  after:Math.round(mk('sword',['keen']).crit)};
  out.sweep  = {before:base.arc,               after:mk('sword',['sweep']).arc};
  out.twin   = {before:base.multi||0,          after:mk('sword',['twin']).multi};
  out.drain  = {before:base.leech||0,          after:mk('sword',['drain']).leech};
  out.sturdy = {before:base.durSave||0,        after:mk('sword',['sturdy']).durSave};
  out.bore   = {before:bbase.projPierce||0,    after:mk('bow',['bore']).projPierce};
  const hv=mk('sword',['heavy']);
  out.heavy  = {atkBefore:Math.round(base.atk), atkAfter:Math.round(hv.atk),
                aspdBefore:+base.aspd.toFixed(3), aspdAfter:+hv.aspd.toFixed(3)};
  const el=mk('sword',['ember','spark','rime']);
  out.elems  = {before:base.elem, after:el.elem};
  return {out,
    swiftUp:  out.swift.after  > out.swift.before,
    reachUp:  out.reach.after  > out.reach.before,
    keenUp:   out.keen.after   === out.keen.before+8,
    sweepUp:  out.sweep.after  === out.sweep.before+30,
    twinUp:   out.twin.after   === 35,
    drainUp:  out.drain.after  === out.drain.before+3,
    sturdyUp: out.sturdy.after === 50,
    boreUp:   out.bore.after   === out.bore.before+1,
    // 重打は「威力↑ 速度↓」の取引になっている（得だけの技を作らない）
    heavyTradeoff: hv.atk>base.atk && hv.aspd<base.aspd,
    elemsUp: el.elem.fire>0 && el.elem.shock>0 && el.elem.frost>0};
});

// 5-c. 実際の攻撃に出る（連撃で弾が2発、貫きで貫通が増える）
R.inCombat = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.hero.lv=20; S.hero.dex=20;
  startRun(8); W.enemies.length=0; W.fx.length=0;
  const put=()=>{ const e={x:P.x+2,y:P.y,r:0.34,dead:false,hp:99999,maxHp:99999,
                           lv:8,def:0,res:{},st:{},bu:{},arch:{nm:'的'},fam:{nm:'的',col:'#fff'},
                           atkV:0,ms:0,state:'chase',t:0,cd:9,vx:0,vy:0,hit:0,tele:0,name:'的'};
                  W.enemies.push(e); return e; };
  const shots=(ups)=>{
    const it=genBaseItem('bow',20,1); it.aff=[]; it.ups=ups; S.hero.equip.weapon=it;
    W.fx.length=0; W.enemies.length=0; const e=put();
    P.atkCd=0; P.dirx=1; P.diry=0; P.target=e;
    let n=0, pierce=0;
    for(let i=0;i<400;i++){ W.fx.length=0; P.atkCd=0; playerAttack();
      const ps=W.fx.filter(f=>f.t==='pshot');
      n+=ps.length; if(ps.length) pierce=Math.max(pierce,ps[0].pierce); }
    return {avgShots:+(n/400).toFixed(2), pierce};
  };
  const plain=shots([]), twin=shots(['twin']), bore=shots(['bore']);
  // 近接の連撃は少し遅れて2振り目が出る
  const it=genBaseItem('sword',20,1); it.aff=[]; it.ups=['twin']; S.hero.equip.weapon=it;
  W.fx.length=0; W.enemies.length=0; put(); P.follow=null;
  let scheduled=0;
  for(let i=0;i<300;i++){ P.atkCd=0; P.follow=null; P.dirx=1; P.diry=0;
                          P.target=W.enemies[0]; playerAttack(); if(P.follow) scheduled++; }
  P.follow=null;
  return {plain, twin, bore, meleeFollowRate:+(scheduled/300).toFixed(2),
          multiMult:MULTI_MULT,
          twinFiresMore: twin.avgShots>plain.avgShots*1.2 && twin.avgShots<plain.avgShots*1.6,
          borePierces: bore.pierce===plain.pierce+1,
          meleeFollowsUp: scheduled>200*0.35*0.6 && scheduled<300*0.5,
          followUpIsWeaker: MULTI_MULT<1};
});

/* ================= 6. 鉱石は持ち帰らないと自分の物にならない ================= */

// 6-a. 探索中は口座に入らない。死ねば半分が遺体、残りは消える。
R.oreLostOnDeath = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.ore={};
  startRun(9);
  S.run.gold=800;
  gainOre('raw', 11, P.x, P.y);
  const duringRun={bag:{...S.run.ore}, acct:{...S.ore}, total:oreRunTotal()};
  S.hero.hpNow=0; die();
  return {duringRun, acctAfter:{...S.ore}, grave:S.grave&&{...S.grave.ore},
          graveRate:GRAVE_GOLD_RATE,
          notBankedDuringRun: Object.keys(duringRun.acct).length===0 && duringRun.total===11,
          nothingInAccount: (S.ore.raw||0)===0,
          halfLeftInGrave: (S.grave&&S.grave.ore&&S.grave.ore.raw)===5,
          runGoldStillLost: S.gold===0};
});

// 6-b. 生きて帰れば口座に入る
R.oreBankedOnReturn = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.ore={raw:2};
  startRun(10);                       // 帰還ポータル階（帰れるのは5階ごと）
  gainOre('raw', 4); gainOre('fine', 6);
  const before={...S.ore};
  returnToTown();
  return {before, after:{...S.ore},
          addedToAccount: S.ore.raw===6 && S.ore.fine===6};
});

// 6-c. 遺体に戻れば回収できる
R.oreFromGrave = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.ore={};
  startRun(9);
  gainOre('fine', 10);
  S.hero.hpNow=0; die();
  const inGrave=(S.grave&&S.grave.ore&&S.grave.ore.fine)||0;
  // 次のキャラで取りに行く
  S.hero=newHero(); startRun(S.grave.depth);
  W.grave={x:P.x,y:P.y};
  collectGrave();
  return {inGrave, recovered:oreRun('fine'),
          graveCleared: S.grave===null,
          recoverable: inGrave>0 && oreRun('fine')===inGrave};
});

// 6-d. 鍛える場所で見る袋が変わる（拠点＝口座 / 道中＝今回の袋）
R.forgePurses = await pg.evaluate(()=>{
  S.hero=newHero(); S.bld={}; S.gold=99999999;
  const it=genBaseItem('sword',20,2); S.hero.equip.weapon=it;
  S.ore={}; startRun(9); S.run.gold=99999999;
  gainOre('raw', 99);                    // 今回の袋にだけ大量にある
  const midOk = upCheck(it,true).ok, townBlocked = !upCheck(it,false).ok;
  doUpgrade(it,true);
  const afterMid={bag:oreRun('raw'), acct:oreHave('raw'), lv:it.up};
  // 逆に口座だけある状態
  S.run.ore={}; S.ore={raw:99};
  const townOk = upCheck(it,false).ok, midBlocked = !upCheck(it,true).ok;
  return {midOk, townBlocked, afterMid, townOk, midBlocked,
          separatePurses: midOk && townBlocked && townOk && midBlocked,
          midSpentFromBag: afterMid.bag<99 && afterMid.acct===0};
});

// 6-e. 鍛えた武器は、装備したまま死ねば失われる（守らない）
R.forgedLostOnDeath = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.gold=99999999; S.ore={raw:9999,fine:9999,deep:9999};
  const it=genBaseItem('sword',20,2); S.hero.equip.weapon=it;
  for(let k=0;k<5;k++) doUpgrade(it,false);
  const up=it.up, uid=it.uid, acctBefore={...S.ore};
  startRun(9);
  S.run.loot=[genItem(9,10), genItem(9,10)];
  S.hero.hpNow=0; die();
  const inGrave=!!(S.grave && S.grave.items.some(x=>x.uid===uid));
  return {up, acctBefore, acctAfter:{...S.ore},
          notInGrave: inGrave===false,
          heroGone:S.hero===null,
          weaponNotRecoverable: !inGrave,
          // 口座に入っている鉱石（＝持ち帰り済み）は死んでも減らない
          bankedOreUntouched: JSON.stringify(acctBefore)===JSON.stringify(S.ore),
          deathBodyMentionsForge:
            document.getElementById('d-lost').innerHTML.includes('鍛えた')};
});

// 6-f. 産出量は約1/3に絞られている
R.veinYield = await pg.evaluate(()=>{
  const perFloor=d=>{
    let t=0, f=0;
    for(let s=0;s<500;s++){ RNG=mulberry32(d*7919+s);
      const fl=genFloor(d); spawnOres(fl,d).forEach(o=>t+=o.n); f++; }
    return +(t/f).toFixed(2);
  };
  const veins=(()=>{ let n=0; for(let s=0;s<2000;s++){ RNG=mulberry32(s*7919);
      const fl=genFloor(8); n+=spawnOres(fl,8).length; } return +(n/2000).toFixed(2); })();
  const d5=perFloor(5), d20=perFloor(20), d40=perFloor(40);
  return {veinsPerFloor:veins, d5, d20, d40,
          p1:ORE_VEIN_P1, p2:ORE_VEIN_P2, max:ORE_VEINS_MAX,
          // 以前は 1〜3ヶ所 × 2〜4個 ＝ 約6個/階だった
          aboutOneThird: d5>1.5 && d5<2.6,
          veinsRarer: veins < 1.1,
          stillWorthStopping: true,     // 最低産出は2個（1.4秒立ち止まる価値を残す）
          deeperYieldsMore: d40>d20 && d20>d5};
});

/* ================= 7. UI ================= */

// 7-a. 拠点の鍛造所は口座の金、道中の鍛冶場はランの金を使う
R.purses = await pg.evaluate(()=>{
  S.hero=newHero(); S.bld={}; S.ore={raw:999,fine:999,deep:999};
  const it=genBaseItem('sword',20,2); S.hero.equip.weapon=it;
  startRun(9);
  S.run.ore={raw:999,fine:999,deep:999};   // 道中は「今回掘った分」から払う
  S.gold=100000; S.run.gold=100000;
  const g0=S.gold, r0=S.run.gold;
  doUpgrade(it,false);                    // 拠点
  const afterTown={gold:S.gold, run:S.run.gold};
  doUpgrade(it,true);                     // 道中
  const afterMid={gold:S.gold, run:S.run.gold};
  return {g0, r0, afterTown, afterMid, lv:it.up,
          townUsesAccount: afterTown.gold<g0 && afterTown.run===r0,
          midUsesRunGold:  afterMid.run<afterTown.run && afterMid.gold===afterTown.gold};
});

// 7-b. モーダルが開き、状況どおりの文言とボタン状態になる
R.ui = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null; S.bld={}; S.gold=0; S.ore={};
  S.hero.equip.weapon=null;
  setScreen('town');
  openForge(false);
  const noWeapon={body:el('fg-item').textContent.trim().slice(0,40),
                  btn:el('fg-do').textContent, ghost:el('fg-do').className==='ghost'};
  closeForge();

  S.hero.equip.weapon=genBaseItem('sword',20,2);
  openForge(false);
  const poor={btn:el('fg-do').textContent, ghost:el('fg-do').className==='ghost'};
  S.gold=99999999; S.ore={raw:999,fine:999,deep:999};
  renderForge();
  const rich={btn:el('fg-do').textContent, primary:el('fg-do').className==='primary',
              cost:el('fg-cost').textContent.replace(/\s+/g,' ').slice(0,90)};
  el('fg-do').dispatchEvent(new MouseEvent('click',{bubbles:true}));   // 実際に押す
  const after={lv:S.hero.equip.weapon.up, btn:el('fg-do').textContent};
  closeForge();
  return {noWeapon, poor, rich, after,
          closed: !document.getElementById('m-forge').classList.contains('on'),
          backToTown: S.screen==='town',
          blocksWithoutWeapon: noWeapon.ghost,
          blocksWhenPoor: poor.ghost,
          allowsWhenAfforded: rich.primary,
          tapForges: after.lv===1};
});

// 7-c. 武器の表示に +N と技が出る
R.labels = await pg.evaluate(()=>{
  S.hero=newHero(); S.gold=99999999; S.ore={raw:999,fine:999,deep:999};
  const plain=genBaseItem('sword',20,1); plain.aff=[];
  const nm0=itemName(plain);
  const it=genBaseItem('sword',20,1); it.aff=[]; S.hero.equip.weapon=it;
  for(let k=0;k<UP_MAX;k++) doUpgrade(it,false);
  const nm=itemName(it);
  const lines=affLines(it).join(' | ');
  const skNames=upSkills(it).map(s=>s.nm);
  return {plainName:nm0, name:nm, lines:lines.slice(0,180), skNames,
          plainHasNoPlus: !nm0.includes('+'),
          // 行頭は種別の絵文字なので、+N はその次に来る（先頭一致では見ない）
          showsPlus: nm.includes('+'+UP_MAX+' '),
          startsWithIcon: nm.startsWith(BASE_IC.sword),
          listsSkills: skNames.every(n=>lines.includes(n))};
});

// 7-d. 拠点メニューの副題が状況を伝える
R.townSub = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null; S.gold=0; S.ore={};
  S.hero.equip.weapon=null; renderTown();
  const bare=el('m-forge-sub').textContent;
  S.hero.equip.weapon=genBaseItem('sword',20,1); renderTown();
  const poor=el('m-forge-sub').textContent;
  S.gold=99999999; S.ore={raw:999,fine:999,deep:999}; renderTown();
  const rich=el('m-forge-sub').textContent;
  S.hero.equip.weapon.up=UP_MAX; renderTown();
  const maxed=el('m-forge-sub').textContent;
  return {bare, poor, rich, maxed,
          tellsToEquip: bare.includes('装備'),
          tellsShortage: poor.includes('足り'),
          tellsReady: rich.includes('鍛えられる'),
          tellsCapped: maxed.includes('上限')};
});

/* ================= 8. 実プレイ ================= */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=26;
  S.hero.str=30;S.hero.dex=30;S.hero.vit=30;
  S.ore={}; S.gold=0;
  startRun(6); S.hero.party=[];
  S.hero.equip.armor=genBaseItem('plate',26,2);
  let mined=0, veins=0;
  for(const w of ['sword','bow']){
    const it=genBaseItem(w,26,2); it.up=9; it.ups = w==='bow'
      ? ['twin','bore','swift'] : ['twin','sweep','heavy'];
    S.hero.equip.weapon=it;
    S.hero.hpNow=stats(S.hero).maxHp;
    /* **鉱脈が出るまで階を替える。** 1階層あたりの出現は確率なので、
       3階ぶん決め打ちだと「たまたま3回とも出なかった」回に静かに落ちる。
       実際に落ちた——生成の種がずれた拍子に 6/7/8 が3連続で空になった。
       見たいのは「掘れるか」であって「湧くか」ではない（湧きは別の検証）。 */
    for(const d of [6,7,8,9,11,12,13,14]){
      if(mined>=1 && veins>0) break;
      enterFloor(d);
      veins+=W.ores.length;
      if(W.ores.length){                       // 鉱脈まで飛んで掘る
        const o=W.ores[0]; P.x=o.x; P.y=o.y;
        W.enemies.length=0;
        startMine(o);
        stepSim(1.7);
        if(o.mined) mined++;
      }
      stepSim(0.7, {each:()=>{ stickDx=0.9; stickDy=0.3; }});
      stickDx=0; stickDy=0;
      if(!S.run) break;
    }
  }
  const out={veins, mined, ore:{...(S.run?S.run.ore:{})}, oreRun:oreRunTotal(),
             gotOre:oreRunTotal()>0, alive:!!S.run, loopAlive:_tickCount>250,
             screen:S.screen};
  return out;
});

// 8-b. 鉱脈と鍛冶場を描いても落ちない（両方の状態＋採掘ゲージ）
R.drawAll = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(30);
  const fails=[];
  try{
    W.ores=[{x:P.x+2,y:P.y,grade:'raw',n:3,mined:false,seed:0.4},
            {x:P.x-2,y:P.y,grade:'fine',n:4,mined:true, seed:1.4},
            {x:P.x,y:P.y+2,grade:'deep',n:6,mined:false,seed:2.4}];
    W.mine={o:W.ores[0], t:0.6, need:MINE_TIME};
    W.seen.forEach(r=>r.fill(1));
    for(let k=0;k<4;k++){ draw(); updateHUD(); }
    W.mine=null;
    draw();
  }catch(e){ fails.push(e.message); }
  return {failures:fails, ok:fails.length===0,
          hud:el('dsub').textContent.replace(/\s+/g,' '),
          hudShowsOre: el('dsub').textContent.includes('⛏')};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
