import { Contract } from "locklift/everscale-provider";
import { DexMiddlewareAbi } from "../../build/factorySource";
import { getRandomNonce, toNano } from "../../../ever-locklift";
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
  static deployDexInstance = async (owner: SignerWithAccount) => {
    const { code: dexMiddlewareChildCode } = locklift.factory.getContractArtifacts("DexChildMiddleware");
    const { contract } = await locklift.tracing.trace(
      locklift.factory.deployContract({
        contract: "DexMiddleware",
        constructorParams: {},
        value: toNano(2),
        publicKey: owner.signer.publicKey,
        initParams: {
          nonce: getRandomNonce(),
          dexMiddlewareChildCode,
        },
      }),
    );
    return new DexMiddleware(contract, owner);
  };
}
