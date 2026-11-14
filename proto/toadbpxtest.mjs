// 5階の灰の大蛙：コマ送りの絵（BPX 'to'）が読み込まれ、状態ごとに正しいコマが選ばれるか。
// idle 0-11 / hop 12-19 / tele 20-25 / slam 26-35 / cleave 36-44 / roar 45-52 / hit 53-57
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};
await pg.waitForFunction(()=>CAVE.bpx&&CAVE.bpx.ready('to'),null,{timeout:5000}).catch(()=>{});
const out = await pg.evaluate(()=>{
  TH.run(1,{seed:7}); TH.floor(5); W.seen.forEach(r=>r.fill(1));
  const e=W.enemies.find(x=>x.boss); e.x=P.x+3; e.y=P.y; e.hp=e.maxHp=1e7;
  const A=CAVE.bpx.anims('to');
  const fr=()=>{ draw(); return CAVE.bpx.frame(e); };
  const inA=(f,a)=>f>=a[0]&&f<a[0]+a[1];
  const o={};
  o.key=CAVE.bpx.key(e); o.ready=CAVE.bpx.ready('to'); o.uid=e.uniqueBoss;
  e.cast=null; e.tele=0; e.hop=null; e.hit=0; e.roar=0;
  o.idle=fr();
  e.hop={t:0.2,sec:0.42,x0:e.x,y0:e.y,x1:e.x,y1:e.y,lift:.62}; o.hop=fr(); e.hop=null;
  e.cast={id:'slam',t:.5,max:.85}; o.tele=fr();
  e.cast=null; o.slam=fr();
  e._bpRel=-9; e._bpDmg=-9;
  e.cast={id:'cleave',t:.5,max:.62}; fr(); e.cast=null; o.cleave=fr();
  e._bpRel=-9; e.rage=true;
  e.cast={id:'pillars',t:.5,max:1.05}; o.roar=fr(); e.cast=null; fr(); e._bpRel=-9;
  e.hit=0; fr(); e.hit=.2; o.hit=fr(); e.hit=0;
  o.vis=e._vis; o.A=Object.keys(A);
  return {o, A, ok:{
    ready:o.ready&&o.key==='to'&&o.uid===5,
    idle:inA(o.idle,A.idle), hop:inA(o.hop,A.hop), tele:inA(o.tele,A.tele),
    slam:inA(o.slam,A.slam), cleave:inA(o.cleave,A.cleave), roar:inA(o.roar,A.roar), hit:inA(o.hit,A.hit),
    sizeOk: !!o.vis && o.vis.w>50 && o.vis.w<90 }};
});
R.state=out.o; R.ok=out.ok;
R.allOk=Object.values(out.ok).every(v=>v===true);
await done(b, errs, R);
