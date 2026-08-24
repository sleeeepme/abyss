// 大技（解放・発動・リキャスト・技レベル）と、層ごとの地形ハザード。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

R.unlock = await pg.evaluate(()=>{
  S.greatKills=0; S.ult=null; S.ultLv={};
  const at0=unlockedUlts().length, j0=unlockedJobs().length;
  const seq=[];
  for(let i=0;i<5;i++){ onGreatBossDown({tier:'great'});
    seq.push({n:S.greatKills, ults:unlockedUlts().map(u=>u.id), jobs:unlockedJobs().length}); }
  return {at0, j0, seq, firstAutoSet:S.ult,
          allUnlocked: unlockedUlts().length===ULTS.length,
          jobsGrew: unlockedJobs().length===JOBS.length+ELITE_JOBS.length};
});
R.fire = await pg.evaluate(async ()=>{
  const out={};
  for(const u of ULTS){
    S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=30;
    S.hero.str=34;S.hero.dex=34;S.hero.vit=34;
    S.greatKills=5; S.ult=u.id; S.ultLv={[u.id]:3};
    startRun(20); S.hero.party=[]; W.ores.length=0;
    S.hero.hpNow=1e9;
    W.enemies.length=0;
    for(let i=0;i<8;i++){ const ang=i/8*6.28;
      W.enemies.push({x:P.x+Math.cos(ang)*2.4, y:P.y+Math.sin(ang)*2.4, arch:ARCH[0],
        fam:FAMILY[0], lv:20, elite:false, aff:[], maxHp:1e7, hp:1e7, atkV:5, def:0,
        res:{}, dt:'blunt', st:{}, bu:{}, state:'chase', t:0, cd:99, vx:0,vy:0,hit:0,tele:0,
        dead:false, r:0.34, ms:0, teleMul:1, col:'#fff', name:'的'}); }
    const hpBefore=W.enemies.map(e=>e.hp);
    P.ultCd=0; P.dirx=1; P.diry=0;
    const fired=fireUlt();
    const hurt=W.enemies.filter((e,i)=>e.hp<hpBefore[i]).length;
    let drawFail=null;
    try{ W.seen.forEach(r=>r.fill(1)); for(let k=0;k<4;k++) draw(); }catch(e){ drawFail=e.message; }
    const blocked=fireUlt();          // 直後は撃てない
    // 守護だけがパーティ軽減を張り、瞬歩だけが無敵を残す（それ以外は何も残さない）
    const wardOn = !!(S.run&&S.run.ward), inv = +(P.invuln||0).toFixed(1);
    out[u.id]={fired, hurt, cd:+P.ultCd.toFixed(1), wantCd:+ultCooldown(u).toFixed(1),
               blockedWhileCooling: blocked===false, drawFail,
               sideEffect: u.id==='ward' ? 'ward' : (u.id==='blink' ? 'invuln' : 'none'),
               sideEffectCorrect:
                 u.id==='ward'  ? (wardOn && inv===0) :
                 u.id==='blink' ? (inv>0 && !wardOn) : (!wardOn && inv===0),
               invuln:inv};
  }
  return out;
});
R.cooldown = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.greatKills=5; S.ult='quake'; S.ultLv={quake:1};
  startRun(12); W.enemies.length=0; W.ores.length=0;
  P.ultCd=0; fireUlt();
  const start=P.ultCd;
  await new Promise(r=>setTimeout(r,1200));
  const later=P.ultCd;
  P.ultCd=0; updateHUD();
  const btn=document.getElementById('ultbtn');
  return {start:+start.toFixed(1), later:+later.toFixed(1), ticks: later<start,
          shown:btn.classList.contains('on'), ready:btn.classList.contains('ready'),
          label:document.getElementById('ult-nm').textContent};
});
R.levelCost = await pg.evaluate(()=>{
  const curve=[1,2,3,4].map(lv=>ultUpCost(lv));
  S.shards=99999; S.ultLv={quake:1};
  return {curve, max:ULT_MAX_LV, canUp:ultCanUp('quake'),
          rises: curve.every((v,i)=>i===0||v>curve[i-1]),
          cdShrinks: ultCooldown(ULTS[0])>0};
});
R.notEquippedWhenLocked = await pg.evaluate(()=>{
  S.greatKills=0; S.ult='ruin';
  const u=ultEquipped();
  P.ultCd=0;
  return {equipped:u, blocked:fireUlt()===false, safe:u===null};
});

