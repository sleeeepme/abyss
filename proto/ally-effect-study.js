/* Render-only study. Pixel-space API; no simulation, damage, or random state. */
(() => {
  'use strict';
  const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
  const timing = Object.freeze({contact: .06, end: .62, cycle: .85, motionRate:2});
  const elements=Object.freeze({
    neutral:Object.freeze({label:'無属性',core:'#ffffff',accent:'#fff56b',fleck:'#b9caff',glow:null}),
    fire:Object.freeze({label:'炎',core:'#ffad72',accent:'#fff0bb',fleck:'#ff653e',glow:'#ff783d'}),
    shock:Object.freeze({label:'雷',core:'#fff171',accent:'#ffffd5',fleck:'#ffcf3a',glow:'#ffe35e'}),
    frost:Object.freeze({label:'冷気',core:'#a1edff',accent:'#ecfcff',fleck:'#43baff',glow:'#53caff'}),
    arcane:Object.freeze({label:'魔法',core:'#d6a1ff',accent:'#ffe4ff',fleck:'#a871ff',glow:'#bb71ff'})
  });
  let palette=elements.neutral,glowPass=false;
  const weapons=Object.freeze({
    greatsword:Object.freeze({label:'大剣',contact:.06,reach:35,particles:22,spread:1,speed:1}),
    hammer:Object.freeze({label:'戦鎚',contact:.06,reach:35,particles:28,spread:1,speed:1}),
    spear:Object.freeze({label:'槍（刺突）',contact:.065,reach:61,particles:14,spread:.38,speed:1.1}),
    bow:Object.freeze({label:'弓',contact:.18,reach:97,particles:11,spread:.55,speed:.8}),
    swordaxe:Object.freeze({label:'剣＆斧',contact:.055,reach:30,particles:16,spread:.8,speed:.8}),
    dagger:Object.freeze({label:'短剣',contact:.045,reach:23,particles:9,spread:.65,speed:.62}),
    magicbolt:Object.freeze({label:'魔弾（杖攻撃）',contact:.20,reach:97,particles:18,spread:.85,speed:.85})
  });
  function polygon(c, points, color) {
    c.fillStyle=glowPass&&palette.glow?palette.glow:color==='#ffffff'?palette.core:color==='#fff56b'?palette.accent:color==='#b9caff'?palette.fleck:color;c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));
    c.closePath();c.fill();
  }
  const WHITE='#ffffff', YELLOW='#fff56b';
  // Tail is a hairline; the thick shoulder sits near the leading, hooked tip.
  // Breaks remove actual pieces of the silhouette. No alpha fade or colored rim.
  function ribbon(c,r,start,end,width,erosion=0) {
    const count=64,point=(i,inner)=>{
      const u=i/count,a=start+(end-start)*u;
      const profile=Math.pow(u,2.1)*Math.pow(1-u,.50)*9;
      const tooth=inner&&i%7===0?width*.13:0;
      const rr=r-(inner?Math.max(0,width*profile-tooth):0);
      return [Math.cos(a)*rr,Math.sin(a)*rr*.78];
    };
    let first=0;
    for(let i=0;i<=count;i++){
      const u=i/count,cut=i===count||(erosion>0&&u<erosion&&i%9<3);
      if(!cut)continue;
      if(i-first>=2){const pts=[];for(let j=first;j<=i;j++)pts.push(point(j,false));for(let j=i;j>=first;j--)pts.push(point(j,true));polygon(c,pts,WHITE);}
      first=i+1;
    }
  }
  function needle(c,x,y,angle,length,width,color=WHITE){
    const dx=Math.cos(angle),dy=Math.sin(angle);
    polygon(c,[[x-dx*length*.7,y-dy*length*.7],[x-dy*width,y+dx*width],
      [x+dx*length*.3,y+dy*length*.3],[x+dy*width,y-dx*width]],color);
  }
  function shard(c,x,y,angle,length,width,color=WHITE){
    const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
    polygon(c,[[x+dx*length*.55,y+dy*length*.55],[x+nx*width,y+ny*width],
      [x-dx*length*.45,y-dy*length*.45],[x-nx*width,y-ny*width]],color);
  }
  function wisp(c,x,y,length,curve,width,color=WHITE){
    const steps=10,points=[];
    for(let i=0;i<=steps;i++){
      const u=i/steps,xx=x+length*(u-.5),yy=y+Math.sin(u*Math.PI)*curve;
      const edge=width*Math.sin(u*Math.PI);points.push([xx,yy-edge]);
    }
    for(let i=steps;i>=0;i--){
      const u=i/steps,xx=x+length*(u-.5),yy=y+Math.sin(u*Math.PI)*curve;
      const edge=width*Math.sin(u*Math.PI);points.push([xx,yy+edge]);
    }
    polygon(c,points,color);
  }
  function puff(c,x,y,r,seed=0,color=WHITE){
    const points=[];
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,noise=.82+((i*37+seed*17)%7)/35,rr=r*noise;
      points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);
    }
    polygon(c,points,color);
  }
  function hitCore(c,{element='neutral',age=0,x=0,y=0,scale=1,target='enemy'}){
    if(age<0||age>.48)return;
    const p=clamp(age/.48),snap=clamp(age/.055),out=1-Math.pow(1-snap,3),life=1-p;
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
    if(element==='fire'){
      // Only embers: no flame body remains over the target silhouette.
      for(let i=0;i<14;i++){
        const delay=(i%5)*.014,t=age-delay;if(t<0||t>.36)continue;
        const q=t/.36,seed=((i*43+7)%89)/89,a=-2.85+seed*2.56,d=(7+seed*22)*(1-Math.exp(-t*8));
        const xx=Math.cos(a)*d+Math.sin(t*18+i)*2,yy=Math.sin(a)*d-t*(26+seed*18),r=Math.max(.4,(1.5+seed*1.2)*(1-q));
        polygon(c,[[xx-r,yy],[xx,yy-r*1.7],[xx+r,yy],[xx,yy+r]],i%3?YELLOW:WHITE);
      }
    }else if(element==='shock'){
      // Four bright branches and a compact core keep contact readable over the attack trail.
      if(age<.29){
        const phase=Math.floor(age/.032)%2,fade=1-clamp((age-.15)/.14),extent=(18+12*out)*(.58+.42*fade);
        const angles=[-2.48,-.82,.68,2.02];
        for(let i=0;i<4;i++){
          const a=angles[i]+(phase?.15:-.11),pts=[];
          for(let j=0;j<5;j++){
            const d=2+j*extent/5,side=(j%2?(phase?1:-1):0)*(3.8+i*.22);
            pts.push([Math.cos(a)*d-Math.sin(a)*side,Math.sin(a)*d+Math.cos(a)*side]);
          }
          for(let j=0;j<4;j++)needle(c,(pts[j][0]+pts[j+1][0])/2,(pts[j][1]+pts[j+1][1])/2,
            Math.atan2(pts[j+1][1]-pts[j][1],pts[j+1][0]-pts[j][0]),Math.hypot(pts[j+1][0]-pts[j][0],pts[j+1][1]-pts[j][1])+1,1.25*fade,i%2?YELLOW:WHITE);
        }
      }
      if(age<.12){
        const k=1-age/.12,r=9*k;
        polygon(c,[[-r,0],[0,-r*.72],[r,0],[0,r*.72]],WHITE);
        needle(c,0,0,0,31*k,1.35*k,WHITE);needle(c,0,0,Math.PI/2,25*k,1.1*k,YELLOW);
      }
    }else if(element==='frost'){
      // Powdery frost smoke: a low burst of soft puffs, like stepping on dry rime.
      if(age<.28){
        const spread=1-Math.pow(1-clamp(age/.13),2),grow=clamp(age/.045),decay=1-clamp((age-.12)/.16);
        for(let i=0;i<9;i++){
          const a=-Math.PI/2+i*Math.PI*2/9,d=6+21*spread;
          const xx=Math.cos(a)*d,yy=Math.sin(a)*d;
          const r=(4+(i%3)*1.15)*grow*decay;
          if(r>.35)puff(c,xx,yy,r,20+i,i%4===0?YELLOW:WHITE);
        }
        const center=3.8*grow*decay;if(center>.35)puff(c,0,0,center,33,YELLOW);
      }
      for(let i=0;i<13;i++){
        const delay=(i%4)*.016,t=age-delay;if(t<0||t>.36)continue;
        const q=t/.36,seed=((i*41+9)%101)/101,a=seed*Math.PI*2+i*.31;
        const grow=clamp(t/.055),shrink=1-clamp((t-.13)/.23);
        const d=(7+29*(1-Math.pow(1-q,2)));
        const xx=Math.cos(a)*d,yy=Math.sin(a)*d-q*3;
        const r=(2.6+seed*3.8)*grow*shrink;
        if(r>.35)puff(c,xx,yy,r,i,i%3?WHITE:YELLOW);
      }
    }else if(element==='arcane'){
      // A denser cloud of loose motes rises from contact; it stays organic and glyph-free.
      for(let i=0;i<19;i++){
        const delay=(i%6)*.016,t=age-delay;if(t<0||t>.46)continue;
        const q=t/.46,seed=((i*47+5)%97)/97,a=seed*Math.PI*2+t*(i%2?3.8:-3.1),d=6+(11+seed*21)*(1-Math.exp(-t*5.5));
        const xx=Math.cos(a)*d,yy=Math.sin(a)*d*.55-t*(23+seed*18),r=Math.max(.45,(1.75+seed*1.75)*Math.pow(1-q,1.15));
        polygon(c,[[xx-r,yy],[xx,yy-r*(i%3?1:1.8)],[xx+r,yy],[xx,yy+r]],i%3?WHITE:YELLOW);
      }
      if(age<.09){const k=1-age/.09,r=7*k;polygon(c,[[-r,0],[0,-r*.78],[r,0],[0,r*.78]],WHITE);}
    }else{
      // Neutral keeps the approved sharp, directional impact language.
      if(age<.14){const k=1-age/.14;for(let i=0;i<8;i++){const a=i*Math.PI/4+.15;needle(c,Math.cos(a)*15*out,Math.sin(a)*15*out,a,17*k,1.4*k,i%3?WHITE:YELLOW);}}
    }
    // Only lightning and neutral use generic impact chips; mist/motes stay pure.
    const chipCount=element==='shock'?(target==='ally'?4:5):element==='neutral'?(target==='ally'?7:9):0;
    for(let i=0;i<chipCount;i++){
      const chipLife=element==='shock'?.40:.32;
      const seed=((i*61+13)%97)/97,delay=(i%3)*.014,t=age-delay;if(t<0||t>chipLife)continue;
      const q=t/chipLife,a=-2.75+seed*5.5,d=(10+seed*31)*(1-Math.exp(-t*8));
      const len=(4+seed*6)*Math.pow(1-q,1.5);if(len>.8)needle(c,Math.cos(a)*d,Math.sin(a)*d,a,len,.65,i%4===0?'#b9caff':WHITE);
    }
    c.restore();
  }
  function renderElementHit(c,options){
    const previous=palette,previousPass=glowPass;palette=elements[options.element]||elements.neutral;
    const opacity=options.element==='frost'?.70:1;
    const passes=options.compact?[[4.5,.52],[0,1]]:[[8,.38],[2.2,.55],[0,1]];
    try{for(const [blur,alpha] of passes){
      c.save();try{glowPass=blur>0;c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha*opacity;hitCore(c,options);}finally{c.restore();}
    }}finally{palette=previous;glowPass=previousPass;}
  }
  function renderCore(c,{kind='slash',age=0,x=0,y=0,angle=0,scale=1,heavy=false,hit=true}) {
    if(age<0||age>timing.end)return;
    kind=kind==='slash'?'greatsword':kind==='blunt'?'hammer':kind;
    const weapon=weapons[kind];if(!weapon)return;
    const realAge=age;age*=timing.motionRate;
    c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle);c.scale(scale,scale);
    const t=age-.12, power=heavy?1.22:1;
    if(kind==='greatsword') {
      if(age>=.065 && age<.39){
        const p=clamp((age-.065)/.325),sweep=1-Math.pow(1-clamp((age-.065)/.19),2.2);
        const head=-1.22+3.2*sweep,decay=clamp((age-.14)/.25);
        const span=(.55+2.3*clamp((age-.065)/.05))*(1-.76*decay);
        const r=(40+6*p)*power,width=(2+6*clamp((age-.065)/.05))*Math.pow(1-decay,1.8)*power;
        ribbon(c,r,head-span,head,width,decay*.95);
        // Detached inner speed line: a second stroke, not a shading layer.
        if(age>.10&&age<.31)ribbon(c,r-12,head-span+.35,head-.28,1.3*(1-decay),decay);
        if(age>.18)ribbon(c,r+5,head-.7,head-.06,1.4*(1-decay),decay);
      }
      if(t>=0&&t<.11&&hit){
        const p=t/.11,s=1-p;
        needle(c,36+8*p,1+8*p,1.05,(62-20*p)*power,2.4*s,YELLOW);
        if(p<.5)needle(c,36,0,-.55,24*s,1.1,WHITE);
      }
    } else if(kind==='hammer') {
      if(age>.075&&t<.045){
        const p=clamp((age-.075)/.09);
        needle(c,16+18*p,0,0,42,3*(1-p)+1);
        needle(c,14+16*p,-8,0,26,1);
        needle(c,17+16*p,9,0,21,1);
      }
      if(t>=0&&t<.105&&hit){
        const p=t/.105,k=(1-Math.pow(p,1.4))*power;
        // An asymmetric manga impact: short compressed rear, long forward prongs.
        const shape=[[-9,-1],[-2,-5],[-7,-15],[5,-7],[20,-23],[12,-5],[38,-8],
          [15,1],[29,12],[9,6],[12,22],[1,8],[-5,14],[-3,4],[-12,5]];
        polygon(c,shape.map(([xx,yy])=>[35+xx*k,yy*k]),WHITE);
        needle(c,40,0,0,58*k,2*k,YELLOW);
      }
      if(t>.045&&t<.27&&hit){
        const p=(t-.045)/.225;
        c.save();c.translate(35+9*p,0);
        ribbon(c,12+28*p,-1.25,-.25,2.2*Math.pow(1-p,1.4),p);
        ribbon(c,12+28*p,.25,1.25,1.6*Math.pow(1-p,1.4),p);
        c.restore();
      }
    } else if(kind==='spear') {
      // Long reach with a narrow forward-driving head and separated rear lines.
      if(realAge>=.025&&realAge<.18){
        const p=clamp((realAge-.025)/.155),drive=clamp((realAge-.025)/.045);
        const head=16+60*(1-Math.pow(1-drive,2)),decay=clamp((realAge-.07)/.11);
        const length=(22+44*drive)*(1-decay),width=2.8*(1-decay);
        needle(c,head-length*.3,0,0,length,width);
        if(p<.65){needle(c,head-30,-5,0,28*(1-p),.65);needle(c,head-36,5,0,21*(1-p),.65);}
      }
      const b=realAge-weapon.contact;
      if(hit&&b>=0&&b<.065){
        const k=1-b/.065;needle(c,64,0,0,45*k,1.6*k,YELLOW);
        needle(c,61,0,Math.PI/2,18*k,.8*k);
      }
    } else if(kind==='bow') {
      // Arrow flight is visible before any impact. No projectile-wide star burst.
      if(realAge>=.04&&realAge<weapon.contact+(hit?.015:.10)){
        const p=(realAge-.04)/(weapon.contact-.04),head=10+87*p;
        needle(c,head-12,0,0,28,1,WHITE);
        polygon(c,[[head,0],[head-5,-3],[head-4,0],[head-5,3]],WHITE);
        needle(c,head-27,0,0,25,.5,YELLOW);
        if(p<.42){ribbon(c,10+10*p,-.8,.8,.8*(1-p));}
      }
      const b=realAge-weapon.contact;
      if(hit&&b>=0&&b<.055){
        const k=1-b/.055;needle(c,97,0,-.65,19*k,1.5*k,YELLOW);needle(c,97,0,.8,14*k,.7*k);
      }
    } else if(kind==='magicbolt') {
      // A compact solid orb with detached curling fragments, distinct from an arrow.
      if(realAge>=.015&&realAge<.065){
        const p=(realAge-.015)/.05;
        c.save();c.translate(9,0);ribbon(c,8-3*p,-2.8+3*p,1.1+3*p,1.2);c.restore();
        needle(c,9,0,Math.PI/2,12*(1-p),1,YELLOW);
      }
      if(realAge>=.055&&realAge<weapon.contact+(hit?.01:.10)){
        const p=(realAge-.055)/(weapon.contact-.055),head=11+86*p;
        for(let i=3;i>=1;i--){
          const xx=head-i*7,yy=Math.sin(p*12-i*.9)*2,r=2.6-i*.45;
          polygon(c,[[xx-r*2,yy],[xx,yy-r],[xx+r,yy],[xx,yy+r]],i%2?WHITE:YELLOW);
        }
        const orb=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;orb.push([head+Math.cos(a)*5.4,Math.sin(a)*4.6]);}polygon(c,orb,WHITE);
        c.save();c.translate(head,0);ribbon(c,9,-2.4+p*8,-.3+p*8,.7);c.restore();
      }
      const b=realAge-weapon.contact;
      if(hit&&b>=0&&b<.17){
        const p=b/.17;
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3+.2,d=5+16*(1-Math.pow(1-p,2));
          needle(c,97+Math.cos(a)*d,Math.sin(a)*d,a,18*Math.pow(1-p,1.5),2*(1-p),i%2?WHITE:YELLOW);
        }
        c.save();c.translate(97,0);ribbon(c,6+23*p,-2.8,-.2,2*(1-p),p);ribbon(c,6+23*p,.35,2.5,1.5*(1-p),p);c.restore();
      }
    } else if(kind==='swordaxe') {
      if(realAge>=.025&&realAge<.18){
        const p=(realAge-.025)/.155,head=-1.0+2.8*(1-Math.pow(1-p,2.5)),decay=clamp((realAge-.065)/.115);
        const span=(1+1.3*clamp(p*4))*(1-.75*decay);
        ribbon(c,32+3*p,head-span,head,4.2*Math.pow(1-decay,1.6),decay);
        if(p>.25)ribbon(c,39,head-.8,head-.2,.85*(1-decay),decay);
      }
      const b=realAge-weapon.contact;
      if(hit&&b>=0&&b<.06){const k=1-b/.06;needle(c,31,0,.9,34*k,1.6*k,YELLOW);}
    } else if(kind==='dagger') {
      if(realAge>=.02&&realAge<.115){
        const p=(realAge-.02)/.095,head=-.8+2.35*(1-Math.pow(1-p,2.4)),decay=clamp((realAge-.045)/.07);
        ribbon(c,24,head-1.5*(1-.65*decay),head,2.1*Math.pow(1-decay,1.5),decay);
        if(p>.23&&p<.7)needle(c,25,4,-.8,20*(1-decay),.8);
      }
      const b=realAge-weapon.contact;
      if(hit&&b>=0&&b<.04){const k=1-b/.04;needle(c,24,0,-.8,23*k,1.3*k,YELLOW);}
    }
    const burst=realAge-weapon.contact;
    if(burst>=0&&burst<.40&&hit){
      const n=weapon.particles;
      for(let i=0;i<n;i++){
        const seed=((i*73+19)%101)/101,life=(.20+seed*.19)*(kind==='dagger'?.65:kind==='bow'?.75:1);
        if(burst>life)continue;
        const p=burst/life,a=(i<15?-1.5+3*((i*47%97)/97):i*2.399)*weapon.spread;
        const speed=(200+seed*230)*weapon.speed,drag=6,d=speed/drag*(1-Math.exp(-drag*burst))*power;
        const px=weapon.reach+Math.cos(a)*d+burst*12,py=Math.sin(a)*d+burst*burst*35;
        const length=(i%4===0?24:10+seed*8)*Math.pow(1-p,1.7)*weapon.speed;
        const color=i%6===0?'#b9caff':i%3===0?YELLOW:WHITE;
        if(i%3!==1&&length>1)needle(c,px,py,a,length,Math.max(.3,(1.3+seed*.7)*(1-p)),color);
        else if(p<.85){const r=(1+seed)*(1-p);polygon(c,[[px-r,py],[px,py-r],[px+r,py],[px,py+r]],color);}
      }
    }
    c.restore();
  }
  function render(c,options){
    // Bloom surrounds the flat silhouette; the final pass keeps a sharp core.
    const previous=palette,previousPass=glowPass;palette=elements[options.element]||elements.neutral;
    const passes=options.compact?[[5,.58],[0,1]]:[[9,.45],[2.5,.60],[0,1]];
    try{for(const [blur,alpha] of passes){
      c.save();try{glowPass=blur>0;c.filter=blur?`blur(${blur}px)`:'none';c.globalAlpha*=alpha;
        renderCore(c,options);
      }finally{c.restore();}
    }}finally{palette=previous;glowPass=previousPass;}
  }
  window.AllyEffectStudy=Object.freeze({render,renderElementHit,timing,weapons,elements});
})();
