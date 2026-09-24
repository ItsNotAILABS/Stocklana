// Deterministic settlement policy compiler. Keeps resolution rules machine-readable.
export function compileThresholdPolicy({symbol,underlyingMint,targetBillions,resolveAt,priceField='impliedValuation'}){
  if(!symbol||!underlyingMint||!(Number(targetBillions)>0)||!resolveAt) throw new Error('invalid_policy');
  return {version:1,type:'PRESTOCK_VALUATION_THRESHOLD',symbol,underlyingMint,metric:priceField,operator:'GT',thresholdUsd:Number(targetBillions)*1e9,resolveAt,sources:['PreStocks','Pyth'],fallback:'MANUAL_ATTESTATION_WITH_RECEIPT'};
}
export function evaluateThreshold(policy,{impliedValuation}){
  if(policy.type!=='PRESTOCK_VALUATION_THRESHOLD') throw new Error('unsupported_policy');
  if(!Number.isFinite(Number(impliedValuation))) throw new Error('missing_observation');
  return Number(impliedValuation)>Number(policy.thresholdUsd)?'YES':'NO';
}
export function settlementReceipt(policy,observation){
  const outcome=evaluateThreshold(policy,observation);
  return {policy,outcome,observation,settledAt:new Date().toISOString(),receiptVersion:1};
}
