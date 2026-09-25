const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];

const pageMeta={
  markets:{label:'PRESTOCKS DESK',stats:[['ELIGIBLE','8 exact mints'],['TRADING','24 / 7'],['ROUTING','Jupiter V2'],['NEXT','Buy · Auto · Play · Spend']]},
  wallet:{label:'MONEY DESK',stats:[['SIGNER','Phantom'],['ASSETS','SOL · USDC · PRE'],['KEYS','Never shared'],['NEXT','Convert · Send · Fund']]},
  play:{label:'PAYOFF DESK',stats:[['MODEL','Fully collateralized'],['HOUSE','0 directional'],['PROGRAM','Solana'],['PROOF','Resolve → Redeem']]},
  commerce:{label:'COMMERCE DESK',stats:[['POLICY','Merchant locked'],['CARD','One-use rail'],['AGENT','Budget scoped'],['PROOF','Provider receipt']]},
  agents:{label:'AGENT DESK',stats:[['AUTH','Scoped capability'],['LIMITS','Daily · Single'],['APPROVAL','Human threshold'],['KEYS','No wallet custody']]},
  vault:{label:'MONEY MOVEMENT',stats:[['SEND','Handle · QR · Link'],['OFFLINE','Replay safe'],['CARD','JIT policy'],['LEDGER','Double-entry']]},
  portfolio:{label:'PORTFOLIO DESK',stats:[['VIEW','Money + positions'],['PROOF','Receipts'],['ACTION','Everything reusable'],['CUSTODY','User-owned']]},
  credit:{label:'CREDIT DESK',stats:[['INTERNAL','Funded pool'],['DEFI','Kamino route'],['RISK','Visible LTV'],['CLAIM','No money creation']]},
  lab:{label:'MARKET FACTORY',stats:[['TEMPLATES','360'],['FAMILIES','16'],['RULES','15 settlement'],['LANE','PreStocks only']]},
  launch:{label:'LAUNCH DESK',stats:[['EVM','Pons v2'],['SOLANA','Token-2022'],['CURVE','Meteora DBC'],['PROOF','Wallet receipt']]},
  infrastructure:{label:'SYSTEM DESK',stats:[['SYSTEMS','9'],['MESSAGE','ISO 20022'],['SECURITY','PQ receipts'],['LEDGER','Hash linked']]},
  coverage:{label:'PROOF DESK',stats:[['RULE','No receipt · no claim'],['TRACK','Bounty mapped'],['CODE','Canonical repo'],['STATE','Live / Adapter / Pending']]},
  cmesh:{label:'CMESH DESK',stats:[['ROLE','Platform token'],['CHAIN','Robinhood Chain'],['ORIGIN','Pons'],['PRESTOCK','No']]},
};

function mountCommandBar(id,meta){
  const view=q('#view-'+id); if(!view||view.querySelector('.competition-command-bar')) return;
  const host=view.querySelector('.surface-statusbar') || view.querySelector('.cmesh-hero');
  const bar=document.createElement('section');
  bar.className='competition-command-bar';
  bar.innerHTML=`<div class="ccb-title"><span>${meta.label}</span><i></i></div><div class="ccb-stats">${meta.stats.map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`;
  if(host?.parentNode) host.after(bar); else view.prepend(bar);
}
Object.entries(pageMeta).forEach(([id,m])=>mountCommandBar(id,m));



