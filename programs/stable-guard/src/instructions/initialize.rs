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
        payer=authority,
        space = 8 + InsurancePool::INIT_SPACE, 
        seeds = [constants::INSURANCE_POOL_SEED,mint.key().as_ref()],
        bump,
    )]
    pub insurance_pool: Account<'info, InsurancePool>,
    #[account(
        init,
        payer = authority,
        seeds = [constants::LP_MINT_SEED,mint.key().as_ref()],//Updated if multiple pools are initialized then lp tokens are distinct to each pool 
        mint::decimals = mint.decimals,
        mint::authority = pool_authority,
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds= [constants::POOL_SEED,mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = pool_authority
    )]
    pub collateral_token_pool: Account<'info, TokenAccount>,

    /// CHECK: This is programs's "master" authority pds. this account doesn't hold any data itself,
    /// but it servers as the designated acuthority for the lp_mint and collateral_token_pool 
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>, //UncheckedAccount doesnt store any data just an address used as authority

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self,bumps:&InitializeBumps,depeg_threshold:u64) -> Result<()> {
        msg!("StableGuard protocol initialized!");

        self.insurance_pool.set_inner(InsurancePool { 
            authority: self.authority.key(),
            collateral_mint: self.mint.key(),
            total_collateral: 0,
            total_insured_value: 0, 
            lp_token_mint: self.lp_mint.key(), 
            depeg_threshold,
            last_policy_id: 0,
            bump: bumps.insurance_pool 
        });

        msg!("InsurancePool state account created: {}", self.insurance_pool.key());
        msg!("LP Mint PDA created: {}", self.lp_mint.key());
        msg!("Collateral Pool Account PDA created: {}", self.collateral_token_pool.key());
        msg!("Pool Authority PDA: {}", self.pool_authority.key());        
        Ok(())
    }
}
