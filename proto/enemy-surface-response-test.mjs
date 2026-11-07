/* Light-response regression: keep artwork/position fixed and turn only the lamp. */
import {boot,install} from './_h.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const {b,pg,errs}=await boot();
const versions=[['after',path.resolve('proto/index.html')]];
const baseline=process.argv.find(a=>a.startsWith('--baseline='))?.split('=')[1];
if(baseline)versions.unshift(['before',path.join(baseline,'index.html')]);
const report={},scenes={};
try{
 for(const [version,url] of versions){
  await pg.goto('file://'+url);await pg.waitForTimeout(350);await install(pg);
  report[version]=await pg.evaluate((referenceFrames)=>{
   TH.run(1,{seed:8});TH.immortal();setScreen('game');CAVE.noFlicker=true;draw();
   const original=feelShadeEnemyFrame,environment=CAVE.surfaceLighting,real=ctx;
   const oldFacing=[FEEL.lightX,FEEL.lightY],canvas=document.createElement('canvas');canvas.width=canvas.height=800;ctx=canvas.getContext('2d');
   const base=W.enemies.find(e=>!e.boss),result=[];let captured;
   const luminance=(a,i)=>.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];
   try{
    for(const archId of ['rush','range','turret','swarm']){
     captured=null;window.feelShadeEnemyFrame=(e,id,face,o)=>{captured={w:id.width,h:id.height,rgba:id.data.slice(),face,options:{...o,emissive:o.emissive?.slice()}};return id};
     const e={...base,x:P.x+2,y:P.y,arch:ARCH.find(a=>a.id===archId),fam:FAMILY.find(f=>f.id==='beast'),moss:undefined,boss:false,dead:false,hit:0,_cg:.345,_cf:1};
     CAVE.enemy(e,innerWidth/2+2*TS,innerHeight/2,TS*.32);window.feelShadeEnemyFrame=original;
     if(!captured)throw Error('No actual source frame for '+archId);
     // Compare identical authored pixels, not two different timestamps of idle.
     const reference=referenceFrames?.find(r=>r.key==='beast/'+archId);
     if(reference)captured={w:reference.size[0],h:reference.size[1],rgba:Uint8ClampedArray.from(reference.source),face:reference.face,
      options:{anchor:reference.anchor,pixelTiles:reference.pixelTiles,bounds:reference.bounds,emissive:Uint8Array.from(reference.emissive)}};
     const {w,h,rgba,face,options}=captured,id=new ImageData(rgba,w,h);e.boss=true;
     const C=FEEL_ENEMY_SURFACE;
     options.worldX=e.x;options.worldY=e.y;
     function sample(headingX,distance=2,side=null){
      e.x=P.x+distance;options.worldX=e.x;
      const x=side==null?P.x:e.x+side*distance;
      CAVE.surfaceLighting=()=>({ambient:C.ambient??.38,lights:[{kind:side==null?'hero':'fixture',x,y:e.y,z:.85,radius:7.4,power:(C.keyPower??2.1)*Math.pow(1-distance/7.4,.7),color:[255,230,195]}]});
      FEEL.lightX=headingX;FEEL.lightY=0;
      return Array.from(original(e,id,face,options).data);
     }
     const toward=sample(1),away=sample(-1),left=sample(1,2,-1),right=sample(1,2,1);
     const nearToward=sample(1,.25),nearAway=sample(-1,.25);
     let count=0,front=0,back=0,turnDelta=0,oppositeDelta=0,nearDelta=0,alphaExact=true,glowExact=true;
     for(let p=0;p<w*h;p++){
      const i=p*4;
      for(const a of [toward,away,left,right,nearToward,nearAway])if(a[i+3]!==rgba[i+3])alphaExact=false;
      if(options.emissive?.[p]){for(const a of [toward,away])for(let c=0;c<3;c++)if(a[i+c]!==rgba[i+c])glowExact=false;continue;}
      if(!rgba[i+3]||luminance(rgba,i)<25)continue;
      count++;front+=luminance(toward,i);back+=luminance(away,i);
      for(let c=0;c<3;c++){turnDelta+=Math.abs(toward[i+c]-away[i+c]);oppositeDelta+=Math.abs(left[i+c]-right[i+c]);nearDelta+=Math.abs(nearToward[i+c]-nearAway[i+c]);}
     }
     result.push({key:'beast/'+archId,size:[w,h],face,anchor:options.anchor,pixelTiles:options.pixelTiles,bounds:options.bounds,emissive:Array.from(options.emissive||[]),bodyPixels:count,towardLuma:front/count,awayLuma:back/count,
      towardAwayRatio:front/Math.max(1,back),turnMeanRGBDelta:turnDelta/count/3,oppositeMeanRGBDelta:oppositeDelta/count/3,nearMeanRGBDelta:nearDelta/count/3,
      alphaExact,glowExact,source:Array.from(rgba),toward,away,left,right});
    }
    return result;
   }finally{ctx=real;window.feelShadeEnemyFrame=original;CAVE.surfaceLighting=environment;[FEEL.lightX,FEEL.lightY]=oldFacing;}
  },report.before||null);
  scenes[version]=await pg.evaluate(()=>{
   // End-to-end: real cave light sources + actual CAVE.enemy drawing, no light mock.
   draw();const base=W.enemies.find(e=>!e.boss);let position;
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=P.x+Math.cos(a)*1.8,y=P.y+Math.sin(a)*1.8;
    if(CAVE.surfaceLighting(x,y)?.lights.some(l=>l.color[0]===255&&l.color[1]===230)){position={x,y,a};break;}}
   if(!position)throw Error('No unoccluded real lamp sample');
   const e={...base,...position,arch:ARCH.find(a=>a.id==='rush'),fam:FAMILY.find(f=>f.id==='beast'),moss:undefined,boss:false,hit:0,dead:false,_cf:1,vx:0,vy:0};
   const old=ctx,canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;ctx=canvas.getContext('2d');
   const saved=[FEEL.lightX,FEEL.lightY],clock=performance.now,frozen=performance.now();performance.now=()=>frozen;
   const sx=innerWidth/2+(e.x-P.x)*TS,sy=innerHeight/2+(e.y-P.y)*TS,images=[],powers=[];
   try{
    for(const sign of [1,-1]){FEEL.lightX=Math.cos(position.a)*sign;FEEL.lightY=Math.sin(position.a)*sign;e._cg=.345;ctx.clearRect(0,0,canvas.width,canvas.height);
     CAVE.enemy(e,sx,sy,TS*.32);images.push(ctx.getImageData(Math.floor(sx-TS),Math.floor(sy-TS),TS*2,TS*2).data);
     powers.push(feelSurfaceEnvironment(e).lights.filter(l=>l.color[0]===255&&l.color[1]===230).reduce((sum,l)=>sum+l.power,0));}
    let delta=0,count=0;for(let i=0;i<images[0].length;i+=4){if(!images[0][i+3]&&!images[1][i+3])continue;count++;for(let c=0;c<3;c++)delta+=Math.abs(images[0][i+c]-images[1][i+c]);}
    return {nativeDrawMeanRGBDelta:delta/Math.max(1,count)/3,heroPower:powers};
   }finally{ctx=old;[FEEL.lightX,FEEL.lightY]=saved;performance.now=clock;}
  });
 }
 fs.mkdirSync('output/enemy-surface-response',{recursive:true});
 fs.writeFileSync('output/enemy-surface-response/response-frames.json',JSON.stringify(report));
 const summary=Object.fromEntries(Object.entries(report).map(([version,rows])=>[version,rows.map(({source,toward,away,left,right,emissive,anchor,bounds,...metrics})=>metrics)]));
 fs.writeFileSync('output/enemy-surface-response/response-checks.json',JSON.stringify({errs,scenes,...summary},null,2));
 console.log(JSON.stringify({errs,scenes,...summary},null,2));
 assert.equal(errs.length,0);
 assert.ok(scenes.after.nativeDrawMeanRGBDelta>=8,'the real cave renderer must respond to turning the actual lamp');
 if(report.before)for(const old of report.before)assert.deepEqual(report.after.find(r=>r.key===old.key).source,old.source,'comparison must use identical artwork');
 for(const r of report.after){
  assert.ok(r.alphaExact&&r.glowExact,r.key+' must preserve alpha/glow');
  assert.ok(r.towardAwayRatio>=1.2,r.key+' must visibly respond when the lamp turns');
  assert.ok(r.turnMeanRGBDelta>=8,r.key+' must show a visible body color change');
  assert.ok(r.nearMeanRGBDelta<3,r.key+' close-range safety light must remain readable');
 }
}finally{await b.close();}
