use anchor_lang::prelude::*;

#[account]
pub struct Loan {
    pub borrower: Pubkey,
    pub collateral_vault: Pubkey, // CollateralVault PDA for the collateral token
    pub loan_amount: u64,         // Loan amount in stablecoin (e.g., USDC)
    pub collateral_amount: u64,   // Collateral amount in token (e.g., WETH)
    pub interest_rate_bps: u64,   // Interest rate in basis points
    pub start_timestamp: i64,     // Loan start timestamp
    pub duration: u64,            // Loan duration in seconds
    pub is_active: bool,          // Loan status
}
