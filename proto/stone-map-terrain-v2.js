/* Stone terrain study: orthogonal cells, directional cutaway walls. No gameplay mutation. */
(()=>{'use strict';
const T=24;
const P={void:'#211f24',cap:'#2b272b',wallDark:'#3a3030',wall:'#4d3d34',wallLight:'#624b38',wallLit:'#75563c',seam:'#3d332e',floor:'#88643f',earth:'#805d3b',earthLight:'#8d6742',stone:'#936e48',slab:'#ac855b',slabLight:'#bc966a',slabShade:'#87623f',crack:'#745434',chip:'#987146',moss:'#71613c',mossDark:'#5b5034'};
const hash=(x,y,s=0)=>{let n=Math.imul(x+157,374761393)^Math.imul(y+379,668265263)^Math.imul(s+17,1274126177);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
// Integer scanline fills: no antialiasing or subpixel edge colours.
function poly(c,points,color){c.fillStyle=color;const lo=Math.ceil(Math.min(...points.map(p=>p[1]))),hi=Math.ceil(Math.max(...points.map(p=>p[1])));for(let y=lo;y<hi;y++){const xs=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))xs.push(a[0]+(y+.5-a[1])/(b[1]-a[1])*(b[0]-a[0]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)c.fillRect(Math.ceil(xs[i]-.5),y,Math.ceil(xs[i+1]-.5)-Math.ceil(xs[i]-.5),1);}}
function line(c,a,b,color){c.fillStyle=color;let[x,y]=a.map(Math.round);const[x1,y1]=b.map(Math.round),dx=Math.abs(x1-x),dy=-Math.abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1;let e=dx+dy;for(;;){c.fillRect(x,y,1,1);if(x===x1&&y===y1)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}
function rock(c,x,y,w,h,seed=0,light=false){const n=hash(x,y,seed),a=Math.round(w*.21),b=Math.round(w*.72);poly(c,[[x,y+3],[x+a,y],[x+b,y+1],[x+w,y+h*.4],[x+w-2,y+h],[x+3,y+h],[x-1,y+h*.6]],light?P.wallLight:P.wall);poly(c,[[x,y+3],[x+a,y],[x+b,y+1],[x+w,y+h*.4],[x+b,y+h*.48],[x+2,y+h*.43]],light?P.wallLit:P.wallLight);if(n>.35)line(c,[x+3,y+h],[x+w-3,y+h],P.wallDark);}
function wallNorth(c,x,y,w,h,seed=0){
 const a=Math.round(w*.27),b=Math.round(w*.7),rise=2+Math.floor(hash(seed,4)*6);
 poly(c,[[x,y-h+3],[x+a,y-h-rise],[x+b,y-h-1],[x+w,y-h+4],[x+w,y],[x,y]],P.wall);
 poly(c,[[x+1,y-h+4],[x+a,y-h-rise+3],[x+b,y-h+2],[x+b-3,y-9],[x+4,y-3]],P.wallLight);
 poly(c,[[x+b,y-h+2],[x+w,y-h+4],[x+w,y-1],[x+b-4,y-3],[x+b-3,y-9]],P.wallDark);
 if(hash(seed,1)>.4)poly(c,[[x+3,y-h+6],[x+a,y-h-rise+4],[x+a+4,y-h+9],[x+6,y-13]],P.wallLit);
 // Broken facets / seams, not a bright outline around every block.
 line(c,[x+2,y-12],[x+a,y-10],P.seam);line(c,[x+a,y-10],[x+b-3,y-12],P.seam);
 if(hash(seed,2)>.3)line(c,[x+a,y-h+6],[x+a+2,y-17],P.wallDark);
 poly(c,[[x,y-h+3],[x+a,y-h-rise],[x+b,y-h-1],[x+w,y-h+4],[x+w-3,y-h+7],[x+b,y-h+3],[x+a,y-h-rise+4],[x+2,y-h+7]],P.cap);
 for(let j=0;j<3;j++){const rx=x+j*w/3|0,rw=6+Math.floor(hash(seed,j,6)*7),rh=4+Math.floor(hash(seed,j,7)*5);rock(c,rx,y-rh,rw,rh,seed+j,j===1);}
}
function wallRun(c,x,y,w,seed){
 const pts=[[x,y],[x,y-36]],tops=[];
 for(let xx=0;xx<=w;xx+=8){const hh=37+Math.floor(hash(Math.floor((x+xx)/37),y,9)*10);tops.push([x+Math.min(xx,w),y-hh]);}tops.push([x+w,y-38]);
 poly(c,[[x,y],...tops,[x+w,y]],P.wallDark);
 poly(c,[[x,y-17],[x+w*.2,y-23],[x+w*.47,y-19],[x+w*.8,y-26],[x+w,y-21],[x+w,y],[x,y]],P.wall);
 let xx=x-4,k=0;
 while(xx<x+w){const ww=21+Math.floor(hash(xx,y,4)*25),hh=24+Math.floor(hash(xx,y,3)*17),a=xx+ww*.25,b=xx+ww*.72;
 poly(c,[[xx+2,y-8],[xx+1,y-hh+5],[a,y-hh],[b,y-hh+2],[xx+ww,y-hh+7],[xx+ww-2,y-10],[b,y-3],[a,y-5]],k%3===0?P.wall:P.wallDark);
 poly(c,[[xx+2,y-9],[xx+3,y-19],[a,y-24],[b,y-23],[b+2,y-12],[a+2,y-7]],k%3===1?P.wall:P.wallLight);
 if(k%2===0){line(c,[a+1,y-hh+7],[a-1,y-25],P.seam);line(c,[xx+4,y-18],[b-2,y-16],P.wallDark);}
 if(k%3===0)poly(c,[[xx+5,y-17],[a,y-21],[b,y-20],[b-2,y-17],[a+2,y-15]],P.wallLit);
 xx+=ww-3;k++;}
 // Uneven groups of small stones are restricted to the wall foot.
 for(let xx=x;xx<x+w;){const rw=4+Math.floor(hash(xx,y,11)*8),rh=3+Math.floor(hash(xx,y,12)*6);rock(c,xx,y-rh,rw,rh,xx+y,hash(xx,y,13)>.7);xx+=rw+Math.floor(hash(xx,y,14)*5);}
}
function wallSide(c,x,y,h,sign,seed){const w=5+Math.floor(hash(seed,5)*4);poly(c,[[x,y],[x+sign*w,y-7],[x+sign*(w+2),y+h-5],[x+sign*3,y+h+2],[x,y+h]],sign===1?P.wallDark:P.wall);poly(c,[[x,y],[x+sign*2,y+3],[x+sign*2,y+h-3],[x,y+h]],sign===1?P.wall:P.wallLight);if(hash(seed,6)>.5)rock(c,x+(sign===1?1:-6),y+h-8,6,5,seed,false);}
function wallSouth(c,x,y,w,seed){const h=7+Math.floor(hash(seed,7)*6);poly(c,[[x,y],[x+w,y],[x+w,y+h-3],[x+w*.68,y+h+2],[x+w*.4,y+h],[x+3,y+h+4],[x,y+h-1]],P.wallDark);poly(c,[[x,y],[x+w,y],[x+w-3,y+3],[x+w*.65,y+4],[x+w*.3,y+2],[x,y+4]],P.wall);}
function slab(c,x,y,w,h,seed){const pts=[[x+5,y],[x+w*.64,y-2],[x+w*.64,y+2],[x+w-2,y+2],[x+w,y+h*.45],[x+w-3,y+h*.45],[x+w-3,y+h-1],[x+w*.55,y+h-1],[x+w*.55,y+h+2],[x+3,y+h+2],[x+3,y+h*.67],[x,y+h*.67],[x,y+5]];poly(c,pts,P.slab);if(hash(seed,5)>.3)poly(c,[[x+5,y],[x+w*.64,y-2],[x+w*.64,y+1],[x+8,y+2],[x+8,y+5],[x+3,y+5]],P.slabLight);const cut=.35+hash(seed,12)*.35;line(c,[x+w*cut,y+3],[x+w*(cut-.06),y+h*.49],P.slabShade);line(c,[x+w*(cut-.06),y+h*.49],[x+w-5,y+h*.49+1],P.slabShade);if(w>28){line(c,[x+3,y+h*.65],[x+w*.3,y+h*.65],P.slabShade);line(c,[x+w*.3,y+h*.65],[x+w*.32,y+h-2],P.slabShade);}}
function floorTexture(c,w,h){c.fillStyle=P.floor;c.fillRect(0,0,w,h);
 for(let y=-50;y<h;y+=53)for(let x=-60;x<w;x+=69){const n=hash(x,y),cx=x+Math.floor(hash(x,y,2)*38),cy=y+Math.floor(hash(x,y,3)*30),ww=35+Math.floor(n*55),hh=20+Math.floor(hash(x,y,4)*40),pts=[];for(let k=0;k<16;k++){const a=k*Math.PI/8,r=.7+hash(x+k,y,5)*.3;pts.push([Math.round(cx+Math.cos(a)*ww*r),Math.round(cy+Math.sin(a)*hh*r)]);}poly(c,pts,n<.4?P.earth:n<.77?P.earthLight:P.stone);}
 for(let y=12;y<h;y+=37)for(let x=9;x<w;x+=43){const px=x+Math.floor(hash(x,y,7)*28),py=y+Math.floor(hash(x,y,8)*22),n=hash(x,y,9);if(n<.13)slab(c,px,py,23+Math.floor(hash(x,y,10)*31),10+Math.floor(hash(x,y,11)*16),x+y);
 else if(n<.46){for(let j=0;j<3+Math.floor(n*5);j++){const rx=px+Math.floor(hash(x+j,y,11)*22),ry=py+Math.floor(hash(x+j,y,12)*11),rw=2+Math.floor(hash(x+j,y,13)*4);c.fillStyle=P.chip;c.fillRect(rx,ry,rw,2);c.fillStyle=P.crack;c.fillRect(rx+1,ry+2,rw,1);}}
 else if(n<.83){const a=[px,py],b=[px+6,py+2],d=[px+8,py+7];line(c,a,b,P.crack);line(c,b,d,P.crack);if(n>.59){line(c,b,[px+11,py-1],P.crack);line(c,[px+11,py-1],[px+16,py],P.crack);}if(n<.58)line(c,d,[px+15,py+8],P.crack);}
 else{for(let j=0;j<4;j++){const rx=px+Math.floor(hash(x+j,y,15)*23),ry=py+Math.floor(hash(x+j,y,16)*12);poly(c,[[rx,ry+2],[rx+2,ry],[rx+6,ry],[rx+8,ry+2],[rx+6,ry+4],[rx+2,ry+4]],P.earth);line(c,[rx+2,ry+4],[rx+6,ry+4],P.crack);}}}
}
function create(map){const w=map.width*T,h=map.height*T,walk=(x,y)=>[1,2].includes(map.cells[y]?.[x]),floor=canvas(w,h),walls=canvas(w,h),shadow=canvas(w,h),f=floor.getContext('2d'),c=walls.getContext('2d'),s=shadow.getContext('2d'),mask=canvas(w,h),mk=mask.getContext('2d'),wallmask=canvas(w,h),wm=wallmask.getContext('2d'),edges=[];
 floorTexture(f,w,h);mk.fillStyle='#fff';wm.fillStyle='#fff';for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)(walk(x,y)?mk:wm).fillRect(x*T,y*T,T,T);
 f.globalCompositeOperation='destination-in';f.drawImage(mask,0,0);f.globalCompositeOperation='source-over';
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){if(!walk(x,y))continue;const xx=x*T,yy=y*T;
 if(!walk(x,y-1)){edges.push({x,y,side:'north'});s.fillStyle=P.earth;s.fillRect(xx,yy,T,3);}
 if(!walk(x-1,y)){edges.push({x,y,side:'west'});wallSide(c,xx,yy,T,-1,x+y*17);s.fillStyle=P.earth;s.fillRect(xx,yy,2,T);}
 if(!walk(x+1,y)){edges.push({x,y,side:'east'});wallSide(c,xx+T,yy,T,1,x+y*17);}
 if(!walk(x,y+1)){edges.push({x,y,side:'south'});wallSouth(c,xx,yy+T,T,x+y*17);}
 if(map.cells[y][x]===2){f.fillStyle=P.wallDark;f.fillRect(xx+3,yy+3,T-6,T-6);for(let k=0;k<4;k++){f.fillStyle=k<2?P.slab:P.stone;f.fillRect(xx+4,yy+4+k*4,T-8,2);}}
 }
 for(const e of edges){if(hash(e.x,e.y,28)>.27)continue;const xx=e.x*T,yy=e.y*T;
 const gx=xx+4+Math.floor(hash(e.x,e.y,29)*14),gy=e.side==='north'?yy+3:e.side==='south'?yy+T-2:yy+10;
 if(e.side==='north'||e.side==='south')for(let j=0;j<4;j++){const hh=2+Math.floor(hash(e.x+j,e.y,30)*3);line(f,[gx+j*2,gy],[gx+j*2-1,gy-hh],j%2?P.moss:P.mossDark);}}
 // North-facing wall runs share one connected mass, rather than one rock per cell.
 for(let y=0;y<map.height;y++){let x=0;while(x<map.width){if(walk(x,y)&&!walk(x,y-1)){const start=x;while(x<map.width&&walk(x,y)&&!walk(x,y-1))x++;wallRun(c,start*T,y*T,(x-start)*T,start+y*17);}else x++;}}
 // Enforce the gameplay footprint even where two corridors share a thin wall.
 c.globalCompositeOperation='destination-in';c.drawImage(wallmask,0,0);c.globalCompositeOperation='source-over';
 s.globalCompositeOperation='destination-in';s.drawImage(mask,0,0);s.globalCompositeOperation='source-over';f.drawImage(shadow,0,0);f.globalCompositeOperation='destination-in';f.drawImage(mask,0,0);f.globalCompositeOperation='source-over';
 return{floor,walls,mask,wallmask,edges,width:w,height:h,walk};}
function sheet(){const cv=canvas(256,184),c=cv.getContext('2d');c.fillStyle=P.void;c.fillRect(0,0,256,184);wallRun(c,12,64,90,8);wallSide(c,130,24,48,-1,3);wallSide(c,155,24,48,1,4);wallSouth(c,185,26,55,9);slab(c,15,93,42,21,2);rock(c,86,94,16,10,2,true);const fl=canvas(80,48);floorTexture(fl.getContext('2d'),80,48);c.drawImage(fl,161,91);return cv;}
window.StoneTerrainV2={T,P,hash,poly,line,create,sheet,wallNorth,wallRun,wallSide,wallSouth,slab,rock,floorTexture};
})();
