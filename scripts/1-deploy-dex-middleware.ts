import { Address, fromNano, Signer, toNano, WalletTypes, zeroAddress } from "locklift";
import { isValidAddress, logger } from "./utils";
import prompts from "prompts";
import BigNumber from "bignumber.js";

const deployAndSetupStEverVault = async ({
  signer,
  adminAddress,
  deployVaultValue,
}: {
  adminAddress: Address;
  signer: Signer;
  deployVaultValue: string;
}) => {
  if (!signer) {
    throw new Error("Signer not found");
  }
  const { code: dexMiddlewareChildCode } = locklift.factory.getContractArtifacts("DexChildMiddleware");
  logger.startStep("DexMiddleware is deploying...");
  const { contract: dexMiddlewareContract } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "DexMiddleware",
      value: deployVaultValue,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        owner: adminAddress,
        dexMiddlewareChildCode,
      },
      publicKey: signer.publicKey,
      constructorParams: {},
    }),
  );

  logger.info(
    `Dex middleware details ${JSON.stringify(
      await dexMiddlewareContract.methods
        .getDetails({ answerId: 0 })
        .call()
        .then(res => res.value0),
      null,
      4,
    )}`,
  );
  logger.successStep(`DexMiddleware deployed: ${dexMiddlewareContract.address.toString()}`);
};
const main = async () => {
  const DEPLOY_DEX_MIDDLEWARE_VALUE = toNano(2);

  const signer = await locklift.keystore.getSigner("0");

  if (!process.env.SEED || !process.env.MAIN_GIVER_KEY) {
    throw new Error("SEED phrase and MAIN_GIVER_KEY should be provided as env parameters");
  }
  if (!signer) {
    throw new Error("Bad SEED phrase");
  }

  console.log("\x1b[1m", "\n\nSetting DexMiddleware params:");

  const response = await prompts([
    {
      type: "text",
      name: "mSigWallet",
      message: "MultiSig admin(owner) wallet address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
  ]);

  if (!response.mSigWallet) {
    throw new Error("You need to provide required fields");
  }

  console.log("\x1b[1m", "\nSetup complete! ✔ ");

  const { adminAddress } = {
    adminAddress: new Address(response.mSigWallet),
  };

  const giverBalance = await locklift.provider.getBalance(new Address(locklift.context.network.config.giver.address));
  console.log(`giver balance is ${fromNano(giverBalance)} ever`);

  if (new BigNumber(giverBalance).lt(DEPLOY_DEX_MIDDLEWARE_VALUE)) {
    throw new Error(`Giver balance should gt ${fromNano(DEPLOY_DEX_MIDDLEWARE_VALUE)} ever`);
  }

  await deployAndSetupStEverVault({
    adminAddress,
    signer,
    deployVaultValue: DEPLOY_DEX_MIDDLEWARE_VALUE,
  });
};
main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
