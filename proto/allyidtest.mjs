// 仲間の個体差 — 名前・加入時の潜在・二つ名。
//
// 直したかったのは「仲間が消耗品にしか見えない」こと。
// 名前がジョブ名そのもの（「戦士 II」）で、能力も全員同じ作りだったので、
// 誰を連れて行くかの判断が職業の good/bad だけで決まり、
// 失っても惜しくない相手のために引き返す理由が生まれなかった。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 名前 ================= */

// 1-a. ジョブ名ではない固有の名前が付き、十分に散らばる
R.names = await pg.evaluate(()=>{
  TH.run(1,{seed:3});
  const jobNames=new Set(ALL_JOBS.map(j=>j.nm));
  const seen=[], dup=[];
  for(let i=0;i<400;i++) seen.push(makeAlly(10,S.hero).name);
  const uniq=new Set(seen);
  const isJobName=seen.filter(n=>jobNames.has(n));
  const hasRoman=seen.filter(n=>/ (II|III|IV)$/.test(n));
  return {samples:seen.length, distinct:uniq.size,
          example:seen.slice(0,8),
          combos: NAME_A.length*NAME_B.length*NAME_C.length,
          noJobNames: isJobName.length===0,
          noRomanNumerals: hasRoman.length===0,
          varied: uniq.size > 150,
          ok: isJobName.length===0 && hasRoman.length===0 && uniq.size>150};
});

// 1-b. パーティ内で名前がぶつからない（ぶつかったら引き直す）
R.nameUnique = await pg.evaluate(()=>{
  TH.run(1,{seed:5});
  let collided=0;
  for(let t=0;t<200;t++){
    const party=[];
    for(let i=0;i<PARTY_MAX;i++){
      const a=makeAlly(10,S.hero);
      a.name='リエラ';                       // わざと全員同じ名前にする
      uniqueAllyName(a, party);
      party.push(a);
    }
    if(new Set(party.map(x=>x.name)).size!==PARTY_MAX) collided++;
  }
  return {trials:200, collided, alwaysDistinct: collided===0, ok: collided===0};
});

/* ================= 2. 加入時の潜在 ================= */

// 2-a. 主人公のレベルで、数もレア度も伸びる
R.boonScaling = await pg.evaluate(()=>{
  TH.run(1,{seed:7});
  const trial=(lv)=>{
    S.hero.lv=lv;
    let n=0, rarSum=0, withAny=0, epics=0;
    const runs=500;
    for(let i=0;i<runs;i++){
      const bs=rollAllyBoons(lv);
      n+=bs.length;
      if(bs.length) withAny++;
      bs.forEach(x=>{ rarSum+=BOON_RAR_I[x.rar]; if(x.rar==='epic') epics++; });
    }
    return {lv, avgCount:+(n/runs).toFixed(2),
            avgRar:+(rarSum/Math.max(1,n)).toFixed(2),
            withAnyPct:Math.round(withAny/runs*100), epics};
  };
  const rows=[1,5,10,20,30,45].map(trial);
  const countRises=rows.every((r,i)=>i===0||r.avgCount>=rows[i-1].avgCount);
  const rarRises=rows.slice(2).every((r,i,arr)=>i===0||r.avgRar>=arr[i-1].avgRar);
  return {rows, countRises, rarRises,
          // 序盤の主人公のところには潜在持ちは来ない
          noneEarly: rows[0].avgCount===0 && rows[1].avgCount===0,
          // 高レベルでも全員が持っているわけではない（特別が特別でなくなる）
          notEveryone: rows[5].withAnyPct < 96,
          deepGetsEpics: rows[5].epics>0 && rows[2].epics<rows[5].epics,
          ok: countRises && rarRises && rows[0].avgCount===0
              && rows[5].withAnyPct<96 && rows[5].epics>0};
});

