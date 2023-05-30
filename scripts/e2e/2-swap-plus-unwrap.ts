import { getDecode, getSwapPayload, getSwapPlusUnwrapPayload } from "./apiService";
import { Address } from "locklift/everscale-provider";
import { getDefaultSwapPlusUnwrapPayload } from "./config";
import { toNano, WalletTypes } from "../../../ever-locklift";
import { logger } from "../utils";
import { TokenWallet } from "../../test/entities/tokenWallet";

const main = async () => {
  const API_ENDPOINT = process.env.API_ENDPOINT;
  if (!API_ENDPOINT) {
    throw new Error("API_ENDPOINT doesn't provided");
  }
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
      new Address("0:a519f99bb5d6d51ef958ed24d337ad75a1c770885dcd42d51d6663f9fcdacfb2"),
    ),
  );

  const {
    minTokenAmountReceive,
    tokenAmount,
    tokenAmountReceive,
    tokensTransferPayload,
    everAmount,
    sendTo,
    deployWalletValue,
  } = await getSwapPlusUnwrapPayload(
    getDefaultSwapPlusUnwrapPayload({
      tokenReceiver: "0:aacb26e7f3caa01bae4a8b00a2d1976408f47208286966a0e9d472e81a72f287",
      remainingGasTo: account.address.toString(),
    }),
    API_ENDPOINT,
  );

  debugger;
  logger.startStep(`Start swapping`);
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
