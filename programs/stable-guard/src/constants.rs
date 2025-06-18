use anchor_lang::prelude::*;

///PDA Seeds

pub const POLICY_SEED: &[u8] = b"policy";

pub const POOL_SEED: &[u8] = b"collateral_pool";

pub const AUTHORITY_SEED: &[u8] = b"pool_authority";

pub const LP_MINT_SEED: &[u8] = b"lp_mint";

pub const INSURANCE_POOL_SEED: &[u8] = b"insurance_pool";

///Policy Parameters

pub const SECONDS_30: u64 = 60 * 60 * 24;

// pub const POLICY_TERM: i64 = 3; //for testing

pub const DEPEG_THRESHOLD_PRICE: u64 = 985_000_00;
// pub const DEPEG_THRESHOLD_PRICE: u64 = 10000000; //for testing

pub const BINARY_PAYOUT_BPS: u16 = 1000;

pub const PREMIUM_RATE_BPS: u64 = 50;

pub const MAX_ORACLE_AGE_SECONDS: u64 = 60;

pub const MAX_CONFIDENCE_VALUE: u64 = 70000;

pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const USDT_MINT_PUBKEY: Pubkey = pubkey!("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

pub const PYTH_USDC_USD_FEED: Pubkey = pubkey!("Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD");

pub const PYTH_USDT_USD_FEED: Pubkey = pubkey!("3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxudq4nTEMAscUX");

pub const PYTH_USDC_USD_FEED_ID: &'static str =
    "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

pub const PYTH_USDT_USD_FEED_ID: &'static str =
    "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b";
