const fs=require('fs'),vm=require('vm'),path=require('path');
const {Canvas}=require('./canvas-command-recorder.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/element-effects-v5');
const scope={window:{},Image:class{complete=true;naturalWidth=64;},console};vm.createContext(scope);
for(const name of ['ally-effect-study.js','weapon-effect-gallery.js'])vm.runInContext(fs.readFileSync(path.join(root,'proto',name),'utf8'),scope);
const fx=scope.window.AllyEffectStudy,gallery=scope.window.WeaponEffectGallery;
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'palette.json'),JSON.stringify({elements:fx.elements,weapons:fx.weapons}));
// Each file holds an actual render with the requested element (no image recoloring).
for(const kind of gallery.keys){
 for(const element of Object.keys(fx.elements)){
  const frames=[];
  for(let i=0;i<40;i++){
   const c=new Canvas();gallery.scene(c,kind,i*.025,{element});
   if(c.stack.length||c.globalAlpha!==1||c.filter!=='none')throw Error('Canvas state leak');
   frames.push(c.commands);
  }
  fs.writeFileSync(path.join(output,kind+'-'+element+'.json'),JSON.stringify(frames));
 }
 console.log('Captured '+kind+' in 5 palettes');
}
// Verify palette changes affect colors only, and accepted neutral effects match V4.
const oldScope={window:{}};vm.createContext(oldScope);vm.runInContext(fs.readFileSync(path.join(root,'output/weapon-effects-v4/ally-effect-study-v4.js'),'utf8'),oldScope);
const geometry=commands=>commands.map(({color,...rest})=>rest);
for(const kind of gallery.keys){for(const age of [.04,.08,.12,.2,.3,.42,.55]){
 const neutral=new Canvas();fx.render(neutral,{kind,age});
 if(kind!=='magicbolt'){
  const old=new Canvas();oldScope.window.AllyEffectStudy.render(old,{kind,age});
  if(JSON.stringify(old.commands)!==JSON.stringify(neutral.commands))throw Error('Approved effect changed: '+kind);
 }
 for(const element of Object.keys(fx.elements)){
  const c=new Canvas();fx.render(c,{kind,age,element});
  if(JSON.stringify(geometry(c.commands))!==JSON.stringify(geometry(neutral.commands)))throw Error('Palette changed geometry');
 }
}}
console.log('Verified: approved effects unchanged; palettes preserve geometry and timing.');
