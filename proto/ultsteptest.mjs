// 大技の段（2026-11-07）：Lv.1・3・5 で形が変わり、Lv.2・4 は数値と演出だけ上がる。
// 実時間で回して、後から来る当たり（ultLater）まで数える。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });

/* 1回撃って、wait 秒のあいだに起きたことを数える */
await pg.evaluate(()=>{
  window._T = async (id, lv, wait, opt={})=>{
    S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=30;
    S.hero.str=34;S.hero.dex=34;S.hero.vit=34;
    S.greatKills=5; S.ult=id; S.ultLv={[id]:lv};
    startRun(20); W.ores.length=0;
    if(!opt.party) S.hero.party=[];
    S.hero.hpNow=stats(S.hero).maxHp; W.enemies.length=0;
    const n = opt.n || 8, rr = opt.r || 2.4;
    for(let i=0;i<n;i++){ const ang=i/n*6.28;
      W.enemies.push({x:P.x+Math.cos(ang)*rr, y:P.y+Math.sin(ang)*rr, arch:ARCH[0],
        fam:FAMILY[0], lv:20, elite:false, aff:[], maxHp:1e7, hp:1e7, atkV:5, def:0,
        res:{}, dt:'blunt', st:{}, bu:{}, state:'chase', t:0, cd:99, vx:0,vy:0,hit:0,tele:0,
        dead:false, r:0.34, ms:0, teleMul:1, col:'#fff', name:'的'}); }
    const hits=new Map(), arts={};
    const H0=hitEnemy, F0=window.feelPixelArt;
    /* 大技から来た当たりだけを数える（主人公の通常攻撃は外す）。
       hitEnemy の中から hitEnemy が呼ばれる（追撃など）ぶんも数えない。 */
    let depth=0;
    const fromUlt = ()=>/fireUltCore|tickUltQ|ultAegisEnd/.test(new Error().stack);
    hitEnemy=function(e){ if(depth===0 && fromUlt()) hits.set(e,(hits.get(e)||0)+1); depth++; try{ return H0.apply(this,arguments); } finally{ depth--; } };
    window.feelPixelArt=function(aid){ arts[aid]=(arts[aid]||0)+1; return F0.apply(this,arguments); };
    // 的を置いたら1コマ進めてから撃つ（nearEnemies の格子は tick で組み直される——wartest の教訓）
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    P.ultCd=0; P.dirx=1; P.diry=0;
    if(opt.before) opt.before();
    const fired=fireUlt();
    const hp0=W.enemies.map(e=>e.hp);
    const at0={}; if(opt.at0) Object.assign(at0, opt.at0());
    await new Promise(r=>setTimeout(r, wait*1000));
    hitEnemy=H0; window.feelPixelArt=F0;
    const per=W.enemies.map(e=>hits.get(e)||0);
    return {fired, totalHits:[...hits.values()].reduce((a,b)=>a+b,0), per, arts, at0,
            dealt:W.enemies.reduce((a,e,i)=>a+(1e7-e.hp),0), qLeft:ULT_Q.length};
  };
});
const R={};
const T=(id,lv,wait,opt)=>pg.evaluate(([id,lv,wait,opt])=>_T(id,lv,wait,opt),[id,lv,wait,opt||{}]);

