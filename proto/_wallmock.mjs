/* 北の岩壁の試作（tools/wall3d.py）を画面に重ねて見るための撮影。石の層・北に壁がある部屋の中ほど・岩のドットの地図（G.code）を書き出す。
   node proto/_wallmock.mjs [出力dir] → python3 tools/wall_mock.py [出力dir] */
import { boot, install } from './_h.mjs';
import fs from 'fs';
const {b, pg} = await boot(); await install(pg);
const out=[];
for(const sd of [3,8,21]){
  const r = await pg.evaluate(async sd=>{
    TH.run(3,{seed:sd}); setScreen('game'); W.seen.forEach(x=>x.fill(1)); CAVE.lightSnap=true; P.invuln=1e9;
    W.enemies.forEach(e=>e.x=-99);
    const g=W.fl.g; let best=null;
    outer: for(let y=2;y<W.fl.H-4;y++) for(let x=3;x<W.fl.W-3;x++){
      if(g[y][x]!==T.WALL||g[y+1][x]!==T.FLOOR) continue;
      let run=0; for(let k=-3;k<=3;k++) if(g[y][x+k]===T.WALL&&g[y+1][x+k]===T.FLOOR) run++;
      if(run>=6 && g[y+3][x]===T.FLOOR){ best={x:x+.5,y:y+3.2}; break outer; } }
    if(best){ P.x=best.x; P.y=best.y; }
    for(let i=0;i<3;i++){ draw(); await new Promise(r=>requestAnimationFrame(r)); }
    const cv=document.querySelector('canvas');
    const x0=Math.floor((P.x*TS-innerWidth/2)/TS)-1, y0=Math.floor((P.y*TS-innerHeight/2)/TS)-1;
    const cols=Math.ceil(innerWidth/TS)+3, rows=Math.ceil(innerHeight/TS)+3, grid=[];
    for(let y=y0;y<y0+rows;y++){ const row=[]; for(let x=x0;x<x0+cols;x++) row.push(g[y]&&g[y][x]!=null?g[y][x]:0); grid.push(row); }
    const G=CAVE._G(); let code=null;
    if(G&&G.code){ let bin=''; const u=G.code; for(let i=0;i<u.length;i+=8192) bin+=String.fromCharCode.apply(null,u.subarray(i,i+8192)); code=btoa(bin); }
    return {code, PW:G?G.PW:0, PH:G?G.PH:0, img:cv.toDataURL(), TS, sc:cv.width/innerWidth, camX:P.x*TS-innerWidth/2, camY:P.y*TS-innerHeight/2, P:{x:P.x,y:P.y}, x0, y0, grid, FLOOR:T.FLOOR, STAIR:T.STAIR, found:!!best};
  }, sd);
  out.push(r);
}
const OUT=process.argv[2]||'/tmp/wall3d-out'; fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(OUT+'/mock_in.json', JSON.stringify(out)); await b.close();
