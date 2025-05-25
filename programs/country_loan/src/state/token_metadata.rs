use anchor_lang::prelude::*;

#[account]
pub struct CollateralVault {
    pub vault_address: Pubkey, // Address of the token account holding collateral
    pub token_mint: Pubkey,   // Mint address of the token
    pub price_feed: Pubkey,   // Address of the Chainlink price feed
}