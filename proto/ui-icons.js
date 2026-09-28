/* =====================================================================
   UIのアイコン（16×16 のドット絵）
   ---------------------------------------------------------------------
   画面のあちこちで絵文字をアイコン代わりに使っていた（🎒 🗺 🛡 🔨 …）。
   絵文字は端末が持っているフォントで描かれるので、
     ・ドット絵の盤面の横に、なめらかでつるっとした絵が並ぶ
     ・端末ごとに形も色も違う（同じ画面が人によって別物になる）
     ・大きさの基準がフォント任せで、揃えようとしても揃わない
   という三重の問題があった。ここで描き直して、全部こちらの絵にする。

   持ち物の**中身**（剣・鎧・薬…）は item-icons.js が既にドット絵を持っている。
   そちらと重複させず、ここは「画面の部品」だけを受け持つ
   ——ボタン、見出し、ログに出る記号、職業の印。

   作り方
     16×16 の升目に、下の小さな道具（px / rect / line / ell / tri）で描く。
     描き終わると 1枚の <style> にまとめて焼き込み、`.pi.pi-<名前>` で貼れる。
     data: URL なので追加の読み込みは無い。
     使う側は <i class="pi pi-bag"></i> と書くだけ。大きさは font-size に追従する。
   ===================================================================== */
(()=>{
'use strict';
const N=16;

/* 盤面と同じ色味に寄せた小さな台。明→暗の3段を持つ物は 大文字=明るい側。 */
const P={
  o:'#12151c',                                  // 輪郭
  d:'#394154', m:'#6d7b94', l:'#a9b6cb', w:'#e6ecf4',   // 無彩色
  g:'#c9a441', G:'#f0d381',                     // 金
  r:'#a8503c', R:'#dd8464',                     // 赤
  b:'#43788f', B:'#7cc0dd',                     // 青
  n:'#5f8c42', N:'#9ec66e',                     // 緑
  t:'#7d6040', T:'#bb9264',                     // 木・革
  v:'#7a5a9a', V:'#b08ad0',                     // 紫
  k:'#2a3040',                                  // 影（輪郭より薄い）
};

const defs={};
function icon(name, paint){
  const g=Array.from({length:N},()=>Array(N).fill(''));
  const put=(x,y,c)=>{ x=Math.round(x); y=Math.round(y);
    if(x>=0&&y>=0&&x<N&&y<N&&c) g[y][x]=c; };
  const api={
    px:put,
    rect:(x,y,w,h,c)=>{ for(let j=0;j<h;j++)for(let i=0;i<w;i++) put(x+i,y+j,c); },
    /* 枠だけ */
    frame:(x,y,w,h,c)=>{ for(let i=0;i<w;i++){ put(x+i,y,c); put(x+i,y+h-1,c); }
                         for(let j=0;j<h;j++){ put(x,y+j,c); put(x+w-1,y+j,c); } },
    line:(x0,y0,x1,y1,c)=>{ const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;
      for(let i=0;i<=n;i++) put(x0+(x1-x0)*i/n, y0+(y1-y0)*i/n, c); },
    ell:(cx,cy,rx,ry,c)=>{ for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)
      for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
        const nx=(x-cx)/rx, ny=(y-cy)/ry; if(nx*nx+ny*ny<=1.05) put(x,y,c); } },
    tri:(ax,ay,bx,by,cx2,cy2,c)=>{ const mnx=Math.min(ax,bx,cx2), mxx=Math.max(ax,bx,cx2);
      const mny=Math.min(ay,by,cy2), mxy=Math.max(ay,by,cy2);
      const s=(x1,y1,x2,y2,x3,y3)=>(x1-x3)*(y2-y3)-(x2-x3)*(y1-y3);
      for(let y=mny;y<=mxy;y++)for(let x=mnx;x<=mxx;x++){
        const d1=s(x,y,ax,ay,bx,by), d2=s(x,y,bx,by,cx2,cy2), d3=s(x,y,cx2,cy2,ax,ay);
        const neg=(d1<0)||(d2<0)||(d3<0), pos=(d1>0)||(d2>0)||(d3>0);
        if(!(neg&&pos)) put(x,y,c); } },
    P,
  };
  paint(api);
  defs[name]=g;
}

/* 描いた中身の外側に1ドットの輪郭を回す。**輪郭は最後に一度だけ。**
   描きながら縁を引くと、後から重ねた部分で縁が内側に残って濁る。 */
function outline(g){
  const out=g.map(r=>r.slice());
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(g[y][x]) continue;
    let near=false;
    for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++){
      if(dx&&dy) continue;                       // 斜めは縁にしない（角が太る）
      const r=g[y+dy]; if(r&&r[x+dx]){ near=true; break; }
    }
    if(near) out[y][x]=P.o;
  }
  return out;
}

