import { getSwapPlusBurnPayload, getUnwrapPayload } from "./apiService";
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
      remainingGasTo: account.address.toString(),
    },
    API_ENDPOINT,
  );
  console.log(tokensTransferPayload);
  logger.startStep(`Start Unwrapping`);

  const dexMiddleware = await locklift.factory.getDeployedContract("DexMiddleware", new Address(sendTo));
  console.log(
    await dexMiddleware.methods
      .calculateFeeAndTokensValue({
        _transferPayload:
          "te6ccgEBAgEApwAB/rXunHIBAQUBAJcAAWUAAAAAAAAAAAAAAAAAAAAAMAgB+I8vrWO0QVkLvaCpg7/VbxuLKcZ8FoAuNPUO/0ARRVEBAQPQQAIBQ4AfiPL61jtEFZC72gqYO/1W8biynGfBaALjT1Dv9AEUVRADAWOAH4jy+tY7RBWQu9oKmDv9VvEBAEa4spxnwWgC409Q7/QBFFUAAAAAAAAAAAAAAAAHc1lAEAQAAA==",
      })
      .call(),
  );
  // const { traceTree } = await locklift.tracing.trace(
  //   fromTokenWalletContract.transferTokens(
  //     {
  //       amount: everAmount,
  //     },
  //     {
  //       amount: tokenAmount,
  //       deployWalletValue: 0,
  //       remainingGasTo: account.address,
  //       payload: tokensTransferPayload,
  //       recipient: new Address(sendTo),
  //       notify: true,
  //     },
  //   ),
  //   { raise: false },
  // );
  // await traceTree?.beautyPrint();
  logger.successStep(`Swap success`);
};

main();
