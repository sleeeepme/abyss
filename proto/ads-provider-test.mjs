import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const window={};
vm.runInNewContext(fs.readFileSync('proto/ads.js','utf8'),{window,AbortController,setTimeout,clearTimeout});
const ads=window.ABYSS_ADS;
const status=async p=>(await p).status;
assert.equal(await status(ads.requestRewarded('heal')),'unavailable');
for(const result of ['rewarded','cancelled','unavailable','error','invalid']){
  ads.setProvider({name:'test',requestRewarded:()=>({status:result})});
  assert.equal(await status(ads.requestRewarded('heal')),result==='invalid'?'error':result);
}
for(const requestRewarded of [()=>{throw Error('SDK failure');},()=>Promise.reject(Error('network')),()=>true]){
  ads.setProvider({name:'test',requestRewarded});
  assert.equal(await status(ads.requestRewarded('heal')),'error');
}
let finish, signal, placement;
ads.setProvider({name:'test',requestRewarded:args=>{({signal,placement}=args);return new Promise(r=>finish=r);}});
const first=ads.requestRewarded('revive');
assert.equal(placement,'revive');
assert.equal(ads.busy,true);
assert.throws(()=>ads.setProvider(null));
assert.equal(await status(ads.requestRewarded('heal')),'busy');
ads.cancel();
assert.equal(await status(first),'cancelled');
assert.equal(signal.aborted,true);
const second=ads.requestRewarded('inherit');
const finishSecond=finish;
finishSecond({status:'rewarded'});
assert.equal(await status(second),'rewarded');
assert.equal(ads.busy,false);
const timed=ads.requestRewarded('heal',{timeoutMs:5});
const late=finish;
assert.equal(await status(timed),'timeout');
assert.equal(signal.aborted,true);
const next=ads.requestRewarded('gacha');
late({status:'rewarded'});
await Promise.resolve();
assert.equal(ads.busy,true);
finish({status:'rewarded'});
assert.equal(await status(next),'rewarded');
console.log('Ad provider lifecycle checks passed');
