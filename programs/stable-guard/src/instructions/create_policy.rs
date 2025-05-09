pub use crate::constants;
use crate::error::StableGuardError;
use crate::state::policy::PolicyAccount;
use crate::state::policy_status::PolicyStatus;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

#[derive(Accounts)]
#[instruction(insured_amount: u64, policy_id: u64)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        init,
        payer = buyer,
        seeds=[constants::POLICY_SEED,buyer.key().as_ref(),policy_id.to_le_bytes().as_ref()],
        bump,
        space = PolicyAccount::LEN
    )]
    pub policy_account: Account<'info, PolicyAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = buyer
    )]
    pub buyer_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [constants::POOL_SEED,usdc_mint.key().as_ref()],
        bump,
        token::mint = usdc_mint
    )]
    pub collateral_pool_usdc_account: Account<'info, TokenAccount>,

    #[account(
        address = collateral_pool_usdc_account.mint
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account()]
    pub insured_stablecoin_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,

    pub clock: Sysvar<'info, Clock>,

    pub rent: Sysvar<'info, Rent>,
}

impl<'info> CreatePolicy<'info> {
    pub fn createpolicy(
        &mut self,
        insured_amount: u64,
        policy_id: u64,
        bumps: &CreatePolicyBumps,
    ) -> Result<()> {
        let current_timestamp = self.clock.unix_timestamp;

        let expiry_timestamp = current_timestamp + constants::POLICY_TERM;

        let premium_paid = (insured_amount * constants::PREMIUM_RATE_BPS as u64) / 10000;

        let payout_amount = (insured_amount * constants::BINARY_PAYOUT_BPS as u64) / 10000;

        if self.insured_stablecoin_mint.key() != constants::USDC_MINT_PUBKEY
            && self.insured_stablecoin_mint.key() != constants::USDT_MINT_PUBKEY
        {
            return err!(StableGuardError::UnsupportedStablecoinMint);
        }

        let cpi_accounts = TransferChecked {
            from: self.buyer_usdc_account.to_account_info(),
            mint: self.usdc_mint.to_account_info(),
            to: self.collateral_pool_usdc_account.to_account_info(),
            authority: self.buyer.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        transfer_checked(cpi_ctx, premium_paid, self.usdc_mint.decimals)?;

        self.policy_account.set_inner(PolicyAccount {
            policy_id: policy_id,
            buyer: self.buyer.key(),
            insured_stablecoin_mint: self.insured_stablecoin_mint.key(),
            insured_amount: insured_amount,
            premium_paid,
            payout_amount,
            start_timestamp: current_timestamp,
            expiry_timestamp,
            status: PolicyStatus::Active,
            bump: bumps.policy_account,
        });
        Ok(())
    }
}
