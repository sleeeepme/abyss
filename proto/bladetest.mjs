// 鞘無し（周回刃）。
//
// このスイートの本題は「当たるか」ではなく、**当たりすぎないか**。
// 刃は毎フレーム敵と重なっているので、素朴に書くと1秒で60回入る。
// 1周に1回、を守れているかが全部。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 本数 ================= */

// 1-a. 何も持っていなければ0本
R.noneByDefault = await pg.evaluate(()=>{
  TH.run(1,{seed:3}); TH.floor(12);
  S.hero.boons=[]; S.relicEq=[];
  return {n:bladeCount(), max:BLADE_MAX, ok: bladeCount()===0};
});

// 1-b. 恩寵1つで1本。拾うたびに増える
R.boonAddsOne = await pg.evaluate(()=>{
  const seen=[];
  for(let i=0;i<3;i++){
    S.hero.boons.push({id:'orbit', rar:'common'});
    seen.push(bladeCount());
  }
  return {seen, ok: JSON.stringify(seen)==='[1,2,3]'};
});

/* 1-c. **遺物込みで上限3本。** 遺物は引き運に関係なく1本を保証する役で、
       恩寵はそこに積み増す。合計が上限を超えない。 */
R.relicCountsToward = await pg.evaluate(()=>{
  // relicsOn() は枠数で切るので、枠を開けておかないと着けていても数に入らない
  S.upg = S.upg || {}; S.upg.relic = RELIC_MAX_SLOTS;
  S.hero.boons=[]; S.relics=['blade']; S.relicEq=['blade'];
  const withRelicOnly = bladeCount();
  S.hero.boons.push({id:'orbit', rar:'common'});
  const plusOne = bladeCount();
  for(let i=0;i<5;i++) S.hero.boons.push({id:'orbit', rar:'common'});
  const flooded = bladeCount();
  return {withRelicOnly, plusOne, flooded, max:BLADE_MAX,
          ok: withRelicOnly===1 && plusOne===2 && flooded===BLADE_MAX};
});

/* ================= 2. 抽選に出る条件 ================= */

/* 2-a. 第10階層より浅いところでは出さない。
       序盤の学習を弾幕で潰さないため。 */
R.notOfferedEarly = await pg.evaluate(()=>{
  S.hero.boons=[]; S.relicEq=[];
  const at=(d)=>{
    TH.run(1,{seed:9}); TH.floor(d);
    S.hero.boons=[]; S.relicEq=[];
    let seen=false;
    for(let i=0;i<300;i++) if(rollBoons('mid',3).some(b=>b.id==='orbit')) seen=true;
    return seen;
  };
  const shallow=at(BLADE_MIN_DEPTH-1), deep=at(BLADE_MIN_DEPTH);
  return {min:BLADE_MIN_DEPTH, absentWhenShallow: !shallow, presentWhenDeep: deep,
          ok: !shallow && deep};
});

/* 2-b. 上限に達したら選択肢に出さない。
       取っても何も起きない選択肢は、3枠のうち1つを潰すだけ。 */
R.notOfferedAtCap = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); TH.floor(20);
  S.hero.boons=[]; S.relicEq=[];
  for(let i=0;i<BLADE_MAX;i++) S.hero.boons.push({id:'orbit', rar:'common'});
  let seen=false;
  for(let i=0;i<300;i++) if(rollBoons('mid',3).some(b=>b.id==='orbit')) seen=true;
  return {blades:bladeCount(), atCap:boonAtCap('orbit'), absent: !seen,
          ok: bladeCount()===BLADE_MAX && !seen};
});

/* 2-c. レア度は共通。**本数で上限を切る以上、
       レア度にも刻みを持たせると二重になって読めない。**

       ただし値を共通にしただけだと、選択画面に出る等級が嘘になる——
       エピックの鞘無しがコモンと同じ物になり、見て損した気持ちだけが残る。
       （既存の boontest.rarity がこの決定を守っていて、実際にそこで止められた）
       なので**等級そのものを固定**して、嘘が出る余地を消してある。 */
R.rarityIsFlat = await pg.evaluate(()=>{
  const d=boonDef('orbit');
  const rolled=new Set();
  TH.run(1,{seed:2}); TH.floor(20);
  S.hero.boons=[]; S.relicEq=[];
  for(let i=0;i<400;i++)
    rollBoons('great',3).filter(b=>b.id==='orbit').forEach(b=>rolled.add(b.rar));
  return {v:d.v, fixedRar:d.fixedRar, rolled:[...rolled],
          flat: d.v.every(x=>x===d.v[0]),
          onlyOneTier: rolled.size===1 && rolled.has(d.fixedRar),
          ok: d.v.every(x=>x===d.v[0]) && rolled.size===1 && rolled.has(d.fixedRar)};
});

/* ================= 3. 当たり方 ================= */

// 3-a. そばに置いた敵は、放っておいても削れる
R.hitsWithoutInput = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
  S.hero.boons=[{id:'orbit', rar:'common'}]; S.relicEq=[];
  const e=W.enemies[0]; W.enemies=[e]; gridBuild();
  e.dead=false; e.maxHp=e.hp=1e7; e.atkV=0;
  e.x=P.x+BLADE_R; e.y=P.y;               // 軌道の上に置く
  const before=e.hp;
  stepSim(6, {each:()=>{ e.x=P.x+BLADE_R; e.y=P.y; }});
  return {dealt:Math.round(before-e.hp), blades:bladeCount(),
          ok: before-e.hp > 0};
});

/* 3-b. **1周に1回しか当たらない。** ここがこの機能の要。
       毎フレーム重なっているので、素朴に書くと60倍入る。 */
