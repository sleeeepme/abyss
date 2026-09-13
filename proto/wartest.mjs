// 武器技（閃き・セット・発動）。
//
// 見たいのは3つ。
//   1) 24 の技が**全部ちゃんと出る**こと（データ表と発動経路が噛み合っている）
//   2) 閃きが lv1→lv2→lv3 の順にしか進まず、武器種ごとに別々に積まれること
//   3) ボタンに乗る技の決まり方（セットしたもの／未セットなら最上段）
//
// **敵の座標を手で動かしたら、必ず1フレーム進めてから測ること。**
// nearEnemies は空間グリッド越しに探す。グリッドは「tick が進む」か
// 「敵の数が変わる」かでしか組み直されないので、進めないと前の配置を見に行く。
// これで最初に測ったときは、範囲技が軒並みダメージ 0 に見えた（実装ではなく測り方の問題）。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* 目の前に的を1体だけ置く。倒れない・動かない・殴り返さない。 */
await pg.evaluate(()=>{
  window.TH.dummy = (base, depth)=>{
    TH.run(1,{seed:77}); TH.floor(depth||3);
    if(base){
      S.hero.equip.weapon = buildItem(BASES.find(x=>x.id===base), RARITY[0], 5);
      S.hero.equip.weapon.aff=[];            // 接辞の当たり外れを測定に混ぜない
    }
    S.hero.crit=0;                            // 会心のばらつきも止める
    TH.immortal();
    const e=W.enemies[0];
    W.enemies.forEach(x=>{ x.dead=true; });
    e.dead=false; e.hp=e.maxHp=9999999; e.x=P.x+1.2; e.y=P.y;
    e.boss=false; e.ms=0; e.atkV=0;
    W.enemies=[e];
    P.dirx=1; P.diry=0;
    // グリッドを組み直させる（上の注意書きの通り）
    P.atkCd=999; stepSim(1/60);
    e.x=P.x+1.2; e.y=P.y; P.atkCd=999; stepSim(1/60); P.atkCd=999;
    return e;
  };
  /* 技を1つ出して、与えた総ダメージを ATK 何倍ぶんかで返す。
     継続・多段・遅延があるので、出した直後と5秒後の多いほうを採る。 */
  window.TH.artDmg = (base, def)=>{
    const e=TH.dummy(base), h0=e.hp, atk=stats(S.hero).atk;
    fireArt(def, S.hero);
    let d=h0-e.hp;
    for(let i=0;i<300;i++){ P.atkCd=999; TH.immortal(); stepSim(1/60); }
    return +(Math.max(d, h0-e.hp)/atk).toFixed(2);
  };
});

/* ================= 1. データ表 ================= */

// 1-a. 8武器種 × 3段。id は全体で重複しない
R.table = await pg.evaluate(()=>{
  const ids=ART_BASES.flatMap(k=>WEAPON_ARTS[k].map(a=>a.id));
  const bad=[];
  ART_BASES.forEach(k=>WEAPON_ARTS[k].forEach(a=>{
    if(!a.id||!a.nm||!a.icon||!a.col||!a.k||!a.desc) bad.push(a.id||k);
  }));
  return {bases:ART_BASES.length, per:ART_BASES.map(k=>WEAPON_ARTS[k].length),
          total:ids.length, bad,
          // 武器種はぜんぶ「武器スロットのベース」と一致している
          allWeapons: ART_BASES.every(id=>{
            const b=BASES.find(x=>x.id===id); return b && b.slot===SLOT.W; }),
          eightBases: ART_BASES.length===8,
          threeEach: ART_BASES.every(k=>WEAPON_ARTS[k].length===3),
          uniqueIds: ids.length===new Set(ids).size,
          complete: bad.length===0};
});

// 1-b. リキャストは段が上がるほど長い。**一番長い lv3 でも、一番短い大技より短い**
R.cooldown = await pg.evaluate(()=>{
  const rows=ART_BASES.map(k=>WEAPON_ARTS[k].map(a=>artCooldown(a,false)));
  const minUlt=Math.min(...ULTS.map(u=>u.cd));
  return {row:rows[0], minUlt, maxArt:Math.max(...rows.flat()),
          risesWithTier: rows.every(r=>r[0]<r[1] && r[1]<r[2]),
          sameEverywhere: rows.every(r=>r.join()===rows[0].join()),
          // 仲間は自動発動なので、手で切るより待ちが長い
          allySlower: ART_BASES.every(k=>WEAPON_ARTS[k].every(a=>
            artCooldown(a,true) > artCooldown(a,false))),
          underUlt: Math.max(...rows.flat()) < minUlt};
});

