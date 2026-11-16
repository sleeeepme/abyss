/* 遺構のヒル（15F）：呑んで、吐く。礫吐き・毒吐き・吸い込み・仔を吐く・大岩 */
import { boot, install } from './_h.mjs';
const {b, pg} = await boot(); await install(pg);
const R = await pg.evaluate(()=>{ try{
  const R={};
  TH.run(1,{seed:15}); TH.floor(15); TH.immortal();
  const boss=()=>W.enemies.find(e=>e.boss && !e.dead);
  let e=boss();
  /* 試験場：壁の無い 30×20 の広間を掘って、その真ん中で戦わせる */
  const AX=20, AY=30; for(let y=AY-10;y<AY+10;y++) for(let x=AX-12;x<AX+18;x++) W.fl.g[y][x]=T.FLOOR;
  W.haz=null;
  R.moves = JSON.stringify(e.moves)===JSON.stringify(['gravel','venom','gulp','spawn']);
  const reset=()=>{ e=boss(); e.cast=null; e.combo=null; e.recover=0; e.moveCd=99; e.pending=[]; e.belly={stone:0,venom:0}; e.hp=e.maxHp; e.rage=false;
    W.rubble=[]; W.pools=[]; W.fx=W.fx.filter(f=>f.t!=='bolt'&&f.t!=='boulder'); W.enemies=W.enemies.filter(x=>x.boss); S.hero.party=[];
    e.x=AX+0.5; e.y=AY+0.5; e.vx=0; e.vy=0; P.x=e.x+4; P.y=e.y; S.hero.hpNow=stats(S.hero).maxHp; };
  const finish=()=>{ let n=0; while(e.cast && n++<400) stepSim(1/60); };
  const hp=()=>S.hero.hpNow;
  // --- 礫吐き：円の中で当たり、外では当たらない。瓦礫が残る
  reset(); bossBeginCast(e,'gravel',{x:P.x,y:P.y},false);
  R.gravelSpots = e.cast.spots.length===4 && e.cast.ox!=null && e.face===1;
  const sp0=e.cast.spots[0];
  let h0=hp(); finish();
  R.gravelRubble = W.rubble.length>=3 && W.rubble.every(q=>q.r===LEECH.rubbleR);
  R.gravelCd = e.moveCd<99;
  // 瓦礫の中には立てない
  P.x=W.rubble[0].x; P.y=W.rubble[0].y; stepSim(0.2);
  R.rubblePush = Math.hypot(P.x-W.rubble[0].x, P.y-W.rubble[0].y) >= LEECH.rubbleR*0.9;
  // 瓦礫は弾を遮る
  const rb=W.rubble[0]; W.fx.push({t:'bolt', x:rb.x-1.2, y:rb.y, vx:6, vy:0, life:2, dmg:1, lv:1, dt:'blunt'});
  P.x=rb.x+3; P.y=rb.y+3; stepSim(0.4);
  R.rubbleBlocksBolt = !W.fx.some(f=>f.t==='bolt');
  // 8秒で消える
  stepSim(8.2); R.rubbleExpires = W.rubble.length===0;
  // --- 毒吐き：帯で当たる・溜りが残る・踏むと削れる
  reset(); bossBeginCast(e,'venom',{x:P.x,y:P.y},false);
  R.venomHits = bossMoveHits(e,e.cast,P.x,P.y,P.r) && !bossMoveHits(e,e.cast,P.x,P.y+2.5,P.r);
  R.venomSingle = leechVenomDirs(e.cast,BOSS_MOVES.venom).length===1;
  finish();
  R.venomPools = W.pools.length>=4;
  const q0=W.pools[0]; P.x=q0.x; P.y=q0.y;
  R.poolAt = !!poolAt(P.x,P.y) && !poolAt(P.x+3,P.y+3);
  stepSim(6.3); R.poolExpires = W.pools.length===0;
  // 瓦礫が帯を止める
  reset(); leechAddRubble(e.x+LEECH.mouthX+2.0, e.y+LEECH.mouthY);
  bossBeginCast(e,'venom',{x:P.x,y:e.y+LEECH.mouthY},false);
  R.rubbleStopsVenom = leechBandLen(e.cast.ox,e.cast.oy,e.cast.dir,7,0.6)<2.2 && !bossMoveHits(e,e.cast,e.cast.ox+4,e.cast.oy,0.3);
  e.cast=null;
  // --- 吸い込み：扇の中の者を引く。歩けば抜けられる速さ。瓦礫と毒を呑む
  reset(); P.x=e.x+6; P.y=e.y;
  leechAddRubble(e.x+4, e.y-0.5); leechAddPool(e.x+3.5, e.y-0.6);
  bossBeginCast(e,'gulp',{x:P.x,y:P.y},false);
  const d0=Math.hypot(P.x-e.cast.ox,P.y-e.cast.oy);
  R.gulpBiteOnly = !bossMoveHits(e,e.cast,P.x,P.y,P.r) && leechInGulp(e.cast,P.x,P.y,P.r);
  stepSim(0.5);
  const d1=Math.hypot(P.x-e.cast.ox,P.y-e.cast.oy);
  R.gulpPulls = d1 < d0-0.8 && d1 > d0-1.6;
  finish();
  R.gulpAte = e.belly.stone===1 && e.belly.venom===1 && W.rubble.length===0 && W.pools.length===0;
  // 呑んだあとの礫吐きは2倍、毒吐きは3筋
  e.recover=0; bossBeginCast(e,'gravel',{x:P.x,y:P.y},false);
  R.gravelBig = e.cast.spots.length===8 && e.belly.stone===0; e.cast=null;
  bossBeginCast(e,'venom',{x:P.x,y:P.y},false);
  R.venomFan = leechVenomDirs(e.cast,BOSS_MOVES.venom).length===3 && e.belly.venom===0; e.cast=null;
  // 噛みつきは口元だけ
  reset(); P.x=e.x+LEECH.mouthX+1.0; P.y=e.y+LEECH.mouthY; bossBeginCast(e,'gulp',{x:P.x,y:P.y},false);
  R.gulpBite = bossMoveHits(e,e.cast,P.x,P.y,P.r); e.cast=null;
  // 潰すとむせる：腹が空になり、隙が長い
  reset(); e.belly={stone:2,venom:1}; bossBeginCast(e,'gulp',{x:P.x,y:P.y},false);
  R.gulpIntr = e.cast.intr===true;
  bossInterrupt(e);
  R.choke = e.recover===LEECH.chokeStun && e.belly.stone===0 && W.rubble.length===2 && W.pools.length===1 && !e.cast;
  // --- 仔を吐く：卵は動かず、割れば湧かない。放っておくと孵る
  reset(); bossBeginCast(e,'spawn',{x:P.x,y:P.y},false); finish();
  const eggs=W.enemies.filter(x=>x.egg);
  R.eggs = eggs.length>=1 && eggs.every(x=>x.name==='ヒルの卵');
  const eg=eggs[0], ex=eg.x, ey=eg.y;
  stepSim(0.5); R.eggStill = eg.x===ex && eg.y===ey && !!eg.egg;
  if(eggs[1]){ killEnemy(eggs[1]); }
  stepSim(1.6);
  R.eggHatch = !eg.egg && eg.maxHp>eg.hp*0+50 && eg.name!=='ヒルの卵' && W.enemies.filter(x=>!x.boss&&!x.dead).length===eggs.length-(eggs[1]?1:0);
  // --- 大岩（激昂で開く）
  reset(); e.hp=e.maxHp*0.4; bossRage(e);
  R.rageOpens = e.moves.includes('boulder') && e.rageMoves.includes('boulder');
  stepSim(1.0); e.cast=null; e.combo=null; e.roar=0; e.recover=0; e.moveCd=99; e.x=AX+0.5; e.y=AY+0.5; W.rubble=[]; W.pools=[]; W.enemies=W.enemies.filter(x=>x.boss); P.x=e.x+5; P.y=e.y+LEECH.mouthY;
  bossBeginCast(e,'boulder',{x:P.x,y:P.y},false);
  R.boulderNoIntr = e.cast.intr===false;
  R.boulderBand = bossMoveHits(e,e.cast,P.x,P.y,P.r) && !bossMoveHits(e,e.cast,P.x,P.y+2.2,P.r);
  leechAddRubble(e.cast.ox+2.5, e.cast.oy);
  let hits=0; const _hp=hitPlayer; hitPlayer=function(){ hits++; return true; };
  finish();
  const bf=W.fx.find(f=>f.t==='boulder'); R.boulderRolls = !!bf;
  let n=0; while(W.fx.some(f=>f.t==='boulder'&&!f.done) && n++<300) stepSim(1/60);
  hitPlayer=_hp;
  R.boulderHitsOnce = hits===1;
  R.boulderEatsRubble = W.rubble.length===0;
  R.shards = W.fx.filter(f=>f.t==='bolt'&&f.artId==='bl_shard').length===LEECH.shards+1;
  // --- 連携と隙の表
  R.tables = DUEL.combo.gulp==='gravel' && DUEL.combo.venom==='gulp' && DUEL.combo.gravel==='boulder' && DUEL.rec.gulp===1.0;
  // --- 80秒戦わせて落ちない・全部の技が出る
  reset(); e.moveCd=0.5; const seen=new Set(); let err=null;
  try{ for(let i=0;i<4800;i++){ stepSim(1/60); if(e.cast) seen.add(e.cast.id); if(i===600 && !e.rage) bossRage(e); } }catch(x){ err=String(x.stack).slice(0,300); }
  R.fight = !err; if(err) R.fightErr=err;
  R.allFire = ['gravel','venom','gulp','spawn','boulder'].every(k=>seen.has(k)); if(!R.allFire) R.seen=[...seen].join(',');
  return R;
}catch(x){ return {err:String(x.stack).slice(0,700)}; } });
console.log(R);
const bad = Object.entries(R).filter(([k,v])=>v!==true);
console.log(bad.length ? 'FAIL '+bad.map(x=>x[0]).join(',') : 'leechtest OK');
await b.close(); process.exit(bad.length?1:0);
