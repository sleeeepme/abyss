// 酒場。棚は二つ——**連れ帰った者**（半額）と**流れ者**（定価・帰還ごとに1〜4人）。
//
// このスイートの本題は「雇えるか」ではなく、**置いていったぶんが守られるか**と
// **値段の差が意味を持つか**。
// 連れて行った相手はあなたが死ねば一緒に失われる、という線は動かさない。
// だから酒場は「失う前に決める場所」になる——そこが成立していないと、
// 値段を付けた意味がただの税になる。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 帰ってきたあと ================= */

/* 1-a. **帰っても隊から外れない。**
       一度は「街に着いたら全員酒場へ」にしていたが、毎回雇い直すのは税でしかない。
       連れて行くかどうかは潜る前に決めているので、
       同じ判断を帰るたびにやり直させても増えるのは手数だけだった。
       外したいときは酒場で預ける（1-c）。 */
R.returnKeepsParty = await pg.evaluate(()=>{
  S.tavern=[]; S.hero=newHero();
  TH.run(3,{seed:11});
  const a=makeAlly(5,S.hero), c=makeAlly(5,S.hero);
  a.x=P.x; a.y=P.y; c.x=P.x; c.y=P.y;
  S.hero.party.push(a,c);
  const before=party().length;
  returnToTown();
  return {before, partyAfter:party().length, stock:tavernStock().length,
          stillTogether: party().length===before,
          // 連れ帰った印は付く（次に雇い直すときに半額）
          marked: party().every(x=>x.returned===true),
          ok: party().length===2 && party().every(x=>x.returned===true)};
});

/* 1-b. 酒場に預けると隊から外れる。**外す側の操作。** */
R.parkMovesToTavern = await pg.evaluate(()=>{
  S.run=null;
  const a=party()[0];
  const r=tavernPark(a.uidA);
  return {moved:r.ok, leftParty: !party().includes(a),
          inTavern:tavernStock().includes(a),
          slots:party().map(m=>m.slot),
          // 隊列は詰め直す（穴が空いたまま並ばない）
          packed: party().every((m,i)=>m.slot===i),
          ok: r.ok && !party().includes(a) && tavernStock().includes(a)
              && party().every((m,i)=>m.slot===i)};
});

// 1-c. 探索中は預けられない（街の施設なので）
R.parkBlockedInRun = await pg.evaluate(()=>{
  TH.run(2,{seed:14});
  const a=party()[0];
  const r=a ? tavernPark(a.uidA) : {ok:false, why:'仲間がいない'};
  const still=a ? party().includes(a) : true;
  S.run=null;
  return {why:r.why, still, ok: !r.ok && still};
});

/* 1-d. **酒場にいる相手は主人公が死んでも失われない。**
       連れて行った相手は一緒に消える（その線は動かさない）。
       この差があるから「置いていく」が守る手になる。 */
R.survivesDeath = await pg.evaluate(()=>{
  const kept=tavernStock().map(x=>x.uidA);
  TH.run(3,{seed:12});
  S.hero.party=[];                       // 連れて下りたぶんの話は 1-e で別に見る
  S.hero.hpNow=0; die();
  return {stock:tavernStock().length, sameOnes: tavernStock().every(x=>kept.includes(x.uidA)),
          ok: tavernStock().length>=kept.length && kept.every(u=>tavernStock().some(x=>x.uidA===u))};
});

/* 1-e. **連れて下りたぶんは失われる。** ただし黙って消さず、慰霊碑に刻む。
       育てた相手が痕跡なく消えるのは、痛みではなく理不尽になる。 */
R.fallenAreCarved = await pg.evaluate(()=>{
  S.run=null; S.hero=newHero(); S.hero.party=[]; S.fallen=[];
  TH.run(3,{seed:15});
  const a=makeAlly(9,S.hero), c=makeAlly(9,S.hero);
  a.x=P.x; a.y=P.y; c.x=P.x; c.y=P.y;
  S.hero.party.push(a,c);
  const names=[a.name, c.name];
  for(let i=0;i<40 && S.hero;i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,3); }
  const carved=(S.fallen||[]).map(f=>f.name);
  return {names, carved,
          bothCarved: names.every(n=>carved.includes(n)),
          ok: names.every(n=>carved.includes(n))};
});

/* 1-f. **死んだ直後も酒場は空にしない。**
       一番人手が要るのがここなので、棚が空だと詰む。 */
R.refilledAfterDeath = await pg.evaluate(()=>{
  return {pool:tavernPool().length,
          ok: tavernPool().length>=TAVERN_ROLL[0]};
});

/* ================= 2. 値段 ================= */

