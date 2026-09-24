let sdk,web3,bn;
async function deps(){
  if(!web3) web3=await import('https://esm.sh/@solana/web3.js@1.98.4');
  if(!sdk) sdk=await import('https://esm.sh/@meteora-ag/dynamic-bonding-curve-sdk@1.5.11?deps=@solana/web3.js@1.98.4');
  if(!bn) bn=(await import('https://esm.sh/bn.js@5.2.2')).default;
  return {sdk,web3,BN:bn};
}
export const METEORA_DBC_PROGRAM='dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
export async function buildStockQuotedConfig({connection,payer,quoteMint,feeClaimer=payer,leftoverReceiver=payer,initialMarketCap=20,migrationMarketCap=600,creatorFeePct=50}){
  const {sdk:s,web3:w}=await deps(); const {Keypair,PublicKey}=w;
  const client=new s.DynamicBondingCurveClient(connection,'confirmed');
  const curve=s.buildCurveWithMarketCap({
    token:{tokenType:s.TokenType.SPLToken,tokenBaseDecimal:s.TokenDecimal.SIX,tokenQuoteDecimal:s.TokenDecimal.SIX,tokenAuthorityOption:s.TokenAuthorityOption.Immutable,totalTokenSupply:1_000_000_000,leftover:0},
    fee:{baseFeeParams:{baseFeeMode:s.BaseFeeMode.FeeSchedulerLinear,feeSchedulerParam:{startingFeeBps:100,endingFeeBps:100,numberOfPeriod:0,totalDuration:0}},dynamicFeeEnabled:true,collectFeeMode:s.CollectFeeMode.QuoteToken,creatorTradingFeePercentage:creatorFeePct,poolCreationFee:0,enableFirstSwapWithMinFee:false},
    migration:{migrationOption:s.MigrationOption.MET_DAMM_V2,migrationFeeOption:s.MigrationFeeOption.FixedBps200,migrationFee:{feePercentage:0,creatorFeePercentage:0}},
    liquidityDistribution:{partnerLiquidityPercentage:45,partnerPermanentLockedLiquidityPercentage:5,creatorLiquidityPercentage:40,creatorPermanentLockedLiquidityPercentage:10},
    lockedVesting:{totalLockedVestingAmount:0,numberOfVestingPeriod:0,cliffUnlockAmount:0,totalVestingDuration:0,cliffDurationFromMigrationTime:0},
    activationType:s.ActivationType.Timestamp,initialMarketCap,migrationMarketCap
  });
  const config=Keypair.generate();
  const tx=await client.partner.createConfig({config:config.publicKey,feeClaimer:new PublicKey(feeClaimer),leftoverReceiver:new PublicKey(leftoverReceiver),payer:new PublicKey(payer),quoteMint:new PublicKey(quoteMint),...curve});
  tx.partialSign(config); return {transaction:tx,config:config.publicKey.toBase58(),quoteMint,programId:METEORA_DBC_PROGRAM,migration:'DAMM_V2',curve};
}
export async function buildPool({connection,payer,poolCreator=payer,config,name,symbol,uri}){
  const {sdk:s,web3:w}=await deps(); const baseMint=w.Keypair.generate(),client=new s.DynamicBondingCurveClient(connection,'confirmed');
  const tx=await client.creator.createPool({name,symbol,uri,payer:new w.PublicKey(payer),poolCreator:new w.PublicKey(poolCreator),config:new w.PublicKey(config),baseMint:baseMint.publicKey});
  tx.partialSign(baseMint); return {transaction:tx,baseMint:baseMint.publicKey.toBase58(),config};
}
export async function quoteBuy({connection,baseMint,amountIn,slippageBps=100}){
  const {sdk:s,BN}=await deps(); const client=new s.DynamicBondingCurveClient(connection,'confirmed'),p=await client.state.getPoolByBaseMint(baseMint);if(!p)throw new Error('dbc pool not found');const v=await client.state.getPool(p.publicKey),c=await client.state.getPoolConfig(v.poolState.config),slot=await connection.getSlot(),t=await connection.getBlockTime(slot);return client.pool.swapQuote({virtualPool:v,config:c,swapBaseForQuote:false,amountIn:new BN(String(amountIn)),slippageBps,hasReferral:false,currentPoint:new BN(String(t)),eligibleForFirstSwapWithMinFee:false});
}
export async function buildBuy({connection,owner,baseMint,amountIn,slippageBps=100}){const {sdk:s,web3:w,BN}=await deps();const client=new s.DynamicBondingCurveClient(connection,'confirmed'),p=await client.state.getPoolByBaseMint(baseMint);if(!p)throw new Error('dbc pool not found');const q=await quoteBuy({connection,baseMint,amountIn,slippageBps});const transaction=await client.pool.swap({owner:new w.PublicKey(owner),pool:p.publicKey,amountIn:new BN(String(amountIn)),minimumAmountOut:q.minimumAmountOut,swapBaseForQuote:false,referralTokenAccount:null});return {transaction,quote:q,pool:p.publicKey.toBase58()}}
