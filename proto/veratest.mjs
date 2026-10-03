/* ヴェラ（10階の大ボス）：広間の柱と、第二形態の脚の部位破壊（2026-10-03 ユーザー要望）。
   ・柱は広間の中心から見て1・3・5・7・9・11時に1本ずつ。歩けない・矢は当たって消える・貫きと波動は柱の陰に届かない
   ・第二形態には脚が4本（手前左右・奥左右）。殴った側の脚に入り、壊すたびに数秒ダウン、4本とも壊すと防御が大きく落ちる */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.pillars = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); const f=W.fl, c=f.cover||[];
  const cx=(f.W-1)/2+.5, cy=(f.H-1)/2+.5;
  const hours=c.map(p=>{ let a=Math.atan2(p.x-cx, -(p.y-cy)); if(a<0) a+=Math.PI*2; return Math.round(a/(Math.PI/6)); }).sort((a,b)=>a-b);
  const walls=c.every(p=>solid(p.x,p.y));
  // 入口から穴まで歩ける
  const H=f.H, Wd=f.W, seen=new Uint8Array(H*Wd), q=[[f.start.cx,f.start.cy]]; seen[f.start.cy*Wd+f.start.cx]=1;
  while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=Wd||ny>=H||seen[ny*Wd+nx]||!tileWalk(f,nx,ny)) continue; seen[ny*Wd+nx]=1; q.push([nx,ny]); } }
  const reach=!!seen[Math.floor(f.stair.y)*Wd+Math.floor(f.stair.x)];
  // 5階（中ボス）・11階には柱が無い
  TH.run(5,{seed:44}); const n5=(W.fl.cover||[]).length; TH.run(20,{seed:44}); const n20=(W.fl.cover||[]).length;
  return {n:c.length, hours, walls, reach, n5, n20, ok: c.length===6 && hours.join()==='1,3,5,7,9,11' && walls && reach && n5===0 && n20===0};
});
R.coverBlocksAttacks = await pg.evaluate(()=>{
  /* 毎回まっさらな広間で：ボス—（柱）—主人公 を一直線に置き、柱の陰と陰でない所で比べる */
  const fresh=(behind)=>{ TH.run(10,{seed:44}); W.enemies.filter(x=>!x.boss).forEach(x=>x.dead=true); S.hero.party=[];
    const e=W.enemies.find(x=>x.uniqueBoss===10), p=W.fl.cover.find(c=>c.h===3), oy=behind?0:2.5;
    e.x=p.x+3; e.y=p.y+oy; e.moveCd=99; e.cd=99; P.x=p.x-2; P.y=p.y+oy; W.fx.length=0; S.hero.hpNow=99999; P.invuln=0; return e; };
  const beam=(behind)=>{ const e=fresh(behind), h=S.hero.hpNow; e.cast={id:'beam', dir:Math.PI, t:0}; resolveBossMove(e); e.cast=null; return S.hero.hpNow<h; };
  const bolt=(behind)=>{ fresh(behind); const h=S.hero.hpNow; W.fx.push({t:'bolt',x:P.x+3.2,y:P.y,vx:-5.6,vy:0,life:2,dmg:50,lv:10,dt:'pierce'}); for(let i=0;i<40;i++) stepSim(1/30); return S.hero.hpNow<h; };
  const wave=(behind)=>{ const e=fresh(behind), h=S.hero.hpNow; W.fx.push({t:'wave',x:e.x,y:e.y,r:0.5,max:9,speed:5.2,dmg:80,src:e,hit:[],col:'#fff',life:99}); for(let i=0;i<60;i++) stepSim(1/30); return S.hero.hpNow<h; };
  const r={beamBehind:beam(true), beamOpen:beam(false), boltBehind:bolt(true), boltOpen:bolt(false), waveBehind:wave(true), waveOpen:wave(false)};
  r.ok = !r.beamBehind && r.beamOpen && !r.boltBehind && r.boltOpen && !r.waveBehind && r.waveOpen;
  return r;
});
R.legParts = await pg.evaluate(()=>{
  TH.run(10,{seed:44}); W.enemies.filter(e=>!e.boss).forEach(e=>e.dead=true); S.hero.party=[];
  const e=W.enemies.find(x=>x.uniqueBoss===10);
  const none1=!e.parts;                               // 第一形態には無い
  bossChangeForm(e); if(S.run.formFx) S.run.formFx=null;
  const n=e.parts?e.parts.length:0, def0=e.def;
  // 手前右（南東）から殴ると、手前右の脚に入る
  const st=stats(S.hero);
  P.x=e.x+1.6; P.y=e.y+1.4;
  const sePart=e.parts.find(p=>p.id==='SE'), hp0=sePart.hp;
  hitEnemy(e, st, 1);
  const routed = sePart.hp<hp0 && e.parts.filter(p=>p!==sePart).every(p=>p.hp===p.max);
  // 壊すとダウン（技も移動も止まる）
  e.hp=e.maxHp*10; sePart.hp=1; hitEnemy(e, st, 1);
  const broke=sePart.broken, down0=e.down;
  const x0=e.x, y0=e.y; e.cast={id:'slam',t:0,dir:0}; for(let i=0;i<20;i++) enemyUpdate(e, 0.05);
  const still = Math.hypot(e.x-x0,e.y-y0)<1e-6 && !e.cast;
  for(let i=0;i<60;i++) enemyUpdate(e, 0.05);
  const recovered = !(e.down>0);
  // 残り3本を、それぞれの側から殴って壊す
  for(const [id,dx,dy] of [['SW',-1.6,1.4],['NE',1.6,-1.4],['NW',-1.6,-1.4]]){ const p=e.parts.find(q=>q.id===id); p.hp=1; P.x=e.x+dx; P.y=e.y+dy; hitEnemy(e, st, 1); }
  const all=e.parts.every(p=>p.broken), defDrop=e.def/def0;
  return {none1, n, routed, broke, down0, still, recovered, all, defDrop:+defDrop.toFixed(2),
    ok: none1 && n===4 && routed && broke && down0>2 && still && recovered && all && defDrop<0.5};
});
await done(b, errs, R);
