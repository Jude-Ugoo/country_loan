use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only the admin can perform this action")]
    Unauthorized,
    #[msg("Token mint does not match")]
    InvalidTokenMint,
    #[msg("Token account owner does not match user")]
    InvalidTokenOwner,
    #[msg("Vault address does not match collateral vault")]
    InvalidVaultAddress,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Invalid token index")]
    InvalidTokenIndex,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Invalid or stale price feed")]
    InvalidPrice,
    #[msg("The given account is owned by a different program than expected")]
    AccountOwnedByWrongProgram,
}