/* ================= 地形ハザード ================= */

R.gen = await pg.evaluate(()=>{
  const at=d=>{ let cov=0,n=0,kinds=new Set(),onStair=0;
    for(let s=0;s<40;s++){ RNG=mulberry32(d*7919+s); const fl=genFloor(d);
      const h=spawnHazards(fl,d); n++;
      if(h){ kinds.add(h.kind); cov+=h.n;
        const sx=Math.floor(fl.stair.x), sy=Math.floor(fl.stair.y);
        if(h.g[sy]&&h.g[sy][sx]) onStair++; } }
    return {avgTiles:+(cov/n).toFixed(1), kinds:[...kinds], onStair}; };
  return {d5:at(5), d9:at(9), d12:at(12), d25:at(25), d35:at(35), d45:at(45),
          from:HAZARD_FROM_DEPTH,
          noneBefore10: at(5).avgTiles===0 && at(9).avgTiles===0,
          appearsAt10: at(12).avgTiles>0,
          growsWithDepth: at(45).avgTiles>at(12).avgTiles,
          neverOnStair: at(12).onStair===0 && at(35).onStair===0 && at(45).onStair===0,
          // 層の並びが 石/水/根/跡/鍛冶場/白 になったので、深度ごとの種類も変わる
          zoneThemed: at(25).kinds[0]==='spore' && at(35).kinds[0]==='slick' && at(45).kinds[0]==='lava'};
});
R.hurts = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=25; S.hero.str=28;S.hero.dex=28;S.hero.vit=28;
  startRun(25); S.hero.party=[]; W.enemies.length=0; W.ores.length=0;
  // 足元をハザードにする
  W.haz={kind:'lava', g:Array.from({length:W.fl.H},()=>new Uint8Array(W.fl.W)), n:1};
  const gx=Math.floor(P.x), gy=Math.floor(P.y);
  for(let y=gy-2;y<=gy+2;y++) for(let x=gx-2;x<=gx+2;x++) if(W.haz.g[y]) W.haz.g[y][x]=1;
  const e={x:P.x+0.6,y:P.y,arch:ARCH[0],fam:FAMILY[0],lv:25,elite:false,aff:[],
    maxHp:99999,hp:99999,atkV:0,def:0,res:{},dt:'blunt',st:{},bu:{},state:'chase',t:0,cd:99,
    vx:0,vy:0,hit:0,tele:0,dead:false,r:0.34,ms:0,teleMul:1,col:'#fff',name:'的'};
  W.enemies.push(e);
  const hp0=S.hero.hpNow, ehp0=e.hp;
  const onIt=!!hazardAt(P.x,P.y), slow=hazardSlowAt(P.x,P.y);
  stickDx=0;stickDy=0;
  await new Promise(r=>setTimeout(r,1600));
  return {onIt, slow, playerLost:hp0-S.hero.hpNow, enemyLost:ehp0-e.hp,
          hurtsPlayer:(hp0-S.hero.hpNow)>0, hurtsEnemies:(ehp0-e.hp)>0,
          status:Object.keys(S.run.pst)};
});
R.draw = await pg.evaluate(()=>{
  const fails=[];
  Object.keys(HAZARDS).forEach(k=>{
    try{ S.hero=newHero(); S.upg={hp:8}; startRun(30);
      W.haz={kind:k, g:Array.from({length:W.fl.H},()=>new Uint8Array(W.fl.W)), n:9};
      for(let y=2;y<12;y++) for(let x=2;x<12;x++) if(W.haz.g[y]) W.haz.g[y][x]=1;
      W.seen.forEach(r=>r.fill(1));
      for(let i=0;i<3;i++){ draw(); }
    }catch(e){ fails.push(k+': '+e.message); }
  });
  return {kinds:Object.keys(HAZARDS).length, failures:fails, ok:fails.length===0};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
