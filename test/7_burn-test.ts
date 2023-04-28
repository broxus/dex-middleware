import { fromNano, getRandomNonce, toNano } from "locklift";

import { Context, preparation } from "./preparation";
import { DexMiddleware } from "./entities/dexMiddleware";
import { User } from "./entities/user";
import { expect } from "chai";

import { Contract } from "locklift/everscale-provider";
import { ReceiverAfterDexAbi, ReceiversFactoryAbi, TokenRootUpgradeableAbi } from "../build/factorySource";
import { Address } from "locklift/everscale-provider";
import { getWeverInstance } from "./wever/utils";

let context: Context;
let user: User;
let receivers: Array<Contract<ReceiverAfterDexAbi>>;
let receiversFactory: Contract<ReceiversFactoryAbi>;
let stEverTokenRoot: Contract<TokenRootUpgradeableAbi>;

describe("Burn testing", () => {
  beforeEach(async () => {
    context = await preparation({ deployAccountValue: toNano(100), accountsAndSignersCount: 2 });
    user = context.signersWithAccounts[0];
    const TOKEN_ROOT_NAME = "StEver";
    const TOKEN_ROOT_SYMBOL = "STE";
    const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
    const tokenWalletCode = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
    const platformCode = locklift.factory.getContractArtifacts("TokenWalletPlatform");

    const { contract } = await locklift.factory.deployContract({
      contract: "TokenRootUpgradeable",
      initParams: {
        name_: TOKEN_ROOT_NAME,
        symbol_: TOKEN_ROOT_SYMBOL,
        decimals_: 9,
        rootOwner_: user.account.address,
        walletCode_: tokenWalletCode.code,
        randomNonce_: locklift.utils.getRandomNonce(),
        deployer_: ZERO_ADDRESS,
        platformCode_: platformCode.code,
      },
      publicKey: user.signer.publicKey,
      value: locklift.utils.toNano(2),
      constructorParams: {
        initialSupplyTo: ZERO_ADDRESS,
        initialSupply: 0,
        deployWalletValue: 0,
        mintDisabled: false,
        burnByRootDisabled: false,
        burnPaused: false,
        remainingGasTo: user.account.address,
      },
    });
    stEverTokenRoot = contract;
    await stEverTokenRoot.methods
      .mint({
        payload: "",
        amount: toNano(500),
        notify: false,
        remainingGasTo: user.account.address,
        deployWalletValue: toNano(1),
        recipient: user.account.address,
      })
      .send({
        from: user.account.address,
        amount: toNano(2),
      });

    const wever = await getWeverInstance();
    context.setWever(wever);
    context.setDexMiddleware(
      await DexMiddleware.deployDexInstance(user, wever.weverVault.address, wever.weverRoot.address),
    );
    await stEverTokenRoot.methods
      .deployWallet({
        deployWalletValue: toNano(1),
        walletOwner: context.dexMiddleware.contract.address,
        answerId: 0,
      })
      .send({
        from: user.account.address,
        amount: toNano(2),
      });

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

  it("should user-receiver receive Tst tokens and evers", async () => {
    const BURN_MESSAGE = "BURN";
    const messageForBurn = await receiversFactory.methods
      .getChildPayload({ text: BURN_MESSAGE })
      .call()
      .then(res => res.value0);

    const payloadForDexMiddleware = await context.dexMiddleware.getPayload({
      _payloadsForDex: [],
      _payloadsForTransfers: [],
      _payloadsForBurn: [
        {
          amount: toNano(500),
          payload: messageForBurn,
          remainingGasTo: user.account.address,
          attachedValue: toNano(0.1),
          callbackTo: receivers[0].address,
        },
      ],
      _payloadForUnwrap: [],
      _tokensDistributionType: 0,
      _remainingTokensTo: user.account.address,
      _remainingGasTo: user.account.address,
    });
    const stEverTokenWallet = await user.getTokenWalletByRoot(stEverTokenRoot);
    const { everValue, tokenAmount } = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForDexMiddleware,
      })
      .call()
      .then(res => res.value0);
    const { traceTree } = await locklift.tracing.trace(
      stEverTokenWallet.transferTokens(
        { amount: everValue },
        {
          deployWalletValue: toNano(0),
          remainingGasTo: user.account.address,
          payload: payloadForDexMiddleware,
          recipient: context.dexMiddleware.contract.address,
          amount: tokenAmount,
          notify: true,
        },
      ),
      { raise: false },
    );
    await traceTree?.beautyPrint();
    expect(traceTree)
      .to.emit("onHandleTokensBurn")
      .withNamedArgs({
        from: context.dexMiddleware.contract.address,
        amount: toNano(500),
        message: BURN_MESSAGE,
      });
    console.log(`user balance changed ${fromNano(traceTree!.getBalanceDiff(user.account.address))}`);
    console.log(`total gas used ${fromNano(traceTree!.totalGasUsed())}`);
  });
});
