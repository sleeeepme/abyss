/* Standalone study: reuses the approved hub spritesheet; no game hooks. */
(()=>{'use strict';
const $=id=>document.getElementById(id),before=$('before'),after=$('after'),w=before.width,h=before.height;
const original=before.getContext('2d'),out=after.getContext('2d');
const make=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const source=make(),src=source.getContext('2d');
// CSS filters work on mobile Safari as well as desktop browsers.
const holder=document.createElement('div');holder.style.cssText='position:relative;overflow:hidden;border-radius:4px';
after.replaceWith(holder);holder.append(after);
const pad=42,layers=Array.from({length:6},()=>{
 const mask=document.createElement('div'),canvas=make();canvas.width=w+pad*2;canvas.height=h+pad*2;
 mask.style.cssText='position:absolute;inset:0;pointer-events:none';
 canvas.style.cssText=`position:absolute;max-width:none;left:${-pad/w*100}%;top:${-pad/h*100}%;width:${(w+pad*2)/w*100}%;height:${(h+pad*2)/h*100}%;border-radius:0`;
 mask.append(canvas);holder.append(mask);return{mask,canvas,ctx:canvas.getContext('2d')};
});
const guide=document.createElement('div');guide.style.cssText='position:absolute;left:0;right:0;border-top:1px dashed #d9f4b7;border-bottom:1px dashed #d9f4b7;pointer-events:none';holder.append(guide);
new ResizeObserver(()=>dirty=true).observe(holder);
const ids=['blur','focus','band','fade','vignette','vignetteRange'],presets={soft:1,standard:5,miniature:7};
let scene='dungeon';
const shade=document.createElement('div');shade.style.cssText='position:absolute;inset:0;pointer-events:none';holder.insertBefore(shade,guide);
const dungeon=document.createElement('iframe');dungeon.title='ダンジョン描画用';dungeon.setAttribute('aria-hidden','true');dungeon.tabIndex=-1;dungeon.style.cssText='position:fixed;left:-10000px;top:0;width:342px;height:600px;border:0;visibility:hidden';dungeon.src='assets/tilt-shift-dungeon/index.html';document.body.append(dungeon);
function selectScene(name){scene=name;document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===name)));$('vignetteControls').hidden=false;dirty=true;}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>selectScene(b.dataset.scene));
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches,elapsed=0,last=0,previous=-1,dirty=true,ready=false;
const image=new Image();image.src='assets/backgrounds/hub-final-v1/loop-spritesheet.png';
const value=id=>Number($(id).value),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function labels(){for(const id of ids)$(id+'Value').textContent=value(id)+(id==='blur'?' px':'%');dirty=true;}
function preset(name){$('blur').value=presets[name];document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));labels();}
ids.forEach(id=>$(id).addEventListener('input',()=>{document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));labels()}));
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));
$('guides').onchange=()=>dirty=true;$('vignetteEnabled').onchange=()=>dirty=true;
function pauseLabel(){$('pause').textContent=paused?'再生':'一時停止';$('pause').setAttribute('aria-pressed',String(paused));}
$('pause').onclick=()=>{paused=!paused;pauseLabel()};
$('reset').onclick=()=>{[5,50,40,30,90,15].forEach((v,i)=>$(ids[i]).value=v);preset('standard');$('guides').checked=false;$('vignetteEnabled').checked=true;dirty=true};
after.onpointerdown=e=>{const rect=after.getBoundingClientRect();$('focus').value=Math.round((e.clientY-rect.top)/rect.height*100);$('focus').dispatchEvent(new Event('input'))};
function render(frame){
 src.imageSmoothingEnabled=false;
 if(scene==='dungeon'){
  const game=dungeon.contentWindow;
  if(game.tiltDungeonError){$('status').textContent='ダンジョンの読み込みに失敗しました：'+game.tiltDungeonError;return;}
  if(!game.tiltDungeonReady){$('status').textContent='ダンジョンを読み込み中…';dirty=true;return;}
  src.drawImage(game.renderTiltDungeon(elapsed/1000),0,0,w,h);
  $('status').textContent='ダンジョン / 本編の石の層 · 描画比較用シーン';
 }else{src.drawImage(image,frame%12*171,Math.floor(frame/12)*300,171,300,0,0,w,h);$('status').textContent='拠点 / 6秒ループ';}
 shade.hidden=!$('vignetteEnabled').checked;
 const darkness=value('vignette')/100,clear=value('vignetteRange');
 shade.style.background=`radial-gradient(ellipse farthest-corner at 50% 50%,rgba(2,5,9,0) ${clear}%,rgba(2,5,9,${darkness*.48}) ${clear+(100-clear)*.55}%,rgba(2,5,9,${darkness}) 100%)`;
 original.drawImage(source,0,0);out.drawImage(source,0,0);
 const blur=value('blur'),focus=value('focus')/100*h,half=value('band')/100*h/2,fade=value('fade')/100*h;
 // Each nested blur layer is masked after filtering; the central band stays sharp.
 const scale=holder.clientWidth/w;
 layers.forEach(({mask,canvas,ctx},i)=>{
  mask.style.display=blur?'block':'none';if(!blur)return;
  ctx.drawImage(source,pad,pad);
  ctx.drawImage(source,0,0,w,1,pad,0,w,pad);ctx.drawImage(source,0,h-1,w,1,pad,h+pad,w,pad);
  ctx.drawImage(source,0,0,1,h,0,pad,pad,h);ctx.drawImage(source,w-1,0,1,h,w+pad,pad,pad,h);
  for(const x of [0,1])for(const y of [0,1])ctx.drawImage(source,x*(w-1),y*(h-1),1,1,x*(w+pad),y*(h+pad),pad,pad);
  canvas.style.filter=`blur(${blur*(i+1)/6*scale}px)`;
  const stops=[];for(let y=0;y<=h;y+=4){const distance=Math.max(0,Math.abs(y-focus)-half);const alpha=smooth(distance/fade*6-i);stops.push(`rgba(0,0,0,${alpha}) ${y/h*100}%`)}
  const gradient=`linear-gradient(to bottom,${stops.join(',')})`;mask.style.maskImage=gradient;mask.style.webkitMaskImage=gradient;
 });
 guide.hidden=!$('guides').checked;guide.style.top=(focus-half)/h*100+'%';guide.style.height=half*2/h*100+'%';
}
function tick(now){if(last&&!paused&&!document.hidden)elapsed+=Math.min(now-last,100);last=now;const frame=Math.floor(elapsed/1000*12)%72;if(ready&&(dirty||frame!==previous)){dirty=false;render(frame);previous=frame}requestAnimationFrame(tick)}
image.onload=()=>{ready=true;$('status').textContent='6秒ループ / 12fps · 171 × 300 の元絵を2倍で描画';requestAnimationFrame(tick)};
image.onerror=()=>{$('status').textContent='背景を読み込めません。assets/backgrounds/hub-final-v1/loop-spritesheet.png を確認してください。'};
dungeon.onload=()=>{dirty=true};labels();pauseLabel();
})();
