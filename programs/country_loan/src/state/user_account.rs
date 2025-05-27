use anchor_lang::prelude::*;

#[account]
pub struct UserAccount {
    pub owner: Pubkey,            // User's public key
    pub token_balances: [u64; 8], // Balances for up to 8 supported tokens
    pub has_active_loan: bool,    // Indicates if user has an active loan
}
