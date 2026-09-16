// プレイヤーキャラの「潜在」（レベルアップで1つずつ手に入る）。
//
// ユーザー要望：「プレイヤーキャラのレベルアップごとにランダムに1個潜在が
// 手に入るようにしたい。テキストだけだと分かりづらいのでカードが出るような
// 演出を入れたい」への実装の検証。
//
//  ・レベルアップのたびに**必ず**1個手に入る（装備の潜在と違い、確率で
//    付いたり付かなかったりはしない）
//  ・ランダムなのは効果の種類と強さ（色）だけ——装備の潜在と同じ抽選プール
//  ・実際に stats() へ乗る（表示だけの飾りではない）
//  ・カードが出る（m-charpot が開き、S.screen が切り替わる）
//  ・一度に複数レベル上がってもカードは1枚ずつ（キューで順番に）
//  ・仲間（プレイヤーキャラ以外）はレベルアップしても対象外
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ============ 1. レベルアップで必ず1個手に入る ============ */
R.grantedOnLevelUp = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); S.hero.party=[];
  S.hero.lv=5; S.hero.xp=0; S.hero.charPot=[];
  const before=S.hero.charPot.length;
  const need=xpNeed(S.hero.lv);
  addXp(S.hero, need, true);              // ちょうど1回だけ上がる量
  const after=S.hero.charPot.length;
  const pot=S.hero.charPot[0];
  return {before, after, lvAfter:S.hero.lv,
          gotExactlyOne: after===before+1,
          leveledUp: S.hero.lv===6,
          shapeOk: !!pot && pot.t==='pt' && typeof pot.stat==='string' && pot.v>0
                   && pot.tier>=0 && pot.tier<=4,
          ok: after===before+1 && S.hero.lv===6 && !!pot && pot.v>0};
});

/* ============ 2. 仲間はレベルアップしても対象外 ============ */
R.allyNotGranted = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); S.hero.party=[];
  const a=TH.ally(1,'warrior',5); a.xp=0; S.hero.party.push(a);
  const need=xpNeed(a.lv);
  _charPotQueue=[];
  const queueBefore=_charPotQueue.length;
  addXp(a, need, false);
  return {allyLeveled: a.lv===6,
          allyHasNoCharPot: !a.charPot || a.charPot.length===0,
          queueUnchanged: _charPotQueue.length===queueBefore,
          modalStaysClosed: !document.getElementById('m-charpot').classList.contains('on'),
          ok: a.lv===6 && (!a.charPot || a.charPot.length===0)
              && !document.getElementById('m-charpot').classList.contains('on')};
});

/* ============ 3. カードが出る（演出） ============ */
R.cardShown = await pg.evaluate(()=>{
  TH.run(1,{seed:13}); S.hero.party=[];
  S.hero.charPot=[]; _charPotQueue=[];
  setScreen('game');
  document.getElementById('m-charpot').classList.remove('on');
  const need=xpNeed(S.hero.lv);
  addXp(S.hero, need, true);
  const pot=S.hero.charPot[S.hero.charPot.length-1];
  const col=RARCOL[pot.tier];
  const cardHtml=document.getElementById('cp-card').innerHTML;
  const modalOn=document.getElementById('m-charpot').classList.contains('on');
  const screenSwitched=S.screen==='charpot';
  const showsRarity=cardHtml.includes(RARITY[pot.tier].nm);
  const showsBorderColor=document.getElementById('cp-card').style.borderColor.length>0;
  // 閉じると探索画面に戻る
  closeCharPotCard();
  const closedOk = !document.getElementById('m-charpot').classList.contains('on') && S.screen==='game';
  return {modalOn, screenSwitched, showsRarity, showsBorderColor, closedOk,
          ok: modalOn && screenSwitched && showsRarity && showsBorderColor && closedOk};
});

