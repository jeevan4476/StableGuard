pub use crate::constants;
use crate::{error::StableGuardError, InsurancePool, Tranche};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount, Transfer},
};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub underwriter: Signer<'info>,
    #[account(
        mut,
        seeds= [constants::INSURANCE_POOL_SEED, collateral_mint.key().as_ref()],
        bump=insurance_pool.bump,
    )]
    pub insurance_pool: Account<'info, InsurancePool>,
    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = underwriter
    )]
    pub underwriter_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds= [constants::JUNIOR_COLLATERAL_POOL_SEED,collateral_mint.key().as_ref()],
        bump
    )]
    pub junior_collateral_pool: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds= [constants::SENIOR_COLLATERAL_POOL_SEED,collateral_mint.key().as_ref()],
        bump
    )]
    pub senior_collateral_pool: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = insurance_pool.junior_lp_mint
    )]
    pub junior_lp_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = insurance_pool.senior_lp_mint
    )]
    pub senior_lp_mint: Account<'info, Mint>,

    ///CHECK: this will be the underwriter's ATA for junior or senior LP tokens
    #[account(mut)]
    pub underwriter_lp_token_account: UncheckedAccount<'info>,

    /// CHECK: The program's master authority PDA.
    #[account(seeds = [constants::AUTHORITY_SEED], bump)]
    pub pool_authority: AccountInfo<'info>,

    pub collateral_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> DepositCollateral<'info> {
    pub fn deposit_collateral(&mut self, deposit_amount: u64, tranche: Tranche) -> Result<()> {
        //just determine which tranche and state to use

        let (target_collateral_pool, target_lp_mint, tranche_total_collateral, lp_supply) =
            match tranche {
                Tranche::Junior => (
                    self.junior_collateral_pool.to_account_info(),
                    &self.junior_lp_mint,
                    self.insurance_pool.junior_tranche_collateral,
                    self.junior_lp_mint.supply,
                ),
                Tranche::Senior => (
                    self.senior_collateral_pool.to_account_info(),
                    &self.senior_lp_mint,
                    self.insurance_pool.senior_tranche_collateral,
                    self.senior_lp_mint.supply,
                ),
            };

        //i transfer collateral from underwriter to whichever vault
        transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.underwriter_token_account.to_account_info(),
                    to: target_collateral_pool,
                    authority: self.underwriter.to_account_info(),
                },
            ),
            deposit_amount,
        );

        //calculate LP tokens to mint

        let lp_tokens = if lp_supply == 0 || tranche_total_collateral == 0 {
            deposit_amount
        } else {
            (deposit_amount as u128)
                .checked_mul(lp_supply as u128)
                .ok_or(StableGuardError::CalculationError)?
                .checked_div(tranche_total_collateral as u128)
                .ok_or(StableGuardError::CalculationError)? as u64
        };

        require!(lp_tokens > 0, StableGuardError::DepositTooSmallToMintLp);

        //minting lp tokens to underwriter
        mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    mint: target_lp_mint.to_account_info(),
                    to: self.underwriter_lp_token_account.to_account_info(),
                    authority: self.pool_authority.to_account_info(),
                },
                &[&[constants::AUTHORITY_SEED, &[self.bumps.pool_authority]]],
            ),
            lp_tokens_to_mint,
        )?;

        //updating the state of the pool for that tranche

        match tranche {
            Tranche::Junior => {
                self.insurance_pool.junior_tranche_collateral = self
                    .insurance_pool
                    .junior_tranche_collateral
                    .checked_add(deposit_amount)
                    .ok_or(StableGuardError::CalculationError)?;
            }
            Tranche::Senior => {
                self.insurance_pool.senior_tranche_collateral = self
                    .insurance_pool
                    .senior_tranche_collateral
                    .checked_add(deposit_amount)
                    .ok_or(StableGuardError::CalculationError)?;
            }
        }

        Ok(());
    }
}
