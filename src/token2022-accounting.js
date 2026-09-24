// Stocklana V2 — wallet-signed Token-2022 builders for typed financial receipts.
// The internal double-entry ledger remains the accounting source of truth.
let web3, spl;
async function w3(){ if(!web3) web3=await import('https://esm.sh/@solana/web3.js@1.98.4'); return web3; }
async function st(){ if(!spl) spl=await import('https://esm.sh/@solana/spl-token@0.4.14'); return spl; }

export const TOKEN_2022_CLASSES = Object.freeze({
  'SL-ESCROW': {decimals:6, extensions:['MetadataPointer','NonTransferable'], transfer:'program-only'},
  'SL-COLL': {decimals:6, extensions:['MetadataPointer','NonTransferable'], transfer:'program-only'},
  'SL-CREDIT': {decimals:6, extensions:['MetadataPointer','NonTransferable'], transfer:'program-only'},
  'SL-AGENT': {decimals:6, extensions:['MetadataPointer','NonTransferable'], transfer:'non-transferable'},
  'SL-POS': {decimals:6, extensions:['MetadataPointer','TransferHook'], transfer:'policy-hook'},
  'SL-BASKET': {decimals:9, extensions:['MetadataPointer','TransferHook'], transfer:'policy-hook'}
});

const extType = (spl, name) => ({
  MetadataPointer:spl.ExtensionType.MetadataPointer,
  NonTransferable:spl.ExtensionType.NonTransferable,
  TransferHook:spl.ExtensionType.TransferHook,
}[name]);

export async function buildTypedMintTransaction({connection,payer,symbol,mintAuthority,freezeAuthority=null,hookProgramId=null}){
  const {Keypair,SystemProgram,Transaction,PublicKey}=await w3();
  const s=await st();
  const spec=TOKEN_2022_CLASSES[symbol]; if(!spec) throw new Error('unsupported_stocklana_token_class');
  const mint=Keypair.generate();
  const extensionTypes=spec.extensions.map(x=>extType(s,x));
  const mintLen=s.getMintLen(extensionTypes);
  const lamports=await connection.getMinimumBalanceForRentExemption(mintLen);
  const tx=new Transaction();
  tx.add(SystemProgram.createAccount({fromPubkey:new PublicKey(payer),newAccountPubkey:mint.publicKey,space:mintLen,lamports,programId:s.TOKEN_2022_PROGRAM_ID}));
  if(spec.extensions.includes('MetadataPointer')) tx.add(s.createInitializeMetadataPointerInstruction(mint.publicKey,new PublicKey(mintAuthority),mint.publicKey,s.TOKEN_2022_PROGRAM_ID));
  if(spec.extensions.includes('NonTransferable')) tx.add(s.createInitializeNonTransferableMintInstruction(mint.publicKey,s.TOKEN_2022_PROGRAM_ID));
  if(spec.extensions.includes('TransferHook')){
    if(!hookProgramId) throw new Error('transfer_hook_program_required');
    tx.add(s.createInitializeTransferHookInstruction(mint.publicKey,new PublicKey(mintAuthority),new PublicKey(hookProgramId),s.TOKEN_2022_PROGRAM_ID));
  }
  tx.add(s.createInitializeMintInstruction(mint.publicKey,spec.decimals,new PublicKey(mintAuthority),freezeAuthority?new PublicKey(freezeAuthority):null,s.TOKEN_2022_PROGRAM_ID));
  tx.feePayer=new PublicKey(payer); tx.recentBlockhash=(await connection.getLatestBlockhash()).blockhash;
  return {transaction:tx,mintSigner:mint,mint:mint.publicKey.toString(),symbol,spec};
}

export async function createTypedMintWithWallet({provider,symbol,mintAuthority,hookProgramId=null,rpc='https://api.mainnet-beta.solana.com'}){
  if(!provider?.publicKey||!provider?.signTransaction) throw new Error('solana_wallet_not_connected');
  const {Connection}=await w3(); const connection=new Connection(rpc,'confirmed');
  const plan=await buildTypedMintTransaction({connection,payer:provider.publicKey.toString(),symbol,mintAuthority:mintAuthority||provider.publicKey.toString(),hookProgramId});
  plan.transaction.partialSign(plan.mintSigner);
  const signed=await provider.signTransaction(plan.transaction);
  const signature=await connection.sendRawTransaction(signed.serialize()); await connection.confirmTransaction(signature,'confirmed');
  return {mint:plan.mint,signature,symbol,spec:plan.spec};
}

export function explainTypedMint(symbol){
  const x=TOKEN_2022_CLASSES[symbol]; if(!x) throw new Error('unsupported_stocklana_token_class');
  return {symbol,...x,program:'Token-2022',sourceOfTruth:'Stocklana double-entry accounting + backing inventory'};
}
