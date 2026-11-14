// 装備の特性（第1弾）。仕様：プロジェクト文書「abyss-装備の特性-案出しと仕様案」。
//  ・付く確率は装備のレア度ごと（白25%・緑40%・青60%・紫80%・赤100%）。装飾品には付かない
//  ・1つの装備に1つまで。レジェンドには付かない
//  ・特性の抽選は本編の乱数列を1つも進めない（CLAUDE.md 5.1）
//  ・書いてあるとおりに効く（一撃の倍率・数値の癖・倒したとき・耐久・状態異常の時間）
//  ・壊れた装備の特性は効かない／未鑑定の間は見えない
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

R.attach = await pg.evaluate(()=>{
  const want=[0.25,0.40,0.60,0.80,1.00], got=[], N=4000;
  const bases=BASES.filter(x=>x.slot!==SLOT.C);
  for(let r=0;r<5;r++){
    let n=0;
    for(let i=0;i<N;i++){ const it=buildItem(bases[i%bases.length], RARITY[r], 12); if(traitOf(it)) n++; }
    got.push(+(n/N).toFixed(3));
  }
  let charm=0;
  const cb=BASES.find(x=>x.slot===SLOT.C);
  if(cb) for(let i=0;i<2000;i++){ if(traitOf(buildItem(cb, RARITY[4], 12))) charm++; }
  return {got, near: got.every((g,i)=>Math.abs(g-want[i])<0.03), charmNone: charm===0};
});

R.shape = await pg.evaluate(()=>{
  let many=0, bad=0;
  for(let i=0;i<20000;i++){
    const it=genItem(5+(i%50),0,10), trs=it.aff.filter(a=>a.t==='tr');
    if(trs.length>1) many++;
    trs.forEach(t=>{ const d=traitDef(t.id); if(!d || d.sl!==it.slot || !(t.v>0) || ![0,1,2].includes(t.q)) bad++; });
  }
  const legendFree = LEGENDS.every(L=>!traitOf(makeLegend(L.id)));
  return {atMostOne: many===0, wellFormed: bad===0, legendFree};
});

R.rngUntouched = await pg.evaluate(()=>{
  RNG=mulberry32(4242); for(let i=0;i<80;i++) genItem(10,0,10); const x=RNG();
  const keep=TRAIT_ATTACH_P.slice(); TRAIT_ATTACH_P.fill(0);
  RNG=mulberry32(4242); for(let i=0;i<80;i++) genItem(10,0,10); const y=RNG();
  TRAIT_ATTACH_P.splice(0,5,...keep);
  return {same: x===y};
});

/* 戦いの用意：剣を1本持たせ、その剣に特性を1つ付ける */
const setup = `
  TH.run(3,{seed:31}); S.hero.party=[];
  const sw=buildItem(BASES.find(x=>x.id==='sword'), RARITY[0], 10); sw.aff=[];
  S.hero.equip.weapon=sw;
  var give=(slot,id,v,extra)=>{ const it=S.hero.equip[slot]; it.aff=it.aff.filter(a=>a.t!=='tr');
    if(id) it.aff.push(Object.assign({t:'tr',id,nm:traitDef(id).nm,v,q:1},extra||{})); };
  var foe=W.enemies.find(e=>!e.boss && !e.dead);
  foe.def=0; foe.st={};
  P.x=foe.x+foe.r+0.8; P.y=foe.y;
  var hit=(hpFrac)=>{ foe.maxHp=1e6; foe.hp=1e6*hpFrac; foe.dead=false; foe.st={};
    const st=Object.assign({}, stats(S.hero), {crit:0});
    RNG=mulberry32(9); const h=foe.hp; hitEnemy(foe, st, 1); return h-foe.hp; };
`;
const run = body => pg.evaluate(new Function(setup + body));

