/* Shared six-weapon presentation scene, used by the live gallery and GIF export. */
(() => {
  const fx=window.AllyEffectStudy;
  const keys=Object.keys(fx.weapons),images={};
  const art={greatsword:'knight',hammer:'knight',spear:'warrior',bow:'hunter',swordaxe:'warrior',dagger:'rogue',magicbolt:'mage'};
  for(const key of keys){const im=new Image();im.src=`assets/sprites/characters/allies/${art[key]}-right-idle.png`;images[key]=im;}
  function scene(c,kind,age,{hit=true,element='neutral',elementHit=false}={}){
    const w=320,h=170,cfg=fx.weapons[kind],x=160-cfg.reach/2,y=84,t=age-cfg.contact;
    c.imageSmoothingEnabled=false;c.fillStyle='#22352c';c.fillRect(0,0,w,h);
    for(let yy=0;yy<h;yy+=16)for(let xx=0;xx<w;xx+=24){c.fillStyle=(xx*7+yy*13)%37<12?'#293c30':'#26392e';c.fillRect(xx+1+(yy%32?12:0),yy+1,22,14);}
    c.fillStyle='#15291e';c.fillRect(0,0,w,8);c.fillStyle='#42523a';c.fillRect(0,8,w,1);
    const rebound=hit&&t>=0?5*Math.pow(Math.max(0,1-t/.18),2):0,tx=Math.round(x+cfg.reach+rebound);
    c.fillStyle='#14241c';c.beginPath();c.ellipse(tx,y+17,13,5,0,0,7);c.fill();
    const contact=hit&&t>=0&&t<.055;
    const flash=element==='neutral'?'#fffbe1':(fx.elements[element]||fx.elements.neutral).accent;
    c.fillStyle=contact?flash:'#574c35';c.fillRect(tx-2,y-1,4,21);
    c.fillStyle=contact?flash:'#9b8554';c.fillRect(tx-9,y-12,18,21);c.fillRect(tx-16,y-4,32,4);
    c.fillStyle=contact?flash:'#c4aa71';c.fillRect(tx-6,y-10,12,3);
    c.fillStyle=contact?flash:'#645638';c.fillRect(tx-9,y+1,18,2);c.fillRect(tx-2,y-12,3,21);
    const lunge=age<cfg.contact?-3*Math.sin(age/cfg.contact*Math.PI):4*Math.pow(Math.max(0,1-t/.11),2),px=Math.round(x+lunge);
    c.fillStyle='#14251c';c.beginPath();c.ellipse(px,y+18,14,4,0,0,7);c.fill();
    const im=images[kind];if(im.complete&&im.naturalWidth)c.drawImage(im,px-24,y-27,48,48);
    c.fillStyle='#b5d69e';c.fillRect(px-9,y+26,18,2);
    fx.render(c,{kind,age,x,y,hit,element});
    if(hit&&elementHit&&element!=='neutral')fx.renderElementHit(c,{element,age:t,x:x+cfg.reach,y,target:'enemy',scale:.78});
  }
  window.WeaponEffectGallery=Object.freeze({keys,scene});
})();
