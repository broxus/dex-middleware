import { getPayload } from "./pathBuilder/pathBilder";
import { Migration } from "./migration";
import { Account } from "everscale-standalone-client";
import { Address, Contract, toNano, WalletTypes } from "locklift";
import { DexVaultAbi, TokenRootUpgradeableAbi } from "../build/factorySource";

export class Dex {
  getPayload = getPayload;
  constructor(private readonly tokenGiverAccount: Account, private readonly migration: Migration) {}

  getTokenRootByName = ({
    tokenName,
  }: {
    tokenName: "Foo" | "Bar" | "Qwe" | "Tst" | "Coin";
  }): Contract<TokenRootUpgradeableAbi> => this.migration.load(`${tokenName}Root`) as Contract<TokenRootUpgradeableAbi>;

  getDexVault = (): Contract<DexVaultAbi> => this.migration.load("DexVault");
  sendTokensTo = async ({
    tokenName,
    receiver,
    amount,
  }: {
    tokenName: "Foo" | "Bar" | "Qwe" | "Tst" | "Coin";
    amount: string;
    receiver: Address;
  }) => {
    const tokenRootContract = this.getTokenRootByName({ tokenName });

    return locklift.tracing.trace(
      tokenRootContract.methods
        .mint({
          amount,
          payload: "",
          deployWalletValue: toNano(1),
          recipient: receiver,
          notify: false,
          remainingGasTo: this.tokenGiverAccount.address,
        })
        .send({
          amount: toNano(2),
          from: this.tokenGiverAccount.address,
        }),
      { rise: false },
    );
  };
}

export const getDexInstance = async () => {
  const migration = new Migration();
  const keyPair = await locklift.keystore.getSigner("0");
  const accountContract = migration.load("Account1");
  const tokenGiverAccount = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.MsigAccount,

    address: accountContract.address,
    publicKey: keyPair?.publicKey,
  });
  const oldAbi = JSON.parse(tokenGiverAccount.abi);
  oldAbi.header = ["time"];
  oldAbi.version = "2.2";
  tokenGiverAccount.abi = JSON.stringify(oldAbi, null, 4);
  return new Dex(tokenGiverAccount, migration);
};
