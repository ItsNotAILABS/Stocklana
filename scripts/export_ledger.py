#!/usr/bin/env python3
import csv, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
finance=json.loads((ROOT/'data'/'finance.json').read_text()) if (ROOT/'data'/'finance.json').exists() else {}
markets=json.loads((ROOT/'data'/'markets.json').read_text()) if (ROOT/'data'/'markets.json').exists() else {}
rows=[]
for r in finance.get('receipts',[]):
    rows.append({'time':r.get('at'),'class':'receipt','id':r.get('id'),'marketId':'','actor':r.get('actor'),'kind':r.get('kind'),'amount':'','asset':'','chainSignature':'','commitment':r.get('commitment'),'prevCommitment':r.get('prevCommitment')})
for m in (markets.get('markets') or {}).values():
    for i,t in enumerate(m.get('trades') or []):
        rows.append({'time':t.get('at'),'class':'market_trade','id':f"{m['id']}:trade:{i}",'marketId':m['id'],'actor':t.get('trader'),'kind':t.get('side'),'amount':t.get('total'),'asset':'USDC','chainSignature':t.get('chainSignature',''),'commitment':'','prevCommitment':''})
rows.sort(key=lambda x:(x.get('time') or 0,str(x.get('id'))))
out=ROOT/'public'/'ledger.csv'; out.parent.mkdir(exist_ok=True)
with out.open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys()) if rows else ['time','class','id','marketId','actor','kind','amount','asset','chainSignature','commitment','prevCommitment']); w.writeheader(); w.writerows(rows)
(ROOT/'public'/'ledger.json').write_text(json.dumps({'rows':rows,'count':len(rows)},indent=2))
print(out, len(rows))
