/* 水の層の追加ぶん：磯虫の群れ（10体ほどで一斉に来る・1体は弱い）、天井からの滴、
   第16〜20階層の遺跡の名残（立った柱は当たり判定を持つ）、空中のシャボン玉。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.spawn = await pg.evaluate(()=>{
  const packsAt = d => { TH.run(d,{seed:41}); const sw=W.enemies.filter(e=>e.swarmling);
    const by={}; sw.forEach(e=>{ (by[e.pack] ||= []).push(e); }); return Object.values(by).map(a=>a.length); };
  const d13=packsAt(13), d17=packsAt(17), d15=packsAt(15), d5=packsAt(5), d25=packsAt(25);
  // 1体の硬さ：同じ階の雑魚（溜め）と比べる
  TH.run(13,{seed:41});
  const sl=W.enemies.find(e=>e.swarmling), mob=W.enemies.find(e=>!e.swarmling && !e.moss && !e.boss && !e.uniq && !e.elite);
  const weak = sl.maxHp < mob.maxHp*0.45 && sl.atkV < mob.atkV*0.6;
  // 群れは寄り集まって湧く
  const pk=W.enemies.filter(e=>e.pack===sl.pack), cx=pk.reduce((a,e)=>a+e.x,0)/pk.length, cy=pk.reduce((a,e)=>a+e.y,0)/pk.length;
  const tight = pk.every(e=>Math.hypot(e.x-cx,e.y-cy)<2.6);
  return {d13, d17, d15, d5, d25, weak, tight,
    ok: d13.length===1 && d13[0]>=9 && d13[0]<=12 && d17.length===2 && !d15.length && !d5.length && !d25.length && weak && tight};
});
R.packRush = await pg.evaluate(()=>{
  TH.run(13,{seed:42}); setScreen('game');
  const pk0=W.enemies.find(e=>e.swarmling), pk=W.enemies.filter(e=>e.pack===pk0.pack);
  // 群れの端の1体だけが見える所に立つ（他は索敵距離の外）
  const cx=pk.reduce((a,e)=>a+e.x,0)/pk.length, cy=pk.reduce((a,e)=>a+e.y,0)/pk.length;
  const far=pk.reduce((m,e)=>Math.hypot(e.x-cx,e.y-cy)>Math.hypot(m.x-cx,m.y-cy)?e:m, pk0);
  const ux=(far.x-cx)||1, uy=far.y-cy, ul=Math.hypot(ux,uy)||1, A=far.arch.aggro-0.6;
  P.x=far.x+ux/ul*A; P.y=far.y+uy/ul*A;
  const seesOne = pk.filter(e=>Math.hypot(e.x-P.x,e.y-P.y)<e.arch.aggro).length;
  W.enemies.filter(e=>!e.swarmling).forEach(e=>e.dead=true);
  S.hero.hpNow=99999;
  stepSim(0.15);
  const chasing = pk.filter(e=>e.state==='chase').length;
  const d0 = pk.reduce((a,e)=>a+Math.hypot(e.x-P.x,e.y-P.y),0)/pk.length;
  stepSim(1.0);
  const d1 = pk.filter(e=>!e.dead).reduce((a,e)=>a+Math.hypot(e.x-P.x,e.y-P.y),0)/Math.max(1,pk.filter(e=>!e.dead).length);
  return {n:pk.length, seesOne, chasing, d0:+d0.toFixed(2), d1:+d1.toFixed(2), ok: seesOne<pk.length && chasing===pk.length && d1<d0-1.5};
});
R.rewards = await pg.evaluate(()=>{
  TH.run(13,{seed:43}); setScreen('game');
  const pk0=W.enemies.find(e=>e.swarmling), pk=W.enemies.filter(e=>e.pack===pk0.pack);
  const sp0=S.shards||0, xp0=S.hero.xp, lv0=S.hero.lv;
  const spAfter=[];
  pk.forEach(e=>{ killEnemy(e); spAfter.push((S.shards||0)-sp0); });
  const spMid = spAfter[spAfter.length-2], spEnd = spAfter[spAfter.length-1];
  return {spMid, spEnd, ok: spMid===0 && spEnd>0};
});
R.draw = await pg.evaluate(()=>{
  TH.run(17,{seed:44}); setScreen('game'); W.seen.forEach(r=>r.fill(1));
  const e=W.enemies.find(x=>x.swarmling); P.x=e.x+1.2; P.y=e.y; draw(); draw();
  const spr = CAVE._sprite(e);
  return {spr: !!spr, ok: !!spr};
});
R.ruins = await pg.evaluate(()=>{
  const kinds=d=>{ TH.run(d,{seed:45}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); draw(); const G=CAVE._G(); return G.deco.map(o=>o.k); };
  const RUIN=['wpost','wwall','wsteps','sunken','rubble','rbig'];   // 陸の柱・壁は rbig（置き方は ruinPlacement で見る）
  let early=0, late=0, solidN=0, pillars=0;
  for(const seed of [45,46]){
    for(const d of [12,14]){ TH.run(d,{seed}); setScreen('game'); draw(); early+=CAVE._G().deco.filter(o=>RUIN.includes(o.k)).length; }
    for(const d of [16,18]){ TH.run(d,{seed}); setScreen('game'); draw(); const G=CAVE._G();
      const rs=G.deco.filter(o=>RUIN.includes(o.k)); late+=rs.length;
      for(const o of rs.filter(o=>o.k==='wpost')){ pillars++; if(window.solid(o.x/16, (o.y-1)/16)) solidN++; } }
  }
  return {early, late, pillars, solidN, ok: early===0 && late>=6 && pillars>0 && solidN===pillars};
});
R.drips = await pg.evaluate(()=>{
  let all=0, wet=0, stone4=0;
  for(const d of [12,17]){ TH.run(d,{seed:47}); setScreen('game'); draw(); const G=CAVE._G(); all+=G.drips.length; wet+=G.drips.filter(x=>x.wet).length; }
  TH.run(4,{seed:47}); setScreen('game'); draw(); stone4=CAVE._G().drips.length;   // 石の層の浅い所は今まで通り無し
  return {all, wet, stone4, ok: all>8 && wet>0 && stone4===0};
});
R.soap = await pg.evaluate(()=>{
  TH.run(13,{seed:48}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[];
  for(let i=0;i<3;i++) draw();
  const G=CAVE._G(), n=(G.soap||[]).length;
  // 触れると弾ける
  const s=G.soap[0]; s.age=1; s.ox=0; s.oy=0;
  const x=s.hx+Math.sin(1.1+s.s%7)*5, y=s.hy-6-22*(1/s.life);
  P.x=x/16; P.y=(y+8)/16; draw();
  const popped = s.age>=s.life;
  TH.run(5,{seed:48}); setScreen('game'); draw(); const none=!CAVE._G().soap;
  return {n, popped, none, ok: n>=5 && n<=60 && popped && none};
});
/* 遺跡の置き方（16〜20階）：部品は部屋の中だけ・入口から2マス・穴から3マス離れ、置いても入口から穴まで歩けて、
   全部の部屋に入れること。当たり判定を持ち、12・14階には出ないこと */
