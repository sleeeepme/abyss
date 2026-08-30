// 引き撃ちの抑制（飛び道具は足を止めて撃つほど強い）
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html')); await pg.waitForTimeout(400);
/* タイトル画面を1枚跨いでから拠点に入るようになった。
   このスイートが見たいのは拠点から先なので、ここで済ませておく。 */
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};

// ゲームループが素通りできる、無害な的を作る（arch を持たせないと enemyUpdate が落ちる）
await pg.evaluate(()=>{
  window.mkDummy=(x,y)=>({x, y, arch:ARCH.find(a=>a.id==='turret')||ARCH[0],
    fam:FAMILY[0], lv:10, elite:false, aff:[],
    maxHp:1e9, hp:1e9, atkV:0, def:0, res:{}, dt:'slash', st:{}, bu:{},
    state:'idle', t:0, cd:9e9, vx:0, vy:0, hit:0, tele:0, dead:false, r:0.34,
    ms:0, teleMul:1, col:'#b5563f', name:'的'});
});

/* ============ 1. 足の状態の判定 ============ */

// 1-a. 敵は +X 方向。移動方向で still / advance / strafe / retreat が分かれる
R.footing = await pg.evaluate(()=>{
  const t={x:5,y:0}, me={x:0,y:0};
  const f=(mx,my,moving)=>footing(mx,my,moving,t.x,t.y,me.x,me.y).k;
  return {
    still:    f(0,0,false),
    toward:   f(1,0,true),
    away:     f(-1,0,true),
    sideUp:   f(0,-1,true),
    sideDown: f(0,1,true),
    diagAway: f(-0.71,-0.71,true),
    diagTo:   f(0.71,0.71,true),
    correct: f(0,0,false)==='still' && f(1,0,true)==='advance'
          && f(-1,0,true)==='retreat' && f(0,-1,true)==='strafe'};
});

// 1-b. 近接には一切かからない
R.meleeExempt = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(10); S.hero.party=[];
  const out={};
  ['sword','great','mace','spear','dagger'].forEach(w=>{
    S.hero.equip.weapon=genBaseItem(w,10,0);
    const st=stats(S.hero);
    out[w]=kiteMul(st,-1,0,true,5,0,0,0).mul;     // 全力で後退しながら
  });
  return {mults:out, allFull:Object.values(out).every(v=>v===1)};
});

// 1-c. 飛び道具は撃ち方で倍率が変わる
R.rangedMul = await pg.evaluate(()=>{
  const out={};
  ['bow','staff'].forEach(w=>{
    S.hero.equip.weapon=genBaseItem(w,10,0);
    const st=stats(S.hero);
    out[w]={still:  kiteMul(st,0,0,false,5,0,0,0).mul,
            advance:kiteMul(st,1,0,true,5,0,0,0).mul,
            strafe: kiteMul(st,0,1,true,5,0,0,0).mul,
            retreat:kiteMul(st,-1,0,true,5,0,0,0).mul};
  });
  const bow=out.bow;
  return {mults:out, table:KITE,
          stillIsFull: bow.still===1,
          descends: bow.still>bow.advance && bow.advance>bow.strafe && bow.strafe>bow.retreat,
          retreatSubstantial: bow.retreat<=0.7};
});

/* ============ 2. 実際のダメージに乗る ============ */

// 2-a. 同じ的に、止まって撃つ / 下がりながら撃つ でダメージが変わる
R.realDamage = await pg.evaluate(async ()=>{
  const shoot=(mvx,mvy,moving)=>{
    S.hero=newHero(); S.upg={}; S.hero.lv=20;
    S.hero.str=24; S.hero.dex=24; S.hero.vit=24;
    startRun(10); S.hero.party=[];
    S.hero.equip.weapon=genBaseItem('bow',20,0);
    S.hero.equip.weapon.aff=[];
    const st=stats(S.hero);
    const dummy=mkDummy(P.x+2.0, P.y);
    W.enemies=[dummy]; W.fx=[];
    P.mvx=mvx; P.mvy=mvy; P.moving=moving;
    P.target=dummy; P.dirx=1; P.diry=0; P.atkCd=0;
    playerAttack();
    const shot=W.fx.find(f=>f.t==='pshot');
    // 弾を的まで進めて命中させる
    const hp0=dummy.hp;
    for(let i=0;i<60 && !dummy.dead;i++){
      shot.x+=shot.vx*0.016; shot.y+=shot.vy*0.016;
      if(Math.hypot(shot.x-dummy.x, shot.y-dummy.y) <= dummy.r+0.25){
        hitEnemy(dummy, stats(S.hero), shot.mult ?? 1, {foot:shot.foot});
        break;
      }
    }
    return {foot:shot.foot, mult:shot.mult, dmg:hp0-dummy.hp};
  };
  // クリティカルとダメージ振れ幅があるので複数回撃って平均を取る
  const avg=(mvx,mvy,moving,n)=>{
    let s=0, foot=null;
    for(let i=0;i<n;i++){ const r=shoot(mvx,mvy,moving); s+=r.dmg; foot=r.foot; }
    return {foot, avg:Math.round(s/n)};
  };
  const still=avg(0,0,false,60), strafe=avg(0,1,true,60), kite=avg(-1,0,true,60);
  return {still, strafe, kite,
          ratioStrafe:+(strafe.avg/still.avg).toFixed(2),
          ratioKite:+(kite.avg/still.avg).toFixed(2),
          kiteIsWeaker: kite.avg < still.avg*0.75,
          strafeInBetween: strafe.avg < still.avg && strafe.avg > kite.avg};
});

