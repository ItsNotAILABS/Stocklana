const M=require('../src/market-engine.cjs');
const m=M.create({id:'openai-1500',underlyingMint:'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',symbol:'OPENAI',question:'OpenAI implied valuation >= $1.5T?',resolveAt:'2026-12-31T23:59:59Z',liquidity:1000});
if(Math.abs(M.probability(m)-.5)>1e-9) throw Error('initial probability');
const q=M.trade(m,'YES',100,'wallet-a');
if(!(q.total>0 && M.probability(m)>.5)) throw Error('trade/pricing');
M.resolve(m,'YES',{source:'PreStocks',field:'impliedValuation',value:1600000000000});
const r=M.redeem(m,{yes:100,no:0}); if(r.payout!==100) throw Error('redeem');
console.log('PASS create -> fund/liquidity -> trade -> price -> resolve -> redeem');
