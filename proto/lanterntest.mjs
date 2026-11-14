/* ランタン：初めての潜りで蛍石の代わりに落ちていて、拾うと演出つきで相棒になる */
import { boot, install } from './_h.mjs';
const {b, pg} = await boot(); await install(pg);
const R = await pg.evaluate(()=>{ try{
  const R={};
  S.tutStone=false; S.hero=null;
  TH.run(1,{seed:7}); TH.immortal();
  const d=W.drops.find(x=>x.stone && x.first);
  R.placed = !!d && S.run.noStone===true;
  draw(); R.noLanternYet = LAN.x==null;
  // 拾う
  W.enemies=[]; P.x=d.x; P.y=d.y; stepSim(0.1,{draw:true});
  R.picked = S.run.noStone===false && S.tutStone===true && lightFuel()===LIGHT_MAX && !W.drops.includes(d);
  R.firstNoEat = !LAN.eat;
  R.getStarted = !!LAN.get && W.pops.some(p=>p.txt==='ランタンを手に入れた');
  // 演出の途中は頭上、終わると肩の後ろ
  for(let i=0;i<30;i++){ _drawDt=1/60; draw(); }
  R.overhead = !!LAN.get && Math.abs(LAN.x-P.x)<0.1 && LAN.y < P.y-0.9;
  for(let i=0;i<120;i++){ _drawDt=1/60; draw(); }
  R.settled = !LAN.get && Math.abs(LAN.x-(P.x-0.40*LAN.face))<0.05 && Math.abs(LAN.y-(P.y-0.52))<0.05;
  // 輪の内側（眷属 1.05 マスより内）
  R.inside = Math.hypot(LAN.x-P.x, LAN.y-P.y) < 0.9;
  // 2回目以降の潜りは最初から持っている（落ちていない）
  TH.run(1,{seed:8});
  R.second = S.run.noStone===false && !W.drops.some(x=>x.first);
  for(let i=0;i<3;i++){ _drawDt=1/60; draw(); }
  R.followsFromStart = LAN.x!=null && !LAN.get;
  // 普通の蛍石は演出なし
  W.drops.push({x:P.x,y:P.y,stone:true}); stepSim(0.1,{draw:true});
  R.plainStone = !LAN.get && !!LAN.eat;
  for(let i=0;i<70;i++){ _drawDt=1/60; draw(); }
  R.eatEnds = !LAN.eat;
  // 商人から買っても食べる
  W.shop={x:P.x+1,y:P.y,seed:0,stock:[{uid:771,stone:true,nm:'蛍石',price:1}]}; S.run.gold=10;
  R.buyEats = buyFromMerchant(771).ok && !!LAN.eat;
  return R;
}catch(e){ return {err:String(e.stack).slice(0,500)}; } });
// 掃引（sweep.sh）は {errs,R} の JSON を読む。R の真偽値は true = 期待どおり
const errs = R.err ? [R.err] : [];
await b.close();
console.log(JSON.stringify({errs,R},null,2));
