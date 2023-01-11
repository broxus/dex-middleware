import { getSwapPayload } from "./apiService";
import { Address } from "locklift/everscale-provider";
import { config } from "./config";
import { toNano, WalletTypes } from "../../../ever-locklift";
import { logger } from "../utils";
import { TokenWallet } from "../../test/entities/tokenWallet";

const main = async () => {
  const signer = (await locklift.keystore.getSigner("0"))!;
  const account = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.MsigAccount,
    address: new Address("0:1d2580ae337e3197e41c80ac88244d9e80c72e221297924379f9a03aeb056acd"),
    publicKey: signer.publicKey,
    mSigType: "SafeMultisig",
  });
  const fromTokenWalletContract = await TokenWallet.getWallet(
    account.address,
    locklift.factory.getDeployedContract(
      "TokenRootUpgradeable",
      new Address("0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e"),
    ),
  );
  const swapPayload = await getSwapPayload(config.swapConfig);
  const dexMiddlewareContract = locklift.factory.getDeployedContract(
    "DexMiddleware",
    new Address(config.dexMiddlewareAddress),
  );
  // await dexMiddlewareContract.methods
  //   .forceChildsFinalize({
  //     childsSettings: [
  //       { child: new Address("0:bb90eb45af73036c141b2274cb2fc3085b5c33f4e59c2926ecfd55719f40c1bf"), isSuccess: true },
  //     ],
  //   })
  //   .send({
  //     amount: toNano(2),
  //     from: account.address,
  //     bounce: true,
  //   });

  logger.startStep("Preparing payload for Middleware");
  const dexMiddlewarePayload = await dexMiddlewareContract.methods
    .buildPayload({
      remainingTokensTo: account.address,
      _payloadsForDex: [
        {
          dexPayload: swapPayload.payload,
          rootToSendersAllowanceMap: Object.entries(swapPayload.mapping).map(([root, senders]) => [
            new Address(root),
            senders.map(sender => new Address(sender)),
          ]),
          remainingGasTo: account.address,
          cancelPayload: {
            payload: "",
            tokenReceiver: account.address,
            valueForFinalTransfer: toNano(1),
            deployWalletValue: toNano(1),
          },
          successPayload: {
            payload: "",
            tokenReceiver: new Address("0:aacb26e7f3caa01bae4a8b00a2d1976408f47208286966a0e9d472e81a72f287"),
            valueForFinalTransfer: toNano(1),
            deployWalletValue: toNano(1),
          },
          deployWalletValue: toNano(0.5),
          valueForDexOperation: swapPayload.gas,
          firstRoot: new Address(swapPayload.firstRoot),
          leaves: swapPayload.leaves,
          tokensAmount: config.swapConfig.amount,
        },
        {
          dexPayload: swapPayload.payload,
          rootToSendersAllowanceMap: Object.entries(swapPayload.mapping).map(([root, senders]) => [
            new Address(root),
            senders.map(sender => new Address(sender)),
          ]),
          remainingGasTo: account.address,
          cancelPayload: {
            payload: "",
            tokenReceiver: account.address,
            valueForFinalTransfer: toNano(1),
            deployWalletValue: toNano(1),
          },
          successPayload: {
            payload: "",
            tokenReceiver: new Address("0:aacb26e7f3caa01bae4a8b00a2d1976408f47208286966a0e9d472e81a72f287"),
            valueForFinalTransfer: toNano(1),
            deployWalletValue: toNano(1),
          },
          deployWalletValue: toNano(0.5),
          valueForDexOperation: swapPayload.gas,
          firstRoot: new Address(swapPayload.firstRoot),
          leaves: swapPayload.leaves,
          tokensAmount: config.swapConfig.amount,
        },
      ],
      _payloadsForTransfers: [],
      _payloadsForBurn: [],
    })
    .call()
    .then(res => res.value0);
  logger.successStep("Payload received");
  logger.startStep("calculating required tokens and evers amount");
  const calculationResult = await dexMiddlewareContract.methods
    .calculateFeeAndTokensValue({
      _transferPayload: dexMiddlewarePayload,
    })
    .call()
    .then(res => res.value0);
  logger.successStep(`Calculation result ${JSON.stringify(calculationResult)}`);
  logger.startStep(`Start swapping`);
  const result = await fromTokenWalletContract.transferTokens(
    {
      amount: calculationResult.everValue,
    },
    {
      amount: calculationResult.tokenAmount,
      deployWalletValue: 0,
      remainingGasTo: account.address,
      payload: dexMiddlewarePayload,
      recipient: dexMiddlewareContract.address,
      notify: true,
    },
  );

  logger.successStep(`Swap success`);
};

main();
