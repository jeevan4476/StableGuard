pub use crate::constants;
use crate::error::StableGuardError;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, transfer_checked, Mint, MintTo, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    // #[account(
    //     seeds=[constants::POLICY_SEED,policy_account.buyer.key().as_ref(),policy_account.policy_id.to_le_bytes().as_ref()],
    //     bump=policy_account.bump,
    //     has_one=mint
    // )]
    // pub policy_account: Account<'info, PolicyAccount>,
    #[account(mut)]
    pub underwriter: Signer<'info>,
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

    /// CHECK: this is safe
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
        deposit_amount: u64,
        bumps: &DepositCollateralBumps,
    ) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.underwriter_token_account.to_account_info(),
            to: self.collateral_token_pool.to_account_info(),
            authority: self.underwriter.to_account_info(),
            mint: self.mint.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        transfer_checked(cpi_ctx, deposit_amount, self.mint.decimals)?;

        self.collateral_token_pool.reload()?;
        let total_usdc_in_pool_after_deposit = self.collateral_token_pool.amount;
        let current_lp_supply = self.lp_mint.supply;
        let lp_tokens_to_mint: u64;

        if current_lp_supply == 0 {
            lp_tokens_to_mint = deposit_amount;
            require!(lp_tokens_to_mint > 0, StableGuardError::CalculationError);
        } else {
            let total_usdc_before_deposit = total_usdc_in_pool_after_deposit
                .checked_sub(deposit_amount)
                .ok_or(StableGuardError::CalculationError)?;
            if total_usdc_before_deposit == 0 {
                lp_tokens_to_mint = deposit_amount;
            } else {
                let lp_to_mint_u128 = (deposit_amount as u128)
                    .checked_mul(current_lp_supply as u128)
                    .ok_or(StableGuardError::CalculationError)?
                    .checked_div(total_usdc_before_deposit as u128)
                    .ok_or(StableGuardError::CalculationError)?;
                lp_tokens_to_mint = lp_to_mint_u128 as u64;
                //fn safe_u128_to_u64_rounded_up(value: u128) -> Result<u64> {
                //     let rounded = (value + (1 << 64) - 1) / (1 << 64);
                //     u64::try_from(rounded).map_err(|_| StableGuardError::CalculationError.into())
                // }
            }
            require!(
                lp_tokens_to_mint > 0,
                StableGuardError::DepositTooSmallToMintLp
            );
        }

        //mint LP tokens to underwriter
        let authority_seeds_bump = bumps.pool_authority;
        let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seeds_bump]];
        let signer_seeds = &[&authority_seeds[..]];

        let mint_lp_accounts = MintTo {
            mint: self.lp_mint.to_account_info(),
            to: self.underwriter_lp_token_account.to_account_info(),
            authority: self.pool_authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            mint_lp_accounts,
            signer_seeds,
        );
        mint_to(cpi_ctx, lp_tokens_to_mint)?;
        Ok(())
    }
}
