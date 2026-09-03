// 道中の作り: 雑魚の癖（層×形式の格子）・亡者の起き上がり・装飾品の付帯。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ============ 1. 雑魚の癖 ============
   個体ごとではなく「層 × 形式」で配る。同じ形式でも層が変われば別の相手になる。 */

// 1-a. 格子は層と形式で引ける。全部のマスは埋めない（埋めると差が消える）。
R.traitGrid = await pg.evaluate(()=>{
  const zones=Object.keys(ZAKO_TRAIT_GRID);
  const archs=ARCH.map(a=>a.id);
  const cells=[];
  zones.forEach(z=>archs.forEach(a=>cells.push(zakoTraitFor(z,a))));
  const filled=cells.filter(Boolean);
  const kinds=[...new Set(filled)].sort();
  const known=Object.keys(ZAKO_TRAITS).sort();
  // 層ごとに癖の組み合わせが違う＝層を跨ぐと道中の手触りが変わる
  const sigs=zones.map(z=>archs.map(a=>zakoTraitFor(z,a)||'-').join('/'));
  return {zones:zones.length, archs:archs.length, cells:cells.length,
          filled:filled.length, kinds, known, sigs,
          everyZoneCovered: zones.length===6,
          everyArchCovered: archs.length===4,
          someCellsEmpty: filled.length < cells.length,
          someCellsFilled: filled.length > 0,
          onlyKnownTraits: kinds.every(k=>known.includes(k)),
          everyTraitUsed:  known.every(k=>kinds.includes(k)),
          zonesDiffer: new Set(sigs).size >= 5,
          ok: filled.length>0 && filled.length<cells.length
              && kinds.every(k=>known.includes(k)) && known.every(k=>kinds.includes(k))
              && new Set(sigs).size>=5};
});

// 1-b. 実際に湧いた敵に癖が乗る。全員ではなく一部だけ。名前で予告する。
R.traitsOnSpawn = await pg.evaluate(()=>{
  let total=0, withTrait=0;
  const kinds={}, names=[];
  const badArch=[];
  for(const d of [25,35,45,55]){
    for(let s=0;s<6;s++){
      RNG=mulberry32(d*7919+s); const fl=genFloor(d); const es=spawnEnemies(fl,d);
      es.forEach(e=>{
        if(e.boss || e.elite || e.uniq || e.moss) return;
        total++;
        if(!e.trait) return;
        withTrait++;
        kinds[e.trait]=(kinds[e.trait]||0)+1;
        if(names.length<5) names.push(e.name);
        // 格子に無い組み合わせに癖が乗っていないか
        if(zakoTraitFor(fl.zone.id, e.arch.id)!==e.trait) badArch.push(e.name);
        e.traitOk = ZAKO_TRAITS[e.trait] ? 1 : 0;
      });
    }
  }
  const share=withTrait/Math.max(1,total);
  const named=names.filter(n=>/^(跳ぶ|退く|弾ける)/.test(n));
  return {total, withTrait, share:+share.toFixed(3), kinds, names,
          wanted:ZAKO_TRAIT_SHARE, offGrid:badArch.length,
          someHaveTraits: withTrait>0,
          notEveryone:    share < 0.5,
          followsGrid:    badArch.length===0,
          namesWarn:      names.length>0 && named.length===names.length,
          severalKinds:   Object.keys(kinds).length>=2,
          ok: withTrait>0 && share<0.5 && badArch.length===0
              && named.length===names.length && Object.keys(kinds).length>=2};
});

// 1-c. 精鋭・規格外・ボス・苔玉には癖を足さない（性質が重なって読めなくなる）
R.traitsSkipSpecials = await pg.evaluate(()=>{
  let elites=0, bosses=0, moss=0, mossWith=0, eliteWith=0, bossWith=0;
  for(const d of [45,50,55]){
    for(let s=0;s<6;s++){
      RNG=mulberry32(d*7919+s); const fl=genFloor(d);
      spawnEnemies(fl,d).forEach(e=>{
        if(e.elite){ elites++; if(e.trait) eliteWith++; }
        if(e.boss){ bosses++;  if(e.trait) bossWith++; }
      });
      spawnMoss(fl,d).forEach(e=>{ moss++; if(e.trait) mossWith++; });
    }
  }
  return {elites, eliteWith, bosses, bossWith, moss, mossWith,
          elitesClean: eliteWith===0,
          bossesClean: bossWith===0,
          mossClean:   mossWith===0,
          sawSome: elites>0 && bosses>0,
          ok: eliteWith===0 && bossWith===0 && mossWith===0 && elites>0 && bosses>0};
});

