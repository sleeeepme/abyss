// 加入前の仲間（NPC）が、姿を見られてから戦い始めること。
//
// このスイートの本題は「戦うこと」ではなく **戦い始める時刻** にある。
// 早すぎると会う前に死ぬ（＝仲間が出ない階が増えるだけ）。
// 遅すぎると、隣で敵に囲まれている人が棒立ちで、人に見えない。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* NPC を必ず用意する。spawnNpc は確率と酒場レベルに依存するので、
   ここで待っていると検証にならない。作り方は spawnNpc と同じ形にそろえる。 */
await pg.evaluate(()=>{
  window.TH.npc = (depth, opt)=>{
    const o=opt||{};
    const a=makeAlly(depth, S.hero);
    a.boons=[];                       // 潜在の当たり外れを差にしない
    a.npc=true; a.awake=false;
    a.x=P.x+(o.dx!=null?o.dx:30); a.y=P.y+(o.dy!=null?o.dy:0);
    a.hpNow=allyStats(a).maxHp;
    W.npc=a;
    return a;
  };
  /* 敵を1体だけ、指定の場所に置く。硬さも指定できる
     （殴り合いの勝敗ではなく、殴っているかどうかを見たいので）。 */
  window.TH.oneEnemy = (x,y,hp)=>{
    const e=W.enemies[0];
    W.enemies=[e];
    e.x=x; e.y=y; e.dead=false;
    e.maxHp=e.hp=(hp||1e6);
    return e;
  };
});

/* ================= 1. 見られるまで戦わない ================= */

// 1-a. 遠くにいるあいだは、敵が隣にいても無傷のまま
R.asleepSafe = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:30,dy:30});
  const e=TH.oneEnemy(a.x+0.8, a.y);
  const hp0=a.hpNow, eHp0=e.hp;
  stepSim(8);
  return {stillAsleep: !a.awake, hp0, hpNow:a.hpNow,
          untouched: a.hpNow===hp0,
          didNotFight: e.hp===eHp0,
          notTargeted: enemyTarget(e).ent!==a,
          ok: !a.awake && a.hpNow===hp0 && e.hp===eHp0 && enemyTarget(e).ent!==a};
});

// 1-b. 壁越しでは起きない（距離だけで起こすと、隣の部屋で戦い始める）
R.needsLos = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:0,dy:0});
  // 主人公の近くで、見通せない点を探す
  let placed=false;
  for(let r=3; r<=NPC_WAKE_DIST && !placed; r+=0.5){
    for(let k=0;k<24 && !placed;k++){
      const ang=k/24*Math.PI*2;
      const x=P.x+Math.cos(ang)*r, y=P.y+Math.sin(ang)*r;
      if(solid(x,y)) continue;
      if(losClear(P.x,P.y,x,y)) continue;      // 見通せる点は要らない
      a.x=x; a.y=y; placed=true;
    }
  }
  if(!placed) return {skipped:true, ok:true};   // 見通しの利く階だった
  const d=Math.hypot(a.x-P.x, a.y-P.y);
  stepSim(3);
  return {dist:+d.toFixed(2), inRange:d<=NPC_WAKE_DIST, stillAsleep: !a.awake,
          ok: d<=NPC_WAKE_DIST && !a.awake};
});

/* ================= 2. 見られたら戦う ================= */

// 2-a. 近づいて視線が通ると気づき、敵を相手にし、殴り合いが始まる
R.wakesAndFights = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  const e=TH.oneEnemy(a.x+0.8, a.y);
  const hp0=a.hpNow, eHp0=e.hp;
  stepSim(5);
  return {awake:a.awake, hasTarget:!!a.tgt,
          dealt: eHp0-e.hp, took: hp0-a.hpNow,
          targeted: enemyTarget(e).ent===a,
          ok: a.awake && !!a.tgt && (eHp0-e.hp)>0 && (hp0-a.hpNow)>0};
});

/* 2-b. 間合いに入っていれば動かない。
       張り付いたあとに動き回ると、こちらが助けに行く先が定まらない。 */
R.holdsGroundInReach = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  const st=allyStats(a);
  const e=TH.oneEnemy(a.x+st.range*0.6, a.y);   // 最初から届く位置
  const x0=a.x, y0=a.y;
  stepSim(5);
  return {moved:+Math.hypot(a.x-x0,a.y-y0).toFixed(3),
          ok: Math.hypot(a.x-x0,a.y-y0) < 0.3};
});

/* 2-b2. 届かないときは詰めて、殴り返す。
        以前は「その場を動かない」だけだったので、射程の長い相手には
        **殴られ続けるだけで一度も殴り返せなかった**（利用者からの報告）。 */
