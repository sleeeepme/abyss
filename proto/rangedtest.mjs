import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(''+e.message));
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(300);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R=await pg.evaluate(async ()=>{
  const test=async(baseId)=>{
    S.upg={atk:8}; S.hero=newHero(); startRun(1);
    let w=null; for(let i=0;i<6000&&!w;i++){ const x=genItem(25,0); if(x.base===baseId) w=x; }
    w.ident=true; w.aff=[]; S.hero.equip.weapon=w;
    const st=stats(S.hero);
    W.enemies=[]; W.fx=[];
    const room=W.fl.rooms[0]; P.x=room.cx+0.5; P.y=room.cy+0.5;
    // 射程の 7 割の距離に敵を置く
    const d=st.range*0.7;
    const e={x:P.x+d,y:P.y,lv:1,elite:false,arch:ARCH[3],aff:[],dead:false,
             maxHp:99999,hp:99999,def:0,atkV:0,ms:0,r:0.34,state:'idle',t:0,cd:99,vx:0,vy:0,hit:0,tele:0,name:'的'};
    W.enemies.push(e);
    const hp0=e.hp;
    await new Promise(r=>setTimeout(r,900));
    return {range:+st.range.toFixed(2), dist:+d.toFixed(2), damaged:e.hp<hp0,
            dmgDealt:Math.round(hp0-e.hp), proj:st.proj||'melee'};
  };
  return {bow:await test('bow'), staff:await test('staff'), great:await test('great'), dagger:await test('dagger')};
});
// 杖の貫通
const pierce=await pg.evaluate(async ()=>{
  S.upg={atk:8}; S.hero=newHero(); startRun(1);
  let w=null; for(let i=0;i<6000&&!w;i++){ const x=genItem(25,0); if(x.base==='staff') w=x; }
  w.ident=true; S.hero.equip.weapon=w;
  W.enemies=[]; W.fx=[];
  const room=W.fl.rooms[0]; P.x=room.cx+0.5; P.y=room.cy+0.5;
  const mk=(dx)=>({x:P.x+dx,y:P.y,lv:1,elite:false,arch:ARCH[3],aff:[],dead:false,
    maxHp:99999,hp:99999,def:0,atkV:0,ms:0,r:0.34,state:'idle',t:0,cd:99,vx:0,vy:0,hit:0,tele:0,name:'的'});
  const a=mk(1.6), b2=mk(2.6), c=mk(3.4);
  W.enemies.push(a,b2,c);
  P.atkCd=0; playerAttack();
  await new Promise(r=>setTimeout(r,600));
  return {first:a.hp<99999, second:b2.hp<99999, third:c.hp<99999};
});
await b.close(); console.log(JSON.stringify({errs,R,pierce},null,2));
