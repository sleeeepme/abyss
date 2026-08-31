// 層ごとの地形と、10階ごとのボス階。
//
//   「色と敵の系統だけを変えた同じ迷路」を6つ並べても、層が変わった気はしない。
//   足元の意味を層ごとに変える——歩き方が変われば、層が変わったと分かる。
//
//   水の層：広い水。足が鈍り、毎秒削られる。水の中でだけ速くなる敵がいる
//   根の層：壁が無い。落ちれば痛い。敵は押してくる（押される先に何があるか）
//   跡の層：近寄るまで見えない敵
//   白の層：階が変わるたび、試練と同じ枷が1つ掛かる
//   10階ごと：大広間のボス戦だけの階
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 水の層 ================= */

/* 1-a. 水は**広い**。点在する池では避けて通れてしまい、
       「水の中で戦う層」にならない。他の層の倍以上を覆う。 */
R.water = await pg.evaluate(()=>{
  const cover=(d)=>{
    RNG=mulberry32(d*104729); const fl=genFloor(d);
    const hz=spawnHazards(fl,d);
    let floor=0, on=0;
    for(let y=0;y<fl.H;y++) for(let x=0;x<fl.W;x++){
      if(!tileWalk(fl,x,y)) continue;
      floor++; if(hz && hz.g[y][x]) on++;
    }
    return {kind:hz&&hz.kind, pct:+(on/Math.max(1,floor)*100).toFixed(1)};
  };
  const sump=cover(13), ruin=cover(35);
  const w=hazardDef('water');
  return {sump, ruin, slow:w.slow, dps:w.dps,
          isWater: sump.kind==='water',
          wide: sump.pct > ruin.pct*1.2,
          slowsYou: w.slow>0.2,
          hurtsEverySecond: w.dps>0,
          // 通れなくはしない（半分を超えると、避ける判断そのものが消える）
          notFlooded: sump.pct < 50,
          ok: sump.kind==='water' && sump.pct>ruin.pct*1.2 && w.slow>0.2 && w.dps>0};
});

/* 1-b. 水の中でだけ速くなる敵。**水の外では 1 に戻る**——
       陸へ誘い出す、という手がこの層の答えの1つになる。 */
R.aqua = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(13); S.hero.party=[];
  const es=W.enemies.filter(e=>!e.dead);
  const aq=es.filter(e=>e.aqua);
  if(!aq.length) return {found:0, ok:false};
  const e=aq[0];
  // 水の上に立たせる／水の外に出す
  let wet=null;
  for(let y=0;y<W.fl.H && !wet;y++) for(let x=0;x<W.fl.W;x++)
    if(W.haz && W.haz.g[y] && W.haz.g[y][x] && tileWalk(W.fl,x,y)){ wet={x:x+0.5,y:y+0.5}; break; }
  let dry=null;
  for(let y=0;y<W.fl.H && !dry;y++) for(let x=0;x<W.fl.W;x++)
    if(tileWalk(W.fl,x,y) && !(W.haz && W.haz.g[y] && W.haz.g[y][x])){ dry={x:x+0.5,y:y+0.5}; break; }
  const at=(p)=>{ e.x=p.x; e.y=p.y; return aquaMul(e); };
  const inWaterMul = wet ? at(wet) : 1;
  const onLandMul  = dry ? at(dry) : 1;
  // 水に馴染んでいない敵は、水の中でも変わらない
  const plain = es.find(x=>!x.aqua);
  const plainInWater = (plain && wet) ? (plain.x=wet.x, plain.y=wet.y, aquaMul(plain)) : 1;
  return {found:aq.length, share:+(aq.length/es.length).toFixed(2),
          inWaterMul, onLandMul, plainInWater,
          fasterInWater: inWaterMul>1,
          normalOnLand:  onLandMul===1,
          onlySome:      plainInWater===1,
          ok: inWaterMul>1 && onLandMul===1 && plainInWater===1};
});

/* ================= 2. 根の層（壁が無い） ================= */

/* 2-a. 壁が**縁**に置き換わる。部屋と通路の形はそのまま使う——
       間取りごと別に作ると、この層だけ道の付き方が違って見える。 */
