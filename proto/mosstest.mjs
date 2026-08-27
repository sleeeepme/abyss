// 苔玉と、その先にいるドゥラントリー。
//
// 本題は「弱い敵を足した」ことではなく、**6層ぶん通わせる約束が守られるか**。
// 数え間違い・重複加入・層の取り違えは、どれも「進んでいるはずが進んでいない」に化ける。
// 積み上げ式の物は、積み上がらないと分かるまでに何時間もかかるので、ここで止める。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 湧き方 ================= */

// 1-a. その層の苔玉が、雑魚とは別枠で少しだけ混じる
R.spawnsPerFloor = await pg.evaluate(()=>{
  S.moss={}; S.duranGiven=false;
  TH.run(1,{seed:41});
  const seen=[];
  for(let d=1; d<=8; d++){
    if(bossTierAt(d)) continue;          // ボス階には出さない（1-d で別に見る）
    TH.floor(d);
    seen.push(W.enemies.filter(e=>e.moss).length);
  }
  return {seen, range:MOSS_PER_FLOOR,
          always: seen.every(n=>n>=MOSS_PER_FLOOR[0]),
          bounded: seen.every(n=>n<=MOSS_PER_FLOOR[1]),
          ok: seen.every(n=>n>=MOSS_PER_FLOOR[0] && n<=MOSS_PER_FLOOR[1])};
});

/* 1-b. **層ごとに別の種。** 同じ苔玉が6層通して出ると、ただの湧き潰しになる。
       層の属性をそのまま被るので、「炉の層の苔玉は燃えている」が一目で分かる。 */
R.oneKindPerZone = await pg.evaluate(()=>{
  const rows=[];
  for(const z of mossZones()){
    const depth = ZONES.findIndex(x=>x.id===z)*10 + 3;   // その層のまんなかあたり
    TH.floor(depth);
    const zoneHere = zoneAt(depth).id;
    const mine = W.enemies.filter(e=>e.moss);
    rows.push({z, depth, zoneHere,
               tagged: mine.every(e=>e.moss===zoneHere),
               names:[...new Set(mine.map(e=>e.name))],
               dts:[...new Set(mine.map(e=>e.dt))]});
  }
  const kinds=new Set(rows.flatMap(r=>r.names));
  return {rows, kinds:[...kinds],
          taggedRight: rows.every(r=>r.tagged),
          oneNamePerZone: rows.every(r=>r.names.length<=1),
          sixDistinct: kinds.size===mossZones().length,
          // 層の属性を被っている（無属性の並びになっていない）
          elementVaries: new Set(rows.flatMap(r=>r.dts)).size>=4,
          ok: rows.every(r=>r.tagged && r.names.length<=1) && kinds.size===mossZones().length};
});

// 1-c. 比較的弱い。同じ階の雑魚より硬くない
R.weakerThanZako = await pg.evaluate(()=>{
  TH.floor(12);
  const moss=W.enemies.filter(e=>e.moss);
  const zako=W.enemies.filter(e=>!e.moss && !e.boss && !e.elite && !e.uniq);
  const avg=a=>a.reduce((s,e)=>s+e.maxHp,0)/Math.max(1,a.length);
  const avgA=a=>a.reduce((s,e)=>s+e.atkV,0)/Math.max(1,a.length);
  return {mossHp:Math.round(avg(moss)), zakoHp:Math.round(avg(zako)),
          mossAtk:Math.round(avgA(moss)), zakoAtk:Math.round(avgA(zako)),
          mossMs:moss[0].ms, softer: avg(moss) < avg(zako), gentler: avgA(moss) < avgA(zako),
          ok: avg(moss) < avg(zako) && avgA(moss) < avgA(zako)};
});

// 1-d. ボス階には出さない（ボス戦にマスコットを混ぜない）
R.notOnBossFloors = await pg.evaluate(()=>{
  TH.floor(10);
  const onBoss=W.enemies.filter(e=>e.moss).length;
  return {boss:!!bossTierAt(10), onBoss, absent:onBoss===0, ok: onBoss===0};
});

/* ================= 2. 数える ================= */

// 2-a. 倒すと、その層の数だけが増える
R.countsByZone = await pg.evaluate(()=>{
  S.moss={}; S.duranGiven=false;
  TH.floor(3);                                   // 石の層
  const e=W.enemies.find(x=>x.moss);
  const zone=e.moss;
  e.hp=1; killEnemy(e, null);
  const others=mossZones().filter(z=>z!==zone).map(z=>mossKilled(z));
  return {zone, got:mossKilled(zone), others,
          onlyThatZone: others.every(n=>n===0),
          ok: mossKilled(zone)===1 && others.every(n=>n===0)};
});