// 2-a. 強い相手ほど高い
R.costRisesWithLevel = await pg.evaluate(()=>{
  S.bld={}; S.run=null; if(!S.hero) S.hero=newHero();   // 直前で死なせているので作り直す
  const lo=makeAlly(3,S.hero),  hi=makeAlly(40,S.hero);
  lo.lv=3; hi.lv=40; lo.returned=hi.returned=false;
  lo.job=hi.job='warrior';
  return {lo:hireCost(lo), hi:hireCost(hi), ok: hireCost(hi) > hireCost(lo)};
});

/* 2-b. **連れ帰った者は半額。**
       一度アビスから引き上げた相手をもう一度連れて行くのは、
       雇い直しではなく続きなので。ここに差が無いと、
       「生きて連れ帰る」こと自体に金銭的な意味が付かない。 */
R.returnedIsHalf = await pg.evaluate(()=>{
  S.bld={};
  const a=makeAlly(20,S.hero); a.lv=20; a.job='warrior';
  a.returned=false; const full=hireCost(a);
  a.returned=true;  const half=hireCost(a);
  return {full, half, mul:HIRE_RETURNED_MUL,
          isHalf: Math.abs(half - Math.round(full*HIRE_RETURNED_MUL)) <= 1,
          ok: half < full && Math.abs(half - Math.round(full*HIRE_RETURNED_MUL)) <= 1};
});

/* 2-c. **上位職は割高。** 出現率を落としてあるだけだと「引ければ得」で終わる。
       値段の側にも差を付けて、引いたあとにもう一度選ばせる。 */
R.eliteCostsMore = await pg.evaluate(()=>{
  S.bld={};
  const a=makeAlly(20,S.hero); a.lv=20; a.returned=false;
  a.job='warrior'; const plain=hireCost(a);
  a.job='paladin'; const elite=hireCost(a);
  return {plain, elite, mul:HIRE_ELITE_MUL,
          eliteJobs:ELITE_JOBS.map(j=>j.id),
          flagged: ELITE_JOBS.every(j=>isEliteJob(j.id)) && !isEliteJob('warrior'),
          ok: elite > plain && ELITE_JOBS.every(j=>isEliteJob(j.id)) && !isEliteJob('warrior')};
});

/* 2-d. 半額と割高は**重なる**。上位職を連れ帰れば、上位職のまま安くなる。
       片方が片方を打ち消すと、どちらの決定も意味を失う。 */
R.discountsStack = await pg.evaluate(()=>{
  S.bld={};
  const a=makeAlly(20,S.hero); a.lv=20; a.job='paladin';
  a.returned=false; const eliteFull=hireCost(a);
  a.returned=true;  const eliteHalf=hireCost(a);
  const b=makeAlly(20,S.hero); b.lv=20; b.job='warrior'; b.returned=false;
  const plainFull=hireCost(b);
  return {eliteFull, eliteHalf, plainFull,
          stacked: eliteHalf < eliteFull,
          stillPremium: eliteHalf > Math.round(plainFull*0.5)-2,
          ok: eliteHalf < eliteFull && eliteHalf > Math.round(plainFull*0.5)-2};
});

/* 2-b. 街開発の「酒場」を上げると安くなる。
       施設のレベルが**場所の値段**に効く形にしてある——
       今まで酒場は出現率の数字だけで、建てても街の何も変わらなかった。 */
R.buildingCutsCost = await pg.evaluate(()=>{
  const a=makeAlly(20,S.hero); a.lv=20; a.returned=false; a.job='warrior';
  S.bld={}; const lv0=hireCost(a);
  const max=BUILDINGS.find(x=>x.id==='tavern').max;
  S.bld={tavern:max}; const lvMax=hireCost(a);
  S.bld={};
  return {lv0, lvMax, max, ok: lvMax < lv0 && lvMax >= 8};
});

/* ================= 3. 雇う ================= */

// 3-a. 金を払うとパーティに入り、ストックから消える
R.hireMoves = await pg.evaluate(()=>{
  S.run=null; S.tavern=[]; S.hero=newHero(); S.hero.party=[]; S.bld={};
  const a=makeAlly(10,S.hero); a.lv=10;
  tavernPut(a);
  const cost=hireCost(a);
  S.gold=cost+50;
  const g0=S.gold;
  const r=hireAlly(a.uidA);
  return {cost, paid:g0-S.gold, inParty:party().includes(a), stock:tavernStock().length,
          full: Math.round(a.hpNow)===allyStats(a).maxHp,
          ok: r.ok && g0-S.gold===cost && party().includes(a) && tavernStock().length===0};
});

