import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
const browser=await chromium.launch({args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('file://'+path.resolve('proto/index.html'));
  await page.waitForFunction(()=>window.ABYSS_SAVE?.info().ready);
  await page.click('#t-start');await page.fill('#nm-input','蓄積テスト');await page.click('#nm-ok');
  const checks=await page.evaluate(()=>{
    const out=[];
    function check(name,ok){if(!ok)throw Error(name);out.push(name);}
    window.DROP_IN=false; S.tutStone=true;
    const expected=[[0,0],[1,1],[9,9],[10,10],[11,10],[12,11],[19,14],[20,15],[21,15],[22,15],[23,16],[30,18],[40,20]];
    for(const [n,lv] of expected){S.deathPressure={1:n};check('curve '+n,deathPressureLevel(1)===lv);}
    S.deathPressure={};startRun(6);S.hero.boons=[];S.hero.party=[];
    function rewardSample(n){
      S.deathPressure=n?{6:n}:{};RNG=mulberry32(37);
      const e=Object.assign({},W.enemies.find(e=>!e.boss),{dead:false,form2:null,aff:[],elite:false,uniq:false,undying:false,noXp:false,noDrop:false,lv:enemyLevelAt(6),fam:FAMILY[0]});
      W.enemies=[e];W.drops=[];S.run.kills=0;S.run.gold=0;S.shards=0;
      const xp=grantXp;let awardedXp=0;grantXp=total=>{awardedXp=total;return total;};
      try{killEnemy(e);}finally{grantXp=xp;}
      return {xp:awardedXp,gold:S.run.gold,sp:S.shards,items:W.drops.filter(d=>d.it&&!d.it.consum).map(d=>d.it.ilvl)};
    }
    const ordinary=rewardSample(0),rewarded=rewardSample(10);
    check('boosted kill increases EXP and gold',rewarded.xp>ordinary.xp&&rewarded.gold>ordinary.gold);
    check('boosted kill increases SP by Lv bonus',rewarded.sp===ordinary.sp+10);
    check('equipment item level follows Lv bonus',ordinary.items.length>0&&rewarded.items.length===ordinary.items.length&&rewarded.items.every((lv,i)=>lv===ordinary.items[i]+10));
    for(const enemy of [{},{elite:true},{uniq:true},{boss:true,tier:'mid'},{boss:true,tier:'great'},{boss:true,tier:'final'},{intruder:true}]){
      S.deathPressure={};const sp=shardDrop(enemy,6);S.deathPressure={6:10};
      check('SP bonus '+JSON.stringify(enemy),shardDrop(enemy,6)===sp+10);
    }
    const cleared=packCleared;packCleared=()=>false;
    check('unfinished swarm still gives no SP',shardDrop({swarmling:true,_packN:10},6)===0);
    packCleared=()=>true;
    check('swarm reward keeps group reduction',shardDrop({swarmling:true,_packN:10},6)===Math.round(11*10*SLATER_REWARD));
    packCleared=cleared;
    clearDeathPressure();const resetReward=rewardSample(0);
    check('reset restores original rewards',JSON.stringify(resetReward)===JSON.stringify(ordinary));
    S.deathPressure={};recordDeathPressure(5);recordDeathPressure(2);
    check('death floors inclusive',JSON.stringify(S.deathPressure)===JSON.stringify({1:2,2:2,3:1,4:1,5:1}));
    check('beyond death floor unchanged',deathPressureLevel(6)===0);
    S.deathPressure={};startRun(5);S.upg.revive=1;S.hero.hpNow=0;const deaths=S.deaths;die();
    check('revive has no pressure',S.deaths===deaths&&Object.keys(S.deathPressure).length===0);
    S.upg.revive=0;S.hero.boons=[];S.hero.hpNow=0;die();
    check('real death counted once',S.deaths===deaths+1&&S.deathPressure[5]===1);die();
    check('repeat death guarded',S.deaths===deaths+1);
    S.hero=newHero();S.deathPressure={};startRun(5);S.screen='event';
    RNG=mulberry32(17);const base=makeBoss(W.fl,5,'mid');S.deathPressure={1:12,2:12,3:12,4:12,5:12};S.deaths=12;
    RNG=mulberry32(17);const boosted=makeBoss(W.fl,5,'mid');
    check('boss stats strengthen',boosted.lv===base.lv+11&&boosted.maxHp>base.maxHp&&boosted.atkV>base.atkV);
    boosted.hp=boosted.maxHp/2;W.enemies=[boosted];W.ev={id:'spring',x:P.x,y:P.y,used:false};
    S.shards=99;openEvent();check('insufficient button disabled',el('ev-offer').disabled);offerAtSpring();
    check('insufficient no changes',S.shards===99&&!W.ev.used&&deathPressureLevel(5)===11);
    S.shards=100;openEvent();check('offer available',!el('ev-offer').disabled&&!el('ev-offer').hidden);
    boosted.form2={maxHp:1000,atkV:200,def:100};
    boosted.parts=[{max:100,hp:50,broken:false},{max:100,hp:0,broken:true}];
    const ms=boosted.ms, heroHp=S.hero.hpNow=10;
    offerAtSpring();
    check('offer costs exactly 100 and clears all floors',S.shards===0&&W.ev.used&&Object.keys(S.deathPressure).length===0);
    check('current enemies reset with hp ratio',boosted.lv===base.lv&&Math.abs(boosted.hp/boosted.maxHp-.5)<1e-9&&Math.abs(boosted.atkV-base.atkV)<1e-9&&Math.abs(boosted.def-base.def)<1e-9);
    check('second form and parts reset',boosted.form2.maxHp<1000&&boosted.form2.atkV<200&&boosted.form2.def<100&&boosted.parts[0].hp/boosted.parts[0].max===.5&&boosted.parts[1].hp===0&&boosted.parts[1].broken);
    check('offering does not heal or haste',S.hero.hpNow===heroHp&&boosted.ms===ms);
    offerAtSpring();check('double offer guarded',S.shards===0);
    recordDeathPressure(5);check('new pressure starts at one',deathPressureLevel(5)===1);
    W.ev={id:'spring',x:P.x,y:P.y,used:false};openEvent();resolveEvent();
    check('drinking keeps pressure and SP',deathPressureLevel(5)===1&&S.shards===0&&S.hero.hpNow===stats(S.hero).maxHp);
    W.ev={id:'cache',x:P.x,y:P.y,used:false};openEvent();check('other event hides offer',el('ev-offer').hidden);closeEvent();
    S.deaths=13;S.hero.hpNow=stats(S.hero).maxHp;P.invuln=999;pauseGame(true);el('m-help').classList.add('on');
    ABYSS_SAVE.request();ABYSS_SAVE.frame();check('save succeeds',!ABYSS_SAVE.info().failed);
    return out;
  });
  await page.reload();await page.waitForFunction(()=>ABYSS_SAVE.info().ready);await page.click('#t-start');
  assert.deepEqual(await page.evaluate(()=>[S.deathPressure[1],S.deathPressure[5],deathPressureLevel(5)]),[1,1,1]);
  checks.push('pressure survives save/reload');
  // 保存項目が無い旧セーブは、既存の総死亡数にかかわらず未蓄積で再開する。
  await page.evaluate(()=>{delete S.deathPressure;ABYSS_SAVE.request();ABYSS_SAVE.frame();});
  await page.reload();await page.waitForFunction(()=>ABYSS_SAVE.info().ready);await page.click('#t-start');
  assert.deepEqual(await page.evaluate(()=>[S.deaths,Object.keys(S.deathPressure).length,deathPressureLevel(5)]),[13,0,0]);
  checks.push('old save begins without retroactive pressure');
  await page.click('#save-action');
  await page.evaluate(()=>{el('save-dialog').classList.remove('on');el('m-help').classList.remove('on');S.deathPressure={1:12,5:12};S.shards=100;W.ev={id:'spring',x:P.x,y:P.y,used:false};openEvent();});
  await page.screenshot({path:'/tmp/abyss-death-pressure-spring.png'});
  await page.click('#ev-offer');
  assert.deepEqual(await page.evaluate(()=>[S.shards,W.ev.used,Object.keys(S.deathPressure).length]),[0,true,0]);
  checks.push('mobile offering button executes reset');
  const colors=await page.evaluate(()=>{
    S.hero=newHero();S.deathPressure={};startRun(1);P.invuln=999;P.atkCd=999;W.pops=[];W.fx=[];W.drops=[];_banner=null;
    const e=W.enemies.find(e=>!e.boss);e.elite=true;e.uniq=false;e.intruder=false;
    W.enemies=[e];e.x=P.x+2;e.y=P.y;e.ms=0;e.cd=999;P.target=e;W.seen.forEach(row=>row.fill(1));
    const rows=[],original=label;
    try{
      for(const [bonus,color] of [[0,'#98a1b2'],[1,'#ffe066'],[4,'#ffe066'],[5,'#ff9a5a'],[9,'#ff9a5a'],[10,'#ff625a']]){
        S.deathPressure=bonus?{1:bonus}:{};e.lv=enemyLevelAt(1);
        let seen=false;
        label=function(text,x,y,col,scale){if(text==='Lv.'+e.lv){if(col!==color)throw Error('wrong rendered Lv color');seen=true;}return original(text,x,y,col,scale);};
        draw();if(!seen)throw Error('Lv label not rendered');rows.push(bonus);
      }
    }finally{label=original;}
    clearDeathPressure();if(feelEnemyLevelColor()!=='#98a1b2')throw Error('color did not reset');
    S.deathPressure={1:5};e.lv=enemyLevelAt(1);W.pops=[];W.fx=[];draw();
    return rows;
  });
  checks.push('actual enemy Lv colors at boundaries '+colors.join('/'),'spring reset restores normal Lv color');
  await page.screenshot({path:'/tmp/abyss-death-pressure-level-color.png'});
  assert.deepEqual(errors,[]);
  const scratch=await mkdtemp(path.join(tmpdir(),'abyss-pressure-feel-'));
  const original=process.argv[2] ? await readFile(process.argv[2],'utf8') : execFileSync('git',['show','HEAD:proto/index.html'],{encoding:'utf8',maxBuffer:32*1024*1024});
  await writeFile(path.join(scratch,'index.html'),original.replace('<head>','<head><base href="file://'+path.resolve('proto')+'/">'));
  await writeFile(path.join(scratch,'feeltest.html'),await readFile('proto/feeltest.html','utf8'));
  async function feel(url){
    const p=await browser.newPage({viewport:{width:390,height:844}});
    await p.goto(url);await p.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('{'));
    const result=JSON.parse(await p.locator('#result').textContent());await p.close();return result;
  }
  const baseline=await feel('file://'+path.join(scratch,'feeltest.html'));
  const current=await feel('file://'+path.resolve('proto/feeltest.html'));
  assert.deepEqual(current.results.filter(r=>!r.pass).map(r=>r.name),baseline.results.filter(r=>!r.pass).map(r=>r.name));
  assert.deepEqual(current.errors,[]);
  checks.push('feel regression has no new failures');
  console.log(JSON.stringify({passed:checks.length,checks,errors,feel:{passed:current.results.filter(r=>r.pass).length,existingFailures:current.results.filter(r=>!r.pass).length}},null,2));
}finally{await browser.close();}
