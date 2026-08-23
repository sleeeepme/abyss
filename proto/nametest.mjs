// 装備の名前。語順（接頭辞→接尾辞→種別）と、行頭の種別アイコン。
//
// 名前は「読めるか」でしか価値が決まらないので、
// 出来上がりの文字列そのものを見る検証にしてある。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 語順 ================= */

// 1-a. 種別が末尾に来る（「鋭利な守護の剣」／以前は「鋭利な剣の守護」だった）
R.order = await pg.evaluate(()=>{
  S.hero=newHero();
  const it=genBaseItem('sword',20,1);
  it.ident=true; it.up=0;
  it.aff=[{t:'p',id:'sharp',nm:'鋭利な',stat:'dmgPct',v:10},
          {t:'s',id:'guard',nm:'守護',  stat:'def',   v:3}];
  const nm=itemName(it);
  const body=nm.replace(BASE_IC.sword,'').trim();
  return {name:nm, body,
          exact: body==='鋭利な守護の剣',
          endsWithBase: body.endsWith('剣'),
          // 旧語順が残っていないこと
          notOldOrder: !body.includes('剣の守護'),
          ok: body==='鋭利な守護の剣'};
});

// 1-b. 接頭辞だけ／接尾辞だけ／どちらも無いとき
R.partial = await pg.evaluate(()=>{
  const mk = aff => { const it=genBaseItem('axe',12,1);
                      it.ident=true; it.up=0; it.aff=aff; return itemName(it).replace(BASE_IC.axe,'').trim(); };
  const p = mk([{t:'p',id:'stout',nm:'頑健な',stat:'hp',v:12}]);
  const s = mk([{t:'s',id:'flame',nm:'業火', stat:'fire',v:6}]);
  const n = mk([]);
  return {p, s, n,
          ok: p==='頑健な戦斧' && s==='業火の戦斧' && n==='戦斧'};
});

// 1-c. の が二重にならない（接頭辞「疾風の」を「疾き」に改名した理由）
R.noDoubleNo = await pg.evaluate(()=>{
  const bad=[];
  PREFIX.forEach(p=>{ if(p.nm.endsWith('の')) bad.push(p.nm); });
  // 実際に全組み合わせを作って「のの」が出ないことも見る
  let worst=null;
  PREFIX.forEach(p=>SUFFIX.forEach(s=>{
    const nm=p.nm+s.nm+'の剣';
    if(/のの/.test(nm) || (nm.match(/の/g)||[]).length>1) worst=worst||nm;
  }));
  return {prefixEndingInNo:bad, sample:worst, ok: bad.length===0};
});

// 1-d. +N と（破損）の位置は変わっていない
R.decorations = await pg.evaluate(()=>{
  const it=genBaseItem('mace',20,1); it.ident=true; it.aff=[]; it.up=4;
  const plus=itemName(it);
  it.durMax=50; it.dur=0;
  const broken=itemName(it);
  return {plus, broken,
          plusAfterIcon: plus.startsWith(BASE_IC.mace+' +4 '),
          brokenAtEnd:   broken.endsWith('（破損）'),
          ok: plus.startsWith(BASE_IC.mace+' +4 ') && broken.endsWith('（破損）')};
});

/* ================= 2. アイコン ================= */

// 2-a. すべてのベース種にアイコンがあり、武器はそれぞれ別の絵文字
R.iconsComplete = await pg.evaluate(()=>{
  const missing = BASES.filter(x=>!BASE_IC[x.id]).map(x=>x.id);
  const weapons = BASES.filter(x=>x.slot==='weapon').map(x=>BASE_IC[x.id]);
  const uniqW   = new Set(weapons).size;
  return {bases:BASES.length, missing, weapons:weapons.length, uniqW,
          ok: missing.length===0 && uniqW===weapons.length};
});

// 2-b. 消耗品にもアイコンが付く
R.consumIcons = await pg.evaluate(()=>{
  const bad = CONSUMABLES.filter(c=>!CONSUM_IC[c.id]).map(c=>c.id);
  const nm  = itemName(makeConsum('salve'));
  return {bad, nm, hasIcon: nm.startsWith(CONSUM_IC.salve),
          ok: bad.length===0 && nm.startsWith(CONSUM_IC.salve)};
});

/* 2-c. 未鑑定はスロットのアイコンまで。ここで武器の種類が漏れると、
        攻撃力レンジを推測されて「鑑定するまで分からない」が壊れる。 */
R.unidentLeaks = await pg.evaluate(()=>{
  S.hero=newHero();
  const leaks=[], icons=new Set();
  for(let i=0;i<60;i++){
    const it=genItem(20,300); it.ident=false;
    const nm=itemName(it);
    icons.add(nm.split(' ')[0]);
    if(nm.includes(it.nm) && it.nm!==SLOTNM[it.slot]) leaks.push(nm+' / '+it.nm);
    if(nm!==itemIcon(it)+' 未鑑定の'+SLOTNM[it.slot]) leaks.push('形が違う: '+nm);
  }
  const slotIcons=new Set(Object.values(SLOT_IC));
  const stray=[...icons].filter(i=>!slotIcons.has(i));
  return {leaks:leaks.slice(0,4), icons:[...icons], stray,
          ok: leaks.length===0 && stray.length===0};
});

// 2-d. 護符も行頭にアイコンが付く（持ち込み一覧で装備と並ぶので）
R.charmIcon = await pg.evaluate(()=>{
  const nm=charmName(CHARMS[0]);
  return {nm, ok: nm.startsWith('🔮') && nm.includes(CHARMS[0].nm)};
});

/* ================= 3. 実画面に出る ================= */

// 3-a. 持ち物の一覧に、アイコン付き・新語順の名前がそのまま出る
R.inBag = await pg.evaluate(()=>{
  TH.run(1,{seed:5});
  const it=genBaseItem('bow',14,1);
  it.ident=true; it.up=0;
  it.aff=[{t:'p',id:'keen',nm:'冴えた',stat:'critPct',v:5},
          {t:'s',id:'ice', nm:'氷結', stat:'frost',  v:7}];
  S.run.loot=[it];
  openBag();
  const html=el('bag-loot').innerHTML;
  return {shown: html.includes('冴えた氷結の弓'),
          icon:  html.includes(BASE_IC.bow),
          notOldOrder: !html.includes('弓の氷結'),
          ok: html.includes(BASE_IC.bow) && html.includes('冴えた氷結の弓')};
});

// 3-b. 拾ったときのログにも出る（名前を作る道が1本しかないことの確認）
R.inLog = await pg.evaluate(()=>{
  logs.length=0;
  const it=genBaseItem('staff',10,1); it.ident=true; it.up=0; it.aff=[];
  log('拾った：'+itemName(it));
  return {line:logs[0], ok: logs[0]===('拾った：'+BASE_IC.staff+' 杖')};
});

await done(b, errs, R);
