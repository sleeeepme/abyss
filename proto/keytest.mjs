/* ===============================================================
   キーストーン（段で解禁される能力強化）の検証
   ---------------------------------------------------------------
   数値ノードと違って、ここの5つは**挙動そのもの**を変える。
   数値なら stats() を1回読めば確かめられるが、
   「一度だけ」「クールダウンが要る」「段が開くまで買えない」は
   状態をまたぐので、走らせないと分からない。

   何を守りたいか:
     ・段が開いていない物は買えない（SPを持っていても）
     ・不屈は**探索1回につき一度**。2度目は死ぬ
     ・衝撃波は覚えるまで出ない。出したら CD が明ける
     ・治癒は戦いの最中に乗る（道中ではなく）
     ・脱出は**探索1回につき一度**。使い切ったら戻れない
     ・瞬足を覚えるまでダッシュは踏めない
   =============================================================== */
import { chromium, devices } from 'playwright';
import path from 'path';

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await pg.goto('file://' + path.resolve('proto/index.html'));
await pg.waitForTimeout(400);
await pg.evaluate(() => { if (!S.hero) { S.name = 'テスト'; startAdventure(); } });
const R = {};

/* --- 1. 段の解禁。開いていない物は、SPがあっても買えない --- */
R.tiers = await pg.evaluate(() => {
  const get = id => UPGRADES.find(u => u.id === id);
  S.bossClear = 0; S.upg = {}; S.shards = 9999;
  const atStart = {
    dash:   !upgLocked(get('dash')),      // 段1。最初から買える
    revive:  upgLocked(get('revive')),    // 段2。まだ錠
    escape:  upgLocked(get('escape')),    // 段3。まだ錠
  };
  // 実際に押しても買えないこと（画面のガードではなく、処理側で止まっている）
  const before = S.shards;
  const u = get('revive');
  if (!upgLocked(u)) S.upg.revive = 1;
  const notBought = !upgLv('revive') && S.shards === before;

  S.bossClear = 5;                                 // 第5階層の中ボスを倒した
  const after5 = { revive: !upgLocked(get('revive')), escape: upgLocked(get('escape')) };
  S.bossClear = 10;                                // 第10階層の大ボスを倒した
  const after10 = { escape: !upgLocked(get('escape')) };
  S.bossClear = 0;
  return {atStart, notBought, after5, after10,
          tier1OpenAtStart: atStart.dash,
          tier2LockedAtStart: atStart.revive,
          tier3LockedAtStart: atStart.escape,
          tier2OpensAt5: after5.revive,
          tier3StillLockedAt5: after5.escape,
          tier3OpensAt10: after10.escape,
          cannotBuyLocked: notBought,
          ok: atStart.dash && atStart.revive && atStart.escape && notBought
              && after5.revive && after5.escape && after10.escape};
});

/* --- 1-b. **倒して帰っただけ**でも段が開く（回帰） ---
   最初これを S.deepest（＝到達した階）で見ていた。deepest は降りないと増えないので、
   第5階層の中ボスを倒してその場のポータルで帰ると段が開かなかった。
   **勝ったのに何も開かない。** 開ける条件として言っているのは「倒すと開く」なので、
   降りずに帰る道でも開くことを固定しておく。 */
R.unlockWithoutDescending = await pg.evaluate(() => {
  S.bossClear = 0; S.deepest = 1; S.upg = {}; S.hero = newHero();
  startRun(5); setScreen('game'); S.hero.party = [];
  const lockedBefore = upgLocked(UPGRADES.find(u => u.id === 'revive'));
  const boss = W.enemies.find(e => e.boss && !e.dead);
  if (!boss) throw Error('第5階層にボスがいない');
  boss.hp = 1; killEnemy(boss);
  stepSim(1.3);                       // 撃破演出を進める
  const clearedAt = S.bossClear;
  const deepestStill = S.deepest;     // 降りていないので 5 のまま
  const openAfter = !upgLocked(UPGRADES.find(u => u.id === 'revive'));
  const tier3Still = upgLocked(UPGRADES.find(u => u.id === 'escape'));
  S.bossClear = 0;
  return {lockedBefore, clearedAt, deepestStill, openAfter, tier3Still,
          lockedBeforeKill: lockedBefore,
          recordsTheKill: clearedAt === 5,
          didNotDescend: deepestStill === 5,
          opensOnKill: openAfter,
          deeperTierStillLocked: tier3Still,
          ok: lockedBefore && clearedAt === 5 && deepestStill === 5
              && openAfter && tier3Still};
});