R.ledges = await pg.evaluate(()=>{
  const look=(d)=>{
    RNG=mulberry32(d*104729); const fl=genFloor(d);
    let pit=0, wall=0, floor=0;
    for(let y=0;y<fl.H;y++) for(let x=0;x<fl.W;x++){
      const t=fl.g[y][x];
      if(t===T.PIT) pit++; else if(t===T.WALL) wall++; else floor++;
    }
    return {pit, wall, floor, marked: fl.pit ? 'あり' : 'なし'};
  };
  const root=look(25), stone=look(5);
  /* 縁は「黒い壁」に見えないよう、壁の色ではなく空の水色で塗る。 */
  const pitColour = typeof PIT_SKY_COL==='string' ? PIT_SKY_COL : null;
  const rootWallColour = ZONES.find(z=>z.id==='root').wall;
  return {root, stone, pitColour, rootWallColour,
          rootHasPits: root.pit>0 && root.marked==='あり',
          rootHasNoWalls: root.wall===0,
          othersUnchanged: stone.pit===0 && stone.wall>0 && stone.marked==='なし',
          roomsRemain: root.floor>0,
          pitIsSkyBlue: !!pitColour && pitColour.toLowerCase()!==rootWallColour.toLowerCase(),
          ok: root.pit>0 && root.wall===0 && stone.pit===0 && !!pitColour && pitColour.toLowerCase()!==rootWallColour.toLowerCase()};
});

/* 2-b. 落ちるのは**落ちられる者だけ**。棲んでいる側は縁で止まる。
       ここを揃えてしまうと、敵が勝手に落ちて層が自滅する。 */
R.whoFalls = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(25); S.hero.party=[];
  const fl=W.fl;
  /* 縁に**東側で隣り合う床**を探す。縁の中から歩かせると、
     落ちられない側はどの向きにも出られず「止まった」ように見えてしまう。 */
  let edge=null;
  for(let y=1;y<fl.H-1 && !edge;y++) for(let x=1;x<fl.W-2;x++){
    if(tileWalk(fl,x,y) && fl.g[y][x+1]===T.PIT && fl.g[y][x+2]===T.PIT){
      edge={x:x+0.5, y:y+0.5}; break;
    }
  }
  if(!edge) return {foundEdge:'なし', ok:false};
  const walk=(ent)=>{ ent.x=edge.x; ent.y=edge.y;
    for(let i=0;i<14;i++) moveEnt(ent, 0.1, 0);
    return {x:ent.x, inPit:pitAt(ent.x,ent.y)}; };
  const e=W.enemies.find(x=>!x.dead && !x.boss);
  const foe=walk(e), hero=walk(P);
  return {foundEdge:'あり', enemyX:+foe.x.toFixed(2), heroX:+hero.x.toFixed(2),
          enemyStopsAtEdge: !foe.inPit,
          heroCanStepOff:    hero.inPit,
          ok: !foe.inPit && hero.inPit};
});

/* 2-c. 落ちたら削られ、**直前に立っていた床へ戻る**。
       落ちた場所の真横へ戻すと、押し出されたときに同じ縁へ落ち続ける。
       戻るまでは即座ではなく、縮んで消える演出（fallAnim）を挟んでから戻り、
       戻った直後は点滅する（fallBlink）——神々のトライフォースの穴落ちと同じ形。 */
R.falling = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(25); S.hero.party=[];
  const fl=W.fl;
  P.invuln=0; P.fallAnim=null; P.fallBlink=0;
  stepSim(0.2);                       // 足場を1度覚えさせる
  const safe={x:P.x, y:P.y};
  let pit=null;
  for(let y=1;y<fl.H-1 && !pit;y++) for(let x=1;x<fl.W-1;x++)
    if(fl.g[y][x]===T.PIT){ pit={x:x+0.5,y:y+0.5}; break; }
  const hp0=S.hero.hpNow;
  P.x=pit.x; P.y=pit.y;
  tickPits(0.016);                    // 踏み外した瞬間。ダメージが入り、演出が始まる
  const hurt=hp0-S.hero.hpNow;
  const animStarted = !!P.fallAnim;
  const stillOverPitDuringAnim = pitAt(P.x,P.y);
  for(let i=0;i<80 && P.fallAnim;i++) tickPits(0.016);   // 演出が終わるまで進める
  return {hp0, hurt, back:{x:+P.x.toFixed(1), y:+P.y.toFixed(1)},
          tookDamage: hurt>0,
          // 即死にはしない（即死だと誰も縁に近寄らず、壁が無い意味が消える）
          survivable: hurt < hp0*0.5,
          playsShrinkAnim: animStarted && stillOverPitDuringAnim,
          returnedToFooting: Math.hypot(P.x-safe.x, P.y-safe.y) < 0.01,
          offThePit: !pitAt(P.x,P.y),
          blinksOnReturn: P.fallBlink>0,
          ok: hurt>0 && hurt<hp0*0.5 && animStarted && !pitAt(P.x,P.y) && P.fallBlink>0};
});

