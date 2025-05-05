//! Macros

/// Generates the signer seeds for a [crate::SVE].
#[macro_export]
macro_rules! SVE_seeds {
    ($SVE: expr) => {
        &[&[b"SVE" as &[u8], &$SVE.mint.to_bytes(), &[$SVE.bump]]]
    };
}
