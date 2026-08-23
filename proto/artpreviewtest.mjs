// artPreview のプレイヤー差し替え。通常URLを変えず、透過PNGが読めることと
// 「停止時だけ 1px 揺れる」ことを直接確かめる。
import { chromium, devices } from 'playwright';
import path from 'path';

const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[];
pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });

await pg.goto('file://'+path.resolve('proto/index.html')+'?artPreview=1');
await pg.waitForFunction(()=>!!artPreviewPlayerSprite,{timeout:3000});

const R=await pg.evaluate(()=>{
  const size=[artPreviewPlayerSprite.naturalWidth,artPreviewPlayerSprite.naturalHeight];
  const x=P.x, y=P.y;
  let drew=false, drawError=null;
  try{ drew=drawArtPreviewPlayer(30,30,Math.PI/2,0); }
  catch(e){ drawError=e.message; }
  const atRest=artPreviewBobAt(0,true);
  const up=artPreviewBobAt(Math.PI*200,true);
  const down=artPreviewBobAt(Math.PI*600,true);
  return {
    sprite:{size, native:size[0]===18 && size[1]===29},
    bob:{atRest,up,down, idleMoves:atRest===0 && up===1 && down===-1,
         inactive:artPreviewBobAt(Math.PI*200,false)===0},
    draw:{drew,drawError, doesNotMovePlayer:P.x===x && P.y===y,
          ok:drew && !drawError && P.x===x && P.y===y}
  };
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
