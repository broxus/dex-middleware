import { getSwapPayload } from "./apiService";
import { Address } from "locklift/everscale-provider";
import { config, getDefaultSwapPayload } from "./config";
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

  const { minTokenAmountReceive, tokenAmount, tokenAmountReceive, tokensTransferPayload, everAmount, sendTo } =
    await getSwapPayload(
      getDefaultSwapPayload({ tokenReceiver: account.address.toString(), remainingGasTo: account.address.toString() }),
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
  debugger;
  logger.startStep(`Start swapping`);
  const result = await fromTokenWalletContract.transferTokens(
    {
      amount: everAmount,
    },
    {
      amount: tokenAmount,
      deployWalletValue: 0,
      remainingGasTo: account.address,
      payload: tokensTransferPayload,
      recipient: new Address(sendTo),
      notify: true,
    },
  );
  console.log(result);
  logger.successStep(`Swap success`);
};

main();
