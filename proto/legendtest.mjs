// レジェンド武器。24本の固有名・落ち方・壊れなさ・死んでも残ること・玉鋼での強化、
// そして「攻撃の作法そのものを変える」効果（多段・散弾・衝撃波・命中時の追撃）。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(350);
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });

/* 試験台。的は W.enemies に置いただけでは近傍グリッドに載らない
   （nearEnemies はグリッド越しに探す）ので、置いたあと必ず一度時間を進める。 */
await pg.evaluate(()=>{
  window.LT = {
    proto: null,
    arm(id, depth){
      S.hero=newHero(); S.upg={hp:8}; startRun(depth||18); S.hero.party=[]; P.invuln=1e9;
      LT.proto = LT.proto || W.enemies.find(x=>!x.boss) || W.enemies[0];
      S.hero.equip.weapon = makeLegend(id);
      P.queue.length=0;
      return stats(S.hero);
    },
    target(d){
      const e=Object.assign({}, LT.proto, {x:P.x+(d||1), y:P.y, hp:1e9, maxHp:1e9,
        atkV:0, ms:0, dead:false, st:{}, bu:{}, boss:false});
      W.enemies=[e]; P.dirx=1; P.diry=0; P.target=e;
      stepSim(0.02);
      e.x=P.x+(d||1); e.y=P.y; e.hp=1e9; e.st={};
      stepSim(0.02);
      W.fx.length=0;
      return e;
    },
  };
});
const R={};

/* ============ 1. 24本そろっていて、赤の+10より強い ============ */

R.roster = await pg.evaluate(()=>{
  const ids=LEGENDS.map(L=>L.id), nms=LEGENDS.map(L=>L.nm);
  const byBase={};
  LEGENDS.forEach(L=>{ byBase[L.base]=(byBase[L.base]||0)+1; });
  const weaponBases=BASES.filter(x=>x.slot===SLOT.W).map(x=>x.id);
  return {count:ids.length, byBase, weaponBases,
          idsUnique:  new Set(ids).size===ids.length,
          namesUnique:new Set(nms).size===nms.length,
          threePerBase: weaponBases.every(k=>byBase[k]===3),
          coversEveryWeapon: weaponBases.every(k=>!!byBase[k]),
          ok: ids.length===24 && new Set(ids).size===24 && new Set(nms).size===24
              && weaponBases.every(k=>byBase[k]===3)};
});

R.strongerThanRelicPlus10 = await pg.evaluate(()=>{
  const sword=BASES.find(x=>x.id==='sword');
  const relic=buildItem(sword, RARITY[4], LEGEND_ILVL);
  relic.up=10;
  const relicAtk=Math.round(relic.atk*(1+10*UP_ATK_PER));
  /* 比べるのは**1振りで出る合計**。多段（飛燕）や散弾（テミス）は
     1撃あたりを下げてあるので、素の攻撃力だけ見ると弱く見える。
     プレイヤーが受け取るのは「1回振ったときにどれだけ出るか」のほう。 */
  const swingOut=(it)=>{
    const L=legendDef(it);
    const hits=(L && L.hits)||1;
    const shots=(L && L.spread) ? L.spread.length : 1;
    const per=(L && L.shotMul)||1;
    return it.atk * hits * shots * per;
  };
  const weak=LEGENDS.map(L=>{
    const it=makeLegend(L.id);
    const b=BASES.find(x=>x.id===L.base);
    const r=buildItem(b, RARITY[4], LEGEND_ILVL); r.up=10;
    return {id:L.id, legend:Math.round(swingOut(it)),
            relic10:Math.round(r.atk*(1+10*UP_ATK_PER))};
  }).filter(x=>x.legend<=x.relic10);
  const lev=makeLegend('levantine');
  return {sampleLegend:lev.atk, sampleRelic10:relicAtk, weaker:weak,
          everyOneBeatsRelic10: weak.length===0,
          ok: weak.length===0 && lev.atk>relicAtk};
});

