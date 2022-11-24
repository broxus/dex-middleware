import { fromNano, getRandomNonce, toNano, zeroAddress } from "../../ever-locklift";

import { Context, preparation } from "./preparation";
import { expect } from "chai";
import { PreBuiltRoutes } from "./constants";
import { Account } from "everscale-standalone-client";
import BigNumber from "bignumber.js";
import { User } from "./entities/user";
import { DexMiddleware } from "./entities/dexMiddleware";

let context: Context;
let user: User;
describe.skip("initial test", () => {
  before(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
  });
  it("should dexMiddleware deployed", async () => {
    const { code: dexMiddlewareChildCode } = locklift.factory.getContractArtifacts("DexChildMiddleware");
    const { contract, traceTree } = await locklift.tracing.trace(
      locklift.factory.deployContract({
        contract: "DexMiddleware",
        constructorParams: {},
        value: toNano(2),
        publicKey: context.signersWithAccounts[0].signer.publicKey,
        initParams: {
          nonce: getRandomNonce(),
          dexMiddlewareChildCode,
        },
      }),
    );
    context.setDexMiddleware(new DexMiddleware(contract, user));
    expect((await locklift.provider.getFullContractState({ address: contract.address })).state?.isDeployed).to.be.true;
  });
  it("should payload built", async () => {
    const { route, leafs, start_token } = PreBuiltRoutes[0];

    const START_TOKEN = "Qwe";
    const { tokenWallet, tokenDecimals } = await context.dex
      .getTokenRootByName({ tokenName: START_TOKEN })
      .methods.walletOf({ answerId: 0, walletOwner: user.account.address })
      .call()
      .then(async res => {
        return {
          tokenWallet: locklift.factory.getDeployedContract("TokenWalletUpgradeable", res.value0),
          tokenDecimals: (
            await context.dex.getTokenRootByName({ tokenName: START_TOKEN }).methods.decimals({ answerId: 0 }).call()
          ).value0,
        };
      });
    await context.dex.sendTokensTo({
      tokenName: START_TOKEN,
      receiver: user.account.address,
      amount: new BigNumber(1200).shiftedBy(Number(tokenDecimals)).toString(),
    });
    await tokenWallet.methods
      .balance({ answerId: 0 })
      .call()
      .then(res => console.log(res.value0));

    const { payload, firstPool } = await context.dex.getPayload({
      recipient: zeroAddress,
      options: {
        amount: 1000,
        route: [route],
        start_token: start_token,
      },
    });

    const payloaded = await context.dexMiddleware.getPayload({
      _payloadsForDex: [
        {
          dexPayload: payload,
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
          leaves: 2,
          tokensValue: new BigNumber(1000).shiftedBy(Number(tokenDecimals)).toString(),
        },
      ],
      _payloadsForTransfers: [],
    });
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));
    const { traceTree } = await locklift.tracing.trace(
      tokenWallet.methods
        .transfer({
          deployWalletValue: toNano(0.1),
          remainingGasTo: user.account.address,
          amount: new BigNumber(1000).shiftedBy(Number(tokenDecimals)).toString(),
          payload: payloaded,
          // recipient: firstPool,
          recipient: context.dexMiddleware.contract.address,
          notify: true,
        })
        .send({
          amount: toNano(20),
          from: user.account.address,
          bounce: false,
        }),
      { rise: false },
    );
    await traceTree.beautyPrint();
    console.log(
      `User Tst balance is  ${await context.dex
        .getTokenRootByName({ tokenName: "Tst" })
        .methods.walletOf({ answerId: 0, walletOwner: user.account.address })
        .call()
        .then(res =>
          locklift.factory
            .getDeployedContract("TokenWalletUpgradeable", res.value0)
            .methods.balance({ answerId: 0 })
            .call()
            .then(res => res.value0),
        )}`,
    );
    console.log(`user balance changed ${fromNano(traceTree.getBalanceDiff(user.account.address))}`);
    console.log(`total gas used ${fromNano(traceTree.totalGasUsed())}`);
    console.log(fromNano(await locklift.provider.getBalance(user.account.address).then(res => res)));

    console.log(payloaded);
  });
});
