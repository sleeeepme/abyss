/* GB-inspired SFX and bounded mixer. No gameplay RNG, timers or state are changed.
   UI・場面の音（c:true）は「低い響き」の三角波で別に作る（CSFX、2026-10-25）。 */
(() => {
  'use strict';
  const KEY='abyss.audio.v1', TAU=Math.PI*2;
  // pulse = GB pulse slots; noise = the single noise slot. Wave slot is unused.
  const defs={
    slash:{name:'斬撃',bus:'combat',gain:.58,priority:42,cooldown:180,length:.13,pulse:0,noise:1,shape:'slash'},
    blunt:{name:'打撃',bus:'combat',gain:.6,priority:43,cooldown:210,length:.15,pulse:1,noise:1,shape:'blunt'},
    arrow:{name:'弓の発射',bus:'combat',gain:.42,priority:40,cooldown:220,length:.10,pulse:0,noise:1,shape:'arrow'},
    magic:{name:'魔弾',bus:'combat',gain:.46,priority:45,cooldown:240,length:.26,pulse:2,noise:1,shape:'magic',texture:'上へ回るアルペジオと細いきらめき'},
    // 敵の攻撃（2026-10-29）。主人公の攻撃の音より低く・鈍くして、「来た」と分かるようにする
    foeSwing:{name:'敵の近接',bus:'combat',gain:.42,priority:36,cooldown:200,length:.16,pulse:1,noise:1,shape:'foeSwing',texture:'低く沈む「ブン」と下がる風'},
    foeShot:{name:'敵の弾',bus:'combat',gain:.34,priority:34,cooldown:220,length:.14,pulse:1,noise:1,shape:'foeShot',texture:'下へ落ちる「ピュン」'},
    foeBow:{name:'ヴェラの矢',bus:'combat',gain:.44,priority:48,cooldown:260,length:.22,pulse:1,noise:1,shape:'foeBow',texture:'弦が震える「ビィン」'},
    foeLunge:{name:'敵の飛びかかり',bus:'combat',gain:.38,priority:38,cooldown:260,length:.13,pulse:1,noise:1,shape:'foeLunge',texture:'下から上がる「シュバッ」'},
    foeHeavy:{name:'ボスの大技（叩きつけ・衝撃）',bus:'feedback',gain:.62,priority:72,cooldown:380,length:.52,pulse:1,noise:1,shape:'foeHeavy',texture:'深く落ちる「ドゴォン」と長い地鳴り'},
    foeCleave:{name:'ボスの薙ぎ払い',bus:'feedback',gain:.56,priority:70,cooldown:380,length:.34,pulse:1,noise:1,shape:'foeCleave',texture:'低い唸りが大きく上がる「ブォン」と、最後に高く鳴る「シャキン」'},
    foeBeam:{name:'ボスの光線',bus:'feedback',gain:.48,priority:70,cooldown:380,length:.62,pulse:2,noise:1,shape:'foeBeam',texture:'溜めて上がり、揺れながら伸びる「ギュイィーン」'},
    hit:{name:'敵への命中',bus:'combat',gain:.30,priority:30,cooldown:150,length:.075,pulse:0,noise:1,shape:'hit'},
    critical:{name:'会心',bus:'feedback',gain:.56,priority:65,cooldown:260,length:.46,pulse:2,noise:1,texture:'重い打ちのあとに高い「キィン」が5度で鳴り、細く残る'},
    hurt:{name:'自分の被弾',bus:'feedback',gain:.65,priority:90,cooldown:330,length:.19,pulse:1,noise:1,shape:'hurt'},
    guard:{name:'盾の防御',bus:'feedback',gain:.48,priority:82,cooldown:230,length:.17,pulse:2,noise:1,texture:'盾の面で受ける鈍い金属音'},
    parry:{name:'パリイ／ジャスト回避',bus:'feedback',gain:.6,priority:95,cooldown:350,length:.30,pulse:2,noise:1,texture:'刃を弾く鋭い接触と細い残響'},
    dash:{name:'ダッシュ',bus:'combat',gain:.28,priority:50,cooldown:300,length:.09,pulse:0,noise:1,shape:'dash',texture:'低い所から上がる短い風'},
    skill:{name:'武器技／大技',bus:'feedback',gain:.54,priority:75,cooldown:650,length:.36,pulse:1,noise:1,shape:'skill',texture:'低くうねって上がる溜めと、はじける衝撃'},
    defeat:{name:'敵の消滅',bus:'combat',gain:.27,priority:24,cooldown:350,length:.27,pulse:1,noise:1,texture:'崩れて、3段で下がる小さな音'},
    boss:{name:'ボス撃破',bus:'feedback',gain:.6,priority:99,cooldown:2000,length:.82,pulse:1,noise:1,texture:'重い崩落、二度の瓦解、静まる余韻'},
    death:{name:'戦闘不能',bus:'feedback',gain:.58,priority:100,cooldown:2000,length:.52,pulse:1,noise:1,texture:'身体が落ちる衝撃と装備の擦れ'},
    pickup:{name:'アイテム取得',bus:'world',gain:.34,priority:55,cooldown:300,length:.13,pulse:1,noise:0,texture:'上がる2音の「ピコッ」'},
    heal:{name:'消耗品の使用',bus:'world',gain:.40,priority:70,cooldown:450,length:.28,pulse:1,noise:1,texture:'ド・ミ・ソと上がる柔らかい音と、薄い気流'},
    level:{name:'レベルアップ',bus:'feedback',gain:.8,priority:80,cooldown:1600,length:1.4,pulse:2,noise:0,music:true,c:true,texture:'低い音がすべり上がり、5度を重ねて開く。被弾・防御を優先'},
    floor:{name:'階層移動（ポータル）',bus:'world',gain:.32,priority:68,cooldown:1000,length:.3,pulse:1,noise:1,texture:'低い足場の響きと空気の移ろい'},
    fall:{name:'穴に落ちる',bus:'world',gain:.5,priority:68,cooldown:600,length:1.0,pulse:0,noise:1,c:true,texture:'三角波がG4から深く沈む・低い風'},
    land:{name:'穴から落ちてくる',bus:'world',gain:.6,priority:69,cooldown:600,length:1.2,pulse:0,noise:0,c:true,texture:'一行が順に降り立つ低い「ドン」'},
    roar:{name:'ボスの咆哮',bus:'feedback',gain:.9,priority:88,cooldown:1500,length:1.75,pulse:0,noise:1,c:true,texture:'低いうなりと、口を開くように動く喉の響き'},
    // UI。三角波の低めの1音で、役割は音の高さ・長さ・こもり具合で分ける（高い＝進む、低い＝戻る、低い2打＝できない）
    // length は発音枠を占める長さ。こだまの尻尾まで待つと続けて押した音が枠に入れないので、短めに切る
    ui:{name:'選択',bus:'ui',gain:.32,priority:60,cooldown:70,length:0.14,pulse:0,noise:0,c:true,texture:'G4の短い1音'},
    confirm:{name:'決定',bus:'ui',gain:.32,priority:62,cooldown:90,length:0.3,pulse:0,noise:0,c:true,texture:'G4に5度を重ねた短い響き'},
    back:{name:'戻る',bus:'ui',gain:.30,priority:60,cooldown:90,length:0.16,pulse:0,noise:0,c:true,texture:'D4の短い1音'},
    open:{name:'パネルを開く',bus:'ui',gain:.30,priority:61,cooldown:150,length:0.3,pulse:0,noise:0,c:true,texture:'こもった風が上がって、G3の1音'},
    close:{name:'パネルを閉じる',bus:'ui',gain:.30,priority:61,cooldown:150,length:0.25,pulse:0,noise:0,c:true,texture:'こもった風が下がって、D3の1音'},
    tab:{name:'タブ切替',bus:'ui',gain:.28,priority:58,cooldown:60,length:0.1,pulse:0,noise:0,c:true,texture:'C5の短い1音と小さな擦れ'},
    toggle:{name:'オン／オフ',bus:'ui',gain:.30,priority:58,cooldown:80,length:0.14,pulse:0,noise:0,c:true,texture:'オンはA4、オフはE4'},
    deny:{name:'できない',bus:'ui',gain:.34,priority:64,cooldown:250,length:0.25,pulse:0,noise:0,c:true,texture:'A2の低い2打'},
    equip:{name:'装備',bus:'ui',gain:.34,priority:63,cooldown:200,length:0.3,pulse:0,noise:0,c:true,texture:'金具の小さな音とE3の1音'},
    buy:{name:'購入・支払い',bus:'ui',gain:.32,priority:63,cooldown:200,length:0.25,pulse:0,noise:0,c:true,texture:'G5とD6の2つの短い音'},
    notify:{name:'通知',bus:'ui',gain:.30,priority:57,cooldown:1200,length:0.6,pulse:0,noise:0,c:true,texture:'E4とB4の5度の響き'}
  };
  const defaults={version:1,enabled:true,master:.35,music:.6,maxEvents:2,maxStarts:8,ally:.25,distance:8,duck:.3,tail:1,
    buses:{combat:.70,feedback:.90,world:.65,ui:.6},sounds:Object.fromEntries(Object.entries(defs).map(([k,d])=>[k,{enabled:true,gain:d.gain,cooldown:d.cooldown}]))};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const clamp=(x,a,b,f)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):f;
  function sanitize(v={}){
    if(!v||typeof v!=='object'||Array.isArray(v))v={};
    const n=copy(defaults);n.enabled=typeof v.enabled==='boolean'?v.enabled:n.enabled;
    for(const [k,a,b] of [['master',0,.8],['music',0,1],['maxEvents',1,3],['maxStarts',3,12],['ally',0,.5],['distance',3,12],['duck',.1,.65],['tail',.5,1]])n[k]=clamp(v[k],a,b,n[k]);
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
    musicSync();
    if(master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(settings.enabled&&!externalMutes.size?settings.master:0,ctx.currentTime);}
  }
  let ctx,master,duck,compressor,queue=[],timer=0,active=[],last={},lastFamily={},starts=[],cache=new Map(),duckUntil=0;
  let counters={requested:0,played:0,dropped:0,stolen:0,peakEvents:0,peakPulse:0,peakNoise:0},history=[],listeners=new Set(),fault='';
  function report(id,result,why){history.unshift({id,result,why,time:Date.now()});history.length=Math.min(history.length,32);}
  function notify(){for(const f of listeners){try{f();}catch{}}}
  function drop(id,why){counters.dropped++;report(id,'skip',why);return false;}
  function stop(){clearTimeout(timer);timer=0;queue=[];if(ctx){for(const a of active){try{a.gain.gain.cancelScheduledValues(ctx.currentTime);a.gain.gain.setTargetAtTime(0,ctx.currentTime,.003);a.source.stop(ctx.currentTime+.015);}catch{}}}active=[];last={};lastFamily={};starts=[];duckUntil=0;if(duck){duck.gain.cancelScheduledValues(ctx.currentTime);duck.gain.setValueAtTime(1,ctx.currentTime);}}
  function configure(value,persist=true){settings=sanitize(value);stop();musicSync();if(master)master.gain.setTargetAtTime(settings.enabled&&!externalMutes.size?settings.master:0,ctx.currentTime,.02);let saved=true;if(persist)try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{saved=false;fault='端末に保存できません。JSONを書き出してください。';}notify();return saved;}
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
      if(ctx.state!=='running')await ctx.resume();musicSync();notify();return ctx.state==='running';
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
    magic:{p:[[[0,.24,880,11,2,.125,0,{arp:[1,1.5,2,1.5],arpHz:38,to:1320}]],[[.02,.22,440,6,3,.5,0,{vib:.03,vibHz:14,to:660}]]],n:[[0,.22,1,0,1,5,3]]},
    hit:{n:[[0,.017,2,1,0,12,1],[.017,.05,4,4,0,8,1]]},
    foeSwing:{p:[[[0,.13,147,9,2,.5,0,{to:73}]]],n:[[0,.14,2,3,0,8,1,{shiftTo:6}]]},
    foeShot:{p:[[[0,.13,784,10,1,.25,0,{to:262}]]],n:[[0,.02,2,1,0,7,1]]},
    foeBow:{p:[[[0,.21,294,11,2,.5,0,{vib:.05,vibHz:28,dutyTo:.125}]]],n:[[0,.012,1,2,0,11,1],[.012,.05,2,3,0,5,1]]},
    foeLunge:{p:[[[0,.08,98,6,1,.5,0,{to:196}]]],n:[[0,.12,4,5,0,10,1,{shiftTo:2}]]},
    foeHeavy:{p:[[[0,.40,120,14,3,.5,0,{to:38}]]],n:[[0,.06,4,3,0,15,1],[.06,.45,7,6,0,11,4]]},
    foeCleave:{p:[[[0,.20,82,12,3,.5,0,{to:330}],[.20,.15,1319,10,2,.125,0,{vib:.006,vibHz:11}]]],n:[[0,.20,4,5,0,8,3,{shiftTo:1}],[.20,.06,1,1,0,7,1]]},
    foeBeam:{p:[[[0,.09,220,9,6,.5,0,{to:880,rise:.06}],[.09,.52,880,12,7,.25,0,{vib:.035,vibHz:22,dutyTo:.125}]],[[0,.60,441,7,8,.5,0,{to:452,vib:.02,vibHz:7}]]],n:[[0,.60,1,1,1,6,6,{rise:.05}]]},
    critical:{p:[[[0,.05,196,13,1,.5,0,{to:82}],[.05,.40,1568,12,3,.125,0,{vib:.004,vibHz:9}]],[[.04,.05,2093,10,1,.125],[.09,.36,2349,9,3,.25]]],n:[[0,.03,1,1,0,15,1],[.03,.06,2,2,0,10,1],[.09,.26,1,1,1,4,3]]},
    hurt:{p:[[[0,.065,104,9,1,.5,73]]],n:[[0,.026,4,2,0,13,1],[.026,.14,6,4,0,8,1]]},
    guard:{p:[[[0,.11,643,8,1,.125]],[[0,.075,1047,5,1,.125]]],n:[[0,.045,3,2,1,12,1],[.045,.075,5,3,0,5,1]]},
    parry:{p:[[[0,.19,1640,9,1,.125]],[[0,.105,2533,6,1,.125]]],n:[[0,.018,1,1,0,15,1],[.018,.05,3,1,1,8,1]]},
    dash:{n:[[0,.085,3,4,0,9,1,{shiftTo:1}]]},
    skill:{p:[[[0,.33,147,10,3,.5,0,{to:392,vib:.02,vibHz:10}]]],n:[[0,.04,1,2,0,14,1],[.04,.28,3,4,0,9,2]]},
    defeat:{p:[[[0,.05,196,8,1,.5,0,{to:131}],[.07,.05,147,6,1,.5],[.14,.07,110,5,1,.5]]],n:[[0,.04,3,3,0,12,1],[.04,.20,4,5,0,8,2]]},
    boss:{p:[[[0,.18,83,12,1,.5,66],[.20,.11,69,6,1,.5]]],n:[[0,.10,5,4,0,15,1],[.10,.10,3,5,0,10,1],[.20,.13,5,4,0,10,1],[.33,.18,7,5,0,8,2],[.51,.25,3,6,0,4,3]]},
    death:{p:[[[0,.115,92,10,1,.5,66]]],n:[[0,.05,4,3,0,14,1],[.05,.11,6,4,0,8,1],[.16,.16,3,3,1,5,1],[.32,.15,4,5,0,3,2]]},
    pickup:{p:[[[0,.04,1047,10,1,.25],[.045,.08,1568,10,1,.25]]]},
    heal:{p:[[[0,.06,523,9,1,.25],[.065,.06,659,9,1,.25],[.13,.14,784,9,2,.25]]],n:[[0,.24,2,4,0,4,2]]},
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
        const [at,len,f,vol,pace,duty,settle,o]=v.segments[j],age=t-at;
        if(j!==v.index){v.index=j;v.phase=0;}
        // Fast settling ends inside 24 ms: impact body, not an audible laser glide.
        let hz=settle?settle+(f-settle)*Math.max(0,1-Math.floor(age*128)/128/.024):f,du=duty,amp=1;
        /* 8番目の欄（2026-10-29）：GB の掃引（to：segment の間に音程を指数で動かす）・アルペジオ（arp：音程の倍率を arpHz で回す）・
           ビブラート（vib：深さの比、vibHz）・デューティの移り（dutyTo）・立ち上がり（rise 秒）。光線や魔法の「伸びる音」用 */
        if(o){const k=Math.min(1,age/(o.glide||len));
          if(o.to)hz=f*Math.pow(o.to/f,k);
          if(o.arp)hz*=o.arp[Math.floor(age*(o.arpHz||30))%o.arp.length];
          if(o.vib)hz*=1+o.vib*Math.sin(TAU*(o.vibHz||12)*age);
          if(o.dutyTo!=null)du=duty+(o.dutyTo-duty)*k;
          if(o.rise)amp=Math.min(1,age/o.rise);}
        const period=Math.max(0,Math.min(2047,Math.round(2048-131072/hz)));
        v.phase+=131072/(2048-period)/(sr*os);
        x+=(v.phase%1<du?1:-1)*.21*envelope(age,len,vol,pace)*amp;
      }
      const j=noise.findIndex(s=>t>=s[0]&&t<s[0]+s[1]);
      if(j>=0){
        const [at,len,div,shift0,short,vol,pace,o]=noise[j];
        if(j!==noiseIndex){noiseIndex=j;nphase=0;state=0;}
        // 8番目の欄：shiftTo（雑音の高さを segment の間に段階で動かす＝風切りの上がり下がり）・rise
        const age=t-at,k=o?Math.min(1,age/len):0,shift=o&&o.shiftTo!=null?Math.round(shift0+(o.shiftTo-shift0)*k):shift0;
        nphase+=262144/(div*2**shift)/(sr*os);
        while(nphase>=1){const bit=1^((state&1)^((state>>1)&1));state=(state>>1)|(bit<<14);if(short)state=(state&~64)|(bit<<6);nphase--;}
        x+=(state&1?1:-1)*.30*envelope(age,len,vol,pace)*(o&&o.rise?Math.min(1,age/o.rise):1);
      }
      hp+=.00075*(x-hp);lp+=.21*(x-hp-lp);data[Math.floor(i/os)]+=lp/os;
    }
    // Output edge fade, also removes residual filter charge at a hard file end.
    for(let i=0;i<n;i++)data[i]*=Math.min(1,i/(sr*.001))*Math.min(1,(n-1-i)/(sr*.008));
    const b=ctx.createBuffer(1,n,sr);b.copyToChannel(data,0);return b;
  }
  /* ---------- UI・場面の音「低い響き」（2026-10-25 ユーザー採用：試聴ページの案C） ----------
     メロディで飾らない。三角波の低めの1音に、ごく薄いこだま。役割は音の高さ・長さ・こもり具合で分ける：
     高い＝進む、低い＝戻る、低い2打＝できない。決定・通知・レベルアップだけ5度を重ねる。
     GBの音とは別の作り（三角波＝使っていなかった波形の枠。雑音はフィルタを通した柔らかいもの）。
     鳴るたびに音程を±1%、音量を±5%揺らす：曲ごとに4通りを作って控えておき、順に使う（ゲームの乱数は使わない）。 */
  const CSFX=(()=>{
    let seed=0x9e3779b9;const rand=()=>{seed=(Math.imul(seed^(seed>>>15),0x2c1b3c6d)+0x6d2b79f5)|0;return ((seed>>>0)%100000)/100000;};
    function Out(sr,len){const n=Math.ceil(len*sr);return {sr,n,L:new Float32Array(n),R:new Float32Array(n)};}
    function put(o,at,len,gain,pan,fn){
      const s0=Math.max(0,Math.round(at*o.sr)),n=Math.min(o.n-s0,Math.ceil(len*o.sr));if(n<=0)return;
      const a=(pan+1)*Math.PI/4,gl=Math.cos(a)*gain,gr=Math.sin(a)*gain,fo=Math.max(1,Math.round(.006*o.sr));
      for(let i=0;i<n;i++){const x=fn(i/o.sr)*(i>n-fo?(n-i)/fo:1);o.L[s0+i]+=x*gl;o.R[s0+i]+=x*gr;}
    }
    const env=(t,a,d)=>t<a?t/a:Math.exp(-(t-a)/d);
    const trap=(t,len,a,r)=>t<a?t/a:(t>len-r?Math.max(0,(len-t)/r):1);
    function svf(o,f0,f1,sweep,q,type){let ic1=0,ic2=0;return t=>{
      const f=f1==null?f0:f0*Math.pow(f1/f0,Math.min(1,t/sweep)),g=Math.tan(Math.PI*Math.min(f,o.sr*.45)/o.sr),k=1/q,a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2;
      const x=rand()*2-1,v3=x-ic2,v1=a1*ic1+a2*v3,v2=ic2+a2*ic1+a3*v3;ic1=2*v1-ic1;ic2=2*v2-ic2;
      return type==='lp'?v2:type==='hp'?x-k*v1-v2:v1*k;};}
    function noise(o,at,len,{gain=.5,pan=0,type='bp',f0=1000,f1=null,sweep=.1,q=1,a=.001,d=.02}){const s=svf(o,f0,f1,sweep,q,type);put(o,at,len,gain,pan,t=>s(t)*env(t,a,d));}
    function swell(o,at,len,{gain=.3,pan=0,type='lp',f0=400,f1=null,sweep=.3,q=.8,a=.05,r=.2,trem=0,tremHz=8}){const s=svf(o,f0,f1,sweep,q,type);
      put(o,at,len,gain,pan,t=>s(t)*trap(t,len,a,r)*(1-trem*.5+trem*.5*Math.sin(TAU*tremHz*t)));}
    const wave=(w,p,duty)=>w==='tri'?(p<.5?4*p-1:3-4*p):(p<duty?1:-1);
    function blip(o,at,len,{gain=.5,pan=0,w='sq',duty=.25,f=880,a=.002,d=.05}){let ph=0;put(o,at,len,gain,pan,t=>{ph=(ph+f/o.sr)%1;return wave(w,ph,duty)*env(t,a,d);});}
    const tk=(o,at,f,{w='sq',duty=.5,d=.02,g=.4,pan=0}={})=>blip(o,at,Math.max(.03,d*6),{gain:g,pan,w,duty,f,a:.0015,d});
    function voice(o,at,len,{gain=.4,pan=0,w='sq',duty=.5,f0=440,f1=null,glide=null,a=.01,r=.1,vibHz=0,vib=0}){let ph=0;const G=glide??len;
      put(o,at,len,gain,pan,t=>{const k=Math.min(1,t/G),f=(f1==null?f0:f0*Math.pow(f1/f0,k))*(1+vib*Math.sin(TAU*vibHz*t));ph=(ph+f/o.sr)%1;return wave(w,ph,duty)*trap(t,len,a,r);});}
    function metal(o,at,frames,level,gain){   // ファミコン式の短い周期の雑音（金具の「チッ」）。1/60秒ごとに音量を落とす
      let lfsr=1,nph=0;const clk=55930,fr=1/60;
      put(o,at,frames*fr+.006,gain,0,t=>{const i=Math.floor(t/fr);if(i>=frames)return 0;nph+=clk/o.sr;
        while(nph>=1){const bit=(lfsr^(lfsr>>6))&1;lfsr=(lfsr>>1)|(bit<<14);nph--;}return ((lfsr&1)?1:-1)*level[i]/15;});}
    function onepole(o,fc,type){const k=1-Math.exp(-TAU*fc/o.sr);let l=0,r=0;
      for(let i=0;i<o.n;i++){l+=k*(o.L[i]-l);r+=k*(o.R[i]-r);if(type==='lp'){o.L[i]=l;o.R[i]=r;}else{o.L[i]-=l;o.R[i]-=r;}}}
    function echo(o,delay,level){const off=Math.round(delay*o.sr),dL=o.L.slice(),dR=o.R.slice();for(let i=off;i<o.n;i++){o.L[i]+=dR[i-off]*level;o.R[i]+=dL[i-off]*level;}}
    const R={
      ui(o,v){tk(o,0,392*v,{w:'tri',d:.025,g:.45});tk(o,0,392*v,{duty:.125,d:.012,g:.12});},
      confirm(o,v){tk(o,0,392*v,{w:'tri',d:.09,g:.4});tk(o,0,588*v,{w:'tri',d:.08,g:.3});tk(o,0,784*v,{duty:.125,d:.03,g:.1});},
      back(o,v){tk(o,0,293.7*v,{w:'tri',d:.04,g:.45});},
      open(o,v){swell(o,0,.13,{gain:.18,f0:300,f1:1500,sweep:.1,a:.04,r:.03});tk(o,.06,196*v,{w:'tri',d:.08,g:.42});},
      close(o,v){swell(o,0,.11,{gain:.18,f0:1500,f1:300,sweep:.08,a:.03,r:.03});tk(o,.05,147*v,{w:'tri',d:.06,g:.45});},
      tab(o,v){noise(o,0,.015,{gain:.12,type:'hp',f0:2500,d:.002});tk(o,0,523.25*v,{w:'tri',d:.015,g:.42});},
      toggle(o,v,on){tk(o,0,(on==='off'?330:440)*v,{w:'tri',d:on==='off'?.025:.03,g:.45});},
      deny(o,v){for(const at of [0,.08]){tk(o,at,110*v,{w:'tri',d:.05,g:.5});tk(o,at,110*v,{duty:.5,d:.02,g:.12});}},
      equip(o,v){metal(o,0,2,[8,3],.16);tk(o,0,165*v,{w:'tri',d:.08,g:.45});tk(o,0,330*v,{duty:.25,d:.03,g:.12});},
      buy(o,v){tk(o,0,784*v,{w:'tri',d:.02,g:.38});tk(o,.04,1175*v,{w:'tri',d:.05,g:.36});},
      notify(o,v){tk(o,0,330*v,{w:'tri',d:.25,g:.4});tk(o,0,495*v,{w:'tri',d:.22,g:.3});},
      level(o,v){voice(o,0,.3,{gain:.36,w:'tri',f0:196*v,f1:392*v,glide:.25,a:.02,r:.05});voice(o,.25,.9,{gain:.36,w:'tri',f0:392*v,a:.005,r:.8});
        voice(o,.3,.85,{gain:.28,w:'tri',f0:588*v,a:.06,r:.75});swell(o,.2,.7,{gain:.08,f0:2400,a:.1,r:.5});},
      fall(o,v){voice(o,0,.8,{gain:.42,w:'tri',f0:392*v,f1:65*v,glide:.7,a:.005,r:.45});swell(o,0,.8,{gain:.16,f0:900,f1:120,sweep:.7,a:.05,r:.4});},
      /* 穴から落ちてきた一行の着地。n人ぶん、ゲームの落下（主人公 0.48秒、仲間は 0.13秒ずつ遅れる）に合わせて鳴る */
      land(o,v,n){const c=Math.max(1,Math.min(5,+n||1));for(let j=0;j<c;j++){const at=.48+j*.13;
        tk(o,at,(j?90:70)*v,{w:'tri',d:j?.06:.1,g:j?.35:.55});swell(o,at,.2,{gain:j?.08:.14,f0:300,a:.003,r:.18});}},
      roar(o,v){voice(o,0,1.5,{gain:.36,w:'tri',f0:65*v,f1:49*v,glide:1.3,a:.15,r:.6,vibHz:5,vib:.025});
        swell(o,0,.6,{gain:.26,type:'bp',f0:400,f1:900,sweep:.5,q:2,a:.15,r:.05,trem:.5,tremHz:11});
        swell(o,.55,.95,{gain:.24,type:'bp',f0:900,f1:300,sweep:.8,q:2,a:.03,r:.6,trem:.5,tremHz:9});
        swell(o,0,1.5,{gain:.14,f0:200,a:.2,r:.7});},
    };
    const LEN={ui:.32,confirm:.75,back:.4,open:.55,close:.45,tab:.3,toggle:.35,deny:.45,equip:.6,buy:.5,notify:1.6,level:1.4,fall:1.0,land:1.4,roar:1.75};
    const PEAK=.2,cache=new Map();   // 効果音（GB）と同じくらいの大きさに
    function make(ctx,id,variant){
      const v=1+(rand()*2-1)*.01,o=Out(ctx.sampleRate,LEN[id]+(id==='land'?.13*Math.max(0,(+variant||1)-1):0));
      R[id](o,v,variant);
      onepole(o,80,'hp');onepole(o,2600,'lp');echo(o,.12,.18);
      let pk=0,dl=0,dr=0;
      for(let i=0;i<o.n;i++){const e=Math.min(1,i/(o.sr*.0005),(o.n-1-i)/(o.sr*.02));dl+=.002*(o.L[i]-dl);dr+=.002*(o.R[i]-dr);o.L[i]=(o.L[i]-dl)*e;o.R[i]=(o.R[i]-dr)*e;pk=Math.max(pk,Math.abs(o.L[i]),Math.abs(o.R[i]));}
      const k=pk>0?PEAK*(1+(rand()*2-1)*.05)/pk:1,b=ctx.createBuffer(2,o.n,o.sr);
      for(let i=0;i<o.n;i++){o.L[i]*=k;o.R[i]*=k;}b.copyToChannel(o.L,0);b.copyToChannel(o.R,1);return b;
    }
    return {
      has:id=>!!R[id],
      buffer(ctx,id,variant){const key=id+'|'+(variant??'');let e=cache.get(key);if(!e){e={list:[],i:0};cache.set(key,e);}
        if(e.list.length<4){const b=make(ctx,id,variant);e.list.push(b);return b;}
        e.i=(e.i+1)%e.list.length;return e.list[e.i];},
    };
  })();
  function synth(id,variant){
    if(defs[id].c)return CSFX.buffer(ctx,id,variant);
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
    /* UIの「低い響き」は発音枠の外で鳴らす（2026-10-25）。三角波の小さな音で、矩形波とノイズの枠も使わない。
       着地・咆哮・レベルアップのような長い音が枠を埋めているときに、押した音が消えないように */
    const free=!!(d.c&&d.bus==='ui');
    const fits=()=>free||survivors.filter(a=>!a.free).length<settings.maxEvents&&survivors.reduce((n,a)=>n+a.pulse,0)+d.pulse<=2&&survivors.reduce((n,a)=>n+a.noise,0)+d.noise<=1;
    // Remove the quietest low-priority competitor only when it helps free a slot.
    const candidates=survivors.filter(a=>a.rank<rank&&!a.free).sort((a,b)=>a.rank-b.rank||a.volume-b.volume);
    while(!fits()&&candidates.length){const a=candidates.shift();survivors=survivors.filter(v=>v!==a);victims.push(a);}
    if(!fits())return drop(id,'重要音／発音枠を保護');
    let start=now+.003;
    if(victims.length){start=now+.015;for(const a of victims){a.gain.gain.cancelScheduledValues(now);a.gain.gain.setTargetAtTime(0,now,.003);try{a.source.stop(now+.012);}catch{}counters.stolen++;}active=survivors;}
    const b=synth(id,o.variant),source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;source.connect(gain);gain.connect(rank>=80?ctx._sfxInput:duck);
    // Preserve the fanfare's cadence even when combat tails are shortened.
    const span=Math.min(b.duration,d.length*(d.music?1:settings.tail)),end=start+span;
    gain.gain.setValueAtTime(volume,start);
    if(d.music){gain.gain.setValueAtTime(volume,end-.10);gain.gain.linearRampToValueAtTime(0,end);}
    else {gain.gain.setTargetAtTime(.0001,start+span*.38,Math.max(.012,span*.23));gain.gain.setValueAtTime(volume*Math.exp(-Math.max(0,span*.62-.01)/Math.max(.012,span*.23)),end-.01);gain.gain.linearRampToValueAtTime(0,end);}
    const a={source,gain,id,end,rank,volume,pulse:d.pulse,noise:d.noise,free};active.push(a);
    source.onended=()=>{source.disconnect();gain.disconnect();active=active.filter(x=>x!==a);};source.start(start);source.stop(end+.001);
    if(rank>=80){duckUntil=Math.max(duckUntil,end+.08);duck.gain.cancelScheduledValues(now);duck.gain.setTargetAtTime(settings.duck,now,.008);duck.gain.setTargetAtTime(1,duckUntil,.07);}
    last[key]=now;lastFamily[family]=now;starts.push(now);counters.played++;
    counters.peakEvents=Math.max(counters.peakEvents,active.filter(a=>!a.free).length);counters.peakPulse=Math.max(counters.peakPulse,active.reduce((n,a)=>n+a.pulse,0));counters.peakNoise=Math.max(counters.peakNoise,active.reduce((n,a)=>n+a.noise,0));report(id,'play',o.ally?'仲間・距離減衰':'再生');return true;
  }
  function flush(){timer=0;const batch=queue;queue=[];if(!ctx||ctx.state!=='running'||document.hidden){for(const e of batch)drop(e.id,'音声休止');return;}
    batch.sort((a,b)=>b.rank-a.rank);for(const e of batch)try{play(e);}catch{drop(e.id,'音声エラー');} }
  function emit(id,options={}){
    if(!defs[id])return false;counters.requested++;
    if(externalMutes.size||!ctx||ctx.state!=='running'||document.hidden||!settings.enabled)return drop(id,'未開始／休止');
    const event={id,options:{ally:!!options.ally,distance:options.distance,variant:options.variant},rank:defs[id].priority-(options.ally?25:0)};
    // 16 ms aggregation, one candidate per sound+origin, fixed memory and no backlog.
    const duplicate=queue.find(e=>e.id===id&&e.options.ally===event.options.ally);
    if(duplicate){if((event.options.distance||0)<(duplicate.options.distance||0))duplicate.options.distance=event.options.distance;return drop(id,'同時ヒットを統合');}
    if(queue.length>=32)return drop(id,'フレーム上限');queue.push(event);if(!timer)timer=setTimeout(flush,16);return true;
  }
  /* ---------- BGM（2026-10-22：拠点の曲、同日 石の層の曲・中ボス戦の曲、10-23 ヴェラ第二形態の曲） ----------
     効果音（GB合成・短い・上限つき）とは別の通り道。Web Audio に繋いで master だけを通す
     （効果音の圧縮・ダッキングには入れない）。stop()（画面切替のたびに呼ばれる）では止めない。
     ・music(id) で「今流したい曲」を指定（null で止める）。実際に鳴らすのは、音が解錠済み・有効・前面・外部消音なしのときだけ
     ・入りは fadeIn（既定 1.2 秒）、抜けは 0.8 秒でフェードアウトしてから止める。曲が替わるときは重ねて入れ替える
     ・止めてから RESTART_AFTER 秒以上たった曲は頭から（restart の曲は毎回頭から）。すぐ戻れば続きから
       ただし画面が隠れた・音が止まった等で止まったとき（suspended）は、戻ったら続きから（戦いの途中で頭に戻さない）
     ・曲の鳴らし方は2通り：
         el  … <audio loop>（MediaElementSource）。軽い。ループは曲の頭へ戻る（拠点・層・中ボス）
         buf … 取ってきて AudioBuffer に解いて、loop:[開始,終わり] の区間を継ぎ目なしで回す（ヴェラ第二形態）。
               前奏は1回だけ流れ、あとは区間をくり返す。解いた音は重い（2分で約40MB）ので、止めたら手放す。
               継ぎ目は曲のファイルの側で作ってある：終わりの手前 0.06 秒は区間の頭の直前の音そのもの
               ——デコーダが頭に足す遅れ（ブラウザで 0〜約0.04 秒違う）がずれても、跳んだ先とつながる。
     ・iOS は要素ごとに操作での再生開始が要るので、解錠と同じ指の操作の中で play() を呼ぶ（musicKick）
     ・file:// で開いたときは Web Audio に繋がない（別オリジン扱いで無音になる）。要素の音量で代わりにする（buf の曲も el で鳴らす） */
  const TRACKS={
    hub:  {src:'assets/bgm/hub_beyond_the_stone_gate.mp3', gain:1},     // 拠点「Beyond the Stone Gate」
    stone:{src:'assets/bgm/stone_the_forgotten_archway.mp3', gain:1},   // 石の層「The Forgotten Archway」
    midboss:{src:'assets/bgm/midboss_the_weight_of_stone.mp3', gain:1, restart:true}, // 5階ごとの中ボス戦「The Weight of Stone」（頭の無音は詰めてある。戦いのたびに頭から）
    /* ヴェラ第二形態「Strike of the Stone Giant」。元の曲は 160BPM で、53.75秒〜119.75秒（176拍＝44小節）が
       後半でもう一度くり返される作り。そこを区間にして回す。継ぎ目は小節の頭（区間の頭の強拍）の直前0.3秒で重ねてある。
       曲の終わり（119.75秒より後の変奏と締め）は使わない。 */
    vera2:{src:'assets/bgm/vera2_strike_of_the_stone_giant.mp3', gain:1, restart:true, fadeIn:.35, loop:[53.751, 119.751]},
  };
  const FADE_IN=1.2,FADE_OUT=.8,RESTART_AFTER=30;
  let mWant=null,mFault='';const players={};
  function musicLevel(id){return settings.enabled&&!externalMutes.size?settings.music*(TRACKS[id]?.gain??1):0;}
  function musicCanPlay(){return !!mWant&&settings.enabled&&!externalMutes.size&&!document.hidden&&settings.music>0&&!!ctx&&ctx.state==='running';}
  const useEl=t=>!t.loop||location.protocol==='file:'||!ctx||typeof fetch!=='function';
  function player(id){
    if(players[id])return players[id];
    const t=TRACKS[id];if(!t)return null;
    const p={id,kind:useEl(t)?'el':'buf',el:null,node:null,gain:null,pauseT:0,stoppedAt:0,suspended:false,
             buf:null,loading:null,src:null,t0:0,offset:0,playing:false};
    if(ctx&&location.protocol!=='file:'){p.gain=ctx.createGain();p.gain.gain.value=0;p.gain.connect(master);}
    if(p.kind==='el'){
      const el=p.el=new Audio();el.loop=true;el.preload='auto';el.src=t.src;el.setAttribute('playsinline','');
      el.addEventListener('error',()=>{mFault='BGMを読み込めません：'+id;});
      if(p.gain){try{p.node=ctx.createMediaElementSource(el);p.node.connect(p.gain);}catch{p.node=null;p.gain.disconnect();p.gain=null;}}
      if(!p.gain)el.volume=0;
    }
    return (players[id]=p);
  }
  function bufLoad(p){
    if(p.buf||p.loading)return p.loading;
    const t=TRACKS[p.id];
    p.loading=fetch(t.src).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();})
      .then(ab=>new Promise((res,rej)=>{const q=ctx.decodeAudioData(ab,res,rej);if(q&&q.catch)q.catch(rej);}))
      .then(b=>{p.buf=b;p.loading=null;musicSync();return b;})
      .catch(()=>{p.loading=null;mFault='BGMを読み込めません：'+p.id;});
    return p.loading;
  }
  function bufPos(p){
    const t=TRACKS[p.id],[ls,le]=t.loop;if(!p.playing)return p.offset;
    let x=ctx.currentTime-p.t0;if(x>=le)x=ls+(x-ls)%(le-ls);return x;
  }
  const isPlaying=p=>p.kind==='el'?!p.el.paused:p.playing;
  function startP(p,fromHead){
    if(p.kind==='el'){if(fromHead)try{p.el.currentTime=0;}catch{}const r=p.el.play();if(r&&r.catch)r.catch(()=>{});return;}
    if(!p.buf){bufLoad(p);return;}                           // 解き終わったら musicSync がもう一度呼ばれる
    const t=TRACKS[p.id],off=fromHead?0:p.offset,s=ctx.createBufferSource();
    s.buffer=p.buf;s.loop=true;s.loopStart=t.loop[0];s.loopEnd=Math.min(t.loop[1],p.buf.duration);s.connect(p.gain);
    s.start(0,off);p.src=s;p.t0=ctx.currentTime-off;p.playing=true;
  }
  function stopP(p){
    if(p.kind==='el'){try{p.el.pause();}catch{}return;}
    if(p.src){p.offset=bufPos(p);try{p.src.stop();}catch{}try{p.src.disconnect();}catch{}p.src=null;}p.playing=false;
  }
  function musicRamp(p,to,sec){
    if(p.gain){const now=ctx.currentTime;p.gain.gain.cancelScheduledValues(now);p.gain.gain.setValueAtTime(p.gain.gain.value,now);p.gain.gain.linearRampToValueAtTime(to,now+sec);}
    else if(p.el)p.el.volume=Math.max(0,Math.min(1,to*settings.master));
  }
  function musicHalt(p,hard){
    clearTimeout(p.pauseT);p.pauseT=0;if(!isPlaying(p))return;
    const end=()=>{p.pauseT=0;if(musicCanPlay()&&mWant===p.id)return;stopP(p);
      p.suspended=hard;if(!hard){p.stoppedAt=performance.now();if(p.kind==='buf')p.buf=null;}   // 解いた音は重いので、ほんとうに止めたら手放す
      if(p.gain&&ctx)p.gain.gain.setValueAtTime(0,ctx.currentTime);};
    if(hard){end();return;}
    musicRamp(p,0,FADE_OUT);p.pauseT=setTimeout(end,FADE_OUT*1000+50);
  }
  function musicSync(){
    const can=musicCanPlay(),hard=document.hidden||!ctx||ctx.state!=='running';
    for(const id in players)if(!(can&&id===mWant))musicHalt(players[id],hard);
    if(!can)return;
    const p=player(mWant);if(!p)return;
    clearTimeout(p.pauseT);p.pauseT=0;
    const t=TRACKS[p.id];
    if(!isPlaying(p)){
      const head=!p.suspended&&!!p.stoppedAt&&(t.restart||performance.now()-p.stoppedAt>RESTART_AFTER*1000);
      startP(p,head);if(!isPlaying(p))return;                 // buf の曲がまだ解けていない
      p.suspended=false;if(head)p.stoppedAt=0;
    }
    musicRamp(p,musicLevel(mWant),t.fadeIn||FADE_IN);
  }
  function music(id){const want=id&&TRACKS[id]?id:null;if(want===mWant)return;mWant=want;musicSync();}
  /* 先に取ってきて解いておく（ヴェラの階に入った時点で。第二形態に変わった瞬間に鳴らしたい） */
  function musicPrefetch(id){const t=TRACKS[id];if(!t||!ctx||ctx.state!=='running')return;const p=player(id);if(p&&p.kind==='buf')bufLoad(p);}
  function musicKick(){if(musicCanPlay()&&(!players[mWant]||!isPlaying(players[mWant])))musicSync();}
  function inspect(){prune();return {state:ctx?.state||'locked',music:(()=>{const p=players[mWant];return {want:mWant,id:p?p.id:null,kind:p?p.kind:null,playing:!!p&&isPlaying(p),volume:p?(p.gain?p.gain.gain.value:p.el?p.el.volume:0):0,routed:!!(p&&p.gain),time:p?(p.kind==='el'?p.el.currentTime:bufPos(p)):0,loaded:!!(p&&(p.kind==='el'||p.buf)),others:Object.values(players).filter(q=>q!==p&&isPlaying(q)).map(q=>q.id),fault:mFault};})(),externallyMuted:externalMutes.size>0,active:active.map(a=>({id:a.id,pulse:a.pulse,noise:a.noise})),queued:queue.length,counters:{...counters},history:history.slice(),fault};}
  window.ABYSS_AUDIO={defs:Object.freeze(defs),defaults:()=>copy(defaults),settings:()=>copy(settings),configure,unlock,emit,stop,inspect,setExternalMute,music,musicPrefetch,tracks:Object.freeze(Object.keys(TRACKS)),
    subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},resetStats(){counters={requested:0,played:0,dropped:0,stolen:0,peakEvents:0,peakPulse:0,peakNoise:0};history=[];},
    async audition(id){if(await unlock()){stop();return emit(id);}return false;}};
  addEventListener('storage',e=>{if(e.key===KEY)try{configure(JSON.parse(e.newValue||'{}'),false);}catch{}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();musicSync();if(ctx)ctx.suspend().catch(()=>{});}});
  addEventListener('pagehide',stop);
  // Gesture activation only; never autoplay or replay events accumulated while locked.
  for(const name of ['pointerdown','touchend','keydown'])document.addEventListener(name,()=>{if(settings.enabled&&(!ctx||ctx.state!=='running'))void unlock();else musicKick();},{capture:true,passive:true});
})();
