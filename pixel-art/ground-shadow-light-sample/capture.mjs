import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.cwd(), 'proto', '_h.mjs'));
const { chromium } = require('playwright');
const frames = [
  { name: 'right', x: 1, y: 0 },
  { name: 'down',  x: 0, y: 1 },
  { name: 'left',  x:-1, y: 0 },
  { name: 'up',    x: 0, y:-1 },
];

const frameDir = path.join(here, 'frames');
fs.rmSync(frameDir, { recursive: true, force: true });
fs.mkdirSync(frameDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:8769/index.html?ground-shadow-sample');
await page.waitForTimeout(500);

await page.evaluate(() => {
  S.hero = newHero(); startRun(1); W.seen.forEach(row => row.fill(1));
  const room = W.fl.rooms.find(room => room.w >= 7 && room.h >= 7);
  // A bright review floor makes the dark grounding shadow readable at a glance.
  W.fl.zone = {...W.fl.zone, floor:'#75859b', wall:'#253142', edge:'#45566c', dot:'#94a4b8', lightR:44};
  P.x = room.x + 3.5; P.y = room.y + 3.5; P.target = null; P.cd = 999; P.swing = 0; P.dash = null;
  const enemy = W.enemies.find(enemy => !enemy.boss && !enemy.undying);
  enemy.x = P.x + 1.65; enemy.y = P.y - .12; enemy.hp = enemy.maxHp; enemy.cd = 999; enemy.cast = 0;
  W.enemies = [enemy];
  const ally = makeAlly(1, S.hero, 'warrior');
  ally.x = P.x - 1.45; ally.y = P.y + .42; ally.hpNow = allyStats(ally).maxHp; ally.cd = 999;
  S.hero.party = [ally];
  W.fx = []; FEEL.weaponArts = []; FEEL.hits = []; FEEL.motes = [];
  // The capture is a lighting study, so retain the real renderer while freezing simulation effects.
  window.update = () => {};
  // Keep the game lighting itself, but omit the peripheral vignette in this cropped review export.
  window.drawFeelVignette = () => {};
});

for (let index = 0; index < frames.length; index++) {
  const frame = frames[index];
  await page.evaluate(({ x, y }) => {
    P.dirx = x; P.diry = y; P.moving = false;
    FEEL.lightX = x; FEEL.lightY = y; W.fx = []; FEEL.weaponArts = []; FEEL.hits = []; draw();
  }, frame);
  await page.screenshot({
    path: path.join(frameDir, `${String(index).padStart(2, '0')}-${frame.name}.png`),
    clip: { x: 250, y: 205, width: 400, height: 300 },
  });
}
await browser.close();
