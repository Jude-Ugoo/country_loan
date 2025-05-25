use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{CollateralVault, ProtocolConfig};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction()]
pub struct RegisterToken<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + std::mem::size_of::<CollateralVault>(),
        seeds = [b"vault", admin.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub collateral_vault: Account<'info, CollateralVault>,

    #[account(
        has_one = admin @ ErrorCode::Unauthorized,
        seeds = [b"config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: The vault address is a token account, validated in the handler
    pub vault_address: UncheckedAccount<'info>,

    /// CHECK: The token mint, validated by the program if needed
    pub token_mint: UncheckedAccount<'info>,

    /// CHECK: The price feed address (e.g., Pyth price feed PDA), validated in future tasks
    pub price_feed: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}


pub fn register_token(
    ctx: Context<RegisterToken>,
    vault_address: Pubkey,
    token_mint: Pubkey,
    price_feed: Pubkey,
) -> Result<()> {
    let collateral_vault = &mut ctx.accounts.collateral_vault;
    collateral_vault.token_mint = token_mint;
    collateral_vault.vault_address = vault_address;
    collateral_vault.price_feed = price_feed;

    Ok(())
}
