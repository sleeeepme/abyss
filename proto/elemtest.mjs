// 属性・状態異常・敵系統の検証
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(350);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

// --- 1. 武器種ごとに属性が割り当たっている
R.weaponTypes = await pg.evaluate(()=>{
  const out={};
  BASES.filter(b=>b.slot===SLOT.W).forEach(b=>out[b.nm]=DTYPE[b.dt].nm);
  const types=new Set(Object.values(out));
  return {map:out, distinctTypes:[...types], count:Object.keys(out).length};
});

// --- 2. 耐性が実際にダメージを増減させる
R.resistance = await pg.evaluate(()=>{
  const mk=(res)=>({lv:10, def:0, res, st:{}, bu:{}});
  const hit=(res,type)=>{
    let tot=0;
    for(let i=0;i<400;i++){ const t=mk(res); tot+=resolveDamage(t,[{type,amount:100}],10,{noVariance:true}).total; }
    return Math.round(tot/400);
  };
  return {
    neutral: hit({}, 'fire'),
    resist75: hit({fire:75}, 'fire'),
    weak50:   hit({fire:-50}, 'fire'),
    slashVsUndead: hit(FAMILY.find(f=>f.id==='undead').res, 'slash'),
    bluntVsUndead: hit(FAMILY.find(f=>f.id==='undead').res, 'blunt'),
  };
});

// --- 3. 刺突は防御を抜ける
R.penetration = await pg.evaluate(()=>{
  const armored={lv:20, def:200, res:{}, st:{}, bu:{}};
  const one=(type)=>{ const t={...armored,st:{},bu:{}};
    return resolveDamage(t,[{type,amount:100}],20,{noVariance:true}).total; };
  return {slash:one('slash'), pierce:one('pierce'), blunt:one('blunt'), fire:one('fire'),
          pierceBeatsSlash: one('pierce')>one('slash')};
});

// --- 4. 状態異常が蓄積で発症する
R.buildup = await pg.evaluate(()=>{
  const t={lv:5, def:0, res:{}, st:{}, bu:{}};
  let hits=0, procced=false;
  for(let i=0;i<40 && !procced;i++){
    hits++;
    const r=resolveDamage(t,[{type:'fire',amount:12}],5,{noVariance:true});
    if(r.procs.includes('burn')) procced=true;
  }
  return {hitsToBurn:hits, procced, statusActive:hasStatus(t,'burn'),
          need:buildupNeed(t)};
});

// --- 5. 各属性が正しい状態異常を積む
R.statusMapping = await pg.evaluate(()=>{
  const out={};
  for(const type of DTYPE_IDS){
    const t={lv:1, def:0, res:{}, st:{}, bu:{}};
    let got=null;
    for(let i=0;i<200 && !got;i++){
      const r=resolveDamage(t,[{type,amount:20}],1,{noVariance:true});
      if(r.procs.length) got=r.procs[0];
    }
    out[DTYPE[type].nm]= got ? STATUS[got].nm : 'なし';
  }
  return out;
});

// --- 6. 感電で被ダメージが増える
R.shockAmp = await pg.evaluate(()=>{
  const plain={lv:10,def:0,res:{},st:{},bu:{}};
  const a=resolveDamage(plain,[{type:'arcane',amount:100}],10,{noVariance:true}).total;
  const shocked={lv:10,def:0,res:{},st:{shock:{t:5,dps:0}},bu:{}};
  const b2=resolveDamage(shocked,[{type:'arcane',amount:100}],10,{noVariance:true}).total;
  return {plain:a, shocked:b2, amp:+(b2/a).toFixed(2)};
});

// --- 7. 火傷が継続ダメージを与える / 凍傷が切れる
R.dot = await pg.evaluate(()=>{
  const t={lv:5,def:0,res:{},st:{},bu:{}};
  addStatus(t,'burn',10);
  let dealt=0;
  for(let i=0;i<300;i++) tickStatus(t,1/60,(d)=>dealt+=d);   // 5秒ぶん
  return {totalBurnDamage:dealt, expired:!hasStatus(t,'burn')};
});

// --- 8. 敵の系統が深度で解禁され、色と攻撃属性を持つ
R.families = await pg.evaluate(()=>{
  const atDepth=(d)=>{ RNG=mulberry32(d*7919);
    const fl=genFloor(d); const es=spawnEnemies(fl,d);
    return [...new Set(es.map(e=>e.fam.id))].sort(); };
  const d1=atDepth(1), d12=atDepth(12), d30=atDepth(30);
  RNG=mulberry32(4242);
  const fl=genFloor(30); const es=spawnEnemies(fl,30);
  const allHaveColor=es.every(e=>!!e.col && !!e.dt && !!e.res);
  const names=[...new Set(es.map(e=>e.name))];
  return {depth1:d1, depth12:d12, depth30:d30,
          allHaveElement:allHaveColor, distinctNamesAtD30:names.length, sample:names.slice(0,5)};
});

// --- 9. 実プレイ: 弱点属性の方が速く倒せる
R.inCombat = await pg.evaluate(async ()=>{
  const trial=async(weaponBase, famId)=>{
    S.upg={atk:4}; S.hero=newHero(); startRun(1);
    let w=null; for(let i=0;i<9000&&!w;i++){ const x=genItem(20,0); if(x.base===weaponBase) w=x; }
    w.ident=true; w.aff=[]; S.hero.equip.weapon=w;
    const fam=FAMILY.find(f=>f.id===famId);
    W.enemies=[]; W.fx=[];
    const room=W.fl.rooms[0]; P.x=room.cx+0.5; P.y=room.cy+0.5;
    const e={x:P.x+0.9,y:P.y,lv:10,elite:false,arch:ARCH[3],aff:[],dead:false,fam,
             col:fam.col,dt:fam.atk,res:fam.res,st:{},bu:{},
             maxHp:99999,hp:99999,def:20,atkV:0,ms:0,r:0.34,state:'idle',t:0,cd:99,vx:0,vy:0,hit:0,tele:0,name:'的'};
    W.enemies.push(e);
    const hp0=e.hp;
    await new Promise(r=>setTimeout(r,1200));
    return Math.round(hp0-e.hp);
  };
  const bluntVsUndead = await trial('mace','undead');   // 打撃は屍骸の弱点
  const slashVsUndead = await trial('sword','undead');  // 斬撃は屍骸に耐性
  return {bluntVsUndead, slashVsUndead, bluntIsBetter: bluntVsUndead>slashVsUndead};
});

// --- 10. プレイヤーも状態異常になる（炎の敵に焼かれる）
R.playerStatus = await pg.evaluate(async ()=>{
  S.upg={hp:8}; S.hero=newHero(); startRun(1);
  S.run.pst={}; S.run.pbu={};
  const mx=stats(S.hero).maxHp;
  // 蓄積を溜めるあいだに死なないよう毎回全快させる
  for(let i=0;i<12;i++){ S.hero.hpNow=mx; hitPlayer(null, 40, 'fire', 8); }
  if(!S.run) return {burned:false, dotTicked:false, statusShown:false, died:true};
  const burned = !!(S.run.pst.burn && S.run.pst.burn.t>0);
  const hpAfterHits=S.hero.hpNow;
  await new Promise(r=>setTimeout(r,700));      // DoT が入る
  return {burned, dotTicked: S.hero.hpNow<hpAfterHits, statusShown:
    document.getElementById('statusbar').innerHTML.includes('火傷')};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
