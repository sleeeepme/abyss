// 10階層ごとの層（ZONE）— 見た目・間取り・敵の偏り・バナー
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

/* ============ 1. 切り替わり ============ */

// 1-a. 10階層ごとに切り替わり、境目が 1/11/21/… にある
R.boundaries = await pg.evaluate(()=>{
  const map={};
  for(let d=1;d<=70;d++) map[d]=zoneAt(d).id;
  const changes=[];
  for(let d=2;d<=70;d++) if(map[d]!==map[d-1]) changes.push(d);
  return {changesAt:changes, zoneCount:ZONES.length,
          d1:map[1], d10:map[10], d11:map[11], d20:map[20], d21:map[21], d50:map[50],
          everyTen: changes.every(d=>d%10===1),
          firstBlockWhole: map[1]===map[10] && map[10]!==map[11]};
});

// 1-b. 一周したら最初へ戻り、cycle が上がる（同じ絵でも一段暗くなる）
R.cycle = await pg.evaluate(()=>{
  const span=ZONES.length*10;
  return {span,
          d1:zoneAt(1).id, dWrap:zoneAt(span+1).id,
          wrapsBack: zoneAt(span+1).id===zoneAt(1).id,
          cycle1:zoneCycle(1), cycleWrap:zoneCycle(span+1),
          cycleGrows: zoneCycle(span+1)>zoneCycle(1),
          dimmer: Math.pow(0.88, zoneCycle(span+1)) < 1};
});

// 1-c. 全層に必要なフィールドが揃っている
R.table = await pg.evaluate(()=>{
  const need=['id','nm','sub','floor','wall','edge','dot','accent','deco','decoEvery','lightR','air','gen','fam'];
  const bad=[];
  ZONES.forEach(z=>{
    need.forEach(k=>{ if(z[k]===undefined) bad.push(z.id+'.'+k); });
    if(!z.air || !z.air.n || !z.air.col) bad.push(z.id+'.air');
    if(!/^#[0-9a-f]{6}$/i.test(z.floor)) bad.push(z.id+'.floor形式');
  });
  const ids=ZONES.map(z=>z.id);
  const names=ZONES.map(z=>z.nm);
  return {count:ZONES.length, ids, names, missing:bad,
          allPresent:bad.length===0,
          uniqueIds:new Set(ids).size===ids.length,
          uniqueNames:new Set(names).size===names.length,
          decosDiffer:new Set(ZONES.map(z=>z.deco)).size===ZONES.length,
          coloursDiffer:new Set(ZONES.map(z=>z.floor)).size===ZONES.length};
});

/* ============ 2. 生成に反映されている ============ */

// 2-a. 階層データが層を持ち歩く
R.floorCarries = await pg.evaluate(()=>{
  const out={};
  [3,13,23,33,43,53,63].forEach(d=>{
    RNG=mulberry32(d*7919);
    const fl=genFloor(d);
    out[d]={zone:fl.zone.id, cycle:fl.cycle};
  });
  return {floors:out,
          allTagged:Object.values(out).every(o=>!!o.zone),
          matchesZoneAt:[3,13,23,33,43,53,63].every(d=>out[d].zone===zoneAt(d).id)};
});

// 2-b. 間取りが層で変わる（部屋の平均面積と通路の本数）
R.layout = await pg.evaluate(()=>{
  const measure=(depth)=>{
    let area=0, n=0;
    for(let s=0;s<24;s++){
      RNG=mulberry32(depth*1000+s);
      const fl=genFloor(depth);
      fl.rooms.forEach(r=>{ area+=r.w*r.h; n++; });
    }
    return +(area/n).toFixed(1);
  };
  // 同じ規模の階層どうしで比べる（W,H は depth 依存なので近い深さで比較する）
  const mine=measure(9), moss=measure(11);      // room 1.00 → 1.10
  const kiln=measure(29), abyss=measure(51);
  const bone=measure(41);
  return {mineAvg:mine, mossAvg:moss, kilnAvg:kiln, boneAvg:bone, abyssAvg:abyss,
          mossBiggerThanMine: moss>mine,
          boneSmallerThanAbyss: bone<abyss,
          loopsDiffer: ZONES[0].gen.loops!==ZONES[5].gen.loops};
});

// 2-c. 部屋が広くなっても連結性は壊れない（到達不能部屋ゼロ）
R.connectivity = await pg.evaluate(()=>{
  let unreachable=0, floors=0;
  for(const d of [5,15,25,35,45,55]){
    for(let s=0;s<12;s++){
      RNG=mulberry32(d*777+s);
      const fl=genFloor(d); floors++;
      // 開始部屋から床タイルを BFS
      const seen=Array.from({length:fl.H},()=>new Uint8Array(fl.W));
      const q=[[fl.start.cx, fl.start.cy]]; seen[fl.start.cy][fl.start.cx]=1;
      while(q.length){
        const [x,y]=q.pop();
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
          const nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=fl.W||ny>=fl.H) return;
          if(seen[ny][nx] || fl.g[ny][nx]===T.WALL) return;
          seen[ny][nx]=1; q.push([nx,ny]);
        });
      }
      fl.rooms.forEach(r=>{ if(!seen[r.cy][r.cx]) unreachable++; });
    }
  }
  return {floors, unreachable, ok:unreachable===0};
});

