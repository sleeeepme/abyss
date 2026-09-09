// 拠点の整理（広場UI）。
//   ・能力値・装備・潜在・仲間・呪いはステータス画面（別画面）のまま
//   ・拠点は背景アニメ＋広場のパーティ＋アイコンボタン＋バッジの1枚レイアウト
//   ・「アビスへ潜る」は広場中央。中継地点が2つ以上あるときだけ階層選択モーダルを挟む
//   ・「データ全消去」はデバッグメニューへ移設、拠点からは削除
//   ・倉庫の装備タップで、着せる相手を選ぶ
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 拠点に残す物・追い出す物 ================= */

/* 1-a. 能力値・装備・潜在・仲間・呪いは拠点から出た。
       ここに全部を積んでいたときは、潜るまでに5回スクロールが要った。
       旧「ステータス」ボタンと文字メニューも廃止し、広場のアイコン群に置き換えた。 */
R.townIsThin = await pg.evaluate(()=>{
  setScreen('town');
  const t=el('scr-town');
  const gone=['#charcard','#equipped','#town-boons','#town-party','#town-curses']
    .filter(sel=>!!t.querySelector(sel));
  // R の真偽値は「true = 期待どおり」に揃える約束なので、
  // 「消えているべき物」はここへまとめ、hasBg 等の陽性チェックとは分ける。
  const oldUiGone=['.menu','#btn-go-char','#btn-reset'].filter(sel=>!!t.querySelector(sel));
  return {leftovers:gone,
          oldUiGone,
          hasBg: !!t.querySelector('#hub-bgwrap canvas#hubbg'),
          hasPlaza: !!t.querySelector('.hub-plaza'),
          hasDive: !!t.querySelector('#btn-dive'),
          ok: gone.length===0 && oldUiGone.length===0 && !!t.querySelector('#hub-bgwrap canvas#hubbg')
              && !!t.querySelector('.hub-plaza') && !!t.querySelector('#btn-dive')};
});

// 1-b. 遊び方の「？」は拠点から消えている（タイトルへ移した）
R.noHelpButton = await pg.evaluate(()=>{
  const inTown = !!el('scr-town').querySelector('#titlehelp');
  const onTitle = !!el('scr-title').querySelector('#t-help');
  return {removedFromTown: !inTown, onTitle, ok: !inTown && onTitle};
});

/* 1-c. 開始階層のウインドウ（#m-depthsel）は拠点の外側に独立している。
       中身の #startdepth はそちらが実体を持ち、拠点画面自体には無い。
       「データ全消去」はデバッグメニュー（#m-debug）側に移設されている。 */
R.startDepthInModal = await pg.evaluate(()=>{
  const t=el('scr-town'), m=el('m-depthsel');
  return {notInTown: !t.querySelector('#startdepth'),
          inModal: !!m.querySelector('#startdepth'),
          resetInDebug: !!el('m-debug').querySelector('#dbg-reset'),
          ok: !t.querySelector('#startdepth') && !!m.querySelector('#startdepth')
              && !!el('m-debug').querySelector('#dbg-reset')};
});

// 1-d. 追い出した物はステータス画面にちゃんとある（消したのではなく移した）
R.charHasAll = await pg.evaluate(()=>{
  setScreen('char');
  const c=el('scr-char');
  const want=['#charcard','#equipped','#town-boons','#town-party','#town-curses'];
  const missing=want.filter(sel=>!c.querySelector(sel));
  return {missing, rendered: el('charcard').innerHTML.length>50,
          ok: missing.length===0 && el('charcard').innerHTML.length>50};
});

/* ================= 2. 広場：パーティ・「潜る」・バッジ ================= */

/* 2-a. 中継地点が1つしか無ければ、「アビスへ潜る」は即座に潜る
       （選ぶ余地が無い1択の窓は、ただの手間）。 */
R.diveDirectWhenSingle = await pg.evaluate(()=>{
  S.beacons=[]; S.run=null;
  setScreen('town'); renderTown();
  el('btn-dive').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const stayedClosed = !el('m-depthsel').classList.contains('on');
  const dove = S.screen==='game';
  if(dove) setScreen('town');
  S.run=null;
  return {unlocked: unlockedDepths().length, stayedClosed, dove,
          ok: stayedClosed && dove};
});

/* 2-b. 中継地点が2つ以上あれば、階層選択のウインドウが開く。
       「この階層から潜る」を押すまでは潜らない。 */
