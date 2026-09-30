/* Generated concept-art materials on the accepted v2 floor/wall topology. */
(()=>{'use strict';const base=StoneTerrainV2,T=base.T,images={},info=STONE_V3_PARTS;const P={...base.P,void:'#211f24',floor:'#aa9383'};
const ready=Promise.all(Object.entries(info.assets).map(([id,a])=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>{images[id]=im;ok();};im.onerror=()=>no(Error('Could not load '+id));im.src='assets/stone-map-study-v3/'+a.file;})));
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
// Quilt overlapping source patches along low-error pixel seams, avoiding mirrored slabs.
function quilt(ctx,w,h){const sc=canvas(256,256),cc=sc.getContext('2d');cc.drawImage(images.floor,0,0);const src=cc.getImageData(0,0,256,256).data,out=ctx.createImageData(w,h),dst=out.data,N=112,O=20,step=N-O;
 const err=(a,b)=>{const r=src[a]-dst[b],g=src[a+1]-dst[b+1],bl=src[a+2]-dst[b+2];return r*r+g*g+bl*bl;};
 for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const pw=Math.min(N,w-x),ph=Math.min(N,h-y);let sx=0,sy=0,best=Infinity;
 for(let k=0;k<10;k++){const ax=Math.floor(base.hash(x+k*47,y,113)*(256-N)),ay=Math.floor(base.hash(x,y+k*31,114)*(256-N));let score=0;
 if(x)for(let j=0;j<ph;j+=3)for(let i=0;i<O;i+=3)score+=err(((ay+j)*256+ax+i)*4,((y+j)*w+x+i)*4);
 if(y)for(let j=0;j<O;j+=3)for(let i=0;i<pw;i+=3)score+=err(((ay+j)*256+ax+i)*4,((y+j)*w+x+i)*4);
 if(score<best){best=score;sx=ax;sy=ay;}}
 function seam(vertical){const rows=vertical?ph:pw,cols=Math.min(O,vertical?pw:ph),cost=new Float64Array(rows*cols),parent=new Int16Array(rows*cols);for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){const i=vertical?q:r,j=vertical?r:q,z=r*cols+q;let v=0,prev=q;if(r){v=Infinity;for(let k=Math.max(0,q-1);k<=Math.min(cols-1,q+1);k++)if(cost[(r-1)*cols+k]<v){v=cost[(r-1)*cols+k];prev=k;}}cost[z]=v+err(((sy+j)*256+sx+i)*4,((y+j)*w+x+i)*4);parent[z]=prev;}const cut=new Int16Array(rows);let q=0;for(let i=1;i<cols;i++)if(cost[(rows-1)*cols+i]<cost[(rows-1)*cols+q])q=i;for(let r=rows-1;r>=0;r--){cut[r]=q;q=parent[r*cols+q];}return cut;}
 const left=x?seam(true):null,top=y?seam(false):null;
 for(let j=0;j<ph;j++)for(let i=0;i<pw;i++){if(left&&i<O&&i<left[j]||top&&j<O&&j<top[i])continue;const a=((sy+j)*256+sx+i)*4,b=((y+j)*w+x+i)*4;dst[b]=src[a];dst[b+1]=src[a+1];dst[b+2]=src[a+2];dst[b+3]=255;}}
 ctx.putImageData(out,0,0);
}
function create(map){const w=map.width*T,h=map.height*T,walk=(x,y)=>[1,2].includes(map.cells[y]?.[x]);const floor=canvas(w,h),walls=canvas(w,h),depth=canvas(w,h),mask=canvas(w,h),wallmask=canvas(w,h),f=floor.getContext('2d'),c=walls.getContext('2d'),d=depth.getContext('2d'),mk=mask.getContext('2d'),wm=wallmask.getContext('2d'),edges=[];
 for(const ctx of[f,c,d,mk,wm])ctx.imageSmoothingEnabled=false;mk.fillStyle=wm.fillStyle='#fff';for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)(walk(x,y)?mk:wm).fillRect(x*T,y*T,T,T);
 quilt(f,w,h);
 function strip(id,x,y,length,north){const im=images[id],width=288,height=Math.round(im.height*width/im.width),phase=Math.floor(base.hash(y,x,81)*120);c.save();c.beginPath();c.rect(x,y-(north?height:0),length,height);c.clip();for(let xx=x-phase;xx<x+length;xx+=width)c.drawImage(im,xx,y-(north?height:0),width,height);c.restore();}
 // Back walls are continuous strips, not one rock per cell.
 for(let y=0;y<map.height;y++){let x=0;while(x<map.width){if(walk(x,y)&&!walk(x,y-1)){const start=x;while(x<map.width&&walk(x,y)&&!walk(x,y-1))x++;const xx=start*T,yy=y*T,len=(x-start)*T;
 // Cool distant mist sits behind the cliff, only in the wall region.
 if(len>=T*3){for(let k=0;k<5;k++){const color=['#24252b','#262a30','#29313a','#2d3942','#33424b'][k],dh=54-k*7;const pts=[[xx,yy-14],[xx-10,yy-dh],[xx+len*.22,yy-dh-19],[xx+len*.48,yy-dh-8],[xx+len*.68,yy-dh-24],[xx+len,yy-dh+9],[xx+len+6,yy-14]];base.poly(d,pts,color);}}
 strip((start+y)%3===0?'north-b':'north-a',xx,yy,len,true);
 for(let q=start;q<x;q++)edges.push({x:q,y,side:'north'});
 }else x++;}}
 // Side walls retain their own oblique stone faces. They never rotate a front wall.
 for(const [id,side,dx]of [['west','west',-1],['east','east',1]])for(let x=0;x<map.width;x++){let y=0;while(y<map.height){if(walk(x,y)&&!walk(x+dx,y)){const start=y;while(y<map.height&&walk(x,y)&&!walk(x+dx,y))y++;const xx=(x+(dx===1?1:0))*T,yy=start*T,len=(y-start)*T,im=images[id],width=id==='west'?36:42,height=Math.round(im.height*width/im.width),left=dx===1?xx:xx-width,phase=Math.floor(base.hash(x,start,88)*70);c.save();c.beginPath();c.rect(left,yy,width,len);c.clip();for(let sy=yy-phase;sy<yy+len;sy+=height)c.drawImage(im,left,sy,width,height);c.restore();for(let q=start;q<y;q++)edges.push({x,y:q,side});}else y++;}}
 for(let y=0;y<map.height;y++){let x=0;while(x<map.width){if(walk(x,y)&&!walk(x,y+1)){const start=x;while(x<map.width&&walk(x,y)&&!walk(x,y+1))x++;strip('south',start*T,(y+1)*T,(x-start)*T,false);for(let q=start;q<x;q++)edges.push({x:q,y,side:'south'});}else x++;}}
 // Short contact shadows settle the rock onto the floor; keep the walkable surface visible.
 const fd=f.getImageData(0,0,w,h),pix=fd.data,pal=info.palette.map(h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16))),cache=new Map();
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const gx=xx/T|0,gy=yy/T|0;if(!walk(gx,gy))continue;const px=xx%T,py=yy%T;let shade=0;if(!walk(gx,gy-1)&&py<8)shade=Math.max(shade,Math.ceil((8-py)/2));if(!walk(gx-1,gy)&&px<4)shade=Math.max(shade,Math.ceil((4-px)/2));if(!shade)continue;const i=(yy*w+xx)*4,key=pix[i]+','+pix[i+1]+','+pix[i+2]+','+shade;let rgb=cache.get(key);if(!rgb){let best=1e9;for(const q of pal){const mul=1-shade*.035,dist=(q[0]-pix[i]*mul)**2+(q[1]-pix[i+1]*mul)**2+(q[2]-pix[i+2]*mul)**2;if(dist<best){best=dist;rgb=q;}}cache.set(key,rgb);}pix.set(rgb,i);}
 f.putImageData(fd,0,0);
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(map.cells[y][x]===2){const xx=x*T,yy=y*T;f.fillStyle='#534c48';f.fillRect(xx+3,yy+3,18,18);for(let k=0;k<4;k++){f.fillStyle=k<2?'#d0b5a1':'#aa9383';f.fillRect(xx+4,yy+4+k*4,16,2);}}
 for(const [ctx,m]of [[f,mask],[c,wallmask],[d,wallmask]]){ctx.globalCompositeOperation='destination-in';ctx.drawImage(m,0,0);ctx.globalCompositeOperation='source-over';}
 return{floor,walls,depth,mask,wallmask,edges,width:w,height:h,walk};}
window.StoneTerrainV3={...base,P,ready,create,images};})();
