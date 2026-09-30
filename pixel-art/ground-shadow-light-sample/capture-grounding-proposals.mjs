import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.cwd(), 'proto', '_h.mjs'));
const { chromium } = require('playwright');
const proposals = [
  {
    id: 'a-contact',
    layers: [{ center: 0.00, rx: 0.30, ry: 0.070, alpha: 168 }],
  },
  {
    id: 'b-contact-cast',
    layers: [
      { center: 0.00, rx: 0.25, ry: 0.058, alpha: 170 },
      { center: 0.20, rx: 0.34, ry: 0.090, alpha: 92 },
    ],
  },
  {
    id: 'c-wide-cast',
    layers: [
      { center: 0.00, rx: 0.27, ry: 0.064, alpha: 145 },
      { center: 0.27, rx: 0.43, ry: 0.120, alpha: 78 },
    ],
  },
];

const frameDir = path.join(here, 'grounding-proposal-frames');
const silhouetteDir = path.join(here, 'silhouette-proposal-frames');
const motionDir = path.join(here, 'silhouette-motion-frames');
fs.rmSync(frameDir, { recursive: true, force: true });
fs.rmSync(silhouetteDir, { recursive: true, force: true });
fs.rmSync(motionDir, { recursive: true, force: true });
fs.mkdirSync(frameDir, { recursive: true });
fs.mkdirSync(silhouetteDir, { recursive: true });
fs.mkdirSync(motionDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 700 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://127.0.0.1:8769/index.html?grounding-shadow-proposals', { waitUntil: 'networkidle' });

await page.evaluate(() => {
  S.hero = newHero(); startRun(1); W.seen.forEach(row => row.fill(1));
  const room = W.fl.rooms.find(room => room.w >= 8 && room.h >= 7);
  W.fl.zone = {...W.fl.zone, floor:'#718196', wall:'#263344', edge:'#46596f', dot:'#9aabbd', lightR:44};
  P.x = room.x + 3.5; P.y = room.y + 3.5; P.dirx = 1; P.diry = 0;
  P.target = null; P.cd = 999; P.swing = 0; P.dash = null; P.moving = false;
  FEEL.lightX = 1; FEEL.lightY = 0;
  const enemy = W.enemies.find(enemy => !enemy.boss && !enemy.undying && !enemy.uniq);
  enemy.x = P.x + 1.75; enemy.y = P.y - .25; enemy.hp = enemy.maxHp;
  enemy.cd = 999; enemy.cast = 0; enemy.tele = 0; enemy.dead = false; enemy.pixelBurst = false;
  W.enemies = [enemy];
  const ally = makeAlly(1, S.hero, 'warrior');
  ally.x = P.x - 1.45; ally.y = P.y + .42; ally.hpNow = allyStats(ally).maxHp; ally.cd = 999;
  S.hero.party = [ally];
  W.drops = [
    {x:P.x + 2.05, y:P.y + 1.28, it:genBaseItem('sword', 1, 1)},
    {x:P.x - 1.95, y:P.y - 1.20, it:makeConsum('salve')},
  ];
  W.fx = []; W.pops = []; FEEL.weaponArts = []; FEEL.hits = []; FEEL.motes = [];
  window.update = () => {};
  window.drawFeelVignette = () => {};
  window.label = () => {};
  window.__shadowRefs = [
    {id:'hero', point:()=>P, image:()=>CharacterArt.image(CharacterArt.heroKey(S.hero))},
    {id:'ally', point:()=>ally, image:()=>CharacterArt.image(CharacterArt.allyKey(ally))},
    {id:'enemy', point:()=>enemy, image:()=>CharacterArt.image(CharacterArt.enemyKey(enemy))||sprite(mossSpriteKey(enemy))},
    {id:'sword', point:()=>W.drops[0], image:()=>ITEM_ART.runtimeSprite(W.drops[0].it,RARCOL[W.drops[0].it.rar])},
    {id:'salve', point:()=>W.drops[1], image:()=>ITEM_ART.runtimeSprite(W.drops[1].it)},
  ];

  const texture = (size, layer) => {
    const rx = Math.max(3, size * layer.rx), ry = Math.max(2, size * layer.ry);
    const cx = size * layer.center;
    const margin = Math.ceil(Math.max(rx, ry) * 2.2);
    const width = Math.ceil(Math.abs(cx) + rx * 2 + margin * 2);
    const height = Math.ceil(ry * 2 + margin * 2);
    const anchorX = margin + rx * 1.7, anchorY = Math.floor(height / 2);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(width, height), data = image.data;
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){
      const x = px-anchorX, y = py-anchorY;
      const d2 = ((x-cx)/rx)**2 + (y/ry)**2;
      if(d2>4.5) continue;
      const alpha = Math.round(layer.alpha*Math.exp(-d2*1.55));
      if(!alpha) continue;
      const index=(py*width+px)*4;
      data[index]=7;data[index+1]=9;data[index+2]=20;data[index+3]=alpha;
    }
    context.putImageData(image,0,0);
    return {canvas,anchorX,anchorY};
  };
  window.__setGroundingProposal = layers => {
    const cache = new Map();
    window.drawFeelGroundShadow = (x,y,size,scale=1,alpha=1,sourceX=innerWidth/2,sourceY=innerHeight/2) => {
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0) return;
      const s=Math.max(2,size*scale),footX=Math.round(x),footY=Math.round(y+s*.39);
      let dx=x-sourceX,dy=y-sourceY,n=Math.hypot(dx,dy);
      if(!Number.isFinite(n)||n<Math.max(2,s*.22)){
        const lx=Number.isFinite(FEEL.lightX)?FEEL.lightX:1,ly=Number.isFinite(FEEL.lightY)?FEEL.lightY:0;
        n=Math.hypot(lx,ly)||1;dx=-lx/n;dy=-ly/n;
      }else{dx/=n;dy/=n;}
      ctx.save();ctx.globalAlpha*=clamp(alpha,0,1);ctx.imageSmoothingEnabled=true;
      ctx.translate(footX,footY);ctx.rotate(Math.atan2(dy,dx));
      for(let i=layers.length-1;i>=0;i--){
        const key=Math.round(s)+'|'+i;
        let image=cache.get(key);if(!image){image=texture(s,layers[i]);cache.set(key,image);}
        ctx.drawImage(image.canvas,-image.anchorX,-image.anchorY);
      }
      ctx.restore();
    };
  };

  const blurAlpha = (input,width,height,radius) => {
    if(radius<=0) return input;
    let src=input,dst=new Float32Array(input.length);
    for(let pass=0;pass<2;pass++){
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        let sum=0,count=0;
        for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
          const xx=x+ox,yy=y+oy;if(xx<0||yy<0||xx>=width||yy>=height)continue;
          sum+=src[yy*width+xx];count++;
        }
        dst[y*width+x]=sum/count;
      }
      [src,dst]=[dst,new Float32Array(input.length)];
    }
    return src;
  };
  const silhouetteTexture = (image,size) => {
    const started=performance.now(),sourceSize=Math.min(32,image.naturalWidth||image.width||16);
    const source=document.createElement('canvas');source.width=source.height=sourceSize;
    const sourceCtx=source.getContext('2d',{willReadFrequently:true});sourceCtx.imageSmoothingEnabled=false;
    sourceCtx.drawImage(image,0,0,sourceSize,sourceSize);
    const sourceData=sourceCtx.getImageData(0,0,sourceSize,sourceSize).data;
    const cast=Math.max(8,Math.round(size*.58)),lateral=Math.max(6,Math.round(size*.38));
    const radius=Math.max(1,Math.round(size*.035)),pad=radius*3+3;
    const width=cast+pad*2+4,height=lateral+pad*2+4,anchorX=pad+1,anchorY=Math.floor(height/2);
    const alpha=new Float32Array(width*height),dot=Math.max(1,Math.round(size/sourceSize*.62));
    for(let sy=0;sy<sourceSize;sy++)for(let sx=0;sx<sourceSize;sx++){
      const a=sourceData[(sy*sourceSize+sx)*4+3]/255;if(a<.12)continue;
      const height01=(sourceSize-1-sy)/(sourceSize-1),along=Math.round(height01*cast);
      const side=Math.round((sx/(sourceSize-1)-.5)*lateral),fade=.95-height01*.50;
      for(let oy=-dot;oy<=dot;oy++)for(let ox=-dot;ox<=dot;ox++){
        const px=anchorX+along+ox,py=anchorY+side+oy;if(px<0||py<0||px>=width||py>=height)continue;
        alpha[py*width+px]=Math.max(alpha[py*width+px],a*fade);
      }
    }
    const softened=blurAlpha(alpha,width,height,radius),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d'),out=context.createImageData(width,height),data=out.data;
    for(let i=0;i<softened.length;i++){
      const a=Math.round(Math.min(1,softened[i])*.62*255);if(!a)continue;
      const p=i*4;data[p]=7;data[p+1]=9;data[p+2]=20;data[p+3]=a;
    }
    context.putImageData(out,0,0);
    window.__shadowMetrics.builds++;window.__shadowMetrics.pixels+=width*height;
    window.__shadowMetrics.ms+=performance.now()-started;
    return {canvas,anchorX,anchorY};
  };
  window.__shadowMetrics={builds:0,pixels:0,ms:0};
  window.__setSilhouetteProposal = withContact => {
    const cache=new Map(),contactCache=new Map();
    window.drawFeelGroundShadow=(x,y,size,scale=1,alpha=1,sourceX=innerWidth/2,sourceY=innerHeight/2)=>{
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0)return;
      const s=Math.max(2,size*scale),footX=Math.round(x),footY=Math.round(y+s*.39);
      let dx=x-sourceX,dy=y-sourceY,n=Math.hypot(dx,dy);
      if(!Number.isFinite(n)||n<Math.max(2,s*.22)){
        const lx=Number.isFinite(FEEL.lightX)?FEEL.lightX:1,ly=Number.isFinite(FEEL.lightY)?FEEL.lightY:0;
        n=Math.hypot(lx,ly)||1;dx=-lx/n;dy=-ly/n;
      }else{dx/=n;dy/=n;}
      let ref=null,best=Infinity;
      for(const candidate of window.__shadowRefs){
        const point=candidate.point(),sx=innerWidth/2+(point.x-P.x)*TS,sy=innerHeight/2+(point.y-P.y)*TS;
        const distance=Math.hypot(x-sx,y-sy);if(distance<best){best=distance;ref=candidate;}
      }
      if(!ref||!ref.image())return;
      const bucket=Math.max(8,Math.round(s/2)*2),key=ref.id+'|'+bucket;
      let shadow=cache.get(key);if(!shadow){shadow=silhouetteTexture(ref.image(),bucket);cache.set(key,shadow);}
      ctx.save();ctx.globalAlpha*=clamp(alpha,0,1);ctx.imageSmoothingEnabled=true;
      ctx.translate(footX,footY);ctx.rotate(Math.atan2(dy,dx));
      ctx.drawImage(shadow.canvas,-shadow.anchorX,-shadow.anchorY);
      if(withContact){
        let contact=contactCache.get(bucket);if(!contact){contact=texture(bucket,{center:0,rx:.24,ry:.052,alpha:165});contactCache.set(bucket,contact);}
        ctx.drawImage(contact.canvas,-contact.anchorX,-contact.anchorY);
      }
      ctx.restore();
    };
  };
});

