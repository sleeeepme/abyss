import {boot,install,done} from './_h.mjs';
import fs from 'node:fs';
const {b,pg,errs}=await boot();await install(pg);const R={};
R.integration=await pg.evaluate(()=>{
 TH.run(1,{seed:8});setScreen('game');TH.immortal();CAVE.noFlicker=true;W.seen.forEach(row=>row.fill(1));draw();
 const real=ctx,canvas=document.createElement('canvas');canvas.width=canvas.height=800;ctx=canvas.getContext('2d');
 const template=W.enemies.find(e=>!e.boss),records=[];let alphaOK=true,sourceOK=true,emissionOK=true;
 const original=feelShadeEnemyFrame;
 window.feelShadeEnemyFrame=function(e,id,face,options){
  const before=id.data.slice(),result=original(e,id,face,options);
  for(let i=0;i<before.length;i++)if(id.data[i]!==before[i])sourceOK=false;
  for(let i=3;i<before.length;i+=4)if(result.data[i]!==before[i])alphaOK=false;
  if(options?.emissive)for(let p=0;p<options.emissive.length;p++)if(options.emissive[p])for(let c=0;c<3;c++)if(before[p*4+c]!==result.data[p*4+c])emissionOK=false;
  return result;
 };
 const fixtures=[];
 try{
  for(const fam of FAMILY)for(const arch of ARCH){
   const e={...template,fam,arch,x:P.x+1,y:P.y,hit:0,dead:false,boss:false,looksBoss:false,uniqueBoss:undefined,moss:undefined,rage:false,vx:0,vy:0,_cg:1,_cf:1};
   const cave=CAVE.enemy(e,200,200,TS*.32);
   const image=CharacterArt.image(CharacterArt.enemyKey(e));
   const drawn=cave||(image?drawFeelSpriteImage(image,200,200,TS,e,1,0):drawFeelEnemyShape(e,200,200,TS*.32));
   records.push({key:fam.id+'/'+arch.id,drawn,route:cave?'cave':image?'image':'shape'});fixtures.push(e);
  }
  for(const moss of ['stone','sump','root','ruin','furnace','pale']){
   const e={...template,x:P.x+1,y:P.y,moss,dead:false,hit:0,boss:false,uniqueBoss:undefined};
   records.push({key:'moss/'+moss,drawn:CAVE.enemy(e,200,200,TS*.32),route:'cave'});
  }
  for(const depth of [5,10,15,20,25,30,35,40,45,50]){
   const e={...template,x:P.x+1,y:P.y,uniqueBoss:depth,boss:true,r:1.2,dead:false,hit:0,moss:undefined,form2:false};
   const drawn=CAVE.enemy(e,200,200,TS*1.2)||drawFeelEnemyShape(e,200,200,TS*1.2);
   records.push({key:'boss/'+depth,drawn,route:'boss'});
   if(depth===10){e.form2=true;records.push({key:'boss/10/form1',drawn:CAVE.enemy(e,200,200,TS*1.2),route:'boss'});}
  }
  const image=CharacterArt.image('ash-hound');
  const fallback={...template,x:P.x+1,y:P.y,hit:0,dead:false,moss:undefined};
  records.push({key:'image/fallback',drawn:drawFeelSpriteImage(image,200,200,TS,fallback,1,0),route:'image'});
  const shape={...fallback};records.push({key:'shape/fallback',drawn:drawFeelEnemyShape(shape,200,200,TS*.4),route:'shape'});
  const statsBefore={...FEEL_ENEMY_SURFACE.stats},times=[];
  for(let frame=0;frame<12;frame++){
   const t=performance.now();for(const e of fixtures.slice(0,32)){e._cg+=.25;CAVE.enemy(e,200,200,TS*.32);}times.push(performance.now()-t);
  }
  const statsAfter={...FEEL_ENEMY_SURFACE.stats};
  const ally={hpNow:10,arch:template.arch,fam:template.fam};
  return {records,alphaOK,sourceOK,emissionOK,heroExcluded:!feelEnemySurfaceOn(P),allyExcluded:!feelEnemySurfaceOn(ally),statsBefore,statsAfter,
   mixed32DrawMs:times,allDrawn:records.every(r=>r.drawn),cacheBounded:statsAfter.entries<=FEEL_ENEMY_SURFACE.maxFrames&&statsAfter.pixels<=FEEL_ENEMY_SURFACE.maxPixels};
 }finally{window.feelShadeEnemyFrame=original;ctx=real;}
});
R.mirrorAndEmission=await pg.evaluate(()=>{
 const old=CAVE.surfaceLighting,template=W.enemies.find(e=>!e.boss),id=new ImageData(5,5);
 for(let y=1;y<4;y++)for(let x=1;x<4;x++){const i=(y*5+x)*4;id.data.set([80+x*35,60+y*20,40,255],i)}
 const e={...template,x:30,y:30,boss:true,dead:false,hit:0,moss:undefined};
 try{
  CAVE.surfaceLighting=()=>({ambient:.38,lights:[{x:28,y:30,z:.8,radius:7,power:2,color:[255,255,255]}]});
  const a=feelShadeEnemyFrame(e,id,1,{pixelTiles:1/16}).data.slice();
  CAVE.surfaceLighting=()=>({ambient:.38,lights:[{x:32,y:30,z:.8,radius:7,power:2,color:[255,255,255]}]});
  const mirrored=feelShadeEnemyFrame(e,id,-1,{pixelTiles:1/16}).data.slice();
  const same=a.every((v,i)=>v===mirrored[i]);
  const emissive=new Uint8Array(25);emissive[12]=1;
  const em=feelShadeEnemyFrame(e,id,-1,{pixelTiles:1/16,emissive});
  const preserved=[0,1,2].every(c=>em.data[12*4+c]===id.data[12*4+c]);
  e.hit=.1;const flash=feelShadeEnemyFrame(e,id)===id;e.hit=0;e.dead=true;const death=feelShadeEnemyFrame(e,id)===id;
  return {same,preserved,flash,death};
 }finally{CAVE.surfaceLighting=old;}
});
R.runtimeControls=await pg.evaluate(()=>{
 const e=W.enemies[0];const before=JSON.stringify({hp:e.hp,maxHp:e.maxHp,ms:e.ms,atk:e.atk,x:e.x,y:e.y,hero:S.hero.hpNow});
 FEEL_ENEMY_SURFACE.on=false;const off=!feelEnemySurfaceOn(e);FEEL_ENEMY_SURFACE.on=true;
 draw();const after=JSON.stringify({hp:e.hp,maxHp:e.maxHp,ms:e.ms,atk:e.atk,x:e.x,y:e.y,hero:S.hero.hpNow});
 return {off,simulationUntouched:before===after,drawErrors:_feelDrawFails};
});
R.wallOcclusion=await pg.evaluate(()=>{
 const room=W.fl.rooms[0];P.x=room.x+1.5;P.y=room.y+1.5;
 CAVE.noFlicker=true;draw();const samples=[],field=CAVE._G();
 for(let i=0;i<32;i++){
  const angle=i/32*Math.PI*2;let hit=0;
  for(let d=.5;d<3;d+=.125){const x=Math.floor((P.x+Math.cos(angle)*d)*16),y=Math.floor((P.y+Math.sin(angle)*d)*16);if(field.code[y*field.PW+x]){hit=d;break;}}
  if(!hit)continue;
  const x=P.x+Math.cos(angle)*(hit+1),y=P.y+Math.sin(angle)*(hit+1);
  const light=CAVE.surfaceLighting(x,y);if(!light)continue;
  const hero=light.lights.some(l=>l.color[0]===255&&l.color[1]===230);
  samples.push({angle,hero});
 }
 return {samples,blocked:samples.length>0&&samples.every(s=>!s.hero)};
});
fs.mkdirSync('output/enemy-surface-lighting',{recursive:true});
if(process.argv.includes('--screenshot')){
 await pg.evaluate(()=>{setScreen('game');FEEL_ENEMY_SURFACE.on=true;W.enemies=W.enemies.filter(e=>!e.dead);P.invuln=1e9;draw();});
 await pg.screenshot({path:'output/enemy-surface-lighting/game.png'});
}
fs.mkdirSync('output/enemy-surface-lighting',{recursive:true});fs.writeFileSync('output/enemy-surface-lighting/runtime-checks.json',JSON.stringify({errs,R},null,2));
await done(b,errs,R);
if(errs.length||!R.integration.allDrawn||!R.integration.alphaOK||!R.integration.sourceOK||!R.integration.emissionOK||!Object.values(R.mirrorAndEmission).every(Boolean)||!R.runtimeControls.simulationUntouched||!R.wallOcclusion.blocked)process.exitCode=1;