// 名前は固有名がそのまま出る。鍛えた段だけが頭に付く。
R.namesShowThemselves = await pg.evaluate(()=>{
  const it=makeLegend('levantine');
  const plain=itemName(it);
  it.up=4;
  const forged=itemName(it);
  const lines=affLines(it).join(' / ');
  return {plain, forged, lines:lines.slice(0,120),
          usesOwnName: /レヴァンテイン/.test(plain),
          noBaseName:  !/剣<|　剣$/.test(plain),
          showsPlus:   /\+4/.test(forged),
          showsEffect: /槍と同じ間合い/.test(lines),
          saysUnbreakable: /壊れない/.test(lines),
          ok: /レヴァンテイン/.test(plain) && /\+4/.test(forged)
              && /槍と同じ間合い/.test(lines) && /壊れない/.test(lines)};
});

/* ============ 2. 落ち方 ============ */

// 40階以降の黄色個体だけ。1%。普通のレア度の抽選には混ざらない。
R.dropsFromGoldElitesOnly = await pg.evaluate(()=>{
  const roll=(n, depth, elite)=>{
    let got=0;
    for(let i=0;i<n;i++) if(elite && depth>=LEGEND_DROP_FROM && rnd()<LEGEND_DROP_RATE) got++;
    return got;
  };
  // 抽選表そのものに乗っていないこと（掘っても出ない）
  let rolled=0;
  for(let i=0;i<40000;i++) if(rollRarity(60, 300).id===LEGEND_RAR) rolled++;
  const deepElite = roll(20000, 45, true);
  const deepTrash = roll(20000, 45, false);
  const shallowElite = roll(20000, 30, true);
  return {rateWanted:LEGEND_DROP_RATE, from:LEGEND_DROP_FROM,
          deepElite, deepTrash, shallowElite, neverRolledNaturally:rolled,
          weightIsZero: RARITY[LEGEND_RAR].w===0,
          notInNormalTable: rolled===0,
          eliteDropsSome:  deepElite>60,
          rateCloseTo1pct: Math.abs(deepElite/20000 - 0.01) < 0.004,
          trashNeverDrops: deepTrash===0,
          shallowNeverDrops: shallowElite===0,
          ok: rolled===0 && RARITY[LEGEND_RAR].w===0 && deepElite>60
              && deepTrash===0 && shallowElite===0};
});

// 同じ物は二度落ちない。24本を取り切ったら、それ以上は出ない。
R.neverDropsADuplicate = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(45); S.hero.party=[];
  S.stash=[]; S.legendStash=[]; S.run.loot=[]; S.grave=null;
  const seen=[];
  for(let i=0;i<200;i++){
    const id=rollNewLegend();
    if(!id) break;
    seen.push(id);
    legendShelf().push(makeLegend(id));
  }
  const after=rollNewLegend();
  return {drawn:seen.length, unique:new Set(seen).size, afterAll:after,
          allDistinct: new Set(seen).size===seen.length,
          drewEveryOne: seen.length===LEGENDS.length,
          stopsWhenComplete: after===null,
          ok: new Set(seen).size===seen.length && seen.length===LEGENDS.length && after===null};
});

/* ============ 3. 壊れない・死んでも失わない ============ */

R.neverBreaks = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(20); S.hero.party=[]; P.invuln=1e9;
  const it=makeLegend('gengmu');
  S.hero.equip.weapon=it;
  for(let i=0;i<500;i++) damageGear('weapon', 1);
  const repairables_ = repairables().some(x=>x===it);
  return {durMax:it.durMax===undefined?'なし':it.durMax,
          hasNoDurability: it.durMax===undefined,
          stillWhole: !isBroken(it),
          notInRepairList: !repairables_,
          ok: it.durMax===undefined && !isBroken(it) && !repairables_};
});

