use anchor_lang::prelude::*;

use crate::policy_status::PolicyStatus;

#[account]
#[derive(InitSpace)]
pub struct PolicyAccount {
    pub policy_id: u64, //identifier for the policy
    pub buyer: Pubkey,
    pub insured_stablecoin_mint: Pubkey,
    pub insured_amount: u64,
    pub premium_paid: u64,
    pub payout_amount: u64,
    pub start_timestamp: i64,
    pub expiry_timestamp: i64, // start_timestamp + 7 days
    pub status: PolicyStatus,
    pub bump: u8,
    pub mint: Pubkey,
}

// impl PolicyAccount {
//     pub const LEN: usize = (32 * 2) + (8 * 6) + (1 * 1) + (1 * 1) + 8;
// }
