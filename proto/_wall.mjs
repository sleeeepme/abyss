/* ============================================================
   5F の中ボス戦だけを取り出して測る
   ------------------------------------------------------------
   テストではない。合否を出さない。

   到達階のハーネス（_balance.mjs）は「5Fで止まる」までしか言わない。
   ツリーが**いくら配れば越えられるのか**を決めるには、
   その一戦を数字で開く必要がある。

     倒しきるのに要る秒数  ＝ ボスHP ÷ こちらの毎秒ダメージ
     生きていられる秒数    ＝ こちらの実効HP ÷ 向こうの毎秒ダメージ

   この2つの比が、そのまま「あと何倍要るか」になる。
   ツリーは火力にも生存にも配れるので、どちらで埋めてもいい——
   ただし**何倍なのかを知らずに配ると、必ず外す。**

   取り巻きの有無で分けて測る。ボス部屋には雑魚もいるので、
   「ボスだけなら勝てるが部屋では負ける」なら、要るのは火力ではなく
   範囲攻撃や立ち位置の方になる。

   使い方:
     node proto/_wall.mjs
     node proto/_wall.mjs --sp 0,130,300,450 --seeds 8 --depth 5
   ============================================================ */
import { chromium, devices } from 'playwright';
import path from 'path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SP_LIST = arg('sp', '0,130,300,450').split(',').map(Number);
const SEEDS   = +arg('seeds', 8);
const DEPTH   = +arg('depth', 5);
/* 段（tier）の解禁具合。キーストーンは段2以降にあるので、
   1 のままだと不屈も衝撃波も無い世界を測ることになる。 */
const DEEPEST = +arg('deepest', 1);
/* 何回ぶん装備を引くか。多くするほど「その階で出うる最良」に近づく。
   実際に潜って着いた人の装備は最良ではないので、
   **実測の攻撃力（_balance の 5F 行）に合う回数**で測らないと
   勝てる前提の世界を測ってしまう。 */
const ROLLS   = +arg('rolls', 24);

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await pg.goto('file://' + path.resolve('proto/index.html'));
await pg.waitForTimeout(400);
await pg.evaluate(() => { if (!S.hero) { S.name = '測定'; startAdventure(); } });

