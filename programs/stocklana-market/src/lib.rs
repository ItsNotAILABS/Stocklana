use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo}, clock::Clock, entrypoint, entrypoint::ProgramResult,
    msg, program::{invoke, invoke_signed}, program_error::ProgramError, program_pack::Pack,
    pubkey::Pubkey, rent::Rent, system_instruction, system_program, sysvar::Sysvar,
};
use spl_token::state::Account as TokenAccount;

entrypoint!(process_instruction);
const MARKET_SPACE: usize = 256;
const POSITION_SPACE: usize = 160;
const USDC: Pubkey = Pubkey::new_from_array([198,250,122,243,190,219,173,58,61,101,243,106,171,201,116,49,177,187,228,194,210,246,224,228,124,166,2,3,69,47,93,97]);
const PRESTOCKS: [Pubkey;8] = [
 Pubkey::new_from_array([5,218,235,169,8,246,31,160,82,12,16,107,95,129,151,121,66,250,45,231,240,69,51,252,70,69,89,48,21,119,173,184]),
 Pubkey::new_from_array([5,218,235,48,215,226,94,128,12,115,252,236,93,217,103,190,72,108,70,10,131,170,157,224,135,242,177,61,114,71,79,90]),
 Pubkey::new_from_array([5,218,234,31,38,234,74,224,158,225,207,196,202,103,26,38,107,128,122,254,175,218,186,71,8,211,253,29,99,241,200,106]),
 Pubkey::new_from_array([5,218,232,255,35,71,133,36,81,22,168,143,40,19,23,203,48,181,160,17,13,112,224,147,175,227,225,152,247,224,86,105]),
 Pubkey::new_from_array([5,218,235,23,11,215,147,79,110,119,189,10,193,223,140,206,111,35,6,59,173,12,163,50,66,56,5,146,247,19,235,33]),
 Pubkey::new_from_array([5,218,236,5,41,229,43,191,103,246,255,30,20,106,158,182,172,231,252,78,163,28,164,188,159,21,225,15,227,113,151,40]),
 Pubkey::new_from_array([5,218,231,239,67,81,176,50,25,200,81,185,137,102,79,151,40,126,136,168,62,255,45,196,238,51,51,168,153,204,174,120]),
 Pubkey::new_from_array([5,218,232,32,21,102,9,51,246,105,125,200,243,40,169,75,117,142,252,60,241,225,146,92,31,59,16,28,133,95,165,148]),
];

#[derive(BorshSerialize,BorshDeserialize,Clone,Debug,PartialEq)]
pub enum Status { Open, Resolved }
#[derive(BorshSerialize,BorshDeserialize,Clone,Debug)]
pub struct MarketState {
 pub version:u8, pub authority:Pubkey, pub underlying_mint:Pubkey, pub collateral_mint:Pubkey,
 pub market_seed:u64, pub vault_bump:u8, pub resolve_at:i64, pub fee_bps:u16,
 pub yes_pool:u64, pub no_pool:u64, pub collateral:u64, pub fees:u64,
 pub status:Status, pub outcome_yes:bool, pub resolution_commitment:[u8;32],
}
#[derive(BorshSerialize,BorshDeserialize,Clone,Debug,Default)]
pub struct PositionState { pub owner:Pubkey,pub market:Pubkey,pub yes_stake:u64,pub no_stake:u64,pub redeemed:bool }
#[derive(BorshSerialize,BorshDeserialize,Debug)]
pub enum StocklanaIx {
 Initialize { market_seed:u64, resolve_at:i64, fee_bps:u16 },
 Buy { side_yes:bool, stake:u64 },
 TransferPosition { side_yes:bool, amount:u64 },
 Resolve { outcome_yes:bool, resolution_commitment:[u8;32] }, Redeem, WithdrawFees { amount:u64 },
}
fn load<T:BorshDeserialize>(a:&AccountInfo)->Result<T,ProgramError>{T::try_from_slice(&a.data.borrow()).map_err(|_|ProgramError::InvalidAccountData)}
fn store<T:BorshSerialize>(a:&AccountInfo,v:&T)->ProgramResult{v.serialize(&mut &mut a.data.borrow_mut()[..]).map_err(|_|ProgramError::AccountDataTooSmall)}
fn token(a:&AccountInfo)->Result<TokenAccount,ProgramError>{TokenAccount::unpack(&a.data.borrow()).map_err(|_|ProgramError::InvalidAccountData)}
fn check_prestock(m:&Pubkey)->ProgramResult{if PRESTOCKS.iter().any(|x|x==m){Ok(())}else{Err(ProgramError::InvalidArgument)}}
fn checked_fee(stake:u64,bps:u16)->Result<u64,ProgramError>{((stake as u128).checked_mul(bps as u128).ok_or(ProgramError::ArithmeticOverflow)?/10_000u128).try_into().map_err(|_|ProgramError::ArithmeticOverflow)}
fn ensure_position<'a>(program_id:&Pubkey,market:&AccountInfo<'a>,position:&AccountInfo<'a>,payer:&AccountInfo<'a>,owner:&AccountInfo<'a>,system:&AccountInfo<'a>)->ProgramResult{
 let (expected,bump)=Pubkey::find_program_address(&[b"position",market.key.as_ref(),owner.key.as_ref()],program_id);
 if expected!=*position.key{return Err(ProgramError::InvalidSeeds)}
 if position.owner==program_id && position.data_len()>=POSITION_SPACE{return Ok(())}
 if *position.owner!=system_program::id() || !payer.is_signer{return Err(ProgramError::IllegalOwner)}
 let rent=Rent::get()?;let lamports=rent.minimum_balance(POSITION_SPACE);
 invoke_signed(&system_instruction::create_account(payer.key,position.key,lamports,POSITION_SPACE as u64,program_id),&[payer.clone(),position.clone(),system.clone()],&[&[b"position",market.key.as_ref(),owner.key.as_ref(),&[bump]]])?;
 store(position,&PositionState{owner:*owner.key,market:*market.key,..Default::default()})
}

