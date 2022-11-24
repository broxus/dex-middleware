import { fromNano, toNano, zeroAddress } from "locklift";

import { Context, preparation } from "./preparation";
import { PreBuiltRoutes } from "./constants";
import BigNumber from "bignumber.js";
import { DexMiddleware } from "./entities/dexMiddleware";
import { User } from "./entities/user";
import { expect } from "chai";
import { Address } from "locklift/everscale-provider";

import { from, lastValueFrom, map, mergeMap, switchMap, toArray } from "rxjs";
import { getExpectedTokenAmount } from "./utils/getExpectedTokenAmount";

let context: Context;
let user: User;
describe.skip("success and cancel", () => {
  before(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
  });
  it("should dexMiddleware deployed", async () => {
    context.setDexMiddleware(await DexMiddleware.deployDexInstance(user));
  });
  it("should user receive Tst tokens", async () => {
    const { route, leaves, start_token } = PreBuiltRoutes.succesSimpleRoute;
    const TOKENS_AMOUNT = 1200;
    const START_TOKEN = "Qwe";

    const qweTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: START_TOKEN }));
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
          },
          successPayload: {
            payload: "",
            tokenReceiver: user.account.address,
          },
          deployWalletValue: toNano(1),
          attachedValue: toNano(10),
          firtRoot: firstPool,
          leaves,
          tokensAmount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
        },
      ],
      _payloadsForTransfers: [],
    });

    const { traceTree } = await locklift.tracing.trace(
      qweTokenWallet.transferTokens(
        { amount: toNano(20) },
        {
          deployWalletValue: toNano(0.1),
          remainingGasTo: user.account.address,
          payload: payloadForDexMiddleware,
          recipient: context.dexMiddleware.contract.address,
          amount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
          notify: true,
        },
      ),
      { rise: false },
    );
    await traceTree?.beautyPrint();
    const tstTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: "Tst" }));
    expect(await tstTokenWallet.getBalance()).to.be.eq(new BigNumber(finalExpectedAmount).toString());
    console.log(`user balance changed ${fromNano(traceTree!.getBalanceDiff(user.account.address))}`);
    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));
  });
  it("should user receive Tst tokens and ?? tokens as a bad transaction", async () => {
    const { route, leaves, start_token, successSteps, brokenSteps } = PreBuiltRoutes.failSimpleRoute;
    const TOKENS_AMOUNT = 1200;

    const START_TOKEN = "Qwe";

    const qweTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: START_TOKEN }));
    const initialTokenBalance = new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString();
    await context.dex.sendTokensTo({
      tokenName: START_TOKEN,
      receiver: user.account.address,
      amount: initialTokenBalance,
    });
    const [tstTokenRoot, coinTokenRoot, qweTokenRoot] = (["Tst", "Coin", START_TOKEN] as const).map(tokenName =>
      context.dex.getTokenRootByName({ tokenName }),
    );
    expect(await qweTokenWallet.getBalance()).to.be.eq(initialTokenBalance);

    const { payload, firstPool, finalExpectedAmount, steps } = await context.dex.getPayload({
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
            [qweTokenRoot.address, [context.dexMiddleware.contract.address]],
          ],
          remainingGasTo: user.account.address,
          cancelPayload: {
            payload: "",
            tokenReceiver: user.account.address,
          },
          successPayload: {
            payload: "",
            tokenReceiver: user.account.address,
          },
          deployWalletValue: toNano(1),
          attachedValue: toNano(10),
          firtRoot: firstPool,
          leaves,
          tokensAmount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
        },
      ],
      _payloadsForTransfers: [],
    });

    const { traceTree } = await locklift.tracing.trace(
      qweTokenWallet.transferTokens(
        { amount: toNano(20) },
        {
          deployWalletValue: toNano(0.1),
          remainingGasTo: user.account.address,
          payload: payloadForDexMiddleware,
          recipient: context.dexMiddleware.contract.address,
          amount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
          notify: true,
        },
      ),
      { rise: false },
    );
    await traceTree?.beautyPrint();
    console.log(`user balance changed ${fromNano(traceTree!.getBalanceDiff(user.account.address))}`);
    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
    const { successTokensExpectedAmount, brokenTokensExpectedAmount } = getExpectedTokenAmount({
      steps,
      brokenSteps,
      successSteps,
    });

    const successTokenBalance = await user
      .getTokenWalletByRootAddress(successTokensExpectedAmount.tokenRoot)
      .then(tokenWallet => tokenWallet.getBalance());

    expect(Number(successTokenBalance)).to.be.gte(
      Number(successTokensExpectedAmount.amount),
      "success token balance should be gte expected",
    );

    const balancesAndExpectedBalances = await lastValueFrom(
      from(Object.entries(brokenTokensExpectedAmount)).pipe(
        mergeMap(([rootAddress, expectedBalance]) =>
          from(user.getTokenWalletByRootAddress(new Address(rootAddress))).pipe(
            switchMap(tokenWallet =>
              from(tokenWallet.getBalance()).pipe(map(balance => ({ balance, tokenRootName: tokenWallet.rootName }))),
            ),
            map(({ balance, tokenRootName }) => ({ balance, expectedBalance, rootAddress, tokenRootName })),
          ),
        ),
        toArray(),
      ),
    );
    balancesAndExpectedBalances.forEach(({ expectedBalance, balance, rootAddress, tokenRootName }) => {
      console.log(`User received ${expectedBalance} from ${tokenRootName} ${rootAddress}`);
      expect(balance).to.be.eq(expectedBalance, "extra token balances should be as expected");
    });
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));
  });
});