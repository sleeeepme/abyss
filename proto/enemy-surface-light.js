/* Independent native-grid lighting prototype. Does not install game hooks.
 * Normal-map Y is positive up, as in Pixel Art Lighter v3.5.23.
 * Diffuse / attenuation and sRGB conversion follow that tool's public MIT renderer.
 * Third-party notice: MIT license and attribution in pixel-art-lighter-core.js.
 */
(function(root){
 'use strict';
 const linear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
 const srgb=v=>Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055));
 function prepare(w,h,albedo,normal,mask){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)throw Error('Invalid sprite dimensions');
  const count=w*h;
  if(albedo.length!==count*4||(normal&&normal.length!==count*4)||(mask&&mask.length!==count*4))throw Error('Texture dimensions must match');
  const base=new Float32Array(count*3),normals=new Float32Array(count*3),receive=new Float32Array(count);
  for(let i=0;i<count;i++){
   let x=normal?normal[i*4]/127.5-1:0,y=normal?normal[i*4+1]/127.5-1:0,z=normal?normal[i*4+2]/127.5-1:1;
   const length=Math.hypot(x,y,z)||1;
   normals.set([x/length,y/length,z/length],i*3);
   for(let c=0;c<3;c++)base[i*3+c]=linear(albedo[i*4+c]);
   receive[i]=mask?(.2126*mask[i*4]+.7152*mask[i*4+1]+.0722*mask[i*4+2])/255:1;
  }
  return {w,h,albedo:Uint8ClampedArray.from(albedo),base,normals,receive};
 }
 function shade(sprite,options={}){
  const {w,h,base,normals,receive,albedo}=sprite,out=new Uint8ClampedArray(w*h*4);
  const ambient=options.ambient??.38,mix=options.maskMix??.6,steps=options.steps??6;
  const ox=options.origin?.[0]??0,oy=options.origin?.[1]??0,flat=options.flat??false;
  const lights=(options.lights||[]).map(l=>({...l,z:l.z??42,power:l.power??1.8,radius:l.radius??110,color:(l.color||[255,255,255]).map(linear)}));
  for(let i=0;i<w*h;i++){
   out[i*4+3]=albedo[i*4+3];if(!albedo[i*4+3])continue;
   let r=ambient,g=ambient,b=ambient;const x=i%w+ox,y=Math.floor(i/w)+oy;
   for(const light of lights){
    const dx=light.x-x,dy=y-light.y,d=Math.max(.000001,Math.hypot(dx,dy,light.z));
    let diffuse=Math.max(0,flat?light.z/d:(normals[i*3]*dx+normals[i*3+1]*dy+normals[i*3+2]*light.z)/d);
    if(steps>1)diffuse=Math.round(diffuse*(steps-1))/(steps-1);
    const attenuation=1/(1+(d/Math.max(.000001,light.radius))**2);
    const direct=light.power*diffuse*attenuation*(1-mix+mix*receive[i]);
    r+=direct*light.color[0];g+=direct*light.color[1];b+=direct*light.color[2];
   }
   out[i*4]=Math.max(0,Math.min(255,srgb(base[i*3]*r)));
   out[i*4+1]=Math.max(0,Math.min(255,srgb(base[i*3+1]*g)));
   out[i*4+2]=Math.max(0,Math.min(255,srgb(base[i*3+2]*b)));
  }
  return out;
 }
 function generate(w,h,albedo,options={}){
  const core=options.generator||root.PixelArtLighterCore;
  if(!core)return prepare(w,h,albedo);
  const common={hide:false,bg:[0,0,0],hints:null,merge:true,edgeWidth:2,normalStrength:140};
  const input={w,h,data:albedo};
  const normal=core.generateTexture(input,{...common,kind:'normal',preset:'character',strength:75,facets:15}).data;
  const mask=core.generateTexture(input,{...common,kind:'mask',preset:'object',strength:100,floor:24,ceiling:255,cavity:30}).data;
  return prepare(w,h,albedo,normal,mask);
 }
 const api={prepare,shade,generate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AbyssSurfaceLight=api;
})(typeof globalThis!=='undefined'?globalThis:this);
