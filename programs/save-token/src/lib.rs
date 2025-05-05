#![deny(rustdoc::all)]
#![allow(rustdoc::missing_doc_code_examples)]
#![deny(clippy::unwrap_used)]

mod macros;

use anchor_lang::prelude::*;
use vipers::prelude::*;

mod common;
mod instructions;
mod state;

pub(crate) use common::*;
use instructions::*;
pub use state::*;

//!declare_id!("STRUCTd9pSFnckWdDSACSbhEUGFFTzwDRAUiio");

/// The [SVE_token] program.
#[program]
pub mod SVE_token {
    use super::*;

    /// Creates a new [SVE].
    #[access_control(ctx.accounts.validate())]
    pub fn create_SVE(ctx: Context<CreateSVE>, min_lock_duration: u64) -> Result<()> {
        instructions::create_SVE::handler(ctx, min_lock_duration)
    }

    /// Locks [SVE] tokens for their underlying.
    #[access_control(ctx.accounts.validate())]
    pub fn lock(ctx: Context<Lock>, amount: u64, duration: u64) -> Result<()> {
        instructions::lock::handler(ctx, amount, duration)
    }

    /// Mints [SVE] tokens by locking up Yi tokens.
    #[access_control(ctx.accounts.validate())]
    pub fn mint_from_yi(ctx: Context<MintFromYi>, yi_amount: u64) -> Result<()> {
        instructions::mint_from_yi::handler(ctx, yi_amount)
    }

    /// Mints [SVE] tokens by locking up underlying tokens.
    #[access_control(ctx.accounts.validate())]
    pub fn mint_from_underlying(
        ctx: Context<MintFromUnderlying>,
        underlying_amount: u64,
    ) -> Result<()> {
        instructions::mint_from_underlying::handler(ctx, underlying_amount)
    }
}

/// Errors.
#[error_code]
pub enum ErrorCode {
    #[msg("SVE minimum duration not met.")]
    DurationExceeded,
    #[msg("Tokens may only be locked in the SVE's specified locker.")]
    LockerMismatch,
}
