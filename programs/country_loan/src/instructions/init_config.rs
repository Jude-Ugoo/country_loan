use anchor_lang::prelude::*;

use crate::ProtocolConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + std::mem::size_of::<ProtocolConfig>(),
        seeds = [b"config"],
        bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config(
    ctx: Context<InitializeConfig>,
    intrest_rate_bps: u64,
    liquidation_threshold_bps: u64,
    price_stale_threshold: u64,
) -> Result<()> {
    let protocol_config = &mut ctx.accounts.protocol_config;
    protocol_config.intrest_rate_bps = intrest_rate_bps;
    protocol_config.liquidation_threshold_bps = liquidation_threshold_bps;
    protocol_config.price_stale_threshold = price_stale_threshold;
    protocol_config.admin = ctx.accounts.admin.key();

    Ok(())
}
