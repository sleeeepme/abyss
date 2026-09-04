// 始まりの2つ。
//   ・初回プレイの第1階層が毎回同じにならないこと（生成の塩）
//   ・その第1階層で、素手のまま終わらないこと（コモン武器）
//
// どちらも「一番最初の3分」の話で、ここが一番投げられる。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 生成の塩 ================= */

/* 1-a. 塩が違えば、初回の第1階層は違う地形になる。
       種は S.runs と depth だけだったので、**1回目の1階は誰がやっても同じ**
       だった。覚えてしまえば初手がただの作業になる。 */
R.saltChangesFirstFloor = await pg.evaluate(()=>{
  const sig=(salt)=>{
    S.salt=salt; S.runs=0; S.hero=newHero(); S.hero.party=[];
    startRun(1);
    return W.fl.W+'x'+W.fl.H+':'+W.fl.rooms.map(r=>r.cx+','+r.cy+','+r.w).join('|');
  };
  const a=sig(0), a2=sig(0), c=sig(123456789), d=sig(987654321);
  S.salt=0;
  return {len:a.length, sameSaltSameFloor: a===a2,
          differsA: a!==c, differsB: c!==d,
          ok: a===a2 && a!==c && c!==d};
});

/* 1-b. **同じ探索の中の再現性は壊さない。** 塩は種の材料に混ぜるだけなので、
       同じ塩・同じ周回で同じ階へ入れば同じ地形が出る。
       ここが崩れると、階段を上り下りするだけで地形が変わってしまう。 */
R.reenterSameFloor = await pg.evaluate(()=>{
  S.salt=555; S.runs=0; S.hero=newHero(); S.hero.party=[];
  startRun(1);
  const sig=()=>W.fl.rooms.map(r=>r.cx+','+r.cy).join('|');
  const first=sig();
  enterFloor(2); const second=sig();
  enterFloor(1); const back=sig();
  S.salt=0;
  return {same: first===back, floorsDiffer: first!==second,
          ok: first===back && first!==second};
});

/* 1-c. 塩を引くのは**名前をつけた瞬間だけ**。
       宣言時や startAdventure() で引くと、_h.mjs を通さず自前で起動している
       25本のスイートが静かに毎回違う地形を見ることになる。
       新しい保存が生まれる場所は1ヶ所しかないので、そこだけで引く。 */
R.saltDrawnOnNewSave = await pg.evaluate(()=>{
  const atBoot = S.salt;
  S.salt = -1;                      // 番兵。confirmName が上書きするはず
  el('nm-input').value='テスト';
  confirmName();
  const after = S.salt;
  S.salt = 0;
  return {atBoot, after, uint32: after>=0 && after<=0xffffffff && (after|0)===(after>>>0|0),
          drawn: after!==-1,
          ok: after!==-1 && after>=0 && after<=0xffffffff};
});

/* ================= 1b. 主人公の見た目 =================
   新規にゲームを始めるたびに、用意した数種類のどれかへランダムに変わる。
   1種類しか無かった頃の名残で、以前は誰がやっても同じ絵だった。 */

// 1b-a. newHero() のたびに抽選される。用意された種類の中からしか出ないし、固定でもない。
R.heroArtRandomPerNewGame = await pg.evaluate(()=>{
  const keys=CharacterArt.heroArtKeys;
  const seen=[];
  for(let i=0;i<80;i++) seen.push(newHero().artKey);
  const unknown=seen.filter(k=>!keys.includes(k));
  return {keys, sample:seen.slice(0,8), distinct:[...new Set(seen)],
          count:keys.length, atLeastTwo: keys.length>=2,
          onlyKnownKeys: unknown.length===0,
          varied: new Set(seen).size>1,
          ok: keys.length>=2 && unknown.length===0 && new Set(seen).size>1};
});

// 1b-b. 実際の「新規ゲーム」の入口（名前確定→startAdventure）でも同じように決まる
R.heroArtDrawnAtRealStart = await pg.evaluate(()=>{
  S.hero=null;
  el('nm-input').value='テスト2';
  confirmName();
  const key=S.hero && S.hero.artKey;
  const valid=CharacterArt.heroArtKeys.includes(key);
  return {key, valid, ok: valid};
});

// 1b-c. 一度決まったら、その場では変わらない（毎フレーム引き直したりしない）
R.heroArtStaysFixed = await pg.evaluate(()=>{
  TH.run(1,{seed:2});
  const before=S.hero.artKey;
  stepSim(2, {draw:true});
  updateHUD();
  const after=S.hero.artKey;
  return {before, after, unchanged: before===after, ok: before===after};
});

// 1b-d. 6種類とも実際に読み込めていて、描画に使える（壊れた画像で無言に劣化しない）
R.heroArtAllDrawable = await pg.evaluate(()=>{
  const results=CharacterArt.heroArtKeys.map(k=>{
    const resolved=CharacterArt.heroKey({artKey:k});
    const drew=CharacterArt.put(k, 0, 0, 26, {}, 1, 0);
    return {k, resolved, drew};
  });
  const bad=results.filter(r=>r.resolved!==r.k || !r.drew);
  return {results, bad, ok: bad.length===0};
});

