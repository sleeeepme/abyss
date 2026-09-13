/* 24×24 source pixels. Paint interiors first; derive exactly one outline pixel.
   Keep vertical center axes symmetric; highlights alone may be asymmetric. */
const ITEM_ART = (()=>{
  // One dark outline plus five deliberately separated material tones per icon.
  // The ramps borrow the benchmark's deep violet shadows and bright speculars.
  const palette={o:'#171323',s:'#536078',m:'#95a8c2',l:'#d9e7ef',w:'#fff6dc',
    d:'#4b2930',b:'#8e4d3a',t:'#c77b50',g:'#efb85b',r:'#a32648',h:'#ef4960',
    p:'#ff8b8f',c:'#258eb5',a:'#55d9dc',z:'#17536f',x:'#263783',y:'#4059b8',
    j:'#476f73',k:'#79a1a0',e:'#b9d8d1',v:'#2e733d',n:'#6cbc4e',f:'#b8e778',q:'#343b50',u:'#58777b',i:'#91aaa8'};
  const sprites={},maps={},cache=new Map();
  function make(name,paint){
    const pixels=Array.from({length:24},()=>Array(24).fill(''));
    const rect=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixels[j][i]=c;};
    // Odd widths share x=11 as their center axis.
    const row=(y,width,c)=>rect(11-(width-1)/2,y,width,1,c);
    paint({rect,row});
    // Rotate only the interior on the pixel grid, then rebuild the 1 px outline.
    // This avoids rotated outlines becoming thick or antialiased.
    if(name==='bow'){
      const rotated=Array.from({length:24},()=>Array(24).fill(''));
      const c=Math.SQRT1_2;
      for(let y=0;y<24;y++)for(let x=0;x<24;x++){
        const sx=Math.round(11+c*(x-11)+c*(y-11));
        const sy=Math.round(11-c*(x-11)+c*(y-11));
        rotated[y][x]=pixels[sy]?.[sx]||'';
      }
      maps[name]=rotated;
    }else maps[name]=pixels;
    sprites[name]=render(name,palette.o);
  }
  function render(name,outline,edgeOnly=false){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
    const ctx=canvas.getContext('2d'),pixels=maps[name];
    for(let y=0;y<24;y++)for(let x=0;x<24;x++){
      const c=pixels[y][x];
      // Four-connected one-pixel perimeter avoids swollen diagonal corners.
      const edge=!c&&[[0,-1],[0,1],[-1,0],[1,0]].some(([dx,dy])=>pixels[y+dy]?.[x+dx]);
      if((c&&!edgeOnly)||edge){ctx.fillStyle=c?palette[c]:outline;ctx.fillRect(x,y,1,1);}
    }
    return canvas;
  }
  // Blade tips are authored on the final diagonal grid, not rotated from a
  // horizontal cap. The taper converges on exactly one interior pixel.
  function blade(name,tipX,tipY,length,halfWidth,guard,grip){
    make(name,({rect})=>{
      const gx=tipX-length,gy=tipY+length;
      for(let i=1;i<=grip;i++)rect(gx-i,gy+i,1,1,'b');
      rect(gx-grip-1,gy+grip+1,1,1,'l');
      for(let y=1;y<23;y++)for(let x=1;x<23;x++){
        const along=(tipX-x+y-tipY)/2,across=(x+y-tipX-tipY)/2;
        if(along>=0&&along<length&&Math.abs(across)<=Math.min(halfWidth,along*.5))
          rect(x,y,1,1,across<0?'l':across===0?'w':'m');
      }
      for(let i=-guard;i<=guard;i++)rect(gx+i,gy+i,1,1,'g');
      rect(gx,gy+1,1,1,'b');
    });
  }
  blade('sword',20,3,11,1.35,3,3);
  // Broad, rounded steel blade with flared shoulders and no separate crossguard.
  // Its dark teal face and pale bevel distinguish it from the slim silver sword.
  make('great',({rect})=>{
    const widths=[.5,1.5,2.5,3,3,3,3,3,3,3,3.5,4,4.5];
    for(let i=1;i<=3;i++)rect(9-i,14+i,1,1,i%2?'t':'b');
    rect(5,18,1,1,'k');
    for(let y=1;y<23;y++)for(let x=1;x<23;x++){
      const along=(21-x+y-2)/2,across=(x+y-23)/2;
      if(along<0||along>12)continue;
      const width=widths[Math.floor(along)];
      if(Math.abs(across)>width)continue;
      const edge=Math.abs(across)>width-1||along===12;
      let color=edge?(across<=0?'e':'k'):'j';
      // Short inset ridge at the heel, following the blade's long axis.
      if(along>=7&&along<11&&Math.abs(across)<=.5)color='k';
      rect(x,y,1,1,color);
    }
  });
  blade('dagger',17,6,6,.8,1,2);
  // Front view: matched limbs around a vertical axis; string stays one pixel.
  make('bow',({rect,row})=>{
    for(let x=3;x<=19;x++){
      const dist=Math.abs(x-11),y=8+Math.floor(dist*dist/11);
      rect(x,y,1,1,'t');rect(x,y+1,1,1,dist<2?'r':'b');
    }
    rect(4,14,15,1,'l');rect(3,14,1,1,'b');rect(19,14,1,1,'b');
    row(8,3,'h');row(9,3,'r');
  });
  // The orb is drawn after orientation: a round pixel silhouette never turns
  // into a diamond through nearest-neighbor rotation.
  make('staff',({rect})=>{
    for(let i=0;i<=9;i++)rect(4+i,20-i,1,1,'b');
    rect(3,21,1,1,'b');
    for(let i=-1;i<=1;i++)rect(14+i,10+i,1,1,'b');
    // Shaft and socket lie on x+y=24; the orb center must lie on it too.
    for(let y=6;y<=10;y++)for(let x=14;x<=18;x++){
      if((x-16)**2+(y-8)**2>6)continue;
      const shade=(x-16)+(y-8);
      rect(x,y,1,1,shade>=2?'z':shade>=0?'c':'a');
    }
    rect(15,7,1,1,'w');
  });
  make('spear',({rect})=>{
    for(let i=0;i<=12;i++)rect(3+i,21-i,1,1,'b');
    for(let y=2;y<=10;y++)for(let x=14;x<=22;x++){
      const along=(21-x+y-3)/2,across=(x+y-24)/2;
      if(along<0||along>6)continue;
      if(Math.abs(across)<=Math.min(1.5,along*.5,(6-along)*.7))
        rect(x,y,1,1,across<0?'l':across===0?'w':'m');
    }
    rect(15,9,1,1,'g');rect(3,21,1,1,'m');
  });
  make('mace',({rect})=>{
    // A solid flanged head made from three broad, connected metal planes.
    for(let i=0;i<=7;i++)rect(6+i,18-i,1,1,'b');
    rect(5,19,1,1,'b');
    const points=[[18,2],[20,4],[20,5],[22,7],[20,9],[20,11],
      [18,10],[16,12],[14,10],[15,8],[13,7],[15,5],[14,3],[16,4]];
    for(let y=2;y<=12;y++)for(let x=13;x<=22;x++){
      let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,ay]=points[i],[bx,by]=points[j];
        if((ay>y+.5)!=(by>y+.5)&&x+.5<(bx-ax)*(y+.5-ay)/(by-ay)+ax)inside=!inside;
      }
      if(inside){const plane=x+y<22?'l':x+y>24?'s':'m';rect(x,y,1,1,plane);}
    }
    rect(16,5,1,2,'l');rect(17,6,1,3,'m');rect(18,7,1,2,'s');
    rect(13,12,1,1,'g');rect(14,13,1,1,'g');rect(15,12,1,1,'g');
  });
  make('axe',({rect})=>{
    // Short wooden haft and compact single blade: a one-handed hatchet.
    for(let i=0;i<=6;i++)rect(8+i,15-i,1,1,i%3?'t':'b');
    rect(7,16,1,1,'b');
    const points=[[13,8],[16,8],[18,5],[20,5],[21,8],[20,11],
      [18,14],[15,15],[14,13],[15,11],[13,10]];
    for(let y=5;y<=15;y++)for(let x=13;x<=21;x++){
      let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,ay]=points[i],[bx,by]=points[j];
        if((ay>y+.5)!=(by>y+.5)&&x+.5<(bx-ax)*(y+.5-ay)/(by-ay)+ax)inside=!inside;
      }
      if(inside)rect(x,y,1,1,x>=19||y>=13?'l':x<=15?'s':'m');
    }
    rect(13,7,1,3,'s');rect(14,9,1,2,'t');
  });
  make('potion',({rect,row})=>{
    row(4,5,'t');row(5,7,'t');row(6,5,'t');
    row(7,3,'l');row(8,3,'l');
    row(9,7,'l');row(10,11,'l');
    for(let y=11;y<=16;y++)row(y,13,y<15?'h':'r');
    row(17,11,'r');row(18,9,'r');row(19,5,'r');
    rect(10,7,1,2,'w');rect(6,11,1,3,'w');rect(7,12,1,2,'h');rect(15,12,2,2,'h');
  });
  make('vial',({rect,row})=>{
    row(5,5,'t');row(6,7,'t');row(7,5,'l');
    row(8,3,'l');row(9,5,'l');
    for(let y=10;y<=16;y++)row(y,5,y<12?'l':'n');
    row(17,3,'v');
    rect(10,9,1,3,'w');rect(10,12,1,4,'n');rect(12,12,1,4,'v');
  });
  make('leaf',({rect})=>{
    // A soft leaf: both ends taper, while one rounded side carries the weight.
    const spans=[[4,17,1],[5,15,3],[6,13,5],[7,11,7],[8,10,8],
      [9,9,9],[10,9,8],[11,9,7],[12,9,6],[13,9,4],[14,9,2]];
    for(const [y,x,w] of spans){
      rect(x,y,w,1,'n');
      if(w>3)rect(x,y,2,1,'q');
      if(w>5)rect(x+2,y,1,1,'v');
    }
    for(const [x,y] of [[10,14],[9,15],[8,16],[7,17],[6,18]])rect(x,y,1,1,'v');
    for(const [x,y] of [[10,13],[11,12],[12,11],[13,10],[14,9],[15,8],[16,7],[17,6]])rect(x,y,1,1,'f');
    rect(13,7,2,1,'w');rect(15,6,1,1,'w');
  });
  // Light armor benchmark: short pale shoulders, green vertical chest plates
  // and a wide lower belt. Every structural and color pixel is mirrored.
  make('armor',({rect,row})=>{
    row(3,7,'l');row(4,11,'l');row(5,13,'q');
    rect(9,3,5,1,'q');rect(8,4,7,2,'q');
    rect(4,4,3,1,'l');rect(16,4,3,1,'l');
    rect(3,5,5,4,'c');rect(15,5,5,4,'c');
    rect(4,5,3,2,'l');rect(16,5,3,2,'l');
    rect(3,8,4,2,'q');rect(16,8,4,2,'q');
    row(6,11,'c');row(7,13,'c');
    for(let y=8;y<=15;y++)row(y,11,'v');
    rect(7,8,3,7,'n');rect(13,8,3,7,'n');
    rect(8,8,2,6,'n');rect(13,8,2,6,'n');
    rect(10,7,1,9,'c');rect(12,7,1,9,'c');rect(11,7,1,9,'l');
    row(15,13,'l');row(16,13,'l');row(17,11,'c');
    row(18,11,'q');row(19,9,'v');
  });
  // Chain-mail benchmark: sleeve-shaped silhouette and a symmetric checker weave.
  make('chain',({rect,row})=>{
    row(4,7,'l');row(5,11,'l');
    rect(9,4,5,1,'q');rect(8,5,7,2,'q');
    rect(5,5,3,1,'c');rect(15,5,3,1,'c');
    rect(4,6,4,4,'c');rect(15,6,4,4,'c');
    rect(3,8,2,3,'q');rect(18,8,2,3,'q');
    rect(4,6,2,2,'l');rect(17,6,2,2,'l');
    rect(4,10,4,1,'q');rect(15,10,4,1,'q');
    row(7,11,'c');
    for(let y=8;y<=17;y++)row(y,13,'u');
    row(18,13,'q');row(19,11,'q');
    for(let y=8;y<=16;y+=2){
      for(const x of [6,10,12,16])rect(x,y,1,1,'c');
      for(const x of [8,14])rect(x,y+1,1,1,'c');
      for(const x of [7,9,13,15])rect(x,y,1,1,'l');
      for(const x of [6,10,12,16])rect(x,y+1,1,1,'l');
    }
    rect(11,7,1,11,'w');row(17,11,'c');
  });
  make('buckler',({rect})=>{
    for(let y=5;y<=17;y++)for(let x=5;x<=17;x++){
      const d=(x-11)**2+(y-11)**2;if(d>38)continue;
      rect(x,y,1,1,d>25?(x+y<22?'l':'s'):'b');
    }
    rect(10,9,3,5,'m');rect(9,10,5,3,'m');rect(10,10,2,2,'w');
  });
  make('tower',({rect,row})=>{
    row(3,7,'l');row(4,11,'l');
    for(let y=5;y<=16;y++)row(y,13,'s');
    row(17,11,'s');row(18,9,'s');row(19,7,'s');row(20,3,'m');
    for(let y=5;y<=16;y++)row(y,9,'c');
    row(17,7,'c');row(18,5,'c');
    rect(11,5,1,14,'g');rect(7,9,9,1,'g');rect(5,5,1,11,'l');
  });
  make('plate',({rect,row})=>{
    // Heavy-armor benchmark: winged shoulders and split lower cuirass.
    row(3,7,'l');row(4,11,'l');
    rect(9,3,5,1,'q');rect(8,4,7,2,'q');
    rect(3,4,4,1,'l');rect(16,4,4,1,'l');
    rect(2,5,6,2,'l');rect(15,5,6,2,'l');
    rect(1,7,7,3,'l');rect(15,7,7,3,'l');
    rect(2,10,5,2,'q');rect(16,10,5,2,'q');
    rect(4,6,3,4,'c');rect(16,6,3,4,'c');
    rect(5,7,2,2,'c');rect(16,7,2,2,'c');
    row(6,11,'c');row(7,13,'c');
    for(let y=8;y<=14;y++)row(y,11,'v');
    rect(7,8,3,6,'n');rect(13,8,3,6,'n');
    rect(9,8,2,6,'c');rect(12,8,2,6,'c');
    rect(11,7,1,8,'l');
    row(14,13,'l');
    rect(5,15,6,2,'l');rect(12,15,6,2,'l');
    rect(4,17,6,2,'l');rect(13,17,6,2,'l');
    rect(3,19,6,1,'q');rect(14,19,6,1,'q');
    rect(9,16,2,3,'c');rect(12,16,2,3,'c');
    rect(10,18,1,2,'q');rect(12,18,1,2,'q');rect(11,15,1,5,'q');
  });
  make('robe',({rect,row})=>{
    // Blue front-opening robe benchmark: square hood, broad sleeves and round hem.
    row(2,7,'l');row(3,11,'l');row(4,13,'l');
    row(5,15,'x');row(6,17,'x');
    row(7,19,'y');row(8,19,'y');row(9,19,'y');row(10,19,'y');
    row(11,17,'x');row(12,17,'x');
    for(let y=13;y<=16;y++)row(y,15,'x');
    row(17,17,'x');row(18,17,'l');row(19,15,'l');
    // Deep centered hood opening.
    rect(8,3,7,1,'q');rect(7,4,9,2,'q');rect(8,6,7,2,'q');
    // Dark sleeve undersides and blue body planes.
    rect(2,8,5,4,'x');rect(16,8,5,4,'x');
    rect(3,7,4,2,'y');rect(16,7,4,2,'y');
    rect(6,7,3,10,'y');rect(14,7,3,10,'y');
    rect(7,8,2,8,'x');rect(14,8,2,8,'x');
    // Twin pale lapels frame a black center opening from collar to hem.
    rect(9,6,2,12,'l');rect(12,6,2,12,'l');
    rect(10,6,1,11,'w');rect(12,6,1,11,'w');
    rect(11,6,1,13,'q');
    // Paired lower folds and the reference's pale rounded hem.
    rect(7,16,2,2,'y');rect(14,16,2,2,'y');
    rect(6,17,3,2,'l');rect(14,17,3,2,'l');
    rect(7,18,3,1,'l');rect(13,18,3,1,'l');
    row(19,9,'l');
  });
  make('ring',({rect,row})=>{
    // Small, straight-on jeweled ring copied from the reference proportions.
    row(6,3,'h');row(7,5,'h');row(8,3,'h');
    rect(11,6,1,1,'w');
    row(8,7,'g');row(9,9,'t');row(10,9,'b');
    rect(7,11,2,4,'g');rect(14,11,2,4,'g');
    rect(8,15,2,2,'t');rect(13,15,2,2,'t');row(17,7,'b');
    // The center is genuinely transparent, so the ring reads by silhouette.
    rect(7,11,1,2,'w');rect(15,11,1,2,'w');
    rect(8,9,1,1,'w');rect(14,9,1,1,'w');
  });
  make('amulet',({rect,row})=>{
    row(3,7,'b');rect(7,4,1,3,'b');rect(15,4,1,3,'b');
    rect(8,7,1,2,'b');rect(14,7,1,2,'b');rect(9,9,1,1,'b');rect(13,9,1,1,'b');
    row(10,3,'g');row(11,3,'g');row(12,5,'g');
    row(13,7,'g');row(14,9,'g');row(15,9,'b');row(16,7,'b');row(17,5,'b');row(18,3,'g');row(19,1,'g');
    rect(10,13,3,4,'c');rect(9,14,5,2,'c');rect(10,13,2,2,'a');rect(10,13,1,1,'w');
  });
  make('bag',({rect,row})=>{
    row(3,3,'t');row(4,5,'b');row(5,3,'d');row(6,7,'g');
    row(7,5,'b');row(8,7,'t');row(9,9,'t');row(10,11,'t');
    for(let y=11;y<=16;y++)row(y,13,y<14?'t':'b');
    row(17,11,'b');row(18,9,'b');row(19,7,'d');
    rect(7,11,1,3,'w');rect(8,11,1,1,'w');
  });
  function key(it){
    if(it?.consum)return ({draught:'vial',antidote:'leaf'})[it.consum]||'potion';
    if(!it?.ident)return 'bag';
    const name=({leather:'armor',round:'buckler'})[it.base]||it.base;
    return sprites[name]?name:'bag';
  }
  function overlay(it,color){
    if(!color||it?.rar===0||it?.consum)return null;
    const name=key(it),id=name+color;
    if(!cache.has(id))cache.set(id,render(name,color,true));
    return cache.get(id);
  }
  // Static preview/export also composites the same independent edge layer.
  function sprite(it,color){
    const base=sprites[key(it)],edge=overlay(it,color);if(!edge)return base;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
    const ctx=canvas.getContext('2d');ctx.drawImage(base,0,0);ctx.drawImage(edge,0,0);
    return canvas;
  }
  function draw(ctx,it,x,y,size,color,outlineAlpha=1){
    const art=sprites[key(it)],edge=overlay(it,color);
    const scale=Math.max(1,Math.round(size/24)),side=24*scale;
    const left=Math.round(x-side/2),top=Math.round(y-side/2);
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.drawImage(art,left,top,side,side);
    if(edge&&outlineAlpha>0){
      ctx.globalAlpha*=Math.max(0,Math.min(1,outlineAlpha));
      ctx.drawImage(edge,left,top,side,side);
    }
    ctx.restore();
  }
  return {sprites,key,sprite,overlay,draw};
})();