R.survivesDeath = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(45); S.hero.party=[];
  S.stash=[]; S.legendStash=[]; S.grave=null;
  const worn=makeLegend('bloodaxe');       // 装備している1本
  const carried=makeLegend('themis');      // 鞄の中の1本
  const plain=genBaseItem('sword', 40, 1); // 比較用のただの武器（こちらは失う）
  S.hero.equip.weapon=worn;
  S.run.loot=[carried, plain];
  const before={shelf:legendShelf().length};
  S.hero.hpNow=-1; die();
  const shelf=legendShelf().map(x=>x.legend);
  const graveIds=(S.grave&&S.grave.items||[]).map(x=>x.legend||null);
  return {before, shelf, graveIds, heroGone:S.hero===null,
          wornCameBack:    shelf.includes('bloodaxe'),
          carriedCameBack: shelf.includes('themis'),
          noneLeftInGrave: graveIds.every(x=>x===null),
          bothOnShelf: shelf.length===2,
          ok: shelf.includes('bloodaxe') && shelf.includes('themis')
              && graveIds.every(x=>x===null) && S.hero===null};
});

// 専用の棚。倉庫の枠を食わないし、満杯でも持ち替えが詰まらない。
R.ownShelfNotTheStash = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={};
  S.stash=[]; S.legendStash=[];
  while(S.stash.length < stashCap()) S.stash.push(genBaseItem('sword', 10, 1));
  const full=S.stash.length;
  const it=makeLegend('hien');
  legendShelf().push(it);
  const countText=(()=>{ renderStash(); return el('stashcount').textContent; })();
  // 満杯の倉庫でも、棚の1本は着られる
  wearOnHero(it);
  const worn=S.hero.equip.weapon===it;
  const goneFromShelf=!legendShelf().includes(it);
  // 外せば棚へ戻る（倉庫には積まれない）
  S.hero.equip.weapon=null; shelveItem(it);
  return {stashFull:full, cap:stashCap(), countText,
          shelfSize:legendShelf().length, stashSize:S.stash.length,
          notCountedInStash: !countText.includes(String(full+1)),
          wearableWhenStashFull: worn && goneFromShelf,
          returnsToShelf: legendShelf().includes(it) && !S.stash.includes(it),
          ok: worn && goneFromShelf && legendShelf().includes(it) && !S.stash.includes(it)};
});

/* ============ 4. 玉鋼 ============ */

R.forgedOnlyWithTamahagane = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.gold=99999999;
  const leg=makeLegend('gordion');
  const plain=genBaseItem('sword', 40, 1); plain.ident=true;
  S.ore={raw:999, fine:999, deep:999, tama:0};
  const withoutTama=upCheck(leg, false);
  const plainStillFine=upCheck(plain, false).ok;   // 普通の武器は黒鉄のまま鍛えられる
  S.ore.tama=999;
  const withTama=upCheck(leg, false);
  const before=S.ore.tama, ironBefore=S.ore.deep;
  doUpgrade(leg, false);
  return {grade:upGrade(0,leg), plainGrade:upGrade(0,plain),
          why:withoutTama.why||'', spentTama:before-S.ore.tama, ironUntouched:S.ore.deep===ironBefore,
          usesTama: upGrade(0,leg)===LEGEND_ORE,
          plainUsesIron: upGrade(0,plain)==='raw',
          blockedWithoutTama: !withoutTama.ok,
          allowedWithTama: withTama.ok,
          plainUnaffected: plainStillFine,
          forged: leg.up===1,
          paidInTama: (before-S.ore.tama)>0 && S.ore.deep===ironBefore,
          ok: upGrade(0,leg)===LEGEND_ORE && !withoutTama.ok && withTama.ok
              && plainStillFine && leg.up===1 && S.ore.deep===ironBefore};
});

