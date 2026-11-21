/* ============================================================
   20F・30F（ほかの階も）の主との一戦を何本も回して、勝ち負けを数える。合否は出さない。
   2026-11-21 ユーザー指定「20Fと30Fのボスがデバッグで入ったレベルで余裕で勝ててしまった」の調整用。
   デバッグで階を選んで入ったときと同じ支給（outfitForBeacon：Lv=階×1.1、レベルぶんの資質、白の武器と鎖帷子）
   に、--sp ぶんの能力強化を足して、広間の入口から操縦で戦わせる（操縦は _vera.mjs と同じ）。
   使い方: node proto/_boss.mjs --depth 20 --seeds 20 --sp 0 --bot dodge [--hpmul 1.5 --atkmul 1.3] [--ally N]
   ============================================================ */
import { chromium, devices } from 'playwright';
import path from 'path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const DEPTH = +arg('depth', 20), SEEDS = +arg('seeds', 12), SP = +arg('sp', 0), BOT = arg('bot', 'dodge'), CAP = +arg('cap', 300),
      DT = +arg('dt', 1/30), SEE = +arg('see', 0.6), ALLY = +arg('ally', 0), GOD = process.argv.includes('--god'), HPM = arg('hpmul', null), ATKM = arg('atkmul', null);
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await pg.goto('file://' + path.resolve(arg('file','proto/index.html'))); await pg.waitForTimeout(400);
await pg.evaluate(([d, hm, am]) => { const U = UNIQUE_BOSSES[d]; if (U) { if (hm != null) U.hpMul = +hm; if (am != null) U.atkMul = +am; } }, [DEPTH, HPM, ATKM]);
await pg.evaluate(() => { if (!S.hero) { S.name = '測定'; startAdventure(); } window.DROP_IN=false; S.tutStone=true; if(window.CAVE) CAVE.halfRate=false; });
const res = [];
for (let s = 0; s < SEEDS; s++) {
  const r = await pg.evaluate(({ seed, sp, bot, cap, dt, see, ally, depth, god }) => {
    const seeRnd = mulberry32(seed * 7 + 1);
    const order = ['hp', 'def', 'dr', 'atk', 'wave', 'regen', 'revive', 'aspd', 'ms', 'crit', 'range', 'mf'];
    S.debug = {on:true, allDepths:true, god:!!god}; S.bossClear = depth-1; S.greatDown = {}; S.midDown = {};
    S.deathPressure = {}; S.greatKills = 0; S.ultLv = {}; S.ult = null; S.mastery = {}; S.arts = {}; S.cleared2 = {}; S.bossBoon = {};
    const up = {}; let left = sp, moved = true;
    while (moved) { moved = false; for (const id of order) { const u = UPGRADES.find(x => x.id === id); if (!u) continue; const l = up[id] || 0;
      if (l >= u.max) continue; if (typeof upgLocked === 'function' && upgLocked(u)) continue;
      const c = upgCost(u, l); if (c > left) continue; left -= c; up[id] = l + 1; moved = true; } }
    S.salt = seed; S.runs = seed; S.upg = up; S.deaths = 0; S.hero = newHero(); S.grave = null; S.revenant = null; S.carry = [];
    RNG = mulberry32(seed);
    startRun(depth); S.hero.party = []; setScreen('game');
    for (let i = 0; i < ally; i++) { const a = makeAlly(depth, S.hero); a.hpNow = allyStats(a).maxHp; S.hero.party.push(a); a.x = W.fl.start.cx+.5; a.y = W.fl.start.cy+1; }
    S.hero.hpNow = stats(S.hero).maxHp;
    P.x = W.fl.start.cx + .5; P.y = W.fl.start.cy + .5;
    W.enemies = W.enemies.filter(e => e.boss || e.escort);
    const st0 = stats(S.hero);
    const bossesAt0 = W.enemies.filter(e=>e.boss).map(e=>({n:e.name, hp:e.maxHp, atk:Math.round(e.atkV)}));
    let t = 0, win = false, minHp = 1, dmgTaken = 0, lastHp = S.hero.hpNow;
    while (t < cap) {
      if (!S.hero || !S.run || S.hero.hpNow <= 0 || S.deaths > 0) break;
      const bosses = W.enemies.filter(e => e.boss && !e.dead);
      if (!S.run.bossAlive || !bosses.length) { win = true; break; }
      let danger = false, ex = 0, ey = 0;
      if (bot !== 'none') for (const boss of bosses) {
        if (!boss.cast || typeof bossMoveHits !== 'function') continue;
        const c = boss.cast, m = BOSS_MOVES[c.id];
        if (c.spots) { for (const sp_ of c.spots) if (m && pillarHits(sp_, m, P.x, P.y, .4)) { danger = true; ex += P.x - sp_.x; ey += P.y - sp_.y; } }
        else if (bossMoveHits(boss, c, P.x, P.y, .4)) { danger = true;
          if (c.id === 'beam') { const nx = -Math.sin(c.dir), ny = Math.cos(c.dir); const side = (P.x - boss.x) * nx + (P.y - boss.y) * ny >= 0 ? 1 : -1; ex += nx * side; ey += ny * side; }
          else { ex += P.x - boss.x; ey += P.y - boss.y; } }
      }
      if (bot !== 'none' && !danger) for (const f of W.fx) { if (f.t !== 'bolt') continue;
        if (f._seen == null) f._seen = seeRnd() < see; if (!f._seen) continue;
        const rx = P.x - f.x, ry = P.y - f.y, sp_ = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sp_, uy = f.vy / sp_;
        const along = rx * ux + ry * uy; if (along < 0 || along > 1.8) continue;
        const side = rx * -uy + ry * ux; if (Math.abs(side) > 0.6) continue;
        const sg = side >= 0 ? 1 : -1; ex += -uy * sg; ey += ux * sg; danger = true; }
      let tgt = bosses[0], bd = 1e9; for (const e of bosses) { const d = Math.hypot(e.x-P.x, e.y-P.y); if (d < bd) { bd = d; tgt = e; } }
      const n = eNear(tgt, P.x, P.y), st = stats(S.hero), reach = Math.max(0.6, (st.range || 1.2) * 0.85);
      let mx = 0, my = 0;
      if (danger) { const l = Math.hypot(ex, ey) || 1; mx = ex / l; my = ey / l;
        if (bot === 'dash' && typeof tapDash === 'function' && FEEL.dashCd <= 0) tapDash(innerWidth / 2, innerHeight / 2); }
      else if (n.d > reach) { const dx = n.x - P.x, dy = n.y - P.y, l = Math.hypot(dx, dy) || 1; mx = dx / l; my = dy / l; }
      stickDx = mx; stickDy = my;
      if (typeof ultReady === 'function' && ultReady()) fireUlt();
      if (typeof waveReady === 'function' && waveReady()) fireWave();
      stepSim(dt); t += dt;
      if (S.hero) { const mh = stats(S.hero).maxHp; minHp = Math.min(minHp, S.hero.hpNow / mh);
        if (S.hero.hpNow < lastHp) dmgTaken += lastHp - S.hero.hpNow; lastHp = S.hero.hpNow; }
    }
    stickDx = stickDy = 0;
    const left_ = W.enemies.filter(e=>e.boss && !e.dead).reduce((a,e)=>a+e.hp,0);
    return { seed, win, t: Math.round(t), lv: st0 && S.hero ? S.hero.lv : 0, atk: Math.round(st0.atk), dps: Math.round(st0.atk*st0.aspd),
      maxHp: Math.round(st0.maxHp), weapon: S.hero && S.hero.equip.weapon ? S.hero.equip.weapon.base : '-', minHp: +minHp.toFixed(2),
      dmgTakenPerMin: Math.round(dmgTaken / Math.max(1,t) * 60), bossesAt0, bossHpLeft: Math.round(left_) };
  }, { seed: 5000 + s * 17, sp: SP, bot: BOT, cap: CAP, dt: DT, see: SEE, ally: ALLY, depth: DEPTH, god: GOD });
  res.push(r); process.stdout.write(r.win ? 'W' : 'L');
}
const wins = res.filter(r => r.win).length;
const med = a => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
console.log(`\n=== ${GOD?'無敵 ':''}${DEPTH}F ${SEEDS}本 / SP${SP} bot=${BOT} ally=${ALLY} hpmul=${HPM} atkmul=${ATKM} ===  勝ち ${wins}/${SEEDS} (${Math.round(wins/SEEDS*100)}%)`);
console.log(' 勝ち時間中央値', med(res.filter(r=>r.win).map(r=>r.t)), '秒 / 最低HP中央値', med(res.map(r=>r.minHp)), '/ 被ダメ/分 中央値', med(res.map(r=>r.dmgTakenPerMin)),
  '/ Lv', med(res.map(r=>r.lv)), '攻撃', med(res.map(r=>r.atk)), '毎秒火力', med(res.map(r=>r.dps)), '最大HP', med(res.map(r=>r.maxHp)));
console.log(' ボス', JSON.stringify(res[0].bossesAt0));
if (process.argv.includes('--v')) res.forEach(r => console.log(JSON.stringify(r)));
if (errs.length) console.log('errs', errs.slice(0, 3));
await b.close();
