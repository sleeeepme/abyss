/* 仲間とボス（2026-11-06 ユーザー報告「デバッグで10階から仲間4人を連れてヴェラ戦に行ったら味方がワンパンされる」・
   指定「3発くらいは耐えたい」）。
   見るもの：
     liftAtBeacon   拠点で雇った Lv1 の仲間が、中継地点（10階）から潜ると主人公の支給レベル−2 まで上がり、
                    装備も階に合わせて作り直される。Rare 以上の装備は触らない
     noLiftAtOne    1階から潜るときは何もしない
     bossCap        ボスの一撃（近接・技・矢）は、仲間の最大HPの3割まで。矢（弾）も撃った者を見て抑える
     zakoUncapped   雑魚の一撃は抑えない
     threeHits      ヴェラの重い技（叩きつけ×1.3）を3発受けても、どの職も立っている */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.liftAtBeacon = await pg.evaluate(()=>{
  S.debug={allDepths:true}; S.hero=newHero(); S.upg=S.upg||{}; S.upg.party=PARTY_UP_MAX;
  const jobs=['warrior','mage'].map(jobDef);
  jobs.forEach((j,i)=>{ const a=makeAlly(1, S.hero, j); a.slot=i; S.hero.party.push(a); });
  const rare=genBaseItem(jobDef('warrior').weapon, 1, 1); rare.rar=3;      // 渡した良い装備（Rare）
  S.hero.party[0].equip.weapon=rare;
  const before=S.hero.party.map(a=>a.lv);
  TH.run(10,{seed:44, keepParty:true});
  const want=beaconLevel(beaconKitDepth(10))-2;
  const p=S.hero.party;
  const r={before, after:p.map(a=>a.lv), want, rareKept:p[0].equip.weapon===rare,
           mageWpn:p[1].equip.weapon.ilvl, mageArm:p[1].equip.armor.ilvl, full:p.every(a=>a.hpNow===allyStats(a).maxHp)};
  r.ok = r.after.every(l=>l===want) && r.rareKept && r.mageWpn>=8 && r.mageArm>=8 && r.full;
  return r;
});
R.noLiftAtOne = await pg.evaluate(()=>{
  S.debug={}; S.hero=newHero();
  const a=makeAlly(1, S.hero, jobDef('hunter')); S.hero.party=[a];
  TH.run(1,{seed:44, keepParty:true});
  return {lv:a.lv, ok:a.lv===1};
});
R.bossCap = await pg.evaluate(()=>{
  S.debug={}; S.hero=newHero(); TH.run(10,{seed:44});
  const e=W.enemies.find(x=>x.uniqueBoss===10);
  const a=TH.ally(10,'mage',1); a.x=P.x+0.5; a.y=P.y; S.hero.party=[a];   // 主人公の出る所（立てる床）の隣
  const mx=allyStats(a).maxHp, cap=Math.floor(mx*ALLY_BOSS_HIT_CAP);
  const jm=jobDef('mage'), ev=jm.evade; jm.evade=0;
  a.hpNow=mx; hitAlly(a, e); const melee=mx-a.hpNow;
  a.hpNow=mx; hitAlly(a, e, e.atkV*1.3); const slam=mx-a.hpNow;
  // 矢：本当に弾を飛ばして当てる
  e.moveCd=99; e.cd=99; e.cast=null; TH.immortal();
  a.hpNow=mx; a.st={}; a.dead=false;
  let bolt=0;
  stepSim(1/60,{each:()=>{ W.fx.push({t:'bolt', x:a.x, y:a.y, vx:0.01, vy:0, life:1, dmg:e.atkV, lv:e.lv, dt:e.dt, from:e}); }});
  bolt=mx-a.hpNow;
  jm.evade=ev;
  return {mx, cap, melee, slam, bolt, ok: melee<=cap && slam<=cap && bolt>0 && bolt<=cap};
});
R.zakoUncapped = await pg.evaluate(()=>{
  S.debug={}; S.hero=newHero(); TH.run(10,{seed:44});
  const z=W.enemies.find(x=>!x.boss) || W.enemies[0];
  const a=TH.ally(1,'mage',1); S.hero.party=[a];
  const jm=jobDef('mage'), ev=jm.evade; jm.evade=0;
  const mx=allyStats(a).maxHp; a.hpNow=1e6; const f={...z, boss:false, atkV:mx*3};
  hitAlly(a, f); jm.evade=ev;
  const d=1e6-a.hpNow;
  return {mx, d:Math.round(d), ok: d>mx*ALLY_BOSS_HIT_CAP*1.5};
});
R.threeHits = await pg.evaluate(()=>{
  S.debug={}; S.hero=newHero(); TH.run(10,{seed:44});
  const e=W.enemies.find(x=>x.uniqueBoss===10); bossChangeForm(e); S.run.formFx=null;
  const out={}; let ok=true;
  for(const job of ['warrior','knight','hunter','mage','rogue','priest']){
    const a=TH.ally(10, job, 9); const j=jobDef(job), ev=j.evade; j.evade=0;
    for(let i=0;i<3;i++) hitAlly(a, e, e.atkV*1.3);
    j.evade=ev; out[job]=Math.round(a.hpNow); if(!(a.hpNow>0) || a.dead) ok=false;
  }
  out.ok=ok; return out;
});
await done(b, errs, R);
