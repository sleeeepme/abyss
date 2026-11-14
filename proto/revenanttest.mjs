// 還り損ない（前の代が立つ）第1段。仕様：プロジェクト文書「abyss-還り損ない-前の代が立つ-仕様案」。
//  ・死ぬと写し（S.revenant）ができる。落とす装備は、装備していた物（レジェンド以外）のどれか1つ
//  ・普通の階で死ぬとその階に立つ。ボス階で死ぬと1つ上の普通の階の下り口のそばに立つ
//  ・強さは普通の敵の HP×6・攻撃×1.5 に「出来」（0.8〜1.6）を掛けたもの
//  ・倒すと装備1つ（耐久は半分）と遺体の中身が戻り、写しは消える
//  ・遺体と同じく72時間で消える。もう一度死ぬと置き換わる
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* 死なせる用意：depth の階で、装備4枠を持たせて死ぬ */
const dieAt = `
  var dieAt=(depth, rar)=>{
    S.hero=newHero(); TH.run(depth,{seed:41}); S.hero.party=[];
    const mk=(id)=>{ const it=buildItem(BASES.find(x=>x.id===id), RARITY[rar||0], depth); it.ident=true; return it; };
    S.hero.equip={weapon:mk('sword'), shield:mk('buckler'), armor:mk('leather'), accessory:null};
    const gear=Object.values(S.hero.equip).filter(Boolean);
    S.hero.hpNow=0; die();
    return gear;
  };
`;
const run = body => pg.evaluate(new Function(dieAt + body));

R.record = await run(`
  const gear=dieAt(7,1);
  const r=S.revenant;
  return {made: !!r, depth: r && r.depth===7, name: r && r.name===heroBaseName(),
          dropFromGear: !!r && gear.includes(r.drop),
          qInRange: !!r && r.q>=0.8 && r.q<=1.6,
          graveFollows: !S.grave || S.grave.depth===r.depth};
`);
R.stands = await run(`
  dieAt(7,1);
  S.hero=newHero(); TH.run(7,{seed:42});
  const e=W.enemies.find(x=>x.revenant);
  const graveHidden = W.grave===null;
  const onOther=(()=>{ TH.floor(6); return !W.enemies.some(x=>x.revenant); })();
  return {standsHere: !!e, graveHidden, notOnOtherFloor: onOther};
`);
R.bossFloor = await run(`
  dieAt(10,1);
  const r=S.revenant;
  S.hero=newHero(); TH.run(9,{seed:43});
  const e=W.enemies.find(x=>x.revenant);
  const nearStair = !!e && Math.hypot(e.x-W.fl.stair.x, e.y-W.fl.stair.y) < 4;
  TH.floor(10);
  return {movedUp: !!r && r.depth===9 && r.onStair, standsOnPrev: !!e, nearStair,
          notOnBoss: !W.enemies.some(x=>x.revenant)};
`);
R.strength = await run(`
  dieAt(13,0);
  S.hero=newHero(); TH.run(13,{seed:44});
  const e=W.enemies.find(x=>x.revenant), q=S.revenant.q, lv=e.lv;
  const hp=Math.round((26+lv*11)*6*q), atk=(5+lv*2.6)*1.5*q;
  return {q, hpMatches: e.maxHp===hp, atkMatches: Math.abs(e.atkV-atk)<1e-6};
`);
R.quality = await pg.evaluate(()=>{
  S.hero=newHero(); TH.run(13,{seed:45});
  const weak=buildItem(BASES.find(x=>x.id==='dagger'), RARITY[0], 1); weak.atk=1; weak.aff=[];
  S.hero.equip.weapon=weak; const qLow=revQuality(S.hero,13);
  const strong=buildItem(BASES.find(x=>x.id==='great'), RARITY[4], 40); strong.atk*=5;
  S.hero.equip.weapon=strong; const qHigh=revQuality(S.hero,13);
  return {qLow, qHigh, floor: qLow===0.8, cap: qHigh===1.6};
});
R.defeat = await run(`
  dieAt(7,1);
  const drop=S.revenant.drop, durBefore=drop.dur;
  S.hero=newHero(); TH.run(7,{seed:46});
  const e=W.enemies.find(x=>x.revenant);
  const loot0=S.run.loot.length;
  e.hp=0; killEnemy(e);
  const d=W.drops.find(x=>x.it===drop);
  return {dropped: !!d, halfDur: !!d && drop.dur===Math.max(1,Math.round(durBefore*0.5)),
          cleared: S.revenant===null, graveTaken: S.grave===null,
          bagBack: S.run.loot.length>=loot0};
`);
R.replaceAndDecay = await run(`
  dieAt(7,1); const first=S.revenant;
  dieAt(12,1); const second=S.revenant;
  const replaced = first!==second && second.depth===12;
  second.t = Date.now() - 73*3600000; pruneGrave();
  return {replaced, goneAfter72h: S.revenant===null};
`);
R.final = await run(`
  dieAt(FINAL_DEPTH,1);
  return {noneAtMouth: S.revenant===null};
`);
R.draw = await run(`
  dieAt(7,1);
  S.hero=newHero(); TH.run(7,{seed:47});
  const e=W.enemies.find(x=>x.revenant);
  P.x=e.x+1.2; P.y=e.y;
  let ok=true; try{ for(let i=0;i<3;i++) draw(); }catch(err){ ok=String(err); }
  TH.step(0.3);
  // 左上の知らせ（#gravehint）は、前の代が立っている間は出さない（ユーザー指定）
  const noHint=getComputedStyle(document.getElementById('gravehint')).display==='none';
  return {drawsWithoutError: ok===true, noHint};
`);
await done(b, errs, R);