// 1-d. 「弾ける」は自分の周りを巻き込む。主人公にも仲間にも同じように当たる。
R.burstHitsEveryone = await pg.evaluate(()=>{
  TH.run(35,{seed:4}); TH.immortal(); TH.clearEnemies();
  const a=TH.ally(35,'knight',30); S.hero.party=[a];
  a.x=P.x+0.5; a.y=P.y; a.hpNow=allyStats(a).maxHp;
  const hp0=S.hero.hpNow, ahp0=a.hpNow;
  const e={x:P.x+0.6, y:P.y, atkV:40, lv:30, dt:'blunt', r:0.34, dead:false,
           st:{}, bu:{}, arch:ARCH[0], fam:FAMILY[0], trait:'burst'};
  W.enemies=[e];
  P.invuln=0;
  zakoBurst(e);
  const heroHurt=S.hero.hpNow < hp0, allyHurt=a.hpNow < ahp0;
  const ring=W.fx.some(f=>f.t==='shock');
  // 半径の外は巻き込まない
  P.x+=6; S.hero.hpNow=hp0; const hp1=S.hero.hpNow;
  P.invuln=0; zakoBurst(e);
  const farSafe = S.hero.hpNow===hp1;
  return {heroHurt, allyHurt, ring, farSafe,
          radius:ZAKO_TRAITS.burst.r,
          weakerThanBoss: ZAKO_TRAITS.burst.r < 3.0 && ZAKO_TRAITS.burst.mult < 1.0,
          ok: heroHurt && allyHurt && ring && farSafe
              && ZAKO_TRAITS.burst.r<3.0 && ZAKO_TRAITS.burst.mult<1.0};
});

// 1-e. 「跳ぶ」は狙う相手の周りへ跳ぶ。床の上にしか降りない。
R.blinkLandsOnFloor = await pg.evaluate(()=>{
  TH.run(55,{seed:7}); TH.immortal(); TH.clearEnemies();
  const e={x:P.x+7, y:P.y, dead:false, st:{}, bu:{}, arch:ARCH[0], fam:FAMILY[0],
           trait:'blink', traitCd:0, cd:0, tele:0, atkV:1, lv:30, dt:'blunt', r:0.34};
  W.enemies=[e];
  const tg={x:P.x, y:P.y, ent:null};
  let moved=0, offFloor=0, tooFar=0, landedNear=0;
  for(let i=0;i<40;i++){
    const bx=e.x, by=e.y;
    e.traitCd=0;
    zakoBlink(e, 0.1, tg, Math.hypot(e.x-P.x, e.y-P.y));
    if(e.x!==bx || e.y!==by){
      moved++;
      if(!standable(e.x,e.y)) offFloor++;
      const near=Math.hypot(e.x-P.x, e.y-P.y);
      if(near<1.0 || near>3.2) tooFar++; else landedNear++;
      e.x=bx+7; e.y=by;     // また離す
    }
  }
  return {moved, offFloor, tooFar, landedNear, dist:ZAKO_TRAITS.blink.dist,
          jumped: moved>0,
          alwaysOnFloor: offFloor===0,
          landsBesideTarget: tooFar===0,
          notOnTopOfTarget: landedNear===moved,
          ok: moved>0 && offFloor===0 && tooFar===0};
});

/* ============ 2. 亡者は起き上がる ============ */

