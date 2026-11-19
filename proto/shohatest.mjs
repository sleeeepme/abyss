// 特性「衝撃波」：近接武器にだけ付く・大きさ小中大・戦槌は円・槍は直線・当たる・弓杖には付かない
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await pg.goto('file://'+path.resolve('proto/index.html'));
await pg.waitForTimeout(350);
await pg.evaluate(()=>{ if(!S.hero){ S.name='テスト'; startAdventure(); } });
const R={};
R.pool = await pg.evaluate(()=>{
  const out={};
  for(const base of ['dagger','sword','axe','mace','spear','great','bow','staff']){
    let n=0, sh=null, qs=[0,0,0];
    for(let i=1;i<=3000;i++){
      const it={uid:i*7+base.length, base, slot:SLOT.W, ilvl:10};
      const a=rollTrait(it, 4);
      if(a && a.id==='shoha'){ n++; sh=a.sh; qs[a.q]++; }
    }
    out[base]={n, sh, qs};
  }
  const melee=['dagger','sword','axe','mace','spear','great'];
  out.ok = melee.every(k=>out[k].n>50) && out.bow.n===0 && out.staff.n===0
        && out.mace.sh==='ring' && out.spear.sh==='line' && out.sword.sh==='cone';
  return out;
});
R.hit = await pg.evaluate(()=>{
  SHOHA_CHANCE = 1;                       // 当たりの確かめは毎回出す
  const res={};
  for(const [base,q] of [['sword',0],['sword',2],['mace',1],['spear',2],['great',2]]){
    S.hero=newHero(); S.upg={hp:8}; startRun(12); S.hero.party=[]; P.invuln=1e9;
    const proto=W.enemies.find(x=>!x.boss)||W.enemies[0];
    const wpn=S.hero.equip.weapon || {};
    S.hero.equip.weapon=Object.assign({}, wpn, {base, slot:SLOT.W, aff:[{t:'tr',id:'shoha',nm:'衝撃波',v:30,q,sh:shohaShape(base)}]});
    const st=stats(S.hero);
    // 振りの届く外、衝撃波の届く内に的を置く。戦槌は真後ろ
    const z=SHOHA_SIZE[q];
    const d = base==='mace' ? -(z.ring-0.3) : base==='spear' ? Math.max(z.line,st.range+1)-0.3
            : Math.min(z.cap, Math.max(z.cone, st.range+z.over))-0.25;
    const e=Object.assign({}, proto, {x:P.x+d, y:P.y, r:0.3, hp:1e9, maxHp:1e9, atkV:0, ms:0, dead:false, st:{}, bu:{}, boss:false});
    W.enemies=[e]; stepSim(0.02); e.x=P.x+d; e.y=P.y; e.hp=1e9; stepSim(0.02);
    W.fx.length=0;
    const hp0=e.hp; meleeSwing(st, 0, 1);
    const waves=(FEEL.weaponArts||[]).filter(f=>f.id==='lg_wave');
    const last=waves[waves.length-1];
    res[base+q]={d:+d.toFixed(2), range:st.range, dmg:Math.round(hp0-e.hp), mode:last&&last.opts&&last.opts.o&&last.opts.o.mode, w:last&&last.opts&&last.opts.o&&last.opts.o.w};
  }
  res.ok = Object.values(res).every(v=>v.dmg>0);
  return res;
});
/* 頻度：5回に1回くらい。剣の付いた主人公で1000回振って、衝撃波の絵の数を数える */
R.freq = await pg.evaluate(()=>{
  SHOHA_CHANCE = 0.2;
  S.hero=newHero(); S.upg={hp:8}; startRun(12); S.hero.party=[]; P.invuln=1e9; W.enemies=[];
  S.hero.equip.weapon=Object.assign({}, S.hero.equip.weapon||{}, {base:'sword', slot:SLOT.W, aff:[{t:'tr',id:'shoha',nm:'衝撃波',v:30,q:1,sh:'cone'}]});
  const st=stats(S.hero); let n=0;
  const L0=legendWaveArt; legendWaveArt=function(){ n++; return true; };
  for(let i=0;i<1000;i++) meleeSwing(st, 0, 1);
  legendWaveArt=L0;
  return {n, ok: n>150 && n<250};
});
/* 仲間：戦士（大剣）に付けると、仲間の位置から衝撃波が出て、振りの外の敵に当たる */
R.ally = await pg.evaluate(()=>{
  SHOHA_CHANCE = 1;
  S.hero=newHero(); S.upg={hp:8}; startRun(12); P.invuln=1e9;
  const a=makeAlly(12, S.hero, 'warrior'); a.boons=[]; a.hpNow=allyStats(a).maxHp; S.hero.party=[a]; a.x=P.x+0.0; a.y=P.y+3;
  a.job='warrior'; a.equip.weapon=genBaseItem('great', 12, 2);
  a.equip.weapon=Object.assign(a.equip.weapon, {aff:[{t:'tr',id:'shoha',nm:'衝撃波',v:40,q:2,sh:shohaShape(a.equip.weapon.base)}]});
  const st=allyStats(a);
  const proto=W.enemies.find(x=>!x.boss)||W.enemies[0];
  const d=Math.min(SHOHA_SIZE[2].cap, Math.max(SHOHA_SIZE[2].cone, st.range+SHOHA_SIZE[2].over))-0.25;
  const e=Object.assign({}, proto, {x:a.x+d, y:a.y, r:0.3, hp:1e9, maxHp:1e9, atkV:0, ms:0, dead:false, st:{}, bu:{}, boss:false});
  W.enemies=[e];
  let at=null; const L0=legendWaveArt; legendWaveArt=function(m,ang,r,ex){ at=ex&&ex.at; return true; };
  const hp0=e.hp; allyAttack(a, st, e);
  legendWaveArt=L0;
  const dmg=Math.round(hp0-e.hp);
  return {base:a.equip.weapon.base, range:st.range, d:+d.toFixed(2), dmg, at, ok: dmg>0 && !!at && Math.abs(at.y-a.y)<1e-6};
});
R.legendLarger = await pg.evaluate(()=>SHOHA_SIZE.every(z=>z.cap<3.6 && z.ring<3.2 && z.line<6.5 && z.w<1));
R.text = await pg.evaluate(()=>[0,1,2].map(q=>shohaText(30,{q,sh:['cone','ring','line'][q]})));
R.errs=errs;
console.log(JSON.stringify(R,null,1));
await b.close();
