// 拠点の原画座標、ドット倍率、通行判定と出発/ワープの実移動。
import {boot,install} from './_h.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const {b,pg,errs}=await boot();const out=path.resolve('output/hub-world-alignment/quality');
await mkdir(out,{recursive:true});const report={};
try{
 await install(pg);await pg.waitForFunction(()=>HUB_BG.ready);
 await pg.evaluate(()=>{S.hero.party=['knight','mage','priest'].map(j=>TH.ally(8,j,8));el('hub-avatars').dataset.hubKey='';setScreen('town');stopHubWander();});
 report.viewports=[];
 for(const [width,height] of [[390,844],[844,390],[1920,1080],[2560,1080],[390,844]]){
  await pg.setViewportSize({width,height});await pg.waitForTimeout(120);
  const v=await pg.evaluate(()=>{
   const br=el('hubbg').getBoundingClientRect(),sc=br.height/306;
   const points=[...document.querySelectorAll('.hub-ava')].map(btn=>{
    const r=btn.getBoundingClientRect(),im=btn.querySelector('img'),ir=im.getBoundingClientRect(),p=hubAvatarPoint(btn);
    return {p,foot:[(r.left+r.width/2-br.left)/sc,(r.top+r.height*.875-br.top)/sc],dot:ir.width/16,sc,safe:hubCanStand(p.x,p.y)};
   });
   return {size:[innerWidth,innerHeight],points};
  });
  for(const p of v.points){assert(p.safe);assert(Math.abs(p.dot-p.sc)<.02);assert(Math.abs(p.foot[0]-p.p.x)<.03);assert(Math.abs(p.foot[1]-p.p.y)<.03);}report.viewports.push(v);
  if(width===390||width===1920)await pg.screenshot({path:path.join(out,`aligned-${width}.png`)});
 }
 // 背景のドットに移動位置まで丸めると、12px/秒の歩行が12段階/秒になる。
 report.smoothMotion=await pg.evaluate(()=>{
  stopHubWander();const btn=document.querySelector('.hub-ava');const old=hubAvatarPoint(btn);
  hubPlaceAvatar(btn,{x:260,y:170});hubMoveAvatar(btn,{x:272,y:170},1000);
  const start=_hubMoves.get(btn).start,positions=[];
  for(let i=0;i<=60;i++){
   cancelAnimationFrame(_hubMoveRaf);hubMoveTick(start+i*1000/60);positions.push(+btn.dataset.px);
  }
  stopHubWander();hubPlaceAvatar(btn,{x:260.37,y:170.28});
  hubMoveAvatar(btn,{x:270,y:150},600);const continuous=_hubMoves.get(btn).path[0];
  stopHubWander();hubPlaceAvatar(btn,old);
  return {unique:new Set(positions).size,held:positions.slice(1).filter((x,i)=>x===positions[i]).length,
    maxStep:Math.max(...positions.slice(1).map((x,i)=>Math.abs(x-positions[i]))),continuous,
    hopTiming:getComputedStyle(btn.querySelector('.hub-ava-art')).animationTimingFunction};
 });
 assert.equal(report.smoothMotion.unique,61);assert.equal(report.smoothMotion.held,0);
 assert(report.smoothMotion.maxStep<.201);
 assert.deepEqual(report.smoothMotion.continuous,{x:260.37,y:170.28});
 assert.equal(report.smoothMotion.hopTiming,'ease-in-out');
 report.collision=await pg.evaluate(()=>{
  const blocked=[[330,175],[206,165],[239,145],[306,145],[239,194],[306,194],[271,80],[352,150],[420,90]];
  if(blocked.some(([x,y])=>hubCanStand(x,y)))throw Error('water/building/cliff/pillar accepted');
  if(hubFindPath(HUB_SCENE.center,{x:330,y:175}).length)throw Error('blocked target accepted');
  const from={x:228,y:165},to={x:254,y:131};
  if(hubSegmentClear(from,to))throw Error('test does not cross pillar');
  const detour=hubFindPath(from,to);
  if(detour.length<3)throw Error('no detour around pillar');
  for(let i=1;i<detour.length;i++)if(!hubSegmentClear(detour[i-1],detour[i]))throw Error('detour clips obstacle');
  for(let i=0;i<120;i++){
   const a=hubRandPoint(),z=hubRandPoint([],a),p=hubFindPath(a,z);
   if(!p.length||p.slice(1).some((q,j)=>!hubSegmentClear(p[j],q)))throw Error('unsafe wander path');
  }
  return {blocked:blocked.length,randomPaths:120,detour};
 });
 // 実際のrAF移動を毎フレーム記録し、足元の侵入と演出の完了を検査。
 await pg.evaluate(()=>{
  window.hubObserved=[];window.hubObserve=true;
  const observe=()=>{if(!hubObserve)return;hubObserved.push([...document.querySelectorAll('.hub-ava')].map(b=>{const p=hubAvatarPoint(b);return {...p,safe:hubCanStand(p.x,p.y),opacity:getComputedStyle(b).opacity};}));requestAnimationFrame(observe);};observe();
  HUB_ANIM_INSTANT=false;window.hubFinished=0;playHubDeparture(()=>{hubFinished++;});
  if([...document.querySelectorAll('.hub-ava')].some(b=>getComputedStyle(b).pointerEvents!=='none'))throw Error('departure avatars still clickable');
 });
 await pg.waitForTimeout(900);await pg.screenshot({path:path.join(out,'departure-stairs.png')});
 await pg.setViewportSize({width:1920,height:1080});await pg.waitForTimeout(700);await pg.screenshot({path:path.join(out,'departure-wide.png')});
 await pg.waitForFunction(()=>hubFinished===1);
 report.departure=await pg.evaluate(()=>{hubObserve=false;return {samples:hubObserved.length,allSafe:hubObserved.every(f=>f.every(p=>p.safe)),arrived:hubObserved[0].map((_,i)=>hubObserved.some(f=>f[i].x===270&&f[i].y===100)),finished:hubFinished};});
 assert(report.departure.allSafe);assert(report.departure.arrived.every(Boolean));assert.equal(report.departure.finished,1);
 await pg.evaluate(()=>{window.hubFinished=0;playHubWarp(()=>{hubFinished++;});});await pg.waitForTimeout(900);
 report.warp=await pg.evaluate(()=>{
  const br=el('hubbg').getBoundingClientRect(),lo=el('hub-warp-lo').getBoundingClientRect();
  const points=[...document.querySelectorAll('.hub-ava')].map(hubAvatarPoint);
  return {rects:[br.left,br.top,br.width,br.height,lo.left,lo.top,lo.width,lo.height],points,center:HUB_SCENE.center};
 });
 for(let i=0;i<4;i++)assert(Math.abs(report.warp.rects[i]-report.warp.rects[i+4])<.05);
 for(const p of report.warp.points)assert(Math.hypot(p.x-271,p.y-170)<11);
 await pg.screenshot({path:path.join(out,'warp-center.png')});await pg.waitForFunction(()=>hubFinished===1);
 await pg.evaluate(()=>{window.hubFinished=0;playHubDeparture(()=>hubFinished++);setScreen('shop');});await pg.waitForTimeout(3100);
 assert.equal(await pg.evaluate(()=>hubFinished),0);report.cancelledDeparture=true;
 await pg.evaluate(()=>{setScreen('town');stopHubWander();});
 await pg.locator('[data-hubava="hero"]').tap();assert.equal(await pg.evaluate(()=>S.screen),'char');report.avatarTap=true;
 await pg.evaluate(()=>setScreen('town'));await pg.emulateMedia({reducedMotion:'reduce'});
 report.reduced=await pg.evaluate(()=>{stopHubWander();let n=0;playHubDeparture(()=>n++);playHubWarp(()=>n++);return {callbacks:n,moves:_hubMoves.size,intro:playHubIntro()};});
 assert.deepEqual(report.reduced,{callbacks:2,moves:0,intro:false});
 const feel=await b.newPage();await feel.goto('file://'+path.resolve('proto/feeltest.html'));await feel.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('{'));
 const after=JSON.parse(await feel.locator('#result').textContent());await writeFile(path.join(out,'feel-after.json'),JSON.stringify(after,null,2));
 const fail=r=>r.results.filter(x=>x.pass===false).map(x=>x.name);
 assert.deepEqual(after.errors,[]);report.feel={passed:after.results.filter(x=>x.pass).length,failures:fail(after),baselineCompared:false};
 // 変更前結果を渡したときだけ比較。単独実行でも既存outputへの依存は不要。
 const baselineArg=process.argv.indexOf('--feel-baseline');
 if(baselineArg>=0){
  const before=JSON.parse(await readFile(process.argv[baselineArg+1],'utf8'));
  assert.deepEqual(fail(after),fail(before));report.feel.baselineCompared=true;report.feel.newFailures=0;
 }
 assert.deepEqual(errs,[]);report.errors=errs;await writeFile(path.join(out,'integration-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await b.close();}
