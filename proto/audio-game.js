/* Load last, after feel/dash/save wrappers. All original return values are preserved. */
(() => {
  'use strict';
  const A=window.ABYSS_AUDIO;if(!A)return;
  const where=(e,ally=false)=>({ally,distance:e&&Number.isFinite(e.x)&&Number.isFinite(e.y)?Math.hypot(e.x-P.x,e.y-P.y):0});
  const emit=(id,o)=>{try{A.emit(id,o);}catch{}};
  const wrap=(name,after,before)=>{const f=window[name];if(typeof f!=='function')return;window[name]=function(...args){let old;try{old=before?.(...args);}catch{}const result=f.apply(this,args);try{after(args,result,old);}catch{}return result;};};
  /* 意味のある音は、ボタンの処理が終わってから（画面の切替の A.stop に消されないように）鳴らす */
  let semAt=-Infinity,levelAt=-Infinity,sceneAt=-Infinity;
  const later=(id,o)=>{semAt=performance.now();setTimeout(()=>emit(id,o),0);};
  const landSeen=new WeakSet(),fellSeen=new WeakSet();
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
  wrap('onLevelUp',([h,self])=>{if(self)emit('level');},([h,self])=>{if(self)levelAt=performance.now();});   // 先に印を付ける（中で出る Lv の帯の通知音を鳴らさない）
  /* ---------- 場面の音（2026-10-25 「低い響き」）----------
     穴に落ちる：次の階へ入るとき（ポータルから現れるときは今までの階層移動の音）と、根の層の踏み外し。
     穴から落ちてくる：一行の落下（W.dropIn）が始まった瞬間に、人数ぶんの着地が入った音を1つ鳴らす
     （音の中の着地の時刻＝主人公 0.48秒、仲間 0.13秒ずつ遅れ。ゲームの DROPIN と同じ）。
     咆哮：ヴェラの第二形態の咆哮（bossFormRoar）と、決闘のボスが段階で吠えるとき（duelPhase）。 */
  wrap('enterFloor',([d,opt])=>{later((opt&&opt.atPortal&&W.portal)?'floor':'fall');sceneAt=performance.now();});
  wrap('tickPits',()=>{if(P.fallAnim&&!fellSeen.has(P.fallAnim)){fellSeen.add(P.fallAnim);emit('fall');}});
  wrap('tickDropIn',(_,r,d)=>{if(d&&d.kind!=='portal'&&d.t>=0&&!landSeen.has(d)){landSeen.add(d);emit('land',{variant:d.list.length});sceneAt=performance.now();}},()=>W.dropIn);
  wrap('bossFormRoar',()=>emit('roar'));
  wrap('duelPhase',([e],r,old)=>{if(e&&e.roar>0&&!(old>0))emit('roar');},e=>e&&e.roar);
  /* ---------- UIの意味のある音 ----------
     押したボタンの汎用音（選択）より、何が起きたかの音を優先する：買えた／払えた、できなかった、装備した、知らせが出た。
     どちらも同じ1回の操作で起きるので、意味のある音を鳴らしたら、その操作の汎用音は鳴らさない（semAt）。 */
  wrap('buyFromMerchant',(_,r)=>later(r&&r.ok?'buy':'deny'));
  wrap('doUpgrade',(_,r)=>later(r?'buy':'deny'));
  wrap('wearOnHero',()=>later('equip'));
  wrap('wearOnAlly',(_,ok)=>later(ok===false?'deny':'equip'));
  wrap('bannerNow',([t,sub,col])=>{const now=performance.now();
    if(typeof NOTIF_URGENT_COL!=='undefined'&&col===NOTIF_URGENT_COL)return;
    if(now-levelAt<2500||now-sceneAt<1500)return;            // レベルアップ・階に入った音と重ねない
    emit('notify');});
  wrap('setScreen',()=>A.stop());
  wrap('openAd',()=>A.stop());
  /* BGM（2026-10-22）。拠点（潜っていない間）は拠点の曲、潜っている間は層の曲（今は石の層だけ）、中ボス戦はその曲、ヴェラの第二形態はその曲。タイトル・広告中は止める。
     画面の切り替わり方が多い（死亡・帰還・各メニュー）ので、決まった間隔で「今どこか」を見て合わせる。 */
  /* 中ボス戦（5・15・25…階、bossTier==='mid'）。階に入っただけでは替えない——ボスは一撃入れるまで正体を伏せているので、
     「戦いが始まった」と分かる時に替える：正体が割れた（revealed）か、BOSS_NEAR マス以内まで近づいたとき。
     一度始まったらその個体が倒れるまで続ける（離れても戻さない）。倒したら層の曲へ戻る。
     覚えておくのは音の側の WeakSet（敵の中身には書かない＝保存や判定に混ざらない）。 */
  const BOSS_NEAR=6, fought=new WeakSet();
  const midBossFight=()=>{
    if(S.run.bossTier!=='mid'||!W||!W.enemies)return false;
    const b=W.enemies.find(e=>e.boss&&!e.dead);if(!b)return false;
    if(!fought.has(b)&&(b.revealed||Math.hypot(b.x-P.x,b.y-P.y)<=BOSS_NEAR))fought.add(b);
    return fought.has(b);
  };
  /* 大ボスの第二形態の曲（2026-10-23）。第二形態は部位（e.parts）を持つ——第一形態には無い。
     その階に入った時点で曲を取ってきて解いておく（変わった瞬間に鳴らしたい）。倒したら層の曲へ戻る。 */
  const FORM2_BGM={10:'vera2'};
  const form2Fight=()=>{
    if(!W||!W.enemies)return null;
    const b=W.enemies.find(e=>e.boss&&!e.dead&&FORM2_BGM[e.uniqueBoss]);if(!b)return null;
    const id=FORM2_BGM[b.uniqueBoss];
    if(b.parts&&!b.form2)return id;
    try{A.musicPrefetch&&A.musicPrefetch(id);}catch{}
    return null;
  };
  const bgmWant=()=>{try{
    if(typeof _adSession!=='undefined'&&_adSession)return null;
    if(!S.hero||S.screen==='title')return null;
    if(!S.run)return 'hub';
    const f2=form2Fight();if(f2)return f2;
    if(midBossFight())return 'midboss';
    // 潜っている間は層の曲（曲のある層だけ。層は一周するので階の数ではなく層で見る）
    const z=typeof zoneAt==='function'?zoneAt(S.run.depth):null;
    return z&&z.id==='stone'?'stone':null;
  }catch{return null;}};
  if(A.music){A.music(bgmWant());setInterval(()=>A.music(bgmWant()),400);
    wrap('bossChangeForm',()=>A.music(bgmWant()));}   // 第二形態の曲は変わった瞬間に（400ms 待たない）
  // Capture touchend because existing bindTap handlers stop bubbling and prevent click.
  /* ボタンの役割で音を分ける（2026-10-25）。id と文字から決める。data-sfx があればそれを使う。
       開く（バッグ・ステータス・地図・街の各施設）／閉じる（-close・閉じる・×）／戻る（cancel・no・戻る・キャンセル）
       決定（-ok・-yes・-do・-go・-join・-down・はじめる）／タブ（role=tab）／オン・オフ（チェック・スイッチ）／それ以外は選択 */
  const UI_OPEN=/^(bagbtn|statbtn|mapbtn|dbgbtn|btn-go-|btn-gacha$)/;
  function uiSound(node){
    const id=node.id||'',txt=(node.textContent||'').trim();
    if(node.dataset.sfx)return [node.dataset.sfx];
    if(node.getAttribute('role')==='tab')return ['tab'];
    if(node.matches('input[type=checkbox],[role=switch]'))return ['toggle',{variant:(node.checked||node.getAttribute('aria-checked')==='true')?'on':'off'}];
    if(/-close$|^close|^(bag|stat|help|keep|clr|gres|r)-ok$/.test(id)||/^(閉じる|×|✕)$/.test(txt))return ['close'];   // パネルを閉じる「OK」も閉じる音
    if(/cancel|-no$|-back$|-pass$/.test(id)||/^(キャンセル|戻る|やめる)/.test(txt))return ['back'];
    if(UI_OPEN.test(id))return ['open'];
    if(/-ok$|-yes$|-do$|-go$|-join$|-down$|^t-start$/.test(id))return ['confirm'];
    return ['ui'];
  }
  let lastTouch=-Infinity;
  function ui(e){
    if(e.type==='touchend')lastTouch=performance.now();else if(performance.now()-lastTouch<700)return;
    const node=e.target?.closest?.('button,[role="button"],.btn,.row[data-uid],[role="tab"],[role="switch"],input[type=checkbox],#bagbtn,#statbtn,#mapbtn');
    if(!node||node.disabled||node.dataset.audioIgnore!==undefined)return;
    if(node.closest('#hud,#stick,#cv')&&!/bag|stat|menu|map/.test(node.id))return;
    const [id,o]=uiSound(node),at=performance.now();
    /* ボタンの処理（画面の切替で効果音を止める A.stop を含む）が全部終わってから鳴らす。
       queueMicrotask だと、捕まえた側（この関数）の直後＝ボタンの処理より前に走り、画面の切替で消されていた。
       その操作で意味のある音（買えた・できない・装備…）が鳴ったなら、汎用の音は出さない。 */
    setTimeout(()=>{if(semAt>=at)return;emit(id,o);},0);
  }
  document.addEventListener('touchend',ui,{capture:true,passive:true});document.addEventListener('click',ui,true);
})();
