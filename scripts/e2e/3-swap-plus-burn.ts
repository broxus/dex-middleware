import { getDecode, getSwapPlusBurnPayload } from "./apiService";
import { Address } from "locklift/everscale-provider";
import { getDefaultSwapPlusBurnPayload } from "./config";
import { getRandomNonce, toNano, WalletTypes, zeroAddress } from "locklift";
import { logger } from "../utils";
import { TokenWallet } from "../../test/entities/tokenWallet";

const main = async () => {
  const API_ENDPOINT = process.env.API_ENDPOINT;
  if (!API_ENDPOINT) {
    throw new Error("API_ENDPOINT doesn't provided");
  }
  console.log(`Start burn flow`);

  const signer = (await locklift.keystore.getSigner("0"))!;
  const account = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.MsigAccount,
    address: new Address("0:1d2580ae337e3197e41c80ac88244d9e80c72e221297924379f9a03aeb056acd"),
    publicKey: signer.publicKey,
    mSigType: "SafeMultisig",
  });

  // const { contract } = await locklift.factory.deployContract({
  //   contract: "ReceiverAfterDex",
  //   publicKey: signer.publicKey,
  //   value: toNano(1),
  //   constructorParams: {},
  //   initParams: {
  //     _nonce: getRandomNonce(),
  //     root: zeroAddress,
  //   },
  // });
  // const receiverAddress = contract.address.toString();
  const receiverAddress = "0:85b514ba506ca64cbbf5c81f95dc190699f00d35582b5e6595b09ca221126546";
  console.log(`Receiver address ${receiverAddress}`);
  const fromTokenWalletContract = await TokenWallet.getWallet(
    account.address,
    locklift.factory.getDeployedContract(
      "TokenRootUpgradeable",
      new Address("0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e"),
    ),
  );

  const { tokenAmount, tokensTransferPayload, everAmount, sendTo, deployWalletValue } = await getSwapPlusBurnPayload(
    getDefaultSwapPlusBurnPayload({
      tokenReceiver: receiverAddress,
      remainingGasTo: account.address.toString(),
    }),
    API_ENDPOINT,
  );
  const decodedPayload = await getDecode(tokensTransferPayload, API_ENDPOINT);
  process.exit(0);
  logger.startStep(`Start Burning`);
  const { traceTree } = await locklift.tracing.trace(
    fromTokenWalletContract.transferTokens(
      {
        amount: everAmount,
      },
      {
        amount: tokenAmount,
        deployWalletValue: deployWalletValue,
        remainingGasTo: account.address,
        payload: tokensTransferPayload,
        recipient: new Address(sendTo),
        notify: true,
      },
    ),
    { raise: false },
  );
  await traceTree?.beautyPrint();
  logger.successStep(`Swap success`);
};

main();
