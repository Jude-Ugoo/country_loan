use anchor_lang::prelude::*;

#[account]
pub struct ProtocolConfig {
    pub intrest_rate_bps: u64,  // Interest rate in basis points (e.g., 300 = 3.00%)
    pub liquidation_threshold_bps: u64, // Liquidation threshold in basis points (e.g., 110 = 110%)
    pub price_stale_threshold: u64, // Price stale threshold in seconds (e.g., 3600 = 1 hour)
    pub admin: Pubkey, // Admin authority (for registering tokens etc)
}