// 地脈断：1・2・3 発。1発ごとに輪が広がる
{
  const q={};
  for(const lv of [1,2,3,4,5]) q[lv]=await T('quake',lv,1.6);
  const waves = lv => q[lv].arts['u_quake']||0;
  R.quake = { waves:[1,2,3,4,5].map(waves),
    ok: waves(1)===1 && waves(2)===1 && waves(3)===2 && waves(4)===2 && waves(5)===3,
    lv5HitsEach: q[5].per.every(n=>n===3),
    queueDrains: q[5].qLeft===0 };
  // 半径が広がる：Lv.5 の3発目だけが届く距離に置いた的
  const far = await T('quake',5,1.6,{n:4, r:(3.2+5*0.35)*1.4});
  const near1 = await T('quake',1,1.0,{n:4, r:(3.2+1*0.35)*1.4});
  R.quake.thirdReachesFar = far.per.every(n=>n===1);
  R.quake.lv1NotFar = near1.totalHits===0;
}
// 縮地：Lv.1 で3回、1Lvごとに1回増えて Lv.5 で7回。Lv.5 だけ最後に斬り跡が爆ぜる
{
  const hop={}, burst={};
  for(const lv of [1,2,3,4,5]){ const r=await T('blink',lv,3.2,{n:8, r:2.6}); hop[lv]=r.arts['u_blink']||0; burst[lv]=r.arts['u_blink_burst']||0; }
  R.blink = { hops:[1,2,3,4,5].map(l=>hop[l]), ok:[1,2,3,4,5].every(l=>hop[l]===2+l),
              burstOnlyLv5: burst[5]>0 && [1,2,3,4].every(l=>burst[l]===0) };
  const inv = await pg.evaluate(()=>P.invuln);
  R.blink.invulnLeft = inv>0;
  // 1回ごとに速くなる：7回目は1回目より短い。7回ぶん合計しても旧の7回より短い
  R.blink.speedsUp = await pg.evaluate(()=>{
    const s=[0,1,2,3,4,5,6].map(ultBlinkSec);
    const sum=s.reduce((a,b)=>a+b,0);
    // 全体は1.5倍の速さ：1回目は BLINK_SEC/1.5
    return s.every((v,i)=>i===0||v<=s[i-1]) && s[6]<s[0]*0.5 && sum < 7*BLINK_SEC*0.6/1.5 && Math.abs(s[0]-BLINK_SEC/1.5)<1e-9;
  });
}
// 灼髄：1列 → 3列 → 5列。どの列でも1体1回
{
  const lanes={}, once={};
  for(const lv of [1,3,5]){ const r=await T('blaze',lv,0.4,{n:12, r:3.0}); lanes[lv]=r.arts['u_blaze']||0; once[lv]=r.per.every(n=>n<=1); }
  R.blaze = { lanes:[lanes[1],lanes[3],lanes[5]], ok: lanes[1]===1 && lanes[3]===3 && lanes[5]===5,
              hitOncePerEnemy: once[1]&&once[3]&&once[5] };
  // 広がるので、Lv.5 は Lv.1 より多くの的に当たる
  const a=await T('blaze',1,0.4,{n:12,r:3.0}), c=await T('blaze',5,0.4,{n:12,r:3.0});
  R.blaze.widerHitsMore = c.per.filter(n=>n>0).length > a.per.filter(n=>n>0).length;
}
// 守護：Lv.3 で1発、Lv.5 で2発の盾。切れたら盾も消える
R.ward = await pg.evaluate(async ()=>{
  const out={};
  for(const lv of [1,3,5]){
    await _T('ward',lv,0.05,{n:1, r:8});
    out['lv'+lv]=S.hero.barrier||0;
  }
  // Lv.5：割れると周りを押し返す
  await _T('ward',5,0.2,{n:4, r:1.2});
  const d0=W.enemies.map(e=>Math.hypot(e.x-P.x,e.y-P.y));
  spendBarrier(S.hero, P.x, P.y);
  // 壁際の的は動けないので、4方向のうちどれかが押し返されていればよい
  const pushed = W.enemies.some((e,i)=>Math.hypot(e.x-P.x,e.y-P.y) > d0[i]+0.5);
  S.run.ward.t=0.01; await new Promise(r=>setTimeout(r,200));
  return {...out, ok: out.lv1===0 && out.lv3===1 && out.lv5===2, pushed,
          clearedWithWard: !S.run.ward && (S.hero.barrier||0)===0};
});
// 鉄壁：Lv.3 で +3秒。Lv.5 は終わりに受けたダメージを返す
R.aegis = await pg.evaluate(async ()=>{
  await _T('aegis',2,0.05,{n:1,r:8}); const t2=S.run.aegis.t;
  await _T('aegis',3,0.05,{n:1,r:8}); const t3=S.run.aegis.t;
  const step = t3 - t2;                    // 1Lv ぶん（0.9秒）＋ 3秒
  const r = await _T('aegis',5,0.05,{n:3,r:1.5});
  S.run.aegis.taken = 500; S.run.aegis.t = 0.02;
  const hp0=W.enemies.map(e=>e.hp);
  await new Promise(r=>setTimeout(r,250));
  const hurt=W.enemies.filter((e,i)=>e.hp<hp0[i]).length;
  // Lv.3 では返さない
  await _T('aegis',3,0.05,{n:3,r:1.5}); S.run.aegis.taken=500; S.run.aegis.t=0.02;
  const hq=W.enemies.map(e=>e.hp); await new Promise(r=>setTimeout(r,250));
  const hurt3=W.enemies.filter((e,i)=>e.hp<hq[i]).length;
  return {step:+step.toFixed(2), extraOk: Math.abs(step-3.9)<0.15, burstHurts:hurt===3, noBurstLv3: hurt3===0};
});
// 回帰：Lv.3 で仲間の技の待ちが早く進む、Lv.5 で仲間の大技がすぐ出る
R.rally = await pg.evaluate(async ()=>{
  await _T('rally',1,0.05,{n:1,r:8});
  const h1 = S.run.rallyHaste||0;
  await _T('rally',3,0.05,{n:1,r:8});
  const h3 = S.run.rallyHaste||0;
  const a={artCd:20, wartCd:20, x:P.x, y:P.y};
  // 仲間を一人だけ足さずに、待ちの進みだけを見る（livingParty を差し替える）
  const LP=livingParty; livingParty=()=>[a];
  S.run.rallyHaste=1.0; const c0=a.artCd;
  tickRallyHaste(0.5);
  const fast = Math.abs((c0-a.artCd) - 0.5) < 1e-6;   // 自前の減りに、もう 0.5 秒ぶん上乗せ
  const AS=allyStats; allyStats=()=>({maxHp:100}); a.hpNow=100;
  S.ult='rally'; S.ultLv={rally:5}; P.ultCd=0; a.artCd=20; fireUlt();
  const now = a.artCd===0;
  livingParty=LP; allyStats=AS;
  return {h1, h3, hasteOnlyFromLv3: h1===0 && h3>0, fast, lv5Now:now};
});
// 命脈：Lv.3 でかけた瞬間にも回復、Lv.5 は溢れた分が盾
R.bloom = await pg.evaluate(async ()=>{
  const mx = ()=>stats(S.hero).maxHp;
  await _T('bloom',1,0.0,{n:1,r:8,before:()=>{ S.hero.hpNow=Math.round(stats(S.hero).maxHp*0.5); }});
  const g1 = S.hero.hpNow/mx();
  await _T('bloom',3,0.0,{n:1,r:8,before:()=>{ S.hero.hpNow=Math.round(stats(S.hero).maxHp*0.5); }});
  const g3 = S.hero.hpNow/mx();
  await _T('bloom',5,0.0,{n:1,r:8});       // 満タンで撃つ → 溢れた分が盾
  const sh = S.hero.bshield||0;
  const cap = Math.round(mx()*ULT_BLOOM_SHIELD);
  const dm = bloomAbsorb(S.hero, 50);
  await _T('bloom',3,0.0,{n:1,r:8}); const sh3=S.hero.bshield||0;
  return {g1:+g1.toFixed(2), g3:+g3.toFixed(2), instantFromLv3: g1<0.51 && g3>0.55,
          shieldLv5: sh>0 && sh<=cap, absorbs: dm<50 && dm>=1, noShieldLv3: sh3===0};
});
// 裂天：Lv.3 で裂け目が開いて雷が落ち続ける、Lv.5 は締めの太い雷
{
  const r1=await T('ruin',1,2.6,{n:4,r:3}), r3=await T('ruin',3,2.6,{n:4,r:3}), r5=await T('ruin',5,2.6,{n:4,r:3});
  R.ruin = { hits:[r1.totalHits, r3.totalHits, r5.totalHits],
    ok: r1.totalHits===4 && r3.totalHits===4+8 && r5.totalHits===4+8+1,
    riftFromLv3: !r1.arts['u_ruin_rift'] && !!r3.arts['u_ruin_rift'],
    dealtGrows: r1.dealt < r3.dealt && r3.dealt < r5.dealt };
}
// 説明文：Lv.3・5 の段の文が付く
R.desc = await pg.evaluate(()=>{
  const o={};
  ULTS.forEach(u=>{ o[u.id]=[1,3,5].map(l=>u.desc(l)); });
  const steps = ULTS.every(u=> u.desc(1)!==u.desc(3) && u.desc(3)!==u.desc(5));
  return {steps, quake5:o.quake[2], blink1:o.blink[0]};
});
// 演出：新しい部品が PixelArtFx にあり、どの技も Lv.1〜5 で描いて落ちない
R.art = await pg.evaluate(()=>{
  const X=window.PixelArtFx; if(!X) return {ok:false, why:'no PixelArtFx'};
  const need=['u_blink_burst','u_ward_break','u_aegis_burst','u_ruin_rift','u_ruin_fin'];
  const has = need.every(k=>X.span(k)>0);
  const c=document.createElement('canvas'); c.width=400; c.height=300; const g=c.getContext('2d');
  let fail=null;
  const ids=['u_quake','u_blink','u_blaze','u_ward','u_aegis','u_rally','u_bloom','u_ruin',...need,'u_ruin_hit','u_ward_on','u_aegis_on','u_rally_on','u_bloom_on'];
  try{
    for(const id of ids) for(let lv=1;lv<=5;lv++) for(let a=0;a<X.span(id);a+=0.1)
      X.renderEffect(g,{id,age:a,x:200,y:200,scale:1,o:{lv, off:[0.5,-0.5,1,0,0,-1], big:lv===5, fin:true, side:lv>2},pts:[[150,190],[240,210]]});
  }catch(e){ fail=e.message; }
  return {has, fail, ok: has && !fail};
});
await b.close();
console.log(JSON.stringify({errs,R},null,2));
