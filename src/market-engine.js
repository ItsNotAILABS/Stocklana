/* Stocklana binary market engine: deterministic LMSR pricing + lifecycle.
   This module is shared by the mobile UI and API tests. */
(function(root,factory){ if(typeof module==='object'&&module.exports) module.exports=factory(); else root.StocklanaMarket=factory(); })(typeof self!=='undefined'?self:this,function(){
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const lse=(a,b)=>{ const m=Math.max(a,b); return m+Math.log(Math.exp(a-m)+Math.exp(b-m)); };
  function cost(qYes,qNo,b){ return b*lse(qYes/b,qNo/b); }
  function probability(qYes,qNo,b){ const y=Math.exp(qYes/b), n=Math.exp(qNo/b); return y/(y+n); }
  function quote(market,side,shares){
    if(market.status!=='OPEN') throw new Error('market_not_open');
    shares=Number(shares); if(!(shares>0)) throw new Error('invalid_shares');
    const before=cost(market.qYes,market.qNo,market.b);
    const qYes=market.qYes+(side==='YES'?shares:0), qNo=market.qNo+(side==='NO'?shares:0);
    const after=cost(qYes,qNo,market.b); const fee=(after-before)*(market.feeBps/10000);
    return {side,shares,collateral:after-before,fee,total:(after-before)+fee,probabilityAfter:probability(qYes,qNo,market.b)};
  }
  function create(input){
    if(!input.id||!input.underlyingMint||!input.question||!input.resolveAt) throw new Error('missing_market_fields');
    const b=clamp(Number(input.liquidity||1000),10,1e9);
    return {id:input.id,underlyingMint:input.underlyingMint,symbol:input.symbol,question:input.question,rule:input.rule||{},resolveAt:input.resolveAt,collateralMint:input.collateralMint||'USDC',b,feeBps:Number(input.feeBps||100),qYes:0,qNo:0,collateral:0,fees:0,status:'OPEN',outcome:null,volume:0,trades:[]};
  }
  function trade(market,side,shares,trader){ const q=quote(market,side,shares); market.qYes+=side==='YES'?q.shares:0; market.qNo+=side==='NO'?q.shares:0; market.collateral+=q.collateral; market.fees+=q.fee; market.volume+=q.total; market.trades.push({trader,side,...q,at:new Date().toISOString()}); return q; }
  function resolve(market,outcome,proof){ if(market.status!=='OPEN') throw new Error('market_not_open'); if(!['YES','NO'].includes(outcome)) throw new Error('invalid_outcome'); market.status='RESOLVED'; market.outcome=outcome; market.proof=proof||null; market.resolvedAt=new Date().toISOString(); return market; }
  function redeem(market,position){ if(market.status!=='RESOLVED') throw new Error('market_not_resolved'); const winning=market.outcome==='YES'?Number(position.yes||0):Number(position.no||0); return {winningShares:winning,payout:winning}; }
  return {create,quote,trade,resolve,redeem,probability:(m)=>probability(m.qYes,m.qNo,m.b)};
});
