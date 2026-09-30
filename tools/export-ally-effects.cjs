// Offline Canvas command capture: executes the same study and preview sources.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const {Canvas}=require('./canvas-command-recorder.cjs');
const els={};
for(const id of ['slash','blunt','film','speed','direction','heavy','hit','solo','loop','pause','replay','step','scrub','time','phase']){const ctx=new Canvas();els[id]={checked:['hit','loop'].includes(id),value:id==='speed'?'1':'0',getContext:()=>ctx,ctx};}
const scope={window:{},document:{getElementById:id=>els[id],addEventListener(){}},matchMedia:()=>({matches:false}),Image:class {complete=true;naturalWidth=64;},requestAnimationFrame(){},console};
vm.createContext(scope);
for(const f of ['ally-effect-study.js','ally-effect-study-preview.js'])vm.runInContext(fs.readFileSync(path.join(root,'proto',f),'utf8'),scope);
const frames=[];
for(let i=0;i<43;i++){
 els.slash.ctx.commands=[];els.blunt.ctx.commands=[];
 els.scrub.value=String(Math.min(i*20,700));els.scrub.oninput();
 frames.push({age:i*20,slash:els.slash.ctx.commands,blunt:els.blunt.ctx.commands});
}
const output=path.join(root,'output/ally-effects-v3');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'frames.json'),JSON.stringify(frames));