// 1b-e. 未知・欠落の artKey は既定（scout）へ落ちる
R.heroArtFallsBackWhenMissing = await pg.evaluate(()=>{
  const noKey=CharacterArt.heroKey({});
  const badKey=CharacterArt.heroKey({artKey:'hero_nonexistent'});
  return {noKey, badKey,
          fallsBack: noKey==='hero_scout' && badKey==='hero_scout',
          ok: noKey==='hero_scout' && badKey==='hero_scout'};
});

/* ================= 2. 最初の1階の武器 ================= */

/* 2-a. 素手で始まる初回の第1階層は、宝箱の1つが**コモンの武器で確定**。
       確率で寄せるだけだと「出ないときは出ない」が残り、
       一番投げられやすい場所を運に預けることになる。 */
R.firstFloorArmsYou = await pg.evaluate(()=>{
  S.salt=0; S.runs=0; S.startDepth=1;
  S.hero=newHero(); S.hero.party=[]; S.hero.equip.weapon=null;
  startRun(1);
  const chests=W.drops.filter(d=>d.chest);
  const first=chests[0].it;
  return {chests:chests.length, slot:first.slot, rar:first.rar, nm:first.nm,
          isWeapon: first.slot==='weapon', isCommon: first.rar===0,
          ok: first.slot==='weapon' && first.rar===0};
});

/* 2-b. 手心は**条件を狭く**取ってある。武器を1本でも構えたら普通の配分に戻る。
       ここを広げると、拾える物が武器ばかりの単調な床になる。 */
R.stopsOnceArmed = await pg.evaluate(()=>{
  S.salt=0; S.runs=0;
  S.hero=newHero(); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('sword',1,0);
  startRun(1);
  const armed=earlyArming();
  // 2周目以降も対象外
  S.hero.equip.weapon=null; S.runs=5;
  enterFloor(1);
  const laterRun=earlyArming();
  // 深いところも対象外
  S.runs=0; enterFloor(2);
  const deeper=earlyArming();
  return {offWhenArmed: !armed, offOnLaterRuns: !laterRun, offDeeper: !deeper,
          ok: !armed && !laterRun && !deeper};
});

/* 2-c. 手心が効いているあいだは、床に落ちる物も武器へ寄る。
       確定の1個だけだと「拾い損ねたら終わり」が残るので、比重も上げてある。 */
R.weaponShareRises = await pg.evaluate(()=>{
  const share=(early)=>{
    S.salt=0; S.runs=early?0:9;
    S.hero=newHero(); S.hero.party=[];
    if(!early) S.hero.equip.weapon=genBaseItem('sword',1,0);
    startRun(1);
    RNG=mulberry32(4242);
    let w=0;
    for(let i=0;i<600;i++) if(pickBase(3).slot==='weapon') w++;
    return w/600;
  };
  const on=share(true), off=share(false);
  return {on:+on.toFixed(3), off:+off.toFixed(3), mul:EARLY_ARM_MUL,
          rises: on > off*1.5,
          // 武器だけの床にはしない
          notAllWeapons: on < 0.75,
          ok: on > off*1.5 && on < 0.75};
});

/* ================= 3. 聖騎士の装備 ================= */

/* 3-a. ジョブが指定するベースは**必ず実在すること。**
       聖騎士の盾は 'kite' と書いてあったが、そんなベースは存在せず、
       genBaseItem の取りこぼしで BASES[1]（＝剣）が盾の枠に入っていた。
       綴りの間違いが「盾の代わりに剣」という形で静かに通っていた。 */
R.jobBasesExist = await pg.evaluate(()=>{
  const bad=[];
  const all=ALL_JOBS;                 // 通常6＋上位3。上位も必ず含める
  for(const j of all){
    for(const k of ['weapon','shield','armor']){
      const id=j[k]; if(!id) continue;
      const base=BASES.find(x=>x.id===id);
      if(!base) bad.push(j.id+'.'+k+'='+id);
      else if(base.slot!==SLOT[{weapon:'W',shield:'S',armor:'A'}[k]])
        bad.push(j.id+'.'+k+' は '+base.slot);
    }
  }
  return {jobs:all.length, bad, ok: bad.length===0};
});

// 3-b. 聖騎士は剣と大盾（受けながら斬る役）
R.paladinGear = await pg.evaluate(()=>{
  const j=jobDef('paladin');
  const a=makeAlly(20,S.hero||newHero());
  a.job='paladin';
  const w=genBaseItem(j.weapon,20,1), s=genBaseItem(j.shield,20,1);
  return {weapon:j.weapon, shield:j.shield,
          wSlot:w.slot, sSlot:s.slot,
          ok: j.weapon==='sword' && w.slot==='weapon' && s.slot==='shield'};
});

await done(b, errs, R);
