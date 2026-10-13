// スキル技（ショック＋2026-10-13 追加の10種）とスキルツリー画面の回帰テスト
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};

await pg.evaluate(()=>{
  window.SKT_SETUP = (upg)=>{
    S.bossClear = 20; S.upg = upg; S.skill = null; S.hero = newHero();
    TH.run(3, {seed:7}); setScreen('game'); TH.immortal();
    const room = W.fl.rooms.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];
    P.x = room.x + 2.5; P.y = room.y + room.h/2; P.dirx = 1; P.diry = 0;
    W.enemies = []; W.arts = []; P.waveCd = 0;
    return room;
  };
  window.SKT_MK = (dx, dy, o)=>{
    const e = Object.assign({x:P.x+dx, y:P.y+dy, arch:ARCH[0], fam:FAMILY[0], lv:5, aff:[],
             maxHp:99999, hp:99999, atkV:0, def:0, res:{}, dt:'blunt',
             st:{}, bu:{}, state:'idle', t:0, cd:9, vx:0, vy:0, hit:0, tele:0,
             ms:0, teleMul:1, dead:false, r:0.34, col:'#fff', name:'的'}, o||{});
    W.enemies.push(e); gridBuild(); return e;
  };
  window.SKT_LOST = e => 99999 - e.hp;
});

/* --- 1. 名前と並び。衝撃波はショックに、技は11個、全部にアイコンがある --- */
R.catalog = await pg.evaluate(()=>{
  const ids = SKILL_TECHS.map(t=>t.id);
  const wave = UPGRADES.find(u=>u.id==='wave');
  const noIcon = [...ids, ...Object.keys(UPG_TREE).filter(id=>!isSkillTech(id)).map(id=>'n_'+id)]
    .filter(id=>!SKILL_ICON_GRID[id]);
  const inTree = UPGRADES.filter(u=>!UPG_TREE[u.id]).map(u=>u.id);
  const btnLabel = document.getElementById('wavebtn').getAttribute('aria-label');
  return {count: ids.length, waveName: wave.nm, noIcon, notInTree: inTree, btnLabel,
    elevenTechs: ids.length === 11,
    renamed: wave.nm === 'ショック' && skillDef('wave').nm === 'ショック',
    allIcons: noIcon.length === 0,
    allPlaced: inTree.length === 0,
    techsLevelTo5: SKILL_TECHS.every(t=>UPGRADES.find(u=>u.id===t.id).max === 5),
    ok: ids.length===11 && wave.nm==='ショック' && noIcon.length===0 && inTree.length===0};
});

/* --- 2. ショックの Lv.1 は旧 衝撃波と同じ数字（バランスの測定を崩さない） --- */
R.waveSame = await pg.evaluate(()=>{
  const t = skillDef('wave'), v = t.v(1);
  const same = v.mul===WAVE_MUL && v.reach===WAVE_REACH && t.cd(1)===WAVE_CD;
  const grows = t.v(5).mul > v.mul && t.cd(5) < t.cd(1);
  SKT_SETUP({wave:1});
  const front = SKT_MK(1.6, 0), back = SKT_MK(-1.6, 0);
  const fired = fireWave();
  const says = W.pops.some(p=>p.txt==='ショック！');
  return {same, grows, fired, says, hitFront: SKT_LOST(front)>0, spareBack: SKT_LOST(back)===0,
          ok: same && grows && fired && SKT_LOST(front)>0 && SKT_LOST(back)===0};
});

