use crate::UserAccount;
use anchor_lang::prelude::*;

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
    user_account.token_balances = [0; 8];
    user_account.has_active_loan = false;

    msg!("User account initialized for owner: {}", user_account.owner);
    msg!("Initial token balances: {:?}", user_account.token_balances);
    msg!("Has active loan: {}", user_account.has_active_loan);

    Ok(())
}
