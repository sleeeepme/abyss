// 50階までのボスを1体ずつ別物にした件と、ユニーク敵のバリエーション。
//
// 以前は「〈系統名〉+ 長／王」で、第5階層の長と第45階層の長が
// 名前も技も同じだった。**倒した相手を覚えていられない。**
// なのでこのスイートは、強さではなく「別物であること」を見る。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

const DEPTHS=[5,10,15,20,25,30,35,40,45,50];

/* ================= 1. 節目のボスが全部ちがう ================= */

// 1-a. 10体すべてに固有の名前がある
R.allNamed = await pg.evaluate(depths=>{
  const rows=depths.map(d=>{
    TH.run(1,{seed:7}); TH.floor(d);
    const e=W.enemies.find(x=>x.boss);
    return {d, nm:e&&e.name, dt:e&&e.dt, fam:e&&e.fam.id, uniqueBoss:e&&e.uniqueBoss};
  });
  const names=rows.map(r=>r.nm);
  const dupes=names.filter((v,i,a)=>a.indexOf(v)!==i);
  const generic=rows.filter(r=>!r.uniqueBoss);
  return {rows, dupes, generic:generic.map(r=>r.d),
          allUnique: dupes.length===0 && generic.length===0,
          ok: dupes.length===0 && generic.length===0 && rows.length===10};
}, DEPTHS);

/* 1-b. 技の組み合わせが1つも被らない。
       名前だけ変えて同じ技を配ると、名前が違う同じボスが10体並ぶだけになる。 */
R.movesetsDiffer = await pg.evaluate(depths=>{
  const sets=depths.map(d=>{
    const U=uniqueBossAt(d);
    return {d, moves:U.moves.slice().sort().join('/'), rage:U.rage.join('/')};
  });
  const keys=sets.map(s=>s.moves);
  const dupes=keys.filter((v,i,a)=>a.indexOf(v)!==i);
  return {sets, dupes, allDistinct: dupes.length===0, ok: dupes.length===0};
}, DEPTHS);

/* 1-c. 属性は**その一体の正体**に合う。

   以前は「層のテーマに合わせる」ことを見ていたが、設定が変わった。
   現象体は「その深さから動けなくなったもの」で、**深度に固定されている**——
   層のほうが入れ替わるので、深度と層は一致しない（設定書 6章）。
   だから層ではなく、名前が名乗っている正体と属性が合っているかを見る。 */
R.elementsMatchSelf = await pg.evaluate(depths=>{
  // 現象体＝層の語を名乗る。登録名持ち＝生前の職種に合う手
  const want={
    5:['blunt','pierce'],      // 灰の大蛙 — 吐く・のしかかる
    10:['pierce'],             // 空引きのヴェラ — 弓
    15:['blunt','arcane'],     // 沼の大蛭 — 吸う
    20:['blunt'],              // 打ち直しのブレヒト — 鎚
    25:['pierce','slash'],     // 根の大蜘蛛 — 脚
    30:['arcane'],             // 施しのマレット — 薬
    35:['fire'],               // 炉の大蛇 — 熱そのもの
    40:['blunt'],              // 凍てついた盾、オルト — 盾
    45:['frost','arcane'],     // 白の大眼 — 欠
    50:['arcane'],             // 初めの供物
  };
  const bad=[];
  const rows=depths.map(d=>{
    const U=uniqueBossAt(d);
    const fits=(want[d]||[]).includes(U.dt);
    if(!fits) bad.push({d, nm:U.nm, dt:U.dt});
    return {d, nm:U.nm, dt:U.dt, fits};
  });
  return {rows, bad, ok: bad.length===0};
}, DEPTHS);

/* 1-d. 名前の三段ルール。深く潜るほど、名前が人の言葉に近づく。
       現象体は漢字で名指し、登録名持ちは人名を持つ（＝かつて人だった）。
       ラスボスだけが番号を持たない。 */
