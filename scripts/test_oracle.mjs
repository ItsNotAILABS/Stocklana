import {compileThresholdPolicy,evaluateThreshold} from '../src/oracle-policy.js';
const p=compileThresholdPolicy({symbol:'OPENAI',underlyingMint:'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',targetBillions:1400,resolveAt:'2027-06-30'});
if(evaluateThreshold(p,{impliedValuation:1.41e12})!=='YES') throw new Error('yes failed');
if(evaluateThreshold(p,{impliedValuation:1.39e12})!=='NO') throw new Error('no failed');
console.log('PASS oracle threshold policy');
