use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::{user_account, CollateralVault, Loan, ProtocolConfig, UserAccount};

#[derive(Accounts)]
pub struct InitializeLoan<'info> {
    #[account(
        init_if_needed,
        payer = borrower,
        space = 8 + std::mem::size_of::<Loan>(),
        seeds = [b"loan", borrower.key().as_ref(), collateral_vault.key().as_ref()],
        bump
    )]
    pub loan: Account<'info, Loan>,

    #[account(
        mut,
        // has_one = borrower @ ErrorCode::Unauthorized,
        seeds = [b"user", borrower.key().as_ref()],
        bump,
        constraint = user_account.owner == borrower.key() @ ErrorCode::UnauthorizedAccess,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        seeds = [b"vault", admin.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub collateral_vault: Account<'info, CollateralVault>,

    #[account(
        seeds = [b"config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub borrower: Signer<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Token mint, validated by collateral_vault
    pub token_mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initalize_loan(
    ctx: Context<InitializeLoan>,
    loan_amount: u64,
    collateral_amount: u64,
    duration: u64,
    token_index: u8,
) -> Result<()> {
    // Validate inputs
    require!(loan_amount > 0, ErrorCode::InvalidAmount);
    require!(collateral_amount > 0, ErrorCode::InvalidAmount);
    require!(duration > 0, ErrorCode::InvalidDuration);
    require!(token_index < 8, ErrorCode::InvalidTokenIndex);

    // Validate collateral amount in UserAccount
    require!(
        ctx.accounts.user_account.token_balances[token_index as usize] >= collateral_amount,
        ErrorCode::InsufficientCollateral
    );

    let loan = &mut ctx.accounts.loan;

    loan.borrower = ctx.accounts.borrower.key();
    loan.collateral_vault = ctx.accounts.collateral_vault.key();
    loan.loan_amount = loan_amount;
    loan.collateral_amount = collateral_amount;
    loan.interest_rate_bps = ctx.accounts.protocol_config.intrest_rate_bps;
    loan.start_timestamp = Clock::get()?.unix_timestamp;
    loan.duration = duration;
    loan.is_active = true;

    //========================================= update userAccount ========================================
    let user_account = &mut ctx.accounts.user_account;
    user_account.token_balances[token_index as usize] = user_account.token_balances
        [token_index as usize]
        .checked_sub(collateral_amount)
        .ok_or(ErrorCode::ArithmeticError)?;

    user_account.has_active_loan = true;
    //=====================================================================================================

    Ok(())
}
