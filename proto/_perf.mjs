/* ===============================================================
   描画の内訳を測る道具
   ---------------------------------------------------------------
   回帰テスト（sweep）ではない。**合否を出さない。**
   「1フレームの時間が、どの描画にどれだけ使われているか」を並べるだけ。

   ファイル名の頭に _ が付いているのは sweep から外すため
   （proto/_*.mjs は掃引に入らない規約）。

   scaletest が fps を測って落ちたとき、原因の当たりを付けるために使う。
   個別に切って測る引き算は、実測のばらつき（±5fps）に埋もれて効かない。
   足し算で見るほうが早い。

   使い方:
     node proto/_perf.mjs
     node proto/_perf.mjs --depth 26 --seconds 3
   =============================================================== */
import { chromium, devices } from 'playwright';
import path from 'path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const DEPTH   = +arg('depth', 26);
const SECONDS = +arg('seconds', 3);

const b = await chromium.launch();
/* scaletest と同じ端末指定にする。**deviceScaleFactor を落とすと測定にならない。**
   iPhone 13 は DPR 3 で、キャンバスの実ピクセルは 390×844 の9倍ある。
   viewport だけ合わせて DPR を 1 のままにすると、塗りの仕事が 1/9 になり、
   どの階層でも 60fps に張り付いて「重い所は無い」という誤った結論が出る。 */
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('' + e.message));
await pg.goto('file://' + path.resolve('proto/index.html'));
await pg.waitForTimeout(400);

const R = await pg.evaluate(async ({depth, seconds}) => {
  /* 測りたい関数を包んで、呼ばれた回数と合計時間を貯める。
     包む前に元を控えておかないと、2回目以降が二重計上になる。 */
  const T = {};
  const wrap = (name) => {
    const fn = window[name];
    if (typeof fn !== 'function') return false;
    T[name] = { ms:0, n:0 };
    window[name] = function(...a){
      const t = performance.now();
      try { return fn.apply(this, a); }
      finally { T[name].ms += performance.now() - t; T[name].n++; }
    };
    return true;
  };

  const targets = [
    /* まず1フレームを大きく2つに割る。ここを外すと、細かい関数の合計が
       フレーム時間に全然届かず「その他」に9割が残って何も分からない。 */
    'draw',               // 描画すべて
    'update',             // シミュレーションすべて（game-feel.js のラッパ込み）
    'updateFeel',
    'beginFeelWorld',
    'drawPlayerLight',    // 視界の光。101本のレイ×4枚を毎フレーム引き直す
    'drawLivingLiquid',   // 水面。屈折でキャンバスを読み戻している
    'drawLivingDeco',     // 草木・苔・水草
    'drawFeelMotes',      // 土煙・水滴
    'drawFeelRipples',    // 波紋
    'drawFeelVignette',   // 画面外周の暗がり
    'drawFeelAmbient',    // ブラー付きの浮遊粒子
    'drawFeelFlash',      // 被弾の点滅
    'drawFeelSwing',      // 攻撃の軌跡
    'drawFeelMagic',      // 魔弾
    'drawEnemyPixels',    // 撃破のピクセル飛散
    'drawAir',            // 既存の浮遊粒子
    'beginPixelFx',
    'endPixelFx',
    'feelEntityOffset',   // 敵・仲間1体ごとに呼ばれる
    'feelBlink',
    'feelMotion',
  ];
  const missing = targets.filter(n => !wrap(n));

  S.hero=newHero(); S.upg={hp:8,atk:8}; S.hero.lv=45;
  S.hero.str=45; S.hero.dex=45; S.hero.vit=45;
  startRun(depth); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('bow',45,2);
  S.hero.hpNow=1e9;
  W.seen.forEach(r=>r.fill(1));
  stickDx=0.6; stickDy=0.3;

  const t0=performance.now(), c0=_tickCount;
  await new Promise(r=>setTimeout(r, seconds*1000));
  const wall=performance.now()-t0, frames=_tickCount-c0;
  stickDx=0; stickDy=0;

  const rows = Object.entries(T)
    .map(([nm,v]) => ({nm, ms:+v.ms.toFixed(1), perFrame:+(v.ms/frames).toFixed(3),
                       calls:+(v.n/frames).toFixed(1)}))
    .filter(r => r.ms > 0)
    .sort((a,b) => b.ms - a.ms);

  return {depth, frames, fps:+(frames/(wall/1000)).toFixed(1),
          msPerFrame:+(wall/frames).toFixed(2),
          enemies:W.enemies.filter(e=>!e.dead).length,
          zone:W.fl.zone.id, rows, missing};
}, {depth: DEPTH, seconds: SECONDS});

const pad=(s,n)=>String(s).padEnd(n);
const pct=v=>(v/R.msPerFrame*100).toFixed(1)+'%';
const get=n=>R.rows.find(r=>r.nm===n);
const TOP=['draw','update'];

console.log(`\n${R.zone}層 / 第${R.depth}階  敵${R.enemies}体`);
console.log(`${R.fps} fps（1フレーム ${R.msPerFrame} ms、${R.frames}フレーム）\n`);

console.log('■ フレームの内訳');
console.log('-'.repeat(62));
let top=0;
for (const n of TOP){ const r=get(n); if(!r) continue; top+=r.perFrame;
  console.log(pad(r.nm,20)+pad(r.perFrame+' ms',11)+pct(r.perFrame)); }
console.log(pad('rAF の空き',20)+pad((R.msPerFrame-top).toFixed(3)+' ms',11)
          + pct(R.msPerFrame-top) + '  ← 60fps に余裕があれば、ここが残る');

console.log('\n■ その内側（draw / update に含まれる分。合計は上と重なる）');
console.log('-'.repeat(62));
console.log(pad('関数',20)+pad('1フレーム',11)+pad('占有',8)+'呼ばれた回数/フレーム');
for (const r of R.rows){ if(TOP.includes(r.nm)) continue;
  console.log(pad(r.nm,20)+pad(r.perFrame+' ms',11)+pad(pct(r.perFrame),8)+r.calls); }
const inner=R.rows.filter(r=>!TOP.includes(r.nm)).reduce((s,r)=>s+r.perFrame,0);
console.log('-'.repeat(62));
console.log(pad('内訳の計',20)+pad(inner.toFixed(3)+' ms',11)+pad(pct(inner),8));
console.log(pad('名前の付いていない分',20)
          + pad((top-inner).toFixed(3)+' ms',11)+pad(pct(top-inner),8)
          + ' ← draw/update の本体（タイル・敵の描画そのもの）');
if (R.missing.length) console.log('\n⚠ 見つからなかった関数:', R.missing.join(', '));
if (errs.length) console.log('\nerrs:', errs.slice(0,3));

await b.close();
