import { utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import { SVE_ADDRESSES } from "../..";

/**
 * Finds the address of a SVE.
 */
export const findSVEAddress = async (
  mint: PublicKey
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode("SVE"), mint.toBuffer()],
    SVE_ADDRESSES.SVE
  );
};