// 玉鋼は最深部の苔玉から。鉱脈からは出ないし、修理代にも溶けない。
R.tamaganeComesFromDeepMoss = await pg.evaluate(()=>{
  const veinGrades=[];
  for(let d=1; d<=60; d+=1) oreGradesAt(d).forEach(o=>{ if(!veinGrades.includes(o.id)) veinGrades.push(o.id); });
  // 修理は黒鉄だけで払う
  S.ore={raw:0, fine:0, deep:0, tama:50};
  const totalForRepair=oreAnyTotal(false);
  const paid=payOreAny(1, false);
  const roll=(n, depth)=>{ let got=0; for(let i=0;i<n;i++) if(depth>=TAMA_FROM && rnd()<TAMA_RATE) got++; return got; };
  const deep=roll(6000, 51), shallow=roll(6000, 40);
  return {veinGrades, from:TAMA_FROM, deep, shallow, totalForRepair,
          notFromVeins: !veinGrades.includes(LEGEND_ORE),
          notSpentOnRepair: totalForRepair===0 && paid===false && S.ore.tama===50,
          dropsAtBottom: deep>400,
          notAboveBottom: shallow===0,
          ok: !veinGrades.includes(LEGEND_ORE) && totalForRepair===0 && S.ore.tama===50
              && deep>400 && shallow===0};
});

/* ============ 5. 固有効果 ============ */

// 5-a. 見た目と間合いの上書き（レヴァンテイン・ロンギヌス・光魔の杖）
R.shapeOverrides = await pg.evaluate(()=>{
  const spear=BASES.find(x=>x.id==='spear'), bow=BASES.find(x=>x.id==='bow');
  const lev=LT.arm('levantine');
  const lon=LT.arm('longinus');
  const kou=LT.arm('koumastaff');
  const yoi=LT.arm('yoichi');
  return {levantine:{range:+lev.range.toFixed(2), dt:lev.dmgType},
          longinus:{range:+lon.range.toFixed(2)},
          kouma:{range:+kou.range.toFixed(2), proj:kou.proj, dt:kou.dmgType},
          yoichi:{range:+yoi.range.toFixed(2)},
          levantineReachesLikeSpear: Math.abs(lev.range-spear.reach)<0.01 && lev.dmgType==='arcane',
          longinusReachesLikeBow:    Math.abs(lon.range-bow.reach)<0.01,
          koumaSwingsLikeSword:      kou.proj===null && Math.abs(kou.range-1.45)<0.01 && kou.dmgType==='arcane',
          yoichiReachesFurther:      yoi.range > bow.reach*1.10,
          ok: Math.abs(lev.range-spear.reach)<0.01 && lev.dmgType==='arcane'
              && Math.abs(lon.range-bow.reach)<0.01
              && kou.proj===null && kou.dmgType==='arcane'
              && yoi.range > bow.reach*1.10};
});

// 5-b. 多段（グラディウス3撃・ジャベリン2撃・飛燕3撃）
R.multiStrike = await pg.evaluate(()=>{
  /* 的を置くときに時間を進めるので、その間に自動攻撃が1回入っている。
     数えたいのは「この1振りが積んだぶん」なので、直前に必ず空にする。 */
  const one=(id)=>{ const st=LT.arm(id); LT.target(1.0);
                    P.queue.length=0; P.atkCd=0; playerAttack();
                    return {want:legendHits(st), queued:P.queue.length}; };
  const g=one('gladius'), j=one('javelin'), h=one('hien');
  const plain=(()=>{ LT.arm('kingsword'); LT.target(1.0);
                     P.queue.length=0; P.atkCd=0; playerAttack();
                     return P.queue.length; })();
  return {gladius:g, javelin:j, hien:h, plainQueued:plain,
          gladiusIsTwo:   g.want===2 && g.queued===1,
          javelinIsTwo:   j.want===2 && j.queued===1,
          hienIsThree:    h.want===3 && h.queued===2,
          plainStaysOne:  plain===0,
          ok: g.want===2 && g.queued===1 && j.want===2 && j.queued===1
              && h.want===3 && h.queued===2 && plain===0};
});

