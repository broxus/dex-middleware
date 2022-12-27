import { Account, Signer } from "locklift/everscale-client";
import { Address } from "locklift/everscale-provider";

import { TokenWallet } from "./tokenWallet";
import { Contract } from "locklift/everscale-provider";
import { TokenRootUpgradeableAbi } from "../../build/factorySource";

export class User {
  constructor(readonly signer: Signer, readonly account: Account) {}

  getTokenWalletByRoot = (tokenRootContract: Contract<TokenRootUpgradeableAbi>): Promise<TokenWallet> => {
    return TokenWallet.getWallet(this.account.address, tokenRootContract);
  };

  getTokenWalletByRootAddress = (address: Address): Promise<TokenWallet> =>
    TokenWallet.getWallet(this.account.address, locklift.factory.getDeployedContract("TokenRootUpgradeable", address));
}
