/* Visual-only host for a copy of the current game. No simulation or game save. */
addEventListener('load',()=>{
 try{
  S.name='描画サンプル';S.salt=472;S.hero=newHero();startRun(1);
  const room=W.fl.rooms.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];
  const cx=room.x+room.w/2,cy=room.y+room.h/2;
  W.seen.forEach(row=>row.fill(1));
  W.enemies=W.enemies.slice(0,6);
  const points=[[-.30,-.28],[.28,-.32],[-.3,.28],[.3,.3],[.05,-.37],[.34,.02]];
  W.enemies.forEach((e,i)=>{e.x=cx+points[i][0]*room.w;e.y=cy+points[i][1]*room.h});
  // The sample's adjustable vignette replaces the game's fixed vignette.
  drawFeelVignette=()=>{};
  window.renderTiltDungeon=seconds=>{
   P.x=cx+Math.sin(seconds*.3)*Math.min(1,room.w*.08);
   P.y=cy+Math.sin(seconds*.2)*Math.min(.6,room.h*.06);
   FEEL.time=seconds;_drawDt=1/12;draw();return cv;
  };
  window.renderTiltDungeon(0);window.tiltDungeonReady=true;
 }catch(e){window.tiltDungeonError=e.message;console.error(e)}
});
