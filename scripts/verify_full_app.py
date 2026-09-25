#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
css=(root/'src'/'styles.css').read_text()
app=(root/'src'/'app.js').read_text()
server=(root/'server.py').read_text()
snapshot=(root/'data'/'prestocks-snapshot.json').read_text()
package=json.loads((root/'package.json').read_text())

views=['home','markets','play','lab','cmesh','launch','wallet','commerce','vault','portfolio','credit','agents','infrastructure','coverage']
checks={
 'all_views_present': all(f'id="view-{v}"' in html for v in views),
 'approved_home_visual': 'heroOrbitCanvas' in html and 'Your money shouldn’t' in html,
 'full_surface_visual_system': 'surface-motion.js' in html and 'FULL APP SURFACE WORLDS' in css,
 'native_action_sheet': 'id="actionDialog"' in html and 'async function actionSheet(' in app,
 'no_browser_prompts': not re.search(r'\b(prompt|confirm)\s*\(',app),
 'cmesh_solo_surface': 'id="view-cmesh"' in html and 'NOT A PRESTOCK' in html,
 'cmesh_excluded_from_prestocks': 'CMESH' not in snapshot.upper() and 'ciphermesh' not in snapshot.lower(),
 'cmesh_runtime_config': 'STOCKLANA_CMESH_ADDRESS' in server,
 'production_api_origin': 'STOCKLANA_RUNTIME?.apiOrigin' in app and 'STOCKLANA_CORS_ORIGIN' in server,
 'browser_only_permanent_build': "browserFiles=" in (root/'scripts'/'build_static_release.mjs').read_text(),
 'solana_deploy_command': package['scripts'].get('deploy:program:solana')=='bash scripts/deploy_solana_mainnet.sh',
 'permanent_frontend_command': package['scripts'].get('deploy:frontend:solana')=='node scripts/deploy_permaweb_solana.mjs',
 'release_cost_preflight': package['scripts'].get('release:preflight')=='bash scripts/release_preflight.sh',
 'api_container': (root/'Dockerfile').exists() and (root/'railway.json').exists(),
}
ok=all(checks.values())
receipt={'status':'PASS' if ok else 'FAIL','checks':checks,'views':views,'note':'Static/product certification. External chain/provider actions still require their authoritative receipts.'}
(root/'FULL-APP-CERTIFICATION.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt,indent=2))
sys.exit(0 if ok else 1)
