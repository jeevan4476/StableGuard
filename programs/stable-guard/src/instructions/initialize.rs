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
        seeds = [constants::LP_MINT_SEED],
        mint::decimals = 6,
        mint::authority = pool_authority,
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds= [constants::POOL_SEED,usdc_mint.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = pool_authority
    )]
    pub collateral_pool_usdc_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>, //UncheckedAccount doesnt store any data just an address used as authority

    #[account(
        address = constants::USDC_MINT_PUBKEY
    )]
    pub usdc_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self) -> Result<()> {
        msg!("StableGuard protocol initialized!");
        msg!("LP Mint PDA created: {}", self.lp_mint.key());
        msg!(
            "Collateral Pool USDC Account PDA created: {}",
            self.collateral_pool_usdc_account.key()
        );
        msg!("Pool Authority PDA: {}", self.pool_authority.key());
        Ok(())
    }
}
