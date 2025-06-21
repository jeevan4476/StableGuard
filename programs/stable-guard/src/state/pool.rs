use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct InsurancePool {
    pub authority: Pubkey,
    pub collateral_mint: Pubkey,
    pub total_collateral: u64,
    pub total_insured_value: u64,
    pub lp_token_mint: Pubkey,
    pub depeg_threshold: u64,

    pub bump: u8,
}
