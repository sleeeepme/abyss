import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(''+e.message));
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(300);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R=await pg.evaluate(()=>{
  S.upg={}; S.hero=newHero(); startRun(1);
  let w=null; for(let i=0;i<9000&&!w;i++){ const x=genItem(20,0); if(x.base==='sword') w=x; }
  w.ident=true; w.aff=[]; S.hero.equip.weapon=w;
  const plain=stats(S.hero);
  const plainParts=playerParts(plain,1);
  // 炎の接尾辞を付ける
  w.aff=[{t:'s',id:'flame',nm:'業火',stat:'fire',v:30}];
  const fiery=stats(S.hero);
  const fieryParts=playerParts(fiery,1);
  // 炎に弱い敵 / 強い敵で差が出るか
  const hit=(st,famId)=>{ const fam=FAMILY.find(f=>f.id===famId);
    const t={lv:10,def:0,res:fam.res,st:{},bu:{}};
    return resolveDamage(t, playerParts(st,1), 10, {noVariance:true}).total; };
  // 属性耐性の接尾辞がプレイヤー側で効くか
  S.hero.equip.armor={uid:9,base:'chain',nm:'鎖帷子',slot:'armor',ilvl:10,rar:1,ident:true,
    def:8,spd:1,dur:100,durMax:100,aff:[{t:'s',id:'rFire',nm:'耐火',stat:'resFire',v:40}]};
  const withRes=stats(S.hero);
  const tgt=(res)=>{const t={isPlayer:true,lv:5,def:0,res,st:{},bu:{}};
    return resolveDamage(t,[{type:'fire',amount:100}],5,{noVariance:true}).total;};
  return {
    plainPartTypes: plainParts.map(p=>p.type),
    fieryPartTypes: fieryParts.map(p=>p.type),
    fieryAddsFire: fieryParts.some(p=>p.type==='fire'&&p.amount===30),
    vsFlameFamily: hit(fiery,'flame'), vsFrostFamily: hit(fiery,'frost'),
    playerFireRes: withRes.res.fire,
    dmgNoRes: tgt({}), dmgWithRes: tgt({fire:withRes.res.fire}),
  };
});
await b.close(); console.log(JSON.stringify({errs,R},null,2));