R.diveOpensModalWhenMultiple = await pg.evaluate(()=>{
  S.beacons=[5,10]; S.run=null;
  setScreen('town'); renderTown();
  el('btn-dive').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const opened = el('m-depthsel').classList.contains('on');
  const stillTown = S.screen==='town';
  el('ds-go').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const closed = !el('m-depthsel').classList.contains('on');
  const dove = S.screen==='game';
  if(dove) setScreen('town');
  S.run=null; S.beacons=[];
  return {unlocked:2, opened, stillTown, closed, dove,
          ok: opened && stillTown && closed && dove};
});

// 2-c. 「閉じる」を押せば潜らずにモーダルだけ閉じる
R.diveModalCancelable = await pg.evaluate(()=>{
  S.beacons=[5,10]; S.run=null;
  setScreen('town'); renderTown();
  el('btn-dive').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  el('ds-close').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const closed = !el('m-depthsel').classList.contains('on');
  const stillTown = S.screen==='town';
  S.beacons=[];
  return {closed, stillTown, ok: closed && stillTown};
});

/* 2-d. 広場にはパーティ全員（主人公＋生存仲間）がタップ可能なアバターとして並ぶ。
       主人公はステータス画面、仲間は装備モーダルへ（どちらも既存の入口を使い回す）。 */
R.plazaAvatarsTappable = await pg.evaluate(()=>{
  S.hero.party=[];
  const a=TH.ally(10,'priest',10); a.slot=0;
  uniqueAllyName(a,party()); S.hero.party=[a];
  setScreen('town'); renderTown();
  const avas=[...document.querySelectorAll('#hub-avatars [data-hubava]')];
  const count=avas.length;
  const heroBtn=avas.find(x=>x.dataset.hubava==='hero');
  heroBtn.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const wentChar = S.screen==='char';
  setScreen('town'); renderTown();
  const allyBtn=[...document.querySelectorAll('#hub-avatars [data-hubava]')]
    .find(x=>x.dataset.hubava===String(a.uidA));
  allyBtn.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const openedEquip = el('m-allyeq').classList.contains('on') && S.screen==='allyeq';
  closeAllyEquip(); setScreen('town');
  return {count, wentChar, openedEquip,
          ok: count===2 && wentChar && openedEquip};
});

/* 2-e. 数の通知が要るボタンだけバッジが立ち、0件のものは隠れる。
       通知の要らない倉庫にはバッジ用の要素自体を置いていない。 */
R.badgesReflectCounts = await pg.evaluate(()=>{
  S.gachaLeft=3;
  S.fallen=[]; S.tavernPool=null;
  setScreen('town'); renderTown();
  const shown = id => el(id) && getComputedStyle(el(id)).display!=='none';
  const gachaOn = shown('badge-gacha');
  S.gachaLeft=0;
  renderTown();
  const gachaOff = !shown('badge-gacha');
  const noStashBadge = !el('badge-stash');
  return {gachaOn, gachaOff, noStashBadge, ok: gachaOn && gachaOff && noStashBadge};
});

/* ================= 3. 倉庫：誰に着せるか ================= */

// 3-a. 自分しかいなければ聞かない（1択の問いは、ただの手間）
R.aloneEquipsDirect = await pg.evaluate(()=>{
  S.hero.party=[];
  const it=genBaseItem('sword',10,1); it.ident=true;
  S.stash=[it]; S.hero.equip.weapon=null;
  setScreen('stash');
  const cands=wearCandidates(it).length;
  el('stash').querySelector('.item').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  return {cands, notAsked: !el('m-wear').classList.contains('on'),
          equipped: S.hero.equip.weapon===it,
          ok: cands===1 && !el('m-wear').classList.contains('on') && S.hero.equip.weapon===it};
});

// 3-b. 仲間がいて、その仲間が使える種類なら選択が出る
R.picksWearer = await pg.evaluate(()=>{
  S.hero.party=[];
  const a=TH.ally(10,'priest',10); a.slot=0;
  uniqueAllyName(a,party()); S.hero.party=[a];
  const wp=jobDef('priest').weapon;
  const it=genBaseItem(wp,16,1); it.ident=true;
  S.stash=[it];
  setScreen('stash');
  el('stash').querySelector('.item').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const rows=[...document.querySelectorAll('#wear-list [data-wear]')].map(n=>n.dataset.wear);
  return {rows, asked: el('m-wear').classList.contains('on'),
          hasHero: rows.includes('hero'), hasAlly: rows.includes(String(a.uidA)),
          ok: el('m-wear').classList.contains('on') && rows.length===2};
});

