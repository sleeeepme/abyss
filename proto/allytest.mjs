// 仲間の専用技（Lv10/20/30）・パーティ効果・召喚士の使い魔・装備の付け替え。
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

R.learn = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(10); S.hero.party=[];
  const out={};
  ALL_JOBS.forEach(j=>{
    const a={job:j.id, lv:1};
    const counts=[1,9,10,19,20,29,30,39,40,49,50].map(lv=>{ a.lv=lv; return allySkills(a).length; });
    out[j.id]={counts, defined:(JOB_SKILLS[j.id]||[]).length,
               names:(JOB_SKILLS[j.id]||[]).map(s=>s.nm)};
  });
  const all=Object.values(out);
  return {jobs:Object.keys(out).length, out,
          // Lv.10/20/30/40/50 の5段階（以前は 10/20/30 の3つだった）
          everyJobHasFive: all.every(o=>o.defined===5),
          milestonesCorrect: all.every(o=>o.counts.join()==='0,0,1,1,2,2,3,3,4,4,5')};
});
R.effects = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.hero.lv=40; S.hero.str=40;S.hero.dex=40;S.hero.vit=40;
  startRun(10); S.hero.party=[];
  /* 潜在を持たない仲間で測る。加入時のランダムな潜在が混じると、
     ここで見たい「レベルで覚える技の効き目」と区別がつかなくなる。 */
  const mk=(job,lv)=>{ const a=makeAlly(10,S.hero); a.boons=[]; a.job=job; a.name=jobDef(job).nm;
    a.lv=lv; a.str=5+lv-1; a.dex=5+lv-1; a.vit=5+lv-1;
    a.equip.weapon=genBaseItem(jobDef(job).weapon,10,1);
    a.equip.armor=genBaseItem(jobDef(job).armor,10,1);
    a.x=P.x; a.y=P.y; a.hpNow=1e6; return a; };
  const out={};
  ['knight','hunter','rogue','paladin'].forEach(job=>{
    S.hero.party=[]; const lo=mk(job,9); S.hero.party=[lo];
    const s1=allyStats(lo);
    S.hero.party=[]; const hi=mk(job,30); S.hero.party=[hi];
    const s2=allyStats(hi);
    out[job]={dr:[s1.allyDR,s2.allyDR], atkUp:+(s2.atk/s1.atk).toFixed(2),
              aspd:[+s1.aspd.toFixed(2),+s2.aspd.toFixed(2)],
              range:[+s1.range.toFixed(2),+s2.range.toFixed(2)],
              crit:[Math.round(s1.crit),Math.round(s2.crit)],
              procs:s2.skills.procs.length};
  });
  return {out,
    knightGainsDR: out.knight.dr[1]>out.knight.dr[0],
    hunterGainsSpeedAndRange: out.hunter.aspd[1]>out.hunter.aspd[0] && out.hunter.range[1]>out.hunter.range[0],
    rogueGainsCrit: out.rogue.crit[1]>out.rogue.crit[0],
    paladinGainsProc: out.paladin.procs>0};
});
R.aura = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={}; S.hero.lv=40; startRun(10); S.hero.party=[];
  const mk=(job,lv)=>{ const a=makeAlly(10,S.hero); a.job=job; a.lv=lv;
    a.equip.weapon=genBaseItem(jobDef(job).weapon,10,1); a.x=P.x;a.y=P.y;a.hpNow=1e6; return a; };
  const solo=mk('rogue',10); S.hero.party=[solo];
  const before=partyAura();
  const wa=mk('warrior',30), pr=mk('priest',30), pa=mk('paladin',10);
  S.hero.party=[solo,wa,pr]; const withAura=partyAura();
  S.hero.party=[solo,pa]; const withAegis=partyAura();
  return {before, withAura, withAegis,
          warriorGivesAtk: withAura.atk>=8, priestGivesDrHp: withAura.dr>=8 && withAura.hp>=10,
          aegisGivesDr: withAegis.dr>=15};
});
R.familiar = await pg.evaluate(async ()=>{
  S.hero=newHero(); S.upg={hp:8}; S.hero.lv=35; S.hero.str=35;S.hero.dex=35;S.hero.vit=35;
  startRun(20); S.hero.party=[]; W.enemies.length=0; W.ores.length=0; W.haz=null;
  const a=makeAlly(20,S.hero); a.job='summoner'; a.name='召喚士'; a.lv=20;
  a.equip.weapon=genBaseItem('staff',20,1); a.equip.armor=genBaseItem('robe',20,1);
  a.x=P.x+0.6; a.y=P.y; a.hpNow=1e6; S.hero.party=[a];
  const e={x:P.x+3,y:P.y,arch:ARCH[0],fam:FAMILY[0],lv:20,elite:false,aff:[],maxHp:1e7,hp:1e7,
    atkV:0,def:0,res:{},dt:'blunt',st:{},bu:{},state:'chase',t:0,cd:99,vx:0,vy:0,hit:0,tele:0,
    dead:false,r:0.34,ms:0,teleMul:1,col:'#fff',name:'的'};
  W.enemies.push(e);
  const hp0=e.hp;
  await new Promise(r=>setTimeout(r,2500));
  let drawFail=null;
  try{ W.seen.forEach(r=>r.fill(1)); for(let i=0;i<3;i++) draw(); }catch(er){ drawFail=er.message; }
  return {count:(a.fams||[]).length, positioned:(a.fams||[]).every(f=>f.x!==undefined),
          dealtDamage:e.hp<hp0, drawFail,
          twoAt20: (a.fams||[]).length===2};
});

