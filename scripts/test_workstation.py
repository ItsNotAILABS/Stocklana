import re, pathlib, importlib.util
ROOT=pathlib.Path(__file__).resolve().parents[1]
h=(ROOT/'index.html').read_text(encoding='utf-8')
nav=set(re.findall(r'data-nav="([^"]+)"',h)); views=set(re.findall(r'id="view-([^"]+)"',h))
missing=nav-views
assert not missing, f'missing views: {missing}'
assert {'markets','lab','vault','portfolio','agents','launch','infrastructure','coverage'} <= views
spec=importlib.util.spec_from_file_location('iso',ROOT/'src'/'iso20022_bridge.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
ids=set()
for i in range(100):
 p=m.pain001(f'@payer{i}',f'@payee{i}',i+1,'USDC',f'invoice-{i}','solana' if i%2 else 'internal')
 c=m.pacs008(p,f'sig-{i}'); r=m.remt001(p)
 assert p['message']=='pain.001' and c['message']=='pacs.008' and r['message']=='remt.001'
 assert p['messageId'] not in ids; ids.add(p['messageId'])
print(f'PASS navigation {len(nav)} targets -> {len(views)} views; ISO20022 100/100 translations')
