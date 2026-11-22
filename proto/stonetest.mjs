/* 結びの石碑（慰霊碑の中）：第30階層の踏破で現れる。刻んだ仲間（レベル×5 SP）は倒れても失われず、
   死んだ時点の状態（レベル・恩寵・装備）で隊に戻る。道中で見送った者は街で、主人公が死んだら次の代の隊に */
import { boot, install } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = await pg.evaluate(()=>{ try{
  const R={};
  S.cleared2={}; S.fallen=[]; S.stoneWait=[]; S.tavern=[];
  TH.run(5,{seed:3}); TH.floor(5);
  const mk=(lv)=>{ const a=TH.ally(5,'warrior',lv); a.slot=party().length; S.hero.party.push(a); return a; };
  const A=mk(10), B=mk(8);
  // まだ石碑は無い
  S.run=null; S.shards=200;
  R.lockedBefore = !stoneOpen() && !stoneBind(A.uidA).ok && S.shards===200;
  markFloorCleared(30);
  R.costLv5 = stoneCost(A)===50;
  const r=stoneBind(A.uidA);
  R.bind = r.ok && A.stone===true && S.shards===150;
  R.bindTwice = !stoneBind(A.uidA).ok && S.shards===150;
  // 画面に出る
  renderMem(); R.ui = document.querySelectorAll('#stonebox [data-stone]').length===2 && /刻まれている/.test(el('stonebox').textContent);
  // 探索中は刻めない
  TH.run(5,{seed:3, keepParty:true}); TH.floor(5);
  R.noBindInRun = !stoneBind(B.uidA).ok;
  const WPN=A.equip.weapon; R.hasWeapon=!!WPN;
  // 道中で倒れて見送る → 隊から外れ、石碑が預かる（装備ごと）
  A.dead=true; openFallen(A);
  R.letLabel = /石碑/.test(el('fal-let').textContent);
  letFallenGo();
  R.letKept = !party().includes(A) && S.stoneWait.includes(A) && A.equip.weapon===WPN && !S.fallen.some(f=>f.uidA===A.uidA);
  // 刻んでいない者を見送ると今までどおり慰霊碑へ
  B.dead=true; openFallen(B);
  R.letLabelPlain = !/石碑/.test(el('fal-let').textContent);
  letFallenGo();
  R.unboundLost = !party().includes(B) && S.fallen.some(f=>f.uidA===B.uidA) && !S.stoneWait.includes(B);
  // 街に戻ると隊に戻る
  S.run=null; stoneReturn();
  R.backInParty = party().includes(A) && !A.dead && A.hpNow===allyStats(A).maxHp && A.lv===10 && A.equip.weapon===WPN && S.stoneWait.length===0;
  // 主人公が死ぬ：刻んだ者は次の代の隊へ、刻んでいない者は慰霊碑へ
  const C=mk(7);
  TH.run(5,{seed:3, keepParty:true}); TH.floor(5);
  S.hero.boons=[]; P.invuln=0;
  for(let i=0;i<6 && S.hero;i++) die();
  R.heroDied = !S.hero;
  R.deathKept = S.stoneWait.includes(A) && S.fallen.some(f=>f.uidA===C.uidA) && /結びの石碑/.test(el('d-lost').innerHTML);
  el('d-ok').click();
  R.nextGen = !!S.hero && party().includes(A) && A.equip.weapon===WPN && A.lv===10 && !party().includes(C);
  // 酒場が溢れても、刻んだ者は追い出されない
  S.hero.party=[]; S.tavern=[];
  A.returned=true; tavernPut(A);
  for(let i=0;i<TAVERN_MAX+2;i++){ const x=TH.ally(5,'warrior',20+i); tavernPut(x); }
  R.tavernKeepsStone = S.tavern.includes(A) && S.tavern.length===TAVERN_MAX;
  return R;
}catch(e){ return {err:String(e.stack||e)}; } });
console.log(JSON.stringify(Object.assign(R,{errs})));
await b.close();
