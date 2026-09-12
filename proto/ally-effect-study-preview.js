(() => {
  'use strict';
  const $=id=>document.getElementById(id), fx=window.AllyEffectStudy;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let age=reduced.matches?.16:0,playing=!reduced.matches,last=0;
  const warrior=new Image(),knight=new Image();
  warrior.src='assets/sprites/characters/allies/warrior-right-idle.png';
  knight.src='assets/sprites/characters/allies/knight-right-idle.png';
  const clamp=v=>Math.max(0,Math.min(1,v));
  function floor(c,w,h){
    c.fillStyle='#22352c';c.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=24){const n=(x*7+y*13)%37;c.fillStyle=n<12?'#293c30':'#26392e';c.fillRect(x+1+(y%32?12:0),y+1,22,14);c.fillStyle='#304133';if(n<9)c.fillRect(x+6,y+8,3,1);}
    c.fillStyle='#15291e';c.fillRect(0,0,w,12);c.fillStyle='#42523a';c.fillRect(0,12,w,2);
  }
  function dummy(c,x,y,t){
    const contact=t>=0&&t<.075&&$('hit').checked;
    c.fillStyle='#14241c';c.beginPath();c.ellipse(x,y+17,13,5,0,0,Math.PI*2);c.fill();
    c.fillStyle=contact?'#fffbe1':'#574c35';c.fillRect(x-2,y-1,4,21);
    c.fillStyle=contact?'#fffbe1':'#9b8554';c.fillRect(x-9,y-12,18,21);c.fillRect(x-16,y-4,32,4);
    c.fillStyle=contact?'#fffbe1':'#c4aa71';c.fillRect(x-6,y-10,12,3);c.fillStyle=contact?'#fffbe1':'#645638';c.fillRect(x-9,y+1,18,2);c.fillRect(x-2,y-12,3,21);
    c.fillStyle='#76925c';c.fillRect(x-11,y+25,22,2);
  }
  function scene(c,kind,a,w,h,small=false){
    c.imageSmoothingEnabled=false;floor(c,w,h);
    const angle=Number($('direction').value),dx=Math.cos(angle),dy=Math.sin(angle),t=a-fx.timing.contact;
    const cx=w/2-dx*20,cy=h/2+5-dy*20;
    const recoil=$('hit').checked&&t>=0?5*Math.pow(1-clamp(t/.22),2):0;
    const lunge=a<fx.timing.contact?-3*Math.sin(clamp(a/fx.timing.contact)*Math.PI):5*Math.pow(1-clamp(t/.11),2);
    if(!$('solo').checked){
      dummy(c,Math.round(cx+dx*(36+recoil)),Math.round(cy+dy*(36+recoil)),t);
      const px=Math.round(cx+dx*lunge),py=Math.round(cy+dy*lunge),im=kind==='slash'?warrior:knight;
      c.fillStyle='#14251c';c.beginPath();c.ellipse(px,py+18,14,4,0,0,7);c.fill();
      if(im.complete&&im.naturalWidth){c.save();c.translate(px,py-3);if(dx<-.1)c.scale(-1,1);c.drawImage(im,-24,-24,48,48);c.restore();}
      c.fillStyle='#b5d69e';c.fillRect(px-9,py+26,18,2);
    }
    fx.render(c,{kind,age:a,x:cx,y:cy,angle,heavy:$('heavy').checked,hit:$('hit').checked});
    if(!small){c.fillStyle='#99ae8c';c.font='8px monospace';c.fillText('ALLY',cx-9,cy+41);c.fillStyle='#6c836b';c.fillText('TRAINING GROUND',12,h-12);}
  }
  function film(){const c=$('film').getContext('2d'),times=[.08,.12,.16,.23,.34,.50];c.clearRect(0,0,720,176);['slash','blunt'].forEach((kind,j)=>times.forEach((t,i)=>{c.save();c.translate(i*120,j*88);c.beginPath();c.rect(0,0,120,88);c.clip();scene(c,kind,t,120,88,true);c.fillStyle='#17261c';c.fillRect(0,0,120,13);c.fillStyle='#b6c5a8';c.font='8px monospace';c.fillText(`${j?'B':'S'} / ${Math.round(t*1000)} ms`,7,9);c.strokeStyle='#40503b';c.strokeRect(.5,.5,119,87);c.restore();}));}
  function draw(){['slash','blunt'].forEach(k=>scene($(k).getContext('2d'),k,age,320,188));$('scrub').value=Math.min(700,Math.round(age*1000));$('time').textContent=String(Math.min(700,Math.round(age*1000))).padStart(3,'0')+' ms';$('phase').textContent=age<.06?'予備動作':age<.11?'着弾':age<.48?'余韻':'待機';$('pause').textContent=playing?'一時停止':'再開';}
  function frame(now){if(last&&playing){age+=Math.min((now-last)/1000,.05)*Number($('speed').value);if(age>=($('loop').checked?fx.timing.cycle:.7)){if($('loop').checked)age=0;else{age=.7;playing=false;}}}last=now;draw();requestAnimationFrame(frame);}
  $('replay').onclick=()=>{age=0;playing=true;};$('pause').onclick=()=>{playing=!playing;if(playing&&age>=.7)age=0;};
  const step=()=>{playing=false;age=age>=.7?0:Math.min(.7,age+1/60);draw();};$('step').onclick=step;
  $('scrub').oninput=()=>{playing=false;age=Number($('scrub').value)/1000;draw();};
  ['heavy','hit','solo','direction'].forEach(k=>$(k).onchange=()=>{film();draw();});
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(e.code==='ArrowRight'){e.preventDefault();step();}});
  warrior.onload=knight.onload=()=>{film();draw();};warrior.onerror=knight.onerror=()=>{$('phase').textContent='画像読込失敗';};
  if(reduced.matches)$('loop').checked=false;
  film();requestAnimationFrame(frame);
})();
