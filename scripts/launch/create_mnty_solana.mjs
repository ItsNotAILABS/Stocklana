#!/usr/bin/env node
import fs from 'node:fs';
import {Connection,Keypair,PublicKey} from '@solana/web3.js';
import {TOKEN_2022_PROGRAM_ID,ExtensionType,getMintLen,createInitializeTransferFeeConfigInstruction,createInitializeMintInstruction,createAssociatedTokenAccountInstruction,getAssociatedTokenAddressSync,createMintToCheckedInstruction,createSetAuthorityInstruction,AuthorityType} from '@solana/spl-token';
import {SystemProgram,Transaction,sendAndConfirmTransaction} from '@solana/web3.js';
const rpc=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',kpPath=process.env.SOLANA_KEYPAIR;
if(!kpPath)throw new Error('Set SOLANA_KEYPAIR to a signer JSON file. No keys are embedded.');
const payer=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath,'utf8')))),mint=Keypair.generate(),connection=new Connection(rpc,'confirmed');
const decimals=Number(process.env.MNTY_DECIMALS||9),whole=BigInt(process.env.MNTY_SUPPLY||'1000000000'),feeBps=Number(process.env.MNTY_TRANSFER_FEE_BPS||0),maxFee=BigInt(process.env.MNTY_MAX_TRANSFER_FEE_BASE_UNITS||0);
const exts=feeBps>0?[ExtensionType.TransferFeeConfig]:[],space=getMintLen(exts),rent=await connection.getMinimumBalanceForRentExemption(space),tx=new Transaction();
tx.add(SystemProgram.createAccount({fromPubkey:payer.publicKey,newAccountPubkey:mint.publicKey,space,lamports:rent,programId:TOKEN_2022_PROGRAM_ID}));
if(feeBps>0)tx.add(createInitializeTransferFeeConfigInstruction(mint.publicKey,payer.publicKey,payer.publicKey,feeBps,maxFee,TOKEN_2022_PROGRAM_ID));
tx.add(createInitializeMintInstruction(mint.publicKey,decimals,payer.publicKey,null,TOKEN_2022_PROGRAM_ID));
const ata=getAssociatedTokenAddressSync(mint.publicKey,payer.publicKey,false,TOKEN_2022_PROGRAM_ID);tx.add(createAssociatedTokenAccountInstruction(payer.publicKey,ata,payer.publicKey,mint.publicKey,TOKEN_2022_PROGRAM_ID));
const amount=whole*(10n**BigInt(decimals));tx.add(createMintToCheckedInstruction(mint.publicKey,ata,payer.publicKey,amount,decimals,[],TOKEN_2022_PROGRAM_ID));
tx.add(createSetAuthorityInstruction(mint.publicKey,payer.publicKey,AuthorityType.MintTokens,null,[],TOKEN_2022_PROGRAM_ID));
const sig=await sendAndConfirmTransaction(connection,tx,[payer,mint],{commitment:'confirmed'});console.log(JSON.stringify({network:rpc,mint:mint.publicKey.toBase58(),owner:payer.publicKey.toBase58(),supply:whole.toString(),decimals,transferFeeBps:feeBps,signature:sig,mintAuthorityRevoked:true},null,2));