// 5-c. 散弾（テミス3方向・カンバンテイン3方向＋弾ごとの属性）
R.spreadShots = await pg.evaluate(()=>{
  const fire=(id)=>{ LT.arm(id); LT.target(3.0); P.queue.length=0; P.atkCd=0; W.fx.length=0; playerAttack();
                     return W.fx.filter(f=>f.t==='pshot'); };
  const th=fire('themis'), cb=fire('cambantein');
  const plain=fire('yoichi');
  // カンバンテインは弾ごとに属性が違いうる。100回撃って3属性そろうか
  const kinds=new Set();
  for(let i=0;i<100;i++) fire('cambantein').forEach(s=>{ if(s.addElem) kinds.add(s.addElem.type); });
  return {themis:th.length, cambantein:cb.length, plainBow:plain.length,
          elemKinds:[...kinds].sort(),
          themisIsThreeWay: th.length===3,
          cambanteinIsThreeWay: cb.length===3,
          everyBoltCarriesElem: cb.every(s=>!!s.addElem),
          allThreeElems: kinds.size===3,
          plainBowStaysOne: plain.length===1,
          ok: th.length===3 && cb.length===3 && cb.every(s=>!!s.addElem)
              && kinds.size===3 && plain.length===1};
});

// 5-d. 衝撃波（扇・線・円）
R.shockwaves = await pg.evaluate(()=>{
  const cast=(id)=>{ const st=LT.arm(id); LT.target(1.0);
                     const n=legendWave(st, 0);
                     return {hits:n, fx:W.fx.map(f=>f.t)}; };
  const king=cast('kingsword'), gae=cast('gaebolg'),
        gor=cast('gordion'), hyp=cast('hyperion'), moon=cast('moonlight');
  const none=(()=>{ const st=LT.arm('yoichi'); LT.target(1.0);
                    return {hits:legendWave(st,0), fx:W.fx.map(f=>f.t)}; })();
  return {king, gae, gor, hyp, moon, none,
          coneHits:  king.hits>0 && king.fx.includes('lwave'),
          lineHits:  gae.hits>0  && gae.fx.includes('ultbeam'),
          ringHits:  gor.hits>0  && gor.fx.includes('ultring'),
          bowLineHits: hyp.hits>0 && hyp.fx.includes('ultbeam'),
          moonConeHits: moon.hits>0 && moon.fx.includes('lwave'),
          quietWithoutOne: none.hits===0 && none.fx.length===0,
          ok: king.hits>0 && gae.hits>0 && gor.hits>0 && hyp.hits>0 && moon.hits>0
              && none.hits===0};
});

// 5-e. 命中時（血河/ノコギリ鉈の出血・トールハンマーの感電とノックバック）
R.onHitEffects = await pg.evaluate(()=>{
  const rate=(id, sid)=>{ const st=LT.arm(id); const e=LT.target(1.0);
    let n=0;
    for(let i=0;i<300;i++){ e.st={}; e.bu={}; e.hp=1e9; hitEnemy(e,st,1); if(e.st[sid]) n++; }
    return +(n/300).toFixed(2); };
  const river=rate('bloodriver','bleed');
  const saw  =rate('sawnata','bleed');
  const plain=rate('kingsword','bleed');     // ただの剣は出血させない
  const stT=LT.arm('thorhammer'); const e=LT.target(1.0);
  const x0=e.x; e.st={}; e.hp=1e9; hitEnemy(e,stT,1);
  const stR=LT.arm('bloodriver');
  const stB=LT.arm('bloodaxe');
  return {river, saw, plain, thorShock:!!e.st.shock, pushed:+(e.x-x0).toFixed(2),
          thorBonusShock:stT.elem.shock, riverLeech:stR.leech, axeLeech:stB.leech,
          riverBleeds:  river>0.18 && river<0.45,
          sawBleeds:    saw>0.18 && saw<0.45,
          plainDoesNot: plain===0,
          thorShocks:   !!e.st.shock && stT.elem.shock>0,
          thorPushes:   (e.x-x0)>0.2,
          riverDrains:  stR.leech>=10,
          axeDrainsMore:stB.leech>=30,
          ok: river>0.18 && river<0.45 && saw>0.18 && saw<0.45 && plain===0
              && !!e.st.shock && (e.x-x0)>0.2 && stR.leech>=10 && stB.leech>=30};
});