// 3-b. 金が足りなければ雇えない。**理由を返す**（黙って何も起きないのが一番困る）
R.blockedNoGold = await pg.evaluate(()=>{
  S.tavern=[]; S.hero.party=[];
  const a=makeAlly(30,S.hero); a.lv=30;
  tavernPut(a);
  S.gold=0;
  const r=hireAlly(a.uidA);
  return {why:r.why, stock:tavernStock().length, hasReason: !!r.why,
          notHired: !party().includes(a),
          ok: !r.ok && !!r.why && tavernStock().length===1};
});

// 3-c. パーティが満員なら雇えない
R.blockedWhenFull = await pg.evaluate(()=>{
  S.gold=99999; S.hero.party=[];
  for(let i=0;i<PARTY_MAX;i++){ const x=makeAlly(5,S.hero); x.slot=i; S.hero.party.push(x); }
  const a=tavernStock()[0];
  const r=hireAlly(a.uidA);
  return {party:party().length, max:PARTY_MAX, why:r.why,
          ok: !r.ok && party().length===PARTY_MAX && tavernStock().length===1};
});

// 3-d. 探索中は雇えない（街の施設なので）
R.blockedInRun = await pg.evaluate(()=>{
  S.hero.party=[];
  TH.run(2,{seed:13});
  const a=tavernStock()[0];
  const r=hireAlly(a.uidA);
  S.run=null;
  return {why:r.why, ok: !r.ok && tavernStock().length===1};
});

/* ================= 4. 溢れたとき ================= */

/* 4-a. 待たせておけるのは TAVERN_MAX 人まで。溢れたら**一番弱い1人**が去る。
       古い順に切ると、育てた相手が黙って消える事故が起きる。 */
R.overflowDropsWeakest = await pg.evaluate(()=>{
  S.run=null; S.tavern=[]; S.hero=newHero(); S.hero.party=[];
  for(let i=0;i<TAVERN_MAX;i++){ const x=makeAlly(20,S.hero); x.lv=20+i; tavernPut(x); }
  const weak=makeAlly(20,S.hero); weak.lv=1; tavernPut(weak);
  const afterWeak=tavernStock().length;
  const weakGone = !tavernStock().includes(weak);
  const strong=makeAlly(20,S.hero); strong.lv=99; tavernPut(strong);
  const lows=tavernStock().map(x=>x.lv);
  return {max:TAVERN_MAX, afterWeak, lows,
          // 弱い方（lv1）は入った瞬間に押し出され、強い方（lv99）は残る
          weakDropped: weakGone,
          strongKept: tavernStock().includes(strong),
          capped: tavernStock().length===TAVERN_MAX,
          ok: weakGone && tavernStock().includes(strong) && tavernStock().length===TAVERN_MAX};
});

/* ================= 5. 画面 ================= */

// 5-a. 街から開ける。中身が出る。タップで雇える
R.screenWorks = await pg.evaluate(()=>{
  S.run=null; S.tavern=[]; S.hero=newHero(); S.hero.party=[]; S.bld={};
  const a=makeAlly(8,S.hero); a.lv=8; tavernPut(a);
  S.gold=hireCost(a)+10;
  setScreen('town');
  const sub=el('m-tavern-sub').textContent;
  el('btn-go-tavern').click();
  const opened = S.screen==='tavern' && el('scr-tavern').classList.contains('on');
  const row=document.querySelector('[data-hire]');
  const listed=!!row;
  if(row) row.click();
  return {sub, opened, listed, inParty:party().includes(a),
          bound: !!el('scr-tavern').__rowTap,
          ok: opened && listed && party().includes(a) && sub.includes('人')};
});

// 5-b. 連れ帰った者がいないときは、そう書く（空の格子を出さない）
R.emptyLine = await pg.evaluate(()=>{
  S.tavern=[]; renderTavern();
  const t=el('tavernlist').textContent;
  return {t: t.slice(0,24), says: t.includes('連れ帰った者はいない'),
          ok: t.includes('連れ帰った者はいない')};
});

/* ================= 6. 流れ者 =================
   連れ帰った者だけだと、酒場は「誰も連れ帰れなかった回」に空になる。
   一番人手が要るのは**全滅して帰った直後**なので、そこで空の棚を見せるのは順序が逆。 */

