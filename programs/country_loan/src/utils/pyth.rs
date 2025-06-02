use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct FetchPrice<'info> {
    /// CHECK: This is a Pyth price feed account, validated by the program
    pub price_update: UncheckedAccount<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn fetch_price(ctx: Context<FetchPrice>) -> Result<u64> {
    let price_update = &ctx.accounts.price_update;
    let clock = &ctx.accounts.clock;

    // Debug: Log the raw account data
    msg!("Raw account data: {:?}", price_update.data.borrow());

    // Manually deserialize the PriceUpdateV2 account
    let price_update_data: PriceUpdateV2 =
        PriceUpdateV2::try_deserialize(&mut &price_update.data.borrow()[..]).map_err(|e| {
            msg!("Deserialization error: {:?}", e);
            error!(ErrorCode::InvalidPrice)
        })?;

    // Verify the account owner (optional for local testing, required for devnet/mainnet)
    // Note: Comment out for local testing; uncomment for devnet/mainnet
    // let expected_owner = Pubkey::from_str("recirfFz1S3dB2FAcWqNgjsdPoBon5Xw5q2sLyRxTvJ")
    //     .map_err(|_| error!(ErrorCode::InvalidPrice))?;
    // if price_update.owner != &expected_owner {
    //     return Err(error!(ErrorCode::AccountOwnedByWrongProgram));
    // }

    // Verify the price update is for the expected feed (e.g., WETH/USD)
    // Note: For local testing, we skip feed ID validation. On devnet, use the correct feed ID.
    let expected_feed_id =
        get_feed_id_from_hex("0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace")
            .map_err(|_| error!(ErrorCode::InvalidPrice))?;

    if price_update_data.price_message.feed_id != expected_feed_id {
        return Err(error!(ErrorCode::InvalidPrice));
    }

    // Verify the price update is not stale (within 60 seconds)
    let price_feed = price_update_data
        .get_price_no_older_than(clock, 60, &expected_feed_id)
        .map_err(|_| error!(ErrorCode::InvalidPrice))?;

    // Extract the price and ensure it's positive
    let price: u64 = price_feed
        .price
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidPrice))?;

    // Ensure the price is non-zero
    if price == 0 {
        return Err(error!(ErrorCode::InvalidPrice));
    }

    Ok(price)
}
