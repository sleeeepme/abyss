/* ============================================================
   到達階の測定ハーネス
   ------------------------------------------------------------
   回帰テスト（sweep）ではない。**合否を出さない。**
   「累計SPがいくつのキャラは、何階まで潜れるか」の分布を出すための道具。

   なぜ要るか:
     死にゲーの目標は「2回死んで5F、さらに3回で10F」だが、
     到達階は床の生成・装備の引き・敵の配置で大きく振れる。
     1本走らせて判断すると、レジェンドの係数で踏んだのと同じ罠に落ちる——
     設計ではなく、その日の出目を測ってしまう。
     だから**固定シードを複数本まわして中央値と四分位で見る。**

   ファイル名の頭に _ が付いているのは sweep から外すため。
   proto/_*.mjs は掃引に入らない規約になっている（_h.mjs = 共通部品、
   _intrperf.mjs = 単発の計測）。これは測定であってテストではないので、
   同じ扱いにする。名前を戻すと sweep が拾って毎回 CRASH 行を出す。

   使い方:
     node proto/_balance.mjs
     node proto/_balance.mjs --seeds 24 --sp 0,60,130,300,450
     node proto/_balance.mjs --maxdepth 20 --csv out.csv
   ============================================================ */
import { chromium, devices } from 'playwright';
import path from 'path';
import fs from 'fs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SEEDS    = +arg('seeds', 16);
const SP_LIST  = arg('sp', '0,60,130,300,450').split(',').map(Number);
const MAXDEPTH = +arg('maxdepth', 15);
const CSV      = arg('csv', null);
const QUIET    = process.argv.includes('--quiet');
const CAP      = +arg('cap', 150);      // 1階に留まれる秒数
const FILE     = arg('file', 'proto/index.html');   // 別案を測るとき用
/* --dash: 予兆の切れ際にダッシュを踏んでジャスト回避を狙う操縦。
   上手い人の側の値を出すために使う。既定は踏まない（下手な人の側）。 */
const DASH     = process.argv.includes('--dash');
/* --deepest: 段（tier）の解禁具合。S.deepest をここに固定して測る。
   キーストーンは段2以降にあるので、これを 1 のままにすると
   **不屈も衝撃波も持っていない世界**を測ることになる。
     1  … まだ第5階層を越えていない（段1のみ）
     6  … 中ボスを越えた（段2が開く）
     11 … 大ボスを越えた（段3が開く） */
const DEEPEST  = +arg('deepest', 1);

const b   = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const pg  = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await pg.goto('file://' + path.resolve(FILE));
await pg.waitForTimeout(400);
await pg.evaluate(() => { if (!S.hero) { S.name = '測定'; startAdventure(); } });

/* ---- 自動操縦をページ側に置く ---------------------------------------
   ここでやることは3つだけ。
     ・穴（または広間のボス）への道を BFS で引く
     ・その向きへ歩く
     ・穴に着いたら降りる
   攻撃は元から毎フレーム自動で出るので、触らない。
   上手く遊ぶ必要はない。**毎回同じように遊ぶ**ことだけが要る。 */
