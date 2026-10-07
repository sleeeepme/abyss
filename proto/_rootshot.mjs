/* 根の層の見た目を撮る（測定用。掃引に入らない）。node proto/_rootshot.mjs 出力.png [深さ] [種] [ox oy] */
import { boot, install } from './_h.mjs';
import fs from 'fs';
const [out, depth='25', seed='44', ox='0', oy='0', flat='0'] = process.argv.slice(2);
const {b, pg, errs} = await boot(); await install(pg);
if(process.env.NODECO) await pg.evaluate(()=>{globalThis.NODECO=1;});
const url = await pg.evaluate(async ([depth,seed,ox,oy,process_flat])=>{
  CAVE.lightSnap=true; if(process_flat) CAVE.rlFlat=process_flat; if(globalThis.NODECO) CAVE.deco=false;
  TH.run(depth,{seed}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[]; S.hero.party=[];
  P.x+=ox; P.y+=oy;
  for(let i=0;i<4;i++){ draw(); await new Promise(r=>requestAnimationFrame(r)); }
  return document.querySelector('canvas').toDataURL('image/png');
}, [+depth,+seed,+ox,+oy,+flat]);
fs.writeFileSync(out, Buffer.from(url.split(',')[1],'base64'));
console.log(JSON.stringify(errs));
await b.close();