/* ============ 3. 敵の偏り ============ */

// 3-a. 層の相性で系統が偏る（炉の層はエンバーが出やすい）
R.famBias = await pg.evaluate(()=>{
  const sample=(depth, n)=>{
    const c={};
    for(let s=0;s<n;s++){
      RNG=mulberry32(depth*31337+s);
      floorFamilies(depth).forEach(f=>{ c[f.id]=(c[f.id]||0)+1; });
    }
    return c;
  };
  // 層の並びは 石(1-10) 水(11-20) 根(21-30) 跡(31-40) 鍛冶場(41-50) 白(51-60)
  const ruin=sample(35,300), furnace=sample(45,300), pale=sample(55,300);
  const pct=(c,id)=>{ const t=Object.values(c).reduce((a,b)=>a+b,0);
                      return +(((c[id]||0)/t)*100).toFixed(1); };
  return {
    zones:{d35:zoneAt(35).nm, d45:zoneAt(45).nm, d55:zoneAt(55).nm},
    ruin:{armor:pct(ruin,'armor'), flame:pct(ruin,'flame')},
    furnace:{flame:pct(furnace,'flame'), frost:pct(furnace,'frost')},
    pale:{frost:pct(pale,'frost'), beast:pct(pale,'beast')},
    ruinFavoursRuin: pct(ruin,'armor') > pct(ruin,'flame'),
    furnaceFavoursEmber: pct(furnace,'flame') > pct(furnace,'frost'),
    paleFavoursPale: pct(pale,'frost') > pct(pale,'beast')};
});

// 3-b. 偏りは「解禁」を前借りしない（序盤の約束を壊さない）
R.noEarlyUnlock = await pg.evaluate(()=>{
  const seen=new Set();
  for(let d=1;d<=3;d++) for(let s=0;s<80;s++){
    RNG=mulberry32(d*104729+s);
    floorFamilies(d).forEach(f=>seen.add(f.id));
  }
  const mid=new Set();
  for(let d=4;d<=6;d++) for(let s=0;s<80;s++){
    RNG=mulberry32(d*104729+s);
    floorFamilies(d).forEach(f=>mid.add(f.id));
  }
  return {shallow:[...seen], mid:[...mid],
          stillBeastOnly: seen.size===1 && seen.has('beast'),
          noElementalEarly: ![...seen,...mid].some(f=>['flame','frost','storm','arcane'].includes(f)),
          zone1HasNoBias: Object.keys(ZONES[0].fam).length===0};
});

/* ============ 4. 見せ方 ============ */

// 4-a. 層が変わった階でだけバナーが出る
/* 層が変わったことは**ログの1行**で伝える。
   以前は画面中央のバナーで層名と一文を出していたが、降りるたびに
   読ませる文章が挟まってテンポを削るのでやめた（バナー自体は
   装備の破損など「止めて伝えるべき事」のために残っている）。 */
