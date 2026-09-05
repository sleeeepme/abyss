// 設定書（世界観／敵とボス）の命名が、実装に落ちているか。
//
// このスイートの本題は「名前が正しいか」ではなく、**名前の体系が崩れていないか**。
// 個々の名前は設定書を見れば分かるが、体系のほうは
// 一箇所直すたびに静かに崩れる——たとえば敵を1系統足したときに、
// その系統だけ「乾の寄り」のような記号名に戻る、という壊れ方をする。
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ================= 1. 六つの層 ================= */

// 1-a. 石・水・根・跡・鍛冶場・白 が、この順で並んでいる
R.sixStrata = await pg.evaluate(()=>{
  const want=['石の層','水の層','根の層','跡の層','炉の層','白の層'];
  const got=ZONES.map(z=>z.nm);
  return {got, want, ok: JSON.stringify(got)===JSON.stringify(want)};
});

/* 1-b. 協会の登録名を全層が持っている。
       表示名（通り名）と登録名（事務語）の二枚看板が、この世界の命名の根。
       片方しか無い層があると、そこだけ世界が薄くなる。 */
R.everyStratumRegistered = await pg.evaluate(()=>{
  const rows=ZONES.map(z=>({nm:z.nm, reg:z.reg}));
  const missing=ZONES.filter(z=>!z.reg).map(z=>z.id);
  const uniq=new Set(ZONES.map(z=>z.reg)).size===ZONES.length;
  return {rows, missing, uniq, ok: missing.length===0 && uniq};
});

// 1-c. 白の層だけ明かりが極端に広い（＝手前と奥が同じ明るさ＝距離が測れない）
R.paleHasNoDepthCue = await pg.evaluate(()=>{
  const pale=ZONES.find(z=>z.id==='pale');
  const others=ZONES.filter(z=>z.id!=='pale');
  return {paleLight:pale.lightR, maxOther:Math.max(...others.map(z=>z.lightR)),
          ok: pale.lightR > Math.max(...others.map(z=>z.lightR))*2};
});

/* 1-d. 白の層は本当に明るい。設定の「何もかも白い」が、色として出ているか。
       ここを数値で見ておかないと、名前だけ白くて絵は暗いまま、が起こる。 */
R.paleIsActuallyPale = await pg.evaluate(()=>{
  const lum=hex=>{ const n=parseInt(hex.slice(1),16);
    return (((n>>16)&255)*0.299 + ((n>>8)&255)*0.587 + (n&255)*0.114); };
  const rows=ZONES.map(z=>({nm:z.nm, floor:+lum(z.floor).toFixed(0), wall:+lum(z.wall).toFixed(0)}));
  const pale=ZONES.find(z=>z.id==='pale');
  const brightest=Math.max(...ZONES.map(z=>lum(z.floor)));
  return {rows, ok: lum(pale.floor)===brightest && lum(pale.floor)>120};
});

/* ================= 2. 雑魚三十二種 ================= */

// 2-a. 系統8 × 形式4 が全部埋まっている
R.thirtyTwoNamed = await pg.evaluate(()=>{
  const holes=[];
  FAMILY.forEach(f=>ARCH.forEach(a=>{ if(!zakoName(f.id,a.id)) holes.push(f.id+'/'+a.id); }));
  const all=FAMILY.flatMap(f=>ARCH.map(a=>zakoName(f.id,a.id)));
  return {count:all.length, holes, distinct:new Set(all).size,
          ok: holes.length===0 && all.length===32 && new Set(all).size===32};
});

/* 2-b. 雑魚はカタカナ。**見た瞬間に何が来るか分かる**ことを優先している。
       ここが漢字に戻ると、規格外（漢字）との段差が消えて三段ルールが壊れる。 */
R.zakoAreKatakana = await pg.evaluate(()=>{
  const bad=[];
  FAMILY.forEach(f=>ARCH.forEach(a=>{
    const n=zakoName(f.id,a.id);
    if(n && !/^[ァ-ヴー]+$/.test(n)) bad.push(n);
  }));
  return {bad, ok: bad.length===0};
});