function toURL(g){
  const c=document.createElement('canvas'); c.width=c.height=N;
  const x=c.getContext('2d');
  for(let y=0;y<N;y++)for(let i=0;i<N;i++){ const v=g[y][i]; if(!v) continue;
    x.fillStyle=v; x.fillRect(i,y,1,1); }
  return c.toDataURL();
}

/* ================= 絵 ================= */

/* --- 拠点のボタン --- */
icon('gift',   a=>{ a.rect(2,7,12,7,P.r); a.rect(2,5,12,3,P.R); a.rect(7,5,2,9,P.G);
                    a.rect(2,7,12,1,P.g); a.px(5,4,P.G); a.px(4,3,P.G); a.px(10,4,P.G); a.px(11,3,P.G);
                    a.px(6,3,P.G); a.px(9,3,P.G); });
/* 道具屋は**店先**にする。かごや鞄にすると「持ち物」と見分けが付かない。 */
icon('shop',   a=>{ a.rect(2,7,12,7,P.d); a.rect(4,9,4,5,P.k);             // 建屋と入口
                    for(let i=0;i<12;i+=2){ a.rect(2+i,4,2,3,P.r); a.rect(3+i,4,1,3,P.w); }
                    a.rect(1,7,14,1,P.l); a.rect(10,9,3,3,P.b); });
icon('hall',   a=>{ a.tri(8,1,1,6,15,6,P.l); a.rect(2,6,12,1,P.w);         // 切妻
                    for(const x of [3,6,9,12]) a.rect(x,7,2,6,P.m);
                    a.rect(1,13,14,2,P.l); });
icon('forge',  a=>{ a.rect(9,2,5,4,P.m); a.rect(9,2,5,2,P.l);              // 頭
                    a.line(8,6,3,12,P.t); a.line(9,6,4,12,P.T); a.rect(2,12,3,2,P.t); });
icon('tavern', a=>{ a.rect(3,5,8,9,P.T); a.rect(3,5,8,2,P.w);              // 泡
                    a.px(4,3,P.w); a.px(6,2,P.w); a.px(8,3,P.w);
                    a.rect(11,7,3,1,P.m); a.px(13,8,P.m); a.px(13,9,P.m); a.rect(11,10,3,1,P.m);
                    a.rect(4,8,2,5,P.t); });
icon('stash',  a=>{ a.rect(2,5,12,9,P.t); a.rect(2,5,12,2,P.T);            // 箱
                    a.rect(7,5,2,9,P.T); a.rect(2,9,12,1,P.T); });
icon('candle', a=>{ a.rect(6,6,4,7,P.w); a.rect(6,6,4,2,P.l);
                    a.rect(4,13,8,2,P.m); a.ell(8,3.4,1.4,2.2,P.G); a.px(8,2,P.w); });
icon('scale',  a=>{ a.rect(7,3,2,10,P.m); a.rect(3,4,11,1,P.l);
                    a.line(4,5,2,8,P.m); a.line(4,5,6,8,P.m); a.rect(2,8,5,1,P.l);
                    a.line(12,5,10,8,P.m); a.line(12,5,14,8,P.m); a.rect(10,8,5,1,P.l);
                    a.rect(5,13,6,2,P.m); });
/* 試練の石碑。顔に見えないよう、彫り込みは縦の溝だけにする。 */
icon('monument',a=>{ a.rect(4,2,8,12,P.m); a.tri(8,0,4,3,12,3,P.m);
                    a.rect(4,2,2,12,P.l); a.rect(11,2,1,12,P.d);
                    a.rect(7,5,1,6,P.k); a.rect(9,6,1,4,P.k);
                    a.rect(2,14,12,2,P.d); });
icon('fountain',a=>{ a.rect(2,10,12,4,P.b); a.rect(2,10,12,1,P.B);
                    a.rect(7,4,2,6,P.m); a.px(8,2,P.B); a.px(6,3,P.B); a.px(10,3,P.B);
                    a.px(5,5,P.B); a.px(11,5,P.B); });
icon('urn',    a=>{ a.ell(8,9,4.5,5,P.T); a.ell(8,9,3,3.4,P.t);
                    a.rect(6,2,4,2,P.T); a.rect(5,4,6,1,P.t); });

/* --- 探索中のボタン --- */
icon('shield', a=>{ a.tri(8,14,2,5,14,5,P.B); a.rect(2,3,12,3,P.B);
                    a.tri(8,11,5,5,11,5,P.w); a.rect(5,4,6,2,P.w); });
icon('bag',    a=>{ a.rect(2,6,12,9,P.t); a.rect(2,6,12,2,P.T);
                    a.line(5,6,6,2,P.T); a.line(11,6,10,2,P.T); a.rect(6,2,5,1,P.T);
                    a.rect(6,9,4,3,P.G); });
