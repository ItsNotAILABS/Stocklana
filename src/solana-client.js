let web3, spl;
async function w3(){ if(!web3) web3=await import('https://esm.sh/@solana/web3.js@1.98.4'); return web3; }
async function st(){ if(!spl) spl=await import('https://esm.sh/@solana/spl-token@0.4.14'); return spl; }
export async function connectSolanaWallet(){
  const p=window.phantom?.solana||window.solana;
  if(!p?.connect) throw new Error('solana_wallet_not_found');
  const r=await p.connect(); return {provider:p,publicKey:r.publicKey?.toString?.()||p.publicKey?.toString?.()};
}
export async function signAndSendTransfer({provider,to,lamports,rpc='https://api.mainnet-beta.solana.com'}){
  const {Connection,PublicKey,SystemProgram,Transaction}=await w3(); const connection=new Connection(rpc,'confirmed'); const from=provider.publicKey;
  const tx=new Transaction().add(SystemProgram.transfer({fromPubkey:from,toPubkey:new PublicKey(to),lamports:Number(lamports)}));
  tx.feePayer=from; tx.recentBlockhash=(await connection.getLatestBlockhash()).blockhash; const signed=await provider.signTransaction(tx); const sig=await connection.sendRawTransaction(signed.serialize()); await connection.confirmTransaction(sig,'confirmed'); return sig;
}
export async function sendSplToken({provider,to,mint,amount,decimals=6,rpc='https://api.mainnet-beta.solana.com'}){
  const {Connection,PublicKey,Transaction}=await w3(); const {getAssociatedTokenAddress,createAssociatedTokenAccountInstruction,createTransferCheckedInstruction}=await st();
  const connection=new Connection(rpc,'confirmed'), owner=provider.publicKey, mintPk=new PublicKey(mint), toPk=new PublicKey(to);
  const source=await getAssociatedTokenAddress(mintPk,owner), dest=await getAssociatedTokenAddress(mintPk,toPk,true); const tx=new Transaction();
  const destInfo=await connection.getAccountInfo(dest); if(!destInfo) tx.add(createAssociatedTokenAccountInstruction(owner,dest,toPk,mintPk));
  const units=BigInt(Math.round(Number(amount)*10**decimals)); tx.add(createTransferCheckedInstruction(source,mintPk,dest,owner,units,decimals));
  tx.feePayer=owner; tx.recentBlockhash=(await connection.getLatestBlockhash()).blockhash; const signed=await provider.signTransaction(tx); const sig=await connection.sendRawTransaction(signed.serialize()); await connection.confirmTransaction(sig,'confirmed'); return sig;
}
export async function walletState(){ const p=window.phantom?.solana||window.solana; return {available:!!p,publicKey:p?.publicKey?.toString?.()||null}; }

export async function executeChainBackedTrade({provider,marketId,side,shares,vaultAddress,trader,rpc='https://api.mainnet-beta.solana.com',usdcMint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'}){
  if(!provider?.publicKey) throw new Error('wallet_not_connected');
  if(!vaultAddress) throw new Error('stocklana_vault_not_configured');
  const qRes=await fetch(`/api/markets/${encodeURIComponent(marketId)}/quote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({side,shares})});
  if(!qRes.ok) throw new Error(`quote_failed:${await qRes.text()}`);
  const quote=await qRes.json();
  const signature=await sendSplToken({provider,to:vaultAddress,mint:usdcMint,amount:quote.total,decimals:6,rpc});
  const wallet=provider.publicKey.toString();
  const r=await fetch(`/api/markets/${encodeURIComponent(marketId)}/trade-chain`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({side,shares,signature,wallet,trader:trader||wallet})});
  if(!r.ok) throw new Error(`chain_trade_failed:${await r.text()}`);
  return await r.json();
}

export async function signSerializedTransaction({provider,transactionBase64}){
  if(!provider?.signTransaction) throw new Error('wallet_sign_transaction_not_supported');
  const {VersionedTransaction}=await w3();
  const raw=Uint8Array.from(atob(transactionBase64),c=>c.charCodeAt(0));
  const tx=VersionedTransaction.deserialize(raw);
  const signed=await provider.signTransaction(tx);
  const bytes=signed.serialize(); let s=''; for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s);
}

export function detectSolanaWalletProvider(){
  const p=window.phantom?.solana||window.solana;
  const name=p?.isPhantom?'Phantom':(p?'Solana Wallet':'Not detected');
  return {name,available:!!p,connected:!!p?.isConnected,publicKey:p?.publicKey?.toString?.()||null,provider:p||null};
}

export async function readWalletPortfolio({owner,rpc='https://api.mainnet-beta.solana.com',usdcMint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',prestocks=[]}={}){
  const {Connection,PublicKey,LAMPORTS_PER_SOL}=await w3();
  const {TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID}=await st();
  const address=owner||detectSolanaWalletProvider().publicKey;
  if(!address) throw new Error('wallet_not_connected');
  const connection=new Connection(rpc,'confirmed'), ownerPk=new PublicKey(address);
  const [lamports,classic,v2022]=await Promise.all([
    connection.getBalance(ownerPk,'confirmed'),
    connection.getParsedTokenAccountsByOwner(ownerPk,{programId:TOKEN_PROGRAM_ID},'confirmed'),
    connection.getParsedTokenAccountsByOwner(ownerPk,{programId:TOKEN_2022_PROGRAM_ID},'confirmed').catch(()=>({value:[]}))
  ]);
  const wanted=new Map(prestocks.map(x=>[String(x.contract_address||x.mint),x]));
  const tokens=[];
  for(const row of [...(classic.value||[]),...(v2022.value||[])]){
    const info=row.account?.data?.parsed?.info||{}, mint=String(info.mint||''), amount=info.tokenAmount||{};
    const ui=Number(amount.uiAmountString??amount.uiAmount??0);
    if(ui<=0) continue;
    tokens.push({mint,amount:ui,decimals:Number(amount.decimals||0),account:row.pubkey?.toString?.()||''});
  }
  const usdc=tokens.find(x=>x.mint===usdcMint)?.amount||0;
  const prestockHoldings=tokens.filter(x=>wanted.has(x.mint)).map(x=>{const a=wanted.get(x.mint);return {...x,symbol:a.symbol,name:a.name,image:a.image,tokenPrice:Number(a.tokenPrice||0),estimatedValueUSDC:Number(a.tokenPrice||0)*x.amount}});
  return {address,network:'solana-mainnet',sol:Number(lamports)/LAMPORTS_PER_SOL,usdc,tokens,prestocks:prestockHoldings,provider:detectSolanaWalletProvider().name};
}

export function onWalletAccountChanged(handler){
  const p=window.phantom?.solana||window.solana;
  if(!p?.on) return ()=>{};
  const fn=pk=>handler?.(pk?.toString?.()||null);
  p.on('accountChanged',fn);
  return ()=>p.removeListener?.('accountChanged',fn);
}
