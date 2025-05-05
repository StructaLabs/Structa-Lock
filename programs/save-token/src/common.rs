//! Common accounts.

use crate::*;
use anchor_spl::token::{self, Mint, TokenAccount};

/// Common accounts for minting [SVE] tokens.
#[derive(Accounts)]
pub struct MintToCommon<'info> {
    /// [SVE account.
    pub SVE: AccountLoader<'info, SVE>,
    /// [token::Mint] of the [SVE].
    #[account(mut)]
    pub SVE_mint: Account<'info, Mint>,
    /// [SVE::yi_tokens].
    #[account(mut)]
    pub SVE_yi_tokens: Account<'info, TokenAccount>,

    /// [TokenAccount] receiving the newly minted tokens.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// [token] program.
    pub token_program: Program<'info, token::Token>,
}

impl<'info> Validate<'info> for MintToCommon<'info> {
    fn validate(&self) -> Result<()> {
        let SVE = SVE.loadSVE
        assert_keys_eq!(self.SVE_mint, SVE.mint);
        assert_keys_eq!(self.SVE_yi_tokens, SVE.yi_tokens);

        assert_keys_eq!(self.to.mint, SVE.mint);
        Ok(())
    }
}

impl<'info> MintToCommon<'info> {
    pub(crate) fn mint_SVE(&self, amount: u64) -> Result<()> {
        let SVE = self.SVE.load()?;
        let signer_seeds: &[&[&[u8]]] = SVE_seeds!(SVE);
        token::mint_to(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.SVE_mint.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.SVE.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )
    }
}