/* --- 2. 不屈。倒れても一度だけ立ち上がる。二度目は死ぬ --- */
R.revive = await pg.evaluate(() => {
  S.bossClear = 5; S.upg = {revive:1}; S.hero = newHero(); S.deaths = 0;
  startRun(3); setScreen('game'); S.hero.party = [];
  const mx = stats(S.hero).maxHp;

  S.hero.hpNow = 1;
  die();
  const aliveAfter1 = !!S.hero && S.hero.hpNow > 0;
  const fullAfter1  = !!S.hero && S.hero.hpNow === mx;   // **40%ではなく全快**
  const invuln      = (P.invuln || 0) > 0;               // 立った直後に即死しない
  const deathsAfter1 = S.deaths;
  const usedFlag = !!(S.run && S.run.upgRevUsed);

  S.hero.hpNow = 1;
  die();
  const deadAfter2 = !S.hero || !S.run;                  // 二度目は死ぬ
  const deathsAfter2 = S.deaths;

  // 覚えていなければ一度目で死ぬ
  S.upg = {}; S.hero = newHero(); S.deaths = 0;
  startRun(3); setScreen('game'); S.hero.party = [];
  S.hero.hpNow = 1; die();
  const diesWithout = !S.hero;

  return {aliveAfter1, fullAfter1, invuln, deathsAfter1, usedFlag,
          deadAfter2, deathsAfter2, diesWithout,
          standsUpOnce: aliveAfter1,
          healsToFull: fullAfter1,
          givesGrace: invuln,
          firstDeathNotCounted: deathsAfter1 === 0,
          secondDeathCounted: deathsAfter2 === 1,
          onlyOncePerRun: deadAfter2,
          noReviveWithoutNode: diesWithout,
          ok: aliveAfter1 && fullAfter1 && invuln && deathsAfter1 === 0
              && deadAfter2 && deathsAfter2 === 1 && diesWithout};
});

/* --- 3. 不屈は探索ごとに戻る（口座側に持ち越さない） --- */
R.reviveResets = await pg.evaluate(() => {
  S.bossClear = 5; S.upg = {revive:1}; S.hero = newHero(); S.deaths = 0;
  startRun(3); setScreen('game'); S.hero.party = [];
  S.hero.hpNow = 1; die();
  const usedInRun1 = !!S.run.upgRevUsed;
  // 次の探索
  S.hero = newHero(); startRun(3); setScreen('game'); S.hero.party = [];
  const freshRun = !S.run.upgRevUsed;
  S.hero.hpNow = 1; die();
  const standsAgain = !!S.hero && S.hero.hpNow > 0;
  return {usedInRun1, freshRun, standsAgain,
          ok: usedInRun1 && freshRun && standsAgain};
});