// 2-a. 倒しても約1分で立ち上がる。名前が変わり、二度目の実入りは無い。
R.undeadRises = await pg.evaluate(()=>{
  TH.run(12,{seed:3}); TH.immortal();
  /* 層ごとに出る系統は絞られていて、亡者が湧かない階もある。
     見たいのは「亡者なら起き上がる」ことなので、1体を亡者に仕立てて確かめる。 */
  const e=W.enemies.find(x=>!x.boss && !x.dead);
  if(!e) return {found:false, ok:false};
  e.fam=FAMILY.find(f=>f.id==='undead'); e.res=e.fam.res; e.dt=e.fam.atk;
  const was=e.name, x=e.x, y=e.y;
  const xp0=S.hero.xp, gold0=S.run.gold, drops0=W.drops.length;
  e.hp=1; killEnemy(e);
  const queued=(W.risen||[]).length;
  const goneAtOnce=e.dead===true;
  const gotReward = S.hero.xp>xp0 || S.run.gold>gold0;
  // まだ起きない
  TH.step(UNDEAD_RISE_SEC*0.5);
  const stillDown=e.dead===true;
  /* 起き上がる瞬間で止める。立ったあとも回し続けると、そのぶん歩いてしまい、
     「倒れた場所から起きたか」が測れなくなる（実際それで 4.5 マスずれた）。 */
  let waited=UNDEAD_RISE_SEC*0.5;
  for(let i=0;i<40 && e.dead;i++){ TH.step(1); waited+=1; }
  const up = !e.dead && W.enemies.includes(e);
  const full = e.hp===e.maxHp;
  // 二度目は何も出さない
  const xp1=S.hero.xp, gold1=S.run.gold, drops1=W.drops.length;
  e.hp=1; killEnemy(e);
  const secondReward = S.hero.xp>xp1 || S.run.gold>gold1 || W.drops.length>drops1;
  /* 起き上がるのは倒れた場所。ただし立ってからは歩き出すので、
     ぴったり同じ座標では見ない——「その辺から起きた」かどうかで見る。 */
  /* 立った場所そのものは、時間を進めずに確かめる。
     起き上がった直後から歩き出すので、1秒でも回すと 3 マス動いてしまう。 */
  const spot=(()=>{
    const f=W.enemies.find(z=>!z.boss && !z.dead);
    if(!f) return null;
    f.fam=FAMILY.find(q=>q.id==='undead');
    const fx=f.x, fy=f.y;
    f.hp=1; killEnemy(f);
    tickRisen(UNDEAD_RISE_SEC+0.1);
    return {drift:+Math.hypot(f.x-fx, f.y-fy).toFixed(3), up:!f.dead};
  })();
  return {was, name:e.name, queued, waited, spot,
          roseWhereItFell: !!spot && spot.up && spot.drift < 0.01,
          tookAboutAMinute: waited>=UNDEAD_RISE_SEC-1 && waited<=UNDEAD_RISE_SEC+3,
          secs:UNDEAD_RISE_SEC,
          found:true,
          diesFirst: goneAtOnce,
          paidOnce: gotReward,
          waitsAMinute: stillDown,
          risesAfter: up && full,
          renamed: /^甦った/.test(e.name),
          noSecondPayout: !secondReward,
          ok: goneAtOnce && gotReward && stillDown && up && full
              && /^甦った/.test(e.name) && !secondReward};
});

// 2-b. 起き上がるのは亡者だけ。主も分身も戻らない。階を出れば忘れる。
R.onlyUndeadRise = await pg.evaluate(()=>{
  TH.run(12,{seed:3}); TH.immortal();
  const other=W.enemies.find(x=>x.fam.id!=='undead' && !x.boss);
  const before=(W.risen||[]).length;
  if(other){ other.hp=1; killEnemy(other); }
  const afterOther=(W.risen||[]).length;
  const und=W.enemies.find(x=>!x.boss && !x.dead && x!==other);
  if(und){ und.fam=FAMILY.find(f=>f.id==='undead'); und.hp=1; killEnemy(und); }
  const afterUndead=(W.risen||[]).length;
  // 階を降りたら、待ち行列は空になる
  TH.floor(13);
  const afterFloor=(W.risen||[]).length;
  return {before, afterOther, afterUndead, afterFloor,
          otherFam: other && other.fam.id,
          otherDoesNotQueue: afterOther===before,
          undeadQueues: afterUndead>afterOther,
          clearedOnDescend: afterFloor===0,
          ok: afterOther===before && afterUndead>afterOther && afterFloor===0};
});

/* ============ 3. 指輪と護符の付帯 ============ */