await pg.evaluate(() => {
  window.BAL = {

    /* 累計SPを、決まった優先順で既存の能力強化に注ぎ込む。
       ツリーができたらこの関数だけ差し替える。 */
    loadout(sp, opt) {
      /* 買う順。死にゲーで人が実際に選ぶ順に近づける。
         キーストーン（不屈・衝撃波・治癒・瞬足）を数値より先に取る——
         測定では比を下げる効きがこちらのほうが桁で大きいので、
         人も先に取るはず。段が開いていない物は下の upgLocked で弾かれる。
         ここに項目を足し忘れると、その項目が無い世界を測ることになる。
         **UPGRADES に項目を足したら、必ずここにも足す。** */
      /* 「瞬足」は踏む操縦のときだけ買う。
         自動操縦は人の精度でジャスト回避を踏めないので、
         踏まない側で買わせると**使えない物に払った世界**を測ることになる。 */
      const order = [].concat(
        ['hp'], (opt && opt.dash) ? ['dash'] : [],
        ['def', 'dr', 'atk', 'wave', 'regen', 'revive',
         'aspd', 'ms', 'crit', 'range', 'mf']);
      const up = {};
      let left = sp;
      let moved = true;
      while (moved) {
        moved = false;
        for (const id of order) {
          const u = UPGRADES.find(x => x.id === id);
          const lv = up[id] || 0;
          if (lv >= u.max) continue;
          // 段が開いていない物は買えない。開き具合は S.deepest で決まる。
          if (typeof upgLocked === 'function' && upgLocked(u)) continue;
          const c = upgCost(u, lv);
          if (c > left) continue;
          left -= c; up[id] = lv + 1; moved = true;
        }
      }
      const missing = UPGRADES.filter(u => !order.includes(u.id) && !u.hidden).map(u => u.id);
      return { up, spent: sp - left, missing };
    },

    /* 穴までの流れ場。tileWalk が通れると言うマスだけを辿る。 */
    flow(fl, tx, ty) {
      const W = fl.W, H = fl.H;
      const dist = new Int32Array(W * H).fill(-1);
      const qx = new Int32Array(W * H), qy = new Int32Array(W * H);
      let h = 0, t = 0;
      const sx = Math.floor(tx), sy = Math.floor(ty);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
      dist[sy * W + sx] = 0; qx[t] = sx; qy[t] = sy; t++;
      while (h < t) {
        const x = qx[h], y = qy[h], d = dist[y * W + x]; h++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (dist[ny * W + nx] >= 0) continue;
          if (!tileWalk(fl, nx, ny)) continue;
          // 斜めに角を抜けない
          if (dx && dy && (!tileWalk(fl, x + dx, y) || !tileWalk(fl, x, y + dy))) continue;
          dist[ny * W + nx] = d + 1; qx[t] = nx; qy[t] = ny; t++;
        }
      }
      return dist;
    },

    /* 次に向かうマスの**中心**を返す。
       生の向きベクトルを渡すと、細い通路で壁の角に食い込んで止まる。
       マスの中心を狙わせると、通路の真ん中を通るので引っかからない。 */
    step(fl, dist, px, py) {
      const W = fl.W, H = fl.H;
      const x = Math.floor(px), y = Math.floor(py);
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      const here = dist[y * W + x];
      if (here < 0) return null;
      if (here === 0) return { tx: x + 0.5, ty: y + 0.5, done: true };
      let best = here, bx = null, by = null;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const d = dist[ny * W + nx];
        if (d < 0 || d >= best) continue;
        if (dx && dy && (!tileWalk(fl, x + dx, y) || !tileWalk(fl, x, y + dy))) continue;
        best = d; bx = nx; by = ny;
      }
      if (bx === null) return null;
      return { tx: bx + 0.5, ty: by + 0.5, done: false };
    },

    /* 拾った物のうち、いま着けている物より良い物を着ける。
       これが無いと素手のまま50階まで歩くことになり、
       装備の寄与がゼロの世界を測ってしまう。
       鑑定済みしか着けられないのは本編と同じ。 */
    equipBest() {
      if (!S.hero || !S.run) return;
      const score = it => !it ? -1
        : (it.slot === 'weapon' ? (it.atk || 0) * (it.spd || 1)
                                : (it.def || 0) + (it.maxHp || 0) * 0.05);
      for (const it of S.run.loot) {
        if (!it || !it.ident || !it.slot) continue;
        const cur = S.hero.equip[it.slot];
        if (score(it) > score(cur)) {
          S.hero.equip[it.slot] = it;
          const i = S.run.loot.indexOf(it);
          if (i >= 0) S.run.loot.splice(i, 1);
          if (cur) S.run.loot.push(cur);
          clampHp();
          return;                       // 1フレームに1つで十分
        }
      }
    },

    /* 目標点へ向かう単位ベクトル。 */
    toward(px, py, tx, ty) {
      const dx = tx - px, dy = ty - py;
      const m = Math.hypot(dx, dy);
      return m < 1e-4 ? { dx: 0, dy: 0 } : { dx: dx / m, dy: dy / m };
    },

    /* 1本走らせる。死ぬか、上限階に届くか、詰むまで。 */
    run(seed, sp, maxDepth, cap, opt) {
      opt = opt || {};
      S.deepest = opt.deepest || 1;   // loadout より先に。段の判定がこれを見る
      const lo = this.loadout(sp, opt);
      S.salt = seed;
      S.runs = 0;
      S.deepest = opt.deepest || 1;   // 段の解禁具合を固定して測る
      S.upg = lo.up;
      S.deaths = 0;
      S.hero = newHero();
      S.grave = null;
      startRun(1);
      setScreen('game');

      /* 撃破は killEnemy をフックして数える。
         倒された敵は W.enemies から外れるので、配列を走査しても拾えない。 */
      let kills = 0, spEarned = 0;
      const SP_OF = e => e.boss ? (e.tier === 'final' ? 20 : e.tier === 'great' ? 10 : 5)
                                : e.uniq ? 3 : e.elite ? 2 : 1;
      if (!window._killOrig) window._killOrig = killEnemy;
      killEnemy = function (e) {
        if (e && !e.dead) { kills++; spEarned += SP_OF(e); }
        return window._killOrig.apply(this, arguments);
      };

      let depthReached = 1;
      let deepest = 1;
      let outcome = 'maxdepth';
      let floorT = 0;
      const FLOOR_CAP = cap || 150;   // 1階に留まれる秒数（詰み検出）
      const ENGAGE = 3.0;             // これより近い敵は倒してから進む
      const HOLD   = 1.15;            // 寄る下限。これ以上は詰めない
      const DODGE  = 4.5;             // この距離で予兆が出たら離れる
      let dist = null, distDepth = -1, distTgt = null;
      let lastX = -1, lastY = -1, stallT = 0, noFight = 0;
      const seen = new Set();

      /* ---------- 階ごとの記録 ----------
         「何階まで行けたか」だけでは、どう直せばいいかが分からない。
         道中で削られて空のままボス部屋に入っているのか、
         満タンで入って普通に打ち負けているのかで、要る物が正反対になる。
         前者なら回復と軽減、後者なら火力と手数。

         maxHp は毎フレーム取ると重いので 15 フレームおきに見る。
         削られ方の底が知りたいだけなので、その粒度で足りる。 */
      const trace = [];
      let cur = null;
      const mark = d => {
        const st = stats(S.hero);
        cur = { d, hpIn: Math.round(S.hero.hpNow / st.maxHp * 100), hpMin: 100,
                t: 0, k0: kills, k: 0, lv: S.hero.lv,
                atk: +st.atk.toFixed(1), maxHp: Math.round(st.maxHp),
                bossT: 0, bossHp: null };
        trace.push(cur);
      };
      mark(1);

      for (let frame = 0; frame < 60 * 60 * 40; frame++) {
        if (!S.hero || !S.run) { outcome = 'lost'; break; }
        if (S.hero.hpNow <= 0 || S.deaths > 0) { outcome = 'death'; break; }

        const fl = W.fl;
        if (!fl) { outcome = 'lost'; break; }
        deepest = Math.max(deepest, S.run.depth);

        /* 目的地の決め方。
           走り抜けるだけの操縦にすると攻撃力の価値が測れないので、
           **近くに敵がいたら立ち止まって倒す**。実際の遊び方に近く、
           かつ「遠くの敵を延々と追わない」ので1階に留まりすぎない。 */
        let tgt, engaging = false;
        const foe = noFight > 0 ? null : W.enemies.reduce((best, e) => {
          if (e.dead) return best;
          const d = Math.hypot(e.x - P.x, e.y - P.y);
          return (d < ENGAGE && (!best || d < best.d)) ? { e, d } : best;
        }, null);
        if (S.run.bossAlive) {
          const bs = W.enemies.find(e => e.boss && !e.dead);
          tgt = bs ? { x: bs.x, y: bs.y } : { x: fl.stair.x, y: fl.stair.y };
        } else if (foe) {
          tgt = { x: foe.e.x, y: foe.e.y }; engaging = true;
        } else {
          tgt = { x: fl.stair.x, y: fl.stair.y };
        }

        /* 予兆が出ている相手からは離れる。
           本編は「予兆→発生」で必ず避ける時間があるように作ってある。
           避けない操縦で測ると、その設計を無かったことにして
           ボスを実際より重く見積もる（＝人が遊んだときの手応えとズレる）。 */
        const tele = W.enemies.find(e => !e.dead && e.tele > 0 &&
                                    Math.hypot(e.x - P.x, e.y - P.y) < DODGE);
        if (tele) {
          const away = this.toward(tele.x, tele.y, P.x, P.y);
          /* ---------- ジャスト回避を使う操縦（--dash）----------
             game-feel.js が、ダッシュ開始から 0.12 秒以内に着弾した攻撃を
             1回無効化する。**下がる代わりに、その場で踏む。**

             ここが測りたいことの核心。既定の操縦は予兆のたびに下がるので、
             ボス戦の大半を歩いて過ごし、手数が落ちる。
             ジャスト回避があれば下がらなくてよくなる——
             つまりこの技は「安全」ではなく**手数**を配る技だ、という仮説を、
             同じ操縦の下がる版／踏む版で比べて確かめる。

             踏めないとき（クールダウン中）だけ下がる。 */
          if (opt.dash && typeof tapDash === 'function' && typeof FEEL === 'object') {
            if (tele.tele < 0.18 && FEEL.dashCd <= 0) {
              stickDx = away.dx; stickDy = away.dy;   // 抜ける向きへ踏む
              tapDash(innerWidth / 2, innerHeight / 2);
            } else if (FEEL.dashCd > 0.45) {
              stickDx = away.dx; stickDy = away.dy;   // まだ戻らない。素直に下がる
            } else {
              stickDx = 0; stickDy = 0;               // 踏めるまで待って殴り続ける
            }
          } else {
            stickDx = away.dx; stickDy = away.dy;
          }
          if (typeof ultReady === 'function' && ultReady()) fireUlt();
          /* 衝撃波は**下がっている最中にも押す。** ここに置くことに意味がある——
             この技の値打ちは「殴れていない時間にダメージが出る」ことなので、
             予兆から離れている間に撃たないと、測っても価値が出ない。 */
          if (typeof waveReady === 'function' && waveReady()) fireWave();
          stepSim(1 / 60); floorT += 1 / 60;
          if (!S.hero || !S.run || !W.fl) { outcome = 'death'; break; }
          if (S.hero.hpNow <= 0 || S.deaths > 0) { outcome = 'death'; break; }
          if (floorT > FLOOR_CAP) { outcome = S.run.bossAlive ? 'bossWall' : 'stuck'; break; }
          continue;
        }

        /* 近ければ直接寄る。遠ければ道を引いて向かう。
           ボスも敵も穴も、扱いは同じ——直線で突っ込むと壁に刺さる。 */
        const far = Math.hypot(tgt.x - P.x, tgt.y - P.y);
        /* 止まってよい距離は相手による。敵には間合いを取って止まるが、
           穴には乗るまで歩く——HOLD で止まると穴の縁で永久に足踏みする。 */
        const stopAt = (engaging || S.run.bossAlive) ? HOLD : 0.15;
        let mv;
        if (far < stopAt) {
          mv = { dx: 0, dy: 0 };                 // 間合いは元の攻撃判定に任せる
        } else if (far < 2.5) {
          mv = this.toward(P.x, P.y, tgt.x, tgt.y);
        } else {
          const key = Math.floor(tgt.x) + ',' + Math.floor(tgt.y);
          if (distDepth !== S.run.depth || distTgt !== key) {
            dist = this.flow(fl, tgt.x, tgt.y);
            distDepth = S.run.depth; distTgt = key;
          }
          const nx = dist ? this.step(fl, dist, P.x, P.y) : null;
          mv = nx ? this.toward(P.x, P.y, nx.tx, nx.ty)
                  : this.toward(P.x, P.y, tgt.x, tgt.y);
        }

        /* それでも動けなくなったら、少しのあいだ横に逃がす。
           壁の角や敵の押し合いで固まることがあり、そこで150秒使い切ると
           「強さが足りなくて止まった」と区別がつかなくなる。 */
        if (Math.hypot(P.x - lastX, P.y - lastY) < 0.02) stallT += 1 / 60; else stallT = 0;
        lastX = P.x; lastY = P.y;
        if (stallT > 0.8) { const t = mv; mv = { dx: -t.dy, dy: t.dx }; }
        if (stallT > 2.0) {
          stallT = 0; dist = null; distDepth = -1;
          /* 壁の向こうの敵に張り付いていることがある。
             しばらく戦うのをやめて穴へ向かわせ、抜け出させる。 */
          if (engaging) noFight = 3.0;
        }
        noFight = Math.max(0, noFight - 1 / 60);

        stickDx = mv.dx;
        stickDy = mv.dy;

        /* 大技は溜まっていれば必ず撃つ。
           人は溜まった大技を抱えたまま死なないので、撃たない操縦で測ると
           ボスの重さを実際より重く見積もる。 */
        if (typeof ultReady === 'function' && ultReady()) fireUlt();
        if (typeof waveReady === 'function' && waveReady()) fireWave();
        if (frame % 30 === 0) this.equipBest();

        stepSim(1 / 60);
        floorT += 1 / 60;

        // stepSim の中で死ぬと S.run ごと消える。触る前にもう一度見る。
        if (!S.hero || !S.run || !W.fl) { outcome = 'death'; break; }
        if (S.hero.hpNow <= 0 || S.deaths > 0) { outcome = 'death'; break; }

        if (cur) {
          cur.t = +floorT.toFixed(1);
          cur.k = kills - cur.k0;
          const bs = W.enemies.find(e => e.boss && !e.dead);
          if (bs) { cur.bossT += 1 / 60; cur.bossHp = Math.round(bs.hp / bs.maxHp * 100); }
          if (frame % 15 === 0) {
            const p = Math.round(S.hero.hpNow / stats(S.hero).maxHp * 100);
            if (p < cur.hpMin) cur.hpMin = p;
          }
        }

        // 穴に着いたら降りる
        if (!S.run.bossAlive && onStair() && S.run.depth < maxDepth) {
          depthReached = S.run.depth + 1;
          enterFloor(S.run.depth + 1);
          floorT = 0; dist = null; distDepth = -1;
          mark(S.run.depth);
          continue;
        }
        if (S.run.depth >= maxDepth && !S.run.bossAlive && onStair()) { outcome = 'maxdepth'; break; }
        if (floorT > FLOOR_CAP) { outcome = S.run.bossAlive ? 'bossWall' : 'stuck'; break; }
      }

      stickDx = stickDy = 0;
      return {
        seed, sp, spent: lo.spent,
        depth: deepest,
        outcome, kills, spEarned,
        lv: S.hero ? S.hero.lv : 0,
        trace,
        /* 詰んだときに原因が分かるように、最後の状態を持ち帰る。
           「動けなかった」のか「倒せなかった」のかで直す場所が違う。 */
        why: {
          p: S.run ? [+P.x.toFixed(1), +P.y.toFixed(1)] : null,
          stair: W.fl ? [+W.fl.stair.x.toFixed(1), +W.fl.stair.y.toFixed(1)] : null,
          flowOk: !!dist,
          distAtP: (dist && W.fl) ? dist[Math.floor(P.y) * W.fl.W + Math.floor(P.x)] : null,
          bossAlive: S.run ? !!S.run.bossAlive : null,
          hp: S.hero ? Math.round(S.hero.hpNow) : null,
          bossHpPct: (() => { const b = W.enemies.find(e => e.boss && !e.dead);
            return b ? Math.round(b.hp / b.maxHp * 100) : null; })(),
          heroAtk: S.hero ? Math.round(stats(S.hero).atk) : null,
          weapon: (S.hero && S.hero.equip.weapon) ? S.hero.equip.weapon.nm : 'なし'
        }
      };
    }
  };
});

