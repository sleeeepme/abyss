const fs=require('fs'),path=require('path');
const sharp=require("sharp");
const D=path.join(__dirname,"rebuild"),W=171,H=300,N=72,FPS=12;fs.mkdirSync(D,{recursive:true});
const source=path.join(__dirname,"approved-source.jpg");
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
(async()=>{
fs.copyFileSync(source,path.join(D,'approved-source.jpg'));
const base=await sharp(source).resize(W,H,{kernel:'nearest',fit:'fill'}).removeAlpha().raw().toBuffer();
await sharp(base,{raw:{width:W,height:H,channels:3}}).png().toFile(path.join(D,'background.png'));
const vinePixels=[];
const vineZones=[[46,0,60],[110,0,28],[130,13,65]];
for(const [cx,y0,y1] of vineZones)for(let y=y0;y<y1;y++)for(let x=cx-3;x<=cx+3;x++){
 const i=(y*W+x)*3;
 if(base[i]>base[i+2]+24&&base[i+1]>base[i+2]+15&&base[i]>85)vinePixels.push({x,y,i,cx,y0,y1,col:[...base.subarray(i,i+3)]});
}
const canopyZones=[[10,64,10],[31,91,10],[7,129,11],[11,190,13],[35,216,15],[7,235,12],[48,280,12],[162,64,11],[157,98,12],[148,137,10],[163,158,9],[160,242,15],[135,276,13]];
const leaf=(i)=>base[i+1]>base[i+2]+13&&base[i]>base[i+2]+12&&base[i]<base[i+1]*1.32;
function frame(f){
 const t=2*Math.PI*((f%N)/N),out=Buffer.from(base);
 // Tiny integer-pixel canopy sway, with a different phase for each tree.
 for(let k=0;k<canopyZones.length;k++){
  const [cx,cy,radius]=canopyZones[k];
  for(let y=Math.max(0,cy-radius);y<Math.min(H,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<Math.min(W,cx+radius);x++){
   if((x-cx)**2+(y-cy)**2>radius**2)continue;
   const amount=clamp((cy+radius-y)/(radius*2),0,1);
   const sx=clamp(x-Math.round(Math.sin(t+k*.73)*1.8*amount),0,W-1),sy=clamp(y-Math.round(Math.sin(t*2+k)*.7*amount),0,H-1);
   const i=(y*W+x)*3,j=(sy*W+sx)*3;
   if(leaf(i)&&leaf(j))for(let c=0;c<3;c++)out[i+c]=base[j+c];
  }
 }
 // Remove the static vine strands against their adjacent cave backdrop, then redraw bending strands.
 for(const p of vinePixels){
  const j=(p.y*W+clamp(p.x+5,0,W-1))*3;
  for(let c=0;c<3;c++)out[p.i+c]=base[j+c];
 }
 for(const p of vinePixels){
  const progress=(p.y-p.y0)/(p.y1-p.y0),dx=Math.round(Math.sin(t+p.cx*.09-progress*.8)*2.5*progress);
  const i=(p.y*W+p.x+dx)*3;for(let c=0;c<3;c++)out[i+c]=p.col[c];
 }
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*3,r=base[i],g=base[i+1],b=base[i+2];
  const fog=x>40&&x<136&&y>45&&y<97&&b>r+6&&g>r+3;
  const water=x>108&&y>98&&y<276&&b>r+9&&g>r+7;
  if(fog){
   const edge=Math.min(clamp((y-45)/10,0,1),clamp((97-y)/8,0,1));
   const a=edge*(Math.sin(t-y*.12+x*.08)*4+Math.sin(t*2-y*.05-x*.1)*2);
   const sx=clamp(x+Math.round(2*Math.sin(t+y*.07)),0,W-1),sy=clamp(y+Math.round(2*Math.sin(t+x*.05)),0,H-1),j=(sy*W+sx)*3;
   const valid=base[j+2]>base[j]+6&&base[j+1]>base[j]+3;
   for(let c=0;c<3;c++)out[i+c]=clamp(Math.round(base[(valid?j:i)+c]+a),0,255);
  }
  if(water){
   const a=Math.pow(Math.max(0,Math.sin(t*3-y*.46+x*.7)),8)*21-3;
   for(let c=0;c<3;c++)out[i+c]=clamp(Math.round(base[i+c]+a),0,255);
  }
 }
 // Sparse drifting motes fade away before each wrapped path resets.
 for(let k=0;k<13;k++){
  const p=((f%N)/N+k*.61803398875)%1,alpha=Math.sin(Math.PI*p)**2*.42;
  const x=Math.round(40+(k*29%94)+Math.sin(t+k)*2);
  const y=Math.round(55+(k*13%30)+p*17);
  const i=(y*W+x)*3,col=[188,195,177];
  for(let c=0;c<3;c++)out[i+c]=Math.round(out[i+c]*(1-alpha)+col[c]*alpha);
 }
 const blend=(x,y,col,a)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=W||y<0||y>=H)return;const i=(y*W+x)*3;for(let c=0;c<3;c++)out[i+c]=Math.round(out[i+c]*(1-a)+col[c]*a);};
 const puff=(cx,cy,rx,ry,col,opacity)=>{for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<1){const a=Math.ceil((1-d)*3)/3*opacity;blend(x,y,col,a);}}};
 // Low cool mist drifts out of the cave, dissipating before the rear stairway.
 for(let k=0;k<6;k++){
  const p=((f%N)/N+k/6)%1,a=Math.sin(Math.PI*p)**2*.22;
  puff(69+Math.sin(k*3.1)*12+24*p,62+28*p,9+7*p,3+3*p,[124,156,166],a);
 }
 // Rising chimney smoke: staggered puffs travel up and downwind, fading at ends.
 for(const [sx,sy,offset] of [[9,84,0],[15,151,.3],[167,109,.65]])for(let k=0;k<5;k++){
  const p=((f%N)/N+k/5+offset)%1;
  const a=Math.min(1,p*12)*Math.pow(1-p,.8)*.7;
  const cx=sx+12*p+Math.sin(p*7+offset)*2*p,cy=sy-24*p;
  puff(cx,cy,1.4+p*4,1.8+p*3,[201,196,178],a);
  puff(cx-1,cy+1,1+p*2,1+p*2,[224,214,189],a*.35);
 }
 // Translate texture inside existing low clouds by a few integer pixels.
 for(let y=247;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*3;
  if(base[i]>177&&base[i+1]>157&&base[i+2]>129&&(x<55||x>123)){
   const sx=clamp(x+Math.round(3*Math.sin(t+y*.09)),0,W-1),sy=clamp(y+Math.round(2*Math.sin(t+x*.05)),0,H-1),j=(sy*W+sx)*3;
   if(base[j]>168&&base[j+1]>150)for(let c=0;c<3;c++)out[i+c]=base[j+c];
  }
 }
 // Broad cloud banks sweep across bottom corners, leaving the plaza clear.
 for(let side=0;side<2;side++)for(let k=0;k<5;k++){
  const p=((f%N)/N+k/5+side*.21)%1,a=Math.sin(Math.PI*p)**2*.48;
  const cx=side?182-40*p:-25+64*p,cy=258+k*8+Math.sin(t+k)*3;
  puff(cx,cy,19,7,[218,208,186],a);
  puff(cx+7,cy+3,15,6,[233,222,198],a*.7);
 }
 // Readable olive grass blades travel diagonally in gusts, with periodic lifetimes.
 for(let k=0;k<17;k++){
  const p=((f%N)/N+k*.61803398875)%1,a=Math.min(1,p*10,(1-p)*10)*.88;
  const x=-12+196*p+Math.sin(t*2+k)*3,y=32+(k*41%249)-13*p+Math.sin(t*2+k)*4;
  const tilt=Math.sin(t*2+k)>0?1:-1;
  blend(x,y,[151,148,66],a);blend(x+1,y-tilt,[166,158,78],a);blend(x+2,y-tilt,[166,158,78],a*.8);blend(x-1,y+tilt,[89,100,53],a*.65);
 }
 return out;
}
const frames=Array.from({length:N},(_,i)=>frame(i));
if(!frame(0).equals(frame(N)))throw Error('Loop endpoints differ');
// Sprites are lossless and remain on an integer pixel grid.
const sheet=Buffer.alloc(W*12*H*6*3);
for(let n=0;n<N;n++)for(let y=0;y<H;y++)frames[n].copy(sheet,(((n/12|0)*H+y)*W*12+(n%12)*W)*3,y*W*3,(y+1)*W*3);
const sheetPNG=await sharp(sheet,{raw:{width:W*12,height:H*6,channels:3}}).png().toBuffer();
fs.writeFileSync(path.join(D,'loop-spritesheet.png'),sheetPNG);
const big=[];for(const f of frames)big.push(await sharp(f,{raw:{width:W,height:H,channels:3}}).resize(W*4,H*4,{kernel:'nearest'}).raw().toBuffer());
await sharp(Buffer.concat(big),{raw:{width:W*4,height:H*4*N,channels:3,pageHeight:H*4}}).webp({lossless:true,loop:0,delay:Array.from({length:N},(_,i)=>[80,80,90][i%3])}).toFile(path.join(D,'hub-loop-4x.webp'));
const contact=await sharp({create:{width:W*4*3,height:H*4,channels:3,background:'#171c20'}}).composite([0,24,48].map((n,i)=>({input:big[n],raw:{width:W*4,height:H*4,channels:3},left:i*W*4,top:0}))).png().toBuffer();
fs.writeFileSync(path.join(D,'contact-sheet.png'),contact);
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>拠点背景・6秒ループ</title><style>body{margin:0;background:#171c20;color:#ddd;font:14px system-ui;display:grid;place-items:center;min-height:100vh}main{text-align:center}canvas{height:min(88vh,1200px);max-width:100%;image-rendering:pixelated;display:block;margin:auto}button{margin:12px;padding:8px 20px;background:#303a3c;color:#eee;border:1px solid #667371;border-radius:5px}</style><main><canvas width="171" height="300" aria-label="洞窟の霧と川の光が動く拠点背景"></canvas><button>一時停止</button><span>6秒 / 12fps</span></main><script>const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),button=document.querySelector('button'),img=new Image();ctx.imageSmoothingEnabled=false;let paused=matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,last=0;button.textContent=paused?'再生':'一時停止';button.onclick=()=>{paused=!paused;button.textContent=paused?'再生':'一時停止'};img.src='data:image/png;base64,${sheetPNG.toString('base64')}';img.onload=()=>requestAnimationFrame(function tick(now){if(last&&!paused&&!document.hidden)time+=Math.min(now-last,100);last=now;const f=Math.floor(time/1000*12)%72;ctx.drawImage(img,f%12*171,Math.floor(f/12)*300,171,300,0,0,171,300);requestAnimationFrame(tick)});</script></html>`;
fs.writeFileSync(path.join(D,'preview.html'),html);
const meta=await sharp(path.join(D,'hub-loop-4x.webp'),{animated:true}).metadata();
if(meta.pages!==N)throw Error('Animation pages incorrect: '+meta.pages);
fs.writeFileSync(path.join(D,'verification.json'),JSON.stringify({frames:N,fps:FPS,durationSeconds:6,endpointExactMatch:true,webpPages:meta.pages,webpDelayTotalMs:meta.delay.reduce((a,b)=>a+b,0),native:[W,H],scale:4},null,2));
console.log(JSON.stringify({pages:meta.pages,delay:meta.delay.reduce((a,b)=>a+b,0),files:fs.readdirSync(D)}));
})();
