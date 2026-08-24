// 拠点の整理。
//   ・遊び方ボタンを畳み、ステータスを別画面へ
//   ・「開始階層」を冒頭へ
//   ・「ダンジョンへ潜る」をバナーの上に画面固定
//   ・倉庫の装備タップで、着せる相手を選ぶ
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 拠点に残す物・追い出す物 ================= */

/* 1-a. 能力値・装備・潜在・仲間・呪いは拠点から出た。
       ここに全部を積んでいたときは、潜るまでに5回スクロールが要った。 */
R.townIsThin = await pg.evaluate(()=>{
  setScreen('town');
  const t=el('scr-town');
  const gone=['#charcard','#equipped','#town-boons','#town-party','#town-curses']
    .filter(sel=>!!t.querySelector(sel));
  return {leftovers:gone,
          hasStartDepth: !!t.querySelector('#startdepth'),
          hasMenu: !!t.querySelector('.menu'),
          hasStatusBtn: !!t.querySelector('#btn-go-char'),
          ok: gone.length===0 && !!t.querySelector('#startdepth') && !!t.querySelector('#btn-go-char')};
});

// 1-b. 遊び方の「？」は拠点から消えている（タイトルへ移した）
R.noHelpButton = await pg.evaluate(()=>{
  const inTown = !!el('scr-town').querySelector('#titlehelp');
  const onTitle = !!el('scr-title').querySelector('#t-help');
  return {removedFromTown: !inTown, onTitle, ok: !inTown && onTitle};
});

// 1-c. 開始階層が拠点の冒頭に来る（メニューより前）
R.startDepthFirst = await pg.evaluate(()=>{
  const t=el('scr-town');
  const kids=[...t.children];
  const sd=kids.findIndex(x=>x.id==='startdepth' || x.querySelector&&x.querySelector('#startdepth'));
  const menu=kids.findIndex(x=>x.classList.contains('menu'));
  return {startIdx:sd, menuIdx:menu, ok: sd>=0 && menu>=0 && sd<menu};
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

/* ================= 2. 「潜る」の固定バー ================= */

// 2-a. 拠点でだけ出て、バナーの上に乗る
R.diveBar = await pg.evaluate(()=>{
  setScreen('town');
  const d=el('divebar'), a=el('adbar');
  const onTown=d.classList.contains('on');
  const db=d.getBoundingClientRect(), ab=a.getBoundingClientRect();
  return {onTown, above: db.bottom <= ab.top+1,
          fixed: getComputedStyle(d).position==='fixed',
          hasButton: !!d.querySelector('#btn-dive'),
          ok: onTown && db.bottom<=ab.top+1 && getComputedStyle(d).position==='fixed'};
});

// 2-b. 他の画面では出さない
R.diveHidden = await pg.evaluate(()=>{
  const off=[];
  ['char','shop','stash','upg','title'].forEach(k=>{
    setScreen(k);
    if(el('divebar').classList.contains('on')) off.push(k);
  });
  setScreen('town');
  return {shownOn:off, ok: off.length===0};
});

/* 2-c. 固定バーの下に本文が潜り込まない。
       重なると「見えているのに押せないボタン」ができる（実際に一度作っている）。 */
R.noOverlap = await pg.evaluate(()=>{
  setScreen('town');
  const t=el('scr-town');
  t.scrollTop = t.scrollHeight;                 // 一番下まで送る
  const last=el('btn-reset').getBoundingClientRect();
  const bar=el('divebar').getBoundingClientRect();
  return {resetBottom:Math.round(last.bottom), barTop:Math.round(bar.top),
          clear: last.bottom <= bar.top+1,
          ok: last.bottom <= bar.top+1};
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
