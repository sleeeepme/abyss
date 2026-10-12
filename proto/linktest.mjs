/* 一斉攻撃（連携値）の回帰テスト。
   ・時間と攻撃で溜まる（撃破でも）。一斉攻撃そのものの当たりでは溜まらない
   ・満ちたときだけボタンが出る。押すと0に戻り、ボタンも消える
   ・弓の届く範囲の敵全員に当たり、範囲の外には当たらない
   ・演出のあいだは無敵（盤面が止まる）
   ・仲間の数だけヒット数が増える
   R の真偽値はすべて「true＝期待どおり」。 */
import {boot, done, install} from './_h.mjs';
const {b, pg, errs} = await boot();
await install(pg);
const R = {};

// 1. 時間で溜まる：60秒で 100/600*60 = 10
R.timeGain = await pg.evaluate(()=>{
  TH.run(3,{seed:5}); TH.immortal(); TH.clearEnemies();
  S.hero.link = 0;
  TH.step(60);
  const v = S.hero.link;
  return {v:+v.toFixed(2), about10: v>9.5 && v<10.6, fullTakesTenMin: Math.abs(LINK.max/LINK.perSec - 600) < 1};
});

// 2. 攻撃と撃破で溜まる（主人公の1発 > 仲間の1発）
R.attackGain = await pg.evaluate(()=>{
  TH.run(3,{seed:5}); TH.immortal();
  const a=TH.ally(3,'knight',5); uniqueAllyName(a,party()); S.hero.party.push(a);
  const e=W.enemies.find(x=>!x.boss); e.maxHp=e.hp=1e6;
  S.hero.link=0; hitEnemy(e, stats(S.hero), 1); const hero=S.hero.link;
  S.hero.link=0; hitEnemyByAlly(a, allyStats(a), e, 1); const ally=S.hero.link;
  const k=W.enemies.find(x=>!x.boss && x!==e && !x.elite); k.hp=1;
  S.hero.link=0; hitEnemy(k, stats(S.hero), 50); const kill=S.hero.link;
  return {hero, ally, kill, heroHit: Math.abs(hero-LINK.hitHero)<1e-9, allyHit: Math.abs(ally-LINK.hitAlly)<1e-9,
          heroWeighsMore: hero>ally, killAdds: kill >= LINK.kill};
});

// 3. 満ちたときだけボタンが出る
R.buttonOnlyWhenFull = await pg.evaluate(()=>{
  TH.run(3,{seed:5}); TH.immortal();
  S.hero.link=99.9; updateHUD();
  const hiddenBelow = !el('linkbtn').classList.contains('on');
  S.hero.link=100; updateHUD();
  const shownAtMax = el('linkbtn').classList.contains('on');
  const barFull = el('linkbar').classList.contains('full');
  const hasIcon = /url\(/.test(el('link-icon').style.backgroundImage) && !!SKILL_ICON_GRID.link;
  return {hiddenBelow, shownAtMax, barFull, hasIcon};
});

// 4. 範囲に敵がいなければ出ない（値は残る）
R.needsTarget = await pg.evaluate(()=>{
  TH.run(3,{seed:5}); TH.immortal(); TH.clearEnemies();
  S.hero.link=100;
  const fired=fireLink();
  return {notFired: fired===false, kept: S.hero.link===100, noShow: !_linkNow};
});

// 5. 発動：範囲の敵全員に当たり、外には当たらない。0に戻り、ボタンが消える。演出中は無敵
R.fire = await pg.evaluate(()=>{
  TH.run(6,{seed:4}); TH.immortal(); P.invuln=0;
  const R0=linkRange();
  const es=W.enemies.filter(e=>!e.boss).slice(0,4);
  es.forEach((e,i)=>{ const p=snapToStandable(W.fl, P.x+Math.cos(i*1.6)*2, P.y+Math.sin(i*1.6)*2); e.x=p.x; e.y=p.y; e.maxHp=e.hp=1e6; e.atkV=1e5; });
  const far=W.enemies.find(e=>!es.includes(e) && !e.boss && Math.hypot(e.x-P.x,e.y-P.y) > R0+1.5);
  if(far){ far.maxHp=far.hp=1e6; }
  const inRange = es.filter(e=>Math.hypot(e.x-P.x,e.y-P.y) <= R0+e.r).length;
  S.hero.link=100;
  const hp0=S.hero.hpNow;
  const fired=fireLink(); updateHUD();
  const resetToZero = S.hero.link===0;
  const btnGone = !el('linkbtn').classList.contains('on');
  TH.step(1.0);
  const midRunning = !!_linkNow, unhurtMid = S.hero.hpNow===hp0;
  W.enemies.forEach(e=>e.atkV=1); P.invuln=1e9;   // 終わったあとに殴られて倒れないように
  TH.step(LINK.dur);   // 終わるまで
  const ended = !_linkNow;
  const hitAll = es.every(e=>e.hp < 1e6);
  const farUntouched = far ? far.hp===1e6 : true;
  // 一斉攻撃そのものの当たりでは溜まらない（終わった直後は時間ぶんしか無い）
  const noSelfCharge = S.hero.link < 0.5;
  return {fired, inRange, resetToZero, btnGone, midRunning, unhurtMid, ended, hitAll, farUntouched, noSelfCharge,
          rangeIsBow: Math.abs(R0 - BASES.find(x=>x.id==='bow').reach) < 1e-9};
});

// 6. 仲間の数でヒット数が増える
R.hitsScale = await pg.evaluate(()=>{
  const count=(n)=>{
    TH.run(6,{seed:4}); TH.immortal();
    for(let i=0;i<n;i++){ const a=TH.ally(6,['knight','archer','mage'][i%3],8); uniqueAllyName(a,party()); S.hero.party.push(a); }
    const e=W.enemies.find(x=>!x.boss); const p=snapToStandable(W.fl, P.x+1.5, P.y); e.x=p.x; e.y=p.y; e.maxHp=e.hp=1e6;
    S.hero.link=100; fireLink();
    const h=_linkNow ? _linkNow.hits.length : -1;
    TH.step(LINK.dur+0.2);
    return h;
  };
  const h0=count(0), h1=count(1), h3=count(3);
  return {h0, h1, h3, solo: h0===LINK.heroHits, grows: h1===LINK.heroHits+LINK.allyHits && h3===LINK.heroHits+3*LINK.allyHits};
});

// 7. 値は主人公に付く：階をまたいでも残り、新しいキャラは0から
R.keep = await pg.evaluate(()=>{
  TH.run(3,{seed:5}); S.hero.link=42;
  enterFloor(4);
  const kept = Math.abs(S.hero.link-42)<1e-6;
  const fresh = !(newHero().link>0);
  return {kept, fresh};
});

await done(b, errs, R);
