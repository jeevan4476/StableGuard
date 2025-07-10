pub use crate::constants;
use crate::{error::StableGuardError, InsurancePool};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, transfer_checked, Mint, MintTo, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub underwriter: Signer<'info>,
    #[account(
        mut,
        seeds= [constants::INSURANCE_POOL_SEED, mint.key().as_ref()],
        bump,
    )]
    pub insurance_pool: Account<'info, InsurancePool>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = underwriter
    )]
    pub underwriter_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = underwriter,
        associated_token::mint = lp_mint,
        associated_token::authority= underwriter
    )]
    pub underwriter_lp_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [constants::POOL_SEED, mint.key().as_ref()],
        bump,
        token::mint = mint
    )]
    pub collateral_token_pool: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [constants::LP_MINT_SEED,mint.key().as_ref()],
        bump,
        mint::authority = pool_authority
    )]
    pub lp_mint: Account<'info, Mint>,

    /// CHECK: The program's master authority PDA, required to sign for the minting of LP tokens.
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> DepositCollateral<'info> {
    pub fn deposit_collateral(
        &mut self,
        bumps: &DepositCollateralBumps,
        deposit_amount: u64,
    ) -> Result<()> {
        //Transfer tokens into the pool
        let cpi_accounts = TransferChecked {
            from: self.underwriter_token_account.to_account_info(),
            to: self.collateral_token_pool.to_account_info(),
            authority: self.underwriter.to_account_info(),
            mint: self.mint.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        transfer_checked(cpi_ctx, deposit_amount, self.mint.decimals)?;
        msg!("Collateral transferred to pool vault.");

        // --- 2. Calculate LP Tokens to Mint ---
        let lp_tokens_to_mint =
            if self.lp_mint.supply == 0 || self.insurance_pool.total_collateral == 0 {
                // If this is the first deposit, the exchange rate is 1:1.
                // The amount of LP tokens minted is equal to the amount of collateral deposited.
                deposit_amount
            } else {
                // For subsequent deposits, the amount of LP tokens is calculated proportionally
                // to maintain the value of existing LPs' shares.
                // Formula: (deposit_amount * current_lp_supply) / total_collateral_before_deposit
                (deposit_amount as u128)
                    .checked_mul(self.lp_mint.supply as u128)
                    .ok_or(StableGuardError::CalculationError)?
                    .checked_div(self.insurance_pool.total_collateral as u128)
                    .ok_or(StableGuardError::CalculationError)? as u64
            };

        require!(
            lp_tokens_to_mint > 0,
            StableGuardError::DepositTooSmallToMintLp
        );
        msg!("Calculated {} LP tokens to mint.", lp_tokens_to_mint);

        // --- 3. Mint LP Tokens to Underwriter ---
        let authority_seeds_bump = bumps.pool_authority;
        let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seeds_bump]];
        let signer_seeds = &[&authority_seeds[..]];

        let mint_lp_accounts = MintTo {
            mint: self.lp_mint.to_account_info(),
            to: self.underwriter_lp_token_account.to_account_info(),
            authority: self.pool_authority.to_account_info(),
        };
        let cpi_ctx_mint = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            mint_lp_accounts,
            signer_seeds,
        );
        mint_to(cpi_ctx_mint, lp_tokens_to_mint)?;
        msg!("LP tokens minted to underwriter.");

        // --- 4. Update Pool State ---
        // This must be done *after* the LP token calculation, which relies on the "before" state.
        self.insurance_pool.total_collateral = self
            .insurance_pool
            .total_collateral
            .checked_add(deposit_amount)
            .ok_or(StableGuardError::CalculationError)?;

        msg!(
            "Pool total collateral updated to: {}",
            self.insurance_pool.total_collateral
        );
        msg!("Deposit successful.");
        Ok(())
    }
}
