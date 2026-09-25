import { connectSolanaWallet, walletState, sendSplToken, executeChainBackedTrade, signSerializedTransaction, detectSolanaWalletProvider, readWalletPortfolio, onWalletAccountChanged, getSolanaConnection, sendSolanaInstructions } from './solana-client.js';
import { connectRobinhood, getPonsConfig, launchPonsV2, readPonsLaunch, buyPons, sellPons, PONS_V2 } from './pons-v2.js';
import { buildInitializeMarket, buildBuy, buildResolve, buildRedeem } from './stocklana-program-client.js';
let sessionToken=null;
const nativeFetch=window.fetch.bind(window);
const API_ORIGIN=String(window.STOCKLANA_RUNTIME?.apiOrigin||'').replace(/\/$/,'');
const apiUrl=url=>url.startsWith('/api/')&&API_ORIGIN?API_ORIGIN+url:url;
window.fetch=(input,init={})=>{
 const raw=typeof input==='string'?input:input.url;
 const url=apiUrl(raw);
 if(sessionToken && raw.startsWith('/api/')){const h=new Headers(init.headers||{});h.set('Authorization',`Bearer ${sessionToken}`);init={...init,headers:h}}
 return nativeFetch(url,init)
};
function b64(bytes){let x='';for(const b of bytes)x+=String.fromCharCode(b);return btoa(x)}
async function authenticateWallet(w){
 const c=await nativeFetch(apiUrl('/api/auth/challenge'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:w.publicKey})}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()});
 if(!w.provider?.signMessage) throw new Error('wallet_sign_message_not_supported');
 const sig=await w.provider.signMessage(new TextEncoder().encode(c.message),'utf8');
 const signature=b64(sig.signature||sig);
 const v=await nativeFetch(apiUrl('/api/auth/verify'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:w.publicKey,nonce:c.nonce,signature})}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()});
 sessionToken=v.token; return v;
}
const fallback=[
{name:'Anduril PreStocks',symbol:'ANDURIL',contract_address:'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB',markPrice:153.94648367,markValuation:136196308976,tokenPrice:157.72755883,impliedValuation:139541422604,image:'https://www.prestocks.com/logos/anduril.png'},
{name:'Anthropic PreStocks',symbol:'ANTHROPIC',contract_address:'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',markPrice:1050.44176843,markValuation:1720983186253,tokenPrice:1052.12506369,impliedValuation:1723741000088,image:'https://www.prestocks.com/logos/anthropic.png'},
{name:'Figure AI PreStocks',symbol:'FIGUREAI',contract_address:'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd',markPrice:181.8939899,markValuation:39657798034,tokenPrice:181.91997802,impliedValuation:39663464145,image:'https://www.prestocks.com/logos/figureai.png'},
{name:'Kalshi PreStocks',symbol:'KALSHI',contract_address:'PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua',markPrice:893.11947124,markValuation:32484588776,tokenPrice:860.81568097,impliedValuation:31309633603,image:'https://www.prestocks.com/logos/kalshi.png'},
{name:'Neuralink PreStocks',symbol:'NEURALINK',contract_address:'PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S',markPrice:336.79705453,markValuation:64158171576,tokenPrice:424.54027376,impliedValuation:80872820466,image:'https://www.prestocks.com/logos/neuralink.png'},
{name:'OpenAI PreStocks',symbol:'OPENAI',contract_address:'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',markPrice:995.56955666,markValuation:1233441287355,tokenPrice:1127.221603,impliedValuation:1396548996348,image:'https://www.prestocks.com/logos/openai.png'},
{name:'Polymarket PreStocks',symbol:'POLYMARKET',contract_address:'Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP',markPrice:144.29858563,markValuation:14231558175,tokenPrice:142.15989838,impliedValuation:14020628512,image:'https://www.prestocks.com/logos/polymarket.png'},
{name:'SpaceX PreStocks',symbol:'SPACEX',contract_address:'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh',markPrice:152.62406151,markValuation:2001071028648,tokenPrice:116.46045229,impliedValuation:1526925930061,image:'https://www.prestocks.com/logos/spacex.png'}];
let assets=[...fallback], selected='OPENAI', marketType='threshold', wallet=null, markets=[], config={}, vault={balances:{USDC:0}}, positions=[], lastWalletPortfolio=null, games=[], gameStake=10, gameFilter='all', selectedFundingRoute=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], trader=()=>wallet?.publicKey||'guest';
const UX_MODE_KEY='stocklana:ux:advanced';
function setUxMode(advanced){
 document.body.classList.toggle('simple-mode',!advanced);
 document.body.classList.toggle('advanced-mode',advanced);
 const b=$('#uxModeBtn');if(b){b.setAttribute('aria-pressed',String(advanced));b.textContent=advanced?'Simple':'Advanced'}
 localStorage.setItem(UX_MODE_KEY,advanced?'1':'0');
}
const money=n=>Number(n)>=1e12?`$${(Number(n)/1e12).toFixed(2)}T`:Number(n)>=1e9?`$${(Number(n)/1e9).toFixed(1)}B`:`$${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
const premium=a=>((Number(a.tokenPrice)/Number(a.markPrice))-1)*100, short=x=>x?`${x.slice(0,4)}…${x.slice(-4)}`:'guest';
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
async function actionSheet({kicker='STOCKLANA',title,copy='',confirmLabel='Continue',fields=[],summary=''}){
 const dialog=$('#actionDialog'),form=$('#actionDialogForm'),fieldBox=$('#actionDialogFields'),summaryBox=$('#actionDialogSummary');
 if(!dialog||!form)return null;
 $('#actionDialogKicker').textContent=kicker;$('#actionDialogTitle').textContent=title||'Continue';$('#actionDialogCopy').textContent=copy;$('#actionDialogConfirm').textContent=confirmLabel;
 fieldBox.innerHTML=fields.map(f=>{const opts=(f.options||[]).map(o=>`<option value="${typeof o==='string'?o:o.value}">${typeof o==='string'?o:o.label}</option>`).join('');return `<label>${f.label}${f.type==='select'?`<select name="${f.name}">${opts}</select>`:`<input name="${f.name}" type="${f.type||'text'}" value="${f.value??''}" placeholder="${f.placeholder||''}" ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} ${f.step!=null?`step="${f.step}"`:''} />`}${f.help?`<small>${f.help}</small>`:''}</label>`}).join('');
 if(summary){summaryBox.hidden=false;summaryBox.innerHTML=summary}else{summaryBox.hidden=true;summaryBox.innerHTML=''}
 dialog.showModal();
 return await new Promise(resolve=>{
   const done=()=>{const ok=dialog.returnValue==='confirm';const values=ok?Object.fromEntries(new FormData(form).entries()):null;resolve(values)};
   dialog.addEventListener('close',done,{once:true});
 });
}

const JUDGE_STATE_KEY='stocklana:judge-loop:v1';
const judgeState=()=>{try{return JSON.parse(localStorage.getItem(JUDGE_STATE_KEY)||'{}')}catch{return {}}};
const saveJudgeState=s=>{localStorage.setItem(JUDGE_STATE_KEY,JSON.stringify(s));return s};
const explorerUrl=(kind,value,cluster='devnet')=>`https://explorer.solana.com/${kind}/${value}?cluster=${encodeURIComponent(cluster)}`;
async function sha256Hex(value){
 const bytes=new TextEncoder().encode(String(value));const hash=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function renderJudgeLoop(){
 const cluster=String(config.programCluster||'devnet'),programId=config.programId||'',usdc=config.programUsdcMint||'';
 const s=judgeState(),sameProgram=!s.programId||s.programId===programId;
 if($('#judgeProgramCluster'))$('#judgeProgramCluster').textContent=cluster.toUpperCase();
 if($('#judgeProgramId'))$('#judgeProgramId').textContent=programId?short(programId):'Deployment pending';
 if($('#judgeProgramUsdc'))$('#judgeProgramUsdc').textContent=usdc?short(usdc):'Circle Devnet USDC';
 if($('#judgeMarketAddress'))$('#judgeMarketAddress').textContent=s.market&&sameProgram?short(s.market):'Create one below';
 const connected=!!wallet?.publicKey,ready=connected&&!!programId&&!!config.programRpcUrl&&!!usdc;
 const create=$('#judgeCreateMarketBtn'),stake=$('#judgeStakeYesBtn'),resolve=$('#judgeResolveBtn'),redeem=$('#judgeRedeemBtn'),status=$('#judgeLoopStatus');
 if(create)create.disabled=!ready;
 if(stake)stake.disabled=!(ready&&s.market&&sameProgram&&!s.staked);
 const now=Math.floor(Date.now()/1000),canResolve=ready&&s.market&&sameProgram&&s.staked&&!s.resolved&&now>=Number(s.resolveAt||0);
 if(resolve)resolve.disabled=!canResolve;
 if(redeem)redeem.disabled=!(ready&&s.market&&sameProgram&&s.resolved&&!s.redeemed);
 if(status){
   if(!programId)status.textContent='Stocklana program deployment is the final Devnet activation step.';
   else if(!connected)status.textContent='Connect Phantom to begin the live Devnet loop.';
   else if(!s.market||!sameProgram)status.textContent='Ready: create a 1-minute OPENAI market on Solana Devnet.';
   else if(!s.staked)status.textContent='Market created. Fund Phantom with Devnet USDC, then stake 1 USDC.';
   else if(!s.resolved){const left=Math.max(0,Number(s.resolveAt||0)-now);status.textContent=left?`Stake confirmed. Resolve becomes available in ${left}s.`:'Stake confirmed. Resolve the market with an onchain proof commitment.'}
   else if(!s.redeemed)status.textContent='Resolved onchain. Redeem the winning position.';
   else status.textContent='Complete: create → stake → resolve → redeem all confirmed on Solana.';
 }
 const link=$('#judgeExplorerLink');
 if(link){if(s.lastSignature){link.href=explorerUrl('tx',s.lastSignature,cluster);link.textContent='Open latest Solana proof ↗'}else if(programId){link.href=explorerUrl('address',programId,cluster);link.textContent='Open program on Solana ↗'}}
 document.querySelector('[data-judge-step="connect"]')?.classList.toggle('done',connected);
 create?.classList.toggle('done',!!s.market&&sameProgram);
 stake?.classList.toggle('done',!!s.staked&&sameProgram);
 resolve?.classList.toggle('done',!!s.resolved&&sameProgram);
 redeem?.classList.toggle('done',!!s.redeemed&&sameProgram);
}
async function judgeEnsureWallet(){
 if(wallet?.provider&&sessionToken){renderJudgeLoop();return wallet}
 return await connectPrimaryWallet();
}
async function judgeCreateMarket(){
 try{
   await judgeEnsureWallet();
   if(!config.programId)throw new Error('stocklana_devnet_program_not_deployed');
   const a=assets.find(x=>x.symbol==='OPENAI')||assets[0],connection=await getSolanaConnection(config.programRpcUrl),seed=Date.now(),resolveAt=Math.floor(Date.now()/1000)+75;
   toast('Building the Devnet market transaction');
   const built=await buildInitializeMarket({programId:config.programId,authority:wallet.publicKey,underlyingMint:a.contract_address,collateralMint:config.programUsdcMint,marketSeed:seed,resolveAt,feeBps:100,connection});
   toast('Approve market creation in Phantom');
   const sig=await sendSolanaInstructions({provider:wallet.provider,instructions:built.instructions,rpc:config.programRpcUrl});
   saveJudgeState({programId:config.programId,cluster:config.programCluster||'devnet',market:built.market.toString(),marketSeed:seed,resolveAt,underlyingMint:a.contract_address,collateralMint:config.programUsdcMint,createSignature:sig,lastSignature:sig,staked:false,resolved:false,redeemed:false});
   toast('Solana market created');renderJudgeLoop();
 }catch(e){toast(String(e.message||e))}
}
async function judgeStakeYes(){
 try{
   await judgeEnsureWallet();const s=judgeState();if(!s.market)throw new Error('create_market_first');
   const ix=await buildBuy({programId:config.programId,market:s.market,trader:wallet.publicKey,collateralMint:config.programUsdcMint,stake:1_000_000,side:'YES'});
   toast('Approve 1 Devnet USDC stake in Phantom');
   const sig=await sendSolanaInstructions({provider:wallet.provider,instructions:[ix],rpc:config.programRpcUrl});
   saveJudgeState({...s,staked:true,stakeSignature:sig,lastSignature:sig});toast('YES stake confirmed on Solana');renderJudgeLoop();
 }catch(e){toast(String(e.message||e))}
}
async function judgeResolve(){
 try{
   await judgeEnsureWallet();const s=judgeState();if(Math.floor(Date.now()/1000)<Number(s.resolveAt||0))throw new Error('demo_market_timer_not_finished');
   const proof=await sha256Hex(JSON.stringify({market:s.market,outcome:'YES',source:'Stocklana judge demo',at:Date.now()}));
   const ix=await buildResolve({programId:config.programId,market:s.market,authority:wallet.publicKey,outcome:'YES',proofCommitmentHex:proof});
   toast('Approve proof-backed resolution in Phantom');
   const sig=await sendSolanaInstructions({provider:wallet.provider,instructions:[ix],rpc:config.programRpcUrl});
   saveJudgeState({...s,resolved:true,resolutionProof:proof,resolveSignature:sig,lastSignature:sig});toast('Market resolved on Solana');renderJudgeLoop();
 }catch(e){toast(String(e.message||e))}
}
async function judgeRedeem(){
 try{
   await judgeEnsureWallet();const s=judgeState();const ix=await buildRedeem({programId:config.programId,market:s.market,owner:wallet.publicKey,collateralMint:config.programUsdcMint});
   toast('Approve redemption in Phantom');
   const sig=await sendSolanaInstructions({provider:wallet.provider,instructions:[ix],rpc:config.programRpcUrl});
   saveJudgeState({...s,redeemed:true,redeemSignature:sig,lastSignature:sig});toast('Winning payout redeemed on Solana');renderJudgeLoop();
 }catch(e){toast(String(e.message||e))}
}

function navigate(v){$$('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${v}`));$$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v));if(v==='wallet')loadWalletCenter();if(v==='commerce'){loadCommerce();loadFundingPlan()}if(v==='play'){loadGames();renderJudgeLoop()}if(v==='cmesh')loadCmesh();if(v==='vault')loadVault();if(v==='home')loadV2Home();if(v==='credit')loadCredit();window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
const globalActions=[
 {label:'Buy a company',sub:'PreStocks',nav:'markets'},
 {label:'Convert money',sub:'SOL · USDC · PreStocks',nav:'wallet'},
 {label:'Play a payoff game',sub:'YES / NO games',nav:'play'},
 {label:'Shop online',sub:'Use wallet or portfolio',nav:'commerce'},
 {label:'Send money',sub:'Stocklana + Solana payments',nav:'vault'},
 {label:'Give an AI a budget',sub:'Controlled agent spending',nav:'agents'},
 {label:'Portfolio',sub:'Positions · balances · activity',nav:'portfolio'},
 {label:'CMESH',sub:'Pons platform token · not a PreStock',nav:'cmesh'},
 {label:'Credit',sub:'Supported collateral routes',nav:'credit'},
 {label:'Launch',sub:'Pons · Token-2022 · Meteora',nav:'launch'},
 {label:'Market Lab',sub:'Build programmable payoff markets',nav:'lab'},
 {label:'System',sub:'Settlement · accounting · infrastructure',nav:'infrastructure'},
 {label:'Proof',sub:'Receipts · certification · track fit',nav:'coverage'}
];
function buildGlobalSearchResults(q=''){
 const box=$('#globalSearchResults');if(!box)return;
 const term=String(q||'').trim().toLowerCase();
 const assetRows=assets.filter(a=>!term||a.symbol.toLowerCase().includes(term)||a.name.toLowerCase().includes(term)).slice(0,5).map(a=>({label:a.name.replace(' PreStocks',''),sub:a.symbol+' · PreStock',asset:a.symbol}));
 const actionRows=globalActions.filter(x=>!term||x.label.toLowerCase().includes(term)||x.sub.toLowerCase().includes(term)).slice(0,8);
 const rows=[...assetRows,...actionRows].slice(0,8);
 box.innerHTML=rows.map((x,i)=>`<button data-search-index="${i}"><b>${x.label}</b><small>${x.sub}</small></button>`).join('');
 box.hidden=!rows.length;
 box.querySelectorAll('[data-search-index]').forEach((b,i)=>b.onclick=()=>{const x=rows[i];box.hidden=true;$('#globalSearch').value='';if(x.asset)openAsset(x.asset);else navigate(x.nav)});
}
$('#globalSearch')?.addEventListener('input',e=>buildGlobalSearchResults(e.target.value));
$('#globalSearch')?.addEventListener('focus',e=>buildGlobalSearchResults(e.target.value));
$('#globalSearch')?.addEventListener('keydown',e=>{if(e.key==='Escape')$('#globalSearchResults').hidden=true});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch')?.focus()}});
document.addEventListener('click',e=>{if(!e.target.closest('.neo-search')&&$('#globalSearchResults'))$('#globalSearchResults').hidden=true});

$('#uxModeBtn')?.addEventListener('click',()=>setUxMode(!document.body.classList.contains('advanced-mode')));
setUxMode(localStorage.getItem(UX_MODE_KEY)==='1');
function renderAssets(){
 $('#assetCount').textContent=assets.length; $('#ticker').innerHTML=assets.map(a=>{const p=premium(a);return `<div class="tick ${p>=0?'pos':'neg'}"><b>${a.symbol}</b>${p>=0?'+':''}${p.toFixed(1)}% premium</div>`}).join('');
 $('#assetGrid').innerHTML=assets.map(a=>{const p=premium(a);return `<article class="asset-card" data-asset-card="${a.symbol}"><div class="asset-head"><img class="asset-logo" src="${a.image||''}" alt=""/><span class="premium ${p>=0?'pos':'neg'}">${p>=0?'+':''}${p.toFixed(1)}%</span></div><h3>${a.name.replace(' PreStocks','')}</h3><span class="sym">${a.symbol}</span><div class="price">${money(a.tokenPrice)}</div><div class="valuation">Implied ${money(a.impliedValuation)}</div><div class="asset-actions"><button data-quick-buy="${a.symbol}">Buy</button><button data-quick-auto="${a.symbol}">Auto</button><button data-asset="${a.symbol}">More</button></div></article>`}).join('');
 $('#assetPicker').innerHTML=assets.map(a=>`<button class="pick ${a.symbol===selected?'active':''}" data-pick="${a.symbol}">${a.symbol}</button>`).join('');
 refreshSwapTargets(); document.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>openAsset(b.dataset.asset)); document.querySelectorAll('[data-quick-buy]').forEach(b=>b.onclick=()=>buyUnderlying(assets.find(a=>a.symbol===b.dataset.quickBuy))); $$('[data-quick-auto]').forEach(b=>b.onclick=()=>scheduleRecurring(assets.find(a=>a.symbol===b.dataset.quickAuto))); $$('[data-pick]').forEach(b=>b.onclick=()=>{selected=b.dataset.pick;renderAssets();buildFields()});
}
function refreshSwapTargets(){
 const from=$('#swapFrom'),to=$('#swapTo');if(!from||!to)return;
 const curFrom=from.value||'SOL',curTo=to.value||'USDC';
 const held=lastWalletPortfolio?.prestocks||[];
 from.innerHTML='<option value="SOL">SOL</option><option value="USDC">USDC</option>'+held.map(h=>`<option value="${h.mint}">${h.symbol} · ${Number(h.amount||0).toLocaleString(undefined,{maximumFractionDigits:6})}</option>`).join('');
 to.innerHTML='<option value="USDC">USDC</option><option value="SOL">SOL</option>'+assets.map(a=>`<option value="${a.contract_address}">${a.symbol} · PreStock</option>`).join('');
 if([...from.options].some(o=>o.value===curFrom))from.value=curFrom;
 if([...to.options].some(o=>o.value===curTo))to.value=curTo;
}
function renderMarketFeed(){
 $('#marketCount').textContent=markets.length; const open=markets.filter(m=>m.status==='OPEN');
 $('#marketFeed').innerHTML=open.slice(0,14).map(m=>{const y=Math.round((m.yesProbability??.5)*100);return `<article class="feed-card" data-mid="${m.id}"><div class="top"><div><span class="kicker">${(m.rule?.type||'MARKET').replaceAll('_',' ').toUpperCase()}</span><h3>${m.question}</h3></div><span class="status-pill">${m.symbol}</span></div><div class="feed-meta"><span>${money(m.volume||0)} volume</span><span>${m.trades?.length||0} trades</span><span>${m.resolveAt}</span></div><div class="feed-prices"><button class="quicktrade yes" data-side="YES"><small>BUY YES</small><b>${y}¢</b></button><button class="quicktrade no" data-side="NO"><small>BUY NO</small><b>${100-y}¢</b></button></div></article>`}).join('');
 $('.quicktrade').forEach(b=>b.onclick=async()=>{const card=b.closest('[data-mid]');const v=await actionSheet({kicker:'PLAY',title:`Buy ${b.dataset.side}`,copy:'Choose your stake. Stocklana shows the quote before moving money.',confirmLabel:'Preview trade',fields:[{name:'shares',label:'Stake / shares',type:'number',value:'10',min:1,step:1}]});const shares=Number(v?.shares||0);if(shares>0)await trade(card.dataset.mid,b.dataset.side,shares)});
}
function openAsset(sym){const a=assets.find(x=>x.symbol===sym),p=premium(a);$('#assetDialogContent').innerHTML=`<div class="dialog-hero"><img src="${a.image||''}" alt=""/><div><span class="kicker">PRESTOCK</span><h2>${a.name.replace(' PreStocks','')}</h2><p>${a.symbol} · ${a.contract_address.slice(0,6)}…${a.contract_address.slice(-5)}</p></div></div><div class="stat-grid"><div class="stat"><span>Token price</span><b>${money(a.tokenPrice)}</b></div><div class="stat"><span>Mark price</span><b>${money(a.markPrice)}</b></div><div class="stat"><span>Implied valuation</span><b>${money(a.impliedValuation)}</b></div><div class="stat"><span>Mark premium</span><b>${p>=0?'+':''}${p.toFixed(2)}%</b></div></div><div class="idea-list"><button class="idea buy-underlying"><b>Buy / sell 24/7</b><small>Execute the exact mint through Jupiter Swap V2.</small></button><button class="idea spend-prestock"><b>Spend from this PreStock</b><small>Convert only the amount you approve, then create a merchant-bound purchase.</small></button><button class="idea play-prestock"><b>Play this company</b><small>Open the fully collateralized game shelf for PreStocks.</small></button><button class="idea recurring-buy"><b>Schedule recurring buy</b><small>Daily, weekly or monthly USDC allocation.</small></button><button class="idea social-signal"><b>Share a thesis</b><small>Create a copyable social signal tied to this mint.</small></button><button class="idea" data-jump="threshold"><b>Program a payoff</b><small>Create a fully collateralized equity instrument.</small></button><button class="idea" data-jump="premium"><b>Premium convergence</b><small>Trade token-vs-mark dislocation.</small></button><button class="idea" data-jump="relative"><b>Relative value</b><small>Company vs company.</small></button></div>`;$('#assetDialog').showModal();$('#assetDialogContent .spend-prestock')?.addEventListener('click',()=>startSpendFromPrestock(a.symbol));$('#assetDialogContent .play-prestock')?.addEventListener('click',()=>{selected=a.symbol;$('#assetDialog').close();navigate('play')});$('.buy-underlying').onclick=()=>buyUnderlying(a);$('.recurring-buy').onclick=()=>scheduleRecurring(a);$('.social-signal').onclick=()=>shareSignal(a);$$('[data-jump]').forEach(x=>x.onclick=()=>{selected=sym;marketType=x.dataset.jump;$('#assetDialog').close();navigate('lab');syncType();renderAssets();buildFields()})}
function basketMembers(name){if((name||'').startsWith('Frontier'))return ['OPENAI','ANTHROPIC','FIGUREAI'];if((name||'').startsWith('Future'))return ['SPACEX','ANDURIL','NEURALINK'];if((name||'').startsWith('Prediction'))return ['KALSHI','POLYMARKET'];return assets.map(x=>x.symbol)}
function marketQuestion(){const a=assets.find(x=>x.symbol===selected), expiry=$('#expiry')?.value||'2027-06-30', other=$('#other')?.value;if(marketType==='threshold')return `Will ${a.symbol} implied valuation be above $${$('#target')?.value||0}B by ${expiry}?`;if(marketType==='price')return `Will ${a.symbol} trade above $${$('#priceTarget')?.value||0} by ${expiry}?`;if(marketType==='premium')return `Will ${a.symbol} token premium to mark be within ${$('#premiumBand')?.value||5}% by ${expiry}?`;if(marketType==='relative')return `Will ${a.symbol} outperform ${other} through ${expiry}?`;if(marketType==='spread')return `Will ${a.symbol}/${other} valuation ratio finish above its launch ratio by ${expiry}?`;if(marketType==='move')return `Will ${a.symbol} move at least ${$('#movePct')?.value||20}% in either direction from launch by ${expiry}?`;if(marketType==='leader')return `Will ${a.symbol} be the top-performing PreStock in ${$('#leaderUniverse')?.value||'All 8 PreStocks'} by ${expiry}?`;if(marketType==='pricezone')return `Will ${a.symbol} finish between $${$('#zoneLow')?.value} and $${$('#zoneHigh')?.value} by ${expiry}?`;if(marketType==='valuezone')return `Will ${a.symbol} implied valuation finish between $${$('#zoneLow')?.value}B and $${$('#zoneHigh')?.value}B by ${expiry}?`;if(marketType==='gain')return `Will ${a.symbol} gain at least ${$('#returnPct')?.value||15}% from launch by ${expiry}?`;if(marketType==='shield')return `Will ${a.symbol} avoid falling more than ${$('#returnPct')?.value||15}% from launch by ${expiry}?`;if(marketType==='duel')return `Will ${a.symbol} outperform ${other} by at least ${$('#marginPct')?.value||5} percentage points by ${expiry}?`;if(marketType==='green')return `Will at least ${$('#greenCount')?.value||2} members of ${$('#basket')?.value||'the basket'} finish above launch by ${expiry}?`;return `Will the ${$('#basket')?.value||'PreStocks basket'} finish above its launch level by ${expiry}?`;}
function buildFields(){const a=assets.find(x=>x.symbol===selected);let h='';const others=()=>assets.filter(x=>x.symbol!==selected).map(x=>`<option>${x.symbol}</option>`).join('');if(marketType==='threshold')h=`<div class="field"><label>Target implied valuation</label><input id="target" type="number" value="${Math.round(a.impliedValuation/1e9/50)*50}"/><small>USD billions</small></div>`;if(marketType==='price')h=`<div class="field"><label>Token price target</label><input id="priceTarget" type="number" step="0.01" value="${(a.tokenPrice*1.2).toFixed(2)}"/></div>`;if(marketType==='premium')h=`<div class="field"><label>Absolute premium band</label><input id="premiumBand" type="number" value="5"/><small>Percent from mark</small></div>`;if(['relative','spread','duel'].includes(marketType))h=`<div class="field"><label>Against</label><select id="other">${others()}</select></div>`+(marketType==='duel'?`<div class="field"><label>Winning margin</label><input id="marginPct" type="number" value="5"/><small>Percentage points</small></div>`:'');if(['basket','green'].includes(marketType))h=`<div class="field"><label>Basket</label><select id="basket"><option>Frontier AI — OPENAI / ANTHROPIC / FIGUREAI</option><option>Future Systems — SPACEX / ANDURIL / NEURALINK</option><option>Prediction Infra — KALSHI / POLYMARKET</option><option>Private Tech 8 — all PreStocks</option></select></div>`+(marketType==='green'?`<div class="field"><label>Minimum green members</label><input id="greenCount" type="number" value="2" min="1" max="8"/></div>`:'');if(marketType==='move')h=`<div class="field"><label>Absolute move threshold</label><input id="movePct" type="number" value="20"/><small>Percent in either direction from launch</small></div>`;if(marketType==='leader')h=`<div class="field"><label>Universe</label><select id="leaderUniverse"><option>All 8 PreStocks</option><option>Frontier AI</option><option>Future Systems</option></select></div>`;if(['pricezone','valuezone'].includes(marketType)){const low=marketType==='pricezone'?(a.tokenPrice*.9).toFixed(2):(a.impliedValuation/1e9*.9).toFixed(1),high=marketType==='pricezone'?(a.tokenPrice*1.1).toFixed(2):(a.impliedValuation/1e9*1.1).toFixed(1);h=`<div class="field"><label>Zone low</label><input id="zoneLow" type="number" step="0.01" value="${low}"/></div><div class="field"><label>Zone high</label><input id="zoneHigh" type="number" step="0.01" value="${high}"/></div>`}if(['gain','shield'].includes(marketType))h=`<div class="field"><label>${marketType==='gain'?'Minimum gain':'Maximum loss'}</label><input id="returnPct" type="number" value="15"/><small>Percent from launch</small></div>`;h+=`<div class="field"><label>Resolution date</label><input id="expiry" type="date" value="2027-06-30"/></div>`;$('#builderFields').innerHTML=h;updatePreview();$$('#builderFields input,#builderFields select').forEach(x=>x.oninput=updatePreview)}
function buildRule(){const a=assets.find(x=>x.symbol===selected), by=Object.fromEntries(assets.map(x=>[x.symbol,x])), other=$('#other')?.value;if(marketType==='threshold')return {type:'valuation_threshold',operator:'gte',target:Number($('#target').value)*1e9,metric:'impliedValuation',launchValue:Number(a.impliedValuation)};if(marketType==='price')return {type:'price_threshold',operator:'gte',target:Number($('#priceTarget').value),metric:'tokenPrice',launchValue:Number(a.tokenPrice)};if(marketType==='premium')return {type:'premium_band',absMaxPct:Number($('#premiumBand').value),metric:'token_vs_mark',launchToken:Number(a.tokenPrice),launchMark:Number(a.markPrice)};if(marketType==='relative')return {type:'relative_return',left:a.symbol,right:other,leftLaunchPrice:Number(a.tokenPrice),rightLaunchPrice:Number(by[other].tokenPrice)};if(marketType==='spread')return {type:'valuation_ratio',left:a.symbol,right:other,launchRatio:Number(a.impliedValuation)/Number(by[other].impliedValuation)};if(marketType==='move')return {type:'absolute_return',absMinPct:Number($('#movePct').value),launchPrice:Number(a.tokenPrice),metric:'tokenPrice'};if(marketType==='leader'){const members=marketType&&($('#leaderUniverse').value.startsWith('Frontier')?['OPENAI','ANTHROPIC','FIGUREAI']:$('#leaderUniverse').value.startsWith('Future')?['SPACEX','ANDURIL','NEURALINK']:assets.map(x=>x.symbol));return {type:'universe_leader',members,candidate:a.symbol,launchPrices:Object.fromEntries(members.map(s=>[s,Number(by[s].tokenPrice)]))}}if(marketType==='pricezone')return {type:'price_zone',low:Number($('#zoneLow').value),high:Number($('#zoneHigh').value),metric:'tokenPrice',launchPrice:Number(a.tokenPrice)};if(marketType==='valuezone')return {type:'valuation_zone',low:Number($('#zoneLow').value)*1e9,high:Number($('#zoneHigh').value)*1e9,metric:'impliedValuation',launchValue:Number(a.impliedValuation)};if(marketType==='gain')return {type:'return_threshold',operator:'gte',thresholdPct:Number($('#returnPct').value),launchPrice:Number(a.tokenPrice)};if(marketType==='shield')return {type:'return_threshold',operator:'gte',thresholdPct:-Number($('#returnPct').value),launchPrice:Number(a.tokenPrice)};if(marketType==='duel')return {type:'relative_margin',left:a.symbol,right:other,marginPct:Number($('#marginPct').value),leftLaunchPrice:Number(a.tokenPrice),rightLaunchPrice:Number(by[other].tokenPrice)};const members=basketMembers($('#basket')?.value),launchPrices=Object.fromEntries(members.map(s=>[s,Number(by[s].tokenPrice)]));if(marketType==='green')return {type:'green_count',members,minimum:Number($('#greenCount').value),launchPrices};return {type:'basket_return_threshold',members,weights:members.map(()=>1/members.length),thresholdPct:0,launchPrices}}
function updatePreview(){$('#marketPreview').innerHTML=`<b>Market contract</b>${marketQuestion()}<br/><small>Fully collateralized participant pool. Automatic settlement rule is stored with the market; Stocklana collects the disclosed protocol fee and does not take a side.</small>`}
function syncType(){$$('.type').forEach(x=>x.classList.toggle('active',x.dataset.type===marketType))}
$$('.type').forEach(b=>b.onclick=()=>{marketType=b.dataset.type;syncType();buildFields()});
$('#createMarketBtn').onclick=async()=>{if(!sessionToken)return toast('Connect Phantom first');const a=assets.find(x=>x.symbol===selected),payload={underlyingMint:a.contract_address,symbol:a.symbol,question:marketQuestion(),resolveAt:$('#expiry')?.value||'2027-06-30',creator:trader(),feeBps:Number($('#feeBps')?.value||100),pricingMode:'PARIMUTUEL',rule:buildRule()};const r=await fetch('/api/markets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),j=await r.json();if(!r.ok)return toast(j.error||'Market create failed');toast('Market is live and fully collateralized');await loadMarkets();navigate('markets')};
async function trade(mid,side,shares){
 if(trader()==='guest'){toast('Connect wallet first');return}
 const qr=await fetch(`/api/markets/${mid}/quote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({side,shares})}),q=await qr.json();
 if(!qr.ok)return toast(q.error||'Quote failed');
 if(Number(vault.balances?.USDC||0)>=q.total){
   const r=await fetch(`/api/markets/${mid}/trade`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({side,shares,trader:trader(),paymentMode:'vault'})}),j=await r.json();
   if(!r.ok)return toast(j.error||'Trade failed'); toast(`${side} filled from Stocklana Vault · ${money(j.trade.total)}`); await Promise.all([loadMarkets(),loadVault(),loadGames()]); return;
 }
 if(wallet?.provider&&config.vaultAddress){
   try{toast('Approve the on-chain USDC market payment');const j=await executeChainBackedTrade({provider:wallet.provider,marketId:mid,side,shares,vaultAddress:config.vaultAddress,trader:trader(),usdcMint:config.usdcMint});toast(`${side} settled on Solana · ${short(j.chainProof.signature)}`);await Promise.all([loadMarkets(),loadVault(),loadGames()]);return}catch(e){toast(String(e.message||e));return}
 }
 toast(`Need ${money(q.total)} USDC. Deposit or configure the Stocklana Solana vault.`);navigate('vault')
}
function gameTitle(f){
 return ({gain_game:'GAIN GAME',downside_shield:'DOWNSIDE SHIELD',margin_duel:'DUEL',green_majority:'GREEN MAJORITY',leader:'LEADER',price_zone:'PRICE ZONE'})[f]||String(f||'GAME').replaceAll('_',' ').toUpperCase()
}
function renderGameDeck(){
 const deck=$('#gameDeck');if(!deck)return;
 const rows=games.filter(g=>gameFilter==='all'||g.family===gameFilter);
 if(!rows.length){deck.innerHTML='<div class="empty-card">No games in this filter yet.</div>';return}
 deck.innerHTML=rows.map(g=>{const gp=g.game||{},y=gp.yes||{},n=gp.no||{},pool=Number(g.collateral||0);return `<article class="game-card" data-family="${g.family}" data-game-id="${g.id}"><div class="game-card-head"><div><span class="status">${gameTitle(g.family)}</span><span class="game-symbol"> ${g.symbol||''}</span></div><span class="status neutral">${g.status}</span></div><h3>${g.question}</h3><div class="game-pool"><span>Real pool <b>${money(pool)}</b></span><span>${g.trades?.length||0} plays</span></div><div class="game-sides"><button class="game-side yes" data-game-side="YES"><span>YES · stake ${money(gameStake)}</span><b>${Number((g.yesProbability??.5)*100).toFixed(0)}%</b><small>pays ${money(y.payoutIfCorrect||0)} if correct · max loss ${money(y.maxLoss||gameStake)}</small></button><button class="game-side no" data-game-side="NO"><span>NO · stake ${money(gameStake)}</span><b>${Number((1-(g.yesProbability??.5))*100).toFixed(0)}%</b><small>pays ${money(n.payoutIfCorrect||0)} if correct · max loss ${money(n.maxLoss||gameStake)}</small></button></div><button class="game-challenge" data-challenge-game="${g.id}">Challenge someone head-to-head</button><div class="game-rule"><span>Fully collateralized</span><span>House exposure 0</span></div></article>`}).join('');
 deck.querySelectorAll('[data-game-side]').forEach(b=>b.onclick=()=>{const card=b.closest('[data-game-id]');trade(card.dataset.gameId,b.dataset.gameSide,gameStake)});
 deck.querySelectorAll('[data-challenge-game]').forEach(b=>b.onclick=()=>openChallengeCreate(b.dataset.challengeGame));
}
function challengeIdFromInput(value){
 const v=String(value||'').trim();const m=v.match(/duel_[a-f0-9]{16}/i);return m?m[0]:v
}
function challengeLink(id){
 const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('challenge',id);return u.toString()
}
function challengeStatusMarkup(ch,market){
 const pool=Number(market?.collateral||0),yes=Number(market?.yesPool||0),no=Number(market?.noPool||0);
 return `<div class="duel-status-grid"><div><span>STAKE EACH</span><b>${money(ch.stakeUSDC)}</b><small>plus market fee</small></div><div><span>POOL</span><b>${money(pool)}</b><small>YES ${money(yes)} · NO ${money(no)}</small></div><div><span>STATUS</span><b>${String(ch.status||'').replaceAll('_',' ')}</b><small>${ch.opponent?short(ch.opponent):'waiting for opponent'}</small></div></div>`
}
function openChallengeCreate(marketId){
 if(!sessionToken){toast('Connect Phantom first');return}
 const g=games.find(x=>x.id===marketId);if(!g){toast('Game is no longer available');return}
 const box=$('#challengeDialogContent');
 box.innerHTML=`<div class="duel-invite-head"><div><span class="kicker">CREATE HEAD-TO-HEAD</span><h2>${g.symbol} duel</h2><p>${g.question}</p></div><span class="status">INVITE ONLY</span></div><div class="duel-config"><label>Your side<select id="duelCreateSide"><option value="YES">YES</option><option value="NO">NO</option></select></label><label>Stake each (USDC)<input id="duelCreateStake" type="number" min="1" step="1" value="${gameStake}"></label></div><p class="section-copy">Stocklana creates a dedicated two-person market. Your stake is escrowed first; the invite cannot be claimed twice. If nobody joins, you can cancel and the unmatched collateral + fee are returned.</p><button class="primary wide" id="duelCreateConfirm">Lock my side & create invite</button><div id="duelCreateResult"></div>`;
 $('#challengeDialog').showModal();
 $('#duelCreateConfirm').onclick=async()=>{const stake=Number($('#duelCreateStake').value||0),side=$('#duelCreateSide').value;if(stake<=0)return toast('Enter a stake');try{const feeBps=Number(g.feeBps||100);await ensureVaultUSDC(stake*(1+feeBps/10000),'your duel stake');const out=await postJson('/api/challenges',{sourceMarketId:marketId,side,stake,ttl:86400});const link=challengeLink(out.challenge.id);$('#duelCreateResult').innerHTML=`<div class="duel-share"><span class="kicker">INVITE CREATED</span><code>${link}</code><button class="ghost" id="duelCopyInvite">Copy invite</button></div>`;$('#duelCopyInvite').onclick=async()=>{await navigator.clipboard?.writeText(link);toast('Challenge link copied')};toast('Your side is funded and locked');await Promise.all([loadVault(),loadMyChallenges()])}catch(e){toast(String(e.message||e))}}
}
async function openChallengeInvite(rawId){
 const id=challengeIdFromInput(rawId);if(!id)return toast('Paste a challenge code or link');
 const box=$('#challengeDialogContent');box.innerHTML='<div class="empty-card">Reading challenge…</div>';$('#challengeDialog').showModal();
 try{
   const out=await fetch('/api/challenges/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'challenge_not_found');return j});
   const ch=out.challenge,market=out.market,isCreator=wallet?.publicKey&&ch.creator===wallet.publicKey,canAccept=ch.status==='OPEN_FOR_OPPONENT'&&!isCreator;
   const link=challengeLink(ch.id);
   box.innerHTML=`<div class="duel-invite-head"><div><span class="kicker">HEAD-TO-HEAD INVITE</span><h2>${ch.symbol} · ${money(ch.stakeUSDC)} each</h2><p>${ch.question}</p></div><span class="status ${ch.status==='MATCHED'?'live':'neutral'}">${String(ch.status).replaceAll('_',' ')}</span></div>${challengeStatusMarkup(ch,market)}<div class="route"><div class="route-top"><span>You</span><b>${isCreator?ch.creatorSide:(canAccept?ch.opponentSide:'—')}</b></div><p>Creator ${short(ch.creator)} locked <b>${ch.creatorSide}</b>. ${ch.opponent?'Opponent '+short(ch.opponent)+' locked '+ch.opponentSide:'The invite reserves the opposite side for one opponent.'}</p></div><div class="duel-share"><span class="kicker">INVITE</span><code>${link}</code><button class="ghost" id="duelCopyCurrent">Copy invite</button></div><div class="market-actions">${canAccept?'<button class="primary" id="duelAcceptBtn">Accept opposite side</button>':''}${isCreator&&['OPEN_FOR_OPPONENT','EXPIRED'].includes(ch.status)?'<button class="ghost" id="duelCancelBtn">Cancel & refund</button>':''}</div>`;
   $('#duelCopyCurrent').onclick=async()=>{await navigator.clipboard?.writeText(link);toast('Challenge link copied')};
   $('#duelAcceptBtn')?.addEventListener('click',async()=>{if(!sessionToken)return toast('Connect Phantom first');try{const feeBps=Number(market?.feeBps||100);await ensureVaultUSDC(Number(ch.stakeUSDC)*(1+feeBps/10000),'this head-to-head');const joined=await postJson('/api/challenges/'+encodeURIComponent(ch.id)+'/accept',{});toast('Challenge matched — both sides are funded');await Promise.all([loadVault(),loadMyChallenges(),loadGames()]);openChallengeInvite(ch.id)}catch(e){toast(String(e.message||e))}});
   $('#duelCancelBtn')?.addEventListener('click',async()=>{try{await postJson('/api/challenges/'+encodeURIComponent(ch.id)+'/cancel',{});toast('Unmatched stake refunded');await Promise.all([loadVault(),loadMyChallenges()]);$('#challengeDialog').close()}catch(e){toast(String(e.message||e))}});
 }catch(e){box.innerHTML=`<div class="empty-card">Could not open this challenge. ${String(e.message||e)}</div>`}
}
async function loadMyChallenges(){
 const shelf=$('#myChallengeShelf');if(!shelf)return;
 if(!sessionToken){shelf.innerHTML='';return}
 try{const d=await fetch('/api/challenges?mine=1&limit=12',{cache:'no-store'}).then(r=>r.json());shelf.innerHTML=(d.challenges||[]).map(ch=>`<button class="challenge-chip" data-open-challenge="${ch.id}"><b>${ch.symbol} · ${money(ch.stakeUSDC)} · ${ch.creatorSide}</b><small>${String(ch.status).replaceAll('_',' ')} · ${ch.opponent?'vs '+short(ch.opponent):'invite ready'}</small></button>`).join('');shelf.querySelectorAll('[data-open-challenge]').forEach(b=>b.onclick=()=>openChallengeInvite(b.dataset.openChallenge))}catch{shelf.innerHTML=''}
}
async function loadGames(){
 const deck=$('#gameDeck');if(deck)deck.innerHTML='<div class="empty-card">Reading real pools + payoff previews…</div>';
 try{const d=await fetch(`/api/games?stake=${encodeURIComponent(gameStake)}&limit=24`,{cache:'no-store'}).then(r=>r.json());games=d.games||[];renderGameDeck();await loadMyChallenges()}catch(e){if(deck)deck.innerHTML='<div class="empty-card">Game shelf unavailable.</div>'}
}
document.querySelectorAll('[data-game-stake]').forEach(b=>b.addEventListener('click',()=>{gameStake=Number(b.dataset.gameStake||10);document.querySelectorAll('[data-game-stake]').forEach(x=>x.classList.toggle('active',x===b));loadGames()}));
document.querySelectorAll('[data-game-filter]').forEach(b=>b.addEventListener('click',()=>{gameFilter=b.dataset.gameFilter||'all';document.querySelectorAll('[data-game-filter]').forEach(x=>x.classList.toggle('active',x===b));renderGameDeck()}));
document.querySelector('[data-judge-step="connect"]')?.addEventListener('click',async()=>{try{await judgeEnsureWallet();renderJudgeLoop()}catch{}});
$('#judgeCreateMarketBtn')?.addEventListener('click',judgeCreateMarket);
$('#judgeStakeYesBtn')?.addEventListener('click',judgeStakeYes);
$('#judgeResolveBtn')?.addEventListener('click',judgeResolve);
$('#judgeRedeemBtn')?.addEventListener('click',judgeRedeem);
$('#challengeJoinBtn')?.addEventListener('click',()=>openChallengeInvite($('#challengeJoinInput')?.value));
$('#challengeJoinInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')openChallengeInvite(e.currentTarget.value)});
async function loadMarkets(){try{const r=await fetch('/api/markets',{cache:'no-store'});markets=await r.json();renderMarketFeed();renderDesk()}catch(e){console.warn(e)}}
function renderDesk(){const el=$('#portfolioState');if(!markets.length){el.className='empty-card';el.innerHTML='<span>◎</span><h3>No markets yet</h3>';return}const mine=markets.filter(m=>m.creator===trader()||m.trades?.some(t=>t.trader===trader()));el.className='market-board';el.innerHTML=(mine.length?mine:markets.slice(0,8)).map(m=>{const y=Math.round((m.yesProbability??.5)*100);return `<article class="market-card" data-mid="${m.id}"><span class="status-pill">${m.status}</span><h3>${m.question}</h3><div class="prob-row"><div class="prob yes"><small>YES</small><b>${y}¢</b></div><div class="prob no"><small>NO</small><b>${100-y}¢</b></div></div><small>${m.symbol} · ${money(m.volume||0)} volume · ${m.trades?.length||0} trades</small>${m.status==='OPEN'?`<div class="trade-row"><input type="number" min="1" value="10" class="shares"/><button class="primary buy" data-side="YES">Buy YES</button><button class="ghost buy" data-side="NO">Buy NO</button></div>`:`<div class="market-actions"><b>Resolved ${m.outcome}</b><button class="primary redeem">Redeem</button></div>`}</article>`}).join('');el.querySelectorAll('.market-card').forEach(card=>{const mid=card.dataset.mid;card.querySelectorAll('.buy').forEach(b=>b.onclick=()=>trade(mid,b.dataset.side,Number(card.querySelector('.shares').value)));card.querySelector('.redeem')?.addEventListener('click',()=>redeem(mid))})}
async function redeem(mid){const r=await fetch(`/api/markets/${mid}/redeem`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader()})}),j=await r.json();if(!r.ok)return toast(j.error||'Redeem failed');toast(`Redeemed ${money(j.payout)} to vault`);await loadVault()}
async function loadVault(){if(trader()==='guest'){$('#vaultBalance').textContent='$0.00';$('#vaultIdentity').textContent='Connect a wallet to activate your vault';return}try{const [a,p,r]=await Promise.all([fetch(`/api/vault?trader=${encodeURIComponent(trader())}`).then(x=>x.json()),fetch(`/api/positions?trader=${encodeURIComponent(trader())}`).then(x=>x.json()),fetch('/api/receipts?limit=20').then(x=>x.json())]);vault=a;positions=p;$('#vaultBalance').textContent=money(a.balances?.USDC||0);$('#vaultIdentity').textContent=short(trader());$('#cashPocket').textContent=money(a.subaccounts?.CASH?.USDC||0);$('#tradingPocket').textContent=money(a.subaccounts?.TRADING?.USDC||0);$('#reservePocket').textContent=money(a.subaccounts?.RESERVE?.USDC||0);$('#vaultPositions').innerHTML=p.length?p.map(x=>`<div class="position-row" data-mid="${x.marketId}"><h4>${x.symbol||''} · ${x.status||''}</h4><small>${x.question||x.marketId}</small><div>YES <b>${Number(x.yes||0).toFixed(2)}</b> · NO <b>${Number(x.no||0).toFixed(2)}</b></div><button class="mini send-pos">Send position</button></div>`).join(''):'<div class="position-row"><small>No positions yet.</small></div>';$$('.send-pos').forEach(b=>b.onclick=()=>sendPosition(b.closest('[data-mid]').dataset.mid));$('#receiptList').innerHTML=(r.receipts||[]).slice(0,12).map(x=>`<div class="receipt-row"><b>${x.kind.replaceAll('_',' ')}</b><small>${new Date(x.at).toLocaleString()}</small><code>${x.commitment?`${x.commitment.slice(0,12)}…`:''}</code></div>`).join('')||'<div class="receipt-row"><small>No receipts yet.</small></div>'}catch(e){toast('Vault unavailable')}}
async function sendPosition(mid){const p=positions.find(x=>x.marketId===mid);if(!p)return;const max=Math.max(Number(p.yes||0),Number(p.no||0));const v=await actionSheet({kicker:'SEND POSITION',title:'Send a game position',copy:'Choose a side, amount, and recipient. Position ownership changes without moving the underlying collateral.',confirmLabel:'Send position',fields:[{name:'side',label:'Side',type:'select',options:['YES','NO']},{name:'shares',label:'Shares',type:'number',value:String(Math.min(1,max||1)),min:.000001,step:.000001},{name:'recipient',label:'Recipient',placeholder:'Stocklana identity or Solana address'}]});const side=String(v?.side||'').toUpperCase(),shares=Number(v?.shares||0),recipient=String(v?.recipient||'').trim();if(!recipient||shares<=0||!['YES','NO'].includes(side))return;const sideMax=side==='YES'?Number(p.yes||0):Number(p.no||0);if(shares>sideMax)return toast(`You only have ${sideMax} ${side} shares`);const r=await fetch(`/api/markets/${mid}/transfer-position`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader(),recipient,side,shares})}),j=await r.json();if(!r.ok)return toast(j.error||'Transfer failed');toast('Position transferred');loadVault()}
$('#withdrawBtn').onclick=async()=>{if(trader()==='guest')return toast('Connect wallet first');const v=await actionSheet({kicker:'WITHDRAW',title:'Move USDC back to Solana',copy:'Choose the receiving wallet and amount.',confirmLabel:'Create withdrawal',fields:[{name:'destination',label:'Solana wallet',value:trader()},{name:'amount',label:'USDC amount',type:'number',value:'25',min:.01,step:.01}]});const destination=String(v?.destination||'').trim(),amount=Number(v?.amount||0);if(!destination||amount<=0)return;const r=await fetch('/api/vault/withdraw',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader(),destination,amount,asset:'USDC'})}),j=await r.json();if(!r.ok)return toast(j.error||'Withdrawal request failed');toast(`Withdrawal reserved · ${j.withdrawal.id.slice(0,10)}…`);await loadVault()};
$('#sendMoneyBtn').onclick=async()=>{if(trader()==='guest')return toast('Connect wallet first');const v=await actionSheet({kicker:'SEND',title:'Send USDC',copy:'Send inside Stocklana using an identity or wallet address.',confirmLabel:'Send money',fields:[{name:'recipient',label:'Recipient',placeholder:'@handle or wallet address'},{name:'amount',label:'USDC amount',type:'number',value:'10',min:.01,step:.01}]});const recipient=String(v?.recipient||'').trim(),amount=Number(v?.amount||0);if(!recipient||amount<=0)return;const r=await fetch('/api/vault/transfer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader(),recipient,amount,asset:'USDC'})}),j=await r.json();if(!r.ok)return toast(j.error||'Transfer failed');toast('Internal transfer settled');loadVault()};
async function movePocket(destination){if(trader()==='guest')return toast('Connect wallet first');const v=await actionSheet({kicker:'MOVE MONEY',title:`Move USDC to ${destination.toLowerCase()}`,copy:'This changes which Stocklana pocket can use the money.',confirmLabel:'Move money',fields:[{name:'amount',label:'USDC amount',type:'number',value:'25',min:.01,step:.01}]});const source='CASH',amount=Number(v?.amount||0);if(amount<=0)return;const r=await fetch('/api/vault/move',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader(),source,destination,amount,asset:'USDC'})}),j=await r.json();if(!r.ok)return toast(j.error||'Pocket move failed');toast(`Moved ${money(amount)} to ${destination}`);loadVault()}
$('#moveTradingBtn').onclick=()=>movePocket('TRADING');$('#moveReserveBtn').onclick=()=>movePocket('RESERVE');
$('#fundCardBtn').onclick=async()=>{if(trader()==='guest')return toast('Connect wallet first');const v=await actionSheet({kicker:'ADD MONEY',title:'Add money with a provider',copy:'Stocklana opens the configured on-ramp after you choose an amount.',confirmLabel:'Continue',fields:[{name:'amount',label:'USD amount',type:'number',value:'100',min:1,step:1}]});const amount=Number(v?.amount||0);if(amount<=0)return;const providers=await fetch('/api/funding/providers').then(x=>x.json()),provider=providers.providers.find(x=>x.ready&&['stripe','coinbase'].includes(x.id));if(!provider)return toast('Card onramp adapter needs provider URL configuration');const r=await fetch('/api/funding/onramp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader(),provider:provider.id,amount})}),j=await r.json();if(j.url)window.open(j.url,'_blank');else toast(j.reason||'Onramp unavailable')};
$('#fundWalletBtn').onclick=async()=>{if(!wallet?.provider)return toast('Connect wallet first');if(!config.vaultAddress)return toast('Stocklana Solana vault is not configured yet');const v=await actionSheet({kicker:'PHANTOM → STOCKLANA',title:'Move USDC into Stocklana',copy:'Phantom will show the exact token transfer before you sign.',confirmLabel:'Open Phantom',fields:[{name:'amount',label:'USDC amount',type:'number',value:'25',min:.01,step:.01}]});const amount=Number(v?.amount||0);if(amount<=0)return;try{toast('Approve USDC transfer in wallet');const signature=await sendSplToken({provider:wallet.provider,to:config.vaultAddress,mint:config.usdcMint,amount});const r=await fetch('/api/vault/confirm-deposit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trader:trader(),wallet:trader(),amount,signature})}),j=await r.json();if(!r.ok)throw new Error(j.error||'verification_failed');toast(`Verified ${money(j.chainProof.verifiedAmount)} deposit`);loadVault()}catch(e){toast(String(e.message||e))}};
$$('[data-launch]').forEach(b=>b.onclick=()=>{const kind=b.dataset.launch;$('#launchDialogContent').innerHTML=kind==='sponsored'?'<span class="kicker">SPONSORED ROUTER</span><h2>Search free rails first</h2><p>Sponsored venues are checked before user-paid launch routes.</p>':kind==='native'?'<span class="kicker">STOCKLANA NATIVE</span><h2>Native launch path</h2><p>Service fee: <b>0.005 ETH</b>. Network and pool costs remain separate.</p>':'<span class="kicker">OPTIONAL ADAPTER</span><h2>Clawpump compatibility</h2><p>Kept outside the core market and vault architecture.</p>';$('#launchDialog').showModal()});
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
async function connectPrimaryWallet(){try{wallet=await connectSolanaWallet();await authenticateWallet(wallet);$('#walletBtn').textContent='My money';$('#walletBtn').classList.add('connected');toast('Phantom connected');await Promise.all([loadVault(),loadWalletCenter(),loadV2Home()]);renderJudgeLoop();return wallet}catch(e){toast(e.message==='solana_wallet_not_found'?'Install or open Phantom to connect':'Could not connect Phantom');throw e}}
$('#walletBtn').onclick=async()=>{if(wallet?.publicKey){navigate('wallet');return}try{await connectPrimaryWallet();navigate('wallet')}catch{}};
$('#refreshBtn').onclick=loadLive;async function loadLive(){try{const r=await fetch('/api/prestocks',{cache:'no-store'}),j=await r.json();if(Array.isArray(j)&&j.length){assets=j.map((x,i)=>({...fallback.find(f=>f.symbol===x.symbol),...x}));renderAssets();toast('Live PreStocks refreshed')}}catch{toast('Using PreStocks snapshot')}}
async function scheduleRecurring(a){if(!sessionToken)return toast('Connect Phantom first');const v=await actionSheet({kicker:'AUTOMATE',title:`Auto-buy ${a.symbol}`,copy:'Choose how much USDC Stocklana should allocate and how often.',confirmLabel:'Create plan',fields:[{name:'amount',label:'USDC each buy',type:'number',value:'25',min:.01,step:.01},{name:'cadence',label:'Cadence',type:'select',options:[{value:'DAILY',label:'Daily'},{value:'WEEKLY',label:'Weekly'},{value:'MONTHLY',label:'Monthly'}]}]});const amount=Number(v?.amount||0),cadence=String(v?.cadence||'WEEKLY').toUpperCase();if(amount<=0)return;const r=await fetch('/api/equity/recurring',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({symbol:a.symbol,usdcAmount:amount,cadence})}),j=await r.json();toast(r.ok?`${cadence} ${a.symbol} plan created`:(j.error||'Plan failed'))}
async function shareSignal(a){if(!sessionToken)return toast('Connect Phantom first');const v=await actionSheet({kicker:'SHARE',title:`Your ${a.symbol} thesis`,copy:'Create a copyable idea tied to this exact PreStock mint.',confirmLabel:'Publish thesis',fields:[{name:'thesis',label:'Thesis',type:'text',placeholder:'What do you think happens next?'}]});const thesis=String(v?.thesis||'').trim();if(!thesis)return;const r=await fetch('/api/equity/social',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({symbol:a.symbol,thesis,visibility:'FRIENDS'})}),j=await r.json();toast(r.ok?'Copyable equity thesis created':(j.error||'Signal failed'))}
async function buyUnderlying(a){if(!sessionToken||!wallet?.provider)return toast('Connect Phantom first');const v=await actionSheet({kicker:'BUY PRESTOCK',title:`Buy ${a.name.replace(' PreStocks','')}`,copy:`${a.symbol} · ${money(a.tokenPrice)}. Phantom will show the exact Jupiter transaction before you sign.`,confirmLabel:'Build order',fields:[{name:'usdc',label:'Spend in USDC',type:'number',value:'25',min:.01,step:.01}]});const usdc=Number(v?.usdc||0);if(usdc<=0)return;try{toast('Building Jupiter order');const r=await fetch('/api/prestocks/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mint:a.contract_address,side:'BUY',usdcAmount:usdc})}),o=await r.json();if(!r.ok)throw new Error(o.error||'order_failed');if(!o.ready)return toast(o.reason||'Jupiter connector not configured');toast('Approve the PreStocks swap');const signedTransaction=await signSerializedTransaction({provider:wallet.provider,transactionBase64:o.transaction});const er=await fetch('/api/prestocks/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signedTransaction,requestId:o.requestId})}),ej=await er.json();if(!er.ok)throw new Error(ej.error||'execution_failed');toast(`Underlying executed · ${short(ej.signature||ej.txid||ej.status)}`);$('#assetDialog').close()}catch(e){toast(String(e.message||e))}}
let activeAgentId=null,lastAgentCapability=null;
async function loadMyAgents(){
 const g=$('#myAgentGrid');if(!g)return;
 if(!sessionToken){g.innerHTML='<div class="empty-card">Connect Phantom to load your owner-linked agents.</div>';return}
 try{
   const d=await fetch('/api/agent-vaults/mine',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'agents_failed');return j});
   g.innerHTML=(d.vaults||[]).length?d.vaults.map(v=>{const p=v.policy||{};return `<article class="my-agent-card" data-my-agent="${v.agentId}"><span class="status ${p.allowExternalCommerce?'live':'neutral'}">${p.allowExternalCommerce?'COMMERCE ON':'COMMERCE OFF'}</span><h3>${v.name}</h3><small>${v.agentId}</small><div class="merchant-list">${(p.allowedMerchants||[]).map(x=>`<span>${x}</span>`).join('')||'<span>no merchants yet</span>'}</div><small>Daily ${money(p.dailySpendLimitUSDC)} · each ${money(p.singleSpendLimitUSDC)} · ask above ${money(p.humanApprovalAboveUSDC)}</small><div class="my-agent-actions"><button data-agent-select="${v.agentId}">Select</button><button data-agent-shop="${v.agentId}">Shop</button></div></article>`}).join(''):'<div class="empty-card">No owner-linked agents yet. Create one above.</div>';
   g.querySelectorAll('[data-agent-select]').forEach(b=>b.onclick=()=>{activeAgentId=b.dataset.agentSelect;$('#agentCreateId').value=activeAgentId;$('#agentCapabilityBtn').disabled=false;$('#agentUseShopBtn').disabled=false;toast(`Selected ${activeAgentId}`)});
   g.querySelectorAll('[data-agent-shop]').forEach(b=>b.onclick=()=>{activeAgentId=b.dataset.agentShop;const input=$('#commerceAgent');if(input)input.value=activeAgentId;const f=$('#commerceFunding');if(f)f.value='STOCKLANA_USDC';navigate('commerce')});
 }catch(e){g.innerHTML='<div class="empty-card">Could not load your Agent Vaults.</div>'}
}
async function loadAgents(){const g=$('#agentGrid');if(!g)return;try{const d=await fetch('/api/agent-vaults').then(r=>r.json());g.innerHTML=d.vaults.slice(0,100).map(v=>`<article class="asset-card"><div class="asset-head"><span class="status live">${v.status}</span><span class="sym">${v.crypto}</span></div><h3>${v.name}</h3><small>${v.agentId}</small><div class="market-chips">${v.connectors.map(x=>`<span>${x}</span>`).join('')}</div><div class="valuation">Daily ${money(v.policy.dailySpendLimitUSDC)} · human gate ${money(v.policy.humanApprovalAboveUSDC)}</div><small>${Object.values(v.financialTokens||{}).flat?.().filter?.(x=>typeof x==='string').slice(0,5).join(' · ')||'SL-AGENT · SL-CASH · SL-POS'}</small></article>`).join('');$('#agentWeekMetrics').innerHTML=`<div><b>${d.count}</b><span>Agent Vaults</span></div><div><b>700</b><span>Week sessions</span></div><div><b>100%</b><span>Scoped identities</span></div>`;await loadMyAgents()}catch(e){g.innerHTML='<div class="empty-card">Agent proof unavailable</div>';await loadMyAgents()}}
async function createShoppingAgent(){
 if(!sessionToken){toast('Connect Phantom first');return}
 const agentId=$('#agentCreateId')?.value?.trim(),name=$('#agentCreateName')?.value?.trim()||agentId;
 const daily=Number($('#agentDailyLimit')?.value||0),single=Number($('#agentSingleLimit')?.value||0),approval=Number($('#agentApprovalLimit')?.value||0);
 const merchants=($('#agentMerchants')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),allowSubscriptions=!!$('#agentSubscriptions')?.checked;
 if(!agentId||daily<=0||single<=0){toast('Add an agent ID and spend limits');return}
 try{
   await postJson('/api/agent-vaults',{agentId,name});
   await postJson('/api/agent-vaults/policy',{agentId,dailySpendLimitUSDC:daily,singleSpendLimitUSDC:single,humanApprovalAboveUSDC:approval,allowedMerchants:merchants,allowSubscriptions,allowExternalCommerce:true});
   activeAgentId=agentId;$('#agentCapabilityBtn').disabled=false;$('#agentUseShopBtn').disabled=false;toast('Shopping agent policy is live');await Promise.all([loadMyAgents(),loadAgents()])
 }catch(e){toast(String(e.message||e))}
}
async function issueAgentCapability(){
 const agentId=activeAgentId||$('#agentCreateId')?.value?.trim();if(!agentId){toast('Select an agent first');return}
 try{
   const cap=await postJson('/api/auth/agent',{agentId,scopes:['vault:read','commerce:purchase']});lastAgentCapability=cap.token;
   const box=$('#agentCapabilityResult');if(box)box.innerHTML=`<code>${cap.token}</code><small>Shown once. Give this token only to the agent runtime that should shop under this policy. It cannot change the policy or access your Phantom key.</small><button class="ghost" id="copyAgentCapability">Copy capability</button>`;
   $('#copyAgentCapability')?.addEventListener('click',async()=>{await navigator.clipboard?.writeText(lastAgentCapability);toast('Capability copied')});
 }catch(e){toast(String(e.message||e))}
}
$('#agentCreateBtn')?.addEventListener('click',createShoppingAgent);
$('#agentCapabilityBtn')?.addEventListener('click',issueAgentCapability);
$('#agentUseShopBtn')?.addEventListener('click',()=>{const id=activeAgentId||$('#agentCreateId')?.value?.trim();if(!id)return toast('Select an agent first');const a=$('#commerceAgent');if(a)a.value=id;const f=$('#commerceFunding');if(f)f.value='STOCKLANA_USDC';navigate('commerce')});
document.querySelectorAll('[data-nav="agents"]').forEach(b=>b.addEventListener('click',()=>{loadAgents();loadMyAgents()}));$('#agentRefresh')?.addEventListener('click',()=>{loadAgents();loadMyAgents()});
let lastCardPolicy=null;
$('#singleUseCardBtn')?.addEventListener('click',async()=>{if(!sessionToken)return toast('Connect Phantom first');const v=await actionSheet({kicker:'ONE-TIME CARD',title:'Create a single-purchase spending rule',copy:'Lock a maximum amount and optionally restrict the merchant or MCC.',confirmLabel:'Reserve money',fields:[{name:'amount',label:'Maximum USDC',type:'number',value:'25',min:.01,step:.01},{name:'merchant',label:'Merchant (optional)',placeholder:'merchant.com'},{name:'mcc',label:'MCC (optional)',placeholder:'e.g. 5732'}]});const amount=Number(v?.amount||0),merchant=String(v?.merchant||'').trim()||null,mcc=String(v?.mcc||'').trim()||null;if(amount<=0)return;const r=await fetch('/api/card/policy',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount,merchant,mcc,ttl:900})}),j=await r.json();if(!r.ok)return toast(j.error||'Policy failed');lastCardPolicy=j.id;toast(`Reserved ${money(j.maxAmountUSDC)} for one purchase`) });
$('#issueVirtualCardBtn')?.addEventListener('click',async()=>{if(!lastCardPolicy)return toast('Create a one-time spend policy first');const r=await fetch('/api/card/issue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({policyId:lastCardPolicy})}),j=await r.json();if(!r.ok)return toast(j.error||'Issuance failed');toast(j.ready?'Provider virtual card issued':'Issuer credentials are not configured on this deployment')});
$('#maqueSendBtn')?.addEventListener('click',async()=>{if(!sessionToken)return toast('Connect Phantom first');const v=await actionSheet({kicker:'SEND',title:'Pay someone',copy:'Use a @handle or Stocklana identity.',confirmLabel:'Send payment',fields:[{name:'to',label:'Recipient',value:'@friend'},{name:'amount',label:'USDC amount',type:'number',value:'10',min:.01,step:.01}]});const to=String(v?.to||'').trim(),amount=Number(v?.amount||0);if(!to||amount<=0)return;const r=await fetch('/api/pay/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({to,amount,asset:'USDC',memo:'MAQUE payment'})}),j=await r.json();toast(r.ok?'MAQUE payment settled':(j.error||'Payment failed'));if(r.ok)loadVault()});
$('#maqueRequestBtn')?.addEventListener('click',async()=>{if(!sessionToken)return toast('Connect Phantom first');const v=await actionSheet({kicker:'REQUEST',title:'Request USDC',copy:'Stocklana creates a shareable payment request.',confirmLabel:'Create request',fields:[{name:'amount',label:'USDC amount',type:'number',value:'10',min:.01,step:.01}]});const amount=Number(v?.amount||0);if(amount<=0)return;const r=await fetch('/api/pay/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payee:trader(),amount,asset:'USDC',memo:'Stocklana request'})}),j=await r.json();if(!r.ok)return toast(j.error||'Request failed');navigator.clipboard?.writeText(j.transport.qr);toast('Payment request copied')});
$('#maqueCashoutBtn')?.addEventListener('click',async()=>{if(!sessionToken)return toast('Connect Phantom first');const v=await actionSheet({kicker:'MOVE OUT',title:'Choose where your money goes',copy:'The connected provider completes bank or card settlement; Solana routes stay wallet-addressed.',confirmLabel:'Create cash-out',fields:[{name:'amount',label:'USDC value',type:'number',value:'25',min:.01,step:.01},{name:'destinationType',label:'Destination',type:'select',options:[{value:'debit_card',label:'Debit card'},{value:'bank',label:'Bank'},{value:'solana',label:'Solana wallet'}]},{name:'destinationRef',label:'Destination reference',placeholder:'Provider token or wallet address'}]});const amount=Number(v?.amount||0),destinationType=String(v?.destinationType||'debit_card'),destinationRef=String(v?.destinationRef||'').trim();if(amount<=0)return;const r=await fetch('/api/pay/cashout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount,destinationType,destinationRef})}),j=await r.json();toast(r.ok?`Cash-out intent ${j.id} authorized`:(j.error||'Cash-out failed'))});


async function loadWalletCenter(){
  const info=detectSolanaWalletProvider();
  const label=$('#walletProviderLabel'),addr=$('#walletAddressFull'),state=$('#walletSessionState');
  if(label)label.textContent=info.name+(info.available?' · detected':'');
  if(!wallet?.publicKey){
    if(addr)addr.textContent='Not connected';
    if(state)state.textContent=info.available?'Phantom detected. Connect to bring the wallet into Stocklana.':'Phantom is not detected in this browser.';
    ['#walletSolBalance','#walletUsdcBalance','#walletPrestockCount','#walletVaultBalance'].forEach(id=>{const e=$(id);if(e)e.textContent='—'});
    const h=$('#walletPrestockHoldings');if(h)h.innerHTML='<div class="empty-card">Connect Phantom to read holdings.</div>';
    return;
  }
  if(addr)addr.textContent=wallet.publicKey;
  if(state)state.textContent=sessionToken?'Authenticated · wallet signatures stay local':'Connected · authentication pending';
  try{
    const [portfolio,v]=await Promise.all([
      readWalletPortfolio({owner:wallet.publicKey,rpc:config.rpcUrl||'https://api.mainnet-beta.solana.com',usdcMint:config.usdcMint,prestocks:assets}),
      sessionToken?fetch('/api/vault?trader='+encodeURIComponent(trader())).then(r=>r.json()).catch(()=>null):Promise.resolve(null)
    ]);
    lastWalletPortfolio=portfolio;refreshCommercePrestocks();refreshSwapTargets();
    $('#walletSolBalance').textContent=Number(portfolio.sol).toLocaleString(undefined,{maximumFractionDigits:4});if($('#homeSolBalance'))$('#homeSolBalance').textContent=Number(portfolio.sol).toLocaleString(undefined,{maximumFractionDigits:3})+' SOL';if($('#homeWalletLabel'))$('#homeWalletLabel').textContent='My money';
    $('#walletUsdcBalance').textContent=money(portfolio.usdc);
    $('#walletPrestockCount').textContent=String(portfolio.prestocks.length);
    $('#walletVaultBalance').textContent=money(v?.balances?.USDC||0);
    const h=$('#walletPrestockHoldings');
    if(h)h.innerHTML=portfolio.prestocks.length?portfolio.prestocks.map(x=>`<article class="wallet-holding"><img src="${x.image||''}" alt=""><div><b>${x.name.replace(' PreStocks','')}</b><small>${x.symbol} · ${x.amount.toLocaleString(undefined,{maximumFractionDigits:6})} tokens</small><div class="wallet-holding-actions"><button data-wallet-asset="${x.symbol}">Use</button><button data-wallet-spend="${x.symbol}">Spend</button><button data-wallet-play="${x.symbol}">Play</button></div></div><strong>${money(x.estimatedValueUSDC)}</strong></article>`).join(''):'<div class="empty-card">No eligible PreStocks found in this wallet yet.</div>';
    document.querySelectorAll('[data-wallet-asset]').forEach(b=>b.onclick=()=>openAsset(b.dataset.walletAsset));
    document.querySelectorAll('[data-wallet-spend]').forEach(b=>b.onclick=()=>startSpendFromPrestock(b.dataset.walletSpend));
    document.querySelectorAll('[data-wallet-play]').forEach(b=>b.onclick=()=>{selected=b.dataset.walletPlay;navigate('play')});
    refreshCommercePrestocks();
  }catch(e){
    if(state)state.textContent='Connected · wallet balances temporarily unavailable';
    const h=$('#walletPrestockHoldings');if(h)h.innerHTML='<div class="empty-card">Could not read Solana token accounts. Your wallet remains connected.</div>';
  }
}
function refreshCommercePrestocks(){
 const sel=$('#commercePrestock');if(!sel)return;
 const cur=sel.value;
 const hs=lastWalletPortfolio?.prestocks||[];
 sel.innerHTML='<option value="">Choose a holding</option>'+hs.map(h=>`<option value="${h.symbol}">${h.symbol} · ${money(h.estimatedValueUSDC)}</option>`).join('');
 if([...sel.options].some(o=>o.value===cur))sel.value=cur;
}
function startSpendFromPrestock(symbol){
 navigate('commerce');setTimeout(()=>{const f=$('#commerceFunding'),p=$('#commercePrestock');if(f)f.value='PRESTOCK_TO_USDC';refreshCommercePrestocks();if(p)p.value=symbol;loadFundingPlan();$('#commerceUrl')?.focus()},60)
}
async function loadFundingPlan(){
 const box=$('#commerceFundingPlan');if(!box)return;
 if(!sessionToken||!wallet?.publicKey||!lastWalletPortfolio){box.innerHTML='<small>Connect Phantom and enter an amount to see ways to pay.</small>';return}
 const amount=Number($('#commerceAmount')?.value||0);if(amount<=0){box.innerHTML='<small>Enter how much you want to spend.</small>';return}
 try{
   const r=await fetch('/api/money/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount,walletUSDC:lastWalletPortfolio.usdc||0,vaultUSDC:Number(vault?.balances?.USDC||0),solBalance:lastWalletPortfolio.sol||0,prestocks:lastWalletPortfolio.prestocks||[]})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'plan_failed');
   if(!selectedFundingRoute||!(d.routes||[]).some(x=>x.id===selectedFundingRoute))selectedFundingRoute=d.defaultRoute;
   box.innerHTML=(d.routes||[]).slice(0,7).map((x,i)=>{const title=({WALLET_USDC:'Use USDC in Phantom',STOCKLANA_USDC:'Use money in Stocklana',SPLIT_USDC:'Use both balances',SOL_TO_USDC:'Use SOL',PRESTOCK_TO_USDC:`Use ${x.symbol||'a PreStock'}`})[x.id]||x.label;const detail=x.id==='SPLIT_USDC'?`${money(x.walletUSDC)} from Phantom + ${money(x.vaultUSDC)} from Stocklana`:x.id==='PRESTOCK_TO_USDC'?`About ${Number(x.estimatedTokensToSell||0).toLocaleString(undefined,{maximumFractionDigits:6})} ${x.symbol} would be sold`:x.ready?'No conversion needed':'You will approve a conversion first';return `<button class="funding-route ${selectedFundingRoute===x.id?'selected':''}" data-funding-route="${x.id}" data-funding-symbol="${x.symbol||''}"><span class="route-rank">${i+1}</span><span><strong>${title}</strong><small>${detail}</small></span><em>${x.ready?'USE':'SELECT'}</em></button>`}).join('')||'<small>You do not have enough available money for this amount yet.</small>';
   box.querySelectorAll('[data-funding-route]').forEach(b=>b.onclick=()=>{selectedFundingRoute=b.dataset.fundingRoute;$('#commerceFunding').value=selectedFundingRoute;if(b.dataset.fundingSymbol){refreshCommercePrestocks();$('#commercePrestock').value=b.dataset.fundingSymbol}loadFundingPlan()});
 }catch(e){box.innerHTML='<small>Could not check your payment options.</small>'}
}
async function executeWalletSwap(){
 if(!wallet?.provider||!sessionToken){toast('Connect Phantom first');return}
 const from=$('#swapFrom')?.value||'SOL', target=$('#swapTo')?.value||'USDC', amount=Number($('#swapAmount')?.value||0);
 if(amount<=0){toast('Enter an amount to convert');return}
 const SOL='So11111111111111111111111111111111111111112';
 const inputMint=from==='SOL'?SOL:from==='USDC'?config.usdcMint:from;
 const outputMint=target==='SOL'?SOL:target==='USDC'?config.usdcMint:target;
 if(inputMint===outputMint){toast('Choose two different assets');return}
 const held=(lastWalletPortfolio?.prestocks||[]).find(h=>h.mint===inputMint);
 const decimals=from==='SOL'?9:from==='USDC'?6:Number(held?.decimals??6);
 if(held&&amount>Number(held.amount||0)+1e-12){toast('Amount exceeds this PreStock balance');return}
 const amountAtomic=Math.max(1,Math.floor(amount*10**decimals));
 try{
   toast('Building the best Solana route');
   const o=await postJson('/api/swap/order',{inputMint,outputMint,amountAtomic});
   if(!o.ready)throw new Error(o.reason||'Jupiter connector not configured');
   toast('Approve the conversion in Phantom');
   const signedTransaction=await signSerializedTransaction({provider:wallet.provider,transactionBase64:o.transaction});
   const ej=await postJson('/api/swap/execute',{signedTransaction,requestId:o.requestId});
   toast(`Converted on Solana · ${short(ej.signature||ej.txid||ej.status)}`);
   await loadWalletCenter();
 }catch(e){toast(String(e.message||e))}
}
function commerceStateLabel(x){
 const s=String(x?.status||'UNKNOWN');
 return ({AWAITING_FUNDS:'Waiting for payment',READY_TO_RESERVE:'Ready to fund',FUNDED:'Money received',PURCHASE_READY:'Ready to use',POLICY_RESERVED_PROVIDER_REQUIRED:'Payment setup waiting',PURCHASED:'Purchased',CANCELLED:'Cancelled'})[s]||s.replaceAll('_',' ').toLowerCase()
}
async function openMerchantIntent(intentId,url){
 try{await postJson('/api/commerce/open',{intentId})}catch{}
 window.open(url,'_blank','noopener')
}
async function cancelCommerceIntent(intentId){
 try{const out=await postJson('/api/commerce/cancel',{intentId,reason:'USER_CANCELLED'});toast(`Purchase cancelled · funds released`);await Promise.all([loadCommerce(),loadVault(),loadFundingPlan()]);return out}catch(e){toast(String(e.message||e))}
}
function bindCommerceActions(root=document){
 root.querySelectorAll?.('[data-commerce-open]').forEach(b=>b.onclick=()=>openMerchantIntent(b.dataset.commerceOpen,b.dataset.merchantUrl));
 root.querySelectorAll?.('[data-commerce-cancel]').forEach(b=>b.onclick=()=>cancelCommerceIntent(b.dataset.commerceCancel));
}
async function loadCommerce(){
 const h=$('#commerceHistory');if(!h)return;
 if(!sessionToken){h.innerHTML='<div class="empty-card">Connect Phantom to create wallet-backed purchases.</div>';return}
 try{
   const d=await fetch('/api/commerce/intents',{cache:'no-store'}).then(r=>r.json());
   h.innerHTML=(d.intents||[]).length?(d.intents||[]).slice(0,12).map(x=>{const cancellable=!['PURCHASED','CANCELLED'].includes(x.status);return `<div class="commerce-row"><div class="commerce-row-main"><b>${x.merchant||x.merchantHost} · ${money(x.maxAmountUSDC)}</b><small>${commerceStateLabel(x)} · ${x.agentId?'AI '+x.agentId:'You'} · ${x.sourceAsset||'USDC'} → ${x.fundingSource}</small>${x.capturedUSDC?'<small>Paid '+money(x.capturedUSDC)+' · confirmed</small>':''}</div><div class="commerce-row-actions"><button data-commerce-open="${x.id}" data-merchant-url="${x.merchantUrl}">Open store</button>${cancellable?`<button data-commerce-cancel="${x.id}">Cancel</button>`:''}</div></div>`}).join(''):'<div class="empty-card">No purchase intents yet.</div>';
   bindCommerceActions(h);
 }catch{h.innerHTML='<div class="empty-card">Commerce history unavailable.</div>'}
}
function renderCommerceResult(out){
 const el=$('#commerceResult');if(!el)return;
 const intent=out.intent||out, issuance=out.issuance||{};
 if(out.requiresWalletTransfer){el.innerHTML=`<div class="commerce-warning"><b>Approve payment</b><p>Approve ${money(intent.maxAmountUSDC)} USDC from Phantom. You will see the USDC transfer in Phantom before approving it.</p><button class="ghost" data-commerce-cancel="${intent.id}">Cancel</button></div>`;bindCommerceActions(el);return}
 const ready=!!issuance.ready;
 const state=intent.status==='PURCHASED'?'Purchased':intent.status==='CANCELLED'?'Cancelled':ready?'Payment ready':'Money reserved';
 el.innerHTML=`<div class="${intent.status==='PURCHASED'||ready?'commerce-success':'commerce-warning'}"><b>${state}</b><p>${intent.status==='PURCHASED'?'The issuer confirmed capture and Stocklana settled the reserved funds into card clearing.':ready?'Your one-time payment is ready for this store.':'Your money is reserved. This deployment still needs the connected card provider before a normal card checkout can finish.'}</p>${ready&&issuance.hostedRevealUrl?`<a class="primary" href="${issuance.hostedRevealUrl}" target="_blank" rel="noopener">Open payment card</a>`:''} ${ready&&issuance.walletPassUrl?`<a class="ghost" href="${issuance.walletPassUrl}" target="_blank" rel="noopener">Add card to wallet</a>`:''} ${!['PURCHASED','CANCELLED'].includes(intent.status)?`<button class="ghost" data-commerce-open="${intent.id}" data-merchant-url="${intent.merchantUrl}">Open store</button><button class="ghost" data-commerce-cancel="${intent.id}">Cancel and return money</button>`:''}</div>`;
 bindCommerceActions(el);
}
async function postJson(path,payload){
 const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload||{})});
 const j=await r.json();if(!r.ok)throw new Error(j.error||j.detail||'request_failed');return j;
}
async function ensureVaultUSDC(required,label='this action'){
 if(!wallet?.provider||!sessionToken)throw new Error('wallet_not_connected');
 await loadVault();
 const have=Number(vault?.balances?.USDC||0),need=Math.max(0,Number(required)-have);
 if(need<=1e-9)return {deposited:0,available:have};
 if(!config.vaultAddress)throw new Error('stocklana_vault_not_configured');
 await loadWalletCenter();
 if(Number(lastWalletPortfolio?.usdc||0)+1e-9<need)throw new Error('not_enough_usdc_in_wallet_or_stocklana');
 toast(`Approve ${money(need)} USDC from Phantom for ${label}`);
 const signature=await sendSplToken({provider:wallet.provider,to:config.vaultAddress,mint:config.usdcMint,amount:need,decimals:6,rpc:config.rpcUrl});
 await postJson('/api/vault/confirm-deposit',{signature,amount:need,wallet:wallet.publicKey});
 await Promise.all([loadVault(),loadWalletCenter()]);
 return {deposited:need,available:Number(vault?.balances?.USDC||0),signature}
}
async function createCommerceIntent({merchantUrl,amount,fundingSource,agentId,sourceAsset,note}){
 return await postJson('/api/commerce/intents',{merchantUrl,amount,fundingSource,agentId,sourceAsset,allowSubscriptions:false,approvalAbove:amount,note:note||'Stocklana web purchase'})
}
async function fundCommerceFromWallet(intentId,amount){
 if(!config.vaultAddress)throw new Error('stocklana_vault_not_configured');
 if(Number(lastWalletPortfolio?.usdc||0)+1e-9<amount)throw new Error('wallet_usdc_below_purchase_amount');
 toast(`Approve ${money(amount)} USDC in Phantom`);
 const signature=await sendSplToken({provider:wallet.provider,to:config.vaultAddress,mint:config.usdcMint,amount,decimals:6,rpc:config.rpcUrl});
 return await postJson('/api/commerce/fund-wallet',{intentId,signature,wallet:wallet.publicKey})
}
async function convertPrestockForPurchase(intentId,symbol,amount){
 const h=(lastWalletPortfolio?.prestocks||[]).find(x=>x.symbol===symbol);
 if(!h)throw new Error('selected_prestock_not_in_wallet');
 if(Number(h.estimatedValueUSDC||0)+1e-9<amount)throw new Error('prestock_value_below_purchase_amount');
 const estimate=Math.min(Number(h.amount||0),(amount/Math.max(Number(h.tokenPrice||0),1e-12))*1.03);
 const ok=await actionSheet({kicker:'USE A PRESTOCK',title:`Use ${symbol} for this purchase`,copy:`Stocklana estimates selling about ${estimate.toLocaleString(undefined,{maximumFractionDigits:6})} ${symbol} into USDC. Phantom shows the exact swap before you sign.`,confirmLabel:'Show swap',fields:[],summary:`<b>${money(amount)}</b><span>maximum purchase value</span><small>${symbol} converts only after your wallet approval.</small>`});
 if(!ok)throw new Error('purchase_cancelled');
 const atomic=Math.max(1,Math.floor(estimate*(10**Number(h.decimals||0))));
 toast(`Building ${symbol} → USDC route`);
 const order=await postJson('/api/prestocks/order',{mint:h.mint,side:'SELL',tokenAmountAtomic:atomic});
 if(!order.ready)throw new Error(order.reason||'Jupiter connector not configured');
 toast(`Approve ${symbol} conversion in Phantom`);
 const signedTransaction=await signSerializedTransaction({provider:wallet.provider,transactionBase64:order.transaction});
 const executed=await postJson('/api/prestocks/execute',{signedTransaction,requestId:order.requestId});
 const ref=executed.signature||executed.txid||executed.status||'jupiter-executed';
 await postJson('/api/commerce/conversion',{intentId,sourceAsset:symbol,reference:ref,details:{rail:'JUPITER_SWAP_V2',estimatedTokens:estimate}});
 await loadWalletCenter();
 if(Number(lastWalletPortfolio?.usdc||0)+1e-9<amount)throw new Error('conversion_confirmed_but_wallet_usdc_is_still_below_purchase_amount');
 return ref
}
async function convertSolForPurchase(intentId,amount){
 const available=Number(lastWalletPortfolio?.sol||0);
 const v=await actionSheet({kicker:'USE SOL',title:'Convert SOL for this purchase',copy:`You have ${available.toLocaleString(undefined,{maximumFractionDigits:5})} SOL. Phantom shows the exact conversion before signing.`,confirmLabel:'Build conversion',fields:[{name:'solAmount',label:'SOL amount',type:'number',value:'0.1',min:.000001,step:.000001}]});
 const solAmount=Number(v?.solAmount||0);
 if(solAmount<=0||solAmount>available)throw new Error('invalid_sol_amount');
 const inputMint='So11111111111111111111111111111111111111112';
 toast('Building SOL → USDC route');
 const order=await postJson('/api/swap/order',{inputMint,outputMint:config.usdcMint,amountAtomic:Math.floor(solAmount*1e9)});
 if(!order.ready)throw new Error(order.reason||'Jupiter connector not configured');
 toast('Approve SOL conversion in Phantom');
 const signedTransaction=await signSerializedTransaction({provider:wallet.provider,transactionBase64:order.transaction});
 const executed=await postJson('/api/swap/execute',{signedTransaction,requestId:order.requestId});
 const ref=executed.signature||executed.txid||executed.status||'jupiter-executed';
 await postJson('/api/commerce/conversion',{intentId,sourceAsset:'SOL',reference:ref,details:{rail:'JUPITER_SWAP_V2',solInput:solAmount}});
 await loadWalletCenter();
 if(Number(lastWalletPortfolio?.usdc||0)+1e-9<amount)throw new Error('conversion_confirmed_but_wallet_usdc_is_still_below_purchase_amount');
 return ref
}
async function consolidateSplitFunding(amount){
 const vaultBalance=Number(vault?.balances?.USDC||0), walletBalance=Number(lastWalletPortfolio?.usdc||0);
 const walletPart=Math.max(0,amount-vaultBalance);
 if(walletPart<=0)return;
 if(walletBalance+1e-9<walletPart)throw new Error('combined_usdc_below_purchase_amount');
 if(!config.vaultAddress)throw new Error('stocklana_vault_not_configured');
 toast(`Move ${money(walletPart)} from Phantom into Stocklana`);
 const signature=await sendSplToken({provider:wallet.provider,to:config.vaultAddress,mint:config.usdcMint,amount:walletPart,decimals:6,rpc:config.rpcUrl});
 await postJson('/api/vault/confirm-deposit',{signature,amount:walletPart,wallet:wallet.publicKey});
 await Promise.all([loadVault(),loadWalletCenter()]);
}
async function createCommercePurchase(){
 if(!wallet?.provider||!sessionToken){toast('Connect Phantom first');return}
 const merchantUrl=$('#commerceUrl')?.value?.trim(),amount=Number($('#commerceAmount')?.value||0),agentId=$('#commerceAgent')?.value?.trim()||null;
 if(!merchantUrl||amount<=0){toast('Add a merchant URL and maximum spend');return}
 let chosen=$('#commerceFunding')?.value||'SMART';
 if(chosen==='SMART')chosen=selectedFundingRoute||((Number(lastWalletPortfolio?.usdc||0)>=amount)?'WALLET_USDC':(Number(vault?.balances?.USDC||0)>=amount)?'STOCKLANA_USDC':'');
 if(!chosen){toast('Choose a funding route');return}
 try{
   let out;
   if(chosen==='STOCKLANA_USDC'){
     out=await createCommerceIntent({merchantUrl,amount,fundingSource:'STOCKLANA_USDC',agentId,sourceAsset:'USDC'});
   }else if(chosen==='SPLIT_USDC'){
     await consolidateSplitFunding(amount);
     out=await createCommerceIntent({merchantUrl,amount,fundingSource:'STOCKLANA_USDC',agentId,sourceAsset:'USDC',note:'Consolidated Phantom + Stocklana USDC purchase'});
   }else if(chosen==='PRESTOCK_TO_USDC'){
     const symbol=$('#commercePrestock')?.value;
     if(!symbol)throw new Error('choose_a_prestock_holding');
     out=await createCommerceIntent({merchantUrl,amount,fundingSource:'WALLET_USDC',agentId,sourceAsset:symbol,note:`Converted from ${symbol} for merchant purchase`});
     await convertPrestockForPurchase(out.intent.id,symbol,amount);
     out=await fundCommerceFromWallet(out.intent.id,amount);
   }else if(chosen==='SOL_TO_USDC'){
     out=await createCommerceIntent({merchantUrl,amount,fundingSource:'WALLET_USDC',agentId,sourceAsset:'SOL',note:'Converted from SOL for merchant purchase'});
     await convertSolForPurchase(out.intent.id,amount);
     out=await fundCommerceFromWallet(out.intent.id,amount);
   }else{
     out=await createCommerceIntent({merchantUrl,amount,fundingSource:'WALLET_USDC',agentId,sourceAsset:'USDC'});
     if(out.requiresWalletTransfer)out=await fundCommerceFromWallet(out.intent.id,amount);
   }
   renderCommerceResult(out);
   toast((out.issuance||{}).ready?'Safe purchase ready':'Purchase policy created');
   await Promise.all([loadCommerce(),loadVault(),loadWalletCenter(),loadFundingPlan()]);
 }catch(e){if(String(e.message||e)!=='purchase_cancelled')toast(String(e.message||e))}
}
$('#swapExecuteBtn')?.addEventListener('click',executeWalletSwap);
$('#walletSwapBtn')?.addEventListener('click',()=>$('#swapAmount')?.focus());
$('#walletShopBtn')?.addEventListener('click',()=>navigate('commerce'));
$('#commerceCreateBtn')?.addEventListener('click',createCommercePurchase);
$('#commerceAmount')?.addEventListener('change',()=>{selectedFundingRoute=null;loadFundingPlan()});
$('#commerceFunding')?.addEventListener('change',e=>{selectedFundingRoute=e.target.value==='SMART'?null:e.target.value;loadFundingPlan()});
$('#commercePrestock')?.addEventListener('change',e=>{if(e.target.value){selectedFundingRoute='PRESTOCK_TO_USDC';$('#commerceFunding').value='PRESTOCK_TO_USDC'}loadFundingPlan()});
$('#commerceUrl')?.addEventListener('input',e=>{try{$('#commerceMerchantRule').textContent=new URL(e.target.value).hostname||'Locked to URL'}catch{$('#commerceMerchantRule').textContent='Locked to URL'}});
$('#walletConnectCenterBtn')?.addEventListener('click',async()=>{try{await connectPrimaryWallet()}catch{}});
$('#walletRefreshBtn')?.addEventListener('click',loadWalletCenter);
$('#walletCopyBtn')?.addEventListener('click',async()=>{if(!wallet?.publicKey)return toast('Connect Phantom first');await navigator.clipboard?.writeText(wallet.publicKey);toast('Wallet address copied')});
$('#walletExplorerBtn')?.addEventListener('click',()=>{if(!wallet?.publicKey)return toast('Connect Phantom first');window.open(`https://solscan.io/account/${wallet.publicKey}`,'_blank','noopener')});
$('#walletBuyPrestockBtn')?.addEventListener('click',()=>navigate('markets'));
$('#walletDepositCenterBtn')?.addEventListener('click',()=>{navigate('vault');setTimeout(()=>$('#fundWalletBtn')?.focus(),250)});
$('#walletSendCenterBtn')?.addEventListener('click',()=>{navigate('vault');setTimeout(()=>$('#maqueSendBtn')?.focus(),250)});
$$('[data-wallet-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.walletRoute)));
onWalletAccountChanged(async pk=>{sessionToken=null;if(!pk){wallet=null;$('#walletBtn').textContent='Connect wallet';$('#walletBtn').classList.remove('connected');await loadWalletCenter();await loadV2Home();return}try{wallet=await connectSolanaWallet();await authenticateWallet(wallet);$('#walletBtn').textContent=short(wallet.publicKey);$('#walletBtn').classList.add('connected');await Promise.all([loadWalletCenter(),loadVault(),loadV2Home()])}catch{}});

function renderHomeEquities(all=assets){
  const homeAssets=$('#homeAssets');
  const rows=(Array.isArray(all)&&all.length?all:assets);
  const featured=rows.find(a=>a.symbol==='OPENAI')||rows.find(a=>a.symbol==='SPACEX')||rows[0];
  const list=rows.filter(a=>a.symbol!==featured?.symbol).slice(0,4);
  if($('#homeFeaturedPrestock')&&featured){
    const p=premium(featured);
    const label=featured.name.replace(' PreStocks','');
    $('#homeFeaturedPrestock').innerHTML=`<button class="featured-main" data-home-featured="${featured.symbol}"><span class="featured-logo">${featured.symbol.slice(0,2)}</span><div class="featured-name"><h3>${label}</h3><small>${featured.symbol} · PreStock</small><span class="featured-badges"><i>PreStock</i><i>24/7</i></span></div><div class="fp-price"><b>${money(featured.tokenPrice)}</b><small class="${p>=0?'up':'down'}">${p>=0?'+':''}${p.toFixed(1)}%</small></div></button><div class="neo-spark" aria-hidden="true"><i></i></div>`;
    $('#homeFeaturedPrestock [data-home-featured]')?.addEventListener('click',()=>openAsset(featured.symbol));
  }
  if(homeAssets){
    homeAssets.innerHTML=list.map(a=>{const p=premium(a);return `<button data-home-asset="${a.symbol}"><span class="mini-symbol">${a.symbol.slice(0,1)}</span><div><b>${a.symbol}</b><small>${money(a.tokenPrice)}</small></div><strong class="${p>=0?'up':'down'}">${p>=0?'+':''}${p.toFixed(1)}%</strong></button>`}).join('');
    $$('[data-home-asset]').forEach(b=>b.onclick=()=>openAsset(b.dataset.homeAsset));
  }
}
function renderHomeGamePreview(){
 const box=$('#homeGameSpotlight');if(!box)return;
 box.innerHTML=`<span class="status preview">PREVIEW</span><h3>Will OPENAI trade above its current mark by the end of the round?</h3><div class="neo-game-meta"><span>Fully collateralized</span><span>House exposure 0</span></div><div class="neo-game-sides"><button class="yes" data-home-preview="YES"><small>YES</small><b>3.2×</b><small>example payoff</small></button><button class="no" data-home-preview="NO"><small>NO</small><b>1.4×</b><small>example payoff</small></button></div>`;
 box.querySelectorAll('[data-home-preview]').forEach(b=>b.onclick=()=>navigate('play'));
}
function renderHomeActivityFallback(){
 const box=$('#homeActivity');if(!box)return;
 box.innerHTML=`<div><span>◉</span><p><b>Wallet ready</b><small>Connect Phantom to populate verified activity</small></p></div><div><span>↗</span><p><b>PreStocks ready</b><small>Buy, automate, play or use for commerce</small></p></div><div><span>◇</span><p><b>Games ready</b><small>Fully collateralized payoff markets</small></p></div><div><span>◈</span><p><b>Agent controls ready</b><small>Budgets, merchants and approval thresholds</small></p></div>`;
}
async function loadV2Home(){
  // Never show an empty competition demo: render the canonical local registry first,
  // then replace it with live API data when available.
  renderHomeEquities(assets);
  renderHomeGamePreview();
  if(!sessionToken)renderHomeActivityFallback();
  try{
    const r=await fetch('/api/v2/home',{cache:'no-store'});
    if(!r.ok)throw new Error('home_api_'+r.status);
    const d=await r.json();
    const all=Array.isArray(d.equities)&&d.equities.length?d.equities:assets;
    renderHomeEquities(all);
    const ac=d.account;
    if(ac&&sessionToken){
      const cash=Number(ac.balances?.USDC||0);
      $('#homeCash').textContent=money(cash);
      $('#homeNetValue').textContent=money(cash);
      $('#homePositions').textContent=String(ac.positions||0);
      $('#homeAccountState').textContent='ACTIVE';
      $('#homeAccountState').className='status live';
    }else{
      $('#homeAccountState').textContent=wallet?.publicKey?'WALLET CONNECTED':'NOT CONNECTED';
      $('#homeAccountState').className='status neutral';
    }
  }catch(e){
    // Local exact-mint registry already rendered above.
  }
  await Promise.allSettled([loadHomeGameSpotlight(),loadHomeActivity()]);
}
async function loadHomeGameSpotlight(){
 const box=$('#homeGameSpotlight');if(!box)return;
 try{
   const r=await fetch('/api/games?stake=10&limit=1',{cache:'no-store'});
   if(!r.ok)throw new Error('games_api_'+r.status);
   const d=await r.json(),g=d.games?.[0];
   if(!g){renderHomeGamePreview();return}
   const yes=Math.round(Number(g.yesProbability??.5)*100),no=100-yes,y=g.game?.yes||{},n=g.game?.no||{};
   box.innerHTML=`<span class="status live">${gameTitle(g.family)}</span><h3>${g.question}</h3><div class="neo-game-meta"><span>${money(g.collateral||0)} real pool</span><span>${g.trades?.length||0} plays</span></div><div class="neo-game-sides"><button class="yes" data-home-game-side="YES"><small>YES · ${yes}%</small><b>${money(y.payoutIfCorrect||0)}</b><small>if correct on $10</small></button><button class="no" data-home-game-side="NO"><small>NO · ${no}%</small><b>${money(n.payoutIfCorrect||0)}</b><small>if correct on $10</small></button></div>`;
   box.querySelectorAll('[data-home-game-side]').forEach(b=>b.onclick=()=>trade(g.id,b.dataset.homeGameSide,10));
 }catch(e){renderHomeGamePreview()}
}
async function loadHomeActivity(){
 const box=$('#homeActivity');if(!box)return;
 if(!sessionToken){renderHomeActivityFallback();return}
 try{
   const r=await fetch('/api/receipts',{cache:'no-store'}),d=await r.json(),rows=Array.isArray(d)?d:(d.receipts||[]);
   box.innerHTML=rows.slice(0,4).map(x=>`<div><span>✓</span><p><b>${String(x.type||x.kind||'Stocklana action').replaceAll('_',' ')}</b><small>${x.amount?money(x.amount):x.status||'verified receipt'}</small></p></div>`).join('')||'<div><span>✓</span><p><b>Wallet connected</b><small>No recent Stocklana receipts yet.</small></p></div>';
 }catch{box.innerHTML='<div><span>✓</span><p><b>Wallet connected</b><small>Activity is ready when you transact.</small></p></div>'}
}
async function loadCredit(){
  if(!$('#creditPower'))return;
  if(!sessionToken){$('#creditPower').textContent='Connect to calculate';return}
  try{const d=await fetch('/api/accounting/me').then(r=>r.json());const spend=Number(d?.monetary?.spendableUSDC||d?.spendableUSDC||0),coll=Number(d?.collateral?.totalUSDC||d?.collateralUSDC||0);$('#creditPower').textContent=money(Math.max(coll*.5,spend*.25))}catch{$('#creditPower').textContent='Check provider routes'}
}
function requireWalletAction(fn){if(!wallet||!sessionToken){toast('Connect and authenticate your Solana wallet first');return false}fn?.();return true}
$$('[data-action]').forEach(b=>b.addEventListener('click',()=>{
 const a=b.dataset.action;
 if(a==='buy')navigate('markets');
 if(a==='auto'){navigate('markets');toast('Choose an equity, then tap Auto')}
 if(a==='borrow')navigate('credit');
 if(a==='play')navigate('play');
 if(a==='send'){navigate('vault');setTimeout(()=>$('#maqueSendBtn')?.focus(),250)}
 if(a==='spend'){navigate('commerce');setTimeout(()=>$('#commerceUrl')?.focus(),250)}
 if(a==='agent')navigate('agents');
 if(a==='launch')navigate('launch');
 if(a==='money'){navigate('wallet');setTimeout(()=>$('#swapAmount')?.focus(),250)}
 if(a==='add-money'){navigate('wallet');setTimeout(()=>$('#swapAmount')?.focus(),250)}
}));
$('[data-home-wallet]')?.addEventListener('click',async()=>{if(wallet?.publicKey){navigate('wallet');return}try{await connectPrimaryWallet();navigate('wallet')}catch{}});
$('#homeShopGo')?.addEventListener('click',()=>{const u=$('#homeShopLink')?.value?.trim();navigate('commerce');setTimeout(()=>{if(u&&$('#commerceUrl'))$('#commerceUrl').value=u;$('#commerceUrl')?.dispatchEvent(new Event('input'));$('#commerceAmount')?.focus()},80)});
$('#creditStartBtn')?.addEventListener('click',()=>requireWalletAction(loadCredit));
$('#internalBorrowBtn')?.addEventListener('click',async()=>{if(!requireWalletAction())return;const v=await actionSheet({kicker:'CREDIT',title:'Use supported value as collateral',copy:'See the 30-day quote before opening funded credit.',confirmLabel:'Get quote',fields:[{name:'collateral',label:'Collateral value (USDC)',type:'number',value:'250',min:1,step:.01},{name:'borrow',label:'Borrow amount (USDC)',type:'number',value:'100',min:1,step:.01}]});const collateral=Number(v?.collateral||0),borrow=Number(v?.borrow||0);if(collateral<=0||borrow<=0)return;try{const q=await fetch('/api/lending/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({collateral,borrow,days:30})}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'quote_failed');return j});const ok=await actionSheet({kicker:'CREDIT QUOTE',title:`Borrow ${money(borrow)}`,copy:`30-day quote against ${money(collateral)} collateral.`,confirmLabel:'Open funded credit',fields:[],summary:`<b>${money(borrow)}</b><span>borrowed against ${money(collateral)}</span><small>${q.aprPct!=null?`${q.aprPct}% APR · `:''}Stocklana-funded route</small>`});if(ok){const r=await fetch('/api/lending/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({collateral,borrow,days:30})}),j=await r.json();toast(r.ok?`Credit opened · ${j.loanId||'funded'}`:(j.error||'Credit route unavailable'));await loadCredit()}}catch(e){toast(String(e.message||e))}});
$('#kaminoBorrowBtn')?.addEventListener('click',async()=>{if(!requireWalletAction())return;const v=await actionSheet({kicker:'KAMINO',title:'Build a Solana DeFi transaction',copy:'Use only a Kamino market and reserve that support the collateral you intend to deposit.',confirmLabel:'Build transaction',fields:[{name:'market',label:'Kamino market address'},{name:'reserve',label:'Collateral reserve address'},{name:'amount',label:'Atomic deposit amount',type:'number',min:1,step:1}]});const market=String(v?.market||'').trim(),reserve=String(v?.reserve||'').trim(),amount=String(v?.amount||'').trim();if(!market||!reserve||!amount)return;try{const r=await fetch('/api/kamino/deposit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:wallet.publicKey,market,reserve,amount})}),j=await r.json();if(!r.ok)throw new Error(j.error||'kamino_builder_failed');toast('Kamino transaction built — sign locally in wallet')}catch(e){toast(String(e.message||e))}});

function ambient(){const c=$('#ambient'),x=c.getContext('2d');let w,h,d=1;function size(){d=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;c.width=w*d;c.height=h*d;c.style.width=w+'px';c.style.height=h+'px';x.setTransform(d,0,0,d,0,0)}function draw(t){x.clearRect(0,0,w,h);x.strokeStyle='rgba(110,180,230,.055)';x.lineWidth=1;const s=44;for(let i=-s;i<w+s;i+=s){x.beginPath();x.moveTo(i+(t*.003)%s,0);x.lineTo(i-140+(t*.003)%s,h);x.stroke()}for(let y=40;y<h;y+=s){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}requestAnimationFrame(draw)}addEventListener('resize',size);size();requestAnimationFrame(draw)}
(async()=>{ambient();renderAssets();buildFields();loadV2Home();config=await fetch('/api/config').then(r=>r.json()).catch(()=>({}));refreshSwapTargets();renderJudgeLoop();await loadLive();await loadMarkets();const s=await walletState();if(s.publicKey){wallet=await connectSolanaWallet().catch(()=>null);if(wallet){await authenticateWallet(wallet).catch(()=>{});$('#walletBtn').textContent='My money';$('#walletBtn').classList.add('connected');if(sessionToken)await loadVault();await loadWalletCenter()}}const invite=new URLSearchParams(location.search).get('challenge');if(invite){navigate('play');openChallengeInvite(invite)}})();

async function loadCoverage(){
  const grid=document.querySelector('#coverageGrid'); if(!grid)return;
  try{
    const data=await fetch('/api/track-fit',{cache:'no-store'}).then(r=>r.json());
    const entries=Object.entries(data).filter(([k])=>k!=='wedge');
    grid.innerHTML=`<article class="route"><div class="route-top"><span class="status live">WEDGE</span><b>ONE PRODUCT</b></div><h3>Programmable tokenized-equity ownership</h3><p>${data.wedge}</p></article>`+entries.map(([k,v])=>`<article class="asset-card"><div class="asset-head"><span class="status">2×</span><span class="sym">${k.replaceAll('_',' ').toUpperCase()}</span></div><h3>${k.replaceAll('_',' ')}</h3><div class="market-chips">${v.map(x=>`<span>${x}</span>`).join('')}</div></article>`).join('');
  }catch(e){grid.innerHTML='<div class="empty-card">Track-fit matrix unavailable</div>'}
}
document.querySelectorAll('[data-nav="coverage"]').forEach(b=>b.addEventListener('click',loadCoverage));
document.querySelector('#coverageRefresh')?.addEventListener('click',loadCoverage);
document.querySelectorAll('[data-nav="infrastructure"]').forEach(b=>b.addEventListener('click',async()=>{try{await fetch('/api/iso20022').then(r=>r.json());const a=await fetch('/api/accounting/tokens',{cache:'no-store'}).then(r=>r.json());const i=a.invariants||{};const c=document.querySelector('#acctCoverage'),p=document.querySelector('#acctProof');if(c)c.textContent=(i.cashCoverageRatio==null?'N/A':`${i.cashCoverageRatio.toFixed(4)}×`);if(p)p.textContent=`USDC ${Number(i.externalUSDC||0).toFixed(2)} · claims ${Number(i.monetaryClaimsUSDC||0).toFixed(2)} · journal ${i.journalBalanced?'balanced':'ERROR'} · ${i.fullyBackedMonetaryClaims?'fully backed':'UNDERBACKED'}.`;}catch(e){const p=document.querySelector('#acctProof');if(p)p.textContent='Accounting proof unavailable.';}}));



// ---- CMESH · separate platform-token lane (Pons / Robinhood Chain) ----
const CMESH_STORAGE_KEY='stocklana:cmesh:token-address';
let cmeshToken=null,cmeshState=null;
const validEvmAddress=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||'').trim());
function storedCmesh(){return localStorage.getItem(CMESH_STORAGE_KEY)||''}
async function resolveCmeshAddress(){
 if(validEvmAddress(cmeshToken))return cmeshToken;
 try{const cfg=await fetch('/api/cmesh/config',{cache:'no-store'}).then(r=>r.json());if(validEvmAddress(cfg.tokenAddress))cmeshToken=cfg.tokenAddress}catch{}
 if(!validEvmAddress(cmeshToken)&&validEvmAddress(storedCmesh()))cmeshToken=storedCmesh();
 return cmeshToken
}
function renderCmeshState(s){
 const box=$('#cmeshState'),status=$('#cmeshReadStatus');if(!box)return;
 if(!s){status.textContent='ADDRESS NEEDED';status.className='status neutral';return}
 const cs=s.curveState,p=Math.max(0,Math.min(100,Number(cs?.progress||0)));
 status.textContent=s.phaseLabel?.toUpperCase()||'ONCHAIN';status.className='status live';
 box.innerHTML=`<div class="cmesh-live-head"><div><span class="status live">VERIFIED FROM PONS</span><h2>${s.name} · ${s.symbol}</h2><code>${s.token}</code></div><a href="${s.explorer}" target="_blank" rel="noopener">Explorer ↗</a></div>${cs?`<div class="curve-progress"><i style="width:${p}%"></i></div><div class="curve-row"><div><span>Graduation</span><b>${p.toFixed(2)}%</b></div><div><span>Raised</span><b>${Number(cs.raisedEth).toFixed(4)} ${s.pairSymbol}</b></div><div><span>Creator tax</span><b>${(Number(cs.creatorTaxBps)/100).toFixed(2)}%</b></div></div>`:`<div class="curve-row"><div><span>Phase</span><b>${s.phaseLabel}</b></div><div><span>Pair</span><b>${s.pairSymbol}</b></div><div><span>Buyback</span><b>${s.buybackEnabled?'ON':'OFF'}</b></div></div>`}`;
 $('#cmeshBuyBtn').disabled=!(s.phase===0&&s.pairSymbol==='ETH');
 $('#cmeshSellBtn').disabled=!(s.phase===0&&s.pairSymbol==='ETH');
 $('#cmeshTradeHint').textContent=s.phase===0&&s.pairSymbol==='ETH'?'Wallet-signed trades execute through the live pons curve.':'Embedded trading is available while the token is on an ETH-paired pons curve.';
}
async function bindCmesh(addr){
 const token=String(addr||'').trim();if(!validEvmAddress(token))throw new Error('full_cmesh_address_required');
 const s=await readPonsLaunch(token);
 if(String(s.symbol||'').toUpperCase()!=='CMESH'&&String(s.name||'').toLowerCase()!=='ciphermesh')throw new Error('address_is_not_cmesh');
 cmeshToken=token;cmeshState=s;localStorage.setItem(CMESH_STORAGE_KEY,token);saveTracked(token);renderCmeshState(s);return s
}
async function loadCmesh(){
 const status=$('#cmeshReadStatus');if(status){status.textContent='READING CHAIN';status.className='status neutral'}
 const token=await resolveCmeshAddress();
 if(!validEvmAddress(token)){renderCmeshState(null);return}
 try{cmeshState=await readPonsLaunch(token);renderCmeshState(cmeshState)}catch(e){if(status){status.textContent='VERIFY ADDRESS';status.className='status neutral'};toast(String(e.message||e))}
}
$('#cmeshBindBtn')?.addEventListener('click',async()=>{try{const s=await bindCmesh($('#cmeshAddressInput').value);toast(`CMESH verified · ${short(s.token)}`)}catch(e){toast(String(e.message||e))}});
$('#cmeshConnectBtn')?.addEventListener('click',async()=>{try{const x=await connectRobinhood();evmAccount=x.address;$('#cmeshConnectBtn').textContent=short(evmAccount);$('#cmeshWalletState').textContent='WALLET ON';$('#cmeshWalletState').className='status live';await loadCmesh();toast('Robinhood Chain wallet connected')}catch(e){toast(String(e.message||e))}});
$('#cmeshExplorerBtn')?.addEventListener('click',async()=>{const t=await resolveCmeshAddress();if(!validEvmAddress(t))return toast('Bind the full CMESH address first');window.open(`${PONS_V2.explorer}/token/${t}`,'_blank','noopener')});
$('#cmeshBuyBtn')?.addEventListener('click',async()=>{const t=await resolveCmeshAddress(),amt=Number($('#cmeshTradeAmount').value||0);if(!validEvmAddress(t)||amt<=0)return toast('Bind CMESH and enter an ETH amount');try{const r=await buyPons(t,amt);toast(`CMESH buy confirmed · ${short(r.hash)}`);await loadCmesh()}catch(e){toast(String(e.shortMessage||e.message||e))}});
$('#cmeshSellBtn')?.addEventListener('click',async()=>{const t=await resolveCmeshAddress(),amt=Number($('#cmeshTradeAmount').value||0);if(!validEvmAddress(t)||amt<=0)return toast('Bind CMESH and enter a token amount');try{const r=await sellPons(t,amt);toast(`CMESH sell confirmed · ${short(r.hash)}`);await loadCmesh()}catch(e){toast(String(e.shortMessage||e.message||e))}});


// ---- Stocklana Launch Exchange / Pons v2 Robinhood Chain ----
let evmAccount=null, ponsConfig=null;
const launchKey='stocklana:pons:v2:tracked';
const trackedLaunches=()=>{try{return JSON.parse(localStorage.getItem(launchKey)||'[]')}catch{return []}};
const saveTracked=(addr)=>{const a=String(addr||'').trim();if(!/^0x[a-fA-F0-9]{40}$/.test(a))return false;const xs=[a,...trackedLaunches().filter(x=>x.toLowerCase()!=a.toLowerCase())].slice(0,50);localStorage.setItem(launchKey,JSON.stringify(xs));return true};
function launchTab(name){document.querySelectorAll('[data-launch-tab]').forEach(b=>b.classList.toggle('active',b.dataset.launchTab===name));document.querySelectorAll('.launch-pane').forEach(p=>p.classList.toggle('active',p.id===`launch-pane-${name}`));if(name==='portfolio')loadPonsPortfolio()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-launch-tab]');if(b)launchTab(b.dataset.launchTab)});
function ponsCard(s){const c=s.curveState,p=Math.max(0,Math.min(100,Number(c?.progress||0))),phase=s.phaseLabel||'Unknown';return `<article class="pons-card" data-pons-token="${s.token}"><div class="pons-card-head"><div><span class="status ${s.phase===0?'live':'neutral'}">${phase.toUpperCase()}</span><h3>${s.name} <small>${s.symbol}</small></h3><code>${short(s.token)}</code></div><b>${s.pairSymbol}</b></div>${c?`<div class="curve-progress"><i style="width:${p}%"></i></div><small>${p.toFixed(2)}% to graduation · ${Number(c.raisedEth).toFixed(4)} / ${Number(c.thresholdEth).toFixed(4)} ${s.pairSymbol}</small><div class="curve-row"><div><span>Trade fee</span><b>${(c.feeBps/100).toFixed(2)}%</b></div><div><span>Creator tax</span><b>${(c.creatorTaxBps/100).toFixed(2)}%</b></div><div><span>Buyback</span><b>${s.buybackEnabled?'ON':'OFF'}</b></div></div>`:`<div class="curve-row"><div><span>Phase</span><b>${phase}</b></div><div><span>Pair</span><b>${s.pairSymbol}</b></div><div><span>Tax</span><b>${(s.creatorTaxBps/100).toFixed(2)}%</b></div></div>`}<div class="pons-actions">${s.phase===0&&s.pairSymbol==='ETH'?`<button class="primary" data-pons-buy="${s.token}">Buy</button><button class="ghost" data-pons-sell="${s.token}">Sell</button>`:''}<button class="ghost wide" data-pons-explorer="${s.explorer}">Open chain proof</button></div></article>`}
async function loadPonsPortfolio(){const g=$('#ponsLaunchGrid');if(!g)return;const list=trackedLaunches();$('#launchCount').textContent=String(list.length);if(!list.length)return;g.innerHTML='<div class="empty-card">Reading live launch state from Robinhood Chain…</div>';const rows=[];for(const token of list){try{rows.push(await readPonsLaunch(token))}catch(e){rows.push({token,name:'Unreadable launch',symbol:'?',phase:9,phaseLabel:String(e.message||e),pairSymbol:'?',creatorTaxBps:0,buybackEnabled:false,explorer:`${PONS_V2.explorer}/token/${token}`})}}g.innerHTML=rows.map(ponsCard).join('')}
async function loadPonsFactory(){ponsConfig=await getPonsConfig();const sel=$('#ponsLaunchConfig');if(sel){sel.innerHTML=ponsConfig.configs.map(c=>`<option value="${c.id}">Config ${c.id} · ${(c.curveFeeBps/100).toFixed(2)}% curve · ${Number(BigInt(c.graduationThreshold))/1e18} quote graduation</option>`).join('')||'<option>No enabled launch configs</option>'}const {formatEther}=await import('https://esm.sh/viem@2.37.9');$('#ponsLaunchFee').textContent=`${formatEther(BigInt(ponsConfig.launchFeeWei))} ETH`;$('#ponsLaunchEligibility').textContent=`Factory live · creator tax cap ${(ponsConfig.maxCreatorTaxBps/100).toFixed(2)}%`}
$('#connectEvmBtn')?.addEventListener('click',async()=>{try{const x=await connectRobinhood();evmAccount=x.address;$('#connectEvmBtn').textContent=short(evmAccount);$('#connectEvmBtn').classList.add('connected');await loadPonsFactory();toast('Robinhood Chain wallet connected')}catch(e){toast(e.message==='evm_wallet_not_found'?'Open an EVM wallet such as MetaMask or Robinhood Wallet':String(e.message||e))}});
$('#ponsPairMode')?.addEventListener('change',e=>{$('#ponsPairAddressField').hidden=e.target.value!=='CUSTOM'});
$('#ponsImportBtn')?.addEventListener('click',async()=>{const addr=$('#ponsImportAddress').value.trim(),out=$('#ponsImportResult');if(!/^0x[a-fA-F0-9]{40}$/.test(addr)){toast('Enter the full 0x token address');return}out.innerHTML='<div class="empty-card">Reading factory and curve…</div>';try{const s=await readPonsLaunch(addr);saveTracked(addr);out.innerHTML=ponsCard(s);toast(`${s.symbol} imported from chain`);$('#launchCount').textContent=trackedLaunches().length}catch(e){out.innerHTML=`<div class="warn">${String(e.message||e)}</div>`}});
$('#ponsLaunchBtn')?.addEventListener('click',async()=>{try{if(!evmAccount){const x=await connectRobinhood();evmAccount=x.address}if(!ponsConfig)await loadPonsFactory();const name=$('#ponsName').value.trim(),symbol=$('#ponsSymbol').value.trim();if(!name||!symbol)throw new Error('name_and_symbol_required');const pairMode=$('#ponsPairMode').value,pairToken=pairMode==='CUSTOM'?$('#ponsPairToken').value.trim():'';const input={name,symbol,pairToken,launchConfigId:Number($('#ponsLaunchConfig').value||0),creatorTaxBps:Math.round(Number($('#ponsCreatorTax').value||0)*100),buybackEnabled:$('#ponsBuyback').checked,logo:$('#ponsLogo').value.trim(),description:$('#ponsDescription').value.trim(),website:$('#ponsWebsite').value.trim(),twitter:$('#ponsTwitter').value.trim(),farcaster:$('#ponsFarcaster').value.trim(),creatorFeeRecipient:evmAccount};toast('Approve Pons v2 launch in wallet');const r=await launchPonsV2(input);if(r.receiptStatus!=='success')throw new Error('launch_transaction_reverted');if(r.token)saveTracked(r.token);toast(`Launch confirmed ${r.token?short(r.token):short(r.hash)}`);launchTab('portfolio');await loadPonsPortfolio()}catch(e){toast(String(e.shortMessage||e.message||e))}});
document.addEventListener('click',async e=>{const buy=e.target.closest('[data-pons-buy]'),sell=e.target.closest('[data-pons-sell]'),exp=e.target.closest('[data-pons-explorer]');if(exp){window.open(exp.dataset.ponsExplorer,'_blank','noopener');return}if(buy){const v=await actionSheet({kicker:'PONS',title:'Buy on the live bonding curve',copy:'Your EVM wallet signs the Robinhood Chain transaction.',confirmLabel:'Open wallet',fields:[{name:'amount',label:'ETH amount',type:'number',value:'0.01',min:.000001,step:.000001}]});const amt=Number(v?.amount||0);if(amt<=0)return;try{toast('Reading live curve quote');const r=await buyPons(buy.dataset.ponsBuy,amt);toast(`Buy confirmed · ${short(r.hash)}`);await loadPonsPortfolio()}catch(err){toast(String(err.shortMessage||err.message||err))}}if(sell){const v=await actionSheet({kicker:'PONS',title:'Sell on the live bonding curve',copy:'The token approval and sell transaction remain wallet-signed.',confirmLabel:'Open wallet',fields:[{name:'amount',label:'Tokens to sell',type:'number',value:'1000',min:.000001,step:.000001}]});const amt=Number(v?.amount||0);if(amt<=0)return;try{toast('Approve token, then confirm sell');const r=await sellPons(sell.dataset.ponsSell,amt);toast(`Sell confirmed · ${short(r.hash)}`);await loadPonsPortfolio()}catch(err){toast(String(err.shortMessage||err.message||err))}}});
document.querySelectorAll('[data-nav="launch"]').forEach(b=>b.addEventListener('click',()=>loadPonsPortfolio()));
