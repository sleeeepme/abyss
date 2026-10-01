/* 階に入ったときの落下演出。主人公→仲間の順に上から落ち、落ちている間は盤面が止まり、終われば普通に動く。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.dropIn = await pg.evaluate(()=>{
  window.DROP_IN = true;
  TH.run(3,{seed:7}); setScreen('game');
  ['knight','mage'].forEach((job,i)=>{ const a=TH.ally(3,job,5); a.slot=i; S.hero.party.push(a); });
  enterFloor(3);
  const a0=party()[0], a1=party()[1];
  const at0 = {hero:dropInPose(P), a0:dropInPose(a0), a1:dropInPose(a1)};
  const e=W.enemies.find(x=>!x.boss); const ex=e&&e.x, el=S.run.elapsed;
  stepSim(0.3);
  const mid = {heroFalling: dropInPose(P)?.k!=null, frozen: S.run.elapsed===el && (!e || e.x===ex)};
  draw();
  stepSim(1.2);
  const after = {over: W.dropIn==null, pose: dropInPose(P), moving: S.run.elapsed>el};
  window.DROP_IN = false;
  return {at0:{heroUp: at0.hero && at0.hero.y<-TS*5, a0Hidden: !!(at0.a0&&at0.a0.hide), a1Hidden: !!(at0.a1&&at0.a1.hide)}, mid, after,
          ok: at0.hero && at0.hero.y<-TS*5 && at0.a0?.hide && at0.a1?.hide && mid.heroFalling && mid.frozen && after.over && after.pose==null && after.moving};
});
/* 街から潜ったとき。暗転の下で落ち始めると見えないので、黒が明けるまで全員を画面の上で待たせる */
R.fromHub = await pg.evaluate(()=>{
  window.DROP_IN = true;
  S.run=null; setScreen('town');
  startRun();
  const held = W.dropIn && W.dropIn.t<0 && !!(dropInPose(P)||{}).hide;
  stepSim(DROPIN.hold*0.9);
  const stillUp = !!(dropInPose(P)||{}).hide;
  stepSim(0.3);
  const falling = (dropInPose(P)||{}).k!=null;
  stepSim(2);
  const over = W.dropIn==null;
  window.DROP_IN = false;
  return {held, stillUp, falling, over, ok: held && stillUp && falling && over};
});
R.offInTests = await pg.evaluate(()=>{
  window.DROP_IN = undefined;            // 自動操作中は明示しない限り出さない
  TH.run(3,{seed:7}); enterFloor(3);
  const off = W.dropIn==null;
  window.DROP_IN = false;
  return {off, ok: off};
});
await done(b, errs, R);
