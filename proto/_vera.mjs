/* ============================================================
   ヴェラ（10F の大ボス）との一戦を何本も回して、勝ち負けを数える
   ------------------------------------------------------------
   テストではない。合否を出さない（_ で始まるので sweep に入らない）。
   2026-10-20 ユーザー指定「2-3回トライして倒せるくらいがベスト」の調整用。

   10F に着いた人を作る：SP をツリーに注ぎ（_balance と同じ順）、Lv と資質（レベルごとに1個）、
   9F で拾える程度の装備を何回か引いて良い物を着ける。広間の入口から始めて、操縦で戦わせる。

   操縦（--bot）:
     dodge … 寄って殴る。ボスの技の予兆の範囲（bossMoveHits / pillarHits）にいたら外へ逃げる（既定＝ふつうの人）
     dash  … 上に加えて、予兆の切れ際にダッシュを踏む（上手い人）
     none  … 避けない（下手な人の下限）
   近い当たりの円（体か脚：eNear）へ寄るので、脚も自然に殴る。

   飛んでくる弾は、--see の割合（既定 0.6）だけ気付いて横へ避ける（近い所に来てから）。弾に気付くかの乱数も種から引く。
   1本ごとに口座の記録（死の圧・大技・熟練・閃き）を消す——消さないと、負けるたびに死の圧でヴェラが強くなり、
   後の種ほど勝てなくなって「本数を増やすと勝率が下がる」という変な数字になる（2026-10-20 に踏んだ）。
   --dp N で「10Fで N 回死んだあと」（死の圧）を、--ally N で仲間を連れた場合を測る。

   2026-10-20 の実測（50本、脚の耐久 0.25・2本で歩けない）：
     1回目 SP200 Lv10 … 38%（仲間1〜2人で 48%）／ 2回目 dp1 SP230 … 34% ／ 3回目 dp2 SP260 Lv11 … 40%
     → 3回までに倒せる割合 約75%。上手い人（--see 0.85）58%、避けない人（--bot none）4%。

   使い方:
     node proto/_vera.mjs --seeds 50 --sp 200 --lv 10 --bot dodge
   ============================================================ */
import { chromium, devices } from 'playwright';
import path from 'path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SEEDS = +arg('seeds', 12), SP = +arg('sp', 300), LV = +arg('lv', 14), BOT = arg('bot', 'dodge'), ROLLS = +arg('rolls', 10), CAP = +arg('cap', 360);
const TIER = +arg('tier', 5), DT = +arg('dt', 1/30), SEE = +arg('see', 0.6), DP = +arg('dp', 0), ALLY = +arg('ally', 0), ATK2 = arg('atk2', null), HP1 = arg('hp1', null), LEGHP = arg('leghp', null);
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await pg.goto('file://' + path.resolve(arg('file','proto/index.html')));
await pg.waitForTimeout(400);
await pg.evaluate(([a2, h1, lh]) => { const f1 = UNIQUE_BOSSES[10].form1; if (a2 != null) f1.secondAtkMul = +a2; if (lh != null) BOSS_PARTS.legs.hp = +lh; if (h1 != null) f1.hpMul = +h1; }, [ATK2, HP1, LEGHP]);
await pg.evaluate(() => { if (!S.hero) { S.name = '測定'; startAdventure(); } window.DROP_IN=false; S.tutStone=true; if(window.CAVE) CAVE.halfRate=false; });