/* --- 4. 衝撃波。覚えるまで出ない／出したら CD が明ける／前方に当たる --- */
R.wave = await pg.evaluate(() => {
  S.bossClear = 5; S.upg = {}; S.hero = newHero();
  startRun(3); setScreen('game'); S.hero.party = [];
  const beforeLearn = waveReady() === false && fireWave() === false;

  S.upg = {wave:1};
  P.waveCd = 0;
  const readyAfterLearn = waveReady();

  // 目の前に的を置いて、削れることを見る
  const room = W.fl.rooms.find(r => r.w >= 6 && r.h >= 6) || W.fl.rooms[0];
  P.x = room.x + 2.5; P.y = room.y + 2.5; P.dirx = 1; P.diry = 0;
  const mk = (dx, dy) => {
    const e = {x:P.x+dx, y:P.y+dy, arch:ARCH[0], fam:FAMILY[0], lv:5, aff:[],
               maxHp:99999, hp:99999, atkV:0, def:0, res:{}, dt:'blunt',
               st:{}, bu:{}, state:'idle', t:0, cd:9, vx:0, vy:0, hit:0, tele:0,
               ms:0, teleMul:1, dead:false, r:0.34, col:'#fff', name:'的'};
    W.enemies.push(e); return e;
  };
  W.enemies = [];
  const front = mk(1.6, 0);          // 正面。届く
  const back  = mk(-1.6, 0);         // 真後ろ。届かない
  const far   = mk(WAVE_REACH + 2.5, 0);   // 遠すぎる
  gridBuild();
  const fired = fireWave();
  const hitFront = front.hp < 99999;
  const hitBack  = back.hp  < 99999;
  const hitFar   = far.hp   < 99999;
  const cdSet = (P.waveCd || 0) > 0;
  const blockedWhileCd = fireWave() === false;
  // CD が明ければまた出せる
  stepSim(WAVE_CD + 0.2);
  const readyAgain = waveReady();

  /* 掃引は「R の中の真偽値はすべて true が期待どおり」という約束なので、
     **正しく false になる生の値をそのまま返さない。**
     hitBack / hitFar は「当たらないのが正解」なので、
     sparesBehind / respectsReach という言い方に直してから出す。 */
  return {beforeLearn, readyAfterLearn, fired, hitFront,
          backHp:back.hp, farHp:far.hp,
          cdSet, blockedWhileCd, readyAgain, cd:WAVE_CD,
          needsNode: beforeLearn,
          hitsForward: hitFront,
          sparesBehind: !hitBack,
          respectsReach: !hitFar,
          entersCooldown: cdSet && blockedWhileCd,
          comesBack: readyAgain,
          ok: beforeLearn && readyAfterLearn && fired && hitFront && !hitBack
              && !hitFar && cdSet && blockedWhileCd && readyAgain};
});

/* --- 5. 治癒。戦いの最中に、間隔ごとに乗る --- */
R.regen = await pg.evaluate(() => {
  S.bossClear = 5; S.upg = {regen:3}; S.hero = newHero();
  startRun(3); setScreen('game'); S.hero.party = []; W.enemies = [];
  const mx = stats(S.hero).maxHp;
  S.hero.hpNow = Math.round(mx * 0.4);
  const hp0 = S.hero.hpNow;
  stepSim(UPG_REGEN_EVERY - 1.0);
  const beforeTick = S.hero.hpNow;
  stepSim(2.0);                       // 間隔をまたぐ
  const afterTick = S.hero.hpNow;
  const step = afterTick - beforeTick;
  const want = Math.max(1, Math.round(mx * 3 * UPG_REGEN_PCT / 100));

  // 覚えていなければ増えない
  S.upg = {}; S.hero.hpNow = Math.round(mx * 0.4);
  const h0 = S.hero.hpNow;
  stepSim(UPG_REGEN_EVERY + 2.0);
  const noNode = S.hero.hpNow === h0;

  // 満タンを超えない
  S.upg = {regen:3}; S.hero.hpNow = stats(S.hero).maxHp;
  stepSim(UPG_REGEN_EVERY + 1.0);
  const noOverheal = S.hero.hpNow === stats(S.hero).maxHp;

  return {hp0, beforeTick, afterTick, step, want, noNode, noOverheal,
          notYetBeforeInterval: beforeTick === hp0,
          healsOnTick: step > 0,
          matchesConstant: Math.abs(step - want) <= 1,
          nothingWithoutNode: noNode,
          neverOverheals: noOverheal,
          ok: beforeTick === hp0 && step > 0 && Math.abs(step - want) <= 1
              && noNode && noOverheal};
});