// 6-a. 帰るたびに 1〜4 人が並ぶ
R.poolRolls = await pg.evaluate(()=>{
  S.run=null; S.hero=newHero(); S.hero.party=[]; S.tavern=[];
  const counts=new Set(); let min=99, max=0;
  for(let i=0;i<80;i++){
    rerollTavern();
    const n=tavernPool().length;
    counts.add(n); min=Math.min(min,n); max=Math.max(max,n);
  }
  return {range:TAVERN_ROLL, seen:[...counts].sort(), min, max,
          inRange: min>=TAVERN_ROLL[0] && max<=TAVERN_ROLL[1],
          varies: counts.size>1,
          ok: min>=TAVERN_ROLL[0] && max<=TAVERN_ROLL[1] && counts.size>1};
});

/* 6-b. **誰も連れ帰らなくても雇える。** 全滅して手ぶらで帰った直後が
       一番人手の要る場面なので、そこで棚が空だと詰む。 */
R.poolWhenNothingReturned = await pg.evaluate(()=>{
  S.run=null; S.tavern=[]; S.tavernPool=null;
  S.hero=newHero(); S.hero.party=[]; S.gold=99999; S.bld={};
  setScreen('tavern');
  const rows=document.querySelectorAll('#tavernpool [data-hire]').length;
  const backEmpty=el('tavernlist').textContent.includes('連れ帰った者はいない');
  const first=tavernPool()[0];
  const r=hireAlly(first.uidA);
  return {rows, backEmpty, hired:r.ok, inParty:party().includes(first),
          poolAfter:tavernPool().length,
          ok: rows>=1 && backEmpty && r.ok && party().includes(first)};
});

// 6-c. 流れ者は定価（連れ帰った印を持たない）
R.poolIsFullPrice = await pg.evaluate(()=>{
  S.tavernPool=null; rerollTavern();
  const allFull = tavernPool().every(a=>!a.returned);
  return {n:tavernPool().length, allFull, ok: allFull};
});

/* 6-d. 品揃えと同じで**帰還のたびに入れ替わる。**
       常設にすると「良いのが出るまで街を出入りする」が最適手になってしまう。 */
R.poolRerollsOnReturn = await pg.evaluate(()=>{
  S.run=null; S.tavern=[]; S.hero=newHero(); S.hero.party=[];
  S.tavernPool=null; rerollTavern();
  const before=tavernPool().map(a=>a.uidA).join(',');
  TH.run(3,{seed:31});
  returnToTown();
  const after=tavernPool().map(a=>a.uidA).join(',');
  return {before, after, replaced: before!==after, ok: before!==after};
});

// 6-e. 連れ帰った者と流れ者は、別々の棚に出る
R.twoShelves = await pg.evaluate(()=>{
  S.run=null; S.hero=newHero(); S.hero.party=[];
  S.tavern=[]; const back=makeAlly(9,S.hero); back.lv=9; tavernPut(back);
  S.tavernPool=null; rerollTavern();
  renderTavern();
  const backRows=[...document.querySelectorAll('#tavernlist [data-hire]')].map(n=>+n.dataset.hire);
  const poolRows=[...document.querySelectorAll('#tavernpool [data-hire]')].map(n=>+n.dataset.hire);
  return {backRows, poolRows,
          backHasIt: backRows.includes(back.uidA),
          poolLacksIt: !poolRows.includes(back.uidA),
          poolShown: poolRows.length===tavernPool().length,
          ok: backRows.includes(back.uidA) && !poolRows.includes(back.uidA)
              && poolRows.length===tavernPool().length};
});

/* 6-f. 半額の印は、**生きて連れ帰った相手にだけ**付く。
       帰っても隊からは外れないので、印は隊にいるまま付く。
       流れ者には付かない（定価）。 */
R.returnMarks = await pg.evaluate(()=>{
  S.run=null; S.tavern=[]; S.hero=newHero(); S.hero.party=[];
  TH.run(3,{seed:32});
  const a=makeAlly(5,S.hero); a.x=P.x; a.y=P.y; a.returned=false;
  S.hero.party.push(a);
  returnToTown();
  const still=party().find(x=>x.uidA===a.uidA);
  // 預ければ、その印を持ったまま酒場へ移る＝半額で連れ出せる
  tavernPark(a.uidA);
  const parked=tavernStock().find(x=>x.uidA===a.uidA);
  S.bld={};
  const half=parked ? hireCost(parked) : 0;
  const asIfNew=parked ? Math.round((20+parked.lv*6)) : 0;
  return {marked: !!still && still.returned===true,
          parkedKeepsMark: !!parked && parked.returned===true,
          half, asIfNew,
          poolUnmarked: tavernPool().every(x=>!x.returned),
          ok: !!still && still.returned===true
              && !!parked && parked.returned===true
              && half < asIfNew
              && tavernPool().every(x=>!x.returned)};
});

await done(b, errs, R);
