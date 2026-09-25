const surfaces={
  markets:{eyebrow:'PRESTOCKS',title:'Own private companies. Then put them to work.',copy:'Buy eligible PreStocks with wallet-signed execution, then move directly into automation, games, credit, shopping or AI.',tags:['24/7','JUPITER','PRESTOCKS'],scene:'equity',a:'#d8ff4f',b:'#35d9ff'},
  play:{eyebrow:'PLAY',title:'Pick a side. See the payoff before you play.',copy:'Real collateral, visible pools and clean YES / NO choices. No options jargon required.',tags:['REAL POOLS','VISIBLE MAX LOSS','SOLANA'],scene:'duel',a:'#35d9ff',b:'#9b6cff'},
  lab:{eyebrow:'MARKET LAB',title:'Turn a PreStock thesis into a programmable game.',copy:'Compose a payoff, preview settlement logic and create a market from the same Stocklana account.',tags:['PRESTOCKS ONLY','PAYOFF BUILDER','SETTLEMENT'],scene:'forge',a:'#62ff9e',b:'#35d9ff'},
  launch:{eyebrow:'LAUNCH EXCHANGE',title:'Create assets without leaving the control room.',copy:'Pons on Robinhood Chain and Token-2022 / Meteora on Solana sit behind one launch workstation.',tags:['PONS','TOKEN-2022','WALLET SIGNED'],scene:'launch',a:'#ffce58',b:'#9b6cff'},
  wallet:{eyebrow:'MONEY',title:'One place for the money you already own.',copy:'Phantom remains the signer while Stocklana makes SOL, USDC and PreStocks legible and usable.',tags:['PHANTOM','USDC','LOCAL SIGNING'],scene:'wallet',a:'#a985ff',b:'#35d9ff'},
  commerce:{eyebrow:'SHOP',title:'Use your portfolio outside the app.',copy:'Choose the merchant, maximum spend and funding source. Stocklana constrains the payment before checkout.',tags:['ONE-TIME','MERCHANT LOCK','RECEIPT'],scene:'commerce',a:'#ffd45a',b:'#35d9ff'},
  vault:{eyebrow:'SEND + SPEND',title:'Money that moves like a consumer app.',copy:'Send, request, deposit, withdraw and create single-use payment capability without exposing wallet keys.',tags:['MAQUE','QR / NFC','JIT'],scene:'money',a:'#4de5e8',b:'#d8ff4f'},
  portfolio:{eyebrow:'PORTFOLIO',title:'Everything you own. Everything it can do next.',copy:'PreStocks, game positions, cash and receipts stay connected to the actions that make them useful.',tags:['POSITIONS','ACTIVITY','RECEIPTS'],scene:'portfolio',a:'#d8ff4f',b:'#9b6cff'},
  credit:{eyebrow:'CREDIT',title:'Keep the asset. Unlock working capital.',copy:'See supported collateral routes, funded internal credit and external Solana DeFi without hiding risk.',tags:['COLLATERAL','KAMINO','VISIBLE DEBT'],scene:'credit',a:'#ffd45a',b:'#d8ff4f'},
  agents:{eyebrow:'AI AGENTS',title:'Give an AI money rules — not your keys.',copy:'Budget, merchants, per-purchase caps and approval thresholds become executable policy for agent commerce.',tags:['BUDGETED','MERCHANT RULES','HUMAN GATES'],scene:'agent',a:'#c477ff',b:'#35d9ff'},
  infrastructure:{eyebrow:'SYSTEM',title:'The machinery stays underneath the experience.',copy:'Settlement, accounting, Token-2022 claims, ISO 20022 and post-quantum receipts make the simple surfaces real.',tags:['TOKEN-2022','ISO 20022','PQ RECEIPTS'],scene:'mesh',a:'#35d9ff',b:'#6f7cff'},
  coverage:{eyebrow:'PROOF ROOM',title:'Every promise maps to running code or an external receipt.',copy:'Track the product wedge, bounty requirements and production dependencies without confusing intent with execution.',tags:['TRACK FIT','RECEIPTS','NO FAKE PROOF'],scene:'proof',a:'#6cff9d',b:'#35d9ff'}
};

