/* Shared game feel. Visual state never changes combat rolls or save data. */
const FEEL={floor:null,time:0,kick:0,kickMax:.2,strength:0,step:0,particles:[],dashCd:0,lightX:1,lightY:0};
const FEEL_REDUCED=matchMedia('(prefers-reduced-motion: reduce)');
function resetFeel(){
  FEEL.floor=W.fl; FEEL.particles=[]; FEEL.kick=0; FEEL.step=0; FEEL.dashCd=0;
  FEEL.lightX=P.dirx||1; FEEL.lightY=P.diry||0; P.dash=null;
}
function syncFeel(){ if(FEEL.floor!==W.fl) resetFeel(); }
function feelKick(strength,seconds){
  syncFeel(); FEEL.strength=Math.max(FEEL.strength*(FEEL.kick/FEEL.kickMax),strength);
  FEEL.kick=seconds; FEEL.kickMax=seconds;
}
function popPlayerDamage(damage,col,dot=false){
  pop(P.x,P.y-.4,damage,col);
  W.pops[W.pops.length-1].player=true;
  feelKick(dot?1:2.8,dot?.1:.2);
}
function updateFeel(dt){
  syncFeel(); FEEL.time+=dt; FEEL.kick=Math.max(0,FEEL.kick-dt);
  FEEL.dashCd=Math.max(0,FEEL.dashCd-dt);
  if(P.moving) FEEL.step+=dt*13;
  let dx=P.moving?P.mvx:(P.dirx||1), dy=P.moving?P.mvy:(P.diry||0);
  if(P.dash){const n=Math.hypot(P.dash.x1-P.dash.x0,P.dash.y1-P.dash.y0)||1;dx=(P.dash.x1-P.dash.x0)/n;dy=(P.dash.y1-P.dash.y0)/n;}
  const blend=1-Math.exp(-dt*12);
  FEEL.lightX+=(dx-FEEL.lightX)*blend; FEEL.lightY+=(dy-FEEL.lightY)*blend;
  FEEL.particles=FEEL.particles.filter(p=>{
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=dt*1.5;
    p.vx*=Math.exp(-dt*2); return p.life>0;
  });
}
function beginFeelWorld(){
  syncFeel(); ctx.save();
  if(FEEL_REDUCED.matches) return;
  const kick=FEEL.strength*FEEL.kick/FEEL.kickMax;
  const walk=P.moving?.8:0;
  ctx.translate(Math.round(Math.sin(FEEL.time*83)*kick+Math.sin(FEEL.step)*walk),
                Math.round(Math.cos(FEEL.time*71)*kick+Math.cos(FEEL.step*2)*walk));
}
function feelHeroOffset(){
  if(FEEL_REDUCED.matches) return {x:0,y:0};
  const k=FEEL.kick/FEEL.kickMax;
  return {x:Math.round(Math.sin(FEEL.time*96)*k*2-P.dirx*P.swing*7),
          y:Math.round((P.moving?-Math.abs(Math.sin(FEEL.step))*1.5:0)+Math.cos(FEEL.time*86)*k-P.diry*P.swing*7)};
}

// Short tap = dash. A drag keeps the existing movement stick; HUD taps stay UI taps.
// Collision checks include the character radius and stop before pits, in small steps.
function tapDash(cx,cy){
  syncFeel();
  if(S.screen!=='game'||!S.hero||!S.run||P.dash||FEEL.dashCd>0||frozenNow()||P.fallAnim||W.mine) return false;
  let dx=stickDx,dy=stickDy;
  if(keys.a||keys.arrowleft) dx=-1; if(keys.d||keys.arrowright) dx=1;
  if(keys.w||keys.arrowup) dy=-1; if(keys.s||keys.arrowdown) dy=1;
  if(Math.hypot(dx,dy)<.15){
    dx=cx-innerWidth/2;dy=cy-innerHeight/2;
    if(Math.hypot(dx,dy)<8){dx=P.dirx||1;dy=P.diry||0;}
  }
  const n=Math.hypot(dx,dy)||1; dx/=n;dy/=n;
  const r=P.r||.32;
  let gx=P.x,gy=P.y;
  for(let d=.08;d<=2.4;d+=.08){
    const x=P.x+dx*d,y=P.y+dy*d;
    if([[-r,-r],[r,-r],[-r,r],[r,r],[0,0]].some(([ox,oy])=>{
      const row=W.fl.g[Math.floor(y+oy)],t=row?.[Math.floor(x+ox)];
      return t===undefined||t===T.WALL||t===T.PIT;
    })) break;
    gx=x;gy=y;
  }
  if(Math.hypot(gx-P.x,gy-P.y)<.12) return false;
  P.dirx=dx;P.diry=dy;
  P.dash={x0:P.x,y0:P.y,x1:gx,y1:gy,t:0,max:.2,col:'#91dfcb'};
  FEEL.dashCd=.8; feelKick(1.5,.14);
  return true;
}
const feelPointers=new Map();
cv.addEventListener('pointerdown',e=>{
  if(S.screen!=='game'||e.button!==0) return;
  feelPointers.set(e.pointerId,{x:e.clientX,y:e.clientY,t:performance.now(),drag:false});
});
addEventListener('pointermove',e=>{
  const p=feelPointers.get(e.pointerId);
  if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>10) p.drag=true;
});
addEventListener('pointerup',e=>{
  const p=feelPointers.get(e.pointerId);feelPointers.delete(e.pointerId);
  if(p&&!p.drag&&performance.now()-p.t<300&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=10) tapDash(e.clientX,e.clientY);
});
addEventListener('pointercancel',e=>feelPointers.delete(e.pointerId));
addEventListener('blur',()=>feelPointers.clear());
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='x'&&!e.repeat) tapDash(innerWidth/2,innerHeight/2);});

