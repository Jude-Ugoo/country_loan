use anchor_lang::prelude::*;

pub mod state;
pub use state::*;

pub mod instructions;
pub use instructions::*;

pub mod utils;
pub use utils::*;

pub mod errors;

declare_id!("rtqy7o2TA9AHytgZ7932gG1E5vhp3rSGkojnojdnNnP");

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

    pub fn register_token(
        ctx: Context<RegisterToken>,
        vault_address: Pubkey,
        token_mint: Pubkey,
        price_feed: Pubkey,
    ) -> Result<()> {
        register_token::register_token(ctx, vault_address, token_mint, price_feed)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64, token_index: u8) -> Result<()> {
        deposit::deposit(ctx, amount, token_index)
    }

    // pub fn init_loan()
}

#[derive(Accounts)]
pub struct Initialize {}
