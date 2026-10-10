// 画面の記号がドット絵になっていること（ui-icons.js）。
//
// きっかけは要望「アイコンなどの代わりに絵文字を使っているアイコンを
// ピクセルアートのアイコンに変更しておいて」。
//
// 絵文字は端末のフォントで描かれるので、ドット絵の盤面の横に
// つるっとした絵が並び、しかも端末ごとに形が違う。全部こちらの絵に置き換えた。
//
// 描き方の決まりは ui-icons.js の頭に書いた。ここはその見張り番。
//   ・1枚 = 16行×16文字、1枚に8色まで（輪郭込み。第3版で6→8に緩めた）
//   ・輪郭 '1' は全アイコン共通の色（炎のように縁まで光る物だけ差し替え可）
//   ・**左右対称にすべき物は、形が左右対称**（陰影は光の向きがあるので別）
//   ・描いた升目そのものが対称であること。読み込み側が直してしまうと
//     「半分だけ描いた絵」に気づけないので、直した跡が残っていたら落とす。
//
// ここで見るのは8つ。
//   0) 升目そのものに不備が無い（行数・長さ・色数・左右のずれ）
//   1) 焼き込みが全部できている（名前の数だけ data: URL があり、中身が空でない）
//   2) **index.html が呼んでいる pi-○○ が、全部ちゃんと在る。**
//      綴りを1文字間違えるとその場所だけ無言で消える——見た目の事故なので
//      走らせているだけでは気づけない。ここが一番大事。
//   3) 盤面（canvas）に置く名前も在る（イベントの pic / 交差した剣 / 鍛冶場 / 閃き）
//   4) 持ち物の絵は item-icons.js から借りられている（二重に描かない）
//   5) 画面に出ている文字の中に絵文字が残っていない
import { boot, install, done } from './_h.mjs';
import fs from 'fs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ============ 0. 升目そのものに不備が無い ============
   ui-icons.js は読み込みながら不備を problems に貯める。
   ここが空でないということは、絵が1枚壊れている。 */
R.grids = await pg.evaluate(()=>{
  const d=UI_ICONS.defs, names=Object.keys(d);
  const tooMany=names.filter(k=>d[k].colors>8).map(k=>k+':'+d[k].colors);
  /* 対称を名乗っている物は、**焼いたあとの形**も必ず左右対称 */
  const broken=names.filter(k=>{
    if(!d[k].sym) return false;
    const g=d[k].g;
    for(let y=0;y<16;y++) for(let x=0;x<8;x++)
      if(!!g[y][x] !== !!g[y][15-x]) return true;
    return false;
  });
  /* 空っぽの升目（描き忘れ） */
  const empty=names.filter(k=>!d[k].g.some(r=>r.some(c=>c)));
  const symCount=names.filter(k=>d[k].sym).length;
  return {problems:UI_ICONS.problems, tooMany, broken, empty, symCount,
          ok: UI_ICONS.problems.length===0 && tooMany.length===0
              && broken.length===0 && empty.length===0 && symCount>=20};
});

/* ============ 1. 焼き込みが全部できている ============ */
R.baked = await pg.evaluate(()=>{
  const n=UI_ICONS.names;
  const missing=n.filter(k=>!UI_ICONS.url[k] || UI_ICONS.url[k].length<200);
  const notReady=n.filter(k=>!UI_ICONS.imgs[k] || !UI_ICONS.imgs[k].complete);
  const styled=n.filter(k=>{
    const e=document.createElement('i'); e.className='pi pi-'+k;
    document.body.appendChild(e);
    const bg=getComputedStyle(e).backgroundImage; e.remove();
    return bg && bg!=='none';
  });
  return {count:n.length, missing, notReady, styledCount:styled.length,
          ok: n.length>=30 && missing.length===0 && notReady.length===0
              && styled.length===n.length};
});

/* ============ 2. index.html が呼んでいる名前が全部在る ============ */
const used = [...new Set(
  fs.readFileSync('proto/index.html','utf8').match(/pi-[a-z_0-9]+/g) || []
)].map(s=>s.slice(3)).sort();
R.namesUsed = await pg.evaluate(u=>{
  const have=new Set(UI_ICONS.names);
  const unknown=u.filter(k=>!have.has(k));
  return {used:u.length, unknown, ok: u.length>=20 && unknown.length===0};
}, used);

/* ============ 3. 盤面に置く名前も在る ============
   ここは CSS を通らないので、名前を間違えても <i> のときのように
   「四角が出る」すらならない。黙って何も描かれないだけ。 */
R.canvasNames = await pg.evaluate(()=>{
  const want = EVENTS.map(e=>e.pic).concat(['swords','forge','bulb']);
  const c=document.createElement('canvas').getContext('2d');
  const bad=want.filter(k=>!k || !UI_ICONS.draw(c,k,20,20,16));
  return {want, bad, ok: bad.length===0};
});

/* ============ 4. 持ち物の絵は item-icons.js から借りている ============ */
R.itemsBorrowed = await pg.evaluate(()=>{
  const some=['sword','buckler','armor','ring','potion'];
  const got=some.map(k=>UI_ICONS.itemHtml(k));
  const empty=some.filter((k,i)=>!got[i]);
  // 借り物なので、ui-icons 側に同じ名前を作っていないこと（作ると必ず食い違う）
  const duped=some.filter(k=>UI_ICONS.names.includes(k));
  return {empty, duped, ok: empty.length===0 && duped.length===0};
});

