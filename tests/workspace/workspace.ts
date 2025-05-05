import * as anchor from "@project-serum/anchor";
import { makeSaberProvider } from "@saberhq/anchor-contrib";
import { chaiSolana } from "@saberhq/chai-solana";
import chai from "chai";

import type { SVEPrograms } from "../../src";
import { SVEWrapper } from "../../src";

chai.use(chaiSolana);

export type Workspace = SVEPrograms;

export const makeSDK = (): SVEWrapper => {
  const anchorProvider = anchor.Provider.env();
  anchor.setProvider(anchorProvider);
  const provider = makeSaberProvider(anchorProvider);
  return new SVEWrapper(provider);
};
