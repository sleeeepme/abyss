// タイトル画面と名前入力。
//
// **このスイートだけは _h.mjs の install() を通さない。**
// install() はタイトルを跨いで拠点まで進めてしまうので、
// それを使うと「起動直後に何が映っているか」を永久に確かめられなくなる。
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(350);
const R={};
const tap=async(sel)=>{ const l=pg.locator(sel).first();
  await l.scrollIntoViewIfNeeded({timeout:3000}); await l.tap({timeout:3000});
  await pg.waitForTimeout(220); };

/* ================= 1. 起動直後 ================= */

// 1-a. 拠点ではなくタイトルが映っている。主人公はまだ存在しない
R.bootsToTitle = await pg.evaluate(()=>{
  const on = id => document.getElementById(id).classList.contains('on');
  return {screen:S.screen, title:on('scr-title'), townHidden: !on('scr-town'),
          noHeroYet: S.hero===null || S.hero===undefined,
          ok: S.screen==='title' && on('scr-title') && !on('scr-town')};
});

// 1-b. 置いてあるのは「冒険に出る」と「遊び方」だけ
R.twoButtons = await pg.evaluate(()=>{
  const btns=[...document.querySelectorAll('#scr-title button')].map(x=>x.textContent.trim());
  return {btns, count:btns.length,
          ok: btns.length===2 && btns[0].includes('冒険') && btns[1].includes('遊び方')};
});

// 1-c. タイトルには広告バナーを出さない（最初に見る画面を広告で始めない）
R.noBanner = await pg.evaluate(()=>{
  syncAdBar();
  return {hidden: !document.getElementById('adbar').classList.contains('on'),
          ok: !document.getElementById('adbar').classList.contains('on')};
});

/* ================= 2. 名前を決めて拠点へ ================= */

// 2-a. 「冒険に出る」で名前の入力が出る（拠点にはまだ行かない）
await tap('#t-start');
R.opensNameEntry = await pg.evaluate(()=>{
  const on = id => document.getElementById(id).classList.contains('on');
  return {nameModal:on('m-name'), stillTitle:S.screen==='title', noHero: !S.hero,
          ok: on('m-name') && !S.hero};
});

// 2-b. 「おまかせ」で名前が埋まる
await tap('#nm-roll');
R.randomName = await pg.evaluate(()=>{
  const v=document.getElementById('nm-input').value;
  return {value:v, filled:v.length>0, ok: v.length>0};
});

// 2-c. 入力して決定すると、その名前で拠点に入る
await pg.fill('#nm-input', 'ヨシダ');
await tap('#nm-ok');
R.entersTown = await pg.evaluate(()=>{
  const on = id => document.getElementById(id).classList.contains('on');
  return {screen:S.screen, town:on('scr-town'), nameModalClosed: !on('m-name'),
          saved:S.name, heroName:S.hero&&S.hero.name,
          ok: S.screen==='town' && S.name==='ヨシダ' && S.hero.name==='ヨシダ'};
});

// 2-d. 拠点にバナーは戻る（タイトルだけの除外であること）
R.bannerInTown = await pg.evaluate(()=>{
  syncAdBar();
  return {shown: document.getElementById('adbar').classList.contains('on'),
          ok: document.getElementById('adbar').classList.contains('on')};
});

/* ================= 3. 名前は代を重ねる ================= */

/* 3-a. 死んで作り直しても名前は消えない。二代目・三代目と続く。
       ここが「名前を1回だけ聞く」ことの理由で、
       毎回聞かれると、その名前は使い捨ての入力欄になってしまう。 */
R.generations = await pg.evaluate(()=>{
  S.name='ヨシダ';
  const g=[];
  for(let d=0; d<4; d++){ S.deaths=d; g.push(heroName()); }
  S.deaths=0;
  return {names:g,
          first:g[0]==='ヨシダ',
          second:g[1].includes('二代目'),
          fourth:g[3].includes('四代目'),
          ok: g[0]==='ヨシダ' && g[1].includes('二代目') && g[3].includes('四代目')};
});

// 3-b. 空欄で決めたら「冒険者」になる（名無しにはしない）
R.blankFallback = await pg.evaluate(()=>{
  S.name=''; S.deaths=0;
  document.getElementById('nm-input').value='   ';
  confirmName();
  return {saved:S.name, hero:S.hero.name, ok: S.name==='冒険者'};
});

/* ================= 4. 戻り道 ================= */

/* 4-a. 既に冒険が始まっていれば、名前は聞き直さない。
       ここは**実際にタップして**確かめる（連打ガードがあるので間を置く）。 */
await pg.evaluate(()=>{ S.name='ヨシダ'; S.hero=newHero(); S.deepest=12; setScreen('title'); });
await pg.waitForTimeout(800);
const startLabel = await pg.evaluate(()=>el('t-start').textContent);
await tap('#t-start');
R.noReAsk = await pg.evaluate(l=>{
  const on = id => document.getElementById(id).classList.contains('on');
  return {label:l, notAskedAgain: !on('m-name'), screen:S.screen,
          saysContinue: l.includes('続ける'),
          ok: !on('m-name') && S.screen==='town' && l.includes('続ける')};
}, startLabel);

// 4-b. データ全消去でタイトルに戻り、名前も消える
await pg.waitForTimeout(800);
await pg.evaluate(()=>{ S.deepest=30; S.deaths=5; S.name='ヨシダ'; });
await tap('#btn-reset');
R.resetToTitle = await pg.evaluate(()=>{
  return {screen:S.screen, nameCleared: !S.name, heroCleared: !S.hero, deepest:S.deepest,
          ok: S.screen==='title' && !S.name && !S.hero && S.deepest===1};
});

/* 4-c. 記録があるとタイトルの足元に出る。
       無いうちは**何も書かない**——操作の説明は「遊び方」の中にあり、
       押す前に読ませても、まだ何のことか分からない。 */
R.footRecord = await pg.evaluate(()=>{
  S.deepest=1; S.deaths=0; S.name='';
  renderTitle();
  const fresh=document.getElementById('t-foot').textContent.trim();
  S.deepest=23; S.deaths=4; S.name='ヨシダ';
  renderTitle();
  const played=document.getElementById('t-foot').textContent;
  return {fresh, played,
          freshIsEmpty: fresh==='',
          playedShowsDepth: played.includes('23'),
          ok: fresh==='' && played.includes('23')};
});

await b.close();
console.log(JSON.stringify({errs, R}, null, 2));