// 2-b. 加入した仲間の潜在が実際にステータスへ乗る
R.boonsApply = await pg.evaluate(()=>{
  TH.run(1,{seed:11}); TH.floor(16);
  S.hero.lv=40;
  let a=null;
  for(let i=0;i<200 && !a;i++){
    const c=makeAlly(16,S.hero);
    if(c.boons.some(b=>b.id==='atk')) a=c;
  }
  if(!a) return {skipped:true, ok:false};
  const withBoon=+allyStats(a).atk.toFixed(2);
  const kept=a.boons.slice();
  a.boons=[];
  const without=+allyStats(a).atk.toFixed(2);
  a.boons=kept;
  return {boons:kept.map(b=>b.id+'/'+b.rar), withBoon, without,
          stronger: withBoon>without, ok: withBoon>without};
});

/* ================= 3. 二つ名 ================= */

// 3-a. 中身から計算される。中身が無ければ二つ名も付かない。
R.epithet = await pg.evaluate(()=>{
  TH.run(1,{seed:13});
  const mk=(boons)=>{
    const a=makeAlly(10,S.hero);
    a.job='mage'; a.boons=boons;
    a.equip={weapon:null, shield:null, armor:null, accessory:null};
    return {renown:allyRenown(a), ep:allyEpithet(a), full:allyFullName(a), name:a.name};
  };
  const bare  = mk([]);
  const one   = mk([{id:'atk',rar:'uncommon'}]);
  const some  = mk([{id:'atk',rar:'rare'},{id:'hp',rar:'uncommon'}]);
  const rich  = mk([{id:'atk',rar:'epic'},{id:'hp',rar:'epic'},{id:'ms',rar:'rare'}]);
  return {bare, one, some, rich,
          ranks:ALLY_RANK.map(r=>r.nm||'（無名）'),
          bareHasNone: bare.ep==='' && bare.full===bare.name,
          rises: allyRenown({boons:[{id:'a',rar:'epic'}],equip:{}})
               > allyRenown({boons:[{id:'a',rar:'common'}],equip:{}}),
          // エピック1個 > コモン3個（レア度の二乗で効かせている）
          epicBeatsThreeCommons:
            allyRenown({boons:[{id:'a',rar:'epic'}],equip:{}})
            > allyRenown({boons:[{id:'a',rar:'common'},{id:'b',rar:'common'},{id:'c',rar:'common'}],equip:{}}),
          climbs: bare.ep==='' && one.ep!=='' && rich.ep.includes('伝説'),
          usesJobNoun: rich.ep.includes('魔術師'),
          ok: bare.ep==='' && one.ep!=='' && rich.ep.includes('伝説')
              && rich.ep.includes('魔術師')};
});

// 3-b. 装備も二つ名に効く（潜在だけではない）
R.epithetGear = await pg.evaluate(()=>{
  TH.run(1,{seed:17});
  const a=makeAlly(10,S.hero);
  a.boons=[];
  a.equip={weapon:null, shield:null, armor:null, accessory:null};
  const bare=allyRenown(a);
  a.equip.weapon={rar:4}; a.equip.armor={rar:4};
  const geared=allyRenown(a);
  return {bare, geared, ep:allyEpithet(a),
          gearCounts: geared>bare, ok: geared>bare};
});

// 3-c. 育てば二つ名が上がる（固定ではなく、そのつど計算している）
R.epithetGrows = await pg.evaluate(()=>{
  TH.run(1,{seed:19});
  const a=makeAlly(10,S.hero);
  a.job='knight'; a.boons=[];
  a.equip={weapon:null, shield:null, armor:null, accessory:null};
  const before=allyEpithet(a);
  a.boons=[{id:'hp',rar:'epic'},{id:'atk',rar:'epic'},{id:'dr',rar:'rare'}];
  const after=allyEpithet(a);
  return {before, after,
          wasPlain: before==='',
          nowNamed: after!=='',
          ok: before==='' && after!==''};
});