R.namingTiers = await pg.evaluate(()=>{
  const manifest=[5,15,25,35,45].map(d=>uniqueBossAt(d));
  const registered=[10,20,30,40].map(d=>uniqueBossAt(d));
  const last=uniqueBossAt(50);
  return {
    manifest: manifest.map(u=>u.nm),
    registered: registered.map(u=>u.nm),
    last: last.nm,
    manifestAreNamed: manifest.every(u=>/^[^ぁ-ん]*の大/.test(u.nm)),
    manifestRegistered: manifest.every(u=>u.reg.indexOf('現象体')===0),
    registeredHaveNumbers: registered.every(u=>u.reg.indexOf('登録：')===0),
    lastHasNoNumber: last.reg.includes('番号欄ともに空白'),
    allHaveLine: [...manifest,...registered,last].every(u=>!!u.line),
    ok: manifest.every(u=>u.reg.indexOf('現象体')===0)
        && registered.every(u=>u.reg.indexOf('登録：')===0)
        && last.reg.includes('番号欄ともに空白')
  };
});

// 1-d. 系統（色と耐性）も定義どおりに乗る
R.familyApplied = await pg.evaluate(depths=>{
  const bad=[];
  depths.forEach(d=>{
    TH.run(1,{seed:7}); TH.floor(d);
    const e=W.enemies.find(x=>x.boss), U=uniqueBossAt(d);
    if(!e || e.fam.id!==U.fam || e.dt!==U.dt) bad.push({d, got:e&&e.fam.id, want:U.fam});
  });
  return {bad, ok: bad.length===0};
}, DEPTHS);

/* 1-e. 階に入ったとき、その階だけの一行が出る。
       「中ボスの気配」が10回続くのと、10通りの一行があるのとでは、
       同じ仕掛けでも覚え方が変わる。 */
R.introLines = await pg.evaluate(depths=>{
  const lines=depths.map(d=>uniqueBossAt(d).line);
  const dupes=lines.filter((v,i,a)=>a.indexOf(v)!==i);
  TH.run(1,{seed:7});
  logs.length=0;
  TH.floor(25);
  const shown=logs.some(l=>l.includes(uniqueBossAt(25).line));
  return {lines:lines.length, dupes, shownInLog:shown,
          ok: dupes.length===0 && lines.length===10 && shown};
}, DEPTHS);

// 1-f. 周回した先（61階以降）は今までどおり動く（表に無くても落ちない）
R.beyondTable = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(65);
  const e=W.enemies.find(x=>x.boss);
  return {name:e&&e.name, moves:e&&e.moves.length, generic:!(e&&e.uniqueBoss),
          ok: !!e && e.moves.length>0 && !e.uniqueBoss};
});

/* ================= 2. 新しい技が動く ================= */

/* 2-a. 9種すべてが、実際に溜めて・撃って・例外を出さない（分身を足して9つに）。
       描画まで通すのが肝で、予兆の絵で落ちるとそのフレームが丸ごと消える。 */
R.allMovesFire = await pg.evaluate(()=>{
  /* 第45階層で見る。第50階層の主は眷属と周回刃と出血の霧を連れた**設え**で、
     技が出るかどうかを見るには余計な物が多い（そちらは bossaoe が見ている）。 */
  TH.run(1,{seed:7}); TH.floor(45); TH.immortal();
  const boss=W.enemies.find(x=>x.boss);
  boss.maxHp=boss.hp=1e9; boss.atkV=0; boss.state='chase';
  const fired=new Set(); let threw=null;
  try{
    for(const id of Object.keys(BOSS_MOVES)){
      boss.cast=null; boss.moveCd=0; boss.lastMove=null;
      boss.moves=[id]; boss.x=P.x+3; boss.y=P.y;
      stepSim(8, {draw:true, after:()=>{ if(boss.cast) fired.add(boss.cast.id); }});
    }
  }catch(e){ threw=String(e.message); }
  const all=Object.keys(BOSS_MOVES);
  const missing=all.filter(id=>!fired.has(id));
  return {all, missing, threw, count:all.length,
          ok: threw===null && missing.length===0 && all.length===9};
});

/* 2-b. 落石は**溜めの時点で**落ちる場所が決まっている。
       着弾時に決めると、予兆で見せた場所と当たる場所がずれて、
       「避けたのに当たった」が生まれる。 */