pub fn process_instruction(program_id:&Pubkey,accounts:&[AccountInfo],data:&[u8])->ProgramResult{
 let ix=StocklanaIx::try_from_slice(data).map_err(|_|ProgramError::InvalidInstructionData)?;let mut it=accounts.iter();
 match ix {
  StocklanaIx::Initialize{market_seed,resolve_at,fee_bps}=>{
   let authority=next_account_info(&mut it)?;let market=next_account_info(&mut it)?;let underlying=next_account_info(&mut it)?;let collateral=next_account_info(&mut it)?;let vault=next_account_info(&mut it)?;let vault_authority=next_account_info(&mut it)?;let fee_vault=next_account_info(&mut it)?;let fee_authority=next_account_info(&mut it)?;let system=next_account_info(&mut it)?;
   if !authority.is_signer || *system.key!=system_program::id() || fee_bps>1000 || resolve_at<=Clock::get()?.unix_timestamp{return Err(ProgramError::InvalidArgument)}
   check_prestock(underlying.key)?;if *collateral.key!=USDC{return Err(ProgramError::InvalidArgument)}
   let seed=market_seed.to_le_bytes();let (expected,mbump)=Pubkey::find_program_address(&[b"market",authority.key.as_ref(),&seed],program_id);if expected!=*market.key{return Err(ProgramError::InvalidSeeds)}
   if market.owner!=program_id{let rent=Rent::get()?;invoke_signed(&system_instruction::create_account(authority.key,market.key,rent.minimum_balance(MARKET_SPACE),MARKET_SPACE as u64,program_id),&[authority.clone(),market.clone(),system.clone()],&[&[b"market",authority.key.as_ref(),&seed,&[mbump]]])?;}
   let (va,vbump)=Pubkey::find_program_address(&[b"vault",market.key.as_ref()],program_id);if va!=*vault_authority.key{return Err(ProgramError::InvalidSeeds)}
   let v=token(vault)?;if v.mint!=*collateral.key || v.owner!=*vault_authority.key{return Err(ProgramError::InvalidAccountData)};let (fa,_)=Pubkey::find_program_address(&[b"fees",market.key.as_ref()],program_id);if fa!=*fee_authority.key{return Err(ProgramError::InvalidSeeds)};let f=token(fee_vault)?;if f.mint!=*collateral.key || f.owner!=*fee_authority.key{return Err(ProgramError::InvalidAccountData)}
   store(market,&MarketState{version:2,authority:*authority.key,underlying_mint:*underlying.key,collateral_mint:*collateral.key,market_seed,vault_bump:vbump,resolve_at,fee_bps,yes_pool:0,no_pool:0,collateral:0,fees:0,status:Status::Open,outcome_yes:false,resolution_commitment:[0u8;32]})?;msg!("stocklana_market_v2_initialized");Ok(())
  }
  StocklanaIx::Buy{side_yes,stake}=>{
   let market=next_account_info(&mut it)?;let position=next_account_info(&mut it)?;let trader=next_account_info(&mut it)?;let trader_token=next_account_info(&mut it)?;let vault=next_account_info(&mut it)?;let fee_vault=next_account_info(&mut it)?;let vault_authority=next_account_info(&mut it)?;let fee_authority=next_account_info(&mut it)?;let token_program=next_account_info(&mut it)?;let system=next_account_info(&mut it)?;
   if *token_program.key!=spl_token::id(){return Err(ProgramError::IncorrectProgramId)}
   if !trader.is_signer || market.owner!=program_id || stake==0{return Err(ProgramError::MissingRequiredSignature)}
   let mut m:MarketState=load(market)?;if m.status!=Status::Open || Clock::get()?.unix_timestamp>=m.resolve_at{return Err(ProgramError::InvalidAccountData)}
   let (va,_)=Pubkey::find_program_address(&[b"vault",market.key.as_ref()],program_id);if va!=*vault_authority.key{return Err(ProgramError::InvalidSeeds)}
   let (fa,_)=Pubkey::find_program_address(&[b"fees",market.key.as_ref()],program_id);if fa!=*fee_authority.key{return Err(ProgramError::InvalidSeeds)};let src=token(trader_token)?;let dst=token(vault)?;let fv=token(fee_vault)?;if src.owner!=*trader.key || src.mint!=m.collateral_mint || dst.owner!=va || dst.mint!=m.collateral_mint || fv.owner!=fa || fv.mint!=m.collateral_mint{return Err(ProgramError::InvalidAccountData)}
   ensure_position(program_id,market,position,trader,trader,system)?;let mut p:PositionState=load(position)?;if p.owner!=*trader.key || p.market!=*market.key || p.redeemed{return Err(ProgramError::InvalidAccountData)}
   let fee=checked_fee(stake,m.fee_bps)?;invoke(&spl_token::instruction::transfer(token_program.key,trader_token.key,vault.key,trader.key,&[],stake)?,&[trader_token.clone(),vault.clone(),trader.clone(),token_program.clone()])?;
   if fee>0{invoke(&spl_token::instruction::transfer(token_program.key,trader_token.key,fee_vault.key,trader.key,&[],fee)?,&[trader_token.clone(),fee_vault.clone(),trader.clone(),token_program.clone()])?;}
   if side_yes{m.yes_pool=m.yes_pool.checked_add(stake).ok_or(ProgramError::ArithmeticOverflow)?;p.yes_stake=p.yes_stake.checked_add(stake).ok_or(ProgramError::ArithmeticOverflow)?;}else{m.no_pool=m.no_pool.checked_add(stake).ok_or(ProgramError::ArithmeticOverflow)?;p.no_stake=p.no_stake.checked_add(stake).ok_or(ProgramError::ArithmeticOverflow)?;}
   m.collateral=m.collateral.checked_add(stake).ok_or(ProgramError::ArithmeticOverflow)?;m.fees=m.fees.checked_add(fee).ok_or(ProgramError::ArithmeticOverflow)?;store(market,&m)?;store(position,&p)?;msg!("stocklana_buy_collateralized");Ok(())
  }
  StocklanaIx::TransferPosition{side_yes,amount}=>{
   let market=next_account_info(&mut it)?;let sender_pos=next_account_info(&mut it)?;let recipient_pos=next_account_info(&mut it)?;let sender=next_account_info(&mut it)?;let recipient=next_account_info(&mut it)?;let system=next_account_info(&mut it)?;
   if !sender.is_signer || amount==0{return Err(ProgramError::MissingRequiredSignature)};ensure_position(program_id,market,recipient_pos,sender,recipient,system)?;let mut sp:PositionState=load(sender_pos)?;let mut rp:PositionState=load(recipient_pos)?;if sp.owner!=*sender.key || sp.market!=*market.key || rp.owner!=*recipient.key || rp.market!=*market.key{return Err(ProgramError::InvalidAccountData)}
   if side_yes{sp.yes_stake=sp.yes_stake.checked_sub(amount).ok_or(ProgramError::InsufficientFunds)?;rp.yes_stake=rp.yes_stake.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;}else{sp.no_stake=sp.no_stake.checked_sub(amount).ok_or(ProgramError::InsufficientFunds)?;rp.no_stake=rp.no_stake.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;}store(sender_pos,&sp)?;store(recipient_pos,&rp)?;Ok(())
  }
  StocklanaIx::Resolve{outcome_yes,resolution_commitment}=>{
   let market=next_account_info(&mut it)?;let authority=next_account_info(&mut it)?;if !authority.is_signer{return Err(ProgramError::MissingRequiredSignature)};let mut m:MarketState=load(market)?;if m.authority!=*authority.key || m.status!=Status::Open || Clock::get()?.unix_timestamp<m.resolve_at{return Err(ProgramError::InvalidAccountData)};m.status=Status::Resolved;m.outcome_yes=outcome_yes;m.resolution_commitment=resolution_commitment;store(market,&m)?;msg!("stocklana_market_resolved_with_proof");Ok(())
  }
  StocklanaIx::Redeem=>{
   let market=next_account_info(&mut it)?;let position=next_account_info(&mut it)?;let owner=next_account_info(&mut it)?;let vault=next_account_info(&mut it)?;let owner_token=next_account_info(&mut it)?;let vault_authority=next_account_info(&mut it)?;let token_program=next_account_info(&mut it)?;
   if *token_program.key!=spl_token::id(){return Err(ProgramError::IncorrectProgramId)}
   if !owner.is_signer{return Err(ProgramError::MissingRequiredSignature)};let m:MarketState=load(market)?;let mut p:PositionState=load(position)?;if m.status!=Status::Resolved || p.owner!=*owner.key || p.market!=*market.key || p.redeemed{return Err(ProgramError::InvalidAccountData)}
   let win=if m.outcome_yes{p.yes_stake}else{p.no_stake};let pool=if m.outcome_yes{m.yes_pool}else{m.no_pool};let payout=if win==0||pool==0{0}else{((win as u128)*(m.collateral as u128)/(pool as u128)).try_into().map_err(|_|ProgramError::ArithmeticOverflow)?};let (va,bump)=Pubkey::find_program_address(&[b"vault",market.key.as_ref()],program_id);if va!=*vault_authority.key{return Err(ProgramError::InvalidSeeds)};let vt=token(vault)?;let ot=token(owner_token)?;if vt.owner!=va || vt.mint!=m.collateral_mint || ot.owner!=*owner.key || ot.mint!=m.collateral_mint{return Err(ProgramError::InvalidAccountData)}
   if payout>0{invoke_signed(&spl_token::instruction::transfer(token_program.key,vault.key,owner_token.key,vault_authority.key,&[],payout)?,&[vault.clone(),owner_token.clone(),vault_authority.clone(),token_program.clone()],&[&[b"vault",market.key.as_ref(),&[bump]]])?;}p.redeemed=true;store(position,&p)?;msg!("stocklana_redeemed");Ok(())
  }
  StocklanaIx::WithdrawFees{amount}=>{
   let market=next_account_info(&mut it)?;let authority=next_account_info(&mut it)?;let fee_vault=next_account_info(&mut it)?;let authority_token=next_account_info(&mut it)?;let fee_authority=next_account_info(&mut it)?;let token_program=next_account_info(&mut it)?;if *token_program.key!=spl_token::id(){return Err(ProgramError::IncorrectProgramId)};if !authority.is_signer{return Err(ProgramError::MissingRequiredSignature)};let m:MarketState=load(market)?;if m.authority!=*authority.key{return Err(ProgramError::MissingRequiredSignature)};let (fa,bump)=Pubkey::find_program_address(&[b"fees",market.key.as_ref()],program_id);if fa!=*fee_authority.key{return Err(ProgramError::InvalidSeeds)};let fv=token(fee_vault)?;let at=token(authority_token)?;if fv.owner!=fa || fv.mint!=m.collateral_mint || at.owner!=*authority.key || at.mint!=m.collateral_mint{return Err(ProgramError::InvalidAccountData)};invoke_signed(&spl_token::instruction::transfer(token_program.key,fee_vault.key,authority_token.key,fee_authority.key,&[],amount)?,&[fee_vault.clone(),authority_token.clone(),fee_authority.clone(),token_program.clone()],&[&[b"fees",market.key.as_ref(),&[bump]]])?;Ok(())
  }
 }
}
