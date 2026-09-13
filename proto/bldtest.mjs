/* 街まわりの検証。
   ・慰霊碑／鍛冶屋／倉庫／酒場は街開発で建ててから使う（Lv.0 は更地）
   ・雇用費は Lv×50 を軸に、後半はレートが上がる
   ・生きて街へ帰ると全員が満タンに戻る
   ・疾風の加護は「生きて帰った階」まで効く（そこで死んだ階は含まない）

   真偽値はすべて「true＝期待どおり」。false が1つでも出れば失敗（sweep の約束）。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 施設の解放 ================= */

/* 1-a. 建てる前は4つとも閉じている。能力強化・街開発・店・ガチャは閉じない
       （潜る前に必ず通る道なので、ここを塞ぐと金の使い道が分からなくなる）。 */
R.lockedUntilBuilt = await pg.evaluate(()=>{
  S.bld={};
  const gated=['mem','forge','stash','tavern'].map(k=>hubUnlocked(k));
  return {gated,
          allClosed: gated.every(v=>v===false),
          gateMap: Object.keys(HUB_GATE).sort().join(','),
          ok: gated.every(v=>v===false)
              && Object.keys(HUB_GATE).sort().join(',')==='forge,mem,stash,tavern'};
});

// 1-b. Lv.1 にすると、その施設だけが開く
R.opensAtLv1 = await pg.evaluate(()=>{
  S.bld={tavern:1};
  const t=hubUnlocked('tavern'), f=hubUnlocked('forge');
  S.bld={tavern:1, forge:1, stash:1, altar:1};
  const all=['mem','forge','stash','tavern'].every(k=>hubUnlocked(k));
  return {tavernOpen:t, forgeStillClosed:f===false, allOpen:all,
          ok: t===true && f===false && all};
});

/* 1-c. 閉じている入口は押しても開かない。**押せなくはしない**——
       押せないボタンは、押せない理由も言えないため。 */
R.lockedEntranceStops = await pg.evaluate(()=>{
  S.bld={}; setScreen('town');
  el('btn-go-tavern').click();
  const stayed = S.screen==='town';
  const told   = el('toast').classList.contains('on')
              && el('toast').textContent.includes('街開発');
  return {screen:S.screen, stayed, told, toast:el('toast').textContent.slice(0,40),
          ok: stayed && told};
});

// 1-d. 建てていない入口はグレーで残る（消さない。件数バッジも伏せる）
R.lockedLooksGrey = await pg.evaluate(()=>{
  S.bld={tavern:1}; setScreen('town'); renderTown();
  const cls = k => el('btn-go-'+k).classList.contains('locked');
  const shown = k => getComputedStyle(el('btn-go-'+k)).display!=='none';
  return {mem:cls('mem'), forge:cls('forge'), stash:cls('stash'),
          tavernOpen: cls('tavern')===false,
          stillVisible: ['mem','forge','stash','tavern'].every(shown),
          ok: cls('mem') && cls('forge') && cls('stash') && !cls('tavern')
              && ['mem','forge','stash','tavern'].every(shown)};
});

/* 1-e. Lv.1 の値段は「第5階層まで潜って生きて帰れば1つ建つ」あたり。
       第5階層の帰還報酬は 18×5×(1+5/40)=101 G で、これに道中の拾得が乗る。
       4施設とも 120〜220 G の帯に収める（1回の帰還で1つ、が目安）。 */
R.firstStepAffordable = await pg.evaluate(()=>{
  const costs={};
  ['forge','tavern','altar','stash'].forEach(id=>{
    const b=BUILDINGS.find(x=>x.id===id);
    costs[id]=bldCost(b,0);
  });
  const vals=Object.values(costs);
  return {costs, inBand: vals.every(c=>c>=120 && c<=220),
          ok: vals.every(c=>c>=120 && c<=220)};
});

// 1-f. 慰霊碑は街の 🕯️ ボタンと同じ名前で建つ（建てた物と開く場所が繋がって見える）
R.altarNamedMemorial = await pg.evaluate(()=>{
  const b=BUILDINGS.find(x=>x.id==='altar');
  const btn=el('btn-go-mem').querySelector('b').textContent;
  return {bld:b.nm, btn, same: b.nm===btn, ok: b.nm===btn};
});

/* ================= 2. 雇用費 ================= */

/* 2-a. Lv×50 を軸に、後半はレートが上がる（＝比例より上に曲がる）。
       比例のままだと、1人の効きが大きい深いところほど安く感じる。 */
R.hirePrice = await pg.evaluate(()=>{
  S.bld={};
  const c = lv => hireCost({lv, job:'warrior'});
  const per = lv => c(lv)/lv;                    // 1レベルあたりの単価
  return {lv1:c(1), lv10:c(10), lv30:c(30), lv50:c(50),
          base50: c(1)===50,
          risesWithLevel: c(1)<c(10) && c(10)<c(30) && c(30)<c(50),
          lateRateUp: per(50) > per(10) && per(10) >= per(1),
          ok: c(1)===50 && c(10)<c(30) && per(50)>per(10)};
});