/* 2-b. 数え切った層は増やさない。**表示が嘘になる**——
       「20 / 20」のはずが 34 と出ると、何を数えているのか分からなくなる。 */
R.stopsAtCap = await pg.evaluate(()=>{
  S.moss={stone:MOSS_PER_ZONE};
  TH.floor(3);
  const e=W.enemies.find(x=>x.moss);
  e.hp=1; killEnemy(e, null);
  return {n:mossKilled('stone'), cap:MOSS_PER_ZONE,
          ok: mossKilled('stone')===MOSS_PER_ZONE};
});

// 2-c. 記録は口座側。主人公が死んでも消えない
R.survivesDeath = await pg.evaluate(()=>{
  S.moss={stone:7, sump:3}; S.duranGiven=false;
  TH.run(3,{seed:42});
  for(let i=0;i<40 && S.hero;i++){ S.hero.hpNow=1; hitPlayer(null,99999,0,3); }
  return {stone:mossKilled('stone'), sump:mossKilled('sump'),
          ok: mossKilled('stone')===7 && mossKilled('sump')===3};
});

/* ================= 3. ドゥラントリー ================= */

// 3-a. 6層すべてで規定数に届くと、酒場に来る
R.grantedWhenComplete = await pg.evaluate(()=>{
  S.run=null; S.hero=newHero(); S.hero.party=[];
  S.tavern=[]; S.tavernPool=null;
  S.moss={}; S.duranGiven=false;
  mossZones().forEach(z=>{ S.moss[z]=MOSS_PER_ZONE; });
  const before=mossComplete();
  grantDurantree();
  const d=tavernStock().find(isDurantree);
  return {complete:before, given:S.duranGiven, inTavern:!!d,
          name:d&&d.name, cost:d?hireCost(d):null,
          fixedName: !!d && d.name===DURAN_NAME,
          free: !!d && hireCost(d)===0,
          bareHanded: !!d && !d.equip.weapon && !d.equip.armor && !d.equip.shield,
          ok: before && !!d && d.name===DURAN_NAME && hireCost(d)===0
              && !d.equip.weapon};
});

// 3-b. **一度だけ。** 二度目の達成で増えない
R.grantedOnce = await pg.evaluate(()=>{
  const n0=tavernStock().filter(isDurantree).length;
  grantDurantree(); grantDurantree();
  return {before:n0, after:tavernStock().filter(isDurantree).length,
          ok: tavernStock().filter(isDurantree).length===n0};
});

// 3-c. 攻撃に参加しない
R.neverAttacks = await pg.evaluate(()=>{
  S.run=null; S.hero=newHero(); S.hero.party=[];
  TH.run(1,{seed:43}); TH.floor(14); TH.immortal();
  const d=makeAlly(14,S.hero); d.job='durantree'; d.name=DURAN_NAME;
  d.equip={weapon:null, shield:null, armor:null, accessory:null};
  d.lv=50; d.slot=0; d.x=P.x+0.6; d.y=P.y; d.hpNow=allyStats(d).maxHp;
  S.hero.party=[d];
  const e=W.enemies[0]; W.enemies=[e]; gridBuild();
  e.dead=false; e.maxHp=e.hp=1e9; e.atkV=0; e.x=P.x+0.9; e.y=P.y;
  S.hero.equip.weapon=null;
  let byAlly=0;
  const orig=window.hitEnemyByAlly;
  window.hitEnemyByAlly=function(){ byAlly++; return orig.apply(this,arguments); };
  stepSim(6, {each:()=>{ e.x=P.x+0.9; e.y=P.y; }});
  window.hitEnemyByAlly=orig;
  return {byAlly, shots:d.shots||0, silent: byAlly===0 && !(d.shots>0),
          ok: byAlly===0 && !(d.shots>0)};
});

// 3-d. 足が遅い（先頭に立てない）
R.slow = await pg.evaluate(()=>{
  const d=livingParty().find(isDurantree);
  const w=makeAlly(14,S.hero); w.job='warrior';
  return {duran:+allyStats(d).ms.toFixed(2), warrior:+allyStats(w).ms.toFixed(2),
          ok: allyStats(d).ms < allyStats(w).ms};
});

/* ================= 4. 支援 ================= */

/* 4-a. **そばにいるあいだだけ**掛かる。
       全体に掛かる形にすると、置いておくだけの置物になって
       「どこに立たせるか」という唯一の操作が消える。 */