R.pillarsFixedAtCast = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(25); TH.immortal();
  const boss=W.enemies.find(x=>x.boss);
  boss.maxHp=boss.hp=1e9; boss.atkV=0; boss.state='chase';
  boss.moves=['pillars']; boss.cast=null; boss.moveCd=0;
  boss.x=P.x+3; boss.y=P.y;
  let spots=null;
  stepSim(4, {until:()=>{ if(boss.cast && boss.cast.spots){ spots=boss.cast.spots.map(s=>({x:s.x,y:s.y})); return true; } return false; }});
  if(!spots) return {skipped:true, ok:false};
  // 溜めているあいだに動いても、落ちる場所は動かない
  TH.move(0.4, 1, 0);
  const after=(boss.cast&&boss.cast.spots)||[];
  const same=after.length===spots.length &&
             after.every((s,i)=>Math.abs(s.x-spots[i].x)<1e-9 && Math.abs(s.y-spots[i].y)<1e-9);
  return {n:spots.length, want:BOSS_MOVES.pillars.n, same,
          ok: spots.length===BOSS_MOVES.pillars.n && same};
});

// 2-c. 突進は壁を抜けない（部屋の外へ消えない）
R.chargeStopsAtWall = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(35); TH.immortal();
  const boss=W.enemies.find(x=>x.boss);
  boss.maxHp=boss.hp=1e9; boss.atkV=0; boss.state='chase';
  boss.moves=['charge']; boss.cast=null; boss.moveCd=0;
  boss.x=P.x+3; boss.y=P.y;
  let inWall=false;
  stepSim(14, {after:()=>{ if(solid(boss.x, boss.y)) inWall=true; }});
  return {x:+boss.x.toFixed(2), y:+boss.y.toFixed(2), neverInWall: !inWall,
          ok: !inWall};
});

// 2-d. 招来は取り巻きを増やす
R.summonAdds = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(45); TH.immortal();
  const boss=W.enemies.find(x=>x.boss);
  boss.maxHp=boss.hp=1e9; boss.atkV=0; boss.state='chase';
  W.enemies=[boss];
  boss.moves=['summon']; boss.cast=null; boss.moveCd=0;
  boss.x=P.x+3; boss.y=P.y;
  const before=W.enemies.length;
  stepSim(6);
  const added=W.enemies.filter(e=>e.summoned).length;
  return {before, after:W.enemies.length, added, want:BOSS_MOVES.summon.n,
          grew: added>0, ok: added>0};
});

/* 2-e. 激昂で開く技はボスごとに違う。
       第2段階が「速くなるだけ」だと、全員同じ第2段階になる。 */
R.rageIsPerBoss = await pg.evaluate(depths=>{
  const rages=depths.map(d=>uniqueBossAt(d).rage.join('/'));
  const kinds=new Set(rages).size;
  // 激昂すると、その技が実際に手札へ入る
  TH.run(1,{seed:7}); TH.floor(30); TH.immortal();
  const boss=W.enemies.find(x=>x.boss);
  // 遠くにいる敵は更新そのものが回らない。そばに寄せてから削る。
  boss.x=P.x+2.5; boss.y=P.y; boss.state='chase'; boss.atkV=0;
  const before=boss.moves.slice();
  boss.hp=Math.round(boss.maxHp*0.3);
  stepSim(1.5);
  const after=boss.moves.slice();
  const want=uniqueBossAt(30).rage;
  return {rages, kinds, before:before.length, after:after.length,
          raged:boss.rage===true, gained:want.every(m=>after.includes(m)),
          ok: kinds>=3 && boss.rage===true && want.every(m=>after.includes(m))};
}, DEPTHS);

/* ================= 3. ユニーク敵のバリエーション ================= */

// 3-a. 性質は12種あり、ユニークは2つ持つ
R.uniqueAffixes = await pg.evaluate(()=>{
  let u=null;
  for(let k=0;k<60 && !u;k++){ TH.run(1,{seed:900+k}); TH.floor(21);
    u=W.enemies.find(x=>x.uniq); }
  if(!u) return {skipped:true, ok:false};
  return {kinds:ELITE_AFF.length, name:u.name, aff:u.aff.map(f=>f.nm),
          twoAffixes: u.aff.length===2,
          nameShowsBoth: u.aff.every(f=>u.name.includes(f.nm)),
          ok: ELITE_AFF.length>=10 && u.aff.length===2
              && u.aff.every(f=>u.name.includes(f.nm))};
});

// 3-b. 同じ性質が2つ付かない
R.noDupAffix = await pg.evaluate(()=>{
  let bad=0;
  for(let i=0;i<200;i++){
    const aff=rollEliteAffixes(2);
    if(aff.length===2 && aff[0].nm===aff[1].nm) bad++;
  }
  return {bad, ok: bad===0};
});

