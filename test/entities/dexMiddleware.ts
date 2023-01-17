import { Contract, Address } from "locklift/everscale-provider";
import { DexMiddlewareAbi } from "../../build/factorySource";
import { getRandomNonce, toNano } from "locklift";
import { User } from "./user";
export type DexMiddlewareContract = Contract<DexMiddlewareAbi>;

export class DexMiddleware {
  constructor(public readonly contract: DexMiddlewareContract, private readonly owner: User) {}

  getPayload = async (...params: Parameters<DexMiddlewareContract["methods"]["buildPayload"]>) => {
    return this.contract.methods
      .buildPayload(...params)
      .call()
      .then(res => res.value0);
  };
  static deployDexInstance = async (owner: User, weverVaultAddress: Address, weverRoot: Address) => {
    const { code: dexMiddlewareChildCode } = locklift.factory.getContractArtifacts("DexChildMiddleware");
    const { contract } = await locklift.tracing.trace(
      locklift.factory.deployContract({
        contract: "DexMiddleware",
        constructorParams: {},
        value: toNano(2),
        publicKey: owner.signer.publicKey,
        initParams: {
          owner: owner.account.address,
          nonce: getRandomNonce(),
          dexMiddlewareChildCode,
          weverVault: weverVaultAddress,
          weverRoot,
        },
      }),
    );
    return new DexMiddleware(contract, owner);
  };
  setIsPaused = (isPaused: boolean) =>
    this.contract.methods.setIsPaused({ _isPaused: isPaused }).send({
      from: this.owner.account.address,
      amount: toNano(1),
    });

  forceChildFinalize = (childs: Array<{ address: Address; isSuccess: boolean }>) =>
    this.contract.methods
      .forceChildsFinalize({
        childsSettings: childs.map(({ isSuccess, address }) => ({
          child: address,
          isSuccess,
        })),
      })
      .send({
        from: this.owner.account.address,
        amount: toNano(1),
      });
}