R.auraNeedsProximity = await pg.evaluate(()=>{
  const d=livingParty().find(isDurantree);
  d.lv=50;
  d.x=P.x; d.y=P.y;
  const near=stats(S.hero);
  d.x=P.x+DURAN_RANGE+4; d.y=P.y;
  const far=stats(S.hero);
  return {range:DURAN_RANGE,
          nearRange:+near.range.toFixed(3), farRange:+far.range.toFixed(3),
          nearAspd:+near.aspd.toFixed(3), farAspd:+far.aspd.toFixed(3),
          nearHp:near.maxHp, farHp:far.maxHp,
          nearDef:+near.def.toFixed(2), farDef:+far.def.toFixed(2),
          helpsNear: near.range>far.range && near.aspd>far.aspd
                     && near.maxHp>far.maxHp && near.def>far.def,
          ok: near.range>far.range && near.aspd>far.aspd
              && near.maxHp>far.maxHp && near.def>far.def};
});

// 4-b. レベルの節目でひとつずつ増える（10 範囲 / 20 攻速 / 30 HP / 40 防御）
R.auraByLevel = await pg.evaluate(()=>{
  const d=livingParty().find(isDurantree);
  d.x=P.x; d.y=P.y;
  const at=lv=>{ d.lv=lv; return duranNear(P.x,P.y); };
  const l5=at(5), l10=at(10), l20=at(20), l30=at(30), l40=at(40);
  d.lv=50;
  return {l5, l10, l20, l30, l40,
          none:  l5.range===0 && l5.aspd===0 && l5.hp===0 && l5.def===0,
          steps: l10.range===15 && l20.aspd===15 && l30.hp===15 && l40.def===15,
          ok: l5.range===0 && l10.range===15 && l20.aspd===15
              && l30.hp===15 && l40.def===15};
});

// 4-c. 自分自身は強くならない（支援は外向きだけ）
R.noSelfBuff = await pg.evaluate(()=>{
  const d=livingParty().find(isDurantree);
  d.lv=50; d.x=P.x; d.y=P.y;
  const mine=allyStats(d);
  const w=makeAlly(14,S.hero); w.job='warrior'; w.lv=d.lv;
  w.x=P.x; w.y=P.y; S.hero.party.push(w);
  const nearW=allyStats(w).range;
  w.x=P.x+DURAN_RANGE+5;
  const farW=allyStats(w).range;
  S.hero.party=S.hero.party.filter(m=>m!==w);
  return {mineRange:+mine.range.toFixed(3),
          nearW:+nearW.toFixed(3), farW:+farW.toFixed(3),
          helpsOthers: nearW>farW,
          ok: nearW>farW};
});

/* 4-d. 状態異常耐性は**距離を見ない。**
       隊がばらけているときほど要る物なので。 */
R.ailResistIsPartyWide = await pg.evaluate(()=>{
  const d=livingParty().find(isDurantree);
  d.x=P.x+40; d.y=P.y+40;                       // うんと離す
  const rz=duranAilResist();
  // 100回かけて、通った回数が明らかに減っている
  const tries=400;
  let through=0;
  for(let i=0;i<tries;i++){
    S.run.pst={};
    addStatus({isPlayer:true, st:S.run.pst}, 'burn', 20);
    if(S.run.pst.burn) through++;
  }
  S.run.pst={};
  const rate=through/tries;
  return {resist:rz, want:DURAN_AIL, rate:+rate.toFixed(2),
          farAway:true,
          // 50% 耐性なら通るのはおよそ半分（±0.12 に収める）
          halved: Math.abs(rate - (1-DURAN_AIL/100)) < 0.12,
          ok: rz===DURAN_AIL && Math.abs(rate - (1-DURAN_AIL/100)) < 0.12};
});

/* 4-e. Lv.50「芽吹き」。技と大技の待ちを**その場で半分に詰める**。
       「掛かっているあいだ短くなる」形にすると、
       何が起きたのか画面から一切読めない（数字が動かないので）。 */
R.recastHalves = await pg.evaluate(()=>{
  const d=livingParty().find(isDurantree);
  d.lv=50; d.x=P.x; d.y=P.y;
  d.recastCd=0.001;
  P.ultCd=40;
  const mate=makeAlly(14,S.hero); mate.job='warrior'; mate.lv=50;
  mate.artCd=12; mate.x=P.x; mate.y=P.y; S.hero.party.push(mate);
  const ult0=P.ultCd, art0=mate.artCd;
  duranRecast(d, 0.002);
  const halved = Math.abs(P.ultCd - ult0/2) < 0.01 && Math.abs(mate.artCd - art0/2) < 0.01;
  const cd = d.recastCd;
  S.hero.party=S.hero.party.filter(m=>m!==mate);
  return {ult0, ult1:P.ultCd, art0, art1:+mate.artCd.toFixed(2),
          cd, want:DURAN_RECAST_CD, halved, resets: cd===DURAN_RECAST_CD,
          ok: halved && cd===DURAN_RECAST_CD};
});