/* 2-d. 押してくる。**押した先は見ない**——縁があれば落ちる。
       ここが「壁が無い」と「ノックバック」を1つの遊びに繋ぐ蝶番。 */
R.knock = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(25); S.hero.party=[];
  const es=W.enemies.filter(e=>!e.dead && !e.boss);
  const pushers=es.filter(e=>e.push>0).length;
  const e=es[0];
  // 押される向きが分かるように、開けた床の上で真横から当てる
  P.invuln=0; P.guard=false;
  S.hero.hpNow=stats(S.hero).maxHp;
  S.hero.equip.armor=genBaseItem('plate',30,2);   // 回避で消えないように固める
  e.x=P.x-1.0; e.y=P.y; e.atkV=1; e.push=1.2;
  const bx=P.x, by=P.y;
  for(let i=0;i<8;i++){ P.invuln=0; hitPlayer(e); }
  const moved=Math.hypot(P.x-bx, P.y-by);
  // 弾では押さない（避けた・弾いた攻撃で押されると盾の意味が濁る）
  const cx=P.x, cy=P.y;
  P.invuln=0; hitPlayer(e, 5, 'blunt', 10);
  const boltMoved=Math.hypot(P.x-cx, P.y-cy);
  return {pushers, moved:+moved.toFixed(2), boltMoved:+boltMoved.toFixed(2),
          layerPushes: pushers>0,
          pushedAway: moved>0.3,
          boltsDoNotPush: boltMoved<0.01,
          ok: pushers>0 && moved>0.3 && boltMoved<0.01};
});

/* ================= 3. 跡の層（近寄るまで見えない） ================= */

/* 3-a. 印は層ごと。一度見えた相手は見え続ける——
       出たり消えたりすると、追っているのか見失ったのかが分からなくなる。 */
R.lurk = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(35); S.hero.party=[];
  setScreen('game');
  W.seen.forEach(r=>r.fill(1));       // 霧は別の話。開けてから見る
  const es=W.enemies.filter(e=>!e.dead && !e.boss);
  const lurkers=es.filter(e=>e.lurk>0).length;
  const e=es.find(x=>x.lurk>0);
  const far=(e.lurk||0)+3;
  e.x=P.x+far; e.y=P.y; e.spotted=false;
  draw();
  const hiddenWhenFar = !e.spotted;
  e.x=P.x+0.5; e.y=P.y;
  draw();
  const seenWhenNear = !!e.spotted;
  e.x=P.x+far; e.y=P.y;
  draw();
  const staysSeen = !!e.spotted;
  // 他の層には掛からない
  S.hero=newHero(); startRun(13); S.hero.party=[];
  const elsewhere=W.enemies.filter(x=>x.lurk>0).length;
  return {lurkers, radius:e.lurk, elsewhere,
          layerHides: lurkers>0,
          hiddenWhenFar, seenWhenNear, staysSeen,
          onlyThisLayer: elsewhere===0,
          ok: lurkers>0 && hiddenWhenFar && seenWhenNear && staysSeen && elsewhere===0};
});

/* ================= 4. 白の層（階ごとの枷） ================= */

/* 4-a. 階に入るたびに引き直す。距離が測れない層なので、
       地形ではなく**こちらの体**を毎回書き換えて性格を出す。 */
