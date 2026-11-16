/* 打ち直しのブレヒト（20F）：2体の掛け合い・同士討ち・倒した順で変わる合体・合体後の技 */
import { boot, install } from './_h.mjs';
const {b, pg} = await boot(); await install(pg);
const R = await pg.evaluate(()=>{ try{
  const R={};
  const AX=13, AY=13;   // 広間（34×28）の左寄り。右へ 8〜12 マス使う
  const setup=()=>{ TH.run(1,{seed:20}); TH.floor(20); TH.immortal(); S.hero.party=[];
    for(let y=4;y<24;y++) for(let x=4;x<30;x++) W.fl.g[y][x]=T.FLOOR; W.haz=null;
    const B=W.enemies.filter(e=>e.brecht); W.enemies=B.slice();
    const o=B.find(e=>e.brecht.inner==='octo'), c=B.find(e=>e.brecht.inner==='crab');
    for(const e of B){ e.cast=null; e.combo=null; e.recover=0; e.moveCd=99; e.state='chase'; e.revealed=true; e.vx=e.vy=0; }
    o.x=AX; o.y=AY; c.x=AX+6; c.y=AY; P.x=AX+3; P.y=AY+4; return {o,c}; };
  const finish=(e)=>{ let n=0; while(e.cast && n++<500) stepSim(1/60); };
  let {o,c}=setup();
  R.two = !!o && !!c && brechtMate(o)===c && brechtMate(c)===o;
  // --- 打ち合わせ：2体を結ぶ帯。相方も構える。帯の上で当たり、外では当たらない
  bossBeginCast(o,'anvil',{x:P.x,y:P.y},false);
  R.anvilFollow = c.cast && c.cast.follow===o && c.cast.id==='anvil';
  R.anvilBand = bossMoveHits(o,o.cast,AX+3,AY,0.3) && !bossMoveHits(o,o.cast,AX+3,AY+1.6,0.3) && !bossMoveHits(c,c.cast,AX+3,AY,0.3);
  R.anvilTele = Math.abs(o.cast.max-(0.9+6*0.06))<1e-6;
  let hits=0; const _hp=hitPlayer; hitPlayer=function(){ hits++; return true; };
  P.x=AX+3; P.y=AY; finish(o); stepSim(0.1);
  R.anvilHitsOnce = hits===1 && !c.cast;
  hitPlayer=_hp;
  // 交互：片方が溜めている間、もう片方は始めない
  ({o,c}=setup()); bossBeginCast(o,'slam',{x:P.x,y:P.y},false); c.moveCd=0; const cd0=c.moveCd;
  stepSim(0.2); R.alternate = !c.cast && !!o.cast;
  // --- 同士討ち：薙ぎ払いの扇に相方がいると、相方に当たって崩しが入る
  ({o,c}=setup()); c.x=o.x+2.5; c.y=o.y; P.x=o.x+3; P.y=o.y+0.3; duelInit(c); const hp0=c.hp, bk0=c.brk;
  bossBeginCast(o,'cleave',{x:c.x,y:c.y},false); finish(o);
  R.friendlyFire = c.hp<hp0 && c.brk>=bk0+BRECHT_PAIR.ffBrk-0.01;
  // 範囲の外なら当たらない
  ({o,c}=setup()); c.x=o.x-6; duelInit(c); const hp1=c.hp;
  bossBeginCast(o,'cleave',{x:o.x+3,y:o.y},false); finish(o);
  R.ffOnlyInRange = c.hp===hp1;
  // --- 脱いだ2体：引いて挟む
  ({o,c}=setup()); for(const e of [o,c]){ e.hp=e.maxHp*0.45; bossRage(e); e.cast=null; e.moveCd=99; e.recover=0; e.roar=0; }
  stepSim(1.0); for(const e of [o,c]){ e.cast=null; e.combo=null; e.moveCd=99; e.recover=0; e.roar=0; e.vx=e.vy=0; }
  R.purged = o.brecht.purged && c.brecht.purged;

  o.x=AX; o.y=AY; c.x=AX+2; c.y=AY+5; P.x=AX+5; P.y=AY;
  BRECHT_PAIR.comboCh=2; bossBeginCast(o,'grab',{x:P.x,y:P.y},false); finish(o); BRECHT_PAIR.comboCh=0.6;
  R.pullPinch = c.cast && c.cast.id==='pinch' && P.pull && Math.hypot(P.pull.x-c.x,P.pull.y-c.y) < c.r+1.0;
  c.cast=null; P.pull=null;
  // 墨を曳く：宿借りが墨を通って転がり、筋を残す
  for(const e of [o,c]){ e.cast=null; e.combo=null; e.moveCd=99; e.recover=0; e.pending=null; e.roll=null; }
  W.fx=W.fx.filter(f=>f.t!=='ink'); o.x=AX; o.y=AY; c.x=AX+8; c.y=AY+0.2; P.x=AX+4; P.y=AY;
  BRECHT_PAIR.comboCh=2; bossBeginCast(o,'ink',{x:P.x,y:P.y},false); finish(o); BRECHT_PAIR.comboCh=0.6;
  R.inkRollStarts = c.cast && c.cast.id==='roll' && c.cast.trail===true;
  const ink0=W.fx.filter(f=>f.t==='ink').length;
  finish(c); let n=0; while(c.roll && n++<300) stepSim(1/60);
  R.inkTrail = W.fx.filter(f=>f.t==='ink').length > ink0;
  // --- 投げる：宿借りは本当に飛ぶ（1フレームの移動は 0.21 マス以下）。着地の円で当たり、ひっくり返る
  for(const e of [o,c]){ e.cast=null; e.combo=null; e.moveCd=99; e.recover=0; e.pending=null; e.roll=null; }
  o.x=AX; o.y=AY; c.x=AX-2; c.y=AY+1; P.x=AX+6; P.y=AY;
  bossBeginCast(o,'throw',{x:P.x,y:P.y},false);
  R.throwSetup = c.cast && c.cast.follow===o && bossMoveHits(o,o.cast,P.x,P.y,P.r) && !bossMoveHits(o,o.cast,P.x,P.y+3.2,P.r);
  let mx=0; n=0; while(o.cast && n++<500){ const x0=c.x,y0=c.y; stepSim(1/60); mx=Math.max(mx,Math.hypot(c.x-x0,c.y-y0)); }
  R.throwFlies = mx>0.1 && mx<=0.21 && Math.hypot(c.x-(AX+6),c.y-AY)<0.3;
  R.throwFlip = c.recover>0.9 && !c.cast;
  // --- 合体：倒した順で強弱が変わる
  for(const e of [o,c]){ e.cast=null; e.combo=null; e.moveCd=99; e.recover=0; }
  killEnemy(o);
  R.merge = c.brecht.merged && !c.dead && c.moves.includes('inout') && c.moves.includes('inkbubble') && c.moves.includes('spinroll');
  R.order = c.brecht.strong.includes('pinch') && c.brecht.weak.includes('tentacle');
  const ms=brechtMoveDef(c,'pinch'), mw=brechtMoveDef(c,'tentacle'), mb=brechtMoveDef(c,'bubble'), mi=brechtMoveDef(c,'ink');
  R.strongWeak = Math.abs(ms.rad-2.4*1.2)<1e-6 && mw.one===true && Math.abs(mw.tele-0.75*1.2)<1e-6 && mi.n===2 && Math.abs(mb.rad||0)===0 && brechtMoveDef(c,'inout')===null;
  stepSim(1.2); c.cast=null; c.combo=null; c.recover=0; c.roar=0; c.moveCd=99; c.x=AX; c.y=AY; P.x=AX+4; P.y=AY;
  bossBeginCast(c,'tentacle',{x:P.x,y:P.y},false);
  R.weakOneBand = tentacleDirs(c.cast.dir,c.cast.m).length===1; c.cast=null;
  // 内と外：近くの扇と遠くの帯。扇の外・帯のあいだは空く
  bossBeginCast(c,'inout',{x:P.x,y:P.y},false);
  R.inout = bossMoveHits(c,c.cast,c.x+2,c.y+1,0.3) && bossMoveHits(c,c.cast,c.x+6,c.y,0.3) && !bossMoveHits(c,c.cast,c.x+5.5,c.y+1.6,0.3) && !bossMoveHits(c,c.cast,c.x-3,c.y,0.3);
  c.cast=null;
  // 墨の泡：消えた所に墨溜まり
  W.fx=W.fx.filter(f=>f.t!=='ink'&&f.t!=='bolt'); P.x=AX-8; P.y=AY+8;
  bossBeginCast(c,'inkbubble',{x:c.x+5,y:c.y},false); finish(c);
  R.inkBubbles = W.fx.filter(f=>f.t==='bolt'&&f.inky).length===7;
  c.moveCd=99; stepSim(5.0); c.cast=null;
  R.inkBubblePools = W.fx.filter(f=>f.t==='ink').length>=3;
  // 巻き転がり：帯が太い
  c.cast=null; c.roll=null; c.recover=0; c.x=AX; c.y=AY; P.x=AX+5; P.y=AY+1.4;
  bossBeginCast(c,'spinroll',{x:c.x+5,y:c.y},false);
  R.spinWide = bossMoveHits(c,c.cast,P.x,P.y,P.r); hits=0; hitPlayer=function(){ hits++; return true; };
  finish(c); n=0; while(c.roll && n++<300) stepSim(1/60); hitPlayer=_hp;
  R.spinHitsOnce = hits===1;
  // 分かれ打ち：HP3割で開く。本体は円まで跳ぶ（ワープしない）
  c.cast=null; c.roll=null; c.recover=0; c.combo=null; c.x=AX; c.y=AY; P.x=AX+6; P.y=AY; c.hp=c.maxHp*0.25; c.moveCd=0;
  stepSim(1/60); R.splitOpens = c.moves.includes('splitslam');
  c.cast=null; c.combo=null; c.moveCd=99; c.x=AX; c.y=AY;
  bossBeginCast(c,'splitslam',{x:P.x,y:P.y},false);
  mx=0; n=0; while(c.cast && n++<500){ const x0=c.x,y0=c.y; stepSim(1/60); mx=Math.max(mx,Math.hypot(c.x-x0,c.y-y0)); }
  R.splitLeaps = mx>0.1 && mx<=0.21 && Math.hypot(c.x-(AX+6),c.y-AY)<0.3;
  // 蛸を残した合体は逆になる
  ({o,c}=setup()); killEnemy(c);
  R.orderOther = o.brecht.merged && o.brecht.strong.includes('tentacle') && o.brecht.weak.includes('pinch');
  // --- 2体で60秒戦わせて落ちない
  ({o,c}=setup()); for(const e of [o,c]) e.moveCd=0.5; let err=null; const seen=new Set();
  try{ for(let i=0;i<3600;i++){ stepSim(1/60); for(const e of [o,c]) if(e.cast) seen.add(e.cast.id);
    if(i===900){ for(const e of [o,c]) e.hp=Math.min(e.hp,e.maxHp*0.45); }
    if(Math.hypot(P.x-o.x,P.y-o.y)>8){ P.x=AX+2; P.y=AY+3; } } }catch(x){ err=String(x.stack).slice(0,300); }
  R.fight = !err; if(err) R.fightErr=err;
  R.pairSeen = seen.has('anvil'); if(!R.pairSeen) R.seen=[...seen].join(',');
  return R;
}catch(x){ return {err:String(x.stack).slice(0,700)}; } });
console.log(R);
const bad = Object.entries(R).filter(([k,v])=>v!==true);
console.log(bad.length ? 'FAIL '+bad.map(x=>x[0]).join(',') : 'brechtpairtest OK');
await b.close(); process.exit(bad.length?1:0);