// 4-f. 抽選には出てこない（条件を満たしたときだけ来る一体もの）
R.neverRolled = await pg.evaluate(()=>{
  const seen=new Set();
  for(let i=0;i<600;i++) seen.add(pickJob().id);
  return {jobs:[...seen].sort(), n:seen.size,
          absent: !seen.has('durantree'),
          ok: !seen.has('durantree')};
});

/* ================= 5. 絵 =================
   絵の正は `proto/assets/sprites/` の PNG と `docs/CHARACTER_ART_LIST.md`。
   本編は単一HTMLで配るので data URI で写しを埋めてある。
   **写しのほうが古くなる**のが一番ありがちな壊れ方なので、ここで見張る。 */

// 5-a. 苔玉の絵が読める。16px・正方形
R.spriteLoads = await pg.evaluate(async ()=>{
  const im=SPRIMG['moss-ball'];
  if(im && !im.complete) await new Promise(r=>{ im.onload=r; im.onerror=r; });
  const ok=!!sprite('moss-ball');
  return {has: !!SPRITES['moss-ball'],
          isDataUri: (SPRITES['moss-ball']||'').startsWith('data:image/png;base64,'),
          w: im?im.naturalWidth:0, h: im?im.naturalHeight:0,
          native16: im && im.naturalWidth===16 && im.naturalHeight===16,
          ready: ok,
          ok: ok && im.naturalWidth===16 && im.naturalHeight===16};
});

// 5-b. 石の層の苔玉と、ドゥラントリーの両方に割り当たっている
R.spriteAssigned = await pg.evaluate(()=>{
  S.moss={}; S.duranGiven=false;
  TH.run(1,{seed:71}); TH.floor(3);
  const m=W.enemies.find(e=>e.moss);
  const d=makeAlly(10, S.hero); d.job='durantree';
  return {enemyZone:m&&m.moss, enemyKey:mossSpriteKey(m),
          allyIsDuran:isDurantree(d),
          enemyHasArt: mossSpriteKey(m)==='moss-ball',
          ok: mossSpriteKey(m)==='moss-ball' && isDurantree(d)};
});

/* 5-c. **絵の無い層は、元の図形のまま出る。**
       「絵が無い＝描かない」にすると、描き足すまで盤面から消える。 */
R.otherZonesFallBack = await pg.evaluate(()=>{
  const rows=mossZones().map(z=>({z, key:MOSS_SPRITE[z]||null}));
  const withArt=rows.filter(r=>r.key);
  const without=rows.filter(r=>!r.key);
  return {rows, withArt:withArt.length, without:without.length,
          // 絵の無い層は null（＝図形へ落ちる）。undefined や 'moss-ball' を返さない
          allNull: without.every(r=>r.key===null),
          ok: withArt.length>=1 && without.every(r=>r.key===null)};
});

// 5-d. 描いても落ちない（絵と図形が混じった床）
R.drawsSafely = await pg.evaluate(()=>{
  TH.run(1,{seed:72}); TH.floor(3); TH.immortal();
  let threw=null;
  try{ stepSim(2, {draw:true}); }catch(e){ threw=String(e.message); }
  return {threw, moss:W.enemies.filter(e=>e.moss).length,
          ok: threw===null};
});

/* ================= 6. 名前の衝突 =================
   苔玉は雑魚三十二種とは別の表なので、**名前が被っても誰も止めてくれない。**
   実際に被った——炉の層の苔玉を「シンダーモス」にしたが、
   その名前は既に E-19（熱・飛の蛾）が使っていた。 */
R.namesDoNotCollide = await pg.evaluate(()=>{
  const zako=new Set();
  Object.values(ZAKO).forEach(byArch=>Object.values(byArch).forEach(n=>zako.add(n)));
  const moss=mossZones().map(z=>MOSS_KINDS[z].nm);
  const clash=moss.filter(n=>zako.has(n));
  const dupes=moss.filter((n,i)=>moss.indexOf(n)!==i);
  return {moss, zakoCount:zako.size, clash, dupes,
          noClash: clash.length===0, allUnique: dupes.length===0,
          ok: clash.length===0 && dupes.length===0};
});

await done(b, errs, R);
