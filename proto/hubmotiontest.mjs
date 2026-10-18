// 数値座標だけでなく、ブラウザが描いた画素の移動を検査する。
// left/top + 拡大親要素では小数座標でも原画1pxにスナップしていた回帰を防ぐ。
import {boot,install} from './_h.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {b,pg,errs}=await boot();const out='output/hub-compositor-motion';
try{
 await mkdir(out,{recursive:true});await install(pg);await pg.setViewportSize({width:390,height:844});
 await pg.waitForFunction(()=>HUB_BG.ready&&innerHeight===844&&el('hubbg').getBoundingClientRect().height===844);
 await pg.evaluate(()=>{S.hero.party=[];S.hero.artKey='hero_scout';el('hub-avatars').dataset.hubKey='';setScreen('town');stopHubWander();stopHubBg();});
 await pg.waitForFunction(()=>+getComputedStyle(document.getElementById('scr-fade')).opacity===0);
 await pg.addStyleTag({content:'#scr-town{background:rgb(255,0,255)!important} #hub-bgwrap,.hub-top,.hub-bottom,.hub-dive,.hub-ava-sh,.hub-ava .nm{visibility:hidden!important} .hub-ava-art{animation:none!important}'});
 await pg.evaluate(async()=>{await document.querySelector('.hub-ava-art').decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const results={};
 for(const axis of ['x','y']){
  const samples=[];
  for(let i=0;i<=20;i++){
   await pg.evaluate(({axis,i})=>hubPlaceAvatar(document.querySelector('.hub-ava'),{x:260+(axis==='x'?i*.2:0),y:170+(axis==='y'?i*.2:0)}),{axis,i});
   const png=await pg.screenshot({clip:{x:100,y:410,width:160,height:90}});
   const bounds=await pg.evaluate(async base64=>{
    const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const c=canvas.getContext('2d');c.drawImage(image,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height).data;
    let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
     const k=(y*canvas.width+x)*4;
     if(data[k+1]>5){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    }
    return {left,top,right,bottom};
   },png.toString('base64'));

   assert(bounds.right>bounds.left,axis+' sample '+i+' missing sprite: '+JSON.stringify(bounds));samples.push(bounds);
  }
  const offsets=samples.map(p=>axis==='x'?p.left:p.top),steps=offsets.slice(1).map((p,i)=>p-offsets[i]);
  assert.equal(new Set(offsets).size,21,'rendered '+axis+' position held despite fractional movement');
  assert(steps.every(d=>d>0&&d<=2),'rendered '+axis+' moved in whole source-pixel jumps');
  results[axis]={offsets,unique:new Set(offsets).size,maxStep:Math.max(...steps)};
 }
 assert.deepEqual(errs,[]);results.errors=errs;
 await writeFile(out+'/rendered-motion.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await b.close();}
