import { YI_ADDRESSES, YiSDK } from "@crateprotocol/yi";
import { newProgram } from "@saberhq/anchor-contrib";
import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { TokenAmount } from "@saberhq/token-utils";
import {
  createInitMintInstructions,
  getATAAddress,
  getOrCreateATA,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@saberhq/token-utils";
import type { PublicKey, Signer } from "@solana/web3.js";
import { Keypair, SystemProgram } from "@solana/web3.js";
import type { EscrowData } from "@structa/structa-sdk";
import {
  findEscrowAddress,
  STRUCTA_ADDRESSES,
  STRUCTA_CODERS,
  STRUCTASDK,
} from "@structa/structa-sdk";

import type { SVEData, SVEProgram } from "../..";
import {
  DEFAULT_MIN_LOCK_DURATION,
  SVE_ADDRESSES,
  SVE_CODERS,
  SVETokenIDL,
} from "../..";
import { findSVEAddress } from "./pda";

/**
 * Handles interacting with the STRUCTALOCK program.
 */
export class SVEWrapper {
  readonly provider: AugmentedProvider;
  readonly yi: YiSDK;
  readonly program: SVEProgram;

  /**
   * Constructor for a {@link STRUCTALOCKWrapper}.
   * @param sdk
   */
  constructor(simpleProvider: Provider) {
    this.provider = new SolanaAugmentedProvider(simpleProvider);
    this.program = newProgram(SVETokenIDL, SVE_ADDRESSES.SVE, this.provider);
    this.yi = YiSDK.load({ provider: this.provider });
  }

  /**
   * Creates a new instance of the SDK with the given signer.
   */
  withSigner(signer: Signer): SVEWrapper {
    return new SVEWrapper(this.provider.withSigner(signer));
  }

  /**
   * Fetches a SVE.
   * @param key
   * @returns
   */
  async fetchSVE(key: PublicKey): Promise<SVEData | null> {
    return await this.program.account.SVE.fetchNullable(key);
  }

  /**
   * Creates a SVE.
   * @returns
   */
  async createSVE({
    underlyingToken,
    locker,
    minLockDuration = DEFAULT_MIN_LOCK_DURATION,
    mintKP = Keypair.generate(),
    payer = this.provider.wallet.publicKey,
    yiMintKP = Keypair.generate(),
  }: {
    underlyingToken: Token;
    locker: PublicKey;
    minLockDuration?: number;
    mintKP?: Signer;
    /**
     * Payer of the initial tokens.
     */
    payer?: PublicKey;
    yiMintKP?: Signer;
  }): Promise<{
    SVE: PublicKey;
    SVEToken: Token;
    yiToken: Token;
    tx: TransactionEnvelope;
  }> {
    const {
      tx: createYiTX,
      yiToken,
      mint: yiMint,
    } = await this.yi.createYiToken({
      underlyingToken,
      mintKP: yiMintKP,
      payer,
    });
    const [SVE] = await findSVEAddress(mintKP.publicKey);
    const initMintTX = await createInitMintInstructions({
      provider: this.provider,
      mintKP,
      decimals: underlyingToken.decimals,
      mintAuthority: SVE,
      freezeAuthority: SVE,
    });
    const yiTokensATA = await getOrCreateATA({
      provider: this.provider,
      mint: yiMint,
      owner: SVE,
    });
    const SVETX = this.provider.newTX([
      yiTokensATA.instruction,
      this.program.instruction.createSVE(new u64(minLockDuration), {
        accounts: {
          SVEMint: mintKP.publicKey,
          SVE,
          yi: yiToken,
          yiMint,
          yiTokens: yiTokensATA.address,
          locker,
          payer,
          systemProgram: SystemProgram.programId,
        },
      }),
    ]);
    return {
      SVE,
      SVEToken: Token.fromMint(mintKP.publicKey, underlyingToken.decimals, {
        ...underlyingToken.info,
        name: `SVE of ${underlyingToken.info.name}`,
      }),
      yiToken: Token.fromMint(yiMintKP.publicKey, underlyingToken.decimals, {
        ...underlyingToken.info,
        name: `Yi of SVE of ${underlyingToken.info.name}`,
      }),
      tx: TransactionEnvelope.combineAll(createYiTX, initMintTX, SVETX),
    };
  }

  async createEscrow({
    locker,
    underlyingMint,
    userAuthority = this.provider.wallet.publicKey,
    payer = this.provider.wallet.publicKey,
  }: {
    locker: PublicKey;
    underlyingMint: PublicKey;
    /**
     * User.
     */
    userAuthority?: PublicKey;
    payer?: PublicKey;
  }) {
    const structaSDK = StructaSDK.load({
      provider: this.provider,
    });
    const [escrow, bump] = await findEscrowAddress(locker, userAuthority);
    const { instruction: createATA, address: escrowTokensAddress } =
      await getOrCreateATA({
        provider: this.provider,
        mint: underlyingMint,
        owner: escrow,
        payer,
      });
    const newEscrowIX = structaSDK.programs.LockedVoter.instruction.newEscrow(
      bump,
      {
        accounts: {
          locker,
          escrow,
          escrowOwner: userAuthority,
          payer,
          systemProgram: SystemProgram.programId,
        },
      }
    );
    return {
      escrowTokensAddress,
      tx: this.provider.newTX([createATA, newEscrowIX]),
    };
  }

  /**
   * Locks SVE tokens to convert into veTokens.
   * @returns
   */
  async lock({
    amount,
    duration,
    userAuthority = this.provider.wallet.publicKey,
    payer,
  }: {
    /**
     * Amount of SVE tokens to redeem.
     */
    amount: TokenAmount;
    duration: number;
    /**
     * User.
     */
    userAuthority?: PublicKey;
    payer?: PublicKey;
  }) {
    const [SVE] = await findSVEAddress(amount.token.mintAccount);
    const SVEData = await this.program.account.SVE.fetch(SVE);
    const [escrow] = await findEscrowAddress(SVEData.locker, userAuthority);
    const escrowRaw = await this.provider.getAccountInfo(escrow);
    if (!escrowRaw) {
      const { tx: createEscrowTX, escrowTokensAddress } =
        await this.createEscrow({
          locker: SVEData.locker,
          underlyingMint: SVEData.underlyingMint,
          userAuthority,
          payer,
        });
      const lockTX = await this.lockWithData({
        amount,
        duration,
        SVEData,
        escrowData: { tokens: escrowTokensAddress },
        userAuthority,
      });
      return createEscrowTX.combine(lockTX);
    } else {
      const escrowData = Structa_CODERS.LockedVoter.accountParsers.escrow(
        escrowRaw.accountInfo.data
      );
      return await this.lockWithData({
        amount,
        duration,
        SVEData,
        escrowData,
        userAuthority,
      });
    }
  }

  /**
   * Mints SVE tokens from underlying tokens.
   * @returns
   */
  async mintFromUnderlying({
    amount,
    yiUnderlyingTokens,
    sourceUnderlyingTokens,
    to,
    SVEData: {
      yiTokens: SVEYiTokens,
      yiMint,
      yi,
      underlyingMint,
      mint: SVEMint,
    },
    sourceAuthority = this.provider.walletKey,
  }: {
    /**
     * Amount of underlying tokens to mint SVE tokens from.
     */
    amount: u64;
    /**
     * Token account to send tokens to. Defaults to the `sourceAuthority`'s ATA.
     */
    to?: PublicKey;
    /**
     * Yi's underlying tokens. Defaults to the ATA of the Yi.
     */
    yiUnderlyingTokens?: PublicKey;
    /**
     * Token account holding underlying tokens. Defaults to the `sourceAuthority`'s ATA.
     */
    sourceUnderlyingTokens?: PublicKey;
    /**
     * SVE data.
     */
    SVEData: Pick<
      SVEData,
      "yiTokens" | "locker" | "yi" | "yiMint" | "underlyingMint" | "mint"
    >;
    /**
     * User.
     */
    sourceAuthority?: PublicKey;
  }) {
    const [SVE] = await findSVEAddress(SVEMint);
    const toATA = await getOrCreateATA({
      provider: this.provider,
      mint: SVEMint,
      owner: sourceAuthority,
    });
    return this.provider.newTX([
      !to ? toATA.instruction : null,
      SVE_CODERS.SVE.encodeIX(
        "mintFromUnderlying",
        {
          underlyingAmount: amount,
        },
        {
          common: {
            SVE,
            SVEMint,
            SVEYiTokens,
            to: to ?? toATA.address,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          yi,
          yiMint,
          yiUnderlyingTokens:
            yiUnderlyingTokens ??
            (await getATAAddress({
              mint: underlyingMint,
              owner: yi,
            })),
          sourceUnderlyingTokens:
            sourceUnderlyingTokens ??
            (await getATAAddress({
              mint: underlyingMint,
              owner: sourceAuthority,
            })),
          sourceAuthority,
          yiProgram: YI_ADDRESSES.Yi,
        }
      ),
    ]);
  }

  /**
   * Mints SVE tokens from Yi tokens.
   * @returns
   */
  async mintFromYi({
    amount,
    to,
    sourceYiTokens,
    SVEData: { yiTokens: SVEYiTokens, yiMint, mint: SVEMint },
    sourceAuthority = this.provider.walletKey,
  }: {
    /**
     * Amount of Yi tokens to mint SVE tokens from.
     */
    amount: u64;
    /**
     * Token account to send tokens to. Defaults to the `userAuthority`'s ATA.
     */
    to?: PublicKey;
    /**
     * Token account holding Yi tokens. Defaults to the `sourceAuthority`'s ATA.
     */
    sourceYiTokens?: PublicKey;
    /**
     * SVE data.
     */
    SVEData: Pick<SVEData, "yiTokens" | "yiMint" | "mint">;
    /**
     * User.
     */
    sourceAuthority?: PublicKey;
  }) {
    const [SVE] = await findSVEAddress(SVEMint);
    const toATA = await getOrCreateATA({
      provider: this.provider,
      mint: SVEMint,
      owner: sourceAuthority,
    });
    return this.provider.newTX([
      !to ? toATA.instruction : null,
      SVE_CODERS.SVE.encodeIX(
        "mintFromYi",
        {
          yiAmount: amount,
        },
        {
          common: {
            SVE,
            SVEMint,
            SVEYiTokens,
            to: to ?? toATA.address,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          sourceYiTokens:
            sourceYiTokens ??
            (await getATAAddress({
              mint: yiMint,
              owner: sourceAuthority,
            })),
          sourceAuthority,
        }
      ),
    ]);
  }

  /**
   * Locks tokens with the given SVE data.
   * @returns
   */
  async lockWithData({
    amount,
    duration,
    SVEData: {
      yiTokens: SVEYiTokens,
      locker,
      yi: yiToken,
      yiMint,
      underlyingMint,
    },
    escrowData: { tokens: escrowTokens },
    userAuthority = this.provider.wallet.publicKey,
  }: {
    /**
     * Amount of SVE tokens to redeem.
     */
    amount: TokenAmount;
    duration: number;
    SVEData: Pick<
      SVEData,
      "yiTokens" | "locker" | "yi" | "yiMint" | "underlyingMint"
    >;
    escrowData: Pick<EscrowData, "tokens">;
    /**
     * User.
     */
    userAuthority?: PublicKey;
  }): Promise<TransactionEnvelope> {
    const [escrow] = await findEscrowAddress(locker, userAuthority);
    const [SVE] = await findSVEAddress(amount.token.mintAccount);
    const userSVEATA = await getATAAddress({
      mint: amount.token.mintAccount,
      owner: userAuthority,
    });
    const userUnderlyingATA = await getOrCreateATA({
      provider: this.provider,
      mint: underlyingMint,
      owner: userAuthority,
    });
    return this.provider.newTX([
      userUnderlyingATA.instruction,
      SVE_CODERS.SVE.encodeIX(
        "lock",
        {
          amount: amount.toU64(),
          duration: new u64(duration),
        },
        {
          SVE,
          SVEMint: amount.token.mintAccount,
          SVEYiTokens,
          userSVETokens: userSVEATA,
          userUnderlyingTokens: userUnderlyingATA.address,
          lock: {
            locker,
            escrow,
            escrowTokens,
          },
          yi: {
            yiToken,
            yiMint,
            yiUnderlyingTokens: await getATAAddress({
              owner: yiToken,
              mint: underlyingMint,
            }),
          },
          userAuthority,
          systemProgram: SystemProgram.programId,
          yiTokenProgram: YI_ADDRESSES.Yi,
          lockedVoterProgram: Structa_ADDRESSES.LockedVoter,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      ),
    ]);
  }
}
