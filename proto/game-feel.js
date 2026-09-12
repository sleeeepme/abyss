/* Presentation and timing feedback. Combat formulas, AI and rewards stay in index.html. */
const updateSimulation=update, resolveEnemyDeath=killEnemy;
const ALLY_EFFECT_FX=window.AllyEffectStudy;
const FEEL_ATTACK_SECONDS=.48;
const FEEL_TUNING=Object.freeze({justWindow:.12,perfectSlowSeconds:.18,perfectSlowScale:.22,
  normalMoveSpeed:3,recoilSeconds:.2,recoilDistance:.09,bossRecoilDistance:.035,
  bossSeconds:1.15,bossZoom:.20,criticalShake:4.6,ultimateShake:6});
const FEEL={floor:null,time:0,kick:0,kickMax:.2,strength:0,step:0,particles:[],dashCd:0,lightX:1,lightY:0,
  motion:new WeakMap(),motes:[],ripples:[],hits:[],slow:0,slowScale:1,just:0,justUsed:false,boss:null};
const FEEL_REDUCED=matchMedia('(prefers-reduced-motion: reduce)');
// Deterministic decoration noise is independent of combat / loot RNG.
function feelHash(x,y,s=0){let n=Math.imul(x+17,374761393)^Math.imul(y+31,668265263)^Math.imul((S.run?.depth||1)+s,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function feelDecorAt(x,y,Z){return feelHash(x,y)<(Z.id==='root'?.30:Z.id==='stone'?.23:.16);}
function feelMotion(e){let m=FEEL.motion.get(e);if(!m){m={speed:0,phase:0,flash:0,crit:0,step:0,recoil:0,recoilX:0,recoilY:0};FEEL.motion.set(e,m);}return m;}
function feelEntityOffset(e){
  if(FEEL_REDUCED.matches)return {x:0,y:0};
  const m=feelMotion(e),s=clamp(m.speed/FEEL_TUNING.normalMoveSpeed,0,1);
  const recoil=(m.recoil/FEEL_TUNING.recoilSeconds)**2*TS;
  return {x:Math.sin(m.phase)*s*.65+m.recoilX*recoil,
    y:-Math.abs(Math.sin(m.phase))*s*1.8+m.recoilY*recoil};
}
function feelBlink(e){const m=feelMotion(e);return m.flash>0&&Math.floor(m.flash*32)%2===0?.4:1;}
function feelElement(dt,elem){return elem||(['fire','shock','frost','arcane'].includes(dt)?dt:'neutral');}
function feelWeaponKind(base,dt,proj){
  if(proj==='arrow'||base==='bow')return 'bow';
  if(proj==='bolt'||base==='staff')return 'magicbolt';
  return ({great:'greatsword',mace:'hammer',spear:'spear',sword:'swordaxe',axe:'swordaxe',dagger:'dagger'})[base]
    ||(dt==='pierce'?'spear':dt==='blunt'?'hammer':'swordaxe');
}
function feelImpact(e,src,crit,dt,elem){
  const m=feelMotion(e);m.flash=.22;m.crit=crit?.25:0;
  // Replace the visual recoil on each hit; never accumulate or change simulation coordinates.
  const dx=src?e.x-src.x:-(e.dirx||1),dy=src?e.y-src.y:-(e.diry||0),n=Math.hypot(dx,dy)||1;
  const distance=e.boss?FEEL_TUNING.bossRecoilDistance:FEEL_TUNING.recoilDistance;
  m.recoil=FEEL_TUNING.recoilSeconds;m.recoilX=dx/n*distance;m.recoilY=dy/n*distance;
  feelSpray(e.x,e.y,crit?'#fff1ad':'#ddd7be',crit?18:5,crit?2.4:1.2);
  FEEL.hits.push({x:e.x,y:e.y,age:0,element:feelElement(dt,elem),target:e.arch?'enemy':'ally'});
  if(FEEL.hits.length>32)FEEL.hits.splice(0,FEEL.hits.length-32);
  if(crit)feelKick(FEEL_TUNING.criticalShake,.19);
}
function feelSlow(seconds,scale){FEEL.slow=Math.max(FEEL.slow,seconds);FEEL.slowScale=Math.min(FEEL.slowScale,scale);}
function feelPerfect(txt,col){
  feelSlow(FEEL_TUNING.perfectSlowSeconds,FEEL_TUNING.perfectSlowScale);feelKick(3.1,.15);feelSpray(P.x,P.y,col,26,2.8);
  W.fx.push({t:'feelring',x:P.x,y:P.y,col,life:.38,max:.38,r:1.4});
  W.pops.push({x:P.x,y:P.y-.7,txt,c:col,life:.85,max:.85});
}
function feelJustDodge(){
  if(FEEL.just<=0||FEEL.justUsed)return false;
  FEEL.justUsed=true;feelPerfect('JUST DODGE','#c4fff1');return true;
}
function feelUltimate(ent,col='#f7d898'){
  feelKick(FEEL_TUNING.ultimateShake,.3);feelSpray(ent.x,ent.y,col,48,4);
  W.fx.push({t:'feelring',x:ent.x,y:ent.y,col,life:.6,max:.6,r:3});
}
killEnemy=function(e,byAlly){
  if(e.dead)return;
  const drops=new Set(W.drops);
  resolveEnemyDeath(e,byAlly);
  if(!e.dead)return;
  for(const d of W.drops)if(!drops.has(d))d.feelDrop={age:0,x:e.x,y:e.y};
  if(e.boss){
    const screen=S.screen,modals=[...document.querySelectorAll('.modal.on')];
    const pending=screen!=='game'?()=>{setScreen(screen);modals.forEach(n=>n.classList.add('on'));}:null;
    if(pending){modals.forEach(n=>n.classList.remove('on'));setScreen('game');}
    FEEL.boss={x:e.x,y:e.y,age:0,pending};feelSlow(.32,.2);feelKick(7,.4);
    feelSpray(e.x,e.y,'#ffe5a0',70,4.5);
    W.fx.push({t:'feelring',x:e.x,y:e.y,col:'#ffe5a0',r:4,life:.85,max:.85});
  }
};
function feelDropOffset(d){
  if(!d.feelDrop||FEEL_REDUCED.matches)return {x:0,y:0};
  const p=clamp(d.feelDrop.age/.55,0,1);
  return {x:(d.feelDrop.x-d.x)*(1-p),y:(d.feelDrop.y-d.y)*(1-p)-Math.sin(p*Math.PI)*.8};
}
// Real-time window / slow expiry; gameplay and all movers use the same scaled dt.
update=function(dt){
  syncFeel();
  FEEL.just=Math.max(0,FEEL.just-dt);
  if(FEEL.boss){
    const b=FEEL.boss;b.age+=dt;updateFeel(dt);S.run.elapsed+=dt;
    W.fx=W.fx.filter(f=>{f.life-=dt;return f.life>0;});
    if(b.age>=FEEL_TUNING.bossSeconds){FEEL.boss=null;FEEL.slow=0;FEEL.slowScale=1;if(b.pending)b.pending();}
    return;
  }
  const scale=FEEL.slow>0?FEEL.slowScale:1;
  FEEL.slow=Math.max(0,FEEL.slow-dt);if(!FEEL.slow)FEEL.slowScale=1;
  const sim=dt*scale,run=S.run;
  const actors=[P,...livingParty(),...(W.npc?[W.npc]:[])];
  const before=actors.map(e=>[e,e.x,e.y]);
  for(const e of [...actors,...W.enemies]){const m=feelMotion(e);m.flash=Math.max(0,m.flash-sim);m.crit=Math.max(0,m.crit-sim);}
  updateSimulation(sim);
  if(S.run!==run||!S.hero)return;
  S.run.elapsed+=dt-sim; // Slow motion never grants extra expedition time.
  for(const [e,x,y] of before){
    const m=feelMotion(e),dist=Math.hypot(e.x-x,e.y-y);
    m.speed=sim>0&&dist<1?dist/sim:0;m.phase+=dist*4.5;
    if(dist>.001&&dist<1&&!e.dead&&!e.fallAnim){
      m.step+=dist;
      if(m.step>.30){m.step=0;feelFootstep(e);}
    }
  }
};
function feelSpray(x,y,col,n,speed=1,kind='spark'){
  for(let i=0;i<n;i++){
    const a=i*2.399+FEEL.time*3,v=speed*(.35+((i*17)%23)/30);
    FEEL.motes.push({x,y,z:.1,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.5,vz:kind==='dust'?.25:1+v*.4,
      col,kind,life:kind==='dust'?.36:.55,max:kind==='dust'?.36:.55,size:kind==='dust'?.04:.045});
  }
  if(FEEL.motes.length>420)FEEL.motes.splice(0,FEEL.motes.length-420);
}
function feelFootstep(e){
  const wet=W.haz&&W.haz.g[Math.floor(e.y)]?.[Math.floor(e.x)]&&['water','slick','poison','spore'].includes(W.haz.kind);
  feelSpray(e.x,e.y+.16,wet?hazardDef(W.haz.kind).edge:'#9a907c',wet?5:2,wet?.7:.22,wet?'water':'dust');
  if(wet){FEEL.ripples.push({x:e.x,y:e.y,age:0,col:hazardDef(W.haz.kind).edge});if(FEEL.ripples.length>28)FEEL.ripples.shift();}
}
function drawFeelMotes(camX,camY){
  ctx.save();
  for(const p of FEEL.motes){if(!tileSeen(p.x,p.y))continue;ctx.globalAlpha=clamp(p.life/p.max,0,1)*.85;ctx.fillStyle=p.col;
    const z=FEEL_REDUCED.matches?0:Math.max(0,p.z),q=Math.max(1,Math.round(TS*p.size));
    ctx.fillRect(Math.round(p.x*TS-camX),Math.round((p.y-z)*TS-camY),q,q);
  }
  ctx.restore();
}
function drawFeelRipples(camX,camY){
  if(!W.haz)return;ctx.save();const q=Math.max(1,Math.round(TS/20));
  for(const r of FEEL.ripples){
    const radius=.12+r.age*1.2;
    ctx.globalAlpha=(1-r.age/.85)*.45;ctx.fillStyle=r.col;
    for(let i=0;i<28;i++){
      const a=i*Math.PI*2/28,x=r.x+Math.cos(a)*radius,y=r.y+Math.sin(a)*radius*.65;
      if(!W.haz.g[Math.floor(y)]?.[Math.floor(x)]||!tileSeen(x,y))continue;
      ctx.fillRect(Math.round(x*TS-camX),Math.round(y*TS-camY),q*2,q);
    }
  }ctx.restore();
}
/* 画面外周の暗がり。**1枚焼いて貼るだけにする。**
   放射グラデーションで全画面を毎フレーム塗り直すと、画面ぶんの画素を
   1枚まるごと計算し直すことになる。実測で 15fps ぶん（26階 38→55）。

   これがJSのプロファイルに出てこないのが厄介なところで、
   このフレーム内の記録時間は 0.01ms しかない。塗りはJSが返ったあとに乗る。
   draw が 4.2ms、update が 0.8ms、残り 74% が「空き」に見えていた。

   模様は画面サイズが変わらない限り動かないので、焼いておける。 */
const feelVignetteCanvas=document.createElement('canvas');
let feelVignetteKey='';
function drawFeelVignette(){
  const w=innerWidth,h=innerHeight;
  /* 拡大率は index.html 側（resize）が掛けている物をそのまま読む。
     ここで 1 に決め打つと、DPR ぶん小さく貼って画面の一部しか覆わない。 */
  const s=ctx.getTransform().a || 1;
  const key=w+'x'+h+'@'+s;
  if(feelVignetteKey!==key){
    feelVignetteKey=key;
    const cw=Math.max(1,Math.round(w*s)), ch=Math.max(1,Math.round(h*s));
    feelVignetteCanvas.width=cw; feelVignetteCanvas.height=ch;
    const a=feelVignetteCanvas.getContext('2d');
    a.setTransform(1,0,0,1,0,0); a.clearRect(0,0,cw,ch);
    a.translate(cw/2,ch/2); a.scale(cw/2,ch/2);
    const g=a.createRadialGradient(0,0,.25,0,0,1.35);
    g.addColorStop(0,'#02070b00');g.addColorStop(.55,'#02070b25');g.addColorStop(1,'#02070bae');
    a.fillStyle=g; a.fillRect(-1,-1,2,2);
  }
  ctx.save(); ctx.drawImage(feelVignetteCanvas,0,0,w,h); ctx.restore();
}
const feelFlashCanvas=document.createElement('canvas');
const feelAmbientCache=new Map();
function drawFeelAmbient(x,y,col,size){
  let c=feelAmbientCache.get(col);
  if(!c){c=document.createElement('canvas');c.width=c.height=32;const a=c.getContext('2d');
    const g=a.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,col);g.addColorStop(1,'#00000000');a.fillStyle=g;a.fillRect(0,0,32,32);feelAmbientCache.set(col,c);}
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.11;ctx.imageSmoothingEnabled=true;
  const s=12+size*3;ctx.drawImage(c,x-s/2,y-s/2,s,s);ctx.restore();
}
function drawFeelFlash(e,x,y,size){
  const m=feelMotion(e);if(m.flash<=0)return;
  const im=e===P?CharacterArt.image(CharacterArt.heroKey(S.hero)):e.arch?
    (CharacterArt.image(CharacterArt.enemyKey(e))||sprite(mossSpriteKey(e))):CharacterArt.image(CharacterArt.allyKey(e));
  ctx.save();ctx.globalAlpha=m.crit>0?.8:.5;
  if(m.crit>0){ctx.shadowColor='#ffe6a0';ctx.shadowBlur=8;}
  if(im){
    const n=im.naturalWidth; if(feelFlashCanvas.width!==n){feelFlashCanvas.width=feelFlashCanvas.height=n;}
    const c=feelFlashCanvas.getContext('2d');c.clearRect(0,0,n,n);c.drawImage(im,0,0);
    c.globalCompositeOperation='source-in';c.fillStyle=m.crit>0?'#fff2ae':'#fff';c.fillRect(0,0,n,n);c.globalCompositeOperation='source-over';
    ctx.imageSmoothingEnabled=false;ctx.translate(x,y);ctx.scale(e._artFace||1,1);
    ctx.drawImage(feelFlashCanvas,-size/2,-size/2,size,size);
  }else{ctx.fillStyle=m.crit>0?'#fff2ae':'#fff';shape(e.arch?.id||'swarm',x,y,size*.35);ctx.fill();}
  ctx.restore();
}
function drawFeelRing(f,camX,camY){
  const p=clamp(1-f.life/f.max,0,1),q=Math.max(2,Math.round(TS/16));
  ctx.save();ctx.globalAlpha=(1-p)*.8;ctx.fillStyle=f.col;
  for(let i=0;i<48;i++){
    const a=i*Math.PI/24,r=f.r*TS*p;
    ctx.fillRect(Math.round((f.x*TS-camX+Math.cos(a)*r)/q)*q,
      Math.round((f.y*TS-camY+Math.sin(a)*r)/q)*q,q*2,q);
  }
  ctx.restore();
}
function drawFeelSwing(f,camX,camY){
  if(!ALLY_EFFECT_FX)return;
  const kind=f.weaponKind||feelWeaponKind(f.weaponBase,f.dt),cfg=ALLY_EFFECT_FX.weapons[kind];
  if(!cfg)return;
  const age=Math.max(0,(f.max||FEEL_ATTACK_SECONDS)-f.life);
  const scale=clamp(((f.r||1.4)*TS)/(cfg.reach||35),.65,TS/18);
  ALLY_EFFECT_FX.render(ctx,{kind,age,x:f.x*TS-camX,y:f.y*TS-camY,angle:f.a||0,scale,
    heavy:kind==='greatsword'||kind==='hammer',hit:true,element:feelElement(f.dt,f.elem),compact:true});
}
const feelHitCache=new Map();
function feelHitImage(element,target,age,scale){
  const frame=Math.min(14,Math.floor(age*30)),key=element+'|'+target+'|'+frame+'|'+scale.toFixed(2);
  let im=feelHitCache.get(key);if(im)return im;
  const size=Math.ceil(96*scale),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d'),anchor=size/2;
  ALLY_EFFECT_FX.renderElementHit(c,{element,age:frame/30,x:anchor,y:anchor,scale,target,compact:true});
  im={canvas,anchor};feelHitCache.set(key,im);return im;
}
function drawFeelHits(camX,camY){
  if(!ALLY_EFFECT_FX)return;
  const scale=clamp(TS/48,.65,1.5);
  for(const f of FEEL.hits){const im=feelHitImage(f.element,f.target,f.age,scale);
    ctx.drawImage(im.canvas,f.x*TS-camX-im.anchor,f.y*TS-camY-im.anchor);}
}
const feelProjectileCache=new Map();
function feelProjectileImage(kind,element,scale){
  const key=kind+'|'+element+'|'+scale.toFixed(2);let im=feelProjectileCache.get(key);
  if(im)return im;
  const age=kind==='bow'?.17:.19,head=kind==='bow'?90:88,pad=Math.ceil(18*scale);
  const canvas=document.createElement('canvas');canvas.width=Math.ceil((head+28)*scale+pad*2);
  canvas.height=Math.ceil(52*scale+pad*2);
  const c=canvas.getContext('2d'),anchorX=pad+head*scale,anchorY=canvas.height/2;
  ALLY_EFFECT_FX.render(c,{kind,age,x:pad,y:anchorY,angle:0,scale,hit:false,element,compact:true});
  im={canvas,anchorX,anchorY};feelProjectileCache.set(key,im);return im;
}
function drawFeelWeaponShot(f,camX,camY){
  if(!ALLY_EFFECT_FX)return;
  const kind=f.kind==='arrow'?'bow':'magicbolt',a=Math.atan2(f.vy,f.vx),scale=clamp(TS/42,.8,1.5);
  const element=feelElement(kind==='magicbolt'?'arcane':'pierce',f.elem),im=feelProjectileImage(kind,element,scale);
  ctx.save();ctx.translate(f.x*TS-camX,f.y*TS-camY);ctx.rotate(a);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(im.canvas,-im.anchorX,-im.anchorY);ctx.restore();
}
function drawFeelMagic(f,camX,camY,col){
  const x=f.x*TS-camX,y=f.y*TS-camY,q=Math.max(2,Math.round(TS/16));
  const n=Math.hypot(f.vx,f.vy)||1,dx=f.vx/n,dy=f.vy/n;
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=8;i>=0;i--){
    const wave=Math.sin(FEEL.time*18-i*.8)*i*q*.13;
    const xx=x-dx*i*q*1.1-dy*wave,yy=y-dy*i*q*1.1+dx*wave;
    ctx.globalAlpha=(1-i/10)*.55;ctx.fillStyle=col;const s=q*(i<2?3:1.5);
    ctx.fillRect(Math.round(xx/q)*q-s/2,Math.round(yy/q)*q-s/2,s,s);
  }
  ctx.globalAlpha=1;ctx.fillStyle='#e7fff6';ctx.fillRect(Math.round(x)-q/2,Math.round(y)-q/2,q,q);ctx.restore();
}
function resetFeel(){
  FEEL.floor=W.fl; FEEL.particles=[]; FEEL.kick=0; FEEL.step=0; FEEL.dashCd=0;
  FEEL.motion=new WeakMap();FEEL.motes=[];FEEL.ripples=[];FEEL.hits=[];FEEL.slow=0;FEEL.just=0;FEEL.boss=null;
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
  for(const e of new Set([P,...livingParty(),...(W.npc?[W.npc]:[]),...W.enemies])){
    const m=FEEL.motion.get(e);
    if(m)m.recoil=Math.max(0,m.recoil-dt);
  }
  FEEL.step=feelMotion(P).phase;
  let dx=P.moving?P.mvx:(P.dirx||1), dy=P.moving?P.mvy:(P.diry||0);
  if(P.dash){const n=Math.hypot(P.dash.x1-P.dash.x0,P.dash.y1-P.dash.y0)||1;dx=(P.dash.x1-P.dash.x0)/n;dy=(P.dash.y1-P.dash.y0)/n;}
  const blend=1-Math.exp(-dt*12);
  FEEL.lightX+=(dx-FEEL.lightX)*blend; FEEL.lightY+=(dy-FEEL.lightY)*blend;
  FEEL.particles=FEEL.particles.filter(p=>{
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=dt*1.5;
    p.vx*=Math.exp(-dt*2); return p.life>0;
  });
  FEEL.motes=FEEL.motes.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=dt*3;return p.life>0;});
  FEEL.ripples=FEEL.ripples.filter(r=>{r.age+=dt;return r.age<.85;});
  FEEL.hits=FEEL.hits.filter(f=>{f.age+=dt;return f.age<.48;});
  for(const d of W.drops)if(d.feelDrop)d.feelDrop.age=Math.min(1,d.feelDrop.age+dt);
}
function beginFeelWorld(){
  syncFeel(); ctx.save();
  if(FEEL_REDUCED.matches) return;
  if(FEEL.boss){
    const b=FEEL.boss,k=Math.sin(Math.PI*clamp(b.age/FEEL_TUNING.bossSeconds,0,1)),zoom=1+FEEL_TUNING.bossZoom*k;
    const x=innerWidth/2+clamp((b.x-P.x)*TS,-innerWidth*.28,innerWidth*.28);
    const y=innerHeight/2+clamp((b.y-P.y)*TS,-innerHeight*.28,innerHeight*.28);
    ctx.translate(x,y);ctx.scale(zoom,zoom);ctx.translate(-x,-y);
  }
  const kick=FEEL.strength*FEEL.kick/FEEL.kickMax;
  const walk=clamp(feelMotion(P).speed/FEEL_TUNING.normalMoveSpeed,0,1)*.8;
  ctx.translate(Math.sin(FEEL.time*83)*kick+Math.sin(FEEL.step)*walk,
                Math.cos(FEEL.time*71)*kick+Math.cos(FEEL.step*2)*walk);
}
function feelHeroOffset(){
  if(FEEL_REDUCED.matches) return {x:0,y:0};
  const k=FEEL.kick/FEEL.kickMax;
  const m=feelEntityOffset(P);
  return {x:m.x+Math.sin(FEEL.time*96)*k*2-P.dirx*P.swing*7,
          y:m.y+Math.cos(FEEL.time*86)*k-P.diry*P.swing*7};
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
  FEEL.just=FEEL_TUNING.justWindow;FEEL.justUsed=false;
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
  paint(0,Math.PI*2,3.1,'110,201,162',.25);
  const angle=Math.atan2(FEEL.lightY,FEEL.lightX);
  paint(angle,1.45,5.8,'125,184,160',.035);
  paint(angle,1.15,5.8,'125,184,160',.045);
  paint(angle,.85,5.8,'125,184,160',.055);
  ctx.restore();
}

