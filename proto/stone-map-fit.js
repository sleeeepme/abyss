/* Orthogonal gameplay coordinates; oblique art and cutaway walls only. */
(()=>{'use strict';
const cv=document.querySelector('canvas'),ctx=cv.getContext('2d'),P=STONE_STUDY.parts,images={},root='assets/stone-map-study-v1/',keys=new Set();
let map=STONE_LIVE_MAPS[0],hero={...map.spawn},route=[],last=0,drawMs=0;
const toggle=id=>document.getElementById(id).checked,mode=()=>document.getElementById('mode').value;
const walk=(x,y)=>{const t=map.cells[y]?.[x];return t===1||t===2;};
const worldWalk=(x,y)=>walk(Math.floor(x/16),Math.floor(y/16));
const cam=()=>({x:Math.round(hero.x-160),y:Math.round(hero.y-240)});
const neighbors=(x,y)=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
function findPath(tx,ty){const start=[hero.x/16|0,hero.y/16|0],q=[start],prev=new Map([[start.join(','),null]]);let end=null;for(let h=0;h<q.length;h++){const [x,y]=q[h];if(x===tx&&y===ty){end=[x,y];break;}for(const [a,b]of neighbors(x,y)){const k=a+','+b;if(walk(a,b)&&!prev.has(k)){prev.set(k,[x,y]);q.push([a,b]);}}}if(!end)return[];const out=[];while(end){out.push({x:end[0]*16+8,y:end[1]*16+8});end=prev.get(end.join(','));}return out.reverse().slice(1);}
function move(dx,dy){const r=.3*16,B=(x,y)=>!worldWalk(x,y);if(!B(hero.x+dx+Math.sign(dx)*r,hero.y)&&!B(hero.x+dx+Math.sign(dx)*r,hero.y+r*.7)&&!B(hero.x+dx+Math.sign(dx)*r,hero.y-r*.7))hero.x+=dx;if(!B(hero.x,hero.y+dy+Math.sign(dy)*r)&&!B(hero.x+r*.7,hero.y+dy+Math.sign(dy)*r)&&!B(hero.x-r*.7,hero.y+dy+Math.sign(dy)*r))hero.y+=dy;}
function terrainSprite(id,x,y,w,h,c){const a=P.assets[id];ctx.drawImage(images[id],0,0,a.width,a.height,Math.round(x-c.x-w/2),Math.round(y-c.y-h),w,h);}
function render(skipWalls=false){const begin=performance.now(),c=cam(),m=mode();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#353235';ctx.fillRect(0,0,320,480);
const minx=Math.max(0,Math.floor(c.x/16)-3),maxx=Math.min(map.width-1,Math.ceil((c.x+320)/16)+3),miny=Math.max(0,Math.floor(c.y/16)-3),maxy=Math.min(map.height-1,Math.ceil((c.y+480)/16)+3),wallPath=new Path2D(),floorPath=new Path2D(),walls=[],patches=[],masses=[];
for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
 const sx=x*16-c.x,sy=y*16-c.y;
 if(walk(x,y)){
  ctx.drawImage(images['floor-'+((x*13+y*7)%7<3?(x+y)%3+1:0)],sx,sy);
  floorPath.rect(sx,sy,16,16);
  // Small patches stay entirely inside the existing floor footprint.
  if(m!=='flat'&&(x*17+y*31)%37===0)terrainSprite('moss',x*16+8,y*16+15,16,16,c);
  if(m!=='flat'&&(x*7+y*11)%31===0)patches.push({x,y});
  if(map.cells[y][x]===2){ctx.fillStyle='#52514a';ctx.fillRect(sx+2,sy+2,12,12);for(let k=0;k<3;k++){ctx.fillStyle=k===0?'#d5c3a8':'#b6a28a';ctx.fillRect(sx+3,sy+3+k*3,10,2);}}
 }else{
  wallPath.rect(sx,sy,16,16);ctx.fillStyle='#5b5350';ctx.fillRect(sx,sy,16,16);
  const near=neighbors(x,y).some(([a,b])=>walk(a,b));if(near)walls.push({x,y,id:walk(x,y+1)?'ledge':(x+y)%3?'boulder':'wall-tall'});
  if(x%2===0&&y%2===0)masses.push({x,y,id:(x+y)%4?'corner':'wall-tall'});
 }
}
if(m!=='flat'){ctx.save();ctx.clip(floorPath);for(const p of patches)terrainSprite('slab',p.x*16+8,p.y*16+18,44,32,c);ctx.restore();}
if(m!=='flat'&&!skipWalls){
 ctx.save();if(m==='safe')ctx.clip(wallPath);
 for(const w of masses)terrainSprite(w.id,w.x*16+8,(w.y+1)*16,56,56,c);
 for(const w of walls){if((walk(w.x,w.y+1)?w.x:w.y)%2)continue;const wide=w.id==='ledge'?48:38,tall=w.id==='wall-tall'?48:36;terrainSprite(w.id,w.x*16+8,(w.y+1)*16,wide,tall,c);}
 ctx.restore();
 // Thin, low-contrast contact edge marks actual logical boundary even beneath the overhang.
 for(const w of walls){ctx.strokeStyle='#665b50';ctx.lineWidth=1;const x=w.x*16-c.x,y=w.y*16-c.y;ctx.beginPath();if(walk(w.x,w.y+1)){ctx.moveTo(x,y+15.5);ctx.lineTo(x+16,y+15.5);}if(walk(w.x+1,w.y)){ctx.moveTo(x+15.5,y);ctx.lineTo(x+15.5,y+16);}ctx.stroke();}
}
if(toggle('marker')){const x=Math.round(hero.x-c.x),y=Math.round(hero.y-c.y);ctx.fillStyle='#635740';ctx.fillRect(x-5,y,10,3);ctx.fillStyle='#e9dbb0';ctx.fillRect(x-2,y-6,4,7);ctx.fillStyle='#aa733e';ctx.fillRect(x-3,y-2,6,4);}
if(toggle('grid'))for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){const sx=x*16-c.x,sy=y*16-c.y;ctx.fillStyle=walk(x,y)?'rgba(89,171,117,.17)':'rgba(190,78,71,.21)';ctx.fillRect(sx,sy,16,16);ctx.strokeStyle='rgba(237,224,192,.25)';ctx.strokeRect(sx+.5,sy+.5,16,16);}
drawMs=performance.now()-begin;document.getElementById('status').textContent=`本編生成 seed ${map.seed} / ${map.width}×${map.height} / 位置 ${ (hero.x/16).toFixed(1)},${(hero.y/16).toFixed(1)} / ${route.length?'移動中':'待機'}`;
}
function corridor(){for(let i=2;i<map.route.length-2;i++){const [x,y]=map.route[i],h=Number(walk(x-1,y))+Number(walk(x+1,y)),v=Number(walk(x,y-1))+Number(walk(x,y+1));if(h<2||v<2){hero={x:x*16+8,y:y*16+8};route=[];return;}}}
function tick(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;let dx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0),dy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);if(dx||dy)route=[];else if(route.length){dx=route[0].x-hero.x;dy=route[0].y-hero.y;if(Math.hypot(dx,dy)<1){hero={...route.shift()};dx=dy=0;}}const n=Math.hypot(dx,dy);if(n)move(dx/n*Math.min(dt*48,n),dy/n*Math.min(dt*48,n));render();requestAnimationFrame(tick);}
document.getElementById('seed').innerHTML=STONE_LIVE_MAPS.map((m,i)=>`<option value="${i}">生成seed ${m.seed}</option>`).join('');document.getElementById('seed').onchange=e=>{map=STONE_LIVE_MAPS[+e.target.value];hero={...map.spawn};route=[];};document.getElementById('entry').onclick=()=>{hero={...map.spawn};route=[];};document.getElementById('corridor').onclick=corridor;document.getElementById('tour').onclick=()=>route=findPath(map.exit.x/16|0,map.exit.y/16|0);
window.addEventListener('keydown',e=>{if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();keys.add(e.key);}});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());cv.onpointerdown=e=>{const r=cv.getBoundingClientRect(),c=cam();route=findPath(Math.floor(((e.clientX-r.left)/r.width*320+c.x)/16),Math.floor(((e.clientY-r.top)/r.height*480+c.y)/16));};
Promise.all(Object.entries(P.assets).map(([id,a])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[id]=im;resolve()};im.onerror=reject;im.src=root+a.file;}))).then(()=>{window.STONE_FIT={ready:true,render,corridor,findPath,move,worldWalk,get map(){return map},get hero(){return hero},setHero:p=>{hero={...p};route=[];},get drawMs(){return drawMs}};requestAnimationFrame(tick);});
})();