// Let the title-to-game canvas fade finish before the first proposal capture.
await page.waitForTimeout(1200);

for (let index = 0; index < proposals.length; index++) {
  await page.evaluate(layers => { window.__setGroundingProposal(layers); draw(); }, proposals[index].layers);
  await page.screenshot({
    path: path.join(frameDir, `${String(index).padStart(2, '0')}-${proposals[index].id}.png`),
    clip: { x: 220, y: 185, width: 520, height: 350 },
  });
}

await page.evaluate(layers => { window.__setGroundingProposal(layers); draw(); }, proposals[1].layers);
await page.screenshot({path:path.join(silhouetteDir,'00-b-generic-contact-cast.png'),clip:{x:220,y:185,width:520,height:350}});
await page.evaluate(() => { window.__setSilhouetteProposal(false); draw(); });
await page.screenshot({path:path.join(silhouetteDir,'01-d-silhouette-fade.png'),clip:{x:220,y:185,width:520,height:350}});
await page.evaluate(() => { window.__setSilhouetteProposal(true); draw(); });
await page.screenshot({path:path.join(silhouetteDir,'02-e-silhouette-contact.png'),clip:{x:220,y:185,width:520,height:350}});

// Motion study: orbit one enemy around the hero so the projected silhouette
// continuously points away from the player light source. The last pose is not
// duplicated, which keeps the forward loop seam continuous.
const motionFrames = 32;
for (let index = 0; index < motionFrames; index++) {
  await page.evaluate(({index, motionFrames}) => {
    const enemy = W.enemies[0];
    const angle = -Math.PI / 2 + (index / motionFrames) * Math.PI * 2;
    enemy.x = P.x + Math.cos(angle) * 1.72;
    enemy.y = P.y + Math.sin(angle) * 1.18;
    P.dirx = Math.cos(angle);
    P.diry = Math.sin(angle);
    FEEL.lightX = P.dirx;
    FEEL.lightY = P.diry;
    draw();
  }, {index, motionFrames});
  await page.screenshot({
    path: path.join(motionDir, `${String(index).padStart(2, '0')}.png`),
    clip: {x:220,y:185,width:520,height:350},
  });
}

console.log(await page.evaluate(()=>({
  silhouetteBuilds:__shadowMetrics.builds,
  silhouettePixels:__shadowMetrics.pixels,
  silhouetteBuildMs:Number(__shadowMetrics.ms.toFixed(2)),
})));

await browser.close();
if(errors.length) throw new Error(errors.join('\n'));