/* ================= 2. 24 の技が全部出る ================= */

/* 2-a. 全部が例外なく出て、**攻撃技はちゃんと減らす**。
       ミラージュ（無敵）とホーリーシールド（盾）はダメージを持たない技なので別扱い。 */
R.fireAll = await pg.evaluate(()=>{
  const NO_DMG=['dgmirage','mcshield'];      // 支える側の2つ
  const dmg={}, threw=[], zero=[];
  ART_BASES.forEach(base=>{
    WEAPON_ARTS[base].forEach(def=>{
      try{
        const v=TH.artDmg(base, def);
        dmg[def.id]=v;
        if(v<=0 && !NO_DMG.includes(def.id)) zero.push(def.id);
      }catch(err){ threw.push(def.id+': '+err.message); }
    });
  });
  return {dmg, threw, zero,
          noneThrew: threw.length===0,
          allDeal: zero.length===0,
          // 支える2つは狙い通りダメージを持たない
          supportNoDmg: NO_DMG.every(id=>dmg[id]===0)};
});

// 2-b. 支える2つは、ダメージの代わりに狙いの効果が乗る
R.support = await pg.evaluate(()=>{
  const mirage=WEAPON_ARTS.dagger[2], shield=WEAPON_ARTS.mace[2];
  TH.dummy('dagger'); P.invuln=0;
  fireArt(mirage, S.hero);
  const inv=P.invuln;
  TH.dummy('mace'); S.hero.barrier=0;
  fireArt(shield, S.hero);
  return {invuln:+inv.toFixed(2), barrier:S.hero.barrier,
          mirageGuards: inv >= mirage.t-0.01,
          shieldGuards: S.hero.barrier>=1};
});

/* 2-c. ノックバック付きの技は、実際に押し返している。
       「ノックバック付き」と書いてあるのに動かない、を捕まえる。 */
R.knock = await pg.evaluate(()=>{
  const def=WEAPON_ARTS.great[2];            // レイジングアッパー（強ノックバック）
  const e=TH.dummy('great'), d0=Math.hypot(e.x-P.x, e.y-P.y);
  fireArt(def, S.hero);
  const d1=Math.hypot(e.x-P.x, e.y-P.y);
  return {before:+d0.toFixed(2), after:+d1.toFixed(2), pushed: d1 > d0+0.5};
});

/* ================= 3. 閃き ================= */

/* 3-a. 段は**飛ばせない**。lv1 を覚える前に lv2 は閃かない。
       確率を 1 に上げて、順番だけを見る。 */
R.order = await pg.evaluate(()=>{
  S.arts={};
  const P0=ART_FLASH_P.slice();
  ART_FLASH_P[0]=ART_FLASH_P[1]=ART_FLASH_P[2]=1;   // 必ず閃く
  const seq=[];
  for(let i=0;i<4;i++){ const d=tryFlashArt('sword'); seq.push(d?d.id:null); }
  const got=artsLearnedN('sword');
  ART_FLASH_P[0]=P0[0]; ART_FLASH_P[1]=P0[1]; ART_FLASH_P[2]=P0[2];
  return {seq, got,
          inOrder: seq[0]==='iai' && seq[1]==='swspin' && seq[2]==='swmulti',
          stopsAtThree: seq[3]===null && got===3};
});

// 3-b. 武器種ごとに別々に積まれる（剣を極めても杖は 0 のまま）
R.perWeapon = await pg.evaluate(()=>{
  S.arts={};
  const P0=ART_FLASH_P.slice();
  ART_FLASH_P[0]=1;
  tryFlashArt('sword'); tryFlashArt('sword');   // 剣だけ振る（2回目はlv2の確率なので乗らない）
  const sword=artsLearnedN('sword'), staff=artsLearnedN('staff');
  ART_FLASH_P[0]=P0[0];
  return {sword, staff, separate: sword>=1 && staff===0};
});