// Render the existing effects at a shared coarse pixel resolution, preserving their timing.
const feelFxCanvas=document.createElement('canvas'),feelFxCtx=feelFxCanvas.getContext('2d');
let feelMainCtx=null;
function beginPixelFx(){
  const q=Math.max(2,Math.round(TS/16));
  const w=Math.ceil(innerWidth/q),h=Math.ceil(innerHeight/q);
  if(feelFxCanvas.width!==w||feelFxCanvas.height!==h){feelFxCanvas.width=w;feelFxCanvas.height=h;}
  feelFxCtx.setTransform(1,0,0,1,0,0);feelFxCtx.clearRect(0,0,w,h);
  feelFxCtx.save();feelFxCtx.scale(1/q,1/q);feelMainCtx=ctx;ctx=feelFxCtx;
}
function endPixelFx(){
  const q=Math.max(2,Math.round(TS/16));
  feelFxCtx.restore();ctx=feelMainCtx;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(feelFxCanvas,0,0,feelFxCanvas.width*q,feelFxCanvas.height*q);ctx.restore();
}

// Exact grid traversal: rays stop at the first wall face, never behind it.
function feelLightRay(ang,range){
  const dx=Math.cos(ang),dy=Math.sin(ang),f=W.fl;
  let x=Math.floor(P.x),y=Math.floor(P.y),dist=0;
  const sx=dx<0?-1:1,sy=dy<0?-1:1;
  const ddx=Math.abs(1/dx),ddy=Math.abs(1/dy);
  let tx=(dx<0?P.x-x:x+1-P.x)*ddx,ty=(dy<0?P.y-y:y+1-P.y)*ddy;
  for(let i=0;i<40;i++){
    if(tx<ty){dist=tx;tx+=ddx;x+=sx;}else{dist=ty;ty+=ddy;y+=sy;}
    if(dist>=range){dist=range;break;}
    if(!f.g[y]||f.g[y][x]===undefined||f.g[y][x]===T.WALL) break;
  }
  return {x:P.x+dx*dist,y:P.y+dy*dist};
}
function drawPlayerLight(camX,camY){
  const px=P.x*TS-camX,py=P.y*TS-camY;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const paint=(angle,spread,range,col,alpha)=>{
    ctx.save();ctx.beginPath();ctx.moveTo(px,py);
    for(let i=0;i<=100;i++){
      const p=feelLightRay(angle-spread/2+spread*i/100,range);
      ctx.lineTo(p.x*TS-camX,p.y*TS-camY);
    }
    ctx.closePath();ctx.clip();
    const g=ctx.createRadialGradient(px,py,0,px,py,range*TS);
    g.addColorStop(0,`rgba(${col},${alpha})`);g.addColorStop(.45,`rgba(${col},${alpha*.5})`);g.addColorStop(1,`rgba(${col},0)`);
    ctx.fillStyle=g;ctx.fillRect(px-range*TS,py-range*TS,range*TS*2,range*TS*2);ctx.restore();
  };
  paint(0,Math.PI*2,2.7,'91,181,148',.16);
  const angle=Math.atan2(FEEL.lightY,FEEL.lightX);
  paint(angle,1.45,5.8,'125,184,160',.035);
  paint(angle,1.15,5.8,'125,184,160',.045);
  paint(angle,.85,5.8,'125,184,160',.055);
  ctx.restore();
}

