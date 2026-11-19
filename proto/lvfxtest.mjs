// レベルアップの見せ方（2026-11-19 ユーザー指定・見本の動画の2と5）
//  ・画面中央の「Lv.N」の帯は出さない
//  ・頭の上に「LEVEL UP!」（1字ずつ）。一度に何レベル上がっても1つ
//  ・横に上がった数値（攻撃・HP・防御のうち上がった物）。まとめて1回
//  ・描いても落ちない。時間が来たら消える
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};
R.one = await pg.evaluate(()=>{
  S.hero=newHero(); TH.run(4,{seed:21}); S.hero.party=[]; setScreen('game');
  W.fx=[]; _banner=null;
  const lv0=S.hero.lv;
  addXp(S.hero, xpNeed(S.hero.lv)+xpNeed(S.hero.lv+1)+xpNeed(S.hero.lv+2), true);   // 3つ上がる
  const texts=W.fx.filter(f=>f.t==='lvtext').length, gains=W.fx.filter(f=>f.t==='lvgain');
  const sparks=W.fx.filter(f=>f.t==='lvspark');
  let threw=null; try{ for(let i=0;i<5;i++) draw(); }catch(e){ threw=e.message; }
  TH.step(0.2);
  const banner=!!(_banner && /^Lv\./.test(_banner.title||''));
  return {lvUp: S.hero.lv===lv0+3, oneText: texts===1, oneGain: gains.length===1,
          rows: gains[0] ? gains[0].rows.map(r=>r.txt) : [], hasRows: !!gains[0] && gains[0].rows.length>=1,
          noCenterBanner: !banner, drawsFine: threw===null,
          // 火花（見本の6）：1回だけ、28粒
          oneSpark: sparks.length===1 && sparks[0].ps.length===LVSPARK.n,
          noRing: !W.fx.some(f=>f.t==='levelup')};
});
R.gone = await pg.evaluate(()=>{
  TH.immortal(); TH.clearEnemies(); TH.step(3);
  return {cleared: !W.fx.some(f=>(f.t==='lvtext'||f.t==='lvgain'||f.t==='lvspark') && f.life>0)};
});
await done(b, errs, R);
