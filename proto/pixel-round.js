/* 盤面の円をドットの段に（2026-10-04 ユーザー要望「UIなどの角丸や円を使用しているものは全てドット絵で整形しておいて」）
   画面のキャンバス（#cv）の arc / ellipse だけを差し替える。
   - 円の縁を「画面のドット」（洞窟の1ドット＝TS/16 の CSS px）の格子に合わせ、縦横の段だけでつなぐ。
     塗っても線で描いても、ドットの円・弧になる。点線（setLineDash）・切り抜き（clip）もそのまま使える。
   - 格子は**画面の**格子（デバイス座標で丸めてから、今の変換の逆で戻す）。回転・拡大の中で描いた弧も、画面のドットに乗る。
   - ドット1つより小さい円は、ドット1つの四角。
   - 光の下地などの別のキャンバスは触らない（柔らかい光はそのまま）。
   PXROUND.on=false で元の滑らかな円に戻る（見比べ用）。 */
(function(){
  const cv=document.getElementById('cv'); if(!cv) return;
  const c=cv.getContext('2d'); if(!c) return;
  const oArc=c.arc.bind(c), oEll=c.ellipse.bind(c), TAU=Math.PI*2;
  const PXR=window.PXROUND={on:true, calls:0,
    grid(){ const ts=(typeof TS==='number'&&TS>0)?TS:30, dpr=(typeof _dpr==='number'&&_dpr>0)?_dpr:1; return ts/16*dpr; }};
  function stepped(x,y,rx,ry,rot,a0,a1,ccw){
    if(!(rx>0)||!(ry>0)||!isFinite(x+y+rx+ry+a0+a1)) return false;
    PXR.calls++;
    const m=c.getTransform(), g=PXR.grid();
    const det=m.a*m.d-m.b*m.c; if(!det) return false;
    const toU=(X,Y)=>{ X-=m.e; Y-=m.f; return [( m.d*X-m.c*Y)/det, (-m.b*X+m.a*Y)/det]; };
    const toD=(px,py)=>[m.a*px+m.c*py+m.e, m.b*px+m.d*py+m.f];
    const [CX,CY]=toD(x,y);
    const sc=Math.sqrt(Math.abs(det)), rd=Math.max(rx,ry)*sc;
    const line=(X,Y)=>{ const [u,v]=toU(X,Y); c.lineTo(u,v); };
    if(rd<g*.9){                                     // ドット1つより小さい：ドット1つの四角
      const X=Math.floor(CX/g)*g, Y=Math.floor(CY/g)*g;
      line(X,Y); line(X+g,Y); line(X+g,Y+g); line(X,Y+g); line(X,Y);
      return true;
    }
    let s=a0, e=a1;
    if(!ccw){ if(e-s>=TAU) e=s+TAU; else { while(e<s) e+=TAU; } }
    else { if(s-e>=TAU) e=s-TAU; else { while(e>s) e-=TAU; } }
    const span=Math.abs(e-s), n=Math.max(8,Math.min(900,Math.ceil(span*rd/g*1.15)));
    const cr=Math.cos(rot||0), sr=Math.sin(rot||0);
    let px=null, py=null;
    for(let i=0;i<=n;i++){
      const t=s+(e-s)*i/n, lx=rx*Math.cos(t), ly=ry*Math.sin(t);
      const [X0,Y0]=toD(x+lx*cr-ly*sr, y+lx*sr+ly*cr);
      const X=Math.round(X0/g)*g, Y=Math.round(Y0/g)*g;
      if(px===null){ line(X,Y); px=X; py=Y; continue; }
      if(X===px&&Y===py) continue;
      if(X!==px&&Y!==py){                            // 斜めには進まない：中心から遠い側の角を通る
        const d1=(X-CX)**2+(py-CY)**2, d2=(px-CX)**2+(Y-CY)**2;
        if(d1>=d2) line(X,py); else line(px,Y);
      }
      line(X,Y); px=X; py=Y;
    }
    return true;
  }
  c.arc=function(x,y,r,a0,a1,ccw){
    if(!PXR.on||!stepped(x,y,r,r,0,a0,a1,!!ccw)) return oArc(x,y,r,a0,a1,ccw);
  };
  c.ellipse=function(x,y,rx,ry,rot,a0,a1,ccw){
    if(!PXR.on||!stepped(x,y,rx,ry,rot,a0,a1,!!ccw)) return oEll(x,y,rx,ry,rot,a0,a1,ccw);
  };
})();
