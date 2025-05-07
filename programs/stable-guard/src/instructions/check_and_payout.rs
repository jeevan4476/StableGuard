pub use crate::constants;
use crate::{error::StableGuardError, PolicyAccount};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
    token_2022::{burn_checked, BurnChecked},
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

#[derive(Accounts)]
pub struct CheckAndPayout<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds=[constants::POLICY_SEED,policy_account.buyer.key().as_ref()],
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

    pub price_update: Account<'info, PriceUpdateV2>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> CheckAndPayout<'info> {
    pub fn check_payout(&mut self) -> Result<()> {
        todo!()
    }
}