// 2-c. 実際に湧いた敵が、その固定名を名乗る（表を作っただけで繋いでいない、を防ぐ）
R.spawnedUseTheTable = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(23);
  /* 苔玉は雑魚三十二種の表に載っていない別枠（層ごとの一種もの）なので外す。
     苔玉の側の名前は 2-e で別に見る。 */
  const zako=W.enemies.filter(e=>!e.boss && !e.uniq && !e.moss);
  const named=zako.map(e=>({name:e.name, reg:e.reg,
    fromTable: e.name.includes(zakoName(e.fam.id, e.arch.id)||'\0')}));
  return {sample:named.slice(0,4), count:zako.length,
          ok: zako.length>0 && named.every(x=>x.fromTable)};
});

/* 2-e. 苔玉。**表示名はカタカナ**（雑魚の規則どおり）で、
       「苔玉」は種別の呼び名として登録行の側に出る。 */
R.mossNaming = await pg.evaluate(()=>{
  const rows=[];
  for(const z of mossZones()){
    const depth=ZONES.findIndex(x=>x.id===z)*10+3;
    TH.floor(depth);
    const m=W.enemies.find(e=>e.moss);
    if(m) rows.push({z, name:m.name, reg:m.reg});
  }
  const katakana=rows.every(r=>/^[ァ-ヴー]+$/.test(r.name));
  const marked=rows.every(r=>r.reg.startsWith('苔玉／'));
  return {rows, katakana, marked, ok: rows.length===mossZones().length && katakana && marked};
});

/* 2-d. 協会の登録記号（乾・寄）が付いている。
       カタカナの通り名と漢字の事務語、その温度差が世界の手触りになる。 */
R.regMarksExist = await pg.evaluate(()=>{
  TH.run(1,{seed:5}); TH.floor(23);
  const zako=W.enemies.filter(e=>!e.boss && !e.moss);
  const shaped=zako.every(e=>/^[乾滞生築熱欠貸損]・[寄回飛溜]/.test(e.reg||''));
  return {sample:zako.slice(0,4).map(e=>e.reg), ok: zako.length>0 && shaped};
});

/* ================= 3. 規格外 ================= */

/* 3-a. 十二体そろっていて、**漢字**である。
       雑魚（カタカナ）から外れていることを、名前の見た目でも示す約束。 */
R.aberrantAreKanji = await pg.evaluate(()=>{
  const all=Object.values(ABERRANT).flatMap(r=>Object.values(r));
  const kana=all.filter(n=>/[ァ-ヴ]/.test(n));
  return {count:all.length, all, kana,
          ok: all.length===12 && kana.length===0 && new Set(all).size===12};
});

// 3-b. 層ごとに2体ずつ。どの層にも「その層の言い間違い」がある
R.aberrantPerStratum = await pg.evaluate(()=>{
  const rows=ZONES.map(z=>({zone:z.nm, n:Object.keys(ABERRANT[z.id]||{}).length}));
  return {rows, ok: rows.every(r=>r.n===2)};
});

// 3-c. 実際に湧いた規格外が、その層の名前を名乗る
R.uniqueUsesAberrant = await pg.evaluate(()=>{
  const seen=[];
  for(let d of [3,13,23,33,43,53]){
    TH.run(1,{seed:11}); TH.floor(d);
    const zid=W.fl.zone.id;
    const u=makeUnique(W.fl, d, floorFamilies(d));
    const want=Object.values(ABERRANT[zid]||{});
    seen.push({zone:W.fl.zone.nm, name:u.name, reg:u.reg,
               listed: want.some(w=>u.name.includes(w))});
  }
  return {seen, ok: seen.every(x=>x.listed)};
});

/* ================= 4. ボスの三段 ================= */

/* 4-a. 深く潜るほど、名前が人の言葉に近づく。
       現象体＝漢字で名指し／登録名持ち＝人名を持つ（＝かつて人だった）／
       ラスボス＝称号のみ（番号を徴収された）。 */