R.ruinPlacement = await pg.evaluate(()=>{
  let pieces=0, outside=0, nearOpen=0, nearStair=0, solidOk=0, solidN=0, cutOff=0, early=0, onBand=0, cols=0, postNear=0, remnants=0;
  for(const seed of [44,45,46,47]) for(const d of [16,17,18,19]){
    TH.run(d,{seed}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); draw();
    const G=CAVE._G(), f=W.fl, rb=G.deco.filter(o=>o.k==='rbig');
    cols+=rb.filter(o=>/^col_/.test(o.name)).length;
    if(rb.some(o=>/^(wall|corner|side)_/.test(o.name))&&rb.some(o=>/^pave_/.test(o.name))) remnants++;
    postNear+=G.deco.filter(o=>o.k==='wpost'&&rb.some(p=>Math.hypot(p.x-o.x,p.y-o.y)<6*16)).length;
    for(const o of rb){ pieces++;
      const tx=Math.floor(o.x/16), ty=Math.floor(o.y/16);
      const rm=f.rooms.find(r=>tx>=r.x&&tx<r.x+r.w&&ty>=r.y&&ty<r.y+r.h); if(!rm){ outside++; continue; }
      if(Math.hypot(tx+.5-f.stair.x,ty+.5-f.stair.y)<3) nearStair++;
      const sp=CAVE._ruinBig(o);
      if(sp.obs.length){ const B=CAVE._ruinBand(f); for(const [dx,dy,rr] of sp.obs){ const cx=Math.floor((o.x+dx)/16), cy=Math.floor((o.y+dy)/16); if(B.at(cx,cy)&&B.path[cy*f.W+cx]) onBand++; } }
      if(sp.obs.length){ solidN++; const [dx,dy]=sp.obs[0]; if(window.solid((o.x+dx)/16,(o.y+dy)/16)) solidOk++; }
    }
    const H=f.H, Wd=f.W, seen=new Uint8Array(H*Wd), q=[[f.start.cx,f.start.cy]]; seen[f.start.cy*Wd+f.start.cx]=1;
    const pass=(x,y)=>x>0&&y>0&&x<Wd&&y<H&&!window.solid(x+.5,y+.5);
    while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(seen[ny*Wd+nx]||!pass(nx,ny)) continue; seen[ny*Wd+nx]=1; q.push([nx,ny]); } }
    if(!seen[Math.floor(f.stair.y)*Wd+Math.floor(f.stair.x)]) cutOff++;
    cutOff+=f.rooms.filter(r=>{ for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++) if(seen[y*Wd+x]) return false; return true; }).length;
  }
  for(const seed of [44,45]) for(const d of [12,14]){ TH.run(d,{seed}); setScreen('game'); draw(); early+=CAVE._G().deco.filter(o=>o.k==='rbig').length; }
  /* 2026-10-01 置き方の見直し：通り道（帯の芯）に当たりを置かない／柱は4割まで／遺跡の6マス以内に水の角柱を置かない／
     建物の跡（壁か角＋敷石）がだいたいの階にある */
  return {pieces, outside, nearStair, solidN, solidOk, cutOff, early, onBand, colShare:+(cols/pieces).toFixed(2), postNear, remnants,
    ok: pieces>=40 && outside===0 && nearStair===0 && solidOk===solidN && cutOff===0 && early===0 && onBand===0 && cols<=pieces*.4 && postNear===0 && remnants>=12};
});
/* 2026-10-02 遺跡もランタンの光を受ける：どの遺跡の絵にも、面の向き（n）と焼いた光（k）が同じ大きさで付いている。
   主人公を遺跡の左と右に立たせると、同じ遺跡の色が変わる */
