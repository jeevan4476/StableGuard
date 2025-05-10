pub use crate::constants;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        seeds = [constants::LP_MINT_SEED,mint.key().as_ref()],//Updated if multiple pools are initialized then lp tokens are distinct to each pool 
        mint::decimals = 6,
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

    /// CHECK: this is safe
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
    pub fn initialize(&mut self) -> Result<()> {
        msg!("StableGuard protocol initialized!");
        msg!("LP Mint PDA created: {}", self.lp_mint.key());
        msg!(
            "Collateral Pool USDC Account PDA created: {}",
            self.collateral_token_pool.key()
        );
        msg!("Pool Authority PDA: {}", self.pool_authority.key());
        Ok(())
    }
}
