use anchor_lang::prelude::*;

///PDA Seeds

pub const POLICY_SEED: &[u8] = b"policy";

pub const POOL_SEED: &[u8] = b"collateral_pool";

pub const AUTHORITY_SEED: &[u8] = b"pool_authority";

pub const LP_MINT_SEED: &[u8] = b"lp_mint";

///Policy Parameters

pub const POLICY_TERM: i64 = 7 * 24 * 60 * 60;

pub const DEPEG_THRESHOLD_PRICE: u64 = 985_000;

pub const BINARY_PAYOUT_BPS: u16 = 1000;

pub const PREMIUM_RATE_BPS: u16 = 50;

pub const MAX_ORACLE_AGE_SECONDS: u64 = 60;

pub const MAX_CONFIDENCE_VALUE: u64 = 10;

pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const USDT_MINT_PUBKEY: Pubkey = pubkey!("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

pub const PYTH_USDC_USD_FEED: Pubkey = pubkey!("Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD");

pub const PYTH_USDT_USD_FEED: Pubkey = pubkey!("3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxudq4nTEMAscUX");