R.zoneBane = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(51); S.hero.party=[];
  const first=S.run.zoneBane;
  const names=new Set();
  for(let d=51; d<=58; d++){ enterFloor(d); if(S.run.zoneBane) names.add(S.run.zoneBane); }
  const shown = !!zoneBaneNow();
  enterFloor(25);
  const offLayer = S.run.zoneBane;
  const backOn = (enterFloor(53), !!S.run.zoneBane);
  return {first, tried:[...names], count:names.size, shown,
          appliesOnPale: !!first,
          rerolls: names.size>1,
          // 枷は試練と同じ5種を使い回す（新しい札を増やさない）
          fromTrialBanes: [...names].every(id=>!!trialBaneDef(id)),
          offOtherLayers: offLayer===null,
          backOn,
          ok: !!first && names.size>1 && offLayer===null && backOn};
});

/* 4-b. 掛かっている枷は**効いている**（表示だけで終わらせない）。 */
R.baneBites = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(51); S.hero.party=[];
  S.run.zoneBane='heavy';                       // 重圧＝移動速度 -30%
  const slow=stats(S.hero).ms;
  S.run.zoneBane=null;
  const normal=stats(S.hero).ms;
  S.run.zoneBane='silent';                      // 封技＝大技が出せない
  const silenced=baneMul('silence',false);
  S.run.zoneBane=null;
  return {slow:+slow.toFixed(2), normal:+normal.toFixed(2), silenced,
          slows: slow < normal,
          silences: silenced===true,
          ok: slow<normal && silenced===true};
});

/* ================= 5. 跡の層の「朽ちぬもの」 ================= */

/* 5-a. 跡の層（第四層／築、深さ31〜40）の**各階に1体ずつ**、倒せない相手を置く。
       狙いは難度ではなく**教える**こと——他の層には出さない。
       代表の階は5の倍数を避ける（33・37）。境界の外（3・41）も確かめる。 */
R.undying = await pg.evaluate(()=>{
  const check=(d)=>{ S.hero=newHero(); startRun(d); S.hero.party=[];
    return W.enemies.filter(e=>!e.dead && e.undying); };
  const r33=check(33), r37=check(37);
  const u=r33[0];
  let alive=false, full=false;
  if(u){ u.hp=1; killEnemy(u); alive=!u.dead; full=u.hp===u.maxHp; }
  // 跡の層より手前・より奥には出ない
  const before=check(3).length, after=check(41).length;
  return {r33n:r33.length, r37n:r37.length, name:u&&u.name, ms:u&&u.ms, before, after,
          onlyOneEachRuinFloor: r33.length===1 && r37.length===1,
          cannotBeKilled: alive && full,
          slowEnoughToFlee: !!u && u.ms<1.2,
          onlyInRuinLayer: before===0 && after===0,
          ok: r33.length===1 && r37.length===1 && alive && full && !!u && u.ms<1.2 && before===0 && after===0};
});

/* ================= 6. 10階ごとの大広間 ================= */

/* 6-a. ボスに会うまで部屋を10個歩く階だった。降りた瞬間に相手が見えていて、
       ほかに何も無い階にする。雑魚も鉱脈も商人も置かない。 */
R.arena = await pg.evaluate(()=>{
  const look=(d)=>{
    S.hero=newHero(); S.upg={hp:8}; startRun(d); S.hero.party=[];
    const es=W.enemies.filter(e=>!e.dead);
    const extras=[];
    if(W.npc) extras.push('仲間候補'); if(W.trial) extras.push('石碑');
    if(W.shop) extras.push('商人');    if(W.ores.length) extras.push('鉱脈');
    return {kind: W.fl.arena?'大広間':'通常', rooms:W.fl.rooms.length,
            bosses:es.filter(e=>e.boss).length,
            trash:es.filter(e=>!e.boss).length,
            extras};
  };
  const d10=look(10), d20=look(20), d15=look(15), d9=look(9);
  return {d10, d15, d20, d9,
          greatIsArena: d10.kind==='大広間' && d20.kind==='大広間',
          midIsNormal:  d15.kind==='通常',
          plainIsNormal:d9.kind==='通常',
          noTrash: d10.trash===0 && d20.trash===0,
          nothingElse: d10.extras.length===0 && d20.extras.length===0,
          ok: d10.kind==='大広間' && d15.kind==='通常' && d10.trash===0};
});