function hex(c,a=.7){const x=c.replace('#','');const n=parseInt(x,16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function sceneMarkup(scene){
 const map={
  equity:'<div class="scene-equity"><span class="scene-token t1">OPENAI</span><span class="scene-token t2">SPACE X</span><span class="scene-token t3">ANTHROPIC</span><i class="scene-price-line"></i></div>',
  duel:'<div class="scene-duel"><span class="duel-puck yes">YES<b>63%</b></span><i>VS</i><span class="duel-puck no">NO<b>37%</b></span></div>',
  wallet:'<div class="scene-wallet"><span class="wallet-slab sol">SOL<small>PHANTOM</small></span><span class="wallet-slab usdc">USDC<small>SPENDABLE</small></span><span class="wallet-slab pre">PRE<small>STOCKS</small></span></div>',
  commerce:'<div class="scene-commerce"><span class="commerce-box">▰<small>MERCHANT LOCKED</small></span><i class="commerce-beam"></i><span class="commerce-receipt">✓<small>RECEIPT</small></span></div>',
  money:'<div class="scene-money"><span>@YOU</span><i></i><span>@FRIEND</span><i></i><span>USDC</span></div>',
  portfolio:'<div class="scene-portfolio"><span class="port-bar b1"></span><span class="port-bar b2"></span><span class="port-bar b3"></span><span class="port-bar b4"></span><i class="port-curve"></i></div>',
  credit:'<div class="scene-credit"><span class="credit-cube">ASSET</span><i class="credit-arrow">→</i><span class="credit-cube cash">USDC</span></div>',
  agent:'<div class="scene-agent"><span class="agent-core">AI</span><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><b>$500<br><small>RULED BUDGET</small></b></div>',
  forge:'<div class="scene-forge"><span>THESIS</span><i></i><span>PAYOFF</span><i></i><span>MARKET</span></div>',
  launch:'<div class="scene-launch"><span class="launch-core">✦</span><i class="lr1"></i><i class="lr2"></i><b>CREATE<br><small>ONCHAIN</small></b></div>',
  mesh:'<div class="scene-mesh"><span>◎</span><i class="mn1"></i><i class="mn2"></i><i class="mn3"></i><i class="mn4"></i><i class="mn5"></i></div>',
  proof:'<div class="scene-proof"><span>01<small>SIGNED</small></span><span>02<small>CHAIN</small></span><span>03<small>RECEIPT</small></span></div>'
 };
 return map[scene]||'<div class="scene-generic"><span>STOCKLANA</span></div>'
}
function addHero(id,cfg){
 const view=document.querySelector(`#view-${id}`);if(!view||view.querySelector('.surface-intro'))return;
 const hero=document.createElement('section');hero.className=`surface-intro surface-${cfg.scene}`;hero.dataset.world=id;
 hero.innerHTML=`<div class="surface-copy"><span class="surface-eyebrow">${cfg.eyebrow}</span><h1>${cfg.title}</h1><p>${cfg.copy}</p><div class="surface-tags">${cfg.tags.map(x=>`<span>${x}</span>`).join('')}</div></div><div class="surface-visual" style="--sa:${cfg.a};--sb:${cfg.b}"><canvas aria-hidden="true"></canvas>${sceneMarkup(cfg.scene)}<div class="surface-glass-label"><span>STOCKLANA</span><b>${cfg.eyebrow}</b><small>LIVE PRODUCT SURFACE</small></div><div class="surface-orbit o1"></div><div class="surface-orbit o2"></div><div class="surface-orbit o3"></div></div>`;
 view.prepend(hero);
 const status=document.createElement('div');status.className='surface-statusbar';
 status.innerHTML='<span><i class="dot live"></i><b>PRESTOCKS</b><em data-surface-wallet-cluster>MAINNET</em></span><span><i class="dot"></i><b>STOCKLANA PROGRAM</b><em data-surface-program-cluster>DEVNET</em></span><span><i class="dot live"></i><b>API</b><em data-surface-api>LIVE</em></span><span class="surface-status-proof"><b>RECEIPT RULE</b><em>NO EXTERNAL CLAIM WITHOUT PROOF</em></span>';
 hero.after(status);
 const old=view.querySelector(':scope > .section-head');if(old)old.classList.add('surface-original-head');
}
Object.entries(surfaces).forEach(([id,cfg])=>addHero(id,cfg));

const canvases=[...document.querySelectorAll('.surface-intro canvas')];
function resize(cv){const p=cv.parentElement,r=p.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);cv.width=Math.max(1,Math.floor(r.width*d));cv.height=Math.max(1,Math.floor(r.height*d));cv.style.width=r.width+'px';cv.style.height=r.height+'px';cv.getContext('2d').setTransform(d,0,0,d,0,0)}
canvases.forEach(resize);addEventListener('resize',()=>canvases.forEach(resize));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

function drawScene(cv,t){
 const p=cv.parentElement,world=p.closest('.surface-intro')?.dataset.world,cfg=surfaces[world];if(!cfg)return;
 const ctx=cv.getContext('2d'),r=p.getBoundingClientRect(),w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
 const cx=w*.52,cy=h*.5,base=Math.min(w,h)*.26;
 const g=ctx.createRadialGradient(cx,cy,0,cx,cy,base*2.5);g.addColorStop(0,hex(cfg.a,.18));g.addColorStop(.45,hex(cfg.b,.10));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.lineWidth=1;
 const motion=reduce?0:t;
 for(let i=0;i<5;i++){
   ctx.save();ctx.translate(cx,cy);ctx.rotate(i*.36+motion*.00008*(i%2?1:-1));ctx.scale(1,.30+i*.055);ctx.beginPath();ctx.arc(0,0,base*(1+i*.18),0,Math.PI*2);ctx.strokeStyle=hex(i%2?cfg.a:cfg.b,.18+i*.06);ctx.stroke();ctx.restore();
 }
 const n=cfg.scene==='mesh'||cfg.scene==='agent'?34:22;
 for(let i=0;i<n;i++){
   const a=i*1.71+motion*.00012*(i%3+1),rr=base*(.35+(i%11)/10),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a*1.18)*rr*.55;
   ctx.beginPath();ctx.arc(x,y,i%5===0?2.2:1.2,0,Math.PI*2);ctx.fillStyle=hex(i%3?cfg.a:cfg.b,.42+i%4*.1);ctx.fill();
   if(i%4===0){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.strokeStyle=hex(cfg.b,.08);ctx.stroke()}
 }
 if(cfg.scene==='duel'){
   const y=cy+Math.sin(motion*.001)*9;
   [[cx-base*.58,y,cfg.a],[cx+base*.58,y,cfg.b]].forEach(([x,yy,col])=>{const q=ctx.createRadialGradient(x,yy,0,x,yy,base*.32);q.addColorStop(0,hex(col,.72));q.addColorStop(1,hex(col,0));ctx.fillStyle=q;ctx.beginPath();ctx.arc(x,yy,base*.34,0,Math.PI*2);ctx.fill()})
 }
 if(cfg.scene==='commerce'){
   ctx.save();ctx.translate(cx,cy);ctx.rotate(-.12);ctx.strokeStyle=hex(cfg.a,.55);ctx.strokeRect(-base*.38,-base*.23,base*.76,base*.48);ctx.restore();
 }
 if(cfg.scene==='credit'){
   ctx.beginPath();ctx.moveTo(cx-base*.8,cy+base*.28);ctx.bezierCurveTo(cx-base*.2,cy-base*.7,cx+base*.2,cy+base*.7,cx+base*.8,cy-base*.28);ctx.strokeStyle=hex(cfg.a,.72);ctx.lineWidth=2;ctx.stroke()
 }
 if(cfg.scene==='portfolio'||cfg.scene==='equity'){
   ctx.beginPath();for(let i=0;i<8;i++){const x=cx-base*.9+i*(base*1.8/7),y=cy+Math.sin(i*.9+motion*.001)*base*.18-i*base*.035;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle=hex(cfg.a,.72);ctx.lineWidth=2;ctx.stroke()
 }
}

function frame(t){const active=document.querySelector('.view.active .surface-intro canvas');if(active)drawScene(active,t);requestAnimationFrame(frame)}
requestAnimationFrame(frame);


async function hydrateSurfaceStatus(){
 try{
   const [cfg,health]=await Promise.all([
     fetch('/api/config',{cache:'no-store'}).then(r=>r.json()),
     fetch('/api/health',{cache:'no-store'}).then(r=>r.json())
   ]);
   document.querySelectorAll('[data-surface-wallet-cluster]').forEach(x=>x.textContent=String(cfg.walletCluster||cfg.cluster||'mainnet-beta').toUpperCase());
   document.querySelectorAll('[data-surface-program-cluster]').forEach(x=>x.textContent=(cfg.programDeployed?'DEPLOYED · ':'')+String(cfg.programCluster||'devnet').toUpperCase());
   document.querySelectorAll('[data-surface-api]').forEach(x=>x.textContent=health.ok?'LIVE':'CHECK');
 }catch{
   document.querySelectorAll('[data-surface-api]').forEach(x=>x.textContent='OFFLINE');
 }
}
hydrateSurfaceStatus();
