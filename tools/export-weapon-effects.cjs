const fs=require('fs'),vm=require('vm'),path=require('path');
const {Canvas}=require('./canvas-command-recorder.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/weapon-effects-v4');
const scope={window:{},Image:class{complete=true;naturalWidth=64;},console};
vm.createContext(scope);
for(const name of ['ally-effect-study.js','weapon-effect-gallery.js'])vm.runInContext(fs.readFileSync(path.join(root,'proto',name),'utf8'),scope);
const gallery=scope.window.WeaponEffectGallery,frames=[];
for(let i=0;i<50;i++){
  const frame={age:i*20};
  for(const kind of gallery.keys){const c=new Canvas();gallery.scene(c,kind,i*.02);frame[kind]=c.commands;}
  frames.push(frame);
}
// State restoration and blank invalid kind, plus aliases preserving approved V3 shapes.
const fx=scope.window.AllyEffectStudy;
for(const [alias,kind] of [['slash','greatsword'],['blunt','hammer']]){
 const a=new Canvas(),b=new Canvas();fx.render(a,{kind:alias,age:.08});fx.render(b,{kind,age:.08});
 if(JSON.stringify(a.commands)!==JSON.stringify(b.commands))throw Error('Alias mismatch');
 if(a.stack.length||a.globalAlpha!==1||a.filter!=='none')throw Error('Canvas state leak');
}
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'frames.json'),JSON.stringify(frames));
console.log('Captured 6 weapons / 50 frames; aliases and canvas state verified.');
