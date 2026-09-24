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
//  ・ログの上に通知が出る（#potnote）。**画面は止めない**——
//    「画面停止せずにログのところにステータスが上がった通知のような感じで
//    少し目立つように出してほしい」という要望への対応で、以前の
//    「止めてカードを出す」方式から乗り換えた
//  ・一度に複数レベル上がっても通知は1枚（全部まとめて並べる）
//  ・出しっぱなしにせず、数秒で自分から消える
//  ・何度レベルアップを繰り返しても出続ける（詰まらない）
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
  _charPotPend=[]; _potNoteT=0;
  const nd=document.getElementById('potnote');
  nd.classList.remove('on'); nd.innerHTML='';
  addXp(a, need, false);
  return {allyLeveled: a.lv===6,
          allyHasNoCharPot: !a.charPot || a.charPot.length===0,
          pendUnchanged: _charPotPend.length===0,
          noticeStaysHidden: !nd.classList.contains('on'),
          ok: a.lv===6 && (!a.charPot || a.charPot.length===0)
              && !nd.classList.contains('on')};
});

/* ============ 3. ログの上に通知が出る（画面は止めない） ============
   報告「レベルアップ時に出る資質はまだおどろく」への対応で、
   止めてカードを出す方式をやめ、ログの上の通知に変えた。
   **止まらない**ことが直したかった点そのものなので、
   gamePaused() が false のままであることを必ず見る。 */
R.noticeShown = await pg.evaluate(()=>{
  TH.run(1,{seed:13}); S.hero.party=[];
  S.hero.charPot=[]; _charPotPend=[]; _potNoteT=0;
  setScreen('game');
  const nd=document.getElementById('potnote');
  nd.classList.remove('on'); nd.innerHTML='';
  const need=xpNeed(S.hero.lv);
  addXp(S.hero, need, true);
  const pot=S.hero.charPot[S.hero.charPot.length-1];
  const html=nd.innerHTML;
  return {
    noticeOn: nd.classList.contains('on'),
    screenStaysGame: S.screen==='game',
    notPaused: !gamePaused(),                       // ← 止めないのが要件
    noModalOpened: !document.querySelector('.modal.on'),
    showsRarity: html.includes(RARITY[pot.tier].nm),
    showsValue: html.includes('<b>'+pot.v+'</b>'),  // 太字は数字だけ
    colored: nd.style.getPropertyValue('--pn-col').length>0,
    animPlaying: nd.classList.contains('pot-note-anim'),
    pendDrained: _charPotPend.length===0,
    ok: nd.classList.contains('on') && S.screen==='game' && !gamePaused()
        && !document.querySelector('.modal.on')
        && html.includes(RARITY[pot.tier].nm) && html.includes('<b>'+pot.v+'</b>')};
});

/* ============ 4. 一度に複数レベル上がっても通知は1枚 ============
   1レベルごとに出し直すと、log() と同じで直前の通知を自分で消してしまい、
   最後の1個しか見えない。全部まとめて1枚に並べる。 */
R.mergedMultiLevel = await pg.evaluate(()=>{
  TH.run(1,{seed:14}); S.hero.party=[];
  S.hero.lv=3; S.hero.xp=0; S.hero.charPot=[]; _charPotPend=[]; _potNoteT=0;
  setScreen('game');
  const nd=document.getElementById('potnote');
  nd.classList.remove('on'); nd.innerHTML='';
  const big = xpNeed(3)+xpNeed(4)+xpNeed(5)+1;      // 3レベルぶん
  addXp(S.hero, big, true);
  const gained=S.hero.charPot.length;
  const lines=nd.querySelectorAll('.pn-line').length;
  // 3個ぶんの値がすべて載っている（1個だけ残って他が消えていない）
  const allValuesShown=S.hero.charPot.every(p=>nd.innerHTML.includes('<b>'+p.v+'</b>'));
  return {gained, lines, allValuesShown,
          notPaused: !gamePaused(),
          oneNotice: nd.classList.contains('on'),
          ok: gained===3 && lines===3 && allValuesShown && !gamePaused()};
});

/* ============ 4b. 数秒で自分から消える ============ */
R.noticeFades = await pg.evaluate(()=>{
  TH.run(1,{seed:18}); S.hero.party=[];
  S.hero.charPot=[]; _charPotPend=[]; _potNoteT=0;
  setScreen('game');
  addXp(S.hero, xpNeed(S.hero.lv), true);
  const nd=document.getElementById('potnote');
  const onAtFirst=nd.classList.contains('on');
  tickPotNote(POTNOTE_SEC*0.5);
  const stillOnHalfway=nd.classList.contains('on');
  tickPotNote(POTNOTE_SEC);
  const goneAfter=!nd.classList.contains('on') && nd.innerHTML==='';
  return {onAtFirst, stillOnHalfway, goneAfter,
          ok: onAtFirst && stillOnHalfway && goneAfter};
});

/* ============ 4c. 何度上がっても出続ける（詰まらない） ============
   報告「たまにレベルアップしても出なくなる事があった」の再発防止。
   原因は、1枚ずつ見せるためのキューが**閉じる関数を通らずにモーダルが
   閉じられる**（setScreen は全モーダルから .on を外すが、キューには
   触らない）と先頭を抱えたまま戻らず、以後まったく出なくなることだった。
   途中で画面を行き来しても出続けることを、10回ぶん確かめる。 */
R.neverWedges = await pg.evaluate(()=>{
  TH.run(1,{seed:19}); S.hero.party=[];
  S.hero.charPot=[]; _charPotPend=[]; _potNoteT=0;
  setScreen('game');
  const nd=document.getElementById('potnote');
  const shown=[];
  for(let i=0;i<10;i++){
    nd.classList.remove('on'); nd.innerHTML='';       // 消えた状態から始める
    addXp(S.hero, xpNeed(S.hero.lv), true);
    shown.push(nd.classList.contains('on'));
    // 途中で街に寄って戻る（ここで詰まっていた）
    if(i%3===2){ setScreen('town'); setScreen('game'); }
  }
  return {shown, shownCount:shown.filter(Boolean).length,
          potCount:S.hero.charPot.length,
          leftOver:_charPotPend.length,
          ok: shown.every(Boolean) && S.hero.charPot.length===10 && _charPotPend.length===0};
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