/* ---- まわす ---------------------------------------------------------- */
const rows = [];
for (const sp of SP_LIST) {
  let warned = false;
  for (let s = 0; s < SEEDS; s++) {
    const r = await pg.evaluate(([seed, sp, md, cap, opt]) => BAL.run(seed, sp, md, cap, opt),
      [1000 + s * 7, sp, MAXDEPTH, CAP, { dash: DASH, deepest: DEEPEST }]);
    if (r.missing && r.missing.length && !warned) {
      warned = true;
      console.log('\n  ⚠ 買う順に入っていない項目:', r.missing.join(','),
                  '— _balance.mjs の order に足すこと');
    }
    rows.push(r);
    if (r.why && !QUIET) console.log('\n  ' + r.outcome + ':', JSON.stringify(r.why));
    if (!QUIET) process.stdout.write('.');
  }
  if (!QUIET) process.stdout.write(' SP' + sp + '\n');
}

const q = (a, p) => {
  const v = [...a].sort((x, y) => x - y);
  const i = (v.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo);
};

console.log('\n=== 到達階の分布（シード ' + SEEDS + ' 本 / 上限 ' + MAXDEPTH + 'F / 段は deepest=' + DEEPEST + '）===');
console.log('  SP  使った  到達階 中央値   25%   75%   最浅  最深   撃破  獲得SP  詰み   内訳');
for (const sp of SP_LIST) {
  const r = rows.filter(x => x.sp === sp);
  const d = r.map(x => x.depth);
  const stuck = r.filter(x => x.outcome === 'stuck').length;
  console.log(
    String(sp).padStart(4) +
    String(r[0].spent).padStart(8) +
    q(d, 0.5).toFixed(1).padStart(12) +
    q(d, 0.25).toFixed(1).padStart(6) +
    q(d, 0.75).toFixed(1).padStart(6) +
    String(Math.min(...d)).padStart(6) +
    String(Math.max(...d)).padStart(6) +
    (r.reduce((a, x) => a + x.kills, 0) / r.length).toFixed(0).padStart(7) +
    (r.reduce((a, x) => a + x.spEarned, 0) / r.length).toFixed(0).padStart(8) +
    String(stuck).padStart(6) +
    '   ' + ['death','bossWall','maxdepth','stuck','lost']
      .map(k => { const n = r.filter(x => x.outcome === k).length; return n ? k + ':' + n : null; })
      .filter(Boolean).join(' '));
}

