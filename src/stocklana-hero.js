const canvas=document.querySelector('#heroOrbitCanvas');
const panel=document.querySelector('#heroMedia');
let running=true,raf=0,start=performance.now(),pointer={x:0,y:0};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function fit(){if(!canvas||!panel)return;const d=Math.min(devicePixelRatio||1,2),r=panel.getBoundingClientRect();canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';const x=canvas.getContext('2d');x.setTransform(d,0,0,d,0,0)}
function draw(now){
 if(!canvas||!panel)return;const ctx=canvas.getContext('2d'),r=panel.getBoundingClientRect(),w=r.width,h=r.height,t=(now-start)/1000;
 ctx.clearRect(0,0,w,h);
 const cx=w*.52+pointer.x*8,cy=h*.47+pointer.y*5,rad=Math.min(w,h)*.28;
 const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,rad*2.2);bg.addColorStop(0,'rgba(38,255,155,.20)');bg.addColorStop(.36,'rgba(43,164,255,.12)');bg.addColorStop(.68,'rgba(133,75,255,.10)');bg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 for(let k=0;k<4;k++){
  ctx.save();ctx.translate(cx,cy);ctx.rotate((k-.8)*.26+(running&&!reduce?t*.018*(k%2?1:-1):0));ctx.scale(1,0.30+k*.08);ctx.beginPath();ctx.arc(0,0,rad*(1.35+k*.18),0,Math.PI*2);ctx.strokeStyle=['rgba(205,255,73,.68)','rgba(77,221,255,.42)','rgba(151,104,255,.44)','rgba(205,255,73,.18)'][k];ctx.lineWidth=1.2;ctx.shadowBlur=18;ctx.shadowColor=ctx.strokeStyle;ctx.stroke();ctx.restore();
 }
 for(let i=0;i<42;i++){
  const a=i*.78+(running&&!reduce?t*.03:0),rr=rad*(.55+(i%9)/12),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a*1.27)*rr*.55;
  ctx.beginPath();ctx.arc(x,y,1+(i%3)*.55,0,Math.PI*2);ctx.fillStyle=i%4===0?'rgba(216,255,79,.9)':i%3===0?'rgba(78,219,255,.7)':'rgba(155,108,255,.62)';ctx.fill();
 }
 if(running&&!reduce)raf=requestAnimationFrame(draw)
}
function play(){cancelAnimationFrame(raf);if(!running||reduce){draw(performance.now());return}raf=requestAnimationFrame(draw)}
addEventListener('resize',()=>{fit();play()});
panel?.addEventListener('pointermove',e=>{const r=panel.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width-.5;pointer.y=(e.clientY-r.top)/r.height-.5});
panel?.addEventListener('pointerleave',()=>pointer={x:0,y:0});
document.querySelector('#heroMediaToggle')?.addEventListener('click',e=>{running=!running;e.currentTarget.querySelector('span').textContent=running?'Ⅱ':'▶';play()});
document.querySelector('#heroWatchBtn')?.addEventListener('click',()=>{running=true;document.querySelector('#heroMediaToggle span').textContent='Ⅱ';panel?.scrollIntoView({behavior:'smooth',block:'center'});play()});
fit();play();
