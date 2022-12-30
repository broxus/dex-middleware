import { fromNano, getRandomNonce, toNano, zeroAddress } from "locklift";

import { Context, preparation } from "./preparation";
import { PreBuiltRoutes } from "./constants";
import BigNumber from "bignumber.js";
import { DexMiddleware } from "./entities/dexMiddleware";
import { User } from "./entities/user";
import { expect } from "chai";
import { Contract } from "../../ever-locklift/everscale-provider";
import { ReceiverAfterDexAbi, ReceiversFactoryAbi } from "../build/factorySource";
import { from, lastValueFrom, map, mergeMap, toArray } from "rxjs";

let context: Context;
let user: User;
let receivers: Array<Contract<ReceiverAfterDexAbi>>;

let receiversFactory: Contract<ReceiversFactoryAbi>;

describe("success and cancel", () => {
  beforeEach(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
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
    const { code: receiverCode } = locklift.factory.getContractArtifacts("ReceiverAfterDex");
    const { contract: factoryOfReceivers } = await locklift.tracing.trace(
      locklift.factory.deployContract({
        contract: "ReceiversFactory",
        value: toNano(20),
        publicKey: user.signer.publicKey,
        initParams: {
          _receiverCode: receiverCode,
          _nonce: getRandomNonce(),
        },
        constructorParams: {},
      }),
    );
    receiversFactory = factoryOfReceivers;
    const { traceTree } = await locklift.tracing.trace(
      factoryOfReceivers.methods.deployReceivers({ count: 10 }).send({
        from: user.account.address,
        amount: toNano(50),
      }),
    );
    const deployReceiverEvents = traceTree?.findEventsForContract({
      contract: factoryOfReceivers,
      name: "ReceiverDeployed",
    });
    receivers = deployReceiverEvents!.map(({ receiver }) =>
      locklift.factory.getDeployedContract("ReceiverAfterDex", receiver),
    );
  });

  it("should user receive Tst tokens", async () => {
    const { route, leaves, start_token } = PreBuiltRoutes.succesSimpleRoute;
    const TOKENS_AMOUNT = 1200;
    const EXTRA_TOKENS = 100;
    const START_TOKEN = "Qwe";

    const qweTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: START_TOKEN }));
    const tstTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: "Tst" }));

    const initialTokenBalance = new BigNumber(TOKENS_AMOUNT + EXTRA_TOKENS)
      .shiftedBy(Number(qweTokenWallet.tokenDecimals))
      .toString();
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
    const expectedTokensAmountForEachReceiver = new BigNumber(finalExpectedAmount)
      .dividedBy(receivers.length)
      .toFixed(0)
      .toString();
    const payloadForMultiTokensTransfer = await context.dexMiddleware.getPayload({
      _payloadsForDex: [],
      _payloadsForBurn: [],
      _payloadsForTransfers: await lastValueFrom(
        from(receivers).pipe(
          mergeMap(receiver =>
            from(receiversFactory.methods.getChildPayload({ text: receiver.address.toString() }).call()).pipe(
              map(({ value0: message }) => ({
                payload: message,
                deployWalletValue: toNano(1),
                attachedValue: toNano(0.1),
                amount: expectedTokensAmountForEachReceiver,
                receiver: receiver.address,
                notify: true,
                _remainingGasTo: user.account.address,
              })),
            ),
          ),
          toArray(),
        ),
      ),
      remainingTokensTo: user.account.address,
    });
    const { everValue: everValueForTokensTransfer } = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForMultiTokensTransfer,
      })
      .call()
      .then(res => res.value0);
    console.log(`everValueForTokensTransfer ${everValueForTokensTransfer}`);
    const payloadForSwap = await context.dexMiddleware.getPayload({
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
            payload: payloadForMultiTokensTransfer,
            tokenReceiver: context.dexMiddleware.contract.address,
            valueForFinalTransfer: everValueForTokensTransfer,
            deployWalletValue: toNano("0.2"),
          },
          deployWalletValue: toNano(1),
          valueForDexOperation: toNano(3),
          firstRoot: firstPool,
          leaves,
          tokensAmount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
        },
      ],
      _payloadsForTransfers: [],
      remainingTokensTo: user.account.address,
      _payloadsForBurn: [],
    });
    console.log(`Payload for swap built`);
    const { everValue: everValueForSwap, tokenAmount: tokensAmountForSwap } =
      await context.dexMiddleware.contract.methods
        .calculateFeeAndTokensValue({
          _transferPayload: payloadForSwap,
        })
        .call()
        .then(res => res.value0);
    console.log(`everValueForSwap ${everValueForSwap} tokensAmountForSwap ${tokensAmountForSwap}`);

    const { traceTree } = await locklift.tracing.trace(
      qweTokenWallet.transferTokens(
        { amount: everValueForSwap },
        {
          deployWalletValue: toNano(0),
          remainingGasTo: user.account.address,
          payload: payloadForSwap,
          recipient: context.dexMiddleware.contract.address,
          amount: tokensAmountForSwap,
          notify: true,
        },
      ),
      { rise: false },
    );
    await traceTree?.beautyPrint();
    receivers.forEach(receiver => {
      expect(traceTree).to.emit("onReceiveTokens").withNamedArgs({
        message: receiver.address.toString(),
        amount: expectedTokensAmountForEachReceiver,
      });
    });
    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
    console.log(`Balance change ${fromNano(traceTree!.getBalanceDiff(user.account.address))}`);
  });
});
