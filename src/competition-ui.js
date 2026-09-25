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
