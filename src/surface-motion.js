const surfaces={
  markets:{eyebrow:'PRESTOCKS',title:'Own private companies. Then put them to work.',copy:'Buy eligible PreStocks with wallet-signed execution, then move directly into automation, games, credit, shopping or AI.',tags:['24/7','JUPITER','PRESTOCKS'],scene:'equity',a:'#d8ff4f',b:'#35d9ff',mark:'↗',caption:'Tokenized ownership that keeps moving'},
  wallet:{eyebrow:'CONVERT',title:'One place for the money you already own.',copy:'Phantom remains the signer while Stocklana makes SOL, USDC and PreStocks legible and usable.',tags:['PHANTOM','USDC','LOCAL SIGNING'],scene:'wallet',a:'#9b6cff',b:'#35d9ff',mark:'⇄',caption:'Wallet in. Useful money out.'},
  play:{eyebrow:'PLAY',title:'Pick a side. See the payoff before you play.',copy:'Real collateral, visible pools and clean YES / NO choices. No options jargon required.',tags:['REAL POOLS','VISIBLE MAX LOSS','SOLANA'],scene:'duel',a:'#35d9ff',b:'#9b6cff',mark:'◇',caption:'Clear stakes. Clear payoff.'},
  commerce:{eyebrow:'SHOP',title:'Use your portfolio outside the app.',copy:'Choose the merchant, maximum spend and funding source. Stocklana constrains the payment before checkout.',tags:['ONE-TIME','MERCHANT LOCK','RECEIPT'],scene:'commerce',a:'#ffd45a',b:'#35d9ff',mark:'▰',caption:'Portfolio value, real-world checkout.'},
  agents:{eyebrow:'AI AGENT',title:'Give an AI money rules — not your keys.',copy:'Budget, merchants, per-purchase caps and approval thresholds become executable policy for agent commerce.',tags:['BUDGETED','MERCHANT RULES','HUMAN GATES'],scene:'agent',a:'#c477ff',b:'#35d9ff',mark:'◈',caption:'Bounded autonomy for real purchases.'},
  vault:{eyebrow:'SEND',title:'Money that moves like a consumer app.',copy:'Send, request, deposit, withdraw and create single-use payment capability without exposing wallet keys.',tags:['MAQUE','QR / NFC','JIT'],scene:'money',a:'#4de5e8',b:'#d8ff4f',mark:'➤',caption:'Human payments, programmable underneath.'},
  portfolio:{eyebrow:'PORTFOLIO',title:'Everything you own. Everything it can do next.',copy:'PreStocks, game positions, cash and receipts stay connected to the actions that make them useful.',tags:['POSITIONS','ACTIVITY','RECEIPTS'],scene:'portfolio',a:'#d8ff4f',b:'#9b6cff',mark:'◎',caption:'One balance sheet. Many actions.'},
  credit:{eyebrow:'CREDIT',title:'Keep the asset. Unlock working capital.',copy:'See supported collateral routes, funded internal credit and external Solana DeFi without hiding risk.',tags:['COLLATERAL','KAMINO','VISIBLE DEBT'],scene:'credit',a:'#ffd45a',b:'#d8ff4f',mark:'↯',caption:'Borrow without making the asset disappear.'},
  launch:{eyebrow:'LAUNCH',title:'Create assets without leaving the control room.',copy:'Pons on Robinhood Chain and Token-2022 / Meteora on Solana sit behind one launch workstation.',tags:['PONS','TOKEN-2022','WALLET SIGNED'],scene:'launch',a:'#ffce58',b:'#9b6cff',mark:'✦',caption:'Launch rails, one product surface.'},
  lab:{eyebrow:'MARKET LAB',title:'Turn a PreStock thesis into a programmable game.',copy:'Compose a payoff, preview settlement logic and create a market from the same Stocklana account.',tags:['PRESTOCKS ONLY','PAYOFF BUILDER','SETTLEMENT'],scene:'forge',a:'#62ff9e',b:'#35d9ff',mark:'＋',caption:'Build the payoff. Keep the collateral honest.'},
  infrastructure:{eyebrow:'SYSTEM',title:'The machinery stays underneath the experience.',copy:'Settlement, accounting, Token-2022 claims, ISO 20022 and post-quantum receipts make the simple surfaces real.',tags:['TOKEN-2022','ISO 20022','PQ RECEIPTS'],scene:'mesh',a:'#35d9ff',b:'#6f7cff',mark:'⌘',caption:'Complex underneath. Simple on top.'},
  coverage:{eyebrow:'PROOF',title:'Every promise maps to running code or an external receipt.',copy:'Track the product wedge, bounty requirements and production dependencies without confusing intent with execution.',tags:['TRACK FIT','RECEIPTS','NO FAKE PROOF'],scene:'proof',a:'#6cff9d',b:'#35d9ff',mark:'✓',caption:'No receipt, no claim.'}
};