/* ================= 4. 加入前に見える ================= */
/* 加入してから分かるのでは、誰を連れて行くかの判断材料にならない。 */
R.shownBeforeJoin = await pg.evaluate(()=>{
  TH.run(1,{seed:23}); TH.floor(20);
  S.hero.lv=45;
  let a=null;
  for(let i=0;i<300 && !a;i++){
    const c=makeAlly(20,S.hero);
    if(c.boons.length>=2 && allyEpithet(c)) a=c;
  }
  if(!a) return {skipped:true, ok:false};
  W.npc=a;
  openAllyInspect();
  const nameTxt=el('ally-name').textContent;
  const subTxt=el('ally-sub').textContent.replace(/\s+/g,' ');
  const open=TH.open('m-ally');
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  return {open, nameTxt, subTxt, ep:allyEpithet(a),
          boons:a.boons.map(b=>boonDef(b.id).nm),
          showsName: nameTxt===a.name,
          showsEpithet: subTxt.includes(allyEpithet(a)),
          showsBoons: a.boons.every(b=>subTxt.includes(boonDef(b.id).nm)),
          showsRarity: a.boons.every(b=>subTxt.includes(boonRarDef(b.rar).nm)),
          ok: open && nameTxt===a.name && subTxt.includes(allyEpithet(a))
              && a.boons.every(b=>subTxt.includes(boonDef(b.id).nm))};
});

// 4-b. 一覧や慰霊碑にも二つ名つきで出る
R.listsShowEpithet = await pg.evaluate(()=>{
  TH.run(1,{seed:29}); TH.floor(20);
  const a=makeAlly(20,S.hero);
  a.job='mage';
  a.boons=[{id:'atk',rar:'epic'},{id:'hp',rar:'epic'},{id:'ms',rar:'epic'}];
  a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  const ep=allyEpithet(a);

  setScreen('char');           // 仲間の一覧はステータス画面へ移した
  const inCharScreen=el('town-party').textContent.includes(ep);
  openAllyEquip(a,'char');
  const inEquip=el('ae-epithet').textContent===ep;
  closeAllyEquip();

  S.fallen=[{uidA:a.uidA, job:a.job, name:a.name, lv:a.lv,
             str:a.str,dex:a.dex,vit:a.vit,int:a.int,
             boons:a.boons.slice(), revived:false, depth:20, t:Date.now()}];
  setScreen('mem');
  const inMem=el('memlist').textContent.includes(ep);
  setScreen('town');
  return {ep, inCharScreen, inEquip, inMem,
          ok: !!ep && inCharScreen && inEquip && inMem};
});

/* ================= 5. 実プレイで例外なく回る ================= */
R.live = await pg.evaluate(()=>{
  const fails=[];
  try{
    TH.run(1,{seed:31}); TH.floor(22);
    TH.immortal();
    S.hero.lv=40;
    for(let i=0;i<PARTY_MAX;i++){
      const a=makeAlly(22,S.hero); a.x=P.x; a.y=P.y; a.slot=i;
      uniqueAllyName(a,party()); S.hero.party.push(a);
      a.hpNow=allyStats(a).maxHp;
    }
    W.enemies.slice(0,5).forEach((e,i)=>{ e.x=P.x+Math.cos(i)*2.6; e.y=P.y+Math.sin(i)*2.6; });
    stepSim(6, {draw:true, each:(t)=>{ stickDx=Math.cos(t*0.8); stickDy=Math.sin(t*1.0); }});
    stickDx=0; stickDy=0;
    updateHUD();
    const roster=livingParty().map(a=>allyFullName(a));
    return {failures:fails, roster, alive:!!S.hero,
            distinct: new Set(livingParty().map(a=>a.name)).size===livingParty().length,
            loopAlive:_tickCount>200,
            ok: !!S.hero && _tickCount>200
                && new Set(livingParty().map(a=>a.name)).size===livingParty().length};
  }catch(e){ fails.push(e.message); return {failures:fails, ok:false}; }
});