// 5-f. 鉄の貴公子：魔を操る相手にだけ倍、魔法ダメージは半分
R.ironPrince = await pg.evaluate(()=>{
  const st=LT.arm('ironprince');
  const e=LT.target(1.0);
  const sample=(dt)=>{ let tot=0;
    for(let i=0;i<120;i++){ e.dt=dt; e.hp=1e9; e.st={}; e.bu={};
      tot+=hitEnemy(e,st,1).total; }
    return tot/120; };
  const caster=sample('arcane'), normal=sample('blunt');
  const plainSt=LT.arm('savequeen');
  return {caster:Math.round(caster), normal:Math.round(normal),
          ratio:+(caster/normal).toFixed(2),
          resArcane:st.res.arcane, plainResArcane:plainSt.res.arcane,
          doublesVsCasters: (caster/normal) > 1.7,
          cutsMagic: st.res.arcane===50,
          othersUnaffected: plainSt.res.arcane===0,
          ok: (caster/normal)>1.7 && st.res.arcane===50 && plainSt.res.arcane===0};
});

// 5-g. 味方へ配るぶん・自分に効き続けるぶん・周回刃・回避
R.aurasAndUpkeep = await pg.evaluate(()=>{
  LT.arm('savequeen');  const q=partyAura();
  LT.arm('sagestaff');  const s=partyAura();
  LT.arm('kingsword');  const none=partyAura();
  LT.arm('moonlight');  S.hero.hpNow=10; tickLegend(1.0);
  const moonHeal=+(S.hero.hpNow-10).toFixed(2);
  LT.arm('longinus');   S.hero.hpNow=10; tickLegend(1.0);
  const lonHeal=+(S.hero.hpNow-10).toFixed(2);
  LT.arm('kingsword');  S.hero.hpNow=10; tickLegend(1.0);
  const noHeal=+(S.hero.hpNow-10).toFixed(2);
  LT.arm('dagger');     const blades=bladeCount();
  LT.arm('kingsword');  const noBlades=bladeCount();
  const g=LT.arm('gengmu');
  const p=LT.arm('kingsword');
  return {queen:q, sage:s, none, moonHeal, lonHeal, noHeal, blades, noBlades,
          evade:g.evade, plainEvade:p.evade,
          queenGuardsAllies: q.dr===15 && q.atk===0,
          sageDoesBoth:      s.dr===15 && s.atk===15,
          plainGivesNothing: none.dr===0 && none.atk===0,
          moonRegens: moonHeal>0, longinusRegens: lonHeal>0, plainNoRegen: noHeal===0,
          daggerBringsBlades: blades===3, plainNoBlades: noBlades===0,
          gengmuDodges: g.evade > p.evade + 25,
          ok: q.dr===15 && s.dr===15 && s.atk===15 && none.dr===0
              && moonHeal>0 && lonHeal>0 && noHeal===0
              && blades===3 && noBlades===0 && g.evade>p.evade+25};
});

// 5-h. 攻撃力を上げる3本（ゴルディオン・ハイペリオン・光魔の杖）は速度と引き換え
R.slowButHeavy = await pg.evaluate(()=>{
  const base=(id)=>{ const b=BASES.find(x=>x.id===id); return b; };
  const gor=makeLegend('gordion'), hyp=makeLegend('hyperion');
  const plainMace=base('mace'), plainBow=base('bow');
  const stG=LT.arm('gordion'), stP=LT.arm('holyrod');   // 同じ戦鎚どうしで比べる
  return {gordionSpd:gor.spd, maceSpd:plainMace.spd,
          hyperionSpd:hyp.spd, bowSpd:plainBow.spd,
          gordionAspd:+stG.aspd.toFixed(2), plainAspd:+stP.aspd.toFixed(2),
          gordionIsHalfSpeed:  Math.abs(gor.spd - plainMace.spd*0.5) < 0.001,
          hyperionIsHalfSpeed: Math.abs(hyp.spd - plainBow.spd*0.5) < 0.001,
          slowerInPractice:    stG.aspd < stP.aspd,
          ok: Math.abs(gor.spd-plainMace.spd*0.5)<0.001
              && Math.abs(hyp.spd-plainBow.spd*0.5)<0.001
              && stG.aspd < stP.aspd};
});

