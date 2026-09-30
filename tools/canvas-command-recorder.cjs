class Canvas {
 constructor(){this.commands=[];this.state={fillStyle:'#000',strokeStyle:'#000',globalAlpha:1,lineWidth:1,filter:'none',m:[1,0,0,1,0,0]};this.stack=[];this.points=[];}
 save(){this.stack.push(structuredClone(this.state));} restore(){this.state=this.stack.pop();}
 point(x,y){const [a,b,c,d,e,f]=this.state.m;return [a*x+c*y+e,b*x+d*y+f];}
 translate(x,y){const p=this.point(x,y);this.state.m[4]=p[0];this.state.m[5]=p[1];}
 scale(x,y){this.state.m[0]*=x;this.state.m[1]*=x;this.state.m[2]*=y;this.state.m[3]*=y;}
 rotate(t){const [a,b,c,d,e,f]=this.state.m,co=Math.cos(t),si=Math.sin(t);this.state.m=[a*co+c*si,b*co+d*si,c*co-a*si,d*co-b*si,e,f];}
 beginPath(){this.points=[];} moveTo(x,y){this.points.push(this.point(x,y));} lineTo(x,y){this.moveTo(x,y);} closePath(){}
 ellipse(x,y,rx,ry,rot,start,end){for(let i=0;i<=64;i++){let a=start+(end-start)*i/64;this.moveTo(x+Math.cos(a)*rx*Math.cos(rot)-Math.sin(a)*ry*Math.sin(rot),y+Math.cos(a)*rx*Math.sin(rot)+Math.sin(a)*ry*Math.cos(rot));}}
 fill(){this.commands.push({type:'polygon',points:this.points,color:this.state.fillStyle,alpha:this.state.globalAlpha,filter:this.state.filter});}
 stroke(){this.commands.push({type:'line',points:this.points,color:this.state.strokeStyle,alpha:this.state.globalAlpha,width:this.state.lineWidth});}
 rect(x,y,w,h){this.moveTo(x,y);this.moveTo(x+w,y);this.moveTo(x+w,y+h);this.moveTo(x,y+h);}
 fillRect(x,y,w,h){this.beginPath();this.rect(x,y,w,h);this.fill();}
 strokeRect(x,y,w,h){this.beginPath();this.rect(x,y,w,h);this.moveTo(x,y);this.stroke();}
 clearRect(){this.commands=[];} clip(){}
 fillText(text,x,y){this.commands.push({type:'text',text,xy:this.point(x,y),color:this.state.fillStyle});}
 drawImage(im,x,y,w,h){this.commands.push({type:'image',src:im.src,xy:this.point(x,y),w,h,alpha:this.state.globalAlpha,filter:this.state.filter,color:this.state.fillStyle});}
}
for(const k of ['fillStyle','strokeStyle','globalAlpha','lineWidth','filter'])Object.defineProperty(Canvas.prototype,k,{get(){return this.state[k]},set(v){this.state[k]=v}});

module.exports={Canvas};
