const dialog=document.querySelector('#demoReelDialog');
const canvas=document.querySelector('#demoReelCanvas');
const stage=document.querySelector('.demo-reel-stage');
const sceneBox=document.querySelector('#demoReelScene');
const title=document.querySelector('#demoReelTitle');
const eyebrow=document.querySelector('#demoReelEyebrow');
const copy=document.querySelector('#demoReelCopy');
const progress=document.querySelector('#demoReelProgress');
const playBtn=document.querySelector('#demoReelPlay');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const scenes=[
 {nav:'markets',eyebrow:'01 · OWN',title:'Buy a company. Keep the asset useful.',copy:'Eligible PreStocks stay connected to conversion, automation, markets, commerce and agent rules.',a:'#d8ff4f',b:'#35d9ff',kind:'buy',html:'<div class="reel-equities"><span>OPENAI<small>PRESTOCK</small></span><span>SPACEX<small>PRESTOCK</small></span><span>ANTHROPIC<small>PRESTOCK</small></span><i></i></div>'},
 {nav:'wallet',eyebrow:'02 · CONVERT',title:'Move between SOL, USDC and PreStocks.',copy:'The route happens inside Stocklana. Phantom remains the signer and shows the transaction before money moves.',a:'#9b6cff',b:'#35d9ff',kind:'convert',html:'<div class="reel-convert"><span class="sol">SOL</span><i>⇄</i><span class="usdc">USDC</span><i>⇄</i><span class="pre">PRE</span></div>'},
 {nav:'play',eyebrow:'03 · PLAY',title:'Turn a thesis into a real payoff.',copy:'Pick YES or NO. See the real pool, payout and maximum loss before entering.',a:'#35d9ff',b:'#9b6cff',kind:'play',html:'<div class="reel-duel"><span class="yes">YES<b>63%</b><small>$18.42 PAYOUT</small></span><i>VS</i><span class="no">NO<b>37%</b><small>MAX LOSS $10</small></span></div>'},
 {nav:'commerce',eyebrow:'04 · SHOP',title:'Use portfolio value outside the app.',copy:'Choose the store, cap the purchase and choose what funds it. Stocklana turns that intent into bounded spending power.',a:'#ffd45a',b:'#35d9ff',kind:'shop',html:'<div class="reel-shop"><span class="product">▰<small>PRODUCT</small></span><i></i><span class="rule">$300<small>MAX · STORE LOCK</small></span><i></i><span class="receipt">✓<small>RECEIPT</small></span></div>'},
 {nav:'agents',eyebrow:'05 · DELEGATE',title:'Give an AI a budget — never your keys.',copy:'Merchants, daily limits, single-purchase caps and approval thresholds become executable policy.',a:'#c477ff',b:'#35d9ff',kind:'agent',html:'<div class="reel-agent"><span class="core">AI</span><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><b>$500<small>MONTHLY BUDGET</small></b></div>'},
 {nav:'infrastructure',eyebrow:'06 · PROVE',title:'Every real action ends in proof.',copy:'Chain signatures, provider receipts and balanced accounting keep Stocklana honest about what actually happened.',a:'#6cff9d',b:'#35d9ff',kind:'proof',html:'<div class="reel-proof"><span>01<small>INTENT</small></span><i></i><span>02<small>SIGN</small></span><i></i><span>03<small>SETTLE</small></span><i></i><span>✓<small>RECEIPT</small></span></div>'}
];
let index=0,playing=true,timer=0,raf=0,start=performance.now();

function hex(c,a=.7){const x=c.replace('#',''),n=parseInt(x,16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function fit(){if(!canvas||!stage)return;const d=Math.min(devicePixelRatio||1,2),r=stage.getBoundingClientRect();canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';canvas.getContext('2d').setTransform(d,0,0,d,0,0)}
function draw(now){
 if(!canvas||!dialog?.open)return;const s=scenes[index],ctx=canvas.getContext('2d'),r=stage.getBoundingClientRect(),w=r.width,h=r.height,t=(now-start)/1000;ctx.clearRect(0,0,w,h);
 const cx=w*.60,cy=h*.48,rad=Math.min(w,h)*.29;
 const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,rad*2.5);bg.addColorStop(0,hex(s.a,.20));bg.addColorStop(.42,hex(s.b,.11));bg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 for(let k=0;k<6;k++){ctx.save();ctx.translate(cx,cy);ctx.rotate(k*.29+(reduce?0:t*.018*(k%2?1:-1)));ctx.scale(1,.28+k*.045);ctx.beginPath();ctx.arc(0,0,rad*(.85+k*.16),0,Math.PI*2);ctx.strokeStyle=hex(k%2?s.a:s.b,.12+k*.035);ctx.lineWidth=1;ctx.stroke();ctx.restore()}
 for(let i=0;i<70;i++){const a=i*.67+(reduce?0:t*.055),rr=rad*(.36+(i%15)/12),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a*1.31)*rr*.55;ctx.beginPath();ctx.arc(x,y,i%7===0?2.2:1,0,Math.PI*2);ctx.fillStyle=hex(i%3?s.a:s.b,.28+(i%5)*.08);ctx.fill()}
 if(!reduce)raf=requestAnimationFrame(draw)
}
function render(){
 const s=scenes[index];eyebrow.textContent=s.eyebrow;title.textContent=s.title;copy.textContent=s.copy;sceneBox.innerHTML=s.html;sceneBox.dataset.kind=s.kind;
 progress.innerHTML=scenes.map((_,i)=>`<button data-reel-index="${i}" class="${i===index?'active':''}"><i></i><span>${String(i+1).padStart(2,'0')}</span></button>`).join('');
 progress.querySelectorAll('[data-reel-index]').forEach(b=>b.onclick=()=>{index=Number(b.dataset.reelIndex);render();restart()});
 cancelAnimationFrame(raf);fit();draw(performance.now())
}
function advance(step=1){index=(index+step+scenes.length)%scenes.length;render();restart()}
function restart(){clearTimeout(timer);if(playing&&!reduce)timer=setTimeout(()=>advance(1),4800)}
function open(){if(!dialog)return;dialog.showModal();index=0;playing=true;playBtn.textContent='Ⅱ';render();restart()}
function close(){clearTimeout(timer);cancelAnimationFrame(raf);dialog?.close()}
document.querySelector('#heroWatchBtn')?.addEventListener('click',open);
document.querySelector('#demoReelClose')?.addEventListener('click',close);
document.querySelector('#demoReelPrev')?.addEventListener('click',()=>advance(-1));
document.querySelector('#demoReelNext')?.addEventListener('click',()=>advance(1));
playBtn?.addEventListener('click',()=>{playing=!playing;playBtn.textContent=playing?'Ⅱ':'▶';restart()});
document.querySelector('#demoReelOpenSurface')?.addEventListener('click',()=>{const nav=scenes[index].nav;close();document.querySelector(`[data-nav="${nav}"]`)?.click()});
dialog?.addEventListener('click',e=>{if(e.target===dialog)close()});
addEventListener('resize',()=>{if(dialog?.open){fit();draw(performance.now())}});