/* 3-c. 熟練が上がるほど閃きやすい（「少しずつ覚えやすくなる」）。
       素手には技が無いので、素手で閃こうとしても何も起きない。 */
R.chance = await pg.evaluate(()=>{
  S.mastery={};
  const at0=artFlashChance('sword',1,false);
  S.mastery={sword:{lv:MASTERY_MAX, xp:0}};
  const atMax=artFlashChance('sword',1,false);
  const ally0=artFlashChance('sword',1,true);
  S.mastery={};
  // 段が上がるほど遠い
  const tiers=[1,2,3].map(t=>artFlashChance('sword',t,false));
  S.arts={};
  const bare=tryFlashArt(null);
  return {at0:+at0.toFixed(5), atMax:+atMax.toFixed(5),
          tiers:tiers.map(v=>+v.toFixed(5)),
          masteryHelps: atMax > at0,
          masteryAmount:+(atMax/at0).toFixed(2),
          higherTierRarer: tiers[0]>tiers[1] && tiers[1]>tiers[2],
          // 仲間はロストするぶん覚えやすい
          allyEasier: ally0 > at0,
          bareHandsNothing: bare===null};
});

/* 3-d. 仲間は仲間自身が持つ（アカウント側には積まれない＝失えば消える）。
       主人公はアカウント単位なので、逆に死んでも残る。 */
R.allyOwn = await pg.evaluate(()=>{
  S.arts={};
  TH.run(1,{seed:5});
  const a=TH.ally(10,'guard');
  a.equip.weapon = buildItem(BASES.find(x=>x.id==='mace'), RARITY[0], 5);
  const P0=ART_FLASH_P.slice();
  ART_FLASH_P[0]=1;
  tryFlashArtAlly(a, 'mace');
  ART_FLASH_P[0]=P0[0];
  return {allyHas:allyArtsN(a,'mace'), accountHas:artsLearnedN('mace'),
          onAlly: allyArtsN(a,'mace')===1,
          notOnAccount: artsLearnedN('mace')===0};
});

/* ================= 4. ボタンに乗る技 ================= */

/* 4-a. 未セットなら**覚えている中の最上段**。セットすればそれが出る。
       武器種ごとに選択を覚えているので、持ち替えて戻れば選び直さなくていい。 */
R.pick = await pg.evaluate(()=>{
  S.arts={sword:3, staff:2}; S.artPick={};
  TH.run(1,{seed:5});
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  const top=playerArt().id;                       // 未セット → 最上段
  S.artPick.sword='iai';
  const set=playerArt().id;                       // セットしたもの
  // 杖に持ち替える → 杖の選択（未設定なので杖の最上段）
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='staff'), RARITY[0], 5);
  const staff=playerArt().id;
  // 剣に戻す → さっきの選択が残っている
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  const back=playerArt().id;
  // 素手にすると技そのものが無い
  S.hero.equip.weapon=null;
  const bare=playerArt();
  return {top, set, staff, back, bare,
          topIsHighest: top==='swmulti',
          setWins: set==='iai',
          perWeapon: staff==='sticicle',          // 杖は2段目まで＝アイシクルエッジ
          remembers: back==='iai',
          bareNone: bare===null};
});

/* 4-b. **持ち替えても待ち時間は戻らない。** 戻る作りだと、
       3つの技を着け替えるだけで連射になる（リキャストの意味が消える）。 */
R.cdStays = await pg.evaluate(()=>{
  S.arts={sword:3}; S.artPick={};
  TH.run(1,{seed:5}); TH.floor(3);
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  P.artCd=0;
  const fired=firePlayerArt();
  const afterFire=P.artCd;
  S.artPick.sword='iai';                          // 別の技に着け替える
  const afterSwap=P.artCd;
  const ready=artReady();
  return {fired, afterFire:+afterFire.toFixed(1), afterSwap:+afterSwap.toFixed(1),
          wentOnCd: afterFire>0,
          swapKeepsCd: afterSwap===afterFire,
          stillBlocked: ready===false};
});

