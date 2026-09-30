const fs=require('fs'),vm=require('vm'),path=require('path');
const {Canvas}=require('./canvas-command-recorder.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/weapon-art-effects-v44');
const scope={window:{},Image:class{complete=true;naturalWidth=64;},console};vm.createContext(scope);
for(const name of ['ally-effect-study.js','weapon-art-effect-study.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'proto',name),'utf8'),scope);
const gallery=scope.window.WeaponArtEffectStudy,frames=[];
for(let i=0;i<70;i++){const frame={age:i*.02};for(const key of gallery.keys){const c=new Canvas();gallery.scene(c,key,i*.02);frame[key]=c.commands;if(c.stack.length||c.globalAlpha!==1||c.filter!=='none')throw Error('Canvas state leak: '+key);}frames.push(frame);}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify(frames));
console.log('Captured '+gallery.keys.length+' weapon arts / '+frames.length+' frames.');