function sceneMarkup(scene){
 const m={
  equity:'<div class="world-equity"><div class="w-orb"></div><span class="w-chip c1">OPENAI</span><span class="w-chip c2">SPACEX</span><span class="w-chip c3">ANTHROPIC</span><i class="w-line"></i></div>',
  wallet:'<div class="world-wallet"><span class="money-disc sol">SOL</span><i>⇄</i><span class="money-disc usdc">USDC</span><i>⇄</i><span class="money-disc pre">PRE</span></div>',
  duel:'<div class="world-duel"><span class="side yes">YES<b>63%</b><small>PAYOUT 1.58×</small></span><em>VS</em><span class="side no">NO<b>37%</b><small>MAX LOSS $10</small></span></div>',
  commerce:'<div class="world-commerce"><span class="shop-card">PRODUCT<small>merchant locked</small></span><i></i><span class="shop-card pay">$300<small>max spend</small></span><i></i><span class="shop-card receipt">✓<small>receipt</small></span></div>',
  agent:'<div class="world-agent"><span class="agent-core">AI</span><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><b>$500<small>monthly budget</small></b></div>',
  money:'<div class="world-money"><span>@YOU</span><i></i><span>@FRIEND</span><i></i><span>USDC</span></div>',
  portfolio:'<div class="world-portfolio"><span class="bar b1"></span><span class="bar b2"></span><span class="bar b3"></span><span class="bar b4"></span><i></i></div>',
  credit:'<div class="world-credit"><span>ASSET</span><i>→</i><span>USDC</span></div>',
  launch:'<div class="world-launch"><span class="launch-orb">✦</span><i class="r1"></i><i class="r2"></i><b>CREATE<small>ONCHAIN</small></b></div>',
  forge:'<div class="world-forge"><span>THESIS</span><i></i><span>PAYOFF</span><i></i><span>MARKET</span></div>',
  mesh:'<div class="world-mesh"><span>◎</span><i class="m1"></i><i class="m2"></i><i class="m3"></i><i class="m4"></i><i class="m5"></i></div>',
  proof:'<div class="world-proof"><span>01<small>INTENT</small></span><i></i><span>02<small>SIGN</small></span><i></i><span>03<small>RECEIPT</small></span></div>'
 };
 return m[scene]||'';
}
function addSurface(id,cfg){
 const view=document.querySelector('#view-'+id);if(!view||view.querySelector('.surface-intro'))return;
 const hero=document.createElement('section');
 hero.className='surface-intro surface-'+cfg.scene;
 hero.style.setProperty('--sa',cfg.a);hero.style.setProperty('--sb',cfg.b);
 hero.innerHTML=`
   <div class="surface-copy">
     <span class="surface-eyebrow">${cfg.eyebrow}</span>
     <h1>${cfg.title}</h1>
     <p>${cfg.copy}</p>
     <div class="surface-tags">${cfg.tags.map(x=>'<span>'+x+'</span>').join('')}</div>
   </div>
   <div class="surface-visual">
     <div class="surface-nebula"></div>
     <div class="surface-ring sr1"></div><div class="surface-ring sr2"></div><div class="surface-ring sr3"></div>
     ${sceneMarkup(cfg.scene)}
     <button class="surface-focus" aria-label="Open primary action"><span>${cfg.mark}</span></button>
     <div class="surface-caption"><b>${cfg.caption}</b><small>STOCKLANA · LIVE PRODUCT SURFACE</small></div>
     <div class="surface-wordmark">SAME VALUE.<br><strong>MORE UTILITY.</strong><i></i></div>
   </div>`;
 view.prepend(hero);
 const bar=document.createElement('div');
 bar.className='surface-statusbar';
 bar.innerHTML='<span><i class="dot live"></i><b>PRESTOCKS</b><em data-surface-wallet-cluster>MAINNET</em></span><span><i class="dot"></i><b>PROGRAM</b><em data-surface-program-cluster>DEVNET</em></span><span><i class="dot live"></i><b>API</b><em data-surface-api>LIVE</em></span><span class="surface-status-proof"><b>PROOF RULE</b><em>NO EXTERNAL CLAIM WITHOUT RECEIPT</em></span>';
 hero.after(bar);
 const old=view.querySelector(':scope > .section-head');if(old)old.classList.add('surface-original-head');
 hero.querySelector('.surface-focus')?.addEventListener('click',()=>{
   const map={markets:'[data-action="buy"]',wallet:'#swapExecuteBtn',play:'[data-game-stake="10"]',commerce:'#commerceCreateBtn',agents:'#agentCreateBtn',vault:'#sendMoneyBtn',portfolio:'[data-nav="markets"]',credit:'#creditStartBtn',launch:'[data-launch-tab="create"]',lab:'#createMarketBtn',infrastructure:'#coverageRefresh',coverage:'#coverageRefresh'};
   view.querySelector(map[id]||'button')?.click();
 });
}
Object.entries(surfaces).forEach(([id,cfg])=>addSurface(id,cfg));

async function hydrate(){
 try{
  const [cfg,health]=await Promise.all([fetch('/api/config',{cache:'no-store'}).then(r=>r.json()),fetch('/api/health',{cache:'no-store'}).then(r=>r.json())]);
  document.querySelectorAll('[data-surface-wallet-cluster]').forEach(x=>x.textContent=String(cfg.walletCluster||cfg.cluster||'mainnet-beta').toUpperCase());
  document.querySelectorAll('[data-surface-program-cluster]').forEach(x=>x.textContent=(cfg.programDeployed?'DEPLOYED · ':'')+String(cfg.programCluster||'devnet').toUpperCase());
  document.querySelectorAll('[data-surface-api]').forEach(x=>x.textContent=health.ok?'LIVE':'CHECK');
 }catch{
  document.querySelectorAll('[data-surface-api]').forEach(x=>x.textContent='OFFLINE');
 }
}
hydrate();