/* 4-c. 覚えていない武器種ではボタンそのものが出ない（押せない物を置かない）。 */
R.noArtNoButton = await pg.evaluate(()=>{
  S.arts={}; S.artPick={};
  TH.run(1,{seed:5});
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='axe'), RARITY[0], 5);
  const none=playerArt();
  S.arts={axe:1};
  const some=playerArt();
  return {none, someId:some&&some.id,
          hiddenWhenUnlearned: none===null,
          shownOnceLearned: !!some && some.id==='axtoma'};
});

/* ================= 5. 仲間の武器技 ================= */

/* 5-a. 仲間は選ばない＝覚えている中の最上段が出る。
       ボタンを持たないので、リキャストで勝手に出る。 */
R.allyFires = await pg.evaluate(async ()=>{
  TH.run(1,{seed:9}); TH.floor(3);
  const a=TH.ally(10,'guard');
  a.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  a.arts={sword:2};
  a.x=P.x+0.5; a.y=P.y;
  S.hero.party=[a]; a.hpNow=allyStats(a).maxHp*99;
  const chosen=allyArt(a).id;                    // 最上段（回転斬り）
  // 的を1体置いて、仲間の技が出るまで回す
  const e=W.enemies[0];
  W.enemies.forEach(x=>{ x.dead=true; });
  e.dead=false; e.hp=e.maxHp=9999999; e.x=a.x+1.0; e.y=a.y; e.boss=false; e.ms=0; e.atkV=0;
  W.enemies=[e];
  TH.immortal();
  const h0=e.hp;
  a.wartCd=0.05;                                 // すぐ出させる
  stepSim(6, {each:()=>{ TH.immortal(); }});
  return {chosen, dealt:h0-e.hp,
          picksHighest: chosen==='swspin',
          firedOnItsOwn: h0-e.hp > 0,
          wentOnCd: (a.wartCd||0) > 0};
});

// 5-b. 何も閃いていない仲間は、何も出さない（空の技を回さない）
R.allyNone = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); TH.floor(3);
  const a=TH.ally(10,'guard');
  a.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  a.arts={};
  return {art:allyArt(a), silent: allyArt(a)===null};
});

/* ================= 6. 技名の名乗り ================= */

/* 6-a. 技を出したら、使った本人の頭上に「技名！」が出る。
       大技・衝撃波・武器技・仲間の技、**全部**が同じ作法。 */
R.saysName = await pg.evaluate(()=>{
  const txts=()=>W.pops.filter(p=>p.txt).map(p=>p.txt);
  const out={};
  // 武器技
  TH.dummy('sword'); W.pops.length=0;
  fireArt(WEAPON_ARTS.sword[0], S.hero);
  out.art = txts().includes('居合！');
  // 大技
  TH.dummy('sword'); S.greatKills=9; S.ult='quake'; P.ultCd=0; W.pops.length=0;
  fireUlt();
  out.ult = txts().includes('震撼！');
  // 衝撃波
  TH.dummy('sword'); S.upg={wave:1}; P.waveCd=0; W.pops.length=0;
  fireWave();
  out.wave = txts().includes('衝撃波！');
  out.allSay = out.art && out.ult && out.wave;
  return out;
});

// 6-b. 閃いた瞬間は頭上に 💡 が出る
R.flashFx = await pg.evaluate(()=>{
  TH.dummy('sword');
  S.arts={};
  W.pops.length=0; W.fx.length=0;
  const P0=ART_FLASH_P.slice();
  ART_FLASH_P[0]=1;
  const got=tryFlashArt('sword');
  ART_FLASH_P[0]=P0[0];
  const txts=W.pops.filter(p=>p.txt).map(p=>p.txt);
  return {got:got&&got.id, txts,
          bulb: txts.includes('💡'),
          named: txts.includes('居合'),
          ring: W.fx.some(f=>f.t==='ultring')};
});

/* ================= 7. 置き型が主を失っても走り続けない ================= */

/* 倒れた仲間の多段技が、主のいないまま刻み続けないこと。
   （仲間は死ぬので、置きっぱなしの技が走り続けると誰の物でもないダメージが出る） */