const pageActions={
  markets:[
    {label:'Buy PreStock',sub:'Wallet-signed Jupiter',nav:'markets',selector:'[data-quick-buy]'},
    {label:'Auto-buy',sub:'Recurring allocation',nav:'markets',selector:'[data-quick-auto]'},
    {label:'Play it',sub:'Use the thesis',nav:'play'},
    {label:'Shop with it',sub:'Convert only what you need',nav:'commerce'},
    {label:'Credit',sub:'Supported collateral',nav:'credit'},
    {label:'Market Lab',sub:'Program a payoff',nav:'lab'}
  ],
  wallet:[
    {label:'Convert',sub:'SOL · USDC · PreStocks',selector:'#swapExecuteBtn'},
    {label:'Buy',sub:'Open PreStocks',nav:'markets'},
    {label:'Shop',sub:'Use wallet value',nav:'commerce'},
    {label:'Send',sub:'MAQUE payments',nav:'vault'},
    {label:'AI budget',sub:'Fund an agent',nav:'agents'},
    {label:'Portfolio',sub:'See everything',nav:'portfolio'}
  ],
  play:[
    {label:'$10 game',sub:'Visible max loss',selector:'[data-game-stake="10"]'},
    {label:'$25 game',sub:'More upside',selector:'[data-game-stake="25"]'},
    {label:'Challenge',sub:'Head-to-head',selector:'#challengeJoinInput'},
    {label:'Build game',sub:'Market Lab',nav:'lab'},
    {label:'Fund',sub:'Stocklana money',nav:'wallet'},
    {label:'Portfolio',sub:'Positions',nav:'portfolio'}
  ],
  commerce:[
    {label:'New purchase',sub:'Merchant-bound',selector:'#commerceUrl'},
    {label:'AI shopper',sub:'Policy-scoped',nav:'agents'},
    {label:'Funding',sub:'Wallet + Stocklana',nav:'wallet'},
    {label:'PreStocks',sub:'Use approved value',nav:'markets'},
    {label:'Money',sub:'Send / request',nav:'vault'},
    {label:'Proof',sub:'Receipts',nav:'coverage'}
  ],
  agents:[
    {label:'Create agent',sub:'Budget + merchants',selector:'#agentCreateId'},
    {label:'Shop',sub:'Agent commerce',nav:'commerce'},
    {label:'Fund',sub:'Stocklana money',nav:'wallet'},
    {label:'Portfolio',sub:'Human account',nav:'portfolio'},
    {label:'System',sub:'Vault fabric',nav:'infrastructure'},
    {label:'Proof',sub:'Scoped identity',nav:'coverage'}
  ],
  vault:[
    {label:'Add money',sub:'Provider / wallet',selector:'#fundWalletBtn'},
    {label:'Send',sub:'Human payment',selector:'#sendMoneyBtn'},
    {label:'Request',sub:'Shareable payment',selector:'#maqueRequestBtn'},
    {label:'One-time card',sub:'Merchant policy',selector:'#singleUseCardBtn'},
    {label:'Shop',sub:'Internet commerce',nav:'commerce'},
    {label:'Portfolio',sub:'Balances + positions',nav:'portfolio'}
  ],
  portfolio:[
    {label:'Buy',sub:'Add PreStocks',nav:'markets'},
    {label:'Play',sub:'Use a thesis',nav:'play'},
    {label:'Shop',sub:'Spend governed value',nav:'commerce'},
    {label:'AI',sub:'Delegate a budget',nav:'agents'},
    {label:'Credit',sub:'Borrow options',nav:'credit'},
    {label:'Send',sub:'Move money',nav:'vault'}
  ],
  credit:[
    {label:'Quote',sub:'Funded internal pool',selector:'#internalBorrowBtn'},
    {label:'Kamino',sub:'Wallet-signed DeFi',selector:'#kaminoBorrowBtn'},
    {label:'Portfolio',sub:'Collateral view',nav:'portfolio'},
    {label:'PreStocks',sub:'Eligible assets',nav:'markets'},
    {label:'Money',sub:'Balances',nav:'wallet'},
    {label:'Proof',sub:'Accounting state',nav:'infrastructure'}
  ],
  lab:[
    {label:'Create market',sub:'Fully collateralized',selector:'#createMarketBtn'},
    {label:'PreStocks',sub:'Choose underlying',nav:'markets'},
    {label:'Play',sub:'See live games',nav:'play'},
    {label:'Portfolio',sub:'Track positions',nav:'portfolio'},
    {label:'System',sub:'Settlement',nav:'infrastructure'},
    {label:'Proof',sub:'Track fit',nav:'coverage'}
  ],
  launch:[
    {label:'Create',sub:'Pons / Solana',selector:'[data-launch-tab="create"]'},
    {label:'Portfolio',sub:'Tracked launches',selector:'[data-launch-tab="portfolio"]'},
    {label:'Import',sub:'Existing token',selector:'[data-launch-tab="import"]'},
    {label:'CMESH',sub:'Platform token',nav:'cmesh'},
    {label:'System',sub:'Rails + receipts',nav:'infrastructure'},
    {label:'Proof',sub:'Onchain evidence',nav:'coverage'}
  ],
  infrastructure:[
    {label:'Accounting',sub:'Double-entry',nav:'infrastructure'},
    {label:'Solana',sub:'Coordination layer',nav:'play'},
    {label:'Agent Vaults',sub:'Scoped finance',nav:'agents'},
    {label:'Payments',sub:'MAQUE + ISO',nav:'vault'},
    {label:'Launch',sub:'Asset rails',nav:'launch'},
    {label:'Proof',sub:'Certification',nav:'coverage'}
  ],
  coverage:[
    {label:'PreStocks',sub:'Track wedge',nav:'markets'},
    {label:'Play',sub:'Programmable assets',nav:'play'},
    {label:'Shop',sub:'Utility',nav:'commerce'},
    {label:'AI',sub:'Agent commerce',nav:'agents'},
    {label:'System',sub:'Execution proof',nav:'infrastructure'},
    {label:'Launch',sub:'Onchain creation',nav:'launch'}
  ],
  cmesh:[
    {label:'Connect',sub:'Robinhood Chain',selector:'#cmeshConnectBtn'},
    {label:'Buy',sub:'Pons curve',selector:'#cmeshBuyBtn'},
    {label:'Sell',sub:'Pons curve',selector:'#cmeshSellBtn'},
    {label:'Explorer',sub:'Chain proof',selector:'#cmeshExplorerBtn'},
    {label:'Launch',sub:'Creation desk',nav:'launch'},
    {label:'Home',sub:'Stocklana',nav:'home'}
  ]
};

