use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum PolicyStatus {
    Active,
    ExpiredPaid,
    ExpiredNotPaid,
}
