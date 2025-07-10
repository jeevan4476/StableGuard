pub use crate::constants;
use crate::{error::StableGuardError, InsurancePool};
use anchor_lang::prelude::*;
use anchor_spl::{
    token::{burn, transfer_checked, Burn, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub underwriter: Signer<'info>,
    #[account(
        mut,
        seeds = [constants::INSURANCE_POOL_SEED, mint.key().as_ref()],
        bump
    )]
    pub insurance_pool: Account<'info, InsurancePool>,
    #[account(
        mut,
        token::mint= lp_mint,
        token::authority = underwriter
    )]
    pub underwriter_lp_account: Account<'info, TokenAccount>,

    #[account( 
        mut,
        token::mint = mint,
        token::authority= underwriter
    )]
    pub underwriter_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        seeds = [constants::POOL_SEED,mint.key().as_ref()],
        bump
    )]
    pub collateral_token_pool: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [ constants::LP_MINT_SEED,mint.key().as_ref()],
        bump,
        mint::authority = pool_authority
    )]
    pub lp_mint: Account<'info, Mint>,

    /// CHECK: The program's master authority PDA, required to sign for the collateral transfer
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        address = collateral_token_pool.mint
    )]
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

impl<'info> WithdrawCollateral<'info> {
   pub fn withdraw(
    &mut self,
    bumps: &WithdrawCollateralBumps,
    lp_amount_to_burn: u64,
) -> Result<()> {
     msg!("Withdrawing collateral for {} LP tokens...", lp_amount_to_burn);

        // --- 1. Input Validation ---
        require!(lp_amount_to_burn > 0, StableGuardError::WithdrawalAmountZero);
        require!(
            self.underwriter_lp_account.amount >= lp_amount_to_burn,
            StableGuardError::InsufficientLpTokensToBurn
        );

        let total_collateral = self.insurance_pool.total_collateral;
        let total_lp_supply = self.lp_mint.supply;
        require!(total_lp_supply > 0, StableGuardError::NolpTokensToBurn);

        // --- 2. Calculate Collateral to Return ---
        // Formula: (lp_tokens_to_burn * total_collateral) / total_lp_supply
        let collateral_to_withdraw = u128::from(lp_amount_to_burn)
            .checked_mul(u128::from(total_collateral))
            .ok_or(StableGuardError::CalculationError)?
            .checked_div(u128::from(total_lp_supply))
            .ok_or(StableGuardError::CalculationError)?;

        let collateral_to_withdraw = u64::try_from(collateral_to_withdraw)
            .map_err(|_| StableGuardError::CalculationError)?;

        require!(collateral_to_withdraw > 0, StableGuardError::WithdrawalResultsInZeroUsdc);

        // --- 3. CRITICAL Solvency Check ---
        // This check prevents a "bank run" on the pool. It ensures that the collateral
        // remaining after the withdrawal is sufficient to cover the face value of all
        // active insurance policies. An LP can only withdraw "surplus" capital.
        let remaining_collateral_after_withdrawal = total_collateral
            .checked_sub(collateral_to_withdraw)
            .ok_or(StableGuardError::CalculationError)?;

        require!(
            remaining_collateral_after_withdrawal >= self.insurance_pool.total_insured_value,
            StableGuardError::WithdrawalBlockedByUtilization
        );
        msg!("Solvency check passed. Withdrawing {} of collateral.", collateral_to_withdraw);

        // --- 4. Burn LP Tokens ---
        let cpi_accounts_burn = Burn {
            mint: self.lp_mint.to_account_info(),
            from: self.underwriter_lp_account.to_account_info(),
            authority: self.underwriter.to_account_info(),
        };
        let cpi_ctx_burn = CpiContext::new(self.token_program.to_account_info(), cpi_accounts_burn);
        burn(cpi_ctx_burn, lp_amount_to_burn)?;
        msg!("LP tokens burned.");

        // --- 5. Transfer Collateral to Underwriter ---
        let cpi_accounts_transfer = TransferChecked {
            from: self.collateral_token_pool.to_account_info(),
            to: self.underwriter_token_account.to_account_info(),
            mint: self.mint.to_account_info(),
            authority: self.pool_authority.to_account_info(),
        };
        let authority_seeds_bump = bumps.pool_authority;
        let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seeds_bump]];
        let signer_seeds = &[&authority_seeds[..]];
        let cpi_ctx_transfer = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts_transfer,
            signer_seeds,
        );
        transfer_checked(cpi_ctx_transfer, collateral_to_withdraw, self.mint.decimals)?;
        msg!("Collateral transferred to underwriter.");

        // --- 6. Update Pool State ---
        self.insurance_pool.total_collateral = remaining_collateral_after_withdrawal;
        msg!("Pool total collateral updated to: {}", self.insurance_pool.total_collateral);
        msg!("Withdrawal successful.");

        Ok(())
}
}