function mountActionRibbon(id){
  const view=q('#view-'+id),items=pageActions[id];if(!view||!items||view.querySelector('.competition-action-ribbon'))return;
  const anchor=view.querySelector('.competition-command-bar')||view.querySelector('.surface-statusbar')||view.querySelector('.cmesh-hero');
  const bar=document.createElement('section');bar.className='competition-action-ribbon';
  bar.innerHTML=items.map((a,i)=>`<button data-competition-action="${i}"><span>${String(i+1).padStart(2,'0')}</span><div><b>${a.label}</b><small>${a.sub}</small></div><i>→</i></button>`).join('');
  anchor?.after(bar);
  bar.querySelectorAll('[data-competition-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=items[Number(b.dataset.competitionAction)];
    if(a.nav){document.querySelector(`[data-nav="${a.nav}"]`)?.click();return}
    const target=view.querySelector(a.selector)||document.querySelector(a.selector);
    target?.focus?.();target?.click?.();
  }));
}
Object.keys(pageActions).forEach(mountActionRibbon);

function decorateCards(){
  qa('.view:not(#view-home) .route,.view:not(#view-home) .asset-card,.view:not(#view-home) .game-card,.view:not(#view-home) .neo-card').forEach((el,i)=>{
    if(el.querySelector(':scope > .competition-corner')) return;
    const c=document.createElement('span'); c.className='competition-corner'; c.textContent=String((i%12)+1).padStart(2,'0'); el.appendChild(c);
  });
}
decorateCards();

function addSectionRails(){
  qa('.view:not(#view-home) .section-head.compact').forEach(h=>{
    if(h.previousElementSibling?.classList?.contains('competition-divider')) return;
    const d=document.createElement('div'); d.className='competition-divider'; d.innerHTML='<i></i><span>STOCKLANA</span><i></i>'; h.before(d);
  });
}
addSectionRails();

async function hydrateMeta(){
  try{
    const [cfg,sys,home]=await Promise.all([
      fetch('/api/config',{cache:'no-store'}).then(r=>r.ok?r.json():{}),
      fetch('/api/systems',{cache:'no-store'}).then(r=>r.ok?r.json():{}),
      fetch('/api/v2/home',{cache:'no-store'}).then(r=>r.ok?r.json():{}),
    ]);
    const map={
      markets:[['ELIGIBLE',String((home.equities||[]).length||8)+' listed'],['TRADING','24 / 7'],['ROUTING','Jupiter V2'],['NETWORK',String(cfg.walletCluster||cfg.cluster||'mainnet-beta').toUpperCase()]],
      infrastructure:[['SYSTEMS',String(sys.count||9)],['MESSAGE','ISO 20022'],['PROGRAM',cfg.programDeployed?'DEPLOYED':'DEVNET'],['ARCH','Hybrid Solana']],
      play:[['MODEL','Fully collateralized'],['HOUSE','0 directional'],['PROGRAM',cfg.programDeployed?'DEPLOYED':'DEVNET'],['CLUSTER',String(cfg.programCluster||'devnet').toUpperCase()]],
    };
    Object.entries(map).forEach(([id,stats])=>{
      const bar=q('#view-'+id+' .competition-command-bar .ccb-stats'); if(!bar)return;
      bar.innerHTML=stats.map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('');
    });
  }catch{}
}
hydrateMeta();

const observer=new MutationObserver(()=>{decorateCards();addSectionRails()});
qa('.view').forEach(v=>observer.observe(v,{childList:true,subtree:true}));

document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');
  if(!nav)return;
  requestAnimationFrame(()=>document.body.dataset.surface=nav.dataset.nav||'home');
});
