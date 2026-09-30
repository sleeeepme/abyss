const fs=require('fs'),vm=require('vm'),path=require('path');
const {Canvas}=require('./canvas-command-recorder.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/combined-element-effects-v13');
const scope={window:{},Image:class{complete=true;naturalWidth=64;},console};vm.createContext(scope);
for(const name of ['ally-effect-study.js','weapon-effect-gallery.js'])vm.runInContext(fs.readFileSync(path.join(root,'proto',name),'utf8'),scope);
const fx=scope.window.AllyEffectStudy,gallery=scope.window.WeaponEffectGallery;
const elements=['fire','shock','frost','arcane'],frames=[],step=.025,count=40;
for(let i=0;i<count;i++){
  const frame={age:i*step};
  for(const kind of gallery.keys)for(const element of elements){
    const c=new Canvas();gallery.scene(c,kind,i*step,{element,elementHit:true});
    if(c.stack.length||c.globalAlpha!==1||c.filter!=='none')throw Error('Canvas state leak');
    frame[kind+'-'+element]=c.commands;
  }
  frames.push(frame);
}
// Before contact the optional hit layer is absent; after contact it adds geometry.
for(const kind of gallery.keys)for(const element of elements){
  const cfg=fx.weapons[kind],before=new Canvas(),beforeBase=new Canvas(),after=new Canvas(),afterBase=new Canvas();
  gallery.scene(before,kind,Math.max(0,cfg.contact-.01),{element,elementHit:true});
  gallery.scene(beforeBase,kind,Math.max(0,cfg.contact-.01),{element,elementHit:false});
  gallery.scene(after,kind,cfg.contact+.06,{element,elementHit:true});
  gallery.scene(afterBase,kind,cfg.contact+.06,{element,elementHit:false});
  if(JSON.stringify(before.commands)!==JSON.stringify(beforeBase.commands))throw Error('Hit appeared before contact');
  if(after.commands.length<=afterBase.commands.length)throw Error('Hit missing after contact');
}
const previous=JSON.parse(fs.readFileSync(path.join(root,'output/combined-element-effects-v12/frames.json'),'utf8'));
for(let i=0;i<frames.length;i++)for(const kind of gallery.keys)for(const element of ['fire','frost','arcane']){
  const key=kind+'-'+element;
  if(JSON.stringify(frames[i][key])!==JSON.stringify(previous.frames[i][key]))throw Error('Unrequested combined effect changed: '+key);
}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify({elements,weapons:fx.weapons,frames}));
console.log('Captured longer lightning hits across 7 weapons; other elements verified unchanged.');