R.ruinRelight = await pg.evaluate(async ()=>{
  const {big,spr}=CAVE._ruinSprAll(); let missing=[];
  for(const [k,v] of [...Object.entries(big),...Object.entries(spr)]) if(!v.n||!v.k||v.n.length!==v.rows.length||v.n[0].length!==v.rows[0].length) missing.push(k);
  TH.run(17,{seed:44}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[]; S.hero.party=[]; CAVE.lightSnap=true; CAVE.noFlicker=true; draw();
  const o=CAVE._G().deco.find(o=>o.k==='rbig'&&/^(wall|corner|col)_/.test(o.name));
  const grab=async(dx)=>{ P.x=o.x/16+dx; P.y=o.y/16+0.6; for(let i=0;i<2;i++) draw();
    const cv=document.querySelector('canvas'), sc=cv.width/innerWidth, T=TS*sc, x=cv.width/2+(o.x/16-P.x)*T, y=cv.height/2+(o.y/16-P.y)*T;
    const c=document.createElement('canvas'); c.width=Math.round(T*2); c.height=Math.round(T*2); c.getContext('2d').drawImage(cv,x-T,y-T*1.6,c.width,c.height,0,0,c.width,c.height);
    return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data); };
  const a=await grab(-2.2), b2=await grab(2.2); let diff=0; for(let i=0;i<a.length;i+=4) if(Math.abs(a[i]-b2[i])+Math.abs(a[i+1]-b2[i+1])>30) diff++;
  CAVE.lightSnap=false; CAVE.noFlicker=false;
  return {missing, piece:o&&o.name, diff, ok: missing.length===0 && !!o && diff>40};
});
await done(b, errs, R);