icon('map',    a=>{ a.rect(2,3,12,11,P.T); a.rect(2,3,12,2,P.w);
                    a.rect(4,7,3,1,P.t); a.rect(8,6,4,1,P.t); a.rect(5,10,6,1,P.t);
                    a.px(11,10,P.r); a.px(12,9,P.r); a.px(12,11,P.r); a.px(11,9,P.r); });
icon('person', a=>{ a.ell(8,4,2.2,2.2,P.T); a.rect(6,7,5,5,P.B);
                    a.rect(4,7,2,4,P.B); a.rect(11,7,2,4,P.B);
                    a.rect(6,12,2,3,P.d); a.rect(9,12,2,3,P.d); });

/* --- ログ・見出しに出る記号 --- */
/* つるはし。頭を「片側が尖り、片側が平ら」にすると鶴嘴だと分かる。 */
/* 頭を3ドットに厚くしてある。2ドットだと、12px まで縮んだとき
   （左上の採掘数のところ）に細い「↑」に見えてツルハシに読めなかった。 */
icon('pick',   a=>{ a.line(1,7,7,4,P.l); a.line(1,8,7,5,P.m); a.line(1,9,7,6,P.d);
                    a.line(9,4,15,7,P.l); a.line(9,5,15,8,P.m); a.line(9,6,15,9,P.d);
                    a.rect(7,4,2,3,P.m);
                    a.rect(7,7,2,8,P.t); a.rect(8,7,1,8,P.T); });
icon('fire',   a=>{ a.tri(8,1,3,10,13,10,P.r); a.rect(3,9,11,4,P.r);
                    a.tri(8,5,5,11,11,11,P.G); a.rect(5,10,7,3,P.G);
                    a.tri(8,9,6,13,10,13,P.w); });
icon('skull',  a=>{ a.ell(8,7,5,4.6,P.w); a.rect(5,11,6,3,P.w);
                    a.rect(4,10,8,1,P.l); a.px(6,6,P.o); a.px(10,6,P.o);
                    a.rect(6,6,2,2,P.k); a.rect(9,6,2,2,P.k); a.rect(7,11,2,2,P.k); });
icon('warn',   a=>{ a.tri(8,1,1,14,15,14,P.g); a.tri(8,3,3,13,13,13,P.G);
                    a.rect(7,5,2,4,P.k); a.rect(7,10,2,2,P.k); });
/* 幕は布の色で塗る。緑にしていたら、小さくすると木に見えた。 */
icon('tent',   a=>{ a.tri(8,2,1,14,15,14,P.T); a.tri(8,2,8,14,15,14,P.t);
                    a.tri(8,6,6,14,10,14,P.k); a.px(8,1,P.w); });
icon('bulb',   a=>{ a.ell(8,6,4,4.4,P.G); a.rect(6,10,5,2,P.m); a.rect(6,12,5,2,P.l);
                    a.px(6,4,P.w); a.px(7,3,P.w); });
icon('bug',    a=>{ a.ell(8,9,4,4.6,P.r); a.rect(7,5,3,9,P.k);
                    a.ell(8,4,2.6,2.2,P.k); a.px(5,7,P.k); a.px(11,7,P.k);
                    a.px(5,11,P.k); a.px(11,11,P.k); a.px(6,9,P.k); a.px(10,9,P.k); });
icon('ad',     a=>{ a.frame(1,3,14,10,P.m); a.rect(2,4,12,8,P.d);
                    a.tri(6,6,6,11,11,8.5,P.w); a.rect(6,13,4,1,P.m); });
icon('lock',   a=>{ a.rect(3,7,10,8,P.g); a.rect(3,7,10,2,P.G);
                    a.frame(5,2,6,6,P.l); a.rect(7,10,2,3,P.k); });
icon('swirl',  a=>{ a.ell(8,8,6,6,P.B); a.ell(8,8,4,4,P.k);
                    a.ell(8,8,2.4,2.4,P.B); a.rect(8,2,6,3,P.k); a.rect(2,8,4,3,P.k); });

icon('chain',  a=>{ a.frame(1,6,6,5,P.l); a.frame(5,6,6,5,P.m); a.frame(9,6,6,5,P.l); });
icon('orb',    a=>{ a.ell(8,7,5,5,P.V); a.ell(6.5,5.5,2,2,P.w);
                    a.rect(5,12,7,2,P.g); a.rect(6,14,5,1,P.d); });
icon('coin',   a=>{ a.ell(8,8,6,6,P.g); a.ell(8,8,4,4,P.G); a.rect(7,5,2,6,P.g); });
/* 交差した剣＝「戦っている」。盤面の仲間の頭上に出るので、
   12px 程度まで縮む。刃は明るい側だけで引いて、X の形だけを残す。 */