R.uitachi = await run(`
  give('weapon',null); const d0=hit(1);
  give('weapon','uitachi',30); const d1=hit(1), d2=hit(0.5);
  return {d0,d1,ratio:+(d1/d0).toFixed(3), ok: d1/d0>1.22 && d1/d0<1.32, notHalf: Math.abs(d2/d0-1)<0.03};
`);
R.todome = await run(`
  give('weapon',null); const d0=hit(0.2);
  give('weapon','todome',20); const d1=hit(0.2), d2=hit(0.9);
  return {ratio:+(d1/d0).toFixed(3), ok: d1/d0>1.14 && d1/d0<1.22, notHigh: Math.abs(d2/d0-1)<0.03};
`);
R.keitou = await run(`
  give('weapon',null); const d0=hit(0.5);
  give('weapon','keitou',25,{fam:foe.fam.id}); const d1=hit(0.5);
  give('weapon','keitou',25,{fam:'__none__'}); const d2=hit(0.5);
  return {ok: Math.abs(d1/d0-1.25)<0.03, otherFamNone: Math.abs(d2/d0-1)<0.03};
`);
R.ikabachi = await run(`
  give('weapon',null); const d0=hit(0.5);
  give('weapon','ikabachi',15); const d1=hit(0.5);
  return {nonCrit90: Math.abs(d1/d0-0.9)<0.03};
`);
R.quirkStats = await run(`
  give('weapon',null); const s0=stats(S.hero);
  give('weapon','omoi',20); const s1=stats(S.hero);
  give('weapon','karui',15); const s2=stats(S.hero);
  return {omoiAtkUp: s1.atk>s0.atk*1.15, omoiSlower: s1.aspd<s0.aspd,
          karuiFaster: s2.aspd>s0.aspd, karuiWeaker: s2.atk<s0.atk};
`);
R.armor = await run(`
  const ar=buildItem(BASES.find(x=>x.id==='leather'), RARITY[0], 10); ar.aff=[]; S.hero.equip.armor=ar;
  const s0=stats(S.hero);
  give('armor','juusou',30); const s1=stats(S.hero);
  give('armor','usude',10); const s2=stats(S.hero);
  give('armor','shizume',40);
  const pl={isPlayer:true, st:{}}; addStatus(pl,'burn',3);
  const t=pl.st.burn.t;
  give('armor',null); const pl2={isPlayer:true, st:{}}; addStatus(pl2,'burn',3);
  return {heavyDefUp: s1.def>s0.def*1.25, heavySlower: s1.ms<s0.ms,
          thinEvade: s2.evade>=s0.evade+10, thinDefDown: s2.def<s0.def,
          calmShorter: Math.abs(t/pl2.st.burn.t-0.6)<0.01};
`);
R.onKill = await run(`
  give('weapon','kate',5); S.hero.hpNow=10;
  foe.hp=0; killEnemy(foe);
  const healed=S.hero.hpNow;
  give('weapon','ikioi',20); const s0=stats(S.hero);
  const foe2=W.enemies.find(e=>!e.boss && !e.dead); foe2.hp=0; killEnemy(foe2);
  const s1=stats(S.hero);
  const t0=S.hero.trIkT; TH.clearEnemies(); TH.immortal(); TH.step(5); const s2=stats(S.hero);
  return {heal: healed===15, fasterAfterKill: s1.aspd>s0.aspd*1.15, wearsOff: Math.abs(s2.aspd-s0.aspd)<1e-6, t0, t1:S.hero.trIkT};
`);
R.wear = await run(`
  const it=S.hero.equip.weapon, lose=()=>{ it._wear=0; let n=0; for(let i=0;i<200;i++) n+=wearGear(it,1,1); return n; };
  give('weapon',null); const n0=lose();
  give('weapon','ganjo',50); const n1=lose();
  give('weapon','moroi',40); const n2=lose();
  return {n0,n1,n2, sturdy: n1<n0*0.6, brittle: n2>n0*1.8};
`);
R.broken = await run(`
  give('weapon','uitachi',30); const it=S.hero.equip.weapon; const d1=hit(1);
  it.dur=0; const d2=hit(1); it.dur=it.durMax;
  return {offWhenBroken: trV(S.hero,'uitachi')===0 || d2!==d1, zero: (it.dur=0, trV(S.hero,'uitachi'))===0};
`);
R.show = await run(`
  give('weapon','uitachi',30); const it=S.hero.equip.weapon;
  const shown=affLines(it).join('').includes('初太刀');
  it.ident=false; const hidden=!affLines(it).join('').includes('初太刀'); it.ident=true;
  const q0=itemRollQ(it); give('weapon',null); const q1=itemRollQ(it);
  return {shown, hidden, pricier: q0>q1};
`);
await done(b, errs, R);
