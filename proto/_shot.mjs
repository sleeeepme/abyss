import { boot, install } from './_h.mjs';
const {b, pg} = await boot(); await install(pg);
await pg.evaluate(()=>{
  TH.run(1,{seed:21}); TH.floor(24); TH.immortal();
  S.hero.lv=44; S.hero.str=48;S.hero.dex=48;S.hero.vit=48;
  W.seen.forEach(r=>r.fill(1));
  ['knight','mage','paladin'].forEach((job,i)=>{
    const a=TH.ally(24,job,50); a.slot=i;
    a.x=P.x+Math.cos(i*2)*1.2; a.y=P.y+Math.sin(i*2)*1.2;
    uniqueAllyName(a,party()); S.hero.party.push(a);
    a.artCd=0;
  });
  W.enemies.slice(0,5).forEach((e,i)=>{ e.x=P.x+3+Math.cos(i)*1.3; e.y=P.y+Math.sin(i)*1.3;
    e.maxHp=e.hp=1e7; e.atkV=0; });
  W.enemies=W.enemies.slice(0,5);
  stepSim(0.6, {draw:true});
  for(let i=0;i<3;i++){ draw(); updateHUD(); }
});
await pg.waitForTimeout(250); await pg.screenshot({path:'/tmp/a1.png'});
await pg.evaluate(()=>{
  const a=party()[0];
  openAllyEquip(a,'game');
});
await pg.waitForTimeout(250); await pg.screenshot({path:'/tmp/a2.png'});
await b.close();
