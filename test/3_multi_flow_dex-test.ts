import { fromNano, getRandomNonce, toNano, zeroAddress } from "locklift";

import { PreBuiltRoutes } from "./constants";
import BigNumber from "bignumber.js";
import { DexMiddleware } from "./entities/dexMiddleware";
import { User } from "./entities/user";
import { expect } from "chai";
import { Address, Contract } from "locklift/everscale-provider";
import { Account } from "locklift/everscale-client";

import { defer, filter, forkJoin, from, lastValueFrom, map, mergeMap, of, switchMap, toArray } from "rxjs";
import { getExpectedTokenAmount } from "./utils/getExpectedTokenAmount";
import { Context, isT, preparation } from "./preparation";
import { DexMiddlewareAbi, ReceiverAfterDexAbi, ReceiversFactoryAbi } from "../build/factorySource";
import { getWeverInstance } from "./wever/utils";

let context: Context;
let user: User;
let receivers: Array<Contract<ReceiverAfterDexAbi>>;
let receiversFactory: Contract<ReceiversFactoryAbi>;
const SUCCESS_EVENT_LABEL = "SUCCESS";
const CANCEL_EVENT_LABEL = "CANCEL";
describe("Multi swap testing", () => {
  beforeEach(async () => {
    context = await preparation({ deployAccountValue: toNano(500), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
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

  it("Should 5 contracts receive only expected tokens, and emit events", async () => {
    const START_TOKEN = "Qwe";
    const [tstTokenRoot, coinTokenRoot, qweTokenRoot] = (["Tst", "Coin", START_TOKEN] as const).map(tokenName =>
      context.dex.getTokenRootByName({ tokenName }),
    );
    const qweTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: START_TOKEN }));

    const { dexMiddlewarePayload, receiversConfigs } = await lastValueFrom(
      from(receivers).pipe(
        map((receiver, idx) => ({ prebuildRoute: PreBuiltRoutes.successMultiRoutes(-0.9999999), receiver })),
        mergeMap(({ prebuildRoute: { route, start_token, successSteps, brokenSteps, leaves }, receiver }) =>
          from(
            context.dex.getPayload({
              recipient: zeroAddress,
              options: {
                amount: 1,
                route: [route],
                start_token: start_token,
              },
            }),
          ).pipe(
            map(({ steps, payload, firstPool, finalExpectedAmount }) => ({
              payload,
              firstPool,
              finalExpectedAmount,
              expectedTokensAmounts: getExpectedTokenAmount({ brokenSteps, successSteps, steps }),
              receiver,
              leaves,
            })),
          ),
        ),

        mergeMap(({ payload, ...rest }, idx) =>
          from(
            receiversFactory.methods
              .getChildPayload({ text: `${SUCCESS_EVENT_LABEL}_${rest.receiver.address.toString()}` })
              .call(),
          ).pipe(
            map(payloadForReceiver => ({
              payloadForDex: {
                dexPayload: payload,
                rootToSendersAllowanceMap: [
                  [tstTokenRoot.address, [context.dex.getDexVault().address]],
                  [coinTokenRoot.address, [context.dex.getDexVault().address]],
                  [
                    qweTokenRoot.address,
                    [context.dexMiddleware.contract.address, context.dex.getDexPool("DexPoolFooBarQwe").address],
                  ],
                ] as Parameters<
                  Contract<DexMiddlewareAbi>["methods"]["buildPayload"]
                >[0]["_payloadsForDex"][0]["rootToSendersAllowanceMap"],
                remainingGasTo: user.account.address,
                cancelPayload: {
                  payload: payloadForReceiver.value0,
                  tokenReceiver: rest.receiver.address,
                  valueForFinalTransfer: toNano("0.2"),
                  deployWalletValue: toNano("0.2"),
                },
                successPayload: {
                  payload: payloadForReceiver.value0,
                  tokenReceiver: rest.receiver.address,
                  valueForFinalTransfer: toNano("0.2"),
                  deployWalletValue: toNano("0.2"),
                },
                leaves: rest.leaves,
                tokensAmount: new BigNumber(0.1).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
                firstRoot: rest.firstPool,
                deployWalletValue: toNano(1),
                valueForDexOperation: toNano(20),
              },
              ...rest,
            })),
          ),
        ),
        toArray(),
        switchMap(receiversConfigs =>
          from(
            context.dexMiddleware.getPayload({
              _payloadsForDex: receiversConfigs.map(({ payloadForDex }) => payloadForDex),
              _payloadsForTransfers: [],
              _payloadsForBurn: [],
              _payloadForUnwrap: [],
              _remainingTokensTo: user.account.address,
              _tokensDistributionType: 0,
            }),
          ).pipe(map(dexMiddlewarePayload => ({ dexMiddlewarePayload, receiversConfigs }))),
        ),
      ),
    );

    const initialTokenBalance = new BigNumber(1200).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString();
    await context.dex.sendTokensTo({
      tokenName: START_TOKEN,
      receiver: user.account.address,
      amount: initialTokenBalance,
    });

    expect(await qweTokenWallet.getBalance()).to.be.eq(initialTokenBalance);
    const { everValue, tokenAmount } = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: dexMiddlewarePayload,
      })
      .call()
      .then(res => res.value0);
    const { traceTree } = await locklift.tracing.trace(
      qweTokenWallet.transferTokens(
        { amount: everValue },
        {
          deployWalletValue: toNano(0),
          remainingGasTo: user.account.address,
          payload: dexMiddlewarePayload,
          recipient: context.dexMiddleware.contract.address,
          amount: tokenAmount,
          notify: true,
        },
      ),
      { raise: false },
    );
    await traceTree?.beautyPrint();
    console.log(`user balance changed ${fromNano(traceTree!.getBalanceDiff(user.account.address))}`);

    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
    await lastValueFrom(
      from(receiversConfigs).pipe(
        mergeMap(({ expectedTokensAmounts: { successTokensExpectedAmount, brokenTokensExpectedAmount }, receiver }) =>
          defer(async () => {
            const successTokenBalance = await new User(user.signer, receiver as unknown as Account)
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
                      from(tokenWallet.getBalance()).pipe(
                        map(balance => ({ balance, tokenRootName: tokenWallet.rootName })),
                      ),
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
          }),
        ),
      ),
    );
    receivers.forEach(receiver => {
      expect(traceTree)
        .to.emit("onReceiveTokens", receiver)
        .count(1)
        .withNamedArgs({
          message: `${SUCCESS_EVENT_LABEL}_${receiver.address.toString()}`,
        });
    });
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));
  });
  it("Should 5 contracts receive success TST tokens, cancel COIN tokens, and emit events", async () => {
    const START_TOKEN = "Qwe";
    const [tstTokenRoot, coinTokenRoot, qweTokenRoot] = (["Tst", "Coin", START_TOKEN] as const).map(tokenName =>
      context.dex.getTokenRootByName({ tokenName }),
    );
    const qweTokenWallet = await user.getTokenWalletByRoot(context.dex.getTokenRootByName({ tokenName: START_TOKEN }));

    const { dexMiddlewarePayload, receiversConfigs } = await lastValueFrom(
      from(receivers).pipe(
        map((receiver, idx) => ({ prebuildRoute: PreBuiltRoutes.failMultiRoutes(-0.99), receiver })),
        mergeMap(({ prebuildRoute: { route, start_token, successSteps, brokenSteps, leaves }, receiver }) =>
          from(
            context.dex.getPayload({
              recipient: zeroAddress,
              options: {
                amount: 1,
                route: [route],
                start_token: start_token,
              },
            }),
          ).pipe(
            map(({ steps, payload, firstPool, finalExpectedAmount }) => ({
              payload,
              firstPool,
              finalExpectedAmount,
              expectedTokensAmounts: getExpectedTokenAmount({ brokenSteps, successSteps, steps }),
              receiver,
              leaves,
            })),
          ),
        ),

        mergeMap(({ payload, ...rest }, idx) =>
          forkJoin([
            from(
              receiversFactory.methods
                .getChildPayload({ text: `${SUCCESS_EVENT_LABEL}_${rest.receiver.address.toString()}` })
                .call()
                .then(res => res.value0),
            ),
            from(
              receiversFactory.methods
                .getChildPayload({ text: `${CANCEL_EVENT_LABEL}_${rest.receiver.address.toString()}` })
                .call()
                .then(res => res.value0),
            ),
          ]).pipe(
            map(([successPayload, cancelPayload]) => ({
              payloadForDex: {
                dexPayload: payload,
                rootToSendersAllowanceMap: [
                  [tstTokenRoot.address, [context.dex.getDexVault().address]],
                  [coinTokenRoot.address, [context.dex.getDexVault().address]],
                  [qweTokenRoot.address, [context.dexMiddleware.contract.address]],
                ] as Parameters<
                  Contract<DexMiddlewareAbi>["methods"]["buildPayload"]
                >[0]["_payloadsForDex"][0]["rootToSendersAllowanceMap"],
                remainingGasTo: user.account.address,
                cancelPayload: {
                  payload: cancelPayload,
                  tokenReceiver: rest.receiver.address,
                  valueForFinalTransfer: toNano("0.2"),
                  deployWalletValue: toNano("0.2"),
                },
                successPayload: {
                  payload: successPayload,
                  tokenReceiver: rest.receiver.address,
                  valueForFinalTransfer: toNano("0.2"),
                  deployWalletValue: toNano("0.2"),
                },
                leaves: rest.leaves,
                tokensAmount: new BigNumber(0.1).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(),
                firstRoot: rest.firstPool,
                deployWalletValue: toNano(0.1),
                valueForDexOperation: toNano(20),
              },
              ...rest,
            })),
          ),
        ),
        toArray(),
        switchMap(receiversConfigs =>
          from(
            context.dexMiddleware.getPayload({
              _payloadsForDex: receiversConfigs.map(({ payloadForDex }) => payloadForDex),
              _payloadsForTransfers: [],
              _payloadsForBurn: [],
              _payloadForUnwrap: [],

              _tokensDistributionType: 0,
              _remainingTokensTo: user.account.address,
            }),
          ).pipe(map(dexMiddlewarePayload => ({ dexMiddlewarePayload, receiversConfigs }))),
        ),
      ),
    );

    const initialTokenBalance = new BigNumber(1200).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString();
    await context.dex.sendTokensTo({
      tokenName: START_TOKEN,
      receiver: user.account.address,
      amount: initialTokenBalance,
    });
    const { everValue, tokenAmount } = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: dexMiddlewarePayload,
      })
      .call()
      .then(res => res.value0);
    expect(await qweTokenWallet.getBalance()).to.be.eq(initialTokenBalance);

    const { traceTree } = await locklift.tracing.trace(
      qweTokenWallet.transferTokens(
        { amount: everValue },
        {
          deployWalletValue: toNano(0),
          remainingGasTo: user.account.address,
          payload: dexMiddlewarePayload,
          recipient: context.dexMiddleware.contract.address,
          amount: tokenAmount,
          notify: true,
        },
      ),
      { raise: false },
    );
    await traceTree?.beautyPrint();
    console.log(`user balance changed ${fromNano(traceTree!.getBalanceDiff(user.account.address))}`);
    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
    await lastValueFrom(
      from(receiversConfigs).pipe(
        mergeMap(({ expectedTokensAmounts: { successTokensExpectedAmount, brokenTokensExpectedAmount }, receiver }) =>
          defer(async () => {
            const successTokenBalance = await new User(user.signer, receiver as unknown as Account)
              .getTokenWalletByRootAddress(successTokensExpectedAmount.tokenRoot)
              .then(tokenWallet => tokenWallet.getBalance());

            expect(Number(successTokenBalance)).to.be.gte(
              Number(successTokensExpectedAmount.amount),
              "success token balance should be gte expected",
            );

            const balancesAndExpectedBalances = await lastValueFrom(
              from(Object.entries(brokenTokensExpectedAmount)).pipe(
                mergeMap(([rootAddress, expectedBalance]) =>
                  from(
                    new User(user.signer, receiver as unknown as Account).getTokenWalletByRootAddress(
                      new Address(rootAddress),
                    ),
                  ).pipe(
                    switchMap(tokenWallet =>
                      from(tokenWallet.getBalance()).pipe(
                        filter(isT),
                        map(balance => ({ balance, tokenRootName: tokenWallet.rootName })),
                      ),
                    ),
                    map(({ balance, tokenRootName }) => ({ balance, expectedBalance, rootAddress, tokenRootName })),
                  ),
                ),
                toArray(),
              ),
            );
            balancesAndExpectedBalances.forEach(({ expectedBalance, balance, rootAddress, tokenRootName }) => {
              console.log(`User received ${expectedBalance} from ${tokenRootName} ${rootAddress}`);
              expect(Number(balance)).to.be.gte(Number(expectedBalance), "extra token balances should be as expected");
            });
          }),
        ),
      ),
    );
    receivers.forEach(receiver => {
      expect(traceTree)
        .to.emit("onReceiveTokens", receiver)
        .count(2)
        .withNamedArgs({
          message: `${CANCEL_EVENT_LABEL}_${receiver.address.toString()}`,
        });
    });
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));
  });
});
