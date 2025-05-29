use anchor_lang::prelude::*;
use pyth_sdk_solana::state::{load_price_account, SolanaPriceAccount};

use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct FetchPrice<'info> {
    /// CHECK: This is a Pyth price feed account, validated by the program
    pub price_feed: AccountInfo<'info>,
}

pub fn fetch_price(ctx: Context<FetchPrice>) -> Result<u64> {
    let price_feed_data = ctx.accounts.price_feed.data.borrow();

    // Load the price account with explicit type annotation
    let price_account: &SolanaPriceAccount =
        load_price_account(&price_feed_data).map_err(|_| error!(ErrorCode::InvalidPrice))?;

    // Check if the price is valid and not stale
    let clock = Clock::get()?;
    let price_data = price_account
        .get_price_no_older_than(&clock, 60)
        .ok_or_else(|| error!(ErrorCode::InvalidPrice))?;

    // Ensure price is positive
    let price: u64 = price_data
        .price
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidPrice))?;

        if price == 0 {
            return Err(error!(ErrorCode::InvalidPrice));
        }

    Ok(price)
}