R.orphan = await pg.evaluate(()=>{
  TH.run(1,{seed:9}); TH.floor(3);
  const a=TH.ally(10,'guard');
  a.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  a.x=P.x+0.5; a.y=P.y; S.hero.party=[a]; a.hpNow=allyStats(a).maxHp*99;
  const e=W.enemies[0];
  W.enemies.forEach(x=>{ x.dead=true; });
  e.dead=false; e.hp=e.maxHp=9999999; e.x=a.x+1.0; e.y=a.y; e.boss=false; e.ms=0; e.atkV=0;
  W.enemies=[e];
  P.atkCd=999; stepSim(1/60); e.x=a.x+1.0; e.y=a.y; stepSim(1/60);
  fireArt(WEAPON_ARTS.sword[2], a);       // 多段斬り（3回）を仲間が出す
  const afterFirst=e.hp;
  a.dead=true;                            // 1発目のあと倒れる
  for(let i=0;i<60;i++){ P.atkCd=999; stepSim(1/60); }
  return {afterFirst, afterDeath:e.hp,
          stopped: e.hp===afterFirst};
});

/* ================= 技欄（ステータス画面） ================= */

/* 見出しが格子の1マスに収まっていた。.grid は auto-fill の格子なので、
   素の div を混ぜると列に食い込む——「枠2 スキル技」の見出しが大技の隣に入り、
   衝撃波が大技の並びの一員に見えていた（報告「スキル技をセットすると
   大技の枠に入ってしまう」）。見出しと空表示は行を独り占めさせる。 */
R.slotHeadingsSpanRow = await pg.evaluate(()=>{
  S.greatKills=20; S.upg=S.upg||{}; S.upg.wave=1;
  TH.run(1); openStat();
  const grid=el('bag-arts');
  const gw=grid.getBoundingClientRect().width;
  const heads=[...grid.querySelectorAll('.gridhead')];
  const widths=heads.map(h=>Math.round(h.getBoundingClientRect().width));
  const items=[...grid.querySelectorAll('.item')];
  const itemW=items.length?Math.round(items[0].getBoundingClientRect().width):0;
  closeStat();
  /* 見出しには左右 2px の余白があるので、幅は格子と完全一致はしない。
     見たいのは「1列ぶんに収まっていないこと」なので、
     格子の幅との差（余白ぶん）と、品物1枚より明らかに広いことの両方で見る。 */
  return {gridW:Math.round(gw), widths, itemW, heads:heads.length,
          headsFullWidth: heads.length>=3 && widths.every(w=>Math.abs(w-gw)<=8),
          widerThanOneColumn: itemW>0 && widths.every(w=>w > itemW*1.5),
          itemsAreNarrower: itemW>0 && itemW < gw-2,
          ok: heads.length>=3 && widths.every(w=>Math.abs(w-gw)<=8 && w>itemW*1.5)};
});

/* 枠2（スキル技）の行を押しても大技の枠は動かない。
   枠が3つに分かれている以上、押した枠の中でしか物は動かない。 */
R.waveRowDoesNotTouchUlt = await pg.evaluate(()=>{
  S.greatKills=20; S.ult=null; S.upg=S.upg||{}; S.upg.wave=1;
  TH.run(1); openStat();
  const before=S.ult;
  const row=document.querySelector('#bag-arts .item[data-artslot="wave"]');
  if(row) row.click();
  const after=S.ult;
  closeStat();
  return {before, after, rowExists: !!row, ultUntouched: before===after,
          ok: !!row && before===after};
});

/* 街のステータス画面（#scr-char）でも技を付け替えられる。
   「いつでも入れ替えられる」と書いてある以上、街で開けないのは嘘になる。 */
R.townScreenSetsArt = await pg.evaluate(()=>{
  S.greatKills=20; S.ult=null;
  S.run=null; setScreen('char');
  const grid=el('char-arts');
  const rows=[...grid.querySelectorAll('.item[data-artslot="ult"]')];
  const pick=rows[1] || rows[0];
  const want=pick ? pick.dataset.artpick : null;
  if(pick) pick.click();
  return {rows:rows.length, want, got:S.ult,
          hasSection: rows.length>0,
          setFromTown: !!want && S.ult===want,
          ok: rows.length>0 && !!want && S.ult===want};
});

/* 閃いた技は名前を変えられる。既定値は最初から入っている
   （空欄から考えさせない）。空にして決定すれば元の名前に戻る。 */
