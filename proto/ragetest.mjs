/* 激昂の見た目（2026-11-02 ユーザー指定「激昂状態の時はアウトラインを赤く明滅したりオーラを纏ったり目を光らせたり」）。
   ・激昂したボスの絵に、赤い輪郭・オーラ・目の光が足される（洞窟版の絵のドットで）
   ・激昂していなければ何もしない
   ・効果を足しても、見えている形の大きさ（e._vis：名前の帯・影の位置）は変わらない */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
const setup = async (d, rage)=> pg.evaluate(async ([d,rage])=>{ TH.run(d,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); TH.immortal();
  const e=W.enemies.find(x=>x.boss); e.revealed=true; e.rage=rage; e.ms=0; e.moveCd=999; e.cd=999; e.cast=null; e.tele=0;
  P.x=e.x-3; P.y=e.y+.3; CAVE.rageLast=null; await new Promise(r=>setTimeout(r,400));
  return {vis:e._vis?{top:+e._vis.top.toFixed(1),bot:+e._vis.bot.toFixed(1),w:+e._vis.w.toFixed(1)}:null, fx:CAVE.rageLast}; },[d,rage]);
for(const d of [5,10,15,25]){
  const off=await setup(d,false), on=await setup(d,true);
  R['d'+d]={off:off.fx, on:on.fx, visOff:off.vis, visOn:on.vis,
    // 灰の大蛙（コマ送りの絵・跳ぶと幅が変わる）・ヴェラ第一形態・蜘蛛は待機のコマで形が変わるので、大きさは比べない（錨点で置いている）
    ok: off.fx===null && !!on.fx && (d===5 || d===10 || d===25 || JSON.stringify(off.vis)===JSON.stringify(on.vis))};
}
// 灰の大蛙はコマ送りの絵。目が琥珀に光るコマは待機の一部だけなので、1コマの瞬間ではなく2秒のあいだに1度でも検出されるかを見る
R.toadEye = await pg.evaluate(async()=>{ TH.run(5,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); TH.immortal();
  const e=W.enemies.find(x=>x.boss); e.revealed=true; e.rage=true; e.ms=0; e.moveCd=999; e.cd=999; e.cast=null; e.tele=0; P.x=e.x-3; P.y=e.y+.3;
  let mx=0; for(let i=0;i<30;i++){ await new Promise(r=>setTimeout(r,80)); mx=Math.max(mx,(CAVE.rageLast&&CAVE.rageLast.eyes)||0); }
  return {eyes:mx, ok:mx>0}; });
await done(b, errs, R);
