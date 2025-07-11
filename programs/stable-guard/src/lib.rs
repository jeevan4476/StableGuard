#![allow(unexpected_cfgs)]
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("B6t67fYC2qD91KTtboBoj4NUXhyBTk7madXZ7oUdD8VN");

#[program]
pub mod stable_guard {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, depeg_threshold: u64) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps, depeg_threshold)?;
        Ok(())
    }
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        insured_amount: u64,
        policy_duration_seconds: i64,
    ) -> Result<()> {
        ctx.accounts
            .create_policy(&ctx.bumps, insured_amount, policy_duration_seconds)?;
        Ok(())
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, deposit_amount: u64) -> Result<()> {
        ctx.accounts
            .deposit_collateral(&ctx.bumps, deposit_amount)?;
        Ok(())
    }

    pub fn withdraw_collateral(
        ctx: Context<WithdrawCollateral>,
        lp_amount_to_burn: u64,
    ) -> Result<()> {
        ctx.accounts.withdraw(&ctx.bumps, lp_amount_to_burn)?;
        Ok(())
    }

    pub fn check_and_payout(ctx: Context<CheckAndPayout>, policy_id: u64) -> Result<()> {
        ctx.accounts.check_payout(&ctx.bumps, policy_id)?;
        Ok(())
    }
}
