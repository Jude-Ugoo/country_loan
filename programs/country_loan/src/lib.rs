use anchor_lang::prelude::*;

pub mod state;
pub use state::*;

pub mod instructions;
pub use instructions::*;

declare_id!("4xjyVNqjK5CwSJJbMDHAdYnHMrEcc8wYAZ8QGz2Xx56P");

#[program]
pub mod country_loan {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        intrest_rate_bps: u64,
        liquidation_threshold_bps: u64,
        price_stale_threshold: u64,
    ) -> Result<()> {
        init_config::initialize_config(
            ctx,
            intrest_rate_bps,
            liquidation_threshold_bps,
            price_stale_threshold,
        )
    }

    pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
        init_user::init_user(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
