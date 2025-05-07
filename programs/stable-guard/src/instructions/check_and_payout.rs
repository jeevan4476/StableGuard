pub use crate::constants;
use crate::{error::StableGuardError, PolicyAccount, PolicyStatus};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};
use pyth_sdk_solana::state::SolanaPriceAccount;

#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct CheckAndPayout<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds=[constants::POLICY_SEED,buyer.key().as_ref(),policy_id.to_le_bytes().as_ref()],
        bump = policy_account.bump,
        has_one = buyer
    )]
    pub policy_account: Account<'info, PolicyAccount>,
    #[account(
        mut,
        seeds = [constants::POOL_SEED,usdc_mint.key().as_ref()],
        bump
    )]
    pub collateral_pool_usdc_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = policy_account.buyer
    )]
    pub buyer_usdc_account: Account<'info, TokenAccount>,
    #[account(
        address = constants::USDC_MINT_PUBKEY
    )]
    pub usdc_mint: Account<'info, Mint>,

    pub pyth_price_update: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> CheckAndPayout<'info> {
    pub fn check_payout(&mut self, policy_id: u64, bumps: &CheckAndPayoutBumps) -> Result<()> {
        let policy = &mut self.policy_account;
        let clock = &self.clock;
        let pyth_feed_account_info = &self.pyth_price_update;

        require!(
            policy.status == PolicyStatus::Active,
            StableGuardError::PolicyAlreadyProcessed
        );
        require!(
            clock.unix_timestamp >= policy.expiry_timestamp,
            StableGuardError::PolicyNotExpired
        );

        let current_pyth_time = clock.unix_timestamp;
        let expected_pyth_feed_address = match policy.insured_stablecoin_mint {
            key if key == constants::USDC_MINT_PUBKEY => constants::PYTH_USDC_USD_FEED,
            key if key == constants::USDT_MINT_PUBKEY => constants::PYTH_USDT_USD_FEED,
            _ => return err!(StableGuardError::InvalidStablecoinMint),
        };

        require_keys_eq!(
            pyth_feed_account_info.key(),
            expected_pyth_feed_address,
            StableGuardError::InvalidPythAccount
        );

        let price_feed = SolanaPriceAccount::account_info_to_feed(&pyth_feed_account_info)
            .map_err(|_| StableGuardError::InvalidPythAccount)?;

        // let price_feed = price_feed_prev.unwrap();
        let price_data = price_feed
            .get_price_no_older_than(current_pyth_time, constants::MAX_ORACLE_AGE_SECONDS)
            .ok_or(StableGuardError::OraclePriceStale)?;
        //price_data contains price(i64) expo(i32) confidence(u64)
        require!(
            price_data.conf < constants::MAX_CONFIDENCE_VALUE,
            StableGuardError::OracleConfidenceTooWide
        );

        let pyth_mantissa = price_data.price;

        let pyth_exponent = price_data.expo;

        const TARGET_DECIMALS: i32 = 8;
        // If pyth_exponent is -8 and TARGET_DECIMALS is 8, we need to multiply by 10^(8-8) = 10^0 = 1.

        let scaled_pyth_price: i64;

        if pyth_exponent > 0 {
            return err!(StableGuardError::OracleExponentUnexpected);
        }
        let scale_difference = pyth_exponent - (-TARGET_DECIMALS);

        if scale_difference > 0 {
            let multiplier = 10u64.pow(scale_difference as u32) as i64;
            scaled_pyth_price = pyth_mantissa
                .checked_mul(multiplier)
                .ok_or(StableGuardError::CalculationError)?;
        } else if scale_difference < 0 {
            let divisor = 10u64.pow((-scale_difference) as u32) as i64;
            require!(divisor != 0, StableGuardError::CalculationError);
            scaled_pyth_price = pyth_mantissa
                .checked_div(divisor)
                .ok_or(StableGuardError::CalculationError)?;
        } else {
            scaled_pyth_price = pyth_mantissa;
        }

        if scaled_pyth_price < constants::DEPEG_THRESHOLD_PRICE as i64 {
            //DEPEG condition met

            let payout_amt_to_transfer = policy.payout_amount;

            let collateral_pool = &mut self.collateral_pool_usdc_account;

            require!(
                collateral_pool.amount >= payout_amt_to_transfer,
                StableGuardError::InsufficientPoolCollateralForPayout
            );

            let authority_seeds_bump = bumps.pool_authority;
            let authority_seeds = &[constants::AUTHORITY_SEED, &[authority_seeds_bump]];
            let signer_seeds = &[&authority_seeds[..]];

            let transfer_payout_accounts = TransferChecked {
                from: collateral_pool.to_account_info(),
                mint: self.usdc_mint.to_account_info(),
                to: self.buyer_usdc_account.to_account_info(),
                authority: self.pool_authority.to_account_info(),
            };

            let cpi_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                transfer_payout_accounts,
                signer_seeds,
            );

            transfer_checked(cpi_ctx, payout_amt_to_transfer, self.usdc_mint.decimals)?;
            policy.status = PolicyStatus::ExpiredPaid;
            Ok(())
        } else {
            //No DEPEG
            let policy = &mut self.policy_account;
            policy.status = PolicyStatus::ExpiredNotPaid;

            Ok(())
        }
    }
}
