// リワード広告まわり（仲間の蘇生・階段での全体回復）を実タップで検証する。
// 「モーダルが重なって視聴完了ボタンを押せない」という回帰を捕まえるのが主目的なので、
// evaluate ではなく必ず pg.tap() を通す。
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
/* 広告の視聴完了を待つ。
   固定で 6 秒待っていたが、これは2つの意味で良くなかった:
   ・AD_SECONDS(5秒) より必ず長く待つので、毎回 1 秒近く無駄に寝ていた
   ・「完了するまでボタンが押せない」ことを**確かめていなかった**（待てば押せる、しか見ていない）
   完了ボタンが disabled から外れるのを待てば、待ち時間は必要なぶんちょうどになり、
   そのうえで「途中では押せなかった」ことが検証になる。
   ダミー広告のタイマーは実時間の setInterval なので、ここは stepSim では飛ばせない
   ——そして飛ばすべきでもない。報酬が完了後にしか出ないことがこのスイートの本題なので。 */
const waitAd = async ()=>{
  const lockedMidway = await pg.evaluate(()=>document.getElementById('ad-ok').disabled);
  await pg.waitForFunction(()=>!document.getElementById('ad-ok').disabled, null, {timeout:15000});
  return lockedMidway;
};


/* 指で押せるか＝その座標にその要素が実際に出ているか */
const topAt = (sel)=>pg.evaluate(s=>{
  const n=document.querySelector(s); if(!n) return null;
  const r=n.getBoundingClientRect();
  const t=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  if(!t) return null;
  return t===n || n.contains(t) ? 'self' : (t.id || t.tagName+'.'+t.className);
}, sel);
const tap = async (sel, ms=4000)=>{
  try{ await pg.tap(sel,{timeout:ms}); return null; }
  catch(e){ return String(e.message).split('\n')[0]; }
};
const modals = ()=>pg.evaluate(()=>[...document.querySelectorAll('.modal.on')].map(m=>m.id));

/* ============ 1. 仲間の蘇生（実タップ） ============ */

await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const a=makeAlly(10,S.hero); a.x=P.x; a.y=P.y; a.lv=7; a.hpNow=1;
  S.hero.party.push(a);
  hitAlly(a,{lv:30,atkV:9999,dt:'blunt',dead:false});
});
await pg.waitForTimeout(300);

R.fallenOpens = {
  modals: await modals(),
  reviveTappable: await topAt('#fal-revive'),
};
R.fallenOpens.ok = R.fallenOpens.modals.includes('m-fallen')
                && R.fallenOpens.reviveTappable==='self';

const tapRevive = await tap('#fal-revive');
await pg.waitForTimeout(300);
// ここが今回のバグの本体: 広告と仲間死亡モーダルが重なって OK が押せなかった
R.adOnTop = {
  tapReviveError: tapRevive,
  modals: await modals(),
  okReachable: await topAt('#ad-ok'),
};
R.adOnTop.onlyAdShown = R.adOnTop.modals.length===1 && R.adOnTop.modals[0]==='m-ad';
R.adOnTop.notCovered  = R.adOnTop.okReachable==='self';

R.reviveLockedMidway = await waitAd();          // 完了するまで押せないことも確かめる
const tapOk = await tap('#ad-ok');
await pg.waitForTimeout(400);
R.reviveDone = await pg.evaluate(()=>{
  const a=party()[0];
  return {tapOkError:null, modals:[...document.querySelectorAll('.modal.on')].map(m=>m.id),
          revived:a&&a.revived, dead:a&&a.dead, lv:a&&a.lv, screen:S.screen,
          hpFull: !!a && Math.round(a.hpNow)===allyStats(a).maxHp};
});
R.reviveDone.tapOkError = tapOk;
/* 蘇生してもレベルは**そのまま**。以前はここで Lv.1 に戻していたが、
   弔い（欠片に変える道）はレベルを保ったまま数えるので、
   広告を見て連れ戻すほうが常に損になっていた。連れ戻す側を軽くする。 */
R.reviveDone.keepsLevel = R.reviveDone.lv===7;
R.reviveDone.ok = tapOk===null && R.reviveDone.revived===true
               && R.reviveDone.dead===false && R.reviveDone.lv===7;