/* 6-b. 第20階層は2体。1体だけだと予兆を1つ覚えて終わるので、
       **同時に来る予兆を捌く**という別の問題にする。 */
R.twin = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(TWIN_BOSS_DEPTH); S.hero.party=[];
  const bs=W.enemies.filter(e=>e.boss && !e.dead);
  const st=W.fl.stair;
  const near=bs.map(b=>+Math.hypot(b.x-st.x, b.y-st.y).toFixed(1));
  const apart=bs.length===2 ? +Math.hypot(bs[0].x-bs[1].x, bs[0].y-bs[1].y).toFixed(1) : 0;
  const soloAt=(d)=>{ S.hero=newHero(); startRun(d);
    return W.enemies.filter(e=>e.boss && !e.dead).length; };
  const at10=soloAt(10), at30=soloAt(30);
  return {twins:bs.length, hp:bs.map(b=>b.maxHp), near, apart, at10, at30,
          twoOfThem: bs.length===2,
          bothMarked: bs.every(b=>b.twin===true),
          // 左右に振ってある＝穴へ向かえば必ず両方と出会う
          flankTheHole: near.every(v=>v<5) && apart>3,
          onlyHere: at10===1 && at30===1,
          ok: bs.length===2 && bs.every(b=>b.twin===true) && at10===1};
});

/* 6-c. 第30階層は**床が一面の毒沼**。避ける戦いから
       「削られる速さより速く倒す」戦いに切り替わる。
       穴と降り口の周りだけは空けておく（降りられないと詰む）。 */
R.poisonFloor = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(POISON_BOSS_DEPTH); S.hero.party=[];
  const fl=W.fl, hz=W.haz;
  let floor=0, on=0;
  for(let y=0;y<fl.H;y++) for(let x=0;x<fl.W;x++){
    if(!tileWalk(fl,x,y)) continue;
    floor++; if(hz && hz.g[y][x]) on++;
  }
  return {kind:hz&&hz.kind, pct:+(on/Math.max(1,floor)*100).toFixed(1),
          atStair: !hazardAt(fl.stair.x, fl.stair.y),
          atStart: !hazardAt(fl.start.cx+0.5, fl.start.cy+0.5),
          isPoison: (hz&&hz.kind)==='poison',
          coversFloor: on/Math.max(1,floor) > 0.8,
          ok: (hz&&hz.kind)==='poison' && on/Math.max(1,floor)>0.8
              && !hazardAt(fl.stair.x, fl.stair.y)};
});

/* 6-d. 第40階層の主は、周期的に全員をまとめて止める。
       予兆は長め——止められること自体は避けられないが、
       止められる前にどこに立っておくかは選べる。 */
R.freeze = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(FREEZE_BOSS_DEPTH); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const flagged=!!boss.freezer;
  boss.atkV=0; boss.moves=[]; P.invuln=1e9;
  const a=makeAlly(40,S.hero); a.x=P.x+1; a.y=P.y;
  uniqueAllyName(a,party()); S.hero.party.push(a);
  a.hpNow=allyStats(a).maxHp;
  // 予兆が出て、そのあと凍る
  let sawTele=false;
  stepSim(FREEZE_EVERY+FREEZE_TELE+1, {after:()=>{ if(boss.frzT>0) sawTele=true; },
                                       until:()=>frozenNow()});
  const froze=frozenNow();
  // 止まっているあいだは歩けない
  const bx=P.x, by=P.y;
  const ax=a.x, ay=a.y;
  stepSim(0.3, {each:()=>{ stickDx=1; stickDy=0; }});
  stickDx=0;
  const heroHeld  = Math.hypot(P.x-bx, P.y-by) < 0.05;
  const allyHeld  = Math.hypot(a.x-ax, a.y-ay) < 0.05;
  // 解ければ動ける
  S.run.frozen=0;
  stepSim(0.4, {each:()=>{ stickDx=1; stickDy=0; }});
  stickDx=0;
  const movesAgain = Math.hypot(P.x-bx, P.y-by) > 0.1;
  return {flagged, sawTele, froze, sec:FREEZE_SEC,
          heroHeld, allyHeld, movesAgain,
          ok: flagged && froze && heroHeld && allyHeld && movesAgain};
});