/* --- 3. 技ごとに、その技らしい当たり方をしているか --- */
R.chain = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, chain:1});
  S.skill = 'chain';
  const noTarget = fireWave() === false && (P.waveCd||0) === 0;   // 相手がいなければ出さない・待ち時間も減らさない
  const es = [SKT_MK(2,0), SKT_MK(4.5,0.5), SKT_MK(7,0), SKT_MK(9.5,0.4), SKT_MK(12,0), SKT_MK(14.5,0)];
  const fired = fireWave();
  const right = es.map(SKT_LOST);
  TH.step(0.6);
  const lost = es.map(SKT_LOST);
  const n = skillDef('chain').v(1).n;
  return {noTarget, fired, lost, n, staggered: right.filter(x=>x>0).length < lost.filter(x=>x>0).length,
    hitsN: lost.filter(x=>x>0).length === n,
    fades: lost[0] > lost[n-1],
    ok: noTarget && fired && lost.filter(x=>x>0).length === n && lost[0] > lost[n-1]};
});
R.boomer = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, boomer:1}); S.skill='boomer';
  const e = SKT_MK(3, 0);
  const pops0 = W.pops.length;
  fireWave(); TH.step(0.3);
  const out = SKT_LOST(e);
  TH.step(0.8);
  const total = SKT_LOST(e);
  return {out, total, twice: total > out*1.5, gone: !W.arts.some(f=>f.kind==='skboomer'),
          ok: out>0 && total > out*1.5 && !W.arts.some(f=>f.kind==='skboomer')};
});
R.nova = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, nova:1}); S.skill='nova';
  const e = SKT_MK(1.5, 0, {state:'chase', ms:2.6});
  const far = SKT_MK(6, 0);
  fireWave();
  const frozen = e.frz > 0, farOk = !(far.frz>0);
  const x0 = e.x, y0 = e.y; TH.step(0.8);
  const still = Math.hypot(e.x-x0, e.y-y0) < 0.01;
  const vuln = skillVuln(e);
  TH.step(2.0);
  return {frozen, farOk, still, vuln, thaws: !(e.frz>0),
          ok: frozen && farOk && still && vuln>1 && !(e.frz>0)};
});
R.mine = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, mine:1}); S.skill='mine';
  fireWave();
  const placed = W.arts.filter(f=>f.kind==='skmine').length===1;
  const mx = P.x, my = P.y;
  P.x += 4;                                  // 置いて離れる
  P.waveCd = 0; fireWave(); P.waveCd = 0; fireWave();   // 置ける数（Lv.1 は2個）を超えると古い物から消える
  TH.step(0.05);
  const capped = W.arts.filter(f=>f.kind==='skmine' && f.t>0).length === skillDef('mine').v(1).max;
  const e = SKT_MK(mx - P.x, my - P.y);      // 最初に置いた所（もう消えている）
  const e2 = SKT_MK(0.1, 0.05);              // 今いる所の罠を踏む
  TH.step(0.7);
  return {placed, capped, oldGone: SKT_LOST(e)===0, boom: SKT_LOST(e2)>0,
          ok: placed && capped && SKT_LOST(e)===0 && SKT_LOST(e2)>0};
});
R.mark = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, chain:1, mark:1}); S.skill='mark';
  const a = SKT_MK(2, 0, {maxHp:50, hp:50});
  const nb = SKT_MK(3.2, 0.6);               // a のそば。呪印の扇の外（後で印が移る）
  nb.x = a.x + 1.2; nb.y = a.y + 1.6; gridBuild();
  const behind = SKT_MK(-2, 0);
  const da = Math.abs(Math.atan2(nb.y-P.y, nb.x-P.x));
  fireWave();
  const marked = a.dead || a.markT > 0;
  // a に印を付け直して倒す（Lv.1 の当たりで倒れなかった場合に備えて）
  if(!a.dead){ a.markT = 6; a.markAmp = 0.2; a.markBurst = 2; a.markBr = 2.2; a.hp = 1; hitEnemy(a, stats(S.hero), 1); }
  const before = SKT_LOST(nb);
  TH.step(0.2);
  return {marked, aDead: a.dead, burstHit: SKT_LOST(nb) > before, passed: nb.markT > 0,
          spareBehind: !(behind.markT>0),
          ok: a.dead && SKT_LOST(nb) > before && nb.markT > 0 && !(behind.markT>0)};
});
R.vortex = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, chain:1, mark:1, vortex:1}); S.skill='vortex';
  const e = SKT_MK(3.0, 2.6);
  fireWave();
  const v = W.arts.find(f=>f.kind==='skvortex');
  const d0 = Math.hypot(e.x-v.x, e.y-v.y);
  TH.step(1.0);
  const d1 = Math.hypot(e.x-v.x, e.y-v.y);
  const tickLost = SKT_LOST(e);
  TH.step(2.0);
  return {d0, d1, pulled: d1 < d0-0.5, ticks: tickLost>0, burst: SKT_LOST(e) > tickLost,
          ok: d1 < d0-0.5 && SKT_LOST(e) > tickLost};
});
R.turret = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, nova:1, turret:1}); S.skill='turret';
  fireWave();
  P.x -= 1.5;
  const e = SKT_MK(4, 0);
  const hits = [];
  TH.step(3.0, {each:()=>{ hits.push(SKT_LOST(e)); }});
  const steps = new Set(hits).size - 1;
  P.waveCd = 0; fireWave();
  const one = W.arts.filter(f=>f.kind==='skturret' && f.t>0).length === 1;
  return {steps, shoots: steps >= 3, one, ok: steps >= 3 && one};
});
R.decoy = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, boomer:1, mine:1, decoy:1}); S.skill='decoy';
  const e = SKT_MK(3, 0);
  const before = enemyTarget(e).ent;
  fireWave();
  P.x -= 3;                                   // 自分は離れる
  const lured = enemyTarget(e).ent && enemyTarget(e).ent.decoy;
  const intr = SKT_MK(2, 0, {intruder:true});
  const intrIgnores = !enemyTarget(intr).ent;
  TH.step(4.0);
  return {before: before===null, lured: !!lured, intrIgnores, back: !(enemyTarget(e).ent && enemyTarget(e).ent.decoy),
          burst: SKT_LOST(e)>0,
          ok: before===null && !!lured && intrIgnores && !(enemyTarget(e).ent&&enemyTarget(e).ent.decoy) && SKT_LOST(e)>0};
});
R.meteor = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, chain:1, mark:1, vortex:1, meteor:1}); S.skill='meteor';
  const noTarget = fireWave()===false;
  const lone = SKT_MK(2, -2.5);
  const g = [SKT_MK(5, 1), SKT_MK(5.6, 1.4), SKT_MK(5.2, 0.4)];
  fireWave();
  const m = W.arts.find(f=>f.kind==='skmeteor');
  const aimsPack = Math.hypot(m.x-5.3-P.x, m.y-0.9-P.y) < 1.0;
  TH.step(0.5);
  const early = g.every(e=>SKT_LOST(e)===0);
  TH.step(0.7);
  return {noTarget, aimsPack, early, landed: g.every(e=>SKT_LOST(e)>0),
          ok: noTarget && aimsPack && early && g.every(e=>SKT_LOST(e)>0)};
});
R.tornado = await pg.evaluate(()=>{
  SKT_SETUP({wave:1, boomer:1, mine:1, decoy:1, tornado:1}); S.skill='tornado';
  const e = SKT_MK(2.0, 0);
  const x0 = e.x;
  fireWave();
  const hits = [];
  TH.step(2.0, {each:()=>hits.push(SKT_LOST(e))});
  return {multi: new Set(hits).size >= 4, carried: e.x > x0 + 0.5,
          ok: new Set(hits).size >= 4 && e.x > x0 + 0.5};
});