const res = [];
for (let s = 0; s < SEEDS; s++) {
  const r = await pg.evaluate(({ seed, sp, lv, bot, rolls, cap, tier, dt, see, dp, ally }) => {
    const fl0x = () => W.fl.start.cx + .5, fl0y = () => W.fl.start.cy + 1;
    const BOLT_SEE = see, seeRnd = mulberry32(seed * 7 + 1);   // 弾に気付くかの乱数は種から（Math.random だと毎回ぶれる）
    const order = ['hp', 'def', 'dr', 'atk', 'wave', 'regen', 'revive', 'aspd', 'ms', 'crit', 'range', 'mf'];
    S.bossClear = tier; S.greatDown = {};
    /* 前の1本の口座の記録を持ち越さない（死ぬたびに積もる死の圧・倒した数で開く大技・武器の熟練・閃いた技） */
    S.deathPressure = dp ? {10: dp} : {}; S.greatKills = 0; S.ultLv = {}; S.ult = null; S.mastery = {}; S.arts = {}; S.cleared2 = {}; S.bossBoon = {};
    const up = {}; let left = sp, moved = true;
    while (moved) { moved = false;
      for (const id of order) { const u = UPGRADES.find(x => x.id === id); if (!u) continue; const l = up[id] || 0;
        if (l >= u.max) continue; if (typeof upgLocked === 'function' && upgLocked(u)) continue;
        const c = upgCost(u, l); if (c > left) continue; left -= c; up[id] = l + 1; moved = true; } }
    S.salt = seed; S.runs = 0; S.upg = up; S.deaths = 0; S.hero = newHero(); S.grave = null;
    // 9F で装備を引く
    startRun(9);
    for (let i = 0; i < rolls; i++) { const it = genItem(9 + (i % 3) - 1, 0, 9); if (!it || !it.slot) continue; it.ident = true;
      const cur = S.hero.equip[it.slot];
      const sc = x => !x ? -1 : (x.slot === 'weapon' ? (x.atk || 0) * (x.spd || 1) : (x.def || 0) + (x.maxHp || 0) * 0.05);
      if (sc(it) > sc(cur)) S.hero.equip[it.slot] = it; }
    // Lv と資質
    const h = S.hero; h.charPot = [];
    for (let L = 2; L <= lv; L++) { h.lv = L; h.str++; h.dex++; h.vit++; h.charPot.push(rollCharPotential(h)); }
    S.runs = seed; startRun(10); S.hero.party = []; setScreen('game');
    for (let i = 0; i < ally; i++) { const a = makeAlly(10, S.hero); a.hpNow = allyStats(a).maxHp; S.hero.party.push(a); a.x = fl0x(); a.y = fl0y(); }
    clampHp(); S.hero.hpNow = stats(S.hero).maxHp;
    const fl = W.fl; P.x = fl.start.cx + .5; P.y = fl.start.cy + .5;
    const boss = W.enemies.find(e => e.boss && !e.dead);
    const st0 = stats(S.hero);
    const dmgLog = {};
    if (!window._hpOrig) window._hpOrig = hitPlayer;
    hitPlayer = function () { const h0 = S.hero ? S.hero.hpNow : 0; const r = window._hpOrig.apply(this, arguments);
      const lost = h0 - (S.hero ? S.hero.hpNow : 0);
      if (lost > 0) { const stk = (new Error().stack || '').split('\n').slice(2, 4).map(l => (l.match(/at (\S+)/) || [])[1] || '?').join('<');
        const src = arguments[0], k = (src && src.boss ? (src.form2 ? 'F1:' : 'F2:') : 'add:') + (src && src.cast ? src.cast.id : '') + '@' + stk;
        dmgLog[k] = (dmgLog[k] || 0) + Math.round(lost); }
      return r; };
    let t = 0, form2At = null, legs = 0, win = false, minHp = 1;
    while (t < cap) {
      if (!S.hero || !S.run || S.hero.hpNow <= 0 || S.deaths > 0) break;
      if (boss.dead || !S.run.bossAlive) { win = true; break; }
      if (!boss.form2 && form2At == null) form2At = t;
      // 予兆の範囲にいるか
      let danger = false, ex = 0, ey = 0;
      if (bot !== 'none' && boss.cast && typeof bossMoveHits === 'function') {
        const c = boss.cast, m = BOSS_MOVES[c.id];
        if (c.spots) { for (const sp_ of c.spots) if (pillarHits(sp_, m, P.x, P.y, .4)) { danger = true; ex += P.x - sp_.x; ey += P.y - sp_.y; } }
        else if (bossMoveHits(boss, c, P.x, P.y, .4)) { danger = true;
          if (c.id === 'beam') { const nx = -Math.sin(c.dir), ny = Math.cos(c.dir); const side = (P.x - boss.x) * nx + (P.y - boss.y) * ny >= 0 ? 1 : -1; ex = nx * side; ey = ny * side; }
          else { ex = P.x - boss.x; ey = P.y - boss.y; } }
      }
      /* 飛んでくる弾（敵の bolt）：このまま進むと 0.6 マス以内を通る物があれば、弾の進む向きに対して横へ避ける。
         人は全部は避けないので、見えるのは近い所（1.8 マス以内）に来てからだけ */
      if (bot !== 'none' && !danger) {
        for (const f of W.fx) { if (f.t !== 'bolt') continue;
          if (f._seen == null) f._seen = seeRnd() < BOLT_SEE;   // 人が気付いて避けられる弾の割合（既定 0.6）
          if (!f._seen) continue;
          const rx = P.x - f.x, ry = P.y - f.y, sp_ = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sp_, uy = f.vy / sp_;
          const along = rx * ux + ry * uy; if (along < 0 || along > 1.8) continue;
          const side = rx * -uy + ry * ux; if (Math.abs(side) > 0.6) continue;
          const sg = side >= 0 ? 1 : -1; ex += -uy * sg; ey += ux * sg; danger = true; }
      }
      const n = eNear(boss, P.x, P.y), st = stats(S.hero), reach = Math.max(0.6, (st.range || 1.2) * 0.85);
      let mx = 0, my = 0;
      if (danger) { const l = Math.hypot(ex, ey) || 1; mx = ex / l; my = ey / l;
        if (bot === 'dash' && typeof tapDash === 'function' && FEEL.dashCd <= 0 && boss.tele < 0.2) tapDash(innerWidth / 2, innerHeight / 2); }
      else if (n.d > reach) { const dx = n.x - P.x, dy = n.y - P.y, l = Math.hypot(dx, dy) || 1; mx = dx / l; my = dy / l; }
      stickDx = mx; stickDy = my;
      if (typeof ultReady === 'function' && ultReady()) fireUlt();
      if (typeof waveReady === 'function' && waveReady()) fireWave();
      stepSim(dt); t += dt;
      if (S.hero) minHp = Math.min(minHp, S.hero.hpNow / stats(S.hero).maxHp);
    }
    stickDx = stickDy = 0;
    legs = boss.parts ? boss.parts.filter(p => p.broken).length : 0;
    return { seed, win, t: +t.toFixed(0), form2At: form2At == null ? null : +form2At.toFixed(0), legs,
      bossHp: boss.dead ? 0 : Math.round(boss.hp / boss.maxHp * 100), inForm2: !boss.form2,
      lv: S.hero ? S.hero.lv : lv, atk: +st0.atk.toFixed(0), maxHp: Math.round(st0.maxHp), def: Math.round(st0.def || 0),
      weapon: S.hero && S.hero.equip.weapon ? S.hero.equip.weapon.nm : '-', minHp: +minHp.toFixed(2), dmg: dmgLog };
  }, { seed: 3000 + s * 17, sp: SP, lv: LV, bot: BOT, rolls: ROLLS, cap: CAP, tier: TIER, dt: DT, see: SEE, dp: DP, ally: ALLY });
  res.push(r);
  process.stdout.write(r.win ? 'W' : 'L');
}
const wins = res.filter(r => r.win).length;
console.log(`\n=== ヴェラ ${SEEDS}本 / SP${SP} Lv${LV} bot=${BOT} see=${SEE} dp=${DP} ally=${ALLY} atk2=${ATK2} leghp=${LEGHP} rolls=${ROLLS} ===  勝ち ${wins}/${SEEDS} (${Math.round(wins / SEEDS * 100)}%)`);
const med = a => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
console.log(' 勝ち時間中央値', med(res.filter(r => r.win).map(r => r.t)), '秒 / 第二形態到達中央値', med(res.filter(r => r.form2At != null).map(r => r.form2At)), '秒',
  '/ 負けの時のボス残HP中央値', med(res.filter(r => !r.win).map(r => r.inForm2 ? r.bossHp : 100 + r.bossHp)), '(100超=第一形態)',
  '/ 脚破壊中央値', med(res.map(r => r.legs)));
console.log(' 攻撃', med(res.map(r => r.atk)), '最大HP', med(res.map(r => r.maxHp)), '防御', med(res.map(r => r.def)));
if (process.argv.includes('--v')) res.forEach(r => console.log(JSON.stringify(r)));
if (errs.length) console.log('errs', errs.slice(0, 3));
await b.close();