// 3-a. レア度が上がるほど数も効き目も増える。武器には付かない。
R.charmScalesWithRarity = await pg.evaluate(()=>{
  const ring=r=>buildItem(BASES.find(x=>x.id==='ring'), RARITY[r], 40);
  const counts=[0,1,2,3,4].map(r=>charmAffs(ring(r)).length);
  // 効き目の平均（同じ付帯どうしで比べる）
  const avg=(r)=>{ let s=0,n=0;
    for(let i=0;i<600;i++) charmAffs(ring(r)).forEach(a=>{ if(a.stat==='hp'){ s+=a.v; n++; } });
    return n? s/n : 0; };
  const lowV=avg(1), highV=avg(4);
  const sword=buildItem(BASES.find(x=>x.id==='sword'), RARITY[4], 40);
  const armor=buildItem(BASES.find(x=>x.id==='plate'), RARITY[4], 40);
  return {counts, lowV:Math.round(lowV), highV:Math.round(highV),
          swordCharms:charmAffs(sword).length, armorCharms:charmAffs(armor).length,
          commonHasNone: counts[0]===0,
          moreWhenRarer: counts[4]>counts[1],
          strongerWhenRarer: highV > lowV*1.15,
          onlyOnAccessories: charmAffs(sword).length===0 && charmAffs(armor).length===0,
          ok: counts[0]===0 && counts[4]>counts[1] && highV>lowV*1.15
              && charmAffs(sword).length===0 && charmAffs(armor).length===0};
});

// 3-b. 当たりの2つは確率が低く、安い品には付かない
R.rareCharmsAreRare = await pg.evaluate(()=>{
  const ring=r=>buildItem(BASES.find(x=>x.id==='ring'), RARITY[r], 40);
  const count=(r,kind,N)=>{ let n=0;
    for(let i=0;i<N;i++) charmAffs(ring(r)).forEach(a=>{ if(a.kind===kind) n++; });
    return n; };
  const N=4000;
  const partyRelic=count(4,'party',N), reviveRelic=count(4,'revive',N);
  const commonKinds={};
  for(let i=0;i<N;i++) charmAffs(ring(1)).forEach(a=>{ commonKinds[a.kind]=1; });
  const reviveAtRare=count(2,'revive',N);
  const partyAtMagic=count(1,'party',N);
  const plainRelic=count(4,'stat',N);
  return {partyRelic, reviveRelic, reviveAtRare, partyAtMagic, plainRelic,
          partyRate:+(partyRelic/N).toFixed(3), reviveRate:+(reviveRelic/N).toFixed(3),
          magicKinds:Object.keys(commonKinds).sort(),
          rareOnesAppear: partyRelic>0 && reviveRelic>0,
          rarerThanPlain: partyRelic*8 < plainRelic && reviveRelic*8 < plainRelic,
          reviveNeedsRelic: reviveAtRare===0,
          partyNeedsUnique: partyAtMagic===0,
          ok: partyRelic>0 && reviveRelic>0 && reviveAtRare===0 && partyAtMagic===0
              && partyRelic*8 < plainRelic};
});

// 3-c. 効果が実際に効く（状態異常・隊の強化・一度だけの復活）
R.charmEffectsApply = await pg.evaluate(()=>{
  TH.run(18,{seed:5}); TH.immortal(); TH.clearEnemies();
  const mk=aff=>{ const it=buildItem(BASES.find(x=>x.id==='ring'), RARITY[4], 40);
                  it.aff=aff; it.ident=true; return it; };
  /* 剣（斬撃）は殴っているだけで出血が溜まる。付帯のぶんだけを見たいので、
     出血を溜めない打撃の武器に持ち替えてから確かめる。 */
  const mace=genBaseItem('mace', 20, 0); mace.aff=[]; mace.ident=true;
  S.hero.equip.weapon=mace;
  // 状態異常
  S.hero.equip.accessory=mk([{t:'c',id:'rend',nm:'裂',kind:'proc',proc:'bleed',v:100}]);
  const e=Object.assign({}, W.fl && {}, {x:P.x+1, y:P.y, hp:1e9, maxHp:1e9, atkV:0, ms:0,
    dead:false, st:{}, bu:{}, arch:ARCH[0], fam:FAMILY[0], res:{}, dt:'slash', lv:20, r:0.34});
  W.enemies=[e];
  hitEnemy(e, stats(S.hero), 1);
  const procced=!!e.st.bleed;
  // 付帯が無ければ乗らない
  S.hero.equip.accessory=mk([{t:'c',id:'might',nm:'力',kind:'stat',stat:'dmgPct',v:10}]);
  e.st={}; e.hp=1e9;
  for(let i=0;i<40;i++){ e.st={}; hitEnemy(e, stats(S.hero), 1); if(e.st.bleed) break; }
  const quietWithout=!e.st.bleed;
  // 隊の強化
  S.hero.equip.accessory=mk([{t:'c',id:'banner',nm:'旗',kind:'party',v:12}]);
  const withBanner=partyAura();
  S.hero.equip.accessory=mk([{t:'c',id:'might',nm:'力',kind:'stat',stat:'dmgPct',v:10}]);
  const without=partyAura();
  // 一度だけの復活
  S.hero.equip.accessory=mk([{t:'c',id:'rise',nm:'不死',kind:'revive'}]);
  S.run.charmRiseUsed=false;
  S.hero.hpNow=-1;
  const first=tryPhoenix(S.hero, true);
  const hpAfter=S.hero.hpNow;
  S.hero.hpNow=-1;
  const second=tryPhoenix(S.hero, true);
  return {procced, quietWithout, withBanner, without,
          hpAfter:Math.round(hpAfter), firstSaved:first, secondBlocked:!second,
          procWorks: procced && quietWithout,
          bannerWorks: withBanner.atk===12 && withBanner.hp===12 && without.atk===0,
          reviveWorks: first===true && hpAfter>0,
          reviveOnlyOnce: second===false,
          ok: procced && quietWithout && withBanner.atk===12 && without.atk===0
              && first===true && hpAfter>0 && second===false};
});