/* 6-e. 第50階層の主は**こちらが積み上げた物を持ってくる**——眷属と周回刃。
       味方は霧に巻かれて常に出血したまま戦うことになる。 */
R.finalSetPiece = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(50); S.hero.party=[];
  const boss=W.enemies.find(e=>e.boss);
  const escort=W.enemies.filter(e=>e.escort).length;
  RNG=mulberry32(999);
  const great=spawnEnemies(genFloor(40),40).find(e=>e.boss);
  boss.atkV=0; boss.moves=[]; P.invuln=1e9;
  P.x=boss.x+6; P.y=boss.y;                   // 刃の届かない位置で霧だけ見る
  S.run.pst={};
  stepSim(BLEED_AURA_EVERY+0.5);
  const bleeding=hasStatus({st:S.run.pst},'bleed');
  return {escort, blades:boss.blades, aura:!!boss.bleedAura,
          r:+boss.r.toFixed(2), greatR:+great.r.toFixed(2), bleeding,
          bringsKin: escort>0,
          spinsBlades: boss.blades>0,
          bleedsYou: bleeding,
          twiceTheSize: boss.r > great.r*1.8,
          ok: escort>0 && boss.blades>0 && bleeding && boss.r>great.r*1.8};
});

/* ================= 7. 帰還ポータル ================= */

/* 7-a. 街へ戻れるのは5階ごとの穴だけ。どこからでも帰れるなら、
       どこまで潜るかは決断ではなくただの気分になる。 */
R.portal = await pg.evaluate(()=>{
  const at=(d)=>{
    S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.stash=[];
    startRun(d); S.hero.party=[];
    S.run.gold=100; S.run.loot=[];
    openStairs();
    const button = document.getElementById('st-ret').style.display!=='none' ? '出る' : '出ない';
    TH.close('m-stairs');
    returnToTown();
    const went = S.run ? '潜ったまま' : '帰った';
    TH.close('m-ret');
    return {button, went, gold:S.gold};
  };
  const d7=at(7), d10=at(10), d12=at(12), d15=at(15);
  return {d7, d10, d12, d15, every:PORTAL_EVERY, next:nextPortalDepth(7),
          hiddenOffPortal: d7.button==='出ない' && d12.button==='出ない',
          shownOnPortal:   d10.button==='出る'   && d15.button==='出る',
          // ボタンを消すだけでなく、呼ばれても帰らない（入口は1ヶ所）
          blockedOffPortal: d7.went==='潜ったまま' && d12.went==='潜ったまま',
          worksOnPortal:    d10.went==='帰った' && d15.went==='帰った' && d10.gold>0,
          tellsWhereNext: nextPortalDepth(7)===10 && nextPortalDepth(10)===15,
          ok: d7.went==='潜ったまま' && d10.went==='帰った'};
});

/* 7-b. 帰還ポータルから戻った階には、一度だけそのまま再開できる。
       中継地点（大ボス撃破）とは別枠の切符で、潜れば消える。 */
R.resumeTicket = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; S.gold=0; S.stash=[]; S.resumeDepth=null; S.beacons=[];
  startRun(15); S.hero.party=[];
  S.run.gold=50; S.run.loot=[];
  returnToTown();
  TH.close('m-ret');
  const grantedAfterReturn = S.resumeDepth===15;
  // 中継地点は第10階層しか無い想定。切符はそれとは別に一覧へ出る。
  S.beacons=[10];
  const uds = unlockedDepths();
  const offeredSeparately = grantedAfterReturn && !uds.includes(15);
  renderTown();
  const html = document.getElementById('startdepth').innerHTML;
  const shownInTown = html.includes('data-resume="1"') && html.includes('data-depth="15"');
  // 選んで潜ると、その階から始まり、支給も中継地点と同じだけ入り、切符は消える
  S.startDepth = S.resumeDepth;
  startRun();
  const startedThere = S.run.depth===15;
  const consumed = S.resumeDepth===null;
  const gotOutfit = S.hero.lv >= beaconLevel(15);
  TH.close('m-stairs');
  return {grantedAfterReturn, offeredSeparately, shownInTown, startedThere, consumed, gotOutfit,
          ok: grantedAfterReturn && offeredSeparately && shownInTown && startedThere && consumed && gotOutfit};
});

await done(b, errs, R);
