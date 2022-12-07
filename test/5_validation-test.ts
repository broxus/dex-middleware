import { fromNano, toNano, zeroAddress } from "locklift";

import { Context, preparation } from "./preparation";
import { PreBuiltRoutes } from "./constants";
import BigNumber from "bignumber.js";
import { DexMiddleware } from "./entities/dexMiddleware";
import { User } from "./entities/user";
import { expect } from "chai";

import { TokenWallet } from "./entities/tokenWallet";

describe("Validation testing", () => {
  let context: Context;
  let user: User;

  beforeEach(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
    debugger;
    context.setDexMiddleware(await DexMiddleware.deployDexInstance(user));
    await locklift.tracing.trace(
      context.dex
        .getTokenRootByName({ tokenName: "Qwe" })
        .methods.deployWallet({
          deployWalletValue: toNano(1),
          walletOwner: context.dexMiddleware.contract.address,
          answerId: 0,
        })
        .send({
          from: user.account.address,
          amount: toNano(2),
        }),
    );
  });

  it("user should receive tokens back", async () => {
    const { route, leaves, start_token } = PreBuiltRoutes.succesSimpleRoute;
    const TOKENS_AMOUNT_FOR_DEX = 1200;

    const START_TOKEN = "Qwe";
    let qweTokenWallet: TokenWallet = await user.getTokenWalletByRoot(
      context.dex.getTokenRootByName({ tokenName: START_TOKEN }),
    );
    const initialTokenBalance = new BigNumber(1200).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString();
    await context.dex.sendTokensTo({
      tokenName: START_TOKEN,
      receiver: user.account.address,
      amount: initialTokenBalance,
    });

    const [tstTokenRoot, coinTokenRoot, qweTokenRoot] = (["Tst", "Coin", START_TOKEN] as const).map(tokenName =>
      context.dex.getTokenRootByName({ tokenName }),
    );
    let payloadForDexMiddleware: string;
    const dexPoolFooBarQwe = context.dex.getDexPool("DexPoolFooBarQwe");
    describe("should ", async () => {
      beforeEach(async () => {
        const { payload, firstPool } = await context.dex.getPayload({
          recipient: zeroAddress,
          options: {
            amount: TOKENS_AMOUNT_FOR_DEX,
            route: [route],
            start_token: start_token,
          },
        });

        payloadForDexMiddleware = await context.dexMiddleware.getPayload({
          _payloadsForDex: [
            {
              dexPayload: payload,
              rootToSendersAllowanceMap: [
                [tstTokenRoot.address, [context.dex.getDexVault().address]],
                [coinTokenRoot.address, [context.dex.getDexVault().address]],
                [qweTokenRoot.address, [context.dexMiddleware.contract.address, dexPoolFooBarQwe.address]],
              ],
              remainingGasTo: user.account.address,
              cancelPayload: {
                payload: "",
                tokenReceiver: user.account.address,
                valueForFinalTransfer: toNano("0.2"),
                deployWalletValue: toNano("0.2"),
              },
              successPayload: {
                payload: "",
                tokenReceiver: user.account.address,
                valueForFinalTransfer: toNano("0.2"),
                deployWalletValue: toNano("0.2"),
              },
              deployWalletValue: toNano(1),
              attachedValue: toNano(10),
              firstRoot: firstPool,
              leaves,
              tokensAmount: new BigNumber(TOKENS_AMOUNT_FOR_DEX)
                .shiftedBy(Number(qweTokenWallet.tokenDecimals))
                .toString(),
            },
          ],
          _payloadsForTransfers: [],
          _payloadsForBurn: [],

          remainingTokensTo: user.account.address,
        });
      });
      it("all tokens should charged back because bad value attached", async () => {
        const { traceTree } = await locklift.tracing.trace(
          qweTokenWallet.transferTokens(
            { amount: toNano(1) },
            {
              deployWalletValue: toNano(0),
              remainingGasTo: user.account.address,
              payload: payloadForDexMiddleware,
              recipient: context.dexMiddleware.contract.address,
              amount: new BigNumber(TOKENS_AMOUNT_FOR_DEX).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
              notify: true,
            },
          ),
          { rise: false },
        );
        await traceTree?.beautyPrint();
        expect(traceTree!.tokens.getTokenBalanceChange(qweTokenWallet.walletContract.address)).to.be.eq(
          "0",
          "All tokens should charged back",
        );
      });
      it("all tokens should charged back because bad tokens amount attached ", async () => {
        const { traceTree } = await locklift.tracing.trace(
          qweTokenWallet.transferTokens(
            { amount: toNano(20) },
            {
              deployWalletValue: toNano(0),
              remainingGasTo: user.account.address,
              payload: payloadForDexMiddleware,
              recipient: context.dexMiddleware.contract.address,
              amount: new BigNumber(TOKENS_AMOUNT_FOR_DEX / 2)
                .shiftedBy(Number(qweTokenWallet.tokenDecimals))
                .toString(),
              notify: true,
            },
          ),
          { rise: false },
        );
        await traceTree?.beautyPrint();
        expect(traceTree!.tokens.getTokenBalanceChange(qweTokenWallet.walletContract.address)).to.be.eq(
          "0",
          "All tokens should charged back",
        );
      });
      it("all tokens should charged back because middleware is paused", async () => {
        await context.dexMiddleware.setIsPaused(true);
        const { traceTree } = await locklift.tracing.trace(
          qweTokenWallet.transferTokens(
            { amount: toNano(20) },
            {
              deployWalletValue: toNano(0),
              remainingGasTo: user.account.address,
              payload: payloadForDexMiddleware,
              recipient: context.dexMiddleware.contract.address,
              amount: new BigNumber(TOKENS_AMOUNT_FOR_DEX).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
              notify: true,
            },
          ),
          { rise: false },
        );
        await traceTree?.beautyPrint();
        expect(traceTree!.tokens.getTokenBalanceChange(qweTokenWallet.walletContract.address)).to.be.eq(
          "0",
          "All tokens should charged back",
        );
      });
    });
  });
});
