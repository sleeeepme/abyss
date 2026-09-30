/* Five-minute expedition. The normal campaign is untouched unless ?alpha is present. */
(() => {
  if (!new URLSearchParams(location.search).has('alpha')) return;
  const initialState = JSON.stringify(S);
  const A = window.alphaTrial = { active:false, stage:0, limit:300, potions:2, result:null, killsAtEntry:0 };
  const depths=[1,3,5], names=['石の回廊','崩れた兵舎','主の居室'];
  const original={genFloor,enterFloor,update,die,openStairs,returnToTown,renderTitle};
  document.title='Abyss Relic — 5分の探索 α';
  document.body.classList.add('alpha');
  const style=document.createElement('style');
  style.textContent=`
    .alpha #adbar,.alpha #dbgbtn{display:none!important}
    .alpha #scr-title .ver{font-size:13px;color:#bcb29b;margin:18px 0 28px}
    .alpha #scr-title .tagline{font-size:15px;color:#a7b2a6;letter-spacing:.1em}
    .alpha #scr-title .foot{font-size:14px;max-width:370px;color:#a3acb8;line-height:1.9;margin-top:24px}
    .alpha #scr-title .logo{font-family:Georgia,serif;font-size:clamp(48px,9vw,76px);color:#dbc78b;text-shadow:3px 3px #352d21}
    .alpha #scr-title{background:radial-gradient(ellipse at 50% 38%,#26312c 0%,#111814 38%,#090e10 80%)}
    .alpha button{font-size:14px;min-height:44px}
    #alpha-status{position:fixed;z-index:8;top:calc(env(safe-area-inset-top) + 75px);left:12px;max-width:calc(100vw - 24px);display:none;padding:9px 12px;border-left:3px solid #d5b764;background:#0b1215ed;color:#dfd7c0;font-size:14px;line-height:1.6;pointer-events:none}
    #alpha-clock{font-variant-numeric:tabular-nums;color:#f3d787;font-weight:700}
    #alpha-objective{font-size:13px;color:#adbbb6}
    #alpha-actions{position:fixed;z-index:9;right:12px;top:calc(env(safe-area-inset-top) + 150px);display:none;gap:6px;flex-direction:column}
    #alpha-actions button{background:#111c23e8;border:1px solid #59665c;color:#e2ddcb;min-width:72px}
    #alpha-overlay{position:fixed;inset:0;z-index:120;background:#080d12ed;display:none;align-items:center;justify-content:center;padding:24px;overflow:auto}
    #alpha-overlay.on{display:flex}
    #alpha-card{width:min(440px,100%);padding:28px;border:1px solid #716548;background:#121c1e;box-shadow:0 16px 100px #0008}
    #alpha-card h1{color:#e1c681;font-size:28px;margin:8px 0 18px}
    #alpha-card p{font-size:15px;line-height:1.9;color:#c1cac8}
    #alpha-card .alpha-buttons{display:grid;gap:10px;margin-top:24px}
    #alpha-card .alpha-summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0;color:#aab9b7;font-size:14px}
    #alpha-card .alpha-summary b{display:block;font-size:24px;color:#e5dbc3;margin-top:5px}
    @media(max-width:540px){#alpha-status{max-width:calc(100vw - 110px);font-size:13px}#alpha-objective{font-size:12px}#alpha-card{padding:22px}}
  `;
  document.head.append(style);
  document.body.insertAdjacentHTML('beforeend', `<div id="alpha-status"><span id="alpha-clock">5:00</span>　<span id="alpha-stage"></span><div id="alpha-objective"></div></div><div id="alpha-actions"><button id="alpha-heal">回復 Q · 2</button><button id="alpha-pause" aria-label="一時停止">一時停止</button></div><div id="alpha-overlay" role="dialog" aria-modal="true" aria-labelledby="alpha-heading"><div id="alpha-card"></div></div>`);
  const clock=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  function modal(html){releaseHeld();for(const k of Object.keys(keys)) delete keys[k];setScreen('none');el('alpha-card').innerHTML=html;el('alpha-overlay').classList.add('on');sync();el('alpha-card').querySelector('button')?.focus();}
  function closeModal(){el('alpha-overlay').classList.remove('on');setScreen('game');last=performance.now();sync();}
  function restore(){for(const key of Object.keys(S)) delete S[key];Object.assign(S,JSON.parse(initialState));}
  function title(){
    original.renderTitle();
    el('t-start').textContent='5分の探索をはじめる';
    el('t-help').textContent='操作を確認する';
    document.querySelector('#scr-title .tagline').textContent='石の底に眠るもの';
    document.querySelector('#scr-title .ver').textContent='ALPHA 01 · 3区画 / 1人用';
    el('t-foot').innerHTML='仲間と潜り、主を倒して帰還する。<br>移動：WASD / 矢印キー / 画面ドラッグ<br>ダッシュ：画面タップ / X<br>攻撃は自動。近づいて E で拾う・進む。<br><span style="color:#ddc786">5分で帰還の鐘が鳴る。メニュー中は停止。</span>';
  }
  renderTitle=title;
  genFloor=function(depth){
    if(!A.active) return original.genFloor(depth);
    const W=40,H=32,g=Array.from({length:H},()=>new Uint8Array(W));
    const rooms=[{x:3,y:3,w:11,h:9},{x:24,y:3,w:12,h:10},{x:24,y:21,w:12,h:8},{x:3,y:20,w:12,h:9}].map(r=>({...r,cx:r.x+Math.floor(r.w/2),cy:r.y+Math.floor(r.h/2)}));
    for(const r of rooms) for(let y=r.y;y<r.y+r.h;y++) for(let x=r.x;x<r.x+r.w;x++) g[y][x]=T.FLOOR;
    for(let i=1;i<rooms.length;i++){
      const a=rooms[i-1],b=rooms[i];
      for(let x=Math.min(a.cx,b.cx);x<=Math.max(a.cx,b.cx);x++) for(let k=0;k<2;k++) g[a.cy+k][x]=T.FLOOR;
      for(let y=Math.min(a.cy,b.cy);y<=Math.max(a.cy,b.cy);y++) for(let k=0;k<2;k++) g[y][b.cx+k]=T.FLOOR;
    }
    const end=rooms[3];g[end.cy][end.cx]=T.STAIR;
    return {W,H,g,rooms,start:rooms[0],stair:{x:end.cx+.5,y:end.cy+.5},zone:zoneAt(depth),cycle:zoneCycle(depth)};
  };
  enterFloor=function(depth){
    original.enterFloor(depth);
    if(!A.active)return;
    A.stage=depths.indexOf(depth);A.killsAtEntry=S.run.kills;
    S.run.intrNext=Infinity;S.run.healAds=0;
    W.npc=null;W.ev=null;W.forge=null;W.shop=null;W.trial=null;W.ores=[];
    // Distribute encounters along the route, leaving the spawn room safe.
    W.enemies=W.enemies.filter(e=>!e.moss && !e.uniq);
    W.enemies.forEach((e,i)=>{
      const room=W.fl.rooms[1+i%3];
      if(!e.boss){e.x=room.x+2+(i*3)%7;e.y=room.y+2+(i*2)%4;e.atkV*=.65;}
      else {e.x=W.fl.stair.x+2;e.y=W.fl.stair.y;e.maxHp=650;e.hp=e.maxHp;e.atkV*=.65;}
    });
    const chestRoom=W.fl.rooms[1];
    if(W.drops[0]){W.drops[0].x=chestRoom.cx+.5;W.drops[0].y=chestRoom.cy+.5;}
    markFloorCleared(depth); // The exit marker guides a first-time player through the loop.
    if(A.stage>0){heal(stats(S.hero).maxHp*.25);livingParty().forEach(a=>a.hpNow=Math.min(allyStats(a).maxHp,a.hpNow+allyStats(a).maxHp*.25));}
    showBanner(names[A.stage],A.stage===2?'主を倒して、帰還ポータルへ':'敵を6体倒して、降り口へ','#d7c389',2.5);
    sync();
  };
  function start(){
    el('alpha-overlay').classList.remove('on');restore();
    A.active=true;A.result=null;A.potions=2;A.healAt=-10;A.stage=0;
    S.name='探索者';S.runs=A.attempt=(A.attempt||0)+1;S.hero=newHero();
    Object.assign(S.hero,{lv:3,str:7,dex:7,vit:7,int:7});
    S.hero.equip.weapon=genBaseItem('sword',3,1);
    S.hero.equip.armor=genBaseItem('leather',3,0);
    S.hero.equip.shield=genBaseItem('buckler',3,0);
    S.hero.party=['hunter','priest'].map((job,i)=>{const a=makeAlly(3,S.hero,jobDef(job));a.slot=i;a.boons=[];return a;});
    S.hero.hpNow=stats(S.hero).maxHp;
    startRun(1);sync();last=performance.now();
  }
  A.start=start;
  function sync(){
    const visible=A.active&&!A.result&&S.screen==='game';
    el('alpha-status').style.display=visible?'block':'none';el('alpha-actions').style.display=visible?'flex':'none';
    if(!A.active||!S.run)return;
    el('alpha-clock').textContent=clock(Math.ceil(A.limit-S.run.elapsed));
    el('alpha-stage').textContent=`${A.stage+1}/3 · ${names[A.stage]}`;
    const kills=S.run.kills-A.killsAtEntry;
    el('alpha-objective').textContent=A.stage===2?(S.run.bossAlive?'主を倒す → ポータルで帰還':'主を撃破！ ポータルで E / タップ'):(kills<6?`敵を倒す ${kills}/6 → 降り口へ`:'降り口で E / タップ → 次の区画');
    el('alpha-heal').textContent=`回復 Q · ${A.potions}`;
    el('alpha-heal').disabled=A.potions<=0||S.run.elapsed-A.healAt<8;
  }
  function finish(reason){
    if(A.result)return;
    const won=reason==='clear';
    A.result={reason,elapsed:S.run.elapsed,kills:S.run.kills,loot:S.run.loot.length,gold:S.run.gold,stage:A.stage+1};
    modal(`<div style="color:#b29c68;font-size:13px;letter-spacing:.18em">EXPEDITION ${won?'COMPLETE':'REPORT'}</div><h1 id="alpha-heading">${won?'生きて、帰った。':reason==='death'?'探索は、ここまで。':'帰還の鐘が鳴った。'}</h1><p>${won?'石の底の主を倒し、仲間と地上へ帰還した。':reason==='death'?'次は回復薬と盾を使い、敵の群れを通路へ誘い出そう。':'5分の探索が終了。主の撃破と帰還に、もう一度挑もう。'}</p><div class="alpha-summary"><div>探索時間<b>${clock(A.result.elapsed)}</b></div><div>到達区画<b>${A.result.stage} / 3</b></div><div>討伐<b>${A.result.kills} 体</b></div><div>戦利品<b>${A.result.loot} 点</b></div></div><div class="alpha-buttons"><button class="primary" id="alpha-retry">もう一度、潜る</button><button id="alpha-title">タイトルへ</button></div>`);
    el('alpha-retry').onclick=start;el('alpha-title').onclick=()=>{A.active=false;restore();el('alpha-overlay').classList.remove('on');setScreen('title');sync();};
  }
  update=function(dt){
    if(A.active){if(A.result)return;if(S.run.elapsed+dt>=A.limit){S.run.elapsed=A.limit;finish('time');return;}}
    original.update(dt);if(A.active)sync();
  };
  die=function(){if(A.active){finish('death');return;}original.die();};
  returnToTown=function(){if(A.active){if(A.stage===2&&!S.run.bossAlive)finish('clear');return;}original.returnToTown();};
  openStairs=function(){
    if(!A.active)return original.openStairs();
    if(S.run.bossAlive){log('主を倒すまで、帰還ポータルは開かない');return;}
    if(A.stage===2){finish('clear');return;}
    if(S.run.kills-A.killsAtEntry<6){log('この区画で敵を6体倒すと、降り口が開く');return;}
    modal(`<h1 id="alpha-heading">${names[A.stage]}を越えて</h1><p>次は「${names[A.stage+1]}」。<br>一息つき、全員のHPを25%回復して進む。<br>残り ${clock(Math.ceil(A.limit-S.run.elapsed))}</p><div class="alpha-buttons"><button class="primary" id="alpha-next">次の区画へ</button><button id="alpha-stay">探索を続ける</button></div>`);
    el('alpha-next').onclick=()=>{enterFloor(depths[A.stage+1]);closeModal();};el('alpha-stay').onclick=closeModal;
  };
  function help(paused){
    modal(`<h1 id="alpha-heading">${paused?'ひと休み':'探索の手引き'}</h1><p><b>移動</b>　WASD / 矢印キー<br>スマートフォンは画面をドラッグ。<br><b>ダッシュ</b>　画面を短くタップ / X。移動中は進行方向へ、停止中はタップ方向へ。<br><b>攻撃</b>　射程内の敵を自動攻撃。<br><b>拾う・進む</b>　近づいて E / 画面の案内をタップ。<br><b>盾</b>　Space 長押し / 盾ボタン。<br><b>回復</b>　Q / 回復ボタン（全員40%、2回）。<br><b>装備</b>　B / 鞄ボタン。<br><b>目標</b>　3区画の主を倒し、ポータルで帰還。メニュー中は時計が止まる。</p><div class="alpha-buttons"><button class="primary" id="alpha-resume">${paused?'探索に戻る':'タイトルへ'}</button></div>`);
    el('alpha-resume').onclick=paused?closeModal:()=>{el('alpha-overlay').classList.remove('on');setScreen('title');};
  }
  function potion(){if(!A.active||A.result||S.screen!=='game'||A.potions<=0||S.run.elapsed-A.healAt<8||!partyWounded())return;A.potions--;A.healAt=S.run.elapsed;heal(stats(S.hero).maxHp*.4);livingParty().forEach(a=>a.hpNow=Math.min(allyStats(a).maxHp,a.hpNow+allyStats(a).maxHp*.4));log('回復薬：全員のHPを40%回復');sync();}
  el('alpha-heal').onclick=potion;el('alpha-pause').onclick=()=>help(true);
  // Capture before the campaign's bindTap handlers, for both pointer and touch input.
  for(const event of ['click','touchend'])for(const id of ['t-start','t-help'])el(id).addEventListener(event,e=>{e.preventDefault();e.stopImmediatePropagation();id==='t-start'?start():help(false);},{capture:true,passive:false});
  addEventListener('keydown',e=>{if(e.repeat)return;if(e.key.toLowerCase()==='q')potion();if(e.key==='Escape'&&A.active&&!A.result&&S.screen==='game'){e.preventDefault();help(true);}});
  addEventListener('blur',()=>{if(A.active&&!A.result&&S.screen==='game')help(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&A.active&&!A.result&&S.screen==='game')help(true);});
  // Menu transitions must immediately hide the expedition controls.
  const screenFn=setScreen;setScreen=function(s){screenFn(s);sync();};
  title();
})();
