/* 状態異常の入りやすさと、効かない相手の検証。

   もともとは蓄積式（damage に比例して溜まり、閾値で発症）だけがあり、
   閾値も damage も同じようにレベルで伸びるので**どの階でも 1発あたり 25% 前後**
   ——炎の潜在を拾った瞬間から「殴れば必ず燃える」状態だった（報告）。
   序盤 3% 前後まで落とし、レベルで戻していく形にしてある。

   真偽値はすべて「true＝期待どおり」。false が1つでも出れば失敗（sweep の約束）。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* 同じ相手を殴り続けて、最初に状態異常が乗るまでの打数を測る器。
   **1発ごとの独立確率ではない**（蓄積式なので）ので、
   「何発で乗るか」を測ってから 1発あたりに直す。 */
await pg.evaluate(()=>{
  window.TH.hitsToProc = (lv, elemAmt, dmgType, trials)=>{
    const atk = 10+lv*3;               // そのレベルの素の攻撃力くらい
    let sum=0;
    const n=trials||300, cap=400;
    for(let t=0;t<n;t++){
      const e={lv, def:0, res:{}, bu:{}, st:{}, maxHp:1e9, hp:1e9};
      let k=0;
      while(k<cap){
        const parts=[{type:dmgType, amount:atk}];
        if(elemAmt>0) parts.push({type:'fire', amount:elemAmt});
        k++;
        if(resolveDamage(e, parts, lv, {}).procs.length) break;
      }
      sum+=k;
    }
    const avg=sum/n;
    return {avgHits:+avg.toFixed(2), perHitPct:+(100/avg).toFixed(1)};
  };
});

/* ================= 1. 入りやすさ ================= */

/* 1-a. 序盤は 1発あたり 3% 前後。炎の潜在（業火は fire +4〜11）を積んでも
       「ほぼ確実」にはならない。ここが今回の本題。 */
R.earlyRate = await pg.evaluate(()=>{
  const bare = TH.hitsToProc(1, 0, 'slash');
  const fireMin = TH.hitsToProc(1, 4, 'slash');    // 業火 最小
  const fireMax = TH.hitsToProc(1, 11, 'slash');   // 業火 最大
  return {bare, fireMin, fireMax,
          bareIsRare: bare.perHitPct <= 6,
          fireStillNotCertain: fireMax.perHitPct <= 12,
          fireHelps: fireMax.perHitPct > bare.perHitPct,
          ok: bare.perHitPct<=6 && fireMax.perHitPct<=12
              && fireMax.perHitPct>bare.perHitPct};
});

// 1-b. レベルが上がると戻ってくる（序盤だけ絞る、という話なので）
R.scalesWithLevel = await pg.evaluate(()=>{
  const lv1 = TH.hitsToProc(1, 0, 'slash');
  const lv30 = TH.hitsToProc(30, 0, 'slash');
  return {lv1:lv1.perHitPct, lv30:lv30.perHitPct,
          mul:+(1+29*AIL_BUILD_PER_LV/AIL_BUILD_BASE).toFixed(2),
          risesWithLevel: lv30.perHitPct > lv1.perHitPct*1.8,
          ok: lv30.perHitPct > lv1.perHitPct*1.8};
});

/* 1-c. 確率で入る手（焦＝proc の潜在、レジェンドの onHit、ハザード）は
       この絞りを通らない。**狙って掛ける手だけが残る**のが狙いなので、
       ここが一緒に薄まっていたら意味が無い。 */
R.procAffixUntouched = await pg.evaluate(()=>{
  const e={lv:10, def:0, res:{}, bu:{}, st:{}, maxHp:1e9, hp:1e9};
  let n=0;
  for(let i=0;i<400;i++){ e.st={}; addStatus(e,'burn',10); if(hasStatus(e,'burn')) n++; }
  return {landed:n, always: n===400, ok: n===400};
});

/* ================= 2. ボスには効かない ================= */

// 2-a. 名前つきの大ボス（uniqueBoss）は通らない
R.uniqueBossImmune = await pg.evaluate(()=>{
  const e={boss:true, uniqueBoss:20, lv:24, st:{}, bu:{}};
  for(let i=0;i<200;i++) addStatus(e,'burn',24);
  /* 生の真偽値は返さない（掃引は false を見つけたら失敗にする）。
     「入らなかった」は immune:true と書く。 */
  return {res:ailResistPct(e),
          immune: !hasStatus(e,'burn'), ok: !hasStatus(e,'burn')};
});