/* ================= 6. 鍛冶場で仲間の武器を鍛える／直す ================= */
R.forgeAlly = await pg.evaluate(()=>{
  TH.run(1,{seed:37}); TH.floor(20);
  /* 主人公のレベルを仲間に合わせておく。
     仲間の数字は softCap で主人公基準に抑えられるので、
     Lv.1 の主人公のままだと上限に張り付いて、鍛えても atk が動かない
     （仕様どおりの挙動だが、鍛造が効いたかどうかはここでは見えない）。 */
  S.hero.lv=24; S.hero.str=30; S.hero.dex=30; S.hero.vit=30;
  S.hero.equip.weapon=genBaseItem('sword',24,2); S.hero.equip.weapon.ident=true;
  const a=makeAlly(20,S.hero); a.job='knight';
  a.equip.weapon=genBaseItem('great',20,2); a.equip.weapon.ident=true;
  a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  S.run.ore={raw:99, fine:99, deep:99}; S.run.gold=99999;

  W.forge={x:P.x, y:P.y, seed:0};
  interact();
  const opened=TH.open('m-forge');
  const rowShown=el('fg-who').style.display==='flex';
  const listsAlly=el('fg-who').textContent.includes(a.name);
  // 既定は自分
  const startsWithHero = forgeHolder()===S.hero;

  // 仲間に切り替える
  el('fg-who').querySelector(`[data-fgwho="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const nowAlly = forgeHolder()===a && forgeTarget()===a.equip.weapon;

  // 強化
  const up0=a.equip.weapon.up||0;
  const atk0=+allyStats(a).atk.toFixed(2);
  el('fg-do').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const up1=a.equip.weapon.up||0;
  const atk1=+allyStats(a).atk.toFixed(2);

  // 修理
  a.equip.weapon.dur=1;
  renderForge();
  const fixLabel=el('fg-fix').textContent;
  el('fg-fix').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const fixed=a.equip.weapon.dur===a.equip.weapon.durMax;

  // 自分の武器は触られていない
  const heroWeaponUp=(S.hero.equip.weapon&&S.hero.equip.weapon.up)||0;
  closeForge();
  return {opened, rowShown, listsAlly, startsWithHero, nowAlly,
          up0, up1, atk0, atk1, fixLabel, fixed, heroWeaponUp,
          upgraded: up1===up0+1,
          strongerAfter: atk1>atk0,
          heroUntouched: heroWeaponUp===0,
          ok: opened && rowShown && listsAlly && startsWithHero && nowAlly
              && up1===up0+1 && atk1>atk0 && fixed && heroWeaponUp===0};
});

// 6-b. 倒れた仲間は選べない／開き直すと自分に戻る
R.forgeAllyGuards = await pg.evaluate(()=>{
  TH.run(1,{seed:41}); TH.floor(20);
  const a=makeAlly(20,S.hero); a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  openForge(false);
  el('fg-who').querySelector(`[data-fgwho="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const onAlly=forgeHolder()===a;
  closeForge();
  openForge(false);
  const backToHero=forgeHolder()===S.hero;      // 開き直したら自分
  // 倒れた仲間は一覧から消え、選んでいても自分へ落ちる
  el('fg-who').querySelector(`[data-fgwho="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  a.dead=true;
  renderForge();
  const droppedDead=forgeHolder()===S.hero && !el('fg-who').textContent.includes(a.name);
  closeForge();
  return {onAlly, backToHero, droppedDead,
          ok: onAlly && backToHero && droppedDead};
});

/* ================= 7. 仲間が装飾品を装備できる ================= */
R.allyAccessory = await pg.evaluate(()=>{
  TH.run(1,{seed:43}); TH.floor(18);
  const a=makeAlly(18,S.hero); a.hpNow=allyStats(a).maxHp;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  // 装飾品を1つ作る
  let ring=null;
  for(let i=0;i<200 && !ring;i++){
    const it=genItem(18, 0);
    if(it.slot===SLOT.C && !isConsum(it)) ring=it;
  }
  if(!ring) return {skipped:true, ok:false};
  ring.ident=true;
  const can=allyCanEquip(a, ring);
  const before=+allyStats(a).atk.toFixed(2);
  a.equip.accessory=ring;
  const after=+allyStats(a).atk.toFixed(2);
  const hpAfter=allyStats(a).maxHp;

  // 階を降りると擦り減る（主人公だけの規則にしない）
  const dur0=ring.dur;
  TH.floor(19);
  const worn=ring.dur<dur0;
  return {ring:ring.nm, can, before, after, hpAfter, dur0, dur:ring.dur, worn,
          equippable: can,
          // 効果が数字に出る（攻撃力か最大HPのどちらかは必ず動く装飾品を選んでいる訳ではないので緩め）
          ok: can && worn};
});

/* ================= 8. 道中の商人 ================= */

// 8-a. 出る／出ない、置き場所、値段
R.merchant = await pg.evaluate(()=>{
  S.hero=newHero();
  let floors=0, found=0, tooClose=0, atBoss=0, tooShallow=0, onStairs=0;
  for(let seed=0; seed<60; seed++){
    for(const depth of [2,3,10,14,20,26,33]){
      TH.run(1,{seed:seed*7+depth}); TH.floor(depth);
      floors++;
      if(!W.shop) continue;
      found++;
      if(bossTierAt(depth)) atBoss++;
      if(depth<MERCHANT_MIN_DEPTH) tooShallow++;
      if(Math.hypot(W.fl.stair.x-W.shop.x, W.fl.stair.y-W.shop.y) < STAIR_CLEAR) onStairs++;
      const near=[W.forge, ...(W.ores||[])].filter(Boolean)
        .filter(o=>Math.hypot(o.x-W.shop.x,o.y-W.shop.y) < MERCHANT_CLEAR);
      tooClose+=near.length;
    }
  }
  return {floors, found, tooClose, atBoss, tooShallow, onStairs,
          rate:Math.round(found/floors*100),
          appears: found>0,
          notEveryFloor: found<floors,
          skipsBoss: atBoss===0,
          skipsShallow: tooShallow===0,
          clearOfStairs: onStairs===0,
          clearOfForgeAndOres: tooClose===0,
          ok: found>0 && found<floors && atBoss===0 && tooShallow===0
              && onStairs===0 && tooClose===0};
});

// 8-b. 拠点より割高で、払うのは「今回の金」
R.merchantPricing = await pg.evaluate(()=>{
  TH.run(1,{seed:53}); TH.floor(18);
  const it=genItem(18,0); it.ident=true;
  const town = Math.round(itemValue(it)*2.0);       // 拠点の値付け
  const road = merchantPrice(it);
  return {town, road, markup:+(road/town).toFixed(2), want:MERCHANT_MARKUP,
          dearer: road>town,
          matchesMarkup: Math.abs(road/town - MERCHANT_MARKUP) < 0.02,
          ok: road>town && Math.abs(road/town-MERCHANT_MARKUP)<0.02};
});

// 8-c. 実際に買える。口座の金は減らず、買った物は持ち物へ。
R.merchantBuy = await pg.evaluate(()=>{
  TH.run(1,{seed:59}); TH.floor(18);
  W.shop = spawnMerchant(W.fl, 18, []) ||
           {x:P.x, y:P.y, seed:0, stock:[(()=>{ const i=genItem(18,0); i.ident=true;
              i.price=merchantPrice(i); return i; })()]};
  W.shop.x=P.x; W.shop.y=P.y;
  S.gold=5000; S.run.gold=0;
  const it=W.shop.stock[0];

  // 金が足りなければ買えない（口座の金では買えない）
  const poor=buyFromMerchant(it.uid);
  const acctUntouched = S.gold===5000;

  // 値段は買う前に控える。買えたら it.price は消える（持ち物の装備に値札は要らない）
  const price=it.price;
  S.run.gold=price+50;
  const stock0=W.shop.stock.length, loot0=S.run.loot.length;
  const r=buyFromMerchant(it.uid);
  const paid=(price+50)-S.run.gold;

  // 画面を開いてタップでも買える
  /* 品揃えは階ごとに変わるので、2品目が無いこともある。
     ここで見たいのは「タップでも買えるか」なので、無ければ1つ足す。 */
  if(!W.shop.stock.length){
    const extra=genItem(18,0); extra.ident=true; extra.price=merchantPrice(extra);
    W.shop.stock.push(extra);
  }
  const it2=W.shop.stock[0];
  let tapped=false;
  if(it2){
    S.run.gold=it2.price;
    /* 足元に他の調べ物があると interact() はそちらを先に開く（順番どおり）。
       ここで見たいのは「商人に届くか」なので、競合を外してから呼ぶ。 */
    W.ev=null; W.npc=null; W.trial=null;
    interact();                         // 商人が足元にいる
    tapped=TH.open('m-mshop');
    el('ms-list').querySelector('[data-mbuy]')
      .dispatchEvent(new MouseEvent('click',{bubbles:true}));
    closeMerchant();
  }
  const soldOutMsg = (()=>{ W.shop.stock=[]; renderMerchant();
    return el('ms-list').textContent.includes('売り切れ'); })();
  return {poorRefused:!poor.ok, why:poor.why, acctUntouched,
          bought:r.ok, paid, price,
          stockShrank: W.shop.stock.length<stock0 || stock0===1,
          intoLoot: S.run.loot.length>loot0,
          acctStillFull: S.gold===5000,
          tapped, soldOutMsg,
          priceTagRemoved: it.price===undefined,
          ok: !poor.ok && S.gold===5000 && r.ok && paid===price
              && S.run.loot.length>loot0 && tapped && soldOutMsg};
});

// 8-d. 買い取りはしない（拾った物をその場で金に換えられない）
R.merchantNoSell = await pg.evaluate(()=>{
  const fns=Object.keys(window).filter(k=>/sellToMerchant|merchantSell/i.test(k));
  return {sellFns:fns, noSellPath: fns.length===0, ok: fns.length===0};
});

/* 表示名に職業が入ること。
   名前だけだと「僧侶を後ろに置きたい」「盗賊をそばに置きたい」といった
   判断が、名前を覚えるまで一切できない。 */
R.jobShown = await pg.evaluate(()=>{
  TH.run(1,{seed:4}); TH.floor(3);
  const a=TH.ally(3,'priest',20); a.slot=0; uniqueAllyName(a,party()); S.hero.party=[a];
  const j=jobDef('priest').nm;
  const lbl=allyLabel(a);
  updateHUD();
  const bar=el('partybar').innerHTML;
  return {label:lbl, job:j,
          inLabel: lbl.includes(a.name) && lbl.includes(j),
          inPartybar: bar.includes(j) && bar.includes(a.name),
          ok: lbl.includes(a.name) && lbl.includes(j) && bar.includes(j)};
});

// ステータス画面・持ち物のパーティ一覧にも出る（同じ情報が画面ごとに欠けない）
R.jobEverywhere = await pg.evaluate(()=>{
  const a=party()[0], j=jobDef(a.job).nm;
  S.run=null; setScreen('char');
  const charScreen=el('town-party').innerHTML;
  TH.run(1,{seed:4}); S.hero.party=[a];
  openBag();
  const bag=el('bag-party').innerHTML;
  return {charScreen: charScreen.includes(j), bag: bag.includes(j),
          ok: charScreen.includes(j) && bag.includes(j)};
});

await done(b, errs, R);
