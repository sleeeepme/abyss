/* 立ち物と壁（2026-10-01 ユーザー指摘）：壁は真上から見た面、置き物は斜めから見た絵なので、
   高さのある物（葦・藻・柱・崩れ壁・門・灯柱・列柱・ボイラー・石積み・枠・白い草・3Dの遺跡）は
   **絵の全体が床の上**に収まっていること（岩に掛かると、壁の天面に乗り上げるか、途中で切れて見える）。
   ずらしきれずに捨てた分で品目が消えていないことも見る。 */
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.standClear = await pg.evaluate(()=>{
  const per={}; let over=0, all=0;
  for(const d of [4,8,13,17,24,34,44,54]) for(const seed of [44,45]){
    TH.run(d,{seed}); setScreen('game'); draw(); const G=CAVE._G(), z=G.Z.id;
    for(const o of G.deco){ if(o.ok<0) continue; let hit=false;
      if(o.k==='rbig'){ const sp=CAVE._ruinBig(o); for(let r=0;r<sp.h&&!hit;r+=2) for(let q=0;q<sp.w;q+=2){ const c=sp.rows[r][q]; if(c==='.'||c==='s') continue; if(CAVE._rockAt(o.x-sp.ax+q,o.y-sp.ay+r)){ hit=true; break; } } }
      else { const bx=CAVE._standBox(o); if(!bx) continue; for(let py=o.y+bx[1];py<=o.y+bx[3]&&!hit;py+=2) for(let px=o.x+bx[0];px<=o.x+bx[2];px+=2) if(CAVE._rockAt(px,py)){ hit=true; break; } }
      all++; if(hit) over++; const k=z+':'+(o.k==='rbig'?'rbig':o.k); per[k]=(per[k]||0)+1; }
  }
  // 壁際に出ていた品目が、ずらした結果ひとつも残らない、ということが無いこと
  const need=['stone:reed','stone:rock','stone:stalagC','sump:weed','ruin:pillar','ruin:colonnade','ruin:brokenwall','ruin:arch','furnace:boiler','sump:rbig'];
  const missing=need.filter(k=>!per[k]);
  return {all, over, missing, per, ok: over===0 && missing.length===0 && all>300};
});
/* 2026-10-02 立ち物の前後：根元より奥（北）に立つと立ち物が主人公の上に描き戻され、手前（南）では描き戻さない。
   当たり判定は根元だけなので、奥へ回り込める（柱の真上の高さの所は歩ける） */
R.occlusion = await pg.evaluate(async ()=>{
  const res=[];
  for(const [d,seed,pick] of [[4,44,o=>o.k==='stalagC'],[17,44,o=>o.k==='rbig'&&/^col_[abd]/.test(o.name)],[17,44,o=>o.k==='rbig'&&/^wall_/.test(o.name)]]){
    TH.run(d,{seed}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[]; S.hero.party=[]; draw();
    const o=CAVE._G().deco.find(pick); if(!o){ res.push({d,none:true}); continue; }
    const at=(dy)=>{ P.x=o.x/16+0.1; P.y=o.y/16+dy; draw(); draw(); return CAVE.occDrawn||0; };
    const behind=at(-0.75), front=at(0.8);
    // 柱の絵の高い所（根元から1マス奥）は歩ける＝回り込める
    const walk=!window.solid(o.x/16+0.1, o.y/16-1.0);
    res.push({d, n:o.name||o.k, behind, front, walk});
  }
  return {res, ok: res.every(r=>!r.none && r.behind>0 && r.front===0 && r.walk)};
});
/* 2026-10-12 ユーザー報告「鍾乳石に近づいた時にたまに鍾乳石の一部が増える」：
   鍾乳石の奥に仲間、手前に主人公がいると、仲間のぶんの描き戻しが主人公の上に乗って、鍾乳石が主人公の頭まで伸びて見えた。
   手前の主人公の絵のドットは、奥に仲間がいてもいなくても同じであること（仲間は主人公より先に描くので、主人公の上には出ない） */
R.occFrontHero = await pg.evaluate(()=>{
  TH.run(4,{seed:44}); setScreen('game'); W.seen.forEach(r=>r.fill(1)); W.enemies=[]; S.hero.party=[]; CAVE.halfRate=false; draw(); draw();
  const T=performance.now(), pn=performance.now; performance.now=()=>T;
  const a=makeAlly(4,S.hero); a.job='knight'; a.artVariant=pickAllyVariant('knight'); a.hpNow=allyStats(a).maxHp;
  const cv=document.querySelector('canvas'), g=cv.getContext('2d'), K=cv.width/innerWidth;
  // 主人公の絵の真ん中（頭〜胴）の箱。仲間は主人公より先に描くので、ここは仲間の描き戻しで変わらないはず
  const bx=Math.round((innerWidth/2-TS*0.22)*K), by=Math.round((innerHeight/2-TS*0.42)*K), bw=Math.round(TS*0.44*K), bh=Math.round(TS*0.5*K);
  const grab=()=>g.getImageData(bx,by,bw,bh).data;
  const hk=CharacterArt.heroKey(S.hero), put0=CharacterArt.put, dff=window.drawFeelCharacterSprite;
  const res=[];
  for(const o of CAVE._G().deco.filter(o=>o.k==='stalagC').slice(0,4)) for(const [hy,ay,ax] of [[0.25,-0.3,0.1],[0.3,-0.2,0.3]]){
    P.x=o.x/16+0.05; P.y=o.y/16+hy; a.x=o.x/16+ax; a.y=o.y/16+ay; if(window.solid(P.x,P.y)) continue;
    S.hero.party=[]; draw(); const H=grab();                                   // 仲間なし
    CharacterArt.put=function(k,...r){ return k===hk?true:put0.call(this,k,...r); };
    window.drawFeelCharacterSprite=function(k,...r){ return k===hk?undefined:dff(k,...r); };
    draw(); const N=grab(); CharacterArt.put=put0; window.drawFeelCharacterSprite=dff;   // 仲間なし・主人公の絵なし
    S.hero.party=[a]; draw(); const A=grab();                                  // 奥に仲間
    const d=(X,Y,i)=>Math.abs(X[i]-Y[i])+Math.abs(X[i+1]-Y[i+1])+Math.abs(X[i+2]-Y[i+2]);
    let hero=0, n=0; for(let i=0;i<A.length;i+=4){ if(d(H,N,i)<=12) continue; hero++; if(d(A,H,i)>12) n++; }   // 主人公の絵のドットのうち、奥に仲間がいると変わる数
    res.push({hero, n});
  }
  performance.now=pn; S.hero.party=[];
  return {res, ok: res.length>=4 && res.every(r=>r.hero>100 && r.n<=r.hero*0.03)};
});
await done(b, errs, R);
