#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..', import.meta.url).pathname);
const out=path.join(root,'dist');
const apiOrigin=(process.env.STOCKLANA_PUBLIC_API_ORIGIN||'').replace(/\/$/,'');
const files=['index.html','runtime-config.js'];
const dirs=['src'];

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

for(const f of files) fs.copyFileSync(path.join(root,f),path.join(out,f));
for(const d of dirs) fs.cpSync(path.join(root,d),path.join(out,d),{recursive:true});

const runtime=`window.STOCKLANA_RUNTIME = Object.freeze({
  apiOrigin: ${JSON.stringify(apiOrigin)},
  network: "solana-mainnet",
  release: "permanent-web"
});
`;
fs.writeFileSync(path.join(out,'runtime-config.js'),runtime);
fs.writeFileSync(path.join(out,'404.html'),fs.readFileSync(path.join(out,'index.html')));

const meta={
  builtAt:new Date().toISOString(),
  apiOrigin,
  network:'solana-mainnet',
  frontendModel:'static-permanent-web',
  note:'Solana program execution and permanent frontend storage are separate deployment receipts.'
};
fs.writeFileSync(path.join(out,'release.json'),JSON.stringify(meta,null,2));
console.log(JSON.stringify({ok:true,out,files:fs.readdirSync(out),apiOrigin},null,2));
