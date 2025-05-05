//! Instruction handler for [SVE_token::create_SVE].

use crate::*;
use anchor_spl::token::{Mint, TokenAccount};
use locked_voter::Locker;
use yi::YiToken;

/// Accounts for [SVE_token::create_SVE].
#[derive(Accounts)]
pub struct CreateSVE<'info> {
    /// [token::Mint] of the [SVE].
    pub SVE_mint: Account<'info, Mint>,
    /// [SVE] account.
    #[account(
        init,
        seeds = [
            b"SVE".as_ref(),
            SVE_mint.key().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub SVE: AccountLoader<'info, SVE>,
    /// Yi token backed by the underlying token to lock up. [SVE::yi].
    pub yi: AccountLoader<'info, YiToken>,
    /// Mint of the [YiToken]. [SVE::yi_mint].
    pub yi_mint: Account<'info, Mint>,
    /// [TokenAccount] holding Yi tokens. [SVE::yi_tokens].
    pub yi_tokens: Account<'info, TokenAccount>,
    /// [Locker]. [SVE::locker].
    pub locker: Account<'info, Locker>,

    /// Payer for the [SVE] account creation.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [System] program.
    pub system_program: Program<'info, System>,
}

impl<'info> CreateSVE<'info> {
    fn init_SVE(&mut self, bump: u8, min_lock_duration: u64) -> Result<()> {
        let SVE = &mut self.SVE.load_init()?;
        SVE.mint = self.SVE_mint.key();
        SVE.min_lock_duration = min_lock_duration;
        SVE.bump = bump;

        let yi = self.yi.load()?;
        SVE.underlying_mint = yi.underlying_token_mint;
        SVE.yi_mint = yi.mint;
        SVE.yi = self.yi.key();
        SVE.yi_tokens = self.yi_tokens.key();
        SVE.locker = self.locker.key();
        Ok(())
    }
}

pub fn handler(ctx: Context<CreateSVE>, min_lock_duration: u64) -> Result<()> {
    ctx.accounts
        .init_SVE(unwrap_bump!(ctx, "SVE"), min_lock_duration)
}

impl<'info> Validate<'info> for CreateSVE<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.SVE_mint.mint_authority.unwrap(), self.SVE);
        assert_keys_eq!(self.SVE_mint.freeze_authority.unwrap(), self.SVE);
        invariant!(self.SVE_mint.supply == 0);

        let yi = self.yi.load()?;
        invariant!(yi.stake_fee_millibps == 0);
        invariant!(yi.unstake_fee_millibps == 0);

        assert_keys_eq!(yi.mint, self.yi_mint);
        invariant!(self.yi_mint.supply == 0);
        invariant!(self.SVE_mint.decimals == self.yi_mint.decimals);

        assert_keys_eq!(self.yi_tokens.owner, self.SVE);
        assert_keys_eq!(self.yi_tokens.mint, self.yi_mint);
        assert_is_zero_token_account!(self.yi_tokens);
        Ok(())
    }
}