/* ============ 4-b. 技ボタンの白黒アイコンが全部そろっている ============
   ボタンには名札も秒数も出さないので、絵が欠けると何の技か分からなくなる。
   大技・武器技・衝撃波の全部に 16×16 の格子があること。 */
R.skillIcons = await pg.evaluate(()=>{
  const ids=[...ULTS.map(u=>u.id), ...Object.values(WEAPON_ARTS).flat().map(d=>d.id), 'wave'];
  const missing=ids.filter(id=>!SKILL_ICON_GRID[id]);
  const badSize=Object.entries(SKILL_ICON_GRID).filter(([k,g])=>g.length!==16 || g.some(r=>r.length!==16)).map(([k])=>k);
  const blank=ids.filter(id=>SKILL_ICON_GRID[id] && !SKILL_ICON_GRID[id].join('').includes('#'));
  const url=skillIconUrl('iai');
  return {count:ids.length, missing, badSize, blank, makesPng: url.indexOf('data:image/png')>=0,
          ok: missing.length===0 && badSize.length===0 && blank.length===0 && url.indexOf('data:image/png')>=0};
});

/* ============ 5. 画面の文字に絵文字が残っていない ============
   絵柄のある絵文字だけを見る。矢印や記号（→ ★ ✹ ✳ ❦）は文字として使っているので
   外す——技の印は端末に依らない記号で揃えてあり、置き換えの対象ではない。
   その技の印そのものを出す #ult-icon / #art-icon も、同じ理由で見ない。 */
R.noEmojiLeft = await pg.evaluate(async ()=>{
  const EM=/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  const SKIP=new Set(['ult-icon','art-icon']);
  const hits=[];
  const scan=(where)=>{
    document.querySelectorAll('body *').forEach(n=>{
      if(n.children.length) return;                 // 葉だけ見る
      if(n.tagName==='SCRIPT'||n.tagName==='STYLE') return;
      if(SKIP.has(n.id)) return;
      const t=(n.textContent||'').trim(); if(!t) return;
      const m=t.match(EM); if(m) hits.push(where+':'+n.id+':'+t.slice(0,20));
    });
  };
  setScreen('town'); scan('街');
  TH.run(3,{seed:12}); setScreen('game'); TH.immortal();
  // ログ・足元の案内・巡回者の帯を一度出しておく
  log('<i class="pi pi-warn"></i> 見本');
  S.run.darkT = INTRUDER_AFTER-20;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  scan('盤面');
  return {hits, ok: hits.length===0};
});

/* ============ 6. キャンバスへ渡す文字にタグを混ぜていない ============
   ログ（innerHTML）には <i class="pi …"> を置けるが、
   **帯・頭上の文字・盤面の名札はキャンバスに文字を描くだけ**なので、
   同じ文字列を渡すとタグがそのまま画面に出る。実際に一度やった
   （閃いた時の帯が「<i class="pi pi-bulb"></i> 居合」になっていた）。
   遺物の印は帯にも出るので、記号1文字のままにしてある。 */
{
  const src = fs.readFileSync('proto/index.html','utf8').split('\n');
  const canvasCalls = /(showBanner|toast|label|sayArt)\s*\(|txt\s*:/;
  const leaks = src.map((l,i)=>[i+1,l])
    .filter(([,l])=> l.includes('pi pi-') && canvasCalls.test(l))
    .map(([n,l])=> n+': '+l.trim().slice(0,70));
  R.noTagsOnCanvas = {leaks, ok: leaks.length===0};
}
R.relicIconsArePlain = await pg.evaluate(()=>{
  const bad=RELICS.filter(r=>!r.icon || r.icon.indexOf('<')>=0 || [...r.icon].length>2)
                  .map(r=>r.id+':'+r.icon);
  return {bad, ok: bad.length===0};
});
/* 画面に出ている文字の中に、タグがそのまま残っていないこと（textContent への取り違え） */
R.noRawTagText = await pg.evaluate(()=>{
  const hits=[];
  document.querySelectorAll('body *').forEach(n=>{
    if(n.children.length || n.tagName==='SCRIPT' || n.tagName==='STYLE') return;
    const t=n.textContent||'';
    if(t.indexOf('<i class=')>=0) hits.push(n.id+':'+t.trim().slice(0,30));
  });
  return {hits, ok: hits.length===0};
});

/* 実際にキャンバスへ渡った文字にタグが無いこと。熟練の帯に武器のアイコン（<i …>）が混ざり、
   データURL込みのタグが「謎の英文字列」として出ていた（報告）。 */
R.canvasTextHasNoTags = await pg.evaluate(()=>{
  TH.run(3,{seed:12}); setScreen('game'); TH.immortal();
  // 熟練の帯（剣で熟練を1段上げる）に、タグが入っていない
  S.mastery={}; gainMastery('sword', masteryNeed(1));
  const title=(_banner&&_banner.title)||'';
  // 描く所の砦：タグ付きの文字を描いても、タグ無しと同じ絵になる
  const pix=t=>{ const c=document.createElement('canvas'); c.width=120; c.height=30; const x=c.getContext('2d');
    x.font='16px sans-serif'; x.fillStyle='#fff'; x.fillText(t,4,20); return c.toDataURL(); };
  const same = pix('<i class="pi" style="background-image:url(data:x)"></i> 剣')===pix('剣');
  return {title, same, ok: title.indexOf('<')<0 && title.indexOf('熟練')>=0 && same};
});

await done(b, errs, R);
