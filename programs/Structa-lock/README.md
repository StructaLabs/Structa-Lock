<p align="center">
    <img src="https://raw.githubusercontent.com/StructaLabs/Structa-Lock/master/images/banner.png" />
</p>

## StructaLock - Vote-Escrowed Token Standard for Structa

StructaLock is a simple and robust mechanism for issuing vote-escrowed tokens (veTokens) within the Structa governance ecosystem.

It allows tokens to be locked for a defined duration, enabling long-term alignment without compromising transferability where not required. This is especially useful for DAO grants, contributor incentives, and long-tail governance design.

## Overview

StructaLock introduces a structured format for vote-escrowed token issuance. These tokens are not directly interchangeable with the underlying asset, ensuring that recipients are aligned with the DAO’s long-term incentives and governance.

StructaLock is currently in active development. Follow updates and community progress here:

- X: <https://x.com/StructaLabs>.

## Architecture

StructaLock builds on a three-token model:

- **Underlying token** — the asset intended to be locked for governance participation.
- **Backing token** — a 1:1 backed asset that underlies the locked token (can be modified to control veToken issuance logic).
- **veToken** — the vote-escrowed token itself, used for on-chain voting and proposal activation.

This model gives DAOs greater flexibility over incentive timing and voting structure while maintaining predictable economic security.

## Status

- **StructaLock is under active development.**
- **This codebase is unaudited and should not be used in production environments without proper review.**

## Contributing

We welcome contributions of any size from small fixes to new features.

If you're building with Structa or using this module in your governance flow, feel free to submit improvements or open issues. Please adhere to the following guidelines:

- Use consistent formatting tools (e.g. `rustfmt` and `prettier`).
- Keep comments clear, with a maximum line length of 80 characters.
- Prefix commits with relevant package scope (e.g., `structa-lock:`).

## License

StructaLock is released under the GNU Affero General Public License v3.0.

By using this software, you agree that any derivative works, even if used privately, must also be open-sourced under the same license.