// 2-b. 撃った瞬間の足で決まる（撃ってから止まっても満額にならない）
R.lockedAtFire = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(10); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('bow',20,0);
  const dummy=mkDummy(P.x+3, P.y);
  W.fx=[]; P.target=dummy; P.dirx=1; P.diry=0; P.atkCd=0;
  P.mvx=-1; P.mvy=0; P.moving=true;        // 後退しながら撃つ
  playerAttack();
  const shot=W.fx.find(f=>f.t==='pshot');
  const atFire=shot.mult;
  P.mvx=0; P.mvy=0; P.moving=false;        // 撃った直後に止まる
  return {atFire, afterStop:shot.mult, foot:shot.foot,
          stillPenalised: shot.mult===atFire && atFire<1};
});

/* ============ 3. 火力表（止まれば近接と釣り合う） ============ */
R.dpsTable = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.hero.lv=20;
  S.hero.str=24; S.hero.dex=24; S.hero.vit=24;
  startRun(20); S.hero.party=[];
  const out={};
  ['dagger','sword','mace','great','spear','bow','staff'].forEach(w=>{
    S.hero.equip.weapon=genBaseItem(w,20,0); S.hero.equip.weapon.aff=[];
    const st=stats(S.hero);
    const dps=st.atk*(1.9*st.aspd)*(1+st.crit/100*0.5);
    const proj=!!st.proj;
    out[w]={reach:+st.range.toFixed(2),
            still:Math.round(dps*(proj?KITE.still:1)),
            kite:Math.round(dps*(proj?KITE.retreat:1))};
  });
  const meleeStill=['dagger','sword','mace','great','spear'].map(w=>out[w].still);
  const rangedStill=[out.bow.still, out.staff.still];
  const rangedKite=[out.bow.kite, out.staff.kite];
  return {table:out,
          /* ---------- 飛び道具の取り分 ----------
             以前は「止まって撃つなら近接の下限あたり」（0.9倍以上）だった。
             弓と杖の攻撃速度を一段落としたので、この線は動かしてある。

             **止まって撃っても近接には届かない。** 射程がそのまま安全なので、
             手数まで近接並みにあると近接を選ぶ理由が消える。
             ただし引き撃ち（0.6倍）ほどは落とさない——
             「足を止める」に意味が残っていないと、飛び道具に判断が無くなる。 */
          stillIsFair: rangedStill.every(v=>v >= Math.min(...meleeStill)*0.70
                                         && v <  Math.min(...meleeStill)),
          // 引き撃ちは近接の最低火力より明確に下
          kiteIsWorst: rangedKite.every(v=>v < Math.min(...meleeStill)*0.75),
          bowReach:out.bow.reach, staffReach:out.staff.reach,
          reachTrimmed: out.bow.reach<6.5 && out.staff.reach<4.5};
});

/* ============ 4. 見え方 ============ */

// 4-a. HUD に今の撃ち方と倍率が出る（弓のときだけ）
R.hud = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const dummy=mkDummy(P.x+2, P.y);
  W.enemies=[dummy];
  const read=(w,mvx,mvy,moving)=>{
    S.hero.equip.weapon=genBaseItem(w,10,0);
    P.target=dummy; P.mvx=mvx; P.mvy=mvy; P.moving=moving;
    updateHUD();
    const el2=document.getElementById('foottag');
    return {shown:el2.style.display==='block', text:el2.textContent};
  };
  const kite=read('bow',-1,0,true);
  const still=read('bow',0,0,false);
  const melee=read('sword',-1,0,true);
  return {kite, still, melee,
          showsForRanged: kite.shown && still.shown,
          hiddenForMelee: !melee.shown,
          saysKite: kite.text.includes('引き撃ち'),
          saysPercent: /威力 \d+%/.test(kite.text),
          saysFull: still.text.includes('満額')};
});

// 4-b. 減衰した一撃はダメージ表示に「↓」が付く
R.marker = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; startRun(10); S.hero.party=[];
  S.hero.equip.weapon=genBaseItem('bow',20,0);
  const mk=(foot)=>{
    const dummy=mkDummy(P.x+1, P.y);
    W.pops=[];
    hitEnemy(dummy, stats(S.hero), 1, {foot});
    return (W.pops.find(p=>p.v!==undefined)||{}).mark;
  };
  return {retreat:mk('retreat'), strafe:mk('strafe'),
          still:mk('still'), melee:mk('melee'),
          marksWeak: mk('retreat')==='↓' && mk('strafe')==='↓',
          noMarkWhenFull: mk('still')==='' && mk('melee')===''};
});

