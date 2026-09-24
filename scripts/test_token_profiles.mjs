import {TOKEN_2022_CLASSES, explainTypedMint} from '../src/token2022-accounting.js';
let n=0;const ok=(x,m='assertion')=>{if(!x)throw new Error(m);n++};
ok(Object.keys(TOKEN_2022_CLASSES).length===6,'six public V2 Token-2022 classes');
for(const s of ['SL-ESCROW','SL-COLL','SL-CREDIT','SL-AGENT']){ok(TOKEN_2022_CLASSES[s].extensions.includes('NonTransferable'),s+' nontransferable')}
for(const s of ['SL-POS','SL-BASKET']){ok(TOKEN_2022_CLASSES[s].extensions.includes('TransferHook'),s+' transfer hook')}
for(const s of Object.keys(TOKEN_2022_CLASSES)){const x=explainTypedMint(s);ok(x.program==='Token-2022',s+' program');ok(x.sourceOfTruth.includes('double-entry'),s+' source of truth')}
console.log(`PASS V2 Token-2022 profiles assertions=${n}`);
