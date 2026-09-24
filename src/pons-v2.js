const FACTORY='0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const ZERO='0x0000000000000000000000000000000000000000';
const CHAIN_ID=4663;
const RPC='https://rpc.mainnet.chain.robinhood.com';
const EXPLORER='https://robinhoodchain.blockscout.com';
let V;
async function viem(){return V||(V=await import('https://esm.sh/viem@2.37.9'))}
async function chain(){const {defineChain}=await viem();return defineChain({id:CHAIN_ID,name:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[RPC]}},blockExplorers:{default:{name:'Blockscout',url:EXPLORER}}})}
export const PONS_V2={factory:FACTORY,chainId:CHAIN_ID,rpc:RPC,explorer:EXPLORER};
export async function connectRobinhood(){
 if(!window.ethereum) throw new Error('evm_wallet_not_found');
 const hex='0x'+CHAIN_ID.toString(16);
 try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:hex}]})}
 catch(e){if(e?.code!==4902)throw e;await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:hex,chainName:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[RPC],blockExplorerUrls:[EXPLORER]}]})}
 const accounts=await window.ethereum.request({method:'eth_requestAccounts'}); if(!accounts?.[0])throw new Error('wallet_account_missing');
 const {createWalletClient,custom}=await viem(); const c=await chain();
 return {address:accounts[0],walletClient:createWalletClient({chain:c,transport:custom(window.ethereum)})};
}
async function publicClient(){const {createPublicClient,http}=await viem();return createPublicClient({chain:await chain(),transport:http(RPC)})}
const factoryAbiText=[
 'struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }',
 'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }',
 'struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }',
 'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
 'function launchConfigCount() view returns (uint256)',
 'function getLaunchConfig(uint256 id) view returns (LaunchConfig)',
 'function launchFee() view returns (uint256)',
 'function maxCreatorTaxBps() view returns (uint256)',
 'function canLaunch(address account) view returns (bool)',
 'function previewLaunchEconomics(uint256 launchConfigId,address pairToken) view returns (bytes32)',
 'function launchToken(TokenParams params,uint256 launchConfigId,address pairToken,address[] snipeTaxExemptions) payable returns(address token,address curve)',
 'function getLaunchedToken(address token) view returns (LaunchedToken)',
 'event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)'
];
const tokenAbiText=['function name() view returns(string)','function symbol() view returns(string)','function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function approve(address spender,uint256 amount) returns(bool)','function logo() view returns(string)','function description() view returns(string)','function socials() view returns(string twitter,string telegram,string discord,string website,string farcaster)'];
const curveAbiText=['function getReserves() view returns(uint256 quoteReserve,uint256 tokenReserve)','function realQuoteReserve() view returns(uint256)','function graduationThreshold() view returns(uint256)','function sellableTokens() view returns(uint256)','function feeBps() view returns(uint256)','function creatorTaxBps() view returns(uint256)','function currentSnipeTaxBps(address recipient) view returns(uint256)','function readyToGraduate() view returns(bool)','function graduated() view returns(bool)','function buy(uint256 quoteIn,uint256 minTokensOut,address recipient) payable returns(uint256 tokensOut)','function sell(uint256 tokensIn,uint256 minQuoteOut,address recipient) returns(uint256 quoteOut)'];
async function abis(){const {parseAbi}=await viem();return {factory:parseAbi(factoryAbiText),token:parseAbi(tokenAbiText),curve:parseAbi(curveAbiText)}}
export async function getPonsConfig(){
 const client=await publicClient(), {factory}=await abis();
 const [count,fee,maxTax]=await Promise.all([
  client.readContract({address:FACTORY,abi:factory,functionName:'launchConfigCount'}),
  client.readContract({address:FACTORY,abi:factory,functionName:'launchFee'}),
  client.readContract({address:FACTORY,abi:factory,functionName:'maxCreatorTaxBps'})
 ]);
 const configs=[]; for(let i=0n;i<count;i++){const c=await client.readContract({address:FACTORY,abi:factory,functionName:'getLaunchConfig',args:[i]}); if(c.enabled)configs.push({id:Number(i),supply:c.supply.toString(),curveFeeBps:Number(c.curveFeeBps),phantomQuote:c.phantomQuote.toString(),graduationThreshold:c.graduationThreshold.toString(),poolFee:Number(c.poolFee),tickSpacing:Number(c.tickSpacing)})}
 return {factory:FACTORY,chainId:CHAIN_ID,launchFeeWei:fee.toString(),maxCreatorTaxBps:Number(maxTax),configs};
}
export async function launchPonsV2(input){
 const {walletClient,address}=await connectRobinhood(), client=await publicClient(), {factory}=await abis(), {toHex}=await viem();
 const can=await client.readContract({address:FACTORY,abi:factory,functionName:'canLaunch',args:[address]}); if(!can)throw new Error('pons_launch_not_currently_allowed_for_wallet');
 const pair=input.pairToken&&input.pairToken!==''?input.pairToken:ZERO, id=BigInt(input.launchConfigId||0);
 const [expected,fee]=await Promise.all([client.readContract({address:FACTORY,abi:factory,functionName:'previewLaunchEconomics',args:[id,pair]}),client.readContract({address:FACTORY,abi:factory,functionName:'launchFee'})]);
 const rnd=crypto.getRandomValues(new Uint8Array(32)); const salt=toHex(rnd);
 const params={name:input.name.trim(),symbol:input.symbol.trim().toUpperCase(),logo:(input.logo||'').trim(),description:(input.description||'').trim(),socials:{twitter:(input.twitter||'').trim(),telegram:(input.telegram||'').trim(),discord:(input.discord||'').trim(),website:(input.website||'').trim(),farcaster:(input.farcaster||'').trim()},creatorFeeRecipient:input.creatorFeeRecipient||address,creatorTaxBps:Number(input.creatorTaxBps||0),buybackEnabled:!!input.buybackEnabled,expectedEconomics:expected,salt};
 const hash=await walletClient.writeContract({address:FACTORY,abi:factory,functionName:'launchToken',args:[params,id,pair,input.snipeTaxExemptions||[]],value:fee,account:address});
 const receipt=await client.waitForTransactionReceipt({hash});
 const {parseEventLogs}=await viem(); const logs=parseEventLogs({abi:factory,logs:receipt.logs,eventName:'TokenLaunched',strict:false}); const ev=logs[0]?.args||{};
 return {hash,token:ev.token||null,curve:ev.curve||null,creator:address,pairToken:pair,explorer:`${EXPLORER}/tx/${hash}`,receiptStatus:receipt.status};
}
export async function readPonsLaunch(token){
 const client=await publicClient(), {factory,token:tokenAbi,curve:curveAbi}=await abis(), {formatEther,formatUnits}=await viem();
 const launch=await client.readContract({address:FACTORY,abi:factory,functionName:'getLaunchedToken',args:[token]}); if(!launch.exists)throw new Error('token_not_found_in_pons_v2_factory');
 const [name,symbol,decimals,logo,description,socials]=await Promise.all([
  client.readContract({address:token,abi:tokenAbi,functionName:'name'}),client.readContract({address:token,abi:tokenAbi,functionName:'symbol'}),client.readContract({address:token,abi:tokenAbi,functionName:'decimals'}),client.readContract({address:token,abi:tokenAbi,functionName:'logo'}).catch(()=>''),client.readContract({address:token,abi:tokenAbi,functionName:'description'}).catch(()=>''),client.readContract({address:token,abi:tokenAbi,functionName:'socials'}).catch(()=>['','','','',''])
 ]);
 let curveState=null;
 if(Number(launch.phase)===0){const [reserves,raised,threshold,sellable,fee,tax,ready]=await Promise.all([client.readContract({address:launch.curve,abi:curveAbi,functionName:'getReserves'}),client.readContract({address:launch.curve,abi:curveAbi,functionName:'realQuoteReserve'}),client.readContract({address:launch.curve,abi:curveAbi,functionName:'graduationThreshold'}),client.readContract({address:launch.curve,abi:curveAbi,functionName:'sellableTokens'}),client.readContract({address:launch.curve,abi:curveAbi,functionName:'feeBps'}),client.readContract({address:launch.curve,abi:curveAbi,functionName:'creatorTaxBps'}),client.readContract({address:launch.curve,abi:curveAbi,functionName:'readyToGraduate'})]);curveState={quoteReserve:reserves[0].toString(),tokenReserve:reserves[1].toString(),raisedWei:raised.toString(),raisedEth:launch.pairToken===ZERO?formatEther(raised):formatUnits(raised,18),thresholdWei:threshold.toString(),thresholdEth:launch.pairToken===ZERO?formatEther(threshold):formatUnits(threshold,18),progress:Number(threshold?raised*10000n/threshold:0n)/100,sellableTokens:formatUnits(sellable,decimals),feeBps:Number(fee),creatorTaxBps:Number(tax),readyToGraduate:ready};}
 return {token,name,symbol,decimals:Number(decimals),logo,description,socials:Array.from(socials),curve:launch.curve,deployer:launch.deployer,creatorFeeRecipient:launch.creatorFeeRecipient,pairToken:launch.pairToken,pairSymbol:launch.pairToken===ZERO?'ETH':'ERC-20',phase:Number(launch.phase),phaseLabel:['Bonding curve','Swept / graduation pending','Uniswap v4','Rescued'][Number(launch.phase)]||'Unknown',buybackEnabled:launch.buybackEnabled,creatorTaxBps:Number(launch.creatorTaxBps),curveState,explorer:`${EXPLORER}/token/${token}`};
}
const BPS=10000n, ceilDiv=(a,b)=>(a+b-1n)/b, amountOut=(x,ri,ro)=>(x*ro)/(ri+x), amountIn=(out,ri,ro)=>(out*ri)/(ro-out)+1n;
export async function quotePonsBuy(token,ethAmount,recipient){const s=await readPonsLaunch(token);if(!s.curveState||s.phase!==0)throw new Error('launch_not_on_curve');const client=await publicClient(),{curve}=await abis(),{parseEther,formatUnits}=await viem();const quoteIn=parseEther(String(ethAmount));const [reserves,sellable,fee,tax,rawSnipe]=await Promise.all([client.readContract({address:s.curve,abi:curve,functionName:'getReserves'}),client.readContract({address:s.curve,abi:curve,functionName:'sellableTokens'}),client.readContract({address:s.curve,abi:curve,functionName:'feeBps'}),client.readContract({address:s.curve,abi:curve,functionName:'creatorTaxBps'}),client.readContract({address:s.curve,abi:curve,functionName:'currentSnipeTaxBps',args:[recipient]})]);let sn=rawSnipe;if(sn>0n){const mx=BPS-fee-tax-100n;if(sn>mx)sn=mx}let spent=quoteIn;const f=spent*fee/BPS,t=spent*tax/BPS,st=spent*sn/BPS;let out=amountOut(spent-f-t-st,reserves[0],reserves[1]);if(out>sellable){out=sellable;const net=amountIn(sellable,reserves[0],reserves[1]);const gross=ceilDiv(net*BPS,BPS-fee-tax-sn);spent=gross<quoteIn?gross:quoteIn}return {tokenOutRaw:out.toString(),tokensOut:formatUnits(out,s.decimals),spentWei:spent.toString(),snipeTaxBps:Number(sn),feeBps:Number(fee),creatorTaxBps:Number(tax)};}
export async function buyPons(token,ethAmount,slippageBps=300){const {walletClient,address}=await connectRobinhood(),client=await publicClient(),s=await readPonsLaunch(token),{curve}=await abis(),{parseEther}=await viem();if(s.pairToken!==ZERO)throw new Error('custom_pair_buy_not_yet_supported_in_embedded_ui');const q=await quotePonsBuy(token,ethAmount,address),min=BigInt(q.tokenOutRaw)*(10000n-BigInt(slippageBps))/10000n,quoteIn=parseEther(String(ethAmount));const hash=await walletClient.writeContract({address:s.curve,abi:curve,functionName:'buy',args:[quoteIn,min,address],value:quoteIn,account:address});const receipt=await client.waitForTransactionReceipt({hash});return {hash,status:receipt.status,quote:q,explorer:`${EXPLORER}/tx/${hash}`};}
export async function sellPons(token,tokenAmount,slippageBps=300){const {walletClient,address}=await connectRobinhood(),client=await publicClient(),s=await readPonsLaunch(token),{curve,token:tokenAbi}=await abis(),{parseUnits}=await viem();if(s.phase!==0)throw new Error('launch_not_on_curve');const amount=parseUnits(String(tokenAmount),s.decimals);const reserves=await client.readContract({address:s.curve,abi:curve,functionName:'getReserves'}),fee=BigInt(s.curveState.feeBps),tax=BigInt(s.curveState.creatorTaxBps),gross=amountOut(amount,reserves[1],reserves[0]),out=gross-gross*fee/BPS-gross*tax/BPS,min=out*(10000n-BigInt(slippageBps))/10000n;const approve=await walletClient.writeContract({address:token,abi:tokenAbi,functionName:'approve',args:[s.curve,amount],account:address});await client.waitForTransactionReceipt({hash:approve});const hash=await walletClient.writeContract({address:s.curve,abi:curve,functionName:'sell',args:[amount,min,address],account:address});const receipt=await client.waitForTransactionReceipt({hash});return {hash,status:receipt.status,explorer:`${EXPLORER}/tx/${hash}`};}
