import { getRandomNonce, toNano, WalletTypes, zeroAddress } from "locklift";
import { Contract, Address } from "locklift/everscale-provider";
import { Account } from "locklift/everscale-client";
import { TokenWallet } from "../../entities/tokenWallet";
import { TokenRootUpgradeableAbi, TokenWalletUpgradeableAbi, WeverVaultAbi } from "../../../build/factorySource";

export const getWeverInstance = async (): Promise<Wever> => {
  const keyPair = (await locklift.keystore.getSigner("0"))!;

  // User
  // - Deploy user account
  const { account: user } = await locklift.factory.accounts.addNewAccount({
    type: WalletTypes.EverWallet,
    value: toNano(200),
    publicKey: keyPair.publicKey,
    nonce: getRandomNonce(),
  });

  // Wrapped EVER token
  // - Deploy wEVER root

  const { code: tokenWalletCode } = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
  const { code: tokenWalletPlatformCode } = locklift.factory.getContractArtifacts("TokenWalletPlatform");

  const { contract: root } = await locklift.factory.deployContract({
    contract: "TokenRootUpgradeable",
    constructorParams: {
      initialSupplyTo: user.address,
      initialSupply: 0,
      deployWalletValue: toNano(0.1),
      mintDisabled: false,
      burnByRootDisabled: true,
      burnPaused: false,
      remainingGasTo: zeroAddress,
    },
    initParams: {
      deployer_: zeroAddress,
      randomNonce_: getRandomNonce(),
      rootOwner_: user.address,
      name_: "Wrapped EVER",
      symbol_: "WEVER",
      decimals_: 9,
      walletCode_: tokenWalletCode,
      platformCode_: tokenWalletPlatformCode,
    },
    value: toNano(10),
    publicKey: keyPair.publicKey,
  });

  // - Deploy user token wallet

  await root.methods
    .deployWallet({
      walletOwner: user.address,
      deployWalletValue: toNano(2),
      answerId: 0,
    })
    .send({
      from: user.address,
      amount: toNano(5),
    });

  const userTokenWallet = await TokenWallet.getWallet(user.address, root);

  // Tunnel
  // - Deploy tunnel

  const { contract: tunnel } = await locklift.factory.deployContract({
    contract: "WeverTunnel",
    publicKey: keyPair.publicKey,
    value: toNano(2),
    initParams: {
      _randomNonce: getRandomNonce(),
    },
    constructorParams: {
      sources: [],
      destinations: [],
      owner_: user.address,
    },
  });

  // Vault
  // - Deploy vault

  const { contract: vault } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "WeverVault",
      constructorParams: {
        owner_: user.address,
        root_tunnel: tunnel.address,
        root: root.address,
        receive_safe_fee: toNano(1),
        settings_deploy_wallet_grams: toNano(0.05),
        initial_balance: toNano(1),
      },
      value: toNano(2),
      initParams: {
        _randomNonce: getRandomNonce(),
      },
      publicKey: keyPair.publicKey,
    }),
  );

  // Wait until user token wallet is presented into the GraphQL

  // - Setup vault token wallet
  const vaultTokenWalletAddress = await vault.methods
    .token_wallet()
    .call()
    .then(res => res.token_wallet);

  const vaultTokenWallet = await locklift.factory.getDeployedContract("TokenWallet", vaultTokenWalletAddress);

  // Proxy token transfer
  // - Deploy proxy token transfer

  const { contract: proxyTokenTransfer } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "WeverProxyTokenTransfer",
      constructorParams: {
        owner_: user.address,
      },
      initParams: {
        _randomNonce: getRandomNonce(),
      },
      publicKey: keyPair.publicKey,
      value: toNano(2),
    }),
  );

  // - Set configuration (use user as ethereum configuration to emulate callbacks)

  await proxyTokenTransfer.methods
    .setConfiguration({
      _config: {
        tonConfiguration: user.address,
        ethereumConfigurations: [user.address],
        root: root.address,
        settingsDeployWalletGrams: toNano(0.5),
        settingsTransferGrams: toNano(0.5),
      },
    })
    .send({
      from: user.address,
      amount: toNano(3),
    });

  // - Setup proxy token transfer token wallet
  const proxyTokenWalletAddress = await proxyTokenTransfer.methods
    .token_wallet()
    .call()
    .then(res => res.token_wallet);

  const proxyTokenWallet = await locklift.factory.getDeployedContract("TokenWallet", proxyTokenWalletAddress);

  await root.methods
    .transferOwnership({
      newOwner: tunnel.address,
      remainingGasTo: user.address,
      callbacks: [],
    })
    .send({
      from: user.address,
      amount: toNano(2),
    });
  // - Add vault to tunnel sources

  await tunnel.methods
    .__updateTunnel({
      source: vault.address,
      destination: root.address,
    })
    .send({
      from: user.address,
      amount: toNano(2),
    });

  // - Drain vault

  await vault.methods
    .drain({
      receiver: user.address,
    })
    .send({
      from: user.address,
      amount: toNano(2),
    });

  await vault.methods
    .grant({
      amount: toNano(4),
    })
    .send({
      from: user.address,
      amount: toNano(6),
    });
  await vault.methods
    .wrap({
      payload: "",
      gas_back_address: user.address,
      tokens: toNano(100),
      owner_address: user.address,
    })
    .send({
      from: user.address,
      amount: toNano(120),
    });
  // return { vault, tunnel, user, root, userTokenWallet, vaultTokenWallet, proxyTokenTransfer, proxyTokenWallet };
  return new Wever({ account: user, tokenWallet: userTokenWallet }, vault, root);
};

export class Wever {
  constructor(
    private readonly weversOwner: { tokenWallet: TokenWallet; account: Account },
    public readonly weverVault: Contract<WeverVaultAbi>,
    public readonly weverRoot: Contract<TokenRootUpgradeableAbi>,
  ) {}

  grantWevers = ({ amount, recipient }: { amount: string; recipient: Address }): Promise<void> => {
    return this.weversOwner.tokenWallet
      .transferTokens(
        {
          amount: toNano(1),
        },
        {
          amount,
          deployWalletValue: toNano("0.5"),
          remainingGasTo: this.weversOwner.account.address,
          payload: "",
          notify: true,
          recipient,
        },
      )
      .then();
  };
}
