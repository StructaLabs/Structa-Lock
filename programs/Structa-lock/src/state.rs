//! Struct definitions for accounts that hold state.

use crate::*;

/// A class of tokens that must be ve-locked for a minimum duration.
///
/// When a [SVE] is created, there is one token created for every underlying
/// token backing the [SVE].
#[account(zero_copy)]
#[derive(Debug, Default)]
pub struct SVE {
    /// The mint of the [SVE] token.
    pub mint: Pubkey,
    /// Bump seed.
    pub bump: u8,

    _padding: [u8; 7],

    /// The minimum duration that the tokens must be locked for.
    pub min_lock_duration: u64,
    /// The mint of the SPL token locked up.
    pub underlying_mint: Pubkey,
    /// Mint of the Yi token.
    pub yi_mint: Pubkey,
    /// The YiToken key.
    pub yi: Pubkey,
    /// Token account holding the [Self::yi_mint] tokens of this [SVE].
    pub yi_tokens: Pubkey,
    /// Locker.
    pub locker: Pubkey,
}