const rows = await pg.evaluate(({ spList, seeds, depth, rolls, deep }) => {
  const order = ['hp', 'def', 'dr', 'atk', 'wave', 'regen', 'revive',
                 'aspd', 'ms', 'crit', 'range', 'mf'];
  const loadout = sp => {
    const up = {}; let left = sp, moved = true;
    while (moved) {
      moved = false;
      for (const id of order) {
        const u = UPGRADES.find(x => x.id === id);
        const lv = up[id] || 0;
        if (lv >= u.max) continue;
        if (typeof upgLocked === 'function' && upgLocked(u)) continue;
        const c = upgCost(u, lv);
        if (c > left) continue;
        left -= c; up[id] = lv + 1; moved = true;
      }
    }
    return up;
  };

  /* 到達したときの装備とレベルを再現する。素手・Lv1で測ると
     実際より重く出て、ツリーに要らない量を配ることになる。
     _balance.mjs の実測では 5F 到達時が Lv4.3・攻撃20前後だったので、
     そこへ寄せる。 */
  const arrive = (sp, seed) => {
    S.deepest = deep;                       // loadout より先に（段の判定が見る）
    S.salt = seed; S.runs = 0; S.upg = loadout(sp); S.deaths = 0;
    S.hero = newHero(); S.grave = null;
    startRun(depth); setScreen('game'); S.hero.party = [];
    S.hero.lv = 4;
    for (let i = 0; i < rolls; i++) {       // その階で拾える程度の装備を引く
      const it = genItem(depth, 0, depth);
      if (!it || !it.slot) continue;
      it.ident = true;
      const cur = S.hero.equip[it.slot];
      const sc = x => !x ? -1 : (x.slot === 'weapon' ? (x.atk || 0) * (x.spd || 1)
                                                     : (x.def || 0) + (x.maxHp || 0) * 0.05);
      if (sc(it) > sc(cur)) S.hero.equip[it.slot] = it;
    }
    clampHp(); S.hero.hpNow = stats(S.hero).maxHp;
    const boss = W.enemies.find(e => e.boss && !e.dead);
    /* ボスの隣に置く。ここは**一戦の中身**を測る道具なので、
       広間まで歩く過程は要らない——経路探索を持たせずに歩かせると
       壁に刺さったまま300秒使い切り、「倒しきれない」と誤って読める。
       （最初それをやって、全部が上限に張り付いた。） */
    if (boss) {
      for (const [dx, dy] of [[1.4,0],[-1.4,0],[0,1.4],[0,-1.4],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        if (standable(boss.x + dx, boss.y + dy)) { P.x = boss.x + dx; P.y = boss.y + dy; break; }
      }
    }
    return boss;
  };

  const out = [];
  for (const sp of spList) {
    const acc = { sp, killT: [], dieT: [], dieTRoom: [], bossHp: 0, heroHp: 0,
                  atk: 0, bossAtk: 0, n: 0, buys: null, revives: 0 };
    for (let s = 0; s < seeds; s++) {
      /* ① こちらがボスを倒しきるのに要る秒数。
            向こうの攻撃は切っておく（生存側と混ぜない）。 */
      let boss = arrive(sp, 2000 + s * 13);
      if (!boss) continue;
      if (!acc.buys) acc.buys = Object.assign({}, S.upg);   // arrive の中で段が開いた後の実物
      W.enemies = [boss]; gridBuild();
      boss.atkV = 0;
      P.invuln = 1e9;
      const bMax = boss.maxHp, st = stats(S.hero);
      let t = 0;
      while (!boss.dead && t < 300) {
        const d = Math.hypot(boss.x - P.x, boss.y - P.y);
        const m = d > 1.15 ? 1 : 0;
        stickDx = m ? (boss.x - P.x) / d : 0;
        stickDy = m ? (boss.y - P.y) / d : 0;
        if (typeof ultReady === 'function' && ultReady()) fireUlt();
        if (typeof waveReady === 'function' && waveReady()) fireWave();
        stepSim(1 / 60); t += 1 / 60;
        if (!S.hero || !S.run) break;
      }
      const killT = boss.dead ? t : Infinity;

      /* ② 向こうがこちらを倒しきるのに要る秒数。ボス単体。
            避けはしない——**下限**を出すための測定なので、
            ここに腕前を混ぜると「配るべき量」がぼやける。 */
      boss = arrive(sp, 2000 + s * 13);
      if (!boss) continue;
      W.enemies = [boss]; gridBuild();
      boss.hp = boss.maxHp = 1e9;
      P.invuln = 0;
      const hp0 = S.hero.hpNow, bAtk = boss.atkV;
      const revBefore = 0;
      t = 0;
      while (S.hero && S.hero.hpNow > 0 && t < 300) {
        const d = Math.hypot(boss.x - P.x, boss.y - P.y);
        stickDx = d > 1.15 ? (boss.x - P.x) / d : 0;
        stickDy = d > 1.15 ? (boss.y - P.y) / d : 0;
        stepSim(1 / 60); t += 1 / 60;
        if (!S.run) break;
      }
      const dieT = t;

      /* ③ 取り巻きも込みで、向こうに倒されるまでの秒数。 */
      boss = arrive(sp, 2000 + s * 13);
      if (!boss) continue;
      W.enemies.forEach(e => { if (e.boss) { e.hp = e.maxHp = 1e9; } });
      P.invuln = 0;
      t = 0; let revSeen = false;
      while (S.hero && S.hero.hpNow > 0 && t < 300) {
        const d = Math.hypot(boss.x - P.x, boss.y - P.y);
        stickDx = d > 1.15 ? (boss.x - P.x) / d : 0;
        stickDy = d > 1.15 ? (boss.y - P.y) / d : 0;
        stepSim(1 / 60); t += 1 / 60;
        /* die() は2度目で S.run を消すので、**消える前に**見ておく。
           後から S.run.upgRevUsed を読むと必ず false になる。 */
        if (S.run && S.run.upgRevUsed) revSeen = true;
        if (!S.run) break;
      }
      if (revSeen) acc.revives++;
      acc.killT.push(killT); acc.dieT.push(dieT); acc.dieTRoom.push(t);
      acc.bossHp += bMax; acc.heroHp += hp0; acc.atk += st.atk; acc.bossAtk += bAtk;
      acc.n++;
    }
    out.push(acc);
  }
  return out;
}, { spList: SP_LIST, seeds: SEEDS, depth: DEPTH, rolls: ROLLS, deep: DEEPEST });

const med = a => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const pad = (s, n) => String(s).padEnd(n);

console.log(`\n=== 第${DEPTH}階の一戦（シード ${SEEDS} 本の中央値 / 段は deepest=${DEEPEST}）===\n`);
console.log(pad('SP', 5) + pad('ボスHP', 9) + pad('こちらHP', 10) + pad('攻撃', 7)
          + pad('倒しきる', 10) + pad('倒される', 10) + pad('部屋で', 9) + 'あと何倍要るか');
console.log('-'.repeat(78));
for (const r of rows) {
  if (!r.n) continue;
  const k = med(r.killT), d = med(r.dieT), dr = med(r.dieTRoom);
  console.log(
    pad(r.sp, 5) + pad(Math.round(r.bossHp / r.n), 9)
    + pad(Math.round(r.heroHp / r.n), 10) + pad((r.atk / r.n).toFixed(1), 7)
    + pad((k === Infinity ? '>300' : k.toFixed(0) + '秒'), 10)
    + pad(d.toFixed(0) + '秒', 10) + pad(dr.toFixed(0) + '秒', 9)
    + (k === Infinity ? '—' : '×' + (k / dr).toFixed(2)));
}
console.log('\n■ 何を買ったか（同じ順で注ぎ込んだ結果）');
for (const r of rows) {
  if (!r.n) continue;
  const b = Object.entries(r.buys).filter(([,v])=>v>0).map(([k,v])=>k+(v>1?'×'+v:'')).join(' ');
  console.log('  SP'+String(r.sp).padEnd(5)+ b + '   ／ 不屈が発動した回数 '+r.revives+'/'+r.n);
}
console.log('\n「あと何倍要るか」＝ 倒しきる秒数 ÷ 部屋で倒される秒数。');
console.log('1.0 を下回れば勝てる。火力を上げても生存を上げても、この比を下げれば同じ。');
if (errs.length) console.log('\nerrs:', errs.slice(0, 3));

await b.close();