// 3-d. 名前と説明で、付いている物が分かる
R.charmsAreLegible = await pg.evaluate(()=>{
  const it=buildItem(BASES.find(x=>x.id==='ring'), RARITY[4], 40);
  it.aff=[{t:'c',id:'rend',nm:'裂',kind:'proc',proc:'bleed',v:20},
          {t:'c',id:'banner',nm:'旗',kind:'party',v:10},
          {t:'c',id:'rise',nm:'不死',kind:'revive'}];
  it.ident=true;
  const nm=itemName(it), lines=affLines(it).join(' / ');
  return {nm, lines:lines.slice(0,200),
          marksInName: /裂/.test(nm) && /旗/.test(nm) && /不死/.test(nm),
          saysProc:   /出血/.test(lines),
          saysParty:  /仲間全員/.test(lines),
          saysRevive: /立ち上がる/.test(lines),
          ok: /裂/.test(nm) && /出血/.test(lines) && /仲間全員/.test(lines)
              && /立ち上がる/.test(lines)};
});

// 3-e. 数値にならない付帯が、こっそり壊れた数値を作らない
R.charmsDoNotLeak = await pg.evaluate(()=>{
  TH.run(18,{seed:5}); TH.immortal();
  const it=buildItem(BASES.find(x=>x.id==='ring'), RARITY[4], 40);
  it.aff=[{t:'c',id:'banner',nm:'旗',kind:'party',v:10},
          {t:'c',id:'rise',nm:'不死',kind:'revive'},
          {t:'c',id:'rend',nm:'裂',kind:'proc',proc:'bleed',v:20}];
  it.ident=true;
  S.hero.equip.accessory=it;
  const st=stats(S.hero);
  const keys=Object.keys(st);
  const nums=keys.filter(k=>typeof st[k]==='number');
  return {nan: nums.filter(k=>!isFinite(st[k])),
          atk:Math.round(st.atk), maxHp:st.maxHp,
          noStrayKey: !keys.includes('undefined'),
          allFinite: nums.every(k=>isFinite(st[k])),
          stillPlayable: st.atk>0 && st.maxHp>0,
          ok: !keys.includes('undefined') && nums.every(k=>isFinite(st[k]))
              && st.atk>0 && st.maxHp>0};
});

/* ============ 4. 実際に潜って壊れない ============ */

R.live = await pg.evaluate(()=>{
  const failures=[];
  try{
    TH.run(1,{seed:11}); TH.immortal();
    for(const d of [12, 25, 35, 45, 55]){
      TH.floor(d);
      const ring=buildItem(BASES.find(x=>x.id==='ring'), RARITY[4], d);
      ring.ident=true; S.hero.equip.accessory=ring;
      // 亡者を数体倒してから、起き上がる時間ぶん回す
      W.enemies.filter(e=>e.fam.id==='undead').slice(0,3).forEach(e=>{ e.hp=1; killEnemy(e); });
      TH.step(6);
      draw(); updateHUD();
    }
    TH.step(UNDEAD_RISE_SEC+2);
    draw(); updateHUD();
  }catch(err){ failures.push(err.message); }
  return {failures, alive:!!S.hero, running:!!S.run,
          risenLeft:(W.risen||[]).length,
          noneThrew: failures.length===0,
          ok: failures.length===0 && !!S.hero && !!S.run};
});

await done(b, errs, R);
