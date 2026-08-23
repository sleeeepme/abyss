/* 回帰テストの共通部品。
   ここに集めてある理由はひとつで、**同じ物を各スイートに書き写さないため**。

   実際にこれで壊した: S.run に 3 つフィールドを足したとき、
   S.run を手組みしているテストが一斉に落ちた（過去には touchtest / hubtest も
   同じ理由で落ちている）。テスト側が本編の内部構造を写経していると、
   本編を触るたびにテストを直す仕事が増える——それが一番効く減速要因だった。

   なので原則: **S.run は絶対に手組みしない。startRun() を通す。**
   startRun が唯一の正解で、フィールドが増えても勝手に付いてくる。 */
import { chromium, devices } from 'playwright';
import path from 'path';

/* ブラウザを開いて index.html を読む。errs には page error / console.error が溜まる。 */
export async function boot(){
  const b   = await chromium.launch();
  const ctx = await b.newContext({...devices['iPhone 13'], hasTouch:true, isMobile:true});
  const pg  = await ctx.newPage();
  const errs=[];
  pg.on('pageerror', e=>errs.push('PAGEERROR '+e.message));
  pg.on('console',   m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
  await pg.goto('file://'+path.resolve('proto/index.html'));
  await pg.waitForTimeout(400);
  return {b, pg, errs};
}

/* 結果を出して閉じる。全スイート共通の出力形式（{errs, R}）。 */
export async function done(b, errs, R){
  await b.close();
  console.log(JSON.stringify({errs, R}, null, 2));
}

/* ページ側に注ぎ込むヘルパ。evaluate の中から TH.* で呼べる。 */
export async function install(pg){
  await pg.evaluate(()=>{
    /* タイトル画面を1枚跨いでから拠点に入るようになった。
       各スイートが見たいのは拠点から先なので、ここで済ませておく
       （タイトルそのものの検証は titletest.mjs が install を使わずに行う）。 */
    if(!S.hero){ S.name='テスト'; startAdventure(); }
    window.TH = {
      /* 潜りを1つ始める。**S.run を手で作らないための唯一の入口。**
         seed を渡すと生成が固定される（startRun が S.runs を ++ するので -1 して渡す）。
         戻り値は S.run そのもの。 */
      run(depth, opt){
        const o = opt || {};
        if(!S.hero) S.hero = newHero();
        if(o.seed != null) S.runs = o.seed - 1;
        S.carry = [];                       // ガチャの持ち込みは既定で無し（狙う時だけ入れる）
        S.shardsRun = 0;
        startRun(depth);
        if(!o.keepParty) S.hero.party = [];  // 仲間は既定で連れない（要る時だけ作る）
        S.hero.hpNow = stats(S.hero).maxHp;
        return S.run;
      },
      /* 指定の階へ。run() のあとに使う。 */
      floor(depth){ enterFloor(depth); return W.fl; },
      /* 実時間で待たずにループを進める。stepSim の薄い別名。 */
      step(seconds, opt){ return stepSim(seconds, opt); },
      /* スティック入力を与えたまま進める（疑似操作）。 */
      move(seconds, dx, dy, opt){
        const o = Object.assign({}, opt||{});
        const prev = o.each;
        o.each = (t,i)=>{ stickDx=dx; stickDy=dy; if(prev) prev(t,i); };
        const n = stepSim(seconds, o);
        stickDx=0; stickDy=0;
        return n;
      },
      /* 潜在を持たない仲間。**能力そのものを測るときは必ずこちら**を使う。
         makeAlly は加入時にランダムで潜在を配るようになったので、
         素の makeAlly を2体作って比べると、潜在の当たり外れが差として出てしまう
         （実際 allytest がこれで落ちた: 狩人の攻撃速度が Lv9 > Lv30 に見えた）。 */
      ally(depth, job, lv){
        const a=makeAlly(depth, S.hero);
        a.boons=[];
        if(job) a.job=job;
        if(lv!=null){ a.lv=lv; a.str=5+lv-1; a.dex=5+lv-1; a.vit=5+lv-1; }
        a.hpNow=allyStats(a).maxHp;
        return a;
      },
      /* 死なせたくない検証用。無敵にする。 */
      immortal(){ P.invuln = 1e9; },
      /* この階の敵を消す（測りたい物だけ残す） */
      clearEnemies(){ W.enemies.length = 0; },
      /* モーダルが開いているか／閉じる */
      open(id){ return document.getElementById(id).classList.contains('on'); },
      close(id){ document.getElementById(id).classList.remove('on'); },
    };
  });
}
