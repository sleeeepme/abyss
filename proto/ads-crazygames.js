/* CrazyGames HTML5 SDK v3 adapter. Opt in with ?ads=crazygames.
   SDK environment, never our URL detection, decides whether ads are supported. */
(() => {
  'use strict';
  const query=new URLSearchParams(location.search);
  const cgHost=host=>host==='crazygames.com'||host.endsWith('.crazygames.com')||host.endsWith('.crazygamesusercontent.com');
  let refHost='';try{refHost=new URL(document.referrer).hostname;}catch{}
  const enabled=query.get('ads')==='crazygames'||cgHost(location.hostname)||cgHost(refHost);
  let sdk=null, state=enabled?'loading':'off', inFlight=null, playing=false, platformMuted=false;
  let gameplay=false, desiredGameplay=false, failure=null;
  const mute=()=>window.ABYSS_AUDIO?.setExternalMute('crazygames',platformMuted||!!inFlight);
  const update=()=>{
    mute();
    document.body?.classList.toggle('cg-ad-playing',playing);
    window.dispatchEvent(new Event('abyss-ad-state'));
  };
  function syncGameplay(value){
    desiredGameplay=!!value;
    const next=desiredGameplay&&!inFlight&&!document.hidden;
    if(!sdk||!['ready','basic'].includes(state)||next===gameplay)return;
    try{sdk.game[next?'gameplayStart':'gameplayStop']();gameplay=next;}catch{}
  }
  function loadSdk(){
    if(window.CrazyGames?.SDK)return Promise.resolve(window.CrazyGames.SDK);
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timer=setTimeout(()=>{script.remove();reject(Error('SDK load timeout'));},15000);
      script.src='https://sdk.crazygames.com/crazygames-sdk-v3.js';
      script.onload=()=>{clearTimeout(timer);window.CrazyGames?.SDK?resolve(window.CrazyGames.SDK):reject(Error('SDK missing'));};
      script.onerror=()=>{clearTimeout(timer);reject(Error('SDK load failed'));};
      document.head.append(script);
    });
  }
  function bounded(promise){
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SDK init timeout')),15000);})]).finally(()=>clearTimeout(timer));
  }
  const ready=enabled ? (async()=>{
    try{
      const candidate=await loadSdk();await bounded(candidate.init());
      if(!['local','crazygames'].includes(candidate.environment)){state='disabled';return false;}
      sdk=candidate;state='ready';
      platformMuted=!!sdk.game.settings?.muteAudio;
      sdk.game.addSettingsChangeListener(settings=>{platformMuted=!!settings.muteAudio;mute();});
      // The game is already interactive when this async initialization completes.
      // Do not report a fictitious loading interval retroactively.
      update();syncGameplay(desiredGameplay);return true;
    }catch{state='error';failure='initialization';return false;}
    finally{update();}
  })() : Promise.resolve(false);
  async function requestRewarded({signal}){
    if(!await ready||signal.aborted||state!=='ready')return {status:'unavailable'};
    if(inFlight)return {status:'unavailable'};
    return new Promise(resolve=>{
      let finished=false;
      const watchdog=setTimeout(()=>finish('error',{code:'timeout'}),120000);
      const job={};inFlight=job;syncGameplay(false);update();
      const abort=()=>{
        // SDK has no cancel API. Keep pause/mute until its terminal callback.
        // Aborting our reward session must not pretend the SDK overlay closed.
        resolve({status:'cancelled'});
      };
      signal.addEventListener('abort',abort,{once:true});
      function finish(status,error){
        if(finished)return;finished=true;
        clearTimeout(watchdog);
        signal.removeEventListener('abort',abort);
        if(inFlight===job){inFlight=null;playing=false;}
        if(error?.code==='adsDisabledBasicLaunch')state='basic';
        failure=error?.code||null;
        update();
        resolve({status:signal.aborted?'cancelled':status});
      }
      try{
        const returned=sdk.ad.requestAd('rewarded',{
          adStarted(){if(finished)return;playing=true;window.releaseHeld?.();update();},
          adFinished(){finish('rewarded');},
          adError(error){finish(['unfilled','adblock','adCooldown','adsDisabledBasicLaunch'].includes(error?.code)?'unavailable':'error',error);}
        });
        // Resolving requestAd does NOT certify a completed view; only callbacks do.
        Promise.resolve(returned).catch(error=>finish('error',error));
      }catch(error){finish('error',error);}
    });
  }
  window.ABYSS_CRAZYGAMES=Object.freeze({enabled,ready,syncGameplay,
    get blocked(){return !!inFlight;},
    get unavailable(){return ['basic','disabled','error'].includes(state);},
    inspect:()=>({state,environment:sdk?.environment||null,playing,pending:!!inFlight,platformMuted,failure})
  });
  if(enabled){
    window.ABYSS_ADS.setProvider({name:'crazygames',requestRewarded});
    const style=document.createElement('style');
    style.textContent='body.cg-ad-playing #m-ad,body.cg-ad-playing #abyss-audio-toggle,body.cg-ad-playing #abyss-audio-panel{visibility:hidden!important}';
    document.head.append(style);
    document.addEventListener('visibilitychange',()=>syncGameplay(desiredGameplay));
    document.addEventListener('DOMContentLoaded',update,{once:true});
  }
})();
