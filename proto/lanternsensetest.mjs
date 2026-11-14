/* ランタン：顔つきと気配の知らせ */
import { boot, install } from './_h.mjs';
const {b, pg} = await boot(); await install(pg);
const R = await pg.evaluate(()=>{ try{
  const R={};
  S.tutStone=true; TH.run(1,{seed:11}); TH.floor(4); TH.immortal();
  R.face = lanternFace(10)===0 && lanternFace(7)===0 && lanternFace(6)===1 && lanternFace(4)===1 && lanternFace(3)===2 && lanternFace(2)===2 && lanternFace(1)===3;
  const realLit = lanternLitR; window.lanternLitR = ()=>2;
  const clear=()=>{ W.enemies=[]; W.drops=[]; W.ores=[]; W.ev=null; W.shop=null; W.grave=null; W.risen=[]; W.haz=null; LAN.floorRef=null; LAN.alert=null; };
  const full=()=>{ S.run.stoneAt=S.run.elapsed; };
  const st={x:W.fl.stair.x+0.5, y:W.fl.stair.y+0.5};
  // 穴：8マス以内・灯りの外で知らせる
  clear(); full(); P.x=st.x+5; P.y=st.y; lanternScan();
  R.hole = LAN.alert && LAN.alert.kind==='hole';
  // 同じ階では1回だけ
  LAN.alert=null; lanternScan(); R.holeOnce = !LAN.alert;
  // 灯りが2段だと距離が 0.6 倍（4.8マス）に縮んで、5マス先は感じない
  clear(); S.run.stoneAt=S.run.elapsed-lightAgeFor(2); lanternScan();
  R.senseShrinks = !LAN.alert;
  // 宝：落ちている品
  clear(); full(); P.x=st.x+30; P.y=st.y;
  const it={x:P.x+4, y:P.y}; W.drops.push(it); lanternScan();
  R.treasure = LAN.alert && LAN.alert.kind==='treasure';
  // 商人は知らせない
  clear(); full(); W.shop={x:P.x+4, y:P.y, stock:[]}; lanternScan();
  R.noShop = !LAN.alert;
  // 灯りの中の物は言わない
  clear(); full(); W.drops.push({x:P.x+1, y:P.y}); lanternScan();
  R.litSilent = !LAN.alert;
  // 亡骸は宝より先
  clear(); full(); W.drops.push({x:P.x+4, y:P.y}); W.grave={x:P.x+20, y:P.y}; lanternScan();
  R.grave = LAN.alert && LAN.alert.kind==='grave';
  // 危険は何より先：近づいてくる敵
  clear(); full(); W.grave={x:P.x+20, y:P.y};
  const e=TH.spawn ? null : null;
  const foe={x:P.x+4.5, y:P.y, dead:false}; W.enemies=[foe];
  lanternScan(); foe.x-=0.3; lanternScan();
  R.danger = LAN.alert && LAN.alert.kind==='danger';
  // 遠ざかる敵は危険にしない
  clear(); full(); const f2={x:P.x+4, y:P.y, dead:false}; W.enemies=[f2]; lanternScan(); f2.x+=0.3; lanternScan();
  R.awaySilent = !LAN.alert || LAN.alert.kind!=='danger';
  window.lanternLitR = realLit;
  // 街では見せない
  clear(); full(); _drawDt=1/60; draw(); R.shownInDungeon = LAN.x!=null;
  S.screen='town'; drawLantern(0,0,1/60); R.hiddenInTown = LAN.x==null; S.screen='game';
  // 描画が通る（全種類・全顔つき）
  let ok=true;
  for(const kind of [null,'danger','grave','treasure','hole']) for(const F of [10,5,3,1]){
    S.run.stoneAt = S.run.elapsed - lightAgeFor(F);
    LAN.alert = kind ? {kind, x:P.x+3, y:P.y+1, t:0.2} : null; LAN.scanT=99;
    try{ drawLantern(0,0,1/60); }catch(err){ ok=false; R.drawErr=String(err); }
  }
  R.drawAll = ok;
  return R;
}catch(e){ return {err:String(e.stack).slice(0,600)}; } });
// 掃引（sweep.sh）は {errs,R} の JSON を読む。R の真偽値は true = 期待どおり
const errs = R.err ? [R.err] : [];
await b.close();
console.log(JSON.stringify({errs,R},null,2));
