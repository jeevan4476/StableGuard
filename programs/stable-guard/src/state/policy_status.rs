use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PolicyStatus {
    Active,
    ExpiredPaid,
    ExpiredNotPaid,
}
