use anchor_lang::prelude::*;

#[error_code]
pub enum StableGuardError {
    #[msg("Insufficient funds to pay the premium.")]
    InsufficientPremiumFunds,

    #[msg("Insufficient funds to pay the payout.")]
    InsufficientPayoutFunds,

    #[msg("Policy has not expired.")]
    PolicyNotExpired,

    #[msg("Policy has already been processed (paid out or expired normally).")]
    PolicyAlreadyProcessed,

    #[msg("Oracle Price feed is too old.")]
    OraclePriceStale,

    #[msg("Oracle price feed status is not Trading.")]
    OraclePriceNotTrading,

    #[msg("Oracle price confidence interval is too wide.")]
    OracleConfidenceTooWide,

    #[msg("Collateral pool does not have sufficient funds for the payout.")]
    InsufficientPoolCollateralForPayout,

    #[msg("Withdrawal amount exceeds the underwriter's calculated available balance.")]
    WithdrawalAmountExceedsBalance, //use if tracking individual LP shares accurately

    #[msg("Withdrawal amount exceeds the total balance in the collateral pool.")]
    WithdrawalAmountExceedsPoolBalance, // Fallback check

    #[msg("Withdrawal conditions not met (e.g., lockup period).")]
    WithdrawalConditionsNotMet, // Include if implementing specific conditions

    #[msg("The provided Pyth account address is incorrect for the insured stablecoin.")]
    InvalidPythAccount,

    #[msg("An arithmetic error occurred during calculations.")]
    CalculationError,
}
