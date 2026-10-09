/* Load last, after feel/dash/save wrappers. All original return values are preserved. */
(() => {
  'use strict';
  const A=window.ABYSS_AUDIO;if(!A)return;
  const where=(e,ally=false)=>({ally,distance:e&&Number.isFinite(e.x)&&Number.isFinite(e.y)?Math.hypot(e.x-P.x,e.y-P.y):0});
  const emit=(id,o)=>{try{A.emit(id,o);}catch{}};
  const wrap=(name,after,before)=>{const f=window[name];if(typeof f!=='function')return;window[name]=function(...args){let old;try{old=before?.(...args);}catch{}const result=f.apply(this,args);try{after(args,result,old);}catch{}return result;};};
  const attack=st=>st.proj==='arrow'?'arrow':st.proj?'magic':st.dmgType==='blunt'?'blunt':'slash';
  wrap('playerAttack',(_,r,cd)=>{if(cd<=0&&P.atkCd>0)emit(attack(stats(S.hero)));},()=>P.atkCd);
  wrap('allyAttack',([a,st],r,shots)=>{if(a.shots!==shots)emit(attack(st),where(a,true));},a=>a.shots);
  // The visual hit hook runs only on a landed hit; passive damage ticks stay silent.
  wrap('feelImpact',([target,src,crit])=>{if(target===P)return; if(target?.arch)emit(crit?'critical':'hit',where(target,src!==P));});
  wrap('hitPlayer',(_,blocked)=>{if(blocked===false)emit(P.guard&&stats(S.hero).hasShield?'guard':'hurt');});
  wrap('feelPerfect',()=>emit('parry'));
  wrap('tapDash',(_,success)=>{if(success)emit('dash');});
  wrap('feelWeaponArtStart',([ent])=>emit('skill',where(ent,ent!==P)));
  wrap('feelUltimate',([ent])=>emit('skill',where(ent,ent!==P)));
  // Ordinary enemy deaths only after dead changes; phase transitions are not kills.
  wrap('killEnemy',([e,ally],r,was)=>{if(!was&&e.dead)emit(e.boss?'boss':'defeat',where(e,e.boss?false:!!ally));},e=>e.dead);
  wrap('die',(_,r,count)=>{if(S.deaths>count)emit('death');},()=>S.deaths);
  wrap('autoPickup',(_,r,n)=>{if(W.drops.length<n)emit('pickup');},()=>W.drops.length);
  wrap('useConsum',(_,ok)=>{if(ok)emit('heal');});
  wrap('onLevelUp',([h,self])=>{if(self)emit('level');});
  wrap('enterFloor',()=>emit('floor'));
  wrap('startRun',()=>emit('floor'));
  wrap('setScreen',()=>A.stop());
  wrap('openAd',()=>A.stop());
  // Capture touchend because existing bindTap handlers stop bubbling and prevent click.
  let lastTouch=-Infinity;
  function ui(e){
    if(e.type==='touchend')lastTouch=performance.now();else if(performance.now()-lastTouch<700)return;
    const node=e.target?.closest?.('button,[role="button"],.btn,.row[data-uid]');
    if(!node||node.disabled||node.closest('#abyss-audio-panel')||node.dataset.audioIgnore!==undefined)return;
    if(node.closest('#hud,#stick,#cv')&&!/bag|stat|menu/.test(node.id))return;
    const id=/close|cancel|back|戻|閉|キャンセル/.test(node.id+' '+node.textContent)?'back':'ui';
    // Run after the successful input handler / scene-change stop.
    queueMicrotask(()=>emit(id));
  }
  document.addEventListener('touchend',ui,{capture:true,passive:true});document.addEventListener('click',ui,true);
  // In-game panel stays on the same page: no risk of losing an unsaved run.
  const css=document.createElement('style');css.textContent='#abyss-audio-toggle{position:fixed;right:8px;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:9000;background:#17252eee;border:1px solid #647a80;color:#dcf4e5;border-radius:7px;padding:7px 10px;font:12px system-ui}#abyss-audio-panel{position:fixed;inset:0;z-index:10000;background:#090e13f5;display:none;padding:calc(env(safe-area-inset-top,0px) + 18px) 16px 16px}#abyss-audio-panel.on{display:flex;flex-direction:column}#abyss-audio-panel button{align-self:flex-end;padding:10px 18px;margin-bottom:10px}#abyss-audio-panel iframe{width:100%;height:100%;border:0;border-radius:10px}';document.head.append(css);
  const toggle=document.createElement('button');toggle.id='abyss-audio-toggle';toggle.dataset.audioIgnore='';toggle.textContent='音設定';
  const panel=document.createElement('div');panel.id='abyss-audio-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','効果音設定');panel.setAttribute('aria-modal','true');panel.innerHTML='<button type="button">ゲームへ戻る</button><iframe title="効果音管理" allow="autoplay"></iframe>';
  document.body.append(toggle,panel);let previousPause=false;
  // The game's pause recovery clears _paused when no normal modal exists.
  // This non-saveable settings overlay is its own explicit pause reason.
  const originalPaused=gamePaused;
  gamePaused=function(){return panel.classList.contains('on')||originalPaused.apply(this,arguments);};
  const open=()=>{previousPause=typeof _paused!=='undefined'&&_paused;pauseGame(true);if(typeof releaseHeld==='function')releaseHeld();A.stop();panel.classList.add('on');panel.querySelector('iframe').src='sound-admin.html?embedded=1';panel.querySelector('button').focus();};
  const close=()=>{panel.querySelector('iframe').src='about:blank';panel.classList.remove('on');pauseGame(previousPause);toggle.focus();};
  bindTap(toggle,open);bindTap(panel.querySelector('button'),close);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('on')){e.preventDefault();close();}});
})();