function drawLivingLiquid(hz,sx,sy,gx,gy,time){
  const q=TS/16,phase=FEEL_REDUCED.matches?0:time;
  ctx.save();ctx.fillStyle=hz.col;ctx.globalAlpha=.76;ctx.fillRect(sx,sy,TS+1,TS+1);
  // All pools share a world-space flow; boundaries only appear at the actual bank.
  ctx.fillStyle=hz.edge;
  for(let j=2;j<16;j+=4){
    const wave=Math.sin((gy*16+j)*.24+phase*1.4+gx*.4);
    const x=((gx*7+j*3+Math.floor(phase*3+wave*2))%13+13)%13;
    ctx.globalAlpha=.16+.13*(wave+1)/2;
    ctx.fillRect(Math.round(sx+x*q),Math.round(sy+j*q),q*(2+(j%3)),Math.max(1,q));
    ctx.globalAlpha=.09;ctx.fillRect(Math.round(sx+(15-x)*q),Math.round(sy+(j+1)*q),q,q);
  }
  const wet=(x,y)=>W.haz.g[y]?.[x];
  ctx.globalAlpha=.42;
  if(!wet(gx,gy-1))ctx.fillRect(sx,sy,TS,q);
  if(!wet(gx,gy+1))ctx.fillRect(sx,sy+TS-q,TS,q);
  if(!wet(gx-1,gy))ctx.fillRect(sx,sy,q,TS);
  if(!wet(gx+1,gy))ctx.fillRect(sx+TS-q,sy,q,TS);
  // A small stepped wake follows anyone moving through a pool.
  const d=Math.hypot(gx+.5-P.x,gy+.5-P.y);
  if(d<.8&&P.moving){ctx.globalAlpha=.6;ctx.fillRect(sx+q*3,sy+q*12,q*3,q);ctx.fillRect(sx+q*10,sy+q*10,q*2,q);}
  ctx.restore();
}
function drawLivingDeco(Z,sx,sy,lit,gx,gy){
  const seed=(gx*17+gy*31)>>>0,q=TS/16;
  const sway=FEEL_REDUCED.matches?0:Math.round(Math.sin(FEEL.time*1.8+seed)*1.1);
  const near=Math.hypot(gx+.5-P.x,gy+.5-P.y)<1&&P.moving;
  const bend=sway+(near?2:0),kind=seed%5;
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=shade(c,lit);ctx.fillRect(Math.round(sx+x*q),Math.round(sy+y*q),w*q,h*q);};
  if(kind<3){
    for(let i=0;i<3;i++){rect(5+i*3,10,1,3,'#435a43');rect(5+i*3+bend,6+i%2,1,4,Z.id==='sump'?'#548d88':'#6c9170');}
  }else if(kind===3){
    rect(7,9,2,4,'#7d8a73');rect(5+bend,7,6,2,Z.id==='root'?'#9bb77b':'#748d86');rect(6+bend,6,4,1,'#b3c5a0');rect(6+bend,7,1,1,'#d1d3a8');
  }else{
    const crawl=FEEL_REDUCED.matches?0:Math.round(Math.sin(FEEL.time*.65+seed)*2);
    rect(6+crawl,10,3,2,'#688879');rect(8+crawl,9,2,2,'#89a590');rect(9+crawl,9,1,1,'#cadab8');
    rect(5+crawl,12,1,1,'#4a665a');rect(8+crawl+sway,12,1,1,'#4a665a');
  }
}

// Sample the enemy's own sprite pixels. Geometric enemies are rasterized first.
function burstEnemyPixels(e){
  syncFeel();
  const im=CharacterArt.image(CharacterArt.enemyKey(e))||sprite(mossSpriteKey(e));
  const n=im?Math.min(32,im.naturalWidth):16;
  const c=document.createElement('canvas');c.width=c.height=n;
  const cc=c.getContext('2d',{willReadFrequently:true});cc.imageSmoothingEnabled=false;
  if(im) cc.drawImage(im,0,0,n,n);
  else{
    const main=ctx;ctx=cc;
    cc.fillStyle=e.col||e.arch.col;shape(e.arch.id,n/2,n/2,n*.36);cc.fill();ctx=main;
  }
  let data;try{data=cc.getImageData(0,0,n,n).data;}catch{return;}
  const r=(e.boss||e.looksBoss)?e.r:(e.intruder?.54:e.uniq?.46:e.elite?.42:.32);
  const size=CharacterArt.enemyKey(e)?(e.uniqueBoss===5?r*2.25:e.elite?1.12:1):im?r*2.6:r*2.8;
  // Hard cap protects mass kills; no gameplay RNG calls for visual particles.
  const cap=1400;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=(y*n+x)*4;if(data[i+3]<100)continue;
    const dx=(x+.5)/n-.5,dy=(y+.5)/n-.5;
    const noise=((x*73+y*151)%97)/97;
    FEEL.particles.push({x:e.x+dx*size*((e._artFace)||1),y:e.y+dy*size,
      vx:FEEL_REDUCED.matches?0:dx*(2+noise*3),vy:FEEL_REDUCED.matches?0:dy*3-1,
      life:.5+noise*.35,max:.5+noise*.35,size:size/n,c:`rgb(${data[i]},${data[i+1]},${data[i+2]})`});
  }
  if(FEEL.particles.length>cap)FEEL.particles.splice(0,FEEL.particles.length-cap);
  e.pixelBurst=true;
}
function drawEnemyPixels(camX,camY){
  ctx.save();
  for(const p of FEEL.particles){
    if(!tileSeen(p.x,p.y))continue;
    ctx.globalAlpha=Math.min(1,p.life/.25);ctx.fillStyle=p.c;
    const size=Math.max(1,Math.round(p.size*TS));
    ctx.fillRect(Math.round(p.x*TS-camX),Math.round(p.y*TS-camY),size,size);
  }
  ctx.restore();
}