const feelWaterSample=document.createElement('canvas');feelWaterSample.width=feelWaterSample.height=32;
const feelWaterCtx=feelWaterSample.getContext('2d');
function drawLivingLiquid(hz,sx,sy,gx,gy,time){
  const q=TS/16,phase=FEEL_REDUCED.matches?0:FEEL.time;
  const light=clamp(1.3-Math.hypot(gx+.5-P.x,gy+.5-P.y)/W.fl.zone.lightR,.34,1);
  ctx.save();ctx.fillStyle=shade(hz.col,light*.8);ctx.globalAlpha=.85;ctx.fillRect(sx,sy,TS+1,TS+1);
  ctx.beginPath();ctx.rect(sx,sy,TS,TS);ctx.clip();
  // Continuous, world-space refraction bands, clipped to water rather than the banks.
  for(let row=0;row<16;row+=2){
    const wy=gy*16+row,warp=Math.sin(wy*.22+phase*1.7)*2+Math.sin(gx*.9+phase)*1.5;
    ctx.globalAlpha=.10;ctx.fillStyle=hz.edge;
    for(let col=-4;col<20;col+=7){
      const wx=gx*16+col;
      const bend=Math.sin(wx*.2+wy*.13+phase*1.2)*2;
      ctx.fillRect(sx+(col+warp)*q,sy+(row+bend)*q,q*4,q);
    }
  }
  ctx.globalAlpha=.6;
  if(W.fl.zone.id==='sump'&&feelHash(gx,gy,17)<.38)drawLivingDeco(W.fl.zone,sx,sy,light*.8,gx,gy,true);
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
  if(!FEEL_REDUCED.matches){
    // Refract the already drawn submerged detail in 2-pixel strips. Characters / HUD
    // are drawn later, so only the liquid surface and its submerged objects distort.
    /* 読み戻し元は、本体が1フレームに1枚だけ控えている画面（feelWaterFrame）。
       ここで本体キャンバス（cv）から直接読むと、**水1マスごとに描画の同期**が
       起きる。水面を広げたあと、第13階層で 1フレーム 66 回になり
       draw が 18.7ms（34.6fps）まで伸びていた。帯の描画そのものは 0.6ms で、
       残りは全部この読み戻しだった。控えが無いときは今までどおり cv から読む。 */
    const src=(typeof feelWaterFrame!=='undefined' && feelWaterFrameOk) ? feelWaterFrame : cv;
    const tr=ctx.getTransform();feelWaterCtx.clearRect(0,0,32,32);
    feelWaterCtx.drawImage(src,sx*tr.a+tr.e,sy*tr.d+tr.f,TS*tr.a,TS*tr.d,0,0,32,32);
    ctx.globalAlpha=.65;ctx.imageSmoothingEnabled=false;
    for(let row=0;row<32;row+=4){
      const shift=Math.round(Math.sin((gy*32+row)*.16+phase*1.6+gx*.3))*q;
      ctx.drawImage(feelWaterSample,0,row,32,4,sx+shift,sy+row*TS/32,TS,TS/8);
    }
  }
  ctx.restore();
}
function drawLivingDeco(Z,sx,sy,lit,gx,gy,underwater=false){
  const seed=Math.floor(feelHash(gx,gy,2)*65536),q=TS/16;
  sx+=(feelHash(gx,gy,3)-.5)*TS*.45;sy+=(feelHash(gx,gy,4)-.5)*TS*.45;
  const sway=FEEL_REDUCED.matches?0:Math.round(Math.sin(FEEL.time*1.8+seed)*1.1);
  const near=Math.hypot(gx+.5-P.x,gy+.5-P.y)<1&&P.moving;
  const bend=sway+(near?2:0),kind=seed%5;
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=shade(c,lit);ctx.fillRect(Math.round(sx+x*q),Math.round(sy+y*q),w*q,h*q);};
  if(Z.id==='stone'){
    for(let i=0;i<5;i++)rect(3+i*2,10+Math.round(Math.sin(seed+i)*2),2,1,i%2?'#536949':'#354c38');
    if(kind>2)for(let i=0;i<6;i++){rect(7+Math.round(Math.sin(i*.8)*2)+sway,4+i,1,2,'#425b43');if(i%2===0)rect(5+sway,4+i,2,1,'#70815a');}
    return;
  }
  if(Z.id==='sump'){
    if(!underwater){rect(6,10,4,1,'#536d68');return;}
    const time=FEEL_REDUCED.matches?0:FEEL.time;
    if(kind>2){const swim=Math.sin(time*.7+seed)*2;rect(5+swim,8,4,1,'#8abfb7');rect(3+swim+sway,7,2,3,'#598f97');rect(8+swim,8,1,1,'#d2dac0');}
    else for(let i=0;i<3;i++)for(let j=0;j<5;j++)rect(4+i*3+Math.sin(j*.8+time+seed)*1.4,12-j,1,2,'#43887e');
    return;
  }
  if(Z.id==='ruin'){rect(4,9,6,2,'#676979');rect(6,7,3,1,'#83828a');rect(8,10,1,2,'#353b4b');return;}
  if(Z.id==='furnace'){for(let i=0;i<3;i++){rect(4+i*3,9-i%2,2,3,'#593c36');rect(5+i*3,9-i%2,1,1,'#d08049');}return;}
  if(Z.id==='pale'){rect(7,6,1,7,'#91a7b1');rect(5,8,5,1,'#bacad1');rect(6,5,3,1,'#dae3df');return;}
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


// Render-only replacements: projectile physics and attack damage remain in the simulation.
drawSwing=drawFeelSwing;
drawShot=function(f,camX,camY,isAlly){
  drawFeelWeaponShot(f,camX,camY);
};
