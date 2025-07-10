pub use crate::constants;
use crate::{error::StableGuardError, InsurancePool, PolicyAccount, PolicyStatus};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

#[derive(Accounts)]

pub struct CheckAndPayout<'info> {
    /// CHECK: This account's key is check against the pocily_account.buyer field.
    pub policy_owner: UncheckedAccount<'info>, //buyer no longer signs. Anyone can call this to settle the policy
    #[account(
        mut,
        seeds=[constants::POLICY_SEED,policy_account.buyer.key().as_ref(),policy_account.policy_id.to_le_bytes().as_ref()],
        bump = policy_account.bump,
        constraint = policy_account.buyer == policy_owner.key() @ StableGuardError::InvalidPolicyOwner
    )]
    pub policy_account: Account<'info, PolicyAccount>,
    #[account(
        mut,
        seeds = [constants::INSURANCE_POOL_SEED,mint.key().as_ref()],
        bump,
        constraint = insurance_pool.collateral_mint == mint.key(),
    )]
    pub insurance_pool: Account<'info, InsurancePool>,
    #[account(
        mut,
        seeds = [constants::POOL_SEED,mint.key().as_ref()],
        bump
    )]
    pub collateral_token_pool: Account<'info, TokenAccount>,
    /// CHECK: The program's master authority PDA, required to sign for the payout transfer.
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = policy_owner
    )]
    pub payout_token_account: Account<'info, TokenAccount>,
    #[account(
        address = collateral_token_pool.mint
    )]
    pub mint: Account<'info, Mint>,
    pub pyth_price_update: Account<'info, PriceUpdateV2>,
    pub token_program: Program<'info, Token>,
}

impl<'info> CheckAndPayout<'info> {
    pub fn check_payout(&mut self, bumps: &CheckAndPayoutBumps, _policy_id: u64) -> Result<()> {
        msg!(
            "Checking policy #{} for settlement...",
            self.policy_account.policy_id
        );

        // --- 1. Pre-flight Checks ---
        require!(
            self.policy_account.status == PolicyStatus::Active,
            StableGuardError::PolicyAlreadyProcessed
        );
        require!(
            Clock::get()?.unix_timestamp >= self.policy_account.expiry_timestamp,
            StableGuardError::PolicyNotExpired
        );
        msg!("Policy is active and expired. Proceeding with oracle check.");

        // --- 2. Oracle Price Fetching ---
        let relevant_feed_id_str = match self.policy_account.insured_stablecoin_mint {
            key if key == constants::USDC_MINT_PUBKEY => constants::PYTH_USDC_USD_FEED_ID,
            key if key == constants::USDT_MINT_PUBKEY => constants::PYTH_USDT_USD_FEED_ID,
            _ => return err!(StableGuardError::InvalidStablecoinMint),
        };
        let feed_id = get_feed_id_from_hex(relevant_feed_id_str)?;

        // Fetch the price, ensuring it's not older than the maximum allowed age.
        // This is a critical defense against using stale data during network issues.
        let price_data = self.pyth_price_update.get_price_no_older_than(
            &Clock::get()?,
            constants::MAX_ORACLE_AGE_SECONDS,
            &feed_id,
        )?;
        msg!(
            "Fetched price from Pyth feed {}: {}",
            relevant_feed_id_str,
            price_data.price
        );

        // --- 3. Price Scaling ---
        // Pyth prices have a dynamic exponent. We must scale the price to a common
        // 8-decimal format to safely compare it with our `depeg_threshold`.
        let scaled_pyth_price = {
            let pyth_mantissa = price_data.price;
            let pyth_exponent = price_data.exponent;
            const TARGET_DECIMALS: i32 = 8;

            require!(
                pyth_exponent <= 0,
                StableGuardError::OracleExponentUnexpected
            );
            let scale_difference = pyth_exponent.abs() - TARGET_DECIMALS;

            if scale_difference > 0 {
                pyth_mantissa
                    .checked_div(10i64.pow(scale_difference as u32))
                    .ok_or(StableGuardError::CalculationError)?
            } else if scale_difference < 0 {
                pyth_mantissa
                    .checked_mul(10i64.pow(scale_difference.abs() as u32))
                    .ok_or(StableGuardError::CalculationError)?
            } else {
                pyth_mantissa
            }
        };
        msg!("Scaled oracle price (8 decimals): {}", scaled_pyth_price);

        // --- 4. Confidence Check ---
        // We must check the oracle's confidence interval. A wide interval suggests market
        // turmoil or potential oracle issues. We calculate a max allowed confidence as a
        // percentage (BPS) of the price itself.
        let max_allowable_confidence = (scaled_pyth_price.abs() as u64)
            .checked_mul(constants::MAX_CONFIDENCE_BPS)
            .ok_or(StableGuardError::CalculationError)?
            .checked_div(10000)
            .ok_or(StableGuardError::CalculationError)?;

        require!(
            price_data.conf <= max_allowable_confidence,
            StableGuardError::OracleConfidenceTooWide
        );
        msg!(
            "Oracle confidence check passed ({} <= {}).",
            price_data.conf,
            max_allowable_confidence
        );

        // --- 5. De-peg Decision ---
        if scaled_pyth_price < self.insurance_pool.depeg_threshold as i64 {
            // --- 6a. Payout Execution ---
            msg!("De-peg event DETECTED. Executing payout.");
            require!(
                self.collateral_token_pool.amount >= self.policy_account.payout_amount,
                StableGuardError::InsufficientPoolCollateralForPayout
            );

            let authority_seeds_bump = bumps.pool_authority;
            let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seeds_bump]];
            let signer_seeds = &[&authority_seeds[..]];

            let cpi_accounts_transfer = TransferChecked {
                from: self.collateral_token_pool.to_account_info(),
                to: self.payout_token_account.to_account_info(),
                mint: self.mint.to_account_info(),
                authority: self.pool_authority.to_account_info(),
            };
            let cpi_ctx_transfer = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                cpi_accounts_transfer,
                signer_seeds,
            );
            transfer_checked(
                cpi_ctx_transfer,
                self.policy_account.payout_amount,
                self.mint.decimals,
            )?;

            self.policy_account.status = PolicyStatus::ExpiredPaid;
            msg!(
                "Payout of {} transferred successfully.",
                self.policy_account.payout_amount
            );
        } else {
            // --- 6b. No Payout ---
            msg!("No de-peg event detected. Closing policy without payout.");
            self.policy_account.status = PolicyStatus::ExpiredNotPaid;
        }

        // --- 7. Final State Update ---
        // In both cases (paid or not), the policy is now settled, so we reduce the
        // pool's total insured value.
        self.insurance_pool.total_insured_value = self
            .insurance_pool
            .total_insured_value
            .checked_sub(self.policy_account.insured_amount)
            .ok_or(StableGuardError::CalculationError)?;
        msg!("Pool total insured value updated. Settlement complete.");

        Ok(())
    }
}