R.bossNamingTiers = await pg.evaluate(()=>{
  const manifest=[5,15,25,35,45].map(d=>uniqueBossAt(d));
  const registered=[10,20,30,40].map(d=>uniqueBossAt(d));
  const last=uniqueBossAt(50);
  return {
    manifest:manifest.map(u=>u.nm), registered:registered.map(u=>u.nm), last:last.nm,
    manifestAllGreat: manifest.every(u=>u.nm.includes('の大')),
    manifestRegistered: manifest.every(u=>/^現象体・/.test(u.reg)),
    registeredHaveJobs: registered.every(u=>/^登録：/.test(u.reg)),
    lastIsOffering: last.nm==='初めの供物',
    lastHasNoNumber: last.reg.includes('番号欄ともに空白'),
    ok: manifest.every(u=>u.nm.includes('の大'))
        && registered.every(u=>/^登録：/.test(u.reg))
        && last.nm==='初めの供物' && last.reg.includes('番号欄ともに空白')
  };
});

// 4-b. 全員に一行が付いている（三段表示の三段目）
// 5〜50階の10体＋唯一のラストボス（51階・アビスの口）で11体。
R.bossesHaveALine = await pg.evaluate(()=>{
  const ds=Object.keys(UNIQUE_BOSSES).map(Number);
  const noLine=ds.filter(d=>!UNIQUE_BOSSES[d].line);
  return {count:ds.length, noLine, ok: ds.length===11 && noLine.length===0};
});

/* ================= 5. 用語 =================
   置き換え忘れは「古い仕様の化石」として残る。
   画面に出る文字を総ざらいして、旧語が1つも残っていないことを見る。 */
R.oldWordsGone = await pg.evaluate(()=>{
  const old=['秘石','鉱石','潜在','馴れ','永続強化','拠点','鍛造','深淵の主','苔むす水路',
             '灼熱の窯','凍える回廊','骨の墓所','石の坑道','ダンジョン',
             /* ここから下は後から引退した語。
                「支度」は準備の意味と紛れるので能力強化へ、
                「打ち直し所」は施設名を鍛冶屋に寄せ、
                「還り」は仲間の呼び名を仲間へ移したときに空いた。

                「仲間」は一度「プレイヤー」で通した——が、
                日本語で読めば操作している当人を指すし、英語では
                prayer（祈る者）と player（遊ぶ人）のどちらにも読める。
                設定書 8.3-2 の「掛詞を使わない」に自分で触っていた。
                （層の名前の「炉の層」は別物なので触っていない） */
             '支度','打ち直し所','還り','プレイヤー'];
  /* 見るのは**画面に出る文字**。<script> の中身（コード注釈）は対象外にする。
     注釈まで縛ると、実装の話をするのに旧語が使えなくなって窮屈になる。 */
  const clone=document.body.cloneNode(true);
  clone.querySelectorAll('script,style').forEach(n=>n.remove());
  const text=clone.innerText || clone.textContent || '';
  const html=clone.innerHTML || '';
  const found=old.filter(w=>text.includes(w) || html.includes(w));
  return {found, ok: found.length===0};
});

// 5-b. 新しい語が実際に画面に出ている（消しただけで置いていない、を防ぐ）
R.newWordsPresent = await pg.evaluate(()=>{
  setScreen('town');
  const t=document.body.innerHTML;
  /* 「探索者」は協会の登録上の呼び方として世界の側に残してある（酒場の一行）。
     ただし**画面で仲間を指す語は「仲間」**——能力強化や全員回復の文で
     「探索者」と書かれていると、誰のことか一読で決まらない。 */
  const want=['マナ','黒鉄','恩寵','能力強化','街','仲間','鍛冶屋','酒場','探索者'];
  const missing=want.filter(w=>!t.includes(w));
  return {missing, ok: missing.length===0};
});

/* 5-c. ダンジョンの呼び名はアビス。固有名を持たないので、
       表示は層の名前と「アビス」だけで通っているはず。 */
R.abyssIsNamed = await pg.evaluate(()=>{
  const html=document.body.innerHTML;
  return {hasAbyss: html.includes('アビス'), ok: html.includes('アビス')};
});

await done(b, errs, R);
