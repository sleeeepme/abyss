import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root=path.resolve('proto');
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(await fs.readFile(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const page=await ctx.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
try{
await page.goto(base+'/sound-admin.html');
await test('locked audio drops events without backlog',async()=>{const r=await page.evaluate(()=>{ABYSS_AUDIO.emit('hurt');return ABYSS_AUDIO.inspect();});assert.equal(r.state,'locked');assert.equal(r.queued,0);});
await page.click('#enable');
await test('gesture starts audio; all 20 original buffers are finite and bounded',async()=>{
  const values=await page.evaluate(async()=>{
    const out=[],original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){const x=this.buffer.getChannelData(0);let peak=0,power=0,bad=false;for(const v of x){peak=Math.max(peak,Math.abs(v));power+=v*v;if(!Number.isFinite(v))bad=true;}out.push({peak,rms:Math.sqrt(power/x.length),bad,seconds:this.buffer.duration,lateRms:Math.sqrt(x.slice(Math.floor(x.length*.60),Math.floor(x.length*.85)).reduce((a,v)=>a+v*v,0)/(Math.floor(x.length*.85)-Math.floor(x.length*.60)))});return original.apply(this,args);};
    try{for(const id of Object.keys(ABYSS_AUDIO.defs)){await ABYSS_AUDIO.audition(id);await new Promise(r=>setTimeout(r,45));}}finally{AudioBufferSourceNode.prototype.start=original;ABYSS_AUDIO.stop();}return out;
  });assert.equal(values.length,20);for(const v of values){assert(!v.bad);assert(v.peak<.7&&v.rms>.008);assert(v.seconds<=1.3);}assert(values.find(v=>v.seconds>1).lateRms>.02);await fs.writeFile('/tmp/abyss-audio-signals.json',JSON.stringify(values,null,2));
});
await test('featured revision buttons play the new parry',async()=>{assert.equal(await page.locator('[data-featured]').count(),6);await page.click('[data-featured=parry]');await page.waitForFunction(()=>ABYSS_AUDIO.inspect().active.some(a=>a.id==='parry'));await page.click('#stop');});
await test('100 simultaneous hits coalesce and hurt wins',async()=>{
 const x=await page.evaluate(async()=>{const A=ABYSS_AUDIO;A.stop();A.resetStats();for(let i=0;i<100;i++)A.emit('hit');A.emit('slash');A.emit('hurt');await new Promise(r=>setTimeout(r,25));return A.inspect();});assert(x.history.some(x=>x.id==='hurt'&&x.result==='play'));assert(x.counters.peakNoise<=1);assert(x.counters.peakEvents<=2);assert(x.counters.dropped>=99);
});
await test('important cue steals lower priority voice with bounded channels',async()=>{
 const x=await page.evaluate(async()=>{const A=ABYSS_AUDIO;A.stop();A.resetStats();A.emit('magic');await new Promise(r=>setTimeout(r,35));A.emit('hurt');await new Promise(r=>setTimeout(r,30));return A.inspect();});assert.equal(x.counters.stolen,1);assert(x.active.some(a=>a.id==='hurt'));assert(x.counters.peakPulse<=2);assert(x.counters.peakNoise<=1);
});
await test('fanfare retains final cadence at short tail and yields to danger',async()=>{
 const r=await page.evaluate(async()=>{const A=ABYSS_AUDIO;A.configure({...A.settings(),tail:.5});A.resetStats();A.emit('level');await new Promise(r=>setTimeout(r,850));const playing=A.inspect().active.some(a=>a.id==='level');A.emit('hurt');await new Promise(r=>setTimeout(r,40));const result=A.inspect();A.configure(A.defaults());return {playing,result};});assert(r.playing);assert(r.result.active.some(a=>a.id==='hurt'));assert(!r.result.active.some(a=>a.id==='level'));
});
await test('distance, cooldown, mute and untrusted settings clamp',async()=>{
 const x=await page.evaluate(async()=>{const A=ABYSS_AUDIO;A.stop();A.resetStats();A.emit('ui',{distance:100});A.emit('slash');await new Promise(r=>setTimeout(r,30));A.emit('slash');await new Promise(r=>setTimeout(r,25));const before=A.inspect();A.configure({...A.settings(),enabled:false,master:99,maxEvents:99,maxStarts:-1});A.emit('hurt');return {before,after:A.inspect(),cfg:A.settings()};});assert(x.before.history.some(h=>h.why==='遠距離'));assert(x.before.history.some(h=>h.why==='同じ音の間隔'));assert.equal(x.after.active.length,0);assert.equal(x.cfg.master,.8);assert.equal(x.cfg.maxEvents,3);assert.equal(x.cfg.maxStarts,3);await page.click('[data-preset="standard"]');
});
await test('5-second crowd mix never exceeds event/pulse/noise budgets',async()=>{await page.click('[data-demo="crowd"]');await page.waitForTimeout(5300);const s=await page.evaluate(()=>ABYSS_AUDIO.inspect());assert(s.counters.peakEvents<=2);assert(s.counters.peakPulse<=2);assert(s.counters.peakNoise<=1);assert(s.counters.played>5);assert(s.counters.dropped>s.counters.played);await fs.writeFile('/tmp/abyss-audio-crowd.json',JSON.stringify(s,null,2));});
await test('mobile layout fits viewport and settings survive reload',async()=>{await page.locator('#control-master').fill('0.23');await page.reload();assert.equal(await page.evaluate(()=>ABYSS_AUDIO.settings().master),.23);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/abyss-audio-admin-mobile.png',fullPage:true});});
await page.goto(base+'/index.html');await page.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);
await page.click('#t-start');await page.fill('#nm-input','音検証');await page.click('#nm-ok');
await test('game adopts manager settings; blocked actions do not make combat sounds',async()=>{
 assert.equal(await page.evaluate(()=>ABYSS_AUDIO.settings().master),.23);
 const x=await page.evaluate(()=>{startRun(1);pauseGame(true);ABYSS_AUDIO.stop();ABYSS_AUDIO.resetStats();P.atkCd=1;const rng=RNG.state();playerAttack();return {rng,after:RNG.state(),audio:ABYSS_AUDIO.inspect()};});assert.equal(x.rng,x.after);assert.equal(x.audio.counters.requested,0);
});
await test('real attack hooks emit without audio consuming gameplay RNG',async()=>{
 const x=await page.evaluate(()=>{const A=ABYSS_AUDIO;A.stop();A.resetStats();P.atkCd=0;W.enemies=[];P.target=null;playerAttack();const queued=A.inspect().queued;const rng=RNG.state();A.emit('hurt');A.emit('parry');return {queued,rng,after:RNG.state()};});assert(x.queued>0);assert.equal(x.rng,x.after);
});
await test('parry emits and rejected consumables remain silent',async()=>{
 const x=await page.evaluate(()=>{const A=ABYSS_AUDIO;A.stop();A.resetStats();useConsum(null);const failed=A.inspect().counters.requested;feelPerfect('PARRY','#fff');return {failed,queued:A.inspect().queued};});assert.equal(x.failed,0);assert.equal(x.queued,1);
});
await test('in-game manager pauses/resumes and iframe settings propagate',async()=>{
 await page.evaluate(()=>pauseGame(false));await page.click('#abyss-audio-toggle');assert.equal(await page.evaluate(()=>_paused),true);const f=page.frameLocator('#abyss-audio-panel iframe');await f.locator('#control-master').fill('0.19');await page.waitForFunction(()=>ABYSS_AUDIO.settings().master===.19);await page.locator('#abyss-audio-panel > button').click();assert.equal(await page.evaluate(()=>_paused),false);
});
await test('muted game runs and save still works',async()=>{await page.evaluate(()=>{ABYSS_AUDIO.configure({...ABYSS_AUDIO.settings(),enabled:false});ABYSS_SAVE.request();ABYSS_SAVE.frame();});await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>ABYSS_AUDIO.inspect().active.length),0);assert.equal(await page.evaluate(()=>ABYSS_SAVE.info().failed),false);});
await test('feel regression matches the pre-audio baseline',async()=>{
 const original=await fs.readFile(path.join(root,'index.html'),'utf8');
 const clean=original.replace(/<script src="audio(?:-game)?\.js[^"]*"><\/script>/g,'');
 await page.route('**/index.html?feel-test',r=>r.fulfill({contentType:'text/html',body:clean}));
 await page.goto(base+'/feeltest.html');await page.waitForFunction(()=>document.querySelector('#result').textContent.trim().startsWith('{'));
 const before=JSON.parse(await page.locator('#result').textContent());
 await page.unroute('**/index.html?feel-test');await page.reload();await page.waitForFunction(()=>document.querySelector('#result').textContent.trim().startsWith('{'));
 const after=JSON.parse(await page.locator('#result').textContent());
 assert.deepEqual({...after,results:after.results.filter(r=>'pass' in r)},{...before,results:before.results.filter(r=>'pass' in r)});await fs.writeFile('/tmp/abyss-audio-feel-regression.json',JSON.stringify(after,null,2));
});
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:results.length,results,pageErrors:errors},null,2));
await fs.writeFile('/tmp/abyss-audio-tests.json',JSON.stringify({passed:results.length,results,pageErrors:errors},null,2));
}finally{await browser.close();server.close();}
