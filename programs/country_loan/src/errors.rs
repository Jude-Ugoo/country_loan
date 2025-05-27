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
}