/* ---------- 階ごとの削られ方 ----------
   到達階だけ見ていると「5Fで止まる」しか分からない。
   直す場所を決めるには、**空で入って負けたのか、満タンで打ち負けたのか**が要る。
     hpIn  その階に入った時点のHP%（前の階でどれだけ削られたか）
     hpMin その階で一番減ったところ（そこで何が起きているか）
   前者が低いなら道中の消耗＝回復と軽減、
   高いままなら純粋な力負け＝火力と手数が足りない、という読み方をする。 */
const floorsOf = sp => {
  const acc = new Map();
  for (const r of rows.filter(x => x.sp === sp))
    for (const f of (r.trace || [])) {
      if (!acc.has(f.d)) acc.set(f.d, []);
      acc.get(f.d).push(f);
    }
  return acc;
};
const avg = (a, k) => a.length ? a.reduce((s, x) => s + (x[k] || 0), 0) / a.length : 0;

console.log('\n=== 階ごとの削られ方（各SPの平均）===');
console.log(' SP  階   入HP%  最低HP%  滞在秒  撃破  Lv   攻撃   最大HP  ボス戦秒  ボス残HP%');
for (const sp of SP_LIST) {
  const acc = floorsOf(sp);
  for (const d of [...acc.keys()].sort((a, b) => a - b)) {
    const a = acc.get(d);
    const bossT = avg(a, 'bossT');
    const withBoss = a.filter(f => f.bossHp !== null);
    console.log(
      String(sp).padStart(4) + String(d).padStart(4) +
      avg(a, 'hpIn').toFixed(0).padStart(8) +
      avg(a, 'hpMin').toFixed(0).padStart(9) +
      avg(a, 't').toFixed(0).padStart(8) +
      avg(a, 'k').toFixed(1).padStart(6) +
      avg(a, 'lv').toFixed(1).padStart(5) +
      avg(a, 'atk').toFixed(1).padStart(7) +
      avg(a, 'maxHp').toFixed(0).padStart(9) +
      (bossT > 0.5 ? bossT.toFixed(0) : '-').padStart(10) +
      (withBoss.length ? avg(withBoss, 'bossHp').toFixed(0) : '-').padStart(11));
  }
}

if (errs.length) console.log('\nerrs:', errs.slice(0, 5));
if (CSV) {
  fs.writeFileSync(CSV, 'sp,seed,depth,outcome,kills,spEarned,lv\n' +
    rows.map(r => [r.sp, r.seed, r.depth, r.outcome, r.kills, r.spEarned, r.lv].join(',')).join('\n'));
  console.log('\n→ ' + CSV);
}
await b.close();