/* ============ 5. 仲間の射手にも同じ規則 ============ */
R.ally = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(10); S.hero.party=[];
  const a=makeAlly(10,S.hero);
  a.job='hunter'; a.equip.weapon=genBaseItem('bow',10,1);
  a.x=P.x; a.y=P.y; a.hpNow=allyStats(a).maxHp;
  S.hero.party.push(a);
  const tgt={x:a.x+2, y:a.y, r:0.34};
  const fire=(mvx,mvy,moving)=>{
    a.mvx=mvx; a.mvy=mvy; a.moving=moving; a.atkCd=0; W.fx=[];
    allyAttack(a, allyStats(a), tgt);
    const s=W.fx.find(f=>f.t==='ashot');
    return s ? {mult:s.mult, foot:s.foot} : null;
  };
  const still=fire(0,0,false), kite=fire(-1,0,true);
  return {still, kite,
          appliesToAllies: !!still && !!kite && kite.mult < still.mult};
});

/* ============ 6. 引き撃ちを潰していないか ============
   狙いは引き撃ちを潰すことではなく、最適解でなくすこと。
   だからここで守りたい一線は「弓で引き撃ちすれば今も生き残って敵を倒せる」。

   横移動との優劣は簡易ボットの出来に強く左右される（実際、周回するだけの
   ボットは第12階層の革鎧では死ぬ）ので、比較値は参考として出すだけにして、
   断言はしない。火力差の検証は 2-a / 3 が担当している。 */
R.viability = await pg.evaluate(async ()=>{
  const run=async (mode)=>{
    S.hero=newHero(); S.upg={hp:8,atk:6,aspd:4}; S.hero.lv=25;
    S.hero.str=29; S.hero.dex=29; S.hero.vit=29;
    /* 種を固定する。ここまでのどの節が何回潜ったかで S.runs がずれ、
       同じ「第12階層」でも間取りと敵の並びが毎回変わっていた。
       測っているのは**足の使い方**なので、床は同じ物を2回使う。 */
    S.runs = 40;
    startRun(12); S.hero.party=[];
    /* 水の層の水を外す。**測りたいのは引き撃ちという動き方そのもの。**
       水の上では足が鈍る（それが水の層の性格）ので、残したままだと
       「引き撃ちが成立するか」ではなく「水の層で引き撃ちできるか」になる。 */
    W.haz=null;
    S.hero.equip.weapon=genBaseItem('bow',25,2);
    S.hero.equip.armor =genBaseItem('leather',25,2);
    S.hero.hpNow=stats(S.hero).maxHp;
    const hp0=S.hero.hpNow;
    /* 相手は**その階の普通の敵だけ**にする。規格外（紫）は1体で戦い方が変わる
       相手で、湧くかどうかは抽選なので、種の並びが1つずれただけで
       「引き撃ちが成立するか」の答えが引っくり返ってしまう。 */
    W.enemies = W.enemies.filter(e=>!e.uniq && !e.boss && !e.intruder);
    // 敵をまとめて前方に置く
    W.enemies.forEach((e,i)=>{ e.x=P.x+4+((i%4)*0.8); e.y=P.y-1.5+((i%3)*1.2); });
    // 疑似入力。壁に突き当たって止まると比較にならないので、
    // どちらも「最寄りの敵を基準に」動く簡易ボットにする。
    // 疑似ボットは毎フレームの頭で入力を決める（元は 30ms ごと＝約2フレームに1回）。
    stepSim(8, {each:(t)=>{
      if(!S.hero || !S.run) return;
      const e=nearestEnemyTo(P.x,P.y,99);
      if(!e){ stickDx=0; stickDy=0; return; }
      const dx=e.x-P.x, dy=e.y-P.y, d=Math.hypot(dx,dy)||1e-6;
      if(mode==='kite'){                       // 敵から離れ続ける
        stickDx=-dx/d; stickDy=-dy/d;
      }else{                                   // 敵を軸に横へ回り込む
        const s=Math.sin(t*1.6)>0?1:-1;
        stickDx=-dy/d*s; stickDy=dx/d*s;
      }
    }});
    stickDx=0; stickDy=0;
    const alive=!!S.hero;
    return {kills:S.run?S.run.kills:0, alive,
            hpLost: alive? Math.round(hp0-S.hero.hpNow) : Math.round(hp0)};
  };
  const kite=await run('kite');
  const strafe=await run('strafe');   // 参考値
  /* 参考値は真偽値で返さない。掃引は「false = 失敗」で読むので、
     『横移動ボットは第12階層の革鎧では死ぬことがある』という
     わざと断言していない観測が、毎回失敗として並んでしまう。 */
  const strafeRef={kills:strafe.kills, hpLost:strafe.hpLost,
                   outcome: strafe.alive?'生存':'死亡'};
  return {kite, strafeForReference:strafeRef,
          // ここが守りたい一線
          kiteStillSurvives: kite.alive,
          kiteStillKills: kite.kills>0,
          loopAlive:_tickCount>300};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
