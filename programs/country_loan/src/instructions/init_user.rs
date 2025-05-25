use anchor_lang::prelude::*;
use crate::UserAccount;

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + std::mem::size_of::<UserAccount>(),
        seeds = [b"user", user.key().as_ref()], // This guarantees uniqueness per wallet and allows fetching by public key.
        bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    user_account.owner = ctx.accounts.user.key();
    user_account.total_collateral_usd = 0;
    user_account.total_debt_usd = 0;
    user_account.bump = ctx.bumps.user_account;

    Ok(())
}