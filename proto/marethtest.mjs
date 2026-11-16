/* 施しのマレット（30F）：配る。薬瓶・服数と毒・手・差し伸べる手・降り注ぐ光・混乱・一斉に配る・砂時計 */
import { boot, install } from './_h.mjs';
const {b, pg} = await boot(); await install(pg);
const R = await pg.evaluate(()=>{ try{
  const R={};
  TH.run(1,{seed:30}); TH.floor(30);
  const spawn0=marethSpawnHand; marethSpawnHand=(s2,x,y)=>{ const k=spawn0(s2,x,y); if(k) k.atkV=3; return k; };
  const boss=()=>W.enemies.find(e=>e.boss && !e.dead);
  let e=boss();
  W.haz=null;
  R.moves = JSON.stringify(e.moves)===JSON.stringify(['offer','hands','reach','lightfall']);
  const C={x:17.5, y:13.5};
  const mx=()=>stats(S.hero).maxHp;
  const reset=()=>{ e=boss(); e.cast=null; e.combo=null; e.recover=0; e.moveCd=99; e.pending=[]; e.hp=e.maxHp; e.rage=false; e.roar=0; e.atkV=3; e.cd=99; e.ms=0;
    W.vials=[]; W.mpools=[]; W.mrings=[]; W.mlights=[]; W.fx=W.fx.filter(f=>f.t!=='bolt'); W.enemies=W.enemies.filter(x=>x.boss); S.hero.party=[];
    e.x=C.x; e.y=C.y; P.x=e.x+4; P.y=e.y; P.pull=null; P.mDose=null; P.mHeal=0; P.confT=0; P.odT=0; P.invuln=0; S.hero.hpNow=mx(); W.haz=null; };
  const finish=()=>{ let n=0; while(e.cast && n++<400) stepSim(1/60); };
  const hp=()=>S.hero.hpNow;
  // --- 施し：薬瓶が置かれる。当たらない。目は閉じたまま
  reset(); bossBeginCast(e,'offer',{x:P.x,y:P.y},false);
  R.offerClosed = e.cast.closed===true && e.cast.spots.length===3;
  R.offerNoHit = !bossMoveHits(e,e.cast,P.x,P.y,P.r);
  let h0=hp(); finish();
  R.offerVials = W.vials.length===3 && W.vials.filter(v=>v.kind==='heal').length===2 && hp()===h0;
  // 癒しの薬：踏むと戻り、勘定に入り、1服
  S.hero.hpNow=Math.round(mx()*0.4); h0=hp();
  const v0=W.vials.find(v=>v.kind==='heal'); v0.born=1; P.x=v0.x; P.y=v0.y; stepSim(0.05);
  const amt=Math.round(mx()*MARETH.healPct);
  R.healVial = hp()===h0+amt && P.mHeal===amt && P.mDose.n===1 && !W.vials.includes(v0);
  // 満タンで受けても勘定に入る
  S.hero.hpNow=mx(); marethDose(P,'heal'); R.healCountsAtFull = P.mHeal===amt*2 && hp()===mx() && P.mDose.n===2;
  // 3服で毒に転じる：服数は0に戻り、削られ、遅くなる
  marethDose(P,null);
  R.overdose = P.mDose.n===0 && P.odT>0 && marethSlowAt(P.x,P.y)===MARETH.odSlow;
  h0=hp(); TH.immortal && 0; stepSim(1.1);
  R.overdoseHurts = hp()<h0;
  stepSim(MARETH.odTime); R.overdoseEnds = !(P.odT>0) && marethSlowAt(P.x,P.y)===1;
  // 服数は12秒で抜ける
  reset(); marethDose(P,null); stepSim(MARETH.doseWin+0.3); R.doseFades = P.mDose.n===0;
  // 昂りの薬：技の待ちが縮む
  reset(); P.ultCd=10; marethDose(P,'might'); R.might = Math.abs(P.ultCd-5)<0.01 && !P.mHeal;
  // --- 手を招く：手が生える。歩かない。上限5
  reset(); bossBeginCast(e,'hands',{x:P.x,y:P.y},false); finish();
  let hands=marethHands();
  R.handsSpawn = hands.length===2 && hands.every(h=>h.summoned && h.hand.st==='rise');
  R.handsWarp = Math.hypot(e.x-C.x, e.y-C.y)>0.5;
  for(let i=0;i<4;i++){ e.cast=null; e.moveCd=99; bossBeginCast(e,'hands',{x:P.x,y:P.y},false); finish(); }
  R.handsCap = marethHands().length<=MARETH.handMax;
  // 手は主人公のそばで振りかぶって叩く
  reset(); const h1=marethSpawnHand(e, P.x+1.0, P.y); stepSim(MARETH.handRise+0.6);
  R.handWinds = h1.hand.st==='wind' || hp()<mx();
  h0=mx(); stepSim(1.0); R.handHits = hp()<h0 && Math.abs(h1.x-(C.x+5))<0.01;
  // 届かなければ沈んで、そばに生え直す
  reset(); const h2=marethSpawnHand(e, P.x+1.0, P.y); stepSim(MARETH.handRise+0.1); P.x=C.x-6; P.y=C.y+3; stepSim(MARETH.handWait+MARETH.handSink+0.3);
  R.handRelocates = Math.hypot(h2.x-P.x, h2.y-P.y)<1.6;
  // 手は薬瓶を拾い、叩いた相手に飲ませる
  reset(); const h3=marethSpawnHand(e, P.x+1.0, P.y); marethAddVial(h3.x+0.5, h3.y+0.6, 'might'); W.vials[0].born=0; P.x=C.x-8; stepSim(MARETH.handRise+0.05);
  R.handPicks = h3.hand.hold==='might' && W.vials.length===0;
  P.x=h3.x-1.0; P.y=h3.y; P.ultCd=8; stepSim(1.2);
  R.handFeeds = h3.hand.hold===null && P.mDose && P.mDose.n===1 && P.ultCd<4.2;
  // --- 差し伸べる手：円で当たり、掴まれ、1服
  reset(); bossBeginCast(e,'reach',{x:P.x,y:P.y},false);
  R.reachShape = e.cast.spots.length===3 && bossMoveHits(e,e.cast,P.x,P.y,P.r) && !bossMoveHits(e,e.cast,P.x+20,P.y,P.r) && e.cast.intr===true;
  h0=hp(); finish();
  R.reachHit = hp()<h0 && P.mDose && P.mDose.n===1 && !!P.pull;
  reset(); bossBeginCast(e,'reach',{x:P.x,y:P.y},false); const far=e.cast.spots.every(s=>Math.hypot(s.x-(P.x),s.y-(P.y-9))>2); P.y-=9; h0=hp(); finish();
  R.reachMiss = !far || (hp()===h0 && !P.mDose);
  // --- 降り注ぐ光：マレットからは出ない。1本ずつ予兆のあとに落ちる
  reset(); bossBeginCast(e,'lightfall',{x:P.x,y:P.y},false);
  R.lightNoShape = !bossMoveHits(e,e.cast,P.x,P.y,P.r);
  finish();
  R.lightQueued = W.mlights.length===MARETH.lightN && W.mlights.every(f=>f.track);
  h0=hp(); stepSim(MARETH.lightTele+0.1);
  R.lightHitsStanding = hp()<h0 && P.mDose && P.mDose.n>=1;
  // 動き続ければ当たらない
  reset(); bossBeginCast(e,'lightfall',{x:P.x,y:P.y},false); finish(); h0=hp();
  for(let i=0;i<200;i++){ const an=i*0.015; P.x=C.x+Math.cos(an)*4; P.y=C.y+Math.sin(an)*4; stepSim(1/60); }
  R.lightDodge = hp()===h0 && W.mlights.length===0;
  // 薬瓶に落ちると薬の溜りになる。踏むと1服（1つの溜りで1回だけ）
  reset(); marethAddVial(C.x-6, C.y+3, 'heal'); bossBeginCast(e,'lightfall',{x:P.x,y:P.y},false); finish();
  R.lightOnVial = W.mlights.some(f=>f.vial);
  for(let i=0;i<260;i++){ const an=i*0.015; P.x=C.x+Math.cos(an)*4; P.y=C.y+Math.sin(an)*4; stepSim(1/60); }
  R.vialPool = W.vials.length===0 && W.mpools.length===1 && W.mpools[0].kind==='heal';
  P.x=W.mpools[0].x; P.y=W.mpools[0].y; stepSim(0.1); const n1=P.mDose?P.mDose.n:0; stepSim(0.5);
  R.poolOnce = n1===1 && P.mDose.n===1 && P.mHeal>0;
  // --- 激昂で開く技
  reset(); e.hp=e.maxHp*0.4; bossRage(e);
  R.rageMoves = ['confuse','giveall','hourglass'].every(id=>e.moves.includes(id)) && !e.moves.includes('wave');
  // 見分けを失くす：輪に触れると混乱。削らない。操作が逆さま
  reset(); bossBeginCast(e,'confuse',{x:P.x,y:P.y},false); finish(); h0=hp(); stepSim(1.2);
  R.confuse = P.confT>0 && hp()===h0;
  const x0=P.x; stickDx=1; stickDy=0; stepSim(0.3); stickDx=0;
  R.confuseReverse = P.x<x0-0.3;
  stepSim(MARETH.confT+0.2); R.confuseEnds = !(P.confT>0);
  const x1=P.x; stickDx=1; stepSim(0.3); stickDx=0; R.normalMove = P.x>x1+0.3;
  // 瞬歩の無敵で抜けられる
  reset(); bossBeginCast(e,'confuse',{x:P.x,y:P.y},false); finish(); P.invuln=3; stepSim(1.2); R.confuseDodge = !(P.confT>0);
  // 混乱した手は、手どうし・マレット本体も殴る
  reset(); const ha=marethSpawnHand(e, C.x-7, C.y), hb=marethSpawnHand(e, C.x-7.9, C.y); P.x=C.x+9; P.y=C.y+4;
  stepSim(MARETH.handRise+0.05); ha.confT=5; const hb0=hb.hp; stepSim(1.6);
  R.confusedHandHitsHand = hb.hp<hb0 || hb.dead;
  // 混乱した仲間は主人公を殴る
  reset();
  { const na=TH.ally(30,null,30); S.hero.party=[na]; }
  const al=livingParty()[0];
  if(al){ al.x=P.x+0.8; al.y=P.y; al.confT=5; al.confCd=0; TH.mortal&&0; h0=hp(); S.hero.hpNow=h0; stepSim(1.5); R.confusedAllyHitsHero = hp()<h0; }
  else R.confusedAllyHitsHero = 'no ally helper';
  // --- 一斉に配る：輪に触れると削り＋1服。手は1服だけ
  reset(); const hc=marethSpawnHand(e, C.x-3, C.y); bossBeginCast(e,'giveall',{x:P.x,y:P.y},false); finish(); h0=hp(); stepSim(1.4);
  R.giveall = hp()<h0 && P.mDose && P.mDose.n===1 && hc.mDose && hc.mDose.n===1;
  // --- 砂時計：受けた癒しがまとめて返る。軽減できない。溜めは2秒で潰せない
  reset(); e.rage=true; e.phase=2; e.rageMoves=['hourglass']; marethDose(P,'heal'); P.mDose=null; S.hero.hpNow=mx();
  bossBeginCast(e,'hourglass',{x:P.x,y:P.y},false);
  R.hourglassCast = Math.abs(e.cast.max-2.0*(e.teleMul||1))<0.01 && e.cast.intr===false;
  P.invuln=5; h0=hp(); finish();
  R.hourglass = hp()===h0-amt && P.mHeal===0;
  // 借りが無ければ何も起きない
  reset(); bossBeginCast(e,'hourglass',{x:P.x,y:P.y},false); h0=hp(); finish(); R.hourglassNoDebt = hp()===h0;
  // 手にも返る
  reset(); const hd=marethSpawnHand(e, C.x-3, C.y); hd.hp=Math.round(hd.maxHp*0.5); marethDose(hd,'heal'); const hd1=hd.hp;
  bossBeginCast(e,'hourglass',{x:P.x,y:P.y},false); finish(); R.hourglassHand = hd.hp<hd1 || hd.dead;
  // 連携と隙の表
  R.tables = DUEL.combo.offer==='hands' && DUEL.combo.reach==='lightfall' && DUEL.combo.confuse==='giveall' && DUEL.combo.giveall==='hourglass'
           && DUEL.rec.hourglass===1.2 && DUEL_BODY.reach===1 && DUEL_BODY.lightfall===1 && !DUEL_BODY.hourglass;
  // --- 90秒戦わせる：落ちない・技が全部出る
  reset(); P.invuln=1e9; e.moveCd=0.5; const seen={}; let err=null;
  try{ for(let i=0;i<140*30;i++){ stepSim(1/30); const b2=boss(); if(!b2) break; if(b2.cast) seen[b2.cast.id]=1; if(b2.hp>b2.maxHp*0.45 && i>30*30) b2.hp=b2.maxHp*0.45;
        if(i%90===0){ P.x=b2.x+3; P.y=b2.y+1; } } }catch(x){ err=String(x&&x.stack||x); }
  R.fightNoError = err||true; R.seen=Object.keys(seen).sort().join('/');
  R.fightAllMoves = ['offer','hands','reach','lightfall','confuse','giveall','hourglass'].every(id=>seen[id]);
  return R;
}catch(x){ return {error:String(x&&x.stack||x)}; } });
/* 砂時計で死ぬ（不死を外して別に見る） */
const D = await pg.evaluate(()=>{ try{
  TH.run(1,{seed:31}); TH.floor(30);
  const e=W.enemies.find(x=>x.boss); W.haz=null; e.moveCd=99; e.rage=true; e.rageMoves=['hourglass'];
  P.x=e.x+4; P.y=e.y; S.hero.hpNow=stats(S.hero).maxHp;
  for(let i=0;i<4;i++) { marethDose(P,'heal'); P.mDose=null; P.odT=0; }
  bossBeginCast(e,'hourglass',{x:P.x,y:P.y},false);
  const debt=P.mHeal, mxh=stats(S.hero).maxHp;
  let n=0; while(S.run && e.cast && n++<400) stepSim(1/60);
  return {debtIsFull: debt>=mxh, died: !S.run || !S.hero || S.hero.hpNow<=0};
}catch(x){ return {error:String(x&&x.stack||x)}; } });
console.log(JSON.stringify({R, D}, null, 1));
await b.close();