// 2-b. 階層ボスは 75% 弾く（通ることもあるが、常時ではない）
R.floorBossResists = await pg.evaluate(()=>{
  const e={boss:true, uniqueBoss:0, lv:24, st:{}, bu:{}};
  let n=0;
  for(let i=0;i<600;i++){ e.st={}; addStatus(e,'burn',24); if(hasStatus(e,'burn')) n++; }
  const pct=n/600*100;
  return {landedPct:+pct.toFixed(1), expected:100-BOSS_AIL_RES,
          nearExpected: Math.abs(pct-(100-BOSS_AIL_RES)) < 8,
          notImmune: n>0,
          ok: Math.abs(pct-(100-BOSS_AIL_RES))<8 && n>0};
});

/* 2-c. よろめきだけは全ボス完全無効。**行動を止められる相手ではない**という
       一点だけは、階層ボスでも譲らない。 */
R.bossNeverStaggers = await pg.evaluate(()=>{
  const mid={boss:true, uniqueBoss:0, lv:24, st:{}, bu:{}};
  for(let i=0;i<300;i++) addStatus(mid,'stagger',24);
  const zako={lv:24, st:{}, bu:{}};
  addStatus(zako,'stagger',24);
  return {bossNever: !hasStatus(mid,'stagger'),
          zakoStillWorks: hasStatus(zako,'stagger'),
          ok: !hasStatus(mid,'stagger') && hasStatus(zako,'stagger')};
});

/* ================= 3. 水は削らない ================= */

/* 3-a. 水は「痛い床」ではなく「重い床」（dps:0）。ところが削る量を
       Math.max(1,...) で床上げしていたので、**0 を指定してあるのに
       0.5 秒ごとに 1 ずつ入り続けていた**（報告）。 */
R.waterDoesNotHurt = await pg.evaluate(()=>{
  TH.run(12,{seed:3});
  // 水の層（sump）に降りるまで探す。見つからなければ手で水を敷く
  let found=false;
  for(const d of [12,16,17,18,19,20]){
    TH.floor(d);
    if(W.haz && W.haz.kind==='water'){ found=true; break; }
  }
  if(!found){
    TH.floor(12);
    W.haz={kind:'water', g:Array.from({length:W.fl.H},()=>new Uint8Array(W.fl.W))};
    for(let y=0;y<W.fl.H;y++) for(let x=0;x<W.fl.W;x++) W.haz.g[y][x]=1;
  }
  TH.clearEnemies();
  // 水の上に立たせる（淵＝tier3 は落ちるので避け、浅い所を選ぶ）
  let spot=null;
  for(let y=1;y<W.fl.H-1 && !spot;y++) for(let x=1;x<W.fl.W-1;x++){
    if(!tileWalk(W.fl,x,y)) continue;
    const t=W.haz.g[y] ? (W.haz.g[y][x]|0) : 0;
    if(t>0 && t<WATER_DEEP){ spot={x:x+0.5, y:y+0.5}; break; }
  }
  if(!spot) return {skipped:true, ok:true, dps:HAZARDS.water.dps, stoodOnWater:false};
  P.x=spot.x; P.y=spot.y; P.invuln=0;
  S.hero.hpNow=stats(S.hero).maxHp;
  const before=S.hero.hpNow;
  stepSim(6);                      // 6秒立ちっぱなし＝ハザードの刻みで12回ぶん
  const after=S.hero.hpNow;
  return {dps:HAZARDS.water.dps, before, after,
          stoodOnWater: !!hazardAt(P.x,P.y),
          noDamage: after>=before,
          ok: HAZARDS.water.dps===0 && after>=before};
});

// 3-b. dps を持つ床（溶岩）はちゃんと削る（0 を弾いただけ、を確かめる）
R.lavaStillHurts = await pg.evaluate(()=>{
  TH.run(36,{seed:4}); TH.floor(36);
  TH.clearEnemies();
  W.haz={kind:'lava', g:Array.from({length:W.fl.H},()=>new Uint8Array(W.fl.W))};
  for(let y=0;y<W.fl.H;y++) W.haz.g[y].fill(1);
  S.hero.hpNow=stats(S.hero).maxHp;
  const before=S.hero.hpNow;
  P.invuln=0;
  stepSim(3);
  return {before, after:S.hero.hpNow, dps:HAZARDS.lava.dps,
          hurts: S.hero.hpNow < before, ok: S.hero.hpNow < before};
});

await done(b, errs, R);