// 2-b. 街開発の酒場を上げると安くなる／連れ帰った者は半額（従来どおり）
R.hireDiscounts = await pg.evaluate(()=>{
  S.bld={};
  const full=hireCost({lv:20, job:'warrior'});
  S.bld={tavern:5};
  const built=hireCost({lv:20, job:'warrior'});
  S.bld={};
  const back=hireCost({lv:20, job:'warrior', returned:true});
  return {full, built, back,
          cheaperWhenBuilt: built<full, halfWhenReturned: back<full,
          ok: built<full && back<full};
});

/* ================= 3. 街に帰ったら休める ================= */

/* 3-a. 生きて帰ると主人公も仲間も満タンに戻り、状態異常も落ちる。
       街に宿屋を置いていないので、帰還そのものを休息にしてある。 */
R.townHeals = await pg.evaluate(()=>{
  /* 帰れるのは帰還ポータルのある階だけ（5階ごと）。
     ここを 4 にしていて returnToTown() が何もせず帰ってきた——
     「回復しない」ではなく「そもそも帰っていない」だった。 */
  S.hero=newHero(); S.hero.party=[];
  TH.run(5,{seed:11});
  const a=TH.ally(5,'warrior',4); a.x=P.x; a.y=P.y; a.slot=0; S.hero.party.push(a);
  S.hero.hpNow=1; a.hpNow=1;
  addStatus({isPlayer:true, st:S.run.pst, lv:S.hero.lv}, 'burn', 5);
  addStatus(a,'burn',5);
  const hurt={hero:S.hero.hpNow, ally:a.hpNow};
  returnToTown();
  const mx=stats(S.hero).maxHp, amx=allyStats(a).maxHp;
  return {hurt, hero:S.hero.hpNow, max:mx, ally:a.hpNow, allyMax:amx,
          heroFull: S.hero.hpNow===mx, allyFull: a.hpNow===amx,
          ailmentsCleared: !a.st || Object.keys(a.st).length===0,
          ok: S.hero.hpNow===mx && a.hpNow===amx};
});

// 3-b. 倒れた仲間は戻らない（帰還で死が無効になってはいけない）
R.townDoesNotRevive = await pg.evaluate(()=>{
  S.hero=newHero(); S.hero.party=[];
  TH.run(5,{seed:12});
  const a=TH.ally(5,'warrior',4); a.x=P.x; a.y=P.y; a.slot=0; S.hero.party.push(a);
  a.dead=true; a.hpNow=0;
  returnToTown();
  return {dead:a.dead, hp:a.hpNow, stillDead: a.dead===true && a.hpNow===0,
          ok: a.dead===true && a.hpNow===0};
});

/* ================= 4. 疾風の加護 ================= */

/* 4-a. 第5階層から生きて帰ったら、次は第5階層まで足が速い。
       抜ける（次の階へ降りる）ことだけを条件にしていたので、
       「帰った階だけ遅い」という逆さまな形になっていた（報告）。 */
R.graceCoversReturnedFloor = await pg.evaluate(()=>{
  S.hero=newHero(); S.hero.party=[]; S.deepest=1; S.deepestBack=0;
  TH.run(5,{seed:13});
  const beforeReturn = windGrace();       // 初回は加護なし（まだ帰っていない）
  returnToTown();
  const recorded = S.deepestBack;
  TH.run(5,{seed:14});
  const at5 = windGrace();
  TH.run(6,{seed:15});
  const at6 = windGrace();
  /* 生の真偽値はそのまま返さない。**掃引は false を1つでも見つけたら失敗**にするので、
     「加護が掛かっていないのが正しい」場面の値は肯定形に言い換えて返す。 */
  return {recorded,
          firstRunNoGrace: beforeReturn===false,
          recordedDepth: recorded===5,
          graceAt5: at5===true,
          endsAtUnknownFloor: at6===false,
          ok: beforeReturn===false && recorded===5 && at5===true && at6===false};
});

/* 4-b. そこで死んだ階は含まない。倒れた以上まだ抜けていない、という元の筋は残す。 */
R.graceNotFromDeath = await pg.evaluate(()=>{
  S.hero=newHero(); S.hero.party=[]; S.deepest=1; S.deepestBack=0;
  TH.run(5,{seed:16});
  S.deepest=5;                       // 到達はした
  S.hero.hpNow=0; die();
  const recorded=S.deepestBack||0;
  S.hero=newHero(); S.hero.party=[];
  TH.run(5,{seed:17});
  const at5=windGrace();
  return {recorded, noBackRecord: recorded===0, noGrace: at5===false,
          ok: recorded===0 && at5===false};
});

await done(b, errs, R);
