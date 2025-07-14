use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct InsurancePool {
    pub authority: Pubkey,
    pub collateral_mint: Pubkey,
    pub total_insured_amount: u64,
    pub depeg_threshold: u64,
    pub last_policy_id: u64,
    pub bump: u8,

    /// The total amount of collateral held in the high-risk, high-reward Junior tranche.
    pub junior_tranche_collateral: u64,
    /// The total amount of collateral held in the low-risk, low-reward Senior tranche.
    pub senior_tranche_collateral: u64,

    /// The percentage of premiums allocated to the junior tranche, in basis points (BPS).
    /// e.g., 8000 BPS = 80%
    pub junior_lp_mint: Pubkey,
    /// The percentage of premiums allocated to the senior tranche, in basis points (BPS).
    /// e.g., 2000 BPS = 20%
    pub senior_lp_mint: Pubkey,

    pub junior_tranche_share: u64,
    pub senior_tranche_share: u64,
}