/* ============ 5-i. 調整で入れた効き目が、書いたとおりに出る ============ */

// レヴァンテインは眷属を1体連れてくる。上限（KIN_MAX）は恩寵と共有。
R.levantineBringsKin = await pg.evaluate(()=>{
  LT.arm('levantine');
  const withSword=kinOf(S.hero).length;
  const st=stats(S.hero);
  LT.arm('kingsword');
  const without=kinOf(S.hero).length;
  const plain=stats(S.hero);
  // 恩寵で上限まで持っていても、武器のぶんで超えない
  LT.arm('levantine');
  for(let i=0;i<KIN_MAX;i++) S.hero.boons.push({id:'kin', rar:'common'});
  const capped=kinOf(S.hero).length;
  return {withSword, without, capped, cap:KIN_MAX,
          aspd:+st.aspd.toFixed(3), plainAspd:+plain.aspd.toFixed(3),
          bringsOne: withSword===without+1,
          plainBringsNone: without===0,
          respectsCap: capped===KIN_MAX,
          alsoFaster: st.aspd > plain.aspd,
          ok: withSword===without+1 && without===0 && capped===KIN_MAX
              && st.aspd > plain.aspd};
});

// 幻夢の +50% が上限に飲まれない（飲まれると書いてある数字が嘘になる）
R.gengmuIsNotCapped = await pg.evaluate(()=>{
  /* 他の枠にも回避の付く装備が入りうる（接頭辞「疾き」）。
     見たいのはこの1本ぶんなので、武器以外は外してから測る。 */
  const bare=()=>{ S.hero.equip.shield=null; S.hero.equip.armor=null;
                   S.hero.equip.accessory=null; };
  LT.arm('gengmu'); bare(); const st=stats(S.hero);
  LT.arm('kingsword'); bare(); const plain=stats(S.hero);
  const dagger=BASES.find(x=>x.id==='dagger');
  return {evade:st.evade, plainEvade:plain.evade, cap:EVADE_CAP,
          base:dagger.evade,
          underTheCap: st.evade < EVADE_CAP,
          fullFifty: st.evade >= dagger.evade + 50 - 0.01,
          capLeavesRoom: EVADE_CAP > dagger.evade + 50,
          ok: st.evade < EVADE_CAP && st.evade >= dagger.evade+50-0.01};
});

// 光魔の杖は全周（360度）を薙ぐ。振り遅くならない。
R.koumaSweepsAllRound = await pg.evaluate(()=>{
  const st=LT.arm('koumastaff');
  const plain=LT.arm('sagestaff');
  // 背中側の相手にも当たる
  LT.arm('koumastaff');
  const e=LT.target(1.0);
  e.x=P.x-1.0; e.y=P.y;                 // 真後ろ
  stepSim(0.02); e.x=P.x-1.0; e.y=P.y; e.hp=1e9;
  const hp0=e.hp;
  meleeSwing(stats(S.hero), 0, 1);      // 正面（+X）へ振る
  const hitBehind = e.hp < hp0;
  return {arc:st.arc, degrees:st.arc*2, proj:st.proj,
          aspd:+st.aspd.toFixed(2), plainAspd:+plain.aspd.toFixed(2),
          fullCircle: st.arc>=180,
          notAProjectile: st.proj===null,
          hitsBehind: hitBehind,
          faster: st.aspd > plain.aspd,
          ok: st.arc>=180 && st.proj===null && hitBehind && st.aspd>plain.aspd};
});

