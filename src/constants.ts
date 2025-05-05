import { buildCoderMap } from "@saberhq/anchor-contrib";
import { PublicKey } from "@solana/web3.js";

import type { SVEProgram, SVETypes } from "./programs";
import { SVETokenIDL } from "./programs";

/**
 * SVE program types.
 */
export interface SVEPrograms {
  SVE: SVEProgram;
}

/**
 * Program IDLs.
 */
export const SVE_IDLS = {
  SVE: SVETokenIDL,
};

/**
 * Coders.
 */
export const SVE_CODERS = buildCoderMap<{
  SVE: SVETypes;
}>(SVE_IDLS, SVE_ADDRESSES);

/**
 * Default minimum lock duration (1 year).
 */
export const DEFAULT_MIN_LOCK_DURATION = 365 * 24 * 60 * 60;
