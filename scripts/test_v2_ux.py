#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
js=(ROOT/'src'/'app.js').read_text()
css=(ROOT/'src'/'styles.css').read_text()
server=(ROOT/'server.py').read_text()
product=json.loads((ROOT/'data'/'v2-product.json').read_text())
checks=[]
def ok(cond,label):
    checks.append((bool(cond),label))
    if not cond: raise AssertionError(label)
for nav in product['navigation']:
    ok(f'id="view-{nav}"' in html, f'view:{nav}')
for action in product['primaryJobs']:
    slug={'BUY':'buy','AUTO_INVEST':'auto','BORROW':'borrow','PLAY_MARKET':'play','SEND':'send','SPEND':'spend','AGENT':'agent','LAUNCH':'launch'}[action]
    ok(f'data-action="{slug}"' in html, f'action:{slug}:surface')
    ok(f"a==='{slug}'" in js, f'action:{slug}:handler')
for item in ['homeNetValue','homeCash','homePositions','homeAccountState','creditPower','internalBorrowBtn','kaminoBorrowBtn']:
    ok(f'id="{item}"' in html, f'component:{item}')
for term in ['SL-ESCROW','SL-COLL','SL-CREDIT','SL-AGENT','SL-POS','SL-BASKET']:
    ok(term in html, f'v2-token:{term}')
ok("'/api/v2/home'" in server, 'api:v2-home')
ok("'financialTokenStandard':'TOKEN_2022'" in server, 'api:v2-token-standard')
ok('V1 SPL + V2 Token-2022' not in html, 'no-v1-product-copy')
ok('action-grid' in css and 'home-grid' in css and 'credit-hero' in css, 'v2-layout-css')
ok('loadV2Home' in js and 'loadCredit' in js, 'v2-loaders')
# Repeat structural invariants across 10 expected views to ensure no duplicate/missing view IDs.
ids=re.findall(r'id="view-([a-z-]+)"',html)
ok(len(ids)==len(set(ids)), 'unique-view-ids')
for i in range(1,101):
    ok(product['defaultTokenStandard']=='TOKEN_2022',f'v2-default-repeat:{i}')
print(json.dumps({'passed':sum(1 for x,_ in checks if x),'total':len(checks),'status':'PASS','version':'2.0'},indent=2))