// 3-c. 組み合わせが十分に散る（同じユニークが続けて出ない）
R.affixVariety = await pg.evaluate(()=>{
  const seen=new Set();
  for(let i=0;i<300;i++) seen.add(rollEliteAffixes(2).map(f=>f.nm).sort().join('+'));
  return {kinds:seen.size, floor:20, varied: seen.size>=20, ok: seen.size>=20};
});

/* 3-d. 当たると効く性質が実際に効く（状態異常・吸収）。
       数字の上乗せだけの性質は、硬い雑魚が増えるのと変わらない。 */
R.affixesBite = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(12);
  const e=W.enemies[0];
  e.aff=[ELITE_AFF.find(f=>f.proc==='bleed'), ELITE_AFF.find(f=>f.leech)];
  e.maxHp=1000; e.hp=500; e.atkV=20; e.dead=false;
  S.run.pst={};
  S.hero.hpNow=stats(S.hero).maxHp;
  const hp0=e.hp;
  P.invuln=0; S.hero.equip.weapon=null;
  hitPlayer(e);
  return {bleeding: !!(S.run.pst.bleed && S.run.pst.bleed.t>0),
          healed: e.hp>hp0, before:hp0, after:e.hp,
          ok: !!(S.run.pst.bleed) && e.hp>hp0};
});

// 3-e. 「影の」はこちらの攻撃をたまにすり抜ける
R.shadowEvades = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(12);
  const e=W.enemies[0];
  e.aff=[ELITE_AFF.find(f=>f.evasive)];
  e.maxHp=e.hp=1e7; e.dead=false;
  const st=stats(S.hero);
  let missed=0;
  for(let i=0;i<300;i++){ const before=e.hp; hitEnemy(e, st, 1); if(e.hp===before) missed++; }
  return {missed, rate:+(missed/300).toFixed(2), want:ELITE_AFF.find(f=>f.evasive).evasive,
          inRange: missed>20 && missed<160, ok: missed>20 && missed<160};
});

// 3-f. 「裂ける」は倒すと2体に分かれ、分かれた側はもう分かれない
R.splitsOnce = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(12); TH.clearEnemies();
  const proto={x:P.x+2, y:P.y, arch:ARCH[0], fam:FAMILY[0], lv:12, elite:true,
    aff:[ELITE_AFF.find(f=>f.split)], maxHp:100, hp:1, atkV:5, def:1,
    res:FAMILY[0].res, dt:'blunt', st:{}, bu:{}, state:'chase', t:0, cd:0,
    vx:0, vy:0, hit:0, tele:0, dead:false, r:0.4, ms:1, teleMul:1,
    col:'#fff', name:'裂ける者'};
  W.enemies=[proto];
  killEnemy(proto);
  const after=W.enemies.filter(e=>!e.dead).length;
  const kids=W.enemies.filter(e=>e.wasSplit);
  kids.forEach(k=>{ k.hp=1; killEnemy(k); });
  const grandkids=W.enemies.filter(e=>!e.dead).length;
  return {after, kids:kids.length, grandkids,
          splitOnce: kids.length===2 && grandkids===0,
          ok: kids.length===2 && grandkids===0};
});

/* ================= 4. 通しで壊れない ================= */

// 4-a. 節目のボスと実際に殴り合っても、描画まで含めて例外が出ない
R.live = await pg.evaluate(()=>{
  const fails=[];
  for(const d of [5,20,35,50]){
    TH.run(1,{seed:23}); TH.floor(d); TH.immortal();
    S.hero.lv=40; S.hero.str=44; S.hero.dex=44; S.hero.vit=44;
    S.hero.equip.weapon=genBaseItem('sword',d,2);
    const boss=W.enemies.find(x=>x.boss);
    if(boss){ boss.x=P.x+2.4; boss.y=P.y; boss.maxHp=boss.hp=1e9; }
    try{
      stepSim(24, {draw:true, each:(t)=>{ stickDx=Math.cos(t*1.3); stickDy=Math.sin(t*0.9); }});
    }catch(e){ fails.push(d+': '+e.message); }
    stickDx=stickDy=0;
  }
  return {fails, ok: fails.length===0};
});

await done(b, errs, R);
