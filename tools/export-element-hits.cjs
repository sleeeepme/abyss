const fs=require('fs'),vm=require('vm'),path=require('path');
const {Canvas}=require('./canvas-command-recorder.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/element-hits-v13');
const scope={window:{},Image:class{complete=true;naturalWidth=16;},console};vm.createContext(scope);
for(const name of ['ally-effect-study.js','element-hit-gallery.js'])vm.runInContext(fs.readFileSync(path.join(root,'proto',name),'utf8'),scope);
const fx=scope.window.AllyEffectStudy,gallery=scope.window.ElementHitGallery,frames=[];
for(let i=0;i<32;i++){
  const frame={age:i*.02};
  for(const element of gallery.elements){const c=new Canvas();gallery.scene(c,element,i*.02);frame[element]=c.commands;if(c.stack.length||c.globalAlpha!==1||c.filter!=='none')throw Error('Canvas state leak');}
  frames.push(frame);
}
const previous=JSON.parse(fs.readFileSync(path.join(root,'output/element-hits-v12/frames.json'),'utf8'));
for(let i=0;i<frames.length;i++)for(const element of ['fire','frost','arcane']){
  if(JSON.stringify(frames[i][element])!==JSON.stringify(previous[i][element]))throw Error('Unrequested element changed: '+element);
}
// A target flag may tune chip count, but never the elemental symbol itself.
for(const element of gallery.elements){for(const age of [0,.04,.08,.14,.22,.36,.48]){
  const ally=new Canvas(),enemy=new Canvas();fx.renderElementHit(ally,{element,age,x:0,y:0,target:'ally'});fx.renderElementHit(enemy,{element,age,x:0,y:0,target:'enemy'});
  if(!ally.commands.length&&!enemy.commands.length&&age>0&&age<.3)throw Error('Missing hit frame '+element+' '+age);
  const stripChips=cs=>cs.filter(c=>{const xs=c.points?.map(p=>p[0])||[];return xs.length&&Math.max(...xs)-Math.min(...xs)>12;});
  if(JSON.stringify(stripChips(ally.commands))!==JSON.stringify(stripChips(enemy.commands)))throw Error('Target changed elemental symbol');
}}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify(frames));
console.log('Captured longer lightning hit; fire, frost, and magic verified unchanged.');
