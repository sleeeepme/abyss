// 旧セーブの個別位相、体数変更、回転中の間隔と主人公より前面の描画を検証。
import { boot, install, done } from './_h.mjs';
const {b,pg,errs}=await boot(); await install(pg);
const R={};
R.orbit=await pg.evaluate(()=>{
  TH.run(1,{seed:7}); W.enemies=[]; S.hero.equip.weapon=null;
  const a=makeAlly(1,S.hero); a.equip.weapon=null; a.x=P.x+3; a.y=P.y;
  a.hpNow=allyStats(a).maxHp; S.hero.party=[a];
  let minGap=Infinity,maxRadiusError=0,counts=true;
  for(const h of [S.hero,a]){
    // この旧データは従来の個別位相+等分角では3体が同じ座標になる。
    h.kins=Array.from({length:3},(_,i)=>({ang:-i*Math.PI*2/3,cd:999,look:KIN_LOOKS[i]}));
    for(const n of [3,2,1,2,3]){
      h.boons=Array.from({length:n},()=>({id:'kin',rar:'common'}));
      for(let frame=0;frame<240;frame++){
        tickBoonTimers(h,1/60,h===S.hero);
        counts=counts&&h.kins.length===n;
        const hx=h===S.hero?P.x:h.x,hy=h===S.hero?P.y:h.y;
        for(const k of h.kins)maxRadiusError=Math.max(maxRadiusError,Math.abs(Math.hypot(k.x-hx,k.y-hy+.2)-1.05));
        for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
          minGap=Math.min(minGap,Math.hypot(h.kins[i].x-h.kins[j].x,h.kins[i].y-h.kins[j].y));
      }
    }
  }
  return {minGap,maxRadiusError,counts,ok:counts&&minGap>1.8&&maxRadiusError<1e-8};
});
await pg.waitForFunction(()=>['wisp','bat','owl'].every(n=>CharacterArt.image('kin-'+n)));
R.layer=await pg.evaluate(()=>{
  // 主人公と同座標でも、眷属を後から描く。実際のdraw()経路を監視する。
  S.hero.party=[];
  for(const k of S.hero.kins){k.x=P.x;k.y=P.y;}
  const calls=[],put=CharacterArt.put,hero=drawFeelCharacterSprite,light=drawPlayerLight;
  CharacterArt.put=function(id,...args){if(id.startsWith('kin-'))calls.push(id);return put(id,...args);};
  drawFeelCharacterSprite=function(...args){if(args[4]===P)calls.push('hero');return hero(...args);};
  drawPlayerLight=function(...args){calls.push('light');return light(...args);};
  try{draw();}finally{CharacterArt.put=put;drawFeelCharacterSprite=hero;drawPlayerLight=light;}
  const kinIndices=calls.flatMap((v,i)=>v.startsWith('kin-')?[i]:[]);
  return {calls,ok:kinIndices.length===3&&calls.includes('hero')&&calls.includes('light')
    &&kinIndices.every(i=>i>calls.indexOf('hero')&&i<calls.indexOf('light'))};
});
await done(b,errs,R);
if(errs.length||Object.values(R).some(r=>!r.ok))process.exitCode=1;
