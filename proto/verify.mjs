// 検証: 生成到達可能性 / ドロップ確率 / オート攻撃 / 死亡→再開 / 拠点の成長要素
import { chromium } from 'playwright';
import path from 'path';
const url = 'file://' + path.resolve('proto/index.html');

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await pg.goto(url);
await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });

// --- 1. ダンジョン連結性: 100階層ぶん BFS
const conn = await pg.evaluate(() => {
  let bad = 0, roomsUnreachable = 0, samples = 0;
  for (let d = 1; d <= 100; d++) {
    RNG = mulberry32((d * 104729 + 7919) >>> 0);
    const f = genFloor(d);
    const seen = Array.from({ length: f.H }, () => new Uint8Array(f.W));
    const q = [[f.start.cx, f.start.cy]]; seen[f.start.cy][f.start.cx] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx<0||ny<0||nx>=f.W||ny>=f.H) continue;
        if (seen[ny][nx] || f.g[ny][nx] === 0) continue;
        seen[ny][nx] = 1; q.push([nx, ny]);
      }
    }
    if (!seen[Math.floor(f.stair.y)][Math.floor(f.stair.x)]) bad++;
    f.rooms.forEach(r => { samples++; if (!seen[r.cy][r.cx]) roomsUnreachable++; });
  }
  return { bad, roomsUnreachable, samples };
});

// --- 2. レアリティ分布
const rarity = await pg.evaluate(() => {
  const out = {};
  for (const [label, ilvl, mf] of [['d1_mf0',1,0], ['d20_mf60',20,60], ['d50_mf120',50,120]]) {
    RNG = mulberry32(12345);
    const c = [0,0,0,0,0], N = 100000;
    for (let i = 0; i < N; i++) c[rollRarity(ilvl, mf).id]++;
    out[label] = c.map(v => +(v / N * 100).toFixed(2));
  }
  return out;
});

// --- 3. 永続強化が実際にステータスへ乗るか
const upgrades = await pg.evaluate(() => {
  S.upg = {}; S.hero = newHero();
  const before = stats(S.hero);
  S.upg = { hp:8, atk:8, aspd:6, range:5, ms:5, mf:6, crit:5, stash:6 };
  const after = stats(S.hero);
  return {
    hp:    [before.maxHp, after.maxHp],
    atk:   [+before.atk.toFixed(2), +after.atk.toFixed(2)],
    range: [+before.range.toFixed(2), +after.range.toFixed(2)],
    ms:    [+before.ms.toFixed(2), +after.ms.toFixed(2)],
    mf:    [before.mf, after.mf],
    stashCap: stashCap(),
  };
});

// --- 4. 店で買う / 強化を買う（所持金とスロットが正しく動くか）
const shop = await pg.evaluate(() => {
  S.upg = {}; S.stash = []; S.gold = 100000; S.deepest = 20; rerollShop();
  const priced = S.shop.every(i => i.price > 0 && i.ident);
  const g0 = S.gold, item = S.shop[0], p = item.price;
  setScreen('shop');                       // 道具屋は独立画面になった
  document.querySelector(`[data-buy="${item.uid}"]`).click();
  const bought = S.stash.some(i => i.uid === item.uid) && S.gold === g0 - p;
  setScreen('upg');                        // 永続強化も独立画面
  const u = UPGRADES[0], c = upgCost(u, 0), g1 = S.gold;
  document.querySelector(`[data-upg="${u.id}"]`).click();
  const upgraded = upgLv(u.id) === 1 && S.gold === g1 - c;
  // 金が足りないときは買えないこと
  S.gold = 0; renderUpg();
  const lv = upgLv(u.id);
  document.querySelector(`[data-upg="${u.id}"]`).click();
  const blocked = upgLv(u.id) === lv;
  setScreen('town');
  return { priced, bought, upgraded, blocked };
});

// --- 5. オート攻撃: ボタンを一切押さずに敵が減るか
await pg.evaluate(() => { S.gold = 0; S.upg = {}; S.stash = []; S.hero = newHero(); });
await pg.click('#btn-dive');
// 説明はもう自動で割り込まない（タイトルの「？」から開く方式）ので閉じる操作は不要
await pg.waitForTimeout(300);
const auto = await pg.evaluate(async () => {
  const noButtons = !document.getElementById('atk') && !document.getElementById('roll');
  // 敵を射程内に置き、以後は一切入力しない
  const before = W.enemies.filter(e => !e.dead).length;
  W.enemies.slice(0, 3).forEach((e, i) => { e.x = P.x + 0.6 + i * 0.2; e.y = P.y; });
  const dropBefore = S.run.loot.length;
  W.drops.push({ x: P.x, y: P.y, it: genItem(3, 0) });   // 足元のアイテム→自動拾得の確認
  await new Promise(r => setTimeout(r, 2500));
  return { noButtons, before, after: W.enemies.filter(e => !e.dead).length,
           kills: S.run.kills, autoPicked: S.run.loot.length > dropBefore };
});

// --- 6. 死亡 → 再開でフリーズしないこと（本題のバグ）
const death = await pg.evaluate(async () => {
  S.hero.hpNow = 1;
  hitPlayer(null, 99999, 0, 5);
  await new Promise(r => setTimeout(r, 300));
  const modal = document.getElementById('m-death').classList.contains('on');
  // rAF ループが生きているか: 2 フレーム進むか測る
  const t0 = await new Promise(r => requestAnimationFrame(r));
  const t1 = await new Promise(r => requestAnimationFrame(r));
  const loopAlive = t1 > t0;
  document.getElementById('d-ok').click();
  await new Promise(r => setTimeout(r, 300));
  return { modal, loopAlive, backToTown: S.screen === 'town', heroRecreated: !!S.hero,
           townVisible: document.getElementById('scr-town').classList.contains('on') };
});

// --- 7. 再開後にもう一度潜れるか（フリーズの真の判定）
await pg.click('#btn-dive');
await pg.waitForTimeout(600);
const restart = await pg.evaluate(async () => {
  const s1 = S.screen, d1 = S.run && S.run.depth;
  const x0 = P.x;
  // 移動入力をシミュレート
  keys['d'] = 1;
  await new Promise(r => setTimeout(r, 600));
  keys['d'] = 0;
  return { screen: s1, depth: d1, moved: Math.abs(P.x - x0) > 0.3, hp: Math.round(S.hero.hpNow) };
});

await b.close();
console.log(JSON.stringify({ errs, conn, rarity, upgrades, shop, auto, death, restart }, null, 2));
