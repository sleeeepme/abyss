/* Browser autosave, format 1. No manual slots. The whole graph is one atomic
   localStorage value: account, run and world can never belong to different commits.
   Runtime callbacks are never evaluated from disk. Only registered game functions
   are resolved; closures for pending choices are reconstructed explicitly. */
(()=>{
  'use strict';
  const KEY='abyss.autosave.v1', BACKUP=KEY+'.previous', LOCK=KEY+'.writer';
  const VERSION=1, INTERVAL=5000, LIMIT=12*1024*1024;
  const defaults=JSON.parse(JSON.stringify(S));
  const worldDefaults=JSON.parse(JSON.stringify(W)),playerDefaults=JSON.parse(JSON.stringify(P));
  const functionIds=new Map(), functions=new Map();
  const definitions={STATUS,FAMILY,ZAKO,ABERRANT,ZONES,CONSUMABLES,BASES,PREFIX,SUFFIX,
    CHARM_AFFS,POTENTIALS,LEGENDS,UPGRADES,RELICS,HAZARDS,ORES,TRIAL_BANES,
    UP_SKILLS,BUILDINGS,CHARMS,BOONS,JOBS,CURSES,ULTS,WEAPON_ARTS,ELITE_JOBS,
    JOB_SKILLS,ALLY_ARTS,SPECIAL_JOBS,BOSS_STATS,BOSS_MOVES,UNIQUE_BOSSES,
    ZAKO_TRAITS,ARCH,ELITE_AFF,MOSS_KINDS,EVENTS};
  function register(v,path,seen=new Set()){
    if(typeof v==='function'){functionIds.set(v,path);functions.set(path,v);return;}
    if(!v||typeof v!=='object'||seen.has(v))return;
    seen.add(v);for(const k of Object.keys(v))register(v[k],path+'.'+k,seen);
  }
  register(definitions,'definitions');
  const typed={Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};
  const forbidden=new Set(['__proto__','prototype','constructor']);
  function pack(root){
    const nodes=[],ids=new Map();
    function value(v){
      if(v===undefined)return {u:1};
      if(typeof v==='number'&&!Number.isFinite(v))return {n:String(v)};
      if(typeof v==='function'){
        const id=functionIds.get(v);if(!id)throw Error('未登録の保存対象関数');return {f:id};
      }
      if(v===null||typeof v!=='object')return v;
      if(ids.has(v))return {r:ids.get(v)};
      const id=nodes.length;ids.set(v,id);nodes.push(null);
      if(v instanceof Set)nodes[id]={t:'Set',v:[...v].map(value)};
      else if(v instanceof Map)nodes[id]={t:'Map',v:[...v].map(([k,x])=>[value(k),value(x)])};
      else if(ArrayBuffer.isView(v)&&typed[v.constructor.name])nodes[id]={t:v.constructor.name,v:Array.from(v)};
      else if(Array.isArray(v))nodes[id]={t:'Array',v:v.map(value)};
      else{
        if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw Error('未対応の保存対象');
        const entries=[];
        for(const k of Object.keys(v)){
          if(forbidden.has(k))throw Error('不正な保存キー');
          if(v===S&&k==='debug')continue;
          if(v===W&&k==='pops')continue;
          entries.push([k,value(v[k])]);
        }
        nodes[id]={t:'Object',v:entries};
      }
      return {r:id};
    }
    return {root:value(root),nodes};
  }
  function unpack(g){
    if(!g||!Array.isArray(g.nodes)||g.nodes.length>150000)throw Error('保存形式が不正');
    const out=g.nodes.map(n=>{
      if(!n||!Array.isArray(n.v)||n.v.length>200000)throw Error('保存形式が不正');
      if(n.t==='Object')return {};
      if(n.t==='Array')return [];
      if(n.t==='Set')return new Set();
      if(n.t==='Map')return new Map();
      if(Object.hasOwn(typed,n.t))return new typed[n.t](n.v);
      throw Error('未知の保存型');
    });
    function value(v){
      if(v===null||typeof v!=='object')return v;
      if(Object.hasOwn(v,'r')){if(!Number.isInteger(v.r)||v.r<0||v.r>=out.length)throw Error('参照が不正');return out[v.r];}
      if(v.u===1)return undefined;
      if(Object.hasOwn(v,'f')){if(!functions.has(v.f))throw Error('非対応のゲーム定義');return functions.get(v.f);}
      if(['Infinity','-Infinity','NaN'].includes(v.n))return Number(v.n);
      throw Error('保存値が不正');
    }
    g.nodes.forEach((n,i)=>{
      const o=out[i];
      if(n.t==='Object')for(const pair of n.v){
        if(!Array.isArray(pair)||typeof pair[0]!=='string'||forbidden.has(pair[0]))throw Error('保存キーが不正');
        o[pair[0]]=value(pair[1]);
      }
      else if(n.t==='Array')o.push(...n.v.map(value));
      else if(n.t==='Set')n.v.forEach(x=>o.add(value(x)));
      else if(n.t==='Map')n.v.forEach(([k,x])=>o.set(value(k),value(x)));
    });
    return value(g.root);
  }
  function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function read(raw){
    if(!raw)return null;
    if(raw.length>LIMIT)throw Error('保存データが大きすぎます');
    const e=JSON.parse(raw);
    if(e.version!==VERSION){const err=Error('この版では読み込めない保存データです');err.incompatible=true;throw err;}
    if(!Number.isSafeInteger(e.revision)||e.revision<1||!Number.isFinite(e.savedAt))throw Error('保存情報が不正です');
    if(e.deleted===true)return e;
    if(typeof e.payload!=='string'||hash(e.payload)!==e.checksum)throw Error('保存データが破損しています');
    const d=unpack(JSON.parse(e.payload));validate(d);e.data=d;return e;
  }
  function validate(d){
    if(!d||!d.s||!d.p||!d.w||!d.ui||!d.feel)throw Error('保存項目が足りません');
    if(typeof d.s.name!=='string'||d.s.name.length>100||!Number.isSafeInteger(d.rng)||!Number.isSafeInteger(d.itemId))throw Error('進行情報が不正です');
    for(const k of ['gold','shards','deaths','runs','deepest'])if(!Number.isFinite(d.s[k])||d.s[k]<0)throw Error('進行値が不正です');
    for(const k of ['stash','legendStash','carry','tavern','fallen'])if(!Array.isArray(d.s[k]))throw Error('持ち物が不正です');
    if(d.s.hero&&(!Number.isFinite(d.s.hero.hpNow)||!d.s.hero.equip||!Array.isArray(d.s.hero.party)||!Array.isArray(d.s.hero.boons)))throw Error('主人公の状態が不正です');
    if(d.s.run){
      if(!Number.isInteger(d.s.run.depth)||d.s.run.depth<1||d.s.run.depth>100||!Array.isArray(d.s.run.loot))throw Error('探索情報が不正です');
      const f=d.w.fl;
      if(!d.s.hero||!f||!Number.isInteger(f.W)||!Number.isInteger(f.H)||f.W<1||f.H<1||f.W>512||f.H>512||f.g.length!==f.H)throw Error('探索情報が不正です');
      if(!Number.isFinite(d.p.x)||!Number.isFinite(d.p.y)||d.p.x<0||d.p.y<0||d.p.x>=f.W||d.p.y>=f.H)throw Error('座標が不正です');
      if(!Array.isArray(d.w.enemies)||!Array.isArray(d.w.drops)||!Array.isArray(d.w.seen)||d.w.seen.length!==f.H||f.g.some(r=>!r||r.length!==f.W)||d.w.seen.some(r=>!(r instanceof Uint8Array)||r.length!==f.W))throw Error('階層情報が不正です');
    }else if(!d.s.hero&&d.ui.phase!=='death')throw Error('主人公情報がありません');
    if(!['town','game','death','keep','boon','btarget','use','fallen','clear','gacha'].includes(d.ui.phase))throw Error('進行画面が不正です');
    if(d.ui.phase==='gacha'&&(!d.ui.gachaPending||!['item','charm'].includes(d.ui.gachaPending.kind)))throw Error('抽選結果が不正です');
    if(d.ui.phase==='use'&&(!d.ui.ut||!consumDef(d.ui.ut.consum)||!d.s.run.loot.includes(d.ui.ut)))throw Error('使用するアイテムが不正です');
    if(d.ui.phase==='keep'&&(!Array.isArray(d.ui.keepPool)||!(d.ui.keepSel instanceof Set)))throw Error('帰還選択が不正です');
    if(d.ui.phase==='boon'&&(!Array.isArray(d.ui.boon)||!d.ui.boon.length))throw Error('恩寵選択が不正です');
    if(d.ui.phase==='btarget'&&(!d.ui.bt||!d.ui.btTargets.length))throw Error('付与先が不正です');
    if(d.ui.phase==='fallen'&&!d.ui.fallen)throw Error('仲間情報が不正です');
  }
  // Back to a fresh S, but keep the session-only debug switches (see restore()).
  function resetState(){const keepDebug=S.debug;for(const k of Object.keys(S))delete S[k];Object.assign(S,JSON.parse(JSON.stringify(defaults)));if(keepDebug)S.debug=keepDebug;}
  let active=false,ready=false,owned=false,release=null,held=false,failed=false,dirty=false,newRequested=false;
  let debugSession=false,pending=null,recovery=null,currentRaw=null,revision=0,lastWrite=0,lastSaved=0,lastPayload=null,metrics={};
  const style=document.createElement('style');
  style.textContent='#save-status{position:fixed;bottom:max(7px,env(safe-area-inset-bottom));left:10px;z-index:190;font-size:11px;color:#a9bdba;pointer-events:none;text-shadow:0 1px 3px #000}#save-dialog{z-index:10000}#save-summary{white-space:pre-line;font-size:12px;color:var(--dim);line-height:1.8;margin-top:12px}';document.head.append(style);
  const status=document.createElement('div');status.id='save-status';status.setAttribute('role','status');document.body.append(status);
  const dialog=document.createElement('div');dialog.id='save-dialog';dialog.className='modal';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','save-heading');
  dialog.innerHTML='<div class="box"><h1 id="save-heading"></h1><p class="sub" id="save-message"></p><button class="primary" id="save-action"></button><button class="ghost" id="save-reset" hidden>データを消してはじめから</button></div>';document.body.append(dialog);
  const summary=document.createElement('div');summary.id='save-summary';el('t-start').after(summary);
  const fresh=document.createElement('button');fresh.className='ghost';fresh.textContent='はじめから';fresh.hidden=true;summary.after(fresh);
  let action=null;
  el('save-action').addEventListener('click',()=>{if(action)action();});
  function show(title,message,label,fn){
    el('save-reset').hidden=true;
    el('save-heading').textContent=title;el('save-message').textContent=message;
    el('save-action').textContent=label;action=fn;dialog.classList.add('on');
  }
  function close(){dialog.classList.remove('on');action=null;}
  function stamp(t){return new Date(t).toLocaleString('ja-JP');}
  function title(){
    if(!ready){el('t-start').disabled=true;return;}
    el('t-start').disabled=!owned||failed;
    fresh.hidden=!pending||failed||!owned;
    if(fresh.hidden)fresh.remove();else summary.after(fresh);
    if(pending){
      el('t-start').textContent='つづきから';
      const d=pending.data;summary.textContent=d.s.name+' ／ '+(d.s.run?'第'+d.s.run.depth+'階層':d.ui.phase==='death'?'死亡後':'街')+'\n'+stamp(pending.savedAt)+' 自動保存';
    }else{summary.textContent=owned?'進行はこのブラウザに自動保存されます':'別のタブでプレイ中です';}
  }
  function neutralInput(){for(const k of Object.keys(keys))delete keys[k];stickDx=stickDy=0;stickId=null;gbHeld=false;if(typeof feelPointers!=='undefined')feelPointers.clear();P.guard=false;P.vx=P.vy=0;}
  function getUI(){
    let screen=FEEL.boss?.screen||S.screen;
    let phase=_pending?'gacha':screen==='clear'?'clear':screen==='keep'?'keep':screen==='boon'?'boon':screen==='btarget'?(_utItem?'use':'btarget'):_fallen&&S.run?'fallen':!S.hero&&S.name?'death':S.run?'game':'town';
    const deathBaseText=document.createElement('div');deathBaseText.innerHTML=_deathHtml;
    return {phase,gachaPending:_pending,clearText:el('clr-sub').textContent,ut:_utItem,deathPool:_deathPool,deathBase:_deathBase,deathCap:_deathCap,
      deathText:el('d-body').textContent,deathSummary:deathBaseText.textContent,
      keepPool:_keepPool,keepSel:_keepSel,keepFree:_keepFree,
      boon:_boonPending,boonTier:_boonTier,boonSub:el('boon-sub').textContent,
      bt:_btPending,btTargets:_btTargets,fallen:_fallen,fallenQueue:_fallenQueue,artNamePend:_artNamePend};
  }
  function snapshot(){
    const f={dashCd:FEEL.dashCd,just:FEEL.just,justUsed:FEEL.justUsed,slow:FEEL.slow,slowScale:FEEL.slowScale,time:FEEL.time};
    const root={s:S,p:S.run?P:playerDefaults,w:S.run?W:worldDefaults,ui:getUI(),feel:f,rng:RNG.state(),itemId:genItem._n||0};
    return JSON.stringify(pack(root));
  }
  function error(err){
    failed=true;held=true;neutralInput();status.textContent='自動保存できません';
    show('保存できません', '進行を停止しています。この画面を閉じずに再試行してください。'+(lastSaved?' 最終保存：'+stamp(lastSaved):'')+'（'+err.message+'）','再試行',()=>{
      if(active){failed=false;if(commit(true)){held=false;close();last=performance.now();}}
      else{failed=false;loadDisk();}
    });
  }
  function commit(force=false){
    if(!ready||!owned||!active||failed||debugSession||(!S.name&&!S.hero))return false;
    if(S.debug&&Object.values(S.debug).some(Boolean)){debugSession=true;status.textContent='検証中：通常データへの保存を停止';return false;}
    if(!force&&!dirty&&performance.now()-lastWrite<INTERVAL)return true;
    const t=performance.now();
    try{
      if(localStorage.getItem(KEY)!==currentRaw)throw Error('別の画面で保存データが更新されました。再読み込みしてください');
      const payload=snapshot();
      if(payload===lastPayload){dirty=false;lastWrite=performance.now();return true;}
      const envelope={version:VERSION,build:'20260926',revision:revision+1,savedAt:Date.now(),payload,checksum:hash(payload)};
      const raw=JSON.stringify(envelope);if(raw.length>LIMIT)throw Error('保存容量の上限を超えました');
      // Backup failure must not be hidden, and must never destroy the primary.
      if(currentRaw)localStorage.setItem(BACKUP,currentRaw);
      localStorage.setItem(KEY,raw);
      currentRaw=raw;lastPayload=payload;revision=envelope.revision;lastSaved=envelope.savedAt;
      dirty=false;lastWrite=performance.now();status.textContent='';  // 成功は出さない（頻繁に保存するので出し続けに見える。2026-10-01）。失敗だけ出す
      metrics={bytes:raw.length*2,writeMs:performance.now()-t};return true;
    }catch(e){error(e);return false;}
  }
  function request(){if(active&&!debugSession)dirty=true;}
  function frame(){
    if(!ready)return;
    if(active&&!held&&!failed&&(dirty||performance.now()-lastWrite>=INTERVAL))commit();
    if(!failed&&!debugSession&&performance.now()-lastWrite>2200)status.textContent='';
    // setScreen closes all normal modals; saving failures must survive that call.
    if(failed)dialog.classList.add('on');
  }
  function restore(d){
    // Graph roots stay identical to S/P/W, including any references back to P.
    // Remap those three objects before copying into the game's const bindings.
    const map=new Map([[d.s,S],[d.p,P],[d.w,W]]),seen=new Set();
    function remap(v){
      if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;
      if(seen.has(v))return map.get(v)||v;seen.add(v);
      if(v instanceof Set){const a=[...v].map(remap);v.clear();a.forEach(x=>v.add(x));}
      else if(v instanceof Map){const a=[...v].map(([k,x])=>[remap(k),remap(x)]);v.clear();a.forEach(([k,x])=>v.set(k,x));}
      else for(const k of Object.keys(v))v[k]=remap(v[k]);
      return map.get(v)||v;
    }
    const roots=[d.s,d.p,d.w];remap(d);
    // S.debug is session-only (never saved). Keep it across the swap, otherwise
    // switches turned on at the title (e.g. 階層全開放) vanish on 「つづきから」.
    const keepDebug=S.debug;
    for(const [i,target] of [S,P,W].entries()){Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,roots[i]);}
    if(keepDebug)S.debug=keepDebug;
    W.pops=[];RNG=mulberry32(d.rng);genItem._n=d.itemId;
    _intrF=null;_intrKey='';_fallen=null;_fallenQueue=d.ui.fallenQueue||[];
    _deathPool=d.ui.deathPool;_deathBase=d.ui.deathBase;_deathCap=d.ui.deathCap;
    // Only text crosses the disk/UI boundary. Never restore serialized HTML.
    const escaped=document.createElement('div');escaped.textContent=d.ui.deathSummary||'';_deathHtml=escaped.innerHTML;
    _keepPool=d.ui.keepPool;_keepSel=d.ui.keepSel;_keepFree=d.ui.keepFree;_keepAfter=sold=>finishReturn(sold);
    _boonPending=d.ui.boon;_boonTier=d.ui.boonTier;_btPending=d.ui.bt;_btTargets=d.ui.btTargets;
    _artNamePend=d.ui.artNamePend;_paused=false;_pending=d.ui.gachaPending;_utItem=null;_utTargets=[];
    const dash=P.dash;resetFeel();P.dash=dash;Object.assign(FEEL,d.feel);FEEL.floor=W.fl;
    neutralInput();
    const phase=d.ui.phase;
    if(phase==='death'){
      setScreen('none');el('d-body').textContent=d.ui.deathText;renderDeathLegacy();el('m-death').classList.add('on');
    }else if(phase==='gacha'){setScreen('gacha');showGachaResult(_pending);
    }else if(phase==='clear'){
      setScreen('none');S.screen='clear';el('clr-sub').textContent=d.ui.clearText;
      el('clr-body').textContent='第'+S.run.depth+'階層を踏破。帰還ポータルが開きました。';el('m-clear').classList.add('on');
    }else if(phase==='use'){setScreen('game');openUseTarget(d.ui.ut);
    }else if(phase==='keep'){
      setScreen('none');S.screen='keep';renderKeep();el('m-keep').classList.add('on');
    }else if(phase==='boon'){
      setScreen('none');openBoonPick(_boonTier,'',_boonPending);el('boon-sub').textContent=d.ui.boonSub;
    }else if(phase==='btarget'){setScreen('none');openBoonTarget(_btPending,_btTargets);}
    else if(phase==='fallen'){setScreen('none');openFallen(d.ui.fallen);}
    else setScreen(phase);
    last=performance.now();
    if(S.run){
      held=true;show('探索を再開', '第'+S.run.depth+'階層。準備ができたら再開してください。','再開',()=>{held=false;close();neutralInput();last=performance.now();});
    }
  }
  function loadDisk(){
    close();pending=null;recovery=null;
    try{
      currentRaw=localStorage.getItem(KEY);pending=read(currentRaw);
      revision=pending?.revision||0;lastSaved=pending?.savedAt||0;lastPayload=pending?.payload||null;
      if(pending?.deleted)pending=null;
      ready=true;failed=false;held=false;title();
    }catch(e){
      ready=true;failed=true;held=true;
      if(!e.incompatible)try{const b=read(localStorage.getItem(BACKUP));if(b&&!b.deleted)recovery=b;}catch(_){}
      title();
      if(recovery)show('保存データを復旧', '最新の保存を読み込めません。'+stamp(recovery.savedAt)+'の記録に戻します。この日時以降の進行は失われます。','この記録から復旧',()=>{
        try{const raw=localStorage.getItem(BACKUP);localStorage.setItem(KEY,raw);failed=false;loadDisk();}catch(err){error(err);}
      });
      else show('保存データを読み込めません',e.message+'。データは変更していません。対応するゲーム版で開くか、保存環境を確認してください。','再試行',()=>{loadDisk();});
      el('save-reset').hidden=!owned;
    }
  }
  async function acquire(){
    if(!navigator.locks){ready=true;error(Error('この環境は同時保存の保護に対応していません。別のブラウザで開いてください'));return;}
    try{await navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
      if(!lock){ready=true;owned=false;title();show('別のタブでプレイ中', '先に開いたゲームを閉じてから再試行してください。','再試行',()=>{close();acquire();});return;}
      owned=true;loadDisk();await new Promise(resolve=>{release=resolve;});owned=false;
    });}catch(e){ready=true;error(e);}
  }
  function clear(){
    if(!owned||failed)return false;
    try{
      const raw=JSON.stringify({version:VERSION,revision:revision+1,savedAt:Date.now(),deleted:true});
      localStorage.setItem(KEY,raw);currentRaw=raw;revision++;localStorage.removeItem(BACKUP);
      pending=null;lastPayload=null;active=false;held=false;debugSession=false;fresh.hidden=true;summary.textContent='進行はこのブラウザに自動保存されます';return true;
    }catch(e){error(e);return false;}
  }
  el('save-reset').addEventListener('click',()=>{
    if(!owned||!confirm('保存データと復旧用データを完全に消去します。元には戻せません。よろしいですか？'))return;
    failed=false;
    if(!clear())return;
    resetState();
    close();setScreen('title');title();
  });
  fresh.addEventListener('click',()=>{
    if(!confirm('現在の冒険を上書きして、はじめから始めますか？'))return;
    newRequested=true;openNameEntry();
  });
  window.ABYSS_SAVE={
    paused:()=>held||failed||!ready||!owned,
    frame,request,clear,
    afterAction(){if(active){request();commit(true);}},
    continue(){
      if(!ready||!owned||failed)return true;
      if(pending){
        newRequested=false;const d=pending.data;
        try{validate(d);restore(d);pending=null;active=true;dirty=false;lastWrite=performance.now();fresh.hidden=true;summary.textContent='';}
        catch(e){error(e);}return true;
      }
      active=true;return false;
    },
    info:()=>({ready,owned,active,held,failed,revision,lastSaved,debugSession,...metrics})
  };
  // Tests opt out only by an explicit URL; normal webdriver sessions still persist.
  if(new URLSearchParams(location.search).get('save')==='off'){
    ready=true;owned=true;debugSession=true;title();status.textContent='検証用：保存なし';return;
  }
  // Hook state-changing entry points. Writes happen after the outer event/update,
  // never half way through returnToTown(), death, or a multi-hit update.
  for(const name of ['startRun','enterFloor','die','returnToTown','finishReturn',
    'killEnemy','openBoonPick','applyBoon','openFallen','letFallenGo','closeFallen']){
    const original=window[name];if(typeof original!=='function')continue;
    window[name]=function(...args){const result=original.apply(this,args);request();return result;};
  }
  const baseConfirmName=confirmName;confirmName=function(){
    if(newRequested){
      resetState();
      genItem._n=0;newRequested=false;pending=null;lastPayload=null;
    }
    baseConfirmName();active=true;request();
  };
  const basePickup=autoPickup;autoPickup=function(...args){
    const before=W.drops.length;const result=basePickup.apply(this,args);
    if(W.drops.length!==before)request();return result;
  };
  const baseRenderTitle=renderTitle;renderTitle=function(){baseRenderTitle();title();};RENDERERS.title=renderTitle;
  for(const type of ['click','touchend','change'])document.addEventListener(type,e=>{
    if(e.target.closest?.('#save-dialog'))return;
    if(held||failed||!ready||!owned){e.preventDefault();e.stopImmediatePropagation();return;}
    // A debug session is tainted until reload, even after switches are disabled.
    if(e.target.closest?.('#m-debug')){debugSession=true;status.textContent='検証中：通常データへの保存を停止';}
    if(active)request();
    setTimeout(()=>{if(active&&!held){commit(true);}},0);
  },true);
  for(const type of ['pointerdown','pointerup','touchstart','touchmove','keydown','keyup'])document.addEventListener(type,e=>{
    if(e.target.closest?.('#save-dialog'))return;
    if(held||failed||!ready||!owned){if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();}
  },{capture:true,passive:false});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(active&&!failed)commit(true);held=true;neutralInput();}
    else if(active&&!failed){show('一時停止中','準備ができたら再開してください。','再開',()=>{held=false;close();last=performance.now();});}
    else if(!failed)held=false;
  });
  addEventListener('pagehide',()=>{if(active&&!failed)commit(true);held=true;if(release)release();});
  addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  title();acquire();
})();
