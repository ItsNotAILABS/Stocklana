#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import bs58 from 'bs58';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { ARIO, ANT } from '@ar.io/sdk';
import { createKeyPairSignerFromBytes } from '@solana/kit';

const root=path.resolve(new URL('..', import.meta.url).pathname);
const dist=path.join(root,'dist');
const keyPath=process.env.SOLANA_KEYPAIR_PATH || path.join(process.env.HOME||'','.config','solana','id.json');
if(!fs.existsSync(dist)) throw new Error('dist_missing_run_npm_run_build_static_first');
if(!fs.existsSync(keyPath)) throw new Error(`solana_keypair_missing:${keyPath}`);

const raw=JSON.parse(fs.readFileSync(keyPath,'utf8'));
const secretKey=new Uint8Array(raw);
if(secretKey.length!==64) throw new Error('expected_64_byte_solana_keypair');
const turbo=TurboFactory.authenticated({privateKey:bs58.encode(secretKey.slice(0,32)),token:'solana'});
const signer=await createKeyPairSignerFromBytes(secretKey);
const ario=ARIO.mainnet({signer});

console.log('Uploading Stocklana permanent frontend with Solana wallet authentication...');
const result=await turbo.uploadFolder({
  folderPath:dist,
  dataItemOpts:{tags:[
    {name:'App-Name',value:'Stocklana'},
    {name:'App-Network',value:'Solana'},
    {name:'App-Lane',value:'Programmable-PreStocks'}
  ]},
  manifestOptions:{indexFile:'index.html',fallbackFile:'404.html'}
});
const manifestId=result.manifestResponse?.id || result.manifestId || null;
if(!manifestId) throw new Error('manifest_id_missing_after_upload');

const receipt={
  type:'StocklanaPermanentFrontend/v1',
  deployedAt:new Date().toISOString(),
  paymentToken:'SOL',
  manifestId,
  gatewayUrl:`https://arweave.net/${manifestId}`,
  fileCount:result.fileResponses?.length ?? null,
  note:'Frontend stored on Arweave via Turbo using a Solana deployment wallet. This receipt is distinct from the Solana program deployment receipt.'
};
const dir=path.join(root,'deployments');fs.mkdirSync(dir,{recursive:true});
const name=`frontend-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
const arnsName=String(process.env.STOCKLANA_ARNS_NAME||'').trim();
if(arnsName){
  console.log(`Updating existing ArNS name "${arnsName}" to the new manifest...`);
  const record=await ario.getArNSRecord({name:arnsName});
  if(!record?.processId) throw new Error('arns_record_missing_process_id');
  const ant=ANT.init({signer,processId:record.processId});
  await ant.setRecord({undername:'@',transactionId:manifestId,ttlSeconds:3600});
  receipt.arnsName=arnsName;
  receipt.arnsUrl=`https://${arnsName}.ar.io`;
}
fs.writeFileSync(path.join(dir,name),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
