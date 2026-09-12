/* Ally/enemy target comparison for element-specific impact silhouettes. */
(() => {
  const fx=window.AllyEffectStudy,elements=['fire','shock','frost','arcane'],images={};
  const ally=new Image(),enemy=new Image();
  ally.src='assets/sprites/characters/allies/warrior-right-idle.png';
  enemy.src='assets/sprites/enemies/moss-ball/front-idle-v1.png';
  function actor(c,im,x,y,flip=false){
    c.fillStyle='#14251c';c.beginPath();c.ellipse(x,y+18,14,4,0,0,7);c.fill();
    if(im.complete&&im.naturalWidth){c.save();c.translate(x,y-3);if(flip)c.scale(-1,1);c.drawImage(im,-24,-24,48,48);c.restore();}
  }
  function floor(c,w,h){
    c.fillStyle='#22352c';c.fillRect(0,0,w,h);
    for(let yy=0;yy<h;yy+=16)for(let xx=0;xx<w;xx+=24){c.fillStyle=(xx*7+yy*13)%37<12?'#293c30':'#26392e';c.fillRect(xx+1+(yy%32?12:0),yy+1,22,14);}
  }
  function scene(c,element,age){
    const w=320,h=170;c.imageSmoothingEnabled=false;floor(c,w,h);
    c.fillStyle='#13251b';c.fillRect(159,14,1,142);
    actor(c,ally,81,84);actor(c,enemy,240,84);
    fx.renderElementHit(c,{element,age,x:81,y:82,target:'ally'});
    fx.renderElementHit(c,{element,age,x:240,y:82,target:'enemy'});
    c.fillStyle='#aabea4';c.font='8px monospace';c.fillText('ALLY HIT',62,132);c.fillText('ENEMY HIT',217,132);
  }
  window.ElementHitGallery=Object.freeze({elements,scene});
})();
