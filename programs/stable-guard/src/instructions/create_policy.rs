pub use crate::constants;
use crate::state::policy::PolicyAccount;
use crate::state::policy_status::PolicyStatus;
use crate::{ InsurancePool};
use crate::{error::StableGuardError, USDC_MINT_PUBKEY};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

#[derive(Accounts)]
#[instruction(insured_amount:u64,policy_duration_seconds: i64)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [constants::INSURANCE_POOL_SEED,mint.key().as_ref()],
        bump,
    )]
    pub insurance_pool: Account<'info, InsurancePool>,
    #[account(  
        init,
        payer = buyer,
        seeds=[constants::POLICY_SEED,buyer.key().as_ref(),(insurance_pool.last_policy_id+1).to_le_bytes().as_ref()],
        bump,
        space = 8+PolicyAccount::INIT_SPACE
    )]
    pub policy_account: Account<'info, PolicyAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [constants::POOL_SEED,mint.key().as_ref()],
        bump,
        token::mint = mint
    )]
    pub collateral_token_pool: Account<'info, TokenAccount>,

    #[account(
        constraint =  mint.key() == USDC_MINT_PUBKEY  @ StableGuardError::UnsupportedStablecoinMint //comment while testing
    )]
    pub mint: Account<'info, Mint>,

    pub insured_stablecoin_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreatePolicy<'info> {
    pub fn createpolicy(
        &mut self,
        bumps: &CreatePolicyBumps,
        insured_amount: u64,
        policy_duration_seconds: i64, 
    ) -> Result<()> {
        self.insurance_pool.last_policy_id = self.insurance_pool.last_policy_id.checked_add(1).ok_or(StableGuardError::CalculationError)?;
        let new_policy_id = self.insurance_pool.last_policy_id;
        // Inside the createpolicy handler in create_policy.rs
        if self.insured_stablecoin_mint.key() != constants::USDC_MINT_PUBKEY &&
            self.insured_stablecoin_mint.key() != constants::USDT_MINT_PUBKEY {
            return err!(StableGuardError::UnsupportedStablecoinMint); // Or InvalidStablecoinMint
            }   
        let current_timestamp = Clock::get()?.unix_timestamp;
        
        let expiry_timestamp = current_timestamp
            .checked_add(policy_duration_seconds)
            .ok_or(StableGuardError::CalculationError)?;

        //read the current state of the pool
        let pool = &self.insurance_pool;

        //calucation of the pool's utilization in basis points
        let utilization_bps = if pool.total_collateral>0{
            (pool.total_insured_value as u128).checked_mul(10000).ok_or(StableGuardError::CalculationError)?.checked_div(pool.total_collateral as u128).unwrap_or(0) as u64

        }else{
            0 //if no collateral in the pool then utilization is 0
        };

        //determining the dynamic rate. Base rate + Utilization rate 
        let dynamic_rate_bps = constants::PREMIUM_RATE_BPS.checked_add(utilization_bps).ok_or(StableGuardError::CalculationError)?;

        let premium_paid = insured_amount.checked_mul(dynamic_rate_bps).ok_or(StableGuardError::CalculationError)?.checked_div(10000).ok_or(StableGuardError::CalculationError)?;

        let payout_amount = (insured_amount.checked_mul(constants::BINARY_PAYOUT_BPS as u64))
            .ok_or(StableGuardError::CalculationError)?
            .checked_div(10000)
            .ok_or(StableGuardError::CalculationError)?;

        require!(self.insurance_pool.total_collateral>=self.insurance_pool.total_insured_value.checked_add(payout_amount).ok_or(StableGuardError::CalculationError)?,StableGuardError::InsufficientPoolCollateralForPayout);
        
        let cpi_accounts = TransferChecked {
            from: self.buyer_token_account.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.collateral_token_pool.to_account_info(),
            authority: self.buyer.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        transfer_checked(cpi_ctx, premium_paid, self.mint.decimals)?;

        self.policy_account.set_inner(PolicyAccount {
            policy_id:new_policy_id,
            buyer: self.buyer.key(),
            insured_stablecoin_mint: self.insured_stablecoin_mint.key(),
            insured_amount,
            premium_paid,
            payout_amount,
            start_timestamp: current_timestamp,
            expiry_timestamp,
            status: PolicyStatus::Active,
            bump: bumps.policy_account,
            mint: self.mint.key(),
        });

        self.insurance_pool.total_insured_value = self
            .insurance_pool
            .total_insured_value
            .checked_add(insured_amount)
            .ok_or(StableGuardError::CalculationError)?;
        Ok(())
    }
}