// 3方向に増えたぶん、1本あたりの威力は下がる（合計で釣り合う）
R.spreadSplitsTheDamage = await pg.evaluate(()=>{
  const fire=(id)=>{ LT.arm(id); LT.target(3.0);
    P.queue.length=0; P.atkCd=0; W.fx.length=0; playerAttack();
    return W.fx.filter(f=>f.t==='pshot').map(s=>s.mult); };
  const th=fire('themis'), cb=fire('cambantein'), one=fire('yoichi');
  const sum=a=>a.reduce((x,y)=>x+y,0);
  return {themis:th.map(v=>+v.toFixed(2)), cambantein:cb.map(v=>+v.toFixed(2)),
          plain:one.map(v=>+v.toFixed(2)),
          themisTotal:+sum(th).toFixed(2), plainTotal:+sum(one).toFixed(2),
          eachIsAThird: th.every(v=>Math.abs(v-1/3)<0.02),
          cambanteinToo: cb.every(v=>Math.abs(v-1/3)<0.02),
          totalsMatchOneShot: Math.abs(sum(th)-sum(one))<0.05,
          plainStaysFull: one.every(v=>Math.abs(v-1)<0.02),
          ok: th.every(v=>Math.abs(v-1/3)<0.02) && cb.every(v=>Math.abs(v-1/3)<0.02)
              && Math.abs(sum(th)-sum(one))<0.05};
});

// 多段の3本は1撃あたりを半分にしてある（回数だけ増やさない）
R.multiStrikeCostsPerHit = await pg.evaluate(()=>{
  const pair=(legendId, baseId)=>{
    const it=makeLegend(legendId);
    const b=BASES.find(x=>x.id===baseId);
    const mid=(b.atk[0]+b.atk[1])/2;
    const fullPrice=Math.round(mid*scaleOf(LEGEND_ILVL)*LEGEND_ATK_MUL);
    return {atk:it.atk, ifItWereFull:fullPrice, hits:legendDef(it).hits};
  };
  const g=pair('gladius','dagger'), j=pair('javelin','spear'), h=pair('hien','axe');
  const half=x=>Math.abs(x.atk - x.ifItWereFull*0.5) <= 1;
  return {gladius:g, javelin:j, hien:h,
          gladiusHalved: half(g), javelinHalved: half(j), hienHalved: half(h),
          gladiusIsTwoHits: g.hits===2,
          ok: half(g) && half(j) && half(h) && g.hits===2};
});

/* ============ 6. デバッグの全開放 ============ */

R.debugUnlocksAll = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.stash=[]; S.legendStash=[]; S.ore={};
  S.debug=S.debug||{};
  el('dbg-legend').click();
  const shelf=legendShelf();
  const ids=shelf.map(x=>x.legend).sort();
  const want=LEGENDS.map(L=>L.id).sort();
  // もう一度押しても増えない
  el('dbg-legend').click();
  const again=legendShelf().length;
  return {got:shelf.length, want:want.length, tama:S.ore[LEGEND_ORE]||0, again,
          allThere: ids.join()===want.join(),
          gaveTamagane: (S.ore[LEGEND_ORE]||0)>=99,
          noDuplicatesOnRepeat: again===want.length,
          ok: ids.join()===want.join() && (S.ore[LEGEND_ORE]||0)>=99 && again===want.length};
});

/* ============ 7. 実際に潜って落ちない・落ちる ============ */

R.live = await pg.evaluate(()=>{
  const failures=[];
  S.hero=newHero(); S.upg={hp:8}; S.stash=[]; S.legendStash=[];
  S.ore={tama:99}; S.gold=99999999;
  startRun(45); S.hero.party=[]; P.invuln=1e9;
  // 24本すべてを順に握って、1秒ぶん戦わせる
  LEGENDS.forEach(L=>{
    try{
      S.hero.equip.weapon=makeLegend(L.id);
      P.queue.length=0;
      for(let i=0;i<8;i++){ P.atkCd=0; playerAttack(); stepSim(0.12); }
      const st=stats(S.hero);
      if(!(st.atk>0)) failures.push(L.id+':atk');
      draw(); updateHUD();
    }catch(err){ failures.push(L.id+':'+err.message); }
  });
  return {failures, alive:!!S.hero, screen:S.screen,
          loopAlive: !!S.run,
          noneThrew: failures.length===0,
          ok: failures.length===0 && !!S.hero && !!S.run};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
