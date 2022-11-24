import { Account, Signer } from "locklift/everscale-client";
import { Dex, getDexInstance } from "../dex";
import { concatMap, filter, from, lastValueFrom, map, range, switchMap, toArray } from "rxjs";
import { getRandomNonce, toNano, WalletTypes } from "../../ever-locklift";
import { DexMiddleware, DexMiddlewareContract } from "./entities/dexMiddleware";
import { User } from "./entities/user";

// export type Context = {
//   signersWithAccounts: Array<{ signer: Signer; account: Account }>;
//   dex: Dex;
// };
export const preparation = async ({
  accountsAndSignersCount = 5,
  deployAccountValue = toNano(100),
}: {
  accountsAndSignersCount: number;
  deployAccountValue: string;
}): Promise<Context> => {
  const signersWithAccounts = await lastValueFrom(
    range(accountsAndSignersCount).pipe(
      concatMap(idx =>
        from(locklift.keystore.getSigner(idx.toString())).pipe(
          filter(isT),
          switchMap(signer =>
            locklift.factory.accounts
              .addNewAccount({
                type: WalletTypes.MsigAccount,
                value: deployAccountValue,
                contract: "Wallet",
                mSigType: "SafeMultisig",
                publicKey: signer.publicKey,
                initParams: {
                  _randomNonce: getRandomNonce(),
                },
                constructorParams: {},
              })
              .then(({ account }) => ({ signer, account })),
          ),
        ),
      ),
      map(({ account, signer }) => new User(signer, account)),
      toArray(),
    ),
  );

  return new Context(signersWithAccounts, await getDexInstance());
};
export class Context {
  #dexMiddleware: DexMiddleware | undefined;
  constructor(public readonly signersWithAccounts: Array<User>, public readonly dex: Dex) {}

  setDexMiddleware = (dexMiddleware: DexMiddleware) => {
    this.#dexMiddleware = dexMiddleware;
  };

  get dexMiddleware() {
    if (!this.#dexMiddleware) {
      throw new Error("DexMiddleware haven't set yet");
    }
    return this.#dexMiddleware;
  }
}
export const isT = <T>(t: T): t is T & {} => !!t;