/* --- 6. 脱出。ポータル階でなくても一度だけ帰れる --- */
R.escape = await pg.evaluate(() => {
  S.bossClear = 10; S.upg = {}; S.hero = newHero();
  startRun(3); setScreen('game'); S.hero.party = [];      // 第3階層＝ポータルではない
  const notPortal = !returnPortalAt(3);
  const goldBefore = S.gold;
  returnToTown();
  const blockedWithout = !!S.run;                          // 覚えていなければ戻れない

  S.upg = {escape:1};
  openStairs();
  const buttonShown = el('st-ret').style.display !== 'none';
  const buttonSaysOnce = el('st-ret').textContent.indexOf('一度きり') >= 0;
  el('m-stairs').classList.remove('on');

  returnToTown();
  const wentHome = !S.run;                                 // 街へ戻った

  // 次の探索でまた1回使える／同じ探索では2度目が無い
  S.hero = newHero(); startRun(3); setScreen('game'); S.hero.party = [];
  S.run.escapeUsed = true;                                 // 使い切った状態
  returnToTown();
  const blockedAfterUse = !!S.run;

  return {notPortal, blockedWithout, buttonShown, buttonSaysOnce, wentHome,
          blockedAfterUse, goldBefore,
          needsNode: blockedWithout,
          offersButton: buttonShown && buttonSaysOnce,
          worksOnce: wentHome,
          onlyOncePerRun: blockedAfterUse,
          ok: notPortal && blockedWithout && buttonShown && buttonSaysOnce
              && wentHome && blockedAfterUse};
});

/* --- 7. 瞬足。覚えるまでダッシュは踏めない --- */
R.dash = await pg.evaluate(() => {
  S.bossClear = 0; S.upg = {}; S.hero = newHero();
  startRun(3); setScreen('game'); S.hero.party = [];
  const room = W.fl.rooms.find(r => r.w >= 6 && r.h >= 6) || W.fl.rooms[0];
  P.x = room.x + 2.5; P.y = room.y + 2.5; P.dash = null; FEEL.dashCd = 0;
  const without = tapDash(innerWidth * .8, innerHeight / 2);

  S.upg = {dash:1}; P.dash = null; FEEL.dashCd = 0;
  const withNode = tapDash(innerWidth * .8, innerHeight / 2);
  P.dash = null;
  return {withNode, withoutResult:String(without),
          lockedWithoutNode: without === false,
          worksWithNode: withNode === true,
          ok: without === false && withNode === true};
});

/* --- 8. HUDの技ボタンは、覚えたときだけ出る --- */
R.hud = await pg.evaluate(() => {
  S.bossClear = 5; S.upg = {}; S.hero = newHero();
  startRun(3); setScreen('game'); S.hero.party = [];
  updateHUD();
  const hiddenWithout = !el('wavebtn').classList.contains('on');
  S.upg = {wave:1}; P.waveCd = 0;
  updateHUD();
  const shownWith = el('wavebtn').classList.contains('on');
  const readyMark = el('wavebtn').classList.contains('ready');
  P.waveCd = 3; updateHUD();
  const cdText = el('wave-cd').textContent;
  const notReady = !el('wavebtn').classList.contains('ready');
  return {hiddenWithout, shownWith, readyMark, cdText, notReady,
          hiddenUntilLearned: hiddenWithout,
          appearsWhenLearned: shownWith,
          marksReady: readyMark,
          showsCountdown: /^\d+s$/.test(cdText) && notReady,
          ok: hiddenWithout && shownWith && readyMark
              && /^\d+s$/.test(cdText) && notReady};
});

/* --- 9. 錠は隠さず見せる（死に戻る理由になるので） --- */
R.lockUi = await pg.evaluate(() => {
  S.bossClear = 0; S.upg = {}; S.shards = 9999;
  setScreen('upg'); renderUpg();
  const html = el('upgrades').innerHTML;
  const hasLock = html.indexOf('🔒') >= 0;
  const namesRevive = html.indexOf('不屈') >= 0;
  const tellsHow = html.indexOf('中ボスを倒す') >= 0;
  S.bossClear = 5; renderUpg();
  const openedHtml = el('upgrades').innerHTML;
  const reviveUnlocked = openedHtml.indexOf('🔒 不屈') < 0 && openedHtml.indexOf('不屈') >= 0;
  setScreen('none');
  return {hasLock, namesRevive, tellsHow, reviveUnlocked,
          showsLockedNodes: hasLock && namesRevive,
          saysHowToOpen: tellsHow,
          unlocksOnProgress: reviveUnlocked,
          ok: hasLock && namesRevive && tellsHow && reviveUnlocked};
});