/* --- 4. どの技も、ボタンから出て、出たら枠のリキャストに入る（エラーを出さない） --- */
R.allFire = await pg.evaluate(()=>{
  const out = {};
  SKILL_TECHS.forEach(t=>{
    const upg = {}; SKILL_TECHS.forEach(x=>upg[x.id]=5); upg.spow=5; upg.scd=4;
    SKT_SETUP(upg); S.skill = t.id;
    SKT_MK(2, 0); SKT_MK(3, 1); SKT_MK(4, -1);
    const f = fireWave();
    TH.step(4.0);
    out[t.id] = f && P.waveCdMax > 0 && P.waveCdMax <= t.cd(5) + 1e-9;
  });
  return {out, ok: Object.values(out).every(Boolean)};
});

/* --- 5. ツリー：前提・段・選んでから強化・セット --- */
R.tree = await pg.evaluate(()=>{
  S.hero = null; S.run = null; S.upg = {}; S.shards = 5000; S.bossClear = 0; S.skill = null;
  setScreen('town'); setScreen('upg');
  const click = sel => document.querySelector(sel).dispatchEvent(new MouseEvent('click', {bubbles:true}));
  const board = document.querySelector('.skt-board');
  const wide = board.offsetWidth > innerWidth;
  const scrollX = getComputedStyle(document.getElementById('skt-scroll')).overflowX === 'auto';
  // 前提が無いと買えない
  click('[data-upgsel="chain"]');
  const selShows = document.getElementById('skt-detail').textContent.includes('チェインライトニング');
  const reqMsg = document.getElementById('skt-detail').textContent.includes('先に「ショック」を覚える');
  const noBtn = !document.querySelector('[data-upg="chain"]');
  // 押しただけでは買わない
  click('[data-upgsel="wave"]');
  const notBought = upgLv('wave') === 0;
  click('[data-upg="wave"]');
  const bought = upgLv('wave') === 1 && S.skill === 'wave';
  click('[data-upgsel="chain"]'); click('[data-upg="chain"]');
  const chainOk = upgLv('chain') === 1 && S.skill === 'wave';   // 2つ目は勝手に載せ替えない
  click('[data-sksel="chain"]');
  const setOk = S.skill === 'chain';
  // 段が閉じている技
  click('[data-upgsel="nova"]');
  const lockMsg = document.getElementById('skt-detail').textContent.includes('第5階層の中ボスを倒すと開く');
  const lockNoBtn = !document.querySelector('[data-upg="nova"]');
  // 線が引かれている
  const lines = document.querySelectorAll('.skt-lines path').length;
  setScreen('town');
  return {wide, scrollX, selShows, reqMsg, noBtn, notBought, bought, chainOk, setOk, lockMsg, lockNoBtn, lines,
    ok: wide && scrollX && selShows && reqMsg && noBtn && notBought && bought && chainOk && setOk && lockMsg && lockNoBtn && lines > 15};
});

/* --- 6. HUD のボタンは載せた技の絵と名前になる --- */
R.hud = await pg.evaluate(()=>{
  SKT_SETUP({wave:2, chain:3}); S.skill = 'chain';
  updateHUD();
  const lbl = document.getElementById('wavebtn').getAttribute('aria-label');
  const on = document.getElementById('wavebtn').classList.contains('on');
  return {lbl, on, ok: on && lbl === 'チェインライトニング Lv.3'};
});
await done(b, errs, R);
