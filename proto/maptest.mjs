/* 間取りはキャラごと。同じキャラなら潜り直しても同じ地形で中身は変わる、新しいキャラなら別の地形、
   一度見た所は次の潜りで記憶（2）として戻る。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.layout = await pg.evaluate(()=>{
  const hashG = f => { let h=0; for(const r of f.g) for(const v of r) h=(h*31+v)|0; return h; };
  const hashH = z => { if(!z) return 0; let h=0; for(const r of z.g) for(const v of r) h=(h*31+v)|0; return h; };
  const look = d => { enterFloor(d); return {g:hashG(W.fl), haz:hashH(W.haz), st:W.fl.stair.x+','+W.fl.stair.y,
    st0:W.fl.start.cx+','+W.fl.start.cy,
    foes:W.enemies.map(e=>e.x.toFixed(1)+','+e.y.toFixed(1)).join('|'),
    chests:W.drops.filter(x=>x.chest).map(x=>x.x.toFixed(1)).join('|')}; };
  S.salt=4242; S.runs=10; S.hero=newHero(); S.hero.party=[];
  const out={};
  for(const d of [3,14]){       // 石の層と水の層（水場も地形の側）
    startRun(1); S.hero.party=[];
    const a=look(d); S.run=null;
    startRun(1); S.hero.party=[];
    const c=look(d); S.run=null;
    out[d]={sameGrid:a.g===c.g, sameHaz:a.haz===c.haz, sameStair:a.st===c.st, sameStart:a.st0===c.st0,
            foesDiffer:a.foes!==c.foes || a.chests!==c.chests, hasHaz: a.haz!==0};
  }
  const g1=out;
  return {out:g1, seed:S.hero.mapSeed, ok: [3,14].every(d=>g1[d].sameGrid&&g1[d].sameHaz&&g1[d].sameStair&&g1[d].sameStart&&g1[d].foesDiffer) && g1[14].hasHaz};
});
R.newHero = await pg.evaluate(()=>{
  const hashG = f => { let h=0; for(const r of f.g) for(const v of r) h=(h*31+v)|0; return h; };
  S.salt=4242; S.runs=30;
  S.hero=newHero(); S.hero.party=[]; startRun(1); S.hero.party=[]; enterFloor(5); const a=hashG(W.fl); S.run=null;
  S.hero=newHero(); S.hero.party=[]; startRun(1); S.hero.party=[]; enterFloor(5); const c=hashG(W.fl); S.run=null;
  return {a, c, ok: a!==c};
});
R.memory = await pg.evaluate(()=>{
  S.salt=777; S.runs=50; S.hero=newHero(); S.hero.party=[];
  startRun(1); S.hero.party=[]; enterFloor(6);
  // 部屋を2つ見て回ったことにする
  const rs=W.fl.rooms.slice(0,3);
  rs.forEach(r=>{ P.x=r.cx+0.5; P.y=r.cy+0.5; markSeen(); });
  let seen1=0; W.seen.forEach(r=>r.forEach(v=>{ if(v) seen1++; }));
  enterFloor(7);                           // 降りる＝6 の記憶を控える
  const packed = S.hero.mapMem && S.hero.mapMem[6];
  // 保存を経ても残るか（JSON 往復）
  S.hero = JSON.parse(JSON.stringify(S.hero));
  S.run=null;
  startRun(1); S.hero.party=[]; enterFloor(6);
  let two=0, one=0; W.seen.forEach(r=>r.forEach(v=>{ if(v===2) two++; else if(v===1) one++; }));
  // 記憶の上の敵は出さない
  const r=rs[2]; const onMem = W.seen[r.cy][r.cx]===2 ? !tileSeen(r.cx+0.5, r.cy+0.5) : true;
  // 見に行けば今回の分（1）に変わる
  P.x=r.cx+0.5; P.y=r.cy+0.5; W.seenKey=null; markSeen();
  const nowSeen = tileSeen(r.cx+0.5, r.cy+0.5);
  setScreen('game'); S.mapOn=true; let drew=true; try{ draw(); }catch(e){ drew=String(e); }
  S.mapOn=false;
  // 新しいキャラには記憶が無い
  S.run=null; S.hero=newHero(); S.hero.party=[]; startRun(1); S.hero.party=[]; enterFloor(6);
  let fresh=0; W.seen.forEach(r=>r.forEach(v=>{ if(v===2) fresh++; }));
  return {seen1, packedLen: packed&&packed.length, two, one, onMem, nowSeen, drew, fresh,
          ok: !!packed && two>=seen1*0.95 && onMem && nowSeen && drew===true && fresh===0};
});
R.returnSaves = await pg.evaluate(()=>{
  S.salt=99; S.runs=70; S.hero=newHero(); S.hero.party=[];
  startRun(1); S.hero.party=[]; enterFloor(5);   // 5 は帰還ポータルの階
  P.x=W.fl.start.cx+0.5; P.y=W.fl.start.cy+0.5; markSeen();
  returnToTown();
  const has = !!(S.hero.mapMem && S.hero.mapMem[5]);
  return {has, ok: has};
});
await done(b, errs, R);