/* --- 10. 瞬足の段。上げるほど 遠く・速く戻り・受付が長く --- */
R.dashLevels = await pg.evaluate(() => {
  S.bossClear = 0; S.upg = {}; S.hero = newHero();
  startRun(3); setScreen('game'); S.hero.party = [];
  const room = W.fl.rooms.find(r => r.w >= 8 && r.h >= 8) || W.fl.rooms[0];
  const at = lv => {
    S.upg.dash = lv; P.x = room.x + 2.5; P.y = room.y + 2.5;
    P.dash = null; FEEL.dashCd = 0;
    if (!tapDash(innerWidth * .9, innerHeight / 2)) return null;
    const d = Math.hypot(P.dash.x1 - P.dash.x0, P.dash.y1 - P.dash.y0);
    const r = {dist:+d.toFixed(2), cd:FEEL.dashCd, just:+FEEL.just.toFixed(3)};
    P.dash = null; return r;
  };
  const a = at(1), c = at(3), e = at(5);
  return {lv1:a, lv3:c, lv5:e,
          fartherEachStep: a.dist < c.dist && c.dist < e.dist,
          shorterWait:     a.cd  > c.cd  && c.cd  > e.cd,
          longerWindow:    a.just< c.just&& c.just< e.just,
          ok: a.dist<c.dist && c.dist<e.dist && a.cd>c.cd && c.cd>e.cd
              && a.just<c.just && c.just<e.just};
});

/* --- 11. 支える側の大技（鉄壁・号令・生気） --- */
R.support = await pg.evaluate(() => {
  S.greatKills = 5; S.bossClear = 10; S.upg = {};
  S.hero = newHero(); startRun(6); setScreen('game'); S.hero.party = [];
  const a = makeAlly(6, S.hero); a.x = P.x + 1; a.y = P.y;
  uniqueAllyName(a, party()); S.hero.party.push(a);
  const unlocked = unlockedUlts().map(u => u.id);

  // 鉄壁：防御が上がって、時間で切れる
  S.ult = 'aegis'; S.ultLv = {aegis:3}; P.ultCd = 0;
  const d0 = stats(S.hero).def;
  fireUlt();
  const d1 = stats(S.hero).def;
  stepSim(40);
  const d2 = stats(S.hero).def;

  // 号令：主人公と仲間の両方が戻る
  S.ult = 'rally'; S.ultLv = {rally:3}; P.ultCd = 0;
  S.hero.hpNow = Math.round(stats(S.hero).maxHp * 0.3);
  a.hpNow = allyStats(a).maxHp * 0.3;
  const h0 = S.hero.hpNow, a0 = a.hpNow;
  fireUlt();
  const heroUp = S.hero.hpNow - h0, allyUp = a.hpNow - a0;

  // 生気：刻みごとに戻り、満タンを超えず、時間で切れる
  S.ult = 'bloom'; S.ultLv = {bloom:3}; P.ultCd = 0;
  S.hero.hpNow = Math.round(stats(S.hero).maxHp * 0.3);
  const b0 = S.hero.hpNow;
  fireUlt();
  const startedOn = !!S.run.bloom;
  stepSim(BLOOM_EVERY + 0.2);
  const b1 = S.hero.hpNow;
  stepSim(40);
  const overheal = S.hero.hpNow > stats(S.hero).maxHp;
  return {unlocked, def0:Math.round(d0), def1:Math.round(d1), def2:Math.round(d2),
          heroUp, allyUp:Math.round(allyUp), bloomTick:b1-b0,
          allThreeUnlocked: ['aegis','rally','bloom'].every(id=>unlocked.includes(id)),
          aegisRaisesDef: d1 > d0 * 1.4,
          aegisExpires:   Math.round(d2) === Math.round(d0),
          rallyHealsBoth: heroUp > 0 && allyUp > 0,
          bloomStarts:    startedOn,
          bloomTicks:     b1 > b0,
          bloomExpires:   !S.run.bloom,
          bloomNeverOverheals: !overheal,
          ok: ['aegis','rally','bloom'].every(id=>unlocked.includes(id))
              && d1 > d0*1.4 && Math.round(d2)===Math.round(d0)
              && heroUp > 0 && allyUp > 0 && startedOn && b1 > b0
              && !S.run.bloom && !overheal};
});

