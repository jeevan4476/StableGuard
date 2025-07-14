pub use crate::constants;
use crate::state::pool::InsurancePool;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + InsurancePool::INIT_SPACE,
        seeds = [constants::INSURANCE_POOL_SEED, collateral_mint.key().as_ref()],
        bump
    )]
    pub insurance_pool: Account<'info, InsurancePool>,

    #[account(
        init,
        payer = authority,
        seeds = [constants::JUNIOR_LP_MINT_SEED, collateral_mint.key().as_ref()],
        bump,
        mint::decimals = collateral_mint.decimals,
        mint::authority = pool_authority
    )]
    pub junior_lp_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [constants::JUNIOR_COLLATERAL_POOL_SEED, collateral_mint.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = pool_authority
    )]
    pub junior_collateral_pool: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        seeds = [constants::SENIOR_LP_MINT_SEED, collateral_mint.key().as_ref()],
        bump,
        mint::decimals = collateral_mint.decimals,
        mint::authority = pool_authority
    )]
    pub senior_lp_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [constants::SENIOR_COLLATERAL_POOL_SEED, collateral_mint.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = pool_authority
    )]
    pub senior_collateral_pool: Account<'info, TokenAccount>,

    ///CHECK: The program's authority PDA
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    pub collateral_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bumps: &InitializeBumps, depeg_threshold: u64) -> Result<()> {
        msg!("StableGuard protocol initialized!");

        self.insurance_pool.set_inner(InsurancePool {
            authority: self.authority.key(),
            collateral_mint: self.collateral_mint.key(),
            total_insured_amount: 0,
            depeg_threshold,
            last_policy_id: 0,
            bump: bumps.insurance_pool,
            junior_tranche_collateral: 0,
            senior_tranche_collateral: 0,
            junior_lp_mint: self.junior_lp_mint.key(),
            senior_lp_mint: self.senior_lp_mint.key(),
            junior_tranche_share: constants::JUNIOR_PREMIUM_SHARE_BPS,
            senior_tranche_share: constants::SENIOR_PREMIUM_SHARE_BPS,
        });

        Ok(())
    }
}
