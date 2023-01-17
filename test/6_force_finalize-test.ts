import { fromNano, toNano, zeroAddress } from "locklift";

import { Context, preparation } from "./preparation";
import { PreBuiltRoutes } from "./constants";
import BigNumber from "bignumber.js";
import { DexMiddleware } from "./entities/dexMiddleware";
import { User } from "./entities/user";
import { expect } from "chai";
import { getWeverInstance } from "./wever/utils";

let context: Context;
let user: User;
describe("Force child finalize", () => {
  beforeEach(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
    const wever = await getWeverInstance();
    context.setWever(wever);
    context.setDexMiddleware(
      await DexMiddleware.deployDexInstance(user, wever.weverVault.address, wever.weverRoot.address),
    );
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

  it("should user receive Tst tokens", async () => {
    const { route, leaves, start_token } = PreBuiltRoutes.succesSimpleRoute;
    const TOKENS_AMOUNT = 1200;
    const START_TOKEN = "Qwe";

    const qweTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: START_TOKEN }));
    const tstTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: "Tst" }));

    const initialTokenBalance = new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString();
    await context.dex.sendTokensTo({
      tokenName: START_TOKEN,
      receiver: user.account.address,
      amount: initialTokenBalance,
    });
    const [tstTokenRoot, coinTokenRoot, qweTokenRoot] = (["Tst", "Coin", START_TOKEN] as const).map(tokenName =>
      context.dex.getTokenRootByName({ tokenName }),
    );
    const dexPoolFooBarQwe = context.dex.getDexPool("DexPoolFooBarQwe");
    expect(await qweTokenWallet.getBalance()).to.be.eq(initialTokenBalance);

    const { payload, firstPool, finalExpectedAmount } = await context.dex.getPayload({
      recipient: zeroAddress,
      options: {
        amount: TOKENS_AMOUNT,
        route: [route],
        start_token: start_token,
      },
    });

    const payloadForDexMiddleware = await context.dexMiddleware.getPayload({
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
          valueForDexOperation: toNano(10),
          firstRoot: firstPool,
          leaves: leaves + 1,
          tokensAmount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
        },
      ],
      _payloadsForTransfers: [],
      _payloadsForBurn: [],
      _payloadForUnwrap: [],
      _tokensDistributionType: 0,
      _remainingTokensTo: user.account.address,
    });

    const { traceTree } = await locklift.tracing.trace(
      qweTokenWallet.transferTokens(
        { amount: toNano(20) },
        {
          deployWalletValue: toNano(0),
          remainingGasTo: user.account.address,
          payload: payloadForDexMiddleware,
          recipient: context.dexMiddleware.contract.address,
          amount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
          notify: true,
        },
      ),
      { rise: false },
    );
    await traceTree?.beautyPrint({
      printFullAddresses: true,
    });
    expect(
      new BigNumber(traceTree!.tokens.getTokenBalanceChange(qweTokenWallet.walletContract.address))
        .shiftedBy(-Number(qweTokenWallet.tokenDecimals))
        .toNumber(),
    ).to.be.eq(-TOKENS_AMOUNT, "Tokens balance should be decreased");

    expect(Number(traceTree!.getBalanceDiff(user.account.address))).to.be.lte(
      -Number(toNano(10)),
      "extra evers should be locked on the child",
    );
    expect(
      await tstTokenWallet.getBalance().catch(e => {
        return e.message;
      }),
    ).to.be.eq("runLocal: Account not found", "account shouldn't be existed");

    const childAddress = await context.dexMiddleware.contract.methods
      .getChildAddress({ childNonce: 0, answerId: 0 })
      .call()
      .then(res => res.value0);

    const { traceTree: forceFinalizeTraceTree } = await locklift.tracing.trace(
      context.dexMiddleware.forceChildFinalize([
        {
          address: childAddress,
          isSuccess: true,
        },
      ]),
      { rise: false },
    );

    await forceFinalizeTraceTree!.beautyPrint();
    expect(Number(forceFinalizeTraceTree!.getBalanceDiff(user.account.address))).to.be.gte(
      Number(toNano(8)),
      "extra ever should payed back from the child after force finalize",
    );

    expect(await tstTokenWallet.getBalance()).to.be.eq(
      new BigNumber(finalExpectedAmount).toString(),
      "TST tokens should be received",
    );
    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));
  });
});
