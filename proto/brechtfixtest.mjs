/* 打ち直しのブレヒト（20F）の手直し（2026-11-26）：
   ・BGM：第一段階は中ボス戦の曲、合体したらボス戦の曲（vera2）
   ・当たり：絵の大きさ（e._vis）に合わせた円で被弾する。2体のボスどうしは重ならない
   ・ボスが白く光るのは弱点の属性で当たったときだけ */
import { boot, install } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const wait=ms=>pg.waitForTimeout(ms);
const R={};
Object.assign(R, await pg.evaluate(()=>{
  const R={};
  TH.run(20,{seed:7}); TH.floor(20);
  const [a,b2]=W.enemies.filter(e=>e.boss);
  // 当たり：絵の大きさから。鎧は足元より上に伸びる
  a._vis={w:2.86*TS, top:-2.06*TS, bot:0.84*TS};
  const hc=hitCircles(a);
  R.hitUsesVis = hc.length===1 && hc[0].y < a.y-0.4 && Math.abs(hc[0].r-1.3)<0.05;
  R.headHits = eSurf(a, a.x, a.y-1.9) <= 0.05;           // 頭（足元の1.9マス上）に当たる
  R.floorMisses = eSurf(a, a.x, a.y+1.2) > 0;            // 足元の下の何も無い所は当たらない
  // 合体：横に長い形は左右にも円
  a._vis={w:5.42*TS, top:-2.8*TS, bot:1.31*TS}; a.brecht.merged=true;
  const hm=hitCircles(a);
  R.mergeSideCircles = hm.length===3 && eSurf(a, a.x+2.3, a.y-0.5) <= 0.05;
  R.gridExtent = hitExtent(a) > 2.5;
  a.brecht.merged=false; a._vis=null;
  R.noVisFallback = hitCircles(a)[0].r===a.r && hitCircles(a)[0].y===a.y;
  // 2体は重ならない
  a._vis={w:2.86*TS, top:-2*TS, bot:.8*TS}; b2._vis={w:2.8*TS, top:-1.6*TS, bot:.8*TS};
  a.x=W.fl.W/2; a.y=W.fl.H/2; b2.x=a.x+0.3; b2.y=a.y; resolveEnemyOverlap();
  R.twinsSeparate = Math.hypot(b2.x-a.x, b2.y-a.y) >= (2.86+2.8)/2*TWIN_GAP_K - 0.05;
  // 白い光り：弱点だけ
  a.weakT=0; a.res=Object.assign({}, a.res, {fire:-50, slash:20});
  const r1=resolveDamage(a, [{type:'slash', amount:10}], 30, {});
  R.noFlashNotWeak = !r1.weak && !bossFlashOK(a);
  const r2=resolveDamage(a, [{type:'fire', amount:10}], 30, {});
  R.flashOnWeak = r2.weak && bossFlashOK(a);
  R.nonBossAlwaysFlash = bossFlashOK({boss:false});
  return R;
}));
await pg.evaluate(()=>{ TH.run(20,{seed:7}); TH.floor(20); setScreen('game'); });
await wait(600);
R.bgmZone = await pg.evaluate(()=>ABYSS_AUDIO.inspect().music.want);
await pg.evaluate(()=>{ const bs=W.enemies.filter(e=>e.boss); bs[0].revealed=true; });
await wait(600);
R.bgmFirst = await pg.evaluate(()=>ABYSS_AUDIO.inspect().music.want)==='midboss';
await pg.evaluate(()=>{ const bs=W.enemies.filter(e=>e.boss); bs.forEach(e=>brechtPurge(e)); });
await wait(600);
R.bgmPurgedStillFirst = await pg.evaluate(()=>ABYSS_AUDIO.inspect().music.want)==='midboss';
R.bgmMergeImmediate = await pg.evaluate(()=>{ const bs=W.enemies.filter(e=>e.boss&&!e.dead); bs[1].hp=0; killEnemy(bs[1]); return ABYSS_AUDIO.inspect().music.want; })==='vera2';
await pg.evaluate(()=>{ const s=W.enemies.find(e=>e.boss&&!e.dead); s.hp=0; killEnemy(s); });
await wait(600);
R.bgmBackToZone = await pg.evaluate(()=>ABYSS_AUDIO.inspect().music.want)==='sump';

console.log(JSON.stringify({errs, R}, null, 2));
await b.close();
