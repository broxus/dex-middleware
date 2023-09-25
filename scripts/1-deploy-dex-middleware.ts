import { Address, fromNano, Signer, toNano } from "locklift";
import { isValidAddress, logger } from "./utils";
import prompts from "prompts";
import BigNumber from "bignumber.js";

const deployDexMiddleware = async ({
  signer,
  adminAddress,
  deployVaultValue,
  weverRoot,
  weverVault,
}: {
  adminAddress: Address;
  signer: Signer;
  deployVaultValue: string;
  weverRoot: Address;
  weverVault: Address;
}) => {
  if (!signer) {
    throw new Error("Signer not found");
  }
  const { code: dexMiddlewareChildCode } = locklift.factory.getContractArtifacts("DexChildMiddleware");
  logger.startStep("DexMiddleware is deploying...");
  const {
    extTransaction: { contract: dexMiddlewareContract },
  } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "DexMiddleware",
      value: deployVaultValue,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        owner: adminAddress,
        dexMiddlewareChildCode,
        weverRoot,
        weverVault,
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

  if (!process.env.VENOM_MAIN_GIVER_PHRASE) {
    throw new Error("VENOM_MAIN_GIVER_PHRASE should be provided as env parameters");
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
    {
      type: "text",
      name: "weverRoot",
      message: "Wever token root address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
    {
      type: "text",
      name: "weverVault",
      message: "Wever vault",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
  ]);

  if (!response.mSigWallet) {
    throw new Error("You need to provide required fields");
  }

  console.log("\x1b[1m", "\nSetup complete! ✔ ");

  const { adminAddress, weverRoot, weverVault } = {
    adminAddress: new Address(response.mSigWallet),
    weverRoot: new Address(response.weverRoot),
    weverVault: new Address(response.weverVault),
  };

  const giverBalance = await locklift.provider.getBalance(new Address(locklift.context.network.config.giver.address));
  console.log(`giver balance is ${fromNano(giverBalance)} ever`);

  if (new BigNumber(giverBalance).lt(DEPLOY_DEX_MIDDLEWARE_VALUE)) {
    throw new Error(`Giver balance should gt ${fromNano(DEPLOY_DEX_MIDDLEWARE_VALUE)} ever`);
  }

  await deployDexMiddleware({
    adminAddress,
    signer,
    deployVaultValue: DEPLOY_DEX_MIDDLEWARE_VALUE,
    weverRoot,
    weverVault,
  });
};
main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
