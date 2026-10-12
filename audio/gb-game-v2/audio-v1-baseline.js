/* GB-inspired SFX and bounded mixer. No gameplay RNG, timers or state are changed. */
(() => {
  'use strict';
  const KEY='abyss.audio.v1', TAU=Math.PI*2;
  // pulse = GB pulse slots; noise = the single noise slot. Wave slot is unused.
  const defs={
    slash:{name:'斬撃',bus:'combat',gain:.58,priority:42,cooldown:180,length:.13,pulse:0,noise:1,shape:'slash'},
    blunt:{name:'打撃',bus:'combat',gain:.6,priority:43,cooldown:210,length:.15,pulse:1,noise:1,shape:'blunt'},
    arrow:{name:'弓の発射',bus:'combat',gain:.42,priority:40,cooldown:220,length:.10,pulse:0,noise:1,shape:'arrow'},
    magic:{name:'魔弾',bus:'combat',gain:.50,priority:45,cooldown:240,length:.23,pulse:1,noise:1,shape:'magic'},
    hit:{name:'敵への命中',bus:'combat',gain:.30,priority:30,cooldown:150,length:.075,pulse:0,noise:1,shape:'hit'},
    critical:{name:'会心',bus:'feedback',gain:.52,priority:65,cooldown:260,length:.16,pulse:1,noise:0,notes:[1175,1760]},
    hurt:{name:'自分の被弾',bus:'feedback',gain:.65,priority:90,cooldown:330,length:.19,pulse:1,noise:1,shape:'hurt'},
    guard:{name:'盾の防御',bus:'feedback',gain:.48,priority:82,cooldown:230,length:.12,pulse:1,noise:0,notes:[740,370]},
    parry:{name:'パリイ／ジャスト回避',bus:'feedback',gain:.6,priority:95,cooldown:350,length:.24,pulse:1,noise:0,notes:[1175,1760,2349]},
    dash:{name:'ダッシュ',bus:'combat',gain:.28,priority:50,cooldown:300,length:.085,pulse:0,noise:1,shape:'arrow'},
    skill:{name:'武器技／大技',bus:'feedback',gain:.54,priority:75,cooldown:650,length:.32,pulse:1,noise:1,shape:'skill'},
    defeat:{name:'敵の消滅',bus:'combat',gain:.25,priority:24,cooldown:350,length:.14,pulse:1,noise:0,notes:[440,220]},
    boss:{name:'ボス撃破',bus:'feedback',gain:.6,priority:99,cooldown:2000,length:.65,pulse:2,noise:0,notes:[587,740,880,1175]},
    death:{name:'戦闘不能',bus:'feedback',gain:.58,priority:100,cooldown:2000,length:.55,pulse:1,noise:0,notes:[440,330,220,110]},
    pickup:{name:'アイテム取得',bus:'world',gain:.38,priority:55,cooldown:300,length:.12,pulse:1,noise:0,notes:[988,1480]},
    heal:{name:'消耗品の使用',bus:'world',gain:.45,priority:70,cooldown:450,length:.25,pulse:1,noise:0,notes:[659,880,1319]},
    level:{name:'自分のレベルアップ',bus:'feedback',gain:.55,priority:96,cooldown:1300,length:.46,pulse:1,noise:0,notes:[587,740,880,1175]},
    floor:{name:'階層移動',bus:'world',gain:.32,priority:68,cooldown:1000,length:.3,pulse:1,noise:0,notes:[294,440,587]},
    ui:{name:'選択／決定',bus:'ui',gain:.30,priority:60,cooldown:90,length:.10,pulse:1,noise:0,notes:[1175,1760]},
    back:{name:'閉じる／戻る',bus:'ui',gain:.25,priority:60,cooldown:100,length:.085,pulse:1,noise:0,notes:[880,587]}
  };
  const defaults={version:1,enabled:true,master:.35,maxEvents:2,maxStarts:8,ally:.25,distance:8,duck:.3,tail:1,
    buses:{combat:.70,feedback:.90,world:.65,ui:.6},sounds:Object.fromEntries(Object.entries(defs).map(([k,d])=>[k,{enabled:true,gain:d.gain,cooldown:d.cooldown}]))};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const clamp=(x,a,b,f)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):f;
  function sanitize(v={}){
    if(!v||typeof v!=='object'||Array.isArray(v))v={};
    const n=copy(defaults);n.enabled=typeof v.enabled==='boolean'?v.enabled:n.enabled;
    for(const [k,a,b] of [['master',0,.8],['maxEvents',1,3],['maxStarts',3,12],['ally',0,.5],['distance',3,12],['duck',.1,.65],['tail',.5,1]])n[k]=clamp(v[k],a,b,n[k]);
    n.maxEvents=Math.round(n.maxEvents);n.maxStarts=Math.round(n.maxStarts);
    for(const k in n.buses)n.buses[k]=clamp(v.buses?.[k],0,1,n.buses[k]);
    for(const k in n.sounds){const s=v.sounds?.[k];if(!s)continue;n.sounds[k]={enabled:typeof s.enabled==='boolean'?s.enabled:true,gain:clamp(s.gain,0,1,n.sounds[k].gain),cooldown:clamp(s.cooldown,60,3000,n.sounds[k].cooldown)};}
    return n;
  }
  let settings;try{settings=sanitize(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{settings=copy(defaults);}
  let ctx,master,duck,compressor,queue=[],timer=0,active=[],last={},lastFamily={},starts=[],cache=new Map(),duckUntil=0;
  let counters={requested:0,played:0,dropped:0,stolen:0,peakEvents:0,peakPulse:0,peakNoise:0},history=[],listeners=new Set(),fault='';
  function report(id,result,why){history.unshift({id,result,why,time:Date.now()});history.length=Math.min(history.length,32);}
  function notify(){for(const f of listeners){try{f();}catch{}}}
  function drop(id,why){counters.dropped++;report(id,'skip',why);return false;}
  function stop(){clearTimeout(timer);timer=0;queue=[];if(ctx){for(const a of active){try{a.gain.gain.cancelScheduledValues(ctx.currentTime);a.gain.gain.setTargetAtTime(0,ctx.currentTime,.003);a.source.stop(ctx.currentTime+.015);}catch{}}}active=[];last={};lastFamily={};starts=[];duckUntil=0;if(duck){duck.gain.cancelScheduledValues(ctx.currentTime);duck.gain.setValueAtTime(1,ctx.currentTime);}}
  function configure(value,persist=true){settings=sanitize(value);stop();if(master)master.gain.setTargetAtTime(settings.enabled?settings.master:0,ctx.currentTime,.02);let saved=true;if(persist)try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{saved=false;fault='端末に保存できません。JSONを書き出してください。';}notify();return saved;}
  async function unlock(){
    if(document.hidden||!settings.enabled)return false;
    try{
      if(!ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C){fault='このブラウザは音声再生に対応していません';notify();return false;}
        ctx=new C();master=ctx.createGain();master.gain.value=settings.master;
        const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=6200;low.Q.value=.5;
        compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=10;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.12;
        duck=ctx.createGain();duck.connect(low);low.connect(compressor);compressor.connect(master);master.connect(ctx.destination);
        // Important sounds bypass only ducking, not output filtering/limiting.
        ctx._sfxInput=low;
      }
      if(ctx.state!=='running')await ctx.resume();notify();return ctx.state==='running';
    }catch{fault='音声を開始できません。もう一度「音を有効にする」を押してください';notify();return false;}
  }
  function synth(id){
    if(cache.has(id))return cache.get(id);
    const d=defs[id],sr=48000,os=2,n=Math.ceil(d.length*sr),data=new Float32Array(n);
    let phase=0,phase2=0,nphase=0,lfsr=0,hp=0,lp=0;
    for(let i=0;i<n*os;i++){
      const t=i/(sr*os),p=t/d.length,step=Math.floor(t*128)/128;
      const notes=d.notes,ni=notes?Math.min(notes.length-1,Math.floor(p*notes.length)):0;
      const f=notes?notes[ni]:d.shape==='hurt'?110+400*Math.exp(-step/.027):d.shape==='blunt'?85+190*Math.exp(-step/.02):d.shape==='skill'?190+1300*Math.exp(-step/.065):220+1250*Math.exp(-step/.033);
      const period=Math.max(0,Math.min(2047,Math.round(2048-131072/f)));
      phase+=131072/(2048-period)/(sr*os);phase2+=131072/(2048-Math.max(0,Math.min(2047,Math.round(2048-131072/(f/2)))))/(sr*os);
      const envelope=Math.max(0,15-Math.floor(t*64/(d.length>.3?2:1)))/15;
      const articulation=notes?(.7+.3*Math.exp(-(p*notes.length%1)*4)):1;
      let x=d.pulse?(phase%1<(d.shape ? .125 : .25)?1:-1)*.18*envelope*articulation:0;
      if(d.pulse===2)x+=(phase2%1<.5?1:-1)*.11*envelope;
      if(d.noise){
        const shift=Math.min(6,(d.shape==='hit'?1:2)+Math.floor(p*3)),div=d.shape==='arrow'?1:3;
        nphase+=262144/(div*2**shift)/(sr*os);
        while(nphase>=1){const bit=1^((lfsr&1)^((lfsr>>1)&1));lfsr=(lfsr>>1)|(bit<<14);nphase--;}
        x+=(lfsr&1?1:-1)*.20*envelope*(1-p);
      }
      // Recording-edge fade + approximate output HPF/LPF. No reverb.
      x*=Math.min(1,t/.0015)*Math.min(1,(d.length-t)/.012);
      hp+=.0023*(x-hp);const ac=x-hp;lp+=.38*(ac-lp);data[Math.floor(i/os)]+=lp/os;
    }
    const b=ctx.createBuffer(1,n,sr);b.copyToChannel(data,0);cache.set(id,b);return b;
  }
  function prune(){if(ctx)active=active.filter(a=>a.end>ctx.currentTime);}
  function play(event){
    const {id,options:o,rank}=event,d=defs[id],s=settings.sounds[id],now=ctx.currentTime;
    if(!settings.enabled||!s.enabled||!settings.master||!s.gain||!settings.buses[d.bus]||document.hidden)return drop(id,'消音設定');
    const key=id+(o.ally?':ally':':self'),cd=s.cooldown/1000;
    if(now-(last[key]??-Infinity)<cd)return drop(id,'同じ音の間隔');
    const family=o.ally?'ally':d.bus==='combat'?'combat':d.bus;
    const interval=o.ally?.35:d.bus==='combat'?.075:.035;
    if(now-(lastFamily[family]??-Infinity)<interval)return drop(id,'カテゴリ連打制限');
    starts=starts.filter(t=>now-t<1);
    if(starts.length>=settings.maxStarts+(rank>=80?3:0))return drop(id,'1秒の発音上限');
    const distance=Number.isFinite(o.distance)?Math.max(0,o.distance):0;
    if(distance>settings.distance)return drop(id,'遠距離');
    const volume=s.gain*settings.buses[d.bus]*(o.ally?settings.ally:1)/(1+(distance/3.5)**2);
    if(volume<.015)return drop(id,'小音量');
    prune();let survivors=active.slice(),victims=[];
    const fits=()=>survivors.length<settings.maxEvents&&survivors.reduce((n,a)=>n+a.pulse,0)+d.pulse<=2&&survivors.reduce((n,a)=>n+a.noise,0)+d.noise<=1;
    // Remove the quietest low-priority competitor only when it helps free a slot.
    const candidates=survivors.filter(a=>a.rank<rank).sort((a,b)=>a.rank-b.rank||a.volume-b.volume);
    while(!fits()&&candidates.length){const a=candidates.shift();survivors=survivors.filter(v=>v!==a);victims.push(a);}
    if(!fits())return drop(id,'重要音／発音枠を保護');
    let start=now+.003;
    if(victims.length){start=now+.015;for(const a of victims){a.gain.gain.cancelScheduledValues(now);a.gain.gain.setTargetAtTime(0,now,.003);try{a.source.stop(now+.012);}catch{}counters.stolen++;}active=survivors;}
    const b=synth(id),source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;source.connect(gain);gain.connect(rank>=80?ctx._sfxInput:duck);
    const span=Math.min(b.duration,d.length*settings.tail),end=start+span;
    gain.gain.setValueAtTime(volume,start);gain.gain.setTargetAtTime(.0001,start+span*.38,Math.max(.012,span*.23));gain.gain.setValueAtTime(volume*Math.exp(-Math.max(0,span*.62-.01)/Math.max(.012,span*.23)),end-.01);gain.gain.linearRampToValueAtTime(0,end);
    const a={source,gain,id,end,rank,volume,pulse:d.pulse,noise:d.noise};active.push(a);
    source.onended=()=>{source.disconnect();gain.disconnect();active=active.filter(x=>x!==a);};source.start(start);source.stop(end+.001);
    if(rank>=80){duckUntil=Math.max(duckUntil,end+.08);duck.gain.cancelScheduledValues(now);duck.gain.setTargetAtTime(settings.duck,now,.008);duck.gain.setTargetAtTime(1,duckUntil,.07);}
    last[key]=now;lastFamily[family]=now;starts.push(now);counters.played++;
    counters.peakEvents=Math.max(counters.peakEvents,active.length);counters.peakPulse=Math.max(counters.peakPulse,active.reduce((n,a)=>n+a.pulse,0));counters.peakNoise=Math.max(counters.peakNoise,active.reduce((n,a)=>n+a.noise,0));report(id,'play',o.ally?'仲間・距離減衰':'再生');return true;
  }
  function flush(){timer=0;const batch=queue;queue=[];if(!ctx||ctx.state!=='running'||document.hidden){for(const e of batch)drop(e.id,'音声休止');return;}
    batch.sort((a,b)=>b.rank-a.rank);for(const e of batch)try{play(e);}catch{drop(e.id,'音声エラー');} }
  function emit(id,options={}){
    if(!defs[id])return false;counters.requested++;
    if(!ctx||ctx.state!=='running'||document.hidden||!settings.enabled)return drop(id,'未開始／休止');
    const event={id,options:{ally:!!options.ally,distance:options.distance},rank:defs[id].priority-(options.ally?25:0)};
    // 16 ms aggregation, one candidate per sound+origin, fixed memory and no backlog.
    const duplicate=queue.find(e=>e.id===id&&e.options.ally===event.options.ally);
    if(duplicate){if((event.options.distance||0)<(duplicate.options.distance||0))duplicate.options.distance=event.options.distance;return drop(id,'同時ヒットを統合');}
    if(queue.length>=32)return drop(id,'フレーム上限');queue.push(event);if(!timer)timer=setTimeout(flush,16);return true;
  }
  function inspect(){prune();return {state:ctx?.state||'locked',active:active.map(a=>({id:a.id,pulse:a.pulse,noise:a.noise})),queued:queue.length,counters:{...counters},history:history.slice(),fault};}
  window.ABYSS_AUDIO={defs:Object.freeze(defs),defaults:()=>copy(defaults),settings:()=>copy(settings),configure,unlock,emit,stop,inspect,
    subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},resetStats(){counters={requested:0,played:0,dropped:0,stolen:0,peakEvents:0,peakPulse:0,peakNoise:0};history=[];},
    async audition(id){if(await unlock()){stop();return emit(id);}return false;}};
  addEventListener('storage',e=>{if(e.key===KEY)try{configure(JSON.parse(e.newValue||'{}'),false);}catch{}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(ctx)ctx.suspend().catch(()=>{});}});
  addEventListener('pagehide',stop);
  // Gesture activation only; never autoplay or replay events accumulated while locked.
  for(const name of ['pointerdown','touchend','keydown'])document.addEventListener(name,()=>{if(settings.enabled&&(!ctx||ctx.state!=='running'))void unlock();},{capture:true,passive:true});
})();
