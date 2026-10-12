// Instrument-level WAVs and structural GB-channel checks; browser tests cover mixing.
import vm from 'node:vm';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const here=new URL('./',import.meta.url);
function sandbox(source){
  const buffers=[];
  const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},cancelScheduledValues(){},linearRampToValueAtTime(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(){},stop(){}});
  class Context{
    constructor(){this.state='running';this.currentTime=0;this.destination=node();}
    createGain(){return node();}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}createBufferSource(){return node();}
    createBuffer(ch,n,sr){const data=new Float32Array(n),b={duration:n/sr,copyToChannel(x){data.set(x);},data,sr};buffers.push(b);return b;}
  }
  const env={setTimeout,clearTimeout,Float32Array,document:{hidden:false,addEventListener(){}},addEventListener(){},localStorage:{getItem(){return null;},setItem(){}}};
  env.window={AudioContext:Context};vm.createContext(env);
  source=source.replace('window.ABYSS_AUDIO={','window.__recipes=typeof textures!=="undefined"?textures:null;window.ABYSS_AUDIO={');
  vm.runInContext(source,env);return {api:env.window.ABYSS_AUDIO,recipes:env.window.__recipes,buffers};
}
const current=sandbox(await fs.readFile(new URL('../../proto/audio.js',here),'utf8'));
const old=sandbox(await fs.readFile(new URL('audio-v1-baseline.js',here),'utf8'));
await fs.mkdir(new URL('raw/',here),{recursive:true});
const hash=b=>crypto.createHash('sha256').update(Buffer.from(b.data.buffer)).digest('hex');
const results=[];
for(const [id,d] of Object.entries(current.api.defs)){
  const recipe=current.recipes[id];
  if(recipe){
    assert.equal(recipe.p?.length||0,d.pulse,id+' pulse budget');assert.equal(recipe.n?.length?1:0,d.noise,id+' noise budget');
    for(const track of [...(recipe.p||[]),recipe.n||[]])for(let i=0;i<track.length;i++){const s=track[i];assert(s[0]+s[1]<=d.length+.00001,id+' duration');if(i)assert(track[i-1][0]+track[i-1][1]<=s[0]+.00001,id+' channel overlap');}
    for(const s of recipe.n||[])assert([1,2,3,4,5,6,7].includes(s[2])&&s[3]>=0&&s[3]<=13,'NR43');
  }
  await current.api.audition(id);await new Promise(r=>setTimeout(r,25));const b=current.buffers.at(-1);
  assert(b);const bytes=Buffer.alloc(44+b.data.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(b.sr,24);bytes.writeUInt32LE(b.sr*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  let peak=0,power=0;for(let i=0;i<b.data.length;i++){const x=b.data[i];assert(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));power+=x*x;bytes.writeInt16LE(Math.round(x*32767),44+i*2);}assert(peak<1);
  if(id==='ui'||id==='back'){await old.api.audition(id);await new Promise(r=>setTimeout(r,25));assert.equal(hash(b),hash(old.buffers.at(-1)),id+' UI unchanged');}
  await fs.writeFile(new URL('raw/'+id+'.wav',here),bytes);
  results.push({id,seconds:b.duration,peak,rms:Math.sqrt(power/b.data.length),sha256:hash(b)});
}
current.api.stop();old.api.stop();
const report={checks:'20 buffers finite/unclipped; GB track allocation and legal noise clocks; UI/back bit-identical to v1',files:results,scope:'Raw instruments before the game mixer; subjective listening and real GB hardware not verified.'};
await fs.writeFile(new URL('instrument-quality.json',here),JSON.stringify(report,null,2)+'\n');console.log(report.checks);