R.banner = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(1);
  const zoneLine=()=>logs.filter(l=>/^── /.test(l)).length;
  logs.length=0;
  enterFloor(2);
  const sameZone=zoneLine();              // 同じ層なので増えない
  enterFloor(11);
  const newZone=zoneLine();               // 層が変わったので1行増える
  const line=logs.filter(l=>/^── /.test(l)).pop() || '';
  logs.length=0;
  enterFloor(12);
  const stillSame=zoneLine();
  _banner=null;
  enterFloor(21);
  const noBanner=_banner;
  return {sameZone, newZone, line, stillSame,
          quietWithinZone:  sameZone===0,
          announcesNewZone: newZone===1,
          namesTheZone:     line.includes(zoneAt(11).nm),
          quietAgainAfter:  stillSame===0,
          noBannerAnyMore:  noBanner===null,
          onlyOnZoneChange: sameZone===0 && newZone===1 && stillSame===0};
});

// 4-b. HUD と階段ダイアログに層の名前が出る
R.ui = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(1); enterFloor(23);
  updateHUD();
  const hud=document.getElementById('dsub').textContent;
  // 次で層が変わる階では予告が出る
  enterFloor(20); S.run.bossAlive=false;
  openStairs();
  const st20=document.getElementById('st-body').textContent;
  enterFloor(22);
  openStairs();
  const st22=document.getElementById('st-body').textContent;
  document.getElementById('m-stairs').classList.remove('on'); S.screen='game';
  return {hudText:hud.replace(/\s+/g,' '),
          hudHasZone: hud.includes(zoneAt(23).nm),
          previewText: (st20.match(/この先は\s*\S+/)||[''])[0],
          // 第20階層で降りると第21階層＝根の層に入る
          previewAtBoundary: st20.includes('この先は') && st20.includes(zoneAt(21).nm),
          noPreviewMidZone: !st22.includes('この先は')};
});

// 4-c. 漂う粒が層ごとに切り替わり、数が保たれる
R.air = await pg.evaluate(()=>{
  const out={};
  ZONES.forEach(z=>{ syncAir(z); out[z.id]={n:AIR.length, want:z.air.n, col:z.air.col}; });
  const counts=Object.values(out);
  return {zones:out,
          matchesTable: counts.every(c=>c.n===c.want),
          coloursDiffer: new Set(ZONES.map(z=>z.air.col)).size>=5,
          bounded: counts.every(c=>c.n<=40)};   // 端末に優しい上限
});

// 4-d. 全層を描いて例外が出ない（床装飾・粒・バナー込み）
R.drawAll = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(1);
  const fails=[];
  ZONES.forEach((z,i)=>{
    const depth=i*10+3;
    try{
      enterFloor(depth);
      W.seen.forEach(row=>row.fill(1));   // 全部見えている状態で描く
      for(let k=0;k<3;k++) draw();
    }catch(e){ fails.push(z.id+': '+e.message); }
  });
  // 一周した先も描く
  try{ enterFloor(ZONES.length*10+3); draw(); }catch(e){ fails.push('wrap: '+e.message); }
  return {zones:ZONES.length, failures:fails, ok:fails.length===0};
});

/* ============ 5. 実プレイ ============ */
R.live = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=30;
  S.hero.str=34; S.hero.dex=34; S.hero.vit=34;
  startRun(1); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('sword',30,2);
  S.hero.equip.armor=genBaseItem('plate',30,2);
  S.hero.hpNow=stats(S.hero).maxHp;
  const zonesSeen=new Set();
  // 層をまたいで潜り続ける
  for(const d of [1,11,21,31,41,51,61]){
    enterFloor(d);
    zonesSeen.add(W.fl.zone.id);
    await new Promise(r=>setTimeout(r,900));
    if(!S.run) break;
  }
  return {zonesSeen:[...zonesSeen], count:zonesSeen.size,
          loopAlive:_tickCount>200,
          sawAll: zonesSeen.size>=ZONES.length};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