// 3-c. 仲間を選ぶと、その仲間が装備して倉庫から消える
R.givesToAlly = await pg.evaluate(()=>{
  const a=livingParty()[0];
  const it=S.stash[0];
  const before=S.stash.length;
  document.querySelector(`#wear-list [data-wear="${a.uidA}"]`)
    .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  return {equipped: a.equip[it.slot]===it,
          stashBefore:before, stashAfter:S.stash.length,
          closed: !el('m-wear').classList.contains('on'),
          ok: a.equip[it.slot]===it && !el('m-wear').classList.contains('on')};
});

/* 3-d. 使えない種類の仲間は選択肢に出ない。
       出したうえで無反応にすると、押しても何も起きないボタンになる。 */
R.hidesUnusable = await pg.evaluate(()=>{
  const a=livingParty()[0];
  // 僧侶が使えない武器（弓）を出す
  const wrong = BASES.find(x=>x.slot==='weapon' && x.id!==jobDef(a.job).weapon);
  const it=genBaseItem(wrong.id,16,1); it.ident=true;
  S.stash=[it];
  const cands=wearCandidates(it);
  return {weapon:wrong.nm, allyJob:jobDef(a.job).nm, count:cands.length,
          onlyHero: cands.length===1 && cands[0]===S.hero,
          ok: cands.length===1 && cands[0]===S.hero};
});

// 3-e. 防具はジョブを問わず渡せる（種類の縛りは武器と盾だけ）
R.armorIsFree = await pg.evaluate(()=>{
  const a=livingParty()[0];
  const it=genBaseItem('leather',16,1); it.ident=true;
  S.stash=[it];
  return {count:wearCandidates(it).length, can:allyCanEquip(a,it),
          ok: wearCandidates(it).length===2 && allyCanEquip(a,it)};
});

/* ================= 4. モーダルは必ず閉じられる =================
   実際に踏んだ: 鍛冶場のメニューが伸びて「閉じる」が画面外へ出て、
   **開いたら二度と閉じられない**状態になった（利用者からの報告）。
   個別に max-height を付けて回ると必ず付け忘れが出るので、
   .modal .box そのものに持たせてある。ここではそれを一覧で確かめる。 */
R.modalsScroll = await pg.evaluate(()=>{
  const boxes=[...document.querySelectorAll('.modal .box')];
  const bad=boxes.map(b=>{
    const cs=getComputedStyle(b);
    const capped = cs.maxHeight!=='none';
    const scrolls = cs.overflowY==='auto' || cs.overflowY==='scroll';
    return (capped && scrolls) ? null : (b.parentElement.id || '?');
  }).filter(Boolean);
  return {boxes:boxes.length, bad, ok: boxes.length>10 && bad.length===0};
});

/* 4-b. 中身を画面より高くしても、閉じるボタンが画面内に残る。
       鍛冶場は対象の選択・強化・修理と行が増えるので、一番伸びる。 */
R.forgeCloseReachable = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null;
  S.gold=999999; S.ore={raw:999, fine:999, deep:999};
  S.hero.equip.weapon=genBaseItem('sword',20,1);
  S.hero.party=[];
  for(let i=0;i<3;i++){
    const a=TH.ally(20,['warrior','mage','priest'][i],20); a.slot=i;
    a.equip.weapon=genBaseItem(jobDef(a.job).weapon,20,1);
    uniqueAllyName(a,party()); S.hero.party.push(a);
  }
  openForge(false);
  const box=document.querySelector('#m-forge .box');
  const btn=el('fg-close');
  // 一番下まで送る（中身が画面より高ければスクロールする）
  box.scrollTop = box.scrollHeight;
  const r=btn.getBoundingClientRect();
  const onScreen = r.top>=0 && r.bottom<=innerHeight+1 && r.width>0;
  // その座標を押したら、本当にそのボタンに当たるか
  const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  const hits = !!(top && btn.contains(top));
  // 値は畳む**前**に読む（畳んだあとは display:none で全部 0 になる）
  const contentH=box.scrollHeight, boxH=box.clientHeight;
  const scrollable = contentH > boxH+1;
  el('m-forge').classList.remove('on');
  return {contentH, boxH, scrollable, onScreen, hits,
          ok: onScreen && hits && scrollable};
});

await done(b, errs, R);
