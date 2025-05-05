import type { Program } from "@project-serum/anchor";
import type { AnchorTypes } from "@saberhq/anchor-contrib";

import type { SVETokenIDLType } from "../idls/SVE_token";

export * from "../idls/SVE_token";

export type SVETypes = AnchorTypes<
  SVETokenIDLType,
  {
    SVE: SVEData;
  }
>;

type Accounts = SVETypes["Accounts"];

export type SVEData = Accounts["SVE"];

export type SVEProgram = Program<SVETokenIDLType>;
