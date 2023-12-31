import { getSwapPlusBurnPayload, getUnwrapPayload } from "./apiService";
import { Address } from "locklift/everscale-provider";
import { toNano, WalletTypes } from "locklift";
import { logger } from "../utils";
import { TokenWallet } from "../../test/entities/tokenWallet";

const main = async () => {
  const API_ENDPOINT = process.env.API_ENDPOINT;

  if (!API_ENDPOINT) {
    throw new Error("API_ENDPOINT doesn't provided");
  }
  console.log(`Start unwrap flow`);

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
      new Address("0:a49cd4e158a9a15555e624759e2e4e766d22600b7800d891e46f9291f044a93d"),
    ),
  );

  const { tokenAmount, tokensTransferPayload, everAmount, sendTo } = await getUnwrapPayload(
    {
      amount: toNano(1),
      destination: account.address.toString(),
      remainingGasTo: "0:aacb26e7f3caa01bae4a8b00a2d1976408f47208286966a0e9d472e81a72f287",
    },
    API_ENDPOINT,
  );
  console.log(tokensTransferPayload);
  logger.startStep(`Start Unwrapping`);

  const { traceTree } = await locklift.tracing.trace(
    fromTokenWalletContract.transferTokens(
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
    ),
    { raise: false },
  );
  await traceTree?.beautyPrint();
  logger.successStep(`Swap success`);
};

main();