/* ================= 装備の付け替え ================= */

R.rules = await pg.evaluate(()=>{
  S.hero=newHero(); startRun(12); S.hero.party=[];
  const a=makeAlly(12,S.hero); a.job='hunter'; a.name='狩人'; a.lv=12;
  S.hero.party=[a];
  const bow=genBaseItem('bow',12,1),  sword=genBaseItem('sword',12,1);
  const armor=genBaseItem('plate',12,1), ring=genItem(12,0);
  const unid=genBaseItem('bow',12,1); unid.ident=false;
  const broken=genBaseItem('bow',12,1); broken.dur=0;
  const potion=makeConsum('salve');
  return {sameWeapon:allyCanEquip(a,bow), rejectsOtherWeapon:!allyCanEquip(a,sword),
          anyArmor:allyCanEquip(a,armor),
          rejectsUnident:!allyCanEquip(a,unid), rejectsBroken:!allyCanEquip(a,broken),
          rejectsConsum:!allyCanEquip(a,potion),
          weaponLockedToJob: allyCanEquip(a,bow) && !allyCanEquip(a,sword)};
});
R.swap = await pg.evaluate(()=>{
  S.hero=newHero(); S.upg={hp:8}; startRun(12); S.hero.party=[];
  const a=makeAlly(12,S.hero); a.job='knight'; a.name='重騎士'; a.lv=12;
  /* **武器種はジョブ定義から引く。** ここに 'great' と書き写していたせいで、
     重騎士を戦斧に変えた回に、渡せる武器が1本も並ばず静かに落ちた。
     渡せるのは「そのジョブの武器種」だけ、という規則が本編側にあるので、
     テストも同じ場所を見る。 */
  const WB=jobDef('knight').weapon;
  a.equip.weapon=genBaseItem(WB,6,0); a.equip.armor=genBaseItem(jobDef('knight').armor,6,0);
  a.hpNow=allyStats(a).maxHp;
  S.hero.party=[a];
  const strong=genBaseItem(WB,30,2); strong.ident=true;
  S.run.loot=[strong];
  const atk0=allyStats(a).atk, old=a.equip.weapon.uid;
  openAllyEquip(a,'bag');
  const listed=document.querySelectorAll('#ae-src [data-aeon]').length;
  allyEquipGive(strong.uid);
  const atk1=allyStats(a).atk;
  const returned=S.run.loot.some(i=>i.uid===old);
  // 外すと持ち物へ戻る
  allyEquipTakeOff(strong.uid);
  const backInBag=S.run.loot.some(i=>i.uid===strong.uid);
  const bare=a.equip.weapon===null;
  closeAllyEquip();
  return {listed, atk0:+atk0.toFixed(2), atk1:+atk1.toFixed(2),
          gotStronger: atk1>atk0, oldReturnedToBag: returned,
          takeOffWorks: backInBag && bare,
          closedToBag: S.screen==='bag'};
});
R.townSource = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null; S.stash=[];
  const a=makeAlly(12,S.hero); a.job='mage'; a.name='魔法使い'; a.lv=20;
  S.hero.party=[a];
  const staff=genBaseItem('staff',40,2); staff.ident=true;
  S.stash=[staff];
  setScreen('char');           // 仲間の一覧はステータス画面に移った
  const shown=document.getElementById('town-party').textContent.includes('魔法使い');
  openAllyEquip(a,'char');
  const head=document.getElementById('ae-srchead').textContent;
  const listed=document.querySelectorAll('#ae-src [data-aeon]').length;
  allyEquipGive(staff.uid);
  const equipped=a.equip.weapon && a.equip.weapon.uid===staff.uid;
  const goneFromStash=!S.stash.some(i=>i.uid===staff.uid);
  closeAllyEquip();
  return {shownInCharScreen:shown, head, listed, equipped, goneFromStash,
          usesStash: head.includes('倉庫') && listed===1 && equipped && goneFromStash,
          // 開いた画面へ戻る（拠点直行ではなく、呼び出し元へ）
          closedToCaller:S.screen==='char'};
});
R.skillPanel = await pg.evaluate(()=>{
  S.hero=newHero(); S.run=null; S.stash=[];
  const a=makeAlly(12,S.hero); a.job='paladin'; a.name='聖騎士'; a.lv=20;
  S.hero.party=[a];
  openAllyEquip(a,'town');
  const t=document.getElementById('ae-skills').textContent;
  const sub=document.getElementById('ae-sub').textContent;
  closeAllyEquip();
  return {text:t.replace(/\s+/g,' ').slice(0,120), sub:sub.replace(/\s+/g,' '),
          showsAll3: JOB_SKILLS.paladin.every(s=>t.includes(s.nm)),
          marksUnlearned: t.includes('未習得'),
          showsNext: sub.includes('Lv.30')};
});

await b.close();
console.log(JSON.stringify({errs,R},null,2));
