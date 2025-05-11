pub use crate::constants;
use crate::{error::StableGuardError, PolicyAccount, PolicyStatus, SECONDS_30};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

#[derive(Accounts)]

pub struct CheckAndPayout<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds=[constants::POLICY_SEED,policy_account.buyer.key().as_ref(),policy_account.policy_id.to_le_bytes().as_ref()],
        bump = policy_account.bump,
        has_one = buyer
    )]
    pub policy_account: Account<'info, PolicyAccount>,
    #[account(
        mut,
        seeds = [constants::POOL_SEED,mint.key().as_ref()],
        bump
    )]
    pub collateral_token_pool: Account<'info, TokenAccount>,
    /// CHECK: this is safe
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = policy_account.buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(
        address = collateral_token_pool.mint
    )]
    pub mint: Account<'info, Mint>,
    pub pyth_price_update: Account<'info, PriceUpdateV2>,
    pub token_program: Program<'info, Token>,
}

impl<'info> CheckAndPayout<'info> {
    pub fn check_payout(&mut self, bumps: &CheckAndPayoutBumps, _policy_id: u64) -> Result<()> {
        let policy = &mut self.policy_account;
        let pyth_feed_account_info = &self.pyth_price_update;
        let maximum_age: u64 = SECONDS_30;
        require!(
            policy.status == PolicyStatus::Active,
            StableGuardError::PolicyAlreadyProcessed
        );
        require!(
            Clock::get()?.unix_timestamp >= policy.expiry_timestamp,
            StableGuardError::PolicyNotExpired
        );

        // let current_pyth_time = Clock::get()?.unix_timestamp;
        let relevant_feed_id: &str = match policy.insured_stablecoin_mint {
            key if key == constants::USDC_MINT_PUBKEY => constants::PYTH_USDC_USD_FEED_ID,
            key if key == constants::USDT_MINT_PUBKEY => constants::PYTH_USDT_USD_FEED_ID,
            _ => return err!(StableGuardError::InvalidStablecoinMint),
        };

        let feed_id: [u8; 32] = get_feed_id_from_hex(relevant_feed_id)?;

        let price_data = pyth_feed_account_info.get_price_no_older_than(
            &Clock::get()?,
            maximum_age,
            &feed_id,
        )?;

        msg!(
            "Price for feed {} is {} * 10^{} and {}",
            relevant_feed_id,
            price_data.price,
            price_data.exponent,
            price_data.conf
        );

        //price_data contains price(i64) expo(i32) confidence(u64)
        // require!(
        //     price_data.conf < constants::MAX_CONFIDENCE_VALUE,
        //     StableGuardError::OracleConfidenceTooWide
        // );

        let pyth_mantissa = price_data.price;

        let pyth_exponent = price_data.exponent;

        const TARGET_DECIMALS: i32 = 8;
        // If pyth_exponent is -8 and TARGET_DECIMALS is 8, we need to multiply by 10^(8-8) = 10^0 = 1.

        let scaled_pyth_price: i64;

        if pyth_exponent > 0 {
            return err!(StableGuardError::OracleExponentUnexpected);
        }
        let scale_difference = pyth_exponent - (-TARGET_DECIMALS);

        if scale_difference > 0 {
            let scale_difference_u32 = u32::try_from(scale_difference)?;
            let multiplier = i64::try_from(10u64.pow(scale_difference_u32))?;
            scaled_pyth_price = pyth_mantissa
                .checked_mul(multiplier)
                .ok_or(StableGuardError::CalculationError)?;
        } else if scale_difference < 0 {
            let scale_difference_u32 = u32::try_from(-scale_difference)?;
            let divisor = i64::try_from(10u64.pow(scale_difference_u32))?;
            require!(divisor != 0, StableGuardError::CalculationError);
            scaled_pyth_price = pyth_mantissa
                .checked_div(divisor)
                .ok_or(StableGuardError::CalculationError)?;
        } else {
            scaled_pyth_price = pyth_mantissa;
        };
        // msg!("{}", scaled_pyth_price);

        if scaled_pyth_price < constants::DEPEG_THRESHOLD_PRICE as i64 {
            //DEPEG condition met
            let payout_amt_to_transfer = policy.payout_amount;

            let collateral_pool = &mut self.collateral_token_pool;

            require!(
                collateral_pool.amount >= payout_amt_to_transfer,
                StableGuardError::InsufficientPoolCollateralForPayout
            );

            let authority_seeds_bump = bumps.pool_authority;
            let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seeds_bump]];
            let signer_seeds = &[&authority_seeds[..]];

            let transfer_payout_accounts = TransferChecked {
                from: collateral_pool.to_account_info(),
                mint: self.mint.to_account_info(),
                to: self.buyer_token_account.to_account_info(),
                authority: self.pool_authority.to_account_info(),
            };

            let cpi_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                transfer_payout_accounts,
                signer_seeds,
            );

            transfer_checked(cpi_ctx, payout_amt_to_transfer, self.mint.decimals)?;
            self.policy_account.status = PolicyStatus::ExpiredPaid;
            Ok(())
        } else {
            //No DEPEG
            self.policy_account.status = PolicyStatus::ExpiredNotPaid;
            Ok(())
        }
    }
}
