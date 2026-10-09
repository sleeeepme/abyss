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
    critical:{name:'会心',bus:'feedback',gain:.52,priority:65,cooldown:260,length:.22,pulse:2,noise:1,texture:'刃が食い込む衝撃と短い金属の響き'},
    hurt:{name:'自分の被弾',bus:'feedback',gain:.65,priority:90,cooldown:330,length:.19,pulse:1,noise:1,shape:'hurt'},
    guard:{name:'盾の防御',bus:'feedback',gain:.48,priority:82,cooldown:230,length:.17,pulse:2,noise:1,texture:'盾の面で受ける鈍い金属音'},
    parry:{name:'パリイ／ジャスト回避',bus:'feedback',gain:.6,priority:95,cooldown:350,length:.30,pulse:2,noise:1,texture:'刃を弾く鋭い接触と細い残響'},
    dash:{name:'ダッシュ',bus:'combat',gain:.28,priority:50,cooldown:300,length:.085,pulse:0,noise:1,shape:'arrow'},
    skill:{name:'武器技／大技',bus:'feedback',gain:.54,priority:75,cooldown:650,length:.32,pulse:1,noise:1,shape:'skill'},
    defeat:{name:'敵の消滅',bus:'combat',gain:.25,priority:24,cooldown:350,length:.27,pulse:1,noise:1,texture:'崩れる短い衝撃と散る気配'},
    boss:{name:'ボス撃破',bus:'feedback',gain:.6,priority:99,cooldown:2000,length:.82,pulse:1,noise:1,texture:'重い崩落、二度の瓦解、静まる余韻'},
    death:{name:'戦闘不能',bus:'feedback',gain:.58,priority:100,cooldown:2000,length:.52,pulse:1,noise:1,texture:'身体が落ちる衝撃と装備の擦れ'},
    pickup:{name:'アイテム取得',bus:'world',gain:.38,priority:55,cooldown:300,length:.12,pulse:1,noise:1,texture:'小物を手に取る乾いた接触'},
    heal:{name:'消耗品の使用',bus:'world',gain:.45,priority:70,cooldown:450,length:.25,pulse:0,noise:1,texture:'栓を抜く音と柔らかな気流'},
    level:{name:'レベルアップ・ファンファーレ',bus:'feedback',gain:.55,priority:80,cooldown:1600,length:1.28,pulse:2,noise:0,music:true,texture:'2声の短い祝奏。被弾・防御を優先'},
    floor:{name:'階層移動',bus:'world',gain:.32,priority:68,cooldown:1000,length:.3,pulse:1,noise:1,texture:'低い足場の響きと空気の移ろい'},
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
  const externalMutes=new Set();
  function setExternalMute(reason,on){
    if(on)externalMutes.add(reason);else externalMutes.delete(reason);
    if(on)stop();
    if(master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(settings.enabled&&!externalMutes.size?settings.master:0,ctx.currentTime);}
  }
  let ctx,master,duck,compressor,queue=[],timer=0,active=[],last={},lastFamily={},starts=[],cache=new Map(),duckUntil=0;
  let counters={requested:0,played:0,dropped:0,stolen:0,peakEvents:0,peakPulse:0,peakNoise:0},history=[],listeners=new Set(),fault='';
  function report(id,result,why){history.unshift({id,result,why,time:Date.now()});history.length=Math.min(history.length,32);}
  function notify(){for(const f of listeners){try{f();}catch{}}}
  function drop(id,why){counters.dropped++;report(id,'skip',why);return false;}
  function stop(){clearTimeout(timer);timer=0;queue=[];if(ctx){for(const a of active){try{a.gain.gain.cancelScheduledValues(ctx.currentTime);a.gain.gain.setTargetAtTime(0,ctx.currentTime,.003);a.source.stop(ctx.currentTime+.015);}catch{}}}active=[];last={};lastFamily={};starts=[];duckUntil=0;if(duck){duck.gain.cancelScheduledValues(ctx.currentTime);duck.gain.setValueAtTime(1,ctx.currentTime);}}
  function configure(value,persist=true){settings=sanitize(value);stop();if(master)master.gain.setTargetAtTime(settings.enabled&&!externalMutes.size?settings.master:0,ctx.currentTime,.02);let saved=true;if(persist)try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{saved=false;fault='端末に保存できません。JSONを書き出してください。';}notify();return saved;}
  async function unlock(){
    if(document.hidden||!settings.enabled||externalMutes.size)return false;
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
  // Each list is one physical GB channel. Segments on a list never overlap.
  // Pulse: [start, length, Hz, level 0..15, envelope pace, duty, settleHz].
  // Noise: [start, length, divider, shift, shortLFSR, level, envelope pace].
  // Non-musical cues use stationary inharmonic rings, brief low transients and
  // legally clocked noise. No PCM recordings, FM, added reverb or pitch arpeggios.
  const textures={
    slash:{n:[[0,.04,1,2,0,12,1],[.04,.085,3,3,0,9,1]]},
    blunt:{p:[[[0,.07,108,8,1,.5,73]]],n:[[0,.025,3,2,0,15,1],[.025,.11,5,4,0,9,1]]},
    arrow:{n:[[0,.015,2,2,0,10,1],[.015,.075,1,3,0,8,1]]},
    magic:{p:[[[0,.045,131,5,1,.125,98]]],n:[[0,.025,3,1,1,10,1],[.025,.09,1,3,0,12,1],[.115,.10,3,4,0,6,1]]},
    hit:{n:[[0,.017,2,1,0,12,1],[.017,.05,4,4,0,8,1]]},
    critical:{p:[[[0,.085,1320,7,1,.125]],[[0,.055,2030,5,1,.125]]],n:[[0,.035,1,1,0,15,1],[.035,.13,3,3,0,7,1]]},
    hurt:{p:[[[0,.065,104,9,1,.5,73]]],n:[[0,.026,4,2,0,13,1],[.026,.14,6,4,0,8,1]]},
    guard:{p:[[[0,.11,643,8,1,.125]],[[0,.075,1047,5,1,.125]]],n:[[0,.045,3,2,1,12,1],[.045,.075,5,3,0,5,1]]},
    parry:{p:[[[0,.19,1640,9,1,.125]],[[0,.105,2533,6,1,.125]]],n:[[0,.018,1,1,0,15,1],[.018,.05,3,1,1,8,1]]},
    dash:{n:[[0,.07,2,3,0,9,1]]},
    skill:{p:[[[0,.09,146,8,1,.5,82]]],n:[[0,.035,1,2,0,14,1],[.035,.12,3,3,0,10,1],[.155,.15,5,4,0,6,1]]},
    defeat:{p:[[[0,.065,91,6,1,.5,67]]],n:[[0,.025,3,3,0,12,1],[.025,.08,4,4,0,9,1],[.105,.13,2,5,0,5,1]]},
    boss:{p:[[[0,.18,83,12,1,.5,66],[.20,.11,69,6,1,.5]]],n:[[0,.10,5,4,0,15,1],[.10,.10,3,5,0,10,1],[.20,.13,5,4,0,10,1],[.33,.18,7,5,0,8,2],[.51,.25,3,6,0,4,3]]},
    death:{p:[[[0,.115,92,10,1,.5,66]]],n:[[0,.05,4,3,0,14,1],[.05,.11,6,4,0,8,1],[.16,.16,3,3,1,5,1],[.32,.15,4,5,0,3,2]]},
    pickup:{p:[[[0,.022,1530,4,1,.125]]],n:[[0,.024,4,1,1,8,1],[.029,.045,5,3,0,4,1]]},
    heal:{n:[[0,.019,5,1,1,9,1],[.025,.20,2,4,0,8,1]]},
    floor:{p:[[[0,.08,78,4,1,.5]]],n:[[0,.07,6,5,0,10,1],[.07,.20,3,5,0,5,2]]},
    level:{p:[
      [[0,.105,523.25,11,1,.25],[.14,.105,523.25,10,1,.25],[.28,.15,659.25,11,1,.25],[.46,.15,783.99,11,1,.25],[.66,.56,1046.5,12,3,.25]],
      [[0,.24,261.63,6,2,.5],[.28,.33,392,7,3,.5],[.66,.56,523.25,8,4,.5]]
    ]}
  };
  function textureBuffer(id){
    const d=defs[id],recipe=textures[id],sr=48000,os=4,n=Math.ceil(d.length*sr),data=new Float32Array(n);
    const voices=(recipe.p||[]).map(segments=>({segments,index:-1,phase:0}));
    const noise=recipe.n||[];let noiseIndex=-1,nphase=0,state=0,hp=0,lp=0;
    const envelope=(age,length,level,pace)=>Math.max(0,level-Math.floor(age*64/pace))/15*Math.min(1,age/.001)*Math.min(1,(length-age)/.004);
    for(let i=0;i<n*os;i++){
      const t=i/(sr*os);let x=0;
      for(const v of voices){
        const j=v.segments.findIndex(s=>t>=s[0]&&t<s[0]+s[1]);if(j<0)continue;
        const [at,len,f,vol,pace,duty,settle]=v.segments[j],age=t-at;
        if(j!==v.index){v.index=j;v.phase=0;}
        // Fast settling ends inside 24 ms: impact body, not an audible laser glide.
        const hz=settle?settle+(f-settle)*Math.max(0,1-Math.floor(age*128)/128/.024):f;
        const period=Math.max(0,Math.min(2047,Math.round(2048-131072/hz)));
        v.phase+=131072/(2048-period)/(sr*os);
        x+=(v.phase%1<duty?1:-1)*.21*envelope(age,len,vol,pace);
      }
      const j=noise.findIndex(s=>t>=s[0]&&t<s[0]+s[1]);
      if(j>=0){
        const [at,len,div,shift,short,vol,pace]=noise[j];
        if(j!==noiseIndex){noiseIndex=j;nphase=0;state=0;}
        nphase+=262144/(div*2**shift)/(sr*os);
        while(nphase>=1){const bit=1^((state&1)^((state>>1)&1));state=(state>>1)|(bit<<14);if(short)state=(state&~64)|(bit<<6);nphase--;}
        x+=(state&1?1:-1)*.30*envelope(t-at,len,vol,pace);
      }
      hp+=.00075*(x-hp);lp+=.21*(x-hp-lp);data[Math.floor(i/os)]+=lp/os;
    }
    // Output edge fade, also removes residual filter charge at a hard file end.
    for(let i=0;i<n;i++)data[i]*=Math.min(1,i/(sr*.001))*Math.min(1,(n-1-i)/(sr*.008));
    const b=ctx.createBuffer(1,n,sr);b.copyToChannel(data,0);return b;
  }
  function synth(id){
    if(cache.has(id))return cache.get(id);
    if(textures[id]){const b=textureBuffer(id);cache.set(id,b);return b;}
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
    if(externalMutes.size||!settings.enabled||!s.enabled||!settings.master||!s.gain||!settings.buses[d.bus]||document.hidden)return drop(id,'消音設定');
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
    // Preserve the fanfare's cadence even when combat tails are shortened.
    const span=Math.min(b.duration,d.length*(d.music?1:settings.tail)),end=start+span;
    gain.gain.setValueAtTime(volume,start);
    if(d.music){gain.gain.setValueAtTime(volume,end-.10);gain.gain.linearRampToValueAtTime(0,end);}
    else {gain.gain.setTargetAtTime(.0001,start+span*.38,Math.max(.012,span*.23));gain.gain.setValueAtTime(volume*Math.exp(-Math.max(0,span*.62-.01)/Math.max(.012,span*.23)),end-.01);gain.gain.linearRampToValueAtTime(0,end);}
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
    if(externalMutes.size||!ctx||ctx.state!=='running'||document.hidden||!settings.enabled)return drop(id,'未開始／休止');
    const event={id,options:{ally:!!options.ally,distance:options.distance},rank:defs[id].priority-(options.ally?25:0)};
    // 16 ms aggregation, one candidate per sound+origin, fixed memory and no backlog.
    const duplicate=queue.find(e=>e.id===id&&e.options.ally===event.options.ally);
    if(duplicate){if((event.options.distance||0)<(duplicate.options.distance||0))duplicate.options.distance=event.options.distance;return drop(id,'同時ヒットを統合');}
    if(queue.length>=32)return drop(id,'フレーム上限');queue.push(event);if(!timer)timer=setTimeout(flush,16);return true;
  }
  function inspect(){prune();return {state:ctx?.state||'locked',externallyMuted:externalMutes.size>0,active:active.map(a=>({id:a.id,pulse:a.pulse,noise:a.noise})),queued:queue.length,counters:{...counters},history:history.slice(),fault};}
  window.ABYSS_AUDIO={defs:Object.freeze(defs),defaults:()=>copy(defaults),settings:()=>copy(settings),configure,unlock,emit,stop,inspect,setExternalMute,
    subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},resetStats(){counters={requested:0,played:0,dropped:0,stolen:0,peakEvents:0,peakPulse:0,peakNoise:0};history=[];},
    async audition(id){if(await unlock()){stop();return emit(id);}return false;}};
  addEventListener('storage',e=>{if(e.key===KEY)try{configure(JSON.parse(e.newValue||'{}'),false);}catch{}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(ctx)ctx.suspend().catch(()=>{});}});
  addEventListener('pagehide',stop);
  // Gesture activation only; never autoplay or replay events accumulated while locked.
  for(const name of ['pointerdown','touchend','keydown'])document.addEventListener(name,()=>{if(settings.enabled&&(!ctx||ctx.state!=='running'))void unlock();},{capture:true,passive:true});
})();