icon('swords', a=>{ a.line(3,12,12,3,P.l); a.line(4,12,13,4,P.w);
                    a.line(12,12,3,3,P.l); a.line(11,12,2,4,P.w);
                    a.rect(2,12,3,3,P.t); a.rect(11,12,3,3,P.t);
                    a.px(13,3,P.G); a.px(2,3,P.G); });
/* 上向きの矢＝能力強化。幅を広く取って、小さくても矢だと分かるようにする。 */
icon('up',     a=>{ a.tri(8,2,2,9,14,9,P.B); a.rect(6,9,5,5,P.b);
                    a.line(8,3,8,8,P.w); a.px(6,9,P.B); });

/* --- 職業の印（仲間の一覧・墓標） --- */
icon('j_warrior',a=>{ a.line(3,13,12,3,P.l); a.line(4,13,13,3,P.w);
                      a.rect(11,2,3,3,P.w); a.line(3,9,7,13,P.m); a.rect(2,12,3,3,P.m); });
icon('j_knight', a=>{ a.tri(8,14,3,5,13,5,P.l); a.rect(3,3,10,3,P.l);
                      a.tri(8,11,6,5,10,5,P.B); a.rect(6,4,4,2,P.B); });
icon('j_hunter', a=>{ a.line(11,2,11,13,P.T); a.line(12,3,12,12,P.t);
                      a.line(11,3,5,7,P.l); a.line(11,12,5,8,P.l); a.line(3,7,13,7,P.w); });
icon('j_mage',   a=>{ a.line(4,14,11,4,P.t); a.ell(12,3,2.6,2.6,P.V);
                      a.px(12,2,P.w); a.px(11,3,P.w); });
icon('j_rogue',  a=>{ a.line(4,12,11,4,P.l); a.line(5,12,12,4,P.w);
                      a.rect(3,11,3,3,P.t); });
icon('j_priest', a=>{ a.rect(7,2,3,12,P.G); a.rect(4,5,9,3,P.G);
                      a.px(8,1,P.w); a.px(5,6,P.w); });

/* ================= 焼き込み ================= */
const url={}, css=[];
for(const k in defs){ url[k]=toURL(outline(defs[k])); css.push('.pi-'+k+'{background-image:url('+url[k]+')}'); }
const st=document.createElement('style');
st.textContent=
  /* font-size に追従させる。**縦の位置は -.14em で文字のベースラインに合わせる**
     ——ここを揃えないと、見出しの中でアイコンだけ浮いて見える。 */
  '.pi{display:inline-block;width:1em;height:1em;vertical-align:-.14em;'
 +'background-position:center;background-size:contain;background-repeat:no-repeat;'
 +'image-rendering:pixelated;image-rendering:crisp-edges}\n'
 + css.join('\n');
document.head.appendChild(st);

/* 盤面（canvas）に置く用。<img> にしておくと drawImage で貼れる。
   data: URL なので読み込みは同期的に終わる（待ちは要らない）。 */
const imgs={};
for(const k in url){ const im=new Image(); im.src=url[k]; imgs[k]=im; }

/* 持ち物の中身（剣・鎧・薬…）は item-icons.js が既に絵を持っているので、
   ここでは描き直さずにそれを借りる。同じ物が2種類あると必ず食い違う。 */
const itemCache={};
function itemUrl(name){
  if(itemCache[name]!==undefined) return itemCache[name];
  let u=null;
  try{
    const sp=(typeof ITEM_ART!=='undefined') && ITEM_ART.sprites && ITEM_ART.sprites[name];
    if(sp) u=sp.toDataURL();
  }catch(e){}
  itemCache[name]=u; return u;
}

window.UI_ICONS={
  url, imgs,
  names:Object.keys(defs),
  /* 文字列でUIを組み立てている所から使う。 */
  html:(name,style)=>'<i class="pi pi-'+name+'"'+(style?' style="'+style+'"':'')+'></i>',
  /* 持ち物の絵を1つ、同じ見た目の <i> で返す（無ければ空文字） */
  itemHtml:(name)=>{ const u=itemUrl(name);
    return u ? '<i class="pi" style="background-image:url('+u+')"></i>' : ''; },
  /* 盤面に置く。x,y は中心、size は画面px。 */
  draw:(c,name,x,y,size)=>{ const im=imgs[name]; if(!im||!im.complete) return false;
    const s=Math.max(8,Math.round(size)); c.save(); c.imageSmoothingEnabled=false;
    c.drawImage(im, Math.round(x-s/2), Math.round(y-s/2), s, s); c.restore(); return true; },
};
})();
