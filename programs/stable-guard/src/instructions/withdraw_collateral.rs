pub use crate::constants;
use crate::error::StableGuardError;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, transfer_checked, Burn, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct WithdrawalCollateral<'info> {
    #[account(mut)]
    pub underwriter: Signer<'info>,
    #[account(
        mut,
        token::mint= lp_mint,
        token::authority = underwriter
    )]
    pub underwriter_lp_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = underwriter,
        token::mint = usdc_mint,
        token::authority= underwriter
    )]
    pub underwriter_usdc_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = usdc_mint,
        seeds = [constants::POOL_SEED,usdc_mint.key().as_ref()],
        bump
    )]
    pub collateral_pool_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [ constants::LP_MINT_SEED],
        bump,
        mint::authority = pool_authority
    )]
    pub lp_mint: Account<'info, Mint>,

    /// CHECK: this is safe
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        address = collateral_pool_usdc_account.mint
    )]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> WithdrawalCollateral<'info> {
    pub fn withdraw(
        &mut self,
        lp_amt_to_burn: u64,
        bumps: &WithdrawalCollateralBumps,
    ) -> Result<()> {
        require!(lp_amt_to_burn > 0, StableGuardError::WithdrawalAmountZero);
        require!(
            self.underwriter_lp_account.amount >= lp_amt_to_burn,
            StableGuardError::InsufficientLpTokensToBurn
        );
        let total_usdc_pool = self.collateral_pool_usdc_account.amount;
        let total_lp_supply = self.lp_mint.supply;

        require!(total_lp_supply > 0, StableGuardError::NolpTokensToBurn);

        let usdc_to_withdraw_u128 = (lp_amt_to_burn as u128)
            .checked_mul(total_usdc_pool as u128)
            .ok_or(StableGuardError::CalculationError)?
            .checked_div(total_lp_supply as u128)
            .ok_or(StableGuardError::CalculationError)?;

        let usdc_to_withdraw = usdc_to_withdraw_u128 as u64;
        require!(
            usdc_to_withdraw > 0,
            StableGuardError::WithdrawalResultsInZeroUsdc
        );
        //sanity check to ensure amout of lp to burn is less than total lp supply
        require!(
            total_usdc_pool >= usdc_to_withdraw,
            StableGuardError::WithdrawalAmountExceedsPoolBalance
        );
        //Burn LP tkns
        let cpi_accounts = Burn {
            mint: self.lp_mint.to_account_info(),
            from: self.underwriter_lp_account.to_account_info(),
            authority: self.underwriter.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        burn(cpi_ctx, lp_amt_to_burn)?;

        let cpi_account = TransferChecked {
            from: self.collateral_pool_usdc_account.to_account_info(),
            to: self.underwriter_usdc_account.to_account_info(),
            mint: self.usdc_mint.to_account_info(),
            authority: self.pool_authority.to_account_info(),
        };

        let authority_seed_bump = bumps.pool_authority;
        let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seed_bump]];
        let signer_seeds = &[&authority_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_account,
            signer_seeds,
        );

        transfer_checked(cpi_ctx, usdc_to_withdraw, self.usdc_mint.decimals)
        //tranfer USDC to underwriter
    }
}
