(() => {
  'use strict';
  const A=ABYSS_AUDIO,$=s=>document.querySelector(s),busNames={combat:'攻撃・通常命中',feedback:'被弾・重要な結果',world:'取得・探索',ui:'UI操作'};
  if(new URLSearchParams(location.search).has('embedded'))document.body.classList.add('embedded');
  let config=A.settings(),filter='all',timers=[],runId=0;
  const globals=[['master','全体音量',0,.8,.01,'percent'],['maxEvents','同時に鳴る効果音',1,3,1,'件'],['maxStarts','1秒あたりの通常音',3,12,1,'件'],['tail','余韻の長さ',.5,1,.05,'ratio'],['ally','仲間の音量',0,.5,.01,'percent'],['distance','聞こえる距離',3,12,1,'マス'],['duck','重要音中の通常音量',.1,.65,.05,'percent']];
  const fmt=(n,unit)=>unit==='percent'?Math.round(n*100)+'%':unit==='ratio'?Math.round(n*100)+'%':n+' '+unit;
  function status(message){$('#status').textContent=message;}
  async function audition(id){stop();const d=A.defs[id],s=config.sounds[id];if(!config.enabled||!s.enabled||!s.gain||!config.master||!config.buses[d.bus]){status('この音は消音設定です。音量またはON/OFFを変更してください。');return;}await A.audition(id);status(d.name+'を試聴');}
  function stop(){runId++;timers.forEach(clearTimeout);timers=[];A.stop();}
  function save(){stop();const saved=A.configure(config);config=A.settings();$('#mute').textContent=config.enabled?'消音':'消音を解除';status(saved?'保存しました。このブラウザのゲームに反映されます。':'保存できません。JSONを書き出してください。');}
  function field(key,label,min,max,step,unit,value,onchange){
    const el=document.createElement('div');el.className='field';
    const id='control-'+key;
    el.innerHTML=`<label for="${id}">${label}</label><output for="${id}">${fmt(value,unit)}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
    el.querySelector('input').oninput=e=>{const v=Number(e.target.value);el.querySelector('output').textContent=fmt(v,unit);onchange(v);};return el;
  }
  function render(){
    $('#global-fields').replaceChildren(...globals.map(([k,label,min,max,step,unit])=>field(k,label,min,max,step,unit,config[k],v=>{config[k]=v;save();})));
    $('#bus-fields').replaceChildren(...Object.entries(busNames).map(([k,label])=>field(k,label,0,1,.01,'percent',config.buses[k],v=>{config.buses[k]=v;save();})));
    $('#filters').innerHTML=Object.entries({all:'すべて',...busNames}).map(([k,label])=>`<button data-filter="${k}" class="${filter===k?'selected':''}">${label}</button>`).join('');
    $('#filters').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
    $('#sound-list').replaceChildren();
    for(const [id,d] of Object.entries(A.defs)){
      if(filter!=='all'&&d.bus!==filter)continue;const s=config.sounds[id],row=document.createElement('div');row.className='sound';row.dataset.sound=id;
      row.innerHTML=`<label class="name"><input type="checkbox" ${s.enabled?'checked':''} aria-label="${d.name}を有効にする"> ${d.name}<small>${d.texture||busNames[d.bus]} · ${Math.round(d.length*1000)}ms</small></label><button class="play" aria-label="${d.name}を試聴">▶ 試聴</button>`;
      row.querySelector('input').onchange=e=>{config.sounds[id].enabled=e.target.checked;save();};
      row.querySelector('button').onclick=()=>audition(id);
      const gain=field(id+'-gain','音量',0,1,.01,'percent',s.gain,v=>{config.sounds[id].gain=v;save();});gain.classList.add('gain');row.append(gain);
      const cooldown=field(id+'-cooldown','最短間隔',60,3000,10,'ms',s.cooldown,v=>{config.sounds[id].cooldown=v;save();});cooldown.classList.add('cooldown');row.append(cooldown);$('#sound-list').append(row);
    }
    $('#mute').textContent=config.enabled?'消音':'消音を解除';
  }
  $('#enable').onclick=async()=>{config.enabled=true;save();status(await A.unlock()?'音を有効にしました。試聴やゲームを始められます。':'もう一度押して音声を開始してください。');};
  document.querySelectorAll('[data-featured]').forEach(b=>b.onclick=()=>audition(b.dataset.featured));
  $('#mute').onclick=async()=>{config.enabled=!config.enabled;save();if(config.enabled)await A.unlock();else status('消音しました。ゲームも消音になります。');};
  $('#stop').onclick=()=>{stop();status('試聴を停止しました。');};
  $('#presets').querySelectorAll('button').forEach(b=>b.onclick=()=>{const p=b.dataset.preset;config=A.defaults();if(p==='quiet'){config.master=.22;config.ally=.12;config.tail=.7;config.maxStarts=5;}if(p==='clear'){config.master=.45;config.ally=.2;config.buses.feedback=1;config.tail=.9;}save();render();status(b.textContent+'を適用しました。');});
  $('#reset').onclick=()=>{config=A.defaults();save();render();};
  $('#export').onclick=()=>{const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='abyss-audio-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('#import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>65536)throw Error();const data=JSON.parse(await file.text());if(data.version!==1||!data.sounds||typeof data.master!=='number')throw Error();config=data;save();render();status('設定を読み込みました。');}catch{status('設定JSONを読み込めません。形式とバージョンを確認してください。');}e.target.value='';};
  document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=async()=>{
    stop();if(!config.enabled){status('消音を解除してください。');return;}const run=runId;if(!await A.unlock()||run!==runId)return;A.resetStats();
    const schedule=(ms,id,options={})=>timers.push(setTimeout(()=>{if(run===runId)A.emit(id,options);},ms));
    const type=b.dataset.demo;
    if(type==='duel')for(let t=0;t<4000;t+=480){schedule(t,'slash');schedule(t+100,'hit');if(t===960)schedule(t+180,'hurt');}
    if(type==='crowd')for(let t=0;t<5000;t+=80){schedule(t,t%240===0?'magic':'slash');schedule(t,'hit');schedule(t,'magic',{ally:true,distance:3});schedule(t+12,'defeat',{ally:true,distance:6});if(t%800===0)schedule(t,'critical');if(t===1600)schedule(t,'hurt');if(t===3200)schedule(t,'parry');}
    if(type==='danger'){schedule(0,'magic');schedule(30,'slash',{ally:true,distance:2});schedule(65,'hurt');schedule(600,'guard');schedule(1000,'slash');schedule(1040,'parry');schedule(1700,'skill');schedule(2200,'level');}
    status('重なりを確認中。下に再生・省略の理由が表示されます。');
  });
  function refresh(){const s=A.inspect(),c=s.counters;$('#stats').textContent=`再生 ${c.played} / 省略 ${c.dropped} / 同時 ${s.active.length} / 最大 ${c.peakEvents}`;$('#meter').style.width=(s.active.length/3*100)+'%';$('#log').replaceChildren(...s.history.slice(0,8).map(h=>{const d=document.createElement('div');d.textContent=`${h.result==='play'?'再生':'省略'} · ${A.defs[h.id]?.name||h.id} · ${h.why}`;return d;}));}
  const poll=setInterval(refresh,200);addEventListener('pagehide',()=>{stop();clearInterval(poll);});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  addEventListener('storage',()=>{config=A.settings();render();status('別の画面から設定が更新されました。');});render();
})();