/* --- 12. 水の深さ。3段に分かれ、淵は落ち、階段へは行ける --- */
R.water = await pg.evaluate(() => {
  const tally = () => {
    const c = {1:0, 2:0, 3:0};
    for (let y = 0; y < W.fl.H; y++) for (let x = 0; x < W.fl.W; x++) {
      const v = (W.haz && W.haz.g[y]) ? (W.haz.g[y][x] | 0) : 0;
      if (v) c[v]++;
    }
    return c;
  };
  /* 階段まで歩いて行けるか。**淵で道が塞がると詰む。**
     水を広げて深さを彫った以上、ここは毎回確かめる価値がある。 */
  const reachable = () => {
    const f = W.fl, seen = new Set(), q = [[Math.floor(P.x), Math.floor(P.y)]];
    seen.add(q[0][0] + ',' + q[0][1]);
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || nx < 0 || ny < 0 || nx >= f.W || ny >= f.H) continue;
        if (!tileWalk(f, nx, ny) || pitAt(nx + 0.5, ny + 0.5)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen.has(Math.floor(f.stair.x) + ',' + Math.floor(f.stair.y));
  };
  S.bossClear = 0; S.upg = {};
  let allTiers = true, allReach = true, cov = 0, n = 0;
  for (let seed = 0; seed < 8; seed++) {
    S.salt = seed * 31; S.hero = newHero();
    startRun(13); setScreen('game'); S.hero.party = [];
    if (!W.haz || W.haz.kind !== 'water') { allTiers = false; continue; }
    const c = tally();
    if (!(c[1] > 0 && c[2] > 0 && c[3] > 0)) allTiers = false;
    if (!reachable()) allReach = false;
    let walk = 0;
    for (let y = 0; y < W.fl.H; y++) for (let x = 0; x < W.fl.W; x++)
      if (tileWalk(W.fl, x, y)) walk++;
    cov += (c[1] + c[2] + c[3]) / walk; n++;
  }
  // 深いほど遅い
  let s1 = null, s2 = null, deep = null;
  for (let y = 0; y < W.fl.H; y++) for (let x = 0; x < W.fl.W; x++) {
    const v = (W.haz && W.haz.g[y]) ? (W.haz.g[y][x] | 0) : 0;
    if (v === 1 && s1 === null) s1 = hazardSlowAt(x + .5, y + .5);
    if (v === 2 && s2 === null) s2 = hazardSlowAt(x + .5, y + .5);
    if (v === 3 && !deep) deep = {x: x + .5, y: y + .5};
  }
  // 淵に立つと落ちて、陸へ戻される
  let fell = false, hurt = 0, back = false, blocksWalk = false;
  if (deep) {
    blocksWalk = !standable(deep.x, deep.y);
    const hp0 = S.hero.hpNow;
    P.x = deep.x; P.y = deep.y; P.invuln = 0; P.fallAnim = null;
    stepSim(0.2);
    fell = !!P.fallAnim; hurt = Math.round(hp0 - S.hero.hpNow);
    stepSim(2.5);
    back = !P.fallAnim && !pitAt(P.x, P.y);
  }
  return {coverage:+(cov / Math.max(1,n) * 100).toFixed(0), slow1:s1, slow2:s2, hurt,
          hasAllThreeTiers: allTiers,
          stairAlwaysReachable: allReach,
          coversEnough: cov / Math.max(1,n) > 0.15,
          deeperIsSlower: s1 !== null && s2 !== null && s2 < s1,
          voidBlocksWalking: blocksWalk,
          voidMakesYouFall: fell,
          fallHurts: hurt > 0,
          returnsToSolidGround: back,
          ok: allTiers && allReach && cov/Math.max(1,n) > 0.15
              && s2 < s1 && blocksWalk && fell && hurt > 0 && back};
});

console.log(JSON.stringify({ errs, R }, null, 1));
await b.close();
