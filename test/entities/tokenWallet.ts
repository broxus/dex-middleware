import { TokenRootUpgradeableAbi, TokenWalletUpgradeableAbi } from "../../build/factorySource";
import { Contract, Address } from "locklift/everscale-provider";
import BigNumber from "bignumber.js";

export class TokenWallet {
  constructor(
    public readonly walletContract: Contract<TokenWalletUpgradeableAbi>,
    private readonly owner: Address,
    readonly tokenDecimals: string,
    readonly rootName: string,
  ) {}
  static getWallet = async (
    accountAddress: Address,
    tokenRootContract: Contract<TokenRootUpgradeableAbi>,
  ): Promise<TokenWallet> => {
    const userTokenWallet = await tokenRootContract.methods
      .walletOf({ answerId: 1, walletOwner: accountAddress })
      .call()
      .then(res => res.value0 as Address);
    const { value0: decimals } = await tokenRootContract.methods.decimals({ answerId: 0 }).call();
    const rootName = await tokenRootContract.methods
      .symbol({ answerId: 0 })
      .call()
      .then(res => res.value0);
    return new TokenWallet(
      locklift.factory.getDeployedContract("TokenWalletUpgradeable", userTokenWallet),
      accountAddress,
      decimals,
      rootName,
    );
  };

  getBalance = async (): Promise<string> => {
    return this.walletContract.methods
      .balance({
        answerId: 3,
      })
      .call()
      .then(res => res.value0);
  };

  transferTokens = (
    {
      amount,
    }: {
      amount: string;
    },
    ...transferParams: Parameters<Contract<TokenWalletUpgradeableAbi>["methods"]["transfer"]>
  ) => {
    return this.walletContract.methods.transfer(...transferParams).send({
      amount: amount,
      from: this.owner,
    });
  };
}