/* ============ 4. 一度に複数レベル上がると、カードは1枚ずつキューで出る ============ */
R.queuedMultiLevel = await pg.evaluate(()=>{
  TH.run(1,{seed:14}); S.hero.party=[];
  S.hero.lv=3; S.hero.xp=0; S.hero.charPot=[]; _charPotQueue=[];
  setScreen('game');
  document.getElementById('m-charpot').classList.remove('on');
  // 3レベルぶんを一気に与える
  const big = xpNeed(3)+xpNeed(4)+xpNeed(5)+1;
  addXp(S.hero, big, true);
  const gained = S.hero.charPot.length;         // 3個ぶん貯まっている
  const queueLenAfterGrant = _charPotQueue.length;
  // 1枚目が見えている
  const modalOnAfterGrant = document.getElementById('m-charpot').classList.contains('on');
  // 閉じるたびに1つずつ減り、最後に探索へ戻る
  const seenBeforeEachClose=[];
  while(_charPotQueue.length){
    seenBeforeEachClose.push(_charPotQueue.length);
    closeCharPotCard();
  }
  const closesNeeded = seenBeforeEachClose.length;
  const backToGame = S.screen==='game' && !document.getElementById('m-charpot').classList.contains('on');
  return {gained, queueLenAfterGrant, modalOnAfterGrant, closesNeeded, backToGame,
          matchesGain: queueLenAfterGrant===gained && closesNeeded===gained,
          ok: gained===3 && queueLenAfterGrant===3 && modalOnAfterGrant
              && closesNeeded===3 && backToGame};
});

/* ============ 5. 実際に stats() へ乗る（表示だけの飾りではない） ============ */
R.affectsStats = await pg.evaluate(()=>{
  TH.run(1,{seed:15}); S.hero.party=[];
  // mf（発見力）は乗算や他の恩寵の影響を受けにくい素直な加算なので、
  // 前後の差分がそのまま検証になる。
  S.hero.charPot=[];
  const mfBefore=stats(S.hero).mf;
  S.hero.charPot=[{t:'pt', id:'pot_mf', stat:'mf', v:7, tier:0}];
  const mfAfter=stats(S.hero).mf;
  return {mfBefore, mfAfter, diff:mfAfter-mfBefore, ok: mfAfter-mfBefore===7};
});

/* ============ 6. 同じ効果が複数あれば合算される ============ */
R.stacksAdditively = await pg.evaluate(()=>{
  TH.run(1,{seed:16}); S.hero.party=[];
  S.hero.charPot=[
    {t:'pt', id:'pot_mf', stat:'mf', v:3, tier:0},
    {t:'pt', id:'pot_mf', stat:'mf', v:5, tier:2},
  ];
  const mfWith=stats(S.hero).mf;
  S.hero.charPot=[];
  const mfWithout=stats(S.hero).mf;
  return {mfWith, mfWithout, diff:mfWith-mfWithout, ok: mfWith-mfWithout===8};
});

/* ============ 7. 色（強さ）の分布が装備の潜在と同じ抽選重みに従う ============ */
R.tierDistribution = await pg.evaluate(()=>{
  TH.run(1,{seed:17});
  const N=20000, counts=[0,0,0,0,0];
  for(let i=0;i<N;i++){ const p=rollCharPotential(S.hero); counts[p.tier]++; }
  const tot=POTENTIAL_TIER_W.reduce((a,b)=>a+b,0);
  const expect=POTENTIAL_TIER_W.map(w=>w/tot*100);
  const actual=counts.map(c=>c/N*100);
  // ざっくりで良い。Commonが最多、Relicが最少という向きだけは必ず守る
  const orderedRight = actual[0]>actual[1] && actual[1]>actual[2]
                     && actual[2]>actual[3] && actual[3]>actual[4];
  const closeEnough = actual.every((v,i)=>Math.abs(v-expect[i])<3);
  return {expect, actual, orderedRight, closeEnough, ok: orderedRight && closeEnough};
});

/* ============ 8. ステータス画面の一覧に反映される ============ */
R.listedOnCharScreen = await pg.evaluate(()=>{
  S.hero.charPot=[
    {t:'pt', id:'pot_dmg', stat:'dmgPct', v:4, tier:0},
    {t:'pt', id:'pot_dmg', stat:'dmgPct', v:8, tier:2},
  ];
  const html=charPotListHTML(S.hero);
  const showsTotal = html.includes('12');       // 4+8 が合算されて出る
  const showsCount = html.includes('×2');
  const emptyHtml = charPotListHTML({charPot:[]});
  return {showsTotal, showsCount,
          emptyOk: emptyHtml.includes('まだ無い'),
          ok: showsTotal && showsCount && emptyHtml.includes('まだ無い')};
});

await done(b, errs, R);
