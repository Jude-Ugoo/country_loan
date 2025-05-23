use anchor_lang::prelude::*;

#[account]
pub struct UserAccount {
    pub owner: Pubkey, // The wallet that owns this position
    pub total_collateral_usd: u64, // Sum of collateral value (USD, 6 decimals)
    pub total_debt_usd: u64, // Sum of borrowed value (USD, 6 decimals)
    pub bump: u8, // For PDA derivation
}