R.renameArt = await pg.evaluate(()=>{
  TH.run(1);
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 5);
  S.arts={sword:3}; S.artName={};
  const d=WEAPON_ARTS.sword[0];
  const defName=artName(d);
  openArtRename(d.id);
  const prefilled = el('an-input').value===d.nm;
  el('an-input').value='わが一閃';
  commitArtRename(false);
  const renamed=artName(d);
  // ボタンの名札にも出る
  S.artPick={sword:d.id};
  updateHUD();
  const onButton = el('art-nm').textContent==='わが一閃';
  openArtRename(d.id);
  commitArtRename(true);                 // 元に戻す
  const restored=artName(d);
  return {defName, prefilled, renamed, onButton, restored,
          changed: renamed==='わが一閃',
          resets: restored===d.nm,
          ok: prefilled && renamed==='わが一閃' && onButton && restored===d.nm};
});

/* ---------- 閃いたその場で名前を付ける ----------
   依頼「技を閃いた時に名前を変更できるようにする」に対して、
   一度は「探索中に画面を止めたくない」と判断して開かない作りにした。
   依頼と食い違っていたので開くようにした（報告：窓が開かない）。 */

/* A. 閃いたら窓が開き、既定値が入っていること。 */
R.flashOpensRenameWindow = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  S.hero.party=[]; S.arts={}; S.artName={};
  closeArtRename();
  const base='sword';
  const list=artsOf(base);
  // 必ず閃かせる（rnd は const なので、確率のほうを差し替える）
  const chanceOrig=window.artFlashChance; window.artFlashChance=()=>1;
  const def=tryFlashArt(base);
  window.artFlashChance=chanceOrig;
  const open=document.getElementById('m-artname').classList.contains('on');
  const shown=document.getElementById('an-input').value;
  const sub=document.getElementById('an-sub').textContent;
  const paused=gamePaused();
  closeArtRename();
  const resumed=!gamePaused();
  return {artNm:def?def.nm:null, shown, sub,
          learned:!!def, windowOpened:open,
          defaultFilled: !!def && shown===def.nm,
          pausedWhileOpen: paused,
          resumedAfterClose: resumed,
          ok: !!def && open && !!def && shown===def.nm && paused && resumed};
});

/* B. 止めているあいだ盤面は動かない。閉じたら動く。
      止めても描画は続ける（背景が落ちると何の上の窓か分からない）。 */
R.renameWindowFreezesBoard = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.deepest=1; startRun(3); enterFloor(3);
  S.hero.party=[]; S.arts={}; S.artName={};
  closeArtRename();
  stepSim(0.2,{draw:true});
  const chanceOrig=window.artFlashChance; window.artFlashChance=()=>1;
  tryFlashArt('sword');
  window.artFlashChance=chanceOrig;
  // 窓が開いている状態で tick を回す
  const t0=S.run.elapsed;
  _drawStage='';
  for(let i=0;i<20;i++) tick(performance.now()+i*16);
  const elapsedWhilePaused=S.run.elapsed-t0;
  const drewWhilePaused=_drawStage==='地図';     // 描画は回っている
  closeArtRename();
  const t1=S.run.elapsed;
  for(let i=0;i<20;i++) tick(performance.now()+1000+i*16);
  const elapsedAfter=S.run.elapsed-t1;
  return {elapsedWhilePaused:+elapsedWhilePaused.toFixed(3),
          elapsedAfter:+elapsedAfter.toFixed(3),
          frozenWhileOpen: elapsedWhilePaused===0,
          stillDraws: drewWhilePaused,
          runsAfterClose: elapsedAfter>0,
          ok: elapsedWhilePaused===0 && drewWhilePaused && elapsedAfter>0};
});

/* C. 窓を閉じ忘れても盤面が永久に止まらない。
      止める理由（開いている窓）が消えたら自分で戻る。 */
R.pauseNeverSticks = await pg.evaluate(()=>{
  pauseGame(true);
  document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on'));
  const stuck=gamePaused();
  return {stillPausedAfterWindowsClosed: stuck?'はい':'いいえ',
          selfHealed: stuck===false,
          ok: stuck===false};
});

await done(b, errs, R);
