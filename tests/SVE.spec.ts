import { GokiSDK } from "@gokiprotocol/client";
import { assertTXSuccess } from "@saberhq/chai-solana";
import type { Token } from "@saberhq/token-utils";
import { TokenAmount, TokenAugmentedProvider, u64 } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createLocker, StructaSDK } from "@structa/structa-sdk";
import BN from "bn.js";
import { expect } from "chai";
import invariant from "tiny-invariant";

import type { SVEData } from "../src";
import { DEFAULT_MIN_LOCK_DURATION } from "../src/constants";
import { SVEWrapper } from "../src/wrappers/SVE/SVE";
import { makeSDK } from "./workspace/workspace";

describe("SVE", () => {
  const { provider } = makeSDK();

  const adminKP = Keypair.generate();
  const adminSDK = new SVEWrapper(provider.withSigner(adminKP));

  const recipientKP = Keypair.generate();
  const recipientSDK = new SVEWrapper(provider.withSigner(recipientKP));

  before(async () => {
    await (
      await adminSDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
    ).wait();
    await (
      await recipientSDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
    ).wait();
  });

  let locker: PublicKey;
  let govToken: Token;

  before("set up governance", async () => {
    const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
    govToken = await tokenProvider.createToken();

    const structaSDK = StructaSDK.load({ provider: adminSDK.provider });
    const { createTXs, lockerWrapper } = await createLocker({
      sdk: structaSDK,
      gokiSDK: GokiSDK.load({ provider: structaSDK.provider }),
      govTokenMint: govToken.mintAccount,
    });
    for (const { tx, title } of createTXs) {
      await assertTXSuccess(tx, title);
    }
    locker = lockerWrapper.locker;
  });

  it("should allow creating a SVE", async () => {
    const SVEMintKP = Keypair.generate();
    const {
      tx: createSVETX,
      SVE,
      SVEToken,
    } = await adminSDK.createSVE({
      underlyingToken: govToken,
      locker,
      mintKP: SVEMintKP,
    });
    await assertTXSuccess(createSVETX);

    const SVEData = await adminSDK.fetchSVE(SVE);
    invariant(SVEData);

    expect(SVEData.locker).to.eqAddress(locker);
    expect(SVEData.minLockDuration).to.bignumber.eq(
      new BN(DEFAULT_MIN_LOCK_DURATION)
    );
    expect(SVEData.mint).to.eqAddress(SVEMintKP.publicKey);
    expect(SVEData.mint).to.eqAddress(SVEToken.mintAccount);
  });

  describe("mint and lock tokens", () => {
    let SVE: PublicKey;
    let SVEToken: Token;
    let yiToken: Token;
    let SVEData: SVEData;

    beforeEach("create the SVE", async () => {
      const SVEMintKP = Keypair.generate();
      const { tx: createSVETX, ...createResult } = await adminSDK.createSVE({
        underlyingToken: govToken,
        locker,
        mintKP: SVEMintKP,
      });
      await assertTXSuccess(createSVETX);

      SVE = createResult.SVE;
      yiToken = createResult.yiToken;
      SVEToken = createResult.SVEToken;
      const result = await adminSDK.fetchSVE(SVE);
      invariant(result);
      SVEData = result;
    });

    it("mint and lock from Yi, new escrow", async () => {
      const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: recipientSDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        await recipientSDK.yi.stake({
          yiTokenMint: yiToken.mintAccount,
          amount: new u64(1_000_000),
        })
      );
      await assertTXSuccess(
        await recipientSDK.mintFromYi({
          amount: new u64(1_000_000),
          SVEData,
        })
      );

      await assertTXSuccess(
        await recipientSDK.lock({
          amount: new TokenAmount(SVEToken, 1_000_000),
          duration: DEFAULT_MIN_LOCK_DURATION + 1_000,
        })
      );
    });

    it("mint and lock from Yi, existing escrow", async () => {
      const rec2KP = Keypair.generate();
      const rec2SDK = new SVEWrapper(provider.withSigner(rec2KP));
      await (
        await rec2SDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
      ).wait();

      const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: rec2SDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        await rec2SDK.yi.stake({
          yiTokenMint: yiToken.mintAccount,
          amount: new u64(1_000_000),
        })
      );
      await assertTXSuccess(
        await rec2SDK.mintFromYi({
          amount: new u64(1_000_000),
          SVEData,
        })
      );

      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: rec2SDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        (
          await rec2SDK.createEscrow({
            locker,
            underlyingMint: govToken.mintAccount,
          })
        ).tx
      );

      await assertTXSuccess(
        await rec2SDK.lock({
          amount: new TokenAmount(SVEToken, 1_000_000),
          duration: DEFAULT_MIN_LOCK_DURATION + 1_000,
        })
      );
    });

    it("mint and lock from underlying, new escrow", async () => {
      const rec3KP = Keypair.generate();
      const rec3SDK = new SVEWrapper(provider.withSigner(rec3KP));
      await (
        await rec3SDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
      ).wait();

      const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: rec3SDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        await rec3SDK.mintFromUnderlying({
          amount: new u64(1_000_000),
          SVEData,
        })
      );

      await assertTXSuccess(
        await rec3SDK.lock({
          amount: new TokenAmount(SVEToken, 1_000_000),
          duration: DEFAULT_MIN_LOCK_DURATION + 1_000,
        })
      );
    });
  });
});