/* 1-b. 広告を中断したら、元の「仲間が倒れた」画面に戻る */
await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const a=makeAlly(10,S.hero); a.x=P.x; a.y=P.y; a.hpNow=1;
  S.hero.party.push(a);
  hitAlly(a,{lv:30,atkV:9999,dt:'blunt',dead:false});
});
await pg.waitForTimeout(300);
await tap('#fal-revive');
await pg.waitForTimeout(300);
const cancelErr = await tap('#ad-cancel');
await pg.waitForTimeout(300);
R.cancelRestores = {
  cancelError:cancelErr,
  modals: await modals(),
  reviveTappableAgain: await topAt('#fal-revive'),
  stillDead: await pg.evaluate(()=>party()[0].dead),
};
R.cancelRestores.ok = R.cancelRestores.modals.includes('m-fallen')
                   && R.cancelRestores.reviveTappableAgain==='self'
                   && R.cancelRestores.stillDead===true;

/* 1-c. 見送るとロストする（こちらは元から動いていた） */
const letErr = await tap('#fal-let');
await pg.waitForTimeout(300);
R.letGo = {letError:letErr,
  partyEmpty: await pg.evaluate(()=>party().length===0),
  screen: await pg.evaluate(()=>S.screen)};
R.letGo.ok = letErr===null && R.letGo.partyEmpty;

/* ============ 2. 階段での全体回復 ============ */

await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  for(let i=0;i<2;i++){
    const a=makeAlly(10,S.hero); a.x=P.x; a.y=P.y;
    uniqueAllyName(a,party()); S.hero.party.push(a);
    a.hpNow=allyStats(a).maxHp*0.25;
  }
  S.hero.hpNow=stats(S.hero).maxHp*0.4;
  S.run.bossAlive=false;
  openStairs();
});
await pg.waitForTimeout(300);
R.stairsUI = await pg.evaluate(()=>({
  perRun: HEAL_ADS_PER_RUN,
  left: S.run.healAds,
  btn: document.getElementById('st-heal').textContent,
  showsEveryone: (()=>{
    const t=document.getElementById('st-heal-box').textContent;
    return t.includes(S.hero.name) && party().every(a=>t.includes(a.name));
  })(),
}));
R.stairsUI.healTappable = await topAt('#st-heal');
R.stairsUI.ok = R.stairsUI.left===R.stairsUI.perRun
             && R.stairsUI.showsEveryone && R.stairsUI.healTappable==='self';

const hpBefore = await pg.evaluate(()=>({
  hero:Math.round(S.hero.hpNow), allies:party().map(a=>Math.round(a.hpNow))}));
const tapHeal = await tap('#st-heal');
await pg.waitForTimeout(300);
R.healAdShown = {tapError:tapHeal, modals: await modals(), okReachable: await topAt('#ad-ok')};
R.healAdShown.ok = R.healAdShown.modals.length===1
                && R.healAdShown.modals[0]==='m-ad'
                && R.healAdShown.okReachable==='self';

R.healLockedMidway = await waitAd();
const tapHealOk = await tap('#ad-ok');
await pg.waitForTimeout(400);
R.healed = await pg.evaluate(()=>({
  modals:[...document.querySelectorAll('.modal.on')].map(m=>m.id),
  heroFull: Math.round(S.hero.hpNow)===stats(S.hero).maxHp,
  alliesFull: party().every(a=>Math.round(a.hpNow)===allyStats(a).maxHp),
  left:S.run.healAds,
  btn:document.getElementById('st-heal').textContent}));
R.healed.hpBefore=hpBefore;
R.healed.tapError=tapHealOk;
R.healed.ok = tapHealOk===null && R.healed.heroFull && R.healed.alliesFull
           && R.healed.left===1
           && R.healed.modals.includes('m-stairs');   // 階段画面に戻ってくる

/* 2-b. 満タンなら押せない（広告の無駄打ちをさせない） */
R.noWaste = await pg.evaluate(()=>{
  renderStairHeal();
  const btn=document.getElementById('st-heal');
  const before=S.run.healAds;
  stairHeal();                                   // 満タンの状態で呼んでも何も起きない
  return {label:btn.textContent, ghost:btn.className==='ghost',
          adStayedClosed: !document.getElementById('m-ad').classList.contains('on'),
          left:S.run.healAds, unchanged:S.run.healAds===before};
});
R.noWaste.ok = R.noWaste.ghost && R.noWaste.adStayedClosed && R.noWaste.unchanged;

/* 2-c. 使い切ったら押せない */
R.exhausted = await pg.evaluate(()=>{
  S.hero.hpNow=1; party().forEach(a=>a.hpNow=1);
  S.run.healAds=0;
  renderStairHeal();
  const btn=document.getElementById('st-heal');
  stairHeal();
  return {label:btn.textContent, ghost:btn.className==='ghost',
          blocked: !document.getElementById('m-ad').classList.contains('on')};
});

/* 2-d. 探索ごとに回数が戻る */
R.resets = await pg.evaluate(()=>{
  const spent=S.run.healAds;
  S.hero=newHero(); startRun(1);
  return {spent, afterNewRun:S.run.healAds, resetsToMax:S.run.healAds===HEAL_ADS_PER_RUN};
});

