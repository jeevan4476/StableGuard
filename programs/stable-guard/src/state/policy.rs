use anchor_lang::prelude::*;

use crate::policy_status::PolicyStatus;

#[account]
#[derive(Debug)]
pub struct PolicyAccount {
    pub policy_id: u64, //identifier for the policy - needs to be unique per buyer
    pub buyer: Pubkey,
    pub insured_stablecoin_mint: Pubkey,
    pub insured_amount: u64,
    pub premium_paid: u64,
    pub payout_amount: u64,
    pub start_timestamp: i64,
    pub expiry_timestamp: i64, // start_timestamp + 7 days
    pub status: PolicyStatus,
    pub bump: u8,
}

impl PolicyAccount {
    pub const LEN: usize = 32 * 2 + 8 * 5 + 1 * 3 + 8;
}
