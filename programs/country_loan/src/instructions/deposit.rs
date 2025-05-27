use anchor_lang::prelude::*;
use anchor_spl::token::{self, transfer, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::{CollateralVault, UserAccount};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        seeds = [b"vault", admin.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub collateral_vault: Account<'info, CollateralVault>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        constraint = user_token_account.mint == token_mint.key() @ ErrorCode::InvalidTokenMint,
        constraint = user_token_account.owner == user.key() @ ErrorCode::InvalidTokenOwner,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.mint == token_mint.key() @ ErrorCode::InvalidTokenMint,
        constraint = vault_token_account.key() == collateral_vault.vault_address @ ErrorCode::InvalidVaultAddress,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: The token mint, validated by constraints
    pub token_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64, token_index: u8) -> Result<()> {
    // Validate token_index
    require!(token_index < 8, ErrorCode::InvalidTokenMint);

    // Transfer tokens from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    // Update UserAccount token balances
    let user_account = &mut ctx.accounts.user_account;
    let old_balance = user_account.token_balances[token_index as usize];
    user_account.token_balances[token_index as usize] = user_account.token_balances
        [token_index as usize]
        .checked_add(amount)
        .ok_or(error!(ErrorCode::InvalidTokenMint))?;

    msg!("Deposit successful:");
    msg!("Token index: {}", token_index);
    msg!("Amount deposited: {}", amount);
    msg!("Previous balance: {}", old_balance);
    msg!(
        "New balance: {}",
        user_account.token_balances[token_index as usize]
    );
    msg!("User account owner: {}", user_account.owner);

    Ok(())
}