/* ============ 3. ガチャ ============
   1日1回は**広告なしで引ける**。無料ぶんを使い切ってから、今までどおり広告になる。
   「まず1回引ける」が無いと、初日の街は見るだけの画面になってしまう。 */
await pg.evaluate(()=>{ S.hero=null; S.run=null; S.gachaDay=today();
                        S.gachaLeft=GACHA_PER_DAY; S.gachaFree=GACHA_FREE_PER_DAY;
                        setScreen('town'); setScreen('gacha'); });
await pg.waitForTimeout(250);
const tapFree = await tap('#btn-gacha');
await pg.waitForTimeout(350);
R.gachaFree = await pg.evaluate(()=>({
  noAd: !document.getElementById('m-ad').classList.contains('on'),
  resultShown: document.getElementById('m-gres').classList.contains('on'),
  freeLeft: S.gachaFree||0, left:S.gachaLeft, perDay:GACHA_PER_DAY}));
R.gachaFree.tapError = tapFree;
R.gachaFree.ok = tapFree===null && R.gachaFree.noAd && R.gachaFree.resultShown
              && R.gachaFree.freeLeft===0
              && R.gachaFree.left===R.gachaFree.perDay-1;
// 結果を閉じて、2回目。無料ぶんは尽きているので、ここからは広告。
await pg.evaluate(()=>{ document.getElementById('m-gres').classList.remove('on'); });
await pg.waitForTimeout(150);
const tapGacha = await tap('#btn-gacha');
await pg.waitForTimeout(300);
R.gachaAd = {tapError:tapGacha, modals: await modals(), okReachable: await topAt('#ad-ok')};
R.gachaLockedMidway = await waitAd();
const tapGachaOk = await tap('#ad-ok');
await pg.waitForTimeout(400);
R.gachaAd.result = await pg.evaluate(()=>({
  resultShown:document.getElementById('m-gres').classList.contains('on'),
  left:S.gachaLeft, perRun:GACHA_PER_DAY}));
R.gachaAd.ok = tapGacha===null && tapGachaOk===null
            && R.gachaAd.okReachable==='self'
            && R.gachaAd.result.resultShown
            // 無料の1回ぶんを先に使っているので、残りは2つ減っている
            && R.gachaAd.result.left===R.gachaAd.result.perRun-2;

/* ============ 4. 実プレイ中に仲間が倒れても操作を受け付ける ============ */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=20;
  S.hero.str=24; S.hero.dex=24; S.hero.vit=24;
  startRun(14); S.hero.party=[];
  const a=makeAlly(14,S.hero);
  a.boons=[];              // 加入時のランダム潜在（守護・不死鳥）だと一撃で倒れない
  a.job='knight';          // 回避の高いジョブを引くと、この一撃を避けてしまう
  a.x=P.x+0.5; a.y=P.y;
  a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  /* ここで見たいのは「実プレイの最中に仲間が倒れても、蘇生ボタンが押せる」こと。
     主人公自身の生死も、他の仲間の死も、この 1.2 秒のあいだに割り込むと
     別の画面が出て検証にならないので、両方とも起きないようにしておく。 */
  P.invuln=1e9;
  await new Promise(r=>setTimeout(r,1200));     // 通常のゲームループを回しておく
  // 待ち行列は「倒す直前」に空にする。待っているあいだに何か起きても拾えるように。
  _fallen=null; _fallenQueue=[];
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  /* 瀕死にしてから殴る。ここで見たいのは「倒れたら画面が出て押せる」ことなので、
     一撃で落ちるかどうか（防御やDRの効き具合）に結果を左右されたくない。
     実際、仲間の防御まわりが変わったときにこの検証だけが落ちた——
     測りたい物と関係ない数字に寄りかかっていたのが原因だった。 */
  /* 倒れる入口（downAlly）を直に呼ぶ。
     以前は hitAlly に大ダメージを渡していたが、それだと回避判定を1つ挟む。
     RNG は種で固定なので、4% の回避が**毎回同じところで必ず成立**して
     仲間が一度も倒れない、という形で落ちていた。
     確率の枝は、確率を見たいときにだけ通す。 */
  a.dead=false; a.hpNow=1;
  downAlly(a);
  await new Promise(r=>setTimeout(r,400));
  const box=document.querySelector('#m-fallen .box');
  const r=document.getElementById('fal-revive').getBoundingClientRect();
  const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return {screen:S.screen,
          fallenShown:document.getElementById('m-fallen').classList.contains('on'),
          reviveOnTop: top ? (top.id==='fal-revive') : false,
          loopAlive:_tickCount>60};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