R.oncePerRevolution = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
  S.hero.boons=[{id:'orbit', rar:'common'}]; S.relicEq=[];
  /* **刃から入った一撃だけを数える。**
     武器を外しても素手の攻撃は出るので、`hitEnemy` を素朴に数えると
     「1周に1回」を見ているつもりで別の物を数えることになる（実際に一度そうした）。
     本体側で刃に blade:true の印を付けてあるので、それで選り分ける。 */
  const e=W.enemies[0]; W.enemies=[e]; gridBuild();
  e.dead=false; e.maxHp=e.hp=1e9; e.atkV=0;
  let hits=0;
  const orig=window.hitEnemy;
  window.hitEnemy=function(t,st,mul,opt){ if(t===e && opt && opt.blade) hits++; return orig.apply(this,arguments); };
  const secs=9;
  stepSim(secs, {each:()=>{ e.x=P.x+BLADE_R; e.y=P.y; }});
  window.hitEnemy=orig;
  const period=(Math.PI*2)/BLADE_SPIN;
  const expect=secs/period;               // 1本 × 周回数
  return {hits, expect:+expect.toFixed(1), period:+period.toFixed(2),
          // 取りこぼしと重複の両方を見る。±40% に収まっていれば「1周に1回」
          inBand: hits>=expect*0.6 && hits<=expect*1.4,
          ok: hits>=expect*0.6 && hits<=expect*1.4};
});

// 3-c. 本数を増やすと手数が増える（3本なら約3倍）
R.moreBladesMoreHits = await pg.evaluate(()=>{
  const run=(n)=>{
    TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
    S.hero.boons=[]; S.relicEq=[];
    for(let i=0;i<n;i++) S.hero.boons.push({id:'orbit', rar:'common'});
    const e=W.enemies[0]; W.enemies=[e]; gridBuild();
    e.dead=false; e.maxHp=e.hp=1e9; e.atkV=0;
    let hits=0;
    const orig=window.hitEnemy;
    window.hitEnemy=function(t,st,mul,opt){ if(t===e && opt && opt.blade) hits++; return orig.apply(this,arguments); };
    stepSim(9, {each:()=>{ e.x=P.x+BLADE_R; e.y=P.y; }});
    window.hitEnemy=orig;
    return hits;
  };
  const one=run(1), three=run(3);
  return {one, three, ratio:+(three/Math.max(1,one)).toFixed(2),
          ok: three > one*2};
});

/* 3-d. **弾を1発も使わない。** ここが既存の3つ（眷属・伴影・使い魔）との差で、
       弾幕にしたときに画面の弾数を圧迫しない理由でもある。 */
R.spendsNoProjectiles = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
  S.hero.boons=[{id:'orbit',rar:'common'},{id:'orbit',rar:'common'},{id:'orbit',rar:'common'}];
  S.relicEq=[];
  W.fx.length=0;
  const e=W.enemies[0]; W.enemies=[e]; gridBuild();
  e.dead=false; e.maxHp=e.hp=1e9; e.atkV=0; e.x=P.x+BLADE_R; e.y=P.y;
  S.hero.equip.weapon=null;                // 本体の攻撃を止めて刃だけにする
  stepSim(6, {each:()=>{ e.x=P.x+BLADE_R; e.y=P.y; }});
  const shots=W.fx.filter(f=>f.t==='pshot'||f.t==='ashot').length;
  return {shots, noShots: shots===0, ok: shots===0};
});

/* 3-e. 遠くの敵には当たらない。**引き撃ちでは強くならない**——
       群れの中に立たないと当たらない、が成立していること。 */
R.meleeOnly = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
  S.hero.boons=[{id:'orbit',rar:'common'},{id:'orbit',rar:'common'},{id:'orbit',rar:'common'}];
  S.relicEq=[]; S.hero.equip.weapon=null;
  const e=W.enemies[0]; W.enemies=[e]; gridBuild();
  e.dead=false; e.maxHp=e.hp=1e9; e.atkV=0;
  const far=BLADE_R+3.0;
  const before=e.hp;
  stepSim(6, {each:()=>{ e.x=P.x+far; e.y=P.y; }});
  return {distance:+far.toFixed(1), reach:BLADE_R,
          untouched: e.hp===before, ok: e.hp===before};
});

/* ================= 4. 描画と後始末 ================= */

// 4-a. 描いても落ちない。軌道の円は敷かない（刃が回っていれば範囲は読める）
R.drawsSafely = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
  S.hero.boons=[{id:'orbit',rar:'common'},{id:'orbit',rar:'common'}];
  let threw=null;
  try{ stepSim(3,{draw:true}); }catch(e){ threw=String(e.message); }
  const placed=(P.blades||[]).every(b=>b.x!==undefined);
  return {threw, blades:(P.blades||[]).length, placed,
          ok: threw===null && (P.blades||[]).length===2 && placed};
});

/* 4-b. 倒した相手を覚え続けない。
       刃は敵ごとに「最後に斬った時刻」を持つので、放っておくと
       階を跨いで Map が太る。 */
R.forgetsTheDead = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(20); TH.immortal();
  S.hero.boons=[{id:'orbit',rar:'common'}];
  stepSim(10);
  const sizes=(P.blades||[]).map(b=>b.hits.size);
  return {sizes, enemies:W.enemies.length,
          bounded: sizes.every(n=>n<=60),
          ok: sizes.every(n=>n<=60)};
});

// 4-c. 本数が0に戻れば刃も消える（遺物を外したとき）
R.dropsToZero = await pg.evaluate(()=>{
  S.hero.boons=[]; S.relicEq=[];
  stepSim(0.5);
  return {blades:(P.blades||[]).length, ok:(P.blades||[]).length===0};
});

await done(b, errs, R);
