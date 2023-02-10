import { fromNano, getRandomNonce, toNano, WalletTypes } from "locklift";

import { expect } from "chai";

import { Context, preparation } from "../preparation";
import { User } from "../entities/user";
import { DexMiddleware } from "../entities/dexMiddleware";
import { getWeverInstance } from "./utils";
import { TokenWallet } from "../entities/tokenWallet";

let context: Context;
let user: User;
describe("Wever", () => {
  beforeEach(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
    const wever = await getWeverInstance();
    context.setWever(wever);
    const everWalletAccount = await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.EverWallet,
      publicKey: (await locklift.keystore.getSigner("8"))!.publicKey,
      value: toNano(20),
    });

    await locklift.provider.sendMessage({
      amount: toNano(1),
      recipient: everWalletAccount.account.address,
      bounce: true,
      sender: everWalletAccount.account.address,
    });
    console.log(`Sent`);
    context.setDexMiddleware(
      await DexMiddleware.deployDexInstance(user, wever.weverVault.address, wever.weverRoot.address),
    );
    await context.wever.grantWevers({
      amount: toNano(20),
      recipient: user.account.address,
    });
  });
  it("Unwrap", async () => {
    const payloadForUnwrap = await context.dexMiddleware.contract.methods
      .buildPayload({
        _payloadsForDex: [],
        _payloadsForBurn: [],
        _payloadsForTransfers: [],
        _payloadForUnwrap: [
          {
            amount: toNano(10),
            payload: "",
            remainingGasTo: user.account.address,
            destination: user.account.address,
          },
        ],
        _tokensDistributionType: 0,
        _remainingTokensTo: user.account.address,
        _remainingGasTo: user.account.address,
      })
      .call()
      .then(res => res.value0);
    const { everValue, tokenAmount } = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForUnwrap,
      })
      .call()
      .then(res => res.value0);

    const userWeverWallet = await TokenWallet.getWallet(user.account.address, context.wever.weverRoot);
    const { traceTree } = await locklift.tracing.trace(
      userWeverWallet.transferTokens(
        {
          amount: everValue,
        },
        {
          amount: tokenAmount,
          notify: true,
          payload: payloadForUnwrap,
          remainingGasTo: user.account.address,
          recipient: context.dexMiddleware.contract.address,
          deployWalletValue: 0,
        },
      ),
      { raise: false },
    );
    if (!traceTree) {
      throw new Error("traceTree not found");
    }
    await traceTree.beautyPrint();

    console.log(`total gas used ${fromNano(traceTree.totalGasUsed())}`);
    const everChange = traceTree.getBalanceDiff(user.account.address);
    expect(Number(everChange)).to.be.gte(Number(toNano(9.72)), "user should receive at least 9.72 evers");
  });

  it("unwrap and send to contact", async () => {
    const MESSAGE = "MESSAGE";
    const { contract: everReceiverContract } = await locklift.factory.deployContract({
      contract: "AfterWeverReceiver",
      value: toNano(1),
      publicKey: user.signer.publicKey,
      initParams: {
        _nonce: getRandomNonce(),
      },
      constructorParams: {},
    });

    const encodedEverReceiverFunctionCall = await everReceiverContract.methods
      .handleEversEndEmitEvent({
        _msg: MESSAGE,
      })
      .encodeInternal();

    const payloadForUnwrap = await context.dexMiddleware.contract.methods
      .buildPayload({
        _payloadsForDex: [],
        _payloadsForBurn: [],
        _payloadsForTransfers: [],
        _payloadForUnwrap: [
          {
            amount: toNano(10),
            payload: encodedEverReceiverFunctionCall,
            remainingGasTo: user.account.address,
            destination: everReceiverContract.address,
          },
        ],
        _tokensDistributionType: 0,
        _remainingTokensTo: user.account.address,
        _remainingGasTo: user.account.address,
      })
      .call()
      .then(res => res.value0);

    const { everValue, tokenAmount } = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForUnwrap,
      })
      .call()
      .then(res => res.value0);

    const userWeverWallet = await TokenWallet.getWallet(user.account.address, context.wever.weverRoot);
    const { traceTree } = await locklift.tracing.trace(
      userWeverWallet.transferTokens(
        {
          amount: everValue,
        },
        {
          amount: tokenAmount,
          notify: true,
          payload: payloadForUnwrap,
          remainingGasTo: user.account.address,
          recipient: context.dexMiddleware.contract.address,
          deployWalletValue: 0,
        },
      ),
      { raise: false },
    );
    if (!traceTree) {
      throw new Error("traceTree not found");
    }
    await traceTree.beautyPrint();

    expect(traceTree).to.emit("onReceiveEvers").withNamedArgs({
      from: context.dexMiddleware.contract.address,
      message: MESSAGE,
    });
    expect(Number(traceTree.getBalanceDiff(everReceiverContract))).to.be.gte(Number(toNano(9.9)));
  });
});
