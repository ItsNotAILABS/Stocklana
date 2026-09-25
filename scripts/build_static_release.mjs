#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..', import.meta.url).pathname);
const out=path.join(root,'dist');
const apiOrigin=(process.env.STOCKLANA_PUBLIC_API_ORIGIN||'').replace(/\/$/,'');
const files=['index.html','runtime-config.js'];
const browserFiles=['src/app-three.js','src/app.js','src/demo-reel.js','src/market-engine.js','src/meteora-dbc.js','src/oracle-policy.js','src/pons-v2.js','src/prestocks-registry.js','src/solana-client.js','src/stocklana-hero.js','src/stocklana-program-client.js','src/styles.css','src/surface-motion.js','src/systems.js','src/token2022-accounting.js'];

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

for(const f of files) fs.copyFileSync(path.join(root,f),path.join(out,f));
fs.mkdirSync(path.join(out,'src'),{recursive:true});
for(const f of browserFiles){
  const from=path.join(root,f),to=path.join(out,f);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
}

const runtime=`window.STOCKLANA_RUNTIME = Object.freeze({
  apiOrigin: ${JSON.stringify(apiOrigin)},
  network: "solana-hybrid",
  release: "permanent-web"
});
`;
fs.writeFileSync(path.join(out,'runtime-config.js'),runtime);
fs.writeFileSync(path.join(out,'404.html'),fs.readFileSync(path.join(out,'index.html')));

const meta={
  builtAt:new Date().toISOString(),
  apiOrigin,
  network:'solana-hybrid',
  frontendModel:'static-permanent-web',
  publicFiles:[...files,...browserFiles],
  note:'Solana program execution and permanent frontend storage are separate deployment receipts.'
};
fs.writeFileSync(path.join(out,'release.json'),JSON.stringify(meta,null,2));
console.log(JSON.stringify({ok:true,out,files:fs.readdirSync(out),apiOrigin},null,2));
