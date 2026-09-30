/* Sword / spear weapon-art study built directly from the approved normal attacks. */
(() => {
  'use strict';
  const fx=window.AllyEffectStudy,TAU=Math.PI*2;
  if(!fx)throw Error('AllyEffectStudy must load first');
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const images={};
  for(const [key,src] of Object.entries({
    actor:'assets/sprites/characters/allies/warrior-right-idle.png',
    hunter:'assets/sprites/characters/allies/hunter-right-idle.png',
    rogue:'assets/sprites/characters/allies/rogue-right-idle.png',
    knight:'assets/sprites/characters/allies/knight-right-idle.png',
    mage:'assets/sprites/characters/allies/mage-right-idle.png',
    enemy:'assets/sprites/enemies/moss-ball/front-idle-v1.png'
  })){const im=new Image();im.src=src;images[key]=im;}
  const artSprites={flame:{right:[],up_right:[],up:[],up_left:[],left:[],down_left:[],down:[],down_right:[]},earth:[],upper:[]};
  for(const direction of Object.keys(artSprites.flame))for(let i=0;i<15;i++){
    const im=new Image();im.src=`assets/effects/weapon-art-v44/flame-breath/${direction}/frame-${String(i).padStart(2,'0')}.png`;artSprites.flame[direction].push(im);
  }
  for(let i=0;i<16;i++){const im=new Image();im.src=`assets/effects/weapon-art-v30/earth-wave/frame-${String(i).padStart(2,'0')}.png`;artSprites.earth.push(im);}
  for(let i=0;i<6;i++){const im=new Image();im.src=`assets/effects/weapon-art-v18/raging-upper/frame-${String(i).padStart(2,'0')}.png`;artSprites.upper.push(im);}
  const defs={
    iai:{label:'居合',note:'通常の剣軌跡を1.18倍。踏み込み後の一閃だけを強く見せる'},
    swspin:{label:'回転斬り',note:'通常斬撃と同じ太細・欠け・グローで、一周する円軌道を描く'},
    swmulti:{label:'多段斬り',note:'通常の剣軌跡を0.16秒刻みで三度。角度で連撃順を見せる'},
    spswing:{label:'スウィング',note:'刺突線を使わず、細い穂先が円周を二度薙ぐ'},
    splance:{label:'ショットランス',note:'通常の槍刺突を1.28倍へ伸ばし、細い副軌跡を一つ添える'},
    spdragoon:{label:'ドラグーン',note:'上昇と急降下の両方に通常の槍刺突を使う'},
    axtoma:{label:'トマホーク',note:'通常の斧軌跡を小さく巻き、直線上を回転して貫く'},
    axspin:{label:'スピンアクス',note:'通常の斧軌跡と同じ太い先端で、重い円を一周する'},
    axspiral:{label:'スパイラルホーク',note:'小さな回転軌跡を0.18秒刻みで三度飛ばす'},
    bwrain:{label:'アローレイン',note:'通常の矢形を上空から時間差で落とす'},
    bwrapid:{label:'連射',note:'通常の矢と残線を0.14秒刻みで五連射する'},
    bwburst:{label:'バーストショット',note:'矢形を残し、細い白芯と橙の残光で少しレーザーらしくする'},
    dgslash:{label:'乱斬り',note:'通常の短剣軌跡を0.12秒刻みで三度、狭い前方へ重ねる'},
    dgdance:{label:'ダンシングソード',note:'通常の短剣軌跡が本人の周囲を回り続ける'},
    dgmirage:{label:'ミラージュ',note:'本体を半透明にし、すぐ消える二枚の残像で無敵を示す'},
    mcdouble:{label:'ダブルアタック',note:'通常の戦鎚衝撃を0.2秒間隔で左右へ二度打ち込む'},
    mcheal:{label:'癒し打ち',note:'通常の戦鎚衝撃後、淡い緑の回復粒子を味方へ配る'},
    mcshield:{label:'ホーリーシールド',note:'戦鎚の発動閃光から、一撃分の盾形を短く残す'},
    stflame:{label:'フレイム',note:'黒煙を除いた8方向火炎放射。上下は扇形、前面グローと発光する敵全身へ通常の炎属性ヒットを重ねる'},
    sticicle:{label:'アイシクルエッジ',note:'冷気色の通常魔弾を0.2秒刻みで三度通し、霜煙を残す'},
    stbolt:{label:'ライトニング',note:'通常の魔弾で発動し、周囲へ時間差で細い雷を落とす'},
    gtspin:{label:'大回転斬り',note:'大剣らしい太い円軌道を0.22秒間隔で二周させる'},
    gtquake:{label:'地走り',note:'連続した地盤から固有形の岩棘が小から大へ隆起し、上面の破片と低い瓦礫へ崩れる'},
    gtupper:{label:'レイジングアッパー',note:'足元の溜めから50ms刻みで伸び、冷白の太いピークを残して上方向の破片へ分解する'}
  };
  function floor(c){
    c.imageSmoothingEnabled=false;c.fillStyle='#22352c';c.fillRect(0,0,320,170);
    for(let yy=0;yy<170;yy+=16)for(let xx=0;xx<320;xx+=24){
      c.fillStyle=(xx*7+yy*13)%37<12?'#293c30':'#26392e';
      c.fillRect(xx+1+(yy%32?12:0),yy+1,22,14);
    }
    c.fillStyle='#15291e';c.fillRect(0,0,320,8);c.fillStyle='#42523a';c.fillRect(0,8,320,1);
  }
  function actor(c,x,y,hidden=false,opacity=1,sprite='actor'){
    if(hidden)return;
    c.save();c.globalAlpha=opacity;
    c.fillStyle='#14251c';c.beginPath();c.ellipse(x,y+18,14,4,0,0,TAU);c.fill();
    const im=images[sprite]||images.actor;
    if(im.complete&&im.naturalWidth)c.drawImage(im,Math.round(x)-24,Math.round(y)-27,48,48);
    c.fillStyle='#b5d69e';c.fillRect(Math.round(x)-9,Math.round(y)+26,18,2);c.restore();
  }
  function enemy(c,x,y,hit=false){
    c.fillStyle='#14241c';c.beginPath();c.ellipse(x,y+17,13,5,0,0,TAU);c.fill();
    if(images.enemy.complete&&images.enemy.naturalWidth){
      c.drawImage(images.enemy,Math.round(x)-24,Math.round(y)-27,48,48);
      if(hit){
        for(const [blur,alpha,color] of [[9,.42,'#ff671b'],[4,.56,'#ffb52c']]){
          c.save();c.globalAlpha=alpha;c.fillStyle=color;c.filter=`brightness(2.2) blur(${blur}px)`;
          c.drawImage(images.enemy,Math.round(x)-24,Math.round(y)-27,48,48);c.restore();
        }
        c.save();c.globalAlpha=.48;c.fillStyle='#fff3a0';c.filter='brightness(2.35)';
        c.drawImage(images.enemy,Math.round(x)-24,Math.round(y)-27,48,48);c.restore();
      }
    }else{c.fillStyle=hit?'#fff56b':'#7c9958';c.fillRect(x-11,y-9,22,23);}
  }
  function line(c,x1,y1,x2,y2,w,col,a=1){
    c.save();c.globalAlpha=a;c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore();
  }
  function polygon(c,points,col){
    c.fillStyle=col;c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));
    c.closePath();c.fill();
  }
  // Circular form of the approved normal sword ribbon: hairline tail, thick hooked head,
  // deliberate missing chips, flat core, and the same three glow passes.
  function orbitRibbonCore(c,cx,cy,r,start,end,width,erosion=0,tip=false){
    const count=64,point=(i,inner)=>{
      const u=i/count,a=start+(end-start)*u,profile=Math.pow(u,2.1)*Math.pow(1-u,.50)*9;
      const tooth=inner&&i%7===0?width*.13:0,rr=r-(inner?Math.max(0,width*profile-tooth):0);
      return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr];
    };
    let first=0;
    for(let i=0;i<=count;i++){
      const u=i/count,cut=i===count||(erosion>0&&u<erosion&&i%9<3);
      if(!cut)continue;
      if(i-first>=2){const pts=[];for(let j=first;j<=i;j++)pts.push(point(j,false));for(let j=i;j>=first;j--)pts.push(point(j,true));polygon(c,pts,'#ffffff');}
      first=i+1;
    }
    if(tip){
      const x=cx+Math.cos(end)*r,y=cy+Math.sin(end)*r,tx=-Math.sin(end),ty=Math.cos(end);
      polygon(c,[[x+tx*7,y+ty*7],[x-Math.cos(end)*3,y-Math.sin(end)*3],[x-tx*7,y-ty*7],[x+Math.cos(end)*5,y+Math.sin(end)*5]],'#fff56b');
    }
  }
  function orbitAttack(c,{t,start,cx,cy,r,width,angle=-2.4,clockwise=1,tip=false,life=.42,turn=.96}){
    const p=clamp((t-start)/life);if(t<start||t>start+life)return;
    const sweep=1-Math.pow(1-clamp(p/.62),2.2),head=angle+clockwise*TAU*turn*sweep;
    const decay=clamp((p-.62)/.38),span=(.5+5.55*clamp(p/.18))*(1-.72*decay);
    const begin=head-clockwise*span,w=width*Math.pow(1-decay,1.6);
    for(const [blur,alpha] of [[9,.45],[2.5,.60],[0,1]]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha;
      orbitRibbonCore(c,cx,cy,r,begin,head,w,decay*.9,tip);c.restore();
    }
  }
  function neutralHit(c,x,y,age,scale=.65){
    fx.renderElementHit(c,{element:'neutral',age,x,y,target:'enemy',scale,compact:true});
  }
  function axeGlyph(c,x,y,angle,scale=1){
    for(const [blur,alpha] of [[7,.42],[2,.58],[0,1]]){
      c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
      c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha;
      line(c,-8,0,6,0,1.3,'#fff56b');
      polygon(c,[[2,-8],[9,-6],[12,0],[9,6],[2,8],[5,3],[-1,2],[-1,-2],[5,-3]],'#ffffff');
      c.restore();
    }
  }
  function burstBeam(c,age){
    if(age<.035||age>.29)return;
    const flight=clamp((age-.035)/.145),after=1-clamp((age-.18)/.11);
    const head=100+(10+87*flight)*1.52,tail=112,alpha=after;
    for(const [blur,width,a,col] of [[8,4,.34,'#ff783d'],[2.4,2.2,.54,'#ffad72'],[0,1.05,1,'#ffffff']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';line(c,tail,84,Math.max(tail,head-7),84,width,col,alpha*a);c.restore();
    }
    line(c,tail+8,78,Math.max(tail+8,head-25),78,.65,'#ffad72',alpha*.48);
    line(c,tail+16,90,Math.max(tail+16,head-34),90,.65,'#fff56b',alpha*.38);
  }
  function healMotes(c,cx,cy,age){
    if(age<0||age>.58)return;const p=age/.58;
    for(let i=0;i<7;i++){
      const a=i*TAU/7-.3,r=5+29*(1-Math.pow(1-p,2)),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r-p*(12+i%2*5),s=(1-p)*(i%3?2.1:3);
      if(s<.35)continue;
      for(const [blur,alpha] of [[6,.32],[1.5,.52],[0,1]]){
        c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha*(1-p);c.fillStyle=i%2?'#c9ff63':'#efffa4';
        c.fillRect(Math.round(x-s*2.2),Math.round(y-s*.55),Math.ceil(s*4.4),Math.ceil(s*1.1));
        c.fillRect(Math.round(x-s*.55),Math.round(y-s*2.2),Math.ceil(s*1.1),Math.ceil(s*4.4));c.restore();
      }
    }
  }
  function daggerGlyph(c,x,y,angle,scale=.75){
    for(const [blur,alpha] of [[6,.36],[1.5,.56],[0,1]]){
      c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha;
      polygon(c,[[-8,-1],[4,-2],[11,0],[4,2],[-8,1]],'#ffffff');line(c,-9,-4,-9,4,1.2,'#fff56b');c.restore();
    }
  }
  function shieldGlyph(c,cx,cy,age){
    if(age<0||age>.72)return;const p=age/.72,grow=clamp(age/.12),fade=1-clamp((age-.48)/.24),s=(18+4*grow);
    const pts=[[cx,cy-s],[cx+s*.78,cy-s*.58],[cx+s*.68,cy+s*.42],[cx,cy+s],[cx-s*.68,cy+s*.42],[cx-s*.78,cy-s*.58],[cx,cy-s]];
    for(const [blur,w,a,col] of [[8,5,.35,'#ffe7a0'],[2,2.4,.58,'#fff56b'],[0,1.1,1,'#ffffff']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=fade*a;c.strokeStyle=col;c.lineWidth=w;c.beginPath();pts.forEach((q,i)=>i?c.lineTo(...q):c.moveTo(...q));c.stroke();c.restore();
    }
    line(c,cx,cy-s*.48,cx,cy+s*.48,1,'#fff56b',fade*.75);
  }
  function lightningDrop(c,x,y,age){
    if(age<0||age>.22)return;const p=age/.22,fade=1-clamp((age-.1)/.12),top=16,phase=Math.floor(age/.035)%2;
    const pts=[[x,top],[x+(phase?4:-3),top+(y-top)*.28],[x+(phase?-3:5),top+(y-top)*.52],[x+(phase?3:-4),top+(y-top)*.76],[x,y]];
    for(const [blur,w,a,col] of [[7,4,.32,'#ffe35e'],[2,2,.56,'#fff171'],[0,1,1,'#ffffd5']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=fade*a;c.strokeStyle=col;c.lineWidth=w;c.beginPath();pts.forEach((q,i)=>i?c.lineTo(...q):c.moveTo(...q));c.stroke();c.restore();
    }
  }
  function flameTongue(c,x,y,age,scale=1){
    if(age<0||age>.48)return;const grow=1-Math.pow(1-clamp(age/.1),2),fade=1-clamp((age-.27)/.21),h=(11+8*scale)*grow,w=(5+3*scale)*grow;
    const pts=[[x-w,y+5],[x-w*.72,y-h*.42],[x-w*.25,y-h*.2],[x,y-h],[x+w*.18,y-h*.48],[x+w*.62,y-h*.72],[x+w,y+5]];
    for(const [blur,alpha,col] of [[8,.34,'#ff783d'],[2.2,.58,'#ffad72'],[0,1,'#fff0bb']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=fade*alpha;polygon(c,pts,col);c.restore();
    }
  }
  function iceSpike(c,x,y,age,scale=1){
    if(age<0||age>.5)return;const grow=1-Math.pow(1-clamp(age/.09),2),fade=1-clamp((age-.3)/.2),h=38*scale*grow,w=8*scale;
    for(const [blur,alpha,col] of [[8,.32,'#53caff'],[2.2,.56,'#a1edff'],[0,1,'#ecfcff']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=fade*alpha;
      polygon(c,[[x-w,y+3],[x-2,y-h],[x+3,y-h*.58],[x+w,y+3]],col);
      polygon(c,[[x-w*1.7,y+2],[x-w*1.05,y-h*.48],[x-w*.35,y+2]],col);
      polygon(c,[[x+w*.25,y+2],[x+w*1.15,y-h*.4],[x+w*1.65,y+2]],col);c.restore();
    }
  }
  function groundWave(c,x,y,angle,age,len=105){
    if(age<0||age>.46)return;const p=clamp(age/.46),front=len*(1-Math.pow(1-clamp(p/.72),2)),fade=1-clamp((age-.31)/.15),ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
    const bx=x+ux*(front-28),by=y+uy*(front-28),tx=x+ux*front,ty=y+uy*front,w=7*(1-p*.5);
    const pts=[[bx+nx*w*.2,by+ny*w*.2],[tx+nx*w,ty+ny*w],[tx+ux*13,ty+uy*13],[tx-nx*w*.55,ty-ny*w*.55],[bx-nx*.5,by-ny*.5]];
    for(const [blur,alpha,col] of [[8,.34,'#c8d8e8'],[2.2,.56,'#ffffff'],[0,1,'#ffffff']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=fade*alpha;polygon(c,pts,col);c.restore();
    }
  }
  function pixelFlame(c,x,y,age,scale=1,seed=0){
    if(age<0||age>1.02)return;
    const grow=1-Math.pow(1-clamp(age/.1),2),fade=1-clamp((age-.8)/.22),s=scale*grow;
    const flick=(Math.floor(age/.075)+seed)%3,lean=flick===0?-2:flick===1?1:3;
    const outer=[[-9,9],[-12,4],[-10,-4],[-7,-8],[-8,-15],[-4,-20],[-2,-16],[1,-27],[5,-20],[7,-13],[11,-9],[10,-3],[13,2],[10,9],[5,13],[-4,13]];
    const mid=[[-7,8],[-9,2],[-6,-5],[-4,-10],[-2,-7],[1,-19],[5,-13],[8,-8],[7,-2],[10,3],[6,9],[1,11],[-4,10]];
    const hot=[[-5,8],[-6,3],[-3,-3],[-1,-10],[2,-6],[4,-13],[7,-5],[6,3],[3,9],[-2,10]];
    const core=[[-3,7],[-3,2],[-1,-4],[1,-8],[3,-3],[4,4],[2,8]];
    const shape=pts=>pts.map(([px,py])=>[x+(px+(py<0?lean*(Math.abs(py)/27):0))*s*1.16,y+py*s*.84]);
    c.save();c.globalAlpha=fade*.22;c.filter='blur(4px)';polygon(c,shape(outer),'#d63a2f');c.restore();
    c.save();c.globalAlpha=fade;polygon(c,shape(outer),'#7e2330');polygon(c,shape(mid),'#c83b32');polygon(c,shape(hot),'#f06a32');polygon(c,shape(core),'#fff0a6');c.restore();
    // Sparse square embers match the reference without soft smoke.
    for(let i=0;i<3;i++){
      const q=clamp((age-.08-i*.035)/.68);if(q<=0||q>=1)continue;
      const ex=x+((seed*7+i*11)%17-8)*scale+lean*q*3,ey=y-20*scale-q*(13+i*5),size=Math.max(1,Math.round((1.8-q)*scale));
      c.save();c.globalAlpha=fade*(1-q);c.fillStyle=i===0?'#f58b3a':'#b93432';c.fillRect(Math.round(ex),Math.round(ey),size,size);c.restore();
    }
  }
  function dragonBreath(c,ox,oy,age){
    if(age<0||age>.95)return;
    const clusters=[
      [.05,0,.42],[.14,-.18,.56],[.16,.2,.58],[.25,0,.76],[.34,-.45,.72],[.35,.42,.74],
      [.44,-.08,.92],[.53,-.62,.78],[.54,.58,.82],[.63,-.22,.98],[.68,.42,.92],
      [.76,-.68,.86],[.78,.08,1.08],[.82,.7,.82],[.91,-.25,1.04],[.97,.28,1.12]
    ];
    clusters.forEach(([u,v,s],i)=>{
      const x=ox+u*158,y=oy+v*(8+28*u),delay=.02+u*.16;
      pixelFlame(c,x,y,age-delay,s,i);
    });
  }
  function groundFire(c,x,y,age,scale=1,seed=0){
    if(age<0||age>1.05)return;const grow=1-Math.pow(1-clamp(age/.12),2),fade=1-clamp((age-.82)/.23),pulse=.9+.1*Math.sin(age*19+seed);
    // A low pool of light anchors every flame to the floor.
    c.save();c.globalAlpha=.26*grow*fade;c.filter='blur(9px)';c.fillStyle='#ff8a2f';c.beginPath();c.ellipse(x,y+5,17*scale*pulse,7*scale*pulse,0,0,TAU);c.fill();c.restore();
    c.save();c.globalAlpha=.82*grow*fade;
    polygon(c,[[x-17*scale,y+4],[x-11*scale,y],[x-4*scale,y+1],[x+2*scale,y-1],[x+9*scale,y+1],[x+17*scale,y+4],[x+11*scale,y+8],[x+2*scale,y+7],[x-8*scale,y+9]],'#7e2b24');
    polygon(c,[[x-13*scale,y+3],[x-6*scale,y+1],[x+1*scale,y+2],[x+9*scale,y+1],[x+13*scale,y+5],[x+5*scale,y+7],[x-10*scale,y+7]],'#f07832');
    polygon(c,[[x-7*scale,y+3],[x,y+2],[x+8*scale,y+3],[x+6*scale,y+6],[x-5*scale,y+6]],'#ffd16a');c.restore();
    pixelFlame(c,x,y+1,age,scale,seed);
    pixelFlame(c,x+(seed%2?8:-8)*scale,y+4,age-.045,scale*.52,seed+11);
  }
  function referenceFire(c,x,y,age,scale=1,seed=0){
    if(age<0||age>1.12)return;
    const grow=1-Math.pow(1-clamp(age/.11),2),fade=1-clamp((age-.88)/.24),s=scale*grow;
    const phase=(Math.floor(age/.075)+seed)%3,tip=phase===0?-3:phase===1?1:4;
    c.save();c.globalAlpha=.3*grow*fade;c.filter='blur(12px)';c.fillStyle='#ff8b23';c.beginPath();c.ellipse(x,y+6,22*scale,9*scale,0,0,TAU);c.fill();c.restore();
    c.save();c.globalAlpha=.28*grow*fade;c.filter='blur(5px)';c.fillStyle='#ffd13d';c.beginPath();c.ellipse(x,y+2,15*scale,12*scale,0,0,TAU);c.fill();c.restore();
    const shape=pts=>pts.map(([px,py])=>[x+px*s,y+py*s]);
    const outer=[[-18,7],[-20,2],[-16,-5],[-12,-12],[-9,-6],[-6,-20],[-2,-13],[2+tip,-34],[5,-18],[9,-24],[11,-11],[15,-16],[14,-6],[20,1],[17,7],[6,11],[-10,10]];
    const middle=[[-15,7],[-16,1],[-12,-5],[-9,-9],[-6,-6],[-3,-16],[0,-10],[2+tip*.45,-26],[6,-14],[9,-18],[10,-8],[14,-4],[15,2],[11,7],[2,10],[-8,9]];
    const hot=[[-12,7],[-13,2],[-9,-3],[-6,-6],[-3,-12],[0,-8],[3+tip*.2,-18],[6,-9],[9,-12],[11,-3],[10,4],[4,9],[-6,9]];
    const white=[[-9,7],[-9,2],[-6,-2],[-3,-7],[0,-5],[3,-12],[5,-5],[7,-2],[7,4],[2,8],[-5,8]];
    c.save();c.globalAlpha=fade;polygon(c,shape(outer),'#d94b18');polygon(c,shape(middle),'#ff861e');polygon(c,shape(hot),'#ffd52f');polygon(c,shape(white),'#fffbd0');c.restore();
    // Two or three embers travel on the curved path visible above the reference flame.
    for(let i=0;i<3;i++){
      const q=clamp((age-.12-i*.09)/.55);if(q<=0||q>=1)continue;
      const dir=(seed+i)%2?1:-1,ex=x+dir*(5+23*q)*scale,ey=y-(17+27*q-12*q*q)*scale,sz=Math.max(1,Math.round((2.2-q)*scale));
      c.save();c.globalAlpha=fade*(1-q);c.fillStyle=i===1?'#fff08a':'#ff9b22';c.fillRect(Math.round(ex),Math.round(ey),sz,sz);c.restore();
    }
  }
  function timedSprite(c,frames,durations,age,x,y,w,h){
    if(age<0)return;
    let ms=age*1000,total=0,idx=-1;
    for(let i=0;i<durations.length;i++){total+=durations[i];if(ms<total){idx=i;break;}}
    if(idx<0)return;
    const im=frames[idx];if(!im.complete||!im.naturalWidth)return;
    c.drawImage(im,Math.round(x),Math.round(y),w,h);
  }
  const simulatedDurations=[55,55,55,55,55,55,55,55,55,55,55,55,55,55,55,160];
  const flameDurations=[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70];
  function flameEnvironmentLight(c,x,y,age,direction='right'){
    if(age<0||age>1.18)return;
    const ignite=clamp(age/.12),fade=1-clamp((age-.92)/.26),power=ignite*fade;
    const vertical=direction==='up'||direction==='down';
    c.save();c.translate(x+46,y+46);
    // Large, low-frequency orange light washes the floor and nearby units.
    c.filter='blur(28px)';c.globalAlpha=.26*power;c.fillStyle='#ff5b14';
    c.beginPath();c.ellipse(0,4,vertical?47:79,vertical?79:47,0,0,TAU);c.fill();
    c.filter='blur(15px)';c.globalAlpha=.24*power;c.fillStyle='#ff9827';
    c.beginPath();c.ellipse(0,25,vertical?42:68,18,0,0,TAU);c.fill();
    c.restore();
  }
  function flameSprite(c,x,y,age,direction='right'){
    const frames=artSprites.flame[direction]||artSprites.flame.right;
    const diagonal=direction.includes('_'),size=diagonal?132:92,offset=diagonal?-20:0;
    timedSprite(c,frames,flameDurations,age,x+offset,y+offset,size,size);
    for(const [blur,alpha,color] of [[24,.50,'#ff4a0c'],[12,.56,'#ff7c16'],[5,.50,'#ffc237'],[1.5,.34,'#fff6ac']]){
      c.save();c.fillStyle=color;c.filter=`blur(${blur}px)`;c.globalAlpha=alpha;
      timedSprite(c,frames,flameDurations,age,x+offset,y+offset,size,size);c.restore();
    }
  }
  function flameHitSparks(c,x,y,age,direction='right'){
    if(age<0||age>1.34)return;
    const cx=x+46,cy=y+46;
    for(const [blur,alpha] of [[4.5,.52],[0,1]]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha;
      for(let i=0;i<30;i++){
        const lane=i%10,wave=Math.floor(i/10),u=lane/9;
        const seed=((i*43+7)%89)/89,birth=.035+u*.17+wave*.255;
        const t=age-birth;if(t<0||t>.43)continue;
        const q=t/.43,rawX=x+5+u*79+Math.sin(t*18+i)*2.2;
        const baseY=y+17+((i*29)%43),rawY=baseY-t*(27+seed*21);
        const dx=rawX-cx,dy=rawY-cy,sideLane=((i*7)%10)/9*2-1;
        const fanSide=sideLane*(3+u*26)+Math.sin(t*17+i)*1.5;
        let tx=dx,ty=dy;
        if(direction==='left'){tx=-dx;ty=dy;}
        else if(direction==='up'){tx=fanSide;ty=-dx;}
        else if(direction==='down'){tx=-fanSide;ty=dx;}
        else if(direction==='up_right'){tx=(dx+dy)/Math.SQRT2;ty=(dy-dx)/Math.SQRT2;}
        else if(direction==='down_right'){tx=(dx-dy)/Math.SQRT2;ty=(dx+dy)/Math.SQRT2;}
        else if(direction==='up_left'){tx=-(dx+dy)/Math.SQRT2;ty=(dy-dx)/Math.SQRT2;}
        else if(direction==='down_left'){tx=-(dx-dy)/Math.SQRT2;ty=(dx+dy)/Math.SQRT2;}
        const xx=cx+tx,yy=cy+ty;
        const r=Math.max(.35,(1.45+seed*.9)*Math.pow(1-q,1.25));
        polygon(c,[[xx-r,yy],[xx,yy-r*1.75],[xx+r,yy],[xx,yy+r]],i%3?'#fff56b':'#ffffff');
      }
      c.restore();
    }
  }
  function earthWaveSprite(c,x,y,age){timedSprite(c,artSprites.earth,simulatedDurations,age,x,y,252,108);}
  function ragingUpperSprite(c,x,y,age){timedSprite(c,artSprites.upper,[100,50,50,100,80,140],age,x,y,114,126);}
  function earthRidge(c,x,y,age,scale=1,seed=0){
    if(age<0||age>.62)return;
    const grow=1-Math.pow(1-clamp(age/.08),2.25),crumble=clamp((age-.32)/.23),fade=1-clamp((age-.52)/.1);
    const fullH=(20+seed%3*3)*scale,h=fullH*grow*(1-.76*crumble),w=(7+scale*3.2)*grow,lean=h*.56;
    const shape=pts=>pts.map(([px,py])=>[x+px,y+py]);
    const outer=shape([[-w,2],[-w*.8,-h*.18],[-w*.5,-h*.12],[-w*.25,-h*.42],[lean,-h],[lean+w*.2,-h*.62],[w*.48,-h*.35],[w,2]]);
    const mid=shape([[-w*.7,1],[-w*.42,-h*.17],[-w*.15,-h*.34],[lean*.84,-h*.83],[lean*.55,-h*.45],[w*.66,1]]);
    const light=shape([[-w*.26,0],[lean*.68,-h*.67],[lean*.48,-h*.38],[w*.4,0]]);
    const shade=shape([[-w*.65,1],[-w*.42,-h*.14],[-w*.18,-h*.08],[w*.18,1]]);
    c.save();c.globalAlpha=fade;polygon(c,outer,'#261e19');polygon(c,mid,'#703932');polygon(c,light,'#fedfa0');polygon(c,shade,'#c57644');c.restore();
    // The collapsed frame remains as a low, connected mound instead of vanishing in place.
    if(crumble>0){const mh=3+4*(1-crumble);c.save();c.globalAlpha=fade;polygon(c,shape([[-w,2],[-w*.55,-mh],[0,-mh*.5],[w*.45,-mh],[w,2]]),'#7b3928');polygon(c,shape([[-w*.45,0],[0,-mh*.35],[w*.45,0]]),'#d77b45');c.restore();}
    for(let i=0;i<4;i++){
      const q=clamp((age-.14-i*.022)/.38);if(q<=0||q>=1)continue;
      const px=x+((seed*9+i*13)%17-8)+q*(7+i*2),py=y-h*.45-q*(10+i*4),sz=Math.max(1,Math.round((1.9-q)*Math.min(1.4,scale)));
      c.save();c.globalAlpha=fade*(1-q);c.fillStyle=i%3?'#9e422d':'#ffd08a';c.fillRect(Math.round(px),Math.round(py),sz,sz);c.restore();
    }
  }
  function crawlingWave(c,ox,oy,age){
    if(age<0||age>.94)return;
    const front=clamp(age/.42),fxp=ox+128*(1-Math.pow(1-front,2)),count=9;
    // One continuous rubble bed joins the spikes, matching the mass in the reference.
    if(front>0){const top=[],last=Math.max(1,Math.floor(front*(count-1)));for(let i=0;i<=last;i++)top.push([ox+i*16,oy-(2+(i*5)%4)]);const bed=[...top,[ox+last*16+12,oy+3],[ox-6,oy+3]];
      c.save();c.globalAlpha=1-clamp((age-.72)/.18);polygon(c,bed,'#5a2b24');c.restore();}
    const scales=[.28,.42,.56,.78,.67,1.02,.83,1.3,1.82];
    for(let i=0;i<count;i++){
      const x=ox+16*i,delay=i*.043,local=age-delay,scale=scales[i];
      if(age>delay-.065)line(c,x-7,oy+2+(i%2?1:-1),Math.min(x+9,fxp),oy+(i%3-1)*2,1,i%3?'#a84d30':'#ed9a58',1-clamp((age-.72)/.18));
      earthRidge(c,x,oy,local,scale,i);
    }
  }
  function risingSlash(c,ox,oy,age){
    if(age<0||age>.48)return;const p=clamp(age/.48),grow=1-Math.pow(1-clamp(p/.54),2.3),fade=1-clamp((age-.34)/.14),n=20,outer=[],inner=[];
    for(let i=0;i<=n;i++){
      const u=i/n*grow,x=ox-20+37*u+7*Math.sin(u*Math.PI),y=oy+29-91*u;
      const width=(.5+8*Math.pow(u,2.1)*Math.pow(1-u*.72,.55));outer.push([x-width,y]);inner.push([x+width*.28,y+1]);
    }
    for(const [blur,alpha,col] of [[10,.38,'#c8d8e8'],[2.5,.6,'#ffffff'],[0,1,'#ffffff']]){
      c.save();c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=fade*alpha;polygon(c,[...outer,...inner.reverse()],col);c.restore();
    }
    const hx=ox-20+37*grow+7*Math.sin(grow*Math.PI),hy=oy+29-91*grow;
    line(c,ox-12,oy+24,hx+10,hy-4,1.1,'#fff56b',fade*.8);
  }
  function activation(c,x,y,t,scale=1){
    if(t<0||t>.12)return;
    const p=t/.12,k=(1-p)*scale,r=4+9*p;
    line(c,x-r,y,x+r,y,Math.max(.5,1.4*k),'#fff56b',k);
    line(c,x,y-r*.65,x,y+r*.65,Math.max(.5,1.1*k),'#ffffff',k);
    for(let i=0;i<4;i++){const a=i*TAU/4+.4;line(c,x+Math.cos(a)*(r+2),y+Math.sin(a)*(r+2),x+Math.cos(a)*(r+5*k),y+Math.sin(a)*(r+5*k),.7,'#b9caff',k*.8);}
  }
  function normal(c,kind,age,x,y,angle=0,scale=1,hit=true,element='neutral'){
    fx.render(c,{kind,age,x,y,angle,scale,hit,element});
  }
  function hitWindow(age,kind){const contact=fx.weapons[kind].contact;return age>=contact&&age<contact+.06;}
  function iai(c,t){
    floor(c);const start=.16,a=clamp((t-.08)/.17),x=78+111*(1-Math.pow(1-a,2.4)),local=t-start;
    const ghostAlpha=.44*(1-clamp((t-.08)/.22));
    if(t>.08&&ghostAlpha>0)actor(c,78,84,false,ghostAlpha);
    const bodyAlpha=t<.08?1:t<.15?1-clamp((t-.08)/.07):t<.21?0:clamp((t-.21)/.09);
    actor(c,x,84,false,bodyAlpha);enemy(c,225,84,hitWindow(local,'swordaxe'));
    activation(c,79,83,t-.02,.9);normal(c,'swordaxe',local,188,84,-.04,1.18,true);
  }
  function swspin(c,t){
    floor(c);const hitAge=t-.27,targets=[[109,48],[178,50],[181,116],[105,117]];
    actor(c,142,84);targets.forEach(([x,y])=>enemy(c,x,y,hitAge>=0&&hitAge<.06));
    activation(c,142,84,t-.02,1);
    orbitAttack(c,{t,start:.11,cx:142,cy:84,r:51,width:4.5});
    targets.forEach(([x,y])=>neutralHit(c,x,y,hitAge));
  }
  function swmulti(c,t){
    floor(c);const ages=[t-.12,t-.28,t-.44],angles=[-.72,.68,-.12],origins=[[132,91],[133,77],[138,84]];
    actor(c,92,84);enemy(c,190,84,ages.some(a=>hitWindow(a,'swordaxe')));activation(c,91,83,t-.015,.85);
    ages.forEach((age,i)=>normal(c,'swordaxe',age,origins[i][0],origins[i][1],angles[i],i===2?1.13:1.06,true));
  }
  function spswing(c,t){
    floor(c);const h1=t-.25,h2=t-.49,targets=[[102,49],[183,54],[105,117],[183,113]];
    actor(c,143,84);targets.forEach(([x,y])=>enemy(c,x,y,(h1>=0&&h1<.055)||(h2>=0&&h2<.055)));
    activation(c,143,83,t-.015,.9);
    orbitAttack(c,{t,start:.1,cx:143,cy:84,r:54,width:2.35,angle:-2.55,tip:true});
    orbitAttack(c,{t,start:.34,cx:143,cy:84,r:54,width:1.9,angle:-2.1,tip:true});
    targets.forEach(([x,y])=>{neutralHit(c,x,y,h1,.52);neutralHit(c,x,y,h2,.52);});
  }
  function splance(c,t){
    floor(c);const main=t-.15,sub=t-.175;
    actor(c,68,84);enemy(c,258,84,hitWindow(main,'spear'));activation(c,70,83,t-.015,1);
    normal(c,'spear',sub,91,84,0,1.08,false);normal(c,'spear',main,177,84,0,1.28,true);
  }
  function spdragoon(c,t){
    floor(c);const up=t-.08,down=t-.83;
    actor(c,92,96,t>.24);actor(c,216,78,t<=.82);enemy(c,216,101,hitWindow(down,'spear'));
    activation(c,92,93,t-.015,1);normal(c,'spear',up,92,98,-Math.PI/2,1.03,false);
    if(t>.68)activation(c,216,101,t-.7,.7);normal(c,'spear',down,216,34,Math.PI/2,1.18,true);
  }
  function axtoma(c,t){
    floor(c);const p=clamp((t-.11)/.42),x=88+142*(1-Math.pow(1-p,2)),hitAge=t-.5;
    actor(c,61,84);enemy(c,246,84,hitAge>=0&&hitAge<.06);activation(c,62,83,t-.015,.9);
    orbitAttack(c,{t,start:.11,cx:x,cy:84,r:17,width:3.1,angle:-2.5,life:.42,turn:1.9});
    if(t>=.11&&t<=.53)axeGlyph(c,x,84,p*TAU*3,1);
    neutralHit(c,246,84,hitAge,.78);
  }
  function axspin(c,t){
    floor(c);const hitAge=t-.29,targets=[[108,47],[180,49],[183,118],[104,119]];
    actor(c,143,84);targets.forEach(([x,y])=>enemy(c,x,y,hitAge>=0&&hitAge<.06));activation(c,143,83,t-.015,1.05);
    orbitAttack(c,{t,start:.1,cx:143,cy:84,r:54,width:5.2,angle:-2.5,life:.47});
    targets.forEach(([x,y])=>neutralHit(c,x,y,hitAge,.68));
  }
  function axspiral(c,t){
    floor(c);const starts=[.1,.28,.46],hits=starts.map(s=>t-(s+.23));
    actor(c,62,84);enemy(c,211,84,hits.some(h=>h>=0&&h<.055));activation(c,63,83,t-.015,.9);
    starts.forEach((s,i)=>{const p=clamp((t-s)/.3),x=91+102*(1-Math.pow(1-p,2)),y=84+(i-1)*5;orbitAttack(c,{t,start:s,cx:x,cy:y,r:13,width:2.4,angle:-2.6,life:.3,turn:1.75});if(t>=s&&t<=s+.3)axeGlyph(c,x,y,p*TAU*2.5,.78);neutralHit(c,211,84,hits[i],.58);});
  }
  function bwrain(c,t){
    floor(c);const xs=[137,176,211,156,229,192,123,218],delays=[.1,.14,.18,.22,.26,.3,.34,.38];
    actor(c,61,122,false,1,'hunter');[[145,91],[205,91],[232,106]].forEach(([x,y])=>enemy(c,x,y,delays.some(d=>hitWindow(t-d,'bow'))));
    activation(c,62,117,t-.015,.85);
    xs.forEach((x,i)=>normal(c,'bow',t-delays[i],x,15,Math.PI/2,.78,true));
  }
  function bwrapid(c,t){
    floor(c);const starts=[.1,.24,.38,.52,.66],ages=starts.map(s=>t-s),angles=[-.08,.05,-.04,.08,0];
    actor(c,68,84,false,1,'hunter');enemy(c,211,84,ages.some(a=>hitWindow(a,'bow')));activation(c,69,83,t-.015,.85);
    ages.forEach((age,i)=>normal(c,'bow',age,101,84,angles[i],1.12,true));
  }
  function bwburst(c,t){
    floor(c);const main=t-.14,hitAge=main-fx.weapons.bow.contact;
    actor(c,67,84,false,1,'hunter');enemy(c,248,84,hitAge>=0&&hitAge<.07);activation(c,68,83,t-.015,1.2);
    // Faint copies are detached wakes, while the centered arrow remains the readable projectile.
    c.save();c.globalAlpha=.42;normal(c,'bow',main-.032,98,78,.025,1.34,false,'fire');c.restore();
    c.save();c.globalAlpha=.34;normal(c,'bow',main-.018,98,90,-.02,1.26,false,'fire');c.restore();
    burstBeam(c,main);
    normal(c,'bow',main,100,84,0,1.52,true,'fire');
    fx.renderElementHit(c,{element:'fire',age:hitAge,x:248,y:84,target:'enemy',scale:1.15});
    fx.renderElementHit(c,{element:'fire',age:hitAge-.035,x:257,y:84,target:'enemy',scale:.82,compact:true});
  }
  function dgslash(c,t){
    floor(c);const starts=[.1,.22,.34],ages=starts.map(s=>t-s),angles=[-.48,.42,-.08];
    actor(c,92,84,false,1,'rogue');enemy(c,171,84,ages.some(a=>hitWindow(a,'dagger')));activation(c,92,83,t-.015,.78);
    ages.forEach((age,i)=>normal(c,'dagger',age,137,84+(i-1)*5,angles[i],i===2?1.12:1.03,true));
  }
  function dgdance(c,t){
    floor(c);const cx=143,cy=84;actor(c,cx,cy,false,1,'rogue');
    [[104,52],[184,55],[183,114]].forEach(([x,y])=>enemy(c,x,y,false));activation(c,cx,cy,t-.015,.8);
    for(let i=0;i<3;i++){
      const a=t*3.9+i*TAU/3,x=cx+Math.cos(a)*44,y=cy+Math.sin(a)*36,age=(t+i*.11)% .34;
      normal(c,'dagger',age,x,y,a+Math.PI/2,.78,true);daggerGlyph(c,x,y,a+Math.PI/2,.7);
    }
  }
  function dgmirage(c,t){
    floor(c);const p=clamp((t-.08)/.24),fade=1-clamp((t-.1)/.34);
    actor(c,142,84,false,.52+.22*Math.sin(t*24)*Math.sin(t*24),'rogue');
    if(t>.08&&t<.48){actor(c,142-20*p,84+5,false,.24*fade,'rogue');actor(c,142+18*p,84-5,false,.18*fade,'rogue');}
    activation(c,142,83,t-.015,.72);
    normal(c,'dagger',t-.1,142,84,-1.6,.82,false);normal(c,'dagger',t-.23,142,84,1.55,.72,false);
  }
  function mcdouble(c,t){
    floor(c);const a=t-.11,b=t-.31;
    actor(c,88,84,false,1,'knight');enemy(c,176,84,hitWindow(a,'hammer')||hitWindow(b,'hammer'));activation(c,89,83,t-.015,.9);
    normal(c,'hammer',a,137,78,.18,1.02,true);normal(c,'hammer',b,138,90,-.16,1.08,true);
  }
  function mcheal(c,t){
    floor(c);const hit=t-.13,heal=t-.28;
    actor(c,91,84,false,1,'knight');enemy(c,179,84,hitWindow(hit,'hammer'));actor(c,65,119,false,1,'knight');activation(c,92,83,t-.015,.92);
    normal(c,'hammer',hit,139,84,0,1.08,true);healMotes(c,91,88,heal);healMotes(c,65,116,heal-.05);
  }
  function mcshield(c,t){
    floor(c);actor(c,143,84,false,1,'knight');activation(c,143,83,t-.015,1);
    normal(c,'hammer',t-.08,143,84,-Math.PI/2,.72,false);shieldGlyph(c,143,84,t-.14);
  }
  function stflame(c,t){
    floor(c);const flame=t-.16;
    flameEnvironmentLight(c,72,38,flame,'right');
    actor(c,66,84,false,1,'mage');[[132,68],[151,84],[166,104]].forEach(([x,y])=>enemy(c,x,y,t>.3&&t<.92));activation(c,67,83,t-.015,.95);
    flameSprite(c,72,38,flame,'right');flameHitSparks(c,72,38,flame,'right');
    [[132,68],[151,84],[166,104]].forEach(([x,y],i)=>fx.renderElementHit(c,{element:'fire',age:t-.38-i*.035,x,y,target:'enemy',scale:1}));
  }
  function sticicle(c,t){
    floor(c);const starts=[.18,.38,.58],xs=[130,172,214],ages=starts.map(s=>t-s);
    actor(c,66,106,false,1,'mage');enemy(c,215,91,ages[2]>=0&&ages[2]<.12);activation(c,67,101,t-.015,.95);
    normal(c,'magicbolt',t-.06,75,99,0,.62,false,'frost');
    starts.forEach((s,i)=>{const age=t-s;line(c,xs[i]-15,108,xs[i]+15,108,1,'#a1edff',age<0&&age>-.12?(age+.12)/.12:0);iceSpike(c,xs[i],108,age,1+i*.08);fx.renderElementHit(c,{element:'frost',age:age-.05,x:xs[i],y:106,target:'enemy',scale:.48,compact:true});});
  }
  function stbolt(c,t){
    floor(c);const drops=[[.18,105,48],[.39,182,52],[.61,191,113],[.84,102,118],[1.06,220,82]];
    actor(c,145,84,false,1,'mage');drops.slice(0,4).forEach(([,x,y])=>enemy(c,x,y,false));activation(c,145,83,t-.015,1);
    normal(c,'magicbolt',t-.05,145,84,-Math.PI/2,.72,false,'shock');
    drops.forEach(([delay,x,y])=>{const age=t-delay;lightningDrop(c,x,y,age);fx.renderElementHit(c,{element:'shock',age,x,y,target:'enemy',scale:.68,compact:true});});
  }
  function gtspin(c,t){
    floor(c);const h1=t-.28,h2=t-.5,targets=[[100,43],[187,45],[191,123],[96,122]];
    actor(c,143,84,false,1,'knight');targets.forEach(([x,y])=>enemy(c,x,y,(h1>=0&&h1<.06)||(h2>=0&&h2<.06)));activation(c,143,83,t-.015,1.15);
    orbitAttack(c,{t,start:.09,cx:143,cy:84,r:59,width:6.4,angle:-2.55,life:.46});
    orbitAttack(c,{t,start:.31,cx:143,cy:84,r:59,width:5.5,angle:-2.1,life:.46});
    targets.forEach(([x,y])=>{neutralHit(c,x,y,h1,.72);neutralHit(c,x,y,h2,.62);});
  }
  function gtquake(c,t){
    floor(c);const wave=t-.22;actor(c,66,103,false,1,'knight');[[174,98],[224,98]].forEach(([x,y])=>enemy(c,x,y,wave>.32&&wave<.55));activation(c,67,98,t-.015,1.12);
    normal(c,'greatsword',t-.08,98,98,0,1.1,false);
    earthWaveSprite(c,68,34,wave);
    neutralHit(c,174,98,wave-.34,.58);neutralHit(c,224,98,wave-.46,.76);
  }
  function gtupper(c,t){
    floor(c);const slash=t-.1,hitAge=t-.25,lift=clamp((t-.24)/.28),ex=158+14*lift,ey=72-36*(1-Math.pow(1-lift,2));
    actor(c,126,111,false,1,'knight');enemy(c,ex,ey,hitAge>=0&&hitAge<.075);activation(c,127,105,t-.015,1.12);
    ragingUpperSprite(c,108,-5,slash);neutralHit(c,158,69,hitAge,.9);
  }
  const directionNames=['right','down_right','down','down_left','left','up_left','up','up_right'];
  function directionForAngle(angle=0){
    const index=((Math.round(angle/(Math.PI/4))%8)+8)%8;
    return directionNames[index];
  }
  /* Effect-only renderer for the real game. Coordinates are supplied by
     game-feel.js; actors, floor and placeholder targets are never drawn. */
  function renderEffect(c,{id,age=0,x=0,y=0,angle=0,scale=1,range=3,element='neutral'}){
    if(age<0||age>1.45)return;
    if(id==='stflame'){
      const direction=directionForAngle(angle),dx=Math.cos(angle)*46-46,dy=Math.sin(angle)*46-46;
      c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
      activation(c,0,0,age-.015,.95);flameEnvironmentLight(c,dx,dy,age-.16,direction);
      flameSprite(c,dx,dy,age-.16,direction);flameHitSparks(c,dx,dy,age-.16,direction);c.restore();return;
    }
    c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle);c.scale(scale,scale);
    activation(c,0,0,age-.015,id.startsWith('gt')?1.12:.9);
    // These multi-hit simulations apply their first hit on the firing frame.
    // Their study scenes include a short anticipation, so pre-roll only the
    // attack ribbon while keeping the activation spark on the real clock.
    const motionAge=age+(id==='dgslash'?.10:id==='gtspin'?.09:0);
    const radius=Math.max(42,range*48),stretch=Math.max(1,radius/92);
    const attack=(kind,a,ang=0,s=1,elem=element)=>normal(c,kind,a,0,0,ang,s,false,elem);
    const lineAttack=(kind,a,s=1,elem=element)=>{c.save();c.scale(stretch,1);attack(kind,a,0,s,elem);c.restore();};
    if(id==='iai') attack('swordaxe',age-.16,-.04,1.18);
    else if(id==='swspin') orbitAttack(c,{t:age,start:.11,cx:0,cy:0,r:radius,width:4.5});
    else if(id==='swmulti') [.12,.28,.44].forEach((d,i)=>attack('swordaxe',age-d,[-.72,.68,-.12][i],i===2?1.13:1.06));
    else if(id==='spswing'){orbitAttack(c,{t:age,start:.1,cx:0,cy:0,r:radius,width:2.35,angle:-2.55,tip:true});orbitAttack(c,{t:age,start:.34,cx:0,cy:0,r:radius,width:1.9,angle:-2.1,tip:true});}
    else if(id==='splance') lineAttack('spear',age-.15,1.28);
    else if(id==='spdragoon'){attack('spear',age-.08,-Math.PI/2,1.03);attack('spear',age-.83,Math.PI/2,1.18);}
    else if(id==='axtoma'){
      const p=clamp((age-.11)/.42),xx=radius*(1-Math.pow(1-p,2));
      orbitAttack(c,{t:age,start:.11,cx:xx,cy:0,r:17,width:3.1,angle:-2.5,life:.42,turn:1.9});if(age>=.11&&age<=.53)axeGlyph(c,xx,0,p*TAU*3,1);
    }else if(id==='axspin') orbitAttack(c,{t:age,start:.1,cx:0,cy:0,r:radius,width:5.2,angle:-2.5,life:.47});
    else if(id==='axspiral') [.1,.28,.46].forEach((d,i)=>{const p=clamp((age-d)/.3),xx=radius*(1-Math.pow(1-p,2));orbitAttack(c,{t:age,start:d,cx:xx,cy:(i-1)*5,r:13,width:2.4,angle:-2.6,life:.3,turn:1.75});if(age>=d&&age<=d+.3)axeGlyph(c,xx,(i-1)*5,p*TAU*2.5,.78);});
    else if(id==='bwrain') [0,1,2,3,4,5,6,7].forEach((i)=>{c.save();c.translate((i%4-1.5)*18,-radius*.5+(i%2)*12);attack('bow',age-(.1+i*.04),Math.PI/2,.78);c.restore();});
    else if(id==='bwrapid') [.1,.24,.38,.52,.66].forEach((d,i)=>lineAttack('bow',age-d,1.12));
    else if(id==='bwburst'){const main=age-.14;c.save();c.scale(stretch,1);burstBeam(c,main);attack('bow',main,0,1.52,'fire');c.restore();}
    else if(id==='dgslash') [.1,.22,.34].forEach((d,i)=>attack('dagger',(motionAge-d)*.58,[-.48,.42,-.08][i],i===2?1.12:1.03));
    else if(id==='dgdance') for(let i=0;i<3;i++){const a=age*3.9+i*TAU/3,xx=Math.cos(a)*radius,yy=Math.sin(a)*radius*.82;normal(c,'dagger',(age+i*.11)%.34,xx,yy,a+Math.PI/2,.78,false,element);daggerGlyph(c,xx,yy,a+Math.PI/2,.7);}
    else if(id==='dgmirage'){attack('dagger',age-.1,-1.6,.82);attack('dagger',age-.23,1.55,.72);}
    else if(id==='mcdouble'){attack('hammer',age-.11,.18,1.02);attack('hammer',age-.31,-.16,1.08);}
    else if(id==='mcheal'){attack('hammer',age-.13,0,1.08);healMotes(c,0,0,age-.28);}
    else if(id==='mcshield'){attack('hammer',age-.08,-Math.PI/2,.72);shieldGlyph(c,0,0,age-.14);}
    else if(id==='sticicle') [.18,.38,.58].forEach((d,i)=>iceSpike(c,38+i*42,10,age-d,1+i*.08));
    else if(id==='stbolt') [[.18,35,-28],[.39,72,-12],[.61,68,36],[.84,18,42],[1.06,95,4]].forEach(([d,xx,yy])=>lightningDrop(c,xx,yy,age-d));
    else if(id==='gtspin'){orbitAttack(c,{t:motionAge,start:.09,cx:0,cy:0,r:radius,width:6.4,angle:-2.55,life:.46});orbitAttack(c,{t:motionAge,start:.31,cx:0,cy:0,r:radius,width:5.5,angle:-2.1,life:.46});}
    else if(id==='gtquake'){attack('greatsword',age-.08,0,1.1);c.save();c.scale(Math.max(1,range/5),1);earthWaveSprite(c,0,-69,age-.22);c.restore();}
    else if(id==='gtupper') ragingUpperSprite(c,-18,-116,age-.1);
    c.restore();
  }
  const renderers={iai,swspin,swmulti,spswing,splance,spdragoon,axtoma,axspin,axspiral,bwrain,bwrapid,bwburst,dgslash,dgdance,dgmirage,mcdouble,mcheal,mcshield,stflame,sticicle,stbolt,gtspin,gtquake,gtupper};
  function scene(c,key,t){c.save();renderers[key](c,t);c.restore();}
  window.WeaponArtEffectStudy=Object.freeze({keys:Object.keys(defs),defs,scene,renderEffect,directionForAngle,duration:1.4});
})();