R.closesToStrike = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  a.job='warrior'; a.equip.weapon=genBaseItem('sword',4,1);
  a.hpNow=allyStats(a).maxHp;
  const e=TH.oneEnemy(a.x+5.5, a.y);            // 近接では届かない距離
  e.arch=ARCH.find(x=>x.id==='turret')||e.arch; // 撃ってくる相手
  const hp0=e.hp;
  stepSim(8);
  return {dealt:hp0-e.hp, moved:+Math.hypot(a.x-a.homeX, a.y-a.homeY).toFixed(2),
          fightsBack:(hp0-e.hp)>0, ok:(hp0-e.hp)>0};
});

/* 2-b3. ただし追いかけ回さない。元いた場所から離れられる距離に上限がある
        （追わせると1体倒すたびに次の敵へ引っ張られ、1人で群れの中に立つ）。 */
R.staysOnLeash = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  a.job='warrior'; a.equip.weapon=genBaseItem('sword',4,1);
  a.hpNow=allyStats(a).maxHp;
  // 遠くの相手をわざと置いて、引っ張られないことを見る
  const e=TH.oneEnemy(a.x+7.5, a.y);
  e.maxHp=e.hp=1e7;
  let worst=0;
  stepSim(12, {each:()=>{ e.x=a.x+7.5; e.y=a.y; },      // 逃げ続ける相手
               after:()=>{ worst=Math.max(worst, Math.hypot(a.x-a.homeX, a.y-a.homeY)); }});
  return {worst:+worst.toFixed(2), leash:NPC_LEASH,
          withinLeash: worst <= NPC_LEASH+0.6,
          ok: worst <= NPC_LEASH+0.6};
});

// 2-c. 一度起きたら、離れても寝直さない（近づく／離れるで点滅しない）
R.staysAwake = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  stepSim(1);
  const wokeNear=a.awake;
  a.x=P.x+30; a.y=P.y+30;
  stepSim(2);
  return {wokeNear, stillAwake:a.awake, ok: wokeNear && a.awake};
});

/* ================= 3. 倒れたら消える ================= */

// 3-a. 蘇生ダイアログは出ない。W.npc ごと消える
R.diesForGood = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  a.awake=true; a.hpNow=1;
  downAlly(a);
  return {gone: W.npc===null,
          noFallenModal: !el('m-fallen').classList.contains('on'),
          notInParty: !livingParty().includes(a),
          ok: W.npc===null && !el('m-fallen').classList.contains('on')};
});

// 3-b. 敵の攻撃で実際に死にきる（HPを絞って戦わせる）
R.canBeKilled = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:2,dy:0});
  const e=TH.oneEnemy(a.x+0.6, a.y);
  e.atkV=9999;
  a.awake=true; a.hpNow=1;
  stepSim(6);
  return {gone: W.npc===null, ok: W.npc===null};
});

// 3-c. 消えたあとにフレームを回しても落ちない（W.npc の null 参照）
R.survivesLoop = await pg.evaluate(()=>{
  let threw=null;
  try{ stepSim(3,{draw:true}); }catch(err){ threw=String(err.message); }
  return {threw, npc:W.npc, ok: threw===null};
});

/* ================= 4. 助けたあと ================= */

// 4-a. 傷ついたまま加入できる（HPは戻らない）
R.joinsWounded = await pg.evaluate(()=>{
  TH.run(1,{seed:12}); TH.floor(4); TH.immortal();
  const a=TH.npc(4,{dx:1,dy:0});
  a.awake=true;
  const mx=allyStats(a).maxHp;
  a.hpNow=Math.round(mx*0.4);
  W.enemies.length=0;
  joinAlly();
  const inParty=livingParty().includes(a);
  return {inParty, hpNow:a.hpNow, maxHp:mx, npcCleared:W.npc===null,
          keptWound: a.hpNow < mx,
          flagCleared: !a.npc,
          ok: inParty && a.hpNow<mx && W.npc===null};
});

/* 4-b. 加入したら npc の印は落ちる。
       残っていると、以後この仲間が倒れたときに蘇生ダイアログが出ず、
       黙って消えてしまう（3-a の分岐をそのまま通ってしまうため）。 */
R.flagCleared = await pg.evaluate(()=>{
  const a=livingParty()[0];
  return {npcFlagGone: !a.npc, awakeCleared: !a.awake, ok: !a.npc};
});

/* ================= 5. 祭壇の値 ================= */

// 5-a. 捧げる最大HPは 10%。説明文・見積り・実処理が同じ数字を見ている
R.altarCost = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(6);
  S.hero.hpDebt=0;
  const before=stats(S.hero).maxHp;
  const body=EVENTS.find(e=>e.id==='altar').body;
  W.ev={id:'altar', x:P.x, y:P.y, used:false};
  openEvent(W.ev);
  const shown=el('ev-body').textContent;
  resolveEvent();
  const after=stats(S.hero).maxHp;
  return {cost:ALTAR_HP_COST, before, after,
          ratio:+(after/before).toFixed(3),
          bodySays10: body.includes('10%'),
          previewShows: shown.includes(String(Math.round(before*0.9))),
          ok: ALTAR_HP_COST===0.10 && body.includes('10%')
              && Math.abs(after/before - 0.9) < 0.02};
});

await done(b, errs, R);
